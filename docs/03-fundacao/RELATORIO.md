# Relatório — Fase 3

**Pergunta da fase:** o esqueleto técnico sustenta o produto sem inventar conceito?

**Resposta:** sim. A camada de dados fecha os 21 documentos da ontologia em tipos, derivações e operações; 52 rotas navegam com dados reais; os três portões estão verdes e as duas revisões foram executadas e resolvidas.

---

## 1. Entregue

| Item | Onde |
| --- | --- |
| Tipos da ontologia | `app/src/data/types/` — 6 arquivos, um por região |
| Estado e resultado de operação | `app/src/data/state.ts` |
| Todas as leituras derivadas | `app/src/data/derive.ts` |
| Todas as escritas | `app/src/data/operations/` — 7 arquivos |
| Dados fictícios | `app/src/data/seed.ts` — volumes do PRD II.7 |
| Ponte com React | `app/src/data/store.ts` |
| Shell, primitivas e formatação | `app/src/features/shell/` |
| 52 rotas | `app/src/app/` |
| Arquitetura | `docs/03-fundacao/ARQUITETURA.md` |

79 arquivos TypeScript, 15.983 linhas.

---

## 2. Evidência de execução

```
$ npx tsc --noEmit
(sem saída)

$ npx eslint src
(sem saída — 0 problemas, 0 avisos)

$ npx vitest run
 Test Files  1 passed (1)
      Tests  47 passed (47)
```

**Prova de navegação.** As 52 rotas foram exercidas contra o servidor de desenvolvimento com identificadores reais extraídos de `buildSeed()` — não com identificadores inventados, que fariam toda página cair no estado "não encontrado" e passar no teste por acidente:

```
52 rotas: todas 200, nenhuma em estado não-encontrado
```

Isso separa duas falhas que um teste de status HTTP sozinho confunde: a rota que não compila (erro 500) e a rota que compila mas não resolve o dado (200 com "Tarefa não encontrada").

---

## 3. As duas revisões

Ambas voltaram **REJEITADO**. Somadas, 19 achados. Todos foram corrigidos; nenhum foi aceito com justificativa.

### `flow-critic` — completude de fluxo (8 achados)

| # | Achado | Correção |
| --- | --- | --- |
| 1 | "Converter em Subtarefa" executava ato irreversível em um clique | Confirmação inline nomeando quantos subitens migram (`tarefas/[tarefa]/page.tsx`) |
| 2 | "Convidar Membro" era um botão sem `onClick` | Operação `inviteMember` implementada (RN-ET-24, RN-ET-11, RN-ET-23) + formulário |
| 3 | Criar Tarefa não dava retorno — e no Calendário a tela não mudava | Aviso nomeando a Tarefa, com link para abri-la |
| 4 | "Reabrir" Negócio habilitado para quem a operação recusa | Desabilitado com o motivo, espelhando `reopenDeal` |
| 5 | "Minhas Tarefas (17)" renderizava 5 | Grupo "Sem data ou mais adiante" — todo item contado agora aparece |
| 6 | `slice(0, 6)` silencioso no Início | "Mostrando 6 de N" com link para a tela cheia |
| 7 | Ação terminal com estilo neutro | Variante `danger` |
| 8 | Concessões de Coleção sem estado vazio | `EmptyState` dizendo a consequência |

Mais dois latentes que o próprio revisor marcou como ainda inalcançáveis (`EmptyState` incondicional sob um `count` em Automação e Documento) — corrigidos também, porque deixam de ser latentes assim que o seed mudar.

### `critic` — revisão hostil de comportamento (11 achados)

Quatro coincidiram com os acima. Os sete próprios:

**1. Escrita antes da validação de autorização** (`operations/ai.ts`) — o mais grave. `decideApproval` marcava a Solicitação como `expirada` e cancelava a Execução **antes** de verificar quem estava agindo. Um Convidado sem direito nenhum cancelava a Execução só de pedir, e a operação ainda devolvia `fail`. Era também o único ponto do store que mutava sem `recordActivity`.

Corrigido movendo a autorização para antes do efeito, e a expiração passou a gravar Registro de Atividade com o Sistema como ator — porque produz efeito, e efeito sem registro é efeito invisível. Dois testes novos cobrem exatamente isso, incluindo a prova de que nada é gravado quando quem pede não pode decidir.

