# Phase 15: Unificação do CRM: telas no modelo novo e remoção do modelo antigo - Research

**Researched:** 2026-11-05
**Domain:** refatoração interna de um monorepo (domínio TS, Fastify + Postgres, Next.js 16): troca de leitura/escrita do CRM antigo (`plataforma.registros`) pelo modelo novo (tabelas 007/008/011), migração de dados de uma via e remoção de código.
**Confidence:** HIGH para o mapa de código, a dívida da Fase 14, o contrato e o desenho do script (tudo lido neste ambiente); MEDIUM para tamanho dos planos e custo do Início/Painel (estimativa por LOC e por leitura, sem execução).

> Esta pesquisa é toda de código e documentos do repositório; nenhum pacote externo entra na fase (ver "Package Legitimacy Audit"). Nada foi executado contra banco: nem produção, nem Docker. Tudo que o planejador deve conferir antes de confiar em um número de linha está marcado.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Já decidido na Fase 14 (vale aqui, não foi reaberto)**
- **F14-D-01:** o corte é de uma vez, sem ponte entre id antigo e novo. **F14-D-02:** o ensaio é local, com a cópia dos dados reais (sem homologação). **F14-D-03:** nada é apagado de `registros` antes de ficar copiado em `registros_crm_antigo`. **F14-D-04:** só o essencial vem para o modelo novo; Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio somem da tela. **F14-D-05:** Grupo e Flow ficam no modelo antigo até as Sessões 6 e 7 (o modelo antigo não sai por inteiro). **F14-D-06:** as Listas espelho de Meus negócios são aposentadas; "Meus negócios" vira o filtro "meus" do quadro de `/crm/funis/[funil]`, a Lista não ganha `funilId`. **F14-D-07:** criar Tarefa conversacional sem Conversa aberta pede a primeira Mensagem.

**Migração e o dado de produção**
- **D-15-01:** Só o `ws_n1` migra para o CRM novo. Os 17 Espaços de teste têm as linhas antigas copiadas para `plataforma.registros_crm_antigo` e apagadas de `plataforma.registros`, sem virar linha no CRM novo. Nenhum Espaço é apagado. O script ganha um modo "só guardar" além de "migrar" e de `--seco`. Descartados: migrar os 18 iguais; apagar os 17 Espaços. — Reversibility: costly.
- **D-15-02:** A rede de segurança do corte é o backup manual mais a cópia no banco. Antes do corte: `pg_dump -Fc --schema=plataforma`, restaurado e conferido em Docker. Depois: `registros_crm_antigo` guarda as linhas antigas. Não se escreve script de desfazer. As linhas antigas são apagadas de `registros` no corte, porque `hidratar()` (`apps/api/src/persistencia/repositorio.ts:96`) carrega qualquer coleção que esteja no banco e as linhas voltariam no `GET /estado`. O backup diário continua desligado (09-18 pulado). — Reversibility: one-way.
- **D-15-03:** Janela de corte combinada. Ordem: backup manual → `npm run migrar -w @n1/api -- --seco` → `npm run migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --seco` (relatório) → o dono aprova o relatório de não migrados (3.5.2) → rodar o script → publicar a API (`publicar.sh`) → web (push para `main` do `n1-tecnologia/crm`). Sem modo manutenção. — Reversibility: reversible.
- **D-15-04:** O Funil do `ws_n1` é decidido olhando o `--seco`. O plano e o script têm de suportar os dois caminhos: migrar como Funil padrão do Espaço, ou só guardar na cópia de segurança e deixar o Espaço sem Funil (D-15-13). — Reversibility: costly.

**Pendências da Fase 14 e o que volta à tela**
- **D-15-05:** Voltam ao cartão e à ficha da Tarefa conversacional: Empresa, qualificação do Contato, estado da Conversa e Atribuído da Conversa. O resumo em lote (`POST /tarefas-conversacionais/resumo`) passa a trazê-los. — Reversibility: reversible.
- **D-15-06:** A temperatura do Contato some até uma sessão própria. Fica só em `registros_crm_antigo`. Sem migração `012` para isso. — Reversibility: costly.
- **D-15-07:** O primeiro plano da fase trata a dívida da Fase 14 que já está em produção: WR-01, WR-02, WR-05 e WR-06; trocar `describe` por `describeComBanco` em `apps/api/src/rotas/operacoes.test.ts` (~linha 268); dar entrada em `LER_DO_CRM` ao `instantiateListTemplate` (`packages/dominio/src/operations/planning.ts:364`) antes da 3.5.4. Os demais avisos (WR-03, WR-04, WR-07, WR-08, WR-09 e IN-01 a IN-05) seguem abertos em `14-REVIEW-DISPOSITION.md`. — Reversibility: reversible.
- **D-15-08:** As Conversas do Membro removido passam ao Sucessor (junto com Contatos, Empresas e Negócios), em vez de ficarem sem Atribuído. Segue o texto original da 3.2.8 e reverte a suposição OQ2/A8 da Fase 14 (que seguia RN-ET-09(b)). O planejador precisa conferir `RN-ET-09(b)` em `ontologia/` e levar a mudança ao contrato se a regra estiver lá; o gesto `GET /membros/:id/sucessao-no-crm` e o diálogo de remover Membro mudam as contagens. — Reversibility: costly.
- **D-15-09:** Os gestos novos do CRM passam a gravar Registro de Atividade (mover, atribuir, lixeira, restaurar, estrela, leitura, nota, transferir Identificador, consentimento; a mesclagem já grava). Isso pede uma tabela de Atividade do CRM novo e uma migração `012`, num plano próprio. A forma da tabela e como a linha do tempo junta as duas fontes ficam para o planejador. Reverte a suposição OQ5 da Fase 14. — Reversibility: costly.
- **D-15-10:** "Mesclar com…" pede digitar o nome do absorvido, como o diálogo antigo, antes de liberar o botão (reverte o item 7 de `14-PROVAS.md`). — Reversibility: reversible.
- As suposições 1 a 12 de `14-PROVAS.md` que não aparecem acima ficam como estão.

**Caixa de Entrada e o fio da Conversa**
- **D-15-11:** O descarte de rascunho de resposta (`Draft`) sai do fio até a Sessão 16. O modelo novo não ganha rascunho nesta fase. Os rascunhos dos Espaços de teste vão para `registros_crm_antigo`. — Reversibility: costly.
- **D-15-12:** O popup "adicionar Canal" das Listas conversacionais deixa de criar Canal. Ele só lista os Canais existentes e leva para `/crm/caixa-de-entrada/configuracoes/canais/conectar`. Um caminho só para criar Canal (nasce `desconectada`, conecta por "Simular conexão"). — Reversibility: reversible.

**Espaço novo, seed e demonstração**
- **D-15-13:** Um Espaço novo nasce com o CRM vazio e sem Funil padrão. `defaultFunnelId` sai do `Workspace`; o Funil padrão vem de `plataforma.funis.padrao` (3.4.7). A demonstração do CRM existe só para desenvolvimento, pelo comando `bootstrap:crm-demo` da 3.5.3. — Reversibility: reversible.
- **D-15-14:** O script remove a Pasta "Meus negócios" e as Listas espelho dela quando estiverem vazias. Se alguma Lista tiver Tarefa espelho de Negócio, não apaga e lista no relatório do `--seco` para o dono decidir. A navegação deixa de oferecer "Meus negócios" para todos os Espaços. — Reversibility: costly.

### Claude's Discretion
- A ordem e o corte em planos, desde que: dívida da Fase 14 (D-15-07) primeiro; domínio antes de api antes de tela; o plano da tabela de Atividade (D-15-09) e a migração `012` antes das telas que dependem dela; o script de migração só depois de todas as telas poderem ler o modelo novo; a remoção (3.5.4) por último; deploy só no corte da D-15-03.
- Nomes de rotas e hooks (`dados/crm/conversas.ts`, `dados/crm/mensagens.ts`, `POST /crm/nomes` em lote, `GET /contatos?comIdentificador=`), paginação e filtros de `GET /conversas`, e como as funções de `derive-*` passam a receber linhas como argumento.
- Como reescrever os testes e fixtures que usam `buildSeed()` com o CRM antigo, e o formato do `bootstrap:crm-demo` (a 3.5.3 propõe um `.sql` só de dados; um construtor em TypeScript que passe pelos serviços também serve, se não envelhecer a cada migração).
- O que fazer com ids antigos em bookmarks (`/crm/contatos/<id antigo>` mostra "não encontrado", como a 3.4.4): o `ws_n1` não tem Contato antigo, então não vale ponte por `crm_de_para`.
- Como o script reescreve os ids em `links`, `tasks[].provenance.sourceId`, `lists[].canaisDeAtendimento`, `grupos[].canalId`, escopos de Funil e `grants` (3.5.1 passo 9), e o relatório de não migrados (`linkedin`, `chatDoSite`, `perfilDeLinkedIn`, `perfilDeTikTok`, `identificadorDeChatDoSite` não têm destino na 007).
- O texto das telas vazias ("crie seu primeiro Funil") e do diálogo de mesclar, em português de produto.

