/**
 * Monta o CRM novo: REST por recurso (D-03), fora do despacho genérico por
 * operação (`POST /operacoes/:nome`) e da hidratação do Espaço. Erro de regra
 * nunca viaja em 200 — 400/403/404/409 com o envelope de `./comum.ts`.
 *
 * Registrado na raiz de `app.ts`, depois de `rotasDeFinanceiro`: herda o hook
 * de JWT, e `request.membro` já chega resolvido. `acesso` (07-02) é a
 * permissão por Papel; os planos seguintes acrescentam `funis`, `empresas` e
 * `negocios`.
 */

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { pool } from "../../persistencia/conexao";
import { criarAcessoAoCrmPg, type AcessoAoCrm } from "../../servicos/crm/acesso";
import { criarServicoDeContatos, type ServicoDeContatos } from "../../servicos/crm/contatos";
import { rotasDeContatos } from "./contatos";

export interface OpcoesDeCrm {
  /** Padrão: o `pool()` do processo. Só é chamado quando uma requisição chega, nunca na montagem. */
  readonly pool?: () => Pool;
  /** Injeção só para teste: troca o serviço real por um falso, sem banco. */
  readonly contatos?: ServicoDeContatos;
  /** Padrão: lê Papel e Membro de `plataforma.registros`. Injeção para teste sem banco. */
  readonly acesso?: AcessoAoCrm;
}

export async function rotasDeCrm(app: FastifyInstance, opcoes: OpcoesDeCrm = {}): Promise<void> {
  const obterPool = opcoes.pool ?? pool;
  const acesso = opcoes.acesso ?? criarAcessoAoCrmPg(obterPool);
  const contatos = opcoes.contatos ?? criarServicoDeContatos({ pool: obterPool, acesso });
  await app.register(rotasDeContatos, { servico: contatos });
}
