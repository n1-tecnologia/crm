# SUBTAREFA

> Domínio: Estrutura de Trabalho | Documento 07 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

A **Subtarefa** é uma Tarefa cujo atributo **Tarefa pai** está preenchido (B1). Não é uma entidade distinta: é o nome que a árvore aprovada (A2.1) dá a uma Tarefa que ocupa posição abaixo de outra Tarefa. Tudo o que uma Tarefa é — unidade de trabalho com identidade própria, status atual, Responsáveis, datas, Prioridade, Valores de Campo, raiz do próprio agregado (Comentários, Checklists, Registros de Tempo, Anexos), objeto de Vínculos e Dependências, Recurso de permissão (documento 06, seções 1 e 3) — a Subtarefa também é. O que a distingue é exclusivamente a **posição**: existe um pai, e do pai decorrem a Tarefa raiz, a Lista e o nível.

Dessa posição decorrem restrições, nunca capacidades a menos: a Lista é a da raiz e não pode divergir; o Conjunto de Status e as Definições de Campo aplicáveis são os da Lista da raiz; o estado efetivo deriva do estado efetivo do pai (B36); a profundidade é limitada pela Profundidade máxima de Subtarefas do Espaço de Trabalho (B34); a Subtarefa não muda de Lista sem antes deixar de ser Subtarefa.

"Ser Subtarefa" é condição **derivada e reversível**: adquire-se ao vincular uma Tarefa a um pai e perde-se ao desvinculá-la, sem criar nem destruir registro (seção 5). A Subtarefa está para a Tarefa como a Subpasta está para a Pasta (B3, documento 04): a arquitetura nomeia a posição; a ontologia registra o que a posição restringe.

Diferenciação dos vizinhos: da Tarefa raiz, difere só por ter pai; do Item de Checklist, difere por ter identidade, status, datas, campos e Comentários (B2); da Dependência, difere por decompor o trabalho em vez de ordená-lo; da Tarefa vinculada, difere por estar contida (cascata, mesma Lista) em vez de associada; da ocorrência de recorrência, difere por coexistir com o pai como parte dele, não por sucedê-lo no tempo.

## 2. Propósito

1. **Decompor trabalho sem perder rastreabilidade.** Uma entrega grande tem partes que alguém assume, com prazo e status próprios, que aparecem em Painéis de carga. Item de Checklist não basta quando a parte precisa de mais de um Responsável, de data, de Comentários ou de campos (B2). A Subtarefa é a parte com identidade completa.
2. **Manter a árvore em um só lugar.** Se as partes pudessem estar em Listas diferentes, "onde está este trabalho" teria mais de uma resposta e a configuração aplicável divergiria dentro de uma mesma entrega. A regra de mesma Lista (B1) garante que a árvore inteira consome uma única configuração e uma única origem de permissão.
3. **Fechar a profundidade.** Como a Subpasta fecha a profundidade dos agrupadores (B3), a Profundidade máxima de Subtarefas fecha a da decomposição, para que "nível" seja valor estável para Painéis, Automações e Agentes.
4. **Registrar as restrições.** A arquitetura nomeia a Subtarefa (A2.1). As restrições que decorrem de ter pai — Lista derivada, cascata, profundidade, promoção prévia para mover, mapeamento junto com a raiz — precisam de registro para que os documentos de Checklist, Status, Automações, Painéis e Agentes as consumam sem inventar.

Este documento não repete a ontologia de Tarefa (documento 06): referencia-a e descreve só o que muda por ter pai.

## 3. Natureza da entidade

### 3.1 A questão central: entidade distinta ou especialização contextual?

| Aspecto | Alternativa A — entidade distinta | Alternativa B — Tarefa com pai preenchido (B1) |
| --- | --- | --- |
| Identidade | Identificador de outro tipo. Promover a raiz ou rebaixar a Subtarefa exige criar registro novo e migrar Comentários, Registros de Tempo, Vínculos, Dependências e Registros de Atividade — ou proibir a operação. | Mesmo identificador. Promover e rebaixar alteram um atributo; tudo o que apontava para a Tarefa continua apontando. |
| Ontologia | Atributos, agregado, Vínculos, Dependências, recorrência, permissões e eventos de Tarefa duplicados e mantidos em sincronia; cada divergência acidental vira regra. | Uma ontologia. Este documento descreve só a diferença. |
| Herança e configuração | Decidir, aspecto por aspecto, se a Subtarefa consome a configuração da Lista como a Tarefa ou de forma própria. | Consome exatamente o que a Tarefa consome (B25), pela Lista da raiz. |
| Permissões | Dois Recursos na tupla A9.1; Papéis, concessões e compartilhamentos enumeram ambos. | Um Recurso. Compartilhar a raiz abrange a árvore porque é o mesmo agregado (DO-TAR-16). |
| Painéis | Duas Fontes de Dados, Métricas e Dimensões em dobro; "todas as Tarefas" exige união explícita. | Uma Fonte de Dados com a opção "incluir Subtarefas" e a Dimensão "nível" (20.9). |
| IA e Automações | Ferramentas, Gatilhos e Condições em dobro ("Tarefa criada" e "Subtarefa criada"); Agentes raciocinam sobre dois tipos quase iguais. | Ferramentas e Gatilhos únicos; o pai é Condição disponível. |
| Movimentação entre Listas | Exigiria conversão de tipo. | Promoção seguida de movimentação de raiz (12.5). |
| Conversão de Item de Checklist | Item → Subtarefa e Item → Tarefa seriam operações com destinos distintos. | Uma operação: cria Tarefa com pai preenchido (DO-TAR-11). |
| Recorrência e Templates | Regra de Recorrência e Template descrevem dois tipos. | Descrevem Tarefas com pai. |

### 3.2 Decisão

Adota-se a alternativa B, vigente em B1 e aplicada em DO-TAR-10: Subtarefa é uma Tarefa cujo atributo Tarefa pai está preenchido — mesma entidade, mesma identidade, mesmas capacidades. A alternativa A foi rejeitada porque duplica toda a ontologia de Tarefa, impossibilita promover e rebaixar sem perder identidade e obriga Painéis, Automações e Agentes a tratar dois tipos para o mesmo trabalho (DO-STA-01). A Subtarefa recebe documento próprio pelas razões que valem para a Subpasta (B3): a arquitetura a nomeia e as restrições contextuais merecem registro verificável.

### 3.3 O que se acrescenta à natureza de Tarefa

- **Filha estrutural de exatamente uma Tarefa** (o pai), dentro do agregado da raiz: sujeita à cascata de estado, à regra de mesma Lista e ao limite de profundidade. Não é filha estrutural direta da Lista: pertence à Lista por derivação da raiz (INV-TAR-03).
- **Pai possível de outras Subtarefas**, até o limite. Para as suas filhas, uma Subtarefa é o que a raiz é para ela — exceto que nunca determina a Lista; quem a determina é sempre a raiz.
- **Nível** (derivado, seção 6) ≥ 1. Com o pai, é o único ponto em que Subtarefa e Tarefa raiz diferem.
- **Não é** componente interno (tem identidade), **não é** Item de Checklist e **não é** um Tipo de Tarefa: Tipo é outro atributo (DO-TAR-13) e uma Subtarefa pode ter qualquer Tipo disponível.

## 4. Fronteira conceitual

### O que é

- Uma Tarefa em posição abaixo de outra Tarefa, com tudo o que uma Tarefa tem.
- A unidade de decomposição quando a parte precisa de identidade, status, datas, Responsáveis, campos ou Comentários próprios.
- Membro do agregado da raiz para efeito de cascata, mesma Lista, movimentação e compartilhamento.

### O que não é

