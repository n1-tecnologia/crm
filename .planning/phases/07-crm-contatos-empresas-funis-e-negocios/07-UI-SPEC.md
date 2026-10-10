---
phase: "7"
slug: crm-contatos-empresas-funis-e-negocios
status: approved
reviewed_at: "2026-10-10"
shadcn_initialized: false
preset: none
created: "2026-10-09"
---

# Phase 7 — UI Design Contract

> Contrato visual e de interação para a Phase 7 (CRM: Contatos, Empresas, Funis e Negócios). Gerado por `gsd-ui-researcher` em modo `--auto` (sem perguntas ao usuário), verificado por `gsd-ui-checker`.
>
> Convenção de procedência: cada decisão inferida (não ditada por 07-CONTEXT.md) leva a marca `[auto] derivado de <fonte>`. O que vem direto de uma decisão travada leva `(D-NN)`.

---

## Nota de escopo — leia antes do resto

Esta fase **não cria um sistema de design nem um componente de `design/`**. Ela religa telas que já existem (`apps/web/src/app/(shell)/crm/{contatos,empresas,funis,negocios}` e `features/crm/*`) à api REST e acrescenta o que falta (editar, arquivar, lixeira, restaurar, formulários, ficha enxuta). Tudo é composição dos primitivos de `@/features/shell/ui`.

Vocabulário usado neste documento:

| Termo | Significa |
|---|---|
| **Ficha** | A tela de detalhe de um registro: página `[id]` para Contato, Funil e Negócio; para Empresa, página `[empresa]` **e** o popup `?empresa=<id>` (mesmo conteúdo, `modo="popup"`). |
| **Recusa** | Resposta 4xx da api (`ErroDeApi`): `message` é a frase em pt-BR já escrita pelo domínio/api e **a tela a mostra literal, nunca reescrita** (mesma doutrina de 05-UI-SPEC). |
| **Bloqueios** | `ErroDeApi.bloqueios` num 409: `{ empresas, filiais, negocios: { total, itens }, contatos }`, cada item com `id` e `nome`. |
| **Legado** | Telas do modelo antigo em inglês, mantidas intactas para ids que a nova api não conhece (D-15). |

**Fora do escopo visual (D-02, D-15):** Tags, Consentimentos, Comentários, Anexos, Conversas, mesclagem, temperatura, histórico de Etapas, Requisitos e Transições de Etapa, Atividade, Caixa de Entrada, Meus Negócios, Busca global, Lixeira global (`/configuracoes/lixeira`), Notificações. Nenhum desses aparece nas telas novas — nem desabilitado, nem como "em breve". Lista de textos proibidos nas fichas novas: `Tags`, `Consentimentos`, `Comentários`, `Anexos`, `Conversas`, `Mesclar`, `Sugestões`, `Temperatura`, `Requisitos`, `Transições`.

---

## Design System

`[auto] derivado de 05-UI-SPEC.md, 04-UI-SPEC.md e 02-UI-SPEC.md` (herdado verbatim; 07-CONTEXT.md não sobrepõe nada) e do gate do orquestrador (`apps/web/components.json` não existe; resposta ao gate shadcn: "N").

| Property | Value |
|----------|-------|
| Tool | none — sistema de design próprio, fixo neste monorepo (não shadcn) |
| Preset | não aplicável |
| Component library | `apps/web/src/design/` (`components.tsx`, `basicos.tsx`, `tela.tsx`, `esqueletos.tsx`, `icone.tsx`, `segmentos.tsx`), consumido pelo barril `@/features/shell/ui`; peças de quadro/lista em `@/features/shell/quadro` e `@/features/shell/record-list` |
| Icon library | `lucide-react`, envolvido por `Icone` (traço fixo 1.5, quatro tamanhos `xs/sm/md/lg`) |
| Font | SF Pro Display (marca N1); Inter via `next/font` como reserva fora de aparelhos Apple |

Regra de importação (do barril, `ui.tsx` linhas 3-8): as telas importam **só** de `@/features/shell/ui`. Um componente de `features/crm/` que precise alcançar `design/` diretamente é sinal de que falta export no barril, não licença para importar de lá.

---

## Component Inventory

Enumerated by `bash -c "grep -hE '^export (function|const) [A-Z]' apps/web/src/design/{components,basicos,tela,esqueletos,icone,segmentos}.tsx | wc -l"` — 43 exports de valor (componentes e constantes) em `design/`, mais 5 do barril (`PageHeader`, `Section`, `Card`, `CategoryDot`, `SetaDeOrdem`; `bash -c "grep -hE '^export (function|const) [A-Z]' apps/web/src/features/shell/{ui,quadro,record-list}.tsx | wc -l"` → 10 contando `ColunaDeQuadro`, `VazioDaColuna`, `RostoDeIcone`, `CartaoDeQuadro`, `RecordList`) — @n1/web@0.1.0 (resolvido por `node -p "require('./package.json').name+'@'+require('./package.json').version"` em `apps/web`; pacote interno do monorepo, sem versão publicada) — 2026-10-09.

A tabela é uma lista **não exaustiva** de componentes conhecidos; o executor pode usar qualquer export do barril. Os valores abaixo foram lidos nos arquivos (props conferidas), não recordados.

| Componente | Import | Papel nesta fase |
|---|---|---|
| `PageHeader` | `@/features/shell/ui` | Barra de 44px de toda lista e ficha: `title`, `seal` (StateSeal), `meta` (contagem curta), `actions` (CTA), `details` |
| `CorpoDeTela` | `@/features/shell/ui` | O único bloco que rola; `semRespiro` nas listas |
| `Section` | `@/features/shell/ui` | Régua de seção das fichas (Dados, Identificadores, Endereços, Campos adicionais, Empresas, Contatos, Negócios) com `count` e `action` |
| `RecordList` (+ `Column`) | `@/features/shell/record-list` | Todas as listas (Contatos, Empresas, Funis); `emptyTitle`/`emptyHint`/`emptyAction` |
| `Abas` | `@/features/shell/ui` | Abas de estado Ativos / Arquivados / Lixeira (estado na URL `?estado=`) |
| `Segmentos` | `@/features/shell/ui` | Alternância binária em formulário: Empresa/Contato (dono do Negócio), Contato existente/Novo Contato (admin da Empresa) |
| `ConfirmDialog` | `@/features/shell/ui` | **Único** mecanismo de confirmação e de formulário modal (`wide` para formulários, `confirmDisabledReason`, `destructive`, `footerStart`) |
| `SidePanel` | `@/features/shell/ui` | Popup da Empresa (`?empresa=<id>`) com `footer` "Abrir página cheia" |
| `Field`, `TextInput`, `TextArea`, `Select`, `MultiSelect`, `Toggle` | `@/features/shell/ui` | Campos de formulário e ficha; `Field` carrega o erro de campo |
| `Button` | `@/features/shell/ui` | Variantes `primary` / `secondary` / `danger` / `ghost`; `disabledReason` obrigatório sempre que `disabled` pode ser verdadeiro (§11) |
| `ActionMenu` | `@/features/shell/ui` | Ações do cartão de Negócio |
| `StateSeal` | `@/features/shell/ui` | Estado do registro; `ativo` não renderiza nada; `naLixeira` → rótulo "na lixeira"; `arquivado` → "arquivado" |
| `Pilula`, `ConditionMarker` | `@/features/shell/ui` | Situação do Negócio, Funil padrão, Privado, principal, admin |
| `Toast` | `@/features/shell/ui` | Sucesso (expira) e erro (não expira, `role="alert"`) |
| `EmptyState`, `EsqueletoDeLinhas`, `Esqueleto` | `@/features/shell/ui` | Vazio, carregando, erro de carga |
| `RecordPanel`, `RecordRow` | `@/features/shell/ui` | Painéis de leitura das fichas |
| `SetaDeOrdem` | `@/features/shell/ui` | Subir/descer Etapa; desligada diz por quê |
| `Icone` | `@/features/shell/ui` | Ícones, sempre pelo envoltório |
| `ColunaDeQuadro`, `VazioDaColuna`, `CartaoDeQuadro` | `@/features/shell/quadro` | Quadro de Negócios por Etapa; `onDrop` nativo |
| `useFormat` | `@/features/shell/use-format` | `money`, datas |
| `useCreateRecordDialog(familia)` | `@/features/crm/create-record-dialog` | Mantido: abre os diálogos de criação por `?criar=<família>` |
| `RemoveStageDialog`, `MigrateFunnelDialog` | `@/features/crm/*` | Mantidos no lugar, religados (07-07); parâmetros de URL `?remapear-etapa=` e `?migrar-negocios=` preservados |
| `DealCard`, `DealScreen`, `quadro-negocios.tsx`, `empresa-popup.tsx`, `contact-card.tsx` | `@/features/crm`, `@/features/estrutura` | **Não editados.** `DealCard` é só referência visual; `DealScreen` e as fichas legadas são recuo (D-15) |

