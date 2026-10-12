-- Modelagem relacional de Canal, Conversa e Mensagem (Caixa de Entrada).
-- Fonte: ontologia/03-crm/caixa-de-entrada-e-mensageria.md (7.2, 7.5, 7.6, 11.1, 12.2, 14).
--
-- No padrao da 007: uma tabela por entidade, `workspace_id` em tudo, PK
-- (workspace_id, id), toda FK entre elas composta. O trigger de
-- `atualizado_em` reaproveita `plataforma.crm_toque_atualizado_em()` da 007.
--
-- Decisoes do produto que SOBREPOEM ou PRECISAM a ontologia (Fase 8):
--   * D-01: o Canal ganha `provedor`; `tipo` continua whatsapp/instagram/email.
--   * D-08: o Canal nasce `desconectada` (12.2); `conexao_simulada` marca a
--     conexao feita pelo botao "Simular conexao", enquanto nao ha provedor real.
--   * D-09: Fila e Participante NAO ganham tabela: `fila_id` e texto sem FK;
--     Participantes sao jsonb na Conversa.
--   * D-10: a Mensagem guarda o modelo completo de 7.6 mais `carga_bruta`.
--
-- Fora desta migracao, de proposito: credenciais do Canal (so entram com o
-- provedor real, com a decisao de como guardar segredo), Mensagens de modelo,
-- Grupos, Tags/Valores de Campo/Rascunho/Adiamento por Membro da Conversa.

create schema if not exists plataforma;

create table if not exists plataforma.canais (
  id                      text        not null default gen_random_uuid()::text,
  workspace_id            text        not null,
  nome                    text        not null,
  tipo                    text        not null,
  provedor                text        not null,
  identificador_externo   text        not null,
  conexao                 text        not null default 'desconectada',
  conexao_simulada        boolean     not null default false,
  conectada_em            timestamptz,
  estado                  text        not null default 'ativo',
  arquivado_em            timestamptz,
  configurado_por         text        not null,
  fila_padrao_id          text,
  proprietario_padrao_id  text,
  origem_padrao_id        text,
  grupos_habilitados      boolean     not null default false,
  criado_por              text        not null,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint canais_nome_ck check (length(btrim(nome)) > 0),
  constraint canais_identificador_ck check (length(btrim(identificador_externo)) > 0),
  constraint canais_tipo_ck check (tipo in ('whatsapp', 'instagram', 'email')),
  constraint canais_provedor_ck check (provedor in
    ('whatsapp-cloud', 'whatsapp-nao-oficial', 'instagram-graph', 'email-imap-smtp')),
  -- O provedor pertence a um tipo so (D-01): nao existe "email" com provedor de WhatsApp.
  constraint canais_provedor_tipo_ck check (
    (tipo = 'whatsapp'  and provedor in ('whatsapp-cloud', 'whatsapp-nao-oficial'))
 or (tipo = 'instagram' and provedor = 'instagram-graph')
 or (tipo = 'email'     and provedor = 'email-imap-smtp')),
  constraint canais_conexao_ck check (conexao in ('conectada', 'desconectada', 'com_erro')),
  constraint canais_estado_ck check (estado in ('ativo', 'arquivado')),
  -- 11.1: Canal arquivado e sempre desconectado.
  constraint canais_arquivado_desconectado_ck check (estado <> 'arquivado' or conexao = 'desconectada'),
  -- A simulacao so existe enquanto o Canal esta conectado.
  constraint canais_simulada_ck check (not conexao_simulada or conexao = 'conectada'),
  constraint canais_arquivamento_ck check ((estado = 'arquivado') = (arquivado_em is not null))
);

-- RN-CXE-31: nome unico entre Canais ativos, sem distinguir caixa nem espacos nas pontas.
create unique index if not exists canais_nome_uq
  on plataforma.canais (workspace_id, lower(btrim(nome))) where estado = 'ativo';
