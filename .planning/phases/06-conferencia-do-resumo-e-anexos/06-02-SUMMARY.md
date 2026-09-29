---
phase: 06-conferencia-do-resumo-e-anexos
plan: 02
subsystem: contrato-contas-a-pagar (financeiro-tria/automation + crm-n1)
tags: [contrato-v1.1, omie, incluir-anexo, conferencia-do-resumo, fixtures, node-test, vitest]

# Dependency graph
requires:
  - phase: 03-07
    provides: "rotas /resolver e /lancar (contas-a-pagar-routes.ts), resolução e lançamento com portas injetadas"
  - phase: pos-auditoria-1.6
    provides: "contratos/contas-a-pagar-v1/ (16 exemplos + README) e os dois testes de contrato com comparação por hash"
provides:
  - "/resolver e /lancar aceitam pedidoDeRevisao (≤ 500, fim da consulta do RAG, nunca em log) e codigoCategoriaConfirmado (validado no plano de contas real; RAG não chamado)"
  - "/lancar aceita anexos string | { url, nome }; o nome vai para dentro do zip e para cNomeArquivo; a resposta devolve anexos[].nome só quando pedido com nome"
  - "OmieAdapter.uploadAttachmentFromUrl({ fileName? })"
  - "3 exemplos canônicos v1.1 nos dois repositórios (hash idêntico)"
  - "teste:omie-real --anexo=<caminho> (ensaio confere o arquivo; --lancar sobe por IncluirAnexo servindo o arquivo uma vez em 127.0.0.1)"
  - "§3/§7 v1.1 em 05-contrato-lancamento-contas-a-pagar-v1.md"
