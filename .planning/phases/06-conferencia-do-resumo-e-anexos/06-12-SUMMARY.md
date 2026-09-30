---
phase: 06-conferencia-do-resumo-e-anexos
plan: 12
subsystem: apps/api (a ponte do Agente de lançamento) + packages/dominio (Conferência do Resumo)
tags: [conferencia-do-resumo, gap-closure, ponte, contrato-v1.2, anexos, releitura]

requires:
  - phase: 06-08
    provides: "contrato v1.2: contaConfirmada, 422 TITULO_EXISTENTE_DIVERGENTE e CONTA_DIVERGENTE"
  - phase: 06-07
    provides: "anexos v1.2: resposta sem url, erro como CodigoDoAnexo, jaExistia; limites 20/2048/200"
  - phase: 06-11
    provides: "decisaoDasRespostasPendentes, impressaoEsperada/conferenciaRejeitadaId, lancamentoSemCodigo, recusaSemCodigo, tituloDivergente/contaDivergente, anexosPedidos"
provides:
  - "motivoParaNaoLancar e CodigoDeAdiamento: a releitura antes do /lancar (crm:CR-01)"
  - "textoDoRegistroRecusado/textoDoRegistroEmConflito com o id do título; TEXTO_SAIU_ANTES_DO_REGISTRO e TEXTO_SEM_CODIGO_CONFERIDO novos"
  - "lerRespostas em lote, Resumo com impressaoEsperada/conferenciaRejeitadaId e RESUMO_ADIADO, resposta recusaSemCodigo"
  - "contaConfirmada no /lancar; motivoDosDetalhes para os dois 422 v1.2; anexosDaResposta v1.2 com anexosPedidos"
  - "LIMITE_DE_ANEXOS, TAMANHO_MAXIMO_DA_URL_DO_ANEXO e acimaDoLimite em anexosDaConta; textoDosAnexosAcimaDoLimite"
  - "registrarFalhaDoLancamento(…, { superarConferencia: true }); conferenciaVigente = a mais recente, cancelada ⇒ nenhuma"
  - "apps/api/src/testes/fixtures-da-ponte.ts (sem o executor de testes) para 06-13"
affects: [06-13, 06-15]

tech-stack:
  added: []
  patterns:
    - "segunda leitura do ciclo imediatamente antes da chamada que gasta dinheiro, com as mesmas perguntas do laço"
    - "adiamento dentro da Unidade de Trabalho (ok(undefined) sem escrita) com a guarda do domínio como defesa"
    - "resposta de outro processo casada pelo nome com o que foi enviado; lista fechada de códigos"

key-files:
  created:
    - apps/api/src/testes/fixtures-da-ponte.ts
    - apps/api/src/automacoes/ponte-lancar-fresco.test.ts
    - apps/api/src/automacoes/ponte-dominio-estrito.test.ts
    - apps/api/src/automacoes/ponte-contrato-v12.test.ts
    - apps/api/src/automacoes/anexos-da-conta-limites.test.ts
    - packages/dominio/src/operations/falha-supera-conferencia.test.ts
  modified:
    - apps/api/src/automacoes/invocar-agente.ts
    - apps/api/src/automacoes/anexos-da-conta.ts
    - apps/api/src/automacoes/invocar-agente.test.ts
    - apps/api/src/automacoes/contrato-contas-a-pagar-ponte.test.ts
    - apps/api/src/automacoes/CONTEXT.md
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/financeiro-base.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "CONTA_DIVERGENTE supera a Conferência pelo code, mesmo com details malformado (o texto cai no motivo genérico, mas a Conferência aprovada continua sem serventia)"
  - "O Registro 'Conferência superada' da falha tem ator Agente com delegate Membro, como os outros Registros de registrarFalhaDoLancamento (o molde de ai.ts usa só o Membro)"
  - "motivoDosDetalhes ficou exportada e pura (aditivo): a tradução dos details dos dois 422 em texto do domínio"
  - "anexosAcimaDoLimite vai ao log em dois pontos: no aviso antes do /lancar e no log de sucesso"
  - "Na contrato-contas-a-pagar-ponte.test.ts só UMA asserção precisou mudar (anexos 2 de 3 → 1 de 2); a linha do Boleto continuou verde"

requirements-completed: [RES-01, RES-02, RES-03, RES-04]

duration: ~20 min
completed: 2026-09-30
---

# Phase 6 Plan 12: A ponte não lança de snapshot velho, os 422 v1.2 e os anexos v1.2 — Summary

