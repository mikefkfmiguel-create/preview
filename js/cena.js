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
export function fazerSala({ largura, profundidade, altura }, comGrelha, comParedes) {
  const grupo = new THREE.Group();
  grupo.name = "sala";

  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, profundidade),
    new THREE.MeshStandardMaterial({ color: COR_CHAO, roughness: 0.95 }));
  chao.rotation.x = -Math.PI / 2;
  chao.name = "chao";
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
    grelha.name = "aux:grelha";
    grelha.position.y = 0.005;
    grupo.add(grelha);
  }

  // As paredes são só de um lado: vistas de dentro não tapam nada, e assim a
  // câmara pode andar à volta por fora sem esbarrar em nada.
  if (comParedes) {
    const material = new THREE.MeshStandardMaterial({
      color: COR_PAREDE, roughness: 1, side: THREE.BackSide,
      transparent: true, opacity: 0.55
    });
    const caixa = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, profundidade), material);
    caixa.name = "paredes";
    caixa.position.y = altura / 2;
    grupo.add(caixa);
  }

  return grupo;
}

/** O palco, encostado ao fundo. */
export function fazerPalco({ largura, profundidade }, palco) {
  if (!palco.altura || !palco.profundidade) return new THREE.Group();
  const grupo = new THREE.Group();
  grupo.name = "palco";
  // O palco tem largura própria: um palco da largura do pavilhão é a excepção,
  // não a regra. Sem valor, assume-se a sala toda.
  const larguraPalco = Math.min(palco.largura || largura, largura);
  const caixa = new THREE.Mesh(
    new THREE.BoxGeometry(larguraPalco, palco.altura, palco.profundidade),
    new THREE.MeshStandardMaterial({ color: COR_PALCO, roughness: 0.9 }));
  caixa.name = "palco";
  caixa.position.set(0, palco.altura / 2, -profundidade / 2 + palco.profundidade / 2);
  grupo.add(caixa);
  return grupo;
}

/**
 * A régie: o lugar reservado a quem opera som, luz e vídeo — e não se senta
 * na plateia. Marca-se um rectângulo no chão (para se ver logo que ali não há
 * lugares) com uma mesa por cima, virada para o palco.
 *
 * Tem sempre pelo menos 2×2 m — é o que cabe uma mesa de mistura e alguém
 * atrás dela — mas cresce e desloca-se pelos campos, como o palco. Roda para
 * se poder encostar a uma parede lateral em vez de ficar sempre de frente
 * para o palco, e sobe com o degrau da plateia num auditório -- senão ficava
 * a meio caminho dentro do chão, e não em cima dele.
 *
 * Ao contrário da primeira versão, aqui é o GRUPO que leva a posição e a
 * rotação -- as peças ficam todas na origem local. Posicionar cada peça já
 * em coordenadas do mundo (como se fazia antes) funciona sem rotação, mas
 * assim que se roda o grupo, tudo passa a rodar à volta do CANTO da sala em
 * vez de rodar no próprio sítio.
 */
