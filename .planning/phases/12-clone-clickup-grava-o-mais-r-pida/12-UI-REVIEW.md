# Fase 12 — Revisão de UI

**Auditado em:** 2026-11-02
**Base:** padrões abstratos dos 6 pilares (não existe UI-SPEC.md nesta fase)
**Capturas de tela:** não capturadas. Por restrição da rodada (a API de produção poderia hidratar dados reais), nenhum servidor foi subido e nenhuma página foi aberta.
**Capturas de interação:** off (workflow.ui_interaction_capture é false)

Os pilares visuais foram julgados por leitura de código e de testes. Rodei `npm run verificar:tokens -w @n1/web`: 445 tokens, 392 arquivos, 0 falhas. Rodei também `arvore-salvando`, `tarefa-salvando` e `guarda-de-navegacao`: 28 testes passam. Os testes provam estado e atributos, não a aparência renderizada.

---

## Notas por pilar

| Pilar | Nota | Achado principal |
|---|---|---|
| 1. Copywriting | 3/4 | "Salvando…" é consistente em todos os pontos. O erro D-14 e o bloqueio de clique não têm texto próprio. |
| 2. Visuals | 3/4 | Linha "Salvando" só difere pela cor `--texto-4`, com `title` e `aria-busy`. Não há indicador visual de progresso. |
| 3. Color | 3/4 | Só tokens, sem cor hardcoded. O contraste de `--texto-4` sobre o fundo não foi medido. |
| 4. Typography | 3/4 | Reaproveita `app-base` e `app-md`, sem tamanho novo. O estado só muda de cor, não de peso nem de estilo. |
| 5. Spacing | 3/4 | Mantém `--e-1`/`--e-2`, `gap-2`, `px-2`. A linha "salvando" preserva o recuo (`marginLeft` por profundidade). |
| 6. Experience Design | 2/4 | Cliques e ações bloqueados falham em silêncio. A guarda da âncora não dá aviso visível. |

**Geral: 17/24**

Nenhuma nota 1, então não há BLOCKER. Os itens abaixo são WARNING.

---

## Três correções principais

1. **Dar retorno quando um clique é engolido (WARNING, Experience Design).** Hoje o usuário clica e nada acontece. Em `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx:291` e `features/estrutura/task-panel.tsx:39` o `return` é silencioso. Em `features/estrutura/tabela-de-tarefas.tsx:311-318` a linha chama `openTask` mesmo "salvando", e quem barra é a página. Em `dados/guarda-de-navegacao.ts:112-114` a âncora é só marcada com `aria-busy`. Correção: mostrar um aviso curto ("Salvando… abre em instantes") ou uma classe CSS visível ligada a `[aria-busy="true"]` (cursor de espera e opacidade). Melhor ainda: lembrar o clique e navegar quando o id for confirmado. O código de `reavaliar` (linhas 86-96) já sabe quando isso acontece.
2. **Tornar o estado "Salvando…" perceptível e acessível ao anúncio (WARNING, Visuals e Color).** `linha-da-arvore.tsx:123-131`, `tabela-de-tarefas.tsx:342-349` e `tarefa-completa.tsx:1883` só trocam a cor para `--texto-4` e põem `title`. O `title` não aparece em toque nem no teclado. O `aria-busy` num `span` solto não é anunciado, e o `sr-only` fica dentro de um elemento sem papel. Correção: adicionar um spinner pequeno ou reticências animadas respeitando `prefers-reduced-motion`. Conferir o contraste de `--texto-4` contra `--page` (mínimo 4.5:1). Anunciar a confirmação ou a falha numa região `role="status"`.
3. **Decidir e documentar a Candidata de UX D-13 do painel de aprovação (WARNING, Experience Design).** Está em `12-PROVAS.md:704-710` e `:823`. O diálogo fecha e o aviso de sucesso sai antes da resposta. Se o servidor recusa, o cartão volta a "Aprovação pendente" com o erro, mas o diálogo já fechou e o usuário perde o contexto. É escolha de produto do dono. Mínimo recomendado: quando o erro D-14 reverter uma decisão de aprovação, o aviso de erro precisa nomear a ação ("Não foi possível aprovar X") e oferecer retomar.

Outros ajustes menores:
- O erro D-14 aparece depois que a mudança some. Convém mostrar o texto do servidor, e o texto da ação desfeita, num aviso que não suma sozinho.
- `beforeunload` (`dados/store.ts:609-613`) usa `preventDefault` e `returnValue = ""`, que é a forma correta. O texto é do navegador e não dá para customizar.

---

## Achados detalhados

### Pilar 1: Copywriting (3/4)
- "Salvando…" é a mesma string e o mesmo caractere de reticências em `linha-da-arvore.tsx:125,130`, `tabela-de-tarefas.tsx:344,349,489`, `tarefa-completa.tsx:1883-1885` e `financeiro/contas-view.tsx:959`. Isso é consistente e em português. Está bem.
- Em `contas-view.tsx:959` e em `tabela-de-tarefas.tsx:489`, `MOTIVO_SALVANDO` aparece como `disabledReason` embaixo do rótulo do menu. Diz o estado, mas não diz o que fazer ou quando volta. Sugestão: "Salvando… disponível em instantes".
- Para o clique cancelado e para a tarefa não confirmada, não existe nenhum texto: a única sinalização é `aria-busy` (`guarda-de-navegacao.ts:99`). Esse é o ponto que derruba a nota.
- Não coberto pelo código: o texto real dos erros D-14 vem do servidor. Julgar a clareza dele exige ver a tela. `needs_human_review`.