**Peças novas desta fase** (composições em `features/crm/`, nenhuma entra em `design/`; contrato de cada uma nas seções abaixo): `AbasDeEstado`, `AcoesDeCicloDeVida`, `MensagemDeRecusa`, `SeletorDeProprietario`, `SeletorDeRegistro`, `EditorDeEnderecos`, `EditorDeCamposAdicionais`, `FormularioDeContato`/`DialogoNovoContato`, `FichaDeContato`, `DialogoNovoFunil`, `FichaDeFunil`, `EtapasDoFunil`, `DialogoNovaEmpresa`, `FichaDeEmpresa`, `VinculosDaEmpresa`, `CartaoDeNegocio`, `QuadroDoFunil`, `DialogoDeEncerramento`, `DialogoNovoNegocio`, `FichaDeNegocio`, `NegociosDoRegistro`.

---

## Spacing Scale

`[auto] derivado de 05-UI-SPEC.md` (tokens `--e-*` de `apps/web/src/estilos/tokens.css`; base de 4px; nada literal fora de token).

| Token | Value | Usage nesta fase |
|-------|-------|-------------------|
| xs | 4px (`--e-1`) | Vão entre ícone e texto; entre `Pilula` e nome no cabeçalho de ficha |
| sm | 8px (`--e-2`, `gap-2`) | Entre controles compactos: botões da barra de filtros, `AcoesDeCicloDeVida`, `Abas` + busca, ações do cartão |
| md | 12–16px (`--e-3`/`--e-4`, `gap-3`, `px-4`) | Campo a campo em formulário (`grid gap-3`); padding de `RecordPanel`, cartão de Negócio e linha de Etapa; `gap-3` entre cartões na coluna do quadro (`pilha-solta`, herdado) |
| lg | 20–24px (`--e-5`/`--e-6`, `px-6 py-5`) | Cabeçalho/rodapé de `ConfirmDialog` e `SidePanel`; padding de `CorpoDeTela` nas fichas |
| xl | 32px (`--e-8`) | Entre blocos independentes da ficha de Funil (painel de Etapas × painel de Regras) |
| 2xl | 48px (`--e-12`) | Não usado nesta fase |
| 3xl | 64px (`--e-16`) | Não usado nesta fase |

Alvo de toque mínimo: `--controle-h-lg` (44px no padrão do sistema) em todo botão, aba e item de menu — já padrão (`alvo-toque` no `Button`); o `×`/ícone-botão de cartão do quadro também.

Exceptions:
- Largura da coluna do quadro: `19.2rem`, fixa em `ColunaDeQuadro` (componente existente; não redeclarar nem sobrescrever). O quadro rola na horizontal.
- Larguras de diálogo vêm de `--modal-sm` (24rem), `--modal-lg` (48rem), `--modal-xl` (64rem) via props `wide`/`extraLargo` de `ConfirmDialog`. Nenhuma largura literal nova.

---

## Typography

`[auto] derivado de 05-UI-SPEC.md`. Duas escalas do sistema (`apps/web/src/estilos/tipografia.css`): EDITORIAL (`.ed-*`, o que se lê) e APLICAÇÃO (`.app-*`, o que se varre). `npm run verificar:tokens` reprova `text-[Npx]` e `fontSize: "N"` em TSX: todo tamanho é uma destas classes.

| Role | Size (classe) | Weight | Line Height |
|------|------|--------|-------------|
| Body | `.app-base` — 13px piso (14/15/16 nos três degraus de tela) | 400 regular | `var(--app-base-lh)`, ≈1.54× |
| Label | `.rotulo` (usa `--app-sm`, 12px piso) | 400 regular no uso novo; a classe fixa o próprio peso (herdado do sistema, não replicar em estilo novo) | 1rem piso, ≈1.33× |
| Heading | `.ed-subtitulo` — 18px piso (20/22/24 nos degraus) | 600 semibold | `var(--ed-subtitulo-lh)`, ≈1.56× — título de `ConfirmDialog` e de `SidePanel` |
| Display | não usado — nenhuma tela nova de nível de página; o título de tela é o do `PageHeader` (componente existente) | — | — |

Tamanho auxiliar herdado e reaproveitado: `.app-meta` (11px, `--texto-4`) para metadado — subtítulo de coluna do quadro, vigência de vínculo, "Proprietário: …", data prevista. `.app-numero` (`tabular-nums`) em **todo** valor monetário, probabilidade, contagem e total.

**Pesos declarados nesta fase: exatamente dois — 400 (regular) e 600 (semibold).** 600 vai em: título de cartão de Negócio, valor do Negócio, nome de Etapa, contagem da coluna (já no componente). O resto é 400. Nenhum `fontWeight` arbitrário novo.

Tamanhos internos dos componentes do sistema (`PageHeader`, `EmptyState`, `Toast`, `Pilula`) são deles e não são redeclarados aqui.

---

## Color

`[auto] derivado de 05-UI-SPEC.md`. Estrutura de `estilos/tokens.css`: preto quase puro segurando a página, lavagens de branco em alfa como superfície, roxo escasso como acento. **Nenhum hex novo** — todo valor abaixo é `var(--token)`.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--page` `#0f0f10` / `--card` `#161617` | Fundo de tela; corpo opaco de `ConfirmDialog` e `SidePanel` |
| Secondary (30%) | `--superficie-1/2/3` (branco 3–5% alfa) + `--cinza-600` `#2a2a2a` | `RecordPanel`, campos de formulário, linha de lista, trilho (fundo) de cada coluna do quadro, `CartaoDeNegocio`, linha de Etapa |
| Accent (10%) | `--acento` (roxo `#c084fc`) | Reservado — ver lista abaixo |
| Destructive | `--erro` (`#fca5a5`) / família `--cor-perigo-*` | Botão `danger` das confirmações de exclusão; `Toast tone="error"`; erro de `Field`; nada além disso |

**Accent reserved for** (lista fechada):
1. O botão primário (`btn-solido`) — **um por tela ou diálogo**: "Novo Contato", "Nova Empresa", "Novo Funil", "Novo Negócio" na `PageHeader`; "Criar …"/"Salvar alterações"/"Marcar como ganho"/"Marcar como perdido"/"Reabrir Negócio"/"Migrar Negócios"/"Remapear e remover" no rodapé do diálogo correspondente.
2. O sublinhado da aba ativa em `Abas`.
3. O selo de contagem de `ColunaDeQuadro` (`--acento-lavado` + `--acento`; já embutido no componente).
4. O ícone da opção marcada dentro de `Select`/`MultiSelect`, e o anel de foco do sistema.

Nada além disso. Em particular: situação do Negócio **nunca** usa o roxo; links de `MensagemDeRecusa` e de vínculos usam `--texto` com sublinhado, nunca `--acento`; "Funil padrão" usa `Pilula tom="info"`.

**Cores semânticas de dado (tokens já existentes):**

| Significado | Token | Onde |
|---|---|---|
| Negócio aberto | `--cor-neg-aberto` `#7dd3fc` | `Pilula cor` "Aberto" |
| Negócio ganho | `--cor-neg-ganho` `#4ade80` | `Pilula cor` "Ganho" |
| Negócio perdido | `--cor-neg-perdido` `#a8a29e` | `Pilula cor` "Perdido" |
| Estado `arquivado` / `na_lixeira` | `--cor-selo-arquivado`, `--cor-selo-lixeira` (via `StateSeal`) | Selo no cabeçalho da ficha e na coluna Estado das listas |
| Aviso (ex.: Funil sem Etapa inicial) | `--aviso` | `ConditionMarker tone="warning"` |

Cor nunca carrega sozinha o significado: toda `Pilula` de situação e todo selo de estado trazem o **texto** junto (Aberto/Ganho/Perdido; arquivado; na lixeira). `[auto] derivado de` regra "A category always carries a label besides the colour" de `ui.tsx`.

A cor de uma Etapa/Funil (`cor`, campo opcional da 007) é **dado do usuário**: passa a `Pilula cor` / `ColunaDeQuadro cor` como token ou valor que veio do registro, nunca como hex escrito no TSX.

---

## Copywriting Contract

