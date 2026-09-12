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

**v2.77: a sala do texto deixou de perder para o valor de arranque, e "de
pé" já não desenha auditório.** Dois reportes seguidos do mesmo teste real
(escreveu "sala com 25 por 25... 300 pessoas de pé numa entrega de
prémios"). Primeiro: "não leu o tamanho da sala, aplicou o base" — a causa
era `btAnalisar.onclick` mandar SEMPRE os valores actuais de
`salaL`/`salaP`/`salaA` para a IA como "(Sala já definida no desenho:
...)", mesmo quando esses campos ainda estavam no `defaultValue` do HTML
(24×20×8, nunca tocados) — a IA lia isso como facto assente e ignorava a
sala escrita no próprio texto. Corrigido: só entra no que se manda à IA um
campo que o `porOMike()` (o mesmo já usado para decidir se se aplica a
resposta da IA de volta ao campo — hoisted para o topo da função e
reusado nos dois sentidos) diz que foi mesmo mexido à mão; um campo por
tocar manda `null`, e `analisar()` (`js/assistente.js`) já sabia não
inventar sala nenhuma quando não recebe uma.
Segundo: "repara que lhe disse que era de pé e desenhou um auditório a
subir" — o padrão da página é sempre auditório com plateia a subir
(`#inclinacao`, valor de arranque 0.12); nada no pedido de texto mudava
isso. Novo campo no Worker, `local.publicoEmPe` (true só se o texto o
disser explicitamente — nunca inferido do tipo de evento), exposto por
`doQueVeioParaCa()` como `veio.emPe`; quando `true` e `#inclinacao` ainda
não foi mexido à mão, `btAnalisar.onclick` põe-no a 0 (o mesmo que o botão
"Pavilhão · plano" já faz) e avisa "chão plano (público de pé)".
Testado com Playwright: sala "25 por 25" no texto, com os campos ainda no
default, aplica-se a sério (antes ficava presa em 24×20); um campo já
mexido à mão continua a ganhar à IA, campo a campo (não é tudo-ou-nada);
"de pé" põe a inclinação a 0 e avisa; uma inclinação já mexida à mão não é
tocada mesmo com "de pé" no texto.

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

**v2.78: "Limpar tudo" não limpava os arrastos.** Reportado como "a
plateia está bem, só não faz reset dos ajustes mesmo limpando o
projeto" — a seguir a uma confusão inicial ("primeira fila em circular a
contar mal") que afinal tinha a mesma causa. `limparTudo()` repunha os
campos todos mas nunca tocava em `ajustes` (`{delays, dsm, gomos}` — os
desvios de arrastar) nem apagava `mikeapps-preview-ajustes-v1` do
localStorage — um projeto "limpo" continuava a herdar arrastos do
projeto anterior (um gomo rodado, um DSM deslocado). Corrigido: `ajustes`
volta ao estado vazio e a chave é removida, tal como já acontecia com
`CHAVE_PROJETO`/`CHAVE_PROJETOR`/`CHAVE_DEVOLUCAO`. Testado com
Playwright: um ajuste falso posto directamente no localStorage sobrevive
a um recarregar (confirma o bug), mas desaparece depois de "Limpar tudo".

**v2.79: base do formato para vários palcos/régies/passarelas/projetores
(fase 1 de um plano maior).** Pedido combinado numa sessão só: *"o 3D não
está a trazer os projetores do projeto"*, *"preciso ter como criar mais
do que um... régie, palco, passarela"*, *"e preciso deslocar os
projetores"*. Plano completo em `.claude` (sessão Claude Code) — resumo
aqui: cada tipo ganha um array `Extra` em `ajustes`
(`palcosExtra/regiesExtra/passarelasExtra/projetoresExtra`), ao lado dos
já existentes `delays/dsm/gomos` — a instância "0" de cada tipo continua
exactamente como está hoje (campos fixos), só as instâncias 1+ vivem
nesses arrays. Esta primeira fase é só a base tolerante de leitura/
gravação (`ajustesGuardados()` em `js/projeto.js`, e o bloco defensivo em
`abrirProjetoTodo()` que já tratava `delays/dsm/gomos` da mesma forma) —
sem nenhuma mudança visível ainda. Testado com Playwright: um
`.preview.json` gravado ANTES desta versão (sem os quatro campos `Extra`)
continua a abrir sem erro nenhum; gravar agora já inclui os quatro
arrays vazios; reabrir esse ficheiro novo também não dá erro.

Fases seguintes (ainda por fazer): projetor arrastável (instância única),
vários palcos (só visual), várias régies (com talha de vão na plateia em
array), várias passarelas soltas (rotação nova), Blending a mandar todos
os projetores para o Preview, e "Trazer projeto" a trazer também as TVs.

**v2.80: projetor arrastável (fase 2 do mesmo plano).** Até aqui a posição
do projetor só se ajustava pelos campos `#projLateral`/`#projDist` — ao
contrário da régie, do DSM e dos delays, não se podia arrastar na cena.
A malha do projetor em `cena.js` (`fazerProjecao()`) passou a chamar-se
`"projetor-0"` (em vez de `"projetor"`, sem mais nenhuma referência a esse
nome no código), preparando o terreno para as instâncias extra da fase 6.
Novo adaptador `alvoDeCamposProjetor(sala)` em `js/app.js`: lê/escreve
`#projLateral` a partir de `x`, e `#projDist` a partir de `z` subtraindo o
mesmo offset `z0` que `fazerProjecao()` já usa para posicionar a malha
(borda da sala + 0.35 m), disparando `input` nos dois campos para que o
resto da app (cálculos de shift, ficha técnica) reaja como se a pessoa
tivesse escrito lá directamente. Entra em `objetosArrastaveis()` como mais
um ramo, reaproveitando o sistema de arrastar já existente (raycast contra
um plano horizontal). Como todo o arrastar nesta app, só funciona com o
cadeado de "edição livre" aberto (🔓). Testado com Playwright: arrastar o
projetor 80px na horizontal moveu `#projLateral` de `0` para `1.445322`
mantendo `#projDist` em `10`, como esperado de um arrasto lateral.

