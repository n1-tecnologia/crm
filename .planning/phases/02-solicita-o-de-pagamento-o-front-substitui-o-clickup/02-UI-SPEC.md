---
phase: 2
slug: solicita-o-de-pagamento-o-front-substitui-o-clickup
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-18
---

# Phase 2 — UI Design Contract

> Contrato visual e de interação para a Solicitação de pagamento. Gerado por `gsd-ui-researcher` e destinado ao planejador, executor, checker e auditor de UI.

---

## Fontes e precedência

Este contrato materializa as decisões de `02-CONTEXT.md`, os riscos e padrões de `02-RESEARCH.md` e o sistema visual existente em `apps/web`. Quando houver conflito:

1. `02-CONTEXT.md` decide escopo e comportamento de produto.
2. `docs/07-processos/solicitacao-de-pagamento.md` decide campos, Status e processo financeiro.
3. Este arquivo decide apresentação, interação, copy e estados da interface.
4. Os tokens e componentes existentes decidem a implementação visual fina.

Não transportar para a interface os Status preliminares ainda citados em `REQUIREMENTS.md`. Os únicos Status desta Lista são `para fazer`, `em aprovação`, `não aprovado` e `aprovado`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Sistema próprio N1 em `apps/web/src/design` + CSS tokens |
| Preset | not applicable |
| Component library | Primitivas React próprias; Tailwind CSS 4 somente como ponte utilitária |
| Icon library | Lucide React via `Icone`, traço 1.5 |
| Font | SF Pro Display/Text; Inter fallback; JetBrains Mono para identificadores |
| Theme | Escuro, superfícies em lavagens de branco sobre `--page` |

`components.json` não existe. Não inicializar shadcn nesta fase: o app já possui tokens, controles, diálogos, estados vazios, painéis, skeletons e auditoria própria de cores. Componentes de tela devem importar pelo barril `@/features/shell/ui`; não alcançar `design/` diretamente nem criar um sistema paralelo.

### Primitivas obrigatórias a reutilizar

- Estrutura: `PageHeader`, `CorpoDeTela`, `Section`, `Painel`, `CabecalhoDePainel`, `RecordPanel`, `RecordRow`, `ReguaDeSecao`.
- Entrada: `Field`, `TextInput`, `TextArea`, `Select`, `MultiSelect`, `Button`.
- Feedback: `Toast`, `EmptyState`, `Esqueleto`, `EsqueletoDeLinhas`, `ConfirmDialog`.
- Semântica: `Pilula`, `ConditionMarker`, `ActorAvatar`, `Icone`.
- Comentários: reaproveitar o comportamento de fio, menções, foco devolvido e `Ctrl/Cmd+Enter` de `TaskComments`; adaptar a apresentação para a timeline única.

Não criar card genérico, botão, campo, modal, toast, pill, avatar ou skeleton novo se a primitiva existente comportar o caso por composição.

---

## Spacing Scale

A escala autoral desta fase é restrita a 4, 8, 16, 24, 32, 48 e 64px, todos já existentes como tokens. Não adicionar literais de espaçamento nem escolher outros valores para layout novo.

| Token | Value | Usage |
|-------|-------|-------|
| `--e-1` | 4px | Ícone–texto, ajuda curta |
| `--e-2` | 8px | Controles compactos, itens de uma linha |
| `--e-4` | 16px | Respiro mobile e entre grupos pequenos |
| `--e-6` | 24px | Padding de painel e separação de seção |
| `--e-8` | 32px | Separação entre blocos do formulário |
| `--e-12` | 48px | Quebra de macroseção |
| `--e-16` | 64px | Respiro de página pública em tela ampla |

Os valores 12, 20 e 40px podem permanecer apenas como implementação interna herdada de primitivas existentes; não são opções autorais para componentes ou layouts novos desta fase.

Exceptions: nenhuma. O alvo mínimo mobile de 44px é dimensão de controle (`--controle-h-lg`), não um novo token de espaçamento.

### Densidade

- Formulário público: confortável; painel com 24px em desktop e 16px em mobile.
- Fila e Tarefa: densidade de aplicação existente; layout novo usa 16px internos. Primitivas reutilizadas podem conservar internamente seus 12px herdados.
- Um grupo visual não pode depender apenas de whitespace: usar rótulo de seção ou hairline existente.

