# MATRIZ DE COBERTURA — ENTIDADE × TELA

Fase 2 — Mapa / Manual de UX · Versão 1.0 · 2026-09-10
Fonte de verdade: `ontologia/` v1.0 (21 documentos), `GLOSSARIO.md` e `MATRIZ-DE-RELACOES.md`. Telas: `INVENTARIO-DE-TELAS.md` (T01–T51, D01–D15).

**Regra de cobertura.** Toda entidade, entidade interna e objeto de valor nomeado pela ontologia aparece em pelo menos uma tela **ou** é declarado `NÃO EXIBIDO` com motivo. Um conceito só é `NÃO EXIBIDO` quando é (a) metodológico, (b) infraestrutura fora da ontologia, ou (c) efêmero por definição — e nesses casos a matriz aponta onde a sua **consequência** é visível.

**Resultado: 100% dos itens classificados. 297 itens · 280 exibidos · 17 declarados NÃO EXIBIDOS com motivo.**

Legenda de natureza: **E** entidade · **EI** entidade interna · **VO** objeto de valor · **D** derivado · **C** conceito transversal · **G** entidade global.

---

## 0. Entidades globais da plataforma ⟨A1.3, B81⟩

| # | Item | Nat. | Telas | Observação |
| --- | --- | --- | --- | --- |
| 1 | Usuário | G | T03, T40, T41 | Exibido só como atributo do Membro. Nenhuma entidade corporativa o referencia (documento 01, 7.1) |
| 2 | Modelo | G | T26, T28 | Seletor na Versão de Agente e na Sessão; a Execução grava o Modelo concreto |
| 3 | Modelo `padrão da plataforma` (marcador) | VO | T28 | Opção do seletor de Modelo, com explicação de resolução por Execução |
| 4 | Capacidades do Modelo | VO | T28, T35 | Exibidas na Disponibilidade da Concessão e no motivo de Documento indisponível |
| 5 | Tipo de Canal | G | T23 | Imutável no Canal; tabela de Capacidades somente leitura |
| 6 | Capacidades do Tipo de Canal | VO | T23, T21 | Tabela no Canal; consequências (janela, modelos, anexos) na Conversa |
| 7 | Tipo de Campo | G | T07, T45 | Seletor obrigatório na Definição de Campo |
| 8 | Tipo de Identificador | G | T14 | Seletor obrigatório no Identificador de Contato |
| 9 | Habilidade da plataforma | G | T29, T30 | Listada com pertencimento `plataforma`, somente leitura; ação [Copiar] |
| 10 | Ferramenta da plataforma | G | T28 (aba Ferramentas), T32 | Item do Catálogo de Ferramentas, com classe de efeito |
| 11 | Template de Agente da plataforma | G | T27, T47 | Instanciável; somente leitura |

---

## 1. Raiz organizacional ⟨documento 01⟩

| # | Item | Nat. | Telas | Observação |
| --- | --- | --- | --- | --- |
| 12 | Espaço de Trabalho | E | T39, barra superior | Seletor de contexto + tela de configurações |
| 13 | Membro | EI | T01, T03, T40, T41 | Único Ator humano dentro do Espaço de Trabalho |
| 14 | Identidade convidada | VO | T40 | Exibida enquanto `pendente` sem Usuário |
| 15 | Sucessor | D/ref | T41, D04 | Antecipado no diálogo e gravado no Membro `removido` |
| 16 | Disponibilidade de atendimento | VO | T03, barra superior, T24 | Do Membro, não da relação Membro-Fila |
| 17 | Memória do Usuário | EI | T03 | Só o próprio Membro; nunca em tela de terceiro |
| 18 | Item de Memória (do Usuário) | EI | T03 | Com estado `ativo`/`desativado` |
| 19 | Equipe | EI | T42, T24, T40 | Sujeito de permissão e destino de elegibilidade |
| 20 | Papel (de sistema) | EI | T43, T40 | Quatro, imutáveis |
| 21 | Papel personalizado | EI | T43 | Com base declarada como teto |
| 22 | Permissão (tupla) | C | T43, abas Acesso de T06/T07/T09/T11/T20/T24/T34/T38 | Exibida como (Sujeito, Ação, Recurso, Escopo, Origem) |
| 23 | Escopo de permissão | VO | T43 | `registro`, `subárvore`, `próprios` |
| 24 | Concessão direta | C | abas Acesso | Uma das origens exibidas |
| 25 | Compartilhamento | C | abas Acesso, T26 | Origem distinta de concessão direta |
| 26 | Ato de governança registrado | C | D06, T50 | Motivo obrigatório; visível na Auditoria |
| 27 | Integração | EI | T48 | Canal aparece como link para a Caixa |
| 28 | Ator | C | cabeçalhos, Atividade (todas) | Exibido com tipo em toda ação |
| 29 | Ator delegante | C | Atividade (todas), T26, T28, T32 | "em nome de" |
| 30 | Sistema (Ator) | C | Atividade (todas) | Com a causa do ato |
| 31 | Sujeito | C | T43, abas Acesso | — |
| 32 | Recurso | C | abas Acesso | — |
| 33 | Registro de Atividade | E | T50 + aba Atividade de todas as telas de registro | Base da auditoria |
| 34 | Localidade | VO | T39 | Fuso, moeda, idioma |
| 35 | Política de lixeira | VO | T39, T49 | Prazo exibido na Lixeira |
| 36 | Limites impostos | VO | T39 | Origem externa; somente leitura |
| 37 | Suspensões vigentes | VO | T39 | 0..2, uma por origem |
| 38 | Profundidade máxima de Subtarefas | VO | T39, T12 | Exibida como motivo do limite na Tarefa |
| 39 | Identificador legível (Tarefas) | VO | T39, T12 | Monoespaçado |
| 40 | Identificador legível de Negócios | VO | T39, T18 | Sequência e prefixo próprios |
| 41 | Template de Espaço padrão | ref | T39, T47 | 0..1 |
| 42 | Arquivo | C | T12, T14, T16, T18, T21, T26, T35 | Sempre por referência; nunca "biblioteca de Arquivos" própria |
| 43 | Tag | E | T44 + seletor em T12, T14, T16, T18, T21 | Definida só no Espaço de Trabalho |
| 44 | Template (de Espaço, Pasta, Lista, Tarefa, Checklist, Agente) | E | T47 + instanciação em T05, T06, T08, T10, T12, T27 | Sem vínculo vivo |

