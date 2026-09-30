# Fase 6 — segunda rodada de fechamento: esboço dos planos 06-16 a 06-20

Fonte: `06-REVIEW-2.md` (crm-n1: CR-01, WR-01..05, IN-01..06) e
`06-REVIEW-FINANCEIRO-TRIA-2.md` (financeiro-tria: CR-01, WR-01..06, IN-01..10),
as revisões do código da primeira rodada de fechamento (06-07..06-14). Escopo:
"tudo", decidido pelo dono em 2026-09-29 (lacuna + críticos + avisos; info
quando trivial ou no arquivo já tocado, senão "Deferred (with reason)").

Mesmas regras de `06-GAPS-OUTLINE.md` e `06-CONTEXT.md`. Prefixos: `crm2:` =
`06-REVIEW-2.md`, `fin2:` = `06-REVIEW-FINANCEIRO-TRIA-2.md`. Todo plano com
`gap_closure: true`. Os planos podem rodar em duas trilhas paralelas (um
repositório cada), com commit por pathspec e pasta temporária própria; o
tracking é do orquestrador.

## Decisões fixadas aqui

1. **crm2:CR-01 (dispensa D6-04 sobrevive a desmarcar Manual):** a dispensa só
   vale enquanto a conta continua "Manual". A Conferência dispensada fica
   marcada como tal (dado, não texto) e `motivoParaNaoLancar` a trata como NÃO
   conferida quando o Campo "Integração manual" não é mais "Manual" (em
   qualquer modo — inclusive depois de voltar para `nao-encosta`); a decisão de
   dispensar usa o estado RELIDO, nunca o snapshot do começo do ciclo. Desmarcar
   "Manual" numa conta dispensada faz o próximo ciclo publicar um Resumo para
   conferência humana.
2. **fin2:CR-01 (varredura regrava decisão velha):** a decisão gravada fica
   registrada no receipt; a varredura de um receipt cuja decisão já foi gravada
   roda SÓ o S5; o S5 relê o Status da Solicitação pela porta antes de qualquer
   efeito e de novo antes de publicar, e não publica se ela não está mais
   aprovada; uma decisão só é aplicada se for mais nova que a última gravada
   para a Tarefa. Sem migração de banco (se precisar, é do dono, via SQL Editor).
3. **fin2:WR-02:** além do hostname em `CONTAS_A_PAGAR_ANEXOS_HOSTS`, o caminho
   da URL tem de começar por `/storage/v1/object/` (URLs assinadas e públicas do
   Storage do Supabase); a política injetada do teste declara o próprio prefixo.
4. **crm2:WR-02:** no `reaproveitado`, a ponte também compara o `dePara`
   devolvido com a tripla da Conferência (defesa contra um `automation/` v1.1);
   divergência ⇒ falha permanente com `tituloDivergente`. O roteiro diz a ordem
   de implantação: `automation/` v1.2 ANTES desta ponte.
5. **crm2:WR-03:** quem pode conferir pelo fio = quem pode conferir pelo clique
   (a mesma função do domínio para os dois caminhos); com
   `CONFERENCIA_POR_COMENTARIO=false`, nenhum texto (chamada do Resumo, card)
   pede "responda ok"; um "ok" que a ponte não pode aceitar recebe resposta no
   fio dizendo por quê (nunca silêncio).

## Planos

| Plano | Trilha | Depende de | Repositório | Objetivo | Achados |
|---|---|---|---|---|---|
| 06-16 | F | — | financeiro-tria | S5 assíncrono sem decisão velha, sem dedup que engole evento, sem varredura em série, sem receipt preso | fin2:CR-01, fin2:WR-04, fin2:WR-05, fin2:WR-06, fin2:WR-03, fin2:IN-10, fin2:IN-04, fin2:IN-08 |
| 06-17 | F | 06-16 | financeiro-tria (+ doc 05 e roteiro no crm) | `/lancar`: orçamento desde o início, Storage por prefixo, reaproveitado honesto | fin2:WR-01, fin2:WR-02, fin2:IN-01, fin2:IN-02, fin2:IN-03, fin2:IN-05, fin2:IN-06, fin2:IN-07, fin2:IN-09 |
| 06-18 | C | — | crm (`packages/dominio` + `apps/api`) | Dispensa só enquanto Manual; reaproveitado conferido na ponte; quem confere pelo fio = pelo clique | crm2:CR-01, crm2:WR-02, crm2:WR-03, crm2:IN-01, crm2:IN-03 |
| 06-19 | C | 06-18 | crm (`apps/api` + `apps/web` se preciso) | Janela em voo do `/lancar`, G3 no meio do ciclo, orçamento de gravações justo, detalhes da persistência | crm2:WR-01, crm2:WR-04, crm2:WR-05, crm2:IN-02, crm2:IN-04, crm2:IN-05, crm2:IN-06 |
| 06-20 | — | 06-16..06-19 | os dois | [BLOCKING] testes completos + (com autorização do dono) a jornada respondendo no fio de novo; `06-PROVAS.md`; o que fica com o dono | RES-03, RES-06 |
