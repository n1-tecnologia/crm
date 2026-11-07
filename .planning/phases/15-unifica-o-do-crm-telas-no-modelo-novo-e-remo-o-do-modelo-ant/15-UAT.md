---
status: testing
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
source: [15-VERIFICATION.md]
started: 2026-11-07T12:35:00Z
updated: 2026-11-07T12:35:00Z
---

## Current Test

number: 1
name: Abrir cada família de telas da Fase 15 num navegador autenticado
expected: |
  Cada tela carrega pelas rotas REST sem erro, mostra "não encontrado" para ids desconhecidos, e os gestos
  (estrela, atribuir, resolver, mover, lixeira, nota, consentimento, responder) persistem depois de recarregar.
awaiting: user response

## Tests

### 1. Telas num navegador autenticado
Famílias: Caixa de Entrada (lista, fio, configurações), fichas de Contato/Empresa/Negócio, `/crm/negocios?meus=1` e Reunião, Busca, `/configuracoes/lixeira`, Notificações, Início, Configurações, Painéis, Ferramentas (Grupo, Flow), IA, Contas a receber. Em produção, ou num Postgres local migrado até a 012 com `npm run bootstrap:crm-demo`. Inclua as provas manuais da Fase 14 (14-11, 14-12, 14-15, 14-16) e a lista "Provas manuais pendentes" de `15-PROVAS.md`.
expected: Cada tela carrega pelas rotas REST sem erro; id desconhecido mostra "não encontrado"; os gestos persistem depois de recarregar.
result: [pending]

### 2. Decisões de produto pendentes (`15-PROVAS.md`, "Decisões do dono ainda pendentes", 17 linhas)
Em especial: #73 (Enviar Flow fica sem destinatários depois do corte), #26 (gestos de Negócio, Contato e Empresa não gravam Atividade), #61 (a Automação `aut_clo_proposta` do seed aponta para uma Lista que o seed não cria mais).
expected: Cada uma aceita até uma Sessão nomeada, ou vira um plano.
result: [pending]

### 3. Caminho de volta
Confirmar o comando de restauração em produção para `~/n1-corte/backup-plataforma-pre-15-20261107-0816.dump` e guardar uma segunda cópia fora do computador.
expected: Comando de restauração escrito e aprovado; backup guardado em dois lugares.
result: [pending]

### 4. Decisões tomadas em seu nome
Rever os três checkpoints respondidos pelo orquestrador (15-30 "usar a cópia de 2026-11-05", 15-32 "remover", 15-33 "seguir") e o fato de o corte ter sido executado pelo assistente, a seu pedido, e não por você.
expected: Você confirma ou pede para reverter (os commits estão em `15-PROVAS.md`).
result: [pending]

### 5. 404 de uma operação antiga, ao vivo
Com um token válido, uma chamada a `POST /operacoes/moveDealToStage` em produção.
expected: 404 `{ok:false, error:'Operação "moveDealToStage" não existe.'}`. (O teste de fumaça do corte só viu 401 sem token; o 404 está provado só em teste.)
result: [pending]

### 6. Conversas 1:1 de Flow, Automação e convite (aviso W-1 do verificador, WINDOWS.md)
Essas Conversas ficam em `plataforma.registros` e não aparecem em lugar nenhum da Caixa de Entrada: a resposta de um Contato a um Flow ou a um convite cai onde nenhum atendente a abre.
expected: Decidir entre listá-las pela `ConversaDeGrupoNaCaixa` ou aceitar a lacuna até a Sessão 7 (registrada).
result: [pending]

### 7. `DATABASE_SSL_INSECURE=true` na configuração local
Usada nas conexões deste computador a produção (backup, migração, script do corte): desliga a verificação do certificado TLS.
expected: Desligar, ou aceitar de forma consciente.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
