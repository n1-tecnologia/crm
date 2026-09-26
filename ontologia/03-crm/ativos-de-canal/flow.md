# FLOW

> Domínio: CRM — Ativos de Canal | Documento 23 de 25 | Status: RASCUNHO | Versão da ontologia: 1.1-proposta | Depende de: 22, 14, 10, 19

## 1. Definição ontológica

**Flow** é o Ativo de Canal **publicável**: um formulário interativo, composto de Telas navegáveis com Componentes de entrada e exibição, que a organização constrói na plataforma, **publica no provedor** por meio de um Canal e **envia dentro de Mensagens** para que o Contato o preencha sem sair do aplicativo de mensagens. A resposta do Contato volta como dado estruturado — a **Resposta de Flow** — em uma Mensagem `recebida`.

O Flow é uma **definição versionada**, não uma execução: o mesmo Flow é enviado a mil Contatos; cada envio é uma Mensagem, cada preenchimento é uma Resposta. O que a Meta chama de "WhatsApp Flow" corresponde à Versão publicada; o que a organização edita é a Versão `rascunho`; o Flow é a identidade que atravessa as versões — o mesmo padrão de Habilidade (B71) e Agente (B74).

Três propriedades:

1. **É conteúdo, não canal nem conversa.** O Flow não sabe para quem foi enviado; a Mensagem sabe qual Flow e qual Versão carrega (7.6). Não há "Conversa do Flow": a Resposta entra na Conversa 1:1 do Contato.
2. **É publicado por um Canal.** Só existe no provedor depois de publicado por um Canal do Tipo de Canal com a capacidade "formulários interativos" (22, 7.4); o Canal publicador é referência mutável, e a Versão publicada registra por qual Canal e quando.
3. **Tem esquema do provedor.** Cada Versão declara a **Versão de esquema do provedor** (ex.: "7.3") a que os seus Componentes obedecem; o catálogo de Componentes (7.4) é fixado pela plataforma por Versão de esquema, como as Capacidades do Tipo de Canal.

## 2. Propósito

1. Coletar dados estruturados (CPF, data, escolha) com validação no aparelho do Contato, sem troca de texto livre.
2. Padronizar processos conversacionais (agendamento, triagem, confirmação de dados) que hoje dependem do Atendente perguntar campo a campo.
3. Alimentar Automações e Agentes com Respostas tipadas (criar Negócio quando `cargo` = RH; atualizar Valor de Campo do Contato).
4. Versionar com segurança: Mensagens antigas referenciam a Versão com que foram enviadas; publicar uma nova não altera o que já está no aparelho do Contato.

## 3. Natureza da entidade

Entidade com identidade própria, contida pelo Espaço de Trabalho; Recurso de permissão; Fonte de Dados (Respostas por Flow, por Versão, por Tela de abandono); escopo de Automação (B114); âncora de Sessão de Chat (DO-ATV-09). Raiz do agregado **Flow → Versão → Tela → Componente**. Não tem Proprietário (22, 10). Não é Ator.

| Entidade interna | Natureza | Identidade |
| --- | --- | --- |
| **Versão de Flow** | entidade interna, 1..N por Flow; imutável quando `publicada` ou `obsoleta` | própria (referenciada por Mensagens e Respostas) |
| **Tela** | entidade interna da Versão, 1..N, ordenada | própria dentro da Versão (Identificador de Tela: texto `[a-z_]+`, único na Versão) |
| **Componente** | entidade interna da Tela, árvore (contêineres `Formulário` e `Condicional` têm filhos) | própria dentro da Tela |
| **Campo de Flow** | derivado: todo Componente de entrada com Nome | — (o Nome é a chave) |
| **Dado de Tela** | objeto de valor da Tela: declarações de dados que a Tela recebe (nome, tipo, exemplo) | — |
| **Ponto de troca de dados** | objeto de valor do Flow: endereço e par de chaves para `troca de dados` | — |
| **Resposta de Flow** | objeto de valor da **Mensagem `recebida`** (documento 14), não do Flow | — (a Mensagem tem identidade) |

## 4. Fronteira conceitual

**É**: definição versionada de formulário interativo; conteúdo que Mensagens carregam; Ativo publicável.

**Não é**: Mensagem de modelo (texto aprovado pelo provedor — 14, 7.3; um Flow pode ser anexado a uma Mensagem de modelo, mas não é uma); Template (A8: Template instancia entidades da plataforma; o Flow é enviado, não instanciado); Habilidade (não tem raciocínio, não é executada por Agente — é conteúdo que um Agente pode enviar); Automação (não tem Gatilho; a "troca de dados" que chama um endereço externo é capacidade do provedor, não Ação); Documento de Conhecimento (B19); Tarefa; Conversa.

