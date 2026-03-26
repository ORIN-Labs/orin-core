import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getEnv } from "./config/env";
import { generateSha256Hash } from "./shared/hash";

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

export class OrinAgent {
  private readonly model: ChatGoogleGenerativeAI;
  private readonly parser: JsonOutputParser<OrinAgentOutput>;
  private readonly prompt: ChatPromptTemplate;
  private readonly env = getEnv();

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      model: this.env.GOOGLE_MODEL,
      apiKey: this.env.GOOGLE_API_KEY,
      temperature: 0.2,
    });

    this.parser = new JsonOutputParser<OrinAgentOutput>();

    this.prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        [
          "You are ORIN Concierge, a luxury hospitality AI for a premium hotel.",
          "Personalize responses with guest context, especially loyalty points.",
          "You MUST output only valid JSON with this exact schema and no extra keys:",
          // FIX: In LangChain, system prompts use single braces { } for variables.
          // To safely include a JSON schema string without triggering an 'INVALID_PROMPT_INPUT' error,
          // the curly braces must be escaped by doubling them as {{ and }}.
          '{{ "temp": number, "lighting": "warm" | "cold" | "ambient", "services": string[], "raw_response": string }}',
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

  async processCommand(
    userInput: string,
    guestContext: GuestContext
  ): Promise<{ payload: OrinAgentOutput; hash: Buffer }> {
    try {
      const chain = this.prompt.pipe(this.model).pipe(this.parser);
      const parsed = await chain.invoke({
        userInput,
        guestContext: JSON.stringify(guestContext),
      });

      const payload = this.validateOutput(parsed);
      const hash = this.generateHash(payload);

      return { payload, hash };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI processing error";
      throw new Error(`OrinAgent processCommand failed: ${message}`);
    }
  }

  generateHash(data: object): Buffer {
    return generateSha256Hash(data);
  }

  async speak(text: string, options?: { voiceModel?: string }): Promise<Buffer> {
    const apiKey = this.env.DEEPGRAM_API_KEY;
    const model = options?.voiceModel ?? this.env.DEEPGRAM_TTS_MODEL;

    if (!text || !text.trim()) {
      throw new Error("speak(text) requires non-empty text.");
    }

    // Deepgram TTS API: model must be a query param, NOT in the JSON body.
    // Body accepts ONLY { text } — any extra keys trigger PAYLOAD_ERROR.
    const ttsUrl = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`;
    const response = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Deepgram API error (${response.status}): ${errText}`);
    }

    const audioArrayBuffer = await response.arrayBuffer();
    return Buffer.from(audioArrayBuffer);
  }

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
