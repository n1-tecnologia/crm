-- Modelagem relacional do CRM: Contato, Empresa, Funil (com Etapas) e Negócio.
-- Fonte: ontologia/03-crm (contatos, empresas, funis, negocios).
--
-- Diferente de `plataforma.registros` (jsonb genérico), estas entidades têm
-- tabela própria: o CRM precisa de filtro, unicidade e integridade
-- referencial por coluna (um Identificador é único por Espaço de Trabalho; uma
-- Etapa só pode ser a de um Negócio do próprio Funil).
--
-- Isolamento por Espaço de Trabalho: toda tabela leva `workspace_id` e toda FK
-- entre elas é composta (workspace_id, id). Assim o banco recusa, sozinho, um
-- Negócio de um workspace apontando para a Empresa de outro.
--
-- Fora desta migração, de propósito: Caixa de Entrada/Conversas/Mensagens
-- (chats serão modelados depois) e os catálogos do Espaço de Trabalho (Tag,
-- Origem, Motivo de Perda, Qualificação). Enquanto os catálogos não existem,
-- `origem`, `qualificacao` e `motivo_perda` são texto livre.
--
-- Decisões do produto que SOBREPÕEM a ontologia:
--   * Toda Empresa tem ao menos um Contato admin vigente (a ontologia, 11 §20.2,
--     admitia Empresa sem Contatos). Garantido por constraint trigger abaixo.
--   * Negócio pertence a uma Empresa OU a um Contato, nunca a ambos nem a
--     nenhum (a ontologia admitia os dois e o Vínculo Contato-Negócio N:N).
--   * `campos_adicionais` (chave → valor) em Contato e Empresa no lugar do
--     catálogo de Definições de Campo Personalizado.
--   * Empresa na lixeira não exige admin vigente (D-08 manda encerrar os vínculos
--     ao enviá-la à lixeira, o que a primeira versão do trigger recusava no
--     commit), mas voltar da lixeira exige: ver `empresas_exige_admin_estado`.

create schema if not exists plataforma;

-- Mantém `atualizado_em` sem depender de cada UPDATE lembrar de preenchê-lo.
create or replace function plataforma.crm_toque_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

/*
 * Contato: a pessoa. Nome de exibição é derivado (nunca gravado). Cargo não é
 * atributo do Contato: mora no vínculo com a Empresa (`contato_empresa.cargo`),
 * porque a mesma pessoa tem cargos diferentes em empresas diferentes.
 *
 * `campos_adicionais` guarda os campos que o usuário cria à vontade, como
 * { "signo": "leão", "time": "Palmeiras" }. Valores são livres (texto, número,
 * booleano); só a forma "objeto" é garantida pelo banco.
 */
create table if not exists plataforma.contatos (
  id                 text        not null default gen_random_uuid()::text,
  workspace_id       text        not null,
  nome               text,
  sobrenome          text,
  data_nascimento    date,
  idioma             text,
  fuso_horario       text,
  foto_url           text,
  descricao          text,
  -- Endereços são objeto de valor 0..N (rótulo, logradouro, número, ... e
  -- principal). Sem identidade nem consulta por coluna: ficam como array.
  enderecos          jsonb       not null default '[]'::jsonb,
  campos_adicionais  jsonb       not null default '{}'::jsonb,
  origem             text,
  qualificacao       text,
  modo_criacao       text        not null default 'manual',
  estado             text        not null default 'ativo',
  proprietario_id    text        not null,
  criado_por         text        not null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint contatos_estado_ck check (estado in ('ativo', 'arquivado', 'na_lixeira')),
  constraint contatos_modo_criacao_ck check (modo_criacao in
    ('manual', 'importacao', 'automatico_mensagem', 'automatico_automacao')),
  constraint contatos_enderecos_ck check (jsonb_typeof(enderecos) = 'array'),
  constraint contatos_campos_adicionais_ck check (jsonb_typeof(campos_adicionais) = 'object')
);

create index if not exists contatos_estado_idx on plataforma.contatos (workspace_id, estado);
create index if not exists contatos_proprietario_idx on plataforma.contatos (workspace_id, proprietario_id);
create index if not exists contatos_campos_adicionais_idx on plataforma.contatos using gin (campos_adicionais);

