---
phase: 06-conferencia-do-resumo-e-anexos
plan: 18
subsystem: packages/dominio + apps/api (ponte) + apps/web (card e doca)
tags: [conferencia-do-resumo, gap-closure, dispensa, integracao-manual, fio, reaproveitado]

requires:
  - phase: 06-11
    provides: "financeiro-base (módulo-folha), classificador estrito, decisaoDasRespostasPendentes"
  - phase: 06-12
    provides: "motivoParaNaoLancar, conferenciaVigente, superarConferencia, motivoDosDetalhes"
  - phase: 06-13
    provides: "PADROES_DAS_PARADAS, ultimaMudancaHumana, parada restaurada do fio"
  - phase: 06-14
    provides: "card e doca com o texto do \"ok\" no fio"
provides:
  - "ApprovalRequest.decisionWaiver e origin.aprovacaoPeloFio (aditivos)"
  - "MOTIVO_DA_DISPENSA, dispensaDaConferencia, dispensaSemManual, conferenciaMaisRecente (financeiro-base)"
  - "dispensarConferenciaDoResumo (fora de OPERACOES), respostaSemEfeitoNoFio, publicar com aprovacaoPorComentario e o fio único"
  - "podeDecidirAConferencia — a régua única de quem confere, pelo fio e pela tela"
  - "ponte: DISPENSA_SEM_MANUAL, DISPENSA_ADIADA, RESPOSTA_SEM_EFEITO, conferenciaDoReaproveitado, REAPROVEITADO_SEM_DE_PARA"
  - "tela: card e doca sem \"ok\" quando a Conferência não o aceita; podeConferirOResumo = podeDecidirAConferencia"
affects: [06-19, 06-20]

tech-stack:
  added: []
  patterns:
    - "decisão que depende de um Campo tomada DENTRO da Unidade de Trabalho, sobre o estado da gravação"
    - "marca como dado (decisionWaiver) com leitura de compatibilidade fail-closed para registros antigos"
    - "o fio é a memória também para as respostas do Agente ao \"ok\" sem efeito"

key-files:
  created:
    - packages/dominio/src/operations/dispensa-so-enquanto-manual.test.ts
    - packages/dominio/src/operations/quem-confere-pelo-fio.test.ts
    - apps/api/src/automacoes/ponte-dispensa-e-fio.test.ts
    - apps/api/src/automacoes/ponte-reaproveitado-conferido.test.ts
    - apps/web/src/features/tarefa/conferencia-sem-ok-no-fio.test.tsx
  modified:
    - packages/dominio/src/types/ai.ts
    - packages/dominio/src/operations/financeiro-base.ts
    - packages/dominio/src/operations/financeiro-textos.ts
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/ai.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/automacoes/invocar-agente.ts
    - apps/api/src/automacoes/ponte-contrato-v12.test.ts
    - apps/api/src/automacoes/ponte-ciclo.test.ts
    - apps/api/src/automacoes/invocar-agente.test.ts
    - apps/api/src/automacoes/CONTEXT.md
    - apps/api/README.md
    - apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx
    - apps/web/src/features/tarefa/timeline.tsx

key-decisions:
  - "A dispensa D6-04 é dado (decisionWaiver = \"integracaoManual\") e só vale enquanto a conta é \"Manual\"; desmarcada, conferenciaDoResumo devolve desatualizada para todo consumidor (crm2:CR-01)"
  - "Leitura de compatibilidade fail-closed: aprovada sem decisionWaiver, com MOTIVO_DA_DISPENSA exato e decisor = aprovador, também é dispensa"
  - "podeDecidirAConferencia (alcança a conta + aprovador ou Administrador/Proprietário ativo) é a régua única do fio e da tela; revisoresDoResumo fica só para resolver o fio (crm2:WR-03)"
  - "O \"ok\" sem efeito recebe resposta no fio, uma vez; o fio é a memória (nada novo em EstadoDaConta)"
  - "No reaproveitado, a ponte confere o dePara lido do título contra a Conferência relida; ausente ou divergente ⇒ falha permanente sem registro (crm2:WR-02)"
  - "Terceira exceção a CON-05 em invocar-agente.test.ts (h), autorizada pelo orquestrador: a linha travava o silêncio que crm2:WR-03 apontou"

