/**
 * Evolver idempotente do Processo de Projetos: materializa o manual
 * (`processo-de-projetos-catalogo.ts`) num Espaço de Trabalho já vivo. Molde de
 * `contas-a-receber-evolver.ts`, com as mesmas três regras duras:
 *   1. NUNCA remove nada: o que sobra no estado fica onde está.
 *   2. NUNCA lê nem escreve `state.tasks`.
 *   3. Ids são literais do catálogo, nunca de `nextId`: reexecutar não pode
 *      produzir um id diferente do já gravado. Todos têm mais de um `_`, então
 *      `syncIdSequence` não os confunde com um id gerado.
 *
 * Reaplicar cria só o que falta e confere nome, tipo e categoria do que existe;
 * divergência recusa tudo, sem sobrescrever. O que se ajusta pela tela depois de
 * aplicado (opções de Cliente, descrições, requisitos, cores) não é conferido:
 * ajustar não é divergir.
 *
 * Quatro decisões em que o manual deixa o mapeamento para a ferramenta:
 *
 * - **O processo nasce privado.** O manual pede os Campos financeiros só para
 *   pessoas autorizadas, e aqui não há permissão por Campo: o limite que existe é
 *   o do contêiner. Quem aplica e os Proprietários ganham `administrar`; o resto
 *   entra por concessão, depois de a empresa dizer quem é. Num Espaço novo, o
 *   privado é o Espaço. Num Espaço que já existe (`espacoExistenteId`), é a Pasta:
 *   o acesso do que já estava lá não muda por causa deste processo.
 *
 * - **Campos da fase ficam na Lista da fase; os comerciais ficam na Pasta, fora
 *   das Listas que não os usam** (`camposHerdadosFora`). Ao mover, o valor que
 *   deixa de se aplicar é preservado, aparece só para leitura na ficha e volta
 *   ativo se a Tarefa retornar (B37): é a "visualização restrita por lista" do
 *   manual, sem Campo homônimo.
 *
 * - **Só requisito de ENTRADA, nunca de saída.** Subtarefa usa o mesmo Conjunto
 *   de Status, e requisito vale para ela também. Sem requisito de saída, ela sempre
 *   consegue ir para "Subtarefa concluída", o único Status que não está no manual:
 *   sem ele, uma Subtarefa só terminaria preenchendo os Campos do projeto inteiro.
 *   Ele ainda separa no mapeamento de `moveTask`: Subtarefa pronta continua pronta
 *   na fase seguinte, enquanto o projeto vai para o estado de entrada.
 *
 * - **A Trava de passagem.** `FieldRequirement` só sabe exigir preenchimento, e o
 *   manual pede regras negativas ("A confirmar" não qualifica, "Revertida" não vira
 *   Implantado). A trava é um Campo da Pasta fora de todas as Listas: ninguém a vê
 *   nem a preenche, então um requisito que aponta para ela, condicionado ao valor
 *   proibido, sempre falta, e a recusa diz o motivo pelo `label`.
 */

import { memberActor, recordActivity } from "./operations/activity";
import {
  CAMPOS_COMERCIAIS,
  CAMPOS_COMUNS,
  ESPACO_DO_PROCESSO,
  LISTAS_DO_PROCESSO,
  PASTA_DO_PROCESSO,
  type CampoDoProcesso,
  type ListaDoProcesso,
} from "./processo-de-projetos-catalogo";
import type { DiffDeConfiguracao, DivergenciaDeConfiguracao } from "./solicitacao-de-pagamento-evolver";
import { fail, ok, type DataState, type OperationResult } from "./state";
import type {
  ActorRef,
  ConfigurableAspect,
  FieldDefinition,
  FieldRequirement,
  Folder,
  Id,
  List,
  Space,
  StatusCategory,
  StatusDefinition,
  Template,
  View,
} from "./types";

export type { DiffDeConfiguracao, DivergenciaDeConfiguracao };

/** Cliente é seleção e seleção exige opção; sem a lista da empresa, nasce com este aviso. */
export const OPCAO_PROVISORIA_DE_CLIENTE = "Cadastrar clientes nas opções deste Campo";

export const TEMPLATE_DO_PROCESSO_ID: Id = "tpl_pp_nova_demanda";
const TIPO_DE_TAREFA_ID: Id = "tt_pp_tarefa";

export const TRAVA_DE_PASSAGEM: CampoDoProcesso = {
  id: "fd_pp_trava_de_passagem",
  nome: "Trava de passagem",
  tipo: "text",
  observacao:
    "Campo técnico, fora de todas as Listas: não aparece na Tarefa e nunca recebe valor. Os requisitos de Status apontam para ele quando um valor deve IMPEDIR a passagem, como Relação com receita = A confirmar. Não arquivar nem usar nas Listas.",
};

/* ───────────────────────────── Regras de passagem ────────────────────────── */

type Regra =
  | { readonly exige: string; readonly quando?: readonly [campo: string, valor: string] }
  | { readonly impede: readonly [campo: string, valor: string]; readonly frase: string };

const exigir = (...nomes: readonly string[]): Regra[] => nomes.map((exige) => ({ exige }));
const exigirSe = (exige: string, campo: string, valor: string): Regra => ({ exige, quando: [campo, valor] });
const impedirSe = (campo: string, valor: string, frase: string): Regra => ({ impede: [campo, valor], frase });

const DECISAO = exigir("Decisor da fase", "Data da decisão da fase");

/** Motivo, responsável e revisão: obrigatórios quando a execução não for Normal. */
const IMPEDIMENTO: readonly Regra[] = ["Bloqueada", "Pausada"].flatMap((situacao) =>
  ["Motivo do impedimento ou pausa", "Responsável pelo desbloqueio ou retomada", "Próxima revisão do impedimento ou pausa"].map((campo) =>
    exigirSe(campo, "Situação de execução", situacao),
  ),
);