drop trigger if exists contatos_atualizado_em on plataforma.contatos;
create trigger contatos_atualizado_em before update on plataforma.contatos
  for each row execute function plataforma.crm_toque_atualizado_em();

/*
 * Identificadores de Contato: o meio pelo qual um Canal alcança a pessoa e
 * pelo qual uma Mensagem recebida é resolvida ao Contato. Os tipos cobrem os
 * Canais previstos (E-mail, WhatsApp oficial e não oficial, Instagram); o
 * tipo `telefone` (discável) é distinto de `whatsapp` (identidade que um Canal
 * WhatsApp resolve), como na ontologia (contatos 7.1). Qual Canal usa qual
 * tipo é assunto da modelagem de Canais, depois.
 *
 * `valor` é a forma canônica (e-mail em minúsculas, telefone em formato
 * internacional): quem grava normaliza. A unicidade é por (tipo, valor) em todo
 * o Espaço de Trabalho, entre Contatos de qualquer estado.
 */
create table if not exists plataforma.contato_identificadores (
  id               text        not null default gen_random_uuid()::text,
  workspace_id     text        not null,
  contato_id       text        not null,
  tipo             text        not null,
  valor            text        not null,
  valor_exibido    text,
  rotulo_canal     text,
  verificado       boolean     not null default false,
  principal        boolean     not null default false,
  criado_em        timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, contato_id)
    references plataforma.contatos (workspace_id, id) on delete cascade,
  constraint contato_identificadores_tipo_ck check (tipo in ('telefone', 'email', 'whatsapp', 'instagram')),
  constraint contato_identificadores_valor_ck check (length(btrim(valor)) > 0),
  constraint contato_identificadores_unico unique (workspace_id, tipo, valor)
);

create index if not exists contato_identificadores_contato_idx
  on plataforma.contato_identificadores (workspace_id, contato_id);
-- No máximo um principal por tipo por Contato.
create unique index if not exists contato_identificadores_principal_uq
  on plataforma.contato_identificadores (workspace_id, contato_id, tipo) where principal;

/*
 * Empresa: a organização. Nome de exibição = nome fantasia, senão razão social.
 * `matriz_id` é a hierarquia matriz/filial (referência, sem contenção).
 */
create table if not exists plataforma.empresas (
  id                 text        not null default gen_random_uuid()::text,
  workspace_id       text        not null,
  nome_fantasia      text,
  razao_social       text,
  descricao          text,
  matriz_id          text,
  enderecos          jsonb       not null default '[]'::jsonb,
  campos_adicionais  jsonb       not null default '{}'::jsonb,
  origem             text,
  estado             text        not null default 'ativo',
  proprietario_id    text        not null,
  criado_por         text        not null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, matriz_id) references plataforma.empresas (workspace_id, id),
  constraint empresas_nome_ck check (
    length(btrim(coalesce(nome_fantasia, ''))) > 0 or length(btrim(coalesce(razao_social, ''))) > 0),
  constraint empresas_matriz_propria_ck check (matriz_id is distinct from id),
  constraint empresas_estado_ck check (estado in ('ativo', 'arquivado', 'na_lixeira')),
  constraint empresas_enderecos_ck check (jsonb_typeof(enderecos) = 'array'),
  constraint empresas_campos_adicionais_ck check (jsonb_typeof(campos_adicionais) = 'object')
);

create index if not exists empresas_estado_idx on plataforma.empresas (workspace_id, estado);
create index if not exists empresas_matriz_idx on plataforma.empresas (workspace_id, matriz_id);
create index if not exists empresas_campos_adicionais_idx on plataforma.empresas using gin (campos_adicionais);

drop trigger if exists empresas_atualizado_em on plataforma.empresas;
create trigger empresas_atualizado_em before update on plataforma.empresas
  for each row execute function plataforma.crm_toque_atualizado_em();

/*
 * Identificadores de Empresa: como a organização é reconhecida (domínio,
 * CNPJ/documento fiscal, telefone central). Nunca resolvem Mensagens: isso é
 * exclusivo de Identificador de Contato. Quem grava normaliza (domínio em
 * minúsculas sem protocolo/www; documento só com dígitos).
 */
