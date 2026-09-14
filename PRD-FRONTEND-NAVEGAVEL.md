# PRD-MESTRE — DO MAPA DE UX AO FRONTEND NAVEGÁVEL

Versão 2.0 — 2026-09-10 — Fonte de verdade conceitual: `ontologia/` (v1.0, 21 documentos aprovados conceitualmente)

Este documento governa as fases 2 a 6 do roteiro do projeto. Cada fase produz um entregável em arquivo, é revisada e só é encerrada com aprovação explícita do usuário. Uma fase não começa antes de a anterior ser aprovada. Recomenda-se **uma sessão por fase**; se várias fases forem executadas na mesma sessão, o ponto de aprovação entre elas é obrigatório mesmo assim.

```text
FASE 1 — ONTOLOGIA ................................. concluída (ontologia/)
FASE 2 — MAPA / MANUAL DE UX ....................... docs/02-mapa-ux/
FASE 3 — FUNDAÇÃO DO FRONTEND ...................... app/ (projeto) + docs/03-fundacao/
FASE 4 — WIREFRAMES DOS FLUXOS ..................... docs/04-wireframes/
FASE 5 — DESIGN SYSTEM + DIREÇÃO VISUAL ............ docs/05-design-system/ + app/src/design/
FASE 6 — GERAÇÃO DO FRONTEND / TELAS ............... app/ completo
```

O resultado final (fase 6) é um frontend completo, limpo e navegável, com dados fictícios em memória, pronto para ser apresentado como se fosse lançado. Sem backend, sem integrações reais, sem IA real, sem comentários, sem texto de preenchimento.

---

## PARTE I — REGRAS QUE VALEM EM TODAS AS FASES

### I.1 A ontologia é a fonte de verdade

Toda fase começa lendo, nesta ordem: `ontologia/README.md`; `ontologia/DECISOES-E-PENDENCIAS.md` seções A e B; `ontologia/GLOSSARIO.md`; os documentos do domínio em trabalho (especialmente seções 6, 8–9, 11–13, 17, 18 e 22); `ontologia/MATRIZ-DE-RELACOES.md`.

Regras de fidelidade:

- **Nomes**: rótulos de interface usam exatamente os termos do glossário, em pt-BR. Sinônimos da terceira coluna são proibidos (nunca "owner", "deal", "pipeline", "dashboard", "workspace", "task", "inbox", "skill", "tool").
- **Estados**: a interface distingue estado de ciclo de vida (`ativo`, `arquivado`, `na lixeira`), Status de Tarefa (personalizável, com categoria fixa), Etapa de Funil, situação do Negócio (`aberto`, `ganho`, `perdido`) e estado de Conversa (`aberta`, `pendente`, `resolvida`). Nunca no mesmo controle.
- **Cardinalidades**: seletor único para 0..1 ou 1, múltiplo para 0..N. Responsáveis de Tarefa 0..N (Membro ou Agente — B7); Proprietário exatamente 1 Membro; Empresa do Negócio 0..1; Contatos do Negócio 0..N com papel.
- **Propriedade × associação**: contenção é hierarquia de navegação; associação é a seção "Vínculos" do registro, nunca uma pasta.
- **Regras visíveis**: o que a ontologia rejeita, a interface impede e explica em palavras (Subpasta em Subpasta; Subtarefa além da Profundidade máxima; ganho sem valor quando o Funil exige).
- **Atores**: toda ação registrada mostra quem fez (Membro, Agente, Automação, Sistema) e em nome de quem, quando houver (A6.2).
- **Sem invenção**: conceito que uma tela pareça exigir e a ontologia não tenha vai para `docs/PENDENCIAS-FRONTEND.md` com a alternativa adotada. Nenhuma entidade nova.

### I.2 Regras de trabalho

