# FLUXOS PONTA A PONTA

Fase 2 — Mapa / Manual de UX · Versão 1.0 · 2026-09-10
Contexto fictício: Espaço de Trabalho **Auton Health** (PRD, I.3). Telas referenciadas por código de `INVENTARIO-DE-TELAS.md` (T01–T51, D01–D15).

Cada fluxo descreve, passo a passo: **onde** (tela), **o que o usuário faz**, **o que muda nos dados** e **o que a interface mostra**. Cada fluxo termina com o seu **caminho de erro** — a ação impedida por regra ontológica e como ela é explicada.

Convenção: → passo bem-sucedido · ⊘ passo impedido por regra.

---

## Fluxo 1 · Concluir uma Tarefa vencida

**Objetivo.** Provar que Status, estado de ciclo de vida e Registro de Atividade são coisas distintas e visíveis.

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T01** `/entrar` | Escolher **Camila Duarte** (Proprietária do Espaço de Trabalho) | Sessão simulada = Membro Camila | Lista de Membros com Papel e Estado; Tiago Reis aparece `removido` e não é selecionável |
| 2 | **T02** `/` | — | — | Bloco "Minhas Tarefas" agrupado em **Vencidas / Hoje / Esta semana**. "Revisar protocolo de exame admissional" traz o marcador **Vencida** (Data de vencimento decorrida e categoria não terminal) |
| 3 | **T02** | Abrir a Tarefa | — | Painel lateral (**T12**) com caminho efetivo `Operações clínicas › Protocolos › Revisões`, Status atual, Responsáveis, Progresso de Checklists |
| 4 | **T12** | Abrir o seletor de **Status** | — | Definições agrupadas por **categoria**: `não iniciado` · `em andamento` · `concluído` · `fechado`. A cor vem da categoria; o rótulo, da Definição |
| 5 | **T12** | Escolher "Concluído" | `Status atual` → Definição "Concluído" (categoria `concluído`); **Momento de conclusão** [D] preenchido; **Vencida** [D] passa a falso | Selo de Status muda; o marcador Vencida desaparece; aviso "Tarefa concluída." |
| 6 | **T12** aba Atividade | — | Registro de Atividade criado: ator Camila Duarte, ação "Status alterado", objeto a Tarefa, valor anterior "Em andamento" → novo "Concluído", momento | Linha nova no topo com avatar, ator, antes → depois e horário |

**O que a tela prova.** Concluir **não** arquiva: o estado de ciclo de vida continua `ativo` e o cabeçalho não ganha selo (documento 06, 11). Um Registro de Atividade é gerado com ator, sem delegante (ação direta de Membro).

### ⊘ Caminho de erro — Funcionalidade "exigir Checklists concluídos"

Se a Lista `Revisões` tem a Funcionalidade habilitada e a Tarefa tem 3 Itens contáveis `aberto`:

- O seletor mostra as Definições de categoria `concluído` e `fechado` **desabilitadas**, com o motivo em linha: **"3 itens de checklist abertos nesta Tarefa."** — a informação já está na tela (Progresso de Checklists), então o controle não espera o clique para reprovar (§10 dos padrões).
- Ao lado, o caminho de saída: link para os Itens e para **T11**, onde a exigência pode ser desabilitada.
- A validação no ato continua existindo como defesa contra estado obsoleto (outra pessoa acrescentou um Item enquanto a tela estava aberta): rejeita sem gravar, com a mesma mensagem. Nenhum Registro de Atividade de status é criado (RN-CHK-09).

---

## Fluxo 2 · Decompor trabalho: Tarefa → Subtarefa → Checklist → conversão

