# MAPA DE NAVEGAÇÃO

Fase 2 — Mapa / Manual de UX · Versão 1.0 · 2026-09-10
Fonte de verdade: `ontologia/` v1.0 (21 documentos APROVADO CONCEITUALMENTE) + `PRD-FRONTEND-NAVEGAVEL.md` Parte I.

Este documento fixa a casca da aplicação e o mapa de rotas completo. Cada rota aponta o documento da ontologia que a rege. Nenhuma rota introduz conceito fora da ontologia; o que a interface precisou resolver sem base conceitual está em `docs/PENDENCIAS-FRONTEND.md`.

---

## 1. Princípios de navegação que decorrem da ontologia

Cinco regras estruturais determinam a forma da navegação. Nenhuma é escolha estética.

**1.1 Contenção é navegação; associação é conteúdo do registro.** A árvore lateral reproduz a cadeia de contenção aprovada (A2.1, A3.1): Espaço → Pasta → Subpasta → Lista. Tudo o que é associação — Vínculos, Menções, Referências de Conhecimento, âncoras — aparece **dentro** do registro, na seção "Vínculos" ou equivalente, nunca como nó da árvore (A2.2, A8). Consequência de interface: não existe "pasta de Contatos", nem "Negócios dentro de uma Lista", nem "Painel dentro de uma Pasta" na árvore.

**1.2 CRM, IA e Painéis são domínios pares da Estrutura de Trabalho** (A2.2). Aparecem na navegação lateral no mesmo nível hierárquico que ESTRUTURA, nunca aninhados nela.

**1.3 O Espaço de Trabalho é o limite absoluto.** Não existe navegação entre Espaços de Trabalho (A1.2). O seletor da barra superior troca de contexto inteiro; nenhuma tela agrega dados de dois Espaços de Trabalho (RN-PAI-21).

**1.4 Painel de contexto aparece na navegação do registro âncora.** Um Painel com Âncora em Espaço, Pasta, Subpasta, Lista, Funil ou Fila é acessível a partir da tela desse registro (B102, 7.8 do documento 21) — mas **não é contido por ele**: a Âncora não transmite permissão nem estado, e o Painel continua listado em `/paineis`. Interface: aba "Painéis" nessas seis telas, listando os Painéis de contexto que o visualizador vê; o Painel abre na sua própria rota.

**1.5 Privacidade é monotônica para baixo e a árvore respeita isso.** Um contêiner privado só aparece na árvore para quem tem concessão direta ou compartilhamento (B38a). Um descendente compartilhado com quem não vê os ancestrais exibe **apenas os nomes do caminho ancestral**, para navegação, e nada mais (B38e, RN-ESP-15): a árvore mostra "Comercial › Clientes › Lista X" com os dois primeiros nós inertes (sem expansão, sem contagem, sem menu).

---

## 2. Casca da aplicação

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ BARRA GLOBAL (40 px, sobre a coluna da tela — features/shell/barra-global)   │
│                  [🔎 Buscar (/)]              [☑ Minhas Tarefas ·n] [🔔 n] [👤] │
│                                                                              │
│  · Busca global: pílula ao centro, atalho "/", vai para /buscar (respeita    │
│    permissões).                                                              │
│  · Minhas Tarefas: contagem das vencidas atribuídas ao Membro (em erro);     │
│    rota /estrutura/tarefas, sem parâmetro. O atalho ?recorte=vencidas        │
│    continua válido, mas ficou sem chamador quando a porta do Início          │
│    saiu (2026-09-21).                                                        │
│    O rótulo fica na árvore acessível em toda largura (sr-only abaixo de      │
│    lg) e os números só entram depois da hidratação, nunca no HTML do         │
│    servidor.                                                                 │
│  · Notificações: o sino, com o mesmo total da tela /notificacoes (T51) —     │
│    um derive só, `notificacoesDoMembro`, filtrado pelo Membro. Não são        │
│    entidade da ontologia (documento 19, 7.4) — ver PENDENCIAS-FRONTEND, A1.  │
│  · Avatar: Membro logado; "Minha conta", "Trocar de Membro" (sessão          │
│    simulada), "Sair". O Papel e a Disponibilidade vivem em /minha-conta.     │
│  · A marca fica no trilho e o Espaço de Trabalho no painel: a barra é só o   │
│    que é da pessoa.                                                          │
├──────────────────┬───────────────────────────────────────────────────────────┤
│ NAVEGAÇÃO        │ CONTEÚDO DA ROTA                                          │
│ LATERAL          │                                                           │
│                  │ ┌───────────────────────────────────────────────────────┐ │
│ TRABALHO         │ │ CABEÇALHO DO REGISTRO                                  │ │
│  Início          │ │ Caminho efetivo · Nome · Selo de estado ·             │ │
│  Notificações ·n │ │ Criador/Proprietário · [ações] [⋯]                    │ │
│  Visão geral     │ ├───────────────────────────────────────────────────────┤ │
│  Minhas Tarefas  │ │ ABAS ou VISUALIZAÇÕES                                  │ │
│ ESPAÇOS          │ ├───────────────────────────────────────────────────────┤ │
│  ▸ Comercial     │ │ CONTEÚDO                                               │ │
│    ▸ Clientes    │ │                                                        │ │
│      • Ativação  │ └───────────────────────────────────────────────────────┘ │
│  ▸ Marketing 🔒  │                                                           │
│                  │                                                           │
│ CRM              │                                                           │
│  Contatos        │                                                           │
│  Empresas        │                                                           │
│  Negócios        │                                                           │
│  Funis           │                                                           │
│  Caixa de Entrada│                                                           │
│                  │                                                           │
│ IA               │                                                           │
│  Chat            │  (as Sessões do Membro, abaixo do item)                   │
│  Personalizar    │  (o hub: Agentes · Habilidades · Automação ·              │
│                  │   Conhecimento · Integrações · Plugins)                   │
│                  │                                                           │
│ FERRAMENTAS      │  (assunto próprio do trilho, abaixo de IA)                │
│  Grupos          │                                                           │
│  Comunidades     │                                                           │
│  Flows           │                                                           │
│                  │                                                           │
│ ◈ Painéis        │                                                           │
│ ⚙ Configurações  │                                                           │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

