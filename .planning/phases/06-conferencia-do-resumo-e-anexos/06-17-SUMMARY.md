---
phase: 06-conferencia-do-resumo-e-anexos
plan: 17
subsystem: financeiro-tria/automation (/lancar: política de anexos, prazo, fila por conta, dePara do reaproveitado) + contrato e roteiro no crm-n1
tags: [gap-closure, lancar, anexos, ssrf, storage, prazo, idempotencia, dePara, fin2-wr-01, fin2-wr-02, fin2-in-01, fin2-in-02, fin2-in-03, fin2-in-05, fin2-in-06, fin2-in-07, fin2-in-09]
requires:
  - phase: 06-07
    provides: "política de anexos (hostDoAnexoPermitido, subirAnexos, CODIGOS_DO_ANEXO, orçamento de 35 s)"
  - phase: 06-08
    provides: "conferência do título reaproveitado, deParaDoTitulo, motivos do CR-02 em resolverCategoriaConfirmada"
  - phase: 06-16
    provides: "reprovacaoDaCategoriaNoPlano (reusada no deParaDoTitulo)"
provides:
  - "contas-a-pagar-anexos: PREFIXOS_DO_STORAGE, PoliticaDeAnexos.prefixosDoCaminho (obrigatório), hostDoAnexoPermitido com host E caminho, política antes do jaExistia, ListarAnexo só quando algum anexo passa, ErroDoOmie de infraestrutura como ANEXO_TEMPO_ESGOTADO (codigoDaFalhaDaLeitura), subirAnexos({ orcamentoMs, agora })"
  - "contas-a-pagar-lancamento: PRAZO_DO_LANCAR_MS (50 s), deps opcionais relogio/prazoDoLancarMs/lancamentosEmVoo, invólucro lancarContaAPagar com fila em processo por codigoLancamentoIntegracao"
  - "contas-a-pagar-resolucao: motivoDaReprovacaoNoPlano (textos do CR-02 byte a byte), deParaDoTitulo que marca revisar"
  - "scripts/teste-omie-real: escutarNoLoopback(rota)"
  - "contrato contas-a-pagar-v1 (README e exemplo lancar.sucesso-anexos-nomeados) idêntico nos dois repositórios"
affects: [06-20]
tech-stack:
  added: []
  patterns:
    - "Política de URL por host exato E prefixo do pathname já normalizado pelo WHATWG URL (a travessia é resolvida antes da comparação)"
    - "Orçamento de uma etapa como o menor entre o da política e o que sobra do prazo da requisição, com relógio injetável"
    - "Fila em processo por chave: quem chega espera a promessa em voo; a promessa guardada apaga a própria entrada antes de assentar; quem viu rejeitar não espera de novo aquela promessa"
key-files:
  created: []
  modified:
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-anexos.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-anexos.test.ts
    - ../financeiro-tria/automation/src/tenants/tria/teste-omie-real.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.test.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.test.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-routes.test.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-composicao.test.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-contrato.test.ts
    - ../financeiro-tria/automation/scripts/teste-omie-real.ts
    - ../financeiro-tria/automation/README.md
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/README.md
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json
    - contratos/contas-a-pagar-v1/README.md
    - contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json
    - docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md
    - docs/08-migracao-financeiro/08-roteiro-de-producao-pos-correcoes.md
key-decisions:
  - "A URL string do exemplo canônico lancar.sucesso-anexos-nomeados passou a ser do Storage (/storage/v1/object/public/anexos/comprovante.pdf), nos dois repositórios: a premissa do plano (todas as URLs dos exemplos já eram do Storage) não valia para ela, e um exemplo que mostra um anexo fora do Storage subindo contradiria a regra nova. Mesmo nome relatado; a ponte não muda"
  - "Na falha do ListarAnexo, o anexo fora da política continua ANEXO_HOST_NAO_PERMITIDO (a política decide antes de tudo); só os anexos na política recebem o código da falha da leitura"
  - "motivoDaReprovacaoNoPlano tem um quinto tipo, 'indisponivel' (o texto que resolverCategoriaConfirmada já usava para o plano vazio): no deParaDoTitulo, plano vazio vira revisar com esse motivo, em vez de afirmar 'não existe no plano'"
  - "O invólucro toma o instante da entrada antes de qualquer espera; quem esperou e viu a primeira rejeitar roda a sua com o prazo contado desde a própria entrada"
  - "I1 usa httpStatus 500 no caso REDUNDANT, para que o teste dependa do padrão de limite de consumo e não só da ausência de status"