---

## 2. Estrutura de Trabalho ⟨documentos 02–08⟩

| # | Item | Nat. | Telas | Observação |
| --- | --- | --- | --- | --- |
| 45 | Espaço | E | T05, T06, T07 | — |
| 46 | Pasta | E | T08, T09 | — |
| 47 | Subpasta | E | T08, T09 | Mesma tela de Pasta, sem "Nova Subpasta" |
| 48 | Nível (de Pasta) | D | T08 | 1 ou 2 |
| 49 | Promoção / Rebaixamento (de Pasta) | C | T08 | Ações no menu `⋯` |
| 50 | Lista | E | T10, T11 | — |
| 51 | Período planejado | VO | T10, T11 | Descritivo |
| 52 | Tarefa | E | T10, T12 | Documento central |
| 53 | Subtarefa | E | T12 | Mesma rota de Tarefa |
| 54 | Tarefa raiz | D | T12 | Exibida na Subtarefa |
| 55 | Nível (de Tarefa) | D | T12 | Base do limite de profundidade |
| 56 | Promoção / Rebaixamento / Reparentagem (de Tarefa) | C | T12 | Ações; geram "Pai alterado" |
| 57 | Posição entre irmãs | A | T12 | Ordem manual de Subtarefas |
| 58 | Checklist | EI | T12 | Componente sem identidade externa |
| 59 | Item de Checklist | EI | T12 | Responsável 0..1 **Membro** |
| 60 | Subitem | EI | T12 | Um nível; não conta no progresso |
| 61 | Condição de Item | D | T12 | `aberto` / `concluído` / `convertido` |
| 62 | Template de Checklist | E | T47, T12 | Instanciável na Tarefa |
| 63 | Progresso de Checklists | D | T12 | Itens contáveis |
| 64 | Progresso de Subtarefas | D | T10, T12 | Só diretas efetivamente `ativo` |
| 65 | Conjunto de Status | EI | T07, T09, T11 | Ponto de definição visível |
| 66 | Definição de Status | EI | T07, T09, T11, T10 (colunas do Quadro) | Com categoria |
| 67 | Status atual | A | T10, T12 | Aponta para uma Definição do Conjunto efetivo da Lista (A4.2); é o que o seletor de Status edita |
| 68 | Categoria de status | C | T10, T12, T38 | Único invariante entre Conjuntos |
| 69 | Status inicial padrão | D | T07, T10 | Primeira `não iniciado` na ordem |
| 70 | Mapeamento de status | C | D01 | Diálogo obrigatório |
| 71 | Tipo de Tarefa | EI | T07, T09, T11, T12 | Tipo padrão não removível |
| 72 | Prioridade | A | T12 | Escala fixa nesta versão |
| 73 | Data (dia civil × instante) | VO | T10, T12, T38 | A forma é escolhida por Data, não por Tarefa; dia civil nunca recebe fuso (documento 06, 6.2) |
| 74 | Dependência | C | T12 | `bloqueia`, `é bloqueada por`, `aguarda` |
| 75 | Bloqueada | D | T10, T12 | Marcador, não estado |
| 76 | Vencida | D | T02, T10, T12 | Marcador |
| 77 | Registro de Tempo | EI | T12 | Sempre de Membro |
| 78 | Estimativa | VO | T12 | Condicionada à Funcionalidade |
| 79 | Regra de Recorrência | VO | T12 | Só na ocorrência corrente |
| 80 | Ocorrência corrente | D | T12 | Uma por série |
| 81 | Definição de Campo Personalizado (Tarefa) | EI | T07, T09, T11 | Acumula no caminho |
| 82 | Valor de Campo | EI | T12, T14, T16, T18, T21 | Inclui os `arquivado` (B37) |
| 83 | Anexo | C | T12, T16, T18, T21, T35 | Referência a Arquivo |
| 84 | Comentário | C | T12, T14, T16, T18, T35 | Nunca na Conversa |
| 85 | Observador | C | T12 | Membro com `ver` |
| 86 | Menção | D | T12, T21, T26 | Não cria Vínculo nem permissão |
| 87 | Compartilhamento público | VO | T12 | Só Membro; só `ver` |
| 88 | Visualização (de contêiner e pessoal) | C | T10, T11 | Configuração, não entidade de domínio |
| 89 | Funcionalidades habilitadas | VO | T07, T09, T11 | Substituem por funcionalidade |
| 90 | Modo de herança | VO | T09, T11 | `herdado`/`sobrescrito`/`bloqueado` |
| 91 | Ponto de definição | D | T07, T09, T11, T12 | Nomeado em cada aspecto e campo |
| 92 | Caminho efetivo | D | T10, T11, T12 | No cabeçalho |
| 93 | Bloqueio por aspecto | VO | T07, T09 | Rejeitado com sobrescritas |
| 94 | Contêiner pai | A | T08, T10 | Alterado só por movimentação |
| 95 | Contêiner privado | C | T06, T08, T10, T11, D06 | Cadeado na árvore |
| 96 | Administrador de Espaço | C | abas Acesso | Concessão, não Papel |
| 97 | Estado próprio | A | T06, T08, T10, T12, T34, T35 | Gravado |
| 98 | Estado efetivo | D | idem | Com o ancestral nomeado |
| 99 | Estado próprio anterior à exclusão | A | T49 | "Voltará para: arquivado" |
| 100 | Identificador local | A | T12, T38 | Checklist, Item, Subitem, Widget |

