# Decisões — intel sintetizada

Gerado por `/gsd-ingest-docs` (sintetizador) em 2026-09-15. Modo: `new`. Precedência: ADR > SPEC > PRD > DOC.
Cada entrada carrega `source:` para rastreio. Estados: **travada** (não pode ser sobrescrita automaticamente por nenhuma fonte), **proposta** (candidata, vinda de DOC ou de recomendação; não vincula), **aberta** (pergunta sem resposta — ver `context.md` §Questões abertas).

Tudo aqui foi conferido contra o código em `apps/api/`, `apps/web/` e `packages/dominio/` (commits `9fb2754`, `3fd7e1b`, `b20597d`, `d713253`).

---

## 1. ADR — `docs/08-migracao-financeiro/04-spike-persistencia.md` (locked: true, precedence 0)

Relatório de spike datado de 2026-09-15. Não tem cabeçalho formal de ADR; cada um dos "quatro achados" termina numa correção fixada, e o resultado está implementado e testado em `apps/api/src/persistencia/`. Tratado como **Accepted + locked** por manifesto e por instrução do orquestrador.

### DEC-01 — Hidratar o `DataState` inteiro por Espaço de Trabalho; a operação pura roda sem alteração; grava-se só o diff
- status: travada · escopo: persistência do domínio (`packages/dominio` + `apps/api/src/persistencia`)
- decisão: "hidratar o estado, rodar a operação **sem alterá-la**, gravar só o que mudou — e que assim `packages/dominio` e os 214 testes sobrevivem intactos." Validado contra Postgres 17 local e contra o Supabase real: estado hidratado é `toStrictEqual` ao de `buildSeed()`; um Comentário grava 2 linhas; recusa do domínio grava 0 linhas; estado 10× passa.
- custo medido: hidratar 906 registros / 475 KB = 18 ms local, ~82 ms de trabalho real no Supabase (o resto é rede, ~234 ms por ida e volta de um notebook no Brasil).
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §A aposta, §Como foi provado, §Números; `apps/api/src/persistencia/persistencia.test.ts`

### DEC-02 — Tabela genérica `plataforma.registros` (um registro por entidade, `dados jsonb`); colunas geradas para o que se filtra; sem tabela por entidade
- status: travada · escopo: schema `plataforma`
- decisão: "`plataforma.registros` guarda um registro por entidade, com `dados jsonb`. A forma genérica é deliberada: o domínio tem 45 coleções, e tipar as 45 antes de saber quais são consultadas por coluna seria decidir no escuro. As que forem — Tarefa primeiro — ganham coluna gerada depois, sem migrar dado" (`alter table plataforma.registros add column status_id text generated always as (dados->>'statusId') stored`).
- chave primária `(workspace_id, colecao, id)`; índice `(workspace_id, colecao, ordem)`; tabela `plataforma.workspaces (workspace_id, revisao)`.
- **sobrepõe** o SPEC 03-plano Fase 1 ("Tabelas do schema `plataforma` — uma por entidade ... colunas tipadas para o que se filtra, `jsonb` para objetos de valor"). Ver `INGEST-CONFLICTS.md` INFO-02.
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que ficou de pé; `apps/api/migracoes/001-plataforma.sql`

### DEC-03 — Diff por comparação canônica de JSON
- status: travada · escopo: `repositorio.ts` (gravar por diferença)
- decisão: "comparação canônica (chaves em ordem alfabética, recursiva) dos dois lados. De brinde, resolve `undefined` versus ausente — os dois viram a mesma forma." Motivo: `jsonb` reordena chaves e `JSON.stringify` acusava mudança em todo registro lido.
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §Achado 2

### DEC-04 — Posição fracionária (`ordem double precision`) com relabeling mínimo
- status: travada · escopo: ordem das coleções no `DataState` (Registro de Atividade em especial, escrito com `unshift`)
- decisão: "posição fracionária (`double precision`). O novo recebe um valor antes do primeiro e ninguém mais se move. **314 → 2.**" `reordenar` faz relabeling mínimo; quando a fração não cabe mais (~50 inserções sucessivas no mesmo ponto), renumera a partir dali com inteiros.
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §Achado 3; `apps/api/migracoes/001-plataforma.sql` (comentário da coluna `ordem`)

