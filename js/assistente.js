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
export async function analisar(texto) {
  const resposta = await fetch(enderecoDoWorker(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: texto })
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
  const limpo = String(texto).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  const m = limpo.match(/(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:ecr[ãa]|ecran|tela|painel|painei)/);
  if (!m) return 0;
  const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : (PALAVRAS[m[1]] || 0);
  return n >= 1 && n <= 12 ? n : 0;
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
