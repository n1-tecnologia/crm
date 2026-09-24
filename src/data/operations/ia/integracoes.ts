/**
 * Integrações (01, 7.4; B35): conectar e desconectar, com os efeitos que a
 * ontologia liga ao estado da conexão — as Fontes de Conhecimento que a
 * referenciam passam a `com erro` ou voltam a `ativo` (20, 20.6), as
 * Ferramentas que ela expõe ficam inoperantes sem deixar de estar permitidas
 * (18, 7.4) e as Concessões cuja Ferramenta obrigatória é dela mudam de
 * Disponibilidade (RN-HAB-18).
 *
 * Só a Integração e as Fontes são gravadas: Disponibilidade e "inoperante"
 * são recomputadas de `derive-ia` a cada leitura, e o ato apenas as CONTA no
 * Registro de Atividade — o mesmo número que o diálogo de confirmação mostra
 * antes, por `impactoDaIntegracao`.
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type { Collection, Id, Integration, KnowledgeSource, SkillGrant, Tool } from "../../types";
import { disponibilidadeDaConcessao } from "../../derive-ia";
import { memberActor, recordActivity } from "../activity";
import { recusaDeAdministrarIntegracao } from "./permissoes-ia";

/**
 * As Ferramentas da Integração no Catálogo: as que o Catálogo diz serem dela
 * (DO-HAB-13) e as que ela declara expor — o seed ainda tem Integrações que
 * expõem Ferramentas de origem `plataforma`, e a tela de Integrações lista
 * as duas.
 */
export function ferramentasDaIntegracao(state: DataState, integration: Integration): Tool[] {
  return state.tools.filter((t) => t.integrationId === integration.id || integration.exposedTools.includes(t.id));
}

export interface FonteDaIntegracao {
  readonly colecao: Collection;
  readonly fonte: KnowledgeSource;
}

/** 20, 8 — a mesma Integração alimenta Fontes de várias Coleções; a Fonte a referencia por `config`. */
export function fontesDaIntegracao(state: DataState, integrationId: Id): FonteDaIntegracao[] {
  const fontes: FonteDaIntegracao[] = [];
  for (const colecao of state.collections) {
    for (const fonte of colecao.sources) {
      if (fonte.kind === "integracao" && fonte.config === integrationId) fontes.push({ colecao, fonte });
    }
  }
  return fontes;
}

export interface ImpactoDaIntegracao {
  /** As Ferramentas que a Integração expõe: inoperantes enquanto ela não está `conectada`. */
  readonly ferramentas: readonly Tool[];
  /** As Concessões cuja Disponibilidade muda com o ato — não as que já estavam indisponíveis por outro motivo. */
  readonly concessoes: readonly SkillGrant[];
  /** Habilidades distintas entre essas Concessões. */
  readonly habilidades: number;
  /** As Fontes que mudam de estado com o ato: `ativo` → `com erro` ao desconectar, o inverso ao conectar. */
  readonly fontes: readonly FonteDaIntegracao[];
}

/**
 * O que muda se a Integração passar a `estado`, calculado sobre uma cópia
 * rasa do estado — nada é gravado. É o que o diálogo de confirmação mostra
 * antes do ato ("n Ferramentas ficam inoperantes; n Habilidades ficam
 * indisponíveis") e o que o Registro de Atividade conta depois.
 */
export function impactoDaIntegracao(state: DataState, integration: Integration, estado: Integration["state"]): ImpactoDaIntegracao {
  const depois: DataState = {
    ...state,
    integrations: state.integrations.map((i) => (i.id === integration.id ? { ...i, state: estado } : i)),
  };
  const concessoes = state.skillGrants.filter(
    (g) => disponibilidadeDaConcessao(state, g).disponivel !== disponibilidadeDaConcessao(depois, g).disponivel,
  );
  const fontes = fontesDaIntegracao(state, integration.id).filter(({ fonte }) =>
    estado === "conectada" ? fonte.state === "comErro" : fonte.state === "ativo",
  );
  return {
    ferramentas: ferramentasDaIntegracao(state, integration),
    concessoes,
    habilidades: new Set(concessoes.map((g) => g.skillId)).size,
    fontes,
  };
}

/**
 * Conectar (ou reconectar, de `com erro`): quem conecta passa a ser o Membro
 * configurador — rastreabilidade, nunca governança (B35). As Fontes `com
 * erro` que a referenciam voltam a `ativo` no ato: a ontologia as devolveria
 * na primeira Atualização bem-sucedida, e o protótipo não sincroniza.
 */
export function conectarIntegracao(state: DataState, actingMemberId: Id, integrationId: Id): OperationResult<Integration> {
  const integration = state.integrations.find((i) => i.id === integrationId);
  if (!integration) return fail("Integração não encontrada.");
  const recusa = recusaDeAdministrarIntegracao(state, actingMemberId);
  if (recusa) return fail(recusa);
  if (integration.state === "conectada") return fail("A Integração já está conectada.");

  const impacto = impactoDaIntegracao(state, integration, "conectada");
  const antes = integration.state;
  integration.state = "conectada";
  integration.configuredBy = actingMemberId;
  for (const { fonte } of impacto.fontes) {
    fonte.state = "ativo";
    fonte.lastUpdateResult = `Integração “${integration.name}” reconectada`;
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Integração conectada",
    objectType: "integration",
    objectId: integration.id,
    objectName: integration.name,
    before: antes,
    after: "conectada",
    detail: `${impacto.ferramentas.length} Ferramenta(s) operante(s); ${impacto.habilidades} Habilidade(s) com Concessão disponível de novo; ${impacto.fontes.length} Fonte(s) de Conhecimento reativada(s)`,
  });
  return ok(integration, integration.id);
}

/**
 * Desconectar: as Ferramentas expostas seguem permitidas aos Agentes e ficam
 * inoperantes (18, 7.4); as Concessões que exigem uma delas tornam-se
 * indisponíveis por leitura (RN-HAB-18); as Fontes `ativo` que a referenciam
 * passam a `com erro` (20, 20.6). Uma Fonte `pausado` fica como o Ator a
 * deixou.
 */
export function desconectarIntegracao(state: DataState, actingMemberId: Id, integrationId: Id): OperationResult<Integration> {
  const integration = state.integrations.find((i) => i.id === integrationId);
  if (!integration) return fail("Integração não encontrada.");
  const recusa = recusaDeAdministrarIntegracao(state, actingMemberId);
  if (recusa) return fail(recusa);
  if (integration.state === "desconectada") return fail("A Integração já está desconectada.");

  const impacto = impactoDaIntegracao(state, integration, "desconectada");
  const antes = integration.state;
  integration.state = "desconectada";
  for (const { fonte } of impacto.fontes) {
    fonte.state = "comErro";
    fonte.lastUpdateResult = `Integração “${integration.name}” desconectada`;
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Integração desconectada",
    objectType: "integration",
    objectId: integration.id,
    objectName: integration.name,
    before: antes,
    after: "desconectada",
    detail: `${impacto.ferramentas.length} Ferramenta(s) inoperante(s); ${impacto.habilidades} Habilidade(s) com Concessão indisponível; ${impacto.fontes.length} Fonte(s) de Conhecimento com erro`,
  });
  return ok(integration, integration.id);
}
