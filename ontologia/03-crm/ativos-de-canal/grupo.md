# GRUPO

> Domínio: CRM — Ativos de Canal | Documento 24 de 25 | Status: RASCUNHO | Versão da ontologia: 1.1-proposta | Depende de: 22, 14, 10, 19, 25

## 1. Definição ontológica

**Grupo** é o Ativo de Canal **administrado** que espelha um grupo do provedor (um grupo de WhatsApp): um lugar com nome, descrição, foto, link de convite, configurações de quem pode falar e entrar, uma capacidade máxima e um conjunto de **Participações** — a relação de cada Contato com o Grupo ao longo do tempo. A organização o administra por meio de um Canal que é administrador no provedor, e o usa para captar (por Link de Captação), comunicar (Mensagens em lote) e observar (entradas, saídas, ocupação).

Quatro propriedades:

1. **É lugar, não conversa.** O que se diz no Grupo é a Conversa de grupo (documento 14, 20.18), contida pela Caixa de Entrada; o Grupo é o que contém pessoas, link e regras. Um Grupo pode existir sem Conversa (Grupos habilitados falso no Canal) e a Conversa pode sobreviver ao Grupo arquivado. Ligam-se por referência (8).
2. **Suas pessoas são Contatos.** Todo participante conhecido é um Contato (B13: resolvido por `identidade de WhatsApp`), com uma Participação que registra entrada, saída, papel e origem. É por aqui que "lead de grupo" e "Contato do CRM" são a mesma ficha (RN-GRP-10).
3. **É espelho.** Nome, descrição, foto, configurações, participantes e link vêm do provedor e são sobrescritos pela Sincronização (22, 7.3) conforme RN-GRP-02; o que a plataforma acrescenta (Captação, Tags, Vínculos, Comentários) nunca vai ao provedor.
4. **Tem capacidade.** O provedor impõe um limite de participantes (1 024 no WhatsApp); a plataforma deriva **Ocupação** (Participações vigentes / Capacidade) e a usa nos Links de Captação (22, 7.1) e em alertas.

## 2. Propósito

1. Governar dezenas ou centenas de grupos como registros, não como abas do celular: quem administra, quantos há, quais estão cheios, qual link vale, quem entrou hoje.
2. Captar em escala com controle: Links de Captação distribuem cliques entre Grupos com vaga; cada entrada vira Contato com Participação e Origem.
3. Comunicar em lote com as regras de sempre: enviar a N Grupos é Automação com Ações que invocam `enviar Mensagem ao Grupo`, com Registro por destino e reenvio de falhas por Política de erro.
4. Proteger: regras de quem fala (Configurações do Grupo) e reação a quem fala sem poder (Automação "Guardião" — 20.8), com Consentimento revogado removendo o Contato de todos os Grupos (RN-GRP-15).
5. Medir: entradas e saídas por Grupo, ocupação, cliques por Link, tudo como Fonte de Dados de Painel.

## 3. Natureza da entidade

Entidade com identidade própria, contida pelo Espaço de Trabalho; Recurso; Fonte de Dados; escopo de Automação; âncora de Sessão de Chat e de Painel de contexto (DO-ATV-09). Raiz do agregado **Grupo → { Participação, Pedido de Entrada }**. Sem Proprietário (22, 10). Não é Ator. Referencia 0..1 Comunidade (documento 25) e 0..1 Conversa de grupo.

| Entidade interna | Natureza | Identidade |
| --- | --- | --- |
| **Participação** | entidade interna, 0..N; relação Contato × Grupo com vigência; **nunca eliminada** enquanto o Grupo existir (histórico) | própria (referenciada por Registros, Painéis, Automações) |
| **Pedido de Entrada** | entidade interna, 0..N; solicitação de um Contato para entrar em Grupo com aprovação | própria |
| **Link de convite** | objeto de valor | — |
| **Configurações do Grupo** | objeto de valor espelhado | — |
| **Captação** | objeto de valor da plataforma | — |
| **Template de Grupo** | Template (A8) do Espaço de Trabalho; instancia Grupos (15) | própria (é Template) |

## 4. Fronteira conceitual

**É**: o espelho governado de um grupo do provedor; o conjunto das Participações de Contatos nele; o alvo das Ferramentas de administração; o elegível de Links de Captação.