/** Aprovar: decisor e data, sempre; situação de execução coerente. */
const saida = (...regras: readonly Regra[]): Regra[] => [...regras, ...DECISAO, ...IMPEDIMENTO];

const CANCELADO = exigir("Motivo do cancelamento", "Decisor da fase", "Data da decisão da fase");

const RECEITAS_COM_EVIDENCIA = ["Receita direta", "Expansão de contrato", "Retenção de receita"] as const;

const REQUISITOS_DO_BRIEFING = exigir(
  "Documento de briefing", "Versão do briefing", "Objetivo do projeto", "Processo atual", "Perfis de usuários",
  "Sistemas envolvidos", "Restrições conhecidas", "Critérios de sucesso", "Aprovador do briefing",
);

const REQUISITOS_DA_VIABILIDADE = exigir(
  "Responsável técnico", "Parecer técnico", "Esforço preliminar em horas", "Custo estimado de desenvolvimento",
  "Custo mensal adicional de operação", "Prazo estimado em dias úteis", "Riscos e premissas", "Horizonte financeiro em meses",
  "Memória da análise financeira", "Parecer financeiro", "Recomendação de viabilidade",
);

const REQUISITOS_DO_ESCOPO = exigir(
  "Documento de escopo", "Versão do escopo", "Entregas previstas", "Fora do escopo",
  "Premissas e obrigações do cliente", "Critérios de aceite do projeto", "Aprovador do escopo",
);

const REQUISITOS_DA_HOMOLOGACAO = exigir(
  "Responsável pela homologação no cliente", "Ambiente de homologação", "Versão em homologação", "Roteiro de homologação", "Prazo de homologação",
);

const REQUISITOS_DA_PUBLICACAO: readonly Regra[] = [
  ...exigir("Responsável pela implantação", "Versão a publicar", "Plano de implantação", "Plano de reversão", "Necessita migração de dados?"),
  exigirSe("Plano de migração", "Necessita migração de dados?", "Sim"),
];