- **Não é uma Tarefa com menos capacidades.** Nada é retirado; só restrições estruturais são acrescentadas.
- **Não é Item de Checklist.** Item não tem identidade externa (B2).
- **Não é Dependência.** Ter pai não bloqueia nem é bloqueado; a hierarquia expressa composição, não sequência.
- **Não é Tarefa vinculada.** "Relacionada a" é associação sem cascata e sem regra de Lista.
- **Não é ocorrência de recorrência.** A ocorrência sucede a anterior no tempo e não recebe pai por esse fato (B6).
- **Não é nível de configuração.** Nada se define em uma Subtarefa (B25); a sub-hierarquia não acrescenta ponto de definição nem de permissão restritiva.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Tarefa × Subtarefa** | Sem pai. Determina a Lista da árvore. Alvo primário de cascata, movimentação e compartilhamento. Nível 0. | Com pai. Lista derivada da raiz. Recebe cascata. Nível 1..máximo. | Só o atributo Tarefa pai (e o que dele deriva) distingue. Identidade, atributos, agregado, permissões e eventos são os mesmos. A distinção é posicional e reversível (seção 12.3). |
| **Subtarefa × Item de Checklist** | Entidade com identidade global, status atual, datas, Prioridade, Responsáveis 0..N (Membro ou Agente), Valores de Campo, Comentários, Registros de Tempo, Vínculos, Dependências, histórico próprio. | Componente interno: texto, ordem, concluído, Responsável 0..1 Membro, Subitens em um nível; sem status, datas, campos, Comentários ou histórico próprio (B2). | Item enumera passos de uma Tarefa; Subtarefa é trabalho com vida própria. Se um passo precisa de status, data, mais de um Responsável ou Comentário, é Subtarefa. Item converte-se em Subtarefa (20.4); o inverso não existe (DO-TAR-11). |
| **Subtarefa × Dependência** | Relação de **composição**: a Subtarefa é parte do pai; cascata de estado; mesma Lista; profundidade limitada. | Relação de **ordem**: `bloqueia` / `é bloqueada por` / `aguarda` entre Tarefas quaisquer do Espaço de Trabalho; sem cascata; grafo acíclico (INV-TAR-09). | Decompor versus sequenciar. Uma Subtarefa concluída não desbloqueia nada por ser Subtarefa; um pai concluído não exige Subtarefas concluídas por padrão (RN-TAR-18). Dependência entre ancestral e descendente é proibida (DO-TAR-09): a hierarquia já expressa a relação. |
| **Subtarefa × Tarefa vinculada ("relacionada a")** | Contida: segue o pai em cascata, mesma Lista, mesma raiz. Exatamente um pai. | Associada por Vínculo simétrico, sem propriedade, entre Tarefas de quaisquer Listas; 0..N; sobrevive à exclusão do outro lado (RN-TAR-15). | Contenção versus associação. Se o trabalho de outra Lista "faz parte" de uma entrega, ou é movido para a Lista da raiz e rebaixado, ou permanece vinculado — nunca as duas coisas. |
| **Subtarefa × Tarefa gerada por recorrência** | Coexiste com o pai; é parte dele; Proveniência opcional. | Tarefa nova, raiz ou Subtarefa conforme a Regra, que sucede a ocorrência anterior; Proveniência "ocorrência de" (DO-TAR-14). | Parte versus sucessora. A Regra da corrente pode copiar Subtarefas para a nova ocorrência (12.5 do documento 06): as cópias são Subtarefas da nova ocorrência, com identidade própria, sem relação com as originais além da Proveniência. |

## 5. Identidade

A identidade é a de Tarefa (documento 06, seção 5): identificador imutável, opaco, atribuído pela plataforma; identificador legível próprio, se habilitado (DO-TAR-02).

**Teste de identidade.** Se uma Subtarefa for promovida a Tarefa raiz (Tarefa pai esvaziado), se uma Tarefa raiz for rebaixada a Subtarefa (Tarefa pai preenchido) ou se uma Subtarefa mudar de pai, continua sendo a mesma Tarefa: Comentários, Registros de Tempo, Valores de Campo, Vínculos, Dependências, Responsáveis, Registros de Atividade e identificador legível permanecem. Recomendação confirmada (DO-STA-02): promover, rebaixar e mudar de pai **preservam a identidade** e geram o evento "Pai alterado" (seção 18). A alternativa — criar uma Tarefa nova e migrar o agregado — destruiria a continuidade do histórico e das referências, exatamente o que a alternativa A da seção 3.1 rejeitou.

Consequências: a Subtarefa tem o próprio histórico (os Registros da raiz não são os dela; a raiz pode exibi-los como visão agregada, 8.4 do documento 06); os Comentários, Registros de Tempo e Anexos de uma Subtarefa pertencem a ela, não ao pai (DO-TAR-07; 7.3 e 7.5 do documento 06); "Tarefa pai" e "nível" são atributos, não parte da identidade.

## 6. Atributos fundamentais

Todos os atributos de Tarefa (documento 06, seção 6) se aplicam sem alteração. A tabela lista apenas os que existem por causa do pai ou cujo significado muda.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Tarefa pai | referência (Tarefa) | sim (é o que define a Subtarefa) | Exatamente uma Tarefa `ativo`, `arquivado` ou `na lixeira` da mesma Lista. Alterável por promoção, rebaixamento ou mudança de pai (12.3). |
| Tarefa raiz | derivado | sim | A Tarefa sem pai no topo da cadeia. Recalculada quando qualquer ancestral muda de pai. Toda Subtarefa a referencia (B1). |
| Nível | derivado | sim | Comprimento da cadeia de pais até a raiz. Raiz = 0; Subtarefa direta = 1. Sempre ≤ Profundidade máxima do Espaço de Trabalho, salvo legado (RN-ET-17; 20.6). |
| Lista | referência (Lista) | sim | **Derivada** da raiz (INV-TAR-03). Não é atribuível nem alterável enquanto houver pai. |
| Posição entre irmãs | nativo | sim | Ordem entre as Subtarefas do mesmo pai. Atributo, não Visualização, porque a ordem de decomposição tem significado (documento 06, 6.1). |
| Estado próprio | nativo | sim | `ativo`, `arquivado` ou `na lixeira`, gravado na própria Subtarefa e alterado só por ato sobre ela; nunca reescrito por cascata (B36). Ver seção 11. |
| Estado efetivo | derivado | sim | O mais restritivo entre o estado próprio, o estado efetivo do pai e o da Lista, na ordem `ativo` < `arquivado` < `na lixeira` (B36; DO-TAR-18). |
| Progresso de Subtarefas | derivado | condicional | Presente em qualquer Tarefa com Subtarefas diretas em estado efetivo `ativo`: proporção delas em categoria `concluído` ou `fechado`. Subtarefas `arquivado` ou `na lixeira` não contam (DO-STA-06). |

Não são atributos: "profundidade restante" (calculável a partir do nível e do máximo), "caminho de títulos" (apresentação) e "é Subtarefa" (predicado: Tarefa pai preenchido).

## 7. Entidades internas ou componentes

Idênticos aos de Tarefa (documento 06, seção 7), pertencentes à própria Subtarefa: Comentários, Checklists e Itens, Registros de Tempo, Valores de Campo, Anexos, Regra de Recorrência, Proveniência, Compartilhamento público. Três precisões:

- **Checklists são próprios.** Uma Subtarefa tem Checklists como qualquer Tarefa; o Checklist do pai não "contém" a Subtarefa nem o contrário. Um Item de Checklist da Subtarefa pode ser convertido em Subtarefa dela (nível + 1), sujeito ao limite (20.4).
- **Regra de Recorrência em Subtarefa é válida** (DO-STA-08). A ocorrência gerada é criada com o **mesmo pai** da corrente (irmã), no mesmo nível — nunca excede o limite. Se o pai estiver `arquivado` ou `na lixeira`, a corrente está em estado efetivo igual e a série está suspensa (12.5 do documento 06).
- **Compartilhamento público próprio** expõe só a Subtarefa e seus descendentes; o da raiz expõe a árvore inteira (7.7 do documento 06). Um não revoga o outro.

Subtarefas de uma Subtarefa são Tarefas com identidade, não componentes: integram o agregado da raiz para cascata, como a própria Subtarefa (7.8 do documento 06).

## 8. Relações

Aplicam-se todas as relações de Tarefa (documento 06, 8.1 a 8.3). Só o que muda por ter pai:

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| tem pai | Tarefa | contenção estrutural (dentro do agregado da raiz) | pai → Subtarefa | Exatamente um. Mesma Lista. Cascata de estado (A3.3, B1). |
| tem raiz | Tarefa | derivada (transitiva) | raiz → Subtarefa | Determina Lista, Conjunto de Status efetivo, Definições efetivas e origem das permissões. |
| pertence a Lista | Lista | pertencimento (derivado) | Lista → Subtarefa | A Lista da raiz (RN-LIS-03). Não atribuível separadamente. |
| tem Subtarefas | Tarefa | contenção | Subtarefa → filhas | 0..N enquanto nível < máximo. |
| tem Responsáveis, Observadores, Tags, Vínculos, Dependências | Ator, Tag, registros, Tarefa | associação | próprios | Idênticos a Tarefa; nada vem do pai. Dependência com ancestral ou descendente é proibida (INV-TAR-09). |
| recebe compartilhamento | Permissão (origem compartilhamento) | herança (do agregado) | raiz ou ancestral → Subtarefa | Compartilhar uma Tarefa abrange todos os seus descendentes (DO-TAR-16). Compartilhar uma Subtarefa abrange só a sua subárvore. |
| é contada no progresso | Tarefa (pai) | derivada | Subtarefa → pai | Só Subtarefas diretas em estado efetivo `ativo` (seção 6). |
| é Condição de Automações e Dimensão de Widgets | Automação, Widget | associação (uso do atributo) | — | "Tem pai", "nível" e "raiz" são atributos disponíveis a Condições e a Fontes de Dados (20.9). |

