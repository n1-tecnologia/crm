# Fase 7 — As provas

Plano 07-13. A regra da Fase 6 vale aqui: "provar é a mesma coisa". A fase
termina com a 007 no banco da plataforma e a prova de que ela foi conferida
antes (D-12), e não com a promessa disso.

**Estado deste relato (2026-10-11):** a conferência seca, a aplicação e a
confirmação estão registradas abaixo, as três do mesmo dia. O roteiro da UAT
está pronto com a coluna "Resultado" em branco — ela é preenchida no lote de
fim de fase (`workflow.human_verify_mode = end-of-phase`), no app real, pelo
dono ou por quem ele indicar. Nenhum segredo está neste arquivo: as saídas
abaixo não trazem `DATABASE_URL`, host nem senha.

Ponto de partida do código: `main` em `ebf5108` (o último commit de 07-12),
com a 007 corrigida de 07-05 (`apps/api/migracoes/007-crm.sql`, o trigger de
admin × lixeira) e o `--seco` de 07-12.

O que `--seco` faz (`apps/api/src/persistencia/migrar.cli.ts` →
`migracoesPendentes()` em `migrar.ts`): lê a pasta `migracoes/` na mesma
ordem em que `migrar()` aplicaria, pergunta `to_regclass('plataforma.migracoes')`
e, só se a tabela de controle existir, faz `select nome` nela. Imprime
`aplicada  <nome>` ou `pendente  <nome>` por arquivo e a linha
`N pendente(s); nada foi aplicado (--seco).`. Não há `create` nem `insert` no
caminho — num banco vazio, nem o schema `plataforma` nasce (provado em 07-12,
casos (a) e (c) de `migrar-seco.test.ts`). Sem `--seco`, o mesmo comando
aplica o que falta, cada arquivo numa transação, e registra o nome em
`plataforma.migracoes` — por isso um arquivo aplicado é imutável e qualquer
ajuste de schema do CRM, daqui em diante, é `008`.

---

## Conferência de D-12

**Feita pelo dono em 2026-10-11 (UTC), no checkout principal, com o
`apps/api/.env` da plataforma.** É o passo 1 da Task 1: antes do primeiro
`migrar` com a 007, ver o que ele aplicaria. O critério de parada de D-12 era
a 007 aparecer como `aplicada` — nesse caso a correção do trigger viraria
`008-crm-admin-lixeira.sql` e o plano não seguiria. Não foi o caso.

```
$ npm run migrar -w @n1/api -- --seco

> @n1/api@0.1.0 migrar
> vite-node src/persistencia/migrar.cli.ts --seco

[conexao] DATABASE_SSL_INSECURE=true: a verificação da cadeia TLS do Postgres está DESLIGADA. Isto é proibido fora de desenvolvimento local — nesse modo um MITM na rota poderia ler e alterar dado financeiro sem detecção (T-02-TLS). Fixe DATABASE_CA_CERT ou DATABASE_CA_PATH antes de qualquer ambiente que não seja o notebook do desenvolvedor.
aplicada  001-plataforma.sql
aplicada  002-registros-colunas-geradas.sql
aplicada  003-integracao-e-importacao.sql
aplicada  004-outbox-indice-unico-por-workspace.sql
aplicada  005-agenda-de-automacoes.sql
aplicada  006-outbox-indice-unico-canal.sql
pendente  007-crm.sql
1 pendente(s); nada foi aplicado (--seco).
```

| Critério (Task 1) | Resultado |
|---|---|
| `001-plataforma.sql` … `006-outbox-indice-unico-canal.sql` como `aplicada` | sim, as seis |
| `pendente  007-crm.sql` presente | sim |
| `aplicada  007-crm.sql` ausente | sim — a 007 nunca tinha sido aplicada neste banco, como D-12 supunha |

A linha `[conexao] DATABASE_SSL_INSECURE=true …` faz parte da saída real e
fica como está: é o aviso de T-02-TLS do `conexao.ts`, que diz que a cadeia
TLS do Postgres não está sendo verificada neste notebook. Não é desta fase
(ver "Limitações aceitas").

---

## Aplicação

**Feita pelo dono em 2026-10-11 (UTC), logo depois da conferência, no mesmo
checkout.** O passo 2 da Task 1 — o único comando desta fase que escreve no
banco da plataforma, e por isso o único que o agente não roda (STATE.md,
"Blockers/Concerns": o classificador de permissão recusa `migrar` contra o
banco real; e o plano põe a aplicação atrás de um gate `blocking-human`,
T-07-38).

