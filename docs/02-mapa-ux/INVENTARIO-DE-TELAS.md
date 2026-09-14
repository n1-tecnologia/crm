# INVENTÁRIO DE TELAS

Fase 2 — Mapa / Manual de UX · Versão 1.0 · 2026-09-10
Fonte de verdade: `ontologia/` v1.0. Padrões que toda tela obedece: `PADROES-TRANSVERSAIS.md` (não repetidos aqui).

**51 telas + 15 diálogos.** Cada ficha traz: propósito, entidades e atributos exibidos (conferidos contra a seção 6 do documento), estados representados (seção 11), ações e as regras que a interface faz valer (seção 13), cardinalidades dos controles (matriz), estado vazio e permissões.

Convenção: **[E]** entidade · **[A]** atributo · **[D]** derivado · **[VO]** objeto de valor · **⟨n⟩** documento da ontologia.

---

# I. SESSÃO E INÍCIO

## T01 · Entrar — `/entrar` ⟨01⟩

**Propósito.** Escolher qual Membro simula a sessão. Substitui a autenticação; a ontologia distingue Usuário (identidade global) de Membro (relação com o Espaço de Trabalho) — A1.4 — e o produto navegável simula só o segundo.

**Exibe.** [E] Membro: Nome de exibição no Espaço de Trabalho [A], Papel [A], Estado [A], Equipes [A], Disponibilidade de atendimento [VO]. [E] Espaço de Trabalho: Nome [A], Estado [A].

**Estados.** Membro `pendente` (não entra — "Convite não aceito"), `ativo`, `suspenso` (entra em modo somente leitura, com aviso), `removido` (não entra — "Participação encerrada em 12/08"). Espaço de Trabalho `suspenso` exibe aviso e permite entrar só ao Proprietário e Administradores, sem ações com efeito (RN-ET-19).

**Ações e regras.** Entrar como o Membro escolhido. Regra visível: um Membro `pendente` não age e não integra Equipes (RN-ET-12); um `suspenso` tem permissões efetivas vazias para ações com efeito (RN-ET-08).

**Cardinalidade.** Seleção única obrigatória (1 Membro).

**Estado vazio.** Não se aplica: RN-ET-02 garante ao menos o primeiro Membro.

**Permissões.** Nenhuma — é a porta de entrada.

---

## T02 · Início — `/` ⟨06, 12, 14, 17, 19⟩

**Propósito.** Responder "o que é meu e o que espera por mim", sem inventar entidade nova: cada bloco é uma consulta filtrada sobre uma entidade existente.

**Exibe.**
- **Minhas Tarefas** — [E] Tarefa: Título [A], Identificador legível [D], Status atual [A] com Categoria de status [D], Prioridade [A], Data de vencimento [A], Vencida [D], Bloqueada [D], Lista [A], Responsáveis [A]. Agrupadas em Vencidas / Hoje / Esta semana. Filtro: Responsável = Membro logado, estado efetivo `ativo`, categoria não terminal.
- **Conversas atribuídas a mim** — [E] Conversa: Título [A], Contato principal [A] (Nome de exibição [D]), Canal [A], Estado de conversa [A], Tempo de espera atual [D], Janela de resposta aberta até [D].
- **Meus Negócios abertos** — [E] Negócio: Título [A], Etapa [A], Valor [VO] por moeda, Probabilidade efetiva [D], Dias em Etapa [D], Previsão vencida [D], Próxima atividade [D].
- **Aprovações pendentes** — [E] Solicitação de Aprovação: solicitante [A], Motivo [A], Objeto [VO] (Ferramenta + entrada), classe de efeito [A], prazo [A].

**Estados.** Categoria de status; situação do Negócio; estado de conversa; estado da Solicitação (`pendente`).

**Ações e regras.** Abrir registro; alterar Status da Tarefa direto do bloco (com as validações da Lista — RN-TAR-18, RN-CHK-09); decidir Aprovação (abre D09, ou T36 para a lista completa). Regra visível: "meus Negócios" usa Proprietário, não Responsável — o Negócio não tem Responsável (RN-NEG-02).

**Cardinalidade.** Somente leitura + seletor de Status (único).

**Estado vazio.** Por bloco: "Nenhuma Tarefa atribuída a você." / "Nenhuma Conversa atribuída a você." / "Você não é Proprietário de nenhum Negócio aberto." / "Nenhuma Solicitação de Aprovação pendente para você."

**Permissões.** Tudo filtrado pelas permissões efetivas do Membro logado (B20 por analogia). Um Convidado vê apenas o que lhe foi compartilhado.

---

## T03 · Minha conta — `/minha-conta` ⟨01 (7.1), 16 (7.5)⟩

**Propósito.** O único lugar em que o Membro governa o que é dele e de mais ninguém: a sua Disponibilidade e a sua Memória do Usuário.

**Exibe.** [E] Membro: Nome de exibição no Espaço de Trabalho [A], Usuário [A], Papel [A], Equipes [A], Momento de ingresso [A], Disponibilidade de atendimento [VO] (valor, momento, origem). [E] Memória do Usuário: habilitada [A]; [E] Item de Memória: conteúdo [A], origem [A] (Sessão e Execução, ou `Membro`), momento [A], estado [A] (`ativo`/`desativado`).

**Estados.** Disponibilidade `disponível` / `ausente` / `indisponível` (Membro `suspenso` deriva `indisponível`, controle somente leitura). Item de Memória `ativo` / `desativado`.

**Ações e regras.** Editar Nome de exibição; alterar Disponibilidade; habilitar/desabilitar a Memória do Usuário; desativar ou remover Item. Regras visíveis: a Memória do Usuário **nunca retém dados de terceiros** — o painel explica que pedidos como "lembre que o cliente X prefere e-mail" são recusados e redirecionados a Comentário ou Valor de Campo (DO-CHT-11); nunca é vista por outros Membros, Administradores ou Agentes fora de Execução em nome do Membro (INV-CHT-09); não é sucedida (B86).

**Cardinalidade.** Disponibilidade: seleção única. Itens: lista com remoção individual.

**Estado vazio.** "Nenhum fato memorizado ainda. A IA registra aqui preferências suas quando você pede." / Memória desabilitada: "Memória desativada. Nada é gravado e nada entra nas suas conversas."

**Permissões.** Só o próprio Membro. Não existe rota de terceiro.

---

## T04 · Busca global — `/buscar?q=` ⟨transversal⟩

**Propósito.** Encontrar registro por nome ou conteúdo indexável, respeitando permissões.

**Exibe.** Resultados agrupados por entidade: Tarefa, Contato, Empresa, Negócio, Conversa, Documento de Conhecimento, Espaço, Pasta, Subpasta, Lista, Agente, Habilidade, Automação, Coleção, Painel, Funil. Cada resultado: Nome de exibição, tipo, caminho ou contexto, selo de estado quando não `ativo`.

**Estados.** Arquivados aparecem só com o filtro "Incluir arquivados"; `na lixeira` nunca aparece; `mesclado` nunca aparece (resolve ao sobrevivente — B14).

**Ações e regras.** Filtrar por tipo e por estado; abrir. Regra visível: "A busca respeita as suas permissões" — declaração fixa, sem indicador de quantidade oculta (B103 por analogia).

**Cardinalidade.** Filtro de tipos: múltiplo.

**Estado vazio.** "Nada encontrado para *termo*. A busca respeita as suas permissões."

**Permissões.** Cada resultado exige `ver` sobre o próprio registro. Sessão de Chat de terceiro nunca aparece (DO-CHT-09). Conteúdo de Fragmento, Mensagem e Memória nunca é exposto na busca.

---

# II. ESTRUTURA DE TRABALHO

## T05 · Espaços — `/estrutura` ⟨02⟩

**Propósito.** Ver e governar o primeiro nível estrutural.

**Exibe.** [E] Espaço: Nome [A], Descrição [A], Ícone [A], Cor [A], Ordem [A], Privado [A], Estado próprio [A], Estado efetivo [D], Criador [A], Momento de criação [A]. Contagens derivadas de Pastas e Listas visíveis ao consultante.

**Estados.** `ativo`, `arquivado` (com alternador), `na lixeira` (só na Lixeira).

**Ações e regras.** Criar Espaço (com ou sem Template; o Template de Espaço padrão é aplicado quando nenhum é escolhido — DO-ESP-09); reordenar (exige `administrar` — B46); arquivar; enviar à lixeira. Regras visíveis: nome único entre Espaços `ativo`/`arquivado` (RN-ESP-23); Convidados e Agentes não criam Espaços (RN-ESP-18).

**Cardinalidade.** Template na criação: seleção única opcional (0..1).

**Estado vazio.** "Nenhum Espaço ainda. Um Espaço delimita uma área de trabalho com status, campos e permissões próprios." + [Novo Espaço]

**Permissões.** Criar: Papel Proprietário/Administrador ou `criar` sobre o Espaço de Trabalho. Espaço privado só aparece a quem tem concessão direta ou compartilhamento (B38a).

---

## T06 · Espaço — `/estrutura/espacos/[espaco]` ⟨02⟩

**Propósito.** Operar dentro de uma área: ver Pastas e Listas diretas e alcançar a configuração.

**Exibe.** Cabeçalho (T-padrão §1) sem Proprietário — o Espaço não tem (B45). Grade de [E] Pasta (Nome, Ícone, Cor, Nível [D], contagem de Listas) e [E] Lista direta (Nome, Cor, Período planejado [VO], Quantidade de Tarefas [D]). Abas: **Conteúdo** · **Painéis** (Painéis de contexto ancorados neste Espaço — B102) · **Acesso** · **Atividade**.

**Estados.** Estado próprio e Estado efetivo (coincidem no Espaço — o Espaço de Trabalho não usa `arquivado`/`na lixeira`). Selo `arquivado` torna a tela somente leitura, com "Restaurar".

**Ações e regras.** Criar Pasta; criar Lista direta; renomear; reordenar filhos; tornar privado; arquivar; enviar à lixeira; instanciar Template; abrir configurações. Regras visíveis: o Espaço contém **apenas** Pastas e Listas — nunca Tarefas (RN-ESP-02); tornar privado exige Membro `ativo` sem base Convidado e concede `administrar` a quem privatiza, no mesmo ato (RN-ESP-16); em estado efetivo não `ativo`, só leitura, alteração de permissões, restauração e movimentação de descendentes para fora (RN-ESP-11).

**Cardinalidade.** Nenhum seletor de Proprietário, Status ou Prioridade — não existem para contêiner (B45).

**Estado vazio.** "Este Espaço está vazio. Crie uma Pasta para agrupar trabalho ou uma Lista para começar." + [Nova Pasta] [Nova Lista]

**Permissões.** `ver` para abrir; `criar` para Pasta/Lista; `administrar` para arquivar, privar e reordenar; `excluir` para lixeira (B46).

---

## T07 · Configurações do Espaço — `/estrutura/espacos/[espaco]/configuracoes` ⟨02⟩

**Propósito.** Definir a configuração que as Tarefas de toda a subárvore consomem, e tornar a herança legível.

**Exibe.** Abas por aspecto:
- **Conjunto de Status** — [E] Conjunto de Status → [E] Definição de Status: nome, cor, categoria [A] (`não iniciado`, `em andamento`, `concluído`, `fechado`), ordem. Marca do **status inicial padrão** [D] (primeira `não iniciado` na ordem).
- **Campos** — [E] Definição de Campo Personalizado (entidade-alvo Tarefa): nome, Tipo de Campo, opções, obrigatoriedade, ponto de definição [D].
- **Tipos de Tarefa** — [E] Tipo de Tarefa, com o tipo padrão da plataforma não removível.
- **Funcionalidades** — [VO] Funcionalidades habilitadas, indicador por funcionalidade.
- **Visualizações padrão** — [VO] tipos disponíveis e inicial.
- **Bloqueio por aspecto** — [VO] indicador de bloqueio para descendentes, por aspecto.
- **Acesso** — concessões diretas, compartilhamentos, indicador Privado.

**Estados.** Nenhum estado próprio nesta tela além do estado do Espaço; Definição de Campo removida vai para `na lixeira` com os Valores retidos e invisíveis (RN-ESP-07).

**Ações e regras.** Editar Conjunto de Status; remover Definição de Status **com Mapeamento obrigatório** (D01) quando há Tarefas em uso (RN-ESP-06); criar/remover Definição de Campo; criar Tipo de Tarefa; habilitar/desabilitar Funcionalidade; bloquear aspecto. Regras visíveis: o Conjunto exige ao menos uma Definição `não iniciado` e uma `fechado` (RN-ESP-05); nome de Definição de Campo é único em todo o caminho efetivo, nos dois sentidos (B44); **bloquear é rejeitado enquanto houver sobrescritas descendentes** — a tela lista cada uma com um caminho para resolver (RN-ESP-09); desabilitar Funcionalidade não apaga dados (RN-ESP-10).

**Cardinalidade.** Categoria da Definição de Status: seleção única obrigatória. Tipo de Campo: única obrigatória. Funcionalidades: múltiplas.

**Estado vazio.** Campos: "Nenhuma Definição de Campo neste Espaço. As Tarefas usarão apenas os atributos nativos." Tipos: nunca vazio (tipo padrão).

**Permissões.** `administrar` sobre o Espaço.

---

## T08 · Pasta / Subpasta — `/estrutura/pastas/[pasta]` ⟨03, 04⟩

**Propósito.** Mesma tela para os dois níveis de agrupamento. A diferença é o que ela oferece.

**Exibe.** Cabeçalho com caminho efetivo e Nível [D] (1 = Pasta, 2 = Subpasta). Grade de [E] Subpasta (só quando Nível 1) e [E] Lista. Abas: **Conteúdo** · **Painéis** · **Acesso** · **Atividade**.
[A] exibidos: Nome, Descrição (único texto livre — a Pasta não recebe Valores de Campo, DO-PAS-13), Ícone, Cor, Ordem, Contêiner pai, Privada, Estado próprio, Estado efetivo [D], Criador, Template de origem [A].