---

## 3. CRM ⟨documentos 09–14⟩

| # | Item | Nat. | Telas | Observação |
| --- | --- | --- | --- | --- |
| 101 | Contato | E | T13, T14 | — |
| 102 | Nome de exibição | D | T13, T14, T16, T21 | Nunca gravado |
| 103 | Não identificado | D | T13, T14, T21 | Condição, não estado |
| 104 | Modo de criação | A | T13, T14 | Imutável |
| 105 | Identificador de Contato | EI | T14, D11 | Único caminho de resolução de Mensagens |
| 106 | Consentimento | VO | T14 | Histórico monotônico |
| 107 | Finalidade de Consentimento | E | T46 | Com "exige consentimento para envio" |
| 108 | Definição de Qualificação | E | T46 | Catálogo com ordem |
| 109 | Qualificação | ref | T13, T14 | 0..1, exclusiva |
| 110 | Cargo de exibição | D | T13, T14 | Do Vínculo principal vigente |
| 111 | Última interação | D | T13, T14, T16 | Nunca gravada |
| 112 | Endereço | VO | T14, T16 | ≤1 principal |
| 113 | Suspeita de Duplicidade | D/VO | T13, D03 | Recalculável, nunca gravada |
| 114 | Vínculo `distinto de` | C | T14 | Suprime a suspeita |
| 115 | Estado pré-mesclagem | VO | T14, D03, D10 | Só em `mesclado` |
| 116 | Marcador de Contato eliminado | VO | T21 | Opaco, sem dados pessoais |
| 117 | Empresa | E | T15, T16 | — |
| 118 | Identificador de Empresa | EI | T16 | Nunca resolve Mensagens |
| 119 | Empresa matriz / filial / raiz do grupo | ref/D | T16 | Floresta acíclica, sem herança |
| 120 | Vínculo Empresa-Empresa | C | T16 | Catálogo fixo tipado |
| 121 | Sugestão de Vínculo | VO | T15, T16 | Transitória; nunca automática |
| 122 | Vínculo Contato-Empresa | C | T14, T16 | Papel, dois indicadores de principal, vigência |
| 123 | Negócio | E | T17, T18 | — |
| 124 | Situação do Negócio | A | T17 (abas), T18, T38 | `aberto`/`ganho`/`perdido`; ortogonal ao ciclo de vida (A4.4) |
| 125 | Objeto do Negócio | A | T18 | Substitui catálogo de Produtos |
| 126 | Vínculo Contato-Negócio | C | T14, T18 | Papel de catálogo fixo |
| 127 | Valor (quantia, moeda) | VO | T17, T18, T38 | Uma série por moeda |
| 128 | Probabilidade sobrescrita | A | T18 | Descartada em progressão |
| 129 | Probabilidade efetiva | D | T17, T18 | Nunca gravada |
| 130 | Valor ponderado | D | T17, T18, T38 | Derivado |
| 131 | Motivo de Perda | E | T46, D07 | "Duplicado" pré-definido |
| 132 | Motivo de Ganho | E | T46, D07 | Opcional |
| 133 | Nota de encerramento | A | T18, D07 | Limpa na reabertura |
| 134 | Origem | E | T46 + T13, T14, T15, T16, T18, T23 | Catálogo do Espaço de Trabalho |
| 135 | Momento de encerramento / Data de fechamento | D | T18, T38 | Condicionais |
| 136 | Registro de transição de Etapa | C | T18 (Histórico), T50 | É Registro de Atividade, não entidade interna |
| 137 | Próxima atividade | D | T17, T18 | Tarefa vinculada de menor Data |
| 138 | Previsão vencida | D | T17, T18 | Marcador |
| 139 | Dias em Etapa / Idade | D | T17, T18 | — |
| 140 | Funil | E | T19, T20 | Sem Proprietário |
| 141 | Funil padrão | ref | T19, T39 | Sempre `ativo`, nunca privado |
| 142 | Funil privado | C | T20 | Interseção para os Negócios |
| 143 | Etapa | EI | T17 (colunas), T20 | Sem estado; identidade estável |
| 144 | Última Etapa | D | T17, T18 | A Etapa preservada quando o Negócio é `ganho` ou `perdido` (B9) |
| 145 | Etapa inicial | D | T20 | Menor Ordem |
| 146 | Requisito de Etapa | VO | T20, T17 (ao arrastar) | Validação bloqueante |
| 147 | Transições permitidas | VO | T20, T17 | Vazio = todas |
| 148 | Regras de encerramento | VO | T20, D07 | Consumidas pelo Negócio |
| 149 | Remapeamento de Etapa | C | D02 | Obrigatório |
| 150 | Caixa de Entrada | E | T21, T22 | Única por Espaço de Trabalho |
| 151 | Prazo de reabertura | A | T22, T21 | Único; não sobrescritível |
| 152 | Horário de atendimento | VO | T22, T24 | Sobrescritível por Fila |
| 153 | Canal | E | T23, T21 (coluna 1) | Sem `na lixeira` |
| 154 | Identificador externo (Canal e Mensagem) | A | T23, T21 | Nunca é identidade |
| 155 | Configuração de mensagens de modelo | VO | T23 | Sincronizada |
| 156 | Mensagem de modelo | VO | T23, T21 (compositor) | Exigida fora da janela |
| 157 | Grupos habilitados | A | T23 | Só onde o Tipo suporta |
| 158 | Fila | E | T24, T21 (coluna 1) | Não contém Conversas |
| 159 | Elegíveis / elegíveis efetivos | C/D | T24 | Nunca lista Agentes |
| 160 | Regra de distribuição | A | T22, T24 | Nunca atribui a Agente |
| 161 | Limite de Conversas por Atendente | A | T24 | Só distribuição automática |
| 162 | Conversa | E | T21 | Sem `arquivado` |
| 163 | Estado de conversa | A | T21 | `aberta`/`pendente`/`resolvida` |
| 164 | Identificador de grupo | VO | T21 | Conversa de grupo (C5) |
| 165 | Marcador "não resolvido" | VO | T21 | Limite de Contatos atingido |
| 166 | Adiamento | VO | T21 | Só em `pendente` |
| 167 | Rascunho | VO | T21 | Um por Ator interno; não é Mensagem |
| 168 | Janela de resposta | D | T21 | "aberta até" |
| 169 | Prazo de validade de envio pendente | C | T21 | Motivo de `falhou` |
| 170 | Mensagem | EI | T21 | Imutável |
| 171 | Nota interna (Mensagem `interna`) | C | T21 | Substitui Comentário na Conversa |
| 172 | Status de entrega | A | T21 | Só `enviada` |
| 173 | Marcação de exclusão | VO | T21 | Terminal |
| 174 | Edição pelo remetente externo | VO | T21 | Histórico preservado |
| 175 | Reação | VO | T21 | Não é Mensagem |
| 176 | Leitura interna | VO | T21 | Alimenta "não lidas" |
| 177 | Endereços adicionais | VO | T21 | Só E-mail; não são Participantes |
| 178 | Participante | EI | T21 | Papel `contato`/`atendente`/`agente`/`observador` |
| 179 | Remetente / Destinatário | C | T21 | Papéis, não entidades |
| 180 | Atendente | C | T21, T24 | Papel funcional |
| 181 | Escalonamento | C | T21 | Transferência de Agente para Membro |
| 182 | Vínculo Conversa-Negócio | C | T18, T21 | 0..N nos dois lados |
| 183 | Linha do tempo | D | T14, T16, T18 | Filtrada item a item |

