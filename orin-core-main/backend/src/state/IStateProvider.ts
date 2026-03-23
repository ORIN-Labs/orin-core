import { GuestContext, OrinAgentOutput } from "../ai_agent";

/**
 * State provider contracts
 * -------------------------------------------------------------
 * Abstracts persistence so runtime logic is storage-agnostic.
 * Implementations can target Redis, Postgres, DynamoDB, etc.
 */

export interface PendingCommand {
  guestPda: string;
  userInput: string;
  guestContext: GuestContext;
  createdAt: number;
}

export interface ValidatedState {
  guestPda: string;
  hashHex: string;
  payload: OrinAgentOutput;
  validatedAt: number;
}

export interface IStateProvider {
  // Hash deduplication and replay protection.
  getLastProcessedHash(guestPda: string): Promise<string | null>;
  setLastProcessedHash(guestPda: string, hashHex: string): Promise<void>;

  // Command staging from API ingress before on-chain verification.
  setPendingCommand(command: PendingCommand): Promise<void>;
  getPendingCommand(guestPda: string): Promise<PendingCommand | null>;
  clearPendingCommand(guestPda: string): Promise<void>;

  // Audit trail for validated hash-lock decisions.
  setValidatedState(state: ValidatedState): Promise<void>;
}