export function fazerRegie(sala, regie) {
  const grupo = new THREE.Group();
  grupo.name = "regie";
  const largura = Math.max(2, regie.largura || 2);
  const profundidade = Math.max(2, regie.profundidade || 2);

  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, profundidade),
    new THREE.MeshStandardMaterial({
      color: 0x8A6D2E, roughness: 1, transparent: true, opacity: 0.35, depthWrite: false
    }));
  chao.name = "regie-chao";
  chao.rotation.x = -Math.PI / 2;
  chao.position.y = 0.012;
  grupo.add(chao);

  // O contorno é só uma ajuda de leitura -- marca "aux:" como a grelha e as
  // outras linhas que não existem na sala a sério, e por isso fica de fora
  // quando isto se exporta para o Cinema 4D.
  const contorno = new THREE.LineSegments(
    new THREE.EdgesGeometry(chao.geometry),
    new THREE.LineBasicMaterial({ color: 0xC9A227 }));
  contorno.name = "aux:regie-contorno";
  contorno.rotation.copy(chao.rotation);
  contorno.position.set(0, 0.014, 0);
  grupo.add(contorno);

  // A mesa, virada para o palco (-Z local) e encostada à metade da frente do
  // rectângulo -- é daí que se opera, não do meio do espaço reservado. Roda
  // com o resto do grupo, por isso vira sempre para o mesmo lado do
  // rectângulo, mesmo com a régie de lado na sala.
  const mesa = new THREE.Mesh(
    new THREE.BoxGeometry(largura * 0.8, 0.9, Math.min(0.6, profundidade * 0.4)),
    new THREE.MeshStandardMaterial({ color: 0x2A2320, roughness: 0.8 }));
  mesa.name = "regie-mesa";
  mesa.position.set(0, 0.45, -profundidade / 2 + 0.35);
  grupo.add(mesa);

  grupo.rotation.y = -(regie.rodar || 0) * Math.PI / 180;
  grupo.position.set(regie.x || 0, regie.elevacao || 0, regie.z || 0);

  return grupo;
}

/**
 * Uma zona de LED. Se tiver curvatura, é feita de gomos em vez de uma placa só —
 * é assim que ela se monta de verdade, e é a única forma de a curva se ver de
 * cima em vez de ser um desenho na textura.
 */
