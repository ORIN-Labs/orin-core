/**
 * Backend API client
 * ---------------------------------------------------
 * Typed wrapper for the ORIN backend REST endpoints.
 * Matches the contract defined in backend/src/api/server.ts.
 */

/** Must match backend/src/ai_agent.ts GuestContext */
export interface GuestContext {
  name: string;
  loyaltyPoints: number;
  history: string[];
}

export interface VoiceCommandRequest {
  guestPda: string;
  userInput: string;
  guestContext: GuestContext;
}

export interface VoiceCommandResponse {
  status: "accepted";
  guestPda: string;
  message: string;
}

export interface ManualPreferencesRequest {
  guestPda: string;
  preferences: any; // RoomPreferences
  guestContext: GuestContext;
}

/**
 * Backend API base URL.
 * In production this should come from NEXT_PUBLIC_API_URL env var.
 * Falls back to localhost:3001 for local development.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY =
  process.env.NEXT_PUBLIC_API_KEY || "orin_secret_key_2026_dev";

/**
 * Step A: Sends the raw voice command / preferences to the backend.
 * The backend stages this as a "pending command" in Redis, awaiting
 * hash-lock verification from the Solana listener.
 *
 * @param payload - The voice command request body
 * @returns Accepted response from the backend
 * @throws Error if the request fails or returns non-202
 */
export async function stageVoiceCommand(
  payload: VoiceCommandRequest
): Promise<VoiceCommandResponse> {
  const response = await fetch(`${API_BASE}/api/v1/voice-command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `API error (${response.status}): ${errorBody}`
    );
  }

  return response.json();
}

/**
 * Step A (Bypass): Sends raw preferences to the high-speed bypass endpoint.
 * This skips AI inference for instant (O(ms)) manual UI controls.
 *
 * @param payload - The manual preferences request body
 * @returns Accepted response from the backend
 */
export async function stageManualPreferences(
  payload: ManualPreferencesRequest
): Promise<VoiceCommandResponse> {
  const response = await fetch(`${API_BASE}/api/v1/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

/**
 * Health check for the backend API.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