**Objetivo.** Provar que Subtarefa é Tarefa (B1), que Checklist é componente sem identidade (B2) e que a conversão é terminal (B48).

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T10** `/estrutura/listas/[lista]` | Criação rápida: "Preparar kit de campanha de vacinação" | Tarefa criada com **status inicial padrão** (primeira Definição `não iniciado` do Conjunto efetivo); Criador = Camila; Lista = `Campanhas` | A Tarefa aparece no grupo do status inicial; aviso "Tarefa criada." |
| 2 | **T12** | Seção Subtarefas → "Nova Subtarefa": "Definir itinerário das unidades" | Tarefa nova com `Tarefa pai` preenchido; **Lista derivada da raiz**, não atribuível; Nível [D] = 1 | A Subtarefa aparece aninhada; o pai ganha **Progresso de Subtarefas** "0 de 1" |
| 3 | **T12** | Seção Checklists → "Novo Checklist": "Materiais" | Componente do agregado da Tarefa, com Identificador local | Checklist com campo de Item em foco |
| 4 | **T12** | Acrescentar dois Itens: "Conferir estoque de seringas" e "Solicitar impressão dos folhetos" | Dois Itens de Checklist, `Concluído` = falso, Condição [D] = `aberto` | **Progresso** do Checklist: "0 de 2". Cada Item traz remover no menu do próprio Item — remover Item ou Checklist é edição da Tarefa (`checklist.md`, 12.2), com confirmação simples |
| 5 | **T12** | Atribuir o segundo Item a **Marcos Lima** | Responsável do Item = Membro `ativo` com `ver` na Tarefa | O seletor só lista Membros — **não oferece Agentes** (B48) |
| 6 | **T12** | Marcar o primeiro Item como concluído | `Concluído` = verdadeiro; **Momento de conclusão** e **Ator que concluiu** gravados | Progresso "1 de 2"; o Item mostra "Concluído por Camila Duarte · há instantes" |
| 7 | **T12** → **D13** | No segundo Item: "Converter em Subtarefa" | Tarefa nova (título = texto do Item, Responsável = o do Item, pai padrão = a Tarefa do Checklist); Item marcado [VO] `convertido` com identificador e título à época | Diálogo mostra o pai escolhido e avisa: "Sem conversão inversa. O Item ficará convertido e sairá do progresso." |
| 8 | **T12** | Confirmar | Item sai do numerador **e do denominador**; Progresso do Checklist passa a **"1 de 1"**; Progresso de Subtarefas do pai passa a "0 de 2" | O Item aparece riscado com o selo `convertido` e link para a Subtarefa criada |

**O que a tela prova.** Item contável = Item de primeiro nível **não convertido** (B48): o progresso salta de "1 de 2" para "1 de 1" sem que nada tenha sido concluído. Progresso nunca altera status (RN-CHK-08).

### ⊘ Caminho de erro — Profundidade máxima

Com Profundidade máxima de Subtarefas = 3 e a Tarefa já no Nível 3:

- "Nova Subtarefa" fica **desabilitada**, com a dica: **"Limite de 3 níveis de Subtarefa, definido no Espaço de Trabalho."** e link para **T39**.
- Na conversão de Item (D13), o botão Confirmar fica desabilitado com: **"Converter aqui criaria o nível 4. Escolha outra Tarefa pai ou converta a partir de um nível acima."**
- A rejeição ocorre **antes de qualquer efeito**: a Subtarefa não é criada e o Item continua `aberto` (RN-STA-04, RN-CHK-10).

---

## Fluxo 3 · Mover Tarefa entre Listas com Conjuntos de Status distintos

**Objetivo.** Provar que o Mapeamento de status é obrigatório, explícito e aplicado no mesmo ato (RN-LIS-06).

Cenário: a Lista `Revisões` (Espaço *Operações clínicas*) herda o Conjunto do Espaço — `A fazer` · `Em andamento` · `Concluído` · `Arquivado clínico`. A Lista `Ativação` (Espaço *Comercial*, Pasta *Clientes*) **sobrescreve** com `Novo` · `Em execução` · `Em revisão` · `Entregue` · `Cancelado`.

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T12** | Menu `⋯` → "Mover para outra Lista" | — | Seletor de Lista de destino, restrito a Listas efetivamente `ativo` com `criar` |
| 2 | **T12** | Escolher `Ativação` | — | A interface detecta que o **Conjunto de Status efetivo muda** e abre **D01** |
| 3 | **D01** `?mapear-status=` | — | — | Tabela: cada Definição **em uso** pelas Tarefas afetadas → seletor de destino, com a **categoria** de origem e de destino ao lado. "Em andamento (em andamento) → ?" com contagem "1 Tarefa" |
| 4 | **D01** | Mapear "Em andamento" → "Em execução" | — | Categoria de destino `em andamento`: **igual** — sem aviso |
| 5 | **D01** | (hipótese) Mapear para "Entregue" | — | Aviso destacado: **"A categoria mudará de *em andamento* para *concluído*. Isto gera o evento de conclusão em 1 Tarefa."** |
| 6 | **D01** | Confirmar | Movimentação **atômica**: Lista alterada; status remapeado; Valores de Campo de Definições que deixam de se aplicar passam a `arquivado` **no agregado**; Tipo de Tarefa indisponível no destino passa ao padrão; Subtarefas acompanham a raiz; Vínculos, Dependências, Comentários, Registros de Tempo, Anexos e Tags preservados | Aviso: "Tarefa movida para *Ativação*. 2 Valores de Campo ficaram indisponíveis neste caminho e foram preservados." |
| 7 | **T12** | — | — | Cabeçalho mostra o novo caminho efetivo; seção de Valores de Campo traz o agrupador recolhido **"Campos não aplicáveis neste caminho (2)"** em cinza; Atividade registra "Movida de *Revisões* para *Ativação*" e "Status alterado por remapeamento" |
| 8 | **T12** | Concluir a Tarefa no novo Conjunto | Status → "Entregue" (categoria `concluído`) | Aviso "Tarefa concluída." |

**O que a tela prova.** Nenhuma categoria muda sem ato explícito (B40); Valores de Campo órfãos são **arquivados, não descartados** (B37) e voltam se a Tarefa retornar.