---

## 4. IA ⟨documentos 15–20⟩

| # | Item | Nat. | Telas | Observação |
| --- | --- | --- | --- | --- |
| 184 | Sessão de Chat | E | T25, T26 | Pessoal; nunca por Papel |
| 185 | Mensagem de Chat | EI | T26 | Imutável; papéis `usuário`/`assistente`/`sistema`/`ferramenta` |
| 186 | Âncora (de Sessão) | VO | T25, T26 | Imutável; validade derivada |
| 187 | Configuração da Sessão | VO | T26 | Só restringe |
| 188 | Restrição de Ferramentas | VO | T26 | Interseção com as permitidas |
| 189 | Agente | E | T27, T28 | Cinco estados |
| 190 | Assistente padrão | E | T27, T28, T39 | Sempre `ativo`; não excluível |
| 191 | Template de Agente (do Espaço de Trabalho) | E | T47, T27 | Sem Memória nem Execuções |
| 192 | Versão de Agente | EI | T28 | Imutável; não fixável por terceiros |
| 193 | Nível de autonomia | A | T28 | Três níveis |
| 194 | Nível de autonomia efetivo | D | T28 (Execução), T32 | Mínimo entre o do Agente e o imposto |
| 195 | Autonomia máxima imposta | VO | T32 | Na Versão ou na Ação |
| 196 | Política de aprovação | VO | T28 | Aprovadores + prazo (72 h) |
| 197 | Limite de custo | VO | T28 | Não versionado |
| 198 | Custo | VO | T26, T28, T32, T38 | Da Execução, nunca do Agente |
| 199 | Habilidade | E | T29, T30 | Sem Proprietário |
| 200 | Versão de Habilidade | EI | T30 | `rascunho`/`publicada`/`obsoleta` |
| 201 | Publicador | ref | T30, T32 | Membro (ou Sistema) que publicou a Versão; rastreabilidade, nunca governança (B71) |
| 202 | Concessão de Habilidade | C | T28, T30 | Única origem de `executar` |
| 203 | Exercício de Habilidade | VO | T28 (Passos), T38 (Dimensão) | Sem identidade |
| 204 | Coleção recomendada | VO | T30 | Declaração, não concessão |
| 205 | Efeito declarado | D | T29, T30, T28 | Governança, não aprovação |
| 206 | Ferramenta | C | T28, T32, T26 | Com classe de efeito e permissão requerida |
| 207 | Classe de efeito | A | T28, T32, T36 | Alimenta a aprovação |
| 208 | Automação | E | T31, T32 | Sujeito com teto do Proprietário |
| 209 | Escopo de Automação | ref | T31, T32 | Imutável |
| 210 | Natureza (de Automação) | D | T31 | `determinística`/`híbrida` |
| 211 | Inoperante | D | T31, T32 | Condição com motivo |
| 212 | Reage a Eventos de Automações | A | T32 | Padrão falso |
| 213 | Versão de Automação | EI | T32 | `publicada` 0..1 |
| 214 | Gatilho | VO | T32 | Exatamente um por Versão |
| 215 | Regra de Agendamento | VO | T32 | No fuso da Localidade |
| 216 | Condição | VO | T32 | Só lê |
| 217 | Condição híbrida | VO | T32 | Gera Execução de Agente filha |
| 218 | Ação (de escrita) | VO | T32 | Sempre uma Ferramenta |
| 219 | Ação de controle | VO | T32 | Não é Ferramenta |
| 220 | Política de erro | VO | T32 | `interromper`/`continuar` |
| 221 | Execução de Agente | EI | T28, T26, T36 | Com Origem e delegante |
| 222 | Execução de Automação | EI | T32, T36 | Mãe de filhas de Agente |
| 223 | Passo | VO | T28, T32 | Com permissão avaliada |
| 224 | Motivo de término | A | T28, T32 | Em `falhou`/`cancelada` |
| 225 | Cadeia de Execuções | VO | T28, T32 | Única para os dois tipos |
| 226 | Solicitação de Aprovação | EI | T36, T26, T28, T32, T38 | Com identidade; entidade-alvo de Painel |
| 227 | Aprovador | ref | T36, T28 | Sempre Membro `ativo` |
| 228 | Limite de operações por Execução | C | T32, T36 | Motivo `limite` |
| 229 | Ensaio | C | T28 | Escritas `simulado` |
| 230 | Composição do Contexto | VO | T28 | Referências, nunca conteúdo |
| 231 | Memória do Agente | EI | T28 | Elegibilidade por delegante |
| 232 | Item de Memória (do Agente) | EI | T28 | Com Delegante de origem |
| 233 | Delegante de origem | A | T28 | Determina a elegibilidade |
| 234 | Política de retenção de Memória | VO | T28 | Não versionada |
| 235 | Disponibilidade (Agente e Concessão) | D | T27, T28, T30 | Com motivo; sem estado `degradado` |
| 236 | Habilidades disponíveis | D | T28 | Visão derivada |
| 237 | Conhecimento acessível | D | T28 | Visão derivada; concessão vive na Coleção |
| 238 | Coleção | E | T33, T34 | Único Recurso de permissão do Conhecimento |
| 239 | Coleção privada | C | T34, D06 | B38 por analogia |
| 240 | Política de retenção de versões | VO | T34 | Nunca alcança a corrente |
| 241 | Fonte | EI | T34 | `envio manual` implícita |
| 242 | Marca de versão da origem | VO | T34, T35 | Copiada para a Proveniência |
| 243 | Atualização (de Fonte) | C | T34 | Arquiva ausentes; nunca elimina |
| 244 | Documento de Conhecimento | E | T34, T35 | Sem permissão própria |
| 245 | Ausente na origem desde | A | T34, T35 | Preenchido pelo Sistema |
| 246 | Desatualizado | D | T34, T35 | Continua consultável |
| 247 | Versão de Documento | EI | T35 | Conteúdo imutável |
| 248 | Estado de processamento | A | T34, T35 | Distinto do ciclo de vida |
| 249 | Representação derivada | VO | T35 | Nunca substitui o Conteúdo |
| 250 | Metadado | VO | T35 | Rótulos livres, sem catálogo |
| 251 | Proveniência | VO | T35, T12, T18, T27, T31, T37 | Obrigatória no Documento |
| 252 | Referência de Conhecimento | VO | T26, T28, T35 | Nunca apagada; resolve com marcador |
| 253 | Fragmento | EI | T26, T35 | Exibido como **Posição** na Referência de Conhecimento |
| 254 | Conhecimento (camada) | C | T33 | Não é entidade; a tela o explica |

