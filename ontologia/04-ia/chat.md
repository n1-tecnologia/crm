# CHAT

> Domínio: IA | Documento 16 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

**Chat** é o ambiente em que um **Membro** interage diretamente com o sistema de IA do Espaço de Trabalho: faz perguntas, pede análises, envia Arquivos e solicita ações, e recebe respostas produzidas por um Agente. Chat não é uma entidade: é o nome do ambiente (como "CRM" e "Conhecimento" são nomes de domínio ou camada — documento 01, 7.7). A entidade é a **Sessão de Chat** (B21).

Uma **Sessão de Chat** é uma sequência identificável de **Mensagens de Chat** trocadas entre exatamente um Membro (o seu **Proprietário**, A7) e a IA, dentro de um Espaço de Trabalho, com:

- 0..1 **registro âncora** (Tarefa, Negócio, Contato, Empresa, Conversa, Documento de Conhecimento ou contêiner estrutural), que constitui o seu Contexto inicial e o assunto em torno do qual a Sessão gira (B21; seção 7.4);
- 0..1 **Agente principal**, que responde ao Membro; ausente, responde o **Assistente padrão** do Espaço de Trabalho (B17, B33);
- um **Modelo efetivo** (entidade global, A1.3): o do Agente principal, ou um Modelo escolhido pelo Membro quando o Agente o admite;
- 0..N **Arquivos** enviados pelo Membro ou gerados pela IA, pertencentes ao Espaço de Trabalho e referenciados pela Sessão (A8);
- 0..N **Execuções de Agente** originadas nela: toda resposta da IA é a saída de uma Execução (B17, B18).

Três propriedades distinguem a Sessão de Chat de tudo o mais que contém "mensagens" na plataforma:

1. **O outro lado é a IA, não uma pessoa.** Na Conversa (CRM) o outro lado é um Contato externo por um Canal; no Comentário, outros Atores da organização. Na Sessão, o Membro fala com um Agente e o Agente responde por meio de uma Execução. Nada do que se diz numa Sessão chega a alguém fora dela sem ato explícito (Rascunho, Ferramenta, "adicionar ao Conhecimento").
2. **É pessoal.** Pertence a um Membro; ninguém mais a vê salvo compartilhamento explícito de leitura (B21). Não é sucedida na remoção do Membro (B28). Nem Administradores a leem por Papel (seção 17).
3. **É humana por origem.** Só um Membro cria uma Sessão. Automações, Agentes e Integrações nunca criam Sessões: o que a IA faz por conta própria acontece em Execuções sem Sessão, e o seu resultado é notificado, registrado ou gravado no registro-alvo — nunca "conversado" (seção 4.7).

A Sessão é privada; **as ações que ela origina não são**. Toda Ferramenta invocada por um Agente durante uma resposta gera Registro de Atividade normal sobre o registro-alvo, com o Agente como Ator e o Membro como ator delegante (A6.2), visível a quem tem acesso a esse registro. O sigilo da Sessão protege o diálogo, nunca o efeito.

## 2. Propósito

- **Dar ao Membro acesso direto e contextual à IA.** A Sessão ancorada a um Negócio, a uma Conversa ou a uma Tarefa permite "pergunte sobre isto" sem que o Membro descreva o registro: o Contexto o carrega, com as permissões do Membro.
- **Tornar cada resposta auditável e reproduzível.** Cada resposta é uma Execução de Agente com Versão de Agente, Modelo, Ferramentas invocadas, Referências de Conhecimento e custo (B18, B24, C8). "Por que a IA disse isso?" e "o que a IA fez?" têm resposta exata.
- **Separar o diálogo privado do efeito corporativo.** A Sessão é espaço de rascunho e raciocínio do Membro; o que ela produz sobre a plataforma (Tarefa criada, Rascunho de resposta, Documento adicionado ao Conhecimento) obedece às permissões, à autonomia do Agente (B22) e à auditoria de sempre.
- **Ser a superfície humana das Solicitações de Aprovação em nome do Membro.** Quando um Agente `supervisionado` precisa de aprovação para uma ação externa pedida na Sessão, quem aprova é o próprio Membro, no lugar em que pediu.
- **Alimentar a Memória do Usuário** (seção 7.5) com preferências de trabalho do Membro, sob o seu controle, para que Sessões futuras não recomecem do zero.

## 3. Natureza da entidade

| Entidade / conceito | Natureza | Identidade | Agregado |
| --- | --- | --- | --- |
| Sessão de Chat | Entidade persistente do domínio IA; raiz de agregado; pertence ao Membro (Proprietário) e, transitivamente, ao Espaço de Trabalho (documento 01, 8). Recurso de permissão (seção 17). Não é Ator. | Própria, opaca, imutável. | Raiz: contém Mensagens de Chat; carrega Âncora, Configuração da Sessão e Compartilhamentos; referencia Agente principal, Modelo, Arquivos e Execuções. |
| Mensagem de Chat | Entidade interna da Sessão (composição): identificador próprio, sem existência fora dela. Imutável depois de gravada (RN-CHT-12). | Própria, opaca; referenciável por outra Mensagem ("substitui"), por Execução e por Proveniência de Rascunho/Mensagem (CRM). | Membro do agregado da Sessão. |
| Âncora | Objeto de valor da Sessão: tipo de registro + identificador + nome à época; validade derivada. | Nenhuma. | Vive na Sessão. |
| Configuração da Sessão | Objeto de valor: Modelo escolhido, Restrição de Ferramentas, título editado. | Nenhuma. | Vive na Sessão. |
| Compartilhamento da Sessão | Permissão (Sujeito, `ver`, Sessão, `registro`, compartilhamento — A9.1). | Pelo par (Sessão, Sujeito). | Vive no Recurso (Sessão). |
| Contexto | Objeto de valor **efêmero**, montado pelo Sistema a cada Execução (Glossário). | Nenhuma. | Não persiste; a Execução registra o que o compôs (referências). |
| Memória do Usuário | Entidade interna do **Membro** (não da Sessão), composta por Itens de Memória; alimentada por Sessões (seção 7.5). | Item: própria, local ao Membro. | Agregado do Membro (documento 01, 7.1 — impacto registrado na seção 24). |
| Execução de Agente | Entidade do Agente (B18); a Sessão apenas a **origina** e a referencia. | Do Agente. | Do Agente. |
| Chat | Ambiente; não é entidade. | — | — |

## 4. Fronteira conceitual

### O que é

- O diálogo de uma pessoa com a IA da organização, com histórico, Arquivos e Contexto próprios.
- A origem humana de Execuções de Agente: cada resposta e cada ação pedida na Sessão é uma Execução com o Membro como delegante.
- Um objeto de privacidade: o único registro corporativo, ao lado da Memória do Usuário, que é pessoal por definição (B21, B28).

### O que não é

- **Não é Conversa** (CRM). A Conversa é da organização com um Contato por um Canal; a Sessão é de um Membro com a IA (4.1).
- **Não é Agente.** O Agente é o Ator configurável que responde; a Sessão é o ambiente em que ele responde a um Membro específico (4.2).
- **Não é Execução.** A Execução é a unidade de funcionamento do Agente; a Sessão origina muitas (4.3).
- **Não é Automação.** Não tem Gatilho, Condição nem Ação; não reage a nada; é iniciada por pessoa (4.7).
- **Não é Memória.** A Memória persiste entre Sessões e pertence ao Membro ou ao Agente; a Sessão é um episódio (4.8).
- **Não é Conhecimento.** Nada do que se diz ou envia na Sessão é curado; um Arquivo da Sessão só vira Documento por "adicionar ao Conhecimento" (4.9; documento 20, 20.16).
- **Não é Comentário.** Comentário é manifestação de um Ator sobre um registro, visível a quem vê o registro; a Mensagem de Chat é fala privada a um Agente (4.5).
- **Não é Rascunho de Conversa.** O Rascunho é objeto de valor da Conversa; a Sessão pode alimentá-lo por cópia (4.10; DO-CXE-15).

### 4.1 Sessão de Chat × Conversa (CRM)

Coerente com o documento 14, seção 4; repetida aqui pelo lado da IA.

| Critério | Sessão de Chat (IA) | Conversa (CRM) |
| --- | --- | --- |
| Partes | Um Membro e a IA (um Agente por resposta). | A organização e exatamente um Contato principal, por um Canal (B12). |
| Domínio e contêiner | IA; pertence ao Membro; escopo do Espaço de Trabalho. | CRM; contida pela Caixa de Entrada (B11). |
| Unidade interna | Mensagem de Chat, com papel (`usuário`, `assistente`, `sistema`, `ferramenta`); sem entrega, sem Contato. | Mensagem, com direção (`recebida`, `enviada`, `interna`), status de entrega, identificador externo. |
| Responsabilidade | Proprietário (Membro) — tudo. | Sem Proprietário (DO-CXE-02); Atribuído 0..1 (Membro ou Agente); Fila. |
| Visibilidade | Privada; `ver` só por compartilhamento explícito do Proprietário. | Visível a quem tem `ver` na Conversa (Fila, Papel, concessão). |
| Estado | `ativo`, `arquivado`, `na lixeira` (A4.1). | `aberta`, `pendente`, `resolvida` (A4.5). |
| Destino na remoção do Membro | Não sucedida; vai à lixeira com o `removido` e é eliminada por prazo, salvo reconvite (B28; B87). | Sobrevive; Atribuído liberado (B28). |
| Efeito externo | Nenhum por si. Pode produzir Rascunho para uma Conversa ancorada; enviar é ato na Conversa (DO-CXE-15). | É o próprio efeito externo: Mensagens chegam ao Contato. |
| Relação entre elas | Sessão pode ser **ancorada** a uma Conversa (lê com as permissões do Membro). | A Conversa não conhece Sessões (referência inversa). |

Nenhuma Conversa contém Mensagens de Chat; nenhuma Sessão contém Mensagens. Nenhuma Mensagem de Chat vira Mensagem sem ato explícito de envio por Membro ou Agente Atribuído (documento 14, 4).

### 4.2 Sessão de Chat × Agente

| Critério | Sessão de Chat | Agente |
| --- | --- | --- |
| Natureza | Episódio de diálogo de um Membro; não é Ator. | Ator configurável, com identidade, instruções, Modelo, Ferramentas permitidas, Habilidades concedidas, autonomia, Proprietário (Glossário). |
| Cardinalidade | Referencia 0..1 Agente principal; pode invocar outros. | Serve 0..N Sessões simultaneamente; não conhece "as suas Sessões" senão por consulta derivada. |
| Configuração | Objeto de valor próprio (Modelo escolhido, Restrição de Ferramentas), que só **restringe** o Agente. | Configuração versionada (B24), governada pelo seu Proprietário. |
| Troca | Trocar o Agente principal não altera a identidade da Sessão (5). | Arquivar o Agente não elimina Sessões; torna-as sem Agente exercível (20.8). |

A Sessão **usa** o Agente; nunca o contém, configura ou possui. Um Agente nunca é Proprietário de Sessão (INV-CHT-02): a Sessão é ferramenta de trabalho de uma pessoa, e B7 exige accountability humana.

### 4.3 Sessão de Chat × Execução de Agente

| Critério | Sessão de Chat | Execução de Agente |
| --- | --- | --- |
| Pertencimento | Membro. | Agente (B18). |
| Ciclo de vida | `ativo`, `arquivado`, `na lixeira`; dura enquanto o Membro quiser. | `pendente` → `executando` → `aguardando aprovação` / `concluída` / `falhou` / `cancelada`; dura uma resposta. |
| Relação | Origina 0..N Execuções; cada uma referencia a Sessão como origem e o Membro como delegante. | Referencia a Sessão de origem (0..1: Execuções por Automação não têm Sessão). |
| O que registra | O diálogo: Mensagens, Arquivos, Referências exibidas. | O trabalho: Versão de Agente, Modelo, Contexto usado (referências), Ferramentas invocadas com permissão avaliada, Exercícios de Habilidade, Solicitações de Aprovação, custo. |

**Decisão (DO-CHT-04).** Toda Mensagem de Chat com papel `assistente` é a saída de exatamente uma Execução de Agente — do Agente principal ou de um Agente invocado. Não existe resposta da IA sem Execução (B17), nem Execução originada na Sessão sem que o seu resultado apareça nela (como Mensagem `assistente`, `ferramenta` ou `sistema`). Consequência: "o que a IA disse" e "o que a IA fez" são duas visões do mesmo fato, uma na Sessão, outra na Execução.

### 4.4 Mensagem de Chat × Mensagem (CRM)