/** Lista → Status → o que a Tarefa precisa ter para ENTRAR nele. */
export const REGRAS_DE_PASSAGEM: Readonly<Record<string, Readonly<Record<string, readonly Regra[]>>>> = {
  "01": {
    "Em tramitação": [...exigir("Solicitante", "Origem", "Problema a resolver"), exigirSe("Cliente", "Origem", "Cliente")],
    "Aguardando informações": exigir("Informação pendente", "Responsável pelo retorno", "Prazo para retorno"),
    Qualificada: saida(
      ...exigir(
        "Solicitante", "Origem", "Tipo de demanda", "Encaminhamento da triagem", "Problema a resolver", "Público afetado",
        "Frequência do problema", "Categoria do impacto", "Intensidade do impacto", "Justificativa do impacto", "Resultado esperado",
        "Consequência de não fazer", "Relação com receita", "Justificativa da decisão",
      ),
      exigirSe("Cliente", "Origem", "Cliente"),
      impedirSe("Relação com receita", "A confirmar", "Relação com receita diferente de “A confirmar”"),
      impedirSe("Encaminhamento da triagem", "Suporte", "Encaminhamento da triagem = Processo de projetos (está Suporte: encerre como Não aprovada, com o destino)"),
      impedirSe("Encaminhamento da triagem", "Duplicada", "Encaminhamento da triagem = Processo de projetos (está Duplicada: encerre como Não aprovada, com a demanda original)"),
      ...RECEITAS_COM_EVIDENCIA.flatMap((receita) => [
        exigirSe("Evidência comercial", "Relação com receita", receita),
        exigirSe("Responsável comercial", "Relação com receita", receita),
      ]),
      exigirSe("Modelo de cobrança", "Relação com receita", "Receita direta"),
      exigirSe("Modelo de cobrança", "Relação com receita", "Expansão de contrato"),
      exigirSe("Receita mensal em risco", "Relação com receita", "Retenção de receita"),
      exigirSe("Receita única prevista", "Modelo de cobrança", "Única"),
      exigirSe("Receita única prevista", "Modelo de cobrança", "Única + recorrente"),
      exigirSe("Receita mensal adicional prevista", "Modelo de cobrança", "Recorrente"),
      exigirSe("Receita mensal adicional prevista", "Modelo de cobrança", "Única + recorrente"),
    ),
    "Não aprovada": [
      ...exigir("Encaminhamento da triagem", "Justificativa da decisão"),
      ...DECISAO,
      // O motivo é de rejeição de negócio: duplicada e suporte encerram sem ele.
      exigirSe("Motivo da não aprovação", "Encaminhamento da triagem", "Processo de projetos"),
      exigirSe("Destino do encaminhamento", "Encaminhamento da triagem", "Suporte"),
      exigirSe("Demanda original", "Encaminhamento da triagem", "Duplicada"),
    ],
  },
  "02": {
    "Reunião agendada": exigir("Data da reunião de briefing", "Participantes do briefing"),
    "Aguardando informações": exigir("Pendências do briefing"),
    "Aguardando validação": REQUISITOS_DO_BRIEFING,
    "Briefing aprovado": saida(...REQUISITOS_DO_BRIEFING, ...exigir("Evidência da aprovação do briefing")),
  },
  "03": {
    "Aguardando informações": exigir("Pendências de viabilidade"),
    "Aguardando decisão": REQUISITOS_DA_VIABILIDADE,
    Viável: saida(
      ...REQUISITOS_DA_VIABILIDADE,
      ...exigir("Aprovador da viabilidade", "Evidência da decisão de viabilidade"),
      exigirSe("Condições para execução", "Recomendação de viabilidade", "Executar com condições"),
    ),
    Inviável: [...exigir("Aprovador da viabilidade", "Evidência da decisão de viabilidade"), ...DECISAO],
  },
  "04": {
    "Aguardando aprovação": REQUISITOS_DO_ESCOPO,
    "Escopo aprovado": saida(...REQUISITOS_DO_ESCOPO, ...exigir("Data de aprovação do escopo", "Evidência da aprovação do escopo")),
  },
  "05": {
    "Aguardando esclarecimentos": exigir("Questões em aberto"),
    "Em revisão": exigir("Documento de especificação", "Versão da especificação", "Revisor funcional"),
    "Especificação aprovada": saida(
      ...exigir(
        "Documento de especificação", "Versão da especificação", "Regras de negócio", "Perfis e permissões", "Requisitos não funcionais",
        "Critérios de aceite das funcionalidades", "Revisor funcional", "Evidência da aprovação da especificação",
      ),
    ),
  },
  "06": {
    // Demanda sem interface passa com a dispensa como evidência: exigir fluxo e
    // protótipo aqui fecharia essa saída, que o manual prevê.
    "Pronto para validação": saida(...exigir("Revisor de design", "Evidência da revisão de design")),
  },
  "07": {
    "Apresentação agendada": exigir("Data da apresentação", "Participantes da validação", "Versão apresentada"),
    "Aguardando retorno": exigir("Prazo para retorno da validação"),
    "Solução aprovada": saida(
      ...exigir(
        "Versão apresentada", "Registro dos feedbacks", "Aprovador da solução", "Data da aprovação da solução", "Evidência da aprovação da solução",
      ),
    ),
  },
  "08": {
    "Planejamento aprovado": saida(
      ...exigir(
        "Plano técnico", "Plano de entregas", "Equipe envolvida", "Esforço detalhado em horas", "Capacidade alocada em horas por semana",
        "Previsão de publicação", "Plano de testes", "Aprovador do planejamento", "Evidência da aprovação do planejamento",
      ),
    ),
  },
  "09": {
    "Pronto para testes": saida(
      ...exigir(
        "Líder técnico", "Versão de entrega", "Repositório", "Registro das alterações técnicas", "Ambiente de testes", "Evidência da revisão técnica",
      ),
    ),
  },
  "10": {
    "Falhas identificadas": exigir("Falhas identificadas", "Maior severidade em aberto"),
    "Aprovado para homologação": saida(
      ...exigir("Responsável pela qualidade", "Versão em teste", "Execução dos testes", "Maior severidade em aberto", "Parecer de qualidade"),
      impedirSe("Maior severidade em aberto", "Crítica", "Nenhuma falha crítica em aberto"),
      impedirSe("Maior severidade em aberto", "Alta", "Nenhuma falha alta em aberto"),
      ...["Baixa", "Média"].flatMap((severidade) => [
        exigirSe("Pendências aceitas em qualidade", "Maior severidade em aberto", severidade),
        exigirSe("Aprovador das exceções de qualidade", "Maior severidade em aberto", severidade),
      ]),
    ),
  },
  "11": {
    "Aguardando testes do cliente": REQUISITOS_DA_HOMOLOGACAO,
    // Silêncio não é aceite: sem a evidência, não há Homologado.
    Homologado: saida(
      ...REQUISITOS_DA_HOMOLOGACAO,
      ...exigir("Feedbacks de homologação", "Aprovador do aceite de homologação", "Data do aceite de homologação", "Evidência do aceite de homologação"),
    ),
  },
  "12": {
    "Aguardando liberação": REQUISITOS_DA_PUBLICACAO,
    "Implantação agendada": [...REQUISITOS_DA_PUBLICACAO, ...exigir("Janela de implantação", "Aprovador da publicação", "Evidência da autorização de publicação")],
    Implantado: saida(
      ...REQUISITOS_DA_PUBLICACAO,
      ...exigir(
        "Ambiente de produção", "Aprovador da publicação", "Evidência da autorização de publicação", "Resultado da implantação",
        "Evidência da verificação em produção", "Comunicação e treinamento realizados",
      ),
      impedirSe("Resultado da implantação", "Revertida", "Resultado da implantação = Publicada (está Revertida)"),
      impedirSe("Resultado da implantação", "Parcial", "Resultado da implantação = Publicada (está Parcial)"),
    ),
  },
  "13": {
    "Operação estabilizada": saida(
      ...exigir(
        "Responsável pelo acompanhamento", "Início da operação assistida", "Fim previsto da operação assistida", "Monitoramento",
        "Critérios de estabilização", "Resultado observado", "Evidência da estabilização",
      ),
    ),
  },
  "14": {
    "Aguardando aceite final": exigir("Documentação final", "Responsável pelo suporte", "Registro da transferência para suporte"),
    Encerrado: saida(
      ...exigir(
        "Documentação final", "Responsável pelo suporte", "Registro da transferência para suporte", "Condições de manutenção e garantia",
        "Pendências aceitas no encerramento", "Avaliação dos critérios de sucesso", "Aprovador do encerramento", "Aceite final", "Data do encerramento",
      ),
    ),
  },
};

/**
 * O checklist de passagem de cada fase: o que o manual pede e um requisito de
 * Status não consegue conferir (qualidade do texto, responsável, combinações).
 */
