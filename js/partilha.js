// Um link temporário só para ver — sem editar nada.
//
// Reaproveita o mesmo Worker que o assistente de IA já usa (mesmo endereço,
// guardado no mesmo localStorage que os Calculadores escrevem): grava o
// projeto todo lá por uns dias, com um id curto, e devolve-se um link com
// esse id. Quem o abre não fala com este aparelho nem com os Calculadores —
// só lê o que ficou guardado no Worker.

import { enderecoDoWorker } from "./assistente.js";

export const VALIDADE_PARTILHA = "1 dia";

/** Grava o estado (o mesmo formato de "Guardar projeto") e devolve o link. */
export async function criarLinkPartilha(estado) {
  const resposta = await fetch(enderecoDoWorker() + "/partilha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado })
  });
  let dados = null;
  try { dados = await resposta.json(); } catch (_) { /* resposta que não é JSON */ }
  if (!resposta.ok || !dados || !dados.id) {
    throw new Error((dados && dados.error) ||
      `O Worker respondeu ${resposta.status}. Confirma o endereço do Worker nos Calculadores.`);
  }
  return `${location.origin}${location.pathname}#ver=${dados.id}`;
}

/** Vai buscar o estado gravado com criarLinkPartilha(), pelo id do link. */
export async function lerLinkPartilha(id) {
  const resposta = await fetch(enderecoDoWorker() + "/partilha/" + encodeURIComponent(id));
  let dados = null;
  try { dados = await resposta.json(); } catch (_) { /* resposta que não é JSON */ }
  if (!resposta.ok || !dados || !dados.estado) {
    if (resposta.status === 404) {
      throw new Error(`Este link já não existe — ou passou a validade (${VALIDADE_PARTILHA}), ou nunca existiu.`);
    }
    throw new Error((dados && dados.error) || `O Worker respondeu ${resposta.status}.`);
  }
  return dados.estado;
}
