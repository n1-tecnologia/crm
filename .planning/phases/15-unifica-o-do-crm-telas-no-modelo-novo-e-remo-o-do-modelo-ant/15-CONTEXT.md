# Phase 15: Unificação do CRM: telas no modelo novo e remoção do modelo antigo - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Sessão 3 do cronograma, parte B (3.4 e 3.5, 14 subtarefas). A Fase 14 deixou o modelo novo do CRM pronto (migração `011` aplicada em produção desde 2026-11-05, rotas por recurso, gesto misto, Tarefa conversacional nas tabelas). Hoje **62 arquivos da web (fora de testes)** ainda leem `contacts`, `companies`, `deals`, `funnels`, `channels` ou `conversations` do store, e o modelo antigo segue em `plataforma.registros`. Esta fase:

1. troca todas as telas e leituras para o modelo novo (3.4.1 a 3.4.10: Caixa de Entrada, fio, configurações/Filas/Canais, fichas, Meus negócios e Reuniões, Busca/Lixeira/Notificações, Início/Configurações/Painel, Ferramentas, IA, Contas a receber);
2. escreve e roda o script de migração dos dados antigos (3.5.1, 3.5.2) e tira o CRM antigo do seed (3.5.3);
3. remove o modelo antigo do código (3.5.4), exceto o resto de `Conversation` que guarda só Grupo e Flow até as Sessões 6 e 7 (decisão D-05 da Fase 14).

Não entra: a base da mensageria (Fase 16, Sessão 3 parte C), Tags / vários Contatos por Negócio / histórico de Etapas / Requisitos de Etapa / Anexos de Empresa e Negócio / temperatura do Contato (sessão própria), Conversa de Grupo e Mensagens de Flow nas tabelas (Sessões 6 e 7), rascunho de Conversa (Sessão 16).

**A remoção do modelo antigo (3.5.4) é a porta de uma via desta fase.**

**O que a medição de produção mostrou (14-ENSAIO.md):** só `ws_n1` é Espaço real, e nele o CRM antigo tem 1 Funil e nada mais; no CRM novo ele tem 2 Contatos `ativo` e 0 Conversas. Os outros 17 Espaços são resíduo de teste (`ws_outbox_*`, `ws_teste_*`, `ws_spike*`), 16 deles com a mesma semente de demonstração. Total de linhas das nove coleções antigas: 2128 (624 Contatos, 192 Empresas, 480 vínculos Contato-Empresa, 16 vínculos Empresa-Empresa, 16 "distintos de", 66 Funis, 304 Negócios, 80 Canais, 350 Conversas).

**Requisitos derivados** (o ROADMAP mandava derivá-los aqui; os ids são locais da fase, como os UNI da Fase 14, e o planejador os confirma):
- **UNI-04** — nenhuma tela lê o CRM antigo do store (3.4.1 a 3.4.10), com as pendências da Fase 14 tratadas antes (D-15-07).
- **UNI-05** — o script migra o `ws_n1`, guarda os 17 Espaços de teste e a cópia de segurança fica completa (3.5.1, 3.5.2).
- **UNI-06** — o seed não cria CRM antigo e um Espaço novo nasce com o CRM vazio (3.5.3).
- **UNI-07** — o modelo antigo sai do código, salvo o resto de Grupo e Flow (3.5.4).
- **UNI-08** — o cartão e a ficha da Tarefa conversacional voltam a mostrar Empresa, qualificação, estado e Atribuído (D-15-05), e os gestos novos do CRM gravam Registro de Atividade (D-15-09).

</domain>

<decisions>
## Implementation Decisions