Coerente com o documento 14, 4. A Mensagem de Chat tem papel, Execução de origem, Referências de Conhecimento e relação "substitui"; não tem direção, status de entrega, identificador externo, Remetente-Participante nem Contato. O único caminho entre elas é o **Rascunho**: uma Mensagem `assistente` copiada para o Rascunho da Conversa ancorada; ao ser enviada, nasce uma Mensagem `enviada` nova, com Proveniência à Sessão (documento 14, 7.6 e 7.10).

### 4.5 Mensagem de Chat × Comentário

| Critério | Mensagem de Chat | Comentário |
| --- | --- | --- |
| Destinatário | A IA (papel `usuário`) ou o Membro (papel `assistente`). | Atores da organização que veem o registro (A8). |
| Onde vive | Na Sessão (privada). | No registro comentado (Tarefa, Negócio, Contato, Empresa, Documento). |
| Autor Agente | `assistente`: sempre Agente, com Execução. | Agente pode comentar (documento 06, 7.1), com delegante; é fala pública sobre o registro. |
| Edição | Imutável; edição é nova Mensagem que substitui (RN-CHT-13). | Editável pelo autor; exclusão com marcador (DO-TAR-07). |
| Menções | Menção a Agente **invoca** (7.2); menção a registro é referência de Contexto. | Menção notifica; não cria Vínculo nem permissão (DO-TAR-19). |

Pedir ao Agente, na Sessão, "comente na Tarefa X" produz um Comentário na Tarefa por Ferramenta, com Ator Agente e delegante Membro; a Mensagem de Chat que pediu continua privada.

### 4.6 Sessão de Chat × Habilidade e Ferramenta

A Sessão não tem Habilidades nem Ferramentas próprias. O Membro pede; o Agente principal decide exercer uma Habilidade concedida (exercício `solicitado`, documento 18, 7.3) ou invocar Ferramentas permitidas, sob as permissões do Membro (interseção, A9.3) e a Restrição de Ferramentas da Sessão (7.3). A Sessão só **restringe**; nunca amplia (INV-CHT-06).

### 4.7 Sessão de Chat × Automação

| Critério | Sessão de Chat | Automação |
| --- | --- | --- |
| Iniciativa | Humana: um Membro escreve. | Reativa: Gatilho → Condição → Ação (B16). |
| Cria a outra? | **Nunca.** Uma Automação não cria Sessões; o resultado de uma Automação é notificado ou gravado, não "chatado" (DO-CHT-13). | **Nunca.** Nem a Sessão nem o Agente criam Automações: não existe Ferramenta para isso (INV-AUT-10; DO-AUT-22; B95). Um pedido "crie uma Automação que…" produz texto que um Membro transforma em rascunho de Automação, com Criador = Membro. |
| Eventos | Eventos da Sessão **não são Gatilhos** (privacidade — RN-CHT-24). | Eventos produzidos pelas Ferramentas invocadas na Sessão sobre registros-alvo (Tarefa criada, Tag aplicada) são Gatilhos normais. |
| Execução | Origina Execuções de Agente com delegante Membro. | Origina Execuções de Automação, que podem conter Execuções de Agente sem Sessão (B18). |

### 4.8 Sessão de Chat × Memória

A Sessão é um episódio; a Memória do Usuário é o que o Membro escolhe reter entre episódios (7.5). A Sessão **alimenta** a Memória (por Ferramenta, com controle do Membro) e **consome** a Memória (no Contexto); nunca a contém. Eliminar Sessões não elimina Itens de Memória; desativar a Memória não altera Sessões. A Memória do Agente (documento 17) é do Agente e não é lida pelo Membro na Sessão senão por meio das respostas.

### 4.9 Sessão de Chat × Conhecimento

Arquivos e Mensagens da Sessão são **Contexto**, não Documentos (documento 20, 20.16; DO-CNH-17). O Agente consulta Conhecimento por Ferramenta, na interseção das permissões (documento 20, 17.3), e a resposta grava Referências de Conhecimento na Mensagem `assistente` (DO-CNH-15). "Adicionar ao Conhecimento" a partir da Sessão cria um Documento com Proveniência à Sessão e ao mesmo Arquivo.

### 4.10 Sessão de Chat × Rascunho de Conversa

O Rascunho é objeto de valor da Conversa, um por Ator interno (DO-CXE-15). Uma Sessão ancorada a uma Conversa produz texto; copiá-lo para o Rascunho é ato do Membro (ou Ferramenta "sugerir resposta", que grava o Rascunho com origem `Sessão de Chat` e a Execução). O Rascunho não é Mensagem de Chat nem a Mensagem de Chat é Rascunho: são dois registros, um na Sessão, outro na Conversa.

## 5. Identidade

A Sessão de Chat tem **identificador opaco, imutável, atribuído pela plataforma** na criação. Esse identificador é a identidade.

**Teste de identidade.** Se o título for alterado, o Agente principal trocado, o Modelo escolhido mudado, a Restrição de Ferramentas reconfigurada, os compartilhamentos concedidos e revogados, novos Arquivos enviados e — hipoteticamente — todas as Mensagens fossem eliminadas por retenção, continua sendo a mesma Sessão: as Execuções passadas continuam a referenciá-la como origem, a Proveniência de Rascunhos e Mensagens (CRM) continua a apontar para ela, os Registros de Atividade continuam a citá-la. A identidade é a **continuidade do episódio de diálogo de um Membro**, não o seu conteúdo nem a sua configuração.

Consequências:

- **Proprietário e Espaço de Trabalho são imutáveis.** A Sessão nunca muda de Membro (nem por sucessão, B28) nem de Espaço de Trabalho (A1.1). Uma Sessão "transferida" seria outra Sessão, e não existe operação de cópia entre Membros nesta versão (25.3).
- **A âncora é imutável** (DO-CHT-03): fixada na criação (ou ausente para sempre). Reancorar mudaria retroativamente o sentido de tudo o que já foi dito; quem quer outro contexto cria outra Sessão.
- **Título não é identidade** e **não é único**: derivado por padrão (7.1), editável pelo Proprietário.
- **Uma Mensagem de Chat** tem identificador próprio, estável, sem existência fora da Sessão (3). A relação "substitui" (7.2) liga Mensagens da mesma Sessão; nenhuma Mensagem muda de Sessão.

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade (5). |
| Espaço de Trabalho | referência | sim | Imutável (A1.1). |
| Proprietário | referência (Membro) | sim | Exatamente um; imutável; igual ao Criador. Único registro cujo Proprietário pode ser Membro `removido` (INV-ET-03, exceção; B28). |
| Criador | referência (Ator) | sim | Sempre o Membro Proprietário (INV-CHT-01). |
| Título | nativo | sim | Derivado até edição: nome da âncora ou resumo da primeira Mensagem `usuário` (o produto deriva; a ontologia só exige que exista). Editável pelo Proprietário; não único. |
| Âncora | objeto de valor | não | 7.4. Fixada na criação; imutável. |
| Agente principal | referência (Agente) | não | 0..1. Vazio significa Assistente padrão (B21, B33). Alterável pelo Proprietário, com evento e Mensagem `sistema` (12.2). |
| Agente principal efetivo | derivado | — | O Agente principal ou, se vazio, o Assistente padrão do Espaço de Trabalho. |
| Modelo escolhido | referência (Modelo, global) | não | 0..1. Só válido se o Agente principal efetivo admitir sobrescrita de Modelo (atributo do Agente, documento 17) e se o Modelo estiver disponível ao Espaço de Trabalho (Limites impostos, B34). |
| Modelo efetivo | derivado | — | Modelo escolhido, senão o Modelo do Agente principal efetivo. Cada Execução grava o Modelo que usou. |
| Restrição de Ferramentas | objeto de valor | não | 7.3. Subconjunto das Ferramentas permitidas ao Agente que o Membro admite nesta Sessão; vazio = sem restrição adicional. |
| Estado de ciclo de vida | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11). A concordância gramatical do produto ("sessão arquivada") não altera o código. |
| Estado próprio anterior à exclusão | nativo (condicional) | condicional | Preenchido enquanto `na lixeira` (B43, por analogia). |
| Agente principal indisponível | derivado (condição) | — | Verdadeiro quando o Agente principal efetivo está `pausado`, `arquivado`, `na lixeira`, eliminado, ou o Membro perdeu `executar` sobre ele (RN-AGE-10; 20.8). Não é estado da Sessão. |
| Compartilhamentos | permissões | 0..N | Concessões `ver`, escopo `registro`, a Membros ou Equipes (17). |
| Mensagens de Chat | entidades internas | 0..N | 7.2. Zero na criação. |
| Arquivos | referências (Arquivo) | 0..N | Derivado das Mensagens: união dos Arquivos referenciados por Mensagens da Sessão, com origem (`enviado` pelo Membro, `gerado` pela IA). Pertencem ao Espaço de Trabalho (A8). |
| Execuções originadas | referência inversa | 0..N | Execuções de Agente cuja origem é esta Sessão (consulta derivada; pertencem aos Agentes). |
| Momentos | nativo | sim | Criação, última Mensagem, arquivamento, exclusão quando aplicáveis. |
| Custo acumulado | derivado | — | Soma do custo das Execuções originadas (C8). Leitura; nunca gravado na Sessão. |

## 7. Entidades internas ou componentes

### 7.1 Título (regra de derivação)

Enquanto o Proprietário não editar, o título é derivado: nome da âncora (com o tipo) quando há âncora; senão, resumo da primeira Mensagem `usuário`; senão, "Nova sessão" com o momento. Editar grava o título e desliga a derivação. Não há unicidade nem colisão: duas Sessões "Proposta Alfa" do mesmo Membro são normais (20.9).

### 7.2 Mensagem de Chat

Unidade de interação dentro da Sessão. **Composição**: pertence a exatamente uma Sessão; nunca é movida. **Imutável** depois de gravada (RN-CHT-12); correções e regenerações são Mensagens novas que **substituem** a anterior (RN-CHT-13).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Próprio, estável (3). |
| Sessão | referência | sim | Imutável. |
| Ordem | nativo | sim | Sequencial dentro da Sessão; nunca reutilizada. A sequência é a ordem de leitura e a base das "Mensagens recentes" do Contexto. |
| Papel | nativo | sim | `usuário`, `assistente`, `sistema`, `ferramenta` (Glossário). Descrição abaixo. |
| Autor | referência (Ator) | sim | `usuário`: o Membro Proprietário. `assistente` e `ferramenta`: o Agente da Execução de origem (principal ou invocado), com o Membro como delegante (A6.2). `sistema`: Sistema. |
| Conteúdo | nativo (texto) | condicional | Texto. Pode ser vazio se houver ao menos um Arquivo (`usuário`, `assistente`). Para `ferramenta`: o resultado retornado ao Modelo, já filtrado pela permissão efetiva. |
| Arquivos | referência (Arquivo) 0..N | não | Ordenados. Cada referência com origem: `enviado` (Membro) ou `gerado` (IA; Criador do Arquivo = Agente, delegante = Membro — DO-CHT-10). |
| Execução de origem | referência (Execução de Agente) | condicional | Obrigatória em `assistente` e `ferramenta`; ausente em `usuário` e `sistema`. |
| Agente autor | derivado | — | O Agente da Execução de origem. Permite ler "quem respondeu" quando há Agentes invocados. |
| Modelo usado | derivado | — | O da Execução de origem. |
| Referências de Conhecimento | objeto de valor 0..N | não | Só `assistente` (documento 20, 7.7; DO-CNH-15). Resolvem com marcador quando o citado desaparece. |
| Ferramenta invocada; passo da Execução | referência | condicional | Só `ferramenta`: identificador estável da Ferramenta, resultado (`concluída`, `negada`, `falhou`, `aguardando aprovação`) e referência ao passo da Execução, onde estão entrada, permissão avaliada e Registro de Atividade. A Mensagem não duplica o passo. |
| Substitui | referência (Mensagem de Chat) | não | 0..1; Mensagem da **mesma Sessão** e do **mesmo papel**, que esta corrige ou regenera (RN-CHT-13). |
| Substituída | derivado (booleano) | — | Verdadeiro quando outra Mensagem a substitui. Fora do Contexto por padrão; visível ao Membro como histórico. |
| Completa | nativo (booleano) | condicional | Só `assistente`: falso quando a Execução foi cancelada com saída parcial (20.13). |
| Momento | nativo | sim | Imutável. |

**Papéis.**

