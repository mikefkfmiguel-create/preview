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

/**
 * O tampo de um palco: um paralelepípedo, ou o mesmo com os cantos
 * arredondados — pedido direto: *"os palcos podem arredondar, já era meio
 * caminho para um palco redondo"*.
 *
 * E é mesmo o caminho todo, com um só número: o raio limita-se a metade do
 * lado mais curto, por isso num palco de 10 × 6 m o máximo (3 m) dá as pontas
 * em meia-lua, e num palco quadrado de 8 × 8 m o máximo (4 m) dá um círculo.
 * Não é preciso um "tipo de palco" à parte.
 *
 * `raio` a 0 devolve exactamente a BoxGeometry de sempre — não é um caso
 * especial por preguiça, é para um projeto antigo continuar a ter o mesmo
 * palco, vértice por vértice, no que é exportado para .glb/.obj.
 */
/**
 * Só a FRENTE arredondada, a traseira a direito — a meia-lua.
 *
 * Pedido directo, a usar o círculo: *"queria arredondar e encostar ao outro
 * como continuidade; para isso deveria ser apenas meio palco, pois senão ao
 * arrumar passa para trás do outro"*. E está certo: um círculo de diâmetro
 * igual à largura tem metade do corpo atrás da linha onde se quer encostar,
 * por isso ou fica a flutuar à frente ou entra dentro do palco principal.
 * Com a traseira reta, encosta.
 *
 * "Frente" é o lado do público. O palco principal nasce no fundo da sala
 * (z negativo) e a plateia cresce para +z; no Shape, que se desenha em XY e
 * depois se roda com rotateX(-90°), o +y do desenho vai dar a -z do mundo —
 * logo a frente é o -y do desenho. Um palco extra rodado leva a meia-lua
 * atrás dele, que é o que se quer: roda-se a peça, não a forma.
 *
 * O raio vertical vai até à profundidade INTEIRA (e não até metade, como no
 * arredondar dos quatro cantos): é isso que deixa a curva fechar numa
 * meia-elipse a sério. Com largura 8 e profundidade 4, raio 4, sai o
 * semicírculo exacto.
 *
 * Os cantos são arcos de elipse a sério (absellipse) e não curvas
 * quadráticas: duas quadráticas de ponta a ponta fazem uma forma de lente,
 * com bicos nos lados — nota-se logo quando a curva é a peça toda, e não só
 * um canto. Os quatro cantos do arredondar normal ficam como estavam, para
 * não mudar uma forma que já está aprovada.
 */