---

## 5. Painéis ⟨documento 21⟩

| # | Item | Nat. | Telas | Observação |
| --- | --- | --- | --- | --- |
| 255 | Painel | E | T37, T38 | Não armazena dados |
| 256 | Painel de contexto | D | T37, T06, T08, T10, T20, T24 | Aparece na navegação da âncora |
| 257 | Âncora de Painel | VO | T37, T38 | Sobrevive à eliminação |
| 258 | Widget | EI | T38 | Identificador local |
| 259 | Widget inválido | D | T38 | Permanece com a causa |
| 260 | Fonte de Dados | VO | T38 | Catálogo fechado de entidades-alvo |
| 261 | Métrica | VO | T38 | Nunca gravada |
| 262 | Dimensão | VO | T38 | 0..2 |
| 263 | Filtro fixo | VO | T38 | Gravado |
| 264 | Filtro interativo | C | T38 | Estado de sessão |
| 265 | Período | VO | T38 | Absoluto ou relativo |
| 266 | Atributo temporal de referência | A | T38 | Escolhido por Widget |
| 267 | Tipo de Visualização de dados | A | T38 | Nove tipos |
| 268 | Leiaute | VO | T38 | Único por Painel |
| 269 | Momento de referência dos dados | D | T38 | Exposto em toda consulta |
| 270 | Condição de integridade | D | T37, T38 | `íntegro`/`parcialmente inválido`/`vazio` |
| 271 | Disponibilidade da Fonte | D | T38 | Por visualizador |

