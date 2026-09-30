---
phase: 06-conferencia-do-resumo-e-anexos
plan: 07
subsystem: financeiro-tria/automation (contas-a-pagar /lancar) + contrato contas-a-pagar-v1
tags: [anexos, ssrf, contrato-v1.2, omie, gap-closure]
requires: []
provides:
  - "Download de anexo com prazo (15 s) e teto (15 MB em stream) para todo chamador; redirect recusado sob pedido"
  - "Política de anexos do /lancar: CONTAS_A_PAGAR_ANEXOS_HOSTS, só https, orçamento de 35 s, cinco códigos fechados"
  - "jaExistia no reaproveitado (ListarAnexo), resposta sem url"
  - "Contrato contas-a-pagar-v1 v1.2 nos dois repositórios, hash igual"
affects: [06-08, 06-12, 06-15]
tech-stack:
  added: []
  patterns:
    - "Corrida contra orçamento com a promessa perdedora já tratada (sem rejeição solta)"
    - "Política injetável por código, lida do ambiente por requisição quando ausente"
    - "Testes de rede com espera limitada internamente (mutação que tira o prazo falha em vez de pendurar)"
key-files:
  created:
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-anexos.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-anexos.test.ts
    - ../financeiro-tria/automation/src/adapters/omie-anexos.test.ts
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.sucesso-anexos-com-falhas.json
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.sucesso-reaproveitado-com-anexos.json
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.erro-400-schema-invalido-anexos.json
    - contratos/contas-a-pagar-v1/lancar.sucesso-anexos-com-falhas.json
    - contratos/contas-a-pagar-v1/lancar.sucesso-reaproveitado-com-anexos.json
    - contratos/contas-a-pagar-v1/lancar.erro-400-schema-invalido-anexos.json
  modified:
    - ../financeiro-tria/automation/src/adapters/omie.ts
    - ../financeiro-tria/automation/src/testing/omie-falso.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts
    - ../financeiro-tria/automation/src/tenants/tria/teste-omie-real.ts
    - ../financeiro-tria/automation/scripts/teste-omie-real.ts
    - ../financeiro-tria/automation/.env.example
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/README.md
    - ../financeiro-tria/automation/contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json
    - contratos/contas-a-pagar-v1/README.md
    - contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json
    - apps/api/src/automacoes/contrato-contas-a-pagar.test.ts
    - apps/api/src/automacoes/contrato-contas-a-pagar-ponte.test.ts
    - docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md
key-decisions:
  - "Redirecionamento recusado só no /lancar (recusarRedirecionamento: true); o legado ClickUp/MP/FO segue redirecionamento, com prazo e teto (decisão do orquestrador; teste (a2))"
  - "z.url().max(2048) no lugar de z.string().url() (depreciado no zod 4.4)"
  - "normalizeAttachmentFileName(nome, baseSeVazia?) com base opcional: sem ela, nome todo vazio continua arquivo.pdf (legado)"
  - "ListarAnexo que falha no reaproveitado ⇒ todos ANEXO_OMIE_RECUSOU, nada reenviado às cegas"
metrics:
  duration: "~1h40"
  completed: 2026-09-30
  tasks: 4
  files: 23
---

# Phase 6 Plan 07: Anexos seguros e honestos no /lancar (contrato v1.2) — Summary

O `/lancar` do `financeiro-tria/automation` passou a baixar anexo só de `https:` com hostname exato em `CONTAS_A_PAGAR_ANEXOS_HOSTS`, recusando redirecionamento, com 15 s e 15 MB por download e 35 s de orçamento total; cada anexo volta `{ nome, ok, jaExistia?, erro? }` com `erro` num de cinco códigos fechados e sem `url`; no `reaproveitado` o `ListarAnexo` do título decide o que já está (`jaExistia`) e o que falta subir. O contrato v1.2 está nos dois repositórios, com hash igual.

## Commits