create table if not exists plataforma.empresa_identificadores (
  id               text        not null default gen_random_uuid()::text,
  workspace_id     text        not null,
  empresa_id       text        not null,
  tipo             text        not null,
  valor            text        not null,
  pais             text,
  verificado       boolean     not null default false,
  principal        boolean     not null default false,
  criado_em        timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, empresa_id)
    references plataforma.empresas (workspace_id, id) on delete cascade,
  constraint empresa_identificadores_tipo_ck check (tipo in ('dominio', 'documento_fiscal', 'telefone')),
  constraint empresa_identificadores_valor_ck check (length(btrim(valor)) > 0),
  constraint empresa_identificadores_pais_ck check (tipo <> 'documento_fiscal' or pais is not null),
  constraint empresa_identificadores_unico unique (workspace_id, tipo, valor)
);

create index if not exists empresa_identificadores_empresa_idx
  on plataforma.empresa_identificadores (workspace_id, empresa_id);
create unique index if not exists empresa_identificadores_principal_uq
  on plataforma.empresa_identificadores (workspace_id, empresa_id, tipo) where principal;

/*
 * Vínculo Contato-Empresa: N:N com atributos. Um Contato pode estar em várias
 * Empresas (cada uma com seu cargo) e uma Empresa tem vários Contatos.
 *
 * `admin` marca o Contato administrador da Empresa. Regra: toda Empresa tem
 * ao menos um vínculo vigente com admin (constraint trigger mais abaixo).
 * Vigência: `fim` nulo = vínculo ativo. Sair da empresa é preencher `fim`, não
 * apagar (preserva histórico); só pode haver um vínculo vigente por par.
 */
create table if not exists plataforma.contato_empresa (
  id               text        not null default gen_random_uuid()::text,
  workspace_id     text        not null,
  contato_id       text        not null,
  empresa_id       text        not null,
  cargo            text,
  admin            boolean     not null default false,
  inicio           date,
  fim              date,
  criado_por       text        not null,
  criado_em        timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, contato_id)
    references plataforma.contatos (workspace_id, id) on delete cascade,
  foreign key (workspace_id, empresa_id)
    references plataforma.empresas (workspace_id, id) on delete cascade,
  constraint contato_empresa_periodo_ck check (fim is null or inicio is null or fim >= inicio)
);

create unique index if not exists contato_empresa_vigente_uq
  on plataforma.contato_empresa (workspace_id, contato_id, empresa_id) where fim is null;
create index if not exists contato_empresa_empresa_idx
  on plataforma.contato_empresa (workspace_id, empresa_id) where fim is null;
create index if not exists contato_empresa_contato_idx
  on plataforma.contato_empresa (workspace_id, contato_id) where fim is null;

/*
 * Garante "toda Empresa tem ao menos um Contato admin vigente".
 *
 * É um constraint trigger DEFERRABLE INITIALLY DEFERRED: a checagem roda no
 * COMMIT, então a Empresa e o primeiro vínculo admin podem ser criados na mesma
 * transação (a Empresa nasce antes do vínculo, e checar na hora sempre
 * falharia). Também protege o caminho inverso: encerrar, apagar ou rebaixar o
 * último admin falha no commit.
 *
 * Se a Empresa deixou de existir no commit (exclusão em cascata), não há o que
 * exigir. Empresa na lixeira também não exige: D-08 manda encerrar os vínculos
 * vigentes ao enviá-la à lixeira, e uma checagem que ignorasse o `estado`
 * recusaria essa transação no commit. A restauração é coberta por
 * `empresas_exige_admin_estado`, mais abaixo.
 */
create or replace function plataforma.crm_exige_admin_na_empresa() returns trigger
language plpgsql as $$
declare
  v_workspace text;
  v_empresa   text;
begin
  if tg_table_name = 'empresas' then
    v_workspace := new.workspace_id;
    v_empresa   := new.id;
  else
    v_workspace := coalesce(new.workspace_id, old.workspace_id);
    v_empresa   := coalesce(new.empresa_id, old.empresa_id);
    -- UPDATE que troca a Empresa do vínculo desfalca também a de origem.
    if tg_op = 'UPDATE' and old.empresa_id is distinct from new.empresa_id then
      perform plataforma.crm_confere_admin(old.workspace_id, old.empresa_id);
    end if;
  end if;
  perform plataforma.crm_confere_admin(v_workspace, v_empresa);
  return null;
end;
$$;

