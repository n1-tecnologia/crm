# SYNTHESIS — ponto de entrada da intel de `/gsd-ingest-docs`

Gerado em 2026-09-15 · modo `new` · repositório `crm-n1` (branch `reestrutura-monorepo-e-plano-financeiro`) · idioma pt-BR.
Este arquivo é o que o `gsd-roadmapper` lê primeiro. Ele resume; o detalhe está nos quatro arquivos por tipo e no relatório de conflitos.

---

## O que foi ingerido

9 documentos, todos classificados com confiança `high` e tipo fixado pelo manifesto (`.planning/ingest-manifest.yaml`):

- ADR (1): `docs/08-migracao-financeiro/04-spike-persistencia.md` — locked, precedence 0
- SPEC (3): `docs/08-migracao-financeiro/03-plano-de-migracao.md` (precedence 1); `docs/07-processos/contas-a-pagar.md` (2); `docs/07-processos/contas-a-receber.md` (2)
- PRD (0): nenhum — `PRD-FRONTEND-NAVEGAVEL.md` excluído de propósito pelo manifesto
- DOC (5): `docs/08-migracao-financeiro/00-LEIA-PRIMEIRO.md`, `01-inventario-financeiro-tria.md`, `02-comparativo-com-a-plataforma.md` (3); `docs/PENDENCIAS-FRONTEND.md`, `docs/03-fundacao/ARQUITETURA.md` (4)

Detecção de ciclos: DFS de três cores sobre 16 arestas; profundidade máxima 3 (limite 50); **2 ciclos** entre 01-inventario ↔ 03-plano (↔ 02-comparativo), todos formados por hiperlinks bibliográficos. Sintetizados mesmo assim; ver WARNING único no relatório.

Tudo foi conferido contra o código (`apps/api/`, `apps/web/`, `packages/dominio/`, commits `9fb2754` → `d713253`), não só contra o que os documentos dizem.

## Em uma frase

O backend do financeiro-tria fica intacto; o CRM N1 vira o front único que substitui o ClickUp e o painel atual; os dois se falam por HTTP pelos 7 métodos do adapter; a Fase 1 (persistência + login) está **metade feita** — persistência e autenticação prontas e validadas, faltam rotas HTTP por operação, `store.ts` falando `POST`, bootstrap do Espaço "Gestão" e colunas geradas — e a Fase 0 tem a lacuna mais séria do plano ainda aberta (a Solicitação de pagamento não tem spec).

## Decisões — `decisions.md`

- **Travadas por ADR: 10** (DEC-01..DEC-10) — hidratar o `DataState` inteiro por Espaço de Trabalho; tabela genérica `plataforma.registros` + colunas geradas; diff por JSON canônico; ordem fracionária; hidratação numa consulta; revisão otimista por Espaço (3 tentativas); registro de coleções; **projeto Supabase próprio `epomplsskqpluxuujpxl`**; testes de persistência pulam sem `DATABASE_URL`; migrações numeradas imutáveis.
- **Travadas por instrução do orquestrador (decisões do dono do projeto no SPEC 03 §2): 7** (DEC-11..DEC-17) — backend intacto; CRM N1 front único; `apps/api` dono do schema `plataforma`; HTTP nunca SQL direto; `automation/` fica onde está (D12 adiado); ontologia só para o que substitui o ClickUp (com ponto de revisão antes da Fase 2); `TaskID` + `origem`.
- **Candidatas (não travadas): 7** (CAND-01..CAND-07) — uma Integração Omie por Empresa; só a Data de vencimento nativa; descartar observabilidade legada; C32 (b); C34 leituras conservadoras; `PublicoProvider` como Proprietário; princípios da arquitetura do frontend.
- **Abertas:** índice na seção 4; detalhe em `context.md`.

## Requisitos — `requirements.md`

35 requisitos derivados dos entregáveis por fase do SPEC 03-plano (não há PRD), com status **verificado no código**:

- feito (4): REQ-f0-schema-plataforma · REQ-f0-contagem-linhas-legado · REQ-f1-persistencia-unidade-de-trabalho · REQ-f1-supabase-auth
- sobreposto por ADR (1): REQ-f1-tabelas-schema-plataforma
- em andamento (4): REQ-f3-automacoes-a1-a9 · REQ-f3-agente-lancamento-omie-real · REQ-f3-pagamento-em-lote · REQ-f3-permissao-pessoa-da-conta (existem em memória no protótipo)
- bloqueado por decisão aberta (4): REQ-f1-deploy-apps-api (D11) · REQ-f2-lista-solicitacoes (D6) · REQ-f2-classificador-fallback (D8) · REQ-f5-contas-a-receber (D7)
- pendente (22): o resto da Fase 0 (exportação ClickUp, **spec da Solicitação**, de-para de usuários, rotação de credenciais), o resto da Fase 1 (**rotas por operação, store POST, bootstrap "Gestão", colunas geradas**, reconvite por Usuário), Fase 2 inteira (formulário, tela de aprovação, timeline, adapter, mapper, endpoint de entrada, importação), Fase 3 (importação, de-para real), Fase 4 (telas portadas), Fase 5 (tenants), transversais (**motor de Automações** — peça G de risco alto; notificar por Canal)