| Repositório | Hash | Task | Mensagem |
|---|---|---|---|
| financeiro-tria | `a65a862` | 1 | feat(anexos): download com prazo e teto para todo chamador e listarAnexos no adapter (06-07) |
| financeiro-tria | `d2a0a30` | 2 | feat(contas-a-pagar): política de anexos do /lancar — allowlist, https, orçamento, jaExistia e códigos fechados (06-07) |
| financeiro-tria | `30e6489` | 3 | feat(contas-a-pagar): /lancar v1.2 — anexos pela política, resposta sem url e códigos fechados (06-07) |
| financeiro-tria | `364a7ef` | 4 | feat(contas-a-pagar): teste-omie-real com listen seguro e jaExistia, exemplos canônicos v1.2 (06-07) |
| crm-n1-integracao | `6c79c05` | 4 | feat(06-07): contrato contas-a-pagar v1.2 — anexos sem url, erro como código e jaExistia |

Nenhum dos 89 arquivos de fim de linha do `financeiro-tria` entrou em commit (`git show --stat` de cada um lista só `automation/`); a contagem de CR de cada arquivo tocado é igual à do `HEAD` (todos 0). `git status --porcelain | grep -v '^ M'` vazio no fim. Nenhum `git push`.

## Testes

| Onde | Antes | Depois |
|---|---|---|
| `financeiro-tria/automation` `npm test` (isolado) | 571/571 | 615/615 (+44) |
| `npx tsc --noEmit -p .` e `-p tsconfig.scripts.json` | verde | verde |
| crm-n1 `contrato-contas-a-pagar.test.ts` + `-ponte.test.ts` (`DATABASE_URL=`) | 36 | 46/46 (+9 casos v1.2, +1 exemplo de erro no `it.each` existente); o `describe` de hash rodou (não pulado) |
| crm-n1 `npm run typecheck` | — | EXIT 0 |
| `npm run teste:omie-real` (ENSAIO, só leituras, Omie real) | — | `RESULTADO: OK` |
| `npm run teste:omie-real -- --anexo=<pdf no scratchpad>` (ENSAIO) | — | `RESULTADO: OK` |

`diff -r` das duas pastas `contratos/contas-a-pagar-v1/` vazio; nenhuma resposta `lancar.sucesso*` com `url` em anexo (o `node -e` do aceite imprime `[]`, sai 0).

## As 18 mutações (aplicadas, rodadas e restauradas; tudo verde de novo depois)

| # | Mutação | O que falhou |
|---|---|---|
| M1 | `hostDoAnexoPermitido` sempre `true` | Task 2 (a)(b)(c); composição v1.2 (c) (o servidor de arquivos recebeu GET); lançamento v1.2 (g) política |
| M2 | `permitirHttp` ignorado | Task 2 (a) (`http://storage…`) e (b) |
| M3 | host por `includes` no `href` | Task 2 (a) (`….evil.example`, `?h=`) |
| M4 | `redirect` sempre `"follow"` / wiring com `recusarRedirecionamento: false` | Task 1 (a1) (o alvo interno recebeu hit); composição v1.2 (d) |
| M4b | legado forçado a `"error"` | Task 1 (a2) |
| M5 | sem `AbortSignal.timeout` | Task 1 (b), em 2 s (ver desvio 2) |
| M6 | teto só pelo `content-length` | Task 1 (c) |
| M7 | teto só pelo stream | Task 1 (d) |
| M8 | `subirAnexos` sem corrida | Task 2 (e) ×2 e (g) listagem lenta; composição v1.2 (f) `IncluirAnexo` lento (ver desvio 3) |
| M9 | reaproveitado sem `listarNomes` | Task 2 (g) ×4 e (h); lançamento (e) substituído e v1.2 (g); composição v1.2 (e) |
| M10 | reaproveitado devolve `[]` | os mesmos de M9 + contrato do produtor `lancar.sucesso-reaproveitado-com-anexos` |
| M11 | `erro` com a `message` crua | Task 2 (f); lançamento v1.1 (a2); composição v1.2 (d); contrato `anexos-nomeados` e `anexos-com-falhas`; consumidor: (d), o caso v1.1→v1.2 e o hash (fixture adulterada) |
| M12 | `url` de volta no item | rotas v1.1 (d), v1.2 (a)(b); contrato: `anexos-nomeados`, `anexos-com-falhas`, `reaproveitado-com-anexos`; consumidor (d) e hash |
| M13 | sem `.max(LIMITE_DE_ANEXOS)` / `z.url()` → `z.string().min(1)` / sem `.trim()` | rotas v1.2 (a), uma rodada por mutação, as três falham |
| M14 | sem desambiguação / sem `anexo-<n>` | Task 2 (h), uma rodada por mutação |
| M15 | allowlist dentro de `uploadAttachmentFromUrl` | Task 1: 9 de 11, inclusive (g) (o chamador legado deixa de subir) |
| M16 | sem `once("error", reject)` | teste-omie-real v1.2 (a) ×2 (ver desvio 2) |
| M17 | harness sem `politicaDeAnexosDoTesteReal()` | teste-omie-real "lançar com --anexo" e "IncluirAnexo falha" |
| M18 | 1 byte a mais no README da cópia do crm-n1 | "mesmos arquivos, mesmo conteúdo" |