---

## 6. Conceitos transversais ⟨Glossário⟩

| # | Item | Nat. | Telas | Observação |
| --- | --- | --- | --- | --- |
| 272 | Vínculo | C | T12, T14, T16, T18, T21, T35 | Seção própria; nunca pasta |
| 273 | Campo Personalizado (guarda-chuva) | C | T07, T45 | Sempre qualificado (Definição ou Valor) |
| 274 | Criador | C | cabeçalho de todas | Imutável, com tipo de Ator |
| 275 | Proprietário | C | cabeçalho das 9 entidades que o têm | Ausente onde a ontologia não o prevê |
| 276 | Responsável | C | T12 | Membro ou Agente na Tarefa; só Membro no Item |
| 277 | Atribuído | C | T21 | Membro ou Agente |
| 278 | Evento | C | T32 (Gatilho), Atividade | Catálogo da plataforma |
| 279 | Estado de ciclo de vida | C | selos em todas | Códigos invariáveis em gênero |
| 280 | Versão corrente | D | T28, T30, T35 | Derivada: maior número no Agente; `publicada` de maior número na Habilidade; a que representa o Documento agora |

---

## 7. Itens declarados NÃO EXIBIDOS

Cada linha diz **por que** não é exibido e **onde a sua consequência** aparece. Nenhum deles é entidade de domínio.

