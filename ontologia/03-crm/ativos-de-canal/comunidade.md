# COMUNIDADE

> Domínio: CRM — Ativos de Canal | Documento 25 de 25 | Status: RASCUNHO | Versão da ontologia: 1.1-proposta | Depende de: 22, 24, 14

## 1. Definição ontológica

**Comunidade** é o Ativo de Canal **administrado** que espelha uma comunidade do provedor: um agregado nomeado de Grupos, com um **Grupo de avisos** criado e mantido pelo próprio provedor, no qual só administradores publicam e todos os membros de todos os Grupos leem. A Comunidade não contém pessoas diretamente: contém Grupos por **referência** (o provedor permite vincular e desvincular grupos existentes), e as pessoas estão nas Participações de cada Grupo — inclusive as do Grupo de avisos, que o provedor preenche automaticamente com os membros dos demais.

Três propriedades:

1. **É agregado por referência, não contenção.** Um Grupo pode entrar e sair de uma Comunidade sem perder identidade, histórico ou Participações (RN-COM-02). Eliminar a Comunidade na plataforma não elimina Grupos (INV-COM-01); dissolvê-la no provedor (Ferramenta `sair da Comunidade` como único administrador) desvincula os grupos no provedor, e a Sincronização reflete.
2. **Tem um Grupo especial.** O Grupo de avisos é um Grupo (documento 24) com Papel na Comunidade `avisos`: não admite captação nem entrada direta (INV-GRP-06); é o alvo de "enviar Mensagem à Comunidade" (RN-COM-05).
3. **Herda do provedor, não da plataforma.** Configurações da Comunidade (quem adiciona grupos, quem adiciona membros) valem no provedor para os Grupos; a plataforma as espelha na Comunidade e não as replica nos Grupos (16).

## 2. Propósito

1. Governar a estrutura "uma marca, muitos grupos" como um registro: quantos Grupos, quantos membros no total, qual o Grupo de avisos, quem administra.
2. Comunicar a todos de uma vez pelo Grupo de avisos, com o mesmo controle de Mensagem, Registro e Consentimento.
3. Ser escopo de Automação e Fonte de Dados que alcançam todos os seus Grupos por referência ("Contato entrou em qualquer Grupo da Comunidade").
4. Vincular e desvincular Grupos como ato registrado, em vez de "arrastar no celular".

## 3. Natureza da entidade

Entidade com identidade própria, contida pelo Espaço de Trabalho; Recurso; Fonte de Dados; escopo de Automação (B114); sem Proprietário (22, 10); não é Ator; não é contêiner (não contém Grupos — os referencia). Sem entidades internas próprias além dos objetos de valor comuns (Sincronização) e de **Configurações da Comunidade** (objeto de valor espelhado).

## 4. Fronteira conceitual

**É**: espelho governado de uma comunidade do provedor; conjunto referenciado de Grupos; dono lógico do Grupo de avisos; escopo agregador.

**Não é**: Grupo (a Comunidade não tem Participações próprias; "membros da Comunidade" é derivado da união das Participações vigentes dos seus Grupos — RN-COM-06); pasta ou Tag de Grupos (a Comunidade existe no provedor; a Tag não); Espaço/Pasta da Estrutura (não contém Tarefas, não herda permissão); Canal; Campanha; Conversa (o Grupo de avisos tem a sua Conversa de grupo como qualquer Grupo).

**Comparações**: Empresa matriz/filial (B51) — hierarquia estrutural sem contenção nem herança; a Comunidade → Grupo é análoga, com um nível só. Tag (B5) — agrupa sem existir no provedor; a Comunidade agrupa **e** existe no provedor: mudar a Tag é ato da plataforma; mudar a Comunidade é Ferramenta com efeito externo.

## 5. Identidade

Identificador imutável, opaco, da plataforma; **Identificador externo** (identificador da comunidade no provedor) obrigatório, único por INV-ATV-01.

**Teste de identidade.** Renomear, trocar foto, vincular/desvincular todos os Grupos, trocar o Canal administrador, arquivar e restaurar: mesma Comunidade. O Grupo de avisos é sempre o mesmo Grupo (identidade própria no documento 24) enquanto o provedor o mantiver; se o provedor recriar o grupo de avisos (não previsto), aplica-se 24, 20.9.

## 6. Atributos fundamentais