Distinção aplicada: a Subtarefa **é contida** pelo pai (cascata, Lista) e **relaciona-se** com tudo o mais exatamente como uma Tarefa raiz. Ter pai não cria Vínculo, Dependência, Responsável nem permissão.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Subtarefa → Tarefa pai | 1 | não | não | estrutural | Zero seria Tarefa raiz; dois pais tornariam Lista, raiz e cascata ambíguas. |
| Tarefa → Subtarefas diretas | 0..N | sim | sim | estrutural | Sem teto ontológico; teto é Limite imposto (B34; 20.8). |
| Subtarefa → Tarefa raiz | 1 | não | não | derivada | Cadeia finita e acíclica termina sempre em uma raiz (INV-TAR-02). |
| Subtarefa → Lista | 1 (a da raiz) | não | não | estrutural derivada | B1, INV-TAR-03. |
| Subtarefa → nível | 1 ≤ n ≤ máximo | — | — | derivada | Máximo configurado no Espaço de Trabalho; recomendação 3 (B1). Legado tolerado após redução (RN-ET-17). |
| Subtarefa → Responsáveis, Observadores, Tags, Vínculos, Dependências, Comentários, Checklists, Registros de Tempo, Valores, Anexos | como Tarefa | sim | sim | como Tarefa | Documento 06, seção 9. Nenhuma cardinalidade muda por ter pai. |
| Subtarefa → Regra de Recorrência | 0..1 | sim | não | objeto de valor | DO-STA-08. |
| Subtarefa → Compartilhamento público próprio | 0..1 | sim | não | objeto de valor | Independente do da raiz. |
| Item de Checklist → Subtarefa convertida | 0..1 | sim | não | objeto de valor (referência unilateral, não viva) | DO-TAR-11; DO-CHK-09. A Subtarefa guarda Proveniência, não referência ao Item. |

Sem `DECISÃO NECESSÁRIA` pendente: todas decorrem de B1, B2, B34 e das decisões da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** A Subtarefa ocupa a sub-hierarquia interna da folha estrutural: Lista → Tarefa raiz → Subtarefa → Subtarefa …, até a Profundidade máxima. A sub-hierarquia **não é** um novo nível de configuração nem de permissão restritiva: Subtarefas consomem a Lista da raiz e nada definem (B25, INV-TAR-16). Um caminho Lista → raiz → nível 3 tem os mesmos atributos e capacidades que Lista → raiz → nível 1; só o nível difere.

**Pertencimento (teste de existência).** A Subtarefa **não existe sem o pai**: eliminado o pai, a Subtarefa é eliminada em cascata, mesmo que estivesse `na lixeira` por ato próprio anterior (12.6 do documento 06). Ela tem, porém, identidade própria — o que a distingue de um componente é que a dependência é de **cascata**, não de significado: promovida antes da eliminação, sobrevive. Seus próprios componentes não existem sem ela. Pai, raiz, Lista, Responsáveis, Tags, registros vinculados e Tarefas dependentes existem sem a Subtarefa.

**"Pertence a" versus "relaciona-se com".** A Subtarefa *pertence* ao pai e, por ele, à raiz e à Lista. *Relaciona-se com* Responsáveis, registros vinculados e Tarefas dependentes. Uma Subtarefa não pertence a nenhum Responsável, nem o pai "pertence" ao Responsável da Subtarefa.

**Propriedade.** Não tem Proprietário (A7, RN-TAR-08). A governança é a do contêiner (Administrador da Lista). Quem tem `editar` no pai governa a estrutura da subárvore (criar, reordenar, promover, rebaixar), não a governança da Lista.

## 11. Estados

Os estados são os de Tarefa (A4.1; documento 06, seção 11), com a distinção que a posição torna necessária e que B36 fixa: **estado próprio** (gravado) e **estado efetivo** (derivado). Nenhuma "origem do estado" é gravada: saber se uma Subtarefa está `arquivado` por ato próprio ou por ancestral é derivável comparando os dois.

| Estado próprio | Estado efetivo | Significado |
| --- | --- | --- |
| `ativo` | `ativo` | Pai, raiz e Lista efetivamente `ativo`: operação normal. |
| `ativo` | `arquivado` ou `na lixeira` | Um ancestral (Tarefa pai, raiz ou Lista) está efetivamente nesse estado. A Subtarefa segue-o sem que o seu estado próprio mude e sem contar no progresso; restaurado o ancestral, volta a efetivo `ativo` automaticamente. |
| `arquivado` | ≥ `arquivado` | Arquivada por ato sobre ela mesma. Restaurar um ancestral não a desarquiva (o estado próprio permanece); desarquivá-la é ato sobre ela, permitido mesmo sob ancestral efetivamente `arquivado` — o efetivo continua derivado (DO-STA-04). |
| `na lixeira` | `na lixeira` | Excluída por ato próprio. Restaurar um ancestral não a restaura; o pai deixa de contá-la no progresso. Restaurá-la devolve o Estado próprio anterior à exclusão e exige pai imediato não efetivamente `na lixeira` (12.4). |

Ordem de restrição: `ativo` < `arquivado` < `na lixeira`. O estado efetivo é o que Painéis, Automações, Dependências (uma Subtarefa efetivamente `arquivado` não bloqueia, RN-TAR-16) e Agentes leem, e é o que toda regra de "o que pode ser feito" avalia; o estado próprio é o que toda regra de "o que acontece ao restaurar" avalia (INV-TAR-14 é satisfeito pelo estado efetivo). Sob ancestral efetivamente `na lixeira`, a Subtarefa não é alvo de ação alguma: só a restauração do ancestral. Estado e status são independentes: uma Subtarefa `arquivado` conserva o status atual.

## 12. Ciclo de vida

### 12.1 Criação

Uma Subtarefa nasce por: criação direta sob um pai; rebaixamento de uma Tarefa raiz (12.3); conversão de Item de Checklist (DO-TAR-11); instanciação de Template de Tarefa que descreve Subtarefas; geração de ocorrência por Regra de Recorrência (da raiz, copiando Subtarefas; ou de uma Subtarefa corrente, DO-STA-08); Automação, Agente ou Integração. Exige `criar` na Lista e `editar` sobre o pai imediato (17.1), pai em estado efetivo `ativo` e nível do pai < Profundidade máxima; ao atingir o limite, a criação é **rejeitada** com Registro de Atividade (RN-STA-04). O restante é idêntico a 12.1 do documento 06: a Subtarefa nasce `ativo`, com status inicial válido, Tipo, Prioridade e Criador próprios. Nada é copiado do pai por regra (seção 16); o produto pode oferecer "copiar do pai" como ato explícito.

### 12.2 Transições de status

Idênticas a 12.2 do documento 06. O que a posição acrescenta: (a) concluir o pai com Subtarefas em categoria não terminal é permitido por padrão; a Funcionalidade "exigir Subtarefas concluídas" da Lista rejeita a transição do **pai** enquanto houver Subtarefa direta em estado efetivo `ativo` e categoria não terminal (RN-TAR-18); (b) nenhuma transição do pai altera o status de Subtarefas, e nenhuma transição de Subtarefa altera o do pai (RN-TAR-19): propagação em qualquer direção é Ação de Automação, não regra ontológica; (c) toda mudança de categoria de uma Subtarefa direta, e toda entrada ou saída dela do estado efetivo `ativo`, emite no pai o evento "Progresso de Subtarefas alterado" (seção 18), que é o Gatilho natural para Automações de propagação.

### 12.3 Promover, rebaixar, mudar de pai

Três operações sobre o atributo Tarefa pai, todas com identidade preservada (DO-STA-02) e evento "Pai alterado":

