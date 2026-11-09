-- A porta de entrada da mensageria (Fase 16 - plano 16-03; itens 3.6.4 e 3.7.1 da fase).
--
-- O QUE ENTRA:
--   `plataforma.webhooks_recebidos`: a fila de entrada. Cada chamada VERIFICADA do provedor
--   a `POST /webhooks/mensageria/:canalId` vira uma linha `pendente`; a rota responde 200 na
--   hora e o processador de entrada (`mensageria/processador-de-entrada.ts`) a reivindica
--   depois, interpreta o corpo e manda cada Mensagem a `receberMensagem`.
--     - estados: `pendente`, `processando`, `processado`, `falhou`;
--     - `chave`: a deduplicacao da chamada (o id do evento no provedor), com indice unico
--       parcial por (Espaco, Canal, chave): o provedor que repete a chamada nao duplica a linha;
--     - `disponivel_em`: o backoff de uma falha transitoria; `locked_at`/`locked_by`: a trava do
--       processador (uma trava vencida volta a `pendente`);
--     - `resultado`: por que uma chamada processada nao virou Mensagem (`ignorado:<motivo>`,
--       `sem_tratamento:<tipo>`); `ultimo_erro`: o codigo ou o erro saneado da ultima falha;
--     - FK (workspace_id, canal_id) -> plataforma.canais: a chamada sempre pertence a um Canal.
--
--   `integration_outbox_mensagem_enviar_uniq`: o indice unico parcial do evento
--   `mensagem.enviar.v1` da saida (3.7.1), no molde do `integration_outbox_notificar_canal_uniq`
--   da 006. Entra aqui para a fase ter uma migracao so; quem o usa e o plano da saida.
--
-- ATENCAO: o `corpo` guarda o que o provedor mandou, e isso tem dado pessoal de terceiro
-- (telefone, nome, texto). Nunca vai a log. Quem apaga as linhas `processado` e a retencao da
-- Sessao 19: ate la elas ficam.
--
-- Nao toca `plataforma.registros` (D-03). Sem `grant`: a 009 concede DML ao `n1_api` por
-- `alter default privileges`, e `npm run banco:conceder` e a rede. Em producao so entra pela
-- publicacao manual do dono (backup antes, `npm run migrar -- --seco` primeiro).
--
-- Roda inteira dentro da transacao de `migrar()` (begin/commit/rollback por arquivo): se
-- qualquer passo falhar, nem a tabela nem o registro em plataforma.migracoes ficam
-- aplicados. Idempotente: `create ... if not exists`, constraints precedidas de
-- `drop constraint if exists`; rodar de novo nao muda nada.
-- Migracao aplicada e imutavel: ajuste e a `014`.

create table if not exists plataforma.webhooks_recebidos (
  id             uuid        not null default gen_random_uuid() primary key,
  workspace_id   text        not null,
  canal_id       text        not null,
  provedor       text        not null,
  chave          text,
  corpo          jsonb       not null,
  recebido_em    timestamptz not null default now(),
  estado         text        not null default 'pendente',
  resultado      text,
  tentativas     int         not null default 0,
  disponivel_em  timestamptz not null default now(),
  locked_at      timestamptz,
  locked_by      text,
  ultimo_erro    text,
  processado_em  timestamptz
);

alter table plataforma.webhooks_recebidos drop constraint if exists webhooks_recebidos_estado_ck;
alter table plataforma.webhooks_recebidos
  add constraint webhooks_recebidos_estado_ck check (estado in ('pendente', 'processando', 'processado', 'falhou'));

alter table plataforma.webhooks_recebidos drop constraint if exists webhooks_recebidos_tentativas_ck;
alter table plataforma.webhooks_recebidos
  add constraint webhooks_recebidos_tentativas_ck check (tentativas >= 0);

alter table plataforma.webhooks_recebidos drop constraint if exists webhooks_recebidos_canal_fk;
alter table plataforma.webhooks_recebidos
  add constraint webhooks_recebidos_canal_fk
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id);

-- A fila: o que esta pronto para o processador, na ordem; e as travas, para devolver as vencidas.
create index if not exists webhooks_recebidos_pendente_idx
  on plataforma.webhooks_recebidos (disponivel_em, id) where estado = 'pendente';
create index if not exists webhooks_recebidos_processando_idx
  on plataforma.webhooks_recebidos (locked_at) where estado = 'processando';

-- A mesma chamada do provedor duas vezes grava uma linha so (Pitfall 10).
create unique index if not exists webhooks_recebidos_chave_uq
  on plataforma.webhooks_recebidos (workspace_id, canal_id, chave) where chave is not null;

-- 3.7.1: uma Mensagem gera no maximo um `mensagem.enviar.v1` (o agregado e a Mensagem).
create unique index if not exists integration_outbox_mensagem_enviar_uniq
  on plataforma.integration_outbox (workspace_id, aggregate_type, aggregate_id, event_type)
  where event_type = 'mensagem.enviar.v1';

-- Decisao F7 da 009: sem RLS ate a Sessao 12. Se o projeto tem o event trigger `ensure_rls`
-- (rls_auto_enable), cada tabela nova de `plataforma` nasceu com RLS ligada e sem
-- policy. Bloco copiado da 009: desliga em toda tabela que a tenha ligada.
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
     where c.relnamespace = 'plataforma'::regnamespace
       and c.relkind in ('r', 'p')
       and c.relrowsecurity
  loop
    execute format('alter table plataforma.%I disable row level security', t.relname);
  end loop;
end $$;
