# Checklist — os Fluxos 1 a 7 do documento v2, a 100% na plataforma

Aberto em 2026-10-01, a partir do comparativo entre o documento
`Documentação - Projeto Financeiro Pagamentos.v2.docx` e o código. Os pedidos
do dono, fluxo a fluxo: **1** criar o Formulário público editável; **2** o
que falta no "marcar estrategista"; **3** a análise do comentário do
aprovador funcionando como no backend do Financeiro; **4** e **5** ok;
**6** a revisão do Resumo a 100%; **7** achar o erro do lançamento e corrigir.

Legenda: `[x]` feito (com o commit) · `[ ]` a fazer · `[dono]` só o dono pode
fazer (grava em produção, decide ou configura).

---

## Fluxo 7 — o erro do lançamento (pedido 7)

O 2B de 2026-10-01 chamou o `/lancar` uma vez e o Omie recusou o cadastro do
fornecedor: a razão social oficial do publica.cnpj.ws tinha 79 caracteres e o
Omie aceita 60. A conta voltou para "para pagar" com o motivo no fio. Na mesma
tentativa, o PDF anexado pelo popup não chegou ao Omie: o anexo da conta é um
protótipo.

- [x] **7.1** Razão social do fornecedor novo cortada nos 60 do Omie, CNPJ e
  CPF, com teste e mutação — `financeiro-tria` `f9bfcd8`.
- [x] **7.2** `5fa07e2` — O fio come os sublinhados: `FORNECEDOR_NAO_RESOLVIDO` aparece
  como "FORNECEDORNAO_RESOLVIDO". O renderizador (`timeline.tsx`, `Rico`) trata
  `_x_` como itálico até dentro de palavras; passa a valer só nas bordas de
  palavra, como no Markdown.
- [x] **7.3** `099dc56` — Anexo de verdade na conta. Hoje o "Anexar arquivo" e os Campos
  Anexo, Boleto e QR Code gravam só nome, tipo e tamanho, com a chave
  `legado/<id>`, e nenhum arquivo sobe. Fica assim:
  - [x] 7.3a `apps/api`: rotas autenticadas de upload da Tarefa (ticket →
    envio direto ao bucket privado → confirmação no servidor), reaproveitando
    `storage-uploads.ts` (25 MiB, PDF/XML/imagem, assinatura binária).
  - [x] 7.3b Domínio: operação que liga à Tarefa um Arquivo já confirmado,
    com a chave real do Storage, como anexo ou como valor de Campo de arquivo.
  - [x] 7.3c Tela: "Anexar arquivo" e os Campos de arquivo da conta sobem de
    verdade, com progresso e erro legível; o texto "protótipo" sai.
  - [x] 7.3d Testes: rota, domínio, a ponte mandando o anexo ao `/lancar`.
- [ ] **7.4** [dono] Refazer o 2B na conta `tsk_tarkef` com o fornecedor
  SAFE2PAY (já cadastrado no Omie) e um PDF anexado de verdade; o agente puxa o
  título do Omie, confere campo a campo e passa o comando de exclusão.

## Fluxo 3 — a análise do comentário do aprovador (pedido 3)

Como está: o aprovador é marcado pelo `automation/` com "<Nome>, para
aprovação", mas ninguém cria a Solicitação de Aprovação da plataforma. Sem
ela, o clique não aparece e toda resposta no fio morre como `fora_do_topico`.
A análise por comentário é uma reserva de 90 dias que, sem a variável
`FALLBACK_COMENTARIO_ATE`, fica desligada. E todo "reprovado" por comentário
dá 409, porque a reprovação exige motivo e a rota não o passa.

- [x] **3.1** `7c51ac6` — Reprovação por comentário: a rota de classificação passa o texto
  da resposta como motivo (`apps/api/src/rotas/classificacoes.ts`).
- [x] **3.2** `ee9c724` · `financeiro-tria` `19959d9` — A Solicitação de
  Aprovação nasce quando o aprovador é marcado: o `createComment` do contrato
  ganha `requestApprovalFromMemberId` (aditivo). O comentário de roteamento,
  a aprovação com ele como fio e o Status "em aprovação" saem na mesma
  transação; se a aprovação não abre, o comentário também não fica (422). O
  `automation/` manda o campo só quando o responsável tem Membro na
  plataforma.