### 2.1 Regras da navegação lateral

| Elemento | Regra ontológica |
| --- | --- |
| Árvore da ESTRUTURA | Reproduz exatamente Espaço → Pasta → Subpasta → Lista (A3.1). **Tarefas nunca aparecem na árvore**: são conteúdo da Lista (A3.2). Subpasta não expande para Subpasta (A3.4). |
| Ícone de cadeado 🔒 | Contêiner privado (B38). Visível apenas a quem tem acesso; para os demais o nó não existe. |
| Nó inerte (cinza, sem expansão) | Nome de ancestral exposto só para navegação a um descendente compartilhado (B38e; RN-ESP-15, RN-SUB-09). |
| Contêiner `arquivado` | Oculto por padrão; alternador "Mostrar arquivados" no topo da árvore. Exibido com selo `arquivado` e ações de leitura apenas (RN-ESP-11). |
| Contêiner `na lixeira` | Nunca aparece na árvore. Só em `/configuracoes/lixeira`. |
| Ordem dos nós | Atributo Ordem de cada nível (DO-ESP-14, RN-PAS-05); arrastar reordena e exige `editar` no pai (`administrar` para Espaços — B46). |
| Aprovações (contador) | Solicitações de Aprovação `pendente` em que o Membro logado é aprovador designado ou pode decidir (B80). Desde 2026-09-17 a contagem vive no sino da barra global (`notificacoesDoMembro().aprovacoes` entra no total) e `/ia/aprovacoes` se alcança pelas Notificações; o painel de IA tem só Chat e Personalizar. |
| Personalizar (IA) | O hub `/ia/personalizar/[secao]` com seis seções — `agente`, `habilidades`, `automacao`, `conhecimento`, `conectores` (rótulo **Integrações**), `plugins` (o Catálogo de Ferramentas) —, cada uma **o inventário** da entidade (uma lista por entidade). As listas antigas redirecionam para cá; as fichas ficam nas rotas de sempre (§3.4). |
| Lista conversacional (ícone de balão) | A Lista cujo Modelo de Tarefa é `conversacional` (C35): cada Tarefa nasce de um Contato. O "+" da árvore abre D17, não o compositor por título. |
| Domínios CRM / IA / Ferramentas / Painéis | Pares da Estrutura (A2.2); nunca aninhados sob Espaço, Pasta, Lista ou Tarefa. Ferramentas (Ativos de Canal, docs 23–25) é o quarto assunto do trilho, abaixo de IA. |

### 2.2 O que a casca não faz

- Não exibe "Caixa de Entrada" dentro de um Espaço: a Caixa é única por Espaço de Trabalho (B11).
- Não exibe Conhecimento sob CRM: Conhecimento é IA (A2.3).
- Não cria nó de árvore para Funil, Fila, Canal, Coleção ou Agente: nenhum deles contém a Estrutura de Trabalho.
- Não exibe contagens de registros que o visualizador não vê (B103 aplicado por analogia à navegação; RN-PAI-29).

---

## 3. Mapa de rotas

Legenda de "Doc.": número do documento da ontologia (README do `ontologia/`). "Ações" lista o que a tela permite fazer, não o que ela exibe.