### Já decidido na Fase 14 (vale aqui, não foi reaberto)
- **F14-D-01:** o corte é de uma vez, sem ponte entre id antigo e novo. **F14-D-02:** o ensaio é local, com a cópia dos dados reais (sem homologação). **F14-D-03:** nada é apagado de `registros` antes de ficar copiado em `registros_crm_antigo`. **F14-D-04:** só o essencial vem para o modelo novo; Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio somem da tela. **F14-D-05:** Grupo e Flow ficam no modelo antigo até as Sessões 6 e 7 (o modelo antigo não sai por inteiro). **F14-D-06:** as Listas espelho de Meus negócios são aposentadas; "Meus negócios" vira o filtro "meus" do quadro de `/crm/funis/[funil]`, a Lista não ganha `funilId`. **F14-D-07:** criar Tarefa conversacional sem Conversa aberta pede a primeira Mensagem.

### Migração e o dado de produção
- **D-15-01:** **Só o `ws_n1` migra para o CRM novo.** Os 17 Espaços de teste têm as linhas antigas copiadas para `plataforma.registros_crm_antigo` e apagadas de `plataforma.registros`, **sem virar linha no CRM novo**. Nenhum Espaço é apagado. O script ganha um modo "só guardar" além de "migrar" e de `--seco`. Descartados: migrar os 18 iguais (jogaria 304 Negócios e 350 Conversas de teste nas tabelas de produção); apagar os 17 Espaços (é decisão de Espaço, não de CRM). — **Reversibility:** costly — o dado de teste só volta lendo `registros_crm_antigo`.
- **D-15-02:** **A rede de segurança do corte é o backup manual mais a cópia no banco.** Antes do corte: `pg_dump -Fc --schema=plataforma`, restaurado e conferido em Docker (foi assim em 2026-11-05, ver `14-ENSAIO.md` e a memória do projeto). Depois: `registros_crm_antigo` guarda as linhas antigas. **Não se escreve script de desfazer.** As linhas antigas **são apagadas de `registros` no corte**, porque `hidratar()` (`apps/api/src/persistencia/repositorio.ts:96`) carrega qualquer coleção que esteja no banco e as linhas voltariam no `GET /estado`. O backup diário continua desligado (09-18 pulado). — **Reversibility:** one-way — depois do corte o CRM novo recebe dados que o antigo não conhece; voltar é restaurar o backup e perder o que foi criado depois.
- **D-15-03:** **Janela de corte combinada.** O dono avisa a equipe e o corte roda em horário combinado, nesta ordem: backup manual → `npm run migrar -w @n1/api -- --seco` (confirma que nada está pendente, ou só a migração nova se houver) → `npm run migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --seco` (relatório) → o dono aprova o relatório de não migrados (3.5.2) → rodar o script → publicar a API (`publicar.sh`) → web (push para `main` do `n1-tecnologia/crm`). Quem abrir o CRM no meio vê erro por alguns minutos; não há modo manutenção. — **Reversibility:** reversible — é procedimento de deploy.
- **D-15-04:** **O Funil do `ws_n1` é decidido olhando o `--seco`.** O dono não sabe se o único Funil antigo é de verdade ou do seed. O relatório do `--seco` lista o Funil e as Etapas antes de qualquer escrita (3.5.2) e o dono decide. O plano e o script têm de suportar os dois caminhos: migrar como Funil padrão do Espaço, ou só guardar na cópia de segurança e deixar o Espaço sem Funil (D-15-13). — **Reversibility:** costly — migrar um Funil errado deixa Negócios e Etapas a limpar à mão.