- Ler `~/.claude/rules/ui-ptbr.md` e `~/.claude/rules/ux-flows.md` antes de qualquer tela; `~/.claude/rules/nextjs.md` a partir da fase 3, resolvendo a versão instalada antes de aplicar orientação específica.
- Código, identificadores e commits em inglês; strings visíveis em pt-BR.
- Nada de `TODO`, `FIXME`, comentário narrativo, `console.log`, lorem, imagem quebrada.
- Cada fase termina com revisão pelos subagentes `critic` (comportamento, regras, integridade) e, quando houver interface, `flow-critic` (fluxos completos). Achados resolvidos ou aceitos por escrito no relatório da fase.
- Cada fase termina com `docs/NN-*/RELATORIO.md`: o que foi entregue, evidência (comandos e resultados), achados das revisões, o que ficou pendente. O usuário aprova lendo o relatório e o entregável.

### I.3 Contexto fictício compartilhado

Um único Espaço de Trabalho: **"Auton Health"**, clínica de saúde ocupacional que vende programas corporativos. Membros:

| Membro | Papel | Uso |
| --- | --- | --- |
| Camila Duarte | Proprietário do Espaço de Trabalho | sessão padrão |
| Rafael Nunes | Administrador | Proprietário de Negócios e Automações |
| Júlia Prado | Membro (comercial) | Atendente da Fila Comercial, Proprietária de Contatos |
| Marcos Lima | Membro (operações) | Responsável por Tarefas |
| Beatriz Sales | Convidado | acesso a uma Lista compartilhada |
| Tiago Reis | Membro `removido` | mantém autoria histórica (A6.4) |
| Assistente padrão | Agente | Sessões de Chat |
| "Qualificador SDR" | Agente `supervisionado` | Atribuído em Conversas |
| "Redator de propostas" | Agente `assistido` | invocado em Chat ancorado a Negócio |

### I.4 Decisões já tomadas (reversíveis pelo usuário antes da fase 3)

Next.js App Router + TypeScript estrito + Tailwind; componentes próprios (shadcn/ui copiado para o projeto quando acelerar); dados em memória em `src/data/` com store leve; zod nos formulários; Lucide; Tarefa em painel lateral com opção de página cheia; Negócios em Quadro por padrão; Caixa de Entrada em três colunas; respostas de IA pré-escritas no seed; sessão simulada por escolha de Membro.

Não decidir sozinho: nome comercial e marca; paleta e tipografia finais (fase 5 propõe, usuário aprova); qualquer conceito fora da ontologia.

---

## PARTE II — AS FASES

## FASE 2 — MAPA / MANUAL DE UX

**Pergunta que a fase responde:** onde cada entidade da ontologia vive na interface, como se chega até ela e o que o usuário pode fazer em cada lugar?

**Entradas:** ontologia completa; Parte I deste PRD.

**Entregáveis** (`docs/02-mapa-ux/`):

1. `MAPA-DE-NAVEGACAO.md` — casca da aplicação (barra superior, navegação lateral que reproduz a árvore aprovada A2.1, com CRM, IA e Painéis como domínios pares — A2.2) e o **mapa de rotas** completo: rota, tela, entidades exibidas, ações, documento da ontologia que a rege. Ponto de partida: a tabela da seção II.6 abaixo.
2. `PADROES-TRANSVERSAIS.md` — padrões que toda tela obedece: cabeçalho de registro (nome, estado de ciclo de vida como selo, Criador/Proprietário, menu de ações), aba Atividade (Registros de Atividade com ator e delegante), seção Vínculos, Comentários (autor Membro/Agente/Automação, respostas de um nível, menções), Tags, Campos personalizados por escopo (A5.2), Lixeira com restauração ao estado anterior (B43), confirmações para ações irreversíveis e externas, feedback de toda ação, estado vazio de toda lista, permissões simuladas visíveis ao trocar de Membro (B20).
3. `INVENTARIO-DE-TELAS.md` — uma ficha por tela: propósito, entidades e atributos exibidos (conferidos contra a seção 6 do documento), estados representados (seção 11), ações e as regras que a interface faz valer (seção 13), cardinalidades dos controles (Matriz), estado vazio, permissões. Ponto de partida: a seção II.8 abaixo.
4. `FLUXOS.md` — os dez fluxos ponta a ponta (seção II.10) descritos passo a passo, tela por tela, com o que muda nos dados e o que a interface mostra em cada passo, mais os fluxos de erro (ação impedida por regra).
5. `MATRIZ-COBERTURA.md` — tabela entidade × tela: cada uma das entidades dos 21 documentos (inclusive as internas: Identificador de Contato, Etapa, Participante, Execução, Versão, Fragmento, Widget) aparece em pelo menos uma tela ou é declarada "não exibida" com motivo.