Idioma: português do Brasil, "você" implícito, sem gíria. Substantivos de domínio com inicial maiúscula como no produto: Contato, Empresa, Funil, Etapa, Negócio, Proprietário, Identificador, Lixeira, Espaço de Trabalho. `[auto] derivado de` 07-CONTEXT.md e das frases já escritas em `packages/dominio/src/crm/*`.

### Rótulos primários (CTA)

| Superfície | Botão da `PageHeader` | Botão de confirmação do diálogo | Título do diálogo |
|---|---|---|---|
| Contatos | **Novo Contato** | **Criar Contato** | Novo Contato |
| Empresas | **Nova Empresa** | **Criar Empresa** | Nova Empresa |
| Funis | **Novo Funil** | **Criar Funil** | Novo Funil |
| Negócios | **Novo Negócio** | **Criar Negócio** | Novo Negócio |
| Ficha (edição) | — | **Salvar alterações** | — |

> Delta em relação a 07-01: o diálogo de Novo Contato hoje usa `confirmLabel="Criar"`. Passa a "Criar Contato" (verbo + substantivo). Rótulos genéricos "Criar", "Salvar", "OK", "Enviar" não são aceitos como CTA nesta fase.

Descrições de diálogo de criação (linha sob o título, `description` obrigatória do `ConfirmDialog`):

| Diálogo | Descrição |
|---|---|
| Novo Contato | "Nome ou Identificador — um dos dois basta, e sem nenhum dos dois o Contato não é ninguém." (já existe, mantida) |
| Nova Empresa | "A Empresa nasce com um Contato admin: escolha um existente ou crie um novo aqui mesmo." (D-08) |
| Novo Funil | "Um Funil precisa de ao menos uma Etapa. O primeiro Funil do Espaço de Trabalho vira o Funil padrão." (RN-FUN-04, D-13) |
| Novo Negócio | "Todo Negócio é de uma Empresa ou de um Contato, e fica numa Etapa do Funil." |

### Estados vazios

Formato do `EmptyState`: `title` diz o que é; `hint` diz o próximo passo.

| Lugar | Heading (`title`) | Body (`hint`) |
|---|---|---|
| Contatos · aba Ativos | "Nenhum Contato ainda." | "Crie o primeiro com “Novo Contato”." |
| Contatos · aba Arquivados | "Nenhum Contato arquivado." | "Contatos arquivados saem das listas de trabalho, mas continuam consultáveis aqui." |
| Contatos · aba Lixeira | "Nenhum Contato na Lixeira." | "Contatos excluídos ficam aqui até serem restaurados ou excluídos permanentemente." |
| Contatos · busca sem resultado | "Nenhum Contato encontrado." | "Nada corresponde a “{busca}”. Confira a grafia ou limpe a busca." |
| Empresas (Ativos / Arquivadas / Lixeira) | "Nenhuma Empresa ainda." / "Nenhuma Empresa arquivada." / "Nenhuma Empresa na Lixeira." | "Crie a primeira com “Nova Empresa”: ela nasce com um Contato admin." / "Empresas arquivadas saem das listas de trabalho, mas continuam consultáveis aqui." / "Restaurar uma Empresa da Lixeira pede um Contato admin." |
| Funis (Ativos / Arquivados / Lixeira) | "Nenhum Funil ainda." / "Nenhum Funil arquivado." / "Nenhum Funil na Lixeira." | "Crie o primeiro com “Novo Funil”. Sem Funil, não há onde colocar Negócios." / "Funis arquivados não recebem Negócios novos." / "Funis excluídos ficam aqui até serem restaurados ou excluídos permanentemente." |
| Quadro · sem Funil ativo | "Nenhum Funil ativo." | "Crie um Funil para começar a acompanhar Negócios." + ação "Ir para Funis" → `/crm/funis` |
| Quadro · coluna vazia (`VazioDaColuna`) | "Nenhum Negócio nesta Etapa." | — |
| Quadro · faixa de encerrados vazia | "Nenhum Negócio encerrado neste Funil." | — |
| Ficha de Contato · Empresas | "Este Contato não está vinculado a nenhuma Empresa." | "O vínculo é feito na ficha da Empresa." |
| Ficha de Contato · Identificadores | "Nenhum Identificador." | "Adicione um e-mail, telefone, WhatsApp ou Instagram." |
| Ficha de Empresa · Contatos | (nunca vazia: a Empresa sempre tem admin vigente — D-08) | — |
| `NegociosDoRegistro` (Contato) | "Nenhum Negócio deste Contato." | "Use “Novo Negócio” para abrir um." |
| `NegociosDoRegistro` (Empresa) | "Nenhum Negócio desta Empresa." | "Use “Novo Negócio” para abrir um." |
| `SeletorDeRegistro` sem resultado | "Nenhum resultado para “{busca}”." | — |
| Ficha 404 | "Contato não encontrado." / "Empresa não encontrada." / "Funil não encontrado." / "Negócio não encontrado." | "Ele pode ter sido excluído permanentemente." — na ficha de **Funil**: "Pode ter sido excluído permanentemente, ou ser um Funil do cadastro anterior, que ainda não aparece aqui." (D-15) |

> Delta em relação a 07-01: o `emptyHint` atual da lista de Contatos ("…criados automaticamente quando uma Mensagem chega por um Canal") descreve o modelo antigo e fica falso para a nova api; vira "Crie o primeiro com “Novo Contato”."

### Estados de erro

| Situação | Superfície | Copy |
|---|---|---|
| Falha ao carregar lista | `EmptyState` no lugar da lista | title "Não foi possível carregar {os Contatos / as Empresas / os Funis / os Negócios}." · hint = `ErroDeApi.message` ou, sem ele, "Tente de novo em instantes." |
| Falha ao carregar ficha | `EmptyState` | title "Não foi possível abrir {o Contato / a Empresa / o Funil / o Negócio}." · hint = `ErroDeApi.message` |
| Sem sessão (401) | `Toast tone="error"` | "Sua sessão expirou. Entre de novo." (literal de `chamarCrm`) |
| Sem rede | `Toast tone="error"` | "Sem conexão com o servidor." (literal de `chamarCrm`) |
| Falha genérica ao gravar | `Toast tone="error"` | `ErroDeApi.message`; sem ela: "Não foi possível {criar o Contato / salvar as alterações / …}. Tente de novo." |
| Papel não permite (403) | `Toast tone="error"` | `ErroDeApi.message` literal (frase de `podeNoCrm`). A tela já escondeu/desabilitou o botão; este é o caso forçado |
| Validação de campo (domínio, antes do envio) | `Field error` abaixo do campo | A frase de `validarContato`/`validarNovoFunil`/etc., literal. Ex.: "Um Contato precisa de Nome ou de ao menos um Identificador (e-mail, telefone, WhatsApp ou Instagram)." |
| Recusa 409 | `Toast tone="error"` + bloqueios (ver abaixo) | `ErroDeApi.message` literal + listas de links. **O diálogo ou a ficha continua como estava**, com os campos preenchidos |

Regra do erro: o `Toast` de erro **não expira** (WCAG 2.2.1, comportamento do componente) e é dispensado pela pessoa. Fica no topo do `CorpoDeTela` (padrão de 07-01) ou, dentro de diálogo, logo abaixo do cabeçalho do diálogo. Nunca `window.alert`/`confirm`.

### Recusas 409 — o contrato de `MensagemDeRecusa`

`MensagemDeRecusa` renderiza `erro.message` e, quando houver `bloqueios`, listas de links com estes rótulos fixos (sempre com o nome do registro como texto do link, montado só pelo `id` — rota fixa `/crm/<recurso>/<id>`):

| Chave de `bloqueios` | Rótulo da lista | Destino do link |
|---|---|---|
| `empresas` | "Empresas afetadas" | `/crm/empresas/:id` |
| `filiais` | "Filiais" | `/crm/empresas/:id` |
| `negocios.itens` | "Negócios afetados" (+ "e outros N" quando `total` > itens) | `/crm/negocios/:id` |
| `contatos` | "Contato que já usa este Identificador" | `/crm/contatos/:id` |

Reação por código (a tela decide a ação; a frase é da api):

