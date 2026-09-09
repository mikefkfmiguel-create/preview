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
- o tamanho do ecrã (e as zonas/sala/palco) ajustados aqui voltam para lá
  (`mikeapps-ecra-v1`) — **automaticamente desde a v2.48** quando a
  sincronização automática está ligada (antes só ia com o clique manual em
  "📤 Devolver", que era fácil esquecer depois de mais um ajuste — ver
  "Bug corrigido (v2.48)" mais abaixo);
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

**Bug corrigido (v2.47): gomos antigos mostravam "0" no campo corredor mas
desenhavam com um corredor a sério.** Um gomo criado ANTES da v2.46 (já
guardado em `ajustes.gomos` no localStorage) não tinha as propriedades
`corredor`/`filas` — só passaram a existir nessa versão. O campo mostrava
"0" (a omissão do próprio `campoAjuste()` quando o valor está em falta),
mas `fazerPublicoGomos()` caía na omissão DELA quando `aj.corredor` não é
um número válido, que é o campo GLOBAL (ex: 1.2), não 0 — campo e desenho
diziam coisas diferentes até a pessoa escrever no campo, altura em que os
dois passavam a concordar. `ajustesDeGomosGarantidos()` (`js/app.js`)
passou a percorrer TODOS os gomos até N (não só a acrescentar novos a
seguir aos já existentes) e a preencher `corredor`/`filas` em falta com os
valores globais, uma vez, para os dois nunca mais discordarem.

**v2.47: identificar gomos na cena.** Pedido direto — com vários gomos
deslocados/rodados por cima uns dos outros, difícil de perceber qual é
qual sem contar. Checkbox novo "Identificar gomos na cena" (`#verGomosId`,
só visível em "Circular", ao lado dos campos de gomos) que desenha uma
etiqueta "Gomo N" flutuante ao meio das filas de cada um (reaproveita o
mesmo mecanismo das etiquetas de zona/DSM — `#etiquetas`,
`desenharEtiquetas()`). `fazerPublicoGomos()` devolve `gomosInfo` (um
ponto por gomo, com a mesma transformação dx/dz/rot que já se aplica a
"corpos"), e `montar()` acrescenta-os a `etiquetas` DEPOIS dos blocos de
zonas/DSM — que ainda REESCREVEM `etiquetas` do zero (não só acrescentam),
por isso entrar antes fazia as etiquetas dos gomos desaparecerem sempre
que houvesse um projeto com ecrãs.

**Bug corrigido (v2.48): "Devolver aos Calculadores" só ia com um clique
manual, nunca sozinho.** Reportado: "se estão em sync, a calculadora devia
ter o tamanho do ecrã e os delays do preview, e vice-versa" — na prática,
a ponte Calculadores→Preview (zonas, projetor) já era automática com a
sincronização ligada (evento `storage` + `syncAutoLigada()`), mas a ponte
contrária, Preview→Calculadores (tamanho do ecrã ajustado aqui, zonas,
sala/palco — `mikeapps-ecra-v1`), só escrevia com um clique manual no "📤
Devolver", em `js/app.js`. Fácil de esquecer esse clique depois de mais um
ajuste, ficando os Calculadores a mostrar um tamanho antigo mesmo com
"Auto" ligado dos dois lados — os Calculadores já tinham o lado de
LER isto ao vivo (`window.addEventListener("storage", ...)` em
`index.html`, gated por `syncAutoLigada()`), só faltava alguém escrever
sozinho.

A lógica do clique (agora `devolverAosCalculadores(comAviso)`, reaproveitada
pelo botão) passou a correr também sozinha, no fim de `montar()`, sempre
que há projeto carregado e a sincronização automática está ligada —
`devolverDaqui()`, com uma pausa de 700ms depois da última alteração (não
a cada tecla), em silêncio (sem escrever em `#notaEcra`, ao contrário do
clique manual, que continua a confirmar por ali). O botão continua a
existir para um envio imediato e explícito.

**Susto corrigido no mesmo dia (v2.49): a v2.48 entrou num loop contínuo.**
Reportado logo a seguir a publicar a v2.48: "abriram com o sync em loop
contínuo" / "fica a dizer sempre que teve alterações e não para". Causa: os
Calculadores já reescreviam `mikeapps-projeto-v1` a CADA recálculo
(`calcLedZones()` → `lzGuardarParaPreview()`, sem guarda nenhuma sobre
"isto é uma alteração local ou só a aplicar o que chegou de fora?"), o que
nunca tinha sido um problema porque o Preview nunca escrevia de volta
sozinho — mas a v2.48, ao pôr `devolverDaqui()` a correr no fim de TODO
`montar()` (incluindo os que só aplicam um projeto recebido dos
Calculadores), deu ao par um caminho fechado: Preview recebe → aplica →
`montar()` → devolve → Calculadores recebe → aplica → `calcLedZones()` →
reenvia → Preview recebe outra vez → ... para sempre, um ciclo a cada
~700ms enquanto as duas abas ficassem abertas com "Auto" ligado.

