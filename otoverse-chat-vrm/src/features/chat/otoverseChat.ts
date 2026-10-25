import { useCallback, useState } from "react";
import { Message } from "../messages/messages";
import { buildPrompt, streamChat } from "./otoverseApi";

/**
 * Otoverse Chat 用のチャットエンジン
 * proxy.js 経由で Gemini と会話する（APIキーは proxy.js 側の .env にあるので、ここでは不要）
 */
export const useOtoverseChat = () => {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [assistantName, setAssistantName] = useState("キャラクター");

  const load = useCallback(
    async (systemPrompt: string, assistantName?: string) => {
      setSystemPrompt(systemPrompt);
      if (assistantName) {
        setAssistantName(assistantName);
      }
    },
    []
  );

  const getChatResponseStream = useCallback(
    async (messageLog: Message[]) => {
      const prompt = buildPrompt(systemPrompt, assistantName, messageLog);
      return await streamChat(prompt);
    },
    [systemPrompt, assistantName]
  );

  return { load, getChatResponseStream };
};