export const CRITERIOS_DE_PASSAGEM: Readonly<Record<string, readonly string[]>> = {
  "01": [
    "Criada com execução Normal e prioridade Normal; impacto e receita não atribuídos automaticamente.",
    "Responsável definido em Nova demanda, antes da análise.",
    "Duplicidade verificada; conferido se o pedido deve seguir para suporte.",
    "Problema, público, frequência, impacto, justificativa, resultado esperado e consequência de não fazer esclarecidos.",
    "Relação com receita definida: “Sem receita associada” e “A confirmar” usadas isoladamente.",
    "Valores, cobrança, responsável e evidência comercial preenchidos quando aplicáveis; sem receita, benefício ou obrigação justificados.",
    "Sem pendência essencial: Informação pendente limpa ou respondida.",
    "Responsável pelo briefing registrado.",
  ],
  "02": [
    "Usado “Não se aplica” justificado onde pertinente.",
    "Entendimento validado com o aprovador, sem pendência essencial.",
    "Evidência de aprovação referencia a versão aprovada.",
  ],
  "03": [
    "Orçamento ou autorização de investimento documentados.",
    "Receita em risco não somada como receita nova; negociação não tratada como receita contratada; contrato não tratado como pagamento recebido.",
    "Receita nova calculada como receita única + receita mensal adicional × meses efetivamente cobrados; custos do mesmo período subtraídos; resultado não chamado de lucro líquido.",
    "Retenção e benefícios internos avaliados à parte, com justificativa.",
    "Recomendação e decisão aprovadas; condições que bloqueiam a próxima fase cumpridas.",
  ],
  "04": [
    "Exclusões e obrigações do cliente claras.",
    "Critérios de aceite verificáveis.",
    "Ajustes que afetam a viabilidade voltaram à lista 03.",
    "Aceite registrado e referência aprovada congelada.",
  ],
  "05": [
    "Funcionalidades do escopo cobertas.",
    "Regras e permissões descritas; exceções consideradas.",
    "Critérios testáveis.",
    "Nenhuma questão essencial aberta.",
  ],
  "06": [
    "Fluxos e telas cobrem o escopo.",
    "Estados de vazio, carregamento, erro e sucesso, confirmações destrutivas e validação de formulários, quando aplicáveis.",
    "Revisão interna concluída.",
    "Demanda sem interface: dispensa justificada e aprovada, registrada como evidência e no histórico.",
  ],
  "07": [
    "Ajustes obrigatórios concluídos ou formalmente dispensados.",
    "Pedidos novos separados como solicitações fora do escopo.",
    "Versão e aceite registrados.",
    "Mudanças relevantes voltaram às listas 03/04 e atualizaram especificação e design.",
  ],
  "08": [
    "Subtarefas com responsáveis, estimativas e dependências.",
    "Capacidade confirmada.",
    "Cronograma e testes aprovados.",
    "Se o detalhamento alterou significativamente custo ou prazo aprovado, viabilidade e escopo foram reavaliados.",
  ],
  "09": [
    "Subtarefas da entrega implementadas e revisadas.",
    "Verificações técnicas previstas executadas.",
    "Ambiente e versão disponíveis.",
    "Nenhuma pendência bloqueadora.",
  ],
  "10": [
    "Testes executados.",
    "Cada falha com reprodução, esperado, observado e severidade.",
    "Demais pendências aceitas explicitamente.",
    "Parecer e versão registrados.",
  ],
  "11": [
    "Critérios de aceite atendidos.",
    "Defeitos bloqueadores resolvidos.",
    "Aceite explícito: silêncio não é aceite.",
    "Exceções registradas.",
    "Mudanças de escopo reavaliadas, não incorporadas como correções.",
  ],
  "12": [
    "Autorização, publicação e verificações concluídas.",
    "Migração validada, quando houver.",
    "Usuários orientados; quando não aplicável, justificado.",
    "Resultado Publicada: Revertida ou Parcial permanece nesta fase.",
  ],
  "13": [
    "Período de observação cumprido.",
    "Critérios de estabilização atendidos.",
    "Nenhuma ocorrência crítica ou alta em aberto.",
    "Pendências menores aceitas e encaminhadas.",
  ],
  "14": [
    "Aceite final, documentação e transferência confirmados.",
    "Pendências com destino, responsável e prazo; sem pendência, registrar “Nenhuma”.",
    "Resultados e custos apurados, ou medição futura atribuída a responsável e data.",
    "Contratado, faturado e recebido distinguidos no resultado comercial.",
  ],
};

/* ───────────────────────────── Montagem do catálogo ──────────────────────── */

function campoPeloNome(lista: ListaDoProcesso, nome: string): CampoDoProcesso {
  const achado = [...lista.campos, ...CAMPOS_COMUNS, ...CAMPOS_COMERCIAIS].find((c) => c.nome === nome);
  if (!achado) throw new Error(`Regra da lista ${lista.numero} cita o Campo "${nome}", que não está no catálogo: bug no evolver.`);
  return achado;
}

function requisitoDaRegra(lista: ListaDoProcesso, regra: Regra): FieldRequirement {
  if ("impede" in regra) {
    return {
      definitionId: TRAVA_DE_PASSAGEM.id,
      whenDefinitionId: campoPeloNome(lista, regra.impede[0]).id,
      whenValue: regra.impede[1],
      label: regra.frase,
    };
  }
  const definitionId = campoPeloNome(lista, regra.exige).id;
  return regra.quando
    ? { definitionId, whenDefinitionId: campoPeloNome(lista, regra.quando[0]).id, whenValue: regra.quando[1] }
    : { definitionId };
}

/** Os Status que o manual não lista por fase, mas pede em toda Lista (Cancelado) ou que a ferramenta pede (Subtarefa concluída). */
function estadosDaLista(lista: ListaDoProcesso): readonly StatusDefinition[] {
  const regras = REGRAS_DE_PASSAGEM[lista.numero] ?? {};
  const doManual = lista.estados.map((estado) => {
    const requisitos = (regras[estado.nome] ?? []).map((regra) => requisitoDaRegra(lista, regra));
    return {
      id: estado.id,
      name: estado.nome,
      color: estado.cor,
      category: estado.categoria,
      ...(requisitos.length > 0 ? { entryRequirements: requisitos } : {}),
    };
  });
  const todos = [
    ...doManual,
    { id: `st_pp_${lista.numero}_subtarefa_concluida`, name: "Subtarefa concluída", color: "#10b981", category: "concluido" as StatusCategory },
    {
      id: `st_pp_${lista.numero}_cancelado`,
      name: "Cancelado",
      color: "#ef4444",
      category: "fechado" as StatusCategory,
      entryRequirements: CANCELADO.map((regra) => requisitoDaRegra(lista, regra)),
    },
  ];
  return todos.map((estado, order) => ({ ...estado, order }));
}