| Operação | Antes → depois | Exige | Verificações |
| --- | --- | --- | --- |
| **Promover** (desvincular) | pai preenchido → vazio | `editar` na Subtarefa e no antigo pai | Nenhuma além de estado efetivo `ativo`. A Subtarefa vira raiz **na mesma Lista**, levando sua subárvore (níveis recalculados: −n). Compartilhamentos que vinham da antiga raiz deixam de alcançá-la; Responsáveis que só viam por eles são liberados (RN-TAR-06). |
| **Rebaixar** (vincular raiz a pai) | vazio → preenchido | `editar` na raiz rebaixada e no novo pai | Mesma Lista (ou o ato inclui a movimentação para a Lista do novo pai, com todos os efeitos de 12.4 do documento 06); novo pai não pode ser ela mesma nem descendente dela (INV-STA-02); nível do novo pai + 1 + altura da subárvore trazida ≤ máximo; nenhuma Dependência entre a árvore trazida e os novos ancestrais (INV-TAR-09; 20.5). |
| **Mudar de pai** (reparentar) | pai A → pai B | `editar` na Subtarefa, em A e em B | Mesmas verificações do rebaixamento. Se B está em outra Lista, a operação é promoção + movimentação + rebaixamento, em um ato ou em três. |

Qualquer verificação que falhe rejeita a operação inteira: nunca se move parte de uma subárvore.

### 12.4 Cascata do pai e restauração

Arquivar, enviar à lixeira e restaurar o pai alteram o **estado efetivo** dos descendentes sem reescrever o estado próprio de nenhum deles (A3.3; B36; DO-TAR-18); eliminar o pai elimina os descendentes independentemente do estado próprio. Restaurar o pai devolve a cada descendente o estado efetivo que o seu estado próprio determina: o que estava `arquivado` ou `na lixeira` por ato próprio permanece assim (seção 11).

**Restaurar uma Subtarefa da lixeira** (detalhamento de RN-TAR-28; DO-STA-05): devolve o Estado próprio anterior à exclusão (documento 06, 6.1) e exige que a Lista não esteja efetivamente `na lixeira`. Então:

1. Pai em estado efetivo `ativo` ou `arquivado`: restaura sob o pai, com o estado próprio anterior à exclusão; o estado efetivo segue o pai (sob pai `arquivado`, permanece efetivamente `arquivado`). Nível legado além do máximo é tolerado (não é criação, RN-ET-17), com Registro de Atividade.
2. Pai `na lixeira` e incluído na restauração (ato sobre a cadeia): restaura sob ele.
3. Pai `na lixeira` e **não restaurável no ato** — porque o ator não o inclui ou não tem `excluir` sobre ele: a Subtarefa é restaurada como **Tarefa raiz na mesma Lista**, com evento "Pai alterado" (causa: restauração) e Registro de Atividade que preserva o identificador do antigo pai. Se o pai for restaurado depois, a relação **não** é refeita automaticamente: rebaixar de novo é ato explícito.
4. Pai eliminado permanentemente: o caso não ocorre; a Subtarefa foi eliminada com ele (12.6 do documento 06).

A alternativa "rejeitar a restauração até restaurar o pai" foi rejeitada: prende trabalho recuperável a um registro que outra pessoa decidiu descartar.

### 12.5 Movimentação entre Listas

**Mover a Tarefa raiz move toda a árvore** (B1, RN-TAR-02): o mapeamento de status, o arquivamento de Valores de Campo, a troca de Tipo indisponível e a liberação de Responsáveis sem `ver` (12.4 do documento 06; RN-LIS-06, RN-LIS-10) aplicam-se a cada Subtarefa, individualmente, no mesmo ato. **Mover uma Subtarefa para outra Lista é proibido enquanto ela for Subtarefa**: exige promoção prévia (12.3) e então movimentação como raiz. O produto pode oferecer os dois passos como um único ato de produto; ontologicamente são dois atos, ambos registrados.

### 12.6 Eliminação permanente

Elimina a Subtarefa com o seu agregado e seus descendentes; remove Vínculos e Dependências dos dois lados; preserva Registros de Atividade e Arquivos (12.3 do documento 06). Eliminar o pai elimina a Subtarefa mesmo que ela esteja `na lixeira` por ato próprio anterior.

## 13. Regras de negócio ontológicas

- **RN-STA-01.** Subtarefa é toda Tarefa com Tarefa pai preenchido. Nenhuma regra, permissão, Ferramenta, Gatilho ou Fonte de Dados pode tratar "Subtarefa" como tipo distinto de Tarefa; só como predicado sobre o atributo (B1, DO-STA-01).
- **RN-STA-02.** A Lista da Subtarefa é a da sua raiz, derivada, nunca atribuída (INV-TAR-03). Mover a raiz move a árvore inteira; mover uma Subtarefa para outra Lista exige promoção prévia a raiz (RN-TAR-02).
- **RN-STA-03.** O Conjunto de Status efetivo, as Definições de Campo efetivas, os Tipos, as Funcionalidades e as Automações aplicáveis à Subtarefa são os da Lista da raiz (B25). Toda operação que altere o Conjunto efetivo dessa Lista mapeia as Subtarefas junto com a raiz (RN-LIS-06; 20.10).
- **RN-STA-04.** Criar Subtarefa sob uma Tarefa cujo nível seja igual à Profundidade máxima é rejeitado, com Registro de Atividade. Rebaixar, reparentar ou converter Item de Checklist que resulte em nível além do máximo, contando a subárvore trazida, é rejeitado por inteiro (INV-TAR-02).
- **RN-STA-05.** Reduzir a Profundidade máxima não elimina, não promove nem altera Subtarefas existentes além do novo limite (RN-ET-17). Árvores legadas permanecem operáveis (status, Responsáveis, Comentários, restauração); ficam **estruturalmente congeladas**: nenhuma criação, rebaixamento ou reparentagem que resulte em nível além do máximo; reparentagem para nível menor é permitida (DO-STA-07).
- **RN-STA-06.** Subtarefa não herda do pai status, Responsáveis, Observadores, datas, Prioridade, Tipo, Tags, Valores de Campo, Anexos ou Estimativa (DO-TAR-10). Cópia na criação é ato explícito; propagação posterior é Ação de Automação, nunca regra ontológica (DO-STA-03).
- **RN-STA-07.** O status da Subtarefa é independente do pai em qualquer direção (RN-TAR-19). Concluir o pai não conclui Subtarefas; reabrir uma Subtarefa não reabre o pai. A Funcionalidade "exigir Subtarefas concluídas" valida apenas a transição do pai (RN-TAR-18; 20.3).
- **RN-STA-08.** Datas de Subtarefa são independentes do pai; uma Subtarefa pode vencer depois do pai por padrão (DO-TAR-06, RN-TAR-20). A Funcionalidade "datas de Subtarefas contidas no pai" valida, nunca reescreve.
- **RN-STA-09.** Responsáveis de Subtarefa são próprios: 0..N Membros `ativo` ou Agentes com `ver` sobre a Subtarefa (RN-TAR-06, B7). Ser Responsável do pai não torna ninguém Responsável da Subtarefa, nem o inverso.
- **RN-STA-10.** Vínculos e Dependências são próprios. Dependência entre uma Subtarefa e qualquer ancestral ou descendente é proibida (RN-TAR-16); a verificação ocorre ao criar a Dependência e ao rebaixar ou reparentar (20.5).
- **RN-STA-11.** Promover, rebaixar e reparentar preservam a identidade e todo o agregado; geram o evento "Pai alterado" e Registro de Atividade com pai e raiz antes e depois (DO-STA-02).
- **RN-STA-12.** Estado próprio (gravado, alterado só por ato sobre a própria Subtarefa) e estado efetivo (derivado: o mais restritivo da cadeia Lista → raiz → … → Subtarefa) coexistem; nenhuma "origem do estado" é gravada; a restauração de um ancestral devolve a cada descendente o estado que o seu estado próprio determina; atos sobre o estado próprio sob ancestral efetivamente `arquivado` são permitidos e sob ancestral efetivamente `na lixeira` não (B36; DO-LIS-09; DO-STA-04).
- **RN-STA-13.** Restaurar Subtarefa cujo pai está `na lixeira` e não é restaurado no mesmo ato promove-a a raiz na mesma Lista, com evento e Registro; a relação não é refeita automaticamente se o pai for restaurado depois (RN-TAR-28; DO-STA-05).
- **RN-STA-14.** Progresso de Subtarefas é derivado do pai sobre as Subtarefas diretas em estado efetivo `ativo`; nunca é gravado nem editável e nunca altera o status do pai (DO-STA-06).
- **RN-STA-15.** Criar Subtarefa exige `criar` na Lista e `editar` sobre o pai imediato; promover, rebaixar e reparentar exigem `editar` sobre a Tarefa movida e sobre cada pai envolvido (17.1).
- **RN-STA-16.** Compartilhar uma Tarefa abrange todos os seus descendentes no mesmo escopo `registro` (DO-TAR-16). Promover uma Subtarefa a retira do alcance dos compartilhamentos da antiga árvore; Responsáveis e Observadores que perdem `ver` são liberados no ato (RN-TAR-06).
- **RN-STA-17.** Fontes de Dados de Painel sobre Tarefas **excluem Subtarefas por padrão**; incluí-las é escolha explícita da Fonte de Dados, que então dispõe de "nível", "raiz" e "tem pai" como Dimensões e Filtros (DO-STA-09).
- **RN-STA-18.** O número de Subtarefas por Tarefa e por Espaço de Trabalho não tem teto ontológico; qualquer teto é Limite imposto (B34), verificado no ato (RN-ET-23), aplicável igualmente a Membros, Agentes e Automações (20.8).

