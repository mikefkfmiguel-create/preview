// Preview — ver um projeto dos Calculadores montado numa sala.

import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { EXEMPLO, FORMATO, lerProjeto, totais, projetoDoEndereco,
         projetoGuardado, guardarSala, projetorGuardado, projetorDoEndereco,
         CHAVE_PROJETO, CHAVE_PROJETOR, CHAVE_BRIEFING, CHAVE_DEVOLUCAO,
         CHAVE_SINCRONIZACAO, CHAVE_AJUSTES, idPartilhaDoEndereco,
         ajustesGuardados, guardarAjustes as persistirAjustes } from "./projeto.js";
import { fazerCena, fazerSala, fazerPalco, frenteDoPalco, fazerPalcoExtra, fazerPassarela, fazerPassarelaLivre, zonaDaPassarela, fazerZonas, fazerFigura, fazerPublico,
         fazerPublicoGomos,
         padraoDeTeste, texturaDaMarca, dataURLDeFicheiro, conteudoDeFicheiro, conteudoDeDataURL, fazerProjecao, pontosDaImagem,
         fazerPlanta, fazerPlantaCad, fazerRegie, fazerDSM, fazerConeCobertura, fazerDome,
         fazerCascaDeProjecao, pintarQuemTapa, medidasDaCupula,
         medidasDaCurva, fazerProjecaoCurva, fazerEcraCurvo,
         quemTapaOFeixe, marcarQuemTapa, mostrarFatiasDaCupula,
         marcaDaLente, marcaNoEcra, corDoProjetor } from "./cena.js";
import { lerDXF, metrosPorUnidade } from "./dxf.js";
import { comoDXF, paraPlanta, DESENHO } from "./dxf-saida.js";
import { lerDWG, lerPDF } from "./importar.js";
import { analisar, doQueVeioParaCa, quantosEcras, gruposDeEcras } from "./assistente.js";
import { criarLinkPartilha, lerLinkPartilha } from "./partilha.js";
import { prepararParaExportar, comoGLB, comoOBJ, descarregar, pesar } from "./exportar.js";
import { paginaDeRelatorio } from "./relatorio.js";
import { usoArranque, usoMarcar, usoDoProjeto, ligarInterruptorDeUso } from "./uso.js";

const $ = (id) => document.getElementById(id);
const tela = $("tela");

// preserveDrawingBuffer: sem isto o browser pode limpar o canvas antes de o
// copiarmos, e a imagem guardada sai preta.
const renderizador = new THREE.WebGLRenderer({ canvas: tela, antialias: true,
                                              preserveDrawingBuffer: true });
renderizador.setPixelRatio(Math.min(devicePixelRatio, 2));

const camara = new THREE.PerspectiveCamera(52, 1, 0.05, 400);
// Os 52° servem uma sala vista de fora. Dentro de uma cúpula não servem: a
// superfície está a três ou quatro metros da cara e o enquadramento fica
// encostado à casca, sem se ver a forma nem a repartição pelos projetores.
// Uma cúpula vê-se com visão periférica -- daí a vista de dentro abrir o
// campo, e voltar aos 52 em qualquer outra.
const FOV_NORMAL = 52;
const FOV_DENTRO_DA_CUPULA = 88;
const cena = fazerCena();
const controlos = new OrbitControls(camara, tela);
controlos.enableDamping = true;
controlos.dampingFactor = 0.08;
// Nada de limitar o ângulo: um espectador sentado olha PARA CIMA, e um limite
// de "nunca abaixo do alvo" empurrava a câmara da vista dos olhos para os 3,5 m
// de altura -- ou seja, dava a vista de quem está de pé num primeiro andar.
// Quem impede de furar o chão é o travão de altura no laço, mais abaixo.

let projeto = null;
// Ligado quando o endereço traz um "#ver=<id>" -- um link "🔗 Link para ver"
// criado por outra pessoa. Esconde o painel todo e desliga a edição livre à
// força (ver edicaoLivreLigada() mais abaixo): quem abre isto só olha, nunca
// edita -- mesmo que o cadeado tenha ficado "aberto" de uma sessão anterior
// NESTE aparelho (edicaoLivreLigada() lê o localStorage, que não sabe nada
// de "isto é um link partilhado").
let modoVisualizacao = false;
let etiquetas = [];
let olhosDaPlateia = null;
let desenhado = null;      // o que está na cena agora, para se poder deitar fora
let textura = null;        // o conteúdo a mostrar nos ecrãs (e nos DSM), se houver
// O data URL por trás de "textura" -- só quando veio de um ficheiro escolhido
// pelo mike (texturaDeFicheiro/ficheiroImagem). É isto, não a THREE.Texture
// em si (que não sobrevive a um JSON.stringify), que viaja no "Guardar
// projeto"/link partilhado -- ver estadoCompleto()/abrirProjetoTodo(). Fica
// null com o padrão de teste (regenera-se sozinho, não precisa de viajar) ou
// sem conteúdo nenhum.
let texturaDataURL = null;
let modoConteudo = "espalhado";   // espalhado pelo conjunto, ou um em cada zona
// Imagem PRÓPRIA de um ecrã, por nome da zona -- sobrepõe-se a "textura" só
// nesse ecrã. Pedido direto: "poder por uma imagem em cada ecrã" (diferente
// entre eles, não a mesma repetida -- isso já era "Uma em cada" acima).
let texturasPorZona = {};
// O par de texturasPorZona que viaja no "Guardar projeto" -- mesma razão de
// texturaDataURL acima (o data URL, não o objeto Texture vivo).
let texturasPorZonaDataURL = {};
let planta = null;         // a planta em imagem, se alguem a tiver aberto
// O data URL dessa imagem, a par da textura -- mesma regra das imagens dos
// ecrãs: uma THREE.Texture não sobrevive a um JSON.stringify, e é isto que
// viaja no "Guardar projeto". Ver plantaGuardada().
let plantaDataURL = null;
let plantaCad = null;      // a planta em DXF, que ja vem a escala
const camadasEscondidas = new Set();   // camadas da planta que nao se veem
const camadasLevantadas = new Set();   // camadas que sobem do chao, como paredes
let projecaoAtual = null;  // a lente e a imagem de agora, para medir a sombra
let ondeEsta = null;       // onde o orador foi posto à mão, se foi
// A pessoa da cúpula tem a posição DELA: são dois bonecos com regras
// diferentes, e uma posição partilhada punha um no sítio do outro.
let ondeEstaNaDome = null;
// A ficha de montagem dos projetores de ecrã plano (o da projeção e os do
// blend), enchida por quem os desenha -- ver escreverCoordenadas().
let montagemProjetores = [];
// Quando a distância escrita não cabe dentro do raio da curva, guarda-se aqui
// o valor a que foi limitada -- para a nota das coordenadas o poder dizer, em
// vez de o desenho mudar calado (ver desenharBlendCurvo()).
let distanciaDaFilaLimitada = null;
// Quanta luz, em metros de arco, está a cair ao lado do ecrã curvo -- ver
// desenharBlendCurvo(), onde as fatias são cortadas ao tamanho da superfície.
let luzForaDoEcra = 0;
// Máquinas cujo feixe já não encontra o pano nenhum -- só acontece com o ecrã
// movido sem elas (ver desenharBlendCurvo()). Não se desenha o que não existe,
// mas também não se cala: uma máquina que desaparece do 3D sem explicação é
// pior do que uma máquina no sítio errado.
let maquinasForaDoPano = 0;
// Os feixes da fila do blend, recolhidos enquanto se desenham -- ver
// quemTapaOFeixe() em cena.js. Reposto a cada montagem, como tudo o resto.
let feixesDoBlend = [];
// Quantas pessoas estão no caminho da luz, e quantas máquinas apanham.
let tapamOBlend = null;
let domeMontado = null;    // a cúpula desta montagem, para saber quem ela tapa
let corposDoPublico = null;// uma caixa por pessoa, para a sombra
let ultimaCobertura = null;// o último cálculo de cobertura, para os testes
let limitesDoShift = null; // até onde a lente escolhida faz shift, se se souber
// Onde é que um delay ou um DSM ficam de verdade na sala -- decisão só do
// preview, guardada neste aparelho (ver CHAVE_AJUSTES em projeto.js).
let ajustes = ajustesGuardados();

// A preferência é partilhada com os Calculadores (mesma chave), mas eles
// gravam-na com JSON.stringify — o valor real em localStorage fica
// `"desligada"`, ASPAS INCLUÍDAS, não `desligada`. Uma comparação direta
// contra a string em bruto nunca batia com o que os Calculadores escrevem,
// e o Preview ficava sempre a pensar que a sincronização estava ligada,
// mesmo depois de alguém a desligar do outro lado — dava dois interruptores
// a mostrar coisas diferentes, e o auto-sync a continuar a aplicar mudanças
// que já deviam ter parado. Tenta descodificar como JSON primeiro (o que os
// Calculadores gravam); se não for JSON válido (o que o Preview grava
// sozinho, em bruto), usa o valor tal como está — os dois lados leem-se um
// ao outro corretamente, e qualquer um dos dois formatos continua a servir.
// Já se disse a esta pessoa que a sincronização passou a nascer desligada? Uma
// vez chega, e a chave é partilhada com os Calculadores: quem abrir primeiro
// avisa, o outro fica calado.
const CHAVE_AVISO_SINC = "mikeapps-sincronizacao-aviso-v1";

/**
 * DESLIGADA POR OMISSÃO, desde a v3.50 deste lado.
 *
 * Pedido: *"abre sempre dos dois lados com o sync desligado e em projeto limpo
 * até eu abrir um"*. Antes, a ausência da chave lia-se como LIGADA -- e uma
 * app que começa a receber e a devolver coisas sem ninguém pedir é o contrário
 * do que se quer de manhã, no terreno.
 */
function sincronizacaoAutomaticaLigada() {
  let bruto;
  try { bruto = localStorage.getItem(CHAVE_SINCRONIZACAO); } catch (_) { return false; }
  if (bruto == null) return false;
  let valor = bruto;
  try {
    const interpretado = JSON.parse(bruto);
    if (typeof interpretado === "string") valor = interpretado;
  } catch (_) { /* não era JSON — fica o valor em bruto */ }
  return String(valor).trim().toLowerCase() !== "desligada";
}

function atualizarBotaoSincronizacao() {
  const botao = $("btSincronizacao");
  if (!botao) return;
  const ligada = sincronizacaoAutomaticaLigada();
  botao.classList.toggle("desligado", !ligada);
  // Os mesmos dois ícones que os Calculadores já usam no botão deles ("🔗
  // Auto: ligada" / "⛔ Auto: desligada") — antes disto o botão aqui era
  // sempre o mesmo "↔", só a mudar de cor, o que é fácil de não reparar
  // (e ainda mais fácil de confundir com o "🔄 Sincronizar" ao lado, que é
  // uma ação e não um interruptor). O ícone a mudar a sério é o sinal.
  botao.textContent = ligada ? "🔗" : "⛔";
  botao.title = ligada
    ? "Sincronização automática ligada — o que mudar nos Calculadores chega sozinho aqui. Clica para desligar."
    : "Sincronização automática desligada — nada chega sozinho. \"🔄 Sincronizar\" ao lado continua a funcionar. Clica para ligar.";
}

// ------------------------------------------------------------------ leituras

const num = (id) => parseFloat($(id).value) || 0;

function lerSala() {
  return { largura: num("salaL"), profundidade: num("salaP"), altura: num("salaA") };
}
function lerPalco() {
  return { largura: num("palcoL"), altura: num("palcoA"),
           profundidade: num("palcoP"), acimaDoPalco: num("ecraOffset"),
           // Onde o palco está na sala. Até aqui nascia sempre encostado ao
           // fundo e centrado; com uma planta por baixo é preciso pô-lo onde
           // ela manda -- ver frenteDoPalco() em cena.js, que é de onde sai
           // tudo o que anda agarrado a ele.
           dx: num("palcoX"), dz: num("palcoZ"),
           // Só o desenho: o raio não entra em conta nenhuma (ecrã, ângulos,
           // cobertura continuam a usar a medida cheia do palco).
           raio: num("palcoR") };
}
let formatoImagem = 1.777;

function lerProjecao() {
  return {
    ligada: $("projLigada").checked,
    racio: num("projRacio"),
    distancia: num("projDist"),
    altura: num("projAltura"),
    lateral: num("projLateral"),
    // O shift conta-se em percentagem da IMAGEM, como nas fichas das lentes:
    // +100% vertical poe a imagem toda acima do eixo da lente.
    shiftV: num("projShiftV") / 100,
    shiftH: num("projShiftH") / 100
  };

}

function lerPublico() {
  return {
    filas: Math.round(num("filas")),
    primeiraFila: num("primeiraFila"),
    entreFilas: num("entreFilas"),
    entreLugares: num("entreLugares"),
    corredores: Math.round(num("corredores")),
    inclinacao: num("inclinacao"),
    larguraCorredor: num("larguraCorredor"),
    sentado: $("sentado").checked,
    // "Circular": a plateia parte-se em N blocos iguais ao de "Reto" (gomos),
    // cada um deslocado/rodado à mão -- ver fazerPublicoGomos() em cena.js,
    // ajustesDeGomosGarantidos() aqui e a nota em PARA-CONTINUAR.md sobre o
    // que ainda falta (palco central de verdade).
    formato: $("formatoPlateia").dataset.valor || "reto",
    gomos: Math.max(1, Math.min(12, Math.round(num("gomos")) || 3)),
    // Um número de lugares por fila para cada bloco (vazio = automático, como
    // sempre foi), e as filas depois das quais entra um corredor horizontal.
    lugaresPorBloco: lerLugaresPorBloco(),
    corredoresHorizontais: lerCorredoresHorizontais(),
    excecoesDeLugares: lerExcecoesDeLugares()
  };
}

// ------------------------------------------------- filas com nome, e cortes
//
// Pedido: *"marca os lugares com números e letras, para escolher a
// encruzilhada"*. A fila A é a da frente. Depois do Z segue AA, AB... -- uma
// sala de congressos passa dos 26 sem esforço, e "fila 27" não é um nome.
function letraDaFila(indice) {
  let n = Math.max(0, Math.round(indice)), nome = "";
  do { nome = String.fromCharCode(65 + (n % 26)) + nome; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return nome;
}

/** "H" -> 7, "AA" -> 26. Aceita minúsculas e espaços, que é como se escreve. */
function filaDaLetra(texto) {
  const limpo = String(texto || "").trim().toUpperCase();
  if (!/^[A-Z]+$/.test(limpo)) return null;
  let n = 0;
  for (const c of limpo) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * As etiquetas da plateia: a letra de cada fila nas duas pontas, e os números
 * dos lugares nas filas onde a numeração se confere -- a primeira, e a que
 * nasce logo a seguir a cada corredor horizontal.
 *
 * A altura sai do chão da plateia mais o que ela já subiu nessa fila, para as
 * etiquetas acompanharem a inclinação em vez de ficarem todas no mesmo plano.
 */
function etiquetasDeLugares(gente, publico, chao) {
  const saida = [];
  const filas = gente.filasInfo, blocos = gente.blocosInfo;
  const passo = gente.entreLugares || publico.entreLugares || 0.55;
  const esquerda = blocos.length ? blocos[0].x0 : 0;
  const direita = blocos.length ? blocos[blocos.length - 1].x1 : 0;
  const cortes = new Set(gente.cortesHorizontais || []);

  filas.forEach((fila) => {
    const y = chao + (fila.sobe || 0) + 0.25;
    const letra = letraDaFila(fila.indice);
    // Nas duas pontas: de um lado ou do outro da sala, a fila tem sempre nome
    // à vista -- e as duas pontas são o que uma planta impressa também leva.
    saida.push({ texto: letra, ponto: new THREE.Vector3(esquerda - passo, y, fila.z) });
    saida.push({ texto: letra, ponto: new THREE.Vector3(direita + passo, y, fila.z) });
  });

  // As filas que levam números: a primeira de todas, e a primeira depois de
  // cada corredor. É onde alguém em pé no corredor consegue mesmo conferir.
  const comNumeros = [0];
  cortes.forEach((c) => { if (c + 1 < filas.length) comNumeros.push(c + 1); });
  comNumeros.forEach((iFila) => {
    const fila = filas[iFila];
    if (!fila) return;
    const y = chao + (fila.sobe || 0) + 0.25;
    blocos.forEach((b) => {
      // O primeiro e o último lugar do bloco chegam: com estes dois na ponta,
      // os do meio contam-se com o dedo. Marcar os 20 de um bloco era voltar
      // a encher o ecrã de números.
      const ultimo = b.primeiroLugar + b.lugares - 1;
      saida.push({ texto: String(b.primeiroLugar),
                   ponto: new THREE.Vector3(b.x0 + passo * 0.5, y, fila.z) });
      if (b.lugares > 1) {
        saida.push({ texto: String(ultimo),
                     ponto: new THREE.Vector3(b.x1 - passo * 0.5, y, fila.z) });
      }
    });
  });
  return saida;
}

function lerLugaresPorBloco() {
  const caixa = $("lugaresPorBloco");
  if (!caixa) return [];
  return [...caixa.querySelectorAll("input")].map((el) => {
    const v = Math.round(Number(el.value));
    return v > 0 ? v : null;         // null = automático, pela largura
  });
}

/**
 * "H, P" -> [7, 15]. O campo fala em letras porque é assim que se escolhe a
 * encruzilhada a olhar para a plateia; por dentro guardam-se índices.
 */
/**
 * AS FILAS QUE FOGEM À REGRA DO BLOCO.
 *
 * Pedido a olhar para uma plateia desenhada: *"se quiser ter números
 * diferentes de lugares por fila"*, e logo com o caso a sério: *"na imagem a
 * fila A tem apenas 5 lugares nas margens"*.
 *
 * A forma foi escolha dele, entre quatro: por BLOCO e por FILA. Escreve-se
 * como se diz -- "bloco 1 e 3, fila A: 5 lugares" -- e cada excepção vive na
 * sua linha:
 *
 *     1,3: A = 5
 *     2: A-C = 14
 *
 * O que se aceita é folgado de propósito, porque isto escreve-se à pressa: os
 * blocos podem vir "1,3" ou "1-3"; as filas "A" ou "A-F"; o "=" e a palavra
 * "bloco" são opcionais. O que NÃO se aceita é uma linha meia percebida --
 * uma linha que não encaixe é ignorada por inteiro, e a app di-lo (ver o aviso
 * em montar()). Adivinhar o que ali estaria era mudar a lotação de uma sala
 * por um palpite.
 *
 * A ordem conta: a ÚLTIMA linha que apanhar o par bloco/fila é a que manda.
 * Assim escreve-se a regra larga primeiro e a excepção dela a seguir, como se
 * fala. Ver porBlocoNaFila() em js/cena.js, que é quem as aplica.
 */
/** Uma linha de excepção, lida. Devolve null quando não se percebe. */
function lerUmaExcecao(linha) {
  const limpa = String(linha || "").trim();
  if (!limpa) return null;
  // <blocos> : <filas> [=] <lugares>
  const m = limpa.match(/^(?:blocos?\s*)?([\d\s,\-–]+?)\s*[:.]\s*(?:filas?\s*)?([A-Za-z]+)(?:\s*(?:-|–|a|até)\s*([A-Za-z]+))?\s*[:=]?\s*(\d+)\s*(?:lugares?)?$/);
  if (!m) return null;
  const blocos = [];
  m[1].split(/[,\s]+/).forEach((pedaco) => {
    const intervalo = pedaco.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (intervalo) {
      const a = parseInt(intervalo[1], 10), b = parseInt(intervalo[2], 10);
      for (let k = Math.min(a, b); k <= Math.max(a, b); k++) blocos.push(k - 1);
    } else if (/^\d+$/.test(pedaco)) {
      blocos.push(parseInt(pedaco, 10) - 1);
    }
  });
  const de = filaDaLetra(m[2]);
  const ate = m[3] ? filaDaLetra(m[3]) : de;
  const usaveis = blocos.filter((b) => b >= 0);
  if (!usaveis.length || de == null || ate == null) return null;
  return { blocos: usaveis, de: Math.min(de, ate), ate: Math.max(de, ate),
           lugares: parseInt(m[4], 10) };
}

/** As linhas escritas no campo, como estão. */
function linhasDeExcecoes() {
  const el = $("excecoesLugares");
  if (!el) return [];
  return String(el.value || "").split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
}

function lerExcecoesDeLugares() {
  return linhasDeExcecoes().map(lerUmaExcecao).filter(Boolean);
}

/** E as que não se perceberam, para a app as poder dizer em vez de as comer. */
function excecoesQueNaoSePerceberam() {
  return linhasDeExcecoes().filter((l) => !lerUmaExcecao(l));
}

function lerCorredoresHorizontais() {
  const el = $("corredoresHorizontais");
  if (!el) return [];
  return String(el.value || "").split(/[,;\s]+/)
    .map(filaDaLetra)
    .filter((v) => v != null);
}

function lerRegie() {
  return {
    largura: Math.max(2, num("regieL") || 2),
    profundidade: Math.max(2, num("regieP") || 2),
    x: num("regieX"), z: num("regieZ"),
    rodar: num("regieR")
  };
}

function lerPassarela() {
  return {
    ligada: $("passLigada").checked,
    largura: Math.max(0.5, num("passL") || 1.5),
    comprimento: Math.max(0, num("passC") || 0),
    dx: num("passX")
  };
}

// Em que degrau do auditório cai a régie, dada a profundidade a que ela está.
// É a mesma conta que fazerPublico faz fila a fila (zPrimeira + f*entreFilas),
// só que ao contrário: dada uma profundidade, que fila é essa. Sem isto a
// régie ficava sempre ao nível do chão, e num auditório a subir isso é ficar
// meio enterrada dentro do degrau em vez de assentar em cima dele.
//
// O tecto da fila não é só o número pedido no campo "filas" -- fazerPublico
// pára mais cedo se a sala não tiver profundidade para todas (a mesma margem
// dos corredores lá atrás). Usar só publico.filas-1 aqui dava um degrau a
// mais nesse caso: a régie subia para uma fila que nem chega a ser desenhada.
function elevacaoDaRegie(sala, palco, publico, z) {
  if (!publico.filas || !publico.inclinacao) return 0;
  const margemLateral = publico.larguraCorredor || 1.2;
  const zPrimeira = -sala.profundidade / 2 + palco.profundidade + publico.primeiraFila;
  const zUltimaPossivel = sala.profundidade / 2 - margemLateral;
  const ultimaFilaQueCabe = Math.max(0, Math.floor((zUltimaPossivel - zPrimeira) / publico.entreFilas));
  const tecto = Math.min(publico.filas - 1, ultimaFilaQueCabe);
  const fila = Math.round((z - zPrimeira) / publico.entreFilas);
  const filaLimitada = Math.max(0, Math.min(tecto, fila));
  return filaLimitada * publico.inclinacao;
}

// -------------------------------------------------------------------- montar

function limpar(grupo) {
  grupo.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
  cena.remove(grupo);
}

/**
 * A REDE DE SEGURANÇA DO DESENHO.
 *
 * O montar() começa por DEITAR FORA o grupo que estava na cena e só o volta a
 * entregar (`cena.add(desenhado)`) lá no fim, umas quatrocentas linhas
 * abaixo. Entre uma coisa e a outra, um erro em qualquer linha deixava o ecrã
 * PRETO -- sem sala, sem ecrãs, sem palco, sem plateia -- e sem uma palavra a
 * dizer porquê. Foi o que a v3.51 fez em todos os projetos com projetores e
 * sem cúpula (ver recadoDasFatias): a app parecia morta e o painel continuava
 * a responder, que é a pior combinação possível no terreno.
 *
 * Aqui entrega-se o que já estava desenhado ATÉ AO PONTO DO ERRO e diz-se o
 * que aconteceu. Meia cena com um recado é melhor do que uma cena vazia em
 * silêncio -- e é essa a regra da casa.
 *
 * Isto NÃO substitui corrigir a causa: é a segunda linha de defesa, para o
 * próximo erro não voltar a apagar a app inteira.
 *
 * E APANHAR O ERRO NÃO PODE SER O MESMO QUE ESCONDÊ-LO. Com este try/catch, um
 * erro deixa de chegar ao `pageerror` do browser -- ou seja, a rede de
 * segurança tapava a vista ao teste que existe precisamente para encontrar
 * isto. Por isso fica registado em `window.__errosDeDesenho`, que é o que o
 * scripts/verificar-cena.mjs vai ler.
 */
function montar(recentrarCamara) {
  try {
    desenharCena(recentrarCamara);
  } catch (erro) {
    if (desenhado && !desenhado.parent) cena.add(desenhado);
    (window.__errosDeDesenho || (window.__errosDeDesenho = []))
      .push((erro && erro.stack) || String(erro));
    console.error("montar()", erro);
    const aviso = $("aviso");
    aviso.textContent = "Alguma coisa correu mal a desenhar a cena (" +
      ((erro && erro.message) || erro) + "). O que está à vista pode estar " +
      "incompleto — o resto do projeto não se perdeu.";
    aviso.classList.add("mostra");
  }
}

function desenharCena(recentrarCamara) {
  // O aviso apaga-se sempre no princípio e volta a escrever-se quem tiver
  // razão para isso. Antes a limpeza vivia dentro da verificação que só corre
  // com um projeto carregado: sem zonas, um aviso antigo ficava para sempre no
  // ecrã, a falar de filas que já ninguém tinha pedido.
  $("aviso").classList.remove("mostra");
  if (desenhado) limpar(desenhado);
  desenhado = new THREE.Group();
  etiquetas = [];
  olhosDaPlateia = null;

  // Nome do projeto sempre à vista na cena, painel aberto ou não — pedido
  // direto (ver #nomeProjetoViewport, css/estilo.css). "hidden" (não só
  // texto vazio) para não deixar uma caixa às riscas por cima da cena
  // quando não há projeto nenhum.
  const nomeViewport = $("nomeProjetoViewport");
  if (nomeViewport) {
    const nome = projeto && projeto.nome ? String(projeto.nome) : "";
    // Num link partilhado o painel está escondido -- é aqui, e só aqui, que
    // quem o abriu percebe que está só a ver, não a editar.
    const texto = modoVisualizacao ? (nome ? nome + " · só visualização" : "Só visualização") : nome;
    nomeViewport.textContent = texto;
    nomeViewport.hidden = !texto;
    // De onde veio isto e com que versão -- só ao passar o rato, para não
    // sujar a cena com mais texto. Pedido direto: dar para perceber, ao
    // olhar para um projeto estranho, se veio de uma versão antiga dos
    // Calculadores ou do Preview, sem ter de abrir o ficheiro à mão.
    if (projeto && projeto.origem) {
      const app = projeto.origem === "calculadores" ? "Calculadores"
        : projeto.origem === "preview" ? "Preview" : "colado";
      nomeViewport.title = app + (projeto.origemVersao ? " " + projeto.origemVersao : "");
    } else {
      nomeViewport.removeAttribute("title");
    }
  }

  // O campo "Nome do projeto" no painel -- pedido direto: "quando gravo no
  // 3D não fica o nome que lhe dei no ficheiro, ou tenho dentro dele onde
  // por?". Não havia onde -- o nome só vinha de fora (Calculadores/link),
  // sem forma de o pôr ou mudar aqui mesmo. Não mexe no campo enquanto a
  // pessoa está a escrever nele (haveria de lhe fugir o cursor a cada
  // remontar).
  const campoNome = $("nomeProjeto");
  if (campoNome && document.activeElement !== campoNome) {
    campoNome.value = projeto && projeto.nome ? projeto.nome : "";
  }

  const sala = lerSala();
  const palco = lerPalco();
  const publico = lerPublico();
  const passarela = lerPassarela();

  desenhado.add(fazerSala(sala, $("verMedidas").checked, $("verParedes").checked));
  const verPlanta = $("verPlanta").checked;
  if (plantaCad && verPlanta) {
    desenhado.add(fazerPlantaCad(plantaCad, {
      fator: metrosPorUnidade(plantaCad, $("plantaU").value).fator,
      rodar: num("plantaR"), x: num("plantaX"), z: num("plantaZ"),
      opacidade: Math.min(1, Math.max(0.05, num("plantaO"))),
      escondidas: camadasEscondidas,
      levantadas: camadasLevantadas,
      altura: num("alturaParedes")
    }));
  }
  if (planta && verPlanta) {
    desenhado.add(fazerPlanta(planta, {
      largura: num("plantaL"), rodar: num("plantaR"),
      x: num("plantaX"), z: num("plantaZ"),
      opacidade: Math.min(1, Math.max(0.05, num("plantaO")))
    }));
  }
  // O palco desliga-se como o resto: numa sala onde o ecrã assenta no chão, o
  // palco por omissão é uma caixa a mentir sobre a altura de tudo o que está
  // em cima dela.
  if ($("verPalco").checked) {
    desenhado.add(fazerPalco(sala, palco));
    if (passarela.ligada) desenhado.add(fazerPassarela(sala, palco, passarela));
    // Palcos extra (2º, 3º, ...) são só visuais -- nenhum ecrã nem conta de
    // ângulo/cobertura se agarra a eles, ver fazerPalcoExtra() em cena.js.
    ajustes.palcosExtra.forEach((pe, i) => {
      const grupoExtra = fazerPalcoExtra(pe);
      grupoExtra.name = "palco-" + (i + 1);
      desenhado.add(grupoExtra);
    });
  }

  // A cúpula, quando o projeto trouxer uma dos Calculadores (aba Dome, com
  // "Adicionar ao projeto" marcado). Os dois interruptores só aparecem
  // quando ela existe -- ver fazerDome() em cena.js para a geometria e para
  // a razão de ser translúcida por omissão.
  domeMontado = null;
  const domeDoProjeto = (projeto && projeto.dome) ? projeto.dome : null;
  ["verDomeWrap", "domeSolidoWrap", "verFatiasWrap", "verPessoaDomeWrap",
   "btVistaDome", "saidasDome"].forEach((id) => {
    if ($(id)) $(id).style.display = domeDoProjeto ? "" : "none";
  });
  // Onde fica o ecrã curvo — dois campos que só fazem sentido quando há um.
  if ($("curvaPosicaoWrap")) {
    $("curvaPosicaoWrap").style.display = curvaAtivaDoBlend() ? "" : "none";
    if ($("curvaLevaNota")) {
      const leva = !$("curvaLevaProjetores") || $("curvaLevaProjetores").checked;
      $("curvaLevaNota").textContent = leva
        ? "Move-se a montagem toda: a imagem fica igual, só muda de sítio na sala."
        : "O pano vai sozinho e as máquinas ficam onde estão — é assim que se vê onde o feixe passa a bater.";
    }
  }
  // A secção das coordenadas aparece com projetores de cúpula OU de ecrã
  // plano -- a projeção simples e o blend contam, e é o próprio desenho deles
  // que enche a tabela mais abaixo.
  if ($("sCoordenadas")) {
    const temCupulaComProjetores = !!(domeDoProjeto && domeDoProjeto.projetores &&
                                      domeDoProjeto.projetores.n > 0);
    const proj = lerProjecao();
    const temPlanos = !!(proj.ligada && proj.racio > 0 && proj.distancia > 0);
    $("sCoordenadas").style.display = (temCupulaComProjetores || temPlanos) ? "" : "none";
  }
  // E ao contrário: num projeto que é SÓ cúpula, o orador do palco sai da
  // lista. Quem dá a medida lá dentro é a pessoa da cúpula, e um interruptor
  // ligado que não põe ninguém à vista lê-se como defeito.
  const soCupula = cupulaSemZonas();
  if ($("verOradorWrap")) $("verOradorWrap").style.display = soCupula ? "none" : "";
  if (domeDoProjeto && $("verDome") && $("verDome").checked) {
    // As fatias desligam-se: num anel de dez são dez manchas, e para olhar
    // para a forma da cúpula ou para o público convém tirá-las da frente.
    const comFatias = !$("verFatias") || $("verFatias").checked;
    const domeParaDesenhar = comFatias
      ? domeDoProjeto
      : { ...domeDoProjeto, projetores: domeDoProjeto.projetores ? { ...domeDoProjeto.projetores, semFatias: true } : null };
    const grupoDome = fazerDome(domeParaDesenhar, $("domeSolido") && $("domeSolido").checked, textura);
    desenhado.add(grupoDome);
    domeMontado = grupoDome;
    // As fatias apagadas uma a uma (ver mostrarFatiasDaCupula em cena.js).
    // Reaplica-se a cada montagem porque a cúpula é desenhada de novo de cada
    // vez, e a escolha tem de sobreviver a isso.
    mostrarFatiasDaCupula(grupoDome, ajustes.fatiasEscondidas);
  }

  // Passarelas soltas (2ª, 3ª, ...) -- ao contrário da que sai do palco,
  // não estão presas a nada nem dependem de "Ver palco": têm posição e
  // rotação próprias, decisão já tomada com o mike ("preciso ter como
  // criar mais do que um... passarela"). Existem sempre que estiverem na
  // lista, sem interruptor à parte.
  ajustes.passarelasExtra.forEach((pl, i) => {
    const grupoExtra = fazerPassarelaLivre(pl);
    grupoExtra.name = "passarela-" + (i + 1);
    desenhado.add(grupoExtra);
  });

  // A régie entra ANTES do público, porque é o público que precisa de saber
  // onde ela está para lhe deixar o vão. Isto ia ficar reservado mesmo com a
  // régie escondida — parecia mais correcto, "o espaço existe sempre" — mas
  // na prática ninguém consegue comparar "com" e "sem" régie assim: o
  // interruptor tem de ser um interruptor a sério, como todos os outros
  // desta lista, e não uma opção que só esconde o desenho.
  const verRegie = $("verRegie").checked;
  const regie = verRegie ? lerRegie() : null;
  // Régies extra (2ª, 3ª, ...) seguem o mesmo interruptor -- sem a régie
  // principal ligada não faz sentido nenhuma delas existir sozinha. Cada
  // uma abre o seu próprio vão na plateia, tal como a principal (ver o loop
  // novo em fazerPublico(), cena.js).
  const regies = [];
  if (regie) {
    regie.elevacao = elevacaoDaRegie(sala, palco, publico, regie.z);
    desenhado.add(fazerRegie(sala, regie));
    regies.push(regie);
    ajustes.regiesExtra.forEach((re, i) => {
      const r = {
        largura: Math.max(2, re.largura || 2), profundidade: Math.max(2, re.profundidade || 2),
        x: re.dx || 0, z: re.dz || 0, rodar: re.rot || 0
      };
      r.elevacao = elevacaoDaRegie(sala, palco, publico, r.z);
      const grupoExtra = fazerRegie(sala, r);
      grupoExtra.name = "regie-" + (i + 1);
      desenhado.add(grupoExtra);
      regies.push(r);
    });
  }

  // Os interruptores existem porque cada vista serve uma pergunta diferente:
  // sem paredes vê-se a sala de fora, sem público vê-se a estrutura, e sem
  // ninguém no palco mede-se o ecrã sem nada a tapá-lo.
  const gente = $("verPublico").checked
    ? (publico.formato === "circular"
        ? fazerPublicoGomos(sala, palco, publico, regies, ajustesDeGomosGarantidos(publico), ajustes.passarelasExtra)
        : fazerPublico(sala, palco, publico, regies, passarela.ligada ? passarela : null, ajustes.passarelasExtra))
    : { grupo: new THREE.Group(), olhos: null, lugares: 0, filas: 0, porFila: 0, blocos: 1 };
  desenhado.add(gente.grupo);
  olhosDaPlateia = gente.olhos;
  corposDoPublico = gente;

  let medidas = null;
  // Daqui para baixo é o projeto MONTADO que manda -- ver o depósito. As
  // medidas saem só das peças que estão mesmo na sala: se as do depósito
  // contassem para a caixa envolvente, uma peça invisível deslocava as
  // visíveis (o contextoDeZonas usa daqui o esquerda/fundo/largura÷2), e como
  // as peças novas nascem à direita seria logo à primeira.
  const montado = projetoMontado(projeto);
  if (montado && montado.zonas.length) {
    medidas = totais(montado);
    // Os ecrãs também se desligam: para olhar para a sala sem eles, ou para os
    // tirar da frente da planta que se está a acertar por baixo.
    const zonas = fazerZonas(montado, medidas, sala, palco, textura, modoConteudo, ajustes.delays, texturasPorZona);
    if ($("verEcras").checked) desenhado.add(zonas.grupo);
    etiquetas = ($("verMedidas").checked && $("verEcras").checked) ? zonas.etiquetas : [];

    avisarSeNaoCabe(medidas, sala, palco);
  }
  desenharListaConteudoZonas(montado);
  // O DSM não depende de haver zonas — um projeto pode nascer aqui mesmo só
  // com o monitor de confiança, antes de se acrescentar nenhum ecrã.
  if (montado && montado.dsm && $("verEcras").checked) {
    const dsm = fazerDSM(montado.dsm, sala, palco, ajustes.dsm, textura);
    desenhado.add(dsm.grupo);
    if ($("verMedidas").checked) etiquetas = etiquetas.concat(dsm.etiquetas);
  }

  // "Identificar gomos": pedido direto — com vários gomos deslocados/
  // rodados por cima uns dos outros (vistos de lado ou de perto), difícil
  // de perceber qual é qual sem contar. Interruptor à parte do "Medidas e
  // grelha" (isto não é uma medida, é só um nome), por isso entra DEPOIS
  // dos blocos de zonas/DSM acima — que ainda REESCREVEM "etiquetas" do
  // zero, não só acrescentam — para não desaparecer sempre que houver um
  // projeto com ecrãs. Ao meio das filas de cada gomo, não do ponto focal
  // (que cai antes da primeira fila).
  if (publico.formato === "circular" && $("verPublico").checked && $("verGomosId").checked && gente.gomosInfo) {
    etiquetas = etiquetas.concat(gente.gomosInfo.map((g) => ({
      texto: "Gomo " + g.gomo,
      ponto: new THREE.Vector3(g.x, g.y, g.z)
    })));
  }

  // "IDENTIFICAR FILAS E LUGARES": fila A à frente, lugares numerados ao
  // longo da fila. Pedido para poder escolher onde entra o corredor
  // horizontal -- *"marca os lugares com números e letras, para escolher a
  // encruzilhada"* -- e é o mesmo nome que serve depois para falar com quem
  // está na sala ("fila H, lugar 12").
  //
  // NÃO se marcam os lugares todos. Cada etiqueta é um <span> projetado a
  // cada frame (ver desenharEtiquetas): quatrocentas punham a cena a
  // arrastar-se e o ecrã ilegível, que é o contrário de identificar. Marca-se
  // o que uma planta de sala marca: a letra nas duas pontas de cada fila, e
  // os números só na PRIMEIRA fila de cada troço -- a de cima e a que nasce
  // logo a seguir a cada corredor horizontal, que é onde a numeração se
  // confere a olho.
  if ($("verPublico").checked && $("verLugaresId") && $("verLugaresId").checked
      && gente.filasInfo && gente.filasInfo.length && gente.blocosInfo) {
    etiquetas = etiquetas.concat(
      etiquetasDeLugares(gente, publico, palco.altura + palco.acimaDoPalco));
  }

  // Uma pessoa no palco, que é o que dá a medida a tudo o resto. Fica FORA do
  // "se houver projeto": sem zonas nenhumas ela é ainda mais precisa, porque é
  // a única coisa na cena com um tamanho que toda a gente conhece.
  //
  // O ORADOR É DO PALCO, E MAIS NADA. Teve durante uns dias um segundo
  // emprego -- servir de escala dentro da cúpula --, e foi de onde saíram
  // todas as queixas do boneco: *"o boy é voador?"*, *"não parece tocar no
  // chão"*, *"foi para trás do projetor"*, *"quando o movi foi lá para
  // sozinho"*. O mike acertou no diagnóstico: *"o boneco não convive bem com
  // a dome; podíamos ter um para palcos e salas normais e outro para a dome"*.
  // Aqui ficaram as regras do palco, limpas; a pessoa da cúpula é outra, mais
  // abaixo, com as regras dela.
  const figura = (!soCupula && $("verOrador").checked) ? fazerFigura(1.75, null, true) : null;
  const larguraPalco = Math.min(palco.largura || sala.largura, sala.largura);
  // UM PALCO QUE NÃO ESTÁ NA SALA NÃO MANDA NO BONECO.
  //
  // Desde que a app nasce vazia (v3.32) o palco vem desligado, mas as MEDIDAS
  // dele continuam escritas -- e isto lia as medidas, não a sala. O orador
  // ficava preso ao retângulo de um palco invisível e 1 m no ar, em cima de
  // nada. Reportado assim: *"lá anda o boneco, que não consigo movê-lo para
  // onde quero"* -- e não conseguia mesmo: estava preso a uma coisa que ele
  // não via e não tinha pedido.
  const noPalco = $("verPalco").checked && palco.altura > 0 && palco.profundidade > 0;
  const limite = (noPalco ? larguraPalco : sala.largura) / 2 - 0.7;
  const x = (noPalco ? frenteDoPalco(sala, palco).x : 0)
    - (medidas ? Math.min(limite, medidas.largura / 2 + 1.2) : limite * 0.55);
  if (figura) {
    const fx = ondeEsta ? ondeEsta.x : x;
    const fz = ondeEsta ? ondeEsta.z
      : (noPalco
          ? frenteDoPalco(sala, palco).z - 0.8   // à boca de cena
          : -sala.profundidade / 2 + 1.6);
    // Em cima de um palco extra, a altura é a dele. Sem isto a figura
    // continuava à altura do palco principal e ficava enterrada ou a
    // flutuar por cima da peça -- ver alturaDePalcoExtraEm().
    const hExtra = alturaDePalcoExtraEm(fx, fz);
    // A figura só sobe ao palco se o palco ESTIVER LÁ. Reportado: *"o boneco
    // não vai ao chão"* -- e não ia: com "Palco" desligado, ela ficava à
    // altura de um palco que não está desenhado, a flutuar no ar.
    const noChao = !$("verPalco").checked;
    figura.position.set(fx, hExtra != null ? hExtra : ((noPalco && !noChao) ? palco.altura : 0), fz);
    desenhado.add(figura);
  }

  // A PESSOA DENTRO DA CÚPULA -- a régua humana de lá, e só de lá. Chão
  // sempre (y = 0), limites da cúpula, e é ela que responde a "quem tapa que
  // projetor". Roupa mais escura do que o orador, para não haver dúvida sobre
  // quem é quem num projeto que tenha os dois.
  if (domeDoProjeto && $("verPessoaDome") && $("verPessoaDome").checked) {
    const m = medidasDaCupula(domeDoProjeto);
    if (m) {
      const pessoa = fazerFigura(1.75, {
        pele: new THREE.MeshStandardMaterial({ color: 0xBFC9D6, roughness: 0.85 }),
        roupa: new THREE.MeshStandardMaterial({ color: 0x6E7C8C, roughness: 0.95 })
      }, true);
      pessoa.name = "figura-dome";
      // NASCE NO CENTRO. Nascia a um terço do raio, e o mike apontou o que
      // isso esconde: *"a posição dele deve ser no centro de origem, pois
      // será onde se interfere mais"*. E é: medido nesta mesma cúpula, ao
      // centro tapa 4 projetores, encostada à parede tapa 1. O sítio por
      // omissão tem de ser o PIOR caso, senão a primeira leitura é optimista
      // -- e depois arrasta-se para onde a pessoa vai estar de facto.
      const px = ondeEstaNaDome ? ondeEstaNaDome.x : 0;
      const pz = ondeEstaNaDome ? ondeEstaNaDome.z : 0;
      pessoa.position.set(px, 0, pz);
      desenhado.add(pessoa);
    }
  }

  // Quem tapa, pintado no PRÓPRIO boneco -- depois de ele estar na cena, que é
  // quando se sabe onde ficou. Não se desenha a mancha de sombra: ver o
  // comentário de pintarQuemTapa() em cena.js para a razão.
  atualizarNotaDaCupula();

  // A ficha dos projetores de ecrã plano enche-se enquanto eles são
  // desenhados, aqui a seguir -- por isso as coordenadas só se escrevem
  // depois da projeção e dos extras do blend.
  montagemProjetores = [];
  // Um ecrã CURVO é outro desenho, não uma variação deste: a superfície é um
  // cilindro, as máquinas ficam num arco e o alvo de cada uma é radial. Os
  // dois caminhos são exclusivos -- num ecrã curvo todas as máquinas do blend
  // (a primeira incluída) vivem no array, por isso desenhar também a projeção
  // plana era desenhar a primeira duas vezes, numa parede que ali não está.
  const curvaDoBlend = curvaAtivaDoBlend();
  distanciaDaFilaLimitada = null;
  luzForaDoEcra = 0;
  maquinasForaDoPano = 0;
  feixesDoBlend = [];
  tapamOBlend = null;
  if (curvaDoBlend) {
    desenharBlendCurvo(sala, curvaDoBlend);
  } else {
  desenharProjecao(sala, palco);
  // Projetores extra (2º, 3º, ...) -- pedido direto ("Blending Multi-
  // Projetor nunca manda nada" para o Preview). Cada um guarda o SEU
  // racio/distancia/lateral/altura -- simplesmente não vêm de campos no ecrã,
  // vêm do array. O shift é a excepção: esse é o do campo, igual para toda a
  // fila (ver a seguir). Só visuais: sem sombra nem cobertura calculadas para
  // eles (ver PARA-CONTINUAR.md).
  const z0Proj = -sala.profundidade / 2 + 0.35;
  // O shift é o do CAMPO, igual para todos -- decisão do mike ("deve ser de
  // igual sim"). Numa fila de blend são máquinas iguais montadas da mesma
  // maneira, e não há campo de shift por extra: enquanto cada um guardava o
  // seu, os extras nasciam a 0 com o primeiro no valor do campo (que arranca
  // a -25%), e a fila ficava com o primeiro quase um metro abaixo dos outros.
  // Lido aqui a cada desenho, e não gravado no ajuste, para que mexer no campo
  // mexa na fila inteira -- inclusive em projetos já guardados.
  const fila = lerProjecao();
  ajustes.projetoresExtra.forEach((pe, i) => {
    if (!(pe.racio > 0) || !(pe.distancia > 0)) return;
    const larguraExtra = pe.distancia / pe.racio;
    const alturaExtra = larguraExtra / formatoImagem;
    // A ALTURA É DA FILA, do campo -- o mesmo que já valia para a distância e
    // para o shift, e que o ecrã curvo passou a fazer na v3.41. Aqui ficou
    // congelada: guardava-se a absoluta, calculada com o âncora que estava no
    // campo ao aplicar (4,5 m por omissão), e mexer no campo não mexia na
    // fila. Deu para ver quando o "quem tapa o feixe" nunca encontrava
    // ninguém: as máquinas ficavam a 4,5 m e o feixe passava por cima de toda
    // a gente, qualquer que fosse o número escrito. Um ajuste antigo só tem a
    // absoluta -- lê-se essa, para um projeto guardado não saltar ao reabrir.
    const alturaExtraMaquina = pe.alturaOffset !== undefined
      ? fila.altura + pe.alturaOffset
      : (pe.altura || 0);
    // Em retro a máquina fica ATRÁS do pano: a mesma distância medida, do
    // outro lado. O pano está em z0Proj e a plateia em z maior.
    const projetorExtra = {
      x: pe.lateral || 0, y: alturaExtraMaquina,
      z: ajustes.retroDoBlend ? z0Proj - pe.distancia : z0Proj + pe.distancia
    };
    const imagemExtra = {
      x: projetorExtra.x + fila.shiftH * larguraExtra,
      y: projetorExtra.y + fila.shiftV * alturaExtra,
      z: z0Proj, largura: larguraExtra, altura: alturaExtra
    };
    const grupoPlano = fazerProjecao(projetorExtra, imagemExtra, textura, "projetor-" + (i + 1));
    if (grupoPlano.userData.feixe) feixesDoBlend.push(grupoPlano.userData.feixe);
    desenhado.add(grupoPlano);
    montagemProjetores.push(fichaDeProjetor("P" + (i + 2), projetorExtra, z0Proj,
      fila.shiftH, fila.shiftV, larguraExtra, alturaExtra));
  });
  }
  escreverCoordenadas();

  // AS DUAS PONTAS DE CADA FEIXE, MARCADAS E DECLARADAS.
  //
  // Pedidos: *"achas que podíamos ter o centro da lente marcada e declarada"* e
  // *"podes marcar os centros no ecrã"*. São as duas pontas da mesma linha — de
  // onde a luz sai (cruz, na truss) e onde ela aterra (anel, no pano) —, e é o
  // par que se usa a fitar um ecrã.
  //
  // O ANEL NÃO ESTÁ NO "APONTA A". Esse é o eixo da lente; o lens shift empurra
  // a imagem para fora dele, e num blend com −67% de shift vertical a diferença
  // é dois terços da altura da imagem. O ponto certo é o `centroDaImagem`, que
  // já era calculado em fichaDeProjetorEm() e não estava à vista em lado nenhum.
  //
  // TUDO NUM SÍTIO SÓ, e de propósito: as marcas, as etiquetas e a tabela saem
  // todas de dadosDeCoordenadas(). Enquanto cada função de desenho punha a sua
  // marca, havia três sítios a poder discordar da tabela.
  const deCoords = dadosDeCoordenadas();
  const todosOsProjetores = [].concat(deCoords.cupula || [], deCoords.planos || []);
  todosOsProjetores.forEach((p, i) => {
    // A cor liga as três coisas do mesmo projetor: a cruz na truss, o anel no
    // pano e a linha da tabela. Sem ela, num blend de cinco não se sabe qual é
    // qual -- foi a lição do anel da cúpula ("fatias todas da mesma cor leem-se
    // como uma mancha só").
    const cor = p.cor || corDoProjetor(i);
    desenhado.add(marcaDaLente(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), cor));
    if (p.centroDaImagem) {
      desenhado.add(marcaNoEcra(
        new THREE.Vector3(p.centroDaImagem.x, p.centroDaImagem.y, p.centroDaImagem.z),
        cor, p.pos, p.distancia));
    }
  });

  // E declarada também na cena, debaixo do mesmo interruptor das outras
  // medidas: numa cúpula de dez, dez coordenadas sempre à vista tapavam-na.
  if ($("verMedidas").checked) {
    etiquetas = etiquetas.concat(todosOsProjetores.map((p) => {
      // A MEDIDA QUE SE LEVA PARA O PANO, quando há pano para medir.
      //
      // Pedido assim: *"medida do ecrã da esquerda para a direita em metros
      // para a posição, não preciso do resto — e se for shift basta H V"*.
      // Três coordenadas de sala são o que o media server quer; quem vai
      // marcar o ecrã quer UMA medida e a fita. As coordenadas não se perdem:
      // continuam na tabela das Coordenadas de montagem, que é de onde se
      // copia para o Eye.
      //
      // A etiqueta senta-se no ANEL e não na lente, porque é do ponto no pano
      // que ela fala. Uma medida do ecrã a flutuar por cima da máquina era
      // outra vez pedir para adivinhar a que ponto ela se referia.
      if (p.noPano) {
        const shift = (p.shiftH || p.shiftV)
          ? " · shift H " + pct(p.shiftH) + " · V " + pct(p.shiftV)
          : "";
        return {
          ponto: new THREE.Vector3(p.centroDaImagem.x,
            p.centroDaImagem.y + 0.42, p.centroDaImagem.z),
          texto: p.nome + " · " + nnum(p.noPano.daEsquerda) + " m da esquerda" + shift
        };
      }
      // Sem pano medível (a cúpula, a projeção simples) fica o que já estava:
      // o centro da lente, com o nome de cada eixo e pela ordem do painel
      // (lado, fundo, altura). A ordem saiu primeiro em x·y·z e a resposta foi
      // *"lado fundo altura?????"* -- os campos que se vão mexer a seguir
      // estão nesta ordem, e como cada número leva o nome, a ordem aqui não
      // carrega informação nenhuma: é só a que dá menos trabalho.
      return {
        // Um palmo ACIMA do ponto, e não em cima dele: uma etiqueta centrada
        // numa zona tapa um pedaço de um rectângulo grande e não faz mal
        // nenhum; centrada num PONTO, tapa exactamente a marca que anuncia.
        ponto: new THREE.Vector3(p.pos.x, p.pos.y + 0.42, p.pos.z),
        texto: p.nome + " · lente  lado " + nsin(p.pos.x) +
          " · fundo " + nsin(p.pos.z) + " · altura " + nsin(p.pos.y)
      };
    }));
  }

  // Pedir 12 filas e receber 6 sem ninguém dizer nada é a maneira certa de
  // levar um número errado para uma reunião. Mas com o público DESLIGADO não
  // cabem zero de dez, e dizer isso é só ruído: o que ali não está é porque
  // alguém o mandou embora. Em "Circular" cada gomo pode ter menos filas do
  // que as outras DE PROPÓSITO (uma ala mais curta) -- isso não é a sala a
  // faltar espaço, por isso usa-se gomosApertados (só os gomos que pediram
  // mais filas do que a sala lhes deixou encaixar), não o campo global.
  if ($("verPublico").checked && publico.formato === "circular") {
    if (gente.gomosApertados && gente.gomosApertados.length) {
      const aviso = $("aviso");
      const jaTem = aviso.classList.contains("mostra") ? aviso.innerHTML + " " : "";
      const lista = gente.gomosApertados
        .map((g) => `Gomo ${g.gomo}: ${g.filas} de ${g.pedidas}`).join("; ");
      aviso.innerHTML = jaTem + `Nem todas as filas pedidas cabem — ${lista} (a sala acaba antes). ` +
        `<button type="button" class="aviso-link" data-secao="sPublico">Ajustar Público</button>`;
      aviso.classList.add("mostra");
    }
  } else if ($("verPublico").checked && publico.filas && gente.filas < publico.filas) {
    const aviso = $("aviso");
    const jaTem = aviso.classList.contains("mostra") ? aviso.innerHTML + " " : "";
    aviso.innerHTML = jaTem + `Só cabem ${gente.filas} das ${publico.filas} filas: ` +
      `a sala acaba antes. ` +
      `<button type="button" class="aviso-link" data-secao="sPublico">Ajustar Público</button>`;
    aviso.classList.add("mostra");
  }

  // Os lugares por fila pedidos não cabem à largura. Desenham-se à mesma (ver
  // "apertado" em fazerPublico): encolher em silêncio dava uma lotação
  // diferente da que está escrita no campo, e é a escrita que alguém leva
  // para a obra. Mas cala-se, não.
  // AS LINHAS QUE NÃO SE PERCEBERAM DIZEM-SE.
  //
  // Uma excepção mal escrita ("1 A 5", sem os dois pontos) seria comida em
  // silêncio e a plateia saía com a lotação antiga -- alguém levava esse número
  // para a obra sem saber que a linha não pegou. Dizer qual é a linha custa uma
  // frase e evita isso.
  const notaExcecoes = $("notaExcecoes");
  if (notaExcecoes) {
    const mas = excecoesQueNaoSePerceberam();
    notaExcecoes.innerHTML = mas.length
      ? "Não percebi " + (mas.length === 1 ? "esta linha" : "estas linhas") + ": <b>" +
        mas.map((l) => l.replace(/</g, "&lt;")).join("</b>, <b>") + "</b>. " +
        "A forma é <b>blocos: filas = lugares</b> — por exemplo <b>1,3: A = 5</b>."
      : "Uma por linha: <b>blocos: filas = lugares</b>. Os blocos contam-se da esquerda " +
        "(1, 2, 3…) e as filas pela letra (A é a da frente). A última linha que apanhar " +
        "um bloco/fila é a que manda.";
    notaExcecoes.classList.toggle("aviso-texto", mas.length > 0);
  }

  const avisoLugares = $("avisoLugares");
  if (avisoLugares) {
    const ap = gente.apertado;
    avisoLugares.hidden = !ap;
    if (ap) {
      avisoLugares.textContent = "Os lugares pedidos ocupam " + nnum(ap.pedida) +
        " m e a sala só dá " + nnum(ap.disponivel) +
        " m de largura livre — a plateia fica mais larga do que a sala.";
    }
  }
  // PEÇAS DO LADO DE FORA DAS PAREDES -- ver pecasForaDasParedes().
  //
  // Corre a cada montagem, e por isso apanha o caso que deu origem a isto:
  // mudar as medidas da sala e as peças com posição própria ficarem lá fora.
  // Não lhes toca: diz, e põe o botão ao lado.
  const foraDasParedes = pecasForaDasParedes();
  if (foraDasParedes.length) {
    const aviso = $("aviso");
    const jaTem = aviso.classList.contains("mostra") ? aviso.innerHTML + " " : "";
    const nomes = foraDasParedes.slice(0, 4).map((p) => p.rotulo).join(", ") +
      (foraDasParedes.length > 4 ? " e mais " + (foraDasParedes.length - 4) : "");
    aviso.innerHTML = jaTem +
      (foraDasParedes.length === 1
        ? "Uma peça ficou fora das paredes: " + nomes + ". "
        : foraDasParedes.length + " peças ficaram fora das paredes: " + nomes + ". ") +
      '<button type="button" class="aviso-link" data-arrumar="1">Trazer para dentro</button>';
    aviso.classList.add("mostra");
  }

  // E a nota diz as letras que existem MESMO, para "depois da fila" não ser
  // um palpite: numa sala de 12 filas, escrever "P" não abre corredor nenhum.
  const notaFilas = $("notaFilas");
  if (notaFilas) {
    notaFilas.textContent = gente.filas > 1
      ? "As filas chamam-se A a " + letraDaFila(gente.filas - 1) +
        ", a contar da frente. Escreve as letras separadas por vírgula."
      : "As filas chamam-se A, B, C… a contar da frente. Escreve as letras separadas por vírgula.";
  }
  // A cobertura substitui o aviso de ângulo da v2.26: aquele só dizia "há um
  // ecrã rodado de mais"; isto diz QUEM fica sem ver nada, em que bloco, e
  // desenha-o na cena se for pedido -- o aviso genérico não respondia a
  // nenhuma dessas perguntas.
  let cobertura = null;
  if (montado && montado.zonas.length) {
    cobertura = calcularCobertura(montado, medidas, sala, palco, gente);
    if (cobertura && $("verCobertura").checked) {
      desenhado.add(desenharConesCobertura(montado, medidas, sala, palco, gente));
    }
  }
  ultimaCobertura = cobertura;   // porta de teste — ver window.preview
  escreverPainelCobertura(cobertura, !!(montado && montado.zonas.length));

  // QUEM TAPA O FEIXE DA FILA DO BLEND. Corre aqui, depois de os projetores e
  // a plateia estarem os dois na cena -- antes disso não há nem feixes nem
  // corpos para comparar. As caixas são as mesmas que a sombra do projetor
  // único já usa (caixasQueTapam), para não haver duas ideias diferentes sobre
  // o que é "estar à frente".
  if (feixesDoBlend.length) {
    tapamOBlend = quemTapaOFeixe(feixesDoBlend, caixasQueTapam());
    if (tapamOBlend.tapam.length) desenhado.add(marcarQuemTapa(tapamOBlend.tapam));
  }
  escreverQuemTapaOBlend();

  cena.add(desenhado);
  if (document.activeElement !== $("ecraL") && document.activeElement !== $("ecraA")) {
    escreverTamanhoDoEcra();
  }
  guardarSala({
    largura: sala.largura, profundidade: sala.profundidade, altura: sala.altura,
    palco: { largura: palco.largura, altura: palco.altura, profundidade: palco.profundidade },
    publico: {
      filas: gente.filas, porFila: gente.porFila, lugares: gente.lugares,
      corredores: publico.corredores, inclinacao: publico.inclinacao,
      tipo: publico.inclinacao > 0.005 ? "auditorio" : "pavilhao",
      // do plano do ecrã ao primeiro e ao último espectador
      primeiroEspectador: gente.zPrimeira != null
        ? +(gente.zPrimeira - (-sala.profundidade / 2 + 0.35)).toFixed(2) : null,
      ultimoEspectador: gente.zUltima != null
        ? +(gente.zUltima - (-sala.profundidade / 2 + 0.35)).toFixed(2) : null,
      larguraPlateia: gente.larguraSentada != null ? +gente.larguraSentada.toFixed(2) : null
    }
  });
  escreverPainel(medidas, gente.lugares, gente, cobertura);
  avisarDoDeposito();
  // Depois de a cena estar montada: quem responde é o desenho, não os campos.
  avisarDaSalaVazia();
  desenharAjustes();
  desenharGomos(publico);
  desenharPalcosExtra();
  desenharRegiesExtra();
  desenharPassarelasExtra();
  desenharProjetoresExtra();
  devolverDaqui();
  if (recentrarCamara) vista("frente");
}

/**
 * A curvatura do ecrã do blend, se este projeto tiver uma.
 *
 * Guardada nos ajustes porque é do projeto e não da carga: quem reabre a app
 * amanhã tem de voltar a ver o ecrã curvo sem ir outra vez aos Calculadores.
 */
/**
 * A que altura do chão começa o pano.
 *
 * A ALTURA do ecrã vem dos Calculadores (é do projeto); onde ele fica pendurado
 * é colocação física, e isso é sempre decisão de quem está a olhar para a sala
 * — a mesma regra do dx/dz e da altura da lente. Por omissão, assente no chão.
 */
function alturaDaBaseDoEcra() {
  return $("curvaBase") ? num("curvaBase") : 0;
}

/**
 * SUBIR O PANO LEVA AS MÁQUINAS, quando se pediu que levasse.
 *
 * O dx/dz move o centro da curvatura e as máquinas vão atrás sozinhas, porque
 * saem dele. A base não: a altura das lentes é um campo à parte, e sem isto
 * subir o ecrã dois metros deixava a fila no chão — "levar os projetores com o
 * ecrã" ligado e as máquinas a não irem.
 *
 * Mexe no CAMPO, e não num valor escondido, para o número continuar à vista e
 * editável. Escrever `.value` não dispara `input`, por isso não há volta ao
 * mesmo sítio.
 */
let baseDoEcraAnterior = 0;
function acompanharBaseDoEcra() {
  const agora = alturaDaBaseDoEcra();
  const leva = !$("curvaLevaProjetores") || $("curvaLevaProjetores").checked;
  if (leva && agora !== baseDoEcraAnterior && $("projAltura")) {
    $("projAltura").value = (num("projAltura") + (agora - baseDoEcraAnterior)).toFixed(2);
  }
  baseDoEcraAnterior = agora;
}

/**
 * Reaprender a base sem mexer nas lentes.
 *
 * Abrir um projeto guardado escreve os campos todos de uma vez, sem disparar
 * `input` -- e se a base de lá for diferente da que cá estava, a mexida
 * seguinte calculava a diferença contra o valor errado e atirava a fila para
 * outro sítio de uma vez só. Depois de encher os campos, regista-se a base
 * nova e mais nada.
 */
function esquecerBaseDoEcraAnterior() {
  baseDoEcraAnterior = alturaDaBaseDoEcra();
}

/**
 * O que a fila do blend apanha pelo caminho, escrito onde já se lê o resto da
 * projeção. Um número só: quantas pessoas estão no feixe e quantas máquinas
 * elas afectam -- que é o que decide se a montagem se aguenta ou se é preciso
 * subir as máquinas.
 */
/**
 * AS MARCAS ACOMPANHAM QUEM SE MEXE.
 *
 * Reportado: *"o orador fica marcado se puser o palco, mas quando o movo fica
 * a marca vermelha para trás"*. E ficava: as marcas nascem no montar(), e
 * arrastar o boneco não remonta a sala -- mexe na figura e mede a sombra, e
 * mais nada. A marca ficava no sítio de onde ele saiu, a apontar para o
 * passado.
 *
 * Refaz-se só o grupo das marcas, não a sala inteira: arrastar tem de
 * responder ao dedo, e remontar tudo a cada pixel de movimento não responde.
 */
function atualizarMarcasDoBlend() {
  if (!desenhado || !feixesDoBlend.length) return;
  const velho = desenhado.getObjectByName("aux:tapa-feixe");
  if (velho) desenhado.remove(velho);
  tapamOBlend = quemTapaOFeixe(feixesDoBlend, caixasQueTapam());
  if (tapamOBlend.tapam.length) desenhado.add(marcarQuemTapa(tapamOBlend.tapam));
  escreverQuemTapaOBlend();
}

function escreverQuemTapaOBlend() {
  const nota = $("notaTapaBlend");
  if (!nota) return;
  if (!feixesDoBlend.length) { nota.textContent = ""; nota.hidden = true; return; }
  if (!tapamOBlend || !tapamOBlend.tapam.length) {
    nota.hidden = false;
    nota.className = "vazio";
    nota.textContent = "Ninguém no caminho da luz: os " + feixesDoBlend.length +
      " feixes chegam à tela sem apanhar nada.";
    return;
  }
  const pessoas = tapamOBlend.tapam.length;
  nota.hidden = false;
  nota.className = "aviso-inline";
  nota.textContent = pessoas + (pessoas === 1 ? " pessoa está" : " pessoas estão") +
    " no caminho da luz, e " + (tapamOBlend.projetores === 1
      ? "apanha 1 dos " + feixesDoBlend.length + " projetores."
      : "apanham " + tapamOBlend.projetores + " dos " + feixesDoBlend.length + " projetores.") +
    " Estão marcadas na sala.";
}

function curvaAtivaDoBlend() {
  const c = ajustes.curvaDoBlend;
  if (!c || !(c.raio > 0) || !(c.arco > 0)) return null;
  if (!ajustes.projetoresExtra || !ajustes.projetoresExtra.length) return null;
  return c;
}

/**
 * O BLEND NUM ECRÃ CURVO.
 *
 * Esteve de fora do 3D com a razão de que "a distância de tiro varia ao longo
 * do arco". É verdade para UM projetor a cobrir um arco a partir de um ponto
 * fixo — mas não é o que a aba Blending calcula. Ela reparte o arco em fatias
 * IGUAIS e diz, no campo da distância, *"a mesma para todos os projetores do
 * blend"*: isso só é verdade com as máquinas num arco concêntrico com o ecrã,
 * cada uma a apontar radialmente para o meio da sua fatia. A geometria estava
 * implícita nos números que já se viam; só faltava desenhá-la.
 *
 * É a mesma receita do anel da cúpula, que já cá estava: um raio de montagem
 * mais pequeno do que o da superfície, e cada máquina a olhar para fora.
 */
function desenharBlendCurvo(sala, curva) {
  const z0 = -sala.profundidade / 2 + 0.35;
  const m = medidasDaCurva(curva, z0, num("curvaDx"), num("curvaDz"));
  if (!m) return;

  // ONDE O PANO ESTÁ, E ONDE AS MÁQUINAS FORAM MONTADAS: dois sítios, e desde
  // agora podem ser diferentes.
  //
  // Pedido direto: *"preciso do ecrã de projeção até para reposicionar no 3D,
  // e forma de levar os projetores com ele ou não"*. Com o interruptor ligado
  // move-se a montagem inteira — é arrumar o rig na sala, e a imagem não muda,
  // porque a geometria entre máquinas e pano é a mesma. Desligado, o pano vai
  // sozinho e as máquinas ficam onde estavam: é aí que se vê o feixe a bater
  // ao lado, que é a pergunta que faz valer a pena mover uma coisa sem a outra.
  //
  // `mMaquinas` é o ecrã NA POSIÇÃO DE ORIGEM — a que a montagem foi pensada.
  // Serve só para colocar e orientar as máquinas; a luz delas bate sempre em
  // `m`, o pano onde ele está agora.
  const leva = !$("curvaLevaProjetores") || $("curvaLevaProjetores").checked;
  const mMaquinas = leva ? m : medidasDaCurva(curva, z0, 0, 0);
  if (!mMaquinas) return;
  // Fora do sítio, o arco concêntrico deixou de o ser: a conta rápida do caso
  // em arco assume a lente no raio e a olhar a direito, e isso já não é
  // verdade. A geometria geral serve os dois casos e não assume nada.
  const desalinhado = !leva;
  // O shift é o do campo, igual para toda a fila — a mesma decisão do ecrã
  // plano ("deve ser de igual sim").
  const fila = lerProjecao();

  // A DISTÂNCIA também é da fila inteira, e pela mesma razão só que mais
  // forte: num arco concêntrico "a distância à superfície" é o raio de
  // montagem, uma propriedade do arco e não de cada máquina — duas máquinas a
  // distâncias diferentes já não estão no mesmo arco, e a grelha de fatias
  // iguais que os Calculadores calcularam deixa de fazer sentido.
  //
  // Ficava lida do ajuste guardado e o campo "Distância" não fazia nada: o
  // mike mexia no número e o desenho não se mexia. Reportado assim mesmo —
  // "ao atualizar a distância dos projetores não está a desenhar".
  //
  // Passar do raio da curva punha a lente do OUTRO lado do centro, a projetar
  // para trás. Os Calculadores já recusam isso na origem; aqui, onde o número
  // se escreve à mão, limita-se e diz-se porquê (ver escreverCoordenadas()).
  // FRONTAL OU RETRO, decidido nos Calculadores e trazido pela ponte.
  // Perguntado a olhar para o 3D: *"frontal ou retro"* -- e até aqui as duas
  // apps assumiam frontal em todo o lado sem o dizerem em lado nenhum. Uma
  // carga antiga não traz o campo e lê-se como frontal.
  const retro = curva.retro === true;

  const pedida = fila.distancia > 0 ? fila.distancia : 0;
  // O tecto do raio é só do frontal: é lá que a máquina tem de caber entre o
  // centro da curvatura e o pano. Atrás do pano não há tecto nenhum vindo do
  // raio, e limitar ali era inventar um limite que a montagem não tem.
  const maxima = m.R - 0.5;
  distanciaDaFilaLimitada = (!retro && pedida > maxima) ? maxima : null;
  const distancia = distanciaDaFilaLimitada || pedida;

  // EM ARCO OU EM LINHA RETA. Pedido direto: *"os projetores poderão ser
  // posicionados tanto em círculo a acompanhar como em uma linha reta"*. Muda
  // onde a máquina está e para onde olha -- daí para a frente (cortar no
  // tamanho do ecrã, desenhar, escrever a ficha) é tudo igual, e por isso os
  // dois caminhos separam-se só aqui e voltam a juntar-se três linhas abaixo.
  // Uma carga antiga não traz `montagem` e lê-se como "arco", que era a única
  // que existia.
  const emLinha = curva.montagem === "linha" && curva.trussLargura > 0;

  // A MEDIDA DO PANO, posta na ficha no mesmo sítio onde a ficha nasce.
  //
  // A luz bate sempre em `m` — o pano onde ele ESTÁ — e não em `mMaquinas`,
  // que é só onde a montagem foi pensada. Medir no segundo dava um número
  // certinho de um pano que já ninguém tem à frente.
  const comMedidaNoPano = (ficha) => {
    if (ficha && ficha.centroDaImagem) {
      ficha.noPano = {
        daEsquerda: m.daEsquerda(ficha.centroDaImagem),
        total: m.arcoTotal()
      };
    }
    return ficha;
  };

  // A TELA, desenhada como objeto e não como soma das imagens -- ver
  // fazerEcraCurvo(). Vai primeiro para as imagens ficarem por cima dela.
  if (curva.altura > 0) {
    const tela = fazerEcraCurvo(m, alturaDaBaseDoEcra(), curva.altura);
    if (tela) desenhado.add(tela);
  }

  ajustes.projetoresExtra.forEach((pe, i) => {
    if (!(pe.racio > 0) || !(distancia > 0)) return;
    const s = pe.arco || 0;
    // A altura desta máquina: a da fila (do campo) mais o que a distingue.
    // Um ajuste guardado antes da v3.41 só tem a altura absoluta -- lê-se essa,
    // para um projeto antigo não saltar de sítio ao reabrir.
    const alturaMaquina = pe.alturaOffset !== undefined
      ? fila.altura + pe.alturaOffset
      : (pe.altura || 0);
    // O ALVO é o ponto do pano que esta máquina foi montada a apontar — na
    // posição de ORIGEM. Uma máquina aparafusada não se vira sozinha quando o
    // pano anda para o lado: continua a mandar luz para o mesmo sítio do
    // espaço, e é lá que o desenho a tem de mandar também.
    const alvo = mMaquinas.pontoNoArco(s);
    let projetor, aInicio, aFim, larguraNoArco, tiro;
    if (emLinha) {
      // A máquina na truss, à mesma fração do meio a que a sua fatia está no
      // arco -- a fila na truss acompanha a fila no ecrã. A truss fica a
      // `distancia` do ponto MAIS FUNDO do ecrã, que é o número que se mede na
      // sala com uma fita, e por isso as máquinas das pontas ficam mais perto
      // da sua fatia do que a do meio: são as pontas da curva que vêm à frente.
      const fracao = mMaquinas.arco > 0 ? s / (mMaquinas.arco / 2) : 0;
      const px = mMaquinas.cx + fracao * (curva.trussLargura / 2);
      // Em retro a truss fica ATRÁS do ponto mais fundo do ecrã, não à frente
      // dele: a fita mede a mesma distância, o sinal é que é o contrário.
      const pz = retro
        ? mMaquinas.cz - mMaquinas.R - distancia
        : mMaquinas.cz - mMaquinas.R + distancia;
      projetor = { x: px, y: alturaMaquina, z: pz };
      // Daqui a fatia vê-se de esguelha, e o cone é simétrico: o pedaço de arco
      // que ela apanha não é simétrico em relação ao alvo. Só a geometria a
      // sério responde -- ver medidasDaCurva().arcoEntre().
      const apanha = m.arcoEntre({ x: px, z: pz }, { x: alvo.x, z: alvo.z }, pe.racio, retro);
      // Sem interseção a máquina estaria fora da curva; os Calculadores recusam
      // essa montagem na origem, por isso aqui é mesmo só uma guarda.
      if (!apanha) return;
      aInicio = apanha.a1;
      aFim = apanha.a2;
      tiro = apanha.tiro;
      larguraNoArco = (apanha.a2 - apanha.a1) * m.R;
    } else {
      // Quanto arco é que esta lente apanha daqui. NÃO é distância ÷ rácio:
      // isso é a largura numa parede, e aqui a superfície é côncava — ver
      // medidasDaCurva().arcoDaLente(), a mesma conta que os Calculadores usam
      // para escolher a lente. O rácio é da LENTE e fica de cada máquina; mexer
      // na distância com a mesma lente faz a imagem crescer, como na vida real.
      // A lente a `distancia` da superfície: do lado de dentro do arco em
      // frontal, do lado de fora em retro. O lenteNoArco() põe-na a R − t do
      // centro, por isso o t negativo é exactamente "do outro lado do pano".
      const lente = mMaquinas.lenteNoArco(s, retro ? -distancia : distancia);
      projetor = { x: lente.x, y: alturaMaquina, z: lente.z };
      if (desalinhado) {
        // Com o pano fora do sítio da montagem, o arco já não é concêntrico
        // com ele: a conta rápida (arcoDaLente) assume a lente no raio e a
        // olhar a direito, e nenhuma das duas coisas continua verdade. A
        // geometria geral não assume nada e serve os dois casos.
        const apanha = m.arcoEntre({ x: lente.x, z: lente.z }, { x: alvo.x, z: alvo.z }, pe.racio, retro);
        if (!apanha) { maquinasForaDoPano += 1; return; }
        aInicio = apanha.a1;
        aFim = apanha.a2;
        tiro = apanha.tiro;
        larguraNoArco = (apanha.a2 - apanha.a1) * m.R;
      } else {
        larguraNoArco = retro
          ? m.arcoDaLenteAtras(pe.racio, distancia)
          : m.arcoDaLente(pe.racio, distancia);
        if (!(larguraNoArco > 0)) return;
        const meiaAbertura = (larguraNoArco / 2) / m.R;
        aInicio = lente.angulo - meiaAbertura;
        aFim = lente.angulo + meiaAbertura;
        tiro = distancia;
      }
    }
    // A ALTURA sai da conta plana, e de propósito: a curvatura é só horizontal,
    // e no meio da fatia — onde a altura se mede — a superfície está mesmo a
    // `tiro` da lente. Medi-la a partir do arco esticava a imagem para cima
    // pelos mesmos 5,8% que a curva rouba à largura, e a imagem não é mais alta
    // por o ecrã ser curvo.
    const alturaImagem = tiro / pe.racio / formatoImagem;
    // Cada fatia num raio ligeiramente diferente: nas zonas de blend duas
    // fatias ocupam a mesma superfície, e à mesma distância ficavam a piscar
    // uma contra a outra. Assim vê-se também onde elas se sobrepõem.
    // O ECRÃ TEM O TAMANHO QUE TEM.
    //
    // Aqui não havia ecrã nenhum: a superfície desenhada era a soma das
    // imagens, por isso uma imagem maior do que a tela fazia a TELA crescer.
    // Com a distância subida à mão (que desde a v3.62 mexe mesmo no desenho), a
    // fatia passava do arco e enrolava-se à volta do cilindro -- um ecrã de
    // corda 28 desenhado como uma ferradura quase fechada, que é o que o mike
    // viu e a que não havia resposta possível senão "???????".
    //
    // Uma imagem maior do que o ecrã não aumenta o ecrã: a luz que sobra passa
    // ao lado e perde-se. O desenho corta-a no limite da superfície e diz
    // quanto é que ficou de fora (ver escreverCoordenadas()) -- calar isso era
    // mostrar uma cobertura que a sala não tem.
    const desvio = fila.shiftH * (larguraNoArco / m.R);
    aInicio += desvio;
    aFim += desvio;
    const cortadoInicio = Math.max(aInicio, -m.meioAngulo);
    const cortadoFim = Math.min(aFim, m.meioAngulo);
    luzForaDoEcra += (cortadoInicio - aInicio) * m.R + (aFim - cortadoFim) * m.R;

    // E A MESMA COISA NA VERTICAL, que faltava.
    //
    // Pedido direto: *"a altura a que fica o projetor e a proximidade vão
    // influenciar o cone de projeção, para ter noção visual e relatado"*. E
    // influenciam: a imagem nasce à altura da lente, sobe ou desce com o shift,
    // e cresce com a distância — mas o pano tem a altura que tem. Uma máquina
    // montada a mais alto, ou perto de mais, atira metade da imagem para cima
    // do ecrã, e até aqui isso desenhava-se como se o ecrã crescesse.
    const centroImagem = alturaMaquina + fila.shiftV * alturaImagem;
    const baixoImagem = centroImagem - alturaImagem / 2;
    const cimaImagem = centroImagem + alturaImagem / 2;
    const baixoEcra = alturaDaBaseDoEcra();
    const cimaEcra = baixoEcra + (curva.altura > 0 ? curva.altura : alturaImagem);
    const baixoCortado = Math.max(baixoImagem, baixoEcra);
    const cimaCortada = Math.min(cimaImagem, cimaEcra);
    // A conta da luz perdida é em metros de ARCO na horizontal e em metros de
    // ALTURA na vertical; somam-se como o que são -- imagem que não bate no
    // pano. O que interessa a quem monta é a ordem de grandeza e a razão.
    luzForaDoEcra += (baixoCortado - baixoImagem) + (cimaImagem - cimaCortada);

    // Inteiramente fora da tela, de lado ou por cima: não há fatia para
    // desenhar, mas a máquina continua a existir e a sua ficha também.
    if (cortadoFim <= cortadoInicio || cimaCortada <= baixoCortado) {
      // Conta para o aviso: uma máquina que desaparece do 3D sem explicação é
      // pior do que uma máquina desenhada no sítio errado.
      maquinasForaDoPano += 1;
      montagemProjetores.push(comMedidaNoPano(fichaDeProjetorEm(
        "P" + (i + 1), projetor, { x: alvo.x, y: projetor.y, z: alvo.z },
        fila.shiftH, fila.shiftV, larguraNoArco, alturaImagem)));
      return;
    }
    const fatia = {
      R: m.R - i * 0.004,
      cx: m.cx,
      cz: m.cz,
      altura: cimaCortada - baixoCortado,
      y: (cimaCortada + baixoCortado) / 2,
      angInicio: cortadoInicio,
      angFim: cortadoFim,
      alvo: alvo
    };
    const grupoCurvo = fazerProjecaoCurva(projetor, fatia, textura, "projetor-" + i);
    if (grupoCurvo.userData.feixe) feixesDoBlend.push(grupoCurvo.userData.feixe);
    desenhado.add(grupoCurvo);
    // O alvo é RADIAL e não em frente: é essa a única diferença para a ficha
    // do ecrã plano. No WATCHOUT continua a ser o Target, com o shift à parte.
    montagemProjetores.push(comMedidaNoPano(fichaDeProjetorEm(
      "P" + (i + 1), projetor, { x: alvo.x, y: projetor.y, z: alvo.z },
      fila.shiftH, fila.shiftV, larguraNoArco, alturaImagem)));
  });
}

/**
 * A projeção. O tamanho da imagem não se escreve, calcula-se: um projetor de
 * rácio 1,4 a 12 m faz 8,57 m de largura. E depois pergunta-se a coisa que
 * ninguém consegue responder olhando para uma folha: quem é que lhe passa à
 * frente.
 */
function desenharProjecao(sala, palco) {
  const p = lerProjecao();
  projecaoAtual = null;
  $("resumoProj").textContent = "—";
  if (!p.ligada || !p.racio || !p.distancia) return;

  const largura = p.distancia / p.racio;
  const altura = largura / formatoImagem;
  const z0 = -sala.profundidade / 2 + 0.35;

  // Onde a imagem cai nao se escreve: sai da lente e do shift dela. Era isto
  // que faltava -- com a base escrita a mao, o desenho mostrava imagens que
  // nenhuma lente conseguia por ali.
  const projetor = { x: p.lateral, y: p.altura, z: z0 + p.distancia };
  const imagem = {
    x: projetor.x + p.shiftH * largura,
    y: projetor.y + p.shiftV * altura,
    z: z0, largura, altura
  };

  desenhado.add(fazerProjecao(projetor, imagem, textura));
  montagemProjetores.push(fichaDeProjetor("P1", projetor, z0, p.shiftH, p.shiftV, largura, altura));
  projecaoAtual = {
    projetor, imagem,
    base: imagem.y - altura / 2,
    foraDaSala: largura > sala.largura ||
                imagem.y + altura / 2 > sala.altura ||
                imagem.y - altura / 2 < -0.01 ||
                Math.abs(imagem.x) + largura / 2 > sala.largura / 2
  };
  medirSombra();
}

/**
 * Quem tapa a imagem. Atiram-se raios da lente para 45 pontos da tela e
 * conta-se quantos batem na figura pelo caminho.
 *
 * Vive à parte do desenho porque tem de poder correr enquanto se ARRASTA o
 * orador — a pergunta é "a partir de onde e que ele deixa de fazer sombra?", e
 * essa responde-se a mexer, não a carregar num botão.
 */
/**
 * Todas as caixas que podem tapar a imagem: o orador e cada pessoa da plateia.
 *
 * A plateia entra porque e ela que faz a pergunta a serio -- um projetor a
 * 4,5 m com gente a frente tem cabecas no feixe, e ver isso ANTES e a
 * diferenca entre pendurar a maquina uma vez ou duas.
 */
/**
 * A NOTA DA CÚPULA: a medida que a pessoa lá dentro dá, e quem ela tapa.
 *
 * Pedido: a pessoa da cúpula serve *"apenas para tirar a medida quando uma
 * pessoa estiver dentro dela"*, e uma régua que não mostra o número não serve
 * de nada. Dois factos, os dois relativos ao sítio onde ela está:
 *
 *  - a superfície POR CIMA dela -- e não a altura ao centro, que é a única que
 *    a calculadora dá: numa calota o pé-direito cai com o raio, e é por isso
 *    que se põe a pessoa onde se quer medir;
 *  - se a cabeça dela fica dentro da área de imagem, que é o que decide se
 *    uma pessoa de pé leva imagem na cara.
 *
 * Corre no montar() E a cada arrastar: a primeira versão corria só no
 * montar(), e arrastar o boneco não remonta -- ficava com a cor de onde tinha
 * estado, que é o pior dos mundos (a informação lá, e errada).
 */
function atualizarNotaDaCupula() {
  const nota = $("notaDome");
  if (!nota) return;
  const pessoa = pessoaDaCupula();
  if (!domeMontado || !pessoa) { nota.textContent = ""; return; }

  const tapados = pintarQuemTapa(domeMontado, pessoa);
  const m = projeto && projeto.dome ? medidasDaCupula(projeto.dome) : null;
  const linhas = [];

  if (m) {
    const r = Math.hypot(pessoa.position.x, pessoa.position.z);
    const acima = m.alturaAcimaDe(r);
    // Ao centro, dizer "4,35 m por cima dela (4,35 m ao centro)" é repetir-se.
    linhas.push(r < 0.15
      ? "Pessoa de 1,75 m no centro da cúpula: " + nnum(acima) + " m de superfície por cima dela."
      : "Pessoa de 1,75 m: a superfície está a " + nnum(acima) +
        " m por cima dela (" + nnum(m.altura) + " m ao centro).");
    if (m.yBaseDaImagem > 0.05) {
      linhas.push(m.yBaseDaImagem < 1.75
        ? "A imagem começa a " + nnum(m.yBaseDaImagem) +
          " m — a cabeça dela fica dentro da área de imagem."
        : "A imagem começa a " + nnum(m.yBaseDaImagem) + " m, acima da cabeça dela.");
    }
  }
  if (tapados) {
    // Cada peça do corpo leva a cor do projetor que a apanha, e essa cor é a
    // da tampa do próprio projetor no 3D — é assim que se sabe DE ONDE vem o
    // feixe que lhe toca, sem ter de adivinhar qual é a frente dela.
    linhas.push((tapados === 1 ? "Está a tapar 1 projetor" : "Está a tapar " + tapados + " projetores") +
      " — só as partes do corpo que o feixe apanha ficam pintadas, com a cor da tampa desse projetor.");
  }
  nota.textContent = linhas.join(" ");
}

/** Um número em português, com duas casas e vírgula. */
function nnum(v) { return (Math.round(v * 100) / 100).toFixed(2).replace(".", ","); }

/**
 * A MEDIDA DA FITA, escrita: quantos metros de pano da ponta esquerda até ao
 * meio da imagem deste projetor.
 *
 * Um centro que caia FORA do pano é dito, não arredondado para dentro: com o
 * shift muito aberto ou a máquina fora do sítio, o meio da imagem pode mesmo
 * não bater no ecrã, e escrever "0,00 m" nesse caso era mandar alguém marcar
 * uma cruz num sítio onde não vai cair imagem nenhuma.
 */
/**
 * Uma percentagem de shift, com o mesmo sinal de menos do resto da app.
 * `Math.round()` dá um hífen de teclado e o nsin() dá "−"; ter os dois na
 * mesma linha da tabela era pequeno e feio.
 */
function pct(v) {
  const n = Math.round((v || 0) * 100);
  return (n < 0 ? "−" : "") + Math.abs(n) + "%";
}

function medidaNoPano(p) {
  if (!p.noPano) return "—";
  const d = p.noPano.daEsquerda, total = p.noPano.total;
  const fora = d < -0.005 || d > total + 0.005;
  return nnum(d) + " m" + (fora ? " (fora do pano, que tem " + nnum(total) + " m)" : "");
}

/** O mesmo com sinal à frente, para coordenadas: +3,85 lê-se melhor que 3,85. */
function nsin(v) {
  const n = Math.round(v * 100) / 100;
  if (Math.abs(n) < 0.005) return "0";
  return (n > 0 ? "+" : "−") + Math.abs(n).toFixed(2).replace(".", ",");
}

/**
 * A ficha de um projetor de ECRÃ PLANO — o da aba Distância de Projeção e os
 * do blend.
 *
 * A diferença para os da cúpula não é de contas, é de montagem: aqui as
 * máquinas ficam a prumo com o ecrã e quem move a imagem é o LENS SHIFT, não
 * a inclinação. Por isso o alvo é sempre em frente (o mesmo x e y, no plano do
 * ecrã) e o shift vai à parte — que é exactamente a distinção que o WATCHOUT
 * faz entre o Target ("o ponto para onde o projetor aponta quando não há lens
 * shift") e o campo Lense Shift.
 */
/**
 * Uma cor em texto para CSS.
 *
 * A ficha da cúpula já traz a cor em "#rrggbb" (fichaDeMontagem, em cena.js) e
 * a paleta traz-na em número. Passar uma string por um `>>> 0` dava zero, ou
 * seja preto — e uma bolha preta numa tabela de cores é um erro que ninguém
 * lê como erro.
 */
function corHex(c) {
  if (typeof c === "string") return c;
  return "#" + (c >>> 0).toString(16).padStart(6, "0").slice(-6);
}

function fichaDeProjetor(nome, pos, zEcra, shiftH, shiftV, largura, altura) {
  // Ecrã plano: "em frente" é o mesmo x e y, no plano do ecrã.
  return fichaDeProjetorEm(nome, pos, { x: pos.x, y: pos.y, z: zEcra },
    shiftH, shiftV, largura, altura);
}

/**
 * A mesma ficha, com o alvo dado por quem chama.
 *
 * Num ecrã CURVO "em frente" não é ao longo de −z, é ao longo do raio: cada
 * máquina olha para fora, para o meio da fatia dela. Tudo o resto — o shift à
 * parte, o centro da imagem depois do shift — é igual, porque a distinção do
 * WATCHOUT entre o Target e o Lense Shift também é.
 */
function fichaDeProjetorEm(nome, pos, alvo, shiftH, shiftV, largura, altura) {
  const dx = alvo.x - pos.x, dy = alvo.y - pos.y, dz = alvo.z - pos.z;
  const distancia = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // A direcção do tiro, no plano, para o shift sair perpendicular a ela --
  // num arco, "para o lado" não é o eixo x da sala.
  const plano = Math.hypot(dx, dz) || 1;
  const ladoX = -dz / plano, ladoZ = dx / plano;
  return {
    nome: nome,
    pos: { x: pos.x, y: pos.y, z: pos.z },
    alvo: { x: alvo.x, y: alvo.y, z: alvo.z },
    distancia: distancia,
    shiftH: shiftH || 0,
    shiftV: shiftV || 0,
    // Para onde a imagem vai de facto, depois do shift — é o que se confere
    // no 3D, e não bate com o alvo sempre que houver shift.
    centroDaImagem: {
      x: alvo.x + (shiftH || 0) * largura * ladoX,
      y: alvo.y + (shiftV || 0) * altura,
      z: alvo.z + (shiftH || 0) * largura * ladoZ
    }
  };
}

/**
 * AS COORDENADAS DE MONTAGEM, para um media server.
 *
 * Pedido: *"podemos adicionar esta ferramenta à calculadora, tanto na dome
 * como no blending"* -- depois de eu ter feito à mão uma folha com as
 * posições dos quatro projetores para o WATCHOUT. A app já tinha os números;
 * só não os mostrava assim.
 *
 * Ficam AQUI, no Preview, e não nos Calculadores, por uma razão: quem coloca
 * os projetores é o fazerProjetoresDoDome(), e é do mesmo sítio que sai o OBJ
 * exportado ao lado. Calculá-las outra vez do lado dos Calculadores era pôr a
 * mesma conta em dois sítios -- e coordenadas que não batem certo com o modelo
 * são piores do que não existirem.
 */

/**
 * Quem tem coordenadas nesta montagem. Um sítio só: o painel, o texto do
 * "Copiar" e o relatório em página leem todos daqui, para não haver três
 * versões da mesma lista a divergirem quando uma delas mudar.
 */
function dadosDeCoordenadas() {
  const cupula = domeMontado && domeMontado.userData ? domeMontado.userData.montagem : null;
  const planos = montagemProjetores;
  return {
    cupula: cupula, planos: planos,
    temCupula: !!(cupula && cupula.length),
    temPlanos: !!(planos && planos.length)
  };
}

/**
 * A tabela de coordenadas em HTML. Serve o painel e a página do relatório
 * com o mesmo markup -- a folha de estilo é que muda de um lado para o outro.
 */
/**
 * `comInterruptores` só vem `true` do PAINEL. A mesma função escreve a tabela
 * do relatório (ver fazerRelatorio), e uma folha impressa com caixas para
 * marcar é uma folha estragada -- por isso a coluna dos interruptores é um
 * extra pedido, e não o normal.
 */
function tabelaDeCoordenadas(quais, tipo, comInterruptores) {
  if (tipo === "cupula") {
    const escondidas = new Set(ajustes.fatiasEscondidas || []);
    const linhas = quais.map((p) => `<tr>
        ${comInterruptores ? `<td class="fatia-liga"><label title="Mostrar a fatia deste projetor na cúpula — é só a vista, as contas não mexem"><input type="checkbox" class="fatia-cb" data-projetor="${p.nome}"${escondidas.has(p.nome) ? "" : " checked"}></label><button type="button" class="fatia-so" data-projetor="${p.nome}" title="Só a fatia deste — apaga as outras todas. Outro toque traz-as de volta.">só</button></td>` : ""}
        <td><span class="quem"><span class="bolha" style="background:${p.cor}"></span>${p.nome}</span></td>
        <td class="n">${nsin(p.pos.x)} · ${nsin(p.pos.y)} · ${nsin(p.pos.z)}</td>
        <td class="n">${nsin(p.alvo.x)} · ${nsin(p.alvo.y)} · ${nsin(p.alvo.z)}</td>
        <td class="n">${nnum(p.distancia)}</td>
        <td class="n">${Math.round(p.inclinacao)}°</td>
      </tr>`).join("");
    return `<div class="coords-rolar"><table class="coords">
      <thead><tr>
        ${comInterruptores ? '<th title="Mostrar a fatia na cúpula">Fatia</th>' : ""}
        <th>Projetor</th><th title="O centro da lente — é dele que sai o feixe, é dele que se mede a distância de tiro, e é ele que vai no Eye do media server">Centro da lente (x·y·z)</th><th>Aponta a (x·y·z)</th><th>Dist.</th><th>Incl.</th>
      </tr></thead><tbody>${linhas}</tbody></table></div>`;
  }
  // O shift só ganha coluna quando algum projetor o usa: uma coluna de zeros
  // é ruído numa tabela que já é larga.
  const comShift = quais.some((p) => p.shiftH || p.shiftV);
  // A MEDIDA NO PANO substituiu o "Centro no ecrã (x·y·z)".
  //
  // Pedido assim: *"medida do ecrã da esquerda para a direita em metros para a
  // posição, não preciso do resto"*. As três coordenadas do centro da imagem
  // eram certas e não serviam para nada em cima de um praticável: ninguém
  // marca um pano com um x·y·z da sala, marca-o com uma fita a contar da
  // ponta. As coordenadas da LENTE ficam, que essas são o Eye do media server.
  //
  // Só aparece onde há pano com pontas — o blend curvo. Numa cúpula não há
  // esquerda nenhuma, e na projeção simples o "ecrã" é a própria imagem.
  const comPano = quais.some((p) => p.noPano);
  const linhas = quais.map((p, i) => `<tr>
      <td><span class="quem"><span class="bolha" style="background:${corHex(p.cor || corDoProjetor(i))}"></span>${p.nome}</span></td>
      <td class="n">${nsin(p.pos.x)} · ${nsin(p.pos.y)} · ${nsin(p.pos.z)}</td>
      <td class="n">${nsin(p.alvo.x)} · ${nsin(p.alvo.y)} · ${nsin(p.alvo.z)}</td>
      ${comPano ? `<td class="n">${medidaNoPano(p)}</td>` : ""}
      <td class="n">${nnum(p.distancia)}</td>
      ${comShift ? `<td class="n">H ${pct(p.shiftH)} · V ${pct(p.shiftV)}</td>` : ""}
    </tr>`).join("");
  return `<div class="coords-rolar"><table class="coords">
    <thead><tr>
      <th>Projetor</th><th title="O centro da lente — é dele que sai o feixe, é dele que se mede a distância de tiro, e é ele que vai no Eye do media server">Centro da lente (x·y·z)</th><th title="Onde o eixo da lente bate, sem lens shift — é o Target do media server">Aponta a (x·y·z)</th>
      ${comPano ? '<th title="Onde o MEIO DA IMAGEM cai no pano, já com o lens shift — é o anel marcado na cena. Mede-se com a fita, pela superfície, a contar da ponta esquerda de quem olha para o ecrã.">No ecrã, da esquerda</th>' : ""}
      <th>Dist.</th>
      ${comShift ? "<th>Shift H · V</th>" : ""}
    </tr></thead><tbody>${linhas}</tbody></table></div>`;
}

function escreverCoordenadas() {
  const caixa = $("coordsTabela");
  const nota = $("coordsNota");
  if (!caixa) return;
  const { cupula, planos, temCupula, temPlanos } = dadosDeCoordenadas();

  if (!temCupula && !temPlanos) {
    caixa.innerHTML = "";
    if (nota) {
      nota.textContent = (projeto && projeto.dome)
        ? 'Liga a “Cúpula” na secção Vista para a app colocar os projetores e dar as coordenadas.'
        : "";
    }
    return;
  }

  let html = "";
  if (temCupula) {
    html += (temPlanos ? '<p class="vazio" style="margin:0 0 6px">Cúpula</p>' : "") +
            tabelaDeCoordenadas(cupula, "cupula", true);
  }
  if (temPlanos) {
    const queEcra = curvaAtivaDoBlend() ? "Ecrã curvo" : "Ecrã plano";
    html += (temCupula ? `<p class="vazio" style="margin:14px 0 6px">${queEcra}</p>` : "") +
            tabelaDeCoordenadas(planos, "plano");
  }
  caixa.innerHTML = html;

  if (nota) {
    // Os avisos do ecrã curvo vão dentro da notaDeLeitura(), para chegarem
    // também ao "Copiar" e à página do relatório -- ver lá.
    const linhas = notaDeLeitura(temCupula, temPlanos, true);
    nota.innerHTML = linhas.join(" ");
  }
  // O botão "Mostrar todas" e o recado só fazem sentido com cúpula à frente.
  if ($("btFatiasTodas")) $("btFatiasTodas").style.display = temCupula ? "" : "none";
  recadoDasFatias();
}

/**
 * COMO SE LEEM ESTAS COORDENADAS, E O QUE ESTRAGA A LEITURA.
 *
 * Pedido directo, depois de eu avisar o mike por escrito para avisar o colega:
 * *"podes escrever nos relatórios de instalação e ajuste que já fica
 * resolvido"*. E tem razão — um aviso que só existe numa conversa perde-se
 * assim que a folha muda de mãos. Passa a ir escrito, nos três sítios onde
 * estas coordenadas saem daqui: o painel, o texto do "Copiar" e a página do
 * relatório. Um sítio só a escrevê-lo, para os três nunca divergirem.
 *
 * O aviso das unidades NÃO é uma reserva minha: a documentação do WATCHOUT 7
 * (docs.dataton.com) descreve os campos Eye, Target, Orientation e Lense
 * Shift do 3D Projector, mas em lado nenhum diz em que unidade os lê nem qual
 * é o eixo "para cima". Escrever "são metros" era inventar uma coisa que
 * ninguém confirmou. O que a app pode dizer com verdade é o que ELA escreve,
 * e que isso se confere na máquina.
 */
function notaDeLeitura(temCupula, temPlanos, emHtml) {
  const forte = (t) => (emHtml ? "<b>" + t + "</b>" : t);
  const italico = (t) => (emHtml ? "<i>" + t + "</i>" : t);
  // Lido da mesma fonte que enche a tabela, e não passado por parâmetro: a
  // nota sai por quatro portas (painel, "Copiar", relatório, ponte) e um
  // parâmetro a mais é uma porta a poder esquecer-se dele.
  const temPano = (dadosDeCoordenadas().planos || []).some((p) => p.noPano);
  const linhas = [
    "Medidas em " + forte("metros") + ", origem no " +
      forte("centro da sala ao nível do chão") + ".",
    // QUAL É QUAL, escrito. A tabela dizia a ORDEM ("x·y·z") e mais nada: quem
    // a levava para a truss tinha de adivinhar o que era o quê, e na cena as
    // etiquetas dizem "lado/altura/fundo". Ou os dois sítios falam a mesma
    // língua, ou são duas leituras a discordar em silêncio.
    forte("x") + " é o lado (+ para a direita de quem olha para o palco), " +
      forte("y") + " é a altura acima do chão, " +
      forte("z") + " é o fundo (− para a frente, para o lado do palco). " +
      "Na cena, as etiquetas dizem estes mesmos números pelo nome e pela ordem " +
      "do painel (" + forte("lado, fundo, altura") + "); esta tabela segue a " +
      "ordem que o media server pede no " + italico("Eye") + " (x, y, z). " +
      "São os mesmos três números."
  ];
  if (temPano) {
    linhas.push(forte("No ecrã, da esquerda") + " é a medida que se tira com a " +
      "fita: metros de pano, pela superfície, da ponta esquerda até ao meio da " +
      "imagem daquele projetor. É essa a marca que o anel mostra na cena, e é " +
      "com ela que se marca o pano — as coordenadas de sala ficam para o media " +
      "server. " + forte("Esquerda de quem olha para o ecrã") + "; quem marcar " +
      "por trás conta do outro lado.");
    linhas.push("O resto da posição vertical é o " + forte("shift") +
      ", em H e V — a percentagem que se mete na máquina.");
  }
  if (temCupula) {
    linhas.push("É a mesma origem do .obj da cúpula: importa o objeto " +
      forte("sem recentrar nem reescalar") + " — basta o programa oferecer-se " +
      "para o encaixar na cena e as coordenadas deixam de bater certo, sem nada a avisar.");
  }
  linhas.push("No WATCHOUT 7, a coluna " + forte("Centro da lente") + " é o " + italico("Eye") +
    " e a coluna " + forte("Aponta a") + " é o " + italico("Target") +
    (temPlanos ? ", e o shift vai no campo " + italico("Lense Shift") + "." : "."));
  linhas.push(forte("Confirma a unidade na máquina") +
    ": a documentação do WATCHOUT não diz em que unidade lê o Eye e o Target. " +
    "Estes números são metros.");

  // O QUE O DESENHO TEVE DE CORRIGIR, escrito onde as coordenadas forem
  // parar. Um número mudado em silêncio é um número em que se confia por
  // engano -- e destes dois quem os vai montar tem de saber, porque mudam o
  // que ele vai encontrar na sala.
  const curva = curvaAtivaDoBlend();
  // RETRO. Muda o que quem monta vai encontrar na sala, e muda uma coisa que o
  // desenho NÃO mostra: o flip. Na sala o pano mostra a imagem direita nos dois
  // casos -- é para isso que se inverte no media server -- por isso desenhá-la
  // ao contrário aqui seria desenhar o erro de quem se esqueceu do flip. O que
  // não se vê tem de ir escrito.
  if (ajustes.retroDoBlend) {
    linhas.push(forte("Retroprojeção") + ": as máquinas estão " + forte("atrás do pano") +
      ", e a distância de cada uma é medida por trás — esse espaço tem de existir na sala. " +
      "A imagem vai para o projetor " + forte("invertida na horizontal") + " (flip H no media " +
      "server ou no projetor): no pano ela aparece direita, e é por isso que o desenho a " +
      "mostra direita. Ninguém na plateia tapa o feixe — só quem andar atrás do ecrã." +
      (curva ? " Num ecrã curvo visto de trás a superfície é convexa, e a mesma lente cobre " +
        "MAIS arco do que num plano: os rácios que vieram dos Calculadores já contam com isso." : ""));
  }
  if (curva && distanciaDaFilaLimitada) {
    linhas.push(forte("Distância limitada a " + nnum(distanciaDaFilaLimitada) + " m") + ": " +
      "num ecrã curvo os projetores ficam entre o centro da curvatura e a superfície, e " +
      "o raio da curva é " + nnum(curva.raio) + " m — mais do que isso punha as máquinas do " +
      "outro lado do centro, a projetar para trás.");
  }
  if (curva && luzForaDoEcra > 0.05) {
    linhas.push(forte(nnum(luzForaDoEcra) + " m de imagem fora do ecrã") + ": a esta " +
      "distância e a esta altura as lentes fazem imagens maiores do que a superfície (" +
      nnum(curva.arco) + " m de arco" + (curva.altura > 0 ? " por " + nnum(curva.altura) + " m de altura" : "") +
      "), e o que passa das bordas cai ao lado. O desenho corta no limite do " +
      "ecrã. Para caber: menos distância, lentes de rácio maior, ou outra altura de montagem.");
  }
  // O PANO FOI MOVIDO SEM AS MÁQUINAS. É uma escolha legítima -- serve
  // justamente para ver onde o feixe passa a bater -- mas quem lê as
  // coordenadas tem de saber que descrevem uma montagem desalinhada, senão
  // leva para a obra números que já não são os do projeto.
  if (curva && $("curvaLevaProjetores") && !$("curvaLevaProjetores").checked &&
      (num("curvaDx") !== 0 || num("curvaDz") !== 0)) {
    linhas.push(forte("O ecrã foi movido sem os projetores") + ": as máquinas continuam onde a " +
      "montagem as pôs e o pano andou " + nnum(num("curvaDx")) + " m para o lado e " +
      nnum(num("curvaDz")) + " m em fundo. O que está desenhado é onde a luz bate agora — não é " +
      "a montagem que os Calculadores calcularam." +
      (maquinasForaDoPano > 0
        ? " " + maquinasForaDoPano + (maquinasForaDoPano === 1
            ? " máquina já não apanha o pano de todo, e por isso não está desenhada."
            : " máquinas já não apanham o pano de todo, e por isso não estão desenhadas.")
        : ""));
  }
  // ONDE FICA O PANO, na vertical. É o que decide se o cone bate no ecrã ou
  // acima dele, e quem monta precisa do número -- pedido direto: *"a altura a
  // que fica o projetor e a proximidade vão influenciar o cone de projeção,
  // para ter noção visual e relatado"*.
  if (curva && curva.altura > 0) {
    const base = alturaDaBaseDoEcra();
    linhas.push(forte("O ecrã") + ": " + nnum(curva.arco) + " m de arco por " +
      nnum(curva.altura) + " m de altura, da base a " + nnum(base) + " m do chão ao topo a " +
      nnum(base + curva.altura) + " m. O eixo das lentes está a " + nnum(num("projAltura")) +
      " m, ou seja " + nnum(num("projAltura") - base) + " m acima da base do pano — é daí que " +
      "sai o shift vertical.");
  }
  return linhas;
}

/** As coordenadas em texto, para colar no media server ou no email da obra. */
function coordenadasEmTexto() {
  const { cupula, planos, temCupula, temPlanos } = dadosDeCoordenadas();
  if (!temCupula && !temPlanos) return "";

  const tres = (p) => [p.x, p.y, p.z].map((v) => nsin(v).padStart(7)).join("  ");
  const linhas = [
    "COORDENADAS DE MONTAGEM — " + (($("nomeProjeto") && $("nomeProjeto").value.trim()) || "sem nome"),
    ...notaDeLeitura(temCupula, temPlanos, false),
    ""
  ];
  if (temCupula) {
    const d = projeto && projeto.dome ? projeto.dome : {};
    linhas.push("CÚPULA — " + nnum(parseFloat(d.diametro) || 0) + " m de diâmetro, " +
      nnum(parseFloat(d.altura) || 0) + " m de altura, " + cupula.length + " projetor(es)");
    linhas.push("(estas são também as coordenadas do OBJ exportado)");
    cupula.forEach((p) => linhas.push(
      p.nome.padEnd(4) + "lente " + tres(p.pos) + "   aponta a " + tres(p.alvo) +
      "   " + nnum(p.distancia) + " m   " + Math.round(p.inclinacao) + "°"));
    if (temPlanos) linhas.push("");
  }
  if (temPlanos) {
    linhas.push("ECRÃ PLANO — " + planos.length + " projetor(es), a prumo com o ecrã");
    planos.forEach((p) => linhas.push(
      p.nome.padEnd(4) + "lente " + tres(p.pos) + "   aponta a " + tres(p.alvo) +
      (p.noPano ? "   no ecrã " + medidaNoPano(p) + " da esquerda" : "") +
      "   " + nnum(p.distancia) + " m" +
      ((p.shiftH || p.shiftV)
        ? "   shift H " + pct(p.shiftH) + " · V " + pct(p.shiftV)
        : "")));
  }
  return linhas.join("\n");
}

// ------------------------------------------------- o relatório, em página
//
// Pedido directo: *"os relatórios de montagem e ajustes podem sair como
// página como fizeste o que te pedi antes"*. O que sai daqui é o que já está
// no ecrã -- coordenadas, medidas e ajustes -- numa folha que se imprime, se
// anexa a um email ou se abre no telemóvel em cima da obra. Não se calcula
// nada de novo: quem faz as contas continua a ser quem desenha.

/** Só os nomes das colocações que a cúpula usa — para não sair "anel-zenite". */
const NOME_DA_COLOCACAO = {
  "centro": "todos ao centro (fisheye)",
  "anel": "em anel",
  "anel-zenite": "anel + um ao zénite",
  "anel-duplo": "anel duplo"
};

/** Um ajuste só entra no relatório se alguém lhe mexeu. */
function mexido(v) { return Math.abs(Number(v) || 0) > 0.005; }
function grausComSinal(v) {
  const n = Math.round(Number(v) || 0);
  return (n > 0 ? "+" : "−") + Math.abs(n) + "°";
}

/**
 * O que aqui difere do que veio dos Calculadores. Só o que foi mexido: uma
 * lista de zeros não diz nada a quem está a montar.
 *
 * Os projetores extra não entram — já vão, com posição e tudo, na tabela de
 * coordenadas acima. Escrevê-los duas vezes era dar duas respostas à mesma
 * pergunta, e um dia elas deixavam de bater certo.
 */
function resumoDeAjustes() {
  const grupos = [];
  if (!projeto) return grupos;
  const dist = (v) => nsin(v) + " m";

  const linhasDelay = [];
  for (const z of projeto.zonas) {
    if (z.tipo === "led") continue;
    const a = ajustes.delays[z.nome];
    if (!a) continue;
    const partes = [];
    if (mexido(a.dx)) partes.push("lado " + dist(a.dx));
    if (mexido(a.dz)) partes.push("fundo " + dist(a.dz));
    if (mexido(a.dy)) partes.push("altura " + dist(a.dy));
    if (mexido(a.rot)) partes.push("rodado " + grausComSinal(a.rot));
    if (mexido(a.tilt)) partes.push("tilt " + grausComSinal(a.tilt));
    if (partes.length) {
      linhasDelay.push({ quem: z.nome + (z.tipo === "tv" ? " (TV)" : " (projeção)"), texto: partes.join(" · ") });
    }
  }
  if (linhasDelay.length) grupos.push({ titulo: "Ecrãs mexidos na sala", linhas: linhasDelay });

  const numDsm = (projeto.dsm && projeto.dsm.n) ? projeto.dsm.n : 0;
  const linhasDsm = [];
  for (let i = 0; i < numDsm; i++) {
    const a = ajustes.dsm[i];
    if (!a) continue;
    const partes = [];
    if (mexido(a.dx)) partes.push("lado " + dist(a.dx));
    if (mexido(a.dz)) partes.push("fundo " + dist(a.dz));
    if (mexido(a.rot)) partes.push("rodado " + grausComSinal(a.rot));
    if (mexido(a.tilt)) partes.push("tilt " + grausComSinal(a.tilt));
    if (partes.length) linhasDsm.push({ quem: "DSM " + (i + 1), texto: partes.join(" · ") });
  }
  if (linhasDsm.length) grupos.push({ titulo: "DSM", linhas: linhasDsm });

  const linhasPalco = ajustes.palcosExtra.map((p, i) => ({
    quem: "Palco " + (i + 2),
    texto: nnum(p.largura) + " × " + nnum(p.profundidade) + " m, " + nnum(p.altura) + " m de alto" +
      " · em " + nsin(p.dx) + " / " + nsin(p.dz) +
      (mexido(p.rot) ? " · rodado " + grausComSinal(p.rot) : "") +
      (mexido(p.raio) ? " · arredondado " + nnum(p.raio) + " m" : "")
  }));
  if (linhasPalco.length) grupos.push({ titulo: "Palcos acrescentados aqui", linhas: linhasPalco });

  const linhasRegie = ajustes.regiesExtra.map((r, i) => ({
    quem: "Régie " + (i + 2),
    texto: nnum(r.largura) + " × " + nnum(r.profundidade) + " m · em " + nsin(r.dx) + " / " + nsin(r.dz) +
      (mexido(r.rot) ? " · rodada " + grausComSinal(r.rot) : "")
  }));
  if (linhasRegie.length) grupos.push({ titulo: "Régies acrescentadas aqui", linhas: linhasRegie });

  const linhasPassarela = ajustes.passarelasExtra.map((p, i) => ({
    quem: "Passarela " + (i + 1),
    texto: nnum(p.largura) + " × " + nnum(p.comprimento) + " m, " + nnum(p.altura) + " m de alto" +
      " · em " + nsin(p.dx) + " / " + nsin(p.dz) +
      (mexido(p.rot) ? " · rodada " + grausComSinal(p.rot) : "")
  }));
  if (linhasPassarela.length) grupos.push({ titulo: "Passarelas", linhas: linhasPassarela });

  return grupos;
}

/**
 * A marca para o cabeçalho da folha. Vai em data URL porque a página tem de
 * abrir sozinha, sem a app e sem rede — é para isso que ela serve.
 */
let marcaRelatorioPromise = null;
function marcaDoRelatorio() {
  if (!marcaRelatorioPromise) {
    marcaRelatorioPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const folha = document.createElement("canvas");
          folha.width = img.naturalWidth; folha.height = img.naturalHeight;
          folha.getContext("2d").drawImage(img, 0, 0);
          resolve(folha.toDataURL("image/png"));
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = "icons/mike-marca-branco.png";
    });
  }
  return marcaRelatorioPromise;
}

/**
 * A vista, em JPEG e não em PNG: um render 3D com degradês faz um PNG de
 * megabytes, e esta imagem viaja dentro do próprio HTML. A largura fica pelos
 * 1600 px, que chega para imprimir em A4 e não faz uma folha que não abre.
 */
function vistaParaRelatorio() {
  if (!renderizador || !tela) return null;
  try {
    renderizador.render(cena, camara);
    const largura = Math.min(1600, tela.width);
    if (largura === tela.width) return tela.toDataURL("image/jpeg", 0.88);
    const folha = document.createElement("canvas");
    folha.width = largura;
    folha.height = Math.round(tela.height * (largura / tela.width));
    const p = folha.getContext("2d");
    p.fillStyle = "#0E1418";
    p.fillRect(0, 0, folha.width, folha.height);
    p.drawImage(tela, 0, 0, folha.width, folha.height);
    return folha.toDataURL("image/jpeg", 0.88);
  } catch (e) {
    return null;   // canvas "sujo" (uma textura de outro sítio) — a folha sai sem imagem
  }
}

async function guardarRelatorio() {
  const nota = $("notaExportar");
  const { cupula, planos, temCupula, temPlanos } = dadosDeCoordenadas();
  const sala = lerSala();
  const agora = new Date();

  const medidasSala = [
    ["Sala", nnum(sala.largura) + " × " + nnum(sala.profundidade) + " m"],
    ["Pé-direito", nnum(sala.altura) + " m"]
  ];
  if ($("verPalco") && $("verPalco").checked) {
    const palco = lerPalco();
    medidasSala.push(["Palco", nnum(palco.largura) + " × " + nnum(palco.profundidade) +
      " m, " + nnum(palco.altura) + " m de alto"]);
  }
  // A lotação é a que o rodapé mostra — quem a conta é a cobertura, e é de lá
  // que ela tem de vir para não haver duas contagens diferentes na mesma app.
  const lugares = $("rodape") ? $("rodape").textContent.trim() : "";
  if (lugares && lugares !== "—") medidasSala.push(["Público", lugares]);

  let medidasDome = null, tituloDome = "", notaDome = "", desenhoDome = null, faltaFicha = false;
  if (temCupula && projeto && projeto.dome) {
    const d = projeto.dome;
    const pr = d.projetores || {};
    const med = medidasDaCupula(d);
    // O QUE SÓ ESTE LADO SABE: onde a imagem começa. Sai da geometria da
    // cúpula com a altura de montagem, e é a medida que decide onde o .obj da
    // área de projeção corta -- não existe do lado da calculadora.
    const baseDaImagem = ["Base da imagem",
      med && med.yBaseDaImagem > 0 ? nnum(med.yBaseDaImagem) + " m" : "chega ao chão"];

    // A ficha vem dos Calculadores já escrita (área, dome master, resolução
    // angular, aproveitamento, luz) -- ver ficha em projeto.js. Quando ela
    // existe MANDA, porque diz tudo o que as quatro linhas abaixo diziam e
    // mais doze. Repetir as duas versões era pôr a mesma coisa duas vezes na
    // mesma folha, com formatos diferentes.
    // O QUE DESENHAR: a planta e o corte saem dos MESMOS pontos que enchem a
    // tabela das coordenadas, para nunca haver um desenho a discordar de um
    // número na mesma folha. Só se juntam aqui; quem os desenha é o relatório.
    desenhoDome = {
      diametro: med ? med.diametro : (parseFloat(d.diametro) || 0),
      raioBase: med ? med.raioBase : (parseFloat(d.diametro) || 0) / 2,
      altura: med ? med.altura : (parseFloat(d.altura) || 0),
      R: med ? med.R : 0,
      cy: med ? med.cy : 0,
      yBase: med && med.yBaseDaImagem > 0 ? med.yBaseDaImagem : 0,
      projetores: cupula.map((p) => ({
        nome: p.nome, cor: p.cor,
        x: p.pos.x, y: p.pos.y, z: p.pos.z,
        alvoX: p.alvo.x, alvoY: p.alvo.y, alvoZ: p.alvo.z,
        inclinacao: p.inclinacao
      }))
    };

    const ficha = d.ficha;
    if (ficha && ficha.pares && ficha.pares.length) {
      medidasDome = ficha.pares.concat([baseDaImagem]);
      tituloDome = ficha.titulo || "";
      notaDome = ficha.nota || "";
    } else {
      // Sem ficha (um projeto guardado antes da v3.92 dos Calculadores, ou uma
      // cúpula colada à mão) fica o que sempre houve. Menos, mas nunca vazio --
      // e a folha DIZ que está a mostrar menos e porquê, senão quem a lê acha
      // que é tudo o que há. Foi o que aconteceu à primeira folha tirada depois
      // da v3.92: o projeto guardado ainda era da versão anterior.
      faltaFicha = true;
      medidasDome = [
        ["Diâmetro", nnum(parseFloat(d.diametro) || 0) + " m"],
        ["Altura", nnum(parseFloat(d.altura) || 0) + " m"],
        ["Projetores", String(cupula.length)],
        ["Montagem", NOME_DA_COLOCACAO[pr.colocacao] || pr.colocacao || ""],
        ["Lentes a", pr.altura > 0 ? nnum(parseFloat(pr.altura)) + " m do chão" : ""],
        ["Blend", pr.blend > 0 ? Math.round(pr.blend * 100) + " %" : ""],
        baseDaImagem
      ];
    }
  }

  let medidasPlano = null;
  if (temPlanos) {
    const p = lerProjecao();
    const largura = p.distancia / p.racio;
    medidasPlano = [
      ["Projetores", String(planos.length)],
      ["Máquina", ajustes.projetor ? [ajustes.projetor.modelo, ajustes.projetor.lente].filter(Boolean).join(" · ") : ""],
      ["Rácio", nnum(p.racio) + ":1"],
      ["Distância", nnum(p.distancia) + " m"],
      ["Imagem (cada)", nnum(largura) + " × " + nnum(largura / formatoImagem) + " m"]
    ];
  }

  const html = paginaDeRelatorio({
    nome: ($("nomeProjeto") && $("nomeProjeto").value.trim()) || (projeto && projeto.nome) || "",
    quando: agora.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }) +
            ", " + agora.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
    versao: $("versao") ? $("versao").textContent.trim() : "",
    logo: await marcaDoRelatorio(),
    imagem: vistaParaRelatorio(),
    sala: medidasSala,
    dome: medidasDome,
    domeTitulo: tituloDome,
    domeNota: notaDome,
    desenhoDome: desenhoDome,
    faltaFicha: faltaFicha,
    // O throw ratio da lente, para a folha dizer o que se mete no campo
    // "Width / Distance" do WATCHOUT — que é o inverso dele.
    lenteThrow: (projeto && projeto.dome && projeto.dome.projetores &&
                 projeto.dome.projetores.lenteThrow) || null,
    plano: medidasPlano,
    coordsCupula: temCupula ? tabelaDeCoordenadas(cupula, "cupula") : "",
    coordsPlanos: temPlanos ? tabelaDeCoordenadas(planos, "plano") : "",
    nota: notaDeLeitura(temCupula, temPlanos, true),
    ajustes: resumoDeAjustes(),
    deposito: pecasNoDeposito().map((p) => p.nome + " · " + p.detalhe)
  });

  descarregar(new Blob([html], { type: "text/html;charset=utf-8" }), nomeDoFicheiro("html"));
  if (nota) nota.textContent = "Relatório guardado. Abre em qualquer browser, sem a app e sem internet — e imprime em A4.";
}

function caixasQueTapam() {
  const caixas = [];

  const figura = desenhado && desenhado.getObjectByName("figura");
  if (figura) {
    figura.updateMatrixWorld(true);
    // Peça a peça e não a figura toda: uma caixa à volta de uma pessoa é um
    // caixote, e a sombra dele na tela é um rectângulo que ninguém reconhece.
    // Assim vêem-se a cabeça, os ombros e as pernas — e é pela cabeça que se
    // percebe se aquilo apanha a cara de quem está a falar.
    const c = new THREE.Box3();
    figura.traverse((o) => {
      if (!o.isMesh || o.name.indexOf("aux:") === 0) return;   // o crachá não faz sombra
      c.setFromObject(o);
      caixas.push({ dele: "orador",
                    minX: c.min.x, maxX: c.max.x, minY: c.min.y, maxY: c.max.y,
                    minZ: c.min.z, maxZ: c.max.z });
    });
  }

  if (corposDoPublico && corposDoPublico.corpos) {
    const { corpos, largura, fundura } = corposDoPublico;
    for (let i = 0; i < corpos.length; i += 4) {
      const x = corpos[i], topo = corpos[i + 1], z = corpos[i + 2], chao = corpos[i + 3];
      caixas.push({ dele: "publico",
                    minX: x - largura / 2, maxX: x + largura / 2,
                    minY: chao, maxY: topo,
                    minZ: z - fundura / 2, maxZ: z + fundura / 2 });
    }
  }
  return caixas;
}

/**
 * Quanto e que a imagem leva de sombra.
 *
 * A primeira versao atirava 45 raios da lente para a tela e contava os que
 * batiam no orador -- e dava sempre zero, porque os pontos ficavam a quase um
 * metro uns dos outros e uma pessoa tem 58 cm: passava entre as amostras.
 * Depois passou a projectar a caixa que o envolve, que e exacto para UM.
 *
 * Com a plateia toda, somar as caixas uma a uma contaria duas vezes as que se
 * sobrepoem -- e numa sala cheia sobrepoem-se quase todas, o que daria sombras
 * de 300%. Por isso a imagem parte-se numa grelha e conta-se quantas casas
 * ficam tapadas por alguem: a sobreposicao resolve-se sozinha.
 */
const COLUNAS_SOMBRA = 128, LINHAS_SOMBRA = 72;
const grelhaSombra = new Uint8Array(COLUNAS_SOMBRA * LINHAS_SOMBRA);

function medirSombra() {
  if (!projecaoAtual) { $("resumoProj").textContent = "—"; return; }
  const { projetor, imagem, foraDaSala } = projecaoAtual;

  // A sombra calcula-se, não se amostra. A primeira versão atirava 45 raios
  // para a tela e contava os que batiam no orador — e dava sempre zero, porque
  // os pontos ficavam a quase um metro uns dos outros e uma pessoa tem 58 cm:
  // ela passava entre as amostras. Agora projeta-se a caixa que a envolve a
  // partir da lente e mede-se a área que ela tapa. É exacto e não treme.
  grelhaSombra.fill(0);
  const eEsq = imagem.x - imagem.largura / 2;
  const eBaixo = imagem.y - imagem.altura / 2;
  const ate = imagem.z - projetor.z;

  let sombraDoOrador = 0;
  let gentePeloMeio = 0;
  const manchas = [];        // os rectangulos a pintar, ja recortados na imagem

  for (const caixa of caixasQueTapam()) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let aFrente = false;
    for (const cx of [caixa.minX, caixa.maxX]) {
      for (const cy of [caixa.minY, caixa.maxY]) {
        for (const cz of [caixa.minZ, caixa.maxZ]) {
          const dz = cz - projetor.z;
          // só conta quem está ENTRE a lente e a tela
          if (dz === 0 || dz / ate <= 0 || dz / ate >= 1) continue;
          aFrente = true;
          const k = ate / dz;
          const px = projetor.x + (cx - projetor.x) * k;
          const py = projetor.y + (cy - projetor.y) * k;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
    }
    if (!aFrente) continue;

    const c1 = Math.max(0, Math.floor((minX - eEsq) / imagem.largura * COLUNAS_SOMBRA));
    const c2 = Math.min(COLUNAS_SOMBRA - 1,
                        Math.ceil((maxX - eEsq) / imagem.largura * COLUNAS_SOMBRA) - 1);
    const l1 = Math.max(0, Math.floor((minY - eBaixo) / imagem.altura * LINHAS_SOMBRA));
    const l2 = Math.min(LINHAS_SOMBRA - 1,
                        Math.ceil((maxY - eBaixo) / imagem.altura * LINHAS_SOMBRA) - 1);
    if (c2 < c1 || l2 < l1) continue;

    if (caixa.dele === "publico") gentePeloMeio++;

    // O que se conta e o que se pinta sai da mesma projeccao: se um dia
    // discordarem, e porque alguem mexeu num sitio e nao no outro.
    const eDir = imagem.x + imagem.largura / 2;
    const eCima = imagem.y + imagem.altura / 2;
    const rx1 = Math.max(minX, eEsq), rx2 = Math.min(maxX, eDir);
    const ry1 = Math.max(minY, eBaixo), ry2 = Math.min(maxY, eCima);
    if (rx2 > rx1 && ry2 > ry1 && manchas.length < 1200) {
      manchas.push(rx1, ry1, rx2, ry2);
    }

    let casas = 0;
    for (let l = l1; l <= l2; l++) {
      for (let c = c1; c <= c2; c++) {
        grelhaSombra[l * COLUNAS_SOMBRA + c] = 1;
        casas++;
      }
    }
    if (caixa.dele === "orador") sombraDoOrador += casas / grelhaSombra.length;
  }

  let tapadas = 0;
  for (let i = 0; i < grelhaSombra.length; i++) tapadas += grelhaSombra[i];
  const sombra = tapadas / grelhaSombra.length;

  const emPercentagem = (v) => {
    const n = Math.round(v * 100);
    return n < 1 ? "menos de 1%" : n + "%";
  };
  $("resumoProj").innerHTML =
    `Imagem <b>${imagem.largura.toFixed(2)} × ${imagem.altura.toFixed(2)} m</b>` +
    ` · base a <b>${projecaoAtual.base.toFixed(2)} m</b>` +
    (sombra > 0.0005
      ? ` · sombra <b>${emPercentagem(sombra)}</b>` +
        (gentePeloMeio
          ? ` (${gentePeloMeio} no feixe` +
            (sombraDoOrador > 0.0005 ? `, orador ${emPercentagem(sombraDoOrador)}` : "") + ")"
          : "")
      : "") +
    (foraDaSala ? " · <b>não cabe na sala</b>" : "");

  // O aviso do shift vem depois e não no meio: a primeira linha é o que se
  // mede, esta é o que a lente não dá.
  const excesso = shiftForaDaLente();
  if (excesso) $("resumoProj").innerHTML += ` · <b>shift a mais</b>: ${excesso}`;

  pintarSombra(manchas, imagem);
}

/**
 * A sombra, desenhada.
 *
 * Ate aqui ela era medida e nada mais: saia uma percentagem no resumo e o
 * desenho ficava exactamente igual, o que e o mesmo que dizer que nao estava
 * la. E "quanto e que aquilo tapa" e uma pergunta que se responde a olhar, nao
 * a ler -- ninguem quer saber que sao 8%, quer saber se apanha a cara de quem
 * esta a falar.
 *
 * Sao rectangulos chapados por cima da imagem, um por corpo, ja recortados nos
 * limites dela. Nao ha penumbra: uma lente nao e um ponto e as bordas a serio
 * sao suaves, mas isto e um preview de montagem e uma sombra nitida le-se
 * melhor do que uma bonita.
 */
function pintarSombra(manchas, imagem) {
  if (!desenhado) return;
  const velha = desenhado.getObjectByName("aux:sombra");
  if (velha) {
    desenhado.remove(velha);
    velha.geometry.dispose();
  }
  if (!manchas.length) return;

  const quantas = manchas.length / 4;
  const vertices = new Float32Array(quantas * 6 * 3);
  // Uma frincha a frente da imagem: no mesmo plano, o motor nao sabe qual das
  // duas fica por cima e a sombra pisca conforme a camara anda.
  const z = imagem.z + 0.03;
  for (let i = 0; i < quantas; i++) {
    const x1 = manchas[i * 4], y1 = manchas[i * 4 + 1];
    const x2 = manchas[i * 4 + 2], y2 = manchas[i * 4 + 3];
    const k = i * 18;
    const pontos = [x1, y1, x2, y1, x2, y2, x1, y1, x2, y2, x1, y2];
    for (let j = 0; j < 6; j++) {
      vertices[k + j * 3] = pontos[j * 2];
      vertices[k + j * 3 + 1] = pontos[j * 2 + 1];
      vertices[k + j * 3 + 2] = z;
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  const malha = new THREE.Mesh(geometria, materialDaSombra);
  malha.name = "aux:sombra";
  malha.renderOrder = 3;
  desenhado.add(malha);
}

// Preto a 62%: uma sombra de projector nao e preta -- a luz ambiente cai la
// dentro na mesma -- e uma mancha opaca fazia parecer que aquilo era um buraco.
const materialDaSombra = new THREE.MeshBasicMaterial({
  color: 0x05070A, transparent: true, opacity: 0.62,
  depthWrite: false, side: THREE.DoubleSide, toneMapped: false
});

function avisarSeNaoCabe(medidas, sala, palco) {
  const altoDemais = palco.altura + palco.acimaDoPalco + medidas.altura;
  const problemas = [];
  if (medidas.largura > sala.largura) {
    problemas.push(`o conjunto tem ${medidas.largura.toFixed(2)} m e a sala ${sala.largura} m de largura ` +
      `<button type="button" class="aviso-link" data-secao="sSala">Ajustar Sala</button>`);
  }
  if (altoDemais > sala.altura) {
    problemas.push(`o topo fica a ${altoDemais.toFixed(2)} m e o pé-direito é ${sala.altura} m ` +
      `<button type="button" class="aviso-link" data-secao="sPalco">Ajustar Palco</button>`);
  }
  const aviso = $("aviso");
  if (problemas.length) {
    aviso.innerHTML = "Não cabe: " + problemas.join("; ") + ".";
    aviso.classList.add("mostra");
  }
}

// A cobertura da plateia: para cada lugar sentado, cada zona diz se o vê
// bem, mal ou nada. Substitui o aviso genérico da v2.26 (só dizia
// "há um ecrã rodado de mais") -- este diz QUEM fica sem ver ecrã
// nenhum, em que bloco, e desenha-o na cena se for pedido.
//
// Convenção do cálculo (a mesma que já vinha da v2.26): cada
// zona tem um referencial próprio com Z positivo a apontar para a
// plateia; o "rot" de um delay roda esse referencial à volta do eixo
// vertical. Horizontal e vertical são os ângulos entre um espectador
// e o eixo central desse referencial.
// Ângulo horizontal: a mesma regra SMPTE EG-18-1994 que os Calculadores já
// citam na aba "Distância de Visualização" (com fonte ligada lá) -- até 30°
// é o recomendado, entre 30° e 35° "ainda aceitável, mas no limite", acima
// de 35° a maioria já sente desconforto. Antes disto o Preview tinha os
// seus próprios números (20°/30°) para o mesmo efeito -- pedido direto para
// as duas apps usarem a MESMA regra, não duas parecidas.
const LIMITE_HORIZONTAL = 35;
const CONFORTAVEL_HORIZONTAL = 30;
// Vertical não tem norma equivalente nos Calculadores (que não modelam a
// sala em 3D) -- fica só do Preview, a mesma proporção 2/3 de sempre, para
// apanhar um ecrã montado alto/baixo de mais que o ângulo horizontal sozinho
// não via.
const LIMITE_VERTICAL = 15;
const CONFORTAVEL_VERTICAL = 10;
// A distância também entra na regra, não só o ângulo: um lugar pode estar
// exactamente em frente do ecrã e ainda assim longe de mais para ler o que
// lá está. Antes eram 8/10 alturas de imagem, sem norma nenhuma por trás --
// agora são os dois primeiros níveis do "AVIXA 4-6-8" que os Calculadores já
// usam (mesma aba): 6 é o limite para "detalhe normal, a maioria das
// apresentações" (o nível "basic", o que este Preview mostra por omissão),
// 8 é o limite mais largo para "pouco detalhe, vídeo" (o nível "passive") --
// além disso já nem esse conteúdo mais permissivo se lê. Fica de fora o
// mínimo do AVIXA (altura × 2, para não ficar perto de mais): a esse a
// pergunta certa é vertical, não distância -- um lugar mesmo à frente de um
// ecrã alto já fica marcado pelo ângulo vertical, que mede exactamente isso.
const CONFORTAVEL_DISTANCIA_ALTURA = 6;
const LIMITE_DISTANCIA_ALTURA = 8;

// A partir da v2.87, quem escolhe a regra de distância deixou de ser só este
// ficheiro: a aba "Distância de Visualização" dos Calculadores manda o
// standard que o mike escolheu lá (largura×THX, largura×sweet spot ou
// AVIXA/altura, conforme o nível de detalhe) dentro do payload do projeto --
// pedido direto para as duas apps usarem sempre a MESMA regra, em vez de o
// Preview ter uma fixa por conta própria. Quando não há standard nenhum
// (projeto antigo, ou vindo doutra origem sem essa aba), cai nos valores por
// omissão de sempre. Mantém-se a MESMA proporção 6/8 (0,75) que os valores
// por omissão já usavam, só aplicada ao limite do standard escolhido -- não
// inventa nenhuma proporção nova, reaproveita a que já existia.
function regraDeDistancia(projetoAtual) {
  const vis = window.mikeappsVisualizacao;
  const areaPorOmissao = vis ? vis.MODO_POR_OMISSAO : "16-9";
  const std = projetoAtual && projetoAtual.standard;
  if (!std || !std.max) {
    return { basis: "height", confortavel: CONFORTAVEL_DISTANCIA_ALTURA,
             limite: LIMITE_DISTANCIA_ALTURA, label: null, area: areaPorOmissao };
  }
  return {
    basis: std.basis,
    confortavel: std.max * (CONFORTAVEL_DISTANCIA_ALTURA / LIMITE_DISTANCIA_ALTURA),
    limite: std.max,
    label: std.label || null,
    // Quanto do ecrã é que a conta usa -- ver segmentosDeZona(). Um projeto
    // guardado antes deste interruptor não traz nada aqui e fica com o que a
    // app já fazia.
    area: std.area || areaPorOmissao
  };
}

function contextoDeZonas(projetoAtual, medidas, sala, palco) {
  return {
    esquerda: Math.min(...projetoAtual.zonas.map(z => z.x)),
    fundo: Math.max(...projetoAtual.zonas.map(z => z.y + z.h)),
    meio: medidas.largura / 2,
    base: palco.altura + palco.acimaDoPalco,
    z0: -sala.profundidade / 2 + 0.35
  };
}

function centroDeZona(zona, ajusteZona, ctx) {
  const aj = ajusteZona || {};
  return {
    centroX: (zona.x - ctx.esquerda) + zona.w / 2 - ctx.meio + (Number(aj.dx) || 0),
    centroY: ctx.base + (ctx.fundo - (zona.y + zona.h)) + zona.h / 2 + (Number(aj.dy) || 0),
    centroZ: ctx.z0 + (Number(aj.dz) || 0),
    rotacao: -(Number(aj.rot) || 0) * Math.PI / 180
  };
}

// Um ecrã muito mais largo que 16:9 (um LED wall grande, um blend de vários
// projetores) avaliado a partir de um único ponto central subestima o
// conforto de quem está de lado -- essa pessoa está, na prática, a olhar
// para a fatia mais próxima do ecrã, não para o centro do ecrã inteiro.
// Pedido direto: "continua a marcar o centro em vez de dividir quando cabem
// dois ou mais 16/9". Quando cabem 2+ larguras de 16:9 (a proporção mais
// comum de conteúdo) ao longo da largura real do ecrã, a Cobertura passa a
// tratar cada fatia como o seu próprio ponto de vista -- cada uma com a
// mesma altura do ecrã original (a divisão é só horizontal), a sua própria
// posição, e a sua própria largura (usada quando o standard escolhido é
// largura-base, ex. THX). Um ecrã normal (até ~2 larguras de 16:9) continua
// com um único centro, exatamente como antes.
// E A PARTIR DE AGORA QUEM MANDA NISTO É O INTERRUPTOR DOS CALCULADORES.
//
// Pedido: *"devia ter um switch para essa conta, se área total se apenas
// 16/9 -- e medir o conforto de visualização também com essa regra aplicada
// consoante o seletor indicar"*. Até aqui esta divisão era uma regra fixa só
// deste ficheiro, e os Calculadores contavam sempre com a largura toda: num
// ecrã de 20×5 um dizia 20 m e o outro 10 m, para a mesma pergunta e no mesmo
// projeto. A regra mudou-se para js/visualizacao.js, que é o mesmo ficheiro
// nas duas apps, e o modo escolhido vem no payload (standard.area).
//
// Sem escolha nenhuma (projeto antigo, ou de outra origem) fica o 16/9, que é
// o que este ficheiro já fazia -- um projeto guardado não muda de conforto por
// ter sido aberto num dia diferente.
function segmentosDeZona(zona, modoDeArea) {
  if (!zona.h) return [zona];
  const vis = window.mikeappsVisualizacao;
  const modo = modoDeArea || (vis ? vis.MODO_POR_OMISSAO : "16-9");
  if (modo === "total") return [zona];
  const n = vis ? vis.fatiasDeEcra(zona.w, zona.h)
                : Math.max(1, Math.floor(zona.w / (zona.h * (16 / 9))));
  if (n < 2) return [zona];
  const wSeg = zona.w / n;
  const segmentos = [];
  for (let k = 0; k < n; k++) {
    segmentos.push({ ...zona, x: zona.x + k * wSeg, w: wSeg });
  }
  return segmentos;
}

// O ângulo com que UM espectador vê UMA zona, no referencial dessa
// zona, e a distância a que está dela. Devolve null quando está atrás
// do ecrã (localZ <= 0): daí ninguém vê nada.
function anguloDePessoa(centro, corpos, i) {
  const dx = corpos[i] - centro.centroX;
  const dy = corpos[i + 1] - centro.centroY;
  const dz = corpos[i + 2] - centro.centroZ;
  const localX = dx * Math.cos(centro.rotacao) - dz * Math.sin(centro.rotacao);
  const localZ = dx * Math.sin(centro.rotacao) + dz * Math.cos(centro.rotacao);
  if (localZ <= 0.01) return null;
  const distanciaHorizontal = Math.hypot(localX, localZ);
  return {
    horizontal: Math.abs(Math.atan2(localX, localZ) * 180 / Math.PI),
    vertical: Math.abs(Math.atan2(dy, distanciaHorizontal) * 180 / Math.PI),
    distancia: Math.hypot(localX, localZ, dy)
  };
}

/**
 * Cobertura de toda a plateia: por lugar (0 vermelho, 1 amarelo, 2 verde),
 * por zona (quantos lugares conseguem ver essa zona) e por bloco (quantos
 * ficam sem nenhum ecrã), para o painel e para o mapa na cena saberem
 * o mesmo que este cálculo sabe.
 */
function calcularCobertura(projetoAtual, medidas, sala, palco, gente) {
  if (!projetoAtual || !projetoAtual.zonas.length || !medidas
    || !gente || !gente.corpos || !gente.corpos.length) return null;

  const ctx = contextoDeZonas(projetoAtual, medidas, sala, palco);
  // Um ecrã marcado "sem leitura" (complemento visual, sem texto para ler)
  // fica fora da Cobertura -- pedido direto: "nem todos são para slides mas
  // sim para complemento visual sem necessidade de leitura". Sem isto, um
  // lugar mal posicionado para o ecrã principal podia aparecer "confortável"
  // só por ter boa vista de um ecrã ambiente ao lado — o "melhor de todas as
  // zonas" abaixo estaria a comparar coisas que não pedem a mesma coisa. Se
  // TODos os ecrãs estiverem marcados assim (caso raro), usa-se a lista toda
  // na mesma — mostrar "sem cobertura" em todo o lado seria mais enganador
  // do que útil.
  const semLeitura = new Set(ajustes.zonasSemLeitura || []);
  const zonasParaCobertura = projetoAtual.zonas.filter(z => !semLeitura.has(z.nome));
  const zonasBase = zonasParaCobertura.length ? zonasParaCobertura : projetoAtual.zonas;
  // Um ecrã muito largo vira vários "zi" aqui (um por segmento de 16:9) --
  // todos apontam para a MESMA zona original (zi.zona), só o ponto de vista
  // (zi.centro) e a largura usada na conta de distância (zi.segmento.w)
  // mudam por fatia. Ver segmentosDeZona().
  const regraDistancia = regraDeDistancia(projetoAtual);
  const zonasInfo = [];
  zonasBase.forEach(zona => {
    const ajusteZona = ajustes.delays[zona.nome];
    segmentosDeZona(zona, regraDistancia.area).forEach(segmento => {
      zonasInfo.push({ zona, segmento, centro: centroDeZona(segmento, ajusteZona, ctx), comLugares: 0 });
    });
  });

  const n = gente.corpos.length / 4;
  const corPorLugar = new Uint8Array(n);
  let confortaveis = 0, marginais = 0, semCobertura = 0;
  const porBloco = new Map();

  for (let idx = 0; idx < n; idx++) {
    const i = idx * 4;
    let melhor = 0;
    for (const zi of zonasInfo) {
      const ang = anguloDePessoa(zi.centro, gente.corpos, i);
      if (!ang || ang.horizontal > LIMITE_HORIZONTAL || ang.vertical > LIMITE_VERTICAL) continue;
      // A distância mede-se em "alturas de imagem" (ou larguras, para um
      // standard largura-base como o THX): um ecrã de 4 m aceita gente até
      // 40 m (10×), um delay de 0,9 m já não aceita passar dos 9 m. Em
      // largura usa-se a largura do SEGMENTO (não do ecrã inteiro), para um
      // ecrã muito largo não parecer aceitar gente muito mais longe só por
      // ser fisicamente maior -- a altura não muda com a divisão.
      const baseZona = regraDistancia.basis === "width" ? zi.segmento.w : zi.zona.h;
      const distanciaEmAlturas = ang.distancia / baseZona;
      if (distanciaEmAlturas > regraDistancia.limite) continue;
      zi.comLugares++;
      const confortavel = ang.horizontal <= CONFORTAVEL_HORIZONTAL && ang.vertical <= CONFORTAVEL_VERTICAL
        && distanciaEmAlturas <= regraDistancia.confortavel;
      melhor = Math.max(melhor, confortavel ? 2 : 1);
    }
    corPorLugar[idx] = melhor;
    if (melhor === 2) confortaveis++;
    else if (melhor === 1) marginais++;
    else semCobertura++;

    const bloco = (gente.blocoPorLugar && gente.blocoPorLugar.length > idx) ? gente.blocoPorLugar[idx] : 0;
    if (!porBloco.has(bloco)) porBloco.set(bloco, { sem: 0, total: 0 });
    const registo = porBloco.get(bloco);
    registo.total++;
    if (melhor === 0) registo.sem++;
  }

  const blocos = [...porBloco.entries()]
    .map(([bloco, r]) => ({ bloco, sem: r.sem, total: r.total }))
    .sort((a, b) => a.bloco - b.bloco);
  const piorBloco = blocos.reduce((pior, b) => (!pior || b.sem > pior.sem) ? b : pior, null);

  // "Sem ninguém a ver" é por ecrã REAL, não por segmento -- um ecrã largo
  // dividido em 3 fatias só entra nesta lista se NENHUMA das três tiver
  // lugares, senão "zi.comLugares === 0" de uma fatia isolada acusava
  // erradamente um ecrã que, no total, tem gente a vê-lo perfeitamente.
  const comLugaresPorZona = new Map();
  const ordemZonas = [];
  zonasInfo.forEach(zi => {
    if (!comLugaresPorZona.has(zi.zona)) { comLugaresPorZona.set(zi.zona, 0); ordemZonas.push(zi.zona); }
    comLugaresPorZona.set(zi.zona, comLugaresPorZona.get(zi.zona) + zi.comLugares);
  });

  return {
    totalLugares: n, confortaveis, marginais, semCobertura, corPorLugar,
    zonasSemCobertura: ordemZonas.filter(z => !comLugaresPorZona.get(z)).map(z => z.nome),
    blocos, piorBloco: (piorBloco && piorBloco.sem > 0) ? piorBloco : null,
    regraLabel: regraDistancia.label,
    // QUE LUGARES, e não só quantos -- ver moradasSemCobertura().
    semCoberturaOnde: moradasSemCobertura(gente, corPorLugar)
  };
}

/**
 * OS LUGARES QUE FICAM SEM VER, PELO NOME.
 *
 * *"Assim serve de coordenadas"*, a olhar para a plateia com as filas em
 * letras e os lugares numerados. E serve mesmo: até aqui a Cobertura dizia
 * *"bloco 2: 14 lugares sem ecrã"*, que conta mas não localiza -- ninguém
 * consegue ir à sala tirar catorze cadeiras que não sabe quais são. É a
 * mesma conta; o que muda é dizer ONDE.
 *
 * Os lugares seguidos juntam-se num intervalo ("lugares 1-8") porque catorze
 * números em fila eram outra vez uma lista para ninguém ler. E a lista de
 * filas corta-se nas primeiras: quem tem meia plateia sem ver não precisa de
 * as ver todas escritas, precisa de mexer no ecrã.
 */
const FILAS_A_LISTAR = 6;
function moradasSemCobertura(gente, corPorLugar) {
  if (!gente || !gente.filaPorLugar || !gente.filaPorLugar.length) return [];
  // Agrupa por (gomo, fila) -- em "Circular" há uma fila A por gomo, e uma
  // morada sem o gomo não encontra ninguém.
  const porFila = new Map();
  for (let i = 0; i < corPorLugar.length; i++) {
    if (corPorLugar[i] !== 0) continue;                       // 0 = sem cobertura
    const gomo = gente.gomoPorLugar ? gente.gomoPorLugar[i] : 0;
    const fila = gente.filaPorLugar[i];
    const chave = gomo + ":" + fila;
    if (!porFila.has(chave)) porFila.set(chave, { gomo, fila, lugares: [] });
    porFila.get(chave).lugares.push(gente.lugarPorLugar[i]);
  }
  const todas = [...porFila.values()].sort((a, b) =>
    (a.gomo - b.gomo) || (a.fila - b.fila));

  return todas.slice(0, FILAS_A_LISTAR).map((f) => {
    const nums = f.lugares.slice().sort((a, b) => a - b);
    // Seguidos viram intervalo; salteados ficam a vírgula. Um corredor no
    // meio da fila parte mesmo a numeração, e essa quebra é informação: diz
    // que o problema está de um lado do corredor e não do outro.
    const tramos = [];
    let ini = nums[0], ant = nums[0];
    for (let k = 1; k <= nums.length; k++) {
      if (k < nums.length && nums[k] === ant + 1) { ant = nums[k]; continue; }
      tramos.push(ini === ant ? String(ini) : ini + "–" + ant);
      ini = ant = nums[k];
    }
    const quais = tramos.length === 1 && !/–/.test(tramos[0])
      ? "lugar " + tramos[0]
      : "lugares " + tramos.join(", ");
    return (f.gomo ? "Gomo " + f.gomo + " · " : "") + "fila " + letraDaFila(f.fila) + " " + quais;
  }).concat(todas.length > FILAS_A_LISTAR
    ? ["e mais " + (todas.length - FILAS_A_LISTAR) + " filas"] : []);
}

/**
 * O mapa de cobertura na cena: um cone translúcido por ecrã, do mesmo
 * feitio do cone do projetor -- é o que se pediu ("um cone como na
 * projecção"), e resolve também o problema de fundo: um ponto de 0,22 m
 * rente ao chão perdia-se contra o público sentado à frente da câmara,
 * e um cone grande, com contorno, não passa despercebido a ninguém.
 */
function desenharConesCobertura(projetoAtual, medidas, sala, palco, gente) {
  const grupo = new THREE.Group();
  grupo.name = "aux:mapa-cobertura";
  const ctx = contextoDeZonas(projetoAtual, medidas, sala, palco);
  // O cone estende-se até ao mais curto de dois limites: o último
  // espectador (para lá disso já não há ninguém) ou a regra da distância
  // (10 alturas de imagem) -- um ecrã pequeno numa sala funda tem de
  // mostrar um cone curto, senão o desenho promete alcance que a regra
  // de leitura já reprovou.
  const fundoDaPlateia = (gente && gente.zUltima != null) ? gente.zUltima : sala.profundidade / 2;
  const regraDistancia = regraDeDistancia(projetoAtual);
  for (const zona of projetoAtual.zonas) {
    const ajusteZona = ajustes.delays[zona.nome];
    // Ecrã muito largo (ver segmentosDeZona()) desenha um cone por fatia --
    // senão o mapa mostrava um alcance maior do que a Cobertura está mesmo a
    // usar por baixo, e o desenho deixava de bater certo com o cálculo.
    for (const segmento of segmentosDeZona(zona, regraDistancia.area)) {
      const centro = centroDeZona(segmento, ajusteZona, ctx);
      const alcancePlateia = fundoDaPlateia - centro.centroZ;
      const baseZona = regraDistancia.basis === "width" ? segmento.w : zona.h;
      const alcanceDistancia = baseZona * regraDistancia.limite;
      const alcance = Math.max(3, Math.min(alcancePlateia, alcanceDistancia));
      grupo.add(fazerConeCobertura(centro, alcance, LIMITE_HORIZONTAL, LIMITE_VERTICAL));
    }
  }
  return grupo;
}

function escreverPainelCobertura(cobertura, temEcras) {
  const resumo = $("resumoCobertura");
  const lista = $("listaCoberturaBlocos");
  if (!cobertura) {
    resumo.className = "vazio";
    // QUAL DAS DUAS COISAS FALTA, e o caminho para a resolver.
    //
    // "Sem ecrãs ou sem público para comparar" é verdade e não serve para
    // nada: deixa a pessoa a adivinhar qual das duas, e sem dizer onde se
    // resolve. O mike chegou aqui com um ecrã montado e a plateia desligada,
    // e a pergunta que fez foi mesmo essa -- *"falta gente não?"*.
    //
    // A plateia nasce desligada de propósito (v3.32, pedido dele: "tudo vazio
    // e vou colocando"), e isso não muda. O que muda é a app dizer que é ela
    // que falta, e pô-la na sala num clique -- as medidas já lá estão.
    const temPublico = $("verPublico") && $("verPublico").checked;
    if (temEcras && !temPublico) {
      resumo.innerHTML = "Há ecrãs, mas não há plateia no desenho — e sem lugares não há nada " +
        "para comparar. A plateia nasce desligada de propósito; as medidas dela já estão feitas.";
      lista.className = "";
      lista.innerHTML = '<button id="btPorPublico" style="width:100%">Pôr a plateia na sala</button>';
      const bt = $("btPorPublico");
      if (bt) bt.onclick = () => {
        $("verPublico").checked = true;
        $("verPublico").dispatchEvent(new Event("change", { bubbles: true }));
      };
      return;
    }
    resumo.textContent = temPublico
      ? "Há plateia, mas não há ecrãs montados para comparar."
      : "Sem ecrãs e sem plateia: falta pôr os dois na sala.";
    lista.className = "vazio";
    lista.textContent = "-";
    return;
  }
  const { totalLugares, confortaveis, marginais, semCobertura, zonasSemCobertura, blocos, piorBloco, regraLabel, semCoberturaOnde } = cobertura;
  resumo.className = "";
  resumo.innerHTML =
    `<b class="cobertura-verde">${confortaveis}</b> confortáveis · ` +
    `<b class="cobertura-amarela">${marginais}</b> marginais · ` +
    `<b class="cobertura-vermelha">${semCobertura}</b> sem cobertura ` +
    `(de ${totalLugares} lugares).` +
    (regraLabel ? `<br><small>Regra: ${regraLabel}</small>` : "") +
    (zonasSemCobertura.length
      ? `<br>Sem ninguém a ver: ${zonasSemCobertura.join(", ")}.`
      : "") +
    (piorBloco
      ? `<br>Bloco ${piorBloco.bloco + 1} é o pior: ${piorBloco.sem} de ${piorBloco.total} lugares sem ecrã.`
      : "") +
    // QUAIS, e não só quantos. "14 lugares sem ecrã" conta mas não localiza:
    // ninguém vai à sala tirar catorze cadeiras que não sabe quais são.
    (semCoberturaOnde && semCoberturaOnde.length
      ? `<br><small>Sem ver: ${semCoberturaOnde.join(" · ")}.</small>`
      : "");

  if (blocos.length > 1) {
    lista.className = "";
    lista.innerHTML = blocos.map(b =>
      `Bloco ${b.bloco + 1}: ${b.total - b.sem}/${b.total} cobertos` +
      (b.sem ? ` · ${b.sem} sem ecrã` : "")
    ).join("<br>");
  } else {
    lista.className = "vazio";
    lista.textContent = "-";
  }
}

// ------------------------------------------------------- distribuir ecrãs

// O último cálculo de "Distribuir ecrãs pela plateia", para o
// botão "Aplicar sugestão" não ter de o repetir -- e para não
// aplicar em cima de uma sala que já mudou de forma entretanto.
let ultimaSugestaoDistribuicao = null;

/**
 * Sugere um deslocamento horizontal por ecrã: para cada lugar, decide
 * qual ecrã é o "responsável" por ele (o de menor ângulo, ou o
 * mais próximo em X se estiver atrás de todos) e depois aproxima
 * cada ecrã do centro dos lugares que lhe calharam. Só mexe no dx
 * -- nunca na largura, na altura ou na rotação -- e o deslocamento
 * sugerido fica sempre dentro de ±1,5 m de uma só vez: isto é
 * uma sugestão, não um solver, e quem decide o resto é quem
 * está a montar a sala.
 */
function sugerirDistribuicao() {
  // Distribuir o que ainda está no depósito não faz sentido nenhum -- não
  // está na sala, não tem lugares a ver para ele.
  const projetoNaSala = projetoMontado(projeto);
  if (!projetoNaSala || !projetoNaSala.zonas.length) return null;
  if (!corposDoPublico || !corposDoPublico.corpos || !corposDoPublico.corpos.length) return null;

  const sala = lerSala(), palco = lerPalco();
  const medidas = totais(projetoNaSala);
  const gente = corposDoPublico;
  const ctx = contextoDeZonas(projetoNaSala, medidas, sala, palco);
  const zonasInfo = projetoNaSala.zonas.map(zona => ({
    zona, centro: centroDeZona(zona, ajustes.delays[zona.nome], ctx), somaX: 0, n: 0
  }));

  const n = gente.corpos.length / 4;
  for (let idx = 0; idx < n; idx++) {
    const i = idx * 4;
    let melhorZi = null, melhorValor = Infinity;
    for (const zi of zonasInfo) {
      const ang = anguloDePessoa(zi.centro, gente.corpos, i);
      const valor = ang ? Math.max(ang.horizontal, ang.vertical) : Infinity;
      if (valor < melhorValor) { melhorValor = valor; melhorZi = zi; }
    }
    if (melhorValor === Infinity) {
      let melhorDist = Infinity;
      for (const zi of zonasInfo) {
        const d = Math.abs(gente.corpos[i] - zi.centro.centroX);
        if (d < melhorDist) { melhorDist = d; melhorZi = zi; }
      }
    }
    if (!melhorZi) continue;
    melhorZi.somaX += gente.corpos[i];
    melhorZi.n++;
  }

  const LIMITE_DELTA = 1.5;
  return zonasInfo
    .filter(zi => zi.n > 0)
    .map(zi => {
      const mediaX = zi.somaX / zi.n;
      const deltaIdeal = mediaX - zi.centro.centroX;
      const delta = Math.max(-LIMITE_DELTA, Math.min(LIMITE_DELTA, deltaIdeal));
      const ajAtual = ajustes.delays[zi.zona.nome];
      const dxAtual = ajAtual ? (Number(ajAtual.dx) || 0) : 0;
      return {
        nome: zi.zona.nome,
        dxAtual: +dxAtual.toFixed(2),
        dxSugerido: +(dxAtual + delta).toFixed(2),
        delta: +delta.toFixed(2),
        lugares: zi.n
      };
    })
    .filter(s => Math.abs(s.delta) >= 0.05);
}

function calcularEDesenharDistribuicao() {
  const resumo = $("resumoDistribuicao");
  const aplicar = $("btAplicarDistribuicao");
  ultimaSugestaoDistribuicao = null;
  aplicar.hidden = true;

  if (!projeto || !projeto.zonas.length) {
    resumo.className = "vazio";
    resumo.textContent = "Sem ecrãs para distribuir.";
    return;
  }
  if (!corposDoPublico || !corposDoPublico.corpos || !corposDoPublico.corpos.length) {
    resumo.className = "vazio";
    resumo.textContent = "Liga o público (secção Vista) para calcular a distribuição.";
    return;
  }

  const sugestoes = sugerirDistribuicao();
  if (!sugestoes || !sugestoes.length) {
    resumo.className = "vazio";
    resumo.textContent = "Já estão bem distribuídos: nenhum ecrã precisa de mais de 5 cm de ajuste.";
    return;
  }

  ultimaSugestaoDistribuicao = sugestoes;
  resumo.className = "";
  resumo.innerHTML = "Sugestão (deslocamento horizontal ↔):<br>" +
    sugestoes.map(s =>
      `${s.nome}: ${s.dxAtual.toFixed(2)} m → <b>${s.dxSugerido.toFixed(2)} m</b> ` +
      `(${s.delta > 0 ? "+" : ""}${s.delta.toFixed(2)} m, serve ${s.lugares} lugares)`
    ).join("<br>");
  aplicar.hidden = false;
}

function aplicarDistribuicaoSugerida() {
  if (!ultimaSugestaoDistribuicao || !ultimaSugestaoDistribuicao.length) return;
  for (const s of ultimaSugestaoDistribuicao) {
    if (!ajustes.delays[s.nome]) ajustes.delays[s.nome] = { dx: 0, dz: 0, dy: 0, rot: 0 };
    ajustes.delays[s.nome].dx = s.dxSugerido;
  }
  guardarAjustes(ajustes);
  ultimaSugestaoDistribuicao = null;
  $("btAplicarDistribuicao").hidden = true;
  $("resumoDistribuicao").className = "vazio";
  $("resumoDistribuicao").textContent = "Aplicado -- os campos de posição foram atualizados.";
  montar(false);
}

$("btDistribuir").onclick = calcularEDesenharDistribuicao;
$("btAplicarDistribuicao").onclick = aplicarDistribuicaoSugerida;

// ------------------------------------------------------------------- painel

/**
 * Uma peça nova nasce no depósito, não na sala -- pedido direto: "se existir
 * algo no 3d pode ser removido ou adicionado, mas o melhor seria fazer a
 * partir do depósito". O depósito é a porta por onde o material entra e sai;
 * a sala só tem o que foi montado, venha de onde vier.
 */
function guardarNoDeposito(chave) {
  if (!chave || !depositoLigado()) return;
  if (!Array.isArray(ajustes.noDeposito)) ajustes.noDeposito = [];
  if (!ajustes.noDeposito.includes(chave)) ajustes.noDeposito.push(chave);
  guardarAjustes(ajustes);
}

/**
 * O depósito dá para desligar -- pedido direto: "podia ligar e desligar o
 * depósito". Desligado, o material novo entra logo na sala, como fazia antes
 * da v2.92; a lista do depósito continua a existir para tirar peças da sala e
 * voltar a pô-las lá.
 *
 * Ligado por omissão, e é a única leitura desta bandeira em toda a app: quem
 * nunca lhe tocou, e um ficheiro gravado antes disto existir, comportam-se
 * como sempre se comportaram.
 */
function depositoLigado() {
  return !ajustes || ajustes.depositoLigado !== false;
}

/** Uma peça sai do depósito e entra na sala. */
function montarDoDeposito(chave) {
  ajustes.noDeposito = (ajustes.noDeposito || []).filter(c => c !== chave);
  guardarAjustes(ajustes);
  montar(false);
}

/** Deita fora de vez: sai do depósito E do projeto. */
function removerDoDeposito(chave) {
  if (!projeto) return;
  if (chave === CHAVE_DEPOSITO_DSM) projeto.dsm = null;
  else projeto.zonas = projeto.zonas.filter(z => chaveDeDeposito(z) !== chave);
  ajustes.noDeposito = (ajustes.noDeposito || []).filter(c => c !== chave);
  guardarAjustes(ajustes);
  montar(false);
}

/** E o contrário: sai da sala mas fica no projeto, à espera. */
function enviarParaDeposito(chave) {
  if (!chave) return;
  if (!Array.isArray(ajustes.noDeposito)) ajustes.noDeposito = [];
  if (!ajustes.noDeposito.includes(chave)) ajustes.noDeposito.push(chave);
  guardarAjustes(ajustes);
  montar(false);
}

/** O que está no depósito, já com o nome e a medida para mostrar na lista. */
function pecasNoDeposito() {
  const pecas = [];
  if (!projeto) return pecas;
  for (const zona of projeto.zonas) {
    const chave = chaveDeDeposito(zona);
    if (!estaNoDeposito(chave)) continue;
    // Vírgula e não ponto: é o que o resto da app escreve, e a lista do
    // depósito vai para dentro do relatório de montagem ao lado de medidas
    // que já vinham com vírgula.
    pecas.push({ chave, nome: zona.nome, detalhe: `${nnum(zona.w)} × ${nnum(zona.h)} m` });
  }
  if (projeto.dsm && estaNoDeposito(CHAVE_DEPOSITO_DSM)) {
    pecas.push({
      chave: CHAVE_DEPOSITO_DSM, nome: "DSM",
      detalhe: `${projeto.dsm.n} unidade${projeto.dsm.n === 1 ? "" : "s"}`
    });
  }
  return pecas;
}

// O interruptor e a nota por baixo dele reescrevem-se a cada montar(), e não
// só uma vez no arranque: o "Limpar tudo" repõe todos os checkbox do painel
// pelo defaultChecked, e sem isto a caixa passava a dizer "ligado" com o
// depósito desligado por baixo.
function escreverInterruptorDeposito() {
  const caixa = $("depositoLigado");
  if (!caixa) return;
  const ligado = depositoLigado();
  caixa.checked = ligado;
  const nota = $("depositoNota");
  if (nota) {
    nota.textContent = ligado
      ? "Todo o material do projeto entra e sai por aqui — o que vem dos Calculadores e o que acrescentares à mão. Fica à espera, e a sala só tem o que tu lá montares."
      : "Desligado: o material novo entra logo na sala, como fazia antes. O depósito continua a servir para tirar peças da sala e voltar a montá-las.";
  }
}

$("depositoLigado").addEventListener("change", function () {
  ajustes.depositoLigado = this.checked;
  guardarAjustes(ajustes);
  montar(false);
});

function escreverListaDeposito() {
  escreverInterruptorDeposito();
  const lista = $("listaDeposito");
  const pecas = pecasNoDeposito();
  $("btMontarTudo").disabled = !pecas.length;
  // O contador no título é a única parte do depósito que se lê sem abrir a
  // secção -- e a secção pode estar dobrada, ou simplesmente fora do ecrã
  // num telemóvel.
  const contador = $("depositoContador");
  if (contador) {
    contador.textContent = pecas.length ? String(pecas.length) : "";
    contador.style.display = pecas.length ? "" : "none";
  }
  if (!pecas.length) {
    lista.className = "vazio";
    lista.textContent = projeto ? "Tudo montado." : "—";
    return;
  }
  lista.className = "";
  lista.innerHTML = "";
  for (const peca of pecas) {
    const linha = document.createElement("div");
    linha.className = "zona";
    const nome = document.createElement("span");
    nome.textContent = peca.nome;
    const det = document.createElement("span");
    det.className = "med";
    det.textContent = peca.detalhe;
    const bt = document.createElement("button");
    bt.textContent = "Montar";
    bt.title = "Põe esta peça na sala, na posição que traz dos Calculadores";
    bt.onclick = () => montarDoDeposito(peca.chave);

    // Deitar fora a partir daqui -- se o depósito é a porta do material, é
    // por aqui que ele também sai do projeto, sem ter de o montar primeiro
    // só para o poder apagar.
    const del = document.createElement("button");
    del.className = "zona-remover";
    del.textContent = "🗑";
    del.title = "Tirar esta peça do projeto";
    del.onclick = () => removerDoDeposito(peca.chave);

    linha.append(nome, det, bt, del);
    lista.append(linha);
  }
}

// Material que chega e não aparece, sem nada a dizer porquê, lê-se como a app
// avariada -- e foi exactamente assim que se leu: "deixaram de falar um com o
// outro agora", no dia a seguir a o depósito entrar. As duas apps falavam; o
// que mudou é que o material passou a parar aqui à espera, e o único sítio
// onde isso se via era uma secção lá em baixo no painel, que ainda por cima
// pode estar dobrada. O aviso do topo já existe para "não cabe" -- passa a
// dizer isto também, com o caminho lá para dentro.
function avisarDoDeposito() {
  const aviso = $("avisoDeposito");
  if (!aviso) return;
  const pecas = pecasNoDeposito();
  if (!pecas.length) {
    aviso.classList.remove("mostra");
    aviso.innerHTML = "";
    return;
  }
  const texto = pecas.length === 1
    ? "1 peça à espera no depósito — só entra na sala quando a montares"
    : `${pecas.length} peças à espera no depósito — só entram na sala quando as montares`;
  aviso.innerHTML = `${texto} <button type="button" class="aviso-link" data-secao="deposito">Ver o depósito</button>`;
  aviso.classList.add("mostra");
}

$("avisoDeposito").addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-secao]");
  if (alvo) irParaSeccao(alvo.dataset.secao);
});

// O botão do aviso das peças fora das paredes. Só ele é que as mexe -- e diz
// quantas mexeu, porque um botão que age em silêncio deixa quem carregou sem
// saber se aconteceu alguma coisa.
$("aviso").addEventListener("click", (e) => {
  if (e.target.closest("[data-arrumar]")) {
    const quantas = trazerParaDentro(pecasForaDasParedes());
    dizerNaCena(quantas === 1
      ? "1 peça voltou para dentro das paredes."
      : quantas + " peças voltaram para dentro das paredes.");
    return;
  }
  // Os dois caminhos do aviso da sincronização (ver avisarQueNaoVaiSozinho):
  // mandar só desta vez, ou ligar a automática e deixar de ter de pensar nisso.
  if (e.target.closest("[data-devolver-agora]")) {
    const foi = devolverAosCalculadores(false);
    dizerNaCena(foi
      ? "Enviado. Nos Calculadores, o que mexeste aqui já está lá."
      : "Não consegui enviar — não há projeto carregado.");
    return;
  }
  if (e.target.closest("[data-ligar-sinc]")) {
    if (!sincronizacaoAutomaticaLigada()) $("btSincronizacao").click();
    devolverAosCalculadores(false);
    dizerNaCena("Sincronização automática ligada — daqui para a frente vai sozinho.");
  }
});

/**
 * A SALA VAZIA.
 *
 * A app passou a nascer sem palco, sem público, sem régie e sem orador --
 * pedido directo: *"tudo vazio e vou colocando"*. O que se ganha é grande (o
 * projeto de quem abre deixa de ser hóspede numa sala montada por outra
 * pessoa), mas tem um preço que não se pode ignorar: um chão cinzento sem uma
 * palavra não se lê como "à espera", lê-se como avariado.
 *
 * Por isso a sala vazia diz o que é e por onde se começa. Some-se sozinha
 * assim que houver seja o que for lá dentro -- e quem a fez desaparecer não a
 * quer ver outra vez.
 */
function avisarDaSalaVazia() {
  const aviso = $("avisoVazio");
  if (!aviso) return;
  // Num link de visualização quem abre não monta nada: dizer-lhe por onde
  // começar seria dar-lhe trabalho que ele não pode fazer.
  if (modoVisualizacao || !salaEstaVazia()) {
    aviso.classList.remove("mostra");
    return;
  }
  // Uma acção por linha, e não uma frase com três links no meio: a frase
  // partia-se toda no telemóvel e o ponto final acabava sozinho numa linha.
  aviso.innerHTML =
    "<b>A sala está vazia</b>" +
    "<p>Nasce assim de propósito: só tem o que lhe puseres.</p>" +
    '<button type="button" class="aviso-link" data-secao="sProjeto">Trazer um projeto dos Calculadores</button>' +
    '<button type="button" class="aviso-link" data-secao="sVista">Ligar o palco, o público ou a régie</button>' +
    '<button type="button" class="aviso-link" data-secao="zonas">Montar um ecrã aqui mesmo</button>';
  aviso.classList.add("mostra");
}

$("avisoVazio").addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-secao]");
  if (alvo) irParaSeccao(alvo.dataset.secao);
});

$("btMontarTudo").onclick = () => {
  ajustes.noDeposito = [];
  guardarAjustes(ajustes);
  montar(false);
};

function escreverPainel(medidas, lugares, gentePosta, cobertura) {
  escreverListaDeposito();
  const resumo = $("resumo");
  const lista = $("listaZonas");
  // Um projeto criado aqui pode nascer só com um DSM, sem ecrã nenhum ainda
  // — "sem zonas" não é o mesmo que "nada para mostrar no painel".
  const temAlgo = projeto && (projeto.zonas.length || projeto.dsm);

  // A lista reconstrói-se do zero sempre que se monta a cena — inclusive a
  // meio de se escrever um nome ou uma medida, porque cada tecla também
  // dispara um remontar (com atraso). Enquanto alguém estiver a escrever num
  // campo desta lista, ela não se reconstrói: ver aEscreverNaLista().
  //
  // Isto já foi guardar-e-repor o foco, e não chegava: repor o texto num
  // `<input type="number">` não aguenta um decimal a meio de ser escrito (o
  // navegador rejeita "12." como valor), e o ponto desaparecia — escrever
  // 12.5 m de largura num ecrã dava 125 m, calado. Medido, não suposto.
  const aEscrever = aEscreverNaLista(lista);

  if (!temAlgo) {
    resumo.className = "vazio";
    resumo.textContent = projeto
      ? "Projeto sem ecrãs ainda. Usa o \"+ Ecrã\", o \"+ Delay\" ou o \"+ DSM\" aqui em baixo."
      : "Sem projeto. Podes montar tudo aqui mesmo (\"+ Ecrã\", \"+ Delay\", \"+ DSM\") e só ligar " +
        "a sincronização quando quiseres o equipamento certo dos Calculadores — ou trazer já o que lá está.";
    lista.className = "vazio";
    lista.textContent = "—";
  } else {
    const res = projeto.zonas.reduce((t, z) => t + ((z.res && z.res.x * z.res.y) || 0), 0);
    // O contador do depósito anda sempre com o resumo: material que chega e
    // não aparece na sala, sem nada a dizer porquê, é a maneira mais rápida
    // de isto parecer avariado.
    const porMontar = pecasNoDeposito().length;
    const notaDeposito = porMontar
      ? `<br><small>${porMontar} peça${porMontar === 1 ? "" : "s"} no depósito, por montar.</small>`
      : "";
    resumo.className = "";
    resumo.innerHTML = (medidas
      ? `<b>${medidas.largura.toFixed(2)} × ${medidas.altura.toFixed(2)} m</b> · ` +
        `${medidas.zonas} zona${medidas.zonas === 1 ? "" : "s"}` +
        (medidas.peso ? ` · <b>${Math.round(medidas.peso)}</b> kg` : "") +
        (medidas.amp ? ` · <b>${medidas.amp.toFixed(1)}</b> A` : "") +
        (res ? ` · <b>${(res / 1e6).toFixed(1)}</b> Mpx` : "")
      : (porMontar ? "Sala vazia — está tudo no depósito." : "Só o DSM, sem ecrãs ainda.")) + notaDeposito;

    // O resumo por cima continua a acompanhar cada tecla; só as linhas é que
    // esperam que se saia do campo.
    if (!aEscrever) {
      lista.className = "";
      lista.innerHTML = "";
      // Só o que está na sala -- o resto tem lista própria, a do depósito.
      projeto.zonas.forEach((z, i) => {
        if (!estaNoDeposito(chaveDeDeposito(z))) lista.append(linhaDeZona(z, i));
      });

      if (projeto.dsm && !estaNoDeposito(CHAVE_DEPOSITO_DSM)) lista.append(linhaDeDsm());
    }
  }

  $("rodape").textContent = lugares
    ? `${lugares} lugares — ${gentePosta.filas} fila${gentePosta.filas === 1 ? "" : "s"} ` +
      `de ${gentePosta.porFila}` +
      (gentePosta.blocos > 1 ? `, em ${gentePosta.blocos} blocos.` : ".")
    : "Sem público no desenho.";

  // O mesmo número, mas sempre visível no topo — o rodapé só se vê com o
  // painel aberto e ninguém quer andar a fazer scroll para saber a lotação
  // no meio de uma reunião. E, junto dele, a cobertura -- pedido direto:
  // "logo de início... junto da capacidade, em números e usando as cores,
  // ficaria logo mais visível". Antes só se via com "Cobertura dos ecrãs"
  // ligado (ver escreverPainelCobertura()); calcularCobertura() já corria
  // sempre que há projeto com zonas, ligado ou não -- só faltava mostrar-se
  // aqui. Mesmas cores/classes do painel de cobertura (css/estilo.css), não
  // cores novas à parte.
  const topo = $("lotacaoTopo");
  if (!lugares) {
    topo.textContent = "—";
  } else if (cobertura) {
    topo.innerHTML = `👥 ${lugares} ` +
      `<span class="cobertura-verde">●${cobertura.confortaveis}</span>` +
      `<span class="cobertura-amarela">●${cobertura.marginais}</span>` +
      `<span class="cobertura-vermelha">●${cobertura.semCobertura}</span>`;
  } else {
    topo.textContent = `👥 ${lugares}`;
  }
}

// As cores das zonas que os Calculadores mandam já vêm feitas; as que se
// criam aqui têm de vir de algum lado — um ciclo curto, só para se
// distinguirem umas das outras num relance.
const CORES_ZONA = ["#2E7BFF", "#22D3EE", "#F59E0B", "#A855F7", "#34D399", "#F472B6"];

/** Garante que há um `projeto` para se poder acrescentar um ecrã ou um DSM —
 *  sem isto, "+ Ecrã" com o painel vazio não tinha onde pôr nada. */
function garantirProjeto() {
  if (!projeto) {
    projeto = { v: FORMATO, nome: "Projeto (criado no Preview)", origem: "preview",
                origemVersao: $("versao") ? $("versao").textContent.trim() : null,
                zonas: [], dsm: null };
  }
  if (!Array.isArray(projeto.zonas)) projeto.zonas = [];
  return projeto;
}

/**
 * Abre o painel (se estiver escondido) e desdobra uma secção, levando a
 * vista até ela — pedido direto: os avisos de "não cabe" ganharem onde
 * clicar para saltar logo para a secção certa, em vez de a pessoa andar
 * à procura de qual campo mexer.
 */
function irParaSeccao(id, idParaFoco) {
  painel(false);
  const secao = $(id);
  if (!secao) return;
  secao.classList.remove("fechada");
  try {
    localStorage.setItem("preview-dobras",
      JSON.stringify([...document.querySelectorAll("#painel section.fechada")]
        .filter(x => x.id !== id).map(x => x.id)));
  } catch (_) {}
  (idParaFoco ? $(idParaFoco) : secao).scrollIntoView({ block: "start", behavior: "smooth" });
}

function mostrarZonas() {
  irParaSeccao("zonas", "listaZonas");
}

// Um aviso "não cabe" pode trazer um botão embutido a dizer onde ir
// ajustar — delegado num só listener porque o texto do aviso é
// reconstruído a cada montar(), o que apagaria um listener posto
// directamente no botão.
$("aviso").addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-secao]");
  if (!alvo) return;
  irParaSeccao(alvo.dataset.secao);
});

/** Depois de mexer no projeto à mão, é a mesma rotina de sempre: voltar a
 *  montar a cena — o resto (posições dos delays/DSM, painel) já vem a
 *  reboque de dentro do montar(). */
function projetoMudou(recentrar = false) {
  montar(recentrar);
}

$("btNovaZona").onclick = () => {
  const p = garantirProjeto();
  const n = p.zonas.length;
  // Cada ecrã novo nasce ao lado do último, para não empilhar tudo em cima do
  // mesmo sítio e obrigar a arrastar números antes de se ver alguma coisa.
  const anterior = p.zonas[n - 1];
  const idNovo = novoIdZona();
  guardarNoDeposito(idNovo);
  p.zonas.push({
    nome: `Ecrã ${n + 1}`,
    id: idNovo,
    x: anterior ? anterior.x + anterior.w + 0.5 : 0,
    y: 0, w: 2, h: 1.2,
    cor: CORES_ZONA[n % CORES_ZONA.length],
    tipo: "led"
  });
  projetoMudou();
  // Com o depósito desligado a peça já está na sala: quem a quer ajustar
  // vai às Zonas, não a uma lista onde ela não está.
  if (depositoLigado()) irParaSeccao("deposito", "listaDeposito");
  else mostrarZonas();
};

$("btNovoDelay").onclick = () => {
  const p = garantirProjeto();
  const delays = p.zonas.filter(z => z.tipo === "tv" || z.tipo === "projecao");
  const n = delays.length;
  const anterior = delays[n - 1];
  const idNovoDelay = novoIdZona();
  guardarNoDeposito(idNovoDelay);
  p.zonas.push({
    nome: `Delay ${n + 1}`,
    id: idNovoDelay,
    x: anterior ? anterior.x + anterior.w + 0.5 : 0,
    y: 0, w: 0.8, h: 0.45,
    cor: "#F59E0B",
    tipo: "tv"
  });
  projetoMudou();
  // Com o depósito desligado a peça já está na sala: quem a quer ajustar
  // vai às Zonas, não a uma lista onde ela não está.
  if (depositoLigado()) irParaSeccao("deposito", "listaDeposito");
  else mostrarZonas();
};

$("btNovoDsm").onclick = () => {
  const p = garantirProjeto();
  if (p.dsm) return;
  guardarNoDeposito(CHAVE_DEPOSITO_DSM);
  p.dsm = { n: 2, w: 0.6, h: 0.4 };
  projetoMudou();
};

// "Fazer um círculo" -- pedido directo, depois de o arredondamento sozinho
// parar num estádio: *"conseguir fechar em círculo, e o [profundidade] do
// palco deve poder lá ir"*. Um círculo precisa dos dois lados iguais, e era
// essa a parte chata de fazer à mão: escrever a profundidade, escrever a
// largura outra vez, e ainda calcular metade para o raio.
//
// O diâmetro é a LARGURA que já lá está, não a profundidade nem uma média: a
// largura é a medida com que se pensa um palco ("um palco de 16"), e é a que
// manda no que se vê da plateia. Se não couber na sala, o aviso de sempre
// diz-o — não se encolhe o palco por trás das costas de quem o pediu.
if ($("btPalcoRedondo")) $("btPalcoRedondo").onclick = () => {
  const largura = num("palcoL");
  if (!largura) return;
  $("palcoP").value = String(largura);
  $("palcoR").value = String(Math.round((largura / 2) * 100) / 100);
  remontarDaqui(0);
};

if ($("btAddPalco")) $("btAddPalco").onclick = () => {
  const p = lerPalco();
  const n = ajustes.palcosExtra.length;
  // Cada palco extra nasce ao lado do anterior (deste ou do principal), para
  // não nascer sobreposto -- a mesma ideia do "Ecrã" novo acima. Fica
  // sempre arrastável depois, por cima ou por baixo disto.
  ajustes.palcosExtra.push({
    largura: p.largura || 6, altura: p.altura || 1, profundidade: p.profundidade || 4,
    dx: (p.largura || 6) / 2 + ((p.largura || 6) + 2) * n + 2,
    dz: -lerSala().profundidade / 2 + (p.profundidade || 4) / 2,
    rot: 0,
    // Herda o arredondamento do palco principal: quem já pôs o palco redondo
    // quer quase sempre o segundo a condizer, e pôr a zero corrige-se numa
    // tecla. Sem palco principal arredondado, nasce de cantos vivos.
    raio: p.raio || 0
  });
  guardarAjustes(ajustes);
  remontarDaqui();
};

if ($("btAddPassarela")) $("btAddPassarela").onclick = () => {
  const sala = lerSala(), palco = lerPalco();
  const n = ajustes.passarelasExtra.length;
  // Sem palco a que se agarrar, nasce a meio da plateia -- um pouco à
  // frente da primeira fila. A primeira nasce centrada (o sítio mais comum
  // para uma passarela), as seguintes alternam para um lado e para o outro
  // -- perto do centro da sala, e não encostadas à parede, que é onde a
  // vista "Frente" por omissão as deixava fora do enquadramento.
  const lado = n % 2 === 0 ? 1 : -1;
  const dx = n === 0 ? 0 : lado * Math.ceil(n / 2) * 2.5;
  ajustes.passarelasExtra.push({
    largura: 1.5, comprimento: 3, altura: 0.4,
    dx,
    dz: frenteDoPalco(sala, palco).z + 3,
    rot: 0
  });
  guardarAjustes(ajustes);
  remontarDaqui();
};

if ($("btAddRegie")) $("btAddRegie").onclick = () => {
  const r = lerRegie();
  const n = ajustes.regiesExtra.length;
  // Nasce ao lado da régie anterior (principal ou extra), com a mesma
  // largura/profundidade dela -- mesma ideia do "+ Palco" acima.
  ajustes.regiesExtra.push({
    largura: r.largura || 2, profundidade: r.profundidade || 2,
    dx: (r.x || 0) + (r.largura || 2) + 2 + ((r.largura || 2) + 2) * n,
    dz: r.z || 0,
    rot: 0
  });
  guardarAjustes(ajustes);
  remontarDaqui();
};

function campoDeZona(zona, campo, tipo, passo) {
  const input = document.createElement("input");
  input.type = tipo;
  input.value = zona[campo];
  if (passo) input.step = passo;
  input.className = "zona-campo";
  input.dataset.campo = `z${zona.__id}-${campo}`;
  input.addEventListener("input", () => {
    // Os ajustes de posição/rotação vivem em ajustes.delays[nome] — chave
    // pelo NOME, não pelo __id. Mudar o nome sem mudar a chave deixava o
    // ajuste velho pendurado num nome que já ninguém usa, e a zona
    // reaparecia com a posição de fábrica como se nunca tivesse sido
    // deslocada.
    if (campo === "nome") {
      const nomeAntigo = zona.nome;
      const nomeNovo = input.value;
      if (nomeAntigo !== nomeNovo && ajustes.delays[nomeAntigo] && !ajustes.delays[nomeNovo]) {
        ajustes.delays[nomeNovo] = ajustes.delays[nomeAntigo];
        delete ajustes.delays[nomeAntigo];
        guardarAjustes(ajustes);
      }
    }
    zona[campo] = tipo === "number" ? (parseFloat(input.value) || 0) : input.value;
    remontarDaqui();
  });
  return input;
}

/** O ajuste de posição de uma zona (dx/dy/dz) — o mesmo sítio onde já
 *  vivem os ajustes dos delays, só que agora aberto a qualquer zona, não
 *  só às de tipo TV/Projeção. Cria a entrada se ainda não existir. */
function ajusteDaZona(nome) {
  if (!ajustes.delays[nome]) ajustes.delays[nome] = { dx: 0, dy: 0, dz: 0 };
  return ajustes.delays[nome];
}

/** Um +/- ao lado de um campo numérico já criado -- mesma razão do
 *  campoAjuste() em "Posições": as setas nativas do <input type="number">
 *  não se veem (ou não se tocam bem) em telemóvel nenhum a sério. Devolve
 *  um fragmento [menos, input, mais] para pôr no sítio onde só o "input"
 *  entraria antes. Também define min/max no próprio campo -- sem um "min"
 *  negativo, o teclado numérico do telemóvel não desenha a tecla de "-".
 */
function campoComPasso(input, passo, min, max) {
  input.min = String(min);
  input.max = String(max);
  function passar(sinal) {
    const p = parseFloat(passo) || 1;
    const atual = parseFloat(input.value);
    const novo = Math.min(max, Math.max(min, (Number.isFinite(atual) ? atual : 0) + sinal * p));
    input.value = String(Math.round(novo * 1e6) / 1e6);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const menos = document.createElement("button");
  menos.type = "button"; menos.className = "zona-passo"; menos.textContent = "−";
  menos.setAttribute("aria-label", "Diminuir");
  menos.addEventListener("click", () => passar(-1));
  const mais = document.createElement("button");
  mais.type = "button"; mais.className = "zona-passo"; mais.textContent = "+";
  mais.setAttribute("aria-label", "Aumentar");
  mais.addEventListener("click", () => passar(1));
  const frag = document.createDocumentFragment();
  frag.append(menos, input, mais);
  return frag;
}

/** O campo ↔ da linha da zona: em vez de editar zona.x (que só tem sentido
 *  em relação às outras zonas do mesmo conjunto), mexe no ajuste — uma
 *  correcção absoluta que se soma por cima do que os Calculadores mandaram,
 *  e que por isso também funciona com um ecrã sozinho. */
function campoPosicaoDeZona(zona) {
  const aj = ajusteDaZona(zona.nome);
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.05";
  input.value = aj.dx || 0;
  input.className = "zona-campo";
  input.dataset.campo = `z${zona.__id}-pos`;
  input.addEventListener("input", () => {
    aj.dx = parseFloat(input.value) || 0;
    guardarAjustes(ajustes);
    remontarDaqui();
  });
  return campoComPasso(input, "0.05", -500, 500);
}

/** O campo "profundidade" da linha da zona: o mesmo ajuste (dz) que já
 *  desloca os delays e o DSM para a frente/trás do palco — falta aqui era
 *  só a UI, o resto (fazerZonas() em cena.js) já lia "dz" para qualquer
 *  zona, LED incluído. Sem isto, rodar uma zona perto do fim da sala podia
 *  fazê-la sair pela parede fora, sem maneira nenhuma de a trazer de volta
 *  para dentro. */
function campoProfundidadeDeZona(zona) {
  const aj = ajusteDaZona(zona.nome);
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.05";
  input.value = aj.dz || 0;
  input.className = "zona-campo";
  input.dataset.campo = `z${zona.__id}-prof`;
  input.addEventListener("input", () => {
    aj.dz = parseFloat(input.value) || 0;
    guardarAjustes(ajustes);
    remontarDaqui();
  });
  return campoComPasso(input, "0.05", -500, 500);
}

function campoRotacaoDeZona(zona) {
  const aj = ajusteDaZona(zona.nome);
  if (aj.rot == null) aj.rot = 0;
  const input = document.createElement("input");
  input.type = "number";
  input.step = "5";
  input.value = aj.rot || 0;
  input.className = "zona-campo";
  input.dataset.campo = `z${zona.__id}-rot`;
  input.addEventListener("input", () => {
    aj.rot = parseFloat(input.value) || 0;
    guardarAjustes(ajustes);
    remontarDaqui();
  });
  return campoComPasso(input, "5", -180, 180);
}

/** O "tilt" da linha da zona — o mesmo eixo de cima/baixo que já existe em
 *  "Posições" para delays e DSM, agora também aqui para qualquer zona.
 *  Positivo inclina para baixo (ver o comentário em fazerZona(), cena.js). */
function campoTiltDeZona(zona) {
  const aj = ajusteDaZona(zona.nome);
  if (aj.tilt == null) aj.tilt = 0;
  const input = document.createElement("input");
  input.type = "number";
  input.step = "5";
  input.value = aj.tilt || 0;
  input.className = "zona-campo";
  input.dataset.campo = `z${zona.__id}-tilt`;
  input.addEventListener("input", () => {
    aj.tilt = parseFloat(input.value) || 0;
    guardarAjustes(ajustes);
    remontarDaqui();
  });
  return campoComPasso(input, "5", -90, 90);
}

function nomeLivreDeDelay(projetoAtual) {
  let numero = projetoAtual.zonas.filter(z => z.tipo === "tv" || z.tipo === "projecao").length + 1;
  let nome = `Delay ${numero}`;
  while (projetoAtual.zonas.some(z => z.nome === nome)) nome = `Delay ${++numero}`;
  return nome;
}

/** Uma linha de zona editável: nome, tipo, medidas, posição e um botão para
 *  a tirar do projeto — tudo com o mesmo feitio de campo que o resto do
 *  painel, para não parecer uma caixa de ferramentas à parte. */
function linhaDeZona(zona, indice) {
  // Um id estável (não o índice, que muda quando se apaga uma zona a meio da
  // lista) para o foco se conseguir voltar a encontrar o campo certo depois
  // de a lista se reconstruir toda. Não enumerável de propósito: senão ia
  // parar ao ficheiro do "Guardar projeto" e ao que se manda para os
  // Calculadores, e ninguém do outro lado precisa de saber disto.
  if (zona.__id == null) {
    Object.defineProperty(zona, "__id", { value: ++proximoIdZona, enumerable: false });
  }

  const linha = document.createElement("div");
  linha.className = "zona zona-editavel";

  const cor = document.createElement("input");
  cor.type = "color";
  cor.className = "cor";
  cor.value = /^#[0-9a-f]{6}$/i.test(zona.cor) ? zona.cor : "#2e7bff";
  cor.title = "Cor no desenho";
  cor.dataset.campo = `z${zona.__id}-cor`;
  cor.addEventListener("input", () => { zona.cor = cor.value; remontarDaqui(); });

  const nome = campoDeZona(zona, "nome", "text");
  nome.className = "zona-campo zona-nome";

  const tipo = document.createElement("select");
  tipo.className = "zona-campo";
  tipo.dataset.campo = `z${zona.__id}-tipo`;
  for (const [valor, rotulo] of [["led", "LED"], ["tv", "TV"], ["projecao", "Projeção"]]) {
    const opt = document.createElement("option");
    opt.value = valor; opt.textContent = rotulo;
    if (zona.tipo === valor) opt.selected = true;
    tipo.append(opt);
  }
  tipo.addEventListener("change", () => { zona.tipo = tipo.value; remontarDaqui(); });

  const med = document.createElement("span");
  med.className = "med";
  med.append(campoDeZona(zona, "w", "number", "0.05"), document.createTextNode(" × "),
             campoDeZona(zona, "h", "number", "0.05"), document.createTextNode(" m"));

  // O ↔ NÃO edita zona.x: essa coordenada só diz onde a zona fica em relação
  // ÀS OUTRAS zonas do mesmo conjunto (é o que os Calculadores mandam, e é
  // por isso que um conjunto de ecrãs se mantém coerente entre si). Com um
  // ecrã só, o cálculo do centro do conjunto cancela sempre essa diferença —
  // mudar zona.x não mexia em nada, e era exactamente o que se via. Este
  // campo usa em vez disso o mesmo ajuste (dx) que já move os delays e o
  // DSM: uma correcção absoluta, por cima do que os Calculadores mandaram,
  // que funciona com um ecrã ou com o conjunto todo.
  const pos = document.createElement("span");
  pos.className = "med";
  pos.append(document.createTextNode("↔ "), campoPosicaoDeZona(zona));

  const prof = document.createElement("span");
  prof.className = "med";
  prof.append(document.createTextNode("profundidade "), campoProfundidadeDeZona(zona));

  const rodar = document.createElement("span");
  rodar.className = "med";
  rodar.append(document.createTextNode("rodar "), campoRotacaoDeZona(zona), document.createTextNode(" °"));

  const tilt = document.createElement("span");
  tilt.className = "med";
  tilt.append(document.createTextNode("tilt "), campoTiltDeZona(zona), document.createTextNode(" °"));

  // "Precisa de leitura" -- pedido direto: nem todos os ecrãs são para
  // slides/texto, alguns são só complemento visual (ambiente, sem letras) e
  // não devem entrar na conta da Cobertura. Ligado por omissão (mesmo
  // comportamento de sempre); desligar tira este ecrã da Cobertura sem o
  // tirar do projeto. Guardado por NOME em ajustes.zonasSemLeitura (como
  // ajustes.delays), para sobreviver a um novo "Trazer projeto".
  const leituraCampo = document.createElement("label");
  leituraCampo.className = "med zona-leitura";
  leituraCampo.title = "Este ecrã tem texto/dados para ler, e entra na Cobertura. Desliga para um ecrã só visual/ambiente (sem necessidade de leitura) — fica fora da conta de Cobertura, mas continua no projeto.";
  const leitura = document.createElement("input");
  leitura.type = "checkbox";
  leitura.checked = !ajustes.zonasSemLeitura.includes(zona.nome);
  leitura.addEventListener("change", () => {
    const semLeitura = new Set(ajustes.zonasSemLeitura);
    if (leitura.checked) semLeitura.delete(zona.nome); else semLeitura.add(zona.nome);
    ajustes.zonasSemLeitura = [...semLeitura];
    guardarAjustes(ajustes);
    remontarDaqui();
  });
  leituraCampo.append(leitura, document.createTextNode(" leitura"));

  let duplicar = null;
  if (zona.tipo === "tv" || zona.tipo === "projecao") {
    duplicar = document.createElement("button");
    duplicar.className = "zona-remover";
    duplicar.textContent = "⧉";
    duplicar.title = "Duplicar este delay";
    duplicar.onclick = () => {
      const novoNome = nomeLivreDeDelay(projeto);
      const copia = {
        ...zona,
        nome: novoNome,
        x: (Number(zona.x) || 0) + (Number(zona.w) || 0) + 0.5
      };
      projeto.zonas.splice(indice + 1, 0, copia);
      const original = ajusteDaZona(zona.nome);
      ajustes.delays[novoNome] = { ...original };
      guardarAjustes(ajustes);
      projetoMudou();
      mostrarZonas();
    };
  }

  const remover = document.createElement("button");
  remover.className = "zona-remover";
  remover.textContent = "🗑";
  remover.title = "Tirar este ecrã do projeto";
  remover.onclick = () => {
    projeto.zonas.splice(indice, 1);
    projetoMudou();
  };

  // Tirar da sala sem apagar do projeto -- o contrário do "Montar" que está
  // na lista do depósito. Distinto do remover, que apaga mesmo.
  const guardar = document.createElement("button");
  guardar.className = "ajuste-passo ajuste-remover";
  guardar.textContent = "↓";
  guardar.title = "Recolher ao depósito (sai da sala, fica no projeto)";
  guardar.onclick = () => enviarParaDeposito(chaveDeDeposito(zona));

  linha.append(cor, nome, tipo, med, pos, prof, rodar, tilt, leituraCampo);
  if (duplicar) linha.append(duplicar);
  linha.append(guardar, remover);
  return linha;
}
let proximoIdZona = 0;

function campoDeDsm(campo, passo) {
  const input = document.createElement("input");
  input.type = "number";
  input.step = passo;
  input.value = projeto.dsm[campo];
  input.className = "zona-campo";
  input.dataset.campo = `dsm-${campo}`;
  input.addEventListener("input", () => {
    projeto.dsm[campo] = parseFloat(input.value) || 0;
    remontarDaqui();
  });
  return input;
}

/** A linha do DSM é uma quantidade e um tamanho só, não uma por unidade — como
 *  já era quando isto só vinha dos Calculadores. */
function linhaDeDsm() {
  const linha = document.createElement("div");
  linha.className = "zona zona-editavel";

  const nome = document.createElement("span");
  nome.className = "zona-nome";
  nome.textContent = "DSM";

  const qtd = document.createElement("span");
  qtd.className = "med";
  qtd.append(document.createTextNode("qtd "), campoDeDsm("n", "1"));

  const med = document.createElement("span");
  med.className = "med";
  med.append(campoDeDsm("w", "0.05"), document.createTextNode(" × "),
             campoDeDsm("h", "0.05"), document.createTextNode(" m"));

  const remover = document.createElement("button");
  remover.className = "zona-remover";
  remover.textContent = "🗑";
  remover.title = "Tirar o DSM do projeto";
  remover.onclick = () => {
    projeto.dsm = null;
    projetoMudou();
  };

  linha.append(nome, qtd, med, remover);
  return linha;
}

/**
 * Todas estas listas de ajustes se reconstroem do zero a CADA TECLA: escrever
 * num campo dispara um "input", o "input" remonta a cena, e o remontar
 * reescreve a lista inteira. O campo onde se estava a escrever morre a meio e
 * nasce outro igual no lugar — dá para MEXER o número com as setas e com o
 * +/−, mas não para o ESCREVER a direito.
 *
 * Relatado assim: *"nos campos de ajuste do palco extra e passerele é difícil
 * escrever os valores"*. Medido: escrever "12.5" na largura de um palco extra
 * ficava em **"1"** — o foco saltava para o `body` à primeira tecla e as
 * outras três não iam para lado nenhum.
 *
 * A regra é: **uma lista onde alguém está a escrever não se reconstrói.** A
 * cena continua a atualizar-se a cada tecla (isso é outra parte do montar);
 * só a lista do painel é que espera. Reconstrói-se na primeira montagem
 * depois de sair do campo.
 *
 * Isto substitui o guardar-e-repor-o-foco que as listas dos delays/DSM e dos
 * gomos tinham escrito à mão. Esse não chegava, e a razão vale a pena ficar
 * escrita: repor o texto num `<input type="number">` não aguenta um decimal a
 * meio de ser escrito — o navegador rejeita "12." como valor, e o ponto
 * desaparecia. "12.5" saía "125", que num campo em metros é um palco cem
 * vezes maior. Não reconstruir não tem esse problema nenhum.
 */
function aEscreverNaLista(lista) {
  const ativo = document.activeElement;
  return !!(ativo && ativo.dataset && ativo.dataset.campo && lista.contains(ativo));
}

/**
 * Um campo ↔/↕ para afinar a posição de um delay ou de um DSM — o valor
 * inicial vem do que já estiver guardado, e cada alteração escreve logo no
 * objeto `alvo` (a entrada de `ajustes.delays[nome]` ou `ajustes.dsm[i]`) e
 * volta a montar a cena, com o mesmo atraso dos outros campos do painel.
 */
function campoAjuste(rotulo, alvo, chave, unidadeTexto = "m", passo = "0.05", idCampo, min = -500, max = 500) {
  const campo = document.createElement("label");
  campo.className = "ajuste-campo";
  // O nome num <span> seu, e não num nó de texto solto: um nó de texto
  // dentro de um grid é um item anónimo, e itens anónimos não se conseguem
  // colocar por CSS. Ficava à mercê do que o browser decidisse -- e em
  // painel estreito a unidade em itálico ("m") acabava colada ao nome do
  // campo seguinte: "mprofundidade", "mrodar".
  const nomeDoCampo = document.createElement("span");
  nomeDoCampo.className = "ajuste-rotulo";
  nomeDoCampo.textContent = rotulo;
  campo.append(nomeDoCampo);
  const input = document.createElement("input");
  input.type = "number";
  input.step = passo;
  // Sem "min" negativo, o teclado numérico do telemóvel (sobretudo Android)
  // não mostra a tecla de menos -- e um deslocamento ou rotação negativa
  // (para a esquerda, para trás, ao contrário) fica impossível de escrever
  // a dedo, só dava para chegar lá pelas setas. O "min" é o sinal de que o
  // teclado precisa para desenhar essa tecla.
  input.min = String(min);
  input.max = String(max);
  input.value = alvo[chave] || 0;
  if (idCampo) input.dataset.campo = idCampo;
  input.addEventListener("input", () => {
    alvo[chave] = parseFloat(input.value) || 0;
    guardarAjustes(ajustes);
    remontarDaqui();
  });
  // As setas nativas do <input type="number"> não aparecem em telemóvel
  // nenhum a sério (é comportamento do browser, não deste código) -- e são
  // pequenas demais para um dedo mesmo onde aparecem. Este +/- é o mesmo
  // valor de "step" que o campo já tinha, só que sempre visível e sempre
  // do tamanho de um alvo de toque.
  function passar(sinal) {
    const p = parseFloat(passo) || 1;
    const atual = parseFloat(input.value);
    const novo = Math.min(max, Math.max(min, (Number.isFinite(atual) ? atual : 0) + sinal * p));
    input.value = String(Math.round(novo * 1e6) / 1e6);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const menos = document.createElement("button");
  menos.type = "button"; menos.className = "ajuste-passo"; menos.textContent = "−";
  menos.setAttribute("aria-label", "Diminuir " + rotulo);
  menos.addEventListener("click", () => passar(-1));
  const mais = document.createElement("button");
  mais.type = "button"; mais.className = "ajuste-passo"; mais.textContent = "+";
  mais.setAttribute("aria-label", "Aumentar " + rotulo);
  mais.addEventListener("click", () => passar(1));
  const unidade = document.createElement("i");
  unidade.textContent = unidadeTexto;
  campo.append(menos, input, mais, unidade);
  return campo;
}

function desenharAjustes() {
  const lista = $("listaAjustes");
  const delays = projeto ? projeto.zonas.filter(z => z.tipo !== "led") : [];
  const numDsm = (projeto && projeto.dsm) ? projeto.dsm.n : 0;

  if (!delays.length && !numDsm) {
    lista.className = "vazio";
    lista.textContent = "—";
    return;
  }
  lista.className = "";

  if (aEscreverNaLista(lista)) return;

  lista.innerHTML = "";

  for (const z of delays) {
    if (!ajustes.delays[z.nome]) ajustes.delays[z.nome] = { dx: 0, dz: 0, dy: 0, rot: 0, tilt: 0 };
    if (ajustes.delays[z.nome].rot == null) ajustes.delays[z.nome].rot = 0;
    if (ajustes.delays[z.nome].tilt == null) ajustes.delays[z.nome].tilt = 0;
    const linha = document.createElement("div");
    linha.className = "ajuste-linha";
    const nome = document.createElement("strong");
    nome.textContent = z.nome + (z.tipo === "tv" ? " (TV)" : " (Projeção)");
    linha.append(nome);
    linha.append(campoAjuste("↔", ajustes.delays[z.nome], "dx", "m", "0.05", `d-${z.nome}-dx`));
    linha.append(campoAjuste("fundo", ajustes.delays[z.nome], "dz", "m", "0.05", `d-${z.nome}-dz`));
    linha.append(campoAjuste("altura", ajustes.delays[z.nome], "dy", "m", "0.05", `d-${z.nome}-dy`));
    linha.append(campoAjuste("rodar", ajustes.delays[z.nome], "rot", "°", "5", `d-${z.nome}-rot`, -180, 180));
    // "tilt": para um delay pendurado no alto, a apontar para baixo, para a
    // plateia -- positivo inclina para baixo (ver o comentário em cena.js).
    linha.append(campoAjuste("tilt", ajustes.delays[z.nome], "tilt", "°", "5", `d-${z.nome}-tilt`, -90, 90));
    lista.append(linha);
  }

  for (let i = 0; i < numDsm; i++) {
    if (!ajustes.dsm[i]) ajustes.dsm[i] = { dx: 0, dz: 0, rot: 0, tilt: 0 };
    if (ajustes.dsm[i].tilt == null) ajustes.dsm[i].tilt = 0;
    const linha = document.createElement("div");
    linha.className = "ajuste-linha";
    const nome = document.createElement("strong");
    nome.textContent = "DSM " + (i + 1);
    linha.append(nome);
    linha.append(campoAjuste("↔", ajustes.dsm[i], "dx", "m", "0.05", `m${i}-dx`));
    linha.append(campoAjuste("fundo", ajustes.dsm[i], "dz", "m", "0.05", `m${i}-dz`));
    linha.append(campoAjuste("rodar", ajustes.dsm[i], "rot", "°", "5", `m${i}-rot`, -180, 180));
    // Afinação por cima do tombo fixo (ver o comentário em fazerDSM, cena.js).
    linha.append(campoAjuste("tilt", ajustes.dsm[i], "tilt", "°", "5", `m${i}-tilt`, -45, 45));
    lista.append(linha);
  }

}

/**
 * Cada gomo (em "Circular") precisa de uma largura, dx, dz e rot próprios —
 * sem automático nenhum a decidir por quem usa a app, é a pessoa que arruma
 * cada um, arrastando-o na cena (ver "arrastar gomos/delays/DSM", mais
 * abaixo) ou pelos campos que desenharGomos() mostra. Só o PRIMEIRO valor
 * de um gomo novo é que precisa de omissão, e o que faz sentido de origem
 * é o que "Reto" já mostra: os N gomos lado a lado, encostados (a largura
 * da sala a dividir por N cada um), sem rodar nem deslocar — a pessoa parte
 * daí para rodar as pontas para dentro, ou para arrumar como quiser.
 */
function ajustesDeGomosGarantidos(publico) {
  const n = publico.gomos;
  const sala = lerSala();
  const larguraGomo = sala.largura / n;
  // O corredor de cada gomo conta para os DOIS lados dele (ver
  // fazerPublicoGomos em cena.js) — com N gomos lado a lado, o total
  // perdido para corredores cresce como 2×N×corredor. Herdar o valor
  // global tal e qual (pensado para UMA sala inteira, só 2 margens) fazia
  // esse total disparar com N e a lotação desabar só por mudar para
  // "Circular" (reportado: caía para menos de metade, sem mexer em mais
  // nada). Reparte-se o mesmo total que "Reto" perderia (2 margens +
  // "Corredores" internos, todos à largura global) pelos 2×N lados dos
  // gomos, para a lotação ficar parecida ao trocar de modo — cada gomo
  // continua ajustável à mão a partir daqui.
  const corredorGomo = publico.larguraCorredor * (2 + publico.corredores) / (2 * n);
  for (let i = 0; i < n; i++) {
    if (!ajustes.gomos[i]) {
      const dx = -sala.largura / 2 + larguraGomo * (i + 0.5);
      // "corredor" e "filas" nascem à volta dos campos globais de "Público"
      // (o que já se via antes disto existir) mas passam a viver à parte —
      // a pessoa pode depois pôr um gomo sem corredor lateral nenhum
      // (encostado ao vizinho) ou com menos filas do que os outros (uma
      // ala mais curta do que o centro), sem mexer no resto.
      ajustes.gomos[i] = {
        largura: larguraGomo, dx, dz: 0, rot: 0,
        corredor: corredorGomo, filas: publico.filas
      };
    } else {
      // Um gomo criado ANTES de "corredor"/"filas" existirem (guardado em
      // localStorage de uma versão anterior) não tem estas duas
      // propriedades — o campo mostrava "0" (a omissão do próprio campo
      // quando falta o valor) mas o desenho usava o valor GLOBAL (a
      // omissão de fazerPublicoGomos quando o ajuste não tem "corredor"
      // válido): o campo dizia uma coisa, a sala mostrava outra, até a
      // pessoa escrever no campo e os dois passarem a concordar. Preenche-se
      // aqui, uma vez, para os dois começarem sempre iguais.
      if (ajustes.gomos[i].corredor == null) ajustes.gomos[i].corredor = corredorGomo;
      if (ajustes.gomos[i].filas == null) ajustes.gomos[i].filas = publico.filas;
    }
  }
  return ajustes.gomos;
}

function desenharGomos(publico) {
  const lista = $("listaGomos");
  if (publico.formato !== "circular") {
    lista.style.display = "none";
    return;
  }
  lista.style.display = "";
  const n = publico.gomos;
  ajustesDeGomosGarantidos(publico);
  lista.className = "";

  if (aEscreverNaLista(lista)) return;

  lista.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const aj = ajustes.gomos[i];
    const linha = document.createElement("div");
    linha.className = "ajuste-linha";
    const nome = document.createElement("strong");
    nome.textContent = "Gomo " + (i + 1);
    linha.append(nome);
    linha.append(campoAjuste("largura", aj, "largura", "m", "0.5", `gomo-${i}-largura`, 0.5, 60));
    linha.append(campoAjuste("↔", aj, "dx", "m", "0.1", `gomo-${i}-dx`));
    linha.append(campoAjuste("fundo", aj, "dz", "m", "0.1", `gomo-${i}-dz`));
    linha.append(campoAjuste("rodar", aj, "rot", "°", "5", `gomo-${i}-rot`, -180, 180));
    // "corredor" a 0 encosta este gomo ao vizinho, sem vão nenhum entre os
    // dois -- nasce igual ao "Largura dos corredores" global (secção
    // Público), mas fica independente a partir daqui.
    linha.append(campoAjuste("corredor", aj, "corredor", "m", "0.1", `gomo-${i}-corredor`, 0, 5));
    // "filas" nasce igual ao campo global, mas cada gomo pode ter menos (ou
    // mais) do que os outros -- uma ala mais curta do que o centro, etc.
    linha.append(campoAjuste("filas", aj, "filas", "", "1", `gomo-${i}-filas`, 0, 60));
    lista.append(linha);
  }

}

/**
 * Lista de palcos extra (2º, 3º, ...) -- pedido direto ("preciso ter como
 * criar mais do que um... palco"). Cada linha tem os mesmos campos que o
 * palco principal (largura/altura/profundidade) mais posição/rotação
 * próprias, e um botão para remover -- mesma mecânica dos gomos (arrasta-se
 * na cena OU escreve-se aqui, os dois caminhos escrevem no mesmo objecto).
 */
function desenharPalcosExtra() {
  const lista = $("listaPalcosExtra");
  if (!lista) return;
  if (aEscreverNaLista(lista)) return;
  lista.innerHTML = "";
  ajustes.palcosExtra.forEach((pe, i) => {
    const linha = document.createElement("div");
    linha.className = "ajuste-linha";
    const nome = document.createElement("strong");
    nome.textContent = "Palco " + (i + 2);
    linha.append(nome);
    linha.append(campoAjuste("largura", pe, "largura", "m", "0.5", `palcoExtra-${i}-largura`, 1, 200));
    linha.append(campoAjuste("altura", pe, "altura", "m", "0.1", `palcoExtra-${i}-altura`, 0, 10));
    linha.append(campoAjuste("profundidade", pe, "profundidade", "m", "0.5", `palcoExtra-${i}-profundidade`, 0.5, 60));
    linha.append(campoAjuste("arredondar", pe, "raio", "m", "0.25", `palcoExtra-${i}-raio`, 0, 100));
    // Dois atalhos de forma, lado a lado. O primeiro já existia; o segundo
    // veio do pedido "queria arredondar e encostar ao outro como
    // continuidade; para isso deveria ser apenas meio palco, pois senão ao
    // arrumar passa para trás do outro".
    const formas = document.createElement("div");
    formas.className = "ajuste-formas";
    linha.append(formas);

    const redondo = document.createElement("button");
    redondo.type = "button";
    redondo.className = "ajuste-passo";
    redondo.textContent = "⭘";
    redondo.title = "Fazer um círculo — profundidade igual à largura, arredondamento no máximo";
    redondo.setAttribute("aria-label", "Fazer um círculo no Palco " + (i + 2));
    redondo.addEventListener("click", () => {
      pe.profundidade = pe.largura;
      pe.raio = pe.largura / 2;
      pe.meio = false;
      guardarAjustes(ajustes);
      remontarDaqui(0);
    });
    formas.append(redondo);

    // Meia-lua: traseira reta para encostar, frente em curva. A
    // profundidade fica em metade da largura e o raio no máximo -- é isso
    // que dá o semicírculo exacto. A traseira aponta para o fundo da sala;
    // para a virar para outro lado, é o campo "rodar".
    const meiaLua = document.createElement("button");
    meiaLua.type = "button";
    meiaLua.className = "ajuste-passo";
    meiaLua.textContent = "⌒";
    meiaLua.title = "Meia-lua — traseira reta para encostar a outro palco, frente arredondada";
    meiaLua.setAttribute("aria-label", "Fazer uma meia-lua no Palco " + (i + 2));
    meiaLua.addEventListener("click", () => {
      pe.profundidade = pe.largura / 2;
      pe.raio = pe.largura / 2;
      pe.meio = true;
      guardarAjustes(ajustes);
      remontarDaqui(0);
    });
    formas.append(meiaLua);

    // E um interruptor para tirar/pôr a meia-lua sem mexer nas medidas --
    // quem arredondou à mão e só quer a traseira reta não tem de repor
    // largura e profundidade.
    const soFrente = document.createElement("label");
    soFrente.className = "ajuste-sofrente";
    const caixa = document.createElement("input");
    caixa.type = "checkbox";
    caixa.checked = !!pe.meio;
    caixa.addEventListener("change", () => {
      pe.meio = caixa.checked;
      guardarAjustes(ajustes);
      remontarDaqui(0);
    });
    soFrente.append(caixa, document.createTextNode(" só a frente arredondada"));
    formas.append(soFrente);
    linha.append(campoAjuste("↔", pe, "dx", "m", "0.25", `palcoExtra-${i}-dx`));
    linha.append(campoAjuste("fundo", pe, "dz", "m", "0.25", `palcoExtra-${i}-dz`));
    linha.append(campoAjuste("rodar", pe, "rot", "°", "15", `palcoExtra-${i}-rot`, -180, 180));
    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "ajuste-passo ajuste-remover";
    remover.textContent = "✕";
    remover.title = "Remover este palco";
    remover.setAttribute("aria-label", "Remover Palco " + (i + 2));
    remover.addEventListener("click", () => {
      ajustes.palcosExtra.splice(i, 1);
      guardarAjustes(ajustes);
      remontarDaqui();
    });
    linha.append(remover);
    lista.append(linha);
  });
}

/**
 * Lista de régies extra (2ª, 3ª, ...) -- mesma mecânica dos palcos extra
 * acima. Cada uma abre o seu próprio vão na plateia (ver fazerPublico() em
 * cena.js) e só existe enquanto a régie principal estiver ligada.
 */
function desenharRegiesExtra() {
  const lista = $("listaRegiesExtra");
  if (!lista) return;
  if (aEscreverNaLista(lista)) return;
  lista.innerHTML = "";
  ajustes.regiesExtra.forEach((re, i) => {
    const linha = document.createElement("div");
    linha.className = "ajuste-linha";
    const nome = document.createElement("strong");
    nome.textContent = "Régie " + (i + 2);
    linha.append(nome);
    linha.append(campoAjuste("largura", re, "largura", "m", "0.5", `regieExtra-${i}-largura`, 2, 12));
    linha.append(campoAjuste("profundidade", re, "profundidade", "m", "0.5", `regieExtra-${i}-profundidade`, 2, 12));
    linha.append(campoAjuste("↔", re, "dx", "m", "0.25", `regieExtra-${i}-dx`));
    linha.append(campoAjuste("fundo", re, "dz", "m", "0.25", `regieExtra-${i}-dz`));
    linha.append(campoAjuste("rodar", re, "rot", "°", "15", `regieExtra-${i}-rot`, -180, 180));
    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "ajuste-passo ajuste-remover";
    remover.textContent = "✕";
    remover.title = "Remover esta régie";
    remover.setAttribute("aria-label", "Remover Régie " + (i + 2));
    remover.addEventListener("click", () => {
      ajustes.regiesExtra.splice(i, 1);
      guardarAjustes(ajustes);
      remontarDaqui();
    });
    linha.append(remover);
    lista.append(linha);
  });
}

/**
 * Lista de passarelas soltas (2ª, 3ª, ...) -- mesma mecânica das listas
 * acima, mas sem interruptor: existem sempre que estiverem na lista (não
 * dependem de "Ver palco" nem de nenhuma outra secção).
 */
function desenharPassarelasExtra() {
  const lista = $("listaPassarelasExtra");
  if (!lista) return;
  if (aEscreverNaLista(lista)) return;
  lista.innerHTML = "";
  ajustes.passarelasExtra.forEach((pl, i) => {
    const linha = document.createElement("div");
    linha.className = "ajuste-linha";
    const nome = document.createElement("strong");
    nome.textContent = "Passarela " + (i + 1);
    linha.append(nome);
    linha.append(campoAjuste("largura", pl, "largura", "m", "0.1", `passarelaExtra-${i}-largura`, 0.5, 20));
    linha.append(campoAjuste("comprimento", pl, "comprimento", "m", "0.5", `passarelaExtra-${i}-comprimento`, 0.5, 60));
    linha.append(campoAjuste("altura", pl, "altura", "m", "0.1", `passarelaExtra-${i}-altura`, 0, 10));
    linha.append(campoAjuste("↔", pl, "dx", "m", "0.25", `passarelaExtra-${i}-dx`));
    linha.append(campoAjuste("fundo", pl, "dz", "m", "0.25", `passarelaExtra-${i}-dz`));
    linha.append(campoAjuste("rodar", pl, "rot", "°", "15", `passarelaExtra-${i}-rot`, -180, 180));
    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "ajuste-passo ajuste-remover";
    remover.textContent = "✕";
    remover.title = "Remover esta passarela";
    remover.setAttribute("aria-label", "Remover Passarela " + (i + 1));
    remover.addEventListener("click", () => {
      ajustes.passarelasExtra.splice(i, 1);
      guardarAjustes(ajustes);
      remontarDaqui();
    });
    linha.append(remover);
    lista.append(linha);
  });
}

/**
 * Lista de projetores extra (2º, 3º, ...) -- mesma mecânica das listas
 * acima. Chegam sobretudo do Blending Multi-Projetor (Fase 6) mas também
 * dão para editar/remover aqui, tal como os outros tipos. Ao contrário da
 * instância #0 (campos #projLateral/#projAltura/#projDist), cada extra
 * guarda os seus próprios valores directamente no ajuste.
 */
function desenharProjetoresExtra() {
  const lista = $("listaProjetoresExtra");
  if (!lista) return;
  if (aEscreverNaLista(lista)) return;
  lista.innerHTML = "";
  ajustes.projetoresExtra.forEach((pe, i) => {
    const linha = document.createElement("div");
    linha.className = "ajuste-linha";
    const nome = document.createElement("strong");
    nome.textContent = "Projetor " + (i + 2) + (pe.modelo ? " · " + pe.modelo : "");
    linha.append(nome);
    linha.append(campoAjuste("rácio", pe, "racio", "", "0.05", `projetorExtra-${i}-racio`, 0.1, 10));
    linha.append(campoAjuste("distância", pe, "distancia", "m", "0.1", `projetorExtra-${i}-distancia`, 0.1, 100));
    linha.append(campoAjuste("altura", pe, "altura", "m", "0.1", `projetorExtra-${i}-altura`, -5, 20));
    linha.append(campoAjuste("↔", pe, "lateral", "m", "0.25", `projetorExtra-${i}-lateral`));
    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "ajuste-passo ajuste-remover";
    remover.textContent = "✕";
    remover.title = "Remover este projetor";
    remover.setAttribute("aria-label", "Remover Projetor " + (i + 2));
    remover.addEventListener("click", () => {
      ajustes.projetoresExtra.splice(i, 1);
      guardarAjustes(ajustes);
      remontarDaqui();
    });
    linha.append(remover);
    lista.append(linha);
  });
}

/**
 * Imagem PRÓPRIA por ecrã (pedido direto: "poder por uma imagem em cada
 * ecrã" -- diferente entre eles, não a mesma repetida, que já é "Uma em
 * cada" acima). Uma linha por zona do projeto, com um botão para escolher
 * uma imagem só para essa e, se já tiver uma, um botão para a tirar (volta
 * a mostrar o que estiver acima -- padrão de teste/imagem geral/só cor).
 */
function desenharListaConteudoZonas(projetoAtual) {
  const titulo = $("tituloConteudoZonas"), nota = $("notaConteudoZonas"), lista = $("listaConteudoZonas");
  const zonas = (projetoAtual && projetoAtual.zonas) || [];
  if (!zonas.length) {
    titulo.style.display = "none"; nota.style.display = "none"; lista.style.display = "none";
    return;
  }
  titulo.style.display = ""; nota.style.display = ""; lista.style.display = "";

  // Zonas que já não existem (projeto trocado/reduzido) não ficam presas em
  // memória para sempre -- só as que aparecem agora é que interessam.
  const nomesAtuais = new Set(zonas.map(z => z.nome));
  Object.keys(texturasPorZona).forEach(nome => { if (!nomesAtuais.has(nome)) delete texturasPorZona[nome]; });
  Object.keys(texturasPorZonaDataURL).forEach(nome => { if (!nomesAtuais.has(nome)) delete texturasPorZonaDataURL[nome]; });

  lista.innerHTML = "";
  zonas.forEach(zona => {
    const linha = document.createElement("div");
    linha.className = "ajuste-linha";
    const nome = document.createElement("strong");
    nome.textContent = zona.nome;
    linha.append(nome);

    const temImagem = !!texturasPorZona[zona.nome];
    if (temImagem) {
      const marca = document.createElement("i");
      marca.textContent = "imagem própria";
      linha.append(marca);
    }

    const ficheiro = document.createElement("input");
    ficheiro.type = "file"; ficheiro.accept = "image/*"; ficheiro.hidden = true;
    ficheiro.dataset.zona = zona.nome;
    linha.append(ficheiro);

    const btEscolher = document.createElement("button");
    btEscolher.type = "button";
    btEscolher.textContent = temImagem ? "Trocar…" : "Escolher imagem…";
    btEscolher.onclick = () => ficheiro.click();
    linha.append(btEscolher);

    if (temImagem) {
      const btRemover = document.createElement("button");
      btRemover.type = "button";
      btRemover.textContent = "Remover";
      btRemover.onclick = () => {
        delete texturasPorZona[zona.nome];
        delete texturasPorZonaDataURL[zona.nome];
        montar(false);
      };
      linha.append(btRemover);
    }

    ficheiro.onchange = async () => {
      const f = ficheiro.files[0];
      if (!f) return;
      try {
        const { textura: t, dataURL: url } = await conteudoDeFicheiro(f);
        texturasPorZona[zona.nome] = t;
        texturasPorZonaDataURL[zona.nome] = url;
        montar(false);
      } catch (e) {
        $("aviso").textContent = e.message;
        $("aviso").classList.add("mostra");
      }
    };

    lista.append(linha);
  });
}

// -------------------------------------------------------------------- vistas

/** As peças que SÃO a sala. Tudo o resto é alguém ter posto lá qualquer coisa. */
const CASCA_DA_SALA = ["sala", "chao", "paredes", "planta", "grelha"];

/**
 * Há alguma coisa na sala, ou só a sala?
 *
 * Pergunta-se ao DESENHO e não aos campos: é a única resposta que não pode
 * divergir do que se está a ver. Uma lista de condições ("sem zonas, e sem
 * dome, e sem dsm, e com o palco desligado, e...") ficava desatualizada à
 * primeira coisa nova que se desenhasse.
 */
function salaEstaVazia() {
  if (!desenhado) return true;
  let algo = false;
  desenhado.traverse((o) => {
    if (algo || !o.name || o === desenhado) return;
    if (o.name.indexOf("aux:") === 0) return;
    if (CASCA_DA_SALA.includes(o.name)) return;
    // Filho de uma peça da casca (as paredes têm as suas) não conta por si.
    for (let p = o.parent; p && p !== desenhado; p = p.parent) {
      if (p.name && CASCA_DA_SALA.includes(p.name)) return;
    }
    algo = true;
  });
  return !algo;
}

function vista(qual) {
  // O "Trazer tudo" entra por aqui de propósito: é o mesmo grupo de botões e a
  // mesma ligação de eventos, e assim um botão novo no HTML não precisa de um
  // onclick próprio -- que é precisamente o que já partiu a app uma vez (ver o
  // aviso junto à ligação dos botões).
  if (qual === "casa") { trazerTudoAVista(); return; }
  if (qual === "desfazer") { desfazer(); return; }
  const fovQueQuer = qual === "dome" ? FOV_DENTRO_DA_CUPULA : FOV_NORMAL;
  if (camara.fov !== fovQueQuer) { camara.fov = fovQueQuer; camara.updateProjectionMatrix(); }
  // Numa sala VAZIA não se enquadra a sala: enquadra-se onde as coisas vão
  // nascer. A app passou a abrir com 50 × 50 por omissão, e enquadrar 50 m de
  // nada punha a câmara a 42 m a olhar para uma tira de chão ao fundo -- uma
  // sala pronta a receber parecia uma app avariada. Com qualquer coisa lá
  // dentro, volta a mandar a sala a sério.
  const salaReal = lerSala();
  const sala = salaEstaVazia()
    ? { largura: Math.min(salaReal.largura, 24), profundidade: Math.min(salaReal.profundidade, 20),
        altura: salaReal.altura }
    : salaReal;
  const palco = lerPalco();
  const alvo = new THREE.Vector3(
    0,
    palco.altura + palco.acimaDoPalco + (alturaDoQueEstaNaSala() / 2),
    -sala.profundidade / 2 + 0.5);

  if (qual === "frente") {
    // De trás da sala e um pouco acima: assim vê-se o ecrã, o chão e a gente
    // toda entre um e outro, que é a pergunta a que isto responde.
    camara.position.set(0, Math.max(5.2, alvo.y * 1.35), sala.profundidade / 2 + sala.profundidade * 0.35);
    alvo.y = Math.max(1.6, alvo.y * 0.75);
    alvo.z = -sala.profundidade / 2 + sala.profundidade * 0.3;
  } else if (qual === "lado") {
    camara.position.set(sala.largura / 2 + sala.largura * 0.3, alvo.y + 2.5, sala.profundidade * 0.15);
    alvo.y = Math.max(1.6, alvo.y * 0.7);
    alvo.z = -sala.profundidade / 2 + sala.profundidade * 0.3;
  } else if (qual === "cima") {
    // Planta: a pique sobre o meio da sala, e não a olhar para a parede.
    camara.position.set(0, Math.max(sala.largura, sala.profundidade) * 1.15, 0.01);
    alvo.set(0, 0, -sala.profundidade * 0.08);
  } else if (qual === "dome") {
    // De dentro, a olhar para cima: é de onde o público vê uma cúpula, e é a
    // única vista em que se percebe a repartição pelos projetores. Ao nível
    // dos olhos, um pouco fora do centro (no centro exacto não se percebe
    // para que lado se está virado).
    const d = projeto && projeto.dome;
    const aDome = d ? Math.max(0.5, (parseFloat(d.diametro) || 8) / 2) : 4;
    const hDome = d ? Math.max(0.5, parseFloat(d.altura) || aDome) : 4;
    // Perto do centro (não no centro exacto: aí não se percebe para que lado
    // se está virado) e a olhar para cima em diagonal. Apontar quase a prumo
    // enche o ecrã com a superfície ao lado e não se vê a cúpula.
    camara.position.set(0, 1.6, aDome * 0.15);
    controlos.target.set(0, hDome * 0.7, -aDome * 0.9);
    controlos.update();
    return;
  } else if (qual === "olhos") {
    const p = olhosDaPlateia || new THREE.Vector3(0, 1.2, sala.profundidade / 4);
    camara.position.copy(p);
    controlos.target.set(alvo.x, alvo.y, alvo.z);
    controlos.update();
    return;
  }
  controlos.target.copy(alvo);
  controlos.update();
}

// --------------------------------------------------------------- desfazer
//
// UM PASSO ATRÁS, CINCO VEZES.
//
// Pedido a seguir ao "trazer tudo à vista": *"podes incluir um undo também,
// que dá jeito -- com apenas 5 níveis chega"*. E cinco chegam mesmo: isto é
// para desfazer o arrasto que correu mal, não para viajar no tempo.
//
// O PONTO DE PASSAGEM É UM SÓ. Trinta e duas linhas desta app mudam os ajustes
// e a seguir chamam guardarAjustes(); em vez de pendurar um gancho em cada uma
// -- e esquecer a trigésima terceira no mês que vem -- o guardarAjustes() daqui
// embrulha o de projeto.js. Quem grava, regista.
//
// O instantâneo só se pode tirar DEPOIS da alteração, que é quando se sabe que
// ela aconteceu. Por isso guarda-se sempre o estado atual à parte: quando chega
// uma alteração nova, o que vai para a pilha é esse (que já é o ANTERIOR), e só
// então se tira um fresco. Assim a pilha tem estados anteriores, que é o que um
// "anular" precisa.
const NIVEIS_DE_DESFAZER = 5;
const historico = [];
let estadoAnterior = null;

/**
 * O estado que um passo atrás tem de repor.
 *
 * Os ajustes não chegam: a régie, o ecrã curvo e o projetor guardam a posição
 * em CAMPOS do painel e não no objeto dos ajustes (ver alvoDeCampos()). Um
 * anular que repusesse só os ajustes desfazia metade dos arrastos e deixava a
 * outra metade onde estava -- pior do que não ter anular nenhum.
 */
function instantaneo() {
  const campos = {};
  document.querySelectorAll("#painel input, #painel select").forEach((el) => {
    if (!el.id) return;
    campos[el.id] = el.type === "checkbox" ? el.checked : el.value;
  });
  return {
    ajustes: JSON.stringify(ajustes),
    campos: campos,
    ondeEsta: ondeEsta ? { ...ondeEsta } : null,
    ondeEstaNaDome: ondeEstaNaDome ? { ...ondeEstaNaDome } : null
  };
}

function aplicarInstantaneo(i) {
  ajustes = JSON.parse(i.ajustes);
  Object.keys(i.campos).forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = i.campos[id];
    else el.value = i.campos[id];
  });
  ondeEsta = i.ondeEsta ? { ...i.ondeEsta } : null;
  ondeEstaNaDome = i.ondeEstaNaDome ? { ...i.ondeEstaNaDome } : null;
}

/** O guardarAjustes desta app: grava e, de caminho, deixa por onde voltar. */
function guardarAjustes(a) {
  marcarPorGuardar();
  if (estadoAnterior) {
    historico.push(estadoAnterior);
    while (historico.length > NIVEIS_DE_DESFAZER) historico.shift();
  }
  estadoAnterior = instantaneo();
  atualizarBotaoDesfazer();
  persistirAjustes(a);
}

function atualizarBotaoDesfazer() {
  // Quantos passos ainda há: sem isto, carregar num botão que já não faz nada
  // parece uma app avariada em vez de uma pilha no fim.
  const titulo = historico.length
    ? "Desfazer a última alteração (" + historico.length + " de " + NIVEIS_DE_DESFAZER + " guardados)"
    : "Nada para desfazer";
  // Os dois: o do painel e o da cena. Acendem e apagam juntos porque são o
  // mesmo botão em dois sítios -- um para quem tem o painel aberto, outro para
  // quem está a arrastar no telemóvel com o painel fechado.
  ["btDesfazer", "btDesfazerTela"].forEach((id) => {
    const b = $(id);
    if (!b) return;
    b.disabled = historico.length === 0;
    b.title = titulo;
  });
}

/**
 * O QUE ACONTECEU, DITO NOS DOIS SÍTIOS ONDE ALGUÉM PODE ESTAR A OLHAR.
 *
 * A nota do painel não chega a quem está a olhar para o 3D com o painel
 * fechado -- que no telemóvel é quase sempre. Pedido assim: *"e visível no
 * ecrã para mobiles"*. Um texto só, escrito nos dois lados: duas mensagens
 * acabariam a discordar no dia em que uma delas mudasse.
 */
let recadoAFechar = null;
function dizerNaCena(texto) {
  const nota = $("notaTrazerTudo");
  if (nota) { nota.textContent = texto; nota.style.display = "block"; }
  const recado = $("recadoTela");
  if (!recado) return;
  recado.textContent = texto;
  recado.hidden = false;
  // Some sozinho: é uma confirmação, não um aviso permanente, e a tapar a cena
  // não pode ficar.
  clearTimeout(recadoAFechar);
  recadoAFechar = setTimeout(() => { recado.hidden = true; }, 4000);
}

function desfazer() {
  const dizer = dizerNaCena;
  const anterior = historico.pop();
  if (!anterior) { dizer("Não há mais nada para desfazer."); atualizarBotaoDesfazer(); return; }
  aplicarInstantaneo(anterior);
  // O estado reposto passa a ser o ponto de partida: sem isto, a alteração
  // seguinte empurrava para a pilha o estado que se acabou de desfazer.
  estadoAnterior = instantaneo();
  persistirAjustes(ajustes);
  montar();
  atualizarBotaoDesfazer();
  dizer(historico.length
    ? "Desfeito. Ainda dá para voltar atrás mais " + historico.length +
      (historico.length === 1 ? " vez." : " vezes.")
    : "Desfeito. Era o último passo guardado.");
}

/**
 * TRAZER TUDO À VISTA.
 *
 * Reportado do telemóvel: *"acabei de desaparecer com tudo enquanto estava a
 * mover o boneco — daria jeito um 'home all' para trazer todos os objetos da
 * sala para o ponto de origem de forma a que os consiga ver"*. Num ecrã
 * pequeno um arrasto que devia mexer numa peça mexe na câmara, e a sala vai
 * parar a um sítio de onde não se vê nada — sem nada de errado com o projeto.
 *
 * Duas coisas, por esta ordem, e nenhuma delas atira o projeto fora:
 *
 * 1. As peças que ficaram FORA DA SALA voltam para dentro. Só essas: arrastar
 *    tudo para a origem seria desfazer uma montagem boa para resolver um
 *    problema de câmara, e quem passou meia hora a colocar as coisas não quer
 *    isso. As que estão dentro não se mexem um centímetro.
 * 2. A câmara enquadra o que EXISTE, e não o que a sala mede — é a diferença
 *    entre voltar a ver e continuar a olhar para o vazio ao lado.
 */
function trazerTudoAVista() {
  const arrumadas = arrumarOQueFugiuDaSala();
  if (arrumadas) { guardarAjustes(ajustes); montar(); }
  enquadrarOQueExiste();
  // Dizer o que se mexeu, e dizer quando não se mexeu nada. Um botão que age em
  // silêncio deixa quem carregou sem saber se aconteceu alguma coisa -- e
  // neste, que existe justamente para quando já não se percebe o que se está a
  // ver, o silêncio era o pior dos defeitos.
  dizerNaCena(arrumadas
    ? (arrumadas === 1 ? "1 peça estava fora da sala e voltou para dentro. Câmara reenquadrada."
                       : arrumadas + " peças estavam fora da sala e voltaram para dentro. Câmara reenquadrada.")
    : "Câmara reenquadrada — está tudo à vista. Nenhuma peça foi movida.");
}

/**
 * As peças que saíram das paredes, de volta para dentro.
 *
 * Usa a MESMA lista de objetos arrastáveis que o rato usa: quem se pode mexer
 * à mão é exactamente quem pode ter fugido, e uma segunda lista aqui acabaria
 * a discordar dela. O `setXZ` trabalha na mesma escala do mundo que o arrasto
 * (ver o pointermove), por isso somar um deslocamento é o mesmo que arrastar.
 */
function arrumarOQueFugiuDaSala() {
  const sala = lerSala();
  // A RÉGUA NÃO É A PAREDE. Medido num projeto de exemplo acabado de abrir,
  // a parede dava "3 peças fora da sala" sem ninguém ter tocado em nada: os
  // ecrãs vivem encostados ao fundo e, em retro, as máquinas ficam metros
  // atrás do pano de propósito. Essas não fugiram -- estão onde têm de estar.
  //
  // Fugiu é o que está TÃO longe que já não pertence à cena: três vezes a
  // maior medida da sala. Uma máquina 12 m atrás do ecrã fica; uma peça a
  // 200 m volta. Entre uma coisa e outra não há dúvida nenhuma a resolver.
  const perto = Math.max(sala.largura, sala.profundidade, 10);
  const limite = perto * 3;
  const limiteX = Math.max(1, sala.largura / 2);
  const limiteZ = Math.max(1, sala.profundidade / 2);
  const fugiu = (x, z) => Math.abs(x) > limite || Math.abs(z) > limite;
  let mexidas = 0;

  // O boneco vive fora dos ajustes (é ele que o arrasto move directamente), e
  // por isso também fora da lista. Uma sala encolhida depois de ele ter sido
  // colocado deixa-o do lado de fora da parede sem ninguém lhe tocar.
  [ondeEsta, ondeEstaNaDome].forEach((onde) => {
    if (!onde || !fugiu(onde.x, onde.z)) return;
    onde.x = Math.min(limiteX, Math.max(-limiteX, onde.x));
    onde.z = Math.min(limiteZ, Math.max(-limiteZ, onde.z));
    mexidas += 1;
  });

  objetosArrastaveis().forEach((alvo) => {
    if (!alvo.obj || !alvo.getXZ || !alvo.setXZ) return;
    const mundo = new THREE.Vector3();
    alvo.obj.getWorldPosition(mundo);
    if (!fugiu(mundo.x, mundo.z)) return;
    const dx = Math.min(limiteX, Math.max(-limiteX, mundo.x)) - mundo.x;
    const dz = Math.min(limiteZ, Math.max(-limiteZ, mundo.z)) - mundo.z;
    const onde = alvo.getXZ();
    alvo.setXZ(Math.round((onde.x + dx) * 100) / 100, Math.round((onde.z + dz) * 100) / 100);
    mexidas += 1;
  });
  return mexidas;
}

/**
 * QUEM FICOU DO LADO DE FORA DAS PAREDES.
 *
 * Reportado com uma fotografia: *"alterei as medidas da sala e os objetos não
 * acompanharam, o palco 2 ficou fora"*. E ficou mesmo -- as peças com posição
 * própria (palcos, régies e passarelas extra, os gomos, os DSM) são colocadas
 * em coordenadas suas, não em percentagem da sala. Encolher a sala à volta
 * delas deixa-as onde estavam, que passa a ser lá fora.
 *
 * A app já tinha a arrumarOQueFugiuDaSala(), mas com duas lacunas que juntas
 * dão exactamente isto: só corre a pedido (o botão de trazer tudo à vista), e
 * a régua dela é de propósito muito larga -- "fugiu" é estar a três vezes a
 * maior medida da sala. Essa largura existe por boa razão (em retro as
 * máquinas ficam metros atrás do pano e NÃO fugiram), mas um palco dois
 * metros para lá da parede nova nunca lá cai.
 *
 * ENTÃO PORQUE NÃO AS TRAZER DE VOLTA SOZINHO? Porque uma peça encostada à
 * parede, ou meio metro para lá dela, pode estar onde alguém a pôs de
 * propósito -- e a app a mexer-lhe sem pedir seria desfazer trabalho para
 * resolver um problema que ela nem sabe se existe. O que ela pode fazer, e
 * não fazia, é DIZER. Com um botão ao lado, para arrumar quem quiser.
 *
 * Os projetores ficam de fora desta conta: em retroprojecção vivem atrás do
 * pano, portanto fora da sala, e acusá-los todas as vezes era ensinar a
 * ignorar o aviso.
 */
function pecasForaDasParedes() {
  const sala = lerSala();
  // Meio palmo de tolerância: uma peça encostada à parede não está fora dela,
  // e sem esta folga o arredondamento acusava-a.
  const limiteX = sala.largura / 2 + 0.1;
  const limiteZ = sala.profundidade / 2 + 0.1;
  const fora = [];
  objetosArrastaveis().forEach((alvo) => {
    if (!alvo.obj || !alvo.rotulo) return;
    if (/^Projetor/.test(alvo.rotulo) || alvo.rotulo === "Ecrã curvo") return;
    const mundo = new THREE.Vector3();
    alvo.obj.getWorldPosition(mundo);
    if (Math.abs(mundo.x) > limiteX || Math.abs(mundo.z) > limiteZ) {
      fora.push({ rotulo: alvo.rotulo, alvo: alvo, x: mundo.x, z: mundo.z });
    }
  });
  return fora;
}

/** Traz para dentro das paredes exactamente as peças que a lista nomeia. */
function trazerParaDentro(lista) {
  const sala = lerSala();
  const limiteX = Math.max(1, sala.largura / 2);
  const limiteZ = Math.max(1, sala.profundidade / 2);
  let mexidas = 0;
  lista.forEach((p) => {
    if (!p.alvo.getXZ || !p.alvo.setXZ) return;
    const dx = Math.min(limiteX, Math.max(-limiteX, p.x)) - p.x;
    const dz = Math.min(limiteZ, Math.max(-limiteZ, p.z)) - p.z;
    const onde = p.alvo.getXZ();
    p.alvo.setXZ(Math.round((onde.x + dx) * 100) / 100,
                 Math.round((onde.z + dz) * 100) / 100);
    mexidas++;
  });
  if (mexidas) { guardarAjustes(ajustes); montar(); }
  return mexidas;
}

/**
 * A câmara a enquadrar o que está mesmo desenhado.
 *
 * As vistas fixas (Frente, Lado, Cima) enquadram a SALA, que é o que se quer
 * quase sempre. Esta enquadra a caixa do que existe: é a que serve quando
 * alguém se perdeu, porque não assume que o que se procura está onde devia.
 */
function enquadrarOQueExiste() {
  if (camara.fov !== FOV_NORMAL) { camara.fov = FOV_NORMAL; camara.updateProjectionMatrix(); }
  const caixa = new THREE.Box3();
  if (desenhado) caixa.expandByObject(desenhado);
  // Sala vazia, ou tudo desligado: não há caixa nenhuma para enquadrar e a
  // vista de frente é a resposta honesta.
  if (caixa.isEmpty()) { vista("frente"); return; }

  const centro = caixa.getCenter(new THREE.Vector3());
  const tamanho = caixa.getSize(new THREE.Vector3());
  const maior = Math.max(tamanho.x, tamanho.y, tamanho.z, 2);
  // A distância que mete a caixa toda no ecrã, pelo lado mais apertado: num
  // telemóvel ao alto quem manda é a largura, e usar só o FOV vertical deixava
  // as pontas de fora precisamente no ecrã em que isto faz falta.
  const meioFovV = (camara.fov * Math.PI) / 360;
  const meioFovH = Math.atan(Math.tan(meioFovV) * camara.aspect);
  const distancia = (maior / 2) / Math.tan(Math.min(meioFovV, meioFovH)) * 1.25;
  // Do mesmo sítio de onde a vista "Frente" olha — de trás e um pouco acima,
  // que é como se lê uma sala — mas à distância que faz caber tudo.
  camara.position.set(
    centro.x,
    centro.y + Math.max(2, distancia * 0.35),
    centro.z + distancia * 0.9);
  controlos.target.copy(centro);
  controlos.update();
}

// ------------------------------------------------------------------ etiquetas

const caixaEtiquetas = $("etiquetas");
function desenharEtiquetas() {
  const filhos = caixaEtiquetas.children;
  while (filhos.length > etiquetas.length) caixaEtiquetas.removeChild(filhos[filhos.length - 1]);
  while (filhos.length < etiquetas.length) caixaEtiquetas.append(document.createElement("span"));

  const largura = tela.clientWidth, altura = tela.clientHeight;
  const MARGEM_ETIQUETA = 4;
  const visiveis = [];
  etiquetas.forEach((etiqueta, i) => {
    const elemento = filhos[i];
    const p = etiqueta.ponto.clone().project(camara);
    const atras = p.z > 1;
    elemento.style.display = atras ? "none" : "block";
    if (atras) return;
    if (elemento.textContent !== etiqueta.texto) {
      elemento.textContent = etiqueta.texto;
      // O tamanho só muda quando o texto muda -- medir a cada frame (60x por
      // segundo) só para isto seria caro à toa. offsetWidth/Height já vêm
      // corretos mesmo com o "transform" do CSS, que não mexe na caixa.
      elemento._larguraEtiqueta = elemento.offsetWidth;
      elemento._alturaEtiqueta = elemento.offsetHeight;
    }
    // Uma etiqueta centrada mesmo em cima do canto do ecrã ficava meio
    // cortada pela borda do "tela" (o telemóvel é estreito, o painel de
    // largura variável também aperta a vista) -- empurra-se para dentro só
    // o necessário para caber inteira, sem mexer nas que já cabem.
    const meioL = (elemento._larguraEtiqueta || 0) / 2;
    const meioA = (elemento._alturaEtiqueta || 0) / 2;
    const x = (p.x * 0.5 + 0.5) * largura;
    const y = (-p.y * 0.5 + 0.5) * altura;
    visiveis.push({
      elemento: elemento, meioL: meioL, meioA: meioA,
      x: Math.min(Math.max(x, meioL + MARGEM_ETIQUETA), largura - meioL - MARGEM_ETIQUETA),
      y: Math.min(Math.max(y, meioA + MARGEM_ETIQUETA), altura - meioA - MARGEM_ETIQUETA)
    });
  });

  // DUAS ETIQUETAS NÃO SE SOBREPÕEM.
  //
  // Reportado a olhar para uma fila de blend de cinco: as cinco coordenadas
  // caíam quase no mesmo sítio do ecrã e o que se lia era uma papa. As zonas
  // tinham o mesmo defeito à espera, sempre que dois ecrãs ficavam alinhados
  // com a câmara -- uma etiqueta que tapa outra é pior do que etiqueta nenhuma,
  // porque as duas deixam de se ler e nada diz que ali estão duas.
  //
  // Ordena-se por altura no ecrã e empurra-se para baixo quem chocar com a
  // anterior, só o necessário. Não é um algoritmo de rotulagem a sério (essa é
  // outra vida) -- resolve o caso que acontece: coisas lado a lado à mesma
  // altura. Quem ficar fora da tela é limitado ao fundo, como já era.
  // TRÊS PASSAGENS, e a lista reordenada em cada uma. Com uma só, empurrar uma
  // etiqueta para baixo desordenava a lista a meio da varredura, e as
  // comparações seguintes passavam a olhar para o vizinho errado -- numa fila
  // de cinco, duas continuavam sobrepostas. Vinte etiquetas ordenadas três
  // vezes não custa nada, e converge no caso que acontece.
  for (let passe = 0; passe < 3; passe++) {
    visiveis.sort((a, b) => a.y - b.y);
    let mexeu = false;
    for (let i = 1; i < visiveis.length; i++) {
      const cima = visiveis[i - 1], baixo = visiveis[i];
      // Só empurra quem se cruza TAMBÉM na horizontal: duas etiquetas à mesma
      // altura em cantos opostos do ecrã não se estorvam nenhuma.
      const cruzamX = Math.abs(cima.x - baixo.x) < (cima.meioL + baixo.meioL);
      const minimo = cima.y + cima.meioA + baixo.meioA + 2;
      if (cruzamX && baixo.y < minimo) {
        baixo.y = Math.min(minimo, altura - baixo.meioA - MARGEM_ETIQUETA);
        mexeu = true;
      }
    }
    if (!mexeu) break;
  }
  visiveis.forEach((v) => {
    v.elemento.style.left = v.x + "px";
    v.elemento.style.top = v.y + "px";
  });
}

// --------------------------------------------------------------------- laço

function medir() {
  const largura = tela.clientWidth, altura = tela.clientHeight;
  if (!largura || !altura) return;
  renderizador.setSize(largura, altura, false);
  camara.aspect = largura / altura;
  camara.updateProjectionMatrix();
}

function volta() {
  requestAnimationFrame(volta);
  medir();
  controlos.update();
  // O chão é o chão: em vez de proibir olhar para cima, proíbe-se cavar.
  if (camara.position.y < 0.08) camara.position.y = 0.08;
  renderizador.render(cena, camara);
  desenharEtiquetas();
}

// ------------------------------------------------------------------- ligações

let temporizador = null;
function remontarDaqui(ms = 120) {
  // Quem mexe num campo do painel passa por aqui -- é o sítio onde "há coisas
  // por guardar" fica verdade. Ver beforeunload, mais abaixo.
  marcarPorGuardar();
  clearTimeout(temporizador);
  temporizador = setTimeout(() => montar(false), ms);
}

// A base do ecrã tem de arrastar a altura das lentes ANTES do redesenho, senão
// o primeiro desenho sai com a fila à altura antiga e só o seguinte corrige.
if ($("curvaBase")) {
  $("curvaBase").addEventListener("input", acompanharBaseDoEcra);
  $("curvaBase").addEventListener("change", acompanharBaseDoEcra);
}
document.querySelectorAll("#painel input").forEach(campo => {
  campo.addEventListener("input", () => remontarDaqui());
  campo.addEventListener("change", () => remontarDaqui(0));
});
// O campo das excepções é uma caixa de texto (leva várias linhas) e não entra
// no querySelectorAll acima, que só apanha <input>. Sem isto, escrever lá não
// redesenhava nada — e um campo que não faz nada parece avariado.
if ($("excecoesLugares")) {
  $("excecoesLugares").addEventListener("input", () => remontarDaqui(250));
  $("excecoesLugares").addEventListener("change", () => remontarDaqui(0));
}

// UMA CAIXA DE LUGARES POR CADA BLOCO, e tantas quantos os blocos.
//
// Nascem e desaparecem com o campo "Corredores" -- 2 corredores são 3 blocos.
// O querySelectorAll ali em cima corre UMA vez, no arranque, e por isso não
// apanha campos criados depois: cada caixa é ligada ao nascer, senão escrever
// nela não redesenhava nada e parecia avariada.
function desenharCaixasDeLugares() {
  const caixa = $("lugaresPorBloco");
  if (!caixa) return;
  const blocos = Math.max(0, Math.min(4, Math.round(num("corredores")) || 0)) + 1;
  const jaLa = [...caixa.querySelectorAll("input")];
  if (jaLa.length === blocos) return;              // nada mudou, não se mexe
  const valores = jaLa.map((el) => el.value);      // o que já estava escrito fica
  caixa.innerHTML = "";
  for (let b = 0; b < blocos; b++) {
    const rotulo = document.createElement("label");
    rotulo.textContent = blocos === 1 ? "Lugares por fila " : "Bloco " + (b + 1) + " ";
    const campo = document.createElement("input");
    campo.type = "number"; campo.min = "0"; campo.max = "200"; campo.step = "1";
    campo.placeholder = "auto";
    campo.value = valores[b] != null ? valores[b] : "";
    campo.addEventListener("input", () => remontarDaqui());
    campo.addEventListener("change", () => remontarDaqui(0));
    rotulo.appendChild(campo);
    rotulo.appendChild(document.createElement("i"));
    caixa.appendChild(rotulo);
  }
}
$("corredores").addEventListener("input", desenharCaixasDeLugares);
$("corredores").addEventListener("change", desenharCaixasDeLugares);
desenharCaixasDeLugares();

document.querySelectorAll(".vistas button[data-vista]").forEach(b => {
  b.onclick = () => vista(b.dataset.vista);
});
// index.html fica em cache (só atualiza em segundo plano, para a navegação
// seguinte) mas js/app.js é sempre buscado à rede primeiro (ver sw.js) — um
// botão novo ligado sem esta guarda parte a meio de quem abrir a app nesse
// intervalo (HTML antigo sem o botão + JS novo à espera dele): "$(id)" dá
// null, ".onclick =" rebenta, e tudo o que vem a seguir no ficheiro nunca
// chega a correr (reportado: "nem abrir o exemplo abre", muito depois deste
// ponto no ficheiro). Nunca ligar um evento a um elemento novo sem checar
// primeiro que ele existe.
// O botão da cena fazia vista("frente"), que enquadra a SALA. Passa a fazer o
// "Trazer tudo à vista", que enquadra o que EXISTE -- é o mesmo trabalho feito
// melhor, e dois botões a fazerem quase a mesma coisa é a doença desta casa.
if ($("btRecentrarVista")) $("btRecentrarVista").onclick = () => trazerTudoAVista();
// Mesma guarda de "existe mesmo?": quem abrir a app entre o HTML antigo em
// cache e o JS novo da rede não pode levar com um erro que mata tudo o que
// vem a seguir no ficheiro.
if ($("btDesfazerTela")) $("btDesfazerTela").onclick = () => desfazer();

// Pavilhão ou auditório. São dois mundos: num, o chão é plano e quem está atrás
// vê a nuca de quem está à frente; no outro, o chão sobe e por isso é que se
// consegue ver. Os botões são atalhos — quem manda continua a ser o campo.
function marcarTipoDePlateia() {
  const sobe = num("inclinacao") > 0.005;
  document.querySelectorAll("#tipoPlateia button").forEach(b => {
    b.classList.toggle("destaque", (b.dataset.plateia === "auditorio") === sobe);
  });
}
document.querySelectorAll("#tipoPlateia button").forEach(b => {
  b.onclick = () => {
    $("inclinacao").value = b.dataset.plateia === "auditorio" ? "0.12" : "0";
    marcarTipoDePlateia();
    montar(false);
  };
});
$("inclinacao").addEventListener("input", marcarTipoDePlateia);
marcarTipoDePlateia();

// Reto (uma fileira de blocos, como sempre foi) ou circular (gomos iguais
// à volta do palco). Guarda-se no próprio contentor (dataset), não há
// campo nenhum de onde isto se possa derivar como o "tipoPlateia" deriva
// da inclinação.
function marcarFormatoPlateia() {
  const valor = $("formatoPlateia").dataset.valor || "reto";
  document.querySelectorAll("#formatoPlateia button").forEach(b => {
    b.classList.toggle("destaque", b.dataset.forma === valor);
  });
  const circular = valor === "circular";
  $("camposGomos").style.display = circular ? "" : "none";
  $("opcaoGomosId").style.display = circular ? "" : "none";
  $("notaGomos").style.display = circular ? "" : "none";
}
document.querySelectorAll("#formatoPlateia button").forEach(b => {
  b.onclick = () => {
    $("formatoPlateia").dataset.valor = b.dataset.forma;
    marcarFormatoPlateia();
    montar(false);
  };
});
marcarFormatoPlateia();

/**
 * Uma zona pode voltar dos Calculadores com o MESMO id e outro nome — foi
 * renomeada lá, ou trocou-se o modelo da TV (que muda o nome-base de toda a
 * fila). Os ajustes de posição/rotação continuam guardados por nome, e há boa
 * razão para isso: o nome é também a chave do objecto na cena (`delay-<nome>`),
 * do arrasto e do fazerZonas. Em vez de mudar tudo isso de chave, usa-se o id
 * para PERSEGUIR o nome — sempre que a zona reaparece com outro nome, o ajuste
 * (e a marca "sem leitura") mudam de nome com ela.
 *
 * Sem id — projeto gravado antes disto, ou colado à mão — não corre nada e
 * fica tudo exatamente como sempre esteve.
 */
// Uma zona criada aqui ("+ Ecrã", "+ Delay") também precisa de identidade:
// ela vai voltar aos Calculadores pelo retorno automático e há-de regressar
// no sync seguinte -- sem id, regressava como "outra zona qualquer". Mesmo
// feitio do id que os Calculadores geram (lzNovoZid em js/zonas.js).
function novoIdZona() {
  return "z" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ------------------------------------------------------------- o depósito
//
// Pedido direto: "ter um depósito onde tudo o que vem do projeto da
// calculadora fique, e vou retirando para montar o 3d" -- para não amontoar
// peças na sala. Uma peça que chega dos Calculadores fica aqui à espera, e só
// entra na cena quando for o mike a mandá-la entrar.
//
// A regra que daqui sai, e que o resto do ficheiro respeita: o 3D trabalha
// sobre o projeto MONTADO; o projeto inteiro só existe para a lista do
// depósito e para o retorno aos Calculadores (que tem de continuar a mandar
// tudo, senão o depósito apagava material do outro lado).
const CHAVE_DEPOSITO_DSM = "dsm";

function chaveDeDeposito(zona) {
  // Sem id (projeto colado à mão, ou gravado antes da identidade estável) fica
  // o nome -- é o que havia antes e continua a servir.
  return zona.id || zona.nome || null;
}

function estaNoDeposito(chave) {
  return !!chave && Array.isArray(ajustes.noDeposito) && ajustes.noDeposito.includes(chave);
}

/** As zonas que estão mesmo na sala. */
function zonasMontadas(projetoAtual) {
  if (!projetoAtual || !Array.isArray(projetoAtual.zonas)) return [];
  return projetoAtual.zonas.filter(z => !estaNoDeposito(chaveDeDeposito(z)));
}

/**
 * O projeto tal como o 3D o vê: só o que foi montado. Devolve o mesmo objeto
 * quando não há nada no depósito, para não andar a criar cópias à toa no
 * caminho quente (montar() corre a cada tecla mexida).
 */
/** A altura do que está mesmo na sala, para a câmara enquadrar o que se vê. */
function alturaDoQueEstaNaSala() {
  const naSala = projetoMontado(projeto);
  return (naSala && naSala.zonas.length) ? totais(naSala).altura : 4;
}

function projetoMontado(projetoAtual) {
  if (!projetoAtual) return null;
  const zonas = zonasMontadas(projetoAtual);
  const dsmNoDeposito = estaNoDeposito(CHAVE_DEPOSITO_DSM);
  if (zonas.length === projetoAtual.zonas.length && !dsmNoDeposito) return projetoAtual;
  return { ...projetoAtual, zonas, dsm: dsmNoDeposito ? null : projetoAtual.dsm };
}

/**
 * Uma peça só vai para o depósito se for NOVA -- e "nova" quer dizer um id que
 * nunca passou por aqui, lido do ajustes.nomePorId que a identidade estável já
 * mantém. Tem de correr ANTES de reconciliarAjustesPorId(), que é quem escreve
 * nesse mapa; daí as duas viverem dentro de receberProjeto().
 *
 * Na primeira vez que a app corre com esta versão, um projeto já existente
 * ficaria todo por montar e a sala aparecia vazia -- um susto que parece um
 * bug. Por isso a primeira passagem marca tudo o que lá está como montado e
 * liga a bandeira; o depósito só começa a receber a partir daí.
 */
function receberProjeto(projetoAtual) {
  if (!projetoAtual || !Array.isArray(projetoAtual.zonas)) return;
  // A porta por onde TODO o projeto que chega passa (arranque, "Carregar",
  // sincronização) -- por isso é aqui que se conta o que ele é, e não em três
  // sítios que um dia discordariam. Um link de só ver nunca chega a contar:
  // ver soVisualizacao() em uso.js.
  usoDoProjeto(projetoAtual);
  if (!Array.isArray(ajustes.noDeposito)) ajustes.noDeposito = [];
  const conhecidos = (ajustes.nomePorId && typeof ajustes.nomePorId === "object") ? ajustes.nomePorId : {};
  const primeiraVez = !ajustes.depositoIniciado;
  let mudou = false;

  if (primeiraVez) {
    ajustes.depositoIniciado = true;
    mudou = true;
  } else if (!depositoLigado()) {
    // Depósito desligado: o material novo entra logo na sala. Quem já lá
    // estava à espera fica à espera -- desligar não é o mesmo que montar, e
    // montar peças sem ninguém pedir era mexer na sala pelas costas de quem
    // as pôs de lado. O aviso e o contador continuam a dizer que lá estão.
  } else {
    for (const zona of projetoAtual.zonas) {
      const chave = chaveDeDeposito(zona);
      // Só entra no depósito quem nunca cá esteve. Uma zona já conhecida que
      // volte a chegar (outro sync, outro nome) fica onde estava.
      if (!chave || !zona.id || conhecidos[zona.id] || estaNoDeposito(chave)) continue;
      ajustes.noDeposito.push(chave);
      mudou = true;
    }
  }

  if (mudou) guardarAjustes(ajustes);
  reconciliarAjustesPorId(projetoAtual);
}

function reconciliarAjustesPorId(projetoAtual) {
  if (!projetoAtual || !Array.isArray(projetoAtual.zonas)) return;
  if (!ajustes.nomePorId || typeof ajustes.nomePorId !== "object") ajustes.nomePorId = {};
  let mudou = false;
  for (const zona of projetoAtual.zonas) {
    if (!zona.id || !zona.nome) continue;
    const anterior = ajustes.nomePorId[zona.id];
    if (anterior && anterior !== zona.nome) {
      // Só se move para um nome livre: se já existe ajuste com o nome novo,
      // é de outra zona qualquer e não se lhe toca.
      if (ajustes.delays[anterior] && !ajustes.delays[zona.nome]) {
        ajustes.delays[zona.nome] = ajustes.delays[anterior];
        delete ajustes.delays[anterior];
        mudou = true;
      }
      const i = ajustes.zonasSemLeitura.indexOf(anterior);
      if (i !== -1 && !ajustes.zonasSemLeitura.includes(zona.nome)) {
        ajustes.zonasSemLeitura[i] = zona.nome;
        mudou = true;
      }
    }
    if (anterior !== zona.nome) { ajustes.nomePorId[zona.id] = zona.nome; mudou = true; }
  }
  if (mudou) guardarAjustes(ajustes);
}

function carregar(bruto, recentrar = true) {
  try {
    projeto = lerProjeto(bruto);
    receberProjeto(projeto);
    $("aviso").classList.remove("mostra");
    if (projeto.sala) {
      if (projeto.sala.largura) $("salaL").value = projeto.sala.largura;
      if (projeto.sala.profundidade) $("salaP").value = projeto.sala.profundidade;
      if (projeto.sala.altura) $("salaA").value = projeto.sala.altura;
    }
    montar(recentrar);
    if (projeto.recusadas && projeto.recusadas.length) {
      const aviso = $("aviso");
      aviso.textContent = "Ficaram de fora, por virem sem medidas: " +
                          projeto.recusadas.join(", ") + ".";
      aviso.classList.add("mostra");
    }
  } catch (e) {
    const aviso = $("aviso");
    // Um pedido escrito em palavras não é um erro de quem o escreveu: é o
    // botão errado. O que lê palavras é a IA, e está ali por baixo — dizê-lo,
    // e acender o botão, vale mais do que repetir a sintaxe que ele não usou.
    const palavras = String(bruto || "").trim().split(/\s+/).length;
    if (e.emPalavras && palavras >= 4) {
      aviso.innerHTML = "Isto é um <b>pedido escrito</b>, não medidas — e o que lê pedidos " +
                        "é a IA. Carrega em <b>Analisar com a IA</b>, aqui em baixo.";
      const botao = $("btAnalisar");
      botao.classList.add("apontado");
      botao.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => botao.classList.remove("apontado"), 4000);
    } else {
      aviso.textContent = e.message;
    }
    aviso.classList.add("mostra");
  }
}

document.querySelectorAll("[data-formato]").forEach(b => {
  b.onclick = () => {
    formatoImagem = parseFloat(b.dataset.formato);
    document.querySelectorAll("[data-formato]").forEach(o => o.classList.remove("destaque"));
    b.classList.add("destaque");
    montar(false);
  };
});
document.querySelector("[data-formato='1.777']").classList.add("destaque");

document.querySelectorAll("[data-conteudo]").forEach(b => {
  b.onclick = () => {
    modoConteudo = b.dataset.conteudo;
    document.querySelectorAll("[data-conteudo]").forEach(o => o.classList.remove("destaque"));
    b.classList.add("destaque");
    $("notaConteudo").textContent = modoConteudo === "cada"
      ? "Uma em cada: a imagem inteira repetida em cada zona, para quando os ecrãs mostram conteúdos independentes."
      : "Espalhada: uma imagem só pelo conjunto todo, cada zona mostra o seu bocado — como o media server faz.";
    montar(false);
  };
});

$("btPlanta").onclick = () => $("ficheiroPlanta").click();
$("btSemPlanta").onclick = () => {
  planta = null; plantaDataURL = null; plantaCad = null;
  camadasEscondidas.clear(); camadasLevantadas.clear();
  camposDaPlanta();
  montar(false);
};

/**
 * A planta em imagem e a planta em DXF pedem coisas diferentes, e mostrar as
 * duas ao mesmo tempo confunde: a imagem precisa que lhe digam a largura, o
 * DXF precisa que se confirmem as unidades. Uma de cada vez.
 */
function camposDaPlanta() {
  $("campoLargura").hidden = !!plantaCad;
  $("campoUnidades").hidden = !plantaCad;
  desenharCamadas();
  if (plantaCad) {
    const u = metrosPorUnidade(plantaCad, $("plantaU").value);
    const larguraM = plantaCad.largura * u.fator, fundoM = plantaCad.profundidade * u.fator;
    $("infoPlanta").innerHTML =
      `<b>${larguraM.toFixed(2)} × ${fundoM.toFixed(2)} m</b> · ` +
      `${plantaCad.segmentos.toLocaleString("pt-PT")} segmentos · escala ${u.comoSoube}` +
      (plantaCad.cortado ? " · <b>desenho cortado</b>, era grande de mais" : "");
    $("notaPlanta").innerHTML = u.comoSoube.startsWith("adivinhado")
      ? "O ficheiro não disse em que unidades foi desenhado, por isso a escala foi " +
        "<b>adivinhada pelo tamanho</b>. Se a sala aparecer com o tamanho errado, é " +
        "aqui que se corrige."
      : "O DXF entra à escala: as unidades vieram do próprio ficheiro. O que sobra " +
        "para mexer é só onde ele fica, porque o zero do CAD raramente é o meio da sala.";
    // Se o desenho trouxe um alçado, ele entrou desligado — e isso diz-se.
    const alcadas = (plantaCad.camadas || [])
      .filter((c) => /^AL[CÇ]ADO[-_ ]/i.test(String(c.nome)) && camadasEscondidas.has(c.indice));
    if (alcadas.length) {
      $("notaPlanta").innerHTML += " Este desenho traz um <b>alçado</b>, e ele entrou " +
        "<b>desligado</b>: um alçado é um desenho de pé, e deitado no chão não é planta " +
        "de nada. Está na lista das camadas, para ligar se quiseres vê-lo.";
    }
  } else {
    $("infoPlanta").innerHTML = "<b>DXF</b>, <b>DWG</b>, <b>PDF</b> ou imagem. O DXF e o " +
      "DWG entram à escala e não se calibram; o PDF e a imagem pedem a largura real.";
    $("notaPlanta").innerHTML = "Um PDF e uma imagem não sabem a escala a que foram " +
      "desenhados. Diz-lhes a <b>largura real</b> que cobrem e o resto sai daí — a grelha " +
      "do chão é de metro a metro, use-a para conferir. Um <b>DWG</b> ou um <b>DXF</b> " +
      "sabem, e entram sozinhos com o tamanho certo. " +
      "O ficheiro do <b>Vectorworks</b> (.vwx) não entra: lá dentro, " +
      "Ficheiro → Exportar → Exportar DXF/DWG, e é esse DXF que vem para aqui.";
  }
}

$("plantaU").addEventListener("change", () => { camposDaPlanta(); montar(false); });

/**
 * A lista de camadas.
 *
 * Uma planta de arquitectura traz tudo na mesma folha: paredes, cadeiras,
 * tracejados, cotas, texto. Deitada no chão aquilo é um tapete onde não se
 * percebe o que é parede — e levantar tudo seria pior ainda, um bosque de
 * panos verticais. As camadas já vinham no ficheiro; faltava dar-lhes um
 * interruptor.
 *
 * Ordenadas pela que tem mais linhas: numa planta, a camada com mais desenho é
 * quase sempre a que se quer ver primeiro.
 */
function desenharCamadas() {
  const bloco = $("blocoCamadas");
  const lista = $("listaCamadas");
  bloco.hidden = !(plantaCad && plantaCad.camadas && plantaCad.camadas.length);
  if (bloco.hidden) return;

  lista.innerHTML = "";
  const ordenadas = plantaCad.camadas.slice().sort((a, b) => b.segmentos - a.segmentos);
  for (const camada of ordenadas) {
    const linha = document.createElement("div");
    linha.className = "camada" + (camadasEscondidas.has(camada.indice) ? " apagada" : "");

    const ver = document.createElement("input");
    ver.type = "checkbox";
    ver.checked = !camadasEscondidas.has(camada.indice);
    ver.title = "Ver esta camada";
    ver.onchange = () => {
      if (ver.checked) camadasEscondidas.delete(camada.indice);
      else camadasEscondidas.add(camada.indice);
      linha.classList.toggle("apagada", !ver.checked);
      montar(false);
    };

    const levantar = document.createElement("input");
    levantar.type = "checkbox";
    levantar.checked = camadasLevantadas.has(camada.indice);
    levantar.title = "Levantar esta camada, como paredes";
    levantar.onchange = () => {
      if (levantar.checked) camadasLevantadas.add(camada.indice);
      else camadasLevantadas.delete(camada.indice);
      montar(false);
    };

    const nome = document.createElement("span");
    nome.className = "nome";
    nome.textContent = camada.nome;
    nome.title = camada.nome;
    const quantos = document.createElement("span");
    quantos.className = "quantos";
    quantos.textContent = camada.segmentos.toLocaleString("pt-PT");

    linha.append(nome, quantos, ver, levantar);
    lista.append(linha);
  }
}

/**
 * A sala fica do tamanho do que está desenhado.
 *
 * Uma planta importada aparece do tamanho que tem — e uma planta de um centro
 * de congressos ao lado de uma sala de 24 × 18 m por omissão parece uma escala
 * errada, quando o que está errado são as medidas da sala. Isto mede o que se
 * está a VER (as camadas escondidas não contam, porque quem as escondeu já
 * disse que não fazem parte) e escreve-o nos campos.
 */
function medidasDaPlanta() {
  if (!plantaCad) return;
  const f = metrosPorUnidade(plantaCad, $("plantaU").value).fator;
  const p = plantaCad.pontos, dq = plantaCad.deQuemE;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, contados = 0;
  for (let i = 0, s = 0; i < p.length; i += 4, s++) {
    if (dq && camadasEscondidas.has(dq[s])) continue;
    contados++;
    if (p[i] < minX) minX = p[i];       if (p[i] > maxX) maxX = p[i];
    if (p[i + 2] < minX) minX = p[i + 2]; if (p[i + 2] > maxX) maxX = p[i + 2];
    if (p[i + 1] < minY) minY = p[i + 1]; if (p[i + 1] > maxY) maxY = p[i + 1];
    if (p[i + 3] < minY) minY = p[i + 3]; if (p[i + 3] > maxY) maxY = p[i + 3];
  }
  if (!contados) return;

  const largura = (maxX - minX) * f, fundo = (maxY - minY) * f;
  $("salaL").value = Math.max(2, Math.round(largura * 10) / 10);
  $("salaP").value = Math.max(2, Math.round(fundo * 10) / 10);
  // A planta fica centrada na sala, que é onde ela estava a ser desenhada.
  $("plantaX").value = 0;
  $("plantaZ").value = 0;
  montar(true);
  $("aviso").textContent =
    `Sala posta a ${largura.toFixed(2)} × ${fundo.toFixed(2)} m, ` +
    `pelo que está visível na planta.`;
  $("aviso").classList.add("mostra");
  setTimeout(() => $("aviso").classList.remove("mostra"), 3600);
}

$("btMedidasDaPlanta").onclick = medidasDaPlanta;
$("alturaParedes").addEventListener("input", () => remontarDaqui());

// --------------------------------------------- a planta, dentro do ficheiro
//
// Reportado assim: *"o guardar não está a levar a planta da sala"*. E não
// levava mesmo: o estadoCompleto() gravava a sala, o palco, a plateia, os
// ecrãs e até as imagens que vão nos ecrãs -- tudo menos o desenho que está
// por baixo de tudo isso. Reabrir um projeto obrigava a ir buscar o DXF outra
// vez, a confirmar as unidades outra vez e a pô-lo no sítio outra vez.
//
// Viajam duas coisas diferentes, e faltavam as duas:
//
//   1. O DESENHO em si.
//   2. ONDE ELE FICA -- rodar, deslocar, opacidade, as unidades, e que camadas
//      estão escondidas ou levantadas. Sem isto o desenho voltava mas fora do
//      sítio, que dá quase o mesmo trabalho que tê-lo perdido.
//
// POR QUE RAZÃO O CAD VAI EM BASE64 E NÃO EM NÚMEROS. Um segmento são quatro
// números e uma planta de arquitectura traz dezenas de milhares deles. Escrito
// em JSON, cada número gasta uma dúzia de caracteres ("-12345.678901234,") e o
// ficheiro passava a dezenas de MB. Em Float32Array são quatro bytes, e em
// base64 cinco e um terço. O Float32 chega e sobra para ISTO: a diferença que
// ele introduz numa coordenada de planta é de centésimas de milímetro, e este
// é o desenho de fundo -- a cota que a engenharia mede sai pelo DXF de
// exportação (js/dxf-saida.js), que escreve os números da app com seis casas.
//
// E não se guarda o ficheiro original de propósito: um DWG teria de voltar a
// passar pelo motor e um PDF a ser desenhado outra vez, e ambos demoram. O que
// se guarda é o que a app já tem pronto a desenhar.

function paraBase64(dados) {
  const bytes = new Uint8Array(dados.buffer || dados);
  let texto = "";
  // Aos pedaços: um apply() com um milhão de argumentos estoira a pilha.
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    texto += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  }
  return btoa(texto);
}

function deBase64(texto, Tipo) {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Tipo(bytes.buffer, 0, Math.floor(bytes.length / Tipo.BYTES_PER_ELEMENT));
}

/** Uma textura a partir de um data URL já guardado. Nunca rejeita. */
function texturaDeDataURL(url) {
  return new Promise((ok) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      ok(t);
    }, undefined, () => ok(null));
  });
}

// O que ainda cabe num link. É generoso de propósito -- uma planta de sala
// normal fica muito abaixo disto, e quem passa daqui é quem abriu o desenho
// inteiro de um centro de congressos, que é justamente o que não se manda por
// link. Ver o botão "Link para ver".
const PLANTA_QUE_CABE_NO_LINK = 1_500_000;

/** O que há para guardar da planta, ou null se não houver planta nenhuma. */
function plantaGuardada() {
  const onde = {
    unidades: $("plantaU") ? $("plantaU").value : "auto",
    larguraReal: num("plantaL"), rodar: num("plantaR"),
    x: num("plantaX"), z: num("plantaZ"), opacidade: num("plantaO"),
    alturaParedes: num("alturaParedes"),
    escondidas: [...camadasEscondidas], levantadas: [...camadasLevantadas]
  };
  if (plantaCad) {
    return Object.assign(onde, {
      tipo: "cad",
      pontos: paraBase64(Float32Array.from(plantaCad.pontos)),
      deQuemE: paraBase64(Uint16Array.from(plantaCad.deQuemE || [])),
      camadas: plantaCad.camadas,
      minX: plantaCad.minX, maxX: plantaCad.maxX,
      minY: plantaCad.minY, maxY: plantaCad.maxY,
      larguraDesenho: plantaCad.largura, fundoDesenho: plantaCad.profundidade,
      insunits: plantaCad.insunits, blocos: plantaCad.blocos,
      cortado: !!plantaCad.cortado
    });
  }
  if (plantaDataURL) return Object.assign(onde, { tipo: "imagem", imagem: plantaDataURL });
  return null;
}

/** O caminho de volta. Nunca rejeita: uma planta estragada não trava o resto. */
async function reporPlanta(guardada) {
  planta = null; plantaCad = null; plantaDataURL = null;
  camadasEscondidas.clear(); camadasLevantadas.clear();
  if (!guardada || typeof guardada !== "object") { camposDaPlanta(); return; }

  preencherCampo("plantaL", guardada.larguraReal);
  preencherCampo("plantaR", guardada.rodar);
  preencherCampo("plantaX", guardada.x);
  preencherCampo("plantaZ", guardada.z);
  preencherCampo("plantaO", guardada.opacidade);
  preencherCampo("alturaParedes", guardada.alturaParedes);
  if ($("plantaU") && guardada.unidades) $("plantaU").value = guardada.unidades;
  (Array.isArray(guardada.escondidas) ? guardada.escondidas : []).forEach(i => camadasEscondidas.add(i));
  (Array.isArray(guardada.levantadas) ? guardada.levantadas : []).forEach(i => camadasLevantadas.add(i));

  try {
    if (guardada.tipo === "cad" && typeof guardada.pontos === "string") {
      const pontos = deBase64(guardada.pontos, Float32Array);
      plantaCad = {
        pontos,
        deQuemE: guardada.deQuemE ? deBase64(guardada.deQuemE, Uint16Array) : null,
        camadas: Array.isArray(guardada.camadas) ? guardada.camadas : [],
        segmentos: Math.floor(pontos.length / 4),
        minX: guardada.minX, maxX: guardada.maxX,
        minY: guardada.minY, maxY: guardada.maxY,
        largura: guardada.larguraDesenho, profundidade: guardada.fundoDesenho,
        insunits: guardada.insunits, blocos: guardada.blocos,
        cortado: !!guardada.cortado
      };
    } else if (guardada.tipo === "imagem" && typeof guardada.imagem === "string") {
      const t = await texturaDeDataURL(guardada.imagem);
      if (t) { planta = t; plantaDataURL = guardada.imagem; }
    }
  } catch (_) { plantaCad = null; planta = null; plantaDataURL = null; }
  camposDaPlanta();
}

/**
 * Um DWG disfarçado, ou um DWG assumido.
 *
 * O DWG é formato fechado da Autodesk, e binário: começa sempre por "AC10" e
 * dois dígitos da versão. Olha-se para os primeiros bytes e não só para o nome,
 * porque um DWG a que alguém mudou a extensão para .dxf entrava aqui e saía
 * com "isto não parece um DXF" — que manda a pessoa procurar um defeito onde
 * não há nenhum.
 */
async function eDWG(ficheiro) {
  if (/\.dwg$/i.test(ficheiro.name)) return true;
  try {
    const inicio = new Uint8Array(await ficheiro.slice(0, 6).arrayBuffer());
    return /^AC10\d\d$/.test(String.fromCharCode.apply(null, inicio));
  } catch (_) {
    return false;
  }
}

/**
 * O FICHEIRO DO CAD NÃO É O DESENHO.
 *
 * Reportado assim: *"como abro um ficheiro do vector no 3D, ele não importa"*.
 * Um `.vwx` é o ficheiro de trabalho do Vectorworks -- o projeto inteiro, no
 * formato fechado dele -- e só o Vectorworks o abre. O mesmo para o `.skp` do
 * SketchUp, o `.rvt` do Revit e os outros aqui em baixo. O que atravessa para
 * fora de qualquer um deles é o que se EXPORTA: DXF, DWG ou PDF.
 *
 * Antes disto havia duas maneiras de não se perceber isso. O ficheiro nem
 * aparecia acendido no seletor (o `accept` não o listava), e quem lá chegasse à
 * força ouvia *"isto não parece um DXF"* -- que manda procurar um defeito no
 * ficheiro, quando o ficheiro está bom e só não é para aqui. Agora escolhe-se,
 * e a app diz o que ele é e onde ir buscar o que serve.
 *
 * O caminho do menu só vai escrito para o Vectorworks, que é o que se usa cá.
 * Para os outros diz-se o que é preciso (exportar em DXF ou DWG) sem inventar
 * por onde -- um caminho de menu errado faz perder mais tempo do que nenhum.
 */
const FORMATOS_FECHADOS = [
  { ext: ".vwx", programa: "Vectorworks",
    onde: "Ficheiro → Exportar → Exportar DXF/DWG, com a vista em planta" },
  { ext: ".vwxp", programa: "Vectorworks",
    onde: "Ficheiro → Exportar → Exportar DXF/DWG, com a vista em planta" },
  { ext: ".skp", programa: "SketchUp" },
  { ext: ".rvt", programa: "Revit" },
  { ext: ".rfa", programa: "Revit" },
  { ext: ".pln", programa: "Archicad" },
  { ext: ".pla", programa: "Archicad" },
  { ext: ".3dm", programa: "Rhino" },
  { ext: ".dgn", programa: "MicroStation" }
];

function recadoDeFormatoFechado(nome) {
  const achado = FORMATOS_FECHADOS.find((f) => String(nome).toLowerCase().endsWith(f.ext));
  if (!achado) return null;
  return `Um ${achado.ext} é o ficheiro de trabalho do ${achado.programa}, e só ele o abre. ` +
    `Aqui entram DXF, DWG, PDF ou imagem — ` +
    (achado.onde ? `no ${achado.programa}: ${achado.onde}.`
                 : `exporta o desenho em DXF ou DWG e traz esse.`);
}

/** O que se está a fazer, enquanto se faz — carregar 10 MB demora. */
function aTrabalhar(texto) {
  const aviso = $("aviso");
  aviso.textContent = texto;
  aviso.classList.add("mostra");
}

/**
 * O ALÇADO ENTRA DESLIGADO.
 *
 * A planta que esta app exporta leva um alçado frontal por baixo (ver
 * plantaEmDXF). Trazer esse mesmo ficheiro de volta para cá punha o alçado
 * deitado no chão, à frente da plateia, como um segundo palco ao contrário --
 * foi o que deu o *"abre invertido?"*.
 *
 * Um alçado é um desenho de pé: deitado no chão não é planta de nada, em
 * ficheiro nenhum. Por isso chega desligado -- mas desligado À VISTA, na lista
 * das camadas, com o interruptor ao lado para quem o quiser ver. Escondê-lo
 * sem o dizer seria trocar um desenho estranho por um desenho incompleto, e o
 * segundo é pior: ninguém procura o que não sabe que existe.
 */
/**
 * OS FICHEIROS QUE JÁ FORAM EXPORTADOS ANTES DISTO.
 *
 * A partir da v3.73 o alçado sai em camadas próprias e reconhece-se pelo nome.
 * Mas os DXF exportados ANTES -- os que já estão na pasta de descargas e já
 * foram para a engenharia -- levam o alçado nas MESMAS camadas da planta, e
 * nesses não há nome nenhum por onde o apanhar. Reabrir um desses continuava a
 * dar o mesmo: o alçado deitado no chão à frente da plateia, e o desenho fora
 * do sítio. Dizer "exporta outra vez" resolve para mim e não resolve para o
 * ficheiro que já foi enviado.
 *
 * Como se apanha sem adivinhar:
 *
 *   1. o desenho tem de ser NOSSO -- o ficheiro traz escrito "ALÇADO FRONTAL",
 *      que é o título que esta app escreve e mais ninguém;
 *   2. e o alçado vive todo por baixo da planta, separado por uma faixa vazia
 *      de 4 m (ver chaoDoAlcado em plantaEmDXF). Procura-se o maior vão vazio
 *      em Y e corta-se aí.
 *
 * Os segmentos de baixo passam para uma camada à parte, que aparece na lista
 * como qualquer outra -- e daí para a frente é o caminho normal: entra
 * desligada, com o interruptor à vista de quem a quiser ver.
 */
function separarAlcadoDeUmDesenhoAntigo(desenho, textoBruto) {
  if (!desenho || !desenho.pontos || !desenho.camadas) return 0;
  if (!/AL[ÇC]ADO FRONTAL/i.test(String(textoBruto || ""))) return 0;
  if (desenho.camadas.some((c) => /^AL[CÇ]ADO[-_ ]/i.test(String(c.nome)))) return 0;

  // O Y de cada segmento, para procurar a faixa vazia.
  const alturas = [];
  for (let i = 0, s = 0; i < desenho.pontos.length; i += 4, s++) {
    alturas.push({ y: Math.max(desenho.pontos[i + 1], desenho.pontos[i + 3]), s });
  }
  alturas.sort((a, b) => a.y - b.y);
  let corte = null, maior = 0;
  for (let k = 1; k < alturas.length; k++) {
    const vao = alturas[k].y - alturas[k - 1].y;
    if (vao > maior) { maior = vao; corte = (alturas[k].y + alturas[k - 1].y) / 2; }
  }
  // Em unidades do desenho: 3 m no ficheiro, seja ele em metros ou milímetros.
  const emMetros = 3 / (metrosPorUnidade(desenho, $("plantaU") ? $("plantaU").value : "auto").fator || 1);
  if (corte === null || maior < emMetros) return 0;

  const indice = desenho.camadas.length;
  let quantos = 0;
  const novo = Uint16Array.from(desenho.deQuemE || []);
  for (let i = 0, s = 0; i < desenho.pontos.length; i += 4, s++) {
    if (Math.max(desenho.pontos[i + 1], desenho.pontos[i + 3]) < corte) {
      novo[s] = indice; quantos++;
    }
  }
  if (!quantos) return 0;
  desenho.deQuemE = novo;
  desenho.camadas = desenho.camadas.concat([
    { nome: "ALÇADO (desenho antigo)", segmentos: quantos, indice }
  ]);
  // As contagens das outras camadas deixaram de bater certo -- refazem-se, que
  // é por elas que a lista se ordena.
  const contagem = new Array(desenho.camadas.length).fill(0);
  for (const i of desenho.deQuemE) contagem[i]++;
  desenho.camadas.forEach((c) => { c.segmentos = contagem[c.indice]; });
  return quantos;
}

function esconderOAlcadoQueVierNoDesenho() {
  if (!plantaCad || !Array.isArray(plantaCad.camadas)) return 0;
  let quantas = 0;
  plantaCad.camadas.forEach((c) => {
    if (/^AL[CÇ]ADO[-_ ]/i.test(String(c.nome))) { camadasEscondidas.add(c.indice); quantas++; }
  });
  return quantas;
}

$("ficheiroPlanta").onchange = async () => {
  const ficheiro = $("ficheiroPlanta").files[0];
  $("ficheiroPlanta").value = "";
  if (!ficheiro) return;
  try {
    // Antes de mexer no que está montado: um ficheiro que não é para aqui não
    // pode deixar a planta que lá estava apagada a caminho do recado.
    const recado = recadoDeFormatoFechado(ficheiro.name);
    if (recado) throw new Error(recado);
    camadasEscondidas.clear();
    camadasLevantadas.clear();
    if (await eDWG(ficheiro)) {
      // O DWG passa pelo motor e sai DXF; daí para a frente é tudo igual.
      plantaCad = await lerDWG(ficheiro, aTrabalhar);
      planta = null; plantaDataURL = null;
      $("aviso").classList.remove("mostra");
    } else if (/\.dxf$/i.test(ficheiro.name)) {
      // Um DXF de uma planta grande são dezenas de MB de texto: lê-se de uma
      // vez e depois já não se lhe toca mais.
      const texto = await ficheiro.text();
      plantaCad = lerDXF(texto);
      // Um DXF desta app exportado ANTES da v3.73 traz o alçado misturado com
      // a planta. Ver separarAlcadoDeUmDesenhoAntigo().
      separarAlcadoDeUmDesenhoAntigo(plantaCad, texto);
      planta = null; plantaDataURL = null;
    } else if (/\.pdf$/i.test(ficheiro.name) || ficheiro.type === "application/pdf") {
      const pdf = await lerPDF(ficheiro, aTrabalhar);
      planta = pdf.textura;
      // A página desenhada é uma tela: o PNG dela é o que fica guardado, para
      // não ter de se voltar a passar o PDF pelo motor ao reabrir o projeto.
      try { plantaDataURL = pdf.textura.image.toDataURL("image/png"); }
      catch (_) { plantaDataURL = null; }
      plantaCad = null;
      $("aviso").classList.remove("mostra");
      if (pdf.paginas > 1) {
        aTrabalhar(`O PDF tem ${pdf.paginas} páginas — está a usar a primeira.`);
        setTimeout(() => $("aviso").classList.remove("mostra"), 4000);
      }
    } else {
      // Lê-se o ficheiro UMA vez, para data URL, e é dele que sai a textura:
      // assim o que se desenha e o que se guarda são a mesma coisa.
      plantaDataURL = await dataURLDeFicheiro(ficheiro);
      planta = await texturaDeDataURL(plantaDataURL);
      if (!planta) {
        plantaDataURL = null;
        throw new Error("Isso não é uma imagem que eu saiba abrir.");
      }
      plantaCad = null;
    }
    esconderOAlcadoQueVierNoDesenho();
    camposDaPlanta();
    montar(false);
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
};

function mostrarLogoProprioExtra(mostrar) {
  $("logoProprioExtra").style.display = mostrar ? "" : "none";
}

$("btPadrao").onclick = async () => {
  textura = await padraoDeTeste(); texturaDataURL = null;
  mostrarLogoProprioExtra(false); montar(false);
};
$("btSemConteudo").onclick = () => {
  textura = null; texturaDataURL = null;
  mostrarLogoProprioExtra(false); montar(false);
};
$("btImagem").onclick = () => $("ficheiroImagem").click();
$("ficheiroImagem").onchange = async () => {
  const ficheiro = $("ficheiroImagem").files[0];
  $("ficheiroImagem").value = "";
  if (!ficheiro) return;
  try {
    const { textura: t, dataURL: url } = await conteudoDeFicheiro(ficheiro);
    textura = t;
    texturaDataURL = url;
    mostrarLogoProprioExtra(false);
    montar(false);
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
};

/**
 * "Meu logo": pedido direto -- ter o logotipo da AVK pronto como conteúdo
 * geral dos ecrãs, com um "procurar" à parte para o trocar pelo logo de um
 * cliente, mas voltando sempre à base (o logo próprio) sempre que se activa
 * de novo -- clicar aqui outra vez larga o que estiver lá (mesmo já trocado
 * por um logo de cliente) e volta ao logo da AVK.
 *
 * Ao contrário da marca do "Exemplo" (aplicarConteudoDeExemplo, que fica de
 * fora do "Guardar projeto" de propósito -- é só demonstração, regenera-se
 * sozinha ao clicar "Exemplo"), este converte-se logo num data URL a sério,
 * tal como uma imagem escolhida à mão: viaja no "Guardar projeto" e no link
 * como qualquer outra. É o único conteúdo que chega ao DSM e aos delays sem
 * imagem própria por ecrã -- sem um data URL a sério, ficavam sem nada ao
 * reabrir o projeto ou ao abrir o link (o mesmo problema que já tinha sido
 * corrigido para as imagens escolhidas à mão).
 */
async function aplicarLogoProprio() {
  const t = await texturaDaMarca(true);
  textura = t;
  texturaDataURL = t.image.toDataURL("image/png");
  mostrarLogoProprioExtra(true);
  montar(false);
}
$("btLogoProprio").onclick = aplicarLogoProprio;

$("btLogoCliente").onclick = () => $("ficheiroLogoCliente").click();
$("ficheiroLogoCliente").onchange = async () => {
  const ficheiro = $("ficheiroLogoCliente").files[0];
  $("ficheiroLogoCliente").value = "";
  if (!ficheiro) return;
  try {
    const { textura: t, dataURL: url } = await conteudoDeFicheiro(ficheiro);
    textura = t;
    texturaDataURL = url;
    montar(false);
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
};

/**
 * Folha em branco.
 *
 * A app guarda coisas de propósito — o projeto que os Calculadores deixaram, a
 * sala, o projetor — e é isso que faz o "abrir e continuar de onde ia". Mas
 * quando o que se quer é a sala a seguir, essa memória passa a estorvo: fica-se
 * a apagar campo a campo e a descobrir uma planta antiga por baixo do desenho
 * novo.
 *
 * Os valores voltam ao que está escrito no HTML (o `defaultValue` de cada
 * campo) em vez de a uma lista repetida aqui — uma segunda lista ficava
 * desactualizada no dia em que se mexesse num valor por omissão.
 *
 * O que NÃO se limpa é como o painel está arrumado: as secções abertas e o
 * painel escondido são a maneira de trabalhar de quem está a usar isto, não
 * são o projeto.
 */
function limparTudo() {
  projeto = null;
  marcarGuardado();
  planta = null;
  plantaDataURL = null;
  plantaCad = null;
  camadasEscondidas.clear();
  camadasLevantadas.clear();
  textura = null;
  texturaDataURL = null;
  texturasPorZona = {};
  texturasPorZonaDataURL = {};
  mostrarLogoProprioExtra(false);
  ondeEsta = null;
  ondeEstaNaDome = null;
  limitesDoShift = null;
  projecaoAtual = null;
  modoConteudo = "espalhado";
  formatoImagem = 1.777;
  // Os arrastos (gomos/DSM/delays) ficavam de fora daqui -- "Limpar tudo"
  // repunha os campos mas um projeto novo herdava arrastos do anterior.
  // Reportado como a plateia a sair "errada" depois de limpar (a causa real
  // não era a conta da primeira fila, era isto).
  // O interruptor do depósito é feitio de trabalhar, não conteúdo do projeto:
  // sobrevive ao "Limpar tudo", como sobrevive a abrir um ficheiro.
  ajustes = { delays: {}, dsm: [], gomos: [], palcosExtra: [], regiesExtra: [], passarelasExtra: [], projetoresExtra: [], zonasSemLeitura: [], fatiasEscondidas: [], nomePorId: {}, noDeposito: [], depositoIniciado: true, depositoLigado: depositoLigado(), projetor: null, curvaDoBlend: null, retroDoBlend: false };

  document.querySelectorAll("#painel input").forEach(campo => {
    if (campo.type === "checkbox") campo.checked = campo.defaultChecked;
    else if (campo.type !== "file") campo.value = campo.defaultValue;
  });
  $("colagem").value = "";
  prontoParaCarregar();
  $("plantaU").value = "auto";

  // A memória partilhada com os Calculadores vai também: senão o projeto
  // voltava sozinho no arranque seguinte, e "limpar" passava a durar até ao
  // próximo F5.
  for (const chave of [CHAVE_PROJETO, CHAVE_PROJETOR, CHAVE_DEVOLUCAO, CHAVE_AJUSTES]) {
    try { localStorage.removeItem(chave); } catch (_) {}
  }
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);

  document.querySelectorAll("[data-formato]").forEach(b => {
    b.classList.toggle("destaque", b.dataset.formato === "1.777");
  });
  document.querySelectorAll("[data-conteudo]").forEach(b => {
    b.classList.toggle("destaque", b.dataset.conteudo === "espalhado");
  });
  escolherSaida("png");
  camposDaPlanta();
  marcarTipoDePlateia();

  $("notaEcra").textContent = "Muda o tamanho aqui para ver como fica, e devolve-o aos " +
                              "Calculadores para eles escolherem os tiles.";
  $("notaProj").innerHTML = "O rácio e a distância podem vir feitos: nos Calculadores, na " +
                            "aba <b>Distância de Projeção</b>, carrega em <b>Ver no Preview 3D</b>.";
  $("notaConteudo").textContent = "Espalhada: uma imagem só pelo conjunto todo, cada zona " +
                                  "mostra o seu bocado — como o media server faz.";
  $("btTrazerProjetor").textContent = "Trazer projetor dos Calculadores";

  montar(true);
}

// -------------------------------------------------------------------- guardar/abrir projeto todo

// Ao contrário do "Trazer projeto dos Calculadores" (só zonas e DSM), isto
// grava tudo o que está neste aparelho -- sala, palco, público, régie,
// projeção e os ajustes de posição -- num único ficheiro. É o que dá jeito
// numa obra sem rede: fecha-se aqui, leva-se o ficheiro, reabre-se noutro
// computador e a sala está exactamente como se deixou, sem depender do
// localStorage nem dos Calculadores estarem por perto.
/**
 * O que estava ligado por omissão ANTES de a app passar a nascer vazia
 * (v3.32). Serve só para reabrir ficheiros gravados nessa altura — ver
 * abrirProjetoTodo(). Não é a omissão de hoje, é a omissão de então, e por
 * isso não se toca nela quando as omissões mudarem outra vez.
 */
const LIGADO_ANTES = {
  verEcras: true, verPlanta: true, verMedidas: true, verPublico: true,
  verRegie: true, verPalco: true, verOrador: true, verParedes: true
};

function estadoCompleto() {
  return {
    v: 1,
    tipo: "preview-projeto",
    quando: new Date().toISOString(),
    // A versão de quem gravou este ficheiro/link -- mesma ideia do
    // origemVersao do projeto (ver projeto.js), mas aqui é sempre a versão
    // do Preview, porque quem grava um "preview-projeto" é sempre o
    // Preview. Ajuda a perceber, ao abrir um ficheiro antigo, se ele é de
    // antes de uma correção.
    versaoPreview: $("versao") ? $("versao").textContent.trim() : null,
    sala: lerSala(),
    palco: lerPalco(),
    passarela: lerPassarela(),
    publico: lerPublico(),
    regie: lerRegie(),
    projecao: lerProjecao(),
    // Onde o ecrã curvo ficou na sala. Vai no ficheiro como tudo o resto: um
    // projeto reaberto tem de encontrar o ciclorama no sítio onde se deixou.
    curvaPosicao: { dx: num("curvaDx"), dz: num("curvaDz"), base: num("curvaBase"),
                    leva: $("curvaLevaProjetores") ? $("curvaLevaProjetores").checked : true },
    projeto,
    ajustes,
    // A planta por baixo de tudo -- o desenho E onde ele ficou. Reportado
    // como *"o guardar não está a levar a planta da sala"*: ver
    // plantaGuardada(), que explica o que viaja e porquê.
    planta: plantaGuardada(),
    // As imagens que o mike põe nos ecrãs e nos DSM -- pedido direto: "não
    // vão as imagens quando abro noutro device". Vivem em memória como
    // THREE.Texture (texturasPorZona/textura), que não sobrevive a um
    // JSON.stringify -- é o data URL a par (texturasPorZonaDataURL/
    // texturaDataURL) que viaja aqui, e volta a virar textura em
    // abrirProjetoTodo(). O padrão de teste fica de fora de propósito: não é
    // um ficheiro do mike, regenera-se sozinho (padraoDeTeste()).
    conteudo: {
      textura: texturaDataURL,
      porZona: { ...texturasPorZonaDataURL }
    },
    visibilidade: {
      verEcras: $("verEcras").checked,
      verPlanta: $("verPlanta").checked,
      verMedidas: $("verMedidas").checked,
      verPublico: $("verPublico").checked,
      verRegie: $("verRegie").checked,
      verPalco: $("verPalco").checked,
      verOrador: $("verOrador").checked,
      verParedes: $("verParedes").checked,
      verCobertura: $("verCobertura").checked,
      // A cúpula e o modo dela também se guardam: um projeto de dome
      // reaberto tinha de voltar a ligar-se à mão.
      verDome: $("verDome") ? $("verDome").checked : true,
      domeSolido: $("domeSolido") ? $("domeSolido").checked : false,
      verFatias: $("verFatias") ? $("verFatias").checked : true,
      verPessoaDome: $("verPessoaDome") ? $("verPessoaDome").checked : true
    }
  };
}

function guardarProjetoTodo() {
  const estado = estadoCompleto();
  // Foi para ficheiro: deixou de haver o que perder ao fechar.
  marcarGuardado();
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  // O nome traz a extensão desta app (.pvw) -- ver js/ficheiros.js, que é o
  // mesmo ficheiro dos dois lados para os nomes nunca divergirem. Por dentro
  // continua a ser JSON, e o Blob mantém o tipo application/json.
  const base = (projeto && projeto.nome ? String(projeto.nome) : "projeto")
    .replace(/[^\p{L}\p{N}\- ]+/gu, "").trim() || "projeto";
  descarregar(blob, window.mikeappsFicheiros
    ? window.mikeappsFicheiros.nomeDoFicheiro("preview", base)
    : `${base}.preview.json`);
}

function preencherCampo(id, valor) {
  if (valor == null || Number.isNaN(valor)) return;
  $(id).value = valor;
}
function preencherCheckbox(id, valor) {
  if (valor == null) return;
  $(id).checked = !!valor;
}

async function abrirProjetoTodo(estado) {
  if (!estado || estado.tipo !== "preview-projeto") {
    // Recusar não chega: tem de dizer de ONDE é o ficheiro. Um ".cal" aberto
    // aqui por engano é o caso normal, não a excepção -- as duas apps andam
    // sempre juntas e os ficheiros vivem na mesma pasta de descargas.
    throw new Error(window.mikeappsFicheiros
      ? window.mikeappsFicheiros.recadoDeFicheiroErrado(estado, "preview")
      : "Este ficheiro não é um projeto do Preview.");
  }
  const s = estado.sala || {}, p = estado.palco || {}, pu = estado.publico || {},
        r = estado.regie || {}, pj = estado.projecao || {}, pa = estado.passarela || {};
  preencherCampo("salaL", s.largura); preencherCampo("salaP", s.profundidade); preencherCampo("salaA", s.altura);
  preencherCampo("palcoL", p.largura); preencherCampo("palcoA", p.altura);
  preencherCampo("palcoP", p.profundidade); preencherCampo("ecraOffset", p.acimaDoPalco);
  preencherCampo("palcoR", p.raio);
  // Onde o palco está. Um projeto guardado antes disto existir não traz nada
  // aqui, e preencherCampo ignora undefined -- fica no 0 de sempre, encostado
  // ao fundo, que é exactamente como ele foi guardado.
  preencherCampo("palcoX", p.dx); preencherCampo("palcoZ", p.dz);
  preencherCheckbox("passLigada", pa.ligada); preencherCampo("passL", pa.largura);
  preencherCampo("passC", pa.comprimento); preencherCampo("passX", pa.dx);
  preencherCampo("filas", pu.filas); preencherCampo("primeiraFila", pu.primeiraFila);
  preencherCampo("entreFilas", pu.entreFilas); preencherCampo("entreLugares", pu.entreLugares);
  preencherCampo("corredores", pu.corredores); preencherCampo("inclinacao", pu.inclinacao);
  preencherCampo("larguraCorredor", pu.larguraCorredor); preencherCheckbox("sentado", pu.sentado);
  // Os lugares por bloco e os corredores horizontais. As caixas por bloco são
  // criadas a partir do "corredores" que acabou de ser reposto -- por isso
  // desenham-se PRIMEIRO, senão havia menos caixas do que valores e o projeto
  // reabria com blocos por preencher (o mesmo defeito do formato/gomos que a
  // nota aqui em baixo conta).
  if (typeof desenharCaixasDeLugares === "function") desenharCaixasDeLugares();
  const caixasDeLugares = $("lugaresPorBloco");
  if (caixasDeLugares && Array.isArray(pu.lugaresPorBloco)) {
    [...caixasDeLugares.querySelectorAll("input")].forEach((el, b) => {
      const v = pu.lugaresPorBloco[b];
      el.value = (v && v > 0) ? v : "";
    });
  }
  // As excepções voltam escritas como se escrevem, e não em índices: o campo é
  // para se ler, e "1,3: A = 5" é o que lá estava.
  if ($("excecoesLugares")) {
    const linhas = Array.isArray(pu.excecoesDeLugares) ? pu.excecoesDeLugares : [];
    $("excecoesLugares").value = linhas.map((e) => {
      const blocos = (e.blocos || []).map((b) => b + 1).join(",");
      const filas = e.de === e.ate ? letraDaFila(e.de)
                                   : letraDaFila(e.de) + "-" + letraDaFila(e.ate);
      return blocos + ": " + filas + " = " + e.lugares;
    }).join("\n");
  }
  if ($("corredoresHorizontais") && Array.isArray(pu.corredoresHorizontais)) {
    $("corredoresHorizontais").value = pu.corredoresHorizontais.map(letraDaFila).join(", ");
  }
  // "formato" (Reto/Circular) e "gomos" (nº de gomos) nunca tinham sido
  // repostos aqui — um projeto guardado em Circular voltava sempre a abrir
  // em Reto, silenciosamente (reportado: "tudo o que é plateia não [volta],
  // ... se voltar ao reto está lá"). formatoPlateia é um <div> com o valor
  // no dataset, não um campo — não dá para usar preencherCampo/Checkbox.
  if (pu.formato) {
    $("formatoPlateia").dataset.valor = pu.formato;
    marcarFormatoPlateia();
  }
  preencherCampo("gomos", pu.gomos);
  preencherCampo("regieL", r.largura); preencherCampo("regieP", r.profundidade);
  preencherCampo("regieX", r.x); preencherCampo("regieZ", r.z); preencherCampo("regieR", r.rodar);
  preencherCheckbox("projLigada", pj.ligada); preencherCampo("projRacio", pj.racio);
  preencherCampo("projDist", pj.distancia); preencherCampo("projAltura", pj.altura);
  preencherCampo("projLateral", pj.lateral);
  preencherCampo("projShiftV", pj.shiftV != null ? pj.shiftV * 100 : null);
  preencherCampo("projShiftH", pj.shiftH != null ? pj.shiftH * 100 : null);
  const cp = estado.curvaPosicao || {};
  preencherCampo("curvaDx", cp.dx); preencherCampo("curvaDz", cp.dz); preencherCampo("curvaBase", cp.base);
  preencherCheckbox("curvaLevaProjetores", cp.leva !== false);
  esquecerBaseDoEcraAnterior();

  // A partir da v3.32 a app nasce VAZIA (sem palco, público, régie nem
  // orador). Um ficheiro guardado antes disso não diz que os tinha ligados --
  // tinha-os porque ERAM a omissão. Sem isto, reabria uma sala vazia e parecia
  // trabalho perdido.
  //
  // É a mesma armadilha do depositoIniciado, e a regra é a mesma: uma omissão
  // nova nunca se aplica a um ficheiro antigo. *"Apenas os guardados trazem
  // tudo no sítio."*
  // Não chega proteger o ficheiro SEM bloco nenhum: um ficheiro com o bloco
  // mas sem uma destas chaves (gravado antes de ela existir) caía na mesma
  // armadilha. Por isso o que falta preenche-se por baixo, e o que o ficheiro
  // diz manda sempre por cima -- um "false" gravado continua a ser false.
  const v = { ...LIGADO_ANTES, ...(estado.visibilidade || {}) };
  preencherCheckbox("verEcras", v.verEcras); preencherCheckbox("verPlanta", v.verPlanta);
  preencherCheckbox("verMedidas", v.verMedidas); preencherCheckbox("verPublico", v.verPublico);
  preencherCheckbox("verRegie", v.verRegie); preencherCheckbox("verPalco", v.verPalco);
  preencherCheckbox("verOrador", v.verOrador); preencherCheckbox("verParedes", v.verParedes);
  preencherCheckbox("verCobertura", v.verCobertura);
  preencherCheckbox("verDome", v.verDome); preencherCheckbox("domeSolido", v.domeSolido);
  preencherCheckbox("verFatias", v.verFatias);
  preencherCheckbox("verPessoaDome", v.verPessoaDome);

  projeto = estado.projeto || null;
  // Abrir um ficheiro gravado não passa pelo receberProjeto() (o projeto vem
  // do ficheiro inteiro, não da ponte), por isso conta-se aqui. É também o
  // caminho de um "Link para ver" -- e esse não conta nada, tratado dentro do
  // uso.js e não com um if aqui, para a regra viver num sítio só.
  usoDoProjeto(projeto);
  // "gomos" faltava aqui — ficava undefined (nem um array vazio) em vez de
  // manter os ajustes de cada gomo (largura/corredor/filas/posição). Sem
  // isto, fazerPublicoGomos()/ajustesDeGomosGarantidos() (que fazem
  // "ajustes.gomos[i] = ...") rebentavam ao trocar para "Circular" depois
  // de abrir um projeto guardado — reportado como "tudo desaparece" só
  // nessa vista. Mesma forma que ajustesGuardados() já usa (js/projeto.js).
  // Os quatro "Extra" (palco/régie/passarela/projetor) seguem a mesma
  // regra: um ficheiro gravado ANTES desta versão não os tem, e isso tem
  // de dar `[]`, nunca `undefined` -- ver ajustesGuardados() em
  // projeto.js, que usa exactamente a mesma forma.
  ajustes = (estado.ajustes && typeof estado.ajustes === "object")
    ? {
        delays: (estado.ajustes.delays && typeof estado.ajustes.delays === "object") ? estado.ajustes.delays : {},
        dsm: Array.isArray(estado.ajustes.dsm) ? estado.ajustes.dsm : [],
        gomos: Array.isArray(estado.ajustes.gomos) ? estado.ajustes.gomos : [],
        palcosExtra: Array.isArray(estado.ajustes.palcosExtra) ? estado.ajustes.palcosExtra : [],
        regiesExtra: Array.isArray(estado.ajustes.regiesExtra) ? estado.ajustes.regiesExtra : [],
        passarelasExtra: Array.isArray(estado.ajustes.passarelasExtra) ? estado.ajustes.passarelasExtra : [],
        projetoresExtra: Array.isArray(estado.ajustes.projetoresExtra) ? estado.ajustes.projetoresExtra : [],
        zonasSemLeitura: Array.isArray(estado.ajustes.zonasSemLeitura) ? estado.ajustes.zonasSemLeitura : [],
        fatiasEscondidas: Array.isArray(estado.ajustes.fatiasEscondidas) ? estado.ajustes.fatiasEscondidas : [],
        nomePorId: (estado.ajustes.nomePorId && typeof estado.ajustes.nomePorId === "object") ? estado.ajustes.nomePorId : {},
        noDeposito: Array.isArray(estado.ajustes.noDeposito) ? estado.ajustes.noDeposito : [],
        // Um ficheiro gravado antes do depósito abre com tudo montado, que é
        // como foi gravado -- nunca com a sala vazia à espera de descarga.
        depositoIniciado: true,
        // Não vem do ficheiro de propósito: é o feitio de trabalhar de quem
        // está a abrir, não de quem gravou.
        depositoLigado: depositoLigado(),
        // Esta vem: a máquina faz parte do projeto que se gravou.
        projetor: (estado.ajustes.projetor && typeof estado.ajustes.projetor === "object") ? estado.ajustes.projetor : null
      }
    : { delays: {}, dsm: [], gomos: [], palcosExtra: [], regiesExtra: [], passarelasExtra: [], projetoresExtra: [], zonasSemLeitura: [], fatiasEscondidas: [], nomePorId: {}, noDeposito: [], depositoIniciado: true, depositoLigado: depositoLigado(), projetor: null, curvaDoBlend: null, retroDoBlend: false };
  guardarAjustes(ajustes);
  mostrarLogoProprioExtra(false);

  // As imagens (ver estadoCompleto()) -- carregam-se de volta antes do
  // montar() final, para a cena já nascer com elas em vez de aparecerem um
  // instante depois. conteudoDeDataURL() RECOMPRIME outra vez ao carregar --
  // pedido direto: um projeto guardado antes desta redução existir (ou com
  // imagens escolhidas num Preview mais antigo) continuava "demasiado
  // grande para partilhar" mesmo depois da compressão ter sido reforçada,
  // porque essa compressão só corria ao ESCOLHER uma imagem nova, nunca ao
  // reabrir uma já gravada. Guarda-se logo o data URL recomprimido de volta
  // em texturaDataURL/texturasPorZonaDataURL -- um "Guardar projeto" ou
  // "Link para ver" a seguir a abrir já sai mais leve, sem se ter de
  // escolher as imagens todas outra vez à mão. Nunca rejeita: uma imagem
  // corrompida/em falta no ficheiro não deve travar o resto do projeto,
  // fica só sem conteúdo nessa zona (como se nunca tivesse tido imagem).
  const conteudo = (estado.conteudo && typeof estado.conteudo === "object") ? estado.conteudo : {};
  const textoGeral = typeof conteudo.textura === "string" ? conteudo.textura : null;
  const geralCarregado = textoGeral ? await conteudoDeDataURL(textoGeral) : null;
  textura = geralCarregado ? geralCarregado.textura : null;
  texturaDataURL = geralCarregado ? geralCarregado.dataURL : null;

  const porZonaGuardado = (conteudo.porZona && typeof conteudo.porZona === "object") ? conteudo.porZona : {};
  const nomes = Object.keys(porZonaGuardado);
  const carregadas = await Promise.all(nomes.map((n) => conteudoDeDataURL(porZonaGuardado[n])));
  texturasPorZona = {};
  texturasPorZonaDataURL = {};
  nomes.forEach((n, i) => {
    if (carregadas[i] && carregadas[i].textura) {
      texturasPorZona[n] = carregadas[i].textura;
      texturasPorZonaDataURL[n] = carregadas[i].dataURL;
    }
  });

  // A planta -- e como as imagens, antes do montar() final, para a sala nascer
  // já com o desenho por baixo. Um ficheiro gravado antes disto existir não
  // traz nada aqui, e reporPlanta(null) limpa a planta que estivesse aberta:
  // abrir um projeto é abrir aquele projeto, não deixar o desenho do anterior
  // por baixo dele.
  await reporPlanta(estado.planta);

  montar(true);
  // Acabado de abrir: o que está no ecrã É o ficheiro, não há nada por guardar.
  marcarGuardado();
}

// Escrever aqui não passa pelo montar() inteiro (reconstruiria a cena toda
// só por causa de uma letra) -- só actualiza o nome guardado e o texto no
// viewport, ao vivo. garantirProjeto() cria um projeto vazio se ainda não
// houver nenhum -- dá para começar pelo nome, antes de trazer zonas.
if ($("nomeProjeto")) $("nomeProjeto").addEventListener("input", () => {
  const p = garantirProjeto();
  p.nome = $("nomeProjeto").value;
  const nomeViewport = $("nomeProjetoViewport");
  if (nomeViewport) {
    const nome = p.nome || "";
    const texto = modoVisualizacao ? (nome ? nome + " · só visualização" : "Só visualização") : nome;
    nomeViewport.textContent = texto;
    nomeViewport.hidden = !texto;
  }
});

$("btGuardarProjeto").onclick = guardarProjetoTodo;

// ------------------------------------ abrir um .pvw com duplo clique nele
//
// Pedido: *"os projetos guardados terem ícone da app"*. O ícone e o duplo
// clique são a mesma coisa vista de dois lados: o sistema só põe o ícone de
// uma app num ficheiro quando essa app o declara como SEU. Quem o declara é o
// manifest (`file_handlers`, com o .pvw e os ícones), e isso só vale para a
// app INSTALADA -- num separador do browser o sistema não tem por onde saber.
//
// Declarar não chega: quando o sistema abre a app com um ficheiro, ele não
// passa por "Abrir projeto…" -- chega pela fila de arranque (launchQueue). Sem
// ninguém a consumi-la, o duplo clique abria a app VAZIA, que é pior do que
// não ter ícone nenhum.
//
// Entra pela MESMA porta do botão (abrirProjetoTodo), de propósito: um
// ficheiro aberto pelo sistema e um ficheiro escolhido à mão não podem ter
// dois caminhos que possam vir a divergir.
if (window.launchQueue && "setConsumer" in window.launchQueue) {
  window.launchQueue.setConsumer(async (params) => {
    if (!params || !params.files || !params.files.length) return;
    try {
      const ficheiro = await params.files[0].getFile();
      const estado = JSON.parse(await ficheiro.text());
      await abrirProjetoTodo(estado);
      dizerNaCena("Aberto: " + ficheiro.name);
    } catch (e) {
      const aviso = $("aviso");
      aviso.textContent = (e && e.message) ? e.message : "Não consegui abrir esse ficheiro.";
      aviso.classList.add("mostra");
    }
  });
}

// ---------------------------------------------- perguntar antes de fechar
//
// Pedido: *"perguntar se quero guardar ao fechar, por segurança"*.
//
// Um projeto aqui vive na memória e no localStorage -- não num ficheiro, a não
// ser que alguém carregue em "Guardar projeto". Fechar a janela por engano com
// uma tarde de ajustes por gravar é o tipo de perda que não se desfaz.
//
// O que o browser deixa fazer é isto e mais nada: dizer que HÁ coisas por
// guardar, e ele mostra a caixa dele ("sair do site?"). O texto é do browser,
// não nosso -- não há maneira de lá pôr "guardar/não guardar", e prometer um
// botão que não existe seria pior.
//
// E só se pergunta quando há mesmo o que perder: numa sala vazia e sem projeto
// não há nada por guardar, e uma app que faz uma pergunta dessas ao fechar uma
// janela vazia é uma app que se aprende a despachar sem ler.
let porGuardar = false;
function marcarPorGuardar() { porGuardar = true; }
function marcarGuardado() { porGuardar = false; }

window.addEventListener("beforeunload", (e) => {
  if (!porGuardar) return;
  if (!projeto && salaEstaVazia()) return;
  e.preventDefault();
  // O valor é ignorado pelos browsers de hoje, mas alguns ainda o exigem para
  // a caixa aparecer.
  e.returnValue = "";
  return "";
});
$("btAbrirProjeto").onclick = () => $("ficheiroProjeto").click();

// -------------------------------------------------------- link para partilhar

// "🔗 Link para ver": o mesmo estadoCompleto() de "Guardar projeto", mas em
// vez de descarregar um ficheiro, vai para o Worker e volta um link -- para
// mandar a um cliente ou colega ver e rodar a sala, sem editar nada (ver
// modoVisualizacao, mais acima, e o guarda em edicaoLivreLigada()).
// Guardado atrás de "existe mesmo?": mesma razão do #btRecentrarVista (HTML
// em cache vs. JS sempre fresco -- ver PARA-CONTINUAR.md).
if ($("btPartilhar")) $("btPartilhar").onclick = async () => {
  if (!projeto) {
    const aviso = $("aviso");
    aviso.textContent = "Carrega um projeto primeiro.";
    aviso.classList.add("mostra");
    setTimeout(() => aviso.classList.remove("mostra"), 2400);
    return;
  }
  const botao = $("btPartilhar");
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = "A criar o link…";
  try {
    const estado = estadoCompleto();
    // UM LINK NÃO É UM FICHEIRO. O ficheiro guardado leva a planta inteira,
    // custe o que custar -- é para isso que ele serve. O link passa por um
    // Worker, e uma planta de arquitectura de vários MB rebentava-o e o que
    // se via era só "o Worker respondeu 413", sem se perceber porquê. Aqui
    // deixa-se a planta de fora e DIZ-SE, que é a diferença entre um link
    // mais leve e um link estragado.
    const pesoDaPlanta = estado.planta ? JSON.stringify(estado.planta).length : 0;
    const semPlanta = pesoDaPlanta > PLANTA_QUE_CABE_NO_LINK;
    if (semPlanta) estado.planta = null;
    const link = await criarLinkPartilha(estado);
    // Só depois de o link existir mesmo: contar a intenção em vez do
    // resultado dava um número que conta tentativas falhadas como trabalho
    // entregue.
    usoMarcar("partilhar");
    $("linkPartilhaTexto").value = link;
    $("resultadoPartilha").hidden = false;
    $("linkPartilhaTexto").select();
    if (semPlanta) {
      const aviso = $("aviso");
      aviso.textContent = `O link vai sem a planta (${(pesoDaPlanta / 1e6).toFixed(1)} MB ` +
        `de desenho, de mais para um link). O ficheiro guardado leva-a.`;
      aviso.classList.add("mostra");
      setTimeout(() => aviso.classList.remove("mostra"), 6000);
    }
  } catch (e) {
    const aviso = $("aviso");
    aviso.textContent = e.message;
    aviso.classList.add("mostra");
    setTimeout(() => aviso.classList.remove("mostra"), 3200);
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
};

if ($("btCopiarLinkPartilha")) $("btCopiarLinkPartilha").onclick = async () => {
  const campo = $("linkPartilhaTexto");
  const botao = $("btCopiarLinkPartilha");
  campo.select();
  try {
    await navigator.clipboard.writeText(campo.value);
    const original = botao.textContent;
    botao.textContent = "Copiado";
    setTimeout(() => { botao.textContent = original; }, 2200);
  } catch (_) { /* sem permissão -- o campo já está selecionado, copia-se à mão */ }
};
// AS FATIAS, UMA A UMA.
//
// Pedido: *"ligar e desligar as fatias por projetores para ver que área deve
// um só cobrir"*. O "só" de cada linha é o gesto que serve mesmo esse fim --
// apaga todas menos aquela num toque, em vez de obrigar a desmarcar nove.
//
// A tabela é reescrita por inteiro a cada `escreverCoordenadas()`, por isso o
// ouvinte fica no contentor e não nas caixas: caixas novas não precisam de ser
// religadas.
if ($("coordsTabela")) {
  $("coordsTabela").addEventListener("change", (e) => {
    const cb = e.target.closest(".fatia-cb");
    if (!cb) return;
    const quem = cb.dataset.projetor;
    const fora = new Set(ajustes.fatiasEscondidas || []);
    if (cb.checked) fora.delete(quem); else fora.add(quem);
    ajustes.fatiasEscondidas = [...fora];
    aplicarFatias();
  });
  $("coordsTabela").addEventListener("click", (e) => {
    const bt = e.target.closest(".fatia-so");
    if (!bt) return;
    const quem = bt.dataset.projetor;
    const todos = dadosDeCoordenadas().cupula.map((p) => p.nome);
    const jaSozinho = ajustes.fatiasEscondidas &&
                      ajustes.fatiasEscondidas.length === todos.length - 1 &&
                      !ajustes.fatiasEscondidas.includes(quem);
    // Segundo toque no mesmo "só" traz todas de volta: é o caminho de saída
    // sem ter de procurar outro botão.
    ajustes.fatiasEscondidas = jaSozinho ? [] : todos.filter((n) => n !== quem);
    escreverCoordenadas();
    aplicarFatias();
  });
}
if ($("btFatiasTodas")) $("btFatiasTodas").onclick = () => {
  ajustes.fatiasEscondidas = [];
  escreverCoordenadas();
  aplicarFatias();
};

/**
 * Aplica as fatias escondidas ao que está desenhado, guarda a escolha, e
 * escreve o recado. NÃO remonta a cena: mudar a visibilidade de uns objetos
 * é instantâneo, e remontar tudo para isso seria lento e apagaria a vista.
 */
function aplicarFatias() {
  mostrarFatiasDaCupula(domeMontado, ajustes.fatiasEscondidas);
  recadoDasFatias();
  guardarAjustes(ajustes);
  // Não é preciso pedir desenho: a cena redesenha-se em contínuo
  // (requestAnimationFrame), por isso a mudança aparece no fotograma seguinte.
}

/**
 * "2 de 6 fatias escondidas." Sem isto, quem apaga umas quantas e volta ao
 * projeto uma hora depois vê uma cúpula com buracos e não faz ideia porquê --
 * que é o defeito de sempre desta app, a esconder sem dizer.
 */
function recadoDasFatias() {
  const nota = $("fatiasNota");
  if (!nota) return;
  // `cupula` vem NULL sempre que o projeto não tem cúpula -- que é o caso
  // normal de um blend ou de uma projeção simples. Todos os outros sítios
  // passam pelo `temCupula` de dadosDeCoordenadas() por esta razão exacta;
  // este ia buscar o `.length` a direito e rebentava -- a meio do montar(),
  // com a cena já limpa e o desenho novo ainda por entregar. Ver a rede de
  // segurança em montar().
  const { cupula, temCupula } = dadosDeCoordenadas();
  const total = temCupula ? cupula.length : 0;
  const fora = (ajustes.fatiasEscondidas || []).filter((n) => n).length;
  if (!total || !fora) { nota.hidden = true; nota.textContent = ""; return; }
  nota.hidden = false;
  nota.textContent = fora + (fora === 1 ? " fatia escondida" : " fatias escondidas") +
    " de " + total + " — é só a vista: as contas, as coordenadas e o que exportas continuam com todos os projetores.";
}

if ($("btCopiarCoords")) $("btCopiarCoords").onclick = async () => {
  const texto = coordenadasEmTexto();
  const botao = $("btCopiarCoords");
  if (!texto) { botao.textContent = "Ainda não há coordenadas"; setTimeout(() => { botao.textContent = "Copiar coordenadas"; }, 2200); return; }
  try {
    await navigator.clipboard.writeText(texto);
    botao.textContent = "Copiado";
  } catch (_) {
    // Sem permissão para a área de transferência: em vez de falhar calado,
    // mostra-se o texto para ser copiado à mão.
    const nota = $("coordsNota");
    if (nota) nota.textContent = "Sem permissão para copiar — as coordenadas estão na tabela acima.";
    botao.textContent = "Copia à mão da tabela";
  }
  setTimeout(() => { botao.textContent = "Copiar coordenadas"; }, 2200);
};

$("ficheiroProjeto").addEventListener("change", () => {
  const ficheiro = $("ficheiroProjeto").files[0];
  $("ficheiroProjeto").value = "";
  if (!ficheiro) return;
  const leitor = new FileReader();
  // abrirProjetoTodo() é async (carrega as imagens do projeto antes do
  // montar() final) -- um "throw" lá dentro vira uma promessa rejeitada, não
  // uma exceção síncrona, por isso o catch tem de estar aqui, à volta do
  // await, e não só à volta do JSON.parse.
  leitor.onload = async () => {
    try {
      await abrirProjetoTodo(JSON.parse(leitor.result));
    } catch (e) {
      const aviso = $("aviso");
      aviso.textContent = "Não consegui abrir este ficheiro: " + e.message;
      aviso.classList.add("mostra");
      setTimeout(() => aviso.classList.remove("mostra"), 3200);
    }
  };
  leitor.readAsText(ficheiro);
});

$("btLimpar").onclick = () => {
  // LIMPA AS DUAS APPS, A FUNDO.
  //
  // Pedido a testar no telemóvel, a fazer de gestor na rua com um cliente:
  // *"se tenho peças a entrar que posso não me lembrar, poderei ter um engano.
  // Forma simples de limpar tudo mas a fundo, tudo vazio sem nada por omissão
  // ao toque de um botão, que sirva para os dois sem ter de estar a limpar num
  // e noutro"*. O que o motivou foi um DSM que apareceu num projeto onde nunca
  // foi posto: estava guardado numa chave só dele, de outro dia.
  //
  // Antes isto repunha só a cena. Agora apaga também o que está guardado --
  // dos dois lados, que partilham localStorage -- e a pergunta passa a ser
  // feita SEMPRE, mesmo com a cena vazia: o que se apaga já não é só o que
  // está à vista.
  if (!confirm(
      "Limpar tudo?\n\n" +
      "As duas apps ficam vazias — este 3D e todas as calculadoras, com as " +
      "zonas, o DSM, a cúpula, as TVs e o histórico de projetos.\n\n" +
      "Ficam só o idioma, a sincronização e a contagem de uso.\n\n" +
      "Não há volta atrás.")) return;
  if (window.mikeappsLimpeza) {
    window.mikeappsLimpeza.limpezaProfunda();
    // Recarregar em vez de repor à mão: é a mesma decisão que os Calculadores
    // tomaram e pela mesma razão -- repor cada campo em duplicado ficava
    // sempre a arrastar-se atrás do arranque a sério.
    location.reload();
    return;
  }
  limparTudo();
};

// Carregar o quê? Com a caixa vazia, aquele botão só sabe dizer "não veio
// nada" — um botão que só serve para dar um erro é melhor apagado até ter o que
// fazer.
function prontoParaCarregar() {
  $("btCarregar").disabled = !$("colagem").value.trim();
}
$("colagem").addEventListener("input", prontoParaCarregar);
prontoParaCarregar();

/**
 * O que a IA percebeu, escrito e a ficar.
 *
 * Da primeira vez isto ia para o aviso de baixo — e o aviso apaga-se ao
 * primeiro campo que se mexa. Pior: quando o pedido não trazia medidas, o que
 * a IA devolvia de mais útil era precisamente o que se deitava fora. Ela lê
 * "dois ecrãs para slides e dois para imagem" e responde, com todas as letras,
 * que falta a tecnologia, a disposição, as dimensões da sala e a distância do
 * público. Isso não é um erro — é a lista do que falta perguntar ao cliente.
 */
function escreverRespostaIA(veio, feitas, mantidas, comVariosTamanhos) {
  const caixa = $("respostaIA");
  const partes = [];

  if (veio.resumo) partes.push(`<b>A IA leu:</b> ${veio.resumo}`);
  if (feitas.length) partes.push(`<b>Aplicado:</b> ${feitas.join(", ")}.`);
  else partes.push("<b>Não havia medidas no pedido</b>, por isso o desenho ficou como estava.");
  if (feitas.length && feitas[0].includes("partida")) {
    partes.push("O tamanho é <b>um ponto de partida</b> tirado da profundidade da sala — " +
                "muda-o em <i>Ajustar o ecrã</i>, ou traz o certo dos Calculadores.");
  }
  if (comVariosTamanhos) {
    // Vários tamanhos, posicionados uns em relação aos outros: é exactamente
    // o que a aba Ecrã Complexo já faz, com tiles, pitch e um editor de
    // posições a sério. Este esboço só serve para se ver mais ou menos como
    // fica -- para configurar isto para valer, o sítio é lá, e não aqui.
    partes.push("Isto tem <b>vários tamanhos</b> — a posição aqui é só um arranjo genérico " +
                "(conteúdo denso como slides ao centro, o resto a ladear). Para configurar a " +
                "sério, com tiles e pitch, usa o <b>Ecrã Complexo</b> nos Calculadores e traz o " +
                "resultado com \"Ver em 3D\".");
  }

  if (mantidas && mantidas.length) {
    partes.push("<b>Mantive o que já lá estava:</b> a sala que escreveste " +
                "ganha à que a IA estimou. Ela recebeu-a com o pedido, por isso " +
                "as contas dela já contam com ela.");
  }
  if (veio.perguntas && veio.perguntas.length) {
    partes.push("<b>Falta saber:</b><ul>" +
      veio.perguntas.map(q => `<li>${q}</li>`).join("") + "</ul>");
  }

  caixa.innerHTML = '<button class="fechar" title="Fechar">×</button>' + partes.join("<br>");
  caixa.querySelector(".fechar").onclick = () => { caixa.hidden = true; };
  caixa.hidden = false;
}

/**
 * O conteúdo denso (slides, texto, gráficos) ganha sempre a posição central —
 * é o que a conta de distância de visualização diz: uma letra lê-se a uma
 * distância que uma fotografia não precisa. Não se refaz aqui essa conta —
 * mora nos Calculadores, na aba Distância de Visualização, e refazê-la seria
 * duplicar exactamente o que já existe — mas o DESTINO que o texto deu a cada
 * grupo ("para powerpoint", "para slides") já diz o suficiente para saber qual
 * precisa da melhor posição.
 */
const CONTEUDO_DENSO = /\b(powerpoint|slide|slides|texto|grafic\w*|apresenta\w*|dado\w*|conteudo)\b/;

/**
 * Os prioritários ao centro, os outros nas pontas.
 *
 * O esboço tinha as peças pela ordem em que o texto as descrevia — "2 maiores
 * para powerpoint" todos de um lado, "2 menores para imagens" todos do outro —
 * e isso não é uma montagem, é uma lista. Adivinhar palavras como "interior" ou
 * "exterior" no texto seria tentar fazer, por regex, o que a aba Ecrã Complexo
 * já faz a sério com um editor de posições; aqui o objectivo é só ver mais ou
 * menos como fica.
 *
 * A ordem de prioridade é: primeiro o CONTEÚDO (slides/texto ganham à imagem,
 * porque é isso que a distância de visualização pede), e só a seguir o
 * tamanho — um "menor" que seja de slides ainda vai à frente de um "maior"
 * que seja só de imagem.
 */
function ordenarPeloCentro(pecas) {
  const ordenadas = pecas.slice().sort((a, b) => {
    const prioridadeA = CONTEUDO_DENSO.test(a.para || "") ? 1 : 0;
    const prioridadeB = CONTEUDO_DENSO.test(b.para || "") ? 1 : 0;
    return prioridadeB - prioridadeA || b.escala - a.escala;
  });
  const esquerda = [], direita = [];
  ordenadas.forEach((peca, i) => (i % 2 === 0 ? direita : esquerda).push(peca));
  return [...esquerda.reverse(), ...direita];
}

/**
 * O texto do pedido, lido pela IA.
 *
 * A primeira versão mandava o texto para os Calculadores e deixava-os analisar.
 * Não funcionou na máquina do mike, e a razão vale a pena ficar escrita: a app
 * dele está INSTALADA, e uma janela de aplicação não se alcança com um
 * `window.open` com nome. O texto chegava ao localStorage e ficava lá à espera
 * de uma janela que nunca era a certa.
 *
 * Agora a chamada faz-se daqui, ao MESMO Worker — o endereço vem do
 * localStorage que os Calculadores já escrevem, por isso configura-se uma vez e
 * serve os dois. Não é duplicar a conta deles: as tabelas de LED, de projetores
 * e de lentes continuam todas do lado de lá. O que atravessa é um texto e umas
 * medidas.
 */
function ficheiroParaBase64(ficheiro) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = leitor.result || "";
      const virgula = resultado.indexOf(",");
      resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado);
    };
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(ficheiro);
  });
}

$("btAnalisar").onclick = async () => {
  const texto = $("colagem").value.trim();
  const campoImagem = $("imagemPedido");
  const ficheiroImagem = campoImagem && campoImagem.files && campoImagem.files[0];
  if (!texto && !ficheiroImagem) {
    $("aviso").textContent = "Escreve ou cola o texto do pedido, ou carrega uma foto/render do evento.";
    $("aviso").classList.add("mostra");
    return;
  }

  const botao = $("btAnalisar");
  const dizia = botao.textContent;
  botao.disabled = true;
  botao.textContent = "A ler o pedido…";
  $("aviso").textContent = "A IA está a ler o pedido — pode demorar uns segundos.";
  $("aviso").classList.add("mostra");

  try {
    // Um campo que já foi mexido à mão não se escreve por cima -- nem se
    // manda para a IA como se fosse facto assente. O `defaultValue` é o que
    // está no HTML: se o campo ainda é isso, ninguém lá mexeu, é só o valor
    // de arranque da página. Mandar esse valor à IA como "sala já definida
    // no desenho" fazia-a ignorar uma sala escrita no próprio texto (ex:
    // "sala com 25 por 25") a favor do valor de arranque -- reportado
    // direto: "não leu o tamanho da sala, aplicou o base".
    const porOMike = (id) => $(id).value !== $(id).defaultValue;
    const salaAgora = {
      largura: porOMike("salaL") ? num("salaL") : null,
      profundidade: porOMike("salaP") ? num("salaP") : null,
      altura: porOMike("salaA") ? num("salaA") : null
    };
    const imagem = ficheiroImagem
      ? { base64: await ficheiroParaBase64(ficheiroImagem), mediaType: ficheiroImagem.type }
      : null;
    const veio = doQueVeioParaCa(await analisar(texto, salaAgora, imagem));
    const feitas = [];
    const mantidas = [];
    let comVariosTamanhos = false;

    if (veio.sala) {
      // O mesmo `porOMike` de cima: quem já escreveu um valor à mão ganha à
      // estimativa da IA.
      const aplicar = (id, valor, comoSeDiz) => {
        if (!valor) return;
        if (porOMike(id)) { mantidas.push(comoSeDiz); return; }
        $(id).value = valor;
        feitas.push(comoSeDiz.replace("{}", valor));
      };
      aplicar("salaL", veio.sala.largura, "sala com {} m de largura");
      aplicar("salaP", veio.sala.profundidade, "{} m de fundo");
      aplicar("salaA", veio.sala.altura, "{} m de pé-direito");
    }

    // "de pé" (standing) — só se o texto o disser explicitamente (nunca se
    // inventa o contrário). Auditório com plateia a subir é o padrão da
    // página (ver `#inclinacao`, valor de arranque 0.12); um público de pé
    // não tem lugares a subir em fila -- chão plano, como o botão "Pavilhão
    // · plano" já faz à mão. Reportado direto: "disse-lhe que era de pé e
    // desenhou um auditório a subir".
    if (veio.emPe && !porOMike("inclinacao")) {
      $("inclinacao").value = "0";
      marcarTipoDePlateia();
      feitas.push("chão plano (público de pé)");
    }

    const quantos = Math.max(1, veio.quantos || quantosEcras(texto) || 1);

    // Um sim/não que a IA já extrai — não se inventa um grau de curvatura,
    // porque o texto raramente o diz; uma curva moderada chega para se ver a
    // diferença, sem fingir uma precisão que ninguém pediu.
    const curvaDoPedido = veio.curvo ? { modo: "angulo", valor: 15, dir: "concavo" } : null;

    if (veio.ecra) {
      // Um ecrã só, ao meio: o que a IA dá é um tamanho, não uma montagem.
      carregar({
        v: 1, origem: "assistente", nome: "Ecrã do pedido",
        zonas: [{ nome: "Ecrã", x: 0, y: 0,
                  w: veio.ecra.largura, h: veio.ecra.altura, cor: "#2E7BFF",
                  curva: curvaDoPedido }]
      }, true);
      feitas.unshift(`ecrã de ${veio.ecra.largura.toFixed(2)} × ${veio.ecra.altura.toFixed(2)} m` +
                     (curvaDoPedido ? " (curvo)" : ""));
    } else if (veio.quantos || quantosEcras(texto) || gruposDeEcras(texto).length) {
      // Sem medidas no pedido, desenha-se na mesma: um pedido que fala de
      // quatro ecrãs merece ver quatro ecrãs. O tamanho é um PONTO DE PARTIDA
      // tirado da profundidade da sala -- e diz-se que é, para ninguém o levar
      // para uma reunião como se fosse uma proposta.
      //
      // E se o texto disser que uns são maiores do que outros, isso respeita-se:
      // desenhar tudo igual é ignorar metade do que foi pedido.
      //
      // Mas nenhum grupo pode furar o tecto. O ecrã não assenta no chão da
      // sala -- assenta em cima do palco, e às vezes ainda sobe mais um bocado
      // ("Ecrã acima do palco"). É esse ponto de partida, e não o chão, que
      // tem de caber no pé-direito: um "maiores" de 1,5× que ficasse bem no
      // papel e furasse o tecto na sala real não seria um esboço, era um erro.
      const fundo = num("salaP") || 18;
      const palco = lerPalco();
      const pDireito = num("salaA") || 8;
      // 0,4 m de folga até ao tecto -- estrutura, grelhas, o que for lá em cima.
      const sobraAteAoTecto = Math.max(1, pDireito - palco.altura - palco.acimaDoPalco - 0.4);
      const alturaBase = Math.min(4, sobraAteAoTecto, Math.max(1.5, Math.round((fundo / 8) * 10) / 10));
      // Primeiro os grupos que a própria IA já separou -- ela percebe a
      // língua, e não precisa de adivinhar âncoras num texto. A regex sobre o
      // texto escrito fica como rede de segurança, para um Worker ainda sem
      // este campo ou uma resposta em que a IA o deixou vazio.
      const grupos = veio.grupos.length ? veio.grupos : gruposDeEcras(texto);
      const lista = grupos.length ? grupos : [{ quantos, escala: 1, para: "" }];

      // Primeiro calculam-se os tamanhos, um por peça -- e só depois se decide
      // a ORDEM em que ficam da esquerda para a direita. As duas coisas vêm de
      // sítios diferentes: o tamanho vem do que o texto disse; a ordem é um
      // arranjo de propósito, e não a ordem em que as frases foram escritas.
      // A curvatura só se aplica ao ecrã ÚNICO (acima) — aqui há vários grupos
      // de peças distintas lado a lado, e curvar cada uma por si dava várias
      // arcas pequenas em vez de UMA parede curva. Representar bem "N ecrãs
      // curvos" pediria uni-los numa zona só com gomos, o que muda a forma
      // como o resto do esboço se monta; fica por fazer, e é melhor não
      // desenhar do que desenhar errado.
      const pecas = [];
      let cortadoPeloTecto = false;
      const descricao = [];
      for (const grupo of lista) {
        let altura = Math.round(alturaBase * grupo.escala * 10) / 10;
        if (altura > sobraAteAoTecto + 0.001) { altura = Math.round(sobraAteAoTecto * 10) / 10; cortadoPeloTecto = true; }
        const larg = Math.round(altura * (16 / 9) * 10) / 10;
        for (let i = 0; i < grupo.quantos; i++) {
          pecas.push({
            nome: grupo.para ? `${grupo.para} ${i + 1}` : "",
            w: larg, h: altura, escala: grupo.escala,
            cor: grupo.escala > 1 ? "#2E7BFF" : grupo.escala < 1 ? "#7C8CA0" : "#22D3EE"
          });
        }
        descricao.push(`${grupo.quantos}× ${larg.toFixed(2)} × ${altura.toFixed(2)} m` +
                       (grupo.para ? ` (${grupo.para})` : ""));
      }

      const zonas = [];
      let x = 0, n = 0;
      for (const peca of ordenarPeloCentro(pecas)) {
        n++;
        zonas.push({ nome: peca.nome || `Ecrã ${n}`, x, y: 0, w: peca.w, h: peca.h, cor: peca.cor });
        x += peca.w + 1;
      }

      carregar({ v: 1, origem: "assistente (tamanho de partida)",
                 nome: `${n} ecrãs do pedido`, zonas }, true);
      feitas.unshift(descricao.join(", ") + " — tamanho de partida" +
                     (cortadoPeloTecto ? ", já ajustado ao pé-direito" : ""));
      comVariosTamanhos = lista.length > 1;
    } else {
      montar(true);
    }

    escreverRespostaIA(veio, feitas, mantidas, comVariosTamanhos);
    if (feitas.length) {
      $("aviso").innerHTML = "Da IA: " + feitas.join(", ") + ".";
      setTimeout(() => $("aviso").classList.remove("mostra"), 7000);
    } else {
      $("aviso").classList.remove("mostra");
    }
  } catch (e) {
    $("aviso").innerHTML = e.message +
      "<br>O assistente e o seu endereço configuram-se nos <b>Calculadores</b>, " +
      "em <i>Configuração do assistente</i>.";
  } finally {
    botao.disabled = false;
    botao.textContent = dizia;
  }
};

/**
 * A marca já no ecrã ao abrir o exemplo -- pedido direto: "no arranque do
 * projeto de exemplo é que deve abrir com, no ecrã do centro logo completo
 * e nos das laterais apenas o logotipo sozinho". Os nomes vêm do próprio
 * EXEMPLO (js/projeto.js) -- "Principal" é sempre o ecrã do meio.
 *
 * Fica de fora do "Guardar projeto" de propósito: sem texturasPorZonaDataURL
 * a par (ver estadoCompleto()), como o padrão de teste também fica --
 * regenera-se sozinho ao clicar "Exemplo" outra vez, não é um ficheiro do
 * mike.
 */
async function aplicarConteudoDeExemplo() {
  const [completa, simbolo] = await Promise.all([texturaDaMarca(true), texturaDaMarca(false)]);
  texturasPorZona["Principal"] = completa;
  texturasPorZona["Ala esquerda"] = simbolo;
  texturasPorZona["Ala direita"] = simbolo;
  montar(false);
}

$("btCarregar").onclick = () => carregar($("colagem").value);
$("btExemplo").onclick = () => {
  $("colagem").value = JSON.stringify(EXEMPLO, null, 2);
  carregar(EXEMPLO);
  aplicarConteudoDeExemplo();
};

/**
 * Trazer o projeto dos Calculadores, à mão.
 *
 * As outras três pontes (sala, projetor, ecrã ajustado) têm todas um botão
 * "Trazer X" no lado que recebe. Esta nunca teve: o projeto só chegava
 * sozinho — ao abrir o Preview, ou ao vivo com as duas abas abertas ao mesmo
 * tempo. Sem um botão, não havia como o pedir outra vez à mão quando isso não
 * bastava — e "não encontro onde importar" era a app a dizer a verdade: não
 * havia onde.
 */
$("btTrazerProjeto").onclick = () => {
  const guardado = projetoGuardado();
  if (!guardado) {
    // Uma projeção (aba Distância de Projeção) não cria zonas nenhumas -- viaja
    // pela OUTRA ponte, a do projetor. Dizer "ainda não há nada guardado" a
    // quem acabou de marcar lá "Adicionar ao projeto" era mentira -- há, só
    // não é uma zona -- e mandava a pessoa procurar um botão diferente sem
    // dizer qual. Reportado direto, com uma captura de ecrã deste aviso.
    if (aplicarProjetores(projetorGuardado())) {
      $("aviso").innerHTML = "Não havia zonas guardadas, mas veio a <b>projeção</b> dos Calculadores.";
      $("aviso").classList.add("mostra");
      return;
    }
    // A regra passou a ser uma só (ver fase 1 do plano): marcado numa aba +
    // sincronização ligada = está no projeto = chega aqui. O texto antigo
    // prometia "qualquer outra com Adicionar ao projeto" sem dizer que era
    // preciso o sync ligado -- e era exatamente isso que faltava a quem
    // reportou este aviso com tudo marcado do outro lado.
    $("aviso").innerHTML = "Ainda não há nada guardado. Nos Calculadores, marca " +
      "<b>\"Adicionar ao projeto\"</b> na aba que interessa (Ecrã LED, TVs, Distância de " +
      "Projeção, Blending) ou monta as zonas no <b>Ecrã Complexo</b> — com a " +
      "<b>sincronização ligada</b>, fica tudo gravado sozinho e depois carregas aqui.";
    $("aviso").classList.add("mostra");
    return;
  }
  marcarRecebidoDeFora();
  carregar(guardado, true);
};

// ------------------------------------------------- ajustar e devolver o ecrã
//
// Olha-se para a sugestão montada na sala, acha-se curta, e muda-se ali mesmo.
// O conjunto todo é escalado -- as zonas mantêm as proporções e as posições
// relativas entre si -- e o tamanho volta para os Calculadores, que são quem
// sabe traduzir metros em tiles.

function escreverTamanhoDoEcra() {
  if (!projeto) { $("ecraL").value = ""; $("ecraA").value = ""; return; }
  const t = totais(projeto);
  $("ecraL").value = t.largura.toFixed(2);
  $("ecraA").value = t.altura.toFixed(2);
}

function redimensionarEcra(qual) {
  if (!projeto) return;
  const t = totais(projeto);
  const novaL = num("ecraL"), novaA = num("ecraA");
  let fator;
  if (qual === "largura") {
    if (!(novaL > 0) || !t.largura) return;
    fator = novaL / t.largura;
  } else {
    if (!(novaA > 0) || !t.altura) return;
    fator = novaA / t.altura;
  }
  if (!isFinite(fator) || fator <= 0 || Math.abs(fator - 1) < 0.0005) return;

  // Escala-se a partir do canto superior esquerdo do conjunto, para as zonas
  // não se afastarem umas das outras nem trocarem de sítio.
  for (const z of projeto.zonas) {
    z.x = t.esquerda + (z.x - t.esquerda) * fator;
    z.y = t.topo + (z.y - t.topo) * fator;
    z.w *= fator;
    z.h *= fator;
    // Os tiles e a resolução deixam de bater certo com o novo tamanho: quem
    // os volta a calcular são os Calculadores, e dizer um número errado é
    // pior do que não dizer nenhum.
    z.tiles = null; z.res = null; z.peso = null; z.amp = null;
  }
  projeto.origem = "ajustado no preview";
  montar(false);
  escreverTamanhoDoEcra();
  $("notaEcra").textContent =
    "Tamanho alterado aqui. Devolve-o aos Calculadores para eles escolherem os tiles " +
    "— o peso e a amperagem só voltam a fazer sentido depois disso.";
}

$("ecraL").addEventListener("change", () => redimensionarEcra("largura"));
$("ecraA").addEventListener("change", () => redimensionarEcra("altura"));

/**
 * Devolve aos Calculadores o tamanho do ecrã, as zonas (posição/rotação
 * decididas aqui incluídas) e a sala/palco — o caminho contrário ao que
 * "Sincronizar" já faz. `comAviso` escreve em #notaEcra (o clique manual
 * quer essa confirmação; o envio automático, mais abaixo, não — corre em
 * silêncio de propósito, como o resto da sincronização automática).
 * Devolve true se conseguiu escrever.
 */
/**
 * O QUE SE MEXEU DE LADO E EM ALTURA PASSA A SER A POSIÇÃO DA ZONA.
 *
 * Reportado com três fotografias seguidas: mexer o ↔ de um ecrã aqui, ver o
 * número mudar na lista dos Calculadores -- e o DESENHO ficar quieto, com as
 * medidas entre ecrãs todas iguais às de antes. *"A calculadora não actualiza
 * a posição para dar medidas."*
 *
 * A causa: o ↔/altura viviam num sítio à parte (`ajustes.delays`), como um
 * ajuste só do 3D, enquanto a posição que os Calculadores desenham e medem é a
 * da zona (`zona.x/y`). Dois números para a mesma coisa, e só um deles
 * atravessava a ponte.
 *
 * A decisão foi dele, posta por extenso: *"o 3D manda"*, e a seguir *"deve ser
 * bidirecional para ajuste mais preciso"*. Por isso, ao devolver, o que foi
 * mexido lateralmente e em altura é COMPROMETIDO na posição da zona e o ajuste
 * volta a zero. Daí para a frente há um número só: arrasta-se aqui por alto, e
 * escreve-se o Centro X/Y ao milímetro do lado de lá -- os dois escrevem no
 * mesmo sítio, e as medidas do conjunto passam a ser as da montagem.
 *
 * O fundo e a rotação NÃO se comprometem: a folha dos Calculadores é plana e
 * não tem onde os guardar. Continuam a viajar como nota por zona.
 *
 * O sinal do Y é o da cena, não o do papel: em centroDeZona(), +dy SOBE e o
 * `y` da zona cresce para BAIXO. Somar nos dois era enviar o ecrã para o lado
 * contrário do que se arrastou.
 */
function comprometerOQueFoiMexido() {
  if (!projeto || !Array.isArray(projeto.zonas)) return 0;
  let quantas = 0;
  projeto.zonas.forEach((zona) => {
    const a = ajustes.delays[zona.nome];
    if (!a) return;
    const dx = Number(a.dx) || 0, dy = Number(a.dy) || 0;
    if (!dx && !dy) return;
    zona.x = (Number(zona.x) || 0) + dx;
    zona.y = (Number(zona.y) || 0) - dy;
    a.dx = 0; a.dy = 0;
    quantas++;
  });
  return quantas;
}

function devolverAosCalculadores(comAviso) {
  if (!projeto) {
    if (comAviso) $("notaEcra").textContent = "Não há projeto para devolver.";
    return false;
  }
  // Antes de medir o que vai: o que foi arrastado passa a ser posição. Assim o
  // total (t) e as zonas do payload já são os da montagem.
  const comprometidas = comprometerOQueFoiMexido();
  const t = totais(projeto);
  try {
    const zonas = projeto.zonas.map((zona) => {
      const ajuste = ajustes.delays[zona.nome];
      return {
        nome: zona.nome,
        // A identidade da zona volta intacta -- é o que permite aos
        // Calculadores reconhecerem "a mesma zona" e a este Preview manter a
        // arrumação quando ela regressar com outro nome.
        id: zona.id || null,
        origem: zona.origem || null,
        x: zona.x, y: zona.y, w: zona.w, h: zona.h,
        cor: zona.cor, tipo: zona.tipo,
        curva: zona.curva, tiles: zona.tiles, res: zona.res,
        peso: zona.peso, amp: zona.amp,
        // Os Calculadores ignoram este campo, mas o Preview consegue
        // reabrir exatamente a posição e a rotação decididas na obra.
        preview: ajuste ? {
          dx: Number(ajuste.dx) || 0, dy: Number(ajuste.dy) || 0,
          dz: Number(ajuste.dz) || 0, rot: Number(ajuste.rot) || 0
        } : null
      };
    });
    const devolucao = {
      v: 1, largura: +t.largura.toFixed(2), altura: +t.altura.toFixed(2),
      zonas: zonas.length, quando: new Date().toISOString(),
      // Mantém largura/altura/zonas no topo por compatibilidade com a ponte
      // antiga, e acrescenta o desenho inteiro para o caminho inverso.
      projeto: {
        v: projeto.v, nome: projeto.nome, origem: "preview",
        origemVersao: $("versao") ? $("versao").textContent.trim() : null,
        zonas, dsm: projeto.dsm || null
      },
      sala: lerSala(),
      palco: lerPalco(),
      ajustes: JSON.parse(JSON.stringify(ajustes))
    };
    localStorage.setItem(CHAVE_DEVOLUCAO, JSON.stringify(devolucao));
    if (comAviso) {
      $("notaEcra").textContent =
        `Projeto enviado: ${zonas.length} ecrãs, ${t.largura.toFixed(2)} × ` +
        `${t.altura.toFixed(2)} m. Nos Calculadores, carrega em ` +
        `"Trazer do Preview".`;
    }
    // O que foi comprometido mudou a cena por dentro (a zona está no mesmo
    // sítio, mas agora por posição própria e não por ajuste) -- redesenha-se,
    // e diz-se, que um campo a voltar a zero sozinho parece trabalho perdido.
    // marcarRecebidoDeFora() trava o devolver que este montar dispararia: já
    // acabámos de devolver, e não há nada de novo para mandar.
    if (comprometidas) {
      guardarAjustes(ajustes);
      marcarRecebidoDeFora();
      const largura = totais(projeto).largura;
      montar(false);
      // O CONJUNTO VOLTA A CENTRAR-SE, e isso vê-se.
      //
      // O grupo de ecrãs está sempre centrado na sala (ctx.meio, em
      // contextoDeZonas). Afastar um ecrã alarga o conjunto, e alargá-lo
      // recentra-o: todos deslizam metade do que se mexeu. Não é o compromisso
      // a mexer no desenho -- é o modelo, e é igual quando o número se escreve
      // do lado dos Calculadores. Mas um desenho que desliza sozinho sem uma
      // palavra parece um erro, por isso diz-se.
      const cresceu = largura - t.largura;
      dizerNaCena(
        (comprometidas === 1
          ? "O que mexeste de lado passou a ser a posição da zona"
          : "O que mexeste de lado passou a ser a posição das zonas") +
        " — os Calculadores já medem por aí." +
        (Math.abs(cresceu) > 0.005
          ? " O conjunto ficou " + nnum(Math.abs(cresceu)) + " m mais " +
            (cresceu > 0 ? "largo" : "estreito") + " e voltou a centrar-se na sala."
          : ""));
    }
    return true;
  } catch (e) {
    if (comAviso) $("notaEcra").textContent = "Não consegui guardar — o browser não deixa.";
    return false;
  }
}
$("btDevolver").onclick = () => devolverAosCalculadores(true);

// Ao vivo, no sentido Preview -> Calculadores: antes disto, só "🔄
// Sincronizar" (Calculadores -> Preview) tinha um lado automático — o
// tamanho/zonas ajustados aqui só chegavam lá com um clique manual em
// "📤 Devolver", e era fácil esquecer o clique depois de mais um ajuste,
// ficando os Calculadores a mostrar um tamanho antigo mesmo com a
// sincronização automática ligada. Reportado: "se estão em sync, a
// calculadora devia ter o tamanho do ecrã e os delays do preview, e
// vice-versa". Agora, com a sincronização automática ligada, qualquer
// remontar com projeto carregado devolve sozinho (com uma pausa depois da
// última alteração, não a cada tecla) — em silêncio, sem escrever em
// #notaEcra, tal como o sentido contrário já corria em silêncio. O botão
// continua a existir para um envio imediato, com confirmação visível.
//
// SUSTO (v2.49): as duas apps entraram num loop -- os Calculadores reescrevem
// mikeapps-projeto-v1 a cada recálculo (mesmo quando esse recálculo foi
// só a APLICAR um projeto que tinha acabado de chegar do Preview), e agora
// o Preview também reescreve mikeapps-ecra-v1 a cada remontar (mesmo um
// remontar causado só por ACABAR de receber isso dos Calculadores). Com as
// duas automáticas ao mesmo tempo, cada lado ecoava de volta o que o outro
// tinha acabado de mandar, para sempre -- "sincronizar" nunca mais parava.
// marcarRecebidoDeFora() diz "o próximo remontar não é uma alteração
// local, é só a aplicar o que chegou de lá — não devolvas isto de volta".
// Chamado em todos os sítios que aplicam algo vindo dos Calculadores
// (evento "storage", "🔄 Sincronizar", "Trazer projeto", arranque).
let ignorarProximoDevolver = false;
function marcarRecebidoDeFora() { ignorarProximoDevolver = true; }
let temporizadorDevolver = null;
function devolverDaqui(ms = 700) {
  if (ignorarProximoDevolver) { ignorarProximoDevolver = false; return; }
  clearTimeout(temporizadorDevolver);
  temporizadorDevolver = setTimeout(() => {
    if (sincronizacaoAutomaticaLigada()) devolverAosCalculadores(false);
    else avisarQueNaoVaiSozinho();
  }, ms);
}

/**
 * MEXER AQUI COM A SINCRONIZAÇÃO DESLIGADA -- E SABÊ-LO.
 *
 * Reportado assim: *"deixaram de estar em sinc: eu movo no 3D e a calculadora
 * não actualiza para me dar as medidas"*.
 *
 * A ponte está inteira -- medido: com o interruptor ligado, mudar o ecrã aqui
 * chega aos Calculadores sozinho, em segundos. O que está desligado é o
 * interruptor, e está desligado de propósito desde a v3.80, a pedido: *"abre
 * sempre dos dois lados com o sync desligado e em projeto limpo até eu abrir
 * um"*. Nascer calado é o que foi pedido; ficar calado DEPOIS de alguém mexer
 * já não é -- do lado de quem mexeu, o outro lado está simplesmente errado, e
 * não há nada no ecrã que explique porquê.
 *
 * Por isso: uma vez por sessão, e só quando houve mesmo uma alteração que
 * TERIA atravessado, diz-se -- com os dois caminhos ao lado, mandar agora ou
 * ligar a automática. Uma vez, e não a cada ajuste: um aviso que aparece
 * sempre é um aviso que se deixa de ler.
 */
let jaAvisouQueNaoVaiSozinho = false;
function avisarQueNaoVaiSozinho() {
  if (jaAvisouQueNaoVaiSozinho || !projeto) return;
  jaAvisouQueNaoVaiSozinho = true;
  const aviso = $("aviso");
  const jaTem = aviso.classList.contains("mostra") ? aviso.innerHTML + " " : "";
  aviso.innerHTML = jaTem +
    "Mexeste aqui, mas a <b>sincronização automática está desligada</b> — os Calculadores " +
    "continuam com os valores antigos. " +
    '<button type="button" class="aviso-link" data-devolver-agora="1">Enviar agora</button> ' +
    '<button type="button" class="aviso-link" data-ligar-sinc="1">Ligar sincronização</button>';
  aviso.classList.add("mostra");
}

// --------------------------------------------------------- guardar a imagem
//
// Um printscreen perde as etiquetas e os numeros, que sao metade do que ali
// interessa -- e uma imagem que so mostra caixas azuis nao serve para mandar a
// ninguem. Por isso o desenho e recomposto: a cena, as etiquetas por cima, e
// uma tira em baixo com as contas.

// A marca em toda a exportação de imagem (PNG da vista / PNG com medidas) --
// pedido direto: "branding, em todos os export de imagens ... marca com o
// logo discreto no canto inferior direito sem tapar informações". Carregada
// uma vez só e reaproveitada -- exportar não devia esperar pela rede outra
// vez a cada clique, e sem marca (offline, ou o ficheiro não existir) a
// exportação continua a funcionar, só sem ela.
let logoExportacaoPromise = null;
function logoExportacao() {
  if (!logoExportacaoPromise) {
    logoExportacaoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = "icons/mike-logo.png";
    });
  }
  return logoExportacaoPromise;
}

async function guardarImagem() {
  renderizador.render(cena, camara);            // garantir que o que se copia e o que se ve

  const folha = document.createElement("canvas");
  const tira = 54;
  folha.width = tela.width;
  folha.height = tela.height + tira * (tela.width / tela.clientWidth);
  const p = folha.getContext("2d");
  const escala = tela.width / tela.clientWidth;

  p.fillStyle = "#0E1418";
  p.fillRect(0, 0, folha.width, folha.height);
  p.drawImage(tela, 0, 0);

  // A marca vai no canto inferior direito da PRÓPRIA IMAGEM 3D, não na tira
  // de contas por baixo -- pedido direto ("põe na imagem mesmo, não na
  // barra de informação"), depois de a barra ter mostrado que uma linha
  // comprida (a sala, v2.58) ou um export estreito (telemóvel) faziam o
  // texto ir dar ao logo. Mesma receita que guardarVista() já usa: fundo
  // semitransparente atrás, porque o canto tanto pode cair em cena escura
  // como em gente clara.
  const logo = await logoExportacao();
  if (logo) {
    const margem = 14 * escala;
    const alturaLogo = Math.min(28 * escala, tela.height * 0.06);
    const larguraLogo = alturaLogo * (logo.width / logo.height);
    const padding = 8 * escala;
    p.fillStyle = "rgba(14,20,24,0.55)";
    p.fillRect(
      tela.width - larguraLogo - margem - padding * 2,
      tela.height - alturaLogo - margem - padding * 2,
      larguraLogo + padding * 2, alturaLogo + padding * 2);
    p.drawImage(logo, tela.width - larguraLogo - margem - padding,
                tela.height - alturaLogo - margem - padding, larguraLogo, alturaLogo);
  }

  // as etiquetas, onde elas estao agora
  p.font = `${Math.round(12 * escala)}px "Segoe UI", system-ui, sans-serif`;
  p.textBaseline = "middle";
  for (const etiqueta of etiquetas) {
    const v = etiqueta.ponto.clone().project(camara);
    if (v.z > 1) continue;
    const x = (v.x * 0.5 + 0.5) * folha.width;
    const y = (-v.y * 0.5 + 0.5) * tela.height;
    const largura = p.measureText(etiqueta.texto).width + 16 * escala;
    const altura = 22 * escala;
    p.fillStyle = "rgba(14,20,24,0.86)";
    p.fillRect(x - largura / 2, y - altura / 2, largura, altura);
    p.strokeStyle = "#232D36";
    p.strokeRect(x - largura / 2, y - altura / 2, largura, altura);
    p.fillStyle = "#E7ECF2";
    p.textAlign = "center";
    p.fillText(etiqueta.texto, x, y);
  }

  // a tira com as contas -- a sala primeiro, porque é o contexto que dá
  // sentido a tudo o resto (reportado: faltava, só vinham os ecrãs).
  const sala = lerSala();
  const linha = [
    `Sala ${sala.largura.toFixed(2)} × ${sala.profundidade.toFixed(2)} × ${sala.altura.toFixed(2)} m`,
    $("resumo").textContent.replace(/\s+/g, " ").trim(),
    $("rodape").textContent.trim(),
    $("resumoProj").textContent.trim()
  ].filter(t => t && t !== "—").join("   ·   ");
  p.fillStyle = "#141B21";
  p.fillRect(0, tela.height, folha.width, folha.height - tela.height);
  p.fillStyle = "#8A97A6";
  p.textAlign = "left";
  p.font = `${Math.round(13 * escala)}px "Segoe UI", system-ui, sans-serif`;
  const alturaTira = folha.height - tela.height;
  p.fillText(linha, 16 * escala, tela.height + alturaTira / 2);

  const agora = new Date();
  const nome = "preview-" +
    agora.toISOString().slice(0, 16).replace("T", "-").replace(":", "h") + ".png";
  folha.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}

/**
 * A vista, tal e qual está no ecrã.
 *
 * A outra imagem leva etiquetas e uma tira com as contas, que é o que faz falta
 * para mandar a alguém que tem de decidir. Esta não leva nada: serve para
 * entrar num slide, num email ou ao lado de uma planta, onde os números já
 * estão escritos noutro sítio e o que se quer é só o desenho.
 *
 * Ao contrário de um printscreen, sai na resolução do canvas e sem o painel.
 */
async function guardarVista() {
  // Sem isto o browser pode ter limpo o buffer antes de o copiarmos e a
  // imagem sai preta -- o preserveDrawingBuffer sozinho não chega.
  renderizador.render(cena, camara);

  // Esta imagem não tem tira nenhuma por baixo (é só o desenho, para entrar
  // direto num slide) -- a marca tem de ir POR CIMA da própria cena. Por
  // isso copia-se para uma tela à parte só para o canto poder levar um
  // fundo semitransparente atrás do logo, e nunca depende do que calhar de
  // estar desenhado ali (às vezes escuro, às vezes gente clara).
  const logo = await logoExportacao();
  const folha = document.createElement("canvas");
  folha.width = tela.width; folha.height = tela.height;
  const p = folha.getContext("2d");
  p.drawImage(tela, 0, 0);

  if (logo) {
    const escala = tela.width / tela.clientWidth;
    const margem = 14 * escala;
    const alturaLogo = Math.min(28 * escala, tela.height * 0.06);
    const larguraLogo = alturaLogo * (logo.width / logo.height);
    const padding = 8 * escala;
    p.fillStyle = "rgba(14,20,24,0.55)";
    p.fillRect(
      tela.width - larguraLogo - margem - padding * 2,
      tela.height - alturaLogo - margem - padding * 2,
      larguraLogo + padding * 2, alturaLogo + padding * 2);
    p.drawImage(logo, tela.width - larguraLogo - margem - padding,
                tela.height - alturaLogo - margem - padding, larguraLogo, alturaLogo);
  }

  folha.toBlob((blob) => {
    if (!blob) { $("notaExportar").textContent = "Não consegui copiar a vista."; return; }
    descarregar(blob, nomeDoFicheiro("png"));
    $("notaExportar").innerHTML =
      `Guardada a vista: <b>${tela.width} × ${tela.height}</b> px.`;
  }, "image/png");
}



// ------------------------------------------------------- arrastar o orador
//
// A figura serve para dar escala, mas serve para mais do que isso: arrastada
// pelo palco, mostra de onde e que ela tapa o ecra -- e a que distancia deixa
// de tapar. Por isso anda, e anda so no chao do palco.

const apontador = new THREE.Raycaster();
const rato = new THREE.Vector2();
const planoDoPalco = new THREE.Plane();
const ondeCaiu = new THREE.Vector3();
// Do ponto onde o raio bate no chão até à figura, no momento em que se pega
// nela -- ver o pointerdown.
const desvioArrasto = new THREE.Vector3();
let aArrastar = false;
// Qual dos dois bonecos está na mão. São dois com regras diferentes (o orador
// sobe a palcos, a pessoa da cúpula nunca sai do chão de lá), por isso quem
// arrasta tem de saber em quem pegou -- e não "na figura", que era o que havia.
let aMoverQuem = null;

function figuraNaCena() {
  return desenhado ? desenhado.getObjectByName("figura") : null;
}

function pessoaDaCupula() {
  return desenhado ? desenhado.getObjectByName("figura-dome") : null;
}

/** Em qual dos bonecos o rato está a apontar, o da frente primeiro. */
function bonecoSobOApontador() {
  let melhor = null, maisPerto = Infinity;
  for (const f of [figuraNaCena(), pessoaDaCupula()]) {
    if (!f) continue;
    const toques = apontador.intersectObject(f, true);
    if (toques.length && toques[0].distance < maisPerto) {
      maisPerto = toques[0].distance;
      melhor = f;
    }
  }
  return melhor;
}

/**
 * Se (x, z) cai em cima de um palco extra, a altura do tampo dele; senão
 * null.
 *
 * Reportado: *"o boneco não vai ao segundo palco"*. É o mesmo buraco que já
 * se tinha tapado para a passarela (*"o prop não vai à passarela"*): a
 * figura estava presa ao retângulo do palco principal, e tudo o que se
 * acrescentou depois -- os palcos extra -- ficou de fora.
 *
 * A conta faz-se a partir do array de ajustes e não dos objetos da cena, de
 * propósito: isto também corre a desenhar, e a desenhar os palcos extra
 * podem ainda não estar montados. A rotação é a inversa da que a cena
 * aplica (fazerPalcoExtra: grupo.rotation.y = -rot em radianos).
 *
 * Pisar-se testa contra o RETÂNGULO, mesmo numa peça arredondada ou em
 * meia-lua: a tolerância nos cantos são centímetros de ar, e a figura é
 * uma referência de escala, não uma medida.
 */
/**
 * Onde é que o rato está a apontar, em cima de algo que se possa pisar.
 *
 * O arrasto do orador sempre trabalhou sobre um PLANO horizontal à altura
 * dele. Isso chega enquanto tudo é da mesma altura (palco + passarela), mas
 * não dá para subir a um palco extra mais alto: o raio atravessa o tampo e
 * vai bater no plano lá atrás, e a figura ia para trás em vez de para cima
 * -- foi exactamente o que se viu a testar ("o boneco não vai ao segundo
 * palco" não se resolvia só com limites).
 *
 * Aqui toca-se nas peças a sério. Devolve o ponto e a altura, ou null se o
 * rato não está sobre nenhuma; nesse caso quem chama volta ao plano de
 * sempre, que é o que trata de arrastar para fora da borda.
 *
 * Só faces viradas para cima contam: apontar a parede da frente de um palco
 * punha a figura colada a meia altura dela.
 */
const normalDoTampo = new THREE.Vector3();
/**
 * Um projeto que é SÓ cúpula: não tem zonas montadas, e portanto o chão que
 * conta é o da cúpula, não o do palco. Serve o desenho (onde nasce a figura) e
 * o arrastar (até onde ela pode ir) -- e tem de ser o mesmo critério nos dois,
 * senão ela nasce num sítio e o rato prende-a noutro.
 */
function cupulaSemZonas() {
  if (!projeto || !projeto.dome || !(numeroSeguro(projeto.dome.diametro) > 0)) return false;
  const m = projetoMontado(projeto);
  return !(m && m.zonas && m.zonas.length);
}
function numeroSeguro(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }

function pontoPisavelSobOApontador() {
  if (!desenhado) return null;
  const pecas = [];
  desenhado.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name || (o.parent && o.parent.name) || "";
    const nPai = (o.parent && o.parent.name) || "";
    if (n === "palco" || n === "passarela" || nPai.indexOf("palco-") === 0 || nPai.indexOf("passarela-") === 0) {
      pecas.push(o);
    }
  });
  if (!pecas.length) return null;
  const toques = apontador.intersectObjects(pecas, false);
  for (const t of toques) {
    if (!t.face) continue;
    normalDoTampo.copy(t.face.normal).transformDirection(t.object.matrixWorld);
    if (normalDoTampo.y < 0.5) continue;      // parede, não tampo
    return { x: t.point.x, y: t.point.y, z: t.point.z };
  }
  return null;
}

function alturaDePalcoExtraEm(x, z) {
  const lista = (ajustes && Array.isArray(ajustes.palcosExtra)) ? ajustes.palcosExtra : [];
  // De trás para a frente: o último acrescentado ganha, que é o que a
  // pessoa acabou de pôr e está a olhar para ele.
  for (let i = lista.length - 1; i >= 0; i--) {
    const pe = lista[i];
    const r = ((pe.rot || 0) * Math.PI) / 180;
    const dx = x - (pe.dx || 0), dz = z - (pe.dz || 0);
    const lx = dx * Math.cos(r) + dz * Math.sin(r);
    const lz = -dx * Math.sin(r) + dz * Math.cos(r);
    const meiaL = Math.max(1, pe.largura || 6) / 2;
    const meiaP = Math.max(0.5, pe.profundidade || 4) / 2;
    // A margem é a mesma dos outros limites: a figura não fica com os pés
    // meio no ar na borda.
    if (Math.abs(lx) <= meiaL - 0.2 && Math.abs(lz) <= meiaP - 0.2) {
      return Math.max(0.1, pe.altura || 1);
    }
  }
  return null;
}

function porRato(e) {
  const caixa = tela.getBoundingClientRect();
  rato.set(
    ((e.clientX - caixa.left) / caixa.width) * 2 - 1,
    -((e.clientY - caixa.top) / caixa.height) * 2 + 1);
}

tela.addEventListener("pointerdown", (e) => {
  if (!edicaoLivreLigada()) return;   // cadeado fechado: só a câmara mexe
  porRato(e);
  apontador.setFromCamera(rato, camara);
  const figura = bonecoSobOApontador();
  if (!figura) return;
  aMoverQuem = figura;

  aArrastar = true;
  controlos.enabled = false;                       // senao a camara vem atras
  tela.setPointerCapture(e.pointerId);
  planoDoPalco.set(new THREE.Vector3(0, 1, 0), -figura.position.y);

  // O DESVIO DA PEGA. Sem isto a figura SALTA ao primeiro pixel de arrasto:
  // a posição dela passava a ser o ponto onde o raio bate no plano do chão, e
  // quem pega pela cabeça está a apontar para um ponto do chão a metros de
  // distância dos pés dela. Medido antes: pegar na barriga e mexer 40 px para
  // o lado dava 2,2 m para TRÁS. Reportado: *"quando o movi foi lá para
  // sozinho"*. Guardado o desvio, a figura segue o rato em vez de aterrar nele.
  desvioArrasto.set(0, 0, 0);
  if (apontador.ray.intersectPlane(planoDoPalco, ondeCaiu)) {
    desvioArrasto.set(figura.position.x - ondeCaiu.x, 0, figura.position.z - ondeCaiu.z);
  }
  tela.style.cursor = "grabbing";
});

tela.addEventListener("pointermove", (e) => {
  if (!aArrastar) {
    // Um cursor de mao a dizer que aquilo se pega — senao ninguem descobre.
    // Só com o cadeado aberto: fechado, nada se pega, e um cursor de mao a
    // prometer isso enganava.
    if (!edicaoLivreLigada()) { tela.style.cursor = ""; return; }
    porRato(e);
    apontador.setFromCamera(rato, camara);
    tela.style.cursor = bonecoSobOApontador() ? "grab" : "";
    return;
  }

  const figura = aMoverQuem;
  if (!figura || !figura.parent) return;   // remontou a cena a meio do arrasto

  porRato(e);
  apontador.setFromCamera(rato, camara);

  // A PESSOA DA CÚPULA tem as regras dela, e nenhuma do palco: nunca sai do
  // chão de lá (y = 0), e o limite é a cúpula -- por dentro do anel de
  // projetores quando ele existe. Não passa pelos tampos dos palcos, que era
  // o que a punha 1 m no ar dentro de uma cúpula.
  if (figura.name === "figura-dome") {
    if (!apontador.ray.intersectPlane(planoDoPalco, ondeCaiu)) return;
    const m = (projeto && projeto.dome) ? medidasDaCupula(projeto.dome) : null;
    if (!m) return;
    const proj = projeto.dome.projetores || {};
    const raioMont = numeroSeguro(proj.raioMontagem);
    let raioD = Math.max(0.3, m.raioBase - 0.35);
    // Um anel apertado (um aglomerado ao meio) não vale como limite: prendia
    // a pessoa num círculo de meio metro e ela deixava de servir de escala.
    if (proj.n > 0 && raioMont - 0.45 >= 1) raioD = Math.min(raioD, raioMont - 0.45);
    const alvoX = ondeCaiu.x + desvioArrasto.x, alvoZ = ondeCaiu.z + desvioArrasto.z;
    const d = Math.hypot(alvoX, alvoZ);
    const k = d > raioD && d > 0 ? raioD / d : 1;
    figura.position.set(alvoX * k, 0, alvoZ * k);
    figura.updateMatrixWorld(true);
    ondeEstaNaDome = { x: figura.position.x, z: figura.position.z };
    atualizarMarcasDoBlend();
    atualizarNotaDaCupula();
    return;
  }

  // Daqui para baixo é o ORADOR, e só ele: as regras do palco, sem uma única
  // condição de cúpula pelo meio. Era o "se estiver numa cúpula faz outra
  // coisa" espalhado por este caminho que punha o boneco 1 m no ar dentro da
  // casca e o mandava para trás dos projetores.
  //
  // O rato está em cima de um tampo? Se sim, é ali que ele fica, à altura
  // desse tampo -- e nada mais se aplica. É isto que o deixa subir a um palco
  // extra de outra altura.
  const emCima = pontoPisavelSobOApontador();
  if (emCima) {
    figura.position.set(emCima.x, emCima.y, emCima.z);
    figura.updateMatrixWorld(true);
    ondeEsta = { x: figura.position.x, z: figura.position.z };
    medirSombra();
    atualizarMarcasDoBlend();
    atualizarNotaDaCupula();
    return;
  }

  if (!apontador.ray.intersectPlane(planoDoPalco, ondeCaiu)) return;

  const sala = lerSala();
  const palco = lerPalco();
  // UM PALCO QUE NÃO ESTÁ NA SALA NÃO MANDA NO BONECO.
  //
  // Desde que a app nasce vazia (v3.32) o palco vem desligado, mas as MEDIDAS
  // dele continuam escritas -- e isto lia as medidas, não a sala. O orador
  // ficava preso ao retângulo de um palco invisível e 1 m no ar, em cima de
  // nada. Reportado assim: *"lá anda o boneco, que não consigo movê-lo para
  // onde quero"* -- e não conseguia mesmo: estava preso a uma coisa que ele
  // não via e não tinha pedido.
  const noPalco = $("verPalco").checked && palco.altura > 0 && palco.profundidade > 0;
  const larguraPalco = Math.min(palco.largura || sala.largura, sala.largura);
  const limiteX = (noPalco ? larguraPalco : sala.largura) / 2 - 0.4;
  const fundoZ = -sala.profundidade / 2 + 0.5;
  const frenteZPalco = noPalco
    ? frenteDoPalco(sala, palco).z - 0.3
    : sala.profundidade / 2 - 0.5;

  // A passarela prolonga o palco -- sem isto o orador ficava sempre preso à
  // boca de cena, sem conseguir andar por cima dela ("o prop não vai à
  // passarela"). Só se estica o limite se o rato já está alinhado com a
  // largura dela; senão continua-se preso à borda do palco como sempre.
  const passarela = lerPassarela();
  const zonaPass = noPalco && passarela.ligada ? zonaDaPassarela(sala, palco, passarela) : null;
  // Com o desvio da pega (ver o pointerdown): é o ponto do chão mais o desvio
  // que a figura persegue, não o ponto do chão.
  const pedidoX = ondeCaiu.x + desvioArrasto.x, pedidoZ = ondeCaiu.z + desvioArrasto.z;
  const frenteZ = (zonaPass && Math.abs(pedidoX - zonaPass.dx) < zonaPass.largura / 2 - 0.2)
    ? Math.max(frenteZPalco, zonaPass.zMax - 0.3)
    : frenteZPalco;
  const z = Math.max(fundoZ, Math.min(frenteZ, pedidoZ));

  // E já em cima dela (para lá da borda do palco), a largura livre passa a
  // ser só a da passarela -- não dá para "flutuar" ao lado dela, por cima da
  // plateia.
  const emCimaDaPassarela = zonaPass && z > frenteZPalco;
  const limiteXEsq = emCimaDaPassarela ? zonaPass.dx - (zonaPass.largura / 2 - 0.2) : -limiteX;
  const limiteXDir = emCimaDaPassarela ? zonaPass.dx + (zonaPass.largura / 2 - 0.2) : limiteX;

  // Fora de qualquer tampo (o rato foi para o chão, ou para fora da borda):
  // os limites de sempre, do palco principal e da passarela.
  figura.position.x = Math.max(limiteXEsq, Math.min(limiteXDir, pedidoX));
  figura.position.z = z;
  figura.position.y = noPalco ? palco.altura : 0;
  figura.updateMatrixWorld(true);
  ondeEsta = { x: figura.position.x, z: figura.position.z };
  medirSombra();
  atualizarMarcasDoBlend();
  atualizarNotaDaCupula();
});

function largarFigura(e) {
  if (!aArrastar) return;
  aArrastar = false;
  aMoverQuem = null;
  controlos.enabled = true;
  tela.style.cursor = "";
  try { tela.releasePointerCapture(e.pointerId); } catch (_) {}
}
tela.addEventListener("pointerup", largarFigura);
tela.addEventListener("pointercancel", largarFigura);

// ------------------------------------------------ arrastar gomos/delays/DSM/régie
//
// Pedido direto: arrastar em vez de só ter campos numéricos. Reaproveita a
// mesma ideia do arrastar do orador (raio + plano horizontal), mas em cima
// de qualquer objeto com uma posição própria -- um gomo (nome "gomo-N", só
// quando "Circular" está ligado), uma zona delay (nome "zona NOME", só se
// tiver entrada em ajustes.delays -- uma zona LED não se arrasta, a posição
// dela vem toda do conjunto lá dos Calculadores), um DSM (nome "dsm N") ou
// a régie (nome "regie"). A posição muda ao vivo durante o arrasto -- e
// como é a MESMA fonte que os campos numéricos leem e escrevem (o objeto
// do ajuste, ou os campos regieX/regieZ), eles acompanham-se sozinhos a
// seguir a um remontar, sem código à parte.
//
// Dois "alvos" possíveis, por trás da mesma interface (getXZ/setXZ): um
// gomo/delay/DSM guarda dx/dz num objeto próprio (ajustes.*); a régie não
// tem ajuste nenhum -- a posição dela são os campos regieX/regieZ do
// formulário, como o palco. alvoDeCampos() escreve lá e dispara "input",
// que já é o que faz o resto da app reagir a um campo escrito à mão.

const apontadorAjuste = new THREE.Raycaster();
const ratoAjuste = new THREE.Vector2();
const planoAjuste = new THREE.Plane();
const ondeCaiuAjuste = new THREE.Vector3();
let alvoArrasto = null;

function alvoDeAjuste(ajuste) {
  return {
    getXZ: () => ({ x: Number(ajuste.dx) || 0, z: Number(ajuste.dz) || 0 }),
    setXZ: (x, z) => { ajuste.dx = x; ajuste.dz = z; },
    // O objeto dos ajustes, para o painel flutuante poder escrever nele os
    // mesmos campos que a lista do painel já escreve -- ver painelDeAjuste().
    ajuste: ajuste
  };
}

function alvoDeCampos(idX, idZ) {
  return {
    getXZ: () => ({ x: parseFloat($(idX).value) || 0, z: parseFloat($(idZ).value) || 0 }),
    setXZ: (x, z) => {
      $(idX).value = String(Math.round(x * 1e6) / 1e6);
      $(idZ).value = String(Math.round(z * 1e6) / 1e6);
      $(idX).dispatchEvent(new Event("input", { bubbles: true }));
      $(idZ).dispatchEvent(new Event("input", { bubbles: true }));
    },
    ajuste: ajusteSobreCampos({ dx: idX, dz: idZ })
  };
}

/**
 * Os CAMPOS DO PAINEL vistos como um objeto de ajustes.
 *
 * Nem tudo o que se arrasta tem um objeto de ajustes próprio: a régie e o
 * primeiro projetor saem de campos do painel. O painel flutuante não precisa
 * de saber a diferença -- o campoAjuste() escreve em `alvo[chave]`, e um
 * objeto com getters/setters que dão nesses campos serve na mesma. Uma
 * implementação só, e o que se escreve no flutuante aparece no painel e
 * vice-versa, porque é o mesmo campo.
 */
function ajusteSobreCampos(mapa) {
  const obj = {};
  Object.keys(mapa).forEach((chave) => {
    Object.defineProperty(obj, chave, {
      enumerable: true,
      get() { return parseFloat($(mapa[chave]).value) || 0; },
      set(v) {
        $(mapa[chave]).value = String(Math.round((Number(v) || 0) * 1e6) / 1e6);
        $(mapa[chave]).dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });
  return obj;
}

// O projetor não guarda x/z directamente -- a posição sai de "lateral" e
// "distância" somada a z0 (a mesma conta que desenharProjecao() já faz).
// z0 recalcula-se aqui outra vez, tal como publicoAtual já é recalculado
// em objetosArrastaveis() a cada arrastar -- não vale a pena guardá-lo.
function alvoDeCamposProjetor(sala) {
  const z0 = -sala.profundidade / 2 + 0.35;
  return {
    getXZ: () => ({ x: parseFloat($("projLateral").value) || 0, z: z0 + (parseFloat($("projDist").value) || 0) }),
    setXZ: (x, z) => {
      $("projLateral").value = String(Math.round(x * 1e6) / 1e6);
      $("projDist").value = String(Math.round(Math.max(0.1, z - z0) * 1e6) / 1e6);
      $("projLateral").dispatchEvent(new Event("input", { bubbles: true }));
      $("projDist").dispatchEvent(new Event("input", { bubbles: true }));
    }
  };
}

// A mesma ideia, mas para um projetor extra (Fase 6, blending) -- guarda
// lateral/distancia directamente no ajuste, em vez de nos campos
// #projLateral/#projDist (que só existem para a instância #0).
function alvoDeProjetorExtra(sala, ajuste) {
  const z0 = -sala.profundidade / 2 + 0.35;
  return {
    getXZ: () => ({ x: Number(ajuste.lateral) || 0, z: z0 + (Number(ajuste.distancia) || 0) }),
    setXZ: (x, z) => {
      ajuste.lateral = x;
      ajuste.distancia = Math.max(0.1, z - z0);
    },
    ajuste: ajuste
  };
}

// Que campos é que cada coisa tem para ajustar. Os mesmos nomes, passos e
// limites da lista do painel -- é a mesma campoAjuste() a desenhá-los, para
// não haver dois sítios a discordar sobre o que é "rodar" ou quanto anda uma
// seta.
const CAMPOS_POSICAO = [
  { rotulo: "↔", chave: "dx", unidade: "m", passo: "0.05" },
  { rotulo: "fundo", chave: "dz", unidade: "m", passo: "0.05" },
  { rotulo: "altura", chave: "dy", unidade: "m", passo: "0.05" },
  { rotulo: "rodar", chave: "rot", unidade: "°", passo: "5", min: -180, max: 180 }
];
const CAMPOS_SO_XZ = [
  { rotulo: "↔", chave: "dx", unidade: "m", passo: "0.05" },
  { rotulo: "fundo", chave: "dz", unidade: "m", passo: "0.05" }
];
const CAMPOS_PROJETOR = [
  { rotulo: "↔", chave: "lateral", unidade: "m", passo: "0.05" },
  { rotulo: "distância", chave: "distancia", unidade: "m", passo: "0.05", min: 0.1 },
  { rotulo: "altura", chave: "altura", unidade: "m", passo: "0.05" }
];

/**
 * O ECRÃ CURVO, agarrável como tudo o resto.
 *
 * Os campos da posição dele existem desde a v3.35, mas numa secção do painel:
 * quem estava a olhar para a sala carregava no pano e não acontecia nada.
 * Reportado a seguir ao boneco: *"e não tenho como ajustar o ecrã também"*.
 * Agora é um alvo como os outros -- arrasta-se, e o painel flutuante abre com
 * o ↔, o fundo e a base. São os mesmos campos do painel lateral, não uma
 * segunda cópia deles.
 */
function alvoDoEcraCurvo() {
  return {
    ...alvoDeCampos("curvaDx", "curvaDz"),
    ajuste: ajusteSobreCampos({ dx: "curvaDx", dz: "curvaDz", base: "curvaBase" })
  };
}

const CAMPOS_ECRA_CURVO = [
  { rotulo: "↔", chave: "dx", unidade: "m", passo: "0.25" },
  { rotulo: "fundo", chave: "dz", unidade: "m", passo: "0.25" },
  { rotulo: "base", chave: "base", unidade: "m", passo: "0.1" }
];

function objetosArrastaveis() {
  if (!desenhado) return [];
  const publicoAtual = lerPublico();
  const alvos = [];
  desenhado.traverse((o) => {
    if (!o.name) return;
    if (publicoAtual.formato === "circular" && o.name.indexOf("gomo-") === 0) {
      const i = parseInt(o.name.slice(5), 10);
      if (ajustes.gomos[i]) alvos.push({ obj: o, rotulo: "Gomo " + (i + 1), campos: CAMPOS_POSICAO, ...alvoDeAjuste(ajustes.gomos[i]) });
    } else if (o.name.indexOf("zona ") === 0) {
      const aj = ajustes.delays[o.name.slice(5)];
      if (aj) alvos.push({ obj: o, rotulo: o.name.slice(5), campos: CAMPOS_POSICAO, ...alvoDeAjuste(aj) });
    } else if (o.name.indexOf("dsm ") === 0) {
      const aj = ajustes.dsm[parseInt(o.name.slice(4), 10) - 1];
      if (aj) alvos.push({ obj: o, rotulo: "DSM " + o.name.slice(4), campos: CAMPOS_POSICAO, ...alvoDeAjuste(aj) });
    } else if (o.name === "ecra-curvo") {
      alvos.push({ obj: o, rotulo: "Ecrã curvo", campos: CAMPOS_ECRA_CURVO, ...alvoDoEcraCurvo() });
    } else if (o.name === "palco" && o.isMesh) {
      // Só a malha: fazerPalco() devolve um grupo com o MESMO nome lá dentro,
      // e sem isto o palco entrava duas vezes na lista de agarráveis.
      // O PALCO PRINCIPAL, agora também à mão. Os palcos EXTRA já se
      // arrastavam desde que existem; este nunca -- e era o único que
      // interessava com uma planta por baixo.
      //
      // Os campos são um DESLOCAMENTO (0 = encostado ao fundo, centrado) e não
      // uma coordenada do mundo como os da régie. Serve à mesma: o arrasto é
      // todo por deltas (x0 + o que o rato andou), e um deslocamento difere de
      // uma coordenada por uma constante -- os deltas são os mesmos.
      alvos.push({ obj: o, rotulo: "Palco", campos: CAMPOS_SO_XZ, ...alvoDeCampos("palcoX", "palcoZ") });
    } else if (o.name === "regie") {
      alvos.push({ obj: o, rotulo: "Régie", campos: CAMPOS_SO_XZ, ...alvoDeCampos("regieX", "regieZ") });
    } else if (o.name === "projetor-0") {
      alvos.push({ obj: o, rotulo: "Projetor", campos: CAMPOS_SO_XZ, ...alvoDeCamposProjetor(lerSala()) });
    } else if (o.name.indexOf("palco-") === 0) {
      const i = parseInt(o.name.slice(6), 10) - 1;
      if (ajustes.palcosExtra[i]) alvos.push({ obj: o, rotulo: "Palco " + (i + 1), campos: CAMPOS_POSICAO, ...alvoDeAjuste(ajustes.palcosExtra[i]) });
    } else if (o.name.indexOf("regie-") === 0) {
      const i = parseInt(o.name.slice(6), 10) - 1;
      if (ajustes.regiesExtra[i]) alvos.push({ obj: o, rotulo: "Régie " + (i + 1), campos: CAMPOS_POSICAO, ...alvoDeAjuste(ajustes.regiesExtra[i]) });
    } else if (o.name.indexOf("passarela-") === 0) {
      const i = parseInt(o.name.slice(10), 10) - 1;
      if (ajustes.passarelasExtra[i]) alvos.push({ obj: o, rotulo: "Passarela " + (i + 1), campos: CAMPOS_POSICAO, ...alvoDeAjuste(ajustes.passarelasExtra[i]) });
    } else if (o.name.indexOf("projetor-") === 0) {
      // Num ecrã CURVO a posição de cada máquina não é dela: sai do arco (a
      // fatia que lhe toca e a distância da fila). Arrastar escrevia um
      // lateral/distância que o desenho curvo nem olha -- a caixa ia atrás do
      // rato e voltava ao sítio no desenho seguinte, calada. Mais vale não
      // pegar nela: quem quiser mexer mexe na distância ou na curva.
      if (curvaAtivaDoBlend()) return;
      const i = parseInt(o.name.slice(9), 10) - 1;
      if (ajustes.projetoresExtra[i]) alvos.push({ obj: o, rotulo: "Projetor " + (i + 1), campos: CAMPOS_PROJETOR, ...alvoDeProjetorExtra(lerSala(), ajustes.projetoresExtra[i]) });
    }
  });
  return alvos;
}

/**
 * O PAINEL DE AJUSTE, onde a coisa está.
 *
 * Pedido direto: *"numa situação destas, onde ajusto a posição dos elementos
 * com números, poderia saltar um painel de ajuste"*. Os campos já existiam --
 * ↔, fundo, altura, rodar -- mas viviam numa lista lá em baixo no painel, e
 * para afinar dois centímetros do que se acabou de arrastar era preciso ir
 * procurar a linha certa. O arrasto põe a peça perto; os números põem-na no
 * sítio, e não faz sentido que morem em pontos opostos do ecrã.
 *
 * Os campos são os MESMOS: a campoAjuste() que a lista usa, sobre o mesmo
 * objeto de ajustes. Escrever aqui é escrever lá -- não há dois valores, há
 * dois sítios a mostrar o mesmo.
 */
function abrirPainelDeAjuste(alvo) {
  const caixa = $("painelAjuste");
  if (!caixa || !alvo || !alvo.ajuste || !alvo.campos) return;
  caixa.innerHTML = "";
  const topo = document.createElement("div");
  topo.className = "ajuste-flutuante-topo";
  const nome = document.createElement("b");
  nome.textContent = alvo.rotulo || "Ajustar";
  const fechar = document.createElement("button");
  fechar.type = "button";
  fechar.className = "btn-icone";
  fechar.title = "Fechar";
  fechar.textContent = "×";
  fechar.addEventListener("click", fecharPainelDeAjuste);
  topo.append(nome, fechar);
  caixa.append(topo);
  const campos = document.createElement("div");
  campos.className = "campos";
  const inputs = [];
  alvo.campos.forEach((c) => {
    const campo = campoAjuste(c.rotulo, alvo.ajuste, c.chave, c.unidade, c.passo,
      undefined, c.min === undefined ? -500 : c.min, c.max === undefined ? 500 : c.max);
    inputs.push({ input: campo.querySelector("input"), chave: c.chave });
    campos.append(campo);
  });
  caixa.append(campos);
  caixa.hidden = false;
  painelDeAjusteAberto = { alvo, inputs };
}

/**
 * Arrastar muda os mesmos números que o painel mostra -- se ele não os
 * acompanhar, fica a dizer onde a peça ESTAVA. Escreve-se no `value` em vez
 * de refazer o painel: refazê-lo a cada movimento tirava o foco a quem
 * estivesse a escrever num campo.
 */
function refrescarPainelDeAjuste() {
  if (!painelDeAjusteAberto) return;
  const { alvo, inputs } = painelDeAjusteAberto;
  inputs.forEach(({ input, chave }) => {
    if (document.activeElement === input) return;   // não pisar quem escreve
    const v = Number(alvo.ajuste[chave]) || 0;
    input.value = String(Math.round(v * 100) / 100);
  });
}

function fecharPainelDeAjuste() {
  const caixa = $("painelAjuste");
  if (!caixa) return;
  caixa.hidden = true;
  caixa.innerHTML = "";
  painelDeAjusteAberto = null;
}
let painelDeAjusteAberto = null;

function porRatoAjuste(e) {
  const caixa = tela.getBoundingClientRect();
  ratoAjuste.set(
    ((e.clientX - caixa.left) / caixa.width) * 2 - 1,
    -((e.clientY - caixa.top) / caixa.height) * 2 + 1);
}

tela.addEventListener("pointerdown", (e) => {
  if (!edicaoLivreLigada()) return;   // cadeado fechado: só a câmara mexe
  if (aArrastar) return;              // já vai o orador
  const alvos = objetosArrastaveis();
  if (!alvos.length) return;
  porRatoAjuste(e);
  apontadorAjuste.setFromCamera(ratoAjuste, camara);
  let melhor = null, melhorDist = Infinity;
  for (const alvo of alvos) {
    const hits = apontadorAjuste.intersectObject(alvo.obj, true);
    if (hits.length && hits[0].distance < melhorDist) {
      melhorDist = hits[0].distance;
      melhor = { alvo, ponto: hits[0].point };
    }
  }
  if (!melhor) { fecharPainelDeAjuste(); return; }

  abrirPainelDeAjuste(melhor.alvo);
  controlos.enabled = false;
  tela.setPointerCapture(e.pointerId);
  planoAjuste.set(new THREE.Vector3(0, 1, 0), -melhor.ponto.y);
  const inicial = melhor.alvo.getXZ();
  alvoArrasto = {
    alvo: melhor.alvo,
    x0: inicial.x, z0: inicial.z,
    px0: melhor.ponto.x, pz0: melhor.ponto.z
  };
  tela.style.cursor = "grabbing";
});

tela.addEventListener("pointermove", (e) => {
  if (!alvoArrasto) return;
  porRatoAjuste(e);
  apontadorAjuste.setFromCamera(ratoAjuste, camara);
  if (!apontadorAjuste.ray.intersectPlane(planoAjuste, ondeCaiuAjuste)) return;
  const novoX = alvoArrasto.x0 + (ondeCaiuAjuste.x - alvoArrasto.px0);
  const novoZ = alvoArrasto.z0 + (ondeCaiuAjuste.z - alvoArrasto.pz0);
  alvoArrasto.alvo.setXZ(novoX, novoZ);
  refrescarPainelDeAjuste();
  remontarDaqui(0);
});

function largarAjuste(e) {
  if (!alvoArrasto) return;
  // AO LARGAR, ARREDONDA AO CENTÍMETRO. Um arrasto deixa valores como
  // 28,957212 m, e o painel a mostrá-los faz um número que ninguém escreveu
  // parecer uma medida. Arredonda-se o VALOR, não só o que se mostra: mostrar
  // 28,96 e guardar 28,957212 era pôr o painel a mentir por dois dígitos.
  const onde = alvoArrasto.alvo.getXZ();
  alvoArrasto.alvo.setXZ(Math.round(onde.x * 100) / 100, Math.round(onde.z * 100) / 100);
  refrescarPainelDeAjuste();
  guardarAjustes(ajustes);
  alvoArrasto = null;
  controlos.enabled = true;
  tela.style.cursor = "";
  try { tela.releasePointerCapture(e.pointerId); } catch (_) {}
}
tela.addEventListener("pointerup", largarAjuste);
tela.addEventListener("pointercancel", largarAjuste);

// ----------------------------------------------------------------- exportar
//
// Isto desenha volumes e cores; quem faz a imagem bonita trabalha noutro sitio.
// A ponte e um ficheiro com as pecas todas no sitio e com o nome certo -- e o
// nome e a parte que interessa, porque e por ele que, no Cinema 4D, se escolhe
// a zona a que se vai por a textura de verdade.

function nomeDoFicheiro(extensao) {
  const quando = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "h");
  const nome = (projeto && projeto.nome ? projeto.nome : "preview")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${nome || "preview"}-${quando}.${extensao}`;
}

async function exportar(formato, soACupula) {
  const nota = $("notaExportar");
  if (!desenhado) return;

  // "Só a cúpula" não precisa de nada do que vem a seguir: não há ecrãs a
  // reconstruir nem público a decidir, é uma superfície e mais nada.
  if (soACupula) {
    if (!(projeto && projeto.dome)) { nota.textContent = "Este projeto não traz cúpula."; return; }
    // Duas formas: a cúpula TOTAL ou só a ÁREA DE PROJEÇÃO (do zénite até
    // onde a imagem chega). As duas constroem-se à PARTE da cena, com os UV
    // do dome master inteiro -- ver fazerCascaDeProjecao().
    //
    // A total era COPIADA da cena, e isso deixou de servir quando o conteúdo
    // passou a ser cortado na base da imagem: com um logo carregado, a casca
    // da cena está cortada e a "total" saía cortada com ela. Construída
    // aqui, também já não depende de a cúpula estar ligada na secção Vista.
    const soProjecao = $("expSoProjecao") && $("expSoProjecao").checked;
    const recorte = fazerCascaDeProjecao(projeto.dome, !soProjecao);
    if (!recorte) { nota.textContent = "Não consegui construir a superfície da cúpula."; return; }
    const raiz = new THREE.Group();
    raiz.add(recorte.malha);
    raiz.updateMatrixWorld(true);
    const soDome = prepararParaExportar({ traverse: (cb) => raiz.traverse(cb) }, { soACupula: true });
    const temporarios = [recorte.malha];
    const libertar = () => temporarios.forEach((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    const peso = pesar(soDome);
    if (!peso.pecas) {
      libertar();
      nota.textContent = "Não encontrei a superfície da cúpula.";
      return;
    }
    try {
      const blob = formato === "glb" ? await comoGLB(soDome) : comoOBJ(soDome);
      const sufixo = soProjecao ? "-dome-projecao" : "-dome";
      descarregar(blob, nomeDoFicheiro(formato).replace(/\.(obj|glb)$/, sufixo + ".$1"));
      nota.innerHTML =
        `Guardado: <b>${soProjecao ? "a área de projeção" : "a cúpula total"}</b>, ` +
        `${(peso.vertices / 1000).toFixed(0)} mil vértices, ` +
        `<b>${(blob.size / 1048576).toFixed(2)} MB</b> — em metros, com os UV do dome master.` +
        (!soProjecao ? "" : (!recorte.inteira
          ? ` Cortada a ${recorte.thetaChaoGraus.toFixed(0)}° do zénite (a imagem começa a ${recorte.yBase.toFixed(2)} m do chão); ` +
            `os UV são os do dome master inteiro, por isso a imagem cai no mesmo sítio que na cúpula total.`
          : " Sem um anel de projetores com altura de montagem escrita, a área de projeção é a cúpula toda.")) +
        (formato === "obj" ? " Sem materiais, que o .obj não os leva." : "") +
        " As normais apontam para FORA: se o teu programa quiser a face de dentro, inverte-as lá.";
    } catch (e) {
      nota.textContent = e.message;
    } finally {
      libertar();
    }
    return;
  }

  // O interruptor "Ecrãs" da secção Vista serve para olhar para a sala vazia
  // -- não é uma decisão sobre o que sai no ficheiro. Sem isto, desligá-lo um
  // instante (para medir uma parede, por exemplo) e esquecer de o voltar a
  // ligar tirava os ecrãs e o DSM do .glb sem nenhum aviso a dizer porquê:
  // parecia um defeito na exportação, quando era só um interruptor esquecido.
  // Por isso a exportação constrói-os sempre de novo aqui, à parte da cena
  // visível, sem tocar no que está ligado no ecrã.
  let paraExportar = desenhado;
  const temZonasOuDsm = projeto && ((projeto.zonas && projeto.zonas.length) || (projeto.dsm && projeto.dsm.n));
  const extra = [];
  if (temZonasOuDsm && !$("verEcras").checked) {
    const salaAtual = lerSala(), palcoAtual = lerPalco();
    const paraExportar = projetoMontado(projeto);
    if (paraExportar.zonas.length) {
      extra.push(fazerZonas(paraExportar, totais(paraExportar), salaAtual, palcoAtual, textura, modoConteudo, ajustes.delays, texturasPorZona).grupo);
    }
    if (paraExportar.dsm) {
      extra.push(fazerDSM(paraExportar.dsm, salaAtual, palcoAtual, ajustes.dsm, textura).grupo);
    }
    paraExportar = { traverse(cb) { desenhado.traverse(cb); extra.forEach((g) => g.traverse(cb)); } };
  }

  const grupo = prepararParaExportar(paraExportar, {
    comPublico: $("expPublico").checked,
    comLinhas: $("expLinhas").checked
  });
  // Os grupos extra nunca entraram na cena — só existiram para a exportação.
  // A libertação fica para depois de escrever o ficheiro: o grupo preparado
  // partilha geometria e materiais com estes temporários.
  const libertarExtra = () => extra.forEach((g) => g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  }));
  const { vertices, pecas } = pesar(grupo);
  if (!pecas) {
    libertarExtra();
    nota.textContent = "Não há nada para exportar.";
    return;
  }

  // Quatrocentas pessoas assadas em geometria a serio sao muitos megabytes, e
  // o browser fica calado enquanto os escreve. Mais vale dizer que esta a
  // trabalhar do que parecer que o botao nao fez nada.
  nota.textContent = `A escrever ${pecas} peças…`;
  try {
    const blob = formato === "glb" ? await comoGLB(grupo) : comoOBJ(grupo);
    descarregar(blob, nomeDoFicheiro(formato));
    const ecrasExportados = projeto ? projeto.zonas.length : 0;
    nota.innerHTML =
      `Guardado: <b>${pecas}</b> peças, ${(vertices / 1000).toFixed(0)} mil vértices, ` +
      `<b>${(blob.size / 1048576).toFixed(1)} MB</b>` +
      (ecrasExportados ? ` — <b>${ecrasExportados} ecrãs</b>.` : ".") +
      (formato === "obj" ? " O .obj vai sem materiais — as cores põem-se do outro lado." : "");
  } catch (e) {
    nota.textContent = e.message;
  } finally {
    libertarExtra();
  }
}

// Escolhe-se o que sai e só depois se guarda -- em vez de haver um botão por
// formato, cada um a disparar de imediato. Com quatro saídas e duas opções que
// só valem para duas delas, um botão por formato passa a ser um campo minado:
// carrega-se no errado e vai-se buscar o ficheiro à pasta das descargas para
// perceber que não era aquele.
let saidaEscolhida = "png";

const NOTAS_DA_SAIDA = {
  "png": "A vista como está no ecrã, tal e qual — para entrar num slide ou num email.",
  "png-medidas": "A vista com as etiquetas e uma tira com as contas em baixo — " +
                 "para mandar a quem tem de decidir.",
  "relatorio": "Uma <b>página</b> com o que está no ecrã: a vista, as medidas da sala, as " +
         "coordenadas de montagem, os ajustes feitos aqui e o que ficou por montar. Abre em " +
         "qualquer browser <b>sem a app e sem internet</b>, e imprime em A4 — é para levar " +
         "para a obra ou anexar a um email.",
  "glb": "O <b>.glb</b> leva as cores e o nome de cada zona — é por esse nome que se lhe " +
         "põe a textura no Cinema 4D ou no Blender.",
  "obj": "O <b>.obj</b> abre em tudo, mas vai <b>sem materiais</b>: as peças chegam lá " +
         "cinzentas e pintam-se à mão.",
  // O WATCHOUT 7 importa .obj, .gltf/.glb e .3ds, e exige UV para 3D mapping
  // (docs.dataton.com/watchout-7/3d/models.html) -- por isso estes dois
  // formatos bastam, e é por isso que a cúpula leva sempre UV.
  "dome-obj": "Só a <b>superfície da cúpula</b>, em metros, com os UV do dome master " +
              "(zénite ao centro, horizonte na borda). Entra no <b>WATCHOUT</b>, que " +
              "importa .obj, .glb e .3ds e <b>exige UV para 3D mapping</b>. " +
              "Sem sala, sem público, sem projetores.<br>Duas formas: <b>total</b> ou " +
              "<b>só a área de projeção</b> (corta a banda que não leva imagem — mapear " +
              "essa banda é mapear para o vazio).",
  "dome-glb": "O mesmo que o .obj só da cúpula, em glTF — que o WATCHOUT também importa, " +
              "e que ao contrário do .obj leva nomes e materiais.<br>Com <b>só a área de " +
              "projeção</b>, sai a cúpula sem a banda de baixo que não leva imagem — os UV " +
              "são os mesmos, por isso a imagem cai no mesmo sítio."
};

function escolherSaida(qual) {
  saidaEscolhida = qual;
  document.querySelectorAll("[data-saida]").forEach(b => {
    b.classList.toggle("destaque", b.dataset.saida === qual);
  });
  // As opções são de quem as pode usar: um PNG não leva público nem planta CAD
  // "incluídos", leva o que estiver no ecrã.
  const eTresD = qual === "glb" || qual === "obj";
  $("opcaoPublico").hidden = !eTresD;
  $("opcaoLinhas").hidden = !eTresD;
  // "Só a área de projeção" é só das saídas da cúpula.
  if ($("opcaoSoProjecao")) $("opcaoSoProjecao").hidden = !(qual === "dome-obj" || qual === "dome-glb");
  $("notaExportar").innerHTML = NOTAS_DA_SAIDA[qual] || "";
}

document.querySelectorAll("[data-saida]").forEach(b => {
  b.onclick = () => escolherSaida(b.dataset.saida);
});
escolherSaida("png");

$("btGuardar").onclick = () => {
  // Saiu alguma coisa daqui. É o momento que diz que a app não foi só aberta
  // -- produziu qualquer coisa que alguém levou para outro lado. Qual dos
  // formatos foi NÃO se conta: era saber de mais sobre o trabalho de quem a
  // usa, e a pergunta é se serviu, não para quê ao certo.
  usoMarcar("exportar");
  if (saidaEscolhida === "png") guardarVista();
  else if (saidaEscolhida === "png-medidas") guardarImagem();
  else if (saidaEscolhida === "relatorio") guardarRelatorio();
  else if (saidaEscolhida === "planta-dxf") guardarPlantaDXF();
  else if (saidaEscolhida === "dome-obj") exportar("obj", true);
  else if (saidaEscolhida === "dome-glb") exportar("glb", true);
  else exportar(saidaEscolhida);
};

// ------------------------------------------------- o projetor dos Calculadores
//
// A mesma regra das zonas de LED: o catalogo de projetores e de lentes fica do
// lado de la, e o que atravessa e o resultado -- racio, distancia e formato.
// Aqui nao ha nem uma tabela de modelos nem uma conta de lentes.

function aplicarProjetor(p) {
  if (!p) return false;
  limitesDoShift = p.shift || null;
  $("projLigada").checked = true;
  $("projRacio").value = p.racio.toFixed(2);
  $("projDist").value = p.distancia.toFixed(2);
  if (p.formato > 0.2) {
    formatoImagem = p.formato;
    document.querySelectorAll("[data-formato]").forEach(b => {
      b.classList.toggle("destaque", Math.abs(parseFloat(b.dataset.formato) - p.formato) < 0.02);
    });
  }
  // Qual é a máquina fica GUARDADO, e não só escrito na nota: a nota
  // desaparece no recarregamento seguinte, e o relatório de montagem tem de
  // poder dizer "PT-RZ120 · ET-DLE060" amanhã de manhã em cima da obra. Os
  // extra do blend já guardavam o seu; era só o #0 que perdia o nome.
  if (p.modelo || p.lente) {
    ajustes.projetor = { modelo: p.modelo || "", lente: p.lente || "" };
    guardarAjustes(ajustes);
  }
  montar(false);
  const quem = [p.modelo, p.lente].filter(Boolean).join(" · ");
  $("notaProj").innerHTML =
    (quem ? `<b>${quem}</b><br>` : "") +
    `Veio dos Calculadores: rácio ${p.racio.toFixed(2)}:1 a ${p.distancia.toFixed(2)} m` +
    (p.largura ? `, para uma imagem de ${p.largura.toFixed(2)} m.` : ".") +
    (limitesDoShift
      ? ` Esta lente faz <b>${intervalo(limitesDoShift.vMin, limitesDoShift.vMax)} V</b> e ` +
        `<b>${intervalo(limitesDoShift.hMin, limitesDoShift.hMax)} H</b>` +
        (limitesDoShift.nota ? ` (${limitesDoShift.nota})` : "") + "."
      : " O fabricante não publica o shift desta lente, por isso ninguém verifica o que aqui se escrever.") +
    " A altura da lente é daqui — os Calculadores não a sabem.";
  return true;
}

/**
 * Um ou vários projetores de uma vez -- pedido direto ("o 3D não está a
 * trazer os projetores do projeto... Blending Multi-Projetor nunca manda
 * nada"). O primeiro aplica-se à instância #0 tal como sempre
 * (aplicarProjetor(), acima, sem mudar nada nela); os restantes ficam em
 * ajustes.projetoresExtra.
 *
 * Os Calculadores só sabem a geometria RELATIVA da grelha do blend (onde
 * cada projetor fica em relação aos outros) -- nunca a posição absoluta na
 * sala, essa continua "daqui" (ver aplicarProjetor()). Por isso lateral/
 * alturaOffset de cada extra somam-se ao que já estava na instância #0, em
 * vez de o substituírem.
 */
function aplicarProjetores(lista) {
  if (!lista || !lista.length) return false;
  // Uma máquina só é projeção; várias, ou uma curva, é um blend. A diferença
  // interessa: são dois trabalhos diferentes, e é isso que a contagem quer
  // saber (não quantas máquinas).
  usoMarcar(lista.length > 1 || lista.curva ? "blend" : "projecao");
  const primeiro = lista[0], resto = lista.slice(1);
  const anchorLateral = num("projLateral"), anchorAltura = num("projAltura");
  // Os offsets do blend vêm ABSOLUTOS, medidos a partir do centro do ecrã:
  // num blend de três, as células são -6, 0, +6. Mas o primeiro projetor fica
  // no ÂNCORA que está escrito aqui no Preview (a posição física da máquina,
  // que os Calculadores não sabem), por isso os outros têm de ser colocados
  // relativamente a ELE e não ao centro do ecrã.
  //
  // Somar o offset absoluto ao âncora punha o segundo projetor exactamente em
  // cima do primeiro: com as células a -6, 0, +6 e o âncora a 0, dava 0, 0 e
  // +6 em vez de 0, +6 e +12. Só apareceu quando as posições passaram a ser
  // escritas como coordenadas -- no desenho, dois projetores sobrepostos
  // parecem um só.
  const baseLateral = primeiro.lateral || 0;
  const baseAltura = primeiro.alturaOffset || 0;

  // NUM ECRÃ CURVO a posição não é "a tantos metros do primeiro": é o ângulo
  // que cada máquina ocupa no arco, e esse não se mede a partir de um âncora
  // que alguém escreveu aqui -- mede-se a partir do meio do ecrã, porque é a
  // curva que manda. Por isso o caso curvo guarda TODAS as máquinas (a
  // primeira incluída) com a posição delas ao longo do arco, e o lateral do
  // campo deixa de contar: um arco concêntrico deslocado para o lado já não
  // é concêntrico.
  ajustes.curvaDoBlend = lista.curva || null;
  // De que lado do pano estão as máquinas. Guardado à parte da curva porque um
  // ecrã PLANO em retro também existe e não tem curva nenhuma onde se pendurar.
  ajustes.retroDoBlend = lista.retro === true;
  if (lista.curva) {
    ajustes.projetoresExtra = lista.map((p) => ({
      racio: p.racio, distancia: p.distancia,
      arco: p.lateral || 0,
      // O OFFSET, não a altura absoluta. A altura da fila é do campo e tem de
      // continuar a ser: congelada aqui, subir o ecrã com "levar os projetores"
      // ligado subia o pano e deixava a fila onde estava. É a mesma decisão que
      // já se tinha tomado para a distância e para o shift -- o campo manda, e
      // cada máquina guarda só o que a distingue das outras.
      alturaOffset: (p.alturaOffset || 0) - baseAltura,
      modelo: p.modelo, lente: p.lente
    }));
  } else {
    ajustes.projetoresExtra = resto.map((p) => ({
      racio: p.racio, distancia: p.distancia,
      lateral: anchorLateral + ((p.lateral || 0) - baseLateral),
      // O OFFSET, não a altura absoluta -- ver o comentário no desenho.
      alturaOffset: (p.alturaOffset || 0) - baseAltura,
      // Sem shift próprio de propósito: toda a fila usa o do campo (ver montar()).
      modelo: p.modelo, lente: p.lente
    }));
  }
  guardarAjustes(ajustes);
  // O CAMPO "DISTÂNCIA" MEDE COISAS DIFERENTES NAS DUAS MONTAGENS, e tem de
  // nascer com a que corresponde. Em arco é o tiro, igual para todas. Em linha
  // reta é a distância da TRUSS ao ponto mais fundo do ecrã -- e aí o tiro de
  // cada máquina é maior ou menor do que isso conforme a fatia dela. Sem esta
  // troca, o campo nascia com o tiro da primeira máquina (10,40 m em vez dos
  // 12 m da truss) e o 3D desenhava a fila inteira encostada ao ecrã: fatias de
  // 9,3 m onde os Calculadores diziam 10,5 m.
  const cabeca = (lista.curva && lista.curva.montagem === "linha" && lista.curva.trussDistancia > 0)
    ? { ...primeiro, distancia: lista.curva.trussDistancia }
    : primeiro;
  // A ALTURA DA LENTE, quando os Calculadores a sabem. Era sempre "daqui", e
  // continua a ser num ecrã plano -- lá eles não fazem ideia de onde o pano
  // está pendurado. Num ecrã curvo passaram a saber: a altura vem medida da
  // BASE do ecrã, e a base é daqui. Somadas, dão a altura na sala sem ninguém
  // escrever o mesmo número duas vezes, e é o que faz o cone subir ou descer.
  if (lista.curva && lista.curva.altura > 0 && Number.isFinite(lista.curva.alturaLente)) {
    $("projAltura").value = (alturaDaBaseDoEcra() + lista.curva.alturaLente).toFixed(2);
    // E O SHIFT que essa altura obriga, calculado do outro lado. O campo
    // arrancava sempre a -25% e a imagem nascia meio metro abaixo do pano, com
    // a app a dizer ao mesmo tempo, na outra aba, que o shift devia ser 0%.
    if (Number.isFinite(lista.curva.shiftV)) $("projShiftV").value = lista.curva.shiftV;
  }
  const aplicou = aplicarProjetor(cabeca);   // este já chama montar() no fim
  if (aplicou && resto.length) {
    $("notaProj").innerHTML += lista.curva
      ? ` + ${resto.length} do blend, num ecrã curvo de ${nnum(lista.curva.raio)} m de raio` +
        (lista.curva.montagem === "linha"
          ? `, com as máquinas numa linha reta de ${nnum(lista.curva.trussLargura)} m.`
          : `, com as máquinas em arco.`)
      : ` + ${resto.length} do blend.`;
  }
  return aplicou;
}

/** "±58 %" quando é simétrico, "+45 % a +68 %" quando não é. */
function intervalo(min, max) {
  if (min === -max) return "±" + max + " %";
  return (min > 0 ? "+" : "") + min + " % a " + (max > 0 ? "+" : "") + max + " %";
}

/**
 * O shift que se pediu cabe na lente que veio de lá?
 *
 * Escrever +80% num sítio onde a lente vai a +58% desenha uma imagem que
 * ninguém consegue pôr ali — e o desenho passa a ser uma promessa que a sala
 * não cumpre. Quando não há limites publicados não se inventa nenhum: cala-se,
 * que é a única coisa honesta a fazer com um número que não se tem.
 */
function shiftForaDaLente() {
  if (!limitesDoShift) return null;
  const v = num("projShiftV"), h = num("projShiftH");
  const fora = [];
  if (v < limitesDoShift.vMin || v > limitesDoShift.vMax) {
    fora.push(`vertical ${v > 0 ? "+" : ""}${v} %, e a lente faz ` +
              `${intervalo(limitesDoShift.vMin, limitesDoShift.vMax)}`);
  }
  if (h < limitesDoShift.hMin || h > limitesDoShift.hMax) {
    fora.push(`horizontal ${h > 0 ? "+" : ""}${h} %, e a lente faz ` +
              `${intervalo(limitesDoShift.hMin, limitesDoShift.hMax)}`);
  }
  return fora.length ? fora.join("; ") : null;
}

$("btTrazerProjetor").onclick = () => {
  if (!aplicarProjetores(projetorGuardado())) {
    $("notaProj").innerHTML = "Ainda não veio nenhum projetor. Nos Calculadores, na aba " +
      "<b>Distância de Projeção</b>, carrega em <b>Ver no Preview 3D</b>.";
  }
};

/**
 * O botão do cabeçalho: força as duas pontes que vêm dos Calculadores
 * (projeto e projetor) de uma só vez.
 *
 * O evento "storage" já as traz sozinhas quando as duas apps estão abertas ao
 * mesmo tempo — mas é silencioso, e se por alguma razão não disparar (as
 * janelas não estavam as duas abertas no momento certo, por exemplo), fica
 * tudo na mesma sem ninguém saber que ficou por trazer. Isto dá sempre uma
 * resposta, mesmo que seja "não havia nada".
 */
$("btSincronizar").onclick = () => {
  const projetoTrazido = projetoGuardado();
  if (projetoTrazido) { marcarRecebidoDeFora(); carregar(projetoTrazido, false); }
  const projetorTrazido = aplicarProjetores(projetorGuardado());

  const aviso = $("aviso");
  if (projetoTrazido || projetorTrazido) {
    aviso.innerHTML = "Trazido dos Calculadores: " +
      [projetoTrazido ? "o projeto" : "", projetorTrazido ? "o projetor" : ""]
        .filter(Boolean).join(" e ") + ".";
  } else {
    aviso.textContent = "Não há nada guardado do lado dos Calculadores ainda.";
  }
  aviso.classList.add("mostra");
  setTimeout(() => aviso.classList.remove("mostra"), 3000);
};

/**
 * A MIGRAÇÃO, QUE NÃO PODE SER MUDA.
 *
 * Quem nunca tocou no interruptor tinha-o ligado sem saber. Virá-lo em silêncio
 * era deixá-lo a descobrir sozinho que o 3D deixou de receber -- o defeito que
 * esta app passa a vida a corrigir. Escreve-se o valor por extenso (deixa de
 * haver ausência para interpretar) e diz-se, uma vez só.
 */
function migrarSincronizacao() {
  try {
    if (localStorage.getItem(CHAVE_SINCRONIZACAO) != null) return false;
    if (localStorage.getItem(CHAVE_AVISO_SINC) === "1") return false;
    localStorage.setItem(CHAVE_SINCRONIZACAO, JSON.stringify("desligada"));
    localStorage.setItem(CHAVE_AVISO_SINC, "1");
    return true;
  } catch (_) { return false; }
}

/**
 * LIGAR TEM DE FAZER ALGUMA COISA.
 *
 * O botão só virava a chave: o 🔗 acendia, o título passava a dizer "o que
 * mudar nos Calculadores chega sozinho aqui", e o ecrã ficava exactamente na
 * mesma. Quem tinha um projeto à espera do outro lado ligava a sincronização e
 * não via nada — "está ligado, nada aparece" —, porque "o que MUDAR" é mesmo
 * só o que mudar a partir dali: o que já estava guardado não é uma mudança e
 * ninguém o vinha buscar.
 *
 * Com a sala VAZIA traz-se logo: não há nada para estragar, e é o que a
 * pessoa está à espera de ver. Com um projeto já montado não se toca em nada
 * — chegar e substituir o trabalho de alguém por causa de um interruptor era
 * bem pior — mas diz-se que está ali à espera e qual é o botão.
 */
function trazerOQueEstaAEsperaAoLigar() {
  let guardado = null;
  try { guardado = projetoGuardado(); } catch (_) { guardado = null; }
  const temProjetorAEspera = !!(projetorGuardado() || []).length;
  if (!guardado && !temProjetorAEspera) return;

  const salaVazia = !projeto || !Array.isArray(projeto.zonas) || !projeto.zonas.length;
  const aviso = $("aviso");
  if (salaVazia) {
    if (guardado) { marcarRecebidoDeFora(); carregar(guardado, true); }
    const veioProjetor = aplicarProjetores(projetorGuardado());
    const trouxe = [guardado ? "o projeto" : "", veioProjetor ? "o projetor" : ""].filter(Boolean);
    aviso.textContent = trouxe.length
      ? "Ligado — e trouxe o que estava à espera dos Calculadores: " + trouxe.join(" e ") + "."
      : "Ligado. O que estava guardado dos Calculadores não deu para ler — usa o 🔄 ao lado " +
        "ou volta a mandar do outro lado.";
  } else {
    aviso.textContent = "Ligado. Há " +
      [guardado ? "um projeto" : "", temProjetorAEspera ? "um projetor" : ""].filter(Boolean).join(" e ") +
      " guardado dos Calculadores — o 🔄 ao lado traz. Não trago sozinho para não " +
      "substituir o que já tens montado.";
  }
  aviso.classList.add("mostra");
  setTimeout(() => aviso.classList.remove("mostra"), 5000);
}

$("btSincronizacao").onclick = () => {
  const vaiLigar = !sincronizacaoAutomaticaLigada();
  try {
    // Mesmo formato que os Calculadores usam (JSON.stringify) — ver a nota em
    // sincronizacaoAutomaticaLigada() sobre porque isto tinha de ficar igual
    // dos dois lados.
    localStorage.setItem(CHAVE_SINCRONIZACAO,
      JSON.stringify(vaiLigar ? "ligada" : "desligada"));
  } catch (_) {}
  atualizarBotaoSincronizacao();
  if (vaiLigar) trazerOQueEstaAEsperaAoLigar();
};
atualizarBotaoSincronizacao();
if (migrarSincronizacao()) {
  atualizarBotaoSincronizacao();
  dizerNaCena("A app passou a abrir com a sincronização automática DESLIGADA, " +
    "para nada entrar nem sair sem tu pedires. O 🔗 aqui em cima liga-a.");
}

// ------------------------------------------------------------ dobrar o painel
//
// O painel cresceu -- sala, palco, publico, projecao, conteudo, planta,
// exportacao -- e tudo aberto e um metro de scroll ate aos botoes das vistas.
// Cada seccao fecha no titulo, e o que ficou fechado fica fechado: quem fecha
// a projecao uma vez nao a quer aberta na sessao seguinte.

(function dobras() {
  let guardadas = null;
  try { guardadas = JSON.parse(localStorage.getItem("preview-dobras") || "null"); } catch (_) {}
  // A primeira vez abrem TODAS fechadas: o painel passa a ser um indice de uma
  // vista de olhos, e abre-se o que se vai mexer. Depois disso manda o que
  // ficou aberto da ultima vez.
  const todas = [...document.querySelectorAll("#painel section > h2")]
    .map(t => t.parentElement.id).filter(Boolean);
  const fechadas = new Set(Array.isArray(guardadas) ? guardadas : todas);

  const guardar = () => {
    const agora = [...document.querySelectorAll("#painel section.fechada")].map(x => x.id);
    try { localStorage.setItem("preview-dobras", JSON.stringify(agora)); } catch (_) {}
  };

  document.querySelectorAll("#painel section > h2").forEach(titulo => {
    const seccao = titulo.parentElement;
    if (seccao.id && fechadas.has(seccao.id)) seccao.classList.add("fechada");
    titulo.addEventListener("click", () => {
      seccao.classList.toggle("fechada");
      guardar();
    });
  });
})();

// ---------------------------------------------------- o painel é elástico
//
// Com trinta camadas de um DWG na lista, 320 px deixaram de chegar. A largura
// fica guardada porque é uma preferência de quem trabalha, e não do desenho:
// quem alargou uma vez para ver nomes de camadas quer o painel assim da
// próxima. Dois cliques no puxador põem-no como estava.

const LARGURA_MINIMA = 240, LARGURA_MAXIMA = 900, LARGURA_NORMAL = 320;

function largurraDoPainel(px) {
  const largura = Math.round(Math.max(LARGURA_MINIMA, Math.min(LARGURA_MAXIMA, px)));
  document.documentElement.style.setProperty("--larguraPainel", largura + "px");
  try { localStorage.setItem("preview-largura-painel", String(largura)); } catch (_) {}
}

(function puxador() {
  const puxa = $("puxador");
  try {
    const guardada = parseInt(localStorage.getItem("preview-largura-painel") || "", 10);
    if (guardada) largurraDoPainel(guardada);
  } catch (_) {}

  puxa.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    puxa.setPointerCapture(e.pointerId);
    document.body.classList.add("a-puxar");
  });
  puxa.addEventListener("pointermove", (e) => {
    if (!document.body.classList.contains("a-puxar")) return;
    largurraDoPainel(e.clientX);
  });
  const largar = (e) => {
    if (!document.body.classList.contains("a-puxar")) return;
    document.body.classList.remove("a-puxar");
    try { puxa.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  puxa.addEventListener("pointerup", largar);
  puxa.addEventListener("pointercancel", largar);
  puxa.addEventListener("dblclick", () => largurraDoPainel(LARGURA_NORMAL));
})();

// ------------------------------------------- esconder o painel, e instalar

// A cena é o que interessa ver; o painel é para mexer e depois sair da frente.
// Fica guardado, porque quem o fecha uma vez costuma querê-lo fechado.
function painel(fechado) {
  document.body.classList.toggle("fechado", fechado);
  try { localStorage.setItem("preview-painel", fechado ? "fechado" : "aberto"); } catch (_) {}
}
$("btFechar").onclick = () => painel(true);
$("btAbrir").onclick = () => painel(false);
addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    painel(!document.body.classList.contains("fechado"));
  }
});
try {
  if (localStorage.getItem("preview-painel") === "fechado") painel(true);
} catch (_) {}

// --------------------------------------------------------- edição livre
//
// Pedido direto: rodar a vista mexe o rato exactamente por cima do orador,
// de um gomo, de um delay ou de um DSM — e desde que estes passaram a
// arrastar-se, um clique para rodar a câmara podia em vez disso arrastar
// algo sem se dar por isso. Este cadeado é só sobre ISSO: enquanto estiver
// fechado (por omissão), arrastar na cena roda/desloca só a câmara — os
// campos numéricos continuam a funcionar sempre, cadeado aberto ou
// fechado, porque esses nunca se mexem sem se querer. Fica guardado por
// aparelho (não é uma preferência para partilhar com os Calculadores).
const CHAVE_EDICAO_LIVRE = "preview-edicao-livre";
function edicaoLivreLigada() {
  if (modoVisualizacao) return false;   // um link partilhado nunca edita, cadeado ou não
  try { return localStorage.getItem(CHAVE_EDICAO_LIVRE) === "ligada"; } catch (_) { return false; }
}
function atualizarBotaoEdicaoLivre() {
  const botao = $("btEdicaoLivre");
  if (!botao) return;
  const ligada = edicaoLivreLigada();
  botao.classList.toggle("ligada", ligada);
  botao.textContent = ligada ? "🔓" : "🔒";
  botao.title = ligada
    ? "Edição livre ligada — arrastar na cena move o orador, um gomo, um delay ou um DSM. Clica para desligar."
    : "Edição livre desligada — arrastar na cena só muda a vista, nada se mexe sem querer. Clica para ligar.";
}
// Mesma guarda de "existe mesmo?" que #btRecentrarVista, pela mesma razão
// (HTML em cache vs. JS sempre fresco — ver comentário lá).
if ($("btEdicaoLivre")) $("btEdicaoLivre").onclick = () => {
  try { localStorage.setItem(CHAVE_EDICAO_LIVRE, edicaoLivreLigada() ? "desligada" : "ligada"); } catch (_) {}
  atualizarBotaoEdicaoLivre();
};
atualizarBotaoEdicaoLivre();

// O convite a instalar. O evento do Chrome não chega a toda a gente — no
// iPhone não existe de todo — por isso, quando ele não vem, explica-se o
// caminho à mão em vez de deixar a app sem forma de ser instalada.
(function convite() {
  const naApp = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (naApp) return;
  const agente = navigator.userAgent;
  const iPhone = /iPad|iPhone|iPod/.test(agente) && !window.MSStream;
  // Quem instala aplicações é o Chromium: Chrome, Edge, Brave, Opera, e o
  // Chrome no Android. O Firefox e o Safari de computador não o fazem de todo
  // — mandar essa gente ao "menu do browser" é mandá-la procurar o que lá não
  // está, e sair convencida de que a app não se instala.
  const chromium = /Chrome\/|Chromium\/|Edg\/|OPR\//.test(agente);
  let guardado = null;

  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    guardado = e;
    $("btInstalar").hidden = false;
    $("comoInstalar").hidden = true;
    $("btCopiarLink").hidden = true;
  });

  $("btInstalar").onclick = async () => {
    if (!guardado) return;
    guardado.prompt();
    await guardado.userChoice;
    guardado = null;
    $("btInstalar").hidden = true;
  };

  // O link e para levar daqui para um browser que instale -- e escrever um
  // endereco destes a mao e o caminho mais curto para desistir.
  $("btCopiarLink").onclick = async () => {
    const endereco = location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(endereco);
      $("btCopiarLink").textContent = "Link copiado";
      setTimeout(() => { $("btCopiarLink").textContent = "Copiar o link"; }, 2200);
    } catch (_) {
      $("btCopiarLink").textContent = endereco;   // sem permissao, fica a ler
    }
  };

  if (iPhone) {
    $("comoInstalar").textContent =
      "Para instalar: Partilhar ⬆︎ e depois \"Adicionar ao Ecrã Principal\".";
    $("comoInstalar").hidden = false;
  } else if (!chromium) {
    $("comoInstalar").innerHTML =
      "Este browser não instala aplicações — o Firefox e o Safari de computador " +
      "não o fazem. Abre esta página no <b>Chrome</b> ou no <b>Edge</b> e o botão de " +
      "instalar aparece aqui.";
    $("comoInstalar").hidden = false;
    $("btCopiarLink").hidden = false;
  } else {
    // Damos um momento ao browser: se o evento chegar, o botão aparece e esta
    // explicação nunca se mostra.
    setTimeout(() => {
      if ($("btInstalar").hidden) {
        $("comoInstalar").textContent =
          "Para instalar: no menu do browser, \"Instalar aplicação\" ou \"Adicionar ao ecrã principal\".";
        $("comoInstalar").hidden = false;
      }
    }, 2500);
  }
  addEventListener("appinstalled", () => {
    $("btInstalar").hidden = true;
    $("comoInstalar").hidden = true;
    $("btCopiarLink").hidden = true;
  });
})();

// ------------------------------------------------------------------ arranque

const idPartilha = idPartilhaDoEndereco();
if (idPartilha) {
  // Um link "🔗 Link para ver" -- o projeto não cabe no próprio endereço (é
  // grande demais para isso), vem do Worker, e só há algo para desenhar
  // depois de o ir lá buscar. Fica fora do resto do arranque de propósito:
  // um link partilhado nunca deve tocar no localStorage nem na
  // sincronização com os Calculadores -- quem o abre não é o mike.
  modoVisualizacao = true;
  document.body.classList.add("modo-ver");
  lerLinkPartilha(idPartilha).then((estado) => {
    return abrirProjetoTodo(estado);   // abrirProjetoTodo() é async -- sem o "return", um erro dela não caía no catch abaixo
  }).catch((e) => {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  });
} else {
  try {
    // Primeiro o que vem no endereço (foi alguém que carregou no "Ver em 3D"),
    // depois o último que os Calculadores deixaram guardado — assim abrir o
    // preview sozinho já mostra o projeto em que se andava a trabalhar.
    projeto = projetoDoEndereco() || (sincronizacaoAutomaticaLigada() ? projetoGuardado() : null);
    receberProjeto(projeto);
    if (projeto) marcarRecebidoDeFora();
    // E a sala que vier com ele manda: quem carrega no botão do assistente já lá
    // escreveu as medidas do sítio, e chegar cá a uma sala de 20 × 14 por
    // omissão é receber de volta uma resposta a uma pergunta que não fez.
    if (projeto && projeto.sala) {
      if (projeto.sala.largura) $("salaL").value = projeto.sala.largura;
      if (projeto.sala.profundidade) $("salaP").value = projeto.sala.profundidade;
      if (projeto.sala.altura) $("salaA").value = projeto.sala.altura;
    }
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
}

// Reaproveitar a janela do Preview tem um preço: uma navegação que muda só o
// "#" não recarrega a página, e o módulo não volta a correr. Sem isto, o
// segundo "Ver no Preview 3D" mudava o endereço e mais nada — parecia que o
// botão tinha deixado de funcionar.
addEventListener("hashchange", () => {
  let algo = false;
  try {
    const doEndereco = projetoDoEndereco();
    if (doEndereco) { marcarRecebidoDeFora(); carregar(doEndereco, true); algo = true; }
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
  const projetor = projetorDoEndereco();
  if (aplicarProjetores(projetor)) {
    document.getElementById("sProjecao").classList.remove("fechada");
    algo = true;
  }
  if (algo) {
    const aviso = $("aviso");
    if (!aviso.classList.contains("mostra")) {
      aviso.textContent = "Chegou dos Calculadores.";
      aviso.classList.add("mostra");
      setTimeout(() => aviso.classList.remove("mostra"), 2400);
    }
    focus();
  }
});

// E se os Calculadores mexerem nas zonas noutra aba, isto acompanha. O evento
// só chega às OUTRAS abas do mesmo domínio, que é exactamente o caso: as duas
// apps lado a lado.
addEventListener("storage", (e) => {
  if (e.key === CHAVE_SINCRONIZACAO) {
    atualizarBotaoSincronizacao();
    return;
  }
  if (!sincronizacaoAutomaticaLigada()) return;
  // O projetor tambem atravessa por aqui, e esse aplica-se logo: do outro lado
  // foi preciso carregar num botao para ele vir, o que ja e a decisao tomada.
  if (e.key === CHAVE_PROJETOR && e.newValue) {
    if (aplicarProjetores(projetorGuardado())) {
      const aviso = $("aviso");
      aviso.textContent = "Chegou um projetor dos Calculadores.";
      aviso.classList.add("mostra");
      setTimeout(() => aviso.classList.remove("mostra"), 2600);
    }
    return;
  }
  if (e.key !== CHAVE_PROJETO || !e.newValue) return;
  try {
    projeto = lerProjeto(e.newValue);
    receberProjeto(projeto);
    marcarRecebidoDeFora();
    montar(false);
    const aviso = $("aviso");
    aviso.textContent = "Os Calculadores mudaram o projeto — atualizei.";
    aviso.classList.add("mostra");
    setTimeout(() => aviso.classList.remove("mostra"), 2600);
  } catch (_) { /* o que veio não servia; fica o que estava */ }
});

// Porta de serviço: dá para espreitar a cena da consola do browser, e é por
// aqui que se percebe o que não está a ser desenhado sem ter de adivinhar.
//
// O comentário estava aqui e a linha não -- perdeu-se numa edição e ficou a
// promessa sem a coisa. Reposta ao medir onde é que o corpo do projetor fica em
// relação à lente, que é uma pergunta que só a cena responde.
window.cena = cena;

// O PONTO DE PARTIDA DO HISTÓRICO. Sem isto a primeira alteração não tinha
// estado anterior nenhum para empurrar, e o primeiro arrasto da sessão ficava
// sem volta -- precisamente o que aconteceu ao mike com o boneco.
estadoAnterior = instantaneo();
atualizarBotaoDesfazer();

// Ctrl+Z / Cmd+Z, para quem está ao computador. Não dispara dentro de um campo
// de texto: aí o desfazer que a pessoa quer é o do próprio campo, e roubá-lo
// seria trocar um passo pequeno por um grande sem ela pedir.
document.addEventListener("keydown", (e) => {
  if (!(e.key === "z" || e.key === "Z") || !(e.ctrlKey || e.metaKey) || e.shiftKey) return;
  const alvo = e.target;
  if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable)) return;
  e.preventDefault();
  desfazer();
});

window.preview = { THREE, cena, camara, controlos, medirSombra, aplicarProjetor, aplicarProjetores,
                  caixasQueTapam, quemTapaOFeixe,
                  // Abertas para o teste poder perguntar À FUNÇÃO A SÉRIO como
                  // é que ela divide um ecrã largo, em vez de repetir a conta
                  // do lado de fora -- repeti-la era testar a minha cópia da
                  // regra, e não a que a app corre.
                  segmentosDeZona, regraDeDistancia, frenteDoPalco,
                  // A plateia construída (filas, blocos, cortes) e os nomes
                  // das filas — para o teste medir o que a app fez, e não uma
                  // cópia da conta escrita do lado de fora.
                  get gente() { return corposDoPublico; },
                  get ultimaCobertura() { return ultimaCobertura; },
                  letraDaFila, filaDaLetra,
                  get feixesDoBlend() { return feixesDoBlend; },
                  get ajustes() { return ajustes; },
                  get montagemProjetores() { return montagemProjetores; },
                  get notaDeLeitura() { return notaDeLeitura; },
                  trazerTudoAVista, enquadrarOQueExiste, arrumarOQueFugiuDaSala, objetosArrastaveis, montar,
                  pecasForaDasParedes, trazerParaDentro,
                  desfazer, guardarAjustes,
                  get historico() { return historico; },
                  get projeto() { return projeto; },
                  get desenhado() { return desenhado; },
                  get plantaCad() { return plantaCad; },
                  // A planta em imagem e o data URL dela -- para o teste do
                  // "Guardar projeto" poder perguntar se ela voltou mesmo.
                  get plantaImagem() { return planta; },
                  get plantaDataURL() { return plantaDataURL; } };

// Um projetor que venha no ENDERECO aplica-se sozinho -- alguem carregou no
// "Ver no Preview 3D" para isto acontecer. Um projetor apenas GUARDADO nao:
// ligar a projecao a quem so queria ver a sala e mexer no desenho sem lho
// pedirem. Nesse caso diz-se que ele esta ali, a espera de um botao.
(function projetorAEspera() {
  const doEndereco = projetorDoEndereco();
  if (doEndereco.length) {
    aplicarProjetores(doEndereco);
    document.getElementById("sProjecao").classList.remove("fechada");
    return;
  }
  const lista = sincronizacaoAutomaticaLigada() ? projetorGuardado() : [];
  if (!lista.length) return;
  const p = lista[0];
  const maisBlend = lista.length > 1 ? ` + ${lista.length - 1} do blend` : "";
  $("btTrazerProjetor").textContent = "Trazer: " + (p.modelo || "projetor dos Calculadores") + maisBlend;
  $("notaProj").innerHTML = `Está guardado um projetor` +
    (p.modelo ? ` (<b>${p.modelo}</b>)` : "") +
    `: rácio ${p.racio.toFixed(2)}:1 a ${p.distancia.toFixed(2)} m` +
    (lista.length > 1 ? ` — e mais ${lista.length - 1} do blend` : "") +
    (lista.curva ? ` — num ecrã curvo de ${lista.curva.raio} m de raio` : "") +
    `. Carrega no botão para o trazer.`;
  // E ABRIR A SECÇÃO, senão este aviso não existe para ninguém.
  //
  // Esperar por um botão é decisão tomada (acima) e continua de pé: quem só
  // quer ver a sala não leva uma projeção ligada sem a pedir. O que não pode é
  // o aviso ficar dentro de uma secção fechada -- reportado como *"não desenha
  // o curvo"*, e não desenhava mesmo: a carga estava guardada, a dizer-se numa
  // gaveta que ninguém tinha aberto. Aberta a secção, o botão e a razão ficam
  // à vista e a escolha continua a ser de quem está a olhar.
  document.getElementById("sProjecao").classList.remove("fechada");
})();

montar(true);
volta();

// A contagem, no fim de tudo o resto estar de pé: é a última coisa que a app
// faz e a primeira que se sacrifica se alguma falhar. Ver js/uso.js para o
// que sai daqui, para o que nunca sai, e para a razão de um "Link para ver"
// não contar nada.
ligarInterruptorDeUso(dizerNaCena);
usoArranque();

// ------------------------------------------------------ a planta em DXF
//
// Pedido: *"seria para exportar e enviar para a engenharia de desenho, que
// confere e envia para o cliente"*, e logo a seguir o critério:
// *"medidas correctas para conferência"*.
//
// É esse o critério. O que o desenhador medir no Vectorworks tem de dar o
// número que a app diz -- por isso nada aqui recalcula nada. Cada peça sai das
// MESMAS funções que desenham o 3D (frenteDoPalco, contextoDeZonas,
// centroDeZona, a plateia já construída em corposDoPublico). Uma segunda conta
// para o desenho era uma segunda resposta, e a conferência deixava de valer.
//
// Ver js/dxf-saida.js para as decisões de formato (DXF antigo, metros).
function plantaEmDXF() {
  const sala = lerSala(), palco = lerPalco(), publico = lerPublico();
  const pecas = [];
  const usadas = new Set();
  const por = (camada, texto) => { usadas.add(camada); pecas.push(texto); };
  const P = (x, z) => paraPlanta(x, z);
  const m = (v) => nnum(v) + " m";

  // ---- a sala ------------------------------------------------------------
  const s = P(0, 0);
  por("SALA", DESENHO.rectangulo("SALA", s.x, s.y, sala.largura, sala.profundidade, 0));
  // As duas medidas da sala, cotadas por fora do contorno.
  const foraX = -sala.largura / 2 - 1.2, foraY = sala.profundidade / 2 + 1.2;
  por("COTAS", DESENHO.cota("COTAS", -sala.largura / 2, foraY, sala.largura / 2, foraY,
    m(sala.largura)));
  por("COTAS", DESENHO.cota("COTAS", foraX, -sala.profundidade / 2, foraX, sala.profundidade / 2,
    m(sala.profundidade)));

  // ---- o palco -----------------------------------------------------------
  if ($("verPalco").checked && palco.altura > 0 && palco.profundidade > 0) {
    const frente = frenteDoPalco(sala, palco);
    const larguraPalco = Math.min(palco.largura || sala.largura, sala.largura);
    const centroZ = frente.z - palco.profundidade / 2;
    const c = P(frente.x, centroZ);
    por("PALCO", DESENHO.rectangulo("PALCO", c.x, c.y, larguraPalco, palco.profundidade, 0));
    por("PALCO", DESENHO.texto("PALCO", c.x - larguraPalco / 2 + 0.2, c.y,
      0.3, "PALCO " + nnum(larguraPalco) + " x " + nnum(palco.profundidade) +
      " m · h " + nnum(palco.altura) + " m"));
    // A boca de cena cotada em largura, e a profundidade do palco.
    const bocaY = P(0, frente.z).y;
    por("COTAS", DESENHO.cota("COTAS", frente.x - larguraPalco / 2, bocaY - 0.6,
      frente.x + larguraPalco / 2, bocaY - 0.6, m(larguraPalco)));

    const passarela = lerPassarela();
    if (passarela.ligada && passarela.comprimento > 0) {
      const zp = zonaDaPassarela(sala, palco, passarela);
      if (zp) {
        const cp = P(zp.dx, (zp.zMin + zp.zMax) / 2);
        por("PALCO", DESENHO.rectangulo("PALCO", cp.x, cp.y,
          zp.largura, zp.zMax - zp.zMin, 0));
      }
    }
  }

  // ---- os ecrãs ----------------------------------------------------------
  //
  // Em planta um ecrã é uma linha: tem largura e praticamente nenhuma
  // espessura. Vai com a etiqueta ao lado, porque quem confere precisa de ver
  // a medida escrita E de a poder medir.
  // Guardados para o ALÇADO os usar tal e qual. Repetir o totais() e o
  // contextoDeZonas() lá em baixo era abrir a porta a o alçado e a planta
  // discordarem sobre onde está o mesmo ecrã.
  const montado = projetoMontado(projeto);
  let montadoParaAlcado = null, ctxParaAlcado = null;
  if (montado && montado.zonas && montado.zonas.length) {
    const medidas = totais(montado);
    const ctx = contextoDeZonas(montado, medidas, sala, palco);
    montadoParaAlcado = montado; ctxParaAlcado = ctx;
    montado.zonas.forEach((zona) => {
      const centro = centroDeZona(zona, ajustes.delays[zona.nome], ctx);
      const graus = -(centro.rotacao * 180 / Math.PI);
      const c = P(centro.centroX, centro.centroZ);
      por("ECRAS", DESENHO.rectangulo("ECRAS", c.x, c.y, zona.w, 0.12, graus));
      por("ECRAS", DESENHO.texto("ECRAS", c.x - zona.w / 2, c.y + 0.35, 0.28,
        zona.nome + "  " + nnum(zona.w) + " x " + nnum(zona.h) + " m", graus));
    });
  }

  // ---- os projetores -----------------------------------------------------
  //
  // A lente, e a linha até ao centro da imagem: é a linha que o desenhador
  // mede para conferir a distância de tiro.
  const coords = dadosDeCoordenadas();
  [].concat(coords.cupula || [], coords.planos || []).forEach((p, i) => {
    const c = P(p.pos.x, p.pos.z);
    por("PROJECAO", DESENHO.circulo("PROJECAO", c.x, c.y, 0.25));
    por("PROJECAO", DESENHO.texto("PROJECAO", c.x + 0.35, c.y + 0.1, 0.25,
      p.nome || ("P" + (i + 1))));
    if (p.centroDaImagem) {
      const alvo = P(p.centroDaImagem.x, p.centroDaImagem.z);
      por("PROJECAO", DESENHO.linha("PROJECAO", c.x, c.y, alvo.x, alvo.y));
      if (p.distancia) {
        por("COTAS", DESENHO.texto("COTAS", (c.x + alvo.x) / 2, (c.y + alvo.y) / 2 + 0.2,
          0.22, m(p.distancia)));
      }
    }
  });

  // ---- a régie -----------------------------------------------------------
  const regie = lerRegie();
  if ($("verRegie") && $("verRegie").checked && regie.largura > 0) {
    const c = P(regie.x, regie.z);
    por("REGIE", DESENHO.rectangulo("REGIE", c.x, c.y,
      regie.largura, regie.profundidade, -(regie.rodar || 0)));
    por("REGIE", DESENHO.texto("REGIE", c.x - regie.largura / 2, c.y, 0.25,
      "RÉGIE " + nnum(regie.largura) + " x " + nnum(regie.profundidade) + " m"));
  }

  // ---- a plateia ---------------------------------------------------------
  //
  // Bloco a bloco e fila a fila, com as letras -- é o mapa de sala que o
  // cliente lê, e a app já sabe onde cada uma ficou (ver filasInfo/blocosInfo
  // em fazerPublico). Não se desenha cadeira a cadeira: quatrocentos
  // rectângulos num DXF são um ficheiro que ninguém abre com gosto, e a
  // informação que interessa é onde estão as filas e quantos lugares levam.
  const gente = corposDoPublico;
  if ($("verPublico").checked && gente && gente.filasInfo && gente.filasInfo.length
      && gente.blocosInfo && gente.blocosInfo.length) {
    const primeira = gente.filasInfo[0], ultima = gente.filasInfo[gente.filasInfo.length - 1];
    gente.blocosInfo.forEach((b) => {
      // O rectângulo do bloco vai DA PRIMEIRA À ÚLTIMA FILA, sem folga
      // nenhuma à frente nem atrás.
      //
      // A primeira versão punha meio lugar de folga e o desenho passou a medir
      // 3,75 m do palco à plateia quando o campo diz 4,00 -- uma diferença de
      // 25 cm que ninguém pediu, numa planta cujo único fim é ser conferida.
      // Sem folga, a borda do bloco É a primeira fila, e quem mede com a fita
      // no Vectorworks encontra o número que está escrito no campo.
      const z0 = primeira.z, z1 = ultima.z;
      const a = P(b.x0, z0), c = P(b.x1, z1);
      por("PLATEIA", DESENHO.rectangulo("PLATEIA",
        (a.x + c.x) / 2, (a.y + c.y) / 2,
        Math.abs(c.x - a.x), Math.abs(c.y - a.y), 0));
      por("PLATEIA", DESENHO.texto("PLATEIA", a.x + 0.1, c.y - 0.45, 0.25,
        b.lugares + " lug/fila (" + b.primeiroLugar + "–" +
        (b.primeiroLugar + b.lugares - 1) + ")"));
    });
    // Uma linha por fila, com a letra nas pontas.
    const esquerda = gente.blocosInfo[0].x0;
    const direita = gente.blocosInfo[gente.blocosInfo.length - 1].x1;
    gente.filasInfo.forEach((fila) => {
      const a = P(esquerda, fila.z), c = P(direita, fila.z);
      por("PLATEIA", DESENHO.linha("PLATEIA", a.x, a.y, c.x, c.y));
      const letra = letraDaFila(fila.indice);
      por("PLATEIA", DESENHO.texto("PLATEIA", a.x - 0.55, a.y - 0.1, 0.25, letra));
      por("PLATEIA", DESENHO.texto("PLATEIA", c.x + 0.25, c.y - 0.1, 0.25, letra));
    });
    // E a distância do palco à primeira fila, que é a medida que mais se
    // confere numa planta destas.
    if ($("verPalco").checked && palco.altura > 0) {
      const frente = frenteDoPalco(sala, palco);
      const xCota = gente.blocosInfo[0].x0 - 0.8;
      por("COTAS", DESENHO.cota("COTAS", xCota, P(0, frente.z).y,
        xCota, P(0, primeira.z).y, m(primeira.z - frente.z)));
    }
  }

  por("COTAS", DESENHO.texto("COTAS", -sala.largura / 2, sala.profundidade / 2 + 2.0,
    0.45, "PLANTA"));

  // ---- O ALÇADO, por baixo da planta -------------------------------------
  //
  // Pedido a seguir à planta: *"podes pôr o alçado sim"* — e logo a condição:
  // *"se existir"*. Por isso ele só sai quando há mesmo alguma coisa com
  // ALTURA para mostrar (um palco, ou ecrãs). Uma sala vazia levava um
  // rectângulo em branco por baixo do desenho, e um desenho a mais é um
  // desenho que alguém tem de perceber porque é que lá está.
  //
  // Fica DEBAixo da planta e alinhado em X, de propósito: assim o desenhador
  // deixa cair uma vertical da planta para o alçado e vê o mesmo ecrã nos dois
  // -- que é como se confere uma altura contra uma posição.
  //
  // É um alçado FRONTAL: olha-se para o palco, X para a direita e Y a altura
  // a sério (a altura da lente, a do ecrã acima do palco). A distância de tiro
  // não está aqui, está na planta, onde se mede.
  // AS CAMADAS DO ALÇADO SÃO DELE, e não as da planta.
  //
  // Aqui estava escrito o contrário -- camadas partilhadas, para desligar
  // ECRAS desligar o ecrã nas duas vistas. Duas coisas provaram que estava
  // errado: quem confere não consegue esconder o alçado para ver só a planta;
  // e ao trazer este mesmo DXF de volta para a app, o alçado entra como se
  // fosse planta e fica deitado no chão à frente da plateia -- medido, punha
  // o palco 1,82 m fora do sítio, porque o centro do desenho deixa de ser o
  // centro da sala. Reportado assim: *"abre invertido?"*.
  //
  // Cada camada do alçado chama-se ALCADO-<a da planta> e sai com a mesma cor
  // (ver corDaCamada em dxf-saida.js), por isso continua a ler-se como um par.
  const alcado = [];
  const AL = { PALCO: "ALCADO-PALCO", ECRAS: "ALCADO-ECRAS",
               PROJECAO: "ALCADO-PROJECAO", COTAS: "ALCADO-COTAS",
               SALA: "ALCADO-SALA" };
  const porAlcado = (camada, texto) => { usadas.add(camada); alcado.push(texto); };
  const alturaDoPalco = ($("verPalco").checked && palco.altura > 0) ? palco.altura : 0;

  // QUÃO ALTO É O ALÇADO, antes de saber onde o pôr.
  //
  // O alçado cresce PARA CIMA a partir do seu chão. Uma folga fixa por baixo
  // da planta não chega: medido com um ecrã de 4,5 m a 2,5 m de altura, o topo
  // dele subia até dentro do rectângulo da planta e os dois desenhos ficavam
  // sobrepostos no mesmo ficheiro. Por isso mede-se primeiro a coisa mais alta
  // que lá vai, e só depois se escolhe o sítio.
  let maisAlto = alturaDoPalco;
  if (montadoParaAlcado && ctxParaAlcado) {
    montadoParaAlcado.zonas.forEach((zona) => {
      const c = centroDeZona(zona, ajustes.delays[zona.nome], ctxParaAlcado);
      maisAlto = Math.max(maisAlto, c.centroY + zona.h / 2);
    });
  }
  [].concat(coords.cupula || [], coords.planos || []).forEach((p) => {
    maisAlto = Math.max(maisAlto, p.pos.y + 0.5);
  });
  const chaoDoAlcado = -(sala.profundidade / 2) - 4 - maisAlto;
  const A = (x, y) => ({ x: x, y: y + chaoDoAlcado });

  if (alturaDoPalco > 0) {
    const frente = frenteDoPalco(sala, palco);
    const larguraPalco = Math.min(palco.largura || sala.largura, sala.largura);
    const c = A(frente.x, alturaDoPalco / 2);
    porAlcado(AL.PALCO, DESENHO.rectangulo(AL.PALCO, c.x, c.y, larguraPalco, alturaDoPalco, 0));
    const lado = A(frente.x + larguraPalco / 2 + 0.6, 0);
    porAlcado(AL.COTAS, DESENHO.cota(AL.COTAS, lado.x, lado.y, lado.x, lado.y + alturaDoPalco,
      m(alturaDoPalco)));
  }

  if (montadoParaAlcado && montadoParaAlcado.zonas.length) {
    montadoParaAlcado.zonas.forEach((zona) => {
      const centro = centroDeZona(zona, ajustes.delays[zona.nome], ctxParaAlcado);
      const c = A(centro.centroX, centro.centroY);
      porAlcado(AL.ECRAS, DESENHO.rectangulo(AL.ECRAS, c.x, c.y, zona.w, zona.h, 0));
      porAlcado(AL.ECRAS, DESENHO.texto(AL.ECRAS, c.x - zona.w / 2 + 0.15, c.y, 0.28,
        zona.nome + "  " + nnum(zona.w) + " x " + nnum(zona.h) + " m"));
      // A base do ecrã ao chão: é a medida que se confere num alçado, porque
      // é ela que diz se a primeira fila vê por cima das cabeças.
      const base = centro.centroY - zona.h / 2;
      const xCota = centro.centroX - zona.w / 2 - 0.5;
      const p0 = A(xCota, 0), p1 = A(xCota, base);
      if (base > 0.05) {
        porAlcado(AL.COTAS, DESENHO.cota(AL.COTAS, p0.x, p0.y, p1.x, p1.y, m(base)));
      }
    });
  }

  // Os projetores: a altura da lente, que é o outro número que se confere aqui.
  [].concat(coords.cupula || [], coords.planos || []).forEach((p, i) => {
    const c = A(p.pos.x, p.pos.y);
    porAlcado(AL.PROJECAO, DESENHO.circulo(AL.PROJECAO, c.x, c.y, 0.25));
    porAlcado(AL.PROJECAO, DESENHO.texto(AL.PROJECAO, c.x + 0.35, c.y + 0.1, 0.25,
      (p.nome || ("P" + (i + 1))) + "  h " + nnum(p.pos.y) + " m"));
  });

  // "Se existir": sem palco e sem ecrãs não há alçado nenhum a desenhar, e
  // não se acrescenta o chão nem o título só para haver um segundo desenho.
  if (alcado.length) {
    const chaoE = A(-sala.largura / 2, 0), chaoD = A(sala.largura / 2, 0);
    por(AL.SALA, DESENHO.linha(AL.SALA, chaoE.x, chaoE.y, chaoD.x, chaoD.y));
    const titulo = A(-sala.largura / 2, -1.2);
    por(AL.COTAS, DESENHO.texto(AL.COTAS, titulo.x, titulo.y, 0.45, "ALÇADO FRONTAL"));
    alcado.forEach((peca) => pecas.push(peca));
  }

  const meia = { x: sala.largura / 2 + 2.5, y: sala.profundidade / 2 + 2.5 };
  const baixo = alcado.length ? chaoDoAlcado - 2.5 : -meia.y;
  return comoDXF([...usadas], pecas,
    { minX: -meia.x, minY: baixo, maxX: meia.x, maxY: meia.y });
}


function guardarPlantaDXF() {
  try {
    const texto = plantaEmDXF();
    const base = (projeto && projeto.nome ? String(projeto.nome) : "planta")
      .replace(/[^\p{L}\p{N}\- ]+/gu, "").trim() || "planta";
    descarregar(new Blob([texto], { type: "application/dxf" }), base + " - planta.dxf");
  } catch (e) {
    const aviso = $("aviso");
    aviso.textContent = "Não consegui escrever a planta: " + e.message;
    aviso.classList.add("mostra");
    setTimeout(() => aviso.classList.remove("mostra"), 4000);
  }
}
window.preview.plantaEmDXF = plantaEmDXF;