---

## Typography

O contrato desta fase usa exatamente quatro tamanhos e dois pesos para texto novo. Primitivas compartilhadas mantêm sua implementação interna existente.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / meta | 12px (`--app-sm`) | 600 | 16px |
| Body / data | 13px (`--app-base`) | 400 | 20px |
| Heading | 18px (`--ed-subtitulo`) | 600 | 28px |
| Display | 24px (`--ed-titulo`) | 600 | 30px |

- Valores monetários e contagens usam `app-numero` para numerais tabulares.
- O número da Solicitação usa `identificador`, nunca fonte proporcional.
- Texto de Comentário/RESUMO usa corpo de aplicação e Markdown renderizado pela classe `rico`.
- Caixa-alta e tracking largo ficam restritos a rótulos de seção e botões já definidos pelo sistema.
- Os tokens escalam nos breakpoints existentes de 1440, 1760 e 2200px; não congelar pixels em componente novo.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--page` / `#0f0f10` | Fundo da rota pública e do shell |
| Secondary (30%) | `--card` / `#161617`, `--superficie-1..3` | Painéis, cards, campos e trilhos |
| Accent (10%) | `--acento` / `#c084fc` | CTA principal, foco, item ativo e progresso ativo |
| Destructive | `--erro` / `#fca5a5` | Rejeição em confirmação e erros; nunca decoração |

Accent reserved for: botão `Enviar solicitação`; foco de teclado; seleção ativa; progresso ativo de upload; CTA `Aprovar solicitação`; links de ação prioritários. O acento não colore parágrafos, todos os cards ou todos os controles.

### Cores semânticas

| Estado | Token | Regra |
|--------|-------|-------|
| Sucesso | `--sucesso` | Upload concluído, envio confirmado, decisão aprovada |
| Aviso | `--aviso` | Pendente, validação ainda necessária, processamento atrasado |
| Erro | `--erro` | Upload falhou, envio falhou, rejeição antes de confirmar |
| Informação | `--info` | Metadado de integração e orientação não bloqueante |
| Neutro | `--neutro` | Histórico, decisão encerrada e conteúdo atenuado |

Status da Tarefa usam a cor vinda da Definição de Status e sempre exibem o rótulo textual. `não aprovado` não transforma a página inteira em vermelho; vermelho fica reservado ao gesto de rejeitar e ao erro presente.

---

## Copywriting Contract

Toda copy é pt-BR, direta e orientada a ação. Usar “Solicitação” com inicial maiúscula apenas quando nomear a entidade; usar “solicitação” na frase comum. Evitar “request”, “job”, “task”, “pipeline” e mensagens técnicas na UI.

| Element | Copy |
|---------|------|
| Título do formulário | `Solicitação de pagamento` |
| Introdução | `Preencha os dados do pagamento. O Financeiro acompanhará a solicitação por este número.` |
| Primary CTA | `Enviar solicitação` |
| Busy CTA | `Enviando solicitação…` |
| Upload CTA | `Adicionar arquivos` |
| Upload hint | `PDF, XML, JPG, PNG ou WebP. Até 25 MB por arquivo e 10 arquivos por envio.` |
| Confirmation heading | `Solicitação enviada` |
| Confirmation body | `Recebemos sua solicitação. Guarde o número abaixo para falar com o Financeiro.` |
| Confirmation secondary CTA | `Enviar outra solicitação` |
| Queue empty heading | `Nenhuma solicitação aguarda sua decisão.` |
| Queue empty body | `Quando uma solicitação for encaminhada para você, ela aparecerá aqui.` |
| Other approvers empty heading | `Nenhuma solicitação aguarda outros aprovadores.` |
| Other approvers empty body | `Quando outra pessoa precisar decidir, acompanhe a solicitação aqui ou abra a tarefa para consultar a timeline.` |
| Decided empty heading | `Nenhuma solicitação foi decidida.` |
| Decided empty body | `Depois de aprovar ou rejeitar uma solicitação, consulte aqui a decisão ou abra a tarefa para ver a timeline.` |
| Timeline empty | `Nenhum comentário ou atividade nesta Solicitação.` |
| Generic public error | `Não foi possível enviar a solicitação. Seus dados continuam aqui; tente novamente.` |
| Generic authenticated error | `Não foi possível concluir a ação. Tente novamente.` |
| Unavailable form | `Formulário indisponível` |
| Unavailable form body | `Este link não está disponível. Peça um novo link ao Financeiro.` |
| Destructive confirmation | `Rejeitar solicitação? Esta decisão muda o status para “não aprovado” e fica registrada na timeline. Informe o motivo para continuar.` |

