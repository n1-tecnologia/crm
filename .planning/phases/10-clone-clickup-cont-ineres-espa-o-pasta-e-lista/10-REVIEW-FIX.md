---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
review: 10-REVIEW.md
fixed_at: 2026-10-29
branch: fase-10/fechamento
fixed: 7
deferred: 4
---

# Fase 10: correções da revisão de código

Os 8 achados médios da revisão (`10-REVIEW.md`), menos o MEDIUM-06, que é anterior à fase. Um commit por achado, cada um com teste que falha antes e passa depois. Os três baixos ficam para depois.

## Corrigidos

| Achado | Commit | O que mudou |
|---|---|---|
| MEDIUM-01 | `d541f23` | A coluna "Lixeira vencida" da prévia passa a ser o próprio `purgeExpiredTasks`, rodado numa cópia do estado com o ator e o "hoje" do worker. Conta as Subtarefas em cascata, não conta em dobro e não antecipa a Tarefa que só vence amanhã. Uma Lista sem ator conta 0, porque a volta real não elimina nada nela, e aparece no alerta do MEDIUM-07. |
| MEDIUM-02 | `902df90` | Mover uma Pasta é recusado quando há Pasta ou Lista abaixo que quem move não alcança, em qualquer ciclo de vida. A frase só conta, sem nome nem id, e vem antes de qualquer outra recusa que pudesse citar a parte escondida. |
| MEDIUM-03 | `88c7224` | `reorderContainers` renumera o grupo inteiro, mas devolve só os ids que o ator alcança. |
| MEDIUM-04 | `baf8f35` | `setContainerBlock` e `setContainerDefaultViews` respondem "não encontrado(a)" para o contêiner privado que o ator não alcança, antes da recusa de permissão. |
| MEDIUM-05 | `3e838ec` | Uma falha de banco na volta do relógio vai para o log ("Volta do relógio falhou.") e a volta seguinte tenta de novo; antes, a rejeição não tratada derrubava a API inteira. A semeadura só marca o dia como feito depois do último insert. |
| MEDIUM-07 | `b5fdfe7` | Uma linha `falhou` só volta a ser reivindicada um intervalo depois, então um `SEM_ATOR` não gasta as três tentativas na mesma volta. A prévia e o `--agenda` terminam com `BLOQUEIO: N Lista(s) sem ator`, com nome e id de cada uma. |
| MEDIUM-08 | `71e3a1f` | Com `AUTOMACOES_WORKER_ATIVO=true` e `AUTOMACOES_ESPACO_ID` vazio, a API não sobe e diz por quê. Todas as consultas do worker filtram sempre pelo Espaço. Em produção a variável está em `ws_n1` (conferido em 29/10), então o deploy não muda nada. |

Junto, o commit dos testes da `010` corrige dois testes que falhavam contra Postgres local desde o `7938d89`: o banco descartável do `migracao-010.test.ts` não tinha `plataforma.migracoes`, que a 009 referencia, e o caso (c) do `banco-n1-api.test.ts` esperava a 009 como última migração.

## Ficam para depois

- **MEDIUM-06:** o processo não sai no SIGTERM. É anterior à Fase 10 e não foi causado pelo agendador.
- **Partes do MEDIUM-07:** o alerta não diz se a Lista é privada (não há função pronta no domínio), e o contador de `tentativas` não zera depois de um `CONFLITO_DE_REVISAO` passageiro. Com o intervalo novo, ele já não gasta as três tentativas de uma vez.
- **LOW-01, LOW-02, LOW-03:** como descritos na revisão.

## Verificação

- `@n1/dominio`: typecheck limpo, 2133 testes passando.
- `apps/web`: typecheck limpo, 798 testes passando.
- `@n1/api`: typecheck limpo; a suíte inteira rodada contra um Postgres descartável local (container removido depois). Nenhum banco remoto tocado, nenhum `.env` lido.
