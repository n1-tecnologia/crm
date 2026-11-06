---
schema_version: 1
open_count: 11
waived_count: 1
fixed_count: 4
total_count: 16
last_updated: 2026-11-06T10:41:35.401Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/contatos/page.tsx |  | 07-06: lista, formulario e ficha de Contato nao foram exercitados em navegador real (so teste de componente com fetch falso); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | fixed |  | 2026-10-10T03:08:27.555Z | 2026-10-11T22:24:42.450Z |
| 2 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/empresas/page.tsx |  | 07-09: lista, popup, formulario Nova Empresa e ficha de Empresa (vinculos, Trocar admin, restauracao pedindo admin) nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | fixed |  | 2026-10-10T04:16:05.984Z | 2026-10-11T22:24:42.511Z |
| 3 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/negocios/page.tsx |  | 07-10: quadro de Negocios (colunas por Etapa, arrastar = mover com reversao em 409, Ganhar/Perder/Reabrir pelo DialogoDeEncerramento) e o DialogoNovoNegocio nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | fixed |  | 2026-10-10T22:48:54.281Z | 2026-10-11T22:24:42.571Z |
| 4 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx |  | 07-11: ficha de Negocio (edicao, troca de Etapa e de Funil, Ganhar/Perder/Reabrir, ciclo de vida, recuo D-15) e a secao Negocios das fichas de Contato e Empresa nao foram exercitadas em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | fixed |  | 2026-10-10T23:26:16.496Z | 2026-10-11T22:24:42.645Z |
| 5 | 07 | deviation | apps/api/src/e2e/lote-contas-a-pagar.test.ts |  | 07-12: npm run check nao fica verde por duas falhas pre-existentes fora do CRM (lote-contas-a-pagar 5/6 contra o banco remoto; seed de formularios-publicos.test.ts) - registradas em deferred-items.md da fase | waived | Ressalva aceita pelo dono na UAT da Fase 7 (2026-10-11, teste 1): as duas falhas do portão são pré-existentes e exclusivas do Financeiro, fora dos arquivos da fase; registradas em deferred-items.md e como override em 07-VERIFICATION.md | 2026-10-11T00:08:40.828Z | 2026-10-11T22:24:42.705Z |
| 6 | 08 | unrun-verify | .planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md |  | 08-15: UAT de fim de fase (dez passos + conferencias visuais de 08-01/02/08/09/10/11) nao exercitada no app real; resultado do dono fica em branco em 08-PROVAS.md | open |  | 2026-10-12T22:25:12.544Z |  |
| 7 | 08 | deviation | apps/api/src/persistencia/colunas-geradas.test.ts | 111 | 08-15: portao npm run check falhou nesse arquivo uma vez (empate de vencimento sem desempate no order by) e passou isolado; alem das duas falhas pre-existentes da Fase 7; ver deferred-items.md da Fase 8 | open |  | 2026-10-12T22:25:12.604Z |  |
| 8 | 09 | deviation | packages/dominio/src/derive-visibilidade.ts |  | pentest 09-21 [medio] AgentExecution.contextComposition.readRecordIds pode listar ids de registros ocultos (vaza so o id) | open |  | 2026-10-28T18:14:48.432Z |  |
| 9 | 09 | deviation | packages/dominio/src/types/ai.ts |  | pentest 09-21 [baixo] AutomationExecution.childAgentExecutionIds pode listar ids de Execucoes ocultas (vaza so o id) | open |  | 2026-10-28T18:14:48.506Z |  |
| 10 | 09 | deviation | apps/api/src/app.ts |  | pentest 09-21 [baixo/informativo] apps/api e apps/web nao enviam cabecalhos de seguranca de resposta (X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, CSP) | open |  | 2026-10-28T18:14:48.569Z |  |
| 11 | 09 | deviation | apps/api/deploy/n1-crm-limites.conf |  | pentest 09-21 [informativo] limite de taxa por IP nao existe no ambiente local/homologacao (sem nginx); provado so em Docker (09-06), pendente repetir na VPS real no 09-20 | open |  | 2026-10-28T18:14:48.632Z |  |
| 12 | 15 | deviation | packages/dominio/src/operations/ferramentas/automacoes.ts |  | 15-07: as Acoes de Automacao contato.adicionarTag e contato.definirCampo falham (Contato do CRM novo nao guarda Tag/Campo de Automacao de Ferramentas); decidir o destino no 15-17/15-22 | open |  | 2026-11-06T09:50:50.940Z |  |
| 13 | 15 | deviation | apps/web/src/app/(shell)/ia/chat/page.tsx |  | 15-08: ancorar Chat ou ensaio num Negocio, Contato, Empresa ou Conversa no navegador recusa/nomeia pelo id ate o 15-21 mandar nomes (o servidor grava certo pelas tabelas) | open |  | 2026-11-06T10:06:57.673Z |  |
| 14 | 15 | deviation | apps/web/src/app/(shell)/configuracoes/membros/page.tsx |  | 15-36: o dialogo de remover Membro e a pagina do Membro filtram o tipo conversation de previewSuccession (so contam as Conversas das tabelas); as Conversas de Grupo do modelo antigo agora passam ao Sucessor em removeMember mas nao aparecem na contagem ate o 3.5.4 tirar o modelo antigo | open |  | 2026-11-06T10:20:00.602Z |  |
| 15 | 15 | deviation | apps/api/src/repositorios/crm/atividades.ts |  | 15-37: a paginacao de GET /atividades por cursor de tempo (ate = at da ultima linha, ISO em ms, exclusivo) pode pular linhas gravadas no mesmo instante na fronteira da pagina (now() e da transacao: um gesto com varias Atividades compartilha o em; at perde os microssegundos). Aceito no desenho do plano; trocar por cursor composto (em, id) se a Auditoria (15-09) paginar paginas cheias | open |  | 2026-11-06T10:29:12.443Z |  |
| 16 | 15 | deviation | apps/web/src/features/ia/automacoes/editor-de-automacao.tsx |  | 15-39: ate o 15-21 passar os Funis de useFunis, inoperante() na tela da IA mostra Automacao de escopo Funil como 'escopo eliminado (Funil)' e a aplicacao otimista de criarAutomacao com escopo Funil recusa localmente; o servidor confere certo pela tabela. Tambem escopo na lixeira vira 'escopo eliminado' em vez de 'escopo na lixeira' | open |  | 2026-11-06T10:41:35.401Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/contatos/page.tsx",
    "line": null,
    "description": "07-06: lista, formulario e ficha de Contato nao foram exercitados em navegador real (so teste de componente com fetch falso); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-10T03:08:27.555Z",
    "resolved_at": "2026-10-11T22:24:42.450Z",
    "milestone": "v1.0"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/empresas/page.tsx",
    "line": null,
    "description": "07-09: lista, popup, formulario Nova Empresa e ficha de Empresa (vinculos, Trocar admin, restauracao pedindo admin) nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-10T04:16:05.984Z",
    "resolved_at": "2026-10-11T22:24:42.511Z",
    "milestone": "v1.0"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/negocios/page.tsx",
    "line": null,
    "description": "07-10: quadro de Negocios (colunas por Etapa, arrastar = mover com reversao em 409, Ganhar/Perder/Reabrir pelo DialogoDeEncerramento) e o DialogoNovoNegocio nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-10T22:48:54.281Z",
    "resolved_at": "2026-10-11T22:24:42.571Z",
    "milestone": "v1.0"
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx",
    "line": null,
    "description": "07-11: ficha de Negocio (edicao, troca de Etapa e de Funil, Ganhar/Perder/Reabrir, ciclo de vida, recuo D-15) e a secao Negocios das fichas de Contato e Empresa nao foram exercitadas em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-10T23:26:16.496Z",
    "resolved_at": "2026-10-11T22:24:42.645Z",
    "milestone": "v1.0"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "07",
    "file": "apps/api/src/e2e/lote-contas-a-pagar.test.ts",
    "line": null,
    "description": "07-12: npm run check nao fica verde por duas falhas pre-existentes fora do CRM (lote-contas-a-pagar 5/6 contra o banco remoto; seed de formularios-publicos.test.ts) - registradas em deferred-items.md da fase",
    "status": "waived",
    "reason": "Ressalva aceita pelo dono na UAT da Fase 7 (2026-10-11, teste 1): as duas falhas do portão são pré-existentes e exclusivas do Financeiro, fora dos arquivos da fase; registradas em deferred-items.md e como override em 07-VERIFICATION.md",
    "recorded_at": "2026-10-11T00:08:40.828Z",
    "resolved_at": "2026-10-11T22:24:42.705Z",
    "milestone": "v1.0"
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "08",
    "file": ".planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md",
    "line": null,
    "description": "08-15: UAT de fim de fase (dez passos + conferencias visuais de 08-01/02/08/09/10/11) nao exercitada no app real; resultado do dono fica em branco em 08-PROVAS.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T22:25:12.544Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "08",
    "file": "apps/api/src/persistencia/colunas-geradas.test.ts",
    "line": 111,
    "description": "08-15: portao npm run check falhou nesse arquivo uma vez (empate de vencimento sem desempate no order by) e passou isolado; alem das duas falhas pre-existentes da Fase 7; ver deferred-items.md da Fase 8",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T22:25:12.604Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "09",
    "file": "packages/dominio/src/derive-visibilidade.ts",
    "line": null,
    "description": "pentest 09-21 [medio] AgentExecution.contextComposition.readRecordIds pode listar ids de registros ocultos (vaza so o id)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T18:14:48.432Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "09",
    "file": "packages/dominio/src/types/ai.ts",
    "line": null,
    "description": "pentest 09-21 [baixo] AutomationExecution.childAgentExecutionIds pode listar ids de Execucoes ocultas (vaza so o id)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T18:14:48.506Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "09",
    "file": "apps/api/src/app.ts",
    "line": null,
    "description": "pentest 09-21 [baixo/informativo] apps/api e apps/web nao enviam cabecalhos de seguranca de resposta (X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, CSP)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T18:14:48.569Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "09",
    "file": "apps/api/deploy/n1-crm-limites.conf",
    "line": null,
    "description": "pentest 09-21 [informativo] limite de taxa por IP nao existe no ambiente local/homologacao (sem nginx); provado so em Docker (09-06), pendente repetir na VPS real no 09-20",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T18:14:48.632Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/ferramentas/automacoes.ts",
    "line": null,
    "description": "15-07: as Acoes de Automacao contato.adicionarTag e contato.definirCampo falham (Contato do CRM novo nao guarda Tag/Campo de Automacao de Ferramentas); decidir o destino no 15-17/15-22",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T09:50:50.940Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/ia/chat/page.tsx",
    "line": null,
    "description": "15-08: ancorar Chat ou ensaio num Negocio, Contato, Empresa ou Conversa no navegador recusa/nomeia pelo id ate o 15-21 mandar nomes (o servidor grava certo pelas tabelas)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T10:06:57.673Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/configuracoes/membros/page.tsx",
    "line": null,
    "description": "15-36: o dialogo de remover Membro e a pagina do Membro filtram o tipo conversation de previewSuccession (so contam as Conversas das tabelas); as Conversas de Grupo do modelo antigo agora passam ao Sucessor em removeMember mas nao aparecem na contagem ate o 3.5.4 tirar o modelo antigo",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T10:20:00.602Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/repositorios/crm/atividades.ts",
    "line": null,
    "description": "15-37: a paginacao de GET /atividades por cursor de tempo (ate = at da ultima linha, ISO em ms, exclusivo) pode pular linhas gravadas no mesmo instante na fronteira da pagina (now() e da transacao: um gesto com varias Atividades compartilha o em; at perde os microssegundos). Aceito no desenho do plano; trocar por cursor composto (em, id) se a Auditoria (15-09) paginar paginas cheias",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T10:29:12.443Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/ia/automacoes/editor-de-automacao.tsx",
    "line": null,
    "description": "15-39: ate o 15-21 passar os Funis de useFunis, inoperante() na tela da IA mostra Automacao de escopo Funil como 'escopo eliminado (Funil)' e a aplicacao otimista de criarAutomacao com escopo Funil recusa localmente; o servidor confere certo pela tabela. Tambem escopo na lixeira vira 'escopo eliminado' em vez de 'escopo na lixeira'",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T10:41:35.401Z",
    "resolved_at": null,
    "milestone": "v1.0"
  }
]
````