| # | Item | Motivo | Onde a consequência é visível |
| --- | --- | --- | --- |
| 281 | **Contexto** (objeto de valor efêmero da Execução) | Efêmero por definição: reconstruído a cada Execução e **nunca persistido em conteúdo** (DO-AGE-09). Exibi-lo seria duplicar dados operacionais sob a permissão da Execução, o que B19 e B20 evitam | **Composição do Contexto** (referências) na Execução — T28 |
| 282 | **Catálogo de Ferramentas** | Consulta derivada (plataforma ∪ Integrações), não entidade (B72) | Lista de Ferramentas permitidas — T28; seletor de Ferramenta na Ação — T32 |
| 283 | **Indexação** | Operação de infraestrutura, declarada fora da ontologia (Glossário) | **Estado de processamento** da Versão — T34, T35 |
| 284 | **Fragmento (como registro navegável)** | Entidade interna derivada, sem permissão, estado, autor ou evento próprios; criada, regenerada e eliminada só pelo Sistema (B97). Não é Recurso e não tem tela | **Posição** citada na Referência de Conhecimento — T26, T35 |
| 285 | **Cache, materialização, atualização programada** | Infraestrutura explicitamente fora da ontologia (B100) | **Momento de referência dos dados** — T38 |
| 286 | **Artefato exportado de Painel** | Fora da ontologia (documento 21, 7.10) | O **ato de exportar** é registrado — T38, T50 |
| 287 | **Notificação** | Não é registro da ontologia (documento 19, 7.4) | Sino da barra superior, derivado de Eventos e Registros — registrado em `PENDENCIAS-FRONTEND.md` |
| 288 | **Invariante** | Conceito metodológico da ontologia (Glossário) | Cada invariante aparece como **regra visível** — `PADROES-TRANSVERSAIS.md` §10 |
| 289 | **Agregado** | Conceito metodológico (Glossário) | Cascatas e confirmações quantificadas — §12 dos padrões |
| 290 | **Ator / Sujeito / Recurso** como registros | São papéis na tupla de permissão, não entidades com tela (A9.1) | Exibidos como colunas nas abas Acesso e na Auditoria |
| 291 | **Sistema** como registro | Ator sem entidade (Glossário) | Aparece como autor com a causa do ato — Atividade |
| 292 | **Ação / Escopo / Origem** (elementos da tupla) | Elementos de valor da Permissão | Matriz de permissões — T43 |
| 293 | **Credenciais de Integração** | Objeto de valor sigiloso, **nunca exibido depois de gravado** (documento 01, 7.4) | Estado de conexão e Membro configurador — T48, T23 |
| 294 | **Conteúdo de Fragmento, Mensagem, Mensagem de Chat, Comentário e Memória em Painéis** | Proibido: nenhum Widget exibe, resume, indexa ou agrega conteúdo (RN-PAI-15) | Métricas de catálogo e uso — T38 |
| 295 | **Sessão de Chat e Mensagem de Chat como Fonte de Dados** | Excluídas do catálogo fechado (B85, B101) | Métricas de IA derivam de **Execuções** — T38 |
| 296 | **Memória (do Agente e do Usuário) como Fonte de Dados** | Excluída do catálogo fechado (B101) | Telas próprias — T03, T28 |
| 297 | **Item de Checklist como registro de Fonte de Dados** | Nenhuma Fonte tem Item como registro (RN-CHK-15) | Métrica derivada da Tarefa — T38 |

---

## 8. Verificação por documento

### 8.1 Fechamento aritmético da matriz

| Seção | Itens | Faixa |
| --- | --- | --- |
| 0 · Entidades globais da plataforma | 11 | 1–11 |
| 1 · Raiz organizacional | 33 | 12–44 |
| 2 · Estrutura de Trabalho | 56 | 45–100 |
| 3 · CRM | 83 | 101–183 |
| 4 · IA | 71 | 184–254 |
| 5 · Painéis | 17 | 255–271 |
| 6 · Conceitos transversais | 9 | 272–280 |
| 7 · NÃO EXIBIDOS (com motivo) | 17 | 281–297 |
| **Total** | **297** | **280 exibidos + 17 declarados** |

### 8.2 Verificação por documento da ontologia

Cada documento tem as suas entidades e entidades internas cobertas. A coluna "Itens" aponta a numeração desta matriz.

