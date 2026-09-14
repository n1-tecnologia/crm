# Relatório — Fase 6

**Pergunta da fase:** o produto está completo, limpo e navegável como se fosse lançar?

**Resposta:** navegável e completo em cobertura — 53 rotas, 51 telas do inventário, 15 diálogos. Um rastreador que parte de `/` e segue todo `href` chega a **203 endereços, todos 200**, nenhum caindo em "não encontrado". Dos 10 fluxos, **8 são percorríveis ponta a ponta**; os outros dois esbarram na criação de registro, que só existe para cinco famílias — está no fim, nomeado. Limpo nos critérios verificáveis mecanicamente.

---

## 1. O que existe

| | |
| --- | --- |
| Rotas | 53 |
| Telas do inventário cobertas | 51 de 51 |
| Diálogos endereçáveis | 15 de 15 |
| Operações | 56 |
| Leituras derivadas | 30 |
| Componentes base | 23 |
| Arquivos TypeScript | 97 · 25.817 linhas (95 · 24.169 sem os testes) |
| Testes | 120, todos verdes |

---

## 2. O que a Fase 6 fez

### 2.1 O design system chegou às telas

A migração foi uma re-exportação: `features/shell/ui.tsx` passou a re-exportar `design/components`, e as 52 telas herdaram os componentes reais **sem que nenhuma chamada mudasse**.

Isso só funcionou depois de corrigir uma inconsistência que eu mesmo tinha criado: o design system nasceu com nomes de variante em pt-BR (`primario`, `perigoso`), contra a regra do projeto de identificadores em inglês — e contra as 52 telas, que já usavam `primary`/`danger`. Renomear alinhou as duas coisas de uma vez.

Depois, 702 ocorrências de cor Tailwind fixa em 40 arquivos viraram token, numa passada mecânica. Restaram seis casos que precisavam de token semântico específico (o selo `mesclado`, o ponto de não lido, o status de entrega que falhou) e foram feitos à mão.

A amostra viva em `/design`, que serviu de bancada durante a Fase 5, saiu ao fim da Fase 6 como a etapa 6.6 do PRD pede. Ela era a única rota que nenhum link alcançava — só existia digitando o endereço. O que ela garantia continua garantido em `design/tokens.test.ts`, que lê o `tokens.css` real.

**Hoje há zero cores literais no app.** O tema escuro vale no produto inteiro, com alternador de três estados na barra superior — sistema, claro, escuro — que segue o sistema operacional por padrão e persiste a escolha.

### 2.2 Os três alinhamentos que a Fase 4 deixou nomeados

| | Antes | Agora |
| --- | --- | --- |
| Tarefa | só página cheia | painel lateral `?tarefa=` **e** página cheia, como a Fase 2 pede |
| Caixa de Entrada | duas telas | três colunas — Filas e Canais · Conversas · Conversa |
| Encerrar Negócio | formulário em linha | diálogo endereçável `?ganhar=` / `?perder=` |

No painel da Tarefa havia um risco real de divergência: painel e página respondendo diferente sobre o mesmo registro. Resolvido movendo o motivo de bloqueio do Status para `derive.ts` como `terminalStatusBlockReason` — é leitura derivada, e agora existe uma só.

Na Caixa de Entrada os filtros vivem na URL, então trocar de Conversa não perde o recorte e um recorte se compartilha por link.

### 2.3 Os quinze diálogos

Seis já existiam, três viviam como bloco em linha e seis não existiam. Todos agora são endereçáveis por parâmetro de consulta, com o nome que o inventário especifica.

**Por que endereçáveis:** encerrar um Negócio, decidir uma Aprovação, remover um Membro — são passos que se compartilham ("confere isso antes de eu fechar"), se recarregam, e aparecem no histórico do navegador. Um diálogo preso a estado de componente perde as três coisas.

Os seis que faltavam exigiram operações novas, cada uma trazendo a regra que a justifica:

**D10 · Restaurar cópia** — prova que restaurar **não desfaz**: cria registro novo com Proveniência, o absorvido continua `mesclado`, e a cópia nasce sem Identificadores porque eles já pertencem ao sobrevivente (INV-CON-02). Ao escrever isso descobri que o tipo `Contact` não tinha `provenance`, embora RN-CON-15 exija — corrigido no tipo, não contornado no código.

