---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 16
subsystem: configuracoes
tags: [bootstrap, funil-padrao, configuracoes, governanca, tdd, ucr-07, ucr-11]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-06: useFunis/useContatos em dados/crm e as guardas sem-crm-antigo com CONGELADOS"
provides:
  - "Workspace sem defaultFunnelId; buildGestaoBootstrap cria Espaco sem Funil (D-15-13)"
  - "Configuracoes mostra o Funil padrao de useFunis (padrao = true) ou o link 'Crie seu primeiro Funil'"
  - "Campos, Tags e Catalogos sem contagem do CRM antigo ('O uso no CRM nao aparece aqui.')"
  - "Governanca (resolveResource) sem Funil como Recurso"
affects: [15-21, 15-33, 15-43]

plan_head_before: 154c4ce80d066359945eda86231816a88b65f398
plan_head_after: 19392bf6b001d1708a64248ca2f0389659fce2df

actuals:
  tokens: 8800
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "campo removido do tipo e provado por Object.keys(...).filter(/funnel/i) em vez de citar o nome (o criterio de aceitacao conta ocorrencias do texto)"
    - "onde havia contagem do CRM antigo, uma frase fixa em vez de um zero falso"

key-files:
  created:
    - apps/web/src/features/configuracoes/configuracoes-sem-crm-antigo.test.tsx
  modified:
    - packages/dominio/src/types/workspace.ts
    - packages/dominio/src/bootstrap-gestao.ts
    - packages/dominio/src/bootstrap-gestao.test.ts
    - packages/dominio/src/seed.ts
    - packages/dominio/src/sem-crm-antigo.test.ts
    - apps/api/src/bootstrap/conferir-contas-a-receber.ts
    - apps/api/src/bootstrap/gestao.test.ts
    - apps/api/src/bootstrap/CONTEXT.md
    - apps/web/src/app/(shell)/configuracoes/page.tsx
    - apps/web/src/app/(shell)/configuracoes/campos/page.tsx
    - apps/web/src/app/(shell)/configuracoes/tags/page.tsx
    - apps/web/src/app/(shell)/configuracoes/catalogos/page.tsx
    - apps/web/src/features/configuracoes/governance-access-dialog.tsx
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md

key-decisions:
  - "Um Espaco novo nasce sem Funil: o Funil padrao e o de plataforma.funis.padrao e Workspace nao guarda mais defaultFunnelId (D-15-13)"
  - "Configuracoes distingue 'ainda nao chegou' ('—') de 'nao ha Funil' (link 'Crie seu primeiro Funil'), para nao afirmar falta de Funil durante o carregamento"
  - "O limite de Contatos de /configuracoes vem do total de useContatos({ limite: 1 }), nao do estado antigo"
  - "Tags e Campos tambem perdem a contagem de Conversa e Empresa (nao so Contato e Negocio); Grupo, Comunidade e Flow seguem contando no modelo antigo de Conversa (F14-D-05)"

requirements-completed: [UCR-07, UCR-11]

coverage:
  - deliverable: "buildGestaoBootstrap nasce sem Funil e sem defaultFunnelId; repetir o bootstrap recusa e nao cria Funil"
    verification:
      - { kind: test, ref: "packages/dominio/src/bootstrap-gestao.test.ts#um Espaço novo nasce sem Funil e sem nada do CRM", status: pass }
      - { kind: test, ref: "apps/api/src/bootstrap/gestao.test.ts#segunda execução não grava — Espaço não está mais vazio", status: pass }
    human_judgment: false
  - deliverable: "Configuracoes mostra o Funil padrao da tabela ou 'Crie seu primeiro Funil'"
    verification:
      - { kind: test, ref: "apps/web/src/features/configuracoes/configuracoes-sem-crm-antigo.test.tsx#Configurações — Funil padrão (D-15-13)", status: pass }
    human_judgment: true
    rationale: "O teste confere texto e link com o hook mockado; como a linha aparece na tela real, com a api, e juizo visual do fim da fase."
  - deliverable: "Campos, Tags e Catalogos sem contagem do CRM antigo"
    verification:
      - { kind: test, ref: "apps/web/src/features/configuracoes/configuracoes-sem-crm-antigo.test.tsx#Catálogos / Tags / Campos", status: pass }
    human_judgment: true
    rationale: "A frase 'O uso no CRM nao aparece aqui.' e uma escolha de texto de interface; o teste so prova que ela aparece e que o numero antigo nao."
  - deliverable: "Governanca sem Funil como Recurso"
    verification:
      - { kind: test, ref: "apps/web/src/features/configuracoes/configuracoes-sem-crm-antigo.test.tsx#Governança — Funil antigo não é Recurso", status: pass }
    human_judgment: false