### DEC-05 — Hidratação em uma consulta só; revisão do Espaço de Trabalho vem por `LEFT JOIN`
- status: travada · escopo: `hidratar()`
- decisão: "uma consulta só, com a revisão vinda por `LEFT JOIN` em cada linha (8 bytes por registro contra uma ida e volta). **11.413 → 316 ms.**" Motivo: o cliente `pg` serializa consultas numa conexão; `Promise.all` de duas consultas pagava a rede duas vezes.
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §Achado 4; commit `b20597d`

### DEC-06 — Revisão otimista por Espaço de Trabalho (não por registro), 3 tentativas; escritas serializadas por Espaço
- status: travada · escopo: `unidade-de-trabalho.ts` (`executar()`: transação + revisão otimista)
- decisão: "A revisão é do **Espaço de Trabalho**, não do registro: lida ao hidratar, conferida ao gravar, e a operação recomeça se alguém passou na frente (3 tentativas). É o grão certo porque é o grão que a operação enxerga." Custo aceito: serializar escritas por Espaço de Trabalho. Caminho de escala já previsto: recorte por Lista — "o formato do `DataState` não muda, só o `where`".
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §Concorrência

### DEC-07 — Registro explícito de coleções em `packages/dominio/src/colecoes.ts`
- status: travada · escopo: `packages/dominio`
- decisão: "o domínio passou a declarar as próprias coleções em `packages/dominio/src/colecoes.ts`. O tipo `Record<ChaveDeColecao, true>` mantém a lista honesta: acrescentar uma coleção a `DataState` sem acrescentá-la lá não compila." Motivo: coleção vazia não gera linha, e a hidratação devolvia `undefined` em vez de `[]`.
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §Achado 1; `packages/dominio/src/colecoes.ts`

### DEC-08 — O banco da plataforma é um projeto Supabase **próprio** (`epomplsskqpluxuujpxl`), separado do financeiro (`qewznpnmaqhqfyhncdnx`)
- status: travada · escopo: infraestrutura de dados
- decisão: "O banco da plataforma é um projeto Supabase **próprio** (`epomplsskqpluxuujpxl`), separado do financeiro." Confirmado pelo commit `b20597d` ("O banco da plataforma passa a ser um projeto Supabase separado ... sem encostar no do financeiro").
- **sobrepõe** o SPEC 03-plano §2 ("Supabase `qewznpnmaqhqfyhncdnx` — schema `public` legado, schema `plataforma` novo"; "Dois backends, dois schemas, um banco") e o DOC 00-LEIA-PRIMEIRO ("schema `plataforma` novo, no mesmo Supabase"). Decisão mudou depois de o plano ser escrito. Ver `INGEST-CONFLICTS.md` INFO-01.
- consequência não escrita em lugar nenhum: o schema `plataforma` e o `public` legado **não** se enxergam por JOIN — qualquer leitura cruzada passa por HTTP (coerente com DEC-14). O cabeçalho de `apps/api/migracoes/001-plataforma.sql` ("Mora ao lado do `public` legado do financeiro, no mesmo banco ... os dois se enxergam por JOIN") está desatualizado.
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §Números; commit `b20597d`

### DEC-09 — Testes de persistência pulam sem `DATABASE_URL`; a prova de que os 214 testes valem contra o banco é a equivalência hidratado ≡ seed, não a re-execução dos 214 contra o banco
- status: travada · escopo: verificação (`npm run check`)
- decisão: "O argumento não é 'o INSERT funcionou'. É: **se o estado hidratado for idêntico ao que `buildSeed()` monta, todo teste que hoje passa sobre o seed passa sobre o banco** — sem reescrever nenhum." E: "Sem `DATABASE_URL` os quatro pulam, para `npm run check` não depender de infraestrutura."
- **refina** o critério de pronto da Fase 1 do SPEC 03-plano ("os mesmos 214 testes rodando também contra o banco"). Ver `INGEST-CONFLICTS.md` INFO-03.
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §Como foi provado

