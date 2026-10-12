/**
 * Monta o CRM novo: REST por recurso (D-03), fora do despacho genérico por
 * operação (`POST /operacoes/:nome`) e da hidratação do Espaço. Erro de regra
 * nunca viaja em 200 — 400/403/404/409 com o envelope de `./comum.ts`.
 *
 * Registrado na raiz de `app.ts`, depois de `rotasDeFinanceiro`: herda o hook
 * de JWT, e `request.membro` já chega resolvido. `acesso` (07-02) é a
 * permissão por Papel; `contatos` (07-03), `funis` (07-04, a configuração de
 * Funis e Etapas), `empresas` (07-05, Empresa e o vínculo Contato-Empresa) e
 * `negocios` (07-08, o CRUD e as ações do quadro: mover, ganhar, perder,
 * reabrir) são os quatro recursos do CRM. `canais` (08-01, Fase 8) é o quinto:
 * a conta conectada de um provedor, com a 008 e a ponte de `GET /estado`.
 * `conversas` (08-06) é o sexto: a Conversa relacional, aberta com a primeira
 * Mensagem numa transação só.
 */

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { pool } from "../../persistencia/conexao";
import { criarAcessoAoCrmPg, type AcessoAoCrm } from "../../servicos/crm/acesso";
import { criarServicoDeCanais, type ServicoDeCanais } from "../../servicos/crm/canais";
import { criarServicoDeContatos, type ServicoDeContatos } from "../../servicos/crm/contatos";
import { criarServicoDeConversas, type ServicoDeConversas } from "../../servicos/crm/conversas";
import { criarServicoDeEmpresas, type ServicoDeEmpresas } from "../../servicos/crm/empresas";
import { criarServicoDeFunis, type ServicoDeFunis } from "../../servicos/crm/funis";
import { criarServicoDeNegocios, type ServicoDeNegocios } from "../../servicos/crm/negocios";
import { rotasDeCanais } from "./canais";
import { rotasDeContatos } from "./contatos";
import { rotasDeConversas } from "./conversas";
import { rotasDeEmpresas } from "./empresas";
import { rotasDeFunis } from "./funis";
import { rotasDeNegocios } from "./negocios";

export interface OpcoesDeCrm {
  /** Padrão: o `pool()` do processo. Só é chamado quando uma requisição chega, nunca na montagem. */
  readonly pool?: () => Pool;
  /** Injeção só para teste: troca o serviço real por um falso, sem banco. */
  readonly contatos?: ServicoDeContatos;
  /** Injeção só para teste: troca o serviço real de Empresas por um falso, sem banco. */
  readonly empresas?: ServicoDeEmpresas;
  /** Injeção só para teste: troca o serviço real de Funis por um falso, sem banco. */
  readonly funis?: ServicoDeFunis;
  /** Injeção só para teste: troca o serviço real de Negócios por um falso, sem banco. */
  readonly negocios?: ServicoDeNegocios;
  /** Injeção só para teste: troca o serviço real de Canais por um falso, sem banco. */
  readonly canais?: ServicoDeCanais;
  /** Injeção só para teste: troca o serviço real de Conversas por um falso, sem banco. */
  readonly conversas?: ServicoDeConversas;
  /** Padrão: lê Papel e Membro de `plataforma.registros`. Injeção para teste sem banco. */
  readonly acesso?: AcessoAoCrm;
}

export async function rotasDeCrm(app: FastifyInstance, opcoes: OpcoesDeCrm = {}): Promise<void> {
  const obterPool = opcoes.pool ?? pool;
  const acesso = opcoes.acesso ?? criarAcessoAoCrmPg(obterPool);
  const contatos = opcoes.contatos ?? criarServicoDeContatos({ pool: obterPool, acesso });
  await app.register(rotasDeContatos, { servico: contatos });
  const funis = opcoes.funis ?? criarServicoDeFunis({ pool: obterPool, acesso });
  await app.register(rotasDeFunis, { servico: funis });
  const empresas = opcoes.empresas ?? criarServicoDeEmpresas({ pool: obterPool, acesso });
  await app.register(rotasDeEmpresas, { servico: empresas });
  const negocios = opcoes.negocios ?? criarServicoDeNegocios({ pool: obterPool, acesso });
  await app.register(rotasDeNegocios, { servico: negocios });
  const canais = opcoes.canais ?? criarServicoDeCanais({ pool: obterPool, acesso });
  await app.register(rotasDeCanais, { servico: canais });
  const conversas = opcoes.conversas ?? criarServicoDeConversas({ pool: obterPool, acesso });
  await app.register(rotasDeConversas, { servico: conversas });
}