create or replace function plataforma.crm_confere_admin(p_workspace text, p_empresa text) returns void
language plpgsql as $$
begin
  if exists (select 1 from plataforma.empresas
              where workspace_id = p_workspace and id = p_empresa and estado <> 'na_lixeira')
     and not exists (
       select 1 from plataforma.contato_empresa
        where workspace_id = p_workspace and empresa_id = p_empresa
          and admin and fim is null)
  then
    raise exception 'Empresa % precisa de ao menos um Contato admin vigente', p_empresa
      using errcode = 'check_violation', constraint = 'empresa_exige_admin';
  end if;
end;
$$;

drop trigger if exists empresas_exige_admin on plataforma.empresas;
create constraint trigger empresas_exige_admin
  after insert on plataforma.empresas
  deferrable initially deferred
  for each row execute function plataforma.crm_exige_admin_na_empresa();

drop trigger if exists contato_empresa_exige_admin on plataforma.contato_empresa;
create constraint trigger contato_empresa_exige_admin
  after insert or update or delete on plataforma.contato_empresa
  deferrable initially deferred
  for each row execute function plataforma.crm_exige_admin_na_empresa();

-- Voltar da lixeira (ou qualquer troca de estado) exige admin vigente no commit.
-- Sem este trigger, a Empresa restaurada sem admin passaria: o de `insert` só
-- cobre a criação e o de `contato_empresa` só dispara quando um vínculo muda.
-- Restaurar e inserir o novo admin na mesma transação passa.
drop trigger if exists empresas_exige_admin_estado on plataforma.empresas;
create constraint trigger empresas_exige_admin_estado
  after update of estado on plataforma.empresas
  deferrable initially deferred
  for each row execute function plataforma.crm_exige_admin_na_empresa();

/*
 * Funil: o processo pelo qual um Negócio progride. Pertence ao Espaço de
 * Trabalho; Funil não contém Negócios (Negócio referencia o Funil). Não tem
 * Proprietário, só Criador.
 *
 * `exige_motivo_perda` / `exige_valor_ganho` são as Regras de encerramento: a
 * aplicação as consulta ao marcar o Negócio como perdido/ganho.
 */
create table if not exists plataforma.funis (
  id                  text        not null default gen_random_uuid()::text,
  workspace_id        text        not null,
  nome                text        not null,
  descricao           text,
  cor                 text,
  ordem               integer     not null default 0,
  padrao              boolean     not null default false,
  privado             boolean     not null default false,
  exige_motivo_perda  boolean     not null default false,
  exige_valor_ganho   boolean     not null default false,
  estado              text        not null default 'ativo',
  criado_por          text        not null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint funis_nome_ck check (length(btrim(nome)) > 0),
  constraint funis_estado_ck check (estado in ('ativo', 'arquivado', 'na_lixeira')),
  -- Funil padrão precisa estar ativo e não pode ser privado (ontologia, funis 8).
  constraint funis_padrao_ck check (not padrao or (estado = 'ativo' and not privado))
);

-- Nome único entre Funis ativos e arquivados, sem distinguir caixa.
create unique index if not exists funis_nome_uq
  on plataforma.funis (workspace_id, lower(btrim(nome))) where estado <> 'na_lixeira';
-- No máximo um Funil padrão por Espaço de Trabalho.
create unique index if not exists funis_padrao_uq
  on plataforma.funis (workspace_id) where padrao;

drop trigger if exists funis_atualizado_em on plataforma.funis;
create trigger funis_atualizado_em before update on plataforma.funis
  for each row execute function plataforma.crm_toque_atualizado_em();

/*
 * Etapa: posição dentro do Funil. Não é estado nem tem ciclo de vida próprio.
 * Toda Etapa é de progressão: ganho e perda NÃO são Etapas, são a `situacao`
 * do Negócio (que preserva a última Etapa).
 *
 * `ordem` é única por Funil mas DEFERRABLE, para reordenar com um UPDATE só
 * (trocar duas Etapas de lugar passa por um estado intermediário duplicado).
 * A Etapa inicial é a de menor `ordem` (derivada).
 */