### DEC-10 — Migrações SQL numeradas, aplicadas uma vez, imutáveis
- status: travada · escopo: `apps/api/migracoes/NNN-*.sql`, `migrar.ts`, `npm run migrar`
- decisão: "`migrar.ts` aplica as migrações em ordem, uma vez cada (`npm run migrar`)". Commit `b20597d` completa: registradas em `plataforma.migracoes`; "arquivos aplicados são imutáveis e mudança de schema é migração nova".
- nota de caminho: o ADR escreve `apps/api/src/migracoes/001-plataforma.sql`; no código o arquivo está em `apps/api/migracoes/001-plataforma.sql`. O código vence. Ver `INGEST-CONFLICTS.md` INFO-06.
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que ficou de pé; commit `b20597d`

### Item do ADR que NÃO está travado
- **Região do projeto Supabase.** Criado em `us-west-2` (Oregon): 250 ms de conexão daqui contra 99 ms para `sa-east-1`. "Como o projeto está vazio (só o schema `plataforma`), **recriá-lo em São Paulo agora custa um `npm run migrar`**. Depois, custa uma migração de dados. É decisão do dono do projeto; o plano segue igual nos dois casos." → registrada como **aberta** (OQ-ADR-01 em `context.md`).
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §Onde o banco está

---

## 2. Decisões do dono do projeto registradas no SPEC `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2 (precedence 1)

O documento é um SPEC, mas o §2 "Arquitetura-alvo" relata decisões já tomadas pelo dono do projeto ("A decisão do dono do projeto é outra e é melhor"). Por instrução do orquestrador, tratadas como **travadas**. Não são ADR: se um ADR futuro as contradisser, isso é um BLOCKER a resolver, não uma sobreposição automática.

### DEC-11 — O backend do financeiro-tria continua exatamente como está
- status: travada · escopo: `financeiro-tria/automation/` (VPS, PM2, :4100), schema `public` (26 tabelas), `automation/.env`, deploy
- decisão: "**o backend do financeiro-tria continua como está** — mesmo código, mesmo banco, mesmas variáveis de ambiente, mesmo deploy." Substitui a v1 do plano, que reescreveria o `automation/` dentro de `apps/api`.
- o que muda no `automation/`: um arquivo (`adapters/clickup.ts` → `adapters/plataforma.ts`), um encolhe (`clickup-payment-mapper.ts` → `plataforma-payment-mapper.ts`), um endpoint nasce (`POST /webhooks/plataforma/solicitacao-criada`).
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` cabeçalho, §2, §6; `docs/08-migracao-financeiro/00-LEIA-PRIMEIRO.md` §A decisão que define tudo

### DEC-12 — O CRM N1 (`apps/web` + `@n1/dominio`) é o front único; substitui o ClickUp **e** o painel do financeiro-tria
- status: travada · escopo: produto
- decisão: "O que muda é o **front**: o CRM N1 passa a ser a interface, substituindo o ClickUp **e** o painel atual do financeiro-tria." As 23 telas do front Vite/React atual morrem; `financeiro-tria.vercel.app` sai do ar ao fim da Fase 4.
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` cabeçalho, §2, Fase 4; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §10 Morre

### DEC-13 — `apps/api` é o backend do CRM e dono do schema `plataforma`; `automation/` é dono do schema `public`
- status: travada · escopo: fronteira de dados
- decisão: "Cada um dono do seu": `apps/api` → schema `plataforma` (Tarefa, Status, Campo, Comentário, Tag, Membro, Concessão, Registro de Atividade — a ontologia); `automation/` → schema `public` (Solicitações, RAG, espelhos do Omie, emissão de NF).
- **com a correção de DEC-08:** os dois schemas vivem em projetos Supabase distintos, não "num banco".
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2 (tabela "Dois backends, dois schemas")

