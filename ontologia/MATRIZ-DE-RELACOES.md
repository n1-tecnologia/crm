# MATRIZ DE RELAÇÕES

Versão da ontologia: 1.0 | Última revisão global: 2026-09-09

Síntese de todas as relações decididas pela ontologia. Nenhuma linha é nova: cada uma aponta o documento (seção) ou a decisão que a fixou. Onde dois documentos divergiam, prevaleceu a constituição (`DECISOES-E-PENDENCIAS.md`); sem decisão constitucional, prevaleceu o documento da entidade de origem. As divergências e as omissões encontradas estão no relatório da revisão transversal (fase 6), não aqui.

## Como ler

**Tipos de relação**

| Tipo | Significado | Teste |
| --- | --- | --- |
| **contenção** | O destino é componente do agregado da origem (composição) ou filho estrutural exclusivo (A3.3). | O destino não existe sem a origem; é eliminado com ela. |
| **pertencimento** | A origem é o escopo do destino, que é raiz do próprio agregado (documento 01, 8). | O destino não existe sem a origem, mas tem agregado e governança próprios. |
| **associação** | Relação simétrica ou N:N entre registros que existem um sem o outro (Vínculo, Concessão, Responsável, Tag). | Eliminar um lado remove a relação, nunca o outro lado. |
| **referência** | Atributo da origem que aponta para o destino (obrigatório ou opcional). | A origem existe sem o destino ou sobrevive com referência inválida/marcador. |
| **herança** | O destino consome configuração ou permissão definida na origem (B25, A9.2). | Só na Estrutura de Trabalho e em Coleção → Documento (permissão). |
| **derivação** | Relação nunca gravada, calculada a cada consulta. | Não há atributo; há regra. |
| **invocação** | Uma Execução cria ou dispara outra Execução (Cadeia de Execuções — B79). | Transitória; terminada a Execução, restam referências. |

**Cardinalidade** é lida de origem para destino: `1 → 0..N` significa "uma origem tem zero ou muitos destinos; cada destino tem exatamente uma origem". `0..N ↔ 0..N` marca associação sem lado dominante. Restrições adicionais (≤1 por par, imutável) vão na mesma célula.

**Propriedade?** = "sim" quando o destino pertence ontologicamente à origem (falha no teste de existência sem ela: contenção ou pertencimento). Propriedade no sentido de Proprietário (governança — A7) **não** é "sim": Proprietário é referência com semântica de responsabilidade e tem tabela própria (seção 7).

**Fonte** = documento (número, seção) e/ou decisão. Numeração dos documentos: 01 `espaco-de-trabalho`, 02 `espaco`, 03 `pasta`, 04 `subpasta`, 05 `lista`, 06 `tarefa`, 07 `subtarefa`, 08 `checklist`, 09 `crm-visao-geral`, 10 `contatos`, 11 `empresas`, 12 `negocios`, 13 `funis`, 14 `caixa-de-entrada-e-mensageria`, 15 `ia-visao-geral`, 16 `chat`, 17 `agentes`, 18 `habilidades`, 19 `automacoes`, 20 `conhecimento`, 21 `paineis`. `ET` = Espaço de Trabalho.

---

## 1. Raiz e globais

Todas as entidades corporativas pertencem, direta ou transitivamente, a exatamente um Espaço de Trabalho (A1.1). Nenhuma aresta atravessa a fronteira do Espaço de Trabalho (A1.2). Entidades globais são referenciadas, nunca possuídas (A1.3; B81).

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| ET | contém | Membro | contenção | 1 → 1..N | sim | 01, 8–9; A6.4 |
| ET | é de propriedade de | Membro (Proprietário do ET) | referência (propriedade) | 1 → 1 | não | 01, 8–9; A7; B26 |
| ET | foi criado por | Membro (primeiro Membro) | referência (Criador) | 1 → 1 | não | 01, 8; B27 |
| ET | contém | Equipe | contenção | 1 → 0..N | sim | 01, 8–9; A8 |
| ET | contém | Papel | contenção | 1 → 4..N | sim | 01, 9; A9.4; B30 |
| ET | contém | Integração (exceto Canal) | contenção | 1 → 0..N | sim | 01, 8–9; B35 |
| ET | contém | Espaço | contenção | 1 → 0..N | sim | 01, 8–9; A3.1 |
| ET | contém | Contato / Empresa / Negócio | pertencimento | 1 → 0..N cada | sim | 01, 8–9; 09, 8 |
| ET | contém | Funil | pertencimento | 1 → 1..N | sim | 01, 9; 13, 9; B60 |
| ET | referencia como padrão | Funil (Funil padrão) | referência | 1 → 1 (Funil `ativo`, nunca privado) | não | 01, 9; 13, 8; B60 |
| ET | possui | Caixa de Entrada | contenção (composição 1:1) | 1 → 1 | sim | 01, 8–9; 14, 9; B11 |
| ET | contém (via Membro) | Sessão de Chat | pertencimento transitivo | 1 → 0..N | sim | 01, 8; 16, 9; B21 |
| ET | contém | Agente | pertencimento | 1 → 1..N | sim | 01, 9; 17, 9; B33 |
| ET | referencia | Assistente padrão (Agente contido) | referência | 1 → 1 | não | 01, 8–9; 17, 9; B33 |
| ET | contém | Habilidade | pertencimento | 1 → 0..N | sim | 01, 9; 18, 9 |
| ET | contém | Concessão de Habilidade | contenção (associação contida) | 1 → 0..N | sim | 15, 8; B15 |
| ET | contém | Automação | pertencimento | 1 → 0..N | sim | 01, 9; 19, 9; B41 |
| ET | contém | Coleção | pertencimento | 1 → 0..N | sim | 01, 9; 20, 9; A2.3 |
| ET | contém | Painel | pertencimento | 1 → 0..N | sim | 01, 9; 21, 9 |
| ET | contém (catálogos) | Tag / Definição de Campo do CRM / Motivo de Perda / Motivo de Ganho / Origem / Definição de Qualificação / Finalidade de Consentimento / Template | contenção | 1 → 0..N cada | sim | 01, 8–9; B34 |
| ET | contém | Arquivo | contenção | 1 → 0..N | sim | 01, 8–9; A8 |
| ET | contém | Registro de Atividade | contenção | 1 → 1..N (imutáveis) | sim | 01, 8–9; A6.2 |
| ET | configura | Localidade / Política de lixeira / Profundidade máxima de Subtarefas / Identificador legível de Tarefas / Identificador legível de Negócios | objeto de valor | 1 → 1 cada | sim (valor) | 01, 9; B34; DO-NEG-02 |
| ET | está sujeito a | Limites impostos | objeto de valor de origem externa | 1 → 1 | sim (valor) | 01, 8–9; B34 |
| Membro | referencia | Usuário (global) | referência | 1 → 0..1 enquanto `pendente`; 1 depois | não | 01, 9; A1.4; B27 |
| Usuário | é Membro de | ET (por Membro) | associação | 1 → 0..N ETs; 0..1 Membro por (Usuário, ET) | não | 01, 9; B27 |
| Membro | tem | Papel | referência | 1 → 1 | não | 01, 9; B30 |
| Membro | integra | Equipe | associação N:N | 0..N ↔ 0..N (só `ativo`/`suspenso`) | não | 01, 9; B27 |
| Membro | tem | Identidade convidada | objeto de valor | 1 → 0..1 (só `pendente`) | sim (valor) | 01, 12.3; B27 |
| Membro | tem | Disponibilidade de atendimento | objeto de valor | 1 → 1 | sim (valor) | 14, 8–9; DO-CXE-14 |
| Membro | contém | Memória do Usuário → Item de Memória | contenção | 1 → 0..1 → 0..N | sim | 16, 9; B86 |
| Membro | contém | Sessão de Chat | pertencimento (propriedade imutável) | 1 → 0..N; Sessão → Membro 1 | sim | 16, 8–9; B21; B87 |
| Membro `removido` | registra | Sucessor (Membro) | referência | 1 → 0..1 | não | 01, 12.3; B28; Glossário |
| Papel personalizado | tem base | Papel de sistema (Administrador, Membro, Convidado) | referência | 1 → 1 | não | 01, 9; B30 |
| Integração | foi configurada por | Membro configurador | referência | 1 → 1 | não | 01, 8; B35 |
| Integração | expõe | Ferramenta de origem `Integração` | referência (Catálogo derivado) | 1 → 0..N | não | 18, 23; B72 |
| ET | referencia (via Canais, Definições, Agentes) | Tipo de Canal / Tipo de Campo / Tipo de Identificador / Modelo | referência a entidade global | 1 → 0..N | não | 01, 8; A1.3 |
| ET | referencia (via Concessão, cópia, instanciação) | Habilidade da plataforma / Ferramenta da plataforma / Template de Agente da plataforma | referência a entidade global | 1 → 0..N | não | A1.3; B81 |
| Permissão | tem | Sujeito (Membro, Equipe, Papel, Agente, Automação) × Ação × Recurso × Escopo × Origem | tupla | 1 → 1 cada | — | A9.1; B29; B88 |
| Recurso | é alvo de | Concessão direta / Compartilhamento | referência (vive no Recurso) | 1 → 0..N | sim (vive no Recurso) | Glossário; 05, 8; 21, 8 |
| Ator | pratica | Registro de Atividade (ator, ação, objeto, momento, resultado, delegante 0..1) | referência | 1 → 0..N | não | A6.1–A6.2 |
| Registro de Atividade | tem | ator delegante (Ator de qualquer tipo: Membro, Agente, Automação ou Integração) | referência | 1 → 0..1 | não | A6.2; B18; B79; DO-AUT-15 |

---

## 2. Estrutura de Trabalho

Cadeia única de contenção estrutural (A2.1, A3): exclusiva, obrigatória, com cascata de estado por derivação (B36) e herança de configuração (B25). Contêineres não têm Status, Prioridade, Proprietário nem Responsável (B45).

### 2.1 Contenção estrutural

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| ET | contém | Espaço | contenção | 1 → 0..N | sim | 02, 9; A3.1 |
| Espaço | contém | Pasta | contenção | 1 → 0..N | sim | 02, 8–9; A3.1 |
| Espaço | contém | Lista (direta) | contenção | 1 → 0..N | sim | 02, 8–9; A3.1 |
| Pasta | contém | Subpasta (Pasta com pai Pasta) | contenção | 1 → 0..N (0 se a Pasta é Subpasta) | sim | 03, 9; 04, 9; A3.4; B3 |
| Pasta | contém | Lista | contenção | 1 → 0..N | sim | 03, 8–9; A3.1 |
| Subpasta | contém | Lista | contenção | 1 → 0..N | sim | 04, 8–9; A3.1 |
| Subpasta | contém | Subpasta / Pasta / Tarefa (direta) | proibida | 0 | — | 04, 9; A3.2; A3.4 |
| Lista | pertence a | contêiner pai (Espaço, Pasta ou Subpasta) | contenção (invertida) | 1 → 1 | — | 05, 8–9; A3.2 |
| Lista | contém | Tarefa raiz | contenção | 1 → 0..N | sim | 05, 9; 06, 9; B4 |
| Lista | contém (via raiz) | Subtarefa | contenção transitiva | 1 → 0..N (a Lista da raiz) | sim | 05, 8; 07, 9; B1 |
| Tarefa | tem pai | Tarefa | contenção (dentro do agregado da raiz) | 1 → 0..1 (mesma Lista) | — | 06, 9; 07, 9; B1 |
| Tarefa | contém | Subtarefa | contenção | 1 → 0..N (nível ≤ Profundidade máxima) | sim | 06, 9; 07, 9; B1 |
| Subtarefa | tem raiz | Tarefa raiz | derivação | 1 → 1 | — | 07, 8–9; INV-TAR-02 |
| Espaço / Pasta / Subpasta / Lista | pertence a | ET (imutável) | pertencimento transitivo | 1 → 1 | — | 02, 8; 04, 8; 05, 8; A1.1 |