### Pendências da Fase 14 e o que volta à tela
- **D-15-05:** **Voltam ao cartão e à ficha da Tarefa conversacional: Empresa, qualificação do Contato, estado da Conversa e Atribuído da Conversa.** O resumo em lote (`POST /tarefas-conversacionais/resumo`) passa a trazê-los; os quatro existem nas tabelas. — **Reversibility:** reversible — é campo do resumo e da tela.
- **D-15-06:** **A temperatura do Contato some até uma sessão própria**, junto com a lista da F14-D-04 (o modelo novo não tem a coluna, e a F14-D-04 não a listava). Fica só em `registros_crm_antigo`. **Sem migração `012` para isso.** Em produção nada se perde (o `ws_n1` não tem Contato antigo). — **Reversibility:** costly — trazer a temperatura depois é uma migração nova e uma tela, mas o dado está na cópia de segurança.
- **D-15-07:** **O primeiro plano da fase trata a dívida da Fase 14 que já está em produção**, antes de as telas novas passarem por esses caminhos: WR-01 (escrita em Contato recém-mesclado sem `for update`), WR-02 (deadlock entre gesto misto e rota REST de Canal), WR-05 e WR-06 (erro 500 ao excluir o sobrevivente de uma mesclagem); trocar `describe` por `describeComBanco` em `apps/api/src/rotas/operacoes.test.ts` (~linha 268; sem `DATABASE_URL` ele abre o banco do `.env`, que é produção); dar entrada em `LER_DO_CRM` ao `instantiateListTemplate` (`packages/dominio/src/operations/planning.ts:364`) antes da 3.5.4. Os demais avisos (WR-03, WR-04, WR-07, WR-08, WR-09 e IN-01 a IN-05) seguem abertos em `14-REVIEW-DISPOSITION.md`. — **Reversibility:** reversible.
- **D-15-08:** **As Conversas do Membro removido passam ao Sucessor** (junto com Contatos, Empresas e Negócios), em vez de ficarem sem Atribuído. Segue o texto original da 3.2.8 e **reverte** a suposição OQ2/A8 da Fase 14 (que seguia RN-ET-09(b)). **O planejador precisa conferir `RN-ET-09(b)` em `ontologia/` e levar a mudança ao contrato se a regra estiver lá**; o gesto `GET /membros/:id/sucessao-no-crm` e o diálogo de remover Membro mudam as contagens. — **Reversibility:** costly — a regra passa a estar no domínio, na rota e no diálogo.
- **D-15-09:** **Os gestos novos do CRM passam a gravar Registro de Atividade** (mover, atribuir, lixeira, restaurar, estrela, leitura, nota, transferir Identificador, consentimento; a mesclagem já grava). Isso pede uma **tabela de Atividade do CRM novo e uma migração `012`**, num plano próprio. A forma da tabela e como a linha do tempo junta as duas fontes ficam para o planejador. Reverte a suposição OQ5 da Fase 14. — **Reversibility:** costly — migração nova e imutável depois de aplicada.
- **D-15-10:** **"Mesclar com…" pede digitar o nome do absorvido**, como o diálogo antigo, antes de liberar o botão (reverte o item 7 de `14-PROVAS.md`). — **Reversibility:** reversible — um campo no diálogo.
- As suposições 1 a 12 de `14-PROVAS.md` que não aparecem acima (colisão de Conversa na mesclagem, última Mensagem da Tarefa, finalidade do consentimento no Catálogo, trocar Canal sempre abre confirmação, tetos de Identificadores, forma da resposta de criar Tarefa, Negócio cujo dono é a Empresa, A1 a A9 da pesquisa) **ficam como estão**.

### Caixa de Entrada e o fio da Conversa
- **D-15-11:** **O descarte de rascunho de resposta (`Draft`) sai do fio até a Sessão 16**, como a 3.4.2 prevê. O modelo novo não ganha rascunho nesta fase. Os rascunhos dos Espaços de teste vão para `registros_crm_antigo`. — **Reversibility:** costly — a Sessão 16 passa a depender de criar o rascunho do zero.
- **D-15-12:** **O popup "adicionar Canal" das Listas conversacionais deixa de criar Canal.** Ele só lista os Canais existentes e leva para `/crm/caixa-de-entrada/configuracoes/canais/conectar`. Um caminho só para criar Canal (nasce `desconectada`, conecta por "Simular conexão"). Fim do caminho legado que gravava Canal `conectada` em `registros`. — **Reversibility:** reversible.

