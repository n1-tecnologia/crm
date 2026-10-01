# Fase 6 — As provas

Plano 06-06, Task 2. A regra da migração: "provar é a mesma coisa". Cada rodada
termina com as provas registradas, e não com a promessa delas.

**Estado deste relato (2026-09-30):** a rodada mais nova, sobre os planos
06-16..06-19, está no fim do arquivo, em **"Segunda rodada de fechamento
(06-16..06-19) — 2026-09-30"**. Ela cobre o que a rodada anterior (06-07..06-14)
não cobre: o S5 assíncrono sem decisão velha (06-16), o `/lancar` com prazo
desde a entrada e anexos só do Storage (06-17), a dispensa só enquanto Manual
e o reaproveitado conferido (06-18), e a marca "Lançamento no Omie em curso"
com o G3 estrito no meio do ciclo (06-19). Ver essa seção para o estado atual
das provas (testes, jornada respondendo no fio, crm2:CR-01 no real e o Omie
real com dois anexos).

A rodada sobre os planos de fechamento 06-07..06-14 está logo acima dela, em
**"Rodada de fechamento (06-07..06-14) — 2026-09-30"**, e **as três provas
passaram**: testes (`npm run check` EXIT 0), a jornada respondendo "ok" e o
ajuste NO FIO do Resumo (`RESULTADO: OK`, 3 `/resolver`, 0 `/lancar`, 0 falhas
de ciclo) e o Omie real com anexo (incluído, reconhecido na repetição pelo
`ListarAnexo`, excluído) — com a autorização do dono. As seções abaixo dela,
até lá, são a rodada de 2026-09-29, e não cobrem o código de 06-07..06-14.

**Estado da rodada de 2026-09-29:** as três provas passaram. Os testes
estão abaixo; a jornada em modo `conferencia` contra o `ws_n1` e o teste real
do Omie com anexo rodaram na mesma noite, **com autorização explícita do
dono** (também para a leitura só de leitura do id do Membro de teste). Nenhum
segredo está neste arquivo.

Pontos de partida: `crm-n1-integracao` em `d1b31ab` (branch
`integra-frontend-main`) e `financeiro-tria` em `2cd13cd` (`main`, local, com
os 89 arquivos sujos só de fim de linha, intocados).

---

## Testes

Rodados um por um, sem `DATABASE_URL` (os testes de banco pulam, DEC-09; pular
não é falha nem verde), sem servidor nenhum de pé.

| # | Onde | Comando | Resultado |
|---|---|---|---|
| 1 | `packages/dominio` | `npx vitest run` | **831/831** (53 arquivos) |
| 2 | `packages/dominio` | `npx tsc --noEmit` | EXIT 0 |
| 3 | `apps/web` | `npx vitest run` | **240/240** (25 arquivos) |
| 4 | `apps/web` | `npx tsc --noEmit` | EXIT 0 |
| 5 | raiz | `npm run lint -w @n1/web` | EXIT 0 — 0 erros, 4 avisos pré-existentes (`features/ia/conhecimento/rotulos.ts` 1, `features/shell/app-shell.tsx` 3; `no-unused-vars`, fora desta fase) |
| 6 | raiz | `npm run verificar:tokens -w @n1/web` | EXIT 0 — 437 tokens, 311 arquivos, 0 falhas |
| 7 | `apps/api` | `npx tsc --noEmit` | EXIT 0 |
| 8 | `apps/api` | `DATABASE_URL= npx vitest run src/automacoes/` | **185 passados · 17 pulados** (202; 7 arquivos) · 0 falhas |
| 9 | `apps/api` | `DATABASE_URL= npx vitest run src/rotas/` | **152 passados · 50 pulados** (202; 33 arquivos) · 0 falhas |
| 9a | `apps/api` | `DATABASE_URL= npx vitest run src/automacoes/contrato-contas-a-pagar.test.ts src/automacoes/contrato-contas-a-pagar-ponte.test.ts src/automacoes/invocar-agente.test.ts` | **142/142**: o contrato do consumidor (25, com a comparação por hash contra o produtor), o contrato de ponta a ponta da ponte (11) e a ponte (106) |
| 10 | raiz | `npm run verificar:contratos` | OK — `payment-requests-v1`, 81 arquivos idênticos, hash `b94087a3c1ef85ce…40bd`. O script só cobre essa matriz. |
| 10a | raiz | `diff -r contratos/contas-a-pagar-v1 <financeiro-tria>/automation/contratos/contas-a-pagar-v1` | vazio; 20 arquivos (16 exemplos v1 + 3 v1.1 + README); hash agregado `92db532e8c71b67d…a3c8` igual nos dois lados — **contrato v1.1 igual nos dois lados** |
| 11 | `financeiro-tria/automation` | `npx tsc --noEmit -p .` | EXIT 0 |
| 12 | `financeiro-tria/automation` | `npm test` (isolado) | **571/571**, 0 falhas, 16 s |

Não rodado de propósito: `npm run check` inteiro. Ele inclui a suíte inteira
de `apps/api`, que estoura o limite de tempo do agente. No lugar dele rodaram,
um a um, os passos que o compõem: typecheck dos três workspaces, lint, tokens,
contratos, `packages/dominio` e `apps/web` inteiros. De `apps/api` rodaram as
duas pastas que a fase tocou (`automacoes/`, `rotas/`); as outras pastas de
teste (`autenticacao`, `bootstrap`, `contratos`, `e2e`, `importacao`,
`observabilidade`, `persistencia`, `plugins`, `relatorios`, `servicos`,
`testes`) não foram tocadas pela Fase 6. Para o `npm run check` completo, o
dono roda da raiz: `DATABASE_URL= npm run check`.

---

## Jornada (modo conferência)

**Feita em 2026-09-29, com autorização do dono — `RESULTADO: OK`, zero
`/lancar`.** A ponte em `conferencia` gravou Resumos, Conferências e
Comentários de verdade no `ws_n1` (produção do CRM N1), só nas contas com
"TESTE AUTOMATIZADO" no título, e mencionou só o usuário de teste. Nada foi ao
Omie. Os comandos planejados estão logo abaixo; o que mudou na execução, e por
quê, está em "Como rodou de verdade", depois deles.

Antes: nenhum `apps/api` de pé (o `vite-node --watch` empilha pontes; um só
`node` na 3002). Não editar código em `apps/web` nem em `packages/dominio`
enquanto a jornada roda.

**Terminal A — `automation/` local** (código com o contrato v1.1; escuta só em
127.0.0.1:4100). O `tee` guarda o log para contar as requisições:

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && INVOICE_CRON_ENABLED=false INVOICE_EMIT_DRAIN_MINUTES=0 PLATAFORMA_LANCAMENTO_TOKEN=<token local gerado na hora> npm run dev 2>&1 | tee "<pasta temporária>/automation-local.log"
```

Esperado: `escutando em http://127.0.0.1:4100`.

**Terminal B — API em modo conferência, presa às contas de teste:**

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && AGENTE_CONTAS_A_PAGAR_ATIVO=true AGENTE_CONTAS_A_PAGAR_MODO=conferencia AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO" AGENTE_CONTAS_A_PAGAR_AVISAR_ID=<Membro do usuário de teste> AGENTE_CONTAS_A_PAGAR_URL=http://127.0.0.1:4100 PLATAFORMA_LANCAMENTO_TOKEN=<token local gerado na hora> AGENTE_CONTAS_A_PAGAR_ESPACO_ID=ws_n1 AGENTE_CONTAS_A_PAGAR_LISTA_ID=lst_contas_a_pagar AGENTE_CONTAS_A_PAGAR_INTERVALO_MS=20000 npm run dev -w @n1/api
```

Esperado, colar aqui:
`ponte do Agente de lançamento ativa (modo=conferencia resumoAPartirDe=para-pagar conferenciaPorComentario=true integracaoManual=nao-encosta escopo=titulos-com:"TESTE AUTOMATIZADO" avisar=membro-indicado)`.
Se aparecer `avisar=financeiro`, ou um aviso de que o Membro indicado não é
ativo, **parar**: a Menção iria para a Maryane.

**Terminal C — a tela** (porta 3001, como sempre):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && npm run dev:web -- -p 3001
```

