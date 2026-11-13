/**
 * O SQL do WhatsApp oficial: o número conectado a um Canal (015) e a credencial no cofre (009). Só o provedor do
 * WhatsApp oficial usa esta tabela; o Canal continua sendo de `repositorios/crm/canais.ts`, e o Contato, de
 * `receberMensagem`. O molde é o de `../instagram/repositorio.ts`.
 */

import type { Pool, PoolClient } from "pg";
import { guardarCredencial, type ChavesDoCofre } from "../../../servicos/cofre";

type Cliente = Pick<Pool | PoolClient, "query">;

/**
 * O `tipo` da credencial do Canal no cofre: o nome do provedor, como a Evolution e o Instagram. É o que
 * `canalParaProvedor` decifra e o que `ligadoAoProvedor` confere para esconder "Simular conexão".
 */
export const TIPO_DA_CREDENCIAL = "whatsapp-cloud";

/** O que o cofre guarda do Canal: os dois ids e o token. Nunca vai a log, a resposta nem a erro. */
export interface CredencialDaCloudApi {
  readonly phoneNumberId: string;
  readonly wabaId: string;
  readonly token: string;
}

export function lerCredencialDaCloudApi(texto: string | undefined): CredencialDaCloudApi | undefined {
  if (texto === undefined || texto === "") return undefined;
  try {
    const lida: unknown = JSON.parse(texto);
    if (typeof lida !== "object" || lida === null) return undefined;
    const { phoneNumberId, wabaId, token } = lida as Record<string, unknown>;
    if (typeof phoneNumberId !== "string" || phoneNumberId === "") return undefined;
    if (typeof wabaId !== "string" || wabaId === "") return undefined;
    if (typeof token !== "string" || token === "") return undefined;
    return { phoneNumberId, wabaId, token };
  } catch {
    return undefined;
  }
}

export async function guardarCredencialDaCloudApi(
  cliente: Cliente,
  chaves: ChavesDoCofre,
  dono: { readonly workspaceId: string; readonly canalId: string },
  credencial: CredencialDaCloudApi,
): Promise<void> {
  await guardarCredencial(cliente, chaves, {
    workspaceId: dono.workspaceId,
    donoTipo: "canal",
    donoId: dono.canalId,
    tipo: TIPO_DA_CREDENCIAL,
    segredo: JSON.stringify(credencial),
  });
}

export interface NumeroConectado {
  readonly workspaceId: string;
  readonly canalId: string;
  readonly phoneNumberId: string;
  readonly wabaId: string;
  readonly numeroExibido: string;
}

interface LinhaDeNumero {
  readonly workspace_id: string;
  readonly canal_id: string;
  readonly phone_number_id: string;
  readonly waba_id: string;
  readonly numero_exibido: string;
}

const COLUNAS = "workspace_id, canal_id, phone_number_id, waba_id, numero_exibido";

function paraNumero(linha: LinhaDeNumero): NumeroConectado {
  return {
    workspaceId: linha.workspace_id,
    canalId: linha.canal_id,
    phoneNumberId: linha.phone_number_id,
    wabaId: linha.waba_id,
    numeroExibido: linha.numero_exibido,
  };
}

export async function numeroDoCanal(cliente: Cliente, workspaceId: string, canalId: string): Promise<NumeroConectado | undefined> {
  const { rows } = await cliente.query<LinhaDeNumero>(
    `select ${COLUNAS} from plataforma.whatsapp_cloud_numeros where workspace_id = $1 and canal_id = $2`,
    [workspaceId, canalId],
  );
  return rows[0] ? paraNumero(rows[0]) : undefined;
}

/** O webhook não conhece o Espaço: acha o número pelo `metadata.phone_number_id`, em toda a plataforma. */
export async function numeroPeloId(cliente: Cliente, phoneNumberId: string): Promise<NumeroConectado | undefined> {
  const { rows } = await cliente.query<LinhaDeNumero>(
    `select ${COLUNAS} from plataforma.whatsapp_cloud_numeros where phone_number_id = $1`,
    [phoneNumberId],
  );
  return rows[0] ? paraNumero(rows[0]) : undefined;
}

export async function gravarNumero(cliente: Cliente, numero: NumeroConectado & { readonly conectadoPor: string }): Promise<void> {
  await cliente.query(
    `insert into plataforma.whatsapp_cloud_numeros (workspace_id, canal_id, phone_number_id, waba_id, numero_exibido, conectado_por)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (workspace_id, canal_id) do update
       set phone_number_id = excluded.phone_number_id, waba_id = excluded.waba_id, numero_exibido = excluded.numero_exibido,
           conectado_por = excluded.conectado_por, conectado_em = now()`,
    [numero.workspaceId, numero.canalId, numero.phoneNumberId, numero.wabaId, numero.numeroExibido, numero.conectadoPor],
  );
}

/**
 * Desconectar e arquivar: somem o número e a credencial, APAGADA do cofre (não só revogada), para o token não ficar
 * parado depois que a empresa tirou o número do CRM. As Conversas e Mensagens ficam: são dado do cliente da plataforma.
 */
export async function esquecerNumero(cliente: Cliente, workspaceId: string, canalId: string): Promise<void> {
  await cliente.query("delete from plataforma.whatsapp_cloud_numeros where workspace_id = $1 and canal_id = $2", [workspaceId, canalId]);
  await cliente.query(
    "delete from plataforma.credenciais where workspace_id = $1 and dono_tipo = 'canal' and dono_id = $2 and tipo = $3",
    [workspaceId, canalId, TIPO_DA_CREDENCIAL],
  );
}