requirements-completed: [RES-04]
metrics:
  duration: "~75 min"
  completed: 2026-09-30
---

# Phase 6 Plan 17: /lancar com prazo desde a entrada, anexos só do Storage e reaproveitado honesto — Summary

**O `/lancar` agora baixa anexo só de `/storage/v1/object/` do host permitido. O orçamento dos anexos passou a ser `min(35 s, 50 s − decorrido)` desde a entrada. A repetição da mesma conta espera a execução que ainda está em voo. A queda do Omie sai `ANEXO_TEMPO_ESGOTADO`, e o `dePara` de um título reaproveitado marca `revisar` quando o plano de contas recusa a categoria.**

## Performance

- **Duração:** ~75 min
- **Concluído:** 2026-09-30
- **Tasks:** 3 de 3
- **Arquivos:** 14 no financeiro-tria, 4 no crm-n1

## Commits

**financeiro-tria (branch `main`, BASE `c535dee`, sem push):**

| Task | Commit | O quê |
|---|---|---|
| 1 | `b3b4278` | Storage pelo caminho, política antes do `jaExistia`, queda do Omie como `ANEXO_TEMPO_ESGOTADO` (8 arquivos, com o exemplo JSON) |
| 2 | `30a28fb` | Prazo do `/lancar` desde a entrada, fila por conta, `dePara` do título conferido no plano, `listen` seguro do script (6 arquivos) |
| 3 | `6767be1` | README do `automation/` e README do contrato (2 arquivos) |

**crm-n1-integracao (branch `integra-frontend-main`, sem push):**

| Task | Commit | O quê |
|---|---|---|
| 3 | `f716460` | `contratos/contas-a-pagar-v1/README.md`, `contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json`, doc 05 e roteiro (commit por pathspec; `git show --stat HEAD` só com esses 4) |

## O que foi feito

### Task 1: o caminho do Storage, a política antes do `jaExistia` e a queda do Omie
- `PREFIXOS_DO_STORAGE = ["/storage/v1/object/"]`. `PoliticaDeAnexos.prefixosDoCaminho` é obrigatório, e o `tsc` apontou cada política montada à mão. A política de produção usa `PREFIXOS_DO_STORAGE`. A do `teste-omie-real` usa `["/"]` e é a única assim fora de teste (`grep` = 1).
- `hostDoAnexoPermitido` exige que o `pathname` normalizado comece com o prefixo (`startsWith`, sensível a maiúsculas). `/rest/v1`, `/auth/v1`, `/functions/v1`, `/graphql/v1`, `objectX`, `//storage…`, `/x/storage…`, `/STORAGE…`, `../` e `%2e%2e` são recusados.
- `subirAnexos` segue a ordem host+caminho → já no título → orçamento → envio. O `ListarAnexo` só é lido quando o título já existia e algum anexo passa na política.
- `codigoDoErroDoAnexo`: um `ErroDoOmie` de infraestrutura vira `ANEXO_TEMPO_ESGOTADO` e um de negócio vira `ANEXO_OMIE_RECUSOU`. A leitura usa `codigoDaFalhaDaLeitura`. `CODIGOS_DO_ANEXO` é idêntico ao de BASE.
- Testes novos: U1, U2, U4, J1, J2, I1 e I2 em `contas-a-pagar-anexos.test.ts`, e C1 em `contas-a-pagar-composicao.test.ts`. O C1 usa um servidor próprio que conta requisições por caminho: `/rest/v1/solicitacoes` recebeu 0 e o caminho do Storage recebeu 1.