### Espaço novo, seed e demonstração
- **D-15-13:** **Um Espaço novo nasce com o CRM vazio e sem Funil padrão.** Contatos, Caixa e Funis em branco; as telas que usariam o Funil padrão (criar Negócio pela Tarefa, Configurações) mostram "crie seu primeiro Funil". `defaultFunnelId` sai do `Workspace`; o Funil padrão vem de `plataforma.funis.padrao` (3.4.7). A demonstração do CRM existe só para desenvolvimento, pelo comando `bootstrap:crm-demo` da 3.5.3. — **Reversibility:** reversible — é seed e texto de tela.
- **D-15-14:** **O script remove a Pasta "Meus negócios" e as Listas espelho dela quando estiverem vazias.** O `ws_n1` provavelmente já as tem (vêm de `seed-comercial.ts`, em `folders` e `lists`, fora das nove coleções do CRM antigo). Se alguma Lista tiver Tarefa espelho de Negócio, **não apaga** e lista no relatório do `--seco` para o dono decidir. A navegação deixa de oferecer "Meus negócios" para todos os Espaços. — **Reversibility:** costly — recriar a Pasta e as Listas espelho exigiria o `funilId` que a F14-D-06 descartou.

### Claude's Discretion
- A ordem e o corte em planos, desde que: dívida da Fase 14 (D-15-07) primeiro; domínio antes de api antes de tela; o plano da tabela de Atividade (D-15-09) e a migração `012` antes das telas que dependem dela; o script de migração só depois de todas as telas poderem ler o modelo novo; a remoção (3.5.4) por último; deploy só no corte da D-15-03.
- Nomes de rotas e hooks (`dados/crm/conversas.ts`, `dados/crm/mensagens.ts`, `POST /crm/nomes` em lote, `GET /contatos?comIdentificador=`), paginação e filtros de `GET /conversas`, e como as funções de `derive-*` passam a receber linhas como argumento.
- Como reescrever os testes e fixtures que usam `buildSeed()` com o CRM antigo (a web tem 62 arquivos fora de testes; o domínio e a api têm mais), e o formato do `bootstrap:crm-demo` (a 3.5.3 propõe um `.sql` só de dados; um construtor em TypeScript que passe pelos serviços também serve, se não envelhecer a cada migração).
- O que fazer com ids antigos em bookmarks (`/crm/contatos/<id antigo>` mostra "não encontrado", como a 3.4.4): o `ws_n1` não tem Contato antigo, então não vale ponte por `crm_de_para`.
- Como o script reescreve os ids em `links`, `tasks[].provenance.sourceId`, `lists[].canaisDeAtendimento`, `grupos[].canalId`, escopos de Funil e `grants` (3.5.1 passo 9), e o relatório de não migrados (`linkedin`, `chatDoSite`, `perfilDeLinkedIn`, `perfilDeTikTok`, `identificadorDeChatDoSite` não têm destino na 007).
- O texto das telas vazias ("crie seu primeiro Funil") e do diálogo de mesclar, em português de produto.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### O plano desta fase
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` — Sessão 3, tarefas 3.4 (linha ~973) e 3.5 (~1055): cada subtarefa com "Hoje / O que fazer / Pronto quando". Os números de linha do código citados ali deslocaram com as Fases 9 a 14: procurar de novo antes de planejar. A 3.4.5 e a 3.4.3 têm variantes (A/B) já decididas por F14-D-06 e D-15-12; a 3.5.2 fala em homologação, que não existe (ver D-15-03).
- `docs/09-planejamento/dados/` — fonte dos dados da Sessão 3 (o `.md` é gerado por `docs/09-planejamento/gerar.mjs`, nunca editado à mão); `andamento.mjs` registra o que está feito.
- `.planning/ROADMAP.md` — "Phase 15" e "Phase 16".

### Decisões e provas da Fase 14 (herança direta)
- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-CONTEXT.md` — F14-D-01 a F14-D-07.
- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-PROVAS.md` — "O que ficou para a Fase 15", suposições 1 a 12, "O que o corte tira da tela", itens abertos (`instantiateListTemplate`, leituras antigas que ficaram) e provas manuais pendentes de 14-11, 14-15 e 14-16.
- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-ENSAIO.md` — contagens-base por coleção e por Espaço (2128 linhas, 18 Espaços) que o script da 3.5.1 deve conferir.
- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-17-SUMMARY.md` — tabela de quem chama cada leitura antiga da Tarefa conversacional.
- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-REVIEW.md` e `14-REVIEW-DISPOSITION.md` — WR-01 a WR-09 e IN-01 a IN-05 (D-15-07 trata WR-01, 02, 05 e 06).
- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-VERIFICATION.md` e `14-SECURITY.md`.

### Modelo novo do CRM (o destino)
- `apps/api/migracoes/007-crm.sql`, `008-canais-conversas-mensagens.sql`, `011-crm-o-que-faltava.sql` — tabelas aplicadas e imutáveis (a `011` está em produção desde 2026-11-05); qualquer ajuste de schema é a `012` ou posterior.
- `packages/dominio/src/crm/` — as regras do CRM novo (`contatos.ts`, `conversas.ts`, `mensagens.ts`, `negocios.ts`, `funis.ts`, `canais.ts`, `permissoes.ts`, `normalizacao.ts`).
- `apps/api/src/servicos/crm/` e `apps/api/src/rotas/` — serviços, `transacao.ts` (`comTransacao`) e as rotas por recurso (`/contatos`, `/empresas`, `/funis`, `/negocios`, `/canais`, `/conversas`, `/mensagens`, `/tarefas-conversacionais`).
- `apps/api/src/rotas/operacoes.ts` — `LER_DO_CRM` e `AO_CONFIRMAR` (gesto misto).
- `apps/api/src/persistencia/CONTEXT.md` e `unidade-de-trabalho.ts` — `executar()`, `executarGestoMisto`, `lerDoCrm`, e a seção "A ponte dos Canais" que a 3.5.4 reescreve.
- `apps/web/src/dados/crm/` — `contatos.ts`, `canais.ts` e o molde dos hooks/clientes de api da web.

### Modelo antigo (o que será levado e removido)
- `packages/dominio/src/types/crm.ts`, `state.ts`, `colecoes.ts` (`TODAS`), `operations/{contacts,conversations,deals,iniciar-conversa,canais,crm-antigo}.ts`, `operations/registro.ts` (`OPERACOES`), `derive*.ts`, `seed*.ts` (`seed-comercial.ts` tem a Pasta "Meus negócios").
- `apps/api/src/persistencia/canais-projetados.ts`, `rotas/estado.ts`, `rotas/esquemas-de-argumentos.ts`, `repositorios/crm/referencias.ts` (`canalAntigoEmConflito`).
- `apps/web/src/features/crm/legado/`, `deal-screen.tsx`, `restore-copy-dialog.tsx`, `import-contacts-dialog.tsx`, `quadro-negocios.tsx`, `deal-card.tsx`, `iniciar-conversa-dialog.tsx`.

### Regras de negócio e produto
- `ontologia/03-crm/caixa-de-entrada-e-mensageria.md` e `ontologia/03-crm/crm-visao-geral.md` — contrato da Caixa; conferir aqui `RN-ET-09(b)` (D-15-08) e as regras de Registro de Atividade (D-15-09).
- `CONTEXT.md` (raiz) — "Estado atual" (Fases 7, 8 e 14), que a 3.5.4 atualiza.

### Operação de produção
- `apps/api/deploy/publicar.sh` e a memória `deploy-da-api-e-manual-na-vm` — a API é publicada à mão na VM; o `deploy-api` do GitHub falha (VPS_HOST vazio). A web sobe pela Vercel no push para `main`.
- `docs/09-planejamento/dados/andamento.mjs` — entradas 1.7.2 e 1.7.3: sem homologação e sem backup diário.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/dados/crm/contatos.ts` e `canais.ts`: o molde (SWR + cliente de api) para os novos `conversas.ts` e `mensagens.ts`; `criarCanal` (`canais.ts:76`) já cria o Canal `desconectada`.
- `executarGestoMisto` com `lerDoCrm` e `aoConfirmar`: o caminho para gestos que gravam no CRM e em `registros` no mesmo commit (iniciar conversa, sucessão de Membro, Ferramentas).
- `plataforma.crm_de_para` e `plataforma.registros_crm_antigo`: já existem vazias desde a `011`; o script as enche.
- O ensaio da Fase 14 (`14-ENSAIO.md`): Postgres 16 em Docker com 001 a 010, cópia importada por `\copy`, `--seco`, `migrar`, `banco:conceder`, `hidratar` por Espaço. É o molde do ensaio do script da 3.5.1; a cópia dos dados fica em `~/n1-ensaio/` no notebook do dono.
- O backup provado: `pg_dump -Fc --schema=plataforma --no-owner --no-acl`, restaurado e conferido em Docker.

