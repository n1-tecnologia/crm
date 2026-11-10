---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 14
subsystem: api
tags: [fastify, gesto-misto, tarefa-conversacional, negocios, conversas, postgres, zod]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "14-02 trocarCanalDaTarefaNasTabelas, vincularNegocioATarefaNasTabelas e ligarNegocioNovoATarefaNasTabelas; 14-03 executarGestoMisto; 14-04 Contato mesclado somente leitura; 14-13 lerParaConversa, abrirConversaNoCliente e o serviço da Tarefa conversacional"
provides:
  - "POST /tarefas-conversacionais/:taskId/canal: troca o Canal da Tarefa, reaproveita ou abre a Conversa em plataforma.conversas, troca só o Vínculo"
  - "POST /tarefas-conversacionais/:taskId/negocio: liga (ou desliga com null) o Negócio ativo do Contato da Tarefa"
  - "POST /tarefas-conversacionais/:taskId/negocio/novo: cria o Negócio na 1ª Etapa e liga a Tarefa a ele no mesmo commit"
  - "criarNegocioNoCliente, prepararNegocioNovo, recusaDeFormaDoNegocio e FRASES_DE_NEGOCIOS em servicos/crm/negocios.ts; inserir de Negócios aceita id"
  - "ServicoDeTarefasConversacionais.trocarCanal, vincularNegocio e criarNegocio"
affects: [14-15, 14-16, 14-17, fase-15-telas-no-modelo-novo]

actuals:
  tokens: 17700
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Gesto misto com `ausente`: quando lerDoCrm não acha a Tarefa (inexistente, sem Contato, que o Membro não escreve), devolve { ausente: true } e a operação pura do domínio dá a frase da recusa dentro da mesma transação"
    - "prepararNegocioNovo (só lê) em lerDoCrm e criarNegocioNoCliente em gravarNoCrm: a recusa previsível volta como valor antes de gravar, sem destruir a conexão do pool"

key-files:
  created: []
  modified:
    - apps/api/src/servicos/crm/tarefas-conversacionais.ts
    - apps/api/src/servicos/crm/tarefas-conversacionais.test.ts
    - apps/api/src/rotas/crm/tarefas-conversacionais.ts
    - apps/api/src/rotas/crm/tarefas-conversacionais.test.ts
    - apps/api/src/servicos/crm/negocios.ts
    - apps/api/src/servicos/crm/negocios.test.ts
    - apps/api/src/repositorios/crm/negocios.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "O Contato da Tarefa vem do Vínculo lido no estado hidratado dentro de lerDoCrm; se o do Vínculo foi mesclado, a api segue mesclado_em_id (até 5 saltos) para o sobrevivente. O corpo nunca diz Contato nem Conversa (contatoId e conversaId dão 400)."
  - "Trocar o Canal exige o Papel de criar Conversa; ligar exige ler Negócio; criar Negócio exige criar Negócio. Em ligar, o Convidado passa no Papel e é recusado pela operação do domínio (409 RECUSA_DO_DOMINIO)."
  - "criarNegocioNoCliente fica com Papel e forma FORA (como o plano manda); o Proprietário já resolvido vai em entrada.proprietarioId. A pré-checagem (Funil, Etapa, Empresa, Contato) é prepararNegocioNovo, chamada em lerDoCrm, para a recusa voltar como valor."
  - "Contato arquivado ou na lixeira recusa criar Negócio pela Tarefa (409 CONTATO_INATIVO): Negócios aceitam arquivado, a Tarefa conversacional não. É conferido no serviço da Tarefa, como o 14-04 deixou combinado."
  - "Ligar trava o Negócio (for update): ele não vai para a lixeira entre a conferência e o Vínculo."
  - "/negocio/novo responde 201; /canal e /negocio respondem 200."

patterns-established:
  - "Quem precisa de uma conferência de leitura e de uma escrita da mesma regra separa as duas (prepararNegocioNovo e criarNegocioNoCliente): lerDoCrm pré-checa, gravarNoCrm grava"

requirements-completed: [UNI-15, UNI-16]

