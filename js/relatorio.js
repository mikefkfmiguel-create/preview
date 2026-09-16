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
 *
 * ---------------------------------------------------------------------------
 * O DESENHO VEIO DA FOLHA DA CÚPULA, com uma coisa deixada de fora de propósito
 *
 * Pedido: *"seria bom o relatório ser uma coisa assim, mas que desse para
 * abrir num qualquer browser"*, a apontar para a folha de montagem da cúpula
 * de 8,7 m. Daí as fichas de chumbo (`chip`), as tabelas em caixa própria, os
 * números em monoespaçado tabular, os achados em caixa tingida e as secções
 * separadas por uma regra.
 *
 * **O que NÃO veio: as fontes.** Aquela folha vai buscar a IBM Plex ao Google
 * Fonts. Aqui isso era estragar a única coisa que esta página tem de
 * garantir — abrir numa sala sem rede. Uma folha à espera de uma fonte que
 * nunca chega fica com tipos trocados e larguras trocadas, no sítio e no dia
 * em que ninguém tem paciência para isso. Fica a pilha do sistema, e o
 * trabalho é feito pelo tamanho, pelo peso e pelo espacejamento.
 *
 * E ganhou modo escuro, que a app já tem: quem a abre no telemóvel dentro de
 * uma sala às escuras não leva com uma página branca na cara. Ao imprimir,
 * volta sempre ao claro — tinta preta em papel branco, custe o que custar ao
 * tema do sistema.
 */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Uma secção só sai se tiver conteúdo — folhas com títulos vazios não servem. */
function seccao(titulo, corpo, sub) {
  if (!corpo) return "";
  return `<hr class="regra">
  <section>
    ${sub ? `<p class="eyebrow">${esc(sub)}</p>` : ""}
    <h2>${esc(titulo)}</h2>
    ${corpo}
  </section>`;
}

/**
 * As fichas de chumbo do cabeçalho: o projeto inteiro numa linha, para quem
 * abre a folha no telemóvel e quer só confirmar que é esta a sala.
 */
function fita(pares) {
  const bons = (pares || []).filter((p) => p && p[1] != null && p[1] !== "");
  if (!bons.length) return "";
  // Uma ficha de chumbo é para uma MEDIDA, não para uma frase. O "Público"
  // tanto vem "240 lugares" como "Sem público no desenho." -- e a segunda,
  // metida numa ficha, dá uma etiqueta do tamanho da linha toda. As frases
  // descem para debaixo da fita, onde cabem.
  // O que distingue uma frase de uma medida é o PONTO FINAL, não o comprimento:
  // "8,00 × 4,00 m, 0,80 m de alto" é uma medida e cabe numa ficha; "Sem público
  // no desenho." é uma frase e não cabe. O tecto de 40 fica só para o caso de
  // algum campo crescer sem se dar por isso.
  const eFrase = (v) => String(v).length > 40 || /\.$/.test(String(v));
  const curtos = bons.filter(([, v]) => !eFrase(v));
  const frases = bons.filter(([, v]) => eFrase(v));
  return (curtos.length
      ? `<div class="fita">` +
        curtos.map(([k, v]) => `<span class="chip"><span>${esc(k)}</span> ${esc(v)}</span>`).join("") +
        `</div>`
      : "") +
    frases.map(([k, v]) => `<p class="fita-nota"><b>${esc(k)}:</b> ${esc(v)}</p>`).join("");
}

