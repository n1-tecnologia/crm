---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 05
subsystem: inbox-channels
tags: [dominio, conversa, mensagem, janela-de-resposta, omnichannel, vitest]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "Canal, ConexaoDoCanal, PROVEDORES, provedorDoCanal (08-01); capacidadesDoCanal (08-02)"
provides:
  - "@n1/dominio/crm/conversas: Conversa e tipos da 008, validarNovaConversa, proximaSituacao, tituloDaConversa, TIPO_DE_IDENTIFICADOR_DO_CANAL"
  - "@n1/dominio/crm/mensagens: Mensagem (modelo 7.6, sem cargaBruta), validarNovaMensagem, validarEnvio (RN-CXE-19 por tipo e provedor), statusInicialDeEnvio (B69)"
  - "derive-conversacional: canaisDoFio, canaisDeResposta, canalPadraoDeResposta, canalDaAbaInicial, canalPadraoDoTipo, marcadoresDeCanal, rotuloDoCanal, textoDoSeparadorDeCanal"
affects: [08-06, 08-10, 08-11, 08-12]

actuals:
  tokens: 10500
  tasks: 3
  commits: 6
plan_head_before: 0849fab83717e1d156f5ecc1aed4b8c27a92a140
plan_head_after: 3ac56739832e18ebb3f0693344b65a2803c0641e

tech-stack:
  added: []
  patterns:
    - "Regra de envio pura: validarEnvio recebe as capacidades prontas e o relogio (agora) de quem chama"
    - "Tipo publico sem dado pessoal cru: carga bruta do provedor so no tipo de ingestao interna"
    - "Chave do chat por Canal: abas, padrao de resposta e separador derivados do estado, sem jsdom"

key-files:
  created:
    - packages/dominio/src/crm/conversas.ts
    - packages/dominio/src/crm/conversas.test.ts
    - packages/dominio/src/crm/mensagens.ts
    - packages/dominio/src/crm/mensagens.test.ts
    - packages/dominio/src/derive-conversacional.test.ts
  modified:
    - packages/dominio/src/derive-conversacional.ts

key-decisions:
  - "O RED dos tres modulos e um esqueleto que lanca 'ainda nao implementada' (tipos e constantes ja definitivos), para o tsc ficar verde em todo commit e as falhas serem da afirmacao, nao de modulo ausente."
  - "validarEnvio libera ate o instante exato do fim da janela (agora <= fim), a mesma conta de sendMessage (Date.now() > until)."
  - "canalPadraoDeResposta ignora Conversa na lixeira e so considera Canais de resposta (conectados e que alcancam); o fallback e o primeiro do mesmo tipo da ultima recebida."
  - "canalPadraoDoTipo usa so Canais de resposta do tipo; um Contato sem Canal conectado do tipo devolve undefined (a tela de 08-10 decide o que mostrar)."
  - "rotuloDoCanal de Canal sem provedor (LinkedIn, Chat do site) usa o rotulo do tipo, entao o Chat do site vira 'Chat do site · Chat do site' quando o nome coincide."

patterns-established:
  - "Derivacao de chat recebe (state, contact) e devolve ids ou Channels; nenhuma grava"

requirements-completed: []

coverage:
  - id: D1
    description: "Conversa relacional: nova Conversa exige primeira Mensagem, resolver/reabrir, titulo derivado do Contato, mapa Canal -> Identificador sem telefone"
    requirement: CXE-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/conversas.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mensagem relacional: sem cargaBruta no tipo publico, DIRECOES_DE_ENVIO sem recebida, validarEnvio por (tipo, provedor) e statusInicialDeEnvio"
    requirement: CXE-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/mensagens.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Derivacoes do chat por Canal: abas por Canal, Responder por, aba inicial, separador via e rotulo do Canal"
    requirement: CXE-W2
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-conversacional.test.ts#dois WhatsApps dão duas abas e o padrão de resposta é o da última recebida"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 05: Conversa, Mensagem e chat por Canal no domínio Summary

