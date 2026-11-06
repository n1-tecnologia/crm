---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 25
subsystem: crm
tags: [fio-da-conversa, nota, consentimento, ficha-da-tarefa, vinculos, nomes, tdd, ucr-04, ucr-05]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-05 (useResumoDaTarefa com Contato, Canal, Conversa e Negocio), 15-10 (useNomesDoCrm) e 15-20 (o fio por ids)"
provides:
  - "a aba Nota interna do fio grava por adicionarNotaAoContato (POST /contatos/:id/notas), com validarNovaNota e recusaDeNotaNoContato antes da api e sem duplo envio"
  - "o aviso de consentimento de marketing do fio pela regra do CRM novo: consentimentoVigente sobre useConsentimentosDoContato, no tipo do Canal da aba"
  - "tarefa-completa.tsx sem nenhuma leitura do CRM antigo: o fio e o layout de tres colunas acham Contato, Conversa e Canal pelos Vinculos e pelo resumo, e os nomes dos Vinculos vem de POST /crm/nomes"
affects: [15-33, 15-40, 15-42]

plan_head_before: f3f3b4d2ebd9a21ae1980bbd43e32c0a72f6e039
plan_head_after: 9e0425bfeb71597ed9bfbc48eff9203d0401ccbd

actuals:
  tokens: 10580
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "gesto de escrita como funcao async no componente com ref + estado 'salvando' e a validacao do dominio ANTES da api (molde do envio do 15-20)"
    - "hook de nomes chamado antes do retorno antecipado, com os alvos tirados de state.links e o tipo do Vinculo igual ao TipoDeObjetoDoCrm"
    - "teste da ficha com ConversationThread trocado por um marcador que expoe os ids com que foi montado"

key-files:
  created: []
  modified:
    - apps/web/src/features/crm/conversation-thread.tsx
    - apps/web/src/features/crm/conversation-thread.test.tsx
    - apps/web/src/features/estrutura/tarefa-completa.tsx
    - apps/web/src/features/estrutura/tarefa-completa-gestos.test.tsx
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "A Nota do fio e do Contato, nao da Tarefa: tarefaId continua declarada e nao lida, porque POST /contatos/:id/notas nao tem como aceita-la e o Criar Tarefa nasce da Lista escolhida"
  - "O aviso de consentimento e AVISO, nao bloqueio: o fio nao tem seletor de modelo, entao nada no fio e marketing; quem recusa o modelo de marketing continua sendo a api (recusaPorFaltaDeConsentimento)"
  - "O Contato do fio e o do resumo quando ele chegou (contato null cai no layout de sempre com o aviso) e o do Vinculo enquanto nao chegou; o Canal e sempre o do resumo"
  - "'Registro indisponivel' no lugar do nome quando POST /crm/nomes responde null, sem atalho para o registro (T-15-61); 'Carregando…' enquanto a primeira resposta nao chega"

requirements-completed: []

coverage:
  - deliverable: "a Nota do fio grava em contato_notas por POST /contatos/:id/notas, uma vez, aparada, sem /operacoes"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(21), (22), (23), (24)", status: pass }
    human_judgment: false
  - deliverable: "borda UCR-05: duplo clique grava uma nota so; nota so com espacos e recusada pela frase de validarNovaNota antes da api; a recusa da api aparece e o texto fica"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(22), (23), (24)", status: pass }
    human_judgment: false
  - deliverable: "o aviso de consentimento de marketing do fio pela regra do CRM novo (revogado, concedido, todos, sem registro, outro tipo de Canal, leitura que falha)"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(25) a (29)", status: pass }
    human_judgment: false
  - deliverable: "Criar Tarefa do fio continua por POST /tarefas-conversacionais com os ids do CRM novo"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(15), (16) (inalterados, verdes)", status: pass }
    human_judgment: false
  - deliverable: "a ficha da Tarefa conversacional monta o fio e as tres colunas com os ids do CRM novo, com o Canal do resumo, e o fio pronto para abrir Conversa quando nao ha Vinculo de Conversa"
    verification:
      - { kind: test, ref: "apps/web/src/features/estrutura/tarefa-completa-gestos.test.tsx#(j), (k), (l), (m)", status: pass }
      - { kind: test, ref: "apps/web/src/sem-crm-antigo.test.ts (tarefa-completa.tsx fora de CONGELADOS)", status: pass }
    human_judgment: false
  - deliverable: "os nomes dos Vinculos (Negocio, Contato, Conversa) vem de POST /crm/nomes; null vira Registro indisponivel sem atalho"
    verification:
      - { kind: test, ref: "apps/web/src/features/estrutura/tarefa-completa-gestos.test.tsx#(n)", status: pass }
    human_judgment: false
  - deliverable: "a ficha nao volta a mostrar temperatura, Tags nem historico de Etapas (D-15-06, F14-D-04)"
    verification: []
    human_judgment: true
    rationale: "Nada foi acrescentado dessas tres coisas e a ficha nao as lia; a prova e a ausencia no diff, que nenhum teste afirma"
---

