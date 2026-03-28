import Fastify from "fastify";
import cors, { type FastifyCorsOptions } from "@fastify/cors";
import multipart from "@fastify/multipart";
import { createClient } from "@deepgram/sdk";
import { Connection } from "@solana/web3.js";
import { validateEnvOrExit } from "../config/validate_env";
import { getEnv, getAllowedOrigins } from "../config/env";
import { stateProvider } from "../state";
import { createRequestLogger, logger } from "../shared/logger";
import { GuestContext, OrinAgent } from "../ai_agent";
import { generateSha256Hash } from "../shared/hash";
import { getFeePayerKeypair, relayTransaction } from "../shared/feePayer";
import { RPC_ENDPOINT } from "../shared/constants";

/**
 * ORIN Production API Gateway
 * -------------------------------------------------------------
 * Receives voice-command payloads from upstream channels
 * (mobile app, web app, voice assistant webhook) and stages
 * them in persistent state for hash-lock verification by listener.
 */

validateEnvOrExit();
const env = getEnv();

// Eagerly validate + load the fee-payer keypair at startup.
// Fails fast if FEE_PAYER_PRIVATE_KEY is misconfigured rather than at relay time.
getFeePayerKeypair();

// Shared RPC connection used by the relay endpoint
const rpcConnection = new Connection(RPC_ENDPOINT, "confirmed");

type VoiceCommandBody = {
  guestPda: string;
  userInput: string;
  guestContext: GuestContext;
};

// ---------------------------------------------------------------------------
// CORS — Production-grade configuration
// ---------------------------------------------------------------------------
// ALLOWED_ORIGIN supports a comma-separated list of origins so this config
// works identically in local dev and production without code changes.
// The origin validator uses a Set for O(1) lookup regardless of list size.
// ---------------------------------------------------------------------------
const allowedOrigins = new Set(getAllowedOrigins());

/** HTTP methods exposed on every route */
const ALLOWED_METHODS: string[] = ["GET", "POST", "OPTIONS"];

/**
 * Request headers the client is permitted to send.
 * Must explicitly list every non-CORS-safe header the frontend uses.
 */
const ALLOWED_HEADERS: string[] = [
  "Content-Type",
  "Authorization",
  "X-API-KEY",
  "X-Request-ID",
];

/**
 * Response headers the browser is allowed to read from JavaScript.
 * Expose only what the frontend actually needs to inspect.
 */
const EXPOSED_HEADERS: string[] = ["X-Request-ID"];

const app = Fastify({ logger: false });

const corsOptions: FastifyCorsOptions = {
  /**
   * Dynamic origin validator.
   * Returns `true` to echo the origin back (required for credentialed requests);
   * returns `false` to reject. Falls back to `true` for server-to-server requests
   * that carry no Origin header (e.g. curl health checks, Railway probe).
   */
  origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    // Allow server-to-server requests that carry no Origin header (e.g. curl, health checks).
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    cb(new Error(`CORS: origin '${origin}' is not permitted.`), false);
  },
  methods: ALLOWED_METHODS,
  allowedHeaders: ALLOWED_HEADERS,
  exposedHeaders: EXPOSED_HEADERS,
  credentials: true,              // Required if the frontend ever sends cookies / auth headers.
  maxAge: 86_400,                 // Cache preflight for 24 h — eliminates per-request OPTIONS round-trips.
  preflight: true,                // Fastify handles OPTIONS automatically.
  strictPreflight: false,         // Be lenient: non-preflight OPTIONS still succeed.
};

app.register(cors, corsOptions);
// Replaces Express 'multer.memoryStorage()' with Fastify's high-speed equivalent
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio uploads
  },
});

