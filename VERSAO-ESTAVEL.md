# Versão estável

**Preview 3D v3.96** · commit `022b430` · dada como estável a 28 de setembro de 2026.

> *"publica e promove as duas"*.

Par: **Calculadores v4.33** (`9e85af3` no repositório `calculadores`). As duas
apps falam uma com a outra — dar uma como estável sem a outra não quer dizer
nada, e por isso o par escreve-se aqui e é promovido ao mesmo tempo.

Desta vez andaram os dois, cada um no seu pedido — mas continuam a ser um
par: é dos Calculadores que vêm a altura do ecrã, a altura da lente e o
shift que este lado desenha.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md`) — quer dizer *experimentado por ele e dado como bom*, com
as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**24 verificações verdes** em `scripts/`:

`altura-e-formas` · `barra-de-vista` · `cena` · `contagem` · `copiar-pecas` ·
`enquadrar-o-que-existe` · `excecoes-de-lugares` · `ficheiro-da-app` ·
`fora-das-paredes` · `grupo-no-3d` · `grupos-guardados` · `instalar` ·
`ir-buscar-versao` · `montar-aqui-mesmo` · `palco` · `planta-de-volta` ·
`planta-dxf` · `planta-guardada` · `plateia` · `posicao-bidirecional` ·
`posicao-real` · `relatorio-ecras` · `rodar-palco` · `sincronizacao`

A nova desde a v3.93 é `altura-e-formas`, com 17 asserções. O `ir-buscar-versao` corre **com o service worker
ligado**, ao contrário de todos os outros — ali ele é o assunto.

Do outro lado, nos Calculadores v4.33, **22 verificações verdes**, a
verificação de tradução sem nada de novo por traduzir (dívida conhecida: 287
trechos) e **41 testes verdes no Worker**. As vinte e quatro deste lado correram
no commit que esta página nomeia, não no ramo antes de fundir.

## O que entrou desde a v3.93, que foi a estável anterior

Tudo v3.94: quatro correcções, dos reparos que ele fez numa manhã. Todas
medidas antes e depois — nenhuma se resolveu a ler código.

- **a altura do ecrã ao chão vem de quem a sabe.** *"Está a nascer assim
  quando vem da calculadora, e nela não tenho onde dizer a que altura do chão
  está o ecrã."* Os Calculadores passam a dizê-la (v4.31) e é ela que manda;
  sem ela, a base do conjunto caía na altura do palco, 1 m por omissão, que
  não era escolha de ninguém. Duas armadilhas pelo caminho, e as duas só se
  viram **a medir**: o campo morria numa lista branca no `projeto.js`, e a
  conta da altura existe em **dois sítios** (`contextoDeZonas` no app.js e
  `fazerZonas` no cena.js) — corrigiu-se um, mediu-se, e o ecrã continuava a
  1 m. O zero tem de passar: é o ecrã pousado no chão, não é «não sei»;

- **o que vem dos Calculadores entra na sala.** Ia todo para o depósito e
  ficava à espera, invisível — a sala aparecia vazia sem nada a dizer porquê.
  Era o que ele via quando disse *"devia criar a superfície do ecrã também"*:
  ela era criada, só que ficava à espera. Decisão dele, posta a três opções.
  O que já lá está à espera continua lá;

- **«Mostrar projeção» desliga a projeção toda.** *"Ao desligar apenas está a
  apagar um projetor."* E era: a guarda vivia **dentro** do
  `desenharProjecao()`, e a fila de extras — e o blend curvo — desenhavam-se
  na mesma. Medido com uma fila de três: desligado ficavam 6 objectos na
  cena; agora, zero. E ganha pastilha no topo, espelhada com a caixa do
  painel;

- **o blend plano nasce no sítio** (v3.95). Segunda foto do mesmo dia:
  *"continua abaixo do chão e não centrado na sala"*. Duas coisas, as duas no
  caminho do BLEND, que é outra ponte. O `lateral` vem centrado na tela, mas
  a PRIMEIRA máquina nunca escrevia o dela — e as outras são postas em
  relação a ela, por isso a fila inteira aparecia deslocada exactamente esse
  valor (imagens a 0, +3,47 e +6,94 em vez de −3,47, 0 e +3,47). E a altura
  da lente e o shift só viajavam num ecrã curvo: num plano o 3D arrancava com
  4,5 m e −25% enquanto os Calculadores diziam 8 m e −90%. Medido depois:
  centro em x = 0, lente a 8,00 m, shift −83,3%, nada abaixo do chão;

- **o pano plano é uma peça, e agrupa-se com os projetores** (v3.96). Pedido
  dele: *"e se precisar andar com o ecrã para o meio da sala, de forma a que
  possa agrupar com os projetores"*. Não dava, e por uma razão de fundo: o
  pano plano **nem existia** como objeto — via-se só a luz a aterrar, e onde
  ela caísse ao lado não havia nada que o mostrasse. Agora é desenhado à
  medida das imagens, tem posição própria, e selecciona-se, arrasta-se e
  agrupa-se como qualquer outra peça. A conta de onde ele está passou dos
  quatro sítios em que estava escrita à mão para uma função só.

  Pelo caminho, um defeito apanhado a medir antes de publicar: à primeira as
  máquinas acompanhavam o pano por um interruptor, e com os dois no mesmo
  grupo tudo se movia **a dobrar** (pedia-se +2 m e o pano andava +4). Dois
  mecanismos para a mesma coisa; ficou um, que é o grupo;

- **o palco principal sabe fazer só a frente redonda, e o círculo é um
  círculo.** As duas metades tinham a mesma raiz, na mesma linha: o
  `fazerPalco()` chamava o `geometriaDeTampo()` com quatro argumentos e
  deixava o quinto — o `meio` — por dizer; só os palcos extra sabiam fazer
  meia-lua. E os cantos eram Béziers **quadráticas**, que são parábolas e não
  arcos: um palco de 16 m pedido em círculo saía com **8,49 m** do centro à
  diagonal em vez de 8,00, **+6,1%**, quase meio metro. Passam a ser arcos de
  elipse, como a meia-lua já fazia desde sempre. Erro medido depois: **0%**.

## Como se volta a este ponto

```
git checkout 022b430          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v3.96` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `022b430`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