### 3.1 Sessão e início

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/login` | Login — usuário e senha (fictício, sem backend; alcançado por "Sair" no menu da conta) | Marca; formulário | Entrar (qualquer usuário e senha → Início); ir a Trocar de Membro | 01 |
| `/entrar` | Entrar — escolher Membro para simular a sessão | Membro (nome, Papel, estado), Espaço de Trabalho | Escolher Membro; entrar | 01 |
| `/` | Início — apresentação: **desde 2026-09-23, palco preto só com o robô 3D do Spline, centralizado e de perto** (decoração `aria-hidden`; saíram a marca 3D, o campo vivo, a saudação e o campo da pergunta; o holofote que segue o mouse voltou no fim do dia, ATRÁS do robô). Histórico: um palco sem rolagem, com a saudação e o campo da pergunta ao Assistente (abre Sessão de Chat). As quatro portas com contagem saíram em 2026-09-21, para o menu lateral e a barra global; no fim do mesmo dia o palco foi refeito do zero e o **Explorar** saiu junto com a esfera, o anel e os trilhos — o fundo agora é o campo vivo — ondas de traços desde 2026-09-22, pontos até então —, decoração pura (`aria-hidden`, sem clique), e sobre ele a marca em 3D flutuando e virando para o cursor (`aria-hidden` também) | Nada desde 2026-09-23 (antes, o primeiro nome do Membro e a hora do Espaço de Trabalho) | A logo do peito abre a caixa do assistente — digitar a pergunta e Enter, ou falar pelo botão do microfone — e o botão de voz grande, no centro à esquerda do palco, inicia o bate-papo por voz sem a caixa (ondas em volta do ícone reagem ao som captado; sem microfone, a conversa segue simulada — uma fala simulada pergunta e o robô responde — até tocar de novo); o robô responde com o que o app já sabe (tarefas, notificações, negócios, contatos, conversas) pela voz e, com Silenciar ou Legenda, em texto num balão ao lado da cabeça (as respostas ficam na aba); nada sai do navegador — desde o fim de 2026-09-23 (antes, Perguntar); a tela não tem link nenhum | 06, 12, 14, 16 |
| `/minha-conta` | Minha conta | Membro (Nome de exibição no Espaço de Trabalho, Papel, Equipes, Disponibilidade de atendimento), Memória do Usuário → Item de Memória | Editar nome de exibição; alterar Disponibilidade; habilitar/desabilitar Memória do Usuário; remover Item de Memória | 01 (7.1), 16 (7.5) |
| `/buscar?q=` | Busca global — o campo recebe o foco ao chegar pelo "/" da barra global (sem `q`, inclusive ao clicar na pílula estando em `/buscar?q=`); chegando com `?q=` não rouba o foco | Tarefa, Contato, Empresa, Negócio, Conversa, Documento de Conhecimento, Espaço, Pasta, Subpasta, Lista, Agente, Habilidade, Automação, Coleção, Painel, Funil | Filtrar por tipo; abrir registro | transversal |

### 3.2 Estrutura de Trabalho

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/estrutura` | Espaços | Espaço | Criar Espaço (Papel ou `criar` no ET — RN-ESP-18); reordenar; arquivar; excluir | 02 |
| `/estrutura/espacos/[espaco]` | Espaço | Espaço, Pasta, Lista (diretas), Painel de contexto | Criar Pasta/Lista; renomear; tornar privado; arquivar; enviar à lixeira; instanciar Template | 02 |
| `/estrutura/espacos/[espaco]/configuracoes` | Configurações do Espaço | Conjunto de Status → Definição de Status, Definição de Campo Personalizado, Tipo de Tarefa, Funcionalidades habilitadas, Visualizações padrão, Bloqueio por aspecto, concessões | Definir/editar Conjunto de Status (com Mapeamento de status); criar Definição de Campo; bloquear aspecto; conceder permissão | 02 |
| `/estrutura/pastas/[pasta]` | Pasta ou Subpasta (mesma tela) | Pasta, Subpasta, Lista, Painel de contexto | Criar Subpasta (só se Nível 1 — A3.4); criar Lista; mover; promover/rebaixar; privar; arquivar; excluir | 03, 04 |
| `/estrutura/pastas/[pasta]/configuracoes` | Configurações da Pasta/Subpasta | Modo por aspecto (`herdado`/`sobrescrito`/`bloqueado`), Conjunto de Status sobrescrito, Definições de Campo próprias, Tipos de Tarefa próprios, concessões | Sobrescrever/voltar a herdar (com Mapeamento); bloquear; conceder | 03, 04 |
| `/estrutura/listas/[lista]` | Lista — a lente segue o **Modelo de Tarefa** (C35): `operacional` (compositor por título) ou `conversacional` (cada Tarefa nasce de um Contato: barra [Nova Tarefa] → D17, `?nova-tarefa=1`, colunas Contato e Canal na Tabela, cartão com rosto no Quadro, só quatro Visualizações); precedência financeira > espelho comercial > conversacional | Lista (Modelo de Tarefa), Tarefa (Visualizações Lista, Quadro, Calendário, Tabela; + Linha do tempo e Carga na operacional), Contato/Canal/Negócio por Vínculo, Painel de contexto | Criar Tarefa (operacional: pelo título; conversacional: D17); mudar Visualização; filtrar; agrupar; mover Tarefa (uma Lista conversacional só recebe Tarefa com Contato vinculado); arquivar | 05, 06 |
| `/estrutura/listas/[lista]/configuracoes` | Configurações da Lista | Conjunto de Status efetivo, Definições de Campo efetivas, Tipos de Tarefa efetivos, Funcionalidades efetivas, Período planejado, Visualizações da Lista, Automações aplicáveis, concessões, **Modelo de Tarefa** (atributo nativo, não herdado) | Sobrescrever aspecto; definir Período planejado; salvar Visualização; privar; **alterar o Modelo de Tarefa** (Toggle "Tarefas conversacionais" — só enquanto a Lista não tem Tarefa, contando a lixeira) | 05 |
| `/estrutura/tarefas` | Minhas Tarefas (T12a) — recortes em abas com contador: Atribuídas a mim · Vencidas · Hoje (com hora, no dia civil do fuso do Espaço de Trabalho) · Esta semana (até hoje + 7 dias) · Todas do Espaço de Trabalho; `?recorte=` (minhas, vencidas, hoje, semana, todas) abre na aba — sem chamador desde 2026-09-21: a porta do Início saiu, e o menu lateral e a barra global vão à rota sem parâmetro | Tarefa (ativas), Lista, Status, Categoria, Prioridade, Vencimento | Trocar de recorte; abrir a Tarefa | 06 |
| `/estrutura/tarefas/[tarefa]` | Tarefa (painel lateral com opção de página cheia). Numa Lista conversacional, a **ficha conversacional**: ficha · conversa · Atividade, com a seção CRM | Tarefa, Subtarefa, Checklist → Item → Subitem, Comentário, Registro de Tempo, Valor de Campo, Anexo, Dependência, Vínculo, Observador, Tag, Regra de Recorrência, Compartilhamento público, Registro de Atividade; na conversacional, Contato, Conversa (o fio, respondível), Canal, Empresa e Negócio por Vínculo | Alterar Status; atribuir Responsável (Membro ou Agente); criar Subtarefa; criar/converter Item de Checklist; registrar tempo; comentar; vincular; mover (com Mapeamento de status); arquivar; excluir; na conversacional: responder no fio, trocar o Canal, vincular/desvincular Negócio, **Abrir na Caixa de Entrada**, **Criar Negócio a partir desta Tarefa** | 06, 07, 08 |

Uma Subtarefa abre na mesma rota de Tarefa: Subtarefa não é entidade distinta (B1, RN-STA-01).

