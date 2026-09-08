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

**Feito (v2.41, refeito em v2.43): a plateia em gomos.** Secção "Público",
seletor **Reto / Circular** (`#formatoPlateia`, `data-forma` — não usar
`data-formato`, esse nome já é do seletor de rácio de imagem em "Conteúdo
nos ecrãs" e colidia com ele, os dois clicáveis mas só um a responder; foi
o primeiro tropeço disto). "Circular" reparte a plateia em **N gomos**
(`#gomos`, 1 a 12), cada gomo é um bloco igual ao de "Reto" (as mesmas
filas/corredores/inclinação, sala toda de largura). Implementado em
`fazerPublicoGomos()` (`js/cena.js`), que chama `fazerPublico()` uma vez
por gomo sem lhe mexer nada (zero risco para "Reto", que continua a ser
exatamente a mesma função de sempre) e só depois roda/desloca o resultado.

De caminho (v2.41), corrigido um bug à parte que isto tropeçou: o `return`
principal de `fazerPublico()` tinha um comentário com um `\n` escrito por
engano a meio da linha (texto literal, não uma quebra de linha a sério) que
comia a propriedade `blocoPorLugar` para dentro do comentário — a função
nunca devolvia isso, e ninguém tinha reparado porque nada lia essa
propriedade até `fazerPublicoGomos()` precisar dela.

**v2.41→v2.42 (histórico, já não se aplica): leque automático.** As duas
primeiras versões espalhavam os gomos sozinhas por um "ângulo total"
(`#anguloGomos`), cada um do tamanho que coubesse nesse ângulo. Reportado
com screenshot (6 gomos, 50°): os gomos apareciam empilhados/sem gente (a
largura de cada fatia, espremida pelo ângulo, comia-se quase toda em
margens de corredor) e a régie não abria vão nenhum nos gomos rodados.
Corrigido nessa altura, mas a v2.43 substituiu esta ideia inteira (ver a
seguir) — por isso já não há `#anguloGomos` nem largura à medida do
ângulo no código.

**v2.43: automático fora, arrastar e campos numéricos dentro.** Reportado
de novo (screenshot, 4 gomos/180°): mesmo corrigido, o leque automático
"tirava espaço a mais" (a largura de cada fatia era sempre uma fração
estreita da sala) e não dava para ajustar gomo a gomo — só havia um ângulo
total para todos, sem forma de deixar o do meio direito e só virar as
pontas. Pedido do mike: cada gomo com posição/rotação próprias, e poder
**arrastar** na própria cena, não só por campos.

- `fazerPublicoGomos(sala, palco, publico, regie, ajustesGomos)` já não
  encolhe a largura do gomo a um ângulo — cada gomo é a SALA INTEIRA (o
  mesmo bloco que "Reto" desenharia), só deslocado por `ajustesGomos[i] =
  { dx, dz, rot }` (metros/graus, a partir do ponto focal — a boca do
  palco). Sem automático nenhum: um gomo sem entrada em `ajustesGomos`
  fica no próprio ponto focal, sem rodar.
- `ajustes.gomos` (novo, ao lado de `ajustes.delays`/`ajustes.dsm` — ver
  `CHAVE_AJUSTES` em `js/projeto.js`) guarda isto por projeto/aparelho, tal
  e qual os delays já faziam. `ajustesDeGomosGarantidos(n)` (`js/app.js`)
  garante que há pelo menos N entradas, semeando as novas com
  `{ dx:0, dz: i*2, rot:0 }` — só para não nascerem todas empilhadas em
  cima umas das outras (o que parecia um gomo só, escondendo que havia mais
  para arrastar); a pessoa arruma a seguir.
- `desenharGomos()` (`js/app.js`, ao lado de `desenharAjustes()`) desenha
  uma linha por gomo em `#listaGomos`, com os mesmos campos ↔/profundidade/
  rodar (e a mesma calculadora popup) que os delays já tinham.
- **Arrastar**: bloco novo em `js/app.js`, "arrastar gomos/delays/DSM" —
  reaproveita a ideia do arrastar do orador (raio + plano horizontal), mas
  generalizado a qualquer objeto nomeado na cena com um ajuste próprio:
  `"gomo-N"` (só com "Circular" ligado), `"zona NOME"` (só se tiver entrada
  em `ajustes.delays` — uma zona LED não se arrasta, a posição dela vem do
  conjunto lá dos Calculadores) e `"dsm N"`. Arrasta-se qualquer um destes
  agora, não só os gomos — foi pedido no mesmo fôlego ("também com os
  ecrãs delays e DSM"). O ajuste muda ao vivo durante o arrasto (o mesmo
  objeto que os campos leem/escrevem), por isso os campos acompanham
  sozinhos.

**Simplificações conhecidas do modo gomos, ainda por afinar se vier a ser
preciso:**
- `filas`/`porFila`/`blocos`/`zPrimeira`/`zUltima`/`larguraSentada` que a
  função devolve são os de UM gomo — como agora todos os gomos são
  estruturalmente idênticos (a sala inteira, só deslocada), isto já não é
  uma aproximação: é exato para qualquer um deles. Só os "lugares" totais
  são mesmo uma soma dos N.
- "Olhos da plateia" usa o gomo com `rot` mais perto de 0° — não foi
  testado com N par (não há gomo exatamente ao centro nesse caso, fica o
  mais próximo).
- Arrastar só muda dx/dz (posição); rodar continua só pelo campo numérico
  — arrastar para rodar pediria um manípulo à parte, não feito.

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
