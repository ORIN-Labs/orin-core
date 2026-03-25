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
import { generateSha256Hash } from "./hash";
import { stageVoiceCommand, stageManualPreferences, GuestContext } from "./api";
import { updatePreferencesOnChain } from "./solana";

export interface RoomPreferences {
  temp: number;
  lighting: "warm" | "cold" | "ambient";
  services: string[];
  raw_response: string;
}

export interface SavePreferencesResult {
  apiAccepted: boolean;
  hashHex: string;
  solanaTxSignature: string;
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
  guestContext: GuestContext
): Promise<SavePreferencesResult> {
  const apiResponse = await stageVoiceCommand({
    guestPda: guestPda.toBase58(),
    userInput,
    guestContext,
  });

  const hashBytes = await generateSha256Hash(preferences);
  const hashHex = Array.from(hashBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const txSignature = await updatePreferencesOnChain(program, guestPda, ownerPubkey, hashBytes);

  return { apiAccepted: apiResponse.status === "accepted", hashHex, solanaTxSignature: txSignature };
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
  guestContext: GuestContext
): Promise<SavePreferencesResult> {
  const apiResponse = await stageManualPreferences({
    guestPda: guestPda.toBase58(),
    preferences,
    guestContext,
  });

  const hashBytes = await generateSha256Hash(preferences);
  const hashHex = Array.from(hashBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const txSignature = await updatePreferencesOnChain(program, guestPda, ownerPubkey, hashBytes);

  return { apiAccepted: apiResponse.status === "accepted", hashHex, solanaTxSignature: txSignature };
}