### 3.3 CRM

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/crm/contatos` | Contatos | Contato (tabela), Suspeita de Duplicidade | Criar Contato; filtrar; importar; abrir mesclagem | 10 |
| `/crm/contatos/[contato]` | Ficha do Contato | Contato, Identificador de Contato, Consentimento, Endereço, Vínculo Contato-Empresa, Vínculo Contato-Negócio, Vínculo Contato-Tarefa, Vínculo `distinto de`, Valor de Campo, Tag, Comentário, Estado pré-mesclagem, linha do tempo | Editar; acrescentar/transferir Identificador; registrar Consentimento; vincular Empresa/Negócio; mesclar; marcar `distinto de`; arquivar; excluir; restaurar cópia (se `mesclado`); **Nova Tarefa conversacional** (painel Tarefas → D17 com o Contato fixo) | 10 |
| `/crm/empresas` | Empresas | Empresa (tabela), Sugestão de Vínculo | Criar Empresa; filtrar; aceitar/descartar Sugestão de Vínculo | 11 |
| `/crm/empresas/[empresa]` | Ficha da Empresa | Empresa, Identificador de Empresa, Endereço, Empresa matriz/filiais/raiz do grupo, Vínculo Empresa-Empresa, Vínculo Contato-Empresa, Negócio, Conversas derivadas (só leitura), Valor de Campo, Tag, Comentário, Anexo | Editar; definir matriz; vincular Empresa; vincular Contato com papel; mesclar; arquivar; excluir | 11 |
| `/crm/negocios` | Negócios | Negócio (Quadro por Etapa, Tabela), Funil, Etapa | Trocar Funil; arrastar entre Etapas (com Requisitos); criar Negócio; abas Abertos / Ganhos / Perdidos | 12, 13 |
| `/crm/negocios/[negocio]` | Ficha do Negócio | Negócio, Funil, Etapa, Empresa, Vínculo Contato-Negócio, Valor, Probabilidade, Motivo de Perda/Ganho, Nota de encerramento, Valor de Campo, Tag, Comentário, Anexo, Vínculo Conversa-Negócio, Vínculo Tarefa-Negócio, histórico de transições | Mover de Etapa; marcar `ganho`/`perdido`; reabrir; mover de Funil; vincular Contato com papel; transferir propriedade; arquivar; excluir | 12 |
| `/crm/funis` | Funis | Funil | Criar Funil (Papel Administrador); definir Funil padrão; copiar; arquivar; excluir | 13 |
| `/crm/funis/[funil]` | Funil | Funil, Etapa, Requisito de Etapa, Transições permitidas, Regras de encerramento, Painel de contexto | Criar/reordenar/remover Etapa (com Remapeamento); definir Requisitos; definir Transições; definir Regras de encerramento; privar | 13 |
| `/crm/caixa-de-entrada` | Caixa de Entrada (três colunas) | Fila, Canal, Conversa, Mensagem, Participante, Anexo, Rascunho, Adiamento, Contato principal, Empresa (derivada), Vínculo Conversa-Negócio | Filtrar; auto-atribuir; atribuir a Membro ou Agente; transferir de Fila; responder; nota interna; adiar; resolver; reabrir; criar Tarefa/Negócio a partir da Conversa | 14 |
| `/crm/caixa-de-entrada/[conversa]` | Conversa (coluna 3 em foco; permalink) | idem acima; no painel do Contato, as Tarefas conversacionais dele (`TarefasDoContato`) | idem; **Criar Tarefa a partir da Conversa** (D17 com Contato e Canal fixos); a aba "Tarefa" do compositor cria pelo modelo da Lista escolhida | 14 |
| `/crm/caixa-de-entrada/configuracoes` | Configurações da Caixa | Caixa de Entrada (Prazo de reabertura, Distribuição padrão, Proprietário padrão de Contatos, Horário de atendimento), Canal, Fila | Editar configurações; conectar/arquivar Canal; criar/editar Fila; definir elegíveis e Regra de distribuição | 14 |
| `/crm/caixa-de-entrada/configuracoes/canais/[canal]` | Canal | Canal, Capacidades do Tipo de Canal, Configuração de mensagens de modelo → Mensagem de modelo, Fila padrão, Origem padrão | Reconectar; definir Fila padrão; sincronizar modelos; habilitar grupos; arquivar | 14 |
| `/crm/caixa-de-entrada/configuracoes/filas/[fila]` | Fila | Fila, Elegíveis (Membro, Equipe), Regra de distribuição, Limite de Conversas por Atendente, Horário de atendimento, Painel de contexto | Editar elegíveis; mudar Regra de distribuição; arquivar (com transferência das não resolvidas); excluir | 14 |

### 3.3a Ferramentas (assunto próprio do trilho, abaixo de IA; docs 23–25)

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/ferramentas/grupos` · `/ferramentas/comunidades` · `/ferramentas/flows` (`/ferramentas` abre em Grupos) | Ferramentas — assunto do trilho abaixo de IA, uma tela por gerenciador (popups `?grupo=` `?comunidade=` `?flow=`, criação `?criar=`) | Grupo, Participação, Pedido de Entrada, Link de Captação, Clique, Comunidade, Grupo de avisos, Flow, Versão de Flow | Criar Grupo; importar do Canal; sincronizar; editar Configurações (externa); Captação; adicionar/remover/promover Participante; aprovar/recusar Pedido; regenerar Link de convite; sair do Grupo; enviar Mensagem ao Grupo; criar/editar Link de Captação, simular clique e entrada; criar Comunidade; vincular/desvincular Grupo; enviar à Comunidade; sair da Comunidade; criar Flow; enviar Flow a um Contato; despublicar; copiar; arquivar/lixeira | 23, 24, 25 |
| `/ferramentas/grupos/[grupo]` · `/ferramentas/comunidades/[comunidade]` | Grupo / Comunidade em página cheia | idem popup | idem | 24, 25 |
| `/ferramentas/flows/[flow]` | Construtor de Flow (três colunas; `?tela=`) | Flow, Versão (rascunho/publicada/obsoleta), Tela, Dados de Tela, Componente (catálogo 7.4), Ação, Condição, Validação 7.5, Definição publicável | Adicionar/renomear/reordenar/duplicar/remover Tela; adicionar/editar/mover/duplicar/remover Componente; Dados de Tela; validar; publicar (DO-FLW-03); descartar rascunho; criar rascunho a partir de Versão; pré-visualizar | 23 |