### Vocabulário de ações

- `Aprovar solicitação`, não apenas `Aprovar`, quando a ação estiver fora do card.
- `Rejeitar solicitação`, não `Reprovar` na interface; o comentário canônico continua `❌ Reprovado por <nome>` por decisão de domínio.
- `Abrir tarefa`, `Ver anexos`, `Tentar novamente`, `Remover arquivo`, `Copiar número`.
- `Usar fluxo manual` é uma ação restrita ao Financeiro; nunca chamar de “ignorar validação”.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn não inicializado |
| third-party | none | nenhuma dependência de registry permitida nesta fase |

Lucide já está instalado e deve ser usado apenas pelo wrapper `Icone`. Nenhum bloco ou componente remoto entra no contrato.

---

## Princípios de interação

1. O formulário confirma quando Tarefa, respostas, anexos e evento de saída foram persistidos; não espera o `automation/` processar.
2. A interface nunca afirma que o pagamento foi aprovado, lançado ou pago no momento do envio.
3. O número legível é o recibo público. Não há link público de acompanhamento nesta fase.
4. Aprovação por clique e por comentário mostram o mesmo fato de negócio, a mesma autoria e o mesmo Status.
5. Aprovação financeira não mostra prazo, contagem regressiva, vencimento ou expiração.
6. Ações indisponíveis explicam a razão antes do clique, usando `disabledReason` e texto visível quando necessário.
7. Dados financeiros não aparecem em URL, título da aba, toast genérico, analytics ou mensagem técnica de erro.

---

## Superfícies da fase

| Superfície | Rota/contexto | Responsabilidade |
|------------|---------------|------------------|
| Formulário público | `/f/[segredo]` | Coletar a Solicitação e anexos sem login |
| Confirmação pública | Mesma rota, após sucesso | Entregar recibo com número legível |
| Fila de aprovações | `/ia/aprovacoes` | Separar aprovações de processo e de Agente; decidir as autorizadas |
| Card de aprovação da Tarefa | Página cheia da Tarefa | Mostrar contexto e permitir a mesma decisão da fila |
| Timeline | Página cheia da Tarefa | Intercalar Comentários e Registros de Atividade |
| Anexos da Tarefa | Lateral da página cheia | Listar arquivos persistidos e permitir download autorizado |

O painel rápido de Tarefa pode mostrar o estado da aprovação em leitura e apontar para a página cheia. Não duplicar nele o formulário de decisão nem a timeline completa.

---

## Formulário público

### Composição

- Fundo `grade-pontos`, sem shell autenticado, com conteúdo central de no máximo 48rem.
- Cabeçalho fora do painel: marca discreta, `Solicitação de pagamento` e a introdução definida neste contrato.
- Um painel sólido contém o formulário. Em desktop, campos curtos relacionados podem usar duas colunas; campos longos, uploads e explicações ocupam a largura toda.
- Em mobile, tudo vira uma coluna e a ordem DOM é a ordem visual.
- A página renderiza apenas um DTO público sanitizado. Nunca entregar IDs de Membro, regras internas, credenciais, opções invisíveis ou configuração inteira da Lista.

### Ordem e agrupamento

O formulário configurado continua sendo a fonte das perguntas. Para o Formulário canônico da Solicitação, a apresentação segue esta ordem:

