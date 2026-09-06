// Ler um DXF a sério: linhas e polilinhas já à escala, sem calibrar nada.
//
// A planta em IMAGEM continua a existir e continua a servir (um PDF antigo,
// uma foto de um desenho), mas uma imagem não sabe a escala a que foi
// desenhada — daí ter de se lhe dizer a largura à mão. Um DXF sabe: traz as
// coordenadas em unidades de desenho e traz, no cabeçalho, quais são essas
// unidades. Por isso aqui não se calibra nada: lê-se o $INSUNITS e a sala
// aparece do tamanho que tem.
//
// Isto lê a versão ASCII do formato, que é a que sai de toda a gente quando se
// exporta "DXF". O formato é uma lista interminável de pares (código, valor);
// o que interessa é uma mão-cheia de códigos.

const PARA_METRO = {
  1: 0.0254,      // polegadas
  2: 0.3048,      // pés
  4: 0.001,       // milímetros
  5: 0.01,        // centímetros
  6: 1,           // metros
  7: 1000,        // quilómetros
  9: 0.0000254,   // milésimas de polegada
  10: 0.9144,     // jardas
  14: 0.1,        // decímetros
  15: 10,         // decâmetros
  16: 100         // hectómetros
};

export const UNIDADES = [
  { chave: "auto", nome: "Automático (do ficheiro)" },
  { chave: "mm", nome: "Milímetros", fator: 0.001 },
  { chave: "cm", nome: "Centímetros", fator: 0.01 },
  { chave: "m", nome: "Metros", fator: 1 },
  { chave: "in", nome: "Polegadas", fator: 0.0254 },
  { chave: "ft", nome: "Pés", fator: 0.3048 }
];

// Uma planta de arquitectura com um milhão de segmentos põe o browser de
// joelhos e não acrescenta nada a um preview. Corta-se — e diz-se que se
// cortou, que é a parte que costuma faltar.
const MAXIMO = 300000;

function tokenizar(texto) {
  const linhas = texto.split(/\r\n|\r|\n/);
  const pares = [];
  for (let i = 0; i + 1 < linhas.length; i += 2) {
    const codigo = parseInt(linhas[i], 10);
    if (Number.isNaN(codigo)) continue;
    pares.push({ c: codigo, v: linhas[i + 1] });
  }
  return pares;
}

/** Junta os campos de uma entidade até ao próximo código 0. */
function apanharEntidade(pares, i) {
  const dados = { tipo: pares[i].v, campos: [] };
  i++;
  while (i < pares.length && pares[i].c !== 0) {
    dados.campos.push(pares[i]);
    i++;
  }
  return { dados, i };
}

const numero = (campos, codigo, porOmissao) => {
  for (const p of campos) if (p.c === codigo) {
    const n = parseFloat(p.v);
    return Number.isFinite(n) ? n : porOmissao;
  }
  return porOmissao;
};
const palavra = (campos, codigo, porOmissao) => {
  for (const p of campos) if (p.c === codigo) return p.v;
  return porOmissao;
};

// -------------------------------------------------------------------- formas

/** Um arco em pedaços rectos — 15° por pedaço chega e sobra para um preview. */
function arco(cx, cy, raio, deGraus, ateGraus) {
  let abertura = ateGraus - deGraus;
  while (abertura <= 0) abertura += 360;
  const pedacos = Math.max(2, Math.ceil(abertura / 15));
  const pontos = [];
  for (let i = 0; i <= pedacos; i++) {
    const a = (deGraus + abertura * (i / pedacos)) * Math.PI / 180;
    pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio]);
  }
  return pontos;
}

/**
 * O "bulge" de uma polilinha: a maneira do DXF dizer que aquele troço não é
 * recto. É a tangente de um quarto do ângulo do arco, com sinal.
 *
 * Sem isto, uma sala curva chega cá como um polígono de seis lados — e o
 * desenho passa a mentir exactamente onde é mais visível. Devolve os pontos
 * do arco, sem o primeiro (que já lá está).
 */
