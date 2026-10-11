---
status: testing
phase: 07-crm-contatos-empresas-funis-e-negocios
source: [07-VERIFICATION.md]
started: 2026-10-11T17:48:43Z
updated: 2026-10-11T17:48:43Z
---

## Current Test

number: 1
name: Decisão do dono sobre a must-have de 07-12 'npm run check verde' (CRM-V1): o portão não está verde por duas falhas pré-existentes fora do CRM — apps/api/src/e2e
expected: |
  Ou (a) aceitar a ressalva para a fase, adicionando a override sugerida em 'Gaps Summary' ao frontmatter deste arquivo e fechando a janela #5 do WINDOWS.md com waive; ou (b) corrigir os dois testes do Financeiro antes de fechar a fase
awaiting: user response

## Tests

### 1. Decisão do dono sobre a must-have de 07-12 'npm run check verde' (CRM-V1): o portão não está verde por duas falhas pré-existentes fora do CRM — apps/api/src/e2e/lote-contas-a-pagar.test.ts (5 de 6, contra o banco remoto, conhecida desde a Fase 4) e a suíte 'Automação de Canal publicada na Lista de Solicitações (CR-05/05-17)' de apps/api/src/rotas/formularios-publicos.test.ts (seed). Regressão de 2026-10-11 em 8bc5590: web 507/507, dominio 1667/1667, api 1149 verdes / 5 falhas — exatamente esses dois arquivos. Nenhum dos dois foi tocado pela Fase 7 (não estão nos 115 arquivos do diff 00db206..HEAD)
expected: Ou (a) aceitar a ressalva para a fase, adicionando a override sugerida em 'Gaps Summary' ao frontmatter deste arquivo e fechando a janela #5 do WINDOWS.md com waive; ou (b) corrigir os dois testes do Financeiro antes de fechar a fase
why_human: A must-have é literal ('npm run check verde') e observavelmente não vale no repositório inteiro, mas a causa é externa à fase e já está registrada como decisão aberta em 07-PROVAS.md ('Fica com o dono', item 3). Só o dono decide entre aceitar a ressalva e corrigir
result: [pending]

### 2. Rodar a suíte de banco do CRM contra um Postgres local (container, porta localhost) — `npm test -w @n1/api` com DATABASE_URL apontando para localhost — ou aceitar o registro de 07-12 (159/159, 0 pulados)
expected: Os 89 casos que pularam nesta verificação passam; isso fecha os 26 itens de behavior_unverified_items
why_human: O verificador não sobe containers (instrução do orquestrador) e o .env aponta para o banco da plataforma, contra o qual os testes do CRM pulam por desenho (D-12)
result: [pending]

### 3. UAT de fim de fase pelo roteiro de 07-PROVAS.md (8 passos) no app real: `npm run dev` (web 3001 + api 3002 contra o banco da plataforma com a 007 aplicada), dois logins Supabase no mesmo Espaço (Administrador e Membro). Passos: (1) Novo Funil 'Vendas' com 2 Etapas e 'Exigir valor ao marcar ganho'; (2) Novo Contato 'Ana' com e-mail; (3) Nova Empresa 'Alfa' com Ana como admin; (4) Novo Negócio da Alfa, arrastar, Ganhar sem valor (recusa) e com valor, Reabrir; (5) Excluir Ana (recusa com links); (6) Excluir Vendas (recusa padrão → recusa com Negócios → migrar → Lixeira → Restaurar); (7) como Membro: Funis só leitura, Reabrir ganho desabilitado; (8) Busca global mostra os registros antigos
expected: Cada passo grava e relê pela api (recarregar mantém o dado); as recusas dos passos 4, 5 e 6 aparecem com a frase e os links; o passo 7 mostra as ações desabilitadas com o motivo; o passo 8 abre a ficha antiga. Preencher a coluna 'Resultado' de 07-PROVAS.md e fechar as janelas #1-#4 do WINDOWS.md com `gsd-tools windows fixed <id>`
why_human: Depende de JWT real do Supabase, do navegador e do banco da plataforma — nenhum teste automatizado desta base tem as três coisas juntas (07-13 <human-check>; 07-VALIDATION.md 'Manual-Only Verifications'). Nenhuma tela do CRM foi aberta em navegador real durante a execução (WINDOWS.md #1-#4, unrun-verify)
result: [pending]

### 4. Aparência e uso real da lista, do formulário e da ficha de Contato em navegador: abas Ativos/Arquivados/Lixeira em ?estado=, busca com espera de 300 ms, 'Mostrar mais' de 50 em 50, Restaurar/Excluir permanentemente na Lixeira, Novo Contato escondido para Convidado (07-01 D2 e 07-06 D1, human_judgment: true; WINDOWS.md #1)
expected: A lista lê de GET /contatos e troca de aba sem piscar as linhas da outra; o formulário cria por POST /contatos e a lista revalida
why_human: Só houve teste de componente com fetch falso e um render temporário apagado; o comportamento visual e o SWR real não foram vistos
result: [pending]

### 5. Aparência e uso real de /crm/funis e da ficha de Funil em navegador: abas, Pílula 'Funil padrão', diálogo Novo Funil com Etapas e pré-validação do domínio; editor de Etapas, Regras de encerramento, 'Definir como padrão', ciclo de vida e modo somente leitura para quem não administra (07-07 D2/D3, human_judgment: true)
expected: O primeiro Funil aparece marcado como padrão sem ninguém marcar; para Membro os controles aparecem desabilitados com o motivo
why_human: Testes de componente com fetch falso passaram (177/177), mas a tela não foi exercitada no navegador
result: [pending]

### 6. Aparência e uso real do diálogo Nova Empresa, da ficha, do popup ?empresa= e do 'Trocar admin' em navegador (07-09 D6, human_judgment: true; WINDOWS.md #2)
expected: Criar fica desabilitado com o motivo até escolher ou cadastrar o admin; rebaixar o último admin mostra ULTIMO_ADMIN e oferece Trocar admin; restaurar da lixeira pede o admin
why_human: Só teste de componente com fetch falso e build
result: [pending]

### 7. Aparência e sensação do quadro de Negócios em navegador real: opacidade do cartão em arraste, realce data-recente ao mudar de coluna, barra de rolagem no topo, faixa de encerrados, diálogo Novo Negócio em duas colunas; reversão do cartão em 409 (07-10 D7, human_judgment: true; WINDOWS.md #3)
expected: Soltar o cartão noutra coluna chama POST /negocios/:id/mover e a Etapa persiste ao recarregar; uma recusa devolve o cartão e mostra a frase
why_human: Arrastar-e-soltar e o mutate otimista com reversão foram testados com fetch falso, não no navegador
result: [pending]

### 8. Aparência e uso real da ficha de Negócio (painéis, troca de Funil, diálogos de encerramento) e da seção Negócios nas fichas de Contato e Empresa em navegador (07-11 D10, human_judgment: true; WINDOWS.md #4)
expected: Negócio arquivado aparece só para leitura; Reabrir de ganho desabilitado para Membro com o motivo; 'Novo Negócio' da seção vem preenchido com o dono
why_human: Só teste de componente com fetch falso e build
result: [pending]

### 9. Aceitação do portão de 07-12 como registrado: `npm run check` com a ressalva e `npm run build` verde, rotas /crm/* compiladas; e os seis CONTEXT.md documentando D-03/D-01, src/dados/crm/, --seco e D-15 (07-12 D3/D4, human_judgment: true)
expected: O dono confirma que a documentação e a ressalva são aceitáveis para fechar a fase
why_human: Qualidade de documentação é juízo humano; o grep confirma só a presença dos termos
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
