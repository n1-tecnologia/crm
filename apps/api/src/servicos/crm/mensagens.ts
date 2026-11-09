/**
 * Serviço de Mensagens (08-12): o fio de uma Conversa relacional e o envio
 * humano. A `recebida` não entra por aqui: a única porta dela é
 * `receberMensagem` (`recebimento.ts`, 3.6.2).
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui. O Papel é exigido ANTES de qualquer leitura ou
 * transação, e a forma (`validarNovaMensagem`) antes de abrir a transação.
 *
 * Regras de produto aplicadas aqui, todas vindas do domínio:
 *   - RN-CXE-19 / D-02: fora da janela de resposta, só Mensagem de modelo
 *     aprovada sai — e o que decide é o par (tipo, provedor) do Canal, via
 *     `capacidadesDoCanal` + `validarEnvio`. Esta fase não tem Mensagens de
 *     modelo (`modelosAprovados: []`): o WhatsApp oficial fora da janela recebe
 *     409 `JANELA_EXPIRADA` com `campo: "modelo"`; o não oficial nunca é
 *     barrado por janela. É o servidor que recusa, independente da tela.
 *   - B69 + 3.7.1 (MSG-02): `enviada` nasce SEMPRE `pendente`
 *     (`statusInicialDeEnvio`: só o provedor diz que saiu). Num Canal `conectada` entra, no
 *     MESMO cliente da transação, uma linha `mensagem.enviar.v1` no outbox
 *     (`enfileirarEnvio`); se ela falha, a Mensagem também não fica. Num Canal fora do ar a
 *     Mensagem é só guardada, sem linha. `interna` não tem status de entrega, não enfileira e
 *     não passa pela janela (INV-CXE-09).
 *   - 3.2.4: o modelo de marketing só sai se o consentimento vigente do Contato, para
 *     o tipo do Canal, é `concedido` — 409 `SEM_CONSENTIMENTO` (campo `modelo`). A regra
 *     é `recusaPorFaltaDeConsentimento` do domínio; quem diz a categoria do modelo é
 *     `deps.categoriaDoModelo`, que a Sessão 7 preenche (hoje ninguém, e a rota
 *     `POST /mensagens` não manda modelo).
 *   - INV-CXE-10: "em resposta a" é da MESMA Conversa; a FK composta da 008 é a
 *     rede e `FRASES` a traduz, sem o nome do constraint.
 *   - INV-CXE-08 / RN-CXE-17: a idempotência por (Canal, id externo), a
 *     reabertura e o Contato da `recebida` são de `receberMensagem`, não daqui.
 *
 * Nem o `conteudo` nem a `cargaBruta` são escritos em log (T-08-46).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { Conversa } from "@n1/dominio/crm/conversas";
import { recusaPorFaltaDeConsentimento } from "@n1/dominio/crm/consentimentos";
import { statusInicialDeEnvio, validarEnvio, validarNovaMensagem, type Mensagem, type NovaMensagem } from "@n1/dominio/crm/mensagens";
import { capacidadesDoCanal } from "@n1/dominio/crm/capacidades";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { enfileirarEnvio } from "../../mensageria/fila-de-saida";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeConsentimentosPg } from "../../repositorios/crm/consentimentos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg, type FiltroDeMensagens } from "../../repositorios/crm/mensagens";
import { finalidadeDeMarketing } from "../../repositorios/crm/referencias";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface ServicoDeMensagens {
  listar(membro: MembroDaSessao, filtro: FiltroDeMensagens): Promise<ResultadoCrm<Pagina<Mensagem>>>;
  enviar(membro: MembroDaSessao, entrada: NovaMensagem): Promise<ResultadoCrm<Mensagem>>;
}

/** Rede de SQLSTATE: a FK composta de "em resposta a" (INV-CXE-10) vira esta frase, sem o nome dela. */
const FRASES: FrasesDeRestricao = {
  mensagens_workspace_id_conversa_id_em_resposta_a_id_fkey: {
    codigo: "RESPOSTA_DE_OUTRA_CONVERSA",
    error: "A Mensagem respondida é de outra Conversa.",
  },
};

const conversaNaoEncontrada = () =>
  recusa<never>(404, "Conversa não encontrada.", { codigo: "CONVERSA_NAO_ENCONTRADA", campo: "conversaId" });

function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}