| Atributo | Natureza | Espelhado? | Obrigatório | Descrição |
| --- | --- | --- | --- | --- |
| Atributos comuns (22, 6) | — | — | — | Identificador, ET, Tipo de Canal, Identificador externo, Nome, Canal administrador (0..1), ciclo de vida, Sincronização, Criador, Origem de criação, Tags, Valores de Campo, Vínculos, Comentários. |
| Nome | nativo | sim | sim | Limite do provedor. RN-ATV-07 para divergência. |
| Descrição | nativo | sim | não | Limite do provedor (2 048). |
| Foto | referência (Arquivo) | sim | não | — |
| Configurações da Comunidade | objeto de valor | sim | sim | `somente administradores adicionam Grupos`, `somente administradores adicionam participantes` (catálogo fixo pela Capacidade). |
| Grupos | referência 0..N (Grupo) | sim | — | Grupos `ativo` ou `arquivado` do mesmo Tipo de Canal e Espaço de Trabalho; cada Grupo referencia de volta a Comunidade e o seu Papel na Comunidade (`comum`/`avisos`). A lista é espelhada: vincular/desvincular é Ferramenta; a Sincronização reconcilia. |
| Grupo de avisos | derivado | — | — | O único Grupo com Papel `avisos`; existe sempre que a Comunidade está `sincronizado` (INV-COM-02). Criado pelo provedor com a Comunidade; a plataforma o importa como Grupo (24) na mesma Sincronização. |
| Papel do Canal | derivado da Sincronização | sim | — | `administrador`, `participante`, `ausente`. |
| Membros; Grupos vinculados; Ocupação agregada | derivados | — | — | União das Participações vigentes (um Contato conta uma vez — RN-COM-06); contagem de Grupos `comum`; soma de vigentes / soma de Capacidades. |
| Limite de Grupos do provedor | nativo | sim | sim | Quantidade máxima de grupos que o provedor admite por comunidade (à época: 100 incluindo o de avisos); informado pelo provedor ou Limite imposto. |

## 7. Entidades internas ou componentes

### 7.1 Configurações da Comunidade (objeto de valor espelhado)
Definido em 6. Alterar é Ferramenta `alterar Configurações` (classe `externa`) — exige Papel do Canal `administrador`.

### 7.2 Vínculo Comunidade–Grupo (relação espelhada, sem identidade)
Par (Comunidade, Grupo) com Papel na Comunidade e momento de vinculação (do provedor quando entregue; senão `estimado`). Não é Vínculo de A8 (não é associação livre da plataforma; é fato do provedor). Desvincular encerra o par; o histórico fica nos Registros de Atividade ("Grupo desvinculado da Comunidade").

### 7.3 O que não é componente
Participações (são dos Grupos); Mensagens (na Conversa de grupo do Grupo de avisos); Link de Captação (referencia Grupos `comum`, nunca a Comunidade — RN-COM-07); "comentários de membros no grupo de avisos" (são Mensagens `recebida` na Conversa do Grupo de avisos; removê-los é Automação — 24, 20.8).

## 8. Relações

| Relação | Cardinalidade | Tipo | Efeito de remoção |
| --- | --- | --- | --- |
| Comunidade → Grupo | 0..N (um `avisos`) | referência espelhada (7.2) | Comunidade eliminada na plataforma ⇒ Grupos permanecem com a referência limpa e Registro (o provedor não muda — INV-ATV-05); Grupo eliminado ⇒ sai da lista com Registro. |
| Comunidade → Canal administrador | 0..1 | referência mutável (22) | — |
| Comunidade → Contato | derivado | via Participações dos Grupos | — |
| Automação → Comunidade | 0..N | escopo (alcança os Grupos por referência — B114); Gatilhos "Grupo vinculado/desvinculado", "Contato entrou em Grupo da Comunidade" (derivado) | B41 |
| Painel → Comunidade | — | escopo de Fonte de Dados sobre Grupo/Participação (B115) | — |
| Comunidade ↔ Negócio, Empresa, Tarefa | 0..N | Vínculo (B113) | remove o Vínculo. |
| Comunidade ↔ Conversa | não há | — | A Comunidade não tem Conversa; o Grupo de avisos tem. |

## 9. Cardinalidades

Comunidade: 0..N Grupos `comum`; exatamente 1 Grupo `avisos` quando sincronizada; 0..1 Canal administrador. Grupo: 0..1 Comunidade (INV-GRP: um grupo não está em duas comunidades no provedor).

## 10. Hierarquia, pertencimento e propriedade

