import Fastify from "fastify";
import cors from "@fastify/cors";
import { validateEnvOrExit } from "../config/validate_env";
import { getEnv } from "../config/env";
import { stateProvider } from "../state";
import { createRequestLogger, logger } from "../shared/logger";
import { GuestContext } from "../ai_agent";
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

  await stateProvider.setPendingCommand({
    guestPda,
    userInput,
    guestContext,
    createdAt: Date.now(),
  });

  reqLogger.info({ guest_pda: guestPda }, "pending_command_stored");
  return reply.status(202).send({
    status: "accepted",
    guestPda,
    message: "Command staged. Awaiting on-chain hash-lock validation.",
  });
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

  // Generate canonical backend hash of the explicitly passed JSON options
  // This matches frontend/src/lib/hash.ts strictly
  const hashHex = generateSha256Hash(request.body).toString("hex");

  await stateProvider.setDirectPayload(hashHex, request.body);
  reqLogger.info({ hash: hashHex }, "direct_payload_stored");

  return reply.status(200).send({
    status: "success",
    info: "Payload staged in Redis cache bypassing AI. Awaiting Solana Hash Verification signal.",
    hash: hashHex
  });
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