/** Pares "coisa: valor" — as medidas que não são tabela. */
function fichas(pares) {
  const bons = (pares || []).filter((p) => p && p[1] != null && p[1] !== "");
  if (!bons.length) return "";
  return `<dl class="campos">` +
    bons.map(([k, v]) => `<div class="campo"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("") +
    `</dl>`;
}

const n1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
const n2 = (v) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");

/**
 * A PLANTA E O CORTE, desenhados dos MESMOS pontos que enchem a tabela.
 *
 * Pedido: *"não tem o desenho e a explicação de o que é no 3D e o que é no
 * WATCHOUT"*. Uma folha de montagem com vinte números e nenhuma figura
 * obriga quem a lê a montar a cúpula na cabeça antes de a montar na sala.
 *
 * Nada aqui é inventado nem recalculado: as posições e os alvos são os que o
 * 3D colocou, os mesmos que vão na tabela ao lado. Um desenho a discordar de
 * um número na mesma folha seria pior do que não haver desenho nenhum.
 *
 * SVG e não imagem: fica nítido impresso, pesa uns kilobytes, e segue as cores
 * do tema — a folha tem modo escuro.
 */
function plantaDaCupula(d) {
  if (!d || !(d.raioBase > 0) || !d.projetores.length) return "";
  const L = 320, meio = L / 2;
  // Tudo cabe: a maior distância ao eixo manda na escala, porque um anel de
  // montagem pode ser MAIOR do que a cúpula (tela translúcida, geodésica com
  // estrutura por fora) e cortá-lo era desenhar uma montagem que não é a dele.
  const maior = d.projetores.reduce(
    (m, p) => Math.max(m, Math.hypot(p.x, p.z), Math.hypot(p.alvoX, p.alvoZ)), d.raioBase);
  const k = (meio - 34) / maior;
  const px = (v) => meio + v * k;
  // O z do 3D cresce para a frente; num papel, "para a frente" é para baixo.
  const pz = (v) => meio + v * k;

  const tiros = d.projetores.map((p) => `<line x1="${px(p.x).toFixed(1)}" y1="${pz(p.z).toFixed(1)}" ` +
    `x2="${px(p.alvoX).toFixed(1)}" y2="${pz(p.alvoZ).toFixed(1)}" class="d-feixe" stroke="${p.cor}"/>`).join("");
  const pontos = d.projetores.map((p) => {
    const x = px(p.x), y = pz(p.z);
    const fora = 1 + 13 / Math.max(0.001, Math.hypot(x - meio, y - meio));
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${p.cor}"/>` +
      `<text x="${(meio + (x - meio) * fora).toFixed(1)}" y="${(meio + (y - meio) * fora + 3.5).toFixed(1)}" ` +
      `class="d-txt-f" text-anchor="middle">${esc(p.nome)}</text>`;
  }).join("");
  const anel = Math.hypot(d.projetores[0].x, d.projetores[0].z);

  return `<figure class="desenho">
    <svg viewBox="0 0 ${L} ${L}" role="img" aria-label="Planta da cúpula com os projetores e as linhas de tiro">
      <circle cx="${meio}" cy="${meio}" r="${(d.raioBase * k).toFixed(1)}" class="d-casca"/>
      ${anel > 0 ? `<circle cx="${meio}" cy="${meio}" r="${(anel * k).toFixed(1)}" class="d-eixo"/>` : ""}
      <line x1="${meio}" y1="18" x2="${meio}" y2="${L - 18}" class="d-eixo"/>
      <line x1="18" y1="${meio}" x2="${L - 18}" y2="${meio}" class="d-eixo"/>
      ${tiros}${pontos}
      <text x="${meio}" y="${L - 5}" class="d-txt" text-anchor="middle">+x para a direita · +z para a frente</text>
    </svg>
    <figcaption>Planta, vista de cima. Cúpula de <b>${n2(d.diametro)} m</b> de base${
      anel > 0 ? `, projetores num anel de <b>${n2(anel)} m</b> de raio` : ""}. Cada linha vai da lente ao ponto que ela aponta.</figcaption>
  </figure>`;
}