| Código | Onde | Reação da tela |
|---|---|---|
| `CONTATO_BLOQUEADO` (D-09) | Excluir Contato | Mensagem + links de Empresas (último admin) e Negócios. O Contato **continua `ativo`** na tela, sem selo "na lixeira" |
| `CONTATO_COM_NEGOCIOS` | Excluir permanentemente Contato | Mensagem + links de Negócios |
| `CONTATO_INATIVO` | Editar Contato arquivado/na lixeira | Edição já está escondida; se forçado, Toast |
| `IDENTIFICADOR_EM_USO` | Criar/editar Contato ou Empresa | Mensagem nomeando o detentor + link; formulário continua aberto |
| `EMPRESA_SEM_ADMIN` | Restaurar Empresa da Lixeira | Abre o pedido de Contato admin (pré-preenchido com o último admin encerrado) |
| `ULTIMO_ADMIN` | Rebaixar/encerrar o único admin | Abre "Trocar admin" |
| `EMPRESA_BLOQUEADA` | Excluir Empresa | Mensagem + links de Negócios e Filiais |
| `EMPRESA_COM_NEGOCIOS`, `EMPRESA_COM_FILIAIS` | Excluir permanentemente Empresa | Mensagem + links |
| `VINCULO_JA_EXISTE` | Adicionar Contato à Empresa | Mensagem; campo do Contato mantido |
| `MATRIZ_INVALIDA` | Definir matriz | Erro inline no campo Matriz |
| `FUNIL_NOME_EM_USO`, `ETAPA_NOME_EM_USO` | Criar/renomear Funil ou Etapa | Erro inline no campo Nome |
| `FUNIL_PADRAO` | Arquivar/excluir o Funil padrão | Mensagem; sugerir em `hint` do Toast "Defina outro Funil como padrão antes." |
| `FUNIL_COM_NEGOCIOS`, `FUNIL_COM_NEGOCIOS_ABERTOS` (D-07) | Excluir/arquivar Funil | Mensagem com a contagem + **botão "Migrar Negócios"** no Toast (`acao`) que abre `?migrar-negocios=` |
| `ETAPA_COM_NEGOCIOS` (D-07) | Remover Etapa | Mensagem + botão **"Remapear Negócios"** que abre `?remapear-etapa=` |
| `ULTIMA_ETAPA` | Remover a única Etapa | Botão já desabilitado com motivo; se forçado, Toast |
| `NEGOCIO_EXIGE_VALOR`, `NEGOCIO_EXIGE_MOTIVO` (D-05) | Diálogo de encerramento | Erro inline no campo (Valor / Motivo da perda); diálogo continua aberto |
| `NEGOCIO_ENCERRADO`, `NEGOCIO_INATIVO`, `FUNIL_INATIVO`, `ETAPA_INVALIDA` | Mover/editar Negócio | Toast; no quadro, **o cartão volta à coluna original** |
| `SEM_FUNIL_PADRAO` | Novo Negócio sem Funil escolhido | Mensagem + link "Ir para Funis" |

### Confirmações destrutivas

Todas por `ConfirmDialog` (único mecanismo do produto). `(D-06)`: "Excluir" na interface manda para a Lixeira; arquivar é ação separada e **não pede confirmação** (é reversível e não some da consulta).

| Ação (botão) | Título | Descrição (`description`) | Botão de confirmação | Variante |
|---|---|---|---|---|
| **Excluir** Contato / Empresa / Funil / Negócio (envia à Lixeira) | "Excluir {nome}?" | "{nome} vai para a Lixeira. Dá para restaurar depois, e nada que o referencia é apagado." Em **Empresa** acrescentar: "Os vínculos vigentes serão encerrados e os Contatos continuam existindo." (D-08) | "Enviar para a Lixeira" | `danger` |
| **Excluir permanentemente** (só na aba/ficha da Lixeira) | "Excluir {nome} permanentemente?" | "Isto não pode ser desfeito. {nome} e seus Identificadores, Endereços e vínculos serão apagados de vez." | "Excluir permanentemente" | `danger` |
| **Restaurar** (Contato, Funil, Negócio, Empresa arquivada) | — sem confirmação | Toast "{nome} restaurado." | — | — |
| **Restaurar Empresa da Lixeira** | "Restaurar {nome}" | "Uma Empresa precisa de ao menos um Contato admin. Indique quem volta a administrá-la." | "Restaurar Empresa" | `primary` |
| **Trocar admin** (Empresa) | "Trocar o admin de {Empresa}" | "Uma Empresa nunca fica sem Contato admin. Escolha o novo admin antes de retirar {Contato atual}." | "Trocar admin" | `primary` |
| **Remapear Etapa** (remover Etapa com Negócios — D-07) | "Remover a Etapa “{nome}”?" | "{N} Negócio(s) estão nela. Escolha para qual Etapa eles vão antes de removê-la." | "Remapear e remover" | `danger` |
| **Migrar Negócios** (Funil — D-07) | "Migrar Negócios de “{Funil}”" | "Cada Etapa de origem precisa de uma Etapa de destino. Sugerimos a de mesmo nome." | "Migrar Negócios" | `primary` |
| **Reabrir Negócio ganho** (Administrador/Proprietário) | "Reabrir “{título}”?" | "O Negócio volta a ficar aberto e perde o motivo e a nota de encerramento." | "Reabrir Negócio" | `primary` |
| **Mover Negócio** (arrastar ou menu) | — sem confirmação | feedback é o cartão mudar de coluna; erro reverte | — | — |
| **Remover Identificador / Endereço / vínculo / Etapa sem Negócios** | — sem diálogo; remoção inline com Toast "Identificador removido." | reversível re-adicionando | — | — |

Plural real nas mensagens de contagem (`[auto]` correção do "N Negócio(s)" dos planos): "1 Negócio", "3 Negócios".

### Mensagens de sucesso (`Toast tone="success"`, expiram sozinhas)

| Evento | Copy |
|---|---|
| Criado | "{nome de exibição} criado." |
| Edição salva | "Alterações salvas." |
| Arquivado / Restaurado | "{nome} arquivado." / "{nome} restaurado." |
| Enviado à Lixeira | "{nome} foi para a Lixeira." |
| Excluído permanentemente | "{nome} excluído permanentemente." |
| Funil definido como padrão | "{Funil} é o Funil padrão." |
| Negócio ganho / perdido / reaberto | "Negócio marcado como ganho." / "Negócio marcado como perdido." / "Negócio reaberto." |
| Migração / remapeamento | "{N} Negócios migrados para “{Funil}”." / "{N} Negócios remapeados para “{Etapa}” e a Etapa foi removida." |
| Admin trocado | "O admin de {Empresa} agora é {Contato}." |

Mover Negócio no quadro **não** dá Toast de sucesso (o cartão mudar de coluna já é o feedback); só o erro fala.

### Textos de apoio (permissão e regra, D-10/D-13/D-14)

| Onde | Copy |
|---|---|
| Ficha de Funil, para quem não administra (Membro, Convidado) — linha `.app-meta` sob o `PageHeader` | "Só Administrador e Proprietário alteram Funis e Etapas." |
| `Toggle` "Privado" no Funil | "Nesta fase, “privado” só é registrado; a visibilidade por Papel chega depois." (D-10) |
| Botão desabilitado por Papel | `disabledReason` = a frase de `podeNoCrm`, literal |
| Botão desabilitado por estado | `disabledReason` com a regra: ex. "Um Funil precisa de ao menos uma Etapa." / "Reabrir um Negócio ganho exige Administrador ou Proprietário." |
| `SeletorDeProprietario` valor inicial | "Eu (quem cria)" (D-11) |
| Aviso de vínculo encerrado | "Vínculos encerrados" (lista recolhida), cada um com "até {data}" |

---

## Layout and Interaction Contract

`[auto] derivado de` 07-06..07-11 (tarefas web) e dos arquivos atuais das telas.

### Esqueleto de toda tela (herdado)

```
<div className="flex h-full flex-col">
  <PageHeader … />                 barra de 44px, parada, sticky
  <CorpoDeTela [semRespiro]>…</>   o único bloco que rola
</div>
```

Um `Toast` por vez no topo do `CorpoDeTela`. Erro de carga e vazio usam `EmptyState`; carregando usa `EsqueletoDeLinhas` (6 linhas em lista, 8 em ficha). Nunca área em branco.

### 1. Listas — Contatos, Empresas, Funis (`RecordList`)