Corrigido dos dois lados (o mesmo princípio: nunca ecoar de volta uma
alteração que acabou de chegar de fora):
- **Preview** (`js/app.js`): `marcarRecebidoDeFora()`, chamada em todos os
  sítios que aplicam algo vindo dos Calculadores (evento `storage` em
  `mikeapps-projeto-v1`, "🔄 Sincronizar", "Trazer projeto dos
  Calculadores", `#p=` no endereço/`hashchange`, arranque) — marca uma
  bandeira (`ignorarProximoDevolver`) que `devolverDaqui()` consome (e
  reinicia) no `montar()` seguinte, saltando esse envio.
- **Calculadores** (`js/zonas.js`): `lzAImportarDoPreview`, ligada durante
  toda a `lzImportarProjetoDoPreview()` (não só o primeiro recálculo —
  `lzAddZone()` chama `calcLedZones()` por zona) — `lzGuardarParaPreview()`
  sai logo se estiver ligada.

Corrigir só um dos lados já quebraria o ciclo (basta UM elo deixar de
ecoar), mas os dois ficaram corrigidos — o problema de fundo
("recalcular" e "aplicar o que chegou de fora" a acionar sempre o mesmo
caminho de escrita automática) já existia antes da v2.48 de um dos lados,
só nunca se tinha manifestado por o outro lado ser sempre manual.

**Cadeado da edição livre a preencher a cheio quando aberto (v2.50).**
Reportado: o contorno fino a mudar de cor não se notava a este tamanho
(38×38px) — a diferença entre 🔒 e 🔓 quase não se vê. `#btEdicaoLivre.ligada`
passou a preencher-se a cheio com a cor de destaque (`css/estilo.css`),
mesmo tratamento visual que `button.primario` já usava noutros botões
"ligados" da app.

**Bug corrigido (v2.51): mudar para "Circular" perdia mais de metade da
plateia.** Reportado: "perdi tudo quando marco público em circular".
Reproduzido com o projeto de exemplo — 317 → 155 lugares, só por trocar
"Reto" por "Circular (gomos)", sem mexer em mais nada. Causa, uma
combinação de dois efeitos que a v2.44 (ver acima) não previu ao passar a
tratar cada gomo como um "Reto" à parte:
- `ajustesDeGomosGarantidos()` (`js/app.js`) semeava `corredor` de um gomo
  novo com o valor GLOBAL de "Largura dos corredores" tal e qual — mas
  esse valor conta para os DOIS lados de CADA gomo (é o que serve de vão
  entre vizinhos, desde a v2.44). Com N gomos lado a lado, o total gasto
  em margens cresce como 2×N×corredor — a mesma margem pensada para UMA
  sala inteira (2 lados) estava a ser gasta 2×N vezes.
- `fazerPublicoGomos()` (`js/cena.js`) também deixava cada gomo herdar o
  campo global `publico.corredores` (nº de corredores INTERNOS) sem
  qualquer desconto — um gomo já É um pedaço separado dos vizinhos por
  "corredor"; manter esse valor global fazia cada gomo abrir mais um
  corredor lá dentro, a multiplicar a perda por N outra vez.

Corrigido nos dois sítios:
- `fazerPublicoGomos()` força `corredores: 0` no `publicoGomo` que passa a
  `fazerPublico()` — um gomo nasce sem corredor interno (não há campo para
  configurar isto por gomo ainda; quem quiser dividir um gomo em dois faz
  dois gomos).
- `ajustesDeGomosGarantidos()` passou a semear `corredor` de um gomo NOVO
  com `larguraCorredor × (2 + corredores) / (2 × N)` — a mesma largura
  total que "Reto" perderia (2 margens + os corredores internos de sempre)
  a dividir pelos 2×N lados dos N gomos, para a lotação ficar parecida ao
  trocar de modo. Testado com o exemplo em N = 1/2/3/4/6: ficou sempre
  entre 317 e 354 lugares (antes: 120 a 218, a colapsar com N mais alto).
  Continua tudo ajustável à mão a partir daí, como já era.

**Botão "repor vista" sempre visível (v2.52).** Reportado a seguir à
correção da lotação em "Circular", com um screenshot da cena toda preta:
"e onde está tudo". Reproduzido — não é um bug de desenho nenhum: a
câmara (`OrbitControls`) só volta à posição inicial quando `montar()` é
chamado com `recentrarCamara=true`, o que só acontece a abrir/carregar um
projeto; qualquer alteração depois disso (trocar "Reto"/"Circular",
mudar a sala, etc.) chama `montar(false)` — nunca mexe na câmara. Rodar
ou afastar de mais na cena (roda do rato, arrastar) e nunca mais se via
nada, sem forma óbvia de voltar atrás a não ser abrir o painel e ir
procurar "Vista → Frente" (secção que pode nem estar desdobrada). Já
existia essa função (`vista("frente")`, repõe posição e alvo da câmara
por inteiro, não é relativo a nada) — só faltava um atalho imediato.
`#btRecentrarVista` (🔄), sempre visível junto ao cadeado da edição
livre, chama exactamente essa função. Confirmado por Playwright: forçar a
câmara para longe (posição (500,500,500)) reproduz um ecrã totalmente
preto idêntico ao do screenshot, e o botão novo recupera a vista.

**Susto corrigido no mesmo dia (v2.53): a v2.52 partia o script todo para
quem apanhasse o momento errado da cache.** Reportado a seguir a
publicar a v2.52: nem a lista de gomos aparecia, nem "Exemplo" carregava
— "foi depois dos ajustes que antes estava bem". Causa: `index.html`
fica em cache (só atualiza em segundo plano, para a navegação seguinte)
mas `js/app.js` é sempre buscado à rede primeiro (ver `sw.js`). Quem
abrisse a app nesse intervalo apanhava o HTML ANTIGO (sem o
`#btRecentrarVista` que a v2.52 acabou de acrescentar) já com o JS NOVO —
e a v2.52 ligava `onclick` a esse botão sem verificar que ele existia:
`$("btRecentrarVista")` dava `null`, `.onclick =` num `null` rebenta, e
por ser código de topo (fora de qualquer função), tudo o que vinha a
seguir no ficheiro — incluindo o handler do "Exemplo" e dezenas de outras
ligações — nunca chegava a correr. `#btEdicaoLivre` (v2.45) tinha
exactamente o mesmo risco, nunca manifestado por sorte de tempo; corrigido
também. Reproduzido a valer desta vez: servi uma cópia do site com o
botão a menos no HTML (simulando a cache antiga) mas com o `app.js` novo
— confirmei o erro, apliquei a guarda (`if ($(id)) ...`), confirmei que
desaparece. **Lição para a próxima vez que se acrescentar um elemento
novo ao HTML e se ligar um evento a ele no mesmo commit:** ligar sempre
com guarda (`if ($(id)) $(id).onclick = ...`), nunca `$(id).onclick =
...` direto — o desfasamento entre HTML em cache e JS sempre fresco é
estrutural desta app, não um acaso de uma vez.

**Bug corrigido (v2.54): "Abrir projeto" esquecia a plateia toda.**
Reportado: "ao gravar o projeto no Preview a plateia não fica, o tamanho
da sala não fica — apenas traz a disposição dos ecrãs". Isolei por
partes com Playwright (guardar, abrir numa aba nova, comparar campo a
campo): sala/palco/regie afinal voltavam bem — o problema real era só o
"Público":
- `abrirProjetoTodo()` nunca repunha `formato` (Reto/Circular) nem
  `gomos` (nº de gomos) — um projeto guardado em Circular abria sempre em
  Reto, sem aviso nenhum. Corrigido: repõe `$("formatoPlateia").dataset.valor`
  (chamando `marcarFormatoPlateia()` a seguir) e o campo `#gomos`.
- Pior: a reconstrução de `ajustes` ao abrir só copiava `delays` e `dsm`
  — a chave `gomos` (largura/corredor/filas/posição de cada gomo) ficava
  `undefined`, nem sequer um array vazio. Ao trocar para "Circular" depois
  de abrir um projeto guardado, `ajustesDeGomosGarantidos()` fazia
  `ajustes.gomos[i] = ...` sobre `undefined` e rebentava — reproduzido a
  valer: "Cannot read properties of undefined (reading '0')", cena
  totalmente preta (o mesmo sintoma do susto da v2.53, causa completamente
  diferente). Isto batia certo com o que foi reportado a seguir: "quando
  tento refazer desaparece tudo na visão de curvado, mas se voltar ao
  reto está lá" — SIM, o Reto tem lugares nascidos aqui, mas os campos que
  os controlam não voltam a bater certo até se escrever à mão. Corrigido
  para a mesma forma que `ajustesGuardados()` já usa (`js/projeto.js`):
  `gomos` também com garantia de array.
  Testado de ponta a ponta: guardar em Circular com um gomo redimensionado
  à mão, abrir numa aba nova — já abre em Circular, com o gomo do tamanho
  certo, sem erros, mesmo a trocar Reto→Circular outra vez a seguir.

**v2.55: nome do projeto sempre visível na cena, e uma imagem à parte por
ecrã.** Dois pedidos diretos no mesmo fôlego:

- **Nome do projeto no viewport.** `#nomeProjetoViewport`, centrado no
  topo da cena (entre o cadeado/repor vista à direita e o "mostrar
  painel" à esquerda, sem disputar canto com nenhum), atualizado em
  `montar()` a partir de `projeto.nome`. `[hidden]` (não só texto vazio)
  quando não há projeto — sem caixa às riscas por cima da cena à toa.
- **Imagem própria por ecrã.** Até aqui só havia UMA imagem para a app
  toda (`textura`), em dois modos — "Espalhada" (recortada pela posição
  no conjunto) ou "Uma em cada" (a mesma imagem inteira, repetida em
  todas). Nenhum dos dois deixava um ecrã DIFERENTE dos outros, que foi o
  pedido: "poder por uma imagem em cada ecrã". Nova secção "Imagem à
  parte por ecrã" em Conteúdo nos ecrãs — uma linha por zona do projeto
  (`desenharListaConteudoZonas()`, `js/app.js`, chamada de dentro de
  `montar()` como `desenharGomos()`/etiquetas já faziam), com "Escolher
  imagem…"/"Trocar…" e, só quando já tem uma, "Remover". Guardadas em
  `texturasPorZona` (nome da zona → `THREE.Texture`, `js/app.js`) — NÃO
  viaja no "Guardar projeto" (nem `textura`, a geral, viaja hoje; ver
  também a limitação de `planta`/`plantaCad`, mesma família).
  `fazerZonas()`/`fazerZona()` (`js/cena.js`) ganharam um parâmetro a
  mais (`texturasPorZona`/`texturaZona`) — quando a zona tem imagem
  própria, essa imagem entra ANTES de tudo o resto (a geral, "espalhada"
  ou "cada"; ou o comportamento por-delay que já havia), fatiada só pelos
  gomos DESSE ecrã, do mesmo jeito que já se fazia para uma TV/projeção
  de delay. Testado com Playwright: imagem própria só na "Ala esquerda"
  do exemplo — só essa zona muda de cor na cena, as outras duas continuam
  na cor normal; "Remover" devolve-a ao normal.

**v2.56: sala na tira do "PNG com medidas", e "Exportar" junto a
"Projeto".** Dois pedidos diretos:
- A tira de contas por baixo do "PNG com medidas" (`guardarImagem()`,
  `js/app.js`) tinha o tamanho dos ecrãs, dos lugares, do peso/amperagem
  — mas não a própria SALA, o contexto que dá sentido a tudo o resto.
  Passa a vir primeiro na tira, via `lerSala()`: `Sala 27.00 × 19.00 ×
  8.00 m`.
- A secção "Exportar" (`#sExportar`, `index.html`) vivia lá para o fim
  do painel (depois de Conteúdo/Vista); passou para logo a seguir a
  "Projeto" — quem guarda o projeto e quem tira o PNG/exporta o .glb são
  o mesmo gesto de fechar o trabalho, faz sentido ficarem lado a lado.
  O estado aberta/fechada de cada secção guarda-se por `id`
  (`document.querySelectorAll("#painel section.fechada")].map(x=>x.id)`),
  não por posição — mudar a ordem no HTML não mexeu em preferências já
  guardadas de ninguém.

**Bug corrigido (v2.57): a imagem nos DSM saía rodada 180°, e nenhuma
rotação a punha direita.** Reportado: "a imagem nos DSM está ao contrário
e não consigo rodar o DSM 360 para ficar direita". Não era falta de
alcance no campo "rodar" (`-180` a `180` já é o círculo todo) — era a
imagem em si, virada de pernas para o ar E ao contrário ao mesmo tempo
(confirmado com uma imagem em quadrantes de cor: saía TL↔BR e TR↔BL
trocados, uma rotação de 180° a sério, não só um espelho de um dos
eixos). Causa: o TOMBO fixo (`Math.PI + Math.PI/6`, ~210°) que já vira o
DSM para o orador é uma rotação à volta de X (um eixo DEITADO) — isso
inverte o que ficava virado para cima, e nenhuma rotação em Y ("rodar",
o único campo que a pessoa mexe) desfaz uma inversão de X, são eixos
diferentes; por mais que se rodasse, a imagem nunca ficava direita.
Corrigido em `fazerDSM()` (`js/cena.js`): a textura do DSM pré-roda-se
180° (`repeat.set(-1,-1); offset.set(1,1)`, um ponto-reflexo — o mesmo
que uma rotação de 180° em UV) antes de entrar no material, só para o
DSM — as zonas LED/delay não têm este tombo, não precisam disto e não
foram tocadas. Testado com Playwright: câmara posicionada a apontar
exatamente para a normal mundial da face do DSM (não uma vista
aproximada) — antes saía com os quadrantes trocados na diagonal e a
seta ao contrário; depois, tudo direito.

**v2.58: a marca em toda a exportação de imagem.** Início do branding
pedido a sério — "em todos os export de imagens, texto, marca com o logo
discreto no canto inferior direito sem tapar informações" (mais passos a
vir, ainda por dizer). `logoExportacao()` (`js/app.js`) carrega
`icons/mike-logo.png` uma vez só (promessa em cache, reaproveitada em
todas as exportações seguintes) e nunca parte a exportação se a imagem
falhar (`onerror` resolve `null`, a imagem sai na mesma, só sem marca).
Sítio diferente consoante o que já existe em cada exportação:
- **"PNG com medidas"** (`guardarImagem()`) já tem uma tira sólida por
  baixo do desenho (as contas) — a marca entra aí, à direita, sem fundo
  próprio (a tira já é sólida) e sem risco nenhum de tapar o texto (que
  começa à esquerda).
- **"PNG da vista"** (`guardarVista()`) não tinha tira nenhuma — era o
  canvas em bruto, direto para `toBlob()`. Passou a copiar-se primeiro
  para uma tela à parte (só assim dá para desenhar a marca por cima),
  com um fundo escuro semitransparente atrás do logo — o canto onde ela
  cai varia entre escuro (fundo da sala) e claro (gente/ecrã), sem fundo
  próprio ficava ilegível consoante o enquadramento.
Ambas as funções passaram a `async` (esperam a promessa da marca antes
do `toBlob`) — chamadas sem `await` no `onclick`, como já era. Testado
com Playwright: as duas exportações saem com o logo pequeno, legível, no
canto inferior direito, sem tapar etiquetas nem a tira de contas.

**v2.59: o padrão de teste com a marca completa ao meio e só o símbolo
nas pontas.** Pedido: "esse exemplo para teste deve ter o logotipo
completo no centro e apenas o logo de símbolos nas laterais para não
distorcer". A `padraoDeTeste()` (`js/cena.js`) já desenhava a marca —
mas usava `icons/mike-logo.png`, que apesar do nome e do comentário no
código ("a marca") é só o símbolo, sem o "MIKE APPS" escrito por baixo;
esticado ou repetido pelos três ecrãs, nunca ia ter onde aparecer a
marca completa. Trazidos dois ficheiros novos da pasta `marca/` do
Calculadores (fonte oficial da marca): `icons/mike-marca-branco.png`
(logotipo completo, texto branco, fundo transparente — para o fundo
azul do padrão) e `icons/mike-simbolo.png` (só o símbolo, quadrado). A
função passou a devolver uma promessa (antes devolvia a textura direta)
e divide a imagem em três terços: o do meio recebe a marca completa
centrada, os dois das pontas recebem só o símbolo, cada um centrado no
seu terço — assim cada ecrã do conjunto mostra algo pensado para a sua
largura, sem esticar nem distorcer nada. `icons/mike-logo.png` manteve-se
como estava (é usado noutros sítios, como o cabeçalho da app, onde só o
símbolo é mesmo o correto — o "MIKE APPS" aí já é texto HTML à parte).
Os dois ficheiros novos entraram também no `TUDO` do `sw.js`, para não
ficarem de fora do arranque offline. Testado com Playwright: a textura
composta isolada sai simétrica e legível; aplicada ao projeto de exemplo
de 3 ecrãs em modo "Espalhada", o ecrã "Principal" (o do meio) mostra a
marca completa e "Ala esquerda"/"Ala direita" mostram só o símbolo, sem
distorção nenhuma — exatamente o pedido.

**v2.60: um link temporário só para ver, sem editar.** Pedido: "enviar
um link temporário a um cliente ou colega para ver e navegar no
viewport 3D, só a visualizar". Botão novo em Projeto, "🔗 Link para ver
(só visualização)": grava o projeto todo (o mesmo `estadoCompleto()`
que "Guardar projeto" já exporta) num endpoint novo do Worker
(`POST /partilha`, ver o repositório `calculadores`) e devolve um link
com um id curto (`#ver=<id>`), válido 7 dias — o KV apaga-o sozinho.
Quem abre o link não fala com este aparelho nem com os Calculadores, só
com o Worker (`GET /partilha/<id>`).

