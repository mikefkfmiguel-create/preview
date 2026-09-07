# Preview — o projeto no terreno

Pega num projeto feito nos **Calculadores** e mostra-o montado numa sala: os
ecrãs à escala, o palco, o público, e a vista de quem está sentado na plateia.

Serve para responder a perguntas que uma folha de cálculo não responde: *aquilo
cabe?*, *fica alto de mais?*, *quem está na terceira fila vê o ecrã todo ou vê a
nuca do da frente?*

## Como se usa

1. Nos Calculadores, monta as zonas de LED como costumas.
2. Carrega em **Ver em 3D** — abre este preview já com o projeto lá dentro.
3. Escreve as medidas da sala e do palco, e a plateia: filas, corredores e
   quanto o chão sobe por fila.
4. Anda à volta com o rato, ou usa as vistas: **Frente**, **Lado**, **Cima**,
   **Olhos da plateia**.
5. Esconde o painel no **‹** (ou com a tecla **Tab**) para a cena ficar inteira
   — é assim que isto se mostra a alguém.

Cada secção do painel **fecha no título**, e fica fechada da próxima vez: são
demasiadas para estarem todas abertas, e quem está a mexer na plateia não quer
a projeção aberta pelo meio.

O painel é **elástico**: arrasta-se a borda direita para o alargar (240 a
900 px), e dois cliques nela põem-no como estava. A largura fica guardada,
porque é uma preferência de quem trabalha e não do desenho — com trinta camadas
de um DWG na lista, 320 px deixam de chegar e um nome cortado com reticências
não serve para escolher a camada que se vai levantar.

Cada vista serve uma pergunta diferente, por isso tudo o que está na cena liga e
desliga: **ecrãs**, **planta**, **palco**, **público**, **régie**, **orador**,
**paredes e tecto**, e as **medidas**. Sem paredes vê-se a sala de fora, sem
público vê-se a estrutura, sem ninguém no palco mede-se o ecrã sem nada a
tapá-lo, e sem ecrãs acerta-se a planta que está por baixo.

**Instala-se como app**, e depois disso abre sem internet: o botão está no fim
do painel, e em iPhone diz-se lá como se faz à mão.

Também dá para **escrever o tamanho à mão** na caixa do Projeto: `6 x 3 m`,
`4,96 por 2,79`, `3 ecrãs de 3,90 × 2,19 m` — ou colar o texto que os
Calculadores copiam, ou o JSON das zonas. Procura-se o par de medidas e quantos
ecrãs são; o resto do texto é ignorado de propósito, que isto é um atalho para
ver e não um interpretador. Quando não encontra medidas credíveis não desenha
nada e diz porquê — um `1920 x 1080` é uma resolução, não uma parede de 1,9 km.

E há **Limpar tudo**, na secção Projeto: deita fora o projeto, a planta e o
conteúdo, e põe todas as medidas no princípio — para a sala a seguir se começar
numa folha em branco e não por baixo dos restos da anterior. Limpa também o que
ficou guardado do lado dos Calculadores, senão o projeto voltava sozinho no
arranque seguinte. O que fica é só como o painel está arrumado: as secções
abertas são a maneira de trabalhar de quem está a usar isto, não são o projeto.

## O que ele espera receber

O preview **não sabe nada de tiles, pitch ou catálogos** — e é de propósito.
Quem sabe isso são os Calculadores, e são eles que mandam as zonas **já em
metros**. Assim, o dia em que lá entrar um modelo de LED novo não obriga a mexer
aqui, e nunca há dois sítios a discordar sobre o tamanho da mesma parede.

```json
{
  "v": 1,
  "nome": "Palco com duas alas",
  "sala": { "largura": 20, "profundidade": 14, "altura": 7 },
  "zonas": [
    {
      "nome": "Principal",
      "x": 3.5, "y": 0,
      "w": 8.0, "h": 4.5,
      "cor": "#2E7BFF",
      "curva": { "modo": "angulo", "valor": 0, "dir": "convexo" },
      "tiles": { "x": 16, "y": 9 },
      "res":   { "x": 2048, "y": 1152 },
      "peso": 864, "amp": 82
    }
  ]
}
```

- `x` e `y` são **metros a partir do canto superior esquerdo do conjunto**, como
  no diagrama dos Calculadores — o `y` cresce para baixo.
- `w` e `h` são as medidas da zona, em metros. **São obrigatórias**: uma zona sem
  elas fica de fora, e o preview diz quais ficaram.
