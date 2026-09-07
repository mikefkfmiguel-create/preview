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

## Palco central/circular + plateia em arco ou blocos (pedido a 7/9, por fazer)

Pedido do mike: (1) poder ter um **palco circular e central**, com a plateia
a envolvê-lo, para eventos "em redondo"; (2) numa **sala muito larga** com o
palco normal à frente, poder curvar/dividir a plateia para melhorar a
visualização sem ter de acrescentar ecrãs de cobertura.

**Decisões já tomadas com o mike (não voltar a perguntar):**
- O Palco ganha um seletor **Retangular / Circular**. Circular ganha
  controlos de posição (deslocar X/Z, como a Régie já tem) — pode ir para o
  centro da sala ou para onde se quiser, não fica preso ao centro.
- A plateia à volta de um palco circular tem um **ângulo ajustável** (não é
  sempre 360° fixo) — de uma abertura parcial (ex. 90°, só de um lado) até à
  volta toda.
- Para a sala larga, quer **os dois modos** — e descreveu-os melhor a
  seguir: um seletor de forma da plateia, **Circular / Reto** (paralelo ao
  seletor do Palco, mas são coisas distintas — a plateia pode ser Circular
  com um palco Retangular, por exemplo). "Reto" é o arco único de hoje
  (plateia toda curvada para um ponto focal à frente). "Circular" divide a
  plateia em **gomos** — fatias em cunha, como as de uma laranja, dispostas
  à volta do centro — em vez de um bloco retangular só a rodar (a diferença
  para "blocos angulados" é a forma de cada peça: cunha/gomo, não retângulo).
  Não é para escolher um dos dois modos — os dois hão de existir, com o
  próprio seletor Circular/Reto a decidir qual se usa.

**Porque não ficou feito na mesma sessão em que foi pedido:** o palco não é
um campo isolado — `palco.profundidade` e a posição dele contra a parede da
frente são a referência de onde os ecrãs nascem por omissão, dos cálculos de
pé-direito/teto, do export DXF e da planta 2D (grep por `palco.` em
`js/app.js` para ver a extensão). Tornar o palco circular e móvel implica
rever todos esses pontos, não só acrescentar um seletor. E o gerador de
plateia (`fazerPublico`, `js/cena.js`) é código já bastante trabalhado —
corredores, o recuo de "meio lugar" por fila, o rebaixo da régie calculado
no referencial dela, degraus por fila — tudo hoje assumindo filas retas;
curvar isto num arco sem partir nenhum desses detalhes é trabalho de
geometria a sério, e sem conseguir testar ao vivo com o mike (sessão cloud,
sem acesso de push a este repositório nessa altura) não fazia sentido
arriscar às cegas. Ficou combinado fazer isto com calma, testado a sério,
não às pressas sem verificação.

**Por onde começar:** provavelmente pelo modo "Arco" da plateia primeiro
(mais contido — só mexe no gerador de lugares, não no palco nem nos ecrãs),
deixando o palco circular/móvel para depois, já que esse sim obriga a rever
a posição por omissão dos ecrãs e os cálculos que dependem dela.

## Coisas que se decidiram e não se voltam a discutir

- **O Preview não ganha catálogos.** Nem de LED, nem de projetores, nem de
  lentes. Ver a regra no `.github/copilot-instructions.md`.
- **O motor 3D vive no `vendor/`**, não num CDN: isto usa-se onde não há rede.
- **Os motores pesados (DWG, PDF) não entram no arranque** — só se descarregam
  quando alguém abre um ficheiro desses.
- **A latência do direto e o genlock não são deste projeto.** Isto é um preview
  de montagem: responde a *cabe?*, *vê-se?*, *quem tapa o quê?*.