function geometriaDeMeiaLua(largura, altura, profundidade, raio) {
  const x = largura / 2, y = profundidade / 2;
  const rx = Math.min(Math.max(raio || 0, 0), largura / 2);
  const ry = Math.min(Math.max(raio || 0, 0), profundidade);
  if (rx <= 0.001 || ry <= 0.001) return new THREE.BoxGeometry(largura, altura, profundidade);

  const forma = new THREE.Shape();
  forma.moveTo(-x, y);                    // traseira esquerda (encosta aqui)
  forma.lineTo(x, y);                     // traseira direita
  forma.lineTo(x, -y + ry);               // lado direito, até onde a curva começa
  forma.absellipse(x - rx, -y + ry, rx, ry, 0, -Math.PI / 2, true);
  forma.lineTo(-x + rx, -y);              // frente reta, se o raio não chegar aos lados
  forma.absellipse(-x + rx, -y + ry, rx, ry, -Math.PI / 2, -Math.PI, true);
  forma.closePath();                      // lado esquerdo, de volta à traseira

  const geo = new THREE.ExtrudeGeometry(forma, { depth: altura, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -altura / 2, 0);
  return geo;
}

function geometriaDeTampo(largura, altura, profundidade, raio, meio) {
  const pedido = Math.max(raio || 0, 0);
  if (meio) return geometriaDeMeiaLua(largura, altura, profundidade, pedido);
  if (pedido <= 0.001) return new THREE.BoxGeometry(largura, altura, profundidade);

  // O raio limita-se POR EIXO, e não pelo lado mais curto — foi a correcção
  // pedida: *"deve fechar mais a curva… conseguir fechar em círculo"*. Com um
  // limite único (metade do lado mais curto), um palco de 14 × 7 m parava num
  // "estádio" — pontas em meia-lua, lados compridos a direito — e não havia
  // número nenhum que o fechasse. Separando os dois eixos, o mesmo campo
  // continua a dar cantos suaves em baixo e passa a fechar em cima:
  //
  //   14 × 7 m,  raio 3,5  ->  rx 3,5 · ry 3,5  ->  estádio (como era)
  //   14 × 7 m,  raio 7    ->  rx 7,0 · ry 3,5  ->  elipse, fechada nos dois eixos
  //   14 × 14 m, raio 7    ->  rx 7,0 · ry 7,0  ->  círculo
  //
  // Abaixo de metade do lado mais curto, rx e ry são iguais — ou seja, nada
  // muda em relação à versão anterior.
  const rx = Math.min(pedido, largura / 2);
  const ry = Math.min(pedido, profundidade / 2);

  // Desenha-se em XY (é o plano onde o Shape do three.js vive) e extruda-se
  // em Z; no fim roda-se para o Z passar a ser a altura.
  const x = largura / 2, y = profundidade / 2;
  const forma = new THREE.Shape();
  forma.moveTo(-x + rx, -y);
  forma.lineTo(x - rx, -y);
  forma.quadraticCurveTo(x, -y, x, -y + ry);
  forma.lineTo(x, y - ry);
  forma.quadraticCurveTo(x, y, x - rx, y);
  forma.lineTo(-x + rx, y);
  forma.quadraticCurveTo(-x, y, -x, y - ry);
  forma.lineTo(-x, -y + ry);
  forma.quadraticCurveTo(-x, -y, -x + rx, -y);

  // curveSegments manda no número de lados de cada canto. Com o raio no
  // máximo os quatro cantos passam a ser a forma toda, e é aí que uma curva
  // facetada se nota — daí 24 e não 12. Num objeto que é só volume, o custo
  // disto não se sente.
  const geo = new THREE.ExtrudeGeometry(forma, { depth: altura, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2);
  // O ExtrudeGeometry cresce de z=0 para z=+altura; depois da rotação isso é
  // de y=0 para y=+altura. A BoxGeometry nasce CENTRADA, e quem chama põe o
  // mesh a altura/2 a contar com isso — por isso centra-se aqui também, para
  // os dois caminhos serem intermutáveis sem mexer em quem os usa.
  geo.translate(0, -altura / 2, 0);
  return geo;
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
    geometriaDeTampo(larguraPalco, palco.altura, palco.profundidade, palco.raio),
    new THREE.MeshStandardMaterial({ color: COR_PALCO, roughness: 0.9 }));
  caixa.name = "palco";
  caixa.position.set(0, palco.altura / 2, -profundidade / 2 + palco.profundidade / 2);
  grupo.add(caixa);
  return grupo;
}

/**
 * Um palco extra (2º, 3º, ...) — pedido direto ("preciso ter como criar
 * mais do que um... palco"). Ao contrário do principal, que fica sempre
 * encostado ao fundo da sala e serve de referência aos ecrãs/ângulos/
 * cobertura, este é só visual/estrutural: posição, rotação e dimensões
 * próprias, sem nenhum ecrã nem conta agarrada a ele. Por isso a posição
 * vem já em coordenadas do mundo (dx/dz), ao contrário do principal que
 * nasce centrado a partir da largura da sala.
 */
export function fazerPalcoExtra(pe) {
  const grupo = new THREE.Group();
  const largura = Math.max(1, pe.largura || 6);
  const altura = Math.max(0.1, pe.altura || 1);
  const profundidade = Math.max(0.5, pe.profundidade || 4);
  const caixa = new THREE.Mesh(
    geometriaDeTampo(largura, altura, profundidade, pe.raio, pe.meio),
    new THREE.MeshStandardMaterial({ color: COR_PALCO, roughness: 0.9 }));
  caixa.position.set(0, altura / 2, 0);
  grupo.add(caixa);
  grupo.rotation.y = -(pe.rot || 0) * Math.PI / 180;
  grupo.position.set(pe.dx || 0, 0, pe.dz || 0);
  return grupo;
}

/**
 * A passarela: um prolongamento do palco para dentro da plateia — pedido
 * direto ("tenho que desenhar um palco com uma passarela"). Sai do meio da
 * frente do palco, à mesma altura do tampo (por isso um degrau só, não dois
 * — quem sobe ao palco sobe à passarela ao mesmo tempo). "dx" desloca-a
 * lateralmente sem ficar presa ao centro, para quando o palco não é
 * simétrico ou a passarela tem de sair enviesada para um corredor.
 *
 * Só reta — sem rodar nem em T — porque foi o que se pediu; a divisão da
 * plateia nos dois lados não é feita aqui, é o vão que zonaDaPassarela()
 * (mais abaixo) e fazerPublico() abrem sozinhos onde ela passa.
 */
export function fazerPassarela(sala, palco, passarela) {
  const grupo = new THREE.Group();
  grupo.name = "passarela";
  if (!passarela || !passarela.ligada || !palco.altura || !passarela.comprimento) return grupo;
  const largura = Math.max(0.5, passarela.largura || 1.5);
  const comprimento = Math.max(0.5, passarela.comprimento || 1);
  const zFrente = -sala.profundidade / 2 + palco.profundidade;
  const caixa = new THREE.Mesh(
    new THREE.BoxGeometry(largura, palco.altura, comprimento),
    new THREE.MeshStandardMaterial({ color: COR_PALCO, roughness: 0.9 }));
  caixa.name = "passarela";
  caixa.position.set(passarela.dx || 0, palco.altura / 2, zFrente + comprimento / 2);
  grupo.add(caixa);
  return grupo;
}

/**
 * O rectângulo (em X/Z do mundo) que a passarela ocupa -- usado por
 * fazerPublico() para lhe abrir o vão, exactamente como já se fazia para a
 * régie. Função à parte (em vez de repetir a conta nos dois sítios) porque
 * fazerPassarela() e este vão têm de concordar sempre no mesmo rectângulo.
 */
export function zonaDaPassarela(sala, palco, passarela) {
  if (!passarela || !passarela.ligada || !passarela.comprimento) return null;
  const largura = Math.max(0.5, passarela.largura || 1.5);
  const comprimento = Math.max(0.5, passarela.comprimento || 1);
  const zFrente = -sala.profundidade / 2 + palco.profundidade;
  return { dx: passarela.dx || 0, largura, zMin: zFrente, zMax: zFrente + comprimento };
}

/**
 * A cúpula de projeção (dome), à escala, vista por dentro.
 *
 * Pedido directo depois de a calculadora de dome ficar feita: *"como
 * adiciono para poder ver no 3D"*. Vem dos Calculadores pela mesma ponte
 * das zonas, com as medidas e mais nada — o Preview não ganha contas de
 * dome master, lúmenes nem projetores, que é regra da casa.
 *
 * A geometria é uma CALOTA esférica, não meia esfera: um dome geodésico de
 * evento é muitas vezes mais (ou menos) do que metade. De um diâmetro de
 * base D e uma altura h sai o raio da esfera
 *
 *     R = (a² + h²) / 2h,   a = D/2
 *
 * e o centro dessa esfera fica a y = h − R (abaixo do chão numa meia-esfera,
 * acima dele numa cúpula mais alta do que meia). A calota vai do zénite até
 * ao ângulo polar onde a superfície encontra o chão:
 *
 *     cos(θmax) = (R − h) / R
 *
 * Numa meia-esfera (h = a = R) isso dá θmax = 90°, como tem de ser.
 *
 * Por omissão desenha-se TRANSLÚCIDA, com uma grelha de meridianos e
 * paralelos por cima. Uma cúpula opaca é mais realista e é inútil aqui: as
 * perguntas deste Preview são "cabe?", "vê-se?" e "quem tapa o quê?", e uma
 * casca fechada tapa o público, os ecrãs e o palco a partir de metade dos
 * ângulos. Sólida existe no interruptor, para quem quer a imagem bonita.
 */
export function fazerDome(dome, solido, textura) {
  const grupo = new THREE.Group();
  if (!dome) return grupo;
  const D = Math.max(0.5, parseFloat(dome.diametro) || 0);
  const h = Math.max(0.25, parseFloat(dome.altura) || D / 2);
  if (!(D > 0)) return grupo;
  const a = D / 2;
  const R = (a * a + h * h) / (2 * h);
  // Clamp defensivo: com medidas absurdas (h enorme para um D pequeno) o
  // arco-cosseno saía fora de [-1, 1] e a geometria vinha NaN.
  const cosMax = Math.min(1, Math.max(-1, (R - h) / R));
  const thetaMax = Math.acos(cosMax);

  const geo = new THREE.SphereGeometry(R, 64, 40, 0, Math.PI * 2, 0, thetaMax);

  // A casca vive num sub-grupo deslocado para o centro da esfera; o anel da
  // base fica no grupo de fora, ao nível do chão. Sem esta separação, o
  // deslocamento da esfera levava o anel com ele e a pegada aparecia no ar.
  const cascaGrupo = new THREE.Group();
  cascaGrupo.position.y = h - R;
  grupo.add(cascaGrupo);

  // Com conteúdo carregado ("Conteúdo nos ecrãs"), a cúpula mostra-o como
  // ele aparece de facto: o dome master é uma imagem QUADRADA mapeada em
  // azimutal equidistante -- o zénite no centro, o horizonte na borda do
  // círculo, e o raio proporcional ao ângulo ao zénite. É a definição da
  // IMERSA para o Fulldome Master, e é por isso que uma imagem normal sai
  // esticada: numa cúpula sai mesmo.
  //
  // Reportado assim: *"como ponho conteúdo se não tenho ecrã"*. Não havia
  // como -- o conteúdo só ia para zonas, e uma cúpula não é uma zona.
  if (textura) uvAzimutalEquidistante(geo, thetaMax);

  const casca = new THREE.Mesh(geo, textura
    // Com conteúdo: vê-se de dentro, que é de onde o público vê. Fica também
    // visível de fora, senão de fora do 3D a cúpula parecia vazia.
    ? new THREE.MeshBasicMaterial({ map: textura, side: THREE.DoubleSide, toneMapped: false })
    : (solido
      // Sólida: vê-se a face de DENTRO (BackSide), que é onde a imagem
      // aparece na realidade. Com a face de fora ficava uma bola opaca.
      ? new THREE.MeshStandardMaterial({ color: COR_PALCO, roughness: 0.95, side: THREE.BackSide })
      : new THREE.MeshBasicMaterial({
          color: 0x9683E8, transparent: true, opacity: 0.10,
          side: THREE.DoubleSide, depthWrite: false
        })));
  casca.name = "dome-casca";
  cascaGrupo.add(casca);

  // A grelha é o que faz a forma ler-se quando está translúcida — sem ela,
  // uma casca a 10% de opacidade é uma névoa sem silhueta.
  if (!solido && !textura) {
    const grelha = new THREE.Mesh(
      new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, thetaMax),
      new THREE.MeshBasicMaterial({
        color: 0x9683E8, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false
      }));
    grelha.name = "aux:dome-grelha";
    cascaGrupo.add(grelha);
  }

  // O anel da base, sempre visível: é a pegada da cúpula no chão, e é por
  // ela que se vê se cabe na sala.
  const base = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(0.01, a - 0.06), a, 96),
    new THREE.MeshBasicMaterial({ color: 0x9683E8, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.012;   // um dedo acima do chão, para não piscar contra ele
  base.name = "aux:dome-base";
  grupo.add(base);

  // Os projetores, quando a aba Dome disser quantos e como. É o que
  // responde a "onde monto isto" -- a calculadora diz o número, o 3D diz o
  // sítio.
  //
  // A colocação é a que as fontes nomeiam: "center or horizon cove
  // placement". O anel fica encostado por dentro à base (a cove), os
  // projetores apontam para cima e para o centro, e o do zénite fica no
  // meio a apontar a prumo. A ALTURA de uma cove real depende da lente e
  // decide-se na obra -- aqui fica baixa e indicativa, e o desenho di-lo em
  // vez de fingir precisão que não tem.
  if (dome.projetores && dome.projetores.n > 0) {
    const p = fazerProjetoresDoDome(dome.projetores, a, h, R, thetaMax);
    grupo.add(p.corpos);
    if (dome.projetores.semFatias) p.fatias.visible = false;
    // As fatias são desenhadas no referencial da CASCA (centro da esfera na
    // origem), por isso vão para o cascaGrupo -- no grupo de fora apareciam
    // deslocadas da superfície, que foi o mesmo laço em que o anel da base
    // caiu quando a cúpula foi feita.
    cascaGrupo.add(p.fatias);
  }

  grupo.name = "dome";
  return grupo;
}

// Uma cor por fatia, para se distinguirem: num anel de dez, fatias todas da
// mesma cor leem-se como uma mancha só. Tons frios e claros, que é o que se vê
// contra a casca violeta e contra o chão escuro.
const CORES_FATIA = [0x7FD1FF, 0xFFD479, 0x9BE8A8, 0xFF9FB5, 0xC5A6FF, 0x8FE8DE,
                     0xFFC2F0, 0xBFD46A, 0x7FA8FF, 0xFFAE7A];

/**
 * Reescreve os UV de uma calota para AZIMUTAL EQUIDISTANTE, que é como um
 * dome master se mapeia: imagem quadrada, zénite no centro do círculo,
 * horizonte na borda, raio proporcional ao ângulo ao zénite.
 *
 *   raio no master = (theta / thetaMax) * 0.5      (theta medido do zénite)
 *   u = 0,5 + raio*cos(phi)    v = 0,5 + raio*sin(phi)
 *
 * A SphereGeometry do three já nasce com o pólo em +Y e theta a crescer para
 * baixo, por isso theta sai da posição do vértice sem contas extra.
 */
function uvAzimutalEquidistante(geo, thetaMax) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const raioEsfera = v.length() || 1;
    // Ângulo ao zénite, protegido do arredondamento que põe y/R fora de [-1,1].
    const theta = Math.acos(Math.min(1, Math.max(-1, v.y / raioEsfera)));
    const phi = Math.atan2(v.z, v.x);
    const rr = Math.min(0.5, (theta / thetaMax) * 0.5);
    uv.setXY(i, 0.5 + rr * Math.cos(phi), 0.5 + rr * Math.sin(phi));
  }
  uv.needsUpdate = true;
}

/**
 * O corpo de um projetor apontado a um alvo — o mesmo corpo que a aba de
 * projeção já usa, para não haver duas ideias de "projetor" na cena.
 */
