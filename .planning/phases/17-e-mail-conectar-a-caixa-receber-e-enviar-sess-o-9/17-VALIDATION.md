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

Preenchido pelo planejador, uma linha por tarefa, citando o `<automated>` do plano. Semente por requisito, vinda da pesquisa:

| Requisito | Comportamento provado | Tipo | Comando automatizado | Arquivo existe | Status |
|-----------|-----------------------|------|----------------------|----------------|--------|
| EML-01 | Senha certa: credencial no cofre, Canal `conectada`, cursor no `UIDNEXT`. Senha errada: nada gravado e a frase "O servidor IMAP recusou o usuário ou a senha." SMTP recusa: diz qual dos dois falhou. Nenhuma resposta, log ou erro leva a senha | integração (IMAP e SMTP falsos + Postgres) | `npm test -w @n1/api -- src/mensageria/provedores/email/conexao` | ❌ W0 | ⬜ pending |
| EML-02 | `state` de outro Membro ou Espaço recusado; endereço diferente do Canal recusado sem gravar; certo: token de renovação no cofre e `conectada`; nenhum token em log | integração (servidor de login falso) | `npm test -w @n1/api -- src/mensageria/provedores/email/oauth` | ❌ W0 | ⬜ pending |
| EML-03 | E-mail novo vira Conversa em até 2 min; reiniciar não repete; histórico anterior não entra; `UIDVALIDITY` novo não reimporta; `n:*` não repete a última; filtros D-17-11 viram `ignorado:<motivo>` | integração | `npm test -w @n1/api -- src/mensageria/provedores/email/leitor` | ❌ W0 | ⬜ pending |
| EML-04 | Troca de 3 e-mails numa Conversa; `References` sem `In-Reply-To` junta; Conversa resolvida reabre, na lixeira não; resposta de outra pessoa não troca o Contato (D-17-15) | unitário (domínio) + integração | `npm test -w @n1/dominio -- fio-de-email` e `npm test -w @n1/api -- src/mensageria/provedores/email/entrada` | ❌ W0 | ⬜ pending |
| EML-05 | `In-Reply-To` e `References` certos no `DATA` lido pelo SMTP falso; `Bcc` fora do cabeçalho; anexo vai e volta; `onData` mudo = ambíguo e nunca reenvia; falha parcial de destinatário não falha a Mensagem; `APPEND` conforme a regra e falha dele não falha a Mensagem | integração | `npm test -w @n1/api -- src/mensageria/provedores/email/provedor` | ❌ W0 | ⬜ pending |
| EML-06 | Guarda recusa IPv4 privado, loopback, link-local, `169.254.169.254`, `::1`, `::ffff:127.0.0.1`, host com um IP público e um privado, porta fora de 993/143/465/587, 143 sem STARTTLS e certificado inválido; **uma** resolução de DNS por conexão | unitário + integração | `npm test -w @n1/api -- src/mensageria/provedores/email/rede` | ❌ W0 | ⬜ pending |
| EML-07 | `invalid_grant` ou senha trocada ⇒ `desconectada` com motivo e leitor parado; rede ou 5xx ⇒ reconecta e estado igual; `pendente` reenfileirada ao voltar | integração | `npm test -w @n1/api -- src/mensageria/provedores/email/queda` | ❌ W0 | ⬜ pending |
| Contrato | `descreverContratoDoProvedor` passa para o e-mail com `semWebhook`; nenhum resultado nem erro carrega a credencial | contrato | `npm test -w @n1/api -- src/mensageria/provedores/email/provedor.contrato` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Spike do `imapkit` em módulo**: opção programática de TLS, XOAUTH2 aceito pelo `imapflow`, inserir mensagem e recriar a caixa com outro `UIDVALIDITY`, regra de falha de `IDLE`. Se falhar, dublê de IMAP mínimo escrito à mão (`CAPABILITY`, `AUTHENTICATE`, `SELECT`, `FETCH`, `IDLE`, `APPEND`, `LOGOUT`).
- [ ] Fixture de certificado TLS (SAN `localhost` e `127.0.0.1`), injetado como `ca` só pela dependência de teste da fábrica de conexão.
- [ ] `apps/api/src/testes/servidor-de-email-falso.ts`: sobe IMAP e SMTP e devolve `{imap, smtp, adicionarMensagem, entregues, fechar}`.
- [ ] Arquivos `*.test.ts` das linhas acima e `fio-de-email.test.ts` no domínio.
- [ ] Ajuste de `contrato-do-provedor.ts` (`semWebhook`) e de `processador-de-entrada.test.ts` (anexos já guardados).
- [ ] `imapkit` e `smtp-server` em `devDependencies` (depois do `checkpoint:human-verify` de legitimidade de pacotes).

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