function arcoDoBulge(x1, y1, x2, y2, bulge) {
  const angulo = 4 * Math.atan(bulge);
  const dx = x2 - x1, dy = y2 - y1;
  const corda = Math.hypot(dx, dy);
  if (!corda || !angulo) return [[x2, y2]];

  const raio = corda / (2 * Math.sin(angulo / 2));
  const afastamento = raio * Math.cos(angulo / 2);
  const cx = (x1 + x2) / 2 + (-dy / corda) * afastamento;
  const cy = (y1 + y2) / 2 + (dx / corda) * afastamento;

  const de = Math.atan2(y1 - cy, x1 - cx);
  const pedacos = Math.max(2, Math.ceil(Math.abs(angulo) / (Math.PI / 12)));
  const pontos = [];
  for (let i = 1; i <= pedacos; i++) {
    const a = de + angulo * (i / pedacos);
    pontos.push([cx + Math.cos(a) * Math.abs(raio), cy + Math.sin(a) * Math.abs(raio)]);
  }
  return pontos;
}

// ------------------------------------------------------------------ entidades

/** Uma entidade vira uma ou mais linhas quebradas, em coordenadas do desenho. */
function linhasDe(entidade, blocos, profundidade, fila, camada) {
  const { tipo, campos } = entidade;

  if (tipo === "LINE") {
    return [[[numero(campos, 10, 0), numero(campos, 20, 0)],
             [numero(campos, 11, 0), numero(campos, 21, 0)]]];
  }

  if (tipo === "LWPOLYLINE") {
    // O bulge (42) vem DEPOIS do vértice a que pertence e vale para o troço
    // que dali arranca — por isso junta-se tudo primeiro e só depois se
    // desenha. Ao contrário, os arcos saíam todos um vértice trocados.
    const vertices = [];
    for (const p of campos) {
      if (p.c === 10) vertices.push({ x: parseFloat(p.v), y: 0, bulge: 0 });
      else if (p.c === 20 && vertices.length) vertices[vertices.length - 1].y = parseFloat(p.v);
      else if (p.c === 42 && vertices.length) vertices[vertices.length - 1].bulge = parseFloat(p.v);
    }
    return [desenrolar(vertices, (numero(campos, 70, 0) & 1) === 1)];
  }

  if (tipo === "POLYLINE") {
    // A antiga: os vértices vêm a seguir, como entidades à parte, até ao SEQEND.
    const vertices = [];
    while (fila.length && fila[0].tipo === "VERTEX") {
      const v = fila.shift();
      vertices.push({ x: numero(v.campos, 10, 0), y: numero(v.campos, 20, 0),
                      bulge: numero(v.campos, 42, 0) });
    }
    if (fila.length && fila[0].tipo === "SEQEND") fila.shift();
    return [desenrolar(vertices, (numero(campos, 70, 0) & 1) === 1)];
  }

  if (tipo === "CIRCLE") {
    return [arco(numero(campos, 10, 0), numero(campos, 20, 0), numero(campos, 40, 0), 0, 360)];
  }

  if (tipo === "ARC") {
    return [arco(numero(campos, 10, 0), numero(campos, 20, 0), numero(campos, 40, 0),
                 numero(campos, 50, 0), numero(campos, 51, 0))];
  }

  if (tipo === "SOLID" || tipo === "3DFACE") {
    const p = [[numero(campos, 10, 0), numero(campos, 20, 0)],
               [numero(campos, 11, 0), numero(campos, 21, 0)],
               [numero(campos, 13, numero(campos, 12, 0)), numero(campos, 23, numero(campos, 22, 0))],
               [numero(campos, 12, 0), numero(campos, 22, 0)]];
    return [[...p, p[0]]];
  }

  if (tipo === "INSERT" && profundidade < 5) {
    // Uma planta de arquitectura é quase toda blocos — portas, cadeiras, o
    // mobiliário todo. Sem seguir os INSERT, o que chega cá são quatro paredes.
    const bloco = blocos.get(palavra(campos, 2, ""));
    if (!bloco) return [];
    const ix = numero(campos, 10, 0), iy = numero(campos, 20, 0);
    const ex = numero(campos, 41, 1) || 1, ey = numero(campos, 42, 1) || 1;
    const rot = numero(campos, 50, 0) * Math.PI / 180;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const colunas = Math.min(200, Math.max(1, Math.round(numero(campos, 70, 1))));
    const filas = Math.min(200, Math.max(1, Math.round(numero(campos, 71, 1))));
    const passoC = numero(campos, 44, 0), passoF = numero(campos, 45, 0);

    const dentro = converter(bloco.entidades, blocos, profundidade + 1, camada);
    const saida = [];
    for (let c = 0; c < colunas; c++) {
      for (let f = 0; f < filas; f++) {
        for (const linha of dentro) {
          const movida = linha.map(([x, y]) => {
            const px = (x - bloco.baseX) * ex, py = (y - bloco.baseY) * ey;
            return [ix + px * cos - py * sin + c * passoC,
                    iy + px * sin + py * cos + f * passoF];
          });
          movida.camada = linha.camada || camada;
          saida.push(movida);
        }
      }
    }
    return saida;
  }

  return [];
}

