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
  // encostado às paredes, e as filas pedidas por omissão têm de caber na
  // profundidade -- senão a app abre já a avisar-se a si própria, o pior
  // ponto de partida possível. Contas com os valores por omissão do HTML
  // (palco 6 m, "primeira fila a" 3 m, "entre filas" 0,9 m, corredores 1,2 m,
  // 10 filas): a última fila cai a 3 + 9×0,9 = 11,1 m da boca de palco, logo
  // a sala precisa de pelo menos 6 + 11,1 + 1,2 = 18,3 m de profundidade para
  // as 10 caberem todas. 18 m (o valor de antes, já uma correção de um "12
  // filas em 14 m" ainda pior) ficava mesmo abaixo disso -- reportado:
  // "só cabem 9 das 10 filas". 20 m dá folga a sério, não só o mínimo exato.
  sala: { largura: 24, profundidade: 20, altura: 8 },
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
      // Se começa por chaveta ou parêntese recto, quem escreveu isto queria
      // mesmo JSON — e o que falta é uma vírgula, não uma explicação sobre
      // medidas.
      if (/^[{[]/.test(texto)) {
        throw new Error("Isto quer ser JSON mas está partido — falta uma chaveta ou uma vírgula?");
      }
      // Sem medidas e sem JSON. Quem escreveu aqui um pedido em palavras não
      // se enganou: enganou-se o botão. A mensagem tem de apontar para o que
      // lê palavras, que está logo ali por baixo.
      const erro = new Error(
        "Não encontrei aqui medidas. Escreve o tamanho — \"6 x 3 m\", " +
        "ou \"3 ecrãs de 3,90 × 2,19 m\".");
      erro.emPalavras = true;
      throw erro;
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
      // A identidade da zona, posta por quem a criou (Calculadores ou este
      // Preview) e preservada por todos daí em diante. É por aqui que os
      // ajustes de posição/rotação se agarram à zona certa mesmo que ela mude
      // de nome -- ver ajusteDaZona() em app.js. Pode vir null: um projeto
      // gravado antes disto, ou colado à mão, não tem id nenhum, e nesse caso
      // volta-se a usar o nome, como sempre se fez.
      id: (typeof z.id === "string" && z.id) ? z.id : null,
      // De que aba dos Calculadores veio a zona ("tv", "led"). Aqui não se usa
      // para nada -- viaja só para poder voltar intacta no retorno, porque do
      // outro lado é essa marca que impede a fila de TVs de duplicar.
      origem: (typeof z.origem === "string" && z.origem) ? z.origem : null,
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
      amp: numero(z.amp, null),
      // O tipo vem dos Calculadores (LED, TV ou projeção) — sem ele, uma
      // zona é sempre LED, que é o que este preview sempre desenhou.
      tipo: (z.tipo === "tv" || z.tipo === "projecao") ? z.tipo : "led"
    });
  });

  if (!zonas.length) {
    throw new Error("Nenhuma zona trazia medidas em metros. " +
                    "Isto veio do localStorage em vez do botão dos Calculadores?");
  }

  // O DSM (monitor de confiança no palco) não é uma zona — é uma
  // quantidade e um tamanho para o conjunto todo, decididos lá nos
  // Calculadores. Sem quantidade não há nada para desenhar.
  const dsmBruto = dados.dsm;
  const dsm = (dsmBruto && numero(dsmBruto.n, 0) > 0 && numero(dsmBruto.w, 0) > 0 && numero(dsmBruto.h, 0) > 0)
    ? { n: Math.round(numero(dsmBruto.n, 0)), w: numero(dsmBruto.w, 0.6), h: numero(dsmBruto.h, 0.4) }
    : null;

  // O standard de distância de visualização escolhido na aba "Distância de
  // Visualização" dos Calculadores -- pedido direto para a Cobertura deste
  // Preview usar a MESMA regra, em vez de uma fixa própria (ver
  // regraDeDistancia() em app.js). Sem "basis"/"max" válidos não há regra
  // nenhuma para aplicar -- fica null, e a Cobertura cai nos valores por
  // omissão de sempre (mesmo comportamento de um projeto antigo ou colado).
  const standardBruto = dados.standard;
  const standard = (standardBruto && (standardBruto.basis === "width" || standardBruto.basis === "height")
      && numero(standardBruto.max, 0) > 0)
    ? { basis: standardBruto.basis, min: numero(standardBruto.min, 0), max: numero(standardBruto.max, 0),
        label: typeof standardBruto.label === "string" ? standardBruto.label : null }
    : null;

  return {
    v: numero(dados.v, FORMATO),
    nome: dados.nome || dados.name || "Projeto",
    origem: dados.origem || "colado",
    // A versão de quem escreveu isto (ex: "v3.17" dos Calculadores) -- só
    // para dizer, ao olhar para um projeto estranho, se veio de uma versão
    // antiga. Não existe para "colado"/ficheiros mais velhos, por isso pode
    // vir null -- ver #nomeProjetoViewport em app.js, onde aparece.
    origemVersao: typeof dados.origemVersao === "string" ? dados.origemVersao : null,
    sala: dados.sala || null,
    zonas,
    dsm,
    standard,
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

/**
 * O id de um link "🔗 Link para ver" (`#ver=<id>`), se for isso que vem no
 * endereço. Ao contrário de `p`/`proj`, não traz o projeto — só o id: quem
 * abre isto vai buscar o projeto ao Worker (ver js/partilha.js), não ao
 * próprio endereço.
 */
export function idPartilhaDoEndereco() {
  return doEndereco("ver") || null;
}

/** E o projetor, quando vem do botão "Ver no Preview 3D" da aba da projeção. */
export function projetorDoEndereco() {
  const bruto = doEndereco("proj");
  if (!bruto) return [];
  try {
    return lerProjetores(JSON.parse(desempacotar(bruto)));
  } catch (e) {
    return [];
  }
}


// As duas apps vivem no mesmo domínio, por isso partilham o localStorage — e é
// esse o canal por onde falam uma com a outra, sem servidor nenhum pelo meio.
export const CHAVE_PROJETO = "mikeapps-projeto-v1";
export const CHAVE_SALA = "mikeapps-sala-v1";
export const CHAVE_PROJETOR = "mikeapps-projetor-v1";
export const CHAVE_BRIEFING = "mikeapps-briefing-v1";
// A resposta do Preview para os Calculadores. Mantém o nome antigo para que
// o botão "Trazer do Preview" continue a reconhecer o aviso.
export const CHAVE_DEVOLUCAO = "mikeapps-ecra-v1";
export const CHAVE_SINCRONIZACAO = "mikeapps-sincronizacao-v1";

// Onde é que um delay ou um DSM ficam exatamente na sala é uma decisão do
// preview, não dos Calculadores — quem sabe a parede/coluna certa é quem está
// a olhar para a sala em 3D. Por isso este ajuste fica só cá, à parte do
// projeto que vem de lá, e não viaja de volta.
export const CHAVE_AJUSTES = "mikeapps-preview-ajustes-v1";

/**
 * Os ajustes de posição (delays, DSM, gomos, e agora também as instâncias
 * "Extra" de palco/régie/passarela/projetor -- ver PARA-CONTINUAR.md) que
 * ficaram guardados neste aparelho. Os quatro campos "Extra" são tolerantes
 * a ausência (ficheiros/estados antigos, de antes desta versão, não os
 * têm) -- nascem sempre `[]`, nunca `undefined`, para quem os usa não ter
 * de verificar sempre se existem.
 */
export function ajustesGuardados() {
  try {
    const bruto = localStorage.getItem(CHAVE_AJUSTES);
    const dados = bruto ? JSON.parse(bruto) : null;
    return {
      delays: (dados && typeof dados.delays === "object" && dados.delays) || {},
      dsm: (dados && Array.isArray(dados.dsm)) ? dados.dsm : [],
      gomos: (dados && Array.isArray(dados.gomos)) ? dados.gomos : [],
      palcosExtra: (dados && Array.isArray(dados.palcosExtra)) ? dados.palcosExtra : [],
      regiesExtra: (dados && Array.isArray(dados.regiesExtra)) ? dados.regiesExtra : [],
      passarelasExtra: (dados && Array.isArray(dados.passarelasExtra)) ? dados.passarelasExtra : [],
      projetoresExtra: (dados && Array.isArray(dados.projetoresExtra)) ? dados.projetoresExtra : [],
      // Nomes de zonas marcadas "sem leitura" (ecrã só visual/ambiente, não
      // entra na Cobertura) -- guardado por NOME, tal como ajustes.delays,
      // para sobreviver a um "Trazer projeto" novo dos Calculadores (que
      // substitui o array de zonas inteiro, mas não os nomes).
      zonasSemLeitura: (dados && Array.isArray(dados.zonasSemLeitura)) ? dados.zonasSemLeitura : [],
      // O último nome conhecido de cada zona, por id -- ver
      // reconciliarAjustesPorId() em app.js. É o que permite a uma zona
      // renomeada nos Calculadores levar consigo a arrumação feita aqui, sem
      // ter de mudar de chave tudo o que hoje trabalha por nome (o nome do
      // objecto 3D, o arrasto, o fazerZonas).
      nomePorId: (dados && typeof dados.nomePorId === "object" && dados.nomePorId) || {},
      // As peças que vieram dos Calculadores e ainda não foram montadas na
      // sala -- ver o depósito em app.js. A bandeira separa "depósito vazio
      // porque está tudo montado" de "ainda nunca corri com depósito", que é
      // o que impede um projeto antigo de aparecer todo por montar.
      noDeposito: (dados && Array.isArray(dados.noDeposito)) ? dados.noDeposito : [],
      depositoIniciado: !!(dados && dados.depositoIniciado)
    };
  } catch (e) {
    return { delays: {}, dsm: [], gomos: [], palcosExtra: [], regiesExtra: [], passarelasExtra: [], projetoresExtra: [], zonasSemLeitura: [], nomePorId: {}, noDeposito: [], depositoIniciado: false };
  }
}

/** Guarda os ajustes de posição — chamado sempre que se mexe num campo destes. */
export function guardarAjustes(ajustes) {
  try {
    localStorage.setItem(CHAVE_AJUSTES, JSON.stringify(ajustes));
  } catch (e) { /* sem localStorage a app funciona na mesma, só sem memória disto */ }
}

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
    return bruto ? lerProjetores(JSON.parse(bruto)) : [];
  } catch (e) {
    return [];
  }
}

