# Phase 14: Unificação do CRM: o modelo novo ganha o que falta e a Tarefa conversacional - Research

**Researched:** 2026-11-04
**Domain:** Postgres relacional (migração 011), serviços Fastify sobre `pg`, transação mista (tabelas do CRM + `plataforma.registros`), regras puras em `@n1/dominio`
**Confidence:** HIGH para o que está no código e nas migrações (tudo lido nesta sessão); MEDIUM para o desenho da 011 e do gesto misto (propostas, não existem ainda); LOW onde marcado `[ASSUMED]`

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- Tags, vários Contatos por Negócio com papel, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio no modelo novo — uma sessão própria, depois (D-04).
- Conversa de Grupo e Mensagens de Flow nas tabelas novas — Sessão 6 (6.6.5) e Sessão 7 (D-05).
- Montar o ambiente de homologação (segundo projeto Supabase, decisão 1.7.1) — fora desta sessão; reavaliar se o ensaio local (D-02) mostrar limite.
- Ligar o backup diário do banco (1.7.3, plano 09-18 pulado) — recomendado antes da migração de produção da Fase 15, mas é decisão de infra do dono.
</user_constraints>

<phase_requirements>
## Phase Requirements

O ROADMAP não mapeia REQ-IDs para esta fase. A convenção do projeto (`EST-01`, `GRV-01`, `TAR-01`...) é prefixo de 3 letras mais número, derivado das subtarefas e das decisões do CONTEXT. Proposta estável para o planejador citar em `requirements:` (17 IDs, um por subtarefa ou grupo coeso; D-01..D-07 entram como restrições, não como IDs):

| ID | Descrição | Subtarefas / decisões | Pesquisa que habilita |
|----|-----------|-----------------------|-----------------------|
| UNI-01 | Decisões do corte registradas e nada novo depende das Listas espelho nem de Grupo/Flow nas tabelas novas | 3.1.1, 3.1.3, 3.1.4 · D-01, D-05, D-06 | Seção "Mapa das subtarefas" (itens 3.1.x); guarda por teste de fonte |
| UNI-02 | Migração `011` com o que o modelo novo não guarda (mesclado, consentimentos, notas, marcações da Conversa, lixeira da Conversa, `crm_de_para`, `registros_crm_antigo`), sem colunas de Grupo/Flow | 3.1.2, 3.1.5 · D-04, D-05 | "Desenho da migração 011" |
| UNI-03 | Ensaio local da `011` com a cópia dos dados reais, contagens-base anotadas, nada apagado de `registros` | D-02, D-03 | "Ensaio local (D-02)" |
| UNI-04 | Gesto misto: gravação nas tabelas do CRM e em `registros` na mesma transação, tudo ou nada | 3.2.1 | "Gesto misto" e Pitfalls 1 a 4 |
| UNI-05 | Mesclar Contatos no modelo novo | 3.2.2 | Mapa 3.2.2; Pitfalls 5 e 6 |
| UNI-06 | Transferir Identificador | 3.2.3 | Mapa 3.2.3 |
| UNI-07 | Registrar e respeitar consentimento | 3.2.4 | Mapa 3.2.4; Pitfall 11 |
| UNI-08 | Mover Conversa para outro Contato | 3.2.5 | Mapa 3.2.5 |
| UNI-09 | Gestos da Caixa na Conversa nova (atribuir, lixeira, restaurar, estrela, leitura, filtros) | 3.2.6 | Mapa 3.2.6 |
| UNI-10 | Notas do Contato nas tabelas | 3.2.7 | Mapa 3.2.7 |
| UNI-11 | Sucessão do Membro removido nas tabelas | 3.2.8 | Mapa 3.2.8 (texto da 3.2.8 está errado para Conversas) |
| UNI-12 | Criar Tarefa conversacional nas tabelas novas (primeira Mensagem quando não há Conversa aberta) | 3.3.1, 3.3.4 · D-07 | "Tarefa conversacional" |
| UNI-13 | Leituras da Tarefa conversacional por ids, sem ler `state.contacts`/`conversations`/`channels`/`deals` | 3.3.2 | Mapa 3.3.2 |
| UNI-14 | Leitura em lote do resumo das Tarefas conversacionais | 3.3.3 | Mapa 3.3.3 |
| UNI-15 | Trocar o Canal da Tarefa pela api | 3.3.5 | Mapa 3.3.5 |
| UNI-16 | Ligar e criar o Negócio da Tarefa pela api | 3.3.6 | Mapa 3.3.6 |
| UNI-17 | Canais de atendimento da Lista conferidos na tabela | 3.3.7 | Mapa 3.3.7; Pitfall 12 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extraídas de `CLAUDE.md` (que importa `CONTEXT.md` e `AGENTS.md`), dos `CONTEXT.md` de camada e da memória do dono. O planejador trata como decisão travada.

- **Dependência:** `packages/dominio` não depende de ninguém; `apps/web` e `apps/api` dependem do domínio e **nunca um do outro**. Mudou o que a coisa é: domínio; como aparece: web; como se guarda ou serve: api. Começar sempre pelo domínio e descer. `[VERIFIED: CONTEXT.md, "A regra de dependência"]`
- **Migrações são imutáveis depois de aplicadas.** A 008 está aplicada; a próxima é a `011` (a 009 e a 010 existem em `apps/api/migracoes/`). Ajuste de schema = migração nova.
- **Toda migração que cria tabela em `plataforma` repete o bloco "desliga RLS" da 009** (event trigger `ensure_rls` do Supabase). `[VERIFIED: apps/api/migracoes/009-seguranca-e-cofre.sql:26-28]`: "TODA migracao FUTURA que criar tabela em `plataforma` repete o bloco de desligar RLS (abaixo) se o `ensure_rls` existir no projeto."
- **Depois do `migrar`, rodar `npm run banco:conceder`** (idempotente; garante DML ao `n1_api`). `[VERIFIED: apps/api/src/persistencia/CONTEXT.md, "npm run banco:conceder"]`
- **Operação nova do registro `OPERACOES` precisa de linha na tabela "Quem pode" de `packages/dominio/CONTEXT.md`** (`quem-pode.test.ts` falha sem ela) e de schema em `apps/api/src/rotas/esquemas/`. Operação fora de `OPERACOES` não é alcançável por HTTP (precedente: `sendMessageSemConferencia`).
- **Rotas são casca** (`apps/api/src/rotas/CONTEXT.md`): sem SQL e sem regra; o Membro atuante é sempre `request.membro`; corpos `.strict()`.
- **Next.js deste repo não é o que o treino conhece** (`AGENTS.md`): quem tocar `apps/web` lê antes `node_modules/next/dist/docs/` (existe: `01-app`, `02-pages`, `03-architecture`, `04-community`). Vale só para as tarefas de tela desta fase.
- **Testes de persistência pulam sem `DATABASE_URL` local** e rodam contra Postgres 16 em Docker; nunca contra o `.env` (produção). Gate `npm test` completo leva 13 a 17 min e tem baseline com falha de rede (`lote-contas-a-pagar (d)`); preferir comandos focados por arquivo. `[VERIFIED: memória do dono gsd-gate-de-testes-baseline]`
- **Deploy da API é manual na VM, só quando o dono mandar.** O que entra em `main` fica "em dia com o que sobe" (memória Fase 13): isso pesa na decisão de quando mesclar a Fase 14 (ver Pitfall 8).
- **Fechar a fase atualizando `docs/09-planejamento/dados/andamento.mjs`** (uma linha por subtarefa; o `.md` é gerado de `parte-c.mjs`, nunca editar à mão) e os `CONTEXT.md` afetados (raiz "Estado atual", `apps/api/src/persistencia/CONTEXT.md`, `packages/dominio/CONTEXT.md`).
- Idioma: pt-BR.

## Summary

Esta fase é, em essência, três coisas: (1) uma migração aditiva (`011`) que dá às tabelas da 007/008 o que só o modelo antigo guarda; (2) onze gestos novos sobre essas tabelas, nove deles sem relação com `plataforma.registros` (mover Conversa, atribuir, estrela, nota...) e dois que **precisam gravar nas duas bases na mesma transação** (mesclar Contatos, e as quatro operações da Tarefa conversacional); (3) uma reescrita das leituras e operações da Tarefa conversacional para trabalharem com ids UUID das tabelas novas. Todo o resto (domínio puro, serviços `comTransacao`, rotas REST por recurso, SWR na tela) já tem molde pronto no repositório. O único mecanismo que **não existe** é a transação mista: `executar()` tem `aoConfirmar` (roda no mesmo `PoolClient`, depois das escritas em `registros`, antes do `commit`) mas **não tem** a opção `lerDoCrm`, e nada junta `comTransacao` a `executar()`.

O que mais muda o plano em relação ao texto da Sessão 3: (a) a 3.2.8 está **errada** para Conversas: `removeMember` **libera** as Conversas atribuídas (apaga o `assignee`), não as passa ao sucessor (RN-ET-09b); (b) a 3.2.2 propõe resolver "a Conversa do absorvido" na colisão, mas a regra da ontologia (RN-CXE-10) e do código antigo é **manter a de Mensagem mais recente**; (c) a 3.1.5 não prevê `lixeira_em` na Conversa, e a tela de Lixeira usa `trashedAt`; (d) a lista de "o que a mesclagem move" da 3.2.2 omite consentimentos, notas, endereços, âncoras de Sessão de Chat, `Participante` jsonb da Conversa, o reapontamento de `mesclado` anteriores e o conflito de `contato_empresa_vigente_uq`/admin da Empresa; (e) a 3.2.5 e a 3.2.7 (diálogo de mover, nota do fio/Reunião) e a 3.3.4 a 3.3.6 (lado web) **ligam telas antigas a ids que só existem depois da migração de dados**, e a 3.4.1/3.4.2 da Fase 15 já descrevem as mesmas trocas: com D-01 (corte de uma vez) isso só pode ir ao ar junto com a Fase 15.

