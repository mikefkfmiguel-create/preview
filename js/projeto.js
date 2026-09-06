// O projeto que vem dos Calculadores.
//
// O preview não sabe nada de tiles, pitch ou catálogos — e é de propósito. Quem
// sabe isso são os Calculadores, e são eles que mandam as zonas **já em metros**.
// Assim o dia em que lá entrar um modelo de LED novo não obriga a mexer aqui, e
// nunca há dois sítios a discordar sobre o tamanho da mesma parede.

export const FORMATO = 1;

// Um projeto para experimentar sem ter de ir buscar nada: uma parede principal
// com duas alas, do género do que se monta num palco.
export const EXEMPLO = {
  v: FORMATO,
  origem: "exemplo",
  nome: "Palco com duas alas",
  zonas: [
    { nome: "Ala esquerda", x: 0,    y: 0.6, w: 3.0, h: 3.4, cor: "#22D3EE",
      tiles: { x: 6, y: 7 },  res: { x: 768,  y: 896  }, peso: 252, amp: 24 },
    { nome: "Principal",    x: 3.5,  y: 0,   w: 8.0, h: 4.5, cor: "#2E7BFF",
      tiles: { x: 16, y: 9 }, res: { x: 2048, y: 1152 }, peso: 864, amp: 82 },
    { nome: "Ala direita",  x: 12.0, y: 0.6, w: 3.0, h: 3.4, cor: "#22D3EE",
      tiles: { x: 6, y: 7 },  res: { x: 768,  y: 896  }, peso: 252, amp: 24 }
  ]
};

function numero(valor, porOmissao) {
  const n = typeof valor === "string" ? parseFloat(valor.replace(",", ".")) : valor;
  return Number.isFinite(n) ? n : porOmissao;
}

/** Aceita o que vier e devolve um projeto com o feitio certo, ou atira. */
export function lerProjeto(bruto) {
  let dados = bruto;
  if (typeof bruto === "string") {
    const texto = bruto.trim();
    if (!texto) throw new Error("Não veio nada.");
    try {
      dados = JSON.parse(texto);
    } catch (e) {
      throw new Error("Isto não é JSON válido — falta uma chaveta ou uma vírgula?");
    }
  }

  // Também se aceita a lista de zonas à seca, que é o que está no localStorage
  // dos Calculadores: quem cola raramente sabe qual das duas coisas tem na mão.
  const zonasBrutas = Array.isArray(dados) ? dados : dados.zonas;
  if (!Array.isArray(zonasBrutas) || !zonasBrutas.length) {
    throw new Error("Não encontrei zonas nenhumas lá dentro.");
  }

  const zonas = [];
  const recusadas = [];
  zonasBrutas.forEach((z, i) => {
    const largura = numero(z.w, numero(z.largura, NaN));
    const altura = numero(z.h, numero(z.altura, NaN));
    if (!(largura > 0) || !(altura > 0)) {
      // Uma zona sem medidas é uma zona que veio do sítio errado: o localStorage
      // guarda tiles e modelo, não metros. Dizer qual falhou vale mais do que
      // recusar o projeto todo.
      recusadas.push(z.nome || z.name || `zona ${i + 1}`);
      return;
    }
    zonas.push({
      nome: String(z.nome || z.name || `Zona ${i + 1}`),
      x: numero(z.x, numero(z.posX, 0)),
      y: numero(z.y, numero(z.posY, 0)),
      w: largura,
      h: altura,
      cor: typeof z.cor === "string" ? z.cor : (z.colorOverride || "#2E7BFF"),
      curva: z.curva && numero(z.curva.valor, 0)
        ? { modo: z.curva.modo === "raio" ? "raio" : "angulo",
            valor: numero(z.curva.valor, 0),
            dir: z.curva.dir === "concavo" ? "concavo" : "convexo" }
        : null,
      tiles: z.tiles || null,
      res: z.res || null,
      peso: numero(z.peso, null),
      amp: numero(z.amp, null)
    });
  });

  if (!zonas.length) {
    throw new Error("Nenhuma zona trazia medidas em metros. " +
                    "Isto veio do localStorage em vez do botão dos Calculadores?");
  }

  return {
    v: numero(dados.v, FORMATO),
    nome: dados.nome || dados.name || "Projeto",
    origem: dados.origem || "colado",
    sala: dados.sala || null,
    zonas,
    recusadas
  };
}

/** Os números que interessam ao olhar para o conjunto todo. */
export function totais(projeto) {
  const z = projeto.zonas;
  const esquerda = Math.min(...z.map(a => a.x));
  const direita = Math.max(...z.map(a => a.x + a.w));
  const topo = Math.min(...z.map(a => a.y));
  const fundo = Math.max(...z.map(a => a.y + a.h));
  const soma = (campo) => z.reduce((t, a) => t + (a[campo] || 0), 0);
  return {
    largura: direita - esquerda,
    altura: fundo - topo,
    esquerda, direita, topo, fundo,
    peso: soma("peso"),
    amp: soma("amp"),
    zonas: z.length
  };
}

/** Lê um projeto que venha no endereço, posto lá pelos Calculadores. */
export function projetoDoEndereco() {
  const marca = "#p=";
  const bruto = location.hash.startsWith(marca) ? location.hash.slice(marca.length) : "";
  if (!bruto) return null;
  try {
    const base64 = decodeURIComponent(bruto).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return lerProjeto(new TextDecoder().decode(bytes));
  } catch (e) {
    throw new Error("O endereço traz um projeto que não consigo abrir: " + e.message);
  }
}


// As duas apps vivem no mesmo domínio, por isso partilham o localStorage — e é
// esse o canal por onde falam uma com a outra, sem servidor nenhum pelo meio.
export const CHAVE_PROJETO = "mikeapps-projeto-v1";
export const CHAVE_SALA = "mikeapps-sala-v1";

/** O último projeto que os Calculadores deixaram guardado, se houver. */
export function projetoGuardado() {
  try {
    const bruto = localStorage.getItem(CHAVE_PROJETO);
    return bruto ? lerProjeto(bruto) : null;
  } catch (e) {
    return null;
  }
}

/** A sala fica guardada para os Calculadores a poderem ir buscar. */
export function guardarSala(sala) {
  try {
    localStorage.setItem(CHAVE_SALA, JSON.stringify(
      Object.assign({ v: 1, quando: new Date().toISOString() }, sala)));
  } catch (e) { /* sem localStorage a app funciona na mesma */ }
}
