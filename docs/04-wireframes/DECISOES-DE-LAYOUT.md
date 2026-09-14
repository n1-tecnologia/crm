# Decisões de layout

**Fase 4.** Cada decisão traz a alternativa que foi rejeitada e o motivo em uma frase. O critério é sempre o mesmo: **o layout sustenta o fluxo?** Onde a resposta dependeu de uma regra da ontologia, a regra está citada.

---

## 1. Painel lateral **e** página cheia para a Tarefa

**Decidido:** as duas formas, como a Fase 2 aprovou (`MAPA-DE-NAVEGACAO.md:125` — "painel lateral com opção de página cheia", já com rota própria `/estrutura/tarefas/[tarefa]`).

**O que muda entre elas:** a rota é a forma canônica e endereçável — a Tarefa é destino de link de Negócios, Conversas e Registros de Atividade, e um painel que só existe sobre uma Lista não tem endereço para receber esses links. O painel é a leitura rápida a partir de uma Lista ou de um Quadro, sem perder o contexto da coleção.

**Ordem de construção:** a página cheia veio primeiro, na Fase 3, porque é ela que os links precisam. O painel entra na Fase 6, reaproveitando o mesmo conteúdo — não é uma segunda implementação da Tarefa, é o mesmo componente em outro contêiner.

> Registro de correção: a primeira versão desta decisão descartava o painel, o que contrariava a Fase 2 aprovada sem dizer que a contrariava. A revisão de fluxo apanhou; a Fase 2 prevalece.

---

## 2. Três colunas na Caixa de Entrada

**Decidido:** três colunas — lista de Conversas · Conversa · contexto — como a Fase 2 aprovou (`INVENTARIO-DE-TELAS.md:463`, T21: "A operação conversacional. Três colunas.").

**Motivo:** atender é trabalho de fila. Quem atende passa o dia trocando de Conversa, e uma navegação por troca é um imposto cobrado centenas de vezes ao dia. As três colunas mantêm a fila visível e tornam a troca instantânea.

**A objeção real, e como ela se resolve:** a coluna do meio fica com menos largura, e é justamente onde o texto precisa de espaço — ainda mais porque o compositor **muda de forma** quando o Prazo de resposta expira (o campo livre é substituído pelo seletor de modelo, decisão 14). A coluna de contexto, à direita, é recolhível; recolhida, a linha do tempo recupera a largura sem que a fila se perca.

**Consequência aceita:** abaixo de 1280 px as três colunas não cabem. Aí a coluna de contexto vira painel sob demanda, e a lista vira uma tela própria — o mesmo conteúdo, dois arranjos.

> Registro de correção: a primeira versão desta decisão adotava duas telas, contrariando a Fase 2 aprovada sem registrar a reversão. A Fase 2 prevalece.

---

## 3. Onde vive o Mapeamento de Status

**Decidido:** dentro do diálogo de mover a Tarefa, no momento do movimento.

**Rejeitado:** (a) uma tela de configuração que pré-define mapeamentos entre pares de Listas; (b) mapeamento automático por nome de Status.

**Motivo:** um mapeamento pré-definido envelhece em silêncio — o Conjunto de Status muda e o mapeamento continua apontando para um Status que já não existe. E mapear por nome é a pior das opções: "Concluído" numa Lista pode ser categoria `concluido` e noutra `fechado`, e a categoria é o que decide se a Tarefa está encerrada.

**Consequência aceita:** mover várias Tarefas de uma vez exige mapear uma vez para o lote, não uma por Tarefa — o diálogo mapeia por *Status de origem*, não por Tarefa.

---

## 4. Posição dos Vínculos

**Decidido:** coluna direita, abaixo dos atributos, em toda ficha que os tem (Tarefa, Negócio, Contato, Conversa).

**Rejeitado:** aba própria, ao lado de Comentários e Atividade.

**Motivo:** o Vínculo responde "o que mais está ligado a isto" — é contexto periférico e constante, não conteúdo que se lê em sequência. Numa aba, ele só é visto por quem já sabe que existe.

