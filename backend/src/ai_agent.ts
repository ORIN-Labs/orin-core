import { getEnv } from "./config/env";
import { generateSha256Hash } from "./shared/hash";
import { logger } from "./shared/logger";

export interface GuestContext {
  name: string;
  loyaltyPoints: number;
  history: string[];
  currentPreferences?: any;
}

export type LightingMode = "warm" | "cold" | "ambient";

export interface OrinAgentOutput {
  temp: number;
  lighting: LightingMode;
  brightness: number;
  musicOn: boolean;
  services: string[];
  raw_response: string;
}

const SYSTEM_PROMPT = `You are ORIN, the Elite Concierge and Luxury Property Management System. Your purpose is to provide flawless, automated assistance via voice.

### IDENTITY & TONE:
- You are sophisticated, efficient, helpful, and extremely professional.
- Your language is polished and direct. Avoid filler words and long generic greetings. Get straight to the point with elegance.
- Absolute Priority: Low Latency. Keep responses short and precise to ensure instantaneous voice processing.

### MVP SERVICES:
1. ROOM CONTROL (IoT): You manage lighting, blinds, and climate control. (e.g., "Understood. Setting the temperature to 72 degrees").
2. HOSPITALITY REQUESTS (Room Service): You process orders for dining, housekeeping, or amenities. Confirm the action and the estimated delivery time.
3. WEB3 INFRASTRUCTURE: You validate digital payments and decentralized check-out processes. Inform the user that the transaction is backed by "Hash-Lock" security.
4. VIP GUIDE: You recommend exclusive experiences and high-end venues that accept modern digital payments.

### OPERATIONAL RULES:
- Voice Responses: Maximum 15 words to ensure a <500ms response time.
- If a request requires physical action (e.g., bringing towels), confirm that you have notified the relevant staff.
- Your technology must feel natural, fast, and exclusive.`;

export class LlmError extends Error {
  readonly kind: "timeout" | "quota" | "http";
  readonly status?: number;