app.post<{ Body: VoiceCommandBody }>("/api/v1/voice-command", async (request, reply) => {
  const reqLogger = createRequestLogger(request.headers["x-request-id"] as string | undefined);

  // Production Auth Check
  const apiKey = request.headers["x-api-key"];
  if (apiKey !== env.API_KEY) {
    reqLogger.warn({ origin: request.headers.origin }, "unauthorized_api_access");
    return reply.status(401).send({ error: "Unauthorized. Valid X-API-KEY required." });
  }

  const { guestPda, userInput, guestContext } = request.body ?? ({} as VoiceCommandBody);

  if (!guestPda || !userInput || !guestContext) {
    reqLogger.error("invalid_request_body");
    return reply.status(400).send({
      error: "Invalid body. Required: guestPda, userInput, guestContext",
    });
  }

  try {
    const agent = new OrinAgent();
    // 💡 Resolve the AI intent right now during the HTTPS request.
    // Because the blockchain Hash-Lock demands the user sign the EXACT payload Hash,
    // we cannot defer AI to the listener. The frontend MUST have the AI's hash to mint the TX.
    const aiResult = await agent.processCommand(userInput, guestContext);
    console.log("aiResult", aiResult);
    const aiHashHex = aiResult.hash.toString("hex");

    // Stage it exactly like a manual bypass payload so the listener just verifies and executes
    await stateProvider.setDirectPayload(aiHashHex, aiResult.payload);
    reqLogger.info({ guest_pda: guestPda, hash: aiHashHex }, "ai_command_resolved_and_staged");

    return reply.status(200).send({
      status: "accepted",
      guestPda,
      hash: aiHashHex, // Send this critical piece to the frontend!
      message: "Command parsed by AI. Awaiting on-chain hash-lock validation.",
    });
  } catch (error: any) {
    reqLogger.error({ error: error.message }, "ai_processing_error");
    return reply.status(500).send({ error: "Voice AI processing failed", details: error.message });
  }
});

/**
 * DIRECT BYPASS ENDPOINT (Web2.5 High-Speed Channel)
 * -------------------------------------------------------------
 * For manual slider adjustments on the frontend that do not require
 * AI inference. Receives explicit JSON, computes the canonical hash,
 * and caches it directly in Redis awaiting Solana confirmation.
 */
app.post<{ Body: Record<string, unknown> }>("/api/v1/preferences", async (request, reply) => {
  const reqLogger = createRequestLogger(request.headers["x-request-id"] as string | undefined);

  // Production Auth Check: Protect memory exhaust attacks from unauthorized payloads
  const apiKey = request.headers["x-api-key"];
  if (apiKey !== env.API_KEY) {
    reqLogger.warn({ origin: request.headers.origin }, "unauthorized_bypass_access");
    return reply.status(401).send({ error: "Unauthorized. Valid X-API-KEY required." });
  }

  // Ensure payload is an actual object preventing injection or bad formats
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    reqLogger.error("invalid_preferences_body");
    return reply.status(400).send({ error: "Invalid JSON object for preferences." });
  }

  // Hash the ENTIRE canonical body — frontend must hash the same full object
  const hashHex = generateSha256Hash(request.body).toString("hex");

  await stateProvider.setDirectPayload(hashHex, request.body);
  reqLogger.info({ hash: hashHex }, "direct_payload_stored");

  return reply.status(200).send({
    status: "success",
    info: "Payload staged in Redis cache bypassing AI. Awaiting Solana Hash Verification signal.",
    hash: hashHex
  });
});


/**
 * VOICE TRANSCRIPTION ENDPOINT (AI Interface Channel)
 * -------------------------------------------------------------
 * Takes incoming audio data (multipart/form-data), transcribes it
 * using Deepgram Nova-2 via their in-memory buffers (zero disk I/O),
 * and returns the structured LLM-ready text string.
 */
