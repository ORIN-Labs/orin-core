import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ChatAnthropic } from "@langchain/anthropic";
import { getEnv } from "./config/env";
import { generateSha256Hash } from "./shared/hash";

/**
 * ORIN AI Agent
 * -------------------------------------------------------------
 * This module encapsulates the AI inference layer for ORIN's
 * Web2.5 privacy architecture.
 *
 * Main responsibilities:
 * 1) Convert natural language into strict structured JSON.
 * 2) Enforce output schema at runtime.
 * 3) Produce deterministic SHA-256 hash for on-chain hash-lock checks.
 * 4) Generate voice response audio through ElevenLabs.
 *
 * Security posture:
 * - No free-form output is accepted from the model.
 * - Unknown/missing keys are rejected.
 * - Hash uses canonical JSON serialization for deterministic verification.
 */

export interface GuestContext {
  name: string;
  loyaltyPoints: number;
  history: string[];
}

export type LightingMode = "warm" | "cold" | "ambient";

export interface OrinAgentOutput {
  temp: number;
  lighting: LightingMode;
  services: string[];
  raw_response: string;
}

type ElevenLabsVoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
};

/**
 * OrinAgent
 * -------------------------------------------------------------
 * Public API:
 * - processCommand(userInput, guestContext) -> { payload, hash }
 * - generateHash(data) -> Buffer
 * - speak(text, options?) -> Buffer (audio/mpeg bytes)
 */
export class OrinAgent {
  private readonly model: ChatAnthropic;
  private readonly parser: JsonOutputParser<OrinAgentOutput>;
  private readonly prompt: ChatPromptTemplate;
  private readonly env = getEnv();

  constructor() {
    // Claude model configuration.
    this.model = new ChatAnthropic({
      model: this.env.ANTHROPIC_MODEL,
      anthropicApiKey: this.env.ANTHROPIC_API_KEY,
      temperature: 0.2,
    });

    // Strict JSON parser. No markdown/text wrappers are expected.
    this.parser = new JsonOutputParser<OrinAgentOutput>();

    // Prompt contracts:
    // - concierge persona
    // - loyalty personalization
    // - strict output schema only
    this.prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        [
          "You are ORIN Concierge, a luxury hospitality AI for a premium hotel.",
          "Personalize responses with guest context, especially loyalty points.",
          "You MUST output only valid JSON with this exact schema and no extra keys:",
          '{ "temp": number, "lighting": "warm" | "cold" | "ambient", "services": string[], "raw_response": string }',
          "Do not output markdown, code fences, or any extra text.",
        ].join("\n"),
      ],
      [
        "human",
        [
          "Guest context:",
          "{guestContext}",
          "",
          "User voice command:",
          "{userInput}",
          "",
          "Return only JSON.",
        ].join("\n"),
      ],
    ]);
  }

  /**
   * processCommand
   * -----------------------------------------------------------
   * Input:
   * - userInput: raw user command (voice transcript or text)
   * - guestContext: context from chain/backend profile
   *
   * Output:
   * - payload: validated JSON object for off-chain execution
   * - hash: deterministic SHA-256 (32 bytes) used for hash-lock
   */
  async processCommand(
    userInput: string,
    guestContext: GuestContext
  ): Promise<{ payload: OrinAgentOutput; hash: Buffer }> {
    try {
      // SolRouter placeholder:
      // ---------------------------------------------------------
      // Future integration point to protect prompt transport:
      // const encryptedPayload = await solRouter.encrypt({ userInput, guestContext });
      // const modelResponse = await llm(encryptedPayload);
      // const decryptedResponse = await solRouter.decrypt(modelResponse);

      const chain = this.prompt.pipe(this.model).pipe(this.parser);
      const parsed = await chain.invoke({
        userInput,
        guestContext: JSON.stringify(guestContext),
      });

      // Runtime hard-validation prevents silent schema drift from LLMs.
      const payload = this.validateOutput(parsed);
      const hash = this.generateHash(payload);

      return { payload, hash };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown AI processing error";
      throw new Error(`OrinAgent processCommand failed: ${message}`);
    }
  }

  /**
   * Generates SHA-256 hash over canonical JSON representation.
   * This must match the exact method used before storing hash on-chain.
   */
  generateHash(data: object): Buffer {
    return generateSha256Hash(data);
  }

  /**
   * speak
   * -----------------------------------------------------------
   * Converts text into audio using ElevenLabs.
   * Returns an audio Buffer suitable for writing to `response.mp3`.
   */
  async speak(
    text: string,
    options?: { voiceId?: string; modelId?: string; voiceSettings?: ElevenLabsVoiceSettings }
  ): Promise<Buffer> {
    const apiKey = this.env.ELEVENLABS_API_KEY;
    const voiceId = options?.voiceId ?? this.env.ELEVENLABS_VOICE_ID;
    const modelId = options?.modelId ?? this.env.ELEVENLABS_MODEL_ID;
    if (!text || !text.trim()) {
      throw new Error("speak(text) requires non-empty text.");
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          ...(options?.voiceSettings ?? {}),
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errText}`);
    }

    const audioArrayBuffer = await response.arrayBuffer();
    return Buffer.from(audioArrayBuffer);
  }

  /**
   * Strict schema validator for AI payload.
   * Rejects:
   * - missing keys
   * - extra keys
   * - wrong value types
   */
  private validateOutput(data: unknown): OrinAgentOutput {
    if (typeof data !== "object" || data === null) {
      throw new Error("AI output is not a JSON object.");
    }

    const obj = data as Record<string, unknown>;
    const allowedKeys = new Set(["temp", "lighting", "services", "raw_response"]);
    const keys = Object.keys(obj);

    for (const key of keys) {
      if (!allowedKeys.has(key)) {
        throw new Error(`AI output has unsupported key: ${key}`);
      }
    }
    for (const key of allowedKeys) {
      if (!(key in obj)) {
        throw new Error(`AI output missing required key: ${key}`);
      }
    }

    if (typeof obj.temp !== "number" || Number.isNaN(obj.temp)) {
      throw new Error("AI output 'temp' must be a number.");
    }

    if (obj.lighting !== "warm" && obj.lighting !== "cold" && obj.lighting !== "ambient") {
      throw new Error("AI output 'lighting' must be 'warm' | 'cold' | 'ambient'.");
    }

    if (!Array.isArray(obj.services) || !obj.services.every((v) => typeof v === "string")) {
      throw new Error("AI output 'services' must be string[].");
    }

    if (typeof obj.raw_response !== "string") {
      throw new Error("AI output 'raw_response' must be a string.");
    }

    return {
      temp: obj.temp,
      lighting: obj.lighting,
      services: obj.services,
      raw_response: obj.raw_response,
    };
  }
}