- `usuário` — fala do Membro. Sempre do Proprietário; um Membro com compartilhamento lê, não escreve (INV-CHT-04).
- `assistente` — resposta da IA; sempre saída de uma Execução (DO-CHT-04). Pode conter texto, Arquivos gerados e Referências de Conhecimento. Uma Execução produz no máximo uma Mensagem `assistente` completa; Execuções que falham sem saída produzem Mensagem `sistema`.
- `ferramenta` — **registro** de uma invocação de Ferramenta feita durante uma Execução, inserido na sequência porque as Execuções seguintes precisam saber o que foi feito e o que retornou. É visível ao Membro **como registro, não como fala** (DO-CHT-07): exibe a Ferramenta, o resultado e o resumo; o detalhe está na Execução. Nunca contém o que o Membro não pode ver (INV-CHT-07).
- `sistema` — fato da própria Sessão que altera a interpretação da sequência e por isso entra no Contexto das Execuções seguintes: Agente principal trocado, Modelo trocado, Restrição de Ferramentas alterada, âncora indisponível, Execução cancelada ou falha, Arquivo não suportado pelo Modelo. Sempre Ator Sistema. **Não substitui Registro de Atividade** (que existe para auditoria); existe porque a IA precisa lê-lo. As instruções do Agente **não** são Mensagens `sistema`: são configuração carregada pela Execução (documento 18, RN-HAB-16 por analogia).

### 7.3 Configuração da Sessão (objeto de valor)

- **Modelo escolhido** (6).
- **Restrição de Ferramentas**: lista de Ferramentas (por identificador estável) ou de **classes de efeito** (documento 18, 7.4) que o Membro admite na Sessão. Semântica: as Ferramentas disponíveis a uma Execução originada na Sessão são **Ferramentas permitidas ao Agente ∩ Restrição da Sessão**, e cada invocação ainda passa pela permissão efetiva (A9.3, B23). "Somente leitura" é a restrição à classe `leitura`. A Restrição **só reduz** (INV-CHT-06); um Agente sem uma Ferramenta permitida não a ganha por a Sessão a listar. Alterar a Restrição gera evento e Mensagem `sistema`.
- **Título editado** (7.1).

### 7.4 Âncora (objeto de valor)

Tipo do registro âncora, identificador, nome à época e **validade derivada**: `válida` (o registro existe, tem estado efetivo `ativo` ou `arquivado`, e o Membro tem `ver`), `indisponível` (o Membro perdeu `ver`, ou o registro está `na lixeira`) ou `eliminada` (o registro não existe mais; identificador e nome permanecem como valor). Tipos admitidos (DO-CHT-02): Tarefa (inclusive Subtarefa), Negócio, Contato, Empresa (DO-EMP-14), Conversa, Documento de Conhecimento, e os contêineres Espaço, Pasta, Subpasta e Lista (documentos 02 e 03 já as admitem; Lista e Subpasta por coerência). Não são âncoras: Coleção (consulta-se por Ferramenta), Caixa de Entrada, Fila, Funil, Painel, Agente, outra Sessão, Membro. A âncora **não é Vínculo** (não é bidirecional, não é editável, o registro não a conhece) e **não concede permissão**: o Contexto lê o registro com as permissões do Membro no momento de cada Execução (RN-CHT-17).

### 7.5 Memória do Usuário (entidade interna do Membro, detalhada aqui)

A2.5 atribui Memória aos documentos de IA. A **Memória do Usuário** é uma entidade interna do **Membro** (documento 01, 7.1 — impacto na seção 24), não da Sessão: existe para atravessar Sessões. Composta por **Itens de Memória**, cada um com identificador local, conteúdo (texto curto, afirmação sobre o Membro ou o seu modo de trabalho), origem (Sessão e Execução em que foi gravado; ou `Membro`, quando editado por ele), momento, estado (`ativo`, `desativado`) e Ator gravador (Agente com delegante Membro, ou o próprio Membro). A Memória do Usuário tem um indicador **habilitada** (padrão: sim; o Membro desativa a qualquer momento — nada mais entra no Contexto, nada é gravado, Itens preservados).

Regras essenciais (detalhadas em 13):

- Pertence ao Membro, no Espaço de Trabalho; nunca atravessa Espaços de Trabalho (documento 01, 20.3); não é sucedida (B28).
- Só é escrita por Ferramenta "lembrar" invocada em Execução originada em Sessão do próprio Membro (classe `escrita reversível`; sob B22) ou pelo próprio Membro. Nunca por Execução autônoma, Automação ou outro Membro (INV-CHT-09).
- **Não retém dados de Contatos, Empresas, Negócios ou outras pessoas** (DO-CHT-11): retém preferências e fatos sobre o Membro ("prefere respostas curtas", "trabalha na Fila Suporte", "escreve em português formal"). Um pedido "lembre que o cliente X gosta de..." é recusado como Memória e redirecionado a Comentário no Contato ou a Campo, sob permissão (20.6). Justificativa: C7 e C9 — dado pessoal de terceiro em um repositório pessoal e invisível escapa à eliminação por solicitação do titular (documento 10, 12.5) e à governança do CRM.
- Consultável em qualquer Sessão do Membro (entra no Contexto); nunca visível a outros Membros, a compartilhados, a Administradores, nem a Agentes fora de Execução em nome do Membro. O Membro vê, remove Itens e desativa (controle total; C7).
- Distinta da **Memória do Agente** (documento 17): esta pertence ao Agente e é governada pelo seu Proprietário.

### 7.6 Contexto (objeto de valor efêmero, montado por Execução)

Cada Execução originada na Sessão recebe um Contexto composto pelo Sistema a partir de: (a) a âncora, lida por Ferramenta com a permissão efetiva; (b) as **Mensagens recentes** da Sessão (não substituídas), até o limite de tamanho; (c) os Arquivos da Sessão compatíveis com as Capacidades do Modelo efetivo (DO-HAB-10); (d) Fragmentos de Conhecimento recuperados por Ferramenta (documento 20); (e) a Memória do Usuário, se habilitada; (f) a Memória do Agente; (g) as instruções do Agente e das Habilidades exercidas. **Limites de tamanho são Limites impostos** (B34): o que não cabe fica fora, começando pelas Mensagens mais antigas; a Sessão preserva tudo. O Contexto **não persiste**; a Execução registra o que o compôs por referência (identificadores das Mensagens, Arquivos, Fragmentos, Itens de Memória, âncora e Versão de Agente), o suficiente para auditoria sem copiar conteúdo. **Invariante**: o Contexto nunca contém o que o Membro não pode ver, nem o que o Agente não pode ver (interseção, A9.3; B19; INV-CHT-07).

### 7.7 O que não é componente

Agente, Execução, Modelo, Ferramenta, Habilidade, Arquivo (referenciado), Coleção e Documento, Solicitação de Aprovação (da Execução/Agente, A8), Rascunho (da Conversa), Registro de Atividade (do Espaço de Trabalho), Memória do Agente.

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Membro | propriedade (pertencimento) | Sessão → Membro | Exatamente um Proprietário, imutável (B21). |
| pertence a | Espaço de Trabalho | pertencimento (transitivo) | Sessão → ET | Documento 01, 8. Nunca migra. |
| contém | Mensagem de Chat | contenção (composição) | Sessão → Mensagem | 0..N; sem existência fora. |
| ancora-se a | Tarefa, Negócio, Contato, Empresa, Conversa, Documento de Conhecimento, Espaço, Pasta, Subpasta, Lista | referência (objeto de valor Âncora) | Sessão → registro | 0..1; imutável; o registro não conhece a Sessão (referência inversa nos documentos 02–14 e 20). Não é Vínculo. |
| usa | Agente (principal) | referência (uso) | Sessão → Agente | 0..1; vazio = Assistente padrão. Alterável. |
| usa | Modelo | referência (uso) | Sessão → Modelo | 0..1 escolhido; efetivo derivado. Global (A1.3): usado, nunca possuído. |
| referencia | Arquivo | referência | Mensagem → Arquivo | 0..N por Mensagem; Arquivo do ET (A8), referenciável por outros registros. |
| origina | Execução de Agente | referência inversa | Execução → Sessão | 0..N; a Execução grava a Sessão de origem e o Membro delegante; a Sessão lista as suas Execuções por consulta. |
| é compartilhada com | Membro, Equipe | permissão (compartilhamento; `ver`, `registro`) | Sessão → Sujeito | 0..N. Nunca Agente. Só o Proprietário compartilha (17). |
| substitui | Mensagem de Chat | referência (mesma Sessão) | Mensagem → Mensagem | 0..1; mesmo papel (RN-CHT-13). |
| cita | Documento de Conhecimento, Versão, Fragmentos | Referência de Conhecimento (objeto de valor) | Mensagem `assistente` → Documento | 0..N (DO-CNH-15). |
| alimenta / consome | Memória do Usuário | referência (por Execução) | Execução → Item de Memória | Itens registram a Sessão de origem; o Contexto os consome. Não é contenção. |
| é origem de | Rascunho (Conversa), Mensagem (CRM), Documento de Conhecimento, Tarefa e outros registros criados por Ferramenta | Proveniência (objeto de valor no destino) | destino → Sessão | Sem vínculo vivo; sobrevive à eliminação da Sessão. |
| é registrada em | Registro de Atividade | referência inversa | Registro → Sessão | Atos sobre a Sessão (18). Ações sobre outros registros são registradas neles. |

Distinção aplicada: a Sessão **PERTENCE** ao Membro; **CONTÉM** Mensagens; **USA** Agente e Modelo; **REFERENCIA** âncora e Arquivos; **CONFIGURA** a si própria (Configuração da Sessão — objeto de valor que só restringe); **É REFERENCIADA** por Execuções, Proveniências e Registros; **RELACIONA-SE** com outros Membros apenas por compartilhamento (permissão, não relação de domínio). A Sessão **não HERDA** nada da Estrutura de Trabalho, ainda que ancorada a um contêiner, e **não se relaciona por Vínculo** com nada.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Membro → Sessão | 0..N | sim | sim | pertencimento | Membro que nunca usou Chat é normal. |
| Sessão → Membro (Proprietário) | 1 | não | não | propriedade | B21; A7. Imutável. |
| ET → Sessão | 0..N | sim | sim | pertencimento transitivo | Documento 01, 9. |
| Sessão → Mensagem de Chat | 0..N | sim | sim | composição | Sessão recém-criada é vazia e válida (diferente de Conversa, INV-CXE-05): a Sessão nasce por ato do Membro, antes de qualquer fala. |
| Mensagem → Sessão | 1 | não | não | composição | Nunca movida. |
| Sessão → Âncora | 0..1 | sim | não | objeto de valor | B21. Duas âncoras tornariam o Contexto inicial e o título ambíguos; quem precisa cruzar dois registros usa Vínculo entre eles ou pede na fala. |
| Registro → Sessões ancoradas | 0..N | sim | sim | referência inversa | Vários Membros e várias Sessões do mesmo Membro sobre a mesma Tarefa (20.9). |
| Sessão → Agente principal | 0..1 | sim | não | referência | Vazio = Assistente padrão (B21). Dois "principais" tornariam "quem responde" indeterminado; outros Agentes entram por invocação. |
| Agente → Sessões em que é principal | 0..N | sim | sim | referência inversa | |
| Sessão → Modelo escolhido | 0..1 | sim | não | referência | Padrão: Modelo do Agente. |
| Sessão → Execução originada | 0..N | sim | sim | referência inversa | Zero até a primeira resposta. |
| Execução → Sessão de origem | 0..1 | sim | não | referência | Execuções por Automação ou agendamento não têm Sessão. |
| Mensagem `assistente` → Execução de origem | 1 | não | não | referência | DO-CHT-04. |
| Execução → Mensagem `assistente` | 0..1 | sim | não | referência inversa | Zero quando falha sem saída (gera `sistema`). |
| Execução → Mensagens `ferramenta` | 0..N | sim | sim | referência inversa | Uma por invocação registrada. |
| Mensagem → Arquivo | 0..N | sim | sim | referência | |
| Mensagem → Substitui | 0..1 | sim | não | referência | Cadeias são permitidas (a substituta pode ser substituída). |
| Mensagem → Referência de Conhecimento | 0..N | sim | sim | objeto de valor | |
| Sessão → Compartilhamento | 0..N | sim | sim | permissão | Padrão zero (B21). |
| Membro → Memória do Usuário | 0..1 | sim | não | contenção (no Membro) | Uma por Membro por ET; nasce vazia; habilitada por padrão. |
| Memória do Usuário → Item | 0..N | sim | sim | contenção | |
| Item → Sessão de origem | 0..1 | sim | não | referência | Vazio quando editado pelo Membro. |
| Sessão → Contexto | 1 por Execução | — | — | objeto de valor efêmero | Não persiste. |