**Conversa e Mensagem relacionais ganham tipos e regras puras (envio fora da janela decidido por tipo e provedor, status inicial `pendente` com Canal fora do ar, `carga_bruta` fora do tipo público) e o chat passa a derivar abas, "Responder por", rótulo e separador "via …" por Canal, tudo testado sem jsdom.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-12T17:03Z
- **Completed:** 2026-10-12T17:09Z
- **Tasks:** 3 (todas `tdd="true"`)
- **Files modified:** 6 (5 criados, 1 alterado)

## Accomplishments

- `crm/conversas.ts`: `Conversa`, `ConversaDetalhada`, `NovaConversa`, `FiltroDeConversas`, `ParticipanteDaConversa` (lista na Conversa, Fila só como id — D-09), `validarNovaConversa` (INV-CXE-05), `proximaSituacao` (resolver/reabrir, lixeira parada), `tituloDaConversa` e `TIPO_DE_IDENTIFICADOR_DO_CANAL` (WhatsApp resolve `whatsapp`, nunca `telefone` — Pitfall 8).
- `crm/mensagens.ts`: `Mensagem` com o modelo de 7.6 sem `cargaBruta` (só `MensagemRecebidaDoProvedor` a tem), `DIRECOES_DE_ENVIO` sem `recebida`, `validarNovaMensagem`, `validarEnvio` (três recusas distintas fora da janela do oficial; não oficial e Canal sem exigência liberam) e `statusInicialDeEnvio`.
- `derive-conversacional.ts`: `canaisDoFio` (uma aba por Canal ativo, ordem tipo/criação/id, inalcançáveis marcados), `canaisDeResposta`, `canalPadraoDeResposta` (Canal da última recebida, com queda para o mesmo tipo), `canalDaAbaInicial`, `canalPadraoDoTipo`, `marcadoresDeCanal`, `rotuloDoCanal` e `textoDoSeparadorDeCanal` (leem `PROVEDORES[provedorDoCanal(canal)].rotulo`). `canaisQueAlcancam` ficou intocado.

## Task Commits

1. **Task 1 RED:** `c4bb866` (test) — Conversa relacional
2. **Task 1 GREEN:** `470f731` (feat)
3. **Task 2 RED:** `8ae712b` (test) — Mensagem relacional
4. **Task 2 GREEN:** `9a51bfd` (feat)
5. **Task 3 RED:** `ed5d4b6` (test) — derivações do chat por Canal
6. **Task 3 GREEN:** `3ac5673` (feat)

**Plan metadata:** commit `docs(08-05)` seguinte a este arquivo.

## Files Created/Modified

- `packages/dominio/src/crm/conversas.ts` / `conversas.test.ts` — Conversa relacional (18 testes)
- `packages/dominio/src/crm/mensagens.ts` / `mensagens.test.ts` — Mensagem relacional (19 testes)
- `packages/dominio/src/derive-conversacional.ts` — oito derivações novas e `ORDEM_DOS_TIPOS_DE_CANAL`
- `packages/dominio/src/derive-conversacional.test.ts` — primeiro teste do módulo (23 testes)

## Decisions Made

Ver `key-decisions` no frontmatter. A decisão com mais efeito a jusante: `canalPadraoDeResposta` e `canalPadraoDoTipo` só enxergam Canais de resposta (conectados que alcançam o Contato); quem precisar abrir atendimento num Canal desconectado (08-10) não deve usar `canalPadraoDoTipo`.

## Deviations from Plan

### TDD Gate Compliance (Tasks 1, 2 e 3)

O plano é `type: execute` com `tdd="true"` por tarefa, então `gsd_run check tdd-red-evidence` não foi invocado; a evidência é a saída real do vitest.

