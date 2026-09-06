// A cena: a sala, o palco, as zonas de LED e o público.
//
// Eixos, para não haver dúvidas mais tarde:
//   X — largura da sala, com o zero ao meio
//   Y — altura, com o zero no chão
//   Z — profundidade; o palco está no fundo (Z negativo) e o público vem para cá
//
// As zonas chegam dos Calculadores com o Y a crescer para BAIXO, que é como se
// lê um alçado. Aqui vira-se ao contrário e assenta-se o conjunto todo em cima
// do palco — que é onde ele assenta na vida real.

import * as THREE from "three";

const COR_CHAO = 0x161C22;
const COR_PAREDE = 0x1B242C;
const COR_PALCO = 0x232D36;

export function fazerCena() {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x0E1418);
  cena.fog = new THREE.Fog(0x0E1418, 40, 140);

  const ambiente = new THREE.HemisphereLight(0xBBD4FF, 0x0E1418, 1.15);
  cena.add(ambiente);

  const sol = new THREE.DirectionalLight(0xFFFFFF, 1.1);
  sol.position.set(6, 14, 10);
  cena.add(sol);

  const contra = new THREE.DirectionalLight(0x5FB0FF, 0.35);
  contra.position.set(-8, 6, -10);
  cena.add(contra);

  return cena;
}

/** A sala: chão, paredes, e uma grelha de metro a metro. */
export function fazerSala({ largura, profundidade, altura }, comGrelha) {
  const grupo = new THREE.Group();

  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, profundidade),
    new THREE.MeshStandardMaterial({ color: COR_CHAO, roughness: 0.95 }));
  chao.rotation.x = -Math.PI / 2;
  grupo.add(chao);

  if (comGrelha) {
    // Grelha feita à mão e não um GridHelper: aquele é sempre quadrado, e numa
    // sala de 20 por 14 ficava a faltar chão de um lado e a sobrar do outro.
    // Aqui a grelha É a régua, por isso tem de bater certo com a sala.
    const pontos = [];
    const meiaL = largura / 2, meiaP = profundidade / 2;
    for (let x = -Math.floor(meiaL); x <= meiaL; x++) pontos.push(x, 0, -meiaP, x, 0, meiaP);
    for (let z = -Math.floor(meiaP); z <= meiaP; z++) pontos.push(-meiaL, 0, z, meiaL, 0, z);
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(pontos, 3));
    const grelha = new THREE.LineSegments(
      geometria, new THREE.LineBasicMaterial({ color: 0x2A3742, transparent: true, opacity: 0.6 }));
    grelha.position.y = 0.005;
    grupo.add(grelha);
  }

  // As paredes são só de um lado: vistas de dentro não tapam nada, e assim a
  // câmara pode andar à volta por fora sem esbarrar em nada.
  const material = new THREE.MeshStandardMaterial({
    color: COR_PAREDE, roughness: 1, side: THREE.BackSide,
    transparent: true, opacity: 0.55
  });
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, profundidade), material);
  caixa.position.y = altura / 2;
  grupo.add(caixa);

  return grupo;
}

/** O palco, encostado ao fundo. */
export function fazerPalco({ largura, profundidade }, palco) {
  if (!palco.altura || !palco.profundidade) return new THREE.Group();
  const grupo = new THREE.Group();
  const caixa = new THREE.Mesh(
    new THREE.BoxGeometry(largura, palco.altura, palco.profundidade),
    new THREE.MeshStandardMaterial({ color: COR_PALCO, roughness: 0.9 }));
  caixa.position.set(0, palco.altura / 2, -profundidade / 2 + palco.profundidade / 2);
  grupo.add(caixa);
  return grupo;
}

/**
 * Uma zona de LED. Se tiver curvatura, é feita de gomos em vez de uma placa só —
 * é assim que ela se monta de verdade, e é a única forma de a curva se ver de
 * cima em vez de ser um desenho na textura.
 */