# Phase 15 Plan 25: Nota e consentimento do fio, e a ficha da Tarefa por Vinculos Summary

**A Nota do fio grava em `contato_notas` por `POST /contatos/:id/notas`, o aviso de consentimento de marketing usa `consentimentoVigente` sobre o historico do CRM novo, e a ficha da Tarefa conversacional deixou de ler Contato, Canal e Conversa do estado antigo: o fio e as tres colunas voltam para ids novos e os nomes dos Vinculos vem de `POST /crm/nomes`.**

## Performance

- **Duration:** 11 min (2026-11-06T14:36:28Z a 14:47Z)
- **Tasks:** 3 (1 tracer, 2 auto, todas TDD)
- **Files modified:** 7 (4 do plano, mais `sem-crm-antigo.test.ts`, `apps/web/CONTEXT.md` e `.planning/WINDOWS.md`)

## Accomplishments

- **Task 1 (tracer)**: `registrarNota` no fio: `validarNovaNota` (aparado, vazio, teto) e `recusaDeNotaNoContato` (mesclado, na lixeira) antes da api; `ref` e botao desligado em voo; `adicionarNotaAoContato`; a recusa da api aparece no fio com o texto no campo. Zero `addContactNote` no arquivo.
- **Task 2**: o aviso volta pela regra do CRM novo (`consentimentoVigente` da finalidade "Marketing" do Catalogo, no tipo do Canal da aba). Sem `marketingConsentMissing`.
- **Task 3**: `tarefa-completa.tsx` sem `contatoDaTarefa`, `canalDaTarefa` e sem leitura do CRM antigo do estado. O arquivo saiu de `CONGELADOS` em `apps/web/src/sem-crm-antigo.test.ts`.

## TDD Gate Compliance

| Tarefa | RED | GREEN |
|---|---|---|
| 1 | `8174bd9` test(15-25) | `cbf2fd7` feat(15-25) |
| 2 | `5330707` test(15-25) | `7a2eec1` feat(15-25) |
| 3 | `bd796de` test(15-25) | `a88d4ec` feat(15-25) |

Nenhum REFACTOR (nada a limpar). RED de cada tarefa: o teste-alvo rodou e falhou na asserção do comportamento planejado, e os demais casos do arquivo seguiram verdes.

- **RED 1:** casos (21) a (24) falharam: a Nota ainda ia por `run(addContactNote)` e o store respondia "Contato não encontrado." (o Contato do fio é do CRM novo), sem nenhum `POST /contatos/ctt_ana/notas`. semanticAssessment: alvo executou e falhou pelo motivo certo (nenhuma chamada à rota nova), sem erro de importação ou fixture.
- **RED 2:** casos (25) a (28) falharam: o fio nunca lia `GET /contatos/:id/consentimentos` e não havia aviso. O caso (29) (leitura que falha não inventa aviso) passou no RED por construção: ele é a guarda contra regressão do comportamento novo.
- **RED 3:** casos (j), (k), (m) e (n) falharam: a ficha não montava o fio para ids que o estado antigo não conhece e os nomes saíam de `state.deals`. O caso (l) (Contato que a api não conhece não abre fio) já passava e ficou como guarda.
- A evidência não foi submetida a `gsd_run check tdd-red-evidence` (o `workflow.tdd_mode` do projeto é falso e o relatório do vitest usado foi o padrão, não TAP); a avaliação semântica acima a substitui.

Tracer gate (Task 1): modo interativo, `human_verify_mode` padrão `end-of-phase` e `<verify>` só automatizado: o `<verify>` foi re-rodado de ponta a ponta (24 testes e `tsc --noEmit` verdes) antes de expandir.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - plano diverge do contrato] `consentimentoVigente` não recebe objeto**
- A assinatura real é `consentimentoVigente(registros, finalidadeId, tipoDeCanal)`, não `(consentimentos, { finalidade, tipoDeCanal })` como o plano escreve; a finalidade é o item "Marketing" do Catálogo achado pelo nome, a mesma busca de `finalidadeDeMarketing` na api. O hook é `useConsentimentosDoContato`, não `useConsentimentos` (o plano mandava conferir o nome).