### Deferred Ideas (OUT OF SCOPE)
- Temperatura do Contato no modelo novo — sessão própria, com Tags, vários Contatos por Negócio com papel, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio (F14-D-04 e D-15-06).
- Rascunho de resposta de Conversa nas tabelas novas — Sessão 16 (D-15-11).
- Conversa de Grupo e Mensagens de Flow nas tabelas novas — Sessões 6 e 7 (F14-D-05).
- Montar a homologação (segundo projeto Supabase) e ligar o backup diário do banco (1.7.1 e 1.7.3) — decisão de infra do dono; o corte desta fase usa o backup manual.
- Modo manutenção durante o corte e script de desfazer a migração — considerados e descartados nesta discussão (D-15-02, D-15-03).
- Apagar os 17 Espaços de teste de produção — decisão do dono sobre Espaços, fora do CRM (D-15-01 só guarda as linhas antigas deles).
</user_constraints>

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` importa `CONTEXT.md` (raiz) e `AGENTS.md`. Diretivas acionáveis, tratadas como decisões travadas:

- **Regra de dependência:** `packages/dominio` não conhece ninguém; `apps/web` e `apps/api` conhecem o domínio e **nunca um ao outro**. Mudança que nasce nas três camadas começa no domínio e desce (domínio → api → web). [VERIFIED: CONTEXT.md raiz, "A regra de dependência" e "Onde uma mudança nasce"]
- **Next.js 16 é "não o que você conhece":** ler o guia relevante em `node_modules/next/dist/docs/` antes de recomendar/escrever qualquer API do Next. [VERIFIED: AGENTS.md] A pasta existe em `apps/web/node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`). Esta fase não introduz API nova do Next: só remove páginas (`crm/meus-negocios/**`, recuos 404) e reescreve client components. O padrão vigente para `params` é Promise lida com `use(params)` (ex.: `apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx`). O planejador deve mandar o executor reler o guia de rotas/`params` antes de tocar uma `page.tsx`.
- **`npm test` não é o gate:** leva 13–17 min contra o `.env` de produção; o gate é `npm run check` com Postgres 16 em Docker e `DATABASE_URL`/`DATABASE_URL_MIGRACAO` escritas no próprio comando (ver `14-PROVAS.md`, "Como rodar o gate"). Flakes de baseline conhecidos: `outbox-worker.test.ts` (h a k), `colunas-geradas.test.ts`, `lote-contas-a-pagar (d)`. [VERIFIED: memória do projeto + 14-PROVAS.md "Flakes de baseline"]
- **Produção só é tocada no corte (D-15-03).** Nada nesta pesquisa nem nos testes toca o banco do `.env`.
- **Arquivos gerados / do dono:** `docs/09-planejamento/TAREFAS-POR-SESSAO.md` é gerado de `docs/09-planejamento/dados/*.mjs` e nunca se edita à mão; `andamento.mjs` está **não rastreado** no git e tem trabalho do dono em andamento. [VERIFIED: gitStatus da sessão + CONTEXT.md canonical_refs] O planejador entrega as linhas de andamento no fim (como o 14-18 fez em `14-PROVAS.md`), não edita o arquivo.
- **Skills de projeto:** `.claude/skills/` e `.agents/skills/` não existem. [VERIFIED: `ls` neste ambiente]

<phase_requirements>
## Phase Requirements

O CONTEXT deriva `UNI-04..UNI-08`, mas **esses ids já existem na Fase 14 com outro significado** [VERIFIED: `.planning/ROADMAP.md:764` "UNI-01 a UNI-17 (IDs locais da fase…)" e `14-RESEARCH.md:47-63`: `UNI-04 | Gesto misto…`, `UNI-05 | Mesclar Contatos…`, `UNI-06 | Transferir Identificador`, `UNI-07 | Registrar e respeitar consentimento`, `UNI-08 | Mover Conversa para outro Contato`]. Reutilizá-los faria `COVERAGE.md` e os `Phase Requirements` de duas fases se contradizerem. **Recomendação (assumption error do CONTEXT): usar o prefixo `UCR-` (Unificação do CRM, Fase 15).** `REQUIREMENTS.md` não tem nenhum `UNI-` (grep vazio), então não há conflito lá.

| ID | Descrição | Subtarefas / decisões | Equivale ao id do CONTEXT |
|----|-----------|-----------------------|----------------------------|
| UCR-01 | Dívida da Fase 14 em produção tratada antes das telas: WR-01, WR-02, WR-05, WR-06, `describeComBanco`, `instantiateListTemplate` em `LER_DO_CRM` | D-15-07 | parte de UNI-04 |
| UCR-02 | Conversas do Membro removido passam ao Sucessor; contrato (`ontologia/`), domínio/api/diálogo | D-15-08 | — (faltava) |
| UCR-03 | Atividade do CRM novo: migração `012`, tabela, gestos gravam, linha do tempo junta as duas fontes (incl. Auditoria e Reunião) | D-15-09 | parte de UNI-08 |
| UCR-04 | Cartão e ficha da Tarefa conversacional voltam a mostrar Empresa, qualificação, estado e Atribuído; "Mesclar com…" pede o nome | D-15-05, D-15-10 | parte de UNI-08 |
| UCR-05 | Caixa de Entrada (lista, gestos, fio, configurações, Filas, Canais) lê e grava só o modelo novo; sem rascunho; popup de Canal só liga | 3.4.1–3.4.3, D-15-11, D-15-12 | parte de UNI-04 |
| UCR-06 | Fichas de Contato/Empresa/Negócio sem recuo ao legado; Meus negócios e Reuniões pelo modelo novo; Pasta/Listas espelho aposentadas | 3.4.4, 3.4.5, D-15-14 | parte de UNI-04 |
| UCR-07 | Busca, Lixeira, Notificações, Início, Configurações e Painel sem `contacts/deals/conversations/funnels` no store; Espaço novo sem Funil padrão | 3.4.6, 3.4.7, D-15-13 | parte de UNI-04 |
| UCR-08 | Ferramentas (Grupos, Comunidades, Flows, Participações), IA e Contas a receber pelos ids novos de Contato e Canal | 3.4.8–3.4.10 | parte de UNI-04 |
| UCR-09 | Script de migração `migrar:crm-antigo` (modos `--seco`, migrar, só guardar), cópia de segurança completa, relatório de não migrados | 3.5.1, D-15-01, D-15-04, D-15-14 | UNI-05 |
| UCR-10 | Ensaio local sobre a cópia (`~/n1-ensaio`) e corte em janela combinada, com aprovação do dono | 3.5.2, D-15-02, D-15-03 | UNI-05 |
| UCR-11 | Seed sem CRM antigo; Espaço novo com CRM vazio; `bootstrap:crm-demo` para desenvolvimento | 3.5.3, D-15-13 | UNI-06 |
| UCR-12 | Modelo antigo fora do código (salvo Grupo/Flow) e guardas que impedem a volta | 3.5.4, D-05 da F14 | UNI-07 |
</phase_requirements>

## Summary

A Fase 15 é uma troca de leitura e escrita seguida de uma remoção de uma via. O modelo novo (007/008/011) e as rotas REST por recurso já existem e estão em produção desde 2026-11-05; faltam (a) as telas, (b) cinco peças que o CONTEXT decidiu acrescentar (dívida da Fase 14, regra de Sucessor, Atividade `012`, resumo estendido, hooks de Conversa/Mensagem), (c) o script de dados e (d) a remoção.

Três achados mudam o plano em relação ao CONTEXT e à 3.4/3.5: **(1)** o ws_n1 foi criado por `buildGestaoBootstrap`, que cria exatamente 1 Funil `fnl_padrao` ("Padrão", uma Etapa "Novo") e **não** cria a Pasta "Meus negócios"; isso quase resolve D-15-04 e contradiz o "provavelmente já as tem" de D-15-14. **(2)** A ontologia diz o contrário de D-15-08 em oito lugares (Conversas são **liberadas**, "Não há Sucessor de Conversas"), então o contrato tem de ser emendado antes do código. **(3)** Preservar o id antigo como id novo (as colunas `id` são `text` sem formato) elimina o passo de reescrever `links`/`provenance`/escopos e mantém coerentes os Vínculos que o seed deixa em `registros` para o `bootstrap:crm-demo`; é a escolha de menor risco para o script e fica no critério do planejador (D: "Claude's Discretion").

O tamanho real não é o do CONTEXT: a contagem de "62 arquivos" é um `grep` de palavra que inclui comentários e **perde** 13 arquivos que leem o modelo antigo por tipo, função derivada ou operação. Por AST, são **72 arquivos de código** na web que tocam o modelo antigo (lista na seção "Caller map"). O maior risco técnico não está nas telas: está em 3.4.8 (Ferramentas **criam Contatos** dentro de operações puras, `resolverOuCriarContato`) e no Início/Painel (precisam de agregados que as rotas atuais não oferecem).

**Primary recommendation:** cortar a fase em ~21 planos em seis ondas (dívida → contrato/Atividade/resumo → hooks base → telas em paralelo por posse de arquivo → script/seed/ensaio → remoção + corte), com o script de migração rodando como **uma única `executar()` travada por Espaço**, preservando ids, e com uma guarda de código-fonte por camada (`sem-crm-antigo.test.ts`) que encolhe plano a plano até a remoção.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Regra "Conversa passa ao Sucessor" (D-15-08) | Domínio (`ontologia/` + função pura de contagem/regra) | API (`repositorios/crm/sucessao.ts`, `AO_CONFIRMAR`) | A regra tem de valer igual na tela (diálogo) e no endpoint; hoje a prévia vem da api e o domínio só recusa o Sucessor inválido. |
| Registro de Atividade do CRM novo (D-15-09) | Banco (`012`) + API (repositório chamado no mesmo `cliente` do gesto) | Domínio (tipo e vocabulário de `acao`) / Web (linha do tempo mescla duas fontes) | A gravação precisa estar na transação do gesto; a leitura mescla `state.activity` (registros) com a tabela nova. |
| Resumo em lote da Tarefa conversacional (D-15-05) | API (SQL em `repositorios/crm/tarefas-conversacionais.ts`) | Domínio (tipo `ResumoDaTarefaConversacional`) / Web (cartão, ficha) | Junção de tabelas do CRM; a web só desenha. |
| Leitura de Conversas/Mensagens/Contatos/Negócios nas telas | API (rotas REST já existentes + filtros novos) | Web (`dados/crm/*` SWR) | O store (`GET /estado`) deixa de carregar o CRM. |
| Agregados do Início/Painel/Notificações | API (endpoint de agregado novo) | Web (consome) / Domínio (`derive-*` recebem linhas) | `paginaMaxima` é 200: somar listas paginadas no navegador dá número errado. |
| Script de migração dos dados | API (`executar()` travada + SQL em lote) | Domínio (função pura que reescreve/remove em `registros` e monta o relatório) | Precisa do lock do Espaço, da revisão e do `hidratar`; o mapeamento antigo→novo é regra pura e testável sem banco. |
| Remoção do modelo antigo | Domínio → API → Web (nessa ordem) | Guardas de código-fonte por camada | Porta de uma via; o `tsc` é a rede principal (remover de `DataState` e `TODAS`). |
| Ferramentas criando Contato de Participante | API (gesto misto: `lerDoCrm` resolve/gera ids, `aoConfirmar` insere em `plataforma.contatos`) | Domínio (operação pura devolve o que criar) | A operação pura não pode inserir no banco; o padrão de ids pré-gerados já existe na Tarefa conversacional. |

## Standard Stack

### Core
Nenhuma dependência nova. Tudo é a pilha que já está no repositório:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v24.14.0 (neste ambiente) | runtime dos CLIs `vite-node` | já usado por `migrar`, `bootstrap:*` [VERIFIED: `node --version`] |
| Postgres | 16 (Docker `postgres:16`) para teste; Supabase em produção | persistência | [VERIFIED: `14-PROVAS.md` "Como rodar o gate"] |
| `pg` | ^8.23.0 | cliente, `PoolClient`, `jsonb` | [VERIFIED: `apps/api/package.json`] |
| `fastify` + `zod` + `@fastify/type-provider-zod` | ^5.12.5 / ^4.6.5 / ^1.0.0 | rotas REST do CRM | [VERIFIED: `apps/api/package.json`] |
| `vitest` | ^5.0.0 | testes das três camadas | [VERIFIED: `apps/api/package.json`; runs de `14-PROVAS.md` mostram `v5.0.1`] |
| `swr` | já usado por `dados/crm/*.ts` | hooks de leitura | [VERIFIED: `apps/web/src/dados/crm/contatos.ts` importa `useSWR from "swr"`] |
| `typescript` | ^5 | `tsc` é a rede da remoção | [VERIFIED: `package.json` raiz] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `executar()` travada para o script | SQL puro em transação própria | SQL puro precisa repetir trava do Espaço, subida de `revisao` e o `begin` com prazos; um navegador aberto no `ws_n1` poderia gravar por cima. Use `executar()`. |
| Reescrever ids (3.5.1 passo 9) | **Preservar o id antigo** como id novo (colunas `id text`) | Ver "Decisão de ids" abaixo. Recomendado preservar; reescrever só onde a chave não é única (Etapa). |
| `.sql` só de dados para o `bootstrap:crm-demo` | Fixture JSON + carregador TS com colunas explícitas | `.sql` precisaria do `workspace_id` embutido (PK e FKs compostas incluem `workspace_id`); ver "Seed e demo". |

**Installation:** nenhuma. **Version verification:** não se aplica (sem pacote novo).

## Package Legitimacy Audit

Nenhum pacote externo é instalado nesta fase. `gsd-tools query package-legitimacy check` não foi executado porque não há nome de pacote a verificar.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** nenhum. **Packages flagged as suspicious [SUS]:** nenhum.

## Caller map (pergunta 1)

### Método e a conta dos "62 arquivos"
- O número 62 **reproduz**: `grep -rlE '\b(contacts|companies|deals|funnels|channels|conversations|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b'` em `apps/web/src` (fora de `*.test.*`) devolve 62 arquivos. [VERIFIED: rodado neste ambiente]
- Mas o `grep` mistura **comentários** (ex.: `nova-tarefa-conversacional-dialog.tsx`, `cartao-conversacional.tsx`, `container-settings.tsx`, `create-container-dialog.tsx`, `dados/crm/canais.ts`, `mesclar-contato-dialog.tsx` só citam as palavras em comentário) e **perde** quem lê o modelo antigo por import de tipo, função derivada ou operação. A leitura por AST do TypeScript (propriedade `.contacts` etc., desestruturação, `import { <op | derive | tipo antigo> }`) dá **72 arquivos de código reais** (75 linhas do script, menos 3 falsos positivos: `design/carregador.tsx` e `features/paineis/graficos.tsx` só importam o **ícone** `Contact`/`Funnel` do `lucide-react`, e `conectar-provedor.tsx` importa o `criarCanal` **novo** de `@/dados/crm/canais`). `features/shell/app-shell.tsx` também importa o ícone `Contact`, mas **fica** na lista por causa de `notificacoesDoMembro`.
- Não estavam nos 62 (e precisam trocar): `configuracoes/membros/page.tsx` e `[membro]/page.tsx` (`previewSuccession`), `crm/meus-negocios/page.tsx` (`dealOfTask`), `estrutura/listas/[lista]/page.tsx` (`listaSemCanais`, `dealOfTask`), `paineis/[painel]/page.tsx` (`widgetReading`), `features/crm/adicionar-canal-dialog.tsx` (`criarCanal` antigo + tipo `Channel`), `seletor-de-canal.tsx`, `selo-do-provedor.tsx`, `separador-de-canal.tsx`, `tarefas-do-contato.tsx`, `features/estrutura/detalhes-da-lista.tsx`, `dialogos-da-lista.tsx`, `quadro-negocios.tsx`, `financeiro/lens.ts` (`clienteDe`), `inicio/resumo-do-inicio.tsx`, `shell/barra-global.tsx`, `shell/app-shell.tsx`. [VERIFIED: `scripts` de AST em `scratchpad`, lista a seguir]

### Web, por subtarefa dona (arquivos de código; `D` = apagar, `T` = trocar, `K` = só tipo/derive)

| Subtarefa | Arquivo (apps/web/src) | O que lê/escreve do antigo | Ação |
|---|---|---|---|
| **3.4.1** | `app/(shell)/crm/caixa-de-entrada/page.tsx` (`:22` `data.conversations.filter`) | conversations | T |
| 3.4.1 | `features/crm/inbox-columns.tsx` (`:113` `state.conversations`, `:420` `toggleConversationStar`) | conversations, contacts, channels | T |
| 3.4.1 | `app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx` (`:93` `state.conversations.find`; `:157` `assignConversation`, `:321` `reopenConversation`, `:332` `resolveConversation`, `:391` `trashConversation`) | conversations, channels, contacts, deals, companies; `principalCompanyId` | T |
| 3.4.1 | `features/crm/move-conversation-dialog.tsx` (`moveConversationToContact`) | conversations, channels, contacts | T (usa `moverConversa` novo) |
| **3.4.2** | `features/crm/conversation-thread.tsx` (1442 linhas; `:375/:393` `startConversation`, `:428` `sendMessage`, `:486` `discardDraft`, `:772` `addContactNote`, `:845` `criarTarefaConversacional` já novo, `:357` `marketingConsentMissing`) | deals, conversations, channels; `canaisDoFio`, `canalPadraoDeResposta`, `canaisDaLista`, `listaSemCanais`, `responseWindowOpenUntil` | T (maior arquivo da fase) |
| 3.4.2 | `features/crm/seletor-de-canal.tsx`, `separador-de-canal.tsx`, `selo-do-provedor.tsx` | tipos `Contact`/`Channel`, `canaisDeResposta` | K→T |
| 3.4.2 | `features/estrutura/tarefa-completa.tsx` (`:2060-2065` `state.deals/contacts/conversations`; `contatoDaTarefa`, `canalDaTarefa`) — **também** é dono do resumo (D-15-05) | deals, contacts, conversations | T (dividir com UCR-04, ver conflito de posse) |
| **3.4.3** | `app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx` (`:145` contagens) | desestrutura `channels`, `conversations` | T |
| 3.4.3 | `.../configuracoes/filas/[fila]/page.tsx` | conversations, channels, contacts | T |
| 3.4.3 | `.../configuracoes/canais/[canal]/page.tsx` (`:92` `state.channels.find`, `:147` conversations, `configurarCanal` antigo) | channels, conversations | T (`PATCH /canais/:id`) |
| 3.4.3 | `features/crm/adicionar-canal-dialog.tsx` (`:24` `import { criarCanal } from "@n1/dominio/operations"`, `:95`), usado por `container-settings.tsx` e `create-container-dialog.tsx` | `criarCanal` antigo | T (D-15-12: só lista e leva à página de conectar) |
| 3.4.3 | `features/estrutura/canais-de-atendimento.tsx` (`:64` `state.channels.filter`) | channels | T (`useCanais`) |
| **3.4.4** | `app/(shell)/crm/contatos/[contato]/page.tsx`, `empresas/[empresa]/page.tsx`, `negocios/[negocio]/page.tsx` | recuo para o legado (`state.contacts.some`) | T (tirar recuo) |
| 3.4.4 | `features/crm/legado/ficha-de-contato-legado.tsx`, `legado/ficha-de-empresa-legado.tsx`, `deal-screen.tsx` (968 linhas), `restore-copy-dialog.tsx`, `import-contacts-dialog.tsx` (não montado), `empresa-popup.tsx`, `merge-contacts-dialog.tsx`, `transfer-identifier-dialog.tsx` | todo o legado | **D** |
| 3.4.4 | `features/crm/contact-card.tsx` (`setContactCatalogValue`, `:176`) | companies, conversations, channels | T (`PATCH /contatos/:id {qualificacao}`) |
| 3.4.4 | `features/crm/tarefas-do-contato.tsx` (`tarefasConversacionaisDoContato`) | derive antigo | T |
| **3.4.5** | `app/(shell)/estrutura/listas/[lista]/page.tsx` (`:217` `listaSemCanais`, `dealOfTask`, `QuadroNegocios`, `IniciarConversaDialog`, `DealScreen`) | derive/dealOfTask | T (dono único; **3.4.2 e 3.4.3 não podem tocar**) |
| 3.4.5 | `features/estrutura/quadro-negocios.tsx`, `deal-card.tsx`, `iniciar-conversa-dialog.tsx`, `dialogos-da-lista.tsx` (`Deal`), `detalhes-da-lista.tsx` (`canaisDaLista`) | Deal, `negocioDaTarefa`, `iniciarConversa` | D/T |
| 3.4.5 | `app/(shell)/crm/reunioes/[reuniao]/page.tsx` (`:138-215` deals/contacts/companies/funnels, `:157` `state.activity`, `addContactNote`) | deals, contacts, companies, funnels | T (depende de UCR-03) |
| 3.4.5 | `app/(shell)/crm/meus-negocios/page.tsx` e `meus-negocios/[lista]/page.tsx` | `dealOfTask` | **D** (rota some) |
| **3.4.6** | `app/(shell)/buscar/page.tsx`, `configuracoes/lixeira/page.tsx` (`restoreContact/Company/Deal/Conversation`), `notificacoes/page.tsx` | todas as quatro coleções | T |
| 3.4.6 | `features/shell/app-shell.tsx`, `features/shell/barra-global.tsx` (`notificacoesDoMembro`, badge global em toda página) | conversations | T |
| **3.4.7** | `features/inicio/resumo-do-inicio.tsx`, `panorama-do-robo.ts`, `app/(shell)/paineis/[painel]/page.tsx` (`widgetReading`) | derive de conversas/contatos/negócios | T (precisa de agregado) |
| 3.4.7 | `configuracoes/campos/page.tsx`, `tags/page.tsx`, `catalogos/page.tsx`, `configuracoes/page.tsx` (`:110` `defaultFunnelId`), `features/configuracoes/governance-access-dialog.tsx` (`:221` Funil) | contagem de uso / Funil antigo | T |
| 3.4.7 (D-15-08) | `configuracoes/membros/page.tsx`, `membros/[membro]/page.tsx` (`previewSuccession`) | contagens | T (UCR-02) |
| **3.4.8** | 14 arquivos em `features/ferramentas/` (`aba-comunidades`, `aba-flows`, `aba-grupos`, `comunidade-popup`, `conversa-do-grupo`, `criar-comunidade-dialog`, `criar-flow-dialog`, `criar-grupo-dialog`, `flow-builder`, `flow-popup`, `grupo-popup`, `importar-grupos-dialog`, `participacoes`, `pedidos-de-entrada`) — 5025 linhas no diretório | `state.channels`, `state.contacts`, `contatosComWhatsApp`, `conversaDoGrupo`/`enviosDoFlow` (essas ficam no antigo, D-05) | T |
| **3.4.9** | `features/ia/ancora-do-chat.tsx`, `agentes/agente-completo.tsx`, `agentes/ensaiar-dialog.tsx`, `automacoes/automacao-spec.ts`, `editor-de-automacao.tsx`, `nova-automacao-dialog.tsx` | deals/contacts/conversations/funnels/channels | T |
| **3.4.10** | `features/estrutura/financeiro/serie-dialog.tsx` (`:78`), `lens.ts` (`:176` `clienteDe`) | contacts | T |

Falsos positivos para ignorar: `design/carregador.tsx`, `features/paineis/graficos.tsx` (ícones do lucide), `conectar-provedor.tsx` (usa o `criarCanal` novo), `dados/crm/canais.ts`, `mesclar-contato-dialog.tsx`, `nova-tarefa-conversacional-dialog.tsx`, `cartao-conversacional.tsx`, `container-settings.tsx`, `create-container-dialog.tsx` (só comentário).

### Domínio (arquivos de produção, fora de `OPERACOES` dos três módulos antigos)

| Arquivo | Leitura/escrita do antigo | Destino |
|---|---|---|
| `state.ts:85-96`, `colecoes.ts` (`TODAS`) | declaram `contacts`, `companies`, `deals`, `funnels`, `contactCompanyLinks`, `companyCompanyLinks`, `distinctFromLinks`, `channels`, `conversations` | 3.5.4 (manter só `conversations` como resto de Grupo/Flow) |
| `types/crm.ts` (551 linhas) | `Contact`…`Inbox`; **manter** `Queue`, `Inbox`, `BusinessHours`; **mover** `ChannelType`, `ProvedorDeCanal`, `ChannelCapabilities`, `ContactIdentifierType`, `MessageDeliveryStatus`, `ConsentRecord` se algo novo ainda os importa (`provedores-de-canal.ts`, `crm/canais.ts`, `types/ferramentas.ts`, `operations/ferramentas/capacidades.ts`) | 3.5.4 |
| `operations/contacts.ts` (1304), `conversations.ts` (878), `deals.ts` (892), `iniciar-conversa.ts` (153), `canais.ts` (345: `criarCanal`, `configurarCanal`, `validarCanaisDeAtendimento`, `nomeEmUso`), `crm-antigo.ts` (35) | as 45 operações antigas | 3.5.4 |
| `derive.ts` (`contactDisplayRole`, `principalCompanyId`, `effectiveProbability`, `responseWindowOpenUntil`, `lastInteraction`, `marketingConsentMissing` `:721`, `duplicateSuspicions`, `notificacoesDoMembro`, `recordsOfTarget`/`widgetReading`) | state.contacts/deals/conversations/funnels | 3.4.6, 3.4.7, 3.5.4 |
| `derive-conversacional.ts` (`contatoDaTarefa`, `conversaDaTarefa`, `canalDaTarefa`, `negocioDaTarefa`, `canaisQueAlcancam`, `canaisDaLista`, `canaisDoFio`, `canalPadraoDeResposta`) | `:62-154`, `:270-326` | 3.4.2 / 3.4.5, depois 3.5.4 (+ `derive-conversacional-antigo.test.ts`) |
| `derive-resumo.ts` (`conversasComMensagensNovas` `:70`, `leadsAAtender` `:134`, `estatisticasDoMembro` `:448`) | conversations/contacts/deals | 3.4.7 |
| `derive-ferramentas.ts` (`conversaDoGrupo` `:148`, `enviosDoFlow`, `respostasDoFlow`, `respostasDeFlowDoContato`, `contatosComWhatsApp` `:318`) | **conversations ficam** (Grupo/Flow); `contatosComWhatsApp` muda | 3.4.8 |
| `derive-ia.ts:309`, `operations/ia/automacoes-catalogo.ts:149` (`escopoExiste`), `operations/ai.ts:989-997` (`anchorName`), `operations/ia/agentes.ts:144,371-377` | funnels/deals/contacts/companies/conversations | 3.4.9 |
| `operations/financeiro.ts:1747,1813` (`clienteDe`, `createReceivableSeries`), `operations/importacao-contas-a-receber.ts:173` | contacts/companies | 3.4.10 |
| `operations/members.ts:27-73,249-251,310,808` (`previewSuccession`, `removeMember`, `resourceName`) | contacts/companies/deals/conversations/funnels | UCR-02 (api faz o CRM novo), limpeza em 3.5.4 |
| `operations/tasks.ts:70-95` (`vinculoRefusal`), `operations/structure.ts:427-431` (`nomesDosCanais` com ramo `state.channels`), `operations/tarefa-conversacional-nas-tabelas.ts` | só ramo antigo/comentário | 3.5.4 |
| `operations/ferramentas/{grupos,comunidades,flows,participacoes,permissoes,automacoes,provedor-simulado}.ts` (~60 ocorrências de `state.channels`/`state.contacts`; `participacoes.ts:36-85` **cria** Contato) | Canal e Contato por id; `state.conversations` (Grupo/Flow) **fica** | 3.4.8 |
| `operations/planning.ts:364` (`instantiateListTemplate` → `createList` sem `canais`) | ponte de Canais | UCR-01 |
| `bootstrap-gestao.ts:104,171-185` (`defaultFunnelId: "fnl_padrao"`, `state.funnels.push(funilPadrao)`) | Funil do bootstrap | 3.4.7 / 3.5.3 (D-15-13) |
| `seed.ts`, `seed-comercial.ts`, `seed-pos-venda.ts`, `seed-produto.ts`, `seed-ferramentas.ts`, `seed-contas-a-receber.ts` (4769 linhas) | CRM antigo de demonstração | 3.5.3 |
| `types/workspace.ts:230` (`defaultFunnelId: Id`) | campo do Workspace | 3.4.7 |

### API (poucos arquivos, de produção)
- `apps/api/src/persistencia/canais-projetados.ts` (+ `.test.ts`), `rotas/estado.ts:29,41`, `persistencia/unidade-de-trabalho.ts:496,556,618` (as linhas do TAREFAS `:137`/`:189` **derivaram**: ver "Assumption errors"), `repositorios/crm/referencias.ts:77` (`canalAntigoEmConflito`; TAREFAS dizia `:63`) e a chamada em `servicos/crm/canais.ts:132`.
- Esquemas de argumentos das operações antigas: `rotas/esquemas/{contatos,negocios,conversas,canais,iniciar-conversa}.ts` (`CONTATOS`, `NEGOCIOS`, `CONVERSAS`, `CANAIS`, esquema de `iniciarConversa`) compostos em `rotas/esquemas-de-argumentos.ts`; `rotas/esquemas-de-argumentos.test.ts:126` fixa `expect(chaves.length).toBe(285)` (ver "Removal safety net").
- `apps/api/src/importacao/clickup/importar-contas-a-receber.ts:62-65` (monta o catálogo de clientes de `state.contacts`/`state.companies`) e `bootstrap/conferir-contas-a-receber.ts:302` (`defaultFunnelId: "fnl_padrao"` e ids de seed).
- `rotas/operacoes.ts` `LER_DO_CRM` (hoje só `createList` e `definirCanaisDaLista`, retornando `Canal[]`) precisa ser generalizado para 3.4.8 e 3.4.10.
- Importam tipos antigos: `persistencia/canais-projetados.ts` (`Channel`), `persistencia/unidade-de-trabalho.ts` (`Channel`), `repositorios/crm/canais.ts` (`ProvedorDeCanal` — fica, vira de `crm/capacidades.ts`), `rotas/esquemas/contatos.ts` (`ContactIdentifierType`). [VERIFIED: AST]

### Grupo/Flow (devem continuar no `Conversation` antigo) vs. o que muda
- **Ficam no antigo** (D-05): `state.conversations` com `groupIdentifier`, as Mensagens de Flow (`Message.flow`, `respostaDeFlow`), `conversaDoGrupo`, `enviosDoFlow`, `respostasDoFlow`, `respostasDeFlowDoContato`, `enviarFlow`/`receberRespostaDeFlow` (`flows.ts:854-858`), `grupos.ts:431,873` (`state.conversations`), `provedor-simulado.ts:69`, `features/ferramentas/conversa-do-grupo.tsx`, `flow-popup.tsx` (parte de envios).
- **Muda para ids novos:** o **Canal** (`Grupo.canalId`, `Comunidade.canalId`, `Flow.canalId`) e o **Contato** das Participações e dos Pedidos de Entrada (`types/ferramentas.ts:94,123` `contactId`).
- **Consequência de tipo:** `DataState.conversations` não pode sumir (a chave não pode ser removida de `DataState`/`TODAS`). Recomendação: **manter a chave `conversations`**, restringir o tipo a `ConversaDeGrupo` (novo `types/conversa-de-grupo.ts`) e permitir `state.conversations` na guarda só nos arquivos de Grupo/Flow. Renomear a coleção exigiria mover linhas em `registros` (outra migração de dados) sem ganho.

## Dependency order & plan cut (pergunta 2)

### Regras que o corte tem de obedecer
1. **Posse de arquivo.** Planos de tela só rodam em paralelo se não dividem arquivo. Conflitos reais encontrados:

| Arquivo | Quem mexe | Dono sugerido |
|---|---|---|
| `features/estrutura/tarefa-completa.tsx` | resumo (D-15-05), fio (3.4.2), `contatoDaTarefa/canalDaTarefa` | UCR-04 primeiro; 3.4.2 depois (sequencial) |
| `app/(shell)/estrutura/listas/[lista]/page.tsx`, `detalhes-da-lista.tsx`, `dialogos-da-lista.tsx` | 3.4.2 (`canaisDaLista`, `listaSemCanais`), 3.4.3, 3.4.5 | **só 3.4.5** (3.4.2/3.4.3 não tocam) |
| `app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx` | 3.4.1 e 3.4.2 | 3.4.1 primeiro; 3.4.2 consome |
| `derive.ts` | 3.4.6 (`notificacoesDoMembro`), 3.4.7 (`widgetReading`), 3.5.4 | sequencial 3.4.6 → 3.4.7 → 3.5.4 |
| `derive-conversacional.ts` | 3.4.2, 3.4.5, 3.5.4 | sequencial |
| `rotas/operacoes.ts` (`LER_DO_CRM`), `rotas/esquemas/*` | `instantiateListTemplate` (UCR-01), 3.4.8, 3.4.10 | **generalizar `LER_DO_CRM` uma vez, no UCR-01**, com forma `{ posicao, ler }` onde `ler` devolve `{ canais?, contatos?, empresas? }` por operação |
| `operations/registro.ts`, `operations/index.ts` (barril com uma linha `instrumentar` por operação) | só a remoção | **3.5.4** (nenhum plano de tela apaga operação; o domínio antigo fica morto até lá) |
| `servicos/crm/{conversas,contatos,notas,consentimentos,mesclagem,sucessao}.ts` | UCR-01 (WR-01), UCR-03/05 (Atividade), 3.4.x (filtros novos) | sequencial UCR-01 → UCR-05 → hooks base |

2. **Ordem do CONTEXT:** dívida primeiro; domínio → api → web; `012` antes das telas que a leem (Reunião, Auditoria); script só depois de todas as telas poderem ler o novo; remoção por último; **deploy único no corte** (a lição da Fase 14: `14-15..14-17` não podiam subir antes).
3. **Cada plano deixa `npm run check` verde em Docker** e não apaga domínio antigo (só a web apaga os componentes legados que perderam o último chamador).

### Corte proposto (21 planos, 6 ondas). Tamanho: S ≤ ~800 LOC tocadas, M ≤ ~2000, L > 2000 (dividir se passar de ~3 tarefas pesadas)

| Onda | Plano | Conteúdo | Req | Tam. | Paralelo com |
|---|---|---|---|---|---|
| A | 15-01 | Dívida F14 (D-15-07): WR-01/02/05/06, `describeComBanco`, `instantiateListTemplate` + generalizar `LER_DO_CRM` | UCR-01 | M | — (primeiro) |
| B | 15-02 | Contrato D-15-08: emendar `ontologia/`; `sucessao` (repo/serviço/rota) passa Conversas; diálogo e contagens; IN-01 junto | UCR-02 | M | 15-03, 15-04 |
| B | 15-03 | `012` Atividade: DDL, repositório, tipo, `GET /atividades`, `limparEspaco`, `migracao-012.test.ts` | UCR-03 | M | 15-02, 15-04 |
| B | 15-04 | Resumo estendido (Empresa, qualificação, estado, Atribuído) + cartão/ficha + "Mesclar" pede o nome (+WR-03/WR-04 opcionais) | UCR-04 | M | 15-02, 15-03 |
| C | 15-05 | Gestos gravam Atividade (mover, atribuir, lixeira, restaurar, estrela, leitura, nota, transferir, consentimento, sucessão) | UCR-03 | M | — |
| C | 15-06 | Base das telas: `dados/crm/conversas.ts`, `mensagens.ts`, `POST /crm/nomes`, `GET /contatos?comIdentificador=`, filtros `proprietarioId`/`naoLidas`, endpoint de agregados do Início/Notificações | UCR-05..08 | M | depois do 15-05 |
| D | 15-07 | 3.4.1 Caixa: lista e gestos | UCR-05 | M | 15-08, 15-09, 15-10 |
| D | 15-08 | 3.4.3 configurações, Filas, Canais, popup D-12 | UCR-05 | M | 15-07, 15-09, 15-10 |
| D | 15-09 | 3.4.4 fichas sem legado (apaga ~3.9 mil linhas) | UCR-06 | M | 15-07, 15-08, 15-10 |
| D | 15-10 | 3.4.6 Busca, Lixeira, Notificações (+ badge de `app-shell`/`barra-global`) | UCR-07 | M | 15-07..09 |
| D | 15-11 | 3.4.2 fio e envio (`conversation-thread.tsx` 1442 linhas + `tarefa-completa.tsx`) | UCR-05 | **L** | depois de 15-04 e 15-07 |
| D | 15-12 | 3.4.5 Meus negócios, Reuniões, apagar `QuadroNegocios`/`iniciar-conversa`, nav D-14 | UCR-06 | **L** | depois de 15-05, 15-09 |
| D | 15-13 | 3.4.7 Início, Configurações, Painel, Espaço sem Funil padrão | UCR-07 | **L** | depois de 15-10 (`derive.ts`) |
| E | 15-14 | 3.4.8a domínio+api das Ferramentas: `LER_DO_CRM` com Canais e Contatos, **porta para criar Contato de Participante**, `contatosComWhatsApp` | UCR-08 | **L** | 15-15, 15-16 |
| E | 15-15 | 3.4.8b web das Ferramentas (14 arquivos) | UCR-08 | M | depois de 15-14 |
| E | 15-16 | 3.4.9 IA + 3.4.10 Contas a receber | UCR-08 | M+M (dividir se passar de 3 tarefas) | 15-14 |
| F | 15-17 | 3.5.1 script `migrar:crm-antigo` (puro no domínio + `executar()` na api), `--seco`, só guardar, relatório | UCR-09 | **L** | — |
| F | 15-18 | 3.5.3 gerar o fixture do demo **a partir do seed antigo**, depois tirar o CRM do seed; reescrever os ~25 testes; `bootstrap:crm-demo` | UCR-11 | **L** | depois de 15-17 |
| F | 15-19 | 3.5.2 ensaio local sobre `~/n1-ensaio` (checkpoint humano) | UCR-10 | S | depois de 15-17/18 |
| G | 15-20 | 3.5.4 remoção em domínio → api → web, guardas finais, `CONTEXT.md` | UCR-12 | **L** | último código |
| G | 15-21 | Runbook do corte (D-15-03), `checkpoint:human-verify`, linhas de andamento para o dono | UCR-10 | S | último |

Observações de corte:
- **15-14 (Ferramentas) é o mais subestimado.** `operations/ferramentas/*` (3169 linhas com `derive-ferramentas.ts`) tem ~60 acessos a `state.channels`/`state.contacts` e `resolverOuCriarContato` (`participacoes.ts:36-85`) **cria** Contato com `creationMode: "automaticoPorGrupo"` dentro da operação pura. O CONTEXT/3.4.8 só fala em "operações recebem `canais` e `contatos` já conferidos". Criar Contato precisa do padrão da Tarefa conversacional: `lerDoCrm` acha por Identificador (`whatsapp`) e **gera o id** dos que faltam, a operação usa esse id, `aoConfirmar` insere em `plataforma.contatos`. Os modos de criação `automaticoPorGrupo` não existem na 007; a 3.5.1 já os mapeia para `automatico_automacao` (`contatos_modo_criacao_ck`: `'manual', 'importacao', 'automatico_mensagem', 'automatico_automacao'`). Dividir em 3 tarefas: leitores+permissões, criação de Contato, ops de Grupo/Comunidade/Flow.
- **15-06 antecipa a base** porque 3.4.1, 3.4.2, 3.4.6, 3.4.7 e 3.4.9 usam os mesmos hooks (`useConversas`, `useMensagens`, nomes em lote) e os mesmos filtros de api; sem ele, quatro planos paralelos reinventam a mesma rota.
- **O script (15-17) pode ser *escrito* cedo** (só toca arquivos novos em `apps/api/src/migracao-crm/` e funções puras novas no domínio), mas só *fecha* depois das telas, como manda o CONTEXT. Se o planejador quiser ganhar tempo, a Onda F pode começar quando 15-13 terminar.
- **Mantenha a web fora de produção até o corte:** todos os planos de tela integram no ramo da fase; o push para `main` do `n1-tecnologia/crm` é só o passo final do 15-21.

## D-15-07: a dívida da Fase 14 (pergunta 3)

Todas as linhas abaixo foram abertas neste ambiente.

| Item | Código atual | Correção mínima | Teste que prova |
|---|---|---|---|
| **WR-01** | `servicos/crm/conversas.ts:426` `contatos.obter(membro.workspaceId, entrada.contatoId)` sem trava; `negocios.ts:146-152` `conferirContato` (chamado em `:285` criar e `:453` editar); `empresas.ts:215-222` `carregarContato` (chamado em `:480,:647,:709,:755`). O repositório já aceita `obter(ws, id, { travar: true })` (`repositorios/crm/contatos.ts:77,224` gera `... for update`). | `abrirConversaNoCliente`: `{ travar: true }` no `obter`. `conferirContato`/`carregarContato`: parâmetro `travar` (padrão `true`) repassado ao `obter`; todas as chamadas já estão em `comTransacao`. **Cuidado de ordem:** em `negocios.editar` o Negócio já está travado (`escrita`, `:360`) quando `conferirContato` trava o Contato — a mesclagem trava Contato → Negócio, então a ordem inversa pode dar `40P01`. Por isso acrescentar `40P01`→409 transitório em `comTransacao` (único ponto, `servicos/crm/transacao.ts:23` hoje só traduz `23505/23503/23514`) em vez de reordenar o `escrita` de Negócio. | Docker, dois clientes: A trava o absorvido e muda `estado='mesclado'` sem confirmar; B chama `POST /conversas`/`POST /negocios`/vínculo Contato-Empresa para esse Contato; commit de A → B volta 409 `CONTATO_MESCLADO` e **nenhuma linha** nasce. Um caso para cada uma das três portas. |
| **WR-02** | `servicos/crm/canais.ts:163` `repositorio.obter(..., { travar: true })` (Canal) **antes** de `avancarRevisaoDoEspaco` (`:178,:223,:248,:265`, `update` no Espaço). O gesto misto trava o Espaço primeiro (`persistencia/CONTEXT.md` "A ordem das travas"). | Em `escrita()` (`canais.ts`, antes da linha 163) acrescentar `await cliente.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [membro.workspaceId])`. `criar` (`:197`) insere Canal novo e depois atualiza o Espaço: não disputa linha existente, fica como está. | Docker: cliente A abre `begin; select ... from plataforma.workspaces ... for update` (simula o gesto); `mudarConexao` em B fica bloqueado; um terceiro cliente consegue `select ... from plataforma.canais where id = $c for update nowait` **enquanto B espera** (prova que B não pegou o Canal antes do Espaço). Depois A commita e B conclui sem `40P01`. |
| **WR-05** | `repositorios/crm/tarefas-conversacionais.ts:97-105`: o `left join` do Negócio já tem `n.estado <> 'na_lixeira'`; o Contato (`ef`) e a Conversa (`cv`) não. `vinculosDoCrmDaTarefa` (`derive-conversacional.ts`) usa o primeiro Vínculo de cada tipo. | Acrescentar `and ef.estado <> 'na_lixeira'` no `join` de `ef` e `and cv.estado = 'ativo'` no de `cv` (quem estiver `arquivado` continua aparecendo: RN-TAR-15 suspende só a lixeira). **Sobre "só olha o primeiro Vínculo":** o review dá a saída de registrar a decisão em `14-PROVAS.md`; recomendado: manter o primeiro Vínculo e registrar a decisão (mudar para lista de candidatos muda `VinculoParaResumo` e a derivação). Fazer junto com 15-04 se o planejador preferir um SQL só. | `servicos/crm/tarefas-conversacionais.test.ts` (Docker): Contato na lixeira → `contato: null`; Conversa na lixeira → `canal: null`, `ultimaMensagem: null`; arquivado ainda aparece. |
| **WR-06** | `servicos/crm/contatos.ts:80-99` (`FRASES_DE_CONTATOS` sem `contatos_mesclado_em_fk`) e `:498-533` (`excluirPermanentemente`): `delete` falha com `23503` e vira 500. A `011` define `contatos_mesclado_em_fk foreign key (workspace_id, mesclado_em_id) references plataforma.contatos (workspace_id, id)` (NO ACTION). | Pré-checagem antes do `delete`: `select count(*) from plataforma.contatos where workspace_id = $1 and mesclado_em_id = $2`; se > 0, 409 `CONTATO_COM_MESCLADOS` ("Este Contato absorveu outros Contatos e não pode ser excluído de vez."). Mais a rede: `contatos_mesclado_em_fk: { codigo: "CONTATO_COM_MESCLADOS", error: "Outros Contatos foram mesclados neste e ele não pode ser excluído de vez." }` em `FRASES_DE_CONTATOS`. | `servicos/crm/contatos.test.ts` e `rotas/crm/contatos.test.ts` (Docker): mesclar A em B, enviar B à lixeira, `DELETE /contatos/B/permanente` → 409 e a linha continua. |
| **`describeComBanco`** | `rotas/operacoes.test.ts:263-267`: `carregarEnv(); const temBanco = Boolean(process.env.DATABASE_URL); const d = temBanco ? describe : describe.skip;`. `carregarEnv()` carrega o `.env` (produção) quando `DATABASE_URL` não vem do shell. O arquivo **já importa** `describeComBanco` de `../testes/banco-crm` (`:42`). | Trocar `d` por `describeComBanco` (que só roda com host `localhost`/`127.0.0.1`, `testes/banco-crm.ts:40`) e tirar `carregarEnv()` e `temBanco` do arquivo. | Rodar `src/rotas/operacoes.test.ts` **sem** `DATABASE_URL` e ver o bloco "pulado" (nenhuma conexão); com `DATABASE_URL` local, ver o bloco rodar. **Há ~28 outros `*.test.ts` com `carregarEnv()`** (lista: `grep -rln "carregarEnv()" apps/api/src --include='*.test.ts'`): o baseline "npm test 13–17 min" é isso. Fora de escopo, mas **todo teste novo desta fase (script, `012`, sucessão, resumo) deve usar `describeComBanco`**. |
| **`instantiateListTemplate`** | `operations/planning.ts:364` `createList(state, actingMemberId, { ...input, templateId })` (sem o 5º parâmetro `canais`); `esquemas/planejamento.ts:42` `instantiateListTemplate: z.tuple([ID, INSTANTIATE_LIST_TEMPLATE_INPUT])`; `LER_DO_CRM` (`rotas/operacoes.ts:297-302`) só tem `definirCanaisDaLista: { posicao: 2, ... }` (`:300`) e `createList: { posicao: 1, ... }`; `AO_CONFIRMAR` está em `:273`. `CANAIS_DO_NAVEGADOR` é exportado de `rotas/esquemas/tarefas-conversacionais.ts:25` e `estrutura.ts:11` já o importa. | (1) `instantiateListTemplate(state, actingMemberId, templateId, input, canais?)` repassa `canais` a `createList`; (2) esquema: terceiro elemento `opcional(CANAIS_DO_NAVEGADOR)` como em `estrutura.ts:106`; (3) `LER_DO_CRM.instantiateListTemplate = { posicao: 2, ler: ... Canais }`. | `rotas/operacoes-canais-da-lista.test.ts` (existe): caso novo — Template com `listConfig` + `canaisDeAtendimento` com Canal só em `plataforma.canais` passa; o `canais` do navegador é descartado; id inexistente é recusado. Teste de domínio com `state.channels = []`. |

## D-15-08: Conversas ao Sucessor — o contrato diz o contrário (pergunta 4)

**A regra está na ontologia e diz que a Conversa é liberada.** Texto verbatim:

> `ontologia/01-espaco-de-trabalho/espaco-de-trabalho.md:331` — "**RN-ET-09.** Remover um Membro é uma operação de **sucessão** (DO-ET-04 / B28): (a) todo registro de que ele é Proprietário passa ao Sucessor … (b) toda Tarefa (inclusive Subtarefa) e todo Item de Checklist de que é Responsável e toda Conversa de que é Atribuído são liberados (ficam sem esse Ator; o que decorre disso é definido nos documentos de Tarefa, de Checklist e de Caixa de Entrada — RN-TAR-06, RN-CHK-06) … Cada transferência gera Registro de Atividade próprio."
>
> `ontologia/03-crm/caixa-de-entrada-e-mensageria.md:612` — "**RN-CXE-24.** Na remoção de um Membro (B28), toda Conversa de que é Atribuído é liberada no mesmo ato e redistribuída pela regra da sua Fila (sem Fila: fica sem Atribuído, com evento) … Sair de uma Equipe ou dos elegíveis **não** libera Conversas já atribuídas."
>
> `…caixa-de-entrada-e-mensageria.md:449` — "Consequências: não há sucessão de Canais, Filas ou Conversas na remoção de Membro (B28); o que ocorre é a liberação do Atribuído (RN-CXE-24) …"; `:812` — "Não há Sucessor de Conversas (não há propriedade)."

Portanto **a mudança vai ao contrato**, e antes do código. Lugares (todos [VERIFIED: leitura]):

| Onde | O que muda |
|---|---|
| `ontologia/01-espaco-de-trabalho/espaco-de-trabalho.md:310` (tabela de estados do Membro) e `:331` (RN-ET-09 b) | tirar "Atribuído liberado"/"toda Conversa de que é Atribuído" do (b); no (a) acrescentar "toda Conversa de que é Atribuído (Membro) passa ao Sucessor como Atribuído" |
| `…/caixa-de-entrada-e-mensageria.md:85` (Fila×Equipe), `:449`, `:570` (Liberação), `:612` (RN-CXE-24), `:755` (tabela de eventos consumidos), `:812` (cenário com 40 Conversas) | reescrever: o Atribuído passa ao Sucessor (um Membro `ativo`, sem base Convidado); "Conversa nunca tem Proprietário" (DO-CXE-02) continua verdadeiro — é troca de Atribuído, não propriedade; um Registro de Atividade por Conversa; `suspenso` mantém (RN-ET-08); o Agente como Atribuído não muda; "redistribuída pela Fila" sai deste caso |
| `ontologia/03-crm/crm-visao-geral.md:335` | a linha "Membro removido": trocar "Conversas atribuídas são liberadas e redistribuídas" |
| `ontologia/DECISOES-E-PENDENCIAS.md:213` (`### B28. Remoção de Membro é sucessão`) | a constituição precisa de nova decisão que emende B28 (registrar data e o dono) |
| `ontologia/ontologia.html` | tem um bloco `<script id="data" type="application/json">` com os documentos; parece **gerado** — conferir se há gerador antes de editar à mão |

Código que muda (api, domínio, web):
- `apps/api/src/repositorios/crm/sucessao.ts`: cabeçalho (diz "RN-ET-09 (b): … fica LIBERADA"), `SucessaoNoCrm.conversasLiberadas`, o `update plataforma.conversas set atribuido_tipo = null, atribuido_id = null` vira `set atribuido_id = $3` mantendo `atribuido_tipo = 'membro'` (a `conversas_atribuido_ck` exige os dois juntos: `(atribuido_tipo is null) = (atribuido_id is null)`). Renomear o campo para `conversasPassadas`.
- `apps/api/src/servicos/crm/sucessao.ts`, `rotas/crm/sucessao.ts` (forma da resposta de `GET /membros/:id/sucessao-no-crm`), `apps/web/src/dados/crm/sucessao.ts`.
- `apps/api/src/rotas/operacoes.ts` `AO_CONFIRMAR.removeMember` (o comentário "e LIBERA as Conversas"; o comportamento vem do repositório). Aproveitar para fechar **IN-01** (checar que o Sucessor não é Convidado no replay).
- `apps/web/src/app/(shell)/configuracoes/membros/page.tsx` (`:54`, `:101`, `:278` "o que ele apenas atendia é liberado", `:296`, `:329` `linhasDoCrm([["Conversas", noCrm?.conversasLiberadas]])`) e o teste `features/shell/membros-sucessao-no-crm.test.tsx`.
- `packages/dominio/src/operations/members.ts:73-77` (`previewSuccession` lista Conversas em `releases`) e `:310-319` (`removeMember` grava "Conversa liberada" no `state.conversations`): são do modelo antigo e morrem em 3.5.4. Para as Conversas **de Grupo** (que ficam no antigo) o planejador decide: manter a liberação (simples, não há Grupo em produção) e registrar a exceção.
- Testes api: `servicos/crm/sucessao.test.ts`, `rotas/crm/sucessao.test.ts`, bloco com banco de `rotas/operacoes.test.ts` (UNI-11 da F14). **Sequência:** o Registro de Atividade por Conversa passada (RN-ET-09 "Cada transferência gera Registro de Atividade") depende do `012` — por isso a sucessão aparece na lista de gestos do 15-05.

## D-15-09: Atividade do CRM novo e a migração 012 (pergunta 5)

### Como o Registro de Atividade funciona hoje
- Tipo (domínio): `ActivityRecord` [VERIFIED: `packages/dominio/src/types/primitives.ts:267-286`]: `id`, `workspaceId`, `actor: ActorRef`, `delegate?`, `action`, `objectType`, `objectId`, `objectName` (comentário "INV-ET-12 — survives the elimination of the object."), `at`, `result: "ok" | "denied" | "failed"`, `before?`, `after?`, `detail?`.
- Escrita: `recordActivity(state, input)` (`operations/activity.ts`) faz `state.activity.unshift(record)` → coleção `activity` em `registros`. Toda operação antiga o chamava; as ações em português que vão para o vocabulário novo incluem "Conversa enviada à lixeira", "Conversa restaurada", "Conversa movida para outro Contato", "Conversa reaberta", "Conversa resolvida", "Identificador transferido", "Nota registrada no Contato", "Contato enviado à lixeira", "Contato restaurado", "Negócio marcado como ganho/perdido", "Negócio reaberto", "Empresa criada" etc. [VERIFIED: `grep -ho 'action: "…"'` em `operations/{conversations,contacts,deals}.ts`].
- A mesclagem nova já grava: `mesclarContatoNoEspaco` (`operations/vinculos-da-mesclagem.ts`) chama `recordActivity` duas vezes ("Contato sobrevivente da mesclagem", "Contato mesclado", `objectType: "contact"`), porque o gesto misto já escreve em `registros`. Os outros gestos do CRM novo não passam por `registros` (REST direto em `comTransacao`), por isso não gravam.
- Leitores de `state.activity` na web: `features/tarefa/timeline.tsx:158`, `crm/reunioes/[reuniao]/page.tsx:157` ("Tudo que já aconteceu com este lead": Negócio + Contato + Tarefa), `configuracoes/auditoria/page.tsx:69-185` (tela inteira, filtro por `objectType`), `configuracoes/membros/[membro]/page.tsx:92`, os legados `deal-screen.tsx:215` e `empresa-popup.tsx:99`, e pop-ups de Ferramentas/IA. **As fichas novas (`ficha-de-contato/empresa/negocio.tsx`) não têm seção de Atividade** (grep vazio). Quem precisa da fusão: Reunião (3.4.5), Auditoria e a página do Membro; as fichas novas podem ganhar a seção depois.

### Forma recomendada da tabela (candidata 1)
Espelha `ActivityRecord` 1:1 para a web reaproveitar os componentes de linha do tempo sem mudar o tipo; **sem FK** para o objeto (a Atividade sobrevive à eliminação, INV-ET-12); só inserção (o repositório só expõe `inserir` e `listar`).

```sql
-- Proposta (assumed): 012-atividade-do-crm.sql
create table if not exists plataforma.crm_atividades (
  id            text        not null default gen_random_uuid()::text,
  workspace_id  text        not null,
  ator_tipo     text        not null,
  ator_id       text        not null,
  delegante_tipo text,
  delegante_id  text,
  acao          text        not null,
  objeto_tipo   text        not null,   -- mesmas cadeias de ActivityRecord.objectType: 'contact','company','deal','conversation','funnel','channel'
  objeto_id     text        not null,
  objeto_nome   text        not null,
  em            timestamptz not null default now(),
  resultado     text        not null default 'ok',
  antes         text,
  depois        text,
  detalhe       text,
  primary key (workspace_id, id),
  constraint crm_atividades_ator_ck check (ator_tipo in ('member','agent','automation','integration','system')),
  constraint crm_atividades_delegante_ck check ((delegante_tipo is null) = (delegante_id is null)),
  constraint crm_atividades_resultado_ck check (resultado in ('ok','denied','failed')),
  constraint crm_atividades_acao_ck check (length(btrim(acao)) > 0)
);
create index if not exists crm_atividades_objeto_idx on plataforma.crm_atividades (workspace_id, objeto_tipo, objeto_id, em desc);
create index if not exists crm_atividades_em_idx     on plataforma.crm_atividades (workspace_id, em desc);
create index if not exists crm_atividades_ator_idx   on plataforma.crm_atividades (workspace_id, ator_id, em desc);
-- + o bloco "desliga RLS" copiado da 009/011 (ver abaixo)
```

O conjunto de `ator_tipo` é exatamente `ActorKind` [VERIFIED: `packages/dominio/src/types/primitives.ts:36`: `export type ActorKind = "member" | "agent" | "automation" | "integration" | "system";`], o mesmo de `mensagens_ator_ck` da 008 (`check (ator_tipo in ('member', 'agent', 'automation', 'integration', 'system'))`). Os nomes das colunas e o `objeto_tipo` acima são **proposta** (`[ASSUMED]`), não valores existentes.

**Candidata 2 (não recomendada):** a mesma tabela com `contato_id` denormalizado ("Contato relacionado") para a linha do tempo da ficha incluir gestos da Conversa e do Negócio dele por um índice só. Custa um lookup extra por gesto e acopla a tabela a uma tela; a fusão por `objeto_id` já cobre o que a Reunião e a Auditoria pedem.

**Alternativa descartada pelo CONTEXT:** passar todos os gestos por `executarGestoMisto` e gravar em `registros.activity`. Funcionaria sem `012`, mas leva cada estrela/leitura à hidratação do Espaço inteiro (sai do caminho de duas idas da Fase 13) — é o motivo de D-15-09 pedir tabela.

### Padrões copiados das migrações anteriores
- Sem `grant`: a 009 concede DML ao `n1_api` por `alter default privileges`; `npm run banco:conceder` é a rede. [VERIFIED: cabeçalho da `011`: "Sem `grant`: a 009 concede DML ao `n1_api` por `alter default privileges`, e `npm run banco:conceder` e a rede."]
- Terminar com o bloco que desliga RLS em toda tabela de `plataforma` que tenha `relrowsecurity` (idêntico ao final da `011`, que o copia da `009`; F7 da 009).
- Idempotente (`create … if not exists`, `drop constraint if exists`) e transacional (`migrar()` abre `begin`/`commit` por arquivo).
- `apps/api/src/testes/banco-crm.ts` `limparEspaco()`: acrescentar `"crm_atividades"` à lista de tabelas (sem FK, entra na lista como `crm_de_para`).
- `apps/api/src/persistencia/migracao-012.test.ts` no molde de `migracao-011.test.ts`; `npm run migrar -- --seco` (`migrar.cli.ts`) mostra `pendente  012-…`.

### Como a linha do tempo junta as duas fontes
1. Rota nova `GET /atividades?objetoTipo=&objetoId=&limite=&ate=` em `rotas/crm/atividades.ts`: exige `ler` no recurso (`podeNoCrm`), escopo por `workspace_id` da sessão, e devolve **`ActivityRecord`** (mesma forma que a web já consome).
2. Hook `useAtividades({ tipo, id })` em `apps/web/src/dados/crm/atividades.ts`: SWR; concatena `state.activity.filter((a) => a.objectId === id)` (já hidratado) com a resposta, ordena por `at` decrescente. Ids não colidem (`act_…` contra UUID).
3. **Auditoria** (`configuracoes/auditoria/page.tsx`) lista *todo* o `state.activity`; para não perder os gestos do CRM novo ela precisa da fusão paginada (`GET /atividades` sem objeto, cursor por tempo). Se o planejador não incluir, a trilha de auditoria **regride** quando as operações antigas (que gravavam "Negócio marcado como ganho" etc.) saírem — ver Open Question 1.
4. Escrita: `repositorios/crm/atividades.ts` (`registrarAtividade(cliente, workspaceId, entrada)`), chamada **no mesmo `cliente`** do gesto, dentro de `comTransacao` ou de `gravarNoCrm`. Gesto de estrela/leitura grava só quando o valor muda (toggle; `lida_ate` avança), para não inserir uma linha a cada abertura de Conversa (`PUT /conversas/:id/marcacao` é chamado ao abrir).

## O script de migração (3.5.1 / 3.5.2) — desenho (pergunta 6)

### O que o dado de produção realmente pede
[VERIFIED: `14-ENSAIO.md`, tabela `hidratar` por Espaço] `ws_n1`: `funnels = 1`, todas as outras oito coleções `0`. Os outros 17 Espaços: 16 com `39 contacts / 12 companies / 30 contactCompanyLinks / 1 companyCompanyLinks / 1 distinctFromLinks / 4 funnels / 19 deals / 5 channels / 21–23 conversations` e 1 (`ws_teste_importar_sol_…_ref`) só com 1 Funil. Total 2128 linhas, 18 Espaços.

**O Funil do `ws_n1` quase certamente é o do `bootstrap:gestao`.** [VERIFIED: `packages/dominio/src/bootstrap-gestao.ts:65` (`buildGestaoBootstrap`, padrão `"ws_n1"`), `:171-185`]:
```
  const funilPadrao: Funnel = {
    id: "fnl_padrao",
    …
    name: "Padrão",
    …
      { id: "stg_padrao_novo", name: "Novo", order: 0, defaultProbability: 0, requirements: [], allowedTransitionStageIds: [] },
```
com `defaultFunnelId: "fnl_padrao"` (`:104`). O cabeçalho do arquivo diz que o bootstrap "NÃO chama a função de seed do protótipo inteiro" e cria o Espaço "só com a configuração do Financeiro". O Espaço de teste `ws_teste_importar_sol_*_ref` tem a mesma forma (1 Funil, zero do resto). O `--seco` de produção confirma (D-15-04 continua do dono). **Isso também desmente o "provavelmente já as tem" de D-15-14:** o bootstrap não cria a Pasta "Meus negócios" (`grep` de "Meus negócios"/`folders` em `bootstrap-gestao.ts` é vazio; ela nasce em `seed-comercial.ts:47`, usado só por `buildSeed`). Tratar como "provável ausente" e fazer o `--seco` imprimir o resultado de `select … from plataforma.registros where workspace_id='ws_n1' and colecao in ('folders','lists') and dados->>'name' ilike '%Meus neg%'`.

**Consequência de custo:** em produção o script faz muito pouco (talvez nada) com Contatos/Negócios/Conversas. O mapeador completo (Contato → … → Mensagem) serve ao ensaio, ao teste de integração exigido pela 3.5.1 e ao fixture do `bootstrap:crm-demo`. Recomendação: construí-lo (o "Pronto quando" da 3.5.1 o exige), mas separar no plano o **caminho crítico de produção** (copiar para `registros_crm_antigo`, conferir contagens, remover de `registros`, tratar o Funil e a Pasta) do **mapeador de entidades**, para o primeiro não depender do segundo. O planejador decide se o dono quer cortar o mapeador (Open Question 3).

### Forma do comando e dos modos
`npm run migrar:crm-antigo -w @n1/api -- --espaco <id> [--seco | --guardar | --verificar]`, entrada em `apps/api/package.json` (hoje não existe: `grep migrar:crm-antigo` vazio).
- **`--seco`** (relatório; nada escrito): abre `begin read only` (prova que não escreve — o ensaio da F14 usou `default_transaction_read_only = on`), hidrata, e imprime por coleção a contagem contra a linha-base do `14-ENSAIO.md`, o Funil e as Etapas (nomes são configuração, não dado pessoal), a lista de **não migrados** por categoria (só ids e contagens), os escopos/permissões que apontam para o Funil (Automações, Agentes, Painéis, `grants`), o resultado da checagem da Pasta/Listas "Meus negócios" e das Tarefas espelho (D-15-14), e o que `migrar` faria. Nunca imprime nome, telefone, e-mail ou texto de Mensagem.
- **`--guardar`** ("só guardar", D-15-01): copia as linhas das nove coleções (+ as Listas/Pasta "Meus negócios" vazias que forem removidas, F14-D-03) para `registros_crm_antigo`, confere `count(origem) = count(cópia)` e só então apaga de `registros`. Não cria linha no CRM novo. É o modo dos 17 Espaços de teste (e do `ws_n1` se o dono decidir guardar o Funil).
- **(sem flag) migrar**: faz o `--guardar` **e** insere nas tabelas novas.
- **`--verificar`**: pós-condição standalone (`select colecao, count(*) from plataforma.registros where colecao in (…nove…) group by 1` vazio, nenhuma referência pendurada, `registros_crm_antigo` com a mesma contagem do `--seco`). Pode ser rodado depois do corte e em qualquer ensaio.
- `--espaco` é **obrigatório** e validado contra `^ws_[a-z0-9_]+$` e contra a existência em `plataforma.workspaces`. Sem modo "todos os Espaços" na primeira versão; os 17 de teste rodam em um laço de comandos explícitos (ou `--espacos a,b,c` com lista nominal).

### Transação e travas: uma `executar()` travada por Espaço
Usar `executar(workspaceId, operacao, { lerDoCrm, aoConfirmar })` no regime padrão `travado` (não passar `regime`; `regime-dos-chamadores.test.ts` só admite `otimista` nas quatro importações longas). Ganha de graça: trava da linha do Espaço no começo, `revisao + 1` (os navegadores abertos se re-hidratam em ≤5 s), `begin` com prazos, `rollback` em qualquer exceção, hidratação consistente. [VERIFIED: `persistencia/unidade-de-trabalho.ts:184-202,341-349`, `persistencia/CONTEXT.md` "O gesto misto"]
1. `lerDoCrm(cliente, state)`: valida (o Espaço existe, não há Funil padrão conflitante em `plataforma.funis`, nomes únicos), faz a cópia em SQL **byte a byte** — `insert into plataforma.registros_crm_antigo (workspace_id, colecao, id, dados, ordem) select workspace_id, colecao, id, dados, ordem from plataforma.registros where workspace_id = $1 and colecao = any($2::text[]) on conflict do nothing` — e confere a contagem; devolve o plano pronto (linhas novas + relatório).
2. `operacao(state, plano)` (pura, no domínio): esvazia as nove coleções de `state` (`gravar()` gera os `delete`), remove Pasta/Listas espelho **vazias** (D-15-14), reescreve referências se os ids mudarem.
3. `aoConfirmar(cliente, plano)`: `insert`s nas tabelas novas (em lote com `unnest`/`jsonb_to_recordset` com **lista de colunas explícita**) e em `crm_de_para`, na ordem das FKs (abaixo).
`statement_timeout` = 80% de `DATABASE_QUERY_TIMEOUT_MS` (24 s por padrão): suficiente para ~350 linhas por Espaço; não rodar o laço dos 17 numa única `executar`.

### Decisão de ids (recomendada): preservar o id antigo como id novo
[VERIFIED] As colunas são `id text not null default gen_random_uuid()::text` (007/008) e as rotas validam id só como `PARAMS_ID = z.object({ id: z.string().min(1).max(64) })` (`rotas/crm/comum.ts:17`); nenhum esquema do CRM usa `z.uuid()`. Logo `cnt_000abc`, `chn_wpp`, `fnl_padrao`, `cnv_sdr_1` são ids válidos nas tabelas novas.
- **Efeito:** o passo 9 da 3.5.1 (reescrever `links`, `tasks[].provenance.sourceId`, `lists[].canaisDeAtendimento`, `grupos[].canalId`, escopos de Funil, `grants`, e mais os que o CONTEXT não lista — abaixo) **desaparece**: nenhuma referência muda. As Tarefas conversacionais do seed (`seed-pos-venda.ts`) continuam apontando para ids que o `bootstrap:crm-demo` cria. `crm_de_para` fica como livro-razão com `id_antigo = id_novo`.
- **Exceções** (a chave não é única no Espaço): **Etapa** (id de Estágio é único só dentro do Funil: "identity is stable inside the funnel", B58; PK nova é `(workspace_id, id)`) → gerar UUID e gravar `crm_de_para`; vínculo Contato-Empresa e Identificador de Contato/Empresa (ids `cid_…`, mesmo risco) → gerar.
- **Se o planejador preferir reescrever** (3.5.1 como escrito), a reescrita **não deve enumerar campos**: usar uma passada genérica sobre o JSON restante de `registros` trocando toda string igual a um id antigo, e um teste de pós-condição que varre o JSON e não acha nenhum id antigo. Campos que o CONTEXT não lista e que apontam para CRM antigo [VERIFIED nos tipos]: `activity[].objectId` (histórico), `chatSessions[].anchor.id` (`ChatAnchor`, `types/ai.ts:~350`), `ProvenanceKind` `conversation|deal|contact|company`, escopos `funnel`/`channel`/`queue`/`inbox` em Automações/Agentes/Painéis (`types/ai.ts:~491`, `types/panels.ts:131`), `Grupo.participacoes[].contactId` e Pedidos de Entrada (`types/ferramentas.ts:94,123`), `Comunidade.canalId`, `Flow.canalId`, `LinkDeCaptacao`, `FieldDefinition.target`.
- Efeito colateral aceito: o bookmark `/crm/contatos/<id antigo>` passaria a abrir a ficha nova (em vez de "não encontrado" da 3.4.4). No `ws_n1` é irrelevante (nenhum Contato antigo).

### Mapeamento e o que não migra (relatório "não migrados")
Valores das constraints novas que o mapeador tem de respeitar [VERIFIED: 007/008/011 lidos]: `contatos_modo_criacao_ck` (`'manual', 'importacao', 'automatico_mensagem', 'automatico_automacao'`); `contato_identificadores_tipo_ck` (`'telefone', 'email', 'whatsapp', 'instagram'`); `canais_tipo_ck` (`'whatsapp', 'instagram', 'email'`); `conversas_situacao_ck` (`'aberta', 'pendente', 'resolvida'`); `mensagens_direcao_ck` (`'recebida', 'enviada', 'interna'`); `contato_consentimentos_canal_ck` (`'whatsapp', 'instagram', 'email', 'todos'`).

| Origem (antigo) | Destino | Não migra → relatório |
|---|---|---|
| `Contact` | `contatos` (+ `contato_identificadores`, `contato_consentimentos`, `contato_notas`) | `temperatureId` (D-15-06), `tagIds` (D-04), `preMergeState`, `provenance`, `photoFileId` (a coluna é `foto_url`), Identificadores `perfilDeLinkedIn`/`perfilDeTikTok`/`identificadorDeChatDoSite`, consentimento com `channelType` `linkedin`/`chatDoSite` |
| `Company` | `empresas` (+ `empresa_identificadores`) | `tagIds`, `attachments`, `comments` (**não há tabela de nota de Empresa**), `mergedIntoId`/`preMergeState` (a `empresas_estado_ck` não tem `mesclado`); `documentoFiscal` exige `pais` (`empresa_identificadores_pais_ck`) |
| `ContactCompanyLink` | `contato_empresa` (`role`→`cargo`, `principalForCompany`→`admin`) | `principalForContact` (sem coluna) |
| `CompanyCompanyLink`, `DistinctFromLink` | — | **sem tabela**: contar e listar ids |
| `Funnel`/`Stage` | `funis`, `etapas` | `StageRequirement`, `allowedTransitionStageIds` (D-04) |
| `Deal` | `negocios` | `readableId`, `tagIds`, `fieldValues` (`negocios` não tem `campos_adicionais`), `attachments`, `comments`, `stageHistory`, `contactLinks` além do principal; Negócio sem Empresa e sem Contato (viola `negocios_dono_ck`) |
| `Channel` | `canais` (provedor padrão do tipo via `PROVEDOR_PADRAO_DO_TIPO`, `conexao='desconectada'`) | `linkedin`/`chatDoSite`, `messageTemplates` |
| `Conversation` (sem `groupIdentifier`) | `conversas` (+ `conversa_marcacoes` de `starredBy`) | `drafts` (D-15-11), `tagIds`, `fieldValues`, Conversa sem `contactId`, as de Grupo (**ficam em `registros`**, D-05) |
| `Message` | `mensagens` em ordem de `createdAt` | `recebida` ganha `id_externo = 'migrado:<id>'` e `ator = ('integration', canal_id)` (convenção de `inserirRecebida`, `repositorios/crm/mensagens.ts:214`); `enviada` precisa de `status_entrega` (`mensagens_status_direcao_ck`) |

Invariantes do banco que o texto da 3.5.1 **não menciona** e que fazem o `commit` falhar:
1. **Toda Empresa precisa de ≥1 vínculo vigente com `admin`** (constraint trigger deferido `empresa_exige_admin`, checado no `commit`): Empresa antiga sem Contato, ou só com vínculos encerrados, não pode ser migrada → vai para o relatório; do contrário toda a transação do Espaço cai.
2. **Conversa na lixeira exige `na_lixeira_em`** (`conversas_na_lixeira_em_ck` da 011: `(estado = 'na_lixeira') = (na_lixeira_em is not null)`), além de `situacao='resolvida'` (`conversas_lixeira_ck`). A 3.5.1 foi escrita antes da 011.
3. **Contato `mesclado` exige `mesclado_em_id` e `mesclado_em` juntos, e o sobrevivente existe** (`contatos_mesclado_ck`, FK `contatos_mesclado_em_fk` não é deferrable): inserir sobreviventes antes dos absorvidos.
4. **Uma Conversa não resolvida por par Contato+Canal** (`conversas_nao_resolvida_uq`) e **nome e conta únicos entre Canais ativos** (`canais_nome_uq`, `canais_conta_uq`) e **Identificador único por Espaço** (`contato_identificadores_unico`): o seed tem colisões em potencial; o relatório precisa listar o que foi descartado por colisão.
5. **Funil padrão:** índice único `funis_padrao_uq` e `funis_nome_uq`. O primeiro Funil criado nasce padrão (`deveNascerPadrao`, `servicos/crm/funis.ts:247`) e a escrita pega `pg_advisory_xact_lock(hashtext('funil-padrao:<ws>'))` (`repositorios/crm/funis.ts:270`). O script tem de tomar o mesmo lock e **não** marcar `padrao` se o Espaço já tem um (o `ws_n1` já usa o CRM novo: tem 2 Contatos, `14-ENSAIO.md`).
6. **Ordem de inserção** (FKs): canais → contatos (sobreviventes primeiro) → identificadores → empresas (matriz antes de filial) → `contato_empresa` (junto da Empresa, por causa do trigger) → funis → etapas → negócios → conversas → mensagens (resposta antes da respondida) → notas/consentimentos/marcações.

### D-15-14: Pasta/Listas "Meus negócios"
- A Pasta é `fld_meus_negocios`, as Listas `lst_funil_<x>` (uma por Funil antigo), com Visualização `viw_<lista>_quadro`, Conjunto de Status e uma Tarefa por Negócio `tsk_<lista>_<dealId>` com `provenance.kind = 'deal'` [VERIFIED: `seed-comercial.ts:47,80-130`]. "Vazia" = Lista sem nenhuma Tarefa (nem arquivada/na lixeira). A checagem "Lista tem Tarefa espelho" lê `state.tasks.filter(t => t.listId === lista.id)`.
- Se **todas** as Listas da Pasta estão vazias: copiar Pasta, Listas e Visualizações para `registros_crm_antigo` e remover (também `space.shortcuts` não toca). Se **alguma** não está: não remove nenhuma e lista no `--seco`. O atalho "Caixa de entrada" do Espaço Comercial é do seed e não faz parte.
- `estruturas-fixas.ts` (`PASTAS_FIXAS`) e `structure.ts:774` ("A Pasta Meus negócios não recebe Pastas nem Listas") deixam de fazer sentido: sair em 3.5.4.
- Os 17 Espaços de teste (semente `buildSeed`) têm Tarefas espelho: a Pasta **fica** neles, e os Negócios que as Tarefas espelham são guardados: aceitável (são resíduo de teste) mas o relatório deve dizer. Não alterar Tarefas.

### Tipos locais: o script não pode importar o modelo que a 3.5.4 apaga
O mapeador lê JSON de `registros` e, pelo desenho acima, **precisa dos formatos antigos depois de a 3.5.4 apagar `Contact`, `Company`, `Deal` etc.** de `@n1/dominio`. Solução: `formatos-antigos.ts` no próprio pacote do script, com interfaces estruturais mínimas (só os campos lidos), e um **fixture JSON congelado** do CRM antigo do seed (`buildSeed()` antes da 3.5.3) para o teste de integração e para gerar o demo. Sem isso, a 3.5.4 quebra o script e o `--verificar` deixa de existir. Pasta sugerida: `apps/api/src/migracao-crm/` (e não `importacao/crm-antigo/` da 3.5.1: o `CONTEXT.md` de `importacao/` diz "Nenhuma rota HTTP, nenhuma regra de negócio, nenhum SQL"). O script e sua pasta saem do repositório num plano de limpeza posterior ao corte aceito (fora desta fase).

## Seed e blast radius dos testes (pergunta 7)

Contagens por `grep` neste ambiente (arquivos `*.test.ts(x)`):

| Camada | Testes que chamam `buildSeed`/seeds | Testes que tocam coleções antigas (`.contacts`, `.conversations`, `.deals`, `.funnels`, `.channels`, `.companies`) | Testes que usam ids de seed do CRM (`cnt_`, `cmp_`, `deal_`, `cnv_`, `chn_`, `fnl_`) | Testes que chamam operações antigas por nome |
|---|---|---|---|---|
| `packages/dominio` | 88 | 18 | 19 | 8 |
| `apps/api` | 71 | 8 | 12 | 13 |
| `apps/web` | 65 | 9 | 8 | 3 |

**Leitura:** 224 arquivos usam `buildSeed()`, mas só **35** tocam a coleção antiga e ~39 citam ids de seed do CRM. A maioria dos 224 só quer um Espaço com Tarefas e Membros e **não muda**. O trabalho real:
- **Somem com o módulo** (3.5.4): `contacts.test.ts`, `conversations.test.ts`, `deals.test.ts`, `canais.test.ts` (parte antiga), `capacidades-do-canal.test.ts` (move para `crm/`), `derive-conversacional-antigo.test.ts`, `canais-projetados.test.ts`, `id-sequence.test.ts` (parte), `vinculos-da-mesclagem.test.ts` (parte da `mergeContacts` antiga), `iniciar-conversa.test.ts`/`esquemas/iniciar-conversa.test.ts`.
- **Reescrever** (≈20–25): `derive-resumo.test.ts`, `derive-conversacional.test.ts`, `operations/{ferramentas,ia/agentes,importacao-contas-a-receber,operations,alterar-papel-do-membro,tarefa-conversacional-nas-tabelas}.test.ts`, `seed-produto.test.ts`, `bootstrap-gestao.test.ts` (Funil padrão), api `rotas/operacoes*.test.ts`, `seguranca/{matriz-de-papeis,dados-de-outro-membro}.test.ts`, `e2e/canais-fluxo.test.ts`, `bootstrap/gestao.test.ts`, web `conversation-thread`, `ficha-de-*`, `inbox-columns`, `tarefa-completa-resumo`, `membros-sucessao-no-crm`.
- **Estratégia mais barata e segura:** (1) congelar o CRM antigo do seed em JSON (fixture do script); (2) **tirar do `buildSeed()` só a *criação* do CRM antigo** (não os helpers de tempo); (3) Tarefas conversacionais do seed (`seed-pos-venda.ts`) passam a apontar para os ids preservados que o demo cria (decisão de ids acima) **ou** são removidas do seed; (4) testes que precisam de CRM criam o que usam com helpers como `semearCanal` (`testes/banco-crm.ts`) / fakes dos hooks na web. Os testes da web já usam clientes de api falsos (`dados/crm/*.test.ts`), então custam pouco.
- Seeds ainda ligados ao Funil antigo que precisam de decisão: `seed-comercial.ts` (`applyEspelhoComercial` itera `state.funnels`: sai com a Pasta), `bootstrap-gestao.ts:171-185` e `apps/api/src/bootstrap/conferir-contas-a-receber.ts:302` (`defaultFunnelId`).

### `bootstrap:crm-demo` (formato)
Recomendado: **fixture JSON + carregador TypeScript com colunas explícitas**, e não `.sql` de dados.
- Motivo (verificado): as tabelas têm PK e FKs **compostas com `workspace_id`** (007/008/011), então um `.sql` dump (`pg_dump --data-only`) embute o `workspace_id` do Espaço de origem e não é reaplicável a outro sem reescrever o texto (risco de injeção por substituição de string e dívida de manutenção). `jsonb_populate_recordset(null::tabela, …)` **não** serve: colunas ausentes no JSON viram `NULL` (não o `default`) e quebram `NOT NULL … default` de qualquer migração futura.
- Desenho: o fixture é gerado **uma vez** pelo próprio script rodado sobre o `buildSeed()` ainda com CRM antigo (a prova de fidelidade do mapeador), commitado em `apps/api/src/bootstrap/crm-demo.json`; `crm-demo.cli.ts` valida `--espaco`, recusa Espaço que já tem Contato e **recusa host remoto** sem `--permitir-remoto` (nunca `ws_n1` em produção), e insere com parâmetros `$n` e nomes de coluna vindos das chaves do fixture (constantes do repositório). Um teste `crm-demo.test.ts` carrega o fixture num Postgres migrado e confere que todo `links`/`provenance` do seed aponta para um id que existe (isso é o que "não envelhecer a cada migração" exige).

## O resumo da Tarefa conversacional (pergunta 8)

Forma atual [VERIFIED: `packages/dominio/src/crm/resumo-da-tarefa.ts`, `apps/api/src/repositorios/crm/tarefas-conversacionais.ts`]: `POST /tarefas-conversacionais/resumo`, até `RESUMO_MAXIMO = 200` Vínculos por chamada (`VinculoParaResumo = { taskId, contatoId?, conversaId?, negocioId? }`); resposta por Vínculo: `{ taskId, contato: {id,nome}|null, canal: Pick<Canal,"id"|"nome"|"tipo"|"provedor"|"conexao">|null, ultimaMensagem: {trecho,direcao,criadoEm}|null, negocio: {id,titulo,etapa}|null }`. Uma consulta única com `unnest … with ordinality`, `left join` em `contatos` (mesclado → sobrevivente), `conversas`, `canais`, `negocios`, `etapas` e um `left join lateral` para a última Mensagem.

**O que acrescentar (D-15-05):**
- `empresa: { id, nome } | null` — `left join lateral` em `contato_empresa` (`fim is null`) → `empresas` (`estado <> 'na_lixeira'`), `order by ce.admin desc, ce.criado_em, ce.id limit 1`. **A 007 não tem "vínculo principal"** (só `admin`); o planejador confirma o critério (Open Question 6). Índice existente `contato_empresa_contato_idx (workspace_id, contato_id) where fim is null`.
- `qualificacaoId: string | null` — `ef.qualificacao` (id de item do Catálogo, que mora em `registros`; a web resolve o rótulo de `state.catalog`).
- `conversa: { situacao, estado, atribuido: { tipo, id } | null } | null` — `cv.situacao`, `cv.estado`, `cv.atribuido_tipo`, `cv.atribuido_id` (a web resolve o nome em `state.members`/`state.agents`). Estas colunas já saem do `join` de `cv`: custo zero.
- Custo extra: uma sonda indexada por linha (≤200) para a Empresa; as demais colunas vêm de joins que já existem. Desprezível perto da lateral das Mensagens (que varre `mensagens` por `criado_em desc`).
- Como o SQL será editado, fechar **WR-05** no mesmo plano (a mesma consulta) e, barato, **WR-03** (`recusarSuspensoNaEscrita` trata o `POST` de resumo como escrita: `plugins/autenticacao.ts:63-70`; marcar a rota como leitura) e **WR-04** (exibir o erro do resumo no lugar do esqueleto eterno).
- Tela: `cartao-conversacional.tsx`, `tabela-de-tarefas.tsx`, `tarefa-completa.tsx` (menu e ações) e `reuniao`; tipo novo em `resumo-da-tarefa.ts`; testes `servicos/crm/tarefas-conversacionais.test.ts` (Docker), `rotas/crm/tarefas-conversacionais.test.ts`, `dados/crm/tarefas-conversacionais.test.ts`, `tarefa-completa-resumo.test.tsx`.

## Removal safety net (pergunta 9)

Já existem guardas de **código-fonte** no padrão "congelar a lista que só encolhe":
- `packages/dominio/src/sem-listas-espelho.test.ts`, `apps/api/src/sem-listas-espelho.test.ts`, `apps/web/src/sem-listas-espelho.test.ts` — leem os `*.ts` de produção; `CONGELADOS = ["operations/index.ts", "operations/iniciar-conversa.ts", "operations/registro.ts"]` (domínio) e **falham também quando um arquivo congelado deixa de citar** (`sumidos`). Ao apagar `iniciar-conversa.ts` e as menções em `index.ts`/`registro.ts`, as três listas têm de ser atualizadas na mesma mudança; planejar isso na 3.5.4 (e as telas de 3.4.5).
- `apps/api/src/persistencia/regime-dos-chamadores.test.ts` — o script de migração não pode passar `regime:`.

**Guardas novas recomendadas:**
1. **`sem-crm-antigo.test.ts` em cada camada** (mesmo molde): regex sobre o texto de produção `/\b(state|data|estado|s)\.(contacts|companies|deals|funnels|channels|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b/` e `canais-projetados`/`acrescentarCanaisProjetados`, com `CONGELADOS` iniciais = os arquivos de hoje; **cada plano de tela remove da lista o que migrou**; no 15-20 a lista de `channels/contacts/...` fica vazia e `conversations` só admite os arquivos de Grupo/Flow (`operations/ferramentas/{grupos,flows,comunidades,provedor-simulado}.ts`, `derive-ferramentas.ts`, `features/ferramentas/{conversa-do-grupo,flow-popup}.tsx`, `types/conversa-de-grupo.ts`). Cobrir também imports de tipo antigo de `@n1/dominio/types`.
2. **`tsc` como rede principal (3.5.4):** remover `contacts…channels` de `DataState` (`state.ts:85-96`) e de `TODAS` (`colecoes.ts`) — `ChaveDeColecao` é derivado de `DataState` e `Record<ChaveDeColecao, true>` obriga as duas listas a andarem juntas [VERIFIED: `colecoes.ts`] — e deixar `npm run typecheck` achar cada leitor remanescente. Manter `conversations: ConversaDeGrupo[]`.
3. **Contagem de operações:** `rotas/esquemas-de-argumentos.test.ts:126` fixa `expect(chaves.length).toBe(285)`. As 45 operações antigas em `OPERACOES` (12 de Negócio, 11 de Conversa, 19 de Contato/Empresa, `iniciarConversa`, `criarCanal`, `configurarCanal`, lidas em `registro.ts:442-480,589,662`) dão **240** `[ASSUMED: aritmética sobre a lista lida; reconferir com `Object.keys(OPERACOES).length` antes de fixar]`. Acrescentar teste que `ehNomeDeOperacao(nome)` é `false` para cada uma das 45 (a rota responde 404, como na F14-17).
4. **Pós-condição de banco no próprio script** (`--verificar`) e, no ensaio, `hidratar` por Espaço sem coleção antiga.
5. **Barril `operations/index.ts`:** uma linha `export const … = instrumentar("…")` por operação (`index.ts:44-…`); remover as 45 junto de `registro.ts`, senão o `tsc` quebra.
6. **`derive-conversacional-antigo.test.ts` e `canais-projetados.test.ts`** são apagados com o que cobrem (14-17-SUMMARY já anotou).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trava do Espaço, revisão, rollback, prazos no script | `begin`/`for update` à mão | `executar()` travada (`unidade-de-trabalho.ts`) + `lerDoCrm`/`aoConfirmar` | Já resolve o que a F12/F13/F14 gastaram semanas provando; `55P03` vira conflito, não exceção |
| Reescrever ids em dezenas de coleções | lista de campos por coleção | preservar ids; senão, passada genérica por valor + varredura de pós-condição | Qualquer campo esquecido vira Vínculo pendurado em produção |
| Inserir em lote nas tabelas novas | `insert` por linha em laço | `unnest(...)`/`jsonb_to_recordset` com colunas explícitas (`repositorio.ts` já usa `unnest` em `gravar`) | 350 Mensagens por Espaço × 17 Espaços |
| Provar "não escreveu" no `--seco` | confiar no código | `begin read only` / `default_transaction_read_only = on` | O Postgres recusa a escrita |
| SQL dinâmico no bootstrap/migração | concatenar valores | `$n` para valores; nomes de tabela/coluna só de constantes; `format('%I', …)` no bloco `do $$` | T-07-06 e a regra de `servicos/crm/transacao.ts` |
| Traduzir `40P01`/`23xxx` em recusa | `catch` espalhado | `comTransacao`/`traduzirErroDePg` (acrescentar `40P01` em `SQLSTATE_TRADUZIVEIS`) | uma tradução, sem nome de constraint na resposta |
| Linha do tempo de Atividade | tela que lê duas fontes de forma diferente | `ActivityRecord` como DTO único da rota nova | os componentes de timeline já existem |
| Backup | script de desfazer | `pg_dump -Fc --schema=plataforma --no-owner --no-acl` + restore em Docker (D-15-02) | decisão travada |

**Key insight:** a parte arriscada desta fase é a *consistência de referências* (ids, escopos, Vínculos, Atividade) e a *perda de dado* na remoção, não o desenho das telas. Tudo que reduz o número de campos a enumerar (preservar ids, varredura genérica, pós-condição em banco) vale mais do que mais testes por campo.

## Runtime State Inventory

Fase de migração/remoção: as cinco categorias respondidas.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `plataforma.registros`: nove coleções do CRM antigo, 2128 linhas em 18 Espaços (`14-ENSAIO.md`); `ws_n1` só com 1 Funil. Referências a ids antigos dentro de `links`, `tasks[].provenance`, `lists[].canaisDeAtendimento`, `grupos/comunidades/flows[].canalId`, Participações/Pedidos (`contactId`), `chatSessions[].anchor`, `activity[].objectId`, escopos `funnel`/`channel` de Automações/Agentes/Painéis, `grants` de Funil. `plataforma.contatos` em produção: 2 Contatos `ativo`, 0 Conversas. `registros_crm_antigo`, `crm_de_para`: vazias. | **Migração de dados** (script: cópia + remoção + inserção) **e** edição de código; ids preservados reduzem a migração de referências a zero |
| Live service config | Nenhum serviço externo guarda id de Contato/Canal/Negócio: o evento `automacao.notificar-canal.v1` leva o **tipo** do Canal, não o id (`persistencia/CONTEXT.md`, "A ponte dos Canais"). Supabase: nenhuma configuração do CRM fora do schema. | Nenhuma — verificado por leitura de `persistencia/CONTEXT.md`; reconfirmar `outbox` pendente antes do corte |
| OS-registered state | VM da API (publicação manual com `publicar.sh` e a chave `n1_crm_deploy_ci`); nada registrado com nome de coleção ou de rota antiga. | Nenhuma — o deploy é procedimento (D-15-03) |
| Secrets/env vars | `DATABASE_URL`, `DATABASE_URL_MIGRACAO` (as duas mudam juntas, `persistencia/CONTEXT.md`); nenhuma variável nomeia o CRM antigo. | Nenhuma mudança de nome; **os testes desta fase nunca usam o `.env` de produção** |
| Build artifacts / installed packages | `apps/web/.next/types/routes.d.ts` e `.next/dev/types/validator.ts` ainda listam `/crm/meus-negocios` e `/crm/meus-negocios/[lista]` (artefato local de `next dev`); `~/n1-ensaio/backup-plataforma-pre-011-20261105-1113.dump` é **anterior à 011** (o nome diz pre-011). | `.next` se regenera (não versionado); **tirar backup novo imediatamente antes do corte** (D-15-02) — o do ensaio não serve como rede |

## Common Pitfalls

### Pitfall 1: o script depende do modelo que a 3.5.4 apaga
**What goes wrong:** `migrar-crm-antigo.ts` importa `Contact`, `Deal`… de `@n1/dominio`; a 3.5.4 não compila ou o `--verificar` some. **How to avoid:** tipos estruturais locais + fixture JSON congelado (seção do script). **Warning signs:** `import … from "@n1/dominio/types"` com tipo antigo dentro de `apps/api/src/migracao-crm/`.

### Pitfall 2: Empresa sem Contato derruba o Espaço inteiro no `commit`
**What goes wrong:** `empresa_exige_admin` é constraint trigger deferido; só falha no `commit`, depois de o script ter inserido tudo. **How to avoid:** pré-validar no mapeador e mandar a Empresa para o relatório. **Warning signs:** `check_violation` com `constraint = 'empresa_exige_admin'` no ensaio.

### Pitfall 3: `hidratar()` devolve tudo que está no banco
**What goes wrong:** depois que `contacts`/`conversations`… saem de `TODAS`, as linhas que sobraram em `registros` ainda entram em `state` (`estadoDasLinhas` faz `state[linha.colecao] ??= []`, `repositorio.ts:137`) e vão no `GET /estado`. **How to avoid:** apagar no corte (D-15-02) e provar com `--verificar`. [VERIFIED: leitura de `estadoDasLinhas`]

### Pitfall 4: Início/Painel/Notificações com listas paginadas
**What goes wrong:** `LIMITES_CRM.paginaMaxima = 200` (`crm/comum.ts:89`); `useConversas`/`useContatos`/`useNegocios` não têm filtros de dono nem de "não lida" (`FiltroDeConversas` tem `atribuidoId`, `filaId`, `comEstrela`, `q`, `situacao`, `canalId`, `contatoId`; `QUERY_NEGOCIOS` tem `funilId`, `situacao`, `empresaId`, `contatoId`; `QUERY_LISTA` só `estado`/`q`). "Leads a atender", "mensagens novas" e o badge global de `app-shell` somariam errado a partir de 200 itens. **How to avoid:** endpoint de agregado (15-06) e totais por `limite=1` (as listas devolvem `total`); `derive-resumo` recebe linhas já filtradas.

### Pitfall 5: estrela/leitura inundando a Atividade
`PUT /conversas/:id/marcacao` é chamado ao abrir a Conversa; gravar uma linha por chamada gera ruído e escrita. **How to avoid:** só registrar mudança de valor.

### Pitfall 6: cache SWR não vê a revisão do Espaço
O `AcompanhanteDaRevisao` re-hidrata `GET /estado` a cada 5 s, mas as telas REST usam SWR e só atualizam por `invalidarCrm(...)`. Telas novas que gravam por REST precisam invalidar a própria chave e as vizinhas (lista, ficha, resumo, contadores do shell).

### Pitfall 7: Ferramentas criam Contato dentro de operação pura
Ver "Corte proposto": sem a porta de criação, 3.4.8 ou perde a criação de Contato de Participante ou duplica regra no serviço.

### Pitfall 8: teste que abre produção
`carregarEnv()` + `Boolean(process.env.DATABASE_URL)` abre o `.env` (D-15-07 e `14-PROVAS.md` "Incidente"). Todo teste novo: `describeComBanco`; todo comando de teste: as duas URLs locais escritas no comando.

### Pitfall 9: ordem de trava Contato → Negócio
Corrigir WR-01 travando o Contato em `negocios.editar` *depois* de já ter travado o Negócio inverte a ordem da mesclagem; sem `40P01`→409 vira 500 raro. Ver a linha WR-01.

### Pitfall 10: Funil padrão do `ws_n1`
Migrar o `fnl_padrao` como padrão num Espaço que já tem Funil novo viola `funis_padrao_uq`/`funis_nome_uq`; e o Funil do bootstrap é só um marcador de uma Etapa "Novo". Default sugerido ao dono: **guardar, não migrar** (D-15-13: Espaço sem Funil).

## Code Examples

### O esqueleto do script como uma `executar()` (padrão a seguir)
```ts
// Source: apps/api/src/persistencia/unidade-de-trabalho.ts:184-202 (lerDoCrm/aoConfirmar) e servicos/crm/gesto-misto.ts
const resultado = await executar<Relatorio, Plano>(
  workspaceId,                                   // validado: /^ws_[a-z0-9_]+$/ e existente
  (state, plano) => aplicarNoRegistros(state, plano), // pura: esvazia as nove coleções, remove Pasta/Listas vazias
  {
    lerDoCrm: async (cliente, state) => {
      await copiarParaRegistrosCrmAntigo(cliente, workspaceId);   // insert … select … from registros (byte a byte)
      await conferirContagens(cliente, workspaceId);              // count(origem) = count(cópia), senão lança
      return planejarMigracao(state, await lerDoCrmNovo(cliente, workspaceId));
    },
    aoConfirmar: async (cliente, _valor, _state, plano) => {
      if (modo === "migrar") await inserirNasTabelasNovas(cliente, workspaceId, plano);
    },
  },
);
```

### `--seco`: relatório que prova que não escreve
```ts
// Source: padrão do ensaio da F14 (14-ENSAIO.md: sessão com default_transaction_read_only = on)
const cliente = await pool().connect();
try {
  await cliente.query("begin read only");
  const { state } = await hidratar(cliente, workspaceId);       // hidratar() só faz select
  imprimir(relatorio(state, await contagensDoCrmNovo(cliente, workspaceId)));  // só ids e contagens
} finally { await cliente.query("rollback"); cliente.release(); }
```

### Guarda de código-fonte por camada (molde de `sem-listas-espelho.test.ts`)
```ts
// Source: packages/dominio/src/sem-listas-espelho.test.ts (CONGELADOS que só encolhe)
const CONGELADOS = [/* arquivos que ainda leem o antigo hoje; cada plano de tela tira os seus */] as const;
const LE_O_ANTIGO = /\b(state|data|estado)\.(contacts|companies|deals|funnels|channels|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b/;
it("só a lista congelada lê o CRM antigo", () => {
  const citam = producao.filter((f) => LE_O_ANTIGO.test(f.texto)).map((f) => f.arquivo).sort();
  expect(citam.filter((a) => !CONGELADOS.includes(a))).toEqual([]);   // nenhum arquivo novo
  expect(CONGELADOS.filter((a) => !citam.includes(a))).toEqual([]);   // e a lista tem de encolher
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CRM em `plataforma.registros` (inglês) hidratado em `GET /estado` | Tabelas por entidade + REST por recurso (`/contatos`, `/conversas`, …) lidas por SWR | Fases 7, 8 e 14 | Telas deixam de depender do store para o CRM |
| Operação pura grava tudo em `registros` | Gesto misto: `lerDoCrm` + operação pura + `gravarNoCrm` na mesma transação | Fase 14 (3.2.1) | Padrão para Ferramentas e para o script |
| Canais do seed projetados em `state.channels` | `plataforma.canais` lido por `LER_DO_CRM` | Fase 14 (3.3.7) | A ponte `canais-projetados.ts` sai em 3.5.4 |

**Deprecated/outdated:** as 45 operações antigas de CRM, `crm-antigo.ts`, `canais-projetados.ts`, os recuos 404 → legado (`ficha-de-*-legado`, `deal-screen`), a Pasta "Meus negócios".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O único Funil do `ws_n1` é o `fnl_padrao`/"Padrão"/"Novo" do `bootstrap:gestao` (inferido pela forma: 1 Funil e nada mais; confirmado só pelo `--seco`) | Script | Se for um Funil de verdade, "guardar" perde configuração; o `--seco` e a decisão do dono (D-15-04) protegem |
| A2 | `ws_n1` não tem a Pasta "Meus negócios" (o bootstrap não a cria) | Script / D-15-14 | Se tiver com Tarefas, a regra de D-15-14 já cobre (não apaga e reporta) |
| A3 | Preservar o id antigo como id novo é aceitável ao dono | Decisão de ids | Se o dono quiser UUID novos, voltar à reescrita genérica (custo maior no script) |
| A4 | Após remover as 45 operações, `Object.keys(OPERACOES).length` = 240 | Removal safety net | Contagem errada falha o teste; reconferir antes de fixar |
| A5 | Início/Painel/Notificações precisam de endpoint de agregado (listas pagináveis não bastam) | Pitfall 4 / plano 15-06 | Se o volume real for pequeno, listas bastam e o plano encolhe |
| A6 | A Empresa do cartão é "o vínculo vigente `admin` mais antigo" (a 007 não tem principal) | Resumo | Pode mostrar a Empresa errada para Contato com várias |
| A7 | Convenção de container/porta do Docker para a fase: `crm-n1-pg-15NN`, porta `557NN` (extrapolada de `crm-n1-pg-1418`/`55618`) | Validation | Só nome; sem impacto |
| A8 | O Docker daemon está ativo no notebook do dono (só o CLI foi verificado: v29.3.1) | Environment | Sem Docker não há gate de banco |
| A9 | Escopo da Atividade além dos 9 gestos do D-15-09 (criar/lixeira/ganhar/perder/mover Etapa) | Atividade / Open Question 1 | Auditoria regride se ficar de fora |
| A10 | Conversas de Grupo atribuídas a Membro removido continuam "liberadas" (modelo antigo remanescente) | D-15-08 | Inconsistência de regra entre Conversa de Grupo e as demais |
| A11 | As contagens de testes (224/35/39) são por `grep` e aproximadas | Seed | Plano subestima/superestima o retrabalho de testes |

## Open Questions

1. **Escopo da Atividade (D-15-09).** O que sabemos: a lista do CONTEXT tem 9 gestos; as operações antigas gravavam também "Negócio marcado como ganho/perdido", "Empresa criada", "Contato enviado à lixeira", "Etapa removida" etc., e os CRUD REST de Contato/Empresa/Negócio/Funil/Canal da Fase 7 não gravam nada. O que falta: decidir se entram agora. Recomendação: o repositório `registrarAtividade` é uma linha por gesto; incluir os que as operações antigas gravavam (senão a Auditoria regride quando elas saírem em 3.5.4) e deixar explícito no plano o que ficou de fora.
2. **Preservar ids (A3).** Recomendação: preservar; se o dono preferir ids novos, aceitar o custo da reescrita genérica.
3. **Mapeador completo ou só o caminho crítico?** Em produção o `ws_n1` quase não tem CRM antigo. O mapeador completo serve ao teste exigido pela 3.5.1, ao ensaio e ao demo. Recomendação: construir, mas em plano/tarefa separada do caminho crítico (guardar/remover), para o corte não depender dele.
4. **Funil do `ws_n1`:** decisão do dono depois do `--seco` (D-15-04). Default sugerido: guardar.
5. **Agregados do Início/Painel/Notificações:** quais números exatamente e se um endpoint só atende (`leads a atender`, `mensagens novas`, `estatísticas do Membro`, badge global, `widgetReading` do Painel).
6. **Empresa no cartão da Tarefa (A6).**
7. **Conversa de Grupo atribuída a Membro removido (A10).**
8. **Onde mora o script:** `apps/api/src/migracao-crm/` (recomendado) ou `importacao/crm-antigo/` (3.5.1, contraria o `CONTEXT.md` de `importacao/`).

## Assumption errors no CONTEXT / TAREFAS (o planejador deve corrigir)

1. **`UNI-04..UNI-08` colidem com a Fase 14** — usar `UCR-xx` (ver "Phase Requirements").
2. **"62 arquivos"** é um `grep` de palavra, não de leitura; são **72 arquivos de código** na web (e 13 deles não estavam nos 62).
3. **D-15-14 "o `ws_n1` provavelmente já as tem" (Pasta/Listas espelho):** o bootstrap do `ws_n1` não cria a Pasta. Tratar como provável ausente.
4. **D-15-08 "se a regra estiver lá":** está, em oito lugares, e diz o contrário (liberação, "Não há Sucessor de Conversas"). Contrato primeiro.
5. **3.5.1 passo 8** (Conversa na lixeira "entra `resolvida` e `na_lixeira`") é anterior à 011: falta `na_lixeira_em`. **Passo 5:** falta a regra de Empresa com admin vigente. **Passo 9:** lista incompleta (faltam `activity`, `chatSessions.anchor`, escopos `channel`/`queue`/`inbox`, Participações, Comunidade/Flow).
6. **Números de linha que derivaram:** `unidade-de-trabalho.ts:137,189` → projeção em `:496`, `:556`, `:618`; `referencias.ts:63` → `:77`; `derive.ts:443` → `:721`; `registro.ts:420` → `OPERACOES` em `:414`; `repositorio.ts:96` → `hidratar` em `:101` (`sqlDeHidratar` acima); `conversation-thread.tsx` `:371/:389/:424/:482/:768/:834` → `:375/:393/:428/:486/:772/:845`. Os da 3.4.1 (`caixa-de-entrada/page.tsx:22`, `inbox-columns.tsx:420`, `[conversa]/page.tsx:157/321/332/391`) **conferem**.
7. **3.5.3 `crm-demo.sql` só de dados** não é reaplicável por causa de `workspace_id` em PK/FKs compostas.
8. **3.4.7 "a tela busca com `useConversas`, `useContatos`, `useNegocios`":** insuficiente (teto 200, sem filtro de dono/não lida).
9. **3.4.8** não menciona que as operações *criam* Contatos.
10. **3.4.5 variante (A)** (`funilId` na Lista, `POST /negocios/iniciar-conversa`) já foi descartada por F14-D-06; só a variante (B) vale.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | CLIs `vite-node`, vitest | ✓ | v24.14.0 | — |
| npm | workspaces, `npm run check` | ✓ | 11.9.0 | — |
| Docker (CLI) | Postgres 16 descartável para o gate e o ensaio | ✓ CLI | 29.3.1 (daemon **não** verificado, A8) | sem Docker, nenhum teste de banco roda: bloqueia o gate |
| `psql`, `pg_dump`, `pg_restore` | backup (D-15-02), ensaio, `\copy` | ✓ | `/opt/homebrew/bin/` | — |
| Cópia dos dados reais | ensaio 3.5.2 | ✓ | `~/n1-ensaio/` (`backup-plataforma-pre-011-20261105-1113.dump`, `contagem-origem.txt`, `registros-crm-antigo.csv`, `workspaces.csv`) | — |
| Postgres de produção (Supabase) | só o corte (D-15-03) | não tocado | — | — |
| VM da API / `publicar.sh` / chave `n1_crm_deploy_ci` | publicação da API no corte | não verificado (nunca durante pesquisa) | — | — |

**Missing dependencies with no fallback:** nenhuma identificada, desde que o daemon do Docker esteja ativo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^5.0.0 (v5.0.1 nos runs de `14-PROVAS.md`) nas três camadas |
| Config file | `apps/api/vitest.config.mts`, `apps/web/vitest.config.mts`, `packages/dominio/vitest.config.mts` |
| Quick run command | `cd packages/dominio && npx vitest run <arquivo>` · `cd apps/web && npx vitest run <arquivo>` · `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:557NN/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:557NN/postgres npx vitest run <arquivo>` |
| Full suite command | o gate de `14-PROVAS.md`: `docker run -d --rm --name crm-n1-pg-15NN -e POSTGRES_PASSWORD=x -p 557NN:5432 postgres:16`; `(cd apps/api && DATABASE_URL=… DATABASE_URL_MIGRACAO=… npm run --silent migrar)`; `DATABASE_URL=… DATABASE_URL_MIGRACAO=… npm run check`. **Nunca** `npm test` sozinho. |
| Duração observada | api ~157 s, web ~17 s, domínio ~4 s (`14-PROVAS.md`) — `check` completo cabe em ~4 min em Docker |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UCR-01 | WR-01 (3 portas), WR-02 (trava Espaço antes do Canal), WR-05, WR-06, `instantiateListTemplate` com `canais`, `operacoes.test.ts` pula sem Postgres local | integração (Docker) + unit | `…vitest run src/servicos/crm/{conversas,negocios,empresas,canais,contatos,tarefas-conversacionais}.test.ts src/rotas/operacoes-canais-da-lista.test.ts src/rotas/operacoes.test.ts` | ✅ arquivos existem, casos novos |
| UCR-02 | Sucessão passa Conversas; contagens; contrato; diálogo | integração + unit web | `…vitest run src/servicos/crm/sucessao.test.ts src/rotas/crm/sucessao.test.ts` · `cd apps/web && npx vitest run src/features/shell/membros-sucessao-no-crm.test.tsx` | ✅ (reescrever expectativas) |
| UCR-03 | `012` aplica, idempotente, RLS desligada, tabela só-inserção; gestos gravam na mesma transação (rollback não deixa linha); `GET /atividades` por Papel e Espaço; fusão na web | integração + unit | `…vitest run src/persistencia/migracao-012.test.ts src/servicos/crm/*.test.ts src/rotas/crm/atividades.test.ts` · `cd apps/web && npx vitest run src/dados/crm/atividades.test.ts` | ❌ Wave 0 |
| UCR-04 | Resumo traz Empresa, qualificação, estado, Atribuído; cartão/ficha mostram; "Mesclar" libera o botão só com o nome | integração + componente | `…vitest run src/servicos/crm/tarefas-conversacionais.test.ts` · `cd apps/web && npx vitest run src/features/estrutura/tarefa-completa-resumo.test.tsx src/features/crm/ficha-de-contato.test.tsx` | ✅ (casos novos) |
| UCR-05 | Caixa/fio/configurações lêem e gravam por REST; nenhuma linha em `registros` coleção `conversations`; sem rascunho; popup só liga | componente com cliente falso + guarda | `cd apps/web && npx vitest run src/features/crm/{inbox-columns,conversation-thread}.test.tsx src/dados/crm/{conversas,mensagens}.test.ts src/sem-crm-antigo.test.ts` | ❌ Wave 0 (hooks e guarda) |
| UCR-06 | Fichas sem recuo (404 = "não encontrado"); Reunião mostra Negócio de `plataforma.negocios`; `/crm/meus-negocios` não existe | componente + guarda | idem; `ficha-de-negocio.test.tsx`, `paginas-de-empresa.test.tsx` | ✅/❌ |
| UCR-07 | Busca/Lixeira/Notificações/Início/Painel/Config sem as quatro coleções no store; Espaço novo sem Funil padrão (`bootstrap-gestao.test.ts`) | unit + componente | `cd packages/dominio && npx vitest run src/{derive-resumo,bootstrap-gestao}.test.ts` · web idem | ✅ (reescrever) |
| UCR-08 | Ferramentas com ids de `plataforma.canais`/`plataforma.contatos` (incl. criar Contato de Participante); IA e Contas a receber idem | unit + integração | `cd packages/dominio && npx vitest run src/operations/{ferramentas,ia/agentes,contas-a-receber,importacao-contas-a-receber}.test.ts` · `cd apps/api && … vitest run src/importacao/clickup/importar-contas-a-receber.test.ts` | ✅ (reescrever) |
| UCR-09 | Script: `--seco` read-only; `--guardar` copia e confere contagem antes de apagar; migrar insere na ordem das FKs; Empresa sem admin vai ao relatório; segunda execução não muda nada; `--verificar` | integração (Docker, `describeComBanco`) | `…vitest run src/migracao-crm/*.test.ts` | ❌ Wave 0 |
| UCR-10 | Ensaio sobre a cópia: contagens-base (2128, 18 Espaços), `hidratar` por Espaço sem coleção antiga | manual (agente com Docker + cópia do dono) | passos do `14-ENSAIO.md` + `--verificar` | ❌ manual |
| UCR-11 | Seed sem CRM antigo; Espaço novo com CRM vazio; `crm-demo` carrega num Postgres migrado e os Vínculos do seed apontam para ids existentes | unit + integração | `cd packages/dominio && npx vitest run src/seed*.test.ts` · `cd apps/api && … vitest run src/bootstrap/crm-demo.test.ts` | ❌ Wave 0 |
| UCR-12 | `npm run typecheck` verde sem as coleções; `sem-crm-antigo` vazio (salvo Grupo/Flow); 404 para as 45 operações; contagem 240; `sem-listas-espelho` atualizadas | unit (leitura de código) + tsc | `npm run typecheck` · `…vitest run src/rotas/esquemas-de-argumentos.test.ts src/sem-crm-antigo.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Por tarefa:** o `vitest run` do arquivo (segundos) + `tsc` do workspace tocado.
- **Por plano/onda:** `npm run check` em Docker (≈4 min). Aceitar como verde só com os flakes de baseline (`outbox-worker.test.ts` h–k, `colunas-geradas.test.ts`, `lote-contas-a-pagar (d)`) e evidência (rodar o arquivo isolado), como fez o 14-18.
- **Phase gate:** `npm run check` verde duas vezes + `--verificar` sobre o ensaio + `/gsd-verify-work 15`.

### Wave 0 Gaps
- [ ] `apps/api/src/persistencia/migracao-012.test.ts` — UCR-03
- [ ] `apps/api/src/rotas/crm/atividades.test.ts`, `servicos/crm/atividades.test.ts`, `apps/web/src/dados/crm/atividades.test.ts` — UCR-03
- [ ] `apps/web/src/dados/crm/{conversas,mensagens}.test.ts` (molde `contatos.test.ts`) — UCR-05
- [ ] `apps/api/src/migracao-crm/*.test.ts` + fixture JSON congelado do CRM antigo — UCR-09
- [ ] `apps/api/src/bootstrap/crm-demo.test.ts` — UCR-11
- [ ] `sem-crm-antigo.test.ts` nas três camadas — UCR-12
- [ ] Atualizar `rotas/esquemas-de-argumentos.test.ts:126` (285 → contagem nova) na remoção

**Provas manuais (não automatizáveis):** aprovação do dono do relatório `--seco` (3.5.2); ensaio com a cópia real em `~/n1-ensaio`; as "provas manuais pendentes" da Fase 14 (14-11, 14-12, 14-15, 14-16 em `14-PROVAS.md`) que só fazem sentido depois da troca de telas; olhar cada tela com `npm run dev` apontado para um Postgres local migrado (`human_verify_mode: end-of-phase`).

## Security Domain

`security_enforcement` está ligado (`workflow.security_enforcement: true`, ASVS nível 1, bloqueio em `high`). [VERIFIED: `.planning/config.json`]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não muda | JWT do Supabase no hook `onRequest` (existente) |
| V3 Session Management | não muda | idem |
| V4 Access Control | **sim** | Papel antes de qualquer leitura (`exigir`/`podeNoCrm`), `workspace_id` sempre da sessão, 404 para id de outro Espaço; rotas novas (`/atividades`, `/crm/nomes`, agregados, `/conversas` filtros) seguem o mesmo molde |
| V5 Input Validation | **sim** | zod em toda rota nova; no CLI, `--espaco` validado por regex e existência; valores SQL por `$n`, nomes de tabela só de constantes |
| V6 Cryptography | não | nada novo (cofre da 009 intacto); backup é `pg_dump` local, fora do git |
| V7 Error Handling/Logging | **sim** | log só de ids e contagens; nunca nome, telefone, e-mail ou trecho de Mensagem (`registros_crm_antigo` guarda dado pessoal, `011` header) |
| V8 Data Protection | **sim** | `registros_crm_antigo` e o fixture do demo contêm dado pessoal: fixture **gerado de dados sintéticos do seed**, nunca de cópia de produção |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Isolamento de Espaço nas rotas novas | Information Disclosure | `workspace_id = $1` da sessão em toda consulta; teste de vazamento no molde de `testes/espaco-de-vazamento.ts` (`montarSegundoEspaco`) para `/atividades`, `/crm/nomes` e agregados |
| `POST /crm/nomes` revela nome de qualquer id | Information Disclosure | exigir `ler` por tipo, limitar 200, resolver só no Espaço da sessão, devolver `null` (não 403 por item) para id desconhecido/sem permissão |
| `POST /tarefas-conversacionais/resumo` aceita ids sem relação com Tarefas visíveis (IN-05) | Information Disclosure | hoje todo Papel com `ler` alcança os mesmos recursos (sem escopo `próprios`); registrar a dependência; ao estender o resumo (Empresa, Atribuído) o vazamento potencial cresce — repetir o teste de Espaço |
| Script grava em Espaço errado | Tampering | `--espaco` obrigatório e nominal; todo `where` com `workspace_id = $1`; uma `executar()` por Espaço; sem modo "todos"; o relatório `--seco` imprime o Espaço antes de qualquer escrita |
| SQL injection em SQL dinâmico da migração/bootstrap | Tampering | valores por `$n`; identificadores só de constantes; `format('%I')` onde houver nome dinâmico |
| Perda de dado ao apagar `registros` | Repudiation/DoS | cópia byte a byte + `count` igual **antes** do `delete`, na mesma transação; backup manual restaurado em Docker; `--verificar`; `registros_crm_antigo` com PK `(workspace_id, colecao, id)` e `on conflict do nothing` |
| Teste abre o banco de produção | Elevation/Tampering | `describeComBanco` (host local) em todo teste novo; comandos com as duas URLs locais |
| `bootstrap:crm-demo` rodado em produção | Tampering | recusar host remoto sem flag explícita e Espaço com Contato |
| Atividade viraria forma de apagar histórico | Repudiation | repositório só `inserir`/`listar`; sem FK (sobrevive à eliminação); `ator` vem da sessão, nunca do corpo |
| Deadlock vira 500 e destrói a conexão (WR-02/WR-01) | DoS | travar o Espaço antes do Canal; traduzir `40P01` em 409 transitório |

## Sources

### Primary (HIGH confidence — lidos neste ambiente)
- `.planning/phases/15-…/15-CONTEXT.md`, `14-REVIEW.md`, `14-REVIEW-DISPOSITION.md`, `14-PROVAS.md`, `14-ENSAIO.md`, `14-RESEARCH.md` (tabela de requisitos), `14-17-SUMMARY.md` (trechos), `.planning/ROADMAP.md:764,819-829`, `.planning/config.json`
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` linhas 960–1265 (3.3.7, 3.4, 3.5, 3.6 a 3.9)
- `apps/api/migracoes/007-crm.sql`, `008-canais-conversas-mensagens.sql`, `011-crm-o-que-faltava.sql`; `persistencia/{CONTEXT.md,migrar.ts,migrar.cli.ts,repositorio.ts,unidade-de-trabalho.ts}`; `servicos/crm/{conversas,negocios,empresas,canais,contatos,gesto-misto,transacao,sucessao}.ts`; `repositorios/crm/{referencias,sucessao,tarefas-conversacionais,mensagens,funis}.ts`; `rotas/{operacoes,estado}.ts`, `rotas/crm/{comum,index,conversas,negocios}.ts`, `rotas/esquemas/{planejamento,estrutura,tarefas-conversacionais}.ts`, `testes/banco-crm.ts`, `importacao/CONTEXT.md`, `apps/api/CONTEXT.md`
- `packages/dominio/src/{state,colecoes,bootstrap-gestao,derive*,seed-comercial,estruturas-fixas}.ts`, `types/{crm,primitives}.ts`, `crm/resumo-da-tarefa.ts`, `operations/{registro,index,activity,vinculos-da-mesclagem,members,crm-antigo,planning,ferramentas/participacoes}.ts`, `sem-listas-espelho.test.ts`
- `ontologia/01-espaco-de-trabalho/espaco-de-trabalho.md:310,331`, `ontologia/03-crm/caixa-de-entrada-e-mensageria.md:85,449,570,612,755,812`, `ontologia/03-crm/crm-visao-geral.md:335`, `ontologia/DECISOES-E-PENDENCIAS.md:213`
- `apps/web/src` (AST de 395 arquivos; páginas e features citadas), `apps/web/src/dados/crm/contatos.ts`, `app/(shell)/crm/contatos/[contato]/page.tsx`
- Contagens: `grep`/scripts TypeScript (AST) em `scratchpad` da sessão

### Secondary / Tertiary
- Nenhuma fonte externa. Nenhuma pesquisa web: é refatoração interna.

## Metadata

**Confidence breakdown:**
- Caller map: HIGH — AST sobre o código atual; falsos positivos listados.
- Dívida da Fase 14 e contrato D-15-08: HIGH — código e ontologia lidos nas linhas citadas.
- Atividade `012` e script: MEDIUM-HIGH — desenho derivado das migrações lidas; nomes de colunas/arquivos são proposta.
- Corte em planos e tamanhos: MEDIUM — por LOC e dependências lidas, sem execução.
- Início/Painel (agregados): MEDIUM — depende de decisão de produto.

**Research date:** 2026-11-05
**Valid until:** ~14 dias, ou até o próximo commit que toque `apps/api/src/servicos/crm/*`, `packages/dominio/src/derive*.ts` ou `apps/web/src/features/crm/*` (o repositório se move rápido).

