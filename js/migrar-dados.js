/**
 * TRAZER OS DADOS DO ENDEREÇO ANTIGO.
 *
 * O AV Planner e o Preview 3D passaram do endereço do GitHub Pages para
 * https://avplanner.mike-app.com. O navegador guarda o localStorage POR
 * ENDEREÇO, por isso quem já tinha o inventário, os modelos, o histórico ou um
 * projeto no endereço antigo abre o novo e encontra tudo vazio. Este ficheiro
 * mostra, só no endereço novo, uma faixa com um botão que abre a página
 * migrar.html do endereço antigo (que responde com os dados por postMessage).
 *
 * Regras de segurança:
 *   - só se responde ao endereço antigo (origem exacta) e só se envia para o
 *     endereço novo (origem exacta, ver migrar.html);
 *   - só entram chaves com os prefixos desta app;
 *   - nunca se escreve por cima de uma chave que já existe no endereço novo.
 *
 * Existe uma cópia igual em preview/js/migrar-dados.js: o Preview também é uma
 * porta de entrada. Alterar numa, alterar na outra.
 */
(function () {
  "use strict";

  var NOVO = "https://avplanner.mike-app.com";
  var ANTIGO = "https://mikefkfmiguel-create.github.io";
  var PAGINA_ANTIGA = ANTIGO + "/calculadores/migrar.html";
  var PREFIXOS = ["mikeapps-", "calculadores-", "calc-", "preview-"];
  var ESTADO = "mikeapps-migracao-v1"; // "feita" | "dispensada"

  if (location.origin !== NOVO) return;
  // Um link de ver (#p=… / #proj=…) é alguém a abrir um projeto que lhe mandaram:
  // não é altura de lhe falar de migrações.
  if (/^#(p|proj)=/.test(location.hash)) return;

  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function escrever(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  if (ler(ESTADO)) return;

  var en = ler("calc-lang") === "en";
  function T(pt, ing) { return en ? ing : pt; }
  function nossa(k) {
    for (var i = 0; i < PREFIXOS.length; i++) if (k.indexOf(PREFIXOS[i]) === 0) return true;
    return false;
  }

  var faixa, texto, botao, nao;

  function desenhar() {
    faixa = document.createElement("div");
    faixa.setAttribute("role", "status");
    faixa.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;" +
      "flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:center;padding:10px 14px;" +
      "background:#141B21;color:#E7ECF2;border-top:1px solid #2E7BFF;font:14px/1.4 system-ui,sans-serif";
    texto = document.createElement("span");
    texto.textContent = T(
      "Já usavas o AV Planner no endereço antigo? Podes trazer para aqui o teu inventário, modelos e projetos.",
      "Did you use AV Planner at the old address? You can bring your inventory, models and projects here.");
    botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = T("Trazer os meus dados", "Bring my data");
    botao.style.cssText = "background:#2E7BFF;color:#fff;border:0;border-radius:6px;padding:7px 12px;font:inherit;cursor:pointer";
    nao = document.createElement("button");
    nao.type = "button";
    nao.textContent = T("Não preciso", "No need");
    nao.style.cssText = "background:none;color:#8A97A6;border:1px solid #232D36;border-radius:6px;padding:7px 12px;font:inherit;cursor:pointer";
    faixa.appendChild(texto); faixa.appendChild(botao); faixa.appendChild(nao);
    document.body.appendChild(faixa);
    botao.addEventListener("click", trazer);
    nao.addEventListener("click", function () { escrever(ESTADO, "dispensada"); faixa.remove(); });
  }

  var janela = null;
  function trazer() {
    window.addEventListener("message", aoReceber);
    janela = window.open(PAGINA_ANTIGA + "?para=" + encodeURIComponent(NOVO), "mikeapps-migracao", "width=480,height=360");
    if (!janela) {
      texto.textContent = T("O navegador bloqueou a janela. Permite janelas para este endereço e tenta outra vez.",
        "The browser blocked the window. Allow pop-ups for this address and try again.");
    }
  }

  function aoReceber(e) {
    if (e.origin !== ANTIGO || !e.data || e.data.tipo !== "mikeapps-migracao" || !e.data.dados) return;
    window.removeEventListener("message", aoReceber);
    var dados = e.data.dados, novas = 0, jaTinha = 0;
    Object.keys(dados).forEach(function (k) {
      if (!nossa(k) || k === ESTADO || typeof dados[k] !== "string") return;
      if (ler(k) !== null) { jaTinha++; return; }
      if (escrever(k, dados[k])) novas++;
    });
    escrever(ESTADO, "feita");
    botao.remove(); nao.remove();
    texto.textContent = novas
      ? T("Trouxe " + novas + " itens do endereço antigo. A recarregar…", "Brought " + novas + " items from the old address. Reloading…")
      : T("Não havia nada de novo para trazer" + (jaTinha ? " (já tens esses dados aqui)." : "."),
          "Nothing new to bring" + (jaTinha ? " (you already have that data here)." : "."));
    if (novas) setTimeout(function () { location.reload(); }, 1200);
    else setTimeout(function () { faixa.remove(); }, 4000);
  }

  if (document.body) desenhar(); else document.addEventListener("DOMContentLoaded", desenhar);
})();
