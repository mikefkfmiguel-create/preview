// Escrever um DXF: a planta, em metros, para quem confere.
//
// Pedido: *"seria para exportar e enviar para a engenharia de desenho, que
// confere e envia para o cliente"*, e a seguir o que mais importa:
// *"medidas correctas para conferência"*.
//
// É esse o critério, e é o único que interessa: o que o desenhador medir no
// Vectorworks tem de dar o número que a app diz. Tudo o resto -- cores,
// feitios, quantas peças vão -- vem depois disso.
//
// POR QUE RAZÃO DXF E NÃO O QUE JÁ SAÍA. O .obj e o .glb que a app já exporta
// levam a geometria mas não levam significado: entram no Vectorworks como uma
// mancha de triângulos, onde não se agarra a um canto, não se cota e não se
// desenha por cima. Para conferir é preciso um desenho com linhas e camadas.
// (O MVR, que é o formato da indústria para trocar cenas entre visualizadores
// e mesas, também não serve aqui: não produz um desenho que alguém assina.)
//
// DUAS DECISÕES DE FORMATO, e a razão de cada uma:
//
//   1. Escreve-se o DXF ASCII "à antiga" -- LINE, TEXT e CIRCLE, e mais nada.
//      Há entidades mais arrumadas (LWPOLYLINE), mas exigem versões recentes
//      do formato. Estas três lêem-se em tudo o que abre um DXF, incluindo o
//      leitor desta própria app. Num ficheiro que vai para as mãos de outra
//      pessoa, chato e compatível ganha a elegante e recusada.
//
//   2. As coordenadas vão em METROS, com o $INSUNITS a dizê-lo (código 6).
//      É o que a app usa por dentro, e assim não há uma conversão pelo meio
//      onde um erro de escala se possa esconder. Quem abre o ficheiro lê o
//      cabeçalho e escala sozinho.
//
// O SISTEMA DE EIXOS. A cena é X para a direita e Z sala adentro; um desenho
// de planta é X para a direita e Y para cima. Como o palco vive no Z negativo
// (a parede do fundo), usa-se Y = -Z: assim o palco aparece em cima na folha,
// que é onde toda a gente o desenha.

/** X/Y da folha a partir de X/Z do mundo. Ver a nota dos eixos, acima. */
export function paraPlanta(x, z) {
  return { x: x, y: -z };
}

// Uma cor por camada (índice de cor do AutoCAD, que toda a gente entende).
const CORES = {
  SALA: 7,        // branco/preto, conforme o fundo
  PALCO: 3,       // verde
  ECRAS: 5,       // azul
  PROJECAO: 6,    // magenta
  PLATEIA: 8,     // cinzento
  REGIE: 2,       // amarelo
  COTAS: 1        // vermelho
};

/**
 * O ALÇADO VIVE EM CAMADAS PRÓPRIAS -- "ALCADO-PALCO", "ALCADO-ECRAS" e
 * companhia (ver plantaEmDXF) -- e cada uma herda a cor da camada que lhe dá o
 * nome: o palco do alçado é verde como o palco da planta.
 *
 * Antes partilhavam camada com a planta, e estava escrito que era de propósito
 * (desligar ECRAS desligava-o nas duas vistas). Estava errado por duas razões,
 * e a segunda só se viu ao reabrir o desenho: um alçado não se pode desligar
 * sozinho para conferir só a planta; e ao trazer este DXF de volta para a app,
 * o alçado entra como se fosse planta -- fica deitado no chão à frente da
 * plateia, um segundo palco ao contrário, e ainda puxa o centro do desenho
 * para fora do centro da sala.
 */
function corDaCamada(nome) {
  return CORES[String(nome).replace(/^ALCADO-/, "")] || 7;
}

function par(codigo, valor) { return codigo + "\n" + valor + "\n"; }

// Seis casas decimais: um milímetro são 0,001 m, e três casas a mais chegam
// para nunca ser o arredondamento a dar a diferença numa conferência.
function n(v) { return (Math.round(Number(v) * 1e6) / 1e6).toFixed(6); }

function linha(camada, x1, y1, x2, y2) {
  return par(0, "LINE") + par(8, camada) +
    par(10, n(x1)) + par(20, n(y1)) + par(30, "0.0") +
    par(11, n(x2)) + par(21, n(y2)) + par(31, "0.0");
}

function texto(camada, x, y, altura, conteudo, rodarGraus) {
  return par(0, "TEXT") + par(8, camada) +
    par(10, n(x)) + par(20, n(y)) + par(30, "0.0") +
    par(40, n(altura)) + par(1, String(conteudo)) +
    (rodarGraus ? par(50, n(rodarGraus)) : "");
}