## 14. Invariantes

- **INV-STA-01.** Toda Subtarefa referencia exatamente uma Tarefa pai existente, da mesma Lista e do mesmo Espaço de Trabalho.
- **INV-STA-02.** A cadeia de pais é finita, acíclica e termina em uma Tarefa raiz; nenhuma Tarefa é pai de si mesma nem de um ancestral (INV-TAR-02).
- **INV-STA-03.** Nível ≤ Profundidade máxima do Espaço de Trabalho para toda Subtarefa criada, rebaixada ou reparentada após a última alteração do máximo; árvores legadas só decrescem de nível.
- **INV-STA-04.** A Lista de toda Subtarefa é igual à Lista da sua raiz (INV-TAR-03); o status atual de toda Subtarefa aponta para o Conjunto efetivo dessa Lista (INV-TAR-04).
- **INV-STA-05.** O estado efetivo de uma Subtarefa é igual ou mais restrito que o de cada ancestral e o da Lista (INV-TAR-14).
- **INV-STA-06.** Nenhuma Dependência liga uma Tarefa a um ancestral ou descendente (INV-TAR-09).
- **INV-STA-07.** Nenhuma operação sobre o atributo Tarefa pai altera identificador, identificador legível, Criador, Momento de criação, categoria de status (INV-TAR-13) ou qualquer componente do agregado.
- **INV-STA-08.** Nenhum atributo de Subtarefa é derivado do pai além de Lista, raiz, nível e estado efetivo.
- **INV-STA-09.** Uma Subtarefa nunca define configuração nem possui Proprietário (INV-TAR-16).

## 15. Personalização

**Na própria Subtarefa:** tudo o que é personalizável em uma Tarefa (documento 06, seção 15), mais Tarefa pai (dentro das regras de 12.3) e Posição entre irmãs.

**Fora dela e consumido por ela:** Profundidade máxima de Subtarefas (Espaço de Trabalho, B34; não sobrescritível por Espaço, Pasta ou Lista); Funcionalidades da Lista que só fazem sentido com pai — "exigir Subtarefas concluídas" e "datas de Subtarefas contidas no pai" (documento 06, 6.4); Automações de propagação (status, datas, Responsáveis, Tags do pai para as filhas ou o inverso), que a Lista ou seus ancestrais definem e que são cópia reativa, não herança.

**Não personalizável:** a regra de mesma Lista; a ausência de herança de atributos do pai; a independência de status e datas por padrão; a cascata de estado; a exclusão de Subtarefas por padrão nas Fontes de Dados; o significado de nível.

## 16. Herança

A Subtarefa herda **da Lista da raiz** tudo o que uma Tarefa herda (documento 06, seção 16) e **do pai** apenas posição. A tabela analisa cada aspecto que o produto tenderia a chamar de "herdado do pai":

| Aspecto | Herda do pai? | Análise e recomendação |
| --- | --- | --- |
| Lista | Sim, obrigatoriamente (derivada da raiz) | Única herança ontológica. Divergência é proibida (B1). |
| Conjunto de Status, Definições de Campo, Tipos, Funcionalidades, Automações, Visualizações padrão, permissões de origem `herança` | Via Lista da raiz | Não vêm "do pai": vêm da Lista, que é a mesma. Se a raiz for movida, tudo isso muda para toda a árvore no mesmo ato. |
| Status atual | Não | Cada Subtarefa é uma unidade de trabalho com fluxo próprio (RN-TAR-19). Herdar status tornaria "progresso de Subtarefas" tautológico. |
| Responsáveis e Observadores | Não | Decompor serve justamente para atribuir partes a pessoas diferentes (20.1). "Copiar do pai" na criação é conveniência de produto; propagação posterior é Automação. |
| Datas | Não | Propagação silenciosa reescreve compromissos assumidos por outra pessoa (DO-TAR-06). Validação de contenção é Funcionalidade opcional. "Vencimento da árvore" é derivado, não gravado. |
| Prioridade | Não | Uma parte pode ser urgente dentro de uma entrega normal. Painéis leem cada Tarefa. |
| Tipo de Tarefa | Não | "Marco" pode ter Subtarefas "tarefa"; "bug" pode ter Subtarefa "reunião". |
| Tags | Não | Tag é aplicação N:N por Tarefa (B5). Automação pode replicar. |
| Valores de Campo | Não | Valor pertence ao registro (A5.1). Definição obrigatória exige Valor próprio em cada Subtarefa. |
| Anexos, Comentários, Registros de Tempo, Checklists | Não | Pertencem ao agregado de cada Tarefa. "Tempo agregado" da raiz é derivado. |
| Compartilhamento (origem `compartilhamento`) | Sim, recebido do ancestral compartilhado | Não é herança de atributo: é alcance do Recurso compartilhado, que abrange o agregado (DO-TAR-16). Cessa na promoção. |
| Compartilhamento público da raiz | Alcance, não herança | Expõe a árvore; a Subtarefa pode ter o próprio. |
| Estado de ciclo de vida | Cascata, não herança | Estado próprio permanece; estado efetivo é derivado (seção 11). |

Regra geral: **"propagação" é ato de Automação — Gatilho, Condição, Ação, registrada com ator Automação e ator delegante — nunca herança ontológica** (DO-STA-03). A diferença importa para auditoria (quem mudou a data da Subtarefa: a Automação, não "o sistema"), para reversibilidade (a Automação pode ser desabilitada; a herança não) e para Painéis (um valor copiado é um fato do registro; um valor herdado seria uma consulta ao pai).

## 17. Permissões e visibilidade

### 17.1 O que muda por ter pai

Sujeito, Ação, Recurso, Escopo e Origem são os de Tarefa (documento 06, seção 17): origem normal é herança da Lista; a Subtarefa não pode ser privada; pode ser compartilhada. Acréscimos:

| Ação | Sobre a Subtarefa significa, além do que significa sobre Tarefa |
| --- | --- |
| criar | Criar Subtarefa exige `criar` na Lista **e** `editar` sobre o pai imediato: acrescentar uma parte altera a estrutura do pai. Onde o documento 06 (12.1, 17.1) diz "raiz", leia-se "pai imediato" (DO-STA-10): coincidem sempre que a origem é herança da Lista; divergem só quando a permissão vem de compartilhamento de uma Subtarefa intermediária, cujo alcance é a sua subárvore. |
| editar | Inclui promover, rebaixar, reparentar e reordenar irmãs — cada uma exigindo `editar` sobre a Tarefa movida e sobre cada pai envolvido (RN-STA-15). |
| excluir | Enviar à lixeira e restaurar a Subtarefa; a restauração que promove a raiz (12.4) exige apenas `excluir` sobre a Subtarefa. |
| administrar | Compartilhar uma Subtarefa (alcance: sua subárvore). |

### 17.2 Visibilidade parcial da árvore

