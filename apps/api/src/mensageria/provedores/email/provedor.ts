/**
 * O provedor de e-mail (Fase 17, 17-09, D-17-03, D-17-10): a implementação de `ProvedorDeMensageria` para o Canal
 * `email-imap-smtp`, sobre a saída (`envio.ts`), o tradutor do que o leitor enfileirou (`traduzir.ts`) e a fábrica de
 * conexões (`fabrica-de-conexao.ts`).
 *
 * O e-mail BUSCA em vez de ser chamado (`semWebhook`): `verificarChamada` recusa SEMPRE, então a rota pública de webhook
 * responde a mesma 401 e ninguém de fora injeta e-mail na fila de entrada (T-17-17). Quem enfileira é o leitor (17-10), e
 * `interpretarChamada` traduz o corpo `v: 1` que ele gravou.
 *
 * `baixarMidia` relê a mensagem da INBOX pela referência `<uidValidity>:<uid>:<índice>` que o tradutor deu ao arquivo: o
 * anexo que ficou `baixado: false` pode ser buscado de novo. `UIDVALIDITY` diferente (a caixa foi recriada) ou mensagem que
 * sumiu é `MIDIA_INDISPONIVEL`: o UID de antes já não aponta para a mesma mensagem.
 *
 * Nada aqui loga nem carrega no erro senha, token, endereço ou texto do servidor.
 */

import { simpleParser } from "mailparser";
import type { ConexaoDoCanal } from "@n1/dominio/crm/canais";
import { ErroDeProvedor, type CanalParaProvedor, type EventoDoProvedor, type MidiaBaixada, type ProvedorDeMensageria } from "../../provedor";
import { criarEnvioDeEmail, type DependenciasDoEnvioDeEmail } from "./envio";
import { contaDoCanal } from "./repositorio";
import { chaveDoCorpo, eventosDoCorpo, TETO_DO_EMAIL_RECEBIDO_BYTES, TETO_DO_HTML_GUARDADO_BYTES } from "./traduzir";
import { pool as poolPadrao } from "../../../persistencia/conexao";

export type DependenciasDoProvedorDeEmail = DependenciasDoEnvioDeEmail;

/** A pasta que o leitor lê e onde o anexo é relido (a do cursor gravado na conexão). */
const PASTA_LIDA = "INBOX";
const REFERENCIA_DO_ANEXO = /^(\d{1,20}):(\d{1,10}):(\d{1,6})$/;
const FRASE_CAIXA_FORA_DO_AR = "A caixa de e-mail não respondeu agora.";

export function criarProvedorDeEmail(deps: DependenciasDoProvedorDeEmail): ProvedorDeMensageria {
  const envio = criarEnvioDeEmail(deps);
  const pool = deps.pool ?? poolPadrao;
  const contas = deps.contas ?? ((workspaceId: string, canalId: string) => contaDoCanal(pool(), workspaceId, canalId));

  async function baixarMidia(canal: CanalParaProvedor, referenciaNoProvedor: string, opcoes: { tetoBytes: number }): Promise<MidiaBaixada> {
    const partes = REFERENCIA_DO_ANEXO.exec(referenciaNoProvedor);
    if (!partes) throw new ErroDeProvedor("MIDIA_INDISPONIVEL");
    const [, uidValidity, uidTexto, indiceTexto] = partes as unknown as [string, string, string, string];
    const uid = Number(uidTexto);
    const indice = Number(indiceTexto);
    if (!Number.isSafeInteger(uid) || uid < 1) throw new ErroDeProvedor("MIDIA_INDISPONIVEL");

    try {
      const conta = await contas(canal.workspaceId, canal.canal.id);
      if (!conta) throw new ErroDeProvedor("CREDENCIAL_AUSENTE", "O Canal não tem a conta de e-mail.");
      const acesso = await deps.acesso.acessoParaUsar(canal);
      if (!acesso.ok) {
        throw new ErroDeProvedor(acesso.permanente ? "CREDENCIAL_AUSENTE" : "PROVEDOR_INDISPONIVEL", acesso.motivo);
      }

      const cliente = await deps.fabrica.abrirImap({ host: conta.imap.host, porta: conta.imap.porta, auth: acesso.auth, uso: "envio" });
      try {
        const trava = await cliente.getMailboxLock(PASTA_LIDA);
        try {
          // O UID só vale dentro do mesmo UIDVALIDITY: a caixa recriada renumera, e o mesmo UID seria outra mensagem.
          if (cliente.mailbox === false || cliente.mailbox.uidValidity.toString() !== uidValidity) throw new ErroDeProvedor("MIDIA_INDISPONIVEL");
          const tamanho = await cliente.fetchOne(String(uid), { uid: true, size: true }, { uid: true });
          if (tamanho === false) throw new ErroDeProvedor("MIDIA_INDISPONIVEL");
          if ((tamanho.size ?? 0) > TETO_DO_EMAIL_RECEBIDO_BYTES) throw new ErroDeProvedor("MIDIA_GRANDE_DEMAIS");
          const lida = await cliente.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
          if (lida === false || lida.source === undefined) throw new ErroDeProvedor("MIDIA_INDISPONIVEL");
          const mail = await simpleParser(lida.source, { maxHtmlLengthToParse: TETO_DO_HTML_GUARDADO_BYTES, checksumAlgo: false });
          const anexo = mail.attachments[indice];
          if (!anexo) throw new ErroDeProvedor("MIDIA_INDISPONIVEL");
          if (anexo.content.byteLength > opcoes.tetoBytes) throw new ErroDeProvedor("MIDIA_GRANDE_DEMAIS");
          return {
            bytes: anexo.content,
            tipoDeMidia: anexo.contentType,
            ...(anexo.filename === undefined || anexo.filename === "" ? {} : { nome: anexo.filename }),
          };
        } finally {
          trava.release();
        }
      } finally {
        try {
          await cliente.logout();
        } catch {
          try {
            cliente.close();
          } catch {
            // já fechado
          }
        }
      }
    } catch (erro) {
      if (erro instanceof ErroDeProvedor) throw erro;
      // O erro do cliente IMAP pode citar host, usuário ou texto do servidor: nada disso sobe.
      throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", FRASE_CAIXA_FORA_DO_AR);
    }
  }

  return {
    provedor: "email-imap-smtp",
    semWebhook: true,
    verificarChamada: () => false,
    interpretarChamada: (corpo: unknown, canal: CanalParaProvedor): readonly EventoDoProvedor[] =>
      eventosDoCorpo(corpo, canal.canal.identificadorExterno),
    chaveDaChamada: chaveDoCorpo,
    enviar: envio.enviar,
    idExternoDoEnvio: envio.idExternoDoEnvio,
    baixarMidia,
    async estadoDaConexao(canal: CanalParaProvedor): Promise<ConexaoDoCanal> {
      return canal.canal.conexao;
    },
  };
}
