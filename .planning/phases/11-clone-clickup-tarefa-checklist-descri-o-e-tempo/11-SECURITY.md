---
phase: "11"
slug: "clone-clickup-tarefa-checklist-descri-o-e-tempo"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-10-29"
---

# Phase 11 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.
> Origem do registro: blocos `<threat_model>` dos planos 11-01 a 11-08 (escritos na época do plano). Verificação feita no código por `gsd-security-auditor` em 2026-10-29; os "Threat Flags" dos SUMMARY foram tratados como afirmação, não como evidência.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| cliente → `POST /operacoes/:nome` | argumentos validados por esquema `.strict()` antes de `executar()`; o Membro que age vem do JWT, nunca dos argumentos | `convertChecklistItem`, `updateTask` com `descriptionMentions` |
| `GET /estado` → navegador | o estado sai recortado por `visibilidadePara` (Registros de Tarefas ocultas ficam de fora) | descrição, `before`/`after` do histórico, menções |
| texto de Membro → tela | descrição, trecho da menção, nomes e texto anterior/novo renderizados como nós de texto React | texto livre (sem HTML, sem markdown na expansão) |
| agente → banco | só o Postgres de Docker local (`localhost:55618`); o banco da plataforma só pelo dono, em leitura | conferência A1 (`select count(*)`) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-11-01 | Elevation of Privilege | `convertChecklistItem` por Membro sem escrita ou Convidado | high | mitigate | `conversaoDeItemRecusada` (`derive.ts:581`) embrulha `taskWriteRefusal` e roda antes de qualquer efeito (`operations/tasks.ts:640`); Membro vem do JWT (`rotas/operacoes.ts:340`); teste `conversao-de-item.test.ts` | closed |
| T-11-02 | Tampering | 4º argumento forjado escolhendo outra Tarefa pai | medium | mitigate | função de 5 parâmetros, esquema `z.tuple([ID, ID, ID])` (`esquemas/tarefas.ts:61`), 400 antes de `executar()`; testes (i2) e (r3) | closed |
| T-11-03 | Tampering | registro antigo com a chave de Subitem passa a contar como Item | low | accept | campo removido do tipo e de todo o código (`git grep` sem achados); A1 confirmada em produção (contagem 0, 29/10/2026) | closed (aceito) |
| T-11-04 | Spoofing | menção forjada (id sem `@Nome` no texto) | medium | mitigate | `updateTask` recusa Membro inexistente antes de mutar e refiltra por `mencionaNoTexto` (`tasks.ts:1483-1516`); leitura exige o `@Nome` (`membrosMencionadosNaDescricao`) | closed |
| T-11-05 | Information Disclosure | texto anterior/novo da descrição a quem não vê a Tarefa | high | mitigate | `derive-visibilidade.ts:202` filtra Registros de Tarefas ocultas; `GET /estado` aplica em `estado.ts:46`; teste D-14 em `derive-visibilidade.test.ts` | closed |
| T-11-06 | Information Disclosure | dado sensível apagado da descrição continua no histórico | medium | accept | decisão D-13: quem vê a Tarefa vê o texto anterior; histórico recortado por visibilidade (T-11-05) e oculto para Ator de integração (T-11-15) | closed (aceito) |
| T-11-07 | Tampering | `descriptionMentions` com tipo arbitrário ou chave a mais | low | mitigate | `z.object({type: z.literal("member"), id: ID}).strict()` dentro de `UPDATE_TASK_INPUT` `.strict()` (`esquemas/tarefas.ts:29`); caso (a2) | closed |
| T-11-08 | Denial of Service | descrição enorme multiplicando o `GET /estado` | low | mitigate | `cortarParaHistorico`: 2.000 pontos de código + "…" nos dois lados (`descricao-da-tarefa.ts`, `tasks.ts:1499`); teste inclui fronteira de emoji | closed |
| T-11-09 | Information Disclosure | `minutosComSubtarefas` no servidor com o estado inteiro | low | accept | nenhum leitor de servidor usa `tempoRegistrado` nesta fase; docstring (Pitfall 9, `derive.ts:523-526`) obriga o chamador de servidor a passar o estado já recortado | closed (aceito) |
| T-11-10 | Information Disclosure | menção da descrição avisando quem não vê a Tarefa | high | mitigate | `memberSeesTask` com `continue` antes da variante `descricao` (`derive.ts:1398`); teste em `mencao-na-descricao.test.ts` | closed |
| T-11-11 | Spoofing | id gravado sem o `@Nome` para disparar aviso | medium | mitigate | a variante só nasce via `membrosMencionadosNaDescricao(...).includes(memberId)` (`derive.ts:1412`); testes de menção forjada | closed |
| T-11-12 | Tampering | HTML no trecho da descrição em Notificações | low | mitigate | trecho como nó de texto React em `notificacoes/page.tsx`; sem `dangerouslySetInnerHTML` | closed |
| T-11-13 | Tampering | `descriptionMentions` montado no cliente com Membro fora do texto | low | mitigate | o hook só manda quem passa em `mencionaNoTexto` (`mencoes.ts`); o domínio refiltra (`tasks.ts:1508`) | closed |
| T-11-14 | Tampering | HTML no nome de Membro no menu de sugestões | low | mitigate | `<span>{membro.displayName}</span>` (`task-editors.tsx`); nada de HTML montado à mão | closed |
| T-11-15 | Information Disclosure | Ator de integração com payload/CPF/CNPJ/URL assinada no `before`/`after` | high | mitigate | `temAlteracaoParaVer` exige `actor.kind !== "integration"`; Timeline e Feed zeram `before`/`after` para integração; Auditoria e Reunião não imprimem o texto; testes (k), (f) e do Feed | closed |
| T-11-16 | Tampering | XSS pelo texto anterior/novo na expansão | medium | mitigate | texto como nó React em `whitespace-pre-wrap`, sem `Rico`; teste com `<img onerror>` literal | closed |
| T-11-17 | Tampering | XSS pelo destaque do `@Nome` ou pela descrição | medium | mitigate | só `<span data-mencao>` e nós de texto, a partir de `segmentosComMencoes` (texto puro); teste com `<b>` literal | closed |
| T-11-18 | Elevation of Privilege | botão de converter oferecido a quem não escreve | medium | mitigate | `BotaoDeConversao` devolve `null` quando `conversaoDeItemRecusada(...)` não é `undefined`; o domínio também recusa (T-11-01); teste do Convidado | closed |
| T-11-19 | Spoofing | "Abrir" apontando para a Subtarefa errada | low | mitigate | o id vem da resposta do servidor (`confirmado`), não da cópia local; teste `tsk_do_servidor` | closed |
| T-11-20 | Tampering | teste ou `migrar` contra o banco de produção do `.env` | high | mitigate | proibição registrada em `11-08-PLAN.md`; toda URL da fase é `localhost:55618`; `11-PROVAS.md` registra e2e e portão no Docker local; consulta de produção só de leitura, feita pelo dono (contagem 0); nenhuma migração alterada. Ver nota 1 | closed |
| T-11-21 | Information Disclosure | `GET /estado` entregando histórico/menção a quem não vê a Tarefa | high | mitigate | `visibilidadePara` em `estado.ts:46` sobre o filtro de `derive-visibilidade.ts`; `estado.test.ts` e `dados-de-outro-membro.test.ts` verdes no e2e local; prova específica do texto no teste de domínio D-14 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-03 | Nenhuma operação nem seed cria a chave de Subitem. A premissa A1 (nenhum registro de produção a carrega) foi conferida em produção, só leitura: contagem 0. Sem ação e sem `011`. | Plano 11-01; A1 confirmada pelo dono | 2026-10-29 |
| AR-11-02 | T-11-06 | Quem vê a Tarefa vê o texto anterior da descrição (mesma regra do resto do histórico). Dado já gravado fica; recortado por visibilidade e oculto de integração. | Dono (decisão D-13, `11-CONTEXT.md`) | 2026-10 |
| AR-11-03 | T-11-09 | `tempoRegistrado` não é chamado no servidor nesta fase; quem o chamar no servidor deve passar o estado já recortado (docstring em `derive.ts`). | Plano 11-03 | 2026-10-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Notas não bloqueantes (da auditoria)