create table if not exists plataforma.etapas (
  id                    text        not null default gen_random_uuid()::text,
  workspace_id          text        not null,
  funil_id              text        not null,
  nome                  text        not null,
  ordem                 integer     not null,
  probabilidade_padrao  smallint    not null default 0,
  cor                   text,
  descricao             text,
  criado_em             timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, funil_id)
    references plataforma.funis (workspace_id, id) on delete cascade,
  -- Habilita a FK composta (funil_id, etapa_id) do Negócio.
  constraint etapas_funil_id_uq unique (workspace_id, funil_id, id),
  constraint etapas_nome_ck check (length(btrim(nome)) > 0),
  constraint etapas_probabilidade_ck check (probabilidade_padrao between 0 and 100),
  constraint etapas_ordem_uq unique (workspace_id, funil_id, ordem) deferrable initially immediate
);

create unique index if not exists etapas_nome_uq
  on plataforma.etapas (workspace_id, funil_id, lower(btrim(nome)));

/*
 * Negócio: a oportunidade comercial. Pertence a uma Empresa OU a um Contato
 * (exatamente um dos dois), e percorre um Funil, estando em uma Etapa dele.
 *
 * `situacao` (aberto/ganho/perdido) e `estado` (ativo/arquivado/na_lixeira) são
 * eixos independentes. Em ganho/perdido a Etapa é preservada (a última), por
 * isso Etapa nunca é nula.
 *
 * ON DELETE RESTRICT em Funil/Etapa: remover uma Etapa exige remapear os
 * Negócios antes (a ontologia proíbe deixar Negócio sem Etapa).
 */
create table if not exists plataforma.negocios (
  id                       text          not null default gen_random_uuid()::text,
  workspace_id             text          not null,
  titulo                   text          not null,
  objeto                   text,
  descricao                text,
  empresa_id               text,
  contato_id               text,
  funil_id                 text          not null,
  etapa_id                 text          not null,
  valor                    numeric(15,2),
  moeda                    char(3)       not null default 'BRL',
  -- Sobrescreve a probabilidade padrão da Etapa; nulo = usa a da Etapa.
  probabilidade            smallint,
  situacao                 text          not null default 'aberto',
  motivo_perda             text,
  motivo_ganho             text,
  nota_encerramento        text,
  origem                   text,
  data_prevista_fechamento date,
  encerrado_em             timestamptz,
  estado                   text          not null default 'ativo',
  proprietario_id          text          not null,
  criado_por               text          not null,
  criado_em                timestamptz   not null default now(),
  atualizado_em            timestamptz   not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, empresa_id) references plataforma.empresas (workspace_id, id),
  foreign key (workspace_id, contato_id) references plataforma.contatos (workspace_id, id),
  foreign key (workspace_id, funil_id) references plataforma.funis (workspace_id, id),
  foreign key (workspace_id, funil_id, etapa_id)
    references plataforma.etapas (workspace_id, funil_id, id),
  constraint negocios_titulo_ck check (length(btrim(titulo)) > 0),
  constraint negocios_dono_ck check (num_nonnulls(empresa_id, contato_id) = 1),
  constraint negocios_valor_ck check (valor is null or valor >= 0),
  constraint negocios_probabilidade_ck check (probabilidade is null or probabilidade between 0 and 100),
  constraint negocios_situacao_ck check (situacao in ('aberto', 'ganho', 'perdido')),
  constraint negocios_estado_ck check (estado in ('ativo', 'arquivado', 'na_lixeira')),
  -- Só um Negócio encerrado tem momento de encerramento; só perdido tem motivo de perda.
  constraint negocios_encerramento_ck check ((situacao = 'aberto') = (encerrado_em is null)),
  constraint negocios_motivo_perda_ck check (motivo_perda is null or situacao = 'perdido'),
  constraint negocios_motivo_ganho_ck check (motivo_ganho is null or situacao = 'ganho')
);

create index if not exists negocios_funil_etapa_idx
  on plataforma.negocios (workspace_id, funil_id, etapa_id) where estado = 'ativo';
create index if not exists negocios_empresa_idx
  on plataforma.negocios (workspace_id, empresa_id) where empresa_id is not null;
create index if not exists negocios_contato_idx
  on plataforma.negocios (workspace_id, contato_id) where contato_id is not null;
create index if not exists negocios_proprietario_idx
  on plataforma.negocios (workspace_id, proprietario_id);
create index if not exists negocios_situacao_idx
  on plataforma.negocios (workspace_id, situacao, estado);

drop trigger if exists negocios_atualizado_em on plataforma.negocios;
create trigger negocios_atualizado_em before update on plataforma.negocios
  for each row execute function plataforma.crm_toque_atualizado_em();