Por herança da Lista, quem vê a raiz vê a árvore. Por compartilhamento no escopo `registro` sobre uma Subtarefa, ou por escopo `próprios` (B29) em que o Sujeito é Responsável só da Subtarefa, é possível ver uma Subtarefa **sem ver o pai**. Isso é válido: a Subtarefa mostra "pai sem acesso" (ou nada, conforme o produto), nunca os atributos do pai; as Ferramentas de Agente que percorrem a árvore param na fronteira de `ver` e o evento é registrado (RN-LIS-23, B23). O contrário — ver o pai sem ver uma Subtarefa — só ocorre no escopo `próprios`; Painéis então contam só o que o visualizador vê (B20), e o Progresso de Subtarefas exibido pode diferir do calculado sobre a árvore inteira; o produto deve sinalizar.

### 17.3 IA sujeita às mesmas regras

Agente e Automação criam, promovem, rebaixam e concluem Subtarefas com as mesmas permissões e verificações que um Membro (A6.3; 17.5 do documento 06): limite de profundidade, Limites impostos, ancestral/descendente em Dependências, `editar` sobre o pai. Nenhuma Automação eleva a permissão do Agente (B22). Um Agente Responsável por uma Subtarefa não executa por esse fato (RN-TAR-27).

## 18. Eventos relevantes

Todos os eventos de Tarefa (documento 06, seção 18) aplicam-se, emitidos pela própria Subtarefa. Específicos da posição:

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Tarefa criada (com pai) | 12.1 | identificador, pai, raiz, nível, origem (direta, Item convertido, Template, ocorrência, Automação). Rebaixamento não cria: emite "Pai alterado". | Automações (Condição "tem pai"); Progresso do pai; Painéis |
| Pai alterado | Promoção, rebaixamento, reparentagem, restauração como raiz (12.3, 12.4) | pai antes/depois, raiz antes/depois, nível antes/depois, causa (`promoção`, `rebaixamento`, `reparentagem`, `restauração`), Lista de destino se houve movimentação, Responsáveis liberados | Progresso dos pais antigo e novo; Painéis; Automações; reavaliação de compartilhamentos; na causa `restauração`, notificação aos Responsáveis do antigo pai |
| Progresso de Subtarefas alterado | No pai, quando uma Subtarefa direta muda de categoria, entra ou sai do estado efetivo `ativo`, é criada, promovida, rebaixada ou eliminada | pai, categoria do pai, progresso antes/depois, Subtarefa causadora | Automações de propagação (20.3); Painéis; notificação a Responsáveis do pai |
| Profundidade máxima atingida | Criação, rebaixamento, reparentagem ou conversão rejeitados por RN-STA-04 | pai pretendido, nível pretendido, máximo, ator | Notificação ao ator; Agentes (para replanejar como Item de Checklist ou irmã) |

Todos geram Registro de Atividade com ator e ator delegante (A6.2). A raiz pode ser notificada dos eventos das descendentes como agregação; os eventos permanecem da Subtarefa.

## 19. Dependências

**A Subtarefa depende de:** a Tarefa pai (existência; cascata); a raiz (Lista, configuração, origem de permissão); a Lista e, transitivamente, Espaço e Espaço de Trabalho (documento 06, seção 19); a Profundidade máxima de Subtarefas (Espaço de Trabalho, B34); um Ator com `criar` na Lista e `editar` no pai.

**Dependem da Subtarefa:** seus componentes (agregado) e suas Subtarefas (cascata). Dependem parcialmente: Vínculos e Dependências (removidos na eliminação), o Progresso de Subtarefas do pai (derivado), Execuções e Sessões de Chat ancoradas, Registros de Atividade (permanecem, INV-ET-12).

**Documentos que este condiciona:** Checklist (08) aplica 20.4 e DO-TAR-11; Status (09) recebe RN-STA-03 e RN-STA-07; Automações recebe "Progresso de Subtarefas alterado" e "Pai alterado" como Gatilhos e "tem pai / nível / raiz" como Condições; Painéis recebe RN-STA-17; Agentes recebe 17.3 e o evento "Profundidade máxima atingida"; Espaço de Trabalho (01) tem RN-ET-17 detalhado por DO-STA-07.

## 20. Casos limítrofes e ambiguidades

### 20.1 Subtarefa com Responsável diferente do pai

Caso normal, não exceção: decompor existe para isso (seção 16). O Responsável do pai não vê "suas Tarefas" incluírem a Subtarefa; Painéis de carga contam cada Tarefa pelo seu Responsável. Quem precisa de "tudo que está sob mim" usa a Dimensão "raiz" ou o escopo `subárvore` de Visualização, não herança de Responsável.

### 20.2 Subtarefa vencendo depois do pai

Permitido por padrão (DO-TAR-06, RN-STA-08): a raiz pode representar a entrega principal e uma Subtarefa um acompanhamento posterior. Painéis que precisem de "vencimento efetivo da árvore" usam o derivado (maior vencimento entre raiz e descendentes). Listas rigorosas habilitam "datas de Subtarefas contidas no pai", que rejeita a data — e, ao ser habilitada com árvores já inconsistentes, não reescreve nada: sinaliza e passa a validar novas edições (princípio de RN-ET-17).

### 20.3 Pai concluído e Subtarefa reaberta depois

O pai **não** volta automaticamente (RN-STA-07): reabrir o pai é ato com ator, e reescrever o status de uma Tarefa por efeito colateral de outra viola INV-TAR-13 em espírito. A Subtarefa reaberta emite no pai "Progresso de Subtarefas alterado" com categoria do pai `concluído`/`fechado`; a Lista pode ter Automação "se o pai está em categoria terminal e o progresso deixou de ser 100%, reabrir o pai", registrada como ato da Automação. Com a Funcionalidade "exigir Subtarefas concluídas" habilitada, reabrir a Subtarefa continua permitido: a Funcionalidade valida a transição do pai, não a das filhas. A alternativa — rejeitar a reabertura da filha — impediria corrigir um erro em uma parte sem antes reabrir o todo, e foi rejeitada; a condição "pai concluído com Subtarefa aberta" é derivada, visível a Painéis, e a Lista que a considera inaceitável a resolve por Automação.

### 20.4 Item de Checklist convertido em Subtarefa de uma Subtarefa no nível máximo

A conversão criaria uma Tarefa de nível máximo + 1: **rejeitada** (RN-STA-04), com evento "Profundidade máxima atingida"; o Item permanece Item, não é marcado como convertido. O Ator pode, em ato explícito, converter com **pai explícito**: o pai da Subtarefa do Checklist (a nova Tarefa nasce **irmã**) ou nenhum (nasce raiz na mesma Lista) — é a mesma operação de conversão com pai indicado (documento 08, 12.3 e 20.5): o Item é marcado `convertido` e a Tarefa criada tem Proveniência "convertida de Item". Agentes recebem o evento e devem replanejar, não repetir.

### 20.5 Promover Subtarefa que tem Dependência com o antigo pai

O estado de partida **não existe**: Dependência entre ancestral e descendente é proibida (INV-TAR-09), e vincular Tarefas que já têm Dependência entre si como pai e filha é rejeitado (RN-TAR-16, 20.9 do documento 06). Logo a pergunta é a inversa: depois da promoção, criar "antigo pai bloqueia ex-Subtarefa" torna-se válido, porque já não há relação hierárquica; o grafo de Dependências é verificado como entre quaisquer Tarefas. O caso real de risco é o **rebaixamento**: vincular X sob Y quando X, ou qualquer descendente de X, tem Dependência com Y ou com qualquer ancestral de Y — rejeitado por inteiro; o ator remove a Dependência (a hierarquia passará a expressá-la) e repete. Dependências entre irmãs, e entre uma Subtarefa e Tarefas fora da árvore, permanecem válidas antes e depois de qualquer operação de pai.

### 20.6 Reduzir a Profundidade máxima com Subtarefas além do novo limite

Duas alternativas: **(a)** rejeitar a redução enquanto houver árvore mais profunda; **(b)** aceitar e manter as árvores legadas. Recomendação: **(b), com congelamento estrutural** (RN-STA-05, DO-STA-07). Justificativa: (a) torna a configuração refém dos dados — um Administrador precisaria reestruturar centenas de árvores antes de mudar um número — e contradiz RN-ET-17, já decidido no documento 01; por outro lado, tornar as árvores legadas inteiramente somente leitura puniria trabalho em andamento (status, Comentários, Registros de Tempo) por uma mudança de configuração, violando o princípio de que configuração nunca produz cascata destrutiva (DO-LIS-14). O congelamento é só estrutural: nada nasce nem desce além do máximo; subir de nível é permitido; o restante opera. O evento de alteração da Profundidade máxima informa quantas Tarefas ficaram além do limite, para que o Administrador decida.

