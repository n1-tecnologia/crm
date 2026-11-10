# Phase 14: Unificação do CRM: o modelo novo ganha o que falta e a Tarefa conversacional - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Sessão 3 do cronograma, parte A (3.1 a 3.3, 20 subtarefas). Hoje o CRM tem duas bases: as tabelas novas das migrações 007 e 008 (`plataforma.contatos`, `empresas`, `negocios`, `funis`, `canais`, `conversas`, `mensagens`) e o modelo antigo em `plataforma.registros` (`state.contacts`, `state.conversations`, `state.deals`, `state.funnels`, `state.channels`). Esta fase **dá ao modelo novo o que só o antigo tem** e **leva a Tarefa conversacional para as tabelas novas**. Trocar as telas, migrar os dados e remover o modelo antigo é a Fase 15; a base da mensageria é a Fase 16.

Entra: 3.1.1–3.1.5 (decisões e a migração nova), 3.2.1–3.2.8 (operações que só existem no antigo), 3.3.1–3.3.7 (Tarefa conversacional).

Não entra: trocar as telas (3.4), o script e a remoção do modelo antigo (3.5), tudo da mensageria (3.6 a 3.9). Itens de teste relatados na 2.7 que mexam no CRM entram aqui, um por subtarefa.

</domain>

<decisions>
## Implementation Decisions

### Corte e ensaio (3.1.1)
- **D-01 (3.1.1, escolha A):** **O corte é de uma vez.** Esta fase deixa o modelo novo pronto; a Fase 15 troca todas as telas e roda o script de migração no mesmo deploy. **Não se escreve ponte** que traduza id antigo e novo enquanto as duas bases gravam. Descartado: tela por tela (cerca de +2 dias de pontes jogadas fora). — **Reversibility:** costly — voltar para "tela por tela" depois de começar obriga cada tela a entender id antigo e novo.
- **D-02 (ensaio, sem homologação):** **Ensaiar a migração num Postgres local (Docker) com uma cópia dos dados reais do CRM antigo.** O dono tira a cópia só das coleções do CRM antigo de `plataforma.registros`; o agente ensaia o script e confere as contagens. A homologação **não existe** (plano 09-17 pulado em 2026-10-23) e **não será montada** para esta sessão; o "pronto quando" da 3.1 que fala em homologação passa a ser "ensaiado localmente com a cópia". Em produção, na Fase 15: backup manual antes (o backup diário **não está ligado**, 09-18 pulado em 2026-10-27), `npm run migrar -- --seco` antes de aplicar, e a cópia de segurança das linhas antigas (`registros_crm_antigo`). Descartado: montar a homologação antes (dias de infra); ensaiar só com o seed (não prova que o dado real migra). — **Reversibility:** reversible — o ensaio pode virar homologação depois, sem refazer a migração.
- **D-03 (há dado real):** **O modelo antigo em produção tem dado real** (confirmado pelo dono em 2026-11-04), então a migração tem de preservá-lo. O modo `--seco` conta antes de qualquer escrita. O que a decisão D-04 deixa de fora da tela (Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio) **continua guardado só em `registros_crm_antigo`**; nada é apagado de `plataforma.registros` na Fase 14. — **Reversibility:** one-way — a remoção do modelo antigo (Fase 15) perde o que não foi copiado.

### O que o modelo novo ganha (3.1.2 e 3.1.3)
- **D-04 (3.1.2, escolha B):** **Só o essencial.** O modelo novo ganha: notas do Contato, consentimento, mesclar Contatos, transferir Identificador, mover Conversa, atribuir, estrela, leitura e lixeira da Conversa (as subtarefas 3.2.2 a 3.2.8 e a migração da 3.1.5 estão escritas para isto). **Somem da tela até uma sessão própria:** Tags, vários Contatos por Negócio com papel, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio. Descartados: trazer tudo (+4 dias); não trazer nada (a porta de entrada criaria Contatos duplicados sem jeito de juntar). — **Reversibility:** costly — trazer um recurso depois é uma migração nova e uma tela, mas o dado continua na cópia de segurança.
- **D-05 (3.1.3, escolha B):** **A Conversa de Grupo e as Mensagens de Flow ficam no modelo antigo até as Sessões 6 e 7.** As Ferramentas passam para os ids novos só nos Contatos e Canais. A migração nova **não** ganha `conversas.identificador_de_grupo` nem `mensagens.flow` / `resposta_de_flow` (o "Atenção" da 3.1.5 não se aplica). A Sessão 6 decide como guardar a Conversa de Grupo (6.6.5) e a Sessão 7 faz o mesmo com as Mensagens de Flow. **Consequência para a Fase 15:** o modelo antigo **não sai por inteiro**; sobra um resto de `Conversation` (só Grupo e Flow) até a Sessão 7, e o texto da Fase 15 no ROADMAP deve refletir isso. — **Reversibility:** costly — a Sessão 7 passa a depender desse resto.

