// O projeto que vem dos Calculadores.
//
// O preview não sabe nada de tiles, pitch ou catálogos — e é de propósito. Quem
// sabe isso são os Calculadores, e são eles que mandam as zonas **já em metros**.
// Assim o dia em que lá entrar um modelo de LED novo não obriga a mexer aqui, e
// nunca há dois sítios a discordar sobre o tamanho da mesma parede.

export const FORMATO = 1;

// Um projeto para experimentar sem ter de ir buscar nada: uma parede principal
// com duas alas, do género do que se monta num palco.
export const EXEMPLO = {
  v: FORMATO,
  origem: "exemplo",
  nome: "Palco com duas alas",
  // A sala vai com ele de propósito: um conjunto de 15 m numa sala de 20 fica
  // encostado às paredes, e as 12 filas pedidas por omissão não cabiam em 14 m
  // de profundidade — a app abria a avisar-se a si própria.
  sala: { largura: 24, profundidade: 18, altura: 8 },
  zonas: [
    { nome: "Ala esquerda", x: 0,    y: 0.6, w: 3.0, h: 3.4, cor: "#22D3EE",
      tiles: { x: 6, y: 7 },  res: { x: 768,  y: 896  }, peso: 252, amp: 24 },
    { nome: "Principal",    x: 3.5,  y: 0,   w: 8.0, h: 4.5, cor: "#2E7BFF",
      tiles: { x: 16, y: 9 }, res: { x: 2048, y: 1152 }, peso: 864, amp: 82 },
    { nome: "Ala direita",  x: 12.0, y: 0.6, w: 3.0, h: 3.4, cor: "#22D3EE",
      tiles: { x: 6, y: 7 },  res: { x: 768,  y: 896  }, peso: 252, amp: 24 }
  ]
};

function numero(valor, porOmissao) {
  const n = typeof valor === "string" ? parseFloat(valor.replace(",", ".")) : valor;
  return Number.isFinite(n) ? n : porOmissao;
}

/** Aceita o que vier e devolve um projeto com o feitio certo, ou atira. */
export function lerProjeto(bruto) {
  let dados = bruto;
  if (typeof bruto === "string") {
    const texto = bruto.trim();
    if (!texto) throw new Error("Não veio nada.");
    try {
      dados = JSON.parse(texto);
    } catch (e) {
      // Não é JSON. Antes de desistir, procuram-se MEDIDAS: é o que uma pessoa
      // escreve quando quer ver um ecrã de seis por três, e é o que vem no
      // texto que os Calculadores copiam.
      const doTexto = projetoDeTexto(texto);
      if (doTexto) return doTexto;
      throw new Error(
        "Não encontrei aqui nem JSON nem medidas. Escreve o tamanho — " +
        "\"6 x 3 m\", ou \"3 ecrãs de 3,90 × 2,19 m\" — ou usa o botão " +
        "\"Ver em 3D\" nos Calculadores.");
    }
  }

  // Também se aceita a lista de zonas à seca, que é o que está no localStorage
  // dos Calculadores: quem cola raramente sabe qual das duas coisas tem na mão.
  const zonasBrutas = Array.isArray(dados) ? dados : dados.zonas;
  if (!Array.isArray(zonasBrutas) || !zonasBrutas.length) {
    throw new Error("Não encontrei zonas nenhumas lá dentro.");
  }

  const zonas = [];
  const recusadas = [];
  zonasBrutas.forEach((z, i) => {
    const largura = numero(z.w, numero(z.largura, NaN));
    const altura = numero(z.h, numero(z.altura, NaN));
    if (!(largura > 0) || !(altura > 0)) {
      // Uma zona sem medidas é uma zona que veio do sítio errado: o localStorage
      // guarda tiles e modelo, não metros. Dizer qual falhou vale mais do que
      // recusar o projeto todo.
      recusadas.push(z.nome || z.name || `zona ${i + 1}`);
      return;
    }
    zonas.push({
      nome: String(z.nome || z.name || `Zona ${i + 1}`),
      x: numero(z.x, numero(z.posX, 0)),
      y: numero(z.y, numero(z.posY, 0)),
      w: largura,
      h: altura,
      cor: typeof z.cor === "string" ? z.cor : (z.colorOverride || "#2E7BFF"),
      curva: z.curva && numero(z.curva.valor, 0)
        ? { modo: z.curva.modo === "raio" ? "raio" : "angulo",
            valor: numero(z.curva.valor, 0),
            dir: z.curva.dir === "concavo" ? "concavo" : "convexo" }
        : null,
      tiles: z.tiles || null,
      res: z.res || null,
      peso: numero(z.peso, null),
      amp: numero(z.amp, null)
    });
  });

  if (!zonas.length) {
    throw new Error("Nenhuma zona trazia medidas em metros. " +
                    "Isto veio do localStorage em vez do botão dos Calculadores?");
  }

  return {
    v: numero(dados.v, FORMATO),
    nome: dados.nome || dados.name || "Projeto",
    origem: dados.origem || "colado",
    sala: dados.sala || null,
    zonas,
    recusadas
  };
}