**Comparações**: Habilidade (versões `rascunho`/`publicada`/`obsoleta` — mesmo padrão, mas a Habilidade é competência de Agente e o Flow é conteúdo enviável); Template de Mensagem (22, 7.2 — conteúdo estático; o Flow é interativo e publicado no provedor); Definição de Campo (A5 — o Campo de Flow é interno ao Flow e só vira Valor de Campo do Contato por Automação explícita — RN-FLW-14).

## 5. Identidade

Identificador imutável, opaco, da plataforma. O **Identificador externo** (identificador do Flow na Meta) é atributo, preenchido na primeira publicação e único por INV-ATV-01.

**Teste de identidade.** Renomear, publicar dez Versões, trocar o Canal publicador, alterar o Ponto de troca de dados: mesmo Flow. Mensagens e Respostas referenciam **Flow + Versão** por identidade; Painéis por Versão continuam corretos após qualquer edição. Copiar um Flow cria outro Flow com Proveniência ("copiado de", Flow e Versão à época), sem vínculo vivo (padrão B108).

**Identidade da Versão.** Cada Versão tem identificador próprio e um **Número de versão** (sequencial, `1`, `2`, …; o produto pode exibir como `1.0.0`). `publicada` e `obsoleta` são imutáveis: corrigir é criar Versão nova a partir da corrente (RN-FLW-05).

**Identidade da Tela.** O Identificador de Tela é texto escolhido pela organização, único na Versão; renomear o Identificador é permitido só em `rascunho` e reescreve as referências internas (Ações `navegar`) na mesma operação (RN-FLW-08).

## 6. Atributos fundamentais

### 6.1 Flow

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Atributos comuns (22, 6) | — | — | Identificador, Espaço de Trabalho, Tipo de Canal, Identificador externo (após publicar), Nome, Canal publicador (0..1), ciclo de vida, Sincronização, Criador, Origem de criação, Proveniência, Tags, Valores de Campo, Vínculos, Comentários. |
| Descrição | nativo | não | Uso interno. |
| Categoria do provedor | nativo (enumeração do provedor) | sim | Ex.: `formulário de cadastro`, `agendamento`, `pesquisa`, `outro`; exigida pelo provedor na publicação. |
| Versões | entidade interna 1..N | sim | 6.2. Nasce com uma Versão `rascunho`. |
| Versão corrente | derivado | — | A única `rascunho` (0..1). |
| Versão publicada | derivado | — | A única `publicada` (0..1). |
| Ponto de troca de dados | objeto de valor | não | Endereço externo que responde às Ações `troca de dados`; **par de chaves** (pública, exibível; privada, sigilosa — nunca exibida após gravada, como Credenciais de Integração); momento de geração. Sem ele, Componentes com `troca de dados` são rejeitados na validação (RN-FLW-10). |
| Estado no provedor | espelhado | condicional | Após publicar: `publicado`, `bloqueado pelo provedor`, `descontinuado`, `removido`; vem da Sincronização. |
| Envios; Respostas; Taxa de conclusão | derivados | — | Contagem de Mensagens `enviada` que carregam o Flow, de Respostas, e razão; por Versão. Nunca gravados. |

### 6.2 Versão de Flow

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador; Flow; Número de versão | nativo / referência | sim | Imutáveis. |
| Estado da Versão | nativo | sim | `rascunho`, `publicada`, `obsoleta` (11). |
| Versão de esquema do provedor | nativo | sim | Ex.: "7.3". Fixa por Versão; determina o catálogo de Componentes admitido. |
| Telas | entidade interna 1..N, ordenada | sim | 6.3. Ao menos uma Tela `terminal` (INV-FLW-03). |
| Tela inicial | derivado | — | A primeira da ordem. |
| Notas da versão | nativo | não | Texto livre. |
| Publicada por; momento; Canal publicador à época | referência (Ator); nativo; referência (Canal) | condicional | Preenchidos ao publicar; imutáveis. |
| Definição publicável | derivado | — | O documento no formato do provedor, gerado da árvore (RN-FLW-11). Nunca editado à mão; nunca gravado como fonte (a árvore é a fonte). Um **instantâneo** dele é gravado na publicação como valor imutável, para auditoria. |
| Proveniência | objeto de valor | não | Versão a partir da qual foi criada (identificador e Número à época). |