- **Cabeçalho:** `title` (Contatos / Empresas / Funis), `meta` = contagem com plural correto ("1 Contato", "42 Contatos"), `actions` = botão primário "Novo …". O botão **não é renderizado** quando `usePodeNoCrm("criar", recurso)` recusa (Convidado; em Funis, também Membro) — lista é lugar de varredura, o motivo mora na ficha.
- **Abas de estado:** `AbasDeEstado` com `Abas` — **Ativos / Arquivados / Lixeira** (Empresas: "Ativas / Arquivadas / Lixeira"), estado em `?estado=` (padrão `ativo`), contador por aba só se barato (não obrigatório).
- **Busca:** campo `q` com espera de 300 ms antes de trocar a chave; limpar volta à lista cheia. Em Funis não há busca (poucos registros).
- **Paginação:** "Mostrar mais" de 50 em 50 (`limite`/`deslocamento`). Rótulo: **"Mostrar mais"**.
- **Colunas** (`RecordList.columns`): Nome (sempre), Estado (sempre; `StateSeal` — vazio quando `ativo`), demais conforme tabela. A coluna menos importante de cada lista usa o padrão responsivo `hidden @6xl:table-cell` já usado em `contas-view.tsx` (05-UI-SPEC §3).

| Lista | Colunas (ordem) | Coluna que some em tela estreita |
|---|---|---|
| Contatos | Nome de exibição · E-mail principal · Telefone principal · Proprietário · Estado | Telefone principal |
| Empresas | Nome de exibição · Domínio · Documento · Empresa matriz · Proprietário · Estado | Empresa matriz |
| Funis | Nome (+ `Pilula tom="info"` "Funil padrão" e `Pilula` neutra "Privado") · Etapas · Negócios abertos · Estado | Negócios abertos |

- **Linha:** clicável por inteiro (`hrefOf`) → ficha; Empresas abre o **popup** `?empresa=<id>`. Controles dentro da linha (`a, button, …`) não disparam a navegação (comportamento do `RecordList`).
- **Aba Lixeira:** cada linha ganha **Restaurar** (`ghost`, `size="sm"`) e **Excluir permanentemente** (`danger`, `size="sm"`). Restaurar Empresa abre o pedido de admin. Recusas por `MensagemDeRecusa`. Aba Arquivados: **Restaurar**.
- **Proprietário:** nome do Membro (`useNomeDoMembro`); desconhecido → "—" (travessão, nunca célula vazia nem "undefined").
- Valores ausentes em coluna: "—".

### 2. Formulários de criação (todos em `ConfirmDialog wide`)

- Grade de campos: `grid gap-3` em uma coluna; formulários largos (Contato, Empresa, Negócio) em duas colunas a partir do breakpoint `sm`. `Field` com `label` sempre visível (nunca só placeholder).
- Enviar: botão primário do rodapé; enquanto grava, `confirmDisabledReason="Gravando {o Contato / a Empresa / o Funil / o Negócio}…"` (padrão de 07-01). Em erro, o diálogo **fica aberto, campos preservados**.
- Pré-validação do domínio roda antes do `fetch`; a frase aparece no `Field` do `campo` que o domínio indicar.
- Ao criar com sucesso: fecha o diálogo, `Toast` de sucesso e `router.push` para a ficha nova (Contato, Negócio); em Empresa e Funil também para a ficha.

**Novo Contato (`DialogoNovoContato`)** — campos, nesta ordem: Nome · Sobrenome · E-mail · Telefone · WhatsApp · Instagram · Data de nascimento (`input type="date"`) · Idioma · Fuso horário · Descrição (`TextArea`) · Origem · Qualificação (texto livre — catálogos são fase futura) · Proprietário (`SeletorDeRegistro`/`SeletorDeProprietario`). Cada Identificador preenchido vira um item de `identificadores`.

**Nova Empresa (`DialogoNovaEmpresa`)** — Nome fantasia · Razão social · Descrição · Domínio · Documento fiscal · Telefone · Origem · Proprietário · **Seção "Contato admin" obrigatória** (D-08): `Segmentos` "Contato existente" | "Novo Contato"; existente → `SeletorDeRegistro` de Contatos ativos + Cargo; novo → Nome + E-mail + Cargo. Sem nome fantasia nem razão social, ou sem admin escolhido, o botão fica desabilitado com `confirmDisabledReason` ("Informe o nome fantasia ou a razão social." / "Escolha ou crie o Contato admin da Empresa.").

**Novo Funil (`DialogoNovoFunil`)** — Nome · Descrição · Cor (opcional, tokens de cor das Etapas) · `Toggle` Privado (com a nota de D-10) · `Toggle` "Exigir Motivo de Perda ao marcar como perdido" · `Toggle` "Exigir valor ao marcar como ganho" · lista de Etapas (mínimo 1): nome + "Probabilidade padrão (%)" 0–100, adicionar, remover, `SetaDeOrdem` subir/descer. Primeira Etapa vem preenchida com "Novo" (ou a Etapa inicial pela regra do domínio).

**Novo Negócio (`DialogoNovoNegocio`)** — Título · Objeto · Descrição · `Segmentos` "Empresa" | "Contato" com `SeletorDeRegistro` · Funil (`Select`; padrão = Funil padrão ou o do quadro) · Etapa (`Select` das Etapas do Funil; padrão = Etapa inicial) · Valor (aceita "1.234,56") · Moeda (padrão BRL) · Probabilidade (opcional, 0–100) · Data prevista de fechamento · Origem · Proprietário. Aberto de dentro de Contato/Empresa, o dono já vem escolhido e travado.

### 3. Fichas

**Cabeçalho comum:** `PageHeader` com nome de exibição como `title`, `StateSeal` em `seal`, `meta` com "Proprietário: {nome}", `actions` = `AcoesDeCicloDeVida`.

**`AcoesDeCicloDeVida` por estado:**

| Estado | Ações visíveis |
|---|---|
| `ativo` | **Arquivar** (`secondary`), **Excluir** (`danger`) |
| `arquivado` | **Restaurar** (`secondary`), **Excluir** (`danger`) |
| `na_lixeira` | **Restaurar** (`secondary`), **Excluir permanentemente** (`danger`); campos em somente leitura, "Editar" ausente (`CONTATO_INATIVO`) |

Sem permissão, as ações ficam `disabled` com `disabledReason` (a frase do Papel) — nunca somem na ficha.

**Ficha de Contato** — `Section`s nesta ordem: **Dados** (leitura em `RecordPanel`/`RecordRow`; "Editar" abre o `FormularioDeContato` em modo edição, sem os Identificadores, só quando `ativo`) · **Identificadores** (linha: `Pilula` do tipo "E-mail"/"Telefone"/"WhatsApp"/"Instagram", valor, `Pilula` "principal", `Pilula` "verificado"; ações "Tornar principal", "Marcar como verificado", "Remover"; "Adicionar Identificador" com tipo + valor) · **Endereços** (`EditorDeEnderecos`) · **Campos adicionais** (`EditorDeCamposAdicionais`) · **Empresas** (vínculos: link `/crm/empresas/:id`, cargo, `Pilula` "admin", vigência "desde {data}" / "encerrado em {data}"; a gestão do vínculo é na Empresa — D-08) · **Negócios** (`NegociosDoRegistro`, 07-11).

**Ficha de Empresa** (página e popup) — **Dados** (nome fantasia, razão social, descrição, origem, Proprietário, Matriz por `SeletorDeRegistro` de Empresas) · **Identificadores** (Domínio, Documento fiscal + país, Telefone; principal; remover) · **Endereços** · **Campos adicionais** · **Contatos** (`VinculosDaEmpresa`: vigentes com cargo editável, `Toggle` admin, "Encerrar"; "Adicionar Contato" com `SeletorDeRegistro` que exclui já vinculados + cargo + admin; "Trocar admin"; lista recolhida "Vínculos encerrados") · **Matriz e Filiais** (links) · **Negócios** (07-11). No `modo="popup"` o `SidePanel` tem `footer` com **"Abrir página cheia"** → `/crm/empresas/:id`.

**Regra visual do admin (D-08):** o `Toggle` "admin" do único admin vigente e o "Encerrar" dele ficam **desabilitados com `disabledReason`** "Indique o novo admin antes de retirar o último." (a frase de `validarRetiradaDeAdmin`), e o clique alternativo oferece "Trocar admin". A Empresa nunca é exibida sem admin vigente fora da Lixeira.

