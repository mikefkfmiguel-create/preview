/**
 * O RELATÓRIO DE MONTAGEM, em página.
 *
 * Pedido directo: *"os relatórios de montagem e ajustes podem sair como
 * página como fizeste o que te pedi antes"* — a seguir à folha do WATCHOUT
 * que eu tinha feito à mão. A app já tem os números todos no ecrã; o que
 * faltava era poderem sair dali para uma folha que se imprime, se anexa a um
 * email ou se abre no telemóvel em cima da obra, sem a app e sem internet.
 *
 * Por isso a página sai **inteira num ficheiro**: o desenho vai em data URL,
 * a marca também, e o CSS vai lá dentro. Uma página que precisasse de buscar
 * seja o que for à rede era uma página que não abria no sítio onde faz mais
 * falta — a sala, antes de haver wi-fi.
 *
 * NÃO se calcula aqui nada. As tabelas de coordenadas chegam já em HTML de
 * quem as escreve no painel (tabelaDeCoordenadas(), em app.js), que por sua
 * vez lê de quem colocou os projetores. Refazer as contas aqui era pô-las em
 * dois sítios — a doença que esta app já apanhou três vezes.
 */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Uma secção só sai se tiver conteúdo — folhas com títulos vazios não servem. */
function seccao(titulo, corpo, sub) {
  if (!corpo) return "";
  return `<section>
    <h2>${esc(titulo)}${sub ? `<small>${esc(sub)}</small>` : ""}</h2>
    ${corpo}
  </section>`;
}

/** Pares "coisa: valor" — as medidas que não são tabela. */
function fichas(pares) {
  const bons = pares.filter((p) => p && p[1] != null && p[1] !== "");
  if (!bons.length) return "";
  return `<dl class="fichas">` +
    bons.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("") +
    `</dl>`;
}

