import { PROXY_URL } from "../chat/otoverseApi";
import { normalizeTextForTTS } from "./normalizeTextForTTS";

/**
 * proxy.js の /api/tts（AivisSpeech Engine）で音声を合成し、wav を返す
 * 失敗したときは例外を投げる（呼び出し側が握りつぶして、字幕だけ表示する）
 */
export const synthesizeAivisSpeech = async (
  text: string,
  speakerId: string
): Promise<ArrayBuffer> => {
  const normalized = normalizeTextForTTS(text);
  if (!normalized) {
    throw new Error("読み上げるテキストがありません");
  }

  const res = await fetch(`${PROXY_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: normalized, speaker: speakerId }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`音声合成に失敗しました (${res.status}) ${detail}`);
  }

  return await res.arrayBuffer();
};
