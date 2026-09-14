# PENDÊNCIAS DO FRONTEND

Conceitos que a interface precisou resolver e que a ontologia **não** define, ou que ela deixou explicitamente em aberto. Cada item traz a **alternativa adotada** e a consequência. Nenhuma entidade nova foi criada (regra I.1 do PRD).

Atualizado na Fase 6 · 2026-09-10. A Fase 2 abriu o documento; a Fase 3 acrescentou P1 e P2; a Fase 6 fechou P1 e decidiu C32.

---

## A. Conceitos de interface sem base ontológica

Coisas que a interface precisa e que a ontologia não modela por não serem do seu escopo. Nenhuma delas persiste dado novo.

### A1. Notificação
**Situação.** A ontologia diz que "notificação não é registro da ontologia" (documento 19, 7.4), mas a Ação de controle "notificar" existe, menções notificam (RN-TAR-14) e Solicitações de Aprovação são notificadas (B80).
**Alternativa adotada.** O sino da barra superior é uma **visão derivada** de Eventos e Registros de Atividade dirigidos ao Membro logado, filtrada pelas suas permissões. Não é entidade, não é persistida como registro próprio, não tem estado de ciclo de vida e não aparece na matriz de cobertura como entidade.
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
| C33 | Espelho do processo comercial na Estrutura (Comercial › Meus negócios › Funil) | **Cópia de seed, não sincronização.** Cada Negócio ativo vira uma Tarefa com Proveniência `deal` e um Vínculo ao Negócio (`app/src/data/seed-comercial.ts`), aberta em Quadro. Mover a Tarefa de Status não move o Negócio de Etapa, nem o contrário; a tela da Lista avisa. Ligar os dois (qual lado manda, o que acontece em Ganho/Perdido, quem vê o quê) é decisão de produto e pede backend. |
| C34 | Contas a receber sem Gestão contratual e sem “tempo em Status” | O processo (`docs/07-processos/contas-a-receber.md`) foi implantado com três leituras conservadoras: (1) R1 é a operação “Nova série de parcelas” na própria Lista, não um gatilho em contrato — Gestão contratual não existe na ontologia; (2) R4/R5 (“30/60 dias em pendente”) disparam por vencimento + 30/60 dias, porque o gatilho temporal da plataforma só conhece distância do vencimento; (3) o cliente é um Contato do CRM por Vínculo, e “marcar o cliente como inadimplente” (R6) não escreve no Contato. Fecham com Gestão contratual, gatilho por tempo em Status e um Campo de situação no Contato. |

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
