# relatorios

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

Pasta nova de propósito, e não um arquivo dentro de `automacoes/`: um
relatório é **somente-leitura** e não pode importar o worker — morar ao lado
dele convidaria exatamente essa importação. Nada aqui grava no banco;
nenhuma regra de negócio mora aqui — a regra de acerto (`compararEnsaio`) e o
limiar da caneta (`LIMIAR_DA_CANETA`) são de `@n1/dominio`. O que é agregado
vai para o git; o que é individual, não.

| Arquivo | O que faz |
|---|---|
| `ensaio-do-agente.ts` | `coberturaDaJanela` (I/O, a única leitura de banco), `agregar` (pura) e `renderizar` (pura) — o relatório do Ensaio de D3-03: as sete portões da caneta, calculados, nunca opinados. `detalharPorConta` monta o CSV linha a linha, que nunca vai para o git. |
| `ensaio-do-agente.test.ts` | Os casos (a)-(h), puros, sempre; (i), contra `plataforma.automacao_agenda` real, pula sem `DATABASE_URL` (DEC-09). |
| `ensaio-do-agente.cli.ts` | `npm run ensaio:relatorio -w @n1/api` — CLI fino: hidrata, chama `compararEnsaio` por Tarefa da Lista, chama `coberturaDaJanela`/`agregar`/`renderizar`, grava. Nenhum SQL e nenhuma regra aqui — só composição. |

## Três camadas, para que o teste cubra duas sem banco

`coberturaDaJanela` é a ÚNICA função que toca `plataforma.automacao_agenda`
(03-01/03-08) — uma consulta para a janela inteira, cruzada com o
`DataState` já hidratado (Ensaios nascidos no dia, candidatas a A7 no dia).
Nunca escreve; nunca chama a Unidade de Trabalho.

`agregar` é **pura**: recebe os `ResultadoDaConferencia[]` que
`compararEnsaio` (`@n1/dominio/operations/financeiro`) já julgou, a
cobertura, e `LIMIAR_DA_CANETA`; devolve o `Relatorio`. A ordem de decisão é
a mesma do `<behavior>` do plano: um dia sem medição, ou uma taxa alta de
`sem_lancamento_humano`, tornam o relatório `INCONCLUSIVO` ANTES de qualquer
portão ser computado — um relatório que não pode ser produzido
honestamente não produz número nenhum.

`renderizar` é **pura**: `Relatorio` → `{ markdown, json }`. T-3-65 — nenhum
título de Tarefa, nome de fornecedor, valor, documento, chave Pix, código de
barras ou `taskId` entra aqui; só contagens, vocabulário de veredito, e
pares de código agregados (`"<código do Agente> → <código do humano>": n`).
Todo percentual sai acompanhado do seu `n`/denominador (T-3-67) — uma taxa
sem denominador é a forma mais barata de errar para o lado otimista.

## Os sete portões (`LIMIAR_DA_CANETA`, `@n1/dominio`)

G1 (pares mínimos), G2 (acerto de código ≥ 95%), G3 (acerto de conta ≥ 98%),
G4 (zero divergência de conta entre as contas sem Tag `conta *`), G5 (zero
Ensaio não mensurável), G6 (zero dia sem medição — sempre verdadeiro quando
`agregar` chega a computar os portões, porque G6 falho já teria saído
`INCONCLUSIVO` antes) e G7 (credenciais Omie TRIA verificadas — **não
computável**: só o ato humano `--credenciais-omie=ok` do CLI o liga, nunca
um padrão implícito). `CONCEDER` exige os sete; qualquer um que falhe é
`ADIAR`.

## O que o CLI grava, e o que nunca vai para o git

`apps/api/exportacoes/ensaio-do-agente/<run>/RELATORIO.md` e `.json` —
agregados, versionados. `conferencia-detalhada.csv` — linha a linha, COM
`taskId` e as duas triplas, na árvore que o `.gitignore` já ignora por LGPD
(mesmo padrão de `apps/api/exportacoes/clickup/`, precedente de 03-10).

## Onde o Plan 03-14 (Task 4) usa isto

O runbook de corte (`docs/08-migracao-financeiro/06-runbook-de-corte.md`)
chama `npm run ensaio:relatorio` no passo 8, depois da semana de Ensaio real
(passo 6) e da pergunta ao Financeiro (passo 7) — a saída (`0`/`2`) decide se
o corte pode prosseguir para o passo 9 (a decisão da caneta). Rodar este CLI
contra `ws_n1` ANTES de a agenda real ter processado um dia sequer produz,
corretamente, `INCONCLUSIVO` por `dia_sem_medicao` — não é um bug do CLI, é
a prova de que ele não inventa taxa sobre dado que não existe.