Sem `DECISÃO NECESSÁRIA` pendente: as cardinalidades decorrem de A7, A8, B17, B18, B21, B33 e das decisões da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Nenhuma. A Sessão está no domínio IA, par da Estrutura de Trabalho (A2.2). Ancorar-se a um Espaço ou a uma Lista não a coloca sob eles: não herda permissões, configuração nem estado efetivo do contêiner (B36 não se aplica). Eliminar a âncora não elimina a Sessão (12.4).

**Pertencimento (teste de existência).** A Sessão não existe sem o Membro (nem sem o Espaço de Trabalho): é eliminada com ele (documento 01, 12.4). Mensagens não existem sem a Sessão. Âncora, Configuração e Compartilhamentos não existem sem a Sessão. A Memória do Usuário não existe sem o Membro, e existe sem qualquer Sessão. Agente, Modelo, Arquivo, Execução, registro âncora e Coleções existem sem a Sessão. A Execução sobrevive à eliminação da Sessão, com a origem preservada como valor (identificador da Sessão) — como toda Proveniência.

**Propriedade.** O Proprietário é o Membro que a criou, sempre, e nunca muda (INV-CHT-01). Consequências que a distinguem de todo outro registro com Proprietário (A7): (a) **não há sucessão** (B28, exceção única): o Proprietário pode ser `removido`, e a Sessão vai à lixeira com ele até eliminação por prazo ou reconvite (B87); (b) **não há transferência**; (c) o Proprietário do Espaço de Trabalho e os Administradores **não têm acesso por Papel** (17). A justificativa é a natureza do registro: uma Sessão contém o raciocínio, as dúvidas e os rascunhos de uma pessoa; tratá-la como ativo corporativo transferível transformaria o Chat em ferramenta de vigilância e destruiria o seu uso. O conteúdo corporativo produzido na Sessão (Tarefas, Comentários, Documentos, Rascunhos) já está fora dela, nos registros-alvo, com a auditoria de sempre. O que fica preso é só o diálogo, até a eliminação por prazo (B87; 20.1).

**"Pertence a" versus "relaciona-se com".** A Sessão *pertence* ao Membro; *usa* Agente e Modelo; *referencia* a âncora; *origina* Execuções; *relaciona-se* com Membros leitores por compartilhamento. Configurar a Sessão (Modelo, Restrição) não torna Modelo nem Ferramenta filhos dela.

## 11. Estados

Estado de ciclo de vida de sistema (A4.1); não há Status personalizável. Não há estado próprio/efetivo derivado de ancestral (a Sessão não tem ancestral estrutural).

| Estado | Significado | O que é possível |
| --- | --- | --- |
| `ativo` | Em uso. | Ler; escrever Mensagens `usuário`; enviar Arquivos; originar Execuções; editar Configuração; compartilhar; arquivar; excluir. |
| `arquivado` | Encerrada pelo Membro, preservada. | Ler (Proprietário e compartilhados); restaurar. **Não** escrever nem originar Execuções: nova Mensagem `usuário` desarquiva antes (ato explícito, RN-CHT-06). Execuções em andamento terminam (12.3). |
| `na lixeira` | Excluída de forma recuperável, pelo prazo da Política de lixeira. | Ler (só o Proprietário); restaurar. Compartilhamentos suspensos (voltam na restauração). Oculta em toda parte; Proveniências que a apontam resolvem com marcador. |

Eliminação permanente não é estado (12.4).

**Condições derivadas** (não são estados): *Agente principal indisponível* (6; 20.8); *âncora indisponível/eliminada* (7.4); *Execução em andamento* (a Sessão tem 0..1 Execução não terminal por vez — RN-CHT-09); *Aguardando aprovação* (a Execução em andamento está em `aguardando aprovação` e o aprovador é o Proprietário — 20.5).

**Estados da Mensagem de Chat.** Não tem estado de ciclo de vida próprio: segue a Sessão. Tem a condição derivada `substituída` (7.2).

**Estados do Item de Memória.** `ativo`, `desativado` (pelo Membro); remoção é eliminação do Item.

## 12. Ciclo de vida

### 12.1 Criação

Por ato de um Membro `ativo` com `executar` sobre o Agente que será o principal efetivo (17.1): nasce `ativo`, vazia, com Proprietário = Criador = o Membro, âncora opcional (verificada: o Membro tem `ver` sobre o registro no ato — RN-CHT-03), Agente principal opcional, Configuração vazia. Registro de Atividade "Sessão criada". Nenhum outro Ator cria Sessões (INV-CHT-03): Automação, Agente, Integração e Sistema não o fazem; "abrir uma Sessão a partir de um registro" é ato do Membro com âncora preenchida. Limites impostos (número de Sessões, cota de IA) são verificados no ato (RN-ET-23).

### 12.2 Interação

1. **Mensagem `usuário`** — o Proprietário escreve texto e/ou envia Arquivos. O envio de Arquivo cria (ou referencia, se já existente) um Arquivo do Espaço de Trabalho, sujeito a Limites impostos de tamanho e tipo (20.4). Uma Mensagem `usuário` é rejeitada, sem efeito, se: a Sessão não está `ativo`; há Execução em andamento (RN-CHT-09); o Agente principal está indisponível (20.8); o Espaço de Trabalho está `suspenso` (B31); o Membro está `suspenso`.
2. **Execução** — o Sistema inicia uma Execução do Agente principal efetivo (ou do Agente mencionado — 7.2, RN-CHT-15), com Ator invocador = Membro, origem = Sessão, Contexto montado (7.6). Durante a Execução: Ferramentas invocadas geram Mensagens `ferramenta` e Registros de Atividade nos registros-alvo; Habilidades exercidas ficam na Execução; Solicitações de Aprovação (B22) colocam a Execução em `aguardando aprovação`, com o Proprietário como aprovador (20.5); a decisão do Membro é registrada na Solicitação e na Execução, não como Mensagem `usuário`.
3. **Resposta** — a Execução `concluída` grava uma Mensagem `assistente` (texto, Arquivos gerados, Referências de Conhecimento). `falhou` ou `cancelada` sem saída: Mensagem `sistema` com o motivo e a referência à Execução; com saída parcial: Mensagem `assistente` com Completa = falso.
4. **Edição e regeneração** (DO-CHT-06) — editar uma Mensagem `usuário` cria nova Mensagem `usuário` com Substitui = a original e dispara nova Execução; "regenerar" cria nova Execução cuja Mensagem `assistente` tem Substitui = a resposta anterior. As substituídas permanecem, marcadas, fora do Contexto por padrão. Mensagens `assistente` e `ferramenta` posteriores à substituída **não** são apagadas: ficam na sequência como histórico; o produto pode ocultá-las como "ramo anterior".
5. **Atos de configuração** — renomear; trocar Agente principal (exige `executar` sobre o novo; permitido no meio da Sessão, gera evento e Mensagem `sistema`; a Execução em andamento termina com o Agente com que começou); trocar Modelo escolhido (idem); alterar Restrição de Ferramentas (idem); compartilhar e revogar (17).
6. **Invocação de outro Agente** — por menção na Mensagem `usuário` ou por Ferramenta "invocar Agente" usada pelo Agente principal: a Execução do Agente invocado tem origem = esta Sessão, invocador = o Agente invocador (com delegante Membro) ou o Membro (menção), e a sua saída é Mensagem `assistente` com Agente autor = o invocado. `executar` sobre o Agente invocado é exigido dos **dois** lados: do invocador (o Agente invocador, com a Ferramenta permitida — RN-AGE-13; ou o Membro, na menção — RN-CHT-15) e do Membro delegante (interseção, A9.3; DO-CHT-17). Profundidade da Cadeia de Execuções é regra do documento 17 (B79); a Sessão só exige que toda Execução da Cadeia referencie a Sessão e o Membro (RN-CHT-16).

### 12.3 Arquivar, excluir, restaurar

- **Arquivar / desarquivar** (Proprietário): Execução em andamento **termina** (não é cancelada: arquivar é organização, não interrupção); a Sessão fica somente leitura. Nova Mensagem exige desarquivar (RN-CHT-06).
- **Enviar à lixeira / restaurar** (Proprietário): Execução em andamento passa a `cancelada` (a Sessão deixa de existir para o Membro); Solicitações de Aprovação pendentes da Sessão são canceladas; compartilhamentos suspensos. Restaurar devolve ao Estado próprio anterior à exclusão (B43, por analogia) e reativa os compartilhamentos.
- **Cancelar a Execução em andamento** (Proprietário): ato sobre a Execução (documento 17), refletido na Sessão por Mensagem `sistema` ou `assistente` parcial (20.13).

### 12.4 Eliminação permanente e cascata

Por prazo da Política de lixeira, por eliminação antecipada pelo Proprietário, ou com o Espaço de Trabalho (B32). Elimina a Sessão, todas as Mensagens, a Âncora, a Configuração e os Compartilhamentos. **Preservados**: Arquivos (do Espaço de Trabalho; perdem a referência; eliminados pelo Sistema apenas se nenhum outro registro os referenciar — mesmo princípio de RN-CNH-24), Execuções (do Agente; a origem fica como valor), Registros de Atividade (INV-ET-12), Itens de Memória (do Membro; a origem fica como valor), Proveniências em Rascunhos, Mensagens (CRM), Documentos e Tarefas criados a partir dela, Solicitações de Aprovação já decididas. Eliminar a Sessão **não desfaz** nenhuma ação executada por ela.

**Cascata recebida.** Registro âncora `na lixeira` → âncora `indisponível` (20.2); eliminado → `eliminada`; a Sessão permanece. Agente principal arquivado/eliminado → Agente principal indisponível; a Sessão permanece (20.8). Arquivo eliminado → referência com marcador. Documento citado eliminado → Referência com marcador (RN-CNH-22). Membro `removido` → Sessões e Memória do Usuário vão à lixeira pelo Sistema e são eliminadas ao fim do prazo, salvo reconvite (DO-CHT-16; B87; 20.1). Espaço de Trabalho `suspenso` → nenhuma Execução (20.7).

## 13. Regras de negócio ontológicas