### 2.2 Configuração contida e herdada

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Espaço | contém | Conjunto de Status | contenção | 1 → 1 (raiz obrigatória) | sim | 02, 9; B45 |
| Conjunto de Status | contém | Definição de Status | contenção | 1 → 2..N (≥1 `não iniciado`, ≥1 `fechado`) | sim | 02, 9; A4.3 |
| Pasta / Subpasta / Lista | contém | Conjunto de Status sobrescrito | contenção | 1 → 0..1 | sim | 03, 9; 04, 9; 05, 9; B25 |
| Lista | consome | Conjunto de Status efetivo | herança (resolução por caminho) | 1 → 1 | — | 05, 8–9; B45 |
| Espaço / Pasta / Subpasta / Lista | contém | Definição de Campo Personalizado (entidade-alvo Tarefa) | contenção | 1 → 0..N (nome único no caminho efetivo) | sim | 02, 9; 03, 9; 04, 9; 05, 9; A5.2; B44 |
| Lista | consome | Definições de Campo efetivas | herança (acumulação) | 1 → 0..N | — | 05, 8–9; B25 |
| Espaço | contém | Tipo de Tarefa | contenção | 1 → 1..N (tipo padrão sempre) | sim | 02, 9; C6 |
| Pasta / Subpasta / Lista | contém | Tipo de Tarefa adicional | contenção | 1 → 0..N | sim | 03, 9; 05, 8; B25 |
| Espaço / Pasta / Subpasta / Lista | contém | Visualização do contêiner | contenção | 1 → 0..N | sim | 02, 9; 05, 9; A8 |
| Membro | contém | Visualização pessoal | contenção | 1 → 0..N | sim | 05, 23; A8 |
| Espaço / Pasta / Subpasta / Lista | configura | Funcionalidades habilitadas / Visualizações padrão / Privado / modo de herança por aspecto | objeto de valor | 1 → 1 cada | sim (valor) | 02, 9; 05, 9; B25; B38 |
| Lista | configura | Período planejado | objeto de valor | 1 → 0..1 | sim (valor) | 05, 9 |
| Contêiner ancestral | transmite a | descendentes (configuração e permissão) | herança | 1 → 0..N (modo `herdado` / `sobrescrito` / `bloqueado`) | — | 03, 8; 04, 8; 05, 8; B25; A9.2 |
| ET | transmite a | Espaço (Papel salvo privado, Tags, Localidade, Profundidade máxima, Política de lixeira, Automações de escopo ET) | herança | 1 → 0..N | — | 02, 8; B25 |
| Espaço / Pasta / Subpasta / Lista | guarda | Concessão direta / Compartilhamento (Recurso = contêiner) | contenção | 1 → 0..N (privado: ≥1 `administrar` a Membro `ativo`) | sim | 02, 9; 03, 9; 05, 9; B38 |
| Espaço / Pasta / Subpasta / Lista | foi criado a partir de | Template | referência (Proveniência) | 1 → 0..1 | não | 02, 9; 03, 9; 05, 9; A8 |
| Template de Lista / Pasta / Espaço | originou | instâncias | referência (Proveniência inversa) | 1 → 0..N (sem vínculo vivo) | não | 03, 9; 05, 8; A8; B47 |
| Espaço / Pasta / Subpasta / Lista | foi criado por | Criador (Ator) | referência | 1 → 1 | não | 02, 9; 03, 8; 05, 9; A7 |

### 2.3 Agregado da Tarefa

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Tarefa | aponta para | Definição de Status (status atual, do Conjunto efetivo) | referência (uso de configuração) | 1 → 1 | não | 06, 8–9; A4.2 |
| Tarefa | é do | Tipo de Tarefa | referência (uso de configuração) | 1 → 1 (padrão "tarefa") | não | 06, 9; DO-TAR-13 |
| Tarefa | foi criada por | Criador (Ator) | referência | 1 → 1 | não | 06, 9; A7 |
| Tarefa | tem | Responsável (Membro ou Agente) | associação | 1 → 0..N (exige `ver`) | não | 06, 8–9; A7; B7 |
| Tarefa | tem | Observador (Membro) | associação | 1 → 0..N (exige `ver`) | não | 06, 8–9; Glossário |
| Tarefa | tem | Tag | associação N:N | 0..N ↔ 0..N | não | 06, 9; B5 |
| Tarefa | contém | Comentário | contenção | 1 → 0..N | sim | 06, 8–9; A8 |
| Comentário | contém | resposta (Comentário) | contenção | 1 → 0..N (um nível) | sim | 06, 9; DO-TAR-07 |
| Comentário | anexa | Arquivo (Anexo) | referência | 1 → 0..N | não | 06, 23; A8 |
| Tarefa | contém | Checklist | contenção | 1 → 0..N (ordenados) | sim | 06, 9; 08, 9; B2 |
| Checklist | contém | Item de Checklist | contenção | 1 → 0..N (ordenados) | sim | 08, 8–9; B2 |
| Item de Checklist | contém | Subitem | contenção | 1 → 0..N (um nível) | sim | 08, 8–9; INV-CHK-03 |
| Item de Checklist | tem | Responsável (Membro `ativo`, nunca Agente) | associação | 1 → 0..1 (exige `ver` na Tarefa) | não | 08, 8–9; B48 |
| Item de Checklist | foi concluído por | Ator (Membro, Agente, Automação, Integração) | referência | 1 → 0..1 (sse concluído) | não | 08, 8–9; INV-CHK-04 |
| Item de Checklist | foi convertido em | Subtarefa | objeto de valor (referência unilateral, não viva) | 1 → 0..1 (terminal) | não | 08, 8–9; 07, 9; B48 |
| Checklist | foi criado a partir de | Template de Checklist | referência (Proveniência) | 1 → 0..1 | não | 08, 8–9; A8 |
| Template de Tarefa | referencia | Template de Checklist | referência | 1 → 0..N | não | 08, 8–9 |
| Tarefa | contém | Registro de Tempo (de Membro) | contenção | 1 → 0..N | sim | 06, 9; B42 |
| Membro | tem | Registro de Tempo em andamento | referência | 1 → 0..1 (no ET) | não | 06, 9; B42; INV-TAR-12 |
| Tarefa | contém | Valor de Campo | contenção | 1 → 0..N (um por Definição aplicável; `ativo`/`arquivado`) | sim | 06, 9; A5; B37 |
| Tarefa | anexa | Arquivo (Anexo) | referência | 1 → 0..N | não | 06, 8–9; A8 |
| Arquivo | é anexado por | Tarefa / Mensagem / Comentário / Empresa / Negócio / Versão de Documento / Mensagem de Chat | referência inversa | 1 → 0..N | não | 06, 9; 14, 9; 20, 9; A8 |
| Tarefa | carrega | Regra de Recorrência | objeto de valor | 1 → 0..1 (só a ocorrência corrente) | sim (valor) | 06, 9; B6 |
| Tarefa | é ocorrência de | Tarefa (ocorrência anterior e origem da série) | referência (Proveniência) | 1 → 0..1 (sem vínculo vivo) | não | 06, 8; B6 |
| Tarefa | foi criada a partir de | Template de Tarefa / Item convertido / Conversa / Negócio / Contato / Empresa | referência (Proveniência composta) | 1 → 0..1 | não | 06, 9; 14, 8.5; A8; B48 |
| Tarefa | expõe-se por | Compartilhamento público | objeto de valor | 1 → 0..1 | sim (valor) | 06, 9; Glossário |
| Tarefa | depende de / bloqueia | Tarefa (Dependência `bloqueia`/`é bloqueada por`, `aguarda`) | associação tipada direcional | 0..N ↔ 0..N (acíclica; nunca pai↔descendente; mesmo ET) | não | 06, 8.3, 9; 07, 8; INV-TAR-09 |
| Tarefa | relacionada a | Tarefa (Vínculo simétrico) | associação (Vínculo) | 0..N ↔ 0..N | não | 06, 8.2 |
| Subtarefa | recebe compartilhamento de | Tarefa raiz ou ancestral | herança (do agregado) | 1 → 0..N | — | 07, 8; DO-TAR-16 |

---

## 3. CRM

Tabela-mestra do documento 09 (seção 8), revisada. O CRM não tem hierarquia de contêineres (A2.2; A5.2): não há estado efetivo, movimentação nem herança de configuração; a única resolução em cascata é a de padrões (Fila → Canal → Caixa → Proprietário do ET), que é derivação (14, 8).

### 3.1 Contenção e agregados

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| ET | contém | Contato | pertencimento | 1 → 0..N | sim | 09, 8; 10, 9; RN-CON-01 |
| ET | contém | Empresa | pertencimento | 1 → 0..N | sim | 09, 8; 11, 9; RN-EMP-01 |
| ET | contém | Negócio | pertencimento | 1 → 0..N | sim | 09, 8; 12, 9; RN-NEG-01 |
| ET | contém | Funil | pertencimento | 1 → 1..N | sim | 09, 8–9; 13, 9; B60 |
| ET | possui | Caixa de Entrada | contenção (composição 1:1) | 1 → 1 | sim | 09, 8; 14, 9; B11 |
| Caixa de Entrada | contém | Canal | contenção | 1 → 0..N | sim | 09, 8; 14, 8–9; B35 |
| Caixa de Entrada | contém | Fila | contenção | 1 → 0..N | sim | 09, 8; 14, 8–9; B11 |
| Caixa de Entrada | contém | Conversa | contenção | 1 → 0..N | sim | 09, 8; 14, 8–9; DO-CXE-01 |
| Caixa de Entrada | configura | Prazo de reabertura / Distribuição padrão / Horário de atendimento | objeto de valor | 1 → 1 cada | sim (valor) | 14, 8; DO-CXE-04; DO-CXE-06 |
| Conversa | contém | Mensagem | contenção (composição) | 1 → 1..N (Mensagem → Conversa 1, imutável) | sim | 09, 8; 14, 9; INV-CXE-05; B68 |
| Conversa | contém | Participante | contenção (composição) | 1 → 1..N (1 `contato` principal; 0..N adicionais só em grupo) | sim | 09, 8; 14, 9; INV-CXE-06; DO-CXE-22 |
| Conversa | contém | Valor de Campo | contenção | 1 → 0..N | sim | 09, 8; 14, 9; A5.2 |
| Conversa | tem | Rascunho | objeto de valor | 1 → 0..N (um por Ator interno) | sim (valor) | 14, 8–9; B66 |
| Conversa | tem | Adiamento | objeto de valor | 1 → 0..1 (só `pendente`) | sim (valor) | 14, 9; DO-CXE-09 |
| Mensagem | contém | Anexo | contenção (componente) | 1 → 0..N | sim | 09, 8; 14, 9 |
| Anexo | referencia | Arquivo | referência | 1 → 1 (Arquivo → Anexos 0..N) | não | 09, 8; 14, 9; A8 |
| Mensagem | tem | Endereços adicionais (E-mail) / Reação / Leitura interna / Marcação de exclusão | objeto de valor | 1 → 0..N; 0..N; 0..N; 0..1 | sim (valor) | 14, 9; B67; B68 |
| Funil | contém | Etapa | contenção (composição) | 1 → 1..N (Etapa → Funil 1, imutável) | sim | 09, 8; 13, 9; INV-FUN-02 |
| Etapa | configura | Requisito de Etapa / Transições permitidas | objeto de valor | 1 → 0..N cada | sim (valor) | 13, 9; B59 |
| Funil | configura | Regras de encerramento | objeto de valor | 1 → 1 | sim (valor) | 13, 9; B59 |
| Contato | contém | Identificador de Contato | contenção | 1 → 0..N (principal ≤1 por Tipo) | sim | 09, 8; 10, 9; B13 |
| Contato | registra | Consentimento | objeto de valor (histórico só acréscimo) | 1 → 0..N | sim (valor) | 09, 8; 10, 9; B54 |
| Contato / Empresa | tem | Endereço | objeto de valor | 1 → 0..N (principal ≤1) | sim (valor) | 09, 8; 10, 9; 11, 9 |
| Contato / Empresa | guarda | Estado pré-mesclagem | objeto de valor | 1 → 0..1 (só `mesclado`) | sim (valor) | 10, 9; B14 |
| Empresa | contém | Identificador de Empresa | contenção | 1 → 0..N (principal ≤1 por tipo) | sim | 09, 8; 11, 9; B50 |
| Contato / Empresa / Negócio | contém | Valor de Campo | contenção | 1 → 0..N (um por Definição aplicável) | sim | 09, 8; 10, 9; 11, 9; 12, 9; A5 |
| Contato / Empresa / Negócio | contém | Comentário | contenção | 1 → 0..N (respostas em um nível; Conversa não recebe) | sim | 09, 8; 10, 9; 11, 9; 12, 9; B67 |
| Negócio | tem | Valor (quantia, moeda) / Probabilidade sobrescrita / Nota de encerramento | objeto de valor | 1 → 0..1 cada | sim (valor) | 12, 9; DO-NEG-04; DO-NEG-05 |
| Empresa / Negócio | anexa | Arquivo (Anexo) | referência | 1 → 0..N | não | 09, 8; 11, 9; 12, 9 |
| Contato | tem Foto | Arquivo | referência | 1 → 0..1 | não | 10, 8–9 |

