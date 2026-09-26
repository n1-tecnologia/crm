/** As seções de Personalizar, na ordem do submenu. */

export type SecaoId = "agente" | "habilidades" | "automacao" | "conhecimento" | "conectores" | "plugins";

export interface Secao {
  readonly id: SecaoId;
  readonly rotulo: string;
  readonly descricao: string;
}

export const SECOES: readonly Secao[] = [
  { id: "agente", rotulo: "Agentes", descricao: "Os Agentes do Espaço de Trabalho; crie um novo no Construtor." },
  { id: "habilidades", rotulo: "Habilidades", descricao: "O que os Agentes sabem fazer, e a quem cada Habilidade foi concedida." },
  { id: "automacao", rotulo: "Automação", descricao: "Gatilhos, condições e ações que rodam sem ninguém pedir." },
  { id: "conhecimento", rotulo: "Conhecimento", descricao: "Coleções e documentos que os Agentes consultam." },
  // D3 — "conector" é sinônimo proibido (GLOSSARIO); o slug `conectores` fica, o rótulo fala "Integrações".
  { id: "conectores", rotulo: "Integrações", descricao: "As Integrações do Espaço de Trabalho e as Ferramentas que cada uma expõe." },
  // D3 — "Plugins" é vocabulário de produto para o Catálogo de Ferramentas; cada cartão carrega a Pilula "Ferramenta".
  { id: "plugins", rotulo: "Plugins", descricao: "O Catálogo de Ferramentas — o que um Agente pode receber para agir." },
];

export const isSecao = (valor: string): valor is SecaoId => SECOES.some((s) => s.id === valor);
