---
phase: "17"
slug: "e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-19"
---

# Phase 17 — Estratégia de validação

> Contrato de validação da fase, para amostrar o resultado durante a execução. Semeado a partir de `## Validation Architecture` do `17-RESEARCH.md`; as linhas por tarefa são preenchidas quando os planos existem.

---

## Infraestrutura de teste

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`apps/api`: `"test": "vitest run"`, `vitest ^5.0.0`; `packages/dominio` e `apps/web` também Vitest) |
| **Config file** | do workspace `apps/api` (existente); nenhum runner novo |
| **Quick run command** | `npm test -w @n1/api -- src/mensageria/provedores/email` (e `npm test -w @n1/dominio -- <arquivo>` quando tocar o domínio) |
| **Full suite command** | `npm run check` na raiz (tipos, lint, tokens e testes dos três workspaces); no CI os testes de banco são pulados, o gate local com Postgres 16 leva 13 a 17 min |
| **Estimated runtime** | quick: ~30 s; full: 13 a 17 min (gate local) |

---

## Sampling Rate

- **Depois de cada commit de tarefa:** o quick run do arquivo tocado
- **Depois de cada onda:** `npm run check`
- **Antes de `/gsd-verify-work`:** `npm run check` verde no gate local com Postgres (o `check` do CI não prova os testes de banco)
- **Latência máxima de feedback:** 60 s por tarefa

---

## Per-Task Verification Map