A ponte relê o Espaço logo antes de cada `/lancar`. Ela só chama se a conta, relida, ainda está exatamente como o Financeiro conferiu, e monta o corpo com o que releu. O fio do Resumo é lido inteiro, e o primeiro ajuste vence. Um Resumo nunca sai sobre dados que mudaram no meio do ciclo, nem em dobro. Um Resumo sem código diz no fio, na hora, como seguir. O `/lancar` leva a conta que o Financeiro conferiu. Os dois 422 da v1.2 viram o aviso certo, e cada um tem o seu caminho de volta. A confirmação conta os anexos que foram pedidos, pelo status que o `automation/` devolveu.

## Execução

- Início 2026-09-30T13:49Z, fim ~14:09Z. Três tarefas, cada uma em RED (commit `test`) e GREEN (commit `feat`).
- `readlink node_modules/@n1/dominio` = `../../packages/dominio`.
- **Ponto de partida do caso (j) de `invocar-agente.test.ts`:** estava VERDE. Com a redação de `lancado` de 06-11, a resposta v1.1 ainda dava `anexos 1 de 2` e `(download 404 em [url])`. Ficou vermelho só com a leitura v1.2 desta Task 3, como o plano previa.

## Commits

| Tarefa | Commit | Mensagem |
|---|---|---|
| 1 RED | `ae77c15` | test(06-12): releitura antes do /lancar e avisos com o id do título (RED) |
| 1 GREEN | `665f8f1` | feat(06-12): a ponte relê a conta imediatamente antes do /lancar (crm:CR-01) |
| 2 RED | `fa9b506` | test(06-12): ponte sobre o domínio estrito e a saída depois de CONTA_DIVERGENTE (RED) |
| 2 GREEN | `e8c8172` | feat(06-12): a ponte sobre o domínio estrito e a Conferência superada depois de CONTA_DIVERGENTE |
| 3 RED | `f270903` | test(06-12): contrato v1.2 visto pela ponte e o teto de anexos do pedido (RED) |
| 3 GREEN | `475a5bb` | feat(06-12): contrato v1.2 na ponte — contaConfirmada, os dois 422 e os anexos pelo status real |

Todos os commits foram feitos na forma com pathspec. Nenhum `git push`. `git diff --name-only 7f291bd..HEAD -- apps packages` lista só arquivos de `files_modified`.

## O que mudou

- **Task 1 (crm:CR-01).**
  - `motivoParaNaoLancar(fresco, taskId, conferidaId, criterio)` é pura e exportada. Ela devolve um de nove códigos, na ordem: `CONTA_SUMIU`, `INATIVA`, `SAIU_DE_EM_LANCAMENTO`, `NAO_ENTROU_POR_MOVIMENTO`, `FORA_DO_ESCOPO`, `MANUAL`, `LANCAMENTO_HUMANO`, `SEM_CONFERENCIA_APROVADA`, `CONFERENCIA_TROCADA`.
  - `momentoDoLancamento` segue quatro passos. Primeiro, as guardas sobre o snapshot, sem releitura. Depois, `hidratarEstado()` dentro de `try/catch`: se falhar, registra `RELEITURA_FALHOU`, que conta como transitória. Em seguida, a mesma pergunta sobre o estado relido: se ela devolver um código, a conta é esquecida, o log leva só o código e nenhuma requisição sai. Por fim, o corpo e os anexos saem de `fresco`/`atual`/`confAtual`.
  - Entraram `textoDoRegistroRecusado(payableId, erro)` e `textoDoRegistroEmConflito(payableId)`. O log desses ramos passou a levar `payableId` e `code`, e não leva mais `r.error`.
  - `TEXTO_SAIU_ANTES_DO_REGISTRO` não promete mais "sem lançar de novo".
- **Task 2 (crm:WR-04, WR-12, WR-03 do lado da ponte; a saída depois de CONTA_DIVERGENTE no domínio).**
  - `lerRespostas` usa `decisaoDasRespostasPendentes`. A recusa do domínio vira `RESPOSTA_RECUSADA_PELO_DOMINIO`. Quando a recusa é `recusaSemCodigo`, a ponte responde com ela no fio.
  - `momentoDoResumo` testa `adiado` dentro da operação e publica com `impressaoEsperada` e `conferenciaRejeitadaId`. Se a conta mudou, registra `RESUMO_ADIADO`, sem parada.
  - Um Resumo sem código recebe `recusaSemCodigo` na mesma gravação. Numa conta Manual, esse Resumo não é dispensado, e o passo `pendente` só dispensa o que tem código.
  - A guarda do Momento 2 passou a ser `lancamentoSemCodigo`. `REGEX_CODIGO_DE_CATEGORIA` saiu da ponte.
  - No domínio, `registrarFalhaDoLancamento` ganhou `superarConferencia`. `conferenciaVigente` passou a ser a Conferência mais recente; se ela estiver cancelada ou expirada, não há Conferência vigente.