function fazerZona(zona, alturaBase, z0, conteudo) {
  const grupo = new THREE.Group();
  const cor = new THREE.Color(zona.cor || "#2E7BFF");
  const tras = new THREE.MeshStandardMaterial({ color: 0x11181E, roughness: 1 });

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

  // A imagem tem de se fatiar como os gomos se fatiam. Antes, os N gomos de
  // uma zona curva partilhavam todos o MESMO material -- o recorte pensado
  // para a placa inteira -- e cada gomo, com o seu UV de 0 a 1, mostrava essa
  // imagem toda encolhida na sua fatia estreita. O resultado era a mesma
  // imagem repetida gomo a gomo, em vez de contínua ao longo da curva: daí
  // parecer "em pedaços". Cada gomo passa a ter o SEU material, com só a
  // fatia horizontal que lhe compete.
  function frenteDoGomo(i) {
    if (!conteudo || !conteudo.textura) {
      return new THREE.MeshStandardMaterial({
        color: cor, emissive: cor, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1
      });
    }
    const fatia = conteudo.textura.clone();
    fatia.needsUpdate = true;
    if (conteudo.modo === "cada") {
      // Uma imagem inteira em CADA zona -- o gomo mostra só a tira horizontal
      // que lhe cabe dentro dessa imagem.
      fatia.repeat.set(1 / gomos, 1);
      fatia.offset.set(i / gomos, 0);
    } else {
      // A imagem é UMA só, espalhada pelo conjunto todo -- o recorte da zona
      // reparte-se outra vez, agora pelo gomo, na mesma fracção do canvas.
      fatia.repeat.set((zona.w / gomos) / conteudo.largura, zona.h / conteudo.altura);
      fatia.offset.set(
        (zona.x - conteudo.esquerda + i * larguraGomo) / conteudo.largura,
        1 - (zona.y - conteudo.topo + zona.h) / conteudo.altura);
    }
    return new THREE.MeshStandardMaterial({
      map: fatia, emissiveMap: fatia, emissive: 0xFFFFFF,
      emissiveIntensity: 0.85, roughness: 0.45, metalness: 0
    });
  }

  for (let i = 0; i < gomos; i++) {
    const materiais = [tras, tras, tras, tras, frenteDoGomo(i), tras];   // +Z é a frente
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
export function fazerZonas(projeto, medidas, sala, palco, textura, modoConteudo) {
  const grupo = new THREE.Group();
  const etiquetas = [];

  const esquerda = Math.min(...projeto.zonas.map(z => z.x));
  const fundo = Math.max(...projeto.zonas.map(z => z.y + z.h));
  const meio = (medidas.largura) / 2;
  const base = palco.altura + palco.acimaDoPalco;
  const z0 = -sala.profundidade / 2 + 0.35;

  const topo = Math.min(...projeto.zonas.map(z => z.y));
  const conteudo = textura ? {
    textura, esquerda, topo, modo: modoConteudo,
    largura: medidas.largura, altura: medidas.altura
  } : null;

  for (const zona of projeto.zonas) {
    // do canto superior esquerdo do conjunto para o meio da sala
    zona.centroX = (zona.x - esquerda) + zona.w / 2 - meio;
    // e o Y ao contrário: o que estava mais em baixo no alçado assenta no palco
    const alturaBase = base + (fundo - (zona.y + zona.h));
    const peca = fazerZona(zona, alturaBase, z0, conteudo);
    // O nome viaja para o Cinema 4D: e por ele que, do outro lado, se escolhe
    // a zona a que se vai por a textura de verdade.
    peca.name = "zona " + zona.nome;
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

/**
 * Uma pessoa de pé, para escala. Sem cara e sem pretensões — mas com pernas,
 * ombros e braços: uma cápsula com uma bola em cima não é uma pessoa, é uma
 * botija de gás, e a figura que dá a medida a tudo o resto não pode ser a
 * coisa que se lê pior no desenho.
 */
export function fazerFigura(altura = 1.75, cores) {
  const grupo = new THREE.Group();
  grupo.name = "figura";
  // As cores vem de fora quando quem pede e a plateia: um orador claro no
  // palco le-se bem, mas quatrocentos oradores claros na plateia roubam o
  // ecra -- e o que interessa ver e o ecra.
  const pele = (cores && cores.pele)
    || new THREE.MeshStandardMaterial({ color: 0xD7DEE8, roughness: 0.85 });
  const roupa = (cores && cores.roupa)
    || new THREE.MeshStandardMaterial({ color: 0xAAB6C4, roughness: 0.95 });

  // As peças vão num grupo interior para se poderem descer e escalar de uma
  // vez no fim: os pés têm de assentar mesmo no chão e o topo cair mesmo na
  // altura pedida. Uma figura de escala que mede 1,71 mente sobre tudo o que
  // está ao lado dela.
  const interior = new THREE.Group();
  grupo.add(interior);
  const por = (malha, x, y, z, rot) => {
    malha.position.set(x, y, z || 0);
    if (rot) malha.rotation.z = rot;
    interior.add(malha);
    return malha;
  };

  // pernas
  for (const lado of [-1, 1]) {
    por(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.62, 3, 8), roupa),
        lado * 0.095, 0.42, 0);
  }
  // tronco e ombros
  por(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.23), roupa), 0, 1.10, 0);
  por(new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.26, 3, 8), roupa),
      0, 1.34, 0, Math.PI / 2);
  // braços, ao lado do corpo
  for (const lado of [-1, 1]) {
    por(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.46, 3, 8), roupa),
        lado * 0.235, 1.06, 0);
  }
  // pescoço e cabeça
  por(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), pele), 0, 1.50, 0);
  // O topo da cabeça tem de cair nos 1,75: uma figura de escala que mede 1,70
  // mente sobre tudo o que está ao lado dela.
  const cabeca = por(new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), pele), 0, 1.655, 0);
  cabeca.scale.set(1, 1.16, 1.04);

  const caixa = new THREE.Box3().setFromObject(interior);
  interior.position.y = -caixa.min.y;                       // pés no chão
  grupo.scale.setScalar(altura / (caixa.max.y - caixa.min.y));  // altura certa
  return grupo;
}

/**
 * O público, em filas. Vai em InstancedMesh porque quatrocentas pessoas em
 * malhas separadas põem qualquer portátil de joelhos, e o número de pessoas é
 * precisamente o que se quer poder mexer à vontade.
 */