1. **Sobre a solicitação** — título/descrição curta: `O que deve ser pago?`; descrição longa: `O que é e como será utilizado?`.
2. **Solicitante** — `Nome do solicitante`, `WhatsApp`.
3. **Classificação** — `Centro de Custo`, `BU`, `Empresa`, `Categoria de pagamento`, `Produto`.
4. **Fornecedor** — `Pessoa` quando o respondente autenticado tiver acesso; no público, `Fornecedor` (CPF/CNPJ), documento correspondente e `Nome do fornecedor`.
5. **Documento e datas** — `Anexo`, `Data de Emissão`, `Data Vencimento`, `Valor`.
6. **Pagamento** — `Forma de pagamento` e apenas os campos coerentes com a opção escolhida.
7. **Revisão** — resumo compacto antes do CTA; valores vazios opcionais não aparecem.

`Integração manual` e `Equipe` não aparecem no Formulário público. `Integração manual` vive somente na Tarefa para o Financeiro e exige a ação explícita `Usar fluxo manual` com motivo.

### Campos condicionais

| Escolha | Mostrar |
|---------|---------|
| Fornecedor = `CPF` | `CPF`; ocultar `CNPJ` |
| Fornecedor = `CNPJ` | `CNPJ`; ocultar `CPF` |
| Forma = `Chave Pix` | `Chave pix` |
| Forma = `Boleto` | `Código de barras` e upload `Boleto` |
| Forma = `QRCode Pix` | `Pix copia e cola` e upload `QR Code` |
| Forma = `Cartão` | `Link de pagamento` |

Ocultar não apaga silenciosamente o que já foi digitado. Ao trocar uma opção que tornaria outro campo irrelevante, abrir confirmação curta:

- Título: `Trocar forma de pagamento?`
- Descrição: `Trocar a forma de pagamento remove os dados preenchidos em <campo>.`
- CTAs: `Manter forma atual` e `Trocar e limpar dados`.

`Trocar e limpar dados` confirma a nova escolha e limpa o valor; `Manter forma atual` fecha a confirmação e preserva a escolha anterior.

### Obrigatoriedade e validação

- Asterisco e `aria-required` só aparecem nas perguntas marcadas como obrigatórias no Formulário. Não inventar obrigatoriedade de UI além da configuração.
- `Centro de Custo` é a única obrigatoriedade do schema da Lista; título pode ser obrigatório pela própria definição do Formulário.
- Documento, anexo e dado de pagamento exibem a ajuda `Necessário para seguir à aprovação.` quando não forem obrigatórios no envio. A validação do pipeline continua sendo a autoridade.
- Moeda usa entrada amigável em reais e envia centavos; exibir `R$ 0,00`, não float.
- CPF, CNPJ, telefone e datas recebem máscara de apresentação sem alterar o valor canônico enviado.
- Erro de campo fica abaixo do controle e o resumo de erros no topo recebe foco após tentativa inválida.
- Não desabilitar permanentemente o CTA só porque um campo está vazio; no primeiro carregamento, o CTA pode estar ativo e a submissão leva o foco ao primeiro erro. Durante upload ou envio, o CTA fica desabilitado.

---

## Upload e anexos

### Controle

Cada pergunta de arquivo usa o mesmo componente composto, configurado com o papel do anexo (`Anexo`, `Boleto`, `QR Code`):

- Área de upload com ícone `Paperclip`/`Upload`, rótulo, ajuda de formato e botão `Adicionar arquivos`.
- Arrastar e soltar é atalho, nunca a única maneira. O input de arquivo permanece associado ao rótulo.
- Aceitar inicialmente PDF, XML, JPEG, PNG e WebP; até 25 MB por arquivo; no máximo 10 arquivos somando todos os campos do envio.
- A lista de arquivos fica imediatamente abaixo, na ordem escolhida.

### Linha de arquivo

Mostrar nome truncável, tamanho, papel, progresso e ação disponível. Estados e copy:

| Estado | Apresentação | Ação |
|--------|--------------|------|
| `aguardando` | `Aguardando envio` em neutro | `Remover arquivo` |
| `enviando` | Barra/progresso + `Enviando 42%` | `Cancelar envio do arquivo`, quando tecnicamente seguro |
| `enviado` | Check + `Arquivo enviado` em sucesso | `Remover arquivo` antes do envio final |
| `falhou` | `Não foi possível enviar este arquivo.` em erro | `Tentar novamente` e `Remover arquivo` |

