@echo off
chcp 65001 > nul
cd /d "%~dp0"
title Otoverse Chat Server

where node > nul 2>&1
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org/ からインストールしてください。
  pause
  exit /b 1
)

if not exist "proxy.js" (
  echo proxy.js が見つかりません。Run.bat と同じフォルダに置いてください。
  pause
  exit /b 1
)

if not exist ".env" (
  echo .env ファイルがありません。APIキーを書いた .env を作成してください。
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo 初回セットアップ: パッケージをインストールします...
  call npm install express cors dotenv
  if errorlevel 1 (
    echo インストールに失敗しました。
    pause
    exit /b 1
  )
)

node proxy.js
pause