### ⊘ Caminho de erro — mapeamento incompleto e colisão de Definição de Campo

- Enquanto qualquer Definição em uso estiver sem destino, **Confirmar fica desabilitado** com "Mapeie todas as Definições em uso para continuar."
- Se a Lista de destino tiver uma Definição de Campo com o mesmo nome de uma Definição própria da Tarefa em outro ponto do caminho, a movimentação é **rejeitada por inteiro**: **"O campo *Centro de custo* já existe no caminho de destino. Renomeie um dos dois antes de mover."** (B44, RN-LIS-08). Nada é gravado.

---

## Fluxo 4 · Avançar e ganhar um Negócio com Requisito de Etapa

**Objetivo.** Provar que Requisito de Etapa é validação síncrona e bloqueante para **todo Ator**, e que as Regras de encerramento são configuração do Funil (B59).

Cenário: Funil **Vendas B2B** (padrão), Etapas `Novo` · `Qualificação` · `Proposta` · `Negociação` · `Fechamento` · `Assinatura`. A Etapa `Proposta` tem Requisito de **entrada** `contato obrigatório`. O Funil tem a Regra de encerramento **"exigir valor ao ganhar"**.

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T17** `/crm/negocios` | — | — | Quadro por Etapa; cada coluna mostra o nome, a **probabilidade padrão** e a soma de Valor **por moeda** |
| 2 | **T17** | Arrastar "Programa ocupacional — Metalúrgica Sul" de `Qualificação` para `Proposta` | — | Ao levantar o cartão, a coluna `Proposta` exibe o Requisito: **"Exige ao menos um Contato vinculado."** |
| 3 | ⊘ **T17** | Soltar | **Nada muda** | O cartão **volta à origem** com animação; diálogo: **"Não é possível entrar em *Proposta*: exige ao menos um Contato vinculado."** + [Vincular Contato] [Cancelar] |
| 4 | **T18** (via [Vincular Contato]) | Vincular **Ana Ribeiro** com papel `decisor` | Vínculo Contato-Negócio criado; como é o primeiro, nasce **principal** | Seção Contatos mostra "Ana Ribeiro · decisor · principal" |
| 5 | **T17** | Arrastar de novo para `Proposta` | Etapa alterada; **probabilidade sobrescrita descartada** (se havia), com o valor preservado no Registro; Momento de entrada na Etapa atual atualizado; Dias em Etapa [D] zera | Aviso: "Negócio movido para *Proposta*." A Atividade registra origem da entrada `avanço` (derivado da Ordem à época) |
| 6 | **T18** | "Marcar como ganho" → **D07** | — | Diálogo pede **quantia e moeda**, porque a Regra "exigir valor" está ativa. Confirmar desabilitado enquanto a quantia for vazia **ou zero** |
| 7 | **D07** | Informar R$ 148.000,00; Motivo de Ganho "Preço"; Nota | Situação → `ganho`; **Etapa preservada** (`Proposta` continua sendo a última Etapa); Momento de encerramento e Data de fechamento [D] preenchidos; Probabilidade efetiva [D] = 100 | Aviso "Negócio marcado como ganho." |
| 8 | **T17** | — | — | O Negócio sai da aba **Abertos** e aparece em **Ganhos**, **na coluna `Proposta`** — porque a última Etapa é preservada (B9) |

**O que a tela prova.** Posição (Etapa) e resultado (situação) são dimensões independentes (B58): o Negócio ganho continua em `Proposta`, e nenhuma Etapa "de ganho" existe.

### ⊘ Caminhos de erro adicionais

- **Transição não permitida.** Se `Novo` declara Transições permitidas = {`Qualificação`}, as demais colunas ficam **inertes durante o arraste** e soltar exibe: "De *Novo* só é possível ir para *Qualificação*."
- **Perder sem Motivo.** Com "exigir Motivo de Perda" ativa, D07 pede o Motivo do catálogo; Confirmar desabilitado sem ele (RN-NEG-09).
- **Reabrir um Negócio `ganho`.** Para Júlia Prado (Papel Membro), a ação **não aparece**; o item do menu `⋯` fica desabilitado com "Só Administradores reabrem um Negócio ganho." (RN-NEG-10). Um Agente **nunca** o faz (RN-NEG-21).
- **Empresa arquivada.** Trocar a Empresa por uma `arquivado` é impedido no seletor, que só lista `ativo` (RN-EMP-08).

---

## Fluxo 5 · Atender com Rascunho de IA, resolver e reabrir

**Objetivo.** Provar que Rascunho não é Mensagem (B66), que a Mensagem é imutável com status de entrega (B68) e que a reabertura dentro do prazo mantém a **mesma** Conversa (B12).