### 3.4 IA

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/ia/chat` | Chat — minhas Sessões | Sessão de Chat | Criar Sessão (com Âncora opcional); arquivar; excluir | 16 |
| `/ia/chat/[sessao]` | Sessão de Chat | Sessão de Chat, Mensagem de Chat, Âncora, Agente principal, Modelo efetivo, Restrição de Ferramentas, Arquivo, Referência de Conhecimento, Solicitação de Aprovação | Enviar Mensagem; trocar Agente principal; trocar Modelo; restringir Ferramentas; regenerar; decidir Aprovação inline; compartilhar; arquivar | 16 |
| `/ia/personalizar/[secao]` | **Personalizar — o hub** (2026-09-17). Seis seções, cada uma o inventário da entidade (`CatalogGrid`: busca, cartões com fatos, condições, ação e menu): `agente` **Agentes** — [Novo Agente] → o Construtor · `habilidades` **Habilidades** — [Nova Habilidade] (D18) [Copiar da plataforma] (D19) · `automacao` **Automação** — [Nova Automação] (D30) · `conhecimento` **Conhecimento** — [Nova Coleção] (D24) · `conectores` **Integrações** — Conectar / Desconectar (D32) por cartão · `plugins` **Plugins** — o Catálogo de Ferramentas, "Dar a um Agente" (D21) por cartão | Agente, Habilidade, Automação, Coleção, Integração, Ferramenta (com as derivações Disponibilidade, Efeito declarado, Inoperante, "executa no protótipo") | Por menu do cartão: Agente — Abrir no Construtor · Ativar/Pausar · Ensaiar · Arquivar/Desarquivar; Habilidade — Criar rascunho · Publicar rascunho · Conceder (D20) · Arquivar/Restaurar; Automação — Abrir editor · Pausar/Retomar/Restaurar · Duplicar · Arquivar; Coleção — Adicionar Documento (D25) · Dar acesso a um Agente (D27) · Arquivar/Restaurar; Integração — Conectar/Reconectar · Desconectar (D32) | 17–20 |
| `/ia/agentes/lista` · `/ia/habilidades` · `/ia/automacoes` · `/ia/conhecimento` | **Redirecionam** (server components) para `/ia/personalizar/agente`, `/habilidades`, `/automacao` e `/conhecimento`: uma lista por entidade | — | — | 17–20 |
| `/ia/agentes` | **Construtor de Agentes** (`?editar=<id>` abre um existente com a última Versão carregada) | Agente (rascunho do Construtor), Versão de Agente, Modelo, Ferramentas permitidas, quebra-gelos, Conhecimento declarado, pontos de acesso | Agente novo: [Salvar rascunho] (nasce `rascunho`) ou [Publicar e ativar] (RN-AGE-07 no ato); existente: [Publicar versão N] (o estado muda na ficha — D1) | 17 |
| `/ia/agentes/[agente]` | Agente — a ficha (`AgenteCompleto`): painéis Habilidades concedidas · Ferramentas permitidas · Conhecimento acessível · Execuções · Memória; aside Configuração · Versões · Configuração do Construtor; `?ensaiar=1` abre D22 | Agente, Versão de Agente, Concessão de Habilidade (Disponibilidade), Conhecimento acessível (derivado das Concessões da Coleção), Ferramentas permitidas (classe de efeito, inoperante), Papel, Política de aprovação, Memória do Agente → Item de Memória, Execução de Agente (ensaio) | Ativar; pausar; ensaiar (D22); editar no Construtor; conceder (D20) / fixar versão / revogar Habilidade; permitir (D21) / retirar Ferramenta; dar acesso a Coleção (D27) / revogar; cancelar Execução; apagar Item de Memória; transferir propriedade (D23); arquivar/desarquivar; enviar à lixeira/restaurar. Pendentes: atribuir Papel, instanciar Template (P17) | 17 |
| `/ia/habilidades/[habilidade]` | Habilidade — a ficha (`HabilidadeCompleta`): propriedades, o rascunho editável (`RascunhoDaHabilidade` + `ContratoEditor`), a corrente em leitura, a tabela de Versões; aside Validação viva e Agentes com Concessão | Habilidade, Versão de Habilidade, Contrato de entrada/saída, Requisitos de Ferramenta, Dependências, Coleções recomendadas, Efeito declarado, Concessão de Habilidade (Disponibilidade) | Editar Nome/Descrição; criar rascunho a partir de uma Versão; gravar rascunho; descartar rascunho; publicar (D31); obsoletar; conceder a Agente (D20); fixar versão / seguir a corrente / revogar; copiar da plataforma (D19); arquivar/restaurar | 18 |
| `/ia/automacoes/[automacao]` | Automação — o editor (`EditorDeAutomacao`): abas Editor (três colunas Gatilho · Condições · Ações, `?bloco=&indice=`; Validação, Política de erro, Atributos) · Execuções · Versões | Automação, Versão de Automação, Gatilho (Evento do catálogo com família e escopo, Regra de Agendamento, manual, condição temporal), Condição (atributo, Valor de Campo, pertencimento, temporal, híbrida), Ação de escrita (Ferramenta do Catálogo), Ação de controle, Política de erro, Autonomia máxima imposta, Execução de Automação → Passo, marca "executa no protótipo" | Definir Gatilho; adicionar/editar/remover Condição; adicionar/editar/mover/remover Ação; Política de erro; editar Nome/Descrição/"Reage a Eventos de Automações"; criar/descartar rascunho; publicar (D31); pausar/retomar; duplicar; arquivar/restaurar; enviar à lixeira. Pendentes: acionar manualmente e ramificar (P15); transferir propriedade | 19 |
| `/ia/conhecimento/[colecao]` | Coleção — a ficha (`ColecaoCompleta`; abas Documentos · Fontes · Acesso · Retenção) | Coleção, Fonte (Envio manual implícita, URL, Integração), Documento de Conhecimento, Política de atualização, Política de retenção de versões, concessões a Agentes | Adicionar Documento (D25); Nova Fonte (D26); dar acesso a Agente (D27) / revogar; tornar privada/pública; por Documento: Nova Versão (D28), Mover (D29), arquivar/restaurar; arquivar/restaurar a Coleção. Pendente: atualizar Fonte (P16) | 20 |
| `/ia/conhecimento/documentos/[documento]` | Documento de Conhecimento — a ficha (`DocumentoCompleto`) | Documento, Versão de Documento, Conteúdo, Representação derivada, Fragmentos, Metadado (rótulos, resumo), Proveniência, Estado de processamento, Comentário | Editar Título e Metadado (sem Versão); Nova Versão (D28); restaurar Versão; mover de Coleção (D29); comentar; arquivar/restaurar; enviar à lixeira | 20 |
| `/ia/aprovacoes` | Solicitações de Aprovação | Solicitação de Aprovação, Execução (de Agente ou de Automação), objeto fixo (Ferramenta + entrada), classe de efeito, prazo, aprovador | Aprovar; recusar (com motivo); abrir Execução | 17, 19 |

### 3.5 Painéis

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/paineis` | Painéis | Painel (Âncora, Condição de integridade) | Criar Painel; copiar; arquivar; excluir | 21 |
| `/paineis/[painel]` | Painel | Painel, Widget, Fonte de Dados, Métrica, Dimensão, Filtro fixo, Período, Leiaute, Âncora de Painel, Momento de referência dos dados | Criar/editar Widget; reordenar Leiaute; aplicar Filtro interativo; definir Âncora; compartilhar; exportar (registrado); arquivar | 21 |

