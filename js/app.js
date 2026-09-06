// Preview — ver um projeto dos Calculadores montado numa sala.

import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { EXEMPLO, lerProjeto, totais, projetoDoEndereco,
         projetoGuardado, guardarSala, CHAVE_PROJETO } from "./projeto.js";
import { fazerCena, fazerSala, fazerPalco, fazerZonas, fazerFigura, fazerPublico,
         padraoDeTeste, texturaDeFicheiro, fazerProjecao, pontosDaImagem,
         fazerPlanta } from "./cena.js";

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
let etiquetas = [];
let olhosDaPlateia = null;
let desenhado = null;      // o que está na cena agora, para se poder deitar fora
let textura = null;        // o conteúdo a mostrar nos ecrãs, se houver
let modoConteudo = "espalhado";   // espalhado pelo conjunto, ou um em cada zona
let planta = null;         // a planta da sala, se alguem a tiver aberto
let projecaoAtual = null;  // a lente e a imagem de agora, para medir a sombra
let ondeEsta = null;       // onde o orador foi posto à mão, se foi

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
    base: num("projBase")
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
    sentado: $("sentado").checked
  };
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

  const sala = lerSala();
  const palco = lerPalco();
  const publico = lerPublico();

  desenhado.add(fazerSala(sala, $("verMedidas").checked, $("verParedes").checked));
  if (planta) {
    desenhado.add(fazerPlanta(planta, {
      largura: num("plantaL"), rodar: num("plantaR"),
      x: num("plantaX"), z: num("plantaZ"),
      opacidade: Math.min(1, Math.max(0.05, num("plantaO")))
    }));
  }
  desenhado.add(fazerPalco(sala, palco));

  // Os interruptores existem porque cada vista serve uma pergunta diferente:
  // sem paredes vê-se a sala de fora, sem público vê-se a estrutura, e sem
  // ninguém no palco mede-se o ecrã sem nada a tapá-lo.
  const gente = $("verPublico").checked
    ? fazerPublico(sala, palco, publico)
    : { grupo: new THREE.Group(), olhos: null, lugares: 0, filas: 0, porFila: 0, blocos: 1 };
  desenhado.add(gente.grupo);
  olhosDaPlateia = gente.olhos;

  let medidas = null;
  if (projeto) {
    medidas = totais(projeto);
    const zonas = fazerZonas(projeto, medidas, sala, palco, textura, modoConteudo);
    desenhado.add(zonas.grupo);
    etiquetas = $("verMedidas").checked ? zonas.etiquetas : [];


    avisarSeNaoCabe(medidas, sala, palco);
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
  // levar um número errado para uma reunião.
  if (publico.filas && gente.filas < publico.filas) {
    const aviso = $("aviso");
    const jaTem = aviso.classList.contains("mostra") ? aviso.textContent + " " : "";
    aviso.textContent = jaTem + `Só cabem ${gente.filas} das ${publico.filas} filas: ` +
      `a sala acaba antes.`;
    aviso.classList.add("mostra");
  }

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
  escreverPainel(medidas, gente.lugares, gente);
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
  const imagem = { x: 0, y: p.base + altura / 2, z: z0, largura, altura };
  const projetor = { x: 0, y: p.altura, z: z0 + p.distancia };

  desenhado.add(fazerProjecao(projetor, imagem, textura));
  projecaoAtual = { projetor, imagem, foraDaSala: largura > sala.largura || p.base + altura > sala.altura };
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
function medirSombra() {
  if (!projecaoAtual) { $("resumoProj").textContent = "—"; return; }
  const { projetor, imagem, foraDaSala } = projecaoAtual;

  // A sombra calcula-se, não se amostra. A primeira versão atirava 45 raios
  // para a tela e contava os que batiam no orador — e dava sempre zero, porque
  // os pontos ficavam a quase um metro uns dos outros e uma pessoa tem 58 cm:
  // ela passava entre as amostras. Agora projeta-se a caixa que a envolve a
  // partir da lente e mede-se a área que ela tapa. É exacto e não treme.
  let sombra = 0;
  const figura = desenhado && desenhado.getObjectByName("figura");
  if (figura) {
    figura.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(figura);
    const lente = new THREE.Vector3(projetor.x, projetor.y, projetor.z);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let algumAFrente = false;
    for (const cx of [caixa.min.x, caixa.max.x]) {
      for (const cy of [caixa.min.y, caixa.max.y]) {
        for (const cz of [caixa.min.z, caixa.max.z]) {
          const dz = cz - lente.z;
          const ate = imagem.z - lente.z;
          // só conta quem está ENTRE a lente e a tela
          if (dz === 0 || dz / ate <= 0 || dz / ate >= 1) continue;
          algumAFrente = true;
          const k = ate / dz;
          minX = Math.min(minX, lente.x + (cx - lente.x) * k);
          maxX = Math.max(maxX, lente.x + (cx - lente.x) * k);
          minY = Math.min(minY, lente.y + (cy - lente.y) * k);
          maxY = Math.max(maxY, lente.y + (cy - lente.y) * k);
        }
      }
    }

    if (algumAFrente) {
      const eEsq = imagem.x - imagem.largura / 2, eDir = imagem.x + imagem.largura / 2;
      const eBaixo = imagem.y - imagem.altura / 2, eCima = imagem.y + imagem.altura / 2;
      const larg = Math.max(0, Math.min(maxX, eDir) - Math.max(minX, eEsq));
      const alt = Math.max(0, Math.min(maxY, eCima) - Math.max(minY, eBaixo));
      sombra = (larg * alt) / (imagem.largura * imagem.altura);
    }
  }

  const porCento = Math.round(sombra * 100);
  $("resumoProj").innerHTML =
    `Imagem <b>${imagem.largura.toFixed(2)} × ${imagem.altura.toFixed(2)} m</b>` +
    (sombra > 0.001
      ? ` · sombra do orador <b>${porCento < 1 ? "menos de 1" : porCento}%</b>`
      : "") +
    (foraDaSala ? " · <b>não cabe na sala</b>" : "");
}

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

// ------------------------------------------------------------------- painel

function escreverPainel(medidas, lugares, gentePosta) {
  const resumo = $("resumo");
  const lista = $("listaZonas");

  if (!projeto) {
    resumo.className = "vazio";
    resumo.textContent = "Sem projeto. Cola aqui o que vem dos Calculadores.";
    lista.className = "vazio";
    lista.textContent = "—";
  } else {
    const res = projeto.zonas.reduce((t, z) => t + ((z.res && z.res.x * z.res.y) || 0), 0);
    resumo.className = "";
    resumo.innerHTML =
      `<b>${medidas.largura.toFixed(2)} × ${medidas.altura.toFixed(2)} m</b> · ` +
      `${medidas.zonas} zona${medidas.zonas === 1 ? "" : "s"}` +
      (medidas.peso ? ` · <b>${Math.round(medidas.peso)}</b> kg` : "") +
      (medidas.amp ? ` · <b>${medidas.amp.toFixed(1)}</b> A` : "") +
      (res ? ` · <b>${(res / 1e6).toFixed(1)}</b> Mpx` : "");

    lista.className = "";
    lista.innerHTML = "";
    for (const z of projeto.zonas) {
      const linha = document.createElement("div");
      linha.className = "zona";
      const cor = document.createElement("i");
      cor.className = "cor";
      cor.style.background = z.cor;
      const nome = document.createElement("span");
      nome.textContent = z.nome;
      const med = document.createElement("span");
      med.className = "med";
      med.textContent = `${z.w.toFixed(2)} × ${z.h.toFixed(2)} m`;
      linha.append(cor, nome, med);
      lista.append(linha);
    }
  }

  $("rodape").textContent = lugares
    ? `${lugares} lugares — ${gentePosta.filas} fila${gentePosta.filas === 1 ? "" : "s"} ` +
      `de ${gentePosta.porFila}` +
      (gentePosta.blocos > 1 ? `, em ${gentePosta.blocos} blocos.` : ".")
    : "Sem público no desenho.";
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
  etiquetas.forEach((etiqueta, i) => {
    const elemento = filhos[i];
    const p = etiqueta.ponto.clone().project(camara);
    const atras = p.z > 1;
    elemento.style.display = atras ? "none" : "block";
    if (atras) return;
    elemento.textContent = etiqueta.texto;
    elemento.style.left = ((p.x * 0.5 + 0.5) * largura) + "px";
    elemento.style.top = ((-p.y * 0.5 + 0.5) * altura) + "px";
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
    aviso.textContent = e.message;
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
$("btSemPlanta").onclick = () => { planta = null; montar(false); };
$("ficheiroPlanta").onchange = async () => {
  const ficheiro = $("ficheiroPlanta").files[0];
  $("ficheiroPlanta").value = "";
  if (!ficheiro) return;
  try {
    planta = await texturaDeFicheiro(ficheiro);
    montar(false);
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
};

$("btPadrao").onclick = async () => { textura = await padraoDeTeste(); montar(false); };
$("btSemConteudo").onclick = () => { textura = null; montar(false); };
$("btImagem").onclick = () => $("ficheiroImagem").click();
$("ficheiroImagem").onchange = async () => {
  const ficheiro = $("ficheiroImagem").files[0];
  $("ficheiroImagem").value = "";
  if (!ficheiro) return;
  try {
    textura = await texturaDeFicheiro(ficheiro);
    montar(false);
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
};

$("btCarregar").onclick = () => carregar($("colagem").value);
$("btExemplo").onclick = () => {
  $("colagem").value = JSON.stringify(EXEMPLO, null, 2);
  carregar(EXEMPLO);
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

$("btDevolver").onclick = () => {
  if (!projeto) { $("notaEcra").textContent = "Não há projeto para devolver."; return; }
  const t = totais(projeto);
  try {
    localStorage.setItem("mikeapps-ecra-v1", JSON.stringify({
      v: 1, largura: +t.largura.toFixed(2), altura: +t.altura.toFixed(2),
      zonas: projeto.zonas.length, quando: new Date().toISOString()
    }));
    $("notaEcra").textContent =
      `Enviado: ${t.largura.toFixed(2)} × ${t.altura.toFixed(2)} m. Nos Calculadores, ` +
      `na aba Ecrã LED, carrega em "Trazer do Preview".`;
  } catch (e) {
    $("notaEcra").textContent = "Não consegui guardar — o browser não deixa.";
  }
};

// --------------------------------------------------------- guardar a imagem
//
// Um printscreen perde as etiquetas e os numeros, que sao metade do que ali
// interessa -- e uma imagem que so mostra caixas azuis nao serve para mandar a
// ninguem. Por isso o desenho e recomposto: a cena, as etiquetas por cima, e
// uma tira em baixo com as contas.

function guardarImagem() {
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

  // a tira com as contas
  const linha = [
    $("resumo").textContent.replace(/\s+/g, " ").trim(),
    $("rodape").textContent.trim(),
    $("resumoProj").textContent.trim()
  ].filter(t => t && t !== "—").join("   ·   ");
  p.fillStyle = "#141B21";
  p.fillRect(0, tela.height, folha.width, folha.height - tela.height);
  p.fillStyle = "#8A97A6";
  p.textAlign = "left";
  p.font = `${Math.round(13 * escala)}px "Segoe UI", system-ui, sans-serif`;
  p.fillText(linha, 16 * escala, tela.height + (folha.height - tela.height) / 2);

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

$("btGuardarImagem").onclick = guardarImagem;

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

// O convite a instalar. O evento do Chrome não chega a toda a gente — no
// iPhone não existe de todo — por isso, quando ele não vem, explica-se o
// caminho à mão em vez de deixar a app sem forma de ser instalada.
(function convite() {
  const naApp = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (naApp) return;
  const agente = navigator.userAgent;
  const iPhone = /iPad|iPhone|iPod/.test(agente) && !window.MSStream;
  let guardado = null;

  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    guardado = e;
    $("btInstalar").hidden = false;
    $("comoInstalar").hidden = true;
  });

  $("btInstalar").onclick = async () => {
    if (!guardado) return;
    guardado.prompt();
    await guardado.userChoice;
    guardado = null;
    $("btInstalar").hidden = true;
  };

  if (iPhone) {
    $("comoInstalar").textContent =
      "Para instalar: Partilhar ⬆︎ e depois \"Adicionar ao Ecrã Principal\".";
    $("comoInstalar").hidden = false;
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
  });
})();

// ------------------------------------------------------------------ arranque

try {
  // Primeiro o que vem no endereço (foi alguém que carregou no "Ver em 3D"),
  // depois o último que os Calculadores deixaram guardado — assim abrir o
  // preview sozinho já mostra o projeto em que se andava a trabalhar.
  projeto = projetoDoEndereco() || projetoGuardado();
} catch (e) {
  $("aviso").textContent = e.message;
  $("aviso").classList.add("mostra");
}

// E se os Calculadores mexerem nas zonas noutra aba, isto acompanha. O evento
// só chega às OUTRAS abas do mesmo domínio, que é exactamente o caso: as duas
// apps lado a lado.
addEventListener("storage", (e) => {
  if (e.key !== CHAVE_PROJETO || !e.newValue) return;
  try {
    projeto = lerProjeto(e.newValue);
    montar(false);
    const aviso = $("aviso");
    aviso.textContent = "Os Calculadores mudaram o projeto — atualizei.";
    aviso.classList.add("mostra");
    setTimeout(() => aviso.classList.remove("mostra"), 2600);
  } catch (_) { /* o que veio não servia; fica o que estava */ }
});

// Porta de serviço: dá para espreitar a cena da consola do browser, e é por
// aqui que se percebe o que não está a ser desenhado sem ter de adivinhar.
window.preview = { THREE, cena, camara, controlos, medirSombra,
                  get projeto() { return projeto; } };

montar(true);
volta();