### 3.2 Referências e associações do CRM

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Contato | vinculado a | Empresa (Vínculo Contato-Empresa: papel, 2 indicadores de principal, início, fim) | associação | 0..N ↔ 0..N; ≤1 vigente por par; Empresa principal ≤1 por Contato; Contato principal ≤1 por Empresa | não | 09, 8; 10, 9; 11, 8.2; B8 |
| Contato | vinculado a | Negócio (Vínculo Contato-Negócio: papel de catálogo fixo, principal) | associação | 0..N ↔ 0..N; ≤1 por par; principal ≤1 por Negócio | não | 09, 8; 12, 9; B9; DO-NEG-03 |
| Contato | `distinto de` | Contato | associação (Vínculo simétrico) | 0..N ↔ 0..N | não | 09, 8; 10, 9; DO-CON-14 |
| Contato / Empresa `mesclado` | mesclado em | Contato / Empresa sobrevivente | referência | 1 → 1 quando `mesclado`; sobrevivente → absorvidos 0..N; nunca em cadeia | não | 09, 8; 10, 9; 11, 9; B14 |
| Contato | tem | Origem / Definição de Qualificação | referência (catálogo) | 1 → 0..1 cada | não | 09, 8; 10, 9; B54; DO-EMP-09 |
| Empresa / Negócio | tem | Origem | referência (catálogo) | 1 → 0..1 | não | 09, 8; 11, 9; 12, 9; DO-EMP-09 |
| Contato / Empresa / Negócio / Conversa | tem | Tag | associação N:N | 0..N ↔ 0..N | não | 09, 8; B5 |
| Empresa | tem matriz | Empresa | referência (hierarquia estrutural sem contenção; floresta acíclica) | 1 → 0..1 (filiais 0..N derivadas) | não | 09, 8; 11, 9; B51 |
| Empresa | vinculada a | Empresa (Vínculo Empresa-Empresa: `parceira`, `concorrente`, `fornecedora de`/`cliente de`, `outro`) | associação tipada | 0..N ↔ 0..N; ≤1 por (par, tipo, direção); sem laço | não | 09, 8; 11, 8.3; B52 |
| Empresa | recebe | Sugestão de Vínculo (Contato × Empresa por domínio) | objeto de valor transitório | 1 → 0..N | não | 11, 8.5, 9; B50 |
| Negócio | referencia | Empresa | referência unilateral | 1 → 0..1 (só `ativo` ao definir); Empresa → Negócios 0..N | não | 09, 8; 12, 9; B9; RN-EMP-08/10 |
| Negócio | percorre | Funil | referência obrigatória substituível | 1 → 1; Funil → Negócios 0..N | não | 09, 8; 12, 9; 13, 9; B57 |
| Negócio | está em / terminou em | Etapa (do Funil referenciado) | referência por identidade | 1 → 1; Etapa → Negócios 0..N | não | 09, 8; 13, 9; B9; B58 |
| Negócio | consome | Requisitos, Transições e Regras de encerramento do Funil | uso de configuração | — | não | 12, 8; B59 |
| Negócio | tem | Motivo de Perda / Motivo de Ganho | referência (catálogo) | 1 → 0..1 cada | não | 09, 8; 12, 9; DO-NEG-06; RN-NEG-12 |
| Negócio | `relacionado a` | Negócio | associação (Vínculo simétrico, papel textual opcional) | 0..N ↔ 0..N (sem laço) | não | 09, 8; 12, 9; DO-NEG-19; B65 |
| Negócio | foi criado a partir de | Conversa / Contato / Empresa / Tarefa / Negócio / Integração | referência (Proveniência) | 1 → 0..1 | não | 12, 8–9 |
| Requisito de Etapa | referencia | Definição de Campo (entidade-alvo Negócio) | referência (uso) | 1 → 0..1 | não | 09, 8; 13, 9; RN-FUN-09 |
| Funil | foi copiado de | Funil | referência (Proveniência) | 1 → 0..1 | não | 13, 8; DO-FUN-14 |
| Funil / Caixa de Entrada / Canal / Fila / Etapa / Mensagem / Participante | tem Proprietário | — | proibida | 0 | — | 09, 9–10; DO-FUN-02; DO-CXE-02 |
| Conversa | é com | Contato principal | referência obrigatória | 1 → 1; Contato → Conversas 0..N | não | 09, 8; 14, 9; B12; INV-CON-11 |
| Conversa | ocorre por | Canal | referência obrigatória, imutável | 1 → 1; Canal → Conversas 0..N | não | 09, 8; 14, 9; INV-CXE-04 |
| Conversa | está em | Fila | referência mutável (transferência) | 1 → 0..1; Fila → Conversas 0..N | não | 09, 8; 14, 9; DO-CXE-01 |
| Conversa | é atribuída a | Atribuído (Membro ou Agente) | referência (responsabilidade de execução) | 1 → 0..1 | não | 09, 8; 14, 9; A7; B7 |
| Conversa | tem Empresa | Empresa (principal do Contato principal) | derivação | 1 → 0..1 (nunca gravada) | — | 14, 8.3, 9; B53 |
| Participante | referencia | Contato, Membro ou Agente | referência | 1 → 1 (identidade pelo par Conversa, sujeito) | não | 09, 8; 14, 8; Glossário |
| Mensagem | tem | Ator / ator delegante | referência | 1 → 1 / 0..1 | não | 14, 8–9; A6.2 |
| Mensagem | tem Remetente | Participante | papel (derivado do Ator) | 1 → 0..1 (vazio para Automação, Integração, Sistema) | não | 14, 9; B67 |
| Mensagem `recebida` | chegou por | Identificador de Contato | referência | 1 → 1 (Marcador após eliminação) | não | 09, 8; 14, 9; B13 |
| Mensagem | em resposta a | Mensagem (mesma Conversa) | referência | 1 → 0..1 | não | 09, 8; 14, 9; INV-CXE-10 |
| Mensagem `enviada` | usou | Mensagem de modelo (do Canal) | referência histórica | 1 → 0..1 | não | 14, 8–9; B69 |
| Canal | é de | Tipo de Canal (global) | referência imutável | 1 → 1 | não | 09, 8; 14, 9; A1.3; INV-CXE-02 |
| Canal | tem Fila padrão | Fila | referência | 1 → 0..1 | não | 09, 8; 14, 9; INV-CXE-15 |
| Canal | referencia Origem padrão | Origem | referência (catálogo) | 1 → 0..1 | não | 09, 8; 14, 8 |
| Canal | foi configurado por | Membro configurador | referência | 1 → 1 | não | 14, 12.2; B35 |
| Canal | é Canal de origem de | Identificador de Contato | referência inversa | 1 → 0..N | não | 14, 23; 10, 23; B13 |
| Fila / Canal / Caixa de Entrada | referencia Proprietário padrão de Contatos | Membro `ativo` | referência | 1 → 0..1 cada (cadeia termina no Proprietário do ET) | não | 09, 8; 14, 8–9; B55 |
| Fila | tem elegíveis | Membro, Equipe | associação | 0..N ↔ 0..N (elegíveis efetivos derivados) | não | 09, 8; 14, 9; B70 |
| Fila | é origem de permissão sobre | Conversa (elegibilidade de Fila: `ver`, `editar` nas Conversas atualmente nela e nas sem Fila) | permissão por referência operacional (derivada a cada consulta) | — | não | 14, 8; A9.1; B70 |

---

## 4. IA

Tabela-mestra do documento 15 (seção 8), revisada. O domínio IA não tem hierarquia de contêineres; as cadeias são de agregado (Agente → Versão/Execução/Memória; Coleção → Fonte/Documento → Versão → Fragmento; Sessão → Mensagem de Chat) e a Cadeia de Execuções, transitória (B79).

### 4.1 Agente

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| ET | contém | Agente | pertencimento | 1 → 1..N | sim | 15, 8–9; 17, 9; B33 |
| Agente | é de propriedade de | Membro | referência (propriedade) | 1 → 1 (Membro → Agentes 0..N) | não | 15, 8; 17, 9; A7; B7 |
| Agente | foi criado por | Membro / Sistema (nunca Agente) | referência | 1 → 1 | não | 17, 8; INV-AGE-03; B95 |
| Agente | tem | Papel (Convidado padrão; nunca Proprietário/Administrador) | referência | 1 → 1 | não | 15, 8–9; 17, 9; B30; B76 |
| Agente | contém | Versão de Agente | contenção (composição) | 1 → 1..N (imutáveis; corrente = maior número) | sim | 15, 8; 17, 9; B74 |
| Agente | contém | Execução de Agente | contenção (composição) | 1 → 0..N (Execução → Agente 1) | sim | 15, 8; 17, 9; B18 |
| Agente | contém | Memória do Agente → Item de Memória | contenção (composição) | 1 → 1 → 0..N | sim | 15, 8; 17, 9; B78 |
| Agente | configura | Política de retenção de Memória / Limite de custo | objeto de valor (não versionado) | 1 → 1 / 0..1 | sim (valor) | 17, 9; B74; B78 |
| Versão de Agente | usa | Modelo (global) ou marcador `padrão da plataforma` | referência (uso) | 1 → 1 | não | 15, 8; 17, 9; B75 |
| Versão de Agente | tem permitidas (`executar`) | Ferramenta (Catálogo) | permissão (concessão na configuração) | 1 → 0..N | não | 15, 8; 17, 9; B72 |
| Versão de Agente | registra | Habilidades concedidas (por identidade) | referência (ao conjunto de Concessões) | 1 → 0..N | não | 15, 8; 17, 8; DO-AGE-02 |
| Versão de Agente | configura | Nível de autonomia / Política de aprovação / Profundidade máxima de invocação / Admite sobrescrita de Modelo / Memória habilitada | objeto de valor | 1 → 1 cada | sim (valor) | 17, 23; B22; B74; B80 |
| Agente | tem concedidas | Habilidade (Concessão de Habilidade: Versão fixada 0..1, concedente, momento, Disponibilidade derivada) | associação N:N (contida no ET) | 0..N ↔ 0..N (Concessão eliminada por qualquer dos lados) | não | 15, 8–9; 17, 9; 18, 9; B15; B71 |
| Agente | tem acesso a | Coleção (concessão `ver` [`criar`, `editar`] gravada na Coleção) | permissão | 0..N ↔ 0..N | não | 15, 8; 17, 9; 20, 9; B97 |
| Agente | recebe concessões e compartilhamentos sobre | qualquer Recurso (como Sujeito) | permissão | 1 → 0..N (vivem no Recurso) | não | 15, 8; 17, 8; A9.1 |
| Agente | foi instanciado de | Template de Agente (da plataforma ou do ET) | referência (Proveniência) | 1 → 0..1 (sem vínculo vivo) | não | 15, 8; 17, 8–9; B81 |
| Template de Agente do ET | foi criado a partir de | Agente | referência (Proveniência) | 1 → 1 | não | 17, 8; B81 |
| Template de Agente | referencia | Habilidade (por identidade) | referência | 1 → 0..N | não | 18, 8; B81 |

