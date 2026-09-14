# RELATÓRIO DA FASE 2 — MAPA / MANUAL DE UX

Versão 1.0 · 2026-09-10
Fonte de verdade: `ontologia/` v1.0 (21 documentos APROVADO CONCEITUALMENTE). Governança: `PRD-FRONTEND-NAVEGAVEL.md`, Parte I e FASE 2.

---

## 1. O que foi entregue

| Arquivo | Conteúdo | Linhas |
| --- | --- | --- |
| `docs/02-mapa-ux/MAPA-DE-NAVEGACAO.md` | Casca da aplicação, 5 princípios de navegação derivados da ontologia, mapa de 56 rotas, 15 diálogos com endereço próprio, 7 rotas deliberadamente inexistentes, correções ao ponto de partida do PRD | 263 |
| `docs/02-mapa-ux/PADROES-TRANSVERSAIS.md` | 21 padrões que toda tela obedece: cabeçalho, selos × marcadores, ator e delegação, Atividade, Vínculos, Comentários, Tags, campos, cardinalidades, regras visíveis, permissões, confirmações, feedback, estados vazios, listas longas, lixeira, herança, versionamento, IA, navegação pós-criação, acessibilidade | 448 |
| `docs/02-mapa-ux/INVENTARIO-DE-TELAS.md` | 51 telas (T01–T51) e 15 diálogos (D01–D15), cada um com propósito, entidades e atributos exibidos, estados, ações e regras aplicadas, cardinalidades, listas longas, estado vazio e permissões | 1.118 |
| `docs/02-mapa-ux/FLUXOS.md` | Os 10 fluxos ponta a ponta, passo a passo com dados e interface, cada um com o seu caminho de erro; matriz fluxo × tela | 306 |
| `docs/02-mapa-ux/MATRIZ-COBERTURA.md` | 297 itens da ontologia mapeados: 280 exibidos, 17 declarados NÃO EXIBIDOS com motivo e com o lugar onde a consequência aparece; fechamento aritmético e verificação por documento | 413 |
| `docs/PENDENCIAS-FRONTEND.md` | 7 conceitos de interface sem base ontológica, 20 questões abertas da constituição que a interface encontrou, 1 item que exige decisão antes da Fase 6, e as divergências resolvidas contra o PRD | 104 |

---

## 2. Evidência de verificação

Comandos executados e resultado.

**Citações à ontologia — 255 identificadores distintos, todos existentes.**
```
grep -ohE '\b(RN|INV|DO)-[A-Z]{2,3}-[0-9]{2}\b' docs/02-mapa-ux/*.md docs/PENDENCIAS-FRONTEND.md | sort -u  → 255
comm -23 /tmp/citadas.txt /tmp/existentes.txt                                                              → (vazio)
```
As decisões `A1.1–A9.4`, `B1–B109` e `C5–C32` citadas também foram conferidas contra a constituição: nenhuma fora da faixa, nenhuma inexistente.

**Matriz de cobertura — numeração contígua, sem lacuna nem repetição.**
```
itens: 297  min 1  max 297  contígua: True
0. Globais 1–11 (11) · 1. Raiz 12–44 (33) · 2. Estrutura 45–100 (56) · 3. CRM 101–183 (83)
4. IA 184–254 (71) · 5. Painéis 255–271 (17) · 6. Transversais 272–280 (9) · 7. NÃO EXIBIDOS 281–297 (17)
```
Fechamento: 11+33+56+83+71+17+9+17 = 297 = 280 exibidos + 17 declarados.

**Telas — toda referência resolve.**
```
definidas: 66 (51 telas + 15 diálogos) | referenciadas: 66 | referenciadas sem ficha: (vazio)
```

**Rotas — toda rota real tem ficha.**
As únicas quatro rotas do mapa sem ficha são exatamente as declaradas inexistentes na seção 3.7 (`/crm/conversas/nova?empresa=`, `/estrutura/pastas/[pasta]/subpastas/nova`, `/ia/execucoes`, `/paineis/[painel]/publico`).

