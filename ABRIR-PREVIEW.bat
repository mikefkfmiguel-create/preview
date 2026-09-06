@echo off
rem ---------------------------------------------------------------------------
rem  Preview -- Mike Apps
rem
rem  Abre a app a partir desta pasta, sem servidor e sem internet.
rem
rem  Porque e que isto existe em vez de "dois cliques no index.html":
rem
rem  1. A app e feita de modulos de JavaScript, e nenhum browser os deixa
rem     carregar a partir de file:// -- fica um ecra preto sem dizer porque.
rem     O Chrome levanta essa restricao com --allow-file-access-from-files.
rem  2. Se o Chrome ja estiver aberto, mandar-lhe abrir uma pagina com bandeiras
rem     novas nao serve de nada: ele reaproveita o processo que ja la esta e
rem     ignora-as. Dai o --user-data-dir proprio, que forca um processo novo.
rem  3. O --app= abre em janela limpa, sem separadores nem barra de endereco --
rem     que e como isto se mostra a alguem.
rem ---------------------------------------------------------------------------

setlocal
set "PASTA=%~dp0"
set "PAGINA=file:///%PASTA:\=/%index.html"
set "PERFIL=%TEMP%\preview-mikeapps"

set "NAVEGADOR="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if not defined NAVEGADOR if exist %%P set "NAVEGADOR=%%~P"

if not defined NAVEGADOR (
  for %%P in (
    "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
    "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  ) do if not defined NAVEGADOR if exist %%P set "NAVEGADOR=%%~P"
)

if not defined NAVEGADOR (
  echo.
  echo  Nao encontrei o Chrome nem o Edge nesta maquina.
  echo.
  echo  Esta app precisa de um deles para correr a partir de uma pasta.
  echo  Em alternativa, abre-a online:
  echo.
  echo     https://mikefkfmiguel-create.github.io/preview/
  echo.
  pause
  exit /b 1
)

start "" "%NAVEGADOR%" --allow-file-access-from-files --user-data-dir="%PERFIL%" --app="%PAGINA%"
exit /b 0