**Não é**: Conversa de grupo (episódio de Mensagens); Comunidade (agregado de Grupos — 25); Canal (a conta que administra); Fila (organiza Atendentes, não Contatos); Equipe (Membros, não Contatos); Lista/contêiner da Estrutura (não contém Tarefas); "pasta de grupos" (é Tag/Visualização); Campanha (DO-ATV-01); lista de transmissão (não existe como Ativo nesta versão — D17).

**Comparações**: Conversa de grupo (14) — Participante `contato` da Conversa é quem **falou**; Participação do Grupo é quem **está** (pode estar e nunca falar); as duas coexistem e a Participação é a fonte para "quantos membros" (RN-GRP-12). Empresa (11) — ambas agregam Contatos com vigência (Vínculo Contato-Empresa tem início/fim — B8); a Participação segue o mesmo padrão, mas é composição do Grupo, não Vínculo. Fila (14) — elegibilidade é de Membros; Participação é de Contatos.

## 5. Identidade

Identificador imutável, opaco, da plataforma. **Identificador externo** (JID do grupo) obrigatório, atributo, único por INV-ATV-01 entre Grupos `ativo`/`arquivado`.

**Teste de identidade.** Renomear no provedor ou na plataforma, trocar foto, regenerar link de convite, trocar o Canal administrador, entrar ou sair de uma Comunidade, mudar configurações, arquivar e restaurar: mesmo Grupo — Participações, Cliques, Vínculos, Widgets, Registros continuam a apontar para ele. Eliminar e reimportar cria outro (22, 5). O provedor pode mudar o JID? Não nesta leitura; se mudar, é caso de 20.9.

**Identidade da Participação.** Própria, imutável; um novo ingresso do mesmo Contato após saída cria **nova** Participação (histórico de vigências — B8 por analogia); no máximo uma Participação **vigente** por (Contato, Grupo) — INV-GRP-02.

## 6. Atributos fundamentais

| Atributo | Natureza | Espelhado? | Obrigatório | Descrição |
| --- | --- | --- | --- | --- |
| Atributos comuns (22, 6) | — | — | — | Identificador, ET, Tipo de Canal, Identificador externo, Nome, Canal administrador (0..1), ciclo de vida, Sincronização, Criador, Origem de criação, Proveniência, Tags, Valores de Campo, Vínculos, Comentários. |
| Nome | nativo | sim | sim | Nome do grupo no provedor (limite do provedor: 100). Divergência tratada por RN-ATV-07. |
| Descrição | nativo | sim | não | ≤ limite do provedor (2 048). |
| Foto | referência (Arquivo) | sim | não | Imagem de perfil do grupo; a plataforma guarda cópia como Arquivo. |
| Configurações do Grupo | objeto de valor | sim | sim | `somente administradores enviam` (booleano), `somente administradores editam dados`, `administradores aprovam entrada`, `somente administradores adicionam participantes`; catálogo fixo pela Capacidade do Tipo de Canal. |
| Link de convite | objeto de valor | sim | não | endereço; **estado do link** `válido`, `inválido`, `desconhecido`; momento da última validação; regenerável por Ferramenta. Ausente quando o Canal não é administrador (o provedor só entrega a administradores). |
| Papel do Canal | derivado da Sincronização | sim | — | `administrador`, `participante`, `ausente` (22, 7.3). |
| Capacidade | nativo | sim | sim | Limite de participantes do provedor (1 024) ou menor, se o provedor informar. |
| Participações | entidade interna 0..N | parcialmente (entradas e saídas vêm do provedor) | — | 7.1. |
| Ocupação | derivado | — | — | Participações vigentes / Capacidade; faixas `baixa`, `moderada`, `alta` são configuração de exibição do Espaço de Trabalho, não estado. |
| Pedidos de Entrada | entidade interna 0..N | sim | — | 7.2; só quando `administradores aprovam entrada`. |
| Comunidade | referência (Comunidade) | sim | não | 0..1; e **Papel na Comunidade** `comum` / `avisos` (25). Espelhado: vincular/desvincular é Ferramenta na Comunidade. |
| Captação | objeto de valor da plataforma | não | sim | `ativa`/`inativa` (padrão: `ativa` ao criar; `inativa` ao importar até o Membro decidir — DO-GRP-05); **Limite de cliques** (0..N; vazio = sem limite; usado pelos Links com Critério `por cliques`); **Cliques contabilizados** (derivado dos Cliques dos Links; zerável por Ferramenta `zerar cliques`, com Registro). |
| Momento da última entrada / saída | derivados | — | — | Da Participação mais recente. |
| Marcador "Canal ausente" / "sem privilégio" | derivados | — | — | Do Papel do Canal; base dos alertas "grupos sem vínculo" e "problema de permissão" do benchmark, aqui como Filtro e Evento (18). |