### 4.2 Execução de Agente

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Execução de Agente | usa | Versão de Agente (fixa do início ao fim) | referência | 1 → 1 | não | 17, 9; B24 |
| Execução de Agente | usa | Modelo concreto (resolvido no início) | referência | 1 → 1 | não | 17, 9; B75 |
| Execução (de Agente ou de Automação) | tem | Ator invocador | referência | 1 → 1 | não | 15, 9; 17, 9; B18 |
| Execução (de Agente ou de Automação) | tem | ator delegante (Ator de qualquer tipo: Membro, Agente, Automação ou Integração; registrado em cadeia) | referência | 1 → 0..1 (vazio em Origem `Caixa de Entrada`; só o Membro entra na interseção A9.3) | não | 15, 9; 17, 9; 19, 17.3; B18; B79; DO-AUT-15 |
| Execução de Agente | tem origem em | Sessão de Chat | referência | 1 → 0..1 (Sessão → Execuções 0..N; ≤1 não terminal por Sessão) | não | 15, 8; 16, 9; B84 |
| Execução de Agente | tem | registro âncora | referência | 1 → 0..1 | não | 17, 8, 23; DO-AGE-09 |
| Execução | carrega | Cadeia de Execuções (Execução-mãe 0..1, profundidade, elementos visitados) | objeto de valor | 1 → 1 | sim (valor) | 17, 9; 19, 9; B79 |
| Execução de Agente | invoca (Ferramenta `invocar Agente`) | Execução de Agente filha (outro Agente) | invocação | 1 → 0..N (filha → pai 0..1; sem Agente repetido; profundidade ≤ Limite) | não | 15, 8; 17, 8–9; B79 |
| Execução de Agente | aciona (Ferramenta `acionar Automação`) | Execução de Automação (Gatilho `manual`) | invocação | 1 → 0..N (exige `executar`; continua a Cadeia) | não | 15, 8; 19, 8; B79; B89 |
| Execução de Agente | é filha de | Execução de Automação (mãe) | referência (contenção lógica) | 1 → 0..1 (mãe → filhas 0..N; cancelada com a mãe) | não (pertence ao Agente) | 15, 8–9; 17, 8; 19, 9; B18; B41 |
| Execução de Agente | compõe-se de | Passo (chamada de Ferramenta, Exercício de Habilidade, Solicitação, raciocínio, memorização) | objeto de valor ordenado | 1 → 0..N | sim (valor) | 15, 8; 17, 9; B73 |
| Passo (chamada de Ferramenta) | invoca | Ferramenta (duas verificações por invocação) | referência (uso) | 1 → 1 | não | 17, 23; B23; B72 |
| Exercício de Habilidade | registra | Habilidade + versão à época | referência (valor; sobrevive à eliminação) | 1 → 1 | não | 18, 9; B73 |
| Execução (de Agente ou de Automação) | contém | Solicitação de Aprovação | contenção (com identidade) | 1 → 0..N | sim | 15, 8; 17, 9; 19, 9; B80 |
| Solicitação de Aprovação | tem | aprovador designado (Membro `ativo`, resolvido na criação) | referência | 1 → 1 (sempre resolúvel) | não | 15, 9; 17, 9; B80 |
| Solicitação de Aprovação | tem | Decisão (Decisor, momento) | objeto de valor | 1 → 0..1 | sim (valor) | 17, 9; B80 |
| Execução de Agente | grava | Composição do Contexto (referências a âncora, registros lidos, Arquivos, Fragmentos, Itens de Memória, Mensagens) | objeto de valor | 1 → 1 | sim (valor) | 15, 8; 17, 8; DO-AGE-09 |
| Execução de Agente / Mensagem de Chat `assistente` | cita | Documento de Conhecimento, Versão, Fragmentos, Coleção (Referência de Conhecimento) | objeto de valor (não é Vínculo nem Proveniência) | 1 → 0..N (nunca apagada; resolve com marcador) | sim (valor) | 15, 8; 16, 9; 20, 9; B98 |
| Execução | tem | Custo | objeto de valor | 1 → 1 (nunca do Agente) | sim (valor) | 15, 8; DO-AGE-18 |
| Execução de Agente | escreve | Item de Memória do Agente (Passo de memorização) | referência (origem do Item) | 1 → 0..N | não | 17, 23; B78 |
| Execução de Agente (em nome de Membro) | alimenta / consome | Memória do Usuário (Itens) | referência | 1 → 0..N | não | 15, 8; 16, 8; B86 |
| Execução de Agente | produz | Rascunho de Conversa (o Rascunho referencia a Execução) | referência inversa | 1 → 0..1 por Conversa e Ator | não | 15, 8; 17, 8; B66 |
| Execução de Agente | produz | Mensagem de Chat `assistente` / `ferramenta` | referência inversa | 1 → 0..1 / 0..N (Mensagem → Execução 1) | não | 15, 8; 16, 9; B84 |
| Execução de Agente | tem por objeto | Tarefa / Contato / Empresa / Negócio / Conversa / Documento… | referência inversa (visão derivada no registro) | 1 → 0..N | não | 06, 9; 10, 8; 11, 8; 12, 9; 14, 8 |

### 4.3 Habilidade

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| ET | contém | Habilidade | pertencimento | 1 → 0..N (Habilidade da plataforma é global) | sim | 15, 8; 18, 9; B81 |
| Habilidade | contém | Versão de Habilidade | contenção (composição) | 1 → 1..N (`rascunho` 0..1; `publicada` 0..N; `obsoleta` 0..N) | sim | 15, 8; 18, 9; B71 |
| Habilidade | foi criada por / Versão foi publicada por | Membro / Sistema (Criador; Publicador) | referência | 1 → 1 | não | 18, 8; B71 |
| Habilidade | tem Proprietário | — | proibida | 0 | — | 15, 9; 18, 9; B71 |
| Habilidade | foi copiada de | Habilidade da plataforma | referência (Proveniência) | 1 → 0..1 | não | 18, 8; B71 |
| Versão de Habilidade | requer | Ferramenta (obrigatória ou opcional) | referência (uso) | 1 → 0..N | não | 15, 8; 18, 9; B72 |
| Versão de Habilidade | depende de | Habilidade (Dependência; Versão fixada opcional) | associação acíclica | 1 → 0..N (profundidade ≤ Limite) | não | 15, 8; 18, 9; B73 |
| Versão de Habilidade | recomenda | Coleção (declaração, não concessão) | referência | 1 → 0..N | não | 15, 8; 18, 9; DO-HAB-15 |
| Concessão de Habilidade | fixa | Versão de Habilidade `publicada` | referência | 1 → 0..1 (vazio = segue a corrente) | não | 18, 9; B71 |
| Habilidade | é exercida em | Execução de Agente (Exercício) | referência inversa | 1 → 0..N | não | 18, 8–9; B73 |
| Habilidade | é indicada por | Ação "invocar Agente" / Condição híbrida | referência inversa | 1 → 0..N | não | 18, 8–9; 19, 9; B90 |

### 4.4 Automação

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| ET | contém | Automação | pertencimento | 1 → 0..N | sim | 15, 8; 19, 9 |
| Automação | tem escopo em | ET / Espaço / Pasta / Subpasta / Lista / Funil / Caixa de Entrada / Fila | referência essencial (imutável; eliminada com o escopo) | 1 → 1 (escopo → Automações 0..N) | não (mas dependente) | 15, 8–9; 19, 9; B41; B89 |
| Automação | é de propriedade de | Membro (teto de permissões) | referência (propriedade) | 1 → 1 | não | 15, 8; 19, 9; A7; B88 |
| Automação | foi criada por | Membro | referência | 1 → 1 | não | 19, 8; B95 |
| Automação | tem | Papel (nunca Proprietário/Administrador) | referência | 1 → 0..1 | não | 15, 8–9; 19, 9; B88 |
| Automação | contém | Versão de Automação | contenção (composição) | 1 → 1..N (`rascunho` 0..1; `publicada` 0..1; `obsoleta` 0..N) | sim | 15, 8; 19, 9; B24 |
| Automação | contém | Execução de Automação | contenção (composição) | 1 → 0..N | sim | 15, 8; 19, 9; B18; DO-AUT-17 |
| Automação | foi criada a partir de | Template de contêiner / Automação | referência (Proveniência) | 1 → 0..1 | não | 19, 8; B89 |
| Versão de Automação | compõe-se de | Gatilho / Condições / Ações / Política de erro / Regra de Agendamento / Autonomia máxima imposta | objeto de valor | 1 → 1 / 0..N / 1..N (para publicar) / 1 / 0..1 / 0..1 | sim (valor) | 15, 8; 19, 9; B89; B93 |
| Versão de Automação | foi publicada por | Publicador (Membro) | referência | 1 → 0..1 | não | 19, 23; Glossário |
| Gatilho `evento` | escuta | Eventos do escopo e descendentes (por tipo) | referência por tipo | 1 → 0..N (só se a Automação tem `ver` sobre o objeto) | não | 15, 8; 19, 8; B89 |
| Condição híbrida | invoca | Agente (Habilidade indicada 0..1) | referência (uso; gera Execução filha) | 1 → 1 | não | 19, 23; B90 |
| Ação "invocar Agente" | invoca | Agente `ativo` (padrão: Assistente padrão) | referência (uso) | 1 → 1 | não | 15, 8; 19, 9; B17 |
| Ação "invocar Agente" | indica | Habilidade | referência | 1 → 0..1 | não | 15, 8; 19, 9 |
| Ação "invocar Agente" | declara | Aprovador (Membro ou Equipe) / Tempo limite / Autonomia máxima imposta | objeto de valor | 1 → 0..1 cada | sim (valor) | 19, 23; B77; B80 |
| Ação de escrita | usa | Ferramenta (Catálogo) | referência (uso) | 1 → 1 | não | 15, 8; 19, 9; B91 |
| Ação | age sobre | registro-alvo | referência | 1 → 0..N (dentro das permissões; alvo eliminado = referência inválida) | não | 19, 8; B41 |
| Ação (via Ferramenta de Integração) | chama | Integração | referência (uso) | 1 → 0..1 | não | 19, 8; B72 |
| Execução de Automação | usa | Versão de Automação (fixa) | referência | 1 → 1 | não | 19, 9; RN-AUT-08 |
| Execução de Automação | tem por objeto | objeto do Gatilho (registro ou conjunto) | referência | 1 → 0..1 (ou conjunto, em agendamento) | não | 19, 9; B92 |
| Execução de Automação | é mãe de | Execução de Agente (Condição híbrida; Ação "invocar Agente") | referência (contenção lógica) | 1 → 0..N | não (a filha pertence ao Agente) | 15, 8; 19, 9; B18 |
| Execução de Automação | compõe-se de | Passo (Condição avaliada / Ação executada com resultado) | objeto de valor | 1 → 0..N | sim (valor) | 19, 23; Glossário |
| Automação | é acionada por | Membro (com `executar`) / Agente (Ferramenta `acionar Automação`) | referência inversa (Gatilho `manual`) | 1 → 0..N | não | 15, 8; 19, 8; B89 |

