# PENDÊNCIAS DO FRONTEND

Conceitos que a interface precisou resolver e que a ontologia **não** define, ou que ela deixou explicitamente em aberto. Cada item traz a **alternativa adotada** e a consequência. Nenhuma entidade nova foi criada (regra I.1 do PRD).

Atualizado na Fase 7 · 2026-09-17. A Fase 2 abriu o documento; a Fase 3 acrescentou P1 e P2; a Fase 6 fechou P1 e decidiu C32. O pacote de movimento (2026-09-17) abriu P3–P9, fora do seu escopo. A Fase 7 (o diferencial: Lista conversacional e os fluxos de criação da IA) decidiu C35, emendou C33, fechou boa parte do "ação ausente" do RELATORIO e abriu P14–P21 — seção ao fim. A emenda de 2026-09-21 (Início redesenhado, portas de volta ao menu lateral, a marca 3D no palco) abriu P26, P27 e P28. A emenda de 2026-09-24 (o Início rola: o robô sai ao contrário da entrada e o resumo da pessoa sobe por cima) abriu A8, P32 e P33 e atualizou P26, P29 e P31.

---

## A. Conceitos de interface sem base ontológica

Coisas que a interface precisa e que a ontologia não modela por não serem do seu escopo. Nenhuma delas persiste dado novo.

### A1. Notificação
**Situação.** A ontologia diz que "notificação não é registro da ontologia" (documento 19, 7.4), mas a Ação de controle "notificar" existe, menções notificam (RN-TAR-14) e Solicitações de Aprovação são notificadas (B80).
**Alternativa adotada.** O sino da barra global é uma **visão derivada** de Eventos e Registros de Atividade dirigidos ao Membro logado, filtrada pelas suas permissões. Não é entidade, não é persistida como registro próprio, não tem estado de ciclo de vida e não aparece na matriz de cobertura como entidade.
**Consequência.** "Lida / não lida" de notificação é estado de sessão do visualizador, como o Filtro interativo (B103 por analogia). Nada nela sobrevive a uma troca de Membro.

### A2. Sessão simulada e "Trocar de Membro"
**Situação.** A ontologia distingue Usuário (identidade global que se autentica) de Membro (relação com o Espaço de Trabalho) — A1.4 — mas não modela autenticação.
**Alternativa adotada.** `/entrar` (T01) escolhe o Membro; a barra superior permite trocar. Nenhum dado é gravado: a escolha é estado da aplicação.
**Consequência.** É o mecanismo que torna as permissões visíveis (fluxo 10). Numa versão com backend, `/entrar` seria substituída por autenticação de Usuário e a resolução do Membro seria automática.

### A3. Avatar e marca visual de Membro e de Agente
**Situação.** A ontologia dá **Foto** ao Contato (documento 10, 6) e nada equivalente ao Membro nem ao Agente. B7 exige, porém, que o Agente seja distinguível de uma pessoa.
**Alternativa adotada.** Membro: iniciais do Nome de exibição sobre cor derivada do identificador. Agente: forma e marca visuais próprias, nunca iguais às de pessoa. Automação, Integração e Sistema: ícones próprios.
**Consequência.** Nenhum atributo novo. Se o produto quiser foto de Membro, isso é um atributo a acrescentar ao documento 01 (relacionado a C13).

### A4. Visualizações salvas fora da Estrutura de Trabalho
**Situação.** **Visualização** é configuração que "pertence a um contêiner ou a um Membro" (A8). O CRM não tem contêineres (A2.2), então uma "visão salva" das tabelas de Contatos, Empresas ou Negócios não tem onde morar.
**Alternativa adotada.** Filtros e ordenação das tabelas do CRM são **estado de sessão do visualizador**, não gravados — o mesmo tratamento do Filtro interativo de Painel (documento 21, 7.5). A Visualização pessoal do Membro (A8) fica restrita à Estrutura de Trabalho, onde a ontologia a prevê.
**Consequência.** "Salvar esta visão" não é oferecido no CRM. Se o produto exigir, é ampliação de A8 e precisa de decisão ontológica.

### A5. Busca global — escopo e ordenação
**Situação.** O PRD prevê `/buscar`; a ontologia não tem documento de busca (é "transversal").
**Alternativa adotada.** A busca alcança nome e título das entidades com identidade e respeita `ver` sobre cada registro. **Não** alcança conteúdo de Fragmento, Mensagem, Mensagem de Chat, Comentário nem Memória — o mesmo veto que RN-PAI-15 impõe aos Painéis. Ordenação por relevância é decisão de produto.
**Consequência.** Buscar por um trecho de mensagem não encontra a Conversa. Registrado para decisão de produto.

### A7. Como um Administrador alcança um contêiner privado para o ato de governança
**Situação.** B38(a) esconde o contêiner privado de todo Sujeito sem concessão — **inclusive** do Proprietário do Espaço de Trabalho e dos Administradores. B38(b) exige que exista a via de entrada por **ato de governança registrado**, e é a única. A ontologia não diz por onde o ator chega ao recurso que ele não pode ver: uma listagem navegável de contêineres privados violaria B38(a); sem listagem alguma, a via de B38(b) é inalcançável.
**Alternativa adotada.** Duas entradas, nenhuma delas uma listagem: (a) a partir da **Auditoria** (T50), onde os Registros de Atividade do recurso privado aparecem para quem tem o Papel — nome do objeto e ator, **nunca conteúdo**, como INV-ET-12 já prevê; (b) por **campo de identificador**, para quem recebeu a referência por fora do produto. O diálogo D06 exige motivo e gera Registro de Atividade visível a quem tem acesso ao recurso.
**Consequência.** A existência de um contêiner privado é descobrível por quem já vê a Auditoria — o que é coerente com B38(b), que torna a entrada possível e nunca silenciosa, mas **é uma leitura, não uma regra da ontologia**. Se o produto quiser que nem a Auditoria revele o nome de recurso privado, isso restringe B38(b) a ponto de torná-la inaplicável e precisa de decisão ontológica.

### A8. O resumo do Início (a visão derivada por Membro)
**Situação.** O Início mostra, abaixo do palco (2026-09-24), "o que espera por mim" e as estatísticas da pessoa. A ontologia não tem uma tela de resumo pessoal, veda Widgets pessoais num Painel compartilhado (paineis.md §25) e define "lead" como Qualificação de Contato, nunca entidade (DO-CON-05).
**Alternativa adotada.** O resumo é uma **visão derivada** por Membro, como a Notificação (A1): não é entidade, não persiste nada e não é Painel — cada número vem de uma derivação que outra tela já usa (`tarefasAbertasDoMembro`, os recortes de Minhas Tarefas, a "não lida" da Caixa de Entrada) ou de Métricas do catálogo dos Painéis aplicadas ao Membro (`data/derive-resumo.ts`; a definição de "Leads a atender" e das estatísticas está em DECISOES-E-PENDENCIAS C38). Só o que o Membro vê (B103).
**Consequência.** Os números batem com as telas de destino e com a barra global. O período das estatísticas é estado da sessão (o padrão é Semana), como um Filtro interativo.

### A6. Valores dos Limites impostos e da Política de lixeira
**Situação.** A ontologia exige que existam e tenham efeito registrado; os valores são da plataforma (B34, C8, C20).
**Alternativa adotada.** O seed fixa valores explícitos e a interface sempre exibe o valor vigente ao explicar um limite ("Limite de 3 níveis de Subtarefa, definido no Espaço de Trabalho"; "Registros excluídos ficam aqui por 30 dias").
**Consequência.** Nenhum número aparece codificado na regra: todos vêm da configuração.

---

## B. Questões em aberto da ontologia que a interface encontrou

Cada uma é uma pendência **C** da constituição. A interface adota a leitura conservadora e não antecipa a decisão.

