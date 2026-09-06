# CLAUDE.md — Preview

Instrucoes para o Claude Code neste projeto.

## O que isto e

Um preview 3D de um projeto feito nos **Calculadores**: os ecras a escala numa
sala, com palco e publico, e a vista de quem esta sentado na plateia. Corre no
browser, sem servidor, e e servido por GitHub Pages.

Ver o `README.md` para o formato do que ele recebe e para o que falta fazer.

## A regra que manda em tudo o resto

**O preview nao sabe nada de tiles, pitch nem catalogos.** Quem sabe isso sao os
Calculadores, e sao eles que mandam as zonas **ja em metros**.

Se um dia aparecer aqui uma tabela de modelos de LED, ou uma conta de pitch, e
sinal de que se comecou a duplicar o outro projeto — e a partir daí passam a
existir dois sitios a discordar sobre o tamanho da mesma parede. A conta faz-se
uma vez, no sitio onde ela vive.

## Contas e credenciais

### Git / GitHub — usar SEMPRE a conta do mike

Repositorio: `mikefkfmiguel-create/preview`, publico, servido por GitHub Pages a
partir do `main`. Os commits vao assinados por `MIKE <mikefkf.miguel@gmail.com>`,
como o resto dos repositorios dele.

Nunca alterar o remote, o autor ou o email para outra conta.

### Editar ficheiros — nunca com Get-Content/Set-Content

O codigo e **UTF-8 sem BOM** e leva acentos. O `Get-Content` do PowerShell 5.1
le ficheiros sem BOM na codepage ANSI e nao em UTF-8: um `Get-Content |
Set-Content` corrompe os acentos todos de uma vez (`cao` -> `Ã§Ã£o`). Ja
aconteceu noutro projeto.

- Usar as ferramentas de edicao de ficheiros (Edit/Write), nunca o shell.
- Se for mesmo preciso um script, fazer em Python com `open(p, "rb")` /
  `open(p, "wb")`, tratando a codificacao a mao.

## MCP — NUNCA usar servidores da conta diogo@kopkai.com

E **proibido** usar qualquer servidor/conector MCP ligado a `diogo@kopkai.com` —
todos os conectores claude.ai (prefixo `mcp__claude_ai_*`). Excecao unica: o
servidor MCP `github` (conta do mike).

## Coisas que ja custaram tempo aqui

- **O Three.js vive no `vendor/`, nao num CDN.** Isto usa-se em salas e
  pavilhoes sem rede. Nao "modernizar" para um import de CDN.
- **Um `InstancedMesh` calcula a esfera que o envolve a partir da geometria e
  nao das instancias.** As 192 pessoas do publico desapareciam do ecra porque o
  motor achava que eram uma bolha de meio metro na origem. Depois de encher as
  matrizes, chamar `computeBoundingSphere()`.
- **Nao limitar o `maxPolarAngle` dos controlos.** Um espectador sentado olha
  para cima; o limite empurrava a camara da vista dos olhos para os 3,5 m de
  altura. Quem impede de furar o chao e um travao de altura no laco de desenho.
- **A vista dos olhos tem de ficar num LUGAR e nao a meio das filas**, senao a
  camara fica a 45 cm da nuca do vizinho da frente.

- **Uma navegacao que so muda o `#` nao recarrega a pagina.** Um teste que
  abria `index.html` e depois `index.html#p=...` dava sempre projeto nenhum, e
  parecia um defeito no codigo que le o endereco. Nao era: o browser trata
  aquilo como mudanca de fragmento e o modulo nao volta a correr.
- **O service worker serve a versao antiga dos modulos** enquanto vai buscar a
  nova em segundo plano. Ao testar uma alteracao, ou se desregista o SW ou se
  recarrega duas vezes -- senao o que se esta a ver e o codigo de ontem, e
  perde-se meia hora a procurar um defeito que nao existe.
- **A sombra do publico nao se soma caixa a caixa.** Numa sala cheia as sombras
  sobrepoem-se quase todas e a soma dava 300%. Rasteriza-se numa grelha.

## Provar antes de dizer que esta feito

Nao ha testes automaticos. O que ha e o `#btExemplo`, que carrega um projeto de
tres zonas: depois de mexer, abrir a app, carregar nele e **olhar** para as
quatro vistas. Metade dos defeitos acima so se viram assim.
