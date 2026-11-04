/**
 * Serviço de mesclagem de Contatos (14-09, 3.2.2): o gesto misto que junta dois
 * Contatos do modelo novo nas DUAS bases, no mesmo commit.
 *
 * O sobrevivente é o `:id` da rota; o absorvido vem no corpo. Passam ao
 * sobrevivente os Identificadores, as Conversas, os Negócios, os vínculos com
 * Empresa, os Endereços (sem principal) e as notas; os consentimentos são
 * COPIADOS (o histórico de cada Contato é só inserção); e, em
 * `plataforma.registros`, todo Vínculo que tocava o absorvido passa a tocar o
 * sobrevivente. O absorvido fica `mesclado`, terminal. É IRREVERSÍVEL.
 *
 * É um gesto misto (`gesto-misto.ts`, 14-03):
 *   - `lerDoCrm` trava os dois Contatos em ordem de id (`travarDois`), 404 se
 *     faltar um NESTE Espaço (T-14-22) e 409 `MESCLAGEM_RECUSADA` pela regra do
 *     domínio (`validarMesclagem`). Recusa é valor: nada roda depois dela.
 *   - `operacao` é `mesclarContatoNoEspaco`: só o que mora em `registros`.
 *   - `gravarNoCrm` resolve a colisão de Conversa (RN-CXE-10) ANTES de mover, para
 *     `conversas_nao_resolvida_uq` nunca ver dois pares iguais; move os
 *     Identificadores antes de marcar `mesclado`; e marca `mesclado` por último.
 *
 * O Papel é exigido ANTES de ler qualquer coisa (T-14-22). O conteúdo das notas
 * e dos consentimentos passa só dentro do SQL: este serviço nunca o lê nem o
 * loga (T-14-24), e a resposta é só o sobrevivente detalhado.
 *
 * Duas mesclagens cruzadas (A em B e B em A) não dão deadlock: a trava do Espaço
 * de `executar()` as enfileira, e a segunda encontra o absorvido `mesclado` e
 * recebe 409. A ordem de id em `travarDois` é a rede para quem travar Contatos
 * por fora do Espaço. A ordem Contatos antes de Conversas é a de `mover` e
 * `restaurar` (14-05, 14-07).
 */

import type { Pool } from "pg";
import type { ContatoDetalhado } from "@n1/dominio/crm/contatos";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { conversasQueResolvemNaColisao, validarMesclagem } from "@n1/dominio/crm/mesclagem";
import { mesclarContatoNoEspaco } from "@n1/dominio/operations";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import {
  acrescentarEnderecos,
  ativarSobrevivente,
  conversasNaoResolvidasDosDois,
  copiarConsentimentos,
  fundirVinculosComEmpresa,
  marcarMesclado,
  moverConversas,
  moverIdentificadores,
  moverNegocios,
  moverNotas,
  reapontarMescladosAnteriores,
  resolverPorMesclagem,
  travarDois,
  type ContatoTravado,
} from "../../repositorios/crm/mesclagem";
import { listarDoContato } from "../../repositorios/crm/vinculos";
import { exigir, type AcessoAoCrm } from "./acesso";
import { FRASES_DE_CONTATOS } from "./contatos";
import { executarGestoMisto } from "./gesto-misto";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import type { FrasesDeRestricao } from "./transacao";

export interface ServicoDeMesclagem {
  /** Passa o absorvido ao sobrevivente (`sobreviventeId`) e devolve o sobrevivente detalhado. */
  mesclar(membro: MembroDaSessao, sobreviventeId: string, entrada: { readonly absorvidoId: string }): Promise<ResultadoCrm<ContatoDetalhado>>;
}

/** Rede contra a corrida: o que a pré-checagem de `lerDoCrm` não pegou vira esta frase, sem o nome do constraint. */
const FRASES_DA_MESCLAGEM: FrasesDeRestricao = {
  ...FRASES_DE_CONTATOS,
  conversas_nao_resolvida_uq: {
    codigo: "CONVERSA_JA_ABERTA",
    error: "Uma Conversa foi aberta durante a mesclagem. Tente de novo.",
  },
  contato_empresa_vigente_uq: {
    codigo: "VINCULO_JA_VIGENTE",
    error: "Um vínculo com Empresa mudou durante a mesclagem. Tente de novo.",
  },
  contatos_mesclado_em_fk: {
    codigo: "CONTATO_NAO_ENCONTRADO",
    error: "O Contato que ficaria não existe mais.",
  },
};