**Consequência aceita:** com muitos Vínculos a coluna cresce. Resolve-se com contagem no título e "mostrar mais" — nunca com corte silencioso.

---

## 5. Ganho e perdido não são colunas do Quadro de Negócios

**Decidido:** as colunas são as Etapas do Funil; os Negócios encerrados vão para uma faixa própria abaixo do Quadro, mostrando a última Etapa que ocuparam.

**Rejeitado:** duas colunas extras "Ganho" e "Perdido" à direita, como é comum em CRM.

**Motivo:** toda Etapa é de progressão, e um Negócio encerrado **preserva** a Etapa em que estava. Colunas de ganho e perdido inventariam duas Etapas que não existem e apagariam a informação de onde o Negócio parou — que é justamente o que se quer saber ao analisar perdas.

**Consequência aceita:** ver os encerrados exige rolar até a faixa. Compensa que ela vem recolhida por padrão com a contagem visível, então não ocupa espaço de quem está operando o funil.

---

## 6. Selo e marcador são formas visuais diferentes

**Decidido:** o selo é retangular, ao lado do nome, e diz o que o registro **é** (`arquivado`, `na lixeira`, `mesclado`). O marcador é textual, discreto, e diz como o registro **está agora** (`Vencida`, `Bloqueada`, `adiada`).

**Rejeitado:** um único componente de "etiqueta de estado" para os dois.

**Motivo:** um marcador some sozinho quando a causa cessa; um selo só muda por um ato. Com a mesma forma, o usuário aprende a tratar os dois igual — e passa a achar que "Vencida" é permanente ou que "arquivado" vai se resolver sozinho.

---

## 7. O estado vazio e o "sem acesso" são componentes distintos

**Decidido:** `EmptyState` (borda tracejada, diz o próximo passo) e `NoAccessState` (fundo cinza, diz "sem acesso") são componentes separados, com aparência diferente.

**Rejeitado:** reaproveitar o estado vazio com um texto diferente.

**Motivo:** confundir os dois vaza informação nos dois sentidos — mostrar "vazio" onde há dados escondidos mente sobre o conteúdo, e mostrar "sem acesso" onde nada existe revela que ali há algo. A distinção precisa ser visual, não só textual, porque o usuário lê a forma antes do texto.

---

## 8. O ancestral inacessível aparece como nome inerte

**Decidido:** na árvore lateral, um contêiner privado que o Membro não pode ver mostra **apenas o nome**, em cinza claro, sem link e sem seta de expandir.

**Rejeitado:** (a) ocultar o ramo inteiro; (b) mostrar como link que leva a uma tela de "sem acesso".

**Motivo:** ocultar quebraria a leitura da hierarquia — a Lista que a pessoa **pode** ver apareceria pendurada no nada. E um link que só leva a uma negativa é um link morto disfarçado. O nome inerte preserva a estrutura sem prometer navegação que não existe.

---

## 9. Encerrar um Negócio é diálogo endereçável

**Decidido:** diálogo, aberto por parâmetro de consulta — `?ganhar=` / `?perder=` — como a Fase 2 aprovou (`INVENTARIO-DE-TELAS.md:1083`, D07).

**Motivo do parâmetro, e não de um estado interno:** encerrar um Negócio é um passo que se compartilha ("confere isso antes de eu fechar"), se recarrega e aparece no histórico do navegador. Um diálogo preso a estado de componente perde as três coisas.

**A objeção real:** o Funil pode exigir valor no ganho e Motivo na perda, e quem preenche precisa consultar o que está na tela — Etapa atual, histórico, valor já registrado. Por isso o diálogo **não cobre a página inteira**: ele ocupa a coluna central, e a coluna de atributos continua legível ao lado.

> Registro de correção: a primeira versão desta decisão usava formulário em linha, contrariando D07 sem registrar a reversão. A Fase 2 prevalece; a implementação da Fase 3 usa formulário em linha e é a Fase 6 que a alinha.

---

## 10. A sucessão de Membro é bloco inline na lista, não tela própria