No arranque, um `#ver=<id>` no endereço entra num `modoVisualizacao`
próprio, separado do caminho normal (`projetoDoEndereco`/sincronização
automática) — de propósito, para um link partilhado nunca tocar no
localStorage nem devolver nada aos Calculadores. Duas coisas escondem-se
nesse modo: o painel inteiro (`body.modo-ver #painel`) e o cadeado da
edição livre (`#btEdicaoLivre`) — mas esconder o botão não bastava por
si só. `edicaoLivreLigada()` lê o cadeado do `localStorage`, que é por
*aparelho*, não por projeto: se alguém tivesse deixado o cadeado aberto
numa sessão de edição normal NESSE MESMO browser, o link partilhado
herdava esse "aberto" e dava para arrastar gomos/delays/DSM na mesma,
apesar do botão escondido. Por isso `edicaoLivreLigada()` passou a
devolver `false` sempre que `modoVisualizacao` está ligado, antes de
sequer olhar para o `localStorage` — o painel escondido é só a parte
visível da garantia, quem impede o arrasto de verdade é esta linha.
`#nomeProjetoViewport` (já existia, v2.58) ganha " · só visualização" a
seguir ao nome, para quem abre perceber o que está a ver.

O Worker precisa de um KV novo (`PARTILHAS`) — passo manual de deploy
documentado no `wrangler.toml` de lá, ainda por fazer nalgum momento
antes disto funcionar em produção; até lá o botão fica a dar erro
("Worker sem armazenamento configurado"), sem afetar nada mais.
Testado com Playwright (Worker simulado com `fetch` substituído):
criar o link, abrir noutra "sessão" com só o id no endereço — painel
escondido, `#btEdicaoLivre` escondido, `#nomeProjetoViewport` a mostrar
"Nome · só visualização", e a arrastar o orador na cena sem ele se
mexer (posição comparada antes/depois, byte a byte) mesmo com o
cadeado "ligado" no `localStorage` desse browser.

