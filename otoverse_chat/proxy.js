// Otoverse Chat 用 Proxyサーバー（復元版）
// 役割: index.html の配信 / Gemini へのチャット中継 / AivisSpeech への音声合成中継
// Node.js 18以上が必要（グローバル fetch を使用します）

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
// .env の値を整える（前後の空白・引用符を除去。モデル名は最初の単語だけ使う）
const cleanEnv = (v) => String(v || '').trim().replace(/^["']|["']$/g, '').trim();
const GOOGLE_API_KEY = cleanEnv(process.env.GOOGLE_API_KEY);
const GOOGLE_MODEL = (cleanEnv(process.env.GOOGLE_MODEL).split(/\s+/)[0] || 'gemini-2.5-flash').replace(/^models\//, '');
const AIVIS_ENGINE_URL = (process.env.AIVIS_ENGINE_URL || 'http://localhost:10101').replace(/\/+$/, '');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ---------- チャット（Gemini ストリーミング → NDJSON） ----------
// リクエスト: { model, prompt }
// レスポンス: 1行ごとに {"response": "テキスト断片"} を返す
app.post('/api/chat', async (req, res) => {
  const { prompt, model } = req.body || {};

  if (!GOOGLE_API_KEY || /[^\x20-\x7E]/.test(GOOGLE_API_KEY)) {
    return res.status(500).send('GOOGLE_API_KEY が .env に正しく設定されていません（APIキーを半角英数字で入力してください）');
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).send('prompt が指定されていません');
  }

  // .env の GOOGLE_MODEL を優先、なければリクエストの model を使う
  const useModel = (cleanEnv(process.env.GOOGLE_MODEL) ? GOOGLE_MODEL : String(model || GOOGLE_MODEL)).replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(useModel)}:streamGenerateContent?alt=sse`;

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_API_KEY
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error(`❌ Gemini APIエラー (${upstream.status}) モデル: ${useModel}`);
      console.error(errText.slice(0, 600));
      let reason = errText.slice(0, 300);
      try { reason = JSON.parse(errText)?.error?.message || reason; } catch (e) {}
      let hint = '';
      if (/API key not valid|API_KEY_INVALID/i.test(errText)) hint = ' → .env の GOOGLE_API_KEY が無効です。キーを取得し直して貼り付けてください。';
      else if (/not found|not supported/i.test(errText)) hint = ` → モデル名「${useModel}」が使えません。.env の GOOGLE_MODEL を gemini-2.5-flash にしてください。`;
      else if (/quota|exhausted|RESOURCE_EXHAUSTED/i.test(errText)) hint = ' → 無料枠の上限です。しばらく待ってから再試行してください。';
      return res.status(upstream.status).send(`Gemini APIエラー (${upstream.status}): ${reason}${hint}`);
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleLine = (line) => {
      line = line.trim();
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const parts = json?.candidates?.[0]?.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('');
        if (text) res.write(JSON.stringify({ response: text }) + '\n');
      } catch (e) {
        console.warn('⚠ SSE解析エラー:', e.message);
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(handleLine);
    }
    if (buffer) handleLine(buffer);

    res.end();
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('❌ /api/chat エラー:', err.message);
    if (!res.headersSent) {
      res.status(500).send('サーバーエラー: ' + err.message);
    } else {
      res.end();
    }
  }
});

// ---------- 音声合成（AivisSpeech Engine / VOICEVOX互換API） ----------
// リクエスト: { text, speaker }  レスポンス: audio/wav
app.post('/api/tts', async (req, res) => {
  const { text, speaker } = req.body || {};
  if (!text || speaker === undefined || speaker === null || speaker === '') {
    return res.status(400).json({ error: 'text と speaker が必要です' });
  }

  try {
    // 1) audio_query
    const queryRes = await fetch(
      `${AIVIS_ENGINE_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${encodeURIComponent(speaker)}`,
      { method: 'POST' }
    );
    if (!queryRes.ok) {
      const details = await queryRes.text().catch(() => '');
      return res.status(502).json({ error: 'audio_query に失敗しました', details: details.slice(0, 300) });
    }
    const audioQuery = await queryRes.json();

    // 2) synthesis
    const synthRes = await fetch(
      `${AIVIS_ENGINE_URL}/synthesis?speaker=${encodeURIComponent(speaker)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audioQuery)
      }
    );
    if (!synthRes.ok) {
      const details = await synthRes.text().catch(() => '');
      return res.status(502).json({ error: 'synthesis に失敗しました', details: details.slice(0, 300) });
    }

    const wav = Buffer.from(await synthRes.arrayBuffer());
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', wav.length);
    res.send(wav);
  } catch (err) {
    console.error('❌ /api/tts エラー:', err.message);
    res.status(500).json({
      error: '音声合成サーバーに接続できません',
      details: `${err.message}（AivisSpeech が ${AIVIS_ENGINE_URL} で起動しているか確認してください）`
    });
  }
});

// ---------- 静的ファイル（index.html, img/ など） ----------
app.use(express.static(__dirname, { dotfiles: 'ignore' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 全角文字を幅2として計算して罫線の右端を揃える
const visualWidth = (str) => [...str].reduce((w, ch) => w + (ch.charCodeAt(0) > 0xff ? 2 : 1), 0);
const boxLine = (str) => '║' + str + ' '.repeat(Math.max(0, 44 - visualWidth(str))) + '║';

app.listen(PORT, () => {
  console.log('');
  console.log('╔' + '═'.repeat(44) + '╗');
  console.log(boxLine('   Otovers AI Server 起動完了'));
  console.log('╠' + '═'.repeat(44) + '╣');
  console.log(boxLine(`  URL: http://localhost:${PORT}`));
  console.log(boxLine(`  チャット: http://localhost:${PORT}/index.html`));
  console.log('╚' + '═'.repeat(44) + '╝');
  console.log('');
  console.log(`💡 ブラウザで http://localhost:${PORT}/index.html を開いてください`);
  console.log(`   モデル: ${GOOGLE_MODEL} / 音声: ${AIVIS_ENGINE_URL}`);
  if (!GOOGLE_API_KEY) console.warn('⚠ GOOGLE_API_KEY が未設定です。.env を確認してください。');
});