| # | Questão | O que a interface faz |
| --- | --- | --- |
| DO-CNH-06 | Tags em Documento de Conhecimento | **Proposta RECOMENDADA que a interface não antecipa.** DO-CNH-06 propõe alterar B5 para admitir Tags em Documento; o próprio documento 20 declara que, "enquanto não adotada, obedece a B5", e a seção 9 registra `Documento → Tag | 0 (nesta versão)`. A interface segue B5: o Documento usa **rótulos livres do Metadado**, sem catálogo. Divergência registrada porque a legenda da constituição trata RECOMENDADA como verdade provisória — aqui a própria decisão se declara não adotada. |
| C5 | Conversas em grupo | Exibe a Conversa de grupo com Identificador de grupo e Participantes `contato` adicionais; com "Grupos habilitados" falso, mostra que a Conversa nasce `resolvida`, sem Fila nem distribuição (RN-CXE-28). Não oferece regras de resposta a grupo. |
| C12 | Horário comercial / dias úteis | "Horas úteis" só é oferecido onde a entidade dispõe de Horário de atendimento (Conversa, Mensagem — RN-PAI-14). Em Tarefas, Negócios e Execuções, toda duração é de **calendário**, e a tela diz isso. |
| C13 | Campos personalizados em Membro, Equipe, Integração e contêineres | Não oferecidos. A tela de Definições de Campo lista só as quatro entidades-alvo de A5.2 e, para Tarefa, aponta os contêineres. |
| C14 | Definições de Campo entre Espaços | Painéis: fechado por B105 — só Definições de ancestral comum, e homônimas nunca são unificadas; o Widget explica quando uma Dimensão não está disponível. Automações de escopo Espaço de Trabalho: permanece aberta; o editor não oferece campo de Tarefa nesse escopo. |
| C16 | Comentários, Tags e Vínculos em contêineres | Não oferecidos em Espaço, Pasta, Subpasta e Lista. A Descrição é o único texto livre (DO-PAS-13). |
| C17 | Prioridade personalizável | Escala fixa: urgente, alta, normal, baixa, sem prioridade. Não há tela de configuração de Prioridade. |
| C18 | "Somente leitura" sem arquivar | Não existe. Fechar uma Lista é arquivá-la, e a interface explica que o conteúdo fica íntegro e consultável. |
| C19 | Responsável de Item que não pode concluir | Um Convidado com a Tarefa compartilhada em `comentar` vê o Item atribuído a si e **não** consegue concluí-lo. A interface desabilita a caixa com "Você não tem permissão para editar esta Tarefa." em vez de esconder a atribuição. |
| C20 | Teto de profundidade de Subtarefas | Usa a Profundidade máxima do Espaço de Trabalho e exibe o valor vigente. |
| C21 | Escopo de permissão `equipe` no CRM | Não oferecido. A tela de Papéis expõe só `registro`, `subárvore` e `próprios` (B29). "Gerente vê os do time" exige concessão direta à Equipe, registro a registro. |
| C22 | Configuração de câmbio | Painéis nunca convertem: **uma série por moeda**, sempre rotulada (RN-PAI-13). Não existe seletor de moeda de consolidação. |
| C23 | Categoria fixa de Qualificação | A Dimensão segmenta por **Definição**; "converteu" é Filtro escolhido pelo editor. Automações não oferecem "Qualificação é cliente" como predicado de categoria. |
| C24 | Correlação entre Conversas de E-mail | Não há Vínculo Conversa-Conversa. Uma resposta de copiado cria Conversa própria, e a interface não sugere relação entre elas. |
| C25 | Empresa como escopo de Automação | O seletor de escopo oferece só os oito de B41. "Quando qualquer Negócio do grupo Gama for ganho" é Condição sobre o Negócio, no escopo Espaço de Trabalho. |
| C26 | Transcrição e descrição de Anexos | Exibidas quando existirem, sempre como **derivadas**, com o Ator gerador e sem substituir o Arquivo. A interface não as gera. |
| C27 | Modelos secundários por modalidade | A Versão de Agente tem **um** Modelo principal (ou o marcador). Arquivo incompatível não entra no Contexto e gera Mensagem `sistema` (RN-CHT-19). |
| C28 | Retenção de Execuções e de ramos substituídos | Execuções e Mensagens substituídas são exibidas enquanto existirem; nenhuma tela promete retenção. |
| C29 | Acesso corporativo a Sessões de Chat | Não existe. Sessão de terceiro responde "sem acesso" a qualquer Papel, inclusive ao Proprietário do Espaço de Trabalho (DO-CHT-09). |
| C30 | Aprovação obrigatória por Recurso | Não oferecida. A aprovação decorre só do nível de autonomia, do invocador e do Limite de operações (B22, B77). |
| C31 | Visibilidade herdada da Âncora de Painel | A aba "Painéis" de Espaço, Pasta, Subpasta, Lista, Funil e Fila lista **apenas** os Painéis de contexto que o visualizador já pode ver por compartilhamento. A Âncora não concede acesso (INV-PAI-09). |
| C32 | Rebaixamento de Proprietário a base Convidado | **Decidido na Fase 6 — alternativa (b).** A interface impede designar Proprietário ou Sucessor com base Convidado (RN-PAI-05, B28) e agora também **recusa** levar a um Papel de base Convidado quem é Proprietário de registros, exigindo a transferência antes. A recusa vive na operação (`deleteRole`, `app/src/data/operations/members.ts:462`), não na tela. |
| C33 | Espelho do processo comercial na Estrutura (Comercial › Meus negócios › Funil) | **Cópia de seed, não sincronização.** Cada Negócio ativo vira uma Tarefa com Proveniência `deal` e um Vínculo ao Negócio (`app/src/data/seed-comercial.ts`), aberta em Quadro. Mover a Tarefa de Status não move o Negócio de Etapa, nem o contrário; a tela da Lista avisa. Ligar os dois (qual lado manda, o que acontece em Ganho/Perdido, quem vê o quê) é decisão de produto e pede backend. **Emendado na Fase 7 (2026-09-17):** as quatro Listas do espelho (`lst_funil_*`) são **conversacionais** (C35), e a Tarefa-espelho nasce também com o Vínculo ao **Contato principal** do Negócio (papel "contato da Tarefa"), no seed e em `iniciarConversa`; o espelho é o caso particular da Lista conversacional — conversacional **com** Negócio obrigatório e a barra "Iniciar conversa" — e **continua cópia**: nada sincroniza. |
| C34 | Contas a receber sem Gestão contratual e sem “tempo em Status” | O processo (`docs/07-processos/contas-a-receber.md`) foi implantado com três leituras conservadoras: (1) R1 é a operação “Nova série de parcelas” na própria Lista, não um gatilho em contrato — Gestão contratual não existe na ontologia; (2) R4/R5 (“30/60 dias em pendente”) disparam por vencimento + 30/60 dias, porque o gatilho temporal da plataforma só conhece distância do vencimento; (3) o cliente é um Contato do CRM por Vínculo, e “marcar o cliente como inadimplente” (R6) não escreve no Contato. Fecham com Gestão contratual, gatilho por tempo em Status e um Campo de situação no Contato. |
| C35 | Modelo de Tarefa da Lista (operacional × conversacional) | **Decidido na Fase 7 — ver a seção "Fase 7 — o diferencial".** A Lista ganha o atributo nativo `modeloDeTarefa`; a Tarefa conversacional aponta para o CRM só por Vínculos; os chamadores de `createTask` sem Contato recusam explicitamente. Registrado na constituição como C35 (`ontologia/DECISOES-E-PENDENCIAS.md`). |

---

## C. Item decidido na Fase 6

**C32 — rebaixar a base Convidado um Membro que é Proprietário de registros.**
A ontologia proíbe *designar* Proprietário ou Sucessor com base Convidado, mas não diz o que acontece quando um Membro que já é Proprietário passa a ter Papel de base Convidado. As três alternativas registradas na constituição são: rejeitar o rebaixamento enquanto houver propriedades; exigir transferência no mesmo ato; ou admitir Proprietário de base Convidado.

**Alternativa adotada: (b) — exigir transferência no mesmo ato.** Um Membro que é Proprietário de qualquer registro não passa a um Papel de base Convidado; a operação recusa nomeando quantos titulares e por quê, e a transferência tem de acontecer antes. A regra vive em `app/src/data/operations/members.ts:462`, com `previewSuccession` como fonte única do que conta como propriedade.

