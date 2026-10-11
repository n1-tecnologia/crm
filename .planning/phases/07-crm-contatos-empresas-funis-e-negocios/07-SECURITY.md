---
phase: "7"
slug: "crm-contatos-empresas-funis-e-negocios"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-11"
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Registro autorado em tempo de plano (`<threat_model>` nos 13 PLAN.md da fase, 53 linhas, 41 ameaças distintas). Verificação em 2026-10-11 pelo `gsd-security-auditor` (ASVS L1, `block_on: high`): leitura estática dos 72 arquivos de implementação e grep nos 36 arquivos de teste da fase; nenhum container subiu, nenhuma suíte rodou, nada foi escrito. Toda evidência é `arquivo:linha` lido ou caso de teste localizado, não a alegação do SUMMARY.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| navegador → `apps/api` (`/contatos`, `/empresas`, `/funis`, `/etapas`, `/negocios`) | JWT do Supabase no header; Papel e Espaço resolvidos no servidor | dados de CRM do Espaço da sessão (PII de Contato: nome, e-mail, telefone, endereço) |
| `apps/api` → Postgres (`plataforma.*`) | SQL parametrizado dos repositórios; `workspace_id` em todo `WHERE`; FKs compostas por Espaço | registros do CRM, Papéis de Membro |
| `apps/web` → `clienteDaApi` (`src/dados/crm/`) | token só no header `authorization`, só para `NEXT_PUBLIC_API_URL` | token da sessão, respostas da api renderizadas como texto React |
| testes do api → Postgres local (`testes/banco-crm.ts`) | só host `localhost`/`127.0.0.1`; `describe.skip` fora disso | Espaços descartáveis `ws_crm_teste_*` |
| CLI de migração → banco da plataforma | `--seco` é leitura pura; `migrar` só pelo dono atrás de gate `blocking-human` | schema `plataforma` (007-crm.sql) |
| instalações de pacote | `swr@2.5.1` pinado (07-01); nenhum outro pacote novo | `package-lock.json` com `integrity` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Information disclosure | `repositorios/crm/contatos.ts`, `servicos/crm/contatos.ts` | high | mitigate | `workspace_id = $1` em todo `WHERE` (`repositorios/crm/contatos.ts:205,225,238,284,293,301`); `membro.workspaceId` só da sessão; testes `rotas/crm/contatos.test.ts:380,512` | closed |
| T-07-02 | Tampering | `rotas/crm/contatos.ts` (mass assignment) | high | mitigate | `NOVO_CONTATO` `.strict()` sem `workspaceId`/`criadoPor`/`estado`/`modoCriacao` (`rotas/crm/contatos.ts:74-79`); serviço fixa `criadoPor`/`modoCriacao`; teste `:112,:123` | closed |
| T-07-03 | Elevation of privilege | `servicos/crm/acesso.ts` | high | mitigate | `exigir` → `podeNoCrm` (`acesso.ts:39-50`, `dominio/crm/permissoes.ts:48-77`), Papel de `plataforma.registros`; primeira chamada de toda operação nos 4 serviços; teste `servicos/crm/contatos.test.ts:285` (i) | closed |
| T-07-40 | Spoofing | `proprietarioId` em `POST /contatos` | high | mitigate | `resolverProprietario` → `membroAtivo` do mesmo Espaço (`acesso.ts:58-69`, `membros.ts:43-54`); teste `rotas/crm/contatos.test.ts:436` (h) 409 `PROPRIETARIO_INVALIDO` | closed |
| T-07-04 | Spoofing | CORS em `app.ts` | medium | mitigate | `credentials: false`, métodos PATCH/PUT/DELETE só para a allowlist (`app.ts:166-180`); teste `app.test.ts:64-80` | closed |
| T-07-05 | Tampering | SQL dos repositórios | high | mitigate | valores sempre `$n`; colunas de `UPDATE` em lista fixa; `reordenar` por índice numérico; ordenação fixa — nenhum identificador do cliente interpolado | closed |
| T-07-06 | Information disclosure | `servicos/crm/transacao.ts` | medium | mitigate | SQLSTATE 23505/23503/23514 traduzidos sem nome de constraint (`transacao.ts:23-33`); 500 genérico em `app.ts:131-135`; teste `transacao.test.ts:43,48` | closed |
| T-07-07 | Information disclosure | `dados/crm/cliente-crm.ts` | medium | mitigate | token só em `authorization`, só para `NEXT_PUBLIC_API_URL`, sem `console.*` (`cliente-crm.ts:54-67`); teste `cliente-crm.test.ts:38` | closed |
| T-07-08 | Tampering | `testes/banco-crm.ts` | high | mitigate | `hostEhLocal` + `describe.skip` + `prepararBancoCrm` lança antes de `migrar()` (`banco-crm.ts:23-45`); verificação estática (L1) | closed |
| T-07-SC | Tampering | instalações de pacote (07-01 `swr@2.5.1`) | high | mitigate | `apps/web/package.json:28` `"swr": "2.5.1"` exato; `package-lock.json:8654-8658` com `integrity`; sem `postinstall`; diff dos manifestos desde `195fd6c~1` só tem o `swr` (+ transitiva `use-sync-external-store@1.7.0`) | closed |
| T-07-10 | Denial of service | `enderecos`/`camposAdicionais` (jsonb) | medium | mitigate | zod `ENDERECO`/`CAMPOS_ADICIONAIS` limitados (`rotas/crm/comum.ts:34-56`); `validarEnderecos`/`validarCamposAdicionais` no domínio; teste `dominio/crm/contatos.test.ts:21-43` | closed |
| T-07-11 | Tampering | lixeira/exclusão de Contato (D-09) | medium | mitigate | pré-checagem em `comTransacao` (`servicos/crm/contatos.ts:404-441`) + trigger `007-crm.sql:263-299`; testes `servicos/crm/contatos.test.ts:190,258` | closed |
| T-07-12 | Tampering | `q` em `listar` (ILIKE) | high | mitigate | `escaparIlike` + `escape '\'` (`repositorios/crm/sql.ts:10-20`) em 4 repositórios; `q` ≤ 100; teste `servicos/crm/contatos.test.ts:278-280` | closed |
| T-07-13 | Elevation of privilege | `servicos/crm/funis.ts` | high | mitigate | `exigir(..., "funil")` só admin/proprietário (`funis.ts:154,178,234`; `permissoes.ts:68-70`); testes `servicos/crm/funis.test.ts:342`, `rotas/crm/funis.test.ts:424` | closed |
| T-07-14 | Tampering | `padrao` no corpo | medium | mitigate | esquemas `.strict()` sem `padrao`; `POST /funis/:id/padrao` com `exigir` + `validarNovoPadrao`; teste `rotas/crm/funis.test.ts:115,171` | closed |
| T-07-15 | Tampering | `migrarNegocios`/`remapearEtapa` | high | mitigate | destino lido com `workspaceId` da sessão → 404; FK composta `007-crm.sql:415-416`; teste `servicos/crm/funis.test.ts:252-291` (g) | closed |
| T-07-16 | Denial of service | `etapaIds`/`mapeamento` | low | mitigate | `max(LIMITE_DE_ETAPAS_POR_FUNIL=40)` em `rotas/crm/funis.ts:77,94,101-103` | closed |
| T-07-17 | Tampering | invariante "toda Empresa tem admin" | medium | mitigate | `validarRetiradaDeAdmin` no serviço (`empresas.ts:667-686`) + triggers corrigidos (`007-crm.sql:263-299`); testes `admin-da-empresa.test.ts`, `servicos/crm/empresas.test.ts:276` | closed |
| T-07-18 | Information disclosure | `admin.contatoId`, `matrizId`, `vincularContato` | high | mitigate | `carregarContato`/`conferirMatriz` com workspace da sessão → 404 (`empresas.ts:215-229,312-328`); FKs compostas; testes `servicos/crm/empresas.test.ts:133,410` | closed |
| T-07-19 | Spoofing | domínio de provedor público | low | mitigate | `PROVEDORES_PUBLICOS_DE_EMAIL` recusados em `normalizarDominio` (`normalizacao.ts:26-45,103-108`); testes `empresas.test.ts:196`, `normalizacao.test.ts:78-86` | closed |
| T-07-20 | Tampering | edição de `007-crm.sql` já aplicada | high | mitigate | parada prevista se a 007 constasse aplicada (`07-13-PLAN.md:79`); `07-PROVAS.md:41-61` prova `pendente 007-crm.sql` antes do `migrar` | closed |
| T-07-21 | Tampering | XSS em `ficha-de-contato.tsx`, `ciclo-de-vida.tsx` | medium | mitigate | sem `dangerouslySetInnerHTML`/`innerHTML` fora de comentários; links `/crm/<recurso>/${id}` | closed |
| T-07-25 | Tampering | mapeamento do diálogo de migração | low | mitigate | `validarMigracao` na tela (`migrate-funnel-dialog.tsx:22,113`) e no serviço (`funis.ts:511-517`); FK composta | closed |
| T-07-26 | Elevation of privilege | `reabrir` de Negócio `ganho` | high | mitigate | Negócio lido `for update` e `exigir(..., "reabrir", { situacao })` com a situação do banco (`negocios.ts:234-239`); testes `servicos/crm/negocios.test.ts:278`, `rotas/crm/negocios.test.ts:230,388` | closed |
| T-07-27 | Tampering | `situacao`/`encerradoEm`/`estado` no corpo | medium | mitigate | esquemas `.strict()` (`rotas/crm/negocios.ts:44-79`); `atualizar` em lista fixa; teste `rotas/crm/negocios.test.ts:135,301` | closed |
| T-07-28 | Information disclosure | referências a Funil/Etapa/Empresa/Contato | high | mitigate | `conferirEmpresa`/`conferirContato`/`funilAtivo`/`etapaDoFunil` com `workspaceId` → 404 (`negocios.ts:133-156,252-279`); FKs compostas; testes `servicos/crm/negocios.test.ts:155-170,364-410` | closed |
| T-07-30 | Tampering | XSS em `ficha-de-empresa.tsx`, `seletor-de-registro.tsx` | medium | mitigate | sem `dangerouslySetInnerHTML`; links rota fixa + id (`ficha-de-empresa.tsx:497,657`, `vinculos-da-empresa.tsx:46`) | closed |
| T-07-31 | Denial of service | busca do `SeletorDeRegistro` | low | mitigate | espera 300 ms, `limite=10` (`seletor-de-registro.tsx:27-28,64,95`); `q` ≤ 100 no backend; teste `formulario-de-empresa.test.tsx:118-129` | closed |
| T-07-32 | Tampering | atualização otimista do quadro | low | mitigate | `mutate(otimista, { revalidate:false })` e revalidação no `catch` (`quadro-do-funil.tsx:182-196`); teste `quadro-do-funil.test.tsx:281` | closed |
| T-07-34 | Tampering | XSS em `ficha-de-negocio.tsx`, `negocios-do-registro.tsx` | medium | mitigate | links montados só com rota fixa + id (`ficha-de-negocio.tsx:374-376,712`; `negocios-do-registro.tsx:60,142`); sem `dangerouslySetInnerHTML` | closed |
| T-07-36 | Tampering | `migracoesPendentes` / `--seco` | high | mitigate | só `select to_regclass` e `select nome` (`migrar.ts:45-58`); `--seco` não chama `migrar()` (`migrar.cli.ts:13-19`); testes `migrar-seco.test.ts:49,74-90` | closed |
| T-07-37 | Tampering | e2e contra banco | high | mitigate | `describeComBanco`, Espaços `ws_crm_teste_*`, `afterAll` → `limparEspaco` (`crm-fluxo.test.ts:32,76-109`) | closed |
| T-07-38 | Tampering | aplicação da 007 em produção | high | mitigate | gate `blocking-human` (`07-13-PLAN.md:67`); `--seco` antes, `migrar` pelo dono, `--seco` depois com 0 pendentes (`07-PROVAS.md:41-123`) | closed |
| T-07-09 | Information disclosure | `detentorDoIdentificador` (409 `IDENTIFICADOR_EM_USO`) | low | accept | ver Accepted Risks AR-01 | closed |
| T-07-22 | Elevation of privilege | `usePodeNoCrm` (tela só esconde) | low | accept | ver AR-02 | closed |
| T-07-23 | Information disclosure | cache do SWR | low | accept | ver AR-03 | closed |
| T-07-24 | Elevation of privilege | botões de Funil na tela | low | accept | ver AR-04 | closed |
| T-07-29 | Tampering | escrita concorrente no mesmo Negócio | low | accept | ver AR-05 | closed |
| T-07-33 | Elevation of privilege | Reabrir `ganho` na tela | low | accept | ver AR-06 | closed |
| T-07-35 | Information disclosure | recuo para `DealScreen` | low | accept | ver AR-07 | closed |
| T-07-39 | Information disclosure | tabelas novas no schema `plataforma` | low | accept | ver AR-08 | closed |
| T-07-SC (07-02..07-13) | Tampering | instalações de pacote | low | accept | ver AR-09 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-07-09 | Revela o detentor do Identificador só dentro do mesmo Espaço (RN-CON-11 exige indicar o Contato existente); a consulta leva `workspace_id = $1` (`repositorios/crm/contatos.ts:377`; teste do mesmo valor em outro Espaço aceito). | planner (07-03), verificado pelo auditor | 2026-10-11 |
| AR-02 | T-07-22 | A tela só esconde; o backend aplica `podeNoCrm` (T-07-03): um botão forçado no DevTools recebe 403. | planner (07-06) | 2026-10-11 |
| AR-03 | T-07-23 | Cache do SWR em memória da aba, mesmo dado que a sessão já pode ler; some ao recarregar/sair (nenhum provider persistente em `apps/web/src`). | planner (07-06) | 2026-10-11 |
| AR-04 | T-07-24 | A tela só esconde (D-14); o serviço de Funis recusa com 403 (T-07-13). | planner (07-07) | 2026-10-11 |
| AR-05 | T-07-29 | Sem controle otimista nesta fase (last-write-wins, A7 do RESEARCH); `atualizado_em` pode virar ETag depois. O serviço trava `for update` dentro da transação. | planner (07-08) | 2026-10-11 |
| AR-06 | T-07-33 | A tela desabilita Reabrir por `usePodeNoCrm`; o serviço aplica D-14 com a situação lida do banco (T-07-26). | planner (07-10) | 2026-10-11 |
| AR-07 | T-07-35 | O recuo para `DealScreen` só abre quando o id existe no `DataState` que a sessão já recebeu por `GET /estado`; nenhum dado novo exposto. | planner (07-11) | 2026-10-11 |
| AR-08 | T-07-39 | Tabelas novas no schema `plataforma` seguem o regime de `plataforma.registros` (001-006): o `apps/api` é o único cliente, por `DATABASE_URL`; exposição pelo PostgREST, se houver, vale igual para `registros` e é assunto fora desta fase. | planner (07-13) | 2026-10-11 |
| AR-09 | T-07-SC (07-02..07-13) | Nenhum pacote novo nesses planos; confirmado por `git diff 195fd6c~1..HEAD` nos quatro `package.json` (só o `swr` de 07-01). | planner, verificado pelo auditor | 2026-10-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Observações da auditoria (não bloqueantes)

- As seções `## Threat Flags` de `07-01-SUMMARY.md` e `07-07-SUMMARY.md` estão vazias (nem "None" nem lista): lacuna de documentação, não superfície nova.
- T-07-03: o registro cita "caso (g)"; o teste equivalente em `servicos/crm/contatos.test.ts:285` tem rótulo "(i)". Só divergência de rótulo.
- T-07-08: a recusa de host remoto é verificada por leitura (`banco-crm.ts:23-45`); não há teste automatizado do `throw` (aceitável em L1).
- Ambiente do dono: as saídas em `07-PROVAS.md` mostram `DATABASE_SSL_INSECURE=true` (T-02-TLS, Fase 2) no notebook de desenvolvimento; fora dele, fixar `DATABASE_CA_CERT`/`DATABASE_CA_PATH`.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-11 | 41 | 41 | 0 | gsd-security-auditor (verify:post, via /gsd-execute-phase 07) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-11

## Security Audit 2026-10-11

| Metric | Count |
|---|---|
| Threats found | 41 |
| Closed | 41 |
| Open | 0 |