---

# Phase 15 Plan 16: Espaço novo sem Funil e Configurações sem o CRM antigo Summary

**`Workspace` perde `defaultFunnelId` e `buildGestaoBootstrap` cria o Espaço sem Funil (D-15-13); `/configuracoes` lê o Funil padrão de `useFunis` ("Crie seu primeiro Funil" quando não há); Campos, Tags e Catálogos trocam a contagem do CRM antigo por "O uso no CRM não aparece aqui."; e a Governança não reconhece mais Funil como Recurso.**

## Performance

- **Tasks:** 2 (1 tracer, 1 auto), as duas `tdd="true"`
- **Files:** 1 criado, 15 modificados
- **Commits:** 4 (2 RED + 2 GREEN), medidos de `plan_head_before`
- **Duração:** não medida (o início não foi registrado); inclui a espera do Docker e das suítes

## Accomplishments

- **Traçador (domínio → api → tela):** o campo saiu do tipo `Workspace` (`types/workspace.ts`) e dos três lugares que o preenchiam (`bootstrap-gestao.ts`, `seed.ts`, `conferir-contas-a-receber.ts`). O bootstrap deixou de montar o Funil `fnl_padrao` (e o import de `Funnel`); o comentário que o justificava como "mínimo estrutural" virou a explicação de D-15-13. O Agente padrão continua nascendo com o Espaço (B33). `bootstrap-gestao.ts` saiu de `CONGELADOS` do domínio (0 acertos do regex).
- **Configurações:** `useFunis({ estado: "ativo" })` e o item com `funil.padrao`. Com a lista vazia a linha é o link "Crie seu primeiro Funil" para `/crm/funis`; enquanto a lista não chegou mostra "—" (não afirma que não há Funil). Ver deviation 1 sobre o limite de Contatos.
- **Campos, Tags, Catálogos:** só o uso em Tarefas continua contado (vive no estado). Catálogos: toda linha mostra "O uso no CRM não aparece aqui." Tags: "N Tarefas" (ou "em nenhuma Tarefa") mais a frase em segunda linha. Campos: Definição de Tarefa conta registros; Contato, Empresa, Negócio e Conversa mostram a frase. Grupo, Comunidade e Flow continuam contando no modelo antigo de Conversa (F14-D-05).
- **Governança:** `resolveResource` (agora exportada, para o teste) perdeu o ramo de Funil; o Funil novo é governado por `privado` e pelo Papel (`podeNoCrm`) no servidor.
- **Guarda:** `configuracoes/page.tsx`, `campos/page.tsx`, `tags/page.tsx`, `catalogos/page.tsx` e `governance-access-dialog.tsx` saíram de `CONGELADOS` da web, e `bootstrap-gestao.ts` da do domínio, todos provados por grep com o regex da guarda (0 acertos).
- **Borda UCR-07 / UCR-11 (idempotência):** `gestao.test.ts` repete o bootstrap e confere que ele recusa ("já tem N registros"), o número de linhas não muda e `state.funnels` segue vazio.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (traçador) | `b6e6f0b` | `49da7b9` |
| 2 | `9cca909` | `19392bf` |

Avaliação semântica do RED (plano `type: execute`, então não rodei `gsd check tdd-red-evidence`; a avaliação é manual):

- **Tarefa 1, domínio:** falhou na asserção planejada (`expected [ { id: 'fnl_padrao', …(9) } ] to deeply equal []`). **Api:** os dois casos de `gestao.test.ts` falharam com `expected 1 to be +0` (o Funil do bootstrap era gravado e relido), contra Postgres local, nenhum pulado. **Web:** 3 dos 4 casos falharam por `getByText` (o nome do Funil padrão, o link e `7 de 5.000` não existiam); o quarto ("enquanto a lista não chegou") passou já no RED, de propósito: protege contra o falso "Crie seu primeiro Funil" no carregamento.
- **Tarefa 2:** 5 dos 6 casos novos falharam por asserção (frase ausente, `2 Tarefas` dentro de um texto único com Contatos, `expected { type: 'funnel' } to be null`); o sexto (Espaço, Pasta, Lista e Coleção continuam Recurso) passou no RED de propósito, porque trava o que não pode mudar. Para a asserção do Funil falhar por valor e não por `is not a function`, o commit RED exporta `resolveResource` sem mudar comportamento.
- Sem REFACTOR separado.

## Verificação

Tudo contra Postgres 16 local em Docker (`crm-n1-pg-1516`, porta 55716, 001 a 012 aplicadas), com as duas URLs explícitas; recriado do zero antes da verificação final; parado no fim.