Cenário: Camila; Canal WhatsApp `Comercial SP`; Conversa com **Marina Alves**, `aberta`, atribuída a Camila; o Agente "Qualificador SDR" (`supervisionado`) produziu um Rascunho.

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T21** `/crm/caixa-de-entrada` | — | — | Três colunas. A Conversa traz o marcador de **Rascunho de IA** e o tempo de espera |
| 2 | **T21** | Abrir a Conversa | — | Sequência de Mensagens por direção; o compositor mostra o **Rascunho** com a origem "Agente · Qualificador SDR" e link para a Execução, com [Usar] e [Descartar] |
| 3 | **T21** | [Usar] | O texto do Rascunho vai para o compositor; **o Rascunho não é Mensagem** e não aparece na sequência | O compositor fica editável; o bloco de Rascunho some |
| 4 | **T21** | Ajustar o texto e enviar | **Mensagem nova** `enviada`, **Ator = Camila Duarte** (quem envia), com Proveniência opcional para a Execução do Agente; status de entrega `pendente` | A Mensagem aparece com "Camila Duarte" e o indicador de envio |
| 5 | — | (provedor confirma) | Status de entrega: `pendente` → `enviada` → `entregue` → `lida` | O indicador evolui na própria Mensagem, com o momento de cada transição |
| 6 | **T21** | "Responder e resolver" | Estado de conversa → `resolvida`; Momento de resolução gravado | Selo da Conversa muda; ela sai do filtro "não resolvidas"; aviso "Conversa resolvida." |
| 7 | — | Marina responde 6 h depois (Prazo de reabertura = 72 h) | **A mesma Conversa** é reaberta: `resolvida` → `aberta`; Mensagem `recebida` acrescentada; evento "Conversa reaberta por Mensagem"; quantidade de reaberturas incrementada | A Conversa reaparece no topo com o selo `aberta` e a linha "Reaberta por Mensagem recebida" na Atividade |

**O que a tela prova.** A autoria da Mensagem final é de quem envia; o Agente fica na Proveniência e na Execução (B66). Enviar Mensagem **não muda o estado por si** — resolver foi um ato distinto (DO-CXE-07).

### ⊘ Caminhos de erro

- **Fora da janela de resposta.** Passadas 24 h da última Mensagem `recebida` no WhatsApp, o compositor troca para o seletor de **Mensagem de modelo** com o aviso: **"A janela de resposta deste Canal expirou. Só é possível enviar uma Mensagem de modelo aprovada."** Tentar enviar texto livre é **rejeitado antes de gravar**, para todo Ator (RN-CXE-19).
- **Canal desconectado.** A Mensagem é gravada `pendente` com: **"O Canal *Comercial SP* está desconectado. A Mensagem será enviada na reconexão, dentro de 24 horas."** Vencido o prazo, passa a `falhou` **com motivo**, e a ação disponível é **Reenviar**, que cria Mensagem nova (B69, RN-CXE-18).
- **Consentimento ausente.** Envio de Finalidade `marketing` sem consentimento vigente exibe o marcador no Contato e bloqueia Automação e Agente; para o Membro, alerta com registro (RN-CON-16).
- **Excluir Conversa `aberta`.** "Enviar à lixeira" fica desabilitado: **"Só uma Conversa resolvida pode ir para a lixeira."** (RN-CXE-33).
- **Após 72 h.** A resposta de Marina cria uma **Conversa nova**, não reabre — e a interface diz "Nova Conversa por *Comercial SP*", com link para a anterior na linha do tempo do Contato (RN-CXE-09).

---

## Fluxo 6 · Mesclar Contatos duplicados

**Objetivo.** Provar que a mesclagem preserva a identidade do absorvido, é irreversível e reaponta as referências no ato (B14).

Cenário: "Marina Alves" (telefone) e "Marina A." (identidade de WhatsApp), com Suspeita de Duplicidade por nome normalizado.

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T13** `/crm/contatos` | — | — | Painel lateral "Suspeitas de Duplicidade" com o par e o **motivo** ("Nome de exibição idêntico") |
| 2 | **T13** | "Mesclar" → **D03** | — | Os dois registros lado a lado; escolha do **sobrevivente** |
| 3 | **D03** | Escolher "Marina Alves" | — | A tela lista o que **migra** (Identificadores, Vínculos com Empresa e Negócio, Tags, Valores de Campo, Consentimentos, Endereços) e o que fica no **Estado pré-mesclagem** do absorvido; e as **referências reapontadas**: 1 Conversa, 1 Negócio, 2 Tarefas |
| 4 | **D03** | — | — | Aviso destacado: **"A mesclagem é irreversível. A única saída é restaurar uma cópia a partir do estado guardado, que cria um registro novo."** Confirmação por digitação do nome |
| 5 | **D03** | Confirmar | Ato atômico: sobrevivente resulta `ativo`; absorvido → `mesclado` com "Mesclado em" e [VO] Estado pré-mesclagem; Identificadores, Vínculos, Tags e componentes migram; Conversas, Negócios, Tarefas e âncoras reapontados; `mesclado` anteriores reapontam ao novo sobrevivente | Aviso "Contatos mesclados. 1 Conversa, 1 Negócio e 2 Tarefas foram reapontados." |
| 6 | **T14** (sobrevivente) | — | — | A ficha traz agora **dois** Identificadores (telefone e identidade de WhatsApp), ambos verificados, com um principal por Tipo; a linha do tempo agrega o histórico dos dois |
| 7 | **T14** (absorvido, por referência histórica) | — | — | Selo `mesclado`, somente leitura, com "Este Contato foi mesclado em *Marina Alves*" e a seção **Estado pré-mesclagem** + [Restaurar cópia] (D10) |