## 7. Entidades internas ou componentes

### 7.1 Participação

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador; Grupo | nativo; referência | sim | Imutáveis. |
| Contato | referência (Contato) | sim | Imutável. Resolvido por Identificador `identidade de WhatsApp` (B13); criado automaticamente se necessário (RN-GRP-10; padrão B55). Contato `mesclado` resolve ao sobrevivente (B14). |
| Identificador externo do participante | nativo | sim | Como o provedor identifica a pessoa no grupo (número ou identificador opaco); é o que resolve o Contato. |
| Momento de entrada | nativo | sim | Do provedor, quando entregue; senão, momento da Sincronização que a viu pela primeira vez, com marcador `estimado`. |
| Momento de saída | nativo | não | Vazio = vigente. Preenchido pelo provedor (saiu, foi removido) ou pela Sincronização que deixou de vê-la (marcador `estimado`). |
| Papel | nativo | sim | `membro`, `administrador` (espelhado; promover/rebaixar é Ferramenta). |
| Origem | nativo (catálogo fixo) | sim | `link de captação` (com referência ao Link e ao Clique quando o provedor permitir correlacionar — em geral não; então só ao Link, por janela temporal, marcado `inferido`), `link de convite`, `adicionado` (por quem — Ator, quando pela plataforma), `importado` (já estava ao importar), `desconhecida`. |
| Causa da saída | nativo | condicional | `saiu`, `removido` (por quem — Ator, quando pela plataforma), `banido pelo provedor`, `desconhecida`. |
| É o Canal | derivado | — | Verdadeiro quando o participante é o próprio Canal administrador ou outro Canal do Espaço de Trabalho (20.4). Não cria Contato (A1.4: o número da organização não é Contato — RN-GRP-11). |

A Participação **nunca é eliminada** individualmente: encerra-se. É a fonte de "entradas e saídas por período", "membros atuais", "quem entrou por qual Link" (Painéis) e dos Gatilhos "Contato entrou no Grupo" / "saiu do Grupo".

### 7.2 Pedido de Entrada

Só em Grupos com `administradores aprovam entrada`. Atributos: Identificador; Grupo; Contato (resolvido/criado como na Participação — mas com marcador `pendente de aprovação`, e a criação automática de Contato a partir de Pedido é **decisão de produto** — DO-GRP-06 recomenda criar, com Origem "pedido de entrada em Grupo"); Identificador externo do solicitante; momento; **estado** `pendente`, `aprovado`, `recusado`, `expirado` (o provedor expira); decidido por (Ator); momento da decisão; Motivo de recusa (catálogo do Espaço de Trabalho, 0..1). Aprovar/recusar são Ferramentas (22, 7.5); aprovar gera Participação com Origem `link de convite` ou `link de captação` conforme o provedor informar. Automações podem aprovar por regra (ex.: Contato com Consentimento vigente).

### 7.3 Link de convite (objeto de valor)

Endereço do provedor; estado `válido` (última validação respondeu), `inválido` (o provedor rejeitou — link revogado, Canal sem privilégio), `desconhecido` (nunca validado). Validar é `sincronizar`; regenerar é Ferramenta `regenerar Link de convite` (invalida o anterior no provedor — classe `externa`; Links de Captação passam a usar o novo automaticamente, pois referenciam o Grupo, não o endereço — RN-GRP-06).

### 7.4 Captação (objeto de valor da plataforma)

Definido em 6. `inativa` retira o Grupo de todos os Links (INV-ATV-07) sem alterar nada no provedor: "inativar a captação não sai do grupo; a gestão continua".

### 7.5 O que não é componente

Mensagens (na Conversa de grupo); "lead" (Contato + Participação); pasta; agendamento; template de grupo automático (é Template de Grupo + Automação — 15).

## 8. Relações