function corpoDeProjetor(pos, alvo, nome) {
  const caixa = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.18, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x39434F, roughness: 0.7, metalness: 0.2 }));
  caixa.position.copy(pos);
  caixa.lookAt(alvo);
  caixa.name = nome;

  // Um traço curto a dizer para onde aponta: sem isto, num anel de dez, não
  // se percebe se estão virados para dentro ou para fora.
  const dir = new THREE.Vector3().subVectors(alvo, pos).normalize().multiplyScalar(1.1);
  const traco = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([pos.clone(), pos.clone().add(dir)]),
    new THREE.LineBasicMaterial({ color: 0x8FC2FF, transparent: true, opacity: 0.55 }));
  traco.name = "aux:dome-mira";

  const g = new THREE.Group();
  g.add(caixa, traco);
  return g;
}

/**
 * A FATIA da cúpula que um projetor tem de cobrir, desenhada na superfície
 * mais os quatro traços que a ligam ao projetor — é isto que se lê como cone.
 *
 * Pedido directo: *"não vejo os cones de projeção"*. É importante o que isto
 * é e o que NÃO é: é a **repartição da superfície**, por área igual entre os
 * projetores, e não o cone real da lente. O cone real depende da lente, do
 * shift e da posição exacta, nada disso está aqui — e inventar um ângulo de
 * lente era inventar dados técnicos. Isto responde a "que pedaço de cúpula
 * fica a cargo de cada máquina", que é a pergunta de quem está a decidir
 * quantos alugar.
 *
 * `a1`/`a2` são azimutes, `t1`/`t2` ângulos ao zénite (theta), em radianos.
 * Desenha-se no referencial da casca (centro da esfera na origem), por isso
 * entra no cascaGrupo e não no grupo de fora.
 */
function fatiaDaCupula(R, a1, a2, t1, t2, pos, cor, nome) {
  const g = new THREE.Group();
  g.name = nome;

  const phiLen = a2 - a1;
  const thetaLen = t2 - t1;
  const geo = new THREE.SphereGeometry(R * 0.995, 24, 12, a1, phiLen, t1, thetaLen);
  const mancha = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: cor, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false
  }));
  mancha.name = nome + "-area";
  g.add(mancha);

  // O contorno da fatia, senão duas fatias vizinhas leem-se como uma só.
  // Grosseiro de propósito (4x2 segmentos): a casca já tem a sua grelha, e
  // seis fatias com grelha fina davam uma teia de aranha -- visto de dentro
  // não se percebia nada, que é justamente a vista que isto serve.
  const bordo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.997, 4, 2, a1, phiLen, t1, thetaLen),
    new THREE.MeshBasicMaterial({ color: cor, wireframe: true, transparent: true, opacity: 0.45, depthWrite: false }));
  bordo.name = "aux:dome-fatia-grelha";
  g.add(bordo);

  // Os quatro cantos ligados ao projetor: é o que faz a forma ler-se como um
  // feixe em vez de uma mancha colada à casca.
  const canto = (phi, theta) => new THREE.Vector3(
    R * Math.sin(theta) * Math.cos(phi),
    R * Math.cos(theta),
    R * Math.sin(theta) * Math.sin(phi));
  const pontos = [];
  [[a1, t1], [a2, t1], [a2, t2], [a1, t2]].forEach(([phi, theta]) => {
    pontos.push(pos.clone(), canto(phi, theta));
  });
  const feixe = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pontos),
    new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.45 }));
  feixe.name = "aux:dome-feixe";
  g.add(feixe);

  return g;
}

/**
 * O arranjo de projetores de uma cúpula: onde ficam, para onde apontam, e que
 * pedaço de cúpula fica a cargo de cada um.
 *
 * `colocacao` vem da aba Dome e é SÓ colocação (desde a v3.50 lá; antes o
 * campo fazia isto e a resolução ao mesmo tempo, o que dava escolher onde
 * montar e ver a resolução mudar):
 *   centro       — todos ao centro, com fisheye
 *   anel         — todos em anel à volta, sem zénite
 *   anel-zenite  — anel à volta + um no zénite
 *   anel-duplo   — dois anéis + um no zénite
 *
 * A repartição da superfície é por ÁREA IGUAL (área de uma calota = 2piRh, e
 * por isso repartir por área é repartir a altura da calota). Não é um plano
 * de blending -- é a conta de primeira mão que diz se o número de projetores
 * faz sentido para a cúpula que se tem.
 */
function fazerProjetoresDoDome(proj, a, h, R, thetaMax) {
  const grupo = new THREE.Group();
  grupo.name = "dome-projetores";
  const fatias = new THREE.Group();
  // "aux:" porque isto é um auxiliar de análise, não geometria da cúpula: um
  // GLB da sala não leva as fatias, tal como não leva a grelha nem o anel.
  fatias.name = "aux:dome-fatias";
  const n = Math.max(1, Math.round(proj.n));
  const ARRANJO_ANTIGO = { 1: "centro", 2: "anel", 3: "anel-zenite", 4: "anel-duplo" };
  const colocacao = proj.colocacao || ARRANJO_ANTIGO[Math.round(proj.arranjo || 3)] || "anel-zenite";
  // A altura de montagem vem da aba Dome quando lá estiver escrita.
  // Reportado: *"a altura a que estão, pois não serão no chão, serão sempre
  // elevados"* -- e tinha razão: o valor que aqui estava (12% da altura da
  // cúpula, no máximo 1,2 m) punha-os praticamente no chão, e num planetário
  // vão na cove, numa cúpula de evento vão em truss. Por definir, mantém-se
  // o valor baixo e a nota do painel diz que é indicativo, não uma cota.
  const alturaPedida = parseFloat(proj.altura);
  const alturaCove = (alturaPedida > 0)
    ? Math.min(h - 0.2, alturaPedida)       // nunca acima do topo da cúpula
    : Math.min(1.2, h * 0.12);
  const raioCove = Math.max(0.4, a - 0.5);      // encostado por dentro

  // Quantos ficam ao centro (o do zénite) e quantos nos anéis.
  const aoCentro = (colocacao === "centro") ? n : (colocacao === "anel" ? 0 : Math.min(1, n));
  const noAnel = n - aoCentro;

  const duplo = colocacao === "anel-duplo" && noAnel >= 4;
  const aneis = noAnel <= 0 ? [] : (duplo
    ? [{ q: Math.ceil(noAnel / 2), r: raioCove, y: alturaCove },
       { q: Math.floor(noAnel / 2), r: raioCove * 0.55, y: alturaCove + Math.min(1.5, h * 0.2) }]
    : [{ q: noAnel, r: raioCove, y: alturaCove }]);

  // A cada PROJETOR a mesma área de cúpula. A área de uma calota é 2piRh com
  // h = R(1-cos theta), por isso repartir a área é repartir o (1-cos theta) --
  // e não o theta. Daí sair o theta de uma fracção acumulada de área.
  //
  // Foi aqui que a primeira versão falhou, e o teste apanhou-a: a fatia do
  // zénite ia de 0 a thetaMax, ou seja levava a cúpula inteira em vez da
  // calota de cima.
  const thetaDe = (fraccao) => Math.acos(Math.min(1, Math.max(-1,
    1 - Math.min(1, Math.max(0, fraccao)) * (1 - Math.cos(thetaMax)))));

  // O zénite leva a sua quota (aoCentro/n) a contar do pólo; os anéis
  // repartem o resto, de cima para baixo e cada um pelo nº de máquinas que
  // tem. Com a colocação "centro" isto dá aoCentro/n = 1, ou seja a cúpula
  // toda -- que é o que um fisheye ao centro faz, e sai da mesma fórmula.
  const thetaDoCentro = thetaDe(aoCentro / n);
  const faixas = new Map();
  let acumulado = aoCentro / n;
  aneis.slice().reverse().forEach((anel) => {
    const f0 = acumulado;
    acumulado += anel.q / n;
    faixas.set(anel, [thetaDe(f0), thetaDe(acumulado)]);
  });

  for (let i = 0; i < aoCentro; i++) {
    // Um fisheye ao centro aponta a prumo. Com mais do que um (caso raro),
    // afastam-se um pouco para não ficarem dentro um do outro.
    const desvio = aoCentro > 1 ? (i - (aoCentro - 1) / 2) * 0.6 : 0;
    // O do zénite/centro também não fica no chão quando há altura de
    // montagem: num anel com zénite ele vai na mesma estrutura.
    const yCentro = (alturaPedida > 0) ? Math.min(h - 0.2, alturaPedida) : 0.12;
    const pos = new THREE.Vector3(desvio, yCentro, 0);
    grupo.add(corpoDeProjetor(pos, new THREE.Vector3(desvio, h, 0), "dome-projetor-c" + (i + 1)));
    // Ao centro cada um cobre uma fatia em gomo, do zénite ao horizonte: é o
    // que um fisheye faz. Com um só, é a cúpula toda.
    const p1 = (i / aoCentro) * Math.PI * 2, p2 = ((i + 1) / aoCentro) * Math.PI * 2;
    fatias.add(fatiaDaCupula(R, p1, p2, 0, thetaDoCentro,
      new THREE.Vector3(desvio, yCentro - (h - R), 0), CORES_FATIA[i % CORES_FATIA.length],
      "dome-fatia-c" + (i + 1)));
  }

  if (noAnel > 0) {
    let k = 0, cor = 0;
    aneis.forEach((anel, ia) => {
      const [tCima, tBaixo] = faixas.get(anel);
      for (let i = 0; i < anel.q; i++) {
        // Meio passo de desfasamento no anel de dentro, para as duas filas
        // não ficarem uma atrás da outra.
        const ang = (i / anel.q) * Math.PI * 2 + (ia ? Math.PI / anel.q : 0);
        const pos = new THREE.Vector3(Math.sin(ang) * anel.r, anel.y, Math.cos(ang) * anel.r);
        // Aponta para cima e para o lado oposto da cúpula: é o que uma cove
        // faz, cobrir a metade de lá.
        const alvo = new THREE.Vector3(-Math.sin(ang) * a * 0.55, h * 0.85, -Math.cos(ang) * a * 0.55);
        grupo.add(corpoDeProjetor(pos, alvo, "dome-projetor-" + (++k)));
        // A fatia fica do lado OPOSTO ao projetor, que é para onde ele
        // aponta. O azimute da esfera do three conta de +X para +Z, e a
        // posição usa sin/cos ao contrário -- daí o atan2(z, x).
        const phiOposto = Math.atan2(-Math.cos(ang), -Math.sin(ang));
        const meio = Math.PI / anel.q;   // meia fatia de azimute
        fatias.add(fatiaDaCupula(R, phiOposto - meio, phiOposto + meio, tCima, tBaixo,
          pos.clone().setY(pos.y - (h - R)), CORES_FATIA[cor++ % CORES_FATIA.length],
          "dome-fatia-" + k));
      }
    });
  }

  return { corpos: grupo, fatias: fatias };
}