**Estados.** `ativo`, `arquivado`, `na lixeira`; Estado efetivo derivado do Espaço e da Pasta pai (B36). O cabeçalho nomeia o ancestral que restringe.

**Ações e regras.** Criar Subpasta (**ausente** na Subpasta — A3.4, RN-SUB-02); criar Lista; mover; promover (Subpasta → Espaço) / rebaixar (Pasta sem Subpastas → dentro de Pasta); privar; arquivar; excluir. Regras visíveis: mover Pasta com Subpastas para dentro de Pasta é rejeitado, sem achatamento (RN-SUB-11); a Pasta não contém Tarefas (RN-PAS-02); movimentação atômica com Mapeamento de status, Valores de Campo arquivados e Tipos remapeados (RN-PAS-14).

**Cardinalidade.** Contêiner pai: seleção única obrigatória, restrita a destinos válidos.

**Estado vazio.** Pasta: "Esta Pasta está vazia. Crie uma Subpasta ou uma Lista." Subpasta: "Esta Subpasta está vazia. Crie uma Lista." (sem oferta de Subpasta).

**Permissões.** `ver`; `criar` para filhos; `administrar` para privar, arquivar, mover, reordenar; `excluir` para lixeira (B46).

---

## T09 · Configurações da Pasta / Subpasta — `/estrutura/pastas/[pasta]/configuracoes` ⟨03, 04⟩

**Propósito.** Ver e alterar o modo de herança por aspecto neste nível.

**Exibe.** Por aspecto: modo [VO] (`herdado` / `sobrescrito` / `bloqueado`), ponto de definição [D] nomeado, valor efetivo. Componentes quando `sobrescrito`: Conjunto de Status sobrescrito, Definições de Campo próprias, Tipos de Tarefa próprios, Visualizações do contêiner. Aba Acesso com as quatro origens de permissão.

**Estados.** Reflete o estado da Pasta.

**Ações e regras.** Sobrescrever / voltar a herdar (com Mapeamento — RN-PAS-06); criar Definição de Campo própria; bloquear aspecto para descendentes. Regras visíveis: aspecto bloqueado por ancestral não é sobrescrevível, com o ancestral nomeado (RN-SUB-05); acumulam Definições de Campo, Tipos e Automações; substituem Conjunto de Status, Funcionalidades e Visualizações padrão (RN-SUB-06).

**Cardinalidade.** Modo por aspecto: seleção única por aspecto.

**Estado vazio.** "Tudo herdado de *Comercial*. Sobrescreva um aspecto para definir o próprio."

**Permissões.** `administrar`.

---

## T10 · Lista — `/estrutura/listas/[lista]` ⟨05, 06⟩

**Propósito.** O contêiner operacional. Quatro Visualizações da mesma coleção de Tarefas.

**Exibe.** Cabeçalho com **Caminho efetivo** completo, Nome, Cor, Período planejado [VO], selo de estado. Abas: **Tarefas** · **Painéis** · **Acesso** · **Atividade**. Seletor de Visualização: **Lista** · **Quadro** · **Calendário** · **Tabela**.

| Visualização | O que mostra | Regra |
| --- | --- | --- |
| Lista | Tarefas agrupadas por Status (Definição), com Subtarefas recolhíveis e Progresso de Subtarefas [D] no pai | documento 06, 6.1; DO-STA-06 |
| Quadro | Colunas = Definições do **Conjunto de Status efetivo** [D], na ordem, com cor por categoria; arrastar altera o Status | RN-LIS-05, A4.3 |
| Calendário | Tarefas posicionadas por Data (dia civil sem fuso; instante no fuso da Localidade) | documento 06, 6.2 |
| Tabela | Colunas configuráveis: atributos nativos, derivados e Valores de Campo efetivos | documento 05, 7.3 |

[A] por Tarefa: Título, Identificador legível [D], Status atual, Categoria [D], Tipo de Tarefa, Prioridade, Datas, Vencida [D], Bloqueada [D], Responsáveis (Membro ou Agente), Tags, Progresso de Checklists [D], Progresso de Subtarefas [D], Estimativa, Tempo registrado [D].

**Estados.** Estado próprio e efetivo da Lista; estado efetivo de cada Tarefa. Lista `arquivado`: não recebe Tarefas novas nem movidas; Automações com escopo nela ficam inoperantes (documento 05, 11).

**Ações e regras.** Criar Tarefa rápida (nasce no **status inicial padrão** — Glossário); mudar Visualização; filtrar; agrupar; arrastar entre colunas; mover Tarefa para outra Lista (com Mapeamento — D01); arquivar Tarefa; abrir configurações. Regras visíveis: a Lista contém **apenas** Tarefas (RN-LIS-02); "Lista vazia" e "Lista só com Tarefas concluídas" são condições derivadas e **não** arquivam a Lista (RN-LIS-04, documento 05, 11); o Limite de Tarefas por Lista é Limite imposto verificado no ato (RN-LIS-18).

**Cardinalidade.** Responsáveis: múltiplo. Status: único. Tags: múltiplo. Tipo: único.

**Estado vazio.** "Nenhuma Tarefa nesta Lista ainda." + [Nova Tarefa]. Quadro: cada coluna vazia diz "Nenhuma Tarefa em *Em revisão*" e **permanece**.

**Permissões.** `ver` para abrir; `criar` para Tarefa; `editar` para alterar Tarefa; Lista privada só por concessão ou compartilhamento (RN-LIS-12).

---

## T11 · Configurações da Lista — `/estrutura/listas/[lista]/configuracoes` ⟨05⟩

**Propósito.** Ver o que a Lista consome do caminho e o que ela define.

**Exibe.** **Conjunto de Status efetivo** [D] com o ponto de definição; **Definições de Campo efetivas** [D] (união do caminho + próprias, com origem por item); **Tipos de Tarefa efetivos** [D]; **Funcionalidades efetivas** [D]; Período planejado [VO]; Visualizações da Lista [E]; Automações aplicáveis (acumuladas do caminho, com escopo de cada uma); concessões e indicador Privada.

**Estados.** Reflete o estado da Lista.

**Ações e regras.** Sobrescrever Conjunto de Status (com Mapeamento — RN-LIS-06); criar Definição de Campo própria; habilitar/desabilitar Funcionalidade; definir Período planejado; salvar Visualização; marcar como privada. Regras visíveis: a Lista **nunca** marca `bloqueado` (não tem descendente que defina configuração — RN-LIS-07); a Lista não tem Status, Prioridade, Proprietário nem Responsável (RN-LIS-16); desabilitar Funcionalidade preserva dados existentes (RN-LIS-21); remover Tipo de Tarefa em uso exige remapeamento (RN-LIS-20).

**Cardinalidade.** Período planejado: duas datas opcionais. Funcionalidades: múltiplas.

**Estado vazio.** Visualizações: "Nenhuma Visualização salva. A Lista usa a Visualização padrão herdada de *Comercial*." · Automações aplicáveis: "Nenhuma Automação alcança esta Lista."

**Permissões.** `administrar` para configurar e privar; `editar` para Visualizações do contêiner.

---

## T12 · Tarefa — `/estrutura/tarefas/[tarefa]` ⟨06, 07, 08⟩

**Propósito.** O documento central do domínio. Painel lateral por padrão, com alternância para página cheia.

**Exibe.**

*Cabeçalho:* Caminho efetivo, Título, Identificador legível [D], selo de estado (com o ancestral que o causa, quando efetivo), Criador com delegante, Momento de criação. **Sem Proprietário** (RN-TAR-08).

*Barra de atributos:*
| Atributo | Controle | Regra |
| --- | --- | --- |
| Status atual | Seletor único agrupado por **categoria** (`não iniciado`, `em andamento`, `concluído`, `fechado`) | A4.2, A4.3 |
| Responsáveis | Seletor **múltiplo** de Membro `ativo` **ou Agente**, filtrado por `ver` na Tarefa | B7, RN-TAR-06 |
| Prioridade | Seletor único fixo: urgente, alta, normal, baixa, sem prioridade | Glossário; não personalizável (C17) |
| Datas | Data de início e Data de vencimento, cada uma com forma **dia civil** ou **instante** | documento 06, 6.2 |
| Tipo de Tarefa | Seletor único entre os Tipos efetivos | RN-LIS-20 |
| Tags | Múltiplo, do catálogo do Espaço de Trabalho | B5 |
| Estimativa | Duração, só com a Funcionalidade habilitada | documento 06, 6.1 |
| Observadores | Múltiplo de Membro com `ver` | Glossário |

*Derivados exibidos:* Categoria de status, Vencida, Bloqueada, Momento de conclusão, Tempo registrado, Tempo registrado agregado, Progresso de Subtarefas, Progresso de Checklists, Nível (de Tarefa), Tarefa raiz, Momento da última alteração.

*Seções:*
- **Descrição** — atributo de conteúdo rico com menções e Anexos embutidos; **sem autor próprio**; editar gera Registro de Atividade (RN-TAR-09).
- **Valores de Campo** — um por Definição efetiva, com a origem nomeada; agrupador recolhido "Campos não aplicáveis neste caminho" para os `arquivado` (B37).
- **Subtarefas** — árvore até a Profundidade máxima; "Nova Subtarefa" desabilitada no nível máximo com o motivo (RN-STA-04).
- **Checklists** — [E] Checklist (nome, ordem, Progresso [D], Concluído [D]) → [E] Item (texto, ordem, Concluído, momento e Ator que concluiu, Responsável 0..1 **Membro**, Condição [D] `aberto`/`concluído`/`convertido`) → [E] Subitem (um nível). Ação "Converter em Subtarefa" (D13).
- **Dependências** — `bloqueia`, `é bloqueada por`, `aguarda`; sem ciclo, nunca com ancestral ou descendente (RN-TAR-16).
- **Vínculos** — Contato, Empresa, Negócio, Conversa, Documento de Conhecimento, Tarefa.
- **Anexos** — referências a Arquivo.
- **Registros de Tempo** — por Membro, com um "em andamento" por Membro no Espaço de Trabalho (INV-TAR-12). **Agente não registra tempo** (B42) — o esforço de IA aparece como Execução.
- **Comentários** — padrão §6.
- **Atividade** — padrão §4.
- **Recorrência** — Regra de Recorrência [VO] na ocorrência corrente, com modo de disparo e o que copiar.
- **Compartilhamento público** — [VO], só com a Funcionalidade habilitada, só criado por Membro, só `ver` (RN-TAR-21).

**Estados.** `ativo`, `arquivado`, `na lixeira`, com Estado efetivo derivado da Lista e da Tarefa pai. Status atual é **independente** do estado: uma Tarefa `arquivado` conserva o status que tinha (documento 06, 11).

**Ações e regras.** Alterar Status; atribuir; criar Subtarefa; promover/rebaixar/reparentar; converter Item; registrar tempo; comentar; vincular; criar Dependência; mover de Lista (D01); arquivar; excluir. **Ações de remoção dentro do agregado** (todas são edições da Tarefa, exigem `editar` e geram Registro de Atividade com a Tarefa como objeto — checklist.md 12.2 e 17): remover Checklist, Item ou Subitem; remover Responsável de Item; remover Dependência; remover Vínculo; remover Anexo (remove a referência, nunca o Arquivo — RN-TAR-12); excluir Registro de Tempo; remover Tag; remover Observador; revogar Compartilhamento público. Regras visíveis: atribuir a quem não tem `ver` é inválido, e atribuir **não concede** permissão (RN-TAR-06); Responsável que perde `ver` é liberado no mesmo ato, com evento (RN-TAR-06); concluir com Subtarefas ou Checklists abertos é permitido **salvo** Funcionalidade habilitada (RN-TAR-18, RN-CHK-09); "Bloqueada" não impede conclusão por padrão (RN-TAR-17); Item convertido é terminal e sai do progresso (B48); datas não se propagam entre pai e Subtarefa (RN-TAR-20).

**Cardinalidade.** Ver tabela acima. Responsável de Item: **0..1 Membro**, nunca Agente (B48).

**Estado vazio.** Por seção: "Nenhuma Subtarefa." / "Nenhum Checklist." / "Nenhuma Dependência." / "Nenhum Vínculo." / "Nenhum Anexo." / "Nenhum Comentário ainda." / "Nenhum tempo registrado." / "Nenhum campo personalizado se aplica a esta Lista."

**Permissões.** `ver` para abrir; `comentar` para Comentário; `editar` para atributos, Checklists e Subtarefas; `criar` na Lista + `editar` no pai para Subtarefa (RN-STA-15); `administrar` na Lista para Compartilhamento público e Registro de Tempo por outro Membro.

---

# III. CRM

## T13 · Contatos — `/crm/contatos` ⟨10⟩

**Propósito.** Inventário de pessoas com quem a organização se relaciona.

**Exibe.** Tabela de [E] Contato: Nome de exibição [D], Cargo de exibição [D], Empresa principal [D], Qualificação [A], Origem [A], Proprietário [A], Modo de criação [A], Última interação [D], Tags [A], Identificador principal [D], Estado [A]. Painel lateral de **Suspeitas de Duplicidade** [VO derivado].

**Estados.** `ativo`, `arquivado` (com filtro), `na lixeira` (só na Lixeira), `mesclado` (nunca listado — resolve ao sobrevivente).

**Ações e regras.** Criar Contato; **importar em lote (D15)**; filtrar; abrir mesclagem (D03); marcar par como `distinto de`. Regras visíveis: a única exigência de conteúdo é Nome **ou** ao menos um Identificador (INV-CON-01); "Não identificado" é condição derivada, não estado (documento 10, 11); Suspeita de Duplicidade é calculada, nunca gravada (RN-CON-10).

**Cardinalidade.** Filtros múltiplos; Qualificação e Origem: seleção única no registro.

**Estado vazio.** Tabela: "Nenhum Contato ainda. Contatos também são criados automaticamente quando uma Mensagem chega por um Canal." + [Novo Contato] · Painel de Suspeitas: "Nenhuma suspeita no momento. Suspeitas são calculadas a cada consulta, nunca gravadas."