**O que a tela prova.** Referências históricas continuam válidas e resolvem ao sobrevivente em um passo, sem cadeia (RN-CON-14).

### ⊘ Caminhos de erro

- **Duas Conversas não resolvidas no mesmo Canal.** D03 avisa antes de confirmar: **"O sobrevivente ficará com duas Conversas não resolvidas em *Comercial SP*. A de Mensagem mais recente permanece; a outra será resolvida com a causa *mesclagem*."** Mensagens **não** são movidas (RN-CXE-10).
- **Registro `na lixeira` ou `mesclado`.** Não é oferecido como origem nem destino: **"Só é possível mesclar Contatos ativos ou arquivados."** (B14).
- **Sem `administrar` sobre ambos.** A ação não aparece (B14).
- **Identificador duplicado ao editar** (caminho alternativo, sem mesclar). Ao acrescentar um telefone já usado: **"Este telefone já pertence a *Marina A.*. Você pode mesclar os Contatos ou transferir o Identificador."** com as duas ações (RN-CON-11).

---

## Fluxo 7 · Agente `assistido` age em nome de um Membro, com aprovação

**Objetivo.** Provar que toda resposta de IA é saída de Execução (B84), que a aprovação é por Ferramenta e por classe de efeito (B77) e que a ação registra Agente **e** delegante (A6.2).

Cenário: Camila; Agente **"Redator de propostas"** (`assistido`); Sessão de Chat **ancorada** ao Negócio "Programa ocupacional — Metalúrgica Sul".

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T25** `/ia/chat` | "Nova Sessão" com Âncora = o Negócio | Sessão criada; Proprietário = Criador = Camila (imutável); Âncora [VO] fixada e **imutável** | O seletor de Âncora oferece Tarefa, Negócio, Contato, Empresa, Conversa, Documento, Espaço, Pasta, Subpasta, Lista — **não** oferece Coleção, Funil, Fila, Painel nem Agente |
| 2 | **T26** | Trocar o Agente principal para "Redator de propostas" | Mensagem `sistema` "Agente principal alterado"; evento | Chip da Âncora no topo; o Agente aparece com o nível `assistido` |
| 3 | **T26** | "Envie a proposta para a Ana pelo WhatsApp" | Execução de Agente criada: Origem `Sessão de Chat`, delegante = **Camila**, Versão e Modelo fixados no início, nível efetivo `assistido` | Indicador "Executando…" com [Cancelar] |
| 4 | — | O Agente lê o Negócio e a Conversa | Passos: chamadas de Ferramenta de classe `leitura`, cada uma com as **duas** permissões avaliadas | Mensagens `ferramenta` aparecem como **registro** compacto (Ferramenta · resultado · resumo), não como fala |
| 5 | — | O Agente decide invocar `enviar Mensagem` (classe **`externa`**) | Nível `assistido` exige aprovação para **toda** Ferramenta que não seja `leitura`; Solicitação de Aprovação criada com **objeto fixo**; Execução → `aguardando aprovação` | Cartão inline: **"Enviar esta Mensagem a *Ana Ribeiro* na Conversa por *Comercial SP*"** + texto integral + classe de efeito `externa` + prazo **72 h** + [Aprovar] [Recusar] |
| 6 | **T26** ou **T36** | Camila aprova | As duas verificações são **refeitas**; Ferramenta executada; Mensagem `enviada` criada com **Ator = Agente "Redator de propostas"** e **ator delegante = Camila Duarte**; Execução → `concluída` | Aviso "Aprovado. Mensagem enviada." |
| 7 | **T21** (Conversa) | — | — | A Mensagem aparece com avatar de **Agente** e a linha **"Redator de propostas · em nome de Camila Duarte"** |
| 8 | **T18** (Negócio) aba Atividade | — | Registro de Atividade no registro-alvo com ator Agente e delegante Membro | "Mensagem enviada · Redator de propostas em nome de Camila Duarte" |
| 9 | **T28** aba Execuções | — | Execução `concluída` com Passos, Composição do Contexto (referências), Referências de Conhecimento, Cadeia de Execuções (profundidade 0) e Custo | Detalhe da Execução, com cada Passo e a permissão avaliada |