/**
 * Uma passarela SOLTA (2ª, 3ª, ...) — pedido direto ("preciso ter como
 * criar mais do que um... passarela"). Ao contrário da de cima, que sai
 * sempre do meio da frente do palco e nunca roda, esta é livre: posição e
 * rotação próprias, sem estar presa a nenhum palco -- decisão já tomada
 * com o mike. Por isso tem também a sua própria altura (não herda a do
 * palco, que pode nem ser a mais próxima).
 */
export function fazerPassarelaLivre(pl) {
  const grupo = new THREE.Group();
  const largura = Math.max(0.5, pl.largura || 1.5);
  const comprimento = Math.max(0.5, pl.comprimento || 3);
  const altura = Math.max(0, pl.altura != null ? pl.altura : 1);
  const caixa = new THREE.Mesh(
    new THREE.BoxGeometry(largura, Math.max(0.05, altura), comprimento),
    new THREE.MeshStandardMaterial({ color: COR_PALCO, roughness: 0.9 }));
  caixa.position.set(0, altura / 2, 0);
  grupo.add(caixa);
  grupo.rotation.y = -(pl.rot || 0) * Math.PI / 180;
  grupo.position.set(pl.dx || 0, 0, pl.dz || 0);
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
function fazerZona(zona, alturaBase, z0, conteudo, rotacao = 0, tombo = 0, texturaZona = null) {
  const grupo = new THREE.Group();
  const cor = new THREE.Color(zona.cor || "#2E7BFF");
  const tras = new THREE.MeshStandardMaterial({ color: 0x11181E, roughness: 1 });

  // Um delay (TV ou projeção) não é um LED: não se curva por gomos — é um
  // ecrã único, plano, tal como se vê numa parede. A curvatura só faz
  // sentido para o painel principal.
  const ehLed = zona.tipo !== "tv" && zona.tipo !== "projecao";
  const ESPESSURA = 0.12;
  const gomos = (ehLed && zona.curva) ? Math.max(4, Math.min(24, Math.round(zona.w / 0.5))) : 1;
  // Um raio pequeno para uma zona larga dá um ângulo enorme -- e passado
  // dos 360°, os gomos deixam de fazer um arco e passam a dar a volta sobre
  // si próprios, gomo em cima de gomo, o que no ecrã parece um leque de
  // papel aberto em vez de uma parede curva. Um ecrã não se dobra mais do
  // que uma volta inteira, por isso o ângulo fica preso a menos de 360°.
  const anguloTotal = (ehLed && zona.curva)
    ? Math.max(-359, Math.min(359, zona.curva.modo === "raio"
        ? (zona.w / Math.max(0.5, zona.curva.valor)) * (180 / Math.PI)
        : zona.curva.valor))
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
  //
  // Um LED brilha por si (emissivo). Uma TV de delay é a mesma ideia mas
  // mais fraca -- é um ecrã comum, não uma parede de módulos. Uma projeção
  // não brilha nada: é um pano/tela à espera da luz de um projetor, por
  // isso fica sem emissivo nenhum, só a cor clara do próprio pano.
  const INTENSIDADE_EMISSIVA = zona.tipo === "tv" ? 0.5 : 0.85;
  function frenteDoGomo(i) {
    // Imagem PRÓPRIA deste ecrã (por nome da zona): sobrepõe-se a tudo o
    // resto, geral ou por delay — a imagem toda aqui, fatiada só pelos
    // gomos DESTE ecrã (não pela posição no conjunto, que é o que
    // "espalhada" faz para a imagem comum a todos).
    if (texturaZona) {
      const imagem = texturaZona.clone();
      imagem.needsUpdate = true;
      imagem.repeat.set(1 / gomos, 1);
      imagem.offset.set(i / gomos, 0);
      return new THREE.MeshStandardMaterial({
        color: zona.tipo === "projecao" ? 0xEDEDED : 0xFFFFFF,
        map: imagem,
        emissiveMap: zona.tipo === "projecao" ? null : imagem,
        emissive: zona.tipo === "projecao" ? 0x000000 : 0xFFFFFF,
        emissiveIntensity: zona.tipo === "projecao" ? 0 : INTENSIDADE_EMISSIVA,
        roughness: zona.tipo === "projecao" ? 0.92 : 0.45,
        metalness: 0
      });
    }
    // Um delay é um monitor independente: recebe a imagem inteira, como um
    // DSM. O recorte espalhado pelo conjunto só faz sentido para as zonas LED
    // que formam uma parede; num delay, esse recorte podia deixar a imagem
    // fora do UV e mostrava apenas a cor lisa.
    if ((zona.tipo === "tv" || zona.tipo === "projecao")
      && conteudo && conteudo.textura) {
      const imagem = conteudo.textura.clone();
      imagem.needsUpdate = true;
      imagem.repeat.set(1 / gomos, 1);
      imagem.offset.set(i / gomos, 0);
      return new THREE.MeshStandardMaterial({
        color: zona.tipo === "projecao" ? 0xEDEDED : 0xFFFFFF,
        map: imagem,
        emissiveMap: zona.tipo === "tv" ? imagem : null,
        emissive: zona.tipo === "tv" ? 0xFFFFFF : 0x000000,
        emissiveIntensity: zona.tipo === "tv" ? INTENSIDADE_EMISSIVA : 0,
        roughness: zona.tipo === "projecao" ? 0.92 : 0.45,
        metalness: 0
      });
    }
    if (!conteudo || !conteudo.textura) {
      return new THREE.MeshStandardMaterial({
        color: cor, emissive: cor, emissiveIntensity: INTENSIDADE_EMISSIVA, roughness: 0.35, metalness: 0.1
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
      emissiveIntensity: INTENSIDADE_EMISSIVA, roughness: 0.45, metalness: 0
    });
  }

  for (let i = 0; i < gomos; i++) {
    const materiais = [tras, tras, tras, tras, frenteDoGomo(i), tras];   // +Z é a frente
    const peca = new THREE.Mesh(
      new THREE.BoxGeometry(larguraGomo * 1.002, zona.h, ESPESSURA), materiais);
    if (anguloTotal) {
      // O ângulo de cada gomo ao longo do arco é sempre o mesmo (não depende
      // de côncavo/convexo) -- só o sentido em que ele empurra o gomo para a
      // frente ou para trás é que muda. Antes multiplicava-se este ângulo por
      // "sentido" logo aqui e usava-se outra vez em "-a*sentido" na rotação:
      // os dois sinais cancelavam-se e a rotação ficava sempre igual à do
      // caso convexo, desencontrada da posição no caso côncavo. Cada gomo
      // ficava bem colocado ao longo do arco mas virado para o ângulo errado
      // -- as bordas nunca encostavam, e via-se como fatias soltas.
      const a = (-anguloTotal / 2 + anguloTotal * (i + 0.5) / gomos) * Math.PI / 180;
      peca.position.set(Math.sin(a) * raio, 0, (Math.cos(a) - 1) * raio * sentido);
      peca.rotation.y = a * sentido;
    } else {
      peca.position.x = -zona.w / 2 + larguraGomo * (i + 0.5);
    }
    grupo.add(peca);
  }

  // A TV de delay não é um painel modular como o LED -- tem uma moldura à
  // volta do ecrã, e é essa moldura escura que diz "isto é uma televisão"
  // ao primeiro olhar, sem precisar de etiqueta nenhuma.
  if (zona.tipo === "tv") {
    const moldura = new THREE.Mesh(
      new THREE.BoxGeometry(zona.w + 0.06, zona.h + 0.06, ESPESSURA * 0.7),
      new THREE.MeshStandardMaterial({ color: 0x0B0F12, roughness: 0.6, metalness: 0.2 }));
    moldura.position.z = -ESPESSURA * 0.2;
    grupo.add(moldura);
  }

  grupo.position.set(zona.centroX, alturaBase + zona.h / 2, z0);
  // "rodar"/"tilt" aplicam-se a QUALQUER zona, LED incluído -- não só a
  // delays (tv/projeção). Isto já era assim do lado do cálculo (a cobertura
  // e o cone de cada ecrã, em anguloDePessoa()/fazerConeCobertura(), sempre
  // usaram centro.rotacao sem olhar ao tipo): rodar uma zona LED movia o
  // cone no ecrã mas não o ecrã que ele representa, os dois a discordar em
  // silêncio -- exactamente o que se reportou. "YXZ": primeiro roda-se à
  // volta do eixo vertical (para onde aponta), só depois se tomba (para
  // onde inclina) -- a mesma ordem do DSM.
  grupo.rotation.order = "YXZ";
  grupo.rotation.y = -Number(rotacao || 0) * Math.PI / 180;
  // Positivo inclina para baixo (a face que estava a apontar em frente
  // passa a apontar também para o chão) -- é o sentido que interessa a um
  // ecrã pendurado no alto, a apontar para a plateia lá em baixo.
  grupo.rotation.x = Number(tombo || 0) * Math.PI / 180;
  return grupo;
}

/**
 * A plateia em gomos: N blocos (o mesmo que fazerPublico() já faz para
 * "Reto"), cada um com a sua PRÓPRIA largura, deslocado/rodado à volta do
 * palco por quem usa a app -- não há "leque automático" nenhum a decidir
 * por ninguém, é a pessoa que arruma cada um, arrastando-o na cena ou pelos
 * campos largura / ↔ / profundidade / rodar. Por omissão nascem lado a
 * lado (a largura da sala dividida por N, encostados uns aos outros, sem
 * rodar) -- o mesmo que "Reto" mostraria, só que agora cada fatia é um
 * bloco à parte, que se pode rodar para dentro ("angular as pontas") ou
 * deslocar como se quiser.
 *
 * Reaproveita fazerPublico() sem lhe mexer -- cada gomo é uma chamada normal
 * a essa função, só que com a LARGURA do gomo em vez da da sala toda (a
 * margem de corredor que fazerPublico() já desconta dos dois lados serve
 * agora de propósito o corredor vertical que separa um gomo do seguinte,
 * exatamente o que se pediu: "separados pelos corredores"). O grupo 3D
 * resultante entra dentro de um "pivot" que o roda e desloca para onde lhe
 * disseram. O que fazerPublico() desenha sozinha continua exatamente igual
 * a zero risco para quem usa "Reto".
 *
 * `ajustesGomos[i] = { largura, dx, dz, rot, corredor, filas }` --
 * largura/dx/dz/corredor em metros (dx/dz a partir do ponto focal, a boca
 * do palco), rot em graus, filas em número de filas. `corredor` e `filas`
 * nascem iguais aos campos globais (Público → corredores/filas) mas depois
 * são independentes -- um gomo pode ter menos filas do que os outros (uma
 * ala mais curta do que o centro) ou zero corredor lateral (encostado ao
 * vizinho, sem vão nenhum entre os dois).
 *
 * O "corpos" (as posições da plateia, em números simples, usadas pela
 * cobertura/sombra) NÃO viaja com a transformação do Three.js -- essa
 * transformação só pinta a cena, não mexe nos números -- por isso cada
 * ponto recalcula-se aqui à mão com a mesma rotação/deslocação, para a
 * cobertura continuar a apontar ao sítio certo.
 *
 * Falta ainda (ver PARA-CONTINUAR.md): um palco central/circular a sério
 * -- isto roda a plateia à volta do PONTO onde o palco reto de hoje fica,
 * não à volta de um palco que também mude de forma ou de posição.
 */
export function fazerPublicoGomos(sala, palco, publico, regies, ajustesGomos, passarelasLivres) {
  const listaRegies = Array.isArray(regies) ? regies : (regies ? [regies] : []);
  const listaPassarelasLivres = Array.isArray(passarelasLivres) ? passarelasLivres : [];
  const grupo = new THREE.Group();
  grupo.name = "publico-gomos";
  const n = Math.max(1, Math.round(publico.gomos || 3));
  const ajustes = ajustesGomos || [];
  // O ponto focal: onde já fica a primeira fila do modo "Reto", menos a
  // distância a que ela está -- ou seja, a boca do palco. É à volta deste
  // ponto que cada gomo roda e a partir dele que dx/dz se medem.
  const focoZ = -sala.profundidade / 2 + palco.profundidade;

  let lugares = 0, blocos = 0;
  let filas = 0, porFila = 0, largura = 0.46, fundura = 0.34;
  let zPrimeira = null, zUltima = null, larguraSentada = 0;
  const corpos = [];
  const blocoPorLugar = [];
  const gomosApertados = [];
  const gomosInfo = [];
  let olhos = null, melhorAngulo = Infinity;

  for (let i = 0; i < n; i++) {
    const aj = ajustes[i] || {};
    // "corredor" e "filas" começam iguais aos campos globais (ver
    // ajustesDeGomosGarantidos em app.js) mas o valor guardado no ajuste
    // manda sempre que existir -- é o que os torna independentes por gomo.
    const corredorGomo = Number.isFinite(Number(aj.corredor)) ? Math.max(0, Number(aj.corredor)) : (publico.larguraCorredor || 1.2);
    const filasGomo = Number.isFinite(Number(aj.filas)) && aj.filas !== "" ? Math.max(0, Math.round(Number(aj.filas))) : publico.filas;
    // "corredores" (nº de corredores DENTRO da plateia inteira, campo global
    // de "Reto") não faz sentido herdado tal e qual aqui: um gomo já É um
    // pedaço separado dos vizinhos por "corredor" (a var acima) — manter o
    // valor global fazia cada gomo abrir MAIS um corredor lá dentro, a
    // multiplicar a largura perdida por N gomos (reportado: a lotação caía
    // para menos de metade só por mudar para "Circular", sem mexer em mais
    // nada). Cada gomo nasce sem corredor interno — quem quiser um, mete-o à
    // mão a dividir esse gomo em dois (ainda não há campo próprio para isso).
    const publicoGomo = Object.assign({}, publico, { larguraCorredor: corredorGomo, filas: filasGomo, corredores: 0 });
    // Nunca abaixo do que cabe pelo menos UM lugar (as duas margens
    // laterais, que aqui já servem de corredor entre gomos -- ou não,
    // se "corredor" for 0 -- mais um lugar) -- um gomo mais estreito do
    // que isto ficava sempre vazio, sem ninguém.
    const larguraMinima = 2 * corredorGomo + publico.entreLugares;
    const larguraGomo = Math.max(larguraMinima, Number(aj.largura) || (sala.largura / n));
    const salaGomo = Object.assign({}, sala, { largura: larguraGomo });
    const dx = Number(aj.dx) || 0;
    const dz = Number(aj.dz) || 0;
    const anguloDeg = Number(aj.rot) || 0;
    const ang = anguloDeg * Math.PI / 180;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);

    // As régies (principal + extra) são mesas físicas, no mesmo sítio para
    // toda a gente -- não rodam nem deslocam com o gomo. Mas fazerPublico()
    // só sabe testar "cai dentro da régie?" no seu próprio referencial
    // (direito, como o de "Reto"). Por isso cada régie entra aqui já na
    // transformação CONTRÁRIA à do gomo (a inversa do que se faz ao
    // "corpos" mais abaixo): do ponto de vista de dentro do gomo deslocado/
    // rodado, é onde a mesa real parece estar. Sem isto, o vão que a régie
    // devia abrir na plateia aparecia no sítio errado (ou nenhum) em
    // qualquer gomo deslocado.
    const regiesDoGomo = listaRegies.map((regie) => {
      if (!(dx || dz || anguloDeg)) return regie;
      const relX = regie.x - dx;
      const relZ = regie.z - (focoZ + dz);
      return Object.assign({}, regie, {
        x: cosA * relX - sinA * relZ,
        z: sinA * relX + cosA * relZ + focoZ,
        rodar: (regie.rodar || 0) - anguloDeg
      });
    });
    // Mesma ideia para as passarelas soltas -- também não rodam nem
    // deslocam com o gomo.
    const passarelasLivresDoGomo = listaPassarelasLivres.map((pl) => {
      if (!(dx || dz || anguloDeg)) return pl;
      const relX = (pl.dx || 0) - dx;
      const relZ = (pl.dz || 0) - (focoZ + dz);
      return Object.assign({}, pl, {
        dx: cosA * relX - sinA * relZ,
        dz: sinA * relX + cosA * relZ + focoZ,
        rot: (pl.rot || 0) - anguloDeg
      });
    });
    const sub = fazerPublico(salaGomo, palco, publicoGomo, regiesDoGomo, null, passarelasLivresDoGomo);

    // O grupo 3D: desloca-se para a origem ficar no ponto focal, e um
    // "pivot" por cima roda-o e desloca-o (dx, dz) -- a mesma conta, feita
    // pelo motor em vez de à mão, para o desenho ficar sempre certo.
    sub.grupo.position.z = -focoZ;
    const pivot = new THREE.Group();
    pivot.name = "gomo-" + i;
    pivot.position.set(dx, 0, focoZ + dz);
    pivot.rotation.y = ang;
    pivot.add(sub.grupo);
    grupo.add(pivot);

    // O "corpos": os mesmos números que fazerPublico() devolveria sozinha,
    // deslocados/rodados à mão com a MESMA transformação do pivot, porque a
    // cobertura lê estes números directamente, sem passar pela cena 3D nem
    // pelas suas transformações.
    for (let p = 0; p < sub.corpos.length; p += 4) {
      const x = sub.corpos[p], y1 = sub.corpos[p + 1];
      const zRel = sub.corpos[p + 2] - focoZ, y2 = sub.corpos[p + 3];
      corpos.push(dx + (x * cosA + zRel * sinA), y1, focoZ + dz + (-x * sinA + zRel * cosA), y2);
    }
    for (let b = 0; b < sub.blocoPorLugar.length; b++) blocoPorLugar.push(sub.blocoPorLugar[b] + i * 1000);

    lugares += sub.lugares;
    blocos += sub.blocos;
    // Os restantes números (filas, tamanho de uma pessoa, distâncias ao
    // palco) são os do último gomo -- desde que "filas" passou a poder ser
    // diferente por gomo, isto já não é "todos são iguais, tanto faz", mas
    // continua a ser só para o painel de medidas, que só tem lugar para um
    // número (ver gomosApertados, abaixo, para o aviso a sério).
    filas = sub.filas; porFila = sub.porFila; largura = sub.largura; fundura = sub.fundura;
    zPrimeira = sub.zPrimeira; zUltima = sub.zUltima; larguraSentada = sub.larguraSentada;
    // Um gomo pode pedir menos filas do que os outros DE PROPÓSITO (uma ala
    // mais curta) -- isso não é a sala a faltar espaço, é a pessoa a
    // escolher. Só entra aqui quando o PRÓPRIO gomo pediu mais filas do que
    // as que a sala lhe deixou encaixar (zPrimeira + filas*entreFilas passa
    // a parede de trás) -- aí sim, a sala é que acaba antes.
    if (sub.filas < filasGomo) gomosApertados.push({ gomo: i + 1, filas: sub.filas, pedidas: filasGomo });

    // Os "olhos da plateia" ficam no gomo mais próximo de estar direito
    // (rot mais perto de 0°) -- é o ponto de vista mais parecido ao que
    // "Reto" já dava.
    if (sub.olhos && Math.abs(anguloDeg) < melhorAngulo) {
      melhorAngulo = Math.abs(anguloDeg);
      const ox = sub.olhos.x, oz = sub.olhos.z - focoZ;
      olhos = new THREE.Vector3(dx + (ox * cosA + oz * sinA), sub.olhos.y, focoZ + dz + (-ox * sinA + oz * cosA));
    }

    // Ponto para uma etiqueta "Gomo N" -- ao meio das filas dele (não do
    // ponto focal, que costuma cair antes da primeira fila) e um pouco
    // acima da cabeça de pé, para se ler mesmo com a plateia a tapar.
    // Mesma transformação (dx/dz/rot) que "corpos", à mão, pela mesma razão:
    // isto nasce em coordenadas canónicas (como "Reto"), não já na cena 3D.
    if (sub.zPrimeira != null && sub.zUltima != null) {
      const zMeio = (sub.zPrimeira + sub.zUltima) / 2 - focoZ;
      gomosInfo.push({
        gomo: i + 1,
        x: dx + (zMeio * sinA),
        y: 1.9,
        z: focoZ + dz + (zMeio * cosA)
      });
    }
  }

  return {
    grupo, olhos, lugares, filas, porFila, blocos,
    corpos: new Float32Array(corpos), largura, fundura,
    blocoPorLugar: new Int16Array(blocoPorLugar),
    zPrimeira, zUltima, larguraSentada, gomosApertados, gomosInfo
  };
}

/**
 * Todas as zonas, assentes no palco e centradas na sala.
 * Devolve o grupo e os pontos onde as etiquetas devem aparecer.
 *
 * `ajustesDelays` é o que o preview guarda LOCALMENTE (não vem dos
 * Calculadores) para afinar onde um delay ou uma TV ficam de verdade na
 * sala — uma coluna, uma parede lateral — sem mexer nas contas de lá.
 *
 * `texturasPorZona` (opcional, por nome da zona) é uma imagem PRÓPRIA
 * desse ecrã — sobrepõe-se à "textura" geral só nele, tal como um DSM ou
 * um delay: a imagem toda nesse ecrã, sem o recorte "espalhada"/"cada" (só
 * faz sentido para a imagem geral, comum a todos).
 */
export function fazerZonas(projeto, medidas, sala, palco, textura, modoConteudo, ajustesDelays, texturasPorZona) {
  const grupo = new THREE.Group();
  const etiquetas = [];
  const ajustes = ajustesDelays || {};
  const texturasZona = texturasPorZona || {};

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
    let alturaBase = base + (fundo - (zona.y + zona.h));
    let zPeca = z0;
    // O ajuste aplica-se a qualquer zona, não só aos delays: um ecrã criado
    // aqui no preview (que nasce "led" por omissão) também precisa de se
    // conseguir deslocar, e sem uma zona irmã ao lado para servir de
    // referência, "zona.x" sozinho não desloca nada — o cálculo do centro do
    // conjunto cancela sempre a diferença. Já um LED que veio dos
    // Calculadores nunca tem entrada aqui (a secção "Posições" só cria
    // ajustes para delays), por isso continua exactamente onde de lá veio.
    const aj = ajustes[zona.nome];
    if (aj) {
      zona.centroX += Number(aj.dx) || 0;
      alturaBase += Number(aj.dy) || 0;
      zPeca += Number(aj.dz) || 0;
    }
    const peca = fazerZona(zona, alturaBase, zPeca, conteudo, aj ? aj.rot : 0, aj ? aj.tilt : 0, texturasZona[zona.nome]);
    // O nome viaja para o Cinema 4D: e por ele que, do outro lado, se escolhe
    // a zona a que se vai por a textura de verdade.
    peca.name = "zona " + zona.nome;
    grupo.add(peca);
    // A etiqueta vai POR CIMA da zona e não em cima dela: ao meio, tapava o
    // painel e fazia uma parede de 3,4 m parecer duas de 1,6.
    etiquetas.push({
      texto: `${zona.nome} · ${zona.w.toFixed(2)} × ${zona.h.toFixed(2)} m`,
      ponto: new THREE.Vector3(zona.centroX, alturaBase + zona.h + 0.32, zPeca + 0.2)
    });
  }

  return { grupo, etiquetas, base, z0 };
}