| Relação | Cardinalidade | Tipo | Efeito de remoção |
| --- | --- | --- | --- |
| Grupo → Participação → Contato | 0..N → 1 | composição → referência | Contato eliminado ⇒ Participação anonimizada (B56), nunca eliminada; Grupo eliminado ⇒ Participações eliminadas. |
| Grupo → Pedido de Entrada | 0..N | composição | com o Grupo. |
| Grupo → Comunidade | 0..1 | referência espelhada | Comunidade arquivada ⇒ referência mantida (é fato do provedor) com marcador; desvincular é Ferramenta. |
| Grupo ↔ Conversa de grupo (14) | 0..1 ↔ 0..1 | referência por (Identificador de grupo, Canal) — INV-GRP-05 | independentes: arquivar o Grupo não resolve a Conversa; eliminar a Conversa não afeta o Grupo. |
| Grupo → Canal administrador | 0..1 | referência mutável (22) | — |
| Link de Captação → Grupo | 0..N ↔ 0..N | referência ordenada (22, 7.1) | — |
| Automação → Grupo | 0..N | escopo; Gatilhos "Contato entrou/saiu", "Mensagem recebida no Grupo", "Grupo cheio", "Canal perdeu privilégio"; Ações = Ferramentas | B41 |
| Painel → Grupo, Participação | — | entidades-alvo (B115) | — |
| Grupo ↔ Negócio, Tarefa, Empresa | 0..N | Vínculo (B113) | remove o Vínculo. |
| Template de Grupo → Grupo | 0..N | Proveniência | — |
| Grupo → Mensagem `enviada` | derivado | via Conversa de grupo | — |

## 9. Cardinalidades

Grupo: 0..N Participações (≤ Capacidade vigentes — INV-GRP-03, salvo divergência do provedor, marcada); 0..N Pedidos; 0..1 Comunidade; 0..1 Conversa de grupo; 0..1 Canal administrador; 0..N Links em que é elegível; 0..1 Link de convite. Contato: 0..N Participações (em Grupos distintos ou no mesmo em épocas distintas); no máximo uma vigente por Grupo.

## 10. Hierarquia, pertencimento e propriedade

Contido pelo Espaço de Trabalho; sem Proprietário; Comunidade → Grupo é referência, não contenção (o provedor permite grupo sair da comunidade sem deixar de existir); Grupo → Participação é composição. `administrar` por Papel, concessão ou administração do Canal (DO-ATV-05).

## 11. Estados

**Ciclo de vida** (A4.1): `ativo`, `arquivado` (deixa de ser administrado pela plataforma; sai dos Links; Automações com escopo nele por B41; Participações congeladas na última Sincronização; a Conversa de grupo continua), `na lixeira`.

**Estado de sincronização** (22, 11) com o Papel do Canal: `administrador` habilita tudo; `participante` habilita só `sincronizar` e `sair`; `ausente` ⇒ `inacessível`.

**Estados derivados de exibição** (não gravados): Ocupação (`baixa`/`moderada`/`alta`/`cheio`), `esgotado para captação` (cliques ≥ Limite ou cheio), `link inválido`, `sem privilégio`, `Canal ausente`.

**Participação**: `vigente` (sem saída) / `encerrada`. **Pedido**: `pendente`, `aprovado`, `recusado`, `expirado`.

## 12. Ciclo de vida

### 12.1 Criação

- **Importação** (22, 12.1): o Canal lê os grupos de que participa; cria Grupos com Participações (Origem `importado`), Papel do Canal, Configurações, Link de convite (se administrador). Captação `inativa` (DO-GRP-05). Limite de Grupos por Espaço de Trabalho (Limite imposto — C33) é verificado **antes** de criar; excedente é rejeitado com contagem.
- **Criação pela plataforma**: Ferramenta `criar Grupo` (classe `externa`): Nome (com numeração opcional `#N` quando em lote), Descrição, Foto, Configurações, participantes iniciais (Contatos do CRM ou números — o provedor exige que o Canal "tenha o contato"), administradores. O provedor cria; a plataforma grava Identificador externo e Sincronização `conferido`. Criação **em lote** (N Grupos numerados) é uma Execução com N Passos, cada um criando um Grupo — sujeita ao Limite de operações por Execução (B22) e a recomendação de produto de ritmo diário (20.10). Origem `criado pela plataforma`; Captação `ativa`.
- **Por Template de Grupo** (15): idem, com Proveniência.

### 12.2 Sincronização

