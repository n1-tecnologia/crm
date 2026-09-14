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
│ BARRA SUPERIOR                                                               │
│ [Espaço de Trabalho ▾] [🔎 Buscar (/)]  ·······  [🔔] [Disponibilidade ▾] [👤]│
│                                                                              │
│  · Seletor do Espaço de Trabalho: troca de contexto inteiro (A1.2).          │
│    Exibe estado quando não é `ativo` (`suspenso`, `encerrado`) — A4.1.       │
│  · Busca global: atalho "/", vai para /buscar?q= (respeita permissões).      │
│  · Notificações: derivadas de Eventos e Registros de Atividade; não são      │
│    entidade da ontologia (documento 19, 7.4). Painel do sino + rota          │
│    /notificacoes (T51) — ver PENDENCIAS-FRONTEND, A1.                        │
│  · Disponibilidade de atendimento: `disponível` / `ausente` / `indisponível` │
│    do Membro logado (DO-CXE-14). Só aparece se a Caixa tem Filas com este    │
│    Membro elegível. Membro `suspenso` deriva `indisponível` e o controle é   │
│    somente leitura.                                                          │
│  · Avatar: Membro logado + Papel; "Trocar de Membro" (sessão simulada),      │
│    "Minha conta", "Sair".                                                    │
├──────────────────┬───────────────────────────────────────────────────────────┤
│ NAVEGAÇÃO        │ CONTEÚDO DA ROTA                                          │
│ LATERAL          │                                                           │
│                  │ ┌───────────────────────────────────────────────────────┐ │
│ ◈ Início         │ │ CABEÇALHO DO REGISTRO                                  │ │
│                  │ │ Caminho efetivo · Nome · Selo de estado ·             │ │
│ ESTRUTURA        │ │ Criador/Proprietário · [ações] [⋯]                    │ │
│  ▸ Comercial     │ ├───────────────────────────────────────────────────────┤ │
│    ▸ Clientes    │ │ ABAS ou VISUALIZAÇÕES                                  │ │
│      • Ativação  │ ├───────────────────────────────────────────────────────┤ │
│    • Prospecção  │ │ CONTEÚDO                                               │ │
│  ▸ Operações…    │ │                                                        │ │
│  ▸ Marketing 🔒  │ └───────────────────────────────────────────────────────┘ │
│                  │                                                           │
│ CRM              │                                                           │
│  Contatos        │                                                           │
│  Empresas        │                                                           │
│  Negócios        │                                                           │
│  Funis           │                                                           │
│  Caixa de Entrada│                                                           │
│                  │                                                           │
│ IA               │                                                           │
│  Chat            │                                                           │
│  Agentes         │                                                           │
│  Habilidades     │                                                           │
│  Automações      │                                                           │
│  Conhecimento    │                                                           │
│  Aprovações  (3) │                                                           │
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
| Aprovações (contador) | Solicitações de Aprovação `pendente` em que o Membro logado é aprovador designado ou pode decidir (B80). |
| Domínios CRM / IA / Painéis | Pares da Estrutura (A2.2); nunca aninhados sob Espaço, Pasta, Lista ou Tarefa. |

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
| `/entrar` | Entrar — escolher Membro para simular a sessão | Membro (nome, Papel, estado), Espaço de Trabalho | Escolher Membro; entrar | 01 |
| `/` | Início | Tarefa (minhas, por vencimento), Conversa (atribuídas a mim), Negócio (meus `aberto`), Solicitação de Aprovação (pendentes para mim) | Abrir registro; concluir Tarefa; decidir Aprovação | 06, 12, 14, 17, 19 |
| `/minha-conta` | Minha conta | Membro (Nome de exibição no Espaço de Trabalho, Papel, Equipes, Disponibilidade de atendimento), Memória do Usuário → Item de Memória | Editar nome de exibição; alterar Disponibilidade; habilitar/desabilitar Memória do Usuário; remover Item de Memória | 01 (7.1), 16 (7.5) |
| `/buscar?q=` | Busca global | Tarefa, Contato, Empresa, Negócio, Conversa, Documento de Conhecimento, Espaço, Pasta, Subpasta, Lista, Agente, Habilidade, Automação, Coleção, Painel, Funil | Filtrar por tipo; abrir registro | transversal |