/**
 * Um projeto tirado de texto corrido.
 *
 * Aceita o que uma pessoa escreve ("6 x 3 m", "ecrã de 4,96 por 2,79") e o que
 * as outras partes da app copiam ("3 ecrãs de 3,90 × 2,19 m", "Ecrã:
 * Personalizado — 4,96 x 2,79 m"). Não tenta perceber o texto todo: procura o
 * PAR DE MEDIDAS e, se houver, quantos ecrãs são. Tudo o resto do texto é
 * ignorado de propósito — é um atalho para ver, não um interpretador.
 *
 * Devolve null quando não encontra nada credível, para quem chamou poder dizer
 * a verdade em vez de desenhar um ecrã inventado.
 */
function projetoDeTexto(texto) {
  const limpo = texto.replace(/\s+/g, " ");
  // largura x altura, com vírgula ou ponto decimal, e o "x" em qualquer feitio
  const medidas = limpo.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[.,]\d+)?)/i);
  if (!medidas) return null;

  let largura = numero(medidas[1], NaN);
  let altura = numero(medidas[2], NaN);
  if (!(largura > 0) || !(altura > 0)) return null;

  // A unidade, quando vier escrita a seguir. Sem nada, assume-se metros: é o
  // que a app fala em todo o lado.
  const unidade = (limpo.slice(medidas.index + medidas[0].length, medidas.index + medidas[0].length + 14)
                   .match(/\b(mm|cm|m|metros?)\b/i) || [])[1];
  const fator = /^mm$/i.test(unidade || "") ? 0.001 : /^cm$/i.test(unidade || "") ? 0.01 : 1;
  largura *= fator;
  altura *= fator;

  // Medidas absurdas quase de certeza são outra coisa qualquer no texto — uma
  // resolução, uma data, um preço. Mais vale não desenhar nada.
  if (largura > 200 || altura > 100 || largura < 0.05 || altura < 0.05) return null;

  const quantos = Math.min(8, Math.max(1, parseInt(
    (limpo.match(/(\d+)\s*ecr[ãa]s/i) || [])[1] || "1", 10)));

  const SEPARACAO = 1;   // um metro entre ecrãs, que é o que "lado a lado" costuma ser
  const zonas = [];
  for (let i = 0; i < quantos; i++) {
    zonas.push({
      nome: quantos > 1 ? `Ecrã ${i + 1}` : "Ecrã",
      x: i * (largura + SEPARACAO), y: 0, w: largura, h: altura,
      cor: "#2E7BFF"
    });
  }

  return lerProjeto({
    v: FORMATO,
    origem: "escrito à mão",
    nome: quantos > 1 ? `${quantos} ecrãs de ${largura} × ${altura} m` : `Ecrã ${largura} × ${altura} m`,
    zonas
  });
}

/** Os números que interessam ao olhar para o conjunto todo. */
export function totais(projeto) {
  const z = projeto.zonas;
  const esquerda = Math.min(...z.map(a => a.x));
  const direita = Math.max(...z.map(a => a.x + a.w));
  const topo = Math.min(...z.map(a => a.y));
  const fundo = Math.max(...z.map(a => a.y + a.h));
  const soma = (campo) => z.reduce((t, a) => t + (a[campo] || 0), 0);
  return {
    largura: direita - esquerda,
    altura: fundo - topo,
    esquerda, direita, topo, fundo,
    peso: soma("peso"),
    amp: soma("amp"),
    zonas: z.length
  };
}