**v2.60 (continuação): as imagens dos ecrãs/DSM também viajam no
"Guardar projeto".** Reportado: "no save do projeto não vão as imagens
quando abro em outro device — as imagens que pus nos ecrãs e dsms não
foram". Tinha razão: `texturasPorZona` (imagem própria por ecrã) e
`textura` (a imagem geral, que os DSM também usam — não têm imagem
própria) só existiam como `THREE.Texture` em memória, e isso não
sobrevive a um `JSON.stringify` — nem `estadoCompleto()` («Guardar
projeto») nem o link de partilha acima as levavam. Cada uma passou a
guardar-se a par do seu data URL (`texturaDataURL`/
`texturasPorZonaDataURL`, preenchidos no mesmo `onchange` que já lia o
ficheiro escolhido — `dataURLDeFicheiro()`, novo em `js/cena.js`, lê o
MESMO ficheiro em paralelo com `texturaDeFicheiro()`, sem duplicar a
escolha) e é esse texto que vai dentro de `conteudo: { textura, porZona
}` no JSON. `abrirProjetoTodo()` passou a `async` para poder recarregar
essas imagens (`texturaDeDataURL()`, novo, nunca rejeita — uma imagem
corrompida no ficheiro fica sem conteúdo nessa zona em vez de travar a
abertura do resto do projeto) antes do `montar()` final; os dois
sítios que a chamam foram ajustados a manter o `catch` a funcionar (um
`throw` numa função `async` vira promessa rejeitada, não uma exceção
síncrona — o `try/catch` à volta do "Abrir projeto" só continuava a
apanhar erros por ter passado a `await`ar). O padrão de teste fica de
fora de propósito: não é um ficheiro do mike, regenera-se sozinho.
Consequência directa: o Worker (`calculadores`) subiu o limite de
partilha de 300KB para 8MB, porque com imagens um projeto já não cabe
no limite pensado só para números.
Testado com Playwright: escolher uma imagem geral e uma imagem numa
zona, "Guardar projeto", abrir esse ficheiro numa página nova (sem
nada em comum — `localStorage` limpo, sessão à parte, como um
computador diferente), confirmar que a zona continua marcada "imagem
própria", voltar a guardar e comparar os dois JSON a byte — os data
URL saem idênticos aos originais depois do ciclo completo
guardar→abrir→guardar. E que "Remover" tira a imagem também do
ficheiro seguinte que se guardar.

