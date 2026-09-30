---
phase: 06-conferencia-do-resumo-e-anexos
plan: 08
subsystem: financeiro-tria/automation (contas-a-pagar /resolver e /lancar) + contrato contas-a-pagar-v1
tags: [gap-closure, contrato-v1.2, omie, categoria, idempotencia, postgrest]
requires: ["06-07"]
provides:
  - "codigoCategoriaConfirmado só resolvida se despesa, folha e ativa no ListarCategorias (fin:CR-02), provado no Omie real"
  - "/lancar confere o título existente (5 campos) antes de reaproveitar; 422 TITULO_EXISTENTE_DIVERGENTE com nomes de campo (crm:CR-02, fin:WR-07)"
  - "reaproveitado devolve o dePara lido do título (deParaDoTitulo)"
  - "contaConfirmada no /lancar; 422 CONTA_DIVERGENTE com conferida/resolvida (crm:WR-09)"
  - "filtroOrDaBuscaPorTexto: o texto livre não muda a forma do .or() (fin:IN-01)"
  - "Contrato v1.2 completo nos dois repositórios, hash igual"
affects: [06-12, 06-15]
tech-stack:
  added: []
  patterns:
    - "Conferência pura (camposDivergentes) separada da decisão (lancarContaAPagar)"
    - "details do envelope .strict() só com identificador, nomes de campo e rótulos — nunca valores"
    - "Leitura só quando precisa: deParaDoTitulo não lê o catálogo no caso igual"
key-files:
  created:
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-titulo-existente.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-titulo-existente.test.ts
    - ../financeiro-tria/automation/src/adapters/supabase-categorias.test.ts
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.erro-422-titulo-existente-divergente.json
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.erro-422-conta-divergente.json
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.sucesso-conta-confirmada.json
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/resolver.sucesso-codigo-confirmado-nao-despesa.json
    - contratos/contas-a-pagar-v1/lancar.erro-422-titulo-existente-divergente.json
    - contratos/contas-a-pagar-v1/lancar.erro-422-conta-divergente.json
    - contratos/contas-a-pagar-v1/lancar.sucesso-conta-confirmada.json
    - contratos/contas-a-pagar-v1/resolver.sucesso-codigo-confirmado-nao-despesa.json
  modified:
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-erros.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts
    - ../financeiro-tria/automation/src/adapters/omie.ts
    - ../financeiro-tria/automation/src/adapters/supabase.ts
    - ../financeiro-tria/automation/src/testing/omie-falso.ts
    - ../financeiro-tria/automation/src/tenants/tria/teste-omie-real.ts
    - ../financeiro-tria/automation/scripts/teste-omie-real.ts
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/README.md
    - contratos/contas-a-pagar-v1/README.md
    - apps/api/src/automacoes/contrato-contas-a-pagar.test.ts
    - docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md
key-decisions:
  - "Regex de codigoCategoriaConfirmado mantida em ^\\d(\\.\\d{2}){2,3}$: a defesa é a regra semântica (motivo legível), não a forma (400 opaco)"
  - "PortaDeLancamentoOmie.consultarTitulo é OBRIGATÓRIA (não opcional): todos os objetos de porta montados à mão nos testes ganharam a linha, inclusive 5 que o plano não listava"
  - "EsperadoDoTitulo com codigoCategoria/idContaCorrente vazio ('') também não é comparado, além de undefined"
  - "deParaDoTitulo com título sem código de categoria mantém a categoria da resolução (não há o que ler)"
  - "filtroOrDaBuscaPorTexto escolhe as 4 palavras como hoje e só depois limpa e descarta as curtas"
metrics:
  duration: "~30 min"
  completed: 2026-09-30
  tasks: 4
  files: 29
---

# Phase 6 Plan 08: /resolver e /lancar só aceitam o que é certo — Summary

O `codigoCategoriaConfirmado` só sai `resolvida` quando a linha do `ListarCategorias` é de despesa, não totalizadora e ativa, e o ENSAIO no Omie real provou que as três flags existem em produção. O `/lancar` confere o título que já existe (valor, vencimento, categoria, documento do fornecedor, conta corrente) antes de reaproveitar e antes de qualquer anexo, e devolve o `dePara` lido dele. Ele também recusa a conta corrente que o Financeiro não conferiu (`contaConfirmada`). O texto livre do pedido de ajuste não muda mais a forma do `.or()` do PostgREST. O contrato v1.2 fica completo nos dois repositórios, com hash igual.