- **Task 3 (contrato v1.2).**
  - O corpo do `/lancar` ganhou `contaConfirmada`.
  - `chamar()` devolve `detalhes`, só no ramo permanente. `detalhes` nunca vai ao log.
  - `motivoDosDetalhes` traduz os `details` dos dois 422 nos textos do domínio.
  - `falhaPermanente` passa `superarConferencia` só em `CONTA_DIVERGENTE`.
  - `anexosDaResposta` foi reescrita para a v1.2: casa pelo `nome`, aceita `erro` só da lista fechada e devolve `semPar`. `anexosPedidos` é o número de anexos enviados. `semUrl` foi apagada.
  - `anexosDaConta` ganhou o teto de 20 anexos e de 2048 caracteres de URL. O que fica de fora vira `acimaDoLimite`, e a ponte comenta `textoDosAnexosAcimaDoLimite(n)` no fio depois do registro.
  - Os dois `CONTEXT.md` foram atualizados.

## Testes

| Arquivo | Antes | Depois |
|---|---|---|
| `apps/api` `invocar-agente.test.ts` | 106/106 | 106/106 (caso (j) editado, CON-05) |
| `contrato-contas-a-pagar-ponte.test.ts` | 11/11 | 11/11 (uma asserção editada, CON-05) |
| `contrato-contas-a-pagar.test.ts` | 43/43 | 43/43 |
| `anexos-da-conta.test.ts` | 5/5 | 5/5 (sem edição) |
| `ponte-lancar-fresco.test.ts` (novo) | — | 24/24 |
| `ponte-dominio-estrito.test.ts` (novo) | — | 10/10 |
| `ponte-contrato-v12.test.ts` (novo) | — | 12/12 |
| `anexos-da-conta-limites.test.ts` (novo) | — | 6/6 |
| `cliente-leituras-financeiro.test.ts`, `ponte-ativa.test.ts` (por cautela) | — | 19/19, 13/13 |
| `packages/dominio` inteiro | 61 arquivos / 952 | 62 / 957 (+5 de `falha-supera-conferencia.test.ts`) |
| `apps/web`: `painel-conferencia-do-resumo`, `painel-conferencia-no-fio`, `timeline-responder`, `painel-conferencia-importada` | — | 4 arquivos / 51, todos verdes, sem edição |

- Os testes de `apps/api` rodaram um arquivo por vez, com `DATABASE_URL=` vazio. Nenhum servidor subiu e o banco não foi tocado.
- `tsc --noEmit` passou verde em `packages/dominio`, `apps/api` e `apps/web`.
- `npm run lint`: 0 erros. Os 4 avisos já existiam, em `apps/web`.
- `verificar:tokens` e `verificar:contratos` deram OK.

## Mutações

O script é `scratchpad/exec-06-12/mutar.py`. Ele troca o texto exato, roda os arquivos indicados e restaura o original no `finally`. A restauração foi conferida byte a byte nas 18 mutações.

| # | Mutação | Testes que falharam |
|---|---|---|
| M1 | sem a pergunta sobre o relido | fresco (a), (b), (c), (d relido), (e), (f) lixeira, (f) escopo — 7 |
| M2 | corpo e anexos do snapshot | fresco (g) |
| M3 | `textoDoRegistroRecusado` sem o `payableId` | fresco (i) |
| M4 | sem a comparação de id | fresco (l) `CONFERENCIA_TROCADA` |
| M5 | exceção da releitura sobe | fresco (h) |
| M6 | `lerRespostas` de volta à última resposta | estrito (e), (f) |
| M7 | sem o `adiado` (publica sempre) | estrito (h), (i) |
| M8 | dispensa também sem código | estrito (k) |
| M9 | sem a resposta `recusaSemCodigo` na publicação | estrito (j), (k) |
| M10 | `superarConferencia` sem cancelar | domínio (a) |
| M11 | `conferenciaVigente` de volta a "a mais recente não cancelada" | domínio (a), (d) |
| M12 | sem `contaConfirmada` | v12 (a), (d) |
| M13 | `TITULO_EXISTENTE_DIVERGENTE` pelo motivo genérico | v12 (b), (b avisarId), (c) |
| M14 | `CONTA_DIVERGENTE` sem `superarConferencia` | v12 (c), (d) |
| M15 | sem `anexosPedidos` | v12 (g), (h) |
| M16 | `erro` fora da lista fechada aceito | v12 (f) |
| M17 | sem o teto de 20 | limites (k) ×2, v12 (j) |
| M18 | sem o teto da URL | limites (k) URL |

## Exceções a CON-05 (as duas nomeadas no plano, e só elas)

