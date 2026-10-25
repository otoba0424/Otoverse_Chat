import { useCallback } from "react";
import { Message } from "../messages/messages";
import { useGeminiNanoChat } from "./geminiNanoChat";
import { useOpenAiChat } from "./openAiChat";
import { useOtoverseChat } from "./otoverseChat";

export const CHAT_ENGINES = [
  "Otoverse (Gemini)",
  "Gemini Nano",
  "OpenAI",
] as const;

export type ChatEngine = (typeof CHAT_ENGINES)[number];

export const DEFAULT_CHAT_ENGINE: ChatEngine = "Otoverse (Gemini)";

export const useChat = () => {
  const {
    load: otoverseLoad,
    getChatResponseStream: otoverseGetChatResponseStream,
  } = useOtoverseChat();
  const {
    load: geminiNanoLoad,
    getChatResponseStream: geminiNanoGetChatResponseStream,
  } = useGeminiNanoChat();
  const {
    load: openAiLoad,
    getChatResponseStream: openAiGetChatResponseStream,
  } = useOpenAiChat();

  const load = useCallback(
    async (
      chatEngine: ChatEngine,
      systemPrompt: string,
      assistantName?: string
    ) => {
      switch (chatEngine) {
        case "Otoverse (Gemini)":
          return await otoverseLoad(systemPrompt, assistantName);
        case "Gemini Nano":
          return await geminiNanoLoad(systemPrompt);
        case "OpenAI":
          return await openAiLoad(systemPrompt);
        default:
          throw Error("Selected chat engine is not supported");
      }
    },
    [otoverseLoad, geminiNanoLoad, openAiLoad]
  );

  const getChatResponseStream = useCallback(
    async (
      chatEngine: ChatEngine,
      messageLog: Message[],
      openAiApiKey: string
    ) => {
      switch (chatEngine) {
        case "Otoverse (Gemini)":
          return await otoverseGetChatResponseStream(messageLog);
        case "Gemini Nano":
          return await geminiNanoGetChatResponseStream(messageLog);
        case "OpenAI":
          return await openAiGetChatResponseStream(messageLog, openAiApiKey);
        default:
          throw Error("Selected chat engine is not supported");
      }
    },
    [
      otoverseGetChatResponseStream,
      geminiNanoGetChatResponseStream,
      openAiGetChatResponseStream,
    ]
  );

  return { load, getChatResponseStream };
};