- A barra usa `role="progressbar"` com valores; o texto percentual continua visível.
- O CTA principal aguarda todos os arquivos terminarem. Copy do motivo: `Aguarde o envio dos arquivos ou remova os que falharam.`
- Retry reutiliza a mesma sessão/submission ID. Uma falha não limpa outros arquivos nem respostas.
- Remover antes da submissão é reversível apenas escolhendo o arquivo novamente; não requer modal destrutivo.
- Depois de confirmada a Solicitação, a rota pública não lista nem oferece download dos anexos.

### Anexos na Tarefa

- Reaproveitar o painel `Anexos`, mas o clique de download pede URL assinada nova e mostra estado de carregamento por linha.
- Mostrar nome, tipo, tamanho e data. Não mostrar caminho do bucket, token, hash ou expiração da URL.
- URL expirada repete a obtenção automaticamente uma vez; se falhar, copy `Não foi possível abrir o arquivo. Tente novamente.`

---

## Confirmação pública

Substituir o formulário inteiro por um `Painel solido` após sucesso. Dentro dele, a região com `role="status"` contém somente ícone de sucesso, heading, body, identificador legível e o feedback `Número copiado.` quando aplicável. O rótulo visual do número e os botões ficam fora dessa live region; o identificador mantém nome acessível associado a `Número da solicitação`.

Ordem visual:

1. Ícone de sucesso e heading `Solicitação enviada`.
2. Body definido no contrato.
3. Fora da região `role="status"`, rótulo `Número da solicitação`.
4. Dentro da região, identificador legível em fonte monoespaçada, grande o bastante para copiar e ditar.
5. Fora da região `role="status"`, ação `Copiar número`; seu feedback `Número copiado.` é anunciado pela região.
6. Também fora da região, ação secundária `Enviar outra solicitação`.

Não mostrar nome da Tarefa como único recibo, link de acompanhamento, Status interno, aprovador, anexos, prazo estimado ou sucesso do `automation/`.

Ao iniciar outro envio, gerar nova sessão de submissão, limpar respostas e voltar o foco ao heading do formulário.

---

## Fila de aprovações

### Estrutura

Manter a página e o esqueleto de seções existentes:

1. `Aguardando a sua decisão`.
2. `Aguardando outros aprovadores`.
3. `Decididas`.

Estados vazios por seção:

- `Aguardando a sua decisão`: heading `Nenhuma solicitação aguarda sua decisão.`; body `Quando uma solicitação for encaminhada para você, ela aparecerá aqui.`
- `Aguardando outros aprovadores`: heading `Nenhuma solicitação aguarda outros aprovadores.`; body `Quando outra pessoa precisar decidir, acompanhe a solicitação aqui ou abra a tarefa para consultar a timeline.`
- `Decididas`: heading `Nenhuma solicitação foi decidida.`; body `Depois de aprovar ou rejeitar uma solicitação, consulte aqui a decisão ou abra a tarefa para ver a timeline.`

Não criar página separada para o Financeiro. Aprovações de `agentExecution` e `processTask` coexistem e são discriminadas visualmente:

- Pill `Execução de Agente`: conserva objeto, cadeia, prazo e link para Execução.
- Pill `Solicitação de pagamento`: mostra contexto financeiro, não mostra prazo e aponta para a Tarefa.

### Card de Solicitação de pagamento

O card é estático; apenas os controles internos clicam. Conteúdo:

- Primeira linha: pill de origem, número legível, Status e valor em reais.
- Título da Tarefa/descrição curta.
- Grade compacta: `Centro de Custo`, `Fornecedor`, `Solicitante`, `Vencimento` quando houver.
- Linha de anexos: quantidade + `Ver anexos`; nunca carregar thumbnails de documento financeiro na fila.
- Meta: `Encaminhada para <aprovador>` e instante relativo/absoluto; sem contagem regressiva.
- Ações autorizadas: `Aprovar solicitação`, `Rejeitar solicitação`, `Abrir tarefa`.
- Ações não autorizadas ficam indisponíveis com explicação: `Somente <nome> ou um Administrador pode decidir esta Solicitação.`