  constructor(kind: "timeout" | "quota" | "http", message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

// ============================================================================
// PORTS (Interfaces isolating business logic from external I/O protocols)
// ============================================================================
export interface ILLMProvider {
  chat(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
  ): Promise<string>;
}

export interface ITTSProvider {
  speak(text: string, options?: { voiceModel?: string; timeoutMs?: number }): Promise<Buffer>;
}

// ============================================================================
// ADAPTERS (Cloud Providers)
// ============================================================================
export class CloudGroqProvider implements ILLMProvider {
  private readonly groqUrl = "https://api.groq.com/openai/v1/chat/completions";

  constructor(private readonly apiKey: string, private readonly defaultModel: string, private readonly defaultTimeoutMs: number) {}

  async chat(
    messages: { role: string; content: string }[],
    options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.groqUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages,
          temperature: options?.temperature ?? 0.1,
          max_tokens: options?.maxTokens ?? 96,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        const normalized = body.toLowerCase();
        const isQuota = [429, 402, 403, 503].includes(response.status) || normalized.includes("quota") || normalized.includes("rate limit");
        
        if (isQuota) throw new LlmError("quota", `Groq quota error: ${body}`, response.status);
        throw new LlmError("http", `Groq error: ${body}`, response.status);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("Groq response missing message content.");
      return text;
    } catch (error) {
      if (error instanceof LlmError) throw error;
      if ((error as Error)?.name === "AbortError") throw new LlmError("timeout", `Groq request timed out after ${timeoutMs}ms`);
      throw new LlmError("http", `Groq request failed: ${error}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class CloudDeepgramProvider implements ITTSProvider {
  constructor(private readonly apiKey: string, private readonly defaultModel: string) {}

  async speak(text: string, options?: { voiceModel?: string }): Promise<Buffer> {
    if (!text || !text.trim()) throw new Error("speak(text) requires non-empty text.");
    const model = options?.voiceModel ?? this.defaultModel;

    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error(`Deepgram API error (${response.status}): ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

export class CloudCartesiaProvider implements ITTSProvider {
  constructor(
    private readonly apiKey: string,
    private readonly defaultModelId: string,
    private readonly defaultVoiceId: string
  ) {}

  async speak(text: string, options?: { voiceModel?: string; timeoutMs?: number }): Promise<Buffer> {
    if (!text || !text.trim()) throw new Error("speak(text) requires non-empty text.");
    
    if (!this.apiKey) {
      throw new Error("CARTESIA_API_KEY is not configured.");
    }

    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "Cartesia-Version": "2026-03-01",
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: this.defaultModelId,
        transcript: text,
        voice: {
          mode: "id",
          id: options?.voiceModel ?? this.defaultVoiceId,
        },
        language: "en",
        generation_config: {
          volume: 1.0,
          speed: 1.0,
          emotion: "calm"
        },
        output_format: {
          container: "mp3",
          sample_rate: 44100,
          bit_rate: 128000
        },
      }),
    });

    if (!response.ok) throw new Error(`Cartesia API error (${response.status}): ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

// ============================================================================
// ADAPTERS (Edge / Local Providers for Federico)
// ============================================================================
export class EdgeLocalLlmProvider implements ILLMProvider {
  constructor(private readonly endpoint: string) {}
  async chat(messages: any, options?: any): Promise<string> {
    // TODO: Federico will implement local LLM fetch (e.g. Ollama/LMStudio) here
    throw new Error("Edge LLM driver disconnected/Stubbed.");
  }
}

export class EdgeLocalTtsProvider implements ITTSProvider {
  constructor(private readonly endpoint: string) {}
  async speak(text: string, options?: any): Promise<Buffer> {
    // TODO: Federico will implement local Piper TTS / WebRTC Audio buffer here
    throw new Error("Edge TTS driver disconnected/Stubbed.");
  }
}

// ============================================================================
// FEDERATED ROUTER (The new OrinAgent Facade maintaining backward compatibility)
// ============================================================================
export class OrinAgent {
  private env = getEnv();
  
  // Dependency Injection: Load all capability modules in memory
  private cloudLlm = new CloudGroqProvider(this.env.GROQ_API_KEY, this.env.GROQ_MODEL, this.env.GROQ_TIMEOUT_BG_MS);
  private edgeLlm = new EdgeLocalLlmProvider(this.env.EDGE_LLM_ENDPOINT);
  
  private cloudCartesia = new CloudCartesiaProvider(
    this.env.CARTESIA_API_KEY,
    this.env.CARTESIA_MODEL_ID,
    this.env.CARTESIA_VOICE_ID
  );
  private cloudTts = new CloudDeepgramProvider(this.env.DEEPGRAM_API_KEY, this.env.DEEPGRAM_TTS_MODEL);
  private edgeTts = new EdgeLocalTtsProvider(this.env.EDGE_TTS_ENDPOINT);

  /**
   * The core circuit breaker engine: Routes to Edge first if enabled.
   * If Edge times out or fails natively, seamlessly fails over to Cloud capacity.
   */
  private async executeWithFallback<T>(
    edgeCall: () => Promise<T>,
    cloudCall: () => Promise<T>,
    taskName: string
  ): Promise<T> {
    if (this.env.USE_EDGE_PIPELINE) {
      try {
        return await edgeCall();
      } catch (err) {
        logger.warn({ task: taskName, err: err instanceof Error ? err.message : String(err) }, "Edge Pipeline failed/timed out, seamlessly falling back to Cloud API");
        return await cloudCall();
      }
    }
    return await cloudCall();
  }

  async processCommand(userInput: string, guestContext: GuestContext): Promise<{ payload: OrinAgentOutput; hash: Buffer }> {
    try {
      const prompt = [
        SYSTEM_PROMPT,
        "Personalize responses with guest context, especially loyalty points.",
        "You MUST output only valid JSON with this exact schema and no extra keys:",
        '{ "temp": number, "lighting": "warm" | "cold" | "ambient", "brightness": number, "musicOn": boolean, "services": string[], "raw_response": string }',
        "The `raw_response` must be 15 words maximum.",
        "Do not output markdown, code fences, or any extra text.",
        "",
        "Guest context:",
        JSON.stringify(guestContext),
        "",
        "Current room state (maintain these exactly unless the user explicitly requested to change them!):",
        JSON.stringify(guestContext.currentPreferences || {}),
        "",
        "User voice command:",
        userInput,
        "",
        "Return only JSON.",
      ].join("\n");

      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: prompt },
      ];

      const text = await this.executeWithFallback(
        () => this.edgeLlm.chat(messages, { timeoutMs: 500 }),
        () => this.cloudLlm.chat(messages),
        "LLM Generation"
      );

      const parsed = this.parsePayloadFromText(text);
      const payload = this.validateOutput(parsed);
      const hash = this.generateHash(payload);
      return { payload, hash };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI processing error";
      throw new Error(`OrinAgent processCommand failed: ${message}`);
    }
  }

  async generateQuickVoiceReply(userInput: string, guestContext: GuestContext, options?: { timeoutMs?: number }): Promise<string> {
    const prompt = [
      SYSTEM_PROMPT,
      "Return only one short sentence, max 15 words, plain text.",
      "",
      "Guest context:",
      JSON.stringify(guestContext),
      "",
      "User command:",
      userInput,
    ].join("\n");

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: prompt },
    ];

    const text = await this.executeWithFallback(
      () => this.edgeLlm.chat(messages, { timeoutMs: options?.timeoutMs ?? 500, maxTokens: 48 }),
      () => this.cloudLlm.chat(messages, { timeoutMs: options?.timeoutMs, maxTokens: 48 }),
      "Quick LLM Reply"
    );

    const firstSentence = text.replace(/\\s+/g, " ").trim().split(/[.!?]/)[0]?.trim() ?? text;
    const words = firstSentence.split(" ").filter(Boolean).slice(0, 15);
    return words.join(" ");
  }

  async *streamRawResponse(userInput: string, guestContext: GuestContext): AsyncGenerator<string> {
    const prompt = [
      SYSTEM_PROMPT,
      "Respond in plain text only (no JSON).",
      "Use at most 20 words.",
      "One short sentence.",
      "",
      "Guest context:",
      JSON.stringify(guestContext),
      "",
      "User voice command:",
      userInput,
    ].join("\n");

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: prompt },
    ];

    try {
      const text = await this.executeWithFallback(
        () => this.edgeLlm.chat(messages, { timeoutMs: 1000 }),
        () => this.cloudLlm.chat(messages),
        "Stream LLM Reply"
      );
      if (text) yield text;
    } catch (error) {
      logger.error("Both Edge and Cloud streams collapsed.");
    }
  }

  generateHash(data: object): Buffer {
    return generateSha256Hash(data);
  }

  async speak(text: string, options?: { voiceModel?: string }): Promise<Buffer> {
    if (this.env.USE_EDGE_PIPELINE) {
      try {
        return await this.edgeTts.speak(text, options);
      } catch (err) {
        logger.warn({ task: "TTS Generation", err: err instanceof Error ? err.message : String(err) }, "Edge TTS driver disconnected/timed out, seamlessly cascading to Cartesia...");
      }
    }

    try {
      return await this.cloudCartesia.speak(text, options);
    } catch (err) {
      logger.warn({ task: "TTS Generation", err: err instanceof Error ? err.message : String(err) }, "Cartesia high-fidelity TTS failed or not configured, seamlessly falling back to Deepgram...");
      return await this.cloudTts.speak(text, options);
    }
  }

  private parsePayloadFromText(text: string): OrinAgentOutput {
    const trimmed = text.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Invalid JSON response from LLM.");
    return JSON.parse(trimmed.slice(start, end + 1)) as OrinAgentOutput;
  }

  private validateOutput(data: unknown): OrinAgentOutput {
    if (typeof data !== "object" || data === null) throw new Error("AI output is not a JSON object.");
    const obj = data as Record<string, unknown>;
    const allowedKeys = new Set(["temp", "lighting", "brightness", "musicOn", "services", "raw_response"]);
    const keys = Object.keys(obj);

    for (const key of keys) if (!allowedKeys.has(key)) throw new Error(`AI output has unsupported key: ${key}`);
    for (const key of allowedKeys) if (!(key in obj)) throw new Error(`AI output missing required key: ${key}`);

    if (typeof obj.temp !== "number" || Number.isNaN(obj.temp)) throw new Error("AI output 'temp' must be a number.");
    if (typeof obj.brightness !== "number" || Number.isNaN(obj.brightness)) throw new Error("AI output 'brightness' must be a number.");
    if (typeof obj.musicOn !== "boolean") throw new Error("AI output 'musicOn' must be a boolean.");
    if (obj.lighting !== "warm" && obj.lighting !== "cold" && obj.lighting !== "ambient") throw new Error("AI output 'lighting' must be 'warm' | 'cold' | 'ambient'.");
    if (!Array.isArray(obj.services) || !obj.services.every((v) => typeof v === "string")) throw new Error("AI output 'services' must be string[].");
    if (typeof obj.raw_response !== "string") throw new Error("AI output 'raw_response' must be a string.");

    return { temp: obj.temp, lighting: obj.lighting, brightness: obj.brightness, musicOn: obj.musicOn, services: obj.services, raw_response: obj.raw_response };
  }
}