**v2.61: a marca do "PNG com medidas" saiu da tira de contas para a
própria imagem 3D.** Reportado com uma captura do telemóvel do mike:
"o logo a tapar info" — a tira de contas, por baixo do render, tinha
uma linha de texto E o logo os dois a disputar o mesmo canto direito.
`guardarImagem()` (`js/app.js`) assumia (comentário de v2.58: "o texto
das contas começa à esquerda") que a linha nunca lá chegava — verdade
num export largo, falso com a "Sala WxDxH m" que o v2.58 juntou ao
início da linha, e pior ainda num export estreito (telemóvel: menos
pixels de largura para o mesmo texto). Uma primeira tentativa cortou o
texto com "…" antes de tocar no logo — resolvia o problema, mas não
era o que foi pedido a seguir: "põe na imagem mesmo, não na barra de
informação". A marca passou para o canto inferior direito da PRÓPRIA
imagem 3D (por cima do `tela`, antes de se desenhar a tira por baixo),
com o mesmo fundo semitransparente que `guardarVista()` já usava —
agora as duas exportações de imagem marcam a cena da mesma maneira, e a
tira de contas ficou livre para mostrar a linha inteira, sem cortar
nada. Testado com Playwright num viewport estreito (412×915, como o
telemóvel da captura): a linha "Sala 24.00 × 18.00 × 8.00 m · 15.00 ×
4.50 m · 3 zonas" sai completa, e a marca fica visível no canto da
imagem, sem sobrepor texto nenhum.

**v2.62: o padrão de teste volta a ser neutro — a marca passou para o
projeto de exemplo.** Corrigido logo a seguir ao v2.59/v2.60 terem
posto a marca dentro do PRÓPRIO `padraoDeTeste()`: "não era bem assim,
o padrão teste é apenas o logo sem o Mike Apps... no arranque do
projeto de exemplo é que deve abrir com, no ecrã do centro logo
completo e nos das laterais apenas o logotipo sozinho, as formas
geométricas". Duas coisas distintas, que se tinham misturado numa só:
- **`padraoDeTeste()`** (`js/cena.js`) voltou a ser o que o nome diz —
  um padrão neutro, sem marca nenhuma: grelha, barras de cor e uma
  cruz de canto a canto (o desenho que um comentário antigo já descrevia,
  mas cujo código nunca chegou a existir neste repositório — foi escrito
  de novo). A cruz é o mais útil: se uma zona estiver trocada ou
  espelhada, a diagonal deixa de bater certo ali, visível a olho. Voltou
  a ser síncrono (devolve a textura direta, não uma promessa) — já não
  depende de carregar imagem nenhuma.
- **A marca no projeto de exemplo**: `texturaDaMarca(completa)`, nova em
  `js/cena.js` (o desenho que estava dentro do `padraoDeTeste()` de
  v2.59, agora à parte) — logotipo completo ou só o símbolo, centrado
  sobre o mesmo fundo azul. `aplicarConteudoDeExemplo()`, nova em
  `js/app.js`, chama-a duas vezes (`Principal` → completa, `Ala
  esquerda`/`Ala direita` → só o símbolo, os nomes vêm do próprio
  `EXEMPLO`) e põe o resultado em `texturasPorZona` — o mesmo mecanismo
  da "Imagem à parte por ecrã" (v2.58). Chama-se sozinha a seguir a
  `carregar(EXEMPLO)`, ao clicar em "Exemplo": já não é preciso ir a
  lado nenhum escolher nada, a marca aparece com o resto do projeto.
  Fica de fora do "Guardar projeto" de propósito, como o padrão de teste
  já ficava — sem `texturasPorZonaDataURL` a par, regenera-se sozinha ao
  clicar "Exemplo" outra vez.
Um efeito secundário a saber, não um defeito: como cada zona do exemplo
já fica com imagem própria, clicar depois em "Padrão de teste" muda a
`textura` geral mas não se vê — a imagem própria de cada zona continua
a sobrepor-se-lhe (mecanismo antigo, "Imagem à parte por ecrã" já dizia
"sobrepõe-se ao que estiver acima"). Para ver o padrão de teste sozinho
num projeto que já tenha imagens próprias por zona, é preciso "Remover"
essas imagens primeiro. Testado com Playwright: "Exemplo" sozinho já
mostra a marca certa (Playwright confirma "MIKE APPS" ao centro, símbolo
nas pontas, sem tocar em mais nada); com as imagens próprias das 3 zonas
removidas, "Padrão de teste" mostra grelha/barras/cruz, sem logo nenhum.

**v2.63: a sala do exemplo passa a caber as 10 filas por omissão.**
Reportado com uma captura da vista de cima: "isto é do exemplo e o
exemplo devia ser o que cobre tudo sem perdas... ajusta para que o
exemplo esteja totalmente correto e sirva de ponto de partida" — o
aviso "Só cabem 9 das 10 filas: a sala acaba antes" aparecia logo ao
abrir "Exemplo", o pior cartão de visita possível para quem está a
conhecer a app. `EXEMPLO.sala.profundidade` (`js/projeto.js`) já tinha
sido "corrigido" uma vez (de "12 filas em 14 m" para 18 m), mas ficou
por baixo do que os valores por omissão do HTML pedem HOJE — 10 filas,
não 12. Contas feitas com o que fazerPublico() usa de verdade
(`js/cena.js`): `zPrimeira = -profundidade/2 + palco.profundidade +
primeiraFila`, e a última fila pedida cabe se `zPrimeira +
(filas-1)×entreFilas ≤ profundidade/2 - margemLateral`. Com os valores
por omissão (palco 6 m, primeira fila a 3 m, entre filas 0,9 m,
corredores 1,2 m) isso dá uma profundidade mínima de 18,3 m — os 18 m
de antes ficavam mesmo por baixo, faltava menos de um metro. Subida
para 20 m (folga a sério, não só o mínimo). Nada mais no exemplo
dependia da profundidade (as zonas só se posicionam em X, contra a
largura). Testado com Playwright: "Exemplo" sozinho já não mostra
aviso nenhum, e a lotação sobe de 317 para 352 pessoas (as 10 filas
completas, não 9).

**v2.64: a cobertura passa a usar a mesma régua AVIXA/SMPTE dos
Calculadores.** Pedido depois de se perguntar pelo conforto
visual/distância de visualização do exemplo: "seguindo a regra [...]
sempre dá calculadora" → "um merge das duas [regras/apps], acho" → "e
era avixa e smpte". Os limites de `calcularCobertura()` (`js/app.js`)
eram só do Preview — o próprio comentário dizia "não vem de nenhuma
norma" — enquanto os Calculadores, na aba "Distância de Visualização",
já citam e usam a norma a sério (com fonte ligada): SMPTE EG-18-1994
para o ângulo, AVIXA 4-6-8 para a distância/altura da imagem. Trocados
os quatro números:
- **Ângulo horizontal**: 20°/30° (confortável/limite) → **30°/35°** —
  os valores exatos do SMPTE EG-18-1994 que os Calculadores já citam
  ("até 30° recomendado, 30-35° aceitável mas no limite, acima de 35°
  desconforto para a maioria").
- **Distância** (em alturas de imagem): 8/10 → **6/8** — os dois
  primeiros níveis do "AVIXA 4-6-8": 6 é "detalhe normal, a maioria das
  apresentações" (o nível "basic", o que este Preview já assume por
  omissão), 8 é "pouco detalhe, vídeo" (o nível "passive", mais
  permissivo). Fica de fora o mínimo do AVIXA (altura × 2) — a esse a
  pergunta certa é o ângulo VERTICAL (que o Preview já verifica, e os
  Calculadores nem modelam), não a distância.
- O ângulo **vertical** (10°/15°) fica como estava — não tem norma
  equivalente nos Calculadores (que não modelam a sala em 3D), é
  só do Preview.
Resultado no exemplo (mesma sala corrigida do v2.63): **306
confortáveis · 46 marginais · 0 sem cobertura** (de 352 lugares) — uma
melhoria em relação aos números antigos (286/66/0): o ângulo ficou mais
permissivo (30° em vez de 20° para "confortável"), mesmo com a
distância mais apertada (6 em vez de 8). 46 lugares marginais não é um
defeito a corrigir — nenhuma sala real tem 100% dos lugares no ponto
ideal, e o que importa a sério (0 sem cobertura nenhuma) já estava e
continua a zero.

**v2.65: a cobertura junto da lotação, logo no topo, com cores.** Pedido
direto: "podemos logo de início ter a cobertura declarada no topo junto
da capacidade em números e usando as cores, ficaria logo mais visível".
`calcularCobertura()` já corria sempre que há projeto com zonas --
ligado ou não o "Cobertura dos ecrãs" -- só não se mostrava em lado
nenhum sem esse toggle. `escreverPainel()` (`js/app.js`) passou a
receber a `cobertura` (já calculada em `montar()`, só faltava chegar lá)
e o badge `#lotacaoTopo` ganha, a seguir ao "👥 352" de sempre, três
números coloridos -- ●verde confortáveis, ●amarelo marginais, ●vermelho
sem cobertura nenhuma -- as MESMAS classes/cores do painel de cobertura
que já existia (`.cobertura-verde/amarela/vermelha`), não cores novas à
parte.

Duas coisas encontradas a testar, corrigidas no mesmo PR:
- **As cores saíam cinzentas.** `#painel header span { color:
  var(--apagado); }` (com um id lá dentro, mais específico) ganhava a
  `.cobertura-verde`/etc. (só uma classe) -- as três bolinhas apareciam
  todas na mesma cor apagada, o oposto do pedido ("usando as cores").
  Corrigido com `#lotacaoTopo .cobertura-verde` (e as outras duas),
  específico que chegue para ganhar de vez.
- **Uma sala em branco (sem projeto nenhum) já mostrava "Só cabem 9 das
  10 filas"**, mesmo sem ter carregado nada -- o valor por omissão de
  `#salaP` no HTML (18 m) tinha o mesmo problema do v2.63 (18,3 m é o
  mínimo para 10 filas com os outros valores por omissão), só que para
  a sala em branco, não para o exemplo. Subido para 20 m também aqui,
  pela mesma conta.
Testado com Playwright: sem projeto nenhum, "👥 352" sem aviso e sem
cobertura nenhuma a mostrar (não há zonas para calcular); a carregar
"Exemplo", sem tocar em "Cobertura dos ecrãs", aparecem logo "●306
●46 ●0" com as cores certas (verde `rgb(61,220,132)`, confirmado por
`getComputedStyle`).

