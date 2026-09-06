// Falar com a IA — a mesma que os Calculadores usam.
//
// A primeira tentativa foi mandar o texto para os Calculadores e deixá-los
// analisar. Não funcionou na máquina do mike, e a razão é boa de saber: a app
// dele está INSTALADA, e uma janela de aplicação não se alcança com um
// `window.open` com nome. O texto chegava ao localStorage e ficava lá à espera
// de uma janela que nunca era a certa.
//
// Por isso a chamada faz-se aqui. Não é duplicar a conta dos Calculadores — o
// catálogo de LED, de projetores e de lentes continua todo do lado de lá. O que
// se partilha é o **endereço do Worker**, que os Calculadores já guardam no
// localStorage do mesmo domínio: quem o configurar uma vez, configurou-o para
// os dois.

const CHAVE_WORKER = "calculadores-assistente-worker-url";
// O mesmo endereço por omissão que está do lado dos Calculadores. É um
// endereço, não uma tabela: quando o mike mudar o Worker, muda-o lá e este lê-o
// do localStorage na mesma.
const WORKER_POR_OMISSAO = "https://calculadores-assistente.avkvideoshare.workers.dev";

export function enderecoDoWorker() {
  try {
    const guardado = (localStorage.getItem(CHAVE_WORKER) || "").trim();
    if (guardado) return guardado;
  } catch (_) { /* sem localStorage, fica o de sempre */ }
  return WORKER_POR_OMISSAO;
}

/**
 * Manda o texto do pedido e devolve os requisitos que a IA extraiu.
 *
 * A resposta é a mesma que o assistente dos Calculadores recebe — mesmo Worker,
 * mesmo formato — e aqui só se aproveita o que este desenho sabe mostrar: as
 * medidas do ecrã e as da sala. O resto (orçamento, tipo de ecrã, pontos por
 * confirmar) fica para quem tem as tabelas.
 */
export async function analisar(texto, sala) {
  // A sala que já está no desenho vai com o pedido. Sem isto, a IA lia só o
  // texto e devolvia estimativas suas por cima de medidas que alguém já tinha
  // escrito à mão -- e quem as escreveu ficava a olhar para números que não
  // eram os seus. É a diferença entre perguntar e adivinhar.
  const comSala = sala && sala.largura && sala.profundidade
    ? texto + "\n\n(Sala já definida no desenho: " +
      `${sala.largura} m de largura × ${sala.profundidade} m de profundidade` +
      (sala.altura ? ` × ${sala.altura} m de pé-direito` : "") + ".)"
    : texto;

  const resposta = await fetch(enderecoDoWorker(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: comSala })
  });

  let dados = null;
  try { dados = await resposta.json(); } catch (_) { /* resposta que não é JSON */ }
  if (!resposta.ok || !dados || !dados.requisitos) {
    throw new Error((dados && dados.error) ||
      `O assistente respondeu ${resposta.status}. Confirma o endereço do Worker nos Calculadores.`);
  }
  return dados.requisitos;
}

const PALAVRAS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
                   seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };

// Tira os acentos à mão, letra a letra, em vez de normalizar e filtrar
// caracteres combinantes por intervalo de código: essa segunda forma já
// corrompeu este ficheiro uma vez — o escape ficou gravado como os próprios
// caracteres combinantes, e um `[` colado a um combinante deixa de abrir a
// classe de caracteres que deveria. Isto é mais linhas, mas não tem essa
// armadilha.
const MAPA_ACENTOS = {
  "á": "a", "à": "a", "â": "a", "ã": "a", "ä": "a",
  "é": "e", "ê": "e", "è": "e",
  "í": "i", "î": "i",
  "ó": "o", "ô": "o", "õ": "o", "ö": "o",
  "ú": "u", "ü": "u",
  "ç": "c"
};
function semAcentos(texto) {
  let saida = "";
  for (const letra of texto) saida += MAPA_ACENTOS[letra] || letra;
  return saida;
}