### Task 2: prazo, fila, `dePara` e `listen`
- `subirAnexos({ orcamentoMs, agora })` usa como limite o menor entre `politica.orcamentoTotalMs` e `orcamentoMs`, medido pelo `agora`. Sem esses campos, o comportamento é o de antes.
- `PRAZO_DO_LANCAR_MS = 50_000`. As duas chamadas a `subirAnexos` passam `orcamentoMs = prazo − (relógio − entrada)`.
- `lancarContaAPagar` virou um invólucro e o corpo foi para `lancarUmaVez`, sem mudar nenhuma regra. O invólucro:
  - usa como chave `codigoDeIntegracaoDaConta(taskId)`;
  - espera a promessa em voo e devolve o mesmo resultado;
  - se a promessa rejeitar, volta a olhar o `Map`;
  - registra a execução sem `await` entre olhar e registrar;
  - apaga a entrada no `finally` de dentro da promessa guardada.
- `motivoDaReprovacaoNoPlano(codigo, tipo)` guarda os textos do CR-02, e `resolverCategoriaConfirmada` passou a usá-la. No ramo `!categoriaIgual`, `deParaDoTitulo` marca `revisar` com o motivo quando o código está fora do plano ou `reprovacaoDaCategoriaNoPlano(linha)` o reprova. Linha sem flags continua `resolvida`.
- `scripts/teste-omie-real.ts` sobe o servidor com `const { port } = await escutarNoLoopback(rota)`: `rota.listen(` aparece 0 vezes e `escutarNoLoopback(rota)` 1 vez.
- Testes novos: D1, D2, D3, S1, S2, S3 e R3 em `contas-a-pagar-lancamento.test.ts`, com relógio falso e `Map` próprio. R1, R2 e R2b ficam em `contas-a-pagar-resolucao.test.ts`. O R2 compara cada motivo, byte a byte, com o `/resolver` do código conferido.

### Task 3: documentos
- `automation/README.md`:
  - o caminho do Storage na tabela de segurança e no parágrafo da variável;
  - os 50 s e a fila por conta;
  - o que cada código quer dizer;
  - o `cCodIntAnexo` (fin2:IN-07);
  - a seção nova "Mudanças aceitas nos tenants legados (Fase 6)" (fin2:IN-03).
- Contrato v1.2 (README): o caminho, o orçamento, a fila, os códigos, a política antes do `jaExistia`, o `cCodIntAnexo`, a conta pelo rótulo como limite conhecido (fin2:IN-06) e o `revisar` no `dePara` do reaproveitado (fin2:IN-05). O arquivo foi copiado com `cp` para o crm-n1, e `diff -r` das duas pastas sai vazio.
- Doc 05:
  - o bloco "Desde 06-17": caminho e porquê, prazo e fila;
  - a tabela de códigos;
  - o parágrafo do `ListarAnexo`, com a política antes do `jaExistia` e o `cCodIntAnexo`;
  - o limite do rótulo em `contaConfirmada`;
  - o `dePara` do reaproveitado;
  - a frase do 06-17 no §7.
- Roteiro: a linha de `CONTAS_A_PAGAR_ANEXOS_HOSTS` diz que o valor continua só o hostname. Em "Decisões pendentes" entrou o item 11: dois anexos no mesmo título no Omie real (06-20). O script aceita hoje um só `--anexo`.

## Testes

- **`npm test` isolado no BASE `c535dee`:** 751 testes, 751 passando, 0 falhas.
- **`npm test` isolado no HEAD `6767be1`:** 769 testes, 769 passando, 0 falhas e 0 pulados. São 18 novos:
  - 7 em anexos (U1, U2, U4, J1, J2, I1, I2);
  - 1 na composição (C1);
  - 7 no lançamento (D1–D3, S1–S3, R3);
  - 3 na resolução (R1, R2, R2b).
- `npx tsc --noEmit -p .` e `-p tsconfig.scripts.json` passaram em cada task.
- **Teste do contrato do produtor:** 27 de 27. O exemplo `resolver.sucesso-codigo-confirmado-nao-despesa` continua passando sem mudança no JSON.
- **Consumidor no crm-n1** (`DATABASE_URL= npx vitest run src/automacoes/contrato-contas-a-pagar.test.ts src/automacoes/contrato-contas-a-pagar-ponte.test.ts`): 2 arquivos, 54 de 54. O `describe` de hash ("cópia verbatim da pasta do produtor") RODOU e passou; o reporter verbose mostra ✓ "mesmos arquivos, mesmo conteúdo".

## Mutações (script em `exec-06-17/`; cada uma restaurada com `git checkout -- <arquivo>` e conferida com `git diff --quiet`)