**Ficha de Funil** — layout herdado da tela atual: **Etapas à esquerda**, atributos à direita. `PageHeader`: nome, `StateSeal`, `Pilula tom="info"` "Funil padrão", `meta` "N Etapas · M Negócios". Ações: **Definir como padrão** (`secondary`; só para Funil `ativo`, não privado, não padrão), **Migrar Negócios** (desabilitado sem Negócios: "Este Funil não tem Negócios."), `AcoesDeCicloDeVida`.
- **Etapas (`EtapasDoFunil`):** uma linha por Etapa na `ordem`: nome (renomear inline), "Probabilidade padrão {N}%" (`.app-numero`), contagens `{abertos} abertos · {ganhos} ganhos · {perdidos} perdidos` (+ "{n} arquivados"/"{n} na Lixeira" só quando > 0), `SetaDeOrdem` subir/descer (cada movimento envia a permutação inteira), **Remover**. Uma única Etapa: Remover desabilitado com "Um Funil precisa de ao menos uma Etapa." Etapa com Negócios: Remover abre o `RemoveStageDialog`. Fim da lista: "Adicionar Etapa" (nome, probabilidade, posição opcional). Sem Requisitos nem Transições (D-02).
- **Atributos (`RecordPanel`):** "Funil" (nome, descrição, Privado) e "Regras de encerramento" (`Toggle` "Exigir Motivo de Perda ao marcar como perdido"; `Toggle` "Exigir valor ao marcar como ganho"; cada `Toggle` com `labelledBy`).
- **Para quem não administra:** tudo em somente leitura + a linha de apoio da seção "Textos de apoio".

**Ficha de Negócio** — `PageHeader`: título, `Pilula` da situação (Aberto/Ganho/Perdido com `--cor-neg-*`), `StateSeal`, `meta` "{Funil} · {Etapa}". Painéis: **Dados** (título, objeto, descrição, Valor + Moeda, Probabilidade — mostra a efetiva e a marca "ajustada" quando sobrescrita, Data prevista, Origem, Proprietário) · **Dono** (Empresa **ou** Contato, com link; trocar por `Segmentos` + `SeletorDeRegistro`) · **Etapa** (`Select` das Etapas do Funil → mover; "Mudar de Funil" exige escolher a Etapa do Funil novo antes de enviar) · **Encerramento** (aberto: botões "Marcar como ganho" / "Marcar como perdido"; encerrado: motivo, nota e data, mais "Reabrir"; Reabrir de `ganho` desabilitado para `membro` com a frase de RN-NEG-10). Arquivado: campos só leitura, só Restaurar/Excluir.

**Moeda e valor:** exibidos por `useFormat().money` na moeda do Negócio ("R$ 2.500,00"); digitados como "1.234,56", "1234,5" ou "1234.50" e enviados como texto decimal `"1234.56"`. Valor inválido → erro de `Field` "Informe um valor como 1.234,56." `[auto] derivado de` `valorDigitadoParaDecimal` (07-10).

### 4. Quadro de Negócios (`QuadroDoFunil`, `/crm/negocios`)

- **Cabeçalho:** `PageHeader` com ícone, `meta` "N abertos", totais "{valor declarado} declarado · {valor ponderado} ponderado" (`.app-numero`), `Select` do Funil (só Funis ativos; padrão = Funil padrão) e o botão "Novo Negócio".
- **Colunas:** uma `ColunaDeQuadro` por Etapa, na `ordem`, **inclusive vazias** (`VazioDaColuna` "Nenhum Negócio nesta Etapa."). `nome` = nome da Etapa (cor = `cor` da Etapa), `contagem` = abertos na coluna, `subtitulo` = "{N}% padrão · {soma dos valores}". Sem rodapé de Requisitos (D-02). Ganho e perdido **não são colunas** (B58).
- **Cartão (`CartaoDeNegocio`):** título (600, uma linha, `truncate`), Empresa ou Contato, valor formatado (600, `.app-numero`), probabilidade efetiva ("60%"), Proprietário, data prevista (`.app-meta`). Todo o cartão abre a ficha (`href`); `ActionMenu` com **Abrir**, **Ganhar**, **Perder**.
- **Arrastar e soltar:** API de drag nativa de `ColunaDeQuadro.onDrop`. Ao soltar: o cartão muda de coluna **na hora** (otimista) → `POST /negocios/:id/mover`; sucesso revalida; qualquer recusa **devolve o cartão à coluna original** e mostra o Toast de erro. Cartão em arraste fica a 60% de opacidade; coluna de destino não ganha cor nova (o trilho já tem hover do sistema).
- **Alternativa por teclado e toque (acessibilidade):** `[auto] derivado de` WCAG 2.5.7 (movimento de arrastar precisa de alternativa de ponteiro único). O `ActionMenu` do cartão ganha, além de Abrir/Ganhar/Perder, **um item "Mover para {Etapa}" por Etapa de destino** (todas, menos a atual), que chama o mesmo `moverNegocio`. *Delta em relação a 07-10:* o plano lista só Ganhar/Perder/Abrir; este contrato acrescenta os itens "Mover para …" (custo: mapear `etapas` no `acoes` do cartão).
- **Faixa "Negócios encerrados":** abaixo do quadro, recolhível (botão "Mostrar encerrados" / "Ocultar encerrados"); cada item mostra `Pilula` Ganho/Perdido, título, valor e "Última Etapa: {nome}"; ação **Reabrir**.
- **Permissão:** sem permissão de escrita, cartões não são arrastáveis e Ganhar/Perder/Mover somem do menu (só Abrir); o quadro continua legível.
- **Estado carregando:** `EsqueletoDeLinhas` do barril (`EsqueletoDeTela` de `esqueletos.tsx` não é exportado pelo barril e não entra nesta fase).

### 5. Diálogo de encerramento (`DialogoDeEncerramento`)

Um componente, três modos, `ConfirmDialog` de largura padrão.

| Modo | Campos | Botão | Desabilita Confirmar quando |
|---|---|---|---|
| Ganhar | Valor (pré-preenchido) · Motivo do ganho · Nota de encerramento | "Marcar como ganho" | Funil `exigeValorGanho` e valor ausente/≤ 0 → motivo = frase de `validarGanho` |
| Perder | Motivo da perda (texto livre) · Nota de encerramento | "Marcar como perdido" | Funil `exigeMotivoPerda` e motivo vazio → frase de `validarPerda` |
| Reabrir | Etapa de destino (opcional; **obrigatória** quando o Funil não está `ativo`) | "Reabrir Negócio" | Funil inativo e sem Etapa → frase de `validarReabertura` |

### 6. Diálogos de D-07

`RemoveStageDialog` e `MigrateFunnelDialog` **mantêm layout, textos de RN-FUN-08/10/13 e parâmetros de URL**; só a fonte muda para a api. Contrato visual novo:
- Remover Etapa: mostra as contagens por situação/estado da Etapa (abertos, ganhos, perdidos, arquivados, na Lixeira), `Select` de destino com as demais Etapas, botão "Remapear e remover". A menção a "Requisitos" sai (D-02).
- Migrar Funil: `Select` de destino (só Funis `ativo` ≠ origem); ao escolher, uma linha por Etapa de origem **com Negócios** mostrando "{Etapa origem} → [Select das Etapas do destino]", já sugerido pela Etapa de mesmo nome (ignorando caixa) ou pela inicial; Confirmar desabilitado até o mapeamento ficar completo, com a frase de `validarMigracao` como `confirmDisabledReason`.
- Ao concluir: fecha, limpa o parâmetro de URL e mostra o Toast de sucesso; em recusa, o diálogo fica aberto.

### 7. Seletores

- **`SeletorDeProprietario`:** `Select` com os Membros `ativo` do store antigo (`useMembrosAtivos`); valor vazio = "Eu (quem cria)" (D-11). Nunca lista Membros pendentes/removidos.
- **`SeletorDeRegistro`:** campo de busca com espera de 300 ms, até 10 resultados (`limite=10`, `estado=ativo`), `excluirIds` respeitado; resultado mostra nome e, em segunda linha `.app-meta`, o desempate (e-mail principal / domínio / documento). Teclado: setas navegam, Enter escolhe, Esc fecha (padrão do `Select` do sistema). Estado "buscando…" não pisca vazio.

### 8. Recuo para as telas antigas (D-15)

`/crm/contatos/[id]`, `/crm/empresas/[id]`, `/crm/negocios/[id]`: a api responde 404 **e** o id existe no modelo antigo → renderiza a tela **antiga intacta** (`FichaDeContatoLegado`, `FichaDeEmpresaLegado`, `DealScreen`), sem faixa, sem aviso, sem alteração visual. A transição é invisível; quem a ensina é a limitação aceita de D-15. Funis do modelo antigo não têm recuo (ver texto de 404 de Funil).

### 9. Estados transversais

