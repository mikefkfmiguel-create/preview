// Levar a cena daqui para onde se faz a imagem a sério.
//
// Isto desenha volumes e cores — serve para responder a "cabe?" e "vê-se?".
// Quem faz a imagem bonita trabalha noutro sítio: Cinema 4D, Blender. O que
// falta entre um e outro é só a ponte, e é isto.
//
// **glTF (.glb) é o formato a usar**: leva as cores, as posições e os nomes de
// cada peça, e entra no Cinema 4D e no Blender sem nada pelo meio. O OBJ vai
// atrás porque toda a gente o abre, mas vai sem materiais — as zonas chegam lá
// cinzentas e é preciso pintá-las à mão. Por isso é que os nomes importam: do
// outro lado, cada zona tem de se conseguir escolher pelo nome para receber a
// textura dela.

import * as THREE from "three";
import { GLTFExporter } from "../vendor/GLTFExporter.js";
import { OBJExporter } from "../vendor/OBJExporter.js";

/**
 * Um InstancedMesh não viaja: nem o glTF simples nem o OBJ sabem o que fazer
 * com ele, e o que chega ao outro lado é UMA pessoa na origem em vez de
 * quatrocentas nos lugares delas. Por isso assam-se as instâncias — cada uma
 * vira geometria de verdade, transformada e colada às outras.
 */
function assar(malha) {
  if (!malha.count) return null;
  const base = malha.geometry.index ? malha.geometry.toNonIndexed() : malha.geometry;
  const posicao = base.attributes.position;
  const normal = base.attributes.normal;
  const vertices = posicao.count;
  const total = malha.count * vertices;

  const P = new Float32Array(total * 3);
  const N = normal ? new Float32Array(total * 3) : null;

  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const p = new THREE.Vector3();
  const d = new THREE.Vector3();

  for (let i = 0; i < malha.count; i++) {
    malha.getMatrixAt(i, m);
    nm.getNormalMatrix(m);
    for (let j = 0; j < vertices; j++) {
      const k = (i * vertices + j) * 3;
      p.fromBufferAttribute(posicao, j).applyMatrix4(m);
      P[k] = p.x; P[k + 1] = p.y; P[k + 2] = p.z;
      if (N) {
        d.fromBufferAttribute(normal, j).applyMatrix3(nm).normalize();
        N[k] = d.x; N[k + 1] = d.y; N[k + 2] = d.z;
      }
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(P, 3));
  if (N) geometria.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  else geometria.computeVertexNormals();

  const nova = new THREE.Mesh(geometria, malha.material);
  nova.name = malha.name || "instancias";
  return nova;
}

/**
 * A cena preparada para sair.
 *
 * Fica de fora tudo o que é ajuda de leitura e não existe na sala: a grelha do
 * chão, os contornos, o cone de luz, a planta. São coisas para se ver aqui;
 * do outro lado, o cone de luz vira uma luz a sério e a grelha não vira nada.
 * Marcam-se com o prefixo "aux:" e é por aí que se apanham.
 */
export function prepararParaExportar(cena, opcoes = {}) {
  const raiz = new THREE.Group();
  raiz.name = opcoes.soACupula ? "dome" : "preview";

  cena.traverse((objeto) => {
    if (!objeto.isMesh && !objeto.isLineSegments) return;

    // "Só a cúpula": para um media server não interessa a sala, o público nem
    // os projetores -- interessa a SUPERFÍCIE onde a imagem vai cair, e mais
    // nada. Pedido directo: *"poder exportar apenas a dome em obj para usar
    // no media server, WATCHOUT por exemplo"*.
    if (opcoes.soACupula && objeto.name !== "dome-casca") return;

    // Um objecto dentro de um grupo "aux:" também é auxiliar.
    let o = objeto, auxiliar = false;
    while (o) {
      if (typeof o.name === "string" && o.name.startsWith("aux:")) { auxiliar = true; break; }
      o = o.parent;
    }
    if (auxiliar) return;
    if (objeto.isLineSegments && !opcoes.comLinhas) return;

    const ePublico = objeto.name.startsWith("publico");
    if (ePublico && !opcoes.comPublico) return;

    let copia;
    if (objeto.isInstancedMesh) {
      copia = assar(objeto);
      if (!copia) return;
    } else {
      copia = objeto.clone();
      copia.geometry = objeto.geometry;
      copia.material = objeto.material;
    }

    // Tudo em coordenadas do mundo: do outro lado não há grupos com rotações
    // por aplicar, e uma peça no sítio errado é pior do que uma peça a menos.
    objeto.updateWorldMatrix(true, false);
    copia.matrix.copy(objeto.matrixWorld);
    copia.matrix.decompose(copia.position, copia.quaternion, copia.scale);
    // Num ficheiro que só tem a cúpula, "dome-casca" não diz nada a mais do
    // que "dome" -- e é por este nome que a peça aparece na lista de objetos
    // do media server.
    copia.name = opcoes.soACupula ? "dome" : (objeto.name || nomeDeFallback(objeto));
    raiz.add(copia);
  });

  return raiz;
}

function nomeDeFallback(objeto) {
  let o = objeto.parent;
  while (o) {
    // Cá dentro chama-se "figura" porque é a figura de escala; lá fora é o
    // orador, e é assim que quem abrir o ficheiro a vai procurar.
    if (o.name === "figura") return "orador";
    if (o.name && !o.name.startsWith("aux:")) return o.name;
    o = o.parent;
  }
  return "peça";
}

/** O .glb, que é o que leva cores e nomes. */
export function comoGLB(grupo) {
  return new Promise((ok, mal) => {
    new GLTFExporter().parse(
      grupo,
      (resultado) => ok(new Blob([resultado], { type: "model/gltf-binary" })),
      (erro) => mal(new Error("Não consegui escrever o glTF: " + (erro && erro.message || erro))),
      { binary: true, onlyVisible: false, truncateDrawRange: false }
    );
  });
}

/** O .obj, que toda a gente abre — mas sem materiais nenhuns. */
export function comoOBJ(grupo) {
  return new Blob([new OBJExporter().parse(grupo)], { type: "text/plain" });
}

export function descarregar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Quantos triângulos vão sair — para se avisar antes de o browser engasgar. */
export function pesar(grupo) {
  let vertices = 0, pecas = 0;
  grupo.traverse((o) => {
    if (!o.isMesh && !o.isLineSegments) return;
    pecas++;
    const p = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
    if (p) vertices += p.count;
  });
  return { vertices, pecas };
}