**Decidido:** o diálogo de sucessão abre dentro de `/configuracoes/membros`, listando tudo o que será transferido e tudo o que será liberado.

**Rejeitado:** uma rota `/configuracoes/membros/[membro]/remover`.

**Motivo:** a decisão de quem sucede depende de ver **os outros Membros** — quem está ativo, quem é Convidado, quem já carrega quanta coisa. Numa tela isolada, a lista some justamente quando é mais necessária.

---

## 11. As configurações de contêiner são uma tela para os três níveis

**Decidido:** um só componente serve Espaço, Pasta e Lista, montado em três rotas.

**Rejeitado:** três telas, uma por tipo de contêiner.

**Motivo:** os aspectos configuráveis são idênticos nos três níveis; o que muda é de onde o valor vem. Três telas separadas divergiriam com o tempo, e a divergência apareceria como inconsistência de comportamento — o pior tipo de bug de interface.

---

## 12. A tabela do aspecto mostra "de onde vem" e "como compõe"

**Decidido:** quatro colunas — aspecto, modo neste nível, origem do valor, forma de composição.

**Rejeitado:** só o modo (herdado/sobrescrito/bloqueado), como um interruptor.

**Motivo:** "herdado" sozinho não informa nada acionável: herdado **de onde**? E dois aspectos herdados compõem de formas opostas — o Conjunto de Status e as Funcionalidades **substituem** (o nível mais próximo vence), enquanto Definições de Campo e Tipos de Tarefa **acumulam** ao longo do caminho. Sem essa coluna, o usuário prevê errado o efeito de sobrescrever.

---

## 13. As quatro Visualizações são uma tela, não quatro rotas

**Decidido:** `/estrutura/listas/[lista]` com uma barra de Visualizações que troca o corpo.

**Rejeitado:** rotas separadas (`/lista/[id]/quadro`, `/lista/[id]/calendario`…).

**Motivo:** a Visualização é uma forma de olhar o mesmo conjunto — trocar de forma não deve perder o filtro aplicado nem parecer que se mudou de lugar. Rotas separadas convidam a divergir os filtros.

**Consequência aceita:** a Visualização escolhida não é compartilhável por URL. Aceito nesta fase; se virar necessidade real, resolve-se com parâmetro de consulta sem quebrar a rota.

---

## 14. Fora da janela de resposta, o compositor troca de forma

**Decidido:** quando a janela expira, o campo de texto livre é **substituído** pelo seletor de Mensagem de modelo aprovada, e escolher um modelo preenche o texto.

**Rejeitado:** manter o campo livre e recusar no envio com uma mensagem de erro.

**Motivo:** deixar escrever uma resposta inteira para depois recusá-la desperdiça o trabalho e ensina que o botão é não confiável. A forma do controle deve refletir o que é possível **agora**.

**Consequência aceita:** quando o Canal não tem nenhum modelo aprovado, não há o que oferecer — e a tela diz isso explicitamente, em vez de mostrar um seletor vazio.

---

## 15. Baixa fidelidade como restrição, não como pressa

**Decidido:** só cinzas, sem tipografia final, sem cor de marca, sem ícone.

**Motivo:** cor e tipografia respondem perguntas da Fase 5. Introduzi-las aqui faria a conversa desviar para gosto quando a pergunta ainda é estrutura — e uma decisão de layout aprovada por causa de uma cor bonita é uma decisão não testada.


---

## 16. Como ler as correções acima

As decisões 1, 2 e 9 trazem um "registro de correção". A primeira versão deste documento tomou três decisões que contrariavam o mapa da Fase 2 — já aprovado — **sem dizer que o contrariava**. A revisão de fluxo apanhou as três.

Divergir de um documento aprovado é legítimo; divergir em silêncio não é, porque quem lê os dois documentos passa a não saber qual vale. Nos três casos a Fase 2 prevaleceu, e onde a implementação da Fase 3 já seguiu o caminho antigo, o alinhamento está nomeado como trabalho da Fase 6.
