# Checklist de movimento

**Roda a cada PR que toque movimento** — uma classe de animação, um token `--dur-*`, um `.cascata`, o `Chegada`, um popup, o Toast, um esqueleto, um gráfico de Painel. As leis e o orçamento estão na `DIRECAO-VISUAL.md` §5; as classes e os módulos em `COMPONENTES.md` ("Movimento"). O harness é `app/scripts/capturar-movimento.mjs` (`npm run capturar:movimento -- …`); o cabeçalho do script documenta os argumentos, as variáveis de ambiente e os dois relógios.

O que o harness cobre: as fotos em instantes fixos (itens 5 e 6 e toda a leitura visual). O que se mede no DevTools ou por sonda injetada (itens 1 a 4): LCP, CLS, quadros, pintura.

---

## Os sete itens

1. **LCP é o título do cabeçalho**, e o `startTime` não excede em mais de 50 ms o medido com movimento reduzido (`REDUZIR_MOVIMENTO=1` é a linha de base). A chegada não pode atrasar a primeira pintura do que importa.
2. **CLS ≤ 0,05** na hidratação (esqueleto → tela) e na chegada. Só o Toast inline pode acender — é a única fonte de CLS conhecida.
3. **Quadros ≤ 16,7 ms com CPU 4×** (tolerância: 2 quadros ≤ 33 ms) em Contatos, no Quadro e no Início, por 1 s a partir do clique.
4. **Cada peça pinta uma vez na chegada** (Paint flashing no DevTools) e `<main>` não repinta por quadro.
5. **Zero elementos com transform/filter/will-change fora da allowlist depois de 1200 ms** — `REPOUSO=1` conta sob `.chegada`, ignorando `.seta-recolhe`, `.chave-polegar`, `.capa-orbe`, `.girando`, `.trilho-luz`, `.barra-progresso` e `.regua-tempo`, e diz se `.chegada` já está sem `data-entrando` (fecha em 1 s).
6. **Movimento reduzido emulado**: tudo no primeiro quadro (nenhuma peça invisível por delay), popups fecham na hora, Toast expira por timer, barra de rota salta a 80 % e some, globo num quadro, esqueleto parado e legível, count-up no valor final, foco de volta ao abridor.
7. **Teclado e axe/AA inalterados; `npm run check` verde** — a sentinela com as quatro regras de movimento (`COMPONENTES.md`, "A regra 4 da sentinela").

---

## As receitas

Sempre com a **sua** porta CDP (`CDP_PORT`), o dev server já no ar, e o caminho com barra final (`/crm/contatos/`). Os tempos são do relógio da interface; com `ESCALA=10` a interface inteira fica 10× mais lenta pelos próprios tokens e a foto de "300ms" sai 3 s reais depois do gatilho.