-- INV-CXE-01: a mesma conta (tipo, identificador) nao e conectada duas vezes entre Canais ativos.
create unique index if not exists canais_conta_uq
  on plataforma.canais (workspace_id, tipo, identificador_externo) where estado = 'ativo';
create index if not exists canais_estado_idx on plataforma.canais (workspace_id, estado);

drop trigger if exists canais_atualizado_em on plataforma.canais;
create trigger canais_atualizado_em before update on plataforma.canais
  for each row execute function plataforma.crm_toque_atualizado_em();

create table if not exists plataforma.conversas (
  id                  text        not null default gen_random_uuid()::text,
  workspace_id        text        not null,
  canal_id            text        not null,
  contato_id          text        not null,
  titulo              text        not null,
  titulo_editado      boolean     not null default false,
  situacao            text        not null default 'aberta',
  estado              text        not null default 'ativo',
  fila_id             text,
  atribuido_tipo      text,
  atribuido_id        text,
  adiada_ate          timestamptz,
  adiamento_motivo    text,
  participantes       jsonb       not null default '[]'::jsonb,
  resolvida_em        timestamptz,
  reaberta_em         timestamptz,
  reaberturas         integer     not null default 0,
  criado_por_tipo     text        not null,
  criado_por_id       text        not null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id),
  foreign key (workspace_id, contato_id) references plataforma.contatos (workspace_id, id),
  -- Habilita a FK composta (conversa, canal) da Mensagem: o banco garante que a
  -- Mensagem esta no mesmo Canal da Conversa.
  constraint conversas_canal_id_uq unique (workspace_id, id, canal_id),
  constraint conversas_titulo_ck check (length(btrim(titulo)) > 0),
  constraint conversas_situacao_ck check (situacao in ('aberta', 'pendente', 'resolvida')),
  constraint conversas_estado_ck check (estado in ('ativo', 'na_lixeira')),
  constraint conversas_participantes_ck check (jsonb_typeof(participantes) = 'array'),
  constraint conversas_atribuido_ck check (
    (atribuido_tipo is null) = (atribuido_id is null)
    and (atribuido_tipo is null or atribuido_tipo in ('membro', 'agente'))),
  -- INV-CXE-11: Adiamento so em Conversa pendente.
  constraint conversas_adiamento_ck check (adiada_ate is null or situacao = 'pendente'),
  -- INV-CXE-13: Conversa na lixeira nao esta aberta nem pendente.
  constraint conversas_lixeira_ck check (estado <> 'na_lixeira' or situacao = 'resolvida'),
  constraint conversas_reaberturas_ck check (reaberturas >= 0)
);

-- INV-CXE-03: no maximo uma Conversa aberta/pendente por (Contato, Canal).
create unique index if not exists conversas_nao_resolvida_uq
  on plataforma.conversas (workspace_id, contato_id, canal_id)
  where situacao in ('aberta', 'pendente') and estado = 'ativo';
create index if not exists conversas_canal_idx on plataforma.conversas (workspace_id, canal_id);
create index if not exists conversas_contato_idx on plataforma.conversas (workspace_id, contato_id);
create index if not exists conversas_situacao_idx on plataforma.conversas (workspace_id, situacao, estado);

drop trigger if exists conversas_atualizado_em on plataforma.conversas;
create trigger conversas_atualizado_em before update on plataforma.conversas
  for each row execute function plataforma.crm_toque_atualizado_em();