- **RN-CHT-01.** Toda Sessão de Chat pertence a exatamente um Membro (Proprietário = Criador) e a exatamente um Espaço de Trabalho; ambos imutáveis (B21, A1.1).
- **RN-CHT-02.** Só um Membro `ativo` cria Sessões, e apenas com `executar` sobre o Agente principal efetivo (o Assistente padrão, por Papel Membro ou superior; qualquer Agente, por Papel, concessão ou compartilhamento). Um Convidado cria Sessão apenas se algum Agente lhe foi compartilhado com `executar` (DO-CHT-08; 20.12).
- **RN-CHT-03.** A âncora é definida na criação, imutável, e exige `ver` do Membro sobre o registro naquele ato; a validade é reavaliada a cada Execução (7.4).
- **RN-CHT-04.** Toda Mensagem `assistente` e toda Mensagem `ferramenta` referenciam exatamente uma Execução de Agente originada na Sessão; toda Execução originada na Sessão referencia a Sessão e o Membro delegante (DO-CHT-04).
- **RN-CHT-05.** Uma Sessão não `ativo` não aceita Mensagem `usuário` nem origina Execuções.
- **RN-CHT-06.** Escrever em Sessão `arquivado` exige desarquivar, ato explícito com Registro; não há desarquivamento implícito.
- **RN-CHT-07.** Só o Proprietário escreve Mensagens `usuário`, envia Arquivos, edita Configuração, compartilha, arquiva, exclui e restaura. Sujeitos com compartilhamento apenas leem (INV-CHT-04).
- **RN-CHT-08.** Ferramentas disponíveis a uma Execução originada na Sessão = Ferramentas permitidas ao Agente executor ∩ Restrição de Ferramentas da Sessão; cada invocação é ainda verificada pela permissão efetiva do Agente em nome do Membro (interseção, A9.3) a cada chamada (B23). A Sessão nunca amplia (INV-CHT-06).
- **RN-CHT-09.** Existe no máximo uma Execução não terminal por Sessão em cada instante. Nova Mensagem `usuário` durante Execução em andamento é rejeitada (ou, por produto, enfileirada para depois do término); nunca dispara Execução concorrente na mesma Sessão. Justificativa: a sequência da Sessão é a base do Contexto; duas Execuções concorrentes leriam e escreveriam a sequência em ordem indefinida.
- **RN-CHT-10.** Toda Ferramenta invocada em Execução originada na Sessão gera Registro de Atividade no registro-alvo com Ator = Agente e ator delegante = Membro (A6.2), visível conforme as permissões do registro-alvo; a Sessão não é citada no Registro além do identificador da Execução. A privacidade da Sessão nunca oculta uma ação (INV-CHT-08).
- **RN-CHT-11.** Solicitações de Aprovação geradas em Execução originada na Sessão (B22) têm como aprovador o Proprietário da Sessão. Se o Proprietário não tem a permissão requerida pela Ferramenta, a invocação falha por permissão (interseção) antes de qualquer aprovação: aprovar nunca é conceder (documento 18, 20.3).
- **RN-CHT-12.** Mensagens de Chat são imutáveis depois de gravadas; nenhum Ator, inclusive o Proprietário, edita ou elimina Mensagem individualmente. A única eliminação é a da Sessão inteira (DO-CHT-06). Justificativa: A6 — a Sessão é a evidência do que a IA recebeu e do que foi pedido; apagar uma fala apagaria a causa de uma ação registrada.
- **RN-CHT-13.** Correção e regeneração são Mensagens novas com Substitui apontando para Mensagem da mesma Sessão e do mesmo papel; a substituída permanece, marcada, e sai do Contexto por padrão.
- **RN-CHT-14.** Mensagem `usuário` e `assistente` têm texto ou ao menos um Arquivo; Mensagem `ferramenta` e `sistema` sempre têm conteúdo.
- **RN-CHT-15.** Menção a um Agente em Mensagem `usuário` invoca esse Agente para a resposta (Execução com origem na Sessão); exige `executar` do Membro sobre ele; sem permissão, a menção é texto e o Agente principal responde, com Mensagem `sistema` informando.
- **RN-CHT-16.** Toda Execução de uma Cadeia de Execuções iniciada na Sessão (Agente principal → Agente invocado → ...) referencia a Sessão como origem e o Membro como delegante; a profundidade máxima é regra da Cadeia (documento 17; B79), nunca da Sessão.
- **RN-CHT-17.** O Contexto de cada Execução é montado no momento da Execução com as permissões efetivas daquele momento (interseção Agente ∩ Membro); nada do que o Membro perdeu acesso a entra, ainda que já tenha entrado em Execução anterior. Mensagens `ferramenta` antigas permanecem na sequência: são fatos ocorridos, e o seu conteúdo já foi filtrado quando gravado.
- **RN-CHT-18.** Arquivos enviados na Sessão são Arquivos do Espaço de Trabalho (Criador = Membro), referenciados pela Mensagem; Arquivos gerados pela IA são Arquivos do Espaço de Trabalho com Criador = Agente e ator delegante = Membro (DO-CHT-10). Nenhum deles é Documento de Conhecimento (DO-CNH-17).
- **RN-CHT-19.** Um Arquivo cujo tipo o Modelo efetivo não suporta (Capacidades do Modelo, DO-HAB-10) permanece na Sessão, não entra no Contexto e gera Mensagem `sistema`; se existir Representação derivada (transcrição, descrição — padrão do documento 20, 7.2), ela entra no lugar. Trocar o Modelo reavalia.
- **RN-CHT-20.** Toda resposta baseada em Conhecimento grava Referências de Conhecimento na Mensagem `assistente` (DO-CNH-15); Fragmentos de Coleções sem `ver` na interseção nunca entram no Contexto (INV-CNH-09).
- **RN-CHT-21.** Memória do Usuário só é gravada por Ferramenta "lembrar" em Execução originada em Sessão do próprio Membro, ou pelo Membro; classe `escrita reversível`; nunca por Execução autônoma; nunca retém dados de Contato, Empresa, Negócio ou de terceiros (DO-CHT-11). O Membro vê, remove Itens e desativa a Memória a qualquer momento.
- **RN-CHT-22.** Compartilhar uma Sessão concede `ver` em escopo `registro` a Membro ou Equipe; nunca a Agente; nunca outra ação. O leitor vê Mensagens, Arquivos da Sessão (acesso por meio dela, como Anexo — documento 14, 17.3) e Mensagens `ferramenta`; âncora e Referências de Conhecimento aparecem como indisponíveis quando ele não tem `ver` sobre o citado (20.3). Compartilhar nunca amplia acesso a registros (mesmo princípio de B20).
- **RN-CHT-23.** Nenhum Papel — inclusive Proprietário do Espaço de Trabalho e Administrador — dá `ver` sobre Sessões alheias; a única origem é o compartilhamento pelo Proprietário. O ato de governança de B38b **não se aplica** a Sessões (DO-CHT-09).
- **RN-CHT-24.** Eventos da Sessão (18) não são Gatilhos de Automação e a Sessão não é Fonte de Dados de Painel; métricas de uso de IA derivam de Execuções (filtradas por B20) e nunca expõem conteúdo de Mensagens.
- **RN-CHT-25.** Em Espaço de Trabalho `suspenso`: Execuções em andamento passam a `cancelada` (B31), com Mensagem `sistema`; nenhuma Mensagem `usuário` é aceita; leitura permitida ao Proprietário se o produto permitir acesso (leitura não é ação com efeito).
- **RN-CHT-26.** Agente principal indisponível (`pausado`, `arquivado`, `na lixeira`, eliminado, ou `executar` perdido — RN-AGE-10) bloqueia novas Mensagens `usuário` até o Proprietário escolher outro Agente (ou esvaziar para o Assistente padrão), com evento e Mensagem `sistema`. **Nunca há substituição silenciosa** (DO-CHT-12).
- **RN-CHT-27.** Sessões e Memória do Usuário de Membro `removido` não são sucedidas nem transferidas (B28): no ato da remoção, o Sistema as envia à lixeira; ao fim do prazo da Política de lixeira, elimina-as (DO-CHT-16; B87). Reativação do mesmo Membro dentro do prazo (B27) as restaura ao mesmo Membro.
- **RN-CHT-28.** Toda criação, renomeação, troca de Agente ou Modelo, alteração de Restrição, compartilhamento, revogação, arquivamento, exclusão, restauração e eliminação gera Registro de Atividade com a Sessão como objeto (A6.2). Mensagens `usuário` não geram Registro de Atividade próprio (o Registro seria uma cópia da fala; a sequência da Sessão é o registro); Execuções geram os seus (B18).

## 14. Invariantes

- **INV-CHT-01.** Toda Sessão tem exatamente um Proprietário, igual ao Criador, Membro do mesmo Espaço de Trabalho; nunca muda. É o único registro com Proprietário que admite Membro `removido` (exceção de INV-ET-03, RN-ET-09e).
- **INV-CHT-02.** Nenhum Agente, Automação, Integração ou Sistema é Proprietário, Criador ou autor de Mensagem `usuário` de uma Sessão.
- **INV-CHT-03.** Nenhuma Sessão é criada por Ator não humano.
- **INV-CHT-04.** Só o Proprietário escreve na Sessão; todo outro Sujeito, se tem algo, tem apenas `ver`.
- **INV-CHT-05.** Toda Mensagem `assistente` e `ferramenta` referencia uma Execução de Agente existente (ou eliminada com registro de valor), originada nesta Sessão, cujo delegante é o Proprietário.
- **INV-CHT-06.** A permissão efetiva de uma Execução originada na Sessão nunca excede a interseção das permissões do Agente e do Membro (A9.3); a Configuração da Sessão só reduz.
- **INV-CHT-07.** Nenhum Contexto, Mensagem `ferramenta` ou Mensagem `assistente` contém conteúdo de registro, Fragmento ou Arquivo que o Membro não pode ver no momento em que foi produzido (B19; INV-CNH-09).
- **INV-CHT-08.** Toda ação com efeito sobre registro executada a partir de uma Sessão tem Registro de Atividade no registro-alvo com Agente e delegante; a privacidade da Sessão não alcança o efeito.
- **INV-CHT-09.** A Memória do Usuário de um Membro só é lida em Execuções em nome desse Membro e só é escrita por ele ou em nome dele; nunca atravessa Membros nem Espaços de Trabalho.
- **INV-CHT-10.** Em cada instante, uma Sessão tem no máximo uma Execução não terminal.
- **INV-CHT-11.** Nenhuma Mensagem de Chat é alterada ou eliminada individualmente enquanto a Sessão existir.
- **INV-CHT-12.** Nenhuma referência de Sessão (âncora, Agente, Modelo, Arquivo, compartilhamento) cruza a fronteira do Espaço de Trabalho (INV-ET-07); Modelo é global e é usado, não possuído.

## 15. Personalização

- **Configuração da Sessão** (7.3) é a única personalização: Modelo escolhido, Restrição de Ferramentas, título. É objeto de valor do Proprietário sobre a própria Sessão; não é herdada, não tem ponto de definição (B25).
- **Campos Personalizados**: não se aplicam (A5.2 não lista Sessão; e a Sessão é pessoal — classificar Sessões é preferência do Membro, não configuração da organização).
- **Tags**: não se aplicam (A8). Uma "etiqueta pessoal" de Sessão, se o produto oferecer, é atributo de exibição do Membro, não Tag.
- **Comentários**: não se aplicam (A8). Não há "comentar a Sessão": a Sessão é o diálogo.
- **Status**: não existe; estados de sistema (11).
- **O Espaço de Trabalho** pode configurar, como parte da configuração do Assistente padrão e dos Agentes (documento 17), o que os Membros podem escolher (Modelos admitidos, sobrescrita de Modelo); isso é configuração do Agente, não da Sessão.
- **Memória do Usuário**: habilitada/desabilitada e Itens são controle pessoal do Membro; a organização define, por política (C7), o que pode ser retido — a ontologia fixa o mínimo (DO-CHT-11).

## 16. Herança

- **Da Estrutura de Trabalho**: nenhuma. Ancorar-se a Espaço, Pasta, Subpasta ou Lista não herda permissões, Conjunto de Status, Automações nem estado efetivo (B25, B36 não se aplicam).
- **Do Agente principal**: a Sessão **usa** o Modelo do Agente como padrão e as Ferramentas permitidas como teto; não é herança — trocar o Agente troca os valores derivados; a Configuração da Sessão, se restringir, continua a restringir sobre o novo teto.
- **Do Membro**: a permissão efetiva das Execuções deriva das permissões do Membro (interseção); a Memória do Usuário entra no Contexto. Não é herança de configuração: é a identidade de quem age.
- **Do Espaço de Trabalho**: Localidade (idioma e fuso) como padrão de apresentação e de instrução do Assistente padrão (RN-ET-15); Política de lixeira; Limites impostos.
- **Entre Sessões**: nenhuma. Uma Sessão não herda Mensagens, Arquivos nem Configuração de outra; o que atravessa Sessões é a Memória do Usuário (7.5), por Contexto, não por herança.

## 17. Permissões e visibilidade

### 17.1 Recurso Sessão de Chat

| Ação | Significado sobre a Sessão | Quem |
| --- | --- | --- |
| ver | Ler Mensagens (todos os papéis), Arquivos por meio da Sessão, Configuração, Registros de Atividade da Sessão. | Proprietário (por propriedade); Membro ou Equipe com compartilhamento. |
| comentar | Não se aplica. | — |
| criar | Criar Sessão. **Não é permissão própria**: decorre de `executar` sobre o Agente principal efetivo (RN-CHT-02). | Membro `ativo` com `executar` sobre algum Agente. |
| editar | Escrever Mensagens `usuário`; enviar Arquivos; renomear; trocar Agente e Modelo; alterar Restrição; arquivar e desarquivar. | Só o Proprietário. Não concedível. |
| excluir | Enviar à lixeira; restaurar; eliminar antecipadamente. | Só o Proprietário. Não concedível. |
| administrar | Compartilhar e revogar. | Só o Proprietário. Não concedível. |
| executar | Não se aplica à Sessão (aplica-se ao Agente). | — |

Escopos: `registro` (compartilhamento) e `próprios` (o Proprietário sobre as suas — origem: propriedade). `subárvore` não se aplica. Origens: propriedade e compartilhamento; **nunca** papel, herança ou concessão direta de Administrador (RN-CHT-23).

### 17.2 Papéis

