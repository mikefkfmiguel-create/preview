/**
 * QUANTO DO ECRÃ É QUE A CONTA DE DISTÂNCIA USA.
 *
 * Pedido assim: *"quando o ecrã for por exemplo um 20 por 5, ela está a usar
 * toda a base de imagem sempre, mas a maioria das vezes os dados são
 * apresentados em pips 16/9 e não em ecrã total. Devia ter um switch para
 * essa conta, se área total se apenas 16/9 — e medir o conforto de
 * visualização também com essa regra aplicada"*.
 *
 * Ao ir ver, apareceu uma coisa que ninguém sabia: AS DUAS APPS JÁ DISCORDAVAM.
 * O Preview 3D já partia um ecrã largo em fatias de ~16:9 e usava a largura da
 * FATIA no conforto (veio de um pedido anterior: *"divide quando cabem dois ou
 * mais 16/9"*). Os Calculadores contavam sempre com a largura toda. Num 20×5,
 * um dizia 20 m e o outro 10 m — para a mesma pergunta, no mesmo projeto.
 *
 * Por isso a regra mudou-se de sítio antes de lhe mexer: vive aqui, neste
 * ficheiro, que é copiado igual para as duas apps (como o js/limpeza.js e o
 * js/ficheiros.js). O switch é o mesmo dos dois lados porque a conta é a mesma.
 *
 * A REGRA, numa frase: com "16/9", um ecrã largo conta como as fatias de 16:9
 * que nele cabem; a largura de conta é a da fatia, não a do ecrã.
 *
 *     ecrã 20,00 × 5,00 m
 *     cabem 2 larguras de 16:9 (8,89 m cada) -> 2 fatias de 10,00 m
 *     a conta usa 10,00 m
 *
 * Três coisas que isto NÃO faz, de propósito:
 *
 *   1. Não mexe na ALTURA. Uma fatia tem a altura toda do ecrã (a divisão é
 *      só horizontal), e por isso os standards por altura -- o AVIXA, que é o
 *      que serve para ler texto -- dão exactamente o mesmo nos dois modos.
 *      Mexer na altura seria inventar um recorte que ninguém faz.
 *   2. Não muda nada num ecrã NORMAL. Se não cabem duas larguras de 16:9, não
 *      há divisão nenhuma: o switch não tem efeito em 16:9, 16:10 ou 4:3.
 *      Um interruptor que mexesse em tudo era um interruptor perigoso.
 *   3. Não inventa fatias de 8,89 m. A divisão é em partes IGUAIS que cubram
 *      o ecrã todo, que é como o 3D já a fazia e como uma imagem larga é
 *      mesmo distribuída -- não há um pedaço de ecrã a sobrar sem conta.
 */
(function () {
  "use strict";

  // A proporção do conteúdo. 16:9 é a que aparece em praticamente tudo o que
  // entra num media server; não se faz disto uma escolha porque o pedido é um
  // interruptor, não mais um campo para preencher.
  var RACIO_CONTEUDO = 16 / 9;

  var MODOS = {
    total: { chave: "total", label: "Área total do ecrã" },
    "16-9": { chave: "16-9", label: "Só a janela 16/9" }
  };

  // O modo por omissão é o 16/9: "a maioria das vezes os dados são
  // apresentados em pips 16/9". É também o que mantém o 3D a fazer o que já
  // fazia -- mudar o comportamento dele sem ninguém pedir seria pior.
  var MODO_POR_OMISSAO = "16-9";

  /** Em quantas fatias de ~16:9 é que este ecrã se divide. 1 = não se divide. */
  function fatiasDeEcra(largura, altura) {
    if (!(largura > 0) || !(altura > 0)) return 1;
    var n = Math.floor(largura / (altura * RACIO_CONTEUDO));
    return n >= 2 ? n : 1;
  }

  /**
   * A largura que a conta de distância deve usar. Em "total", a do ecrã; em
   * "16/9", a de uma fatia. Um ecrã normal dá o mesmo nos dois.
   */
  function larguraDeConta(largura, altura, modo) {
    if (modo === "total") return largura;
    return largura / fatiasDeEcra(largura, altura);
  }

  /** O que dizer sobre o recorte, ou "" quando não há recorte nenhum a contar. */
  function notaDeRecorte(largura, altura, modo, fmtNum) {
    var f = (typeof fmtNum === "function") ? fmtNum : function (v) { return v.toFixed(2); };
    var n = fatiasDeEcra(largura, altura);
    if (modo === "total") {
      return n > 1 ? "A contar com a largura toda (" + f(largura) +
        " m). Neste ecrã cabem " + n + " janelas de 16/9." : "";
    }
    if (n < 2) return "";
    return "A contar com uma janela de 16/9: " + f(largura / n) + " × " + f(altura) +
      " m (o ecrã leva " + n + ", lado a lado).";
  }

  window.mikeappsVisualizacao = {
    RACIO_CONTEUDO: RACIO_CONTEUDO,
    MODOS: MODOS,
    MODO_POR_OMISSAO: MODO_POR_OMISSAO,
    fatiasDeEcra: fatiasDeEcra,
    larguraDeConta: larguraDeConta,
    notaDeRecorte: notaDeRecorte
  };
})();
