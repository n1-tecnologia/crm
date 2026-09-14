/** As seções de Personalizar, na ordem do submenu. */

export type SecaoId = "agente" | "habilidades" | "automacao" | "conhecimento" | "conectores" | "plugins";

export interface Secao {
  readonly id: SecaoId;
  readonly rotulo: string;
  readonly descricao: string;
}

export const SECOES: readonly Secao[] = [
  { id: "agente", rotulo: "Agente", descricao: "Construa e publique os Agentes do Espaço de Trabalho." },
  { id: "habilidades", rotulo: "Habilidades", descricao: "O que os Agentes sabem fazer, e a quem cada Habilidade foi concedida." },
  { id: "automacao", rotulo: "Automação", descricao: "Gatilhos, condições e ações que rodam sem ninguém pedir." },
  { id: "conhecimento", rotulo: "Conhecimento", descricao: "Coleções e documentos que os Agentes consultam." },
  { id: "conectores", rotulo: "Conectores", descricao: "As Integrações ligadas ao Espaço de Trabalho e o que cada uma expõe." },
  { id: "plugins", rotulo: "Plugins", descricao: "O Catálogo de Ferramentas que um Agente pode receber." },
];

export const isSecao = (valor: string): valor is SecaoId => SECOES.some((s) => s.id === valor);
