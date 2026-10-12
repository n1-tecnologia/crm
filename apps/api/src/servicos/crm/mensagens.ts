/**
 * Serviço de Mensagens (08-12): o fio de uma Conversa relacional, o envio
 * humano e a porta INTERNA de ingestão da `recebida`.
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
 *   - B69: `enviada` num Canal que não está `conectada` nasce `pendente`
 *     (`statusInicialDeEnvio`); `interna` não tem status de entrega e não passa
 *     pela janela (INV-CXE-09).
 *   - INV-CXE-10: "em resposta a" é da MESMA Conversa; a FK composta da 008 é a
 *     rede e `FRASES` a traduz, sem o nome do constraint.
 *   - INV-CXE-08 / RN-CXE-17: `registrarRecebida` é idempotente por (Canal, id
 *     externo); a repetição devolve a existente com `repetida: true`. O Canal
 *     gravado é sempre o DA CONVERSA, nunca o da entrada, e o Ator é o Canal
 *     como Integração.
 *
 * `registrarRecebida` não recebe Membro: é a porta da integração (testes agora,
 * webhook autenticado por credencial de serviço depois) e NÃO tem rota. A
 * reabertura automática de Conversa resolvida por Mensagem recebida depende da
 * Caixa relacional (Deferred), então ela não muda a situação da Conversa.
 *
 * Nem o `conteudo` nem a `cargaBruta` são escritos em log (T-08-46).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import { statusInicialDeEnvio, validarEnvio, validarNovaMensagem, type Mensagem, type MensagemRecebidaDoProvedor, type NovaMensagem } from "@n1/dominio/crm/mensagens";
import { capacidadesDoCanal } from "@n1/dominio/operations";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg, type FiltroDeMensagens } from "../../repositorios/crm/mensagens";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface ServicoDeMensagens {
  listar(membro: MembroDaSessao, filtro: FiltroDeMensagens): Promise<ResultadoCrm<Pagina<Mensagem>>>;
  enviar(membro: MembroDaSessao, entrada: NovaMensagem): Promise<ResultadoCrm<Mensagem>>;
  registrarRecebida(
    workspaceId: string,
    entrada: MensagemRecebidaDoProvedor,
  ): Promise<ResultadoCrm<{ readonly mensagem: Mensagem; readonly repetida: boolean }>>;
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

/** A porta interna recebe dado do provedor: confere o que o banco recusaria com 500. */
function validarRecebida(entrada: MensagemRecebidaDoProvedor): { readonly error: string; readonly field: string } | undefined {
  if (entrada.idExterno.trim() === "") return { error: "A Mensagem recebida precisa do identificador do provedor.", field: "idExterno" };
  if (Number.isNaN(Date.parse(entrada.criadoEm))) return { error: "O instante da Mensagem recebida é inválido.", field: "criadoEm" };
  const semTexto = (entrada.conteudo ?? "").trim() === "";
  if (semTexto && (entrada.anexos ?? []).length === 0) return { error: "A Mensagem recebida precisa de conteúdo ou anexo.", field: "conteudo" };
  return undefined;
}

export function criarServicoDeMensagens(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeMensagens {
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
          return sucesso(mensagem);
        },
        FRASES,
      );
    },

    async registrarRecebida(workspaceId, entrada) {
      const invalida = validarRecebida(entrada);
      if (invalida) return valorInvalido(invalida);

      const pool = deps.pool();
      const conversa = await criarRepositorioDeConversasPg(pool).obter(workspaceId, entrada.conversaId);
      if (!conversa) return conversaNaoEncontrada();

      const mensagens = criarRepositorioDeMensagensPg(pool);
      const gravada = await mensagens.inserirRecebida(workspaceId, {
        conversaId: conversa.id,
        canalId: conversa.canalId,
        idExterno: entrada.idExterno,
        criadoEm: entrada.criadoEm,
        conteudo: entrada.conteudo ?? null,
        anexos: entrada.anexos ?? [],
        assunto: entrada.assunto ?? null,
        enderecosAdicionais: entrada.enderecosAdicionais ?? [],
        remetenteExterno: entrada.remetenteExterno ?? null,
        identificadorId: entrada.identificadorId ?? null,
        cargaBruta: entrada.cargaBruta,
      });
      if (gravada) return sucesso({ mensagem: gravada, repetida: false });

      // Já existia (INV-CXE-08): a 2ª entrega do mesmo id externo no mesmo Canal devolve a primeira.
      const existente = await mensagens.obterPorIdExterno(workspaceId, conversa.canalId, entrada.idExterno);
      if (!existente) return conversaNaoEncontrada();
      return sucesso({ mensagem: existente, repetida: true });
    },
  };
}
