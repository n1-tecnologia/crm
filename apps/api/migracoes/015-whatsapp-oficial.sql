-- O WhatsApp oficial de verdade (Sessao 7 - itens 7.2 e 7.3 de TAREFAS-POR-SESSAO.md).
--
-- O WhatsApp oficial (Cloud API da Meta) e um `ProvedorDeMensageria`
-- (`mensageria/provedores/whatsapp-cloud/`): a Mensagem entra pela fila `plataforma.webhooks_recebidos`
-- (013) e por `receberMensagem`, e sai pelo outbox (`mensagem.enviar.v1`), como o Instagram (014) e a
-- Evolution. Esta migracao so guarda o que e do WhatsApp oficial.
--
-- O QUE ENTRA:
--   `plataforma.whatsapp_cloud_numeros`: o numero (Phone Number ID) ligado a um Canal `whatsapp-cloud`.
--   Uma linha por Canal conectado; desconectar ou arquivar APAGAM a linha (e a credencial no cofre).
--     - `phone_number_id` e o `metadata.phone_number_id` de cada evento do webhook, por onde a rota da
--       Meta acha o Canal. A Meta chama UM endereco para todos os numeros do app, e o webhook nao
--       conhece o Espaco de Trabalho: por isso o indice unico e GLOBAL (um numero fica ligado a um
--       Canal so na plataforma inteira), como `instagram_contas`;
--     - `waba_id` e a conta do WhatsApp Business dona do numero: a inscricao do app nos webhooks e a
--       lista de modelos de mensagem (7.3) usam esse id;
--     - `numero_exibido` e o numero como a Meta o mostra (`display_phone_number`), guardado para a ficha.
--
-- A credencial NAO esta aqui: o token fica cifrado em `plataforma.credenciais` (009), com `tipo` =
-- `whatsapp-cloud` (o nome do provedor, o que `canalParaProvedor` le), junto com os dois ids.
--
-- A tabela de modelos de mensagem (7.3.1) e a das respostas de Flow (7.4) NAO entram aqui: ficam em
-- migracao propria, quando forem construidas. Migracao aplicada e imutavel.
--
-- Sem `grant`: a 009 concede DML ao `n1_api` por `alter default privileges`, e
-- `npm run banco:conceder` e a rede. Roda inteira dentro da transacao de `migrar()`.
-- Idempotente: `create ... if not exists`.

create table if not exists plataforma.whatsapp_cloud_numeros (
  workspace_id     text        not null,
  canal_id         text        not null,
  phone_number_id  text        not null,
  waba_id          text        not null,
  numero_exibido   text        not null,
  conectado_por    text        not null,
  conectado_em     timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  primary key (workspace_id, canal_id),
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id) on delete cascade,
  constraint whatsapp_cloud_numeros_phone_ck check (phone_number_id ~ '^[0-9]{5,30}$'),
  constraint whatsapp_cloud_numeros_waba_ck check (waba_id ~ '^[0-9]{5,30}$'),
  constraint whatsapp_cloud_numeros_exibido_ck check (length(btrim(numero_exibido)) > 0)
);

-- Um numero do WhatsApp oficial, um Canal: o webhook acha o Canal so por `phone_number_id`.
create unique index if not exists whatsapp_cloud_numeros_phone_uq on plataforma.whatsapp_cloud_numeros (phone_number_id);
create index if not exists whatsapp_cloud_numeros_waba_idx on plataforma.whatsapp_cloud_numeros (waba_id);

drop trigger if exists whatsapp_cloud_numeros_atualizado_em on plataforma.whatsapp_cloud_numeros;
create trigger whatsapp_cloud_numeros_atualizado_em before update on plataforma.whatsapp_cloud_numeros
  for each row execute function plataforma.crm_toque_atualizado_em();

-- Decisao F7 da 009: sem RLS ate a Sessao 12. Bloco copiado da 009 (e da 013 e da 014): desliga em toda
-- tabela de `plataforma` que nasceu com RLS ligada pelo event trigger `ensure_rls`.
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
