/**
 * O manual "Configuração do Processo de Projetos" (v1.0, 06/11/2026) como dado.
 *
 * Gerado a partir do `.md` do manual, sem digitação: nomes, opções, descrições
 * e observações são os do documento. O que este arquivo acrescenta é o mapa
 * para a ferramenta, e cada acréscimo vem marcado:
 *   - Entrada, Em andamento, Saída da fase e Encerrado viram `naoIniciado`,
 *     `emAndamento`, `concluido` e `fechado`;
 *   - "Pessoas" vira texto longo e "Relacionamento" guarda texto, com a nota no
 *     fim da observação, porque é o que o Campo daqui grava;
 *   - "Sim/Não" vira seleção de duas opções: vazio precisa continuar querendo
 *     dizer "ainda não respondido", e `checkbox` não tem esse terceiro estado.
 *
 * As regras de passagem não moram aqui: estão em `processo-de-projetos-evolver.ts`.
 */

import type { FieldType, Id, StatusCategory } from "./types";

export interface CampoDoProcesso {
  readonly id: Id;
  readonly nome: string;
  readonly tipo: FieldType;
  /** Presente em toda seleção, menos Cliente: as opções dele vêm de quem aplica. */
  readonly opcoes?: readonly string[];
  readonly observacao: string;
}

export interface EstadoDoProcesso {
  readonly id: Id;
  readonly nome: string;
  readonly categoria: StatusCategory;
  readonly cor: string;
  /** Do manual. A Definição de Status não tem descrição: vai para o corpo do modelo de Tarefa. */
  readonly oQueAcontece: string;
}

export interface ListaDoProcesso {
  readonly numero: string;
  readonly id: Id;
  readonly nome: string;
  readonly descricao: string;
  readonly responsavelDaFase: string;
  readonly estados: readonly EstadoDoProcesso[];
  readonly campos: readonly CampoDoProcesso[];
}

export const ESPACO_DO_PROCESSO = { id: "spc_pp_produto_tecnologia", nome: "Produto e Tecnologia", descricao: "Centraliza a gestão de demandas e projetos de tecnologia, desde o recebimento e a análise de impacto e receita até o planejamento, desenvolvimento, entrega e transição para suporte." } as const;

export const PASTA_DO_PROCESSO = { id: "fld_pp_processo_projetos", nome: "Processo de Projetos", descricao: "Organiza o processo padrão de projetos em 14 fases, com estados, responsáveis, informações e critérios de aprovação próprios de cada fase. Todos os clientes seguem o mesmo processo." } as const;

export const CAMPOS_COMUNS: readonly CampoDoProcesso[] = [
  { id: "fd_pp_cliente", nome: "Cliente", tipo: "singleSelect", observacao: "Identifica o cliente. Cadastrar uma opção por cliente, com nome padronizado. Deixar vazio apenas quando a origem for interna e não houver cliente relacionado." },
  { id: "fd_pp_solicitante", nome: "Solicitante", tipo: "text", observacao: "Nome e contato de quem pediu a demanda; pode ser uma pessoa interna ou externa." },
  { id: "fd_pp_origem", nome: "Origem", tipo: "singleSelect", opcoes: ["Cliente", "Comercial", "Suporte", "Direção", "Equipe interna"], observacao: "Opções: Cliente; Comercial; Suporte; Direção; Equipe interna. Indica de onde veio a solicitação." },
  { id: "fd_pp_tipo_de_demanda", nome: "Tipo de demanda", tipo: "singleSelect", opcoes: ["Novo projeto", "Nova funcionalidade", "Melhoria", "Integração", "Correção", "Demanda técnica"], observacao: "Opções: Novo projeto; Nova funcionalidade; Melhoria; Integração; Correção; Demanda técnica. Classifica a natureza do trabalho." },
  { id: "fd_pp_saude_do_projeto", nome: "Saúde do projeto", tipo: "singleSelect", opcoes: ["No prazo", "Em risco", "Atrasado", "Pausado"], observacao: "Opções: No prazo; Em risco; Atrasado; Pausado. Em risco indica ameaça ao compromisso; Atrasado indica prazo vencido; Pausado indica suspensão deliberada." },
  { id: "fd_pp_situacao_de_execucao", nome: "Situação de execução", tipo: "singleSelect", opcoes: ["Normal", "Bloqueada", "Pausada"], observacao: "Opções: Normal; Bloqueada; Pausada. Registra impedimento ou suspensão sem substituir o estado da fase." },
  { id: "fd_pp_motivo_do_impedimento_ou_pausa", nome: "Motivo do impedimento ou pausa", tipo: "longText", observacao: "Explica o impedimento ou a decisão de suspender o trabalho. Obrigatório quando a execução não for Normal." },
  { id: "fd_pp_responsavel_pelo_desbloqueio_ou_retomada", nome: "Responsável pelo desbloqueio ou retomada", tipo: "person", observacao: "Pessoa interna que acompanha a resolução ou a retomada. Obrigatório quando a execução não for Normal." },
  { id: "fd_pp_proxima_revisao_do_impedimento_ou_pausa", nome: "Próxima revisão do impedimento ou pausa", tipo: "date", observacao: "Data para revisar a situação, sem significar promessa de resolução. Obrigatória quando a execução não for Normal." },
  { id: "fd_pp_decisor_da_fase", nome: "Decisor da fase", tipo: "text", observacao: "Nome e papel de quem aprovou ou rejeitou a passagem. Para decisões financeiras, deve ter autoridade sobre orçamento e receita." },
  { id: "fd_pp_data_da_decisao_da_fase", nome: "Data da decisão da fase", tipo: "date", observacao: "Data da decisão mais recente. O histórico de cada fase deve preservar os valores anteriores." },
  { id: "fd_pp_motivo_do_cancelamento", nome: "Motivo do cancelamento", tipo: "longText", observacao: "Justificativa exigida antes de usar Cancelado. Informar também as obrigações ou pendências que permanecem." },
];

export const CAMPOS_COMERCIAIS: readonly CampoDoProcesso[] = [
  { id: "fd_pp_relacao_com_receita", nome: "Relação com receita", tipo: "multiSelect", opcoes: ["Receita direta", "Expansão de contrato", "Retenção de receita", "Sem receita associada", "A confirmar"], observacao: "Opções: Receita direta; Expansão de contrato; Retenção de receita; Sem receita associada; A confirmar. As três primeiras podem coexistir. Sem receita associada e A confirmar devem ser usadas isoladamente." },
  { id: "fd_pp_modelo_de_cobranca", nome: "Modelo de cobrança", tipo: "singleSelect", opcoes: ["Única", "Recorrente", "Única + recorrente", "Sem cobrança adicional"], observacao: "Opções: Única; Recorrente; Única + recorrente; Sem cobrança adicional. Descreve a cobrança associada à demanda." },
  { id: "fd_pp_receita_unica_prevista", nome: "Receita única prevista", tipo: "currency", observacao: "Valor bruto esperado da cobrança pontual. Não representa lucro, faturamento realizado ou pagamento recebido." },
  { id: "fd_pp_receita_mensal_adicional_prevista", nome: "Receita mensal adicional prevista", tipo: "currency", observacao: "Aumento bruto esperado da receita mensal; excluir a mensalidade existente e valores já incluídos em outra previsão." },
  { id: "fd_pp_receita_mensal_em_risco", nome: "Receita mensal em risco", tipo: "currency", observacao: "Receita mensal existente sujeita à perda se a demanda não for atendida. Registrar evidência do risco; não somar como receita nova." },
  { id: "fd_pp_situacao_comercial", nome: "Situação comercial", tipo: "singleSelect", opcoes: ["Não apresentada", "Em negociação", "Proposta aceita", "Contrato assinado", "Não se aplica"], observacao: "Opções: Não apresentada; Em negociação; Proposta aceita; Contrato assinado; Não se aplica. Não comprova recebimento financeiro." },
  { id: "fd_pp_evidencia_comercial", nome: "Evidência comercial", tipo: "url", observacao: "Link para proposta, contrato ou negociação que fundamenta valores e condições." },
  { id: "fd_pp_responsavel_comercial", nome: "Responsável comercial", tipo: "person", observacao: "Pessoa interna que confirma a oportunidade, os valores, as condições e a evidência comercial." },
];