## Redirecionamento no legado (decisão do orquestrador)

`uploadAttachmentFromUrl` ganhou `recusarRedirecionamento?: boolean` (padrão `false`). Só o wiring do `/lancar` passa `true`. Os três tenants legados não foram editados: continuam seguindo redirecionamento (URLs coladas em texto livre, como o `uc?export=download` do Google Drive) e ganharam só o prazo e o teto. A prova é o teste (a2) em `omie-anexos.test.ts`: o mesmo par 302 A→B, sem a opção, segue o redirecionamento, B recebe 1 requisição e o `IncluirAnexo` sobe. A M4b (legado forçado a `"error"`) derruba esse teste. O SSRF do legado fica aceito (T-6-07-08) e acaba junto com a Lista do ClickUp.

## Edições em testes existentes (só as autorizadas pelo plano)

financeiro-tria:
- `contas-a-pagar-lancamento.test.ts`: `portaDeAnexosFalsa` ganhou `listarNomes` (opção `noTitulo`, padrão `[]`) e `montarDeps` injeta `POLITICA_DE_ANEXOS_DO_TESTE` (`{"exemplo.com","x"}`, só https). No caso (f), a busca passou a ser pelo `nome` (`nota.pdf`/`boleto.pdf`). No `espiarAnexos` (v1.1), `listarNomes` devolve o que a porta subiu para aquele `recordId` (sem envio, `[]`), e a falha lança `faultDeNegocio("IncluirAnexo", …)`. Caso (a): a porta recebe `{ url, nome: "nfs-e-21.pdf", recordId, prazoMs: 15000 }` e `{ …, nome: "b.pdf" }`, e a resposta é `[{ nome: "NFS-e 21.pdf", ok: true }, { nome: "b.pdf", ok: true }]`. Caso (a2): espera `ANEXO_OMIE_RECUSOU`. O caso (e) foi SUBSTITUÍDO porque a decisão do dono inverteu o comportamento: agora é "reaproveitado (v1.2, decisão do dono): o anexo que já está no título volta jaExistia e não sobe de novo". Os casos novos estão em `describe("v1.2")`.
- `contas-a-pagar-routes.test.ts`: `portaDeAnexosFalsa` ganhou `listarNomes`, e `montarDeps` injeta `{"exemplo.invalid"}`. Os dois `deepEqual` de (d) passaram à forma v1.2. No caso (c), as duas chamadas diretas a `anexos.enviar` ganharam `prazoMs: 15_000`. A segunda também ganhou `nome: ""` (ver desvio 4). Os casos novos estão em `describe("v1.2 — anexos")`.
- `contas-a-pagar-composicao.test.ts`: `OpcoesDoCenario.politicaDeAnexos`, repassada a `contasAPagarRouter(adaptadores, { politicaDeAnexos })`. O caso "anexo: baixado do endereço informado…" injeta `{"127.0.0.1"}` com `permitirHttp: true` e espera `[{ nome: "guia.pdf", ok: true }]`. Entrou uma linha de import nova (`describe`, e a política/constante). Os casos novos estão em `describe("v1.2 — anexos")`: (c), (d), (e) e dois (f).
- `contas-a-pagar-contrato.test.ts`: `montarDeps` injeta a política `{"exemplo.invalid"}` e `anexos.listarNomes` (campo novo `anexosNoTitulo` no `Cenario`, padrão `[]`). O cenário `lancar.sucesso-anexos-nomeados` agora lança `new ErroDoAnexo("ANEXO_DOWNLOAD_FALHOU", …)` para o boleto, e a condição passou a comparar `"boleto-outubro.pdf"` (ver desvio 5). Na Task 4 entraram, por acréscimo, os campos `orcamentoDosAnexosMs` e `depois` no `Cenario`, a política por cenário e a chamada `cenario.depois?.()` no fim do laço, porque os exemplos novos precisam deles.
- `lancar.sucesso-anexos-nomeados.json` (produtor, copiado no crm-n1): mudaram só `descricao` e `resposta.corpo.anexos` (forma v1.2). O pedido ficou idêntico, conferido por `json`.
- `teste-omie-real.test.ts`: o import ganhou `politicaDeAnexosDoTesteReal`, a montagem da rota passa `{ politicaDeAnexos: politicaDeAnexosDoTesteReal() }` e a regex do caso "IncluirAnexo falha" é `/NFS-e 21\.pdf: não subiu \(ANEXO_OMIE_RECUSOU\) — o lançamento seguiu/`. Os asserts do caso "lançar com --anexo" passam sem edição (`IncluirAnexo` = 1, "baixado 1x"). Os casos novos estão em `describe("v1.2 — --anexo (Plan 06-07)")`.