**Vocabulário — nenhum sinônimo não canônico.**
Varredura por `owner|deal|pipeline|dashboard|workspace|task|inbox|skill|tool|assignee|thread|bot|log|lead|chat` retornou apenas falsos positivos ("botão") e as próprias listas de termos proibidos. Uma ocorrência real foi corrigida (`locale`, achado 9 do `critic`).

**pt-BR — sem erro de acentuação nas strings de interface.**
Varredura por `usuario|nao|voce|configuracao|acao|permissao|negocio|conteudo|automacao|execucao` fora de nomes de rota: nenhum resultado.

---

## 3. Revisões exigidas pelo PRD

### 3.1 `critic` — fidelidade ontológica · veredito inicial **REJEITADO**, 9 achados

Verificou as 255 citações uma a uma contra a ontologia e declarou **limpas** as categorias de contradição com a ontologia, invenção de conceito, termo não canônico (salvo um) e estados.

| # | Sev. | Achado | Resolução |
| --- | --- | --- | --- |
| 1 | ALTO | Cobertura de 100% falsa: `Situação do Negócio`, `Data`, `Status atual`, `Última Etapa`, `Versão corrente` e `Publicador` não estavam numerados; e a linha de verificação do documento 06 creditava "Data" a itens que não a continham | **Corrigido.** Os seis itens foram inseridos nas suas seções e a matriz renumerada de 291 para 297; faixas por seção, fechamento aritmético e verificação por documento atualizados |
| 2 | MÉDIO | `DO-CNH-06` citada como fonte da proibição de Tags em Documento, quando é uma **proposta** de admiti-las | **Corrigido.** A citação passou a B5 + `conhecimento.md` 7.3 + a linha `Documento → Tag | 0 (nesta versão)`, e a divergência foi registrada em `PENDENCIAS-FRONTEND.md` §B |
| 3 | MÉDIO | Afirmação falsa: "PRD II.6 sem `/configuracoes/templates`" — o PRD já os listava | **Corrigido** no mapa e nas pendências: passou de "acrescentado" para "separado em rota própria", com a justificativa real (seis tipos com regras próprias, inclusive B47) |
| 4 | MÉDIO | Afirmação falsa: "PRD só previa configurações de Lista" — a linha 218 do PRD já dizia "configurações e herança" para o Espaço | **Corrigido**: só a Pasta estava ausente; a justificativa passou a ser a separação em rota própria |
| 5 | MÉDIO | Referência a tela inexistente `T63` em T02 | **Corrigido** para D09 (inline) / T36 (lista) |
| 6 | MÉDIO | "Onze operações bloqueantes" quando a tabela lista 13 | **Corrigido** para quinze (13 + D14 + D15) |
| 7 | MÉDIO | Contradição não declarada: B38(a) esconde o contêiner privado do Administrador, mas D06 exige que ele o selecione | **Corrigido.** D06 passou a declarar as duas entradas (Auditoria e campo de identificador, nunca listagem) e a lacuna foi registrada em `PENDENCIAS-FRONTEND.md` A7, com a ressalva de que é leitura, não regra |
| 8 | BAIXO | Matriz fluxo × tela creditava T06 ao fluxo 10 (onde nada abre) e D09 ao fluxo 7 (que decide em T26/T36) | **Corrigido** nas duas linhas, com a distinção explícita |
| 9 | BAIXO | Termo não canônico `locale` | **Corrigido**: o texto agora distingue o parâmetro da API `Intl` do objeto de valor **Localidade** |

### 3.2 `flow-critic` — completude de fluxo · veredito inicial **REJEITADO**, 20 achados

Declarou **limpas** as categorias de confirmação declarativa nos diálogos, rótulo × conteúdo no restante, e fluxos de erro (salvo dois casos).

