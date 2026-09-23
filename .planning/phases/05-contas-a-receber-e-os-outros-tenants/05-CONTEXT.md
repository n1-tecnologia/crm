# Phase 5: Contas a receber e os outros tenants - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning — com um portão humano declarado (D5-02)

<domain>
## Phase Boundary

Três entregas, nesta ordem de dependência:

1. **TEN-01** — Marcos Paulo e Family Office deixam de ser clones e passam a ser
   Empresas do Campo `Empresa` nas **mesmas** Listas da plataforma; cada uma das
   6 Empresas ganha a sua Integração Omie; as regras que hoje moram em três
   `config.ts` viram configuração por Empresa. Os webhooks ClickUp dos dois
   tenants são desligados e as Listas `901109642259` / `901111928443`
   arquivadas.
2. **AUTO-02** — a Ação `notificar` do motor (Phase 3) ganha o canal WhatsApp,
   entregue pela Evolution API através do `automation/`, usando o Campo
   `Z WhatsApp` da Tarefa.
3. **REC-01** — Contas a receber na plataforma, na forma que **D7** determinar.
   Atrás de um portão humano explícito (D5-02), com um default declarado para
   que a fase não pare se a resposta demorar.

Não inclui consolidar os três `payment-automation-service.ts` do `automation/`
num só (D5-04 explica por quê), nem reabrir o caminho FINQ que D3-01 tirou de
escopo, nem o GHL (comparativo §6: precisa de inventário próprio).

</domain>

<decisions>
## Implementation Decisions

### Ordem e o portão

- **D5-01 — TEN-01 primeiro, AUTO-02 junto, REC-01 por último.** TEN-01 é o que
  mata o ClickUp por inteiro (as duas Listas que sobram são de MP e FO) e não
  está bloqueado por nada. Contas a receber está dormente desde outubro de 2025:
  é a coisa menos urgente do projeto e a única bloqueada. Inverter a ordem
  colocaria o item bloqueado no caminho crítico do item que termina a migração.

- **D5-02 — D7 vira um plano com checkpoint bloqueante, não uma espera.** O
  plano reúne a evidência (contagens de `contas_a_receber`, `conciliador_contas_receber_*`,
  a Lista `901107648977` exportada na Fase 0) e faz **uma** pergunta ao
  Financeiro: *onde o recebimento é controlado hoje?* — no molde dos checkpoints
  bloqueantes de 03-07 e 03-10.

  **Default declarado, se a resposta não vier dentro da fase: o ramo processo**
  (Lista completa), não o ramo espelho. Três razões, todas verificáveis:
  (a) o ramo processo **já está construído e já foi aplicado em produção** —
  ver D5-02b; (b) `adapters/omie.ts` **não tem nenhuma chamada de contas a
  receber** — `grep -c "Receber"` dá zero — então o ramo espelho exige
  superfície Omie nova, que é trabalho de verdade, não port; (c) uma Lista com
  o processo absorve depois um espelho do Omie como leitura de Integração, e o
  contrário não é verdade. O default é o caminho que não fecha porta.

- **D5-02b — Contas a receber não é para construir: é para conferir e
  terminar.** *(Acrescentado em 2026-09-23 depois da pesquisa. A versão anterior
  de D5-02 dizia só que `createReceivableSeries` existia; o quadro real é bem
  maior e muda o tamanho de REC-01.)*

  `packages/dominio/src/bootstrap-gestao.ts:191` chama
  `applyContasAReceber(state, clock, { fixtures: false })` — o bootstrap **de
  produção**, sem fixtures. E o `bootstrapGestao()` rodou contra o Supabase real
  (`ws_n1`) na Fase 1, Plan 01-05. Logo, a Lista "Contas a receber", os 6 Status
  com `entryRequirements`/`entryFromStatusIds` já espelhando RN-CR-03/04, as
  Definições de Campo, as Concessões, as Visões e as Automações R2–R6
  provavelmente **já estão no banco**.

  Portanto o primeiro passo de REC-01 não é modelar nada: é uma **conferência
  somente-leitura contra `ws_n1`**, comparando o que está lá com
  `seed-contas-a-receber.ts` e com `docs/07-processos/contas-a-receber.md`. O
  que sobrar dessa conferência é o escopo real: ligar o agendador da Fase 3 para
  `CR.listId` (MARCO_ZERO + liberação do Ensaio, o mesmo gesto de 03-08), fechar
  R1 e R7, e os Campos de §9 que faltarem. Planejar como se fosse do zero
  reescreveria código que já está em produção — o pior resultado possível desta
  fase.

