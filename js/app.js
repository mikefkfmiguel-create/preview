// Preview — ver um projeto dos Calculadores montado numa sala.

import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { EXEMPLO, lerProjeto, totais, projetoDoEndereco } from "./projeto.js";
import { fazerCena, fazerSala, fazerPalco, fazerZonas, fazerFigura, fazerPublico } from "./cena.js";

const $ = (id) => document.getElementById(id);
const tela = $("tela");

const renderizador = new THREE.WebGLRenderer({ canvas: tela, antialias: true });
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

// ------------------------------------------------------------------ leituras

const num = (id) => parseFloat($(id).value) || 0;

function lerSala() {
  return { largura: num("salaL"), profundidade: num("salaP"), altura: num("salaA") };
}
function lerPalco() {
  return { altura: num("palcoA"), profundidade: num("palcoP"), acimaDoPalco: num("ecraOffset") };
}
function lerPublico() {
  return {
    filas: Math.round(num("filas")),
    primeiraFila: num("primeiraFila"),
    entreFilas: num("entreFilas"),
    entreLugares: num("entreLugares"),
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
  if (desenhado) limpar(desenhado);
  desenhado = new THREE.Group();
  etiquetas = [];
  olhosDaPlateia = null;

  const sala = lerSala();
  const palco = lerPalco();
  const publico = lerPublico();

  desenhado.add(fazerSala(sala, $("verMedidas").checked));
  desenhado.add(fazerPalco(sala, palco));

  const gente = fazerPublico(sala, palco, publico);
  desenhado.add(gente.grupo);
  olhosDaPlateia = gente.olhos;

  let medidas = null;
  if (projeto) {
    medidas = totais(projeto);
    const zonas = fazerZonas(projeto, medidas, sala, palco);
    desenhado.add(zonas.grupo);
    etiquetas = $("verMedidas").checked ? zonas.etiquetas : [];

    // uma pessoa ao pé do palco, que é o que dá a medida a tudo o resto
    const figura = fazerFigura(1.75);
    figura.position.set(
      -Math.min(sala.largura / 2 - 1, medidas.largura / 2 + 1.2),
      palco.altura,
      -sala.profundidade / 2 + palco.profundidade - 0.6);
    desenhado.add(figura);

    avisarSeNaoCabe(medidas, sala, palco);
  }

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
  escreverPainel(medidas, gente.lugares, gente);
  if (recentrarCamara) vista("frente");
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
  } else {
    aviso.classList.remove("mostra");
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
      `de ${gentePosta.porFila}.`
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

document.querySelectorAll(".vistas button").forEach(b => {
  b.onclick = () => vista(b.dataset.vista);
});

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

$("btCarregar").onclick = () => carregar($("colagem").value);
$("btExemplo").onclick = () => {
  $("colagem").value = JSON.stringify(EXEMPLO, null, 2);
  carregar(EXEMPLO);
};

// ------------------------------------------------------------------ arranque

try {
  const doEndereco = projetoDoEndereco();
  if (doEndereco) projeto = doEndereco;
} catch (e) {
  $("aviso").textContent = e.message;
  $("aviso").classList.add("mostra");
}

// Porta de serviço: dá para espreitar a cena da consola do browser, e é por
// aqui que se percebe o que não está a ser desenhado sem ter de adivinhar.
window.preview = { cena, camara, controlos, get projeto() { return projeto; } };

montar(true);
volta();
