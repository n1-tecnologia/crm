---
phase: 07-crm-contatos-empresas-funis-e-negocios
verified: 2026-10-11T17:38:36Z
status: passed
score: 53/81 must-haves verified
behavior_unverified: 26
overrides_applied: 1
overrides:
  - must_have: "CRM-V1: npm run check (tipos, lint, tokens, contratos e testes dos três workspaces) e npm run build ficam verdes"
    reason: "As 5 falhas restantes são pré-existentes e exclusivas do Financeiro (lote-contas-a-pagar.test.ts contra o banco remoto, conhecida desde a Fase 4; seed de formularios-publicos.test.ts), fora dos 115 arquivos da Fase 7; os testes do CRM estão verdes nos três workspaces e registrados em deferred-items.md e WINDOWS.md #5"
    accepted_by: "Igor Vilas Boas"
    accepted_at: "2026-10-11T22:25:00Z"
covered_digest: "v3:sha256:5c2cc324adbfeae0f191e537736305d90dc0bf45b69c5a838a46e0049db14098"
covered_files:
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-01-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-01-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-02-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-02-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-03-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-03-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-04-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-04-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-05-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-05-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-06-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-06-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-07-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-07-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-08-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-08-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-09-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-09-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-10-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-10-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-11-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-11-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-12-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-12-SUMMARY.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-13-PLAN.md"
  - ".planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-13-SUMMARY.md"
  - "CONTEXT.md"
  - "apps/api/CONTEXT.md"
  - "apps/api/migracoes/007-crm.sql"
  - "apps/api/src/app.test.ts"
  - "apps/api/src/app.ts"
  - "apps/api/src/e2e/crm-fluxo.test.ts"
  - "apps/api/src/persistencia/migrar-seco.test.ts"
  - "apps/api/src/persistencia/migrar.cli.ts"
  - "apps/api/src/persistencia/migrar.ts"
  - "apps/api/src/repositorios/CONTEXT.md"
  - "apps/api/src/repositorios/crm/admin-da-empresa.test.ts"
  - "apps/api/src/repositorios/crm/contatos.ts"
  - "apps/api/src/repositorios/crm/empresas.ts"
  - "apps/api/src/repositorios/crm/funis.ts"
  - "apps/api/src/repositorios/crm/membros.ts"
  - "apps/api/src/repositorios/crm/negocios.ts"
  - "apps/api/src/repositorios/crm/sql.ts"
  - "apps/api/src/repositorios/crm/vinculos.ts"
  - "apps/api/src/rotas/CONTEXT.md"
  - "apps/api/src/rotas/crm/comum.ts"
  - "apps/api/src/rotas/crm/contatos.test.ts"
  - "apps/api/src/rotas/crm/contatos.ts"
  - "apps/api/src/rotas/crm/empresas.test.ts"
  - "apps/api/src/rotas/crm/empresas.ts"
  - "apps/api/src/rotas/crm/funis.test.ts"
  - "apps/api/src/rotas/crm/funis.ts"
  - "apps/api/src/rotas/crm/index.ts"
  - "apps/api/src/rotas/crm/negocios.test.ts"
  - "apps/api/src/rotas/crm/negocios.ts"
  - "apps/api/src/servicos/CONTEXT.md"
  - "apps/api/src/servicos/crm/acesso.ts"
  - "apps/api/src/servicos/crm/contatos.test.ts"
  - "apps/api/src/servicos/crm/contatos.ts"
  - "apps/api/src/servicos/crm/empresas.test.ts"
  - "apps/api/src/servicos/crm/empresas.ts"
  - "apps/api/src/servicos/crm/funis.test.ts"
  - "apps/api/src/servicos/crm/funis.ts"
  - "apps/api/src/servicos/crm/negocios.test.ts"
  - "apps/api/src/servicos/crm/negocios.ts"
  - "apps/api/src/servicos/crm/resultado.ts"
  - "apps/api/src/servicos/crm/transacao.test.ts"
  - "apps/api/src/servicos/crm/transacao.ts"
  - "apps/api/src/testes/banco-crm.ts"
  - "apps/web/CONTEXT.md"
  - "apps/web/package.json"
  - "apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx"
  - "apps/web/src/app/(shell)/crm/contatos/page.tsx"
  - "apps/web/src/app/(shell)/crm/empresas/[empresa]/page.tsx"
  - "apps/web/src/app/(shell)/crm/empresas/page.tsx"
  - "apps/web/src/app/(shell)/crm/funis/[funil]/page.tsx"
  - "apps/web/src/app/(shell)/crm/funis/page.tsx"
  - "apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx"
  - "apps/web/src/app/(shell)/crm/negocios/page.tsx"
  - "apps/web/src/dados/crm/cliente-crm.test.ts"
  - "apps/web/src/dados/crm/cliente-crm.ts"
  - "apps/web/src/dados/crm/contatos.test.ts"
  - "apps/web/src/dados/crm/contatos.ts"
  - "apps/web/src/dados/crm/empresas.test.ts"
  - "apps/web/src/dados/crm/empresas.ts"
  - "apps/web/src/dados/crm/funis.test.ts"
  - "apps/web/src/dados/crm/funis.ts"
  - "apps/web/src/dados/crm/negocios.test.ts"
  - "apps/web/src/dados/crm/negocios.ts"
  - "apps/web/src/dados/crm/sessao.ts"
  - "apps/web/src/features/crm/cartao-de-negocio.tsx"
  - "apps/web/src/features/crm/ciclo-de-vida.tsx"
  - "apps/web/src/features/crm/create-record-dialog.tsx"
  - "apps/web/src/features/crm/dialogo-de-encerramento.test.tsx"
  - "apps/web/src/features/crm/dialogo-de-encerramento.tsx"
  - "apps/web/src/features/crm/dialogos-de-funil.test.tsx"
  - "apps/web/src/features/crm/editor-de-campos-adicionais.tsx"
  - "apps/web/src/features/crm/editor-de-enderecos.tsx"
  - "apps/web/src/features/crm/etapas-do-funil.tsx"
  - "apps/web/src/features/crm/ficha-de-contato.test.tsx"
  - "apps/web/src/features/crm/ficha-de-contato.tsx"
  - "apps/web/src/features/crm/ficha-de-empresa.test.tsx"
  - "apps/web/src/features/crm/ficha-de-empresa.tsx"
  - "apps/web/src/features/crm/ficha-de-funil.test.tsx"
  - "apps/web/src/features/crm/ficha-de-funil.tsx"
  - "apps/web/src/features/crm/ficha-de-negocio.test.tsx"
  - "apps/web/src/features/crm/ficha-de-negocio.tsx"
  - "apps/web/src/features/crm/formulario-de-contato.test.tsx"
  - "apps/web/src/features/crm/formulario-de-contato.tsx"
  - "apps/web/src/features/crm/formulario-de-empresa.test.tsx"
  - "apps/web/src/features/crm/formulario-de-empresa.tsx"
  - "apps/web/src/features/crm/formulario-de-funil.test.tsx"
  - "apps/web/src/features/crm/formulario-de-funil.tsx"
  - "apps/web/src/features/crm/formulario-de-negocio.tsx"
  - "apps/web/src/features/crm/legado/ficha-de-contato-legado.tsx"
  - "apps/web/src/features/crm/legado/ficha-de-empresa-legado.tsx"
  - "apps/web/src/features/crm/migrate-funnel-dialog.tsx"
  - "apps/web/src/features/crm/negocios-do-registro.test.tsx"
  - "apps/web/src/features/crm/negocios-do-registro.tsx"
  - "apps/web/src/features/crm/paginas-de-empresa.test.tsx"
  - "apps/web/src/features/crm/quadro-do-funil.test.tsx"
  - "apps/web/src/features/crm/quadro-do-funil.tsx"
  - "apps/web/src/features/crm/remove-stage-dialog.tsx"
  - "apps/web/src/features/crm/seletor-de-proprietario.tsx"
  - "apps/web/src/features/crm/seletor-de-registro.tsx"
  - "apps/web/src/features/crm/vinculos-da-empresa.tsx"
  - "package-lock.json"
  - "packages/dominio/CONTEXT.md"
  - "packages/dominio/src/crm/comum.ts"
  - "packages/dominio/src/crm/contatos.test.ts"
  - "packages/dominio/src/crm/contatos.ts"
  - "packages/dominio/src/crm/empresas.test.ts"
  - "packages/dominio/src/crm/empresas.ts"
  - "packages/dominio/src/crm/funis.test.ts"
  - "packages/dominio/src/crm/funis.ts"
  - "packages/dominio/src/crm/negocios.test.ts"
  - "packages/dominio/src/crm/negocios.ts"
  - "packages/dominio/src/crm/normalizacao.test.ts"
  - "packages/dominio/src/crm/normalizacao.ts"
  - "packages/dominio/src/crm/permissoes.test.ts"
  - "packages/dominio/src/crm/permissoes.ts"
decision_coverage:
  honored: 15
  total: 15
  not_honored: []
