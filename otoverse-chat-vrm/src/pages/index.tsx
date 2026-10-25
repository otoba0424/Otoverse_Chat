import { useCallback, useContext, useEffect, useState } from "react";
import VrmViewer from "@/components/vrmViewer";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import {
  Message,
  textsToScreenplay,
  DEFAULT_VOICE_ENGINE,
  Screenplay,
} from "@/features/messages/messages";
import { speakCharacter } from "@/features/messages/speakCharacter";
import { MessageInputContainer } from "@/components/messageInputContainer";
import {
  CHARACTERS,
  CharacterKey,
  buildSystemPrompt,
  resolveInitialCharacterKey,
  saveCharacterKey,
} from "@/features/constants/characters";
import { checkProxy } from "@/features/chat/otoverseApi";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { Introduction } from "@/components/introduction";
import { Menu } from "@/components/menu";
import { GitHubLink } from "@/components/githubLink";
import { Meta } from "@/components/meta";
import { DEFAULT_CHAT_ENGINE, useChat } from "@/features/chat/chat";
import {
  DEFAULT_TRANSCRIPTION_ENGINE,
  useTranscription,
} from "@/features/transcription/transcription";

type SavedState = {
  systemPrompt?: string;
  chatLog?: Message[];
};

// キャラクターごとに、人格設定と会話履歴を別々に保存する
const storageKey = (key: CharacterKey) => `otoverseVrm_${key}`;

const loadSavedState = (key: CharacterKey): SavedState => {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    return raw ? (JSON.parse(raw) as SavedState) : {};
  } catch {
    return {};
  }
};