**O que a tela prova.** A Sessão é privada, **as ações não** (RN-CHT-10): o efeito aparece na Conversa e no Negócio, com os dois atores nomeados.

### ⊘ Caminhos de erro

- **Prazo vencido.** Sem decisão em 72 h, a Solicitação passa a `expirada` e a Execução a `cancelada` com motivo; a Sessão recebe Mensagem `sistema` "Aprovação vencida. A Execução foi cancelada." (RN-AGE-18).
- **Permissão revogada durante a espera.** Ao aprovar, a verificação é refeita: se Camila perdeu `ver` na Conversa, o Passo registra **"negada"** e a mensagem diz **"A aprovação foi registrada, mas a Ferramenta foi negada: você não tem mais permissão sobre esta Conversa."** — porque **aprovar nunca concede permissão** (RN-AGE-17, INV-AGE-08).
- **Fora da janela de resposta.** A Ferramenta `enviar Mensagem` falha com o motivo da janela; a Execução segue a Política de erro; o texto parcial vira **Rascunho** da Conversa (B66, RN-CXE-19).
- **Agente pausado antes do início.** A invocação é rejeitada com Registro; a Sessão informa por Mensagem `sistema` (RN-AGE-10).
- **Menção a Agente sem `executar`.** A menção vira texto e o Agente principal responde, com Mensagem `sistema` explicando (RN-CHT-15).

---

## Fluxo 8 · Automação híbrida no Funil, com Execução de Agente filha

**Objetivo.** Provar que a Automação tem exatamente um Gatilho por Versão (B89), que a publicação valida antes de qualquer efeito (RN-AUT-07) e que a Cadeia de Execuções é única (B79).

Cenário: Rafael Nunes (Administrador) cria uma Automação de escopo **Funil "Vendas B2B"**.

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T31** `/ia/automacoes` | "Nova Automação" | Escopo escolhido = Funil "Vendas B2B", **imutável**; Automação nasce `rascunho`, Versão 1 `rascunho`; Proprietário = Rafael | Aviso: "O escopo delimita o Gatilho e não pode ser alterado depois. Para mudar de escopo, duplique." |
| 2 | **T32** Editor | Gatilho: `evento` → "Negócio entrou em Etapa" | Objeto do Gatilho = o Negócio | O seletor de Eventos só oferece os compatíveis com o escopo (Eventos de Negócio) |
| 3 | **T32** | Condição: Etapa = `Proposta` | Predicado atômico sobre atributo nativo | — |
| 4 | **T32** | Ação de controle **"invocar Agente"**: Agente "Qualificador SDR", Habilidade "Resumir contexto do Negócio", Autonomia máxima imposta `supervisionado`, Aprovador = Rafael, Tempo limite 24 h | Ação registrada na Versão | A Ação aparece visualmente distinta das Ações de escrita e **sem** classe de efeito (não é Ferramenta) |
| 5 | **T32** | Ação de escrita: `criar Tarefa` na Lista "Propostas em curso" | Ação referencia a **Ferramenta** com classe `escrita reversível`, Recurso-alvo Lista e permissão requerida `criar` | A Ação mostra a Ferramenta, a classe e a permissão requerida |
| 6 | **T32** | "Publicar" | Validação: Gatilho compatível com o escopo; ao menos uma Ação; Ferramentas existentes; Agente `ativo` e a Automação com `executar` sobre ele; Habilidade `ativo`, com Versão corrente e **concedida ao Agente**; teto de permissões do Proprietário | Se tudo passa: Versão 1 → `publicada`; Automação → `ativo`; a Natureza [D] passa a **`híbrida`** |
| 7 | — | Um Negócio entra em `Proposta` | Execução de Automação criada (Ator invocador `Sistema`, delegante = Proprietário); Condição verdadeira; Ação "invocar Agente" cria **Execução de Agente filha** com delegante = **a Automação** | — |
| 8 | **T32** aba Execuções | — | A filha executa com as **próprias** permissões do Agente (delegante Automação **não** entra na interseção); nível efetivo = mín(`supervisionado` do Agente, `supervisionado` imposto) | O detalhe mostra a **Cadeia de Execuções**: Execução de Automação (profundidade 0) → Execução de Agente (profundidade 1) |
| 9 | **T32** | — | Ação `criar Tarefa` executada; Tarefa criada com **Criador = a Automação** e Proveniência "criado por Automação X, Execução Y" | A Tarefa criada mostra no cabeçalho "Criada por *Nova proposta → resumo* (Automação)" |

**O que a tela prova.** A Execução de Agente filha pertence ao **Agente**, não à Automação (B18): ela aparece nas duas telas, com a referência à mãe como valor.

### ⊘ Caminhos de erro