/** Vértices (com bulge) para uma linha quebrada. */
function desenrolar(vertices, fechada) {
  const pontos = [];
  const lista = fechada && vertices.length > 2 ? vertices.concat([vertices[0]]) : vertices;
  for (let i = 0; i < lista.length; i++) {
    const v = lista[i];
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) continue;
    if (!pontos.length) { pontos.push([v.x, v.y]); continue; }
    const anterior = lista[i - 1];
    if (anterior && anterior.bulge) {
      for (const p of arcoDoBulge(anterior.x, anterior.y, v.x, v.y, anterior.bulge)) pontos.push(p);
    } else {
      pontos.push([v.x, v.y]);
    }
  }
  return pontos.length > 1 ? pontos : [];
}

function converter(entidades, blocos, profundidade, camadaDoPai) {
  const linhas = [];
  const fila = entidades.slice();
  while (fila.length) {
    const entidade = fila.shift();
    // A camada e a do proprio desenho (codigo 8); dentro de um bloco, o que
    // nao a declarar herda a de quem o inseriu -- que e a regra do formato.
    const camada = palavra(entidade.campos, 8, "") || camadaDoPai || "0";
    for (const linha of linhasDe(entidade, blocos, profundidade, fila, camada)) {
      if (linha && linha.length > 1) {
        linha.camada = linha.camada || camada;
        linhas.push(linha);
      }
    }
  }
  return linhas;
}

// -------------------------------------------------------------------- leitura