**Critérios de pronto:** cobertura 100% na matriz; toda rota tem ficha; todo fluxo é percorrível só com as telas do inventário; nenhum termo fora do glossário; revisão `critic` (fidelidade à ontologia) e `flow-critic` (fluxos sem beco sem saída) executadas; `RELATORIO.md` escrito.

**Aprovação:** o usuário aprova o mapa de rotas, os padrões e os fluxos. A fase 3 só começa depois.

---

## FASE 3 — FUNDAÇÃO DO FRONTEND

**Pergunta:** o esqueleto técnico sustenta todas as telas do mapa sem reinterpretar a ontologia?

**Entradas:** fase 2 aprovada; `~/.claude/rules/nextjs.md`, `stability.md`, `testing.md`.

**Entregáveis:**

1. Projeto `app/` criado e rodando (`npm run dev`), com `typecheck`, `lint` e um teste mínimo verdes.
2. `app/src/data/types.ts` — um tipo por entidade, derivado das seções 6 e 11 de cada documento. Regras: todo registro tem `id`, `workspaceId`, `createdBy: ActorRef`, `createdAt`, `lifecycle`, `lifecycleBeforeTrash?` (B36/B43); `Task` com `parentTaskId`/`rootTaskId` (B1), `statusId` → `StatusDefinition.category`, `assignees: ActorRef[]`, `checklists` como componente (B2); `Contact` com `identifiers` (B13), `companyLinks` com papel, principal e vigência (B8); `Deal` com `companyId?`, `contactLinks`, `funnelId`, `stageId`, `situation`, `stageHistory` com ordem à época; `Conversation` com `contactId`, `channelId`, `state`, `assignee?`, `queueId?`, `messages`, `draft?`; `Agent` com `autonomy`, `skillGrants`, `collectionGrants`, `allowedTools`, `version`, `executions`; `Automation` com `scope`, `trigger`, `conditions`, `actions`, `version`; `ActivityRecord` com `actor`, `delegate?`; `ActorRef = {kind: 'member'|'agent'|'automation'|'integration'|'system', id}`.
3. `app/src/data/seed.ts` — dados fictícios completos conforme a tabela II.7, coerentes entre si e com os exemplos conceituais (seção 22) da ontologia.
4. `app/src/data/store.ts` — store em memória com as operações que os fluxos exigem (criar/editar/mover Tarefa com Mapeamento de status; mover Negócio com Requisitos de Etapa; ganhar/perder; enviar Mensagem; resolver/reabrir Conversa; mesclar Contato; aprovar Solicitação; publicar Automação; remover Membro com Sucessor), cada operação gerando Registros de Atividade e validando as regras da ontologia com mensagens em pt-BR.
5. Casca da aplicação: layout com barra superior, navegação lateral (árvore da Estrutura expansível + domínios), roteamento de todas as rotas do mapa respondendo com o cabeçalho correto (conteúdo pode ser placeholder de fase, sem texto de preenchimento visível: usar o estado vazio real).
6. `docs/03-fundacao/ARQUITETURA.md` — organização de pastas, convenções, como o store valida regras, como trocar o Membro logado, como os tipos mapeiam para os documentos da ontologia.

