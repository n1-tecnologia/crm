---
phase: 14
review: 14-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Escritas que referenciam um Contato sem travá-lo escapam para o Contato recém-mesclado"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Deadlock possível entre o gesto misto (trava do Espaço primeiro) e o REST de Canal (trava do Canal primeiro)"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`POST /tarefas-conversacionais/resumo` é leitura, mas o hook de suspensão a trata como escrita"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Falha do resumo deixa cartões, linhas e ficha em esqueleto para sempre"
  - id: WR-05
    severity: warning
    disposition: open
    title: "O resumo não suspende Contato nem Conversa na lixeira (RN-TAR-15) e só olha o primeiro Vínculo"
  - id: WR-06
    severity: warning
    disposition: open
    title: "Excluir de vez o sobrevivente de uma mesclagem vira 500 (FK `contatos_mesclado_em_fk` sem frase)"
  - id: WR-07
    severity: warning
    disposition: open
    title: "Criar Tarefa com `negocioId` confere o Negócio sem travá-lo"
  - id: WR-08
    severity: warning
    disposition: open
    title: "Recusas do domínio no gesto misto viram 409 `RECUSA_DO_DOMINIO` mesmo quando são 403 ou 404"
  - id: WR-09
    severity: warning
    disposition: open
    title: "\"Sem Responsável\" no diálogo de nova Tarefa conversacional atribui a Tarefa ao criador"
  - id: IN-01
    severity: info
    disposition: open
    title: "Em repetição de `removeMember`, o Sucessor pode ser um Convidado"
  - id: IN-02
    severity: info
    disposition: open
    title: "A seção Notas mostra só a primeira página e anuncia \"Mostrando X de Y\" sem como ver o resto"
  - id: IN-03
    severity: info
    disposition: open
    title: "`lidaAte` pode regredir e ir ao futuro"
  - id: IN-04
    severity: info
    disposition: open
    title: "O backfill da `011` mexe em `atualizado_em` de todas as Conversas já na lixeira"
  - id: IN-05
    severity: info
    disposition: open
    title: "O resumo aceita ids sem relação com Tarefas que o Membro enxerga"
open: 14
total: 14
recorded: 2026-11-05T13:28:19.334Z
---

# Phase 14: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | 14-REVIEW.md |
| WR-02 | warning | open | 14-REVIEW.md |
| WR-03 | warning | open | 14-REVIEW.md |
| WR-04 | warning | open | 14-REVIEW.md |
| WR-05 | warning | open | 14-REVIEW.md |
| WR-06 | warning | open | 14-REVIEW.md |
| WR-07 | warning | open | 14-REVIEW.md |
| WR-08 | warning | open | 14-REVIEW.md |
| WR-09 | warning | open | 14-REVIEW.md |
| IN-01 | info | open | 14-REVIEW.md |
| IN-02 | info | open | 14-REVIEW.md |
| IN-03 | info | open | 14-REVIEW.md |
| IN-04 | info | open | 14-REVIEW.md |
| IN-05 | info | open | 14-REVIEW.md |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.