### Meus negócios (3.1.4)
- **D-06 (3.1.4, escolha B):** **As Listas espelho de Meus negócios são aposentadas.** "Meus negócios" vira o quadro de `/crm/funis/[funil]` com o filtro "meus"; as Reuniões continuam como Tarefas ligadas ao Negócio novo. Portanto **a Lista não ganha o campo `funilId`** e a regra de formato de id `funilDaLista` (`lst_funil_<x>` ↔ `fnl_<x>`) não é portada: os Funis novos têm id UUID. Cerca de +0,5 dia; quem trabalha pela Lista muda de lugar. A troca da tela é da Fase 15 (3.4.5); aqui só se garante que nada novo dependa das Listas espelho. — **Reversibility:** costly — reativar as Listas espelho exigiria o campo `funilId` e a Tarefa espelho de volta.

### Tarefa conversacional (3.3.1)
- **D-07 (3.3.1, escolha A):** **Criar uma Tarefa conversacional pede a primeira Mensagem quando não há Conversa aberta** com aquele Contato naquele Canal; havendo uma aberta, **reaproveita sem Mensagem nova**. Mantém a regra INV-CXE-05 da 008 e acrescenta um campo ao diálogo. No WhatsApp oficial, fora da janela de 24 h, essa primeira Mensagem terá de ser modelo (Sessão 7). Descartado: abrir Conversa vazia só por este caminho (poria Conversas mudas na Caixa). — **Reversibility:** reversible — é uma regra do serviço e um campo do diálogo.