Não exibir CPF/CNPJ completo, chave Pix, código de barras ou comentário RESUMO no card. Esses dados ficam na Tarefa autorizada.

### Decididas

Linhas atenuadas mostram decisão, quem decidiu, data/hora e fonte `por clique` ou `por comentário`. Link `Abrir tarefa` permanece. A lista pode ser paginada quando necessário; não renderizar indefinidamente o histórico importado.

---

## Card de aprovação na Tarefa

Inserir um `Painel` de `Aprovação` na coluna principal, logo depois do bloco de Status e antes da timeline. É o segundo ponto oficial de decisão e chama exatamente a mesma operação da fila.

### Pendente

- Heading `Aprovação pendente` + pill aviso.
- `Aguardando decisão de <nome>.`
- Explicação de roteamento visível: `Centro de Custo: <x> · Valor: <R$ y>`; não expor a expressão de regra interna.
- Link/âncora `Ver tópico de aprovação` leva ao comentário de roteamento na timeline.
- Se autorizado, mostrar os dois CTAs. Se não, mostrar apenas o estado e `Abrir na fila de aprovações` quando útil.
- Não mostrar prazo ou expiração.

### Decidida

- Heading `Aprovação concluída`.
- Pill `Aprovada` em sucesso ou `Rejeitada` em neutro/Status da Lista.
- `Decidida por <nome> em <data e hora> · por clique/comentário`.
- Motivo aparece quando existir.
- Não renderizar CTAs novamente.

### Fluxo manual

Ação secundária restrita ao Financeiro, no menu de ações da Tarefa: `Usar fluxo manual`.

- Abre diálogo com a consequência explicada.
- Exige `Motivo do fluxo manual` em `TextArea`.
- Confirma com `Confirmar fluxo manual`.
- Depois do sucesso, o card mostra `Fluxo manual por <nome>` e o motivo; a timeline recebe Registro de Atividade.
- Não apresentar essa ação como checkbox ou atalho no formulário público.

---

## Decisão por clique

### Aprovar

Abre `ConfirmDialog` não destrutivo:

- Título: `Aprovar solicitação <número>?`
- Resumo imutável: fornecedor, valor, Centro de Custo e quantidade de anexos.
- Descrição: `A decisão será registrada na timeline e o processamento continuará.`
- CTAs: `Voltar` e `Aprovar solicitação`.

### Rejeitar

Abre `ConfirmDialog` destrutivo:

- Título: `Rejeitar solicitação <número>?`
- Descrição conforme o Copywriting Contract.
- Campo `Motivo da rejeição`, obrigatório, com ajuda `O motivo ficará visível para o Financeiro na timeline.`
- CTAs: `Voltar` e `Rejeitar solicitação`.

### Estado de processamento

- Ao confirmar, desabilitar todos os CTAs daquele card e trocar o label por `Aprovando…` ou `Rejeitando…`.
- Manter o diálogo aberto até resposta. Não usar otimista para decisão terminal.
- Em sucesso, fechar, mover o card para `Decididas`, anunciar via toast e focar a linha atualizada.
- Em replay da mesma decisão, tratar como sucesso e atualizar a UI.
- Em conflito com decisão oposta: `Esta Solicitação já foi decidida por <nome>. A tela foi atualizada.`; recarregar os dados, sem oferecer sobrescrita.
- Em falha transitória, preservar motivo digitado e oferecer `Tentar novamente`.

---

## Timeline da Solicitação

Comentários e Registros de Atividade deixam de ser painéis separados nesta Tarefa e viram um único painel `Timeline`, ordenado cronologicamente do mais antigo para o mais recente.

### Entrada de comentário

- `ActorAvatar`, nome, tipo de Ator quando não humano, timestamp e conteúdo Markdown.
- Resposta mostra conector/recuo e `Em resposta a <autor>`; a âncora do comentário pai continua navegável.
- Menções têm texto, não apenas cor.
- O comentário de roteamento recebe pill `Pedido de aprovação`.
- A resposta canônica recebe `✅ Aprovado por <nome>` ou `❌ Reprovado por <nome>` sem alteração de copy.
- O RESUMO usa o renderer `rico`; preservar quebra de linha e Markdown, sem HTML arbitrário.

