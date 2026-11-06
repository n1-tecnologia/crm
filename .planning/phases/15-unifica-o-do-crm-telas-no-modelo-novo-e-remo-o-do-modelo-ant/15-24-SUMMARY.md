---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 24
subsystem: crm
tags: [pagina-da-conversa, gestos-rest, coluna-do-contato, mover-conversa, grupo, tdd, ucr-05, ucr-06]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-11 (a Caixa no modelo novo, padrao de recusa/revalidacao), 15-13 (fichas sem recuo), 15-20 (ConversationThread por ids) e 15-05 (regra da Empresa do cartao)"
provides:
  - "[conversa]/page.tsx le useConversa(id); atribuir, resolver, reabrir, mover e lixeira sao rotas /conversas/:id/*, nada em /operacoes nem no store"
  - "ColunaDoContato: o cartao do Contato no modelo novo (useContato, Empresa admin mais antiga, qualificacao do Catalogo por PATCH /contatos/:id, acoes por Canal pelo fio)"
  - "MoveConversationDialog por moverConversa, com a busca do destino em GET /contatos?q= e a colisao CONVERSA_JA_ABERTA como escolha explicita"
  - "ConversaDeGrupoNaCaixa: o ramo do Grupo (F14-D-05) fora da pagina, para 404 + Conversa de grupo do store"
affects: [15-25, 15-32, 15-33, 15-40, 15-42]

plan_head_before: 43f0f66c6b29a30d0452adec477fc5b2c91340a7
plan_head_after: 28a207696767026d31972818b9684a96ae97c21f

actuals:
  tokens: 23900
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "pagina que le a Conversa pela api e recua so no 404: com id de Grupo no store abre o ramo do Grupo; qualquer outro 404 diz nao encontrada (sem ponte de id)"
    - "gesto com ref + releitura de /conversas na recusa: a recusa da api vira o aviso e o menu volta a dizer o estado real"
    - "teste de pagina com fetch roteado por URL, SWRConfig isolado, next/navigation com query string observavel e o fio trocado por marcador"

key-files:
  created:
    - apps/web/src/features/crm/coluna-do-contato.tsx
    - apps/web/src/features/crm/conversa-de-grupo-na-caixa.tsx
    - apps/web/src/features/crm/empresa-do-contato.ts
    - apps/web/src/features/crm/pagina-da-conversa.test.tsx
  modified:
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx
    - apps/web/src/features/crm/move-conversation-dialog.tsx
    - apps/web/src/features/crm/tarefas-do-contato.tsx
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md

key-decisions:
  - "A pagina so recua para o Grupo no 404 da api: permissao ou rede nao viram 'nao existe'; um id de Conversa 1:1 do modelo antigo diz 'Conversa nao encontrada.' (F14-D-01)"
  - "O ramo do Grupo foi para um componente proprio que ainda usa as quatro operacoes antigas de Conversa; e o unico lugar da Caixa que as usa, e a pagina nova nao cita nenhuma"
  - "A Empresa do cartao e o vinculo vigente admin de menor inicio (sem admin, o vigente de menor inicio): o ContatoDetalhado nao traz criado_em do vinculo, entao inicio e o proxy do 'mais antigo' do 15-05"
  - "O destino de mover vem do SeletorDeRegistro (GET /contatos?q=, debounce de 300 ms, o mesmo dos dialogos de mesclar e transferir), nao de useContatos puro"
  - "A colisao no destino e dita depois da recusa 409 CONVERSA_JA_ABERTA (a api devolve a Conversa em bloqueios.conversas); Mover so repete com 'resolver no mesmo ato' marcado"

requirements-completed: []