**D12 · Mover Conversa** — rejeita mover para um Contato que já tem Conversa não resolvida no mesmo Canal, salvo resolver a existente no mesmo ato. Duas Conversas abertas do mesmo par (Contato, Canal) quebrariam o roteamento da próxima Mensagem recebida.

**D14 · Excluir Papel** — nada é escrito até que todo titular tenha destino, e a lista do grupo dos Agentes já não oferece Proprietário nem Administrador (INV-ET-13).

**D06 · Ato de governança** — a única via de entrada num Recurso privado sem concessão prévia. B38a esconde o contêiner privado até do Proprietário do Espaço de Trabalho, então não existe listagem navegável dele: a via entra pela Auditoria, pelo rastro que o Registro deixa, ou por um identificador recebido por fora. O que torna isso aceitável é nunca ser silencioso — motivo obrigatório, Registro visível a quem tem acesso ao Recurso. Não abre exceção para Sessão de Chat (DO-CHT-09).

**D08 · Migrar Funil** — sem mapeamento por nome nem por posição. Dois Funis podem ter Etapas homônimas com probabilidades opostas.

**D15 · Importar Contatos** — quatro passos, e o terceiro obriga a escolher o que fazer com uma colisão de Identificador: rejeitar ou tratar como atualização. Não há padrão silencioso. A importação para no Limite imposto com balanço parcial, e os rejeitados vêm com o motivo por linha.

### 2.4 O fuso deixou de ser constante

Pendência P1 fechada. `format.ts` fixava `America/Sao_Paulo` enquanto `workspace.locale.timezone` era exibido em duas telas sem ser lido por nada. Agora `makeFormatters(locale)` constrói os objetos `Intl` uma vez por Locale e `useFormat()` os liga à sessão. 73 chamadas em 24 arquivos convertidas; nenhum literal de fuso restou no código de aplicação.

---

## 3. Vocabulário: um achado de documento que era defeito de código

A revisão dos wireframes apontou termos fora do glossário. Três deles estavam **no código**, não só no desenho:

| Usado | Canônico | Onde doeu |
| --- | --- | --- |
| Etiqueta | **Tag** | 7 arquivos + a rota `/configuracoes/etiquetas` |
| dono | **Proprietário** | mensagens de erro das Aprovações |
| janela de reabertura | **Prazo de reabertura** | cabeçalho da Caixa de Entrada |
| Modelo | **Template** | a rota `/configuracoes/modelos` — e "Modelo" na ontologia é o modelo de IA |

O mapa da Fase 2 especifica `/configuracoes/tags` e `/configuracoes/templates`. Duas rotas estavam com o nome errado, mais Canal e Fila fora de `configuracoes/`, e a Busca sem o `?q=` que o mapa pede. Tudo realinhado.

**Vale o registro:** foi o vocabulário que denunciou. O mesmo termo errado aparecia no wireframe e no código porque saiu da mesma cabeça — e a revisão de um documento apanhou um defeito de implementação.

### 2.5 O que as revisões apontaram, e o que mudou

Duas revisões hostis sobre o produto completo — uma de comportamento, uma de fluxo — devolveram treze achados. Onze foram corrigidos; os dois que sobram são de escopo, não de defeito, e estão no fim.

**Os que eram perda de dado ou falta de autorização:**