### 4.5 Sessão de Chat

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Membro | contém | Sessão de Chat | pertencimento (Proprietário = Criador, imutável) | 1 → 0..N | sim | 15, 8; 16, 9; B21; B87 |
| Sessão de Chat | contém | Mensagem de Chat | contenção (composição) | 1 → 0..N (imutáveis; nunca eliminadas individualmente) | sim | 15, 8; 16, 9; B84 |
| Sessão de Chat | ancora-se a | Tarefa / Negócio / Contato / Empresa / Conversa / Documento de Conhecimento / Espaço / Pasta / Subpasta / Lista (Âncora) | referência (objeto de valor; imutável; não é Vínculo) | 1 → 0..1 (registro → Sessões 0..N) | não | 15, 8; 16, 9; B83 |
| Sessão de Chat | usa como principal | Agente | referência | 1 → 0..1 (vazio = Assistente padrão; Agente → Sessões 0..N) | não | 15, 8; 16, 9; B21 |
| Sessão de Chat | usa | Modelo escolhido (global) | referência | 1 → 0..1 (só se o Agente admite sobrescrita) | não | 15, 8; 16, 9; INV-CHT-06 |
| Sessão de Chat | configura | Configuração da Sessão (Modelo escolhido, Restrição de Ferramentas, título) | objeto de valor (só restringe) | 1 → 1 | sim (valor) | 16, 8; DO-CHT-14 |
| Sessão de Chat | é compartilhada com | Membro, Equipe (`ver`, escopo `registro`; nunca Agente; nenhum Papel) | permissão | 1 → 0..N | não | 15, 8; 16, 9; B21; DO-CHT-09 |
| Sessão de Chat | origina | Execução de Agente | referência inversa | 1 → 0..N (≤1 não terminal) | não | 15, 8; 16, 9; B84 |
| Mensagem de Chat `assistente` / `ferramenta` | é saída de | Execução de Agente | referência | 1 → 1 | não | 15, 8; 16, 9; B84 |
| Mensagem de Chat | referencia | Arquivo (enviado ou gerado) | referência | 1 → 0..N | não | 15, 8; 16, 9; B99 |
| Mensagem de Chat | substitui | Mensagem de Chat (mesma Sessão, mesmo papel) | referência | 1 → 0..1 | não | 16, 9; B84 |
| Item de Memória do Usuário | tem origem em | Sessão de Chat | referência | 1 → 0..1 (vazio se editado pelo Membro) | não | 16, 9; B86 |
| Sessão de Chat | é origem de | Rascunho / Mensagem (CRM) / Documento / Tarefa / Comentário criados por Ferramenta | referência (Proveniência no destino) | 1 → 0..N (sem vínculo vivo) | não | 16, 8; B66; B99 |

### 4.6 Conhecimento

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| ET | contém | Coleção | pertencimento | 1 → 0..N (nenhuma obrigatória) | sim | 15, 8; 20, 9; B96 |
| Coleção | é de propriedade de | Membro | referência (propriedade) | 1 → 1 | não | 15, 8; 20, 9; A7; B95 |
| Coleção | contém | Coleção | proibida | 0 | — | 15, 9; 20, 9; B96 |
| Coleção | contém | Fonte (`envio manual` 1, implícita; `URL` 0..N; `Integração` 0..N) | contenção | 1 → 1..N (Fonte → Coleção 1) | sim | 15, 8; 20, 9; B96 |
| Coleção | contém | Documento de Conhecimento | contenção (cascata de estado por derivação) | 1 → 0..N (Documento → Coleção 1) | sim | 15, 8; 20, 9; B96; DO-CNH-09 |
| Coleção | concede acesso a | Agente (`ver` [`criar`, `editar`], escopo `registro`) | permissão (gravada na Coleção) | 0..N ↔ 0..N | não | 15, 8; 20, 9; B97 |
| Coleção | configura | Política de retenção de versões / Privado | objeto de valor | 1 → 1 | sim (valor) | 20, 8; B97; B98 |
| Fonte `Integração` | referencia | Integração | referência | 1 → 1 (Integração → Fontes 0..N) | não | 15, 8; 20, 9; B96 |
| Fonte | foi configurada por | Membro configurador | referência | 1 → 0..1 | não | 20, 8; B96 |
| Documento de Conhecimento | tem Fonte | Fonte (mesma Coleção) | referência obrigatória | 1 → 1 (Fonte → Documentos 0..N) | não | 15, 8; 20, 9; B96 |
| Documento de Conhecimento | contém | Versão de Documento | contenção (composição) | 1 → 1..N (uma corrente) | sim | 15, 8; 20, 9; B98 |
| Versão de Documento | tem | Conteúdo (texto próprio e/ou Arquivo) / Origem da Versão / Estado de processamento / Representação derivada | objeto de valor | 1 → 1 / 1 / 1 / 0..N | sim (valor) | 20, 9; B98 |
| Versão de Documento | referencia | Arquivo | referência | 1 → 0..1 (Arquivo → Versões 0..N) | não | 15, 8; 20, 9; A8 |
| Versão de Documento | contém | Fragmento (só do Sistema; regenerável) | contenção derivada | 1 → 0..N (Fragmento → Versão 1) | sim | 15, 8; 20, 9; B97 |
| Documento de Conhecimento | contém | Comentário | contenção | 1 → 0..N | sim | 15, 8; 20, 9; A8 |
| Documento de Conhecimento | tem | Proveniência (obrigatória) / Metadado | objeto de valor | 1 → 1 / 0..1 | sim (valor) | 15, 8; 20, 9; B97 |
| Documento de Conhecimento | foi criado a partir de | Conversa / Sessão de Chat / Comentário / Tarefa / Documento (cópia) | referência (Proveniência; não é Vínculo Documento–Conversa) | 1 → 0..1 | não | 20, 8; B99 |
| Documento de Conhecimento | vinculado a | Tarefa / Negócio / Contato / Empresa / Documento (`relacionado a`) | associação (Vínculo) | 0..N ↔ 0..N por tipo | não | 15, 8; 20, 9; DO-CNH-07; DO-TAR-08 |
| Documento de Conhecimento | tem | Tag | proibida nesta versão | 0 | — | 20, 9; DO-CNH-06 |
| Documento, Versão, Fragmento | herdam permissão de | Coleção (único Recurso de permissão) | herança | 1 → 1 | — | 15, 8; 20, 8; B97 |
| Documento de Conhecimento | é citado por | Execução de Agente / Mensagem de Chat `assistente` (Referência de Conhecimento) | referência inversa (derivada) | 1 → 0..N | não | 20, 8–9; B98 |

---

## 5. Painéis

O Painel é entidade de visualização analítica: contém apenas configuração, nunca dados (B100); tudo o que lê é associação por referência (21, 10).

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| ET | contém | Painel | pertencimento | 1 → 0..N (nome único entre `ativo`/`arquivado`) | sim | 01, 9; 21, 9; B109 |
| Painel | é de propriedade de | Membro | referência (propriedade) | 1 → 1 | não | 21, 8–9; A7; B20 |
| Painel | foi criado por | Membro (sempre; nunca Agente ou Automação) | referência | 1 → 1 | não | 21, 8; RN-PAI-03; B107 |
| Painel | contém | Widget | contenção (composição; Identificador local) | 1 → 0..N (≤ Limite imposto) | sim | 21, 8–9; INV-PAI-03 |
| Painel | tem | Leiaute | objeto de valor | 1 → 1 (único; sem personalização por visualizador) | sim (valor) | 21, 8; Glossário |
| Painel | é ancorado a | Espaço / Pasta / Subpasta / Lista / Funil / Fila (Âncora de Painel: nome à época, validade derivada) | referência (objeto de valor; sobrevive à eliminação como `eliminada`) | 1 → 0..1 (âncora → Painéis 0..N) | não | 21, 8–9; 02, 8; 03, 8; 04, 8; 05, 8; B102 |
| Painel | foi copiado de | Painel | referência (Proveniência; sem vínculo vivo) | 1 → 0..1 | não | 21, 8–9; B108 |
| Painel | é Recurso de | Concessão direta / Compartilhamento (Membro, Equipe, Papel, Agente só `ver`; escopo `registro`) | permissão | 1 → 0..N | sim (vive no Recurso) | 21, 8–9; B20; B107 |
| Painel | consome | Localidade (fuso para Períodos; moeda como rótulo) | uso de configuração | 1 → 1 | não | 21, 8; B100 |
| Widget | tem | Fonte de Dados (entidade-alvo × escopos × inclusões) | objeto de valor de configuração | 1 → 1 (0 em `texto`) | sim (valor) | 21, 9; B101 |
| Fonte de Dados | tem entidade-alvo | Tarefa / Negócio / Contato / Empresa / Conversa / Mensagem / Execução de Agente / Execução de Automação / Solicitação de Aprovação / Registro de Atividade / Documento de Conhecimento (catálogo fechado) | referência (uso) | 1 → 1 | não | 21, 8; Glossário; B101; DO-PAI-05 |
| Fonte de Dados | tem escopo em | Lista / Pasta / Subpasta / Espaço / Funil / Fila / Canal / Caixa de Entrada / Agente / Automação / Coleção / grupo econômico / ET | referência por identidade (nunca cópia) | 1 → 1..N do mesmo tipo (ou o ET) | não | 21, 8–9; 02, 8; 05, 8; 13, 8; 14, 8; 17, 8; 19, 8; 20, 8; B101 |
| Fonte de Dados | inclui | Subtarefas / arquivados / Ensaios | objeto de valor (padrões) | 1 → 1 cada | sim (valor) | 21, 8; B106 |
| Widget | tem | Métrica / Dimensão / Filtro fixo / Período / Ordenação / Limite / Tipo de Visualização de dados | objeto de valor | 1 → 1..N (0 em lista, calendário, texto) / 0..2 / 0..N / 0..1 / … / 1 | sim (valor) | 21, 9; B101; B105 |
| Métrica | agrega | Exercício de Habilidade / Referência de Conhecimento / Cadeia de Execuções da entidade-alvo Execução (Solicitação de Aprovação é entidade-alvo própria, não derivada — B101) | derivação | — | — | 21, 23; B101; B80 |
| Widget | usa como Dimensão ou Filtro | Definição de Status (categoria) / Definição de Campo / Tag / Origem / Definição de Qualificação / Motivo / Etapa / Habilidade / Modelo | referência (uso; eliminação invalida o Widget) | 1 → 0..N | não | 21, 8; RN-PAI-20 |
| Painel | expõe em toda consulta | Momento de referência dos dados | derivação | 1 → 1 (nunca gravado) | — | 21, 8; B100 |
| Painel | é Gatilho / escopo de Automação / âncora de Sessão / Fonte de Conhecimento | — | proibida | 0 | — | 21, 8; B107 |

---

## 6. Relações transversais entre domínios

Toda relação entre domínios é associação, referência ou Proveniência; nunca contenção (A2.2). O Vínculo é explícito, tipado e bidirecional; visível só a quem vê ambos os lados; eliminar um lado remove o Vínculo, não o outro registro (A8).