export function lerDXF(bruto) {
  if (/^\s*AutoCAD Binary DXF/.test(bruto)) {
    throw new Error("Isso é um DXF binário. Guarda-o como \"DXF ASCII\" e volta a tentar.");
  }
  const pares = tokenizar(bruto);
  if (!pares.length) throw new Error("Isto não parece um DXF.");

  let insunits = null;
  const blocos = new Map();
  const entidades = [];

  let i = 0;
  while (i < pares.length) {
    if (pares[i].c !== 0 || pares[i].v !== "SECTION") { i++; continue; }
    const nome = pares[i + 1] && pares[i + 1].c === 2 ? pares[i + 1].v : "";
    i += 2;

    if (nome === "HEADER") {
      while (i < pares.length && !(pares[i].c === 0 && pares[i].v === "ENDSEC")) {
        if (pares[i].c === 9 && pares[i].v === "$INSUNITS" && pares[i + 1]) {
          insunits = parseInt(pares[i + 1].v, 10);
        }
        i++;
      }
    } else if (nome === "BLOCKS") {
      let atual = null;
      while (i < pares.length && !(pares[i].c === 0 && pares[i].v === "ENDSEC")) {
        if (pares[i].c !== 0) { i++; continue; }
        const { dados, i: proximo } = apanharEntidade(pares, i);
        i = proximo;
        if (dados.tipo === "BLOCK") {
          atual = { entidades: [],
                    baseX: numero(dados.campos, 10, 0), baseY: numero(dados.campos, 20, 0) };
          blocos.set(palavra(dados.campos, 2, ""), atual);
        } else if (dados.tipo === "ENDBLK") {
          atual = null;
        } else if (atual) {
          atual.entidades.push(dados);
        }
      }
    } else if (nome === "ENTITIES") {
      while (i < pares.length && !(pares[i].c === 0 && pares[i].v === "ENDSEC")) {
        if (pares[i].c !== 0) { i++; continue; }
        const { dados, i: proximo } = apanharEntidade(pares, i);
        i = proximo;
        entidades.push(dados);
      }
    } else {
      while (i < pares.length && !(pares[i].c === 0 && pares[i].v === "ENDSEC")) i++;
    }
  }

  const linhas = converter(entidades, blocos, 0, "0");
  if (!linhas.length) {
    throw new Error("O DXF abriu, mas não trazia linhas nenhumas que eu saiba desenhar.");
  }

  // Os segmentos, em pares de pontos — e a caixa que os envolve, que é o que
  // diz o tamanho do desenho e onde fica o meio dele.
  const pontos = [];
  const deQuemE = [];              // indice da camada, um por segmento
  const nomesDeCamada = [];
  const indiceDaCamada = new Map();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let cortado = false;
  for (const linha of linhas) {
    const nome = linha.camada || "0";
    let indice = indiceDaCamada.get(nome);
    if (indice === undefined) {
      indice = nomesDeCamada.length;
      indiceDaCamada.set(nome, indice);
      nomesDeCamada.push(nome);
    }
    for (let k = 0; k + 1 < linha.length; k++) {
      if (pontos.length / 4 >= MAXIMO) { cortado = true; break; }
      const [x1, y1] = linha[k], [x2, y2] = linha[k + 1];
      if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
      pontos.push(x1, y1, x2, y2);
      deQuemE.push(indice);
      if (x1 < minX) minX = x1; if (x1 > maxX) maxX = x1;
      if (x2 < minX) minX = x2; if (x2 > maxX) maxX = x2;
      if (y1 < minY) minY = y1; if (y1 > maxY) maxY = y1;
      if (y2 < minY) minY = y2; if (y2 > maxY) maxY = y2;
    }
    if (cortado) break;
  }
  if (!pontos.length) throw new Error("O DXF não trazia coordenadas utilizáveis.");

  // Quantos segmentos tem cada camada: e por aí que a lista se ordena, porque
  // a camada com mais linhas é quase sempre a que interessa ver primeiro.
  const contagem = new Array(nomesDeCamada.length).fill(0);
  for (const i of deQuemE) contagem[i]++;

  return {
    pontos,
    deQuemE: Uint16Array.from(deQuemE),
    camadas: nomesDeCamada.map((nome, i) => ({ nome, segmentos: contagem[i], indice: i })),
    segmentos: pontos.length / 4,
    minX, maxX, minY, maxY,
    largura: maxX - minX,
    profundidade: maxY - minY,
    insunits, blocos: blocos.size, cortado
  };
}

/**
 * Quantos metros vale uma unidade do desenho.
 *
 * O cabeçalho costuma dizê-lo, e quando diz é isso que manda. Quando vem a
 * zero — "sem unidades", que é o que muito exportador escreve — adivinha-se
 * pelo tamanho: uma sala tem dezenas de alguma coisa se for em metros e
 * milhares se for em milímetros. A adivinha fica escrita no painel e há um
 * menu para a corrigir: adivinhar em silêncio é que seria mau.
 */
export function metrosPorUnidade(desenho, escolha) {
  if (escolha && escolha !== "auto") {
    const u = UNIDADES.find(x => x.chave === escolha);
    if (u && u.fator) return { fator: u.fator, comoSoube: "à mão" };
  }
  if (desenho.insunits && PARA_METRO[desenho.insunits]) {
    return { fator: PARA_METRO[desenho.insunits], comoSoube: "do ficheiro" };
  }
  const maior = Math.max(desenho.largura, desenho.profundidade);
  if (maior > 2000) return { fator: 0.001, comoSoube: "adivinhado: mm" };
  if (maior > 200) return { fator: 0.01, comoSoube: "adivinhado: cm" };
  return { fator: 1, comoSoube: "adivinhado: m" };
}