Aplica RN-GRP-02: espelha Nome (com RN-ATV-07), Descrição, Foto, Configurações, Link, Papel do Canal, Comunidade; **reconcilia Participações**: quem aparece e não tinha Participação vigente ganha uma (Origem `desconhecida` ou inferida de Link por janela); quem tinha vigente e sumiu é encerrada (`estimado`). Eventos do provedor em tempo real (entrou/saiu) fazem o mesmo sem esperar a rotina, com momentos exatos.

### 12.3 Transições de ciclo de vida

Como 22, 12.2. Arquivar **não sai do grupo** (RN-GRP-04). Eliminação permanente elimina Participações e Pedidos e não toca o provedor (INV-ATV-05); a Conversa de grupo permanece com o Identificador de grupo como valor.

### 12.4 Sair do Grupo

Ferramenta `sair do Grupo` (classe `externa`; **irreversível** quando o Canal é o único administrador — 20.6): o Canal deixa o grupo; Papel `ausente`; o Grupo fica `inacessível` e o produto oferece arquivar. Nunca automática por arquivamento.

## 13. Regras de negócio ontológicas

- **RN-GRP-01** Grupo só existe para Tipo de Canal com Capacidade "grupos administráveis" (RN-ATV-01).
- **RN-GRP-02** São espelhados e sobrescritos pela Sincronização: Nome (sob RN-ATV-07), Descrição, Foto, Configurações, Link de convite, Papel do Canal, Comunidade e Papel na Comunidade, Participações e Pedidos. Nunca espelhados: Captação, Tags, Valores de Campo, Vínculos, Comentários, Limite de cliques.
- **RN-GRP-03** Toda alteração de atributo espelhado pela plataforma é Ferramenta do Canal com efeito no provedor; a plataforma não grava "nome desejado" sem enviá-lo.
- **RN-GRP-04** Arquivar, enviar à lixeira ou eliminar o Grupo nunca sai do grupo no provedor nem remove participantes.
- **RN-GRP-05** Ferramentas de administração exigem Papel do Canal `administrador`; `sincronizar` e `sair` aceitam `participante`.
- **RN-GRP-06** Links de Captação referenciam o Grupo; regenerar o Link de convite não exige alterá-los.
- **RN-GRP-07** Um Grupo com Captação `inativa`, `arquivado`, `cheio`, com Link de convite `inválido` ou `inacessível` **não recebe cliques** de nenhum Link de Captação; a elegibilidade é avaliada a cada Clique.
- **RN-GRP-08** Limite de cliques e Cliques contabilizados são da plataforma; `zerar cliques` é Ferramenta com Registro; o Reinício automático do Link (22, 7.1) zera os Grupos daquele Link.
- **RN-GRP-09** Capacidade vem do provedor; a organização pode definir um **teto próprio menor** para captação (atributo da Captação: Teto de captação, 0..1) sem alterar o provedor.
- **RN-GRP-10** Toda Participação referencia um Contato; se o Identificador externo do participante não resolver a Contato, o Sistema cria um Contato (B55 por analogia: Não identificado, com Identificador `identidade de WhatsApp`, Proprietário pela cadeia Canal → Caixa → Proprietário do ET — DO-CXE-05, Origem padrão do Canal). Nunca cria Contato para número do próprio Espaço de Trabalho (RN-GRP-11).
- **RN-GRP-11** Participante que é Canal do Espaço de Trabalho não gera Contato nem Participação com Contato: é marcado "É o Canal".
- **RN-GRP-12** "Membros do Grupo" é derivado de Participações vigentes, não dos Participantes da Conversa de grupo.
- **RN-GRP-13** Enviar Mensagem ao Grupo é enviar na Conversa de grupo correspondente (14): se não existir Conversa, o envio a cria (`aberta` ou `resolvida` conforme Grupos habilitados — 14, 20.18). O Registro é por Grupo destino.
- **RN-GRP-14** Remover Participante é Ferramenta `externa`; em `supervisionado`, exige aprovação (B22); a Automação "Guardião" (20.8) só pode remover sob Papel e Política de aprovação explícitos.
- **RN-GRP-15** Consentimento `revogado` para "todos os Tipos de Canal" ou para WhatsApp com Finalidade `comunicação em grupo` (catálogo — C35) **habilita** a Ação "remover de todos os Grupos" — por Automação, nunca por regra fixa da plataforma (RN-CON por analogia: a plataforma não age sozinha no provedor).
- **RN-GRP-16** Pedido de Entrada só existe em Grupo com `administradores aprovam entrada`; mudar a Configuração para falso não apaga Pedidos `pendente` — o provedor os expira, e a Sincronização marca `expirado`.
- **RN-GRP-17** Grupo em Comunidade com Papel `avisos` não admite Captação `ativa` nem ser elegível de Link (o provedor não permite entrada direta no grupo de avisos — INV-GRP-06).
- **RN-GRP-18** Criação em lote respeita o Limite de operações por Execução e o Limite de Grupos do Espaço de Trabalho; a Execução para no primeiro Grupo que excederia, com Registro.