| # | Sev. | Achado | Resolução |
| --- | --- | --- | --- |
| 1 | ALTO | Widget criado sem caminho de remoção, contra `paineis.md` 12.2 | **Corrigido**: T38 ganhou remover Widget e remover Âncora; entraram nas confirmações simples |
| 2 | ALTO | Papel personalizado sem exclusão — e a ontologia exige **Papel de destino dos titulares** na remoção | **Corrigido**: T43 ganhou a ação e nasceu **D14**, com confirmar desabilitado até todos os titulares terem destino |
| 3 | ALTO | Checklist, Item, Dependência e Registro de Tempo criados na Tarefa sem remoção, contra `checklist.md` 12.2 | **Corrigido**: T12 ganhou o bloco de ações de remoção do agregado; todas nas confirmações simples |
| 4 | MÉDIO-ALTO | "Para onde o usuário vai depois de criar X" não existia, e havia duas semânticas concorrentes | **Corrigido**: novo padrão §20, com três regras (criação em contexto, no inventário, derivada) e o destino citado em cada ação |
| 5 | ALTO | Apagar Item de Memória é irreversível, sem lixeira e sem confirmação | **Corrigido**: entrou nas confirmações por digitação |
| 6 | MÉDIO-ALTO | Remover Integração destrói credenciais sem confirmação | **Corrigido**: confirmação por digitação com a cascata enumerada |
| 7 | MÉDIO | Revogar convite, suspender Membro, suspender Espaço de Trabalho e revogar Concessão sem confirmação | **Corrigido**: os quatro nas confirmações simples, com o efeito nomeado |
| 8 | BAIXO | Descartar Rascunho de IA elimina conteúdo sem confirmação | **Corrigido**: confirmação simples com [Desfazer] por 10 segundos |
| 9 | ALTO | "Importar" Contatos sem tela, progresso, resultado nem caminho de erro — sendo que a ontologia define a operação | **Corrigido**: nasceu **D15** (mapeamento → escolha de colisão → progresso → balanço por desfecho → lista de rejeitados) e §13 ganhou a linha de ação em lote |
| 10 | MÉDIO | Aba Painéis existe em seis telas e nasce vazia por regra, sem estado vazio | **Corrigido** em §14 |
| 11 | MÉDIO | Suspeitas de Duplicidade e Sugestões de Vínculo sem estado vazio | **Corrigido** em §14, T13 e T15 |
| 12 | MÉDIO | Seções de T14 e T18 sem estado vazio, ao contrário de T16 | **Corrigido**: padrão de T16 replicado, mais coluna 1 da Caixa, Automações aplicáveis, Ferramentas permitidas e Anexos |
| 13 | ALTO | O caminho de erro do Fluxo 1 contradizia o próprio §10 ("nunca um botão habilitado que erra ao clicar") | **Corrigido**: §10 ganhou a regra de decisão (dado já na tela → controle desabilitado; dado só no servidor → validação no ato) e o Fluxo 1 foi reescrito de acordo |
| 14 | MÉDIO-ALTO | Convidado vê "seletores desabilitados" sem explicação | **Corrigido**: §11 ganhou a regra de que controle desabilitado por permissão sempre diz por quê e qual acesso a pessoa tem |
| 15 | MÉDIO | Nó inerte da árvore sem sinalização | **Corrigido**: `aria-disabled`, sem cursor de link, com dica neutra |
| 16 | MÉDIO | Referência cruzada errada (T35 em vez de T34) na aba Conhecimento do Agente | **Corrigido** para T34 › aba Acesso |
| 17 | MÉDIO | Mapa e inventário discordavam sobre as abas da Habilidade | **Corrigido**: T30 passou a declarar as cinco abas, com Ferramentas e Dependências próprias |
| 18 | MÉDIO | Sino de Notificações na casca sem tela, ficha nem estado vazio | **Corrigido**: nasceu **T51**, declarada visão derivada e não entidade |
| 19 | BAIXO | Duas mensagens diziam "não pode" sem próximo passo | **Corrigido**: Membro `suspenso` e consentimento ausente ganharam texto com ação |
| 20 | BAIXO | Paginação declarada só pela regra genérica nas coleções que mais crescem | **Corrigido**: §15, T21, T26, T50 e T51 ganharam ordenação e [Carregar anteriores] explícitos |

### 3.3 Achados aceitos sem correção

Nenhum. Os 29 achados das duas revisões foram corrigidos.