**Por que (b) e não (a):** rejeitar para sempre tornaria o rebaixamento impossível sem um caminho de saída; (b) diz o que fazer. **Por que não (c):** admitir Proprietário de base Convidado contradiz B28 no caso do Sucessor e criaria dois significados para a mesma base.

**Reversível pelo usuário.** Se o produto preferir (a) ou (c), a mudança é de uma condição na operação e da frase que ela devolve — nenhuma tela decide isso.

## D. Divergências encontradas no PRD e resolvidas contra a ontologia

| Item do PRD | Correção | Fonte |
| --- | --- | --- |
| "Negócios em Quadro por padrão" (I.4) | Mantido, com a ressalva de que a **aba** (Abertos/Ganhos/Perdidos) é a situação e a **coluna** é a Etapa; um Negócio `ganho` aparece na coluna da sua última Etapa | B9, B58 |
| "Tarefa em painel lateral com opção de página cheia" (I.4) | Mantido. A rota é a mesma para Tarefa e Subtarefa | B1 |
| Tabela II.6 sem rota de conta do Membro | Acrescentada `/minha-conta`: a Memória do Usuário e a Disponibilidade de atendimento não tinham onde ser governadas | B86, DO-CXE-14 |
| Tabela II.6 previa "configurações e herança" dentro de `/estrutura/espacos/[espaco]` e nada para Pasta | Separadas em rotas próprias (`/configuracoes` do Espaço, da Pasta e da Subpasta): herança e bloqueio por aspecto são configuração densa, com Mapeamento de status obrigatório, e não cabem na tela de conteúdo | B25 |
| Tabela II.6 sem rotas de Canal e de Fila | Acrescentadas: são entidades com atributos, estados, escopo de Automação e Âncora de Painel | B41, B102 |
| Tabela II.6 agrupava Templates em `/configuracoes/...` | Rota própria `/configuracoes/templates`, porque o catálogo cobre seis tipos de Template com regras distintas de instanciação (inclusive B47, que rejeita Template de Pasta com Subpastas dentro de Pasta) | A8, B47 |
| II.8 "Painéis: sem link público" | Confirmado e reforçado: **não existe** compartilhamento público de Painel nesta versão | B104 |
| II.8 "Agentes: restaurar devolve `pausado`" | Confirmado, e estendido: vale também para Automação | B94 |
| II.8 "Conversa: `pendente` com Adiamento" | Confirmado, com a precisão de que `pendente` significa "aguarda o Contato ou o relógio", não "sem Atribuído" | DO-CXE-07 |

---

## Pendências técnicas abertas na Fase 3

Registradas aqui porque são divergências reais entre o que a ontologia define e o
que o código faz hoje — não são conceitos sem base ontológica, mas dívidas com
prazo.

### P1. ~~O fuso de renderização é constante~~ — FECHADA na Fase 6

`app/src/features/shell/format.ts` fixava `America/Sao_Paulo`, enquanto o campo
real (`workspace.locale.timezone`) era exibido em `/configuracoes` e em
`/minha-conta` sem ser lido por nenhuma formatação. O comportamento era idêntico
só porque o Locale semeado é justamente esse.

**Fechada.** As funções passaram a receber o Locale: `makeFormatters(locale)`
constrói os objetos `Intl` uma vez por Locale, e `useFormat()` os liga ao Espaço
de Trabalho da sessão. As 73 chamadas em 24 arquivos foram convertidas; nenhum
literal de fuso sobrou no código de aplicação.

### P2. O reconvite só casa por identidade de convite, não por Usuário

RN-ET-11 diz que reconvidar um **Usuário** removido reativa o mesmo Membro. O
protótipo não simula a identidade global de Usuário (A1.4, registrado em A2), e
`inviteMember` só consegue casar pelo campo `invitedIdentity`.

A consequência: um Membro que entrou por convite e depois **aceitou** perde o
`invitedIdentity` (B27 — ele existe só enquanto `pendente` e sem Usuário); se
esse Membro for removido, um reconvite pelo mesmo e-mail cria um registro novo
em vez de reativar o antigo, quebrando INV-ET-04.

Hoje não dá para acontecer, porque o protótipo nunca faz um Membro `pendente`
aceitar. Fecha quando existir um diretório de Usuário — ou seja, quando existir
backend.

## Pendências de movimento — fora do pacote de 2026-09-17

O sistema de movimento (`docs/05-design-system/DIRECAO-VISUAL.md` §5) entrou inteiro,
menos estes sete itens, deixados de fora de propósito. Cada um diz o que existe hoje,
o que falta e por que não coube.

### P3. Fila global de avisos e a migração dos 28 chamadores de `Toast`

Hoje o `Toast` é **inline e sticky** no topo do corpo da tela: entra em `surgir`,
expira pela régua de tempo e sai em `sumir`, mas empurra o conteúdo — é a única fonte
conhecida de CLS. A fase seguinte é a fila fixa embaixo da tela (porta de
`CRM-COMPLETO/components/ui/aviso.tsx`), com migração **por assunto** dos 28 lugares
que renderizam `<Toast>` e `npm run check` verde a cada lote. Ficou de fora porque a
API atual (`tone`, `children`, `onDismiss`, `acao`) é compatível com todos os
chamadores e a fila muda o modelo (quem monta, quem empilha, quem dispensa).

### P4. FLIP no drop dos quadros

Soltar um cartão noutra coluna o faz aparecer lá sem trajeto; o sinal é o realce
(`data-recente`, 1,5 s em `--acento-lavado`). Um FLIP (medir antes e depois, animar a
diferença por `transform` transitório) daria o trajeto, mas o `.card-negocio` é
arrastável e não pode carregar transform residual, e o `.rolagem-no-topo-corpo` tem
`overflow` que recortaria o caminho. Pede desenho próprio.

### P5. Largura animada do painel de navegação

Recolher e expandir o painel do assunto troca a largura num quadro. Animar `width` do
`<aside>` custaria layout da tela inteira por quadro, e o `<aside>` hospeda o
`CreateContainerDialog` (`fixed` sem portal): nem `transform` nem `overflow` cabem
nele (lei 2). O que anima hoje é só o conteúdo (`aparecer` no `nav`, `surgir-rapido`
na subárvore, o chevron em `.seta-recolhe`).

### P6. View Transitions

Descartadas nesta versão: o React 19.2.8 estável não exporta `ViewTransition`, o Next
16.3.4 não tem a opção `viewTransition`, e `document.startViewTransition` cru congela
a tela velha até o chunk chegar — o oposto da tese (a tela velha fica inteira e
responsiva; a barra de rota conta a espera). Reavaliar quando as duas bibliotecas
estabilizarem a API.

### P7. UI da preferência "Movimento mínimo"

O mecanismo existe: `<html data-movimento="minimo">` liga o mesmo bloco de CSS do
`prefers-reduced-motion`, e `reduzido()` (`design/movimento.ts`) o lê. Falta o
controle (um `Toggle` em `/minha-conta`) e onde persistir: é preferência do Usuário
(A1.4), e sem backend vira estado de sessão — o mesmo tratamento de A2.

### P8. ~~Destino da família `.orbe-assistente`~~ — FECHADA em 2026-09-17

O anel de varredura (`.orbe-varredura`, `orbe-gira`) virou o anel em volta do
globo no palco do Início — e saiu com ele em 2026-09-21, no refazer do palco; o resto da família (`.orbe-assistente`, `.orbe-anel`,
`.orbe-nucleo`, `orbe-respira`, os tokens `--orbe-tam`, `--brilho-orbe*`,
`--respira-defasagem-*`) saiu.

### P10. O Login não é uma porta

`/login` (usuário e senha, fictício) existe pelo rito e pela marca, alcançável por
"Sair" no menu da conta; nada redireciona para ela e qualquer usuário e senha
entram. Quando houver Usuário de verdade (A1.4), a rota vira o gate e `/entrar`
vira a escolha de Espaço de Trabalho/Membro depois da autenticação.

### P11. ~~Painéis: a barra de Metas nunca foi vista~~ — FECHADA em 2026-09-17