export default function Home() {
  const { viewer } = useContext(ViewerContext);

  const [loadingRequired, setLoadingRequired] = useState(true);
  const [transcriptionEngine] = useState(DEFAULT_TRANSCRIPTION_ENGINE);
  const [chatEngine] = useState(DEFAULT_CHAT_ENGINE);
  const [voiceEngine] = useState(DEFAULT_VOICE_ENGINE);
  const [characterKey, setCharacterKey] = useState<CharacterKey>(
    resolveInitialCharacterKey
  );
  const [systemPrompt, setSystemPrompt] = useState(
    () => loadSavedState(characterKey).systemPrompt ?? buildSystemPrompt(characterKey)
  );
  const [openAiKey, setOpenAiKey] = useState("");
  const [koeiromapKey, setKoeiromapKey] = useState("");
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>(
    () => loadSavedState(characterKey).chatLog ?? []
  );
  const [assistantMessage, setAssistantMessage] = useState("");

  const character = CHARACTERS[characterKey];

  const { load: loadChatModel, getChatResponseStream } = useChat();
  const {
    load: loadTranscriptionModel,
    transcribe,
    stopTranscribing,
  } = useTranscription();

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey(characterKey),
        JSON.stringify({ systemPrompt, chatLog })
      );
    } catch {
      // 保存できなくても動作には影響しない
    }
  }, [characterKey, systemPrompt, chatLog]);

  const handleChangeCharacter = useCallback(
    (newKey: CharacterKey) => {
      if (newKey === characterKey) {
        return;
      }
      const saved = loadSavedState(newKey);
      saveCharacterKey(newKey);
      setCharacterKey(newKey);
      setSystemPrompt(saved.systemPrompt ?? buildSystemPrompt(newKey));
      setChatLog(saved.chatLog ?? []);
      setAssistantMessage("");
      setLoadingRequired(true);
    },
    [characterKey]
  );

  const handleChangeSystemPrompt = useCallback(
    async (newSystemPrompt: string) => {
      if (newSystemPrompt === systemPrompt) {
        return;
      }
      setSystemPrompt(newSystemPrompt);
      setLoadingRequired(true);
    },
    [systemPrompt]
  );

  const handleChangeOpenAiKey = useCallback((openAiKey: string) => {
    setOpenAiKey(openAiKey);
    setLoadingRequired(true);
  }, []);

  const handleChangeChatLog = useCallback(
    (targetIndex: number, text: string) => {
      const newChatLog = chatLog.map((v: Message, i) => {
        return i === targetIndex ? { role: v.role, content: text } : v;
      });

      setChatLog(newChatLog);
    },
    [chatLog]
  );

  const handleResetChatLog = useCallback(async () => {
    setChatLog([]);
    setLoadingRequired(true);
  }, []);

  const handleLoading = useCallback(async () => {
    if (!loadingRequired) {
      return;
    }

    await Promise.all([
      loadTranscriptionModel(transcriptionEngine),
      loadChatModel(chatEngine, systemPrompt, character.name),
      speakCharacter.load(voiceEngine),
    ]);
    if (chatEngine === "Otoverse (Gemini)" && !(await checkProxy())) {
      setAssistantMessage(
        "proxy.js に接続できません。Run.bat でチャットサーバーを起動してください。"
      );
    }
    setLoadingRequired(false);
  }, [
    chatEngine,
    voiceEngine,
    loadChatModel,
    loadingRequired,
    loadTranscriptionModel,
    systemPrompt,
    transcriptionEngine,
    character.name,
  ]);

  /**
   * 文ごとに音声を直列でリクエストしながら再生する
   */
  const handleSpeakAi = useCallback(
    async (
      screenplay: Screenplay,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      speakCharacter.speak(screenplay, viewer, koeiromapKey, onStart, onEnd);
    },
    [viewer, koeiromapKey]
  );

  const handleStopTranscribing = useCallback(() => {
    stopTranscribing();
    setChatProcessing(true);
  }, [stopTranscribing]);

  /**
   * アシスタントとの会話を行う
   */
  const handleSendChat = useCallback(
    async (text: string) => {
      setChatProcessing(true);

      if (chatEngine === "OpenAI" && !openAiKey) {
        setAssistantMessage("APIキーが入力されていません");
        setChatProcessing(false);
        return;
      }

      if (text === "") {
        setChatProcessing(false);
        return;
      }

      // ユーザーの発言を追加して表示
      const messageLog: Message[] = [
        ...chatLog,
        { role: "user", content: text },
      ];
      setChatLog(messageLog);

      const stream = await getChatResponseStream(
        chatEngine,
        messageLog,
        openAiKey
      ).catch((e) => {
        console.error(e);
        setAssistantMessage(
          `エラー: ${e instanceof Error ? e.message : String(e)}`
        );
        return null;
      });
      if (stream == null) {
        setChatProcessing(false);
        return;
      }

      const reader = stream.getReader();
      let receivedMessage = "";
      let aiTextLog = "";
      let tag = "";
      const sentences = new Array<string>();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          receivedMessage += value;

          while (receivedMessage) {
            // 返答内容のタグ部分の検出
            const tagMatch = receivedMessage.match(/^\[(.*?)\]/);
            if (tagMatch && tagMatch[0]) {
              tag = tagMatch[0];
              receivedMessage = receivedMessage.slice(tag.length);
            }

            // 返答を一文単位で切り出して処理する
            const sentenceMatch = receivedMessage.match(
              /^(.+[。．！？.!?\n]|.{10,}[、,])/
            );
            if (!sentenceMatch || !sentenceMatch[0]) {
              break;
            }

            const sentence = sentenceMatch[0];
            sentences.push(sentence);
            receivedMessage = receivedMessage
              .slice(sentence.length)
              .trimStart();

            // 発話不要/不可能な文字列だった場合はスキップ
            if (
              !sentence.replace(
                /^[\s[({「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」})\]]+$/g,
                ""
              )
            ) {
              continue;
            }

            const aiText = `${tag} ${sentence}`;
            const aiTalks = textsToScreenplay(
              voiceEngine,
              [aiText],
              koeiroParam,
              character.speakerId
            );
            aiTextLog += aiText;

            // 文ごとに音声を生成 & 再生、返答を表示
            const currentAssistantMessage = sentences.join(" ");
            handleSpeakAi(aiTalks[0], () => {
              setAssistantMessage(currentAssistantMessage);
            });
          }
        }
      } catch (e) {
        setChatProcessing(false);
        console.error(e);
        setAssistantMessage(
          `エラー: ${e instanceof Error ? e.message : String(e)}`
        );
      } finally {
        reader.releaseLock();
      }

      // アシスタントの返答をログに追加
      const messageLogAssistant: Message[] = [
        ...messageLog,
        { role: "assistant", content: aiTextLog },
      ];

      setChatLog(messageLogAssistant);
      setChatProcessing(false);
    },
    [
      openAiKey,
      chatLog,
      getChatResponseStream,
      chatEngine,
      voiceEngine,
      koeiroParam,
      handleSpeakAi,
      character.speakerId,
    ]
  );

  return (
    <div className={"font-M_PLUS_2"}>
      <Meta />
      <Introduction
        chatEngine={chatEngine}
        openAiKey={openAiKey}
        voiceEngine={voiceEngine}
        koeiroMapKey={koeiromapKey}
        onChangeAiKey={handleChangeOpenAiKey}
        onChangeKoeiromapKey={setKoeiromapKey}
        onLoad={handleLoading}
      />
      <VrmViewer />
      <MessageInputContainer
        transcribe={transcribe}
        stopTranscribing={handleStopTranscribing}
        isChatProcessing={chatProcessing}
        onChatProcessStart={handleSendChat}
      />
      <Menu
        chatEngine={chatEngine}
        characterKey={characterKey}
        onChangeCharacter={handleChangeCharacter}
        openAiKey={openAiKey}
        systemPrompt={systemPrompt}
        chatLog={chatLog}
        koeiroParam={koeiroParam}
        assistantMessage={assistantMessage}
        voiceEngine={voiceEngine}
        koeiromapKey={koeiromapKey}
        onChangeAiKey={setOpenAiKey}
        onChangeSystemPrompt={handleChangeSystemPrompt}
        onChangeChatLog={handleChangeChatLog}
        onChangeKoeiromapParam={setKoeiroParam}
        handleClickResetChatLog={handleResetChatLog}
        handleClickResetSystemPrompt={() =>
          handleChangeSystemPrompt(buildSystemPrompt(characterKey))
        }
        onChangeKoeiromapKey={setKoeiromapKey}
        onLoad={handleLoading}
      />
      <GitHubLink />
    </div>
  );
}
