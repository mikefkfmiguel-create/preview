/**
 * INSTALAR A APP — DO ÚNICO SÍTIO DE ONDE ISSO SE PODE PEDIR.
 *
 * Pedido a olhar para a página de entrada: *"podemos ter um link para download
 * aqui que force a instalar a app"*, e a seguir a explicação do que ele quer:
 * *"forçaria a app a abrir nos browsers que podem criar o atalho instalado nas
 * várias plataformas"*.
 *
 * O QUE NÃO SE PODE FAZER, e vale a pena ficar escrito para não se tentar
 * outra vez: nenhum link instala nada. Não há URL, cabeçalho nem ficheiro que
 * faça um browser instalar uma app web -- e ainda bem, porque a alternativa
 * era qualquer página do mundo poder pôr ícones no teu telemóvel. A instalação
 * é sempre um gesto de quem está a usar, feito DENTRO da app.
 *
 * O que se pode fazer é o que está aqui:
 *
 *   1. apanhar o `beforeinstallprompt` (Chrome/Edge, no computador e no
 *      Android) e guardá-lo. É ele que deixa abrir a caixa de instalação a
 *      partir de um botão nosso, em vez de esperar que a pessoa descubra o
 *      ícone na barra de endereço;
 *   2. onde esse evento não existe -- iPhone, iPad, Firefox -- DIZER como se
 *      faz nessa plataforma, em vez de mostrar um botão que não faz nada. Um
 *      botão morto é pior do que instrução nenhuma;
 *   3. e desaparecer quando a app JÁ está instalada: quem já a tem não precisa
 *      de um convite a cada abertura.
 *
 * A página de entrada liga para cá com `#instalar` no endereço -- e aí o botão
 * carrega-se sozinho, que é o mais perto de "um link que instala" que existe.
 *
 * Este ficheiro é o MESMO nas duas apps. Uma cópia por app, igual, como o
 * js/ficheiros.js e o js/visualizacao.js -- duas cópias que não podem divergir
 * são melhores do que uma partilhada que uma das apps não consegue carregar.
 */
(function () {
  "use strict";

  var pedidoGuardado = null;
  var ouvintes = [];

  /** Já está instalada? (aberta como app, e não num separador) */
  function jaInstalada() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: window-controls-overlay)").matches) return true;
      // iOS diz-no à sua maneira.
      if (window.navigator && window.navigator.standalone) return true;
    } catch (e) {}
    return false;
  }

  /**
   * Como se instala AQUI, quando o browser não nos deixa pedir.
   *
   * Só se escreve o que é mesmo assim em cada sítio -- um caminho de menu
   * errado faz perder mais tempo do que nenhum.
   */
  function comoSeFazAqui() {
    var ua = String(navigator.userAgent || "");
    var iOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (iOS) {
      return "No iPhone/iPad é no Safari: botão de Partilhar (o quadrado com a seta) " +
             "→ “Adicionar ao ecrã principal”.";
    }
    if (/Firefox/.test(ua)) {
      return "O Firefox no computador não instala apps web. No Firefox de Android é " +
             "no menu → “Adicionar ao ecrã principal”; no computador, usa o " +
             "Chrome ou o Edge.";
    }
    if (/Android/.test(ua)) {
      return "No Chrome de Android: menu (⋮) → “Instalar aplicação” ou " +
             "“Adicionar ao ecrã principal”.";
    }
    if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) {
      return "No Safari do Mac: menu Ficheiro → “Adicionar à Dock”.";
    }
    return "No Chrome ou no Edge: o ícone de instalar na barra de endereço, ou " +
           "menu (⋮) → “Instalar”. Se não aparecer, a app já está instalada.";
  }

  function avisar() {
    var estado = pedidoGuardado ? "pode" : (jaInstalada() ? "instalada" : "manual");
    ouvintes.forEach(function (fn) { try { fn(estado); } catch (e) {} });
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    // Sem isto o browser mostra a barra dele quando lhe apetece. Guardado,
    // é o nosso botão que escolhe o momento -- que é o pedido.
    e.preventDefault();
    pedidoGuardado = e;
    avisar();
  });

  window.addEventListener("appinstalled", function () {
    pedidoGuardado = null;
    avisar();
  });

  /**
   * Pede a instalação. Devolve "aceitou", "recusou" ou "manual" (o browser não
   * deixa pedir -- e aí o que se devolve é a instrução de como se faz).
   */
  function pedirInstalacao() {
    if (!pedidoGuardado) {
      return Promise.resolve({ resultado: "manual", recado: comoSeFazAqui() });
    }
    var pedido = pedidoGuardado;
    pedidoGuardado = null;
    avisar();
    return pedido.prompt().then(function () {
      return pedido.userChoice;
    }).then(function (escolha) {
      return { resultado: (escolha && escolha.outcome === "accepted") ? "aceitou" : "recusou" };
    }).catch(function () {
      // Um pedido gasto ou recusado pelo browser não pode ficar calado.
      return { resultado: "manual", recado: comoSeFazAqui() };
    });
  }

  /**
   * Liga um botão já existente na página. `aoDizer` recebe o texto quando há
   * algo a explicar (o caminho do menu nesta plataforma, ou a confirmação).
   */
  function ligarBotao(id, aoDizer) {
    var botao = document.getElementById(id);
    if (!botao) return;
    function arrumar(estado) {
      // Instalada: o botão sai da frente. Nos outros casos fica -- mesmo
      // quando o browser não deixa pedir, porque aí ele serve para DIZER como
      // se faz, e é essa a única ajuda que há no iPhone.
      botao.hidden = (estado === "instalada");
    }
    ouvintes.push(arrumar);
    arrumar(pedidoGuardado ? "pode" : (jaInstalada() ? "instalada" : "manual"));

    botao.addEventListener("click", function () {
      pedirInstalacao().then(function (r) {
        if (typeof aoDizer !== "function") return;
        if (r.resultado === "aceitou") aoDizer("A app está a instalar-se. Vai ficar no menu, como as outras.");
        else if (r.resultado === "recusou") aoDizer("Ficou por instalar. O botão continua aqui para quando quiseres.");
        else aoDizer(r.recado);
      });
    });

    // A PÁGINA DE ENTRADA MANDA PARA AQUI COM "#instalar".
    //
    // É o mais perto de "um link que instala" que existe: o link abre a app e
    // a app pede a instalação. Espera-se um pouco pelo beforeinstallprompt --
    // ele costuma chegar depois do primeiro desenho, e pedir antes disso era
    // cair sempre nas instruções manuais mesmo onde a caixa ia aparecer.
    if (String(location.hash || "").toLowerCase().indexOf("instalar") >= 0) {
      var tentativas = 0;
      var aEspera = setInterval(function () {
        tentativas++;
        if (pedidoGuardado || tentativas > 10) {
          clearInterval(aEspera);
          if (jaInstalada()) {
            if (typeof aoDizer === "function") aoDizer("Esta app já está instalada.");
            return;
          }
          botao.click();
        }
      }, 300);
    }
  }

  window.mikeappsInstalar = {
    ligarBotao: ligarBotao,
    pedirInstalacao: pedirInstalacao,
    comoSeFazAqui: comoSeFazAqui,
    jaInstalada: jaInstalada,
    // Porta de serviço, para os testes perguntarem sem ler o ecrã.
    estado: function () {
      return pedidoGuardado ? "pode" : (jaInstalada() ? "instalada" : "manual");
    }
  };
})();
