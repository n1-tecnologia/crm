# Runbook do corte — a semana sem ClickUp e o arquivamento da Lista `901107637383`

**Plano:** 03-14 (fecha a Fase 3 — critério 1 do ROADMAP). **Escrito em:** 2026-09-23, antes de a semana de dados existir (o mesmo princípio de `LIMIAR_DA_CANETA`: a régua nasce antes da medida).

Este documento é o roteiro do corte, não a sua narrativa. Cada linha é
verificável por um comando ou uma consulta, nunca por impressão; a ordem é
**dependência**, não preferência — cada passo consome uma garantia do
anterior, e pular a ordem quebra a garantia do passo seguinte. O passo 10
(arquivar a Lista) é o **único irreversível** deste runbook, e por isso é o
último: tudo antes dele pode ser refeito ou adiado sem custo; ele não pode.

## Os onze passos

| # | Passo | Dono | Condição verificável | O que consome do passo anterior |
|---|---|---|---|---|
| 1 | **Pré-requisitos.** | Executor | `npm run check` verde nos três workspaces; os SUMMARYs de 03-10, 03-11 e 03-13 existem; `select nome from plataforma.migracoes` inclui `005-agenda-de-automacoes.sql`. | — (ponto de partida) |
| 2 | **Importação histórica real** (Task 4 de 03-10, `--apply`). | Executor | `select count(*) from plataforma.importacao_ledger where origem = 'clickup:901107637383'` = `2861`; `select count(*) from plataforma.automacao_agenda where workspace_id='ws_n1' and list_id='lst_contas_a_pagar' and last_error_code='MARCO_ZERO'` = `1`. | O `npm run check` verde do passo 1 — importar sobre um domínio quebrado propagaria o erro para 2.861 linhas. |
| 3 | **Resíduo de Grants de 03-05 (T-3-12).** | Executor, decisão do dono do produto | Inventariar as Grants `gr_cp_pessoa_*` persistidas em `plataforma.registros` para `ws_n1`; conferir, uma a uma, se o recurso é Tarefa de fixture do seed ou Tarefa importada (`provenance.sourceName = 'clickup:901107637383'`). **Se todas apontarem para fixture:** aceitar e registrar o número no SUMMARY (a disposição `accept` que 03-05 já tomou — não existe operação de revogação em `OPERACOES`, e um `delete` à mão contornaria o contador de revisão e a trilha de Atividade). **Se alguma apontar para Tarefa importada:** parar — é Grant estática sobre dado real, decisão sobe ao dono, a correção certa é uma operação de revogação registrada (trabalho de outra fase, nunca um `delete` de runbook). | MARCO_ZERO do passo 2 — só depois de saber que a importação terminou é que "Tarefa importada" vira uma categoria que pode aparecer nesta consulta. |
| 4 | **Credenciais Omie TRIA** (resíduo de 03-07). | Quem opera a VPS | `OMIE_TRIA_APP_KEY` e `OMIE_TRIA_APP_SECRET` presentes e não vazias no `.env` de produção do `automation/`, e uma chamada de verificação a `/lancar` devolvendo um `payableId` que **não** começa por `mock-`. Fazer isto **depois** do início do Ensaio (passo 6) e **antes** da caneta (passo 9) — D3-03 não precisa delas para medir, a caneta precisa. Nunca colar o valor das chaves em relatório, log ou SUMMARY. | Nada dos passos 1-3 diretamente; a ORDEM (depois de 6, antes de 9) é a garantia que este passo entrega para o passo 9. |
| 5 | **Liberar a agenda.** | Executor, depois de ler o relato do ensaio da primeira volta | `npm run automacoes:liberar -w @n1/api -- ws_n1 lst_contas_a_pagar` devolve `N > 0` linhas liberadas, e a volta seguinte do agendador processa de verdade. Antes disso, nenhuma das 51 contas vencidas em "para pagar" vira cobrança ou invocação. | `MARCO_ZERO` do passo 2 — sem ele, a primeira semeadura alcançaria o passado importado (A5/A6/A7 em lote sobre contas fechadas há meses). |
| 6 | **Semana de Ensaio.** | Executor (configuração) e Financeiro (operação) | `AGENTE_CONTAS_A_PAGAR_MODO` **ausente** do ambiente, `AGENTE_CONTAS_A_PAGAR_ATIVO=true`, log do `apps/api` dizendo `modo=ensaio` na subida; zero requisições a `/v1/integrations/contas-a-pagar/lancar` no log do `automation/` durante toda a janela. O Financeiro registra cada lançamento pela caixa "Registrar o lançamento que você fez no Omie" (Plan 03-14, Task 2) **no momento em que lança**, nunca em bloco no fim da semana. | A agenda liberada do passo 5 — sem ela, nada roda e não há o que medir. |
| 7 | **A semana sem ClickUp** (critério 1). | O executor pergunta; o Financeiro (Maryane) responde | Na sexta-feira da janela, perguntar literalmente "você abriu o ClickUp esta semana? para quê?" e **transcrever a resposta no SUMMARY, palavra por palavra**. Corroboração objetiva, que não substitui a resposta: contagem de mudanças de Status na Lista de Contas a pagar em `plataforma.registros` dentro da janela, e confirmação de que o gesto de lote de 03-13 e o botão de conversão Solicitação → Conta foram usados ao menos uma vez cada. Uma resposta honesta ("abri duas vezes, para conferir X") é resultado melhor que uma métrica inventada. | A semana de Ensaio do passo 6 — a pergunta só faz sentido depois de uma semana operando pela plataforma. |
| 8 | **O relatório.** | Executor | `npm run ensaio:relatorio -w @n1/api -- --de=<início> --ate=<fim>` sai `0` (não `2`) e o `RELATORIO.md` é commitado. | Os registros humanos do passo 6 e a agenda processada do passo 5 — sem eles, o relatório sai `INCONCLUSIVO` (`dia_sem_medicao` ou viés de seleção), como o comando já demonstra quando rodado contra `ws_n1` antes de a agenda ter processado um dia sequer (ver Nota de verificação, abaixo). |
| 9 | **A decisão da caneta.** | O dono do produto, com o Financeiro | Os sete portões G1–G7 do relatório do passo 8. `CONCEDER` ⇒ `AGENTE_CONTAS_A_PAGAR_MODO=lancar`, reiniciar o `apps/api`, conferir `modo=lancar` no log e conferir que o **primeiro** lançamento real devolve `payableId` que não começa por `mock-`. `ADIAR` ⇒ escrever no SUMMARY qual portão falhou e qual é a próxima ação (as seis Tags que faltam, o corte de `CATEGORY_MIN_SIMILARITY`, ou mais uma semana de Ensaio). `INCONCLUSIVO` ⇒ a semana não mediu; corrigir a causa e estender, nunca arredondar. | O relatório do passo 8 e as credenciais verificadas do passo 4 (G7). |
| 10 | **Arquivar a Lista `901107637383`.** | Financeiro. **Último passo, e nunca antes do 9.** | A Lista aparece como arquivada na interface do ClickUp, e a data vai para o SUMMARY. Com ela morre `legacyClickUpRaw().updateTaskStatus` (`payment-automation-service.ts`), o caminho que hoje cria a Conta a partir da Solicitação aprovada; se a conversão de D3-08 não tiver sido usada de verdade na plataforma (confirmado no passo 7), arquivar deixa o Financeiro sem caminho na primeira Solicitação aprovada do dia seguinte. | A decisão `CONCEDER` do passo 9 e a confirmação de uso real da conversão D3-08 do passo 7 — **nenhum dos dois, e este passo não roda.** |
| 11 | **Registrar.** | Executor | O `03-14-SUMMARY.md` contém a resposta literal do passo 7, o veredito e os sete portões do passo 8, a decisão do passo 9 com quem decidiu, a disposição do passo 3 e a data do passo 10. | Todos os anteriores — é o fechamento, não mais uma verificação. |