export function fazerPublico(sala, palco, publico, regie) {
  const grupo = new THREE.Group();
  grupo.name = "publico";
  if (!publico.filas) {
    return { grupo, olhos: null, lugares: 0, filas: 0, porFila: 0,
             corpos: new Float32Array(0), largura: 0.46, fundura: 0.34 };
  }

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
  // A distância da audiência aos limites laterais da sala usa a MESMA largura
  // dos corredores, e não um metro fixo à parte: é a mesma pergunta — "que
  // folga entre filas de cadeiras?" — só que respondida também do lado de
  // fora, e não faz sentido responder-lhe duas vezes de forma diferente.
  const margemLateral = publico.larguraCorredor || 1.2;
  const larguraLivre = sala.largura - 2 * margemLateral;
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

  // Visto de tras -- que e como a plateia se ve na maior parte das vistas --
  // uma pessoa sentada e uma cadeira escura com ombros e cabeca por cima. Se a
  // cadeira e o tronco tiverem cores parecidas, funde-se tudo numa coluna com
  // uma bola em cima. Dai as tres cores bem separadas.
  const pele = new THREE.MeshStandardMaterial({ color: 0x8A96A5, roughness: 0.9 });
  const roupa = new THREE.MeshStandardMaterial({ color: 0x5A6675, roughness: 1 });
  const cadeiraCor = new THREE.MeshStandardMaterial({ color: 0x1C242C, roughness: 1 });

  // De pe, o publico E a figura do orador -- a mesma, com pernas, bracos e
  // ombros. Ha uma so figura, feita uma vez; o que se repete sao as pecas
  // dela em InstancedMesh, uma por peca, com a matriz de cada pessoa por
  // cima da matriz da peca. Assim quatrocentas pessoas de pe custam sete
  // malhas, e nao quatrocentos grupos.
  const pecasDePe = [];
  if (!sentado) {
    const modelo = fazerFigura(1.75, { pele, roupa });
    modelo.updateMatrixWorld(true);
    modelo.traverse((o) => {
      if (!o.isMesh) return;
      pecasDePe.push({
        local: o.matrixWorld.clone(),
        malha: new THREE.InstancedMesh(o.geometry, o.material, total)
      });
    });
  }

  // Sentados, quatro malhas para toda a gente: o custo de desenhar não cresce
  // com o número de pessoas, e é justamente o número de pessoas que se quer
  // mexer.
  const troncos = new THREE.InstancedMesh(
    new THREE.BoxGeometry(OMBROS * 0.66, alturaTronco, 0.26), roupa, total);
  const ombros = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.10, OMBROS - 0.20, 3, 8), roupa, total);
  const cabecas = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAIO_CABECA, 12, 10), pele, total);
  // O encosto sobe ate meio das costas: e ele que diz "isto e uma cadeira".
  const cadeiras = new THREE.InstancedMesh(
    new THREE.BoxGeometry(publico.entreLugares * 0.80, 0.62, 0.07), cadeiraCor,
    sentado ? total : 1);

  const boneco = new THREE.Object3D();
  const matrizDaPeca = new THREE.Matrix4();
  // Onde está cada pessoa e até que altura ela chega. Serve para a sombra: o
  // feixe do projetor passa por cima de umas cabeças e bate noutras, e essa é
  // a pergunta que se faz a olhar para uma sala cheia. Uma caixa por PESSOA,
  // e não uma por peça do corpo — três vezes menos contas e dá o mesmo.
  const corpos = [];
  const zPrimeira = -sala.profundidade / 2 + palco.profundidade + publico.primeiraFila;
  let n = 0;
  let zUltima = zPrimeira;

  for (let f = 0; f < publico.filas; f++) {
    const z = zPrimeira + f * publico.entreFilas;
    // A mesma margem dos corredores, agora atrás: "toda a volta da sala" é a
    // mesma pergunta nas quatro direções, e só a frente tem resposta própria
    // (a distância ao palco, que é a "primeira fila a" — não uma folga de
    // corredor, mas a distância a quem está a falar).
    if (z > sala.profundidade / 2 - margemLateral) break;
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
      // A mesma margem outra vez, e não um número à parte — um corredor mais
      // estreito do que 0,6 m não podia deixar gente mais perto da parede do
      // que essa margem promete.
      if (Math.abs(x) > sala.largura / 2 - margemLateral) continue;

      // A régie não é um lugar de plateia — quem lá está opera, não assiste
      // sentado nesse mesmo metro quadrado. Um lugar que caia dentro do
      // rectângulo dela salta-se, e fica ali um vão em vez de uma cadeira.
      //
      // O rectângulo pode estar rodado (encostado a uma parede lateral, por
      // exemplo), por isso o lugar não se testa em X/Z do mundo directamente:
      // primeiro traz-se para o referencial da régie -- rodado ao contrário
      // do que ela está -- e só depois se pergunta se cai dentro da caixa,
      // que aí volta a ser só largura/2 e profundidade/2.
      if (regie) {
        const rodarRad = (regie.rodar || 0) * Math.PI / 180;
        const dx = x - regie.x;
        const dz = z - regie.z;
        const localX = dx * Math.cos(rodarRad) + dz * Math.sin(rodarRad);
        const localZ = -dx * Math.sin(rodarRad) + dz * Math.cos(rodarRad);
        if (Math.abs(localX) < regie.largura / 2 && Math.abs(localZ) < regie.profundidade / 2) continue;
      }

      // Ninguém tem a altura exacta do vizinho, e uma plateia de clones vê-se
      // logo. Uma semente feita da posição chega, e é sempre igual entre
      // desenhos — não há nada pior do que o público saltar a cada tecla.
      const semente = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const variacao = 1 + ((semente - Math.floor(semente)) - 0.5) * 0.09;
      const virado = ((semente * 3 - Math.floor(semente * 3)) - 0.5) * 0.22;

      if (!sentado) {
        // De pe: a figura inteira, na posicao e na altura desta pessoa.
        boneco.position.set(x, sobe, z);
        boneco.rotation.set(0, virado, 0);
        boneco.scale.set(1, variacao, 1);
        boneco.updateMatrix();
        for (const peca of pecasDePe) {
          matrizDaPeca.multiplyMatrices(boneco.matrix, peca.local);
          peca.malha.setMatrixAt(n, matrizDaPeca);
        }
        corpos.push(x, 1.75 * variacao + sobe, z, sobe);
        n++;
        continue;
      }

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
        boneco.position.set(x, 0.31 + sobe, z + 0.20);      // o encosto, atrás
        boneco.updateMatrix();
        cadeiras.setMatrixAt(n, boneco.matrix);
      }
      corpos.push(x, (alturaOlhos + 0.055) * variacao + sobe + RAIO_CABECA * 1.16, z, sobe);
      n++;
    }
    if (sobe > 0.001) {
      const degrau = new THREE.Mesh(
        new THREE.BoxGeometry(sala.largura - 2.0, sobe + 0.02, publico.entreFilas),
        new THREE.MeshStandardMaterial({ color: 0x1B242C, roughness: 1 }));
      degrau.name = "degrau";
      degrau.position.set(0, (sobe + 0.02) / 2, z + publico.entreFilas * 0.1);
      grupo.add(degrau);
    }
  }

  for (const malha of [troncos, ombros, cabecas, cadeiras]) {
    malha.count = sentado ? n : 0;
    malha.instanceMatrix.needsUpdate = true;
    // Sem isto o público desaparece: um InstancedMesh calcula a esfera que o
    // envolve a partir da GEOMETRIA e não das instâncias, e o motor achava que
    // a plateia toda era uma bolha de meio metro na origem.
    if (typeof malha.computeBoundingSphere === "function") malha.computeBoundingSphere();
    else malha.frustumCulled = false;
  }
  troncos.name = "publico-troncos";
  ombros.name = "publico-ombros";
  cabecas.name = "publico-cabecas";
  cadeiras.name = "publico-cadeiras";
  grupo.add(troncos, ombros, cabecas, cadeiras);

  for (const peca of pecasDePe) {
    peca.malha.count = n;
    peca.malha.instanceMatrix.needsUpdate = true;
    if (typeof peca.malha.computeBoundingSphere === "function") peca.malha.computeBoundingSphere();
    else peca.malha.frustumCulled = false;
    peca.malha.name = "publico-figura";
    grupo.add(peca.malha);
  }

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
  return {
    grupo, olhos, lugares: n, filas: filasFeitas, porFila, blocos,
    // x, topo da cabeça, z e o chão debaixo dela — quatro números por pessoa
    corpos: new Float32Array(corpos), largura: OMBROS, fundura: 0.34,
    // As distancias que interessam a quem tem de escolher o tamanho do ecra:
    // do ecra ao primeiro e ao ultimo espectador, e a largura que a plateia
    // ocupa. E o que as regras da AVIXA e da SMPTE pedem.
    zPrimeira, zUltima, larguraSentada
  };
}


