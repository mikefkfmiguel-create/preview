// Preview — ver um projeto dos Calculadores montado numa sala.

import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { EXEMPLO, FORMATO, lerProjeto, totais, projetoDoEndereco,
         projetoGuardado, guardarSala, projetorGuardado, projetorDoEndereco,
         CHAVE_PROJETO, CHAVE_PROJETOR, CHAVE_BRIEFING, CHAVE_DEVOLUCAO,
         CHAVE_SINCRONIZACAO, idPartilhaDoEndereco,
         ajustesGuardados, guardarAjustes } from "./projeto.js";
import { fazerCena, fazerSala, fazerPalco, fazerZonas, fazerFigura, fazerPublico,
         fazerPublicoGomos,
         padraoDeTeste, texturaDaMarca, texturaDeFicheiro, conteudoDeFicheiro, conteudoDeDataURL, fazerProjecao, pontosDaImagem,
         fazerPlanta, fazerPlantaCad, fazerRegie, fazerDSM, fazerConeCobertura } from "./cena.js";
import { lerDXF, metrosPorUnidade } from "./dxf.js";
import { lerDWG, lerPDF } from "./importar.js";
import { analisar, doQueVeioParaCa, quantosEcras, gruposDeEcras } from "./assistente.js";
import { criarLinkPartilha, lerLinkPartilha } from "./partilha.js";
import { prepararParaExportar, comoGLB, comoOBJ, descarregar, pesar } from "./exportar.js";

const $ = (id) => document.getElementById(id);
const tela = $("tela");

// preserveDrawingBuffer: sem isto o browser pode limpar o canvas antes de o
// copiarmos, e a imagem guardada sai preta.
const renderizador = new THREE.WebGLRenderer({ canvas: tela, antialias: true,
                                              preserveDrawingBuffer: true });
renderizador.setPixelRatio(Math.min(devicePixelRatio, 2));

const camara = new THREE.PerspectiveCamera(52, 1, 0.05, 400);
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
let plantaCad = null;      // a planta em DXF, que ja vem a escala
const camadasEscondidas = new Set();   // camadas da planta que nao se veem
const camadasLevantadas = new Set();   // camadas que sobem do chao, como paredes
let projecaoAtual = null;  // a lente e a imagem de agora, para medir a sombra
let ondeEsta = null;       // onde o orador foi posto à mão, se foi
let corposDoPublico = null;// uma caixa por pessoa, para a sombra
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
function sincronizacaoAutomaticaLigada() {
  let bruto;
  try { bruto = localStorage.getItem(CHAVE_SINCRONIZACAO); } catch (_) { return true; }
  if (bruto == null) return true;
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
           profundidade: num("palcoP"), acimaDoPalco: num("ecraOffset") };
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
    gomos: Math.max(1, Math.min(12, Math.round(num("gomos")) || 3))
  };
}

