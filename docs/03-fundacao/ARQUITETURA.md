# Arquitetura do frontend

**Fase 3 — Fundação técnica.** Este documento descreve a estrutura que sustenta as telas: onde cada coisa mora, por que mora ali, e quais decisões estruturais foram tomadas para que a Fase 6 seja preenchimento e não reconstrução.

Nada aqui inventa conceito. Todo tipo, toda regra e todo rótulo de estado vêm da ontologia v1.0; onde o frontend precisou de algo que a ontologia não define, o item está registrado em `docs/PENDENCIAS-FRONTEND.md` e não em código silencioso.

---

## 1. Stack

Mantida conforme o PRD I.4, sem substituições.

| Peça | Versão instalada | Papel |
| --- | --- | --- |
| Next.js | `16.3.4` | App Router, Turbopack por padrão |
| React | `19.2.8` | — |
| TypeScript | `^5` | modo estrito, endurecido (ver §7) |
| Tailwind CSS | `^4` | via `@tailwindcss/postcss` |
| Zustand | `^5.0.15` | store em memória |
| Zod | `^4.6.1` | validação de entrada externa |
| lucide-react | `^1.44.0` | ícones |
| Vitest | `^5.0.0` | testes das operações |

Fonte: `app/package.json`.

Três consequências da versão 16 que moldaram o código:

1. **`params` é `Promise`.** Toda página dinâmica é Client Component e lê o parâmetro com `use(params)`. Exemplo: `app/src/app/(shell)/estrutura/tarefas/[tarefa]/page.tsx:37`.
2. **`next lint` não existe mais.** O lint roda por `npx eslint src` diretamente.
3. **Nada é cacheado sem opt-in.** Como não há backend nem `fetch`, isso não afeta o protótipo — mas evita o hábito de espalhar `force-dynamic` para combater um cache que não existe.

---

## 2. Mapa de diretórios

```
app/src/
  app/                      rotas (App Router)
    entrar/                 T01 — escolha do Membro que simula a sessão
    (shell)/                tudo o que vive dentro do shell (TopBar + SideNav)
      layout.tsx
      page.tsx              T02 — Início
      buscar/               T48
      notificacoes/         T49
      minha-conta/          T50
      estrutura/            Espaços, Pastas, Listas, Tarefas
      crm/                  Contatos, Empresas, Negócios, Funis, Caixa de Entrada
      ia/                   Chat, Agentes, Habilidades, Automações, Conhecimento, Aprovações
      paineis/
      configuracoes/        governança do Espaço de Trabalho
  data/                     a camada de dados inteira
    types/                  os tipos da ontologia, por documento
    state.ts                DataState, OperationResult, Session
    derive.ts               TODA leitura derivada
    operations/             TODA escrita
    seed.ts                 os dados fictícios
    store.ts                a ponte com React
  features/
    shell/                  primitivas visuais e formatação
    estrutura/              componentes específicos de estrutura
```

A regra de fronteira: **`app/` não calcula nada.** Uma página lê de `derive.ts`, escreve por `operations/` e formata por `features/shell/format.ts`. Se uma página precisou de um cálculo novo, ele nasce em `derive.ts` — porque a mesma pergunta reaparece em outra tela, e duas implementações da mesma derivação divergem.

---

## 3. A camada de dados

### 3.1 Tipos — um arquivo por região da ontologia

| Arquivo | Cobre |
| --- | --- |
| `types/primitives.ts` | `Id`, `Instant`, `CivilDate`, `TaskDate`, `Money`, `ActorRef`, `Lifecycle`, `RecordBase`, `Provenance`, `Link`, `Attachment`, `Comment`, `FieldDefinition`, `FieldValue`, `Tag`, `ActivityRecord` |
| `types/workspace.ts` | `Workspace`, `Member`, `Team`, `Role`, `Grant`, `Integration`, `Locale`, `ImposedLimits`, `Suspension`, `Template`, `CatalogItem`, `UserMemory` |
| `types/structure.ts` | `Space`, `Folder`, `List`, `Task`, `Checklist`, `StatusSet`, `TaskType`, `EnabledFeatures`, `TimeEntry`, `Dependency`, `RecurrenceRule`, `EffectiveListConfig` |
| `types/crm.ts` | `Contact`, `Company`, `Deal`, `Funnel`, `Stage`, `Channel`, `Queue`, `Conversation`, `Message`, `Participant`, `Inbox` |
| `types/ai.ts` | `Model`, `Tool`, `Skill`, `SkillGrant`, `ApprovalRequest`, `AgentExecution`, `Agent`, `ChatSession`, `Automation`, `Collection`, `KnowledgeDocument` |
| `types/panels.ts` | `Panel`, `Widget`, `DataSource`, `Metric`, `Dimension`, `Period` |

