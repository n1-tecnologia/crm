# Phase 4: As outras telas do financeiro-tria - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 4-as-outras-telas-do-financeiro-tria
**Areas discussed:** Caminho autenticado (OQ-SYN-01), Fronteira de dados, Escopo de escrita, Telas e navegação, D10 (emissão de NF), Permissão e frescor, O corte
**Modo:** `--auto` — o dono autorizou explicitamente ("pode tomar todas as decisões, tá liberado por mim"). Nenhuma `AskUserQuestion` foi feita; a opção recomendada foi escolhida em cada ponto e registrada abaixo com a razão.

---

## Caminho autenticado (OQ-SYN-01)

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Proxy pelo `apps/api` | `apps/web` → `apps/api` (JWT do Membro) → `automation/` (Bearer de serviço). Espelha a ponte de 03-11 | ✓ |
| Navegador → `automation/` com JWT do usuário | Express passa a validar JWT do Supabase; CORS para a origem do web | |
| Server Components do `apps/web` chamando `automation/` direto | Token de serviço no processo do Next em vez do `apps/api` | |

**Escolha:** proxy pelo `apps/api` (D4-01).
**Notas:** a opção 2 mete dependência nova num serviço que CON-05 manda não mexer e quebra a invariante de um backend só no navegador. A opção 3 espalha a credencial de serviço por dois processos e deixa a autorização por Membro longe de onde ela já existe. O `apps/api` já tem hook de autenticação (01-02) e já é cliente HTTP do `automation/` (03-11) — a opção 1 não inventa camada nenhuma.

---

## Credencial

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Token de leitura próprio | `PLATAFORMA_LEITURA_TOKEN`, separado do de lançamento | ✓ |
| Reusar `PLATAFORMA_LANCAMENTO_TOKEN` | Um segredo a menos para operar | |

**Escolha:** token próprio (D4-02).
**Notas:** D-15 exige escopo mínimo. O token que lê o Dashboard não pode ser o que lança no Omie; vazamento de leitura não deve gastar dinheiro.

---

## Onde as leituras que não têm endpoint vão morar

| Opção | Descrição | Selected |
|--------|-------------|----------|
| `automation/` ganha rotas de leitura; `apps/api` faz proxy | Mantém um dono por schema | ✓ |
| `apps/api` lê o schema `public` direto | Menos um salto de rede | |

**Escolha:** rotas novas no `automation/` (D4-04).
**Notas:** não é preferência — é impossibilidade. `plataforma` está em projeto Supabase próprio desde a Fase 0 e D-23 a move para `sa-east-1`: são dois bancos, o `apps/api` não alcança `public`. `transacoes` e `produtos_cadastrados_emissao_notas` são lidos hoje direto do Supabase pelo front com `anon_read` e não têm rota nenhuma; é aí que nasce a maior parte da superfície nova.

---

## Quando as rotas públicas de hoje ganham autenticação

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Superfície nova `/v1/leituras/*` autenticada; legadas removidas no corte | Painel do Vercel continua funcionando durante a fase | ✓ |
| Autenticar as rotas existentes já | Uma superfície só, mas derruba o painel no meio da fase | |

**Escolha:** superfície nova (D4-03).
**Notas:** mesma forma que 03-07 usou para `/v1/integrations/contas-a-pagar/*`. Derrubar o painel antes da hora é a única forma de esta fase causar dano real.

---

## Fronteira de dados

| Opção | Descrição | Selected |
|--------|-------------|----------|
| DTO com allowlist por rota + derivação servida computada | Credencial por linha nunca sai da VPS | ✓ |
| Repassar a linha e derivar no navegador | Menos código no `automation/` | |

**Escolha:** DTO + computado (D4-05, D4-06).
**Notas:** `GET /financeiro/solicitacoes` devolve hoje `app_key` e `app_secret` na linha, sem autenticação nenhuma. Derivar no cliente exigiria mandar as 1.110 linhas inteiras — justamente o que não pode atravessar. `buildDashboardStats`/`buildProblemRows` moram no front que morre e viram funções puras com teste no `automation/`. `realIntegrations` não é portado: é ficção de protótipo (`latency: "-"` escrito à mão).

