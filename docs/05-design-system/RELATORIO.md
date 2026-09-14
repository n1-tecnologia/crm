# Relatório — Fase 5

**Pergunta da fase:** qual identidade visual as telas terão e quais componentes garantem consistência?

**Resposta:** Direção A, "Papel técnico" — e a consistência não vem de disciplina, vem de estrutura: nenhum componente escreve uma cor, e o contraste é verificado por teste que lê os valores do próprio `tokens.css`.

---

## 1. Entregue

| Item | Onde |
| --- | --- |
| Duas direções, uma escolhida | `docs/05-design-system/DIRECAO-VISUAL.md` |
| Tokens, claro e escuro | `app/src/design/tokens.css` |
| 17 componentes base | `app/src/design/components.tsx` |
| Documentação dos componentes | `docs/05-design-system/COMPONENTES.md` |
| Página de amostra | `/design` — com alternador de tema e a Lista real do seed |
| Teste de contraste e de disciplina | `app/src/design/tokens.test.ts` — 30 casos, 73 asserções |

**Nome provisório declarado: Auton.** Nenhuma marca foi fornecida; o nome já existia no repositório (`app/package.json:2`). É marcador, não decisão de marca.

---

## 2. A escolha, e por que não foi de gosto

A Direção B era mais bonita e mais moderna. Perdeu por um motivo estrutural: o acento teal `#0D9488` colide com o verde de `concluido` e de `ganho`.

**Neste produto a cor é vocabulário.** Há quatro sistemas semânticos simultâneos numa mesma tela — categoria de Status, situação de Negócio, estado de Conversa e estado de Execução — mais os estados de ciclo de vida. São ~20 cores com obrigação de serem distinguíveis. Um acento de marca que se parece com um significado não é questão de preferência: é defeito.

O índigo da Direção A não se confunde com nenhuma delas.

Da Direção B veio uma correção real: o fundo `#FAFAF9` contra a superfície `#FFFFFF` diferia em 1%, invisível. Adotado o contraste de superfície da B mantendo o neutro quente da A — e **foi exatamente essa troca que produziu o pior defeito da fase** (§3).

---

## 3. A revisão

`critic` com foco em acessibilidade e consistência: **REJEITADO**, 15 achados. Todos corrigidos.

### O achado que define a fase

**`--cor-papel` mudou de `#fafaf9` para `#f5f5f4` na §4 da direção visual, e os números de contraste nunca foram refeitos.**

`--cor-tinta-fraca: #78716c` dava 4,59:1 sobre o papel antigo — aprovado. Sobre o papel novo dá **4,398:1** — reprovado. E é o token de todo rótulo de campo, toda dica, todo cabeçalho de tabela, todo carimbo de tempo.

Pior: o comentário na própria linha do token e dois parágrafos da documentação **afirmavam 4,6:1**. O número certo de um papel que já não existia.

Corrigido para `#6b6560` (5,27:1). Mas a correção do valor não era o ponto — o ponto é que nada teria pego isso. Por isso a fase ganhou `tokens.test.ts`, que **lê os hex do `tokens.css` de verdade** e reprova qualquer par abaixo de AA, nos dois temas, inclusive no hover. Trinta casos, 73 asserções. Mudar um token e quebrar o contraste agora falha o build, não a leitura de alguém.

### Quatro literais de cor que ignoravam o tema inteiro

O documento afirmava "nenhum componente escreve uma cor". Quatro escreviam:

- `text-white` no botão perigoso — no escuro, `--cor-perigo` é rosa claro: branco sobre ele dá **1,90:1**. O botão que confirma toda ação destrutiva do produto ficava ilegível.
- `text-white` no `ActorAvatar` — as iniciais sumiam em **5 de 10 combinações**.
- `bg-black/25` e `bg-black/30` nas cortinas dos diálogos.

Os dois primeiros viraram tokens de tinta que invertem com o tema (`--cor-perigo-texto-contraste`, `--cor-ator-texto`); as cortinas viraram `--cor-cortina`. O teste agora falha se qualquer hex, `rgb()` ou cor nomeada do Tailwind reaparecer no arquivo.

### ARIA que mentia