behavior_unverified_items:
  - truth: "07-01 D-03/D-11/D-10 (traçador): a linha nasce em plataforma.contatos com workspace_id da sessão, Proprietário e criado_por padrão = Membro da sessão, Contato do Espaço A invisível ao Espaço B"
    test: "Com o container Postgres local de pé (convenção de apps/api/src/testes/banco-crm.ts: só localhost/127.0.0.1), rodar `npx vitest run src/rotas/crm/contatos.test.ts -t \"(f) o ciclo inteiro\"` e `-t \"(f) GET /contatos/:id de outro Espaço\"` em apps/api"
    expected: "Os blocos describeComBanco deixam de pular e passam (registro de 07-12: 159/159 do CRM contra o container, 0 pulados)"
    why_human: "Nesta verificação não há Postgres local (apps/api/.env aponta para o Supabase da plataforma): 89 casos de banco do CRM pularam por desenho (24 em rotas/crm + 65 em servicos/repositorios/e2e/migrar-seco). O código está presente e ligado; a transição no banco não foi exercitada aqui"
  - truth: "07-02 D-10/D-08-D-09: Papel lido de plataforma.registros (members → roles) a cada chamada; comTransacao faz commit dentro do try e traduz o constraint trigger deferido em 409"
    test: "`npx vitest run src/servicos/crm/transacao.test.ts -t \"comTransacao\"` em apps/api com o container local"
    expected: "Casos (a)-(d): commit persiste, recusa faz rollback, Empresa sem admin falha no commit e vira 409, 23505 traduzido pela frase passada"
    why_human: "traduzirErroDePg (sem banco) passou 6/6 aqui; a parte transacional (commit, rollback, trigger deferido) só roda contra Postgres"
  - truth: "07-03 D-06/D-09/RN-CON-11/D-11/D-10: lixeira, restaurar e exclusão permanente de Contato; 409 CONTATO_BLOQUEADO com bloqueios; 409 IDENTIFICADOR_EM_USO; principal rebaixa o anterior na mesma transação; GET de outro Espaço é 404"
    test: "`npx vitest run src/servicos/crm/contatos.test.ts` em apps/api com o container local (casos a-i)"
    expected: "11 casos passam, inclusive (e) D-09 e (b) IDENTIFICADOR_EM_USO"
    why_human: "A pré-checagem de D-09 (empresasEmQueEhUnicoAdmin, servicos/crm/contatos.ts:404 e :437) está ligada; o efeito no banco só é provado pelo bloco describeComBanco, pulado aqui"
  - truth: "07-04 D-13/D-07/D-06/RN-FUN-04/D-10: primeiro Funil nasce padrão e a troca é transacional (pg_advisory_xact_lock); FUNIL_COM_NEGOCIOS/ETAPA_COM_NEGOCIOS com contagem; FUNIL_PADRAO e FUNIL_NOME_EM_USO; ULTIMA_ETAPA e reordenação em um UPDATE; privado só gravado e Funil de outro Espaço é 404"
    test: "`npx vitest run src/servicos/crm/funis.test.ts` em apps/api com o container local (casos a-k)"
    expected: "Os 11 casos passam; (a) e (c) provam D-13, (e)-(g) provam D-07 e a migração"
    why_human: "deveNascerPadrao (regra pura) passou nos 616 do domínio e está ligada em servicos/crm/funis.ts:247; a serialização por advisory lock e as contagens vivem no banco"
  - truth: "07-05 D-12/D-08/RN-EMP-09-10/D-06/D-10: o trigger corrigido da 007 (crm_confere_admin ignora na_lixeira; empresas_exige_admin_estado exige admin ao sair da lixeira); POST /empresas grava Empresa, Contato novo e vínculo admin numa transação só; DELETE encerra vínculos; EMPRESA_SEM_ADMIN, ULTIMO_ADMIN, trocar-admin; EMPRESA_BLOQUEADA/EMPRESA_COM_NEGOCIOS/EMPRESA_COM_FILIAIS; Empresa de outro Espaço é 404"
    test: "`npx vitest run src/repositorios/crm/admin-da-empresa.test.ts src/servicos/crm/empresas.test.ts` em apps/api com o container local (Postgres 16)"
    expected: "6 casos do trigger (a-f) e 9 do serviço (a-i) passam"
    why_human: "A 007 contém a correção (linhas 263-296) e o serviço chama encerrarVigentesDaEmpresa (empresas.ts:782) e cria novoContato na mesma transação (:407-:434); o comportamento do constraint trigger deferido só existe no Postgres"
  - truth: "07-08 RN-NEG-03/encerramento/D-06/D-10-D-11: criar sem Funil usa o padrão e a Etapa inicial (SEM_FUNIL_PADRAO sem padrão); ganhar/perder gravam encerrado_em e zeram a probabilidade; reabrir limpa motivo/nota/encerrado_em; arquivado é somente leitura (NEGOCIO_INATIVO); RN-NEG-18; Negócio de outro Espaço é 404; Empresa OU Contato"
    test: "`npx vitest run src/servicos/crm/negocios.test.ts` em apps/api com o container local (casos a-h)"
    expected: "Os 13 casos passam; (c) prova valor como texto decimal e a data civil igual"
    why_human: "validarGanho/validarPerda/validarReabertura (regras puras) passaram no domínio e estão ligadas (negocios.ts:459, funilPadrao em :347); as transições de situacao/estado no banco só são provadas pelo bloco describeComBanco"
  - truth: "07-12 CRM-V1: o e2e por app.inject percorre o CRM inteiro (Funil padrão → Contato → Empresa com admin → Negócio → mover → ganhar com Regra → reabrir 403/200 → lixeira de Contato bloqueada → lixeira de Funil bloqueada e resolvida por migração → isolamento)"
    test: "`npx vitest run src/e2e/crm-fluxo.test.ts` em apps/api com o container local"
    expected: "8/8 (d1-d4, e1-e3, f) — registro de 07-12: 8/8 antes do commit RED"
    why_human: "O arquivo existe (278 linhas, 8 casos nomeados exatamente com o fluxo da must-have, asserções de valor: situacao, valor, encerradoEm, códigos 409/403); pulou aqui por falta de banco local"
human_verification:
  - test: "Decisão do dono sobre a must-have de 07-12 'npm run check verde' (CRM-V1): o portão não está verde por duas falhas pré-existentes fora do CRM — apps/api/src/e2e/lote-contas-a-pagar.test.ts (5 de 6, contra o banco remoto, conhecida desde a Fase 4) e a suíte 'Automação de Canal publicada na Lista de Solicitações (CR-05/05-17)' de apps/api/src/rotas/formularios-publicos.test.ts (seed). Regressão de 2026-10-11 em 8bc5590: web 507/507, dominio 1667/1667, api 1149 verdes / 5 falhas — exatamente esses dois arquivos. Nenhum dos dois foi tocado pela Fase 7 (não estão nos 115 arquivos do diff 00db206..HEAD)"
    expected: "Ou (a) aceitar a ressalva para a fase, adicionando a override sugerida em 'Gaps Summary' ao frontmatter deste arquivo e fechando a janela #5 do WINDOWS.md com waive; ou (b) corrigir os dois testes do Financeiro antes de fechar a fase"
    why_human: "A must-have é literal ('npm run check verde') e observavelmente não vale no repositório inteiro, mas a causa é externa à fase e já está registrada como decisão aberta em 07-PROVAS.md ('Fica com o dono', item 3). Só o dono decide entre aceitar a ressalva e corrigir"
  - test: "Rodar a suíte de banco do CRM contra um Postgres local (container, porta localhost) — `npm test -w @n1/api` com DATABASE_URL apontando para localhost — ou aceitar o registro de 07-12 (159/159, 0 pulados)"
    expected: "Os 89 casos que pularam nesta verificação passam; isso fecha os 26 itens de behavior_unverified_items"
    why_human: "O verificador não sobe containers (instrução do orquestrador) e o .env aponta para o banco da plataforma, contra o qual os testes do CRM pulam por desenho (D-12)"
  - test: "UAT de fim de fase pelo roteiro de 07-PROVAS.md (8 passos) no app real: `npm run dev` (web 3001 + api 3002 contra o banco da plataforma com a 007 aplicada), dois logins Supabase no mesmo Espaço (Administrador e Membro). Passos: (1) Novo Funil 'Vendas' com 2 Etapas e 'Exigir valor ao marcar ganho'; (2) Novo Contato 'Ana' com e-mail; (3) Nova Empresa 'Alfa' com Ana como admin; (4) Novo Negócio da Alfa, arrastar, Ganhar sem valor (recusa) e com valor, Reabrir; (5) Excluir Ana (recusa com links); (6) Excluir Vendas (recusa padrão → recusa com Negócios → migrar → Lixeira → Restaurar); (7) como Membro: Funis só leitura, Reabrir ganho desabilitado; (8) Busca global mostra os registros antigos"
    expected: "Cada passo grava e relê pela api (recarregar mantém o dado); as recusas dos passos 4, 5 e 6 aparecem com a frase e os links; o passo 7 mostra as ações desabilitadas com o motivo; o passo 8 abre a ficha antiga. Preencher a coluna 'Resultado' de 07-PROVAS.md e fechar as janelas #1-#4 do WINDOWS.md com `gsd-tools windows fixed <id>`"
    why_human: "Depende de JWT real do Supabase, do navegador e do banco da plataforma — nenhum teste automatizado desta base tem as três coisas juntas (07-13 <human-check>; 07-VALIDATION.md 'Manual-Only Verifications'). Nenhuma tela do CRM foi aberta em navegador real durante a execução (WINDOWS.md #1-#4, unrun-verify)"
  - test: "Aparência e uso real da lista, do formulário e da ficha de Contato em navegador: abas Ativos/Arquivados/Lixeira em ?estado=, busca com espera de 300 ms, 'Mostrar mais' de 50 em 50, Restaurar/Excluir permanentemente na Lixeira, Novo Contato escondido para Convidado (07-01 D2 e 07-06 D1, human_judgment: true; WINDOWS.md #1)"
    expected: "A lista lê de GET /contatos e troca de aba sem piscar as linhas da outra; o formulário cria por POST /contatos e a lista revalida"
    why_human: "Só houve teste de componente com fetch falso e um render temporário apagado; o comportamento visual e o SWR real não foram vistos"
  - test: "Aparência e uso real de /crm/funis e da ficha de Funil em navegador: abas, Pílula 'Funil padrão', diálogo Novo Funil com Etapas e pré-validação do domínio; editor de Etapas, Regras de encerramento, 'Definir como padrão', ciclo de vida e modo somente leitura para quem não administra (07-07 D2/D3, human_judgment: true)"
    expected: "O primeiro Funil aparece marcado como padrão sem ninguém marcar; para Membro os controles aparecem desabilitados com o motivo"
    why_human: "Testes de componente com fetch falso passaram (177/177), mas a tela não foi exercitada no navegador"
  - test: "Aparência e uso real do diálogo Nova Empresa, da ficha, do popup ?empresa= e do 'Trocar admin' em navegador (07-09 D6, human_judgment: true; WINDOWS.md #2)"
    expected: "Criar fica desabilitado com o motivo até escolher ou cadastrar o admin; rebaixar o último admin mostra ULTIMO_ADMIN e oferece Trocar admin; restaurar da lixeira pede o admin"
    why_human: "Só teste de componente com fetch falso e build"
  - test: "Aparência e sensação do quadro de Negócios em navegador real: opacidade do cartão em arraste, realce data-recente ao mudar de coluna, barra de rolagem no topo, faixa de encerrados, diálogo Novo Negócio em duas colunas; reversão do cartão em 409 (07-10 D7, human_judgment: true; WINDOWS.md #3)"
    expected: "Soltar o cartão noutra coluna chama POST /negocios/:id/mover e a Etapa persiste ao recarregar; uma recusa devolve o cartão e mostra a frase"
    why_human: "Arrastar-e-soltar e o mutate otimista com reversão foram testados com fetch falso, não no navegador"
  - test: "Aparência e uso real da ficha de Negócio (painéis, troca de Funil, diálogos de encerramento) e da seção Negócios nas fichas de Contato e Empresa em navegador (07-11 D10, human_judgment: true; WINDOWS.md #4)"
    expected: "Negócio arquivado aparece só para leitura; Reabrir de ganho desabilitado para Membro com o motivo; 'Novo Negócio' da seção vem preenchido com o dono"
    why_human: "Só teste de componente com fetch falso e build"
  - test: "Aceitação do portão de 07-12 como registrado: `npm run check` com a ressalva e `npm run build` verde, rotas /crm/* compiladas; e os seis CONTEXT.md documentando D-03/D-01, src/dados/crm/, --seco e D-15 (07-12 D3/D4, human_judgment: true)"
    expected: "O dono confirma que a documentação e a ressalva são aceitáveis para fechar a fase"
    why_human: "Qualidade de documentação é juízo humano; o grep confirma só a presença dos termos"