affects: [06-03, 06-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contrato cresce por v1.x ADITIVA: campo novo sempre opcional, nunca muda o sentido de um existente, schemas continuam .strict(); /v2 só para mudança que quebre isso"
    - "Exemplo canônico que prova o que a rota MANDA às portas: RAG falso que só acha a Categoria se o pedido estiver no fim da consulta; RAG que lança se for chamado com código confirmado"

key-files:
  created:
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/resolver.sucesso-pedido-de-revisao.json
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/resolver.sucesso-codigo-confirmado.json
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json
    - contratos/contas-a-pagar-v1/resolver.sucesso-pedido-de-revisao.json
    - contratos/contas-a-pagar-v1/resolver.sucesso-codigo-confirmado.json
    - contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json
  modified:
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts
    - ../financeiro-tria/automation/src/adapters/omie.ts
    - ../financeiro-tria/automation/src/tenants/tria/teste-omie-real.ts
    - ../financeiro-tria/automation/scripts/teste-omie-real.ts
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/README.md
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.test.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.test.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-routes.test.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-contrato.test.ts
    - ../financeiro-tria/automation/src/tenants/tria/teste-omie-real.test.ts
    - contratos/contas-a-pagar-v1/README.md
    - apps/api/src/automacoes/contrato-contas-a-pagar.test.ts
    - docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md

key-decisions:
  - "codigoCategoriaConfirmado com o plano de contas inalcançável (ListarCategorias vazio) sai 'revisar' ('o código X não pôde ser validado'), nunca 'resolvida' — mesma honestidade do ramo do RAG; pane na leitura continua transitória."
  - "Com pedidoDeRevisao ausente ou só espaços a consulta do RAG é byte a byte a de antes; o pedido entra depois de um espaço, no fim."
  - "Anexo string vazio passa a 400 (z.string().min(1), como o plano pede): antes virava um download que sempre falhava; nenhum chamador mandava anexos."
  - "uploadAttachmentFromUrl usa `fileName || nome da URL` (não `??`): um nome vazio nunca vira nome de arquivo — o schema já recusa, o adapter não depende disso."
  - "Código de Categoria dos exemplos v1.1 é 2.08.05 ('Tarifas bancárias', inventado) — o ensaio real mostrou que 2.04.03 é 'Contas de Consumo' no Omie da Tria, então o exemplo não usa um código real com outro nome."
  - "teste:omie-real: anexo que não sobe NÃO derruba o /lancar (como o legado), mas reprova o teste ('anexo no Omie' ✖), que existe para provar o anexo; a exclusão do título continua."

patterns-established:
  - "Contrato v1.x aditivo provado por exemplo novo nos dois repositórios, sem tocar os exemplos v1"

# RES-03/RES-04: este plano entrega só a metade do backend (contrato v1.1).
# A ponte (06-03) manda os campos; a prova real do anexo no Omie é o checkpoint 06-06.
requirements-completed: []
requirements-advanced: [RES-03, RES-04]

# Metrics
duration: ~25min
completed: 2026-09-29
---

# Phase 6 Plan 02: Contrato contas-a-pagar v1.1 no financeiro-tria — Summary

**`/resolver` e `/lancar` aceitam o pedido de ajuste do Financeiro (fim da consulta do RAG, nunca em log) e o código de Categoria que ele conferiu (validado no plano de contas real, sem perguntar ao RAG de novo); `/lancar` sobe os anexos com o nome original até o `cNomeArquivo` do `IncluirAnexo`; três exemplos canônicos v1.1 idênticos nos dois repositórios; `teste:omie-real --anexo` pronto para o checkpoint do dono.**

## Performance

- **Duração:** ~25 min
- **Fim:** 2026-09-29T20:12Z
- **Tasks:** 3/3
- **Arquivos:** 6 criados, 15 modificados (nos dois repositórios)

## Realizações

- **Task 1 — `/resolver` v1.1.** `EntradaDeResolucao` ganhou `pedidoDeRevisao?` e `codigoCategoriaConfirmado?`. `consultaDeCategoria` monta `título categoria descrição` + ` pedido` (Fluxo 6 do legado, `reviseSummary`, sem a IA de redação). `resolverCategoriaConfirmada` lê `ListarCategorias` e devolve `resolvida` (nome do Omie, `similaridade: 1`), `revisar` com `"Código X não existe no plano de contas do Omie."` ou `revisar` por plano inalcançável — sem chamar o RAG. Schemas: `pedidoDeRevisao: z.string().max(500)`, `codigoCategoriaConfirmado: z.string().regex(/^\d(\.\d{2}){2,3}$/)`, nos dois (`entradaDeLancamento` herda), `.strict()` mantido.
- **Task 2 — `/lancar` v1.1.** `anexos: ReadonlyArray<string | { url, nome }>`, normalizados no laço; `PortaDeAnexos.enviar({ url, nome?, recordId })`; `AnexoEnviado.nome?` só quando pedido com nome. `construirDepsDeEscritaReais` repassa `fileName: nome`; `uploadAttachmentFromUrl` usa o nome dentro do zip e em `cNomeArquivo` (normalizado por `normalizeAttachmentFileName`). O código confirmado chega ao `incluir` sem lógica extra (a resolução da Task 1 já o põe em `omie.codigoCategoria`). O ramo `reaproveitado` continua `anexos: []`, com o comentário do adiamento.
- **Task 3 — contrato e teste real.** Três exemplos no produtor, cada um provado contra o handler real (`contas-a-pagar-contrato.test.ts`, cenários novos: plano de contas extra, RAG que olha a consulta, porta de anexos por cenário); README com a seção "v1.1 (aditiva)"; cópia por `cp` para o `crm-n1` (`diff -r` vazio) e 4 casos v1.1 no teste do consumidor. `05-contrato…`: §3 com os campos "v1.1, opcional" e §7 com o parágrafo "v1.1 (aditiva, 2026-09-29)". `teste:omie-real --anexo=<caminho>`: passo "anexo" (arquivo legível) no ensaio; no `--lancar`, servidor em `127.0.0.1` porta livre servindo o arquivo uma vez só durante o primeiro `/lancar`, passo "anexo no Omie" exigindo `anexos[0].ok`, relato com o nome e nunca a URL.

## Commits

**financeiro-tria** (`main`, local, sem push):

1. `d462f6e` feat(contas-a-pagar): /resolver v1.1 — pedidoDeRevisao e codigoCategoriaConfirmado
2. `24ef256` feat(contas-a-pagar): /lancar v1.1 — anexos com nome até o IncluirAnexo, categoria confirmada
3. `5a65e5b` feat(contas-a-pagar): exemplos canônicos da v1.1 e teste:omie-real --anexo

**crm-n1-integracao** (`integra-frontend-main`):

4. `14b9734` feat(06-02): contrato contas-a-pagar v1.1 — exemplos copiados, prova do consumidor e documento

Testes escritos junto com cada implementação e commitados no mesmo commit da Task (plano `type: execute` com tasks `tdd="true"`, como em 06-01). RED conferido nas Tasks 1 e 2 (5 e 4+2 falhas antes da implementação); a prova de que cada teste morde está nas mutações abaixo.

## Testes

| Onde | Antes | Depois |
|---|---|---|
| `financeiro-tria/automation` `npm test` (isolado) | 538/538 | **566/566** (+28) |
| `npx tsc --noEmit -p .` (src) | verde | verde |
| `scripts/teste-omie-real.ts` (tsc com tsconfig temporário que inclui o script — o `tsconfig.json` só cobre `src/`) | — | verde |
| `contas-a-pagar-contrato.test.ts` (produtor) | 17 | **20/20** |
| `apps/api` `DATABASE_URL= npx vitest run src/automacoes/contrato-contas-a-pagar.test.ts` | 21 | **25/25** (hash por arquivo contra o produtor incluído, não pulado) |
| `npm run typecheck` (três workspaces, crm-n1-integracao) | — | EXIT 0 |
| `npm run verificar:contratos` | — | OK (só cobre `payment-requests-v1`) |

Casos novos no `financeiro-tria`: resolução (a, a2, b, c, c2, c3), rotas v1.1 (d ×3, código confirmado 3 e 4 níveis, 422 com código fora do plano, e) e anexos (d ×2, c pelo wiring real + Omie falso em loopback abrindo o zip enviado), lançamento (a, a2, b, b2, e), contrato (3 exemplos), teste real (5).

**Ensaio real no Omie da Tria (só leituras, sem `--lancar`):**
- `npm run teste:omie-real` → credencial ✔, fornecedor ✔, resolver ✔ (Contas de Consumo 2.04.03, similaridade 0.46), consulta prévia ✔, ensaio ✔ — **RESULTADO: OK**.
- `npm run teste:omie-real -- --anexo=<PDF de 94 bytes no scratchpad>` → os mesmos + "anexo ✔ anexo-teste.pdf (94 bytes) legível" — **RESULTADO: OK**.

## Mutações (desligar a regra faz o teste falhar)

| # | Mutação | Resultado |
|---|---|---|
| M1 | pedido fora da consulta do RAG | 1 falha (resolução a); e o exemplo `resolver.sucesso-pedido-de-revisao` falha no teste de contrato |
| M2 | ramo do código confirmado desligado | 6 falhas (resolução + rotas) |
| M3 | sem `max(500)` no `pedidoDeRevisao` | 1 falha (rotas d) |
| M4 | adapter ignora `fileName` | 1 falha (rotas c) |
| M5 | wiring não repassa `nome` ao adapter | 1 falha (rotas c) |
| M6 | resposta sem `nome` do anexo | 3 falhas (lançamento a/a2, rotas d) |
| M7 | teste real manda o `/lancar` sem o anexo | 2 falhas (teste-omie-real) |
| M8 | 1 byte a mais na cópia do `crm-n1` | falha "mesmos arquivos, mesmo conteúdo" |

Todas restauradas; suítes verdes depois de cada restauração.

## Verificação de fim de linha (financeiro-tria)

- Nenhum dos arquivos tocados está entre os 89 sujos de EOL; para cada um, CRs em `HEAD` = CRs no working tree = 0 (conferido antes de cada commit).
- `git add` sempre com caminhos explícitos; `git diff --cached --stat` de cada commit listou só os arquivos da Task (4, 5 e 8 arquivos).
- Depois dos três commits: `git status --porcelain` = 89 linhas, todas ` M` (os de EOL); nada não rastreado.
- No crm-n1-integracao, os 6 arquivos também têm 0 CR em HEAD e no working tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correção] Código confirmado com plano de contas inalcançável**
- **Found during:** Task 1
- **Issue:** o plano definia só "existe" e "não existe"; com `ListarCategorias` vazio (sem credencial), "não existe" diria algo falso e "resolvida" aceitaria sem validar.
- **Fix:** `revisar` com "O plano de contas do Omie está indisponível — o código X não pôde ser validado." (mesma regra do ramo do RAG). Teste (c2); pane na leitura segue transitória (c3).
- **Commit:** `d462f6e`