### 6.1 Vínculos entre registros

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Tarefa | vinculada a | Contato | associação (Vínculo, papel textual opcional) | 0..N ↔ 0..N | não | 06, 8.2; 10, 8; DO-TAR-08 |
| Tarefa | vinculada a | Empresa | associação (Vínculo) | 0..N ↔ 0..N | não | 06, 8.2; 11, 8; DO-TAR-08 |
| Tarefa | vinculada a | Negócio | associação (Vínculo; base de "próxima atividade") | 0..N ↔ 0..N | não | 06, 8.2; 12, 9; DO-TAR-08; DO-NEG-14 |
| Tarefa | vinculada a | Conversa | associação (Vínculo) | 0..N ↔ 0..N | não | 06, 8.2; 14, 8.5; DO-TAR-08 |
| Tarefa | vinculada a | Documento de Conhecimento | associação (Vínculo) | 0..N ↔ 0..N | não | 06, 8.2; 20, 8; DO-TAR-08 |
| Conversa | vinculada a | Negócio (Vínculo Conversa-Negócio, papel textual opcional; não transfere Atribuído, Fila nem permissão) | associação | 0..N ↔ 0..N | não | 09, 8; 12, 9; 14, 8.4; DO-NEG-13 |
| Negócio | vinculado a | Documento de Conhecimento | associação (Vínculo) | 0..N ↔ 0..N | não | 09, 8; 12, 9; 20, 8; B19 |
| Contato / Empresa | vinculado a | Documento de Conhecimento | associação (Vínculo) | 0..N ↔ 0..N | não | 20, 8; DO-CNH-07; B99 |
| Conversa | vinculada a | Empresa / Conversa / Documento | proibida | 0 | — | B53; C24; B99 |
| Espaço / Pasta / Subpasta / Lista | é lado de | Vínculo | proibida nesta versão | 0 | — | 02, 8; 03, 8; 05, 23; C16 |
| Painel / Sessão de Chat | é lado de | Vínculo | proibida | 0 | — | 21, 8; 16, 8 |

### 6.2 Tarefa e Conversa criadas a partir de outros domínios

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Tarefa | foi criada a partir de | Conversa (com Vínculo automático; texto de Mensagem copiado, não referenciado) | referência (Proveniência) | 1 → 0..1 | não | 14, 8.5; A8 |
| Negócio | foi criado a partir de | Conversa (no Funil padrão; Contato principal vinculado; Empresa derivada sugerida) | referência (Proveniência + Vínculo) | 1 → 0..1 | não | 14, 8.4; 12, 8 |
| Documento de Conhecimento | foi criado a partir de | Conversa / Sessão / Comentário / Tarefa (ato "adicionar ao Conhecimento", mesmo Arquivo) | referência (Proveniência) | 1 → 0..1 | não | 20, 8; B99 |
| Registro criado por IA (Tarefa, Documento, Mensagem, Comentário, Negócio…) | tem Proveniência a | Sessão de Chat / Execução / Automação | referência (Proveniência; Criador = Agente ou Automação, com delegante) | 1 → 0..1 | não | 15, 8; 16, 8; 19, 8; B91 |

### 6.3 Agente e Automação como Atores nos outros domínios

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Agente | é Responsável por | Tarefa (exige `ver`) | associação (referência inversa) | 1 → 0..N | não | 06, 8; 15, 8; 17, 9; B7 |
| Agente | é Atribuído a | Conversa (nunca por rodízio ou menor carga) | associação (referência inversa) | 1 → 0..N | não | 14, 8.6; 15, 8; 17, 9; B7; RN-CXE-12 |
| Caixa de Entrada | invoca | Agente Atribuído (a cada Mensagem `recebida`; Origem `Caixa de Entrada`; sem delegante) | invocação | 1 → 0..N Execuções | não | 14, 8.6; 17, 23; B18 |
| Agente | é Responsável de Item de Checklist / Proprietário / Observador / Registrador de Tempo | — | proibida | 0 | — | B48; B7; B42; Glossário |
| Agente (por Ferramenta) | cria, lê, edita registros de | Tarefa / Contato / Empresa / Negócio / Conversa / Mensagem / Documento / Coleção / Painel (só `ver`) | invocação (permissão requerida no registro-alvo; classe de efeito) | — | não | 14, 8.6; B19; B72; B95; B99; B107 |
| Agente | cria ou reconfigura | Agente / Habilidade / Automação | proibida | 0 | — | B95 |
| Automação | tem escopo em | ET / Espaço / Pasta / Subpasta / Lista / Funil / Caixa de Entrada / Fila | referência essencial | 1 → 1 | não | 02, 9; 03, 9; 04, 9; 05, 9; 13, 9; 14, 9; B41 |
| Automação (Ação) | age sobre | registros de todos os domínios (dentro das permissões próprias ∩ Proprietário) | referência | 1 → 0..N | não | 19, 8; B41; B88 |
| Automação | cria | Sessão de Chat / Painel | proibida | 0 | — | B85; B107 |
| Sessão de Chat | é origem de Gatilho / é Fonte de Dados | — | proibida | 0 | — | B85 |
| Sessão de Chat | ancora-se a | registro do catálogo de âncoras (Tarefa, Negócio, Contato, Empresa, Conversa, Documento, Espaço, Pasta, Subpasta, Lista) | referência (Âncora; o registro não conhece a Sessão) | 1 → 0..1 | não | 02, 8; 03, 8; 06, 8; 10, 8; 11, 8; 12, 9; 14, 8; 20, 8; B83 |
| Sessão de Chat ancorada em Conversa | produz | Rascunho (nunca envia) | referência (por Execução) | 1 → 0..1 por Conversa e Ator | não | 14, 8.6; B66 |
| Painel (Widget) | tem Fonte de Dados em | Espaço / Pasta / Subpasta / Lista / Funil / Fila / Canal / Caixa / Agente / Automação / Coleção / grupo econômico / ET | referência (o escopo não conhece o Widget) | 0..N ↔ 0..N | não | seção 5; 02, 9; 04, 9; 05, 9; 11, 8; 13, 9; 14, 8; 17, 8; 19, 8; 20, 8 |
| Painel | é ancorado a | Espaço / Pasta / Subpasta / Lista / Funil / Fila | referência (Âncora de Painel) | 1 → 0..1 | não | 02, 8; 03, 8; 04, 8; 05, 8; B102 |

### 6.4 Catálogos, Arquivos, Membro e auditoria

| Origem | Relação | Destino | Tipo | Cardinalidade (origem→destino) | Propriedade? | Fonte (doc/decisão) |
| --- | --- | --- | --- | --- | --- | --- |
| Tag (ET) | aplica-se a | Tarefa / Contato / Empresa / Negócio / Conversa (restrição de tipo opcional) | associação N:N | 0..N ↔ 0..N | não | 06, 9; 09, 8; B5 |
| Definição de Campo (ET, por entidade-alvo) | aplica-se a | Contato / Empresa / Negócio / Conversa (Valores de Campo) | referência (uso de configuração) | 1 → 0..N | não | 09, 8; 11, 8; 12, 8; A5.2 |
| Definição de Campo (contêiner) | aplica-se a | Tarefa (Valores de Campo nos descendentes) | herança (acumulação) | 1 → 0..N | não | 05, 8; 06, 9; A5.2; B25 |
| Definição de Campo | remoção elimina/arquiva | Valores de Campo | contenção invertida (A5.4) | 1 → 0..N | — | A5.4; B37 |
| Arquivo (ET) | é referenciado por | Tarefa (Anexo) / Mensagem (Anexo) / Comentário / Empresa / Negócio / Contato (Foto) / Mensagem de Chat / Versão de Documento / Execução | referência inversa | 1 → 0..N (eliminado só sem referências) | não | A8; 06, 9; 10, 8; 14, 9; 16, 9; 20, 9 |
| Membro | é Proprietário de | ET / Contato / Empresa / Negócio / Agente / Automação / Painel / Coleção / Sessão de Chat | referência (propriedade; sucedida em B28, salvo Sessão) | 1 → 0..N cada | não | A7; B28; B87 |
| Membro | é Responsável / Observador / Atribuído / Responsável de Item / elegível de Fila / aprovador / Membro configurador / Publicador | referência ou associação | 1 → 0..N cada | não | A7; 06, 8; 08, 8; 14, 8; B35; B71; B80 |
| Membro | é Criador de | qualquer registro | referência (imutável; Membro `removido` preserva autoria) | 1 → 0..N | não | A6.4; A7 |
| Registro de Atividade | tem como objeto | qualquer entidade com identidade (título/nome à época preservado após eliminação) | referência inversa | 1 → 1 | não | A6.2; INV-ET-12; 09, 8 |
| Registro de Atividade (transição de Etapa) | grava | Etapa de origem e destino por identidade, nome e Ordem à época | objeto de valor | 1 → 1 | sim (valor) | 12, 8.2; B62 |
| Linha do tempo (Contato / Empresa / Negócio) | agrega | Registros de Atividade + Conversas + Negócios + Tarefas + Comentários relacionados (filtrada por `ver`) | derivação | — | — | 10, 8.1; 11, 8.4; 12, 8.2; Glossário |
| Menção (em Comentário, descrição, Mensagem de Chat) | referencia | Contato / Negócio / Documento | referência inversa (não cria Vínculo nem permissão) | — | não | 10, 8; 12, 8; 20, 8; DO-TAR-19 |

---

## 7. Tabela de propriedade

Termos de A7, um sentido cada. **Proprietário** = Membro humano que responde pela governança; exatamente um em todo instante quando o conceito se aplica; tem `administrar` por propriedade (A9.1). **Criador** = Ator, imutável, toda entidade com identidade. **Responsável** = executa Tarefa; **Atribuído** = conduz Conversa.

| Entidade | Proprietário | Criador | Responsável | Atribuído | Outros papéis de responsabilidade | Sucessão (B28) | Fonte |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Espaço de Trabalho | 1 Membro (Proprietário do ET, Papel de sistema) | primeiro Membro | — | — | Administradores (Papel) | transferência atômica (B26); nunca sucedido por remoção | 01, 9–10; A7; B26 |
| Membro | — | Administrador/Proprietário (convite) | — | — | Sucessor (0..1, no removido) | — | 01, 12.3; B27; B28 |
| Espaço / Pasta / Subpasta / Lista | **nenhum** | Ator | — | — | Administrador de Espaço (concessão `administrar`, `subárvore`); privado: ≥1 Membro `ativo` com `administrar` | só a concessão `administrar` de contêiner privado (B38d) | 02–05, 10; B45; B38 |
| Tarefa / Subtarefa | **nenhum** | Ator | 0..N (Membro ou Agente) | — | Observador 0..N (Membro) | Responsável liberado | 06, 10; 07, 10; A7; B7 |
| Checklist / Item de Checklist | nenhum | (da Tarefa) | Item: 0..1 Membro (nunca Agente) | — | Ator que concluiu (0..1) | Responsável liberado | 08, 10; B48 |
| Registro de Tempo | (pertence ao Membro) | Membro | — | — | — | — | B42 |
| Contato | 1 Membro | Ator | — | — | — | sim | 10, 10; A7; DO-CON-07 |
| Empresa | 1 Membro | Ator | — | — | — | sim | 11, 10; A7 |
| Negócio | 1 Membro (sempre com `ver` — B63) | Ator | **nenhum** (trabalho é Tarefa vinculada) | — | — | sim | 12, 10; A7; B9; B63 |
| Funil / Etapa | **nenhum** | Membro | — | — | `administrar` concedível a Membros e Equipes | só `administrar` de Funil privado (B38d) | 13, 10; B57; B61 |
| Caixa de Entrada | **nenhum** | Sistema (com o ET) | — | — | governança por Papel | — | 14, 10; DO-CXE-02 |
| Canal | **nenhum** | Administrador | — | — | Membro configurador | — | 14, 10; B35 |
| Fila | **nenhum** | Administrador/Proprietário do ET | — | — | elegíveis (Membros, Equipes); `administrar` concedível | — | 14, 10; B70 |
| Conversa | **nenhum** | Ator (Canal, Membro, Agente, Automação) | — | 0..1 (Membro ou Agente) | Participantes | Atribuído liberado | 14, 10; A7; B7 |
| Mensagem / Participante | nenhum | Ator (Mensagem) | — | — | Remetente (papel) | — | 14, 9; B67 |
| Agente | 1 Membro (Assistente padrão: o Proprietário do ET) | Membro / Sistema | — | — | Papel (Convidado padrão) | sim | 17, 10; A7; B33; B76 |
| Versão / Execução / Memória / Item de Memória do Agente | nenhum (do Agente) | Ator (Execução: invocador) | — | — | delegante 0..1 | — | 17, 10; B18 |
| Solicitação de Aprovação | nenhum | solicitante (Agente/Automação) | — | — | aprovador (Membro `ativo`) e Decisor | aprovador sucedido | B80; B28 |
| Habilidade / Versão de Habilidade | **nenhum** | Membro / Sistema | — | — | Publicador por Versão | não entra | 18, 10; B71 |
| Concessão de Habilidade | nenhum (do ET) | concedente (Membro) | — | — | — | — | B15 |
| Automação | 1 Membro (**teto** de permissões) | Membro | — | — | Papel 0..1; Publicador por Versão | sim; continua `ativo` sob o teto do Sucessor | 19, 10; A7; B88 |
| Versão / Execução de Automação | nenhum (da Automação) | Ator invocador (Execução) | — | — | delegante (Proprietário, Membro ou Agente acionador; Automação para as filhas) | — | 19, 17.3; B18 |
| Sessão de Chat | 1 Membro = Criador, imutável | Membro | — | — | compartilhados (Membro, Equipe) | **nunca**: à lixeira com o Membro removido (B87) | 16, 10; B21; B87 |
| Mensagem de Chat | nenhum (da Sessão) | autor (Membro, Agente) | — | — | — | — | 16, 23; B84 |
| Memória do Usuário | nenhum (do Membro) | Membro / Ferramenta `lembrar` | — | — | — | **nunca** (B86) | B86; B87 |
| Coleção | 1 Membro | Ator (Agente só por Ferramenta em nome de Membro, que se torna Proprietário) | — | — | Agentes com concessão | sim | 20, 10; A7; B95; B97 |
| Fonte | nenhum | Membro | — | — | Membro configurador (0..1; sem sucessão) | — | 20, 10; B96 |
| Documento / Versão / Fragmento | **nenhum** (governança da Coleção) | Ator (Documento) | — | — | — | — | 20, 10; B97 |
| Painel | 1 Membro | Membro (nunca Agente) | — | — | concessão `administrar` (co-gestão, não transfere) | sim | 21, 10; A7; B20 |
| Widget | nenhum (do Painel) | — | — | — | — | — | 21, 9 |
| Integração | **nenhum** | Administrador | — | — | Membro configurador | — | B35 |
| Equipe / Papel / Tag / Template / catálogos | nenhum (do ET) | Ator | — | — | governança por Papel | — | 01, 10; B34 |
| Usuário / Modelo / Tipos globais / Habilidade, Ferramenta e Template da plataforma | nenhum (globais) | plataforma | — | — | — | — | A1.3; B81 |

