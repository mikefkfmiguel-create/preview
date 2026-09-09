# Instruções para agentes neste repositório

Isto é o **Preview**: uma app web que pega num projeto de ecrãs feito nos
**Calculadores** e mostra-o montado numa sala, em 3D. Corre no browser, sem
servidor, e é servida por GitHub Pages a partir do `main`.

Antes de mexer em código, lê o `README.md` (o que a app faz e porquê) e este
ficheiro (como se trabalha aqui). O `CLAUDE.md` tem o mesmo conteúdo em versão
curta.

## A regra que manda em tudo o resto

**O Preview não sabe nada de tiles, pitch, modelos de LED, projetores ou
lentes.** Quem sabe isso são os Calculadores, e são eles que mandam as medidas
**já em metros**.

Se aparecer aqui uma tabela de modelos ou uma conta de pitch, é sinal de que se
começou a duplicar o outro projeto — e a partir daí passam a existir dois sítios
a discordar sobre o tamanho da mesma parede. A conta faz-se uma vez, no sítio
onde ela vive.

A excepção deliberada é o **endereço do Worker da IA** (`js/assistente.js`): é um
endereço, não uma tabela, e lê-se do `localStorage` que os Calculadores já
escrevem.

## Língua

**Tudo em português de Portugal**: a interface, os comentários no código, as
mensagens de commit, os nomes de funções e variáveis (`fazerPublico`,
`medirSombra`, `camadasLevantadas`). Não traduzir para inglês, nem misturar.

Os comentários explicam **porquê**, não o quê — e de preferência contam o
defeito que os obrigou a existir. O código diz o que faz; os comentários dizem o
que já correu mal.

## A versão sobe SEMPRE que se mexe

Duas coisas, sempre juntas:

1. `index.html` — `<i id="versao">vX.Y</i>`, ao lado de "o projeto no terreno";
2. `sw.js` — `const CACHE = "preview-vX.Y";`, com o **mesmo** número.

Sem isto, quem tem a app aberta continua a ver a versão de ontem e não há nada
no ecrã que o diga. Como o nome do cache muda com a versão, a app nova chega
sozinha.

## Ficheiros

| ficheiro | o que lá vive |
|---|---|
| `index.html` | o painel todo, e o registo do service worker |
| `css/estilo.css` | o aspecto; o painel é elástico e as secções dobram |
| `js/app.js` | montar a cena, os interruptores, os botões, os avisos |
| `js/cena.js` | a sala, o palco, as zonas, o público, a projeção, as plantas |
| `js/projeto.js` | o que chega dos Calculadores (JSON, endereço, `localStorage`) e o texto escrito à mão |
| `js/dxf.js` | ler DXF: entidades, blocos, camadas, unidades |
| `js/importar.js` | os motores pesados (DWG e PDF), carregados só quando fazem falta |
| `js/assistente.js` | falar com a IA (o Worker dos Calculadores) |
| `js/exportar.js` | sair daqui: `.glb`, `.obj` |
| `vendor/` | Three.js, pdf.js, libredwg — **nunca um CDN** |

## Coisas que já custaram tempo aqui

Não repetir nenhuma destas:

- **O Three.js vive no `vendor/`, não num CDN.** Isto usa-se em salas e
  pavilhões sem rede, e uma app 3D que vai buscar o motor à internet falha
  precisamente no sítio onde faz falta.
- **O service worker serve a versão antiga dos módulos** enquanto vai buscar a
  nova em segundo plano. Ao testar uma alteração: ou se desregista o SW, ou se
  recarrega duas vezes. Senão perde-se meia hora a caçar um defeito que já está
  corrigido.
- **Uma navegação que muda só o `#` não recarrega a página.** O módulo não volta
  a correr. Por isso há um `hashchange` no `app.js`: sem ele, o segundo "Ver no
  Preview 3D" mudava o endereço e mais nada.
- **`window.open` com nome só reaproveita a janela se NÃO houver `noopener`** — e
  não alcança de todo uma app instalada (PWA). Foi por aí que falhou a primeira
  tentativa de mandar o texto para os Calculadores analisarem.
- **Um `InstancedMesh` calcula a esfera que o envolve pela geometria, não pelas
  instâncias.** Sem `computeBoundingSphere()` depois de encher as matrizes, o
  público desaparece do ecrã.