### 6.3 Tela

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador de Tela | nativo (texto `[a-z_]+`) | sim | Único na Versão; usado pelas Ações `navegar`. |
| Título | nativo (≤ limite do provedor) | sim | Exibido no cabeçalho da Tela no aparelho. |
| Ordem | nativo | sim | Posição na Versão; determina a Tela inicial e a "próxima" padrão. |
| Terminal | nativo (booleano) | sim | Tela onde o preenchimento pode ser concluído. A última da ordem deve ser terminal (INV-FLW-03). |
| Dados de Tela | objeto de valor 0..N | não | Declarações `{nome, tipo, exemplo}` do que a Tela recebe da Tela anterior (via carga útil de `navegar`) ou do Ponto de troca de dados. |
| Componentes | entidade interna 1..N (árvore) | sim | 6.4. Todo Componente de nível raiz que não seja `Rodapé` fica dentro de um `Formulário` implícito na Definição publicável (RN-FLW-11). |
| Rodapé | derivado | — | O único Componente `Rodapé` da Tela (0..1); ausente em Tela terminal ⇒ a Definição publicável recebe um Rodapé `concluir` padrão. |

### 6.4 Componente

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Interno. |
| Tipo de Componente | referência (catálogo — 7.4) | sim | Imutável (mudar de tipo é remover e criar). |
| Propriedades | objeto de valor tipado pelo Tipo | sim | Conforme o catálogo: texto, rótulo (com limite), obrigatório, opções, mínimo/máximo, validação por padrão, texto de ajuda, valor inicial, habilitado, visível (booleano ou Expressão). |
| Nome | nativo | condicional | Obrigatório em Componentes de entrada; único **na Versão** (INV-FLW-04); é a chave do Campo de Flow e da Resposta. |
| Ação | objeto de valor | condicional | Só em `Rodapé`, `Link incorporado`, `Consentimento`, `Lista de navegação` e nas Opções com ação: tipo (`navegar`, `concluir`, `troca de dados`, `abrir endereço`, `atualizar dados`), Tela de destino (para `navegar`/`troca de dados`), carga útil (mapa nome → valor ou Expressão), endereço (para `abrir endereço`). |
| Filhos | entidade interna 0..N ordenada | condicional | Só em `Formulário` e `Condicional`. |
| Condição | Expressão | condicional | Só em `Condicional`: variável (Campo de Flow ou Dado de Tela), operador (`igual`, `diferente`, `contém`, `não contém`, `maior`, `menor`, `preenchido`), valor; ou Expressão manual. |

**Expressão** (objeto de valor): referência a `{formulário.nome}` (Campo de Flow da Tela corrente) ou `{dados.nome}` (Dado de Tela), com operadores do provedor. A ontologia não fixa a sintaxe; fixa que uma Expressão só referencia Nomes existentes (INV-FLW-05).

## 7. Entidades internas ou componentes

### 7.1 Versão de Flow — regras de composição

Exatamente uma `rascunho` por Flow (0 quando o Flow está `arquivado` sem edição em curso — RN-FLW-03). Publicar torna a `publicada` anterior `obsoleta` e a `rascunho` `publicada`, e cria automaticamente uma nova `rascunho` copiada da publicada (para que editar nunca parta do vazio) — DO-FLW-03. Despublicar torna a `publicada` `obsoleta` sem publicar outra (o Flow deixa de ser enviável).

### 7.2 Tela — ordem e navegação

A ordem das Telas é a navegação **padrão**; qualquer Ação `navegar` pode apontar para qualquer Tela da Versão (inclusive anterior). A Definição publicável exige que toda Tela seja alcançável a partir da inicial (INV-FLW-06) e que toda Tela de destino exista (INV-FLW-07).

### 7.3 Campo de Flow (derivado)

Conjunto {Nome, Tipo de valor, Tela, Componente} de todos os Componentes de entrada com Nome. É o vocabulário das Expressões, das cargas úteis, da Tela de Confirmação gerada (15) e do mapeamento para Valores de Campo do Contato em Automações (RN-FLW-14).

### 7.4 Catálogo de Tipos de Componente (fixo pela plataforma, por Versão de esquema)