| Id | Mutação | Testes que falharam |
|---|---|---|
| M1 | `hostDoAnexoPermitido` sem o caminho (`return true`) | U1, U2, U4, C1 |
| M2 | `includes` no lugar de `startsWith` | U1 |
| M3 | `jaEstaNoTitulo` de volta antes da política | J1 |
| M4 | `listarNomes` sempre lido no reaproveitado | J2 |
| M5 | todo `ErroDoOmie` como `ANEXO_OMIE_RECUSOU` (envio e leitura) | I1, I2 |
| M6 | `subirAnexos` ignora `orcamentoMs` | D1, D2, D3 |
| M7 | `lancarContaAPagar` sem o `Map` compartilhado (um `Map` novo por chamada) | S1 (e S2) |
| M8 | a espera devolve também a rejeição da primeira | S2 |
| M9 | `deParaDoTitulo` volta a `resolvida` para código fora do plano | R1, (e) do 06-08 com o `fora` editado |
| M10 | `deParaDoTitulo` ignora `reprovacaoDaCategoriaNoPlano` | R2, R3 |
| M11 | um caractere a mais no texto "não é uma categoria de despesa" | R2, R3, (a), (b) e (g) do CR-02 em `contas-a-pagar-resolucao.test.ts`, e o exemplo `resolver.sucesso-codigo-confirmado-nao-despesa` |
| M12 | um byte a mais na cópia do README no crm-n1 | o `describe` de hash do crm-n1 ("mesmos arquivos, mesmo conteúdo"). Restaurado da cópia em `exec-06-17/`, com `diff -r` vazio |

## Testes existentes editados (só a lista fechada do plano)

- **Task 1:** a única mudança foi o campo NOVO `prefixosDoCaminho`, mais linhas de `import` novas acrescentadas em linha própria, sem alterar nenhuma existente.
  - `["/"]` em `POLITICA_DE_ANEXOS_DO_TESTE` de `contas-a-pagar-lancamento.test.ts` e de `contas-a-pagar-routes.test.ts`, no objeto-base do helper `politica` de `contas-a-pagar-anexos.test.ts` e nas duas políticas de loopback de `contas-a-pagar-composicao.test.ts`.
  - `PREFIXOS_DO_STORAGE` em `POLITICA_DE_ANEXOS_DOS_EXEMPLOS` de `contas-a-pagar-contrato.test.ts`.
  - Linhas removidas (`git diff -U0 BASE | grep '^-[^-]'`): só as três políticas de uma linha, cada uma trocada pela mesma linha com `prefixosDoCaminho`. Nenhuma asserção mudou.
- **Task 2:** mudou só a asserção de `fora` no caso "(e) resolvida com OUTRO código… código fora do plano" de `contas-a-pagar-resolucao.test.ts`, que agora espera `{ veredito: "revisar", nome: "Impostos", codigo: "9.09.09", similaridade: 0, motivo: "Código 9.09.09 não existe no plano de contas do Omie." }`. Entrou também uma linha de `import`. Em `contas-a-pagar-lancamento.test.ts`, 0 linhas removidas nesta task.
- `payment-automation-service.legado.test.ts` não tem diff (`git diff --stat c535dee..HEAD` vazio).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exemplo canônico com URL fora do Storage**
- **Found during:** Task 1, no teste do contrato do produtor.
- **Issue:** o plano supunha que todas as URLs de anexo dos exemplos eram `https://exemplo.invalid/storage/v1/object/sign/…`. Mas `lancar.sucesso-anexos-nomeados.json` tinha a `string` `https://exemplo.invalid/anexos/comprovante.pdf`, que sobe `ok: true`. Com `PREFIXOS_DO_STORAGE` na política dos exemplos, o teste do contrato falhou, e com razão: o exemplo contradizia a regra nova.
- **Fix:**
  - a URL virou `https://exemplo.invalid/storage/v1/object/public/anexos/comprovante.pdf` (mesmo último segmento, então o nome relatado é o mesmo);
  - a política dos exemplos ficou com `PREFIXOS_DO_STORAGE`, como o plano pede;
  - o JSON foi copiado para o crm-n1 com o README, e as duas pastas mudaram juntas (`diff -r` vazio);
  - o README do contrato e o §7 do doc 05 registram a troca.