### 20.7 Subtarefa vinculada a Negócio quando a raiz está arquivada

A Subtarefa está em estado efetivo `arquivado` (seção 11). O Vínculo é preservado; do lado do Negócio, a Tarefa aparece como arquivada, e Painéis de "Tarefas abertas do Negócio" a excluem pelo estado efetivo. Criar um Vínculo novo com uma Subtarefa efetivamente `arquivado` é rejeitado como qualquer edição de Tarefa arquivada (somente leitura, exceto Comentário — documento 06, seção 11). Restaurar a raiz devolve tudo, sem tocar no Vínculo.

### 20.8 Agente criando 200 Subtarefas por Automação

Nenhuma regra ontológica impede: a cardinalidade é 0..N (seção 9). O que limita é (i) Limite imposto de Subtarefas por Tarefa ou de Tarefas por Lista (B34; RN-LIS-18), verificado a cada criação — a 201ª é rejeitada, a Execução registra a falha, o evento "Limite atingido" é emitido (RN-ET-23); (ii) o nível de autonomia do Agente (B22): em `assistido` cada criação aguarda aprovação, e o produto deve agrupar; (iii) permissões (`criar` na Lista, `editar` no pai) avaliadas a cada Ferramenta (B23). Registrar limite como regra da entidade seria copiar limitação de produto para a ontologia; por isso é RN-STA-18, que remete a B34.

### 20.9 Painel contando Tarefas: Subtarefas contam?

Como Subtarefa é Tarefa, uma Fonte de Dados "Tarefas da Lista X" abrangeria as Subtarefas — e "12 Tarefas atrasadas" passaria a depender da granularidade com que cada equipe decompõe. Recomendação (RN-STA-17, DO-STA-09): a Fonte de Dados **exclui Subtarefas por padrão** e oferece a escolha explícita "incluir Subtarefas", com "nível", "raiz" e "tem pai" como Dimensões e Filtros. A alternativa "incluir por padrão" foi rejeitada porque infla contagens e mistura entregas com partes; a alternativa "duas Fontes de Dados" recai na alternativa A da seção 3.1. Métricas de esforço (tempo registrado) devem oferecer "agregado por raiz" como Métrica, para que a soma não dependa da escolha de inclusão.

### 20.10 Pai movido para Lista com Conjunto de Status diferente

O mapeamento é da árvore inteira (12.4 do documento 06; RN-LIS-06): cada Definição em uso por qualquer Subtarefa mapeia para uma Definição do destino da mesma categoria; a categoria de nenhuma Subtarefa muda sem ato explícito (INV-TAR-13). Uma Subtarefa cuja Definição não exista no destino nem por categoria segue a regra do documento 06 (20.5). Definições de Campo que deixam de se aplicar arquivam Valores em cada Subtarefa (DO-TAR-17). Responsáveis de Subtarefas sem `ver` no destino são liberados, Subtarefa a Subtarefa. Um único Registro de Atividade de movimentação na raiz, com um Registro por Tarefa mapeada.

### 20.11 Subtarefa `na lixeira` por ato próprio quando a raiz é enviada à lixeira e depois restaurada

A Subtarefa já estava `na lixeira` por ato próprio (estado próprio `na lixeira`); enviar a raiz à lixeira não reescreve esse estado. Restaurar a raiz devolve a cada descendente o estado que o seu estado próprio determina: as que tinham estado próprio `ativo` voltam a efetivo `ativo`; ela permanece na lixeira (seção 11; B36). Se o prazo da Política de lixeira dela expirar antes, é eliminada isoladamente, e o pai perde a Subtarefa com Registro de Atividade. Se a raiz for eliminada permanentemente enquanto ela está na lixeira, é eliminada junto (12.6).

### 20.12 Rebaixar uma raiz sob uma Subtarefa da sua própria árvore

Rejeitado (INV-STA-02): criaria ciclo na cadeia de pais. A verificação percorre a cadeia de pais do novo pai até a raiz e rejeita se encontrar a Tarefa rebaixada.

### 20.13 Subtarefa compartilhada com Convidado que não vê a raiz

Válido (17.2). O Convidado vê a Subtarefa e seus descendentes, comenta ou edita conforme a concessão, pode ser Responsável dela, e não vê o pai, a raiz, a Lista nem registros vinculados. Se a Subtarefa for promovida, o compartilhamento sobre ela permanece (o Recurso é a mesma Tarefa); se for reparentada sob outra raiz, idem. Se o compartilhamento que ele tinha vinha da **raiz** e a Subtarefa é promovida, ele perde acesso e é liberado como Responsável (RN-STA-16).

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Lista, Conjunto de Status, Definições de Campo, Tipos, Funcionalidades, Automações | Lista da raiz e ancestrais | B25; a Subtarefa só consome, e por derivação da raiz. |
| Profundidade máxima de Subtarefas | Espaço de Trabalho (objeto de valor) | B34. A Subtarefa tem nível; o limite não é dela. |
| Limite de Subtarefas por Tarefa | Limites impostos (plataforma) | B34; RN-STA-18. |
| Progresso de Subtarefas | Tarefa pai (derivado) | É atributo derivado de quem tem filhas, não de quem tem pai. |
| Status, datas, Responsáveis, Prioridade, Tags, Valores "do pai" | Tarefa pai | Nada é herdado (seção 16). |
| Comentários, Registros de Tempo e Anexos da Subtarefa exibidos na raiz | Subtarefa | Visão agregada é apresentação; o registro pertence à Subtarefa (DO-TAR-07). |
| Item de Checklist "equivalente" | Checklist da Tarefa de origem | Conversão cria Tarefa nova; o Item permanece marcado como convertido (DO-TAR-11). |
| Ordem de exibição da árvore | Posição entre irmãs (atributo) e Visualização | A posição é atributo; expandir/recolher é apresentação. |
| Automações de propagação | Lista e ancestrais (escopo); Espaço de Trabalho (propriedade) | Propagação é Ação de Automação (DO-STA-03). |
| Tarefas vinculadas e dependentes | Elas mesmas | Associação; só o pai contém (documento 06, seção 21). |
| Proprietário | Não existe | A7; RN-TAR-08. |
| "Tipo Subtarefa" | Não existe | Subtarefa é predicado sobre Tarefa pai, não Tipo de Tarefa (3.3). |

## 22. Exemplos conceituais

**Exemplo 1 — Decomposição e independência.** "Implantar unidade Norte" (OPS-1200, raiz, Lista "Implantação") tem Subtarefas "Contratar recepção" (OPS-1201, Responsável: Ana, RH), "Instalar sistema" (OPS-1202, Responsável: Agente "Provisionador") e "Treinar equipe" (OPS-1203, vence uma semana depois da raiz — permitido). OPS-1202 tem Subtarefa "Configurar impressoras" (nível 2). Com Profundidade máxima 3, "Configurar impressoras" ainda pode ter uma Subtarefa; a filha desta, não. O gerente conclui OPS-1200 com OPS-1203 aberta: permitido; o Painel do diretor, com "incluir Subtarefas" desligado, mostra a implantação concluída; o Painel do RH, com a Dimensão "raiz", mostra OPS-1203 pendente.

**Exemplo 2 — Promoção e movimentação.** "Instalar sistema" cresceu e a equipe de TI quer levá-la para a Lista "TI" (outro Espaço). Mover OPS-1202 diretamente é rejeitado: é Subtarefa. Ela é promovida (Pai alterado: OPS-1200 → nenhum; "Configurar impressoras" desce para nível 1) e depois movida como raiz, com mapeamento de status para o Conjunto de "TI". Identificador, Comentários e os 90 minutos registrados pelo técnico permanecem. O gerente cria então a Dependência "OPS-1202 bloqueia OPS-1203" — agora válida, porque já não são ancestral e descendente. Um Vínculo "relacionada a" entre OPS-1200 e OPS-1202 registra a origem.