function definicaoDeCampo(
  workspaceId: Id,
  campo: CampoDoProcesso,
  onde: { readonly type: "folder" | "list"; readonly id: Id },
  clientes: readonly string[],
): FieldDefinition {
  const opcoes = campo.nome === "Cliente" ? clientes : campo.opcoes;
  return {
    id: campo.id,
    workspaceId,
    name: campo.nome,
    description: campo.observacao,
    type: campo.tipo,
    ...(opcoes ? { options: [...opcoes] } : {}),
    required: false,
    target: "task",
    definedAtType: onde.type,
    definedAtId: onde.id,
    lifecycle: "ativo",
  };
}

/** Nos usos do corpo do modelo: o que acontece em cada estado e quem responde pela fase. */
function corpoDoModelo(): string {
  return LISTAS_DO_PROCESSO.map((lista) => {
    const estados = lista.estados.map((e) => `- ${e.nome}: ${e.oQueAcontece}`).join("\n");
    return `${lista.nome}\nResponsável pela fase: ${lista.responsavelDaFase}.\n${estados}`;
  }).join("\n\n");
}

function checklistsDoModelo(): ReadonlyArray<{ readonly name: string; readonly items: readonly string[] }> {
  return LISTAS_DO_PROCESSO.map((lista, i) => {
    const proxima = LISTAS_DO_PROCESSO[i + 1];
    const primeiroEstado = proxima?.estados.find((e) => e.categoria === "naoIniciado")?.nome;
    return {
      name: `${lista.nome}: critérios de passagem`,
      items: [
        ...(CRITERIOS_DE_PASSAGEM[lista.numero] ?? []),
        "Decisão registrada com decisor, data, justificativa e evidência; resumo no histórico com fase, versão e decisão.",
        "Solicitante comunicado; data, destinatário e referência nos comentários.",
        ...(proxima
          ? [`Mover para a lista ${proxima.numero}, estado “${primeiroEstado}”, e atribuir responsável e prazo da nova fase.`]
          : []),
      ],
    };
  });
}

function comparar(divergentes: DivergenciaDeConfiguracao[], id: Id, pares: ReadonlyArray<readonly [string, string, string]>): void {
  for (const [campo, esperado, encontrado] of pares) {
    if (esperado !== encontrado) divergentes.push({ id, campo, esperado, encontrado });
  }
}

export interface OpcoesDoProcesso {
  /** As opções do Campo Cliente; ausente, nasce com `OPCAO_PROVISORIA_DE_CLIENTE`. */
  readonly clientes?: readonly string[];
  /**
   * Usa este Espaço, com o nome do manual, em vez de criar um. Ele não muda, salvo
   * a descrição quando está vazia. Reaplicar pede o mesmo id.
   */
  readonly espacoExistenteId?: Id;
}

export interface DiffDoProcesso extends DiffDeConfiguracao {
  /** O Espaço onde o processo está: o do catálogo ou o existente. */
  readonly espacoId: Id;
  readonly descricaoDoEspacoPreenchida: boolean;
}

const normalizado = (nome: string): string => nome.trim().toLocaleLowerCase("pt-BR");

/** O que impede de pôr a Pasta do processo neste Espaço; só conta enquanto a Pasta não existe. */
function recusaDoEspacoExistente(state: DataState, espacoId: Id): string | undefined {
  const espaco = state.spaces.find((s) => s.id === espacoId);
  if (!espaco) return `Espaço ${espacoId} não encontrado neste Espaço de Trabalho.`;
  if (normalizado(espaco.name) !== normalizado(ESPACO_DO_PROCESSO.nome)) {
    return `O Espaço ${espacoId} se chama "${espaco.name}", não "${ESPACO_DO_PROCESSO.nome}": confira o id.`;
  }
  if (espaco.lifecycle !== "ativo") return `O Espaço ${espacoId} está "${espaco.lifecycle}": restaure-o antes.`;
  if (state.folders.some((f) => f.id === PASTA_DO_PROCESSO.id)) return undefined;

  const bloqueados = (["statusSet", "fieldDefinitions", "defaultViews"] as const satisfies readonly ConfigurableAspect[]).filter((a) => espaco.blocks[a]);
  if (bloqueados.length > 0) return `O Espaço ${espacoId} impede sobrescrever abaixo dele: ${bloqueados.join(", ")}. Libere pela tela antes.`;

  const irma = state.folders.find(
    (f) => f.parentType === "space" && f.parentId === espacoId && f.lifecycle !== "naLixeira" && normalizado(f.name) === normalizado(PASTA_DO_PROCESSO.nome),
  );
  if (irma) return `O Espaço ${espacoId} já tem uma Pasta "${irma.name}" (${irma.id}), que não é a deste processo: decida antes o que fazer com ela.`;

  // Só os do próprio Espaço caem no caminho da Pasta: os de uma Lista vizinha não se misturam aos daqui.
  const doEspaco = new Set(
    state.fieldDefinitions
      .filter((d) => d.target === "task" && d.lifecycle === "ativo" && d.definedAtType === "space" && d.definedAtId === espacoId)
      .map((d) => normalizado(d.name)),
  );
  const catalogo = [...CAMPOS_COMUNS, ...CAMPOS_COMERCIAIS, TRAVA_DE_PASSAGEM, ...LISTAS_DO_PROCESSO.flatMap((l) => l.campos)];
  const homonimos = catalogo.filter((c) => doEspaco.has(normalizado(c.nome))).map((c) => c.nome);
  if (homonimos.length > 0) return `O Espaço ${espacoId} já define Campos com nome do manual: ${homonimos.join(", ")}. O manual não quer homônimos: decida antes o que fazer com eles.`;
  return undefined;
}

/* ───────────────────────────── A leitura ─────────────────────────────────── */

export interface ListaInspecionada {
  readonly id: Id;
  readonly nome: string;
  readonly estado: string;
  readonly statusProprios: number;
  readonly camposProprios: number;
  readonly tarefas: number;
  readonly subtarefas: number;
}

