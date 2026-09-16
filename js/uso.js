// ---------------------------------------------------------------------------
// CONTAR QUANTOS, NUNCA QUEM — o lado do Preview
//
// O GitHub Pages não dá registos nenhuns. Até aqui só os Calculadores
// contavam, e por isso ninguém sabia se o 3D é usado por três pessoas ou por
// trinta — nem para que tipo de trabalho, que é a pergunta que decide o que
// se polir a seguir.
//
// A MESMA FICHA DOS CALCULADORES, DE PROPÓSITO. As duas apps vivem no mesmo
// domínio, portanto partilham o `localStorage`. O número deste aparelho
// (`id`) e o interruptor (`ligado`) ficam onde já estavam, à vista dos dois:
//
//   - o mesmo telemóvel é o MESMO aparelho nas duas apps, e não dois;
//   - desligar a contagem numa desliga nas duas, que é o que "não sai mais
//     nada daqui" quer dizer para quem carrega no interruptor;
//   - "esquecer o número" esquece-o para as duas.
//
// O que é de cada app é só o que ficou por enviar e o dia do último envio, e
// esses vivem cada um no seu canto da ficha. Os Calculadores continuam a ler
// e a escrever o que sempre leram (os campos `abas`/`ultimoEnvio` no topo);
// o Preview usa `preview: { abas, ultimoEnvio }`. Assim as duas versões
// podem andar desencontradas — e vão andar, são dois repositórios com dois
// service workers — sem nenhuma partir a outra.
//
// O QUE SAI DAQUI: o número aleatório, a versão, e nomes de momentos
// ("projeto", "dome", "blend", "exportar", "partilhar"). Mais nada. Nem uma
// medida, nem um nome de projeto, nem um ficheiro, nem sequer a hora — a data
// é a do relógio do Worker.
//
// E DIZ-SE QUE SE ESTÁ A CONTAR, na secção "O que esta app conta", com um
// interruptor que desliga mesmo.
// ---------------------------------------------------------------------------

// A ficha é a dos Calculadores. O nome fica como está mesmo do lado do
// Preview: mudá-lo era partir a ficha em duas e perder tudo o que ela resolve.
const USO_KEY = "calculadores-uso-v1";

// SEMPRE o Worker da AVK. Não se lê o campo editável do endereço do Worker
// (o do Assistente): quem o apontar a um Worker de testes não deve mandar a
// contagem para lá.
const USO_URL = "https://calculadores-assistente.avkvideoshare.workers.dev/uso";

const APP = "preview";

const hojeIso = () => new Date().toISOString().slice(0, 10);

function ler() {
  const vazio = { id: "", ligado: true, abas: [], enviadas: [], ultimoEnvio: "", bruto: {} };
  try {
    const texto = localStorage.getItem(USO_KEY);
    if (!texto) return vazio;
    const o = JSON.parse(texto) || {};
    const meu = (o[APP] && typeof o[APP] === "object") ? o[APP] : {};
    const ultimoEnvio = typeof meu.ultimoEnvio === "string" ? meu.ultimoEnvio : "";
    return {
      id: typeof o.id === "string" ? o.id : "",
      // A ausência lê-se como LIGADO, que é o estado de quem nunca mexeu --
      // a mesma regra dos Calculadores, e tem de ser a mesma: é o mesmo campo.
      ligado: o.ligado !== false,
      abas: Array.isArray(meu.abas) ? meu.abas : [],
      // O que já foi mandado HOJE. De ontem não serve para nada, e guardá-lo
      // faria um momento repetido amanhã parecer já contado.
      enviadas: (ultimoEnvio === hojeIso() && Array.isArray(meu.enviadas)) ? meu.enviadas : [],
      ultimoEnvio,
      bruto: o,
    };
  } catch (_) { return vazio; }
}

/**
 * Grava SEM deitar fora o que é dos Calculadores.
 *
 * Reescrever a ficha de raiz apagava o `abas`/`ultimoEnvio` deles e obrigava-
 * os a contar outra vez no mesmo dia. Parte-se do que lá está e mexe-se só no
 * que é nosso.
 */
function gravar(estado) {
  try {
    const o = (estado.bruto && typeof estado.bruto === "object") ? estado.bruto : {};
    o.id = estado.id;
    o.ligado = estado.ligado;
    o[APP] = { abas: estado.abas, enviadas: estado.enviadas, ultimoEnvio: estado.ultimoEnvio };
    localStorage.setItem(USO_KEY, JSON.stringify(o));
  } catch (_) {}
}

function numeroNovo() {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  // Sem randomUUID não se inventa um número fraco: fica sem id, e sem id não
  // se conta. Menos contagem é melhor do que uma contagem que finge ser o que
  // não é.
  return "";
}

export function usoLigada() { return ler().ligado; }

export function usoDefinirLigada(valor) {
  const o = ler();
  o.ligado = !!valor;
  if (!o.ligado) o.abas = [];   // desligar apaga o que estava por enviar
  gravar(o);
}

export function usoEsquecer() {
  const o = ler();
  o.id = "";
  o.ultimoEnvio = "";
  o.abas = [];
  o.enviadas = [];
  gravar(o);
}

/**
 * QUEM ABRE UM LINK DE SÓ VER NÃO É CONTADO.
 *
 * Um "Link para ver" abre com o painel escondido — portanto a secção que
 * explica a contagem e o interruptor que a desliga não existem para quem o
 * abriu. Contar aí era contar às escondidas alguém que nem tem como saber nem
 * como recusar, que é exactamente o contrário do que o interruptor promete.
 *
 * O preço é conhecido e aceita-se: não se fica a saber quantos clientes
 * abriram um link. A alternativa era contá-los sem lhes dizer.
 */