Ordem de fases do plano (estimativas para uma pessoa): F0 1 sem · F1 3–4 · F2 3–4 · F3 2 · F4 2–3 · F5 2–3 = 11–14 semanas.

## Restrições — `constraints.md`

37 restrições em três blocos:
- Plano (CON-01..CON-15): api-contract 3 (7 métodos do adapter; `POST /operacoes/:nome`; `POST /webhooks/plataforma/solicitacao-criada`) · schema 3 (`TaskID`+`origem`; de-para de usuários; tabelas — sobreposta) · nfr 6 (portões de verificação; degradação do adapter; preservação de tempos na importação; credenciais; tipos compartilhados; estimativas) · protocol 3 (status da Solicitação; idempotência Omie; critérios de pronto por fase)
- Contas a pagar (CON-CP-01..12): schema 4 (estrutura; 8 Status; 24 Campos; 8 Tags) · protocol 5 (recorrência; A1–A9; Agente; RN-CP-01..07 + INV-CP-01; formato do RESUMO — api-contract) · nfr 3 (permissões; lote; migração)
- Contas a receber (CON-CR-01..10): schema 5 (estrutura + Vínculo; 6 Status; Campos; Situação de cobrança; campos a acrescentar) · protocol 3 (nomenclatura; R1–R7; RN-CR-01..07 + INV-CR-01/02) · nfr 2 (permissões; migração)

## Contexto — `context.md`

5 tópicos (visão de entrada; inventário do financeiro-tria; comparativo bate/não bate/falta; arquitetura do frontend — histórica; pendências do frontend) + **consolidação de 33 questões abertas** de todas as fontes: D6–D12 do plano; OQ-ADR-01 (região do Supabase — barata agora, cara depois); OQ-PLAN-01 (revisão da divisão ontologia × telas antes da Fase 2); OQ-CP-01..06; OQ-CR-01..06; OQ-CMP-01..05; OQ-PF-01..03 (A9 afeta o formulário da Fase 2); OQ-GHL-01; e três pré-requisitos não escritos que a síntese detectou (OQ-SYN-01..03: leituras autenticadas do `automation/` na Fase 4; eventos de saída do `apps/api`; leituras que deixam de poder ser JOIN com o banco separado).

## Conflitos — `.planning/INGEST-CONFLICTS.md`

- BLOCKERS: **0**
- WARNINGS: **1** — ciclo de cross_refs entre 01/02/03 (hiperlinks; sintetizados; pede confirmação do usuário; alternativa: tirar 01-inventario do manifesto)
- INFO: **12** — três auto-resoluções ADR > SPEC (banco próprio; tabela genérica; critério dos 214 testes), uma SPEC/ADR > DOC (ARQUITETURA histórica), uma não-contradição (C34), deriva de caminho no ADR, documentos parcialmente desatualizados sobre o que já foi feito, transparência sobre o §2 do plano travado por instrução, referência a spec inexistente (é entregável), rebaixamento de "Decisão" em DOC, ausência de PRD, tratamento dos §12 como perguntas.

Status para roteamento: **AWAITING USER** — o WARNING precisa de confirmação explícita; não há BLOCKER.

## O que o roadmapper deve levar em conta (sem decidir por ninguém)

1. A Fase 1 não é "a fazer": é "terminar". O que resta é mecânico (CON-14: risco baixo) e destrava tudo.
2. A Fase 0 tem um item que não é mecânico e bloqueia a Fase 2: a spec da Solicitação (REQ-f0-spec-solicitacao-de-pagamento).
3. Quatro decisões (D6, D7, D8, D11) e uma barata (OQ-ADR-01) precisam de dono e prazo antes das fases que bloqueiam.
4. O motor de Automações é a única peça G que ainda não começou; o Financeiro é o primeiro cliente (Fase 3), Contas a receber o segundo (Fase 5).
5. Onde o plano dizia "mesmo Supabase", vale "projeto próprio" (DEC-08) — e isso muda o que pode ser JOIN (OQ-SYN-03).

## Arquivos

- `.planning/intel/decisions.md` — 10 + 7 travadas, 7 candidatas, índice de abertas
- `.planning/intel/requirements.md` — 35 requisitos com status verificado
- `.planning/intel/constraints.md` — 37 restrições tipadas
- `.planning/intel/context.md` — 5 tópicos + 33 questões abertas
- `.planning/INGEST-CONFLICTS.md` — 0 / 1 / 12
- `.planning/intel/classifications/*.json` — as 9 classificações de origem
