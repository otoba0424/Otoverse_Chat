// Otoverse Chat の proxy.js（Run.bat で起動するサーバー）と通信する部分
// - /api/chat : Gemini（NDJSON でストリーミング）
// - /api/tts  : AivisSpeech（wav を返す）

import { Message } from "../messages/messages";

/** proxy.js の URL。.env の VITE_OTOVERSE_PROXY_URL で変更できます */
export const PROXY_URL: string = (
  (import.meta.env as Record<string, unknown>).VITE_OTOVERSE_PROXY_URL as
    | string
    | undefined
)?.replace(/\/+$/, "") || "http://localhost:3000";

const GEMINI_MODEL = "models/gemini-2.5-flash";
const MAX_HISTORY_MESSAGES = 30;

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * index.html（チャット側）と同じ形式で、1本のプロンプト文字列を組み立てる
 */
export const buildPrompt = (
  systemPrompt: string,
  assistantName: string,
  messageLog: Message[],
  now: Date = new Date()
): string => {
  const dateTimeInfo = `現在の日時: ${now.getFullYear()}年${
    now.getMonth() + 1
  }月${now.getDate()}日 ${now.getHours()}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")} (${WEEKDAYS[now.getDay()]}曜日)`;

  const history = messageLog
    .filter((m) => m.role !== "system")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) =>
      m.role === "user"
        ? `ユーザー: ${m.content}`
        : `${assistantName}: ${m.content}`
    )
    .join("\n");

  return (
    `${systemPrompt}\n${dateTimeInfo}\n\n【会話履歴】\n${history}\n\n` +
    `上記の会話を踏まえて、ユーザーの最新メッセージに対して${assistantName}として返答してください。` +
    `必ず感情タグ（[neutral][happy][angry][sad][relaxed]）から始め、返答のみを出力してください。名前やタイムスタンプは含めないでください。`
  );
};

/**
 * proxy.js の /api/chat を呼び、返ってきた NDJSON（{"response":"..."} の行）を
 * テキスト断片のストリームに変換する
 */
export const streamChat = async (
  prompt: string,
  signal?: AbortSignal
): Promise<ReadableStream<string>> => {
  let res: Response;
  try {
    res = await fetch(`${PROXY_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: GEMINI_MODEL, prompt }),
      signal,
    });
  } catch {
    throw new Error(
      `proxy.js に接続できません（${PROXY_URL}）。Run.bat で起動しているか確認してください。`
    );
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseLine = (line: string): string => {
    if (!line.trim()) return "";
    try {
      const json = JSON.parse(line);
      return typeof json.response === "string" ? json.response : "";
    } catch {
      return "";
    }
  };

  return new ReadableStream<string>({
    async start(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const piece = parseLine(line);
            if (piece) controller.enqueue(piece);
          }
        }
        const rest = parseLine(buffer);
        if (rest) controller.enqueue(rest);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
};

/**
 * proxy.js が起動しているかを確認する
 */
export const checkProxy = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${PROXY_URL}/api/auth/status`);
    return res.ok;
  } catch {
    return false;
  }
};