**2. [Rule 1 - Correção] Código dos exemplos v1.1 trocado de 2.04.03 para 2.08.05**
- **Found during:** Task 3 (ensaio real)
- **Issue:** o ensaio mostrou que 2.04.03 é "Contas de Consumo" no Omie da Tria; o exemplo o chamava de "Tarifas bancárias".
- **Fix:** 2.08.05 inventado nos três exemplos e no cenário, antes de copiar para o crm-n1.
- **Commit:** `5a65e5b`

**3. [Detalhe] README do contrato atualizado junto**
- `contratos/contas-a-pagar-v1/README.md` faz parte da matriz copiada (o teste de hash compara a pasta inteira); ganhou a seção "v1.1 (aditiva)" e as URLs `exemplo.invalid` em "Dados". Não estava listado nominalmente, mas a pasta sim.

**4. [Detalhe] Prova de (c) da Task 2 sem tocar `omie-falso.ts`**
- O `criarServidorOmieFalso` já registrava `cNomeArquivo` e o corpo recebido; o caso novo em `contas-a-pagar-routes.test.ts` usa o `OmieAdapter` real sob `construirDepsDeEscritaReais` e abre o zip (`JSZip.loadAsync`) para conferir o nome de dentro. `testing/omie-falso.ts` não foi alterado.