| Grupo | Tipo | Entrada? | Propriedades essenciais (limites do provedor à época: esquema 7.3) |
| --- | --- | --- | --- |
| Texto e mídia | `Título` (≤ 80), `Subtítulo` (≤ 80), `Parágrafo` (≤ 4 096; peso; tachado; markdown), `Legenda` (≤ 409), `Texto rico` (markdown), `Imagem` (Arquivo ≤ 300 KB; largura, altura, escala, proporção, texto alternativo), `Carrossel de imagens` (1..N Imagens; proporção) | não | visível |
| Entrada | `Campo de texto` (rótulo ≤ 20; tipo `texto`/`número`/`e-mail`/`senha`/`código`/`telefone`; padrão; mín./máx. caracteres; ajuda ≤ 80), `Área de texto` (comprimento máx.), `Escolha única` (rótulo ≤ 30; opções com id, título, descrição, imagem; ação ao selecionar), `Múltipla escolha` (idem + mín./máx. selecionados), `Menu suspenso` (rótulo ≤ 20), `Chips` (rótulo ≤ 80; mín./máx.), `Consentimento` (texto ≤ 120; ação opcional para termos), `Seletor de data` (mín./máx.; datas indisponíveis), `Calendário` (modo `único`/`intervalo`; dias permitidos; mín./máx. dias), `Coleta de fotos` (origem `câmera e galeria`/`galeria`/`câmera`; mín./máx.), `Lista de navegação` (itens com título, descrição, imagem; ação) | sim | Nome, obrigatório, valor inicial, habilitado, visível, mensagem de erro |
| Contêiner | `Formulário` (nome; valores iniciais; mensagens de erro), `Condicional` (Condição; filhos exibidos quando verdadeira) | não | — |
| Ação | `Link incorporado` (texto ≤ 25; Ação), `Rodapé` (rótulo ≤ 35; Ação; legendas esquerda/centro/direita ≤ 15; habilitado) | não | — |

Os limites são **do provedor à época** e vivem na plataforma como Limite imposto por Versão de esquema; a ontologia fixa que **a validação (7.5) os aplica** — o benchmark deixa isso para a Meta rejeitar.

### 7.5 Validação da Versão (regra derivada, aplicada antes de publicar)

1. Ao menos uma Tela; a última é `terminal`; toda Tela é alcançável; toda Tela de destino existe.
2. Todo Componente de entrada tem Nome; Nomes únicos na Versão.
3. `Rodapé` com `navegar` tem Tela de destino; `concluir` só em Tela terminal; `troca de dados` exige Ponto de troca de dados no Flow.
4. Toda Expressão referencia Nomes existentes; toda carga útil de `navegar` referencia Campos da Tela corrente ou Dados de Tela; toda `{dados.x}` usada em uma Tela está declarada nos Dados dessa Tela.
5. Limites de caracteres, tamanhos de Arquivo e cardinalidades de opções do catálogo.
6. No máximo um `Rodapé` por Tela; `Rodapé` é o último Componente de nível raiz.

Uma Versão inválida pode ser salva como `rascunho` (a validação é para publicar, não para editar — DO-FLW-04).

### 7.6 Mensagem com Flow e Resposta de Flow (extensão do documento 14, 7.6)

- Uma **Mensagem `enviada`** pode carregar um Flow: referência (Flow, Versão `publicada` à época), texto de cabeçalho/corpo/rodapé, rótulo do botão de abertura, Tela inicial (padrão: a primeira) e **dados iniciais** (mapa para os Dados de Tela da Tela inicial — permite pré-preencher com dados do Contato). Só Versão `publicada` pode ser enviada (INV-FLW-02). Envio fora da Janela de resposta segue a regra de Mensagem de modelo (14, RN-CXE-19): o Flow é anexado à Mensagem de modelo.
- A **Resposta de Flow** é objeto de valor de uma **Mensagem `recebida`**: referência (Flow, Versão), Identificador de resposta do provedor, momento, **valores** (mapa Nome → valor, tipados pelo Campo de Flow), Tela de conclusão, e referência à Mensagem `enviada` que a originou (0..1 — o provedor pode não relacionar). A Mensagem `recebida` é resolvida ao Contato por Identificador (B13) como qualquer outra e entra na Conversa 1:1; a Resposta é o seu conteúdo estruturado, além do texto de resumo que o provedor entrega.
- **Abandono** não é Mensagem: o provedor não o entrega. Taxa de conclusão é derivada por (enviadas com Flow, Respostas).

## 8. Relações