## 14. Invariantes

- **INV-GRP-01** Identificador externo obrigatório e único (INV-ATV-01).
- **INV-GRP-02** No máximo uma Participação vigente por (Contato, Grupo).
- **INV-GRP-03** Participações vigentes ≤ Capacidade, salvo marcador de divergência do provedor.
- **INV-GRP-04** Toda Participação referencia Contato existente (não `na lixeira`? — Contato na lixeira mantém a referência; eliminado ⇒ anonimizada) ou é marcada "É o Canal".
- **INV-GRP-05** Grupo ↔ Conversa de grupo: no máximo uma Conversa não eliminada com (Identificador de grupo = Identificador externo do Grupo, Canal = Canal administrador) por Grupo.
- **INV-GRP-06** Grupo com Papel na Comunidade `avisos` tem Captação `inativa` e não é elegível de nenhum Link.
- **INV-GRP-07** Participação nunca é eliminada individualmente; só encerrada.

## 15. Personalização

Tags, Definições de Campo, Vínculos, Comentários (B113). **Template de Grupo** (Template — A8, lista ampliada): Nome com padrão de numeração, Descrição, Foto, Configurações, administradores iniciais (Contatos ou números), Teto de captação, Limite de cliques, Tags a aplicar; instanciar cria Grupos com Proveniência. "Grupos automáticos" do benchmark = Template de Grupo + Automação com Gatilho `agendamento` e Ação `criar Grupo por Template` (quantidade por execução; a numeração continua da última — o Template guarda "próximo número" como estado de Template, decisão DO-GRP-07). Faixas de Ocupação e Motivos de recusa são catálogos do Espaço de Trabalho.

## 16. Herança

Nenhuma. Configurações da Comunidade que o provedor impõe aos Grupos (25, 16) chegam como espelho, não herança.

## 17. Permissões e visibilidade

`ver` (registro, Participações com Contatos sem nome quando sem `ver` no Contato — B103), `comentar`, `editar` (Captação, Tags, Campos; e Ferramentas de edição no provedor), `excluir`, `administrar` (Canal administrador, sair, eliminar), `executar` (enviar Mensagem ao Grupo). Origens: Papel, concessão, Canal (DO-ATV-05), compartilhamento. Automações e Agentes sob A6.3 e B22; `remover Participante`, `sair`, `criar Grupo` e `enviar` são `externa`.

## 18. Eventos relevantes

| Evento | Gatilho? | Registro? |
| --- | --- | --- |
| Grupo importado / criado / criado por Template / arquivado / restaurado / eliminado | sim | sim |
| **Contato entrou no Grupo** (Participação criada; com Origem) / **saiu** (encerrada; com Causa) | sim | sim |
| Pedido de Entrada recebido / aprovado / recusado / expirado | sim | sim |
| Nome / Descrição / Foto / Configurações alterados (pela plataforma ou pelo provedor — com Ator) | sim | sim |
| Link de convite regenerado / tornou-se inválido | sim | sim |
| Papel do Canal alterado (perdeu/ganhou administrador; ausente) | sim | sim |
| Grupo cheio / voltou a ter vaga; Captação ativada / inativada; cliques zerados; esgotado para captação | sim | sim |
| Vinculado / desvinculado de Comunidade | sim | sim |
| Mensagem recebida no Grupo de não administrador com `somente administradores enviam` (evento da Conversa filtrado por Grupo) | sim | (na Mensagem) |
| Participante removido / promovido / rebaixado (com Ator) | sim | sim |

## 19. Dependências

22, 14 (Conversa de grupo, Canal, Mensagem), 10 (Contato, Identificador, Consentimento, criação automática), 25 (Comunidade), 19 (Automação), 21 (Painéis), A8 (Arquivo, Template, Tag, Vínculo).

