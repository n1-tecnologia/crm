# Phase 07 — UI Review

**Audited:** 2026-10-11
**Baseline:** `07-UI-SPEC.md` (aprovado em 2026-10-10), incluindo a lista «UI Considerations» e a tabela «Recusas 409»; `07-CONTEXT.md` (D-02, D-04, D-14, D-15); planos e resumos 07-01 (Task 2), 07-06, 07-07, 07-09, 07-10, 07-11
**Screenshots:** não capturadas — nenhum dev server respondeu em `localhost:3000/3001/3002/5173/8080` e o orquestrador proibiu subir um contra o banco da plataforma. **Esta é uma auditoria só de código** (classes, strings, estados), não visual. As quatro janelas `unrun-verify` de `WINDOWS.md` (#1 contatos, #2 empresas, #3 quadro, #4 ficha de Negócio) continuam abertas: nada abaixo substitui a UAT de `07-PROVAS.md`.
**Interaction captures:** off (workflow.ui_interaction_capture is false) — todo achado de interação é derivado do código.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | O vocabulário do contrato (CTAs verbo+substantivo, vazios por aba, confirmações, sucessos) está quase todo literal; sobram 9 desvios pontuais, entre eles um id de regra interna («RN-NEG-11») vazando para a descrição de um diálogo e três Toasts de sucesso com texto fora da tabela |
| 2. Visuals | 2/4 | As seções «Dados» das fichas de Contato, Empresa e Negócio ignoram `RecordPanel`/`RecordRow` (exigidos pela UI-SPEC §3 e pelo 07-06-PLAN) e desenham um `<dl>` próprio com divisórias em `style` inline; há até três botões `primary` disputando o foco numa mesma ficha; dois «Mostrar mais» empilhados nas listas; a coluna recolhível de Empresas é a errada |
| 3. Color | 2/4 | Zero hex no TSX (bom), mas a lista fechada de usos do acento é rompida: `--acento` no ícone de **todo** cartão do quadro, «Roxa» como cor de Funil, e 2–3 `btn-solido` simultâneos por tela quando o contrato diz «um por tela ou diálogo» |
| 4. Typography | 3/4 | Só classes do sistema (nenhum `text-[Npx]`, nenhum `font-*`), mas `.app-md` (peso 500) entra em dois lugares quando o contrato fixa «exatamente dois pesos — 400 e 600» |
| 5. Spacing | 3/4 | `gap-3`/`gap-2`/`p-4` dominam como manda a escala; fora dela: `pr-20` (80px), `space-y-0.5` (2px), `w-20`, larguras literais `22rem`/`12rem`/`9rem`/`6rem` em grids, e o campo de busca com `--controle-h-sm` (32px) abaixo do alvo de toque |
| 6. Experience Design | 3/4 | Carregando/vazio/erro/desabilitado-com-motivo/confirmação/otimista estão cobertos de ponta a ponta; falham o Toast de sucesso perdido na navegação ao criar Contato/Empresa, a ausência de Toast ao criar Funil, o foco pós-criação (§9) não implementado e a regra visual do admin único trocada pela do plano |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Vários `variant="primary"` por tela e acento fora da lista fechada** — o olho não acha a ação principal: na ficha de Contato convivem «Adicionar» (Identificadores), «Salvar endereços» e «Salvar campos adicionais», todos `btn-solido`; na de Negócio, «Salvar dono», «Mover para o Funil» e «Marcar como ganho»; e cada cartão do quadro acende `--acento` no ícone — Rebaixar os botões de seção para `variant="secondary"` (manter primário só «Salvar alterações» do diálogo e «Marcar como ganho»), trocar `RostoDeIcone cor="var(--acento)"` por `var(--texto-3)`/`var(--superficie-3)` em `cartao-de-negocio.tsx:71-72`, e tirar «Roxa» de `CORES_DE_FUNIL` (`formulario-de-funil.tsx:37`).
2. **Feedback de criação perdido** — em `contatos/page.tsx:173-178` e `empresas/page.tsx:240-244` o `setAviso` é seguido de `router.push` na mesma função: a tela desmonta antes de o Toast aparecer; em `funis/page.tsx:141-144` não há Toast nenhum — Usar o padrão que `negocios/page.tsx:131-134` já tem (`marcarChegada(href, "{nome} criado.")` + `lerChegada`/`consumirChegada` na ficha) nas três telas, com a copy da tabela («{nome} criado.» / «{nome} criada.»), e mover o foco para o título da ficha ao chegar (UI-SPEC §9 «após criar, foco no título da ficha»).
3. **Seções «Dados» fora do sistema** — `ficha-de-contato.tsx:143-152`, `ficha-de-empresa.tsx:282-291` e `ficha-de-negocio.tsx:114-123` definem três cópias de `LinhaDeDado` (um `<dl>` com valor alinhado à direita) e cinco listas usam `style={{ borderBottom: "1px solid var(--linha-sutil)" }}` — Substituir por `RecordPanel`/`RecordRow` do barril (como a ficha de Funil e a UI-SPEC §3 fazem) e por um item de lista do sistema (`item-solto`/`pilha-solta`) em vez da divisória inline; de quebra apagar o «(RN-NEG-11)» de `dialogo-de-encerramento.tsx:81`.

---

## Detailed Findings

Classificação: **BLOCKER** = quebra a tarefa do usuário ou pilar 1; **WARNING** = degrada sem quebrar.

### Pillar 1: Copywriting (3/4)

O que bate com o contrato (verificado string a string): CTAs «Novo Contato/Nova Empresa/Novo Funil/Novo Negócio» e «Criar Contato/Criar Empresa/Criar Funil/Criar Negócio» (`formulario-de-*.tsx`); «Salvar alterações» nas edições; descrições dos diálogos Novo Contato, Nova Empresa e Novo Funil literais; os 9 vazios por aba das três listas (`contatos/page.tsx:52-62`, `empresas/page.tsx:61-71`, `funis/page.tsx:34-41`) e os vazios de busca; «Nenhum Negócio nesta Etapa.»; os vazios de Identificadores, Empresas do Contato e Negócios do registro; os 404 das quatro fichas, inclusive o texto próprio do Funil (D-15); as duas confirmações destrutivas com título, descrição e «Enviar para a Lixeira»/«Excluir permanentemente» (`ciclo-de-vida.tsx:120-136`); «Restaurar {nome}» + frase de admin; «Trocar o admin de {Empresa}»; «Remover a Etapa “{nome}”?» + «Remapear e remover»; «Migrar Negócios de “{Funil}”»; «Marcar como ganho/perdido», «Reabrir Negócio»; «Negócio marcado como ganho/perdido.», «Negócio reaberto.»; «{N} Negócios migrados/remapeados…» com plural real; «{Funil} é o Funil padrão.»; «Só Administrador e Proprietário alteram Funis e Etapas.»; nota de D-10 sobre «privado»; «Eu (quem cria)»; os quatro rótulos de `MensagemDeRecusa` e «e outros N» (`ciclo-de-vida.tsx:188-223`). Nenhuma palavra proibida de D-02 fora de comentários (grep em 29 arquivos). Nenhum `window.alert/confirm`. Nenhum «Salvar», «OK», «Enviar» genérico como CTA de diálogo.

Desvios:

- **WARNING** `dialogo-de-encerramento.tsx:81` — descrição do modo Reabrir termina em «…são limpos (RN-NEG-11).»: id de regra de negócio exposto ao usuário. Remover o parêntese.
- **WARNING** `empresas/page.tsx:242` — Toast «Empresa criada.» em vez de «{nome de exibição} criada.» da tabela «Mensagens de sucesso» (Contatos faz certo em `contatos/page.tsx:176`).
- **WARNING** `funis/page.tsx:141-144` — nenhum Toast de criação (contrato: «{nome} criado.» + ir para a ficha).
- **WARNING** `negocios/page.tsx:72` — vazio «sem Funil ativo» usa «Um Negócio existe sempre dentro de um Funil e de uma Etapa: crie um Funil primeiro.» em vez de «Crie um Funil para começar a acompanhar Negócios.».
- **WARNING** `quadro-do-funil.tsx:333` — faixa de encerrados vazia diz «Nenhum Negócio ganho ou perdido neste Funil.»; contrato: «Nenhum Negócio encerrado neste Funil.».
- **WARNING** `negocios/page.tsx:93-96` — totais «{valor} em valor declarado» / «{valor} ponderado pela probabilidade»; contrato §4: «{valor declarado} declarado · {valor ponderado} ponderado».
- **WARNING** `formulario-de-negocio.tsx:323` — descrição do Novo Negócio reescrita («O Negócio nasce numa Etapa do Funil escolhido — a inicial, por padrão — e pertence a uma Empresa ou a um Contato.»); contrato: «Todo Negócio é de uma Empresa ou de um Contato, e fica numa Etapa do Funil.».
- **WARNING** `vinculos-da-empresa.tsx:158` — «{Contato} agora administra {Empresa}.»; contrato: «O admin de {Empresa} agora é {Contato}.».
- **WARNING** `ficha-de-contato.tsx:255-257`, `ficha-de-empresa.tsx:395-397`, `etapas-do-funil.tsx:238-240` — botão primário rotulado só «Adicionar» (o checker da UI-SPEC já tinha marcado «ações de uma palavra»); «Adicionar Identificador»/«Adicionar Etapa» já é o rótulo do botão que abre o painel, então o de confirmação pode ser «Salvar Identificador»/«Salvar Etapa».
- **WARNING** `remove-stage-dialog.tsx:153` — `hint` «Sem mapeamento por nome nem por posição: a escolha é explícita.» é raciocínio de implementação, não instrução ao usuário.
- Nota: o fallback genérico «Não foi possível concluir a ação. Tente de novo.» (8 ocorrências) cobre o caso sem `ErroDeApi.message`; o contrato pedia o verbo específico («Não foi possível salvar as alterações…»). Aceitável como rede, mas não é o texto da tabela.

### Pillar 2: Visuals (2/4)

Sem screenshot, a hierarquia foi inferida da composição. O esqueleto de tela (`PageHeader` + `CorpoDeTela`, um `Toast` por vez no topo) está correto nas 8 páginas; `StateSeal` + `Pilula` da situação no cabeçalho; todo controle só de ícone tem nome (`ActionMenu label`, `SetaDeOrdem motivo`, lupa decorativa com `pointer-events-none`, `span aria-hidden` reservando o canto do menu — 9 `aria-label/sr-only` nos arquivos novos). Linha inteira clicável nas listas; `truncate` + `title` nos nomes.

- **WARNING** (espec. §3 e 07-06-PLAN:200) `ficha-de-contato.tsx:143-152,463-474`, `ficha-de-empresa.tsx:282-291,612-620`, `ficha-de-negocio.tsx:114-123,769-789` — «Dados» em `Painel` + `<dl>` próprio (`LinhaDeDado`, valor `text-right`) em vez de `RecordPanel`/`RecordRow`. Só a ficha de Funil usa `RecordPanel`. Três fichas da mesma fase com dois desenhos de painel de leitura.
- **WARNING** 5 listas (`ficha-de-contato.tsx:189,360`, `ficha-de-empresa.tsx:330`, `vinculos-da-empresa.tsx:81`, `negocios-do-registro.tsx:59`) desenham a divisória com `style={{ borderBottom: "1px solid var(--linha-sutil)" }}` — o sistema tem `item-solto`/`pilha-solta` (usados em `etapas-do-funil.tsx:716,916`); são dois vocabulários de lista na mesma ficha.
- **WARNING** Foco visual diluído: ficha de Contato com até 3 `variant="primary"` ao mesmo tempo (ver pilar 3); ficha de Negócio com «Salvar dono», «Mover para o Funil» e «Marcar como ganho» todos sólidos.
- **WARNING** `contatos/page.tsx:240-246`, `empresas/page.tsx:304-310`, `funis/page.tsx:195-201` — dois «Mostrar mais» empilhados: o do `RecordList` (fatia de 25, `record-list.tsx:35,123`) e o da página (busca +50 no servidor). Já registrado no 07-06-SUMMARY como «candidato para um plano de acabamento», ainda aberto.
- **WARNING** `empresas/page.tsx:297` — a coluna que some em tela estreita (`hidden @6xl:table-cell`) é «Documento»; o contrato §1 manda recolher «Empresa matriz». Em Contatos (`:232`, Telefone) e Funis (`:188`, Negócios abertos) está certo.
- **WARNING** `ficha-de-funil.tsx:230` — `xl:grid-cols-[minmax(0,1fr)_22rem]` largura literal nova para o painel de atributos; o contrato pede o xl (32px) entre os blocos e nenhuma largura literal nova.
- Nota: `quadro-do-funil.tsx:360-370` sobrepõe o botão «Reabrir» (`absolute right-2 top-2`) a um `Link` com `pr-20` reservando espaço — funciona, mas é o mesmo truque do cartão repetido à mão; sem browser não dá para afirmar que não colide com o título longo truncado.

### Pillar 3: Color (2/4)

Contagens nos 29 arquivos: hex/rgb literais = **0**; `var(--acento)` = 3 ocorrências diretas; `var(--texto)` 12, `var(--texto-3)` 6, `var(--texto-4)` 3, `var(--erro)` 3, `var(--aviso)` 3, `var(--cor-neg-aberto/ganho/perdido)` 8, `var(--info)` 2, `var(--sucesso)` 2. `npm run verificar:tokens` passa segundo os resumos. Situação do Negócio sempre com texto junto («Aberto/Ganho/Perdido»), `perdido` em `--cor-neg-perdido` (não vermelho), links de `MensagemDeRecusa` em `--texto` sublinhado — tudo conforme.

- **WARNING** `cartao-de-negocio.tsx:69-73` — `RostoDeIcone cor="var(--acento)" lavado="var(--acento-lavado)"` em **cada** cartão do quadro. A lista fechada «Accent reserved for» tem 4 itens (botão primário, aba ativa, selo de contagem da coluna, ícone marcado do Select/anel de foco); um quadro com 30 cartões vira 30 pontos roxos, e o selo de contagem da coluna (item 3 da lista) deixa de se destacar.
- **WARNING** Regra «botão primário — um por tela ou diálogo» rompida: `ficha-de-contato.tsx:256,300,341` (Adicionar + Salvar endereços + Salvar campos adicionais), `ficha-de-empresa.tsx:395,440,481` (idem), `ficha-de-negocio.tsx:430,577,615` (Salvar dono + Mover para o Funil + Marcar como ganho), `etapas-do-funil.tsx:238` + `ficha-de-funil.tsx:105` (Adicionar + Salvar alterações, lado a lado).
- **WARNING** `formulario-de-funil.tsx:37` — opção «Roxa» = `var(--acento)` como cor de Funil/Etapa; a cor de Etapa alimenta `ColunaDeQuadro` e `Pilula`, então um Funil roxo pinta cabeçalhos de coluna com a cor do acento do sistema. Trocar por um token de dado (há 5 outras cores) ou retirar a opção.
- Nota: `remove-stage-dialog.tsx:174` e `ficha-de-negocio.tsx:296` montam uma caixa de aviso/erro à mão (`rounded-[var(--r-controle)]` + `--aviso-lavado`/`--erro-lavado`) em vez de `Toast`/`Field error`; tokens certos, componente errado.

### Pillar 4: Typography (3/4)

Classes Tailwind de tamanho (`text-xs…text-5xl`) = **0**; `font-*` = **0**; `fontSize`/`fontWeight` inline = **0**. Classes do sistema: `app-meta` 30, `app-base` 26, `app-numero` 9 (totais, valores, probabilidades, contagens — como pede o contrato), `app-sm` 2, `app-md` 2, `rotulo` (legend) 1. Títulos de diálogo e de tela vêm dos componentes (`ed-subtitulo`, `PageHeader`).

- **WARNING** `etapas-do-funil.tsx:131` e `quadro-do-funil.tsx:345` — `.app-md` tem `font-weight: 500` (`tipografia.css:94-98`): terceiro peso numa fase que declara «exatamente dois — 400 e 600». Usar `app-base` (400) ou a classe de 600 que o cartão já usa para título.
- **WARNING** `negocios/page.tsx:104` — rótulo «Funil» do `Select` no cabeçalho em `app-sm` + `--texto-3`; o contrato manda `.rotulo` para rótulo de campo (o `Field` faria isso sozinho).
- Nota: o checker já havia marcado 11/12/13px «muito próximos»; a ficha de Etapa (`etapas-do-funil.tsx:137-148,175`) coloca `app-meta` (11px) e `app-sm` (12px) na mesma linha com `app-numero` — sem screenshot não dá para afirmar que a diferença se percebe.

### Pillar 5: Spacing (3/4)

Distribuição (29 arquivos): `gap-3` 34, `gap-2` 22, `py-2` 14, `p-4` 12, `py-1` 9, `px-4` 9, `mt-3` 8, `gap-1` 8, `py-3` 6 — a escala md/sm/xs do contrato. Formulários em `grid gap-3 sm:grid-cols-2` (Contato, Empresa, Negócio) como §2; `pilha-solta`/`gap-3` entre cartões; `mt-6` (24px) entre quadro e faixa de encerrados (lg, ok). `Button` do sistema carrega `alvo-toque`.

- **WARNING** `quadro-do-funil.tsx:344` — `pr-20` (80px) fora da escala; `remove-stage-dialog.tsx:140` e `migrate-funnel-dialog.tsx:173` — `space-y-0.5` (2px) fora da escala; `etapas-do-funil.tsx:142` — `w-20` para o campo de probabilidade.
- **WARNING** Larguras literais em grids: `sm:grid-cols-[12rem_1fr_auto]` (`ficha-de-contato.tsx:242`), `[12rem_1fr_6rem_auto]` (`ficha-de-empresa.tsx:376`), `[minmax(0,1fr)_9rem_auto]` (`formulario-de-funil.tsx:164`), `[minmax(0,1fr)_9rem_9rem_auto]` (`etapas-do-funil.tsx:227`), `_22rem` (`ficha-de-funil.tsx:230`), `min-w-56`/`w-48`/`min-w-32`. O contrato lista como exceções só a coluna de 19.2rem do quadro e as larguras de modal por token.
- **WARNING** `contatos/page.tsx:200` e `empresas/page.tsx:266` — campo de busca com `style={{ height: "var(--controle-h-sm)" }}` (32px, `tokens.css:244`) e sem `alvo-toque`; o contrato fixa 44px como alvo mínimo em todo controle das telas novas. Os outros campos de busca (`seletor-de-registro.tsx:213`) usam `campo alvo-toque`.
- Nota: `ListaDeLinks` em `MensagemDeRecusa` (`ciclo-de-vida.tsx:143-146`) usa `mt-2`/`mt-1` sem lista do sistema — pequeno, mas é o único lugar com `ul` nu dentro de um `Toast`.

### Pillar 6: Experience Design (3/4)

Cobertura de estados (código): **carregando** — `EsqueletoDeLinhas` 6 nas listas e no quadro, 8 nas fichas, 3 na seção Negócios; `confirmDisabledReason="Gravando …"` em todos os diálogos; «Buscando…» no seletor sem piscar vazio. **Erro** — `EmptyState` «Não foi possível carregar/abrir …» com `ErroDeApi.message` nas 8 páginas; 404 das fichas tratado antes do cache (D-15 com recuo para `FichaDeContatoLegado`/`FichaDeEmpresaLegado`/`DealScreen`); recusas 409 por `MensagemDeRecusa` com links e `acao` («Migrar Negócios», «Remapear Negócios», «Trocar admin», «Ir para Funis»); erros de domínio no `Field` antes do fetch; `FUNIL_NOME_EM_USO`/`MATRIZ_INVALIDA`/`NEGOCIO_EXIGE_*` caem no campo com o diálogo aberto. **Vazio** — todas as superfícies da tabela, colunas vazias renderizadas com `VazioDaColuna` e «+». **Desabilitado** — `disabledReason` em todo botão que pode desligar (Papel D-14, «Nada para salvar.», «Um Funil precisa de ao menos uma Etapa.», «Este Funil não tem Negócios.», RN-NEG-10). **Destrutivo** — `ConfirmDialog destructive` para Lixeira/permanente/Remapear/Perder; Arquivar sem confirmação (D-06). **Otimista** — só no mover do quadro, com reversão por `lista.mutate()` na recusa e 60% de opacidade no arraste; «Mover para {Etapa}» no menu como alternativa de teclado (WCAG 2.5.7). **Limite** — «Mostrando N de M» na coluna e na seção Negócios. Erro `Toast` não expira (componente). Tudo isso só por teste de componente — as janelas #1–#4 seguem abertas.

- **WARNING** `contatos/page.tsx:173-178`, `empresas/page.tsx:240-244` — `setAviso(...)` seguido de `router.push(...)` na mesma função: o Toast de sucesso nunca é visto (a tela que o montaria desmonta). `negocios/page.tsx:131-134` resolve com `marcarChegada`; os outros dois não.
- **WARNING** `funis/page.tsx:141-144` — criar Funil não dá feedback nenhum além da navegação.
- **WARNING** UI-SPEC §9 «após criar, foco no título da ficha» — nenhuma ficha (`ficha-de-*.tsx`) move o foco ou usa `tabIndex={-1}`/`autoFocus` no título; o foco cai no `body` após o `router.push`.
- **WARNING** (desvio registrado no 07-09-SUMMARY, item 1) `vinculos-da-empresa.tsx:104,111` — o `Toggle` «Admin» e o «Encerrar» do único admin ficam **habilitados** e recusam no clique com a frase + «Trocar admin»; a UI-SPEC («Regra visual do admin», D-08) pede os dois **desabilitados com `disabledReason`** «Indique o novo admin antes de retirar o último.». O executor seguiu o plano, mas o contrato aprovado é o outro. Decidir num lugar só (UI-SPEC ou plano) e alinhar.
- **WARNING** `formulario-de-contato.tsx:192-233` e `formulario-de-negocio.tsx:342-420` — ordem de campos diverge do contrato §2: Contato põe «Descrição» por último (contrato: antes de Origem) e Negócio põe «Origem» em 3.º e «Descrição» por último (contrato: Título · Objeto · Descrição · … · Origem · Proprietário). Não quebra nada, mas a UAT vai comparar com a tabela.
- **WARNING** `seletor-de-registro.tsx:140-146` — `Escape` com a lista aberta faz `stopPropagation`, então a primeira tecla fecha só a lista e a segunda o diálogo (esperado); mas `onBlur={() => setAberto(false)}` (`:210`) sem `relatedTarget` significa que um toque fora, em mobile, fecha a lista antes do `onClick` do item — o `onMouseDown preventDefault` (`:179`) cobre mouse, não toque. Verificar na UAT em 375px.
- Nota positiva: `AcoesDeCicloDeVida` nunca some sem permissão (desabilita com motivo) nas fichas e some na lista, exatamente como §1/§3 pedem; «Novo …» some para quem não cria.

### Considerações de UI (sonda E1–E12)

Das 29 `backstop` do contrato, as que o código resolve: E5-loading (cartão só nasce com dado), E7-overflow (ConfirmDialog rola), E9-loading (ficha inteira em esqueleto), E10-empty (`quadro-do-funil.tsx:333`, copy fora da tabela), E10-loading/error (herdados do quadro), E8-empty («Digite para buscar.»/«Nenhum resultado.»), E8-error (frase da api na lista, `seletor-de-registro.tsx:164-166`), E8-partial (desempate opcional). Continuam sem evidência cabeada (só UAT): E3/E8/E10/E11 zero-one-many, E5/E7/E8/E9/E10/E12 long-text, E5/E9/E10/E12 overflow, E4/E8/E9/E10/E11 partial. O verificador deve rotear estas para `human_needed`, como o contrato prevê.

### Registry Safety

Registry audit: shadcn não inicializado (`components.json` ausente na raiz e em `apps/web`; UI-SPEC `shadcn_initialized: false`, nenhum registro de terceiros) — auditoria de registro não se aplica.

---

## Files Audited

Páginas (`apps/web/src/app/(shell)/crm/`):
- `contatos/page.tsx`, `contatos/[contato]/page.tsx`
- `empresas/page.tsx`, `empresas/[empresa]/page.tsx` (lido pelo resumo 07-09; mesma forma de `[contato]`)
- `funis/page.tsx`, `funis/[funil]/page.tsx` (idem)
- `negocios/page.tsx`, `negocios/[negocio]/page.tsx`

Componentes (`apps/web/src/features/crm/`):
- `ciclo-de-vida.tsx`, `seletor-de-proprietario.tsx`, `seletor-de-registro.tsx`
- `formulario-de-contato.tsx`, `ficha-de-contato.tsx`, `editor-de-enderecos.tsx`, `editor-de-campos-adicionais.tsx`
- `formulario-de-empresa.tsx`, `ficha-de-empresa.tsx`, `vinculos-da-empresa.tsx`
- `formulario-de-funil.tsx`, `ficha-de-funil.tsx`, `etapas-do-funil.tsx`, `remove-stage-dialog.tsx`, `migrate-funnel-dialog.tsx`
- `quadro-do-funil.tsx`, `cartao-de-negocio.tsx`, `dialogo-de-encerramento.tsx`, `formulario-de-negocio.tsx`, `ficha-de-negocio.tsx`, `negocios-do-registro.tsx`

Sistema consultado para conferência (não auditado): `design/components.tsx` (Button, Field, Toast, ConfirmDialog, RecordPanel/RecordRow), `design/basicos.tsx` (Pilula, Abas, Painel), `features/shell/ui.tsx`, `features/shell/record-list.tsx`, `features/shell/quadro.tsx`, `estilos/tokens.css`, `estilos/tipografia.css`, `estilos/controles.css`.

Contrato e contexto: `07-UI-SPEC.md`, `07-CONTEXT.md`, `07-01`/`07-06`/`07-07`/`07-09`/`07-10`/`07-11` PLAN e SUMMARY, demais SUMMARY da fase (backend, sem superfície web), `.planning/WINDOWS.md`.
