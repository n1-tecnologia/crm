-- Concede ao papel n1_api o que a 009 concederia - para quando o papel nasce
-- DEPOIS da 009 (Fase 9, SEG-04; "Claude's Discretion" do CONTEXT).
--
-- Por que existe: a 009 so concede a n1_api SE o papel ja existir quando ela
-- roda, e uma migracao aplicada nao pode ser editada. Este arquivo fica FORA de
-- apps/api/migracoes/ de proposito: migrar() so le aquela pasta, entao ele nunca
-- e aplicado como migracao nem registrado em plataforma.migracoes. Roda por
-- `npm run banco:conceder` (com DATABASE_URL_MIGRACAO - o dono do banco), a cada
-- deploy depois do `migrar`.
--
-- Idempotente: grant e alter default privileges repetidos nao falham nem mudam
-- nada. O bloco abaixo e o mesmo do item (b) da 009; um teste compara a matriz
-- de privilegios dos dois caminhos (apps/api/src/seguranca/banco-n1-api.test.ts).
--
-- n1_api: so DML. Nunca superusuario, nunca bypassrls, nunca DDL, nunca escreve
-- em plataforma.migracoes.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'n1_api') then
    grant usage on schema plataforma to n1_api;
    grant select, insert, update, delete on all tables in schema plataforma to n1_api;
    grant usage, select on all sequences in schema plataforma to n1_api;
    grant execute on all functions in schema plataforma to n1_api;
    alter default privileges in schema plataforma grant select, insert, update, delete on tables to n1_api;
    alter default privileges in schema plataforma grant usage, select on sequences to n1_api;
    alter default privileges in schema plataforma grant execute on functions to n1_api;
    revoke insert, update, delete, truncate on plataforma.migracoes from n1_api;
  end if;
end $$;