crm-n1:
- `contrato-contas-a-pagar.test.ts`: o caso "anexos: string (v1) e { url, nome } (v1.1)…" passou à forma v1.2, com título que diz v1.2. A interface `AnexoRelatado` do mesmo `describe` ficou sem `url`, com `nome` obrigatório e `jaExistia?`. O caso agora exige ausência de `url`, `nome` do pedido para objeto e último segmento para string, e `erro` nos cinco códigos. O `describe("contrato v1.2 (06-07) — anexos")` é novo e fica no fim.
- `contrato-contas-a-pagar-ponte.test.ts`: a linha esperada é `• Boleto outubro.pdf: não subiu (ANEXO_DOWNLOAD_FALHOU)`, com o comentário "06-12 traduz o código para texto".

## Deviations from Plan

### Auto-fixed Issues

**1. [Plano condicional] `z.url()` no lugar de `z.string().url()`**
- O `z.string().url()` está `@deprecated` no zod 4.4.3 do projeto. Conferi que `z.url()` aceita só URL absoluta (`"arquivo.pdf"` é recusado) e usei `z.url().max(LIMITE_DA_URL_DO_ANEXO)`, como o plano previa. O `grep 'url: z.string()'` dá 0.

**2. [Rule 1 — teste pendurava em vez de falhar] Espera limitada dentro dos testes de prazo e de `listen`**
- **Encontrado em:** Tasks 1 e 4 (mutações M5 e M16).
- **Problema:** o `timeout` do `node:test` abandona o teste sem rodar o `finally`. Os servidores ficavam abertos e o processo da suíte pendurava; na M5, 170 s e processos órfãos, que matei.
- **Correção:** `rejeitaComCodigo` (em `omie-anexos.test.ts`) e `comLimite` (em `teste-omie-real.test.ts`) correm contra um relógio de 2 a 5 s. Com isso a M5 e a M16 falham em segundos e a suíte não pendura.
- **Commits:** `a65a862` e `364a7ef`.

**3. [Rule 2 — mutação M8 sobrevivia na rota] Falha programada `atraso` no Omie falso e um segundo caso (f)**
- **Problema:** com orçamento de 300 ms, o `prazoMs` que o adapter recebe é o próprio restante do orçamento. Um arquivo lento é cortado pelo `AbortSignal` do download, com ou sem a corrida, e por isso o (f) do plano não pegava a M8 pela rota.
- **Correção:** `FalhaProgramadaDoOmie` ganhou `{ tipo: "atraso", ms }`: o Omie lento, que responde normalmente depois de `ms`, com timers limpos no `fechar`. Entrou um caso (f) novo com download rápido e `IncluirAnexo` de 1 s: a resposta sai em menos de 1 s com `ANEXO_TEMPO_ESGOTADO`. A M8 agora falha nele.
- **Arquivos:** `src/testing/omie-falso.ts` e `src/http/contas-a-pagar-composicao.test.ts`. **Commit:** `30e6489`.

**4. [Rule 3 — tipo] `nome: ""` na segunda chamada do caso (c) de rotas**
- O `PortaDeAnexos.enviar` exige `nome` na v1.2, então a chamada "sem nome" do caso (c) não compilava. Passei `nome: ""`: o adapter trata nome vazio como ausente e usa o nome da URL, que é o mesmo comportamento que o caso prova (`guia.pdf`), com comentário no teste.