function lerProjetorItem(d) {
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
      // Só as instâncias extra (Fase 6, blending) trazem isto -- a
      // instância #0 nunca traz posição, essa fica sempre a cargo de quem
      // está a olhar para a sala (ver aplicarProjetor()/aplicarProjetores()
      // em app.js: "a altura da lente é daqui, os Calculadores não a sabem").
      lateral: Number.isFinite(numero(d.lateral, NaN)) ? numero(d.lateral, 0) : null,
      alturaOffset: Number.isFinite(numero(d.alturaOffset, NaN)) ? numero(d.alturaOffset, 0) : null,
      quando: d.quando || null
    };
  } catch (e) {
    return null;
  }
}

/**
 * Um ou vários projetores -- pedido direto ("o 3D não está a trazer os
 * projetores do projeto... Blending Multi-Projetor nunca manda nada").
 * Aceita as duas formas que mikeapps-projetor-v1 já teve: {v:1, racio,
 * ...} (um só, como sempre) e {v:2, projetores:[...]} (a grelha toda do
 * Blending). Devolve sempre um array -- nunca null, [] quando não há nada
 * de aproveitável -- para quem o lê não ter de tratar os dois casos à
 * parte.
 */
export function lerProjetores(d) {
  if (!d || typeof d !== "object") return [];
  if (Array.isArray(d.projetores)) {
    return d.projetores.map(lerProjetorItem).filter(Boolean);
  }
  const um = lerProjetorItem(d);
  return um ? [um] : [];
}