function soVisualizacao() {
  try { return document.body.classList.contains("modo-ver"); } catch (_) { return false; }
}

/** Marca um momento. Só acumula — quem envia é a usoEnviar(). */
export function usoMarcar(nome) {
  if (!nome || soVisualizacao()) return;
  const o = ler();
  if (!o.ligado) return;
  if (o.enviadas.indexOf(nome) !== -1) return;   // já foi hoje
  if (o.abas.indexOf(nome) === -1) { o.abas.push(nome); gravar(o); }
  usoEnviar();
}

/**
 * UMA VEZ POR DIA POR MOMENTO, e não uma vez por dia e ponto final.
 *
 * A regra dos Calculadores é "um envio por dia": o que aparecer depois fica
 * acumulado para amanhã. Aqui isso dava uma contagem falsa, e por uma razão
 * que só se vê com os momentos à frente: o envio de arranque sai 5 segundos
 * depois de a app abrir, e **exportar e partilhar acontecem sempre depois
 * disso**. Ficavam eternamente adiados -- e quem abrisse o Preview num dia só
 * nunca veria a exportação contada de todo. A coluna que mais interessa ("isto
 * chegou a produzir alguma coisa?") seria a única a mentir.
 *
 * Por isso guarda-se o que JÁ foi mandado hoje e manda-se de novo quando
 * houver coisa nova -- o Worker junta ao que já tinha desse aparelho nesse dia
 * (ver contarUso), que é precisamente para isto que ele foi feito. O tecto
 * continua baixo: são seis momentos ao todo, cada um contado uma só vez por
 * dia, portanto no máximo seis pedidos -- na prática dois ou três.
 */
export function usoEnviar() {
  if (soVisualizacao()) return;
  const o = ler();
  if (!o.ligado) return;
  const hoje = hojeIso();
  if (o.ultimoEnvio === hoje && !o.abas.length) return;   // nada de novo
  if (!o.id) {
    o.id = numeroNovo();
    if (!o.id) return;
    gravar(o);
  }
  const v = document.getElementById("versao");
  const corpo = JSON.stringify({
    app: APP,
    id: o.id,
    versao: v ? v.textContent.trim() : "",
    abas: o.abas.slice(0, 20),
  });
  // `keepalive` para o pedido sobreviver a quem fecha o separador logo a
  // seguir. Sem `await` em lado nenhum, e a falha é silenciosa de propósito:
  // num pavilhão sem rede — que é onde esta app mais serve — isto falha todos
  // os dias e não pode estorvar nada. Os momentos ficam acumulados para a
  // próxima vez que houver rede.
  try {
    fetch(USO_URL, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: corpo,
    }).then((r) => {
      if (!r || !r.ok) return;
      const d = ler();
      // Relê-se a ficha em vez de reaproveitar a de cima: entre o pedido sair
      // e a resposta chegar pode ter sido marcado outro momento, e escrever
      // por cima perdia-o.
      // O ler() já devolve `enviadas` vazio quando o último envio não foi
      // hoje, por isso não é preciso limpá-lo à mão na viragem do dia.
      const idas = o.abas;
      d.enviadas = [...new Set([...d.enviadas, ...idas])];
      d.abas = d.abas.filter((n) => idas.indexOf(n) === -1);
      d.ultimoEnvio = hoje;
      gravar(d);
    }).catch(() => {});
  } catch (_) {}
}

/**
 * O ARRANQUE TAMBÉM CONTA — mas não já.
 *
 * Cinco segundos, a mesma decisão dos Calculadores e pelas mesmas duas
 * razões: não pesar no arranque (o pedido sai muito depois do primeiro
 * desenho) e não contar um toque enganado que se fecha logo a seguir.
 *
 * Não leva nome de momento nenhum: abrir a app já conta como aparelho, porque
 * é a própria chave do Worker que carrega o dia, a app e o número. Os nomes
 * são para dizer o que se lá andou a fazer.
 */
export function usoArranque() {
  if (soVisualizacao()) return;
  if (!usoLigada()) return;
  setTimeout(usoEnviar, 5000);
}

/**
 * O que o projeto que está em cima da mesa é — não o que tem lá dentro.
 *
 * Chamada a cada projeto que entra. Como a usoMarcar() só acrescenta o que
 * ainda lá não estava, chamar isto de mais não faz mal nenhum.
 */
export function usoDoProjeto(projeto) {
  if (!projeto) return;
  usoMarcar("projeto");
  if (projeto.dome) usoMarcar("dome");
}

/** O interruptor e o "esquecer", na secção que explica isto tudo. */
export function ligarInterruptorDeUso(dizer) {
  const cb = document.getElementById("uso-ligado");
  if (cb) {
    cb.checked = usoLigada();
    cb.addEventListener("change", () => {
      usoDefinirLigada(cb.checked);
      if (dizer) dizer(cb.checked
        ? "Contagem ligada."
        : "Contagem desligada — não sai mais nada daqui.");
    });
  }
  const bt = document.getElementById("uso-esquecer");
  if (bt) {
    bt.addEventListener("click", () => {
      usoEsquecer();
      if (dizer) dizer("Número esquecido. A app passa a contar como nova.");
    });
  }
}