- `sala`, `curva`, `tiles`, `res`, `peso` e `amp` são opcionais.

Pelo endereço, vai em `#p=` seguido do JSON em base64.

## Os motores pesados só se carregam quando fazem falta

O motor de DWG são 10 MB de WebAssembly (1,6 MB à saída do servidor, que os
comprime) e o de PDF quase 2 MB. Ficam de fora da lista do service worker **de
propósito**: descarregam-se na primeira vez que alguém abrir um ficheiro desses,
e a partir daí ficam em cache pelo mesmo caminho que tudo o resto — offline
incluído. Quem nunca abre um DWG nunca os descarrega, e a app continua a
arrancar com 1,5 MB.

## Licenças de quem vive no `vendor/`

- **Three.js** — MIT.
- **pdf.js** (Mozilla) — Apache-2.0.
- **libredwg** — **GPL-3.0**. É copyleft: este repositório distribui o código,
  como a licença pede, e quem o receber tem o direito de o modificar e
  redistribuir. A cópia da licença está em `vendor/dwg/`. Se um dia isto fosse
  para vender fechado, era este ficheiro que tinha de sair primeiro.

## Porque é que o Three.js está dentro do repositório

Isto usa-se em salas e pavilhões, muitas vezes sem rede. Uma aplicação 3D que
vai buscar o motor a um CDN é uma aplicação que falha exatamente no sítio onde
faz falta. Por isso o `vendor/` tem lá o `three.module.js` e os controlos, e a
app abre sem internet nenhuma.

## Correr a partir de uma pasta, sem servidor

**Dois cliques no `index.html` não chegam.** A app é feita de módulos de
JavaScript e nenhum browser os deixa carregar a partir de `file://` — fica um
ecrã preto e ninguém diz porquê. Por isso a pasta traz um atalho:

- **Windows** — `ABRIR-PREVIEW.bat`
- **macOS** — `ABRIR-PREVIEW.command` (à primeira, `chmod +x`)

Procuram o Chrome (e o Edge, se não houver Chrome) e abrem a app em janela
limpa, sem separadores nem barra de endereço. Fazem duas coisas que não são
óbvias e sem as quais isto não funciona: passam `--allow-file-access-from-files`,
que é o que levanta a restrição dos módulos, e usam um `--user-data-dir`
próprio — porque um Chrome já aberto reaproveita o processo que lá está e
ignora as bandeiras que se lhe mandam.

Para desenvolver, continua a ser mais simples servir a pasta:

```
python -m http.server 8123
```

e abrir `http://127.0.0.1:8123`.

## Instalar como app

No **Chrome** ou no **Edge** aparece o botão *Instalar esta app* no fim do
painel, e depois disso ela abre em janela própria e sem internet nenhuma (está
tudo no cache do service worker: o motor 3D, os exportadores, os ícones).

O **Firefox** e o **Safari de computador** não instalam aplicações — não é um
defeito desta app, é o que esses browsers fazem. Nesse caso o painel diz isso e
dá um botão para copiar o link, em vez de mandar quem lá está procurar um menu
que não existe. No **iPhone**, é *Partilhar* → *Adicionar ao Ecrã Principal*.

## A planta da sala — imagem ou DXF

O mesmo botão abre as duas, e a diferença entre elas é só uma: quem sabe a
escala.

**Um DXF sabe.** Traz as coordenadas em unidades de desenho e traz, no
cabeçalho, quais são essas unidades — por isso entra à escala e não se calibra
nada. Leem-se linhas, polilinhas (com as curvas dos *bulges*), arcos, círculos e
os blocos inseridos, que é onde vive quase toda a mobília de uma planta de
arquitectura. Quando o ficheiro vem "sem unidades" — que é o que muito
exportador escreve — a escala **adivinha-se pelo tamanho** e diz-se no painel
que foi adivinhada; há um menu para a corrigir. Tem de ser DXF **ASCII**: o
binário dá erro e diz-se porquê.

**Um DWG também sabe**, e entra sem se converter à mão: a app traz o
**libredwg** compilado para WebAssembly, converte o DWG a DXF ali mesmo e daí
para a frente é tudo igual. Reconhece-o pelos primeiros bytes e não só pela
extensão, por isso apanha também um DWG a que alguém trocou o nome para `.dxf`.
Lê os formatos correntes (testado com AutoCAD 2000 e 2018); quando um ficheiro
lhe escapar, diz-o e o caminho continua a ser guardá-lo como DXF no CAD.