app.post("/api/v1/transcribe", async (request, reply) => {
  const reqLogger = createRequestLogger(request.headers["x-request-id"] as string | undefined);

  // Production Auth Check: Protect costly upstream Deepgram tokens
  const apiKey = request.headers["x-api-key"];
  if (apiKey !== env.API_KEY) {
    reqLogger.warn({ origin: request.headers.origin }, "unauthorized_transcription_access");
    return reply.status(401).send({ error: "Unauthorized. Valid X-API-KEY required." });
  }

  try {
    const data = await request.file();
    if (!data) {
      reqLogger.error("no_audio_file");
      return reply.status(400).send({ error: "No audio file provided in the payload." });
    }

    const audioBuffer = await data.toBuffer();

    const deepgramApiKey = env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      reqLogger.error("deepgram_key_missing");
      return reply.status(500).send({ error: "Internal Server Error. Deepgram API configuration missing." });
    }

    const deepgram = createClient(deepgramApiKey);

    // Deepgram allows sending pure Buffers natively if we provide the exact configuration
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: env.DEEPGRAM_STT_MODEL,
        smart_format: true,
      }
    );

    if (error) {
      reqLogger.error({ error }, "deepgram_api_failure");
      return reply.status(500).send({ error: "Transcription failed.", details: error.message });
    }

    // Safely extract the primary transcript result
    const transcript = result?.results?.channels[0]?.alternatives[0]?.transcript || "";
    
    reqLogger.info({ bytes: audioBuffer.byteLength, transcript_length: transcript.length }, "audio_transcribed");
    return reply.status(200).send({
      status: "success",
      text: transcript,
    });
  } catch (error: any) {
    reqLogger.error({ error: error.message }, "transcription_endpoint_error");
    return reply.status(500).send({
      error: "Internal server error during transcription.",
      details: error.message,
    });
  }
});

/**
 * GAS RELAY ENDPOINT (FeePayer / Account Abstraction)
 * -------------------------------------------------------------
 * Accepts a base64-encoded, PARTIALLY-SIGNED Solana transaction
 * from the frontend. The guest wallet has already signed the
 * instruction-authorizing signature. This endpoint adds the
 * server's fee-payer co-signature so the guest pays zero gas.
 *
 * Security model:
 *   - X-API-KEY auth required (same as all other routes).
 *   - The Anchor program's `has_one = owner` constraint ensures
 *     the server's fee-payer key cannot forge guest instructions.
 *   - We validate feePayer matches our server key before signing.
 *   - recentBlockhash presence is enforced to block replay attacks.
 */
app.post<{ Body: { transaction: string } }>("/api/v1/relay", async (request, reply) => {
  const reqLogger = createRequestLogger(request.headers["x-request-id"] as string | undefined);

  // Auth guard
  const apiKey = request.headers["x-api-key"];
  if (apiKey !== env.API_KEY) {
    reqLogger.warn({ origin: request.headers.origin }, "unauthorized_relay_access");
    return reply.status(401).send({ error: "Unauthorized. Valid X-API-KEY required." });
  }

  const { transaction } = request.body ?? {};

  if (!transaction || typeof transaction !== "string") {
    reqLogger.error("missing_transaction_payload");
    return reply.status(400).send({
      error: "Invalid body. Required: { transaction: string } (base64-encoded serialized Transaction)",
    });
  }

  try {
    reqLogger.info("relay_request_received");
    const result = await relayTransaction(rpcConnection, transaction);
    reqLogger.info(
      { signature: result.signature, fee_payer: result.feePayerPubkey },
      "relay_success"
    );
    return reply.status(200).send({
      status: "success",
      signature: result.signature,
      feePayerPubkey: result.feePayerPubkey,
      message: "Transaction co-signed and broadcast. Gas subsidized by ORIN.",
    });
  } catch (error: any) {
    reqLogger.error({ error: error.message }, "relay_error");
    return reply.status(500).send({
      error: "Relay failed.",
      details: error.message,
    });
  }
});

app.get("/health", async () => ({ status: "ok" }));

/**
 * Starts Fastify server with validated env configuration.
 */
export async function startApiServer(): Promise<void> {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  logger.info({ host: env.API_HOST, port: env.API_PORT }, "api_server_started");
}

if (require.main === module) {
  startApiServer().catch((err) => {
    logger.error({ err: err.message }, "api_server_start_error");
    process.exit(1);
  });
}