function fazerZona(zona, alturaBase, z0) {
  const grupo = new THREE.Group();
  const cor = new THREE.Color(zona.cor || "#2E7BFF");

  const frente = new THREE.MeshStandardMaterial({
    color: cor, emissive: cor, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1
  });
  const tras = new THREE.MeshStandardMaterial({ color: 0x11181E, roughness: 1 });
  const materiais = [tras, tras, tras, tras, frente, tras];   // +Z é a frente

  const ESPESSURA = 0.12;
  const gomos = zona.curva ? Math.max(4, Math.min(24, Math.round(zona.w / 0.5))) : 1;
  const anguloTotal = zona.curva
    ? (zona.curva.modo === "raio"
        ? (zona.w / Math.max(0.5, zona.curva.valor)) * (180 / Math.PI)
        : zona.curva.valor)
    : 0;
  const sentido = zona.curva && zona.curva.dir === "concavo" ? -1 : 1;

  const larguraGomo = zona.w / gomos;
  const raio = anguloTotal ? zona.w / (anguloTotal * Math.PI / 180) : 0;

  for (let i = 0; i < gomos; i++) {
    const peca = new THREE.Mesh(
      new THREE.BoxGeometry(larguraGomo * 1.002, zona.h, ESPESSURA), materiais);
    if (anguloTotal) {
      const a = (-anguloTotal / 2 + anguloTotal * (i + 0.5) / gomos) * Math.PI / 180 * sentido;
      peca.position.set(Math.sin(a) * raio, 0, (Math.cos(a) - 1) * raio * sentido);
      peca.rotation.y = -a * sentido;
    } else {
      peca.position.x = -zona.w / 2 + larguraGomo * (i + 0.5);
    }
    grupo.add(peca);
  }

  grupo.position.set(zona.centroX, alturaBase + zona.h / 2, z0);
  return grupo;
}

/**
 * Todas as zonas, assentes no palco e centradas na sala.
 * Devolve o grupo e os pontos onde as etiquetas devem aparecer.
 */
export function fazerZonas(projeto, medidas, sala, palco) {
  const grupo = new THREE.Group();
  const etiquetas = [];

  const esquerda = Math.min(...projeto.zonas.map(z => z.x));
  const fundo = Math.max(...projeto.zonas.map(z => z.y + z.h));
  const meio = (medidas.largura) / 2;
  const base = palco.altura + palco.acimaDoPalco;
  const z0 = -sala.profundidade / 2 + 0.35;

  for (const zona of projeto.zonas) {
    // do canto superior esquerdo do conjunto para o meio da sala
    zona.centroX = (zona.x - esquerda) + zona.w / 2 - meio;
    // e o Y ao contrário: o que estava mais em baixo no alçado assenta no palco
    const alturaBase = base + (fundo - (zona.y + zona.h));
    const peca = fazerZona(zona, alturaBase, z0);
    grupo.add(peca);
    // A etiqueta vai POR CIMA da zona e não em cima dela: ao meio, tapava o
    // painel e fazia uma parede de 3,4 m parecer duas de 1,6.
    etiquetas.push({
      texto: `${zona.nome} · ${zona.w.toFixed(2)} × ${zona.h.toFixed(2)} m`,
      ponto: new THREE.Vector3(zona.centroX, alturaBase + zona.h + 0.32, z0 + 0.2)
    });
  }

  return { grupo, etiquetas, base, z0 };
}

/** Uma pessoa de pé, para escala. Sem cara, sem pretensões. */
export function fazerFigura(altura = 1.75) {
  const grupo = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xE7ECF2, roughness: 0.8 });
  const corpo = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.17, altura - 0.62, 4, 10), material);
  corpo.position.y = (altura - 0.62) / 2 + 0.31;
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), material);
  cabeca.position.y = altura - 0.1;
  grupo.add(corpo, cabeca);
  return grupo;
}

