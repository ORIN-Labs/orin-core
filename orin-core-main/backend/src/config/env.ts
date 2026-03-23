import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

/**
 * Centralized environment parsing and validation.
 * -------------------------------------------------------------
 * This module is the single source of truth for runtime config.
 * Any service startup path should depend on `getEnv()` so invalid
 * deployments fail fast before opening network listeners.
 */

const envSchema = z.object({
  NODE_ENV: z.string().optional().default("development"),
  NETWORK: z.enum(["devnet", "mainnet"]).default("devnet"),
  RPC_ENDPOINT: z.string().min(1),
  PROGRAM_ID: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-3-5-sonnet-latest"),
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_VOICE_ID: z.string().min(1),
  ELEVENLABS_MODEL_ID: z.string().min(1).default("eleven_multilingual_v2"),
  MQTT_BROKER_URL: z.string().min(1),
  MQTT_TOPIC: z.string().min(1),
  ENCRYPTION_SECRET: z.string().min(16),
  REDIS_URL: z.string().min(1),
  STATE_PROVIDER: z.enum(["redis", "memory"]).default("redis"),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
});

type ParsedEnv = z.infer<typeof envSchema>;

let cachedEnv: ParsedEnv | null = null;

/**
 * Returns validated environment config.
 * Uses in-memory cache to avoid repeated parsing/validation.
 */
export function getEnv(): ParsedEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