**Um PDF e uma imagem não sabem**, e não há como adivinhar. O PDF é desenhado a
2400 px de lado maior — a régua com que se calibra é o que lá está escrito, e
num desenho esborratado não se lê a barra de escala. Usa a primeira página, e
diz quantas tem. Por isso pede-se uma medida
conhecida — a largura real que a planta cobre — e o resto sai daí, mantendo a
proporção. A grelha do chão é de metro a metro: se a planta trouxer uma barra de
escala, é aí que se confere.

Nas duas, o que sobra para mexer é onde ela fica — rodar e deslocar — porque o
zero do CAD raramente é o meio da sala.

### Camadas, e paredes levantadas

Um DWG de arquitectura traz tudo na mesma folha: paredes, cadeiras, tracejados,
cotas, texto. Deitado no chão aquilo é um tapete de linhas onde não se percebe o
que é parede. As camadas já vinham no ficheiro — faltava dar-lhes um
interruptor, e agora cada uma tem dois: **ver** e **levantar**.

Levantar transforma cada segmento daquela camada num pano vertical até à altura
pedida: é assim que uma planta 2D vira uma sala. Levantam-se as paredes, não as
cadeiras — senão o que aparece é um bosque de panos. As paredes levantadas são
translúcidas de propósito: opacas, tapavam exactamente o que deviam ajudar a
ver.

E **"Usar as medidas da planta"** põe a sala do tamanho do que está desenhado
(só o que está visível: as camadas escondidas não contam). Sem isso, uma planta
de um centro de congressos ao lado de uma sala de 24 × 18 m por omissão parece
uma escala errada, quando o que está errado são as medidas da sala.

O que se lê é a **planta**: o X e o Y. Um DWG com geometria 3D a sério — sólidos,
paredes extrudidas no próprio ficheiro — chega cá achatado, e é daí que vem o
"levantar" como alternativa.

## A plateia

O público não é enfeite: é ele que responde à pergunta difícil. Dá para dizer
quantas filas, quantos corredores e de que largura, e **quanto o chão sobe por
fila** — sem essa subida a cabeça da frente fica exactamente à altura dos teus
olhos, e a vista da plateia mostra uma nuca em vez de um ecrã.

A app conta os lugares que couberam e avisa quando as filas pedidas não cabem
na sala. Pedir 12 e receber 6 sem ninguém dizer nada é a maneira certa de levar
um número errado para uma reunião.

**Sentados**, cada pessoa é uma cadeira escura com ombros e cabeça por cima — a
cor da cadeira separada da da roupa, senão o conjunto lê-se como uma coluna.
**De pé**, é a mesma figura do orador, repetida: pernas, braços e ombros, e sem
cadeira nenhuma. Uma cápsula com uma bola em cima não é uma pessoa, e um público
que se lê mal engana sobre tudo o que está ao lado dele.