**v2.66: as imagens de conteúdo (ecrã geral/por zona) reduzem-se antes de
virarem textura.** Reportado a testar o link partilhado a sério: "projeto
demasiado grande para partilhar". Uma foto de telemóvel facilmente passa
dos 3-5MB, e com uma imagem geral MAIS uma por zona isso soma-se depressa
acima dos 8MB do Worker (v2.60/v2.64). Subir o limite outra vez não
resolvia a raiz -- um ecrã na cena nunca precisa da resolução toda de
uma fotografia. `conteudoDeFicheiro()`, novo em `js/cena.js` (substitui,
só para conteúdo de ecrã, o par `texturaDeFicheiro()`+`dataURLDeFicheiro()`
que os dois pontos em `js/app.js` usavam): lê o ficheiro UMA vez, desenha
num `<canvas>` reduzido (máximo 2000px no lado maior -- de sobra para
nitidez a qualquer distância de visualização normal) e tira dali os dois,
textura ao vivo e data URL a guardar, do MESMO canvas -- nunca a
guardar maior do que o que já está na cena. Mantém-se o formato original
(PNG continua PNG) para não trocar uma transparência a sério -- um logo
sobre a cor do ecrã, por exemplo -- por um fundo preto sólido, que um
JPEG sem canal alfa faria; só quem já veio sem alfa (JPEG) é que se
comprime a sério (qualidade 0,85). `texturaDeFicheiro()` sozinho manteve-se
tal e qual para a planta (import de imagem/PDF) -- essa pode ter texto
fino a precisar da resolução toda, não é o mesmo caso.
Testado com Playwright: uma foto sintética de 4032×3024px com ruído
aleatório (pior caso para compressão -- 7,91MB) posta como imagem geral
E como imagem de uma zona (o cenário exato do relatado -- as duas juntas
é que estouravam o limite); o projeto guardado resultante ficou nos
4,74MB, bem abaixo dos 8MB do Worker, e a imagem continua a aparecer
certa na cena (só mais leve).

**v2.67: PNG só fica em PNG com transparência a sério.** O v2.66 mordeu
com um projeto de 11 ecrãs, cada um com a sua foto -- todas em PNG, e
"projeto demasiado grande para partilhar" outra vez, apesar do limite
já reduzir para 2000px. Causa: `conteudoDeFicheiro()` decidia o formato
pelo NOME do ficheiro (".png" ficava PNG, sem perdas) -- e uma
fotografia normal em PNG (formato sem perdas) pode pesar 5-10x mais do
que a mesma foto em JPEG, mesmo depois de reduzida. Com 11 delas,
qualquer redução de resolução não chegava. `temTransparenciaAsSerio()`,
nova em `js/cena.js`, olha aos pixels a sério (`getImageData`, procura
um alfa abaixo de 255 nalgum sítio) em vez de confiar no nome -- só
fica em PNG quem tem mesmo transparência a preservar (um logo posto
sobre a cor do ecrã, por exemplo); uma foto em PNG sem transparência
nenhuma passa a JPEG (qualidade 0,85) como qualquer outra foto.
Testado com Playwright: um PNG opaco (sem alfa nenhum) sai como
`data:image/jpeg`; um PNG com uma zona a sério transparente continua a
sair como `data:image/png` -- os dois casos que interessava distinguir.

**v2.68: compressão mais forte, e o link passa a durar 1 dia.** Ainda a
mesma história do "projeto demasiado grande para partilhar" -- desta
vez um projeto real com 11 ecrãs, cada um com a sua foto, continuava a
passar do limite mesmo já em JPEG (v2.67). Pedido direto: "comprime as
imagens para jpeg para baixar ou aumenta o tamanho do contentor e
reduz o tempo de disponibilidade para um dia para não encher" -- as
três coisas, feitas as três:
- `conteudoDeFicheiro()` (`js/cena.js`) aperta de 2000px/qualidade 0,85
  para **1600px/qualidade 0,75** -- um ecrã na cena não perde nitidez
  visível com isto (vê-se a alguma distância, não em detalhe de perto).
- O limite do Worker (`calculadores/worker/src/index.js`) sobe de 8MB
  para **16MB** -- bem abaixo do limite de valor do KV (25MB).
- A validade desce de 7 dias para **1 dia** -- menos partilhas antigas
  por apagar no KV, com payloads agora maiores.
