# Versão estável

**Preview 3D v3.79** · commit `63f3f73` · dada como estável a 20 de setembro de 2026.

> *"parece bem este por agora, podes dar como estável a versão"*

Par: **Calculadores v4.11** (`3ea8468` no repositório `calculadores`),
actualizado a 21 de setembro. As duas apps falam uma com a outra — dar uma
como estável sem a outra não quer dizer nada, e por isso o par escreve-se aqui
e vai sendo corrigido: o código deste lado não mudou, o companheiro dele sim.

A v4.10 dos Calculadores, que era o par de ontem, levava um defeito que
trancava a app ao abrir um projeto com várias zonas. Está corrigido na v4.11 —
que é a que esta linha agora nomeia.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md`) — quer dizer *experimentado por ele e dado como bom*, com
as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**13 verificações verdes** em `scripts/`:

`cena` · `contagem` · `excecoes-de-lugares` · `ficheiro-da-app` ·
`fora-das-paredes` · `instalar` · `palco` · `planta-de-volta` · `planta-dxf` ·
`planta-guardada` · `plateia` · `posicao-bidirecional` · `sincronizacao`

Do outro lado, nos Calculadores v4.11, **16 verificações verdes** (uma nova,
`abrir-sem-trancar`), e a verificação de tradução sem nada de novo por
traduzir. As treze deste lado voltaram a correr a 21 de setembro, para o par
ser conferido junto e não uma app de cada vez.

## O que entrou desde a última vez que ele olhou

- **a planta da sala vai dentro do ficheiro guardado** (v3.71), e mudar as
  medidas da sala já não deixa peças lá fora em silêncio;
- **um `.vwx` não é um desenho** (v3.72) — recusa-se com recado, em vez de
  entrar vazio;
- **a planta exportada volta a entrar no sítio** (v3.73/v3.74), com o alçado
  separado para quem o quiser;
- **mexer aqui com o sync desligado passa a dizer-se** (v3.75);
- **a posição de um ecrã passa a ser um número só** (v3.76), escrito pelos
  dois lados;
- **o `.pvw` é desta app** (v3.77): ícone próprio, dois cliques, e a pergunta
  ao fechar;
- **uma fila pode fugir à regra do bloco** (v3.78) — e os corredores
  continuam a direito;
- **"⤓ Instalar"** (v3.79), um motor só, ligado ao link `#instalar` da página
  de entrada.

## Como se volta a este ponto

```
git checkout 63f3f73          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v3.79` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `63f3f73`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