1. **`invocar-agente.test.ts`, caso "(j) conferida e entrou por movimento…"** (l. 841-879). Só mudaram a resposta programada e a expectativa da confirmação. O resto do caso ficou byte a byte igual: cabeçalhos, corpo enviado, `not.toContain("token=")` e Execução.
   - Resposta, antes:
     ```
     { url: "https://storage.exemplo.invalid/obj/fil_nf?token=segredo-assinado", nome: "NFS-e 0021.pdf", ok: true },
     { url: "https://…/fil_boleto?token=segredo-assinado", nome: "boleto-outubro.pdf", ok: false, erro: "download 404 em https://…?token=segredo-assinado" },
     ```
   - Resposta, depois:
     ```
     { nome: "NFS-e 0021.pdf", ok: true },
     { nome: "boleto-outubro.pdf", ok: false, erro: "ANEXO_DOWNLOAD_FALHOU" },
     ```
   - Expectativa, antes: a string literal `"✅ Lançado no Omie — título pay_das_1 · TRIA COMPANY - ITAU · Impostos e taxas (2.06.01) · anexos 1 de 2\n• boleto-outubro.pdf: não subiu (download 404 em [url])"`.
   - Expectativa, depois: `TEXTOS_DA_CONFERENCIA.lancado({ payableId: "pay_das_1", conta: "TRIA COMPANY - ITAU", categoria: "Impostos e taxas", codigo: "2.06.01", reaproveitado: false, anexosPedidos: 2, anexos: [{ nome: "NFS-e 0021.pdf", ok: true }, { nome: "boleto-outubro.pdf", ok: false, erro: "ANEXO_DOWNLOAD_FALHOU" }] })`.
   - A linha ~1064 (06-11) não foi tocada, nem a região ~1353 (06-13).
2. **`contrato-contas-a-pagar-ponte.test.ts`, caso "v1.1 — o /lancar com anexos…".** Ficou vermelho depois da Task 3 e só UMA asserção foi trocada:
   - Antes: `// A resposta canônica relata três anexos (dois ok, um falhou).` e `expect(confirmacao).toContain("anexos 2 de 3");`.
   - Depois: um comentário v1.2 e `expect(confirmacao).toContain("anexos 1 de 2");`. Os dois anexos enviados casam pelo nome, e o terceiro item do exemplo, que é o anexo em string e não tem par no pedido da ponte, vira só contagem no log.
   - A segunda asserção nomeada no plano (`• Boleto outubro.pdf: não subiu (ANEXO_DOWNLOAD_FALHOU)`) continuou verde e não mudou. As asserções sobre o pedido também não mudaram.

`invocar-agente.test.ts`, (d), (e), (i), (k), (o) e o caso "9.99.99", do jeito que 06-11 os deixou, ficaram verdes sem edição. Com isso, ensaio e conferência continuam fazendo ZERO `/lancar`, sem releitura extra.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — expectativa do meu próprio teste] Caso (c) de `ponte-contrato-v12.test.ts` com `CONTA_DIVERGENTE` e `details` malformado**
- **Found during:** Task 3 (GREEN)
- **Issue:** O teste esperava ZERO requisições no ciclo seguinte para todo `details` malformado. Com `CONTA_DIVERGENTE`, a Conferência é superada pelo `code`, e por isso o ciclo seguinte publica um Resumo novo (`/resolver`). É o comportamento que o plano pede.
- **Fix:** Para `CONTA_DIVERGENTE`, o caso agora confere `sem-resumo`. Para `TITULO_EXISTENTE_DIVERGENTE`, continua conferindo zero requisições.
- **Commit:** `475a5bb`

**2. [Aditivo] `motivoDosDetalhes(code, detalhes)` exportada e pura**, fora da tabela de artefatos. É a tradução dos `details` dos dois 422, separada de `falhaPermanente` para que o `details` nunca apareça na mesma linha de um `registrar`.

**3. [Aditivo] `anexosAcimaDoLimite` também no aviso antes do `/lancar`**, além do log de sucesso. Assim, a contagem fica registrada mesmo se o registro falhar.

### Notas

- O classificador do modo automático deu "sem veredito" uma vez, na criação de `fixtures-da-ponte.ts`. Na segunda tentativa, passou. Nenhuma verificação ficou bloqueada.
- Uma rodada de teste com `--reporter=json` criou `apps/api/.vitest/`. Era saída minha, não versionada, e foi apagada na hora.
- Os testes de ponte relêem com `structuredClone(estado)`: o snapshot é um objeto diferente do estado em que a Unidade de Trabalho em memória grava, como no banco.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. Não entrou superfície nova fora do `<threat_model>`. O log ganhou só ids (`payableId`), `code` e contagens (`anexosSemPar`, `anexosAcimaDoLimite`), e `detalhes`, `url` e o texto livre da resposta nunca chegam a `registrar()`. As mitigações T-6-12-01..08 estão cobertas pelas mutações acima.

## Self-Check: PASSED

- Os 6 arquivos criados existem.
- Os 6 commits (`ae77c15`, `665f8f1`, `fa9b506`, `e8c8172`, `f270903`, `475a5bb`) estão em `git log`.
