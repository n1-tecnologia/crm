# Fase 6 — fechamento (gap closure): esboço dos planos 06-07 a 06-15

Fonte: `06-VERIFICATION.md` (gap: "ok no fio" sem gesto na tela), `06-REVIEW.md`
(crm-n1: CR-01..04, WR-01..12, IN-01..05), `06-REVIEW-FINANCEIRO-TRIA.md`
(financeiro-tria: CR-01..03, WR-01..07, IN-01..06), `06-PROVAS.md` (timeouts do
ciclo da ponte). Escopo decidido pelo dono em 2026-09-29: **tudo** (lacuna +
críticos + avisos; info quando trivial ou no mesmo arquivo).

Execução sequencial numa árvore só; todo plano com `gap_closure: true`. Regras
de `06-CONTEXT.md` (1–10) continuam valendo. Os IDs abaixo usam o prefixo do
repositório: `crm:` = `06-REVIEW.md`, `fin:` = `06-REVIEW-FINANCEIRO-TRIA.md`.

## Interfaces fixadas aqui (os planos NÃO as reinventam)

### Contrato `contas-a-pagar-v1` — seção v1.2 (aditiva)
- `/lancar` pedido: campo opcional `contaConfirmada: string` = o `dePara.conta`
  que a Conferência guardou (`origin.lancamento.conta`). O `automation/`
  compara com a conta que ele resolve para o lançamento; diferente ⇒ 422
  `CONTA_DIVERGENTE` (permanente), `details: { conferida, resolvida }` só com
  rótulos de conta (sem dado sensível). (crm:WR-09)
- `/lancar` no caminho `reaproveitado`: o `automation/` compara o título
  existente (a consulta que ele já faz) com o pedido — valor, vencimento,
  código da categoria, documento do fornecedor, conta corrente. Qualquer
  diferença ⇒ 422 `TITULO_EXISTENTE_DIVERGENTE` (permanente),
  `details: { payableId, campos: ("valor"|"vencimento"|"categoria"|"fornecedor"|"contaCorrente")[] }`
  — nomes de campo, nunca valores. Igual ⇒ `reaproveitado: true` com o
  `dePara` LIDO DO TÍTULO (não recalculado). (crm:CR-02, fin:WR-07)
- `anexos[]` no pedido: `url` = `z.string().url().max(2048)`, lista `.max(20)`,
  `nome` = `z.string().trim().min(1).max(200)`.
- `anexos[]` na resposta: cada item `{ nome: string; ok: boolean; jaExistia?: true; erro?: CodigoDoAnexo }`
  — **sem `url`** (a URL assinada carrega token; fin:IN-03). Para `anexos` em
  `string` (compatibilidade v1), `nome` = último segmento do caminho, sem query.
- `CodigoDoAnexo` (lista fechada, nunca erro de rede cru):
  `ANEXO_HOST_NAO_PERMITIDO`, `ANEXO_DOWNLOAD_FALHOU`, `ANEXO_TEMPO_ESGOTADO`,
  `ANEXO_GRANDE_DEMAIS`, `ANEXO_OMIE_RECUSOU`.
- Falha de anexo NUNCA falha o lançamento (como o legado): o título sai, o
  anexo vem `ok: false` com o código.
- Exemplos canônicos novos copiados nas DUAS pastas `contratos/contas-a-pagar-v1/`,
  hash agregado igual; `docs/08-migracao-financeiro/05-…md` ganha a seção v1.2.

### `automation/` — anexos (fin:CR-01, fin:CR-03)
- Variável `CONTAS_A_PAGAR_ANEXOS_HOSTS` (hostnames separados por vírgula).
  Vazia ⇒ todo anexo do `/lancar` sai `ANEXO_HOST_NAO_PERMITIDO` (o título
  ainda lança). Produção: o host do Storage do Supabase da plataforma.
- Só `https:`; `http:` apenas via allowlist INJETADA por teste
  (`teste-omie-real` com o servidor em 127.0.0.1).
- Download: `redirect: "error"`, prazo por download 15 s, teto 15 MB lido em
  stream (não confiar em `content-length`), orçamento total dos anexos 35 s
  (abaixo dos 60 s de `TIMEOUT_LANCAR_MS` da ponte); o que não coube ⇒
  `ANEXO_TEMPO_ESGOTADO`.