---

## Escopo de escrita

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Leitura + escritas sem equivalente na plataforma | CRUD do plano de contas, alíquota, upload, gatilhos de NF, `retry-step`/`cancel` | ✓ |
| Só leitura | Mais simples, mas o Plano de contas e o upload deixam de funcionar | |
| Portar tudo, inclusive aprovar | Paridade literal com o painel | |

**Escolha:** o meio-termo (D4-07).
**Notas:** `PATCH /solicitacoes/:id/aprovado` e `approve`/`review` de run ficam de fora — aprovar é decisão da plataforma desde D-06/D-09. Um segundo botão de aprovar, sobre outra tabela, é exatamente a divergência que a migração existe para eliminar.

---

## D10 — emissão manual de NF

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Gatilho em lote na tela de Notas fiscais | Usa `POST /invoice/run/mark-7days` e `/emit`, que já existem | ✓ |
| Ação na Tarefa (recomendação do plano §7) | Exigiria `transacoes` como Tarefa da ontologia | |
| Google Sheets continua | Status quo | |

**Escolha:** gatilho na tela (D4-12).
**Notas:** a recomendação do plano pressupunha a nota como Tarefa; DEC-16/D-22 decidiram que `transacoes` não entra na ontologia, e o pressuposto caiu. Além disso o código só sabe emitir em lote — `markSeteDias()` e `emitirNotas()`; não há emissão por linha, e inventar uma seria mudar regra, que DEC-16 proíbe.

---

## Telas e navegação

| Opção | Descrição | Selected |
|--------|-------------|----------|
| `/financeiro` de primeiro nível, sub-rotas espelhando as de hoje | Memória muscular do Financeiro preservada | ✓ |
| Debaixo de `ferramentas/` | Menos um item no topo | |

**Escolha:** primeiro nível (D4-08).
**Notas:** quem opera o produto hoje é o Financeiro. O `EmpresaSwitcher` vira filtro `?empresa=`, não trocador global (D4-09) — Empresa como Integração é TEN-01, Phase 5.

---

## Permissão e frescor

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Alcance à Pasta "Financeiro" (`memberReachesContainer`) | Reusa regra existente do domínio | ✓ |
| Papel/permissão nova "ver Financeiro" | Mais explícito, mas sistema novo | |

**Escolha:** alcance derivado (D4-14).
**Notas:** 03-05 já provou que visibilidade derivada é o caminho e Concessão escrita à mão é o antipadrão. Sem Realtime e sem cache nesta fase (D4-15): as tabelas de observabilidade têm 9 e 10 linhas, não há o que empurrar ao vivo, e cache antes de latência medida é dívida com juros.

---

## O corte

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Uma semana de uso → pausar Vercel 30 dias → remover `anon_read` por último | Rollback possível até a penúltima etapa | ✓ |
| Desligar tudo de uma vez ao fim da fase | Mais rápido, sem volta | |

**Escolha:** o roteiro em cinco etapas (D4-16).
**Notas:** remover `anon_read` é o ponto sem volta, então é o último. Despausar o Vercel é o rollback.

## Claude's Discretion

- Forma exata das rotas de `/v1/leituras/*`, nomes dos DTOs e divisão em arquivos.
- Divisão dos planos e ondas; coordenação de commits entre os dois repositórios.
- Layout fino das oito telas dentro de `apps/web/src/design/`.
- Política de timeout, retry e renderização de falha do `automation/`.

## Deferred Ideas

- Modelar `transacoes`/`produtos`/plano de contas na ontologia — DEC-16 decidiu que não.
- Telas de Integrações e Notificações — fora das oito de TELA-01.
- Editor de RAG pela tela; unificação das 13 tabelas vetoriais e 7 views `_v`.
- Descartar as cinco tabelas de observabilidade praticamente sem uso (inventário §5.7).
- Realtime e cache — reavaliar com latência medida depois do corte.
- Empresa como Integração com credencial própria (CAND-01) — Phase 5, TEN-01.