### Pilar 2: Visuals (3/4)
- A linha de contêiner salvando (`linha-da-arvore.tsx:120-131`) perde link, "+", "⋯" e arrastar, e mantém recuo e ícone. Isso evita salto de layout quando o id é confirmado, o que é bom.
- O sinal visual é só o texto em `--texto-4`. Em `tabela-de-tarefas.tsx:340-350` o título vira `span` com a mesma cor. Esse destaque é fraco: a linha cinza também pode ser lida como "desabilitado" ou "arquivado". Sem spinner, a hierarquia entre "salvando" e "pronto" é só de cor.
- A linha continua `cursor-default` (`tabela-de-tarefas.tsx:311`), mas o `onClick` da linha ainda chama `openTask` (`:315-318`). A dica visual existe, o comportamento é silencioso.
- O texto `sr-only` ajuda leitor de tela, mas o `title` não ajuda toque nem teclado.
- `needs_human_review`: como o "Salvando…" fica renderizado em tema claro e escuro, e se o cinza está legível.

### Pilar 3: Color (3/4)
- `verificar:tokens`: 0 falhas, e o grep por `#hex` nos arquivos centrais da fase não achou cor fixa.
- Usa `--texto-4`, `--texto-2`, `--acento-lavado`, `--linha-acento`, `--aviso`. Todos tokens. Sem acento novo.
- Risco não mensurável pelo código: o contraste de `--texto-4` sobre o fundo, para um texto que o usuário precisa ler. `needs_human_review`.

### Pilar 4: Typography (3/4)
- Sem tamanho ou peso novo: `app-base`, `app-md`, `app-meta`, `font-medium`. Classes de projeto, sem escala inventada.
- O estado "salvando" não ganha nenhum diferencial tipográfico (itálico, por exemplo). Fica só na cor.

### Pilar 5: Spacing (3/4)
- `linha-da-arvore.tsx`: `px-2`, `gap-2`, `size-6`. A seta tem alvo de 24px (comentário nas linhas 110-111). O `span` de "salvando" mantém `w-6` e o `marginLeft`, então alinha com as linhas irmãs.
- A tabela usa `--e-1`/`--e-2`. Sem valor arbitrário novo.
- Não verificável pelo código: o deslocamento real de layout na troca "salvando" para "confirmado" (`span` para `Link`/`button`). `needs_human_review`.

### Pilar 6: Experience Design (2/4)
Cobertura de estado:
- **Salvando:** coberto em árvore, tabela, subtarefas (`tarefa-completa.tsx:1864-1885`) e menus (`contas-view.tsx:958`). Os testes passam.
- **Clique em âncora com id pendente:** cancelado por `preventDefault` e `stopPropagation` em fase de captura (`guarda-de-navegacao.ts:104-117`). Também cobre `auxclick`. A guarda se desmonta sozinha e limpa o `aria-busy` (`:86-96,119-125`). O mecanismo é sólido e bem testado. Falta o retorno ao usuário e a retomada da navegação depois da confirmação.
- **Abrir tarefa não confirmada:** `page.tsx:291` e `task-panel.tsx:39` retornam sem aviso.
- **"Abrir em página cheia" e "Editar conta":** desligados com motivo "Salvando…" (`contas-view.tsx:958-959`). O padrão é bom, pois o motivo é visível no menu.
- **beforeunload:** `store.ts:609-614` avisa só se `deveAvisarAoSair(pendentes)`. Não dispara em navegação interna do App Router, e isso está comentado nas linhas 605-607. O diálogo nativo e o comportamento em Chrome e Safari (Safari costuma ignorar o texto e exigir interação prévia) não se julgam pelo código. `needs_human_review`.
- **Erro D-14 (servidor recusa e a mudança some):** o item some em silêncio da tela e depende de aviso. Conferir se o aviso fica visível tempo suficiente e diz qual mudança foi desfeita. `needs_human_review`.
- **Painel de aprovação:** o diálogo fecha antes da resposta, e o erro volta num cartão sem o diálogo (`12-PROVAS.md:708`). Pendente de decisão do dono.
- Destrutivo e confirmação: esta fase não adiciona ações destrutivas. O `beforeunload` é a única confirmação nova.

### Registro de segurança
Não aplicável: não há `components.json` com registro de terceiros nesta auditoria.

---

## O que não dá para julgar só pelo código (`needs_human_review`)

1. O diálogo nativo do `beforeunload` ao fechar a aba ou recarregar, em Chrome e Safari.
2. O clique real numa âncora pendente (foco, retorno visual, middle-click, Cmd+clique) nos dois navegadores.
3. O visual renderizado de "Salvando…": contraste de `--texto-4`, tema escuro, troca para o item confirmado sem salto de layout.
4. O tempo e o texto do aviso de erro D-14.
5. A percepção de velocidade da gravação otimista, que só se mede no app real.

---

## Arquivos auditados
- `apps/web/src/features/shell/linha-da-arvore.tsx`
- `apps/web/src/features/shell/app-shell.tsx` (linhas 77, 260, 437, 738, 847, 962, 1051)
- `apps/web/src/features/estrutura/tabela-de-tarefas.tsx`
- `apps/web/src/features/estrutura/task-panel.tsx`
- `apps/web/src/features/estrutura/tarefa-completa.tsx`
- `apps/web/src/features/estrutura/financeiro/contas-view.tsx`
- `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`
- `apps/web/src/dados/guarda-de-navegacao.ts`
- `apps/web/src/dados/store.ts` (`beforeunload` e `useIdsNaoConfirmados`)
- `.planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-PROVAS.md` (seções D-13 e Seguimentos)

Limite desta auditoria: li por busca e por trechos. Não li por inteiro `app-shell.tsx`, `tarefa-completa.tsx`, `contas-view.tsx` nem os SUMMARY e PLAN 12-05 a 12-10.
