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
  // O palco tem largura própria: um palco da largura do pavilhão é a excepção,
  // não a regra. Sem valor, assume-se a sala toda.
  const larguraPalco = Math.min(palco.largura || largura, largura);
  const caixa = new THREE.Mesh(
    new THREE.BoxGeometry(larguraPalco, palco.altura, palco.profundidade),
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
  if (!publico.filas) return { grupo, olhos: null, lugares: 0, filas: 0, porFila: 0 };

  const sentado = publico.sentado;
  const alturaOlhos = sentado ? 1.20 : 1.62;

  // Medidas de uma pessoa, e não de uma botija: ombros mais largos do que a
  // cabeça, pescoço, e uma cadeira por baixo. Vistos de trás — que é como a
  // plateia se vê — são os ombros que fazem aquilo parecer gente.
  const OMBROS = 0.46;                       // largura de ombro a ombro
  const RAIO_CABECA = 0.082;                 // 16 cm de largura: uma cabeça, não um balão
  const alturaTronco = sentado ? 0.58 : 0.66;
  const baseTronco = sentado ? (alturaOlhos - 0.16) - alturaTronco : 1.02;

  // Corredores: a largura livre parte-se em blocos, com um corredor entre cada
  // dois. É o que faz a plateia parecer uma sala e não um autocarro — e muda a
  // contagem de lugares, que é a razão a sério para isto existir.
  const corredores = Math.max(0, Math.min(4, publico.corredores || 0));
  const larguraLivre = sala.largura - 2.0;
  const larguraSentada = Math.max(
    publico.entreLugares, larguraLivre - corredores * (publico.larguraCorredor || 0));
  const blocos = corredores + 1;
  const larguraBloco = larguraSentada / blocos;
  const porBloco = Math.max(1, Math.floor(larguraBloco / publico.entreLugares));
  const porFila = porBloco * blocos;
  const total = porFila * publico.filas;

  // Onde começa cada bloco, da esquerda para a direita
  const inicios = [];
  let cursor = -larguraLivre / 2;
  for (let b = 0; b < blocos; b++) {
    const sobra = larguraBloco - porBloco * publico.entreLugares;
    inicios.push(cursor + sobra / 2);
    cursor += larguraBloco + (publico.larguraCorredor || 0);
  }

  const pele = new THREE.MeshStandardMaterial({ color: 0x6B7683, roughness: 0.95 });
  const roupa = new THREE.MeshStandardMaterial({ color: 0x4A5563, roughness: 1 });
  const cadeiraCor = new THREE.MeshStandardMaterial({ color: 0x2A3540, roughness: 1 });

  // Quatro malhas para toda a gente: o custo de desenhar não cresce com o
  // número de pessoas, e é justamente o número de pessoas que se quer mexer.
  const troncos = new THREE.InstancedMesh(
    new THREE.BoxGeometry(OMBROS * 0.78, alturaTronco, 0.28), roupa, total);
  const ombros = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.10, OMBROS - 0.20, 3, 8), roupa, total);
  const cabecas = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAIO_CABECA, 12, 10), pele, total);
  const cadeiras = new THREE.InstancedMesh(
    new THREE.BoxGeometry(publico.entreLugares * 0.82, 0.46, 0.06), cadeiraCor,
    sentado ? total : 1);

  const boneco = new THREE.Object3D();
  const zPrimeira = -sala.profundidade / 2 + palco.profundidade + publico.primeiraFila;
  let n = 0;
  let zUltima = zPrimeira;

  for (let f = 0; f < publico.filas; f++) {
    const z = zPrimeira + f * publico.entreFilas;
    if (z > sala.profundidade / 2 - 0.5) break;          // não sai porta fora
    zUltima = z;
    // A plateia sobe. Sem isto, a cabeça da fila da frente fica exactamente à
    // altura dos teus olhos — e a vista da plateia mostrava uma nuca em vez de
    // responder à pergunta que se lhe faz.
    const sobe = f * (publico.inclinacao || 0);
    for (let i = 0; i < porFila; i++) {
      const bloco = Math.floor(i / porBloco);
      const dentro = i % porBloco;
      // O desencontro de meio lugar é por bloco: assim ninguém fica com a
      // cabeça do da frente à frente dos olhos, que é para isso que ele serve.
      const x = inicios[bloco] + publico.entreLugares * (dentro + 0.5)
                + (f % 2 ? publico.entreLugares / 2 : 0);
      if (Math.abs(x) > sala.largura / 2 - 0.6) continue;

      // Ninguém tem a altura exacta do vizinho, e uma plateia de clones vê-se
      // logo. Uma semente feita da posição chega, e é sempre igual entre
      // desenhos — não há nada pior do que o público saltar a cada tecla.
      const semente = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const variacao = 1 + ((semente - Math.floor(semente)) - 0.5) * 0.09;
      const virado = ((semente * 3 - Math.floor(semente * 3)) - 0.5) * 0.22;

      boneco.rotation.set(0, virado, 0);

      boneco.position.set(x, (baseTronco + alturaTronco / 2) * variacao + sobe, z);
      boneco.scale.set(1, variacao, 1);
      boneco.updateMatrix();
      troncos.setMatrixAt(n, boneco.matrix);

      boneco.scale.set(1, 1, 1);
      boneco.position.set(x, (baseTronco + alturaTronco) * variacao + sobe, z);
      boneco.rotation.set(0, virado, Math.PI / 2);         // deitada, de ombro a ombro
      boneco.updateMatrix();
      ombros.setMatrixAt(n, boneco.matrix);

      boneco.rotation.set(0, virado, 0);
      boneco.position.set(x, (alturaOlhos + 0.055) * variacao + sobe, z);
      boneco.scale.set(1, 1.16, 1.04);                     // a cabeça não é uma bola
      boneco.updateMatrix();
      cabecas.setMatrixAt(n, boneco.matrix);

      if (sentado) {
        boneco.scale.set(1, 1, 1);
        boneco.rotation.set(0, virado, 0);
        boneco.position.set(x, 0.23 + sobe, z + 0.22);      // o encosto, atrás
        boneco.updateMatrix();
        cadeiras.setMatrixAt(n, boneco.matrix);
      }
      n++;
    }
    if (sobe > 0.001) {
      const degrau = new THREE.Mesh(
        new THREE.BoxGeometry(sala.largura - 2.0, sobe + 0.02, publico.entreFilas),
        new THREE.MeshStandardMaterial({ color: 0x1B242C, roughness: 1 }));
      degrau.position.set(0, (sobe + 0.02) / 2, z + publico.entreFilas * 0.1);
      grupo.add(degrau);
    }
  }

  for (const malha of [troncos, ombros, cabecas, cadeiras]) {
    malha.count = malha === cadeiras && !sentado ? 0 : n;
    malha.instanceMatrix.needsUpdate = true;
    // Sem isto o público desaparece: um InstancedMesh calcula a esfera que o
    // envolve a partir da GEOMETRIA e não das instâncias, e o motor achava que
    // a plateia toda era uma bolha de meio metro na origem.
    if (typeof malha.computeBoundingSphere === "function") malha.computeBoundingSphere();
    else malha.frustumCulled = false;
  }
  grupo.add(troncos, ombros, cabecas, cadeiras);

  // De onde se olha quando se quer ver o que a plateia vê. Tem de ser um LUGAR
  // e não um ponto a meio: sentada entre filas, a câmara ficava a 45 cm da nuca
  // do vizinho da frente e não se via mais nada.
  const filasFeitas = publico.entreFilas
    ? Math.round((zUltima - zPrimeira) / publico.entreFilas) + 1 : 0;
  const filaDoMeio = Math.floor(filasFeitas / 2);
  const olhos = new THREE.Vector3(
    (filaDoMeio % 2 ? publico.entreLugares / 2 : 0) - (porFila % 2 ? 0 : publico.entreLugares / 2),
    alturaOlhos + filaDoMeio * (publico.inclinacao || 0),
    zPrimeira + filaDoMeio * publico.entreFilas);
  return { grupo, olhos, lugares: n, filas: filasFeitas, porFila, blocos };
}