| Papel | Sobre as próprias Sessões | Sobre Sessões alheias |
| --- | --- | --- |
| Proprietário do ET / Administrador | Tudo. Configurar o Assistente padrão e os Agentes (documento 01, 17.2) — o que afeta indiretamente todas as Sessões, sem ler nenhuma. | **Nada**, salvo compartilhamento recebido. Sem ato de governança de entrada (DO-CHT-09). A exportação total do Espaço de Trabalho (documento 01, 17.2) **não inclui** Sessões por padrão (25.2; C29). |
| Membro | Criar (com o Assistente padrão por Papel — documento 01, 17.2) e tudo sobre as suas. | `ver` só por compartilhamento. |
| Convidado | Criar apenas se um Agente lhe foi compartilhado com `executar` (DO-CHT-08); o Contexto só alcança o que lhe foi compartilhado. | `ver` só por compartilhamento. |
| Agente | Nunca Sujeito sobre Sessões: não vê, não lista, não compartilha. Recebe o Contexto da sua Execução; não "acessa a Sessão". | Idem. |

### 17.3 Visibilidade do que a Sessão referencia

Ver a Sessão não é ver a âncora, os registros lidos por Ferramenta ou os Documentos citados: cada um exige a permissão própria. Para o leitor compartilhado sem `ver` sobre eles, aparecem como indisponíveis; o **texto** das Mensagens `assistente` e `ferramenta` é exibido tal como foi gravado, porque o Proprietário, ao compartilhar, assumiu a decisão de expor o diálogo (20.3). Arquivos da Sessão são vistos por meio dela (padrão de Anexo). Memória do Usuário nunca é exibida a leitores.

### 17.4 IA sujeita às mesmas regras

Toda Execução originada na Sessão age na interseção Agente ∩ Membro (A9.3), Ferramenta a Ferramenta (B23); a Restrição da Sessão reduz mais. Autonomia (B22) decide, por Ferramenta e classe de efeito, se há Solicitação de Aprovação ao Proprietário. Um Agente com acesso a uma Coleção que o Membro não vê não a usa na Sessão (documento 20, 20.3). Painéis sobre Execuções originadas em Sessões filtram pelo visualizador (B20) e nunca expõem Mensagens.

### 17.5 Exceções

Não há exceções ao isolamento (INV-ET-07) nem à privacidade por Papel. O Sistema elimina por prazo, cancela Execuções na suspensão, marca âncoras e referências e grava Mensagens `sistema` sem Sujeito de permissão: ação do Sistema, registrada. A plataforma, fora da ontologia, pode ser obrigada a acessar Sessões por ordem legal (25.2; C29).

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Sessão criada | 12.1 | Sessão, Proprietário, âncora (tipo, id), Agente principal, Modelo efetivo | Auditoria; Limites (contagem) |
| Sessão renomeada | 12.2 | antes, depois | Auditoria |
| Agente principal alterado / Modelo escolhido alterado / Restrição de Ferramentas alterada | 12.2 | antes, depois, Ator | Auditoria; Mensagem `sistema`; Execução seguinte |
| Mensagem `usuário` gravada | 12.2 | Mensagem, Arquivos, Substitui | Sistema (inicia Execução). **Sem** Registro de Atividade próprio (RN-CHT-28) e **nunca** Gatilho (RN-CHT-24). |
| Execução originada / concluída / falhou / cancelada / aguardando aprovação | 12.2 | Execução, Agente, Modelo, Sessão, Mensagem produzida, custo | Sessão (Mensagens `assistente`/`sistema`); Painéis (via Execuções); Proprietário (notificação de aprovação) |
| Ferramenta invocada na Sessão | 12.2 | Ferramenta, registro-alvo, resultado, permissão avaliada | Registro-alvo (Registro de Atividade); Mensagem `ferramenta`; Automações do registro-alvo (Gatilhos normais) |
| Mensagem substituída | 12.2 | substituída, substituta, causa (`edição`, `regeneração`) | Auditoria (na Execução); Contexto |
| Arquivo enviado / Arquivo gerado | 12.2 | Arquivo, Criador, delegante, Mensagem | Espaço de Trabalho (armazenamento, Limites); Conhecimento ("adicionar ao Conhecimento" opcional) |
| Arquivo não suportado pelo Modelo | RN-CHT-19 | Arquivo, Modelo, capacidade ausente | Mensagem `sistema`; Proprietário |
| Sessão compartilhada / compartilhamento revogado | 17 | Sujeito, Ator | Auditoria; notificação ao Sujeito |
| Sessão arquivada / desarquivada / excluída / restaurada / eliminada | 12.3–12.4 | Ator, causa (`Membro`, `prazo`, `Sistema`) | Auditoria; Execução em andamento; Arquivos (referências) |
| Âncora indisponível / eliminada | 12.4 | Sessão, registro, causa | Mensagem `sistema`; Proprietário |
| Agente principal indisponível | RN-CHT-26 | Sessão, Agente, causa | Mensagem `sistema`; Proprietário (escolha exigida) |
| Item de Memória gravado / removido / desativado; Memória habilitada / desabilitada | 7.5 | Membro, Item (sem conteúdo no Registro), Sessão de origem, Ator | Membro (controle); auditoria mínima |
| Limite atingido | RN-ET-23 | limite (Sessões, Arquivo, Contexto, cota de IA), Ator | Proprietário; plataforma |

Eventos da Sessão geram Registro de Atividade com a Sessão como objeto, exceto "Mensagem `usuário` gravada" (RN-CHT-28). Eventos de Execução são da Execução (B18). Nenhum evento desta tabela é Gatilho de Automação (RN-CHT-24).

## 19. Dependências

**A Sessão depende de:** Espaço de Trabalho (pertencimento, Limites impostos, Política de lixeira, `suspenso`, Localidade — documento 01); Membro (Proprietário, permissões, estado; Memória do Usuário como entidade interna do Membro); Agente e Assistente padrão (B17, B33 — documento 17: Ferramentas permitidas, sobrescrita de Modelo, profundidade de invocação, Memória do Agente); Execução de Agente (B18 — documento 17); Modelo e Capacidades do Modelo (A1.3; DO-HAB-10 — documento 15); Ferramenta e classes de efeito (DO-HAB-13 — documento 18); Habilidade (exercício solicitado — documento 18); Conhecimento (Ferramenta "consultar", Referência de Conhecimento, "adicionar ao Conhecimento" — documento 20); Arquivo (A8); registros âncora (documentos 02–14, 20); Rascunho da Conversa (DO-CXE-15 — documento 14); Solicitação de Aprovação (A8; B22); Registro de Atividade (A6.2).

**Dependem da Sessão:** Execuções (origem e delegante — documento 17); Rascunho e Mensagem (CRM) (Proveniência — documento 14); Documento de Conhecimento (Proveniência à Sessão — documento 20); Tarefas, Comentários e outros registros criados por Ferramenta na Sessão (Proveniência); Memória do Usuário (Sessão de origem dos Itens); Painéis (só por meio de Execuções — documento 21); IA — visão geral (documento 15: Contexto e Memória definidos aqui e no 17).

**Documentos que este documento pressupõe ou condiciona:** Espaço de Trabalho (01) — Memória do Usuário como entidade interna do Membro (7.1) e exclusão de Sessões da exportação total por padrão (17.2); Empresas (11) — adota DO-EMP-14; Espaço (02), Pasta (03), Subpasta (04), Lista (05) — âncora em contêiner confirmada (Lista e Subpasta acrescentadas); Caixa de Entrada (14) — coerência com 4 e 7.10; Conhecimento (20) — coerência com 20.16 e DO-CNH-15/17; Agentes (17) — recebe: Execução com origem Sessão e delegante Membro, Ferramentas "invocar Agente", "lembrar", "sugerir resposta", atributo "admite sobrescrita de Modelo", aprovador = Proprietário da Sessão, profundidade de invocação; Automações (19) — recebe RN-CHT-24 e DO-CHT-13.

## 20. Casos limítrofes e ambiguidades

### 20.1 Membro removido com 200 Sessões

Nenhuma é sucedida nem transferida (B28; RN-ET-09e): permanecem com o Membro `removido`, inacessíveis a todos. As Execuções que elas originaram pertencem aos Agentes e continuam auditáveis; os Registros de Atividade das ações (Tarefas criadas, Rascunhos, Documentos) estão nos registros-alvo; os Arquivos enviados são do Espaço de Trabalho e continuam referenciáveis por quem os alcançar por outro registro. O que ficaria preso é o diálogo. Decisão vigente (DO-CHT-16, adotada na constituição como B87, que fecha C11): no ato da remoção, o Sistema envia as Sessões e a Memória do Usuário do removido à lixeira; ao fim do prazo da Política de lixeira, elimina-as; reconvite dentro do prazo (B27) as restaura ao mesmo Membro. Justificativa: retenção indefinida de diálogos pessoais inacessíveis é passivo jurídico (LGPD) sem uso corporativo, e a lixeira já é o mecanismo de retenção da organização. Enquanto `na lixeira`, permanecem com o Membro `removido`, inacessíveis a todos (INV-CHT-01; RN-ET-09e).

### 20.2 Sessão ancorada a Negócio que vai à lixeira

A âncora passa a `indisponível` (7.4), com Mensagem `sistema`; a Sessão permanece `ativo`, e o Membro continua a escrever; o Contexto das Execuções seguintes não lê o Negócio (estado efetivo `na lixeira` não é lido por Ferramenta). Restaurado o Negócio, a âncora volta a `válida` na próxima Execução, sem ato. Eliminado, `eliminada` com identificador e nome à época. Nunca se reancora (DO-CHT-03): o Membro cria outra Sessão para outro Negócio.

### 20.3 Sessão compartilhada com Membro que não vê a âncora

Ana compartilha com Bruno uma Sessão ancorada em um Negócio que Bruno não vê. Bruno lê todas as Mensagens (`usuário`, `assistente`, `ferramenta`, `sistema`) tal como gravadas, e os Arquivos da Sessão; a âncora aparece como "registro indisponível" (tipo, sem nome resolvido ao vivo) e as Referências de Conhecimento a Coleções que ele não vê aparecem como indisponíveis, sem navegação (RN-CHT-22). O texto pode revelar o que Ana viu do Negócio: é decisão de Ana, registrada como compartilhamento, e não uma falha de permissão — mesmo princípio de quem copia um trecho para um Comentário. Compartilhar não concede `ver` sobre o Negócio (B20 por analogia). Bruno não escreve, não regenera, não aprova.

### 20.4 Arquivo de 1 GB de vídeo enviado

Não há regra ontológica de tamanho: é Limite imposto (B34; RN-ET-23), verificado no ato de envio; se rejeitado, a Mensagem `usuário` não é gravada e o evento "Limite atingido" é emitido. Se aceito, o Arquivo pertence ao Espaço de Trabalho e conta no armazenamento; entra no Contexto apenas se o Modelo efetivo suportar vídeo e couber no limite de Contexto — caso contrário, Mensagem `sistema` e, se houver Representação derivada (transcrição), ela entra (RN-CHT-19). O Arquivo não é Documento de Conhecimento (20.16 do documento 20).

### 20.5 Membro pede ao Agente que envie WhatsApp a um Contato

Execução do Agente principal → Ferramenta "enviar Mensagem" (classe `externa`, documento 18, 7.4) → primeira verificação: o Membro e o Agente têm a permissão requerida na Conversa (interseção) e o consentimento e a janela do Canal são válidos (RN-CON-16; RN-CXE-19); sem isso, `negada`, Mensagem `ferramenta` com o motivo, sem aprovação a pedir. Com permissão: nível de autonomia (B22) — `assistido` e `supervisionado`: Execução `aguardando aprovação`, Solicitação de Aprovação com aprovador = o próprio Membro (RN-CHT-11), exibida na Sessão; aprovada, a Mensagem é enviada na Conversa com Ator = Agente e delegante = Membro (documento 14, 8.6); recusada, `ferramenta` com resultado `negada` e a Execução conclui sem envio. `autônomo`: envia. Alternativa que o produto deve oferecer: "prepare a resposta" gera Rascunho (DO-CXE-15), e o Membro envia ele mesmo. Em nenhum caso a Mensagem de Chat vira Mensagem: nasce uma Mensagem nova na Conversa, com Proveniência à Sessão.

### 20.6 Membro pede ao Assistente padrão para "lembrar" um dado pessoal de um Contato

"Lembre que a Maria (Contato) tem alergia a látex." A Ferramenta "lembrar" **recusa** gravar dado sobre terceiro na Memória do Usuário (DO-CHT-11; RN-CHT-21): a Memória retém preferências do Membro, não fatos sobre Contatos. O Agente responde oferecendo o caminho correto — Comentário no Contato ou Valor de Campo — por Ferramenta, sob a permissão do Membro, com Registro no Contato, sujeito à eliminação por solicitação do titular (documento 10, 12.5) e à governança do CRM. Justificativa: um dado pessoal em repositório invisível e não sucedido escaparia da LGPD (C7, C9) e da organização. O que é "dado sobre terceiro" versus "preferência do Membro" é decisão de política (C7); a ontologia fixa que a Memória do Usuário tem como sujeito o próprio Membro.