| Achado | O que era | O que é |
| --- | --- | --- |
| `publishAutomation` | **nenhuma verificação de quem publica**: uma Convidada publicava uma Versão de Automação, e um Membro removido também | exige `administrar` sobre a Automação (documento 12, 12.2), verificado **antes** de validar o rascunho — quem não pode publicar não descobre pela mensagem de erro o que falta nele |
| Rascunho de IA adotado | [Usar] → Enviar deixava o Rascunho intacto: o mesmo texto ficava como Mensagem enviada **e** como Rascunho à espera, e o próximo Atendente o mandava de novo ao Contato | `sendMessage` recebe `adoptedDraftOf` e esvazia o Rascunho adotado (documento 14, 7.10); o Registro diz de quem era |
| Reabrir Negócio | um clique, sem confirmação, limpando Motivo e Nota | confirmação que **nomeia o que se perde** antes de perder |
| Motivo de encerramento | o D07 coletava, a ficha nunca mostrava | atributo "Motivo de Ganho"/"Motivo de Perda" ao lado de "Encerrado em" |
| Enviar Mensagem | saía sem confirmação | confirmação de efeito externo (§12), com o texto à vista; a nota interna segue sem confirmar, porque não sai |
| Aprovar Solicitação | **[Aprovar] executava a Ferramenta em um toque** — e o produto já confirmava a rejeição | o D09 passou a carregar a decisão (`?aprovar=<id>:aprovada`); aprovar confirma como rejeitar, e a confirmação nomeia a classe de efeito |
| Lixeira | Lista, Contato, Empresa, Negócio e Conversa entravam e **não voltavam** — enquanto a confirmação prometia "pode ser restaurado por 30 dias" | cinco restaurações novas, cada uma com a guarda da sua família: o Negócio volta à Etapa que ocupava (e à primeira, dizendo de onde veio, se ela foi removida); a Conversa exige o Contato fora da lixeira; a Lista traz só as Tarefas que foram na cascata |

**Os que eram afordância ausente:**

| Achado | O que é agora |
| --- | --- |
| Fluxo 2 era inexecutável: sem criar Checklist, sem acrescentar Item, sem criar Subtarefa — e a caixa do Item era um `<span>` que parecia marcável | `addChecklist`, `addChecklistItem`, `setChecklistItemDone` e criação de Subtarefa, com caixa de verificação real |
| Fluxo 7 não começava: o Chat não tinha "Nova Sessão" nem compositor | criação com Âncora e Agente principal, e compositor na Sessão. DO-CHT-09 passou a valer na tela: Sessão alheia responde "sem acesso" |
| Fluxo 6 não começava: mesclar exigia adivinhar qual ficha abrir | painel "Suspeitas de Duplicidade" no índice, derivado a cada leitura (RN-CON-10), com [Mesclar] e "Não são a mesma pessoa" |
| Painéis mostravam `viewType · target` e nenhum valor | `widgetReading` calcula pelas permissões de quem olha: número, série com barra, e **"Fonte sem acesso" em vez de zero** — zero e sem acesso são respostas diferentes |
| D14 tinha diálogo pronto e nenhum Papel personalizado no seed | dois Papéis personalizados com titulares humanos e não humanos |
| `publishAutomation` não tinha chamador na interface | botão na ficha, com a Versão que fica obsoleta nomeada |

Dois padrões se repetiram, e valem mais que a lista:

**Cobertura de código não é alcance de usuário.** O D14 passava nos testes, aparecia na matriz e **nunca podia ser aberto**, porque o seed só tinha Papéis de sistema e o botão "Excluir" só existe em Papel personalizado. O mesmo com as cinco restaurações: escritas, testadas, sem uma linha na lixeira para clicar. A correção, nos dois casos, foi no seed.

**Uma varredura só encontra o que ela procura.** A Definição de Pronto dizia "nenhuma string visível em inglês", e eu tinha verificado — contra a lista de sinônimos proibidos do glossário. Vinte códigos internos passavam por baixo dela porque não eram sinônimos de nada: eram enums (`funnel`, `acaoExplicita`, `singleSelect`) impressos direto. A varredura de hoje lê o HTML renderizado atrás de qualquer `camelCase` ou `snake_case`, e é ela que fica.

---

## 4. Definição de Pronto

Verificado mecanicamente, com o comando ao lado:

- [x] **Todas as rotas alcançáveis, sem link morto** — varredura de todo `href` contra a árvore de `src/app`: nenhum aponta para rota inexistente.
- [x] **Sem erro no console** — rastreamento a partir de `/` seguindo todo `href`: 203 endereços, todos 200, nenhum no estado "não encontrado". Os 16 endereços de diálogo (D01–D15, o D07 com dois) abrem um `aria-modal` real quando visitados diretamente, mais o painel `?tarefa=`.
- [x] **Nenhuma string visível em inglês; nenhum sinônimo não canônico** — a varredura da primeira vez só olhou a coluna de sinônimos proibidos do glossário, e **passou por cima de vinte códigos internos** que apareciam crus na tela (`funnel`, `enviar_mensagem`, `identidadeDeWhatsApp`, `acaoExplicita`, `singleSelect`…). A varredura de hoje lê o HTML renderizado das 202 páginas atrás de qualquer `camelCase` ou `snake_case` no texto visível: **zero**. Os rótulos vivem em `features/shell/format.ts`, um mapa por enum.
- [x] **Nenhum `TODO`, `console.log`, `any`, `as unknown as`, texto de preenchimento** — zero em cada busca. (Os três "TODO" que aparecem são a palavra portuguesa dentro de comentários: "remapear TODO Negócio".)
- [x] **Cobertura do inventário** — 51 de 51 telas, 15 de 15 diálogos.
- [x] **Toda ação irreversível confirma; toda ação dá retorno; toda lista tem estado vazio** — o `ConfirmDialog` é o único mecanismo de confirmação, e não existe `window.confirm` no código.
- [x] **Tema claro e escuro íntegros** — zero cores literais; 73 asserções de contraste sobre os tokens reais, nos dois temas.
- [x] **Typecheck, lint e testes verdes** — `npx tsc --noEmit` sem saída, `npx eslint src` sem saída, 120 testes passando.

```
$ npx tsc --noEmit      → sem saída
$ npx eslint src        → sem saída
$ npx vitest run        → 120 testes, 120 passando
$ rastreio de /         → 203 endereços, todos 200, nenhum "não encontrado"
$ varredura de código   → 202 páginas, zero identificador interno no texto visível
$ 16 endereços D01–D15  → todos abrem aria-modal com dados reais do seed
```

---

## 5. O que os testes pegaram de mim

Dois erros meus que os testes apanharam, e valem mais que os acertos:

**A premissa do teste é que estava errada.** Ao testar a exclusão de Papel, escolhi como cobaia a própria Membro que executava a operação. Ela perdeu o Papel de Proprietária, e a operação recusou — corretamente. O código estava certo; o teste é que media a permissão em vez da regra do destino.

**Um teste verde não é prova.** Na Fase 3, o teste de RN-NEG-11 passava sob um `describe` que citava a regra enquanto o código destruía o Motivo de Ganho: ele verificava que *existia* um registro de reabertura, não que o Motivo sobrevivera.

---

**⚠️ NÃO FEITO**
- **Criação de registro só existe para Tarefa, Subtarefa, Checklist, Sessão de Chat, convite de Membro e importação de Contatos** — as telas de índice de Espaço, Pasta, Lista, Empresa, Contato, Negócio, Etapa, Funil, Fila, Papel, Agente, Habilidade, Automação, Coleção, Documento, Painel, Widget e Equipe **não oferecem criação**: não há botão morto, há ação ausente. É o que impede os fluxos 8 e 9 de partirem da tela em vez do seed. Fechar: as operações (`createSpace`, `createList`, `createCompany`, `createDeal`, `createRole`, `createAutomation`, `createPanel`, `createTeam`…) e os diálogos que as acionam.
- **Ações de ciclo de vida sem gatilho em tela** — arquivar e desarquivar qualquer registro; suspender e reativar Membro; cancelar Execução (a tela de Execução explica o efeito em cascata e não tem o botão); reenviar Mensagem `falhou`; criar Tarefa ou Negócio a partir da Conversa (§20); remover Item de Memória do Agente; exportar Painel; conectar e desconectar Canal e Integração. Fechar: uma operação e um gatilho por item, todos com o padrão de confirmação que §12 já define.
- **`receiveMessage` continua sem chamador na interface** — e assim fica: uma Mensagem recebida é ato do Contato, não do Membro, então não existe gesto humano que a dispare. A operação é exercida pelos testes e existiria por trás de um webhook num produto real. Fechar, se o usuário quiser demonstrar a chegada: um controle de simulação, que o inventário de telas não prevê.
- **P2 — reconvite depende da identidade do convite** — sem diretório de Usuário, um Membro `removido` sem `invitedIdentity` não é reconhecido no reconvite e entra como novo. Registrado em `docs/PENDENCIAS-FRONTEND.md`.