export const LISTAS_DO_PROCESSO: readonly ListaDoProcesso[] = [
  {
    numero: "01", id: "lst_pp_01", nome: "01. Recebimento de demandas",
    descricao: "Centraliza a entrada e a avaliação inicial das demandas. Nesta lista, analisamos o problema, o público afetado, os impactos, a urgência e a relação com receita para decidir se a demanda deve avançar para o briefing.",
    responsavelDaFase: "responsável pela triagem de produto",
    estados: [
      { id: "st_pp_01_nova_demanda", nome: "Nova demanda", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Registrar pedido, solicitante e origem; designar responsável; verificar duplicidade e se o pedido deve seguir para suporte." },
      { id: "st_pp_01_em_tramitacao", nome: "Em tramitação", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Entender o problema; analisar público, abrangência, frequência, impacto, prazo e receita; validar informações comerciais." },
      { id: "st_pp_01_aguardando_informacoes", nome: "Aguardando informações", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Registrar perguntas específicas, pessoa que responderá e prazo; acompanhar o retorno e voltar para Em tramitação." },
      { id: "st_pp_01_qualificada", nome: "Qualificada", categoria: "concluido", cor: "#10b981", oQueAcontece: "Registrar decisão favorável e responsável pelo briefing. Qualificação autoriza aprofundar; não autoriza desenvolver." },
      { id: "st_pp_01_nao_aprovada", nome: "Não aprovada", categoria: "fechado", cor: "#ef4444", oQueAcontece: "Registrar motivo, justificativa e possível condição de reavaliação; comunicar o solicitante." },
    ],
    campos: [
      { id: "fd_pp_problema_a_resolver", nome: "Problema a resolver", tipo: "longText", observacao: "Dificuldade atual e contexto em que acontece; distinguir necessidade de solução sugerida." },
      { id: "fd_pp_publico_afetado", nome: "Público afetado", tipo: "text", observacao: "Usuários, equipes ou perfis de clientes que enfrentam o problema." },
      { id: "fd_pp_abrangencia", nome: "Abrangência", tipo: "text", observacao: "Quantidade com unidade. Exemplo: 30 usuários de 5 clientes." },
      { id: "fd_pp_frequencia_do_problema", nome: "Frequência do problema", tipo: "singleSelect", opcoes: ["Pontual", "Diária", "Semanal", "Mensal", "Outra"], observacao: "Opções: Pontual; Diária; Semanal; Mensal; Outra. Indica recorrência." },
      { id: "fd_pp_categoria_do_impacto", nome: "Categoria do impacto", tipo: "multiSelect", opcoes: ["Receita", "Custos", "Operação", "Experiência do usuário", "Contrato", "Segurança"], observacao: "Opções: Receita; Custos; Operação; Experiência do usuário; Contrato; Segurança." },
      { id: "fd_pp_intensidade_do_impacto", nome: "Intensidade do impacto", tipo: "singleSelect", opcoes: ["Baixa", "Média", "Alta"], observacao: "Opções: Baixa; Média; Alta. Baixa: incômodo localizado com alternativa simples. Média: prejuízo ou retrabalho recorrente. Alta: atividade importante impedida ou consequência financeira/contratual relevante." },
      { id: "fd_pp_justificativa_do_impacto", nome: "Justificativa do impacto", tipo: "longText", observacao: "Exemplos e evidências que sustentam a classificação, incluindo números quando disponíveis." },
      { id: "fd_pp_resultado_esperado", nome: "Resultado esperado", tipo: "longText", observacao: "Benefício pretendido, preferencialmente mensurável." },
      { id: "fd_pp_data_necessaria", nome: "Data necessária", tipo: "date", observacao: "Data solicitada para entrega; é uma necessidade informada, ainda não um compromisso aprovado." },
      { id: "fd_pp_motivo_da_data", nome: "Motivo da data", tipo: "longText", observacao: "Restrição que explica o prazo, como contrato, evento ou início de operação." },
      { id: "fd_pp_consequencia_de_nao_fazer", nome: "Consequência de não fazer", tipo: "longText", observacao: "Efeito de adiar ou rejeitar, incluindo custo, perda ou permanência do problema." },
      { id: "fd_pp_informacao_pendente", nome: "Informação pendente", tipo: "longText", observacao: "Perguntas exatas que impedem concluir a triagem." },
      { id: "fd_pp_responsavel_pelo_retorno", nome: "Responsável pelo retorno", tipo: "text", observacao: "Nome e contato de quem fornecerá as informações, inclusive pessoas externas." },
      { id: "fd_pp_prazo_para_retorno", nome: "Prazo para retorno", tipo: "date", observacao: "Data combinada para resposta e acompanhamento." },
      { id: "fd_pp_justificativa_da_decisao", nome: "Justificativa da decisão", tipo: "longText", observacao: "Razões para qualificar ou não aprovar. Obrigatória nos dois resultados." },
      { id: "fd_pp_motivo_da_nao_aprovacao", nome: "Motivo da não aprovação", tipo: "singleSelect", opcoes: ["Fora de escopo", "Sem aderência", "Benefício insuficiente", "Informações insuficientes", "Retirada pelo solicitante", "Adiada"], observacao: "Opções: Fora de escopo; Sem aderência; Benefício insuficiente; Informações insuficientes; Retirada pelo solicitante; Adiada." },
      { id: "fd_pp_condicao_de_reavaliacao", nome: "Condição de reavaliação", tipo: "longText", observacao: "Evento, mudança ou informação que permite retomar uma demanda encerrada ou adiada." },
      { id: "fd_pp_demanda_original", nome: "Demanda original", tipo: "relation", observacao: "Vínculo com a tarefa original quando o registro for duplicado. Nesta ferramenta o Campo guarda texto: cole o link da Tarefa, ou várias, uma por linha." },
      { id: "fd_pp_encaminhamento_da_triagem", nome: "Encaminhamento da triagem", tipo: "singleSelect", opcoes: ["Processo de projetos", "Suporte", "Duplicada"], observacao: "Opções: Processo de projetos; Suporte; Duplicada. Distingue encaminhamento de rejeição de negócio." },
      { id: "fd_pp_destino_do_encaminhamento", nome: "Destino do encaminhamento", tipo: "url", observacao: "Link do chamado de suporte ou do registro de destino. Obrigatório quando encaminhada para suporte." },
    ],
  },
  {
    numero: "02", id: "lst_pp_02", nome: "02. Briefing e levantamento de requisitos",
    descricao: "Aprofunda a demanda qualificada, documentando objetivos, usuários, processos atuais, requisitos iniciais, restrições e critérios de sucesso para estabelecer um entendimento comum antes da análise de viabilidade.",
    responsavelDaFase: "responsável de produto ou analista de requisitos",
    estados: [
      { id: "st_pp_02_a_agendar", nome: "A agendar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Identificar participantes e combinar a reunião de briefing." },
      { id: "st_pp_02_reuniao_agendada", nome: "Reunião agendada", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Confirmar data, participantes e materiais prévios." },
      { id: "st_pp_02_em_levantamento", nome: "Em levantamento", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Entrevistar envolvidos e levantar necessidades, processo atual e restrições." },
      { id: "st_pp_02_aguardando_informacoes", nome: "Aguardando informações", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Solicitar informações faltantes com responsável e prazo registrados." },
      { id: "st_pp_02_em_documentacao", nome: "Em documentação", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Consolidar respostas e requisitos no briefing." },
      { id: "st_pp_02_aguardando_validacao", nome: "Aguardando validação", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Encaminhar o documento ao aprovador para confirmar o entendimento." },
      { id: "st_pp_02_ajustes_solicitados", nome: "Ajustes solicitados", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Registrar divergências e corrigir o briefing antes de reenviar." },
      { id: "st_pp_02_briefing_aprovado", nome: "Briefing aprovado", categoria: "concluido", cor: "#10b981", oQueAcontece: "Registrar o aceite da versão documentada." },
    ],
    campos: [
      { id: "fd_pp_data_da_reuniao_de_briefing", nome: "Data da reunião de briefing", tipo: "dateTime", observacao: "Horário combinado com os participantes." },
      { id: "fd_pp_participantes_do_briefing", nome: "Participantes do briefing", tipo: "longText", observacao: "Nomes, papéis e contatos dos envolvidos." },
      { id: "fd_pp_objetivo_do_projeto", nome: "Objetivo do projeto", tipo: "longText", observacao: "Resultado de negócio que o projeto pretende atingir." },
      { id: "fd_pp_processo_atual", nome: "Processo atual", tipo: "longText", observacao: "Como a atividade funciona hoje, incluindo alternativas manuais." },
      { id: "fd_pp_perfis_de_usuarios", nome: "Perfis de usuários", tipo: "longText", observacao: "Grupos de usuários, suas necessidades e diferenças de acesso." },
      { id: "fd_pp_documento_de_briefing", nome: "Documento de briefing", tipo: "url", observacao: "Fonte central do levantamento e dos requisitos iniciais." },
      { id: "fd_pp_sistemas_envolvidos", nome: "Sistemas envolvidos", tipo: "longText", observacao: "Plataformas existentes, integrações previstas e responsáveis pelos sistemas." },
      { id: "fd_pp_restricoes_conhecidas", nome: "Restrições conhecidas", tipo: "longText", observacao: "Limites técnicos, financeiros, contratuais, operacionais ou de prazo." },
      { id: "fd_pp_criterios_de_sucesso", nome: "Critérios de sucesso", tipo: "longText", observacao: "Resultados que permitirão avaliar o sucesso; registrar indicador e referência inicial quando disponíveis." },
      { id: "fd_pp_aprovador_do_briefing", nome: "Aprovador do briefing", tipo: "text", observacao: "Nome e papel de quem pode confirmar o entendimento." },
      { id: "fd_pp_pendencias_do_briefing", nome: "Pendências do briefing", tipo: "longText", observacao: "Perguntas em aberto, com quem responde e prazo para cada uma." },
      { id: "fd_pp_versao_do_briefing", nome: "Versão do briefing", tipo: "text", observacao: "Identificação da versão submetida à aprovação." },
      { id: "fd_pp_evidencia_da_aprovacao_do_briefing", nome: "Evidência da aprovação do briefing", tipo: "url", observacao: "Registro do aceite com referência à versão aprovada." },
    ],
  },
  {
    numero: "03", id: "lst_pp_03", nome: "03. Análise de viabilidade",
    descricao: "Avalia a possibilidade técnica, a capacidade de execução, os custos, o prazo e o retorno econômico da demanda, registrando riscos e condições para decidir se o projeto deve continuar.",
    responsavelDaFase: "responsável técnico, com apoio comercial e financeiro",
    estados: [
      { id: "st_pp_03_a_analisar", nome: "A analisar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Conferir briefing e definir participantes da avaliação." },
      { id: "st_pp_03_em_analise_tecnica", nome: "Em análise técnica", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Avaliar integrações, tecnologia, dados, segurança e capacidade técnica." },
      { id: "st_pp_03_em_estimativa_de_custos_e_prazo", nome: "Em estimativa de custos e prazo", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Estimar esforço, custos, dependências e duração com premissas explícitas." },
      { id: "st_pp_03_em_analise_de_receita_e_rentabilidade", nome: "Em análise de receita e rentabilidade", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Validar previsões comerciais e comparar benefícios com custos no horizonte definido." },
      { id: "st_pp_03_aguardando_informacoes", nome: "Aguardando informações", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Obter acessos informativos, cotações ou respostas necessárias; registrar responsável e prazo." },
      { id: "st_pp_03_aguardando_decisao", nome: "Aguardando decisão", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Apresentar parecer e condições ao decisor autorizado." },
      { id: "st_pp_03_viavel", nome: "Viável", categoria: "concluido", cor: "#10b981", oQueAcontece: "Registrar autorização para seguir e as condições aceitas." },
      { id: "st_pp_03_inviavel", nome: "Inviável", categoria: "fechado", cor: "#ef4444", oQueAcontece: "Registrar impedimentos ou desequilíbrio econômico que inviabilizam a continuidade e comunicar." },
    ],
    campos: [
      { id: "fd_pp_responsavel_tecnico", nome: "Responsável técnico", tipo: "person", observacao: "Quem responde pela avaliação técnica." },
      { id: "fd_pp_parecer_tecnico", nome: "Parecer técnico", tipo: "longText", observacao: "Conclusão técnica e requisitos necessários para executar." },
      { id: "fd_pp_esforco_preliminar_em_horas", nome: "Esforço preliminar em horas", tipo: "number", observacao: "Estimativa inicial do esforço total; ainda sujeita ao planejamento detalhado." },
      { id: "fd_pp_custo_estimado_de_desenvolvimento", nome: "Custo estimado de desenvolvimento", tipo: "currency", observacao: "Custo incremental de construção, incluindo equipe, terceiros e despesas previstas." },
      { id: "fd_pp_custo_mensal_adicional_de_operacao", nome: "Custo mensal adicional de operação", tipo: "currency", observacao: "Infraestrutura, licenças, suporte e outros custos mensais adicionais." },
      { id: "fd_pp_prazo_estimado_em_dias_uteis", nome: "Prazo estimado em dias úteis", tipo: "number", observacao: "Duração preliminar, considerando capacidade e dependências." },
      { id: "fd_pp_orcamento_disponivel", nome: "Orçamento disponível", tipo: "currency", observacao: "Limite de investimento informado ou aprovado." },
      { id: "fd_pp_dependencias_externas", nome: "Dependências externas", tipo: "longText", observacao: "Fornecedores, sistemas, acessos ou decisões externos à equipe." },
      { id: "fd_pp_riscos_e_premissas", nome: "Riscos e premissas", tipo: "longText", observacao: "Incertezas, probabilidade qualitativa, consequências e premissas das estimativas." },
      { id: "fd_pp_horizonte_financeiro_em_meses", nome: "Horizonte financeiro em meses", tipo: "number", observacao: "Período usado na comparação econômica; inteiro positivo." },
      { id: "fd_pp_memoria_da_analise_financeira", nome: "Memória da análise financeira", tipo: "url", observacao: "Cálculo com receitas, custos, início da recorrência, impostos e demais premissas aplicáveis." },
      { id: "fd_pp_parecer_financeiro", nome: "Parecer financeiro", tipo: "longText", observacao: "Resultado econômico e justificativa para executar, inclusive quando o benefício for não financeiro." },
      { id: "fd_pp_recomendacao_de_viabilidade", nome: "Recomendação de viabilidade", tipo: "singleSelect", opcoes: ["Executar", "Executar com condições", "Não executar"], observacao: "Opções: Executar; Executar com condições; Não executar." },
      { id: "fd_pp_condicoes_para_execucao", nome: "Condições para execução", tipo: "longText", observacao: "Condições aceitas, seus responsáveis e quando precisam ser atendidas." },
      { id: "fd_pp_pendencias_de_viabilidade", nome: "Pendências de viabilidade", tipo: "longText", observacao: "Informações faltantes, responsáveis e prazos." },
      { id: "fd_pp_aprovador_da_viabilidade", nome: "Aprovador da viabilidade", tipo: "text", observacao: "Decisor com autoridade técnica e financeira ou referência aos dois aprovadores." },
      { id: "fd_pp_evidencia_da_decisao_de_viabilidade", nome: "Evidência da decisão de viabilidade", tipo: "url", observacao: "Registro da decisão e das condições aceitas." },
    ],
  },
  {
    numero: "04", id: "lst_pp_04", nome: "04. Definição e aprovação do escopo",
    descricao: "Define e formaliza as entregas, os limites, as premissas e os critérios de aceite do projeto, estabelecendo a referência aprovada para especificação e controle de mudanças.",
    responsavelDaFase: "responsável de produto ou projeto",
    estados: [
      { id: "st_pp_04_a_definir", nome: "A definir", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Reunir briefing, parecer e condições aprovadas." },
      { id: "st_pp_04_em_elaboracao", nome: "Em elaboração", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Escrever entregas, exclusões, premissas e critérios de aceite." },
      { id: "st_pp_04_em_revisao_interna", nome: "Em revisão interna", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Conferir coerência com capacidade, receita, custos e compromissos." },
      { id: "st_pp_04_aguardando_aprovacao", nome: "Aguardando aprovação", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Submeter a versão do escopo ao aprovador." },
      { id: "st_pp_04_ajustes_solicitados", nome: "Ajustes solicitados", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Registrar mudanças e revisar a versão; se afetarem viabilidade, retornar à lista 03." },
      { id: "st_pp_04_escopo_aprovado", nome: "Escopo aprovado", categoria: "concluido", cor: "#10b981", oQueAcontece: "Registrar o aceite e congelar a referência aprovada." },
    ],
    campos: [
      { id: "fd_pp_documento_de_escopo", nome: "Documento de escopo", tipo: "url", observacao: "Fonte oficial do escopo do projeto." },
      { id: "fd_pp_versao_do_escopo", nome: "Versão do escopo", tipo: "text", observacao: "Identificador da versão submetida e aprovada." },
      { id: "fd_pp_entregas_previstas", nome: "Entregas previstas", tipo: "longText", observacao: "Resultados e componentes incluídos." },
      { id: "fd_pp_fora_do_escopo", nome: "Fora do escopo", tipo: "longText", observacao: "Exclusões explícitas para evitar expectativas indevidas." },
      { id: "fd_pp_premissas_e_obrigacoes_do_cliente", nome: "Premissas e obrigações do cliente", tipo: "longText", observacao: "Dados, materiais, acessos e decisões que dependem do cliente." },
      { id: "fd_pp_criterios_de_aceite_do_projeto", nome: "Critérios de aceite do projeto", tipo: "longText", observacao: "Condições verificáveis para aceitar a entrega global." },
      { id: "fd_pp_aprovador_do_escopo", nome: "Aprovador do escopo", tipo: "text", observacao: "Nome e papel de quem autoriza o escopo." },
      { id: "fd_pp_data_de_aprovacao_do_escopo", nome: "Data de aprovação do escopo", tipo: "date", observacao: "Data do aceite da versão." },
      { id: "fd_pp_evidencia_da_aprovacao_do_escopo", nome: "Evidência da aprovação do escopo", tipo: "url", observacao: "Registro de aprovação com referência à versão." },
    ],
  },
  {
    numero: "05", id: "lst_pp_05", nome: "05. Especificação das funcionalidades",
    descricao: "Detalha o comportamento esperado das funcionalidades, suas regras de negócio, permissões, requisitos não funcionais e critérios de aceite para orientar design, implementação e testes.",
    responsavelDaFase: "produto ou análise funcional",
    estados: [
      { id: "st_pp_05_a_especificar", nome: "A especificar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Identificar funcionalidades previstas no escopo." },
      { id: "st_pp_05_em_especificacao", nome: "Em especificação", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Documentar fluxos, regras, exceções e critérios por funcionalidade." },
      { id: "st_pp_05_aguardando_esclarecimentos", nome: "Aguardando esclarecimentos", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Resolver dúvidas com responsável e prazo registrados." },
      { id: "st_pp_05_em_revisao", nome: "Em revisão", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Revisar clareza e consistência com produto e equipe técnica." },
      { id: "st_pp_05_ajustes_solicitados", nome: "Ajustes solicitados", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Corrigir inconsistências ou lacunas antes de nova revisão." },
      { id: "st_pp_05_especificacao_aprovada", nome: "Especificação aprovada", categoria: "concluido", cor: "#10b981", oQueAcontece: "Registrar validação da versão funcional." },
    ],
    campos: [
      { id: "fd_pp_documento_de_especificacao", nome: "Documento de especificação", tipo: "url", observacao: "Fonte do detalhamento funcional." },
      { id: "fd_pp_versao_da_especificacao", nome: "Versão da especificação", tipo: "text", observacao: "Versão que será usada como referência." },
      { id: "fd_pp_regras_de_negocio", nome: "Regras de negócio", tipo: "longText", observacao: "Resumo das regras e referência às seções correspondentes no documento." },
      { id: "fd_pp_perfis_e_permissoes", nome: "Perfis e permissões", tipo: "longText", observacao: "Ações e acessos autorizados por perfil." },
      { id: "fd_pp_requisitos_nao_funcionais", nome: "Requisitos não funcionais", tipo: "longText", observacao: "Segurança, desempenho, acessibilidade, disponibilidade e outros requisitos com critérios verificáveis." },
      { id: "fd_pp_criterios_de_aceite_das_funcionalidades", nome: "Critérios de aceite das funcionalidades", tipo: "url", observacao: "Documento com condições de aceite por funcionalidade e referência ao escopo." },
      { id: "fd_pp_questoes_em_aberto", nome: "Questões em aberto", tipo: "longText", observacao: "Dúvidas, responsáveis e prazos para resposta." },
      { id: "fd_pp_revisor_funcional", nome: "Revisor funcional", tipo: "person", observacao: "Responsável interno pela revisão do comportamento esperado." },
      { id: "fd_pp_evidencia_da_aprovacao_da_especificacao", nome: "Evidência da aprovação da especificação", tipo: "url", observacao: "Registro de aprovação da versão." },
    ],
  },
  {
    numero: "06", id: "lst_pp_06", nome: "06. UX/UI e prototipação",
    descricao: "Transforma a especificação em fluxos, telas e protótipos, considerando os dispositivos previstos e os estados de interação necessários para validar a experiência antes do desenvolvimento.",
    responsavelDaFase: "design",
    estados: [
      { id: "st_pp_06_a_iniciar", nome: "A iniciar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Conferir especificação e referências visuais." },
      { id: "st_pp_06_em_desenho_de_fluxos", nome: "Em desenho de fluxos", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Estruturar jornadas, navegação e alternativas." },
      { id: "st_pp_06_em_criacao_de_telas", nome: "Em criação de telas", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Desenhar interfaces, componentes e estados." },
      { id: "st_pp_06_em_prototipacao", nome: "Em prototipação", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Conectar telas para demonstrar interações." },
      { id: "st_pp_06_em_revisao_interna", nome: "Em revisão interna", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Conferir cobertura funcional, usabilidade e viabilidade de implementação." },
      { id: "st_pp_06_ajustes_solicitados", nome: "Ajustes solicitados", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Corrigir pontos da revisão e reenviar." },
      { id: "st_pp_06_pronto_para_validacao", nome: "Pronto para validação", categoria: "concluido", cor: "#10b981", oQueAcontece: "Identificar a versão que será apresentada aos envolvidos." },
    ],
    campos: [
      { id: "fd_pp_responsavel_pelo_design", nome: "Responsável pelo design", tipo: "person", observacao: "Quem responde pelas interfaces e protótipo." },
      { id: "fd_pp_fluxos_de_navegacao", nome: "Fluxos de navegação", tipo: "url", observacao: "Jornadas e caminhos previstos." },
      { id: "fd_pp_arquivo_de_design", nome: "Arquivo de design", tipo: "url", observacao: "Fonte editável das telas e componentes." },
      { id: "fd_pp_prototipo_navegavel", nome: "Protótipo navegável", tipo: "url", observacao: "Versão interativa usada na validação." },
      { id: "fd_pp_versao_do_prototipo", nome: "Versão do protótipo", tipo: "text", observacao: "Identificação da versão apresentada." },
      { id: "fd_pp_dispositivos_contemplados", nome: "Dispositivos contemplados", tipo: "multiSelect", opcoes: ["Desktop", "Tablet", "Celular"], observacao: "Opções: Desktop; Tablet; Celular." },
      { id: "fd_pp_referencia_visual", nome: "Referência visual", tipo: "url", observacao: "Marca, biblioteca de componentes ou design system adotado." },
      { id: "fd_pp_pendencias_de_design", nome: "Pendências de design", tipo: "longText", observacao: "Itens abertos, responsáveis e prazos." },
      { id: "fd_pp_revisor_de_design", nome: "Revisor de design", tipo: "person", observacao: "Quem revisa a proposta internamente." },
      { id: "fd_pp_evidencia_da_revisao_de_design", nome: "Evidência da revisão de design", tipo: "url", observacao: "Registro da revisão e das decisões." },
    ],
  },
  {
    numero: "07", id: "lst_pp_07", nome: "07. Validação da solução",
    descricao: "Apresenta funcionalidades e protótipos aos envolvidos, registra feedbacks, resolve ajustes e formaliza a aprovação da solução que será planejada e desenvolvida.",
    responsavelDaFase: "produto, com apoio de design e área técnica",
    estados: [
      { id: "st_pp_07_a_agendar", nome: "A agendar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Definir participantes e agenda de validação." },
      { id: "st_pp_07_apresentacao_agendada", nome: "Apresentação agendada", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Confirmar horário e versão a apresentar." },
      { id: "st_pp_07_em_validacao", nome: "Em validação", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Apresentar cenários e recolher decisões e feedbacks." },
      { id: "st_pp_07_aguardando_retorno", nome: "Aguardando retorno", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Acompanhar decisão pendente com prazo combinado." },
      { id: "st_pp_07_ajustes_solicitados", nome: "Ajustes solicitados", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Classificar feedbacks como correções ou mudanças de escopo." },
      { id: "st_pp_07_em_ajustes", nome: "Em ajustes", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Executar ajustes dentro do escopo e voltar à validação." },
      { id: "st_pp_07_solucao_aprovada", nome: "Solução aprovada", categoria: "concluido", cor: "#10b981", oQueAcontece: "Registrar aceite da versão e eventuais exceções." },
    ],
    campos: [
      { id: "fd_pp_data_da_apresentacao", nome: "Data da apresentação", tipo: "dateTime", observacao: "Horário da validação." },
      { id: "fd_pp_participantes_da_validacao", nome: "Participantes da validação", tipo: "longText", observacao: "Nomes, papéis e contatos dos envolvidos." },
      { id: "fd_pp_versao_apresentada", nome: "Versão apresentada", tipo: "text", observacao: "Referência exata da solução avaliada." },
      { id: "fd_pp_registro_dos_feedbacks", nome: "Registro dos feedbacks", tipo: "url", observacao: "Comentários, decisões e encaminhamentos." },
      { id: "fd_pp_ajustes_obrigatorios", nome: "Ajustes obrigatórios", tipo: "longText", observacao: "Mudanças necessárias para aprovação, com responsável." },
      { id: "fd_pp_solicitacoes_fora_do_escopo", nome: "Solicitações fora do escopo", tipo: "longText", observacao: "Novos pedidos que precisam de avaliação antes de incorporação." },
      { id: "fd_pp_prazo_para_retorno_da_validacao", nome: "Prazo para retorno da validação", tipo: "date", observacao: "Data combinada para a decisão." },
      { id: "fd_pp_aprovador_da_solucao", nome: "Aprovador da solução", tipo: "text", observacao: "Quem tem autoridade para aprovar." },
      { id: "fd_pp_data_da_aprovacao_da_solucao", nome: "Data da aprovação da solução", tipo: "date", observacao: "Data do aceite." },
      { id: "fd_pp_evidencia_da_aprovacao_da_solucao", nome: "Evidência da aprovação da solução", tipo: "url", observacao: "Registro que identifica a versão aprovada." },
    ],
  },
  {
    numero: "08", id: "lst_pp_08", nome: "08. Planejamento técnico e das entregas",
    descricao: "Organiza a execução da solução aprovada, definindo arquitetura, tarefas, estimativas, capacidade, dependências, testes e sequência de entregas para estabelecer um plano executável.",
    responsavelDaFase: "liderança técnica e responsável pelo projeto",
    estados: [
      { id: "st_pp_08_a_planejar", nome: "A planejar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Conferir referências aprovadas e equipe disponível." },
      { id: "st_pp_08_em_definicao_tecnica", nome: "Em definição técnica", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Definir arquitetura, integrações e decisões de implementação." },
      { id: "st_pp_08_em_detalhamento_de_tarefas", nome: "Em detalhamento de tarefas", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Dividir funcionalidades em atividades executáveis e vinculadas." },
      { id: "st_pp_08_em_estimativa", nome: "Em estimativa", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Estimar esforço e revisar custos com a equipe." },
      { id: "st_pp_08_em_definicao_do_cronograma", nome: "Em definição do cronograma", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Conciliar prioridades, dependências e capacidade real." },
      { id: "st_pp_08_em_revisao", nome: "Em revisão", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Validar execução, compromissos e estratégia de testes." },
      { id: "st_pp_08_planejamento_aprovado", nome: "Planejamento aprovado", categoria: "concluido", cor: "#10b981", oQueAcontece: "Registrar plano e autorização para iniciar a execução." },
    ],
    campos: [
      { id: "fd_pp_plano_tecnico", nome: "Plano técnico", tipo: "url", observacao: "Arquitetura e decisões de implementação." },
      { id: "fd_pp_plano_de_entregas", nome: "Plano de entregas", tipo: "url", observacao: "Marcos, funcionalidades e sequência planejada." },
      { id: "fd_pp_equipe_envolvida", nome: "Equipe envolvida", tipo: "longText", observacao: "Profissionais previstos na execução. Nesta ferramenta o Campo de pessoa guarda uma pessoa só: liste aqui os nomes." },
      { id: "fd_pp_esforco_detalhado_em_horas", nome: "Esforço detalhado em horas", tipo: "number", observacao: "Estimativa consolidada após o detalhamento." },
      { id: "fd_pp_capacidade_alocada_em_horas_por_semana", nome: "Capacidade alocada em horas por semana", tipo: "number", observacao: "Disponibilidade efetiva da equipe para este projeto." },
      { id: "fd_pp_dependencias_criticas", nome: "Dependências críticas", tipo: "longText", observacao: "Condições, responsáveis e datas que afetam o plano." },
      { id: "fd_pp_previsao_de_publicacao", nome: "Previsão de publicação", tipo: "date", observacao: "Projeção atual de entrada em produção." },
      { id: "fd_pp_plano_de_testes", nome: "Plano de testes", tipo: "url", observacao: "Cenários, ambientes, responsáveis e critérios de aprovação." },
      { id: "fd_pp_aprovador_do_planejamento", nome: "Aprovador do planejamento", tipo: "person", observacao: "Responsável por validar recursos e compromissos." },
      { id: "fd_pp_evidencia_da_aprovacao_do_planejamento", nome: "Evidência da aprovação do planejamento", tipo: "url", observacao: "Registro do plano aprovado." },
    ],
  },
  {
    numero: "09", id: "lst_pp_09", nome: "09. Desenvolvimento",
    descricao: "Executa a implementação da solução planejada, acompanha impedimentos e revisões de código e prepara uma versão identificada para testes internos.",
    responsavelDaFase: "liderança técnica",
    estados: [
      { id: "st_pp_09_a_iniciar", nome: "A iniciar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Confirmar ambiente, acessos e tarefas prontas." },
      { id: "st_pp_09_em_desenvolvimento", nome: "Em desenvolvimento", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Implementar funcionalidades e verificações técnicas." },
      { id: "st_pp_09_em_revisao_de_codigo", nome: "Em revisão de código", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Revisar implementação, segurança, erros e aderência aos critérios." },
      { id: "st_pp_09_ajustes_solicitados", nome: "Ajustes solicitados", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Registrar problemas encontrados na revisão." },
      { id: "st_pp_09_em_ajustes", nome: "Em ajustes", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Corrigir os pontos e retornar à revisão." },
      { id: "st_pp_09_pronto_para_testes", nome: "Pronto para testes", categoria: "concluido", cor: "#10b981", oQueAcontece: "Disponibilizar versão revisada e identificada no ambiente de testes." },
    ],
    campos: [
      { id: "fd_pp_lider_tecnico", nome: "Líder técnico", tipo: "person", observacao: "Quem coordena a implementação." },
      { id: "fd_pp_versao_de_entrega", nome: "Versão de entrega", tipo: "text", observacao: "Identificador da versão em construção." },
      { id: "fd_pp_repositorio", nome: "Repositório", tipo: "url", observacao: "Local do código, sem credenciais no link." },
      { id: "fd_pp_registro_das_alteracoes_tecnicas", nome: "Registro das alterações técnicas", tipo: "url", observacao: "Página com PRs, alterações e referências da entrega." },
      { id: "fd_pp_ambiente_de_testes", nome: "Ambiente de testes", tipo: "url", observacao: "Endereço onde a versão será verificada." },
      { id: "fd_pp_evidencia_da_revisao_tecnica", nome: "Evidência da revisão técnica", tipo: "url", observacao: "Revisões e resultados das verificações técnicas." },
      { id: "fd_pp_pendencias_de_implementacao", nome: "Pendências de implementação", tipo: "longText", observacao: "Itens ainda não concluídos e encaminhamento de cada um." },
    ],
  },
  {
    numero: "10", id: "lst_pp_10", nome: "10. Testes e qualidade",
    descricao: "Verifica a entrega em relação aos requisitos e critérios de aceite, registra defeitos, acompanha correções e retestes e decide se a versão está pronta para homologação.",
    responsavelDaFase: "qualidade ou pessoa designada para testes",
    estados: [
      { id: "st_pp_10_a_testar", nome: "A testar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Conferir versão, ambiente, dados e roteiro." },
      { id: "st_pp_10_em_testes", nome: "Em testes", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Executar testes previstos e registrar evidências." },
      { id: "st_pp_10_falhas_identificadas", nome: "Falhas identificadas", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Registrar defeitos reproduzíveis e classificar severidade." },
      { id: "st_pp_10_em_correcao", nome: "Em correção", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Equipe técnica corrige falhas; manter os registros vinculados." },
      { id: "st_pp_10_em_reteste", nome: "Em reteste", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Confirmar correções e verificar regressões pertinentes." },
      { id: "st_pp_10_aprovado_para_homologacao", nome: "Aprovado para homologação", categoria: "concluido", cor: "#10b981", oQueAcontece: "Emitir parecer e registrar exceções aceitas." },
    ],
    campos: [
      { id: "fd_pp_responsavel_pela_qualidade", nome: "Responsável pela qualidade", tipo: "person", observacao: "Quem coordena a avaliação." },
      { id: "fd_pp_versao_em_teste", nome: "Versão em teste", tipo: "text", observacao: "Versão efetivamente testada." },
      { id: "fd_pp_execucao_dos_testes", nome: "Execução dos testes", tipo: "url", observacao: "Cenários, resultados, data e evidências." },
      { id: "fd_pp_falhas_identificadas", nome: "Falhas identificadas", tipo: "relation", observacao: "Vínculos com subtarefas de defeito; cada falha tem reprodução, esperado, observado e severidade. Nesta ferramenta o Campo guarda texto: cole o link da Tarefa, ou várias, uma por linha." },
      { id: "fd_pp_maior_severidade_em_aberto", nome: "Maior severidade em aberto", tipo: "singleSelect", opcoes: ["Nenhuma", "Baixa", "Média", "Alta", "Crítica"], observacao: "Opções: Nenhuma; Baixa; Média; Alta; Crítica. Reflete a falha aberta mais grave." },
      { id: "fd_pp_pendencias_aceitas_em_qualidade", nome: "Pendências aceitas em qualidade", tipo: "longText", observacao: "Falhas não bloqueadoras aceitas, seus efeitos, responsáveis e prazo de tratamento." },
      { id: "fd_pp_aprovador_das_excecoes_de_qualidade", nome: "Aprovador das exceções de qualidade", tipo: "person", observacao: "Quem autorizou seguir com pendências." },
      { id: "fd_pp_parecer_de_qualidade", nome: "Parecer de qualidade", tipo: "longText", observacao: "Resumo da cobertura, limitações e decisão de liberação." },
    ],
  },
  {
    numero: "11", id: "lst_pp_11", nome: "11. Homologação",
    descricao: "Disponibiliza a entrega ao cliente ou área solicitante para validar os cenários de negócio e os critérios de aceite, acompanhar ajustes e registrar a autorização para implantação.",
    responsavelDaFase: "responsável pelo projeto; validação executada pelo cliente ou área solicitante",
    estados: [
      { id: "st_pp_11_a_disponibilizar", nome: "A disponibilizar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Preparar ambiente, acessos e instruções para o cliente." },
      { id: "st_pp_11_aguardando_testes_do_cliente", nome: "Aguardando testes do cliente", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Cliente recebeu a entrega e ainda não iniciou a validação." },
      { id: "st_pp_11_em_homologacao", nome: "Em homologação", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Cliente executa cenários e informa resultados." },
      { id: "st_pp_11_ajustes_solicitados", nome: "Ajustes solicitados", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Separar defeitos de novos pedidos e registrar tratamento." },
      { id: "st_pp_11_em_ajustes", nome: "Em ajustes", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Corrigir itens acordados e executar testes internos das alterações." },
      { id: "st_pp_11_aguardando_revalidacao", nome: "Aguardando revalidação", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Entregar versão corrigida para nova conferência." },
      { id: "st_pp_11_homologado", nome: "Homologado", categoria: "concluido", cor: "#10b981", oQueAcontece: "Registrar aceite da versão e exceções." },
    ],
    campos: [
      { id: "fd_pp_responsavel_pela_homologacao_no_cliente", nome: "Responsável pela homologação no cliente", tipo: "text", observacao: "Nome e contato de quem coordena os testes de negócio." },
      { id: "fd_pp_ambiente_de_homologacao", nome: "Ambiente de homologação", tipo: "url", observacao: "Endereço da entrega para validação, sem credenciais." },
      { id: "fd_pp_versao_em_homologacao", nome: "Versão em homologação", tipo: "text", observacao: "Versão disponibilizada e, ao final, aceita." },
      { id: "fd_pp_roteiro_de_homologacao", nome: "Roteiro de homologação", tipo: "url", observacao: "Cenários de negócio ligados aos critérios de aceite." },
      { id: "fd_pp_prazo_de_homologacao", nome: "Prazo de homologação", tipo: "date", observacao: "Data combinada para retorno do cliente." },
      { id: "fd_pp_feedbacks_de_homologacao", nome: "Feedbacks de homologação", tipo: "url", observacao: "Registro dos testes, ocorrências e decisões." },
      { id: "fd_pp_pendencias_aceitas_na_homologacao", nome: "Pendências aceitas na homologação", tipo: "longText", observacao: "Exceções aceitas e encaminhamentos." },
      { id: "fd_pp_aprovador_do_aceite_de_homologacao", nome: "Aprovador do aceite de homologação", tipo: "text", observacao: "Pessoa autorizada a aceitar pelo cliente ou área solicitante." },
      { id: "fd_pp_data_do_aceite_de_homologacao", nome: "Data do aceite de homologação", tipo: "date", observacao: "Data da aprovação." },
      { id: "fd_pp_evidencia_do_aceite_de_homologacao", nome: "Evidência do aceite de homologação", tipo: "url", observacao: "Confirmação explícita referente à versão." },
    ],
  },
  {
    numero: "12", id: "lst_pp_12", nome: "12. Implantação",
    descricao: "Prepara e executa a publicação da versão homologada, incluindo ambiente, migração, comunicação, treinamento, reversão e verificação do funcionamento em produção.",
    responsavelDaFase: "responsável técnico pela implantação",
    estados: [
      { id: "st_pp_12_a_planejar", nome: "A planejar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Definir janela, responsáveis, comunicação e sequência." },
      { id: "st_pp_12_em_preparacao_do_ambiente", nome: "Em preparação do ambiente", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Configurar infraestrutura, permissões, monitoramento e dados." },
      { id: "st_pp_12_aguardando_liberacao", nome: "Aguardando liberação", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Obter autorização e conferir condições de publicação." },
      { id: "st_pp_12_implantacao_agendada", nome: "Implantação agendada", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Confirmar horário e avisar envolvidos." },
      { id: "st_pp_12_em_implantacao", nome: "Em implantação", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Executar publicação e migração conforme o plano." },
      { id: "st_pp_12_em_verificacao_de_producao", nome: "Em verificação de produção", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Validar funções essenciais, integrações e integridade dos dados." },
      { id: "st_pp_12_em_correcao_da_implantacao", nome: "Em correção da implantação", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Corrigir falha ou reverter; repetir preparação e autorização conforme necessário." },
      { id: "st_pp_12_implantado", nome: "Implantado", categoria: "concluido", cor: "#10b981", oQueAcontece: "Confirmar publicação bem-sucedida e iniciar acompanhamento." },
    ],
    campos: [
      { id: "fd_pp_responsavel_pela_implantacao", nome: "Responsável pela implantação", tipo: "person", observacao: "Quem conduz e coordena a publicação." },
      { id: "fd_pp_versao_a_publicar", nome: "Versão a publicar", tipo: "text", observacao: "Versão homologada autorizada para produção." },
      { id: "fd_pp_janela_de_implantacao", nome: "Janela de implantação", tipo: "dateTime", observacao: "Início autorizado; informar duração e limite no plano." },
      { id: "fd_pp_ambiente_de_producao", nome: "Ambiente de produção", tipo: "url", observacao: "Endereço da solução em produção." },
      { id: "fd_pp_plano_de_implantacao", nome: "Plano de implantação", tipo: "url", observacao: "Procedimento, responsáveis, comunicações e verificações." },
      { id: "fd_pp_necessita_migracao_de_dados", nome: "Necessita migração de dados?", tipo: "singleSelect", opcoes: ["Sim", "Não"], observacao: "Define se existe transferência ou alteração de dados a executar." },
      { id: "fd_pp_plano_de_migracao", nome: "Plano de migração", tipo: "url", observacao: "Procedimento, backup, validação e recuperação; obrigatório quando houver migração." },
      { id: "fd_pp_plano_de_reversao", nome: "Plano de reversão", tipo: "url", observacao: "Condições e procedimento para restaurar a operação anterior." },
      { id: "fd_pp_aprovador_da_publicacao", nome: "Aprovador da publicação", tipo: "person", observacao: "Quem autoriza executar, considerando aceite e condições técnicas." },
      { id: "fd_pp_evidencia_da_autorizacao_de_publicacao", nome: "Evidência da autorização de publicação", tipo: "url", observacao: "Registro explícito da autorização." },
      { id: "fd_pp_resultado_da_implantacao", nome: "Resultado da implantação", tipo: "singleSelect", opcoes: ["Publicada", "Revertida", "Parcial"], observacao: "Opções: Publicada; Revertida; Parcial. Apenas Publicada autoriza marcar Implantado." },
      { id: "fd_pp_evidencia_da_verificacao_em_producao", nome: "Evidência da verificação em produção", tipo: "url", observacao: "Resultados das verificações pós-publicação." },
      { id: "fd_pp_material_de_treinamento", nome: "Material de treinamento", tipo: "url", observacao: "Instruções ou treinamento necessário para os usuários." },
      { id: "fd_pp_comunicacao_e_treinamento_realizados", nome: "Comunicação e treinamento realizados", tipo: "longText", observacao: "Registra público informado, data e treinamento; justificar quando não aplicável." },
    ],
  },
  {
    numero: "13", id: "lst_pp_13", nome: "13. Operação assistida",
    descricao: "Acompanha o uso inicial em produção, monitora estabilidade e incidentes, verifica correções e prepara a transferência para a operação regular de suporte.",
    responsavelDaFase: "responsável pelo acompanhamento técnico e funcional",
    estados: [
      { id: "st_pp_13_a_iniciar", nome: "A iniciar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Confirmar período, responsáveis, indicadores e canais de atendimento." },
      { id: "st_pp_13_em_acompanhamento", nome: "Em acompanhamento", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Monitorar uso, disponibilidade, erros e retorno dos usuários." },
      { id: "st_pp_13_incidente_identificado", nome: "Incidente identificado", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Registrar ocorrência, impacto, severidade e responsável." },
      { id: "st_pp_13_em_correcao", nome: "Em correção", categoria: "emAndamento", cor: "#f97316", oQueAcontece: "Resolver incidente conforme procedimento de mudança e publicação." },
      { id: "st_pp_13_em_verificacao", nome: "Em verificação", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Confirmar resolução e estabilidade; voltar ao acompanhamento se ainda dentro do período." },
      { id: "st_pp_13_operacao_estabilizada", nome: "Operação estabilizada", categoria: "concluido", cor: "#10b981", oQueAcontece: "Confirmar critérios de estabilização e encaminhar pendências não bloqueadoras." },
    ],
    campos: [
      { id: "fd_pp_responsavel_pelo_acompanhamento", nome: "Responsável pelo acompanhamento", tipo: "person", observacao: "Quem coordena o período assistido." },
      { id: "fd_pp_inicio_da_operacao_assistida", nome: "Início da operação assistida", tipo: "date", observacao: "Primeiro dia do acompanhamento." },
      { id: "fd_pp_fim_previsto_da_operacao_assistida", nome: "Fim previsto da operação assistida", tipo: "date", observacao: "Data prevista, ajustada por decisão explícita se necessário." },
      { id: "fd_pp_monitoramento", nome: "Monitoramento", tipo: "url", observacao: "Painéis, alertas e registros usados na avaliação." },
      { id: "fd_pp_incidentes_vinculados", nome: "Incidentes vinculados", tipo: "relation", observacao: "Subtarefas ou registros das ocorrências, com severidade, impacto e solução. Nesta ferramenta o Campo guarda texto: cole o link da Tarefa, ou várias, uma por linha." },
      { id: "fd_pp_criterios_de_estabilizacao", nome: "Critérios de estabilização", tipo: "longText", observacao: "Condições objetivas, incluindo período de observação e limites aceitáveis de falha." },
      { id: "fd_pp_resultado_observado", nome: "Resultado observado", tipo: "longText", observacao: "Estabilidade e resultados iniciais, sem atribuir ganhos ainda não medidos." },
      { id: "fd_pp_pendencias_para_suporte", nome: "Pendências para suporte", tipo: "longText", observacao: "Itens não bloqueadores, com responsáveis e tratamento acordado." },
      { id: "fd_pp_evidencia_da_estabilizacao", nome: "Evidência da estabilização", tipo: "url", observacao: "Registro que demonstra o atendimento aos critérios." },
    ],
  },
  {
    numero: "14", id: "lst_pp_14", nome: "14. Encerramento e transição para manutenção",
    descricao: "Formaliza a conclusão do projeto, consolida documentação e resultados, registra o aceite final e transfere responsabilidades, condições de manutenção e pendências para o suporte.",
    responsavelDaFase: "responsável pelo projeto",
    estados: [
      { id: "st_pp_14_a_encerrar", nome: "A encerrar", categoria: "naoIniciado", cor: "#94a3b8", oQueAcontece: "Conferir entregas, aceites, obrigações e pendências." },
      { id: "st_pp_14_em_documentacao_final", nome: "Em documentação final", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Consolidar documentação técnica, operacional e de uso." },
      { id: "st_pp_14_em_transferencia_para_suporte", nome: "Em transferência para suporte", categoria: "emAndamento", cor: "#3b82f6", oQueAcontece: "Transferir conhecimento, contatos e responsabilidades; confirmar recebimento." },
      { id: "st_pp_14_aguardando_aceite_final", nome: "Aguardando aceite final", categoria: "emAndamento", cor: "#eab308", oQueAcontece: "Solicitar confirmação formal de encerramento." },
      { id: "st_pp_14_encerrado", nome: "Encerrado", categoria: "fechado", cor: "#10b981", oQueAcontece: "Registrar aceite, data e destino das pendências; preservar histórico." },
    ],
    campos: [
      { id: "fd_pp_documentacao_final", nome: "Documentação final", tipo: "url", observacao: "Referência consolidada de uso, operação e documentação técnica." },
      { id: "fd_pp_responsavel_pelo_suporte", nome: "Responsável pelo suporte", tipo: "person", observacao: "Quem assume o atendimento após a entrega." },
      { id: "fd_pp_registro_da_transferencia_para_suporte", nome: "Registro da transferência para suporte", tipo: "url", observacao: "Confirmação de recebimento, treinamento e responsabilidades." },
      { id: "fd_pp_condicoes_de_manutencao_e_garantia", nome: "Condições de manutenção e garantia", tipo: "longText", observacao: "Cobertura, prazos, exclusões e referência ao contrato vigente." },
      { id: "fd_pp_pendencias_aceitas_no_encerramento", nome: "Pendências aceitas no encerramento", tipo: "longText", observacao: "Cada item deve ter destino, responsável, prazo ou condição de tratamento." },
      { id: "fd_pp_custo_realizado_do_projeto", nome: "Custo realizado do projeto", tipo: "currency", observacao: "Custo efetivamente apurado; informar a fonte no registro financeiro." },
      { id: "fd_pp_resultado_comercial_confirmado", nome: "Resultado comercial confirmado", tipo: "url", observacao: "Fonte de contratação e faturamento; distinguir contratado, faturado e recebido." },
      { id: "fd_pp_avaliacao_dos_criterios_de_sucesso", nome: "Avaliação dos critérios de sucesso", tipo: "longText", observacao: "Resultado comparado aos critérios do briefing; indicar o que ainda exige medição futura." },
      { id: "fd_pp_aprovador_do_encerramento", nome: "Aprovador do encerramento", tipo: "text", observacao: "Quem está autorizado a confirmar o término." },
      { id: "fd_pp_aceite_final", nome: "Aceite final", tipo: "url", observacao: "Evidência explícita de encerramento e eventuais ressalvas." },
      { id: "fd_pp_data_do_encerramento", nome: "Data do encerramento", tipo: "date", observacao: "Data da conclusão formal." },
      { id: "fd_pp_aprendizados", nome: "Aprendizados", tipo: "longText", observacao: "Decisões, dificuldades e orientações úteis para projetos futuros." },
    ],
  },
];