## Nota de verificação — o que já foi provado, e o que ainda não

O comando do passo 8 (`npm run ensaio:relatorio -w @n1/api`) existe, foi
testado (10 casos, `apps/api/src/relatorios/ensaio-do-agente.test.ts`,
puros e contra Postgres real) e foi **executado de verdade contra `ws_n1`
de produção** nesta sessão, com uma janela arbitrária (`2026-09-01` a
`2026-09-23`): saiu `INCONCLUSIVO` (`exit 2`), com os 23 dias da janela
classificados `sem_agenda` — porque `plataforma.automacao_agenda` não tem
nenhuma linha para `ws_n1`/`lst_contas_a_pagar` ainda (os passos 2 e 5 deste
runbook, que a semeiam, não rodaram). **Isto é o comportamento correto do
comando, não uma falha dele**: um relatório que decide sobre dinheiro não
inventa taxa sobre um dia que não foi medido. O artefato dessa corrida de
verificação foi descartado antes do commit — o `RELATORIO.md`/`.json`
committáveis nascem só quando o passo 8 rodar de verdade, sobre uma janela
que os passos 2, 5 e 6 já tiverem processado.

Os passos 1–2 (exceto o `--apply` real, que é a Task 4 de 03-10, ainda
parada), a Task 1–3 deste próprio plano (contrato do domínio, o gesto do
diálogo, o comando do relatório) estão code-complete e commitados. Os
passos 3 a 10 exigem, em conjunto: a importação histórica real (03-10 Task
4), a ponte HTTP do Agente ligada em produção (03-11 Task 3, que depende do
`PLATAFORMA_LANCAMENTO_TOKEN` — o mesmo resíduo do passo 4 abaixo), o
`apps/api` no ar contra a VPS de produção, uma semana inteira de operação
real do Financeiro, e a decisão irreversível do passo 10. Nenhuma dessas
condições é alcançável sem VPS de produção, sem as credenciais reais, e sem
o tempo de calendário de uma semana — não é uma lacuna de código, é a
natureza do que este runbook pede.

