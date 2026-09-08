# Para continuar

Onde isto está, e o que falta. Escrito a 6 de setembro de 2026, com a app na
**v1.9**. **Nota de 7 de setembro (sessão Claude Code):** a app já vai na
v2.31 — houve trabalho substancial entre as duas datas (feito localmente,
fora desta sessão) que este documento não chegou a registar. O resto desta
lista pode estar parcialmente desatualizado; confirmar no código antes de
assumir que um item "por fazer" continua por fazer. (O item 5, TVs, foi
verificado a 7/9 do lado dos Calculadores: continua por fazer — nenhum botão
"Ver no Preview 3D" na aba TVs ainda.)

Quem pegar nisto — pessoa ou agente — deve ler primeiro o `README.md` (o que a
app faz) e o `.github/copilot-instructions.md` (como se trabalha aqui, e a lista
de coisas que já custaram tempo).

## O que está feito

**A cena.** Sala, palco, zonas de LED à escala, público sentado ou de pé (de pé
é a mesma figura do orador, repetida), corredores, inclinação de auditório,
quatro vistas, e a vista de quem está sentado num lugar a sério.

**As pontes com os Calculadores.** Vivem no mesmo domínio, por isso partilham o
`localStorage` e falam sem servidor:

- as zonas de LED chegam pelo `#p=` do endereço ou pela chave
  `mikeapps-projeto-v1`, e mudam ao vivo se as duas abas estiverem abertas;
- a **sala** vai daqui para lá (`mikeapps-sala-v1`), para o Assistente de
  Projeto;
- o **projetor** vem de lá (`mikeapps-projetor-v1` e `#proj=`), com rácio,
  distância e **os limites de shift da lente**;
- o tamanho do ecrã ajustado aqui volta para lá (`mikeapps-ecra-v1`);
- todas as pontes abrem na **mesma janela** (nome `mikeapps-preview`).

**Plantas.** DXF e DWG entram à escala (o DWG converte-se a DXF dentro da app,
por WebAssembly); PDF e imagem entram como imagem e calibram-se pela largura
real. As camadas do desenho ligam-se, desligam-se e **levantam-se** — é assim
que uma planta 2D vira uma sala.

**Projeção.** Rácio, distância, shift da lente (com aviso quando o shift pedido
passa o que a lente dá), e a **sombra desenhada** de quem está no feixe — o
orador e a plateia.

**Saídas.** PNG da vista, PNG com medidas, `.glb` (com cores e o nome de cada
peça, para o Cinema 4D) e `.obj`.

**IA.** O botão *Analisar com a IA* manda o texto do pedido ao mesmo Worker que
o assistente dos Calculadores usa, aplica as medidas que vierem, e escreve no
painel o que a IA percebeu e o que ela diz faltar.

## O que falta, por ordem de quanto vale

1. **Uma régua de duas pontas.** Numa planta em imagem ou PDF, a calibração é
   "diz-me a largura real que isto cobre" — e ninguém sabe essa largura de
   cabeça. O que toda a gente sabe é a medida de **uma parede**. Falta poder
   clicar em dois pontos do desenho, escrever quanto medem, e a escala sair daí.
   É a coisa que mais aproxima isto de ser usável com plantas de verdade.

2. **O shift das lentes que faltam.** Estão as 9 lentes Epson, que é quem o
   publica por lente. A Sony e a Barco bloqueiam a leitura automática das
   páginas — escrevem-se à mão a partir das fichas. A Panasonic, a Christie e a
   NEC publicam o shift **no corpo do projetor**: esse número pertence ao
   `data/projectors.json` dos Calculadores, não ao das lentes. Trabalho do lado
   de lá; aqui só chega o resultado.

3. **A IA aceitar um PDF ou uma fotografia.** O Worker já os recebe (o
   assistente dos Calculadores manda-os em base64, nos campos `pdfBase64` e
   `imageBase64`), e aqui só se manda `text`. Uma fotografia da sala vale mais
   do que três parágrafos a descrevê-la.

4. **Guardar a sala aqui.** As medidas escrevem-se de cada vez. A sala já é
   guardada **para os Calculadores**, mas não se recarrega sozinha neste lado.

5. **TVs a virem do catálogo**, como os projetores já vêm.

6. **DXF: SPLINE, ELLIPSE e HATCH.** Lêem-se linhas, polilinhas (com as curvas
   dos *bulges*), arcos, círculos, sólidos e blocos inseridos. Uma parede
   desenhada como spline chega cá em branco.

7. **DWG em 3D.** Lê-se a planta — o X e o Y. Um ficheiro com sólidos ou paredes
   já extrudidas chega achatado, e a alternativa é o "levantar" das camadas.

