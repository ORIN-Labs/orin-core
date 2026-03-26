import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { createClient } from "@deepgram/sdk";
import { validateEnvOrExit } from "../config/validate_env";
import { getEnv } from "../config/env";
import { stateProvider } from "../state";
import { createRequestLogger, logger } from "../shared/logger";
import { GuestContext, OrinAgent } from "../ai_agent";
import { generateSha256Hash } from "../shared/hash";

/**
 * ORIN Production API Gateway
 * -------------------------------------------------------------
 * Receives voice-command payloads from upstream channels
 * (mobile app, web app, voice assistant webhook) and stages
 * them in persistent state for hash-lock verification by listener.
 */

validateEnvOrExit();
const env = getEnv();

type VoiceCommandBody = {
  guestPda: string;
  userInput: string;
  guestContext: GuestContext;
};

const app = Fastify({ logger: false });
app.register(cors, {
  origin: env.ALLOWED_ORIGIN,
});
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