| Doc. | Entidades e entidades internas do documento | Itens | Telas principais |
| --- | --- | --- | --- |
| 01 Espaço de Trabalho | Espaço de Trabalho, Membro, Memória do Usuário, Item de Memória, Equipe, Papel, Papel personalizado, Integração, catálogos, Arquivo, Registro de Atividade, configurações globais | 12–44 | T39–T50, T01, T03 |
| 02 Espaço | Espaço, Conjunto de Status, Definição de Status, Definição de Campo, Tipo de Tarefa, Visualização, Funcionalidades, Bloqueio por aspecto | 45, 65–71, 81, 88–89, 93 | T05, T06, T07 |
| 03 Pasta | Pasta, Nível, Promoção/Rebaixamento, configuração contida | 46, 48–49, 90–94 | T08, T09 |
| 04 Subpasta | Subpasta (mesma entidade, restrição de contenção) | 47 | T08, T09 |
| 05 Lista | Lista, Período planejado, Visualizações da Lista, Conjunto/Definições/Tipos/Funcionalidades efetivos | 50–51, 88–92 | T10, T11 |
| 06 Tarefa | Tarefa, Status atual, **Data**, Comentário, Registro de Tempo, Valor de Campo, Anexo, Regra de Recorrência, Compartilhamento público, Dependência, Observador, Menção, Estimativa | 52, 56–57, 67, **72–73**, 74–88 | T10, T12 |
| 07 Subtarefa | Subtarefa, Tarefa raiz, Nível, Progresso de Subtarefas | 53–56, 64 | T12 |
| 08 Checklist | Checklist, Item, Subitem, Condição de Item, Template de Checklist, Progresso | 58–63 | T12, T47, D13 |
| 09 CRM — visão geral | (consolidação; sem entidade própria — 7.7 do documento 01) | — | — |
| 10 Contatos | Contato, Identificador de Contato, Consentimento, Endereço, Suspeita de Duplicidade, Estado pré-mesclagem, Vínculos, Qualificação, Modo de criação, Marcador de Contato eliminado | 101–116, 122 | T13, T14, D03, D10, D11 |
| 11 Empresas | Empresa, Identificador de Empresa, hierarquia matriz/filial, Vínculo Empresa-Empresa, Sugestão de Vínculo, Endereço | 117–122 | T15, T16 |
| 12 Negócios | Negócio, **Situação do Negócio**, Vínculo Contato-Negócio, Valor, Probabilidades, Motivos, Nota, Registro de transição, derivados | 123–139 | T17, T18, D07 |
| 13 Funis | Funil, Funil padrão, Funil privado, Etapa, **Última Etapa**, Etapa inicial, Requisito, Transições, Regras de encerramento, Remapeamento | 140–149 | T19, T20, D02, D08 |
| 14 Caixa de Entrada | Caixa, Canal, Mensagem de modelo, Fila, Elegíveis, Conversa, Mensagem, Participante, Anexo, Rascunho, Adiamento, objetos de valor da Mensagem | 150–183 | T21–T24, D12 |
| 15 IA — visão geral | Ferramenta, Contexto, Memória, Modelo, Execução, Solicitação, Concessão, Referência, Passo, Rascunho | 2–4, 198, 201–202, 205–206, 220–233, **281–282** | consolidação |
| 16 Chat | Sessão de Chat, Mensagem de Chat, Âncora, Configuração da Sessão, Restrição de Ferramentas, Memória do Usuário | 17–18, 184–188 | T25, T26 |
| 17 Agentes | Agente, Assistente padrão, Versão de Agente, Execução de Agente, Passo, Memória do Agente, Item de Memória, Solicitação de Aprovação, Política de aprovação, Ferramentas permitidas, Custo, Ensaio, Template de Agente | 189–198, 220, 222–236 | T27, T28, T36 |
| 18 Habilidades | Habilidade, Versão de Habilidade, **Publicador**, Concessão, Exercício, Ferramenta, Efeito declarado, Coleção recomendada | 199–206 | T29, T30 |
| 19 Automações | Automação, Escopo, Versão, Gatilho, Regra de Agendamento, Condição, Condição híbrida, Ação, Ação de controle, Política de erro, Execução de Automação, Natureza, Inoperante | 207–221, **287** | T31, T32 |
| 20 Conhecimento | Coleção, Fonte, Documento, Versão de Documento, Fragmento, Conteúdo, Representação derivada, Metadado, Proveniência, Referência de Conhecimento, Políticas | 237–253, **283–284** | T33, T34, T35 |
| 21 Painéis | Painel, Widget, Fonte de Dados, Métrica, Dimensão, Filtro, Período, Leiaute, Âncora de Painel, Tipo de Visualização, Momento de referência | 255–271, **285–286, 294–297** | T37, T38 |

**Nenhuma entidade, entidade interna, objeto de valor nomeado ou derivado canônico dos 21 documentos e do Glossário ficou sem tela nem sem declaração** — verificado por varredura dos termos em negrito de `GLOSSARIO.md` contra esta matriz.** As sete entidades internas que o PRD nomeou explicitamente como teste de cobertura estão todas exibidas: **Identificador de Contato** (T14), **Etapa** (T17, T20), **Participante** (T21), **Execução** (T28, T32), **Versão** (T28, T30, T32, T35), **Fragmento** (T26, T35 — como Posição na Referência de Conhecimento), **Widget** (T38).