### Claude's Discretion
- A ordem interna e o corte em planos (domínio antes de api antes de tela; decisões da 3.1 primeiro; a migração da 3.1.5 antes das operações da 3.2; a 3.2.1 antes das demais da 3.2; a 3.3 depois da 3.2).
- O nome exato das colunas e tabelas da migração nova, seguindo o que a 3.1.5 descreve com o ajuste de D-05 (sem colunas de Grupo e Flow).
- A forma do diálogo de mesclagem, de consentimento e dos gestos da Caixa (3.2.2 a 3.2.6), desde que respeite as regras do domínio em `packages/dominio/src/crm/`.
- Como tratar a cópia local dos dados reais do ensaio (D-02): ela contém dado real de clientes e deve ficar só no notebook do dono, com o contêiner apagado ao fim (`docker rm -f`), como nos outros planos.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### O plano desta fase
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` — Sessão 3, tarefas 3.1 (linha ~806), 3.2 (~853) e 3.3 (~920): cada subtarefa com "Hoje / O que fazer / Pronto quando", as opções e as recomendações originais. Os números de linha do código citados ali deslocaram com as Fases 9 a 12: procurar de novo antes de planejar.
- `.planning/ROADMAP.md` — "Phase 14" (escopo, decisões e ordem) e "Phase 15" (precisa de ajuste por D-05).
- `docs/09-planejamento/dados/parte-c.mjs` — fonte dos dados da Sessão 3 (o `.md` é gerado, nunca editado à mão).

### Modelo novo do CRM (o que já existe)
- `apps/api/migracoes/007-crm.sql` e `apps/api/migracoes/008-canais-conversas-mensagens.sql` — tabelas aplicadas e imutáveis; qualquer ajuste de schema é uma migração nova depois da `010`.
- `packages/dominio/src/crm/` — as regras do CRM novo (`contatos.ts`, `conversas.ts`, `mensagens.ts`, `negocios.ts`, `funis.ts`, `canais.ts`, `permissoes.ts`).
- `apps/api/src/servicos/crm/` — os serviços e `transacao.ts` (`comTransacao`); `conversas.ts` tem o `criar` que exige a primeira Mensagem.
- `apps/api/src/persistencia/CONTEXT.md` e `apps/api/src/persistencia/unidade-de-trabalho.ts` — `executar()` e a opção `aoConfirmar` que a 3.2.1 reaproveita.
- `CONTEXT.md` (raiz) — "Estado atual": Fases 7 e 8, a projeção dos Canais e "até a fase de unificação".

### Modelo antigo (o que será levado)
- `packages/dominio/src/operations/conversations.ts` (`startConversation`), `operations/iniciar-conversa.ts`, `derive-conversacional.ts`, `derive-ferramentas.ts` — as leituras e gestos que hoje leem `state.*`.
- `apps/web/src/features/crm/ficha-de-contato.tsx` e `ficha-de-negocio.tsx` — avisam o que a 007 não guarda.
- `apps/web/src/features/estrutura/quadro-negocios.tsx` e `features/crm/quadro-do-funil.tsx` — as duas telas de Negócios que D-06 reduz a uma.

### Regras de negócio e produto
- `ontologia/03-crm/caixa-de-entrada-e-mensageria.md` e `ontologia/03-crm/crm-visao-geral.md` — o contrato da Caixa (INV-CXE-05: a Conversa nasce com a primeira Mensagem).

### Estado da infraestrutura que pesa no ensaio
- `docs/09-planejamento/dados/andamento.mjs` — entradas 1.7.2 e 1.7.3: a homologação não foi montada e o backup diário não foi ligado.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `comTransacao` (`apps/api/src/servicos/crm/transacao.ts`): as rotas do CRM novo gravam por ela; a 3.2.1 precisa juntá-la a `executar()`.
- `executar()` com `aoConfirmar` (`unidade-de-trabalho.ts`): o ponto onde a gravação nas tabelas do CRM entra na mesma transação das operações do Espaço.
- Regras puras em `packages/dominio/src/crm/`: onde cada operação nova (mesclar, consentimento, mover Conversa) deve nascer, com teste ao lado.

### Established Patterns
- Migrações numeradas e imutáveis; a próxima depois da `010` é a nova desta fase. `npm run migrar -w @n1/api -- --seco` lista sem escrever.
- Domínio primeiro, depois a api, depois a tela; o domínio não conhece ninguém.
- Testes de persistência pulam sem `DATABASE_URL` e rodam contra Postgres 16 em Docker local.

### Integration Points
- O chat e a Caixa ainda leem o modelo antigo; os Canais chegam a eles por uma projeção em `GET /estado` e em `executar()` (nunca em `hidratar()`).
- A Tarefa conversacional liga Tarefa a Contato, Conversa, Canal e Negócio por Vínculo (`state.links`); a 3.3 troca o alvo do Vínculo para ids das tabelas novas.

</code_context>

<specifics>
## Specific Ideas

- O dono confirmou que **há dado real no modelo antigo em produção**: tudo nesta fase deve assumir que a migração da Fase 15 vai ter de preservá-lo, e que não há backup diário nem homologação como rede de segurança.
- Decisões escritas em linguagem de produto (o que se vê na tela e o que muda para quem usa), com o código só nos detalhes técnicos.

</specifics>

<deferred>
## Deferred Ideas

- Tags, vários Contatos por Negócio com papel, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio no modelo novo — uma sessão própria, depois (D-04).
- Conversa de Grupo e Mensagens de Flow nas tabelas novas — Sessão 6 (6.6.5) e Sessão 7 (D-05).
- Montar o ambiente de homologação (segundo projeto Supabase, decisão 1.7.1) — fora desta sessão; reavaliar se o ensaio local (D-02) mostrar limite.
- Ligar o backup diário do banco (1.7.3, plano 09-18 pulado) — recomendado antes da migração de produção da Fase 15, mas é decisão de infra do dono.

</deferred>

---

*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Context gathered: 2026-11-04*