function circulo(camada, x, y, raio) {
  return par(0, "CIRCLE") + par(8, camada) +
    par(10, n(x)) + par(20, n(y)) + par(30, "0.0") + par(40, n(raio));
}

/**
 * Um rectângulo, podendo estar rodado à volta do próprio centro. Sai em
 * quatro LINE e não numa polilinha -- ver a nota do formato, lá em cima.
 * `rodar` em graus, no sentido do desenho.
 */
function rectangulo(camada, cx, cy, largura, altura, rodar) {
  const a = (rodar || 0) * Math.PI / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const hw = largura / 2, hh = altura / 2;
  const cantos = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([px, py]) => [
    cx + px * cos - py * sin,
    cy + px * sin + py * cos
  ]);
  let fora = "";
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = cantos[i], [x2, y2] = cantos[(i + 1) % 4];
    fora += linha(camada, x1, y1, x2, y2);
  }
  return fora;
}

/**
 * UMA COTA, como quem a desenha à mão: a linha entre os dois pontos, um
 * tracinho em cada ponta e o número por cima.
 *
 * Não se usa a entidade DIMENSION do DXF de propósito. Ela é uma cota a
 * sério -- que se recalcula sozinha se alguém mexer no desenho --, mas exige
 * um estilo de cota definido no ficheiro e cada programa desenha-a à sua
 * maneira. Aqui o que se quer é o contrário: que o número que sai seja o
 * número que a app diz, e que continue igual em qualquer programa que abra
 * isto. Uma cota que se recalcula do outro lado podia passar a dizer outra
 * coisa -- e este ficheiro serve exactamente para conferir.
 */
function cota(camada, x1, y1, x2, y2, etiqueta, alturaTexto) {
  const h = alturaTexto || 0.25;
  const dx = x2 - x1, dy = y2 - y1;
  const comprimento = Math.hypot(dx, dy) || 1;
  // A perpendicular, para os tracinhos das pontas.
  const px = -dy / comprimento * h * 0.6, py = dx / comprimento * h * 0.6;
  let fora = linha(camada, x1, y1, x2, y2);
  fora += linha(camada, x1 - px, y1 - py, x1 + px, y1 + py);
  fora += linha(camada, x2 - px, y2 - py, x2 + px, y2 + py);
  const graus = Math.atan2(dy, dx) * 180 / Math.PI;
  // O texto a meio, ligeiramente por cima da linha, e virado com ela.
  fora += texto(camada, (x1 + x2) / 2 - px * 0.6 - dx / comprimento * h * 1.2,
    (y1 + y2) / 2 - py * 0.6 - dy / comprimento * h * 1.2,
    h, etiqueta, (graus > 90 || graus < -90) ? graus + 180 : graus);
  return fora;
}

export const DESENHO = { linha, texto, circulo, rectangulo, cota };

/**
 * O ficheiro inteiro.
 *
 * `pecas` é uma lista de pedaços de DXF já escritos (ver DESENHO), e
 * `camadas` os nomes que aparecem lá dentro. A caixa que envolve tudo
 * ($EXTMIN/$EXTMAX) vai no cabeçalho para o desenho abrir já enquadrado, em
 * vez de aparecer um ponto perdido no meio de nada.
 */
export function comoDXF(camadas, pecas, limites) {
  let fora = "";

  // ---- cabeçalho: as unidades, que é o que impede um erro de escala -------
  fora += par(0, "SECTION") + par(2, "HEADER");
  fora += par(9, "$ACADVER") + par(1, "AC1009");
  fora += par(9, "$INSUNITS") + par(70, 6);        // 6 = metros
  fora += par(9, "$MEASUREMENT") + par(70, 1);     // 1 = métrico
  if (limites) {
    fora += par(9, "$EXTMIN") + par(10, n(limites.minX)) + par(20, n(limites.minY)) + par(30, "0.0");
    fora += par(9, "$EXTMAX") + par(10, n(limites.maxX)) + par(20, n(limites.maxY)) + par(30, "0.0");
  }
  fora += par(0, "ENDSEC");

  // ---- as camadas ---------------------------------------------------------
  fora += par(0, "SECTION") + par(2, "TABLES");
  fora += par(0, "TABLE") + par(2, "LAYER") + par(70, camadas.length);
  for (const nome of camadas) {
    fora += par(0, "LAYER") + par(2, nome) + par(70, 0) +
      par(62, corDaCamada(nome)) + par(6, "CONTINUOUS");
  }
  fora += par(0, "ENDTAB") + par(0, "ENDSEC");

  // ---- o desenho ----------------------------------------------------------
  fora += par(0, "SECTION") + par(2, "ENTITIES");
  fora += pecas.join("");
  fora += par(0, "ENDSEC");

  fora += par(0, "EOF");
  return fora;
}
