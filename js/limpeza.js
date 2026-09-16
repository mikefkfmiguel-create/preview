/**
 * LIMPAR TUDO, A SÉRIO, NAS DUAS APPS DE UMA VEZ.
 *
 * Pedido assim, a testar no telemóvel: *"estou a testar o que poderá ser um
 * gestor numa visita com o cliente na rua a tentar dar resposta rápida. Se
 * tenho peças a entrar que posso não me lembrar, poderei ter um engano. Forma
 * simples de limpar tudo mas a fundo, tudo vazio sem nada por omissão ao toque
 * de um botão, que sirva para os dois sem ter de estar a limpar num e noutro."*
 *
 * O que o motivou: um projeto acabado de fazer na aba Ecrã LED apareceu no 3D
 * com um DSM que ninguém lhe tinha posto. O DSM estava guardado à parte, numa
 * chave só dele, de um dia qualquer — e ia colado a todos os projetos desde
 * então. O "Limpar tudo" que já existia apagava UMA chave (as zonas) e
 * recarregava: prometia tudo e entregava um bocadinho.
 *
 * A REGRA É AO CONTRÁRIO DA ÓBVIA, e é essa a coisa importante aqui:
 *
 *   apaga-se TUDO o que tem os nossos prefixos, menos uma lista curta de
 *   coisas que se querem manter.
 *
 * Enumerar o que se apaga parece mais seguro e é o contrário: uma chave nova
 * criada daqui a dois meses fica de fora da lista, ninguém dá por isso, e a
 * limpeza volta a mentir. Com a regra ao contrário, uma chave nova é apagada
 * por omissão — e se não devia ser, isso vê-se logo à primeira limpeza, em vez
 * de aparecer num 3D à frente de um cliente.
 *
 * AS DUAS APPS VIVEM NA MESMA ORIGEM (mikeapps.github.io/calculadores e
 * /preview), por isso partilham o mesmo localStorage. Uma limpeza feita de um
 * lado apaga mesmo o outro — não é preciso ir lá.
 */
(function () {
  "use strict";

  // Os prefixos que são nossos. Tudo o que começar por um destes é dado de
  // projeto até prova em contrário.
  var PREFIXOS = ["mikeapps-", "calculadores-", "calc-", "preview-"];

  /**
   * O QUE FICA. Só coisas que descrevem a APP, nunca o trabalho.
   *
   * A pergunta para decidir: "se isto desaparecer, a pessoa perde uma escolha
   * que fez sobre a ferramenta, ou perde trabalho?" Perder trabalho é o que se
   * quer — é para isso que o botão serve. Perder a escolha é uma surpresa.
   *
   * A contagem de uso é a que MAIS importa aqui: se alguém a desligou, apagar
   * a chave voltava a ligá-la em silêncio. Uma limpeza de projeto nunca pode
   * mexer numa decisão de privacidade.
   */
  var MANTER = [
    "calc-lang",                          // PT/EN
    "calc-install-dismissed",             // o convite para instalar, já dispensado
    "calculadores-uso-v1",                // contagem: o id e o ligado/desligado
    "calculadores-assistente-worker-url", // endereço do Worker, se foi mudado à mão
    "calculadores-canvas-mode",           // preferência de desenho
    "mikeapps-sincronizacao-v1",          // sincronização automática ligada/desligada
    "mikeapps-sincronizacao-aviso-v1",    // o aviso da sincronização, já lido
    "preview-painel",                     // painel aberto/fechado
    "preview-dobras",                     // secções dobradas
    "preview-largura-painel",             // largura do painel
    "preview-edicao-livre"                // cadeado aberto/fechado
  ];

  // Escrita no fim da limpeza, para a OUTRA app (aberta noutro separador) dar
  // por ela. O evento `storage` só chega a separadores que não fizeram a
  // mudança, que é exactamente quem precisa de ser avisado.
  var CHAVE_DO_AVISO = "mikeapps-limpeza-v1";

  function nossa(chave) {
    for (var i = 0; i < PREFIXOS.length; i++) {
      if (chave.indexOf(PREFIXOS[i]) === 0) return true;
    }
    return false;
  }

  /**
   * Apaga, e devolve o que apagou e o que deixou ficar — para quem chama poder
   * dizer à pessoa o que aconteceu em vez de só recarregar a página.
   *
   * NÃO recarrega: isso é decisão de quem chama, e sem recarregar isto pode
   * ser testado a sério.
   */
  function limpezaProfunda() {
    var apagadas = [], mantidas = [];
    try {
      var todas = [];
      for (var i = 0; i < localStorage.length; i++) todas.push(localStorage.key(i));
      todas.forEach(function (chave) {
        if (!chave || !nossa(chave) || chave === CHAVE_DO_AVISO) return;
        if (MANTER.indexOf(chave) !== -1) { mantidas.push(chave); return; }
        try { localStorage.removeItem(chave); apagadas.push(chave); } catch (e) {}
      });
      // O aviso vai por último, já com tudo apagado: um separador que acorde
      // com ele encontra o terreno limpo, não a meio.
      try { localStorage.setItem(CHAVE_DO_AVISO, String(Date.now())); } catch (e) {}
    } catch (e) {}
    return { apagadas: apagadas, mantidas: mantidas };
  }

  /**
   * Do outro lado: quem estiver aberto noutro separador recarrega sozinho.
   * Sem isto, a app do lado continuava a mostrar o projeto antigo e a
   * regravá-lo ao primeiro toque — e a limpeza desfazia-se sozinha.
   */
  function ouvirLimpezaDeOutroSeparador(aoLimpar) {
    window.addEventListener("storage", function (e) {
      if (e.key !== CHAVE_DO_AVISO || !e.newValue) return;
      if (typeof aoLimpar === "function") aoLimpar();
      else location.reload();
    });
  }

  window.mikeappsLimpeza = {
    limpezaProfunda: limpezaProfunda,
    ouvirLimpezaDeOutroSeparador: ouvirLimpezaDeOutroSeparador,
    MANTER: MANTER,
    PREFIXOS: PREFIXOS,
    CHAVE_DO_AVISO: CHAVE_DO_AVISO
  };
})();