coverage:
  - deliverable: "a pagina le a Conversa pela api e os gestos do cabecalho sao rotas REST, sem tocar registros nem o transporte do store"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/pagina-da-conversa.test.tsx#(1) a (4)", status: pass }
    human_judgment: false
  - deliverable: "borda UCR-05: resolver o que outra aba ja resolveu mostra a recusa e a pagina fica coerente"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/pagina-da-conversa.test.tsx#(5)", status: pass }
    human_judgment: false
  - deliverable: "F14-D-05 / UCR-06: 404 + Conversa de grupo abre ConversaDoGrupo; 404 + Conversa 1:1 antiga ou inexistente diz nao encontrada"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/pagina-da-conversa.test.tsx#(6) a (8)", status: pass }
    human_judgment: false
  - deliverable: "a coluna do Contato e do modelo novo: Empresa admin mais antiga, qualificacao por PATCH com a recusa na coluna, sem temperatura, so leitura na lixeira, Tarefas do Contato pelo id novo"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/pagina-da-conversa.test.tsx#(9) a (13)", status: pass }
      - { kind: test, ref: "apps/web/src/sem-crm-antigo.test.ts (page.tsx e move-conversation-dialog.tsx fora de CONGELADOS)", status: pass }
    human_judgment: false
  - deliverable: "mover a Conversa: busca do destino sem o Contato atual, POST /conversas/:id/mover, recusa e colisao no dialogo"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/pagina-da-conversa.test.tsx#(14) a (16)", status: pass }
    human_judgment: false
  - deliverable: "a pagina, a coluna e o dialogo mantem o desenho que a pessoa conhece"
    verification: []
    human_judgment: true
    rationale: "Os testes provam conteudo e comportamento; que o cabecalho, a coluna e o dialogo fiquem iguais na tela e juizo visual (fim da fase, human_verify_mode = end-of-phase)."
---

# Phase 15 Plan 24: A página da Conversa e seus gestos pelo CRM novo Summary

**`[conversa]/page.tsx` lê `useConversa(id)` e atribuir, resolver, reabrir, mover e lixeira são rotas `/conversas/:id/*` (nada em `/operacoes`), a coluna do Contato é `ColunaDoContato` sobre `useContato` com a qualificação por `PATCH /contatos/:id`, e a Conversa de Grupo segue abrindo por um componente próprio quando a api responde 404.**

## Performance

- **Tasks:** 3 (1 tracer, 2 auto), todas `tdd="true"`
- **Files:** 4 criados, 5 modificados (mais `.planning/WINDOWS.md`)
- **Commits:** 7 (3 pares RED/GREEN + 1 docs), medidos de `plan_head_before`
- **Verificação:** nenhuma parte precisa de banco (jsdom/vitest puros): nenhum Postgres nem contêiner foi criado.

## Accomplishments

- **Traçador (Task 1):** `ConversaPage` chama `useConversa(conversa)`. Com dados, monta `ConversaAberta` (chaveada pela Conversa, o que dispensou o truque de `conversaVista`); sem dados, "Carregando a conversa…"; com 404, `ConversaDeGrupoNaCaixa` se o store conhece o id como Conversa de grupo e "Conversa não encontrada." se não. Erro que não é 404 diz "Não foi possível abrir a Conversa." com a frase da api. Os gestos usam `agir()`: um `ref` segura o segundo clique, o sucesso vira o aviso e a recusa da api vira o aviso de erro **e** uma releitura de `/conversas` (o caso de outra aba ter resolvido antes). Os itens do menu e o Atribuído se desligam com `usePodeNoCrm` (`editar`, `resolver`, `reabrir`, `mover`, `enviar_para_lixeira` sobre `conversa`), a mesma função do domínio que a api aplica (T-15-58).
- **Cabeçalho:** o avatar é `AvatarDoContato`; a Empresa vem de `empresaDoContato` (vínculo vigente `admin` mais antigo, a regra do 15-05) e a faixa do lead vem do primeiro Negócio aberto de `useNegocios({ contatoId, situacao: "aberto" })` mais `useNegocio` para Produto e Origem. A Temperatura saiu da faixa (D-15-06).
- **Coluna do Contato (Task 2):** `ColunaDoContato({ contatoId, somenteLeitura, abaixo, onCanal })` mostra nome, cargo e Empresa do vínculo, a qualificação do Catálogo (só itens ativos, T-15-59) gravada por `editarContato(id, { qualificacao })` com a recusa em `role="alert"` e o valor do servidor mantido, as ações Ligar, WhatsApp, E-mail, Instagram (levam o fio à aba do Canal padrão do tipo, `canalPadraoDoTipoNasTabelas`), Nota e Abrir ficha, os Identificadores, o Proprietário e a descrição. `TarefasDoContato` recebe `contatoId`. A página deixou de importar `contact-card`.
- **Mover (Task 3):** `MoveConversationDialog` chama `moverConversa`. Se a api devolve 409 `CONVERSA_JA_ABERTA`, o diálogo nomeia a Conversa que colide (vinda de `bloqueios.conversas`) e o Canal, e "Mover" só repete com "resolver no mesmo ato" marcado (`resolverExistente: true`). Outras recusas (destino mesclado) aparecem no próprio diálogo. Sucesso: aviso na página, `/conversas` revalidada, diálogo fechado.
- **Grupo (F14-D-05):** `conversa-de-grupo-na-caixa.tsx` leva o ramo antigo do Grupo (cabeçalho, `ConversaDoGrupo`, painel com Atribuído, Fila, Participantes, Tags e Capacidades). O Canal vem de `GET /canais` (`useCanaisDasFerramentas`), nunca do modelo antigo.
- **Guarda:** `page.tsx` e `move-conversation-dialog.tsx` saíram de `CONGELADOS` em `apps/web/src/sem-crm-antigo.test.ts`; o regex dá 0 achados nos dois e o teste segue verde. `contact-card.tsx` continua na lista (o `deal-screen.tsx` ainda o usa até o 3.5.4).

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (traçador, página e gestos) | `7538f7a` | `7fa6edd` |
| 2 (coluna do Contato) | `1358421` | `77674d5` |
| 3 (mover Conversa) | `7e635f1` | `1236505` (+ docs `28a2076`) |