Contida pelo Espaço de Trabalho; sem Proprietário; Comunidade → Grupo é referência espelhada, sem contenção, sem herança de permissão (quem vê a Comunidade não vê por isso os Grupos — cada Grupo é Recurso próprio; o produto pode conceder em lote). `administrar` por Papel, concessão ou Canal (DO-ATV-05).

## 11. Estados

**Ciclo de vida** (A4.1): `ativo`, `arquivado` (deixa de ser administrada; os Grupos continuam `ativo` com a referência mantida e marcador "Comunidade arquivada"), `na lixeira`.

**Estado de sincronização** (22, 11). `sem privilégio` (Canal participante) permite só `sincronizar` e `sair`.

**Derivados**: `sem Grupo de avisos` (Sincronização não o encontrou — inconsistência do espelho, Evento), `no limite de Grupos` (Grupos vinculados = Limite do provedor).

## 12. Ciclo de vida

### 12.1 Criação
- **Importação** (22, 12.1): o Canal lê as comunidades de que participa; para cada uma cria a Comunidade e importa os Grupos vinculados que ainda não existam (inclusive o de avisos) na mesma operação, definindo o Papel na Comunidade. Grupos já existentes na plataforma ganham a referência.
- **Criação pela plataforma**: Ferramenta `criar Comunidade` (`externa`): Nome, Descrição, Foto, Configurações; o provedor cria a comunidade **e** o grupo de avisos; a plataforma grava os dois. Depois, `vincular Grupo` para os existentes ou `criar Grupo` já vinculado (o provedor admite criar grupo dentro da comunidade — se a Capacidade o declarar).

### 12.2 Vincular e desvincular
`vincular Grupo à Comunidade` (`externa`): exige Grupo `ativo`, mesmo Tipo, sem Comunidade, Canal administrador em ambos com Papel `administrador`, e `no limite` falso. `desvincular` (`externa`): o Grupo continua a existir; Participações intactas; sai do Grupo de avisos no provedor (a Sincronização encerra as Participações correspondentes do Grupo de avisos — RN-COM-04). O Grupo de avisos não é desvinculável (INV-COM-02).

### 12.3 Sincronização
Espelha Nome, Descrição, Foto, Configurações, lista de Grupos e Papéis, Papel do Canal. Grupo que aparece vinculado no provedor e não existe na plataforma é **importado** na mesma Sincronização (exceção à regra "sincronizar não cria" de 22, 12.3 — DO-COM-02: a Comunidade sem os seus Grupos é espelho incompleto), com Captação `inativa`.

### 12.4 Sair da Comunidade
Ferramenta `sair da Comunidade` (`externa`; **irreversível** quando único administrador — o provedor pode dissolver a comunidade e desvincular todos os grupos): o Canal sai da comunidade **e** do Grupo de avisos; os Grupos `comum` **permanecem** com o Canal (sair da Comunidade não sai dos Grupos — RN-COM-08; o produto explica). Comunidade fica `inacessível`; o produto oferece arquivar.

### 12.5 Arquivamento, lixeira, eliminação
Como 22, 12.2; nada no provedor muda (INV-ATV-05); Grupos não são afetados (INV-COM-01).

## 13. Regras de negócio ontológicas

- **RN-COM-01** Comunidade só existe para Tipo de Canal com Capacidade "comunidades".
- **RN-COM-02** Vincular e desvincular Grupos são Ferramentas com efeito no provedor; preservam identidade, histórico e Participações do Grupo.
- **RN-COM-03** Um Grupo tem no máximo uma Comunidade; vincular Grupo já vinculado é rejeitado (o provedor também rejeita).
- **RN-COM-04** O Grupo de avisos é Grupo (24) com Papel `avisos`; as suas Participações são mantidas pelo provedor (união dos membros dos Grupos `comum`) e a plataforma só as espelha — nunca `adicionar Participante` ao Grupo de avisos diretamente (o provedor não permite).
- **RN-COM-05** "Enviar Mensagem à Comunidade" é enviar à Conversa de grupo do Grupo de avisos; o Registro é na Comunidade e na Mensagem.
- **RN-COM-06** "Membros da Comunidade" é derivado: união das Participações vigentes dos Grupos `comum`, um Contato contado uma vez; nunca gravado.
- **RN-COM-07** Link de Captação nunca referencia a Comunidade nem o Grupo de avisos; referencia Grupos `comum` (INV-GRP-06).
- **RN-COM-08** Sair da Comunidade não sai dos Grupos `comum`; sair de um Grupo não sai da Comunidade.
- **RN-COM-09** Automação com escopo Comunidade alcança Eventos dos Grupos vinculados **no momento do Evento**; um Grupo desvinculado deixa de ser alcançado sem alterar a Automação (escopo por referência, avaliado por Evento — B92).
- **RN-COM-10** Configurações da Comunidade valem no provedor; a plataforma não as copia para os Grupos nem impede Configurações de Grupo conflitantes (o provedor resolve; a Sincronização mostra o efetivo).
- **RN-COM-11** Remover comentários de membros no Grupo de avisos ("apenas administradores publicam") é Automação sobre a Conversa de grupo do Grupo de avisos (24, 20.8), nunca regra fixa.
- **RN-COM-12** Arquivar a Comunidade não altera Captação nem elegibilidade dos Grupos `comum`.