function lerRegie() {
  return {
    largura: Math.max(2, num("regieL") || 2),
    profundidade: Math.max(2, num("regieP") || 2),
    x: num("regieX"), z: num("regieZ"),
    rodar: num("regieR")
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

function montar(recentrarCamara) {
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
  }

  const sala = lerSala();
  const palco = lerPalco();
  const publico = lerPublico();

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
  if ($("verPalco").checked) desenhado.add(fazerPalco(sala, palco));

  // A régie entra ANTES do público, porque é o público que precisa de saber
  // onde ela está para lhe deixar o vão. Isto ia ficar reservado mesmo com a
  // régie escondida — parecia mais correcto, "o espaço existe sempre" — mas
  // na prática ninguém consegue comparar "com" e "sem" régie assim: o
  // interruptor tem de ser um interruptor a sério, como todos os outros
  // desta lista, e não uma opção que só esconde o desenho.
  const verRegie = $("verRegie").checked;
  const regie = verRegie ? lerRegie() : null;
  if (regie) {
    regie.elevacao = elevacaoDaRegie(sala, palco, publico, regie.z);
    desenhado.add(fazerRegie(sala, regie));
  }

  // Os interruptores existem porque cada vista serve uma pergunta diferente:
  // sem paredes vê-se a sala de fora, sem público vê-se a estrutura, e sem
  // ninguém no palco mede-se o ecrã sem nada a tapá-lo.
  const gente = $("verPublico").checked
    ? (publico.formato === "circular"
        ? fazerPublicoGomos(sala, palco, publico, regie, ajustesDeGomosGarantidos(publico))
        : fazerPublico(sala, palco, publico, regie))
    : { grupo: new THREE.Group(), olhos: null, lugares: 0, filas: 0, porFila: 0, blocos: 1 };
  desenhado.add(gente.grupo);
  olhosDaPlateia = gente.olhos;
  corposDoPublico = gente;

  let medidas = null;
  if (projeto && projeto.zonas.length) {
    medidas = totais(projeto);
    // Os ecrãs também se desligam: para olhar para a sala sem eles, ou para os
    // tirar da frente da planta que se está a acertar por baixo.
    const zonas = fazerZonas(projeto, medidas, sala, palco, textura, modoConteudo, ajustes.delays, texturasPorZona);
    if ($("verEcras").checked) desenhado.add(zonas.grupo);
    etiquetas = ($("verMedidas").checked && $("verEcras").checked) ? zonas.etiquetas : [];

    avisarSeNaoCabe(medidas, sala, palco);
  }
  desenharListaConteudoZonas(projeto);
  // O DSM não depende de haver zonas — um projeto pode nascer aqui mesmo só
  // com o monitor de confiança, antes de se acrescentar nenhum ecrã.
  if (projeto && projeto.dsm && $("verEcras").checked) {
    const dsm = fazerDSM(projeto.dsm, sala, palco, ajustes.dsm, textura);
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

  // Uma pessoa no palco, que é o que dá a medida a tudo o resto. Fica FORA do
  // "se houver projeto": sem zonas nenhumas ela é ainda mais precisa, porque é
  // a única coisa na cena com um tamanho que toda a gente conhece.
  const figura = $("verOrador").checked ? fazerFigura(1.75) : null;
  const larguraPalco = Math.min(palco.largura || sala.largura, sala.largura);
  const noPalco = palco.altura > 0 && palco.profundidade > 0;
  const limite = (noPalco ? larguraPalco : sala.largura) / 2 - 0.7;
  const x = -(medidas ? Math.min(limite, medidas.largura / 2 + 1.2) : limite * 0.55);
  if (figura) {
    figura.position.set(
      ondeEsta ? ondeEsta.x : x,
      noPalco ? palco.altura : 0,
      ondeEsta ? ondeEsta.z
        : (noPalco
            ? -sala.profundidade / 2 + palco.profundidade - 0.8   // à boca de cena
            : -sala.profundidade / 2 + 1.6));
    desenhado.add(figura);
  }

  desenharProjecao(sala, palco);

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
      const jaTem = aviso.classList.contains("mostra") ? aviso.textContent + " " : "";
      const lista = gente.gomosApertados
        .map((g) => `Gomo ${g.gomo}: ${g.filas} de ${g.pedidas}`).join("; ");
      aviso.textContent = jaTem + `Nem todas as filas pedidas cabem — ${lista} (a sala acaba antes).`;
      aviso.classList.add("mostra");
    }
  } else if ($("verPublico").checked && publico.filas && gente.filas < publico.filas) {
    const aviso = $("aviso");
    const jaTem = aviso.classList.contains("mostra") ? aviso.textContent + " " : "";
    aviso.textContent = jaTem + `Só cabem ${gente.filas} das ${publico.filas} filas: ` +
      `a sala acaba antes.`;
    aviso.classList.add("mostra");
  }
  // A cobertura substitui o aviso de ângulo da v2.26: aquele só dizia "há um
  // ecrã rodado de mais"; isto diz QUEM fica sem ver nada, em que bloco, e
  // desenha-o na cena se for pedido -- o aviso genérico não respondia a
  // nenhuma dessas perguntas.
  let cobertura = null;
  if (projeto && projeto.zonas.length) {
    cobertura = calcularCobertura(projeto, medidas, sala, palco, gente);
    if (cobertura && $("verCobertura").checked) {
      desenhado.add(desenharConesCobertura(projeto, medidas, sala, palco, gente));
    }
  }
  escreverPainelCobertura(cobertura);

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
  desenharAjustes();
  desenharGomos(publico);
  devolverDaqui();
  if (recentrarCamara) vista("frente");
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
      if (!o.isMesh) return;
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
    problemas.push(`o conjunto tem ${medidas.largura.toFixed(2)} m e a sala ${sala.largura} m de largura`);
  }
  if (altoDemais > sala.altura) {
    problemas.push(`o topo fica a ${altoDemais.toFixed(2)} m e o pé-direito é ${sala.altura} m`);
  }
  const aviso = $("aviso");
  if (problemas.length) {
    aviso.textContent = "Não cabe: " + problemas.join("; ") + ".";
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
  const zonasInfo = projetoAtual.zonas.map(zona => ({
    zona, centro: centroDeZona(zona, ajustes.delays[zona.nome], ctx), comLugares: 0
  }));

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
      // A distância mede-se em "alturas de imagem": um ecrã de 4 m aceita
      // gente até 40 m (10×), um delay de 0,9 m já não aceita passar dos 9 m.
      const distanciaEmAlturas = ang.distancia / zi.zona.h;
      if (distanciaEmAlturas > LIMITE_DISTANCIA_ALTURA) continue;
      zi.comLugares++;
      const confortavel = ang.horizontal <= CONFORTAVEL_HORIZONTAL && ang.vertical <= CONFORTAVEL_VERTICAL
        && distanciaEmAlturas <= CONFORTAVEL_DISTANCIA_ALTURA;
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

  return {
    totalLugares: n, confortaveis, marginais, semCobertura, corPorLugar,
    zonasSemCobertura: zonasInfo.filter(zi => zi.comLugares === 0).map(zi => zi.zona.nome),
    blocos, piorBloco: (piorBloco && piorBloco.sem > 0) ? piorBloco : null
  };
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
  for (const zona of projetoAtual.zonas) {
    const centro = centroDeZona(zona, ajustes.delays[zona.nome], ctx);
    const alcancePlateia = fundoDaPlateia - centro.centroZ;
    const alcanceDistancia = zona.h * LIMITE_DISTANCIA_ALTURA;
    const alcance = Math.max(3, Math.min(alcancePlateia, alcanceDistancia));
    grupo.add(fazerConeCobertura(centro, alcance, LIMITE_HORIZONTAL, LIMITE_VERTICAL));
  }
  return grupo;
}

