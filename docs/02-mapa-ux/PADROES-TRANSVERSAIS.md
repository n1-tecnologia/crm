# PADRÕES TRANSVERSAIS

Fase 2 — Mapa / Manual de UX · Versão 1.0 · 2026-09-10
Fonte de verdade: `ontologia/` v1.0. Regras de interface: `~/.claude/rules/ui-ptbr.md` e `~/.claude/rules/ux-flows.md`.

Padrões que **toda** tela obedece. Uma tela que não segue um destes padrões é um defeito, não uma variação. Cada padrão cita a regra ontológica que o obriga; quando a regra é de produto, está marcada como tal.

---

## 1. Cabeçalho de registro

Todo registro com identidade abre com o mesmo cabeçalho, nesta ordem:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Comercial › Clientes › Ativação                        ← caminho efetivo │
│                                                                          │
│ Implantar programa na Alfa            [arquivado]      ← nome + selo     │
│ OPS-1042                                               ← identificador   │
│                                                          legível         │
│ Criado por Camila Duarte · 3 de setembro                                 │
│ Proprietário: Rafael Nunes                             ← só se tem       │
│                                                                          │
│                        [ação primária] [ação secundária] [⋯]             │
└──────────────────────────────────────────────────────────────────────────┘
```

| Elemento | Regra |
| --- | --- |
| Caminho efetivo | Só para registros da Estrutura de Trabalho (Espaço › Pasta › Subpasta › Lista). Cada nó navegável, salvo nó inerte de ancestral (B38e). Registros do CRM, da IA e Painéis não têm caminho: não têm contêiner (A2.2). |
| Nome | Título da Tarefa, Nome de exibição do Contato/Empresa (derivado — RN-EMP-03, documento 10, 6), Título do Negócio, Título da Conversa, Nome do Agente/Habilidade/Automação/Coleção/Painel/Funil/Fila/Canal. |
| Selo de estado | Presente sempre que o estado não é `ativo`. Nunca no mesmo controle que Status, situação ou Etapa (regra I.1 do PRD). |
| Identificador legível | Só quando habilitado no Espaço de Trabalho, para Tarefa e Negócio, em fonte monoespaçada (Glossário; DO-NEG-02). |
| Criador | Sempre. Exibe o tipo de Ator (Membro, Agente, Automação, Integração, Sistema) e, quando houver, o ator delegante: "Assistente padrão · em nome de Camila Duarte" (A6.2). |
| Proprietário | Só nas entidades que o têm: Espaço de Trabalho, Contato, Empresa, Negócio, Agente, Automação, Painel, Coleção, Sessão de Chat (A7). **Nunca** em contêiner estrutural, Tarefa, Funil, Caixa, Canal, Fila, Conversa, Habilidade, Integração, Documento (INV 8 da matriz). Exibir "Proprietário" onde a ontologia não o prevê é erro. |
| Ação primária | A ação mais frequente da tela, uma só. |
| Menu `⋯` | Ações de ciclo de vida e governança, com as destrutivas ao fim, separadas e em cor de perigo. |

**Registro cujo estado efetivo não é `ativo`:** o cabeçalho exibe o selo, o corpo fica somente leitura e a ação primária é substituída por "Restaurar" ou "Desarquivar". Quando o estado vem de um ancestral, o cabeçalho diz de onde: "Arquivada porque a Pasta *Clientes* está arquivada" com link para o ancestral (B36). Sem isso, o usuário não descobre por que não consegue editar.

---

## 2. Selos de estado e marcadores de condição

Duas formas visuais distintas, nunca intercambiáveis.

**Selo de estado** (retangular, cor semântica, ao lado do nome) — o registro *é* aquilo:

| Selo | Onde | Fonte |
| --- | --- | --- |
| `arquivado` | Estrutura, CRM, IA, Painéis | A4.1 |
| `na lixeira` | idem, só na Lixeira | A4.1 |
| `mesclado` | Contato, Empresa | B14 |
| `rascunho` / `pausado` | Agente, Automação | B94 |
| `suspenso` / `encerrado` | Espaço de Trabalho | A4.1 |
| `pendente` / `suspenso` / `removido` | Membro | A4.1 |
| `ganho` / `perdido` | Negócio (situação) | A4.4 |
| `aberta` / `pendente` / `resolvida` | Conversa | A4.5 |
| `publicada` / `obsoleta` | Versão de Habilidade e de Automação | B71, DO-AUT-19 |

**Marcador de condição derivada** (discreto, com ícone, em linha) — o registro *está* assim agora e volta sozinho quando a causa cessa:

| Marcador | Significado | Fonte |
| --- | --- | --- |
| Vencida | Data de vencimento decorrida e categoria não terminal | documento 06, 6.1 |
| Bloqueada | Dependência `é bloqueada por` ativa em categoria não terminal | documento 06, 6.1 |
| Não identificado | Contato sem Nome nem Sobrenome | documento 10, 6 |
| Sem consentimento vigente | Para a Finalidade e o Tipo de Canal do envio | B54 |
| Desatualizado | Documento cuja Fonte está `pausado`/`com erro` ou fora do intervalo | documento 20, 6.3 |
| Inoperante | Automação `ativo` que não dispara, com motivo | documento 19, 11.1 |
| Indisponível | Agente ou Concessão de Habilidade, com motivo | B75, documento 18, 7.2 |
| Agente principal indisponível | Sessão de Chat bloqueada para novas Mensagens | DO-CHT-12 |
| Widget inválido | Com a causa exibida no lugar do gráfico | RN-PAI-20 |
| Fonte sem acesso | Widget não calculado, sem revelar o nome do escopo | B103, RN-PAI-29 |
| Parado há N dias | Negócio sem transição na Etapa atual | documento 12, 6.1 |
| Fora da janela de resposta | Conversa em que só Mensagem de modelo pode ser enviada | RN-CXE-19 |

Um marcador **nunca** substitui a ação: "Bloqueada" não desabilita o seletor de Status a menos que a Funcionalidade "impedir conclusão de Tarefa bloqueada" esteja habilitada na Lista (RN-TAR-17).

---

## 3. Ator e delegação — toda ação registrada mostra quem fez

Regra A6.2: todo Registro de Atividade tem ator e, quando houver, ator delegante. A interface exibe os dois, sempre, com a mesma composição:

```text
[avatar] Assistente padrão · em nome de Camila Duarte · há 4 minutos
```

| Tipo de Ator | Marca visual | Regra |
| --- | --- | --- |
| Membro | Avatar da pessoa | A6.1 |
| Agente | Avatar com marca distinta (nunca igual ao de pessoa) | A6.1, B7 |
| Automação | Ícone de automação com o nome da Automação | B91: "Comentário criado por Ação tem autor = a Automação" |
| Integração | Ícone da Integração; delegante = Membro configurador | documento 01, 7.4 |
| Sistema | Ícone neutro "Sistema" com a causa ("eliminação por prazo", "restaurado por Mensagem recebida") | Glossário, Sistema |

**Nunca** exibir uma ação de Agente ou Automação como se fosse do Membro: esconder o Ator real quebra A6.2 (B91). Onde há delegação, os dois nomes aparecem; onde não há (Execução com Origem `Caixa de Entrada`), só o Agente (RN-CXE-23).

---

## 4. Aba Atividade

Toda tela de registro com identidade tem a aba **Atividade**: a visão dos seus Registros de Atividade, ordenada do mais recente ao mais antigo, filtrada item a item pela permissão do visualizador.

| Regra | Fonte |
| --- | --- |
| Cada linha traz ator, ator delegante, ação, momento e — quando o atributo mudou — valor anterior e novo | A6.2, RN-TAR-23 |
| Alterações de componente (Item de Checklist, Valor de Campo) registram a **raiz do agregado** como objeto | RN-CHK-12, RN-TAR-23 |
| Transição de Etapa exibe Etapa de origem e destino **pelo nome à época** e a origem da entrada (`criação`, `avanço`, `retrocesso`, `salto`, `mudança de Funil`, `reabertura`, `remapeamento`) | B62 |
| Mensagens de sistema da Conversa ("atribuída a", "transferida para", "resolvida") são Registros de Atividade exibidos na linha do tempo, **nunca Mensagens** | DO-CXE-08 |
| Registro cujo objeto foi eliminado preserva o nome à época | INV-ET-12 |
| Membro `removido` continua a aparecer como autor histórico | A6.4 |

Na Tarefa, no Contato, na Empresa e no Negócio, a aba chama-se **Atividade**; no Contato, na Empresa e no Negócio ela é a **linha do tempo**, que além dos Registros agrega Conversas, Negócios, Tarefas e Comentários relacionados, cada item filtrado pela permissão sobre o próprio item (RN-CRM-12, RN-CON-21).

---

## 5. Seção Vínculos

Associação nunca é contenção. Toda relação associativa aparece em uma seção "Vínculos" do registro, nunca como pasta, nó de árvore ou aba de contêiner (A2.2, A8).

| Regra | Fonte |
| --- | --- |
| Um Vínculo é visível **apenas a quem vê os dois lados** | A8, RN-CRM-12, DO-TAR-08 |
| Lado `na lixeira` **oculta** o Vínculo (não o remove) | RN-TAR-15 |
| Remover um lado remove o Vínculo, nunca o outro registro | A8 |
| Vínculo nunca concede permissão | INV 28 da matriz |
| Tipos por entidade | Tarefa ↔ Contato, Empresa, Negócio, Conversa, Documento, Tarefa; Negócio ↔ Documento, Negócio (`relacionado a`); Contato ↔ Contato (`distinto de`), Empresa (com papel, principal, vigência); Empresa ↔ Empresa (tipado); Conversa ↔ Negócio, Tarefa |
| Proibições exibidas como ausência, não como erro | Conversa ↔ Empresa (B53), Conversa ↔ Conversa (C24), Conversa ↔ Documento (B99), contêiner estrutural ↔ qualquer (C16), Painel e Sessão de Chat ↔ qualquer |

**Vínculo × Valor de Campo tipo relação:** os dois coexistem e a interface os separa. Vínculo é bidirecional e tipado pela plataforma; Valor de Campo tipo relação é unilateral e pertence ao registro (documento 06, 6.3). Nunca gerar um a partir do outro.

**Menção não é Vínculo:** menção em descrição, Comentário ou Mensagem `interna` cria referência navegável e notifica Membro, Equipe ou Agente com `ver`; nunca cria Vínculo, Responsável ou permissão (RN-TAR-14, RN-CXE-22).

---

## 6. Comentários

Padrão único para Tarefa, Subtarefa, Contato, Empresa, Negócio e Documento de Conhecimento.

| Regra | Fonte |
| --- | --- |
| Autor é um **Ator**: Membro, Agente ou Automação. Comentário criado por Ação de Automação tem autor = a Automação | DO-TAR-07, B91 |
| Conteúdo rico com menções e Anexos | documento 06, 7.1 |
| Respostas em **um nível**: resposta de resposta responde ao Comentário raiz | DO-TAR-07 |
| "Resolvido" só no Comentário raiz; não altera o status da Tarefa | documento 06, 7.1 |
| Editar/excluir: o autor, ou quem tem `administrar` sobre o registro (ou sobre a Lista que contém a Tarefa) | RN-TAR-13, DO-EMP-15, DO-NEG-15 |
| Exclusão deixa marcador "Comentário excluído" e preserva o encadeamento | RN-TAR-13 |
| **Conversa não recebe Comentários** — a manifestação interna é Mensagem `interna` (nota interna) | DO-CXE-08, RN-CXE-25 |
| Comentário nunca chega ao Contato | RN-CON-04, documento 11, 7.4 |
| Comentário ≠ Descrição: a descrição é atributo, sem autor próprio, e sua edição gera Registro de Atividade | RN-TAR-09 |

---

## 7. Tags

| Regra | Fonte |
| --- | --- |
| Tags são definidas no Espaço de Trabalho, nunca em Espaço, Lista ou Funil | B5, RN-ET-13 |
| Aplicáveis a Tarefa, Contato, Empresa, Negócio e Conversa; uma Tag pode restringir os tipos | B5, RN-TAR-11 |
| **Não** aplicáveis a contêineres estruturais (C16) nem a Documento de Conhecimento — o Documento usa rótulos livres do Metadado (B5; `conhecimento.md`, 7.3 e a linha `Documento → Tag | 0 (nesta versão)` da seção 9). **DO-CNH-06 é uma proposta de alterar B5 para admiti-las; enquanto não adotada, a interface obedece a B5** — registrado em `PENDENCIAS-FRONTEND.md`, B |
| Remover a Tag do Espaço de Trabalho remove a aplicação de todos os registros | RN-TAR-11 |
| O seletor de Tags é sempre múltiplo (0..N) | B5 |

---

## 8. Campos personalizados

| Regra | Fonte |
| --- | --- |
| Distinguir **Definição** (configuração) de **Valor** (do registro) na interface: a Definição vive nas configurações; o Valor, na ficha | A5.1 |
| Definições para **Tarefa** vivem em Espaço, Pasta, Subpasta ou Lista e **acumulam** ao longo do caminho efetivo | A5.2, B25 |
| Definições para **Contato, Empresa, Negócio, Conversa** vivem no Espaço de Trabalho, por tipo de entidade | A5.2 |
| A ficha exibe a origem de cada campo ("definido em *Comercial*") quando o Valor vem de Definição de ancestral | B25 |
| Nome único no caminho efetivo — a interface rejeita a criação com colisão e diz onde o nome já existe | B44 |
| **Valor `arquivado`**: quando a Tarefa muda de caminho e a Definição deixa de se aplicar, o Valor é preservado, oculto e não editável; a ficha exibe um agrupador recolhido "Campos não aplicáveis neste caminho (3)" com os valores em cinza | B37 |
| Obrigatoriedade não impede criação derivada (conversão de Item, ocorrência de recorrência, instanciação de Template): o Valor nasce vazio e é cobrado na próxima edição | B49 |
| Tipo `fórmula` é derivado e nunca editável | documento 06, 6.3 |
| Tipo `pessoa` referencia Membro e **não** o torna Responsável | documento 06, 6.3 |

---

## 9. Cardinalidade dos controles

Regra I.1 do PRD, aplicada campo a campo. Um controle de seleção única para uma relação 0..N é um defeito.

| Controle | Cardinalidade | Registro |
| --- | --- | --- |
| Seletor único obrigatório | 1 | Lista da Tarefa; Funil e Etapa do Negócio; Canal da Conversa (imutável); Contato principal da Conversa; Papel do Membro; Coleção do Documento; Fonte do Documento; escopo da Automação (imutável); Modelo da Versão de Agente |
| Seletor único opcional | 0..1 | Empresa do Negócio; Tarefa pai; Empresa matriz; Fila da Conversa; Atribuído da Conversa; Agente principal da Sessão; Âncora da Sessão e do Painel; Qualificação; Origem; Motivo de Perda; Motivo de Ganho; Responsável de Item de Checklist; Versão fixada da Concessão |
| Seletor múltiplo | 0..N | **Responsáveis de Tarefa** (Membro ou Agente — B7); Observadores; Tags; Contatos do Negócio (com papel); Empresas do Contato (com papel); Ferramentas permitidas; Habilidades concedidas; elegíveis da Fila; escopos da Fonte de Dados; Dimensões (0..2); Filtros; Dependências |
| Proprietário | exatamente 1 Membro | Espaço de Trabalho, Contato, Empresa, Negócio, Agente, Automação, Painel, Coleção, Sessão de Chat. Sempre humano; o seletor **não lista Agentes** (B7) |
| Nunca oferecido | 0 | Proprietário de contêiner, Tarefa, Funil, Caixa, Canal, Fila, Conversa, Habilidade, Integração, Documento; Responsável de Negócio; Responsável de Item que seja Agente (B48); Status/Prioridade de contêiner (B45) |

**Responsáveis de Tarefa aceitam Agente; Responsável de Item de Checklist não** (B48). O seletor de Responsável de Item filtra Membros `ativo` com `ver` na Tarefa e nunca mostra Agentes.

---

## 10. Regras visíveis: o que a ontologia rejeita, a interface impede e explica

Toda regra bloqueante tem três estados de interface: **antes** (o controle indica a exigência), **durante** (a validação impede) e **depois** (a mensagem em pt-BR diz o que falta e o que fazer). Nunca um botão habilitado que erra ao clicar (`ux-flows.md`).

**Quando a exigência é conhecida antes do clique, o controle é desabilitado com o motivo.** A validação continua existindo no ato — como defesa contra estado obsoleto —, mas nunca como caminho esperado. Regra de decisão: se a interface já exibe o dado que reprova a ação (Progresso de Checklists, Progresso de Subtarefas, Requisito da Etapa, quantia do Valor), o controle nasce desabilitado; se o dado só é conhecido no servidor (colisão de Identificador, permissão revogada durante a espera), a validação é no ato.

| Regra | Antes | Ao tentar | Fonte |
| --- | --- | --- | --- |
| Subpasta não contém Subpasta | O botão "Nova Subpasta" **não existe** na tela de uma Subpasta | — | A3.4, RN-SUB-02 |
| "exigir Checklists concluídos" / "exigir Subtarefas concluídas" | As Definições de Status de categoria `concluído` e `fechado` aparecem **desabilitadas** no seletor, com o motivo ("3 itens de checklist abertos") | Validação no ato como defesa: rejeita sem gravar, com a mesma mensagem | RN-CHK-09, RN-TAR-18 |
| Profundidade máxima de Subtarefas | "Nova Subtarefa" desabilitado no nível máximo, com dica "Limite de 3 níveis de Subtarefa definido no Espaço de Trabalho" | Rejeitado por inteiro, sem efeito parcial | RN-STA-04 |
| Mover Pasta com Subpastas para dentro de Pasta | Destino inválido não é oferecido no seletor | "Esta Pasta contém Subpastas e não pode ficar dentro de outra Pasta. Promova ou mova as Subpastas antes." | RN-SUB-11 |
| Requisito de Etapa | A coluna de destino mostra o Requisito ao arrastar | Cartão volta à origem; diálogo nomeia o Requisito violado e oferece o caminho ("Vincular Contato") | B59, RN-FUN-07 |
| Transições permitidas | Colunas não permitidas ficam inertes durante o arraste | idem | B59 |
| Regra de encerramento "exigir valor" | O botão "Marcar como ganho" abre o diálogo que pede o valor | Confirmar desabilitado até quantia > 0 | RN-NEG-09 |
| Regra "exigir Motivo de Perda" | idem, com o catálogo de Motivos | idem | RN-NEG-09 |
| Reabrir Negócio `ganho` | Ação só visível a Papel de nível Administrador | Ausente para os demais, com explicação no `⋯` desabilitado | B9, RN-NEG-10 |
| Identificador de Contato duplicado | Verificação ao sair do campo | "Este telefone já pertence a *Marina Alves*. Você pode mesclar os Contatos ou transferir o Identificador." com as duas ações | RN-CON-11 |
| Unicidade de nome entre irmãos | Verificação ao digitar | "Já existe uma Lista chamada *Ativação* nesta Pasta." | B39 |
| Mapeamento de status obrigatório | O diálogo lista cada Definição em uso e exige destino | Confirmar desabilitado até todas mapeadas | RN-LIS-06 |
| Remapeamento de Etapa obrigatório | O diálogo lista os Negócios afetados por Etapa, inclusive `na lixeira` | idem | RN-FUN-10 |
| Enviar à lixeira Empresa com Negócio `aberto` | Ação disponível; o diálogo lista os impedimentos | "3 Negócios abertos referenciam esta Empresa. Feche, mova ou exclua antes." com links | RN-EMP-09 |
| Janela de resposta expirada | O compositor troca para o seletor de Mensagem de modelo, com aviso | Mensagem livre rejeitada antes de gravar | RN-CXE-19 |
| Consentimento ausente para `marketing` | Marcador no Contato e no compositor | Bloqueia Automação e Agente; para Membro, alerta com registro | RN-CON-16 |
| Excluir Conversa não resolvida | "Enviar à lixeira" desabilitado | "Só uma Conversa resolvida pode ir para a lixeira." | RN-CXE-33 |
| Concluir com Subtarefas/Checklists abertos | Só quando a Funcionalidade está habilitada na Lista | "Conclua as 2 Subtarefas antes." / "Há 3 itens de checklist abertos." | RN-TAR-18, RN-CHK-09 |
| Publicar Automação sem Ação | "Publicar" desabilitado | "Adicione ao menos uma Ação." | RN-AUT-07 |
| Publicar Habilidade com ciclo de Dependência | Detectado ao adicionar a Dependência | "Esta dependência criaria um ciclo." | RN-HAB-08 |
| Invocar Agente não `ativo` | Agente não aparece no seletor | Sessão informa por Mensagem `sistema` | RN-AGE-10 |
| Agente com Papel Administrador | Papéis de nível Administrador não são oferecidos ao Agente | — | INV-ET-13 |
| Privatizar contêiner por Agente ou Convidado | Ação ausente | — | B38c, RN-LIS-12 |
| Remover Proprietário do Espaço de Trabalho | "Remover" ausente para o Proprietário | "Transfira a propriedade antes de remover este Membro." | RN-ET-05 |

---

## 11. Permissões simuladas e visíveis

A sessão é simulada pela escolha do Membro (`/entrar`). Trocar de Membro muda **tudo** o que se vê, sem recarregar conceitos.

| Regra | Efeito na interface |
| --- | --- |
| Painel filtra pelas permissões do visualizador (B20) | Os números mudam ao trocar de Membro; nenhum indicador diz "há dados ocultos" (B103) |
| Referência sem acesso resolve como "sem acesso", sem nome (RN-PAI-29) | O Widget exibe "Fonte sem acesso" e não é desenhado |
| Contêiner privado oculta conteúdo inclusive de Administradores (B38a) | O nó some da árvore; o Administrador vê a via "Solicitar acesso (ato de governança)" apenas onde a plataforma o permite |
| Convidado só vê o que lhe foi compartilhado (A9.4) | A árvore mostra a Lista compartilhada com os nomes dos ancestrais inertes |
| Escopo `próprios` (B29) | "Vendedor vê só os seus Negócios": a tabela filtra sem avisar que filtrou |
| Sessão de Chat: nenhum Papel dá acesso (DO-CHT-09) | Sessão de outro Membro responde "sem acesso", mesmo ao Proprietário do Espaço de Trabalho |
| Vínculo visível só a quem vê os dois lados (A8) | O item some da seção Vínculos, sem contagem residual |
| Membro `suspenso` tem permissões efetivas vazias para ações com efeito (RN-ET-08) | Toda ação primária desabilitada, com "Sua participação está suspensa. Fale com um Administrador do Espaço de Trabalho." |

**Controle desabilitado por permissão sempre diz por quê.** "Vê mas silenciosamente não age" é defeito. Todo controle inerte por falta de permissão exibe, em pt-BR, o motivo e a origem do acesso que a pessoa tem: *"Você tem acesso de leitura a esta Lista por compartilhamento. Peça `editar` a quem administra a Lista."* A regra vale para seletores, botões, arrastar e caixas de seleção — inclusive a caixa de um Item de Checklist atribuído a quem só tem `comentar` (`PENDENCIAS-FRONTEND.md`, C19). Esconder o controle é aceitável **só** quando a própria existência do recurso é sigilosa (contêiner privado — B38a); nos demais casos, desabilitar e explicar.

**Nó inerte da árvore.** O nome de ancestral exposto apenas para navegação (B38e) é marcado com `aria-disabled`, sem cursor de link, e traz a dica *"Nome exibido apenas para navegação."* — nunca fica clicável sem resposta. O nome já está exposto por regra; a dica não revela nada a mais.

**Indicador de sessão simulada:** o avatar da barra superior mostra sempre o Membro e o Papel atuais. Trocar de Membro é ato explícito, com confirmação, porque muda o que está visível na tela em curso.

---

## 12. Confirmação de ações destrutivas e externas

Regra `ux-flows.md` + ontologia. Um único componente de confirmação em todo o produto; nunca `window.confirm`.

**Exigem confirmação com digitação do nome do registro** (irreversíveis):

| Ação | Por quê |
| --- | --- |
| Eliminar permanentemente (qualquer entidade) | Fim da existência do registro e de tudo o que ele contém (A4.1) |
| Mesclar Contatos ou Empresas | Irreversível; a única saída é restauração de cópia (B14) |
| Converter Item de Checklist em Subtarefa | Terminal, sem conversão inversa (B48) |
| Marcar exclusão de Mensagem | Objeto de valor terminal (B68) |
| Obsoletar Versão de Habilidade | Terminal (B71) |
| Encerrar Espaço de Trabalho | Retenção da plataforma, depois eliminação total (B32) |
| Remover Etapa | Exige remapeamento e é definitiva (RN-FUN-10) |
| Eliminar Fonte com Documentos | Exige escolha explícita entre manter e enviar à lixeira (RN-CNH-19) |
| **Remover Integração** | Destrói credenciais irrecuperáveis e torna inoperantes as Ferramentas que ela expõe; o diálogo enumera a cascata (Ferramentas, Canais e Automações que dependem dela) — documento 01, 7.4 |
| **Remover Item de Memória** (do Agente ou do Usuário) | Não há lixeira para Item de Memória: apagar é definitivo (B78, B86) |
| **Excluir Papel personalizado** | Exige **Papel de destino dos titulares** no mesmo ato (D14) — documento 01, 18 |

**Exigem confirmação simples** (reversíveis mas com efeito amplo):

Enviar à lixeira; arquivar contêiner com descendentes; tornar privado (com aviso do que deixa de ser visível — B38); transferir propriedade; remover Membro (com Sucessor); publicar Versão de Automação (torna a anterior `obsoleta`); pausar Agente ou Automação; revogar compartilhamento; desativar Memória do Usuário; cancelar Execução; **remover Widget** (documento 21, 12.2 — configuração sem lixeira); **remover Checklist, Item ou Subitem** (o Item concluído carrega Ator e momento — checklist.md, 12.2); **remover Dependência**; **excluir Registro de Tempo**; **revogar convite** de Membro `pendente`; **suspender Membro** (com o efeito nomeado: "perde todas as ações com efeito"); **suspender o Espaço de Trabalho** (com o efeito quantificado: "N Membros ficarão sem ações com efeito"); **revogar Concessão de Habilidade**; **descartar Rascunho de IA** (um por Ator interno — descartar é irrecuperável; alternativa aceita: aviso com [Desfazer] por 10 segundos).

**Exigem confirmação por serem externas** (saem da plataforma — classe de efeito `externa`, B72):

Enviar Mensagem a Contato; enviar Mensagem de modelo; conectar/desconectar Integração ou Canal; exportar Painel (ato registrado — RN-PAI-24); acionar Automação manualmente quando a Versão vigente contém Ação `externa`.

**Não exigem confirmação:** trocar de Membro na sessão simulada exibe confirmação por mudar o contexto visível, mas não é destrutiva — usa o mesmo componente, em variante neutra.

O diálogo de confirmação de ação destrutiva **enumera as consequências em cascata** quando existem: "Eliminar a Lista *Ativação* elimina 12 Tarefas, 4 Automações com escopo nela e as Execuções delas. Registros de Atividade e Arquivos permanecem." (tabela 8 da matriz).

---

## 13. Feedback de toda ação

| Situação | Padrão |
| --- | --- |
| Ação síncrona bem-sucedida | O estado muda na tela **e** um aviso breve confirma o que aconteceu, em pt-BR, nomeando o registro |
| Ação com efeito em cascata | O aviso quantifica: "Pasta arquivada. 3 Listas e 47 Tarefas ficaram arquivadas." (B36 — estado efetivo, não próprio) |
| Ação impedida por regra | Mensagem que diz **o que falta** e oferece o caminho, nunca só "não permitido" |
| Ação que gera Solicitação de Aprovação | Aviso "Enviado para aprovação de Rafael Nunes · vence em 72 h" com link para a Solicitação (B80) |
| Ação de Agente em curso | Indicador de Execução com estado (`executando`, `aguardando aprovação`) e botão "Cancelar" (RN-AGE-21) |
| Ação assíncrona sem retorno imediato | Estado pendente no próprio controle (desabilitado + indicador), nunca a tela "só mudando" |
| Falha | Mensagem em pt-BR com a causa e o próximo passo; nunca objeto de erro cru (`ui-ptbr.md`) |
| Envio de Mensagem com Canal desconectado | A Mensagem aparece na Conversa com status `pendente` e o aviso "O Canal está desconectado. Será enviada na reconexão, até 24 h." (B69) |
| Envio que falhou | Status `falhou` **com motivo** na própria Mensagem, e ação "Reenviar" que cria Mensagem nova (RN-CXE-18) |
| **Ação em lote ou envio de arquivo** (importação de Contatos, Atualização de Fonte, envio de Anexo) | Três estados obrigatórios: **progresso** com contagem ("312 de 2.000 linhas"), **resultado** com o balanço por desfecho ("1.847 criados · 61 tratados como atualização · 92 rejeitados") e **caminho para os rejeitados** (lista navegável com o motivo por linha). Nunca uma barra que termina sem relatório |
| **Consentimento ausente** para a Finalidade do envio | Bloqueia Automação e Agente. Para Membro: aviso antes de enviar — "*Marina Alves* não tem consentimento vigente para **marketing** neste Canal. Enviar mesmo assim ficará registrado." + [Registrar consentimento] [Enviar mesmo assim] [Cancelar] (RN-CON-16) |

Nenhuma ação da plataforma é silenciosa. As que o Sistema pratica sozinho (adiamento vencido, Contato restaurado por Mensagem, Item de Memória expirado, Documento arquivado por ausência na origem) aparecem na Atividade com Ator "Sistema" e a causa (RN-CRM-17, RN-CNH-27).

---

## 14. Estado vazio de toda coleção

Toda lista, tabela, quadro, aba e seção que pode estar vazia tem estado vazio próprio, em pt-BR, que diz **o que é** aquilo e **qual é o próximo passo**. Nunca uma área em branco.

| Coleção | Estado vazio |
| --- | --- |
| Lista sem Tarefas | "Nenhuma Tarefa nesta Lista ainda." + [Nova Tarefa] |
| Espaço sem Pastas nem Listas | "Este Espaço está vazio. Crie uma Pasta para agrupar trabalho ou uma Lista para começar." |
| Quadro de Negócios sem Negócios na Etapa | Coluna com "Nenhum Negócio nesta Etapa" — a coluna **permanece**: Etapa vazia é normal |
| Caixa de Entrada sem Conversas no filtro | "Nenhuma Conversa com estes filtros." + [Limpar filtros] |
| Contato sem Identificadores | "Este Contato não tem nenhum Identificador. Sem um telefone, e-mail ou identidade de Canal, ele não recebe nem envia Mensagens." + [Acrescentar Identificador] |
| Contato sem Consentimentos | "Nenhum consentimento registrado. Envios de finalidade *marketing* serão bloqueados." |
| Agente sem Habilidades concedidas | "Nenhuma Habilidade concedida. O Agente age apenas com as instruções, as Ferramentas permitidas e o Conhecimento a que tem acesso." (B15 — é estado válido) |
| Agente sem Execuções | "Nenhuma Execução ainda. Faça um ensaio para testar sem produzir efeitos." (B82) |
| Coleção sem Documentos | "Nenhum Documento. Envie um arquivo ou configure uma Fonte." |
| Painel sem Widgets | "Este Painel está vazio." + [Novo Widget] — a Condição de integridade é `vazio` |
| Aprovações sem pendências | "Nenhuma Solicitação de Aprovação pendente para você." |
| Lixeira vazia | "A lixeira está vazia. Registros excluídos ficam aqui por 30 dias." (prazo da Política de lixeira) |
| Sem resultado de busca | "Nada encontrado para *termo*. A busca respeita as suas permissões." |
| Widget com Fonte sem acesso | "Fonte sem acesso" — sem nome, sem contagem, sem indicação de existência (B103) |
| **Aba Painéis** de Espaço, Pasta, Subpasta, Lista, Funil ou Fila | "Nenhum Painel de contexto ancorado aqui. Um Painel é criado em Painéis e ancorado neste registro." + [Novo Painel]. Nasce vazia por regra: a plataforma não instancia Painéis (RN-PAI-03), e a aba lista **só** os que o visualizador já vê (C31) |
| Suspeitas de Duplicidade (T13) | "Nenhuma suspeita no momento. Suspeitas são calculadas a cada consulta, nunca gravadas." |
| Sugestões de Vínculo (T15) | "Nenhuma sugestão. Sugestões surgem quando o domínio do e-mail de um Contato coincide com o de uma Empresa." |
| Seções de ficha do CRM (Contato, Empresa, Negócio) | Uma frase por seção, no padrão de T16: "Nenhum Endereço." / "Nenhuma Empresa vinculada." / "Nenhum Negócio." / "Nenhuma Conversa." / "Nenhuma Tarefa vinculada." / "Nenhum Documento vinculado." / "Nenhum Contato marcado como distinto." / "Nenhum Anexo." / "Nenhum Negócio relacionado." |
| Coluna 1 da Caixa sem Filas | "Nenhuma Fila. As Conversas chegam sem Fila e ficam sem Atribuído até alguém se auto-atribuir." + [Nova Fila] |
| Automações aplicáveis (T11) | "Nenhuma Automação alcança esta Lista." |
| Ferramentas permitidas (T28) | "Nenhuma Ferramenta permitida. O Agente é puramente conversacional: responde, mas não lê nem altera registro algum." (é estado válido — documento 17, 6.2) |
| Anexos (T12) | "Nenhum Anexo." |

**Estado vazio ≠ estado sem acesso.** "Nenhum Negócio nesta Etapa" e "Fonte sem acesso" são mensagens diferentes; confundi-las revela a existência de dados que a permissão esconde.

---

## 15. Listas longas: ordenação e paginação

Nenhuma lista corta linhas em silêncio (`ux-flows.md`).

| Regra | Fonte |
| --- | --- |
| Toda coleção que cresce tem ordenação explícita e paginação ou "Mostrar mais" | `ux-flows.md` |
| O Widget `lista de registros` tem **Limite obrigatório** e o exibe: "Mostrando 20 de 143" | documento 21, 7.1 |
| Visualizações da Lista têm agrupamento por Status (categoria) e ordenação salvas na própria Visualização | A8, documento 05, 7.3 |
| Subtarefas na Visualização Lista são recolhíveis, com o Progresso de Subtarefas do pai visível | documento 06, 6.1 |
| Painéis nunca somam moedas distintas: uma série por moeda, sempre rotulada | RN-PAI-13 |
| Toda contagem exibida respeita a permissão do visualizador; não existe "e mais N ocultos" | B103 |
| **Sequência de Mensagens da Conversa** e de **Mensagens de Chat**: carregam do mais recente para trás, com [Carregar anteriores] e a data de cada bloco. Ordem fixa pela sequência — nunca reordenável, porque a ordem é a leitura | documento 14, 7.6; documento 16, 7.2 |
| **Execuções** (Agente e Automação): ordenação padrão por início, decrescente; filtro por estado; paginação | documento 17, 7.2 |
| **Auditoria**: ordenação padrão por momento, decrescente; paginação; a contagem total só é exibida quando não depende de permissão por linha | A6.2, RN-PAI-30 |

---

## 16. Lixeira e restauração

| Regra | Interface |
| --- | --- |
| Restaurar devolve o **Estado próprio anterior à exclusão** (`ativo` ou `arquivado`), nunca força `ativo` | O item da lixeira mostra "Voltará para: arquivado" antes de confirmar (B43) |
| Restaurar exige pai não efetivamente `na lixeira`; pai `arquivado` é aceito | "A Pasta que continha esta Lista está na lixeira. Restaure a Pasta antes, ou escolha outro destino." + seletor de novo pai (RN-LIS-14) |
| Subtarefa cujo pai não é restaurado no mesmo ato volta como Tarefa raiz | "Esta Subtarefa voltará como Tarefa da Lista *Ativação*, sem Tarefa pai." (RN-TAR-28) |
| Agente e Automação voltam a `pausado`, nunca a `ativo` | "O Agente voltará pausado. Revise as referências antes de ativar." (B94) |
| Conversa volta a `resolvida` | (documento 14, 11.3) |
| Contato/Empresa `mesclado` não são restauráveis | Não aparecem na lixeira; a ficha do absorvido oferece "Restaurar cópia" (B14) |
| Colisão de nome na restauração | "Já existe uma Lista *Ativação* nesta Pasta. Renomeie para restaurar." (B39) |
| Previsão de eliminação | Cada item exibe quando será eliminado |
| Eliminar antecipadamente exige `administrar` | Ação separada, em cor de perigo, com confirmação por digitação |

---

## 17. Herança de configuração

Onde a configuração é herdada (Espaço → Pasta → Subpasta → Lista), a interface torna a herança legível sem exigir que se navegue para cima.

| Elemento | Padrão |
| --- | --- |
| Modo por aspecto | Cada aspecto exibe `herdado` / `sobrescrito` / `bloqueado` com o **ponto de definição** nomeado: "Conjunto de Status — herdado de *Comercial*" (B25) |
| Aspecto que acumula | Definições de Campo, Tipos de Tarefa e Automações listam a origem por item; a Lista mostra a união do caminho (B25) |
| Aspecto que substitui | Conjunto de Status, Funcionalidades habilitadas e Visualizações padrão mostram só o vigente, com o ponto de definição (B25) |
| `bloqueado` | O controle de sobrescrita fica desabilitado com "Bloqueado em *Comercial*" (B25) |
| Bloquear com sobrescritas existentes | Rejeitado, **com a lista das sobrescritas** e um caminho para resolver cada uma (B25) |
| Desabilitar Funcionalidade | Aviso "Dados existentes são preservados e ficam somente leitura." (RN-LIS-21) |
| Herança de permissão | A tela de acesso separa "por Papel", "herdado de *Clientes*", "concessão direta" e "compartilhamento" — as quatro origens de A9.1, mais "propriedade" e "elegibilidade de Fila" onde se aplicam |

---

## 18. Versionamento (IA e Conhecimento)

| Entidade | Interface |
| --- | --- |
| Agente | Aba "Versões" com número, Ator, motivo e momento. Editar a configuração avisa: "Isto cria a versão 4, válida a partir da próxima Execução." (B74) |
| Habilidade | Rascunho editável (0..1) + Publicadas coexistentes + Obsoletas. "Publicar" valida e lista o que falta (RN-HAB-06). A Concessão escolhe "Seguir a versão corrente" ou fixa uma `publicada` (B71) |
| Automação | Rascunho (0..1) + Publicada (0..1, a vigente) + Obsoletas. Publicar avisa que obsoleta a anterior no mesmo ato (DO-AUT-19) |
| Documento de Conhecimento | Lista de Versões com Origem da Versão; só a corrente é consultável; "Restaurar Versão" cria Versão nova (RN-CNH-14) |
| Execução | Sempre exibe a versão usada, fixa do início ao fim (RN-AGE-09, RN-AUT-08) |

---

## 19. Padrões próprios da IA

| Padrão | Regra |
| --- | --- |
| Toda resposta de IA é saída de uma Execução | A Mensagem `assistente` linka para a Execução; não existe resposta sem Execução (B84) |
| Referências de Conhecimento | Toda saída baseada em Conhecimento exibe as citações (Documento, Versão, Fragmento, Coleção); citação cujo alvo sumiu resolve com marcador ("Documento na lixeira") e nunca desaparece (B98) |
| Mensagem `ferramenta` | Exibida como **registro**, não como fala: Ferramenta, resultado e resumo, com link para o Passo (DO-CHT-07) |
| Solicitação de Aprovação inline | No Chat e na Conversa, com o **objeto fixo** legível: "Enviar esta Mensagem a *Marina Alves* na Conversa X" + prazo + [Aprovar] [Recusar] (B80) |
| Ensaio | Marcado em toda a interface; escritas aparecem como `simulado`, sem efeito e sem Registro no alvo (B82) |
| Cadeia de Execuções | A Execução exibe a cadeia desde a raiz, com profundidade, para que "quem chamou quem" seja legível (B79) |
| Rascunho de IA | Aparece no compositor da Conversa como sugestão descartável, nunca na sequência de Mensagens; enviar cria Mensagem nova com o Membro como Ator (B66) |
| Nível de autonomia efetivo | Exibido na Execução, com o motivo quando foi reduzido pelo invocador (B77) |
| Memória | Memória do Agente (governada pelo Proprietário, visível por `ver`) e Memória do Usuário (só do próprio Membro) são telas distintas e nunca se misturam (B78, B86) |
| Governança de IA é humana | Não existe ação de Agente ou Automação que crie ou reconfigure Agente, Habilidade ou Automação; a interface não oferece o controle (B95) |

---

## 20. Depois de criar: para onde o usuário vai

Uma só regra, aplicada sem exceção — fluxos que mandam um caso para a lista e outro para o registro são inconsistência, não variação.

| Origem da criação | Destino | Exemplos |
| --- | --- | --- |
| **Criação em contexto** — o usuário já está na tela que contém ou origina o registro | **Permanece na tela**, o registro novo aparece em foco no lugar onde vai viver, e o aviso traz link para abri-lo | Criação rápida de Tarefa na Lista (T10); Subtarefa, Checklist, Item, Comentário, Vínculo, Anexo e Registro de Tempo na Tarefa (T12); Etapa no Funil (T20); Widget no Painel (T38); Identificador e Consentimento no Contato (T14) |
| **Criação a partir do inventário** — o usuário está numa listagem e cria um registro que tem tela própria | **Abre o registro criado**; a listagem fica atrás | Contato (T13), Empresa (T15), Negócio (T17), Funil (T19), Fila (T22), Agente (T27), Habilidade (T29), Automação (T31), Coleção (T33), Documento (T34), Painel (T37), Espaço (T05), Pasta e Lista (T06, T08) |
| **Criação derivada de outro domínio** — o registro nasce a partir de um registro de origem, com Vínculo e Proveniência | **Permanece na origem**, com aviso nomeando o registro criado, o Vínculo já feito e link para abri-lo | [Criar Tarefa a partir da Conversa] e [Criar Negócio a partir da Conversa] em T21; "adicionar ao Conhecimento" a partir de Sessão, Conversa, Comentário ou Tarefa; conversão de Item em Subtarefa (D13) |

Em todos os três casos o aviso nomeia o registro ("Negócio *Programa ocupacional — Metalúrgica Sul* criado e vinculado a esta Conversa.") e o que foi criado junto (Vínculo, Proveniência, Valores obrigatórios vazios por B49). Nenhuma criação termina sem que o usuário saiba onde o registro ficou.

---

## 21. Acessibilidade e idioma (mínimo obrigatório)

De `ui-ptbr.md`, aplicado ao vocabulário da ontologia:

- **Todo rótulo usa o termo canônico do glossário.** Proibidos os sinônimos não canônicos: *owner*, *deal*, *pipeline*, *dashboard*, *workspace*, *task*, *inbox*, *skill*, *tool*, *lead* (como entidade), *thread*, *chat* (para Conversa do CRM), *bot*, *log*, *status do negócio*, *dono*, *assignee*.
- **Estados são exibidos com o código da ontologia**, invariável em gênero: `arquivado`, `pausado`, `mesclado` valem para Automação, Sessão de Chat e Coleção sem concordância (A4.1). O texto ao redor concorda; o código não.
- Datas, horas, números e moeda formatados em pt-BR pela API `Intl` (cujo parâmetro se chama `locale`, termo da API e não da ontologia — a **Localidade** é o objeto de valor do Espaço de Trabalho que fornece fuso, moeda e idioma). **Data "dia civil" nunca recebe fuso**; "instante" é exibido no fuso da Localidade (documento 06, 6.2).
- Todo campo tem rótulo visível; ícone sozinho tem `aria-label` em pt-BR.
- Contraste mínimo 4,5:1; cor nunca é o único sinal (categoria de status, situação e estado de conversa têm rótulo além da cor).
- Foco visível e navegação por teclado em listas, quadros (arrastar tem alternativa por teclado) e no compositor da Conversa.
- Um `<h1>` por tela; `<main>`, `<nav>` e landmarks corretos.