coverage:
  - id: D1
    description: "Trocar o Canal abre a Conversa de e-mail em plataforma.conversas (com a Mensagem), o Vínculo da Tarefa passa a ela e a Conversa de WhatsApp continua aberta e ativa; nada novo em registros conversations"
    requirement: "UNI-15"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#trocarCanal com Mensagem e sem aberta no Canal novo"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-07 na troca: Conversa aberta no Canal novo é reaproveitada sem Mensagem nova; sem aberta e sem Mensagem é 400 campo mensagem"
    requirement: "UNI-15"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#trocarCanal o Contato já tem Conversa aberta no Canal novo"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#trocarCanal sem Conversa aberta no Canal novo e sem Mensagem"
        status: pass
    human_judgment: false
  - id: D3
    description: "Canal fora da Lista, desconectado, de outro Espaço ou arquivado, Tarefa inexistente ou sem Contato e Convidado recusam sem deixar Conversa, Mensagem nem Vínculo novo; trocar para o Canal atual é ok e não grava nada"
    requirement: "UNI-15"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#trocarCanal (recusas, igual, Convidado)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ligar confere em plataforma.negocios que o Negócio é ativo e do Contato da Tarefa (outro Contato, outro Espaço, arquivado, lixeira e inexistente dão 409 com a mesma frase); null desliga; nada em registros deals"
    requirement: "UNI-16"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#vincularNegocio"
        status: pass
    human_judgment: false
  - id: D5
    description: "Criar Negócio pela Tarefa cria 1 linha em plataforma.negocios na 1ª Etapa, do Contato da Tarefa, e o Vínculo com esse id; quando a Tarefa já tem Negócio, o Negócio NÃO fica"
    requirement: "UNI-16"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#criarNegocio (cria, o Negócio NÃO fica, Funil, Contato)"
        status: pass
    human_judgment: false
  - id: D6
    description: "criarNegocioNoCliente é o mesmo código de POST /negocios (extraído): os casos existentes de Negócios passam sem edição, e o novo prova id explícito dentro de outra transação"
    requirement: "UNI-16"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/negocios.test.ts + apps/api/src/rotas/crm/negocios.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "As três rotas só aceitam o que o navegador pode dizer (.strict()): Contato, Conversa, Etapa, Proprietário e workspaceId no corpo dão 400"
    requirement: "UNI-15"
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/tarefas-conversacionais.test.ts#/canal, /negocio, /negocio/novo"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-04
status: complete
plan_head_before: 1fd4f3cd7816b4a4d210df7a6e547466b60149f7
plan_head_after: 448de4f4cea417cfd529393df287f4c281f77332
commits: 4
---

# Phase 14 Plan 14: Trocar Canal e ligar ou criar Negócio da Tarefa Summary

**Três rotas da Tarefa conversacional pelo gesto misto: `POST /tarefas-conversacionais/:taskId/canal` reaproveita ou abre a Conversa no Canal novo e troca só o Vínculo; `/negocio` liga ou desliga o Negócio ativo do Contato dela; `/negocio/novo` cria o Negócio pelo mesmo `criarNegocioNoCliente` de `POST /negocios` e só o insere depois que o Vínculo é aceito.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-11-04
- **Tasks:** 2 (TDD: RED e GREEN por tarefa)
- **Files modified:** 8

## Accomplishments