- **Task 1 RED:** `c4bb866`. 15 dos 18 testes de `conversas.test.ts` falharam com `Error: <função>: ainda não implementada` (esqueleto que lança); os 3 que passaram são dos valores discretos e do mapa `TIPO_DE_IDENTIFICADOR_DO_CANAL`, dados que o esqueleto já traz definitivos. Avaliação semântica: cada teste-alvo executou e falhou na chamada da função planejada, não por sintaxe, importação ou fixture. **GREEN:** `470f731`, 18/18 e `tsc` verdes. Sem REFACTOR.
- **Task 2 RED:** `8ae712b`. 17 dos 19 testes falharam do mesmo modo; os 2 que passaram são os dos valores discretos (`DIRECOES_DE_ENVIO` sem `recebida` etc.). Mesma avaliação semântica. **GREEN:** `9a51bfd`, 19/19. Sem REFACTOR.
- **Task 3 RED:** `ed5d4b6`. 22 dos 23 testes falharam (`canaisDoFio`, `canaisDeResposta`, `canalPadraoDeResposta`, `canalDaAbaInicial`, `canalPadraoDoTipo`, `marcadoresDeCanal`, `rotuloDoCanal`, `textoDoSeparadorDeCanal` "ainda não implementada"); o único verde é o de `canaisQueAlcancam`, que descreve comportamento preservado. A contagem por mensagem de erro confirmou que nenhuma falha veio da fixture. **GREEN:** `3ac5673`, 23/23 e a suíte inteira do domínio (1785) verde. Sem REFACTOR.
- **Esqueleto no commit RED:** cada commit `test(08-05)` leva também o módulo-esqueleto (tipos e constantes definitivos, funções que lançam). Isso mantém o `tsc` verde em todo commit e faz o RED falhar na afirmação, não por módulo ausente (que seria `INVALID_RED` por falha de carga).

### Auto-fixed Issues

Nenhuma. Plano executado como escrito.

### Registro de ambiente

**Commits em `main`:** o orquestrador mandou ficar em `main` (isolamento `none`, `branching_strategy: none`); a assertiva de HEAD protegido foi tratada como não aplicável, como em 08-01 a 08-04. Nenhum `git update-ref`, stash, clean ou troca de branch. O guard de raiz fixada (#4254) foi executado antes de cada commit.

**Total deviations:** 0 correções automáticas. **Impact on plan:** nenhum.

## Issues Encountered

- Nenhum erro de teste ou de tipo além dos RED esperados. Uma sonda temporária de seed (arquivo `zz-probe.test.ts`, fora do commit) mostrou que nenhum Contato do seed tem WhatsApp sem e-mail e com Conversa; a fixture do teste de derivações monta o cenário a partir do seed em vez de depender dele.
- Regressão: suíte inteira de `@n1/dominio` (1785 testes) e `npm run typecheck` dos três workspaces verdes.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum além do `<threat_model>`. Mitigações aplicadas: T-08-22 (`DIRECOES_DE_ENVIO` sem `recebida`, testado), T-08-23 (`interface Mensagem` sem `cargaBruta`; só `MensagemRecebidaDoProvedor` a tem), T-08-24 (`validarEnvio` com as capacidades por (tipo, provedor); a aplicação no servidor é de 08-12).

## User Setup Required

None - no external service configuration required. Plano só de domínio, sem banco.

## Next Phase Readiness

- 08-06 (serviço de Conversa) e 08-12 (rotas de Mensagem) têm os tipos, `validarNovaConversa`, `proximaSituacao`, `validarEnvio` e `statusInicialDeEnvio` para aplicar. A api deve passar `modelosAprovados: []` (nota de planejamento).
- 08-10/08-11 têm as derivações para trocar a chave do `ConversationThread` de tipo para Canal; o componente em si não foi tocado.
- `CXE-D1` e `CXE-W2` são compartilhados com planos irmãos; a marcação depende de `requirements.ready-ids`.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*

## Self-Check: PASSED