### Established Patterns
- Domínio primeiro, depois a api, depois a tela; o domínio não conhece ninguém e a web e a api nunca se importam.
- Migrações numeradas e imutáveis; a próxima é a `012` (Atividade, D-15-09). `npm run migrar -w @n1/api -- --seco` lista sem escrever.
- Testes de persistência pulam sem `DATABASE_URL` e rodam contra Postgres 16 em Docker local; o `npm test` usa o `.env` de produção e passa dos 600 s, então o gate é `npm run check` em Docker (ver `gsd-gate-de-testes-baseline`). Flakes de baseline: `outbox-worker.test.ts` h a k e `colunas-geradas.test.ts`.
- Cada tela do CRM fala com a api por `src/dados/crm/` (HTTP); o resto do app hidrata o Espaço inteiro por `GET /estado` até a 3.5.4.

### Integration Points
- `GET /estado` e `executar()` projetam os Canais das tabelas em `state.channels` (nunca em `hidratar()`); a 3.5.4 apaga essa ponte, e antes disso o `instantiateListTemplate` precisa de `LER_DO_CRM` (D-15-07).
- `hidratar()` carrega qualquer coleção que esteja em `plataforma.registros`: por isso o corte apaga as linhas antigas (D-15-02).
- A Tarefa conversacional liga Tarefa a Contato, Conversa, Canal e Negócio por Vínculo (`state.links`); o script reescreve os ids antigos em `links` e `tasks[].provenance.sourceId`.
- Grupo e Flow continuam em `Conversation` antigo, isolado num arquivo de tipos (`types/conversa-de-grupo.ts`) até as Sessões 6 e 7; as Ferramentas passam para ids novos só em Contatos e Canais (3.4.8).