- **Publicação rejeitada.** Se a Habilidade indicada não está concedida ao Agente, "Publicar" **não produz efeito** e lista o que falta: **"A Habilidade *Resumir contexto do Negócio* não está concedida ao Agente *Qualificador SDR*."** com link para **T28** (RN-AUT-07).
- **Teto de permissões.** Se a Automação tem concessões que excedem as do Proprietário: **"A Automação não pode ter mais permissões que o seu Proprietário. Revise as concessões ou transfira a propriedade."** (RN-AUT-04).
- **Ciclo.** Se a Ação criasse um Evento que dispararia a mesma Automação sobre o mesmo objeto, o disparo **não cria Execução**: gera "disparo recusado por ciclo" com a Cadeia e notifica o Proprietário (RN-AUT-09).
- **Limite de operações.** Ao atingir o Limite de operações por Execução, a Execução passa a `aguardando aprovação` com Solicitação ao Proprietário, **em qualquer nível de autonomia** (RN-AUT-13).
- **Escopo arquivado.** Se o Funil for arquivado, a Automação `ativo` passa a exibir **Inoperante** com o motivo, sem mudar de estado (documento 19, 11.1).
- **Segundo Gatilho.** Não existe: a interface não oferece "acrescentar Gatilho" — **"Cada versão tem exatamente um Gatilho. Para reagir a outro Evento, crie outra Automação."** (DO-AUT-02).

---

## Fluxo 9 · Remover um Membro com sucessão

**Objetivo.** Provar que a remoção é sucessão no mesmo ato (B28), que autoria é preservada (A6.4) e que Sessões e Memória do Usuário não são sucedidas (B87).

Cenário: Camila remove **Marcos Lima** (Membro, operações), que é Responsável por 14 Tarefas, Proprietário de 2 Automações e aprovador de 1 Solicitação pendente, e tem `administrar` por concessão direta sobre a Lista privada "Auditorias internas".

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T40** `/configuracoes/membros` | Abrir Marcos Lima | — | Ficha (**T41**) com propriedades, responsabilidades e Solicitações |
| 2 | **T41** | "Remover do Espaço de Trabalho" → **D04** | — | Seletor de **Sucessor** (Membros `ativo` sem base Convidado; padrão: Camila, o ator da remoção) |
| 3 | **D04** | Escolher **Rafael Nunes** | — | A tela **antecipa a sucessão**, em duas listas: <br>**Será transferido:** 2 Automações (continuam `ativo` sob o teto do Sucessor), 1 Solicitação de Aprovação pendente, a concessão `administrar` sobre a Lista privada "Auditorias internas" (que ficaria sem nenhum Membro `ativo` com `administrar`).<br>**Será liberado:** 14 Tarefas ficarão **sem Responsável**; 3 Itens de Checklist ficarão sem Responsável; 2 Conversas serão redistribuídas pela regra da Fila. |
| 4 | **D04** | — | — | Aviso: **"As Sessões de Chat e a Memória do Usuário de Marcos irão para a lixeira e serão eliminadas em 30 dias. Se ele for reconvidado dentro do prazo, elas voltam."** |
| 5 | **D04** | Confirmar | Ato único: Membro → `removido` com Momento de remoção e Sucessor; propriedades e aprovações ao Sucessor; Responsável/Atribuído liberados; concessões diretas revogadas **exceto** a de contêiner privado que ficaria órfã; Sessões e Memória do Usuário à lixeira; retirado de todas as Equipes | Aviso quantificado: "Marcos Lima removido. 2 Automações e 1 aprovação passaram para Rafael Nunes. 14 Tarefas ficaram sem Responsável." |
| 6 | **T10** (Lista de Marcos) | — | — | As Tarefas mostram "Sem Responsável"; a Atividade de cada uma registra "Responsável removido · ator: Camila Duarte" |
| 7 | **T12** (uma Tarefa antiga) | — | Criador e autores de Comentário continuam apontando para Marcos `removido` | O nome aparece com o selo `removido`; a Tarefa continua íntegra (A6.4) |
| 8 | **T31** | — | As duas Automações aparecem com Proprietário Rafael e **continuam `ativo`** | Aviso na Automação: "Proprietário alterado por sucessão. Verifique se as Ações continuam dentro do teto de permissões do novo Proprietário." (DO-AUT-14) |
| 9 | **T50** Auditoria | — | Um Registro de Atividade **por transferência** | Linhas separadas por registro transferido |

**O que a tela prova.** "Proprietário é sempre um Membro `ativo` ou `suspenso`" nunca quebra, porque a sucessão ocorre no mesmo ato (B28).

### ⊘ Caminhos de erro

- **Remover o Proprietário do Espaço de Trabalho.** A ação **não existe** para o Proprietário: **"Transfira a propriedade antes de remover este Membro."** com link para D05 (RN-ET-05).
- **Sucessor inválido.** Convidados e Membros não `ativo` não aparecem no seletor (B28).
- **Reconvite.** Convidar de novo o mesmo Usuário **reativa o mesmo Membro**; Equipes, concessões e propriedades transferidas **não** voltam — a tela avisa (B27, RN-ET-11). Sessões e Memória do Usuário voltam se dentro do prazo (B87).

