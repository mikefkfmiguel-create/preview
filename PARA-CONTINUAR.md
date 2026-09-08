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