**`readonly` é uma declaração de invariante, não decoração.** Quando a ontologia diz que algo é imutável, o campo é `readonly` — e três vezes durante a construção o tipo estava certo e o código errado:

- `Message.conversationId` e `Conversation.channelId` são `readonly` por INV-CXE-04: o Canal de uma Conversa não muda. Um teste tentou reatribuir; o teste é que estava errado.
- `ChatSession.anchor` é um **slot mutável com conteúdo imutável**: B14 reaponta a referência numa mesclagem substituindo o objeto inteiro, nunca editando o `id` de dentro.
- Links de Contato em `mergeContacts` são reapontados por `{ ...link, contactId: survivorId }`, não por mutação do `id`.

A regra que ficou: **quando o tipo diz `readonly` e a vontade é mutar, o tipo costuma estar certo.**

### 3.2 `derive.ts` — nada derivado é armazenado

Toda leitura calculada vive aqui e é recalculada a cada render. Não há campo espelho, não há cache, não há "denormalização para performance": o volume do protótipo não justifica, e um valor derivado armazenado é um valor que pode ficar errado.

As derivações centrais:

- `effectiveLifecycleOfList` / `effectiveLifecycleOfTask` — A4.4: o estado efetivo de um registro é o mais restritivo entre o próprio e o do contêiner. Uma Tarefa `ativo` numa Lista arquivada **é** arquivada, e nenhuma tela pode fingir o contrário.
- `effectiveListConfig` — B25 inteiro. Devolve o Conjunto de Status, as Definições de Campo, os Tipos de Tarefa, as funcionalidades e o caminho. Distingue os dois modos de composição: `statusSet` e `features` **substituem** (o nível mais próximo vence), enquanto `fieldDefinitions` e `taskTypes` **acumulam** ao longo do caminho.
- `isTerminalCategory`, `statusCategory` — A4.3: a categoria do Status, não o nome, é o que decide se a Tarefa está encerrada.
- `isOverdue`, `isBlocked` — condições derivadas: limpam-se sozinhas quando a causa cessa.
- `effectiveProbability`, `weightedValue` — DO-NEG-05: a probabilidade da Etapa, salvo ajuste manual.
- `responseWindowOpenUntil` — a janela de resposta do tipo de Canal, contada a partir da última Mensagem recebida.
- `executionChainOf` — B79: a cadeia completa de uma Execução, da raiz até ela.
- `marketingConsentMissing` — RN-CON-16. Vive aqui, e não dentro de `sendMessage`, porque o compositor precisa ler a MESMA regra para desabilitar o envio antes do clique: uma tela que decide isso por conta própria diverge da operação.

### 3.3 `operations/` — nada é escrito fora daqui

Cada operação recebe `(state, actingMemberId, ...)` e devolve `OperationResult<T>`:

```ts
type OperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly field?: string };
```

**Um erro nunca é lançado através da fronteira.** Ele volta como valor, em pt-BR, dizendo o que aconteceu — e `field` aponta qual campo do formulário está errado, quando há um.

| Arquivo | Operações |
| --- | --- |
| `activity.ts` | `nextId`, `recordActivity`, `memberActor`, `systemActor` |
| `tasks.ts` | `createTask`, `changeTaskStatus`, `assignTask`, `moveTask`, `convertChecklistItem`, `trashTask`, `restoreTask` |
| `deals.ts` | `moveDealToStage`, `winDeal`, `loseDeal`, `reopenDeal`, `linkContactToDeal`, `removeStage` |
| `conversations.ts` | `CHANNEL_CAPABILITIES`, `sendMessage`, `resolveConversation`, `reopenConversation`, `receiveMessage`, `assignConversation`, `trashConversation` |
| `contacts.ts` | `addContactIdentifier`, `transferContactIdentifier`, `mergeContacts`, `endContactCompanyLink`, `trashContact`, `trashCompany` |
| `ai.ts` | `decideApproval`, `publishAutomation`, `restoreAgent`, `restoreAutomation` |
| `members.ts` | `previewSuccession`, `removeMember`, `transferWorkspaceOwnership`, `inviteMember` |