8. **Sombra do público sobre o próprio público.** Mede-se o que tapa a imagem
   projectada; não se mede quem tapa o ecrã a quem está atrás. A vista dos olhos
   responde a isso a olho, mas um número seria melhor.

## Palco central/circular + plateia em gomos (pedido a 7/9)

Pedido do mike: (1) poder ter um **palco circular e central**, com a plateia
a envolvê-lo, para eventos "em redondo"; (2) numa **sala muito larga** com o
palco normal à frente, poder dividir a plateia em gomos rodados para melhorar
a visualização sem ter de acrescentar ecrãs de cobertura.

**Feito (v2.41, refeito em v2.43 e v2.44): a plateia em gomos.** Secção
"Público", seletor **Reto / Circular** (`#formatoPlateia`, `data-forma` —
não usar `data-formato`, esse nome já é do seletor de rácio de imagem em
"Conteúdo nos ecrãs" e colidia com ele, os dois clicáveis mas só um a
responder; foi o primeiro tropeço disto). "Circular" reparte a plateia em
**N gomos** (`#gomos`, 1 a 12), cada gomo é um bloco igual ao de "Reto" (as
mesmas filas/corredores/inclinação), com a sua própria largura.
Implementado em `fazerPublicoGomos()` (`js/cena.js`), que chama
`fazerPublico()` uma vez por gomo sem lhe mexer nada (zero risco para
"Reto", que continua a ser exatamente a mesma função de sempre) e só depois
roda/desloca o resultado.

De caminho (v2.41), corrigido um bug à parte que isto tropeçou: o `return`
principal de `fazerPublico()` tinha um comentário com um `\n` escrito por
engano a meio da linha (texto literal, não uma quebra de linha a sério) que
comia a propriedade `blocoPorLugar` para dentro do comentário — a função
nunca devolvia isso, e ninguém tinha reparado porque nada lia essa
propriedade até `fazerPublicoGomos()` precisar dela.

**v2.41→v2.44 — três voltas até chegar ao sítio certo, todas por reports
de screenshot; as duas primeiras ideias já não estão no código:**

1. **v2.41→v2.42 (histórico): leque automático por ângulo.** Os gomos
   espalhavam-se sozinhos por um "ângulo total" (`#anguloGomos`), cada um
   do tamanho que coubesse nesse ângulo. Reportado (6 gomos, 50°): gomos
   empilhados/sem gente (a largura de cada fatia, espremida pelo ângulo,
   comia-se quase toda em margens de corredor) e a régie sem vão nenhum
   nos gomos rodados. Corrigido nessa altura, mas a ideia toda foi
   substituída a seguir — já não há `#anguloGomos` no código.
2. **v2.43 (histórico): automático fora, cada gomo = a sala inteira.**
   Reportado de novo (4 gomos/180°): mesmo corrigido, o leque automático
   "tirava espaço a mais" e não dava para ajustar gomo a gomo. Tirei o
   automático todo: cada gomo passou a ser a SALA INTEIRA (o bloco de
   "Reto" completo), só deslocado/rodado por `ajustesGomos[i] = { dx, dz,
   rot }`. Reportado outra vez (4 gomos, todos com a sala toda de
   largura): "não são separados" — ao empilhar em profundidade (`dz`,
   omissão de `i*2`), cada gomo com ~9 m de filas só tinha 2 m de folga
   para o seguinte, e ficavam a espetar-se uns nos outros; ao corrigir só
   a distância, os gomos seguintes saíam para fora da sala visível (uma
   sala não cresce sozinha para caber 4 cópias inteiras da plateia). Ideia
   de novo trocada — ver a seguir.
3. **v2.44 (atual): cada gomo com a sua própria largura, lado a lado por
   omissão.** Perguntei directamente ao mike qual dos dois desenhos fazia
   sentido — "lado a lado, mais estreitos" venceu, é o que está feito:
   - `fazerPublicoGomos(sala, palco, publico, regie, ajustesGomos)` volta
     a passar uma `salaGomo` (só a `largura` trocada) para `fazerPublico()`
     — mas agora a largura de cada gomo é **um valor à parte por gomo**
     (`ajustesGomos[i].largura`), não uma fatia calculada por um ângulo. A
     margem de corredor que `fazerPublico()` já desconta dos dois lados
     (`margemLateral`/`larguraCorredor`) passa a servir, de propósito, de
     corredor VERTICAL entre um gomo e o seguinte — a mesma conta de
     sempre, só que agora com um propósito novo, não um bug.
   - Omissão de um gomo novo: `{ largura: sala.largura/n, dx: <lado a lado,
     encostados>, dz: 0, rot: 0 }` — visualmente idêntico a "Reto" ao ligar
     "Circular" pela primeira vez (nada salta), e a pessoa parte daí para
     rodar as pontas para dentro ou arrumar como quiser.
   - Campo novo em `#listaGomos`/`desenharGomos()`: **largura** (m, min
     0.5), ao lado dos já existentes ↔ / profundidade / rodar.
   - `ajustesDeGomosGarantidos(publico)` (antes recebia só `n`, agora o
     `publico` inteiro) chama `lerSala()` para saber a largura total a
     dividir.