Uma linha por tarefa dos 16 planos. O comando completo de cada tarefa está no `<automated>` do plano (com o
`docker run postgres:16` na porta indicada, de 55731 a 55741, um por plano). "❌ W0" quer dizer que o arquivo de teste nasce
na própria tarefa (a pesquisa não achou nada de e-mail no código).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-1 | 17-01 | 1 | EML-04 | T-17-02 | fio só pela busca injetada | unit | `cd packages/dominio && npx vitest run` src/crm/fio-de-email.test.ts && npx tsc --noEmit | ❌ W0 | ⬜ pending |
| 17-01-2 | 17-01 | 1 | EML-03 | T-17-03 | robô, não entrega, lista e o próprio Canal ignorados | unit | `cd packages/dominio && npx vitest run` src/crm/fio-de-email.test.ts | ❌ W0 | ⬜ pending |
| 17-01-3 | 17-01 | 1 | EML-05 | T-17-01 | assunto e endereço sem controle; 10 arquivos, 20 MB | unit | `cd packages/dominio && npx vitest run` src/crm/mensagens.test.ts src/crm/recebimento.test.ts + `tsc` de api e web | ❌ W0 | ⬜ pending |
| 17-02-1 | 17-02 | 1 | — | T-17-SC | nada instalado sem o dono | checkpoint (blocking-human) | — (resposta do dono) | — | ⬜ pending |
| 17-02-2 | 17-02 | 1 | EML-01, EML-03 | T-17-04, T-17-05 | certificado gerado no teste, CA só por injeção | integração (dublê IMAP) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/testes/servidor-de-email-falso.test.ts | ❌ W0 | ⬜ pending |
| 17-02-3 | 17-02 | 1 | EML-05 | T-17-05 | SMTP falso com recusa e silêncio | integração (dublê SMTP) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/testes/servidor-de-email-falso.test.ts | ❌ W0 | ⬜ pending |
| 17-03-1 | 17-03 | 2 | EML-06 | T-17-07, T-17-08 | IP conferido + servername; certificado sempre conferido | integração (dublês) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/provedores/email/fabrica-de-conexao.test.ts | ❌ W0 | ⬜ pending |
| 17-03-2 | 17-03 | 2 | EML-06 | T-17-06, T-17-07 | rede interna, portas e rebinding recusados | unit | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/provedores/email/rede.test.ts | ❌ W0 | ⬜ pending |
| 17-03-3 | 17-03 | 2 | EML-01, EML-06 | T-17-09, T-17-10 | erro classificado, sem senha | integração (dublês) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/provedores/email/erros.test.ts | ❌ W0 | ⬜ pending |
| 17-04-1 | 17-04 | 1 | — | T-17-14 | 017 só depois da escolha do dono | checkpoint:decision (blocking-human) | — (resposta do dono) | — | ⬜ pending |
| 17-04-2 | 17-04 | 1 | EML-01, EML-03 | T-17-11, T-17-13 | sem coluna de segredo; esquecer apaga do cofre | integração (Postgres 16 em Docker na porta do plano + `npm run --silent migrar` + `npx vitest run`, porta 55731) | `migracao-017.test.ts`, `migrar-seco.test.ts`, `email/repositorio.test.ts` | ❌ W0 | ⬜ pending |
| 17-04-3 | 17-04 | 1 | EML-02 | T-17-11, T-17-12 | credencial versionada sem vazar; coleta poupa a fila | integração (55731) | `email/credencial.test.ts`, `coleta-de-orfaos.test.ts` | ❌ W0 | ⬜ pending |
| 17-05-1 | 17-05 | 3 | EML-01 | T-17-20 | conectar só no Canal do Espaço; gravar depois de verificar | integração (55732) | `email/conexao.test.ts` | ❌ W0 | ⬜ pending |
| 17-05-2 | 17-05 | 3 | EML-01, EML-06 | T-17-19, T-17-21 | senha errada e servidor interno não gravam; senha fora do log | integração (55732) | `email/conexao.test.ts`, `rotas/crm/email.test.ts`, `inventario-de-rotas.test.ts` | ❌ W0 | ⬜ pending |
| 17-05-3 | 17-05 | 3 | EML-07 | T-17-24 | desconectar e arquivar esquecem; queda com motivo | integração (55732) | `email/queda.test.ts`, `servicos/crm/canais-email.test.ts` | ❌ W0 | ⬜ pending |
| 17-06-1 | 17-06 | 2 | EML-04 | T-17-15 | fio só no mesmo Canal e Espaço | integração (55733) | `servicos/crm/recebimento.test.ts` | ❌ W0 | ⬜ pending |
| 17-06-2 | 17-06 | 2 | EML-04 | T-17-15, T-17-16 | colega no fio não troca o Contato; lixeira não reabre | integração (55733) | `servicos/crm/recebimento.test.ts` | ❌ W0 | ⬜ pending |
| 17-06-3 | 17-06 | 2 | EML-03 | T-17-17, T-17-18 | provedor que busca nunca aceita chamada externa | integração (55733) | `processador-de-entrada.test.ts`, `provedor.test.ts`, `midia.test.ts`, `e2e/mensageria-entrada.test.ts` | ❌ W0 | ⬜ pending |
| 17-07-1 | 17-07 | 3 | EML-05 | T-17-25, T-17-27 | assunto/cópias só no e-mail; 20 MB antes de gravar | integração (55734) | `servicos/crm/mensagens.test.ts`, `rotas/crm/mensagens.test.ts`, `e2e/canais-fluxo.test.ts` | ❌ W0 | ⬜ pending |
| 17-07-2 | 17-07 | 3 | EML-05 | T-17-28, T-17-29 | id gravado antes; Canal caído não perde a Mensagem | integração (55734) | `entregar-mensagem.test.ts`, `e2e/mensageria.test.ts`, `outbox-worker.test.ts` | ❌ W0 | ⬜ pending |
| 17-07-3 | 17-07 | 3 | EML-05 | T-17-27 | bucket com teto | unit | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/servicos/storage-uploads.test.ts src/mensageria/midia.test.ts src/mensageria/coleta-de-orfaos.test.ts | ❌ W0 | ⬜ pending |
| 17-08-1 | 17-08 | 3 | EML-03 | T-17-33 | fila sem MIME cru; INSERT e cursor juntos | integração (55735) | `email/entrada.test.ts` | ❌ W0 | ⬜ pending |
| 17-08-2 | 17-08 | 3 | EML-03, EML-04 | T-17-30, T-17-34 | tetos antes do parser; ignorado auditável | unit | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/provedores/email/traduzir.test.ts | ❌ W0 | ⬜ pending |
| 17-08-3 | 17-08 | 3 | EML-03 | T-17-31, T-17-32 | anexos pela guarda; HTML fora dos anexos | unit | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/provedores/email/traduzir.test.ts src/mensageria/midia.test.ts | ❌ W0 | ⬜ pending |
| 17-09-1 | 17-09 | 4 | EML-05 | T-17-36 | saída pelo outbox; provedor só com COFRE_CHAVE | e2e (55736) | `e2e/email-saida.test.ts`, `registro.test.ts` | ❌ W0 | ⬜ pending |
| 17-09-2 | 17-09 | 4 | EML-05, EML-07 | T-17-35, T-17-37, T-17-38, T-17-39, T-17-40 | sem Bcc no DATA; ambíguo nunca reenvia; guarda reaplicada | integração (dublês) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/provedores/email/envio.test.ts | ❌ W0 | ⬜ pending |
| 17-09-3 | 17-09 | 4 | EML-05 | T-17-38 | APPEND conforme a conta; contrato sem segredo | contrato + integração | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` envio.test.ts provedor.contrato.test.ts registro.test.ts provedor.test.ts | ❌ W0 | ⬜ pending |
| 17-10-1 | 17-10 | 5 | EML-03 | T-17-45 | trava na conexão dedicada | e2e (55737) | `e2e/email-entrada.test.ts` | ❌ W0 | ⬜ pending |
| 17-10-2 | 17-10 | 5 | EML-03, EML-04 | T-17-47, T-17-48 | sem repetir, sem histórico, guarda na reconexão | integração + e2e (55737) | `email/leitor.test.ts`, `e2e/email-entrada.test.ts` | ❌ W0 | ⬜ pending |
| 17-10-3 | 17-10 | 5 | EML-07 | T-17-46, T-17-49 | senha trocada para o laço; leitor só com o processador | integração (55737) | `email/leitor.test.ts`, `e2e/email-entrada.test.ts` | ❌ W0 | ⬜ pending |
| 17-11-1 | 17-11 | 4 | EML-03 | T-17-43, T-17-44 | HTML limpo só para quem lê; no-store | integração (55738) | `servicos/crm/mensagens-corpo-html.test.ts` | ❌ W0 | ⬜ pending |
| 17-11-2 | 17-11 | 4 | EML-03 | T-17-41, T-17-42 | vetores de XSS e rastreamento removidos | unit | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/provedores/email/html.test.ts | ❌ W0 | ⬜ pending |
| 17-12-1 | 17-12 | 4 | EML-02 | T-17-52, T-17-53 | PKCE; XOAUTH2 com o endereço do Canal antes de gravar | integração (55739) | `email/oauth.test.ts` | ❌ W0 | ⬜ pending |
| 17-12-2 | 17-12 | 4 | EML-02, EML-07 | T-17-54, T-17-56 | renovação com rotação; recusa permanente vira queda | integração (55739) | `email/token.test.ts`, `oauth/microsoft.test.ts`, `credencial.test.ts` | ❌ W0 | ⬜ pending |
| 17-12-3 | 17-12 | 4 | EML-02 | T-17-51, T-17-54, T-17-55 | state de outro Membro recusado; nenhum token no log | integração (55739) | `email/oauth.test.ts`, `estado.test.ts`, `rotas/crm/email.test.ts`, `inventario-de-rotas.test.ts` | ❌ W0 | ⬜ pending |
| 17-13-1 | 17-13 | 5 | EML-02 | T-17-57 | email_verified e XOAUTH2 obrigatórios | integração (55740) | `email/oauth.test.ts` | ❌ W0 | ⬜ pending |
| 17-13-2 | 17-13 | 5 | EML-02, EML-07 | T-17-60 | invalid_grant permanente; sem token no erro | unit (servidor falso) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/provedores/email/oauth/google.test.ts | ❌ W0 | ⬜ pending |
| 17-13-3 | 17-13 | 5 | EML-02 | T-17-58 | revogar antes, sem travar a desconexão | integração (55740) | `servicos/crm/canais-email.test.ts`, `canais.test.ts`, `canais-conectar.test.ts` | ❌ W0 | ⬜ pending |
| 17-14-1 | 17-14 | 6 | EML-01 | T-17-61 | senha só no formulário | componente | `cd apps/web && npx vitest run` src/features/crm/painel-do-email.test.tsx src/features/crm/conectar-provedor.test.tsx | ❌ W0 | ⬜ pending |
| 17-14-2 | 17-14 | 6 | EML-02 | T-17-62, T-17-64 | retorno sem redirecionamento aberto; predefinição do servidor | componente | `cd apps/web && npx vitest run` src/features/crm/retorno-do-email.test.tsx src/features/crm/painel-do-email.test.tsx | ❌ W0 | ⬜ pending |
| 17-14-3 | 17-14 | 6 | EML-07 | T-17-63 | motivo como texto | componente | `cd apps/web && npx vitest run` src/features/crm/ficha-do-canal.test.tsx | ❌ W0 | ⬜ pending |
| 17-15-1 | 17-15 | 5 | EML-05 | T-17-67 | endereços validados na tela | componente | `cd apps/web && npx vitest run` src/features/crm/campos-do-email.test.tsx src/features/crm/conversation-thread.test.tsx | ❌ W0 | ⬜ pending |
| 17-15-2 | 17-15 | 5 | EML-05 | T-17-68 | 10 arquivos e 20 MB antes de subir | componente | `cd apps/web && npx vitest run` src/features/crm/conversation-thread.test.tsx | ❌ W0 | ⬜ pending |
| 17-15-3 | 17-15 | 5 | EML-03 | T-17-65, T-17-66 | HTML só no iframe sandbox com CSP | componente | `cd apps/web && npx vitest run` src/features/crm/corpo-do-email.test.tsx src/dados/crm/mensagens.test.ts | ❌ W0 | ⬜ pending |
| 17-16-1 | 17-16 | 7 | EML-03 | T-17-71 | leitor desligado em produção | config | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` src/mensageria/configuracao-de-producao.test.ts | ❌ W0 | ⬜ pending |
| 17-16-2 | 17-16 | 7 | todos | T-17-69 | documentos sem segredo | docs (grep) | `grep -c` nos três `CONTEXT.md` e no `17-PROVA-REAL.md` | ❌ W0 | ⬜ pending |
| 17-16-3 | 17-16 | 7 | todos | T-17-70, T-17-72 | prova real do dono (9.4.4) | manual (checkpoint:human-action) | — (roteiro `17-PROVA-REAL.md`) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Spike do `imapkit` em módulo** (17-02, Task 2): opção programática de TLS, XOAUTH2 aceito pelo `imapflow`, inserir mensagem e recriar a caixa com outro `UIDVALIDITY`, regra de falha de `IDLE`. Se falhar, dublê de IMAP mínimo escrito à mão (`CAPABILITY`, `AUTHENTICATE`, `SELECT`, `FETCH`, `IDLE`, `APPEND`, `LOGOUT`).
- [ ] Certificado TLS de teste (SAN `localhost`, `imap.caixa.teste`, `smtp.caixa.teste`, `127.0.0.1`), GERADO na hora do teste por `gerarCertificadoDeTeste` (nenhuma chave commitada), injetado como `ca` só pela dependência de teste da fábrica de conexão (17-02, 17-03).
- [ ] `apps/api/src/testes/servidor-de-email-falso.ts`: sobe IMAP e SMTP e devolve `{imap, smtp, ca, adicionarMensagem, recriarCaixa, entregues, programarSmtp, conexoesImap, derrubarConexoes, fechar}` (17-02).
- [ ] Arquivos `*.test.ts` das linhas acima e `fio-de-email.test.ts` no domínio.
- [ ] Ajuste de `contrato-do-provedor.ts` (`semWebhook`) e de `processador-de-entrada.test.ts` (anexos já guardados) (17-06, Task 3).
- [ ] `imapkit` e `smtp-server` em `devDependencies` (depois do `checkpoint:human-verify` `blocking-human` de legitimidade de pacotes, 17-02 Task 1).