**5. [Detalhe] `anexos[""]` agora é 400**
- `z.string().min(1)` (texto do plano) endurece a v1 num caso degenerado; documentado no commit e no §7 do contrato. A ponte ainda não manda anexos, então nenhum chamador muda.

**6. [Detalhe] Id do anexo não aparece no relato**
- O plano pedia "se o Omie não apagar o anexo com o título, registrar o id do anexo". A resposta do `/lancar` não carrega o `nIdAnexo` (contrato), e o adapter não tem `ListarAnexo`. O relato diz em que título o anexo entrou e que o Omie o apaga com o título; conferir que sumiu fica para o checkpoint 06-06 (visual no Omie).

**Nenhum teste existente editado:** as únicas linhas removidas nos arquivos de teste são imports (`import test` → `import test, { describe }`, e imports acrescidos) e, em `contas-a-pagar-contrato.test.ts`, o corpo de `montarDeps` (as portas por cenário, com o mesmo padrão de antes para os 16 exemplos v1). Nenhuma asserção existente mudou.

## Requisitos

RES-03 e RES-04 **não** foram marcados como completos: os dois pedem a ponte (06-03: mandar `codigoCategoriaConfirmado` e as URLs assinadas com o nome) e RES-04 pede a prova no Omie real (`teste:omie-real --lancar --anexo`, checkpoint 06-06 com autorização do dono). Este plano entrega a metade do backend de cada um.

## Known Stubs

Nenhum.

## Verificação bloqueada

Nenhuma. O comando `cd apps/api && DATABASE_URL= npx vitest run src/automacoes/contrato-contas-a-pagar.test.ts` rodou sem recusa.

Não rodado de propósito:
- `npm run check` inteiro no crm-n1-integracao (inclui a suíte inteira de `apps/api`, que estoura o watchdog do agente): rodados no lugar `npm run typecheck` (EXIT 0), o teste de contrato do consumidor e `verificar:contratos`. Nenhum arquivo de `apps/web` ou `packages/dominio` foi tocado.
- `npm run teste:omie-real -- --lancar --anexo=<PDF>` — o lançamento real é o checkpoint de 06-06 e precisa da autorização explícita do dono. Comando para ele, de dentro de `financeiro-tria/automation`: `npm run teste:omie-real -- --lancar --anexo=<caminho de um PDF pequeno>`.

## Next Phase Readiness

- **06-03 (ponte):** `corpoLancarDe` passa a mandar `codigoCategoriaConfirmado` (de `conferencia.origin.lancamento.codigo`) e `anexos: [{ url: <URL assinada>, nome: WorkspaceFile.name }]`; no Resumo revisado, `/resolver` com `pedidoDeRevisao`. A resposta traz `anexos[].{ok, erro, nome}` para o texto "anexos {ok} de {total}" / "• {nome}: não subiu ({erro})". Com código fora do plano o `/lancar` responde `422 REGRA_DE_DOMINIO` com `details.motivo` "Código X não existe no plano de contas do Omie.".
- **06-06 (checkpoint do dono):** `teste:omie-real --lancar --anexo=<PDF>` — confirmar no Omie que o anexo aparece com o nome e que some com a exclusão do título.

## Self-Check: PASSED

- FOUND: os 3 exemplos novos nos dois repositórios (`diff -r` vazio), `06-02-SUMMARY.md`
- FOUND: `d462f6e`, `24ef256`, `5a65e5b` (financeiro-tria), `14b9734` (crm-n1-integracao)

---
*Phase: 06-conferencia-do-resumo-e-anexos*
*Completed: 2026-09-29*
