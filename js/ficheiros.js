/**
 * OS FICHEIROS DIZEM DE QUE APP SÃO, NO NOME.
 *
 * Pedido assim: *"os ficheiros gravados nas duas apps devem ter extensões que
 * os identifique, sair apenas json não sei nunca qual é de onde. Podia ser
 * «Pvw» para o 3D e «Cal» para as calculadoras"*.
 *
 * Por dentro cada ficheiro já se identificava (`_app`/`tipo`), e cada app já
 * recusava o da outra. Só que isso só se descobre DEPOIS de abrir — e na lista
 * de descargas do telemóvel, com meia dúzia deles, o que se vê é "JSON, JSON,
 * JSON". O nome era `festa.calculadores.json`, que resolvia no papel e não no
 * ecrã: o meio do nome é a primeira coisa que qualquer lista corta.
 *
 * Portanto:
 *
 *     Calculadores → festa.cal
 *     Preview 3D   → festa.pvw
 *
 * Por dentro continua a ser JSON, e o Blob continua a sair com o tipo
 * `application/json`: é o que mantém a partilha nativa do telemóvel a
 * funcionar e o ficheiro a abrir-se em qualquer editor de texto. Muda o nome,
 * não muda o conteúdo.
 *
 * DUAS REGRAS QUE NÃO SE PODEM PERDER:
 *
 * 1. A ABRIR, ACEITA-SE SEMPRE O `.json` ANTIGO. Há projetos gravados em
 *    telemóveis e computadores com o nome de antes, e uma extensão nova que
 *    os deixasse de fora era perder trabalho já feito por causa de uma
 *    etiqueta. A extensão é para LER, não é para autorizar: quem decide é o
 *    que está lá dentro.
 *
 * 2. O `accept` tem de trazer as extensões POR EXTENSO. `.cal` e `.pvw` são
 *    desconhecidas do sistema, por isso chegam sem tipo (ou como
 *    "application/octet-stream") -- um `accept="application/json"` sozinho
 *    punha-as a cinzento no seletor do telemóvel, impossíveis de escolher.
 */
(function () {
  "use strict";

  // O "de" vai com o nome porque um é plural e o outro não: "dos Calculadores"
  // e "do Preview 3D". Montar a frase com um "do" fixo dava "do Calculadores",
  // e um recado com um erro de português passa a parecer coisa de máquina --
  // logo na frase que é suposto tirar a dúvida a alguém.
  var APPS = {
    calculadores: { ext: ".cal", nome: "Calculadores", de: "dos",
                    marca: "_app", valor: "calculadores-projeto" },
    preview: { ext: ".pvw", nome: "Preview 3D", de: "do",
               marca: "tipo", valor: "preview-projeto" }
  };

  // O que se põe no accept="" dos dois lados. As duas extensões novas, o .json
  // de antes, e o tipo — para o seletor mostrar todos os que interessam.
  var ACEITA = ".cal,.pvw,.json,application/json";

  /** Que nome dar ao ficheiro desta app, a partir do nome do projeto. */
  function nomeDoFicheiro(qual, nomeDoProjeto) {
    var app = APPS[qual];
    if (!app) return String(nomeDoProjeto || "projeto");
    // Sem acentos e sem nada que dê problemas num nome de ficheiro: estes
    // ficheiros viajam por email, WhatsApp e cartões SD.
    var limpo = Array.from(String(nomeDoProjeto || "").normalize("NFD")).filter(function (ch) {
      var c = ch.codePointAt(0);
      return c < 768 || c > 879;
    }).join("");
    var base = limpo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "projeto";
    return base + app.ext;
  }

  /** De que app é este conteúdo já lido? Decide-se pelo que está lá dentro. */
  function deQuemE(estado) {
    if (!estado || typeof estado !== "object") return null;
    for (var qual in APPS) {
      if (estado[APPS[qual].marca] === APPS[qual].valor) return qual;
    }
    return null;
  }

  /**
   * A frase a mostrar quando o ficheiro não é desta app.
   *
   * O ponto todo do pedido está aqui: não chega recusar, tem de dizer de onde
   * ele é. "Não é um projeto desta app" manda a pessoa adivinhar outra vez --
   * que é exactamente o que se está a corrigir.
   */
  function recadoDeFicheiroErrado(estado, estaApp) {
    var dono = deQuemE(estado);
    if (dono && dono !== estaApp) {
      return "Este ficheiro é " + APPS[dono].de + " " + APPS[dono].nome +
        " (" + APPS[dono].ext + ") — abre-o lá. Aqui só entram os " +
        APPS[estaApp].ext + ".";
    }
    return "Este ficheiro não é um projeto guardado — os " + APPS[estaApp].de + " " +
      APPS[estaApp].nome + " terminam em " + APPS[estaApp].ext + ".";
  }

  window.mikeappsFicheiros = {
    APPS: APPS, ACEITA: ACEITA,
    nomeDoFicheiro: nomeDoFicheiro,
    deQuemE: deQuemE,
    recadoDeFicheiroErrado: recadoDeFicheiroErrado
  };
})();
