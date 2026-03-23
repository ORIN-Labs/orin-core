import { IStateProvider, PendingCommand, ValidatedState } from "./IStateProvider";

/**
 * In-memory state provider
 * -------------------------------------------------------------
 * Useful for local smoke tests when Redis is unavailable.
 * Data is ephemeral and lost on process restart.
 */
export class MemoryStateProvider implements IStateProvider {
  private readonly lastHash = new Map<string, string>();
  private readonly pending = new Map<string, PendingCommand>();
  private readonly validated = new Map<string, ValidatedState>();

  async getLastProcessedHash(guestPda: string): Promise<string | null> {
    return this.lastHash.get(guestPda) ?? null;
  }

  async setLastProcessedHash(guestPda: string, hashHex: string): Promise<void> {
    this.lastHash.set(guestPda, hashHex);
  }

  async setPendingCommand(command: PendingCommand): Promise<void> {
    this.pending.set(command.guestPda, command);
  }

  async getPendingCommand(guestPda: string): Promise<PendingCommand | null> {
    return this.pending.get(guestPda) ?? null;
  }

  async clearPendingCommand(guestPda: string): Promise<void> {
    this.pending.delete(guestPda);
  }

  async setValidatedState(state: ValidatedState): Promise<void> {
    this.validated.set(state.guestPda, state);
  }
}