### DEC-14 — `automation/` fala com `apps/api` por HTTP, pelos mesmos 7 métodos do adapter; **nunca** SQL direto no schema `plataforma`
- status: travada · escopo: contrato `adapters/plataforma.ts` ↔ `apps/api`
- decisão: "O novo `adapters/plataforma.ts` implementa **os mesmos 7 métodos** do `clickup.ts`, chamando `apps/api` por HTTP — **não** escrevendo no schema `plataforma` por SQL direto." Motivo: "publicar um Comentário gera Registro de Atividade; mudar Status verifica Requisito de saída e permissão. SQL direto pularia as duas coisas e corromperia as invariantes que `docs/07-processos/contas-a-pagar.md` especifica (RN-CP-02, RN-CP-04, INV-CP-01)."
- os 7 métodos: `getTask`, `createComment`, `getCommentReplies`, `updateTaskStatus`, `updateTaskDueDate`, `addTaskTag`, `listPaymentRequestTasks` (detalhe em `constraints.md` CON-01).
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §1, §2.1, §2.2

### DEC-15 — `automation/` fica no repositório `financeiro-tria`; mover para o monorepo é decisão adiada (D12)
- status: travada (o adiamento) · escopo: organização de repositórios
- decisão: "Repositório: `financeiro-tria` (fica onde está; mover depois é decisão adiada)". D12: "Adiado por decisão sua. Reavaliar ao fim da Fase 2, quando o contrato entre os dois estiver estável."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2 (tabela), §7 D12

### DEC-16 — Só o que substitui o ClickUp usa a ontologia; as demais telas do financeiro-tria são portadas como tela lendo a API do `automation/`
- status: travada, **com ponto de revisão declarado antes da Fase 2** · escopo: fronteira ontologia × telas portadas
- decisão: "a ontologia ... vale para **o que substitui o ClickUp**: Solicitações, Contas a pagar, Contas a receber". "As demais telas do financeiro-tria **nunca viveram no ClickUp**: Notas fiscais, Produtos, Plano de contas, Extratos, Workflows ... Elas são portadas como tela — mesma leitura, visual do CRM N1." O próprio SPEC avisa: "Se essa divisão não for a que você quer, é o ponto a corrigir antes da Fase 2."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2.4, Fase 4; `docs/08-migracao-financeiro/00-LEIA-PRIMEIRO.md` §Arquitetura-alvo

### DEC-17 — `solicitacoes_pagamentos.TaskID` passa a apontar para a Tarefa da plataforma; coluna `origem` (`clickup` | `plataforma`) desambigua o histórico
- status: travada · escopo: schema `public` do financeiro (única mudança admitida nele)
- decisão: "Passa a guardar o id da Tarefa na plataforma — a coluna mantém o significado ('o id no sistema que é dono da tarefa'), só aponta para outro lugar. As linhas históricas continuam com ids do ClickUp; acrescentar `origem` (`clickup` | `plataforma`) resolve a ambiguidade sem migrar nada."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2.3; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §10 Fica como referência

---

## 3. Decisões candidatas vindas de DOCs e de recomendações (NÃO travadas)

Precedência DOC (3–4) ou recomendação dentro de SPEC. O roadmapper deve tratá-las como propostas a confirmar, nunca como restrição.