function escreverPainelCobertura(cobertura) {
  const resumo = $("resumoCobertura");
  const lista = $("listaCoberturaBlocos");
  if (!cobertura) {
    resumo.className = "vazio";
    resumo.textContent = "Sem ecrãs ou sem público para comparar.";
    lista.className = "vazio";
    lista.textContent = "-";
    return;
  }
  const { totalLugares, confortaveis, marginais, semCobertura, zonasSemCobertura, blocos, piorBloco } = cobertura;
  resumo.className = "";
  resumo.innerHTML =
    `<b class="cobertura-verde">${confortaveis}</b> confortáveis · ` +
    `<b class="cobertura-amarela">${marginais}</b> marginais · ` +
    `<b class="cobertura-vermelha">${semCobertura}</b> sem cobertura ` +
    `(de ${totalLugares} lugares).` +
    (zonasSemCobertura.length
      ? `<br>Sem ninguém a ver: ${zonasSemCobertura.join(", ")}.`
      : "") +
    (piorBloco
      ? `<br>Bloco ${piorBloco.bloco + 1} é o pior: ${piorBloco.sem} de ${piorBloco.total} lugares sem ecrã.`
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
  if (!projeto || !projeto.zonas.length) return null;
  if (!corposDoPublico || !corposDoPublico.corpos || !corposDoPublico.corpos.length) return null;

  const sala = lerSala(), palco = lerPalco();
  const medidas = totais(projeto);
  const gente = corposDoPublico;
  const ctx = contextoDeZonas(projeto, medidas, sala, palco);
  const zonasInfo = projeto.zonas.map(zona => ({
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

function escreverPainel(medidas, lugares, gentePosta, cobertura) {
  const resumo = $("resumo");
  const lista = $("listaZonas");
  // Um projeto criado aqui pode nascer só com um DSM, sem ecrã nenhum ainda
  // — "sem zonas" não é o mesmo que "nada para mostrar no painel".
  const temAlgo = projeto && (projeto.zonas.length || projeto.dsm);

  // A lista reconstrói-se do zero sempre que se monta a cena — inclusive a
  // meio de se escrever um nome, porque cada tecla também dispara um
  // remontar (com atraso). Sem isto, escrever "Ecrã da esquerda" perdia o
  // foco a cada letra, porque o campo onde se estava a escrever deixava de
  // existir e nascia outro igual no lugar.
  const ativo = lista.contains(document.activeElement) ? document.activeElement : null;
  // O valor TAL COMO ESTÁ ESCRITO, não só a posição do cursor -- um campo
  // "number" a meio de se apagar (vazio, ou só um "-" a começar um
  // negativo) não é um número válido, e sem isto o campo reconstruído
  // saltava de volta para o último valor válido no instante seguinte:
  // parecia que o telemóvel não deixava apagar o que lá estava.
  const focoGuardado = ativo && ativo.dataset.campo
    ? { campo: ativo.dataset.campo, inicio: ativo.selectionStart, fim: ativo.selectionEnd, valor: ativo.value }
    : null;

  if (!temAlgo) {
    resumo.className = "vazio";
    resumo.textContent = projeto
      ? "Projeto sem ecrãs ainda. Usa o \"+ Ecrã\" ou o \"+ DSM\" aqui em baixo."
      : "Sem projeto. Cola aqui o que vem dos Calculadores, ou cria um ecrã aqui em baixo.";
    lista.className = "vazio";
    lista.textContent = "—";
  } else {
    const res = projeto.zonas.reduce((t, z) => t + ((z.res && z.res.x * z.res.y) || 0), 0);
    resumo.className = "";
    resumo.innerHTML = medidas
      ? `<b>${medidas.largura.toFixed(2)} × ${medidas.altura.toFixed(2)} m</b> · ` +
        `${medidas.zonas} zona${medidas.zonas === 1 ? "" : "s"}` +
        (medidas.peso ? ` · <b>${Math.round(medidas.peso)}</b> kg` : "") +
        (medidas.amp ? ` · <b>${medidas.amp.toFixed(1)}</b> A` : "") +
        (res ? ` · <b>${(res / 1e6).toFixed(1)}</b> Mpx` : "")
      : "Só o DSM, sem ecrãs ainda.";

    lista.className = "";
    lista.innerHTML = "";
    projeto.zonas.forEach((z, i) => lista.append(linhaDeZona(z, i)));

    if (projeto.dsm) lista.append(linhaDeDsm());

    if (focoGuardado) {
      const novo = lista.querySelector(`[data-campo="${focoGuardado.campo}"]`);
      if (novo) {
        if (novo.type === "text" || novo.type === "number") novo.value = focoGuardado.valor;
        novo.focus();
        if (typeof novo.setSelectionRange === "function" && (novo.type === "text" || novo.type === "number")) {
          try { novo.setSelectionRange(focoGuardado.inicio, focoGuardado.fim); } catch (e) { /* alguns "number" recusam seleção — sem problema, fica só o foco */ }
        }
      }
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
    projeto = { v: FORMATO, nome: "Projeto (criado no Preview)", origem: "preview", zonas: [], dsm: null };
  }
  if (!Array.isArray(projeto.zonas)) projeto.zonas = [];
  return projeto;
}

function mostrarZonas() {
  const secao = $("zonas");
  secao.classList.remove("fechada");
  try {
    localStorage.setItem("preview-dobras",
      JSON.stringify([...document.querySelectorAll("#painel section.fechada")]
        .filter(x => x.id !== "zonas").map(x => x.id)));
  } catch (_) {}
  $("listaZonas").scrollIntoView({ block: "nearest" });
}

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
  p.zonas.push({
    nome: `Ecrã ${n + 1}`,
    x: anterior ? anterior.x + anterior.w + 0.5 : 0,
    y: 0, w: 2, h: 1.2,
    cor: CORES_ZONA[n % CORES_ZONA.length],
    tipo: "led"
  });
  projetoMudou();
  mostrarZonas();
};

$("btNovoDelay").onclick = () => {
  const p = garantirProjeto();
  const delays = p.zonas.filter(z => z.tipo === "tv" || z.tipo === "projecao");
  const n = delays.length;
  const anterior = delays[n - 1];
  p.zonas.push({
    nome: `Delay ${n + 1}`,
    x: anterior ? anterior.x + anterior.w + 0.5 : 0,
    y: 0, w: 0.8, h: 0.45,
    cor: "#F59E0B",
    tipo: "tv"
  });
  projetoMudou();
  mostrarZonas();
};

$("btNovoDsm").onclick = () => {
  const p = garantirProjeto();
  if (p.dsm) return;
  p.dsm = { n: 2, w: 0.6, h: 0.4 };
  projetoMudou();
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

  linha.append(cor, nome, tipo, med, pos, prof, rodar, tilt);
  if (duplicar) linha.append(duplicar);
  linha.append(remover);
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
 * Um campo ↔/↕ para afinar a posição de um delay ou de um DSM — o valor
 * inicial vem do que já estiver guardado, e cada alteração escreve logo no
 * objeto `alvo` (a entrada de `ajustes.delays[nome]` ou `ajustes.dsm[i]`) e
 * volta a montar a cena, com o mesmo atraso dos outros campos do painel.
 */
function campoAjuste(rotulo, alvo, chave, unidadeTexto = "m", passo = "0.05", idCampo, min = -500, max = 500) {
  const campo = document.createElement("label");
  campo.className = "ajuste-campo";
  campo.textContent = rotulo + " ";
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

  // A mesma razão da lista de zonas: isto reconstrói-se do zero a cada tecla
  // (o remontar com atraso dispara a cada "input"), e sem guardar o foco de
  // propósito, o campo onde se estava a escrever morria e nascia outro igual
  // no lugar — dava para MEXER o número com as setas, mas não para o
  // escrever a direito.
  const ativo = lista.contains(document.activeElement) ? document.activeElement : null;
  const focoGuardado = ativo && ativo.dataset.campo
    ? { campo: ativo.dataset.campo, inicio: ativo.selectionStart, fim: ativo.selectionEnd, valor: ativo.value }
    : null;

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
    linha.append(campoAjuste("profundidade", ajustes.delays[z.nome], "dz", "m", "0.05", `d-${z.nome}-dz`));
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
    linha.append(campoAjuste("profundidade", ajustes.dsm[i], "dz", "m", "0.05", `m${i}-dz`));
    linha.append(campoAjuste("rodar", ajustes.dsm[i], "rot", "°", "5", `m${i}-rot`, -180, 180));
    // Afinação por cima do tombo fixo (ver o comentário em fazerDSM, cena.js).
    linha.append(campoAjuste("tilt", ajustes.dsm[i], "tilt", "°", "5", `m${i}-tilt`, -45, 45));
    lista.append(linha);
  }

  if (focoGuardado) {
    const novo = lista.querySelector(`[data-campo="${focoGuardado.campo}"]`);
    if (novo) {
      novo.value = focoGuardado.valor;
      novo.focus();
      try { novo.setSelectionRange(focoGuardado.inicio, focoGuardado.fim); } catch (e) { /* alguns "number" recusam seleção — sem problema, fica só o foco */ }
    }
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

  const ativo = lista.contains(document.activeElement) ? document.activeElement : null;
  const focoGuardado = ativo && ativo.dataset.campo
    ? { campo: ativo.dataset.campo, inicio: ativo.selectionStart, fim: ativo.selectionEnd, valor: ativo.value }
    : null;

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
    linha.append(campoAjuste("profundidade", aj, "dz", "m", "0.1", `gomo-${i}-dz`));
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

  if (focoGuardado) {
    const novo = lista.querySelector(`[data-campo="${focoGuardado.campo}"]`);
    if (novo) {
      novo.value = focoGuardado.valor;
      novo.focus();
      try { novo.setSelectionRange(focoGuardado.inicio, focoGuardado.fim); } catch (e) { /* idem */ }
    }
  }
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

function vista(qual) {
  const sala = lerSala();
  const palco = lerPalco();
  const alvo = new THREE.Vector3(
    0,
    palco.altura + palco.acimaDoPalco + (projeto ? totais(projeto).altura / 2 : 2),
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

// ------------------------------------------------------------------ etiquetas

const caixaEtiquetas = $("etiquetas");
function desenharEtiquetas() {
  const filhos = caixaEtiquetas.children;
  while (filhos.length > etiquetas.length) caixaEtiquetas.removeChild(filhos[filhos.length - 1]);
  while (filhos.length < etiquetas.length) caixaEtiquetas.append(document.createElement("span"));

  const largura = tela.clientWidth, altura = tela.clientHeight;
  const MARGEM_ETIQUETA = 4;
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
    elemento.style.left = Math.min(Math.max(x, meioL + MARGEM_ETIQUETA), largura - meioL - MARGEM_ETIQUETA) + "px";
    elemento.style.top = Math.min(Math.max(y, meioA + MARGEM_ETIQUETA), altura - meioA - MARGEM_ETIQUETA) + "px";
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
  clearTimeout(temporizador);
  temporizador = setTimeout(() => montar(false), ms);
}

document.querySelectorAll("#painel input").forEach(campo => {
  campo.addEventListener("input", () => remontarDaqui());
  campo.addEventListener("change", () => remontarDaqui(0));
});

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
if ($("btRecentrarVista")) $("btRecentrarVista").onclick = () => vista("frente");

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

function carregar(bruto, recentrar = true) {
  try {
    projeto = lerProjeto(bruto);
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
  planta = null; plantaCad = null;
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
  } else {
    $("infoPlanta").innerHTML = "<b>DXF</b>, <b>DWG</b>, <b>PDF</b> ou imagem. O DXF e o " +
      "DWG entram à escala e não se calibram; o PDF e a imagem pedem a largura real.";
    $("notaPlanta").innerHTML = "Um PDF e uma imagem não sabem a escala a que foram " +
      "desenhados. Diz-lhes a <b>largura real</b> que cobrem e o resto sai daí — a grelha " +
      "do chão é de metro a metro, use-a para conferir. Um <b>DWG</b> ou um <b>DXF</b> " +
      "sabem, e entram sozinhos com o tamanho certo.";
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

/** O que se está a fazer, enquanto se faz — carregar 10 MB demora. */
function aTrabalhar(texto) {
  const aviso = $("aviso");
  aviso.textContent = texto;
  aviso.classList.add("mostra");
}

$("ficheiroPlanta").onchange = async () => {
  const ficheiro = $("ficheiroPlanta").files[0];
  $("ficheiroPlanta").value = "";
  if (!ficheiro) return;
  camadasEscondidas.clear();
  camadasLevantadas.clear();
  try {
    if (await eDWG(ficheiro)) {
      // O DWG passa pelo motor e sai DXF; daí para a frente é tudo igual.
      plantaCad = await lerDWG(ficheiro, aTrabalhar);
      planta = null;
      $("aviso").classList.remove("mostra");
    } else if (/\.dxf$/i.test(ficheiro.name)) {
      // Um DXF de uma planta grande são dezenas de MB de texto: lê-se de uma
      // vez e depois já não se lhe toca mais.
      plantaCad = lerDXF(await ficheiro.text());
      planta = null;
    } else if (/\.pdf$/i.test(ficheiro.name) || ficheiro.type === "application/pdf") {
      const pdf = await lerPDF(ficheiro, aTrabalhar);
      planta = pdf.textura;
      plantaCad = null;
      $("aviso").classList.remove("mostra");
      if (pdf.paginas > 1) {
        aTrabalhar(`O PDF tem ${pdf.paginas} páginas — está a usar a primeira.`);
        setTimeout(() => $("aviso").classList.remove("mostra"), 4000);
      }
    } else {
      planta = await texturaDeFicheiro(ficheiro);
      plantaCad = null;
    }
    camposDaPlanta();
    montar(false);
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
};

$("btPadrao").onclick = async () => { textura = await padraoDeTeste(); texturaDataURL = null; montar(false); };
$("btSemConteudo").onclick = () => { textura = null; texturaDataURL = null; montar(false); };
$("btImagem").onclick = () => $("ficheiroImagem").click();
$("ficheiroImagem").onchange = async () => {
  const ficheiro = $("ficheiroImagem").files[0];
  $("ficheiroImagem").value = "";
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
  planta = null;
  plantaCad = null;
  camadasEscondidas.clear();
  camadasLevantadas.clear();
  textura = null;
  texturaDataURL = null;
  texturasPorZona = {};
  texturasPorZonaDataURL = {};
  ondeEsta = null;
  limitesDoShift = null;
  projecaoAtual = null;
  modoConteudo = "espalhado";
  formatoImagem = 1.777;

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
  for (const chave of [CHAVE_PROJETO, CHAVE_PROJETOR, CHAVE_DEVOLUCAO]) {
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
function estadoCompleto() {
  return {
    v: 1,
    tipo: "preview-projeto",
    quando: new Date().toISOString(),
    sala: lerSala(),
    palco: lerPalco(),
    publico: lerPublico(),
    regie: lerRegie(),
    projecao: lerProjecao(),
    projeto,
    ajustes,
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
      verCobertura: $("verCobertura").checked
    }
  };
}

function guardarProjetoTodo() {
  const estado = estadoCompleto();
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  const base = (projeto && projeto.nome ? String(projeto.nome) : "projeto")
    .replace(/[^\p{L}\p{N}\- ]+/gu, "").trim() || "projeto";
  descarregar(blob, `${base}.preview.json`);
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
    throw new Error("Este ficheiro não é um projeto do Preview.");
  }
  const s = estado.sala || {}, p = estado.palco || {}, pu = estado.publico || {},
        r = estado.regie || {}, pj = estado.projecao || {};
  preencherCampo("salaL", s.largura); preencherCampo("salaP", s.profundidade); preencherCampo("salaA", s.altura);
  preencherCampo("palcoL", p.largura); preencherCampo("palcoA", p.altura);
  preencherCampo("palcoP", p.profundidade); preencherCampo("ecraOffset", p.acimaDoPalco);
  preencherCampo("filas", pu.filas); preencherCampo("primeiraFila", pu.primeiraFila);
  preencherCampo("entreFilas", pu.entreFilas); preencherCampo("entreLugares", pu.entreLugares);
  preencherCampo("corredores", pu.corredores); preencherCampo("inclinacao", pu.inclinacao);
  preencherCampo("larguraCorredor", pu.larguraCorredor); preencherCheckbox("sentado", pu.sentado);
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

  const v = estado.visibilidade || {};
  preencherCheckbox("verEcras", v.verEcras); preencherCheckbox("verPlanta", v.verPlanta);
  preencherCheckbox("verMedidas", v.verMedidas); preencherCheckbox("verPublico", v.verPublico);
  preencherCheckbox("verRegie", v.verRegie); preencherCheckbox("verPalco", v.verPalco);
  preencherCheckbox("verOrador", v.verOrador); preencherCheckbox("verParedes", v.verParedes);
  preencherCheckbox("verCobertura", v.verCobertura);

  projeto = estado.projeto || null;
  // "gomos" faltava aqui — ficava undefined (nem um array vazio) em vez de
  // manter os ajustes de cada gomo (largura/corredor/filas/posição). Sem
  // isto, fazerPublicoGomos()/ajustesDeGomosGarantidos() (que fazem
  // "ajustes.gomos[i] = ...") rebentavam ao trocar para "Circular" depois
  // de abrir um projeto guardado — reportado como "tudo desaparece" só
  // nessa vista. Mesma forma que ajustesGuardados() já usa (js/projeto.js).
  ajustes = (estado.ajustes && typeof estado.ajustes === "object")
    ? {
        delays: (estado.ajustes.delays && typeof estado.ajustes.delays === "object") ? estado.ajustes.delays : {},
        dsm: Array.isArray(estado.ajustes.dsm) ? estado.ajustes.dsm : [],
        gomos: Array.isArray(estado.ajustes.gomos) ? estado.ajustes.gomos : []
      }
    : { delays: {}, dsm: [], gomos: [] };
  guardarAjustes(ajustes);

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

  montar(true);
}

$("btGuardarProjeto").onclick = guardarProjetoTodo;
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
    const link = await criarLinkPartilha(estadoCompleto());
    $("linkPartilhaTexto").value = link;
    $("resultadoPartilha").hidden = false;
    $("linkPartilhaTexto").select();
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
  // Uma pergunta antes, porque isto deita fora trabalho: escrever as medidas de
  // uma sala outra vez é chato, e um clique enganado num botão pequeno é fácil.
  const temTrabalho = projeto || planta || plantaCad || textura;
  if (temTrabalho && !confirm("Limpar tudo? O projeto, a planta e as medidas voltam ao princípio.")) return;
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
$("btAnalisar").onclick = async () => {
  const texto = $("colagem").value.trim();
  if (!texto) {
    $("aviso").textContent = "Escreve ou cola primeiro o texto do pedido.";
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
    const salaAgora = {
      largura: num("salaL"), profundidade: num("salaP"), altura: num("salaA")
    };
    const veio = doQueVeioParaCa(await analisar(texto, salaAgora));
    const feitas = [];
    const mantidas = [];
    let comVariosTamanhos = false;

    if (veio.sala) {
      // Um campo que já foi mexido à mão não se escreve por cima. O
      // `defaultValue` é o que está no HTML: se o campo já não é isso, foi
      // alguém que lá mexeu, e o que essa pessoa escreveu vale mais do que uma
      // estimativa feita a partir de um parágrafo.
      const porOMike = (id) => $(id).value !== $(id).defaultValue;
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
    $("aviso").innerHTML = "Ainda não há nada guardado. Nos Calculadores, monta as zonas " +
      "(aba <b>Ecrã Complexo</b>, ou qualquer outra com \"Adicionar ao projeto\") — ficam " +
      "gravadas sozinhas, e depois carregas aqui neste botão.";
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
function devolverAosCalculadores(comAviso) {
  if (!projeto) {
    if (comAviso) $("notaEcra").textContent = "Não há projeto para devolver.";
    return false;
  }
  const t = totais(projeto);
  try {
    const zonas = projeto.zonas.map((zona) => {
      const ajuste = ajustes.delays[zona.nome];
      return {
        nome: zona.nome,
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
  }, ms);
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
let aArrastar = false;

function figuraNaCena() {
  return desenhado ? desenhado.getObjectByName("figura") : null;
}

function porRato(e) {
  const caixa = tela.getBoundingClientRect();
  rato.set(
    ((e.clientX - caixa.left) / caixa.width) * 2 - 1,
    -((e.clientY - caixa.top) / caixa.height) * 2 + 1);
}

tela.addEventListener("pointerdown", (e) => {
  if (!edicaoLivreLigada()) return;   // cadeado fechado: só a câmara mexe
  const figura = figuraNaCena();
  if (!figura) return;
  porRato(e);
  apontador.setFromCamera(rato, camara);
  if (!apontador.intersectObject(figura, true).length) return;

  aArrastar = true;
  controlos.enabled = false;                       // senao a camara vem atras
  tela.setPointerCapture(e.pointerId);
  planoDoPalco.set(new THREE.Vector3(0, 1, 0), -figura.position.y);
  tela.style.cursor = "grabbing";
});

tela.addEventListener("pointermove", (e) => {
  const figura = figuraNaCena();
  if (!figura) return;

  if (!aArrastar) {
    // Um cursor de mao a dizer que aquilo se pega — senao ninguem descobre.
    // Só com o cadeado aberto: fechado, nada se pega, e um cursor de mao a
    // prometer isso enganava.
    if (!edicaoLivreLigada()) { tela.style.cursor = ""; return; }
    porRato(e);
    apontador.setFromCamera(rato, camara);
    tela.style.cursor = apontador.intersectObject(figura, true).length ? "grab" : "";
    return;
  }

  porRato(e);
  apontador.setFromCamera(rato, camara);
  if (!apontador.ray.intersectPlane(planoDoPalco, ondeCaiu)) return;

  const sala = lerSala();
  const palco = lerPalco();
  const noPalco = palco.altura > 0 && palco.profundidade > 0;
  const larguraPalco = Math.min(palco.largura || sala.largura, sala.largura);
  const limiteX = (noPalco ? larguraPalco : sala.largura) / 2 - 0.4;
  const fundoZ = -sala.profundidade / 2 + 0.5;
  const frenteZ = noPalco
    ? -sala.profundidade / 2 + palco.profundidade - 0.3
    : sala.profundidade / 2 - 0.5;

  figura.position.x = Math.max(-limiteX, Math.min(limiteX, ondeCaiu.x));
  figura.position.z = Math.max(fundoZ, Math.min(frenteZ, ondeCaiu.z));
  figura.updateMatrixWorld(true);
  ondeEsta = { x: figura.position.x, z: figura.position.z };
  medirSombra();
});

function largarFigura(e) {
  if (!aArrastar) return;
  aArrastar = false;
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
    setXZ: (x, z) => { ajuste.dx = x; ajuste.dz = z; }
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
    }
  };
}

function objetosArrastaveis() {
  if (!desenhado) return [];
  const publicoAtual = lerPublico();
  const alvos = [];
  desenhado.traverse((o) => {
    if (!o.name) return;
    if (publicoAtual.formato === "circular" && o.name.indexOf("gomo-") === 0) {
      const i = parseInt(o.name.slice(5), 10);
      if (ajustes.gomos[i]) alvos.push({ obj: o, ...alvoDeAjuste(ajustes.gomos[i]) });
    } else if (o.name.indexOf("zona ") === 0) {
      const aj = ajustes.delays[o.name.slice(5)];
      if (aj) alvos.push({ obj: o, ...alvoDeAjuste(aj) });
    } else if (o.name.indexOf("dsm ") === 0) {
      const aj = ajustes.dsm[parseInt(o.name.slice(4), 10) - 1];
      if (aj) alvos.push({ obj: o, ...alvoDeAjuste(aj) });
    } else if (o.name === "regie") {
      alvos.push({ obj: o, ...alvoDeCampos("regieX", "regieZ") });
    }
  });
  return alvos;
}

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
  if (!melhor) return;

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
  remontarDaqui(0);
});

function largarAjuste(e) {
  if (!alvoArrasto) return;
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

async function exportar(formato) {
  const nota = $("notaExportar");
  if (!desenhado) return;

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
    if (projeto.zonas.length) {
      extra.push(fazerZonas(projeto, totais(projeto), salaAtual, palcoAtual, textura, modoConteudo, ajustes.delays, texturasPorZona).grupo);
    }
    if (projeto.dsm) {
      extra.push(fazerDSM(projeto.dsm, salaAtual, palcoAtual, ajustes.dsm, textura).grupo);
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
  "glb": "O <b>.glb</b> leva as cores e o nome de cada zona — é por esse nome que se lhe " +
         "põe a textura no Cinema 4D ou no Blender.",
  "obj": "O <b>.obj</b> abre em tudo, mas vai <b>sem materiais</b>: as peças chegam lá " +
         "cinzentas e pintam-se à mão."
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
  $("notaExportar").innerHTML = NOTAS_DA_SAIDA[qual] || "";
}

document.querySelectorAll("[data-saida]").forEach(b => {
  b.onclick = () => escolherSaida(b.dataset.saida);
});
escolherSaida("png");

$("btGuardar").onclick = () => {
  if (saidaEscolhida === "png") guardarVista();
  else if (saidaEscolhida === "png-medidas") guardarImagem();
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
  if (!aplicarProjetor(projetorGuardado())) {
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
  const projetorTrazido = aplicarProjetor(projetorGuardado());

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

$("btSincronizacao").onclick = () => {
  try {
    // Mesmo formato que os Calculadores usam (JSON.stringify) — ver a nota em
    // sincronizacaoAutomaticaLigada() sobre porque isto tinha de ficar igual
    // dos dois lados.
    localStorage.setItem(CHAVE_SINCRONIZACAO,
      JSON.stringify(sincronizacaoAutomaticaLigada() ? "desligada" : "ligada"));
  } catch (_) {}
  atualizarBotaoSincronizacao();
};
atualizarBotaoSincronizacao();

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
  if (projetor && aplicarProjetor(projetor)) {
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
    if (aplicarProjetor(projetorGuardado())) {
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
window.preview = { THREE, cena, camara, controlos, medirSombra, aplicarProjetor,
                  get projeto() { return projeto; },
                  get desenhado() { return desenhado; },
                  get plantaCad() { return plantaCad; } };

// Um projetor que venha no ENDERECO aplica-se sozinho -- alguem carregou no
// "Ver no Preview 3D" para isto acontecer. Um projetor apenas GUARDADO nao:
// ligar a projecao a quem so queria ver a sala e mexer no desenho sem lho
// pedirem. Nesse caso diz-se que ele esta ali, a espera de um botao.
(function projetorAEspera() {
  const doEndereco = projetorDoEndereco();
  if (doEndereco) {
    aplicarProjetor(doEndereco);
    document.getElementById("sProjecao").classList.remove("fechada");
    return;
  }
  const p = sincronizacaoAutomaticaLigada() ? projetorGuardado() : null;
  if (!p) return;
  $("btTrazerProjetor").textContent = "Trazer: " + (p.modelo || "projetor dos Calculadores");
  $("notaProj").innerHTML = `Está guardado um projetor` +
    (p.modelo ? ` (<b>${p.modelo}</b>)` : "") +
    `: rácio ${p.racio.toFixed(2)}:1 a ${p.distancia.toFixed(2)} m. Carrega no botão para o trazer.`;
})();

montar(true);
volta();
