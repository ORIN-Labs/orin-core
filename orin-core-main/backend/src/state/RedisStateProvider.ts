import Redis from "ioredis";
import { getEnv } from "../config/env";
import { IStateProvider, PendingCommand, ValidatedState } from "./IStateProvider";

/**
 * Redis-backed state provider
 * -------------------------------------------------------------
 * Stores:
 * - last processed hashes (dedup/replay guard)
 * - staged commands from API
 * - validated state snapshots for short-term auditability
 */

const env = getEnv();

export class RedisStateProvider implements IStateProvider {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(env.REDIS_URL, { lazyConnect: false });
  }

  async getLastProcessedHash(guestPda: string): Promise<string | null> {
    return this.redis.get(`orin:last_hash:${guestPda}`);
  }

  async setLastProcessedHash(guestPda: string, hashHex: string): Promise<void> {
    await this.redis.set(`orin:last_hash:${guestPda}`, hashHex);
  }

  async setPendingCommand(command: PendingCommand): Promise<void> {
    // 1 hour TTL prevents stale pending commands from accumulating.
    await this.redis.set(
      `orin:pending:${command.guestPda}`,
      JSON.stringify(command),
      "EX",
      3600
    );
  }

  async getPendingCommand(guestPda: string): Promise<PendingCommand | null> {
    const raw = await this.redis.get(`orin:pending:${guestPda}`);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PendingCommand;
  }

  async clearPendingCommand(guestPda: string): Promise<void> {
    await this.redis.del(`orin:pending:${guestPda}`);
  }

  async setValidatedState(state: ValidatedState): Promise<void> {
    // 24 hour TTL keeps recent audit records while controlling memory growth.
    await this.redis.set(`orin:validated:${state.guestPda}`, JSON.stringify(state), "EX", 86400);
  }
}