interface Lido {
  readonly sobrevivente: ContatoTravado;
  readonly absorvido: ContatoTravado;
  readonly estadoDoSobrevivente: "ativo" | "arquivado";
}

const naoEncontrado = () => recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO" });

const nomeDe = (contato: ContatoTravado): string => nomeDeExibicaoDoContato(contato, contato.identificadorPrincipal);

export function criarServicoDeMesclagem(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeMesclagem {
  return {
    async mesclar(membro, sobreviventeId, entrada) {
      const negado = await exigir(deps.acesso, membro, "editar", "contato");
      if (negado) return { ok: false, ...negado };

      const workspaceId = membro.workspaceId;
      const absorvidoId = entrada.absorvidoId;

      const desfecho = await executarGestoMisto<Lido, { readonly vinculosReapontados: number }>(
        workspaceId,
        {
          lerDoCrm: async (cliente) => {
            const travados = await travarDois(cliente, workspaceId, sobreviventeId, absorvidoId);
            const sobrevivente = travados.find((c) => c.id === sobreviventeId);
            const absorvido = travados.find((c) => c.id === absorvidoId);
            if (!sobrevivente || !absorvido) return naoEncontrado();
            const regra = validarMesclagem(sobrevivente, absorvido);
            if (!regra.ok) {
              return recusa<never>(409, regra.error, {
                codigo: "MESCLAGEM_RECUSADA",
                ...(regra.field !== undefined ? { campo: regra.field } : {}),
              });
            }
            return sucesso({ sobrevivente, absorvido, estadoDoSobrevivente: regra.value.estadoDoSobrevivente });
          },

          operacao: (state, lido) =>
            mesclarContatoNoEspaco(state, membro.id, {
              sobrevivente: { id: lido.sobrevivente.id, nome: nomeDe(lido.sobrevivente) },
              absorvido: { id: lido.absorvido.id, nome: nomeDe(lido.absorvido) },
            }),

          gravarNoCrm: async (cliente, _valor, lido) => {
            const de = lido.absorvido.id;
            const para = lido.sobrevivente.id;

            // RN-CXE-10: onde os dois têm Conversa aberta ou pendente no mesmo Canal, a de
            // Mensagem mais recente fica e a outra resolve ANTES de mover.
            const abertas = await conversasNaoResolvidasDosDois(cliente, workspaceId, de, para);
            const porCanal = new Map<string, typeof abertas>();
            for (const conversa of abertas) porCanal.set(conversa.canalId, [...(porCanal.get(conversa.canalId) ?? []), conversa]);
            const aResolver = [...porCanal.values()].flatMap((grupo) => conversasQueResolvemNaColisao(grupo));
            await resolverPorMesclagem(cliente, workspaceId, aResolver);

            await moverIdentificadores(cliente, workspaceId, de, para);
            await moverConversas(cliente, workspaceId, de, para);
            await moverNegocios(cliente, workspaceId, de, para);
            await fundirVinculosComEmpresa(cliente, workspaceId, de, para);
            await moverNotas(cliente, workspaceId, de, para);
            await copiarConsentimentos(cliente, workspaceId, de, para);
            await acrescentarEnderecos(cliente, workspaceId, de, para);
            await reapontarMescladosAnteriores(cliente, workspaceId, de, para);
            if (lido.estadoDoSobrevivente === "ativo") await ativarSobrevivente(cliente, workspaceId, para);
            await marcarMesclado(cliente, workspaceId, de, para);
          },
        },
        FRASES_DA_MESCLAGEM,
      );
      if (!desfecho.ok) return desfecho;

      // Depois do commit: a ficha do sobrevivente, pelo pool. Nada de `registros` volta no corpo.
      const cliente = deps.pool();
      const repositorio = criarRepositorioDeContatosPg(cliente);
      const contato = await repositorio.obter(workspaceId, sobreviventeId);
      if (!contato) throw new Error("O sobrevivente da mesclagem sumiu depois do commit.");
      const identificadores = await repositorio.listarIdentificadores(workspaceId, contato.id);
      const vinculos = await listarDoContato(cliente, workspaceId, contato.id);
      return sucesso({ contato, identificadores, vinculos });
    },
  };
}