Metas saiu do produto a pedido: a tela `/estrutura/metas`, o item do painel de
Trabalho, a seção "Metas deste contêiner" do Painel, o tipo `Goal`, as operações em
`scale.ts`, `goalProgress`, a seed e os testes foram removidos. A ontologia nunca
definiu Meta como entidade (só D7, "possível entidade futura"); voltar é decisão
de produto.

### P12. ~~Início: o botão de enviar a pergunta é cru~~ — FECHADA em 2026-09-17

O envio é `.btn-icone.btn-icone-enviar` e, em pendência, troca a seta por
`Loader2.girando` (além do `aria-busy`).

### P13. Entrar: com 11 Membros o cartão passa de 900 px

`min-h-screen` + `items-center` + 11 linhas: o último Membro fica abaixo da dobra
num viewport de 900 px e a página rola. Pré-existente ao movimento.

### P9. `caixa-de-entrada/layout.tsx`

Para a coluna de 23 conversas não refazer a onda a cada clique, `chaveDeChegada`
colapsa `/crm/caixa-de-entrada/[conversa]` no prefixo e o painel direito remonta com
`key={conversationId}` + `aparecer`. A solução definitiva é um `layout.tsx` do
segmento que mantenha a coluna montada e só troque o detalhe — aí o colapso na chave
deixa de ser necessário.

---

## Fase 7 — o diferencial (2026-09-17)

Cinco frentes num pacote: Metas sai; a barra global de 40 px (busca ao centro com "/",
Minhas Tarefas, o sino e a conta); o Início refeito como palco (assistente + quatro
portas — as portas saíram na emenda de 2026-09-21, abaixo); a Lista com **dois modelos de
Tarefa** — operacional (gestão) e
conversacional (comercial, com acesso ao CRM); e os fluxos de criação da área de IA
(Habilidades, Conhecimento, Agentes + Plugins, o editor de Automações), com
Personalizar como hub. Planos de origem: `plano-tarefas.md` e `plano-ia.md`
(scratchpad da sessão). O que decidiu, o que emendou, o que fechou e o que ficou
aberto:

**Emendado em 2026-09-21.** O Espaço de Trabalho passou a se chamar **Instituto Igor Alves** —
o nome antigo não pode mais aparecer em lugar nenhum. Metas continua fora do produto. O menu
lateral do Trabalho voltou a listar as telas da pessoa (Início, Notificações, Visão geral,
Minhas Tarefas), e por isso as **quatro portas saíram do Início**: a leitura que elas faziam
vive nas telas de destino e, para as duas pendências, na barra global. O palco foi redesenhado
sobre uma imagem de referência que o usuário mandou — esfera de pontos grande à direita
sangrando pela borda, trilhos de luz varrendo por trás, saudação em display, o campo da
pergunta como controle principal e o Explorar no rodapé —, e o HUD do topo (Espaço de Trabalho,
data e hora) saiu com o fio de luz sob ele. **No fim do mesmo dia o usuário mandou refazer o palco
do zero** — "ignorando tudo que foi pedido antes, apenas mantenha a id visual", "algo em movimento
e com efeito do mouse", "remova tmb o explorar" —, e o palco da imagem de referência durou um dia:
saíram a esfera (o arquivo `design/globo.tsx` foi apagado), o anel de varredura, os trilhos de luz
e o **Explorar**; entrou o **campo vivo** (`design/campo-vivo.tsx`), um canvas que cobre a capa
inteira com a grade de pontos do sistema respirando numa onda, o monograma da marca emergindo dos
pontos e o cursor como campo de força. **Horas depois, o monograma pontilhado saiu** — "a logo da N1 não
deve ser nesse efeito pontilhado, quero outro efeito e que ela se comporte como um 3d flutuante
reagente ao mouse" — e entrou a **marca 3D** (`design/marca-3d.tsx`): o `BrandMark` do manual como peça
com espessura (nove cópias em `translateZ`), flutuando em CSS e virando para o cursor com inércia,
com brilho na face e sombra no chão; o campo vivo perdeu a máscara do monograma e ficou só como fundo
(abriu P28). A tela ficou com uma ação só: a pergunta. **Em 2026-09-22 o campo trocou de matéria:**
"quero algo animado em movimento no fundo estilo waves de traços" — a grade de pontos saiu e o
canvas passou a desenhar um **tecido de ondas de traços** (~45 linhas finas ondulando juntas por três
senos e um envelope, com trechos de luz correndo por elas); o cursor continua campo de força (abre o
tecido e o acende — sem halo: o disco de luz que acompanhava a mão saiu no fim do mesmo
dia, "quero o efeito do hover porém sem essa luz roxa no cursor"), a zona calma continua
apagando o que fica atrás do texto, e o resto do
contrato (nascimento após a capa, `ativo`, movimento reduzido) não mudou. Detalhe em
`docs/05-design-system/DIRECAO-VISUAL.md` §4 e em `COMPONENTES.md` ("O palco do Início"); a tela,
em `INVENTARIO-DE-TELAS.md`, T02.

### O Tipo da Tarefa na criação (fechado em 2026-09-22)