/**
 * Um padrão de teste, para se ver o conjunto com conteúdo sem ter de arranjar
 * uma imagem. Grelha, barras de cor e uma cruz ao meio — o suficiente para se
 * perceber onde ficam as juntas entre zonas e se alguma está trocada.
 */
/**
 * O padrão de teste: a marca sobre um fundo azul.
 *
 * Devolve uma promessa e não a textura à seca, e a razão é uma armadilha que
 * já mordeu: cada zona recebe uma CÓPIA da textura, e uma cópia não fica a
 * saber que a original mudou. Se a imagem da marca chegasse depois das cópias
 * feitas, os ecrãs ficavam com o fundo azul e mais nada.
 */
export function padraoDeTeste(largura = 1920, altura = 1080) {
  const tela = document.createElement("canvas");
  tela.width = largura; tela.height = altura;
  const p = tela.getContext("2d");

  const gradiente = p.createLinearGradient(0, 0, largura, altura);
  gradiente.addColorStop(0, "#0B2C6B");
  gradiente.addColorStop(1, "#123E8F");
  p.fillStyle = gradiente;
  p.fillRect(0, 0, largura, altura);

  return new Promise((resolve) => {
    const pronto = () => {
      const textura = new THREE.CanvasTexture(tela);
      textura.colorSpace = THREE.SRGBColorSpace;
      resolve(textura);
    };
    const marca = new Image();
    marca.onload = () => {
      const larguraMarca = largura * 0.52;
      const alturaMarca = larguraMarca * (marca.height / marca.width);
      p.drawImage(marca, (largura - larguraMarca) / 2, (altura - alturaMarca) / 2,
                  larguraMarca, alturaMarca);
      pronto();
    };
    marca.onerror = pronto;          // sem marca, fica o fundo — não fica nada partido
    marca.src = "icons/mike-logo.png";
  });
}