</code_context>

<specifics>
## Specific Ideas

- O dono não sabe se o único Funil do `ws_n1` é de verdade: a decisão fica para a leitura do relatório do `--seco`, e o plano precisa de um passo explícito de "dono aprova o relatório" antes de qualquer escrita em produção.
- Tudo é pensado para uma equipe pequena que avisa em horário combinado: sem modo manutenção, sem script de desfazer, sem homologação.
- Decisões em linguagem de produto (o que se vê na tela e o que muda para quem usa), com o código só nos detalhes técnicos.

</specifics>

<deferred>
## Deferred Ideas

- Temperatura do Contato no modelo novo — sessão própria, com Tags, vários Contatos por Negócio com papel, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio (F14-D-04 e D-15-06).
- Rascunho de resposta de Conversa nas tabelas novas — Sessão 16 (D-15-11).
- Conversa de Grupo e Mensagens de Flow nas tabelas novas — Sessões 6 e 7 (F14-D-05).
- Montar a homologação (segundo projeto Supabase) e ligar o backup diário do banco (1.7.1 e 1.7.3) — decisão de infra do dono; o corte desta fase usa o backup manual.
- Modo manutenção durante o corte e script de desfazer a migração — considerados e descartados nesta discussão (D-15-02, D-15-03); reavaliar se o corte de produção mostrar dado real além do `ws_n1`.
- Apagar os 17 Espaços de teste de produção — decisão do dono sobre Espaços, fora do CRM (D-15-01 só guarda as linhas antigas deles).

</deferred>

---

*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Context gathered: 2026-11-05*