**Exemplo 3 — Lixeira e legado.** Um Membro envia OPS-1201 à lixeira por engano (estado próprio `na lixeira`). Dias depois a raiz OPS-1200 é enviada à lixeira: as demais descendentes passam a efetivo `na lixeira` com estado próprio `ativo` inalterado. Restaurar a raiz devolve OPS-1202 e OPS-1203 a efetivo `ativo`; OPS-1201 permanece na lixeira até ser restaurada por ato próprio — sob o pai, já `ativo`. Enquanto isso, o Administrador reduz a Profundidade máxima de 3 para 1: "Configurar impressoras" (nível 2) permanece, operável; criar algo abaixo dela é rejeitado; reparentá-la para nível 1 é permitido.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO  [Profundidade máxima de Subtarefas: n (recomendação 3); Limites impostos]
└── … → LISTA  [define Conjunto de Status, Definições de Campo, Tipos, Funcionalidades,
                Automações (inclusive de propagação), permissões]
        │
        └── TAREFA raiz  (nível 0; sem pai; determina a Lista da árvore)
             │  Progresso de Subtarefas (derivado)
             │
             ├── SUBTAREFA  (0..N; nível 1)  = TAREFA com Tarefa pai preenchido
             │    │  Lista: derivada da raiz  ·  raiz: derivada  ·  nível: derivado
             │    │  estado próprio (gravado) · estado efetivo (derivado — B36)
             │    │  status, Responsáveis, datas, Prioridade, Tipo, Tags, Valores: PRÓPRIOS
             │    │  agregado próprio: Comentários, Checklists, Registros de Tempo, Anexos,
             │    │                    Regra de Recorrência (ocorrência = irmã), Compartilhamento público
             │    │  associações próprias: Vínculos, Dependências (nunca com ancestral/descendente)
             │    │
             │    └── SUBTAREFA  (0..N; nível 2)
             │         └── SUBTAREFA  (0..N; nível 3 = máximo → criação abaixo rejeitada)
             │
             └── SUBTAREFA  (nível 1) …

Operações sobre o atributo Tarefa pai (identidade preservada; evento "Pai alterado"):
  promover   : nível k → 0 (vira raiz na mesma Lista; subárvore sobe junto)
  rebaixar   : raiz → nível k (mesma Lista; profundidade e Dependências verificadas)
  reparentar : pai A → pai B (idem)
Mover de Lista: só a raiz; a árvore inteira acompanha, com mapeamento por Tarefa.
Cascata de estado: por derivação (raiz → descendentes, sem reescrever estado próprio); restaurar devolve a cada uma o seu estado próprio.
```

## 24. Decisões ontológicas

- **DO-STA-01.** Subtarefa é especialização contextual de Tarefa: Tarefa com Tarefa pai preenchido; mesma entidade, identidade, capacidades, agregado, permissões e eventos. A alternativa "entidade distinta" é rejeitada por duplicar a ontologia de Tarefa, impedir promoção e rebaixamento com identidade e obrigar Painéis, Automações e Agentes a tratar dois tipos. Aplica B1 (RECOMENDADA na constituição); sem decisão nova — a seção 3.1 registra a análise comparativa que a sustenta.
- **DO-STA-02.** Promover, rebaixar e reparentar preservam a identidade e o agregado inteiro, geram o evento "Pai alterado" e Registro de Atividade; nunca criam registro novo. Aplica B1 e o teste de identidade de DO-TAR-10. RECOMENDADA.
- **DO-STA-03.** A Subtarefa herda do pai apenas posição (Lista, raiz, nível, estado efetivo). Status, Responsáveis, Observadores, datas, Prioridade, Tipo, Tags, Valores de Campo, Anexos e Estimativa são próprios. "Propagação" é Ação de Automação, com ator Automação e ator delegante, nunca herança ontológica. Aplica DO-TAR-06 e DO-TAR-10. RECOMENDADA.
- **DO-STA-04 / B43.** Estado próprio (gravado) e estado efetivo (derivado: o mais restritivo da cadeia Lista → raiz → … → Subtarefa) coexistem; nenhuma "origem do estado" é gravada, porque é derivável; restaurar um ancestral devolve a cada descendente o estado que o seu estado próprio determina; restaurar da lixeira devolve o Estado próprio anterior à exclusão e exige pai imediato não efetivamente `na lixeira`; atos sobre o estado próprio sob ancestral efetivamente `arquivado` são permitidos, com o efetivo derivado. Aplica B36, DO-TAR-18 e DO-LIS-09; substitui a versão anterior desta decisão, que gravava origem `própria`/`cascata` (rejeitada por B36). Consolidada em B43.
- **DO-STA-05.** Restaurar Subtarefa cujo pai está `na lixeira` e não é restaurado no ato promove-a a raiz na mesma Lista, com evento e Registro; a relação não é refeita automaticamente. Pai `ativo` ou `arquivado`: restaura sob ele. Detalha RN-TAR-28. RECOMENDADA.
- **DO-STA-06.** Progresso de Subtarefas é derivado sobre as Subtarefas diretas em estado efetivo `ativo`; nunca altera o status do pai. RECOMENDADA.
- **DO-STA-07.** Reduzir a Profundidade máxima é aceito com árvores legadas **estruturalmente congeladas** (nenhuma criação, rebaixamento ou reparentagem que resulte em nível além do máximo; subir de nível é permitido; operação normal preservada). Rejeitar a redução, ou tornar o legado somente leitura, foram rejeitados. Detalha RN-ET-17. RECOMENDADA.
- **DO-STA-08.** Subtarefa pode carregar Regra de Recorrência; a ocorrência gerada nasce com o mesmo pai da corrente (irmã, mesmo nível). Aplica DO-TAR-14. RECOMENDADA.
- **DO-STA-09.** Fontes de Dados de Painel sobre Tarefas excluem Subtarefas por padrão; incluí-las é escolha explícita, com "nível", "raiz" e "tem pai" como Dimensões e Filtros. RECOMENDADA.
- **DO-STA-10.** Criar Subtarefa exige `criar` na Lista e `editar` sobre o **pai imediato**; promover, rebaixar e reparentar exigem `editar` sobre a Tarefa movida e sobre cada pai envolvido. **Precisão ao documento 06** (12.1 e 17.1 diziam "raiz"; já dizem "pai imediato"): coincidem sob herança da Lista; divergem só sob compartilhamento de Subtarefa intermediária, cujo alcance é a própria subárvore (DO-TAR-16). RECOMENDADA.
- **DO-STA-11.** Dependência entre ancestral e descendente é verificada também no rebaixamento e na reparentagem, sobre toda a subárvore trazida contra todos os novos ancestrais; a operação é rejeitada por inteiro. Após promoção, Dependência entre ex-pai e ex-filha é válida. Aplica DO-TAR-09. RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99 (B1 consolidou DO-STA-02, DO-STA-07, DO-STA-09 e DO-STA-10; B43, DO-STA-04 e DO-STA-05). Este documento não propõe alteração a decisão vigente; DO-STA-10 propôs precisão de redação ao documento 06, já aplicada (12.1 e 17.1 de 06 dizem "pai imediato").

## 25. Questões em aberto

1. **Teto da plataforma para a Profundidade máxima.** B34 diz que a configuração fica "dentro de tetos da plataforma"; o valor do teto não está fixado. Consequência: Templates e Agentes que geram árvores precisam de um máximo absoluto conhecido. Recomendação: teto pequeno e fixo (5), documentado com os Limites impostos (C8).
2. **Limite de Subtarefas por Tarefa** (questão 25.7 do documento 06; C8). Sem teto ontológico; se a plataforma impuser, é Limite imposto e vale igualmente para Agentes (20.8).
3. **Reabertura de Subtarefa sob pai concluído com "exigir Subtarefas concluídas" habilitada.** Decidido aqui como permitido (20.3). Se o produto preferir que a Funcionalidade garanta a coerência ao longo do tempo (e não só no ato de concluir o pai), a alternativa é "reabrir a filha reabre o pai" como Automação fornecida pela plataforma, habilitada junto com a Funcionalidade — não regra ontológica.
4. **"Nível" como Dimensão padrão de Painéis** — resolvida no documento 21 (RN-PAI-17; DO-PAI-14): "nível", "raiz" e "tem pai" são Dimensões e Filtros disponíveis apenas com "incluir Subtarefas"; "árvore" (raiz → descendentes) não é oferecida como forma de agrupamento; "raiz" é Dimensão (documento 21, 25, último parágrafo). Sem pendência.
5. **Subtarefa em Template de Tarefa e em Template de Lista.** Templates descrevem Subtarefas (documento 06, 4); a profundidade descrita no Template pode exceder o máximo do Espaço de Trabalho de destino. Recomendação: instanciar rejeita ou achata com Registro, conforme o documento de Templates; nunca instancia além do máximo.
