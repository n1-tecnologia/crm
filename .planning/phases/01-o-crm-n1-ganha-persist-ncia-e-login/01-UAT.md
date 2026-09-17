---
status: testing
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
source: [01-VERIFICATION.md]
started: 2026-09-17T14:18:20Z
updated: 2026-09-17T14:18:20Z
---

## Current Test

number: 1
name: Login → criar Conta a pagar pela tela → F5 → persistência
expected: |
  Com `npm run dev` rodando (web 3001 + api 3002), logar como `maryane@n1.teste` (senha de desenvolvimento) em http://localhost:3001/entrar, abrir Gestão › Financeiro › Contas a pagar, criar uma Conta a pagar pela tela e recarregar (F5). A Lista abre sem Tarefas fictícias; a Conta criada aparece e CONTINUA lá depois do F5 — está no Postgres, não no seed (Critério 1 do ROADMAP).
awaiting: user response

## Tests

### 1. Login → criar Conta a pagar pela tela → F5 → persistência
expected: Com `npm run dev` rodando (web 3001 + api 3002), logar como `maryane@n1.teste` em http://localhost:3001/entrar, abrir Gestão › Financeiro › Contas a pagar, criar uma Conta a pagar pela tela e recarregar (F5). A Lista abre sem Tarefas fictícias; a Conta criada aparece e CONTINUA lá depois do F5 — está no Postgres, não no seed.
result: [pending]

### 2. Recusa de changeTaskStatus sem spinner e sem requisição de rede
expected: Na mesma sessão, tentar mover a Conta recém-criada para "pago" (RN-CP-04 — a Maryane não é Aprovadora). A recusa aparece na hora, sem spinner e sem requisição na aba Rede do DevTools (D-05); a criação da Conta aparece na aba Rede como `POST /operacoes/createTask` com resposta 200.
result: [pending]

### 3. Usuário removido vê "Sem acesso"
expected: Sair e entrar como `tiago@n1.teste` (removido no seed, não existe no Espaço "Gestão" bootstrapado). A tela mostra "Sem acesso" — o Membro não existe no Espaço.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