/** Uma imagem escolhida pelo mike, pronta a ser recortada pelas zonas. */
export function texturaDeFicheiro(ficheiro) {
  return new Promise((ok, mal) => {
    const leitor = new FileReader();
    leitor.onerror = () => mal(new Error("Não consegui ler essa imagem."));
    leitor.onload = () => {
      new THREE.TextureLoader().load(leitor.result, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        ok(t);
      }, undefined, () => mal(new Error("Isso não é uma imagem que eu saiba abrir.")));
    };
    leitor.readAsDataURL(ficheiro);
  });
}


/**
 * A projeção: o projetor, o cone de luz e a imagem na tela.
 *
 * O tamanho da imagem não se escreve — calcula-se. Um projetor com rácio 1,4 a
 * 12 metros faz uma imagem de 8,57 m de largura, e é essa a conta que decide
 * se aquilo cabe na parede. O cone desenha-se dos quatro cantos da imagem até
 * à lente, e é ele que mostra quem é que passa à frente.
 */
export function fazerProjecao(projetor, imagem, textura) {
  const grupo = new THREE.Group();
  grupo.name = "projecao";

  // a imagem na tela
  const material = textura
    ? new THREE.MeshBasicMaterial({ map: textura, toneMapped: false })
    : new THREE.MeshBasicMaterial({ color: 0xEAF2FF });
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(imagem.largura, imagem.altura), material);
  tela.name = "projecao-imagem";
  tela.position.set(imagem.x, imagem.y, imagem.z + 0.01);
  grupo.add(tela);

  // o contorno, para se ver onde ela acaba mesmo quando e branca sobre branco
  const contorno = new THREE.LineSegments(
    new THREE.EdgesGeometry(tela.geometry),
    new THREE.LineBasicMaterial({ color: 0x9BC4FF }));
  contorno.name = "aux:contorno";
  contorno.position.copy(tela.position);
  grupo.add(contorno);

  // o projetor
  const caixa = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.18, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x39434F, roughness: 0.7, metalness: 0.2 }));
  caixa.name = "projetor";
  caixa.position.set(projetor.x, projetor.y, projetor.z);
  grupo.add(caixa);

  // o cone: quatro triângulos da lente para os cantos
  const meiaL = imagem.largura / 2, meiaA = imagem.altura / 2;
  const cantos = [
    [imagem.x - meiaL, imagem.y + meiaA, imagem.z],
    [imagem.x + meiaL, imagem.y + meiaA, imagem.z],
    [imagem.x + meiaL, imagem.y - meiaA, imagem.z],
    [imagem.x - meiaL, imagem.y - meiaA, imagem.z]
  ];
  const vertices = [];
  for (let i = 0; i < 4; i++) {
    const a = cantos[i], b = cantos[(i + 1) % 4];
    vertices.push(projetor.x, projetor.y, projetor.z, a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.computeVertexNormals();
  const cone = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({
    color: 0x8FC2FF, transparent: true, opacity: 0.10,
    side: THREE.DoubleSide, depthWrite: false
  }));
  cone.name = "aux:cone";
  grupo.add(cone);

  return grupo;
}