**Permissões.** Papel, concessão direta, compartilhamento; escopo `registro` ou `próprios` (B29) — "vendedor vê só os seus" filtra sem avisar.

---

## T14 · Ficha do Contato — `/crm/contatos/[contato]` ⟨10⟩

**Propósito.** Tudo o que se sabe e se pode fazer sobre uma pessoa.

**Exibe.**

*Cabeçalho:* Foto [A], Nome de exibição [D], Cargo de exibição [D], selo de estado, Proprietário [A], Criador com delegante, Modo de criação [A] (imutável).

*Atributos:* Nome, Sobrenome, Qualificação (0..1 Definição de Qualificação), Origem (0..1), Data de nascimento (dia civil), Idioma, Fuso horário, Descrição, Tags, Valores de Campo (Definições do Espaço de Trabalho com entidade-alvo Contato), Última interação [D], Estado anterior à exclusão [A] quando `na lixeira`.

*Seções:*
- **Identificadores** — [E] Identificador de Contato: Tipo (`telefone`, `e-mail`, `identidade de WhatsApp`, `usuário de Instagram`, `identificador de chat do site`), Valor canônico, Valor exibido, Canal de origem, Rótulo informado pelo Canal, Verificado, Principal (≤1 por Tipo). Ações: acrescentar, marcar principal, transferir (D11).
- **Consentimentos** — [VO] histórico monotônico; tabela do vigente por (Finalidade, Tipo de Canal) + histórico completo com origem e evidência. Registrar consentimento é **acrescentar**, nunca editar (RN-CON-17).
- **Endereços** — [VO] 0..N, ≤1 principal.
- **Empresas** — [E] Vínculo Contato-Empresa: papel (cargo), Empresa principal do Contato, Contato principal da Empresa, início, fim. Ações: vincular, marcar principal, **encerrar** (preenche fim — nunca apaga).
- **Negócios** — Vínculos Contato-Negócio com papel do catálogo fixo.
- **Conversas** — por Canal, derivadas (o Contato não contém Conversas).
- **Tarefas** — Vínculos.
- **Documentos** — Vínculos a Documento de Conhecimento.
- **`distinto de`** — Vínculos que suprimem Suspeita de Duplicidade.
- **Comentários** e **Linha do tempo**.
- **Estado pré-mesclagem** — só em `mesclado`, com [Restaurar cópia] (D10).

**Estados.** `ativo`, `arquivado`, `na lixeira`, `mesclado` (terminal, aponta o sobrevivente).

**Ações e regras.** Editar; mesclar (D03); arquivar; enviar à lixeira; restaurar; transferir propriedade. Regras visíveis: **cargo pertence ao Vínculo, não ao Contato** — o campo não existe na ficha (RN-CON-06); Identificador duplicado é rejeitado com o detentor nomeado e as duas saídas (RN-CON-11); Contato `arquivado` ou `na lixeira` volta a `ativo` ao receber Mensagem (RN-CON-13) — a ficha explica isso no selo; a mesclagem é irreversível (RN-CON-15); ver o Contato não concede ver as suas Conversas, Negócios e Tarefas — a linha do tempo é filtrada item a item (RN-CON-21).

**Cardinalidade.** Qualificação 0..1; Origem 0..1; Empresas 0..N com ≤1 principal; Negócios 0..N; Identificadores 0..N com ≤1 principal por Tipo; Proprietário exatamente 1 Membro.

**Estado vazio.** Uma frase por seção (§14 dos padrões): Identificadores e Consentimentos com o texto que explica a consequência; "Nenhum Endereço." / "Nenhuma Empresa vinculada." / "Nenhum Negócio." / "Nenhuma Conversa." / "Nenhuma Tarefa vinculada." / "Nenhum Documento vinculado." / "Nenhum Contato marcado como distinto." / "Nenhum Comentário ainda."

**Permissões.** `ver`, `editar`, `administrar` (mesclar, transferir propriedade, editar Comentário de terceiro).

---

## T15 · Empresas — `/crm/empresas` ⟨11⟩

**Propósito.** Inventário de organizações externas.

**Exibe.** Tabela de [E] Empresa: Nome de exibição [D], Identificador principal [D], Empresa matriz [A], Empresa raiz do grupo [D], Contato principal [D], Origem [A], Proprietário [A], Tags, Estado [A]; derivados de negócio (Negócios `aberto`, receita ganha, filiais) como colunas opcionais. Painel de **Sugestões de Vínculo** [VO transitório].

**Estados.** `ativo`, `arquivado`, `na lixeira`, `mesclado`.

**Ações e regras.** Criar; filtrar; aceitar/descartar Sugestão de Vínculo. Regra visível: a plataforma **nunca** cria o Vínculo por conta própria — o aceite é ato de Membro, Agente ou Automação, com Registro (RN-EMP-07).

**Cardinalidade.** Origem 0..1; Tags múltiplas.

**Estado vazio.** Tabela: "Nenhuma Empresa ainda." + [Nova Empresa] · Painel de Sugestões: "Nenhuma sugestão. Sugestões surgem quando o domínio do e-mail de um Contato coincide com o de uma Empresa."

**Permissões.** Como Contatos.

---

## T16 · Ficha da Empresa — `/crm/empresas/[empresa]` ⟨11⟩

**Propósito.** A organização externa e o seu grupo.

**Exibe.** Cabeçalho: Nome de exibição [D], selo, Proprietário, Criador. Atributos: Nome fantasia, Razão social (ao menos um — INV-EMP-01), Descrição, Origem, Tags, Valores de Campo (inclusive as Definições pré-definidas Segmento, Porte, Setor — DO-EMP-10), Última interação [D].

*Seções:*
- **Identificadores** — [E] Identificador de Empresa: tipo (`domínio`, `documento fiscal` com país, `telefone`), valor normalizado, verificado, principal.
- **Grupo** — Empresa matriz [A], filiais [D], Empresa raiz do grupo [D], com a árvore navegável.
- **Empresas relacionadas** — [E] Vínculo Empresa-Empresa tipado: `parceira`, `concorrente`, `fornecedora de`/`cliente de`, `outro` com rótulo.
- **Contatos** — Vínculos com papel, principal e vigência.
- **Negócios** — referências (0..N).
- **Conversas** — **derivadas** dos Contatos vinculados, somente leitura (B53).
- **Endereços**, **Anexos**, **Comentários**, **Linha do tempo**.

**Estados.** `ativo`, `arquivado`, `na lixeira`, `mesclado`.

**Ações e regras.** Editar; definir matriz; vincular Empresa/Contato; mesclar; arquivar; enviar à lixeira. Regras visíveis: **não existe Conversa com Empresa** — a seção diz "derivadas dos Contatos vinculados" (RN-EMP-15); nada é herdado entre matriz e filiais (RN-EMP-12); só Empresa `ativo` recebe novo Negócio, Vínculo, filial ou matriz (RN-EMP-08); enviar à lixeira é rejeitado com Negócio `aberto` ou filial, listando os impedimentos (RN-EMP-09); a eliminação é adiada enquanto houver qualquer Negócio (RN-EMP-10); domínio de provedor público de e-mail é rejeitado como Identificador (RN-EMP-05).

**Cardinalidade.** Empresa matriz 0..1; Identificadores 0..N com ≤1 principal por tipo; Contatos 0..N com ≤1 principal.

**Estado vazio.** "Nenhum Contato vinculado." / "Nenhum Negócio." / "Nenhuma filial."

**Permissões.** Como Contato.

---

## T17 · Negócios — `/crm/negocios` ⟨12, 13⟩

**Propósito.** Operar o funil comercial. Quadro por padrão.

**Exibe.** Seletor de **Funil** (obrigatório — todo Negócio percorre exatamente um). Abas **Abertos** · **Ganhos** · **Perdidos**. Visualizações **Quadro** (colunas = Etapas por Ordem, com probabilidade padrão no cabeçalho e soma de Valor por moeda) e **Tabela**.

[A] por cartão: Título, Identificador legível [D], Empresa, Contato principal [D], Valor [VO] por moeda, Probabilidade efetiva [D], Valor ponderado [D], Dias em Etapa [D], Previsão vencida [D], Próxima atividade [D], Proprietário, Tags.

**Estados.** Situação `aberto` / `ganho` / `perdido` (abas) **e** estado de ciclo de vida `ativo` / `arquivado` / `na lixeira` (filtro), ortogonais (documento 12, 11.3).

**Ações e regras.** Arrastar entre Etapas; criar Negócio; marcar `ganho`/`perdido` (D07); mover de Funil; filtrar. Regras visíveis: **Requisitos de Etapa** e **Transições permitidas** são avaliados de forma síncrona e bloqueante para todo Ator, sem exceção por Papel (RN-FUN-07) — a coluna de destino mostra o Requisito ao arrastar e o cartão volta com o Requisito nomeado; Etapa nunca carrega resultado (B58) — uma Etapa chamada "Ganho" continua de progressão (RN-FUN-20); Negócio `arquivado` é somente leitura (RN-NEG-16); `na lixeira` é ignorado pelo Funil mas continua a referenciar Etapa (RN-NEG-17).

**Cardinalidade.** Funil: seleção única obrigatória. Etapa: única obrigatória.

**Estado vazio.** Quadro sem Negócios: cada coluna diz "Nenhum Negócio nesta Etapa" e **permanece**. Funil sem Negócios: "Nenhum Negócio em *Vendas B2B*." + [Novo Negócio]

**Permissões.** Papel, concessão, compartilhamento; escopos `registro` e `próprios`. Funil privado: `ver` sobre o Funil é pré-requisito por interseção (RN-NEG-19).

---

## T18 · Ficha do Negócio — `/crm/negocios/[negocio]` ⟨12⟩

**Propósito.** A oportunidade e o seu percurso.

**Exibe.** Cabeçalho: Título, Identificador legível [D], selos de **situação** e de **estado**, Proprietário, Criador com delegante.

*Atributos:* Objeto (texto — substitui catálogo de Produtos, B10), Descrição, Funil, Etapa, Valor [VO] (quantia + moeda), Probabilidade sobrescrita [A] / efetiva [D], Valor ponderado [D], Data prevista de fechamento, Origem, Motivo de Perda / de Ganho, Nota de encerramento, Momento de encerramento [D], Data de fechamento [D], Momento de entrada na Etapa atual [D], Dias em Etapa [D], Idade [D], Previsão vencida [D], Última atividade [D], Próxima atividade [D], Tags, Valores de Campo.

*Seções:* **Empresa** (0..1, só `ativo` ao definir); **Contatos** (Vínculo com papel do catálogo fixo `decisor`/`influenciador`/`comprador`/`técnico`/`usuário`/`outro`, ≤1 principal); **Conversas** (Vínculo Conversa-Negócio); **Tarefas** (Vínculo); **Documentos** (Vínculo); **Negócios relacionados** (`relacionado a`); **Anexos**; **Comentários**; **Histórico de transições** — Registros de Atividade com Etapa de origem e destino **por nome à época** e **Ordem à época**, origem da entrada e tempo de permanência (B62).

**Estados.** Situação (com `ganho`/`perdido` terminais reabríveis) × ciclo de vida.

**Ações e regras.** Mover de Etapa; marcar `ganho` (pede valor quando a Regra exige) ou `perdido` (pede Motivo quando exige) — D07; reabrir; mover de Funil (D08, com Etapa explícita); vincular Contato com papel; trocar Empresa; transferir propriedade; arquivar; excluir. Regras visíveis: reabrir `ganho` exige Papel de nível Administrador e **nunca** é feito por Agente (RN-NEG-10, RN-NEG-21); ao reabrir, Motivo e Nota são limpos como atributos correntes e **permanecem** nos Registros (RN-NEG-11); não há transição direta `ganho` ↔ `perdido`; a probabilidade sobrescrita é **descartada** em toda progressão, com o valor preservado no Registro, e **preservada** em remapeamento (RN-NEG-05); não existe mesclagem de Negócios — duplicado fecha como `perdido` com Motivo "Duplicado" (RN-NEG-22); o Negócio **não tem Responsável** (RN-NEG-02); o Proprietário tem `ver` em todo instante (RN-NEG-20).

**Cardinalidade.** Empresa 0..1; Contatos 0..N com ≤1 principal; Funil 1; Etapa 1; Valor 0..1; Motivo 0..1.

**Estado vazio.** Contatos: "Nenhum Contato vinculado. Vincule ao menos um para avançar até *Proposta*." (quando o Requisito existe). Demais seções: "Nenhuma Conversa vinculada." / "Nenhuma Tarefa vinculada." / "Nenhum Documento vinculado." / "Nenhum Negócio relacionado." / "Nenhum Anexo." / "Nenhum Comentário ainda." / Histórico: nunca vazio (a criação já gera Registro de transição — RN-NEG-14).

**Permissões.** `ver`, `editar`, `administrar` (trocar Empresa de Negócio encerrado, transferir propriedade); Papel Administrador para reabrir `ganho`.

---

## T19 · Funis — `/crm/funis` ⟨13⟩

**Propósito.** Governar os processos de progressão.

**Exibe.** [E] Funil: Nome, Descrição, Cor, Ordem de exibição, Estado, Privado, **É o Funil padrão** [D], Etapa inicial [D], contagem de Negócios `aberto` [D].

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; definir como padrão; copiar; arquivar (D08); enviar à lixeira (D08). Regras visíveis: existe **exatamente um** Funil padrão, sempre `ativo` e **nunca privado**, não arquivável nem excluível enquanto for padrão (RN-FUN-16); criar, excluir e definir padrão são governança por Papel de nível Administrador (RN-FUN-17).

**Cardinalidade.** Funil padrão: exatamente 1.

**Estado vazio.** Não se aplica: o Funil padrão é criado com o Espaço de Trabalho (RN-ET-02).

**Permissões.** Papel Administrador para criar/excluir/definir padrão; `administrar` sobre o Funil para configurá-lo.

---

## T20 · Funil — `/crm/funis/[funil]` ⟨13⟩