### Entrada de atividade

- Mais compacta que comentário: ponto/ícone semântico, ator, ação, antes/depois e timestamp.
- `sistema/Formulário` aparece como Ator próprio; nunca como dono do Formulário.
- Decisão inclui fonte `por clique`/`por comentário` e motivo quando houver.
- Fluxo manual inclui quem, quando e motivo.
- Eventos de integração exibem somente estado sanitizado; nada de payload, credencial, CPF/CNPJ ou signed URL.

### Compositor

- Fica ao fim da timeline, com texto, menções e `Comentar`.
- `Ctrl/Cmd+Enter` envia; Enter comum cria nova linha.
- Durante envio, preservar o texto até confirmação do servidor.
- Erro fica junto ao compositor e não apaga o rascunho.

### Paginação

- Carregar a página mais recente ao abrir e oferecer `Carregar atividades anteriores` no topo.
- Ao carregar anteriores, preservar a posição visual; não saltar para o topo.
- Contagem do cabeçalho soma Comentários visíveis e Atividades, mas o rótulo continua `Timeline`.

---

## Estados de carregamento, vazio e erro

| Superfície | Carregamento | Vazio | Erro |
|------------|--------------|-------|------|
| Formulário público | Skeleton de título, introdução, 6 linhas de campo e CTA; nunca tela em branco | Não se aplica | Painel `Formulário indisponível` para segredo inválido/inativo; erro de rede com `Tentar novamente` |
| Upload | Linha real com progresso | `Nenhum arquivo adicionado.` só quando a pergunta estiver em foco/expandida; ajuda já basta no estado inicial | Erro por arquivo; outros continuam |
| Envio público | CTA busy + formulário bloqueado contra duplo envio | Não se aplica | Resumo no topo, respostas preservadas, retry com mesma chave |
| Aprovações | 3 skeleton cards com a forma final | Copy definida por seção | Toast + `Tentar novamente`; cards já carregados permanecem |
| Card da Tarefa | Skeleton do painel de aprovação | `Esta Tarefa não possui uma aprovação de processo.` apenas para perfis administrativos; para demais, omitir o painel | Erro inline, sem remover Status/contexto existente |
| Timeline | Skeleton de 4 entradas de alturas variadas | `Nenhum comentário ou atividade nesta Solicitação.` | Painel preservado + `Não foi possível carregar a timeline.` + retry |
| Download | Spinner apenas na linha escolhida | `Nenhum anexo.` | Erro na mesma linha + retry |

Skeleton deve imitar a geometria final e ter `aria-hidden`. A região que está carregando recebe texto sr-only/`role="status"` quando a espera for causada por ação do usuário.

Mensagens públicas não distinguem “segredo inexistente” de “Formulário pausado” quando isso facilitar enumeração. A copy única é a definida em `Unavailable form body`.

---

## Responsividade

### Até 767px

- Padding de página 16px; formulário e painéis em uma coluna.
- Todos os alvos interativos têm no mínimo 44×44px via `alvo-toque`/`--controle-h-lg`.
- CTAs finais ocupam largura inteira e ficam em ordem: ação segura/voltar, depois ação principal ou destrutiva.
- Cards da fila empilham valor, metadados e ações; nenhuma tabela horizontal.
- Diálogo usa largura disponível, margem 16px, corpo rolável e rodapé visível.
- Nome de arquivo quebra/trunca sem empurrar progresso ou remover para fora da tela.

### 768–1279px

- Formulário continua centralizado; pares curtos podem usar duas colunas.
- Fila permanece uma coluna para leitura e decisão segura.
- Página da Tarefa fica em uma coluna; lateral de atributos vem após conteúdo principal.

### 1280px ou mais

- Página da Tarefa usa a grade existente `minmax(0,1fr) / 22rem`.
- Formulário não cresce além de 48rem; largura extra vira respiro, não linhas mais longas.
- Timeline permanece na coluna principal.

### Telas amplas

Os degraus existentes em 1440/1760/2200px aumentam tipografia e controles. Não adicionar breakpoint específico da fase nem sobrescrever os tokens responsivos.