---

## 8. Tabela de contenção e cascata

Para cada relação de contenção: o que acontece ao destino quando a origem vai à lixeira, é eliminada permanentemente e é restaurada. Na Estrutura de Trabalho e em Coleção → Documento vale o estado próprio/efetivo (B36; B43; DO-CNH-09): arquivar ou excluir o contêiner **não grava** estado nos descendentes; restaurar devolve o Estado próprio anterior à exclusão.

| Contêiner → contido | Lixeira / arquivamento da origem | Eliminação permanente da origem | Restauração da origem | Fonte |
| --- | --- | --- | --- | --- |
| ET → tudo (Membros, Estrutura, CRM, IA, Painéis, Arquivos, Registros) | `suspenso`: nada age; Mensagens recebidas persistidas sem distribuição. `encerrado`: retenção da plataforma; só o Proprietário restaura ou exporta | elimina **tudo**, inclusive Membros e Registros de Atividade; globais intactas | `encerrado` → `ativo` pelo Proprietário dentro do prazo | 01, 12.2, 12.4; B31; B32 |
| Membro → Sessões de Chat, Memória do Usuário | Membro `removido`: o Sistema envia Sessões e Memória à lixeira; propriedades ao Sucessor; Responsável/Atribuído liberados; concessões revogadas salvo B38d | Membro nunca é apagado (A6.4); Sessões e Memória eliminadas ao fim do prazo | reconvite dentro do prazo restaura Sessões e Memória ao mesmo Membro | 01, 12.3; B28; B87 |
| ET → Espaço → Pasta → Subpasta → Lista → Tarefa → Subtarefa | estado efetivo dos descendentes derivado (`arquivado` < `na lixeira`); estado próprio não reescrito; Registros de Tempo em andamento encerrados; Automações de escopo inoperantes | elimina descendentes **independentemente do estado próprio** deles; elimina Automações de escopo (e suas Execuções); Vínculos e Dependências removidos; Widgets `inválido`; Âncoras `eliminada`; Registros permanecem | cada descendente volta ao seu estado próprio; restaurar exige pai não efetivamente `na lixeira`; Subtarefa com pai não restaurado vira raiz na mesma Lista (evento "Pai alterado") | 02–07, 12; B36; B41; B43; A3.3 |
| Contêiner → Definições de Status / de Campo / Tipos / Visualizações | seguem o contêiner (estado efetivo) | eliminadas com o contêiner; Valores de Campo das Definições eliminados (A5.4) | voltam com o contêiner | 02, 8; 05, 8; A5.4 |
| Definição de Campo → Valores de Campo | Valores órfãos por movimentação: `arquivado` no agregado da Tarefa (B37) | remove ou arquiva todos os Valores | Valores arquivados restaurados se a Definição voltar a aplicar-se | A5.4; B37 |
| Tarefa → Comentários, Checklists, Itens, Registros de Tempo, Valores, Anexos, Regra, Compartilhamento público | seguem a Tarefa (agregado); Responsáveis e Observadores preservados; Dependências e Vínculos preservados sem efeito | eliminados com a Tarefa; Arquivos permanecem (do ET); Vínculos e Dependências removidos dos dois lados | voltam com a Tarefa; quem perdeu `ver` durante a exclusão é liberado | 06, 12.3; B2; B48 |
| Contato → Identificadores, Consentimentos, Endereços, Comentários, Valores, Estado pré-mesclagem | `arquivado`/`na lixeira` **reservam** o Identificador (unicidade); Mensagem recebida devolve o Contato a `ativo` | agregado eliminado; Vínculos removidos; `mesclado` que o apontam eliminados; âncoras de Sessão limpas; Itens de Memória do Agente que o referenciam eliminados; Conversas, Negócios e Registros permanecem com Marcador; Foto eliminada se sem referências | volta ao estado anterior; Identificadores continuam resolvendo | 10, 12.5; B13; B55; B56; B78 |
| Contato / Empresa `mesclado` → sobrevivente | terminal; segue o sobrevivente | eliminado com o sobrevivente | irreversível; só restauração de cópia (registro novo com Proveniência) | B14 |
| Empresa → Identificadores, Endereços, Comentários, Valores, Anexos | lixeira rejeitada enquanto Negócio `aberto` a referencia; Identificadores reservados | eliminação adiada enquanto houver Negócio; agregado eliminado; Vínculos removidos; hierarquia matriz/filial: filiais **não** são afetadas (sem contenção) | volta ao estado anterior | 11, 8, 23; B50; B51; RN-EMP-10 |
| Negócio → Valores, Comentários, Valor, Anexos, face do Vínculo Contato-Negócio | `na lixeira` continua a referenciar Funil e Etapa e participa de remapeamentos (DO-NEG-09) | agregado eliminado; Vínculos removidos; Empresa, Contatos, Conversas, Tarefas permanecem | volta ao estado anterior (Identificador legível invariante) | 12, 10; B9; DO-NEG-09 |
| Funil → Etapas (+ Requisitos, Transições, Regras) | arquivar exige migrar os `aberto`; lixeira exige migrar **todos** (inclusive `na lixeira`); Automações inoperantes; Widgets vazios; Funil padrão nunca | elimina Etapas e Automações de escopo (com Execuções); Negócios já migrados; Widgets `inválido`; Registros preservam nome à época | devolve o Estado próprio anterior à exclusão (`ativo` ou `arquivado`), gravado na entrada na lixeira; nunca força `ativo` (B43; 13, 12.2) | 13, 12.2, 12.5; B43; B57; B60 |
| Funil → Etapa (remoção de Etapa) | — (Etapa sem estado nem lixeira) | remapeamento obrigatório no mesmo ato de todo Negócio que a referencia, em qualquer situação e estado; definitiva | — | 13, 12.3; B58; B62 |
| Caixa de Entrada → Canais, Filas, Conversas | Caixa nunca é arquivada ou excluída (segue o ET) | eliminada só com o ET, levando Canais, Filas, Conversas, Mensagens, Participantes e Anexos | — | 14, 12.1; B11 |
| Canal → (Conversas que o referenciam) | `arquivado` exige `desconectada`; Conversas não resolvidas permanecem; sem `na lixeira` | só `arquivado` **sem Conversas**; Identificadores perdem o Canal de origem | reconexão com a mesma conta | 14, 12.2; DO-CXE-03 |
| Fila → (Conversas que a referenciam) | arquivar/excluir rejeitado com Conversas não resolvidas salvo transferência no mesmo ato; Canais perdem a Fila padrão; Automações inoperantes | Conversas `resolvida` ficam sem Fila; Automações de escopo eliminadas; nome à época nos Registros | devolve o Estado próprio anterior à exclusão (`ativo` ou `arquivado`) — B43; renomear se colidir | 14, 12.3; B41; B43; DO-CXE-16 |
| Conversa → Mensagens, Participantes, Valores, Anexos, Rascunhos, Adiamento | só Conversa `resolvida` vai à lixeira; sem `arquivado` | elimina Mensagens, Participantes, Anexos (referências); Arquivos permanecem; Vínculos removidos; âncoras de Sessão `eliminada` | devolve `resolvida` | 14, 12.4–12.6; DO-CXE-03; B68 |
| Mensagem → Anexos, objetos de valor | nunca movida nem eliminada individualmente; Marcação de exclusão (terminal); anonimização com o Contato (B56) | só com a Conversa | — | 14, 12.5; B68 |
| Agente → Versões, Execuções, Memória, Itens, Solicitações | `arquivado`/`na lixeira`: libera Responsável e Atribuído no ato; Execuções em curso terminam; Sessões com ele como principal ficam "indisponível"; Automações que o invocam falham; Concessões preservadas (`indisponível`); Assistente padrão: impossível | elimina Versões, Memória, Execuções (com Passos e Solicitações); remove Concessões de Habilidade e concessões em que é Sujeito; Registros, Referências de Conhecimento, Rascunhos e Proveniências permanecem com "Agente eliminado"; Execuções de Automação mães mantêm a referência como valor | devolve `pausado` (nunca `ativo`); responsabilidades **não** retornam; `rascunho`/`arquivado` como estavam | 17, 12.4–12.5; B41; B94 |
| Automação → Versões, Execuções, Solicitações | `pausado`: só novas disparadas bloqueadas. `arquivado`/`na lixeira`: Execuções não terminais `cancelada`; Solicitações pendentes canceladas. Escopo não efetivamente `ativo`: inoperante | por prazo, antecipada, **em cascata do escopo** ou do ET: elimina Versões e Execuções; Registros de Atividade e efeitos permanecem; Execuções de Agente filhas permanecem (do Agente) com a mãe como valor; "acionar Automação" de outras passa a referência inválida | devolve `pausado` (nunca `ativo`); colisão de nome no escopo rejeitada | 19, 12.3–12.4; B41; B94; DO-AUT-17 |
| Execução de Automação → Execuções de Agente filhas (contenção lógica) | cancelar a mãe cancela as filhas | filhas permanecem (pertencem ao Agente), com a referência à mãe como valor | — | B18; B41; INV-AUT-09 |
| Execução (de Agente ou de Automação) → Passos, Solicitações, Custo, Composição do Contexto, Referências | estados terminais imutáveis; retenção da plataforma (C28) | eliminada com o Agente ou a Automação; Registros de Atividade e efeitos permanecem | "tentar de novo" é Execução nova | B18; C28 |
| Sessão de Chat → Mensagens de Chat, Âncora, Configuração, Compartilhamentos | arquivar: Execução em andamento termina; somente leitura. Lixeira: Execução `cancelada`; Solicitações pendentes canceladas; compartilhamentos suspensos | elimina Sessão, Mensagens, Âncora, Configuração, Compartilhamentos; preserva Arquivos (do ET), Execuções (do Agente, origem como valor), Registros, Itens de Memória, Proveniências e Solicitações decididas; não desfaz ações | devolve o Estado próprio anterior à exclusão; compartilhamentos reativados | 16, 12.3–12.4; B84; B87 |
| Membro → Memória do Usuário → Itens | com o Membro removido: lixeira (B87) | eliminada ao fim do prazo; nunca sucedida | reconvite | B86; B87 |
| Coleção → Fontes, Documentos → Versões → Fragmentos; Comentários | arquivar pausa Fontes (Sistema) e retira a Coleção das consultas de Agentes no ato; lixeira também oculta Vínculos dos Documentos; Documentos com estado efetivo derivado (DO-CNH-09) | elimina Fontes, Documentos e agregados, Vínculos e concessões; revoga concessões de Agentes com evento; Referências de Conhecimento resolvem com marcador; Registros permanecem | devolve o Estado próprio anterior à exclusão (B43) e reativa as Fontes pausadas pelo Sistema; Documento só restaura se a Coleção não estiver efetivamente `na lixeira` | 20, 12.5; B96; B97; B98; DO-CNH-09 |
| Fonte `URL`/`Integração` → Documentos (referência obrigatória) | Fonte não tem lixeira (estado operacional); Atualização que não encontra o Documento **arquiva** (nunca lixeira/eliminação) | eliminar Fonte com Documentos exige escolha explícita: passar a `envio manual` ou enviar à lixeira | — | 20, 12.4–12.5; B96 |
| Documento → Versões, Representações, Fragmentos, Comentários, Metadado, Proveniência | Fragmentos de Documento não efetivamente `ativo` nunca entram em Contexto | elimina o agregado; remove Vínculos; limpa âncoras de Sessão; Referências guardam identificador e título à época; Arquivo permanece se referenciado por outro registro | Estado próprio anterior à exclusão | 20, 12.5; B97; B98 |
| Painel → Widgets, Leiaute, Âncora | arquivar não congela números; some da navegação da Âncora; compartilhamentos preservados; oculto na lixeira salvo `excluir` | elimina Widgets, Leiaute, Âncora, concessões e compartilhamentos; nada do que o Painel lia é afetado; cópias mantêm a Proveniência | devolve `ativo` ou `arquivado` (B43 por analogia); Âncora e Fontes reavaliadas | 21, 12.3, 12.5; B100; B108 |
| Registro âncora / escopo de Fonte → Painel (não contenção) | Âncora `arquivada`/`indisponível`; Fonte `arquivada`/`indisponível` | Âncora `eliminada` como valor; Widgets `inválido`; **o Painel permanece** (exceção deliberada a B41) | validade revalidada sem ato | 21, 12.4, 12.6; B102 |
| Registro âncora → Sessão de Chat (não contenção) | âncora `indisponível` | âncora `eliminada`; **a Sessão permanece** | validade reavaliada a cada Execução | 16, 12.4; B83 |