**Propósito.** Configurar Etapas, validações e regras de encerramento.

**Exibe.** Cabeçalho sem Proprietário (o Funil não tem — B57), com Criador. Lista ordenada de [E] Etapa: Nome, Ordem, Probabilidade padrão, Cor, Descrição, contagem de Negócios [D]. Por Etapa: [VO] **Requisitos de Etapa** (momento `entrada`/`saída`; tipo `campo preenchido` / `contato obrigatório` / `empresa obrigatória` / `valor obrigatório`) e [VO] **Transições permitidas** (vazio = todas). Do Funil: [VO] **Regras de encerramento** (exigir Motivo de Perda; exigir valor ao ganhar). Aba **Painéis** (Painéis de contexto ancorados no Funil — B102).

**Estados.** `ativo`, `arquivado`, `na lixeira`. A Etapa **não tem estado** (13, 11.2) — a interface não oferece arquivar Etapa.

**Ações e regras.** Criar/renomear/reordenar Etapa; **remover Etapa** (D02 obrigatório); definir Requisitos; definir Transições; definir Regras de encerramento; tornar privado; arquivar; excluir; copiar. Regras visíveis: reordenar, renomear ou reconfigurar Etapas **nunca** altera Negócio algum — Negócios referenciam Etapas por identidade (RN-FUN-05); remover Etapa exige remapear todo Negócio que a referencia, **inclusive `na lixeira`** (RN-FUN-10); Requisitos e Transições não são avaliados em remapeamentos (RN-FUN-08); Requisito é validação, Automação é reação (7.2 do documento 13); o Funil não define Definições de Campo — apenas as referencia em Requisitos (RN-FUN-09); Funil privado exige `ver` como pré-requisito para os Negócios (B61), e o Proprietário de Negócio nunca perde `ver` (B63).

**Cardinalidade.** Etapas 1..N (remover a única é rejeitado — RN-FUN-04); Requisitos 0..N por Etapa; Transições 0..N.

**Estado vazio.** Não se aplica: todo Funil tem ao menos uma Etapa.

**Permissões.** `administrar` sobre o Funil; **nunca concedível a Agente** (RN-FUN-17).

---

## T21 · Caixa de Entrada — `/crm/caixa-de-entrada` e `/crm/caixa-de-entrada/[conversa]` ⟨14⟩

**Propósito.** A operação conversacional. Três colunas.

**Coluna 1 — Filas e Canais.** [E] Fila: Nome, Conversas não resolvidas [D], Regra de distribuição, Limite por Atendente. [E] Canal: Nome, Tipo de Canal, Estado de conexão, Estado de ciclo de vida. Filtros: minhas, sem Atribuído, sem Fila, não lidas, adiadas, por estado de conversa.

**Coluna 2 — Conversas.** [E] Conversa: Título [A/D], Contato principal (Nome de exibição [D]), Canal, Estado de conversa, Atribuído (Membro **ou Agente**), Fila, Tempo de espera atual [D], última Mensagem, marcadores (adiada, fora da janela, não lida, de grupo, sem Contato resolvido).

**Coluna 3 — Conversa aberta.**
- Cabeçalho: Contato principal, Canal, Empresa [D] (derivada do Contato principal), Estado de conversa, Atribuído, Fila, Janela de resposta aberta até [D], Tags, Valores de Campo.
- Sequência: [E] Mensagem por **direção** (`recebida`, `enviada`, `interna`), com Ator e delegante, Conteúdo, Anexos, Assunto e Endereços adicionais (E-mail), Status de entrega (só `enviada`), Reações, Leitura interna, Marcação de exclusão, Edição pelo remetente externo, "Em resposta a", Mensagem de modelo usada. Fatos da Conversa (atribuição, transferência, resolução) aparecem como **Registros de Atividade**, nunca como Mensagens (DO-CXE-08).
- Compositor: abas **Responder** e **Nota interna**; [VO] **Rascunho** (um por Ator interno) com o Rascunho de IA destacado e [Usar] / [Descartar]; seletor de Mensagem de modelo quando fora da janela.
- Painel do Contato: Identificadores, Qualificação, Consentimentos vigentes, Negócios (Vínculo Conversa-Negócio), Tarefas, ações [Criar Tarefa a partir da Conversa] e [Criar Negócio a partir da Conversa].

**Estados.** Estado de conversa `aberta` / `pendente` / `resolvida`; ciclo de vida `ativo` / `na lixeira` (**sem `arquivado`**); status de entrega por Mensagem; estado de conexão do Canal.

**Ações e regras.** Auto-atribuir; atribuir a Membro ou Agente; transferir de Fila; responder; nota interna; adiar (define Adiamento); resolver; reabrir; mover Conversa para outro Contato (D12); vincular a Negócio; criar Tarefa/Negócio a partir da Conversa. Regras visíveis:
- Enviar Mensagem **não muda o estado por si** — existem "Responder e marcar pendente" e "Responder e resolver" como atos distintos (DO-CXE-07).
- Fora da janela de resposta, só Mensagem de modelo `aprovado`; Mensagem livre é rejeitada **antes de gravar**, para todo Ator (RN-CXE-19).
- Canal `desconectada`/`com erro`: a Mensagem nasce `pendente` com aviso do prazo de 24 h; nunca há descarte silencioso (B69).
- Mensagem é **imutável** e nunca muda de Conversa; reenviar cria Mensagem nova (RN-CXE-15, RN-CXE-18).
- Agente Atribuído em nível `supervisionado`/`assistido` **não envia**: gera Solicitação de Aprovação e o texto vira Rascunho (RN-AGE-14, B64).
- Só Conversa `resolvida` vai à lixeira (RN-CXE-33).
- Mensagem recebida dentro do Prazo de reabertura reabre a **mesma** Conversa; fora dele cria outra (RN-CXE-09).
- Conversa sem Contato resolvido (Limite de Contatos atingido) exibe o marcador "não resolvido" e a ação [Associar a um Contato] (RN-CXE-06).

**Cardinalidade.** Atribuído 0..1; Fila 0..1; Canal 1 imutável; Contato principal 1; Rascunho 1 por Ator interno; Tags múltiplas.

**Estado vazio.** Coluna 1 sem Filas: "Nenhuma Fila. As Conversas chegam sem Fila e ficam sem Atribuído até alguém se auto-atribuir." + [Nova Fila] · Coluna 1 sem Canais: "Nenhum Canal conectado." + [Conectar Canal] · Coluna 2: "Nenhuma Conversa com estes filtros." + [Limpar filtros] · Compositor sem Rascunho: nada exibido (o Rascunho é opcional).

**Listas longas.** A sequência de Mensagens carrega do mais recente para trás, com [Carregar anteriores] e a data de cada bloco; a ordem é a da sequência e nunca é reordenável. A coluna 2 pagina por rolagem com ordenação por última Mensagem.

**Permissões.** Papel, concessão, compartilhamento e — exclusivamente aqui — **elegibilidade de Fila**: o Membro elegível efetivo vê e edita as Conversas **atualmente** na Fila e as sem Fila (B70). Ser Atribuído **não** concede `ver`; exige-o (Glossário).

---

## T22 · Configurações da Caixa — `/crm/caixa-de-entrada/configuracoes` ⟨14⟩

**Propósito.** Configurar o que vale para toda a mensageria.

**Exibe.** [E] Caixa de Entrada: Prazo de reabertura [A], Distribuição padrão [A], Proprietário padrão de Contatos [A], Horário de atendimento [VO], Conversas não resolvidas [D], Conversas sem Fila [D]. Listas de Canais e de Filas.

**Estados.** A Caixa **não tem estado próprio**: acompanha o Espaço de Trabalho (RN-CXE-27) — o aviso de suspensão aparece aqui.

**Ações e regras.** Editar configurações; abrir Canal ou Fila; criar Fila; conectar Canal. Regras visíveis: existe **exatamente uma** Caixa por Espaço de Trabalho, nunca excluída nem duplicada (RN-CXE-01); o Prazo de reabertura é único e **não** sobrescritível por Fila ou Canal (DO-CXE-04); a Caixa não tem Proprietário (RN-CXE-02); a resolução do Proprietário padrão de Contatos é Fila → Canal → Caixa → Proprietário do Espaço de Trabalho e **nunca falha** (RN-CXE-29).

**Cardinalidade.** Distribuição padrão: seleção única. Proprietário padrão: 0..1 Membro `ativo`.

**Estado vazio.** Canais: "Nenhum Canal conectado. Sem Canal, a Caixa não recebe nem envia Mensagens." + [Conectar Canal]

**Permissões.** Papel de nível Administrador (RN-CXE-03; RN-ET-24).

---

## T23 · Canal — `/crm/caixa-de-entrada/configuracoes/canais/[canal]` ⟨14⟩

**Propósito.** Uma conta conectada e as suas capacidades.

**Exibe.** Nome, Tipo de Canal (imutável), Identificador externo, Estado de conexão, Estado de ciclo de vida, Membro configurador, Criador, Fila padrão (0..1), Proprietário padrão de Contatos (0..1), Origem padrão de Contatos (0..1), Grupos habilitados (quando o Tipo suporta), [VO] Configuração de mensagens de modelo → Mensagens de modelo (identificador no provedor, nome, idioma, corpo com variáveis, categoria, estado de aprovação), tabela de **Capacidades do Tipo de Canal** (só leitura). Derivados: última Mensagem recebida/enviada, Conversas não resolvidas.

**Estados.** Conexão `conectada`/`desconectada`/`com erro`; ciclo de vida `ativo`/`arquivado` — **sem `na lixeira`** (DO-CXE-03).

**Ações e regras.** Reconectar; definir Fila padrão; sincronizar modelos; habilitar grupos; arquivar (exige `desconectada`). Regras visíveis: o Canal **não tem Proprietário** (RN-CXE-02); não pode ser excluído enquanto tiver Conversas — só arquivado (RN-CXE-04); toda regra de mensageria consulta as Capacidades do **Tipo de Canal**, e nem Canal nem Conversa as redefinem (RN-CXE-05); com "Grupos habilitados" falso, Mensagens de grupo são persistidas mas a Conversa nasce `resolvida`, sem distribuição (RN-CXE-28).

**Cardinalidade.** Fila padrão 0..1; Origem padrão 0..1.

**Estado vazio.** Modelos: "Nenhuma Mensagem de modelo sincronizada. Fora da janela de resposta, este Canal não poderá enviar Mensagens livres."

**Permissões.** Papel de nível Administrador.

---

## T24 · Fila — `/crm/caixa-de-entrada/configuracoes/filas/[fila]` ⟨14⟩

**Propósito.** Quem atende e como as Conversas são distribuídas.

**Exibe.** Nome, Descrição, Estado, [E] Elegíveis (Membros e Equipes) com **elegíveis efetivos** [D], Regra de distribuição (`herdar da Caixa`/`manual`/`rodízio`/`menor carga`), Limite de Conversas por Atendente, Proprietário padrão de Contatos, Horário de atendimento [VO] (sobrescreve o da Caixa), Criador. Derivados: Conversas não resolvidas, carga por Atendente, tempo médio de espera. Aba **Painéis** (B102).

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Editar elegíveis; mudar Regra; arquivar; excluir. Regras visíveis: a Fila **não contém** Conversas — é referenciada por elas (DO-CXE-01), e o texto da tela diz isso; arquivar ou excluir exige transferir as não resolvidas **no mesmo ato** (RN-CXE-32); nenhuma regra de distribuição atribui a **Agente** (RN-CXE-12) — o seletor de elegíveis não lista Agentes; Fila sem elegíveis é válida (só distribuição manual); `administrar` sobre a Fila nunca é concedido a Agente nem a base Convidado (B70).

**Cardinalidade.** Elegíveis: múltiplo (Membros e Equipes). Regra: única.

**Estado vazio.** "Nenhum elegível. As Conversas desta Fila ficarão sem Atribuído até alguém se auto-atribuir."

**Permissões.** Papel de nível Administrador ou `administrar` sobre a Fila.

---

# IV. IA

## T25 · Chat — Sessões — `/ia/chat` ⟨16⟩

**Propósito.** As Sessões do Membro logado. Nada mais: Sessão é pessoal.

**Exibe.** [E] Sessão de Chat: Título [A/D], Âncora [VO] (tipo + nome à época + validade [D]), Agente principal efetivo [D], Modelo efetivo [D], momento da última Mensagem, Estado, Custo acumulado [D].

**Estados.** `ativo`, `arquivado`, `na lixeira`. Condições derivadas: Agente principal indisponível; âncora `indisponível`/`eliminada`.

**Ações e regras.** Criar Sessão (com Âncora opcional, escolhida entre Tarefa, Negócio, Contato, Empresa, Conversa, Documento, Espaço, Pasta, Subpasta, Lista); arquivar; excluir. Regras visíveis: **só um Membro `ativo` cria Sessão**, e apenas com `executar` sobre o Agente principal efetivo (RN-CHT-02); a Âncora é fixada na criação e **imutável** (B83); Coleção, Caixa, Fila, Funil, Painel, Agente e outra Sessão **não** são âncoras — o seletor não as oferece.

**Cardinalidade.** Âncora 0..1; Agente principal 0..1 (vazio = Assistente padrão).

**Estado vazio.** "Nenhuma Sessão ainda. Abra uma conversa com o Assistente padrão ou ancore em um registro para começar com contexto." + [Nova Sessão]

**Permissões.** Só o Proprietário. Sessões compartilhadas com o Membro aparecem em uma seção separada, somente leitura (RN-CHT-22).

---

## T26 · Sessão de Chat — `/ia/chat/[sessao]` ⟨16⟩

**Propósito.** Conversar com a IA, com contexto e com rastro.