## Commits

| Repositório | Hash | Task | Mensagem |
|---|---|---|---|
| financeiro-tria | `317feac` | 1 | feat(contas-a-pagar): código de categoria conferido só de despesa, folha e ativa (06-08) |
| financeiro-tria | `9f42ef5` | 2 | feat(contas-a-pagar): ler o título que o Omie tem — consultarTitulo, camposDivergentes e deParaDoTitulo (06-08) |
| financeiro-tria | `87916df` | 3 | feat(contas-a-pagar): /lancar só reaproveita o título igual e só lança na conta conferida (06-08) |
| financeiro-tria | `5ceca48` | 4 | feat(contas-a-pagar): escape do filtro de texto e exemplos canônicos v1.2 da conferência (06-08) |
| crm-n1-integracao | `63a2cc8` | 4 | feat(06-08): contrato contas-a-pagar v1.2 — título e conta conferidos, categoria só de despesa |

Os 4 commits do `financeiro-tria` só contêm arquivos de `automation/` (conferido com `git show --name-only`). Nenhum dos 89 arquivos de fim de linha entrou em commit. A contagem de CR de cada arquivo tocado é igual à do `HEAD` (todos 0). No fim, `git status --porcelain | grep -v '^ M'` e `git diff --ignore-cr-at-eol --stat` saem vazios. Nenhum `git push`.

## Testes

| Onde | Antes | Depois |
|---|---|---|
| `financeiro-tria/automation` `npm test` (isolado) | 615/615 | 671/671 (+56) |
| `npx tsc --noEmit -p .` e `-p tsconfig.scripts.json` | verde | verde (ao fim de cada task) |
| crm-n1 `contrato-contas-a-pagar.test.ts` + `-ponte.test.ts` (`DATABASE_URL=`) | 46 | 54/54: +6 casos v1.2 (06-08) e +2 exemplos de erro no `it.each` genérico, sem editar o laço. O `describe` de hash rodou (não foi pulado). |
| crm-n1 `npm run typecheck` | — | EXIT 0 |
| `diff -r` das duas pastas `contratos/contas-a-pagar-v1/` | — | vazio |
| Aceite "exemplos de erro sem valor do pedido" (`node -e` do plano) | — | sai 0 |

Por task no `financeiro-tria`: 615 → 626 (T1) → 643 (T2) → 663 (T3) → 671 (T4).

## Gate no Omie real (ENSAIO, só leituras)

`npm run teste:omie-real -- --codigo-confirmado=2.04.03`, rodado ANTES do commit da Task 1:

```
Teste real do lançamento no Omie — ENSAIO (só leituras)
  Centro de Custo: TRIA | Categoria: Contas de consumo (código conferido 2.04.03) | Valor: R$ 1.00 | Vencimento: 2026-10-10
  Código de integração: tria:contas-a-pagar:tst_260930102358

  ✔ credencial — Credencial Omie do Centro de Custo "TRIA" presente.
  ✔ fornecedor — Já cadastrado no Omie: SAFE2PAY INSTITUICAO DE PAGAMENTO LTDA (31.037.***/****-78, código 5456746171).
  ✔ resolver — Categoria "Contas de consumo" → código conferido 2.04.03: Contas de Consumo (validado no plano de contas do Omie, sem o RAG).
  ✔ consulta prévia — tria:contas-a-pagar:tst_260930102358 (36 caracteres) ainda não existe no Omie.
  ✔ ensaio — Nada foi gravado no Omie. Rode com --lancar para o teste completo (lança R$ 1.00, confere e exclui).

  RESULTADO: OK — todos os passos passaram.
```

O `ListarCategorias` de produção traz as três flags (`conta_despesa`, `totalizadora`, `conta_inativa`). Se não trouxesse, a folha de despesa `2.04.03` teria saído `revisar` com "não informou…". A regra, portanto, não trava lançamento de produção.