requirements-completed: [RES-02, RES-03]

duration: ~85 min
completed: 2026-09-30
---

# Phase 6 Plan 18: dispensa só enquanto Manual, reaproveitado conferido, quem confere pelo fio = pelo clique — Summary

**A dispensa D6-04 virou dado e só vale enquanto a conta é "Manual" (desmarcar leva o Resumo a uma pessoa, no mesmo fio, e nenhum `/lancar` sai sobre ela); a ponte confere o `dePara` do título reaproveitado contra a Conferência; e o fio aceita o "ok" de quem o clique aceita, respondendo uma vez a todo "ok" que não confere.**

## Ponto de partida

- `HEAD` `cb00fa0`, branch `integra-frontend-main`; `git status --short`: só `?? 06-16-PLAN.md` e `?? 06-17-PLAN.md` (depois commitados pelo outro executor em `b1463e0`).
- `readlink node_modules/@n1/dominio` = `../../packages/dominio`.
- Linha de base: domínio 957/957 (62 arquivos); web 267/267 (27 arquivos); api por arquivo, `DATABASE_URL=`: `ponte-contrato-v12` 12, `ponte-ciclo` 28, `invocar-agente` 106, `ponte-lancar-fresco` 24, `ponte-dominio-estrito` 10, `ponte-portas-e-paradas` 14, `contrato-contas-a-pagar-ponte` 11, `contrato-contas-a-pagar` 43, `anexos-da-conta-limites` 6, `anexos-da-conta` 5, `metricas-aprovacoes` 1, `operacoes-conferencia` 12.

## Commits

| Task | Commit | Mensagem |
|---|---|---|
| 1 RED | `03f69b9` | test(06-18): casos do domínio para a dispensa só enquanto Manual e quem confere pelo fio |
| 1 GREEN | `79d209a` | feat(06-18): domínio — a dispensa só enquanto Manual, quem confere pelo fio = pelo clique, pedido sem "ok" e fio único |
| 2 RED | `a56bd35` | test(06-18): casos da ponte para a dispensa só enquanto Manual, o ok no fio e o reaproveitado conferido |
| 2 GREEN | `cdf0bbf` | feat(06-18): ponte — dispensa pelo relido, DISPENSA_SEM_MANUAL, resposta no fio que não confere e reaproveitado conferido (inclui as três exceções a CON-05) |
| 2 reforço | `455852b` | test(06-18): o ok da Maryane sob G3 nem é tentado como decisão (reforço de M5 na ponte) |
| 3 RED | `aff1f0d` | test(06-18): card e doca sem "ok" quando a Conferência não aceita o ok pelo fio; botões pela régua do domínio |
| 3 GREEN | `6ea194b` | feat(06-18): a tela não promete o "ok" que não vale e os botões seguem a régua do domínio |
| 3 docs | `36460a5` | docs(06-18): ordem de implantação do automation/ v1.2, a dispensa só enquanto Manual, o ok no fio e o reaproveitado conferido |

Todos por pathspec; nenhum push. `7913895` e `943b7de` no meio são do executor paralelo (06-16).

## O que mudou

