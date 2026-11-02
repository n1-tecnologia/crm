# Fase 11 — Revisão de UI

**Auditado em:** 2026-10-29
**Base:** padrões abstratos dos 6 pilares + tokens do projeto (`apps/web/src/design/`) + decisões D-01..D-16 do 11-CONTEXT.md (não há UI-SPEC.md)
**Capturas de tela:** não capturadas. Não havia servidor em localhost:3001 (sonda devolveu 000), então a auditoria é só de código. Nada visual foi verificado em renderização; spacing, hierarquia e contraste são julgados pelas classes e tokens.
**Capturas de interação:** off (workflow.ui_interaction_capture desligado). Os achados de interação vêm do código. A UAT que o dono aprovou no navegador em 29/10 (11-PROVAS.md) não substitui medição de acessibilidade.

---

## Notas por pilar

| Pilar | Nota | Achado principal |
|---|---|---|
| 1. Texto (Copywriting) | 3/4 | Copy específico e em português. Falta o autor/contexto nas menções da descrição e o aviso da conversão repete a ideia de "não tem volta" |
| 2. Visual | 3/4 | O destaque da menção e o "Ver alteração" são coerentes. A hierarquia do bloco expandido é fraca e o gatilho é um link inline pequeno |
| 3. Cor | 3/4 | Usa só tokens (`--acento`, `--texto-3`, `--erro` removido do botão). Sem hex. Estilo inline em vez de classe do design system |
| 4. Tipografia | 3/4 | Reaproveita `app-sm`, `app-meta`, `app-base`, `app-numero`. Pesos soltos (500, 600) em estilo inline |
| 5. Espaçamento | 3/4 | Sem valores arbitrários (`[..px]`) nos arquivos novos. `padding: 0.05em 0.4em` inline foge da escala |
| 6. Experiência | 2/4 | O menu de menção na descrição não anuncia a opção ativa, o resultado da conversão não é anunciado e o aviso da menção nunca some pelo próprio usuário |

**Geral: 17/24**

---

## 3 correções prioritárias

1. **Menu de menção sem `aria-activedescendant`** — Quem usa leitor de tela digita "@" e as setas movem `sugestaoAtiva`, mas o campo não aponta a opção ativa. O `TextArea` recebe só `ariaAutocomplete` e `ariaControls`. Correção: dar `id` a cada `role="option"` e passar `aria-activedescendant` ao `<textarea>` (via `TextArea` em `design/components.tsx`), nos dois usos (descrição e Comentário).
2. **Aviso da menção na descrição só some por três causas externas (D-08)** — Notificações mostra "Menção a você na descrição de X" sem ação, sem autor e sem "visto". A pessoa fica com o item até alguém editar a descrição ou fechar a Tarefa. O dono aceitou a regra, então não é bug. Mas a tela precisa dizer isso: o texto de rodapé já diz quando a menção sai, repita o motivo no próprio item ou use um link "Abrir descrição" que leve à âncora da descrição, para o clique ter fim claro.
3. **Resultado da conversão e "Ver alteração" sem anúncio nem relação ARIA** — O `notice` "Item convertido em Subtarefa" aparece depois que o diálogo fecha. Confira se o contêiner é `role="status"`/`aria-live`, senão a confirmação é invisível ao leitor de tela. O botão "Ver alteração" tem `aria-expanded` mas não `aria-controls` para o bloco aberto. Correção: `id` no bloco "Antes/Depois" e `aria-controls`.

---

## Achados detalhados

### Pilar 1: Texto (3/4)

- BLOCKER: nenhum.
- WARNING `notificacoes/page.tsx`: o item da descrição diz "Menção a você na descrição de “{task.title}”" e o trecho. O item de Comentário tem autor; o da descrição não (decisão do domínio, a descrição não tem autor). Aceitável, mas o título pode truncar (`truncate`) e perder o nome da Tarefa em títulos longos.
- `conversao-de-item.tsx`: o título "Converter “{item.text}” em Subtarefa?" é específico, o rótulo "Converter" é um verbo claro, e a descrição diz o que acontece ("não tem volta, sai do progresso do Checklist"). Bom. A palavra "Item" e "Checklist" em maiúscula segue o glossário do projeto.
- `alteracao-de-descricao.tsx`: "Ver alteração" / "Ocultar alteração" / "Antes" / "Depois" / "Sem descrição". Claro. O bloco vazio diz "Sem descrição", não deixa o campo em branco.
- `tempo.ts`: "N min com Subtarefas", "em andamento", "1 registro / N registros". Pluralização correta. A linha junta até quatro partes com " · ", pode ficar longa em coluna estreita (ver Pilar 5).
- Nenhum "Submit", "OK" ou erro genérico nos arquivos tocados.

### Pilar 2: Visual (3/4)

- `descricao-da-tarefa.tsx`: o nome mencionado vira pílula (`--acento` sobre `--acento-lavado`, `--r-pilula`), o mesmo vocabulário do `.rico .mencao`. Coerente com o Comentário.
- WARNING `alteracao-de-descricao.tsx`: o gatilho é um link inline (`app-sm`, sublinhado fixo) dentro do `<span>` da frase. O sublinhado já é permanente e ainda há `hover:underline`, que não muda nada. Alvo de clique pequeno, sem área mínima. O bloco expandido usa só rótulo cinza `app-meta` mais texto, sem moldura nem separação entre "Antes" e "Depois"; descrições longas de 2.000 caracteres viram dois parágrafos colados, difíceis de distinguir.
- `BotaoDeConversao` usa `btn btn-sutil btn-sm`, na cor normal (D-05 cumprido: `--erro` saiu). O botão com `ml-auto shrink-0` fica à direita do item; sem ícone, o texto "Converter em Subtarefa" é longo para o botão pequeno.
- O menu `ListaDeMencoes` é o mesmo nos dois editores (classe `flutuante surgir-rapido`), consistente. `presoNaBase` só no Comentário; na descrição abre para baixo e pode ser cortado se o editor estiver no fim do popup (não verificável sem tela).