**v2.81: vários palcos (fase 3 do mesmo plano).** Até aqui só havia UM
palco possível. Um palco extra (2º, 3º, ...) é só visual/estrutural —
decisão já tomada com o mike: ecrãs, ângulos SMPTE e cobertura continuam
sempre agarrados só ao palco principal. Nova função `fazerPalcoExtra(pe)`
em `js/cena.js`, que desenha uma caixa independente com posição (dx/dz),
rotação (rot) e dimensões próprias — ao contrário do palco principal, que
nasce sempre centrado e encostado ao fundo da sala. Guarda-se em
`ajustes.palcosExtra[]` (o array-base já preparado na v2.79). Botão
"+ Palco" na secção Palco cria um novo, ao lado do anterior para não
nascer sobreposto; cada um aparece numa lista compacta com os campos
(largura/altura/profundidade/deslocar/rodar) e um botão para remover —
mesma mecânica já usada para os gomos da plateia circular, que já editava
um array de instâncias assim tanto por campo como por arrastar. Arrastar
na cena (cadeado de edição livre aberto) também funciona, ligado a
`objetosArrastaveis()` pelos nomes `"palco-1"`, `"palco-2"`, etc.
Testado com Playwright: dois palcos extra criados, lista com os rótulos
certos, editar "largura" muda o tamanho na cena, arrastar 60px muda o
campo "deslocar ↔", remover deixa só o que sobra — sem erros de consola.

Fases seguintes (ainda por fazer): várias régies (com talha de vão na
plateia em array), várias passarelas soltas (rotação nova), Blending a
mandar todos os projetores para o Preview, e "Trazer projeto" a trazer
também as TVs.

**v2.82: várias régies (fase 4 do mesmo plano — a mais arriscada, por
mexer nas contas da plateia).** `fazerPublico()` (`js/cena.js`) passou a
receber `regies` (lista, não uma só) — o teste "este lugar cai dentro da
régie?" agora corre em loop por todas, e salta o lugar assim que a
primeira bater certo, sem deixar de testar as outras quando a primeira
falha. `fazerPublicoGomos()` transforma CADA régie da lista para o
referencial local de cada gomo (antes só fazia isto para uma) — a régie
continua a ser uma mesa física fixa, que não roda nem desloca com o
gomo. Guardado em `ajustes.regiesExtra[]`. Botão "+ Régie", lista
compacta por instância e arrastar na cena (nomes `"regie-1"`,
`"regie-2"`, ...) — mesma mecânica da fase 3. Régies extra só existem
enquanto a régie principal estiver ligada (mesmo interruptor).
Testado com Playwright: acrescentar uma régie extra a meio da plateia fez
a lotação cair de 352 para 336 lugares (a régie extra a abrir o seu
próprio vão), arrastar mudou o campo "deslocar ↔", remover devolveu a
lotação aos 352 originais — e o modo "Circular" (gomos) continuou a
funcionar sem erros com duas régies extra.

De passagem: o botão "remover" das listas de palco/régie extra (fases 3
e 4) partilhava a classe CSS `ajuste-passo` com os botões "−"/"+" dos
campos numéricos — visualmente sem problema (o texto "✕" distingue-o),
mas uma seleção por classe (como um teste automatizado, ou uma extensão
futura) apanhava o botão errado. Ganhou uma segunda classe,
`ajuste-remover`, só para isso.

Fases seguintes (ainda por fazer): várias passarelas soltas (rotação
nova), Blending a mandar todos os projetores para o Preview, e "Trazer
projeto" a trazer também as TVs.

**v2.83: passarelas soltas (fase 5 do mesmo plano).** Diferente da
passarela de sempre (que sai sempre do meio da frente do palco e nunca
roda), uma passarela solta é livre — posição e rotação próprias, sem
estar presa a nenhum palco, decisão já tomada com o mike. Nova
`fazerPassarelaLivre(pl)` em `js/cena.js` (mesmo molde do palco/régie
extra), e o teste de vão na plateia ganhou o mesmo referencial local
rodado já usado para a régie — necessário aqui porque, ao contrário da
presa ao palco (sempre reta), esta pode estar em qualquer ângulo.
`fazerPublicoGomos()` também transforma cada passarela solta para o
referencial de cada gomo, tal como já fazia com as régies. Guardado em
`ajustes.passarelasExtra[]`; existem sempre que estiverem na lista, sem
depender de "Ver palco" nem de nenhum interruptor — não têm de onde
"desligar-se", ao contrário da presa ao palco. Botão "+ Passarela
solta" e lista compacta (largura/comprimento/altura própria — não herda
a de nenhum palco/deslocar/rodar) na secção Palco.

Apanhado a testar: a primeira passarela nascia encostada à parede
lateral (a mesma posição "perto da borda" que o botão "+ Palco" já usa
para o palco extra), e nesse sítio ficava fora do enquadramento da
vista "Frente" por omissão — dava para arrastar na mesma depois de
rodar a câmara, mas era fácil pensar que nada tinha sido criado.
Corrigido antes de publicar: a primeira nasce centrada, as seguintes
alternam para um lado e para o outro, perto do centro da sala.

Testado com Playwright: acrescentar uma passarela solta a meio da
plateia reduziu a lotação (352 → 345), rodar 90° mudou-a outra vez (→
341), arrastar mudou o campo "deslocar ↔", remover devolveu os 352
originais, e o modo "Circular" continuou sem erros com a passarela
solta lá dentro.

Fases seguintes (ainda por fazer): Blending a mandar todos os
projetores para o Preview, e "Trazer projeto" a trazer também as TVs.

**v2.84: recebe os vários projetores do Blending (fase 6 do mesmo
plano).** `mikeapps-projetor-v1` ganhou uma segunda forma —
`{v:2, projetores:[...]}`, ao lado da antiga `{v:1, racio, ...}` (que
continua a funcionar tal e qual). Nova `lerProjetores(d)` em
`js/projeto.js` aceita as duas; `projetorGuardado()`/
`projetorDoEndereco()` passam a devolver sempre um array (nunca `null`,
`[]` quando vazio). `fazerProjecao()` (`js/cena.js`) ganhou um 4º
parâmetro opcional para o nome da malha (`"projetor-0"` por omissão,
`"projetor-N"` para as extra — sem isto, chamar a função mais do que
uma vez criava várias malhas todas com o mesmo nome, e só a primeira
seria alguma vez encontrada ou arrastável).

Nova `aplicarProjetores(lista)` em `js/app.js`: o primeiro projetor
aplica-se à instância #0 exactamente como sempre (`aplicarProjetor()`,
intocada); os restantes ficam em `ajustes.projetoresExtra[]`. Os
Calculadores só sabem a geometria RELATIVA da grelha do blend (onde
cada projetor fica em relação ao primeiro) — nunca a posição absoluta
na sala, essa continua "daqui" (a instância #0 nunca recebe posição
pronta, só rácio/distância/shift, como já era). Por isso o `lateral`/
`alturaOffset` de cada extra somam-se ao que já estava na instância #0
em vez de o substituírem. `aplicarProjetores()` passou a ser chamada
nos 5 sítios que antes chamavam `aplicarProjetor()` directamente (botão
manual, botão de sincronizar, `hashchange`, evento `storage`,
`projetorAEspera()` ao carregar).