Avaliação semântica do RED (plano `type: execute`, então não rodei `gsd check tdd-red-evidence`):

- **Task 1:** 6 dos 8 casos falharam por asserção (`expected 'cnt_2' to be 'ctt_ana'` no fio, `expected [] to deeply equal [ { … } ]` nas gravações, "Unable to find an element with the text" na recusa); o (6) e o (8) já passavam (o ramo do Grupo e o "não existe" do código antigo coincidem com o esperado) e protegem a regressão.
- **Task 2:** 3 dos 5 casos novos falharam por asserção ("Unable to find an element with the text: Gama", "Unable to find role=combobox and name Qualificação"); (9) testa a função `empresaDoContato` que já existia desde a Task 1 e (12) testa `TarefasDoContato`, que já lia só Vínculos, então ficaram como proteção.
- **Task 3:** os 3 casos falharam por asserção ("Unable to find an accessible element with the role combobox and name Contato de destino"). O diálogo antigo abria porque o seed tem uma Conversa `cnv_1`.
- Não houve REFACTOR separado.

## Verificação

- `apps/web`: suíte inteira 1253/1253 (129 arquivos); `pagina-da-conversa.test.tsx` 16/16; `tsc --noEmit` limpo; `eslint src/features/crm src/app` sem achados; `verificar-tokens.mjs` 0 falhas.
- Critérios de aceitação: `grep -cE "assignConversation|reopenConversation|resolveConversation|trashConversation"` na página = 0; `grep -c "useConversa("` na página = 1; `grep -c "contact-card"` na página = 0; `grep -c qualificacao coluna-do-contato.tsx` = 6; `grep -c moveConversationToContact` no diálogo = 0, `grep -c moverConversa` = 2.
- Regex da guarda `sem-crm-antigo` (`(state|data|estado|s|d)\.(contacts|companies|deals|funnels|channels|…)`): 0 achados em `page.tsx`, `move-conversation-dialog.tsx`, `coluna-do-contato.tsx`, `conversa-de-grupo-na-caixa.tsx` e `tarefas-do-contato.tsx`.
- Não rodei `npm test` nem `npm run check` (regra do projeto); rodei o workspace web inteiro e os arquivos por caminho.

## Deviations from Plan

### Auto-fixed Issues

**1. [Escolha do executor] O destino de mover usa `SeletorDeRegistro`, não `useContatos` direto**
- O plano cita `useContatos({ q })`. O `SeletorDeRegistro` já é o seletor de Contato dos diálogos de mesclar e transferir: bate no mesmo `GET /contatos?q=…&limite=10&estado=ativo`, com debounce de 300 ms, teclado e `excluirIds`. Reaproveitá-lo evita um segundo seletor. O contrato do truth ("lista Contatos de `GET /contatos?q=`, sem o Contato atual") vale e o teste (14) o prova pela URL.