- **Consequências fora do previsto:**
  - `git diff --stat BASE -- contratos` na Task 1 não saiu vazio (1 JSON);
  - o commit do crm-n1 leva 4 caminhos em vez de 3 (o quarto é a cópia do JSON, também deste plano; nenhum arquivo da trilha C);
  - os testes do consumidor (`-ponte.test.ts` e o de contrato) passaram sem mudança.
- **Files modified:** `automation/contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json` (financeiro-tria) e `contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json` (crm-n1).
- **Commits:** `b3b4278` e `f716460`.

**2. [Rule 2 - Correção] Plano de contas vazio no `dePara` do título**
- **Found during:** Task 2.
- **Issue:** com o `ListarCategorias` vazio, a regra literal ("linha ausente ⇒ inexistente") afirmaria "não existe no plano de contas", e ninguém conferiu isso.
- **Fix:** `motivoDaReprovacaoNoPlano` ganhou o tipo `"indisponivel"`, com o texto que `resolverCategoriaConfirmada` já usava (`O plano de contas do Omie está indisponível — o código <c> não pôde ser validado.`), e as duas funções o usam. O `grep -c 'motivoDaReprovacaoNoPlano('` dá 7 (≥ 5).
- **Commit:** `30a28fb`.

**3. [Rule 1 - Limpeza] Import órfão no script**
- **Issue:** trocar o `listen` cru por `escutarNoLoopback` deixou `import type { AddressInfo } from "node:net"` sem uso em `scripts/teste-omie-real.ts`.
- **Fix:** o import foi removido. É a única linha além das duas previstas no script.
- **Commit:** `30a28fb`.

## Verificação bloqueada

Nenhuma. Os três documentos do crm-n1 e a pasta `contratos/contas-a-pagar-v1/` estavam limpos no git (`git status --short` vazio) antes da edição. A trilha C (06-18/06-19) tinha em curso só `apps/web/…`, e o commit dela `c10d13f` entrou antes do meu `f716460` sem conflito. O índice estava vazio antes do `git add` por pathspec.

## Estado final dos repositórios

- **financeiro-tria:**
  - `git log c535dee..HEAD` mostra 3 commits;
  - `git status --short | wc -l` dá 89 (só os arquivos de fim de linha);
  - `git diff --ignore-cr-at-eol --stat` sai vazio;
  - a contagem de CR bate com a do HEAD em todos os arquivos tocados (todos LF, 0 CR);
  - nenhum push.
- **crm-n1-integracao:** 1 commit do plano (`f716460`) mais este SUMMARY, ambos por pathspec, sem push. `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados (ficam para o orquestrador).

## Deferred (do plano, sem mudança)

- fin2:IN-07, a conferência no Omie real de dois anexos no mesmo título: fica para o 06-20, com autorização do dono (item 11 do roteiro).
- fin2:IN-06, guardar o id da conta na Conferência: fica para o v1.3.
- fin2:WR-01, parte opcional: `AbortSignal.timeout` no `callOmie`.
- fin2:WR-02, parte opcional: fixar o bucket.
- fin2:IN-02, código novo para "Omie indisponível".

## Threat Flags

Nenhuma superfície nova além do `<threat_model>` do plano. As mitigações T-6-17-01 a 06 e 09 foram aplicadas e têm testes. T-6-17-07, 08 e 10 ficam aceitas e estão registradas no contrato e no README.

## Self-Check: PASSED

- Arquivos: `06-17-SUMMARY.md`, `contas-a-pagar-anexos.ts` (tem `PREFIXOS_DO_STORAGE`), `contas-a-pagar-lancamento.ts` (tem `PRAZO_DO_LANCAR_MS`), `contas-a-pagar-resolucao.ts` (tem `motivoDaReprovacaoNoPlano`), `scripts/teste-omie-real.ts` (tem `escutarNoLoopback(rota)`) e `contratos/contas-a-pagar-v1/README.md` (tem `/storage/v1/object/`). Todos existem.
- Commits: `b3b4278`, `30a28fb`, `6767be1` (financeiro-tria) e `f716460` (crm-n1). Todos existem.