- Domínio: suíte inteira 124 arquivos, 2382/2382; `tsc --noEmit` limpo.
- Api: `src/bootstrap` + guarda de fonte 8 arquivos, 34/34 (nenhum pulado); `e2e/criar-conta`, `integracao-comentario-aprovacao`, `formularios-publicos-editavel` e `scheduler-worker` (os que usam `buildGestaoBootstrap`) 53/53; `tsc --noEmit` limpo.
- Web: suíte inteira 120 arquivos, 1150/1150; `eslint` nas pastas de Configurações sem achados; `verificar-tokens` 0 falhas; `tsc --noEmit` limpo.
- Critérios de aceitação: `grep -rn defaultFunnelId packages/dominio/src apps/api/src apps/web/src | wc -l` = 0; `funnels.push` em `bootstrap-gestao.ts` = 0; "Crie seu primeiro Funil" em `configuracoes/page.tsx` = 1; `state.(contacts|deals|funnels)` nos quatro arquivos da Tarefa 2 = 0.
- Não rodei `npm test` nem `npm run check` inteiros (regra do projeto: o `npm test` fala com o banco de produção do `.env`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `configuracoes/page.tsx` ainda lia `state.contacts` (limite de Contatos)**
- **Found during:** Task 1, conferência da guarda `sem-crm-antigo`
- **Issue:** a linha "Limites impostos › Contatos" contava `state.contacts`; sem trocá-la o arquivo não sairia de `CONGELADOS` (o plano manda cada tela provar por grep que saiu do regex) e a tela continuaria mostrando o número do CRM antigo.
- **Fix:** `useContatos({ estado: "ativo", limite: 1 })` e o `total` da api (traço "—" até chegar). Coberto por teste (`7 de 5.000`, e nunca o `1` do estado antigo).
- **Files modified:** `apps/web/src/app/(shell)/configuracoes/page.tsx`, teste
- **Commit:** `49da7b9`

**2. [Rule 2 - Missing critical] Contagem de Empresa e de Conversa também saiu de Tags e Campos**
- **Found during:** Task 2
- **Issue:** o plano cita Contato e Negócio, mas `state.companies` casa o regex da guarda e a contagem de Conversa do estado seria o modelo antigo; deixar as duas mostraria números que não são os do Espaço.
- **Fix:** Contato, Empresa, Negócio e Conversa viram a frase; Grupo, Comunidade e Flow seguem no modelo antigo de Conversa (F14-D-05). Registrado como linha aberta em `.planning/WINDOWS.md`.
- **Files modified:** `tags/page.tsx`, `campos/page.tsx`
- **Commit:** `19392bf`

**3. Arquivos fora de `files_modified`**
- `apps/api/src/bootstrap/CONTEXT.md`, `apps/web/CONTEXT.md` (uma nota cada), `packages/dominio/src/sem-crm-antigo.test.ts` e `apps/web/src/sem-crm-antigo.test.ts` (linhas a menos em `CONGELADOS`). Só documentação e a guarda; nenhum código de produção fora do plano.

**Total deviations:** 2 auto-fixed (Rule 3, Rule 2), 0 arquiteturais. **Impact:** a Tarefa 1 ganha um hook a mais na página; Tags e Campos mostram menos números do que o plano descrevia, por escolha explícita registrada.

## Known Stubs

Nenhum. A frase "O uso no CRM não aparece aqui." é o comportamento decidido pelo plano (3.4.7), não um stub de dado; a linha aberta em `WINDOWS.md` registra o que faltaria para devolver o número.

## Threat Flags

Nenhum. T-15-40 (bootstrap criando CRM antigo) mitigado: o bootstrap não cria Funil, com teste de domínio e de api, e a guarda de fonte cobre o resto. T-15-41 (concessão de acesso a Funil antigo): o ramo saiu, com teste; o Funil novo segue `privado` + Papel no servidor, sem tocar nele.

## Observações para os planos seguintes

1. Linha aberta em `WINDOWS.md` (fase 15): Tags, Campos e Catálogos sem o número de uso do CRM; e a Governança não tem tela para conceder acesso a Funil novo privado (só Espaço, Pasta, Lista e Coleção).
2. `Workspace.defaultFunnelId` sai; o `state.funnels` do `DataState` continua existindo (o seed demo ainda monta Funis) até o 15-43.
3. O link "Crie seu primeiro Funil" aponta para `/crm/funis`, a lista de Funis que `useFunis` já serve.

## Self-Check: PASSED

Arquivo criado presente em disco; os quatro commits da tarefa são ancestrais de `HEAD`; container `crm-n1-pg-1516` parado.