## Resíduos herdados

**`gr_cp_pessoa_*` (03-05, T-3-12).** Quatro Grants (`gr_cp_pessoa_1`,
`gr_cp_pessoa_2`, `gr_cp_pessoa_3`, `gr_cp_pessoa_joao`) foram apagadas do
**seed** em 03-05 — a visibilidade da Pessoa da conta passou a ser
derivada de `List.sharedWithDefinitionIds` + `memberNamedOnTask`, nunca mais
uma concessão gravada. O que o seed deixou de criar não desaparece
sozinho de um Postgres que já rodou um bootstrap anterior a essa mudança:
se `ws_n1` foi semeado antes de 03-05, essas linhas podem continuar em
`plataforma.registros`. O passo 3 deste runbook é o inventário e a decisão;
não existe hoje, em `OPERACOES`, uma operação de revogação de Grant — só
`grantGovernanceAccess`/concessão de leitura. Se o inventário achar uma
Grant apontando para dado real (não fixture), a correção certa é escrever
essa operação, não um `delete` de runbook.

**Credenciais Omie TRIA (03-07).** `OMIE_TRIA_APP_KEY`/`OMIE_TRIA_APP_SECRET`
vivem no `.env` de produção do `automation/` na VPS e nunca foram
verificadas (03-RESEARCH § Environment Availability). O Ensaio de D3-03
(`/resolver`) não precisa delas — não escreve. A caneta (`/lancar` real)
precisa: sem elas, `createPayableForFlux7` devolve `mock-payable-<timestamp>`
e a conta iria para "lançado omie" sem nada lançado no Omie de verdade
(T-3-37, achado de 03-11). Por isso o passo 4 vem depois do início do Ensaio
(6) e antes da caneta (9) — nunca antes, porque D3-03 foi desenhado
justamente para não depender delas na primeira semana.

## Continuações registradas, não silenciadas

Três lacunas que este plano mede e nomeia, mas não fecha — cada uma é
trabalho de outra fase, com o motivo escrito:

1. **As seis Tags `conta *` sem equivalente no seed.** 03-10 mediu 1.348
   Tarefas do export com ao menos uma Tag sem equivalente (`conta plx -
   apoio`, `conta mp`, `conta tf`, `conta cariani`, `conta kaka`, `conta
   ivl`), 18 delas entre as 117 contas abertas. Essas Tarefas chegam à
   plataforma sem nenhuma Tag `conta *`, e `buildResumoDePagamento` cai no
   fallback (`centro.toUpperCase()` ou `"A DEFINIR"`). O relatório do Ensaio
   marca isso como `semTagDeConta` e tem portão próprio (G4); o remédio —
   acrescentar as seis Tags ao seed e reimportar o de-para — é trabalho
   registrado, não desta fase.
2. **Ausência de recusa por conta não resolvida em `buildResumoDePagamento`.**
   Hoje o Agente resolve a conta de pagamento por palpite quando não há Tag
   `conta *`, e segue adiante — nunca recusa por isso (só recusa por
   `veredito` de categoria). É o modo de falha mais caro da fase: categoria
   errada é reclassificação contábil, conta errada é dinheiro saindo do
   banco errado. Mudar esse comportamento é mudar o Agente que 03-04
   definiu, fora do escopo de medição deste plano.
3. **Ausência de uma operação de revogação de Grant em `OPERACOES`.** Ver
   "Resíduos herdados" acima — o domínio tem `grantGovernanceAccess` para
   conceder, mas nenhuma operação simétrica para revogar uma Grant estática
   já persistida. Enquanto ela não existir, a única correção segura para uma
   Grant real e indesejada é uma decisão do dono do produto seguida de
   trabalho de domínio novo, nunca um `delete` direto em
   `plataforma.registros` (contornaria o contador de revisão e a trilha de
   Atividade).