## 14. Invariantes

- **INV-COM-01** Nenhum ciclo de vida da Comunidade na plataforma altera o ciclo de vida de um Grupo.
- **INV-COM-02** Comunidade `sincronizado` tem exatamente um Grupo com Papel `avisos`, e ele não é desvinculável pela plataforma.
- **INV-COM-03** Todo Grupo referenciado tem o mesmo Tipo de Canal e o mesmo Espaço de Trabalho da Comunidade.
- **INV-COM-04** Um Grupo é referenciado por no máximo uma Comunidade.
- **INV-COM-05** Grupos vinculados ≤ Limite de Grupos do provedor, salvo divergência marcada.

## 15. Personalização

Tags, Definições de Campo, Vínculos, Comentários (B113). Não há Template de Comunidade nesta versão (criar é ato simples; Template de Grupo cobre a repetição). Visualizações de Grupos filtradas por Comunidade substituem "pastas".

## 16. Herança

Nenhuma na plataforma. O que o provedor impõe aos Grupos por estarem na Comunidade (ex.: quem pode adicionar participantes) aparece na Sincronização de cada Grupo como valor efetivo, sem que a plataforma modele a derivação (RN-COM-10).

## 17. Permissões e visibilidade

`ver`, `comentar`, `editar` (Nome, Descrição, Foto, Configurações, Tags, Campos — as espelhadas por Ferramenta), `excluir`, `administrar` (Canal administrador, sair, eliminar, vincular/desvincular), `executar` (enviar ao Grupo de avisos). Ver a Comunidade não concede `ver` nos Grupos (10); a lista de Grupos exibe sem nome os que o visualizador não vê (B103). Automações e Agentes sob A6.3 e B22 (`externa`).

## 18. Eventos relevantes

| Evento | Gatilho? | Registro? |
| --- | --- | --- |
| Comunidade importada / criada / arquivada / restaurada / eliminada | sim | sim |
| Grupo vinculado / desvinculado (com Ator; ou pelo provedor) | sim | sim |
| Nome / Descrição / Foto / Configurações alterados | sim | sim |
| Papel do Canal alterado; Canal saiu da Comunidade | sim | sim |
| Grupo de avisos ausente na Sincronização | sim | sim |
| No limite de Grupos do provedor | sim | sim |
| Mensagem enviada à Comunidade (na Conversa do Grupo de avisos) | sim (via Mensagem) | sim |
| Contato entrou / saiu de Grupo da Comunidade | derivado dos Grupos (Gatilho com escopo Comunidade) | (no Grupo) |

## 19. Dependências

22, 24 (Grupo, Participação, Papel na Comunidade), 14 (Conversa de grupo, Mensagem), 19, 21.

## 20. Casos limítrofes e ambiguidades

### 20.1 Comunidade importada com 40 Grupos, 10 já existentes na plataforma
Os 10 ganham a referência; 30 são importados (Captação `inativa`); o Grupo de avisos é importado com Papel `avisos`. Limite de Grupos do Espaço de Trabalho (C33) é verificado antes; se exceder, a importação da Comunidade é rejeitada inteira (não parcial — DO-COM-03), com a contagem.

### 20.2 Grupo desvinculado no celular
Sincronização: referência limpa no Grupo, Registro "desvinculado pelo provedor" (Ator: Integração), Automações de escopo Comunidade deixam de alcançá-lo (RN-COM-09). Participações do Grupo de avisos correspondentes são encerradas.

