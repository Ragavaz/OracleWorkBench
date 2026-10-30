@echo off
rem Vantage Workbench Local - double-click to start, close this window to stop.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22 or later is required. Install the LTS from https://nodejs.org and try again. & pause & exit /b 1)
start "" http://localhost:4300
node server\index.js
pause