**Primary recommendation:** Planejar em cinco ondas: (1) domínio + `011` + ensaio local; (2) `executar()` com `lerDoCrm` + `gesto-misto.ts` provado "tudo ou nada"; (3) as operações puras da 3.2 e da 3.3 no domínio, com testes; (4) rotas/serviços da api (as de uma tabela só em paralelo; as mistas depois da onda 2); (5) telas só onde a tela já lê o modelo novo (ficha nova de Contato, Canal), deixando o religamento das telas antigas para a Fase 15. As quatro operações da Tarefa conversacional saem de `OPERACOES` (a referência a Contato/Canal/Conversa/Negócio é lida no servidor, nunca vem do navegador) e a mudança só vai a produção junto com a Fase 15.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Regras de mesclagem, mover Conversa, consentimento vigente, atribuição, lixeira (o que é permitido) | Domínio (`packages/dominio/src/crm/`) | — | A tela pré-valida e a api aplica a MESMA função (CONTEXT raiz). |
| Operações que tocam `state.links`, Tarefa, Atividade (reapontar Vínculos, criar Tarefa conversacional) | Domínio (`operations/`, fora de `OPERACOES`) | api (`executar`) | São puras sobre `DataState`; a api as roda dentro da Unidade de Trabalho. |
| Gravar nas tabelas `plataforma.contatos`, `conversas`, etc. | API / Backend (serviços + repositórios) | Banco | Constraints do banco são a rede contra corrida; serviço pré-checa e traduz SQLSTATE. |
| Gravar nas duas bases na mesma transação | API / Backend (`gesto-misto.ts` + `executar`) | Banco | Só o servidor tem a transação; o navegador nunca vê duas bases. |
| Ler Contato/Canal/Conversa/Negócio da Tarefa (resumo em lote) | API / Backend (`POST /tarefas-conversacionais/resumo`) | Banco | O Papel e o Espaço são conferidos no servidor; o navegador manda só ids. |
| Estrela, leitura, atribuição por Membro | Banco (`conversa_marcacoes`, `conversas.atribuido_*`) | API | Por Membro da sessão, nunca do corpo. |
| Diálogo de mesclar, transferir, consentimento, nota | Browser / Client (ficha nova) | — | Só onde a ficha já lê o modelo novo; o resto é da Fase 15. |
| Permissão por Papel (`podeNoCrm`) | Domínio (regra) | API (aplica) | Regra que só a tela conhece é aparência. |

## Standard Stack

Nenhum pacote novo. Tudo já está no monorepo; a fase não instala nada.

