/**
 * As instruções SQL da mesclagem de Contatos (14-09, 3.2.2): tudo o que passa do
 * absorvido para o sobrevivente nas tabelas do CRM. Quem decide a ordem e as
 * regras é `servicos/crm/mesclagem.ts`; aqui cada função faz UMA coisa e não
 * confere nada: o serviço já travou os dois Contatos (`travarDois`), já rodou
 * `validarMesclagem` e já resolveu a colisão de Conversas.
 *
 * Regras que valem em todo método:
 *   - todo `WHERE` leva `workspace_id = $1` (T-14-22): o Espaço vem do serviço,
 *     que o tira da sessão; nada aqui o deduz de outro lugar;
 *   - valores sempre `$n`, nunca interpolados; a ordenação é fixa;
 *   - o estado `mesclado` é gravado AQUI (`marcarMesclado`) e só aqui: o helper
 *     `escrita` de Contatos recusa o absorvido, e `definirEstado` não o aceita.
 *
 * O que NÃO se move: `conversa_marcacoes` (é da Conversa e do Membro, não do
 * Contato), as Mensagens (seguem na Conversa) e os campos adicionais do
 * absorvido (o modelo antigo também não os funde). Os consentimentos são
 * COPIADOS, não movidos: o histórico de cada Contato é só inserção.
 */

import type { PoolClient } from "pg";
import type { EstadoDoContato } from "@n1/dominio/crm/contatos";
import type { ConversaEmColisao } from "@n1/dominio/crm/mesclagem";

/** Os dois Contatos travados: o que o serviço precisa para validar e para dar nome às Atividades. */
export interface ContatoTravado {
  readonly id: string;
  readonly estado: EstadoDoContato;
  readonly nome: string | null;
  readonly sobrenome: string | null;
  /** O primeiro Identificador principal: o nome de exibição de quem não tem nome. */
  readonly identificadorPrincipal: string | null;
}

/**
 * Trava os dois Contatos com `for update`, EM ORDEM DE ID, e devolve os que
 * existem NESTE Espaço. Mesclar A em B e B em A ao mesmo tempo, sem a ordem,
 * é `40P01`; com ela, quem chega depois espera e encontra o absorvido `mesclado`.
 */
export async function travarDois(cliente: PoolClient, workspaceId: string, idA: string, idB: string): Promise<ContatoTravado[]> {
  const { rows } = await cliente.query<{
    id: string;
    estado: EstadoDoContato;
    nome: string | null;
    sobrenome: string | null;
    identificador_principal: string | null;
  }>(
    `select c.id, c.estado, c.nome, c.sobrenome,
            (select i.valor from plataforma.contato_identificadores i
              where i.workspace_id = c.workspace_id and i.contato_id = c.id and i.principal
              order by i.criado_em, i.id limit 1) as identificador_principal
       from plataforma.contatos c
      where c.workspace_id = $1 and c.id = any($2::text[])
      order by id
        for update of c`,
    [workspaceId, [idA, idB]],
  );
  return rows.map((linha) => ({
    id: linha.id,
    estado: linha.estado,
    nome: linha.nome,
    sobrenome: linha.sobrenome,
    identificadorPrincipal: linha.identificador_principal,
  }));
}

/** Uma Conversa aberta ou pendente de um dos dois, com o Canal em que pode colidir. */
export interface ConversaNaoResolvida extends ConversaEmColisao {
  readonly canalId: string;
}

/** As Conversas `aberta`/`pendente` e `ativa` dos dois Contatos, com a hora da última Mensagem de cada uma. */
export async function conversasNaoResolvidasDosDois(
  cliente: PoolClient,
  workspaceId: string,
  idA: string,
  idB: string,
): Promise<ConversaNaoResolvida[]> {
  const { rows } = await cliente.query<{ id: string; canal_id: string; criado_em: Date; ultima_mensagem_em: Date | null }>(
    `select c.id, c.canal_id, c.criado_em,
            (select max(m.criado_em) from plataforma.mensagens m
              where m.workspace_id = c.workspace_id and m.conversa_id = c.id) as ultima_mensagem_em
       from plataforma.conversas c
      where c.workspace_id = $1 and c.contato_id = any($2::text[])
        and c.situacao in ('aberta', 'pendente') and c.estado = 'ativo'
      order by c.id`,
    [workspaceId, [idA, idB]],
  );
  return rows.map((linha) => ({
    id: linha.id,
    canalId: linha.canal_id,
    criadoEm: linha.criado_em.toISOString(),
    ultimaMensagemEm: linha.ultima_mensagem_em?.toISOString() ?? null,
  }));
}