**5. [Rule 3] Cenário `lancar.sucesso-anexos-nomeados` compara o nome no Omie**
- A porta passou a receber o nome JÁ normalizado (`boleto-outubro.pdf`), e não mais o pedido (`Boleto outubro.pdf`). A condição do cenário mudou junto. O que o cenário lança é o que o plano manda (`ErroDoAnexo`).

**6. [Assinatura] `normalizeAttachmentFileName(nome, baseSeVazia?)` com a base opcional, sem padrão `"arquivo"`**
- Assim `照片.png` vira `arquivo.png`, `("照片.png", "anexo-1")` vira `anexo-1.png` e `""` continua `arquivo.pdf`. Com base pedida e nome todo vazio, sai só a base (`anexo-2`), e a extensão fica para o `content-type`. Dois efeitos colaterais em nomes-limite do legado, sem teste que dependa deles: `.env` passa a `arquivo.env` e `arquivo.` passa a `arquivo`.

**7. [Rule 3] Import dinâmico do `scripts/teste-omie-real.ts` perdido e refeito**
- A primeira edição estava no mesmo `Bash` que uma leitura de `.env.example`, e a regra de negação bloqueou o comando inteiro. O `grep` do aceite pegou a falta (o `tsc -p .` não cobre `scripts/`). A edição foi refeita e `npx tsc -p tsconfig.scripts.json` ficou verde antes do commit `30e6489`.

### Verificação bloqueada

- **`.env.example`:** a regra de negação do ambiente bloqueia LER qualquer `.env*`, inclusive o `.env.example`. O acréscimo foi feito só por `cat >>`, como o plano pede. Não consegui rodar `grep -c 'CONTAS_A_PAGAR_ANEXOS_HOSTS' .env.example` nem a contagem de CR dele. O `git diff --numstat` confirma `8 0` (8 linhas acrescentadas, nenhuma removida), e o heredoc não introduz CR. Comando para o dono conferir: `grep -c CONTAS_A_PAGAR_ANEXOS_HOSTS automation/.env.example` (esperado ≥ 1).
- Nenhuma recusa do classificador: os dois `teste:omie-real` em ENSAIO rodaram.

### Incidente de ambiente

O scratchpad é compartilhado com o executor paralelo (06-11). O meu `mutar.py` foi sobrescrito no meio de uma rodada de mutações, e três rodadas falharam no script do outro executor, sem efeito nos arquivos. Passei a usar `scratchpad/exec-06-07/mutar0607.py`, que mata o grupo de processos se o teste pendurar. É possível que uma rodada minha tenha sobrescrito o script dele antes disso: vale o orquestrador avisar o 06-11.

## Recados

**Para 06-12 (a ponte):**
- Traduzir os cinco códigos de `anexos[].erro` para texto no Comentário. Hoje a ponte mostra o código entre parênteses, e `anexosDaResposta` já lê `nome`/`ok`/`erro`.
- Usar `jaExistia` no texto do lançamento ("k já estavam no título").
- Limitar a 20 anexos por conta: acima disso o `/lancar` responde `400 SCHEMA_INVALIDO`.

**Para 06-15 (provas e o dono):**
- O dono define `CONTAS_A_PAGAR_ANEXOS_HOSTS` na VPS com o hostname do Storage do Supabase da plataforma (o de `SUPABASE_URL` do `apps/api`, sem esquema, porta ou caminho). Sem ela, o `/lancar` avisa na montagem e todo anexo sai `ANEXO_HOST_NAO_PERMITIDO`; o título ainda lança.
- `npm run teste:omie-real -- --lancar --anexo=<pdf>` prova o `ListarAnexo` real. A repetição só passa com `jaExistia`, e o formato da resposta do `ListarAnexo` para "sem anexos" não está documentado pelo Omie (tratamos Client-5113 e lista vazia como "nenhum").

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. A única porta de `http:` é `politicaDeAnexosDoTesteReal()`, que só existe em processo (T-6-07-09). O `grep` de aceite da Task 2 dá 0 `permitirHttp: true` fora de comentário no módulo da política.

## Self-Check: PASSED

- Arquivos criados existem: `contas-a-pagar-anexos.ts`/`.test.ts`, `omie-anexos.test.ts` e os três exemplos nas duas pastas (`diff -r` vazio).
- Commits existem: `a65a862`, `d2a0a30`, `30e6489`, `364a7ef` (financeiro-tria) e `6c79c05` (crm-n1-integracao).