**Terminal D — a jornada:**

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && JORNADA_VISIVEL=1 JORNADA_MODO=conferencia JORNADA_SO=cp-conferida,cp-ajuste JORNADA_EMAIL=<e-mail do usuário de teste> JORNADA_SENHA=<senha do usuário de teste> npm run jornada:financeiro -w @n1/web
```

Esperado:
- `RESULTADO: OK — contas: …` (colar a linha e os ids das duas contas).
- Capturas (na pasta temporária, fora do git): o Resumo no fio, o
  `✅ Resumo conferido`, o aviso `Neste ambiente o lançamento no Omie está
  desligado (modo conferência)` e o `Revisado a pedido de`.
- `cp-conferida` termina com a conta em "em lançamento omie"; `cp-ajuste`, com
  uma Conferência nova pendente.

**Zero `/lancar`** — depois da jornada, com o Terminal A ainda de pé:

```bash
grep -c '/resolver' "<pasta temporária>/automation-local.log"; grep -c '/lancar' "<pasta temporária>/automation-local.log"
```

Esperado: `/resolver` **maior que zero** (prova que o log registra as
requisições; sem isso, o zero de baixo não prova nada) e `/lancar` = **0**.

### Como rodou de verdade (e por que diferente do planejado)

1. **O `grep` no log do `automation/` não prova nada:** as rotas
   `/v1/integrations/contas-a-pagar/*` só registram falhas
   (`contas-a-pagar-routes.ts`, `console.warn` no erro), então `/resolver` e
   `/lancar` bem-sucedidos nunca aparecem lá. No lugar, um **contador
   independente** (proxy local em `127.0.0.1:4101`, repassando a `4100`) anotou
   instante, método, caminho e status de cada requisição da ponte — nunca corpo
   nem cabeçalhos. A ponte apontou para `4101`.
2. **`automation/` sem `watch` e sem nada de fundo:** `npx tsx src/server.ts`
   com `HOST=127.0.0.1 PORT=4100`, `INVOICE_CRON_ENABLED=false`,
   `INVOICE_EMIT_DRAIN_MINUTES=0` e `PAYMENT_REQUEST_SOURCE=clickup` — este
   último mantém o worker da plataforma DESLIGADO no processo local
   (`[worker-plataforma] desligado (PAYMENT_REQUEST_SOURCE=clickup)`), para não
   disputar a fila `platform_adapter_commands` com a produção.
3. **API sem `watch`:** `npx vite-node src/index.ts` (um processo, uma ponte).
4. **Token gerado na hora** (`openssl rand -hex 24`) num script do scratchpad,
   só em memória, o mesmo para os dois processos; nunca em arquivo nem em log.
5. **`AGENTE_CONTAS_A_PAGAR_AVISAR_ID=mem_tarjrn`:** leitura só de leitura
   (`begin read only`) da coleção `members` do `ws_n1`, autorizada pelo dono —
   o usuário de teste é o único Administrador com login (os outros: `mem_maryane`
   Proprietária, `mem_marcos_paulo` sem login, `mem_tarjw8` o Agente do
   pipeline).
6. A tela (3001) já estava de pé, do mesmo checkout.

### Resultado

| Item | Resultado |
|---|---|
| Linha de partida da ponte | `ponte do Agente de lançamento ativa (modo=conferencia resumoAPartirDe=para-pagar conferenciaPorComentario=true integracaoManual=nao-encosta escopo=titulos-com:"TESTE AUTOMATIZADO" avisar=membro-indicado)` |
| `automation/` local | `escutando em http://127.0.0.1:4100`; `[cron] desabilitado`; `[worker] emissão contínua desligada`; `[worker-plataforma] desligado` |
| `RESULTADO` da jornada | `RESULTADO: OK — contas: tsk_tark2y, tsk_tark3r` (exit 0) |
| `cp-conferida` — `tsk_tark2y` (N1-500, "TESTE AUTOMATIZADO — CP conferida · 29/09 21:17") | Resumo no fio em **14 s** → card "Pendente" (TRIA · Contas de Consumo · 2.04.03, R$ 123,45, 09/10/2026) → "Conferido, pode lançar" → `✅ Resumo conferido` em 0 s → "em lançamento omie" → aviso do modo conferência em **7 s** → Status continua "em lançamento omie"; card "Conferido por ferramentas@triacompany.com.br … · por clique" |
| `cp-ajuste` — `tsk_tark3r` (N1-501, "TESTE AUTOMATIZADO — CP ajuste · 29/09 21:17") | Resumo no fio em **61 s** (atrasado pelas falhas de ciclo abaixo) → "Pedir ajuste": "é prestação comercial, não ADM" → Resumo revisado (`Revisado a pedido de`) em **13 s** → Conferência nova, Pendente |
| Capturas (fora do git) | `/var/folders/r3/zfrghx8n7hxd5gnkc_jf5c500000gn/T/jornada-financeiro/cp-conferida-resumo.png`, `cp-conferida-conferencia.png`, `cp-ajuste-resumo-revisado.png` |
| Requisições da ponte (contador) | `00:18:24Z POST …/resolver -> 200` (N1-500) · `00:20:17Z POST …/resolver -> 200` (N1-501) · `00:20:34Z POST …/resolver -> 200` (a revisão, com o pedido) |
| **`/resolver`** | **3** |
| **`/lancar`** | **0** |

### O que a prova mostrou além do esperado

- **Falhas transitórias no ciclo da ponte:** 4 ciclos falharam e a ponte se
  recuperou sozinha no seguinte — 3 × `Query read timeout` (o limite de 30 s do
  pool, `d65ef0a`) e 1 × `Connection terminated due to connection timeout`.
  Todas enquanto a tela gravava (a jornada preenchendo Campos); o `GET /estado`
  da tela respondeu em ~1,6 s o tempo todo, então não é o banco parado: é
  alguma consulta do ciclo da ponte que passa de 30 s sob escrita concorrente,
  ou uma conexão do pooler que morre. Custo visível: o Resumo da segunda conta
  levou 61 s em vez de ~15 s. **Investigar antes de produção.**
- **A revisão manteve a categoria:** com o pedido "é prestação comercial, não
  ADM", o `/resolver` (com `pedidoDeRevisao`) devolveu de novo Contas de
  Consumo (2.04.03). O caminho para forçar uma categoria é citar o código no
  pedido (`d.dd.dd`), que a ponte manda como `codigoCategoriaConfirmado` e o
  backend confere no plano de contas.
- **"Marcar como paga" continua habilitado** com a conta em "para pagar" e em
  "em lançamento omie" (visível nas capturas) — o item aberto de antes da
  Fase 6 (pular o Omie pela tela); fora do escopo desta fase.

As contas de teste ficam no `ws_n1`, com "TESTE AUTOMATIZADO" no título, para
consulta; descartar pela tela se o dono preferir.

---

## Omie real com anexo

**Feito em 2026-09-29, com autorização do dono — `RESULTADO: OK`.** Este
teste lança um título de verdade no Omie da Tria (R$ 1,00, fornecedor que já
existe), sobe um anexo por `IncluirAnexo`, confere e **exclui** o título no
fim. Rodou com `--anexo=<scratchpad>/TESTE-AUTOMATIZADO-anexo.pdf` (o PDF de
94 bytes do ensaio, com um nome que se identifica).

O ensaio, só com leituras, já passou em 06-02: `npm run teste:omie-real --
--anexo=<PDF de 94 bytes>` deu `RESULTADO: OK`, com "anexo ✔ anexo-teste.pdf
(94 bytes) legível".

Comando, de dentro de `financeiro-tria/automation` (o `.env` real é lido
dali; o dono roda, ou autoriza o orquestrador a rodar):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && npm run teste:omie-real -- --lancar --anexo=<pdf pequeno de teste>
```

Esperado: todos os passos com ✔, entre eles "anexo no Omie" com
`anexos[0].ok === true` (`anexos: 1 de 1`), o segundo `/lancar` reaproveitando
o mesmo id, e o título excluído e confirmado pelo id ("não cadastrado").
Duas esperas de ~55 s por `REDUNDANT` do Omie são normais. Depois, no Omie,
olhar que o anexo apareceu com o nome original e sumiu com o título.

| Item | Resultado |
|---|---|
| `RESULTADO` | `RESULTADO: OK — todos os passos passaram.` |
| Passos | credencial ✔ · fornecedor ✔ (SAFE2PAY, já cadastrado) · resolver ✔ (Contas de Consumo 2.04.03, similaridade 0.46) · consulta prévia ✔ · anexo ✔ (legível) · lançar ✔ · anexo no Omie ✔ · conferir ✔ (código de integração, valor, vencimento, categoria, fornecedor, conta corrente 5468785966) · repetir sem duplicar ✔ (`reaproveitado: true`) · excluir ✔ |
| Código de integração | `tria:contas-a-pagar:tst_260929212130` |
| Id do título | `5872791251` |
| Anexo (`anexos: n de 1`, nome) | **1 de 1** — `TESTE-AUTOMATIZADO-anexo.pdf` subiu pelo `IncluirAnexo` no título 5872791251 (baixado 1× do servidor local efêmero) |
| Exclusão confirmada | "Lançamento excluído com sucesso!"; a consulta pelo id do Omie confirma **não cadastrado**; o Omie apaga os anexos com o título |
| Esperas | 3 `REDUNDANT` do Omie (0 s, 59 s, 60 s) — normais |

Não conferido: o nome do anexo **na tela** do Omie — o título foi excluído no
fim do próprio teste. O nome que foi ao `IncluirAnexo` (`cNomeArquivo`) é o
do arquivo, provado pelo teste de 06-02 que abre o zip enviado.

---

## Fica com o dono

1. ~~Autorizar as duas provas acima~~ — **feito em 2026-09-29** (as duas
   passaram). Resta: **investigar as falhas transitórias do ciclo da ponte**
   (3 `Query read timeout` + 1 timeout de conexão durante a jornada) antes de
   ligá-la em produção.
2. **Subir a API em modo `lancar`** e rodar o passo 2B do roteiro
   (`docs/08-migracao-financeiro/08-roteiro-de-producao-pos-correcoes.md`),
   parte "Depois, em `lancar`", numa conta de teste com anexo. É o único
   caminho que lança pela tela. O agente não sobe a API em `lancar`.
3. **Responder às decisões D6-01..D6-04** (`06-CONTEXT.md`; roteiro,
   "Decisões pendentes", item 9). O código segue um padrão em cada uma. Para
   mudar, basta a variável, sem código:
   - `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE`
   - `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO`
   - `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL`

   A D6-03 é a exceção: pede uma linha de código. Falta ainda a pergunta de
   como a Tarefa passa hoje da Solicitação para Contas a Pagar no ClickUp.
4. **Deploy do `automation/` com o contrato v1.1** (`financeiro-tria`
   `d462f6e..5a65e5b`, e o S5/S6 em `2cd13cd`): push do `financeiro-tria/main`
   e o Passo 4 do roteiro. Vem **antes** de ligar a ponte contra a VPS, em
   qualquer modo que grave: os schemas são `.strict()`, e um `automation/`
   anterior à v1.1 recusa `pedidoDeRevisao`, `codigoCategoriaConfirmado` e
   `anexos` com nome.
5. **`PLATAFORMA_MEMBRO_POR_CLICKUP_ID`** no `.env` do `automation/` com o
   par `81581816=<Membro de Contas a Pagar>`. Sem ele, o RESUMO que o S5
   publica na Solicitação sai sem Menção (achado de 06-05).
6. **Produção primeiro em `conferencia`:** `AGENTE_CONTAS_A_PAGAR_MODO=conferencia`
   com `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM` e `AGENTE_CONTAS_A_PAGAR_AVISAR_ID`
   **vazias**. Depois de alguns Resumos certos, trocar para `lancar`.
7. **Push e merge** de `integra-frontend-main` (o agente nunca faz push).

---

## Rodada de fechamento (06-07..06-14) — 2026-09-30

Plano 06-15. Os planos de fechamento mudaram o `/lancar` e os anexos
(contrato v1.2), o S5 (assíncrono e sobre o dado atual), o domínio (o
classificador estrito, as respostas em lote, o Resumo sem código), a ponte
(a releitura antes do `/lancar`, os 422 novos, o ciclo que se recupera, a
porta de teste fechada) e a tela (o "Responder" no fio). A rodada de
2026-09-29 acima não cobre esse código; esta cobre.

Pontos de partida: `crm-n1-integracao` em `9a79479` (branch
`integra-frontend-main`; o código é o de `f5e2025`, e `9a79479` só acrescenta
os documentos da Task 1 do 06-15) e `financeiro-tria` em `0ad567e` (`main`,
local; o código é o de `42ca9b5`, e `0ad567e` só acrescenta o README; os 89
arquivos sujos só de fim de linha, intocados). `git status --short` sem nada
além disso nos dois.

### Testes

Sem servidor nenhum de pé e sempre com `DATABASE_URL=` vazio: os testes de
banco pulam (DEC-09), e pular não é falha nem verde.

Comandos:

```bash
# a. Tudo, da raiz (typecheck ×3, lint, tokens, verificar:contratos, e as três suítes inteiras)
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && DATABASE_URL= npm run check > <pasta temporária>/check.log 2>&1; echo EXIT $?
# b. As pastas que a rodada tocou, para o registro
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && DATABASE_URL= npx vitest run src/automacoes/ src/rotas/ src/observabilidade/ src/persistencia/
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/web" && npx vitest run src/features/tarefa/
# c. O contrato nos dois lados
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && diff -r contratos/contas-a-pagar-v1 "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation/contratos/contas-a-pagar-v1"
(cd contratos/contas-a-pagar-v1 && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256)
(cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation/contratos/contas-a-pagar-v1" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256)
cd apps/api && DATABASE_URL= npx vitest run src/automacoes/contrato-contas-a-pagar.test.ts src/automacoes/contrato-contas-a-pagar-ponte.test.ts
# d. O produtor
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && npx tsc --noEmit -p . && npm test
```

| # | Onde | Comando | Resultado |
|---|---|---|---|
| 1 | raiz | `DATABASE_URL= npm run check` | **EXIT 0**, em 70 s (11:52:29 → 11:53:39). Também rodou antes do commit da Task 1, em `492a2d8`: EXIT 0, os mesmos números |
| 2 | `packages/dominio` | `vitest run` (dentro do `check`) | **957/957** (62 arquivos) |
| 3 | `apps/web` | `vitest run` (dentro do `check`) | **267/267** (27 arquivos) |
| 4 | `apps/api` | `vitest run`, a suíte INTEIRA sem banco (dentro do `check`) | **786 passados · 205 pulados · 1 todo · 0 falhas** (994; 98 arquivos: 82 passados, 16 pulados), 41 s |
| 5 | os três workspaces | `tsc --noEmit` (dentro do `check`) | EXIT 0 (`@n1/api`, `@n1/web`, `@n1/dominio`) |
| 6 | `apps/web` | `eslint .` (dentro do `check`) | EXIT 0 — 0 erros, os 4 avisos pré-existentes (`rotulos.ts` 1, `app-shell.tsx` 3) |
| 7 | `apps/web` | `verificar:tokens` (dentro do `check`) | EXIT 0 — 437 tokens, 311 arquivos, 0 falhas |
| 8 | raiz | `verificar:contratos` (`payment-requests-v1`, dentro do `check`) | OK — 81 arquivos idênticos, hash `b94087a3c1ef85ce…40bd` (o mesmo de 2026-09-29) |
| 9 | `apps/api` | `src/automacoes/` · `src/rotas/` · `src/observabilidade/` · `src/persistencia/` (uma pasta por vez) | `automacoes/` **297 passados · 17 pulados** (13 arquivos) · `rotas/` **164 · 50 pulados** (34 arquivos) · `observabilidade/` **10/10** (2 arquivos) · `persistencia/` **46 · 36 pulados** (11 arquivos, 5 pulados inteiros) — 0 falhas |
| 10 | `apps/web` | `src/features/tarefa/` | **82/82** (7 arquivos, com `timeline-responder` e `painel-conferencia-no-fio`) |
| 11 | contrato | `diff -r` das duas pastas `contas-a-pagar-v1` e o hash agregado dos dois lados | `diff -r` vazio (EXIT 0); **27 arquivos** nos dois lados (16 exemplos v1 + 3 v1.1 + 7 v1.2 + README); hash agregado `0e5eff9a1a2f551e…ee57` igual nos dois lados — **contrato v1.2 igual nos dois repositórios** |
| 12 | `apps/api` | `contrato-contas-a-pagar.test.ts` + `contrato-contas-a-pagar-ponte.test.ts` | **54/54**: o consumidor 43 (com o hash contra o produtor) e a ponte de ponta a ponta 11 |
| 13 | `financeiro-tria/automation` | `npx tsc --noEmit -p .` | EXIT 0 |
| 14 | `financeiro-tria/automation` | `npm test` (isolado) | **708/708**, 0 falhas, 0 pulados, 18 s (eram 571 antes de 06-07) |

Desta vez o `npm run check` inteiro coube no tempo (a suíte de `apps/api`
sem banco levou 41 s), então a suíte INTEIRA de `apps/api` está registrada, e
não só as pastas tocadas. Nenhum teste falhou; os pulados são os de banco
(DEC-09), e o `todo` é um `it.todo` declarado em
`src/e2e/falhas-injetadas.test.ts` (commit `1fd5432`, anterior a esta fase),
não uma falha. Nenhum servidor subiu para os testes: a porta 3002 estava
ocupada, o tempo todo, pela API normal deste checkout (`vite-node
src/index.ts`, sem `--watch`), que os testes não usam; 4100 e 4101 estavam
livres. Para a jornada, a 3002 precisa ser liberada antes (a API da prova sobe
nela).

### Jornada — respostas no fio (modo conferência)

**Só com a autorização explícita do dono**, porque grava no `ws_n1`: 2 contas
"TESTE AUTOMATIZADO" (3, com o cenário opcional do card), os Resumos, as
Conferências e as respostas; as Menções só ao `mem_tarjrn`; nada no Omie.

Autorização: dada pelo dono em 2026-09-30, nesta conversa ("Autorizo as duas": a jornada e o Omie real com anexo).

Antes: `lsof -nP -iTCP:3002 -sTCP:LISTEN`, `…:4100…` e `…:4101…` vazios (a
tela em 3001 pode ficar, se for deste checkout). Não editar `apps/web` nem
`packages/dominio` enquanto a jornada roda.

**O lançador** (um script na pasta temporária, igual ao de 2026-09-29). Gera o
token com `openssl rand -hex 24` numa variável do shell, que nunca é impressa
nem gravada, e sobe três processos, com os logs na pasta temporária:

```bash
# 1. automation/ — sem watch, só em 127.0.0.1, sem nada em fundo
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && HOST=127.0.0.1 PORT=4100 INVOICE_CRON_ENABLED=false INVOICE_EMIT_DRAIN_MINUTES=0 PAYMENT_REQUEST_SOURCE=clickup PLATAFORMA_WEBHOOK_TOKEN= PLATAFORMA_LANCAMENTO_TOKEN="$TOKEN" npx tsx src/server.ts
# 2. o contador — proxy node em 127.0.0.1:4101 -> 4100; anota só instante, método, caminho e status
node <pasta temporária>/proxy-contador.mjs <pasta temporária>/proxy-requisicoes.log
# 3. a API — sem --watch, em conferencia, presa às contas de teste
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && AGENTE_CONTAS_A_PAGAR_ATIVO=true AGENTE_CONTAS_A_PAGAR_MODO=conferencia AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO" AGENTE_CONTAS_A_PAGAR_AVISAR_ID=mem_tarjrn AGENTE_CONTAS_A_PAGAR_URL=http://127.0.0.1:4101 PLATAFORMA_LANCAMENTO_TOKEN="$TOKEN" AGENTE_CONTAS_A_PAGAR_ESPACO_ID=ws_n1 AGENTE_CONTAS_A_PAGAR_LISTA_ID=lst_contas_a_pagar AGENTE_CONTAS_A_PAGAR_INTERVALO_MS=20000 npx vite-node src/index.ts
```

O que desliga o trabalho em fundo do `automation/` local (06-09, nenhuma
variável nova): `PAYMENT_REQUEST_SOURCE=clickup` desliga o worker da
plataforma inteiro (fila, varredura de comentários e varredura de aprovações
do S5 assíncrono); `PLATAFORMA_WEBHOOK_TOKEN=` vazio fecha
`/webhooks/plataforma/*` com 401 antes do corpo (nenhum S5 depois de um 202).

Esperado na partida: `escutando em http://127.0.0.1:4100`, `[cron]
desabilitado`, `[worker-plataforma] desligado (PAYMENT_REQUEST_SOURCE=clickup)`,
e a linha da ponte na forma do 06-13: `modo=conferencia`,
`conferenciaPorComentario=true`, `escopo=titulos-com:"TESTE AUTOMATIZADO"` e
`avisar=membro-indicado`. Com `avisar=financeiro`, com `AVISAR_ID_INVALIDO` ou
com uma recusa de subir: **parar**.

**A jornada** (as credenciais vêm do dono, só no ambiente do lançador):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && JORNADA_VISIVEL=1 JORNADA_MODO=conferencia JORNADA_SO=cp-conferida,cp-ajuste JORNADA_EMAIL=<e-mail do usuário de teste> JORNADA_SENHA=<senha do usuário de teste> npm run jornada:financeiro -w @n1/web
```

(`cp-conferida-pelo-card` é opcional e vai na mesma lista.)

Esperado: `RESULTADO: OK — contas: …`. Em `cp-conferida`: `Responder "ok" no
fio do Resumo — respondido no fio (<id>)`, o `✅ Resumo conferido` publicado
pela ponte a partir da resposta, `Card: conferido por comentário`, o aviso do
modo conferência e o Status em "em lançamento omie". Em `cp-ajuste`:
`respondido no fio (<id>)`, `🔁 Ajuste pedido por`, `Revisado a pedido de` e o
card de novo "Pendente". No contador: `/resolver` ≥ 3 e `/lancar` = **0**.

| Item | Resultado |
|---|---|
| Linha de partida da ponte | `ponte do Agente de lançamento ativa (modo=conferencia resumoAPartirDe=para-pagar conferenciaPorComentario=true integracaoManual=nao-encosta escopo=titulos-com:"TESTE AUTOMATIZADO" avisar=membro-indicado)` — a 1ª subida parou na própria checagem do lançador (o log grava as aspas escapadas `\"`; o padrão foi corrigido) e a API filha, que ignora SIGTERM, foi encerrada por SIGINT; nesse minuto ela só registrou "Conferência — lançaria" para a N1-500 de 29/09, sem gravar nada e sem `/lancar` (o `automation/` já estava fora) |
| `automation/` local | `escutando em http://127.0.0.1:4100`; `[cron] desabilitado via INVOICE_CRON_ENABLED=false`; `[worker-plataforma] desligado (PAYMENT_REQUEST_SOURCE=clickup)`; `PLATAFORMA_WEBHOOK_TOKEN` vazio |
| `RESULTADO` da jornada | `RESULTADO: OK — contas: tsk_tark4m, tsk_tark5h` (exit 0) |
| `cp-conferida` (resposta "ok" no fio) | `tsk_tark4m` (N1-502, "TESTE AUTOMATIZADO — CP conferida · 30/09 12:00"): Resumo no fio em **20 s** → card "Pendente" → `Responder "ok" no fio do Resumo — respondido no fio (cmt_tark52)` → `✅ Resumo conferido` publicado pela ponte em **12 s** → card "Conferido por ferramentas@triacompany.com.br em 30/09/2026, 12:01 · por comentário" → "em lançamento omie" → aviso do modo conferência em **17 s** → Status continua "em lançamento omie"; a raiz do fio aparece como "Conferência do Resumo" |
| `cp-ajuste` (resposta com o pedido no fio) | `tsk_tark5h`: Resumo no fio em **13 s** → card "Pendente" → `Responder no fio: "é prestação comercial, não ADM" — respondido no fio (cmt_tark5x)` → `🔁 Ajuste pedido por` em **8 s** → Resumo revisado (`Revisado a pedido de`) em **14 s** → Conferência nova, "Pendente" |
| `cp-conferida-pelo-card` (opcional) | não rodado — o clique no card já foi provado na rodada de 2026-09-29 e segue coberto pelos testes de componente |
| Requisições da ponte (contador) | `15:01:09Z POST …/resolver -> 200` (N1-502) · `15:03:02Z POST …/resolver -> 200` (a conta do ajuste) · `15:03:31Z POST …/resolver -> 200` (a revisão, com o pedido) |
| **`/resolver`** | **3** |
| **`/lancar`** | **0** |
| Falhas de ciclo no log da API (eram 4 em 2026-09-29) | **0** — nenhuma linha de aviso (`level` 40/50) no log da API durante toda a jornada |
| Portas 3002, 4100 e 4101 no fim | livres; nenhum processo da prova vivo (o `parar-…` passou a usar SIGINT, com SIGKILL só de reserva) |

### Omie real com anexo (de novo, opcional)

**Só com a autorização explícita do dono**: lança R$ 1,00 no Omie da Tria,
sobe um anexo, repete, confere e exclui o título. O caminho dos anexos mudou em
06-07 (allowlist injetada pelo próprio teste, limites, `listarAnexos` no
reaproveitado).

Autorização: dada pelo dono em 2026-09-30, nesta conversa ("Autorizo as duas": a jornada e o Omie real com anexo).

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && npm run teste:omie-real -- --lancar --anexo=<pasta temporária>/TESTE-AUTOMATIZADO-anexo.pdf
```

Esperado: todos os passos com ✔ e `anexos: 1 de 1` no primeiro `/lancar`;
na repetição, `reaproveitado: true` e o anexo `{ ok: true, jaExistia: true }`;
nenhum item de `anexos` com `url`; o título excluído e confirmado "não
cadastrado" pelo id, com espera (~60 s por `REDUNDANT`).

| Item | Resultado |
|---|---|
| `RESULTADO` | `RESULTADO: OK — todos os passos passaram.` na 2ª execução; a 1ª parou no `/resolver` com `OMIE_INDISPONIVEL` transitório do próprio Omie ("SOAP-ERROR: Failed to talk with application server (cError: 28)" no `ListarCategorias`), ANTES de qualquer gravação |
| Anexo no primeiro `/lancar` | `TESTE-AUTOMATIZADO-anexo.pdf` subiu pelo `IncluirAnexo` no título 5872967002 (baixado 1× do servidor local efêmero) |
| Repetição (`reaproveitado`, `jaExistia`) | segundo `/lancar` devolveu o mesmo id, `reaproveitado: true`, "anexo reconhecido no título pelo nome, sem baixar de novo" — o `ListarAnexo` provado no Omie real pela primeira vez |
| Código de integração e id do título | `tria:contas-a-pagar:tst_260930120446` · `5872967002`; conferência: código de integração, valor, vencimento, categoria (2.04.03), fornecedor e conta corrente 5468785966 ✓ |
| Exclusão confirmada pelo id | "Lançamento excluído com sucesso!"; a consulta pelo id confirma **não cadastrado** (na 2ª conferência); o Omie apaga os anexos com o título |

### Fica com o dono

O que só o dono faz (regra 8 de `06-CONTEXT.md`), com o comando e o esperado.

1. **Passo 2B em `lancar`** (roteiro, "Depois, em `lancar`"; verificação humana
   1 de `06-VERIFICATION.md`). O `automation/` local com
   `CONTAS_A_PAGAR_ANEXOS_HOSTS=<host do Storage do Supabase da plataforma>` e
   a API com `AGENTE_CONTAS_A_PAGAR_MODO=lancar` (e as duas variáveis de
   teste). Uma conta de teste com anexo, conferida respondendo "ok" no fio.
   Esperado: `✅ Lançado no Omie — título … · anexos 1 de 1` e a conta em
   "lançado omie"; numa recusa, a conta volta a "para pagar" com o motivo.
2. **O deploy do `automation/`**: push do `financeiro-tria/main` (até
   `42ca9b5`, com 06-07..06-10) e o Passo 4 do roteiro. O `.env` de produção
   leva `CONTAS_A_PAGAR_ANEXOS_HOSTS=<host do Storage do Supabase da
   plataforma>` e `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` com
   `81581816=<Membro de Contas a Pagar>`. O 06-09 e o 06-10 não criaram
   variável nova.
3. **S5/S6 ao vivo** depois do deploy (verificação humana 2): aprovar e
   reprovar por clique uma Solicitação de teste da coorte plataforma.
   Esperado: o RESUMO com Menção ao Membro de Contas a Pagar, dentro do prazo
   do S5 assíncrono (logo depois do 202, ou na varredura seguinte, a cada
   `PLATAFORMA_FILA_INTERVALO_MS`), e o aviso de S6 na reprovação.
4. **A API de produção** com as variáveis do 06-13 (`DATABASE_QUERY_TIMEOUT_MS`
   no padrão, nunca `0`), primeiro em `conferencia`, com
   `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM` e `AGENTE_CONTAS_A_PAGAR_AVISAR_ID`
   **vazias**; depois `lancar`.
5. **Push e merge** de `integra-frontend-main`.
6. **As decisões D6-01..D6-04**, se ainda abertas (roteiro, "Decisões
   pendentes", item 9).
7. **Os timeouts do ciclo**, se voltaram na jornada desta rodada (ver a
   linha "Falhas de ciclo" acima e o que o 06-13 manda procurar no log).

| Item | Situação |
|---|---|
| 1. Passo 2B em `lancar` | pendente — com o dono |
| 2. Deploy do `automation/` e `.env` | pendente — com o dono; antes, a rodada de correção dos achados de `06-REVIEW-FINANCEIRO-TRIA-2.md` (1 crítico no S5 assíncrono) |
| 3. S5/S6 ao vivo | pendente — depois do deploy |
| 4. API de produção | pendente — com o dono; antes, a rodada de correção dos achados de `06-REVIEW-2.md` (1 crítico no modo `sem-conferencia`) |
| 5. Push e merge | pendente — o agente nunca faz push |
| 6. D6-01..D6-04 | pendente — os padrões seguem em vigor, trocáveis por variável |
| 7. Timeouts do ciclo | **não voltaram** nesta jornada (0 falhas, eram 4); a causa provável (a trava de revisão sem limite no servidor) foi corrigida em 06-13 — acompanhar em produção pelos códigos `TRAVA_ESGOTADA`, `TEMPO_DE_CONSULTA_ESGOTADO` e `TEMPO_DE_CONEXAO_ESGOTADO` |

---

## Segunda rodada de fechamento (06-16..06-19) — 2026-09-30

Plano 06-20. Os planos 06-16..06-19 mudaram o S5 assíncrono (sem decisão
velha, sem dedup que engole evento, sem receipt preso — `financeiro-tria`),
o `/lancar` (prazo desde a entrada, anexos só do Storage, reaproveitado
honesto — `financeiro-tria`), a dispensa D6-04 (só enquanto "Manual", quem
confere pelo fio = pelo clique, o reaproveitado conferido — `crm-n1`) e o
lançamento (a marca "Lançamento no Omie em curso", o G3 estrito no meio do
ciclo, o orçamento justo, o cenário `cp-dispensa-manual` — `crm-n1`). Nenhuma
rodada anterior cobre esse código; esta cobre.

Pontos de partida: `crm-n1-integracao` em `996d337` (branch
`integra-frontend-main`; o código é o de `2214a96` — 06-16..06-19 —, e
`4547cfd`/`996d337` só acrescentam o SUMMARY e o ROADMAP/STATE do 06-19) e
`financeiro-tria` em `6767be1` (`main`, local; o código de 06-16 é
`0ad567e..c535dee` e o de 06-17 é `c535dee..6767be1`; os 89 arquivos sujos só
de fim de linha, intocados). `git status --short` sem nada além dos
documentos deste plano (06-20, Task 1) nos dois.

### Testes

Sem servidor nenhum de pé e sempre com `DATABASE_URL=` vazio: os testes de
banco pulam (DEC-09), e pular não é falha nem verde.

Comandos:

```bash
# a. Tudo, da raiz (typecheck ×3, lint, tokens, verificar:contratos, e as três suítes inteiras)
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && DATABASE_URL= npm run check > <pasta temporária>/check.log 2>&1; echo EXIT $?
# b. As pastas que a rodada tocou, para o registro
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && DATABASE_URL= npx vitest run src/automacoes/
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && DATABASE_URL= npx vitest run src/rotas/
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && DATABASE_URL= npx vitest run src/observabilidade/
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && DATABASE_URL= npx vitest run src/persistencia/
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/web" && npx vitest run src/features/tarefa/
# c. O contrato nos dois lados
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && diff -r contratos/contas-a-pagar-v1 "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation/contratos/contas-a-pagar-v1"
(cd contratos/contas-a-pagar-v1 && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256)
(cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation/contratos/contas-a-pagar-v1" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256)
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && DATABASE_URL= npx vitest run src/automacoes/contrato-contas-a-pagar.test.ts src/automacoes/contrato-contas-a-pagar-ponte.test.ts
# d. O produtor
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && npx tsc --noEmit -p . && npm test
```

| # | Onde | Comando | Resultado |
|---|---|---|---|
| 1 | raiz | `DATABASE_URL= npm run check` | **EXIT 0**, em background (o typecheck ×3, lint, tokens, `verificar:contratos` e as três suítes inteiras couberam sem estourar o limite) |
| 2 | `packages/dominio` | `vitest run` (dentro do `check`) | **995/995** (66 arquivos), 3.23 s |
| 3 | `apps/web` | `vitest run` (dentro do `check`) | **275/275** (29 arquivos), 4.72 s |
| 4 | `apps/api` | `vitest run`, a suíte INTEIRA sem banco (dentro do `check`) | **820 passados · 205 pulados · 1 todo · 0 falhas** (1028; 102 arquivos: 86 passados, 16 pulados), 43.47 s. O `todo` é o mesmo `it.todo` pré-existente de `src/e2e/falhas-injetadas.test.ts` (06-15) |
| 5 | os três workspaces | `tsc --noEmit` (dentro do `check`) | EXIT 0 (`@n1/api`, `@n1/web`, `@n1/dominio`) |
| 6 | `apps/web` | `eslint .` (dentro do `check`) | EXIT 0 — 0 erros, 4 avisos pré-existentes (`rotulos.ts` 1, `app-shell.tsx` 3; `no-unused-vars`, fora desta fase) |
| 7 | raiz | `verificar:tokens` (dentro do `check`) | EXIT 0 — 437 tokens, 311 arquivos, 0 falhas |
| 8 | raiz | `verificar:contratos` (`payment-requests-v1`, dentro do `check`) | OK — 81 arquivos idênticos, hash `b94087a3c1ef85ce…40bd` (o mesmo das rodadas anteriores) |
| 9 | `apps/api` | `src/automacoes/` · `src/rotas/` · `src/observabilidade/` · `src/persistencia/` (uma pasta por vez) | `automacoes/` **331 passados · 17 pulados** (17 arquivos), 13.89 s · `rotas/` **164 · 50 pulados** (34 arquivos), 7.19 s · `observabilidade/` **10/10** (2 arquivos), 1.59 s · `persistencia/` **46 · 36 pulados** (11 arquivos, 5 pulados inteiros), 2.16 s — 0 falhas em todas |
| 10 | `apps/web` | `src/features/tarefa/` | **90/90** (9 arquivos), 3.10 s |
| 11 | contrato | `diff -r` das duas pastas `contas-a-pagar-v1` e o hash agregado dos dois lados | `diff -r` vazio (EXIT 0); **27 arquivos** nos dois lados; hash agregado `0adf7a7bd246e2051e73ff02bbe5e6d4ea2966d2ef659a6cfcb0f7964d595f71` igual nos dois lados — **contrato v1.2 igual nos dois repositórios** |
| 12 | `apps/api` | `contrato-contas-a-pagar.test.ts` + `contrato-contas-a-pagar-ponte.test.ts` | **54/54**: o consumidor (com o hash contra o produtor) e a ponte de ponta a ponta |
| 13 | `financeiro-tria/automation` | `npx tsc --noEmit -p .` | EXIT 0 |
| 14 | `financeiro-tria/automation` | `npm test` (isolado) | **769/769**, 0 falhas, 0 pulados, ~18.3 s (eram 751 antes de 06-17) |

Pontos de partida no momento dos testes: `crm-n1-integracao` `1a5adcc` (Task 1
deste plano já commitada), `financeiro-tria` `6767be1`. Nenhum servidor subiu
para os testes (3002 seguiu ocupado pela API normal do checkout, que os
testes não usam; 4100 e 4101 livres); `git status --short` limpo nos dois
repositórios depois. Este passo **não precisa de autorização do dono** (não
grava no `ws_n1` nem no Omie) e foi o único rodado nesta passagem do
checkpoint — a jornada (execução A), o crm2:CR-01 no real (execução B) e o
Omie real com dois anexos (3b) aguardam a autorização explícita do dono,
cada uma à parte.

### Jornada — respostas no fio (modo conferência)

**Só com a autorização explícita do dono, nesta conversa**, porque grava no
`ws_n1`: 2 contas "TESTE AUTOMATIZADO" (`cp-conferida`, `cp-ajuste`), os
Resumos, as Conferências e as respostas; Menções só ao `mem_tarjrn` (ou o
Membro do usuário de teste); nada no Omie. Sem autorização, registrar "não
autorizada nesta rodada" e deixar os comandos prontos para quando houver.

Antes: `lsof -nP -iTCP:3002 -sTCP:LISTEN`, `…:4100…` e `…:4101…` vazios (a
tela em 3001 pode ficar, se for deste checkout). Não editar `apps/web` nem
`packages/dominio` enquanto a jornada roda.

**O lançador** (script na pasta temporária, igual ao da rodada anterior, com
as duas correções do 06-15 — checagem da linha de partida pela forma
escapada do log e encerramento por SIGINT, a API ignora SIGTERM). Gera o
token com `openssl rand -hex 24` numa variável do shell, que nunca é
impressa nem gravada, e sobe três processos, com os logs na pasta temporária:

```bash
# 1. automation/ — sem watch, só em 127.0.0.1, sem nada em fundo
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && HOST=127.0.0.1 PORT=4100 INVOICE_CRON_ENABLED=false INVOICE_EMIT_DRAIN_MINUTES=0 PAYMENT_REQUEST_SOURCE=clickup PLATAFORMA_WEBHOOK_TOKEN= PLATAFORMA_LANCAMENTO_TOKEN="$TOKEN" npx tsx src/server.ts
# 2. o contador — proxy node em 127.0.0.1:4101 -> 4100; anota só instante, método, caminho e status
node <pasta temporária>/proxy-contador.mjs <pasta temporária>/proxy-requisicoes.log
# 3. a API — sem --watch, em conferencia, presa às contas de teste
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && AGENTE_CONTAS_A_PAGAR_ATIVO=true AGENTE_CONTAS_A_PAGAR_MODO=conferencia AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO" AGENTE_CONTAS_A_PAGAR_AVISAR_ID=mem_tarjrn AGENTE_CONTAS_A_PAGAR_URL=http://127.0.0.1:4101 PLATAFORMA_LANCAMENTO_TOKEN="$TOKEN" AGENTE_CONTAS_A_PAGAR_ESPACO_ID=ws_n1 AGENTE_CONTAS_A_PAGAR_LISTA_ID=lst_contas_a_pagar AGENTE_CONTAS_A_PAGAR_INTERVALO_MS=20000 npx vite-node src/index.ts
```

Esperado na partida: `escutando em http://127.0.0.1:4100`, `[cron]
desabilitado`, `[worker-plataforma] desligado (PAYMENT_REQUEST_SOURCE=clickup)`,
e a linha de partida da ponte (checada pela forma escapada:
`escopo=titulos-com:\"TESTE AUTOMATIZADO\"`): `modo=conferencia`,
`conferenciaPorComentario=true`, `integracaoManual=nao-encosta`,
`escopo=titulos-com:"TESTE AUTOMATIZADO"`, `avisar=membro-indicado`. Com
`avisar=financeiro`, `AVISAR_ID_INVALIDO`, ou recusa de subir: **parar**.

**A jornada** (as credenciais vêm do dono, só no ambiente do lançador):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && JORNADA_VISIVEL=1 JORNADA_MODO=conferencia JORNADA_SO=cp-conferida,cp-ajuste JORNADA_EMAIL=<e-mail do usuário de teste> JORNADA_SENHA=<senha do usuário de teste> npm run jornada:financeiro -w @n1/web
```

Esperado: `RESULTADO: OK — contas: …`; em `cp-conferida`: `respondido no fio
(<id>)`, `✅ Resumo conferido` a partir da resposta, `Card: conferido por
comentário`, o aviso do modo conferência, o Status em "em lançamento omie";
em `cp-ajuste`: `respondido no fio (<id>)`, `🔁 Ajuste pedido por`, `Revisado
a pedido de`, o card "Pendente". No contador: `/resolver` ≥ 3 e `/lancar` =
**0**. No log da API: as falhas de ciclo (`Falha no ciclo`, `Falha de banco
no ciclo`, `timeout`) contadas (0 na rodada anterior), e os códigos novos que
apareceram — esperado: nenhum `RESPOSTA_SEM_EFEITO`, `COMENTARIO_PENDENTE_DESISTIDO`
ou `ORCAMENTO_DO_CICLO_ESGOTADO`. As capturas ficam na pasta temporária.

Encerramento: SIGINT nos PIDs do lançador (a API ignora SIGTERM); SIGKILL só
de reserva, e só nesses PIDs.

**Autorização:** dada pelo dono em 2026-09-30, nesta conversa, por pergunta
direta do orquestrador (`AskUserQuestion`) — resposta literal: "Autorizo as
duas (Recomendado)", para a Execução A e a Execução B juntas. O executor
havia parado no checkpoint depois de rodar só os testes automatizados (a
"Testes" acima); o orquestrador, com essa autorização, rodou as execuções A
e B e repassou o relato ao executor, que registra aqui.

### Como rodou de verdade

A linha de partida bateu com o esperado na primeira subida (sem a troca
autorizada do minuto de 2026-09-30 que a rodada anterior precisou): `modo=conferencia
resumoAPartirDe=para-pagar conferenciaPorComentario=true
integracaoManual=nao-encosta escopo=titulos-com:"TESTE AUTOMATIZADO"
avisar=membro-indicado`. `automation/` local: `escutando em
http://127.0.0.1:4100`, `[cron] desabilitado`, `[worker-plataforma] desligado
(PAYMENT_REQUEST_SOURCE=clickup)`.

| Item | Resultado |
|---|---|
| Linha de partida da ponte | `ponte do Agente de lançamento ativa (modo=conferencia resumoAPartirDe=para-pagar conferenciaPorComentario=true integracaoManual=nao-encosta escopo=titulos-com:"TESTE AUTOMATIZADO" avisar=membro-indicado)` — casou na primeira subida |
| `RESULTADO` da jornada | `RESULTADO: OK — contas: tsk_tark6e, tsk_tark79` (exit 0) |
| `cp-conferida` — `tsk_tark6e` ("TESTE AUTOMATIZADO") | Resumo no fio em **20 s** → card "Pendente" → `Responder "ok" no fio do Resumo — respondido no fio (cmt_tark6u)` → `✅ Resumo conferido` em **7 s** → card "conferido por comentário" → "em lançamento omie" → aviso do modo conferência em **8 s** → Status continua "em lançamento omie" |
| `cp-ajuste` — `tsk_tark79` | Resumo no fio em **13 s** → card "Pendente" → `Responder no fio: "é prestação comercial, não ADM" — respondido no fio (cmt_tark7p)` → `🔁 Ajuste pedido por` em **8 s** → Resumo revisado (`Revisado a pedido de`) em **13 s** → Conferência nova, "Pendente" |
| Capturas (fora do git) | `cp-conferida-resumo.png`, `cp-conferida-ok-no-fio.png`, `cp-conferida-conferencia.png`, `cp-ajuste-resumo-revisado.png`, em `/var/folders/.../T/jornada-financeiro/` |
| Requisições da ponte (contador) | `17:23:44Z POST …/resolver -> 200` (tsk_tark6e) · `17:25:05Z POST …/resolver -> 200` (tsk_tark79) · `17:25:30Z POST …/resolver -> 200` (a revisão, com o pedido) |
| **`/resolver`** | **3** |
| **`/lancar`** | **0** |
| Falhas de ciclo no log da API (level 40/50) | **0** |
| Portas 3002, 4100 e 4101 no fim | livres entre A e B; a API normal do checkout (sem a ponte) voltou depois, no teardown final |

### crm2:CR-01 no real — a dispensa desmarcada (modo conferência, sem-conferencia)

**Só com a autorização explícita do dono para esta execução (à parte da
anterior).** Com o `automation/` e o contador de pé (da execução A), derrubar
só a API (SIGINT) e subi-la de novo com o MESMO comando mais
`AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL=sem-conferencia`:

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && AGENTE_CONTAS_A_PAGAR_ATIVO=true AGENTE_CONTAS_A_PAGAR_MODO=conferencia AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO" AGENTE_CONTAS_A_PAGAR_AVISAR_ID=mem_tarjrn AGENTE_CONTAS_A_PAGAR_URL=http://127.0.0.1:4101 PLATAFORMA_LANCAMENTO_TOKEN="$TOKEN" AGENTE_CONTAS_A_PAGAR_ESPACO_ID=ws_n1 AGENTE_CONTAS_A_PAGAR_LISTA_ID=lst_contas_a_pagar AGENTE_CONTAS_A_PAGAR_INTERVALO_MS=20000 AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL=sem-conferencia npx vite-node src/index.ts
```

A linha de partida tem de trazer `integracaoManual=sem-conferencia` e o resto
igual (senão, **parar**). Então:

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && JORNADA_VISIVEL=1 JORNADA_MODO=conferencia JORNADA_SO=cp-dispensa-manual JORNADA_ESPERA_CICLOS_MS=45000 JORNADA_EMAIL=<e-mail do usuário de teste> JORNADA_SENHA=<senha do usuário de teste> npm run jornada:financeiro -w @n1/web
```

Esperado: `RESULTADO: OK` com a nota `dispensa desmarcada: Resumo novo no
fio (<id>), nenhum aviso de "lançaria" até a resposta humana`; no log da API,
para a conta do cenário, "Resumo publicado com a Conferência dispensada
(Integração manual)." e depois "Resumo publicado para conferência.", e
NENHUM "Conferência — lançaria" antes da resposta "ok" (depois dela, é o
esperado); o contador com `/lancar` = **0**.

Se o passo da dispensa falhar no `ws_n1` (por exemplo
`DISPENSA_RECUSADA_PELO_DOMINIO`, o Membro de serviço sem publicar a resposta
canônica), a prova de B não vale: registrar o código e a mensagem do
cenário, levar ao dono como achado, e registrar "crm2:CR-01 provado só por
testes (06-18: `ponte-dispensa-e-fio.test.ts` (a)–(e) e as mutações M1, M2,
M9, M10)". Idem se esta execução não for autorizada.

**Autorização:** a mesma resposta da Execução A ("Autorizo as duas
(Recomendado)" — a pergunta cobria as duas execuções juntas). Rodada pelo
orquestrador, com o `automation/` e o contador subindo de novo (um token
novo — o da execução A é local ao processo e não sobrevive, por desenho, a
um reinício; nunca impresso nem gravado nos dois casos), e o relato
repassado ao executor, que registra aqui.

### Como rodou de verdade

Conta `tsk_tark86` ("TESTE AUTOMATIZADO — CP dispensa manual"). A linha de
partida trouxe `integracaoManual=sem-conferencia` e o resto igual — casou.
A sequência, confirmada pelo próprio log de passos do cenário e pelas linhas
do log da API (verbatim):

1. A conta, completa e "Manual", recebe a dispensa automática do Agente do
   pipeline: `"Resumo publicado com a Conferência dispensada (Integração
   manual)."` — `✅ Resumo conferido (a dispensa pelo Agente do pipeline)` em
   0 s; card oculto enquanto "Manual"; fio salvo (`cmt_tark8n`).
2. "Integração manual" é desmarcada pelo gesto da jornada (`desmarcarEscolha()`,
   o `pagina.route` documentado em `06-19-SUMMARY.md`, desvio 4 — o Campo de
   escolha única não tem opção vazia pela tela).
3. Um SEGUNDO Resumo aparece em **14 s**, respondendo no MESMO fio
   (`cmt_tark8z` → pai `cmt_tark8n`), com "Os dados da conta mudaram depois
   da conferência."; a API já não diz "dispensada": `"Resumo publicado para
   conferência."`.
4. O card volta a "Conferência do Resumo · Pendente" — passa a exigir uma
   pessoa.
5. A jornada move o Status para "em lançamento omie" mesmo assim (para
   forçar o caso): **dois ciclos da ponte** passam sem nenhum aviso de
   "lançaria", sem conferir sozinha e com o card continuando "Pendente".
6. A jornada responde "ok" no fio (`cmt_tark8n`) → API: `"Resumo conferido
   por resposta no fio."` — agora uma decisão humana de verdade, não a
   dispensa automática — `✅ Resumo conferido (a pessoa)` em 9 s.
7. Só então a API registra `"Conferência — lançaria: TRIA · Contas de
   Consumo (2.04.03)."` — o aviso normal do modo `conferencia` uma vez que
   existe Conferência humana válida; não é um lançamento de verdade (o modo
   é `conferencia`, zero `/lancar` por código).
8. Aviso do modo conferência em 18 s; Status continua "em lançamento omie".

| Item | Resultado |
|---|---|
| Linha de partida da ponte (com `sem-conferencia`) | `...integracaoManual=sem-conferencia escopo=titulos-com:"TESTE AUTOMATIZADO" avisar=membro-indicado` — casou |
| `RESULTADO` da jornada | `RESULTADO: OK — contas: tsk_tark86` |
| Nota do cenário | dispensa desmarcada: Resumo novo no fio (`cmt_tark8z`, pai `cmt_tark8n`), nenhum aviso de "lançaria" até a resposta humana (o "lançaria" só saiu DEPOIS do "ok", como esperado) |
| Log da API (as três frases, na ordem) | (1) `"Resumo publicado com a Conferência dispensada (Integração manual)."` → (2, depois de desmarcar) `"Resumo publicado para conferência."` (sem `"lançaria"` entre elas) → (3, depois do "ok") `"Conferência — lançaria: TRIA · Contas de Consumo (2.04.03)."` |
| Requisições da ponte (contador) | `17:28:13Z POST …/resolver -> 200` · `17:28:32Z POST …/resolver -> 200` |
| **`/resolver`** | **2** |
| **`/lancar`** | **0** |
| Falhas de ciclo | **0** |
| Desfecho | **rodou, `RESULTADO: OK`** — crm2:CR-01 provado no REAL (não só pelo teste `ponte-dispensa-e-fio.test.ts` de 06-18): desmarcar "Manual" invalida a dispensa vigente, um Resumo novo vai a uma pessoa no mesmo fio, e a ponte não toma nenhuma ação autônoma (nenhum "lançaria", nenhuma conferência automática) enquanto ele está pendente |

### Omie real — dois anexos no mesmo título (fin2:IN-07, opcional)

**Opcional, só com autorização explícita do dono (à parte das duas
anteriores).** fin2:IN-07, deixado pelo 06-17: lança R$ 1,00 no Omie da
Tria, sobe dois anexos no mesmo título, repete, confere e exclui. Antes,
conferir no `06-17-SUMMARY.md` se o script aceita mais de um `--anexo` (na
véspera, aceitava um só).

Se aceitar dois:

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && npm run teste:omie-real -- --lancar --anexo=<pasta temporária>/TESTE-AUTOMATIZADO-anexo-1.pdf --anexo=<pasta temporária>/TESTE-AUTOMATIZADO-anexo-2.pdf
```

Esperado: todos os passos com ✔; `anexos: 2 de 2` no primeiro `/lancar`, os
dois no MESMO título (`cCodIntAnexo` igual ao id do título, nomes
desambiguados se iguais); na repetição, `reaproveitado: true` e os dois
`{ ok: true, jaExistia: true }`; nenhum item de `anexos` com `url`; o título
excluído e confirmado "não cadastrado" pelo id, com espera (~60 s; o Omie
demora a refletir a exclusão). Uma falha transitória do próprio Omie antes de
qualquer gravação pode ser repetida uma vez, dentro da mesma autorização.

Se o script aceitar um anexo só, ou sem autorização: registrar "fin2:IN-07 —
o que o legado já faz (o `cCodIntAnexo` igual ao id do título), sem prova
real nesta rodada; fica com o dono", com o motivo.

**Autorização:** não chegou a ser pedida — a conferência prévia mostrou que
`financeiro-tria/automation/scripts/teste-omie-real.ts` (estado do 06-17,
`6767be1`) só aceita um `--anexo`. Rodar com dois exigiria um ajuste no
script antes, fora do escopo de "sem re-rodar nada" desta passagem.

| Item | Resultado |
|---|---|
| Desfecho | **não rodado** — "fin2:IN-07 — o que o legado já faz (o `cCodIntAnexo` igual ao id do título, provado com um anexo só nas rodadas anteriores), sem prova real nesta rodada com DOIS anexos; fica com o dono" |
| Motivo | `scripts/teste-omie-real.ts` aceita hoje um só `--anexo` (06-17-SUMMARY.md confirma); o item 11 de "Decisões pendentes" do roteiro já registra isso e continua aberto |

### Fica com o dono

O que só o dono faz (regra 8 de `06-CONTEXT.md`), com o comando e o
esperado.

1. **A ordem de implantação** (crm2:WR-02): o `automation/` com o contrato
   v1.2 e o que 06-16/06-17 mudaram — push, deploy, `.env` de produção
   (`CONTAS_A_PAGAR_ANEXOS_HOSTS` e as variáveis que os SUMMARYs listam,
   sem variável nova em 06-16/06-17) — ANTES da API com a ponte.
2. **Passo 2B em `lancar`** (verificação humana 1 de `06-VERIFICATION.md`): a
   API em `lancar`, o `automation/` local com `CONTAS_A_PAGAR_ANEXOS_HOSTS`,
   uma conta de teste com anexo conferida respondendo "ok" no fio. Esperado:
   durante o `/lancar`, o card mostra "O Agente está lançando esta conta no
   Omie agora"; depois, `✅ Lançado no Omie — título … · anexos 1 de 1` e
   "lançado omie"; numa recusa, a conta volta a "para pagar". É o que falta
   para RES-03.
3. **S5/S6 ao vivo** depois do deploy (verificação humana 2), com o que
   06-16 mudou (a varredura não publica sobre uma Solicitação que deixou de
   estar aprovada).
4. **A API de produção** com as variáveis de 06-13 e as desta rodada,
   primeiro em `conferencia`, com `SO_TITULOS_COM` e `AVISAR_ID` vazias;
   depois `lancar`.
5. **Push e merge** de `integra-frontend-main` (o agente nunca faz push).
6. **As decisões D6-01..D6-04**, se ainda abertas — se o dono escolher
   `sem-conferencia`, a dispensa passa a valer só enquanto "Manual" (RN-CP-11).
7. **Os timeouts do ciclo**, se voltaram (os códigos de 06-13).
8. **O que 06-16/06-17 deixaram para o dono**, pelos SUMMARYs deles: o
   resíduo de fin2:CR-01 (duas decisões da mesma Tarefa em paralelo antes de
   qualquer uma gravar a marca — sem trava por Tarefa no banco, é migração,
   só do dono, pelo SQL Editor) e, se o passo acima (Omie real com dois
   anexos) não rodou, a conferência de dois anexos no mesmo título no Omie
   real, quando o dono quiser.

| Item | Situação |
|---|---|
| 1. Ordem de implantação | pendente — com o dono |
| 2. Passo 2B em `lancar` | pendente — com o dono |
| 3. S5/S6 ao vivo | pendente — depois do deploy |
| 4. API de produção | pendente — com o dono |
| 5. Push e merge | pendente — o agente nunca faz push |
| 6. D6-01..D6-04 | pendente — os padrões seguem em vigor, trocáveis por variável |
| 7. Timeouts do ciclo | **não voltaram** nas execuções A e B (0 falhas de ciclo nas duas); acompanhar em produção pelos códigos `TRAVA_ESGOTADA`, `TEMPO_DE_CONSULTA_ESGOTADO`, `TEMPO_DE_CONEXAO_ESGOTADO` e, desde 06-13/06-19, `ORCAMENTO_DO_CICLO_ESGOTADO` e `AVISAR_ID_INVALIDO` |
| 8. Resíduo fin2:CR-01 / Omie real com dois anexos | **fin2:CR-01** (06-16): duas decisões da mesma Tarefa em paralelo antes de qualquer uma gravar a marca — sem trava por Tarefa no banco (seria migração, só do dono, pelo SQL Editor); o RESUMO segue protegido pela releitura do Status. **Omie real com dois anexos** (fin2:IN-07): não rodou nesta rodada (3b acima) — o script aceita um anexo só; ajustá-lo e rodar fica com o dono, quando quiser |

## Jornada final, depois do 06-22 — 2026-09-30

A última jornada era a do 06-20. Depois dela, 06-21 (`e176f7f`, `8186d3a`) e
06-22 (`1c265d8`) mudaram a ponte e o domínio justamente na dispensa por
Integração manual, e foram provados só por testes sem navegador, mutação e
revisão. Esta rodada roda a jornada contra o código final e acrescenta um
cenário que prova ao vivo o conserto do 06-21 (o Crítico do 06-REVIEW-3).

**Autorização:** o dono perguntou "vc rodou testes automatizado como humano
para ver se tava tudo funcionando?"; o orquestrador respondeu que não depois
do 06-20 e perguntou (`AskUserQuestion`) se rodava de novo, gravando contas
"TESTE AUTOMATIZADO" no `ws_n1` — resposta literal: "Regressão + cenário novo
(Recomendado)".

Pontos de partida: `crm-n1-integracao` em `7f40ff1` (o código do 06-22 mais o
cenário `cp-dispensa-com-resposta` na jornada — nada mais mudou) e
`financeiro-tria` em `6767be1` (os 89 arquivos sujos só de fim de linha,
intocados). A API e a tela foram reiniciadas antes, com o código final (a API
de pé era das 14:30, de antes do 06-21; a tela, de 29/09).

### Como rodou

Um lançador por rodada (pasta temporária, fora do git), no molde do 06-20: o
`automation/` local em 4100, o contador em 4101 (só instante, método, caminho
e status), o token de `openssl rand -hex 24` numa variável do shell — nunca
impresso nem gravado —, `OUTBOX_WORKER_ATIVO=false` e
`AUTOMACOES_WORKER_ATIVO=false` explícitos, e encerramento por SIGINT. As
portas G2/G3 de sempre (`SO_TITULOS_COM="TESTE AUTOMATIZADO"`,
`AVISAR_ID=mem_tarjrn`), modo `conferencia`.

| Rodada | Arranjo | `INTEGRACAO_MANUAL` | Ciclo | Cenários |
|---|---|---|---|---|
| 1 | a API da tela (3002) COM a ponte, cutucada pelas gravações | `nao-encosta` | 20 s | `cp-conferida`, `cp-conferida-pelo-card`, `cp-ajuste` |
| 2 | idem | `sem-conferencia` | 20 s | `cp-dispensa-manual` |
| 3 | a API da tela (3002) SEM a ponte; a ponte numa segunda API (3003), só no relógio | `sem-conferencia` | 120 s | `cp-dispensa-com-resposta` (novo) |

A linha de partida da ponte casou nas três (`modo=conferencia
resumoAPartirDe=para-pagar conferenciaPorComentario=true
integracaoManual=<o da rodada> escopo=titulos-com:"TESTE AUTOMATIZADO"
avisar=membro-indicado`); na Rodada 3, a API da tela subiu sem nenhuma linha
da ponte.

### Resultado

| Cenário | Conta | Desfecho |
|---|---|---|
| `cp-conferida` | `tsk_tark9e` | **OK** (retomado do passo 10, ver incidente 1): Resumo `cmt_tark9u` → "ok" no fio → `✅ Resumo conferido` em 6 s → card "Conferido · por comentário" → "em lançamento omie" → aviso do modo conferência em 6 s |
| `cp-conferida-pelo-card` | `tsk_tarkbc` | **OK** (2ª tentativa, ver achado 1): Resumo em 12 s → "Conferido, pode lançar" no card → `✅` na hora → aviso do modo conferência em 7 s |
| `cp-ajuste` | `tsk_tarka6` | **OK**: Resumo em 19 s → resposta "é prestação comercial, não ADM" → `🔁 Ajuste pedido por` em 12 s → Resumo revisado em 11 s → card "Pendente" |
| `cp-dispensa-manual` | `tsk_tarkc5` | **OK**: dispensa automática → desmarcar "Manual" → 2º Resumo no mesmo fio em 13 s (`cmt_tarkcy`) → dois ciclos sem "lançaria" → "ok" → `✅` da pessoa em 7 s → aviso em 12 s. Log da ponte, na ordem: dispensada 21:51:16 → para conferência 21:51:37 → conferido por resposta 21:52:46 → "lançaria" 21:52:54 (só depois do "ok") |
| `cp-dispensa-com-resposta` | `tsk_tarkdd` | **OK** — a prova do 06-21, abaixo |

| Contador | Rodada 1 | Rodada 2 | Rodada 3 | Total |
|---|---|---|---|---|
| `/resolver` | 4 | 2 | 2 | **8** |
| `/lancar` | 0 | 0 | 0 | **0** |
| Falhas de ciclo | 0 | 0 | 0 | **0** |

### O conserto do 06-21 no real (`cp-dispensa-com-resposta`)

O Crítico do 06-REVIEW-3: uma resposta humana ainda não lida no fio e
"Integração manual" marcada antes de a ponte lê-la — a ponte dispensava a
Conferência por cima e a resposta sumia. Para a ponte ver as duas coisas no
MESMO ciclo, ela rodou à parte, só no relógio (as gravações da tela vão para
outro processo e não a cutucam), e o cenário conferiu pelo relógio dela que
as duas gravações caíram entre os mesmos dois tiques. O ciclo lê o Espaço uma
vez, no começo (`hidratarEstado()`), e decide todas as contas sobre essa
leitura.

| Instante (UTC) | O quê |
|---|---|
| 00:53:39 | tique 0 — a ponte sobe (linha de partida) |
| 00:55:39 → 00:55:54 | tique 1 — `Resumo publicado para conferência.` (ciclo de 15 s); card "Pendente" |
| 00:56:00 → 00:56:06 | a jornada responde no fio "troca a categoria para 2.04.03" e marca "Integração manual" = Manual — nenhum ciclo em voo |
| 00:57:39 → 00:57:43 | tique 2 — a leitura vê a resposta pendente E o Manual: `Ajuste do Resumo pedido por resposta no fio.` — nenhum `✅` antes do `🔁` |
| 00:59:39 → 00:59:46 | tique 3 — `Resumo publicado com a Conferência dispensada (Integração manual).`: o Resumo REVISADO (com o código 2.04.03 da resposta) é que foi dispensado |

Ordem no tópico, conferida pelo cenário: resposta `cmt_tarkdz` → `🔁 Ajuste
pedido` `cmt_tarke2` → Resumo revisado `cmt_tarke5` → `✅ Resumo conferido`
`cmt_tarkeb`; card escondido (a conta é Manual). Nenhum ciclo fora do relógio
(0 falhas, recuperações ou cutucadas no log da ponte). Com o código anterior
ao 06-21, o tique 2 dispensaria o Resumo original (`✅` sem `🔁`) e o cenário
falharia em "a ponte dispensou por cima da resposta pendente".

### Incidentes e achados

1. **Ambiente — a tela do Mac apagou (não é defeito).** Às 21:44:07 (local),
   na bateria (73%), o macOS apagou a tela e suspendeu a rede do Chromium:
   `page.reload: net::ERR_NETWORK_IO_SUSPENDED` no passo 10 do `cp-conferida`
   (`pmset -g log`: "Display is turned off" 21:44:07, de volta 21:44:12).
   Retomado com `JORNADA_RETOMAR=cp-conferida=tsk_tark9e@10` na mesma conta —
   OK; o resto rodou com `caffeinate -dims`.
2. **Achado 1 — defeito real na tela: o popup da conta nova abre um id que o
   servidor não deu.** Na 1ª tentativa do `cp-conferida-pelo-card`, o popup
   abriu `tsk_tark9u` com "Conta não encontrada". `run()` (`dados/store.ts`)
   roda a operação numa cópia local e a tela abre o popup com o id da cópia
   (`openTask(result.value.id)`, `estrutura/listas/[lista]/page.tsx`); o
   comentário do store supõe que a cópia gera "os MESMOS ids que o servidor
   vai gerar" — só vale se ninguém gravou desde a última hidratação. A ponte
   publicou o Resumo do `tsk_tark9e` às 21:44:12, no mesmo segundo do
   `createTask`, como `cmt_tark9u`: exatamente o número que a tela calculou
   para a conta. O servidor criou a conta com um id seguinte, e o popup ficou
   num id inexistente. Com duas pessoas criando contas juntas, o popup
   poderia abrir a conta da OUTRA. A 2ª tentativa (`tsk_tarkbc`), com a ponte
   ociosa, passou. Sobrou uma conta "TESTE AUTOMATIZADO — CP conferida pelo
   card · 30/09 21:44" só com o nome, no id que o servidor deu. Não é código
   desta fase (é o D-05 da Fase 1), mas a ponte desta fase o torna provável.
3. **Achado 2 — a tela não vê sozinha o que a ponte grava.** A jornada
   recarrega a página a cada 3 s porque o popup da conta não tem tempo real,
   consulta periódica nem revalidação ao focar: o store só re-hidrata depois
   de uma gravação da própria pessoa com revisão defasada, ou num conflito
   (D-06). Para o Financeiro, o Resumo do Agente não aparece sem recarregar —
   no ClickUp, aparece. É a mesma raiz do achado 1.

**Recomendação (com o dono):** uma consulta leve à revisão do Espaço,
enquanto a conta está aberta, que re-hidrata quando ela muda; e a criação de
conta abrindo o popup só com o id confirmado pelo servidor. Tempo real
(Supabase Realtime/SSE) fica para depois.

### Conferência do conteúdo (lida da tela depois da rodada)

O dono perguntou se a rodada "foi lançada no Omie" e se os dados foram
conferidos. **Nada foi ao Omie** — as três rodadas foram em `conferencia`
(zero `/lancar` por desenho); o lançamento pela plataforma é o passo 2B em
`lancar`, ainda com o dono. A jornada conferia presença de textos, cards,
Status e ordem — não o conteúdo. Depois da rodada, um script só de leitura
(entra como o usuário de teste e lê cada conta na tela, sem gravar nada) puxou
Campos, Status e fio das cinco contas:

| O quê | Esperado (o que a jornada preencheu) | Lido nas cinco contas |
|---|---|---|
| Centro de Custo · Empresa | TRIA · Tria Company | igual |
| Categoria de pagamento | Contas de consumo | igual |
| Fornecedor · CNPJ · Nome | CNPJ · 11.222.333/0001-81 · Fornecedor Teste Automatizado LTDA | igual (não aparecem no Resumo; vão no corpo do `/lancar`) |
| Forma · Chave pix | Chave Pix · teste-integracao@triacompany.com.br | igual, e no Resumo |
| Valor | R$ 123,45 | igual, e no Resumo |
| Vencimento | hoje + 10 = 10/10/2026 | "📅 Vencimento: 10/10/2026" no Resumo (a data foi para o vencimento) |
| Conta pagamento | inferida do Centro de Custo (sem Tag "conta *") | "TRIA", com a observação "Confirmar antes da remessa" |
| Categoria · Código no Resumo | o de-para do `/resolver` contra o plano de contas REAL da Tria (leitura) | Contas de Consumo · 2.04.03 |
| Status | por cenário | `em lançamento omie` (conferida, conferida-pelo-card, dispensa-manual); `para pagar` (ajuste, com o revisado pendente; dispensa-com-resposta, Manual) |

Achados de conteúdo:

4. **O ajuste por texto livre não mudou o Resumo.** No `cp-ajuste`, a
   resposta "é prestação comercial, não ADM" gerou um "Resumo revisado"
   IDÊNTICO ao original (Contas de Consumo · 2.04.03), só com "Revisado a
   pedido de…". Causa: o `/resolver` (`automation/`,
   `consultaDeCategoria`) busca a categoria no RAG com título + o Campo
   "Categoria de pagamento" + descrição, e o pedido só no fim — com o Campo
   dizendo "Contas de consumo", a busca volta à mesma categoria. O legado
   (`reviseSummary`) faz a mesma consulta; lá, uma IA reescreve o texto do
   Resumo, aqui não. Hoje, só a resposta com o CÓDIGO
   (`codigoCategoriaConfirmado`) troca a categoria com certeza. O cenário
   `cp-dispensa-com-resposta` usou o código 2.04.03 — o mesmo da original,
   para ser determinístico —, então também não exercitou uma troca de
   categoria de verdade.
5. **Texto estranho na dispensa (cosmético).** Numa conta Manual, o Resumo
   revisado termina com "Agente do pipeline, confira de novo…" e, logo
   abaixo, "✅ Resumo conferido por Agente do pipeline": o Agente pede a si
   mesmo que confira (D6-04 faz o Membro de serviço aprovador).
6. **O achado 1 confirmado:** a conta órfã do 1º `cp-conferida-pelo-card`
   ("… · 30/09 21:43", só o nome) existe como **`tsk_tarka0`**; o popup
   tinha aberto `tsk_tark9u`. A ponte gastou `tark9u`…`tark9z` no Resumo de
   `tsk_tark9e` e a conta ficou com o número seguinte.