## 20. Casos limítrofes e ambiguidades

### 20.1 O mesmo Contato em 12 Grupos
Doze Participações vigentes, uma por Grupo. "Contatos duplicados" do benchmark é um Filtro (Contatos com mais de N Participações vigentes) e uma Automação opcional que remove de todos menos um — nunca regra da plataforma.

### 20.2 Participante sai e volta no mesmo dia
Duas Participações (uma encerrada, uma vigente). Painéis contam duas entradas e uma saída; "membros" conta um.

### 20.3 Sincronização vê um número novo sem evento de entrada
Participação criada com Momento de entrada `estimado` = momento da Sincronização e Origem `desconhecida`; se um Link de Captação teve Clique para este Grupo na janela configurada, Origem `link de captação` `inferido` (o produto exibe a marca).

### 20.4 Dois Canais do Espaço de Trabalho no mesmo grupo
Um Canal administrador; o outro é Participação marcada "É o Canal" (RN-GRP-11), sem Contato. Se o administrador for arquivado, o produto sugere o outro (se `administrador` no provedor) como novo Canal administrador (RN-ATV-03).

### 20.5 Grupo importado cujo Canal é apenas participante
Grupo `ativo`, `sem privilégio`: só `sincronizar` e `sair`. Aparece no Filtro "sem privilégio" (alerta "problema de permissão"). Link de convite ausente ⇒ não elegível para Links (RN-GRP-07).

### 20.6 Sair do Grupo sendo o único administrador
Ferramenta `sair` com classe `externa e irreversível`: a plataforma perde o controle e o provedor pode dissolver o grupo; a confirmação obrigatória diz isso; Agente nunca a executa sem aprovação (B22 — `irreversível`), e a Automação exige Aprovador (B80).

### 20.7 Canal desconectado com Link de Captação ativo
Cliques continuam a ser redirecionados (o link de convite é do provedor, não depende do Canal); as Participações resultantes só serão vistas ao reconectar (entrada `estimada`). O produto avisa que a captação está "cega".

### 20.8 Guardião (remoção de quem fala sem poder)
Automação de escopo Grupo(s): Gatilho `evento` "Mensagem recebida no Grupo" com Condição "remetente não é administrador e Configurações.somente administradores enviam"; Ações "apagar Mensagem para todos" (Ferramenta do Canal sobre a Mensagem — 14) e/ou "remover Participante" (`externa`); Lista de permitidos = Condição "Contato não tem Tag `permitido no grupo`". Versão "visão de participante" (número auxiliar que enxerga o que administradores não veem) é a mesma Automação com Gatilho na Conversa de grupo do **segundo Canal** (participante) e Ação executada pelo primeiro (administrador) — dois Canais, uma Automação, sem entidade nova (DO-GRP-08). O provedor pode não expor "mensagem invisível a admins"; então a Automação simplesmente não dispara.

### 20.9 Provedor muda o Identificador externo do grupo
A Sincronização retorna `inacessível` para o antigo e a importação oferece um "novo" grupo com os mesmos participantes; o produto sugere **fundir** (transferir Participações e histórico) — operação análoga a mesclagem (B14) registrada como DO-GRP-09; sem ela, dois Grupos.

### 20.10 Criar 200 Grupos de uma vez
Uma Execução com 200 Passos (`criar Grupo`), acima do Limite de operações por Execução ⇒ aprovação obrigatória (B22); o produto recomenda ritmo (Template + Automação diária) por risco de bloqueio do provedor — a ontologia não impõe.

### 20.11 Mensagem enviada a Grupo sem Conversa de grupo
RN-GRP-13: o envio cria a Conversa (com Contato principal = nenhum até a primeira Mensagem `recebida`? — 14, 20.18 exige Contato principal do primeiro remetente; para Conversa criada por envio, o Contato principal fica **vazio com marcador "não resolvido"** — DO-CXE-25 por analogia — até a primeira Mensagem `recebida`). Registrado para C5.

### 20.12 Grupo restaurado da lixeira após 20 dias
Volta ao Estado anterior à exclusão (B43); Sincronização `nunca conferido` desde a restauração ⇒ `sincronizar` obrigatória antes de qualquer Ferramenta externa (RN-ATV-08).

## 21. O que explicitamente NÃO pertence a esta entidade