Informativo, `-- --codigo-confirmado=1.01.01`: `✖ resolver — … (revisar: Código 1.01.01 não é uma categoria de despesa — uma Conta a pagar só aceita categoria de despesa.) — o /lancar recusaria.` `RESULTADO: FALHOU`, como esperado.

No fim do plano, `npm run teste:omie-real` sem opção (ENSAIO) deu `RESULTADO: OK`. O `/resolver` pelo RAG deu `2.04.03`, similaridade 0.46. O caminho do RAG não mudou.

Nenhuma recusa do classificador. Nada foi gravado no Omie.

## As mutações (aplicadas, rodadas e restauradas; tudo verde de novo depois)

O script (`scratchpad/exec-06-08/mutar.py`) restaura os arquivos num `finally` e mata o grupo de processos se o teste pendurar. Nenhuma rodada pendurou.

| # | Mutação | O que falhou |
|---|---|---|
| M1 | sem `despesa === false` | resolução v1.2 (a)(b)(f)(g); rotas v1.2 (i); contrato do produtor `resolver.sucesso-codigo-confirmado-nao-despesa` |
| M2 | sem `totalizadora === true` | resolução (c)(g); rotas "4 níveis também"; teste-omie-real (j) totalizador |
| M3 | sem `inativa === true` | resolução (d) |
| M4 | flag ausente tratada como ok | resolução (e)(g) |
| M5 | `flagDoOmie` sem `trim`/maiúsculas | resolução (f) |
| M6 | regra aplicada também ao RAG | resolução (h) e mais 32 casos do caminho do RAG (rotas, teste-omie-real) |
| M7 | `teste-omie-real` não manda `codigoCategoriaConfirmado` | teste-omie-real (j) ×2 |
| M8a | `camposDivergentes` ignora valor | título-existente (b) ×3; lançamento v1.2 (a)(b)(f); rotas (h); composição (o) |
| M8b | … ignora vencimento | título-existente (b)(c); lançamento (a); rotas (h) |
| M8c | … ignora categoria | título-existente (b); lançamento (a)(c); rotas (h) |
| M8d | … ignora fornecedor | título-existente (b); lançamento (a); rotas (h) |
| M8e | … ignora conta corrente | título-existente (b); lançamento (a); rotas (h) |
| M9 | campo ausente no título tratado como igual | título-existente (b) "campo do TÍTULO ausente"; lançamento v1.2 (a2) (ver desvio 3) |
| M10 | `details` com o valor do título (`valorDoTitulo`: lançamento + construtor + `responderErro`) | lançamento (a); rotas (h); composição (o); contrato do produtor `lancar.erro-422-titulo-existente-divergente`; consumidor: com `valorDoTitulo` na cópia do exemplo, falham o caso v1.2 (06-08) e o hash |
| M11 | `dePara` do reaproveitado = o da resolução | título/resolução (e)(e)(f); lançamento (e) |
| M12 | `deParaDoTitulo` sempre relê o catálogo | resolução v1.2 dePara (d)(e)(f) (contagem de leituras) |
| M13 | reconsulta da inclusão sem conferência | lançamento (f) |
| M14 | `subirAnexos` antes da conferência (passo 4) | lançamento (a)(d); composição v1.2 anexos (e); contrato `lancar.sucesso-reaproveitado-com-anexos` |
| M14b | o mesmo no passo 8 | lançamento (f), v1.1 (a)(e), v1.2 (g); composição anexos ×4 |
| M15 | sem o passo 2b | lançamento (i)(k)(l)(m); rotas (i); contrato `lancar.erro-422-conta-divergente` |
| M16 | passo 2b depois da consulta | lançamento (i)(k)(l)(m) (`consultarPorCodigoDeIntegracao` chamado); rotas "sem credencial -> 503" |
| M17 | `contaConfirmada` aceita no `/resolver` | rotas v1.2 (n) |
| M18 | `filtroOrDaBuscaPorTexto` sem a remoção | supabase-categorias (a) ×3 |
| M19 | 1 byte a mais no README da cópia do crm-n1 | consumidor "mesmos arquivos, mesmo conteúdo" |

## Edições em testes existentes

Não há asserção afrouxada. Cada edição abaixo existe porque a regra nova torna falsa a pré-condição do teste.