| Relação | Cardinalidade | Tipo | Efeito de remoção |
| --- | --- | --- | --- |
| Flow → Versão | 1 → 1..N | composição | Versões eliminadas com o Flow; Mensagens mantêm (título, Número) como valor. |
| Versão → Tela → Componente | 1..N → 1..N | composição | — |
| Flow → Canal publicador | 0..1 | referência mutável (22, RN-ATV-03) | Canal arquivado ⇒ `órfão`; a Versão `publicada` continua enviável **por outro Canal do mesmo Tipo?** Não: o Flow publicado pertence à conta do provedor; trocar o Canal exige republicar (RN-FLW-09). |
| Mensagem `enviada` → Flow + Versão | 0..1 | referência | valor à época. |
| Mensagem `recebida` → Resposta de Flow → Flow + Versão | 0..1 | referência | idem. |
| Flow ↔ Contato | derivado | via Respostas (a ficha do Contato lista Respostas de Flow — 10, 8.1 por extensão) | — |
| Automação (19) → Flow | 0..N | escopo (Gatilho "Resposta de Flow recebida" — B114) e Ação `enviar Flow` | Flow eliminado ⇒ Automação com escopo só nele eliminada (B41). |
| Agente (17) → Flow | 0..N | Ferramenta `enviar Flow` (permissão `executar`) | — |
| Painel (21) → Flow, Resposta de Flow | — | entidades-alvo (B115) | — |
| Flow → Ponto de troca de dados → endereço externo | 0..1 | objeto de valor | Não é Integração (não tem estado de conexão; é o provedor que chama o endereço). |
| Flow → Template de Mensagem | não há | — | Um Template de Mensagem pode declarar "anexar Flow X" como parte do conteúdo (22, 7.2 — Tipo `flow`); registrado como DO-FLW-07. |

## 9. Cardinalidades

Flow: 1..N Versões; 0..1 `rascunho`; 0..1 `publicada`; 0..N `obsoleta`; 0..1 Canal publicador; 0..1 Ponto de troca de dados; 0..N Mensagens; 0..N Respostas. Versão: 1..N Telas; 1..N Telas `terminal`. Tela: 1..N Componentes; 0..1 `Rodapé`; 0..N Dados de Tela. Componente de entrada: exatamente 1 Nome.

## 10. Hierarquia, pertencimento e propriedade

Contido pelo Espaço de Trabalho; sem Proprietário (infraestrutura de conteúdo administrada — 22, 10); Criador e Membro que publicou cada Versão são rastreabilidade. `administrar` por Papel ou concessão; o Canal publicador confere `ver`/`editar` a quem o administra (DO-ATV-05).

## 11. Estados

**Ciclo de vida** (A4.1): `ativo`, `arquivado` (não enviável; Respostas continuam a chegar para Mensagens já enviadas e são persistidas), `na lixeira`.

**Estado da Versão**: `rascunho` (editável; inválida ou válida), `publicada` (imutável; enviável; no máximo uma), `obsoleta` (imutável; não enviável; referenciada por Mensagens antigas). Transições: `rascunho` → `publicada` (publicar; exige válida, Canal publicador `conectada`, e o provedor aceitar); `publicada` → `obsoleta` (ao publicar a próxima ou ao despublicar); `rascunho` → eliminada (descartar rascunho; só se houver outra Versão — INV-FLW-01). Nunca `obsoleta` → `publicada` (republicar uma antiga é criar `rascunho` a partir dela e publicar — RN-FLW-05).

**Estado no provedor** (espelhado, só Flow publicado): `publicado`, `bloqueado pelo provedor` (o provedor suspendeu; não enviável; Evento), `descontinuado` (a Versão de esquema deixou de ser aceita; não enviável; Evento — o produto sugere migrar), `removido` (apagado no provedor; a Versão fica `obsoleta` com Registro).

**Estado de sincronização** (22, 11).

## 12. Ciclo de vida

### 12.1 Criação

Por Membro com `criar` (Flow) — registro `ativo`, Origem `criado pela plataforma`, Versão 1 `rascunho` com uma Tela inicial vazia; ou por cópia de outro Flow (Proveniência); ou por Agente/Automação em nome de Membro. Não há importação do provedor nesta versão (o provedor não expõe a árvore) — C37.

### 12.2 Edição

Só a Versão `rascunho` é editável: Telas (criar, duplicar, reordenar, remover — remover a última terminal é rejeitado se restar Tela final não terminal), Componentes (inserir, mover, duplicar, remover; mover para dentro de `Condicional`/`Formulário`), propriedades, Ações, Dados de Tela, Ponto de troca de dados (no Flow). Toda edição gera Registro agregado (por sessão de edição, não por tecla — decisão de produto). Edição de `publicada`/`obsoleta` é rejeitada.

### 12.3 Publicação

