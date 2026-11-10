---
phase: "14"
slug: unificacao-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 14 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria. O registro vem dos blocos `<threat_model>` dos 19 planos; a coluna Mitigation traz a evidência que o auditor encontrou no código, não o que o plano prometia.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| migração → banco de produção | a 011 roda com o dono do schema; só vai a produção no deploy da Fase 15, pelo dono | DDL e backfill da lixeira da Conversa |
| `apps/api` → navegador | rotas novas do CRM (notas, consentimentos, mesclagem, transferir, mover, atribuir, lixeira, marcação, sucessão, `/tarefas-conversacionais`) | dado pessoal de Contato, Mensagens, Papel do Membro |
| navegador → `apps/api` | corpos de escrita validados com `.strict()`; `workspace_id`, autor e Papel nunca vêm do corpo | ids, texto de nota e de Mensagem |
| cópia dos dados reais → notebook do dono | `~/n1-ensaio/` com as nove coleções do CRM antigo (nome, telefone, e-mail, Mensagens) | dado pessoal de clientes |
| notebook → repositório | nada da cópia pode virar arquivo rastreado | — |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (evidência verificada) | Status |
|-----------|----------|-----------|----------|-------------|-----------------------------------|--------|
| T-14-01 | Information Disclosure | `registros_crm_antigo` e `crm_de_para` (dado pessoal das coleções antigas) | high | mitigate | `crm_de_para` e `registros_crm_antigo` só aparecem em `testes/banco-crm.ts`, no teste da 011 e em comentário; `hidratar()` intacto; sem RLS (`011.sql:134-171`); registrado em `persistencia/CONTEXT.md` | closed |
| T-14-02 | Tampering | `mesclado_em_id` apontando para Contato de outro Espaço | medium | mitigate | FK composta `(workspace_id, mesclado_em_id)` em `011.sql:55-57`; `migracao-011.test.ts` (a) | closed |
| T-14-03 | Denial of Service | migração que falha no meio deixando o schema pela metade | medium | mitigate | `migrar.ts:87-93`: begin, SQL, insert em `migracoes`, commit, rollback no catch; teste (f) | closed |
| T-14-SC (14-01) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-04 | Tampering | `alvoConferido` e `referencias` (nome do Contato, Canal "conferido") forjados p… | high | mitigate | As 4 operações `*NasTabelas` e as 4 antigas fora de `OPERACOES` (`tarefa-conversacional-nas-tabelas.test.ts:307-327`); `CREATE_TASK_INPUT` `.strict()` sem `vinculos` | closed |
| T-14-05 | Information Disclosure | nome do Contato na Atividade e na proveniência | low | accept | Risco declarado no plano 14-02: mesmo dado que a Tarefa antiga já guarda; resposta recortada por Membro | closed |
| T-14-SC (14-02) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-06 | Tampering | corrida entre a pré-checagem de `lerDoCrm` e a escrita de `gravarNoCrm` | high | mitigate | `for update` do Contato em `lerParaConversa`; travas em ordem de id (`mesclagem.ts:36-55`, `conversas.ts:210-220`); índice único `conversas_nao_resolvida_uq`; `23505/23503/23514` traduzidos em `transacao.ts:23`; `gesto-misto.test.ts:218-239` | closed |
| T-14-07 | Information Disclosure | resposta da rota mista sem recorte por Membro | high | mitigate | `resposta-recortada.ts:25` extraída e usada em `operacoes.ts:481` e nos serviços da Tarefa; `operacoes.test.ts:945` | closed |
| T-14-08 | Denial of Service | exceção como fluxo normal destruindo conexões do pool | medium | mitigate | `gesto-misto.ts:62-95`: a recusa volta como valor e `RecusaDentroDoGesto` só nasce em `gravarNoCrm`; `persistencia/CONTEXT.md` | closed |
| T-14-SC (14-03) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-09 | Tampering | escrita sobre Contato `mesclado` (restaurar o absorvido, dar Negócio a ele) | medium | mitigate | Papel conferido antes de qualquer regra em `contatos.ts:170`, `negocios.ts:150`, `empresas.ts:223`, `consentimentos.ts:66`, `tarefas-conversacionais.ts:193,484` | closed |
| T-14-SC (14-04) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-10 | Information Disclosure / Tampering | IDOR: mover para Contato de outro Espaço, atribuir a Membro de outro Espaço | high | mitigate | `servicos/crm/conversas.ts:197-290` tudo por `membro.workspaceId`; destino e atribuído conferidos no Espaço; `conversas.test.ts:182,439,494,509` | closed |
| T-14-11 | Tampering | mass assignment (`estado`, `situacao`, `workspaceId` no corpo) | medium | mitigate | Corpos `.strict()` em `rotas/crm/conversas.ts:53-75`; `conversas.test.ts:89` | closed |
| T-14-12 | Denial of Service | deadlock entre mover e mesclar | low | mitigate | Ids ordenados antes de travar (`conversas.ts:~205`); `mesclagem.ts:54` `order by id for update` | closed |
| T-14-SC (14-05) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-13 | Spoofing / Tampering | autor da nota forjado | medium | mitigate | Autor é `membro.id` (`notas.ts:75`); `NOVA_NOTA` `.strict()` só com `conteudo`; `notas.test.ts:97` | closed |
| T-14-14 | Information Disclosure | IDOR: ler notas ou transferir para Contato de outro Espaço | high | mitigate | Todo `where` com `workspace_id = $1` em notas, transferir e mover Identificador; `notas.test.ts:120`, `contatos.test.ts:486` | closed |
| T-14-15 | Information Disclosure | conteúdo da nota (dado pessoal) em log | medium | mitigate | Nenhum `log`/`console` nos serviços, rotas e repositórios de notas, consentimentos e mesclagem; `hidratar()` intacto | closed |
| T-14-SC (14-06) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-16 | Tampering | SQL injection por `q` ou por filtro | high | mitigate | `repositorios/crm/conversas.ts:191-206`: fragmentos constantes e `$n`; `q` por `position(lower($n) in ...)`; `conversas.test.ts:704` | closed |
| T-14-17 | Spoofing | marcar estrela/leitura em nome de outro Membro | medium | mitigate | Marcação por `membro.id` (`conversas.ts:361-371`); `MARCAR_CONVERSA` `.strict()` sem campo de Membro; `conversas.test.ts:633` | closed |
| T-14-18 | Information Disclosure | `contatoNome` de Contato de outro Espaço no `join` | medium | mitigate | Join com `ct.workspace_id = c.workspace_id` e `c.workspace_id = $1` (`repositorios/crm/conversas.ts:231-236`) | closed |
| T-14-SC (14-07) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-19 | Repudiation | consentimento adulterado ou apagado | high | mitigate | Repositório só tem `inserir` e `listarDoContato`; nenhuma rota de edição; `registrado_por` = `membro.id`, `registrado_em` do banco; `consentimentos.test.ts:130` | closed |
| T-14-20 | Tampering | evidência ou finalidade de outro Espaço/Contato | medium | mitigate | Finalidade no Catálogo do Espaço (`referencias.ts:128-139`); `mensagemEhDoContato` por join no mesmo Espaço; `consentimentos.test.ts:149` | closed |
| T-14-21 | Information Disclosure | consentimento em log ou em `GET /estado` | medium | mitigate | `hidratar()` intacto; serviço e rota sem log | closed |
| T-14-SC (14-08) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-22 | Information Disclosure / Tampering | IDOR: mesclar Contato de outro Espaço | high | mitigate | `travarDois` com `c.workspace_id = $1` (`repositorios/crm/mesclagem.ts:50-55`); `mesclagem.test.ts:508,517` | closed |
| T-14-23 | Tampering | corrida entre duas mesclagens cruzadas (deadlock, cadeia) | high | mitigate | `order by id for update of c`; `validarMesclagem` recusa estado diferente de ativo/arquivado; teste `Promise.all` em `mesclagem.test.ts:544` | closed |
| T-14-24 | Information Disclosure | conteúdo de notas e consentimentos em log | medium | mitigate | Sem log; a resposta é só o sobrevivente | closed |
| T-14-SC (14-09) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-25 | Elevation of Privilege | sucessão nas tabelas sem conferir quem pede | high | mitigate | `unidade-de-trabalho.ts:611-680`: recusa faz rollback e `aoConfirmar` só roda depois do ok; `removeMember` exige Administrador ou Proprietário ativo; `operacoes.test.ts:1025-1103` | closed |
| T-14-26 | Information Disclosure | prévia de outro Membro (contagens) | low | mitigate | `servicos/crm/sucessao.ts:35-39` confere o Papel antes do Membro pedido; repositório todo por `workspace_id = $1` | closed |
| T-14-SC (14-10) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-27 | Tampering (XSS) | conteúdo de nota renderizado na ficha | medium | mitigate | Nenhum `dangerouslySetInnerHTML=` nem `innerHTML` real em `apps/web/src` | closed |
| T-14-28 | Elevation of Privilege | botão habilitado para quem não pode | low | accept | Risco declarado no plano 14-11; o servidor barra por Papel (`exigir`) em notas, consentimentos e mesclagem | closed |
| T-14-SC (14-11) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-29 | Tampering | `canais` forjado no corpo (Canal inexistente "ativo") | high | mitigate | `LER_DO_CRM` sobrescreve a posição `canais` (`operacoes.ts:297-303,421`); `operacoes-canais-da-lista.test.ts:104-112` | closed |
| T-14-30 | Denial of Service | `canais` gigante no corpo | low | mitigate | `.max(100)` em `esquemas/tarefas-conversacionais.ts:25` e em `createList` | closed |
| T-14-SC (14-12) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-31 | Tampering | referência forjada (nome do Contato, Canal "conferido", `alvoConferido`) | high | mitigate | Corpo `.strict()` sem referências; `lerParaConversa` lê do banco; `rotas/crm/tarefas-conversacionais.test.ts:97` | closed |
| T-14-32 | Information Disclosure | IDOR no resumo em lote (ids de outro Espaço) | high | mitigate | Todo join com `workspace_id = $1` em `repositorios/crm/tarefas-conversacionais.ts`; teste de outro Espaço no serviço | closed |
| T-14-33 | Information Disclosure | Tarefa oculta no corpo da resposta de criar | medium | mitigate | Respostas passam por `recortarResposta` (`tarefas-conversacionais.ts:362,425,465,526`) | closed |
| T-14-34 | Denial of Service | resumo com Vínculos demais | low | mitigate | `.max(RESUMO_MAXIMO)` (200) na rota e recusa no serviço | closed |
| T-14-SC (14-13) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-35 | Information Disclosure / Tampering | IDOR: ligar Negócio de outro Espaço ou de outro Contato | high | mitigate | `contatoId` vem do Vínculo lido no servidor e o Negócio é conferido por `workspaceId`, estado `ativo` e `contatoId` (409) | closed |
| T-14-36 | Tampering | Tarefa de uma Lista que o Membro não escreve | medium | mitigate | `taskWriteRefusal` e `listWriteRefusal` em `tarefa-conversacional-nas-tabelas.ts` | closed |
| T-14-37 | Tampering | Negócio órfão quando o Vínculo falha | medium | mitigate | O Negócio só é inserido em `gravarNoCrm`, depois de a operação aceitar | closed |
| T-14-SC (14-14) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-38 | Tampering (XSS) | trecho de Mensagem no cartão | medium | mitigate | Trecho da Mensagem entra como texto React (`cartao-conversacional.tsx:139`); sem HTML cru em `apps/web` | closed |
| T-14-39 | Denial of Service | publicar o corte antes do script de migração (Tarefas antigas sem Contato na te… | high | mitigate | Plano 14-15 marca "só no deploy da Fase 15"; fronteira em `14-PROVAS.md`; HEAD não está na `main` | closed |
| T-14-SC (14-15) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-40 | Denial of Service | publicar os chamadores novos antes do script da Fase 15 (fio e ficha com ids an… | high | mitigate | Plano 14-16 com 3 `<precondition>`; fronteira em `14-PROVAS.md`; HEAD não está na `main` | closed |
| T-14-41 | Tampering | a tela mandar referências "conferidas" | low | mitigate | A web só manda ids e `mensagem`; corpos `.strict()` na api | closed |
| T-14-SC (14-16) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-42 | Tampering | as quatro operações antigas ainda alcançáveis com referências não conferidas | medium | mitigate | As 4 operações antigas não existem mais; 404 provado em `operacoes.test.ts:107-119` | closed |
| T-14-SC (14-17) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-43 | Tampering | gate rodando contra o banco de produção | high | mitigate | Comando literal do gate em `14-PROVAS.md` exporta as duas URLs de `localhost:55618` | closed |
| T-14-SC (14-18) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |
| T-14-44 | Information Disclosure | a cópia dos dados reais (CSV) | high | mitigate | Cópia em `~/n1-ensaio/` (modo 700, fora do repositório); nenhum `.csv` no git; `14-ENSAIO.md` só com números e ids de Espaço | closed |
| T-14-45 | Information Disclosure | contêiner com o dado real deixado de pé | medium | mitigate | `crm-n1-pg-1419` apagado (`docker ps -a` confere); `trap` registrada em `14-ENSAIO.md` | closed |
| T-14-46 | Elevation of Privilege | o agente usar a senha de produção do `.env` | high | mitigate | Dispensada pelo dono no chat (ver Accepted Risks Log): uso somente leitura, senha por stdin, nada gravado em arquivo | closed (dispensada pelo dono) |
| T-14-SC (14-19) | Tampering | instalação de pacote | low | accept | Nenhum `package.json` nem lockfile alterado entre `606cee8` e `HEAD` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — só ameaças abertas em `high` ou acima contam para `threats_open`*
*Disposition: mitigate (implementação exigida) · accept (risco documentado) · transfer (terceiro)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-14-01 | T-14-05 | A Tarefa conversacional nas tabelas guarda o mesmo dado que a Tarefa antiga já guardava; a resposta é recortada por Membro | plano 14-02 | 2026-11-04 |
| AR-14-02 | T-14-28 | A tela esconde botões por Papel, mas quem barra é o servidor; esconder na tela é conveniência, não controle | plano 14-11 | 2026-11-04 |
| AR-14-03 | T-14-SC (14-01 a 14-19) | Nenhum pacote foi instalado na fase; verificado: `package.json` e lockfiles intocados entre `606cee8` e `HEAD` | planos 14-01 a 14-19 | 2026-11-04 |
| AR-14-04 | T-14-46 | A regra "o agente nunca usa a senha de produção" foi dispensada pelo dono, que colou a connection string na conversa e pediu que o agente rodasse o export depois de o `\copy` falhar no SQL Editor. Uso somente leitura (`default_transaction_read_only = on`), senha por stdin, nada gravado em arquivo ou no repositório. A senha ficou no histórico da conversa: o dono deve trocá-la depois do ensaio. | dono (conversa de 2026-11-05) | 2026-11-05 |

---

## Observações da auditoria (fora do registro, não bloqueiam)

1. **Teste que pode abrir o banco de produção.** `apps/api/src/rotas/operacoes.test.ts:268` chama `carregarEnv()` e o bloco seguinte usa `describe` simples, não `describeComBanco`; sem `DATABASE_URL` no ambiente ele abre o banco do `.env`. Já está em `14-PROVAS.md` (incidente do 14-17). A conferência de 2026-11-05 em produção deu 0 linhas em `ws_rotas_teste`. Correção sugerida e não feita: trocar por `describeComBanco`; vale antes da Fase 15.
2. **Dado real fora do repositório.** `~/n1-ensaio/registros-crm-antigo.csv` (cerca de 3 MB) é cópia do CRM antigo de produção. Modo 700, fora do repo; o dono deve apagá-la quando o ensaio da Fase 15 acabar.
3. **T-14-39, T-14-40 e T-14-42 dependem de processo.** Só valem enquanto o ramo `fase-13-gravacao-em-menos-idas-e-voltas` não for mesclado na `main` antes do deploy da Fase 15, e a 011 não está aplicada em produção.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-05 | 65 | 65 | 0 | gsd-security-auditor (leitura estática, ASVS 1, block_on high) e o orquestrador |

---

## Sign-Off

- [x] Todas as ameaças têm disposição (mitigate / accept / transfer)
- [x] Riscos aceitos documentados no Accepted Risks Log
- [x] `threats_open: 0` confirmado
- [x] `status: verified` no frontmatter

**Approval:** verified 2026-11-05