- **Trocar Canal (UNI-15):** `lerDoCrm` lê a Tarefa e o Contato do Vínculo no estado hidratado (o sobrevivente, se mesclado), reusa `lerParaConversa` do 14-13 (trava o Contato, confere Canal e Identificador, acha a aberta ou gera o id, aplica D-07) e lê o nome do Canal que sai. A operação pura troca só o Vínculo; `gravarNoCrm` abre a Conversa com o id gerado antes, só quando a troca mudou algo. A Conversa anterior fica `aberta` e `ativo` na Caixa. Trocar para o Canal atual é 200 com `mudou: false` e nada gravado.
- **Ligar e desligar Negócio (UNI-16):** o Negócio é lido em `plataforma.negocios` com `workspace_id` e `contato_id` iguais ao Contato do Vínculo e `estado = ativo`; qualquer outro é 409 `NEGOCIO_DE_OUTRO_CONTATO`. Também é gesto misto (a conferência e o Vínculo na mesma transação), com o Negócio travado.
- **Criar Negócio pela Tarefa:** `criarNegocioNoCliente` (extraído de `POST /negocios`, que agora o chama) e `prepararNegocioNovo` (só lê). `lerDoCrm` pré-checa forma, Funil, Etapa e Contato; `gravarNoCrm` insere o Negócio com o id escolhido antes. Se a operação recusa (a Tarefa já tem Negócio), `gravarNoCrm` não roda e o Negócio não fica.
- Repositório de Negócios: `inserir` aceita `id` (sem ele o default da 007 decide).
- Nada novo em `registros` nas coleções `conversations` e `deals` (provado por contagem nos testes).

## Task Commits

1. **Task 1: trocar o Canal** - `eb3311b` (test, RED), `ebb78b9` (feat, GREEN)
2. **Task 2: ligar, desligar e criar o Negócio** - `2694394` (test, RED), `448de4f` (feat, GREEN)

**Plan metadata:** commit `docs(14-14)` seguinte (SUMMARY, STATE e ROADMAP).

## Files Created/Modified

- `apps/api/src/servicos/crm/tarefas-conversacionais.ts` - `trocarCanal`, `vincularNegocio`, `criarNegocio`; helpers `contatoVigenteDaTarefa`, `tarefaEContato`, `recusaDoAusente`, `recusaDeFormaDaMensagem`
- `apps/api/src/rotas/crm/tarefas-conversacionais.ts` - as três rotas e os schemas `TROCA_DE_CANAL`, `LIGAR_NEGOCIO`, `NEGOCIO_NOVO_DA_TAREFA`
- `apps/api/src/servicos/crm/negocios.ts` - `criarNegocioNoCliente`, `prepararNegocioNovo`, `recusaDeFormaDoNegocio`, `FRASES_DE_NEGOCIOS`; `funilAtivo` e `etapaDoFunil` subiram para o módulo
- `apps/api/src/repositorios/crm/negocios.ts` - `LinhaDeNegocio.id` opcional
- `apps/api/src/rotas/CONTEXT.md` - as três rotas e a Atenção da 3.3.6 (Negócio da Empresa não aparece)
- Testes: serviço (Postgres local), rota (serviço falso), e um caso novo em `negocios.test.ts`

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Interpretação] `titulo` do `/negocio/novo` é `TEXTO_CURTO.min(1).optional()`**
- O plano diz `TEXTO_CURTO.optional()`. Título vazio daria o título da Tarefa em silêncio; `min(1)` devolve 400. Um título que a tela não preencheu simplesmente não vai no corpo.
- **Files modified:** `apps/api/src/rotas/crm/tarefas-conversacionais.ts`

**2. [Interpretação] `VALOR` definido na rota nova, não importado de `rotas/crm/negocios.ts`**
- A constante não é exportada lá e esse arquivo não está nos `files_modified`. Usa o mesmo `VALOR_DECIMAL` do domínio e a mesma frase.

**3. [Interpretação] `prepararNegocioNovo` e `recusaDeFormaDoNegocio` exportados, além de `criarNegocioNoCliente`**
- O plano pede só `criarNegocioNoCliente`. Sem a pré-checagem em `lerDoCrm`, uma recusa de Funil dentro de `gravarNoCrm` destruiria a conexão do pool (lição do 14-03). O comportamento de `POST /negocios` é o mesmo (os casos existentes passam sem edição).

**4. [Rule 3 - Bloqueio, teste] Cada Espaço de teste conta os ids de Tarefa do zero**
- A Tarefa "de outro Espaço" tinha o mesmo `tsk_N` de uma Tarefa daqui e a troca a aceitava. O teste cria Tarefas a mais no outro Espaço até o id passar do último daqui. Sem mudança de código de produção.

---

