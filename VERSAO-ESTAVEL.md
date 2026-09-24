# Versão estável

**Preview 3D v3.87** · commit `ed7b80b` · dada como estável a 24 de setembro de 2026.

> *"era só para confirmares as versões correctas como estão"* — com as duas
> apps abertas lado a lado. E a seguir, confirmadas: *"promove as duas"*.

Par: **Calculadores v4.12** (`6c63869` no repositório `calculadores`). As duas
apps falam uma com a outra — dar uma como estável sem a outra não quer dizer
nada, e por isso o par escreve-se aqui e é promovido ao mesmo tempo.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md`) — quer dizer *experimentado por ele e dado como bom*, com
as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**18 verificações verdes** em `scripts/`:

`cena` · `contagem` · `copiar-pecas` · `excecoes-de-lugares` ·
`ficheiro-da-app` · `fora-das-paredes` · `grupo-no-3d` · `grupos-guardados` ·
`instalar` · `palco` · `planta-de-volta` · `planta-dxf` · `planta-guardada` ·
`plateia` · `posicao-bidirecional` · `posicao-real` · `relatorio-ecras` ·
`sincronizacao`

Cinco delas são novas desde a v3.79: `copiar-pecas`, `grupo-no-3d`,
`grupos-guardados`, `posicao-real` e `relatorio-ecras`.

Do outro lado, nos Calculadores v4.12, **17 verificações verdes** e a
verificação de tradução sem nada de novo por traduzir (dívida conhecida: 287
trechos). As dezoito deste lado correram no commit que esta página nomeia, não
no ramo antes de fundir.

## O que entrou desde a v3.79, que foi a estável anterior

- **a folha de montagem leva o quadro dos ecrãs** (v3.80): medida, pitch,
  resolução e peso, em separado e em total, sem inventar número nenhum;
- **marcar várias peças e mexê-las juntas** (v3.81) — Shift+clique, e o
  conjunto roda como um corpo;
- **o eixo da rotação deixou de fugir** (v3.82): é a média dos pontos de
  rotação, não o centro da caixa que as envolve (derivava metros);
- **copiar peças** (v3.83), com identidade própria e tudo o que a original
  tem;
- **o laço, o Escape e cópias de cor nova** (v3.84), palcos e passarelas
  incluídos;
- **grupos guardados** (v3.85): um cenário é um objeto — anda junto, tem uma
  cor só, fica no ficheiro, e o duplo clique entra para afinar um degrau;
- **a cópia deixou de atirar peças para longe** (v3.86), e a caixa de ajustes
  arrasta-se pelo cabeçalho;
- **os números do painel batem certo com a sala** (v3.87): "lado"/"fundo" só
  onde são mesmo a coordenada, ↔/↕ onde são deslocamento, a posição real
  escrita por baixo dos campos — e o "subir" dos palcos extra, passarelas e
  régies, que até aqui não fazia nada.

## Como se volta a este ponto

```
git checkout ed7b80b          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v3.87` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `ed7b80b`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