| Estado | Contrato |
|---|---|
| Carregando | Esqueleto na forma do conteúdo (`EsqueletoDeLinhas` / `Esqueleto` do barril; quadro: colunas de `Esqueleto`). Botão que grava: `carregando` + `disabledReason` "Gravando…" |
| Vazio | Tabela de Estados vazios acima; nunca área em branco |
| Erro de carga | `EmptyState` com a mensagem; sem botão "Tentar de novo" obrigatório (SWR revalida ao focar a aba) |
| Só leitura (Papel) | Campos como `RecordRow`; botões desabilitados com motivo; nenhuma mensagem de "sem permissão" bloqueando a leitura |
| Texto longo | Nomes e títulos `truncate` com `title` completo em listas e cartões; em ficha, quebram linha; nunca estouram a coluna |
| Muitos itens | Listas: "Mostrar mais" (50). Coluna do quadro: rolagem natural do `CorpoDeTela`; a coluna carrega até 200 Negócios por Funil e, acima disso, mostra no rodapé da coluna `.app-meta` "Mostrando 200 de {total}" |
| Foco | Ao abrir diálogo, foco no primeiro campo; ao fechar, volta ao botão que o abriu (comportamento do `ConfirmDialog`); após criar, foco no título da ficha |
| Movimento reduzido | Respeita `prefers-reduced-motion` (já no `Toast`/`ConfirmDialog`); o drag otimista não anima por conta própria |
| Atualização otimista | **Só** no mover do quadro. Demais gravações esperam a resposta e então revalidam |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn (`Tool: none`) | não aplicável |
| terceiros | nenhum | não aplicável |

Nenhum pacote visual novo. O único acréscimo de dependência da fase é `swr@2.5.1` (cache de dados, sem UI), aprovado em 07-RESEARCH.md (Package Legitimacy Audit).

---

## UI Considerations

`[auto]` Gerado pela sonda `ui-consideration-probe` (taxonomia fechada de 8 estados) sobre as 12 superfícies do «Layout and Interaction Contract», em modo `--auto`. Cada linha é uma verdade que o verificador cobra: `explicit` = o contrato acima já a fixa (a referência aponta a seção); `backstop` = resolvida por salvaguarda — o executor cobre com um teste de estado visual ou held-out, e sem evidência cabeada o verificador roteia para `human_needed`, nunca passa em silêncio. A copy dos estados vazio/erro mora no «Copywriting Contract» e é referenciada, não repetida.

### E1 — Listas (Contatos, Empresas, Funis)

- **empty** — resolved (explicit): Lista vazia mostra `EmptyState` com a copy da tabela «Estados vazios» da aba corrente (Ativos/Arquivados/Lixeira); nunca área em branco (§9 Estados transversais).
- **loading** — resolved (explicit): Enquanto carrega, `EsqueletoDeLinhas` com 6 linhas no lugar da tabela (§Esqueleto de toda tela).
- **error** — resolved (explicit): Erro de carga vira `EmptyState` com `ErroDeApi.message` («Estados de erro»); SWR revalida ao focar a aba, sem botão obrigatório (§9).
- **populated** — resolved (explicit): Colunas fixas por lista (tabela de §1), linha inteira clicável, coluna menos importante some em tela estreita (`hidden @6xl:table-cell`).
- **partial** — resolved (explicit): Valor ausente em qualquer coluna é «—» (travessão); Proprietário desconhecido também «—», nunca célula vazia nem «undefined» (§1).
- **overflow** — resolved (explicit): Paginação «Mostrar mais» de 50 em 50 (`limite`/`deslocamento`); a tabela rola dentro do `CorpoDeTela` (§1).
- **zero-one-many** — resolved (explicit): `meta` do cabeçalho com plural correto («1 Contato», «42 Contatos»); zero cai no `EmptyState` da aba (§1, «Estados vazios»).
- **long-text** — resolved (explicit): Nome de exibição e demais textos em célula usam `truncate` com `title` completo (§9 Texto longo).

### E2 — Formulários de criação

- **empty** — resolved (explicit): Campos vazios com `Field` e `label` sempre visível; botão primário desabilitado com `confirmDisabledReason` enquanto faltam campos obrigatórios (ex.: «Informe o nome fantasia ou a razão social.») (§2).
- **loading** — resolved (explicit): Durante a gravação o botão fica com `confirmDisabledReason="Gravando {o Contato / a Empresa / o Funil / o Negócio}…"` (§2).
- **error** — resolved (explicit): Em recusa o diálogo fica aberto com os campos preservados; erro de domínio aparece no `Field` do `campo` indicado, recusa da api em `Toast`/`MensagemDeRecusa` (§2, «Recusas 409»).
- **partial** — resolved (explicit): Pré-validação do domínio roda antes do `fetch` e aponta o campo faltante; Nova Empresa exige a seção «Contato admin» completa (D-08) (§2).
- **long-text** — resolved (explicit): Descrição em `TextArea`; limites `TEXTO_CURTO` (200) e `TEXTO_LONGO` (5000) do contrato zod devolvem 400 com a frase de erro no campo («Estados de erro»).

### E3 — Fichas (Contato, Empresa, Funil, Negócio)

- **empty** — resolved (explicit): Seção sem itens (Identificadores, Endereços, Campos adicionais, Empresas/Contatos, Negócios) mostra a copy de «Estados vazios» da superfície com a ação de adicionar (§3).
- **loading** — resolved (explicit): `EsqueletoDeLinhas` com 8 linhas no corpo da ficha (§Esqueleto de toda tela).
- **error** — resolved (explicit): 404 da api com id do modelo antigo renderiza a ficha antiga intacta (D-15, §8); outro erro de carga vira `EmptyState` com a mensagem; recusa de gravação em `Toast` (§9).
- **populated** — resolved (explicit): `PageHeader` com título, `StateSeal`, `meta` «Proprietário: {nome}» e `AcoesDeCicloDeVida`; `Section`s na ordem fixada por ficha (§3).
- **partial** — resolved (explicit): Campo sem valor em `RecordRow` mostra «—»; Negócio sem Proprietário/data mostra «—»; probabilidade ajustada leva a marca «ajustada» (§3).
- **overflow** — resolved (explicit): Listas internas crescem verticalmente dentro do `CorpoDeTela`; «Vínculos encerrados» fica recolhida (§3).
- **zero-one-many** — { statement: "How does the layout read at zero, one, and many items (singular vs plural copy, spacing)?", verification: backstop }
- **long-text** — resolved (explicit): Em ficha os textos quebram linha e nunca estouram a coluna (§9 Texto longo).

### E4 — Quadro de Negócios

- **empty** — resolved (explicit): Coluna sem Negócios é renderizada mesmo assim com `VazioDaColuna` «Nenhum Negócio nesta Etapa.»; sem Funil ativo, `EmptyState` da tabela «Estados vazios» (§4).
- **loading** — resolved (explicit): Colunas de `Esqueleto`/`EsqueletoDeLinhas` do barril enquanto carrega (§4, §9).
- **error** — resolved (explicit): Recusa ao mover devolve o cartão à coluna original e mostra o `Toast` de erro; erro de carga vira `EmptyState` (§4).
- **populated** — resolved (explicit): Uma `ColunaDeQuadro` por Etapa na `ordem`, com `contagem`, `subtitulo` «{N}% padrão · {soma}», totais declarado/ponderado no cabeçalho (§4).
- **partial** — { statement: "What is shown for partial or incomplete data — some fields or rows present, others missing?", verification: backstop }
- **overflow** — resolved (explicit): Coluna carrega até 200 Negócios por Funil e mostra no rodapé «Mostrando 200 de {total}»; rolagem natural do `CorpoDeTela` (§4, §9).
- **zero-one-many** — resolved (explicit): `meta` «N abertos»; colunas vazias sempre presentes; faixa de encerrados recolhível (§4).
- **long-text** — resolved (explicit): Título do cartão em uma linha com `truncate` e `title` (§4, §5 Cartão).

### E5 — Cartão de Negócio

- **loading** — { statement: "What is shown while data or content is still loading (skeleton, spinner, progressive reveal)?", verification: backstop }
- **error** — resolved (explicit): Mover recusado devolve o cartão à coluna original com `Toast` de erro (§4).
- **overflow** — { statement: "What happens when content exceeds its container — scroll, clip, wrap, or truncate?", verification: backstop }
- **long-text** — resolved (explicit): Título em uma linha com `truncate` e `title`; nome do dono e Proprietário também truncam (§4).

### E6 — Diálogo de encerramento