```
$ npm run migrar -w @n1/api

> @n1/api@0.1.0 migrar
> vite-node src/persistencia/migrar.cli.ts

[conexao] DATABASE_SSL_INSECURE=true: a verificação da cadeia TLS do Postgres está DESLIGADA. Isto é proibido fora de desenvolvimento local — nesse modo um MITM na rota poderia ler e alterar dado financeiro sem detecção (T-02-TLS). Fixe DATABASE_CA_CERT ou DATABASE_CA_PATH antes de qualquer ambiente que não seja o notebook do desenvolvedor.
aplicada  007-crm.sql  (984 ms)
```

| Critério (Task 1) | Resultado |
|---|---|
| `aplicada  007-crm.sql` presente | sim — 984 ms, uma transação, só ela (001-006 não reaparecem porque já constavam em `plataforma.migracoes`) |

As tabelas do CRM (`plataforma.contatos`, `contato_identificadores`,
`empresas`, `empresa_identificadores`, `contato_empresa`, `funis`, `etapas`,
`negocios` e os vínculos) nascem vazias. Desfazer, se um dia for preciso,
seria `drop` sem perda de dado — mas o caminho normal, a partir de agora, é
`008`.

---

## Confirmação

**Feita pelo agente em 2026-10-11T16:52:32Z, no checkout principal
(`main` em `ebf5108`), somente leitura.** É a segunda conferência seca de
D-12, depois da aplicação: o esperado era nenhum `pendente`. O ambiente não
recusou a conexão nem o comando — o `--seco` rodou de verdade contra o banco
da plataforma (o mesmo `apps/api/.env` do dono), e esta é a saída:

```
$ npm run migrar -w @n1/api -- --seco

> @n1/api@0.1.0 migrar
> vite-node src/persistencia/migrar.cli.ts --seco

[conexao] DATABASE_SSL_INSECURE=true: a verificação da cadeia TLS do Postgres está DESLIGADA. Isto é proibido fora de desenvolvimento local — nesse modo um MITM na rota poderia ler e alterar dado financeiro sem detecção (T-02-TLS). Fixe DATABASE_CA_CERT ou DATABASE_CA_PATH antes de qualquer ambiente que não seja o notebook do desenvolvedor.
aplicada  001-plataforma.sql
aplicada  002-registros-colunas-geradas.sql
aplicada  003-integracao-e-importacao.sql
aplicada  004-outbox-indice-unico-por-workspace.sql
aplicada  005-agenda-de-automacoes.sql
aplicada  006-outbox-indice-unico-canal.sql
aplicada  007-crm.sql
0 pendente(s); nada foi aplicado (--seco).
```

| Critério (Task 2) | Resultado |
|---|---|
| nenhuma linha `pendente` | sim — `0 pendente(s)` |
| `aplicada  007-crm.sql` | sim — a 007 consta em `plataforma.migracoes` |
| nada foi escrito | sim, por contrato do `--seco` (07-12) e pela própria linha final |

As três saídas são coerentes entre si: 1 pendente antes, a 007 aplicada em
984 ms, 0 pendentes depois. O `npm run migrar -w @n1/api` sem `--seco` não
foi rodado pelo agente em nenhum momento (nem seria preciso: ele imprimiria
`Nada a aplicar: o banco já está em dia.`).

---

## Roteiro da UAT

**Quando:** no lote de fim de fase, depois da verificação automática da fase
(verificador, revisão de código, regressão). **Onde:** no app real — `npm run
dev` da raiz sobe web (3001) e api (3002) contra o banco da plataforma, com
a 007 aplicada (acima). **Quem:** o dono, ou quem ele indicar, com dois
logins reais do Supabase no mesmo Espaço de Trabalho: um Administrador (ou
Proprietário) e um Membro (D-14). **Por que humano:** o fluxo depende de JWT
real do Supabase, do navegador e do banco da plataforma — nenhum teste
automatizado desta base tem as três coisas juntas (`07-VALIDATION.md`,
"Manual-Only Verifications"). O que está coberto por teste: o mesmo fluxo por
`app.inject` contra Postgres local (`apps/api/src/e2e/crm-fluxo.test.ts`,
07-12, 8 casos) e as telas com `fetch` falso (07-06, 07-09, 07-10, 07-11).