/**
 * Quantos ecrãs o pedido menciona.
 *
 * A IA não devolve um número de ecrãs — mas escreve-o no resumo dela ("pedido
 * para colocar 4 ecrãs numa sala"), e já fez ali a soma que o texto original
 * espalha por duas frases ("dois para slides... mais dois para imagem"). Por
 * isso lê-se o resumo primeiro.
 */
export function quantosEcras(texto) {
  if (!texto) return 0;
  const limpo = semAcentos(String(texto).toLowerCase());
  const m = limpo.match(/(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:ecra|ecran|tela|painel|painei)/);
  if (!m) return 0;
  const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : (PALAVRAS[m[1]] || 0);
  return n >= 1 && n <= 12 ? n : 0;
}

const NUMERO_ESCRITO = "(\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)";
// Um número logo seguido de "ecrãs" (ou tela, painel): "2 ecrãs", "quatro painéis".
const COM_SUBSTANTIVO = new RegExp(NUMERO_ESCRITO + "\\s*(?:ecra|ecran|tela|painel|painei)\\w*", "g");
// A elipse: "dois maiores" sem repetir "ecrãs" — só conta se o adjectivo vier
// LOGO a seguir ao número, e não a três frases de distância.
const NUMERO_MAIS_ADJECTIVO = new RegExp(
  NUMERO_ESCRITO + "\\s+(?:maior|maiores|menor|menores|grande|grandes|pequen\\w*|mini|maximo)\\b", "g");
const ESCALA_MAIOR = /\b(maior|maiores|grande|grandes|maximo)\b/;
const ESCALA_MENOR = /\b(pequen\w*|menor|menores|mini)\b/;

/**
 * Os grupos de ecrãs que o pedido descreve.
 *
 * "Dois ecrãs para slides e dois maiores para imagem" são dois grupos, com
 * tamanhos diferentes — e desenhá-los todos iguais é ignorar metade do que foi
 * pedido. A IA não resolve isto: o esquema dela tem UM tamanho de ecrã, não tem
 * grupos. Por isso lê-se do texto, que é onde eles estão escritos.
 *
 * A primeira versão partia a frase em pedaços separados por vírgula/"e"/"mais",
 * e em cada pedaço procurava um número e um adjectivo. Partiu-se com um pedido
 * a sério: "Projeto com 4 ecrãs: 2 maiores para PowerPoint..." — o total "4
 * ecrãs" ficava colado ao "2 maiores" no mesmo pedaço (o `:` não é um sítio
 * onde a frase se parte), e um "maiores" de uma frase mais à frente ("se os
 * ecrãs maiores não couberem") contaminava um grupo que devia ser "menor".
 * Resultado: três grupos, doze ecrãs, tamanhos trocados.
 *
 * Agora cada grupo começa numa ÂNCORA — um "N ecrãs" ou um "N maiores/menores"
 * — e vive até à âncora seguinte. Um "N ecrãs:" logo antes de dois pontos é um
 * total que introduz uma repartição, não é ele próprio um grupo. E o adjectivo
 * só se procura na PRIMEIRA frase do grupo (até ao primeiro ponto final), para
 * uma frase mais à frente não contaminar o grupo anterior.
 */