### TEN-01 — as Empresas

- **D5-03 — A Integração da Empresa guarda a identidade da conta Omie, nunca o
  segredo.** Seis Integrações, uma por Empresa (CAND-01 confirmado): Tria,
  FINQ/Konq, Marcos Paulo, EXO Loteamento, EXO Participações, Oliveira
  Participações. Cada uma registra rótulo estável da conta, banco de categorias,
  situação e data da última rotação. O `app_key`/`app_secret` continua morando
  onde o código que o usa mora — o ambiente do `automation/` — e é resolvido lá
  pelo rótulo.

  É a leitura correta de "credencial só na Integração": o contraste do
  requisito é com **credencial por linha** em
  `solicitacoes_pagamentos.app_key/app_secret` e `transacoes.api_key/app_secret`
  (inventário §5.1 e §5.5), que é o que precisa morrer. A plataforma nunca chama
  o Omie (03-07/03-11: ela chama o `automation/`); um segredo que ela não usa é
  um segredo que ela não deve guardar, e mandá-lo por HTTP a cada lançamento
  seria o oposto de CON-10.

- **D5-04 — A não-clonagem acontece na plataforma, não no `automation/`.** Os
  três `payment-automation-service.ts` somam 5.880 linhas quase iguais; refatorá-los
  num só é uma cirurgia de alto risco no repositório que CON-05 manda manter com
  o mesmo `git log`, e o plano §3 não pede isso — pede que as regras de cada
  `config.ts` virem configuração **por Empresa**, para que a plataforma não
  clone.

  Então: **uma** Lista "Solicitações de pagamento" e **uma** "Contas a pagar" na
  plataforma, com `Empresa` como Campo, em vez de três de cada. O `automation/`
  segue escolhendo o serviço por `tenantId`, que passa a vir no payload em vez
  de vir do path do webhook do ClickUp. Consolidar os três serviços é território
  de D12 e fica fora.

- **D5-05 — Os prefixos numéricos dos Campos do Family Office morrem com o
  ClickUp.** `01-Centro de Custo`, `02-Empresas`, `03-Categoria de pagamento`…
  existem porque o ClickUp ordena campo por nome. A plataforma lê `fieldValues`
  por id estável (é o que faz o mapper encolher, plano §2.2), então o prefixo não
  tem função. `customFieldNames` de `family-office/config.ts` vira código morto
  no corte. Nenhum Campo da plataforma nasce com prefixo numérico.

- **D5-06 — `em revisão` entra como 5º Status da Lista de Solicitações
  (OQ-CMP-02 respondida).** D-01 travou quatro Status "nesta fase" e mandou não
  criar `em revisão`; esta é a fase em que o Family Office chega e o usa. Como
  Conjunto de Status é da Lista e a Lista é uma só, os cinco valem para todas as
  Empresas — mas só a configuração de Automação da Empresa que o declara move
  para lá. Na prática TRIA nunca o alcança. A alternativa (uma Lista por tenant)
  é justamente a clonagem que D5-04 recusa.

- **D5-07 — O corte de MP e FO é um só, não dois.** `901111928443` é ao mesmo
  tempo a Lista de Contas a pagar do Family Office e a Lista de Solicitações do
  Marcos Paulo (`marcos-paulo/config.ts` aponta os dois ids para ela): arquivá-la
  aposenta os dois tenants no mesmo gesto. Mesma disciplina de D-28 — coortes por
  origem, nunca double-write da mesma obrigação no Omie, desligar webhook antes
  de arquivar, e rollback por reabrir a entrada no ClickUp só para pedidos novos.

- **D5-08 — FINQ/Konq entra como Empresa e Integração, e nada além disso.**
  D3-01 tirou o caminho FINQ de escopo na Phase 3; esta fase registra a Empresa
  e a Integração (que compartilha a conta Omie com Konq Intermediações, conforme
  `family-office/config.ts`) sem reabrir `payment-rules.ts` do lado do FINQ.