/**
 * Os DSM (monitores de confiança no palco) — não vêm de uma zona, vêm de uma
 * quantidade e um tamanho decididos nos Calculadores. Onde cada um fica é só
 * do preview: por omissão espalham-se ao centro do palco, perto da frente
 * (onde o orador está), e cada um pode ser corrigido à parte com
 * `ajustesDsm[i] = { dx, dz, rot }`.
 */
export function fazerDSM(dsm, sala, palco, ajustesDsm, textura) {
  const grupo = new THREE.Group();
  const etiquetas = [];
  if (!dsm || !dsm.n) return { grupo, etiquetas };
  const ajustes = ajustesDsm || [];
  // Perto da frente do palco -- é aí que quem fala normalmente para, não ao
  // fundo, onde o ecrã está.
  const z0 = -sala.profundidade / 2 + palco.profundidade * 0.7;
  const y0 = palco.altura + dsm.h / 2 + 0.02;
  const espaco = Math.min(2.2, palco.largura / (dsm.n + 1));
  const inicioX = -espaco * (dsm.n - 1) / 2;

  // A face que brilha (o +Z da caixa, antes de rodar) já nasce virada para
  // a plateia -- é a direção do próprio eixo, sala adentro. Um tombo
  // pequeno (30°) só inclina essa face para cima sem a tirar dali: o
  // resultado ficava sempre visível de quem está sentado, nunca de quem
  // fala. Para virar para quem fala, tomba-se para lá dos 180°: primeiro dá
  // a volta, depois inclina para cima, e só assim a face passa a apontar
  // para o palco em vez de para a plateia.
  const TOMBO = Math.PI + Math.PI / 6;
  const tras = new THREE.MeshStandardMaterial({ color: 0x11181E, roughness: 1 });

  for (let i = 0; i < dsm.n; i++) {
    const aj = ajustes[i] || {};
    const x = inicioX + espaco * i + (Number(aj.dx) || 0);
    const z = z0 + (Number(aj.dz) || 0);
    // Um DSM é um ecrã sozinho, sem irmãos ao lado a formar um conjunto --
    // por isso mostra a imagem TODA nele, e não um recorte (o recorte por
    // posição só faz sentido dentro de uma parede de LED, que é o que
    // "espalhada"/"cada" resolvem para as zonas).
    // O TOMBO (~210°, à volta do X) já vira o monitor para o orador -- mas
    // rodar em torno de um eixo DEITADO (X) inverte o que ficava para cima,
    // e nunca é uma rotação em Y ("rodar") que desfaz isso, por mais que se
    // rode: é um eixo diferente. Reportado: "a imagem está ao contrário e
    // não consigo rodar 360 para ficar direita" -- confirmado com uma
    // imagem em quadrantes, a que chega ao ecrã sai rodada 180° (cima
    // fica em baixo E esquerda em direita ao mesmo tempo, não só um dos
    // dois). Pré-roda-se a textura 180° aqui, só para o DSM -- as zonas
    // LED/delay não têm este tombo, não precisam disto.
    const frenteTextura = textura ? textura.clone() : null;
    if (frenteTextura) { frenteTextura.repeat.set(-1, -1); frenteTextura.offset.set(1, 1); }
    const frente = (textura)
      ? new THREE.MeshStandardMaterial({
          map: frenteTextura, emissiveMap: frenteTextura, emissive: 0xFFFFFF,
          emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.1
        })
      : new THREE.MeshStandardMaterial({
          color: 0x1B2126, emissive: 0x2E7BFF, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.2
        });
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(dsm.w, dsm.h, 0.05),
      [tras, tras, tras, tras, frente, tras]);
    // "rodar" gira o monitor à volta do eixo vertical ANTES do tombo — a
    // ordem "YXZ" garante isso, e é o que deixa apontá-lo para onde quer que
    // o orador esteja, e não só em frente, sem perder a inclinação para cima.
    monitor.rotation.order = "YXZ";
    monitor.rotation.y = ((Number(aj.rot) || 0) * Math.PI) / 180;
    // O TOMBO fixo já aponta para quem fala; "tilt" é só um afinar por cima
    // disso, para quando o suporte real não fica exatamente nos 30°.
    monitor.rotation.x = TOMBO + ((Number(aj.tilt) || 0) * Math.PI) / 180;
    monitor.position.set(x, y0, z);
    monitor.name = "dsm " + (i + 1);
    grupo.add(monitor);
    etiquetas.push({
      texto: `DSM ${i + 1} · ${dsm.w.toFixed(2)} × ${dsm.h.toFixed(2)} m`,
      ponto: new THREE.Vector3(x, y0 + dsm.h / 2 + 0.25, z)
    });
  }
  return { grupo, etiquetas };
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
export function fazerPublico(sala, palco, publico, regies, passarela, passarelasLivres) {
  // Aceita tanto uma régie só (chamadas antigas) como a lista -- pedido
  // direto ("preciso ter como criar mais do que um... régie"). A régie
  // principal e as extra abrem vão do mesmo jeito, testadas todas aqui.
  const listaRegies = Array.isArray(regies) ? regies : (regies ? [regies] : []);
  // As passarelas soltas (2ª, 3ª, ...) -- ao contrário da presa ao palco
  // (testada mais abaixo por zonaDaPassarela, sempre reta), estas têm
  // rotação própria, por isso o teste é o mesmo referencial local já usado
  // para a régie.
  const listaPassarelasLivres = Array.isArray(passarelasLivres) ? passarelasLivres : [];
  const grupo = new THREE.Group();
  grupo.name = "publico";
  if (!publico.filas) {
    return { grupo, olhos: null, lugares: 0, filas: 0, porFila: 0, blocos: 1,
             corpos: new Float32Array(0), blocoPorLugar: new Int16Array(0),
             largura: 0.46, fundura: 0.34 };
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
  // O bloco (entre corredores) de cada lugar, na mesma ordem de \corpos\ --
  // serve para agrupar a cobertura de ecra por bloco de plateia, sem ter de
  // recalcular a posicao de cada corredor outra vez do lado de fora.
  const blocoPorLugar = [];
  const zPrimeira = -sala.profundidade / 2 + palco.profundidade + publico.primeiraFila;
  let n = 0;
  let zUltima = zPrimeira;
  // O vão da passarela -- ver zonaDaPassarela() e fazerPassarela() mais
  // acima. Só existe onde ela realmente chega (zMin..zMax); as filas depois
  // do fim dela voltam a ficar inteiras, o que é o que faz isto parecer uma
  // passarela (um "T") e não um corredor central a direito até ao fundo.
  const zonaPass = zonaDaPassarela(sala, palco, passarela);

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
      // Testa-se contra TODAS as régies (principal + extra) -- basta UMA
      // bater certo para o lugar saltar, por isso sai-se do "for" logo que
      // a primeira apanhar o lugar, sem deixar de testar as outras quando a
      // primeira não apanha.
      let dentroDeAlgumaRegie = false;
      for (const regie of listaRegies) {
        const rodarRad = (regie.rodar || 0) * Math.PI / 180;
        const dx = x - regie.x;
        const dz = z - regie.z;
        const localX = dx * Math.cos(rodarRad) + dz * Math.sin(rodarRad);
        const localZ = -dx * Math.sin(rodarRad) + dz * Math.cos(rodarRad);
        // A folga é a distância de UM lugar, não a largura do corredor: a
        // régie não é uma parede lateral, é uma mesa no meio da plateia, e
        // "margemLateral" (1,2 m por omissão) empurrava a fila mais próxima
        // para bem mais longe do que um espectador aceitaria à volta de
        // qualquer outra cadeira. Um lugar inteiro de vão já dá espaço para
        // passar e não deixa ninguém sentado em cima do painel.
        const folgaX = publico.entreLugares;
        const folgaZ = publico.entreFilas;
        if (Math.abs(localX) < regie.largura / 2 + folgaX
          && Math.abs(localZ) < regie.profundidade / 2 + folgaZ) { dentroDeAlgumaRegie = true; break; }
      }
      if (dentroDeAlgumaRegie) continue;

      // A mesma ideia da régie, mas em vez de um rectângulo fixo é a faixa
      // da passarela (zMin..zMax) -- meio lugar de folga de cada lado dela,
      // que é o que separa "aberto" de "gente sentada em cima do tampo".
      if (zonaPass && z <= zonaPass.zMax + publico.entreFilas / 2
        && Math.abs(x - zonaPass.dx) < zonaPass.largura / 2 + publico.entreLugares / 2) continue;

      // Passarelas soltas: mesmo referencial local rodado já usado para a
      // régie, porque estas (ao contrário da presa ao palco) podem estar em
      // qualquer ângulo.
      let dentroDeAlgumaPassarelaLivre = false;
      for (const pl of listaPassarelasLivres) {
        const rodarRad = (pl.rot || 0) * Math.PI / 180;
        const dx2 = x - (pl.dx || 0);
        const dz2 = z - (pl.dz || 0);
        const localX = dx2 * Math.cos(rodarRad) + dz2 * Math.sin(rodarRad);
        const localZ = -dx2 * Math.sin(rodarRad) + dz2 * Math.cos(rodarRad);
        const folgaX = publico.entreLugares;
        const folgaZ = publico.entreFilas;
        if (Math.abs(localX) < (pl.largura || 1.5) / 2 + folgaX
          && Math.abs(localZ) < (pl.comprimento || 3) / 2 + folgaZ) { dentroDeAlgumaPassarelaLivre = true; break; }
      }
      if (dentroDeAlgumaPassarelaLivre) continue;

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
        blocoPorLugar.push(bloco);
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
      blocoPorLugar.push(bloco);
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
    // o bloco de cada lugar, na mesma ordem e no mesmo passo de "corpos"
    blocoPorLugar: new Int16Array(blocoPorLugar),
    // As distancias que interessam a quem tem de escolher o tamanho do ecra:
    // do ecra ao primeiro e ao ultimo espectador, e a largura que a plateia
    // ocupa. E o que as regras da AVIXA e da SMPTE pedem.
    zPrimeira, zUltima, larguraSentada
  };
}