- Limites de prazo e tamanho valem para TODOS os chamadores do adapter
  (`uploadAttachmentFromUrl`); a allowlist vale para a rota `/lancar`
  (os caminhos ClickUp/MP/FO continuam baixando das URLs do ClickUp).
- `reaproveitado`: novo método do adapter `listarAnexos(nIdTitulo)`
  (`ListarAnexo` do Omie); sobe só os anexos cujo `nome` ainda não está no
  título; os que já estão voltam `{ ok: true, jaExistia: true }`.

### Domínio (crm) — nomes novos
- `TEXTOS_DA_CONFERENCIA.tituloDivergente(payableId, campos)` e
  `TEXTOS_DA_CONFERENCIA.contaDivergente(conferida, resolvida)` — Comentários
  da ponte para os dois 422 novos (mencionam quem `avisadoDaConferencia` diz).
- `TEXTOS_DA_CONFERENCIA.lancado(...)` passa a descrever os anexos pelo status
  real (`n de m`, `k já estavam no título`), nunca "sem anexos" quando havia
  anexos pedidos. (crm:IN-03)
- `OpcoesDaConferencia.impressaoEsperada?: string` — `publicarResumoParaConferencia`
  recusa SEM efeito quando a impressão atual difere (crm:WR-12).

### Tela (crm)
- Gesto "Responder" no `Timeline` (`apps/web/src/features/tarefa/timeline.tsx`)
  gravando `addTaskComment` com `parentCommentId` = raiz do fio; molde em
  `TaskComments`/`CommentComposer` (`task-editors.tsx:841-857`).

## Planos

| Plano | Onda | Depende de | Repositório | Objetivo | Achados |
|---|---|---|---|---|---|
| 06-07 | 1 | — | financeiro-tria (+ fixtures e doc 05 no crm) | Anexos seguros e honestos no `/lancar` | fin:CR-01, fin:CR-03, fin:IN-02, fin:IN-03, fin:IN-06 |
| 06-08 | 2 | 06-07 | financeiro-tria (+ fixtures e doc 05 no crm) | `/resolver` e `/lancar` só aceitam o que é certo | fin:CR-02, crm:CR-02 (lado backend), fin:WR-07, crm:WR-09 (lado backend), fin:IN-01 |
| 06-09 | 3 | 06-08 | financeiro-tria | S5 fora do caminho do webhook, idempotente por ciclo, com repetição certa | fin:WR-06, fin:WR-02, fin:WR-01 |
| 06-10 | 4 | 06-09 | financeiro-tria | S5 lê o dado atual, roteia a conta certa e não vaza erro | fin:WR-03, fin:WR-04, fin:WR-05, fin:IN-04, fin:IN-05 |
| 06-11 | 5 | — | crm (`packages/dominio`) | Conferência mais estrita no domínio | crm:CR-03, crm:WR-03 (domínio), crm:WR-04, crm:WR-08, crm:WR-10, crm:WR-12, crm:IN-02, crm:IN-03, textos novos |
| 06-12 | 6 | 06-08, 06-11 | crm (`apps/api`) | A ponte não lança de snapshot velho e trata os 422 novos | crm:CR-01, crm:CR-02 (lado ponte), crm:WR-09 (lado ponte), anexos v1.2 na ponte, `TEXTO_SAIU_ANTES_DO_REGISTRO` |
| 06-13 | 7 | 06-12 | crm (`apps/api`) | Ponte fechada para teste, chave e avisos persistentes, logs, eventos, métrica e os timeouts do ciclo | crm:WR-01, crm:WR-02, crm:WR-07, crm:WR-11, crm:CR-04, crm:WR-06, crm:IN-04, timeouts do ciclo (06-PROVAS) |
| 06-14 | 8 | 06-11 | crm (`apps/web`) | "Responder" no fio; card e fio sem ambiguidade; jornada responde no fio | GAP (VERIFICATION), crm:WR-05, crm:WR-03 (tela), crm:IN-01 |
| 06-15 | 9 | 06-07..06-14 | os dois | [BLOCKING] provas de novo, docs e o que fica com o dono | RES-06; human verification de `06-VERIFICATION.md` |

`crm:IN-05` (testes faltando) é coberto pelos testes de cada plano (um caso
por achado crítico, com mutação).