---

## Fluxo 10 · A Convidada: permissões visíveis, sem vazamento

**Objetivo.** Provar que a troca de Membro muda o que se vê, que um contêiner compartilhado expõe **só os nomes** dos ancestrais (B38e) e que o Painel não revela o que a permissão esconde (B103).

Cenário: **Beatriz Sales**, Papel Convidado, com a Lista "Ativação" (`Comercial › Clientes › Ativação`) compartilhada em `ver`.

| # | Onde | Ação | Dados | Interface |
| --- | --- | --- | --- | --- |
| 1 | **T01** | Entrar como Beatriz Sales | Sessão simulada = Beatriz | Papel "Convidado" ao lado do nome |
| 2 | — | — | — | **Navegação lateral:** ESTRUTURA mostra `Comercial › Clientes › Ativação` com os **dois primeiros nós inertes** — sem expansão, sem contagem, sem menu. Nenhuma outra Lista de `Clientes` aparece; o Espaço `Marketing` (privado) **não existe** para ela |
| 3 | **T06** | Clicar em `Comercial` | — | Nada acontece: o nó é inerte. O nome existe **apenas para navegação** (RN-ESP-15) |
| 4 | **T10** | Abrir `Ativação` | — | A Lista abre normalmente, somente leitura: [Nova Tarefa] ausente, seletores desabilitados |
| 5 | — | — | — | **CRM, IA e Painéis:** a navegação exibe só o que foi compartilhado. Sem Agente compartilhado com `executar`, o Chat não permite criar Sessão (RN-CHT-02) |
| 6 | **T38** `/paineis/[painel]` (compartilhado) | Abrir o Painel "Comercial" | — | O Painel abre com a declaração fixa **"Os valores refletem as suas permissões."** e o **Momento de referência dos dados** |
| 7 | **T38** | — | O Widget "Negócios por Etapa" tem Fonte no Funil "Vendas B2B", que Beatriz não vê | O Widget exibe **"Fonte sem acesso"** — sem nome do Funil, sem contagem, sem indicação de existência — e **não é desenhado** (RN-PAI-29) |
| 8 | **T38** | — | O Widget "Tarefas por status" tem Fonte na Lista "Ativação", que ela vê | Calculado normalmente, mas **só com as Tarefas que ela vê**: os números diferem dos de Camila, sem nenhum indicador de "dados ocultos" (B103) |
| 9 | **T04** `/buscar?q=Metalúrgica` | Buscar | — | Nenhum resultado do CRM. Rodapé fixo: "A busca respeita as suas permissões." |

**O que a tela prova.** Não existe indicador de dados ocultos, e nenhuma referência de configuração revela nome, contagem ou existência do que o visualizador não vê (B103, RN-PAI-29). O Convidado não é um Membro com menos botões: é um Membro que vê outro sistema.

### ⊘ Caminhos de erro

- **Convidada tentando criar contêiner privado.** A ação não existe: só um Membro `ativo` **sem base Convidado** privatiza (B38c, RN-LIS-12).
- **Convidada como Sucessor.** Não aparece no seletor de D04 (B28).
- **Convidada como Proprietário.** Transferência para base Convidado é rejeitada (RN-PAI-05, RN-AGE-04).
- **Compartilhar um descendente não expõe irmãos.** Se outra Lista de `Clientes` for compartilhada depois, ela aparece — as demais continuam invisíveis. A privacidade é **monotônica para baixo** e o compartilhamento é por Recurso (B38e).

---

## Matriz fluxo × tela

| Fluxo | Telas percorridas |
| --- | --- |
| 1 · Concluir Tarefa vencida | T01, T02, T12 |
| 2 · Decompor trabalho | T10, T12, D13 |
| 3 · Mover entre Listas | T12, D01, T11 |
| 4 · Avançar e ganhar Negócio | T17, T18, D07 |
| 5 · Atender e reabrir | T21 |
| 6 · Mesclar Contatos | T13, T14, D03, D10 |
| 7 · Agente com aprovação | T25, T26, D09 (inline na Sessão; T36 é a lista equivalente), T21, T18, T28 |
| 8 · Automação híbrida | T31, T32, T28, T12 |
| 9 · Remover Membro | T40, T41, D04, T10, T12, T31, T50 |
| 10 · Convidada | T01, T10, T38, T04 (a árvore da casca é percorrida; T06 **não** abre — o nó de ancestral é inerte) |

Telas do inventário **não** percorridas pelos dez fluxos — cobertas por navegação direta e verificadas na Fase 6: T03, T05, T06, T07, T08, T09, T15, T16, T19, T20, T22, T23, T24, T27, T29, T30, T33, T34, T35, T37, T39, T42, T43, T44, T45, T46, T47, T48, T49, T51, e os diálogos D02, D05, D06, D08, D11, D12, D14, D15.