- **Não limitar o `maxPolarAngle` dos controlos.** Um espectador sentado olha
  para cima; o limite empurrava a câmara da vista dos olhos para os 3,5 m. Quem
  impede de furar o chão é o travão de altura no laço de desenho.
- **A vista dos olhos tem de ficar num LUGAR**, não a meio das filas — senão a
  câmara fica a 45 cm da nuca do vizinho da frente.
- **A sombra do público não se soma caixa a caixa.** Numa sala cheia elas
  sobrepõem-se quase todas e a soma dava 300%. Rasteriza-se numa grelha de
  128 × 72.
- **Nunca mandar um valor de campo por omissão para a IA como se fosse facto
  assente.** `js/app.js`, `btAnalisar.onclick` mandava sempre `salaL`/`salaP`/
  `salaA` (mesmo intocados, ainda no `defaultValue` do HTML) como "Sala já
  definida no desenho" — isso fazia a IA ignorar uma sala escrita no próprio
  texto ("sala com 25 por 25") a favor do valor de arranque da página.
  Reportado direto: "não leu o tamanho da sala, aplicou o base". Corrigido
  (v2.77) mandando `null` para qualquer campo que ainda seja o
  `defaultValue` — o mesmo `porOMike()` já usado para decidir se se
  aplica ou não a estimativa da IA de volta ao campo, agora hoisted e
  reusado nos dois sentidos.
- **`local.publicoEmPe` (Worker, v3.21) — "de pé" tem de forçar chão plano.**
  O padrão da página é auditório com plateia a subir (`#inclinacao`, valor
  de arranque 0.12) — um texto a dizer "300 pessoas de pé" não muda isso
  sozinho, e o resultado era um auditório a subir para gente de pé.
  Reportado direto: "disse-lhe que era de pé e desenhou um auditório a
  subir". `doQueVeioParaCa()` (`js/assistente.js`) expõe `veio.emPe`; só
  quando `true` (nunca inferido) e só se `#inclinacao` ainda não tiver sido
  mexido à mão, `btAnalisar.onclick` põe-no a 0 (o mesmo que o botão
  "Pavilhão · plano" faz).
- **`--painel` é a COR do painel.** A largura chama-se `--larguraPainel`. Um
  `width: #141B21` é inválido, o painel ficava com a largura do conteúdo, e nada
  no ecrã dizia porquê.
- **Ficheiros em UTF-8 sem BOM, com fins de linha LF.** Nunca editar com
  `Get-Content`/`Set-Content` do PowerShell: corrompe os acentos todos de uma
  vez. Se for preciso um script, Python com `open(p, "rb")` / `open(p, "wb")`.
  Depois de mexer, confirmar com `git diff --numstat`: se um ficheiro tocado em
  cinco sítios aparecer com centenas de linhas alteradas, foi isto.

## Licenças no `vendor/`

- **Three.js** — MIT. **pdf.js** — Apache-2.0.
- **libredwg** — **GPL-3.0**, com a cópia da licença em `vendor/dwg/`. É
  copyleft: o repositório distribui o código, como a licença pede. **Não
  acrescentar dependências copyleft novas sem o mike decidir** — se um dia isto
  for para vender fechado, é o `vendor/dwg/` que tem de sair primeiro, e o
  caminho de recurso já está escrito na app (guardar o DWG como DXF).

## Provar antes de dizer que está feito

Não há testes automáticos. O que há é:

1. **`#btExemplo`** — carrega um projeto de três zonas. Depois de mexer: abrir a
   app, carregar nele e **olhar** para as quatro vistas. Metade dos defeitos
   acima só se viram assim.
2. Servir a pasta (`python -m http.server 8123`) — o `file://` não deixa
   carregar módulos.
3. Se houver Playwright à mão, conduzir a app a sério (carregar ficheiros,
   carregar em botões) e ler o `#aviso`, o `#resumo` e a cena por
   `window.preview` — a app expõe lá dentro `cena`, `desenhado`, `projeto`,
   `plantaCad` e `medirSombra()` precisamente para isso.

## Commits

Mensagem em português, com **assunto curto** e um corpo que explique **o
problema que isto resolve** — não a lista do que se tocou. Um leitor daqui a um
ano quer saber porque é que a mudança existiu.