/**
 * O que vier no endereço, por chave.
 *
 * Começou por ser só `#p=<projeto>`; agora o projetor também viaja por aqui, e
 * os dois podem vir juntos. Parte-se à mão em vez de usar o URLSearchParams
 * porque o valor é base64url e o `+` de um querystring seria interpretado como
 * espaço — o payload chegava partido e ninguém percebia porquê.
 */
function doEndereco(chave) {
  const bruto = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  for (const pedaco of bruto.split("&")) {
    const igual = pedaco.indexOf("=");
    if (igual > 0 && pedaco.slice(0, igual) === chave) return pedaco.slice(igual + 1);
  }
  return "";
}

function desempacotar(bruto) {
  const base64 = decodeURIComponent(bruto).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Lê um projeto que venha no endereço, posto lá pelos Calculadores. */
export function projetoDoEndereco() {
  const bruto = doEndereco("p");
  if (!bruto) return null;
  try {
    return lerProjeto(desempacotar(bruto));
  } catch (e) {
    throw new Error("O endereço traz um projeto que não consigo abrir: " + e.message);
  }
}

/** E o projetor, quando vem do botão "Ver no Preview 3D" da aba da projeção. */
export function projetorDoEndereco() {
  const bruto = doEndereco("proj");
  if (!bruto) return null;
  try {
    return lerProjetor(JSON.parse(desempacotar(bruto)));
  } catch (e) {
    return null;
  }
}


// As duas apps vivem no mesmo domínio, por isso partilham o localStorage — e é
// esse o canal por onde falam uma com a outra, sem servidor nenhum pelo meio.
export const CHAVE_PROJETO = "mikeapps-projeto-v1";
export const CHAVE_SALA = "mikeapps-sala-v1";
export const CHAVE_PROJETOR = "mikeapps-projetor-v1";
export const CHAVE_BRIEFING = "mikeapps-briefing-v1";

/** O último projeto que os Calculadores deixaram guardado, se houver. */
export function projetoGuardado() {
  try {
    const bruto = localStorage.getItem(CHAVE_PROJETO);
    return bruto ? lerProjeto(bruto) : null;
  } catch (e) {
    return null;
  }
}

/** A sala fica guardada para os Calculadores a poderem ir buscar. */
export function guardarSala(sala) {
  try {
    localStorage.setItem(CHAVE_SALA, JSON.stringify(
      Object.assign({ v: 1, quando: new Date().toISOString() }, sala)));
  } catch (e) { /* sem localStorage a app funciona na mesma */ }
}

/**
 * O projetor escolhido nos Calculadores, se lá tiver ficado algum.
 *
 * Chega com o rácio e a distância já feitos — e é isso, e só isso, que o
 * preview quer saber. O catálogo de projetores e de lentes, os lumens, os lux
 * e a conta de qual lente serve ficam do lado de lá, como as tabelas de LED:
 * a conta faz-se uma vez, no sítio onde ela vive.
 */
export function projetorGuardado() {
  try {
    const bruto = localStorage.getItem(CHAVE_PROJETOR);
    return bruto ? lerProjetor(JSON.parse(bruto)) : null;
  } catch (e) {
    return null;
  }
}

function lerProjetor(d) {
  try {
    const racio = numero(d.racio, 0);
    const distancia = numero(d.distancia, 0);
    if (!(racio > 0) || !(distancia > 0)) return null;
    const largura = numero(d.largura, 0), altura = numero(d.altura, 0);
    return {
      racio, distancia,
      largura, altura,
      formato: (largura > 0 && altura > 0) ? largura / altura : numero(d.formato, 0),
      modelo: typeof d.modelo === "string" ? d.modelo : "",
      lente: typeof d.lente === "string" ? d.lente : "",
      // Ate onde aquela lente faz shift, quando o fabricante o publica. Vem de
      // la porque e la que vive o catalogo -- aqui so serve para avisar.
      shift: d.shift && Number.isFinite(numero(d.shift.vMax, NaN)) ? {
        vMin: numero(d.shift.vMin, 0), vMax: numero(d.shift.vMax, 0),
        hMin: numero(d.shift.hMin, 0), hMax: numero(d.shift.hMax, 0),
        nota: typeof d.shift.nota === "string" ? d.shift.nota : ""
      } : null,
      quando: d.quando || null
    };
  } catch (e) {
    return null;
  }
}