Projetores extra desenham-se em `montar()` (visuais e sem sombra/
cobertura calculadas, como os outros tipos "Extra"), arrastam-se na
cena (nomes `"projetor-1"`, `"projetor-2"`, ...) com um adaptador novo
(`alvoDeProjetorExtra`, grava lateral/distância directamente no
ajuste em vez de nos campos `#projLateral`/`#projDist`, que só existem
para a instância #0), e têm lista compacta própria (rácio/distância/
altura/deslocar + remover) em `js/app.js`.

Testado com Playwright, ponta a ponta: um payload `{v:2}` com dois
projetores (rácio 0.785, distância 6 m, `lateral` ±2.63 m) aplicado via
"Trazer projetor dos Calculadores" pôs a instância #0 com rácio/
distância certos (lateral/altura ficaram como já estavam — 0 e 4.5,
por omissão), criou um projetor extra com lateral absoluto 2.63 (0 +
2.63, a âncora mais o offset), arrastável (mudou de 2.63 para 3.73 num
arrasto de 50px) e removível; um payload `{v:1}` antigo continuou a
aplicar-se à instância #0 e limpou o extra que lá estava.

**v2.85: avisos de "não cabe" ganham botão para saltar à secção
certa.** Pedido direto: *"os avisos no 3D de não cabe podiam ter onde
clicar para saltar para a aba de ajuste respetivo"*. Os três avisos
que descrevem algo que não cabe fisicamente na sala (filas da plateia
que não cabem, gomos apertados no modo Circular, e o conjunto de
ecrãs/pé-direito que não cabe na sala) passam a incluir um botão
embutido no próprio texto do aviso — clicar nele abre o painel lateral
(se estiver escondido), desdobra a secção certa (Público, Sala ou
Palco, conforme o problema) e leva a vista até lá com scroll suave.

Nova `irParaSeccao(id, idParaFoco)` em `js/app.js`, generalizada a
partir do que `mostrarZonas()` já fazia manualmente (essa função ficou
reduzida a uma chamada a esta). Um só listener delegado em `#aviso`
(`[data-secao]`) — necessário porque o texto do aviso é reconstruído
do zero a cada `montar()`, o que apagaria um listener posto
directamente num botão. Nova classe CSS `.aviso-link`.

Testado com Playwright: com o painel fechado, provocar "só cabem 11
das 200 filas" mostrou o botão "Ajustar Público" — clicar nele reabriu
o painel E a secção Público, mesmo com os dois fechados antes; o
mesmo confirmado para "Ajustar Sala" (sala mais estreita do que o
conjunto de ecrãs do exemplo). Sem erros de consola.

**v2.86: a Cobertura passa a poder ignorar ecrãs sem leitura.** Pedido
direto: *"o conforto visual deveria poder escolher que ecrãs deve usar
pois por vezes nem todos são para slides mas sim para complemento
visual sem necessidade de leitura"*. A Cobertura (verde/amarelo/
vermelho por lugar) testava sempre TODOS os ecrãs do projeto contra a
mesma regra SMPTE/AVIXA de legibilidade — um ecrã lateral só de
imagem/ambiente entrava na conta ao mesmo nível que o ecrã principal
com texto, e podia até "salvar" um lugar mal posicionado para o ecrã
que interessa só por ter boa vista do decorativo.

Cada ecrã na lista da secção "zonas" ganhou um checkbox "leitura"
(ligado por omissão — comportamento de sempre). Desligar tira esse
ecrã da conta da Cobertura, sem o tirar do projeto nem do desenho —
continua a aparecer na cena, só deixa de contar para "confortável/
marginal/sem cobertura". Guardado por NOME em
`ajustes.zonasSemLeitura[]` (mesmo padrão de `ajustes.delays`), para
sobreviver a um novo "Trazer projeto" dos Calculadores — esse substitui
o array de zonas inteiro, mas os nomes mantêm-se. Se TODOS os ecrãs
ficarem marcados "sem leitura" (caso raro), a Cobertura usa a lista
toda na mesma, para não mostrar "sem cobertura" em todo o lado só por
não haver nenhum ecrã elegível.