/** Resolve as Conversas dadas: o mesmo `update` de `definirSituacao` para `resolvida`. */
export async function resolverPorMesclagem(cliente: PoolClient, workspaceId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await cliente.query(
    `update plataforma.conversas
        set situacao = 'resolvida', resolvida_em = now(), adiada_ate = null, adiamento_motivo = null
      where workspace_id = $1 and id = any($2::text[])`,
    [workspaceId, ids],
  );
}

/**
 * Passa os Identificadores. O (tipo, valor) é único no Espaço inteiro, então não
 * há colisão; o que pode colidir é o PRINCIPAL (INV-CON-03): o do absorvido chega
 * `principal: false` quando o sobrevivente já tem principal do mesmo tipo. A
 * consulta lê o estado de antes da instrução, e o `update` rebaixa e move juntos.
 */
export async function moverIdentificadores(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<number> {
  const resultado = await cliente.query(
    `update plataforma.contato_identificadores i
        set contato_id = $3,
            principal = i.principal and not exists (
              select 1 from plataforma.contato_identificadores s
               where s.workspace_id = i.workspace_id and s.contato_id = $3 and s.tipo = i.tipo and s.principal)
      where i.workspace_id = $1 and i.contato_id = $2`,
    [workspaceId, absorvidoId, sobreviventeId],
  );
  return resultado.rowCount ?? 0;
}

/**
 * Passa as Conversas de qualquer situação e reescreve o Participante do tipo
 * contato: `sujeito.id` do absorvido vira o do sobrevivente, na mesma posição da
 * lista. O Canal e as Mensagens não mudam (INV-CXE-04).
 */
export async function moverConversas(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<number> {
  const resultado = await cliente.query(
    `update plataforma.conversas
        set contato_id = $3,
            participantes = (
              select coalesce(
                jsonb_agg(
                  case when p.item->'sujeito'->>'tipo' = 'contato' and p.item->'sujeito'->>'id' = $2::text
                       then jsonb_set(p.item, '{sujeito,id}', to_jsonb($3::text))
                       else p.item end
                  order by p.posicao),
                '[]'::jsonb)
                from jsonb_array_elements(participantes) with ordinality as p(item, posicao))
      where workspace_id = $1 and contato_id = $2`,
    [workspaceId, absorvidoId, sobreviventeId],
  );
  return resultado.rowCount ?? 0;
}

/** Passa os Negócios do absorvido (`negocios_dono_ck` segue satisfeita: só o Contato muda). */
export async function moverNegocios(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<number> {
  const resultado = await cliente.query(
    "update plataforma.negocios set contato_id = $3 where workspace_id = $1 and contato_id = $2",
    [workspaceId, absorvidoId, sobreviventeId],
  );
  return resultado.rowCount ?? 0;
}

/**
 * Passa os vínculos com Empresa. Onde os dois têm vínculo VIGENTE com a mesma
 * Empresa (`contato_empresa_vigente_uq`), eles se fundem: o do sobrevivente fica
 * com `admin = admin dele OU do absorvido`, e o do absorvido é encerrado (fica
 * no absorvido como histórico, não é apagado). Os demais, vigentes ou
 * encerrados, passam ao sobrevivente. O constraint trigger de admin da 007 é
 * deferido: quem era o único admin e deixou de ser no vínculo antigo já é admin
 * no do sobrevivente quando o `commit` confere.
 */
export async function fundirVinculosComEmpresa(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<number> {
  const fundidos = await cliente.query<{ id: string }>(
    `with colisoes as (
       select a.id as id_do_absorvido, s.id as id_do_sobrevivente, a.admin as admin_do_absorvido
         from plataforma.contato_empresa a
         join plataforma.contato_empresa s
           on s.workspace_id = a.workspace_id and s.empresa_id = a.empresa_id and s.contato_id = $3 and s.fim is null
        where a.workspace_id = $1 and a.contato_id = $2 and a.fim is null),
     ficam as (
       update plataforma.contato_empresa s
          set admin = s.admin or c.admin_do_absorvido
         from colisoes c
        where s.workspace_id = $1 and s.id = c.id_do_sobrevivente),
     encerrados as (
       update plataforma.contato_empresa a
          set fim = greatest(current_date, coalesce(a.inicio, current_date))
         from colisoes c
        where a.workspace_id = $1 and a.id = c.id_do_absorvido
        returning a.id)
     select id from encerrados`,
    [workspaceId, absorvidoId, sobreviventeId],
  );
  const passam = await cliente.query(
    `update plataforma.contato_empresa set contato_id = $3
      where workspace_id = $1 and contato_id = $2 and id <> all($4::text[])`,
    [workspaceId, absorvidoId, sobreviventeId, fundidos.rows.map((linha) => linha.id)],
  );
  return (passam.rowCount ?? 0) + fundidos.rows.length;
}

/** Passa as notas (o 14-06 não as moveu: a decisão é desta mesclagem). */
export async function moverNotas(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<number> {
  const resultado = await cliente.query(
    "update plataforma.contato_notas set contato_id = $3 where workspace_id = $1 and contato_id = $2",
    [workspaceId, absorvidoId, sobreviventeId],
  );
  return resultado.rowCount ?? 0;
}

/**
 * COPIA os consentimentos do absorvido para o sobrevivente, com ids novos e o
 * `registrado_por` original: o histórico é só inserção, então os originais
 * ficam no absorvido. A evidência (Mensagem) continua valendo, porque a Conversa
 * dela passou ao sobrevivente.
 */
export async function copiarConsentimentos(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<number> {
  const resultado = await cliente.query(
    `insert into plataforma.contato_consentimentos
       (workspace_id, contato_id, finalidade_id, tipo_de_canal, decisao, em, origem, evidencia_mensagem_id, registrado_por)
     select workspace_id, $3, finalidade_id, tipo_de_canal, decisao, em, origem, evidencia_mensagem_id, registrado_por
       from plataforma.contato_consentimentos
      where workspace_id = $1 and contato_id = $2
      order by registrado_em, id`,
    [workspaceId, absorvidoId, sobreviventeId],
  );
  return resultado.rowCount ?? 0;
}

/**
 * Acrescenta os Endereços do absorvido aos do sobrevivente, SEM principal (só um
 * Endereço é o principal). Sempre atualiza a linha, mesmo sem Endereço novo: é o
 * que faz o `atualizado_em` do sobrevivente subir.
 */
export async function acrescentarEnderecos(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<void> {
  await cliente.query(
    `update plataforma.contatos s
        set enderecos = s.enderecos || coalesce(
          (select jsonb_agg(e.item || '{"principal": false}'::jsonb order by e.posicao)
             from jsonb_array_elements(a.enderecos) with ordinality as e(item, posicao)),
          '[]'::jsonb)
       from plataforma.contatos a
      where s.workspace_id = $1 and s.id = $3 and a.workspace_id = $1 and a.id = $2`,
    [workspaceId, absorvidoId, sobreviventeId],
  );
}

/** RN-CON-14, sem cadeia: quem já era `mesclado` no absorvido passa a apontar o sobrevivente. */
export async function reapontarMescladosAnteriores(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<number> {
  const resultado = await cliente.query(
    "update plataforma.contatos set mesclado_em_id = $3 where workspace_id = $1 and estado = 'mesclado' and mesclado_em_id = $2",
    [workspaceId, absorvidoId, sobreviventeId],
  );
  return resultado.rowCount ?? 0;
}

/** O sobrevivente volta a `ativo` (era arquivado e o absorvido estava ativo). */
export async function ativarSobrevivente(cliente: PoolClient, workspaceId: string, sobreviventeId: string): Promise<void> {
  await cliente.query("update plataforma.contatos set estado = 'ativo' where workspace_id = $1 and id = $2 and estado = 'arquivado'", [
    workspaceId,
    sobreviventeId,
  ]);
}

/** O absorvido fica `mesclado`: estado, alvo e data andam juntos (`contatos_mesclado_ck`). */
export async function marcarMesclado(cliente: PoolClient, workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<void> {
  await cliente.query(
    "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
    [workspaceId, absorvidoId, sobreviventeId],
  );
}