**Critérios de pronto:** todas as rotas navegáveis pela casca; seed carrega sem erro; testes das operações do store cobrindo as regras críticas (Mapeamento de status obrigatório, Requisito de Etapa, ganho sem valor, Subpasta em Subpasta, profundidade máxima, mesclagem, sucessão); `critic` executado; `RELATORIO.md`.

**Aprovação:** o usuário aprova a arquitetura e a amostra de dados (a casca já dá para navegar).

---

## FASE 4 — WIREFRAMES DOS FLUXOS

**Pergunta:** antes de gastar esforço em componentes reais, o layout de cada tela sustenta os fluxos?

**Entradas:** fases 2 e 3 aprovadas.

**Entregáveis** (`docs/04-wireframes/`):

1. `WIREFRAMES.html` — página única, em baixa fidelidade (cinzas, sem tipografia final, sem cor de marca), publicada como artefato para comentários, com um esboço por tela do inventário (mínimo: Início, Espaço, Lista nas quatro Visualizações, Tarefa, Contatos e ficha, Empresas e ficha, Negócios Quadro e ficha, Funil, Caixa de Entrada, Chat, Agente, Habilidade, Automação editor, Conhecimento, Aprovações, Painel, Configurações de Membros, Busca). Cada esboço mostra zonas, hierarquia, controles e estados (vazio, com dados, ação impedida).
2. `FLUXOS-WIREFRAME.html` (pode ser a mesma página com âncoras) — os dez fluxos como sequência de esboços ligados, incluindo o passo de erro de cada um.
3. `DECISOES-DE-LAYOUT.md` — decisões tomadas e alternativas rejeitadas (painel lateral versus página; três colunas na Caixa de Entrada; posição dos Vínculos; onde vive o Mapeamento de status), com o motivo em uma frase.

**Critérios de pronto:** toda tela do inventário tem esboço; todo fluxo tem sequência; `flow-critic` executado sobre os esboços (dead ends, ações sem feedback, confirmações ausentes); `RELATORIO.md`.

**Aprovação:** o usuário comenta o artefato; ajustes; aprovação. A fase 5 só começa depois.

---

## FASE 5 — DESIGN SYSTEM + DIREÇÃO VISUAL

**Pergunta:** qual identidade visual as telas terão e quais componentes garantem consistência?

**Entradas:** fase 4 aprovada; nome e marca do produto (fornecidos pelo usuário) ou provisórios declarados.

**Entregáveis:**

1. `docs/05-design-system/DIRECAO-VISUAL.md` — duas propostas de direção (paleta de 5–6 cores nomeadas, par tipográfico, densidade, tom), cada uma com uma tela real renderizada (a Lista com Tarefas, com dados do seed) como artefato. O usuário escolhe uma.
2. `app/src/design/tokens.css` (ou equivalente) — cores (base neutra com viés para o acento; acento único; cores semânticas separadas para categorias de status, situação de Negócio, estado de Conversa, estados de Execução; cor por domínio na navegação), tipografia (interface + monoespaçada para identificadores; escala fixa), espaçamento em escala de 4 px, raios, sombra, tema claro e escuro por tokens.
3. Componentes base implementados e documentados em `docs/05-design-system/COMPONENTES.md` com uma página de amostra (`/design`, removível no fim): botão (primário, secundário, perigoso, fantasma), campo, seletor único e múltiplo com busca, chip e selo de estado, tabela com cabeçalho fixo e rolagem horizontal, quadro com colunas roláveis, painel lateral, diálogo de confirmação, toast, estado vazio, menu de ações, avatar por tipo de ator (Membro, Agente com marca distinta, Automação, Sistema), editor de texto rico simples, linha do tempo de Atividade, seletor de Status por categoria, seletor de Etapa.
4. Acessibilidade: foco visível, contraste AA verificado, navegação por teclado em listas e quadros, `prefers-reduced-motion`.

**Evitar:** hero decorativo, gradientes, emoji como ícone, sombra em todo cartão, os padrões genéricos de interface gerada.

**Critérios de pronto:** direção aprovada; todos os componentes base existem, com tema claro e escuro; a tela de amostra usa só tokens; `critic` sobre acessibilidade e consistência; `RELATORIO.md`.