---

## Manual-Only Verifications

Só se provam com caixa e app reais, do dono (9.4.4):

| Comportamento | Requisito | Por que é manual | Instruções de teste |
|---------------|-----------|------------------|---------------------|
| Gmail com senha de app: INBOX, cópia em Enviados, limites de sessão | EML-01, EML-03, EML-05 | Depende do comportamento do Gmail | Conectar uma caixa de teste, mandar e receber e-mail com anexo, conferir que a resposta aparece no mesmo fio e uma só vez em Enviados |
| Microsoft 365 com login: XOAUTH2 do Exchange, `IDLE`, `sessionExpires`, cópia em Enviados, SMTP AUTH por caixa | EML-02, EML-03, EML-05 | Depende do tenant e do app registrado | Entrar com a Microsoft, receber, responder, deixar a sessão passar de 1 h |
| Hospedagem comum com senha | EML-01, EML-03, EML-05 | Servidor real | Mesmo roteiro do Gmail |
| Login do Google em modo de teste (conexão pode cair em 7 dias) | EML-02, EML-07 | Depende do app e da verificação do Google | Entrar com uma conta de teste cadastrada no app |
| A resposta aparece no mesmo fio no programa de e-mail do remetente; o anexo vai e volta | EML-04, EML-05 | Depende do cliente de e-mail | Abrir a resposta no Gmail e no Outlook e conferir fio e anexo |

---

## Validation Sign-Off

- [ ] Todas as tarefas têm `<automated>` ou dependência de Wave 0
- [ ] Continuidade de amostragem: nenhuma sequência de 3 tarefas sem verificação automática
- [ ] Wave 0 cobre todas as referências MISSING
- [ ] Sem flags de modo watch
- [ ] Latência de feedback < 60 s por tarefa
- [ ] `nyquist_compliant: true` no frontmatter

**Aprovação:** pending