export interface EspacoInspecionado {
  readonly id: Id;
  readonly nome: string;
  readonly estado: string;
  readonly privado: boolean;
  readonly criadoEm: string;
  readonly criadoPor: string;
  readonly temDescricao: boolean;
  readonly bloqueios: readonly string[];
  readonly concessoes: number;
  readonly campos: readonly string[];
  readonly listasDiretas: readonly ListaInspecionada[];
  readonly pastas: ReadonlyArray<{ readonly id: Id; readonly nome: string; readonly estado: string; readonly privada: boolean; readonly campos: number; readonly listas: readonly ListaInspecionada[] }>;
}

/**
 * Os Espaços com o nome do manual, para decidir o que fazer com eles. Só
 * estrutura e contagens: nunca título de Tarefa nem valor de Campo.
 */
export function inspecionarEspacosDoProcesso(state: DataState): readonly EspacoInspecionado[] {
  const lista = (l: List): ListaInspecionada => {
    const tarefas = state.tasks.filter((t) => t.listId === l.id);
    return {
      id: l.id,
      nome: l.name,
      estado: l.lifecycle,
      statusProprios: l.statusSet?.definitions.length ?? 0,
      camposProprios: state.fieldDefinitions.filter((d) => d.definedAtType === "list" && d.definedAtId === l.id).length,
      tarefas: tarefas.filter((t) => !t.parentTaskId).length,
      subtarefas: tarefas.filter((t) => t.parentTaskId).length,
    };
  };
  return state.spaces
    .filter((s) => normalizado(s.name) === normalizado(ESPACO_DO_PROCESSO.nome))
    .map((s) => {
      const pastas = state.folders.filter((f) => f.parentType === "space" && f.parentId === s.id);
      const listasDe = (tipo: "space" | "folder", id: Id) => state.lists.filter((l) => l.parentType === tipo && l.parentId === id);
      // Subpastas entram junto da Pasta mãe: aqui importa o que existe, não a árvore exata.
      const subpastasDe = (id: Id) => state.folders.filter((f) => f.parentType === "folder" && f.parentId === id);
      return {
        id: s.id,
        nome: s.name,
        estado: s.lifecycle,
        privado: s.isPrivate,
        criadoEm: s.createdAt,
        criadoPor: state.members.find((m) => m.id === s.createdBy.id)?.displayName ?? s.createdBy.id,
        temDescricao: Boolean(s.description?.trim()),
        bloqueios: Object.entries(s.blocks).filter(([, ligado]) => ligado).map(([aspecto]) => aspecto),
        concessoes: state.grants.filter((g) => g.resourceId === s.id).length,
        campos: state.fieldDefinitions.filter((d) => d.definedAtType === "space" && d.definedAtId === s.id).map((d) => d.name),
        listasDiretas: listasDe("space", s.id).map(lista),
        pastas: pastas.map((f) => ({
          id: f.id,
          nome: f.name,
          estado: f.lifecycle,
          privada: f.isPrivate,
          campos: state.fieldDefinitions.filter((d) => d.definedAtType === "folder" && d.definedAtId === f.id).length,
          listas: [f, ...subpastasDe(f.id)].flatMap((p) => listasDe("folder", p.id)).map(lista),
        })),
      };
    });
}

/* ───────────────────────────── O evolver ─────────────────────────────────── */