**Aprovação:** o usuário escolhe a direção e aprova os componentes. A fase 6 só começa depois.

---

## FASE 6 — GERAÇÃO DO FRONTEND / TELAS

**Pergunta:** o produto está completo, limpo e navegável como se fosse lançar?

**Entradas:** fases 2 a 5 aprovadas.

**Entregável:** `app/` completo. Ordem de construção com checkpoint por domínio (o usuário pode aprovar domínio a domínio):

| Etapa | Telas | Fluxos que passam a funcionar |
| --- | --- | --- |
| 6.1 Estrutura | Espaço, Pasta/Subpasta, Lista (4 Visualizações), Tarefa completa, Configurações de Lista | 1, 2, 3 |
| 6.2 CRM | Contatos, Empresas, Negócios (Quadro, Tabela, ficha), Funis | 4, 6 |
| 6.3 Mensageria | Caixa de Entrada e configurações | 5 |
| 6.4 IA | Chat, Agentes, Habilidades, Automações, Conhecimento, Aprovações | 7, 8 |
| 6.5 Painéis e Configurações | Painéis, Configurações do Espaço de Trabalho, Busca, Lixeira, Auditoria, Início, Entrar | 9, 10 |
| 6.6 Polimento | estados vazios, confirmações, feedbacks, tema escuro, teclado, remoção de `/design`, revisão final | todos |

Ao fim de cada etapa: conferir contra o documento da ontologia (seção 6 exibida? seção 11 representável? seção 13 aplicada?), `critic` + `flow-critic`, checkpoint.

**Critérios de pronto (Definição de Pronto final):**

- [ ] Todas as rotas do mapa alcançáveis pela navegação, sem link morto.
- [ ] Os dez fluxos funcionam sem erro no console.
- [ ] Nenhuma string visível em inglês; nenhum sinônimo não canônico.
- [ ] Nenhum `TODO`, comentário narrativo, `console.log`, texto de preenchimento, imagem quebrada.
- [ ] Matriz de cobertura da fase 2 satisfeita na implementação.
- [ ] Cardinalidades respeitadas nos controles.
- [ ] Toda ação irreversível ou externa confirma; toda ação dá feedback; toda lista tem estado vazio.
- [ ] Tema claro e escuro íntegros.
- [ ] `typecheck`, `lint` e testes verdes; sem `any` sem justificativa.
- [ ] `docs/PENDENCIAS-FRONTEND.md` atualizado (pode estar vazio).
- [ ] `critic` e `flow-critic` finais executados e resolvidos.
- [ ] `docs/06-telas/RELATORIO.md` com evidência.

---

## PARTE III — MATERIAL DE REFERÊNCIA PARA AS FASES

O conteúdo abaixo é o ponto de partida das fases 2 e 6. A fase 2 deve validá-lo, corrigi-lo e expandi-lo contra a ontologia; não é definitivo.

