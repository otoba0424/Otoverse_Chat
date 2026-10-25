<img width="1920" height="1080" alt="Image" src="https://github.com/user-attachments/assets/86bb4691-8030-4250-aa8e-248d974757d2" />

# Otoverse Chat

AI のキャラクターと、チャットと声で会話するブラウザアプリです。

現在の「Otoverse」が発案される前に作られた試作で、**採用されなかったアイデア（没案）** です。
記録として残し、動かせる状態に復元したものを公開しています。

- 会話：Google Gemini API
- 音声：AivisSpeech Engine
- 3D 表示（没入モード）：ChatVRM をもとにした `otoverse-chat-vrm`

---

## できること

- 2 人のキャラクター（**音葉 万夏**・**旭川 エレナ**）と会話できる
- キャラクターごとに会話履歴を別々に保存する（ブラウザの localStorage）
- 返事を AivisSpeech の声で読み上げる
- 「🎭 没入」ボタンで、3D のキャラクターと向き合って話す画面（ChatVRM）に切り替える

> 没入モードについて：キャラクターと「同じ場所にいる感覚」を目指して付けたボタンです。
> 今回の公開では、ChatVRM を組み込んでキャラクターを表示するところまでに留めています。

---

## 構成

```
otoverse_chat/
├─ index.html           チャット画面（フロントエンド）
├─ proxy.js             Gemini と AivisSpeech をつなぐ中継サーバー
├─ package.json
├─ Run.bat              Windows 用の起動スクリプト
├─ .env                 APIキーなどの設定（自分で作成・公開しない）
├─ img/                 アイコン・ロゴ・キャラクター画像
└─ otoverse-chat-vrm/   没入モード用の ChatVRM（別プロセスで動く）
   └─ RunVRM.bat
```

| 役割 | ポート | 起動 |
| --- | --- | --- |
| チャット画面 + proxy | 3000 | `Run.bat` |
| ChatVRM（没入モード） | 5173 | `otoverse-chat-vrm/RunVRM.bat` |
| AivisSpeech Engine | 10101 | AivisSpeech を起動 |

proxy.js が窓口になり、ブラウザから Gemini の API キーが見えないようにしています。

---

## 必要なもの

- [Node.js](https://nodejs.org/) 18 以上
- [Google AI Studio](https://aistudio.google.com/) の API キー（Gemini）
- [AivisSpeech](https://aivis-project.com/)（声が必要な場合）
- Chrome 系ブラウザ（音声入力に使う）

---

## セットアップ

### 1. `.env` を作る

`index.html` と同じフォルダに `.env` を作り、次のように書きます。

```env
GOOGLE_API_KEY=ここにAPIキー
GOOGLE_MODEL=gemini-2.5-flash
AIVIS_ENGINE_URL=http://localhost:10101
PORT=3000
```

- 各行に、コメントや説明を書き足さないでください（値として読み込まれてしまい、エラーになります）
- `.env` は GitHub に上げません（`.gitignore` に入れてください）

### 2. サーバーを起動する

Windows：`Run.bat` をダブルクリックします。初回は必要なパッケージが自動で入ります。

それ以外の環境：

```bash
npm install
npm start
```

### 3. 開く

AivisSpeech を起動してから、ブラウザで次を開きます。

```
http://localhost:3000/
```

### 4. 没入モード（任意）

1. `otoverse-chat-vrm/RunVRM.bat` を実行する（初回は数分かかります）
2. チャット画面の「🎭 没入」を押す

ChatVRM だけで試すなら `http://localhost:5173/` を開きます。
`?character=elena` を付けると、エレナで始まります。

詳しくは [`otoverse-chat-vrm/README_OTOVERSE.md`](otoverse-chat-vrm/README_OTOVERSE.md) を見てください。

---

## 画像（`img/`）

画面で使う画像は `img/` に置きます。無くても動きますが、アイコンは表示されません。

| ファイル | 用途 |
| --- | --- |
| `logo.png` / `load.gif` | ロゴ・読み込み表示 |
| `apple-touch-icon.png` | アイコン |
| `manatu_avatar.png` / `manatu_placeholder.png` | 万夏 |
| `elena_avatar.png` / `elena_placeholder.png` | エレナ |
| `user_avatar.png` | ユーザー |

---

## キャラクターと声

| キャラクター | 紹介 |
| --- | --- |
| 音葉 万夏（おとば まなつ） | 16 歳。ゲームと漫画が好き |
| 旭川 エレナ（あさひかわ えれな） | 17 歳。敬語で話す、恥ずかしがり屋 |

声は AivisSpeech の話者 ID で決まります。変える場合は `index.html` の `speakerId` を書き換えます。
話者 ID は `http://127.0.0.1:10101/speakers` で確認できます。

---

## うまく動かないとき

| 症状 | 確認すること |
| --- | --- |
| `Could not read package.json` | `package.json` が `proxy.js` と同じフォルダにあるか |
| Gemini のエラー（400 など） | `.env` の `GOOGLE_API_KEY` が半角の正しいキーか、各行の後ろに余計な文字が無いか。`GOOGLE_MODEL` が存在するモデル名か |
| 声が出ない | AivisSpeech が起動しているか。`AIVIS_ENGINE_URL` が合っているか |
| 没入モードが開かない | `RunVRM.bat` を実行したか。5173 番が他で使われていないか |
| 画像が出ない | `img/` フォルダの名前と、ファイル名が上の表と合っているか |

---

## 注意

- 個人利用の試作です。ログインや利用者の管理の仕組みはありません。**外部に公開して、不特定の人に使わせる作りではありません**（誰でも proxy 経由で、あなたの API キーを使えてしまいます）
- API キーを含む `.env` は、絶対に公開しないでください
- Gemini API の利用には、Google の料金と利用規約が適用されます

---

## クレジット

- 企画・制作：おとば！
- 3D 表示：[ChatVRM](https://github.com/pixiv/ChatVRM)（pixiv Inc., MIT License）、およびそのローカル版 LocalChatVRM
- 音声合成：[AivisSpeech](https://aivis-project.com/)
- 会話生成：Google Gemini API

## ライセンス

このリポジトリは、中身によってライセンスが分かれています。

| 対象 | ライセンス |
| --- | --- |
| ソースコード（`proxy.js`、`index.html` の処理、`Run.bat` など） | [MIT License](LICENSE) |
| キャラクター・画像（`img/`）・設定・名称 | [All rights reserved](LICENSE-ASSETS.md)（無断での転載・改変・商用利用は不可） |
| `otoverse-chat-vrm/` | pixiv Inc. の ChatVRM（MIT License）。[`LICENSE`](otoverse-chat-vrm/LICENSE) を参照 |
| `AvatarSample_B.vrm` | pixiv の VRoid Project によるサンプルモデル。モデルの利用条件に従う |

> GitHub のリポジトリ上部には「MIT」と表示されますが、キャラクターと画像は MIT の対象外です。
> 詳しくは [`LICENSE-ASSETS.md`](LICENSE-ASSETS.md) を読んでください。