---

## Acessibilidade

- Um único `h1` por tela; seções do formulário usam `fieldset` + `legend` ou heading semanticamente equivalente.
- Todo controle tem label persistente. Placeholder nunca substitui label.
- Campos condicionais entram após o controle que os revela e recebem foco apenas quando a escolha foi explícita e o próximo passo é inequívoco.
- Erros usam texto + `aria-invalid` + `aria-describedby`; resumo de erros tem `role="alert"` e links/foco para os campos.
- Estados de upload e envio usam `aria-live="polite"`; falha bloqueante usa `role="alert"`.
- `ConfirmDialog` mantém foco preso, fecha por Esc quando seguro e devolve foco ao gatilho.
- Ações de aprovar/rejeitar nunca dependem apenas de ícone ou cor.
- Pills de Status sempre têm rótulo textual; progresso sempre tem percentual/texto.
- Timeline é `ol`; timestamps usam `time dateTime`; ordem DOM é cronológica.
- Drag-and-drop não é requisito para operar upload por teclado ou leitor de tela.
- Foco visível herda o anel de 2px `--linha-acento-forte`; não remover outline sem substituto.
- Respeitar `prefers-reduced-motion`; nenhuma animação essencial à compreensão.
- Conteúdo e controles devem manter contraste AA no tema escuro. Usar apenas tokens auditados.
- Formatação por locale: `pt-BR`, moeda `BRL`, datas com dia/mês/ano e horário de Brasília quando exibido.

---

## Convenções Next.js e fronteira cliente/servidor

Validado contra os guias locais do Next 16.3.4:

- `params` é `Promise`. Server Component usa `await params`; Client Component usa `use(params)`.
- A página/layout público pode permanecer Server Component e entregar somente o DTO sanitizado. Isolar estado, input, upload e submit num Client Component pequeno.
- Não passar entidade completa, segredo interno, configuração da Lista ou credencial ao Client Component.
- Browser fala com o Fastify conforme a arquitetura decidida. Não criar Route Handler/BFF do Next para esse fluxo.
- Service role e tokens de Storage nunca usam prefixo público nem entram no bundle.
- Componentes Server assíncronos são cobertos por E2E; Vitest cobre componentes síncronos/clientes e seletores. A jornada completa do formulário e da aprovação deve usar Playwright contra build de produção.
- A interface pode repetir com a mesma chave de submissão/idempotência; não gerar uma nova chave em cada clique de retry.

---

## Fora do escopo visual

- Acompanhamento público da Solicitação.
- Tela genérica de outbox, fila do adapter ou replay operacional; falha permanente pode usar superfícies administrativas existentes em plano posterior da mesma fase, sem entrar no fluxo público.
- Criação/visualização da Conta a pagar resultante.
- Lembretes, escalonamento, prazo ou expiração da aprovação financeira.
- Dashboard de paridade Omie e telas portadas do `financeiro-tria`.
- Redesign completo da página de Tarefa, da navegação ou do editor de Formulários.

---

## Critérios visuais e de interação

- [ ] O formulário público funciona sem login e nunca renderiza branco durante hidratação/carregamento.
- [ ] A ordem dos campos e as condições CPF/CNPJ e forma de pagamento seguem este contrato.
- [ ] Upload mostra progresso e erro por arquivo, preserva respostas e bloqueia envio final enquanto incompleto.
- [ ] A confirmação mostra somente sucesso de persistência + número legível, sem acompanhamento público.
- [ ] Aprovação de processo é distinguível da de Agente e não mostra deadline.
- [ ] Fila e card da Tarefa chamam a mesma decisão e apresentam o mesmo estado após replay/conflito.
- [ ] Rejeição exige motivo e confirmação; fluxo manual exige motivo e permissão do Financeiro.
- [ ] Timeline única intercala Comentários e Atividades com autoria correta, inclusive `sistema/Formulário`.
- [ ] Todos os vazios, erros, retries e carregamentos definidos acima estão implementados.
- [ ] Mobile preserva 44px, ordem de leitura, foco e operação sem drag.
- [ ] Nenhum hex, espaçamento, botão, modal ou card novo nasce fora do sistema existente.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
