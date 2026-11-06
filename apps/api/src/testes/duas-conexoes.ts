/**
 * O molde de dois clientes dos testes de concorrência do CRM (Fase 15, D-15-07).
 *
 * Um cliente "A" abre uma transação à mão e segura travas; o serviço sob teste é o cliente "B". O
 * teste só prova a ordem de travas se B de fato ESPERA A: por isso `aindaPendenteApos` olha a promessa
 * de B antes de A confirmar. SÓ Postgres local (via `poolDoDono`, que recusa host remoto).
 */

import type { PoolClient } from "pg";
import { poolDoDono } from "./banco-crm";

/** Uma transação aberta por A, que o teste confirma (ou desfaz) quando quiser. */
export interface TransacaoDeA {
  readonly cliente: PoolClient;
  confirmar(): Promise<void>;
  desfazer(): Promise<void>;
}

/** `begin` num cliente do dono do banco local. */
export async function abrirTransacaoDeA(): Promise<TransacaoDeA> {
  const cliente = await poolDoDono().connect();
  await cliente.query("begin");
  let aberta = true;
  const encerrar = async (comando: "commit" | "rollback") => {
    if (!aberta) return;
    aberta = false;
    try {
      await cliente.query(comando);
    } finally {
      cliente.release();
    }
  };
  return { cliente, confirmar: () => encerrar("commit"), desfazer: () => encerrar("rollback") };
}

/**
 * A mesclagem de `absorvido` em `sobrevivente`, ainda sem confirmar: A trava o Contato absorvido
 * (`for update`, como a mesclagem real) e o marca `mesclado`. Só o `commit` de A o torna visível.
 */
export async function mesclarSemConfirmar(workspaceId: string, absorvidoId: string, sobreviventeId: string): Promise<TransacaoDeA> {
  const a = await abrirTransacaoDeA();
  try {
    await a.cliente.query("select 1 from plataforma.contatos where workspace_id = $1 and id = $2 for update", [workspaceId, absorvidoId]);
    await a.cliente.query(
      "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
      [workspaceId, absorvidoId, sobreviventeId],
    );
  } catch (erro) {
    await a.desfazer();
    throw erro;
  }
  return a;
}

/** Verdadeiro se a promessa ainda não se resolveu (nem recusou) `ms` milissegundos depois: B está esperando. */
export async function aindaPendenteApos(promessa: Promise<unknown>, ms: number): Promise<boolean> {
  return Promise.race([
    promessa.then(
      () => false,
      () => false,
    ),
    new Promise<boolean>((resolver) => setTimeout(() => resolver(true), ms)),
  ]);
}