---

## 9. Invariantes de relação

Uma linha por invariante que as relações desta matriz exigem em todo estado válido.

| # | Invariante | Fonte |
| --- | --- | --- |
| 1 | Toda entidade corporativa pertence, direta ou transitivamente, a exatamente um Espaço de Trabalho; nenhuma aresta atravessa a fronteira do Espaço de Trabalho. | A1.1; A1.2; INV-ET-07 |
| 2 | Todo filho estrutural (Espaço, Pasta, Subpasta, Lista, Tarefa raiz) tem exatamente um pai; a profundidade de agrupamento abaixo de Espaço é no máximo dois (Pasta → Subpasta); Subpasta não contém Subpasta. | A3.2; A3.3; A3.4; B3 |
| 3 | Toda Tarefa raiz pertence a exatamente uma Lista; toda Subtarefa está na Lista da sua raiz, tem exatamente um pai e nível ≤ Profundidade máxima de Subtarefas (salvo árvore legada congelada). | B1; B4; INV-TAR-02; INV-TAR-03; DO-STA-07 |
| 4 | O estado efetivo de uma entidade em cadeia de contenção (Estrutura de Trabalho; Coleção → Documento) é o mais restritivo entre o estado próprio e o efetivo dos ancestrais; cascata nunca reescreve estado próprio. | B36; DO-CNH-09 |
| 5 | Nome de contêiner estrutural é único entre irmãos `ativo`/`arquivado`; nome de Definição de Campo é único no caminho efetivo; nome de Funil, Agente, Habilidade, Coleção, Automação (no escopo) e Painel é único entre `ativo`/`arquivado` do Espaço de Trabalho. | B39; B44; B109 |
| 6 | O grafo de Dependências entre Tarefas é acíclico; nenhuma Dependência liga uma Tarefa a si mesma nem a ancestral ou descendente. | INV-TAR-09; 06, 8.3 |
| 7 | Exatamente um Proprietário (Membro `ativo` ou `suspenso`) em todo instante para Espaço de Trabalho, Contato, Empresa, Negócio, Agente, Automação, Painel, Coleção e Sessão de Chat; o Proprietário é sempre humano; a remoção do Proprietário é sucessão no mesmo ato (salvo Sessão de Chat e Memória do Usuário). | A7; B7; B26; B28; B87; INV-ET-03 |
| 8 | Contêineres estruturais, Tarefa, Funil, Caixa de Entrada, Canal, Fila, Conversa, Habilidade, Integração, Documento, Fonte, Versão e Fragmento não têm Proprietário. | B45; B57; B11; B35; B71; B97; Glossário |
| 9 | Todo contêiner privado (Espaço, Pasta, Subpasta, Lista, Funil, Coleção) tem, em todo instante, ao menos um Membro `ativo` com `administrar` sobre ele. | B38c; B61; B97 |
| 10 | Um Membro tem exatamente um Papel; existe no máximo um Membro por (Usuário, Espaço de Trabalho); Membro nunca é apagado. | B30; B27; A6.4 |
| 11 | Um Identificador de Contato é único por (Tipo, Valor) entre Contatos não `mesclado` do Espaço de Trabalho, inclusive `arquivado` e `na lixeira`; é o único caminho de resolução de Mensagens. Identificador de Empresa nunca resolve Mensagens. | B13; B50; INV-CON-02 |
| 12 | Entre Contato e Empresa há no máximo um Vínculo vigente por par, no máximo uma Empresa principal por Contato e um Contato principal por Empresa; entre Contato e Negócio, no máximo um Vínculo por par e um Contato principal por Negócio. | B8; B9; INV-CON-04; INV-EMP-04; INV-NEG-06 |
| 13 | Todo Negócio referencia exatamente um Funil e exatamente uma Etapa desse Funil, em toda situação e estado (inclusive `na lixeira`); nenhuma operação de configuração do Funil altera um Negócio sem remapeamento registrado. | B9; B57; INV-FUN-06; DO-NEG-09 |
| 14 | Existe sempre exatamente um Funil padrão, `ativo` e nunca privado; portanto ET → Funil é 1..N. | B60; INV-FUN-08 |
| 15 | O Proprietário de um Negócio tem `ver` sobre o Negócio em todo instante, inclusive quando o Funil é privado. | B63; INV-NEG-10 |
| 16 | Toda Conversa pertence à Caixa de Entrada, é com exatamente um Contato principal e ocorre por exatamente um Canal (imutável); por (Contato, Canal) existe no máximo uma Conversa `aberta` ou `pendente` (não se aplica a Conversas de grupo); toda Conversa tem ao menos uma Mensagem e um Participante; Mensagem nunca muda de Conversa. | B11; B12; INV-CXE-03; INV-CXE-04; INV-CXE-05; INV-CXE-06; B68 |
| 17 | Fila e Canal não contêm Conversas: a Conversa os referencia; a Fila é origem de permissão por referência operacional, avaliada a cada consulta. | DO-CXE-01; B70 |
| 18 | A hierarquia matriz/filial de Empresas é uma floresta acíclica sem contenção nem herança; Vínculo Empresa-Empresa tem no máximo um por (par, tipo, direção) e nunca liga uma Empresa a si mesma. | B51; B52; INV-EMP-05 |
| 19 | Um Contato ou Empresa `mesclado` aponta para exatamente um sobrevivente não `mesclado` (nunca em cadeia) e é eliminado com ele; a mesclagem é irreversível. | B14; RN-CON-14 |
| 20 | Toda Execução de IA pertence a exatamente um Agente ou uma Automação; toda execução de IA passa por um Agente; nenhum consumo de Modelo ocorre fora de uma Execução; no máximo uma Execução não terminal por Sessão de Chat. | B17; B18; RN-IA-01; B84 |
| 21 | A Cadeia de Execuções tem profundidade ≤ Limite imposto, subsequência Agente → Agente ≤ sub-limite, nenhum Agente repetido e nenhum par (Automação, objeto) repetido; um mesmo Evento dispara cada Automação no máximo uma vez; uma Automação nunca reage a Evento de que é ator. | B79; B92; INV-AUT-06 |
| 22 | Toda Automação tem exatamente um escopo, imutável, e cada Versão exatamente um Gatilho; a Automação é eliminada com o escopo; a permissão efetiva da Automação é próprias ∩ Proprietário atual. | B41; B88; B89 |
| 23 | Concessão de Habilidade é a única origem de `executar` sobre a Habilidade para o Agente e nunca amplia permissões; toda invocação de Ferramenta passa por duas verificações independentes (Ferramenta permitida ao Agente; permissão requerida no registro-alvo); Dependências entre Habilidades são acíclicas e limitadas. | B15; B23; B72; B73; RN-HAB-12; INV-HAB-06 |
| 24 | Toda Coleção tem exatamente uma Fonte `envio manual`; todo Documento pertence a exatamente uma Coleção e tem exatamente uma Fonte da mesma Coleção e exatamente uma Versão corrente; Coleção não contém Coleção; Documento, Versão e Fragmento herdam permissão da Coleção e nunca têm permissão própria. | B96; B97; INV-CNH-02; INV-CNH-03; INV-CNH-06 |
| 25 | Toda saída de Agente baseada em Conhecimento grava Referência de Conhecimento; a Referência nunca é apagada e resolve com marcador; toda Mensagem de Chat `assistente`/`ferramenta` é saída de exatamente uma Execução de Agente; todo Documento tem Proveniência obrigatória. | B98; B84; B97; INV-CNH-05 |
| 26 | Sessão de Chat, Painel e Automação nunca contêm nem são contidos por registros de outro domínio: Âncora de Sessão, Âncora de Painel e escopo de Automação são referências; as duas Âncoras sobrevivem à eliminação do registro âncora como valor; o escopo não. | A2.2; B41; B83; B102; INV-PAI-09 |
| 27 | O Painel não armazena dados nem derivados; cada Widget tem exatamente uma Fonte de Dados e uma entidade-alvo do catálogo fechado; toda consulta é calculada com as permissões do visualizador e expõe o Momento de referência dos dados. | B20; B100; B101; INV-PAI-01; INV-PAI-02 |
| 28 | Vínculo, Referência de Conhecimento, Âncora, Proveniência e Registro de Atividade nunca concedem permissão; um Vínculo é visível só a quem vê ambos os lados; a eliminação de um lado remove o Vínculo e nunca o outro registro. | A8; B83; B97; B98; DO-TAR-19 |