Testado com Playwright, no projeto de exemplo (3 zonas: Ala esquerda/
Principal/Ala direita): cobertura inicial 306 confortáveis / 46
marginais / 0 sem cobertura; desligar "leitura" na Ala esquerda mudou
para 258/62/32 (lugares que só viam bem essa zona passaram a "sem
cobertura", como esperado); voltar a ligar devolveu exactamente os
números originais. Sem erros de consola.

**v2.87: a Cobertura passa a usar o standard de distância de
visualização escolhido nos Calculadores.** Pedido direto: *"dá para
escolher o Standard de cálculo da distância de visualização de forma
a ser o usado em todos os cálculos"* — confirmado por
`AskUserQuestion` que era a Cobertura do Preview 3D o alvo. Até aqui
o limite de distância (a parte "quantas alturas de imagem" da conta
verde/amarelo/vermelho) era sempre a mesma regra fixa — AVIXA
"básico", 6/8 alturas de imagem — por muito que se mudasse a regra na
aba "Distância de Visualização" dos Calculadores.

Os Calculadores passam agora a mandar, dentro do projeto (`js/zonas.js`,
`lzPayloadPreview()`), um campo `standard: {basis, min, max, label}`
com o standard escolhido lá, já resolvido em número (largura×1,5-6 do
THX, largura×1,5-2,5 do "sweet spot", ou altura×4/6/8 do AVIXA
consoante o nível de detalhe escolhido). `lerProjeto()` (`js/projeto.js`)
passou a trazer esse campo (antes ficava ignorado — o mesmo problema
que o DSM já teve, resolvido aqui à cabeça). Nova `regraDeDistancia()`
(`js/app.js`) decide o limite: com standard, usa `max` como limite e
`w` ou `h` da zona como base (conforme `basis`); sem standard (projeto
antigo, ou vindo de fora dos Calculadores), cai nos 6/8 de sempre.
Mantém-se a MESMA proporção 6/8 (0,75) entre "confortável" e "limite"
que já existia — só aplicada ao limite do standard escolhido, não uma
proporção nova inventada. `calcularCobertura()` e
`desenharConesCobertura()` (o cone na cena) passam ambas a usar esta
função em vez das constantes fixas. O ângulo horizontal/vertical
(regra SMPTE, 30°/35°) não muda — o pedido foi especificamente sobre
distância, e não há standard equivalente para ângulo nos Calculadores.

O painel da Cobertura passa a mostrar a regra em uso (`Regra: …`,
por baixo dos números), para o mike poder confirmar de imediato que
standard está a ser aplicado — o oposto do bug que motivou este
pedido (a aba TVs dos Calculadores a mostrar a regra errada em
silêncio; corrigido lá na v3.28).

Testado com Playwright: um mesmo projeto de teste (ecrã de 4×2,25 m,
352 lugares) deu 101 confortáveis / 158 marginais / 93 sem cobertura
sem standard (6/8 por omissão, base altura de 2,25 m); com
`standard:{basis:"width",max:6}` deu 217/67/68 (base largura de 4 m,
maior, logo alcance maior) — confirma que a base w/h está mesmo a
mudar a conta, não só a etiqueta. Um projeto sem standard nenhum
manteve os números de sempre, confirmando que ficheiros/links antigos
não mudam de comportamento.

**v2.88: ecrã muito mais largo que 16:9 passa a dividir-se em fatias para
a Cobertura, em vez de um único centro.** Pedido direto: *"se tiver um
ecrã que ultrapassa o 16/9 ele continua a marcar o centro em vez de
dividir quando cabem dois ou mais 16/9 para o cálculo de conforto de
visualização"*.

Um LED wall grande ou um blend de vários projetores, bem mais largo que a
sua altura, era sempre avaliado a partir de UM ponto central único
(`centroDeZona()`). Para quem está sentado de lado, isso mede o ângulo até
ao centro do ecrã inteiro — em vez de até à fatia do ecrã que essa pessoa
está mesmo a ver — e marcava-a erradamente como "sem cobertura" mesmo bem
posicionada em relação à parte mais próxima do ecrã.

Nova `segmentosDeZona()` (`js/app.js`): quando cabem 2 ou mais "larguras de
16:9" (a proporção de conteúdo mais comum) ao longo da largura real do
ecrã, divide-o em N fatias iguais — mesma altura, larguras e posições
próprias — e cada fatia passa a ter o seu próprio centro/ponto de vista na
Cobertura. Um ecrã até ~2 larguras de 16:9 (a esmagadora maioria) continua
com um único centro, exatamente como antes — zero mudança de comportamento
para o caso normal. `calcularCobertura()` usa isto para o teste de
ângulo/distância por lugar (a largura usada no standard largura-base
também passa a ser a da fatia, não do ecrã inteiro — um ecrã gigante não
deve parecer aceitar gente muito mais longe só por ser fisicamente maior);
`desenharConesCobertura()` usa o mesmo para o cone na cena não prometer
mais alcance do que o cálculo está mesmo a usar. A lista "sem ninguém a
ver" (`zonasSemCobertura`) continua por ecrã REAL, não por fatia — um ecrã
largo só entra nessa lista se NENHUMA das fatias tiver gente a vê-la.

Testado com Playwright: um ecrã de 12×2,25 m (5,3:1 — cabem 3 larguras de
16:9 de 4 m cada) foi de 101 confortáveis / 158 marginais / 93 sem
cobertura (código antigo, um só centro) para 185 / 164 / 3 (código novo,
3 fatias) na mesma sala e a mesma plateia — a esmagadora maioria de quem
antes ficava "sem cobertura" só por estar de lado em relação ao centro do
ecrã inteiro passou a ser corretamente avaliada contra a fatia mais
próxima. Um ecrã normal (4×2,25 m, 16:9 exato) deu exatamente os mesmos
números de antes (217/67/68) — confirma zero regressão para o caso comum.

**v2.89: "Trazer projeto dos Calculadores" deixa de dizer que não há nada
quando o que há é uma projeção.** Reportado com captura de ecrã: com
"Adicionar ao projeto" marcado na aba Distância de Projeção dos
Calculadores, este botão respondia *"Ainda não há nada guardado"*.

Há duas pontes: as zonas (Ecrã Complexo, TVs) em `mikeapps-projeto-v1`, e
a projeção em `mikeapps-projetor-v1`. Este botão só lia a primeira — e uma
projeção nunca cria zonas. O próprio aviso prometia "ou qualquer outra com
Adicionar ao projeto", o que tornava a resposta ainda mais enganadora: a
pessoa tinha feito exatamente o que o aviso mandava.

Sem zonas, o botão passa a tentar a ponte do projetor
(`aplicarProjetores(projetorGuardado())`) antes de desistir, e diz *"Não
havia zonas guardadas, mas veio a projeção dos Calculadores"*. O caminho
com zonas fica intocado. Do lado dos Calculadores (v3.31), a projeção
passou também a escrever-se sozinha nessa ponte quando "Adicionar ao
projeto" está marcado e a sincronização automática ligada — antes só o
botão "Ver no Preview 3D" a escrevia.

Testado com Playwright com as duas apps na MESMA origem (sem isso o
`localStorage` não é partilhado e o teste não diria nada): marcar a caixa
nos Calculadores e carregar aqui aplica a projeção — `projDist` fica a
17.00, com a mensagem nova.

**v2.90 (fase 2 do plano "o projeto é a unidade"): a arrumação deixa de se
perder quando a zona muda de nome.** Os ajustes de posição/rotação guardam-se
pelo NOME da zona — por isso renomeá-la nos Calculadores, ou trocar lá o
modelo da TV (que muda o nome-base de toda a fila), deitava fora tudo o que
tinha sido arrumado aqui.

As zonas passam a trazer um `id` persistente, posto por quem as cria (os
Calculadores, ou este Preview no "+ Ecrã"/"+ Delay"), e devolvido intacto no
retorno automático. Nova `reconciliarAjustesPorId()` (`js/app.js`), chamada
sempre que um projeto entra (arranque, `carregar()`, evento `storage`): guarda
o último nome conhecido por id (`ajustes.nomePorId`) e, quando a zona
reaparece com outro nome, muda `ajustes.delays[...]` e `zonasSemLeitura` de
nome com ela.

**Porque não se passou tudo a ser indexado por id:** o nome não é só a chave
dos ajustes — é o nome do objecto na cena (`delay-<nome>`), a chave do arrasto
e o que o `fazerZonas` procura. Mudar tudo isso era um refactor grande e com
muito por onde partir; o id a perseguir o nome dá o mesmo resultado numa
função só. Só se move para um nome livre: se já existir ajuste com o nome
novo, é de outra zona e não se lhe toca.

Sem id (projeto gravado antes disto, ou colado à mão) não corre nada — fica
tudo como sempre esteve.

Testado com Playwright: zona "Delay esquerda" arrumada com dx 2,5, renomeada
nos Calculadores para "Delay lateral A", novo sync — o ajuste segue o nome
novo. Um projeto colado à mão, sem ids, carrega as 3 zonas sem erros.

**v2.91 (fase 4): os textos passam a dizer a regra verdadeira.** Agora que
a regra é uma só — marcado numa aba dos Calculadores **e** sincronização
ligada = está no projeto = chega aqui — os avisos passam a dizê-la inteira.
O texto antigo do "Trazer projeto" prometia "ou qualquer outra com
Adicionar ao projeto" sem mencionar o sync, e era precisamente isso que
faltava a quem reportou este aviso com tudo marcado do outro lado.

O texto do painel vazio passa também a assumir o 3D em solo como caminho
legítimo, e não como um estado à espera dos Calculadores: *"podes montar
tudo aqui mesmo (+ Ecrã, + Delay, + DSM) e só ligar a sincronização quando
quiseres o equipamento certo"*. Confirmado por teste que os três botões
funcionam com o armazenamento das duas pontes vazio, sem um erro de
consola.

**v2.92: o depósito — o material fica à espera e monta-se peça a peça.**
Pedido direto: *"ter um depósito onde tudo o que vem do projeto da
calculadora fique, e vou retirando para montar o 3d"*, para não amontoar
peças na sala.

A regra que daqui sai, e que o resto do ficheiro respeita: **o 3D trabalha
sobre o projeto MONTADO; o projeto inteiro só existe para a lista do
depósito e para o retorno aos Calculadores** — que continua a mandar tudo,
senão o depósito apagava material do outro lado.

- `ajustes.noDeposito` guarda as chaves por montar (o `id` da zona, ou
  `"dsm"`). `receberProjeto()` decide o que é peça nova — id que nunca
  passou por aqui, lido do `ajustes.nomePorId` da fase 2 **antes** de o
  reconciliar — e só depois chama a reconciliação de nomes.
- **A migração é o que impede o susto:** `ajustes.depositoIniciado`. Na
  primeira vez que corre com um projeto já existente, marca tudo como
  montado. Um ficheiro gravado antes disto também abre com tudo montado.
- `montar()` e a Cobertura passam a usar `projetoMontado(projeto)`. As
  medidas saem só do que está na sala: se as peças do depósito contassem
  para a caixa envolvente, **uma peça invisível deslocava as visíveis** (o
  `contextoDeZonas` usa daí o esquerda/fundo/largura÷2) — e como as peças
  novas nascem à direita, seria logo à primeira.
- Secção **Depósito** com "Montar" por peça e "Montar tudo"; botão "↓"
  (recolher) em cada zona montada; e um contador junto ao resumo do
  projeto, porque material que chega e não aparece, sem nada a dizer
  porquê, é a maneira mais rápida de isto parecer avariado.

**Ficam de fora:** os projetores (um blend de 6 é uma grelha calculada, não
peças que se colocam uma a uma, e já têm interruptor próprio) e os
palcos/régies/passarelas extra (nascem aqui, não são material entregue).

**Nota honesta sobre o referencial:** montar uma peça nova continua a
re-centrar o conjunto, porque a caixa envolvente muda — é exatamente o que
já acontecia sempre que uma zona nova chegava dos Calculadores, não é novo.
A alternativa (contar também o que está no depósito) seria pior: peças
invisíveis a mexer nas visíveis. Recolher e voltar a montar é reversível e
determinístico — testado, a Cobertura volta ao número exato.

Testado com Playwright: projeto existente abre igual, com o depósito vazio
("Tudo montado"); subir de 2 para 4 TVs manda só as duas novas para o
depósito; montar uma põe-na na sala na posição que trazia; com peças no
depósito o Ecrã Complexo do outro lado continua com tudo; recolher uma zona
tira-a da Cobertura (223→219 confortáveis) e "Montar tudo" devolve o número
exato. Sem erros de consola.

**v2.93: o depósito passa a ser a porta por onde o material entra e sai.**
Pedido direto a seguir a ver a v2.92: *"se existir algo no 3d pode ser
removido ou adicionado, mas o melhor seria fazer a partir do depósito"*.

O "+ Ecrã", "+ Delay" e "+ DSM" mudaram-se da secção Zonas para o
Depósito, e a peça que criam **nasce lá**, não na sala — a sala passa a ter
só o que foi montado, venha de onde vier (dos Calculadores ou da mão). Cada
linha do depósito ganhou um 🗑, para deitar material fora sem ter de o
montar primeiro só para o poder apagar. O 🗑 de cada zona montada
mantém-se: tirar da sala continua a poder fazer-se lá, é só deixar de ser o
único sítio.

Testado com Playwright, do zero: criar ecrã + delay + DSM deixa a sala a 0
e os três no depósito; "Montar" põe um na sala; o 🗑 do depósito tira outro
do projeto sem passar pela sala; "Montar tudo" fecha a lista. Sem erros de
consola.

**v2.94: o depósito deixa de ser silencioso.** No dia a seguir a a v2.93
entrar, o relato foi *"deixaram de falar um com o outro agora"*. Não era
verdade — confirmou-se com um teste de ponta a ponta sobre os ficheiros
publicados: marcar TVs nos Calculadores escreve a ponte, o Preview lê-as, e
o Ecrã Complexo recebe tudo de volta, nos dois sentidos. O que mudou foi
outra coisa: com o depósito, o material **novo** deixou de entrar na sala
sozinho e passou a ficar à espera. Isso, visto de fora, é indistinguível de
a ponte ter partido.

O plano da v2.92 já tinha marcado isto como o risco número um da
funcionalidade — *"contador sempre visível quando o depósito não está
vazio... material que chega e não aparece, sem nada a dizer porquê"* — e foi
a parte que não se construiu. Constrói-se agora:

1. **Um contador no título da secção** (`DEPÓSITO ②`). Vai no `<h2>` de
   propósito: é a única parte da secção que continua à vista com ela
   dobrada (`#painel section.fechada > *:not(h2) { display: none }`).
2. **Um aviso no canto da sala**, com um botão que abre o depósito.

O aviso tem **elemento próprio** (`#avisoDeposito`), não o `#aviso` de
sempre. Essa foi a primeira tentativa e falhou no teste, por uma razão que
vale a pena ficar escrita: o `#aviso` é para mensagens de passagem, e há dez
sítios que lhe põem um `setTimeout` a apagá-lo ao fim de 2 a 7 segundos. O
aviso do depósito, escrito no fim do `montar()`, era logo substituído pelo
*"Os Calculadores mudaram o projeto — atualizei"* do `storage`, e
desaparecia com ele 2,6 s depois. Material à espera não é mensagem de
passagem: fica enquanto lá estiver.

Testado com Playwright, as duas apps servidas da mesma origem: sem material
à espera não aparece nada; com duas peças aparecem o contador e o aviso; o
contador continua visível com a secção dobrada; o botão do aviso abre o
depósito; "Montar tudo" apaga os dois. Sem erros de consola.

**v2.95: o depósito passa a ter interruptor.** *"PODIA LIGAR E DESLIGAR O
DEPOSITO"*. Uma caixa na própria secção — **"Parar aqui o material novo"** —
ligada por omissão.

Desligada, o material novo entra logo na sala: o que vem dos Calculadores e o
que nasce nos botões "+ Ecrã / + Delay / + DSM" (que nesse caso levam às
Zonas, não a uma lista onde a peça não está). É o comportamento anterior à
v2.92, de volta sem apagar nada do que se construiu desde então — a lista do
depósito continua lá para tirar peças da sala e voltar a montá-las.

Três decisões que vale a pena estarem escritas:

- **Desligar não monta o que já estava à espera.** Montar peças que alguém
  pôs de lado, sem as pedir, é mexer na sala pelas costas de quem as pôs lá.
  Ficam, e o contador e o aviso continuam a dizer que estão.
- **A bandeira é feitio de trabalhar, não conteúdo do projeto.** Sobrevive ao
  "Limpar tudo" e **não** vem do ficheiro em "Abrir projeto": é de quem está
  a abrir, não de quem gravou.
- **Ligado por omissão, lido num só sítio** (`depositoLigado()`). Quem nunca
  lhe tocou, e qualquer ficheiro gravado antes disto existir, comportam-se
  exactamente como antes.

O interruptor e a nota por baixo reescrevem-se a cada `montar()`, não só no
arranque: o "Limpar tudo" repõe todos os checkbox do painel pelo
`defaultChecked`, e sem isso a caixa dizia "ligado" com o depósito desligado
por baixo.

Testado com Playwright, seis passos: ligado, duas TVs novas ficam à espera e
a sala não mexe; desligar muda a nota e deixa as duas onde estavam;
desligado, duas TVs novas entram na sala (3 → 5) e o contador não sobe;
sobrevive a recarregar a página; religar volta a parar o material; e os
botões "+ Ecrã" e "+ DSM" criam no depósito com ele ligado e na sala com ele
desligado. Sem erros de consola.

**v2.96: dá para escrever nos campos de ajuste.** *"Nos campos de ajuste do
palco extra e passarela é difícil escrever os valores."* Medido antes de
mexer: escrever `12.5` na largura de um palco extra ficava em **`1`** — o
foco saltava para o `body` à primeira tecla e as outras três não iam para
lado nenhum.

A causa é velha e conhecida neste ficheiro: cada tecla dispara um `input`, o
`input` remonta a cena (120 ms de atraso), e o remontar reescreve a lista
inteira do painel — o campo onde se estava a escrever morre a meio. As listas
dos delays/DSM, dos gomos e das zonas tinham uma salvaguarda escrita à mão
(guardar o foco e repô-lo); as dos **palcos, régies, passarelas e projetores
extra** nasceram sem ela.

**Mas a salvaguarda antiga também não chegava**, e isto é o que interessa
ficar escrito: repor o texto num `<input type="number">` não aguenta um
decimal a meio de ser escrito. O navegador rejeita `"12."` como valor, o
ponto desaparece, e `12.5` sai `125`. Na lista das **zonas** isso era um ecrã
de 12,5 m a virar 125 m, calado. Reproduzido tecla a tecla, não suposto.

Por isso a regra passou a ser outra, e única para as seis listas: **uma lista
onde alguém está a escrever não se reconstrói** (`aEscreverNaLista()`). A
cena continua a atualizar-se a cada tecla — isso é outra parte do `montar()`
— e o resumo por cima da lista também; só as linhas é que esperam que se saia
do campo. Não havendo reconstrução, não há valor para repor, e o problema do
decimal desaparece pela raiz.

Testado com Playwright, tecla a tecla com 400 ms entre teclas (mais do que os
120 ms do atraso, para o remontar disparar mesmo a meio):

- `12.5` num palco extra: antes `1`, agora `12.5`.
- `12.5` na largura de uma zona: antes `125`, agora `12.5`.
- Depois de sair do campo a lista volta a reconstruir-se: remover uma zona
  (3 → 2) e remover um palco extra (1 → 0) continuam a funcionar, e o valor
  escrito fica guardado (`6.75` em `ajustes.palcosExtra[0].profundidade`).
- Os botões `+`/`−` continuam a andar de passo em passo.

Sem erros de consola.

**v2.97: os palcos arredondam — e isso chega para um palco redondo.** *"Os
palcos podem arredondar, já era meio caminho para um palco redondo."* É o
caminho todo, e com um só número: **"Arredondar cantos"**, em metros, no
palco principal e em cada palco extra.

O raio limita-se sozinho a metade do lado mais curto, e é isso que faz um
campo servir para tudo:

| Palco | Raio | Fica |
|---|---|---|
| 16 × 6 m | 0 | cantos vivos, como sempre |
| 16 × 6 m | 1,5 | cantos suaves |
| 14 × 7 m | 3,5 (o máximo) | pontas em meia-lua |
| 8 × 8 m | 4 (o máximo) | **redondo** |

Não há "tipo de palco" nenhum a escolher: é o mesmo campo do princípio ao
fim.

**Raio 0 devolve a `BoxGeometry` de sempre**, não uma curva de raio zero. Não
é preguiça: é para um projeto antigo continuar a ter exactamente o mesmo
palco, vértice por vértice, no que sai para `.glb` e `.obj` (24 vértices, os
mesmos de antes; com raio passa a `ExtrudeGeometry`, ~600 — verificado).

**É só o desenho.** As contas de ecrã, ângulos e cobertura continuam a usar a
medida cheia do palco — está dito no tooltip do campo, porque a diferença
entre "parece redondo" e "conta como redondo" é o género de coisa que morde
em obra. Se um dia a plateia tiver de contornar a curva, é outro trabalho.

Um palco extra **herda o raio do principal** quando nasce: quem pôs o palco
redondo quer quase sempre o segundo a condizer, e pôr a zero é uma tecla.

Testado com Playwright, medindo a geometria real na cena: os cinco casos da
tabela; o raio a limitar-se sozinho (pedir 30 num palco de 6 m de fundo dá o
mesmo que pedir 3); a caixa envolvente nunca cresce nem desloca o palco
(16 × 1 × 6 e centro em y=0 em todos); e o valor sobrevive a "Guardar
projeto" → "Abrir projeto", tanto no principal como no extra. Sem erros de
consola.

Nota do que **não** mudou: os campos do palco continuam a não sobreviver a um
simples recarregar da página — nem a largura, nem a profundidade, nem o raio.
É como já era para todos eles (só o ficheiro de projeto os guarda), e não se
mexeu nisso aqui.

**v2.98: a curva fecha mesmo, e há um botão para o círculo.** *"Deve fechar
mais a curva."* Tinha razão, e a v2.97 estava incompleta: o raio limitava-se a
metade do **lado mais curto**, o que num palco de 14 × 7 m parava num
"estádio" — pontas em meia-lua, lados compridos a direito — e **não havia
número nenhum que o fechasse**. Só um palco quadrado é que chegava a redondo.

O limite passa a ser **por eixo** (`rx = min(raio, largura/2)`,
`ry = min(raio, profundidade/2)`):

| Palco | Raio | Fica |
|---|---|---|
| 14 × 7 m | 3,5 | estádio — exactamente como na v2.97 |
| 14 × 7 m | 7 | **elipse**, fechada nos dois eixos |
| 14 × 14 m | 7 | círculo |

Abaixo de metade do lado mais curto `rx` e `ry` são iguais, ou seja **nada
muda** para quem já tinha um palco arredondado. Os cantos passaram de 12 para
24 segmentos: com o raio no máximo os quatro cantos são a forma toda, e é aí
que uma curva facetada se nota.

E depois: *"fazer um círculo"*. Um círculo precisa dos dois lados iguais, e
era essa a parte chata à mão — escrever a profundidade, conferir a largura,
calcular metade para o raio. Passa a haver **"⭘ Fazer um círculo"** na secção
Palco, e um **⭘** em cada linha de palco extra: põem a profundidade igual à
largura e o arredondamento no máximo.

O diâmetro é a **largura** que já lá está, não a profundidade nem uma média: a
largura é a medida com que se pensa um palco ("um palco de 16") e é a que
manda no que se vê da plateia. Se deixar de caber, o aviso de sempre diz-o —
não se encolhe o palco pelas costas de quem o pediu.

Testado com Playwright, medindo a geometria na cena e conferindo de cima: 14 ×
7 com raio 3,5 continua estádio; com raio 7 fecha em elipse; pedir 99 dá o
mesmo que pedir o máximo (limita-se por eixo); o botão num palco de 12 × 5
deixa 12 × 12 com raio 6, e o ⭘ de um palco extra de 16 × 6 deixa 16 × 16 com
raio 8, tanto no estado guardado como nos campos da lista. A caixa envolvente
continua a não crescer nem a deslocar o palco. Sem erros de consola.

**v2.99: um "?" em cada secção, e nomes que se percebem.** *"Está a ficar bem
grande o 3D. Podes colocar nas abas de ajuste um help como temos nas
calculadoras, para explicar como e o que faz cada função — até eu me perco já.
E simplifica os nomes das funções para que sejam mais intuitivos."*

**O "?"** é o mesmo padrão do "Como usar esta calculadora" dos Calculadores
(`<details>` fechado por omissão, bolinha "?" no sumário), agora em **todas as
15 secções** do painel.

O que importa é que isto **não engordou o painel — encurtou-o**. As
explicações que já existiam estavam soltas por baixo dos campos, sempre
abertas; mudaram-se para dentro do "?". Medido, com todas as secções abertas e
as ajudas fechadas: **6652 px → 6313 px**. O problema era ter de percorrer
texto que já se sabe de cor, não falta de texto.

As notas com `id` (`notaEcra`, `notaProj`, `notaConteudo`, `infoPlanta`,
`notaGomos`, `depositoNota`, `notaExportar`…) **não se mexeram**: o JS escreve
nelas conforme o estado, e movê-las partia isso. Só saíram as que não tinham
id — verificado uma a uma antes de mexer.

**Os nomes:**

| Antes | Agora | Porquê |
|---|---|---|
| Ajustar o ecrã | **Tamanho do ecrã** | é o que a secção faz: dois campos, largura e altura |
| Zonas | **Ecrãs na sala** | "zona" é palavra da calculadora, não do terreno — e distingue do Depósito |
| Posições (delays e DSM) | **Onde ficam os delays e o DSM** | diz a função, não a categoria |
| Distância à tela | **Distância ao ecrã** | a app diz "ecrã" em todo o lado menos aqui |
| Lente ao lado do eixo | **Lente fora do eixo ↔** | "ao lado do eixo" lia-se como "junto ao eixo" |
| Largura deles | **Largura do corredor** | "deles" obrigava a olhar para a linha de cima |
| Só cor | **Sem imagem** | dizia o resultado, não a acção |
| Espalhada / Uma em cada | **Uma imagem por todos** / **A mesma em cada** | as duas diziam "uma"; nenhuma dizia de quê |

E uma incoerência que só se vê a usar: a posição no eixo do fundo chamava-se
**"↕"** nas listas de palcos/régies/passarelas extra e **"profundidade"** na
dos delays, dos DSM e dos gomos — duas palavras para a mesma coisa. Pior: nos
palcos e régies, "profundidade" já era o **tamanho**, logo ao lado. Passa a ser
**"fundo"** em todo o lado, e "profundidade" fica a querer dizer tamanho e mais
nada. A seta `↔` mantém-se, que essa não é ambígua.

**Um defeito antigo apanhado pelo caminho:** com a secção **Projeto** dobrada,
os rótulos "Nome do projeto" e "Foto ou render do evento" ficavam à vista,
sozinhos, sem o campo a que pertencem. Tinham `display:block` no atributo
`style`, e um estilo inline ganha sempre à folha de estilos — a regra que
esconde o conteúdo de uma secção dobrada não lhes chegava. Passaram a usar uma
classe.

Testado com Playwright: as 15 secções têm ajuda e **nenhuma abre por omissão**;
a altura antes/depois; com todas as secções dobradas não sobra nada visível
além dos títulos (zero fugas); os campos das linhas mostram `↔ | fundo |
altura | rodar | tilt` nos delays e `… | ↔ | fundo | rodar` nos palcos extra;
escrever `-4.5` no campo "fundo" continua a dar `-4.5` (a correcção da v2.96
não se perdeu); o interruptor do depósito e o botão do círculo continuam lá.
Sem erros de consola.

## 12 de setembro — a cúpula no 3D (v3.02)

Pedido, a seguir à calculadora de dome ficar feita nos Calculadores: *"como
adiciono para poder ver no 3D"*. Não se adicionava — a palavra "dome" não
existia em sítio nenhum deste repositório nem da ponte.

**`fazerDome()` em `js/cena.js`.** Uma calota esférica, não meia esfera: um
dome de evento é muitas vezes mais (ou menos) do que metade. De um diâmetro
de base D e uma altura h sai `R = (a² + h²)/2h`, o centro da esfera fica a
`y = h − R`, e a calota vai do zénite até `cos(θmax) = (R − h)/R`. Numa
meia-esfera isso dá 90°, como tem de ser.

**Translúcida por omissão, com grelha**, e um interruptor "Cúpula fechada"
para quem quer a imagem bonita. A razão é a de sempre neste Preview: as
perguntas aqui são *cabe?*, *vê-se?*, *quem tapa o quê?* — e uma casca opaca
tapa o público, os ecrãs e o palco a partir de metade dos ângulos. A grelha
existe porque uma casca a 10% de opacidade sem arestas é uma névoa sem
silhueta. O anel da base fica sempre visível: é a pegada no chão, e é por ela
que se vê se cabe na sala.

Os dois interruptores (`verDome`, `domeSolido`) só aparecem quando o projeto
traz uma cúpula, guardam-se no ficheiro do projeto, e a grelha e o anel vão
com prefixo `aux:` para não sujarem os exports (a casca exporta como "dome").

**O que estava a bloquear, e não era o desenho.** O leitor de projetos
rejeitava qualquer carga sem zonas — em DOIS sítios, e `projetoGuardado()`
engole a excepção, por isso o sintoma era "não aparece nada", sem uma linha
de aviso. Uma cúpula sozinha (ou um DSM sozinho) passou a ser um projeto
legítimo. O `dome` também tinha de ser acrescentado à lista fechada de campos
que `lerProjeto()` devolve, senão vinha na carga e era descartado ali.

**Verificado medindo a cena, não pixéis:** um dome de 12 m de base × 9 m de
altura dá pegada no chão de 12,00 m, topo a 9,00 m, base assente no chão, e
barriga de 13,00 m à altura do equador da esfera — que está certo, porque uma
calota mais alta do que meia esfera é mais larga a meia altura do que na
base. Ligar "fechada" tira a grelha; desligar "Cúpula" tira tudo. Sem erros
de consola.

**Fica por fazer:** a cúpula nasce centrada na sala e não se mexe. Um dome de
evento é normalmente a sala toda, por isso o centro é um bom sítio por
omissão — mas faltam-lhe `dx`/`dz` como os palcos extra têm, para quem a
queira encostada a um lado. E os projetores em anel não estão desenhados: a
aba Dome diz quantos são, o 3D ainda não mostra onde ficam.

## 12 de setembro — os palcos extra

### ~~Meia-lua para encostar~~ — FEITO (v3.01)

*"Queria arredondar e encostar ao outro como continuidade; para isso deveria
ser apenas meio palco, pois senão ao arrumar passa para trás do outro."* E
está certo: um círculo de diâmetro igual à largura tem metade do corpo atrás
da linha onde se quer encostar.

Botão `⌒` ao lado do `⭘`: põe a profundidade em metade da largura e o raio
no máximo, o que dá o semicírculo exacto. Há também um interruptor **"só a
frente arredondada"**, para quem arredondou à mão e só quer a traseira reta
sem repor medidas.

A traseira aponta para o fundo da sala (o lado do palco principal); para a
virar, usa-se o campo `rodar`. Os cantos da meia-lua são arcos de elipse a
sério (`absellipse`) e não curvas quadráticas — duas quadráticas de ponta a
ponta fazem uma forma de lente, com bicos nos lados, e isso nota-se quando a
curva é a peça toda. O arredondar dos quatro cantos ficou como estava, para
não mudar uma forma já aprovada.

### ~~O boneco não vai ao segundo palco~~ — FEITO (v3.01)

Não se resolvia com limites, como se tinha resolvido a passarela. O arrasto
do orador sempre trabalhou sobre um **plano horizontal à altura dele** — e
com um palco extra mais alto o raio atravessava o tampo e ia bater no plano
lá atrás: a figura ia para TRÁS em vez de para cima. Visto a testar:
arrastar para cima de uma peça de 2,5 m mandava a figura para `z = −6,33`.

Passou a tocar nas peças a sério (raycast contra os tampos do palco, da
passarela e dos palcos extra), e a figura fica no ponto e à altura do que
está debaixo do apontador. Só faces viradas para cima contam — apontar a
parede da frente de um palco punha a figura colada a meia altura dela. O
plano antigo continua a servir de recurso para quando o rato sai para o chão
ou para fora da borda, que é o que trata de a prender ao palco.

Efeito colateral aceite: a figura pode agora encostar-se à borda do tampo,
onde antes havia uma margem de 0,4 m. Aponta-se e ela vai — e "de onde é que
ela tapa o ecrã" é justamente uma pergunta de borda.

Falta, se algum dia incomodar: no caminho do *desenho*
(`alturaDePalcoExtraEm`, usada quando não há apontador nenhum) a pegada de
uma peça em meia-lua é testada como retângulo, por isso a figura pode ficar
num canto que é ar. São centímetros, e a figura é uma referência de escala,
não uma medida.

### ~~Painel dos extras com os nomes colados~~ — FEITO (v3.00)

Reportado com foto: *"os nomes aqui estão estranhos"*. E não estavam — era o
layout. A regra de CSS da grelha dos campos numéricos estava presa a
`#listaAjustes` e `#listaGomos`, e as listas dos **palcos, régies, passarelas
e projetores extra** usam o mesmo `campoAjuste()` mas nasceram sem regra
nenhuma: ficavam a `display: inline`, cada botão numa linha, e a unidade em
itálico colava-se ao nome do campo seguinte — saía "mprofundidade",
"marredondar", "mfundo", "mrodar".

Corrigido na raiz: a regra passou para a própria classe `.ajuste-campo`, para
nenhuma lista nova voltar a nascer sem ela. O nome de cada campo passou a um
`<span class="ajuste-rotulo">` (um nó de texto solto é um item anónimo da
grelha, e itens anónimos não se conseguem colocar por CSS) e vai numa linha
própria, com `− valor + calculadora unidade` em baixo. O botão da
calculadora também ganhou lugar: sem ele, caía numa linha implícita e
aparecia sozinho debaixo do campo.

## PENDENTE deste lado (noite de 11 de setembro)

A lista completa do que ficou pendurado nos dois repositórios está no
`PARA-CONTINUAR.md` do **calculadores**, secção "PENDENTE — retomar aqui".
Do lado do Preview, o que lá está e toca a esta pasta:

- **Limpeza de branches.** 69 branches locais já incorporadas em `main`, mas
  só **2** existem no `origin` — as outras só existem nesta pasta. Ficou
  combinado confirmar branch a branch antes de apagar, e só depois apagar.
- **Os nomes novos da v2.99** ("Tamanho do ecrã", "Ecrãs na sala", "Onde
  ficam os delays e o DSM", "fundo" em vez de "↕"/"profundidade" para a
  posição). Se algum não soar bem a usar, é uma linha a mudar.
- **Uma ideia do mike**, por contar e analisar.

## Coisas que se decidiram e não se voltam a discutir

- **O Preview não ganha catálogos.** Nem de LED, nem de projetores, nem de
  lentes. Ver a regra no `.github/copilot-instructions.md`.
- **O motor 3D vive no `vendor/`**, não num CDN: isto usa-se onde não há rede.
- **Os motores pesados (DWG, PDF) não entram no arranque** — só se descarregam
  quando alguém abre um ficheiro desses.
- **A latência do direto e o genlock não são deste projeto.** Isto é um preview
  de montagem: responde a *cabe?*, *vê-se?*, *quem tapa o quê?*.
