import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { AIClient, AIRequest, AIStreamEvent } from "./types.js";

export class GoogleClient implements AIClient {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async *stream(req: AIRequest): AsyncGenerator<AIStreamEvent> {
    try {
      const model = this.client.getGenerativeModel({ model: req.model });

      // Convert messages format
      const history = req.history
        .filter((m) => m.role !== "tool") // Google API doesn't use "tool" role in history
        .map((m) => {
          return {
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
          };
        });

      // Build request
      const request = {
        contents: [
          ...history,
          {
            role: "user",
            parts: [{ text: req.userMessage }],
          },
        ],
        systemInstruction: req.systemPrompt,
        generationConfig: {
          maxOutputTokens: req.maxTokens,
          temperature: 0.7,
        },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      };

      // Stream response
      const response = await model.generateContentStream(request);
      let fullText = "";

      for await (const chunk of response.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          yield { type: "delta", delta: text, fullText };
        }
      }

      // Return final state
      yield { type: "done", fullText };
    } catch (error) {
      yield { type: "error", error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