Ao longo das três voltas, o mecanismo de **arrastar** (bloco em
`js/app.js`, "arrastar gomos/delays/DSM/régie" — a mesma ideia do arrastar
do orador, raio + plano horizontal, generalizada a qualquer objeto nomeado
na cena: `"gomo-N"` só com "Circular" ligado, `"zona NOME"` só zonas delay
— uma LED não se arrasta, a posição dela vem do conjunto lá dos
Calculadores —, `"dsm N"` e `"regie"`, pedida a seguir, v2.45) e o
`ajustes.gomos` (`js/projeto.js`, ao lado de `delays`/`dsm`, mesma
persistência) não mudaram — só mudou o QUE fica guardado em cada entrada
(agora com `largura` também).

**v2.45: a régie também se arrasta, e um cadeado para não mexer nada por
engano.** Dois pedidos no mesmo fôlego:

- **Régie arrastável.** A régie não guarda posição num `ajuste` como os
  delays/DSM/gomos — é um campo de formulário direto (`regieX`/`regieZ`,
  lido em `lerRegie()`), como o palco. O bloco de arrastar generalizou-se
  com uma interface comum (`getXZ()`/`setXZ(x,z)`) atrás de dois adaptadores
  — `alvoDeAjuste()` (o que já havia, para gomos/delays/DSM) e
  `alvoDeCampos(idX, idZ)`, novo, que escreve direto nos `<input>` e dispara
  `"input"` (o mesmo evento que já faz o resto da app reagir a um campo
  escrito à mão — nenhum código novo precisou de saber que a régie é
  "diferente"). `objetosArrastaveis()` passou a incluir `"regie"`
  (`grupo.name` em `fazerRegie()`, `js/cena.js`) sempre que a régie estiver
  visível.
- **Cadeado de edição livre.** Pedido direto: rodar a vista às vezes passa
  o rato mesmo por cima de um gomo/delay/DSM/régie/orador, e um clique para
  rodar a câmara arrastava isso sem querer. Botão novo, sempre visível
  sobre a cena (`#btEdicaoLivre`, canto superior direito, ao contrário do
  `#btAbrir` que só aparece com o painel escondido) — 🔒 por omissão
  (arrastar na cena só mexe a câmara) / 🔓 quando ligado (arrastar move o
  que estiver por baixo do rato). Preferência por aparelho
  (`preview-edicao-livre` no localStorage, não partilhada com os
  Calculadores — é só sobre o que este aparelho deixa acontecer na tela).
  Os dois blocos de arrastar (orador, e gomos/delays/DSM/régie) ganharam a
  mesma guarda no `pointerdown`; os campos numéricos nunca dependeram disto
  — esses continuam sempre a funcionar, cadeado aberto ou fechado.

**Bug corrigido (v2.45): a sincronização automática não se entendia entre
as duas apps.** A preferência (`mikeapps-sincronizacao-v1`) é partilhada
por localStorage, mas cada app gravava-a num formato diferente: os
Calculadores sempre gravaram com `JSON.stringify` (o valor real em
localStorage ficava `"desligada"`, ASPAS INCLUÍDAS); o Preview gravava a
string em bruto (`desligada`, sem aspas). O Preview lia comparando direto
contra a string em bruto — nunca batia com o que os Calculadores tinham
escrito, por isso desligar a sincronização automática NOS CALCULADORES não
se refletia aqui: o Preview continuava a pensar que estava ligada e
continuava a aplicar o que chegasse sozinho. `sincronizacaoAutomaticaLigada()`
(`js/app.js`) passou a tentar `JSON.parse` primeiro (o formato dos
Calculadores) e só usar o valor em bruto se isso falhar (o que o Preview
grava) — a mesma robustez que o `syncAutoLigada()` dos Calculadores já
tinha (`js/utils.js`). O Preview também passou a GRAVAR no mesmo formato
(`JSON.stringify`) a partir de agora, para os dois lados ficarem
simétricos daqui para a frente.

De caminho, o botão `#btSincronizacao` no Preview passou a mudar de ÍCONE
a sério (🔗 ligada / ⛔ desligada, os mesmos que os Calculadores já usam no
deles) em vez de só mudar de cor — reportado como "difícil de entender
entre os dois quando está ligado e não", ao lado do "🔄 Sincronizar" (que é
uma ação, não um interruptor, e não muda nunca de ícone).