### 20.3 Canal é administrador da Comunidade mas participante em um Grupo `comum`
Comunidade `sincronizado`; aquele Grupo `sem privilégio`. Enviar à Comunidade funciona (Grupo de avisos); enviar àquele Grupo não. O produto mostra por Grupo.

### 20.4 Enviar Mensagem "a todos os Grupos da Comunidade" vs "à Comunidade"
Duas coisas: à Comunidade = uma Mensagem no Grupo de avisos (todos leem, ninguém responde lá); a todos os Grupos = Automação com N Ações (uma Mensagem por Grupo `comum`, na Conversa de cada um). O produto oferece as duas com nomes distintos; a ontologia as separa (RN-COM-05).

### 20.5 Comunidade arquivada com Link de Captação ativo sobre os seus Grupos
Nada muda para os Grupos e o Link (RN-COM-12). Arquivar Comunidade é só "parar de administrar a comunidade".

### 20.6 Provedor dissolve a comunidade
Sincronização: Comunidade `inacessível`; Grupos `comum` continuam a existir e ficam sem Comunidade (referência limpa pelo provedor); Grupo de avisos `inacessível` (o provedor o elimina) — o produto oferece arquivar ambos.

### 20.7 Vincular Grupo cheio à Comunidade
Permitido pelo provedor; o Grupo de avisos ganha os membros (o provedor gerencia o limite dele; se exceder, o provedor rejeita e a Ferramenta falha com motivo).

### 20.8 Duas Comunidades com o mesmo Nome
Permitido (o Identificador externo distingue; B39 não se aplica a espelhos); o produto exibe o Canal e a contagem para distinguir.

## 21. O que explicitamente NÃO pertence a esta entidade

Participações (Grupo); Mensagens (Conversa); Link de Captação (referencia Grupos); pasta; agendamento; relatório; "grupo de aviso" como entidade distinta (é Grupo com Papel).

## 22. Exemplos conceituais

Comunidade "Auton Empresas": Canal administrador "Comercial SP" (`administrador`); Configurações {só admins adicionam Grupos: sim; só admins adicionam participantes: não}; Grupos: "Avisos Auton Empresas" (`avisos`), "Programa Corporativo #01…#12" (`comum`); Membros derivados: 6 940; Limite do provedor 100; Automação "Boas-vindas nos Grupos" com escopo nela; Vínculo com Empresa "Auton Health" (a própria organização como Empresa? não — com a Empresa cliente "Alfa Logística" para a comunidade dedicada a ela, no exemplo alternativo "Comunidade Alfa").

## 23. Representação gráfica textual

```text
Comunidade "Auton Empresas"  [ativo · sincronizado · Canal: Comercial SP (administrador)]
├── Configurações {só admins adicionam Grupos, todos adicionam participantes}
├── Grupo "Avisos Auton Empresas"  (avisos)  ← Conversa de grupo (alvo de "enviar à Comunidade")
├── Grupo "Programa Corporativo #01" (comum)  … #12 (comum)   ← Link "Lançamento setembro"
├── Membros (derivado) 6 940 · Grupos vinculados 12/100
└── ◀── Automação "Boas-vindas nos Grupos" (escopo: esta Comunidade → alcança #01…#12 por referência)
```

## 24. Decisões ontológicas

- **DO-COM-01** Comunidade referencia Grupos; não os contém nem herda permissão a eles.
- **DO-COM-02** A Sincronização da Comunidade importa Grupos vinculados ausentes na plataforma (exceção controlada a "sincronizar não cria").
- **DO-COM-03** Importação de Comunidade que exceda o Limite de Grupos é rejeitada inteira.
- **DO-COM-04** Grupo de avisos é Grupo com Papel `avisos`, sem Captação, sem Link, não desvinculável, com Participações espelhadas.
- **DO-COM-05** "Enviar à Comunidade" ≠ "enviar a todos os Grupos": a primeira é uma Mensagem no Grupo de avisos; a segunda é Automação com N Mensagens.
- **DO-COM-06** Sair da Comunidade não sai dos Grupos.

## 25. Questões em aberto

- **25.1 / C33** Limite de Grupos do provedor por Comunidade como Limite imposto (valor à época: 100) e sua atualização.
- **25.2** Se o produto deve oferecer "conceder permissão em lote aos Grupos da Comunidade" como ato (recomendação: sim, como concessão direta repetida, sem herança).
- **25.3 / C5** Conversa de grupo do Grupo de avisos: Contato principal e distribuição (ninguém responde lá; a Conversa nasce `resolvida`?) — depende de C5.