A distância da plateia às paredes — dos dois lados e ao fundo — usa a **mesma
largura dos corredores**: é a mesma pergunta ("que folga entre filas de
cadeiras?") respondida uma vez só, e não um metro fixo à parte. Só a frente
tem resposta própria, porque essa é a distância ao palco ("primeira fila a"),
não uma folga de corredor.

### A régie

Um rectângulo reservado a quem opera som, luz e vídeo — não é lugar de
plateia. Tem sempre **pelo menos 2 × 2 m** (o mínimo aplica-se mesmo que se
tente menos), mas cresce, desloca-se e **roda** pelos campos, como o palco —
rodar serve para a encostar a uma parede lateral em vez de a deixar sempre de
frente para o palco. Uma mesa marca o lado virado para o palco (e roda com o
resto), e o rectângulo fica visível no chão para se perceber logo que ali não
há cadeiras.

Quem cairia num lugar dentro da régie fica sem cadeira — é um vão na plateia,
contado a menos nos lugares totais, não uma pessoa sentada por cima de uma
mesa de mistura. Isto testa-se já com a régie rodada: o rectângulo entra no
seu próprio referencial antes de se perguntar "cai cá dentro?", por isso o
vão acompanha a rotação e não fica preso ao eixo original. E é um interruptor
a sério — desligar a régie devolve os lugares todos à plateia, não é só
esconder o desenho da mesa.

Num auditório a subir, a régie sobe com a plateia: fica à altura do degrau
onde a sua profundidade cai, e não no nível do chão como se estivesse sempre
na primeira fila.

## As duas apps falam sozinhas

O Preview e os Calculadores vivem no mesmo domínio, por isso partilham o
`localStorage` — e é esse o canal, sem servidor nenhum pelo meio:

- os **Calculadores** guardam o projeto (já em metros) sempre que as zonas
  mudam. Abrir o Preview sozinho já mostra o projeto em que se andava a
  trabalhar, sem carregar em nada;
- com os dois abertos em abas lado a lado, mexer nas zonas **atualiza o Preview
  ao vivo** — o browser avisa a outra aba;
- o **Preview** guarda a sala (medidas, palco, plateia e se é pavilhão ou
  auditório), e o Assistente de Projeto vai lá buscá-la no botão
  *"Trazer sala do Preview"*;
- na aba **Distância de Projeção** dos Calculadores, o botão *"Ver no Preview
  3D"* manda o **projetor**: rácio, distância e tamanho da imagem, já calculados.
  O catálogo de projetores e de lentes fica do lado de lá, pela mesma razão por
  que as tabelas de LED também ficam.

O botão *"Ver em 3D"* continua a existir e leva o projeto no próprio endereço —
serve para abrir noutro computador ou mandar a alguém. E como a janela do
Preview tem nome, as três pontes (zonas, projetor, sugestão) vão todas para a
**mesma** janela em vez de abrirem um separador por clique.

### O briefing lê-se com a IA

A caixa do Projeto entende medidas, não entende um email. Para isso há
**"Analisar com a IA"**: manda o texto ao mesmo Worker que o assistente dos
Calculadores usa, e aplica o que vier — o tamanho do ecrã, e a sala (largura da
plateia, distância ao último espectador, pé-direito).

**Sem medidas no pedido, desenha na mesma.** Um pedido que fala de quatro ecrãs
merece ver quatro ecrãs: contam-se pelo resumo da IA (que já soma o que o texto
espalha por duas frases) e desenham-se com um tamanho tirado da profundidade da
sala. Diz-se, com todas as letras, que é **um ponto de partida** — para ninguém
o levar a uma reunião como se fosse uma proposta.

E o que a IA percebeu fica escrito **no painel**, não num aviso que se apaga: o
resumo dela, o que foi aplicado, e a lista do que ela diz faltar (*qual a
tecnologia?*, *quais as dimensões da sala?*). Num pedido vago, essa lista vale
mais do que o desenho — é o que há a perguntar a quem pediu. A primeira versão
deitava-a fora.

O endereço do Worker vem do `localStorage` que os Calculadores já escrevem:
**configura-se uma vez, lá, e serve os dois**. Isto não duplica a conta deles —
as tabelas de LED, de projetores e de lentes continuam todas do lado de lá. O
que atravessa é um texto e umas medidas.

A primeira versão fazia outra coisa: mandava o texto para os Calculadores e
deixava-os analisar. Não funcionou, e a razão vale a pena ficar escrita — a app
do mike está **instalada**, e uma janela de aplicação não se alcança com um
`window.open` com nome. O texto chegava ao `localStorage` e ficava lá à espera
de uma janela que nunca era a certa.

À sala vinda da IA juntam-se folgas, e o aviso diz o que foi lido: 2 m de cada
lado da plateia e 3 m atrás da última fila, porque a distância ao último
espectador não é a parede.

## Conteúdo nos ecrãs

Um padrão de teste, ou uma imagem tua, de duas maneiras:

- **Espalhada** — uma imagem só pelo conjunto todo, cada zona mostra o seu
  bocado, como o media server faz. É assim que se vê se as juntas caem onde
  devem e se alguma zona está trocada;
- **Uma em cada** — a imagem inteira repetida em cada zona, para quando os ecrãs
  mostram conteúdos independentes.

E o desenho sai em PNG na secção **Exportar** (ver mais abaixo): **PNG da vista**
é o que está no ecrã, tal e qual, para entrar num slide ou num email; **PNG com
medidas** leva as etiquetas e uma tira com as contas em baixo, para mandar a
quem tem de decidir — um printscreen perde isso, e é metade do que ali
interessa. Os dois saem na resolução do canvas e sem o painel.

## Projeção

Escreve-se o rácio do projetor e a distância à tela; o **tamanho da imagem
calcula-se** — 1,4 a 12 metros dá 8,57 m de largura.

Onde a imagem cai também não se escreve: sai da **lente e do shift dela**. O
shift conta-se em percentagem da imagem, como nas fichas das lentes — +100%
vertical põe a imagem toda acima do eixo — e a base da imagem aparece no resumo.
Foi por isto que a "base da imagem" deixou de ser um campo: escrita à mão, o
desenho mostrava imagens que nenhuma lente conseguia pôr ali.

E quando o projetor vem dos Calculadores, vêm com ele **os limites de shift da
lente**, quando o fabricante os publica: pedir +80% a uma lente que faz ±58%
passa a dar aviso. Quando o fabricante não os publica, não se inventa nenhum —
diz-se que ninguém está a verificar. Hoje quem os publica por lente é a Epson;
a Sony e a Barco não deixam ler as páginas por meios automáticos, e a Panasonic,
a Christie e a NEC publicam o shift no **corpo do projetor** e não na lente.

E responde à pergunta que uma folha de cálculo não responde: **quem é que tapa a
imagem**. A sombra **desenha-se na imagem** — não é só uma percentagem no
resumo: quer-se saber se aquilo apanha a cara de quem está a falar, e isso
responde-se a olhar. O orador arrasta-se pelo palco e a mancha acompanha; **a
plateia também faz sombra**, e o resumo diz quantas pessoas estão no feixe. É a
diferença entre pendurar a máquina uma vez ou duas: baixa-se a lente e vê-se as
cabeças a entrar na imagem.

A sombra é calculada e não amostrada. A primeira versão atirava 45 raios para a
tela e contava os que batiam no orador — e dava sempre zero, porque os pontos
ficavam a quase um metro uns dos outros e uma pessoa tem 58 cm: passava entre as
amostras. Passou então a projectar-se a caixa que envolve cada corpo, que é
exacto para um. Com a plateia toda, somar caixa a caixa contaria duas vezes as
que se sobrepõem — e numa sala cheia sobrepõem-se quase todas, o que daria
sombras de 300%. Por isso a imagem parte-se numa grelha de 128 × 72 e conta-se
quantas casas ficam tapadas por alguém: a sobreposição resolve-se sozinha, e
medir custa 0,2 ms mesmo com 700 pessoas na sala.

## Exportar para onde se faz a imagem a sério

**Escolhe-se o que sai e só depois se guarda.** São quatro saídas e duas opções
que só valem para duas delas; com um botão por formato, carregava-se no errado e
ia-se buscar o ficheiro à pasta das descargas para perceber que não era aquele.

- **PNG da vista** — o que está no ecrã, tal e qual;
- **PNG com medidas** — o mesmo, com as etiquetas e a tira das contas.

Para o resto: isto desenha volumes e cores, e serve para responder a *cabe?* e
*vê-se?*. Quem faz a imagem bonita trabalha noutro sítio, e a ponte é um
ficheiro:

- **`.glb` (glTF)** — é o que se usa. Leva as cores, as posições e **o nome de
  cada peça**, e entra no Cinema 4D e no Blender sem nada pelo meio. Cada zona
  vai com o nome que tem nos Calculadores (`zona Principal`), que é por onde se
  lhe põe a textura de verdade do outro lado;
- **`.obj`** — abre em tudo, mas vai **sem materiais**: as peças chegam lá
  cinzentas e pintam-se à mão.

Fica de fora o que é ajuda de leitura e não existe na sala: a grelha do chão, os
contornos, o cone de luz. O **público** e a **planta CAD** são opção — a plateia
toda são 700 pessoas assadas em geometria a sério, uns 6 MB, e nem sempre é isso
que se quer mandar. O orador vai sempre, porque é ele que dá a escala.

## O que ainda não faz

- **TVs**: com o catálogo que já existe nos Calculadores, como os projetores.
- **Guardar a sala**: as medidas escrevem-se de cada vez (a sala fica guardada
  para os Calculadores, mas não se recarrega sozinha aqui).
- **Os limites de shift das outras marcas**: estão as 9 lentes Epson que o
  fabricante publica por lente. Para a Panasonic, a Christie e a NEC o número
  vive no corpo do projetor — tem de entrar no `projectors.json` dos
  Calculadores, e não no das lentes. A Sony e a Barco bloqueiam a leitura
  automática das páginas: essas escrevem-se à mão a partir das fichas.
- **DXF em 3D**: lê-se a planta (o que está em X e Y). Um DXF com altura —
  paredes como sólidos — chega cá achatado no chão.