financeiro-tria:
- **Task 1 (autorizadas pelo plano):**
  - `contas-a-pagar-resolucao.test.ts` `PLANO_COM_O_CONFIRMADO`, `contas-a-pagar-lancamento.test.ts` `PLANO_COM_O_CONFIRMADO` e `contas-a-pagar-contrato.test.ts` `TARIFAS_BANCARIAS`: cada linha ganhou `conta_despesa: "S", totalizadora: "N", conta_inativa: "N"`.
  - `contas-a-pagar-routes.test.ts`, caso "4 níveis também": `2.02.98` passou a `totalizadora: "S"`, saiu da lista `resolvida` e virou um `revisar` asserido no mesmo caso. `2.02.98.01` continua `resolvida`, e `2.06.01` (folha de 3 níveis) entrou no lugar.
  - `teste-omie-real.test.ts`: `comCenario` ganhou o parâmetro opcional `categorias`. O padrão é o plano de antes.
- **Task 2:** a linha `consultarTitulo: portas.lancamento.consultarTitulo`, só para compilar, nos 8 objetos `PortaDeLancamentoOmie` montados à mão. O plano listava 3: lançamento (c) e (s), e o ramo `cenario.incluir` do `montarDeps` do contrato. Os outros 5 são do mesmo tipo (ver desvio 1): lançamento (p), (q) e v1.2 (g); rotas "recusa do Omie no IncluirContaPagar -> 422 OMIE_RECUSOU…" e "pane do Omie no IncluirContaPagar -> 500…".
- **Task 3:**
  - `contas-a-pagar-lancamento.test.ts` (s) (autorizada) e v1.2 (g) (ver desvio 2): `consultarTitulo` devolve `tituloDoPedido(ENTRADA_BASE)`. É um helper novo, derivado do próprio pedido, com a categoria `2.06.01` e a conta `111` que o catálogo falso padrão resolve. Entraram dois imports (`onlyNumbers`/`toBRDateFromAny`, tipo `TituloExistente`).
  - `contas-a-pagar-composicao.test.ts` "reaproveitado nos quatro caminhos": os `servidor.omie.incluir` dos caminhos (1), (3) e (4) (duas linhas, uma dentro do laço) gravam também `...TITULO_DO_CORPO_LANCAR`. A constante é nova e derivada de `CORPO_LANCAR` (valor e vencimento), com `2.06.01`/`111` do cenário. As asserções não mudaram.
  - `contas-a-pagar-contrato.test.ts` cenário `lancar.sucesso-reaproveitado`: o `preparar` grava o título com os dados do exemplo (1234.56, 15/10/2026, `2.06.01`, conta 111, o fornecedor do CNPJ de exemplo). O ARQUIVO `lancar.sucesso-reaproveitado.json` não mudou (`git diff --stat` vazio). O cenário `…-com-anexos` de 06-07 já nascia completo.
- **Task 4:** só acréscimos no `CENARIOS` do contrato (4 cenários e a constante `RECEITA_DE_SERVICOS`).

crm-n1: nenhuma edição de caso existente. Só entrou o `describe("contrato v1.2 (06-08) — título e conta conferidos")` no fim do arquivo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — compilação] `consultarTitulo` em 5 portas montadas à mão que o plano não listava**
- **Encontrado em:** Task 2 (o `tsc` acusou 8 objetos, e o plano listava 3).
- **Problema:** a porta nova é obrigatória. Deixá-la opcional enfraqueceria a conferência: sem ela, o `/lancar` não teria como conferir o título.
- **Correção:** a mesma linha que o plano autoriza (`consultarTitulo: portas.lancamento.consultarTitulo`), nos outros 5 objetos do mesmo tipo: lançamento (p), (q) e v1.2 (g); rotas "recusa do Omie…" e "pane do Omie…". Não mudou nenhuma asserção.
- **Commit:** `9f42ef5`.

