/**
 * Save Preferences Orchestrator
 * ---------------------------------------------------
 * Implements the complete Frontend Hash-Lock Workflow:
 *
 *   Step A → Send raw command to Backend API
 *   Step B → Calculate SHA-256 hash locally in browser
 *   Step C → Write ONLY the hash to Solana on-chain
 *
 * This is the single function the UI calls when the guest
 * clicks "Save my setup" on the Room Control screen.
 */

import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { stageVoiceCommand, stageManualPreferences, GuestContext, relayTransaction } from "./api";
import { updatePreferencesOnChain } from "./solana";
import { deriveGuestPda } from "./pda";

/**
 * Lazily resolves the relay opts at call-time (not at module-init).
 * This avoids Next.js SSR timing issues where NEXT_PUBLIC_ env vars
 * are not yet embedded when the module is first evaluated.
 */
export function getRelayOpts() {
  const pubkeyStr = process.env.NEXT_PUBLIC_FEE_PAYER_PUBKEY;
  if (!pubkeyStr) {
    console.warn("[ORIN] NEXT_PUBLIC_FEE_PAYER_PUBKEY not set — falling back to direct-pay mode.");
    return undefined;
  }
  console.debug(`[ORIN] Gas Relay active — fee payer: ${pubkeyStr}`);
  return {
    feePayerPubkey: new PublicKey(pubkeyStr),
    relayFn: relayTransaction,
  };
}

export interface RoomPreferences {
  target_temp_c: number;
  lighting: "warm" | "cold" | "ambient";
  brightness: number;
  musicOn: boolean;
  services: string[];
  raw_response: string;
}

export interface SavePreferencesResult {
  apiAccepted: boolean;
  hashHex: string;
  solanaTxSignature?: string;
  requiresSignature?: boolean;
  aiResult?: any;
}

/**
 * Voice AI Workflow
 * Orchestrates the Hash-Lock workflow for natural language inputs.
 * Uses the /api/v1/voice-command endpoint.
 */
export async function saveVoicePreferences(
  program: Program,
  guestPda: PublicKey,
  ownerPubkey: PublicKey,
  userInput: string,
  preferences: RoomPreferences,
  guestContext: GuestContext,
  guestIdentifier: string,
  onTextReady?: (text: string) => void
): Promise<SavePreferencesResult> {
  const activeContext = { ...guestContext, currentPreferences: preferences };
  const apiResponse = await stageVoiceCommand({
    guestPda: guestPda.toBase58(),
    userInput,
    guestContext: activeContext,
  });

  if (onTextReady && apiResponse.aiResult) {
    onTextReady(apiResponse.aiResult.raw_response || apiResponse.aiResult.text || "Command processed.");
  }

  // Extract the true AI-resolved Hash hex from the backend response
  const hashHex = apiResponse.hash;
  if (!hashHex) throw new Error("Backend did not return an AI Hash.");

  // Convert hex back to 32-byte Uint8Array for Anchor signing
  const hashBytes = new Uint8Array(hashHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

  let txSignature: string | undefined = undefined;

  if (apiResponse.requiresSignature) {
    const { identifierHash } = deriveGuestPda(guestIdentifier, ownerPubkey);
    txSignature = await updatePreferencesOnChain(
      program, guestPda, ownerPubkey, hashBytes,
      identifierHash, guestContext.name,
      getRelayOpts()
    );
  }

  return { 
    apiAccepted: apiResponse.status === "accepted", 
    hashHex, 
    solanaTxSignature: txSignature,
    requiresSignature: apiResponse.requiresSignature,
    aiResult: apiResponse.aiResult
  };
}

/**
 * Manual Bypass Workflow
 * Orchestrates the Hash-Lock workflow for direct UI slider changes.
 * Uses the high-speed /api/v1/preferences bypass endpoint.
 */
export async function saveManualPreferences(
  program: Program,
  guestPda: PublicKey,
  ownerPubkey: PublicKey,
  preferences: RoomPreferences,
  guestContext: GuestContext,
  guestIdentifier: string
): Promise<SavePreferencesResult> {
  // Build the EXACT body object that will be sent to the backend.
  // The backend hashes request.body, so we must hash this SAME object locally
  // to ensure canonical symmetry between the on-chain TX and the cached payload.
  const canonicalBody = {
    guestPda: guestPda.toBase58(),
    preferences,
    guestContext,
  };

  const apiResponse = await stageManualPreferences(canonicalBody);

  // Use the backend's deterministic hash (matches what the AI pipeline produces)
  const hashHex = apiResponse.hash;
  if (!hashHex) throw new Error("Backend did not return a canonical Hash.");
  const hashBytes = new Uint8Array(hashHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

  let txSignature: string | undefined = undefined;

  // Manual bypass often requires signature to sync state, but we obey backend
  if (apiResponse.requiresSignature !== false) {
    const { identifierHash } = deriveGuestPda(guestIdentifier, ownerPubkey);
    txSignature = await updatePreferencesOnChain(
      program, guestPda, ownerPubkey, hashBytes,
      identifierHash, guestContext.name,
      getRelayOpts()
    );
  }

  return { 
    apiAccepted: apiResponse.status === "accepted", 
    hashHex, 
    solanaTxSignature: txSignature,
    requiresSignature: apiResponse.requiresSignature !== false,
    aiResult: apiResponse.aiResult
  };
}
