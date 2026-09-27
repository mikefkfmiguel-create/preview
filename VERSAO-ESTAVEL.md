# Versão estável

**Preview 3D v3.93** · commit `07872e7` · dada como estável a 27 de setembro de 2026.

> *"publica e promove as duas"*.

Par: **Calculadores v4.28** (`1469088` no repositório `calculadores`). As duas
apps falam uma com a outra — dar uma como estável sem a outra não quer dizer
nada, e por isso o par escreve-se aqui e é promovido ao mesmo tempo.

Desta vez só o outro lado andou. O Preview está na mesma v3.93, e é promovido
de novo por ser o par testado com os Calculadores v4.28 — não por ter mudado
alguma coisa aqui.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md`) — quer dizer *experimentado por ele e dado como bom*, com
as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**23 verificações verdes** em `scripts/`:

`barra-de-vista` · `cena` · `contagem` · `copiar-pecas` ·
`enquadrar-o-que-existe` · `excecoes-de-lugares` · `ficheiro-da-app` ·
`fora-das-paredes` · `grupo-no-3d` · `grupos-guardados` · `instalar` ·
`ir-buscar-versao` · `montar-aqui-mesmo` · `palco` · `planta-de-volta` ·
`planta-dxf` · `planta-guardada` · `plateia` · `posicao-bidirecional` ·
`posicao-real` · `relatorio-ecras` · `rodar-palco` · `sincronizacao`

Três são novas desde a v3.90: `montar-aqui-mesmo`, `ir-buscar-versao` e
`enquadrar-o-que-existe`. O `ir-buscar-versao` corre **com o service worker
ligado**, ao contrário de todos os outros — ali ele é o assunto.

Do outro lado, nos Calculadores v4.28, **22 verificações verdes**, a
verificação de tradução sem nada de novo por traduzir (dívida conhecida: 287
trechos) e **41 testes verdes no Worker**. As vinte e três deste lado correram
no commit que esta página nomeia, não no ramo antes de fundir.

## O que entrou desde a v3.90, que foi a estável anterior

- **o botão que diz montar, monta** (v3.91). «Montar um ecrã aqui mesmo»
  levava ao Depósito, e o `+ Ecrã` de lá põe a peça **à espera**: a sala
  continuava vazia e o cartão «A sala está vazia» continuava lá. Agora o ecrã
  entra na sala. Pelo caminho, dois defeitos de **todos** os atalhos do
  painel: o cabeçalho *sticky* tapava o destino (levar algo ao "topo do
  painel" metia-o debaixo dele), e a rolagem suave acabava 147 px ao lado
  porque o painel se reescreve por baixo dela;
- **ir buscar a versão nova** (v3.92). Registar o service worker não chega: o
  browser só vai ver o `sw.js` numa navegação, e uma app instalada que se
  retoma do fundo não navega para lado nenhum — ficava dias na versão de
  trás, sem um sinal. Agora a app pergunta pelo **número** e o número da
  versão é um **botão**. Três defeitos por baixo, medidos: a pergunta «há
  rede?» era respondida pelo cache (com a rede cortada o cache era apagado na
  mesma), o `unregister()` ficava pendurado e a app nunca recarregava, e
  faltava o `updateViaCache: "none"`;
- **o 🏠 enquadra as peças, e não o chão** (v3.93). A caixa a enquadrar era à
  volta de tudo o que está desenhado — e tudo inclui o chão e as paredes. Num
  pavilhão de 120 m a caixa **é** a sala, e o botão levava a câmara para trás
  de tudo. Medido: agora a câmara fica a 42,6 m das peças; antes, a mais de
  150.

## Como se volta a este ponto

```
git checkout 07872e7          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v3.93` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `07872e7`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
