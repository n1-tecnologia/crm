# Relatório — Fase 4

**Pergunta da fase:** antes de gastar esforço em componentes reais, o layout de cada tela sustenta os fluxos?

**Resposta:** sustenta, depois de uma rodada de correções. A revisão de fluxo voltou REJEITADO com 18 achados; todos foram corrigidos. Três deles eram graves de um jeito específico — o wireframe contradizia a Fase 2 aprovada **sem dizer que contradizia**.

---

## 1. Entregue

| Item | Onde |
| --- | --- |
| Esboços das telas | `WIREFRAMES.html` — 31 esboços + o shell, em 1.300 linhas |
| Os dez fluxos como sequência | `WIREFRAMES.html#fluxos`, com índice próprio em `FLUXOS-WIREFRAME.html` |
| Decisões de layout | `DECISOES-DE-LAYOUT.md` — 16 decisões, cada uma com a alternativa rejeitada |

Baixa fidelidade de propósito: só cinzas, sem tipografia final, sem cor de marca, sem ícone. Cor e tipografia respondem perguntas da Fase 5 — introduzi-las aqui desviaria a conversa para gosto quando a pergunta ainda é estrutura.

**Cobertura.** A lista mínima do PRD (entregável 1) está completa, conferida item a item pelo revisor. Além dela entraram T01 Entrar, T41 Membro, as Configurações de contêiner e os três diálogos que concentram risco — D01 (mover com Mapeamento), D03 (mesclar Contatos) e D13 (converter Item), cada um em tamanho real, não como cartão de 190 px.

**Estados.** Todo esboço de tela carrega ao menos um estado além de "com dados": vazio, ação impedida, ou sem acesso. O único bloco sem estados é o `shell`, que define zonas comuns e não é tela.

---

## 2. A revisão

`flow-critic` sobre os três documentos: **REJEITADO**, 18 achados. Todos corrigidos, nenhum aceito com justificativa.

### Os três que importam

**1. Contradição silenciosa com a Fase 2** (achado 13). Três decisões de layout divergiam do mapa aprovado sem registrar a divergência:

| Decisão | O que eu tinha escrito | O que a Fase 2 diz |
| --- | --- | --- |
| 1 · Tarefa | página cheia, painel rejeitado | "painel lateral **com opção de** página cheia" (`MAPA-DE-NAVEGACAO.md:125`) |
| 2 · Caixa de Entrada | duas telas | "A operação conversacional. **Três colunas**." (`INVENTARIO-DE-TELAS.md:463`) |
| 9 · Encerrar Negócio | formulário em linha | diálogo por `?ganhar=` / `?perder=` (D07) |

Nas três a Fase 2 prevaleceu, e os esboços foram redesenhados. A decisão 1 nem era contradição de fato — a Fase 2 pede as duas formas, e eu tinha transformado um "e" em "ou".

**Divergir de um documento aprovado é legítimo; divergir em silêncio não é**, porque quem lê os dois passa a não saber qual vale. A decisão 16 do documento registra isso explicitamente.

**2. Nenhum esboço mostrava o retorno de uma ação** (achado 2). O wireframe inteiro mostrava o clique e o estado novo, nunca o aviso que confirma o que aconteceu — contra §13 dos padrões, que exige "um aviso breve, nomeando o registro", e contra `FLUXOS.md`, que escreve o texto exato de quase todo passo.

Corrigido no lugar certo: o **shell** ganhou uma zona de aviso, porque isso não é decoração de uma tela, é estrutura de todas.

**3. Superfícies referenciadas por fluxos que não existiam** (achados 3 e 4). O fluxo 7 apontava duas vezes para uma tela de "Execução" sem esboço, e o Chat não tinha nem indicador de `executando…` com Cancelar, nem o cartão de Solicitação de Aprovação em linha. O fluxo 5 dependia do bloco de Rascunho de IA com [Usar] / [Descartar], que também não existia.

Um fluxo que aponta para uma tela inexistente não foi desenhado — foi descrito.

### Os demais, em uma linha cada

- **1 · D13 ausente:** converter Item era um clique só, com controle neutro, sendo ato terminal que exige confirmação por digitação do nome.
- **5 · A decisão 14 contrariada pelo próprio esboço:** fora do Prazo, o seletor de modelo e o campo livre apareciam juntos — exatamente a alternativa que a decisão rejeita.
- **6 · Widget sem saída:** dava para criar, não para editar nem remover.
- **7 · Contato na lixeira** oferecendo mesclar (que a regra proíbe) e sem restaurar.
- **8 · D04 subdimensionava a perda:** dizia "3 Sessões deixam de ser acessíveis" onde a regra é "Sessões **e a Memória do Usuário** vão para a lixeira e são eliminadas em 30 dias".
- **9 · Fluxo 6 sem porta de entrada** e inventando escolha campo a campo, que D03 não tem.
- **10 · Fluxo 4 perdeu o erro canônico:** o cartão volta à origem com diálogo nomeando a exigência.
- **11 · Fluxo 5 trocava a reabertura por Mensagem recebida** por reabertura manual, e chamava o Agente de "delegado" quando ele fica na Proveniência.
- **12 · Números contra a própria regra:** "1 de 3" onde B48 manda "1 de 2"; "5 níveis" onde o limite é 3.
- **14 · Oito esboços só com dados**, sem vazio nem impedido.
- **15 · Controles off sem motivo**, contra a legenda da própria página.
- **17 · Telas referenciadas e nunca esboçadas:** T01, T41, D01, D03, D13.
- **18 · Fluxo 10 mostrava ação sem permissão desabilitada**, quando o padrão é que ela **não apareça**.

---

## 3. O achado que saiu do papel e entrou no código

O achado 16 era sobre vocabulário: "Etiqueta", "dono" e "janela de reabertura" são sinônimos que o glossário marca como **proibidos** — os termos canônicos são **Tag**, **Proprietário** e **Prazo de reabertura**.

Isso não era problema só do wireframe. O código da Fase 3 usava os três, e a rota era `/configuracoes/etiquetas` quando o mapa especifica `/configuracoes/tags` (`MAPA-DE-NAVEGACAO.md:180`).

Corrigido nos dois lugares: sete arquivos do app e a rota renomeada. Verificado que a rota antiga responde 404 e a nova 200.

**Vale o registro:** uma revisão de documento apanhou um defeito de implementação. Foi o vocabulário que denunciou — o mesmo termo errado aparecia nos dois, porque saiu da mesma cabeça.

---

## 4. Verificação

```
âncoras quebradas: nenhuma
seções com estado além de "com dados": 31 de 31 telas
saldo de tags <section>: 0
termos não canônicos (Etiqueta, dono, janela de reabertura): 0
```

Conferido mecanicamente: todo `href="#..."` resolve para um `id` existente; toda seção de tela carrega ao menos um bloco de estado; nenhum termo da coluna de sinônimos proibidos do glossário sobrevive no arquivo.

---

## 5. O que a Fase 6 herda daqui

Três alinhamentos com a Fase 2 que a implementação da Fase 3 ainda não seguiu, e que agora estão nomeados como trabalho:

1. **Painel lateral da Tarefa** — a página cheia existe; o painel a partir da Lista e do Quadro é da Fase 6, reaproveitando o mesmo componente.
2. **Caixa de Entrada em três colunas** — hoje são duas telas.
3. **Encerrar Negócio por diálogo endereçável** (`?ganhar=` / `?perder=`) — hoje é formulário em linha.

Nenhum é retrabalho jogado fora: as operações, as validações e os textos já estão certos; o que muda é o contêiner.