**2. [Rule 3 - Blocking] Quatro arquivos fora de `files_modified`**
- `conversa-de-grupo-na-caixa.tsx` (o ramo do Grupo não podia ficar na página: o critério de aceitação exige zero das quatro operações antigas nela, mas Grupo continua no modelo antigo por F14-D-05), `empresa-do-contato.ts` (a regra da Empresa, pura e testada, usada pelo cabeçalho e pela coluna), `apps/web/src/sem-crm-antigo.test.ts` (saída de `CONGELADOS`, pedida pelos critérios de sucesso) e `apps/web/CONTEXT.md`.

**3. [Rule 1 - plano diverge do contrato] A Empresa "mais antiga" usa `inicio`, não `criado_em`**
- O 15-05 escolhe pelo `criado_em` do vínculo; o `ContatoDetalhado` não o traz. A tela usa o menor `inicio` (sem `inicio` vem depois, empate = ordem da api). Para a maioria dos Contatos dá a mesma Empresa; difere só quando a data de início e a de criação do vínculo discordam.

**4. [Visível, aberto em WINDOWS.md] A coluna do Contato perdeu quatro detalhes do cartão antigo (linha 40)**
- Sem o ponto verde de "janela de resposta aberta" (dependia das Mensagens do modelo antigo); LinkedIn e Tarefa deram lugar a Instagram e Abrir ficha (o Contato novo só tem telefone, e-mail, WhatsApp e Instagram; a criação de Tarefa continua no botão do painel); o "Resumo do contato" mostra a descrição do Contato (o campo escrito pelo Agente Enriquecedor não existe no modelo novo); o painel Tags da Conversa saiu (`plataforma.conversas` não guarda Tags).

**5. [Visível, aberto em WINDOWS.md] Conversa de grupo ainda resolve, reabre, atribui e vai à lixeira pelas operações antigas (linha 41)**
- Só no componente do Grupo; sai com as Sessões 6 e 7.

**Total deviations:** 1 Rule 1, 1 Rule 3, 1 escolha, 2 visíveis abertas em WINDOWS.md. **Impact:** a página, a coluna e o diálogo funcionam todos pelo CRM novo; as duas linhas abertas são limites de produto do modelo novo ou do Grupo adiado, não perda de dado. Nenhuma linha de `.planning/WINDOWS.md` de fase 15 foi resolvida por este plano.

## Known Stubs

Nenhum. "Carregando a conversa…" e "Carregando o Contato…" são os estados reais de espera das leituras.

## Threat Flags

Nenhum. T-15-58 (gesto sem permissão): a tela só desliga o item com `usePodeNoCrm` e a api decide; a recusa dela aparece. T-15-59 (qualificação fora do Catálogo): a coluna só oferece itens ativos do Catálogo e a api confere. Todo texto vindo da api (título da Conversa que colide, nome do Contato, recusa) entra como texto React, sem `dangerouslySetInnerHTML`.

## Observações para os planos seguintes

1. **15-25:** `ColunaDoContato` não tem a Nota rápida (o botão leva à ficha do Contato, onde as Notas moram); se o 15-25 ligar a Nota ao fio, o `onNota` pode entrar aqui.
2. **15-32/15-33:** `contact-card.tsx` ainda é usado só por `deal-screen.tsx` (o 3.5.4 o tira); `conversa-de-grupo-na-caixa.tsx` é o último usuário de `assignConversation`, `resolveConversation`, `reopenConversation` e `trashConversation` na web.
3. **15-42:** `ContactAvatar`/`tarefasConversacionaisDoContato` continuam em uso; `canalPadraoDoTipo` (modelo antigo) agora só é chamado por `contact-card.tsx`.
4. `requirements.ready-ids` respondeu 0/2 para UCR-05 e UCR-06 (outros planos que os declaram ainda não têm SUMMARY): não marquei nenhum como concluído.

## Self-Check: PASSED

Arquivos criados presentes em disco (`coluna-do-contato.tsx`, `conversa-de-grupo-na-caixa.tsx`, `empresa-do-contato.ts`, `pagina-da-conversa.test.tsx`); os sete commits (`7538f7a`, `7fa6edd`, `1358421`, `77674d5`, `7e635f1`, `1236505`, `28a2076`) são ancestrais de `HEAD`.
