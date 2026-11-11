/**
 * O provedor do Instagram montado com o ambiente do processo: a configuração (`INSTAGRAM_*`), o banco do processo
 * (`instagram_remetentes`) e o cofre (`COFRE_CHAVE`, lido só quando um token precisa ser renovado). É o que
 * `registroPadrao()` liga. Sem as três variáveis obrigatórias (ou com `INSTAGRAM_REDIRECT_URI` inválida), não há
 * provedor: um Canal `instagram-graph` real continua sem provedor e a Mensagem não é dada como enviada (MSG-05).
 */

import { pool as poolPadrao } from "../../../persistencia/conexao";
import { lerChavesDoCofre } from "../../../servicos/cofre";
import type { ProvedorDeMensageria } from "../../provedor";
import { criarClienteDoInstagram } from "./cliente";
import { lerConfiguracaoDoInstagram, type ConfiguracaoDoInstagram } from "./configuracao";
import { criarProvedorInstagram } from "./provedor";
import { remetentesPg } from "./repositorio";
import { criarTokensPg } from "./token";

/** A configuração, ou `undefined` quando falta variável ou ela é inválida (o "Conectar" diz o que falta). */
export function configuracaoDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfiguracaoDoInstagram | undefined {
  try {
    return lerConfiguracaoDoInstagram(env);
  } catch {
    return undefined;
  }
}

export function provedorInstagramDoAmbiente(env: NodeJS.ProcessEnv = process.env): ProvedorDeMensageria | undefined {
  const configuracao = configuracaoDoAmbiente(env);
  if (!configuracao) return undefined;
  const cliente = criarClienteDoInstagram(configuracao);
  return criarProvedorInstagram({
    configuracao,
    cliente,
    remetentes: remetentesPg(poolPadrao),
    tokens: criarTokensPg({ pool: poolPadrao, chaves: () => lerChavesDoCofre(env), cliente }),
  });
}