### 20.7 Sessão em Espaço de Trabalho suspenso

Execuções em andamento passam a `cancelada` (B31), com Mensagem `sistema`; Solicitações pendentes canceladas; nenhuma Mensagem `usuário` é aceita. Ler é possível se o produto permitir acesso durante a suspensão (não é ação com efeito). Na reativação, nada é reexecutado retroativamente; o Membro reenvia o que quiser.

### 20.8 Agente principal arquivado durante a Sessão

A Execução em andamento termina com a versão carregada (mesmo princípio de RN-HAB-14; documento 17). A Sessão passa a "Agente principal indisponível" com Mensagem `sistema`; a próxima Mensagem `usuário` é rejeitada até o Proprietário escolher outro Agente ou esvaziar o Agente principal (Assistente padrão). **Não há substituição silenciosa** (DO-CHT-12): o Membro escolheu conversar com um Agente específico (instruções, Habilidades, Memória do Agente próprias); trocá-lo sem aviso mudaria o interlocutor sem consentimento. O Assistente padrão nunca fica indisponível (B33), de modo que toda Sessão sem Agente principal sempre tem interlocutor.

### 20.9 Duas Sessões do mesmo Membro sobre a mesma Tarefa

Permitido, sem limite: âncora não é única por Membro nem por registro. Cada Sessão tem o seu diálogo; a Memória do Usuário é a única coisa que atravessa. O produto pode listar "Sessões ancoradas a esta Tarefa" apenas para o próprio Membro (as dos outros são invisíveis).

### 20.10 Mensagem `ferramenta` visível ao Membro?

Sim, **como registro, não como fala** (DO-CHT-07): o Membro vê que o Agente invocou "ler Negócio" e "criar Tarefa", com resultado e resumo, e pode navegar ao passo da Execução. É a condição para que o Membro entenda e audite o que a IA fez em seu nome. O conteúdo já respeita a interseção de permissões; não há o que ocultar. O produto pode recolher esses registros visualmente; a ontologia exige que existam na sequência e sejam acessíveis a quem vê a Sessão.

### 20.11 Sessão exportada

Exportar uma Sessão (pelo Proprietário) produz um artefato fora da ontologia (arquivo externo). Se o produto gravar o resultado como Arquivo do Espaço de Trabalho, ele é um Arquivo comum (Criador = Membro), sem vínculo vivo com a Sessão, e não é Documento de Conhecimento. A exportação é registrada. A exportação total do Espaço de Trabalho **não inclui** Sessões alheias por padrão (17.2; 25.2).

### 20.12 Convidado usando Chat

Um Convidado tem nada por Papel (documento 01, 17.2); não tem `executar` sobre o Assistente padrão. Só cria Sessão se um Agente lhe foi compartilhado com `executar` (DO-CHT-08). Nessa Sessão, o Contexto alcança apenas o que lhe foi compartilhado (interseção com permissões quase vazias); âncora só a registro compartilhado com ele; Ferramentas de escrita falham por permissão fora do que lhe foi compartilhado. Um Convidado nunca compartilha Sessão com Sujeito que não veja o Agente? Não há tal regra: compartilhar é `ver` sobre o diálogo, sem relação com o Agente. Recomendação de produto: a organização pode desabilitar Chat para Papéis de base Convidado, o que é "não compartilhar Agentes com eles".

### 20.13 Execução cancelada com resposta parcial

O Membro cancela durante a geração. A Execução passa a `cancelada`; a saída já produzida é gravada como Mensagem `assistente` com Completa = falso (12.2), para que o Membro veja o que recebeu e a Execução seguinte saiba que foi parcial. Ferramentas já invocadas produziram efeito e Registros; cancelar não os desfaz (atomicidade é por Ferramenta, documento 18, 7.4).

### 20.14 Agente invocado pela Sessão invoca outro Agente

O Agente principal, por Ferramenta "invocar Agente", chama o Agente B, que chama o Agente C. Todas as Execuções referenciam a Sessão e o Membro (RN-CHT-16); cada uma age na interseção com o Membro e exige `executar` do Membro sobre o Agente invocado; as Mensagens `assistente` de B e C aparecem na Sessão com Agente autor respectivo (ou, se o produto agregar, a resposta de A cita as deles — a ontologia exige apenas que cada Execução tenha a sua saída registrada). A profundidade máxima e o que acontece ao excedê-la são regras do documento 17 (B79; B22 — a autonomia da cadeia nunca é maior que a do invocador). A Sessão não limita profundidade; só exige rastreabilidade.

### 20.15 Compartilhamento com Equipe que inclui Membro futuro

Compartilhar com uma Equipe concede `ver` aos Membros que a integram a cada consulta (a Equipe é Sujeito). Quem entra na Equipe depois passa a ver; quem sai deixa de ver. O Proprietário que quiser controle nominal compartilha com Membros.

### 20.16 Membro edita a primeira Mensagem de uma Sessão longa

Nova Mensagem `usuário` com Substitui = a primeira, nova Execução, nova Mensagem `assistente`. As trinta Mensagens seguintes à original permanecem na sequência como ramo anterior: continuam a existir, fora do Contexto por padrão, visíveis como histórico (RN-CHT-13). O produto decide como apresentar ramos; a ontologia proíbe apagar (INV-CHT-11).

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Execuções "da Sessão" | Agente (B18) | A Sessão origina e referencia; a Execução tem ciclo de vida e custo próprios. |
| Agente principal | Agente (Proprietário do Agente) | Usado, nunca contido ou configurado pela Sessão. |
| Modelo | Plataforma (global, A1.3) | Usado; referenciado por escolha. |
| Ferramentas e Habilidades | Catálogo / Espaço de Trabalho; concedidas ao Agente | A Sessão só restringe (7.3). |
| Arquivos enviados e gerados | Espaço de Trabalho (A8) | Referenciados pelas Mensagens; sobrevivem à Sessão. |
| Registro âncora | Seu domínio | Referência de valor; não é Vínculo; não concede permissão. |
| Memória do Usuário | Membro | Atravessa Sessões; não é sucedida (7.5). |
| Memória do Agente | Agente | Documento 17. |
| Contexto | Execução (efêmero) | Montado por Execução; não persiste; registrado por referência. |
| Solicitação de Aprovação | Execução / Agente solicitante (A8) | O aprovador é o Proprietário; o pedido não é da Sessão. |
| Rascunho de resposta | Conversa (objeto de valor, DO-CXE-15) | A Sessão pode alimentá-lo; não o contém. |
| Mensagem (CRM), Comentário, Tarefa, Documento criados a partir da Sessão | Seus registros | Só Proveniência aponta à Sessão. |
| Referência de Conhecimento | Mensagem `assistente` (objeto de valor) — mas o Documento citado é do Conhecimento | A citação é da resposta; o citado não. |
| Registros de Atividade das ações executadas | Registro-alvo / Espaço de Trabalho | RN-CHT-10; a Sessão é privada, as ações não. |
| Custo | Execução (C8) | Derivado na Sessão, gravado na Execução. |
| Métricas de uso de IA | Painéis, via Execuções (B20) | A Sessão não é Fonte de Dados (RN-CHT-24). |
| Instruções do Agente | Agente (configuração versionada) | Não são Mensagens `sistema` (7.2). |
| Notificações | Fora da ontologia | Eventos são da Sessão; entrega é produto. |

## 22. Exemplos conceituais

**Exemplo 1 — Sessão ancorada em Conversa.** A atendente Carla abre, a partir da Conversa com o cliente Paulo (WhatsApp), uma Sessão ancorada nela, sem Agente principal (Assistente padrão, `supervisionado`). Escreve "resuma e sugira resposta". Execução E1: Contexto = Conversa (lida com as permissões de Carla), Mensagens recentes (nenhuma), Memória do Usuário de Carla ("responde em tom informal"); o Assistente exerce "Resumir Conversa" (plataforma) e "Sugerir resposta"; grava Rascunho na Conversa com origem `Sessão de Chat` e Mensagem `assistente` com o resumo e o texto. Carla ajusta o Rascunho e envia: nasce uma Mensagem `enviada` com Ator Carla e Proveniência à Sessão. Ninguém além de Carla vê a Sessão; todos com `ver` na Conversa veem a Mensagem enviada e o Registro da Execução E1 na Conversa.

**Exemplo 2 — Ação com aprovação.** O vendedor Diego, em Sessão ancorada no Negócio "Alfa", pede ao Agente Comercial (`supervisionado`): "mande a proposta por e-mail ao decisor". Execução E2 lê o Negócio e o Contato (Ferramentas `leitura`, Mensagens `ferramenta` na Sessão), gera o PDF (Arquivo do Espaço de Trabalho, Criador = Agente Comercial, delegante = Diego) e invoca "enviar Mensagem" (`externa`): E2 vai a `aguardando aprovação`; Diego aprova na Sessão; a Mensagem é enviada na Conversa de e-mail com Ator = Agente, delegante = Diego; E2 conclui; Mensagem `assistente` confirma, com o PDF referenciado. O gerente de Diego não vê a Sessão, mas vê, no Negócio e na Conversa, os Registros de Atividade "Agente Comercial (em nome de Diego) enviou Mensagem".

**Exemplo 3 — Convidado.** A contadora externa Ana (Convidado) recebeu compartilhamento com `executar` do Agente "Fiscal" e da Lista "Notas fiscais". Cria uma Sessão ancorada na Lista e pergunta "quais notas vencem esta semana?". O Contexto lê só as Tarefas da Lista compartilhada; um pedido "e os Negócios do mês?" retorna nada: a interseção não alcança Negócios. Ana não tem Assistente padrão: sem o Agente compartilhado, não criaria Sessão.

**Exemplo 4 — Remoção.** Diego é removido. Os seus Negócios passam ao Sucessor; as suas 40 Sessões não: vão à lixeira com a Memória do Usuário, inacessíveis a todos, e são eliminadas ao fim do prazo da Política de lixeira, salvo reconvite (DO-CHT-16; B87). Os PDFs gerados continuam no Espaço de Trabalho, anexados aos Negócios; as Execuções continuam nos Agentes; a Memória do Usuário de Diego não é lida por ninguém.

## 23. Representação gráfica textual

```
PLATAFORMA (global)
└── Modelo (0..N) ── Capacidades (modalidades) ── usado, nunca possuído

ESPAÇO DE TRABALHO
├── Membro (Proprietário; único Ator que cria Sessões)
│   ├── Memória do Usuário (0..1)  [habilitada?]           ── nunca sucedida; nunca atravessa ET
│   │   └── Item de Memória (0..N)  [ativo | desativado]   ── conteúdo sobre o Membro; origem: Sessão/Execução
│   │
│   └── SESSÃO DE CHAT (0..N)  [ativo | arquivado | na lixeira]   Proprietário = Criador, imutável
│       ├── Título (derivado até edição)
│       ├── Âncora (0..1, imutável) ──▶ Tarefa | Negócio | Contato | Empresa | Conversa | Documento |
│       │                              Espaço | Pasta | Subpasta | Lista   [válida | indisponível | eliminada]
│       ├── Agente principal (0..1) ──▶ Agente   (vazio = Assistente padrão)   [indisponível? → escolha exigida]
│       ├── Configuração da Sessão: Modelo escolhido (0..1) | Restrição de Ferramentas (só reduz)
│       ├── Compartilhamento (0..N): `ver`, escopo `registro`, a Membro | Equipe   (nunca Agente)
│       │
│       └── MENSAGEM DE CHAT (0..N; composição; imutável; ordem sequencial)
│           ├── `usuário`    ── Autor: Membro Proprietário; texto e/ou Arquivo (enviado)
│           ├── `assistente` ── Autor: Agente (principal | invocado), delegante Membro
│           │                    Execução de origem (1); Referências de Conhecimento (0..N);
│           │                    Arquivos gerados (Criador = Agente); Completa?
│           ├── `ferramenta` ── registro da invocação: Ferramenta, resultado, passo da Execução (1)
│           ├── `sistema`    ── fato da Sessão que entra no Contexto (Agente/Modelo trocado, cancelamento...)
│           └── Substitui (0..1) ──▶ Mensagem da mesma Sessão e papel   [substituída → fora do Contexto]
│
├── Agente (1..N; inclui Assistente padrão)
│   └── EXECUÇÃO DE AGENTE (0..N)  [pendente | executando | aguardando aprovação | concluída | falhou | cancelada]
│       ├── origem: Sessão de Chat (0..1) + delegante Membro        ◀── no máximo 1 não terminal por Sessão
│       ├── Contexto (efêmero): âncora + Mensagens recentes + Arquivos + Fragmentos + Memórias + instruções
│       │     (registrado por referência; nunca contém o que Membro ∩ Agente não vê)
│       ├── Ferramenta invocada (0..N) → Registro de Atividade no registro-alvo (Agente em nome de Membro)
│       ├── Exercício de Habilidade (0..N)
│       ├── Solicitação de Aprovação (0..N) → aprovador: o Proprietário da Sessão
│       └── Agente invocado (0..N) → Execução com a mesma origem e delegante
│
├── Arquivo (0..N) ◀── referenciado por Mensagens (enviado | gerado); pertence ao ET
└── Registro de Atividade ◀── atos sobre a Sessão; ações nos registros-alvo

Sessão ──produz por Ferramenta──▶ Rascunho (Conversa) | Comentário | Tarefa | Documento de Conhecimento
                                   (Proveniência aponta à Sessão; sem vínculo vivo)
Automação ──✗── nunca cria Sessão; eventos da Sessão ──✗── nunca são Gatilhos. Nenhuma aresta cruza o ET.
```