| O quê | Como | O que esperar |
| --- | --- | --- |
| Chegada e cascata | `ESCALA=10`, origem `/crm/empresas/` (o link do painel só existe com o assunto CRM aberto), gatilho `document.querySelector('a[href="/crm/contatos"]').click()`, tempos `0,30,75,150,300,450,600,1200`, `REPOUSO=1` | 0: cabeçalho a meio caminho, corpo em opacidade parcial · 30: barra de filtros nascendo · 150: cabeçalho assentado, 5–6 linhas em degraus · 300: linhas 1–10 em pontos diferentes da curva, 11+ começando juntas · 600: tudo assentado · 1200 igual a 600 e repouso `total: 0`, `entrando: false` |
| Foco (blur) | o mesmo em `/notificacoes/` | em 150 ms a 1ª peça nítida e a 5ª ainda borrada |
| Quadro | o mesmo numa Lista em visualização quadro, sonda `document.querySelector('.card-negocio').getBoundingClientRect().top` | cartões só em opacidade: o `top` da sonda igual em 75 e em 600 ms |
| Negativos | `ESCALA=1`, tela já assentada; gatilho = clicar "Mostrar mais", digitar no filtro ou trocar aba; tempos `0,50` | as peças novas já em opacidade 1 no primeiro quadro; na troca de aba só o fade de 150 ms, nenhuma linha atrasada |
| Esqueletos | `SEM_SCRIPT=1`, origem em cada família (`/`, `/crm/caixa-de-entrada/`, `/estrutura/listas/<lista>/`, `/crm/negocios/`, `/paineis/<painel>/`, `/crm/contatos/<id>/`, `/f/<segredo>/`, `/crm/contatos/`); depois a mesma origem com script | silhueta em `--esqueleto` (7 %), visível a olho; cabeçalho, barra e primeiras linhas nas mesmas alturas nas duas fotos |
| Barra de rota | `ESCALA=1 LENTO=1`, gatilho = clique num assunto do trilho, tempos `100,300,1000,2000,3500`, sonda `document.querySelector('.barra-progresso').dataset.estado + ' ' + document.querySelector('main').getAttribute('aria-busy')` | 100: nenhuma barra (carência) · 300: fio de 2 px em `--acento` com halo · 2000: ~70–80 % · depois: 100 % esmaecendo; luz do trilho já no alvo desde 0; ícone pulsando a partir de 150; `main[aria-busy="true"]` durante |
| Barra: negativos | `ESCALA=1`, clicar o assunto já ativo; mudar um filtro; abrir um popup por URL | `data-estado` continua `ocioso` |
| Popup | `ESCALA=10`, gatilho = clique no botão que abre um `SidePanel`, tempos `0,75,150,300`; depois gatilho = `Escape` (`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`), tempos `0,75,150,200`, sonda `document.querySelector('[data-estado="saindo"]')?.hasAttribute('inert')` | entrada: véu escurecendo, superfície subindo 4 px, largura constante · saída: em 150 ms opacidade 0, em 200 o nó não existe; `activeElement` é o abridor já em 0 ms; a raiz `saindo` tem `inert` e não tem `aria-modal` |
| Menu | `ESCALA=10`, abrir um `ActionMenu`, tempos `0,75,150`; escolher, tempos `16` | 150 ms de entrada; some no mesmo quadro, sem resíduo |
| Toast | `ESCALA=1`, disparar um sucesso, tempos `0,3000,6000,6200` | régua cheia → metade → nó removido em 6150; erro continua montado em 20 000; com `REDUZIR_MOVIMENTO=1` some em 6000 sem régua |
| Movimento reduzido | `REDUZIR_MOVIMENTO=1 ESCALA=1`, navegar, tempos `0,50` | tudo em opacidade 1 no primeiro quadro; nenhuma peça invisível por delay |
| Entrar | `ESCALA=10`, origem `/entrar/`, gatilho `'x'`, tempos `0,150,300,500,800` | orbes ao fundo, cartão subindo desfocado, membros descendo desfocados a partir de 300; com `LENTO=1` e clique num membro: chevron vira spinner na hora, demais atenuados, `pathname` muda sem esperar animação |
| Início | `ESCALA=10`, origem `/crm/contatos/`, gatilho = clique no `a[href="/"]`, tempos `0,250,500,600,900,1200` | capa desfocada até 500, globo parado até 500 e nascendo até 1200, saudação/campo/atalhos em degraus até 180, seções descendo de 300 a 870 |
| Painéis | `ESCALA=10`, origem `/paineis/`, gatilho = clique num painel, tempos `0,200,500,700`, sonda `[...document.querySelectorAll('.sr-only')].map(e => e.textContent).slice(0, 8)` | ladrilhos desfocando, números subindo (o `sr-only` já com o valor final em 0), barras crescendo da base/esquerda, rosca se desenhando |

**Como ler uma foto:** abra a PNG e descreva o que está lá — não o que a spec diz que deveria estar. Uma peça "invisível" em 0 ms é um `backwards` com delay; um deslocamento em 1200 ms é um `forwards` esquecido; uma onda ao trocar de aba é `.cascata` fora da janela; um popup preso dentro do conteúdo é `transform` num ancestral.