/** Os pontos da imagem que se usam para ver quem lhe passa à frente. */
export function pontosDaImagem(imagem, colunas = 9, linhas = 5) {
  const pontos = [];
  for (let c = 0; c < colunas; c++) {
    for (let l = 0; l < linhas; l++) {
      pontos.push(new THREE.Vector3(
        imagem.x + imagem.largura * ((c + 0.5) / colunas - 0.5),
        imagem.y + imagem.altura * ((l + 0.5) / linhas - 0.5),
        imagem.z));
    }
  }
  return pontos;
}


/**
 * A planta da sala, assente no chão.
 *
 * Uma imagem não sabe a escala a que foi desenhada, e não há como adivinhá-la:
 * por isso pede-se UMA medida conhecida — a largura que a planta cobre — e todo
 * o resto sai daí. É a mesma coisa que se faz com uma régua em cima de um
 * desenho impresso.
 */
export function fazerPlanta(textura, planta) {
  if (!textura || !planta.largura) return new THREE.Group();
  const grupo = new THREE.Group();
  grupo.name = "aux:planta";

  const imagem = textura.image;
  const proporcao = imagem && imagem.height ? imagem.width / imagem.height : 1.4142;
  const profundidade = planta.largura / proporcao;

  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(planta.largura, profundidade),
    new THREE.MeshBasicMaterial({
      map: textura, transparent: true, opacity: planta.opacidade,
      depthWrite: false, toneMapped: false
    }));
  chao.rotation.x = -Math.PI / 2;
  chao.rotation.z = -(planta.rodar || 0) * Math.PI / 180;
  chao.position.set(planta.x || 0, 0.012, planta.z || 0);
  grupo.add(chao);

  // O contorno diz onde a planta acaba — sem ele, uma planta com fundo branco
  // e uma sala branca são a mesma mancha.
  const contorno = new THREE.LineSegments(
    new THREE.EdgesGeometry(chao.geometry),
    new THREE.LineBasicMaterial({ color: 0x4C6272 }));
  contorno.rotation.copy(chao.rotation);
  contorno.position.copy(chao.position);
  grupo.add(contorno);

  return grupo;
}