export function criarServicoDeMensagens(deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
  /**
   * A categoria do modelo que esta Mensagem usa (`"marketing"`, `"utilidade"`...), ou `undefined`
   * para texto livre. Os modelos chegam na Sessão 7 (Fase 16): `NovaMensagem` ainda não tem campo
   * de modelo, então hoje ninguém passa isto e o envio segue como estava. Quando passa, o modelo
   * de marketing só sai com consentimento vigente (3.2.4).
   */
  readonly categoriaDoModelo?: (cliente: PoolClient, workspaceId: string, conversa: Conversa, entrada: NovaMensagem) => Promise<string | undefined>;
  /** Quem enfileira o envio. Só o teste de rollback troca o padrão (`enfileirarEnvio`). */
  readonly enfileirar?: typeof enfileirarEnvio;
}): ServicoDeMensagens {
  const enfileirar = deps.enfileirar ?? enfileirarEnvio;
  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "mensagem");
      if (negado) return { ok: false, ...negado };

      const pool = deps.pool();
      const conversa = await criarRepositorioDeConversasPg(pool).obter(membro.workspaceId, filtro.conversaId);
      if (!conversa) return conversaNaoEncontrada();
      return sucesso(await criarRepositorioDeMensagensPg(pool).listar(membro.workspaceId, filtro));
    },

    async enviar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "enviar", "mensagem");
      if (negado) return { ok: false, ...negado };

      const validacao = validarNovaMensagem(entrada);
      if (!validacao.ok) return valorInvalido(validacao);

      return comTransacao(
        deps.pool,
        async (cliente: PoolClient) => {
          const conversa = await criarRepositorioDeConversasPg(cliente).obter(membro.workspaceId, entrada.conversaId);
          if (!conversa) return conversaNaoEncontrada();
          if (conversa.estado === "na_lixeira") {
            return recusa<never>(409, "Uma Conversa na lixeira não recebe Mensagem. Restaure-a antes.", { codigo: "CONVERSA_NA_LIXEIRA" });
          }

          const canal = await criarRepositorioDeCanaisPg(cliente).obter(membro.workspaceId, conversa.canalId);
          if (!canal) return conversaNaoEncontrada();
          if (canal.estado === "arquivado") {
            return recusa<never>(409, "Um Canal arquivado não envia Mensagem.", { codigo: "CANAL_ARQUIVADO" });
          }

          const mensagens = criarRepositorioDeMensagensPg(cliente);
          if (entrada.direcao === "enviada") {
            const envio = validarEnvio({
              capacidades: capacidadesDoCanal({ channelType: canal.tipo, provider: canal.provedor }),
              ultimaRecebidaEm: await mensagens.ultimaRecebidaEm(membro.workspaceId, conversa.id),
              agora: Date.now(),
              modelosAprovados: [],
            });
            if (!envio.ok) {
              return recusa<never>(409, envio.error, { codigo: "JANELA_EXPIRADA", campo: envio.field ?? "modelo" });
            }

            // 3.2.4: o modelo de marketing só sai com consentimento vigente do Contato para o tipo do Canal.
            const categoria = await deps.categoriaDoModelo?.(cliente, membro.workspaceId, conversa, entrada);
            if (categoria !== undefined) {
              const frase = recusaPorFaltaDeConsentimento({
                categoriaDoModelo: categoria,
                registros: await criarRepositorioDeConsentimentosPg(cliente).listarDoContato(membro.workspaceId, conversa.contatoId),
                finalidadeDeMarketingId: await finalidadeDeMarketing(cliente, membro.workspaceId),
                tipoDoCanal: canal.tipo,
              });
              if (frase !== undefined) return recusa<never>(409, frase, { codigo: "SEM_CONSENTIMENTO", campo: "modelo" });
            }
          }

          const mensagem = await mensagens.inserir(membro.workspaceId, {
            conversaId: conversa.id,
            canalId: canal.id,
            direcao: entrada.direcao,
            ator: { tipo: "member", id: membro.id },
            conteudo: entrada.conteudo,
            statusEntrega: entrada.direcao === "enviada" ? statusInicialDeEnvio(canal.conexao) : null,
            ...(entrada.emRespostaAId !== undefined ? { emRespostaAId: entrada.emRespostaAId } : {}),
          });
          // 3.7.1: no mesmo cliente da transação, antes do commit. Só a `enviada` sai; a `interna` não.
          if (entrada.direcao === "enviada") await enfileirar(cliente, membro.workspaceId, mensagem, canal);
          return sucesso(mensagem);
        },
        FRASES,
      );
    },
  };
}