**Total deviations:** 3 interpretações do plano documentadas, 1 ajuste de teste
**Impact on plan:** nenhum escopo a mais; nada fora de `files_modified`, além de SUMMARY, STATE e ROADMAP.

## Issues Encountered

- Ordem das recusas na troca de Canal: se o par (Contato, Canal novo) não tem Conversa aberta e o corpo não traz `mensagem`, a recusa 400 de D-07 vem ANTES de "Canal fora da Lista" e "Canal desconectado" (`lerParaConversa` olha o par primeiro). Com `mensagem` a recusa de Canal é a 409 com `campo: "canal"`. O seletor da tela só oferece Canais da Lista, então não aparece na prática.
- Nenhuma falha de baseline neste plano: `outbox-worker.test.ts` e `colunas-geradas.test.ts` passaram na primeira rodada, em banco novo.

## Verification

Postgres 16 descartável (`crm-n1-pg-1414`, porta 55614, migrado até a 011), removido ao fim:

- `npx tsc --noEmit` em `apps/api`: sem erro.
- `DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` (sem banco): 132 arquivos passam, 45 pulados (os que pedem banco), 1390 testes passam. Inclui a guarda D-06 da api.
- Com banco: `src/persistencia` inteiro 20/20 arquivos, 181 testes; `src/rotas/operacoes.test.ts` e `src/rotas/estado.test.ts` 2/2 arquivos, 52 testes; `src/servicos/crm`, `src/rotas/crm`, `src/repositorios` e a guarda D-06: 30/30 arquivos, 573 testes.
- `packages/dominio/src/sem-listas-espelho.test.ts`: 2/2 (o domínio não foi tocado).
- Critérios de aceitação: `trocarCanalDaTarefaNasTabelas` no serviço (3), `/tarefas-conversacionais/:taskId/canal` na rota (2), `export async function criarNegocioNoCliente` (1), `criarNegocioNoCliente` no serviço da Tarefa (2), `/negocio/novo` na rota (2).

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além das do `<threat_model>`: T-14-35 (Negócio conferido por `workspace_id` e `contato_id` do Vínculo), T-14-36 (`taskWriteRefusal` na operação pura, dentro da transação) e T-14-37 (o Negócio só é inserido em `gravarNoCrm`) mitigadas e testadas.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Para os próximos planos:

- **14-15 e 14-16 (web):** `POST /tarefas-conversacionais/:taskId/canal` com `{ canalId, mensagem? }` devolve 200 `{ ok, dados }`, `dados` é o corpo recortado de `POST /operacoes` (`value: { task, mudou }`) mais `conversa: { id, aberta }`. `/negocio` com `{ negocioId: string | null }` devolve `value` = a Tarefa. `/negocio/novo` com `{ funilId, titulo?, valor? }` devolve 201, `value` = a Tarefa e `negocio: { id, titulo }`. A ficha lê `dados.value`, como na criação.
- **Serviço falso em teste:** todo `ServicoDeTarefasConversacionais` falso precisa de `criar`, `resumo`, `trocarCanal`, `vincularNegocio` e `criarNegocio`.
- **Ordem das recusas na troca:** sem Conversa aberta e sem `mensagem`, a tela recebe 400 `mensagem` antes da recusa de Canal da Lista ou desconectado (ver Issues Encountered).
- **14-17 (corte):** o Negócio da Empresa do Contato não aparece para ligar (a 007 dá um dono por Negócio); trazê-lo é decisão à parte, registrada em `rotas/CONTEXT.md`. A pendência do 14-12 (`instantiateListTemplate` sem `canais`) segue aberta.

## Self-Check: PASSED

- Arquivos modificados existem: `apps/api/src/servicos/crm/tarefas-conversacionais.ts`, `apps/api/src/rotas/crm/tarefas-conversacionais.ts`, `apps/api/src/servicos/crm/negocios.ts`, `apps/api/src/repositorios/crm/negocios.ts`, `apps/api/src/rotas/CONTEXT.md` e os três arquivos de teste.
- Commits na branch: `eb3311b`, `ebb78b9`, `2694394`, `448de4f`.
