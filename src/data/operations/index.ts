export * from "./activity";
export * from "./tasks";
export * from "./deals";
export * from "./conversations";
export * from "./contacts";
export * from "./ai";
export * from "./chat-folders";
export * from "./agent-builder";
export * from "./configuration";
export * from "./collaboration";
export * from "./planning";
export * from "./scale";
export * from "./automations";
export * from "./financeiro";
export * from "./members";
export * from "./structure";
export * from "./iniciar-conversa";
export * from "./tarefas-conversacionais";
export * from "./canais";
export * from "./ferramentas";
export * from "./ia";
// `recusaDeMembroAtivo` existe nas duas vozes (Ferramentas do Canal e IA): o
// barril mantém a do Canal, que a tela de Ferramentas já importa, e expõe a da
// IA com sufixo. Dentro de `operations/ia/`, os módulos importam a própria.
export { recusaDeMembroAtivo } from "./ferramentas";
export { recusaDeMembroAtivo as recusaDeMembroAtivoNaIa } from "./ia/permissoes-ia";
