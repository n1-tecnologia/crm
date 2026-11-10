/**
 * O Contato do Participante de Grupo nas tabelas do CRM (Fase 15, 3.4.8, UCR-08): achar o Contato
 * de um número de WhatsApp e inserir, no commit do gesto, os que a operação decidiu criar.
 *
 * Duas funções, as duas no `PoolClient` do gesto (`executar()`):
 *   - `resolverContatosPorWhatsapp` roda na LEITURA, antes da operação pura: procura por
 *     Identificador `whatsapp` em `plataforma.contato_identificadores` e, se o Contato foi mesclado,
 *     devolve o sobrevivente (B14);
 *   - `inserirContatosDeParticipantes` roda no `aoConfirmar`, depois do `ok` do domínio: a operação
 *     pura nunca insere nada (a prohibition do plano 15-17).
 *
 * Regras que valem aqui:
 *   - todo `WHERE` leva `workspace_id = $1`, o Espaço vem da sessão (T-14-14);
 *   - valores sempre `$n`, nunca interpolados;
 *   - o número de telefone NUNCA vai para log nem para mensagem de erro (T-15-44): os erros
 *     dizem contagens;
 *   - se o par (tipo, valor) já existe, `contato_identificadores_unico` derruba a transação inteira:
 *     é a rede de segurança da corrida, a trava do Espaço em `executar()` é a primeira linha.
 */

import type { PoolClient } from "pg";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { normalizarWhatsapp } from "@n1/dominio/crm/normalizacao";
import type { ContatoResumido } from "../../rotas/gesto-no-crm/tipos";

/** Acima disso a lista deixou de ser "os Participantes de uma operação": é erro de quem chama. */
export const TETO_DE_NUMEROS_A_RESOLVER = 5000;

/** O valor canônico de um número de WhatsApp: `+<dígitos>` (o número do provedor já traz o DDI). */
export function whatsappCanonico(numero: string): string | undefined {
  const digitos = numero.replace(/\D/g, "");
  if (digitos === "") return undefined;
  const normalizado = normalizarWhatsapp(`+${digitos}`);
  return normalizado.ok ? normalizado.value : undefined;
}

/**
 * Os Contatos dos `numeros`, um item por número achado: o `id` é o do Contato que o Identificador
 * resolve (o sobrevivente, se mesclado) e `whatsapp` é o Identificador pelo qual ele foi achado, não
 * o principal do sobrevivente, para a operação casar por número. Número sem Contato não volta.
 * Acha o valor canônico (`+<dígitos>`) e o antigo sem o `+`.
 */
export async function resolverContatosPorWhatsapp(cliente: PoolClient, workspaceId: string, numeros: readonly string[]): Promise<ContatoResumido[]> {
  const unicos = [...new Set(numeros.map((n) => n.replace(/\D/g, "")).filter((d) => d !== ""))];
  if (unicos.length > TETO_DE_NUMEROS_A_RESOLVER) {
    throw new Error(`resolverContatosPorWhatsapp: no máximo ${TETO_DE_NUMEROS_A_RESOLVER} números por consulta.`);
  }
  if (unicos.length === 0) return [];
  const candidatos = unicos.flatMap((d) => [`+${d}`, d]);
  const { rows } = await cliente.query<{ valor: string; id: string; nome: string | null; sobrenome: string | null; estado: string }>(
    `select i.valor, r.id, r.nome, r.sobrenome, r.estado
       from plataforma.contato_identificadores i
       join plataforma.contatos c on c.workspace_id = i.workspace_id and c.id = i.contato_id
       join plataforma.contatos r on r.workspace_id = c.workspace_id and r.id = coalesce(c.mesclado_em_id, c.id)
      where i.workspace_id = $1 and i.tipo = 'whatsapp' and i.valor = any($2::text[])
      order by i.valor, i.criado_em, i.id`,
    [workspaceId, candidatos],
  );
  return rows.map((linha) => ({
    id: linha.id,
    nome: nomeDeExibicaoDoContato(linha, linha.valor),
    estado: linha.estado,
    whatsapp: linha.valor,
  }));
}

/** Um Contato de Participante a inserir: o `id` veio da leitura (gerado pelo servidor). */
export interface LinhaDeContatoDeParticipante {
  readonly id: string;
  /** O número como o provedor o deu; o repositório o normaliza para `+<dígitos>`. */
  readonly numero: string;
  /** Como o Identificador se mostra (`+55 11 97000-2474`). */
  readonly valorExibido: string;
  readonly proprietarioId: string;
  /** Origem padrão do Canal pelo nome (a coluna é texto livre), quando há. */
  readonly origem?: string | undefined;
}

/**
 * Insere os Contatos (`modo_criacao = 'automatico_automacao'`, sem nome: o de exibição é o número) e o
 * Identificador `whatsapp` principal e verificado de cada um, em lote e no mesmo cliente do gesto.
 * Lista vazia não consulta. Devolve quantos Contatos entraram.
 */
export async function inserirContatosDeParticipantes(
  cliente: PoolClient,
  workspaceId: string,
  criadoPor: string,
  linhas: readonly LinhaDeContatoDeParticipante[],
): Promise<number> {
  if (linhas.length === 0) return 0;
  const valores: string[] = [];
  for (const linha of linhas) {
    const canonico = whatsappCanonico(linha.numero);
    if (!canonico) throw new Error("inserirContatosDeParticipantes: um número de Participante não normaliza.");
    valores.push(canonico);
  }
  await cliente.query(
    `insert into plataforma.contatos (id, workspace_id, origem, modo_criacao, proprietario_id, criado_por)
     select u.id, $1, u.origem, 'automatico_automacao', u.proprietario_id, $2
       from unnest($3::text[], $4::text[], $5::text[]) as u(id, origem, proprietario_id)`,
    [workspaceId, criadoPor, linhas.map((l) => l.id), linhas.map((l) => l.origem ?? null), linhas.map((l) => l.proprietarioId)],
  );
  await cliente.query(
    `insert into plataforma.contato_identificadores (workspace_id, contato_id, tipo, valor, valor_exibido, verificado, principal)
     select $1, u.contato_id, 'whatsapp', u.valor, u.exibido, true, true
       from unnest($2::text[], $3::text[], $4::text[]) as u(contato_id, valor, exibido)`,
    [workspaceId, linhas.map((l) => l.id), valores, linhas.map((l) => l.valorExibido)],
  );
  return linhas.length;
}