export function evoluirProcessoDeProjetos(
  state: DataState,
  actingMemberId: Id,
  opcoes: OpcoesDoProcesso = {},
): OperationResult<DiffDoProcesso> {
  const membro = state.members.find((m) => m.id === actingMemberId);
  if (!membro || membro.state !== "ativo") return fail(`Membro ${actingMemberId} não existe ou não está ativo neste Espaço de Trabalho.`);
  const base = state.roles.find((r) => r.id === membro.roleId)?.base;
  if (base !== "proprietario" && base !== "administrador") {
    return fail(`Configurar a Estrutura exige Administrador ou Proprietário; ${actingMemberId} tem a base "${base ?? "desconhecida"}".`);
  }

  const clientes = (opcoes.clientes ?? [OPCAO_PROVISORIA_DE_CLIENTE]).map((c) => c.trim()).filter(Boolean);
  if (clientes.length === 0) return fail("Informe ao menos um cliente, ou não passe a lista.");
  if (new Set(clientes.map((c) => c.toLocaleLowerCase("pt-BR"))).size !== clientes.length) return fail("A lista de clientes tem nome repetido.");

  const agora = new Date().toISOString();
  const ator: ActorRef = memberActor(actingMemberId);
  const workspaceId = state.workspace.id;
  const criados: string[] = [];
  const conferidos: string[] = [];
  const divergentes: DivergenciaDeConfiguracao[] = [];
  const registrar = (objectType: string, objectId: Id, objectName: string, detail?: string): void => {
    recordActivity(state, { actor: ator, action: "criar", objectType, objectId, objectName, at: agora, ...(detail ? { detail } : {}) });
  };

  /* ── Espaço ────────────────────────────────────────────────────────────── */
  const adotado = opcoes.espacoExistenteId !== undefined;
  const espacoId = opcoes.espacoExistenteId ?? ESPACO_DO_PROCESSO.id;
  let descricaoDoEspacoPreenchida = false;

  // B38a: privado some para todo mundo sem concessão, inclusive para quem o criou.
  // Só na criação do contêiner: reaplicar não devolve acesso que alguém tirou de propósito.
  const concederAcesso = (resourceType: "space" | "folder", resourceId: Id): void => {
    const proprietarios = state.members.filter(
      (m) => m.state === "ativo" && state.roles.find((r) => r.id === m.roleId)?.base === "proprietario",
    );
    for (const subjectId of new Set([actingMemberId, ...proprietarios.map((m) => m.id)])) {
      const id = `grt_pp_${subjectId}`;
      state.grants.push({
        id,
        workspaceId,
        subjectKind: "member",
        subjectId,
        resourceType,
        resourceId,
        action: "administrar",
        scope: "subarvore",
        origin: "concessaoDireta",
        grantedBy: actingMemberId,
        grantedAt: agora,
      });
      criados.push(id);
    }
  };
  // Sem o Tipo padrão, nenhuma Lista abaixo aceita Tarefa (o mesmo de `createSpace`).
  const garantirTipoDeTarefa = (): void => {
    if (state.taskTypes.some((t) => t.definedAtType === "space" && t.definedAtId === espacoId)) return;
    state.taskTypes.push({ id: TIPO_DE_TAREFA_ID, name: "Tarefa", icon: "circle-check", isPlatformDefault: true, definedAtType: "space", definedAtId: espacoId });
    criados.push(TIPO_DE_TAREFA_ID);
  };

  if (adotado) {
    const recusa = recusaDoEspacoExistente(state, espacoId);
    if (recusa) return fail(recusa);
    const alvo = state.spaces.find((s) => s.id === espacoId)!;
    garantirTipoDeTarefa();
    conferidos.push(alvo.id);
    if (!alvo.description?.trim()) {
      alvo.description = ESPACO_DO_PROCESSO.descricao;
      descricaoDoEspacoPreenchida = true;
      recordActivity(state, { actor: ator, action: "Descrição do Espaço preenchida", objectType: "space", objectId: alvo.id, objectName: alvo.name, at: agora });
    }
  } else {
    const espaco = state.spaces.find((s) => s.id === ESPACO_DO_PROCESSO.id);
    if (espaco) {
      comparar(divergentes, espaco.id, [["name", ESPACO_DO_PROCESSO.nome, espaco.name]]);
      conferidos.push(espaco.id);
    } else {
      const homonimo = state.spaces.find((s) => s.lifecycle !== "naLixeira" && normalizado(s.name) === normalizado(ESPACO_DO_PROCESSO.nome));
      if (homonimo) {
        return fail(`Já existe outro Espaço chamado "${homonimo.name}" (${homonimo.id}) e ele não é o deste processo: nada foi criado. Veja o que há nele com --inspecionar; para usá-lo, passe --espaco=${homonimo.id}.`);
      }
      if (state.spaces.filter((s) => s.lifecycle !== "naLixeira").length >= state.workspace.limits.spaces) {
        return fail(`O limite de ${state.workspace.limits.spaces} Espaços do Espaço de Trabalho foi atingido.`);
      }
      const novo: Space = {
        id: ESPACO_DO_PROCESSO.id,
        workspaceId,
        createdBy: ator,
        createdAt: agora,
        lifecycle: "ativo",
        name: ESPACO_DO_PROCESSO.nome,
        description: ESPACO_DO_PROCESSO.descricao,
        order: state.spaces.reduce((maior, s) => Math.max(maior, s.order), -1) + 1,
        isPrivate: true,
        modes: {},
        blocks: {},
        // RN-ESP-03: o Espaço sempre define um Conjunto. Toda Lista daqui sobrescreve,
        // então este só vale para o que alguém criar fora da Pasta.
        statusSet: {
          id: "sts_pp_espaco",
          definitions: [
            { id: "st_pp_espaco_a_fazer", name: "A fazer", color: "#94a3b8", category: "naoIniciado", order: 0 },
            { id: "st_pp_espaco_em_andamento", name: "Em andamento", color: "#3b82f6", category: "emAndamento", order: 1 },
            { id: "st_pp_espaco_concluido", name: "Concluído", color: "#10b981", category: "concluido", order: 2 },
            { id: "st_pp_espaco_cancelado", name: "Cancelado", color: "#ef4444", category: "fechado", order: 3 },
          ],
        },
      };
      state.spaces.push(novo);
      criados.push(novo.id);
      garantirTipoDeTarefa();
      registrar("space", novo.id, novo.name, "Privado: só quem tem concessão o vê.");
      concederAcesso("space", novo.id);
    }
  }

  /* ── Pasta ─────────────────────────────────────────────────────────────── */
  const pasta = state.folders.find((f) => f.id === PASTA_DO_PROCESSO.id);
  if (pasta) {
    comparar(divergentes, pasta.id, [
      ["name", PASTA_DO_PROCESSO.nome, pasta.name],
      ["parentId", espacoId, pasta.parentId],
    ]);
    conferidos.push(pasta.id);
  } else {
    const nova: Folder = {
      id: PASTA_DO_PROCESSO.id,
      workspaceId,
      createdBy: ator,
      createdAt: agora,
      lifecycle: "ativo",
      name: PASTA_DO_PROCESSO.nome,
      description: PASTA_DO_PROCESSO.descricao,
      order: state.folders.filter((f) => f.parentType === "space" && f.parentId === espacoId).reduce((maior, f) => Math.max(maior, f.order), -1) + 1,
      isPrivate: adotado,
      // O manual pede o Quadro por status para a operação diária: toda Lista abre nele.
      modes: { defaultViews: "sobrescrito" },
      defaultViews: { disponiveis: ["quadro", "tabela", "lista", "calendario", "linhaDoTempo"], inicial: "quadro" },
      blocks: {},
      parentType: "space",
      parentId: espacoId,
    };
    state.folders.push(nova);
    criados.push(nova.id);
    registrar("folder", nova.id, nova.name, adotado ? "Privada: só quem tem concessão a vê." : undefined);
    if (adotado) concederAcesso("folder", nova.id);
  }

  /* ── Campos da Pasta ───────────────────────────────────────────────────── */
  const garantirCampo = (campo: CampoDoProcesso, onde: { readonly type: "folder" | "list"; readonly id: Id }): void => {
    const existente = state.fieldDefinitions.find((d) => d.id === campo.id);
    if (existente) {
      comparar(divergentes, existente.id, [
        ["name", campo.nome, existente.name],
        ["type", campo.tipo, existente.type],
        ["definedAtId", onde.id, existente.definedAtId ?? ""],
      ]);
      conferidos.push(existente.id);
      return;
    }
    state.fieldDefinitions.push(definicaoDeCampo(workspaceId, campo, onde, clientes));
    criados.push(campo.id);
  };
  const naPasta = { type: "folder", id: PASTA_DO_PROCESSO.id } as const;
  for (const campo of [...CAMPOS_COMUNS, ...CAMPOS_COMERCIAIS, TRAVA_DE_PASSAGEM]) garantirCampo(campo, naPasta);

  /* ── Listas, Status, Campos da fase e Visualizações ────────────────────── */
  LISTAS_DO_PROCESSO.forEach((lista, ordem) => {
    const estados = estadosDaLista(lista);
    const existente = state.lists.find((l) => l.id === lista.id);
    if (existente) {
      comparar(divergentes, existente.id, [
        ["name", lista.nome, existente.name],
        ["parentId", PASTA_DO_PROCESSO.id, existente.parentId],
      ]);
      conferidos.push(existente.id);
      for (const estado of estados) {
        const conjunto = existente.statusSet;
        const atual = conjunto?.definitions.find((d) => d.id === estado.id);
        if (atual) {
          comparar(divergentes, atual.id, [
            ["name", estado.name, atual.name],
            ["category", estado.category, atual.category],
          ]);
          conferidos.push(atual.id);
        } else if (conjunto) {
          const ultima = conjunto.definitions.reduce((maior, d) => Math.max(maior, d.order), -1);
          conjunto.definitions.push({ ...estado, order: ultima + 1 });
          criados.push(estado.id);
        } else {
          divergentes.push({ id: existente.id, campo: "statusSet", esperado: `sts_pp_${lista.numero}`, encontrado: "herdado" });
        }
      }
    } else {
      // A trava fica fora de todas; os comerciais, fora de todas menos 01, 03 e 14.
      const usaComerciais = ["01", "03", "14"].includes(lista.numero);
      const nova: List = {
        id: lista.id,
        workspaceId,
        createdBy: ator,
        createdAt: agora,
        lifecycle: "ativo",
        name: lista.nome,
        description: lista.descricao,
        order: ordem,
        isPrivate: false,
        modeloDeTarefa: "operacional",
        modes: { statusSet: "sobrescrito" },
        statusSet: { id: `sts_pp_${lista.numero}`, definitions: estados.map((e) => ({ ...e })) },
        camposHerdadosFora: [...(usaComerciais ? [] : CAMPOS_COMERCIAIS.map((c) => c.id)), TRAVA_DE_PASSAGEM.id],
        parentType: "folder",
        parentId: PASTA_DO_PROCESSO.id,
      };
      state.lists.push(nova);
      criados.push(nova.id, ...estados.map((e) => e.id));
      registrar("list", nova.id, nova.name, `${estados.length} Status, ${lista.campos.length} Campos da fase`);
    }

    const naLista = { type: "list", id: lista.id } as const;
    for (const campo of lista.campos) garantirCampo(campo, naLista);

    const visoes: ReadonlyArray<Pick<View, "id" | "name" | "kind" | "filters" | "groupBy">> = [
      { id: `viw_pp_${lista.numero}_quadro`, name: "Quadro por status", kind: "quadro", filters: {}, groupBy: "status" },
      { id: `viw_pp_${lista.numero}_tabela`, name: "Tabela de configuração", kind: "tabela", filters: {}, groupBy: "status" },
      { id: `viw_pp_${lista.numero}_encerradas`, name: "Encerradas", kind: "tabela", filters: { statusCategory: "fechado" } },
    ];
    for (const visao of visoes) {
      const atual = state.views.find((v) => v.id === visao.id);
      if (atual) {
        comparar(divergentes, atual.id, [
          ["name", visao.name, atual.name],
          ["listId", lista.id, atual.listId],
        ]);
        conferidos.push(atual.id);
      } else {
        state.views.push({
          ...visao,
          ownerKind: "container",
          ownerId: lista.id,
          listId: lista.id,
          isDefault: false,
          createdBy: actingMemberId,
          createdAt: agora,
        });
        criados.push(visao.id);
      }
    }
  });

  /* ── Modelo de Tarefa ──────────────────────────────────────────────────── */
  const modelo = state.templates.find((t) => t.id === TEMPLATE_DO_PROCESSO_ID);
  if (modelo) {
    comparar(divergentes, modelo.id, [["kind", "tarefa", modelo.kind]]);
    conferidos.push(modelo.id);
  } else {
    // O manual pede um modelo por fase "sem criar cópias da demanda". Aqui instanciar
    // um modelo cria Tarefa nova, então um por fase seria justamente a cópia: é um
    // modelo só, usado na lista 01, com um checklist por fase, que viaja com a Tarefa.
    const novo: Template = {
      id: TEMPLATE_DO_PROCESSO_ID,
      workspaceId,
      kind: "tarefa",
      name: "Nova demanda: Processo de Projetos",
      description: "Use na lista 01. A Tarefa percorre as 14 fases e leva um checklist de passagem por fase.",
      body: corpoDoModelo(),
      creates: { task: { title: "Nova demanda", description: "", priority: "normal", checklists: checklistsDoModelo(), subtasks: [] } },
      createdBy: ator,
      createdAt: agora,
      lifecycle: "ativo",
    };
    state.templates.push(novo);
    criados.push(novo.id);
    registrar("template", novo.id, novo.name);
  }

  if (divergentes.length > 0) {
    const linhas = divergentes.map((d) => `${d.id}.${d.campo}: esperado "${d.esperado}", encontrado "${d.encontrado}"`);
    return fail(`O Processo de Projetos no banco diverge do manual; nada foi sobrescrito:\n${linhas.join("\n")}`);
  }
  return ok({ criados, conferidos, divergentes, espacoId, descricaoDoEspacoPreenchida });
}