/**
 * O padrão de teste: grelha, barras de cor e uma cruz de canto a canto — o
 * suficiente para se ver o conjunto com conteúdo sem ter de arranjar uma
 * imagem, e para saltar à vista se alguma zona está trocada ou espelhada (a
 * diagonal parte-se ali, bem visível). Sem marca nenhuma — isso é o que o
 * projeto de exemplo mostra sozinho (ver texturaDaMarca() e
 * aplicarConteudoDeExemplo() em js/app.js), este é só um padrão neutro.
 */
export function padraoDeTeste(largura = 1920, altura = 1080) {
  const tela = document.createElement("canvas");
  tela.width = largura; tela.height = altura;
  const p = tela.getContext("2d");

  p.fillStyle = "#101418";
  p.fillRect(0, 0, largura, altura);

  // A grelha -- ajuda a ver se o espaçamento continua igual de uma zona
  // para a seguinte, e onde ficam as juntas entre elas.
  const passo = Math.max(40, Math.round(largura / 24));
  p.strokeStyle = "rgba(255,255,255,0.16)";
  p.lineWidth = 1;
  for (let x = 0; x <= largura; x += passo) {
    p.beginPath(); p.moveTo(x + 0.5, 0); p.lineTo(x + 0.5, altura); p.stroke();
  }
  for (let y = 0; y <= altura; y += passo) {
    p.beginPath(); p.moveTo(0, y + 0.5); p.lineTo(largura, y + 0.5); p.stroke();
  }

  // Barras de cor bem distintas -- de relance já se percebe se uma zona
  // está a mostrar a fatia certa, ou repetida/trocada com outra.
  const CORES = ["#FFFFFF", "#FFE800", "#00E5FF", "#00C853", "#FF00C8", "#FF3D3D", "#2E7BFF"];
  const yBarras = altura * 0.42, alturaBarras = altura * 0.16;
  const larguraBarra = largura / CORES.length;
  CORES.forEach((cor, i) => {
    p.fillStyle = cor;
    p.fillRect(i * larguraBarra, yBarras, larguraBarra, alturaBarras);
  });

  // A cruz de canto a canto -- o que mais depressa denuncia uma zona
  // trocada ou espelhada: a diagonal deixa de bater certo ali.
  p.strokeStyle = "#FF3D3D";
  p.lineWidth = Math.max(2, largura * 0.0025);
  p.beginPath(); p.moveTo(0, 0); p.lineTo(largura, altura); p.stroke();
  p.beginPath(); p.moveTo(largura, 0); p.lineTo(0, altura); p.stroke();

  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function carregarImagem(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // sem a imagem, fica só o fundo — não parte nada
    img.src = src;
  });
}

