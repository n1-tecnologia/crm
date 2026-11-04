# Phase 12: Clone ClickUp: gravação mais rápida - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-30
**Phase:** 12-clone-clickup-grava-o-mais-r-pida
**Areas discussed:** Como medir em produção, Regra para escolher B/A/C, Duas pessoas gravando juntas (2.2.3 e 2.2.4), Mostrar na hora antes do servidor (2.2.5)

---

## Como medir em produção

| Option | Description | Selected |
|--------|-------------|----------|
| Um comando repete os gestos | Script roda da VPS contra a API real, num Espaço de teste; o mesmo comando serve para o "depois" | ✓ |
| Você clica na tela, 10 vezes cada | Mede o que a pessoa sente, mas 40 cliques à mão antes e depois | |
| Só em homologação ou no banco local | Sem risco, mas o número não é o de produção | |

**User's choice:** Um comando repete os gestos.

| Option | Description | Selected |
|--------|-------------|----------|
| Etapas + tempo total do pedido | Etapas do servidor (recorte da Fase 9 como etapa própria) mais o total medido pelo comando | ✓ |
| Etapas + total + clique até a tela | Marca no navegador; prova o ganho de "mostrar na hora" em produção | |
| Só as etapas do servidor | O que a 2.2.1 escreve; deixa fora recorte e rede | |

**User's choice:** Etapas + tempo total do pedido.

| Option | Description | Selected |
|--------|-------------|----------|
| Fica no log, sempre ligada | Nome da operação e tempo das etapas no log; não vai na resposta HTTP | ✓ |
| Fica, mas liga por variável de ambiente | Pede drop-in do systemd na VPS para ligar | |
| Sai ao fechar a fase | Código volta ao de hoje; próxima medição começa do zero | |

**User's choice:** Fica no log, sempre ligada.

| Option | Description | Selected |
|--------|-------------|----------|
| Espaço de teste dentro do ws_n1 | Tamanho real do banco; deixa rastros de Atividade e o Espaço na lixeira | ✓ |
| Um Espaço de Trabalho só para medir | Sem rastro, mas nasce quase vazio | |
| Homologação com dados de enchimento | Outro banco e outra rede | |

**User's choice:** Espaço de teste dentro do ws_n1.
**Notes:** O conector do Supabase do claude.ai ainda não enxerga a organização "N1", então a consulta de tamanho de `plataforma.registros` não roda por ele (D-05).

---

## Regra para escolher B, A ou C

| Option | Description | Selected |
|--------|-------------|----------|
| Já com B e uma parada depois da medição | Medir, parada com a tabela, 2.2.3–2.2.5, medir de novo | ✓ |
| Só a medição agora | Dois ciclos de planejar e executar | |

**User's choice:** Já com B e uma parada depois da medição.

| Option | Description | Selected |
|--------|-------------|----------|
| Registrar a sessão C e seguir com o B | `hidratar` > 300 ms na mediana vira fase própria no ROADMAP | ✓ |
| Parar e decidir com você | Fase fica esperando conversa | |
| Trazer o C para esta fase | 8 a 10 dias, mexe na maior parte do domínio | |

**User's choice:** Registrar a sessão C e seguir com o B.

| Option | Description | Selected |
|--------|-------------|----------|
| Descartado nesta fase | A paga uma migração para acelerar o gesto menos usado | ✓ |
| Porta aberta se contêiner for o gargalo | Reavalia o A na parada | |

**User's choice:** Descartado nesta fase.

| Option | Description | Selected |
|--------|-------------|----------|
| Você fixa a meta na parada, vendo o "antes" | Registrada no 12-CONTEXT.md antes de o B começar | ✓ |
| Só o "depois" menor que o "antes" | Sem número; "menor" pode ser 5 ms | |
| Meta fixa agora | Risco de ser impossível por causa da distância até o banco | |

**User's choice:** Você fixa a meta na parada, vendo o "antes".

---

## Duas pessoas gravando juntas (2.2.3 e 2.2.4)

| Option | Description | Selected |
|--------|-------------|----------|
| Erro depois de uma espera de 10 s | Uma tentativa só; "Outra alteração entrou antes desta. Tente de novo." | ✓ |
| Manter as 3 tentativas | Até cerca de 30 s parada | |
| Esperar menos (cerca de 3 s) | Falha rápido; mais gente vê "tente de novo" em horário de pico | |

**User's choice:** Erro depois de uma espera de 10 s.

| Option | Description | Selected |
|--------|-------------|----------|
| Fica como está; resolve na 3.4 (3.8) | O recarregamento de quem grava depois continua até o tempo real | ✓ |
| Reduzir agora na 2.2.4 | Exigiria histórico de revisões no servidor | |

**User's choice:** Fica como está.
**Notes:** O documento diz "3.4" no texto da 2.2.5, mas "Tempo real" é a seção 3.8; o CONTEXT.md usa 3.8.

| Option | Description | Selected |
|--------|-------------|----------|
| Todas, menos as importações longas | Tela, agendador, ponte e formulários públicos travam; importações com Q=0 ficam otimistas | ✓ |
| Só as gravações feitas pelas telas | Menor risco, mas os outros caminhos seguem pagando a hidratação repetida | |
| Todas, sem exceção | Importação longa bloquearia o ws_n1 | |

**User's choice:** Todas, menos as importações longas.

---

## Mostrar na hora, antes do servidor (2.2.5)

| Option | Description | Selected |
|--------|-------------|----------|
| Todos, com lista de exceções | Regra no store, vale para os 141 gestos de `run()`; exceções explícitas | ✓ |
| Só Estrutura e Tarefa | Telas com dois comportamentos | |
| Só os quatro gestos medidos | Vira piloto | |

**User's choice:** Todos, com lista de exceções.

| Option | Description | Selected |
|--------|-------------|----------|
| Some sozinha e aparece o erro | Volta ao `confirmado` mais as pendentes; erro por `lastResult` | ✓ |
| Fica marcada como não salva, com Tentar de novo | Exige desenhar esse estado em cada tela | |

**User's choice:** Some sozinha e aparece o erro.

| Option | Description | Selected |
|--------|-------------|----------|
| Aparece, mas só abre depois de confirmada | Visual de "salvando", sem link até o id verdadeiro | ✓ |
| Abre na hora com o id local | Risco de "não encontrado" se o servidor devolver outro id | |

**User's choice:** Aparece, mas só abre depois de confirmada.

| Option | Description | Selected |
|--------|-------------|----------|
| Um de cada vez, na ordem do clique | Fila; as respostas voltam em ordem e a revisão encaixa | ✓ |
| Todos saem juntos | Como hoje; resposta fora de ordem faz a tela recarregar tudo | |

**User's choice:** Um de cada vez, na ordem do clique.

---

## Claude's Discretion

- Nome do comando e formato do log; como o comando se autentica sem guardar segredo em arquivo.
- Desenho da trava no começo e do regime otimista das importações; o que `tentativas` vira.
- A lista de exceções do "mostrar na hora" e o visual de "salvando".
- Aviso ao fechar a aba com gravações pendentes (não discutido; recomendação: incluir).
- Custo do `structuredClone` extra de `confirmado`.
- Quantos planos e em que ondas (2.2.4 e 2.2.5 em ondas sequenciais, mesmo `enviar`).

## Deferred Ideas

- Caminho A (tabelas de Espaço, Pasta e Lista) e sessão C (Estrutura inteira).
- Aplicar a diferença na tela com a revisão à frente (histórico de revisões): junto da 3.8.
- Medir o clique até a tela no navegador.
- Botão "Tentar de novo" em mudança recusada.
