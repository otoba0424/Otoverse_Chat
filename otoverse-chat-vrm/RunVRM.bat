@echo off
chcp 65001 > nul
cd /d "%~dp0"
title Otoverse ChatVRM

where node > nul 2>&1
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org/ からインストールしてください。
  pause
  exit /b 1
)

if not exist "node_modules\vite" (
  echo 初回セットアップ: パッケージをインストールします（数分かかります）...
  call npm install
  if errorlevel 1 (
    echo インストールに失敗しました。
    pause
    exit /b 1
  )
)

echo.
echo ChatVRM を起動します。 http://localhost:5173
echo （チャット側の「没入」ボタンから開くので、このウィンドウは開いたままにしてください）
echo.
call npm run dev
pause