`VALIDADE_PARTILHA` (`js/partilha.js`) e os textos no botão/nota
(`index.html`) seguem o novo número, para a app nunca prometer um
prazo que já não é o que o Worker cumpre.
Testado: o mesmo PNG opaco sintético do v2.67, agora com os números
apertados, sai com metade do tamanho de antes (2166,6 KB → 878,8 KB) --
e continua corretamente em JPEG, sem tocar no caso da transparência a
sério (continua em PNG).

**v2.69: reabrir um projeto antigo também recomprime as imagens.**
Depois do v2.68 (compressão mais apertada + Worker a 16MB), o mesmo
projeto real de 11 ecrãs continuava "demasiado grande para partilhar"
-- confirmado com o Worker já a aceitar 16MB, a versão da app já em
v2.69 no ecrã, o problema não desapareceu. Causa: a compressão só
corria ao ESCOLHER uma imagem nova (`conteudoDeFicheiro()`, ligado ao
campo de ficheiro) -- nunca ao REABRIR um projeto já gravado, que
apenas reconstruía a textura do data URL tal e qual estava guardado
(`texturaDeDataURL()`, sem tocar no tamanho). Um projeto gravado antes
de hoje, ou com imagens escolhidas num Preview mais antigo, ficava
preso no tamanho de quando foi gravado, por mais vezes que se abrisse
-- e o mike teria de escolher as 11 imagens outra vez à mão para
beneficiar da compressão nova.
`conteudoDeDataURL()`, novo em `js/cena.js` (a par de
`conteudoDeFicheiro()`, agora os dois a partilhar a mesma
`reduzirImagem()`), faz o mesmo que já fazia ao escolher um ficheiro,
mas a partir de um data URL guardado -- nunca rejeita (uma imagem
corrompida fica só sem conteúdo nessa zona, como já era). `abrirProjetoTodo()`
(`js/app.js`) passa a usar isto em vez de `texturaDeDataURL()` (que
saiu, ficou sem uso), e grava de volta o data URL RECOMPRIMIDO em
`texturaDataURL`/`texturasPorZonaDataURL` -- um "Guardar projeto" ou
"Link para ver" logo a seguir a abrir já sai leve, sem se tocar em
imagem nenhuma à mão. Como um link partilhado também passa por
`abrirProjetoTodo()`, abrir um link antigo (de antes desta correção)
também beneficia.
Testado com Playwright: um projeto sintético de 40,15MB (uma foto
"realista" -- gradiente + ruído fino tipo sensor, nada da imagem de
ruído aleatório adversarial dos testes anteriores -- repetida 12 vezes,
imagem geral + 11 zonas, o cenário exato do relatado) reaberto e
guardado de novo sai em 0,62MB -- as 11 zonas e a imagem geral todas
corretamente recomprimidas para JPEG.