- [x] **3.3** `c8fa51e` — A análise por comentário vale sempre, como no backend do
  Financeiro: sem `FALLBACK_COMENTARIO_ATE`, ligada; com uma data, até ela.
- [x] **3.4** `financeiro-tria` `5d91f51` — O classificador lê todas as páginas de respostas do fio, não só
  a primeira.
- [x] **3.5** Testes nos dois repositórios; contrato igual nos dois (hash
  `47211f2f…`, 82 arquivos). Os casos com banco (`classificacoes.test.ts` (j)
  e o E2E `dois-servicos`) não rodaram: o banco configurado é o de produção.
- [ ] **3.6** [dono] Os aprovadores (estrategistas) como Membros do `ws_n1` e
  o mapa `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` no `.env` do `automation/`: sem o
  Membro, não há a quem pedir a aprovação.

## Fluxo 6 — a revisão do Resumo a 100% (pedido 6)

Como está: a resposta de ajuste vai ao `/resolver` só como texto acrescentado
à busca de categoria (RAG). Com o Campo "Categoria de pagamento" preenchido, a
busca volta à mesma categoria e o "Resumo revisado" sai idêntico. No legado,
a IA reescreve o Resumo inteiro com o que foi pedido (categoria, valor,
vencimento, forma…) e o lançamento usa o Resumo revisado.

- [x] **6.1** `financeiro-tria` `45bdc15` · `f457f7c` — `/resolver`: a IA lê o pedido e escolhe a categoria no plano de
  contas real (só despesa, ativa, não totalizadora), código validado no Omie.
  Sem IA ou sem confiança, o pedido continua indo à busca (RAG). A Categoria
  pedida continua valendo nas publicações seguintes enquanto o Campo
  "Categoria de pagamento" não muda (`codigoCategoriaPedidoAnterior`).
- [x] **6.2** `financeiro-tria` `45bdc15` — `/resolver`: o pedido que muda outros dados (valor, vencimento,
  dado de pagamento, descrição) volta como mudanças estruturadas e validadas.
- [x] **6.3** `3b24c8f` + ponte — Ponte: aplica essas mudanças nos Campos da conta, como o
  Agente, a pedido de quem pediu (com Registro de Atividade), e republica o
  Resumo com "O que mudou". A Conferência nova continua obrigatória: a pessoa
  confere o que a IA entendeu antes de qualquer lançamento.
- [x] **6.4** `3b24c8f` — Pedido que não muda nada: o Agente responde no fio o que não
  entendeu e como pedir, em vez de um "revisado" idêntico.
- [x] **6.5** `3b24c8f` — As Observações do Resumo revisado registram o pedido atendido.
- [ ] **6.6** Contrato `contas-a-pagar-v1` aditivo nos dois repositórios,
  testes e uma prova real. Contrato v1.3 e testes feitos (cópia igual por
  hash); falta a prova real: um pedido de ajuste de verdade, com a IA real,
  na jornada — exige o `automation/` com a chave da OpenAI no ar.

## Fluxo 1 — o Formulário público editável (pedido 1)

Como está: o Formulário existe e tem editor (Lista › Configurações ›
Formulários), mas não foi criado no `ws_n1`. As seções e as condicionais da
página pública estão fixas no código e dependem do rótulo exato das
perguntas, então renomear uma pergunta quebra a página. O título da página é
fixo, e não dá para reordenar as perguntas. A Lista de Solicitações herda do
Espaço os Campos de Contas a pagar, e um deles, o "Centro de Custo", é
obrigatório; por isso o Formulário exige duas perguntas de Centro de Custo, e
o seletor mostra Campos duplicados com o mesmo nome.

- [ ] **1.1** Uma Lista pode deixar de usar Campos herdados; a de
  Solicitações deixa de usar os de Contas a pagar (o seletor para de duplicar
  e o "Centro de Custo" obrigatório em dobro some).