Três casos em que o atributo prometia o que o código não fazia:

**`aria-modal="true"` sem gestão de foco.** O leitor de tela ouve "isolado" e o cursor caminha direto para a página atrás. Agora `useModal` traz o foco para dentro ao abrir, prende o Tab, e devolve o foco a quem abriu ao fechar.

**`role="listbox"` com `role="option"` dentro de um `li` sem `role="none"`.** A relação entre a lista e suas opções se quebra, e o leitor anuncia uma caixa de listagem sem opções válidas. E a documentação prometia navegação por setas que **não existia em lugar nenhum do projeto** — agora existe: `↓`/`↑`, `Home`/`End`, `Enter`, `Escape`, com `aria-activedescendant` e `role="combobox"` no gatilho.

**`disabled` no Status atual do `StatusPicker`.** Um botão nativamente desabilitado não recebe foco, então o `aria-pressed="true"` que marcava a seleção nunca chegava a ninguém: para quem não vê a cor, a seleção era invisível. Agora o item atual fica inerte por `aria-disabled`, e continua alcançável.

### O motivo do desabilitado só chegava ao mouse

`disabledReason` vivia só no `title`. Um `<button disabled>` não recebe foco e não anuncia `title` — o padrão §11 ("sempre diz por quê") valia para metade dos usuários.

Agora o botão desabilitado continua focável por `aria-disabled`, o clique é engolido, e o texto vai num `aria-describedby`. O mesmo motivo, para todo mundo.

### Os demais, em uma linha cada

- **`MultiSelect` não aceitava `id`** — o `htmlFor` do `Field` apontava para o vazio. Provado no HTML servido; o documento afirmava "o `htmlFor` nunca se desalinha".
- **`--cor-tinta-tenue` como texto real** (nome do Status bloqueado, placeholder): 2,41:1. Passou a ser não-textual por definição, e o teste proíbe usá-lo como texto.
- **`${color}1f`** virava `var(--cor-dom-crm)1f`, inválido — o Chip perdia o fundo justamente quando recebia um token. Trocado por `color-mix`.
- **`<tr onClick>`** só respondia ao mouse. Agora recebe foco e `Enter`.
- **Fundo do selo `rascunho` idêntico à superfície** — o selo não tinha preenchimento nenhum. O teste agora exige que todo fundo de selo difira do papel e da superfície.
- **Duas afirmações numéricas falsas** nos documentos, corrigidas com os valores medidos.

---

## 4. Uma inconsistência minha, fora da revisão

Eu escrevi o design system com nomes de variante em pt-BR: `primario`, `secundario`, `perigoso`, `fantasma`. Identificador neste projeto é inglês — só o texto visível é pt-BR.

Além de contrariar a regra, o nome errado **travava a migração**: as 52 telas já usavam `primary`/`secondary`/`danger`/`ghost`. Renomeado, a migração virou uma re-exportação em `features/shell/ui.tsx` e nenhuma chamada precisou mudar.

---

## 5. Verificação

```
$ npx tsc --noEmit      → sem saída
$ npx eslint src        → sem saída
$ npx vitest run        → 2 arquivos, 77 testes passando
$ curl /design          → 200
```

Os 77 testes são 47 de operações (Fase 3) mais 30 de tokens e disciplina de componentes (esta fase). As 53 rotas seguem respondendo 200 com dados reais do seed.

---

## 6. O que a Fase 6 encontra pronto

As primitivas de tela (`features/shell/ui.tsx`) já re-exportam o design system, então `Button`, `StateSeal`, `EmptyState`, `ConditionMarker` e companhia já são os componentes reais em todas as 52 telas — sem que nenhuma chamada mudasse.

**O que falta é o corpo das telas:** 702 ocorrências de cor Tailwind fixa em 40 arquivos (`bg-white`, `text-neutral-500`, `bg-amber-50`…). É exatamente o trabalho das etapas 6.1 a 6.5 — e enquanto essas cores existirem, o tema escuro está incompleto fora da `/design`.

Isso não é dívida escondida: é o escopo declarado da próxima fase, e agora há um teste que impede o design system de regredir enquanto ela acontece.