### AUTO-02 — notificar por Canal

- **D5-09 — O WhatsApp sai pelo `automation/`, não pela plataforma.**
  `notificar` hoje é in-app e mira Membros (`automations.ts:307`). Ganha uma
  variante de canal cuja entrega passa pelo outbox → `automation/` →
  `adapters/evolution.ts`. Mesma regra de D-17 e de D4-01: a plataforma não
  guarda credencial de terceiro nem faz chamada externa que já tem casa.

- **D5-10 — Destino é o Campo `Z WhatsApp` da Tarefa, e vazio é recusa.** Sem
  número no Campo, a Ação falha visível na Execução — nunca adivinha, nunca cai
  num número padrão. Os números de Mari, Marcos e do grupo financeiro que hoje
  estão em `marcos-paulo/config.ts` viram configuração da Empresa (D5-03), não
  constantes.

- **D5-11 — Escopo de AUTO-02 é o que o Marcos Paulo já faz, não notificação
  genérica.** Aviso de gasto novo e o relatório — o comportamento observado. Um
  canal disponível para qualquer Automação de qualquer Lista é capacidade nova e
  fica adiada. Isso responde o "prioridade a confirmar" do requisito: entra,
  porque o tenant que o usa está chegando; entra pequeno, porque nada além do
  que existe foi observado.

### REC-01 — o que não depende de D7

Estas decisões valem nos dois ramos e não esperam ninguém:

- **D5-12 — Cliente é Contato ou Empresa do CRM, nunca uma Lista "Gestão de
  clientes".** Empresa quando há CNPJ, Contato quando é pessoa física; o Vínculo
  da conta aponta para a entidade nativa. A Lista `901109161381` não é recriada
  (spec §12, decisão de produto).
- **D5-13 — Os dois Status nunca usados ficam os dois, como já estão no
  código.** *(Corrigido em 2026-09-23: a versão anterior mandava dobrar
  `estornado` em `descartado`, seguindo a sugestão da spec §12. O seed já
  decidiu melhor, e desfazer isso seria regressão.)*

  `seed-contas-a-receber.ts` define `disponível para saque`
  (`emAndamento`) e `estornado` (`concluido`) com
  `entryFromStatusIds: [S.recebido]` — ou seja, `estornado` só é alcançável a
  partir de `recebido`, que é exatamente o que um estorno é: reversão de um
  recebimento. `descartado` tem outro significado (não será mais cobrado) e
  outra entrada (qualquer status não fechado). Fundir os dois perderia essa
  distinção e mentiria no relatório. Mantidos os seis Status como estão.
- **D5-14 — Saque passa a exigir Valor > 0 (RN-CR-03 sem exceção).** Os 240
  históricos com valor `0` entram como lacuna de importação registrada (padrão
  D-25), não como zero legítimo: uma Lista de recebimento que não fecha com o
  extrato não serve para nada.
- **D5-15 — Os prazos de R4/R5 não são número no código.** 30 e 60 dias vêm de
  um único caso (Kennedy). Viram parâmetro da configuração da Automação da Lista
  — mesmo mecanismo de D-07 — com 30/60 como valor inicial e a procedência
  anotada. O Financeiro muda sem deploy quando disser o prazo real.
- **D5-16 — Data de pagamento sobre `date_closed` na importação (CON-CR-10).**
  `date_closed` só como fallback: no backfill de janeiro/2025 os dois divergem
  por meses.
- **D5-17 — `conta tria` vira o Campo "Conta de recebimento", não Tag** (spec
  §12); os cinco Campos de §9 (Número da parcela/Total, Tipo de recebimento,
  Forma de recebimento, Situação de cobrança, Contrato) entram no catálogo da
  Lista.
