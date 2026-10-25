// 音声合成に渡す前に、読み上げに向かない記号などを取り除く
// （index.html の normalizeTextForTTS と同じ方針）

const GREEK: Record<string, string> = {
  α: "アルファ", β: "ベータ", γ: "ガンマ", δ: "デルタ", ε: "イプシロン",
  ζ: "ゼータ", η: "イータ", θ: "シータ", ι: "イオタ", κ: "カッパ",
  λ: "ラムダ", μ: "ミュー", ν: "ニュー", ξ: "クサイ", ο: "オミクロン",
  π: "パイ", ρ: "ロー", σ: "シグマ", τ: "タウ", υ: "ウプシロン",
  φ: "ファイ", χ: "カイ", ψ: "プサイ", ω: "オメガ",
};

const SYMBOLS_TO_REMOVE = [
  "♪", "♡", "♥", "★", "☆", "※", "→", "←", "↑", "↓",
  "■", "□", "◆", "◇", "●", "○", "▲", "△", "▼", "▽",
];

export const normalizeTextForTTS = (text: string): string => {
  let normalized = text;

  for (const [symbol, reading] of Object.entries(GREEK)) {
    normalized = normalized.split(symbol).join(reading);
    normalized = normalized.split(symbol.toUpperCase()).join(reading);
  }
  for (const symbol of SYMBOLS_TO_REMOVE) {
    normalized = normalized.split(symbol).join("");
  }

  // (笑) などの短い括弧注釈
  normalized = normalized.replace(/[(（][^)）]{1,3}[)）]/g, "");
  // 単独の「w」「ｗ」（笑いの表記）。英単語の中の w は消さない
  normalized = normalized.replace(/(?<![A-Za-z])[wｗ]+(?![A-Za-z])/g, "");
  // *こくり* のような動作描写
  normalized = normalized.replace(/\*[^*]+\*/g, "");
  // 連続する句読点を整理
  normalized = normalized.replace(/[。！？]{2,}/g, (m) => m[0]);
  normalized = normalized.replace(/[、，,]{2,}/g, "、");
  normalized = normalized.replace(/\.{4,}/g, "...");
  normalized = normalized.replace(/…{2,}/g, "...");
  // URL
  normalized = normalized.replace(/https?:\/\/[^\s]+/g, "");
  // 空白
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
};
