# repositorios

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

A persistência. Uma interface por agregado, e a implementação atrás dela — trocar de banco deve ser trocar de implementação, não de serviço.

## O padrão (inaugurado em `crm/`, Fase 7)

- **Uma interface por agregado** (`RepositorioDeContatos`) e a implementação `pg` atrás dela: `criarRepositorioDe…Pg(cliente: Pool | PoolClient)`. O mesmo repositório serve fora de transação (o `Pool`) e dentro dela (o `PoolClient`).
- **Quem abre a transação é o serviço**, com `comTransacao` (`../servicos/crm/transacao.ts`); ele passa o `PoolClient` aos repositórios. O repositório nunca faz `begin`/`commit`.
- **`workspace_id = $1` em todo `WHERE`** — o Espaço vem do serviço, que o tira da sessão; nada aqui o deduz de outro lugar (T-07-01). Valores sempre `$n`, nunca interpolados; a ordenação é fixa.
- **Datas `::text`** (`date` sai como texto, nunca `types.setTypeParser` global), **`numeric` como texto** (não perde precisão) e **`count(*)::int`**.
- **Testes contra o Postgres local**, por `../testes/banco-crm.ts` (`describeComBanco`, `semearMembro`, `limparEspaco`): nunca contra o banco remoto do `.env`.

## Os repositórios da Caixa de Entrada (Fase 8)

Quatro arquivos novos em `crm/`, mesmo padrão acima, sobre a `008-canais-conversas-mensagens.sql`:

- `canais.ts` — `plataforma.canais`: ficha, lista com filtros, unicidade de nome e de conta entre provedores (INV-CXE-01), conexão e arquivamento.
- `conversas.ts` — `plataforma.conversas`: abrir (uma não resolvida por Contato e Canal), lista, situação (resolver/reabrir).
- `mensagens.ts` — `plataforma.mensagens`: inserir (`enviada`/`interna`), o fio por `(criado_em, seq)`, a última `recebida` (a janela de RN-CXE-19) e `inserirRecebida`, idempotente por (Canal, id externo).
- `referencias.ts` — o **único** lugar que ainda lê `plataforma.registros` para o Canal: Fila, Origem padrão, Canais do seed (unicidade entre os dois acervos) e a revisão do Espaço. Some quando o seed deixar de ser a fonte (fase de unificação).

**A carga bruta fica fora das leituras (A9).** `carga_bruta` (o payload cru do provedor) não está em `COLUNAS_DE_MENSAGEM`; só `inserirRecebida` a escreve e só o método interno `cargaBruta(workspaceId, id)` a lê (nenhuma rota o chama). Ela é dado pessoal: a anonimização futura do Contato (ontologia 12.5) precisa zerar `carga_bruta` junto do conteúdo, dos anexos e do remetente externo, e nada que sai pela api pode passar a depender dela.

A Mensagem é imutável depois de gravada, salvo status de entrega e marcação de exclusão (RN-CXE-16): por isso não há `atualizar`.