- **empty** — resolved (explicit): Valor pré-preenchido; Confirmar desabilitado com a frase de `validarGanho`/`validarPerda`/`validarReabertura` quando o campo exigido pelo Funil está vazio (§5).
- **loading** — resolved (explicit): Botão «Marcar como ganho/perdido» / «Reabrir Negócio» com `carregando` e «Gravando…» (§9).
- **error** — resolved (explicit): Recusa (ex.: `NEGOCIO_JA_ENCERRADO`) mantém o diálogo aberto e mostra `MensagemDeRecusa` («Recusas 409»).
- **partial** — resolved (explicit): Modo Reabrir: Etapa de destino obrigatória quando o Funil não está `ativo`; Confirmar desabilitado até escolher (§5).
- **long-text** — { statement: "What happens with unusually long text — truncation, wrapping, ellipsis, or reflow?", verification: backstop }

### E7 — Diálogos de D-07 (Remover Etapa, Migrar Funil)

- **empty** — resolved (explicit): Migrar Funil: sem destino escolhido, Confirmar desabilitado com a frase de `validarMigracao`; Remover Etapa exige `Select` de destino (§6).
- **loading** — resolved (explicit): Botão «Remapear e remover» / «Migrar Negócios» com `carregando` e «Gravando…» (§9).
- **error** — resolved (explicit): Em recusa o diálogo fica aberto; sucesso fecha, limpa o parâmetro de URL e mostra o `Toast` (§6).
- **populated** — resolved (explicit): Uma linha por Etapa de origem com Negócios: «{Etapa origem} → [Select do destino]», sugerida pela Etapa de mesmo nome ou pela inicial (§6).
- **partial** — resolved (explicit): Confirmar desabilitado até o mapeamento ficar completo (`confirmDisabledReason` = frase de `validarMigracao`) (§6).
- **overflow** — { statement: "What happens when content exceeds its container — scroll, clip, wrap, or truncate?", verification: backstop }
- **zero-one-many** — resolved (explicit): Contagens por situação/estado da Etapa (abertos, ganhos, perdidos, arquivados, na Lixeira) exibidas antes de remover (§6).
- **long-text** — { statement: "What happens with unusually long text — truncation, wrapping, ellipsis, or reflow?", verification: backstop }

### E8 — Seletores (Proprietário, Registro)

- **empty** — { statement: "What is shown when there is no data — zero items, an unfilled form, or absent media?", verification: backstop }
- **loading** — resolved (explicit): Estado «buscando…» visível; a lista nunca pisca vazia durante a espera de 300 ms (§7).
- **error** — { statement: "What is shown when the load or submit fails (message, retry affordance, partial fallback)?", verification: backstop }
- **populated** — resolved (explicit): Até 10 resultados (`limite=10`, `estado=ativo`), nome e desempate em segunda linha `.app-meta`; teclado setas/Enter/Esc (§7).
- **partial** — { statement: "What is shown for partial or incomplete data — some fields or rows present, others missing?", verification: backstop }
- **overflow** — resolved (explicit): Limite fixo de 10 resultados — refinar a busca é o caminho, sem paginação no seletor (§7).
- **zero-one-many** — { statement: "How does the layout read at zero, one, and many items (singular vs plural copy, spacing)?", verification: backstop }
- **long-text** — { statement: "What happens with unusually long text — truncation, wrapping, ellipsis, or reflow?", verification: backstop }

### E9 — Editor de Etapas do Funil

- **empty** — resolved (explicit): Um Funil precisa de ao menos uma Etapa: com uma única Etapa «Remover» fica desabilitado com «Um Funil precisa de ao menos uma Etapa.» (§3 Ficha de Funil).
- **loading** — { statement: "What is shown while data or content is still loading (skeleton, spinner, progressive reveal)?", verification: backstop }
- **error** — resolved (explicit): Recusa da api (ex.: `ETAPA_COM_NEGOCIOS`) via `MensagemDeRecusa`; Etapa com Negócios abre o `RemoveStageDialog` em vez de remover (§3).
- **populated** — resolved (explicit): Uma linha por Etapa na `ordem` com nome inline, probabilidade `.app-numero`, contagens e `SetaDeOrdem`; «Adicionar Etapa» no fim (§3).
- **partial** — { statement: "What is shown for partial or incomplete data — some fields or rows present, others missing?", verification: backstop }
- **overflow** — { statement: "What happens when content exceeds its container — scroll, clip, wrap, or truncate?", verification: backstop }
- **zero-one-many** — resolved (explicit): Contagens «{abertos} abertos · {ganhos} ganhos · {perdidos} perdidos» por Etapa; extras só quando > 0 (§3).
- **long-text** — { statement: "What happens with unusually long text — truncation, wrapping, ellipsis, or reflow?", verification: backstop }

### E10 — Faixa «Negócios encerrados»

- **empty** — { statement: "What is shown when there is no data — zero items, an unfilled form, or absent media?", verification: backstop }
- **loading** — { statement: "What is shown while data or content is still loading (skeleton, spinner, progressive reveal)?", verification: backstop }
- **error** — { statement: "What is shown when the load or submit fails (message, retry affordance, partial fallback)?", verification: backstop }
- **populated** — resolved (explicit): Cada item com `Pilula` Ganho/Perdido, título, valor, «Última Etapa: {nome}» e ação «Reabrir»; faixa recolhível «Mostrar/Ocultar encerrados» (§4).
- **partial** — { statement: "What is shown for partial or incomplete data — some fields or rows present, others missing?", verification: backstop }
- **overflow** — { statement: "What happens when content exceeds its container — scroll, clip, wrap, or truncate?", verification: backstop }
- **zero-one-many** — { statement: "How does the layout read at zero, one, and many items (singular vs plural copy, spacing)?", verification: backstop }
- **long-text** — { statement: "What happens with unusually long text — truncation, wrapping, ellipsis, or reflow?", verification: backstop }

### E11 — Estados transversais (Toast, EmptyState, Esqueleto)

- **empty** — resolved (explicit): Tabela «Estados vazios» cobre toda superfície; nunca área em branco (§9).
- **loading** — resolved (explicit): Esqueleto na forma do conteúdo (`EsqueletoDeLinhas`/`Esqueleto`); botão que grava com `carregando` + «Gravando…» (§9).
- **error** — resolved (explicit): `EmptyState` com a mensagem para carga; um `Toast` por vez no topo do `CorpoDeTela` para recusas, com `MensagemDeRecusa` e listas de links de `bloqueios` (§9, «Recusas 409»).
- **populated** — { statement: "What does the normal populated (happy-path) state look like at a typical volume of content?", verification: backstop }
- **partial** — { statement: "What is shown for partial or incomplete data — some fields or rows present, others missing?", verification: backstop }
- **overflow** — resolved (explicit): Listas com «Mostrar mais» (50); coluna do quadro limitada a 200 com rodapé «Mostrando 200 de {total}» (§9).
- **zero-one-many** — { statement: "How does the layout read at zero, one, and many items (singular vs plural copy, spacing)?", verification: backstop }
- **long-text** — resolved (explicit): `truncate` com `title` em listas e cartões; quebra de linha em fichas; nunca estoura a coluna (§9).

### E12 — Recuo para as telas antigas (D-15)

- **loading** — { statement: "What is shown while data or content is still loading (skeleton, spinner, progressive reveal)?", verification: backstop }
- **error** — resolved (explicit): Rota de ficha com 404 da api e id do modelo antigo renderiza a tela antiga intacta, sem faixa nem aviso (D-15); 404 de Funil mostra o texto próprio de «Estados de erro» (§8).
- **overflow** — { statement: "What happens when content exceeds its container — scroll, clip, wrap, or truncate?", verification: backstop }
- **long-text** — { statement: "What happens with unusually long text — truncation, wrapping, ellipsis, or reflow?", verification: backstop }

**Cobertura:** 82 considerações aplicáveis · 53 explicit · 29 backstop · 0 dismissed · 0 unresolved · 0 unclassified.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (não bloqueante — ações de uma palavra nas listas; sugerido `aria-label` com substantivo)
- [x] Dimension 2 Visuals: FLAG (não bloqueante — nomear âncora visual por tela; `aria-label` nos controles só de ícone)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: FLAG (não bloqueante — 11/12/13px muito próximos; confirmar peso de `.rotulo`)
- [x] Dimension 5 Spacing: FLAG (não bloqueante — 12px e 20px fora do conjunto padrão, herdados dos tokens aprovados em 02/04/05)
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: FLAG (não bloqueante — contagem do barril inconsistente «5 → 10»; dividir a procedência em duas linhas)

**Approval:** APPROVED — `gsd-ui-checker` em 2026-10-10, 0 BLOCK / 5 FLAG. Sonda de considerações de UI aplicada (seção acima).
