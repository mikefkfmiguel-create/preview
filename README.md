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

Cada vista serve uma pergunta diferente, por isso o **público**, o **orador** e
as **paredes e tecto** ligam-se e desligam-se: sem paredes vê-se a sala de fora,
sem público vê-se a estrutura, e sem ninguém no palco mede-se o ecrã sem nada a
tapá-lo.

**Instala-se como app**, e depois disso abre sem internet: o botão está no fim
do painel, e em iPhone diz-se lá como se faz à mão.

Também dá para colar o projeto à mão, se preferires.

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

**Uma imagem não sabe**, e não há como adivinhar. Por isso pede-se uma medida
conhecida — a largura real que a planta cobre — e o resto sai daí, mantendo a
proporção. A grelha do chão é de metro a metro: se a planta trouxer uma barra de
escala, é aí que se confere.

Nas duas, o que sobra para mexer é onde ela fica — rodar e deslocar — porque o
zero do CAD raramente é o meio da sala.

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
serve para abrir noutro computador ou mandar a alguém.

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
