/**
 * Serviço de Canais: a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (T-08-01, T-08-02). O Canal não tem Proprietário
 * (B35): `configuradoPor` é o Membro da sessão, e só.
 *
 * Criar exige Administrador ou Proprietário (B35) ANTES de abrir a transação:
 * `exigir(..., "criar", "canal")`. Ler é de todos. O tipo vem do provedor, no
 * domínio; o Canal nasce `desconectada` (D-08) porque o repositório não envia
 * `conexao`.
 *
 * O SQLSTATE traduzido por `FRASES` é a rede contra a corrida de nome e conta
 * (RN-CXE-31, INV-CXE-01); a frase não carrega o nome do constraint (T-08-04).
 * 08-03 acrescenta a pré-checagem rica, a guarda contra o seed e a revisão do
 * Espaço.
 */

import type { Pool } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import { validarNovoCanal, type Canal, type FiltroDeCanais, type NovoCanal } from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface ServicoDeCanais {
  listar(membro: MembroDaSessao, filtro: FiltroDeCanais): Promise<ResultadoCrm<Pagina<Canal>>>;
  criar(membro: MembroDaSessao, entrada: NovoCanal): Promise<ResultadoCrm<Canal>>;
}

/** Rede contra corrida: o constraint que segurou vira esta frase, sem o nome dele (T-08-04). */
const FRASES: FrasesDeRestricao = {
  canais_nome_uq: { codigo: "CANAL_NOME_EM_USO", error: "Já existe um Canal ativo com este nome." },
  canais_conta_uq: { codigo: "CANAL_CONTA_EM_USO", error: "Esta conta já está conectada em outro Canal ativo." },
};

export function criarServicoDeCanais(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeCanais {
  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "canal");
      if (negado) return { ok: false, ...negado };
      return sucesso(await criarRepositorioDeCanaisPg(deps.pool()).listar(membro.workspaceId, filtro));
    },

    async criar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "criar", "canal");
      if (negado) return { ok: false, ...negado };

      const validacao = validarNovoCanal(entrada);
      if (!validacao.ok) {
        return recusa<never>(400, validacao.error, {
          codigo: "VALOR_INVALIDO",
          ...(validacao.field !== undefined ? { campo: validacao.field } : {}),
        });
      }
      const { tipo, provedor, nome, identificadorExterno } = validacao.value;

      return comTransacao(
        deps.pool,
        async (cliente) =>
          sucesso(
            await criarRepositorioDeCanaisPg(cliente).inserir(membro.workspaceId, {
              nome,
              tipo,
              provedor,
              identificadorExterno,
              configuradoPor: membro.id,
              criadoPor: membro.id,
            }),
          ),
        FRASES,
      );
    },
  };
}