Antes de começar: `lsof -nP -iTCP:3001 -sTCP:LISTEN` e `…:3002…` vazios (ou
o `npm run dev` deste checkout já de pé); a api precisa do `apps/api/.env`
da plataforma. Recarregar a página depois de cada gravação é parte do
critério: o dado tem de vir da api, não da memória da tela.

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 1 | Como Administrador, `/crm/funis` → "Novo Funil" com nome **Vendas**, duas Etapas (ex.: "Novo" e "Proposta") e "Exigir valor ao marcar ganho" ligado | O Funil é criado e aparece como **padrão** sem ninguém marcar (é o primeiro do Espaço, D-13); recarregar mantém o Funil, as duas Etapas e a regra | conforme o esperado — UAT do dono em 2026-10-11 |
| 2 | `/crm/contatos` → "Novo Contato" com nome **Ana** e um e-mail | A Ana aparece na lista e na ficha com o e-mail (normalizado em minúsculas); recarregar mantém | conforme o esperado — UAT do dono em 2026-10-11 |
| 3 | `/crm/empresas` → "Nova Empresa" com nome **Alfa** e a Ana como admin (no mesmo formulário, D-08) | A Alfa é criada com a Ana como admin; a ficha da Alfa mostra o vínculo e a ficha da Ana mostra a Alfa; recarregar mantém | conforme o esperado — UAT do dono em 2026-10-11 |
| 4 | `/crm/negocios` → "Novo Negócio" da Alfa (sem escolher Funil); arrastar o cartão para a segunda Etapa; "Ganhar" **sem** valor; "Ganhar" **com** valor; "Reabrir" | O Negócio nasce em Vendas / primeira Etapa (D-13); o arrasto o move e a nova Etapa persiste ao recarregar; "Ganhar" sem valor é **recusado** com a frase da Regra do Funil (exige valor — D-05) e o cartão fica onde está; com valor, o Negócio fica **ganho**; "Reabrir" (Administrador) o devolve a **aberto** (D-14) | conforme o esperado — UAT do dono em 2026-10-11 |
| 5 | Ficha da Ana → "Excluir" | **Recusa**: a Ana é a última admin da Alfa e Contato do Negócio; a mensagem lista a Alfa e o Negócio **com link** para cada um (D-09); a Ana continua ativa depois de recarregar | conforme o esperado — UAT do dono em 2026-10-11 |
| 6 | Ficha do Funil **Vendas** → "Excluir" (recusa) → criar um segundo Funil (ex.: **Pós-venda**) e torná-lo padrão → "Excluir" Vendas de novo → "Migrar Negócios" para Pós-venda → "Excluir" → aba **Lixeira** → "Restaurar" | A primeira recusa é por ser o Funil padrão; depois de Pós-venda virar padrão, a recusa é por ainda ter Negócios, com a contagem (D-07); a migração leva o Negócio para Pós-venda; a exclusão manda Vendas à **Lixeira** (D-06); a Lixeira o lista e "Restaurar" o traz de volta como ativo (não-padrão); recarregar mantém cada estado | conforme o esperado — UAT do dono em 2026-10-11 |
| 7 | Sair e entrar como **Membro**: `/crm/funis`; ficha de Vendas; ficha de um Negócio **ganho** (ganhar um antes, se preciso) | Funis só **leitura**: sem "Novo Funil", sem editar Etapas, sem "Excluir" — os controles aparecem desabilitados com o motivo (D-14); "Reabrir" do Negócio ganho desabilitado com o motivo; criar Contato, Empresa e Negócio continua permitido ao Membro | conforme o esperado — UAT do dono em 2026-10-11 |
| 8 | Busca global (a barra do shell): procurar um registro **antigo** do CRM (um Contact/Deal do modelo em inglês, que existia antes desta fase) e abri-lo | O registro antigo continua aparecendo e abre a ficha antiga (D-15); os registros criados nos passos 2-4 **não** aparecem na Busca global — limitação aceita, não defeito | conforme o esperado — UAT do dono em 2026-10-11 |

**O que este roteiro fecha no `WINDOWS.md`:** as janelas `unrun-verify`
**#1** (07-06, Contatos — passos 2 e 5), **#2** (07-09, Empresas — passo 3 e
o vínculo no passo 5), **#3** (07-10, quadro de Negócios — passo 4) e **#4**
(07-11, ficha de Negócio e a seção Negócios das fichas — passos 4, 5 e 7)
foram abertas porque nenhuma tela do CRM tinha sido exercitada em navegador
real. Cada "Resultado" preenchido com o esperado é o que permite marcar a
janela correspondente como `fixed` (`gsd-tools windows fixed <id>`); um
resultado diferente do esperado vira registro de defeito, e a janela fica
`open` até a correção. A janela **#5** (`deviation`, 07-12) não é deste
roteiro — ver "Limitações aceitas".