### Core
| Library | Versão (já instalada) | Purpose | Why Standard |
|---------|----------------------|---------|--------------|
| `pg` | do `apps/api/package.json` | Cliente Postgres, `PoolClient`, protocolo simples para lote | Já usado por `executar()` e por todos os repositórios do CRM |
| `fastify` + `@fastify/type-provider-zod` + `zod` | idem | Rotas REST por recurso, corpos `.strict()` | Molde de `rotas/crm/*.ts` |
| `vitest` | 5.0.1 (rodou nesta sessão) | Testes nas três camadas | Já configurado (`vitest.config.mts` em cada workspace) |
| `swr` (web) | já em `apps/web` | Hooks `useContato`, `useCanais`... | Molde de `apps/web/src/dados/crm/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `executarGestoMisto` com `lerDoCrm`/`aoConfirmar` (3.2.1) | Estender `comTransacao` para também hidratar `registros` | Duplicaria a trava do Espaço, a revisão, o lote e os eventos de Canal que `executar()` já resolve; descartado. |
| Tirar as 4 operações da Tarefa conversacional de `OPERACOES` | Mantê-las com um 4º argumento `referencias` vindo do navegador | O `args` do navegador é não confiável e o schema `z.tuple` as recusaria; tirar do registro é o que mantém a referência lida no servidor. |

**Installation:** nenhuma.

## Package Legitimacy Audit

Nenhum pacote externo é instalado nesta fase; nada a auditar. **Packages removed due to [SLOP] verdict:** nenhum. **Packages flagged as suspicious [SUS]:** nenhum.

## Architecture Patterns

### System Architecture Diagram

```
 Navegador (Fase 14: só ficha nova de Contato; resto na Fase 15)
   │  REST por recurso (SWR)                     │  POST /operacoes/:nome (store, otimista)
   ▼                                             ▼
 rotas/crm/*  (zod .strict, request.membro)     rotas/operacoes.ts (REGISTRO, SERVICOS)
   │                                             │
   ├─ gestos de UMA base ──────────┐             └─ removeMember: + aoConfirmar (3.2.8)
   │   servicos/crm/*.ts           │                definirCanaisDaLista/createList: + lerDoCrm (3.3.7)
   │   exigir(podeNoCrm) → comTransacao(begin…commit, FRASES de SQLSTATE)
   │   repositorios/crm/*.ts ──────┴──► plataforma.contatos / conversas / mensagens / ... (+ 011)
   │
   └─ gestos MISTOS (mesclar, tarefas-conversacionais/*)
       servicos/crm/gesto-misto.ts  executarGestoMisto(ws, { lerDoCrm, operacao, gravarNoCrm })
         │
         ▼  persistencia/unidade-de-trabalho.ts  executar()
       begin+prazos → trava do Espaço (for update) → hidrata registros → projeta Canais
         → lerDoCrm(cliente)  [NOVO: lê/trava Contato, Canal, Conversa no MESMO cliente]
         → operacao(state, lido)  [domínio puro: Vínculos, Tarefa, Atividade; ou recusa → rollback]
         → update revisão → gravar(registros) → eventos de Canal (outbox)
         → aoConfirmar(cliente, valor, state, lido) = gravarNoCrm  [tabelas do CRM]
         → commit   (erro em qualquer passo = rollback de TUDO; 23505 → 409 com frase do domínio)
```

### Recommended Project Structure
```
packages/dominio/src/crm/
├── contatos.ts          # + validarMesclagem, validarTransferencia, Contato.mescladoEmId, EstadoDoContato
├── consentimentos.ts    # NOVO: consentimentoVigente (+ teste)
├── conversas.ts         # + validarMover, validarAtribuicao, validarLixeira, FiltroDeConversas ampliado
└── permissoes.ts        # (sem ação nova se reutilizar editar/mover/enviar_para_lixeira/restaurar)
packages/dominio/src/operations/
└── tarefa-conversacional-crm.ts   # NOVO (ou in-place em tarefas-conversacionais.ts): ops puras com `referencias`; NÃO entram em OPERACOES
apps/api/migracoes/011-*.sql
apps/api/src/persistencia/unidade-de-trabalho.ts   # + opção lerDoCrm
apps/api/src/servicos/crm/gesto-misto.ts           # NOVO
apps/api/src/servicos/crm/{contatos,conversas,negocios,empresas}.ts  # + métodos novos; conferir `mesclado`
apps/api/src/rotas/crm/tarefas-conversacionais.ts  # NOVO
apps/api/src/repositorios/crm/{consentimentos,notas,marcacoes}.ts    # NOVOS
```

### Pattern 1: serviço de uma base só (molde `ServicoDeConversas.mudarSituacao`)
**What:** `exigir(acesso, membro, acao, recurso)` antes de qualquer leitura, depois `comTransacao(deps.pool, fn, FRASES)`, `obter(..., { travar: true })`, regra de domínio pura, escrita, `recusa(...)` como valor.
**When to use:** mover Conversa, atribuir, lixeira, restaurar, marcação, notas, consentimentos, transferir Identificador.
**Example:** `[VERIFIED: apps/api/src/servicos/crm/conversas.ts:111-137]` (`mudarSituacao`) e `[VERIFIED: apps/api/src/servicos/crm/transacao.ts:40-67]` (`comTransacao`: `begin` → `fn` → `commit`/`rollback`; o `commit` fica dentro do `try` porque o constraint trigger deferido da 007 só roda nele).

### Pattern 2: operação pura fora de `OPERACOES`
**What:** função `(state, actingMemberId, ...)` no domínio que NÃO entra no registro; só o servidor a chama. Precedente `sendMessageSemConferencia` (`[VERIFIED: packages/dominio/CONTEXT.md, "Quem pode"]`: "as variantes `…SemConferencia` (09-03...) não são operações registradas: ficam fora do registro e, por isso, fora da tabela").
**When to use:** mesclar (parte do Espaço), as 4 da Tarefa conversacional (`criarTarefaConversacional`, `trocarCanalDaTarefa`, `vincularNegocioATarefa`, `criarNegocioDaTarefa`). Para tirá-las de `OPERACOES`, mexer em: `registro.ts` (imports `:326-330` e entradas `:674-678`), `esquemas/tarefas-conversacionais.ts` (e seu teste, que confere as 6 chaves), as 4 linhas da tabela "Quem pode" (`CONTEXT.md` do domínio, linhas 311-314), `operations.test.ts` (casos 3959-4250) e `operacoes.test.ts:735-740`.

### Pattern 3: `GET /estado` continua o mesmo
As telas antigas leem o Espaço inteiro por `GET /estado` (`hidratar()` + projeção dos Canais, recortado por `visibilidadePara`). **Nada novo entra em `hidratar()`.** `[VERIFIED: apps/api/src/rotas/estado.ts:34-52]`.

### Anti-Patterns to Avoid
- **Gravar nas tabelas novas por `comTransacao` quando o gesto também muda `state.links`/Tarefa** (duas transações: um gesto meio feito). É o motivo de 3.2.1.
- **Aceitar do navegador qualquer dado que a operação pura confie** (nome do Contato, Canal, ids "conferidos"). Quem confere é o servidor, dentro da transação.
- **Escrever ponte id antigo <-> novo** (D-01). `crm_de_para` é o livro-razão do script da Fase 15, não ponte de leitura.
- **Gravar no store a "Mensagem" da Tarefa conversacional** (a Mensagem vai para `plataforma.mensagens`, nunca para `conversations`).

## Mapa das subtarefas: o que existe, onde, e o que o texto da 3.x supõe errado

Linhas conferidas hoje (as do `.md` deslocaram). Testes = o que cobre o equivalente antigo.

### 3.1 (decisões e migração)
| Sub | Existe hoje | Equivalente/lacuna | Texto da 3.x desatualizado |
|---|---|---|---|
| 3.1.1 | Duas bases; `startConversation` `operations/conversations.ts:733`, `iniciarConversa` `operations/iniciar-conversa.ts:52` | Decisão D-01: nada a codar | "Pronto quando" fala em homologação: vira "011 ensaiada localmente com a cópia" (D-02). `npm run migrar -- --seco` **só lista nomes de arquivo** (`migrar.cli.ts`); quem "conta" é o `--seco` do script da 3.5.1 (Fase 15). |
| 3.1.2 | Avisos de "o que a 007 não guarda" no cabeçalho de `features/crm/ficha-de-contato.tsx` e `ficha-de-negocio.tsx` | Ao entregar mesclar/consentimento/notas, **o cabeçalho e o texto da ficha deixam de listar** Consentimentos, Comentários e mesclagem | — |
| 3.1.3 | `conversaDoGrupo`, `enviosDoFlow`, `respostasDoFlow` em `derive-ferramentas.ts` | D-05: nada na 011; Ferramentas só trocam Contato/Canal por ids novos (Fase 15, 3.4.9) | O ROADMAP da Fase 15 já reflete o resto de `Conversation` (Goal da Fase 15). Nada a ajustar. |
| 3.1.4 | `funilDaLista` `iniciar-conversa.ts:30`; usado também por `features/estrutura/nova-tarefa-conversacional-dialog.tsx:21` | D-06: não portar; **nada novo** pode importar `funilDaLista`/`iniciar-conversa` | Sugestão: teste que lê o código-fonte (padrão `regime-dos-chamadores.test.ts`) e falha se arquivo novo da Fase 14 importar esses símbolos. |
| 3.1.5 | 007/008/009/010 aplicadas; `contatos_estado_ck` não aceita `mesclado` | Ver "Desenho da migração 011" | O item 5 (`webhooks_recebidos` + índice do outbox) é da Fase 16 (3.6.4/3.7.1): recomendo **não** pôr na 011 (migração imutável com tabela sem consumidor). `[ASSUMED]` A1. Faltam `lixeira_em` e índices de `atribuido_id`/`fila_id`. |

### 3.2 (operações que só existem no antigo)
| Sub | Antigo: onde e assinatura | Cobertura de teste | Equivalente no novo / lacuna | Texto da 3.x desatualizado ou incompleto |
|---|---|---|---|---|
| 3.2.1 | `executar<T>(workspaceId, operacao: (state) => OperationResult<T>, opcoes)` `unidade-de-trabalho.ts:323`; `aoConfirmar?: (cliente, valor, state)` `:184` | `unidade-de-trabalho*.test.ts` (fakes) e `-concorrencia`/`-em-lote` (Postgres) | Falta `lerDoCrm` e `gesto-misto.ts` | Ver seção "Gesto misto". |
| 3.2.2 | `mergeContacts(state, actingMemberId, survivorId, absorbedId)` `operations/contacts.ts:150` | `operations.test.ts` (casos em `:727`, `:742`, `:768`, `:1471`, `:4141`), `contacts.test.ts` (matriz de Papel) | Novo: `validarMesclagem` (domínio) + `POST /contatos/:id/mesclar` (gesto misto) | **A regra de colisão é RN-CXE-10: fica a Conversa de Mensagem mais recente e a outra vira `resolvida` ("mesclagem")**, não "a do absorvido" (`ontologia/03-crm/caixa-de-entrada-e-mensageria.md`, RN-CXE-10; `contacts.ts:282`). Omitidos: consentimentos, notas, endereços (`principal:false`), `chatSessions[].anchor`, dedupe de Vínculos, reapontar `mesclado` anteriores (RN-CON-14, sem cadeia), `contato_empresa` (ver Pitfall 5), `participantes` jsonb das Conversas. |
| 3.2.3 | `transferContactIdentifier(state, actingMemberId, fromContactId, identifierId, toContactId)` `contacts.ts:97` | `contacts.test.ts` (Papel); `operations.test.ts` | Serviço novo `transferirIdentificador` sobre `contato_identificadores` (`rebaixarPrincipal` existe em `repositorios/crm/contatos.ts:365`) | O antigo não protege a origem de ficar sem nada; o novo já tem `validarContato` (INV-CON-01) usado em `removerIdentificador` (`servicos/crm/contatos.ts:368`): recomendo reusar na origem. Divergência consciente do antigo: decisão do planejador. |
| 3.2.4 | `ConsentRecord` `types/crm.ts:59`; `marketingConsentMissing(state, conversation, templateProviderId)` `derive.ts:721`; `sendMessage` `conversations.ts:165` | `operations.test.ts` (envio com modelo) | `consentimentoVigente` novo; tabela da 011 | `NovaMensagem` **não tem campo de modelo** e a api passa `modelosAprovados: []` (`servicos/crm/mensagens.ts:119` (`modelosAprovados: [],`), `crm/mensagens.ts:152`): o 409 `SEM_CONSENTIMENTO` só pode ser provado por teste de serviço com modelo injetado; a rota REST não muda até a Sessão 7. Hoje não existe operação que registre consentimento: só o seed. |
| 3.2.5 | `moveConversationToContact(state, actingMemberId, conversationId, toContactId, resolveExisting = false)` `conversations.ts:525` | `conversations.test.ts` (matriz de Papel), `operations.test.ts:50` importa | `POST /conversas/:id/mover` (uma base) | O antigo troca também o Participante principal; **no novo é um jsonb**: reescrever `participantes[]` onde `sujeito.tipo = 'contato'` e `principal`. Resolver a existente usa a mesma regra de "resolvida" (zera `adiada_ate`). Atividade nas duas pontas some (o novo não registra Atividade; ver Open Question 5). |
| 3.2.6 | `assignConversation` `:456`, `trashConversation` `:489`, `restoreConversation` `:687`, `toggleConversationStar` `:821`, `markConversationRead` `:856` | `conversations.test.ts` | Rotas e `conversa_marcacoes` | O antigo marca leitura **por Mensagem** (`internalReads`); o novo guarda `lida_ate` por Membro (a coluna `mensagens.leituras_internas` da 008 existe mas nada a escreve: deixar em paz). Restaurar exige Contato não na lixeira (frase do antigo). A lixeira exige `situacao = 'resolvida'` (`conversas_lixeira_ck`). Falta coluna de quando foi para a lixeira. |
| 3.2.7 | `addContactNote(state, actingMemberId, contactId, content)` `contacts.ts:795` (grava `Comment` com `attachments`/`mentions`) | `contacts.test.ts` (Convidado recusado) | `contato_notas` (`conteudo`, `autor_id`, `criado_em`) | Anexos e menções somem (D-04). Contato `mesclado` e na lixeira recusam nota (frases do antigo). O autor é sempre o Membro da sessão. |
| 3.2.8 | `previewSuccession` `members.ts:23`, `removeMember(state, actingMemberId, memberId, successorId)` `:217` | `members-remocao.test.ts` (8 casos) | `aoConfirmar` em `rotas/operacoes.ts` + `GET /membros/:id/sucessao-no-crm` | **ERRADO para Conversas:** `previewSuccession` as põe em `releases` e `removeMember` faz `delete conversation.assignee` (`members.ts:312`); RN-ET-09(b): "toda Conversa de que é Atribuído são liberados". Nas tabelas: `proprietario_id` de contatos/empresas/negócios passa ao sucessor; `atribuido_tipo/id` das Conversas do removido vira `null`. |

### 3.3 (Tarefa conversacional)
| Sub | Antigo | Cobertura | Novo / lacuna | Desatualizado/incompleto |
|---|---|---|---|---|
| 3.3.1 | `criar` exige a 1ª Mensagem e recusa com 409 `CONVERSA_JA_ABERTA` (`servicos/crm/conversas.ts:158-199`, `jaAberta`) | `conversas.test.ts` (serviço) | D-07: reaproveita a aberta (`abertaDoPar`, `repositorios/crm/conversas.ts:138`); senão pede `mensagem` (400 `VALOR_INVALIDO`, campo `mensagem`) | A 1ª Mensagem de `criar` não passa por `validarEnvio` (a regra de janela só roda em `enviar`); ok porque `ultimaRecebidaEm === null` libera. |
| 3.3.2 | `contatoDaTarefa :70`, `conversaDaTarefa`, `canalDaTarefa`, `negocioDaTarefa`, `ultimaMensagemDaTarefa`, `contatoAlcancado :54`, `canaisDaLista :166`, `canaisDaListaQueAlcancam :175`, `canaisDoFio :218` em `derive-conversacional.ts`; `vinculoRefusal` `tasks.ts:74` | `derive-conversacional.test.ts` (23 casos) | `vinculosDoCrmDaTarefa(state, task)`; `VinculoDeNascimento.alvoConferido` | `contatoDaTarefa` tem um **fallback pelo Contato principal do Negócio** (cobre as Reuniões de Meus negócios): no novo a leitura passa a ser do resumo (`negocios.contato_id`; Negócio de Empresa não tem Contato). `createTask` (HTTP) **não aceita `vinculos`** (`esquemas/tarefas.ts:11-22`): `alvoConferido` não é forjável pelo navegador. `canaisDoFio` (3.4.2) fica para a Fase 15. |
| 3.3.3 | Cartão/tabela/ficha montam do `DataState` | testes web dos cartões | `POST /tarefas-conversacionais/resumo` | "Última Mensagem": a antiga é a mais recente **entre todas as Conversas ativas do Contato no Canal da Tarefa** (`ultimaMensagemDaTarefa`), não só da Conversa vinculada. Para manter o comportamento, o resumo deve juntar por `(contato_id, canal_id)` via `conversas`. O índice de Mensagem é `mensagens_conversa_idx (workspace_id, conversa_id, criado_em, seq)`; sem índice por Canal (200 Vínculos: `lateral` por Conversa basta). |
| 3.3.4 | `criarTarefaConversacional(state, actingMemberId, input)` `tarefas-conversacionais.ts:154`; chamadores `nova-tarefa-conversacional-dialog.tsx:134`, `conversation-thread.tsx:834` | `operations.test.ts:3959-4250`, `operacoes.test.ts:740` (e2e) | `POST /tarefas-conversacionais` via gesto misto | `abrirConversaNoCliente` precisa de `id?` opcional: `LinhaNovaDeConversa` (`repositorios/crm/conversas.ts:28-36`) **não aceita id** e o `insert` usa o default `gen_random_uuid()`. A operação pura precisa do id antes (Vínculo). |
| 3.3.5 | `trocarCanalDaTarefa` `:257` | `operations.test.ts:4055`, `:4151` | `POST /tarefas-conversacionais/:taskId/canal` | Mesma regra de reaproveitar/abrir; `mensagem?` só quando abre. |
| 3.3.6 | `vincularNegocioATarefa` `:311`, `criarNegocioDaTarefa` `:367`, `negocioDoContato :148` | `operations.test.ts:4020-4023` | `…/negocio` e `…/negocio/novo` | `conferirContato` em `servicos/crm/negocios.ts:146-156` só recusa `na_lixeira`: **aceitaria Contato `mesclado`/`arquivado`**; ajustar. Extrair `criarNegocioNoCliente(cliente, membro, entrada)` do `criar` (`negocios.ts:325-395`). |
| 3.3.7 | `definirCanaisDaLista :102`, `validarCanaisDeAtendimento operations/canais.ts:133`, `canalForaDaLista :150`, `nomesDosCanais structure.ts:418` | `canais.test.ts`, `operacoes.test.ts:735` | `canais: readonly Canal[]` | `validarCanaisDeAtendimento` também é chamado por `createList` (`structure.ts:351`), e `canalForaDaLista` por `iniciarConversa` (aposentada por D-06). Ver Pitfall 12 (o 5º argumento vem do navegador). |

## Desenho da migração 011

Convenções das 007/008 `[VERIFIED: 007-crm.sql, 008-canais-conversas-mensagens.sql]`: `workspace_id text not null`, PK `(workspace_id, id)`, `id text default gen_random_uuid()::text`, toda FK entre tabelas do CRM composta `(workspace_id, ...)`, colunas em português, `constraint <tabela>_<regra>_ck`, `create ... if not exists`, trigger `crm_toque_atualizado_em` onde há `atualizado_em`. As duas **não** têm RLS nem `grant` (a 009 fecha o schema e concede DML ao `n1_api` por `alter default privileges`).

Rascunho (nomes sob a discrição de Claude; **o que foi provado**: o SQL abaixo, mais três checagens de constraint, rodou dentro de transação com rollback num `postgres:16` descartável com 001-010 aplicadas `[VERIFIED: execução nesta sessão: "ok: talvez recusado", "ok: mesclado sem alvo recusado", "ok: alvo inexistente recusado"]`):

```sql
-- 011: o que o modelo novo do CRM ganha (Fase 14, D-04/D-05). Só o essencial; sem Grupo nem Flow.
alter table plataforma.contatos add column if not exists mesclado_em_id text;
alter table plataforma.contatos add column if not exists mesclado_em timestamptz;
alter table plataforma.contatos drop constraint if exists contatos_estado_ck;
alter table plataforma.contatos add constraint contatos_estado_ck
  check (estado in ('ativo', 'arquivado', 'na_lixeira', 'mesclado'));
alter table plataforma.contatos add constraint contatos_mesclado_ck check (
  (estado = 'mesclado') = (mesclado_em_id is not null)
  and (mesclado_em_id is null) = (mesclado_em is null)
  and mesclado_em_id is distinct from id);
alter table plataforma.contatos add constraint contatos_mesclado_em_fk
  foreign key (workspace_id, mesclado_em_id) references plataforma.contatos (workspace_id, id);
-- "sem cadeia" (RN-CON-14: o sobrevivente nunca é mesclado) NÃO cabe em constraint simples: é do serviço.

create table if not exists plataforma.contato_consentimentos (   -- só inserção
  id text not null default gen_random_uuid()::text, workspace_id text not null, contato_id text not null,
  finalidade_id text not null,            -- item de Catálogo `finalidadeConsentimento` (fica em `registros`: sem FK)
  tipo_de_canal text not null, decisao text not null, em timestamptz not null, origem text not null,
  evidencia_mensagem_id text, registrado_por text not null, registrado_em timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, contato_id) references plataforma.contatos (workspace_id, id) on delete cascade,
  constraint contato_consentimentos_canal_ck check (tipo_de_canal in ('whatsapp', 'instagram', 'email', 'todos')),
  constraint contato_consentimentos_decisao_ck check (decisao in ('concedido', 'revogado')),
  constraint contato_consentimentos_origem_ck check (origem in ('mensagem', 'formulario', 'verbal', 'importacao', 'automacao')));
create index if not exists contato_consentimentos_contato_idx
  on plataforma.contato_consentimentos (workspace_id, contato_id, finalidade_id, em);

create table if not exists plataforma.contato_notas (
  id text not null default gen_random_uuid()::text, workspace_id text not null, contato_id text not null,
  conteudo text not null, autor_id text not null, criado_em timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, contato_id) references plataforma.contatos (workspace_id, id) on delete cascade,
  constraint contato_notas_conteudo_ck check (length(btrim(conteudo)) > 0));
create index if not exists contato_notas_contato_idx on plataforma.contato_notas (workspace_id, contato_id, criado_em desc);

create table if not exists plataforma.conversa_marcacoes (       -- por Membro (starredBy / leitura)
  workspace_id text not null, conversa_id text not null, membro_id text not null,
  estrela boolean not null default false, lida_ate timestamptz, atualizado_em timestamptz not null default now(),
  primary key (workspace_id, conversa_id, membro_id),
  foreign key (workspace_id, conversa_id) references plataforma.conversas (workspace_id, id) on delete cascade);

create table if not exists plataforma.crm_de_para (
  workspace_id text not null, colecao_antiga text not null, id_antigo text not null,
  tabela_nova text not null, id_novo text not null, migrado_em timestamptz not null default now(),
  primary key (workspace_id, colecao_antiga, id_antigo));
create table if not exists plataforma.registros_crm_antigo (     -- copia só para ler de volta; hidratar() não a conhece
  workspace_id text not null, colecao text not null, id text not null, dados jsonb not null,
  ordem double precision not null default 0, copiado_em timestamptz not null default now(),
  primary key (workspace_id, colecao, id));
```

Valores copiados de fonte (cada um vem de um arquivo aberto nesta sessão): `origem` do consentimento = `"mensagem" | "formulario" | "verbal" | "importacao" | "automacao"` `[VERIFIED: packages/dominio/src/types/crm.ts:59-68, ConsentRecord]`; `decisao` = `"concedido" | "revogado"` e `channelType: ChannelType | "todos"` (mesmo arquivo; a 3.1.5 restringe o tipo de canal a `whatsapp`/`instagram`/`email`/`todos`, igual a `canais_tipo_ck` da 008: `check (tipo in ('whatsapp', 'instagram', 'email'))` `[VERIFIED: 008:45]`).

Acréscimos que a 3.1.5 não lista e a leitura do código pede (recomendação, MEDIUM):
1. `conversas.na_lixeira_em timestamptz` com `check ((estado = 'na_lixeira') = (na_lixeira_em is not null))`: a tela de Lixeira usa `trashedAt` da Conversa (`apps/web/src/app/(shell)/configuracoes/lixeira/page.tsx:141`) e a 008 não guarda quando foi para a lixeira. Se a coluna for adicionada, **o `LinhaDoBancoDeConversa`, `COLUNAS_CONVERSA` e o tipo `Conversa` mudam juntos**.
2. Índices parciais `conversas (workspace_id, atribuido_id) where atribuido_id is not null` e `(workspace_id, fila_id) where fila_id is not null`, para os filtros `atribuidoId` e `filaId` de `GET /conversas`.
3. Bloco "desliga RLS" copiado da 009 (linhas 92-105), porque a 011 cria tabelas.
4. `FRASES_DE_CONTATOS` ganha `contatos_mesclado_em_fk` (excluir permanentemente o sobrevivente com `mesclado` apontando) e as frases do `contato_consentimentos_*`.

Itens a **não** pôr na 011: `webhooks_recebidos` e o índice do evento `mensagem.enviar.v1` (3.1.5 item 5; Fase 16); qualquer coluna de Grupo/Flow (D-05); Tags, vários Contatos por Negócio etc. (D-04).

Obrigações da `011` no repositório:
- `testes/banco-crm.ts` `limparEspaco` deve apagar as tabelas novas (a lista é fixa: `mensagens, conversas, canais, negocios, contato_empresa, empresa_identificadores, empresas, contato_identificadores, contatos, funis` em `banco-crm.ts:80-90`): os `on delete cascade` acima cobrem notas/consentimentos/marcações, mas `crm_de_para` e `registros_crm_antigo` não têm FK e precisam entrar na lista.
- `repositorios/crm/contatos.ts` `COLUNAS` (`:99-101`) e `LinhaDoBanco` ganham `mesclado_em_id`, `mesclado_em`; o tipo `Contato.estado` deixa de ser `EstadoCrm` (compartilhado com Empresa, Negócio e Funil): criar `EstadoDoContato = EstadoCrm | "mesclado"` sem mexer em `ESTADOS_CRM` (que alimenta o `QUERY_LISTA` zod de todos os recursos, `rotas/crm/comum.ts:19`). `GET /contatos` nunca lista `mesclado`.
- Teste novo `apps/api/src/persistencia/migracao-011.test.ts` no molde de `migracao-010.test.ts` (banco descartável com 001-010 aplicadas, a 011 executada pelo texto): `contatos_estado_ck` aceita `mesclado` e recusa `mesclado` sem alvo; `contato_consentimentos` recusa `decisao = 'talvez'`; idempotência do que for idempotente; falha no meio não deixa linha em `plataforma.migracoes`. `migrar-seco.test.ts` já compara com a lista de arquivos da pasta (dinâmica): não precisa de edição.

### Ensaio local (D-02)
Interpretação `[ASSUMED]` A2: na Fase 14 o "ensaio" é **aplicar a 011 sobre uma cópia dos dados reais** (as 7 coleções antigas) e anotar contagens-base; o script de migração dos dados (3.5.1) é da Fase 15. Passos:
1. O dono exporta só as coleções do CRM antigo (`contacts`, `companies`, `contactCompanyLinks`, `companyCompanyLinks`, `distinctFromLinks`, `funnels`, `deals`, `channels`, `conversations`, e as linhas de `workspaces`) com `\copy (select ... from plataforma.registros where colecao in (...)) to arquivo`. `pg_dump` não filtra linhas; por isso `\copy`. `[ASSUMED]` A3 (não rodei contra o banco real).
2. `docker run -d --rm --name crm-n1-pg-14NN -e POSTGRES_PASSWORD=x -p <porta alta>:5432 postgres:16`, `npm run migrar` até a 010 (`DATABASE_URL` e `DATABASE_URL_MIGRACAO` apontando para o contêiner), importar a cópia, `npm run migrar -- --seco` (deve listar só a `011` como pendente), `npm run migrar`, `npm run banco:conceder`.
3. Anotar `select colecao, count(*) from plataforma.registros where colecao in (...) group by 1` antes e depois (as contagens-base que a Fase 15 vai conferir) e rodar `GET /estado` (o `hidratar()` ainda tem de funcionar).
4. `docker rm -f` ao terminar; a cópia fica só no notebook do dono (Discretion do CONTEXT).
`[VERIFIED: executado nesta sessão]` o padrão de contêiner e que os testes com banco rodam: `postgres:16` em `55614`, `DATABASE_URL=$U DATABASE_URL_MIGRACAO=$U npx vitest run src/servicos/crm/conversas.test.ts src/persistencia/migrar-seco.test.ts` deu 2 arquivos, 15 testes passando (o contêiner foi removido). Nome/porta sugeridos: `crm-n1-pg-14NN` na porta `55640+NN`; há um `crm-n1-pg-13` (porta 55613) ainda de pé, da Fase 13: não reutilizar.

## Gesto misto (3.2.1): `executar()` + `aoConfirmar` + `comTransacao`

### O que existe `[VERIFIED: apps/api/src/persistencia/unidade-de-trabalho.ts]`
- `aoConfirmar?: (cliente: PoolClient, valor: T, state: DataState) => Promise<void>` (`:184`): chamado em `:656`, depois de `gravar()` (`:650`) e de `gravarEventos` (`:655`), antes do `commit` (`:659`), no mesmo `cliente`. Erro dentro dele cai no `catch` de `umaTentativa` (`:669-672`): `rollback`, `release(true)` (a conexão é **destruída**), e a exceção sobe.
- A saída em lote de duas idas só vale `if (regime === "travado" && eventos.length === 0 && !opcoes.aoConfirmar)` (`:596`): **qualquer gesto com `aoConfirmar` perde o ganho da Fase 13** e volta a instrução por instrução (`unidade-de-trabalho.test.ts` prova 3 idas com `aoConfirmar`). Aceitável para gestos raros; registrar na medição (`idasEVoltas`).
- Antes da operação: trava do Espaço (`for update` em `plataforma.workspaces`) e leitura; recusa do domínio faz `rollback` e devolve `ok:false` sem gravar (`:556-565`).
- Os Canais da 008 são projetados em `state.channels` depois de hidratar (`:538`) e **tirados** antes de gravar (`semCanaisProjetados`, `:594`), que lança se a operação mudou um projetado.
- `comTransacao` não toca `plataforma.workspaces`; só os serviços de Canal chamam `avancarRevisaoDoEspaco` (`servicos/crm/canais.ts:178,223,248,265`). Gestos de uma base só que não mudam o que `GET /estado` devolve **não** precisam subir a revisão.

### Proposta `[ASSUMED]` A4 (desenho; a 3.2.1 já o descreve)
1. `executar` ganha `lerDoCrm?: (cliente: PoolClient) => Promise<L>`; roda **depois** de projetar os Canais e **antes** de `operacao` (entre `:538` e `:553`), no mesmo `cliente`. Tipos: `executar<T, L = undefined>`, `operacao(state, lido)`, e `aoConfirmar(cliente, valor, state, lido)` (argumentos extras no fim: compatível com os chamadores atuais). Não adicionar campo novo a `MedicaoDaExecucao` (os testes de medição enumeram os campos); `idasEVoltas` já conta tudo pelo proxy.
2. `gesto-misto.ts`: `executarGestoMisto(workspaceId, { lerDoCrm, operacao, gravarNoCrm }, frases)`. Se `lerDoCrm` recusa (404/409 com status), guardar a recusa em variável do fechamento e fazer `operacao` devolver `fail(frase)` para `executar` desfazer limpo (`desfecho: "recusou"`); depois mapear de volta ao status HTTP. Assim a recusa continua "valor", não exceção.
3. Em `lerDoCrm`, **travar** (`for update`) as linhas de que `gravarNoCrm` depende, em ordem determinística de id (mesclar A em B e B em A ao mesmo tempo: sem a ordem, deadlock `40P01`). A trava do Espaço vem antes de tudo (já é assim), e nenhum serviço novo chama `avancarRevisaoDoEspaco` (evita a inversão de ordem de locks Espaço/linha de Canal).
4. Ids novos (`randomUUID`) gerados em `lerDoCrm`/antes da operação; `repositorios/crm/conversas.ts` `inserir` precisa aceitar `id?`.
5. `gravarNoCrm` pré-checa o que dá frase rica e deixa o `SQLSTATE` como rede: no `catch` de `executarGestoMisto`, `traduzirErroDePg(erro, frases)` (`transacao.ts:25`: `23505`, `23503`, `23514` com `constraint` conhecido) vira 409; qualquer outro sobe. Como o erro chega por exceção, a conexão sai do pool (`release(true)`): não usar exceção como fluxo normal.
6. A resposta da rota deve ter o mesmo recorte de visibilidade de `POST /operacoes/:nome`: `visibilidadePara`, `recortarDiferenca`, `recortarValor`, `maiorIdDe(depois)` (`rotas/operacoes.ts`, bloco final). Extrair isso para um helper compartilhado em vez de copiar (Pitfall 4).
7. Prova do "tudo ou nada" (teste da 3.2.1): contra Postgres local, forçar erro em `gravarNoCrm` e contar `plataforma.registros` e `plataforma.conversas` antes/depois (iguais), mais o caso inverso: a `operacao` recusa e `gravarNoCrm` nunca roda; e o caso do `23505` (Conversa aberta concorrente) virando 409.

## Tarefa conversacional (3.3)

- **Como a Tarefa liga hoje:** só por `state.links` (`Link{fromType:"task", toType:"contact"|"conversation"|"deal", role}`), com os papéis `PAPEL_DO_VINCULO = { contato: "contato da Tarefa", conversa: "conversa da Tarefa", negocio: "Negócio da Tarefa" }` `[VERIFIED: packages/dominio/src/derive-conversacional.ts:12-16]` e `LinkTargetType = "task" | "contact" | "company" | "deal" | "conversation" | ...` `[VERIFIED: types/primitives.ts:108-117]`. A Tarefa não tem campo de Contato/Conversa/Negócio; o Canal vem da Conversa; a Subtarefa lê a raiz. Com ids UUID nada disso muda no tipo (`toId: Id` é string), só deixa de existir o registro em `state.*` para conferir.
- **Quem mais cria Vínculo para `contact` em `registros`** e por isso também sente a mesclagem e a troca de id: Contas a receber (`operations/financeiro.ts:1746`, `:1868`, `seed-contas-a-receber.ts:356`, `operations/importacao-contas-a-receber.ts:262`) e Meus negócios (`iniciar-conversa.ts:131-132`). A mesclagem do modelo novo tem de reapontar **todos** os Vínculos com `toType`/`fromType = "contact"` e o absorvido (como `mergeContacts` faz, `contacts.ts:172`, `:231-241`), não só os da Tarefa conversacional.
- **D-06:** `criarTarefaConversacional` não pode depender de `funilDaLista`; o diálogo atual a importa (`nova-tarefa-conversacional-dialog.tsx:21`).
- **D-07 / INV-CXE-05:** o serviço decide: `abertaDoPar` → reaproveita (sem Mensagem); senão exige `mensagem.conteudo` (reaproveitar `validarNovaConversa`, `crm/conversas.ts:102-111`, que recusa Mensagem vazia com `field: "conteudo"`) e abre pela função extraída `abrirConversaNoCliente(cliente, membro, entrada, id?)`.
- **Operação pura:** `criarTarefaConversacional(state, membro, input, referencias)` com `referencias = { contato:{id,nome}, canal:{id,nome,conexao,...}, conversaId, negocio? }`. Mantém as recusas atuais (Lista conversacional, `listaSemCanais`, `listWriteRefusal`, Canal da Lista, Canal `desconectada`, `createTask` com `vinculos` e `alvoConferido: true`). Remove `contactDisplayName(contact)` do estado: usa `referencias.contato.nome`. Desfaz `tasks/links/activity` se `createTask` recusa (como hoje, sem `conversations`).
- **Deploy (Pitfall 8):** o diálogo da Lista e o botão do fio hoje passam por `run()` (otimista, `OPERACOES`). Fora de `OPERACOES`, a web chama a rota REST e **re-hidrata** (`rehidratar()` do store; o `GET /estado` traz a Tarefa nova). Alternativa: a rota devolve o mesmo envelope de `POST /operacoes` e o store ganha um método para aplicá-lo. Recomendo re-hidratar (rara, simples, sem tocar o store). `[ASSUMED]` A5.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transação do CRM com tradução de erro | `begin/commit` à mão | `comTransacao` + `FrasesDeRestricao` (`transacao.ts`) | O `commit` dentro do `try` é o que faz o constraint trigger deferido da 007 virar 409. |
| Transação mista | Segunda transação "compensatória" | `executar()` com `lerDoCrm` + `aoConfirmar` | Já tem trava do Espaço, revisão, eventos de Canal e `rollback`. |
| Permissão por Papel | `if (papel === ...)` na rota | `exigir(acesso, membro, acao, recurso)` + `podeNoCrm` | A matriz é única; o 403 tem frase. Sem ação nova no matriz: mesclar/transferir/nota/consentimento = `editar` em `contato`; atribuir/marcar = `editar` em `conversa`; mover = `mover` em `conversa`; lixeira = `enviar_para_lixeira`; restaurar = `restaurar`. `[VERIFIED: packages/dominio/src/crm/permissoes.ts, AcaoCrm]` |
| Recorte por Membro da resposta | Devolver o `DataState`/diff cru | `visibilidadePara` + `recortarDiferenca` + `recortarValor` | Tarefa oculta vazaria na resposta (PRIV-03). |
| Normalizar Identificador | Regex própria | `normalizarIdentificadorDeContato` (`crm/normalizacao.ts`) | Já é a forma canônica gravada. |
| Reapontar Vínculos na mesclagem | Reescrever a lógica | Extrair o trecho de `mergeContacts` (`contacts.ts:172`, `:223-249`, com dedupe pelo mais antigo) para uma função pura reusada | Mesmas regras de INV-CON-07 e RN-CON-14; duas cópias divergem. |
| Frases de erro de integridade | `error.message` do Postgres | `FRASES` por nome de constraint | Nunca expor o nome do constraint (T-07-06). |

**Key insight:** o repositório já tem molde para cada peça; o trabalho novo real é a 011, o `lerDoCrm`, e o cuidado com o que o texto da 3.x supõe errado.

## Common Pitfalls

### Pitfall 1: `aoConfirmar` destrói a conexão e some o ganho da Fase 13
**What goes wrong:** gesto misto com erro previsível (unicidade) lançado de `gravarNoCrm` descarta a conexão do pool e faz sete idas; sob carga esgota o pool (10 conexões).
**How to avoid:** pré-checar no `lerDoCrm` (com `for update`); deixar o `SQLSTATE` só como rede de corrida; medir `idasEVoltas`.
**Warning signs:** linha `"gravacao medida"` com `idasEVoltas` > 5; `desfecho: "excecao"`.

### Pitfall 2: Deadlock entre mesclagens e entre o Espaço e linhas de Canal
**What goes wrong:** `mesclar(A,B)` e `mesclar(B,A)` simultâneos travam as linhas em ordem oposta; o REST de Canal trava a linha do Canal e depois `avancarRevisaoDoEspaco`, enquanto o gesto misto trava o Espaço e depois lê o Canal.
**How to avoid:** `for update` por ordem de id; não chamar `avancarRevisaoDoEspaco` em serviço novo; o gesto misto lê o Canal sem travar (só precisa de existência/estado) ou o trava depois do Espaço.

### Pitfall 3: Recusa vista como exceção
**What goes wrong:** `lerDoCrm` que lança 404 vira 500 e destrói a conexão.
**How to avoid:** devolver valor e converter em `fail()` na `operacao` (item 2 da proposta).

### Pitfall 4: Resposta sem recorte de visibilidade
**What goes wrong:** a rota nova devolve a Tarefa criada/o diff sem `visibilidadePara`; Membro sem acesso à Lista vê a Tarefa.
**How to avoid:** helper compartilhado com `rotas/operacoes.ts`; teste de vazamento no molde de `testes/espaco-de-vazamento.ts`.

### Pitfall 5: Mesclar quebra índices e triggers da 007/008
**What goes wrong:** (a) `contato_empresa_vigente_uq` `[VERIFIED: 007:219-220]` "create unique index if not exists contato_empresa_vigente_uq on plataforma.contato_empresa (workspace_id, contato_id, empresa_id) where fim is null": mover os vínculos do absorvido colide se o sobrevivente já está na mesma Empresa; (b) o constraint trigger deferido `empresa_exige_admin` (`[VERIFIED: 007:286-289]` `create constraint trigger contato_empresa_exige_admin ... deferrable initially deferred`) falha no `commit` se o absorvido era o único admin e o vínculo é encerrado em vez de repassado; (c) `contato_identificadores_principal_uq` `[VERIFIED: 007:121-122]` (um principal por tipo por Contato): rebaixar os principais movidos antes do `update`; (d) `conversas_nao_resolvida_uq` `[VERIFIED: 008:117-119]` "on plataforma.conversas (workspace_id, contato_id, canal_id) where situacao in ('aberta', 'pendente') and estado = 'ativo'": resolver a perdedora (RN-CXE-10) **antes** de mover; (e) `conversas.participantes` é jsonb com o Contato principal: reescrever; (f) `negocios.contato_id` + `negocios_dono_ck` `[VERIFIED: 007:418]` "check (num_nonnulls(empresa_id, contato_id) = 1)": só trocar o id.
**How to avoid:** para (a) e (b): se o sobrevivente já tem vínculo vigente com a Empresa, funde (admin = admin OU admin) e encerra/descarta o duplicado do absorvido na mesma transação; testar o caso "absorvido era único admin".

### Pitfall 6: `Contato.estado` ganha `mesclado` e vários `if` ficam errados
**What goes wrong:** `conferirContato` (`servicos/crm/negocios.ts:149`) e `servicos/crm/empresas.ts:222` só recusam `na_lixeira`: aceitariam Negócio/vínculo com Contato `mesclado`. `contatoInativo()` (`servicos/crm/contatos.ts:165`) diz "Restaure o Contato antes de editar" (errado para `mesclado`). `restaurar`/`arquivar`/`excluirPermanentemente` (`contatos.ts:383-426`) precisam recusar `mesclado` ("somente leitura"). A ficha (`ciclo-de-vida.tsx`) tem de tratar o 4º estado.
**How to avoid:** grep de `estado ===`/`!==` em `servicos/crm/*.ts` como item de checklist; um teste por serviço para `mesclado`.

### Pitfall 7: `INV-CON-01` e `RN-CON-14` fora do banco
**What goes wrong:** transferir o último Identificador deixa Contato sem nome nem Identificador; mesclar um Contato cujo sobrevivente já é `mesclado` cria cadeia.
**How to avoid:** `validarContato` na origem; `validarMesclagem` recusa qualquer `mesclado` nos dois lados, e a mesclagem reaponta os `mesclado` anteriores ao novo sobrevivente (`contacts.ts:251`).

### Pitfall 8: Entregar a Fase 14 sozinha quebra a Tarefa conversacional e as telas antigas
**What goes wrong:** D-01 proíbe ponte. Depois da 3.3.2/3.3.4 as Tarefas conversacionais antigas (ids `cnt_*`, `cnv_*`) deixam de resolver Contato/Conversa; o diálogo de mover (3.2.5) e as notas do fio/Reunião (3.2.7) chamariam rotas com ids que só existem após a migração de dados; a 3.4.1/3.4.2 da Fase 15 já descreve as mesmas trocas (duplicidade com 3.2.5, 3.2.7, 3.3.4).
**How to avoid:** (a) tudo aditivo de api/domínio/011 pode ir sozinho (rotas novas, funções novas); (b) a troca dos chamadores web antigos e a remoção das 4 operações de `OPERACOES` entram **no mesmo deploy da Fase 15**; (c) no plano, marcar essas tarefas de tela como "religar na Fase 15" ou executá-las em ramo único com a 15. Decisão do dono: Open Question 1.

### Pitfall 9: `registros_crm_antigo` guarda dado pessoal
**What goes wrong:** a cópia dos dados reais (ensaio) e a tabela de cópia de segurança têm nome, telefone, e-mail e mensagens.
**How to avoid:** a cópia local fica só no notebook, contêiner com `docker rm -f`; `registros_crm_antigo` nunca é lida por rota nem por `hidratar()`, entra no escopo do backup, e nunca é apagada na Fase 14 (D-03).

### Pitfall 10: Hidratar não pode ver as tabelas novas
`hidratar()` carrega as coleções de `registros`; o CRM novo chega por REST. Não somar `contato_*` a `GET /estado`. E o que a operação pura precisa das tabelas chega por `lerDoCrm`, nunca de um argumento do navegador.

### Pitfall 11: Finalidade de consentimento mora em `registros`
`finalidade_id` aponta para item do Catálogo (`seed.ts:220-222` ids `cat_fin_atend`, `cat_fin_trans`, `cat_fin_mkt`, `kind: "finalidadeConsentimento"`, `requiresConsentToSend`). Sem FK; validar a existência lendo `registros` (como `filaAtiva`/`origemAtiva` em `repositorios/crm/referencias.ts`) ou aceitar texto livre e documentar. O modelo de marketing não existe na api até a Sessão 7 (ver 3.2.4 no mapa).

### Pitfall 12: O 5º argumento de `definirCanaisDaLista`/`createList` vem do navegador
**What goes wrong:** a 3.3.7 passa `canais: readonly Canal[]` às funções de validação. O `run()` da web grava as chamadas com os argumentos que ele passou; o servidor recusaria pelo schema (`z.tuple([ID, z.array(ID)])`, `esquemas/tarefas-conversacionais.ts`) e, se aceitasse, confiaria em dado do cliente.
**How to avoid:** `canais` como último parâmetro **opcional** nas operações; o schema aceita-o opcional e a rota o **substitui** pelo que `lerDoCrm` leu (`todos`, `repositorios/crm/canais.ts:280`); sem o argumento, a função usa `state.channels` (projeção ativa até a 3.5.4). `[ASSUMED]` A6 (é desenho, não existe).

### Pitfall 13: Perder Atividade e `lida`/estrela na troca
O antigo grava `recordActivity` em cada gesto (mover, atribuir, mesclar, nota...). O CRM novo **não registra Atividade** (nenhum arquivo de `servicos/crm`, `repositorios/crm`, `rotas/crm` menciona atividade). Nos gestos mistos a Atividade da parte `registros` continua; nos de uma base só ela some. Decisão: Open Question 5.

## Code Examples

### Aplicar o "tudo ou nada" (esqueleto da proposta, não existe ainda)
```typescript
// Proposta [ASSUMED] — baseada em unidade-de-trabalho.ts:184 (aoConfirmar) e transacao.ts:25 (traduzirErroDePg)
export async function executarGestoMisto<L, T>(
  workspaceId: string,
  gesto: {
    readonly lerDoCrm: (cliente: PoolClient) => Promise<ResultadoCrm<L>>;
    readonly operacao: (state: DataState, lido: L) => OperationResult<T>;
    readonly gravarNoCrm: (cliente: PoolClient, valor: T, lido: L) => Promise<void>;
  },
  frases: FrasesDeRestricao,
): Promise<ResultadoCrm<{ resultado: ResultadoTransacao<T>; depois: DataState }>> {
  let recusaDoCrm: Recusa | undefined;
  try {
    const resultado = await executar<T, ResultadoCrm<L>>(workspaceId, (state, lido) => {
      if (!lido.ok) { recusaDoCrm = lido; return fail(lido.error); }
      return gesto.operacao(state, lido.valor);
    }, {
      lerDoCrm: gesto.lerDoCrm,
      aoConfirmar: async (cliente, valor, _state, lido) => { if (lido.ok) await gesto.gravarNoCrm(cliente, valor, lido.valor); },
    });
    /* mapear conflito → 409, recusaDoCrm → status dela, ok:false do domínio → 409 com a frase */
  } catch (erro) {
    const traduzido = traduzirErroDePg(erro, frases);
    if (traduzido) return { ok: false, ...traduzido };
    throw erro;
  }
}
```

### Teste de "tudo ou nada" (padrão do repositório)
```typescript
// Fonte: apps/api/src/servicos/crm/conversas.test.ts (describeComBanco, novoEspacoDeTeste, semearMembro, semearCanal)
describeComBanco("gesto misto — Postgres local", () => {
  it("erro em gravarNoCrm não deixa linha nova em registros nem em conversas", async () => {
    const antes = { registros: await contar("plataforma.registros", ws), conversas: await contar("plataforma.conversas", ws) };
    await expect(executarGestoMisto(ws, { /* gravarNoCrm: () => { throw new Error("falha forçada"); } */ })).rejects.toThrow();
    expect(await contar("plataforma.registros", ws)).toBe(antes.registros);
    expect(await contar("plataforma.conversas", ws)).toBe(antes.conversas);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tudo do CRM em `registros` (jsonb) | Tabela por entidade, FK composta, constraint por regra | Fases 7 e 8 | A 011 segue esse molde; nada volta a `registros`. |
| `executar()` com 7 idas | 2 idas (lote de entrada e saída) | Fase 13 (`1d0c554`) | Gesto com `aoConfirmar` fica fora do ganho. |
| Conferir Canal em `state.channels` projetado | Canal lido da tabela dentro da transação | 3.3.7 | A ponte `canais-projetados.ts` some só na 3.5.4. |

**Deprecated/outdated:** o `.md` da Sessão 3 cita números de linha de antes das Fases 9 a 13 (ex.: `executar()` em `:116`, hoje `:323`; `aoConfirmar` em `:74`, hoje `:184`; `todos` de Canais em `:268`, hoje `:280`). Procurar o símbolo, não a linha.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Item 5 da 3.1.5 (`webhooks_recebidos`, índice do outbox) fica fora da 011 e entra na migração da Fase 16 | Mapa 3.1.5, 011 | Se o dono quiser tudo numa migração só, a 011 cresce com tabela sem consumidor; sem consequência para a 14. |
| A2 | O "ensaio" da Fase 14 é aplicar a 011 sobre a cópia dos dados reais e anotar contagens; o script de dados (3.5.1) e seu ensaio são da Fase 15 | Ensaio local | Se o dono espera o script ensaiado já na 14, falta a 3.5.1 no escopo (hoje é da Fase 15). |
| A3 | `\copy (select ...)` filtrado é o jeito de tirar só as coleções antigas | Ensaio local | O dono pode preferir outro caminho; só muda o comando. |
| A4 | Desenho de `lerDoCrm`/`executarGestoMisto` (tipos, recusa como valor, travas em ordem) | Gesto misto | Ajuste de tipos na implementação; o requisito "tudo ou nada" não muda. |
| A5 | A web re-hidrata depois da rota REST da Tarefa conversacional em vez de aplicar um diff | Tarefa conversacional | Se o dono quiser a Tarefa aparecendo "na hora", o store precisa de método novo (custo extra). |
| A6 | `canais` como argumento opcional final, substituído pelo servidor | Pitfall 12 | Outra forma (campo no estado) muda o schema e o store. |
| A7 | `contato_notas` e `contato_consentimentos` com `on delete cascade` e sem FK para o Membro/Mensagem | 011 | Política de retenção/LGPD diferente (reter consentimento depois de excluir o Contato) pede `restrict`. |
| A8 | Em Conversas, a sucessão do Membro removido **libera** (`null`), não transfere | Mapa 3.2.8 | Se o dono quiser transferir ao sucessor, é decisão nova que diverge de RN-ET-09(b). |
| A9 | Reusar `editar`/`mover`/`enviar_para_lixeira`/`restaurar` do `AcaoCrm` sem ação nova | Don't Hand-Roll | Se o dono quiser Papel distinto para mesclar, `permissoes.ts` e seus testes mudam. |

## Open Questions

1. **A Fase 14 pode ir ao ar sozinha?**
   - O que sabemos: D-01 (corte de uma vez, sem ponte); a 3.3.2/3.3.4 quebram a leitura de Tarefa conversacional com ids antigos; a 3.4.1/3.4.2 repetem as trocas da 3.2.5/3.2.7/3.3.4.
   - O que falta: se o dono mescla a 14 em `main` (a `main` espelha o que sobe) antes de a 15 estar pronta.
   - Recomendação: tudo aditivo (011, rotas, domínio novo, ficha nova de Contato) pode ir; a remoção das 4 operações de `OPERACOES` e a troca dos chamadores antigos vão no mesmo deploy da 15. Levar ao dono.
2. **Texto da 3.2.8 (Conversas).** Liberar (`null`) ou passar ao sucessor? Recomendação: liberar (RN-ET-09b, `members.ts:312`); registrar como divergência do `.md`.
3. **Colisão de Conversa na mesclagem.** Recomendação: RN-CXE-10 (fica a de Mensagem mais recente); a 3.2.2 diz o contrário.
4. **`lixeira_em` na Conversa.** Recomendação: incluir na 011.
5. **Atividade no CRM novo.** Nenhum serviço novo grava Registro de Atividade. Aceitar a perda por ora (nas telas novas de Contato/Conversa) ou criar tabela de Atividade (escopo à parte)? Recomendação: aceitar e registrar em `andamento.mjs`.
6. **Última Mensagem da Tarefa:** por Conversa vinculada ou por (Contato, Canal) como hoje? Recomendação: como hoje.
7. **Origem da finalidade de consentimento:** validar contra o Catálogo em `registros` ou texto livre? Recomendação: validar (uma consulta).
8. **O que é "pronto" para as telas na Fase 14?** Recomendação: ficha nova de Contato (mesclar, transferir, consentimentos, notas) e nada nas telas antigas.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Postgres 16 local dos testes e do ensaio | ✓ (daemon respondendo, `docker ps`) | 29.3.1 | — |
| `postgres:16` (imagem) | testes de persistência, 011, ensaio | ✓ (subiu em 55614 nesta sessão) | 16 | — |
| Node | tudo | ✓ | v24.14.0 | — |
| Cópia dos dados reais do CRM antigo | ensaio D-02 | ✗ (é do dono) | — | Ensaiar com seed e dizer que não prova o dado real (D-02 descarta como substituto) |
| `psql` no host | `\copy` do dono | `[ASSUMED]` | — | `docker exec ... psql` |

**Missing dependencies with no fallback:** a cópia dos dados reais (ação do dono, bloqueia só o ensaio D-02, não o resto da fase).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.1 nas três camadas `[VERIFIED: saída do vitest nesta sessão: "RUN  v5.0.1"]` |
| Config file | `packages/dominio/vitest.config.mts`, `apps/api/vitest.config.mts`, `apps/web/vitest.config.mts` (web: `environment: "node"`, jsdom por comentário no arquivo `.tsx`) |
| Quick run (domínio) | `cd packages/dominio && npx vitest run src/crm src/derive-conversacional.test.ts src/operations/contacts.test.ts src/operations/conversations.test.ts src/operations/members-remocao.test.ts src/quem-pode.test.ts && npx tsc --noEmit` (os 6 primeiros: 14 arquivos, 801 testes passando, rodado nesta sessão) |
| Quick run (api, sem banco) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run <arquivos> && npx tsc --noEmit` (rodado: `src/servicos/crm/conversas.test.ts src/rotas/crm/conversas.test.ts src/persistencia/unidade-de-trabalho.test.ts` = 2 passam, 1 pula; 31 passam, 12 pulam) |
| Quick run (api, com banco) | contêiner `postgres:16` + `DATABASE_URL=postgres://postgres:x@localhost:<porta>/postgres DATABASE_URL_MIGRACAO=<igual> npx vitest run <arquivos>` (rodado em 55614) |
| Quick run (web) | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados src/features/crm` |
| Full suite | `npm run check` com as duas URLs no Docker migrado (cerca de 3 min; baseline em memória). `npm test` direto leva 13-17 min e fala com o `.env`: **não usar como gate**. |

Pulam sem `DATABASE_URL` local (`describeComBanco`, `testes/banco-crm.ts`): todos os testes de `servicos/crm/*`, `repositorios/crm/*`, `persistencia/*` com banco, `rotas/*` que usam o banco real. Rotas com serviço injetado falso (padrão `rotas/crm/*.test.ts`) rodam sem banco.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UNI-01 | Nada novo importa `funilDaLista`/`iniciar-conversa`; sem coluna de Grupo/Flow na 011 | unit (lê o código) | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/migracao-011.test.ts` | ❌ Wave 0 |
| UNI-02 | `contatos_estado_ck` aceita `mesclado`; consentimento recusa `decisao='talvez'`; RLS desligada | integração (Docker) | `...migracao-011.test.ts` | ❌ Wave 0 |
| UNI-03 | 011 aplica sobre a cópia real; contagens-base | manual (dono) + Docker | passos do "Ensaio local" | ❌ manual |
| UNI-04 | Erro em `gravarNoCrm` não deixa linha; recusa não grava no CRM; 23505 vira 409 | integração (Docker) | `...servicos/crm/gesto-misto.test.ts`; unit com fake em `persistencia/unidade-de-trabalho.test.ts` (nova `lerDoCrm`) | ❌ Wave 0 |
| UNI-05 | `validarMesclagem`; mesclar move Identificadores/Conversas/Negócios/vínculos; colisão de Conversa; único admin | unit + Docker | `packages/dominio ... src/crm/contatos.test.ts`; `apps/api ... servicos/crm/contatos-mesclagem.test.ts` | ❌ Wave 0 |
| UNI-06 | Transferência, principal, destino `mesclado`/lixeira recusado | Docker | `...servicos/crm/contatos.test.ts` | ✅ (arquivo existe, casos novos) |
| UNI-07 | `consentimentoVigente` (concedido, revogado depois, "todos") | unit | `packages/dominio ... src/crm/consentimentos.test.ts` | ❌ Wave 0 |
| UNI-08 | Mover com e sem Conversa aberta no destino | Docker | `...servicos/crm/conversas.test.ts` | ✅ (casos novos) |
| UNI-09 | Atribuir, lixeira (só resolvida), restaurar, marcação por Membro, filtros | Docker + rota (falso) | `...servicos/crm/conversas.test.ts`, `rotas/crm/conversas.test.ts` | ✅ (casos novos) |
| UNI-10 | Nota grava linha; Membro da sessão é o autor; `mesclado` recusa | Docker | `...servicos/crm/contatos.test.ts` | ✅ |
| UNI-11 | Remover Membro com 2 Contatos e 1 Negócio deixa com o sucessor; Conversas liberadas | Docker | `...rotas/operacoes.test.ts` (bloco com banco) | ✅ (casos novos) |
| UNI-12 | Tarefa pela Lista grava 1 linha em `conversas` e 0 em `registros` coleção `conversations`; recusa da Tarefa não deixa Conversa; reaproveita a aberta | Docker | `...servicos/crm/tarefas-conversacionais.test.ts` | ❌ Wave 0 |
| UNI-13 | Leituras por ids com estado sem `contacts`/`conversations`/`channels`/`deals` | unit | `packages/dominio ... src/derive-conversacional.test.ts` | ✅ (reescrever) |
| UNI-14 | 1 chamada para 50 Tarefas; id de outro Espaço volta vazio | rota (falso) + Docker | `...rotas/crm/tarefas-conversacionais.test.ts` | ❌ Wave 0 |
| UNI-15, UNI-16 | Trocar Canal; ligar/criar Negócio; Vínculo recusado não deixa Negócio | Docker | `...servicos/crm/tarefas-conversacionais.test.ts` | ❌ Wave 0 |
| UNI-17 | Com projeção desligada, marcar Canal novo funciona e id inexistente é recusado | Docker | `...rotas/operacoes.test.ts` | ✅ (casos novos) |

### Sampling Rate
- **Per task commit:** quick run da camada tocada (domínio; api sem banco; web `tsc` + `src/dados`).
- **Per wave merge:** os arquivos com banco da onda no contêiner Docker (`crm-n1-pg-14NN`), mais `npx tsc --noEmit` nas três camadas.
- **Phase gate:** `npm run check` no Docker migrado (as duas URLs apontando para ele), repetindo uma vez se `outbox-worker.test.ts` oscilar (baseline conhecida: confira `docker exec <c> date` contra `date`).

### Wave 0 Gaps
- [ ] `apps/api/src/persistencia/migracao-011.test.ts` — UNI-01, UNI-02 (molde `migracao-010.test.ts`)
- [ ] `apps/api/src/servicos/crm/gesto-misto.test.ts` — UNI-04
- [ ] `apps/api/src/servicos/crm/tarefas-conversacionais.test.ts` e `rotas/crm/tarefas-conversacionais.test.ts` — UNI-12, 14, 15, 16
- [ ] `packages/dominio/src/crm/consentimentos.test.ts` — UNI-07
- [ ] casos novos em `unidade-de-trabalho.test.ts`/`-trava.test.ts` para `lerDoCrm` (fake de cliente)
- [ ] `testes/banco-crm.ts` `limparEspaco`: acrescentar `crm_de_para` e `registros_crm_antigo` (e conferir as tabelas com cascade)
- [ ] reescrever `derive-conversacional.test.ts` e os casos 3959-4250 de `operations.test.ts`; ajustar `esquemas/tarefas-conversacionais.test.ts` (6 chaves hoje) e `quem-pode.test.ts` (4 linhas a menos, se as 4 saírem de `OPERACOES`)
- [ ] Framework install: nenhum.

## Security Domain

`security_enforcement` está ligado (`.planning/config.json`: `security_asvs_level: 1`, `security_block_on: "high"`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (herdado) | Hook de JWT do Supabase já aplica; `request.membro` resolvido |
| V3 Session Management | no | idem |
| V4 Access Control | yes | `exigir(podeNoCrm)` antes de qualquer leitura/escrita; Espaço sempre de `membro.workspaceId`; id de outro Espaço = 404; `GET /membros/:id/sucessao-no-crm` só para Administrador/Proprietário ativo (não há `RecursoCrm` "membro": conferir `ehAdministracao` à mão) |
| V5 Input Validation | yes | zod `.strict()` nas rotas; domínio valida forma (`validarNovaConversa`...); nunca aceitar `workspaceId`, `autor`, `estado` do corpo |
| V6 Cryptography | no | nada novo (o cofre da 009 não é tocado) |
| V8 Data Protection | yes | `registros_crm_antigo`, notas e consentimentos têm dado pessoal: nunca logar `conteudo` (T-08-29), nunca expor em `GET /estado`; cópia local do ensaio só no notebook do dono |
| V13 API | yes | REST por recurso, 409 com frase sem nome de constraint |

### Known Threat Patterns for Fastify + pg + Postgres

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: id de Contato/Conversa/Canal/Negócio de outro Espaço na Tarefa conversacional, no resumo em lote, na mesclagem | Information disclosure / Tampering | Todo `where` leva `workspace_id = $1`; resumo ignora ids de outro Espaço (teste da 3.3.3) |
| Referência forjada na Tarefa conversacional (nome do Contato, "alvo conferido") | Tampering | Operações fora de `OPERACOES`; `referencias` e `alvoConferido` só do servidor; `createTask` HTTP não aceita `vinculos` |
| Mass assignment (corpo com `estado`, `atribuido`, `autorId`, `mescladoEmId`) | Tampering | Corpos `.strict()`; autor, atribuído por padrão e Membro da marcação vêm da sessão |
| Vazamento de Tarefa oculta na resposta da rota mista | Information disclosure | `visibilidadePara` + recortes na resposta (Pitfall 4) |
| Corrida entre pré-checagem e escrita (Conversa aberta duplicada, Identificador duplicado) | Tampering | `for update` no `lerDoCrm` + índices únicos + `traduzirErroDePg` |
| Consentimento adulterado ou apagado | Repudiation | Só inserção (nenhum método de `update`/`delete` no repositório, só cascata do Contato); `registrado_por` e `registrado_em` da sessão |
| SQL injection | Tampering | Parâmetros `$n`; nenhum nome de coluna vindo do cliente (filtro `q` de título como parâmetro) |
| Papel suspenso escrevendo | Elevation | `recusarSuspensoNaEscrita` herdado em `rotasDeCrm`; `POST /operacoes` tem `recusaDeSuspenso` |
| Operação de sucessão sem conferir quem pede | Elevation | `removeMember` já exige Administrador/Proprietário ativo (`members.ts:223-229`); o `aoConfirmar` só roda depois do `ok` do domínio |

## Sources

### Primary (HIGH confidence) — lidos nesta sessão
- `apps/api/migracoes/007-crm.sql`, `008-canais-conversas-mensagens.sql`, `009-seguranca-e-cofre.sql`, `010-carga-e-bloqueio-da-lista.sql`, `001-plataforma.sql`, `002-registros-colunas-geradas.sql`
- `apps/api/src/persistencia/unidade-de-trabalho.ts`, `migrar.ts`, `migrar.cli.ts`, `canais-projetados.ts`, `CONTEXT.md`
- `apps/api/src/servicos/crm/{transacao,conversas,acesso,resultado,mensagens,contatos,negocios}.ts`, `repositorios/crm/{conversas,referencias,contatos}.ts`, `rotas/crm/{index,comum,contatos,conversas}.ts`, `rotas/operacoes.ts`, `rotas/estado.ts`, `rotas/esquemas/tarefas-conversacionais.ts`, `testes/banco-crm.ts`
- `packages/dominio/src/crm/{conversas,contatos,mensagens,permissoes}.ts`, `operations/{contacts,conversations,members,tarefas-conversacionais,canais,tasks,iniciar-conversa,registro,index}.ts`, `derive-conversacional.ts`, `derive.ts` (`marketingConsentMissing`), `types/crm.ts`, `types/primitives.ts`, `colecoes.ts`, `CONTEXT.md`
- `ontologia/03-crm/{caixa-de-entrada-e-mensageria,contatos}.md` (RN-CXE-10, RN-CXE-11, RN-CON-14, INV-CON-07), `ontologia/01-espaco-de-trabalho/espaco-de-trabalho.md` (RN-ET-09)
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` Sessão 3 (3.1 a 3.5), `.planning/ROADMAP.md` (Fases 14 a 16), `.planning/config.json`
- Execuções: vitest (domínio e api sem banco), Postgres 16 em Docker (testes com banco; rascunho da 011 com 3 constraints verificados em transação com rollback)

### Secondary (MEDIUM)
- Memória do dono: baseline do gate de testes, deploy manual, Fase 13 (2 idas)

### Tertiary (LOW)
- Nenhuma fonte externa consultada: a fase é toda em código do repositório; não houve pesquisa web nem de documentação de biblioteca.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhum pacote novo; molde existe para cada peça.
- Architecture: MEDIUM — `lerDoCrm`/`gesto-misto` e a 011 são propostas coerentes com o código lido, ainda não construídas.
- Pitfalls: HIGH para 1 a 7, 10 e 13 (lidos no código e nas migrações); MEDIUM para 8, 9, 11 e 12 (dependem de decisão do dono ou de desenho).

**Research date:** 2026-11-04
**Valid until:** 2026-11-18 (o código da Fase 13/15 pode mover linhas; procurar o símbolo de novo antes de editar)
