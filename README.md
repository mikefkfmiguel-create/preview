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

## Correr localmente

Não basta abrir o `index.html` no browser: são módulos, e o `file://` não os
deixa carregar. Serve-se a pasta:

```
python -m http.server 8123
```

e abre-se `http://127.0.0.1:8123`.

## A planta da sala

Abre-se uma imagem da planta (PNG ou JPG — um PDF exporta-se para imagem
primeiro) e ela assenta no chão da cena, por baixo de tudo o resto.

**Uma imagem não sabe a escala a que foi desenhada**, e não há como adivinhá-la.
Por isso pede-se uma medida conhecida — a largura real que a planta cobre — e o
resto sai daí, mantendo a proporção. Depois roda-se e desloca-se até bater
certo. A grelha do chão é de metro a metro: se a planta trouxer uma barra de
escala, é aí que se confere.

## A plateia

O público não é enfeite: é ele que responde à pergunta difícil. Dá para dizer
quantas filas, quantos corredores e de que largura, e **quanto o chão sobe por
fila** — sem essa subida a cabeça da frente fica exactamente à altura dos teus
olhos, e a vista da plateia mostra uma nuca em vez de um ecrã.

A app conta os lugares que couberam e avisa quando as filas pedidas não cabem
na sala. Pedir 12 e receber 6 sem ninguém dizer nada é a maneira certa de levar
um número errado para uma reunião.

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
  *"Trazer sala do Preview"*.

O botão *"Ver em 3D"* continua a existir e leva o projeto no próprio endereço —
serve para abrir noutro computador ou mandar a alguém.

## Conteúdo nos ecrãs

Um padrão de teste, ou uma imagem tua, de duas maneiras:

- **Espalhada** — uma imagem só pelo conjunto todo, cada zona mostra o seu
  bocado, como o media server faz. É assim que se vê se as juntas caem onde
  devem e se alguma zona está trocada;
- **Uma em cada** — a imagem inteira repetida em cada zona, para quando os ecrãs
  mostram conteúdos independentes.

E **Guardar imagem (PNG)** leva o desenho com as etiquetas e uma tira com as
contas em baixo — um printscreen perde isso, e é metade do que ali interessa.

## Projeção

Escreve-se o rácio do projetor, a distância à tela e a altura da lente; o
**tamanho da imagem calcula-se** — 1,4 a 12 metros dá 8,57 m de largura. Aparece
o projetor, o cone de luz e a imagem, e avisa quando ela não cabe na sala.

E responde à pergunta que uma folha de cálculo não responde: **quanto é que o
orador tapa**. Arrasta-se a figura pelo palco e a percentagem muda ao vivo —
5% junto à lente, 3% encostado à tela, zero fora do feixe.

A sombra é calculada e não amostrada. A primeira versão atirava 45 raios para a
tela e contava os que batiam no orador — e dava sempre zero, porque os pontos
ficavam a quase um metro uns dos outros e uma pessoa tem 58 cm: passava entre as
amostras.

## O que ainda não faz

- **Os projetores vêm dos Calculadores**: hoje o rácio e a distância escrevem-se
  à mão; o catálogo de projetores e lentes já existe do outro lado.
- **TVs**: o mesmo, com o catálogo que já lá está.
- **Guardar a sala**: as medidas escrevem-se de cada vez (a sala fica guardada
  para os Calculadores, mas não se recarrega sozinha aqui).
- **DXF**: a planta entra como imagem; ler linhas de um DXF à escala, sem
  calibrar nada, é o passo a seguir.
- **Sombra do público**: só se mede a do orador.