### Pilar 3: Cor (3/4)

- Nenhum hex ou `rgb(` nos três arquivos novos. Só tokens: `--acento`, `--acento-lavado`, `--texto`, `--texto-3`.
- A cor de destaque aparece em: pílula da menção, link "Ver alteração". Uso contido, dentro do papel de acento.
- WARNING: o destaque da menção vive como objeto `DESTAQUE_DA_MENCAO` inline no TSX, duplicando o que `.rico .mencao` já define em CSS. Se o token mudar, há dois lugares. Correção: reaproveitar a classe do CSS.
- `--texto-3` (cinza terciário) em rótulos "Antes/Depois" e "em andamento": confira o contraste contra o fundo do cartão; o projeto já usa `--texto-3` para metadados, mas o texto é `app-meta` pequeno.

### Pilar 4: Tipografia (3/4)

- Reaproveita as classes do sistema (`app-sm`, `app-meta`, `app-base`, `app-numero`). Nenhum `text-xl` novo.
- WARNING: `fontWeight: 500` e `600` inline em `descricao-da-tarefa.tsx` e `alteracao-de-descricao.tsx`. O sistema parece ter dois pesos de rótulo; esses dois valores aumentam o conjunto para fora das classes.
- O número de tempo usa `app-numero` (tabular). Bom para alinhar "135 min" e "2 h 15 min".

### Pilar 5: Espaçamento (3/4)

- Sem `[..px]` arbitrário. Usa `mt-1`, `gap-2`, `py-3`, `p-1`, `mb-1`, escala padrão.
- WARNING: `padding: "0.05em 0.4em"` na pílula é fora da escala do projeto; a altura vertical de 0.05em é quase nula e a pílula pode encostar nas linhas vizinhas em descrições com `leading` apertado.
- A linha "Rastrear tempo" junta `total · N registros · em andamento · X com Subtarefas`; sem `truncate` ou quebra definida, pode estourar a coluna da propriedade. Não verificado em tela.
- O menu de menção usa `max-w-xs` e `w-full`, e o `<ul>` é `absolute`: depende de o pai ser `relative` (está, em `task-editors.tsx`).

### Pilar 6: Experiência (2/4)

Pontos fortes:
- Estados cobertos na conversão: botão some quando não dá (nada de botão que falha), confirmação de um clique com aviso, erro local fecha o diálogo e mostra `onErro`, id vindo do servidor para o link "Abrir" (T-11-19).
- `temAlteracaoParaVer` esconde o botão em edição antiga e em Ator de integração (D-12, D-14). `before: ""` conta como presente.
- Estado do "Ver alteração" vive em componente de módulo (`LinhaDoFeed`), não recria a cada render.
- O texto vai como nó de texto React, sem HTML (T-11-16, T-11-17).

Falhas:
- WARNING (acessibilidade): `ListaDeMencoes` tem `role="listbox"` e `aria-selected`, mas o campo não tem `aria-activedescendant`. O `TextArea` aceita `ariaAutocomplete` e `ariaControls` e mais nada. Ver fix 1.
- WARNING: `DialogoDeConversao` devolve `null` se o item sumiu (`!item`) sem avisar. Se alguém converter o mesmo item em outra aba, o diálogo simplesmente desaparece.
- WARNING: depois de `onFechar()` a confirmação do servidor chega de forma assíncrona; entre o fechar e o aviso não há indicação de "convertendo…". Em rede lenta, o item ainda aparece como não convertido por um instante (a cópia local já mudou, então é pequeno).
- WARNING: `onKeyDown={(event) => { mencoes.aoTeclar(event); }}` na descrição descarta o retorno, enquanto o Comentário faz `if (mencoes.aoTeclar(event)) return;`. Na descrição, Enter com o menu aberto escolhe a menção, mas o resultado de `aoTeclar` é ignorado; se `aoTeclar` retornar `true` para Escape, o `Escape` do popup/gaveta pode fechar a Tarefa junto. Conferir em tela.
- Sem estado de carregamento ou vazio específico para "Ver alteração" (não precisa; os dados já estão no registro).
- Sem confirmação destrutiva para remover item convertido: a mensagem avisa que a Subtarefa permanece. Correto.

---

## Arquivos auditados

- `apps/web/src/features/estrutura/conversao-de-item.tsx`
- `apps/web/src/features/estrutura/descricao-da-tarefa.tsx`
- `apps/web/src/features/estrutura/tempo.ts`
- `apps/web/src/features/estrutura/mencoes.ts` (existência e uso)
- `apps/web/src/features/estrutura/tarefa-completa.tsx` (diff)
- `apps/web/src/features/estrutura/task-editors.tsx` (diff)
- `apps/web/src/features/estrutura/collaboration-editors.tsx` (diff)
- `apps/web/src/features/tarefa/alteracao-de-descricao.tsx`
- `apps/web/src/features/tarefa/feed-de-atividade.tsx` (diff)
- `apps/web/src/features/tarefa/timeline.tsx` (diff)
- `apps/web/src/app/(shell)/notificacoes/page.tsx` (diff)
- `apps/web/src/design/components.tsx` (diff)

Registry audit: não aplicável (sem `components.json` verificado nem registros de terceiros declarados).