## 24. Decisões ontológicas

- **DO-CHT-01.** Chat é ambiente, não entidade; a entidade é a Sessão de Chat: pessoal, pertencente a exatamente um Membro (Proprietário = Criador, imutável), ancorável a 0..1 registro, com 0..1 Agente principal (padrão: Assistente padrão), Modelo efetivo, Mensagens de Chat, Arquivos e Execuções originadas. Aplica B21, B33, A7. CONSOLIDADA.
- **DO-CHT-02.** Catálogo de âncoras: Tarefa (inclusive Subtarefa), Negócio, Contato, Empresa (DO-EMP-14), Conversa, Documento de Conhecimento, Espaço, Pasta, Subpasta e Lista. Amplia B21 (que lista cinco) sem alterá-la; confirma o que os documentos 02, 03 e 11 já adotam e acrescenta Subpasta e Lista por coerência. Não são âncoras: Coleção, Caixa de Entrada, Fila, Funil, Painel, Agente, Sessão, Membro. RECOMENDADA.
- **DO-CHT-03.** A âncora é fixada na criação e imutável; a sua validade (`válida`, `indisponível`, `eliminada`) é derivada a cada Execução e nunca concede permissão. Justificativa: reancorar alteraria retroativamente o sentido do diálogo e a auditoria do Contexto. RECOMENDADA.
- **DO-CHT-04.** Toda Mensagem `assistente` e toda Mensagem `ferramenta` é saída de exatamente uma Execução de Agente originada na Sessão; toda Execução originada na Sessão referencia a Sessão e o Membro delegante. Não há resposta de IA sem Execução. Aplica B17, B18. RECOMENDADA.
- **DO-CHT-05.** Estados da Sessão: `ativo`, `arquivado`, `na lixeira` (A4.1), com Estado próprio anterior à exclusão (B43, por analogia); sem Status; sem estado efetivo derivado de ancestral. Arquivar termina Execuções em andamento sem cancelá-las; excluir as cancela. RECOMENDADA.
- **DO-CHT-06.** Mensagens de Chat são imutáveis e nunca eliminadas individualmente; edição e regeneração criam Mensagem nova com "Substitui" (mesma Sessão, mesmo papel); as substituídas permanecem, marcadas, fora do Contexto por padrão; a única eliminação é a da Sessão inteira. Justificativa: A6 — a Sessão é a evidência da causa de ações registradas. RECOMENDADA.
- **DO-CHT-07.** Mensagem `ferramenta` é registro da invocação (Ferramenta, resultado, referência ao passo da Execução), visível a quem vê a Sessão como registro, não como fala; o detalhe (entrada, permissão avaliada, Registro de Atividade) vive na Execução. Mensagem `sistema` é fato da Sessão que entra no Contexto (troca de Agente ou Modelo, cancelamento, âncora indisponível, Arquivo não suportado); instruções do Agente não são Mensagens. RECOMENDADA.
- **DO-CHT-08.** Não existe permissão própria "criar Sessão": criar decorre de `executar` sobre o Agente principal efetivo (Assistente padrão por Papel Membro ou superior; qualquer Agente por Papel, concessão ou compartilhamento). Convidado cria Sessão apenas se um Agente lhe foi compartilhado com `executar`. Agente, Automação, Integração e Sistema nunca criam Sessões. RECOMENDADA.
- **DO-CHT-09.** Sobre a Sessão, o Proprietário tem tudo; qualquer outro Sujeito só tem `ver`, em escopo `registro`, por compartilhamento (a Membro ou Equipe; nunca a Agente). Nenhum Papel, inclusive Proprietário do Espaço de Trabalho e Administrador, dá acesso a Sessão alheia; o ato de governança de B38b não se aplica; a exportação total do Espaço de Trabalho não inclui Sessões por padrão. Compartilhar não amplia acesso à âncora, aos registros lidos nem aos Documentos citados (aparecem indisponíveis). RECOMENDADA.
- **DO-CHT-10.** Arquivos enviados na Sessão e Arquivos gerados pela IA são Arquivos do Espaço de Trabalho (A8) referenciados pelas Mensagens; os gerados têm Criador = Agente e ator delegante = Membro. Nenhum é Documento de Conhecimento salvo "adicionar ao Conhecimento" (DO-CNH-17). Arquivo de tipo não suportado pelo Modelo efetivo permanece na Sessão fora do Contexto, com Representação derivada quando existir (DO-HAB-10). RECOMENDADA.
- **DO-CHT-11.** Memória do Usuário é entidade interna do Membro (não da Sessão), composta por Itens (conteúdo, origem, estado `ativo`/`desativado`), habilitável pelo Membro; escrita só por Ferramenta "lembrar" em Execução originada em Sessão do próprio Membro (classe `escrita reversível`) ou pelo Membro; lida só em Execuções em nome dele; retém preferências e fatos sobre o próprio Membro e **nunca dados de Contatos, Empresas, Negócios ou terceiros** (C7, C9); nunca sucedida (B28); nunca atravessa Espaços de Trabalho. Impacto: documento 01, 7.1 (Membro ganha a entidade interna Memória do Usuário). RECOMENDADA.
- **DO-CHT-12.** Agente principal indisponível (`pausado`, `arquivado`, `na lixeira`, eliminado ou `executar` perdido — RN-AGE-10) bloqueia novas Mensagens até escolha explícita do Proprietário; nunca há substituição silenciosa pelo Assistente padrão. Trocar Agente principal, Modelo ou Restrição de Ferramentas é permitido no meio da Sessão, com evento e Mensagem `sistema`; a Execução em andamento termina como começou. RECOMENDADA.
- **DO-CHT-13.** Automação nunca cria Sessão de Chat; resultados de Automação são notificados ou gravados nos registros-alvo. Eventos da Sessão não são Gatilhos de Automação e a Sessão não é Fonte de Dados de Painel; métricas de IA derivam de Execuções (B20) sem expor Mensagens. RECOMENDADA.
- **DO-CHT-14.** Ferramentas disponíveis a Execução originada na Sessão = permitidas ao Agente ∩ Restrição de Ferramentas da Sessão (configuração do Proprietário, que só reduz; "somente leitura" = classe `leitura`), com permissão efetiva Agente ∩ Membro verificada a cada invocação (A9.3, B23). Solicitações de Aprovação (B22) têm como aprovador o Proprietário da Sessão; aprovar nunca é conceder. Toda ação gera Registro de Atividade no registro-alvo com Agente e delegante: a Sessão é privada, as ações não. RECOMENDADA.
- **DO-CHT-15.** Contexto é objeto de valor efêmero montado a cada Execução (âncora, Mensagens recentes não substituídas, Arquivos compatíveis, Fragmentos recuperados, Memória do Usuário, Memória do Agente, instruções), sujeito a Limites impostos de tamanho, registrado na Execução por referência, e nunca contém o que Membro ∩ Agente não pode ver. Existe no máximo uma Execução não terminal por Sessão. RECOMENDADA.
- **DO-CHT-16.** Na remoção do Membro, o Sistema envia as suas Sessões de Chat e a sua Memória do Usuário à lixeira; ao fim do prazo da Política de lixeira, elimina-as; reconvite dentro do prazo (B27) as restaura ao mesmo Membro. Nunca sucedidas nem transferidas. Adotada pela constituição (B87), que emenda B28 e RN-ET-09e e fecha C11. RECOMENDADA.
- **DO-CHT-17.** Invocação de outro Agente na Sessão (menção ou Ferramenta "invocar Agente") produz Execução com a mesma origem (Sessão) e delegante (Membro), exige `executar` sobre o invocado tanto do invocador (Agente invocador — RN-AGE-13; ou Membro, na menção) quanto do Membro delegante (interseção, A9.3), e a sua saída aparece na Sessão com Agente autor = invocado. Profundidade e limites da Cadeia de Execuções são regras do documento 17 (B79); a Sessão exige apenas rastreabilidade. RECOMENDADA.
- **DO-CHT-18.** Uma Sessão recém-criada é válida vazia (0 Mensagens), diferente da Conversa (INV-CXE-05), porque nasce por ato do Membro antes da primeira fala. Título derivado (âncora ou primeira fala) até edição; não único. RECOMENDADA.

Nenhuma decisão contradiz A1–A9 ou B1–B99. DO-CHT-02 está consolidada em B83 (amplia B21); DO-CHT-11 em B86 e no documento 01, 7.1; DO-CHT-16 em B87 (fecha C11); DO-CHT-04 e DO-CHT-06 em B84; DO-CHT-13 em B85.

## 25. Questões em aberto

1. **Destino das Sessões de Membro removido** — resolvida: DO-CHT-16 adotada (B87; C11 fechada).
2. **Acesso corporativo excepcional a Sessões** (C29; C9). DO-CHT-09 nega acesso por Papel e exclui Sessões da exportação total. Ordem judicial, investigação interna ou obrigação regulatória podem exigir acesso; se existir, é procedimento da plataforma fora da ontologia dos Sujeitos, com registro — não permissão de Administrador. Decidir se a exportação total do Proprietário do Espaço de Trabalho deve incluir Sessões com Registro (padrão de B38 para contêineres privados) ou permanecer excluída.
3. **Cópia ou transferência de Sessão entre Membros.** Não existe (5). Pedido provável: "passe esta Sessão ao meu substituto". Alternativa sem alterar a ontologia: exportar o diálogo para um Documento de Conhecimento ou Comentário, com Proveniência.
4. **Sobrescrita de Modelo pelo Membro.** O atributo "Admite sobrescrita de Modelo" existe na Versão de Agente (documento 17, 6.2: padrão falso; Assistente padrão verdadeiro, recomendação); resta decidir os Modelos admitidos pelo Espaço de Trabalho (Limites impostos; C27).
5. **Política de Memória do Usuário** (C7). DO-CHT-11 fixa o sujeito (o próprio Membro) e o controle (ver, remover, desativar). Retenção máxima, revisão pelo Membro antes de gravar e critério de "dado sobre terceiro" são política de produto e jurídica.
6. **Enfileirar versus rejeitar Mensagem durante Execução em andamento** (RN-CHT-09). A ontologia exige uma Execução por vez; o produto decide entre rejeitar e enfileirar. Sem impacto ontológico.
7. **Retenção de Mensagens substituídas.** DO-CHT-06 as preserva enquanto a Sessão existir. Se armazenamento ou LGPD exigirem, uma política de retenção de ramos substituídos seria objeto de valor da Política de lixeira; hoje não existe.
8. **Limite de Sessões e de Contexto como Limites impostos** (B34; C8). Quais limites a plataforma enumera (Sessões por Membro, tamanho de Arquivo, tamanho de Contexto, cota de Execuções) é do documento 15/01; este documento só exige que existam e sejam verificados no ato.

Resolvidas neste documento com recomendação, sem pendência aberta: Convidado em Chat (DO-CHT-08); Mensagem `ferramenta` visível (DO-CHT-07); edição e regeneração (DO-CHT-06); Agente principal arquivado (DO-CHT-12); âncora imutável (DO-CHT-03); Automação e Sessão (DO-CHT-13); Memória e dados de Contatos (DO-CHT-11); Arquivos gerados (DO-CHT-10).