**2. RN-NEG-11 violada** (`operations/deals.ts`) — reabrir um Negócio ganho apagava o Motivo de Ganho definitivamente. A regra diz que ele é limpo como atributo corrente **e permanece nos Registros de Atividade**; não permanecia em lugar nenhum. Agora `winDeal` grava o Motivo no registro e `reopenDeal` grava o que limpou.

**3. `reopenDeal` sem guarda de ciclo de vida** — era a única operação de Negócio que aceitava um registro arquivado ou na lixeira, contra a própria tela que dizia "somente leitura".

**4. Consentimento de marketing invisível ao compositor** — a tela habilitava enviar sem checar RN-CON-16, que `sendMessage` verifica. Corrigido extraindo a regra para `derive.ts` como `marketingConsentMissing`, lida agora **pelos dois** — o compositor e a operação. Duplicar a regra na tela teria funcionado hoje e divergido depois.

**5. Cortes silenciosos restantes** — a Atividade da Tarefa cortava em 12 sem dizer.

**6. Testes que não provavam o que afirmavam** — a asserção de RN-NEG-11 verificava apenas que existia *algum* registro de reabertura, o que era verdade mesmo com o Motivo perdido. E o teste de expiração usava a aprovadora designada, então nunca exercitava a ordem que o achado 1 quebrava. Ambos reescritos para citar o valor, não a existência.

**7. `trashContact`/`trashCompany` sem guarda de idempotência** — uma segunda chamada reescrevia `lifecycleBeforeTrash` de `arquivado` para `ativo`, e B43 passaria a restaurar para o estado errado. Sem caminho de tela hoje, mas a camada de operações é a fronteira declarada.

O revisor também apontou duas afirmações incorretas no `ARQUITETURA.md` — "~250 Registros de Atividade" quando são 239, e a alegação de que a formatação usa o fuso do Espaço de Trabalho quando usa uma constante. Ambas corrigidas; a segunda virou pendência registrada.

---

## 4. Decisões estruturais

Detalhadas em `ARQUITETURA.md`; as três que mais moldaram o código:

**Mutação no lugar com contador de revisão**, em vez de clonar em profundidade. O grafo do domínio é grande e conectado — clonar a cada escrita seria caro e frágil. O custo aceito: nenhum componente guarda referência a objeto do estado entre renders.

**`derive.ts` como fonte única das leituras calculadas.** Nada derivado é armazenado. Isso já pagou: a regra de consentimento, quando precisou aparecer numa tela, foi extraída para lá em vez de duplicada.

**A tela espelha a operação, nunca adivinha.** Onde a permissão decide se um botão aparece habilitado, a tela lê a mesma condição que a operação aplica. Três dos achados foram exatamente telas que adivinhavam.

---

## 5. Padrão que vale registrar

**Quando o tipo diz `readonly` e a vontade é mutar, o tipo costuma estar certo.** Três vezes o portão barrou um `as unknown as`; nas três, a correção certa era substituir o objeto inteiro, e a ontologia já dizia isso (B14 reaponta referências; INV-CXE-04 congela o Canal da Conversa).

**Um teste vermelho não é automaticamente um bug de código.** Duas falhas em `sendMessage` eram o seed violando a janela de resposta — a operação estava certa e o dado errado.

**Um teste verde não é automaticamente uma prova.** O achado 6 do `critic` foi justamente um teste que passava sob um `describe` citando a regra que o código violava.

---

## 6. Estado ao fim da fase

Fundação fechada. A Fase 6 recebe camada de dados testada, 52 rotas navegáveis com dados reais, shell com a árvore de contenção correta, e os fluxos difíceis já funcionando — Status com bloqueio, encerramento de Negócio, janela de resposta, sucessão de Membro, herança de configuração.

O que ela **não** recebe é decisão visual: cor, tipografia, espaçamento e densidade são da Fase 5. As primitivas em `features/shell/ui.tsx` têm a forma certa e o visual provisório; trocar os tokens por baixo delas não muda o comportamento de nenhuma tela.

**Pendência aberta:** P1 em `docs/PENDENCIAS-FRONTEND.md` — a formatação de instantes usa constante em vez do Locale do Espaço de Trabalho. Comportamento idêntico hoje; fecha na Fase 6.