const ESTILO = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #F4F6F8; color: #16202A;
    font: 14px/1.55 "Segoe UI", system-ui, -apple-system, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .folha { max-width: 900px; margin: 0 auto; background: #fff; }
  header.capa {
    background: #0E1418; color: #E7ECF2; padding: 22px 30px;
    display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  }
  header.capa img.marca { height: 38px; width: auto; }
  header.capa .titulo { flex: 1 1 220px; min-width: 0; }
  header.capa h1 { margin: 0; font-size: 21px; line-height: 1.25; font-weight: 600; word-wrap: break-word; }
  header.capa p { margin: 3px 0 0; font-size: 12px; color: #8A97A6; }
  main { padding: 6px 30px 34px; }
  section { padding: 20px 0; border-bottom: 1px solid #E3E8ED; break-inside: avoid; }
  section:last-child { border-bottom: 0; }
  h2 {
    margin: 0 0 12px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
    color: #5A6875; font-weight: 600;
  }
  h2 small { text-transform: none; letter-spacing: 0; font-size: 12px; color: #8A97A6; margin-left: 10px; font-weight: 400; }
  h3 { margin: 18px 0 8px; font-size: 13px; font-weight: 600; color: #16202A; }
  h3:first-child { margin-top: 0; }
  /* A altura tem tecto: o 3D numa janela alta (ou num portátil) dá uma imagem
     quase quadrada, e sem isto ela comia a primeira folha inteira antes de
     alguém chegar a um número. Larga fica larga; alta encolhe e centra-se. */
  .vista { max-width: 100%; max-height: 460px; width: auto; border-radius: 8px; display: block; margin: 0 auto; border: 1px solid #E3E8ED; }
  .fichas { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 0; }
  .fichas div { min-width: 110px; }
  .fichas dt { font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #7C8A97; }
  .fichas dd { margin: 1px 0 0; font-size: 15px; font-variant-numeric: tabular-nums; }
  table.coords { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.coords th, table.coords td { padding: 7px 6px; text-align: left; border-bottom: 1px solid #E3E8ED; }
  table.coords thead th {
    font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
    color: #7C8A97; font-weight: 600; white-space: nowrap;
  }
  table.coords tbody tr:last-child td { border-bottom: 0; }
  table.coords td.n { font-variant-numeric: tabular-nums; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .coords .quem { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
  .coords .bolha { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .coords-rolar { overflow-x: auto; }
  ul.lista { margin: 0; padding: 0; list-style: none; }
  ul.lista li { padding: 6px 0; border-bottom: 1px solid #EDF1F4; font-size: 13px; break-inside: avoid; }
  ul.lista li:last-child { border-bottom: 0; }
  ul.lista b { font-weight: 600; }
  ul.lista span { color: #5A6875; }
  .nota { background: #F4F7FA; border-left: 3px solid #2E7BFF; padding: 12px 14px; font-size: 12.5px; color: #3C4A57; border-radius: 0 6px 6px 0; }
  .nota b { color: #16202A; }
  footer { padding: 16px 30px 26px; font-size: 11px; color: #8A97A6; }
  @media print {
    body { background: #fff; }
    .folha { max-width: none; }
    main { padding: 0; }
    header.capa { padding: 14px 0; margin-bottom: 6px; }
    footer { padding: 10px 0 0; }
  }
  @media (max-width: 620px) {
    header.capa, main, footer { padding-left: 16px; padding-right: 16px; }
  }
`;

/**
 * A página inteira, em texto. Quem chama trata de a guardar — aqui não se
 * toca no disco nem no DOM.
 */
export function paginaDeRelatorio(d) {
  // Sem nome de projeto não se inventa um: o cabeçalho diz o que a folha é, e
  // o separador do browser também. "Montagem sem nome — montagem" era o que
  // saía de pôr o mesmo texto nos dois sítios.
  const titulo = d.nome || "Relatório de montagem";
  const tituloDaAba = d.nome ? d.nome + " — montagem" : "Relatório de montagem";

  const capa = `<header class="capa">
    ${d.logo ? `<img class="marca" src="${d.logo}" alt="Mike Apps">` : ""}
    <div class="titulo">
      <h1>${esc(titulo)}</h1>
      <p>${d.nome ? "Relatório de montagem · " : ""}${esc(d.quando)}${d.versao ? " · Preview " + esc(d.versao) : ""}</p>
    </div>
  </header>`;

  const corpo = [
    seccao("A vista", d.imagem ? `<img class="vista" src="${d.imagem}" alt="A sala como está no 3D">` : ""),
    seccao("A sala", fichas(d.sala)),
    seccao("Cúpula", (d.dome ? fichas(d.dome) : "") + (d.coordsCupula || ""),
           d.coordsCupula ? "coordenadas de montagem" : ""),
    seccao("Ecrã plano", (d.plano ? fichas(d.plano) : "") + (d.coordsPlanos || ""),
           d.coordsPlanos ? "coordenadas de montagem" : ""),
    (d.coordsCupula || d.coordsPlanos)
      ? `<section><div class="nota">${d.nota}</div></section>` : "",
    seccao("Ajustes feitos no 3D", d.ajustes && d.ajustes.length
      ? d.ajustes.map((g) => `<h3>${esc(g.titulo)}</h3><ul class="lista">` +
          g.linhas.map((l) => `<li><b>${esc(l.quem)}</b> <span>${esc(l.texto)}</span></li>`).join("") +
          `</ul>`).join("")
      : "", "o que aqui difere do que veio dos Calculadores"),
    seccao("Por montar", d.deposito && d.deposito.length
      ? `<ul class="lista">` + d.deposito.map((n) => `<li><b>${esc(n)}</b></li>`).join("") + `</ul>`
      : "", "está no depósito, ainda não entrou na sala")
  ].join("");

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tituloDaAba)}</title>
<style>${ESTILO}</style>
</head>
<body>
<div class="folha">
${capa}
<main>${corpo}</main>
<footer>Gerado pelo Mike Apps Preview${d.versao ? " " + esc(d.versao) : ""} em ${esc(d.quando)}. Medidas em metros.</footer>
</div>
</body>
</html>`;
}