### 3.2 Estrutura de Trabalho

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/estrutura` | Espaços | Espaço | Criar Espaço (Papel ou `criar` no ET — RN-ESP-18); reordenar; arquivar; excluir | 02 |
| `/estrutura/espacos/[espaco]` | Espaço | Espaço, Pasta, Lista (diretas), Painel de contexto | Criar Pasta/Lista; renomear; tornar privado; arquivar; enviar à lixeira; instanciar Template | 02 |
| `/estrutura/espacos/[espaco]/configuracoes` | Configurações do Espaço | Conjunto de Status → Definição de Status, Definição de Campo Personalizado, Tipo de Tarefa, Funcionalidades habilitadas, Visualizações padrão, Bloqueio por aspecto, concessões | Definir/editar Conjunto de Status (com Mapeamento de status); criar Definição de Campo; bloquear aspecto; conceder permissão | 02 |
| `/estrutura/pastas/[pasta]` | Pasta ou Subpasta (mesma tela) | Pasta, Subpasta, Lista, Painel de contexto | Criar Subpasta (só se Nível 1 — A3.4); criar Lista; mover; promover/rebaixar; privar; arquivar; excluir | 03, 04 |
| `/estrutura/pastas/[pasta]/configuracoes` | Configurações da Pasta/Subpasta | Modo por aspecto (`herdado`/`sobrescrito`/`bloqueado`), Conjunto de Status sobrescrito, Definições de Campo próprias, Tipos de Tarefa próprios, concessões | Sobrescrever/voltar a herdar (com Mapeamento); bloquear; conceder | 03, 04 |
| `/estrutura/listas/[lista]` | Lista | Lista, Tarefa (Visualizações Lista, Quadro, Calendário, Tabela), Painel de contexto | Criar Tarefa; mudar Visualização; filtrar; agrupar; mover Tarefa; arquivar | 05, 06 |
| `/estrutura/listas/[lista]/configuracoes` | Configurações da Lista | Conjunto de Status efetivo, Definições de Campo efetivas, Tipos de Tarefa efetivos, Funcionalidades efetivas, Período planejado, Visualizações da Lista, Automações aplicáveis, concessões | Sobrescrever aspecto; definir Período planejado; salvar Visualização; privar | 05 |
| `/estrutura/tarefas/[tarefa]` | Tarefa (painel lateral com opção de página cheia) | Tarefa, Subtarefa, Checklist → Item → Subitem, Comentário, Registro de Tempo, Valor de Campo, Anexo, Dependência, Vínculo, Observador, Tag, Regra de Recorrência, Compartilhamento público, Registro de Atividade | Alterar Status; atribuir Responsável (Membro ou Agente); criar Subtarefa; criar/converter Item de Checklist; registrar tempo; comentar; vincular; mover (com Mapeamento de status); arquivar; excluir | 06, 07, 08 |

Uma Subtarefa abre na mesma rota de Tarefa: Subtarefa não é entidade distinta (B1, RN-STA-01).

### 3.3 CRM

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/crm/contatos` | Contatos | Contato (tabela), Suspeita de Duplicidade | Criar Contato; filtrar; importar; abrir mesclagem | 10 |
| `/crm/contatos/[contato]` | Ficha do Contato | Contato, Identificador de Contato, Consentimento, Endereço, Vínculo Contato-Empresa, Vínculo Contato-Negócio, Vínculo Contato-Tarefa, Vínculo `distinto de`, Valor de Campo, Tag, Comentário, Estado pré-mesclagem, linha do tempo | Editar; acrescentar/transferir Identificador; registrar Consentimento; vincular Empresa/Negócio; mesclar; marcar `distinto de`; arquivar; excluir; restaurar cópia (se `mesclado`) | 10 |
| `/crm/empresas` | Empresas | Empresa (tabela), Sugestão de Vínculo | Criar Empresa; filtrar; aceitar/descartar Sugestão de Vínculo | 11 |
| `/crm/empresas/[empresa]` | Ficha da Empresa | Empresa, Identificador de Empresa, Endereço, Empresa matriz/filiais/raiz do grupo, Vínculo Empresa-Empresa, Vínculo Contato-Empresa, Negócio, Conversas derivadas (só leitura), Valor de Campo, Tag, Comentário, Anexo | Editar; definir matriz; vincular Empresa; vincular Contato com papel; mesclar; arquivar; excluir | 11 |
| `/crm/negocios` | Negócios | Negócio (Quadro por Etapa, Tabela), Funil, Etapa | Trocar Funil; arrastar entre Etapas (com Requisitos); criar Negócio; abas Abertos / Ganhos / Perdidos | 12, 13 |
| `/crm/negocios/[negocio]` | Ficha do Negócio | Negócio, Funil, Etapa, Empresa, Vínculo Contato-Negócio, Valor, Probabilidade, Motivo de Perda/Ganho, Nota de encerramento, Valor de Campo, Tag, Comentário, Anexo, Vínculo Conversa-Negócio, Vínculo Tarefa-Negócio, histórico de transições | Mover de Etapa; marcar `ganho`/`perdido`; reabrir; mover de Funil; vincular Contato com papel; transferir propriedade; arquivar; excluir | 12 |
| `/crm/funis` | Funis | Funil | Criar Funil (Papel Administrador); definir Funil padrão; copiar; arquivar; excluir | 13 |
| `/crm/funis/[funil]` | Funil | Funil, Etapa, Requisito de Etapa, Transições permitidas, Regras de encerramento, Painel de contexto | Criar/reordenar/remover Etapa (com Remapeamento); definir Requisitos; definir Transições; definir Regras de encerramento; privar | 13 |
| `/crm/caixa-de-entrada` | Caixa de Entrada (três colunas) | Fila, Canal, Conversa, Mensagem, Participante, Anexo, Rascunho, Adiamento, Contato principal, Empresa (derivada), Vínculo Conversa-Negócio | Filtrar; auto-atribuir; atribuir a Membro ou Agente; transferir de Fila; responder; nota interna; adiar; resolver; reabrir; criar Tarefa/Negócio a partir da Conversa | 14 |
| `/crm/caixa-de-entrada/[conversa]` | Conversa (coluna 3 em foco; permalink) | idem acima | idem | 14 |
| `/crm/caixa-de-entrada/configuracoes` | Configurações da Caixa | Caixa de Entrada (Prazo de reabertura, Distribuição padrão, Proprietário padrão de Contatos, Horário de atendimento), Canal, Fila | Editar configurações; conectar/arquivar Canal; criar/editar Fila; definir elegíveis e Regra de distribuição | 14 |
| `/crm/caixa-de-entrada/configuracoes/canais/[canal]` | Canal | Canal, Capacidades do Tipo de Canal, Configuração de mensagens de modelo → Mensagem de modelo, Fila padrão, Origem padrão | Reconectar; definir Fila padrão; sincronizar modelos; habilitar grupos; arquivar | 14 |
| `/crm/caixa-de-entrada/configuracoes/filas/[fila]` | Fila | Fila, Elegíveis (Membro, Equipe), Regra de distribuição, Limite de Conversas por Atendente, Horário de atendimento, Painel de contexto | Editar elegíveis; mudar Regra de distribuição; arquivar (com transferência das não resolvidas); excluir | 14 |