O Tipo sempre foi atributo da Tarefa e `createTask` sempre aceitou `taskTypeId`, mas
nenhuma tela o passava: toda Tarefa nascia com o Tipo padrão da Lista e quem queria
outro criava e corrigia na ficha. O usuário apontou ("a lógica de ao criar task escolher
o tipo dela não foi aplicada") e a escolha entrou em todas as portas de criação —
barra da Lista, "+" de cada grupo (tabela, quadro e tabela do Financeiro), compositor de
Subtarefa, aba Tarefa do fio de conversa e o diálogo da Tarefa conversacional —, pelo
`SeletorDeTipoDeTarefa`, que se apaga onde não há escolha. A regra do Tipo padrão saiu
de dentro de `createTask` e virou `tiposDaLista`/`tipoPadraoDaLista` em `data/derive.ts`,
para a tela pré-escolher exatamente o que o domínio escolheria. **Fora do escopo, por
enquanto:** "De modelo" (o Template decide), a conversão de item de Checklist em Tarefa e
o Formulário público continuam com o Tipo padrão.

### C36 — Canais de atendimento da Lista conversacional (2026-09-22)

**Pedido.** "Ao criar uma lista conversacional… a pessoa vai precisar configurar os canais em que ela vai fazer o atendimento. Ela vai marcar lá e vai ativar: WhatsApp, e-mail, Instagram, TikTok, LinkedIn. Aí precisa ter um painel no momento em que ela ativa para ela conectar e selecionar… as opções que já estão conectadas a nível global"; e a opção de **adicionar** esses meios, com o popup mostrando o que preencher, e um lugar para dizer **de que setor é** e **de onde vem** cada conta. Fechado com o usuário: setor = **Fila padrão**, de onde é = **Origem padrão** (os dois já eram do Canal); a conta adicionada **fica conectada para aquela Lista** (nasce no Espaço de Trabalho, conectada, e marcada na Lista); **TikTok fora** por ora; os canais **mudam a qualquer momento**.

**O que existe.** Domínio: atributo nativo `List.canaisDeAtendimento` (C36 em `ontologia/DECISOES-E-PENDENCIAS.md`), `createList` exige ≥1 na conversacional, `definirCanaisDaLista`, `alterarModeloDaLista` para operacional apaga; guardas em `criarTarefaConversacional`, `trocarCanalDaTarefa` e `iniciarConversa`; o Canal ganhou `criarCanal` e `configurarCanal` (`data/operations/canais.ts`), com a forma canônica do identificador por tipo e o rótulo do Tipo de Canal com fonte única (`CHANNEL_TYPE_LABEL` virou alias). Derivações `canaisDaLista`, `canaisDaListaQueAlcancam`, `listaSemCanais`. Seed: Pós-venda atende por WhatsApp e e-mail; SDR por WhatsApp e LinkedIn; Closer e Venda direta por WhatsApp e e-mail; Validação só por WhatsApp. Tela: o bloco `CanaisDeAtendimento` no D16 e nas Configurações da Lista (T11), o popup D33, as pílulas "Atende por" no cabeçalho da Lista, o aviso e "Nova Tarefa"/"Iniciar conversa" desligados numa Lista sem canais, e os quatro lugares que escolhem Canal (Nova Tarefa conversacional, Iniciar conversa, trocar Canal na ficha, aba Tarefa do fio) limitados aos canais da Lista. A ficha do Canal (T23) edita o Setor e a Origem.

**Em aberto.** TikTok (Tipo de Canal novo); arquivar Canal limpando a referência nas Listas (quando arquivar Canal existir); [Novo Canal] direto na lista de Canais da Caixa de Entrada (hoje só se adiciona pelo bloco da Lista); conexão em dois atos com provedor de verdade (12.2).

### C35 — Modelo de Tarefa da Lista: a decisão de implementação

**Situação.** O usuário pediu que toda Lista declare, ao nascer, se recebe Tarefas
conversacionais (com acesso ao CRM) ou operacionais (o modelo comercial × gestão). A
ontologia não tem esse atributo: a Lista contém apenas Tarefas (RN-LIS-02) e a Tarefa
se relaciona com o CRM por Vínculos (RN-TAR-15; tarefa.md 8.2).

**Alternativa adotada.** Sem entidade nova e sem campo novo na Tarefa:

- **Onde mora o modelo.** `List.modeloDeTarefa: "operacional" | "conversacional"`,
  atributo **nativo e obrigatório** da Lista (irmão de `isPrivate`), **não** um
  `ConfigurableAspect` — não herda e não bloqueia, porque um Espaço mistura os dois
  modelos; B25 é para configuração que a Tarefa consome, e o modelo diz o que a Tarefa
  **é** ao nascer. `createList` aplica `operacional` quando ausente; o compilador foi a
  migração (todo construtor de `List` declara). Imutável depois da primeira Tarefa,
  contando a lixeira (`alterarModeloDaLista`: "O modelo de Tarefa não muda numa Lista
  que já tem Tarefas.").
- **Como a Tarefa aponta para o CRM — só Vínculos.** `task→contact` papel "contato da
  Tarefa", `task→conversation` "conversa da Tarefa", `task→deal` "Negócio da Tarefa"
  (opcional). O Canal vem da Conversa vinculada (INV-CXE-04); a Proveniência
  `{ kind: "contact" }` é valor histórico (A8). A Subtarefa lê os Vínculos da raiz (B1).
  Nada é gravado na Tarefa; `derive-conversacional.ts` recomputa tudo.
- **`TAREFA_SEM_CONTATO`.** Numa Lista conversacional, `createTask` recusa a Tarefa
  raiz que chega sem Vínculo a Contato ("Nesta Lista toda Tarefa nasce de um
  Contato."). `CreateTaskInput.vinculos` é a única porta: um só escritor cria a Tarefa
  e o que a liga ao CRM, e os Links caem no rollback do Status. `moveTask` recusa entrar
  numa conversacional sem Contato; sair para uma operacional é livre — o modelo é da
  Lista, não da Tarefa.
- **Os chamadores de `createTask` sem Contato recusam explicitamente.** O Formulário
  público (`/f`, `scale.ts`), o Template de Tarefa (`planning.ts`), o compositor por
  título e a aba "Tarefa" do fio numa Lista operacional continuam a criar pelo título;
  apontados a uma Lista conversacional, **batem em `TAREFA_SEM_CONTATO`** com a mesma
  frase que a tela mostra — a aba "Tarefa" do fio é a exceção que sabe o modelo e chama
  `criarTarefaConversacional` com o Contato da Conversa e o Canal ativo. Formulário e
  Template para Lista conversacional ficam **sem caminho** de propósito: uma Tarefa que
  nasce de um formulário anônimo não tem Contato, e decidir se o formulário deveria
  resolvê-lo (por e-mail, criando o Contato) é decisão de produto.
- **`criarTarefaConversacional`** é um gesto com dois atos do domínio, na ordem em que
  as regras valem: a Conversa abre no Canal (ou a aberta é reaproveitada — é ela que
  recusa o Contato sem Identificador que o Canal alcance) e a Tarefa nasce com os
  Vínculos; recusada a segunda, a primeira é desfeita. Canal `desconectada` recusa;
  `comErro` passa, porque pode voltar sozinho.
- **Automações.** Nenhum Evento novo: `tarefaCriada` dispara igual.

**Consequência.** A ficha da Tarefa ganha três regiões (ficha · conversa · Atividade)
e a seção CRM; o Quadro ganha o cartão com rosto; a Tabela, as colunas Contato e
Canal; a Caixa de Entrada e a ficha do Contato, o painel de Tarefas conversacionais.
`Comercial › Pós-venda` (seed) é a conversacional pura — sem Funil, sem valor. Fica
aberto formalizar o atributo em `lista.md` §6 ou como Funcionalidade (constituição,
C35).

### C33 emendado — o espelho de "Meus negócios"

As quatro Listas `lst_funil_*` são **conversacionais**, e a Tarefa-espelho nasce com
o Vínculo ao **Contato principal** do Negócio (além do "espelho do Negócio"), no seed e
em `iniciarConversa` — por isso `contatoDaTarefa` a resolve e as Reuniões ligadas só ao
Negócio caem no mesmo fallback. O espelho é o caso particular da Lista conversacional:
conversacional **com** Negócio obrigatório, a barra "Iniciar conversa" e o subtotal em
dinheiro (`comValor`). Precedência das lentes na página da Lista: **financeira >
espelho comercial > conversacional**. O espelho **continua cópia** — nada sincroniza
(a tabela B, C33, foi emendada).

### O que fecha do RELATORIO ("ação ausente", Fase 6)

Da primeira lista do "NÃO FEITO": criação de **Agente** (o Construtor grava rascunho
ou ativa; `createAgent(…, { ativar })`), **Habilidade** (D18, D19), **Automação**
(D30), **Coleção** (D24) e **Documento** (D25) — e a **Lista** com modelo (D16) e a
**Tarefa conversacional** (D17). Da segunda: **cancelar Execução** (`cancelarExecucao`,
na ficha do Agente, RN-AGE-21), **conectar e desconectar Integração**
(`conectarIntegracao`/`desconectarIntegracao`, com o impacto contado — D32), **criar
Tarefa a partir da Conversa** (D17, na Caixa de Entrada) e **remover Item de Memória
do Agente** (`apagarItemDeMemoria`); arquivar e desarquivar Agente, Habilidade,
Automação, Coleção e Documento ganharam gatilho em tela. Espaço, Pasta, Lista, Contato,
Empresa e Negócio já tinham criação por lotes anteriores a este (`?criar=`). Continuam
sem criação: Etapa, Funil, Fila, Papel, Painel, Widget e Equipe; continuam sem gatilho:
suspender/reativar Membro, reenviar Mensagem `falhou`, criar Negócio a partir da
Conversa (a Tarefa sim; o Negócio nasce da Tarefa conversacional — "Criar Negócio a
partir desta Tarefa"), exportar Painel e conectar Canal. As linhas do RELATORIO estão
marcadas.

### P14. O Modelo não executa: Chat e Ensaio são determinísticos

Nenhuma chamada de Modelo existe no protótipo. O Chat responde pelo motor de sempre;
o **Ensaio** (`ensaiarAgente`) grava uma Execução real com `rehearsal` e passos
**determinísticos** — o raciocínio e uma chamada por Ferramenta permitida (leitura
`concluido`, escrita `simulado`), Referências de Conhecimento até 3 —, sem Modelo por
trás. É o suficiente para a tela de Execução, a Cadeia e o Custo terem o que mostrar.
Fecha com um adaptador de Modelo (B75) e a Composição do Contexto real.

### P15. Acionar Automação manualmente e ramificar

O Gatilho `manual` é oferecido no editor e validado, mas não há botão "Acionar" nem
operação `acionarAutomacao` (o plano a deixou como "se sobrar"); o controle
`ramificar` está fora do catálogo (`CONTROLES` o exclui; `adicionarAcao` recusa com
"Ramificação não entra neste protótipo."). O editor oferece tudo que o tipo admite e
marca o que o motor roda ("executa no protótipo"): só Lista × (Tarefa criada, entrada
em Status, distância do vencimento), Grupo/Comunidade/Espaço de Trabalho × Eventos de
Grupo, Flow/Espaço de Trabalho × Resposta de Flow. Fecha com `execute()` exportado
dos motores e o aninhamento de ramificação (C8: profundidade 3).

### P16. Fonte URL e Fonte de Integração não sincronizam

`adicionarFonte` cria a Fonte com a Política de atualização (manual ou periódica) e o
estado operacional (`comErro` quando a Integração está desconectada — 20.6), mas
nenhuma Atualização roda: não há "Atualizar Fonte", nem captura de URL, nem
Documentos criados por sincronização (o seed traz um Documento com Proveniência
`fonte` de URL para a tela saber exibir). A captura do envio por URL é simulada
(um Fragmento com a página). Fecha com um agendador e o adaptador da Integração; então
entram RN-CNH-18 (arquivar o ausente na origem) e RN-CNH-19 (eliminar Fonte com
escolha explícita).

### P17. Template de Agente e atribuir Papel ao Agente

Instanciar Template de Agente (da plataforma ou do Espaço de Trabalho — B81) e atribuir
Papel ao Agente (governança por Papel — B95, RN-ET-24) não têm operação nem tela: o
Agente nasce só pelo Construtor e fica com o Papel Convidado (B76). A aba Permissões
de T28 mostra só o Papel, em Configuração. Fecha com `instanciarTemplateDeAgente` e
`atribuirPapelAoAgente` (com a recusa INV-ET-13: nunca Proprietário/Administrador).

### P18. Criar Integração

Conectar e desconectar existem; **criar** uma Integração (nome, tipo de sistema,
credenciais que nunca são exibidas depois — T48) não. O seed traz `int_agenda`
desconectada para os fluxos de conectar/reconectar terem alvo. Fecha com a operação e
um diálogo em `/configuracoes/integracoes`; "remover" (a cascata enumerada de T48)
vai junto.

### P19. Unificar o Conhecimento do Construtor com a Concessão

Há duas verdades: o Construtor grava `knowledgeSources` na Versão do Agente
(declaração da UI), e a Coleção grava a Concessão (`collectionGrants`, DO-CNH-12), que é
a que vale para `conhecimentoAcessivel`. A ficha do Agente mostra as duas e marca a
declaração sem Concessão ("declarada no Construtor, sem concessão") com [Conceder].
Fecha quando o Construtor conceder de verdade ao publicar — ou deixar de gravar a
declaração.

### P20. A seed nasce às 9 h UTC e deixa Mensagens de "hoje" no futuro depois das 21 h BRT

`BASE = Date.UTC(ano, mês, dia UTC, 9)` (`seed.ts`) e `at(daysAgo, hour)` posiciona
as Mensagens de hoje por hora. Depois das 21 h no horário de Brasília o dia UTC já
virou: `BASE` salta 24 h à frente e tudo que é "hoje" — Mensagens, Execuções, a última
interação — fica no futuro ("em 8 h"). Relatado pelo lote de verificação. Fecha com a
`BASE` no fuso da Localidade do Espaço de Trabalho (`workspace.locale.timezone`, como
P1 fez com a formatação) ou ancorada em `Date.now()` — decidir junto com o relógio
virtual dos testes.

### P21. Linha do tempo e Carga saíram das Listas conversacionais — inclusive do espelho

A página da Lista filtra as Visualizações `linha` e `carga` quando o modelo é
conversacional, e o espelho de "Meus negócios" é conversacional (C33 emendado): as
duas Visualizações que ele tinha saíram junto. A leitura adotada é que Carga e Linha do
tempo são da gestão de esforço e uma Lista comercial não planeja esforço; se o
espelho precisar delas (a data prevista de fechamento como linha do tempo), a
exceção é uma condição a mais em `listas/[lista]/page.tsx`, não uma decisão de
domínio.

### Revisão adversarial de 2026-09-18

Uma rodada de achados numerados (`leva-d-confirmados.md`, scratchpad da sessão),
corrigidos em sete lotes paralelos (A domínio da IA · B seed · C Tarefas e Listas ·
D ficha conversacional · E Início, barra e busca · G UI da IA · orquestrador) e
revisados um a um por CDP e vitest. **O que fechou**, uma linha cada:

- **Formulário em Lista conversacional** — `createForm`/`updateForm` recusam com
  `FORMULARIO_EM_LISTA_CONVERSACIONAL` ("Nesta Lista toda Tarefa nasce de um Contato:
  um Formulário público não cria Tarefa aqui."), `formOutdatedReason` e `submitForm`
  dizem o mesmo; `alterarModeloDaLista` só vira conversacional depois de arquivar os
  Formulários (`FORMULARIOS_ANTES_DO_MODELO`); o editor de Formulários e o Toggle de
  T11 mostram as frases como `disabledReason`.
- **Mesclagem migra Vínculos** — `mergeContacts` reaponta `state.links` do absorvido
  ao sobrevivente e funde duplicatas; `contatoAlcancado` resolve `mesclado` por
  `mergedIntoId` e esconde Contato, Conversa e Negócio `na lixeira` (RN-TAR-15).
- **Restaurar Agente/Automação com permissão e nome** — `recusaDeRestaurarAgente`
  (administrar + colisão RN-AGE-02) e `recusaDeRestaurarAutomacao` (`'restaurar'` em
  `AcaoNaAutomacao` + colisão RN-AUT-03 por escopo), lidas pelas fichas.
- **Validação RN-AUT-07/RN-AUT-21 por Disponibilidade** — `validarAutomacao` e
  `inoperante` olham `disponibilidadeDaConcessao` na Condição híbrida e na Ação
  Invocar Agente ("A Habilidade “X” está indisponível para o Agente “Y”: …").
- **Tipo de conteúdo na nova Versão** — `novaVersaoDoDocumento` e
  `restaurarVersaoDoDocumento` recalculam `contentType` (Registro "Tipo de conteúdo:
  PDF → texto"); áudio/vídeo restaurado volta a `pendente`.
- **Fábrica única de Versão de Agente** — `montarVersaoDoAgente` (agentes.ts) para
  conceder, permitir, retirar e publicar no Construtor: `grantedSkillIds` sempre relido
  das Concessões; o seed grava na Versão 1 as Concessões seedadas.
- **Catálogo com as Ferramentas comerciais e descrições reais** — 39 Ferramentas (as 8
  do processo SDR/Closer: criar_negocio, vincular_conversa_negocio,
  mover_negocio_etapa/funil, marcar_negocio_perdido, atualizar_campos_contato/negocio,
  alterar_proprietario_negocio), cada Ferramenta, Habilidade e Agente com frase própria;
  Evento `contatoCriadoPorMensagem` (RN-CXE-06); as Automações do seed escutam no
  escopo certo (Mensagem na Caixa de Entrada, Tarefa na Lista) e nenhuma nasce
  inoperante.
- **Ficha conversacional empilhada** — abaixo de `@4xl` o fio de Mensagens tem altura
  definida (`--conversa-empilhada-min`), o Rascunho do Agente nasce recolhido numa
  linha, a Atividade recolhida é um botão no cabeçalho da Conversa e só há duas
  rolagens (fio e ficha); o compositor fica à vista a 1024×768.
- **Barra global sem números no SSR e com rótulo acessível** — o detalhe ("3
  atribuídas, 0 vencidas") só entra hidratado; o rótulo vive na árvore acessível em
  toda largura (`sr-only` abaixo de `lg`, `data-so-icone="abaixo-lg"`).
- **Foco da busca pelo "/"** — `/buscar` foca o campo ao chegar sem `q`; com `?q=` não
  rouba o foco.
- **Saudação da madrugada** — `saudacao(now, timezone)` (`features/shell/relogio.ts`):
  Boa noite 0–4 h e 18 h+, Bom dia 5–11 h, Boa tarde 12–17 h, no fuso da Localidade.
- **Botão de envio acessível** — `aria-disabled` + `aria-describedby` ("Escreva a
  pergunta primeiro."), focável, clique engolido; `<time dateTime>` em ISO no fuso.
- **Marca em evidência no Início** — marca-d'água centrada atrás do globo
  (`data-lado="centro"`, `--marca-dagua-opacidade-palco`), a marca de apresentação
  em `display` entre o globo e a saudação, HUD só com Espaço de Trabalho e data · hora;
  sem rolagem a 1440×900, 1280×720 e 1024×768. **Desfeito em 2026-09-21**: o palco novo
  tirou a marca-d'água, a marca de apresentação e o HUD; a marca fica no trilho e no painel —
  e, desde o fim do dia, volta ao Início como a **marca 3D** (`design/marca-3d.tsx`), acima da
  saudação; a tela segue sem rolagem nas três larguras.
- **Recortes Hoje/Esta semana em Minhas Tarefas** — abas Atribuídas a mim · Vencidas ·
  Hoje · Esta semana · Todas, com contadores e `?recorte=`; à época a porta do Início abria em
  `?recorte=vencidas` quando havia vencidas — a porta saiu em 2026-09-21 e o atalho ficou sem chamador.
- **Ensaio pela URL** — `?ensaiar=1` é lido uma vez e limpo por `router.replace`;
  voltar da Execução não reabre o diálogo.
- **Conceder com motivo** — `recusaDeConcederAAlgumAgente` ("O Papel Convidado não
  edita Agente." / "Você não governa nenhum Agente que possa receber Concessões.") na
  ficha, no catálogo e no diálogo; a Habilidade fixa sem Versão publicada entra no
  Select com o aviso de que a Concessão nasce indisponível.
- **Toast do "Criar e abrir"** — `marcarChegada`/`lerChegada`/`consumirChegada`
  (`recente.ts`); `useAvisos` nasce com o Toast da chegada em toda ficha.
- **Seletor sem Ferramentas legadas** — `FERRAMENTAS_DEPRECIADAS` (alterar_status,
  criar_comentario, enviar_mensagem) fora da Ação nova; a existente leva a pílula
  "legado" com a equivalente que executa.
- **Editor sem rolagem horizontal** — `min-w-0` nas listas de Condições e Ações.
- **`useModal`/combobox** — o primeiro campo focado inclui o `Select` do sistema.
- **`surgir` + `data-recente`** — `.surgir[data-recente]` e `.surgir-rapido[data-recente]`
  rodam as duas animações (subir e destacar).
- **`.rotacao`/`rotate`** — transiciona também a propriedade individual `rotate`.
- **Harness** — a sonda `REPOUSO` conta `rotate`/`translate`/`scale` individuais.
- Também: o diálogo D17 volta aos props a cada abertura e não oferece as cópias do
  Funil; a peça do modelo não cita mais o ClickUp (e, em 2026-09-22, perdeu o sufixo: é "Operacional" e "Conversacional", sem "— gestão" e "— comercial", a pedido do usuário).

**O que segue aberto:** P14–P21 como estão, mais o que os lotes deixaram. As
ressalvas das revisões (foco dos controles do Rascunho e da Atividade no empilhado,
hover do envio em `aria-disabled`, marca-d'água no celular, folga do anel, o tooltip
do Tipo no Documento, Restaurar no catálogo lendo `recusaDeRestaurar*`, a frase da
Ação legada, `comunidade`/`flow` em `RESOURCE_TYPE_LABEL`, as descrições do seed, a
página `/f` com Formulário desatualizado, o `describedBy` do Toggle e a frase do Select
de Lista em D17) foram aplicadas na mesma rodada e conferidas no código.

### P22. Catálogo de Personalizar: `line-clamp-2 block` não corta as descrições

`catalog-grid.tsx` usa `line-clamp-2 block` na descrição do cartão; o `block`
sobrescreve o `display: -webkit-box` do corte, e as descrições reais (2026-09-18)
alongam os cartões ("Criar Tarefa" em cinco linhas). Fecha tirando o `block`.

### P23. Ficha conversacional empilhada: o regime abaixo do mínimo

Com a Atividade aberta a 1024×768 (ou num popup com menos de ~700 px de altura) a
ficha cai aos 120 px do `min-h`, corta "Adicionar descrição…" e voltam três rolagens
(coluna, ficha, fio); o compositor só aparece rolando a coluna. Aceitável para o alvo
(1024×768 no estado inicial); fecha subindo o mínimo da ficha a ⅞ do
`--conversa-empilhada-min` ou limitando o aside a metade de `--conversa-empilhada-h`
no empilhado. Na mesma família: a ficha do Agente a 1280×800 mostra "Ferramentas
permitidas" invadindo a coluna direita — largura pré-existente a conferir.

### P24. O seed usa um Contato na lixeira como principal de um Negócio espelhado

`deal_sdr_perd_2` tem por Contato principal um Contato `na lixeira`, e a Tarefa-espelho
fica sem Contato exibível (RN-TAR-15); `seed-produto.test.ts` exige o Vínculo e aceita
`undefined` só nesse caso. Decidir se o seed evita o caso ou se a regra fica.

### P25. Sobras de texto e limitações assumidas em 2026-09-18

D28 (Nova Versão) não avisa que o Tipo de conteúdo passa a acompanhar a Versão; um
Documento `paginaWeb` que restaura uma Versão de texto volta como `texto` (a Versão
não guarda a origem); `updateForm` recusa por inteiro na Lista conversacional,
inclusive pausar (`archiveForm` e `rotateFormSecret` seguem abertos); `?nova-tarefa=1`
+ Cancelar espera o `router.replace` (~200 ms) antes da saída — pré-existente;
`DIRECAO-VISUAL.md` cita só `--conversa-empilhada-h` e falta `--conversa-empilhada-min`.

### P26. O telefone: a casca não recolhe o painel, e o Início não cabe

(2026-09-23: com o robô, o palco empilha numa capa estreita — robô em cima, texto embaixo —, mas a 390 px a casca continua comendo a largura; o resto desta pendência vale.)

A 390×844 o trilho (56 px) e o painel do assunto (232 px) comem 288 px dos 390 e sobra uma
coluna de ~100 px. No Início a saudação quebra e fica cortada na borda ("Boa / tar… / Thi…"),
o campo da pergunta vira uma cápsula estreita só com o ícone. (A esfera e os trilhos, que sumiam
por `@media (max-width: 767px)`, não existem mais desde o refazer de 2026-09-21: o campo vivo cobre
a capa em qualquer largura.) Desde 2026-09-24 a tela rola (o corpo, até o resumo), mas o palco continua sem caber na largura — a tela simplesmente
não cabe. Verificado por CDP em 2026-09-21. Fecha recolhendo o painel por largura (hoje o
`collapsed` do `AppShell` só muda por clique) ou virando gaveta abaixo de `md`. O alvo declarado
do produto continua 1024×768, onde o palco está correto: é pendência, não defeito de entrega.

### P27. Sobras do palco antigo no CSS e nos tokens

**FECHADA em 2026-09-21.** No refazer do palco saíram `.marca-dagua[data-lado="centro"]`,
`--marca-dagua-opacidade-palco` e, depois, a variante `[data-lado="direita"]` — o Login usa
`.marca-dagua` sem atributo. O comentário de `--cascata-inicio` passou a citar o Entrar, que é
o único consumidor do ajuste, e `.orbe-varredura` saiu da allowlist de repouso do harness junto
com o anel. Nada do palco anterior ficou sem consumidor.

### P33. A rolagem suave e a cena num computador sem GPU

Aberta em 2026-09-24, com o Início rolando. Com a cena do robô a desenhar por software (o Chrome sem GPU, ou com a aceleração desligada), a página cai a ~2,5 quadros por segundo e a rolagem SUAVE programática (o atalho "Seu resumo", a volta pelo robô flutuante) demora mais de um segundo para começar a andar — medido em headless com swiftshader; com a cena pausada (o resumo cobrindo o palco) são 42 quadros. Numa GPU de verdade não acontece, e o movimento reduzido rola instantâneo. Se aparecer no mundo real, o corte é pausar a cena durante a rolagem suave (ou trocá-la por uma imagem abaixo de um orçamento de hardware, P29).

### P32. Mensagens novas nunca diminuem: a leitura não é registrada

Aberta em 2026-09-24, com o resumo. "Mensagens novas" conta as Mensagens `recebida` sem Leitura interna do Membro — a MESMA conta da aba "Não lidos" da Caixa de Entrada (`naoLidas`, agora em `data/derive-resumo.ts`). Só que a operação `markConversationRead` existe e NENHUMA tela a chama: abrir a Conversa não registra a leitura, e as 13 do seed ficam "novas" para sempre. Alternativa adotada: a mesma definição da Caixa, resolvidas inclusive — a aba "Não lidos" conta toda Conversa ativa do escopo, sem olhar o estado (os números batem; o defeito é de lá). Fecha registrando a leitura ao abrir o fio (a ontologia diz que a Leitura interna vale também para `interna`, e a Caixa conta só `recebida` — decidir junto).

### P31. O robô flutuante: um rosto em foto e o contrato do canto

O rosto do círculo (`public/inicio/robo.webp`) é uma captura estática da cena do Início, não a cena: se o robô do Spline mudar de cor, de pose ou de cena, recapture — 1600×1000 a 2×, `prefers-reduced-motion: reduce`, esconder `.inicio-capa::after`, `.holofote`, `.inicio-saudacao`, `.balao-do-robo`, `.botao-de-voz-area` e `.caixa-do-assistente`, recorte de 440 px centrado 2 px à direita e 110 px acima do centro de `.cena-spline-boca`, reduzido pelo próprio navegador a 256 px e exportado em WebP 0,9 (o script ficou no scratchpad da sessão; não é ferramenta do repositório). O contrato do canto (COMPONENTES › `RoboFlutuante`) depende de cada barra colada no pé da tela declarar `.doca-do-robo`: uma barra nova sem ela fica com o fim por baixo do robô. Limitações assumidas: a reserva no fim do que rola é um `::after` em bloco — um rolador em grade de várias colunas a trataria como célula; só o rolador sob o CENTRO do robô é achado; e conteúdo que rola passa por baixo dele antes de chegar ao fim (a ficha do Contato), como sob qualquer botão flutuante. Desde 2026-09-24 o flutuante também aparece no Início, com o robô do palco fora da vista pela rolagem, e ali volta ao palco em vez de navegar; a reserva no fim vai para o corpo do Início.

### P30. O assistente do Início só reage — não entende nem busca

Aberta em 2026-09-23, com a voz. O pedido foi explícito: "apenas habilite o microfone e reaja à fala, não armazene o áudio em lugar algum". Então o robô percebe começo e fim de fala pelo nível do som e responde com um som sintetizado; não há reconhecimento de fala, não há resposta com conteúdo e não há "pesquisa" de verdade. **Desde o fim de 2026-09-23 a logo abre uma caixa de texto** ("para o user digitar o que ele quer saber e o robô responde", com o microfone só pelo botão dele) e o robô RESPONDE EM TEXTO com o que o app já sabe — intenções por palavra (tarefas, notificações, negócios, contatos, conversas, ajuda, saudação; `respostas-do-robo.ts`) sobre o panorama do Membro lido do armazém na hora (`panorama-do-robo.ts`) — pela voz (uma sílaba por palavra) e, com Silenciar ou Legenda, num balão ao lado da cabeça, guardado na aba (`sessionStorage`). Fora dessas intenções ele diz que não sabe e diz o que sabe. Continua SEM modelo: responder de verdade exige um por trás (o Assistente de IA › Chat, B83?) e decidir se o texto pode sair do navegador (hoje não sai). Abertos menores: não há como limpar o balão além de fechar a aba; a intenção é por radical ("conversar" cai em conversas); e a resposta a uma fala pelo microfone é sempre a mesma frase (o robô não entende fala). Evoluir para uma pesquisa por voz exige decidir, com o usuário: reconhecimento no navegador (Web Speech API — em Chrome o áudio VAI para servidores do Google, o que contraria o "não armazene em lugar algum") ou um modelo local; e o que a pesquisa consulta (a busca global da barra? o Assistente, em IA › Chat?). Também: em telas de toque não há hover, então a logo só se revela acesa quando ligada; e o limiar do detector foi afinado com fala sintética — ajustar com microfones reais se reagir demais ou de menos. **Desde o fim de 2026-09-23, sem microfone a conversa segue SIMULADA** ("quando o microfone não puder ser conectado quero que simule a fala"): uma fala sintetizada faz as perguntas de um roteiro fixo de seis (`ROTEIRO_SIMULADO`) e o robô responde com o panorama real, até a pessoa tocar de novo. Consequências assumidas: as retentativas automáticas saíram — um microfone liberado ou conectado no meio da simulação NÃO é usado sozinho; encerra-se a conversa e toca-se de novo; o roteiro é fixo (não aprende nem varia com o que a pessoa faz); e a fala simulada é um timbre sintetizado, não voz de gente (uma voz de verdade exigiria `speechSynthesis`, e as vozes "Google" do Chrome mandam o texto para fora do navegador). No Windows, a caixa dá o atalho `ms-settings:privacy-microphone` quando o bloqueio é do sistema. Abrir o app pelo IP da rede em http não dá microfone (a página não é segura): para testar num celular, é preciso https no servidor de desenvolvimento.

### P29. O robô do Início depende da rede e do Spline

Aberta em 2026-09-23, com o palco novo. A cena do robô é servida por `prod.spline.design` (1,3 MB) e o runtime busca o resto do Spline na hora: sem rede, ou com o Spline fora do ar ou a cena despublicada, o robô some — a barreira de erro segura a tela e o palco fica preto (verificado com a URL bloqueada, ainda com a saudação e a pergunta, que saíram depois no mesmo dia). O robô também não para quando a pessoa sai para outra aba do app sem desmontar a tela (a aba escondida já para o `requestAnimationFrame`). Fecha, se valer: hospedar o `.splinecode` no próprio app (`public/`). Parar a cena fora da vista já acontece desde 2026-09-24 quando o resumo cobre o palco (`ControleDaCena.pausar()`; `retomar()` ao rolar de volta) — a aba escondida continua como estava. E, ao contrário do pedido original, o palco não usa o `Card` do shadcn (contrariava o pedido anterior de um palco sem card e sem cantos), e o `Spotlight` saiu de cima do palco — voltou no fim de 2026-09-23 como o `Holofote`, ATRÁS do robô, a pedido. **Frágil por construção:** a câmera fixa e a entrada curta dependem de parar a transição de "Start" da própria cena por DENTRO do runtime (`app.eventManager.handlers.Start.eventsPerObject`), porque a API pública não desfaz uma transição em curso. Se uma versão nova do runtime mudar essa forma, `CenaSpline` avisa no console e a cena volta à abertura original (o robô de corpo inteiro) — nada quebra, mas o enquadramento se perde. Por isso `@splinetool/runtime` está FIXO em 2.0.56. Ao atualizar, conferir a câmera parada em (0, 212, 471), o rosto roxo, e se o motor novo (WebGPU) já aceita `updateTexture` na camada matcap — só então dá para soltar o `renderer: "webgl"` fixo em `CenaSpline`.

### P28. ~~Marca 3D do Início: espessura simulada e só flutuação no toque~~ — FECHADA em 2026-09-23 (a marca 3D saiu do Início)

Aberta em 2026-09-21, com a peça. A `Marca3D` (`design/marca-3d.tsx`) não tem geometria real: a
espessura são nove cópias do monograma em `translateZ(-k × --marca-3d-espessura)` atrás da face, e
em inclinações grandes (perto de `INCLINACAO_MAX`, 16°) a lateral se lê como degraus, não como uma
parede lisa — aceito porque o repouso é um três-quartos leve e a peça nunca passa de 16°. Sem
ponteiro fino (`(hover: hover) and (pointer: fine)` falso: toque) só há a flutuação em CSS; a peça
fica no três-quartos e não reage ao dedo, porque `pointerleave` nunca chega no toque e a inclinação
ficaria presa no último ponto tocado. Também não reage ao giroscópio. Fecha, se um dia valer: uma
lateral real (um `path` extrudado, ou camadas mais finas e em maior número) e, no toque, inclinar
por `deviceorientation` com pedido de permissão. O alvo declarado do produto continua 1024×768 com
mouse, onde a peça está inteira.
