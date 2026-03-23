import Fastify from "fastify";
import { validateEnvOrExit } from "../config/validate_env";
import { getEnv } from "../config/env";
import { stateProvider } from "../state";
import { createRequestLogger, logger } from "../shared/logger";
import { GuestContext } from "../ai_agent";

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

app.post<{ Body: VoiceCommandBody }>("/api/v1/voice-command", async (request, reply) => {
  const reqLogger = createRequestLogger(request.headers["x-request-id"] as string | undefined);
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