/**
 * A marca (logotipo completo, ou só o símbolo) centrada sobre um fundo azul,
 * já pronta a ser textura de um ecrã — usada só no arranque do projeto de
 * exemplo (ver aplicarConteudoDeExemplo() em js/app.js): o ecrã "Principal"
 * mostra o logotipo completo, "Ala esquerda"/"Ala direita" mostram só o
 * símbolo (quadrado, aguenta a fatia estreita sem esticar). Ao contrário do
 * padrão de teste (genérico, sem marca), isto é só para o exemplo se
 * apresentar com a cara da app — não é o que se aplica a um projeto real.
 */
export function texturaDaMarca(completa, largura = 1024, altura = 576) {
  const tela = document.createElement("canvas");
  tela.width = largura; tela.height = altura;
  const p = tela.getContext("2d");

  const gradiente = p.createLinearGradient(0, 0, largura, altura);
  gradiente.addColorStop(0, "#0B2C6B");
  gradiente.addColorStop(1, "#123E8F");
  p.fillStyle = gradiente;
  p.fillRect(0, 0, largura, altura);

  return carregarImagem(completa ? "icons/mike-marca-branco.png" : "icons/mike-simbolo.png")
    .then((img) => {
      if (img) {
        const fator = completa ? 0.7 : 0.5;
        const larguraImg = completa ? largura * fator : Math.min(largura, altura) * fator;
        const alturaImg = larguraImg * (img.height / img.width);
        p.drawImage(img, (largura - larguraImg) / 2, (altura - alturaImg) / 2, larguraImg, alturaImg);
      }
      const textura = new THREE.CanvasTexture(tela);
      textura.colorSpace = THREE.SRGBColorSpace;
      return textura;
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
 * O mesmo ficheiro, mas só o data URL -- para guardar a par da textura no
 * "Guardar projeto"/link partilhado. Uma `THREE.Texture` não sobrevive a um
 * `JSON.stringify` (é um objeto vivo, com um WebGLTexture lá dentro); o data
 * URL é só texto, e é dele que se reconstrói a textura noutro aparelho.
 */
export function dataURLDeFicheiro(ficheiro) {
  return new Promise((ok, mal) => {
    const leitor = new FileReader();
    leitor.onerror = () => mal(new Error("Não consegui ler essa imagem."));
    leitor.onload = () => ok(leitor.result);
    leitor.readAsDataURL(ficheiro);
  });
}

function temTransparenciaAsSerio(ctx, largura, altura) {
  const dados = ctx.getImageData(0, 0, largura, altura).data;
  for (let i = 3; i < dados.length; i += 4) {
    if (dados[i] < 255) return true;
  }
  return false;
}

/**
 * A imagem escolhida pelo mike PARA CONTEÚDO (ecrã geral ou por zona),
 * reduzida antes de virar textura -- pedido a sério depois de um "projeto
 * demasiado grande para partilhar" real: uma foto de telemóvel facilmente
 * passa dos 3-5MB, e um ecrã na cena nunca precisa de mais do que ~1600px no
 * lado maior para ficar nítido -- o resto é só peso morto que soma depressa
 * quando há uma imagem geral MAIS uma por zona (ou várias zonas, cada uma
 * com a sua), e que se aproxima do limite do Worker (link partilhado) ou faz
 * o "Guardar projeto" pesar sem
 * necessidade.
 *
 * Só fica no formato original (PNG) quem tem mesmo transparência a usar --
 * um logo posto sobre a cor do ecrã, por exemplo, que um JPEG (sem canal
 * alfa) trocaria por um fundo preto sólido. A primeira versão decidia pelo
 * NOME do ficheiro (".png" fica PNG"), e isso mordeu com um projeto de 11
 * ecrãs, cada um com a sua foto em PNG: nenhuma tinha transparência
 * nenhuma, mas todas ficavam sem perdas (um PNG de uma fotografia pode
 * pesar 5-10x mais do que a mesma foto em JPEG) -- "projeto demasiado
 * grande para partilhar" outra vez, com 11 imagens a somar. Agora olha-se
 * aos pixels a sério (`temTransparenciaAsSerio()`): só quando há alfa
 * abaixo de 255 nalgum sítio é que vale a pena pagar o preço do PNG.
 *
 * Devolve os dois -- textura pronta a usar e o data URL a guardar -- feitos
 * do MESMO canvas reduzido, para não se ler o ficheiro duas vezes a
 * tamanhos diferentes (e a textura ao vivo ficar sempre igual ao que se
 * guarda, nunca maior).
 */
// 1600px/qualidade 0,75 -- mais apertado do que a primeira versão
// (2000px/0,85), pedido direto depois de um projeto real com 11 ecrãs, cada
// um com a sua foto, continuar a passar do limite do Worker mesmo já em
// JPEG. Um ecrã na cena não perde nitidez visível com isto (vê-se a alguma
// distância, não em detalhe de perto).
function reduzirImagem(img) {
  const LADO_MAXIMO = 1600;
  const maior = Math.max(img.width, img.height);
  const fator = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : 1;
  const tela = document.createElement("canvas");
  tela.width = Math.round(img.width * fator);
  tela.height = Math.round(img.height * fator);
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, tela.width, tela.height);

  const dataURL = temTransparenciaAsSerio(ctx, tela.width, tela.height)
    ? tela.toDataURL("image/png")
    : tela.toDataURL("image/jpeg", 0.75);
  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  return { textura, dataURL };
}

export function conteudoDeFicheiro(ficheiro) {
  return new Promise((ok, mal) => {
    const leitor = new FileReader();
    leitor.onerror = () => mal(new Error("Não consegui ler essa imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => mal(new Error("Isso não é uma imagem que eu saiba abrir."));
      img.onload = () => ok(reduzirImagem(img));
      img.src = leitor.result;
    };
    leitor.readAsDataURL(ficheiro);
  });
}

/**
 * O mesmo, mas a partir de um data URL já guardado (ao abrir um projeto ou
 * um link partilhado) -- não só reconstrói a textura, RECOMPRIME outra vez.
 * Pedido direto depois de um projeto antigo (guardado antes desta redução
 * existir, ou com imagens escolhidas num Preview mais antigo) continuar a
 * dar "demasiado grande" ao tentar partilhar-se: a compressão só corria ao
 * ESCOLHER uma imagem nova, nunca ao abrir uma já guardada -- um ficheiro
 * antigo ficava preso no tamanho de quando foi gravado, por mais vezes que
 * se reabrisse. Agora reabrir já poupa sozinho, sem se ter de escolher as
 * imagens todas outra vez à mão.
 *
 * Nunca rejeita -- uma imagem corrompida/em falta no ficheiro não deve
 * travar o resto do projeto, fica só sem conteúdo nessa zona.
 */
export function conteudoDeDataURL(url) {
  return new Promise((ok) => {
    const img = new Image();
    img.onerror = () => ok({ textura: null, dataURL: null });
    img.onload = () => ok(reduzirImagem(img));
    img.src = url;
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
export function fazerProjecao(projetor, imagem, textura, nome = "projetor-0") {
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
  // "projetor-0" por omissão (instância principal); instâncias extra
  // (Fase 6, blending) passam "projetor-1", "projetor-2", ... -- mesmo
  // despacho por prefixo que objetosArrastaveis() já usa para os outros
  // tipos (gomo-, zona , dsm ).
  caixa.name = nome;
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

/**
 * O cone de cobertura de UM ecrã: o mesmo desenho do cone do projetor, ao
 * contrário — ali é o feixe da lente até à tela, aqui é o ecrã a apontar
 * para a plateia, até onde o ângulo ainda é aceitável.
 *
 * `centro` é o referencial da zona (centroX/Y/Z + rotacao, o mesmo que
 * `anguloDePessoa` usa do lado do cálculo) e `angH`/`angV` os limites em
 * graus. Sem um cone destes, "o ecrã cumpre a regra" era só um número no
 * painel — via-se a contagem, não se via ONDE é que a sala deixa de ver bem.
 */
export function fazerConeCobertura(centro, alcance, angH, angV, cor = 0x8FC2FF) {
  const grupo = new THREE.Group();
  grupo.name = "aux:cobertura";
  const rad = Math.PI / 180;
  const rot = centro.rotacao || 0;
  const apice = [centro.centroX, centro.centroY, centro.centroZ];

  // Do referencial da zona (rodado) para o do mundo -- o inverso exacto da
  // conta que `anguloDePessoa` faz para ir do mundo para a zona.
  function ponto(h, v) {
    const hr = h * rad, vr = v * rad;
    const localZ = alcance * Math.cos(hr);
    const localX = alcance * Math.sin(hr);
    const y = Math.hypot(localX, localZ) * Math.tan(vr);
    const wx = localX * Math.cos(rot) + localZ * Math.sin(rot);
    const wz = -localX * Math.sin(rot) + localZ * Math.cos(rot);
    return [centro.centroX + wx, centro.centroY + y, centro.centroZ + wz];
  }

  const cantos = [ponto(-angH, -angV), ponto(angH, -angV), ponto(angH, angV), ponto(-angH, angV)];

  const vertices = [];
  for (let i = 0; i < 4; i++) {
    const a = cantos[i], b = cantos[(i + 1) % 4];
    vertices.push(...apice, ...a, ...b);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.computeVertexNormals();
  const malha = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({
    color: cor, transparent: true, opacity: 0.12,
    side: THREE.DoubleSide, depthWrite: false
  }));
  malha.name = "aux:cobertura-cone";
  grupo.add(malha);

  // O contorno: quatro arestas do ápice e as quatro da boca do cone, para se
  // ver o limite mesmo à luz do dia, quando o preenchimento quase não se nota.
  const linhas = [];
  for (const c of cantos) linhas.push(...apice, ...c);
  for (let i = 0; i < 4; i++) linhas.push(...cantos[i], ...cantos[(i + 1) % 4]);
  const geomLinhas = new THREE.BufferGeometry();
  geomLinhas.setAttribute("position", new THREE.Float32BufferAttribute(linhas, 3));
  const contorno = new THREE.LineSegments(geomLinhas,
    new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.45 }));
  contorno.name = "aux:cobertura-contorno";
  grupo.add(contorno);

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