**2. [Rule 3 — pré-condição] lançamento v1.2 (g) de 06-07 com o mesmo tratamento do (s)**
- **Encontrado em:** Task 3 (4 falhas, exatamente as previstas: (s), composição, contrato reaproveitado e v1.2 (g)).
- **Problema:** o (g) nasceu em 06-07, depois de o plano ser escrito, com a mesma pré-condição do (s): um `incluir` que devolve `reaproveitado: true` para um id que não existe no falso. Com a conferência, esse título tem de existir e ser igual.
- **Correção:** a mesma edição autorizada para o (s): `consultarTitulo` devolve `tituloDoPedido(ENTRADA_BASE)`. A intenção do caso (os anexos passam pelo `ListarAnexo` e só o que falta sobe) e as asserções ficaram iguais.
- **Commit:** `87916df`.

**3. [Rule 2 — mutação M9 sobrevivia na Task 3] Caso novo lançamento v1.2 (a2)**
- **Problema:** o plano quer que a M9 falhe também na Task 3 (a), mas os cinco casos de (a) têm todos os campos no título. A M9 só caía no teste puro da Task 2.
- **Correção:** o caso (a2) testa um título pré-criado só com o código de integração e o fornecedor (o "título antigo"). Ele tem de sair `TITULO_EXISTENTE_DIVERGENTE` com `["valor", "vencimento", "categoria", "contaCorrente"]`. A M9 agora falha nele.
- **Commit:** `87916df`.

**4. [Acceptance] `conferirTituloExistente` como função declarada**
- O aceite conta `conferirTituloExistente(` ≥ 3 (a definição mais as duas chamadas). Por isso ela é `async function conferirTituloExistente(payableId)` dentro de `lancarContaAPagar` (um closure), e não uma `const` com arrow.

### Observações (não são desvios)

- M16 não é visível no exemplo `lancar.erro-422-conta-divergente`. A mutação mantém o passo 2b ANTES da conferência do título, então a resposta é a mesma. Quem a pega são os espiões de consulta de (i), (k), (l) e (m), como o plano prevê. O comentário do cenário diz o que ele prova: a conta vem antes do título.
- `EsperadoDoTitulo`: além de `undefined`, `""` também conta como "não comparar" na categoria e na conta. Um pedido não tem como esperar "vazio".

## Recado para 06-12 (a ponte)

- Mandar `contaConfirmada` = `origin.lancamento.conta` (o `dePara.conta` que a Conferência guardou) em todo `/lancar` depois da Conferência. `lancar.sucesso-conta-confirmada` é a forma exata, junto com `codigoCategoriaConfirmado`.
- `422 TITULO_EXISTENTE_DIVERGENTE`: usar `TEXTOS_DA_CONFERENCIA.tituloDivergente(payableId, campos)` com `details.payableId`/`details.campos`. Os campos são nomes entre `valor`, `vencimento`, `categoria`, `fornecedor` e `contaCorrente`. É permanente: a pessoa exclui ou ajusta o título no Omie.
- `422 CONTA_DIVERGENTE`: usar `contaDivergente(conferida, resolvida)` com `details.conferida`/`details.resolvida`. É permanente: conferir o Resumo de novo.
- Os motivos novos da categoria conferida chegam como `422 REGRA_DE_DOMINIO` (no `/lancar`) ou `revisar` (no `/resolver`), com o texto em `details.motivo` ou em `motivo`: "não é uma categoria de despesa", "é uma categoria totalizadora", "está inativo no plano de contas", "não informou se o código … é de despesa, totalizador ou inativo". O "não existe" é o de 06-02.
- Até 06-12, os dois códigos novos chegam à ponte atual como recusa permanente comum, com `details.motivo`. O laço genérico do consumidor já prova isso.

## Known Stubs

Nenhum.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: leitura-nova | ../financeiro-tria/automation/src/adapters/omie.ts | `ConsultarCliente` novo (só leitura), no caminho reaproveitado, pelo rate limiter do adapter — já coberto por T-6-08-07 (accept) |

Não há superfície nova além do `<threat_model>`. Os rótulos de conta em `details.conferida`/`details.resolvida` passam por `sanitizarMotivo` (T-6-08-04, accept).

## Self-Check: PASSED

- Arquivos criados existem: `contas-a-pagar-titulo-existente.ts`/`.test.ts`, `supabase-categorias.test.ts` e os 4 exemplos nas duas pastas (`diff -r` vazio).
- Commits existem: `317feac`, `9f42ef5`, `87916df`, `5ceca48` (financeiro-tria) e `63a2cc8` (crm-n1-integracao).