### 3.4 IA

| Rota | Tela | Entidades exibidas | Ações | Doc. |
| --- | --- | --- | --- | --- |
| `/ia/chat` | Chat — minhas Sessões | Sessão de Chat | Criar Sessão (com Âncora opcional); arquivar; excluir | 16 |
| `/ia/chat/[sessao]` | Sessão de Chat | Sessão de Chat, Mensagem de Chat, Âncora, Agente principal, Modelo efetivo, Restrição de Ferramentas, Arquivo, Referência de Conhecimento, Solicitação de Aprovação | Enviar Mensagem; trocar Agente principal; trocar Modelo; restringir Ferramentas; regenerar; decidir Aprovação inline; compartilhar; arquivar | 16 |
| `/ia/agentes` | Agentes | Agente (estado, Disponibilidade, Proprietário) | Criar Agente; instanciar Template de Agente; ativar/pausar; arquivar | 17 |
| `/ia/agentes/[agente]` | Agente (abas: Configuração · Habilidades · Conhecimento · Ferramentas · Permissões · Execuções · Memória · Versões) | Agente, Versão de Agente, Concessão de Habilidade, Conhecimento acessível (derivado), Ferramentas permitidas, Papel, Política de aprovação, Limite de custo, Memória do Agente → Item de Memória, Execução de Agente → Passo → Exercício de Habilidade, Solicitação de Aprovação, Cadeia de Execuções, Custo | Editar configuração (cria Versão); conceder Habilidade; permitir Ferramenta; atribuir Papel; ensaiar; pausar/ativar; transferir propriedade; apagar Item de Memória; cancelar Execução | 17 |
| `/ia/habilidades` | Habilidades | Habilidade, Versão corrente, Efeito declarado | Criar; copiar Habilidade da plataforma; arquivar | 18 |
| `/ia/habilidades/[habilidade]` | Habilidade (abas: Versão · Ferramentas · Dependências · Agentes · Versões) | Habilidade, Versão de Habilidade, Contrato de entrada/saída, Requisitos de Ferramenta, Dependências, Coleções recomendadas, Capacidades de Modelo requeridas, Efeito declarado, Concessão de Habilidade | Editar rascunho; publicar; obsoletar; conceder a Agente; fixar versão na Concessão | 18 |
| `/ia/automacoes` | Automações | Automação (escopo, Natureza, estado, Inoperante) | Criar Automação; duplicar; pausar; arquivar | 19 |
| `/ia/automacoes/[automacao]` | Automação (abas: Editor · Execuções · Versões · Permissões) | Automação, Versão de Automação, Gatilho, Regra de Agendamento, Condição, Condição híbrida, Ação de escrita, Ação de controle, Política de erro, Autonomia máxima imposta, Execução de Automação → Passo, Execuções de Agente filhas, Solicitação de Aprovação, Cadeia de Execuções | Editar rascunho; publicar; acionar manualmente; pausar; transferir propriedade | 19 |
| `/ia/conhecimento` | Conhecimento — Coleções | Coleção (Proprietário, Privada, quantidade de Documentos) | Criar Coleção; arquivar; excluir | 20 |
| `/ia/conhecimento/[colecao]` | Coleção (abas: Documentos · Fontes · Acesso · Retenção) | Coleção, Fonte, Documento de Conhecimento, Política de atualização, Política de retenção de versões, concessões a Agentes | Adicionar Documento; configurar Fonte; atualizar Fonte; conceder acesso a Agente; privar; arquivar | 20 |
| `/ia/conhecimento/documentos/[documento]` | Documento de Conhecimento | Documento, Versão de Documento, Conteúdo, Representação derivada, Metadado, Proveniência, Estado de processamento, Desatualizado, Comentário, Vínculo, Referências recebidas | Nova Versão; editar Metadado; restaurar Versão; mover de Coleção; comentar; arquivar; excluir | 20 |
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