**2. [Escolha do executor, aberta em WINDOWS.md] O aviso de consentimento não é mais ligado a um modelo**
- O fio antigo só mostrava o aviso com um modelo de marketing escolhido. O fio novo não tem seletor de modelo (WINDOWS #31), então amarrar o aviso ao modelo o apagaria para sempre. O plano pede aviso quando o consentimento está recusado e "sem registro: a mesma regra de hoje" (sem consentimento vigente = falta). Implementei isso literalmente: aviso discreto, sem bloqueio, sempre que o vigente não é `concedido`, inclusive Contato sem registro. Pode ser ruidoso para quem nunca teve consentimento registrado; a alternativa (só `revogado`) está dita na linha 43 do ledger.

**3. [Escolha do executor, aberta em WINDOWS.md] Ficha da Tarefa com Vínculos de ids antigos**
- Em produção os Vínculos de hoje apontam para ids do modelo antigo: o resumo responde `contato: null`, a ficha cai no layout de sempre com o aviso "sem Contato" e a lista de Vínculos mostra "Registro indisponível" sem atalho. É o efeito conhecido do deploy da Fase 15 sem o script de migração (D-01) e some quando ele preservar os ids. Linha 42 do ledger.

**4. [Escolha do executor] Contato do fio enquanto o resumo não chegou**
- O plano diz "pelos Vínculos e pelo resumo". Com o resumo na mão vale a palavra dele (sobrevivente de mesclagem, ou `null`); sem ele o fio segue o Vínculo, para a ficha não trocar de layout ao carregar no caso comum. Se o Vínculo for de id antigo e o resumo ainda não chegou, o fio mostra "Contato não encontrado." por uma ida à api.

**5. [Escolha do executor] `tarefaId` continua sem leitura**
- Nota e Criar Tarefa não a pedem (a Nota é do Contato e `POST /contatos/:id/notas` não tem campo de Tarefa). Reescrevi o comentário da prop e o `CONTEXT.md` para dizer isso, em vez de prometer o uso.

**6. [Rule 3 - bloqueio] Dois detalhes de teste**
- `tarefa-completa-gestos.test.tsx` passou a trocar `ConversationThread` por um marcador (o fio tem teste próprio) e a mockar `useNomesDoCrm` (mantendo `nomeDe` real); o cenário reescreve os Vínculos da Tarefa do seed com ids novos.

**Total deviations:** 1 Rule 1, 1 Rule 3, 4 escolhas do executor (2 abertas em WINDOWS.md). **Impact:** nenhum dado perdido; os dois itens visíveis são limites até o script de migração (ids) e uma decisão de produto sobre o ruído do aviso.

## Ledger (WINDOWS.md)

- **Abertas por este plano:** #42 (`tarefa-completa.tsx`, nomes e fio com ids antigos até a migração) e #43 (`conversation-thread.tsx`, aviso de consentimento sem modelo).
- **#31 (15-20): continua aberta.** A parte do aviso de consentimento volta aqui (15-25 Task 2), mas o resto da linha (sem Rascunho de IA e sem Mensagem de modelo) é de outro plano. #32 (aba Meet e 200 últimas) continua aberta.

## Known Stubs

Nenhum. "Carregando…" na lista de Vínculos é o estado real de espera de `POST /crm/nomes`.

## Threat Flags

Nenhum. T-15-60 (XSS no texto da Nota): o texto da Nota não é renderizado neste plano (a Nota vai direto à api e a tela só mostra a frase de aviso); o texto das Mensagens segue como texto do React (caso (5) do 15-20). T-15-61 (nome de Vínculo sem permissão): `null` de `POST /crm/nomes` vira "Registro indisponível" sem atalho, caso (n).

## Verification

- `npx vitest run` em `apps/web`: 129 arquivos, 1267 testes, todos verdes (sem banco).
- `npx tsc --noEmit`, `npx eslint src/features/estrutura src/features/crm` e `node scripts/verificar-tokens.mjs` em `apps/web`: sem saída de erro / 0 falhas.
- Acceptance: `grep -c addContactNote conversation-thread.tsx` = 0; `grep -c adicionarNotaAoContato` = 2; `grep -c marketingConsentMissing` = 0; `grep -cE "contatoDaTarefa|canalDaTarefa|state\.(deals|contacts)" tarefa-completa.tsx` = 0; `grep -c vinculosDoCrmDaTarefa tarefa-completa.tsx` = 2.
- `CONGELADOS`: o regex `LE_O_CRM_ANTIGO` não casa mais com `tarefa-completa.tsx` (grep sem resultado) e a linha saiu da lista; `sem-crm-antigo.test.ts` verde.
- Nenhum banco foi necessário (os testes da web usam `fetch` roteado); nenhum contêiner foi criado.

## Requisitos

`requirements.ready-ids` respondeu 0/2: UCR-04 e UCR-05 são declarados também por planos seguintes da fase que ainda não têm SUMMARY (15-26 em diante; UCR-05 também pelo 15-24, que tem). Nenhum requisito marcado como concluído.

## Observações para os planos seguintes

1. **15-42 (limpeza do domínio):** `contatoDaTarefa`, `canalDaTarefa` e `conversaDaTarefa` de `derive-conversacional.ts` não têm mais chamador de produção na web; os comentários do domínio ainda dizem que o fio e a ficha as chamam.
2. **15-40:** `deal-screen.tsx` segue em `CONGELADOS` e é o último chamador do fio fora da ficha da Tarefa e da Caixa.
3. **Migração:** com o script preservando os ids, #42 e a parte de ids antigos de #32 somem sem mudança de código.

## Self-Check: PASSED

Arquivos modificados presentes em disco; os sete commits da tarefa (`8174bd9`, `cbf2fd7`, `5330707`, `7a2eec1`, `bd796de`, `a88d4ec`, `9e0425b`) são ancestrais de `HEAD`; `git rev-list --count f3f3b4d..9e0425b` = 7.