- [ ] **1.2** Perguntas com ordem e seção como dado: o editor sobe e desce
  perguntas e dá nome à seção.
- [ ] **1.3** Condicionais como dado ("mostrar quando <pergunta> for <valor>"),
  configuráveis no editor; a página pública lê do Formulário, não do rótulo.
- [ ] **1.4** Título e introdução da página pública vêm do nome e da
  descrição do Formulário.
- [ ] **1.5** Formulário desatualizado: a página e o upload recusam como o
  envio já recusa, com mensagem clara.
- [ ] **1.6** Remover o Membro dono não mata o link: o Formulário passa para
  quem removeu.
- [ ] **1.7** O texto velho "Protótipo: os dados vivem na memória" sai do
  editor.
- [ ] **1.8** Comando `solicitacoes:formulario` que cria o Formulário da
  Solicitação no `ws_n1` com as perguntas, seções e condicionais certas
  (dry-run; o `--apply` é do dono). Depois disso, tudo se edita pela tela.
- [ ] **1.9** Testes (domínio, API, tela) e a jornada `formulario-publico`
  rodando de verdade, com upload.
- [ ] **1.10** Validação do Fluxo 1 que o documento promete e o `automation/`
  não faz: o dígito do CPF (`isValidCpf` existe e não é usado).
- [ ] **1.11** [dono] Decidir: prazo mínimo de 2 dias úteis (padrão do
  código) ou 3 (o documento); e se uma Solicitação criada direto na Lista, sem
  o Formulário, deve disparar o pipeline (hoje não dispara).

## Fluxo 2 — marcar o estrategista (pedido 2: o que falta)

- [x] **2.1** A Solicitação de Aprovação e o Status "em aprovação" — é o 3.2.
- [ ] **2.2** [dono] Os aprovadores como Membros e o mapa de ids — é o 3.6.
- [ ] **2.3** A regra de quem aprova (centro de custo e o corte de R$ 5.000)
  mora no código do `automation/`; a decisão D-07 pedia que fosse
  configuração da plataforma, editável sem deploy. Fica para depois dos itens
  acima, se o dono quiser.

## Outros erros achados nesta rodada

- [x] **E1** `5d4b157` — A conta nova abre no popup com o id calculado no navegador; se a
  ponte grava no mesmo instante, o id do servidor é outro e o popup mostra
  "Conta não encontrada" (prova: `cmt_tark9u`/`tsk_tarka0`). A criação passa a
  abrir com o id confirmado pelo servidor.
- [ ] **E2** A tela não vê sozinha o que a ponte grava: consulta leve à
  revisão do Espaço e recarga quando ela muda.
- [x] **E3** `4957baa` — Na dispensa por Integração manual, o Resumo termina pedindo ao
  "Agente do pipeline" que confira; o texto deixa de pedir conferência quando
  ninguém vai conferir.

---

## Registro

| Data | Item | Commit | Prova |
|---|---|---|---|
| 2026-10-01 | 7.1 | `financeiro-tria` `f9bfcd8` | 772/772, mutação morde |
| 2026-10-01 | 7.2 | `5fa07e2` | web: 5 casos novos (código e nome de arquivo inteiros; itálico só na borda) |
| 2026-10-01 | 3.1 | `7c51ac6` | api: sem o motivo o domínio recusa; com ele, reprova e responde no fio |
| 2026-10-01 | E3 | `4957baa` | domínio: textos de sempre iguais byte a byte; ponte: dispensa sem Menção |
| 2026-10-01 | 7.3 | `099dc56` | domínio 13, api 18, web 11 casos novos; suítes inteiras verdes; a prova real é o 7.4 |
| 2026-10-01 | 3.2 | `ee9c724` · `financeiro-tria` `19959d9` | api 5 casos (Membro de serviço real do configurador); `automation/` 773/773; mutação morde nos dois |
| 2026-10-01 | 3.3 | `c8fa51e` | janela: ausente/em branco liga; mutação morde |
| 2026-10-01 | 3.4 | `financeiro-tria` `5d91f51` | 2 casos (2ª página; cursor repetido); 775/775; mutação morde |