function corteDaCupula(d) {
  if (!d || !(d.R > 0) || !(d.raioBase > 0)) return "";
  const W = 340, H = 250, chao = H - 52, meio = W / 2;
  const k = (W / 2 - 26) / d.raioBase;
  const px = (v) => meio + v * k;
  const py = (v) => chao - v * k;

  // O perfil da cúpula: o arco da esfera, da base esquerda à base direita.
  const arco = `M ${px(-d.raioBase).toFixed(1)} ${py(0).toFixed(1)} ` +
    `A ${(d.R * k).toFixed(1)} ${(d.R * k).toFixed(1)} 0 0 1 ${px(d.raioBase).toFixed(1)} ${py(0).toFixed(1)}`;

  // Um projetor, o que está mais à direita, para o corte mostrar a mira.
  const p = d.projetores.slice().sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z))[0];
  const raioP = p ? Math.hypot(p.x, p.z) : 0;
  const raioA = p ? Math.hypot(p.alvoX, p.alvoZ) : 0;
  const mira = p ? `<line x1="${px(raioP).toFixed(1)}" y1="${py(p.y).toFixed(1)}" ` +
    `x2="${px(-raioA).toFixed(1)}" y2="${py(p.alvoY).toFixed(1)}" class="d-feixe" stroke="${p.cor}"/>` +
    `<circle cx="${px(raioP).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="4.5" fill="${p.cor}"/>` : "";

  return `<figure class="desenho">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Corte da cúpula com a altura das lentes e a mira">
      ${d.yBase > 0 ? `<line x1="${px(-d.raioBase).toFixed(1)}" y1="${py(d.yBase).toFixed(1)}" x2="${px(d.raioBase).toFixed(1)}" y2="${py(d.yBase).toFixed(1)}" class="d-eixo"/>` : ""}
      <path d="${arco}" class="d-casca"/>
      <line x1="14" y1="${py(0).toFixed(1)}" x2="${W - 14}" y2="${py(0).toFixed(1)}" class="d-chao"/>
      <line x1="${meio}" y1="${py(0).toFixed(1)}" x2="${meio}" y2="${py(d.altura).toFixed(1)}" class="d-eixo"/>
      ${mira}
      <text x="${meio}" y="${(py(d.altura) - 7).toFixed(1)}" class="d-txt" text-anchor="middle">zénite · ${n2(d.altura)} m</text>
      ${d.yBase > 0 ? `<text x="${(px(-d.raioBase) + 4).toFixed(1)}" y="${(py(d.yBase) - 5).toFixed(1)}" class="d-txt">imagem começa · ${n2(d.yBase)} m</text>` : ""}
      ${p ? `<text x="${(px(raioP) - 7).toFixed(1)}" y="${(py(p.y) - 8).toFixed(1)}" class="d-txt-f" text-anchor="end">lente ${n2(p.y)} m · ${Math.round(p.inclinacao)}°</text>` : ""}
      <text x="${meio}" y="${H - 8}" class="d-txt" text-anchor="middle">chão · base ${n2(d.diametro)} m</text>
    </svg>
    <figcaption>Corte. Um projetor de cove não põe imagem abaixo do seu próprio plano — ${
      d.yBase > 0 ? `é por isso que a imagem só começa a <b>${n2(d.yBase)} m</b>, que é a altura a que as lentes estão, e é aí que o <b>.obj da área de projeção corta</b>` : "com as lentes ao nível do chão, a imagem chega ao chão"}.</figcaption>
  </figure>`;
}

/**
 * O QUE É O QUÊ NO WATCHOUT.
 *
 * As colunas desta folha têm nomes desta casa; os campos do WATCHOUT têm os
 * dele. Quem monta tem de traduzir os dois, e a tradução não pode viver só na
 * cabeça de quem gerou a folha.
 *
 * A linha do Width / Distance é a que paga esta secção inteira: é o INVERSO do
 * throw ratio, e escrever lá a ficha da lente a direito dá uma imagem duas a
 * três vezes pequena de mais — visto num show a sério.
 */
