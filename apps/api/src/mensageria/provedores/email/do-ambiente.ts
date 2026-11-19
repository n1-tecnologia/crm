/**
 * O provedor de e-mail montado com o ambiente do processo: a fábrica de conexões de produção (guarda de rede sem exceção), a
 * porta de acesso à credencial (banco e cofre do processo) e o bucket de anexos. É o que `registroPadrao()` liga.
 *
 * Sem `COFRE_CHAVE` não há provedor (D-17-03, F8): a credencial da caixa mora no cofre, e sem a chave nenhuma senha se lê nem
 * se renova. Um Canal `email-imap-smtp` real continua sem provedor e a Mensagem não é dada como enviada (MSG-05).
 */

import { pool as poolPadrao } from "../../../persistencia/conexao";
import { armazenamentoDeAnexosPadrao } from "../../../servicos/armazenamento-de-anexos";
import type { ProvedorDeMensageria } from "../../provedor";
import { acessoDoEmailDoAmbiente } from "./credencial";
import { criarFabricaDeConexao } from "./fabrica-de-conexao";
import { criarProvedorDeEmail } from "./provedor";

export function provedorDeEmailDoAmbiente(env: NodeJS.ProcessEnv = process.env): ProvedorDeMensageria | undefined {
  if ((env.COFRE_CHAVE ?? "").trim() === "") return undefined;
  return criarProvedorDeEmail({
    fabrica: criarFabricaDeConexao(),
    acesso: acessoDoEmailDoAmbiente(env),
    armazenamento: armazenamentoDeAnexosPadrao(),
    pool: poolPadrao,
  });
}
