---
status: complete
phase: 04-as-outras-telas-do-financeiro-tria
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md, 04-08-SUMMARY.md, 04-09-SUMMARY.md, 04-10-SUMMARY.md, 04-11-SUMMARY.md, 04-12-SUMMARY.md, 04-13-SUMMARY.md, 04-14-SUMMARY.md]
started: 2026-09-25T15:50:35Z
updated: 2026-09-25T16:10:07Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Pare web (3001), api (3002) e o automation/. Suba o automation/ (com PLATAFORMA_LEITURA_TOKEN) e depois `npm run dev` na raiz. Os três sobem sem erro, e abrir /financeiro logado mostra o Dashboard com números reais — não "Servidor indisponível".
result: pass

### 2. Financeiro no trilho e controle de alcance
expected: Logado como Membro com alcance à Pasta "Financeiro", o trilho mostra o assunto Financeiro com as oito telas (Início, Notas fiscais, Produtos, Plano de contas, Extratos, Workflows, Problemas, Aprovações pendentes). Logado como Membro sem alcance, o item some da navegação e abrir /financeiro direto não mostra dado nenhum (acesso negado).
result: pass

### 3. Dashboard (/financeiro)
expected: Quatro tiles de métricas e duas seções ("Precisa da sua atenção" e "Problemas abertos"), com números que batem com o painel financeiro-tria.vercel.app de hoje.
result: pass

### 4. Estado de falha honesto
expected: Com o automation/ parado, qualquer tela do Financeiro mostra "Servidor indisponível" com botão para tentar de novo — nunca uma tabela vazia como se não houvesse dado. Religando o automation/ e clicando "Atualizar agora", os dados voltam.
result: pass

### 5. Problemas
expected: /financeiro/problemas lista as solicitações com problema, com o filtro de Empresa funcionando; sem problemas, mostra "Nenhum problema em aberto."
result: pass

### 6. Aprovações pendentes (só leitura)
expected: /financeiro/aprovacoes-pendentes lista as solicitações aguardando aprovação. Nenhuma linha é clicável e não existe botão de aprovar/recusar.
result: pass

### 7. Workflows
expected: /financeiro/workflows lista os workflows e o "Histórico de execuções". "Executar agora" dispara de verdade: aparece o toast "Execução iniciada. Isto pode levar alguns instantes." e, após "Atualizar agora", a nova execução aparece no histórico.
result: pass

### 8. Notas fiscais — leitura
expected: /financeiro/notas-fiscais mostra ~1.987 linhas (paginação completa, não cortado em 1000), com colunas Pedido, Cliente, Valor, Forma de pagamento, Status do pedido, Emissão etc.; busca "por pedido ou cliente" e filtros de forma/status funcionam. (Filtro "Plataforma" não existe — decisão pendente registrada.)
result: pass

### 9. Notas fiscais — gatilhos em lote
expected: "Marcar pedidos com 7 dias" e "Emitir as notas fiscais pendentes" abrem um diálogo de confirmação; ao confirmar, toast "Execução iniciada…" aparece. Após a corrida terminar e "Atualizar agora", os ícones de Emissão/7 dias refletem o novo estado. Não há botão de emitir por linha.
result: pass

### 10. Produtos — edição de alíquota
expected: /financeiro/produtos lista os ~42 produtos. Editar uma alíquota e sair do campo (blur) mostra "Salvando…" e depois "Alíquota atualizada."; recarregar a página mantém o valor. Se a gravação falhar, o campo volta ao valor anterior.
result: pass

### 11. Plano de contas
expected: Sem Empresa escolhida, pede "Escolha uma Empresa para ver o Plano de contas." Com Empresa e Tipo, lista as linhas. "Importar CSV" abre diálogo com aviso da consequência (muda a classificação do Agente) e só importa após confirmar a leitura do aviso. "Remover" em uma linha a apaga e mostra "Linha removida."
result: pass

### 12. Extratos — upload
expected: /financeiro/extratos exige escolher a Origem (Itaú, BTG, Nubank…) antes de anexar. Um PDF/CSV/XLSX/OFX sobe com barra de progresso ("Enviando…") e termina como enviado. Arquivo de extensão não aceita é recusado com mensagem clara, não erro genérico.
result: pass

### 13. Nenhuma leitura direta do Supabase no navegador
expected: Com a aba Network do DevTools aberta, navegar pelas oito telas: todas as chamadas de dado vão para o apps/api (localhost:3002/financeiro/*) — nenhuma requisição a *.supabase.co/rest/v1 com a chave anon para transacoes, produtos, conciliador_contas ou solicitacoes_pagamentos.
result: pass

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