- **D5-18 — As duplicatas e a subtarefa indevida não são consertadas em
  silêncio.** RN-CR-07 (duas "7ª Parcela – Gabriela Melo", duas "2ª Parcela –
  Sidney Garcês") entram como lacuna registrada, sem fusão automática; RN-CR-06
  é aplicada desabilitando Subtarefas na Lista, e `868cpdawp` é desamarrada na
  importação com Registro de Atividade dizendo o quê e por quê.

### Claude's Discretion

- Como a configuração por Empresa é modelada (registro na Integração, catálogo
  do Espaço, ou Campos de configuração da Lista) — desde que o segredo fique
  fora da plataforma e a regra saia do `config.ts`.
- Divisão dos planos e ondas; quantos planos cada uma das três entregas recebe.
- Forma da rota e do payload do canal WhatsApp no `automation/`.
- Layout das telas de Contas a receber, reusando o que a Lista já entrega.
- Se REC-01 cabe inteiro nesta fase ou se o ramo processo merece a sua própria —
  decidir com a resposta de D7 em mãos, não antes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e decisões travadas
- `.planning/ROADMAP.md` — Phase 5, os 4 critérios e a nota "antes de planejar"
  (D7/OQ-CR-01, CAND-01, CAND-05, OQ-CR-02..06, OQ-CMP-02 têm dono aqui).
- `.planning/REQUIREMENTS.md` — REC-01 (bloqueado por D7), TEN-01, AUTO-02 e as
  constraints CON-CR-01..10; CON-05 é o portão permanente.
- `.planning/PROJECT.md` — CAND-01 (uma Integração por Empresa), CAND-05
  (leituras conservadoras de C34), DEC-16.
- `.planning/phases/02-…/02-CONTEXT.md` — D-01 (os quatro Status e o "não criar
  `em revisão` nesta fase"), D-07 (regra na configuração, não no código), D-17,
  D-25 (lacuna registrada, nunca dado inventado), D-28 (a forma do corte).
- `.planning/phases/03-contas-a-pagar/03-CONTEXT.md` — D3-01 (FINQ fora), D3-03
  (Ensaio antes de gastar dinheiro), D3-04.
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/04-CONTEXT.md` — D4-01
  e D4-02: o caminho autenticado e a credencial de serviço que AUTO-02 e um
  eventual espelho de Contas a receber reusam.

### Processo e migração
- `docs/07-processos/contas-a-receber.md` — a spec inteira: §3 (6 Status), §8
  (R1–R7), §9 (os 5 Campos a acrescentar), §10 (permissões), §11 (RN-CR-01..07,
  INV-CR-01/02) e **§12 (tudo que precisa de decisão — a origem de D5-12..D5-18)**.
- `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` §3.6 (Empresa
  é Campo, Integração é do Espaço — a origem de CAND-01), §3.7 (Contas a receber
  dos dois lados), §6 (o GHL fica fora).
- `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §5.1 e §5.5
  (credencial por linha — o que D5-03 mata), §5.6 (auxiliares Marcos Paulo),
  §5.7 (`contas_a_receber` = 10 linhas), §6 (Evolution API e as 6 contas Omie).
- `docs/08-migracao-financeiro/03-plano-de-migracao.md` §3 Fase 5, §7 D7 e D12.

### Código deste monorepo
- `packages/dominio/src/operations/financeiro.ts:537` — `createReceivableSeries`
  já implementada; `contas-a-receber.test.ts` e `seed-contas-a-receber.ts` são o
  protótipo em memória que o ramo processo liga.
- `packages/dominio/src/operations/automations.ts:307` — o ramo `notificar` do
  executor, in-app, onde o canal entra.
- `apps/api/src/persistencia/outbox-worker.ts` — entrega com lease, backoff e
  `sanitizarErro()`; o caminho por onde a notificação por Canal sai.
- `apps/api/src/automacoes/invocar-agente.ts` — o molde do cliente HTTP para o
  `automation/` (Bearer, timeout, transitório × permanente).
- `apps/api/src/bootstrap/` — onde o Espaço "Gestão" e o catálogo das Listas são
  evoluídos de forma idempotente (padrão do evolver de 02-08).

### Código do repositório `financeiro-tria` (só o necessário)
- `automation/src/tenants/family-office/config.ts` — as 5 empresas, os
  `customFieldNames` com prefixo, `resolveEmpresaOmie` e o
  `valorLimite: 0`; é o mapa do que vira configuração por Empresa.
- `automation/src/tenants/marcos-paulo/config.ts` — **contém `appKey`/`appSecret`
  hardcoded como default** (risco aceito em D-13, mas nada disso é copiado para
  a plataforma), os números de WhatsApp, `financas_mp` e o cron do relatório.
- `automation/src/tenants/tria/config.ts` — o contraste: `valorLimite: 5000`.
- `automation/src/adapters/evolution.ts` — `EvolutionAdapter`, `sendText`,
  `sendListMessage`: o que AUTO-02 aciona.
- `automation/src/adapters/omie.ts` — **`grep -n "Receber"` dá zero**: a prova de
  que o ramo espelho de D5-02 exigiria superfície Omie nova.
- `automation/src/http/contas-a-pagar-routes.ts` — a disciplina de superfície
  nova autenticada, a copiar para a rota do canal.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Contas a receber **já existe no domínio**: operação de série, seed, testes e
  os Status. O ramo processo de REC-01 é em boa parte expor e configurar, não
  escrever regra nova.
- O motor de Automações da Phase 3 (agenda com catch-up, Execuções auditáveis,
  as quatro Ações) é exatamente o que R2–R7 pedem — R2/R4/R5 são gatilho por
  agenda sobre "tempo em Status", que é o terceiro cliente previsto do motor.
- O evolver idempotente da Lista (02-08) e o bootstrap do Espaço (01-05) são o
  molde para acrescentar Empresa, Status e os cinco Campos de §9 sem fixture.
- O outbox (02-10) já entrega para o `automation/` com lease e retry; o canal
  WhatsApp é mais um destino, não um mecanismo novo.

### Established Patterns
- Regra que o Financeiro muda mora em configuração, não em `if` (D-07). Os três
  `config.ts` do `automation/` são o antipadrão que esta fase desfaz do lado da
  plataforma.
- Nenhuma credencial de terceiro entra no schema `plataforma`, e nenhuma
  chamada externa sai de `packages/dominio`.
- Importação registra lacuna; nunca inventa dado (D-25). Vale para os saques com
  valor 0 e para as duplicatas de RN-CR-07.
- Corte é por coorte, com rollback declarado, e o ponto sem volta vem por último
  (D-28, D4-16).

### Integration Points
- Campo `Empresa` → Integração da Empresa → rótulo da conta Omie → `automation/`
  resolve o segredo do próprio ambiente.
- Automação `notificar` (canal) → outbox → `POST` no `automation/` → Evolution.
- Contas a receber (ramo processo): Lista → motor de Automações (R2–R7) →
  Comentário/Menção e Tag; Vínculo → Contato ou Empresa do CRM.
- Contas a receber (ramo espelho): leitura autenticada no molde de D4-01/D4-03,
  com superfície Omie nova no `automation/`.

</code_context>

<specifics>
## Specific Ideas

- O teste de que TEN-01 deu certo é negativo e simples: `901109642259` e
  `901111928443` arquivadas, e nenhum serviço novo clonado para isso.
- `marcos-paulo/config.ts` tem `appKey` e `appSecret` reais como default no
  código, no histórico do git. D-13 aceitou o risco e mandou não cobrar rotação;
  o que esta fase garante é que **nada disso é copiado** para a plataforma — o
  rótulo, sim; o segredo, não.
- Contas a receber está dormente há quase um ano. Se a resposta de D7 for "não
  se controla em lugar nenhum", isso é informação, não fracasso: constrói-se o
  processo com quem vai usar, sem espelhar um vazio.

</specifics>

<deferred>
## Deferred Ideas

- Consolidar os três `payment-automation-service.ts` num serviço só — território
  de D12, alto risco, sem pedido no plano.
- Notificação por Canal como capacidade genérica de qualquer Automação — AUTO-02
  entra no tamanho do que já se faz (D5-11).
- Reabrir o caminho FINQ de `payment-rules.ts` que D3-01 fechou.
- Gestão contratual como Lista (o gatilho "correto" de R1, spec §8) — sem ela,
  R1 é o formulário "criar série de parcelas" na própria Lista.
- Go High Level — comparativo §6: zero ocorrência nos dois repositórios, precisa
  de inventário próprio a partir da conta, não do código.
- Limpeza das 13 tabelas vetoriais por empresa e das 7 views `_v` em favor da
  `conciliador_contas` unificada — herdado da Phase 4, segue sem dono.
- Mover o `automation/` para o monorepo (D12) — reavaliação prometida ao fim da
  Phase 2, ainda pendente.

</deferred>

---

*Phase: 5-Contas a receber e os outros tenants*
*Context gathered: 2026-09-23*