**Domínio (Task 1).**
- `types/ai.ts`: `ApprovalRequest.decisionWaiver?: "integracaoManual"` e `origin.aprovacaoPeloFio?: false` (ramo `resumo`), aditivos.
- `financeiro-base.ts` (continua só com `import type`): `conferenciaMaisRecente`, `conferenciaVigente` em cima dela (mesmo resultado), `MOTIVO_DA_DISPENSA` (saiu da ponte), `dispensaDaConferencia` (com a leitura de compatibilidade) e `dispensaSemManual`; reexportados por `financeiro.ts`.
- `financeiro-textos.ts`: `PEDIDO_PELO_BOTAO`; `chamada`/`revisado`/`dadosMudaram` com `porComentario = true` (padrão byte a byte o de antes); novos `superada`, `okDeQuemNaoConfere`, `okPeloFioDesligado`, `recusaDispensaSemManual`.
- `ai.ts`: `podeDecidirAConferencia` exportada; `SolicitarConferenciaDoResumoInput.aprovacaoPeloFio?: false` copiado para `origin` só quando `false`. `decideProcessApproval` intocada.
- `financeiro.ts`: `conferenciaDoResumo` com `dispensaSemManual` ⇒ `desatualizada`; `dispensarConferenciaDoResumo` (fora de `OPERACOES`; guarda "Manual" no estado recebido, antes de qualquer escrita); `respostasDeConferenciaPendentes` filtrada por `podeDecidirAConferencia`; `respostaSemEfeitoNoFio`; `publicarResumoParaConferencia` com `aprovacaoPorComentario` e o fio de `conferenciaMaisRecente` (sufixo `superada`).

**Ponte (Task 2).** `CodigoDeAdiamento` + `DISPENSA_SEM_MANUAL` (antes de `SEM_CONFERENCIA_APROVADA`); `momentoDoResumo` com `manualAgora` do estado da gravação (flip ⇒ `adiado`, `RESUMO_ADIADO`) e a dispensa por `dispensarConferenciaDoResumo`; `dispensar` pelo domínio, `recusaDispensaSemManual` ⇒ `DISPENSA_ADIADA` sem parada; `lerRespostas` responde `respostaSemEfeitoNoFio` no fio (`RESPOSTA_SEM_EFEITO`); a publicação passa `aprovacaoPorComentario: decisoes.conferenciaPorComentario`; `conferenciaDoReaproveitado` e `motivoDoReaproveitadoSemDePara` antes do registro do `reaproveitado`; nota de IN-03 no JSDoc de `PADROES_DAS_PARADAS`; `MOTIVO_DA_DISPENSA` reexportado do domínio.

**Tela e docs (Task 3).** `podeConferirOResumo` delega a `podeDecidirAConferencia` (a fila muda junto, sem edição); card e doca condicionais em `origin.aprovacaoPeloFio === false`; `apps/api/README.md` §5b com "Ordem de implantação (crm2:WR-02)" e as duas linhas de variável; `apps/api/src/automacoes/CONTEXT.md` e `packages/dominio/CONTEXT.md` com o 06-18.

## Exceções a CON-05 (antes/depois)

| Arquivo, caso | Antes da Task 2 | Com a Task 2, sem a troca | Depois da troca | O que mudou |
|---|---|---|---|---|
| `ponte-contrato-v12.test.ts`, helper `lancado` | 12/12 | 10/12 — (e) e (g) vermelhos | 12/12 | o corpo leva `dePara: dePara200("Impostos", …).dePara` quando `reaproveitado`; `import` de `dePara200` |
| `ponte-ciclo.test.ts`, caso (d) | 28/28 | 27/28 — (d) vermelho | 28/28 | a segunda resposta (`reaproveitado: true`) leva o mesmo `dePara` |
| `invocar-agente.test.ts`, caso "(h) CONFERENCIA_POR_COMENTARIO=false: \"ok\" não decide nada" (l. 763) | 106/106 | 105/106 — (h) vermelho | 106/106 | `comentarios` → `comentarios + 1` e uma asserção: o Comentário novo é `okPeloFioDesligado`, resposta no fio do Resumo; a asserção de que o "ok" NÃO decide fica |

Nenhuma outra asserção mudou. As duas primeiras são as nomeadas pelo plano: fixavam um `reaproveitado: true` sem `dePara` (a resposta de um `automation/` v1.1), que crm2:WR-02 recusa por desenho. A terceira não estava no plano. Parei no checkpoint, e o orquestrador (autor do esboço) autorizou: a linha antiga travava o silêncio que crm2:WR-03 apontou como defeito, e a decisão 5 do esboço ("nunca silêncio") a substitui. É da mesma classe das duas nomeadas.

## crm2:IN-03 no ponto de partida