Toda operação que muda algo chama `recordActivity`: A6.2 exige o ator e, quando houver, o delegado ("em nome de"). O nome do objeto é **gravado no registro**, não olhado depois — INV-ET-12 diz que o Registro sobrevive à eliminação do objeto, e um `find` posterior devolveria `undefined`.

### 3.4 `store.ts` — mutação no lugar, revisão incrementada

O grafo do domínio é grande e conectado: um `Contato` aponta para `Empresa`, que aponta para `Negócio`, que aponta para `Conversa`. Clonar isso em profundidade a cada escrita seria caro e frágil.

A escolha: **mutar o grafo no lugar e incrementar um contador `revision`.** `useData(selector)` assina a revisão; qualquer escrita re-renderiza quem lê.

```ts
const state = useData((data) => data);          // lê
const run = useRun();                            // escreve
const result = run((data, memberId) => changeTaskStatus(data, memberId, taskId, statusId));
```

`run` injeta o Membro da sessão, aplica a operação, incrementa a revisão e devolve o `OperationResult` para a tela decidir o que dizer.

O custo consciente: React não detecta a mutação sozinho. Por isso **nenhum componente guarda uma referência a um objeto do estado entre renders** — sempre se lê pelo `id`.

### 3.5 `seed.ts` — volumes do PRD II.7

3 Espaços · 6 Pastas · 7 Listas · ~60 Tarefas · 32 Contatos · 12 Empresas · 25 Negócios · 2 Funis · 4 Canais · 2 Filas · 20 Conversas · 3 Agentes · 6 Habilidades · 6 Automações · 3 Coleções · 15 Documentos · 5 Sessões de Chat · 3 Painéis · 239 Registros de Atividade.

Seis Membros, cobrindo os estados que importam: Camila Duarte (Proprietária), Rafael Nunes (Administrador), Júlia Prado, Marcos Lima, Beatriz Sales (Convidada), Tiago Reis (removido — para provar que a autoria histórica sobrevive).

**O seed obedece às regras.** Durante a Fase 3, dois testes de `sendMessage` falharam: as Conversas abertas tinham a última Mensagem recebida havia 6 dias, fora da janela de 24h do WhatsApp, e RN-CXE-19 recusava o envio livre — corretamente. O defeito era do seed, não da operação, e o seed foi corrigido. **Um teste vermelho não é automaticamente um bug de código.**

---

## 4. As rotas

52 arquivos `page.tsx`. Duas famílias de layout:

- `app/entrar/page.tsx` fica **fora** do shell: escolher o Membro é anterior a ter uma sessão.
- Todo o resto vive em `(shell)/`, que aplica `AppShell` uma vez.

O `AppShell` (`features/shell/app-shell.tsx`) carrega a TopBar e a SideNav. A árvore da SideNav respeita A3.1 e A3.4 (Espaço › Pasta › Subpasta › Lista) e B38e: um contêiner privado que o Membro não pode ver aparece apenas como **nome inerte** dos ancestrais — não é um link que não leva a lugar nenhum, e não some, porque sumir esconderia a estrutura de quem tem direito a saber que ela existe.

### Telas que carregam fluxo real

Estas não são placeholders — operam sobre as operações de verdade:

- **Lista** (`estrutura/listas/[lista]`): quatro Visualizações. O Quadro arrasta e chama `changeTaskStatus`; a recusa aparece como erro em pt-BR, não como silêncio.
- **Tarefa** (`estrutura/tarefas/[tarefa]`): o seletor de Status agrupa por **categoria** (A4.3) e desabilita as categorias terminais quando a Lista já reprova a transição — o motivo é calculado do que está na tela (`terminalBlockReason`), então o controle não espera o clique para falhar.
- **Negócios** (`crm/negocios`): Quadro por Etapa. `ganho` e `perdido` **não são colunas** — B58 diz que toda Etapa é de progressão, e um Negócio encerrado preserva a última Etapa que ocupou. Os encerrados ficam numa faixa própria.
- **Negócio** (`crm/negocios/[negocio]`): encerrar é formulário, não botão. B59 permite ao Funil exigir valor no ganho e Motivo na perda; os campos aparecem antes da confirmação e o submit fica desabilitado até serem válidos.
- **Conversa** (`crm/caixa-de-entrada/[conversa]`): RN-CXE-19 governa o compositor. Fora da janela de resposta, o campo livre é **substituído** pelo seletor de modelo aprovado. A nota interna é visualmente distinta porque confundi-la com uma resposta enviaria ao Contato o que era da equipe.
- **Aprovações** (`ia/aprovacoes`): prazo vencido desabilita decidir, com o motivo escrito. Quem pode decidir espelha exatamente `decideApproval` — o aprovador designado, o dono do Agente ou um Administrador.
- **Membros** (`configuracoes/membros`): remover **é** suceder. O diálogo mostra tudo o que será transferido e tudo o que ficará sem Responsável antes do ato, e exige um Sucessor ativo que não seja de base Convidado.
- **Configurações de contêiner** (Espaço, Pasta, Lista): B25 inteiro numa tela, mostrando por aspecto se é herdado, sobrescrito ou bloqueado, **de onde** vem o valor, e como compõe.