### II.5 Casca da aplicação

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Barra superior: seletor do Espaço de Trabalho · busca global (/)     │
│                 · notificações · avatar do Membro (trocar sessão)    │
├───────────────┬─────────────────────────────────────────────────────┤
│ Início        │  Conteúdo da rota                                   │
│ ESTRUTURA     │  cabeçalho do registro + abas / Visualizações       │
│  ▸ Espaço     │                                                     │
│    ▸ Pasta    │                                                     │
│      ▸ Lista  │                                                     │
│ CRM           │                                                     │
│  Contatos · Empresas · Negócios · Funis · Caixa de Entrada          │
│ IA            │                                                     │
│  Chat · Agentes · Habilidades · Automações · Conhecimento           │
│ PAINÉIS       │                                                     │
│ Configurações │                                                     │
└───────────────┴─────────────────────────────────────────────────────┘
```

### II.6 Mapa de rotas (ponto de partida)

| Rota | Tela | Documento(s) |
| --- | --- | --- |
| `/entrar` | Escolher Membro para simular sessão | 01 |
| `/` | Início: minhas Tarefas, Conversas atribuídas, meus Negócios, Aprovações pendentes | 06, 12, 14, 17 |
| `/estrutura` | Espaços | 02 |
| `/estrutura/espacos/[espaco]` | Espaço: Pastas, Listas diretas, configurações e herança | 02 |
| `/estrutura/pastas/[pasta]` | Pasta ou Subpasta | 03, 04 |
| `/estrutura/listas/[lista]` | Lista: Visualizações Lista, Quadro, Calendário, Tabela | 05 |
| `/estrutura/listas/[lista]/configuracoes` | Conjunto de Status efetivo, Definições de Campo, Funcionalidades, Automações | 05, 02 |
| `/estrutura/tarefas/[tarefa]` | Tarefa | 06, 07, 08 |
| `/crm/contatos`, `/crm/contatos/[contato]` | Contatos | 10 |
| `/crm/empresas`, `/crm/empresas/[empresa]` | Empresas | 11 |
| `/crm/negocios`, `/crm/negocios/[negocio]` | Negócios: Quadro por Etapa, Tabela, ficha | 12, 13 |
| `/crm/funis`, `/crm/funis/[funil]` | Funis e Etapas | 13 |
| `/crm/caixa-de-entrada`, `/crm/caixa-de-entrada/configuracoes` | Caixa de Entrada; Canais e Filas | 14 |
| `/ia/chat`, `/ia/chat/[sessao]` | Sessões de Chat | 16 |
| `/ia/agentes`, `/ia/agentes/[agente]` | Agentes | 17 |
| `/ia/habilidades`, `/ia/habilidades/[habilidade]` | Habilidades | 18 |
| `/ia/automacoes`, `/ia/automacoes/[automacao]` | Automações e Execuções | 19 |
| `/ia/conhecimento`, `/ia/conhecimento/[colecao]`, `/ia/conhecimento/documentos/[documento]` | Coleções, Fontes, Documentos | 20 |
| `/ia/aprovacoes` | Solicitações de Aprovação | 17, 19 |
| `/paineis`, `/paineis/[painel]` | Painéis e Widgets | 21 |
| `/configuracoes/...` | Geral, Membros, Equipes, Papéis, Tags, Campos do CRM, Catálogos, Templates, Integrações, Lixeira, Auditoria | 01 |
| `/buscar?q=` | Busca global | transversal |

### II.7 Volume mínimo do seed

| Entidade | Quantidade | Observações |
| --- | --- | --- |
| Espaços | 3 | "Comercial", "Operações clínicas", "Marketing" (privado) |
| Pastas / Subpastas | 4 / 2 | |
| Listas | 7 | duas diretas em Espaço; uma compartilhada com a Convidada |
| Tarefas | ~60 | Subtarefas até 3 níveis, Checklists com Subitens, Comentários de Membro e Agente, Registros de Tempo, Dependências, uma recorrente, uma `arquivada`, duas `na lixeira` |
| Conjuntos de Status | 3 | sobrescritas em Espaço e em Lista |
| Definições de Campo | 8 | 5 de Tarefa em níveis diferentes (uma bloqueada), 3 do CRM |
| Contatos | 30 | 4 sem Empresa, 2 em duas Empresas, 1 `mesclado`, 1 "não identificado" |
| Empresas | 12 | matriz com 2 filiais; um Vínculo `parceira` |
| Funis | 2 | "Vendas B2B" (padrão, 6 Etapas, Requisitos, Regras de encerramento) e "Pós-venda" |
| Negócios | 25 | 5 `ganho`, 4 `perdido` com Motivo, 1 reaberto |
| Canais | 4 | um por Tipo de Canal; Instagram `desconectado` |
| Filas | 2 | "Comercial" (rodízio), "Suporte" (manual) |
| Conversas | 20 | 8 `aberta`, 4 `pendente` (uma com Adiamento), 8 `resolvida`; Rascunho de IA; uma atribuída a Agente; áudio e imagem; notas internas |
| Agentes | 3 | Execuções em vários estados; uma `aguardando aprovação` |
| Habilidades | 6 | 2 da plataforma; uma com duas versões |
| Automações | 6 | escopos variados; uma híbrida; uma `pausada`; Execuções `falhou` |
| Coleções / Documentos | 3 / 15 | uma privada; texto, PDF, áudio com Representação derivada; um `desatualizado`; Fontes URL e Integração |
| Sessões de Chat | 5 | ancoradas a Negócio e Tarefa; uma com Solicitação de Aprovação |
| Painéis | 3 | Comercial, Atendimento, Operações |
| Registros de Atividade | ~300 | derivados |

### II.8 Especificação das telas (ponto de partida do inventário)

**Início** — Minhas Tarefas (vencidas, hoje, semana), Conversas atribuídas a mim, meus Negócios abertos, Aprovações pendentes.

**Espaço** (02) — cabeçalho; grade de Pastas e Listas diretas (A3.1); aba Configurações com o modo por aspecto (`herdado`, `sobrescrito`, `bloqueado` — B25); "Tornar privado" com aviso (B38).

**Pasta / Subpasta** (03, 04) — mesma tela; Subpasta sem "Nova Subpasta" (A3.4); mover Pasta com Subpastas para dentro de Pasta é impedido.

**Lista** (05) — Caminho efetivo; Visualizações Lista (agrupada por Status, Subtarefas recolhíveis), Quadro (colunas = Conjunto de Status efetivo, cor por categoria), Calendário, Tabela; filtros; criação rápida com Status inicial padrão; Lista sem Status nem Prioridade próprios (B45).

**Tarefa** (06, 07, 08) — Status por categoria; Responsáveis Membro ou Agente (B7); Prioridade; datas; Tipo; Tags; estimativa e Registros de Tempo; Valores de Campo do Caminho efetivo; descrição; Subtarefas até a Profundidade máxima (criação impedida no nível máximo, com motivo); Checklists com Responsável Membro, Subitens, progresso, "Converter em Subtarefa" (B48); Dependências sem ciclo; Vínculos; Anexos; Comentários; Atividade; mover com Mapeamento de status.

**Contatos** (10) — tabela; ficha com Identificadores (B13), Vínculos com Empresas (papel, principal, vigência — B8), Consentimentos, Negócios, Conversas por Canal, Tarefas, Comentários; Mesclar (B14) com o que migra; `mesclado` aponta o sobrevivente.

**Empresas** (11) — Identificadores, matriz e filiais, Vínculos Empresa-Empresa, Contatos com papel, Negócios, Conversas derivadas (só leitura), Sugestão de Vínculo por domínio.

**Negócios** (12, 13) — seletor de Funil; Quadro por Etapa com Requisitos aplicados ao arrastar; abas Ganhos e Perdidos; ficha com ganho (pede valor quando exigido), perda (pede Motivo), reabrir (`ganho` só Administrador — B9), Empresa 0..1, Contatos com papel, histórico de transições com ordem à época, mover de Funil com Etapa obrigatória.

**Funis** (13) — Etapas ordenáveis com probabilidade, Transições permitidas, Requisitos, Regras de encerramento; remover Etapa exige remapeamento; arquivar com Negócios abertos exige migração.

**Caixa de Entrada** (14) — três colunas (Filas e Canais; Conversas com filtros; Conversa aberta com Mensagens por direção, status de entrega, Anexos, compositor Responder/Nota interna, Janela de resposta, Rascunho de IA, atribuir a Membro ou Agente, transferir, `pendente` com Adiamento, resolver, reabrir; painel do Contato com Vínculos a Negócio e "Criar Tarefa a partir da Conversa"); Agente `supervisionado` exige aprovação para responder (B64); configurações de Canais e Filas.

**Chat** (16) — Sessões do Membro; Agente principal trocável; âncora como chip (B83); papéis de Mensagem; Referências de Conhecimento; Arquivos; Restrição de Ferramentas; Solicitação de Aprovação inline.

**Agentes** (17) — abas Configuração (autonomia, Política de aprovação 72 h, Limite de custo), Habilidades (Concessões com versão), Conhecimento, Ferramentas (classe de efeito), Permissões (nunca Administrador), Execuções (origem, invocador, delegante, Passos, Cadeia), Memória, Versões; Assistente padrão sem "Excluir"; restaurar devolve `pausado` (B94).

**Habilidades** (18) — contrato, Ferramentas requeridas, Dependências, versões `rascunho`/`publicada`/`obsoleta`, Agentes que a têm; sem Proprietário.

**Automações** (19) — lista por escopo; editor Gatilho (um) → Condições (inclusive híbrida) → Ações ordenadas (com "invocar Agente" e Aprovador); Política de erro; Publicar com versão; Execuções com filhas.

**Conhecimento** (20) — Coleções (privada, Fontes, Agentes com acesso); Documentos com versões, Proveniência obrigatória, Representação derivada, `desatualizado`, "Execuções que consultaram".

**Aprovações** — solicitante, motivo, objeto, classe de efeito, prazo, aprovador; Aprovar/Recusar.

**Painéis** (21) — Widgets com entidade-alvo do catálogo fechado (B101), escopo, Métricas, Dimensões, Filtros, Período, Momento de referência; números mudam com o Membro (B20); "Fonte sem acesso" sem nome; sem link público.

**Configurações** (01) — Geral, Membros (remover com Sucessor — B28), Equipes, Papéis, Tags, Campos do CRM, Catálogos, Templates, Integrações, Lixeira, Auditoria.

**Busca** — resultados por entidade, respeitando permissões simuladas.

### II.10 Os dez fluxos ponta a ponta

1. Entrar como Camila → Início → Tarefa vencida → Status "Concluído" → Registro de Atividade gerado.
2. Lista → Nova Tarefa → Subtarefa → Checklist com dois Itens → converter um em Subtarefa → progresso atualizado.
3. Mover Tarefa para Lista com outro Conjunto de Status → Mapeamento obrigatório → concluir.
4. Negócios → arrastar para "Proposta" (Requisito: Contato) → impedido → vincular Contato → ok → "Marcar como ganho" pede valor → Negócio vai para "Ganhos".
5. Caixa de Entrada → Conversa com Rascunho de IA → Usar → enviar → status de entrega → resolver → nova Mensagem dentro do prazo reabre a mesma Conversa.
6. Contatos → Suspeita de Duplicidade → Mesclar → absorvido `mesclado`, Conversas migradas.
7. Chat ancorado a Negócio → pedir envio de proposta → Solicitação de Aprovação (Agente `assistido`) → aprovar → Execução `concluída` → Mensagem na Conversa com ator Agente "em nome de Camila".
8. Automações → nova no Funil (Gatilho "entrou em Etapa", Condição "Proposta", Ação "invocar Agente") → Publicar → Execução com Execução de Agente filha na Cadeia.
9. Configurações → remover Marcos → Sucessor → Tarefas sem Responsável, Automações ao Sucessor, histórico preservado.
10. Trocar para a Convidada → só a Lista compartilhada; Painel mostra "Fonte sem acesso".

---

## PARTE IV — COMO ABRIR CADA SESSÃO

Prompt inicial sugerido para cada fase:

> Leia `PRD-FRONTEND-NAVEGAVEL.md` (Parte I inteira e a seção da FASE N) e os entregáveis aprovados das fases anteriores em `docs/`. Execute a FASE N conforme o PRD, respeitando a ontologia em `ontologia/` como fonte de verdade. Não avance para a fase seguinte. Termine com `docs/0N-*/RELATORIO.md` e as revisões `critic`/`flow-critic` exigidas.

O usuário aprova respondendo "fase N aprovada" (com ou sem ajustes); só então a próxima sessão começa.