Ferramenta `publicar Versão de Flow`: valida (7.5) → envia a Definição publicável ao provedor pelo Canal publicador → grava Identificador externo (primeira vez), instantâneo, Publicada por, momento → `publicada`, anterior `obsoleta`, nova `rascunho` copiada (DO-FLW-03). Falha do provedor: nada muda; Registro com motivo. Classe de efeito `externa` (aprovação em `supervisionado`).

### 12.4 Envio e resposta

`enviar Flow` cria Mensagem `enviada` (14, 12.5) com referência à `publicada`. Resposta chega como Mensagem `recebida` com Resposta de Flow; Eventos "Resposta de Flow recebida" (Gatilho de Automação). Flow `arquivado` não bloqueia Respostas pendentes.

### 12.5 Arquivamento, lixeira, eliminação

Arquivar: não enviável; `rascunho` preservada; a `publicada` continua no provedor (a plataforma não despublica por arquivar — o produto pergunta; despublicar é Ferramenta separada). Lixeira: B43. Eliminação: Versões, Telas, Componentes eliminados; Mensagens mantêm valor; Respostas permanecem nas Mensagens; o objeto no provedor não é tocado (INV-ATV-05).

## 13. Regras de negócio ontológicas

- **RN-FLW-01** Só Versão `publicada` é enviável; a Mensagem referencia Flow e Versão por identidade.
- **RN-FLW-02** Um Flow tem no máximo uma Versão `publicada` e no máximo uma `rascunho`.
- **RN-FLW-03** Todo Flow `ativo` tem ao menos uma Versão; descartar a única é rejeitado.
- **RN-FLW-04** `publicada` e `obsoleta` são imutáveis, inclusive Telas e Componentes.
- **RN-FLW-05** Corrigir ou reverter é criar `rascunho` a partir de qualquer Versão (Proveniência) e publicar.
- **RN-FLW-06** Publicar exige Versão válida (7.5), Canal publicador do mesmo Tipo, `ativo` e `conectada`, e aceitação do provedor.
- **RN-FLW-07** Nome de Componente de entrada é único na Versão e é a chave da Resposta.
- **RN-FLW-08** Renomear Identificador de Tela reescreve todas as Ações que a referenciam, atomicamente.
- **RN-FLW-09** Trocar o Canal publicador de Flow já publicado exige republicar pelo novo Canal; até lá, a `publicada` fica `obsoleta` (o objeto publicado pertence à conta anterior).
- **RN-FLW-10** Ação `troca de dados` exige Ponto de troca de dados; a chave privada nunca é exibida nem exportada; regenerar o par invalida o anterior com Registro e exige republicar.
- **RN-FLW-11** A Definição publicável é derivada da árvore por regra fixa da plataforma por Versão de esquema; nunca é editada à mão nem importada como fonte.
- **RN-FLW-12** Valores de Resposta obedecem ao Tipo do Campo de Flow da Versão referenciada; o provedor é a fonte; a plataforma não "corrige" respostas.
- **RN-FLW-13** Flow `arquivado` recusa `enviar` e `publicar`; aceita Respostas e `sincronizar`.
- **RN-FLW-14** Resposta de Flow não altera o Contato por si; gravar Valores de Campo, Tags, Consentimento ou criar Negócio a partir dela é Automação (Gatilho "Resposta de Flow recebida") ou ato humano, sob permissão.
- **RN-FLW-15** Consentimento (B54) declarado por Componente `Consentimento` respondido afirmativamente **pode** ser registrado como Consentimento do Contato com origem "Flow X, Versão N, Mensagem M" — por Automação, nunca por inferência (C35).
- **RN-FLW-16** Imagens de Componentes são Arquivos do Espaço de Trabalho (A8) copiados para a Definição publicável no formato do provedor; eliminar o Arquivo depois de publicada não afeta a `publicada` (instantâneo) e invalida a `rascunho` que o referencie.

## 14. Invariantes

- **INV-FLW-01** Flow `ativo` ⇒ ao menos uma Versão.
- **INV-FLW-02** Mensagem `enviada` com Flow referencia Versão que era `publicada` no momento do envio.
- **INV-FLW-03** Versão `publicada` ⇒ última Tela `terminal` e toda Tela alcançável.
- **INV-FLW-04** Nomes de Componentes de entrada únicos por Versão.
- **INV-FLW-05** Toda Expressão e carga útil de Versão `publicada` referencia Nomes e Dados existentes.
- **INV-FLW-06** Toda Tela de Versão `publicada` é alcançável a partir da inicial.
- **INV-FLW-07** Toda Tela de destino de Versão `publicada` existe na Versão.
- **INV-FLW-08** Identificador externo único por INV-ATV-01; preenchido ⇔ já publicado ao menos uma vez.
- **INV-FLW-09** Chave privada do Ponto de troca de dados nunca sai da plataforma.

