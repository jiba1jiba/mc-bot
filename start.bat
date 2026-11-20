@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Создан файл .env.
  echo Вставьте в него DISCORD_TOKEN и DISCORD_GUILD_ID, сохраните и закройте блокнот.
  echo.
  notepad .env
)

if not exist node_modules (
  echo Устанавливаю зависимости...
  call npm install
  if errorlevel 1 (
    echo.
    echo Ошибка установки. Попробуйте: cmd /c npm install
    pause
    exit /b 1
  )
)

node src/index.js
pause