/**
 * O público, em filas. Vai em InstancedMesh porque quatrocentas pessoas em
 * malhas separadas põem qualquer portátil de joelhos, e o número de pessoas é
 * precisamente o que se quer poder mexer à vontade.
 */
export function fazerPublico(sala, palco, publico) {
  const grupo = new THREE.Group();
  if (!publico.filas) return { grupo, olhos: null, lugares: 0 };

  const alturaOlhos = publico.sentado ? 1.20 : 1.62;
  const raioCorpo = publico.sentado ? 0.19 : 0.17;
  const alturaCorpo = publico.sentado ? 0.62 : 1.13;
  const baseCorpo = publico.sentado ? 0.45 : 0.31;

  const larguraUtil = sala.largura - 2.0;
  const porFila = Math.max(1, Math.floor(larguraUtil / publico.entreLugares));
  const total = porFila * publico.filas;

  const material = new THREE.MeshStandardMaterial({ color: 0x54606E, roughness: 0.95 });
  const corpos = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(raioCorpo, alturaCorpo, 3, 8), material, total);
  const cabecas = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.112, 10, 8), material, total);

  const dummy = new THREE.Object3D();
  const zPrimeira = -sala.profundidade / 2 + palco.profundidade + publico.primeiraFila;
  let n = 0;
  let zUltima = zPrimeira;

  for (let f = 0; f < publico.filas; f++) {
    const z = zPrimeira + f * publico.entreFilas;
    if (z > sala.profundidade / 2 - 0.5) break;          // não sai porta fora
    zUltima = z;
    for (let i = 0; i < porFila; i++) {
      const x = -larguraUtil / 2 + publico.entreLugares * (i + 0.5)
                + (f % 2 ? publico.entreLugares / 2 : 0);   // filas alternadas
      if (Math.abs(x) > sala.largura / 2 - 0.6) continue;

      dummy.position.set(x, baseCorpo + alturaCorpo / 2, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      corpos.setMatrixAt(n, dummy.matrix);

      dummy.position.set(x, alturaOlhos + 0.06, z);
      dummy.updateMatrix();
      cabecas.setMatrixAt(n, dummy.matrix);
      n++;
    }
  }
  corpos.count = n;
  cabecas.count = n;
  corpos.instanceMatrix.needsUpdate = true;
  cabecas.instanceMatrix.needsUpdate = true;

  // Sem isto o público desaparece. Um InstancedMesh calcula a esfera que o
  // envolve a partir da GEOMETRIA e não das instâncias: o motor achava que as
  // 192 pessoas eram uma bolha de meio metro na origem, e cortava-as fora do
  // ecrã sempre que a origem saía do enquadramento — ou seja, quase sempre.
  for (const malha of [corpos, cabecas]) {
    if (typeof malha.computeBoundingSphere === "function") malha.computeBoundingSphere();
    else malha.frustumCulled = false;
  }

  grupo.add(corpos, cabecas);

  // De onde se olha quando se quer ver o que a plateia vê. Tem de ser um LUGAR
  // e não um ponto a meio: sentada entre filas, a câmara ficava a 45 cm da nuca
  // do vizinho da frente e não se via mais nada. Num lugar, a cabeça da frente
  // está a uma fila de distância e desencontrada meio lugar — que é a razão de
  // as filas se desencontrarem na vida real.
  const filasFeitas = publico.entreFilas
    ? Math.round((zUltima - zPrimeira) / publico.entreFilas) + 1 : 0;
  const filaDoMeio = Math.floor(filasFeitas / 2);
  const olhos = new THREE.Vector3(
    (filaDoMeio % 2 ? publico.entreLugares / 2 : 0) - (porFila % 2 ? 0 : publico.entreLugares / 2),
    alturaOlhos,
    zPrimeira + filaDoMeio * publico.entreFilas);
  return { grupo, olhos, lugares: n, filas: filasFeitas, porFila };
}