## 15. Personalização

Definições de Campo e Tags no Flow (B113). **Templates de Tela** (padrão de produto, não Template ontológico): a plataforma oferece geradores — "Tela de confirmação" (gera Tela terminal com os Campos de Flow e Rodapé `concluir` com carga útil), "Agendamento", "Validador de CPF", "Consulta de CEP" (Tela com `troca de dados`) — que **inserem Componentes no `rascunho`**; não são Templates (A8) porque não instanciam entidade com Proveniência; são Ferramentas de edição. O catálogo de geradores é da plataforma. Variáveis de Contato nos textos (`{{contato.nome}}`) são resolvidas no envio pela Mensagem, não pelo Flow (DO-FLW-06).

## 16. Herança

Nenhuma. Nova `rascunho` é cópia da `publicada` (Proveniência), não herança.

## 17. Permissões e visibilidade

`ver` (ler definição, Versões, métricas), `comentar`, `editar` (rascunho), `excluir`, `administrar` (publicar, despublicar, trocar Canal, regenerar chaves), `executar` (enviar em Mensagem — exige também enviar Mensagem na Conversa). Respostas de Flow são vistas por quem vê a Mensagem/Conversa (14, 17); Painéis sobre Respostas filtram pelo visualizador (B20). Agente: `enviar Flow` é `externa` (aprovação em `supervisionado`); Agente nunca publica sem ato humano ou aprovação (B95 por analogia).

## 18. Eventos relevantes

| Evento | Gatilho? | Registro? |
| --- | --- | --- |
| Flow criado / copiado / arquivado / restaurado / eliminado | sim | sim |
| Versão criada / descartada / publicada / despublicada / tornada obsoleta | sim | sim |
| Validação falhou (com lista) | não | sim |
| Canal publicador alterado; chaves regeneradas | sim | sim |
| Flow enviado (Mensagem) | sim (é "Mensagem enviada" com filtro Flow) | sim (na Mensagem) |
| **Resposta de Flow recebida** | sim | sim (na Mensagem) |
| Estado no provedor alterado (`bloqueado`, `descontinuado`, `removido`) | sim | sim |

## 19. Dependências

22 (área, Ferramentas do Canal, Sincronização), 14 (Mensagem, Conversa, Janela de resposta, Mensagem de modelo), 10 (Contato, Consentimento), 19 (Automação), 17 (Agente), A8 (Arquivo).

## 20. Casos limítrofes e ambiguidades

### 20.1 Publicar com Contatos ainda preenchendo a Versão anterior
A anterior fica `obsoleta`, mas o provedor continua a aceitar respostas do que já está no aparelho; a Resposta referencia a Versão `obsoleta` — válido (INV-FLW-02 é sobre o envio). Painéis por Versão separam.

### 20.2 Duas Telas com o mesmo Identificador em Versões diferentes
Permitido: o Identificador de Tela é único na Versão, não no Flow.

### 20.3 Canal publicador arquivado com Flow publicado
Flow `órfão`; `publicada` → `obsoleta` com Registro (RN-FLW-09); Respostas pendentes continuam a chegar por… ninguém: sem Canal, Mensagens não entram (14, 11.1). O produto deve avisar antes de arquivar um Canal que publica Flows.

### 20.4 Provedor descontinua a Versão de esquema 7.3
Estado no provedor `descontinuado`; a plataforma oferece "migrar rascunho para esquema 7.5" como Ferramenta de edição (catálogo por esquema); publicar valida no novo catálogo.

### 20.5 Resposta com Nome que não existe na Versão referenciada
Impossível pela regra do provedor; se ocorrer, a Resposta é persistida íntegra com marcador "não conforme" e Registro — a plataforma nunca descarta dado recebido (analogia com B69).

### 20.6 Agente envia Flow a Contato sem Consentimento `marketing`
Se a Mensagem for de categoria `marketing` (Mensagem de modelo), RN-CON-16 recusa por destino; Flow em Mensagem livre dentro da Janela de resposta não exige (é atendimento). C35 registra a fronteira.

### 20.7 Membro edita rascunho enquanto Automação publica
Publicar é Ferramenta com serialização por objeto (B92): a publicação lê o rascunho no momento do Passo; edições posteriores vão para a nova `rascunho`. Nenhum estado intermediário é visível.