**Exibe.** Cabeçalho: Título editável, **Âncora como chip** com tipo, nome à época e validade (`válida`/`indisponível`/`eliminada`), Agente principal (trocável), Modelo efetivo, Restrição de Ferramentas, Custo acumulado [D].
Sequência de [E] Mensagem de Chat por **papel**:
| Papel | Como aparece |
| --- | --- |
| `usuário` | Fala do Membro Proprietário |
| `assistente` | Resposta da IA, com **Referências de Conhecimento** e link para a Execução |
| `ferramenta` | **Registro** compacto (Ferramenta, resultado, resumo, link para o Passo) — nunca como fala (DO-CHT-07) |
| `sistema` | Fato da Sessão: Agente trocado, Modelo trocado, Restrição alterada, âncora indisponível, Execução cancelada, Arquivo não suportado |

Mensagem substituída aparece recolhida e marcada. Solicitação de Aprovação inline com o **objeto fixo** legível, prazo e [Aprovar] [Recusar].

**Estados.** Sessão `ativo`/`arquivado`/`na lixeira`; Execução em andamento (`executando`, `aguardando aprovação`); Mensagem `substituída` [D].

**Ações e regras.** Enviar Mensagem; anexar Arquivo; trocar Agente principal; trocar Modelo (só se o Agente admite sobrescrita); restringir Ferramentas; regenerar; decidir Aprovação; compartilhar (`ver` a Membro ou Equipe); arquivar. Regras visíveis:
- Mensagens de Chat são **imutáveis** e nunca eliminadas individualmente; a única eliminação é a da Sessão inteira (RN-CHT-12).
- No máximo **uma Execução não terminal por Sessão**: enviar durante uma Execução é rejeitado ou enfileirado (RN-CHT-09).
- Sessão `arquivado` não aceita Mensagem: desarquivar é ato explícito (RN-CHT-06).
- Agente principal indisponível **bloqueia** novas Mensagens até escolha explícita — **nunca há substituição silenciosa** (RN-CHT-26).
- A Restrição de Ferramentas **só reduz**: Ferramentas disponíveis = permitidas ao Agente ∩ Restrição (RN-CHT-08).
- A Sessão é privada, **as ações não**: toda Ferramenta com efeito gera Registro de Atividade no registro-alvo com Ator Agente e delegante Membro (RN-CHT-10).
- Arquivo cujo tipo o Modelo não suporta permanece na Sessão, **não entra no Contexto** e gera Mensagem `sistema`; se houver Representação derivada, ela entra no lugar (RN-CHT-19).
- Compartilhar dá **só `ver`**, nunca a Agente, e não amplia acesso a registros citados (RN-CHT-22).

**Cardinalidade.** Agente principal 0..1; Modelo escolhido 0..1; Restrição: múltipla (Ferramentas ou classes de efeito); compartilhamentos 0..N.

**Estado vazio.** "Sessão nova. Pergunte alguma coisa." + sugestões derivadas da Âncora quando houver.

**Listas longas.** As Mensagens de Chat carregam do mais recente para trás, com [Carregar anteriores]; Mensagens substituídas ficam recolhidas e não contam na paginação.

**Permissões.** Proprietário escreve; compartilhados só leem (INV-CHT-04). **Nenhum Papel** dá acesso a Sessão alheia, nem ao Proprietário do Espaço de Trabalho (RN-CHT-23).

---

## T27 · Agentes — `/ia/agentes` ⟨17⟩

**Propósito.** Inventário dos sujeitos de IA.

**Exibe.** [E] Agente: Nome, Descrição, Estado, Disponibilidade [D] com motivo, Proprietário, Papel, Assistente padrão [D], Versão corrente [D], Execuções em curso [D], Custo acumulado por período [D].

