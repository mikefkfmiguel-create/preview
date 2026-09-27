# Versão estável

**Preview 3D v3.90** · commit `d2e0129` · dada como estável a 27 de setembro de 2026.

> *"promovo o par v4.20 / v3.90 a estável?"* — e a resposta: *"Sim"*.

Par: **Calculadores v4.20** (`b12cf56` no repositório `calculadores`). As duas
apps falam uma com a outra — dar uma como estável sem a outra não quer dizer
nada, e por isso o par escreve-se aqui e é promovido ao mesmo tempo.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md`) — quer dizer *experimentado por ele e dado como bom*, com
as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**21 verificações verdes** em `scripts/`:

`barra-de-vista` · `cena` · `comecar-no-deposito` · `contagem` ·
`copiar-pecas` · `excecoes-de-lugares` · `ficheiro-da-app` ·
`fora-das-paredes` · `grupo-no-3d` · `grupos-guardados` · `instalar` ·
`palco` · `planta-de-volta` · `planta-dxf` · `planta-guardada` · `plateia` ·
`posicao-bidirecional` · `posicao-real` · `relatorio-ecras` · `rodar-palco` ·
`sincronizacao`

Três são novas desde a v3.87: `rodar-palco`, `barra-de-vista` e
`comecar-no-deposito`.

Do outro lado, nos Calculadores v4.20, **19 verificações verdes**, a
verificação de tradução sem nada de novo por traduzir (dívida conhecida: 287
trechos) e **41 testes verdes no Worker**. As vinte e uma deste lado correram
no commit que esta página nomeia, não no ramo antes de fundir.

## O que entrou desde a v3.87, que foi a estável anterior

- **o palco principal roda** (v3.88). Os palcos extra, as passarelas soltas e
  as régies rodavam desde que existem; o principal — o único que interessa
  para um palco em diagonal ou encostado a um canto — não rodava. Agora roda à
  volta do próprio centro, e leva consigo **o que assenta nele**: a passarela
  que sai da boca de cena, e o vão que ela abre na plateia. A plateia, os
  ecrãs e a régie ficam medidos à sala, que foi a escolha dele;
- **o que se vê passou do menu para a janela** (v3.89). Os treze
  interruptores do "ver" estavam na secção Vista do painel, a três gestos de
  distância, e com o painel fechado — que é como se olha para o 3D — não
  existiam de todo. Passaram para uma **barra de pastilhas no topo da
  janela**, sempre à vista, na ordem do uso. Duas mudanças pedidas com ela:
  **«Medidas e grelha» nasce desligada** (a app deixou de abrir com a grelha
  no chão e as etiquetas por cima de tudo) e **a escolha fica guardada** neste
  aparelho;
- **quem começa aqui aterra em cima do botão** (v3.90). O aviso da sala vazia
  oferece três caminhos, e o de montar um ecrã ali mesmo levava a uma secção
  vazia e **sem um único botão**. Passou a abrir o **Depósito**, com o
  `+ Ecrã` à vista. Arrumou também três estragos que a v3.89 tinha deixado:
  atalhos e avisos a apontar para uma secção Vista que já não tem os
  interruptores, e a limpeza a fundo a voltar a ligar a grelha que alguém
  tinha desligado.

## Como se volta a este ponto

```
git checkout d2e0129          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v3.90` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `d2e0129`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