---

# Phase 7: CRM: Contatos, Empresas, Funis e Negócios (backend e frontend) — Relatório de Verificação

**Objetivo da fase:** Contatos, Empresas, Funis (com Etapas) e Negócios podem ser criados, lidos, editados e excluídos direto pelo frontend. Cobre as três camadas, começando pelo domínio: tipos e regras em `@n1/dominio` (fonte: `ontologia/03-crm`); repositórios e rotas em `apps/api` sobre `apps/api/migracoes/007-crm.sql`, com isolamento por Espaço de Trabalho e acesso por Membro aplicados no backend; e, em `apps/web`, todas as telas, formulários, listas e navegação que ainda não existem (a web fala com a api só por HTTP, nunca importa dela). Fora do escopo: Caixa de Entrada/Conversas/Mensagens e catálogos.
**Verificado:** 2026-10-11T17:38:36Z (HEAD `c5fc6da`, branch `main`)
**Status:** human_needed
**Re-verificação:** Não — verificação inicial (nenhuma VERIFICATION.md anterior)
**Modo:** goal-backward padrão (`mode: null` no ROADMAP; sem `success_criteria` explícitos — o contrato é o objetivo mais os sete IDs CRM-D1..CRM-V1 de REQUIREMENTS.md, detalhados pelas 81 `must_haves.truths` dos 13 planos; nenhum plano declara `prohibitions`)

## Como ler este relatório

Nada abaixo vem das SUMMARYs. O que foi feito nesta verificação, com os comandos reais:

- **Domínio (puro):** `npx vitest run src/crm` em `packages/dominio` — 6 arquivos, **616/616** em 133 ms.
- **Web (telas e adaptadores HTTP com fetch falso):** `npx vitest run src/dados/crm src/features/crm` em `apps/web` — 17 arquivos, **177/177**.
- **API (contrato HTTP com serviço/acesso falsos):** `npx vitest run src/rotas/crm src/servicos/crm/transacao.test.ts` em `apps/api` — 5 arquivos, **75 passaram, 24 pularam** (os blocos `describeComBanco`).
- **API (banco):** `npx vitest run src/servicos/crm src/repositorios/crm src/persistencia/migrar-seco.test.ts src/e2e/crm-fluxo.test.ts` — **6 passaram (traduzirErroDePg), 65 pularam**. Não há Postgres local nesta máquina (`lsof` nas portas 5432/55473/55474 vazio; nenhum container postgres) e o verificador não sobe containers. **Esses 89 casos são exatamente a prova das transições no banco**; por isso 26 verdades ficam "presentes, comportamento não exercitado" e vão para a verificação humana, não para a pontuação.
- **Ligações:** `verify.artifacts` e `verify.key-links` dos 13 planos, mais grep manual onde o `from:` usava a notação `arquivo::símbolo` (que a ferramenta não resolve).
- **Commits:** `verify.commits` sobre os 26 `plan_head_before/after` das SUMMARYs — 26/26 existem.
- **Fronteira de camadas:** `grep` de imports de `@n1/api`/`apps/api` em `apps/web/src` — 0; de `apps/`/`@n1/web` em `packages/dominio/src` — 0.
- **Decisões (gate não bloqueante):** `check.decision-coverage-verify` — 15/15 decisões D-01..D-15 honradas, 0 não honradas.

## Goal Achievement

### Critérios da fase (os sete IDs — o contrato)