**v2.70: botão "Meu logo" no conteúdo dos ecrãs.** Pedido direto: "adiciona
no conteudo dos ecrans o meu logo botao para poder escolher um logo de
cliente e usar, tenho o meu logotipo como base e depois o browse/procurar
para alterar mas tendo sempre a base quando ativado". Novo botão "Meu logo"
em `#sConteudo` (`index.html`), ao lado de "Padrão de teste"/"Imagem…":
aplica o logotipo da AVK (`texturaDaMarca(true)`, já existente para o
"Exemplo") como conteúdo GERAL dos ecrãs, e revela um botão "Trocar pelo
logo do cliente…" para escolher uma imagem à parte sem sair deste modo.
Clicar em "Meu logo" outra vez (mesmo já trocado por um logo de cliente)
larga o que estiver lá e volta sempre à base -- é a "base" pedida, não um
interruptor liga/desliga.
Ao contrário da marca do "Exemplo" (que fica de propósito fora do "Guardar
projeto" -- é só demonstração, regenera-se sozinha ao clicar "Exemplo"),
"Meu logo" converte-se logo num data URL a sério (`t.image.toDataURL(...)`,
o canvas por trás da `CanvasTexture`) -- viaja no "Guardar projeto" e no
link tal como uma imagem escolhida à mão. Isto importa em particular para o
**DSM e os delays sem imagem própria**, que só mostram o conteúdo geral: sem
um data URL a sério, ficavam sem nada ao reabrir o projeto ou ao abrir o
link de partilha (reportado a seguir ao v2.69: "o link não está a levar a
média dos dsm, provavelmente o mesmo passará com os delays"). Testado
directamente esse caminho -- projeto com DSM, conteúdo geral escolhido à
mão, Guardar → Reabrir (o mesmo código que o link usa) -- e o DSM já
mostrava a imagem antes desta versão; o problema real é não haver nenhum
conteúdo geral definido de origem. "Meu logo" resolve isso ao dar sempre um
conteúdo geral pronto a um clique, sem se ter de escolher uma imagem à mão
só para o DSM ter alguma coisa.
Testado com Playwright: activar "Meu logo" desenha o DSM com o logotipo de
imediato; o ficheiro guardado (`estado.conteudo.textura`) sai como
`data:image/png` a sério; reabrir esse ficheiro mantém o logo no DSM;
trocar pelo logo do cliente e voltar a clicar em "Meu logo" repõe a base.

**v2.71: passarela a sair do palco.** Pedido direto: "tenho que desenhar um
palco com uma passarela". Nova secção dentro de "Palco" (`index.html`):
checkbox "Passarela" + Largura/Comprimento/Deslocar ↔ -- reta, sem rodar
nem em T (só isso foi pedido), mas com posição e largura ajustáveis à mão
(não presa ao centro). Sai do meio da frente do palco para dentro da sala,
à MESMA altura do tampo do palco (um degrau só, não dois -- ver
`fazerPassarela()`, novo em `js/cena.js`).
A plateia abre-se sozinha nos dois lados onde a passarela passa: a mesma
técnica que já existia para a régie (um rectângulo que "salta" os lugares
que caem lá dentro, com meia folga de lugar/fila à volta), agora também em
`fazerPublico()` (`js/cena.js`, novo parâmetro `passarela` a par de
`regie`) -- ver `zonaDaPassarela()`, a função que devolve esse rectângulo
para os dois sítios (o desenho e o vão) nunca poderem discordar um do
outro. Como o vão só existe entre o palco e o FIM da passarela
(`comprimento`), as filas que ficarem depois dela voltam a ficar inteiras
sozinhas -- é o que faz isto parecer uma passarela a sério (forma de "T"),
sem ser preciso desenhar duas plateias à parte.
Só na plateia "Reto" -- em "Circular (gomos)" a passarela continua a
desenhar-se, mas sem abrir vão nenhum (os gomos são um formato à parte,
por explorar noutra altura se vier a ser pedido).
Sem posição por arrastar na cena (como a régie já tem) -- só pelos campos
"Deslocar ↔" por agora; fica para depois se fizer falta.
Testado com Playwright: activar a passarela reduz o número de lugares (o
vão abriu-se); nenhum lugar cai dentro do rectângulo dela; as filas depois
do fim dela voltam a ter gente ao centro (a forma de T); Guardar → Reabrir
(o mesmo caminho do link de partilha) mantém a passarela e os campos.
Confirmado também visualmente, de cima: o corredor central corta as
primeiras filas em dois blocos e a última fila (já depois do fim da
passarela) volta a ficar inteira.

**v2.72: o orador já vai à passarela.** Reportado logo a seguir ao v2.71:
"o prop não vai à passarela, coitado". Causa: arrastar o orador na cena
(`js/app.js`, "arrastar o orador") já tinha sempre existido, mas o limite
da frente ficava preso à borda do palco (`frenteZ = ...palco.profundidade
- 0.3`) -- um limite fixo, de antes de a passarela existir, que não sabia
que ela lá estava. Por mais que se arrastasse para a frente, o orador
batia nessa borda invisível e não passava.
Corrigido para esticar esse limite até ao FIM da passarela (`zonaDaPassarela()`,
a mesma função que já abre o vão na plateia), mas só quando o rato já está
alinhado com a largura dela -- senão continua preso à borda do palco como
sempre, que é o comportamento certo para quem não está a tentar ir para lá.
E ao contrário: uma vez para lá da borda do palco (JÁ em cima da
passarela), a largura livre para os lados passa a ser só a dela, não a do
palco inteiro -- para não ser possível "flutuar" ao lado dela, por cima da
plateia, um sítio que não existe fisicamente.
Testado com Playwright, simulando um arrasto a sério (pointerdown/move/up,
com a câmara de cima para o mapeamento ecrã↔mundo ser previsível): sem
passarela continua preso à borda do palco (referência); com ela e alinhado,
chega até perto do fim dela mas não passa; fora da largura dela continua
preso à borda; nunca fica ao mesmo tempo para lá da borda do palco E fora
da largura da passarela (a tal "flutuação"); e um passo pequeno para o
lado, ainda dentro da largura dela, não o manda de volta para trás.

**v2.73: de onde veio um projeto, e com que versão.** Sugestão directa do
mike a seguir a uma tarde inteira a diagnosticar o nome do projeto que não
chegava aqui (detalhe do lado de lá no `PARA-CONTINUAR.md` dos
Calculadores): "deviamos ter forma de identificar se são da calculadores
ou do preview". `lerProjeto()` (`js/projeto.js`) passa a guardar
`origemVersao` (a versão de quem escreveu o payload -- ex: "v3.18" dos
Calculadores) a par do `origem` que já existia; um projeto criado
directamente aqui (`garantirProjeto()`, `js/app.js`) estampa-se a si
próprio como `origem: "preview"` com a versão local (`#versao`). O ficheiro
de "Guardar projeto"/"Link para ver" (`estadoCompleto()`) ganha também
`versaoPreview`, a versão de quem gravou esse ficheiro -- útil ao abrir um
ficheiro estranho meses depois. No viewport (`#nomeProjetoViewport`), isto
aparece no `title` ao pairar o rato -- "Calculadores v3.18" ou
"Preview v2.7x" -- sem sujar a cena com mais texto.
Testado com Playwright: um payload posto directamente no `localStorage` a
fingir vir dos Calculadores (`origem: "calculadores", origemVersao:
"v3.17"`) mostra "Calculadores v3.17" no tooltip; um projeto criado aqui
mesmo (+ DSM, sem nada vindo de fora) mostra "Preview v2.7x".

**v2.74: AV Planner — o logótipo passa a link.** Mesmo pedido do lado dos
Calculadores (ver `PARA-CONTINUAR.md` de lá para o contexto completo):
"rename radical nestes dois meninos... ter apenas uma unificada, já que
elas abrem uma a outra". Decisão: sem fundir código -- só uma marca
comum por cima, "AV Planner", num repositório novo
(`mikefkfmiguel-create.github.io/AvPlanner/`). O logótipo aqui
(`#marca`, `cabecalho-linha1`) passa a link para essa página. Sem versão
em inglês para traduzir -- este app não tem esse motor (só os
Calculadores têm PT/EN).

**v2.75: um sítio para pôr o nome do projeto, aqui mesmo.** Pergunta directa
do mike: "o JSON quando gravo não pode ser o mesmo para os dois? E quando
gravo no 3D não fica o nome que lhe dei no ficheiro ou tenho dentro dele
onde por?". A segunda parte era uma lacuna real: `estadoCompleto()` já
gravava `projeto.nome` certinho no ficheiro (e usava-o no nome do
download), mas não havia onde o escrever ou editar dentro do Preview --
só vinha de fora (Calculadores, ou um link recebido). Secção "Projeto"
ganha um campo `#nomeProjeto`, logo a seguir ao título: escrever nele
chama `garantirProjeto()` (cria um projeto vazio se ainda não houver
nenhum -- dá para começar pelo nome, antes de trazer zonas) e actualiza
`projeto.nome` e o texto no viewport ao vivo, sem passar pelo `montar()`
inteiro. Em `montar()`, o campo é preenchido a partir de `projeto.nome`
sempre que há um remontar -- mas só quando o campo não está com o foco,
para não fugir o cursor a quem estiver a escrever. Testado com
Playwright: escrever no campo sem projeto nenhum carregado cria um e
mostra-o no viewport; escrever com o foco no campo não perde o cursor
nem o valor a meio; "Guardar projeto" produz um ficheiro com
`projeto.nome` correcto, com o nome de ficheiro derivado dele.
A primeira parte da pergunta -- unificar o formato -- fica por responder
em código: os dois ficheiros guardam coisas fundamentalmente diferentes
(zonas/fichas técnicas nos Calculadores, uma cena 3D inteira aqui), por
isso já têm o `origem`/`origemVersao` da v2.73 a identificar de onde vêm,
mas não um formato único.

**v2.76: uma foto/render também pode ir com o pedido, daqui mesmo.**
Pedido direto: "pode ser um campo no 3d onde inserir uma imagem que esteja
ligado ao campo dos cálculos" — depois de reparar que o Assistente dos
Calculadores já aceita foto/render (PNG/JPEG) mas o "Analisar com a IA"
aqui do Preview (`js/assistente.js`, `analisar()`) só mandava texto. O
Worker já aceitava `imageBase64`/`imageMediaType` — só faltava o Preview
os mandar. Novo campo `#imagemPedido` na secção Projeto, logo antes do
botão "Analisar com a IA": ao clicar, se houver ficheiro escolhido,
`app.js` lê-o para base64 (`ficheiroParaBase64()`, o mesmo padrão do
`fileToBase64()` dos Calculadores) e passa-o a `analisar(texto, sala,
imagem)` — terceiro argumento novo, opcional. O aviso "escreve o texto"
passa a só disparar se não houver TEXTO NEM IMAGEM (antes exigia sempre
texto) — dá para mandar só uma foto, sem escrever nada. Mesma regra de
sempre: a IA só identifica visualmente o que a foto mostra, nunca mede
nada a partir dela — o aviso ao lado do campo diz isso mesmo. Testado com
Playwright: só imagem (sem texto) chega ao Worker com `imageBase64`
preenchido e `text` vazio (a sala por omissão ainda entra, como sempre);
nem texto nem imagem continua a mostrar o aviso a pedir um dos dois.

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