**v2.46: gomos sem corredor entre eles, e filas independentes por gomo.**
Pedido direto: "gomos sem corredores" e "alterar as filas deles
independente". Dois campos novos em `ajustesGomos[i]` (`js/cena.js`,
`js/app.js`):
- **corredor** (m) — substitui, só para este gomo, o "Largura dos
  corredores" global que `fazerPublico()` desconta dos dois lados (essa
  margem é o que serve de corredor vertical entre um gomo e o seguinte,
  desde a v2.44). A 0, este gomo fica encostado ao vizinho, sem vão nenhum
  entre os dois — mas só se o vizinho TAMBÉM tiver `corredor: 0` do seu
  lado, já que o vão real é a soma dos dois lados que se tocam.
- **filas** — substitui, só para este gomo, o "Filas" global. Uma ala pode
  ter menos filas do que o centro, por exemplo.

Os dois nascem iguais aos campos globais (`ajustesDeGomosGarantidos()`
semeia-os a partir de `publico.larguraCorredor`/`publico.filas` na
primeira vez que o gomo aparece) e ficam independentes a partir daí — tal
e qual `largura`/`dx`/`dz`/`rot` já faziam.

De caminho, corrigido um efeito secundário que isto ia introduzir: o aviso
"Só cabem X das Y filas" comparava sempre contra o campo GLOBAL de filas —
com "filas" agora independente por gomo, um gomo com menos filas DE
PROPÓSITO (a escolha da pessoa) ia disparar esse aviso por engano, como se
fosse a sala a faltar espaço. `fazerPublicoGomos()` devolve agora
`gomosApertados` (só os gomos que pediram mais filas do que a SUA PRÓPRIA
sala lhes deixou encaixar) e `montar()` usa isso em vez do campo global
quando `formato === "circular"`.

**Simplificações conhecidas do modo gomos, ainda por afinar se vier a ser
preciso:**
- `filas`/`porFila`/`blocos`/`zPrimeira`/`zUltima`/`larguraSentada` que a
  função devolve são os de UM gomo, não uma conta agregada dos N — para os
  "lugares" totais (o número que mais se vê) soma-se certo.
- "Olhos da plateia" usa o gomo com `rot` mais perto de 0° — não foi
  testado com N par (não há gomo exatamente ao centro nesse caso, fica o
  mais próximo).
- Arrastar só muda dx/dz (posição); largura e rodar continuam só pelos
  campos numéricos — arrastar para rodar/redimensionar pediria um
  manípulo à parte, não feito.
- Um gomo com `largura` a menos do que cabe um lugar (duas margens de
  corredor mais um lugar) fica sempre vazio, sem aviso — ao contrário do
  antigo leque automático, que avisava quando isso acontecia sozinho, isto
  agora é uma escolha manual da pessoa (pôr uma largura fora do que faz
  sentido), por isso trata-se como qualquer outro campo — vê-se vazio, sem
  mensagem a explicar porquê.

**Por fazer: o palco central/circular a sério.** Isto ainda roda a plateia à
volta do PONTO onde o palco reto de hoje já fica — não existe um palco que
mude de forma (Retangular/Circular) nem de posição. Continua por fazer
porque `palco.profundidade` e a posição dele contra a parede da frente são a
referência de onde os ecrãs nascem por omissão, dos cálculos de pé-direito/
teto, do export DXF e da planta 2D (grep por `palco.` em `js/app.js` para
ver a extensão) — tornar o palco circular e móvel implica rever todos esses
pontos, não só acrescentar um seletor. Decisões já tomadas com o mike, para
quando isto avançar: seletor Retangular/Circular no Palco, com controlos de
posição (deslocar X/Z, como a Régie já tem) quando circular; e a plateia à
volta de um palco circular com um ângulo ajustável (não sempre 360°) — os
mesmos controlos de gomos que já existem servem para isso, uma vez o palco
em si resolvido.

**Por onde começar:** a parte "contida" (só mexe no gerador de lugares, não
no palco nem nos ecrãs) já está feita — é o arrastar/campos por gomo da
v2.43, acima. O que falta a sério é o palco em si mudar de forma/posição,
que obriga a rever a posição por omissão dos ecrãs e os cálculos que
dependem dela.

## Coisas que se decidiram e não se voltam a discutir

- **O Preview não ganha catálogos.** Nem de LED, nem de projetores, nem de
  lentes. Ver a regra no `.github/copilot-instructions.md`.
- **O motor 3D vive no `vendor/`**, não num CDN: isto usa-se onde não há rede.
- **Os motores pesados (DWG, PDF) não entram no arranque** — só se descarregam
  quando alguém abre um ficheiro desses.
- **A latência do direto e o genlock não são deste projeto.** Isto é um preview
  de montagem: responde a *cabe?*, *vê-se?*, *quem tapa o quê?*.