| ID | Critério (REQUIREMENTS.md, Fase 7) | Status | Evidência |
|---|---|---|---|
| CRM-D1 | Tipos, normalizadores e regras puras em `@n1/dominio/crm/*`, em português, espelhando a 007; o modelo inglês convive (D-01) | ✓ VERIFICADO | `packages/dominio/src/crm/{comum,contatos,empresas,funis,negocios,normalizacao,permissoes}.ts` (129–379 linhas cada), 616/616 testes aqui; `packages/dominio/package.json`, `src/types/crm.ts`, `operations/{contacts,deals}.ts` e `src/index.ts` **não** estão no diff da fase |
| CRM-A1 | Repositórios + serviços + rotas REST `/contatos`, `/empresas`, `/funis`, `/negocios` com isolamento por `workspace_id` e permissão por Papel | ✓ VERIFICADO (contrato) / ⚠️ banco não exercitado | 53 rotas registradas (`rotas.get/post/patch/put/delete`: contatos 11, empresas 15, funis 15, negócios 12), todas sob `rotasDeCrm` em `app.ts`; `workspace_id` em todo `WHERE` dos repositórios (contatos 21, empresas 25, funis 32, negócios 15, vínculos 17 ocorrências); `exigir()` antes de ler/escrever; 75 testes de rota passaram aqui; a escrita real no Postgres só é provada pelos blocos de banco (pulados — ver human_verification #2) |
| CRM-A2 | 409 ricos: D-07, D-08 (com a 007 corrigida — D-12), D-09, unicidade de Identificador | ⚠️ PRESENTE, comportamento não exercitado | Código e `bloqueios` presentes e ligados (`empresasEmQueEhUnicoAdmin` em `servicos/crm/contatos.ts:404,437`; `FUNIL_COM_NEGOCIOS`, `ULTIMO_ADMIN`, `IDENTIFICADOR_EM_USO`); a 007 traz `crm_confere_admin ... estado <> 'na_lixeira'` (l.263-267) e `empresas_exige_admin_estado` (l.295-296); `traduzirErroDePg` 6/6 aqui; as provas de banco pularam |
| CRM-A3 | Ações de Negócio: mover, ganhar, perder, reabrir, arquivar, restaurar, lixeira, excluir permanentemente | ✓ VERIFICADO (contrato e regra) / ⚠️ transições no banco | 12 rotas de Negócio incl. `POST /negocios/:id/{mover,ganhar,perder,reabrir,arquivar,restaurar}`, `DELETE /negocios/:id[/permanente]`; `validarGanho` ligado em `servicos/crm/negocios.ts:459`, `funilPadrao` em `:347`; regras puras 616/616; rota "(c) o 403 do serviço em reabrir passa intacto" passou; `servicos/crm/negocios.test.ts` (13 casos) pulou |
| CRM-W1 | Telas de Contatos, Empresas, Funis (+Etapas) e Negócios — lista, ficha, criar/editar, lixeira/restaurar — só por HTTP | ✓ VERIFICADO (código e testes de componente) / 🧑 navegador pendente | 8 páginas em `apps/web/src/app/(shell)/crm/{contatos,empresas,funis,negocios}[/[id]]/page.tsx` lendo por `useContatos/useContato/useEmpresas/useEmpresa/useFunis/useFunil/useNegocio` (SWR + `chamarCrm`); fichas 267–806 linhas; `AbasDeEstado` nas três listas; recuo D-15 nas três fichas; 177/177 testes; **nenhuma tela aberta em navegador** (WINDOWS.md #1–#4) |
| CRM-W2 | Quadro de Negócios (kanban em `/crm/negocios`) com mover/ganhar/perder/reabrir por REST | ✓ VERIFICADO (código e testes) / 🧑 navegador pendente | `quadro-do-funil.tsx` (382 l.): `usePodeNoCrm("mover"/"ganhar"/"perder"/"reabrir")` (l.145-150), `lista.mutate(otimista, { revalidate: false })` (l.188) com reversão; `negocios/page.tsx` importa `QuadroDoFunil` e `DialogoNovoNegocio`; `quadro-do-funil.test.tsx` e `dialogo-de-encerramento.test.tsx` passaram |
| CRM-V1 | `npm run check` verde; testes de domínio, rota e repositório contra Postgres local; 007 aplicada na plataforma após a conferência de D-12 | ? INCERTO (decisão do dono) + 🧑 | 007: conferência `pendente  007-crm.sql` → `aplicada  007-crm.sql (984 ms)` → `0 pendente(s)` registradas em `07-PROVAS.md` (l.53, 86, 122); testes existem (36 arquivos, 0 `skip/only/todo`); **`npm run check` não está verde**: 5 falhas pré-existentes do Financeiro fora do diff da fase (regressão 2026-10-11 em 8bc5590) — decisão pendente do dono |

### Verdades observáveis (81 must_haves dos 13 planos)

Legenda: ✓ VERIFICADO · ⚠️ PBU = PRESENTE, comportamento não exercitado (código presente e ligado; a prova é um teste de banco que pulou aqui) · ? INCERTO → humano · 🧑 HUMANO (diferido ao fim da fase por desenho).

#### 07-01 — Traçador (7)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-01: `crm/comum` e `crm/contatos` existem, `EstadoCrm` verbatim da 007; `package.json`, `types/crm.ts`, `operations/*`, `index.ts` sem diff | ✓ | Arquivos com 129 e 219 linhas; `na_lixeira` em `comum.ts`; nenhum dos cinco arquivos do modelo inglês está nos 115 arquivos do diff `00db206..HEAD` |
| 2 | D-03: Membro cria por `POST /contatos`, encontra em `GET /contatos`; `rotasDeCrm` em `app.ts`; linha em `plataforma.contatos` | ⚠️ PBU | Rotas em `rotas/crm/contatos.ts:108,112`; `app.register(rotasDeCrm…)` verificado por `verify.key-links`; a linha no banco é provada por `contatos.test.ts "(f) o ciclo inteiro por app.inject"` — pulou |
| 3 | D-11: sem Proprietário, Proprietário e `criado_por` = Membro da sessão | ⚠️ PBU | `resolverProprietario` em `acesso.ts`, ligado ao serviço; prova em `servicos/crm/contatos.test.ts (a)/(c)` — pulou |
| 4 | D-10: Contato do Espaço A invisível ao B; `workspaceId`/`criadoPor` no corpo = 400 (`.strict()`) | ⚠️ PBU | `.strict()` ×6 em `rotas/crm/contatos.ts` (400 provado pelas rotas); isolamento provado por `"(f) GET /contatos/:id de outro Espaço é 404"` e `e2e (f)` — pularam |
| 5 | D-04: `/crm/contatos` lista por SWR+`chamarCrm`, Novo Contato grava e revalida; Duplicidade e Importar saem | ✓ | `contatos/page.tsx` (252 l.) importa `useContatos`, `usePodeNoCrm`, `DialogoNovoContato`; não importa `import-contacts-dialog`; `cliente-crm.ts` com `Authorization: Bearer`; testes web 177/177 |
| 6 | D-12: testes de banco do CRM só contra `localhost`/`127.0.0.1` | ✓ | `testes/banco-crm.ts` (`temBancoCrm`); **observado**: contra o `.env` remoto, 89 casos pularam e nenhum tentou aplicar a 007 |
| 7 | Registro visível de que a sonda sem SPEC foi pulada | ✓ | REQUIREMENTS.md l.112: "Os sete IDs abaixo são derivados…" |

#### 07-02 — Endurecimento (6)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-14: `podeNoCrm` implementa a matriz inteira; Convidado recebe 403 em `POST /contatos` e nada é gravado | ✓ | `permissoes.ts:20-77` (matriz lida: ler para ativo/suspenso; escrita só ativo; convidado só lê; funil só administração; reabrir ganho só administração); `permissoes.test.ts` nos 616; rota "(i) Convidado recebe 403 em POST /contatos com o acesso falso, sem chegar ao banco" passou |
| 2 | D-10: Papel lido de `plataforma.registros` (`members` → `roles`) no serviço | ⚠️ PBU | `repositorios/crm/membros.ts` com `r.colecao = 'roles'` (padrão verificado); `exigir()` antes de ler/criar (rotas provam a ordem); a leitura real do Papel no banco pulou |
| 3 | D-11: `POST /contatos` aceita `proprietarioId` de Membro ativo, senão 409 `PROPRIETARIO_INVALIDO` | ✓ | Rota "(h) proprietarioId inexistente ou de outro Espaço responde 409 PROPRIETARIO_INVALIDO (T-07-40)" passou |
| 4 | D-08/D-09: `comTransacao` traduz 23505/23503/23514 (inclusive trigger deferido no commit) em 409 pt-BR sem nome de constraint; resto vira 500 | ⚠️ PBU | `traduzirErroDePg` 6/6 aqui ("nunca expõe o nome do constraint", "SQLSTATE sem frase conhecida não é traduzido"); `comTransacao (a)-(d)` incl. "(c) Empresa sem Contato admin falha no commit (trigger deferido)" pulou |
| 5 | CORS libera PATCH/PUT/DELETE só para a allowlist; `/v1/integrations/*` sem CORS | ✓ | `app.ts:160-168` `methods: ["GET","POST","PATCH","PUT","DELETE"]` (configuração estática, não transição) |
| 6 | Cliente HTTP provado: Bearer sempre, content-type só com corpo, 409 → `ErroDeApi`, sem sessão não chama fetch | ✓ | `dados/crm/cliente-crm.test.ts` nos 177/177 |

#### 07-03 — API de Contatos completa (8)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-01: normalização e regras de Contato puras e testadas | ✓ | `normalizacao.ts` (145 l., `PROVEDORES_PUBLICOS_DE_EMAIL`), `normalizacao.test.ts` e `contatos.test.ts` nos 616 |
| 2 | D-03: CRUD REST completo com `.strict()` | ✓ | 11 rotas enumeradas: `GET/POST /contatos`, `GET/PATCH/DELETE /contatos/:id`, `POST/PATCH/DELETE …/identificadores[/:id]`, `POST …/arquivar`, `POST …/restaurar`, `DELETE …/permanente` |
| 3 | D-06: DELETE → `na_lixeira`; restaurar → `ativo`; arquivar separado; permanente só da lixeira | ⚠️ PBU | Serviço com `arquivar/restaurar/enviarParaLixeira/excluirPermanentemente`; prova `servicos/crm/contatos.test.ts (f)/(g)` pulou |
| 4 | D-09: lixeira de único admin / Contato de Negócio = 409 `CONTATO_BLOQUEADO` com `bloqueios`; nada muda | ⚠️ PBU | `empresasEmQueEhUnicoAdmin` chamado em `contatos.ts:404` e `:437` (dentro de `comTransacao`); provas `(e) D-09` ×2 e `e2e (e1)` pularam |
| 5 | RN-CON-11: 409 `IDENTIFICADOR_EM_USO` nomeando o detentor | ⚠️ PBU | Código presente; prova `(b)` pulou |
| 6 | D-11: `PATCH` com `proprietarioId` ativo; primeiro de cada tipo principal; trocar principal rebaixa o anterior | ⚠️ PBU | `primeiroDoTipo` no domínio (616); prova `(c)/(d)` pulou |
| 7 | Datas civis voltam `AAAA-MM-DD` | ✓ | `repositorios/crm/contatos.ts:91` `data_nascimento::text` (representação, não transição) |
| 8 | D-10: `GET /contatos/:id` de outro Espaço é 404, nunca 403 | ⚠️ PBU | Teste nomeado existe ("(f) GET /contatos/:id de outro Espaço é 404, nunca 403 nem o registro (D-10)") — pulou |

#### 07-04 — API de Funis e Etapas (7)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-01: regras de Funil/Etapa puras | ✓ | `funis.ts` (284 l.), `funis.test.ts` (35 casos) nos 616 |
| 2 | D-13: primeiro Funil não privado nasce padrão; `POST /funis/:id/padrao` transacional | ⚠️ PBU | `deveNascerPadrao` (regra pura, testada) ligado em `servicos/crm/funis.ts:247`; `pg_advisory_xact_lock` em `repositorios/crm/funis.ts:270`; provas `(a)` e `(c)` pularam |
| 3 | D-14: escrita em Funil só administração (403 para membro/convidado); ler é de todos | ✓ | Matriz do domínio (`recurso === "funil" && !ehAdministracao`); rota "(e) um Membro recebe 403 em POST /funis e ainda lê a lista (D-14)" passou |
| 4 | D-07: DELETE com Negócios = 409 `FUNIL_COM_NEGOCIOS`/`ETAPA_COM_NEGOCIOS` com `bloqueios.negocios.total`; migrar/remapear resolvem | ⚠️ PBU | Rotas `POST /funis/:id/migrar-negocios` e `POST /etapas/:id/remapear` presentes; provas `(e)/(f)/(g)` e `e2e (e2)/(e3)` pularam |
| 5 | D-06: ciclo de vida do Funil; `FUNIL_PADRAO`; `FUNIL_NOME_EM_USO` | ⚠️ PBU | Códigos presentes no serviço; prova `(f)/(h)` pulou |
| 6 | RN-FUN-04: ≥1 Etapa; `ULTIMA_ETAPA`; reordenar é UM UPDATE | ⚠️ PBU | `validarNovoFunil`/`validarRemocaoDeEtapa` puros (616); "UM `UPDATE ... CASE`" em `repositorios/crm/funis.ts:74`; o 409 de serviço e o UPDATE real pularam |
| 7 | D-10: `privado` só gravado; Funil de outro Espaço é 404 | ⚠️ PBU | Prova `(j)` pulou |

#### 07-05 — 007 corrigida e API de Empresas (7)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-12: correção do trigger direto na 007 (nenhuma 008), commitada | ⚠️ PBU | `007-crm.sql:263-267` (`crm_confere_admin` … `estado <> 'na_lixeira'`), `:295-296` (`create constraint trigger empresas_exige_admin_estado`); só existe a 007 em `migracoes/` para o CRM; prova SQL `admin-da-empresa.test.ts (a)-(f)` pulou |
| 2 | D-08: `POST /empresas` exige admin no corpo e grava tudo numa transação | ⚠️ PBU | `servicos/crm/empresas.ts:407-434` (`"novoContato" in entrada.admin`, `prepararNovoContato`, dentro de `comTransacao`); prova `(a)/(b)` pulou |
| 3 | D-08: DELETE encerra vínculos; restaurar exige admin (`EMPRESA_SEM_ADMIN`); `ULTIMO_ADMIN`; `trocar-admin` | ⚠️ PBU | `encerrarVigentesDaEmpresa` em `empresas.ts:782`; rota `POST /empresas/:id/trocar-admin`; `trocar-admin` em 4 testes de rota + 3 de serviço + 8 do web; provas `(e)/(g)` pularam |
| 4 | RN-EMP-09/10: `EMPRESA_BLOQUEADA`, `EMPRESA_COM_NEGOCIOS`, `EMPRESA_COM_FILIAIS` | ⚠️ PBU | Prova `(f)/(h)` pulou |
| 5 | D-01: regras de Empresa no domínio; provedor público recusado | ✓ | `empresas.ts` (233 l., `validarRetiradaDeAdmin`), `empresas.test.ts` e `PROVEDORES_PUBLICOS_DE_EMAIL` nos 616 |
| 6 | D-14/D-10: membro cria/edita/exclui; convidado só lê; outro Espaço 404 | ⚠️ PBU | Matriz pura verificada; "Convidado só lê; Empresa de outro Espaço é 404…" é bloco de banco — pulou |
| 7 | D-06: estados da Empresa e exclusão permanente | ⚠️ PBU | Rotas `arquivar/restaurar/DELETE/permanente` presentes; prova pulou |

#### 07-06 — Telas de Contato e peças compartilhadas (7)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-04: `/crm/contatos` e ficha leem/gravam só por HTTP; web não importa a api | ✓ | Páginas usam `useContatos`/`useContato` de `dados/crm/contatos.ts` (125 l.) → `chamarCrm`; 0 imports de `@n1/api`/`apps/api` em `apps/web/src` |
| 2 | D-06: abas Ativos/Arquivados/Lixeira; Excluir → lixeira com confirmação; Restaurar/Excluir permanentemente; Arquivar separado | ✓ | `AbasDeEstado` ×2 em `contatos/page.tsx`; `AcoesDeCicloDeVida`; `ficha-de-contato.test.tsx` e `dados/crm/contatos.test.ts` nos 177 |
| 3 | D-09: recusa com frase do 409 e links para Empresa/Negócio; Contato continua ativo | ✓ | `ciclo-de-vida.tsx:191-220` `href={`/crm/empresas/${id}`}` / `/crm/negocios/${id}`; teste da ficha |
| 4 | D-11: Proprietário pré-selecionado e trocável | ✓ | `seletor-de-proprietario.tsx`; `useMembrosAtivos`; `formulario-de-contato.test.tsx` |
| 5 | D-02: ficha sem Tags, Consentimentos, Comentários, Anexos, Conversas, mesclagem, temperatura | ✓ | grep de `tag|comentário|anexo|consentimento|mescla|temperatura` em `ficha-de-contato.tsx` — 0 ocorrências de código |
| 6 | D-15: 404 da api + id em `state.contacts` abre `FichaDeContatoLegado` | ✓ | `contatos/[contato]/page.tsx:9-28` (404 antes de `data`; recuo só se o id existe no modelo antigo) |
| 7 | D-14 na tela: botões somem/desabilitam pela mesma `podeNoCrm` | ✓ | `dados/crm/sessao.ts:14,33` importa e chama `podeNoCrm` de `@n1/dominio/crm/permissoes`; 11 consumidores de `usePodeNoCrm` |

#### 07-07 — Telas de Funis e diálogos de D-07 (6)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-04: `/crm/funis` e `/crm/funis/[funil]` só por HTTP | ✓ | Páginas usam `useFunis`/`useFunil` (`dados/crm/funis.ts`, 153 l.) |
| 2 | D-07: `remove-stage-dialog` e `migrate-funnel-dialog` chamam `POST /etapas/:id/remapear` e `POST /funis/:id/migrar-negocios`; 409 com contagem e botão | ✓ | Artefatos contêm `remapearEtapa` / `migrarNegociosDoFunil`; key-links `openMigrate|useMigrateFunnelDialog` e `openRemoveStage|useRemoveStageDialog` encontrados; `dialogos-de-funil.test.tsx` passou |
| 3 | D-13: lista marca o padrão; ficha oferece "Definir como padrão"; formulário avisa | ✓ | `funis/page.tsx:179` `<Pilula tom="info">Funil padrão</Pilula>`; `formulario-de-funil.tsx:277` "O primeiro Funil do Espaço de Trabalho vira o Funil padrão." |
| 4 | D-14: só administração habilita; Membro e Convidado só leitura | ✓ | `usePodeNoCrm(…, "funil")` na ficha; `ficha-de-funil.test.tsx` |
| 5 | D-06: abas; lixeira, restaurar (`FUNIL_NOME_EM_USO` mostrado) e exclusão permanente | ✓ | `AbasDeEstado` ×2 em `funis/page.tsx`; `agir(acao, sucesso, tratar)` trata `FUNIL_NOME_EM_USO` no campo; testes |
| 6 | D-02: sem Requisitos de Etapa nem Transições permitidas | ✓ | grep de `requisito|transições permitidas` em `ficha-de-funil.tsx` — 0 |

#### 07-08 — API de Negócios (7)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-05: `POST /negocios/:id/{mover,ganhar,perder,reabrir}` aplicando as Regras do Funil (`NEGOCIO_EXIGE_VALOR`/`NEGOCIO_EXIGE_MOTIVO`) | ✓ | 4 rotas presentes; `validarGanho`/`validarPerda` (regras puras, testadas) ligadas em `servicos/crm/negocios.ts:459`; rota "(c) o 403 do serviço em reabrir passa intacto" |
| 2 | D-14: reabrir `ganho` só administração; `perdido` é de membro; convidado só lê | ✓ | Matriz do domínio (`contexto?.situacao === "ganho"`); rota "(e) um Convidado lê e recebe 403 em POST /negocios (D-14)" passou |
| 3 | RN-NEG-03/RN-FUN-06: sem Funil usa o padrão e a Etapa inicial; `SEM_FUNIL_PADRAO` | ⚠️ PBU | `funis.funilPadrao(ws)` em `negocios.ts:347`; provas `(a)` ×2 pularam |
| 4 | Encerramento coerente: `encerrado_em`, probabilidade zerada, reabrir limpa motivos | ⚠️ PBU | Prova `(e)/(f)` e `e2e (d4)` (asserções de valor em `situacao`, `valor`, `encerradoEm`) pularam |
| 5 | D-06: arquivado somente leitura (`NEGOCIO_INATIVO`); RN-NEG-18; permanente só da lixeira | ⚠️ PBU | Prova `(g)` pulou |
| 6 | D-01: regras de Negócio no domínio; `valor` como texto decimal; datas `AAAA-MM-DD` | ✓ | `negocios.ts` (379 l.) nos 616; `repositorios/crm/negocios.ts:91-92` `valor::text`, `data_prevista_fechamento::text` |
| 7 | D-10/D-11: outro Espaço 404; Proprietário padrão trocável; Empresa OU Contato | ⚠️ PBU | Prova `(b)` e "editar … troca o dono" pularam |

#### 07-09 — Telas de Empresa (7)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-08: formulário exige o admin no mesmo envio; sem admin, Criar desabilitado com motivo | ✓ | `formulario-de-empresa.tsx:39,102` (`MOTIVO_SEM_ADMIN`, `motivoParaNaoCriar`); key-link `criarEmpresa(` encontrado; `formulario-de-empresa.test.tsx` |
| 2 | D-08 na ficha: `ULTIMO_ADMIN` → Trocar admin; Excluir avisa; restaurar pede admin | ✓ | `vinculos-da-empresa.tsx` (393 l., `trocarAdminDaEmpresa`, key-link `ULTIMO_ADMIN`); `ficha-de-empresa.test.tsx` (trocar-admin ×4) |
| 3 | D-04: `/crm/empresas` (com `?empresa=`) e ficha só por HTTP | ✓ | Página usa `useEmpresas`/`useEmpresa`; `paginas-de-empresa.test.tsx` |
| 4 | D-06: abas; lixeira/restaurar/permanente com recusas de RN-EMP-09/10 listadas com links | ✓ | `AbasDeEstado` ×2; `ciclo-de-vida.tsx` lista Filiais (l.199) e Negócios (l.209) |
| 5 | D-15: `FichaDeEmpresaLegado` para id antigo | ✓ | `empresas/[empresa]/page.tsx:9-28` |
| 6 | D-02: sem Tags, Comentários, Anexos, mesclagem, Sugestões de Vínculo | ✓ | grep em `ficha-de-empresa.tsx` — 0 |
| 7 | D-11/D-14: Proprietário pré-selecionado; escrita desabilitada para Convidado | ✓ | `SeletorDeProprietario` reusado; `usePodeNoCrm` |

#### 07-10 — Quadro de Negócios e Novo Negócio (5)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-05: coluna por Etapa (`GET /funis/:id`), cartões de `GET /negocios?funilId=&estado=ativo`, soltar → `POST …/mover`; recusa devolve o cartão | ✓ | `quadro-do-funil.tsx:136-188` (`arrastando`, `lista.mutate(otimista, { revalidate: false })` com reversão); key-link `moverNegocio(`; `quadro-do-funil.test.tsx` "(caso e — 3 testes)" de recusa passou |
| 2 | D-05: Ganhar/Perder abrem o diálogo que aplica as Regras antes de enviar; faixa de encerrados oferece Reabrir | ✓ | `dialogo-de-encerramento.tsx` contém `validarGanho`/`validarPerda` (key-link); `dialogo-de-encerramento.test.tsx` passou |
| 3 | D-14 na tela: Reabrir ganho só administração; Convidado não arrasta nem encerra | ✓ | `quadro-do-funil.tsx:145-150` (`semMover`, `semGanhar`, `semPerder`, `semReabrirGanho`) |
| 4 | D-04: mesma rota/layout; `features/estrutura/quadro-negocios.tsx` e `/crm/meus-negocios` não tocados | ✓ | `git diff --name-only 00db206..HEAD` nesses caminhos — 0 arquivos |
| 5 | D-11: Novo Negócio por `POST /negocios` com Empresa OU Contato, Funil/Etapa padrão, valor texto, Proprietário da sessão | ✓ | `formulario-de-negocio.tsx` (423 l., `DialogoNovoNegocio`); `SeletorDeRegistro` reusado; `dados/crm/negocios.test.ts` |

#### 07-11 — Ficha de Negócio e Negócios nas fichas (6)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-04: `/crm/negocios/[negocio]` lê `GET /negocios/:id`, edita, move, encerra, ciclo de vida | ✓ | `negocios/[negocio]/page.tsx` usa `useNegocio`; `ficha-de-negocio.tsx` (806 l.); `ficha-de-negocio.test.tsx` passou |
| 2 | D-05/D-14: Regras do Funil na ficha; Reabrir ganho só administração; arquivado só leitura | ✓ | `ficha-de-negocio.tsx:19` (RN-NEG-16), `:634` `desligado(semReabrir)`, `:673` `usePodeNoCrm("reabrir", "negocio", { situacao })`; key-link `DialogoDeEncerramento` |
| 3 | D-15: id antigo abre `DealScreen` | ✓ | `negocios/[negocio]/page.tsx:9-20` |
| 4 | D-02: sem vínculos N:N, Tags, Comentários, Anexos, histórico, Requisitos, temperatura | ✓ | grep em `ficha-de-negocio.tsx` — 0; "contatos vinculados" — 0 |
| 5 | Fichas de Contato e Empresa com seção "Negócios" (`GET /negocios?contatoId=`/`?empresaId=`) e Novo Negócio preenchido | ✓ | `negocios-do-registro.tsx` (164 l.); key-link `NegociosDoRegistro` em `ficha-de-contato.tsx`; `negocios-do-registro.test.tsx` |
| 6 | `CreateRecordDialog` sai; `useCreateRecordDialog`/`CREATE_PARAM` ficam | ✓ | `create-record-dialog.tsx` exporta só `CREATE_PARAM` (l.20) e `useCreateRecordDialog` (l.24); 0 usos do componente fora de comentários |

#### 07-12 — `--seco`, e2e, documentação e portão (5)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-12: `migrar --seco` lista `aplicada`/`pendente` sem escrever | ✓ | `migracoesPendentes()` em `migrar.ts` só faz `to_regclass` e `select nome` (nenhum `insert/create/update`); `--seco` em `migrar.cli.ts` (key-link); as três saídas reais em `07-PROVAS.md` |
| 2 | CRM-V1: e2e por `app.inject` percorre o CRM inteiro | ⚠️ PBU | `e2e/crm-fluxo.test.ts` (278 l.) com 8 casos nomeados exatamente com o fluxo (d1 Funil padrão/D-14 → d2 Contato+Empresa com admin → d3 Negócio sem Funil+mover → d4 ganhar 409/200 + reabrir 403/200 → e1 D-09 → e2 FUNIL_PADRAO/FUNIL_COM_NEGOCIOS → e3 migração → f isolamento); asserções de valor; **pulou aqui**. ⚠️ O `contains: "trocar-admin"` declarado no PLAN não está no arquivo (ver Artefatos) |
| 3 | CRM-V1: `npm run check` e `npm run build` verdes; testes de banco sem pulados contra o container | ? INCERTO | `check` **não** verde: 5 falhas pré-existentes em `lote-contas-a-pagar.test.ts` e `formularios-publicos.test.ts` (fora do diff da fase; `deferred-items.md`; WINDOWS #5); `build` e "159/159 contra o container" são registros de 07-12 não reproduzíveis aqui → decisão do dono (human_verification #1 e #2) |
| 4 | D-15 registrado em `apps/web/CONTEXT.md` | ✓ | `apps/web/CONTEXT.md:102-103` "Limitação aceita (D-15). Busca global (`/buscar`), Lixeira (`/configuracoes/lixeira`), Notificações, `/crm/meus-negocios` e Caixa de…" |
| 5 | D-03/D-01 documentados nos `CONTEXT.md` de cada camada | ✓ | `CONTEXT.md`, `apps/api/CONTEXT.md`, `apps/api/src/{rotas,servicos,repositorios}/CONTEXT.md`, `packages/dominio/CONTEXT.md`, `apps/web/CONTEXT.md` no diff; `dados/crm` em `apps/web/CONTEXT.md:49,62` |

#### 07-13 — 007 na plataforma e UAT (3)

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | D-12: `--seco` mostrou `pendente  007-crm.sql` (001-006 `aplicada`); só então `migrar` imprimiu `aplicada  007-crm.sql`; saídas em PROVAS | ✓ (documental) | `07-PROVAS.md:53` `pendente  007-crm.sql`, `:86` `aplicada  007-crm.sql  (984 ms)`; saídas coladas pelo dono em 2026-10-11; o verificador não tem acesso ao banco da plataforma para confirmar `plataforma.migracoes` por conta própria |
| 2 | Conferência seca pós-aplicação sem `pendente` | ✓ (documental) | `07-PROVAS.md:122-129` `aplicada  007-crm.sql` / `0 pendente(s); nada foi aplicado (--seco).` (rodada pelo agente em `ebf5108`) |
| 3 | UAT no app real (8 passos, Administrador e Membro) | 🧑 HUMANO | Roteiro pronto em `07-PROVAS.md` com a coluna "Resultado" em branco; diferido ao fim da fase por desenho (`human_verify_mode = end-of-phase`); WINDOWS.md #1–#4 abertas |

**Pontuação:** 53/81 verdades verificadas (26 presentes com comportamento não exercitado; 1 incerta — decisão do dono; 1 humana — UAT).

### Deferred Items

Nenhum. A Fase 7 é a última do roadmap (`roadmap.analyze`: fases 1–7); não há fase posterior para absorver lacunas. As limitações de D-15 e as Deferred Ideas de `07-CONTEXT.md` (escopo `próprios`, Funil privado, Tags/Comentários/Anexos, catálogos, Registro de Atividade, aposentar o modelo inglês) são exclusões de escopo declaradas antes da execução, não lacunas desta fase.

### Advisory (New Scope, Unevidenced)

Não se aplica — verificação inicial, não re-verificação.

### Required Artifacts

`verify.artifacts` nos 13 planos: 48 de 49 artefatos passaram (existem, não são stubs, contêm o padrão declarado). Nível 3 (ligação) e nível 4 (dados) conferidos a seguir para os que renderizam ou servem dados.

| Artefato | Esperado | Status | Detalhes |
|---|---|---|---|
| `packages/dominio/src/crm/comum.ts` | `EstadoCrm`, `LIMITES_CRM`, … | ✓ VERIFICADO | 129 l.; importado por 07-01..07-11; `na_lixeira` presente |
| `packages/dominio/src/crm/contatos.ts` | `validarContato`, `nomeDeExibicaoDoContato` | ✓ VERIFICADO | 219 l.; `validarContato(` ligado em `servicos/crm/contatos.ts` |
| `packages/dominio/src/crm/permissoes.ts` | `podeNoCrm`, `ehAdministracao` | ✓ VERIFICADO | 77 l.; ligado em `servicos/crm/acesso.ts` e `apps/web/src/dados/crm/sessao.ts:14` |
| `packages/dominio/src/crm/normalizacao.ts` | normalizadores + `PROVEDORES_PUBLICOS_DE_EMAIL` | ✓ VERIFICADO | 145 l.; `normalizarIdentificadorDeContato(` em `servicos/crm/contatos.ts` |
| `packages/dominio/src/crm/funis.ts` | `deveNascerPadrao`, `validarReordenacao`, … | ✓ VERIFICADO | 284 l.; `deveNascerPadrao(` em `servicos/crm/funis.ts:247` |
| `packages/dominio/src/crm/empresas.ts` | `validarRetiradaDeAdmin`, … | ✓ VERIFICADO | 233 l.; ligado em `servicos/crm/empresas.ts` |
| `packages/dominio/src/crm/negocios.ts` | `validarGanho`, `validarPerda`, … | ✓ VERIFICADO | 379 l.; ligado em `servicos/crm/negocios.ts:459` e `dialogo-de-encerramento.tsx` |
| `apps/api/migracoes/007-crm.sql` | trigger corrigido | ✓ VERIFICADO | `crm_confere_admin` (l.263) e `empresas_exige_admin_estado` (l.295-296) |
| `apps/api/src/rotas/crm/{index,comum,contatos,funis,empresas,negocios}.ts` | 53 rotas REST | ✓ VERIFICADO | `rotasDeCrm` registrado em `app.ts`; `rotasDeFunis`/`rotasDeEmpresas`/`rotasDeNegocios` registradas em `index.ts` |
| `apps/api/src/servicos/crm/{resultado,acesso,transacao,contatos,funis,empresas,negocios}.ts` | serviços | ✓ VERIFICADO | 447–817 l.; `exigir`/`resolverProprietario`/`comTransacao` ligados (key-links) |
| `apps/api/src/repositorios/crm/{contatos,empresas,funis,negocios,vinculos,membros,sql}.ts` | repositórios pg | ✓ VERIFICADO | 54–514 l.; `workspace_id` em todo `WHERE`; `r.colecao = 'roles'` em `membros.ts` |
| `apps/api/src/testes/banco-crm.ts` | `temBancoCrm`, `describeComBanco` | ✓ VERIFICADO | Comportamento observado: pula contra host remoto |
| `apps/api/src/persistencia/migrar.ts` | `migracoesPendentes()` | ✓ VERIFICADO | Só leitura; `--seco` em `migrar.cli.ts` |
| `apps/api/src/e2e/crm-fluxo.test.ts` | fluxo inteiro por HTTP | ⚠️ PADRÃO NÃO ENCONTRADO (substantivo) | 278 l., 8 casos reais; **`contains: "trocar-admin"` do PLAN não aparece** (0 ocorrências). A verdade de 07-12 enumera o fluxo e não cita `trocar-admin`; a rota tem 4 testes em `rotas/crm/empresas.test.ts`, 3 em `servicos/crm/empresas.test.ts` e 8 no web. Não é stub — é um `contains` sobre-especificado no plano. AVISO, não lacuna |
| `apps/web/src/dados/crm/{cliente-crm,sessao,contatos,empresas,funis,negocios}.ts` | adaptadores HTTP | ✓ VERIFICADO | 34–173 l.; `chamarCrm` com Bearer; importados pelas 8 páginas e pelas fichas |
| `apps/web/src/features/crm/ciclo-de-vida.tsx` | `AbasDeEstado`, `MensagemDeRecusa` | ✓ VERIFICADO | 226 l.; usado nas 3 listas e nas 4 fichas; links por id |
| `apps/web/src/features/crm/ficha-de-{contato,funil,empresa,negocio}.tsx` | fichas | ✓ VERIFICADO | 267–806 l.; cada uma renderizada por sua página; dados de `use<Recurso>` |
| `apps/web/src/features/crm/legado/ficha-de-{contato,empresa}-legado.tsx` | fichas antigas intactas | ✓ VERIFICADO | Importadas só pelas páginas de recuo |
| `apps/web/src/features/crm/{remove-stage,migrate-funnel}-dialog.tsx` | D-07 sobre REST | ✓ VERIFICADO | `remapearEtapa` / `migrarNegociosDoFunil` presentes; hooks referenciados por `ficha-de-funil` e `etapas-do-funil` |
| `apps/web/src/features/crm/{seletor-de-registro,formulario-de-empresa,vinculos-da-empresa}.tsx` | D-08 na tela | ✓ VERIFICADO | `novoContato`, `trocarAdminDaEmpresa`, `SeletorDeRegistro` reusado por Negócios |
| `apps/web/src/features/crm/{quadro-do-funil,dialogo-de-encerramento,formulario-de-negocio,negocios-do-registro}.tsx` | quadro, encerramento, Novo Negócio, seção | ✓ VERIFICADO | `moverNegocio(`, `validarPerda(`, `DialogoNovoNegocio`, `NegociosDoRegistro` |
| `apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx` | recuo `DealScreen` | ✓ VERIFICADO | `DealScreen` importado (l.20) |
| `apps/web/CONTEXT.md` | fronteira `dados/crm` e D-15 | ✓ VERIFICADO | l.49, 62, 102-103 |
| `07-PROVAS.md` | saídas de `--seco`/`migrar` e roteiro UAT | ✓ VERIFICADO (documental) | 3 saídas + roteiro de 8 passos com "Resultado" em branco |

### Key Link Verification

`verify.key-links`: 20 de 26 ligações resolvidas pela ferramenta; as 6 restantes usavam `arquivo::símbolo` em `from:` (a ferramenta não resolve) e foram conferidas por grep.

| De | Para | Via | Status | Detalhes |
|---|---|---|---|---|
| `crm/contatos/page.tsx` | `GET/POST /contatos` | `chamarCrm` | ✓ WIRED | ferramenta |
| `apps/api/src/app.ts` | `rotas/crm/index.ts` | `app.register(rotasDeCrm…)` | ✓ WIRED | ferramenta |
| `servicos/crm/contatos.ts` | `dominio/crm/contatos.ts` | `validarContato(` | ✓ WIRED | ferramenta |
| `servicos/crm/acesso.ts` | `dominio/crm/permissoes.ts` | `podeNoCrm(` | ✓ WIRED | ferramenta |
| `servicos/crm/contatos.ts` | `servicos/crm/acesso.ts` | `resolverProprietario(` | ✓ WIRED | ferramenta |
| `rotas/crm/index.ts` | `servicos/crm/acesso.ts` | `criarAcessoAoCrmPg` | ✓ WIRED | ferramenta |
| `servicos/crm/contatos.ts` | `dominio/crm/normalizacao.ts` | `normalizarIdentificadorDeContato(` | ✓ WIRED | ferramenta |
| `servicos/crm/contatos.ts::enviarParaLixeira` | `repositorios/crm/vinculos.ts::empresasEmQueEhUnicoAdmin` | pré-checagem D-09 | ✓ WIRED | grep: import l.36, chamadas l.404 e l.437; export em `vinculos.ts:63` |
| `rotas/crm/index.ts` | `rotas/crm/funis.ts` | `rotasDeFunis` | ✓ WIRED | ferramenta |
| `servicos/crm/funis.ts::criar` | `dominio/crm/funis.ts::deveNascerPadrao` | D-13 na transação | ✓ WIRED | grep: import l.24, chamada l.247 com `repositorio.existePadrao` |
| `servicos/crm/empresas.ts::enviarParaLixeira` | `007-crm.sql::crm_confere_admin` | encerrar vínculos na mesma transação | ✓ WIRED | grep: `encerrarVigentesDaEmpresa` import l.59, chamada l.782; trigger em 007 l.263-296 |
| `servicos/crm/empresas.ts::criar` | `repositorios/crm/contatos.ts::inserir` | `novoContato` do admin | ✓ WIRED | grep: l.407, 427, 433-434 |
| `ficha-de-contato.tsx` | `DELETE /contatos/:id` | `enviarContatoParaLixeira` | ✓ WIRED | ferramenta |
| `crm/contatos/[contato]/page.tsx` | `ficha-de-contato-legado.tsx` | 404 + `state.contacts` | ✓ WIRED | ferramenta |
| `ficha-de-funil.tsx` | `migrate-funnel-dialog.tsx` | `?migrar-negocios=` | ✓ WIRED | ferramenta |
| `etapas-do-funil.tsx` | `remove-stage-dialog.tsx` | `?remapear-etapa=` | ✓ WIRED | ferramenta |
| `servicos/crm/negocios.ts::ganhar` | `dominio/crm/negocios.ts::validarGanho` | Regra do Funil | ✓ WIRED | grep: l.459 `validarGanho({ negocio, funil, entrada })` |
| `servicos/crm/negocios.ts::criar` | `repositorios/crm/funis.ts::funilPadrao` | RN-NEG-03 | ✓ WIRED | grep: l.347 `funis.funilPadrao(ws)` |
| `formulario-de-empresa.tsx` | `POST /empresas` | `criarEmpresa(` | ✓ WIRED | ferramenta |
| `vinculos-da-empresa.tsx` | `POST /empresas/:id/trocar-admin` | `ULTIMO_ADMIN` | ✓ WIRED | ferramenta |
| `quadro-do-funil.tsx` | `POST /negocios/:id/mover` | `moverNegocio(` | ✓ WIRED | ferramenta |
| `dialogo-de-encerramento.tsx` | `dominio/crm/negocios.ts` | `validarPerda(` | ✓ WIRED | ferramenta |
| `ficha-de-negocio.tsx` | `dialogo-de-encerramento.tsx` | `DialogoDeEncerramento` | ✓ WIRED | ferramenta |
| `ficha-de-contato.tsx` | `GET /negocios?contatoId=` | `NegociosDoRegistro` | ✓ WIRED | ferramenta |
| `migrar.cli.ts` | `migrar.ts::migracoesPendentes` | `--seco` | ✓ WIRED | ferramenta |
| `07-PROVAS.md` | `migrar.cli.ts --seco` | saída colada | ✓ WIRED | grep: `pendente  007-crm.sql` l.53; `aplicada  007-crm.sql` l.86, 122 |

### Data-Flow Trace (Level 4)

| Artefato | Variável | Fonte | Dados reais | Status |
|---|---|---|---|---|
| `crm/contatos/page.tsx` | `useContatos(...)` | `dados/crm/contatos.ts` → `chamarCrm("GET /contatos")` → `rotas/crm/contatos.ts` → `servicos` → `repositorios/crm/contatos.ts` (`select … from plataforma.contatos where workspace_id = $1`) | Sim | ✓ FLOWING |
| `crm/contatos/[contato]/page.tsx` | `useContato(id)` | idem, `GET /contatos/:id` | Sim | ✓ FLOWING |
| `crm/empresas/page.tsx` + `[empresa]` | `useEmpresas`/`useEmpresa` | `GET /empresas[/:id]` → `repositorios/crm/empresas.ts` | Sim | ✓ FLOWING |
| `crm/funis/page.tsx` + `[funil]` | `useFunis`/`useFunil` | `GET /funis[/:id]` → `repositorios/crm/funis.ts` | Sim | ✓ FLOWING |
| `crm/negocios/page.tsx` → `QuadroDoFunil` | `useFunis` + `useNegocios({ funilId, estado })` | `GET /funis/:id` + `GET /negocios?funilId=` → `repositorios/crm/negocios.ts` (`valor::text`) | Sim | ✓ FLOWING |
| `crm/negocios/[negocio]/page.tsx` | `useNegocio(id)` | `GET /negocios/:id` | Sim | ✓ FLOWING |
| `ficha-de-contato.tsx` / `ficha-de-empresa.tsx` → `NegociosDoRegistro` | `useNegocios({ contatoId / empresaId })` | `GET /negocios?contatoId=`/`?empresaId=` | Sim | ✓ FLOWING |
| `sessao.ts` → `usePodeNoCrm` | `useCurrentMember`/`useData` (store antigo) → `podeNoCrm` | Papel da sessão do store em memória (o backend é quem barra — D-14) | Sim (só esconde) | ✓ FLOWING |
| Páginas de recuo (D-15) | `state.contacts`/`state.companies`/`state.deals` | store em memória do modelo antigo | Sim, por desenho | ✓ FLOWING |

Nenhum valor renderizado termina em literal fixo, `[]` hardcoded ou mock fora de teste.

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|---|---|---|---|
| Regras puras do CRM (validarContato, normalização, podeNoCrm, Funil/Etapa, Empresa, Negócio) | `npx vitest run src/crm` (packages/dominio) | 6 arquivos, 616/616 | ✓ PASS |
| Adaptadores HTTP e telas com fetch falso (listas, fichas, formulários, quadro, diálogos, cliente HTTP) | `npx vitest run src/dados/crm src/features/crm` (apps/web) | 17 arquivos, 177/177 | ✓ PASS |
| Contrato HTTP com serviço/acesso falsos: 403 de Convidado, 409 PROPRIETARIO_INVALIDO, 404/409 passam intactos, envelope | `npx vitest run src/rotas/crm src/servicos/crm/transacao.test.ts` (apps/api) | 75 passaram, 24 pularam (blocos de banco) | ✓ PASS (contrato) |
| `traduzirErroDePg` nunca expõe o constraint; SQLSTATE desconhecido relançado | mesmo comando | 6/6 | ✓ PASS |
| Transições no Postgres (serviços, trigger da 007, e2e, `--seco`) | `npx vitest run src/servicos/crm src/repositorios/crm src/persistencia/migrar-seco.test.ts src/e2e/crm-fluxo.test.ts` | 65 pularam — sem Postgres local | ? SKIP → humano #2 |
| Fronteira de camadas | `grep -rn "@n1/api\|apps/api" apps/web/src` (imports) | 0 | ✓ PASS |
| Commits das SUMMARYs existem | `verify.commits` (26 hashes) | 26/26 | ✓ PASS |
| 53 rotas REST registradas | `perl` sobre `rotas.(get|post|patch|put|delete)(` | 11 + 15 + 15 + 12 | ✓ PASS |

### Probe Execution

Não se aplica: nenhum `scripts/*/tests/probe-*.sh` no repositório e nenhum PLAN/SUMMARY desta fase declara sondas. A conferência de D-12 (`migrar --seco`) é a "sonda" da fase e está registrada em `07-PROVAS.md`; o verificador não a repetiu porque exige o `.env` da plataforma e a instrução é não rodar `migrar`.

### Requirements Coverage

Todos os sete IDs declarados em REQUIREMENTS.md para a Fase 7 aparecem em pelo menos um plano; nenhum ID órfão (REQUIREMENTS.md l.169-175 mapeia exatamente CRM-D1..CRM-V1 → Phase 7).

| Requisito | Planos | Descrição | Status | Evidência |
|---|---|---|---|---|
| CRM-D1 | 07-01..05, 07-08 | Domínio `crm/*` em português, regras puras | ✓ SATISFEITO | 7 módulos, 616/616 testes aqui, modelo inglês sem diff |
| CRM-A1 | 07-01..05, 07-08, 07-12 | Repositórios + serviços + rotas com isolamento e Papel | ✓ SATISFEITO (contrato) / ⚠️ banco | 53 rotas; `workspace_id` em todo WHERE; 75 testes de rota; escrita real → humano #2 |
| CRM-A2 | 07-02..05 | 409 ricos (D-07, D-08/D-12, D-09, Identificador) | ⚠️ PRESENTE, banco não exercitado | Códigos e `bloqueios` presentes e ligados; trigger na 007; provas de banco pularam → humano #2 |
| CRM-A3 | 07-08 | Ações de Negócio | ✓ SATISFEITO (contrato e regra) / ⚠️ banco | 12 rotas; `validarGanho`/`validarPerda` ligadas; transições → humano #2 |
| CRM-W1 | 07-01, 06, 07, 09..13 | Telas lista/ficha/formulário/lixeira só por HTTP | ✓ SATISFEITO (código) / 🧑 navegador | 8 páginas, 4 fichas, 177/177; WINDOWS #1–#4 → humano #3–#8 |
| CRM-W2 | 07-10, 11, 13 | Kanban com mover/ganhar/perder/reabrir por REST | ✓ SATISFEITO (código) / 🧑 navegador | `QuadroDoFunil` com mutate otimista e reversão; testes; UAT passo 4 |
| CRM-V1 | 07-01, 02, 12, 13 | `npm run check` verde; testes dos três níveis; 007 aplicada após D-12 | ? DECISÃO DO DONO | 007 aplicada (PROVAS); 36 arquivos de teste, 0 skip; **`check` não verde** por 2 falhas pré-existentes do Financeiro → humano #1 |

### Decision Coverage

`check.decision-coverage-verify` sobre `07-CONTEXT.md`: **15/15** decisões (D-01..D-15) honradas nos artefatos da fase; 0 não honradas. Gate não bloqueante; nenhum impacto no status.

### Test Quality Audit

| Arquivo de teste | Requisito | Ativos | Pulados por `skip/only/todo` | Circular | Nível de asserção | Veredito |
|---|---|---|---|---|---|---|
| `packages/dominio/src/crm/*.test.ts` (6) | CRM-D1 | 616 | 0 | não | valor | ✓ |
| `apps/api/src/rotas/crm/*.test.ts` (4) | CRM-A1/A2/A3 | 75 sem banco + 24 com banco | 0 (24 pulam por `describeComBanco`, por desenho de D-12) | não | status + valor (`toMatchObject` de `codigo`, `campo`) | ✓ |
| `apps/api/src/servicos/crm/*.test.ts` (5) + `repositorios/crm/admin-da-empresa.test.ts` | CRM-A1/A2/A3 | 6 sem banco + 59 com banco | 0 | não | valor/comportamental | ✓ (não exercitados aqui) |
| `apps/api/src/e2e/crm-fluxo.test.ts` | CRM-V1 | 8 com banco | 0 | não | comportamental (situacao, valor, encerradoEm, etapaId, códigos) | ✓ (não exercitado aqui) |
| `apps/api/src/persistencia/migrar-seco.test.ts` | CRM-V1 | 3 com banco | 0 | não | valor | ✓ (não exercitado aqui) |
| `apps/web/src/dados/crm/*.test.ts` + `features/crm/*.test.tsx` (17) | CRM-W1/W2 | 177 | 0 | não | comportamental com fetch falso | ✓ |

**Testes desabilitados em requisitos:** 0. **Padrões circulares:** 0 (`writeFileSync` em diretórios de teste do CRM: 0). **Asserções insuficientes:** 0. Observação: os 89 casos de banco pulam por `describeComBanco` quando `DATABASE_URL` não é local — isso é a regra D-12 funcionando, não um `it.skip`; mas significa que esta verificação não os exercitou (ver `behavior_unverified_items`).

### Anti-Patterns Found

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---|---|---|---|---|
| — | — | `TBD`/`FIXME`/`XXX` nos 115 arquivos do diff | — | **0 ocorrências** (gate de marcadores de dívida limpo) |
| `remove-stage-dialog.tsx` | 6 | "TODO Negócio" | ℹ️ Info | Falso positivo: "todo" em português ("remapear TODO Negócio que a referencia"), não marcador |
| `ficha-de-negocio.tsx`, `formulario-de-negocio.tsx` | 246-259, 201-220 | `placeholder` | ℹ️ Info | Prop HTML de `TextInput`, não texto de stub |
| `apps/api/src/e2e/crm-fluxo.test.ts` | — | `contains: "trocar-admin"` do PLAN 07-12 ausente | ⚠️ Warning | O e2e não exercita `trocar-admin`; a rota está coberta em 4 testes de rota, 3 de serviço e 8 do web. Não bloqueia |
| Repositório inteiro | — | `npm run check` não verde | ⚠️ Warning (decisão do dono) | 5 falhas em `lote-contas-a-pagar.test.ts` e `formularios-publicos.test.ts`, pré-existentes, fora da fase (WINDOWS #5) |
| Código do CRM (07-REVIEW.md) | — | WR-01..WR-04 abertos | ⚠️ Warning (não bloqueante) | Revisão de código já registrada e disposta como `open` em `07-REVIEW-DISPOSITION.md`: data inexistente → 500 em `::date`; duas corridas entre agregados sem rede no banco; ordem de travamento em `definirPadrao`/`migrarNegocios`; `proprietarioId` enviado em toda edição. Não são lacunas de objetivo; são dívidas para a próxima rodada |
| Telas (07-UI-REVIEW.md, 16/24) | — | 3 correções prioritárias | ℹ️ Info | Vários `variant="primary"` por tela; feedback de criação perdido por `router.push` antes do Toast em `contatos/page.tsx:173-178`, `empresas/page.tsx:240-244`, sem Toast em `funis/page.tsx:141-144`; três cópias de `LinhaDeDado`. Auditoria só de código; a UAT confirma |

Sem stubs: nenhum `return null`/`[]` fixo alimentando render; nenhum handler só com `preventDefault`; nenhum `console.log` como implementação.

### Human Verification Required

Oito itens, na ordem em que o dono deve tratá-los (detalhe completo no frontmatter `human_verification`):

#### 1. Decisão sobre "`npm run check` verde" (CRM-V1)

**Teste:** Decidir entre aceitar a ressalva para a fase ou corrigir os dois testes do Financeiro (`apps/api/src/e2e/lote-contas-a-pagar.test.ts` 5/6 contra o banco remoto; suíte "Automação de Canal publicada na Lista de Solicitações" de `apps/api/src/rotas/formularios-publicos.test.ts`).
**Esperado:** (a) override no frontmatter deste arquivo + `gsd-tools windows waive 5 "<motivo>"`; ou (b) os dois testes corrigidos e `npm run check` verde.
**Por que humano:** a must-have é literal e observavelmente não vale no repositório inteiro, mas a causa é externa à fase (nenhum dos arquivos está no diff `00db206..HEAD`) e a decisão já está marcada como "Fica com o dono" em `07-PROVAS.md`.

**Isto parece intencional.** Para aceitar a ressalva, acrescente ao frontmatter de `07-VERIFICATION.md`:

```yaml
overrides:
  - must_have: "CRM-V1: npm run check (tipos, lint, tokens, contratos e testes dos três workspaces) e npm run build ficam verdes"
    reason: "As 5 falhas restantes são pré-existentes e exclusivas do Financeiro (lote-contas-a-pagar.test.ts contra o banco remoto, conhecida desde a Fase 4; seed de formularios-publicos.test.ts), fora dos 115 arquivos da Fase 7; os testes do CRM estão verdes nos três workspaces e registrados em deferred-items.md e WINDOWS.md #5"
    accepted_by: "<nome>"
    accepted_at: "<ISO timestamp>"
```

#### 2. Suíte de banco do CRM contra Postgres local

**Teste:** Subir o container Postgres local (convenção de `apps/api/src/testes/banco-crm.ts`: `DATABASE_URL` em `localhost`/`127.0.0.1`) e rodar `npm test -w @n1/api`.
**Esperado:** os 89 casos que pularam aqui passam (registro de 07-12: 159/159 do CRM, 0 pulados). Isso fecha os 26 itens de `behavior_unverified_items`.
**Por que humano:** o verificador não sobe containers e o `.env` aponta para a plataforma.

#### 3. UAT de fim de fase (8 passos de `07-PROVAS.md`)

**Teste:** `npm run dev` (web 3001 + api 3002 contra o banco da plataforma), Administrador e Membro reais: Funil padrão → Contato → Empresa com admin → Negócio no quadro (arrastar, ganhar sem/com valor, reabrir) → Excluir Ana (recusa com links) → Excluir Vendas (recusa → migrar → Lixeira → Restaurar) → Membro só leitura → Busca global com registros antigos.
**Esperado:** cada passo grava e relê pela api; recusas com frase e links; ações desabilitadas com motivo para Membro; ficha antiga pelo passo 8. Preencher "Resultado" e fechar WINDOWS #1–#4.
**Por que humano:** JWT real + navegador + banco da plataforma; nenhuma tela foi aberta em navegador durante a execução.

#### 4–8. Aparência e uso real em navegador (entradas `human_judgment: true` das SUMMARYs)

Lista/formulário/ficha de Contato (07-01 D2, 07-06 D1); lista e ficha de Funil (07-07 D2/D3); diálogo Nova Empresa, ficha, popup e Trocar admin (07-09 D6); sensação do quadro e Novo Negócio (07-10 D7); ficha de Negócio e seção Negócios (07-11 D10); aceitação do portão e da documentação (07-12 D3/D4). Todas cobertas pelo roteiro do item 3; detalhe no frontmatter.

### Gaps Summary

**Nenhuma lacuna de objetivo.** O que a fase prometeu existe, é substantivo e está ligado nas três camadas: 7 módulos de domínio em português (modelo inglês sem diff), 53 rotas REST sobre repositórios que filtram `workspace_id` em todo `WHERE` e serviços que chamam `exigir()` antes de qualquer leitura ou escrita, 8 páginas e 4 fichas que leem e gravam só por `chamarCrm` (0 imports da api no web), o quadro com mover/ganhar/perder/reabrir por REST, a 007 corrigida e aplicada no banco da plataforma com a conferência de D-12 registrada, e 15/15 decisões honradas. Os testes que esta verificação pôde rodar passaram todos: 616 (domínio), 177 (web), 75 (contrato HTTP) e 6 (tradução de SQLSTATE).

O que **não** foi provado aqui, e por isso o status é `human_needed` e não `passed`:

1. **As transições no Postgres** (26 verdades): lixeira/restaurar/permanente, D-07, D-08 com o trigger deferido, D-09, D-13 com advisory lock, encerramento de Negócio, isolamento por Espaço no SQL. Os testes existem (89 casos nomeados, asserções de valor, 0 `skip`), mas pulam sem Postgres local — por desenho de D-12. Um comando do dono com o container fecha tudo (item 2).
2. **`npm run check` não está verde** por duas falhas pré-existentes do Financeiro, fora da fase. É a única must-have literalmente insatisfeita; a decisão (aceitar com override ou corrigir) é do dono (item 1).
3. **Nenhuma tela foi aberta em navegador real** (WINDOWS #1–#4) e a UAT de 8 passos está com "Resultado" em branco, como o `human_verify_mode = end-of-phase` previa (item 3).

Avisos que não bloqueiam: o e2e não exercita `trocar-admin` (apesar do `contains` do PLAN), coberto em 15 outros testes; 4 warnings da revisão de código (`07-REVIEW.md`) e 3 correções prioritárias da auditoria de UI (`07-UI-REVIEW.md`) seguem `open` para a próxima rodada.

---

_Verificado: 2026-10-11T17:38:36Z_
_Verificador: Claude (gsd-verifier)_
