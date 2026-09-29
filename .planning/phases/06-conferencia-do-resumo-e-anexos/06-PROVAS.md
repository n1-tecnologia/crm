# Fase 6 — As provas

Plano 06-06, Task 2. A regra da migração: "provar é a mesma coisa". Cada rodada
termina com as provas registradas, e não com a promessa delas.

**Estado deste relato (2026-09-29):** os testes rodaram e estão registrados
abaixo. A jornada em modo `conferencia` e o teste real do Omie com anexo
**aguardam a autorização do dono**. Os comandos estão escritos aqui, prontos,
com `<…>` no lugar de todo segredo ou id.

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

**Aguardando autorização do dono.** A ponte em `conferencia` grava Resumos,
Conferências e Comentários de verdade no `ws_n1` (produção do CRM N1), só nas
contas com "TESTE AUTOMATIZADO" no título, e menciona só o usuário de teste.
Nada vai ao Omie.

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

| Item | Resultado |
|---|---|
| Linha de partida da ponte | aguardando |
| `RESULTADO` da jornada | aguardando |
| Ids das contas de teste | aguardando |
| Capturas | aguardando |
| `/resolver` no log do Terminal A | aguardando |
| `/lancar` no log do Terminal A | aguardando (tem de ser 0) |

Depois: `Ctrl+C` nos quatro terminais. As contas de teste ficam no `ws_n1`,
com "TESTE AUTOMATIZADO" no título, para consulta; descartar pela tela se o
dono preferir.

---

## Omie real com anexo

**Aguardando autorização do dono.** Este teste lança um título de verdade no
Omie da Tria (R$ 1,00, fornecedor que já existe), sobe um anexo por
`IncluirAnexo`, confere e **exclui** o título no fim.

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
| `RESULTADO` | aguardando |
| Id do título | aguardando |
| Anexo (`anexos: n de 1`, nome) | aguardando |
| Exclusão confirmada | aguardando |

---

## Fica com o dono

1. **Autorizar as duas provas acima** (a jornada em `conferencia` contra o
   `ws_n1` e o `teste:omie-real --lancar --anexo`). Informar ou conferir o id
   do Membro do usuário de teste no `ws_n1` (Configurações → Membros), que vai
   em `AGENTE_CONTAS_A_PAGAR_AVISAR_ID`.
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