**Estados.** `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; instanciar Template de Agente (da plataforma ou do Espaço de Trabalho); ativar; pausar; arquivar; excluir. Regras visíveis: **o Assistente padrão não pode ser excluído nem deixar de ser `ativo`** — as ações não são oferecidas (B33, INV-AGE-11); ativar exige objetivo, instruções e Modelo resolúvel (RN-AGE-07); instanciar Template cria Agente `rascunho` com Proveniência, sem vínculo vivo (B81).

**Cardinalidade.** Template na instanciação: única.

**Estado vazio.** Não se aplica: o Assistente padrão existe desde a criação do Espaço de Trabalho (RN-ET-02).

**Permissões.** Governança de Agentes é concedível por concessão direta, **exceto atribuir Papel**, que é governança por Papel (B95, RN-ET-24).

---

## T28 · Agente — `/ia/agentes/[agente]` ⟨17⟩

**Propósito.** Configurar, governar e auditar um Agente. Oito abas.

**Aba Configuração** (versionada). Objetivo, Instruções, Modelo (ou marcador `padrão da plataforma`), Admite sobrescrita de Modelo, Nível de autonomia (`assistido`/`supervisionado`/`autônomo`), [VO] Política de aprovação (aprovadores 0..N Membros ou Equipes; tempo limite, padrão 72 h), Profundidade máxima de invocação, Memória habilitada. Não versionados: Nome, Descrição, Proprietário, Papel, Política de retenção de Memória, Limite de custo. Aviso permanente: "Alterar isto cria a versão N, válida a partir da próxima Execução."

**Aba Habilidades.** [E] Concessão de Habilidade: Habilidade, Versão fixada (0..1; vazio = segue a corrente), Concedida por, momento, **Disponibilidade** [D] com motivo. Ação: conceder (exige `executar` na Habilidade e `editar` no Agente — RN-HAB-12), fixar versão, revogar. Exibe o **Efeito declarado** [D] de cada Habilidade antes de confirmar (RN-HAB-11).

**Aba Conhecimento.** **Conhecimento acessível** [D] — as Coleções em que o Agente tem `ver`. Visão derivada, **somente leitura**: as concessões vivem na Coleção, e a tela diz isso e linka para **T34 › aba Acesso** (DO-CNH-12).

**Aba Ferramentas.** [VO] Ferramentas permitidas, cada uma com **classe de efeito** (`leitura`, `escrita reversível`, `escrita irreversível`, `externa`), Recurso-alvo e permissão requerida. Aviso: "Permitir uma Ferramenta não concede permissão sobre nenhum registro." (DO-HAB-14).

**Aba Permissões.** Papel do Agente (nunca Proprietário nem Administrador nem base neles), concessões diretas e compartilhamentos recebidos, com o Recurso de cada um.

**Aba Execuções.** [E] Execução de Agente: Estado, Origem (`Sessão de Chat`/`ação direta`/`Automação`/`Agente`/`Caixa de Entrada`), Ator invocador, ator delegante, Versão usada, Modelo usado, Nível de autonomia efetivo, marcação de **Ensaio**, Custo [VO], Motivo de término, momentos. Detalhe: [VO] **Passos** (chamada de Ferramenta com as duas permissões avaliadas; Exercício de Habilidade; Solicitação de Aprovação; raciocínio; memorização), [VO] **Composição do Contexto** (referências, nunca conteúdo), Referências de Conhecimento, **Cadeia de Execuções** com profundidade.

**Aba Memória.** [E] Memória do Agente → [E] Item de Memória: Conteúdo, Execução de origem, **Delegante de origem** (0..1), Registros referenciados, momentos, Origem do ato. [VO] Política de retenção de Memória. Explicação visível da **elegibilidade por delegante**: um Item com delegante só entra em Execuções do mesmo delegante (B78).

**Aba Versões.** [E] Versão de Agente: número, Ator, motivo, momento; configuração completa (nunca diferença).

**Estados.** Os cinco do Agente + estados de Execução + Disponibilidade [D].

**Ações e regras.** Editar (cria Versão); ativar/pausar/arquivar/excluir; **ensaiar** (única Execução admitida em `rascunho`; escritas `simulado`, sem efeito, sem Memória — B82); transferir propriedade; cancelar Execução; apagar Item de Memória. Regras visíveis:
- Pausar, arquivar ou excluir **não cancela** Execuções em curso: terminam na Versão carregada (RN-AGE-19).
- `pausado` **preserva** responsabilidades; `arquivado` e `na lixeira` as **liberam** no ato, e a restauração não as devolve (RN-AGE-20).
- Restaurar devolve a `pausado`, nunca a `ativo` (B94).
- Um Agente **nunca** cria nem reconfigura Agente, Habilidade ou Automação — inclusive a si próprio (RN-AGE-25).
- O Agente não herda permissões do Proprietário, que também não é teto (B76) — assimetria com a Automação, explicada na aba Permissões.

**Cardinalidade.** Modelo 1 (ou marcador); Papel 1; Proprietário 1; Ferramentas 0..N; Habilidades 0..N; aprovadores 0..N.

**Estado vazio.** Habilidades: "Nenhuma Habilidade concedida. O Agente age apenas com as instruções, as Ferramentas permitidas e o Conhecimento a que tem acesso." · Ferramentas: "Nenhuma Ferramenta permitida. O Agente é puramente conversacional: responde, mas não lê nem altera registro algum." · Conhecimento: "Nenhuma Coleção acessível." · Memória: "Nenhum fato memorizado." · Execuções: "Nenhuma Execução ainda." + [Ensaiar].

**Permissões.** `ver` para abrir; `editar` para configurar e para a Memória; `administrar` para transferir, cancelar Execução e decidir Solicitação; Papel de nível Administrador para atribuir Papel.

---

## T29 · Habilidades — `/ia/habilidades` ⟨18⟩

**Propósito.** Catálogo de competências reutilizáveis.

**Exibe.** [E] Habilidade: Nome, Descrição, Pertencimento (Espaço de Trabalho ou `plataforma`), Estado, Versão corrente [D], **Efeito declarado** [D] da corrente, número de Agentes com Concessão.

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; **copiar** Habilidade da plataforma (não existe Template de Habilidade — B71); arquivar; excluir. Regra visível: a Habilidade **não tem Proprietário** — a coluna não existe (B71); Habilidade `arquivado` torna toda Concessão `indisponível` (documento 18, 11.1).

**Cardinalidade.** —

**Estado vazio.** "Nenhuma Habilidade. Agentes funcionam sem elas, apenas com instruções, Ferramentas e Conhecimento." + [Nova Habilidade] [Copiar da plataforma]

**Permissões.** `administrar` para publicar; `executar` + `editar` no Agente para conceder.

---

## T30 · Habilidade — `/ia/habilidades/[habilidade]` ⟨18⟩

**Propósito.** Definir e versionar a competência.

**Exibe.** Cabeçalho sem Proprietário, com Criador e Publicador por Versão. Cinco abas — **Versão · Ferramentas · Dependências · Agentes · Versões**:
- **Versão** — [E] Versão de Habilidade: Número, Estado da versão, Instruções, [VO] Contrato de entrada (Parâmetros: nome, tipo, obrigatório, padrão, descrição — Tipos de Campo, referência a registro, Arquivo com tipos), [VO] Contrato de saída (estruturado, texto, Arquivos produzidos), [VO] Requisitos de Ferramenta (obrigatória/opcional), [VO] Dependências, [VO] Coleções recomendadas, Capacidades de Modelo requeridas [D], **Efeito declarado** [D].
- **Ferramentas** — [VO] Requisitos de Ferramenta da Versão exibida, cada um marcado **obrigatória** ou **opcional**, com a classe de efeito e o motivo quando torna a Concessão `indisponível` (RN-HAB-18).
- **Dependências** — [VO] Dependências da Versão exibida, com Versão fixada opcional, profundidade e o fecho transitivo de Ferramentas obrigatórias (RN-HAB-09).
- **Agentes** — Concessões, com Versão fixada e Disponibilidade [D] por Agente.
- **Versões** — histórico com `rascunho` (0..1) / `publicada` (0..N) / `obsoleta`.

**Estados.** Habilidade `ativo`/`arquivado`/`na lixeira`; Versão `rascunho`/`publicada`/`obsoleta`; Disponibilidade da Concessão [D].

**Ações e regras.** Editar rascunho; publicar; obsoletar; conceder a Agente; fixar versão. Regras visíveis: **no máximo um `rascunho`** por Habilidade (RN-HAB-04); publicar valida instruções, nomes de Parâmetros únicos, Ferramentas existentes, Dependências acíclicas dentro da profundidade e Coleções existentes — e a falha em qualquer item rejeita sem efeito, listando o que falta (RN-HAB-06); versões `publicada`/`obsoleta` são **imutáveis** (RN-HAB-07); **Coleção recomendada é declaração, não concessão** — o acesso segue a concessão do Agente (RN-HAB-10); obsoletar a versão fixada torna a Concessão `indisponível`, sem rejeitar (B71).

**Cardinalidade.** Requisitos de Ferramenta 0..N; Dependências 0..N; Coleções recomendadas 0..N; Versão fixada 0..1.

**Estado vazio.** "Nenhum Agente tem esta Habilidade concedida."

**Permissões.** `administrar` para publicar e obsoletar; `executar` para conceder.

---

## T31 · Automações — `/ia/automacoes` ⟨19⟩

**Propósito.** Inventário das regras reativas, por escopo.

**Exibe.** [E] Automação agrupada por **Escopo** (Espaço de Trabalho, Espaço, Pasta, Subpasta, Lista, Funil, Caixa de Entrada, Fila): Nome, Descrição, Natureza [D] (`determinística`/`híbrida`), Estado, **Inoperante** [D] com motivo, Proprietário, Versão vigente [D], última Execução e contagem por resultado [D].

**Estados.** `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira`. **Inoperante** é condição derivada, exibida com motivo (escopo não `ativo`, Espaço de Trabalho `suspenso`, Proprietário `suspenso`, referência inválida) — nunca como selo de estado (documento 19, 11.1).

**Ações e regras.** Criar (escolhendo escopo, **imutável**); duplicar; pausar; arquivar; excluir. Regras visíveis: o escopo delimita o **Gatilho**, não a Ação (RN-LIS-09); mudar de escopo é duplicar e arquivar (RN-AUT-02); a Automação é eliminada com o escopo (B41).

**Cardinalidade.** Escopo: seleção única obrigatória, imutável.

**Estado vazio.** "Nenhuma Automação. Uma Automação reage a um Gatilho, avalia Condições e executa Ações." + [Nova Automação]

**Permissões.** `administrar` para publicar; `executar` para acionar manualmente.

---

## T32 · Automação — editor — `/ia/automacoes/[automacao]` ⟨19⟩

**Propósito.** Compor Gatilho → Condições → Ações e auditar Execuções.

**Aba Editor** (sobre a Versão `rascunho`):
- **Gatilho** — exatamente um por Versão: `evento` (Evento do catálogo sobre o escopo e descendentes, com filtro de subtipo), `agendamento` ([VO] Regra de Agendamento, no fuso da Localidade), `manual` (Membro com `executar`, ou Agente pela Ferramenta `acionar Automação`), `condição temporal` (predicado periódico, uma vez por registro por entrada).
- **Condições** — predicados sobre o objeto do Gatilho, relacionados diretos, dados do Evento e Contexto; conjunção/disjunção/negação; **Condição híbrida** (classificação por Agente com contrato de saída estruturado, Ferramentas de escrita rejeitadas) marcada com o selo `híbrida`.
- **Ações** — lista ordenada. **Ações de escrita** exibem a Ferramenta invocada, a classe de efeito e a permissão requerida. **Ações de controle** (ramificar, invocar Agente, solicitar aprovação, aguardar, notificar, encerrar) são visualmente distintas e não têm classe de efeito.
- **Ação "invocar Agente"** — Agente (padrão: Assistente padrão), Habilidade indicada (0..1), entrada, **Autonomia máxima imposta**, **Aprovador** (0..1 Membro ou Equipe), **Tempo limite**.
- [VO] **Política de erro** — `interromper` (padrão) / `continuar`; retentativa só para falha transitória de Ferramenta de Integração; notificação ao Proprietário.

**Aba Execuções.** [E] Execução de Automação: Estado, Gatilho disparador [VO], Objeto, Ator invocador, ator delegante, Versão usada, Motivo, [VO] Passos (Condição avaliada / Ação executada, com resultado `concluído`/`falhou`/`pulado`/`aguardando`/`cancelado`, permissão avaliada, tentativas), **Execuções de Agente filhas**, Solicitações de Aprovação, **Cadeia de Execuções**, Custo.

**Aba Versões** e **Aba Permissões** (Papel 0..1, concessões próprias, **teto do Proprietário** explicado).

**Estados.** Automação (5) + Versão (`rascunho`/`publicada`/`obsoleta`) + Execução (6).

**Ações e regras.** Editar rascunho; publicar; acionar manualmente; pausar; transferir propriedade. Regras visíveis:
- **Um Gatilho por Versão**: quem precisa de dois Eventos cria duas Automações (DO-AUT-02).
- Publicar valida escopo × Gatilho, ao menos uma Ação, Ferramentas existentes, Agentes `ativo` com `executar`, Habilidades concedidas, Definições efetivas e o **teto de permissões do Proprietário** — e rejeita sem efeito, listando o que falta (RN-AUT-07, RN-AUT-04).
- Publicar torna a Versão anterior `obsoleta` no mesmo ato (DO-AUT-19).
- Restaurar devolve a `pausado`, nunca a `ativo` (RN-AUT-05).
- **Limite de operações por Execução**: ao atingi-lo, a Execução passa a `aguardando aprovação` com Solicitação ao Proprietário, **em qualquer nível de autonomia** (RN-AUT-13).
- Aprovação concedida **reavalia** Condições e pré-condições antes de executar (RN-AUT-16).
- Disparo que fecharia ciclo (par (Automação, objeto) repetido, Agente repetido, profundidade excedida) **não cria Execução**: gera "disparo recusado por ciclo" com a Cadeia e notifica (RN-AUT-09).
- Eventos "por remapeamento" **não** disparam Gatilhos ordinários (RN-AUT-22).
- Uma Automação nunca cria nem reconfigura Automação alguma (RN-AUT-24).

**Cardinalidade.** Gatilho 1; Condições 0..N; Ações 1..N para publicar; Autonomia máxima 0..1; Aprovador 0..1.

**Estado vazio.** Editor: "Escolha um Gatilho para começar." Execuções: "Nenhuma Execução ainda."

**Permissões.** `administrar` para publicar; `executar` para acionar; Papel para atribuir Papel à Automação.

---

## T33 · Conhecimento — Coleções — `/ia/conhecimento` ⟨20⟩

**Propósito.** Inventário do corpus curado.

**Exibe.** [E] Coleção: Nome, Descrição, Proprietário, Privada, Estado próprio, quantidade de Documentos [D], momento da última Atualização [D], Agentes com acesso [D].

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; arquivar; excluir. Regras visíveis: **Coleção não contém Coleção** — não existe "Nova subcoleção" (RN-CNH-03); um Espaço de Trabalho nasce **sem** Coleções e nenhuma é obrigatória (B96); arquivar a Coleção pausa as Fontes e a retira das consultas de Agentes no ato (documento 20, 11.1).

**Cardinalidade.** Proprietário exatamente 1.

**Estado vazio.** "Nenhuma Coleção. Conhecimento é conteúdo curado que Agentes consultam — Tarefas, Contatos e Negócios não são Conhecimento." + [Nova Coleção]

**Permissões.** `ver` para listar; Coleção privada só a Proprietário, concessões e compartilhamentos (B97).

---

## T34 · Coleção — `/ia/conhecimento/[colecao]` ⟨20⟩

**Propósito.** Governar Documentos, Fontes e acesso.

**Exibe.** Abas:
- **Documentos** — [E] Documento: Título, Tipo de conteúdo, Fonte, Estado próprio, Estado efetivo [D], Estado de processamento [D], **Desatualizado** [D], Ausente na origem desde [A].
- **Fontes** — [E] Fonte: Tipo (`envio manual` implícita e não removível; `URL`; `Integração`), Nome, [VO] Configuração, [VO] Política de atualização, Membro configurador, Estado operacional, Marca de versão da origem [VO], resultado da última Atualização.
- **Acesso** — Proprietário, Privada, concessões a **Agentes** (`ver`, opcionalmente `criar`/`editar`), compartilhamentos a Membros e Equipes.
- **Retenção** — [VO] Política de retenção de versões.

**Estados.** Coleção (3) + Fonte (`ativo`/`pausado`/`com erro`) + Documento (próprio e efetivo) + processamento da Versão corrente.

**Ações e regras.** Adicionar Documento; configurar Fonte; atualizar Fonte; conceder acesso a Agente; tornar privada; arquivar; excluir. Regras visíveis: a Coleção é o **único Recurso de permissão** do Conhecimento — Documento, Versão e Fragmento herdam e nunca têm permissão própria (B97), e a tela diz isso na aba Acesso; toda Coleção tem exatamente uma Fonte `envio manual`, não removível (RN-CNH-04); eliminar Fonte com Documentos exige **escolha explícita** (manter como `envio manual` ou enviar à lixeira) — nunca eliminação silenciosa (RN-CNH-19); Atualização que não encontra um Documento o **arquiva**, nunca o envia à lixeira nem o elimina (RN-CNH-18); "Agente tem acesso" é concessão gravada aqui, e a aba Conhecimento do Agente é só a visão derivada (DO-CNH-12).

**Cardinalidade.** Fontes 1..N; concessões a Agentes 0..N.

**Estado vazio.** "Nenhum Documento. Envie um arquivo ou configure uma Fonte." + [Adicionar Documento] [Nova Fonte]

**Permissões.** `ver`/`comentar`/`criar`/`editar`/`excluir`/`administrar` conforme RN-CNH-06.

---

## T35 · Documento de Conhecimento — `/ia/conhecimento/documentos/[documento]` ⟨20⟩

**Propósito.** O conteúdo curado, versionado e rastreável.

**Exibe.** Cabeçalho sem Proprietário (governança da Coleção — B97), com Criador, Coleção e Fonte. Atributos: Título (editável sem criar Versão), Tipo de conteúdo, Versão corrente [D], Estado próprio, Estado efetivo [D], Estado de processamento [D], Desatualizado [D], Ausente na origem desde [A].
Seções: **Conteúdo** da Versão corrente ([VO] texto próprio e/ou Arquivo) + [VO] **Representações derivadas** com o Ator gerador; [VO] **Metadado** (autor original, idioma, data do conteúdo, rótulos, resumo); [VO] **Proveniência** (Fonte, origem específica, Ator que adicionou com delegante, momento, marca de versão da origem, copiado de) — **obrigatória e nunca esvaziada**; **Versões** com Origem da Versão; **Vínculos** (Tarefa, Negócio, Contato, Empresa, Documento); **Comentários** (podem citar Versão e Posição); **Execuções que consultaram** [D] (derivado das Referências de Conhecimento).

**Estados.** Ciclo de vida (próprio e efetivo) × processamento (`pendente`/`processado`/`com erro`), explicitamente distintos na tela (documento 20, 11.3).

**Ações e regras.** Nova Versão; editar Metadado; restaurar Versão; mover de Coleção; comentar; arquivar; excluir. Regras visíveis: o Conteúdo de uma Versão é **imutável** — toda alteração cria Versão nova (RN-CNH-12); **só a Versão corrente é consultável** (RN-CNH-13); restaurar Versão anterior **cria Versão nova**, nunca reordena o histórico (RN-CNH-14); falha de processamento **não** remove nem arquiva o Documento: ele continua visível, comentável e vinculável, apenas não entra em Contexto (RN-CNH-20); movimentação entre Coleções é restrita a Fonte `envio manual` (RN-CNH-08); Documento não recebe Tags — usa rótulos livres do Metadado (B5; `conhecimento.md`, 7.3. DO-CNH-06 é **proposta** de admiti-las, não adotada); Comentários **nunca** são Conteúdo e nunca geram Fragmentos (INV-CNH-08).

**Cardinalidade.** Coleção 1; Fonte 1; Versões 1..N com exatamente 1 corrente; Vínculos 0..N.

**Estado vazio.** Comentários: "Nenhum comentário." Execuções que consultaram: "Nenhuma Execução citou este Documento ainda."

**Permissões.** Herdadas da Coleção, sem exceção (RN-CNH-17).

---

## T36 · Aprovações — `/ia/aprovacoes` ⟨17, 19⟩

**Propósito.** Decidir o que a IA não pode fazer sozinha.

**Exibe.** [E] Solicitação de Aprovação: solicitante (Agente ou Automação), **Motivo** (`autonomia`, `permissão`, `limite`, ou Ação explícita da Automação), [VO] **Objeto fixo** (Ferramenta + entrada completa + Recurso-alvo + classe de efeito), aprovador designado, prazo (padrão 72 h), Decisão, Decisor, Execução de origem com a Cadeia.

**Estados.** `pendente` e, com Decisão, `aprovada`/`rejeitada`/`expirada`/`cancelada` (terminais).

**Ações e regras.** Aprovar; recusar com motivo; abrir Execução. Regras visíveis: **aprovar é aprovar exatamente aquilo** — o objeto é imutável e nova redação é nova Solicitação (RN-AGE-17); **aprovar nunca concede permissão**: as duas verificações são refeitas no momento da aprovação e podem resultar em "negada" (RN-AGE-17); no motivo `permissão`, **só quem tem a permissão requerida** aprova, e se torna delegante do Passo (DO-AGE-11); vencido o prazo, a Solicitação fica `expirada` e a Execução `cancelada` (RN-AGE-18); na Automação, aprovar **reavalia** Condições (RN-AUT-16).

**Cardinalidade.** Decisão: única.

**Estado vazio.** "Nenhuma Solicitação de Aprovação pendente para você."

**Permissões.** O aprovador designado; quem tem `administrar` sobre o Agente ou a Automação; no motivo `permissão`, só quem tem a permissão requerida (B80).

---

# V. PAINÉIS

## T37 · Painéis — `/paineis` ⟨21⟩

**Propósito.** Inventário das leituras analíticas.

**Exibe.** [E] Painel: Nome, Descrição, Proprietário, [VO] Âncora com validade [D], **Painel de contexto** vs. **Painel do Espaço de Trabalho** [D], Condição de integridade [D] (`íntegro`/`parcialmente inválido`/`vazio`), Estado.

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; **copiar** (com Proveniência; sem compartilhamentos, concessões, Proprietário nem Âncora); arquivar; excluir. Regras visíveis: **não existe Template de Painel** (B108); a plataforma **não instancia** Painéis na criação do Espaço de Trabalho (RN-PAI-03); nome único entre `ativo`/`arquivado` (RN-PAI-31).

**Cardinalidade.** Âncora 0..1.

**Estado vazio.** "Nenhum Painel ainda. Um Painel lê as entidades com as permissões de quem o consulta e nunca guarda dados." + [Novo Painel]

**Permissões.** Membro cria e governa os próprios; Convidado só por compartilhamento; Agente recebe no máximo `ver` (B20, B107).

---

## T38 · Painel — `/paineis/[painel]` ⟨21⟩

**Propósito.** Ler números que respeitam quem está olhando.

**Exibe.** Cabeçalho com Nome, Proprietário, [VO] Âncora com validade, e — **em toda consulta** — o **Momento de referência dos dados** [D] com a declaração fixa "Os valores refletem as suas permissões." Grade de [E] Widget conforme o [VO] Leiaute.

Por Widget: Título, Tipo de Visualização de dados (`número`, `barras`, `linhas`, `pizza`, `funil`, `tabela`, `lista de registros`, `calendário`, `texto`), [VO] Fonte de Dados (entidade-alvo do catálogo fechado × escopos por identidade × inclusões: Subtarefas, arquivados, Ensaios), [VO] Métricas, [VO] Dimensões (0..2), [VO] Filtros fixos, [VO] Período com Atributo temporal de referência, Ordenação, Limite, Validade [D].

**Estados.** Painel (3). Condições derivadas: Widget `inválido` com causa; Disponibilidade da Fonte por visualizador (`disponível`/`arquivada`/`indisponível`/`eliminada`); Condição de integridade.

**Ações e regras.** Criar, editar e **remover** Widget (documento 21, 12.2 — configuração sem lixeira, confirmação simples); reordenar Leiaute; aplicar **Filtro interativo** (estado de sessão, nunca gravado); definir, trocar e **remover** Âncora (remover uma Âncora `eliminada` é a única forma de apagar o seu valor — documento 21, 12.2); compartilhar; exportar (ato registrado); arquivar. Regras visíveis:
- Um Widget = **uma** Fonte = **uma** entidade-alvo; cruzamentos exigem Widgets distintos (B101).
- Status é lido por **categoria** quando o escopo mistura Conjuntos de Status; a Dimensão "Definição de Status" só aparece sob Conjunto efetivo único (RN-PAI-11).
- Valor de Negócio produz **uma série por moeda**; o Painel **nunca converte** (RN-PAI-13).
- **Fonte sem acesso**: o Widget não é calculado nem desenhado, e nem o nome do escopo é revelado (RN-PAI-29).
- Widget inválido **permanece** com a causa; nada é apagado pelo Sistema; a restauração do que o invalidou o revalida (RN-PAI-20).
- Arquivar **não congela** números; congelar é exportar (RN-PAI-26, RN-PAI-24).
- Registro com N valores em Dimensão multivalorada conta em **cada** valor, e a tela avisa que a soma das partes pode exceder o total (RN-PAI-16).
- Conteúdo de Documento, Fragmento, Mensagem, Mensagem de Chat, Comentário e Memória **nunca** é exibido nem agregado (RN-PAI-15).
- Sessão de Chat nunca é Fonte (B85).

**Cardinalidade.** Fonte 1 (0 em `texto`); Métricas 1..N conforme o tipo; Dimensões 0..2; Filtros 0..N; Período 0..1; Âncora 0..1.

**Estado vazio.** "Este Painel está vazio." + [Novo Widget] · Widget sem resultado: "Nenhum registro no período." (distinto de "Fonte sem acesso").

**Permissões.** `ver`/`editar`/`excluir`/`administrar` em escopo `registro`, cumulativas; o Proprietário tem `administrar` por propriedade; **não existe link público** (B104).

---

# VI. CONFIGURAÇÕES

## T39 · Configurações — visão geral — `/configuracoes` ⟨01⟩

**Exibe.** [E] Espaço de Trabalho: Nome, Estado, Proprietário do Espaço de Trabalho [D], Criador, Momento de criação, [VO] Localidade (fuso, moeda, idioma), [VO] Política de lixeira, Profundidade máxima de Subtarefas, [VO] Identificador legível de Tarefas, [VO] Identificador legível de Negócios, Funil padrão, Assistente padrão, Template de Espaço padrão, [VO] Limites impostos, [VO] Suspensões vigentes, Momento de encerramento, Previsão de eliminação [D].

**Estados.** `ativo`, `suspenso`, `encerrado`.

**Ações e regras.** Editar configurações; transferir propriedade (D05); **suspender** (confirmação simples, com o efeito quantificado: "N Membros ficarão sem ações com efeito; Execuções em curso serão canceladas; Mensagens recebidas serão persistidas sem distribuição"); **reativar** (exige levantar cada suspensão por quem a impôs); encerrar (confirmação por digitação). Regras visíveis: alterar a Localidade **não reescreve** valores já gravados (RN-ET-16); reduzir a Profundidade máxima **não elimina** Subtarefas existentes — congela as árvores legadas e informa quantas ficaram além do limite (RN-ET-17); os Limites impostos vêm da plataforma e o Espaço de Trabalho **não os define** (B34); encerrar é ato exclusivo do Proprietário (RN-ET-20); reativar exige levantar **todas** as suspensões, cada uma por quem a impôs (B31).

**Cardinalidade.** Funil padrão exatamente 1; Template de Espaço padrão 0..1.

**Estado vazio.** —

**Permissões.** Papel Proprietário / Administrador; encerrar só Proprietário.

---

## T40 · Membros — `/configuracoes/membros` ⟨01⟩

**Exibe.** [E] Membro: Nome de exibição, Usuário, [VO] Identidade convidada (enquanto `pendente` sem Usuário), Estado, Papel, Equipes, Convidado por, Momento de ingresso, Momento de remoção, Sucessor, Disponibilidade de atendimento.

**Estados.** `pendente`, `ativo`, `suspenso`, `removido`.

**Ações e regras.** Convidar; reenviar convite; **revogar convite** (confirmação simples; não gera Sucessor — o Membro `pendente` não é Proprietário de nada); atribuir Papel; **suspender** (confirmação simples, com o efeito nomeado: "mantém Papel, Equipes, propriedades e responsabilidades, e perde todas as ações com efeito"); reativar; remover (D04). Regras visíveis: **o registro de Membro nunca é apagado** (RN-ET-10) — `removido` continua listado com filtro; o Proprietário não pode ser suspenso nem removido sem transferência prévia (RN-ET-05); um Membro tem **exatamente um** Papel (RN-ET-06); Membros `pendente` contam para o Limite de Membros (RN-ET-23); só `ativo`/`suspenso` integram Equipes (RN-ET-12); um Administrador pode suspender, remover ou rebaixar outro Administrador (RN-ET-25).

**Cardinalidade.** Papel: único obrigatório. Equipes: múltiplo.

**Estado vazio.** Não se aplica.

**Permissões.** Governança por Papel; **não concedível** por concessão direta nem compartilhamento (RN-ET-24).

---

## T41 · Membro — `/configuracoes/membros/[membro]` ⟨01⟩

**Exibe.** Os atributos de T40 + **propriedades** (registros de que é Proprietário: Contatos, Empresas, Negócios, Agentes, Automações, Painéis, Coleções), **responsabilidades** (Tarefas como Responsável, Conversas como Atribuído, Itens de Checklist), **Solicitações de Aprovação** em que é aprovador, concessões diretas, Registros de Atividade.

**Ações e regras.** Atribuir Papel; suspender; remover com Sucessor (D04). A tela **antecipa a sucessão**: mostra exatamente o que será transferido e o que será liberado, antes de confirmar (B28). Regras visíveis: Sessões de Chat e Memória do Usuário **não** são sucedidas — vão à lixeira e são eliminadas ao fim do prazo, salvo reconvite (B87); a concessão `administrar` sobre contêiner privado que ficaria órfã passa ao Sucessor (B38d); autoria e Registros permanecem com o Membro `removido` (A6.4).

**Cardinalidade.** Sucessor: único, Membro `ativo` sem base Convidado.

**Estado vazio.** "Este Membro não é Proprietário de nenhum registro."

**Permissões.** Papel de nível Administrador.

---

## T42 · Equipes — `/configuracoes/equipes` ⟨01⟩

**Exibe.** [E] Equipe: nome (único no Espaço de Trabalho), descrição, Membros, Criador.
**Ações e regras.** Criar/editar/excluir; incluir Membros. Regra visível: a Equipe **não tem Papel** — permissões de Equipe são concessões diretas (documento 01, 7.2); só Membros `ativo` ou `suspenso` integram (RN-ET-12).
**Cardinalidade.** Membros: múltiplo. **Estado vazio.** "Nenhuma Equipe." **Permissões.** Papel de nível Administrador.

---

## T43 · Papéis — `/configuracoes/papeis` ⟨01⟩

**Exibe.** [E] Papel de sistema (Proprietário do Espaço de Trabalho, Administrador, Membro, Convidado — imutáveis) e [E] Papel personalizado com **base** declarada. Matriz de Permissões por Ação (`ver`, `comentar`, `criar`, `editar`, `excluir`, `administrar`, `executar`) e Recurso.
**Ações e regras.** Criar Papel personalizado com base (nunca Proprietário); editar permissões **dentro do teto da base**; **excluir Papel personalizado (D14)** — exige **Papel de destino dos titulares** no mesmo ato (documento 01, 18: "na remoção, Papel de destino dos titulares"). Papéis de sistema não oferecem exclusão. A tela **avisa** quando um rebaixamento a base Convidado deixaria propriedades com o titular, listando os registros (C32 — `PENDENCIAS-FRONTEND.md`). Regras visíveis: a base é teto e nível (B30); Papéis de sistema não são renomeados, excluídos nem reduzidos (RN-ET-06); Agentes e Automações nunca recebem base Proprietário ou Administrador (INV-ET-13).
**Cardinalidade.** Base: única obrigatória. **Estado vazio.** "Nenhum Papel personalizado." **Permissões.** Papel de nível Administrador.

---

## T44 · Tags — `/configuracoes/tags` ⟨01⟩

**Exibe.** [E] Tag: nome, cor, **restrição de tipo** (Tarefa, Contato, Empresa, Negócio, Conversa), uso [D].
**Ações e regras.** Criar/editar/excluir. Regra visível: Tags são definidas **só** no Espaço de Trabalho (RN-ET-13); excluir remove a aplicação de todos os registros, com aviso quantificado (RN-TAR-11).
**Cardinalidade.** Restrição: múltipla. **Estado vazio.** "Nenhuma Tag." **Permissões.** Papel de nível Administrador.

---

## T45 · Campos do CRM — `/configuracoes/campos` ⟨01⟩

**Exibe.** [E] Definição de Campo Personalizado por **entidade-alvo** (Contato, Empresa, Negócio, Conversa): nome, Tipo de Campo, opções, obrigatoriedade. Marca das Definições instanciadas na criação (Segmento, Porte, Setor — DO-EMP-10).
**Ações e regras.** Criar/editar/arquivar. Regras visíveis: Definições para **Tarefa** não vivem aqui — vivem em Espaço, Pasta, Subpasta ou Lista (RN-ET-14), e a tela diz isso com link; remover a Definição remove ou arquiva os Valores (A5.4); Requisito de Etapa que a referencia é removido no mesmo ato (RN-FUN-09).
**Cardinalidade.** Tipo de Campo e entidade-alvo: únicos obrigatórios. **Estado vazio.** Por entidade-alvo. **Permissões.** Papel de nível Administrador.

---

## T46 · Catálogos — `/configuracoes/catalogos` ⟨01⟩

**Exibe.** [E] Origem, [E] Definição de Qualificação (nome, cor, ordem), [E] Finalidade de Consentimento (com indicador "exige consentimento para envio"), [E] Motivo de Perda (com "Duplicado" pré-definido), [E] Motivo de Ganho. Uso [D] por item.
**Ações e regras.** Criar/editar/arquivar; substituir referências. Regras visíveis: eliminar Motivo referenciado por Negócio encerrado é **rejeitado** — substitua em lote ou arquive (RN-NEG-12); eliminar Origem, Qualificação ou Finalidade limpa a referência ou exige substituta, e **nenhum registro é eliminado ou alterado de outra forma** (RN-CON-18, RN-CRM-18); registros de Consentimento preservam o nome da Finalidade à época (RN-CON-18).
**Cardinalidade.** — **Estado vazio.** Não se aplica: itens iniciais são instanciados na criação (B34). **Permissões.** Papel de nível Administrador.

---

## T47 · Templates — `/configuracoes/templates` ⟨01, 08⟩

**Exibe.** [E] Template de Espaço, de Pasta, de Lista, de Tarefa, de Checklist, de Agente (do Espaço de Trabalho) e os **Templates de Agente da plataforma** (globais, somente leitura). Por Template: nome, conteúdo descrito, Criador, uso.
**Ações e regras.** Criar a partir de registro; editar; excluir; definir Template de Espaço padrão. Regras visíveis: instanciar cria entidades novas **sem vínculo vivo**, com Proveniência (A8); **Template de Pasta que contém Subpastas só é instanciável em um Espaço** (B47); **não existe Template de Habilidade** (copiar), **de Automação** (duplicar; Templates de contêiner as carregam) nem **de Painel** (copiar) — a tela explica cada caso; Templates de Agente do Espaço de Trabalho não levam Memória, Execuções nem permissões (B81).
**Cardinalidade.** Template de Espaço padrão: 0..1. **Estado vazio.** "Nenhum Template." **Permissões.** Papel de nível Administrador.

---

## T48 · Integrações — `/configuracoes/integracoes` ⟨01⟩

**Exibe.** [E] Integração: nome, tipo de sistema externo, Estado (`conectada`/`desconectada`/`com erro`), Membro configurador, Criador, Ferramentas expostas [D]. Canais aparecem como **link para a Caixa de Entrada**, não editáveis aqui (o Canal é contido pela Caixa — documento 01, 7.4).
**Ações e regras.** Conectar; reconectar; desconectar (confirmação por ser externa); **remover** (confirmação por digitação: destrói credenciais irrecuperáveis e o diálogo enumera a cascata — Ferramentas expostas que ficam inoperantes, Canais e Fontes de Conhecimento que dependem dela, Automações cujas Ações passarão a falhar). Regras visíveis: a Integração **não tem Proprietário** e não é sucedida (B35); credenciais nunca são exibidas depois de gravadas; Ferramentas de Integração `desconectada` permanecem permitidas e ficam **inoperantes** (documento 18, 7.4).
**Cardinalidade.** — **Estado vazio.** "Nenhuma Integração." **Permissões.** Papel de nível Administrador.

---

## T49 · Lixeira — `/configuracoes/lixeira` ⟨transversal, B43⟩

**Propósito.** O único lugar em que registros `na lixeira` aparecem.

**Exibe.** Por tipo de entidade: nome à época, quem excluiu e quando, **Estado próprio anterior à exclusão** [A], **Previsão de eliminação** [D], e — para registros de cadeia — o ancestral que os restringe.

**Estados.** `na lixeira` (todos). Entidades **sem** `na lixeira` não aparecem: Canal (DO-CXE-03), Etapa, Mensagem, Fragmento, Participante, Registro de Atividade, Versões.

**Ações e regras.** Restaurar; eliminar antecipadamente. Regras visíveis: restaurar devolve o **Estado próprio anterior à exclusão**, nunca força `ativo` — e a tela mostra para onde volta (B43); Agente e Automação voltam a `pausado` (B94); Conversa volta a `resolvida`; restaurar exige pai não efetivamente `na lixeira`, com a alternativa de escolher novo pai (RN-LIS-14); Subtarefa cujo pai não é restaurado volta como Tarefa raiz (RN-TAR-28); colisão de nome bloqueia até renomear (B39); Contato/Empresa `mesclado` **não aparecem** (a mesclagem é irreversível — B14).

**Cardinalidade.** Novo pai na restauração: seleção única opcional.

**Estado vazio.** "A lixeira está vazia. Registros excluídos ficam aqui por 30 dias."

**Permissões.** `excluir` para ver e restaurar; `administrar` para eliminar antecipadamente (B46).

---

## T50 · Auditoria — `/configuracoes/auditoria` ⟨01, A6.2⟩

**Propósito.** A visão global dos Registros de Atividade.

**Exibe.** [E] Registro de Atividade: Ator (com tipo), ação, objeto (tipo + nome à época), momento, resultado, **ator delegante**. Filtros por Ator, tipo de Ator, tipo de objeto, período, ação.

**Estados.** Registros são imutáveis e não têm estado (Glossário).

**Ações e regras.** Filtrar; abrir objeto (quando ainda existe e o visualizador tem `ver`). Regras visíveis: o Registro sobrevive à eliminação do objeto, preservando o nome à época (INV-ET-12); **atos de governança registrados** (entrada em contêiner privado) aparecem com o motivo, visíveis a quem tem acesso ao recurso (B38b); eliminação permanente é auditoria, **não** Painel (RN-PAI-30).

**Cardinalidade.** Filtros múltiplos.

**Listas longas.** Ordenação padrão por momento, decrescente; paginação por bloco com [Carregar anteriores]. A contagem total só é exibida quando não depende de permissão por linha (B103).

**Estado vazio.** "Nenhum Registro de Atividade com estes filtros."

**Permissões.** Papel de nível Administrador; cada linha ainda filtrada por `ver` sobre o objeto, quando ele existe.

---

## T51 · Notificações — `/notificacoes` (e painel do sino) ⟨transversal⟩

**Propósito.** Reunir o que espera pela pessoa. **Não é entidade da ontologia** — "notificação não é registro da ontologia" (documento 19, 7.4): é visão derivada de Eventos e Registros de Atividade dirigidos ao Membro logado. Registrado em `PENDENCIAS-FRONTEND.md`, A1.

**Exibe.** Itens derivados, agrupados por origem, cada um com Ator e ator delegante, objeto (tipo + nome), momento e o que aconteceu:
- **Aprovações** — Solicitação de Aprovação em que o Membro é aprovador designado ou pode decidir, com prazo (B80).
- **Menções** — em descrição, Comentário ou Mensagem `interna`, sujeitas a `ver` sobre o registro (RN-TAR-14, RN-CXE-22).
- **Responsabilidades** — atribuição e liberação de Responsável, Atribuído e Responsável de Item.
- **Observação** — eventos das Tarefas em que é Observador (Glossário).
- **Propriedade** — o que passou a ser seu por transferência ou sucessão (B28), e Automações que continuam `ativo` sob o seu teto (DO-AUT-14).
- **Execuções e falhas** — Execução `falhou`, disparo recusado por ciclo e referência inválida, para o Proprietário da Automação (RN-AUT-18).
- **Sistema** — Contato restaurado por Mensagem recebida, Adiamento vencido, Documento arquivado por ausência na origem, Item de Memória expirado, Limite atingido.

**Estados.** Nenhum: os itens não têm estado de ciclo de vida. "Lida / não lida" é **estado de sessão do visualizador**, como o Filtro interativo (B103 por analogia) — não é persistido e não sobrevive à troca de Membro.

**Ações e regras.** Abrir o registro (destino: a tela do objeto); marcar como lida; marcar todas como lidas; filtrar por origem. Regras visíveis: cada item é filtrado pela permissão efetiva sobre o **objeto**, avaliada na consulta — um item cujo objeto o Membro deixou de ver **desaparece**, sem contagem residual (B103 por analogia); nenhuma notificação revela nome ou existência de registro sem `ver`; a notificação **não** substitui o Registro de Atividade, que continua em T50 e na aba Atividade do objeto.

**Cardinalidade.** Filtro de origens: múltiplo.

**Listas longas.** Ordenação por momento, decrescente; paginação com [Carregar anteriores].

**Estado vazio.** "Nada novo para você." · Com filtro: "Nada nesta categoria."

**Permissões.** Só o próprio Membro; não existe rota de terceiro.

---

# VII. DIÁLOGOS

Cada um é sobreposição com endereço próprio (ver `MAPA-DE-NAVEGACAO.md` §4). Todos: **confirmar desabilitado até a entrada ser válida**; rejeição não produz efeito parcial.

## D01 · Mapeamento de status — `?mapear-status=`
**Exibe.** Cada Definição de Status **em uso** pelas Tarefas afetadas → seletor de Definição do Conjunto resultante, com a **categoria** de origem e de destino visíveis. Contagem de Tarefas por Definição. Aviso quando a categoria muda ("12 Tarefas passarão de *em andamento* para *concluído* e gerarão o evento de conclusão").
**Regra.** Sem mapeamento completo, a operação é **inválida** (RN-LIS-06). Aplicado no mesmo ato; a categoria nunca muda sem ato explícito (B40). Gera Registro por Tarefa.
**Origem.** Sobrescrever/voltar a herdar Conjunto; alterar Conjunto ancestral; remover Definição em uso; mover Lista, Pasta, Subpasta ou Tarefa.

## D02 · Remapeamento de Etapa — `?remapear-etapa=`
**Exibe.** Etapa a remover (ou Funil a arquivar/excluir) → destino por Etapa, com a contagem de Negócios por situação **e por estado, inclusive `na lixeira`**.
**Regra.** Obrigatório e no mesmo ato; **não** avalia Requisitos de `entrada`; **preserva** a probabilidade sobrescrita; gera Registro com origem `remapeamento`, nunca "avançou" (RN-FUN-08, RN-FUN-10, RN-NEG-05).

## D03 · Mesclar Contatos / Empresas — `?mesclar=`
**Exibe.** Os dois registros lado a lado; escolha do sobrevivente; o que **migra** (Identificadores, Vínculos, Tags, Valores de Campo, Consentimentos, Endereços, componentes) e o que fica no **Estado pré-mesclagem** do absorvido; as referências que serão reapontadas (Conversas, Negócios, Tarefas, âncoras).
**Regra.** Só entre registros `ativo` ou `arquivado` (nunca `na lixeira` nem `mesclado`), por Ator com `administrar` sobre ambos; o sobrevivente resulta `ativo` se um dos dois era; **irreversível** — confirmação por digitação (B14). Se produzir duas Conversas não resolvidas no mesmo Canal, a de Mensagem mais recente permanece e a outra é resolvida com causa "mesclagem" — o diálogo avisa (RN-CXE-10).

## D04 · Remover Membro com Sucessor — `?remover-membro=`
**Exibe.** Seletor de **Sucessor** (Membro `ativo` sem base Convidado; padrão: o ator da remoção). Lista do que será **transferido** (propriedades por tipo; Solicitações de Aprovação pendentes; concessão `administrar` de contêiner privado que ficaria órfã) e do que será **liberado** (Tarefas como Responsável, Itens de Checklist, Conversas como Atribuído). Aviso: "As Sessões de Chat e a Memória do Usuário irão para a lixeira e serão eliminadas em 30 dias."
**Regra.** B28, B87, B38d, RN-ET-09.

## D05 · Transferir propriedade do Espaço de Trabalho — `?transferir-propriedade=`
**Exibe.** Destinatário (Membro `ativo`); Papel que o Proprietário atual passará a ter (padrão: Administrador).
**Regra.** Ato único e atômico; nenhum Administrador transfere nem se autopromove (RN-ET-04). Confirmação por digitação.

## D06 · Ato de governança registrado — `?acesso-governanca=`
**Exibe.** Recurso privado (contêiner, Funil ou Coleção); Sujeito (podendo ser o próprio ator); Ações a conceder; **motivo obrigatório**.
**Como o ator chega ao recurso.** B38a esconde o contêiner privado inclusive do Proprietário do Espaço de Trabalho e dos Administradores, e a ontologia exige que a via de B38b exista sem dizer por onde. A interface adota: o diálogo é aberto **a partir da Auditoria (T50)**, onde os Registros de Atividade do recurso privado aparecem para quem tem o Papel — nome do objeto e ator, nunca conteúdo —, e a partir de um **campo de identificador** para quem recebeu a referência por fora. Não existe listagem navegável de recursos privados. Registrado em `PENDENCIAS-FRONTEND.md`, A7.
**Regra.** Única via de entrada sem concessão prévia; **nunca silenciosa** — gera Registro de Atividade com motivo, visível a quem tem acesso ao recurso (B38b, B61, DO-CNH-11).

## D07 · Encerrar Negócio — `?ganhar=` / `?perder=`
**Exibe.** Ao ganhar: quantia e moeda quando a Regra "exigir valor" está ativa; Motivo de Ganho (opcional); Nota de encerramento. Ao perder: Motivo de Perda quando a Regra o exige; Nota.
**Regra.** Avaliação síncrona e bloqueante para **todo Ator, sem exceção por Papel**; não avalia Requisitos de `saída`; **não altera a Etapa** (RN-NEG-09, RN-FUN-11). Valor vazio e valor zero são rejeitados igualmente quando "exigir valor" está ativa (documento 12, 6.2).

## D08 · Migrar Negócios de Funil — `?migrar-negocios=`
**Exibe.** Funil de destino (`ativo`) e mapeamento explícito de Etapas; contagem por situação e estado.
**Regra.** Arquivar exige migrar os `aberto`; enviar à lixeira exige migrar **todos**, inclusive `na lixeira`; **sem mapeamento por nome ou posição** (RN-FUN-12, RN-FUN-13, RN-FUN-15).

## D09 · Decidir Solicitação de Aprovação — `?aprovar=`
**Exibe.** Objeto fixo em linguagem clara ("Enviar esta Mensagem a *Marina Alves* na Conversa X"), Ferramenta, classe de efeito, Recurso-alvo, solicitante, motivo, prazo, Execução e Cadeia.
**Regra.** Aprovar é aprovar **isto**; as verificações são refeitas na aprovação e podem resultar em "negada"; no motivo `permissão`, só quem tem a permissão requerida aprova (B80, RN-AGE-17).

## D10 · Restaurar cópia de registro `mesclado` — `?restaurar-copia=`
**Exibe.** O Estado pré-mesclagem do absorvido, campo a campo; aviso de que será criado um **registro novo** com Proveniência, e de que o absorvido permanece `mesclado`.
**Regra.** Única saída da mesclagem; **não** reativa o absorvido (RN-CON-15, B14).

## D11 · Transferir Identificador de Contato — `?transferir-identificador=`
**Exibe.** Identificador; Contato de destino; aviso: "Só a resolução futura muda. Conversas e Mensagens passadas permanecem com *Contato de origem*."
**Regra.** Exige `editar` em ambos; Registro nas duas pontas; mover Conversas específicas é **ato separado** (DO-CON-12, RN-CON-09).

## D12 · Mover Conversa para outro Contato — `?mover-conversa=`
**Exibe.** Contato de destino; aviso sobre Conversa não resolvida existente no mesmo Canal.
**Regra.** Exige `editar` na Conversa e `ver` em ambos os Contatos; **rejeitado** se o destino já tiver Conversa não resolvida no mesmo Canal, salvo resolução no mesmo ato (RN-CXE-11, RN-CXE-10).

## D14 · Excluir Papel personalizado — `?excluir-papel=`
**Exibe.** Papel a excluir; contagem e lista dos **titulares** (Membros e Agentes); seletor de **Papel de destino** para cada grupo de titulares, com a base do destino visível; aviso do que muda em permissões efetivas.
**Regra.** A ontologia exige, no evento de remoção, o **Papel de destino dos titulares** (documento 01, 18). Confirmar desabilitado enquanto houver titular sem destino — mesmo padrão de D01. Papéis de sistema **não** são excluíveis (RN-ET-06). Destino de Agente nunca pode ser Proprietário, Administrador nem base neles (INV-ET-13). Aplicado no mesmo ato, com Registro de Atividade por titular.

## D15 · Importar Contatos — `?importar-contatos=`
**Exibe.** Quatro passos: (1) arquivo e mapeamento de colunas para atributos e Identificadores; (2) **escolha explícita para colisões** — "rejeitar a linha" ou "tratar como atualização do Contato existente"; (3) Proprietário dos Contatos criados (padrão: o ator) e Origem a atribuir; (4) pré-visualização com as primeiras linhas já classificadas.
Durante: **progresso** com contagem ("312 de 2.000 linhas"). Ao fim: **resultado** com o balanço ("1.847 criados · 61 tratados como atualização · 92 rejeitados") e a lista navegável dos rejeitados com o motivo por linha.
**Regra.** A ontologia define a importação: "cada linha é um Contato; linhas cujo Identificador colide com um Contato existente são **rejeitadas ou tratadas como atualização, conforme escolha explícita do ator na importação**, nunca criam duplicata"; Proprietário = o Membro indicado, padrão o ator (documento 10, 12.1). O **Modo de criação** dos Contatos criados é `importação`, imutável (documento 10, 6). Nenhuma linha cria duplicata de Identificador (RN-CON-11). A importação conta para o **Limite imposto de Contatos**, verificado no ato: atingido o limite, a importação para com o balanço parcial e o evento "Limite atingido" (RN-CON-20, RN-ET-23). Confirmar desabilitado até a escolha de colisão estar feita.

## D13 · Converter Item de Checklist em Subtarefa — `?converter-item=`
**Exibe.** Item; Tarefa pai da Subtarefa (padrão: a Tarefa do Checklist; alternativas: o pai dessa Tarefa, ou nenhum, na mesma Lista); aviso de que Subitens migram como Checklist da nova Subtarefa e de que o Item fica `convertido`, terminal e fora do progresso.
**Regra.** Ato único, **sem conversão inversa**; **rejeitado antes de qualquer efeito** se resultar em nível além da Profundidade máxima (B48, RN-CHK-10).