### CAND-01 — Uma Integração Omie por Empresa (6), selecionada pelo Campo `Empresa`
- status: proposta · origem: DOC (o documento a chama de "Decisão", mas é um comparativo sem autoridade de ADR)
- texto: "**Decisão**: uma Integração Omie **por Empresa** (6), selecionada pelo Campo `Empresa`" — substitui "3 tenants por path + 6 empresas por credencial". Coerente com 03-plano Fase 5 ("as Empresas viram opções do Campo `Empresa`, e as regras de cada `config.ts` viram configuração por Empresa — sem clonar serviço") e com o risco "credencial só na Integração".
- source: `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` §3.6; `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 5, §5

### CAND-02 — Só a Data de vencimento nativa; o import copia o campo `L-Data Vencimento` para ela
- status: proposta (convergente entre SPEC §12 e DOC) · origem: `contas-a-pagar.md` §12 ("Manter só o nativo e migrar L para ele") + 02-comparativo §3.2 ("Manter a decisão da plataforma; o import copia o campo para o nativo")
- source: `docs/07-processos/contas-a-pagar.md` §4.3, §12; `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` §3.2

### CAND-03 — Observabilidade `automation_runs/steps/events` descartada em vez de migrada; `payment_requests` e as 13 tabelas vetoriais por empresa morrem
- status: proposta · origem: DOC (medição real) + SPEC Fase 0 (nota riscada)
- texto: "9 runs para 1.110 solicitações ... As cinco tabelas de observabilidade podem ser descartadas em vez de migradas." "`payment_requests` (desenhada, nunca usada) · as 13 tabelas vetoriais por empresa e as 7 views `_v`, quando a `conciliador_contas` unificada assumir."
- source: `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §5.7, §10 Morre; `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0

### CAND-04 — C32: rebaixar a base Convidado um Proprietário de registros exige transferência no mesmo ato (alternativa b)
- status: decidida na Fase 6 do frontend, **auto-declarada reversível** · origem: DOC
- regra vive em `deleteRole` (`members.ts`), com `previewSuccession` como fonte única do que conta como propriedade.
- source: `docs/PENDENCIAS-FRONTEND.md` §B C32, §C

### CAND-05 — C34: três leituras conservadoras de Contas a receber no protótipo
- status: proposta (leitura conservadora até existir Gestão contratual, gatilho por tempo em Status e Campo de situação no Contato) · origem: DOC
- (1) R1 é a operação "Nova série de parcelas" na própria Lista, não gatilho em contrato; (2) R4/R5 disparam por vencimento + 30/60 dias, não por tempo em `pendente`; (3) o cliente é um Contato do CRM por Vínculo, e R6 não escreve no Contato.
- o SPEC `contas-a-receber.md` §8 já admite a leitura (1): "se a plataforma não tiver Gestão contratual no primeiro momento, R1 vira um formulário 'criar série de parcelas' na própria Lista". Ver `INGEST-CONFLICTS.md` INFO-05.
- source: `docs/PENDENCIAS-FRONTEND.md` §B C34; `docs/07-processos/contas-a-receber.md` §8

### CAND-06 — Sessão pública (`/f/<segredo>`, `/p/<segredo>`) age como o Proprietário via `PublicoProvider`
- status: provisório, explicitamente "para esta mudança não alterar semântica junto com infraestrutura" · origem: DOC
- pergunta que ficou (A9): `submitForm` deveria usar `form.ownerMemberId` e a sessão pública ser um Ator `sistema`? Decisão de ontologia (documento 19, Proveniência). → aberta (OQ-PF-01 em `context.md`).
- source: `docs/PENDENCIAS-FRONTEND.md` §A A9; commit `d713253`

### CAND-07 — Princípios de arquitetura do frontend que continuam valendo no monorepo
- status: proposta (DOC histórico, mas confirmado indiretamente pelo ADR: "rodar a operação **sem alterá-la**") · origem: DOC
- `app/` não calcula nada (lê `derive`, escreve por `operations/`, formata por `format.ts`); toda operação recebe `(state, actingMemberId, ...)` e devolve `OperationResult<T>` — erro como valor, em pt-BR, nunca lançado pela fronteira; `readonly` é invariante; nada derivado é armazenado; store muta o grafo no lugar e incrementa `revision`; toda mutação chama `recordActivity` com o nome do objeto gravado (INV-ET-12).
- caminhos citados (`app/src/...`) são anteriores ao monorepo; hoje `apps/web/src/` e `packages/dominio/src/`. Ver `INGEST-CONFLICTS.md` INFO-04.
- source: `docs/03-fundacao/ARQUITETURA.md` §2, §3

---

## 4. Decisões abertas (índice)

Não estão travadas nem propostas — são perguntas. Detalhe e recomendações em `context.md` §Questões abertas.

- D6 – D12 (`03-plano-de-migracao.md` §7): Lista própria para Solicitação; onde o recebimento é controlado hoje; aprovação por clique × classificador; status `aprovado`; emissão manual de NF; onde `apps/api` roda; quando mover o `automation/`.
- OQ-ADR-01: região do projeto Supabase (us-west-2 → sa-east-1).
- OQ-CP-01..07 (`contas-a-pagar.md` §12) e OQ-CR-01..07 (`contas-a-receber.md` §12).
- OQ-PF-01 (A9) e P2 (`PENDENCIAS-FRONTEND.md`).
- OQ-CMP-01..03 (`02-comparativo` — `Cartão`/`Link de pagamento`; status `em revisão`; Departamento Omie).