1. **T-11-20, resíduo pré-existente.** `apps/api/src/rotas/operacoes.test.ts:251-253` liga o bloco "contra o banco real" só por `Boolean(process.env.DATABASE_URL)`, depois de `carregarEnv()` ler o `.env`; não há checagem de `localhost`, ao contrário de `describeComBanco` e `prepararBancoCrm`. Os casos novos (r2, r2b, r3, r3b) estão nesse bloco. A contenção depende de quem roda passar URLs locais explícitas, o que a fase fez. Se alguém esquecer, o alcance fica no espaço de testes `ws_rotas_teste` (apaga e semeia). Ideia para uma fase futura: trocar o guarda por `describeComBanco`/`hostEhLocal`. Não foi alterado aqui (fora do escopo).
2. **`11-08-SUMMARY.md` não tem a seção `## Threat Flags`** (os outros sete têm). Informativo: as ameaças do 11-08 (T-11-20, T-11-21) foram verificadas direto no código.
3. **T-11-21, força da prova.** Os dois testes de rota (`estado.test.ts`, `dados-de-outro-membro.test.ts`) são anteriores à fase e nenhum afirma o texto de "Descrição alterada" para outro Membro; a prova específica do texto é o teste de domínio D-14.
4. Nenhuma superfície de ataque nova fora do registro foi encontrada (sem endpoint, rota ou esquema além dos registrados; `descriptionMentions` não sai na projeção pública).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-29 | 21 | 21 | 0 | gsd-security-auditor (verificação no código, ASVS 1; pontos críticos conferidos de novo pelo orquestrador) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-29
