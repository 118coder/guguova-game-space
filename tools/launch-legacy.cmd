@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

set "NETFX="
for /f "tokens=3" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release 2^>nul ^| "%SystemRoot%\System32\find.exe" "Release"') do set "NETFX=%%A"
if not defined NETFX goto missing_netfx
set /a NETFX_NUM=%NETFX%
if %NETFX_NUM% LSS 528040 goto missing_netfx

set "WV=0"
if exist "WebView2Runtime\msedgewebview2.exe" set "WV=1"
if "%WV%"=="0" reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>nul && set "WV=1"
if "%WV%"=="0" reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>nul && set "WV=1"
if "%WV%"=="0" reg query "HKCU\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>nul && set "WV=1"
if "%WV%"=="0" goto missing_webview

start "" "GUGUOVA.exe"
exit /b 0

:missing_netfx
echo.
echo   GUGUOVA 游戏空间需要 .NET Framework 4.8。
echo   Windows 10 1903+ / Windows 11 通常已内置；Windows 7 SP1 / 8.1 需要安装。
echo   https://dotnet.microsoft.com/download/dotnet-framework/net48
echo.
pause
exit /b 1

:missing_webview
echo.
echo   GUGUOVA 游戏空间需要 Microsoft Edge WebView2 Runtime。
echo   Windows 10 / 11 通常已随 Edge 安装；Windows 7 / 8.1 请安装 109 版运行时。
echo   也可以把 109 固定运行时解压到本目录的 WebView2Runtime 文件夹。
echo   该文件夹需要包含 msedgewebview2.exe。
echo   https://developer.microsoft.com/microsoft-edge/webview2/
echo.
pause
exit /b 1