### 20.8 Flow copiado entre Espaços de Trabalho
Não existe (A1.2). Exportar/importar a Definição publicável como arquivo é fora da ontologia (C1/D6).

## 21. O que explicitamente NÃO pertence a esta entidade

Envio em massa (é Automação + Mensagens); histórico de conversas; edição da Definição publicável à mão; hospedagem do endereço de troca de dados (é sistema externo — o Flow só guarda endereço e chaves); aprovação de conta/cobrança; usuários e permissões do construtor (são Membros e Papéis).

## 22. Exemplos conceituais

- Flow "Triagem ocupacional": Versão 1 (esquema 7.3), Telas `dados` (Campo de texto `cpf` número 11, Menu `cargo`, Calendário `data_exame`), `confirmacao` (terminal; Dados `cpf`, `cargo`, `data_exame`; Rodapé `concluir` com carga útil). Publicada por Rafael em 2026-09-20 pelo Canal "Comercial SP". Enviada pelo Agente "Qualificador SDR" a 140 Contatos em Conversas abertas; 91 Respostas; Automação "Triagem → Negócio" cria Negócio no Funil "Vendas B2B" quando `cargo` = `rh`.
- Versão 2 acrescenta `Consentimento` de política de privacidade; publicada; a 1 fica `obsoleta`; 6 Respostas tardias chegam referenciando a 1 e são válidas.

## 23. Representação gráfica textual

```text
Flow "Triagem ocupacional" (Canal publicador: Comercial SP; Ponto de troca de dados: —)
├── Versão 1  [obsoleta]   esquema 7.3   publicada 2026-09-20 por Rafael
├── Versão 2  [publicada]  esquema 7.3   publicada 2026-10-02 por Rafael
│   ├── Tela `dados` (ordem 1)
│   │   ├── Título "Triagem"            ├── Campo de texto `cpf` (número, 11, obrigatório)
│   │   ├── Menu suspenso `cargo`       ├── Calendário `data_exame`
│   │   ├── Consentimento `lgpd`        └── Rodapé "Continuar" → navegar `confirmacao` {cpf, cargo, data_exame}
│   └── Tela `confirmacao` (ordem 2, terminal; Dados: cpf, cargo, data_exame)
│       ├── Parágrafo "{dados.cpf}" …   └── Rodapé "Confirmar" → concluir {…}
└── Versão 3  [rascunho]   copiada da 2
Mensagem enviada (Conversa Camila ↔ Contato Ana) ──▶ Flow + Versão 2
Mensagem recebida ──▶ Resposta de Flow {cpf, cargo: rh, data_exame, lgpd: true} ──▶ Automação "Triagem → Negócio"
```

## 24. Decisões ontológicas

- **DO-FLW-01** Flow é Ativo de Canal publicável, versionado pelo padrão `rascunho`/`publicada`/`obsoleta` (B71 por analogia).
- **DO-FLW-02** Resposta de Flow é objeto de valor da Mensagem `recebida`, na Conversa 1:1 do Contato; não há entidade "Resposta" fora da Mensagem.
- **DO-FLW-03** Publicar cria automaticamente nova `rascunho` copiada da `publicada`.
- **DO-FLW-04** Rascunho pode ser inválido; a validação é condição de publicação.
- **DO-FLW-05** A árvore (Telas/Componentes) é a fonte; a Definição publicável é derivada, com instantâneo imutável na publicação.
- **DO-FLW-06** Variáveis de Contato são resolvidas pela Mensagem no envio; o Flow só conhece Campos e Dados de Tela.
- **DO-FLW-07** Template de Mensagem admite o Tipo de conteúdo `flow` (referência a Flow), instanciado com a Versão `publicada` do momento.
- **DO-FLW-08** Geradores de Tela são Ferramentas de edição, não Templates.

## 25. Questões em aberto

- **25.1 / C37** Importação de Flows já existentes na conta do provedor (o provedor expõe a definição publicada?): sem ela, Flows criados fora da plataforma não são governáveis aqui.
- **25.2** Granularidade do Registro de Atividade na edição de rascunho (por sessão, por salvamento, por operação) — decisão de produto.
- **25.3** Se `Consentimento` respondido deve gerar Consentimento automaticamente por regra da plataforma (hoje: só por Automação — RN-FLW-15; C35).
- **25.4** Endereço de troca de dados hospedado pela plataforma (D19: "Ponto de troca de dados gerido") versus externo.