---

## Limitações aceitas

O que a UAT **não** vai encontrar funcionando, de propósito, e onde cada
limitação está decidida. Nada disto é defeito desta fase.

1. **D-15 — cinco superfícies seguem no modelo antigo** e não mostram os
   registros da nova api: a **Busca global**, a **Lixeira** de
   `/configuracoes/lixeira` (a Lixeira do CRM novo é a aba de cada lista —
   passo 6), as **Notificações**, `/crm/meus-negocios` e a **Caixa de
   Entrada**. As fichas antigas continuam abrindo (passo 8). Registrado para
   a fase de unificação (`07-CONTEXT.md`, "Deferred Ideas";
   `apps/web/CONTEXT.md`, 07-12).
2. **Registro de Atividade ausente nas ações de CRM** (RN-CON-22, RN-NEG-15):
   a 007 não tem tabela de atividade e `activity` vive em `registros`, do
   modelo antigo. Criar, editar, mover, ganhar e excluir pela nova api não
   deixam rastro no Registro de Atividade. Aceito em `07-RESEARCH.md` (A9,
   Open Question 4) e nas Deferred Ideas de `07-CONTEXT.md`; volta em fase
   própria, com tabela própria.
3. **Escopo `próprios` e Funil privado (D-10):** o backend aplica isolamento
   por Espaço de Trabalho e a permissão do Papel (D-14), mas um vendedor vê
   todos os Negócios do Espaço, não só os seus, e `privado` no Funil é só
   gravado — não esconde nada ainda. Fase futura.
4. **"Importar Contatos" saiu da lista nova:** o botão de
   `apps/web/src/app/(shell)/crm/contatos/page.tsx` gravaria no modelo
   antigo (`import-contacts-dialog.tsx` grava pelo `useRun` do store em
   memória, `apps/web/src/dados/store.ts`, no `Contact` em inglês), e
   um Contato importado por ele não apareceria em `/crm/contatos`. Por isso
   ele não está na lista nova (07-06, D-15). Importação para o modelo novo é
   assunto da fase de unificação.
5. **Portão `npm run check` com duas falhas pré-existentes fora do CRM**
   (`WINDOWS.md` #5; `deferred-items.md` desta fase): `apps/api/src/e2e/lote-contas-a-pagar.test.ts`
   (5 de 6, as asserções de tempo de lock contra o banco remoto, já em
   `STATE.md` desde a Fase 4) e a suíte "Automação de Canal publicada na
   Lista de Solicitações (CR-05/05-17)" de
   `apps/api/src/rotas/formularios-publicos.test.ts` (o seed aponta para um
   Campo que a Lista do Espaço de teste não tem). Nenhum arquivo delas é
   desta fase; os testes do CRM estão 159/159 contra o container (07-12).
   **Decisão aberta com o dono:** aceitar a ressalva para a fase ou corrigir
   antes de fechar — a janela #5 fica `open` até essa decisão.
6. **`DATABASE_SSL_INSECURE=true` no `.env` deste notebook** (a linha
   `[conexao]` das três saídas acima, T-02-TLS): a verificação da cadeia TLS
   do Postgres está desligada no ambiente de desenvolvimento, por decisão da
   Fase 2 (STATE.md, "Plan 02-15"). Não é desta fase e não muda nada no que
   a 007 aplicou; fora do notebook do desenvolvedor, `DATABASE_CA_CERT` ou
   `DATABASE_CA_PATH` é obrigatório.

### Fica com o dono

| Item | Situação |
|---|---|
| 1. UAT pelo roteiro acima, no app real, e o preenchimento da coluna "Resultado" | feito em 2026-10-11 — os 8 passos conforme o esperado (`07-UAT.md`, teste 3) |
| 2. Fechar as janelas #1–#4 do `WINDOWS.md` conforme o resultado | feito em 2026-10-11 — as quatro marcadas `fixed` |
| 3. Decidir a ressalva das duas falhas pré-existentes do portão (janela #5) | aceita para a fase em 2026-10-11 — override em `07-VERIFICATION.md`, janela #5 `waived` |
| 4. Qualquer ajuste de schema do CRM a partir daqui | é `008` — a 007 está aplicada e é imutável |