---

## 5. Padrões que o código impõe

Cinco padrões de `docs/02-mapa-ux/PADROES-TRANSVERSAIS.md` viraram estrutura, não convenção:

**§2 — Selo e marcador são formas diferentes.** `StateSeal` é retangular e diz o que o registro **é** (`arquivado`, `naLixeira`). `ConditionMarker` é textual e diz como o registro **está agora** (`Vencida`, `Bloqueada`) — some sozinho quando a causa cessa. Confundi-los faria uma condição temporária parecer permanente.

**§10/§11 — Controle indisponível diz por quê.** `Button` recebe `disabledReason` e o expõe em `title`. Nunca há um botão cinza sem explicação, e nunca há um botão habilitado que falha no clique quando o dado para decidir já está na tela.

**§14 — Vazio nunca é área em branco.** `EmptyState` diz o que aquilo é e qual o próximo passo. E `NoAccessState` é **outro componente**: "sem acesso" não é "vazio", e tratá-los igual revelaria o que a permissão esconde (B103).

**§15 — Coleção que cresce se conta.** `RecordList` sempre mostra "Mostrando N de M" com "Mostrar mais". Um `slice(0, 25)` silencioso que esconde linhas é defeito.

**pt-BR real.** Toda data, número e moeda passa por `Intl` com `pt-BR` (`features/shell/format.ts`). Nada é concatenado à mão. Um "dia civil" renderiza sem fuso; um "instante" renderiza em `America/Sao_Paulo`, hoje uma constante do módulo (`format.ts:12`) que coincide com o Locale do Espaço de Trabalho semeado — ligar a formatação ao `workspace.locale.timezone` de verdade é pendência registrada para a Fase 6.

**Códigos de estado são invariantes.** `ativo`, `arquivado`, `naLixeira`, `mesclado`, `rascunho`, `pausado` são os códigos da ontologia e não variam em gênero. Só o texto ao redor concorda.

---

## 6. Idioma

Identificadores, comentários e nomes de função em inglês. **Toda string visível ao usuário em pt-BR**, com acento e cedilha corretos. Comentário só onde explica um *porquê* não óbvio — tipicamente a regra ontológica que justifica a forma do código. Nenhum comentário narra o que a linha faz.

---

## 7. Verificação

O projeto tem três portões, e todos passam:

```
npx tsc --noEmit      →  sem saída (limpo)
npx eslint src        →  0 problemas
npx vitest run        →  45 testes, 45 passando
```

Além disso, as 52 rotas foram exercidas contra o servidor de desenvolvimento com identificadores reais do seed: **todas respondem 200 e nenhuma cai no estado "não encontrado"** — o que prova que não há rota que compile mas não resolva o dado.

O TypeScript está endurecido além do `strict` padrão (`app/tsconfig.json`): `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. A consequência prática mais visível é a primeira — `array[0]` tem tipo `T | undefined`, o que forçou tratar o caso vazio em todo lugar em vez de assumi-lo. `exactOptionalPropertyTypes` está desligado.

---

## 8. O que a Fase 6 vai encontrar pronto

A Fase 6 recebe: a camada de dados fechada e testada, 52 rotas navegáveis com dados reais, o shell com a árvore de contenção correta, as primitivas visuais no lugar certo, e os fluxos difíceis (Status com bloqueio, encerramento de Negócio, janela de resposta, sucessão de Membro, herança de configuração) já funcionando.

O que ela **não** recebe: decisão visual. Cor, tipografia, espaçamento e densidade são da Fase 5. As primitivas em `features/shell/ui.tsx` têm a forma certa e o visual provisório — trocar os tokens por baixo delas não muda o comportamento de nenhuma tela.
