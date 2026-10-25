# Otoverse ChatVRM（otoverse_chat 用パッチ版）

LocalChatVRM を、otoverse_chat の「没入モード」に組み込める形に直したものです。

## 使い方

1. AivisSpeech を起動する
2. otoverse_chat の `Run.bat` を実行する（proxy.js が 3000 番で起動）
3. このフォルダの `RunVRM.bat` を実行する（ChatVRM が 5173 番で起動）
4. ブラウザで `http://localhost:3000/index.html` を開き、「🎭 没入」を押す
5. ChatVRM の「Get Started」を押すと会話できる

ChatVRM を単体で試すときは `http://localhost:5173` を開きます。
（`?character=elena` を付けるとエレナで始まります）

## 変更点

- 会話: proxy.js の `/api/chat`（Gemini）を使う。APIキーは proxy.js 側の `.env` だけでよい
- 音声: proxy.js の `/api/tts`（AivisSpeech）を使う。失敗したときは字幕だけ表示
- キャラクター: 音葉 万夏 / エレナ（`src/features/constants/characters.ts`）
  - 人格設定と会話履歴はキャラごとに別保存
  - 設定画面（左上のメニュー）で切り替え。没入ボタンからはチャット側と同じキャラで開く
- 音声入力: ブラウザの音声認識（日本語）に変更
- ポートを 5173 に固定

## 3D アバターについて

音葉 万夏・エレナの 3D アバターは同梱していません。
表示されるのは、ChatVRM に付属の VRoid Project のサンプルモデル（`public/AvatarSample_B.vrm`）です。
自分の `.vrm` を使うときは、画面にドラッグ＆ドロップするか、設定メニューから読み込みます
（ページを開き直すと、サンプルに戻ります）。

## 設定

proxy.js を別のポートで動かすときは、`.env.example` を `.env` にコピーして
`VITE_OTOVERSE_PROXY_URL` を書き換えます。