O caso (n) de `ponte-reaproveitado-conferido.test.ts` estava verde **antes** de qualquer mudança em `invocar-agente.ts`, como o plano esperava: `textoDaRecusaPermanente` já tinha a forma de `falhaSemVolta` sem recusa. Rodei o caso com o domínio da Task 1 e a ponte do ponto de partida; das 7, só as 4 de WR-02 falharam. A mudança é a trava: o teste e a nota no JSDoc.

## Mutações (script `<scratchpad>/exec-06-18/mutar.py`, restauração conferida por sha256 em todas: OK)

| # | Mutação | Derrubou |
|---|---|---|
| M1 | `conferenciaDoResumo` sem `dispensaSemManual` | dispensa (b), (f), (g); ponte (a), (b) |
| M2 | `dispensarConferenciaDoResumo` sem a guarda de "Manual" | dispensa (c); ponte (d) |
| M3 | sem gravar `decisionWaiver` | dispensa (a) |
| M3b | `dispensaDaConferencia` sem a leitura de compatibilidade | dispensa (f) |
| M4 | a `raiz` de volta à vigente | dispensa (h) |
| M5 | `respostasDeConferenciaPendentes` de volta a `revisoresDoResumo` (com o import) | quem-confere (j), (k); ponte (f), (g), depois do reforço `455852b` |
| M6 | `respostaSemEfeitoNoFio` sem descartar a já respondida | quem-confere (k); ponte (g), (h) |
| M7 | `publicarResumoParaConferencia` ignorando `aprovacaoPorComentario: false` | quem-confere (m); ponte (h); tela (a), (b) |
| M8 | `podeDecidirAConferencia` sem `memberSeesTask` | quem-confere (i) |
| M9 | `momentoDoResumo` sem o `adiado` do flip de "Manual" | ponte (c) |
| M10 | `motivoParaNaoLancar` sem `DISPENSA_SEM_MANUAL` | ponte (e) |
| M11 | `dispensar` parando a conta na `recusaDispensaSemManual` | ponte (d) |
| M12 | `lerRespostas` sem a resposta sem efeito | ponte (g), (h) |
| M13 | a publicação sem `aprovacaoPorComentario` | ponte (h) |
| M14 | reaproveitado registrado sem `conferenciaDoReaproveitado` | reaproveitado (j), (k)×2, (l) |
| M15 | `conferenciaDoReaproveitado` aceitando `dePara` ausente | reaproveitado (l) |
| M16 | `textoDaRecusaPermanente` com sufixo ` —` no lugar de `.` | reaproveitado (n) |
| M17 | card sem a condição `aprovacaoPeloFio` | tela (a) |
| M18 | doca sem a condição | tela (b) |
| M19 | `podeConferirOResumo` aceitando o Financeiro que não é aprovador | tela (c) ×2 |

A única lacuna apareceu na primeira rodada de M5 na ponte: M5 derrubava só o (f), não o (g), porque `respostaSemEfeitoNoFio` publica a resposta mesmo com o filtro antigo. Reforcei o (g) em `455852b` para exigir que a resposta da Maryane não chegue a ser tentada como decisão (sem `RESPOSTA_RECUSADA_PELO_DOMINIO`) e que saia `RESPOSTA_SEM_EFEITO`. Com o reforço, M5 derruba (f) e (g).

## Números finais

- `packages/dominio`: 973/973 (64 arquivos; +16 novos); `tsc --noEmit` limpo.
- `apps/web`: 272/272 (28 arquivos; +5 novos); `src/features/tarefa/` 87/87; `tsc --noEmit` limpo.
- `apps/api`, por arquivo, com `DATABASE_URL=` vazio:

