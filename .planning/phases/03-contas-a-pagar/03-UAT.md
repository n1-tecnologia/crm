---
status: complete
phase: 03-contas-a-pagar
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md, 03-10-SUMMARY.md, 03-11-SUMMARY.md, 03-12-SUMMARY.md, 03-13-SUMMARY.md, 03-14-SUMMARY.md, 03-15-SUMMARY.md]
started: 2026-09-25T20:00:00Z
updated: 2026-09-25T15:03:15Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Pare qualquer processo de dev em execução. Rode `npm run dev` da raiz. Web (3001) e api (3002) sobem sem erro, com prefixo de log por processo. Com `AUTOMACOES_WORKER_ATIVO=true` no .env do apps/api, o log mostra "scheduler de Automações ativo". Abrir http://localhost:3001, entrar, e a Lista "Contas a pagar" carrega com dados vindos do `GET /estado`.
result: pass

### 2. Fechamento em lote numa chamada só (PAG-05)
expected: Na Lista "Contas a pagar", como Aprovador (Marcos Paulo ou Walter Galvão Neto), selecione várias contas e use a barra de lote para movê-las a "pago". Sai UMA requisição `POST /operacoes/alterarStatusEmLote` (aba Network), e aparece um painel de relatório que não some sozinho, com as quatro contagens (alteradas / já estavam / recusadas / parciais) e o número de ocorrências criadas.
result: pass

### 3. Prévia de recusa antes do clique
expected: Como Membro do Financeiro (não Aprovador), selecione contas e escolha "pago" na barra de lote. Antes de clicar, aparece a frase `Só Marcos Paulo, Walter Galvão Neto move para "pago".` e "Aplicar" fica desabilitado. Se só UMA das selecionadas for recusável (ex.: sem Forma de pagamento, num status permitido), a prévia diz "1 de N seria recusada" e "Aplicar" continua habilitado. Acima de 200 selecionadas, "Aplicar" desabilita citando o total e o limite 200.
result: pass

### 4. Recorrência A1 ao pagar
expected: Mova uma conta recorrente para "pago". Aparece sozinha a ocorrência do mês seguinte, com vencimento no dia útil anterior quando o dia cai em fim de semana. Reabrir e pagar de novo a mesma conta NÃO cria uma segunda ocorrência. A Execução da Automação fica visível/auditável na Tarefa.
result: pass

### 5. Converter Solicitação aprovada em Conta a pagar (D3-08)
expected: Abra uma Solicitação de pagamento com aprovação concluída como "aprovada" e no Status `aprovado`. O card "Aprovação concluída" mostra o botão "Converter em Conta a pagar". Clicar cria a Conta a pagar (com Vínculo para a Solicitação) e o card passa a mostrar o identificador legível da Conta, sem oferecer converter de novo. Se a Solicitação ainda não estiver no Status `aprovado`, o botão aparece desabilitado nomeando o Status atual.
result: pass

### 6. Pessoa da conta vê só a própria Tarefa (PAG-06)
expected: Entre como a Pessoa de uma conta (ex.: Pedro / mem_thiago_pereira). Na barra lateral, "Compartilhadas comigo" lista a conta em que ele é o Campo Pessoa — e só ela; a conta do Lucas (mem_joao_konq) não aparece. Um Membro fora do Financeiro não vê a Lista "Contas a pagar".
result: pass

### 7. Pessoa da conta edita só Anexo e Data de Emissão
expected: Ainda como a Pessoa da conta, abra a própria Tarefa. Consegue anexar arquivo e preencher Data de Emissão. Tentar editar Valor (ou mudar Status) é recusado com uma frase que cita "Anexo e Data de Emissão".
result: pass

### 8. Busca global e "Minhas Tarefas" respeitam a visibilidade
expected: Como a Pessoa da conta (ou outro Membro sem acesso à Lista), a busca global não devolve contas que ela não vê, nem a Lista "Contas a pagar". Em Estrutura › Tarefas, a aba que antes se chamava "Todas do Espaço de Trabalho" agora se chama "Todas que eu vejo" e o contador bate com o que ela enxerga.
result: pass

### 9. Lançamento humano no Omie (diálogo)
expected: Numa conta em que falta o RESUMO de lançamento, o aviso na Tarefa completa oferece um botão que abre o diálogo de lançamento no Omie, com três campos de texto livre (sem lista de categorias). Salvar registra o lançamento humano e o aviso deixa de acusar a falta.
result: pass

### 10. Importação do histórico em dry-run (PAG-01)
expected: `npm run contas-a-pagar:importar -w @n1/api` (sem flag = dry-run) roda contra o export em `apps/api/exportacoes/clickup/901107637383/` e imprime `lidas 2861 · importadas 38 · avisadas 2823 · rejeitadas 0 · puladas 0`, com o mapa de lacunas por categoria. Nada é gravado no Postgres.
result: pass

### 11. Importação real, ponte do Agente e scheduler em produção
expected: `--apply` roda em ws_n1 e uma segunda execução é no-op; `MARCO_ZERO` gravado; `apps/api` em produção com a ponte do Agente em modo ensaio e o scheduler liberado por `automacoes:liberar`; `npm run ensaio:relatorio -w @n1/api` sai de INCONCLUSIVO depois de dias reais de Ensaio. (Checkpoints abertos de 03-07/03-08/03-10/03-11/03-13/03-15.)
result: pass
note: "Dono respondeu 'pass' em 2026-09-25. Pelo 05-UAT da mesma data, o apps/api não roda em produção e AUTOMACOES_WORKER_ATIVO segue desligado; o STATE registra 03-10 Task 4 (--apply) e 03-11 Task 3 parados. Se esses passos não foram feitos fora da sessão, o pass registra aceitação do dono, não execução."

### 12. Semana sem ClickUp e Lista 901107637383 arquivada (Critério 1)
expected: Os onze passos do runbook `docs/08-migracao-financeiro/06-runbook-de-corte.md` executados: o Financeiro passa uma semana operando Contas a pagar só no CRM N1 e a Lista `901107637383` do ClickUp fica arquivada.
result: pass
note: "Dono respondeu 'pass' em 2026-09-25. O STATE registra o runbook de corte (03-14 Task 4) escrito mas não executado; se a semana sem ClickUp e o arquivamento não aconteceram fora da sessão, o pass registra aceitação do dono, não execução."

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
