#!/bin/bash
# ---------------------------------------------------------------------------
#  Preview -- Mike Apps  (macOS)
#
#  Abre a app a partir desta pasta, sem servidor e sem internet.
#
#  A app e feita de modulos de JavaScript, e nenhum browser os deixa carregar a
#  partir de file:// -- fica um ecra preto sem dizer porque. O Chrome levanta
#  essa restricao com --allow-file-access-from-files, e o --user-data-dir
#  proprio garante um processo novo: se o Chrome ja estiver aberto, ele
#  reaproveita o que la esta e ignora as bandeiras.
#
#  Se der "permission denied": chmod +x ABRIR-PREVIEW.command
# ---------------------------------------------------------------------------

PASTA="$(cd "$(dirname "$0")" && pwd)"
PAGINA="file://$PASTA/index.html"
PERFIL="${TMPDIR:-/tmp}/preview-mikeapps"

for APP in "Google Chrome" "Microsoft Edge" "Chromium" "Brave Browser"; do
  if [ -d "/Applications/$APP.app" ] || [ -d "$HOME/Applications/$APP.app" ]; then
    open -na "$APP" --args \
      --allow-file-access-from-files \
      --user-data-dir="$PERFIL" \
      --app="$PAGINA"
    exit 0
  fi
done

echo
echo "  Nao encontrei o Chrome nem o Edge nesta maquina."
echo
echo "  Esta app precisa de um deles para correr a partir de uma pasta."
echo "  Em alternativa, abre-a online:"
echo
echo "     https://mikefkfmiguel-create.github.io/preview/"
echo
read -r -p "  Enter para fechar." _
exit 1