function blocoWatchout(throw_) {
  const linhas = [
    ["Eye", "A coluna <b>Centro da lente</b> da tabela — não o corpo da máquina, o ponto de onde a luz sai."],
    ["Target", "A coluna <b>Aponta a</b> — para onde aponta sem lens shift."],
    ["Orientation · Roll", "<b>0</b> nos quatro. É a rotação em torno do eixo de tiro."],
    ["Lense Shift", "<b>0</b>, salvo se desnivelares os corpos. (A grafia com “e” é a do próprio programa.)"]
  ];
  const wd = (throw_ && throw_.min > 0 && throw_.max > 0)
    ? `<b>${n2(1 / throw_.max)} a ${n2(1 / throw_.min)}</b> para esta lente (throw ratio ${n2(throw_.min)}–${n2(throw_.max)}:1). `
    : "";
  linhas.push(["Width / Distance Ratio",
    wd + "É o <b>inverso</b> do throw ratio, não o throw ratio. Escrever aqui o número da ficha da lente " +
    "é dizer ao WATCHOUT que tens uma lente longa, e a imagem sai pequena de mais — é o erro mais fácil de fazer nesta página."]);

  return `<dl class="campos">` + linhas.map(([k, v]) =>
    `<div class="campo"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("") + `</dl>`;
}

const ESTILO = `
  @page { size: A4; margin: 14mm; }

  :root {
    color-scheme: light dark;
    --papel:      #F1F4F5;
    --painel:     #FFFFFF;
    --tinta:      #131A20;
    --apagado:    #5A6672;
    --linha:      #D7DEE2;
    --linha-forte:#B6C2C9;
    --realce:     #0E6F86;
    --aviso-f:    #FDF4E3;
    --aviso-t:    #8A5A00;
    --aviso-b:    #E3C384;
    --sombra: 0 1px 2px rgba(19,26,32,.06), 0 8px 24px -16px rgba(19,26,32,.25);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --papel:      #0E1418;
      --painel:     #161F26;
      --tinta:      #E6ECF0;
      --apagado:    #93A2AE;
      --linha:      #26323C;
      --linha-forte:#3A4954;
      --realce:     #7FD1FF;
      --aviso-f:    #241D10;
      --aviso-t:    #F0BC63;
      --aviso-b:    #57451F;
      --sombra: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -16px rgba(0,0,0,.8);
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--papel);
    color: var(--tinta);
    font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .folha {
    max-width: 880px; margin-inline: auto;
    padding: 40px 20px 72px;
    display: flex; flex-direction: column; gap: 32px;
  }

  h1, h2, h3 { margin: 0; text-wrap: balance; }
  h1 { font-size: clamp(26px, 5vw, 38px); font-weight: 700; letter-spacing: -.018em; line-height: 1.12; }
  h2 { font-size: 21px; font-weight: 600; letter-spacing: -.005em; }
  h3 { font-size: 15px; font-weight: 600; }
  p  { margin: 0; max-width: 66ch; }
  b, strong { font-weight: 600; }

  /* Os números em monoespaçado tabular: numa coluna de coordenadas, dígitos de
     larguras diferentes fazem a vírgula dançar, e é a vírgula que se lê. */
  .eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase;
    color: var(--apagado); margin: 0;
  }

  header.capa { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
  /* A marca que a app manda é a BRANCA (mike-marca-branco.png) — servia quando
     o cabeçalho era uma barra escura, e ficou invisível assim que a folha
     passou a nascer clara. Em vez de trocar de ficheiro (e depois precisar de
     dois, um para cada tema), vai sempre numa chapa escura: funciona em papel
     branco, em ecrã claro e em ecrã escuro, com um único ficheiro. */
  header.capa .chapa {
    background: #0E1418; border-radius: 4px; padding: 8px 12px;
    display: inline-flex; line-height: 0;
  }
  header.capa .marca { height: 22px; width: auto; display: block; }
  .fita-nota { font-size: 13.5px; color: var(--apagado); }
  .fita-nota b { color: var(--tinta); font-weight: 600; }
  .fita { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px; padding: 5px 10px; border-radius: 3px;
    background: var(--painel); border: 1px solid var(--linha); color: var(--tinta);
    white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .chip span { color: var(--apagado); }

  section { display: flex; flex-direction: column; gap: 16px; break-inside: avoid; }
  .regra { border: 0; border-top: 1px solid var(--linha); margin: 0; }

  /* A vista: altura com tecto. O 3D numa janela alta dá uma imagem quase
     quadrada, e sem isto ela comia a primeira folha inteira antes de alguém
     chegar a um número. */
  figure.vista { margin: 0; background: var(--painel); border: 1px solid var(--linha);
                 border-radius: 4px; padding: 14px; box-shadow: var(--sombra); }
  figure.vista img { display: block; width: auto; max-width: 100%; max-height: 440px; margin: 0 auto; border-radius: 2px; }
  figure.vista figcaption { font-size: 12.5px; color: var(--apagado);
                            padding-top: 10px; border-top: 1px solid var(--linha); margin-top: 12px; }

  .campos { display: grid; gap: 1px; background: var(--linha);
            border: 1px solid var(--linha); border-radius: 4px; overflow: hidden; margin: 0; }
  .campo { display: grid; grid-template-columns: minmax(0,190px) 1fr; gap: 4px 18px;
           padding: 12px 16px; background: var(--painel); align-items: baseline; }
  .campo dt { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
              font-size: 12px; font-weight: 500; color: var(--realce); }
  .campo dd { margin: 0; font-size: 14.5px; font-variant-numeric: tabular-nums; }
  @media (max-width: 560px) { .campo { grid-template-columns: 1fr; } }

  /* As tabelas chegam prontas do painel (tabelaDeCoordenadas, em app.js) — é a
     mesma função que escreve as duas, e por isso aqui só se lhes dá roupa. */
  .coords-rolar { overflow-x: auto; border: 1px solid var(--linha);
                  border-radius: 4px; background: var(--painel); }
  table.coords { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  table.coords th, table.coords td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--linha); }
  table.coords thead th {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10.5px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase;
    color: var(--apagado); border-bottom: 1px solid var(--linha-forte); white-space: nowrap;
  }
  table.coords tbody tr { break-inside: avoid; }
  table.coords tbody tr:last-child td { border-bottom: 0; }
  table.coords td.n {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .coords .quem { display: inline-flex; align-items: center; gap: 9px; white-space: nowrap; font-weight: 500; }
  .coords .bolha { width: 10px; height: 10px; border-radius: 50%; flex: none; }

  /* O que estraga uma montagem vai em caixa própria. Num bloco corrido, o
     aviso das unidades e o "sem recentrar nem reescalar" passavam despercebidos
     — e são precisamente os dois que deitam a montagem a perder. */
  /* Duas colunas e UMA linha: o sinal à esquerda, os dizeres num bloco à
     direita. Com os parágrafos soltos na grelha era preciso dizer ao sinal
     quantas linhas atravessar, e um "span" generoso de mais deixava a caixa
     com um rabo enorme de linhas vazias — visto e medido. */
  .achado {
    display: grid; grid-template-columns: auto 1fr; gap: 14px;
    padding: 18px 20px; border-radius: 4px;
    border: 1px solid var(--aviso-b); background: var(--aviso-f);
    break-inside: avoid;
  }
  .achado .marca {
    align-self: start;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px; font-weight: 600; color: var(--aviso-t);
    border: 1px solid var(--aviso-b); border-radius: 2px; padding: 1px 7px; margin-top: 3px;
  }
  .achado .dizeres { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .achado p { font-size: 14px; color: var(--tinta); max-width: 64ch; }
  .achado b { color: var(--tinta); }

  /* Os desenhos: dois quadros lado a lado em ecrã largo, um por cima do outro
     em telemóvel e em papel estreito. */
  .desenhos { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
  figure.desenho { margin: 0; background: var(--painel); border: 1px solid var(--linha);
                   border-radius: 4px; padding: 14px; break-inside: avoid; }
  figure.desenho svg { display: block; width: 100%; height: auto; }
  figure.desenho figcaption { font-size: 12.5px; color: var(--apagado);
                              padding-top: 10px; border-top: 1px solid var(--linha); margin-top: 10px; }
  .d-casca { stroke: var(--realce); fill: none; stroke-width: 1.6; }
  .d-chao  { stroke: var(--linha-forte); fill: none; stroke-width: 1.4; }
  .d-eixo  { stroke: var(--linha-forte); fill: none; stroke-dasharray: 3 4; }
  .d-feixe { fill: none; stroke-width: 1.4; opacity: .9; }
  .d-txt   { fill: var(--apagado); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5px; }
  .d-txt-f { fill: var(--tinta); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; font-weight: 600; }

  /* A linha de cabeça da cúpula, tal como a calculadora a escreve. */
  .resumo { font-size: 15.5px; font-weight: 600; letter-spacing: -.005em; }
  /* A nota de rodapé de uma secção: veio da calculadora, e é texto corrido —
     não é um aviso desta folha, por isso não leva a caixa tingida. */
  .nota-fonte { font-size: 13px; color: var(--apagado); max-width: 72ch; }

  ul.lista { margin: 0; padding: 0; list-style: none;
             border: 1px solid var(--linha); border-radius: 4px; background: var(--painel); overflow: hidden; }
  ul.lista li { padding: 10px 16px; border-bottom: 1px solid var(--linha); font-size: 14px; break-inside: avoid; }
  ul.lista li:last-child { border-bottom: 0; }
  ul.lista b { font-weight: 600; }
  ul.lista span { color: var(--apagado); }

  footer { font-size: 13px; color: var(--apagado); display: flex; flex-direction: column; gap: 6px; }

  /* AO IMPRIMIR VOLTA SEMPRE AO CLARO. Uma folha de montagem sai em papel, e
     em papel é tinta preta sobre branco — o tema do sistema de quem imprime
     não tem nada que ver com isso. */
  @media print {
    /* Os DOIS selectores, e não só ":root". A regra do modo escuro é
       ":root:not([data-theme=light])", que é MAIS específica — e especificidade
       ganha à ordem no ficheiro. Com só ":root" aqui, quem tivesse o sistema em
       escuro imprimia uma folha preta com o título branco sobre branco. Visto
       numa captura em media=print com o sistema escuro, antes de sair. */
    :root, :root:not([data-theme="light"]) {
      --papel: #FFFFFF; --painel: #FFFFFF; --tinta: #131A20; --apagado: #5A6672;
      --linha: #D0D7DC; --linha-forte: #A8B4BC; --realce: #0E6F86;
      --aviso-f: #FDF4E3; --aviso-t: #8A5A00; --aviso-b: #E3C384;
      --sombra: none;
    }
    body { background: #fff; font-size: 12.5px; }
    .folha { max-width: none; padding: 0; gap: 22px; }
    h1 { font-size: 26px; }
    h2 { font-size: 17px; }
    figure.vista { box-shadow: none; padding: 0; border: 0; }
    figure.vista img { max-height: 300px; border: 1px solid var(--linha); }
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

  // A sala passa a ser a fita do cabeçalho em vez de mais uma tabela: é o
  // projeto todo numa linha, que é o que se quer ver primeiro.
  const capa = `<header class="capa">
    ${d.logo ? `<span class="chapa"><img class="marca" src="${d.logo}" alt="Mike Apps"></span>` : ""}
    <p class="eyebrow">Folha de montagem · ${esc(d.quando)}</p>
    <h1>${esc(titulo)}</h1>
    ${fita(d.sala)}
  </header>`;

  const corpo = [
    d.imagem ? `<figure class="vista">
        <img src="${d.imagem}" alt="A sala como está no 3D">
        <figcaption>A sala como está no 3D, no momento em que esta folha foi gerada.</figcaption>
      </figure>` : "",
    // A cúpula é a única secção com DUAS origens na mesma folha: as linhas de
    // cima vêm da calculadora já escritas (área, dome master, resolução
    // angular, aproveitamento, luz) e a tabela vem de quem colocou os
    // projetores aqui no 3D. É o que o pedido queria — "a calculadora dá os
    // materiais e alguns cálculos, o desenho mostra como, com outros".
    seccao("Cúpula",
           (d.domeTitulo ? `<p class="resumo">${esc(d.domeTitulo)}</p>` : "") +
           (d.dome ? fichas(d.dome) : "") +
           // Quando os números da calculadora não vieram, a folha DIZ-O. Sem
           // isto, quem a lê acha que aquelas quatro linhas são tudo o que há.
           (d.faltaFicha ? `<div class="achado"><span class="marca">!</span><div class="dizeres">
              <p>Esta folha não traz os números da calculadora — <b>área, dome master, resolução
              angular, aproveitamento e luz</b>. O projeto que está carregado foi enviado por uma
              versão dos Calculadores anterior à <b>v3.92</b>.</p>
              <p>Para os ter: abre os Calculadores, deixa a aba Dome recalcular, e no 3D carrega no
              <b>🔄</b> para trazer o projeto outra vez. Depois gera a folha de novo.</p>
              </div></div>` : "") +
           // As quebras de linha da nota são as do <pre> da calculadora, com
           // largura fixa. Aqui a caixa quebra sozinha, e mantê-las punha o
           // corte a meio das frases. Juntam-se em espaços.
           (d.domeNota ? `<p class="nota-fonte">${esc(d.domeNota).replace(/\s*\n\s*/g, " ")}</p>` : "") +
           (d.desenhoDome
             ? `<div class="desenhos">${plantaDaCupula(d.desenhoDome)}${corteDaCupula(d.desenhoDome)}</div>`
             : "") +
           (d.coordsCupula || ""),
           d.coordsCupula ? "Coordenadas de montagem" : "Geometria"),
    // A tradução para o programa que vai receber estes números. Só aparece com
    // coordenadas na folha: sem elas não há nada para traduzir.
    (d.coordsCupula || d.coordsPlanos)
      ? seccao("Os campos, com os nomes que o programa usa",
               blocoWatchout(d.lenteThrow), "WATCHOUT 7 · Display Properties")
      : "",
    seccao("Ecrã plano", (d.plano ? fichas(d.plano) : "") + (d.coordsPlanos || ""),
           d.coordsPlanos ? "Coordenadas de montagem" : "Geometria"),
    // A nota de leitura chega em linhas, e cada uma fica no seu parágrafo: o
    // aviso das unidades e o "sem recentrar nem reescalar" são as duas coisas
    // que estragam uma montagem, e num bloco corrido passavam despercebidas.
    (d.coordsCupula || d.coordsPlanos) && d.nota && d.nota.length
      ? `<div class="achado"><span class="marca">!</span><div class="dizeres">` +
        d.nota.map((l) => `<p>${l}</p>`).join("") + `</div></div>`
      : "",
    seccao("Ajustes feitos no 3D", d.ajustes && d.ajustes.length
      ? d.ajustes.map((g) => `<h3>${esc(g.titulo)}</h3><ul class="lista">` +
          g.linhas.map((l) => `<li><b>${esc(l.quem)}</b> <span>${esc(l.texto)}</span></li>`).join("") +
          `</ul>`).join("")
      : "", "O que aqui difere do que veio dos Calculadores"),
    seccao("Por montar", d.deposito && d.deposito.length
      ? `<ul class="lista">` + d.deposito.map((n) => `<li><b>${esc(n)}</b></li>`).join("") + `</ul>`
      : "", "Está no depósito, ainda não entrou na sala")
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
${corpo}
<hr class="regra">
<footer>
  <p>Gerado pelo Mike Apps Preview${d.versao ? " " + esc(d.versao) : ""} em ${esc(d.quando)}.</p>
  <p>Medidas em metros. Esta folha abre em qualquer browser, sem a app e sem internet.</p>
</footer>
</div>
</body>
</html>`;
}