### 3.6 Configurações

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/configuracoes` | Configurações — visão geral | Espaço de Trabalho (Nome, Estado, Localidade, Política de lixeira, Profundidade máxima de Subtarefas, Identificador legível de Tarefas e de Negócios, Funil padrão, Assistente padrão, Template de Espaço padrão, Limites impostos, Suspensões vigentes) | Editar configurações globais; transferir propriedade; suspender; encerrar | 01 |
| `/configuracoes/membros` | Membros | Membro (estado, Papel, Equipes, Disponibilidade, Sucessor) | Convidar; reenviar convite; revogar convite; atribuir Papel; suspender; remover (com Sucessor) | 01 |
| `/configuracoes/membros/[membro]` | Membro | Membro, Papel, Equipes, propriedades (registros de que é Proprietário), responsabilidades, Registros de Atividade | Atribuir Papel; suspender; remover com Sucessor; ver o que será transferido | 01 |
| `/configuracoes/equipes` | Equipes | Equipe, Membro | Criar/editar/excluir Equipe; incluir Membros `ativo`/`suspenso` | 01 |
| `/configuracoes/papeis` | Papéis | Papel de sistema, Papel personalizado (base), Permissão | Criar Papel personalizado com base; editar permissões dentro do teto | 01 |
| `/configuracoes/tags` | Tags | Tag (restrição de tipo) | Criar/editar/excluir Tag | 01 |
| `/configuracoes/campos` | Campos do CRM | Definição de Campo Personalizado (entidade-alvo Contato, Empresa, Negócio, Conversa), Tipo de Campo | Criar/editar/arquivar Definição | 01 |
| `/configuracoes/catalogos` | Catálogos | Origem, Definição de Qualificação, Finalidade de Consentimento, Motivo de Perda, Motivo de Ganho | Criar/editar/arquivar item; substituir referências | 01 |
| `/configuracoes/templates` | Templates | Template de Espaço, de Pasta, de Lista, de Tarefa, de Checklist, de Agente | Criar a partir de registro; editar; excluir; definir Template de Espaço padrão | 01, 08 |
| `/configuracoes/integracoes` | Integrações | Integração (estado, Membro configurador), Ferramentas expostas | Conectar; reconectar; desconectar; remover | 01 |
| `/configuracoes/lixeira` | Lixeira | Registros `na lixeira` de todas as entidades que têm o estado, com Estado próprio anterior à exclusão e Previsão de eliminação | Restaurar (ao estado anterior); eliminar antecipadamente | transversal (B43) |
| `/configuracoes/auditoria` | Auditoria | Registro de Atividade (Ator, ação, objeto, momento, resultado, ator delegante) | Filtrar por Ator, tipo de objeto, período; abrir objeto | 01 (A6.2) |

### 3.7 Rotas deliberadamente inexistentes

| Rota que não existe | Por quê |
| --- | --- |
| `/estrutura/pastas/[pasta]/subpastas/nova` dentro de uma Subpasta | Subpasta não contém Subpasta (A3.4). A ação nem é oferecida. |
| `/crm/conversas/nova?empresa=` | Não existe Conversa com Empresa (B53). |
| `/ia/execucoes` (lista global) | Execução é entidade interna do Agente ou da Automação (B18); é listada dentro de cada um e agregada em Painéis. |
| `/paineis/[painel]/publico` | Não existe compartilhamento público de Painel (B104). |
| `/ia/chat/[sessao]` para Sessão de outro Membro | Nenhum Papel dá `ver` sobre Sessão alheia (DO-CHT-09); só compartilhamento explícito. |
| Rota de Coleção como âncora de Sessão | Coleção não é âncora admitida (B83). |
| Rota de Etapa (`/crm/funis/[funil]/etapas/[etapa]`) | Etapa é entidade interna do Funil, sem estado e sem tela própria (13, 7.1). |

---

## 4. Diálogos e sobreposições com rota própria (modal com URL)

Estas operações têm regra ontológica bloqueante e precisam de tela dedicada, não de menu inline. Cada uma é sobreposição sobre a rota de origem, com endereço próprio para permitir voltar.

| Endereço | Diálogo | Regra que o exige |
| --- | --- | --- |
| `?mapear-status=` | Mapeamento de status | RN-LIS-06, RN-ESP-06, B40: toda operação que altera o Conjunto de Status efetivo exige mapeamento explícito de cada Definição em uso. Sem mapeamento completo, a operação é inválida. |
| `?remapear-etapa=` | Remapeamento de Etapa | RN-FUN-10, RN-FUN-12, RN-FUN-13: remover Etapa, arquivar ou excluir Funil exige remapear todo Negócio que a referencia, inclusive `na lixeira`. |
| `?mesclar=` | Mesclar Contatos / Empresas | B14: operação atômica e irreversível; a tela mostra o que migra e o que fica no Estado pré-mesclagem antes de confirmar. |
| `?remover-membro=` | Remover Membro com Sucessor | B28: a sucessão ocorre no mesmo ato; a tela lista o que será transferido (propriedades, aprovações pendentes) e o que será liberado (Responsável, Atribuído). |
| `?transferir-propriedade=` | Transferir propriedade do Espaço de Trabalho | B26: ato único e atômico; o antigo Proprietário passa a Administrador salvo escolha explícita. |
| `?acesso-governanca=` | Ato de governança registrado | B38b: única via de entrada em contêiner, Funil ou Coleção privados sem concessão prévia. Motivo obrigatório; gera Registro de Atividade visível a quem tem acesso ao recurso. |
| `?ganhar=` / `?perder=` | Encerrar Negócio | B59: as Regras de encerramento do Funil pedem valor ao ganhar e Motivo de Perda ao perder, quando ativas. |
| `?migrar-negocios=` | Migrar Negócios de Funil | RN-FUN-12/13: arquivar exige migrar os `aberto`; enviar à lixeira exige migrar todos. |
| `?aprovar=` | Decidir Solicitação de Aprovação | B80: objeto fixo (Ferramenta + entrada completa); aprovar é aprovar exatamente aquilo. |
| `?restaurar-copia=` | Restaurar cópia de Contato/Empresa `mesclado` | B14: única saída da mesclagem; cria registro novo com Proveniência a partir do Estado pré-mesclagem. |
| `?transferir-identificador=` | Transferir Identificador de Contato | DO-CON-12: move só a resolução futura; Conversas e Mensagens passadas permanecem. |
| `?mover-conversa=` | Mover Conversa para outro Contato | RN-CXE-11: rejeitado se o destino já tem Conversa não resolvida no mesmo Canal, salvo resolução no mesmo ato. |
| `?converter-item=` | Converter Item de Checklist em Subtarefa | B48: ato único, unidirecional, rejeitado antes de qualquer efeito se exceder a Profundidade máxima. |
| `?excluir-papel=` | Excluir Papel personalizado | Documento 01, 18: o evento de remoção exige **Papel de destino dos titulares**. Sem destino para cada titular, a operação é inválida — mesmo padrão do Mapeamento de status. |
| `?importar-contatos=` | Importar Contatos em lote | Documento 10, 12.1: linhas cujo Identificador colide são **rejeitadas ou tratadas como atualização, conforme escolha explícita do ator**, nunca criam duplicata (RN-CON-11). Exige progresso e balanço por desfecho. |

Os diálogos a seguir (2026-09-17) são de **criação e concessão**: só D16, D17 e o atalho de D22 têm endereço; os demais abrem por botão ou menu da tela de origem, indicada na primeira coluna. Todos com `confirmDisabledReason` igual à recusa da operação (`INVENTARIO-DE-TELAS.md`, VII).

| Endereço ou origem | Diálogo | Regra que o exige |
| --- | --- | --- |
| `?criar=lista:<tipoDoPai>:<idDoPai>` | D16 · Nova Lista, com o seletor de Modelo de Tarefa | C35: o modelo é atributo nativo da Lista e não muda depois que ela tem Tarefas — decide-se na criação. |
| `?nova-tarefa=1` na Lista conversacional; [Criar Tarefa a partir da Conversa] (T21); [Nova Tarefa conversacional] (T14) | D17 · Nova Tarefa conversacional | C35, RN-TAR-15: a Tarefa raiz de uma Lista conversacional nasce com Contato e Canal (a Conversa), Negócio opcional; `createTask` sem Contato recusa. |
| `/ia/personalizar/habilidades` › [Nova Habilidade] | D18 · Nova Habilidade | 18, 12.1: nasce ativa com a Versão 1 em rascunho; nome único (RN-HAB-02). |
| `/ia/personalizar/habilidades` › [Copiar da plataforma]; ficha (T30) › "Copiar para o Espaço de Trabalho" | D19 · Copiar da plataforma | DO-HAB-07, INV-HAB-07: uma Habilidade da plataforma não é editada — copia-se, com Proveniência e sem Concessões. |
| Menu/ficha da Habilidade › "Conceder a um Agente"; ficha do Agente › [Conceder] | D20 · Conceder Habilidade | RN-HAB-12, RN-HAB-03, RN-HAB-11: a Concessão é a única origem de `executar`; fixar só Versão publicada; o Efeito declarado é mostrado antes; cria Versão de Agente (D8). |
| `/ia/personalizar/plugins` › "Dar a um Agente"; ficha do Agente › [Permitir] | D21 · Permitir Ferramenta | DO-HAB-14, RN-AGE-06: permitir não concede permissão sobre registro; cria a Versão N+1 do Agente; Integração desconectada deixa a Ferramenta permitida e inoperante (7.7). |
| Ficha do Agente › [Ensaiar] ou `?ensaiar=1` | D22 · Ensaiar | B82, DO-AGE-13, RN-AGE-10: Execução real com `rehearsal`, escritas `simulado`, sem Memória — a única Execução que um rascunho admite. |
| Ficha do Agente › "Transferir propriedade…" | D23 · Transferir Agente | RN-AGE-04, B33: destinatário Membro ativo sem base Convidado; o Assistente padrão nunca é transferido. |
| `/ia/personalizar/conhecimento` › [Nova Coleção] | D24 · Nova Coleção | RN-CNH-04, RN-CNH-02: nasce com a Fonte Envio manual no mesmo ato; nome único. |
| Ficha da Coleção › [Adicionar Documento]; menu do cartão | D25 · Adicionar Documento | RN-CNH-06, RN-CNH-09, INV-CNH-03: envio manual com Proveniência obrigatória; texto, URL ou arquivo (≤ 25 MB); Fragmentos simulados (D9). |
| Ficha da Coleção › "Nova Fonte" | D26 · Nova Fonte | RN-CNH-04, 20.6: URL ou Integração por quem administra; Integração desconectada nasce `com erro`. |
| Ficha da Coleção › "Dar acesso a um Agente"; menu do cartão; ficha do Agente › [Conceder] em Conhecimento | D27 · Dar acesso a Agente | DO-CNH-12, 17.3: a Concessão vive na Coleção; `ver` obrigatória. |
| Ficha do Documento › [Nova Versão]; menu do Documento na Coleção | D28 · Nova Versão de Documento | RN-CNH-12, RN-CNH-13: Conteúdo imutável — editar é criar a Versão N+1, que se torna corrente. |
| Ficha do Documento › "Mover para outra Coleção"; menu do Documento na Coleção | D29 · Mover Documento | RN-CNH-08: só Documentos de envio manual; atômica; a permissão passa a ser a do destino. |
| `/ia/personalizar/automacao` › [Nova Automação] | D30 · Nova Automação | RN-AUT-02, RN-AUT-03, RN-AUT-07: escopo fixado na criação e único por nome; o Gatilho inicial só entre os Eventos do escopo. |
| Ficha da Habilidade › [Publicar vM]; editor da Automação › [Publicar vN] | D31 · Publicar Versão | RN-HAB-06 / RN-AUT-07: a validação recusa sem efeito e lista o que falta; B71 (a publicada anterior permanece) / DO-AUT-19 (a vigente passa a obsoleta). |
| D16 (Lista conversacional) e T11 › Canais de atendimento › "Adicionar {tipo}" | D33 · Adicionar Canal | C36, B35, RN-CXE-31, INV-CXE-01: conecta uma conta de WhatsApp, E-mail, Instagram ou LinkedIn no Espaço de Trabalho (nasce conectada no protótipo), com Setor (Fila padrão) e Origem padrão, e a marca na Lista. |
| `/ia/personalizar/conectores` e `/configuracoes/integracoes` › "Desconectar…" | D32 · Desconectar Integração | B35, 18 (7.4), RN-HAB-18, 20.6: ato de Administrador; o diálogo conta o impacto — Ferramentas inoperantes, Concessões indisponíveis, Fontes com erro. |

---

## 5. Correções ao ponto de partida do PRD

A tabela II.6 do PRD foi validada contra a ontologia. Correções e acréscimos:

| Item | Situação | Justificativa ontológica |
| --- | --- | --- |
| `/minha-conta` | **Acrescentado** | A Memória do Usuário é entidade interna do Membro e ele "vê, remove Itens e desativa a qualquer momento" (RN-CHT-21, B86). A Disponibilidade de atendimento é objeto de valor do Membro alterável por ele (DO-CXE-14). Nenhuma rota do PRD as expunha. |
| `/notificacoes` (T51) | **Acrescentada** | O PRD previa o sino na casca (II.5) sem tela. Menções, Solicitações de Aprovação, liberações de responsabilidade e falhas de Automação precisam de superfície com ordenação, filtro e estado vazio. **Não é entidade** (documento 19, 7.4): visão derivada, registrada em `PENDENCIAS-FRONTEND.md` A1. |
| `/crm/caixa-de-entrada/[conversa]` | **Acrescentado** | A Conversa precisa de endereço próprio para ser alvo de Vínculo, Menção, âncora de Sessão e notificação. |
| `/crm/caixa-de-entrada/configuracoes/canais/[canal]` e `/filas/[fila]` | **Acrescentados** | Canal e Fila são entidades com atributos, estados e ciclo de vida próprios (14, 7.2 e 7.4), e a Fila é âncora de Painel (B102) e escopo de Automação (B41). |
| `/configuracoes/templates` | **Separado** | O PRD agrupava Templates em `/configuracoes/...` (II.6). São entidades contidas do catálogo (A8, 7.6 do documento 01) em seis tipos com regras próprias de instanciação, inclusive B47. |
| `/estrutura/espacos/[espaco]/configuracoes` e `/estrutura/pastas/[pasta]/configuracoes` | **Separadas** | O PRD previa "configurações e herança" **dentro** de `/estrutura/espacos/[espaco]` (II.6) e nada para Pasta. Espaço, Pasta e Subpasta são pontos de definição com modo por aspecto (B25) e Mapeamento de status obrigatório; a configuração não cabe na tela de conteúdo. |
| Aba "Painéis" em Espaço, Pasta, Subpasta, Lista, Funil e Fila | **Acrescentada** | B102: o Painel de contexto aparece na navegação do registro âncora. Sem isso, Painéis de contexto ficam inacessíveis a partir do registro (C31 registra que a visibilidade não é herdada — o acesso continua por compartilhamento). |
| Diálogos com endereço próprio (seção 4) | **Acrescentados** | **Quinze** operações da ontologia são bloqueantes e exigem entrada de dados antes de qualquer efeito. Tratá-las como menu inline produziria ação impedida sem caminho de saída. |
| `/ia/chat/[sessao]` de terceiro | **Restringido** | DO-CHT-09: nenhum Papel dá acesso; só compartilhamento. A rota existe, mas responde "sem acesso" ao não compartilhado. |

---

## 6. Estados na navegação

O que a casca precisa distinguir, e nunca no mesmo controle (regra I.1 do PRD):

| Eixo | Onde aparece | Valores |
| --- | --- | --- |
| Estado de ciclo de vida | Selo no cabeçalho do registro; filtro "Mostrar arquivados" | `ativo` (sem selo), `arquivado`, `na lixeira` |
| Estado de ciclo de vida — exceções | Cabeçalho da entidade correspondente | Espaço de Trabalho: `ativo`, `suspenso`, `encerrado`. Membro: `pendente`, `ativo`, `suspenso`, `removido`. Contato/Empresa: + `mesclado`. Canal: sem `na lixeira`. Conversa: sem `arquivado`. Agente/Automação: + `rascunho`, `pausado` |
| Status de Tarefa | Seletor de Status na Tarefa e colunas do Quadro | Definições do Conjunto de Status efetivo, agrupadas por categoria (`não iniciado`, `em andamento`, `concluído`, `fechado`) |
| Situação do Negócio | Abas do Quadro e selo na ficha | `aberto`, `ganho`, `perdido` |
| Etapa de Funil | Colunas do Quadro de Negócios | Etapas do Funil, por Ordem |
| Estado de conversa | Filtros e selo da Conversa | `aberta`, `pendente`, `resolvida` |
| Estado de Execução | Lista de Execuções | `pendente`, `executando`, `aguardando aprovação`, `concluída`, `falhou`, `cancelada` |
| Estado de Versão | Habilidade e Automação | `rascunho`, `publicada`, `obsoleta` |
| Estado de processamento | Documento de Conhecimento | `pendente`, `processado`, `com erro` |
| Estado de conexão | Canal e Integração | `conectada`, `desconectada`, `com erro` |
| Status de entrega | Mensagem `enviada` | `pendente`, `enviada`, `entregue`, `lida`, `falhou` |
| Condições derivadas | Marcadores discretos, nunca selos de estado | Vencida, Bloqueada, Não identificado, Desatualizado, Inoperante, Disponibilidade, Widget inválido, Agente principal indisponível |

Regra de interface: **selo de estado e marcador de condição derivada têm formas visuais distintas.** Um selo diz o que o registro é; um marcador diz o que ele está no momento e desaparece sozinho quando a causa cessa.