| Arquivo | Antes | Depois |
|---|---|---|
| `ponte-dispensa-e-fio` (novo) | — | 8/8 |
| `ponte-reaproveitado-conferido` (novo) | — | 7/7 |
| `ponte-contrato-v12` | 12 | 12 |
| `ponte-ciclo` | 28 | 28 |
| `invocar-agente` | 106 | 106 |
| `ponte-lancar-fresco` | 24 | 24 |
| `ponte-dominio-estrito` | 10 | 10 |
| `ponte-portas-e-paradas` | 14 | 14 |
| `contrato-contas-a-pagar-ponte` | 11 | 11 |
| `contrato-contas-a-pagar` | 43 | 43 |
| `anexos-da-conta-limites` | 6 | 6 |
| `anexos-da-conta` | 5 | 5 |
| `metricas-aprovacoes` | 1 | 1 |
| `operacoes-conferencia` | 12 | 12 |

- `apps/api` `tsc --noEmit` limpo; `npm run lint` 0 erros (os 4 avisos antigos de `app-shell.tsx`); `verificar:tokens` OK (437 tokens, 0 falhas); `verificar:contratos` OK.
- Os de banco pulam sem `DATABASE_URL` (DEC-09): pular não conta como verde.
- `git diff --name-only cb00fa0..HEAD -- packages apps contratos docs`: os arquivos de `files_modified` mais `apps/api/src/automacoes/invocar-agente.test.ts` (a terceira exceção, autorizada).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Teste novo] A Conferência de G3 num Espaço novo, em `quem-confere-pelo-fio` (i)**
- **Encontrado durante:** Task 1 GREEN
- **Problema:** publicar o Resumo de G3 sobre a Conferência padrão ainda pendente é idempotente (devolve a padrão, com a Maryane como aprovadora).
- **Correção:** o caso monta um `buildSeed()` novo antes da de G3.
- **Commit:** `79d209a`

**2. [Rule 2 - Lacuna de mutação] Reforço do caso (g) de `ponte-dispensa-e-fio`**
- **Encontrado durante:** mutações da Task 2 (M5 na ponte)
- **Correção:** asserções de `RESPOSTA_SEM_EFEITO` presente e `RESPOSTA_RECUSADA_PELO_DOMINIO` ausente.
- **Commit:** `455852b`

**3. [Rule 3 - Bloqueio] Terceira exceção a CON-05 (`invocar-agente.test.ts` (h))**, autorizada pelo orquestrador depois do checkpoint. Detalhes na seção de exceções.
- **Commit:** `cdf0bbf`

**4. [Detalhe] `painel-conferencia-do-resumo.tsx`:** saiu também o import de `memberSeesTask`, que ficou sem uso junto com `revisoresDoResumo`.

**5. [Detalhe] `lerRespostas`:** se o Comentário da resposta sem efeito falhar, ele não fica em `comentarioPendente`. O fio é a memória: o ciclo seguinte pergunta de novo ao domínio. Assim uma resposta repetida nunca vira parada nem reenvio duplicado.

## Threat model

- T-6-18-01/02: mitigados por `decisionWaiver`, `dispensaSemManual`, `DISPENSA_SEM_MANUAL` e `dispensarConferenciaDoResumo` no estado da gravação (M1, M2, M9, M10, M11).
- T-6-18-03: mitigado por `podeDecidirAConferencia` e `respostaSemEfeitoNoFio` (M5, M6, M8, M12, M19).
- T-6-18-04: mitigado por `conferenciaDoReaproveitado` e pela ordem de implantação no README (M14, M15).
- T-6-18-05: o aviso do reaproveitado vai ao log só com `code`, `payableId` e os ids de sempre. O caso (j) confere as chaves do log e a ausência do código, da categoria e da conta; grep `registrar(.*dePara` = 0.
- T-6-18-06: o fio é a memória (caso (g) com reinício; M6).
- T-6-18-07: aceito como planejado.
- O domínio segue sem I/O (grep = 0) e a base segue só com `import type`.
- Nenhum servidor subiu, nada tocou produção, `.env` não foi lido.

Nenhuma superfície nova fora do `<threat_model>`.

## Known Stubs

Nenhum.

## Self-Check: PASSED

- Arquivos criados: os cinco de teste existem.
- Commits `03f69b9`, `79d209a`, `a56bd35`, `cdf0bbf`, `455852b`, `aff1f0d`, `6ea194b` e `36460a5` estão em `git log`.