Conversa e Mensagens (14); Cliques (Link de Captação — 22); Campanha; pasta; agendamento (Automação); relatório (Painel); lista de bloqueio (Consentimento revogado + Automação); número auxiliar como entidade (é Canal); "lead" como entidade (Contato).

## 22. Exemplos conceituais

- Grupo "Programa Corporativo #07": Canal administrador "Comercial SP" (`administrador`); Capacidade 1 024; 812 Participações vigentes (Ocupação alta); Captação `ativa`, Limite de cliques 900, 874 contabilizados; Link de convite `válido`; Comunidade "Auton Empresas", Papel `comum`; Tags `lançamento-set`, `sp`; Vínculo com Negócio "Programa Alfa 2026".
- Participação: Contato "Ana Souza" (criada automaticamente em 2026-09-18 12:03 pelo Sistema, Origem `link de captação` → Link "Lançamento setembro"), Papel `membro`, vigente.
- Pedido de Entrada: Contato "Não identificado (+55 11 9…)", `pendente`; Automação "Aprovar quem tem e-mail corporativo" recusa com Motivo "domínio pessoal".
- Automação "Boas-vindas nos Grupos" (escopo Comunidade "Auton Empresas"): Gatilho "Contato entrou no Grupo" → Condição "entre 08:00 e 20:00" (senão "aguardar até 08:00") → Ação "enviar Mensagem" (Template "Boas-vindas programa") na **Conversa 1:1** do Contato.

## 23. Representação gráfica textual

```text
Grupo "Programa Corporativo #07"  [ativo · sincronizado · Canal: Comercial SP (administrador)]
├── espelho: Nome, Descrição, Foto, Configurações {só admins enviam: não; admins aprovam entrada: sim}, Link de convite [válido], Comunidade "Auton Empresas" (comum)
├── plataforma: Captação {ativa, Limite 900, contabilizados 874}, Tags, Valores de Campo, Vínculos, Comentários
├── Participações (812 vigentes / 1 024)
│   ├── Ana Souza      membro   entrou 18/09 12:03  origem: link de captação → "Lançamento setembro"
│   ├── Bruno Lima     admin    entrou 02/09        origem: importado
│   └── (É o Canal) Comercial SP  admin
├── Pedidos de Entrada: 3 pendentes
└── ◀── Conversa de grupo (Caixa de Entrada) · ◀── Link "Lançamento setembro" (elegível, ordem 7) · ◀── Automação "Boas-vindas"
```

## 24. Decisões ontológicas

- **DO-GRP-01** Grupo é Ativo de Canal administrado; a Conversa de grupo é contraparte por referência, não contenção.
- **DO-GRP-02** Participação é entidade interna do Grupo com vigência, nunca eliminada individualmente; é a porta de entrada de Contatos vindos de Grupos.
- **DO-GRP-03** Atributos espelhados são sobrescritos pela Sincronização; a plataforma altera o provedor só por Ferramenta.
- **DO-GRP-04** Arquivar nunca sai do grupo; sair é Ferramenta explícita, irreversível quando único administrador.
- **DO-GRP-05** Grupo importado nasce com Captação `inativa`.
- **DO-GRP-06** Pedido de Entrada cria Contato com marcador `pendente de aprovação` (recomendação; reversível).
- **DO-GRP-07** Template de Grupo guarda "próximo número" como estado; "grupos automáticos" = Template + Automação agendada.
- **DO-GRP-08** Guardião, lista de permitidos e visão de participante são Automações sobre um ou dois Canais; nenhuma entidade nova.
- **DO-GRP-09** Fusão de Grupos (mesmo objeto externo com Identificador novo) é operação registrada análoga à mesclagem (B14), a detalhar se o produto a adotar.

## 25. Questões em aberto

- **25.1 / C35** Finalidade de Consentimento constituída pela entrada em Grupo.
- **25.2 / C33** Limites: Grupos por Espaço de Trabalho, Participações por Sincronização, ritmo de criação em lote.
- **25.3** Se a Origem `link de captação` inferida por janela temporal deve constar em Painéis como dado ou só como marca (recomendação: dado com Dimensão "inferida").
- **25.4 / C5** Contato principal de Conversa de grupo criada por envio (20.11).
- **25.5** Se Participação deve gerar Vínculo Contato-Empresa quando o Grupo tem Vínculo com Empresa (recomendação: não; é Automação).