export function gruposDeEcras(texto) {
  if (!texto) return [];
  const limpo = semAcentos(String(texto).toLowerCase());

  const ancoras = [];
  COM_SUBSTANTIVO.lastIndex = 0;
  let m;
  while ((m = COM_SUBSTANTIVO.exec(limpo))) {
    const aSeguir = limpo.slice(m.index + m[0].length, m.index + m[0].length + 3);
    if (/^\s*:/.test(aSeguir)) continue;   // "4 ecrãs:" é um total, não um grupo
    ancoras.push({ indice: m.index, texto: m[1] });
  }
  NUMERO_MAIS_ADJECTIVO.lastIndex = 0;
  while ((m = NUMERO_MAIS_ADJECTIVO.exec(limpo))) {
    // Só entra se não coincide com uma âncora já achada pelo substantivo —
    // "2 ecrãs maiores" não pode contar a dobro.
    if (!ancoras.some(a => Math.abs(a.indice - m.index) < 6)) {
      ancoras.push({ indice: m.index, texto: m[1] });
    }
  }
  if (!ancoras.length) return [];
  ancoras.sort((a, b) => a.indice - b.indice);

  const grupos = [];
  for (let i = 0; i < ancoras.length; i++) {
    const quantos = /^\d+$/.test(ancoras[i].texto)
      ? parseInt(ancoras[i].texto, 10) : (PALAVRAS[ancoras[i].texto] || 0);
    if (!(quantos >= 1 && quantos <= 12)) continue;

    const inicio = ancoras[i].indice;
    const fim = i + 1 < ancoras.length ? ancoras[i + 1].indice : limpo.length;
    const troco = limpo.slice(inicio, fim);
    // Só a primeira frase do grupo: o que vem depois de um ponto final já é
    // outro assunto, e um "maiores" ali não é deste grupo.
    const primeiraFrase = troco.split(/\.\s|\.$/)[0];

    // Meio maior, ou um terço mais pequeno: números redondos de propósito.
    // Isto é um esboço, não uma proposta — o que interessa é ver a diferença.
    let escala = 1;
    if (ESCALA_MAIOR.test(primeiraFrase)) escala = 1.5;
    else if (ESCALA_MENOR.test(primeiraFrase)) escala = 0.7;

    const para = (primeiraFrase.match(/\bpara\s+(?:a\s+|o\s+|as\s+|os\s+)?([\wçãáéíóúâêô-]{3,18})/) || [])[1] || "";
    grupos.push({ quantos, escala, para });
  }

  // Um grupo só, sem adjectivo, não é um grupo: é a contagem de sempre.
  if (grupos.length === 1 && grupos[0].escala === 1) return [];
  return grupos;
}

const numero = (v) => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Dos requisitos da IA para o que este desenho precisa.
 *
 * A sala é a parte que ninguém escreve à mão de bom grado: a IA lê "última fila
 * a treze metros" e "plateia com trinta de largura", e isso chega para pôr a
 * sala de pé. Junta-se uma folga à profundidade, porque a distância ao último
 * espectador não é a parede — há sempre uma passagem atrás.
 */
export function doQueVeioParaCa(r) {
  const saida = {
    sala: null, ecra: null,
    resumo: r && r.resumo ? String(r.resumo) : "",
    // O que a IA diz que falta saber. Num pedido vago é isto que vale mais do
    // que o desenho: e a lista de perguntas a fazer a quem pediu.
    perguntas: r && Array.isArray(r.pontosPorConfirmar)
      ? r.pontosPorConfirmar.map(String).slice(0, 8) : [],
    quantos: 0
  };
  saida.quantos = quantosEcras(saida.resumo);
  saida.grupos = [];
  if (!r) return saida;

  const d = r.dimensoes || {};
  const largura = numero(d.larguraM);
  const altura = numero(d.alturaM);
  if (largura && altura) saida.ecra = { largura, altura };
  else if (largura && numero(d.formato)) saida.ecra = { largura, altura: largura / numero(d.formato) };

  const local = r.local || {};
  const fundo = numero(local.distanciaVisualizacaoM);
  const plateia = numero(local.larguraPlateiaM);
  const alto = numero(local.alturaSalaM);
  if (fundo || plateia || alto) {
    saida.sala = {
      largura: plateia ? Math.round((plateia + 4) * 10) / 10 : null,   // 2 m de folga de cada lado
      profundidade: fundo ? Math.round((fundo + 3) * 10) / 10 : null,  // uma passagem atrás da última fila
      altura: alto || null,
      // O que a IA disse, sem folgas: é isto que se escreve no aviso, para
      // ninguém confundir o que ela leu com o que nós arredondámos.
      cru: { fundo, plateia, alto }
    };
  }
  return saida;
}