-- Mensagem: imutavel depois de gravada, salvo marcacao de exclusao e status de
-- entrega (RN-CXE-16) — por isso nao ha `atualizado_em`. `canal_id` repete o da
-- Conversa: e a chave de INV-CXE-08 e a FK composta garante que nao diverge.
-- `carga_bruta` contem dado pessoal: a anonimizacao do Contato precisa zera-la.
create table if not exists plataforma.mensagens (
  id                       text        not null default gen_random_uuid()::text,
  workspace_id             text        not null,
  conversa_id              text        not null,
  canal_id                 text        not null,
  seq                      bigint      generated always as identity,
  direcao                  text        not null,
  ator_tipo                text        not null,
  ator_id                  text        not null,
  delegante_tipo           text,
  delegante_id             text,
  remetente_participante_id text,
  identificador_id         text,
  remetente_externo        text,
  conteudo                 text,
  anexos                   jsonb       not null default '[]'::jsonb,
  assunto                  text,
  enderecos_adicionais     jsonb       not null default '[]'::jsonb,
  em_resposta_a_id         text,
  modelo_usado             jsonb,
  id_externo               text,
  status_entrega           text,
  status_entrega_em        timestamptz,
  motivo_falha             text,
  leituras_internas        jsonb       not null default '[]'::jsonb,
  reacoes                  jsonb       not null default '[]'::jsonb,
  marcacao_exclusao        jsonb,
  edicoes_externas         jsonb       not null default '[]'::jsonb,
  anonimizada              boolean     not null default false,
  carga_bruta              jsonb,
  criado_em                timestamptz not null default now(),
  registrado_em            timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, conversa_id, canal_id)
    references plataforma.conversas (workspace_id, id, canal_id) on delete cascade,
  -- Habilita a FK composta de "em resposta a" (INV-CXE-10: mesma Conversa).
  constraint mensagens_conversa_id_uq unique (workspace_id, conversa_id, id),
  foreign key (workspace_id, conversa_id, em_resposta_a_id)
    references plataforma.mensagens (workspace_id, conversa_id, id),
  constraint mensagens_direcao_ck check (direcao in ('recebida', 'enviada', 'interna')),
  constraint mensagens_ator_ck check (ator_tipo in ('member', 'agent', 'automation', 'integration', 'system')),
  constraint mensagens_delegante_ck check ((delegante_tipo is null) = (delegante_id is null)),
  constraint mensagens_anexos_ck check (jsonb_typeof(anexos) = 'array'),
  constraint mensagens_enderecos_ck check (jsonb_typeof(enderecos_adicionais) = 'array'),
  constraint mensagens_leituras_ck check (jsonb_typeof(leituras_internas) = 'array'),
  constraint mensagens_reacoes_ck check (jsonb_typeof(reacoes) = 'array'),
  constraint mensagens_edicoes_ck check (jsonb_typeof(edicoes_externas) = 'array'),
  constraint mensagens_status_ck check (status_entrega is null or status_entrega in
    ('pendente', 'enviada', 'entregue', 'lida', 'falhou')),
  -- INV-CXE-09: toda `enviada` tem exatamente um status; `recebida` e `interna` nao tem.
  constraint mensagens_status_direcao_ck check ((direcao = 'enviada') = (status_entrega is not null)),
  constraint mensagens_motivo_falha_ck check (motivo_falha is null or status_entrega = 'falhou'),
  -- 7.6: id externo obrigatorio em `recebida`, ausente em `interna`.
  constraint mensagens_id_externo_ck check (
    (direcao <> 'recebida' or id_externo is not null) and (direcao <> 'interna' or id_externo is null)),
  -- INV-CXE-07: conteudo ou anexo, salvo anonimizada ou com marcacao de exclusao.
  constraint mensagens_conteudo_ck check (
    anonimizada or marcacao_exclusao is not null
    or length(btrim(coalesce(conteudo, ''))) > 0 or jsonb_array_length(anexos) > 0)
);

-- INV-CXE-08: dentro de um Canal, nao ha duas Mensagens com o mesmo identificador externo.
create unique index if not exists mensagens_id_externo_uq
  on plataforma.mensagens (workspace_id, canal_id, id_externo) where id_externo is not null;
create index if not exists mensagens_conversa_idx
  on plataforma.mensagens (workspace_id, conversa_id, criado_em, seq);