/**
 * A planta em DXF: as linhas do desenho, no chão, já à escala.
 *
 * A diferença para a planta em imagem não é a nitidez — é não haver calibração
 * nenhuma. O desenho traz as unidades, o `metrosPorUnidade` diz quantos metros
 * vale cada uma, e a planta assenta com o tamanho que tem. O que sobra para
 * mexer é só onde ela fica: o CAD tem o zero onde o desenhador o pôs, que
 * raramente é o meio da sala.
 *
 * Vai centrada no MEIO do desenho e não na origem dele — uma planta com
 * coordenadas do mundo real aparecia a trezentos metros dali e ninguém a
 * encontrava.
 */
export function fazerPlantaCad(desenho, opcoes) {
  const grupo = new THREE.Group();
  grupo.name = "planta-cad";
  if (!desenho || !desenho.pontos || !desenho.pontos.length) return grupo;

  const f = opcoes.fator || 1;
  const meioX = (desenho.minX + desenho.maxX) / 2;
  const meioY = (desenho.minY + desenho.maxY) / 2;

  const bruto = desenho.pontos;
  const deQuemE = desenho.deQuemE;
  const escondidas = opcoes.escondidas || new Set();
  const levantadas = opcoes.levantadas || new Set();
  const altura = opcoes.altura > 0 ? opcoes.altura : 3;

  const noChao = [];      // as linhas deitadas
  const emPe = [];        // os triângulos das paredes levantadas

  for (let i = 0, s = 0; i < bruto.length; i += 4, s++) {
    const camada = deQuemE ? deQuemE[s] : 0;
    if (escondidas.has(camada)) continue;
    const x1 = (bruto[i] - meioX) * f;
    // O Y do desenho é o "para cima" da folha, que aqui é o -Z. Trocar o sinal
    // é o que impede a planta de entrar espelhada — e uma planta espelhada só
    // se descobre no dia em que alguém for montar a sala.
    const z1 = -(bruto[i + 1] - meioY) * f;
    const x2 = (bruto[i + 2] - meioX) * f;
    const z2 = -(bruto[i + 3] - meioY) * f;
    noChao.push(x1, 0, z1, x2, 0, z2);

    if (levantadas.has(camada)) {
      // Cada segmento vira um pano vertical: dois triângulos, do chão até à
      // altura pedida. É o que transforma uma planta deitada numa sala.
      emPe.push(x1, 0, z1, x2, 0, z2, x2, altura, z2);
      emPe.push(x1, 0, z1, x2, altura, z2, x1, altura, z1);
    }
  }

  if (noChao.length) {
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(noChao, 3));
    const linhas = new THREE.LineSegments(geometria, new THREE.LineBasicMaterial({
      color: 0x7FA8C9, transparent: true,
      opacity: Math.min(1, Math.max(0.05, opcoes.opacidade || 0.9))
    }));
    linhas.name = "planta-cad";
    grupo.add(linhas);
  }

  if (emPe.length) {
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(emPe, 3));
    geometria.computeVertexNormals();
    // Translúcidas e sem escrever profundidade, de propósito: uma parede opaca
    // levantada à volta da sala tapa tudo o que ela devia ajudar a ver, e o que
    // aparece no ecrã é um rectângulo preto. Assim lê-se o volume e continua a
    // ver-se o que está lá dentro.
    const paredes = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({
      color: 0x4E6577, roughness: 1, side: THREE.DoubleSide,
      transparent: true, opacity: 0.38, depthWrite: false
    }));
    paredes.renderOrder = 1;
    paredes.name = "planta-paredes";
    grupo.add(paredes);
  }

  grupo.rotation.y = -(opcoes.rodar || 0) * Math.PI / 180;
  grupo.position.set(opcoes.x || 0, 0.014, opcoes.z || 0);
  return grupo;
}