### 3.4 O que mudou de tamanho por causa das revisões

| Antes | Depois |
| --- | --- |
| 50 telas · 13 diálogos | **51 telas · 15 diálogos** (T51 Notificações; D14 Excluir Papel; D15 Importar Contatos) |
| 291 itens na matriz | **297 itens** |
| 20 padrões transversais | **21 padrões** (§20 Depois de criar) |
| 6 pendências de interface | **7 pendências** (A7 acesso a contêiner privado) + 1 divergência registrada (DO-CNH-06) |

---

## 4. Critérios de pronto do PRD

| Critério | Situação | Evidência |
| --- | --- | --- |
| Cobertura 100% na matriz | **Atendido** | 297 itens classificados; 280 exibidos; 17 declarados com motivo e com o lugar da consequência. As sete entidades internas que o PRD nomeou como teste (Identificador de Contato, Etapa, Participante, Execução, Versão, Fragmento, Widget) estão todas exibidas |
| Toda rota tem ficha | **Atendido** | 56 rotas no mapa; 51 fichas; as quatro sem ficha são as declaradas inexistentes (§3.7) |
| Todo fluxo percorrível só com as telas do inventário | **Atendido** | Matriz fluxo × tela ao fim de `FLUXOS.md`; toda referência resolve |
| Nenhum termo fora do glossário | **Atendido** | Varredura limpa após a correção de `locale` |
| Revisão `critic` (fidelidade à ontologia) | **Executada** | REJEITADO com 9 achados; todos corrigidos (§3.1) |
| Revisão `flow-critic` (fluxos sem beco sem saída) | **Executada** | REJEITADO com 20 achados; todos corrigidos (§3.2) |
| `RELATORIO.md` escrito | **Atendido** | este documento |

---

## 5. Decisões que a Fase 2 tomou e que a Fase 3 herda

Sete decisões de interface que não estavam no PRD e que a fundação técnica vai assumir:

1. **A rota é a mesma para Tarefa e Subtarefa** (`/estrutura/tarefas/[tarefa]`) — Subtarefa não é entidade distinta (B1). O store não pode ter tipo `Subtask`.
2. **Pasta e Subpasta compartilham a tela** (`/estrutura/pastas/[pasta]`), e é a tela que decide o que oferecer pelo Nível (A3.4).
3. **Quinze operações são diálogos com endereço próprio**, não menus inline — porque são bloqueantes e exigem entrada de dados antes de qualquer efeito. A fundação precisa de rotas paralelas para elas.
4. **Selo de estado e marcador de condição derivada são componentes diferentes.** Confundi-los é defeito, não estilo (§2 dos padrões).
5. **Nenhuma tela exibe Proprietário onde a ontologia não o prevê.** A fundação deve tipar isso: `Proprietário` só existe nas nove entidades de A7.
6. **Filtros do CRM são estado de sessão, não Visualização gravada** — o CRM não tem contêiner onde uma Visualização possa morar (A8, registrado em pendências A4).
7. **A regra de navegação pós-criação é única** (§20), com três casos declarados. Sem ela, a Fase 6 improvisaria caso a caso.

---

## 6. O que a Fase 3 precisa decidir antes de começar

Um item, registrado em `docs/PENDENCIAS-FRONTEND.md` §C:

**C32 — rebaixar a base Convidado um Membro que é Proprietário de registros.** A ontologia proíbe *designar* Proprietário ou Sucessor com base Convidado, mas não diz o que acontece quando um Membro que já é Proprietário passa a ter Papel de base Convidado. Nesta fase, a interface **avisa e permite prosseguir**, sem bloquear nem transferir. A escolha entre as três alternativas da constituição (rejeitar o rebaixamento; exigir transferência no mesmo ato; admitir Proprietário de base Convidado) altera B28 e a tabela de propriedade da matriz — é decisão de produto e precisa estar tomada quando o store passar a validar transições de Papel.

---

## 7. Aprovação

Esta fase termina com a leitura deste relatório e dos cinco entregáveis. A **Fase 3 — Fundação do Frontend** não começa antes de "fase 2 aprovada".
