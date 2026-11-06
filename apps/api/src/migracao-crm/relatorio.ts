/**
 * O texto que o script imprime: o relatório do `--seco` e o resumo de cada escrita.
 *
 * Funções puras sobre estruturas que SÓ têm ids, contagens e nomes de configuração (Funil, Etapa, Lista,
 * Pasta). Nada daqui lê um registro inteiro: nome de pessoa, telefone, e-mail e texto de Mensagem não têm
 * como chegar ao texto (T-15-67), e o teste passa campos pessoais na entrada para provar que continuam de
 * fora.
 */

import { COLECAO_DE_CONVERSAS } from "./colecoes";
import { agruparNaoMigrados, type NaoMigrado } from "./nao-migrados";

export interface ContagemPorColecao {
  readonly colecao: string;
  readonly linhas: number;
}

export interface EtapaDoRelatorio {
  readonly nome: string;
  readonly ordem: number;
  readonly probabilidade: number;
}

export interface FunilDoRelatorio {
  readonly id: string;
  readonly nome: string;
  readonly estado: string;
  readonly privado: boolean;
  readonly etapas: readonly EtapaDoRelatorio[];
  /** Quantas linhas de cada coleção citam o id do Funil (Automações, Agentes, Painéis, concessões). */
  readonly referencias: readonly { readonly colecao: string; readonly quantidade: number }[];
  /** O que `--funil=migrar` faria com ele. */
  readonly destino: { readonly tipo: "migra"; readonly padrao: boolean } | { readonly tipo: "nao-migra"; readonly motivo: string };
}

export interface ListaDoRelatorio {
  readonly id: string;
  readonly nome: string;
  readonly tarefas: number;
}

export interface PastaDoRelatorio {
  readonly existe: boolean;
  readonly nome: string | undefined;
  readonly listas: readonly ListaDoRelatorio[];
  readonly removivel: boolean;
}

export interface EntradaDoRelatorio {
  readonly espaco: string;
  /** As nove coleções em `plataforma.registros` agora (com zero também). */
  readonly noRegistros: readonly ContagemPorColecao[];
  readonly conversasDeGrupo: number;
  readonly jaGuardadas: readonly ContagemPorColecao[];
  readonly funis: readonly FunilDoRelatorio[];
  readonly funisNoCrmNovo: { readonly total: number; readonly temPadrao: boolean };
  readonly pasta: PastaDoRelatorio;
  /** O que o mapeador levaria às tabelas novas e o que deixaria de fora (15-28). Ausente = o relatório não o mostra. */
  readonly entidades?: EntidadesDoRelatorio;
}

/** O que o mapeador de entidades prevê (`--seco`) ou fez (`--migrar`): contagens por tabela e o que ficou de fora. */
export interface EntidadesDoRelatorio {
  readonly porTabela: Readonly<Record<string, number>>;
  readonly naoMigrados: readonly NaoMigrado[];
}

function alinhar(nome: string, largura: number): string {
  return nome.length >= largura ? `${nome} ` : nome.padEnd(largura);
}

function pluralizar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** As linhas sobre a Pasta "Meus negócios" (as mesmas no `--seco` e no resumo de uma escrita). */
export function linhasDaPasta(pasta: PastaDoRelatorio, quandoSai: "vai" | "saiu" = "vai"): string[] {
  if (!pasta.existe) return ['Pasta "Meus negócios": este Espaço não tem.'];
  const nome = pasta.nome ?? "Meus negócios";
  const listas = pasta.listas.map((l) => `    ${l.nome} (${l.id}): ${pluralizar(l.tarefas, "Tarefa", "Tarefas")}`);
  if (pasta.removivel) {
    const verbo = quandoSai === "vai" ? "sai (vai para a cópia e é removida de registros)" : "saiu (copiada para registros_crm_antigo e removida de registros)";
    return [`Pasta "${nome}": todas as ${pasta.listas.length} Lista(s) estão vazias, então a Pasta ${verbo}, com as Listas e as Visualizações delas.`, ...listas];
  }
  return [
    `Pasta "${nome}": há Tarefa em ${pasta.listas.filter((l) => l.tarefas > 0).length} Lista(s). Nada da Pasta sai: nem a Pasta, nem as Listas, nem as Visualizações.`,
    "  Lista e Tarefas (qualquer estado):",
    ...listas,
    "  O dono decide o que fazer com elas; o script não toca nas Tarefas.",
  ];
}

/** Quantos ids de uma categoria o texto lista; o resto vira "e mais N" (a lista completa é a de `naoMigrados`). */
const IDS_POR_CATEGORIA = 20;

/**
 * A seção das tabelas novas e dos não migrados (15-28): contagens e ids, nada de dado pessoal. Cada item é só
 * uma coleção antiga e um id; o que ficou de fora continua em `registros_crm_antigo`.
 */
export function linhasDasEntidades(entidades: EntidadesDoRelatorio): string[] {
  const linhas: string[] = [];
  const tabelas = Object.entries(entidades.porTabela).filter(([, n]) => n > 0);
  const largura = Math.max(...tabelas.map(([nome]) => nome.length), 10) + 2;
  linhas.push("Linhas nas tabelas novas do CRM:");
  if (tabelas.length === 0) linhas.push("  nenhuma");
  for (const [tabela, n] of tabelas) linhas.push(`  ${alinhar(tabela, largura)}${n}`);

  const grupos = agruparNaoMigrados(entidades.naoMigrados);
  if (grupos.length === 0) {
    linhas.push("Não migrados: nenhum item.");
    return linhas;
  }
  const total = grupos.reduce((soma, g) => soma + g.ids.length, 0);
  linhas.push(`Não migrados (continuam só em registros_crm_antigo): ${pluralizar(total, "item", "itens")} em ${pluralizar(grupos.length, "categoria", "categorias")}.`);
  for (const grupo of grupos) {
    const mostrados = grupo.ids.slice(0, IDS_POR_CATEGORIA).join(", ");
    const resto = grupo.ids.length - IDS_POR_CATEGORIA;
    linhas.push(`  ${grupo.rotulo}: ${grupo.ids.length}`);
    linhas.push(`    ${mostrados}${resto > 0 ? `, e mais ${resto}` : ""}`);
  }
  return linhas;
}

function somar(contagens: readonly ContagemPorColecao[], contar: (c: ContagemPorColecao) => number): number {
  return contagens.reduce((total, c) => total + contar(c), 0);
}

/** Quantas linhas saem de `registros` num `--guardar`: as oito coleções e as Conversas sem Grupo. */
function linhasQueSaem(entrada: EntradaDoRelatorio): number {
  return somar(entrada.noRegistros, (c) => (c.colecao === COLECAO_DE_CONVERSAS ? c.linhas - entrada.conversasDeGrupo : c.linhas));
}

/** O que `--migrar` recusaria: registros do CRM antigo que não são Funil nem Grupo. */
function linhasAlemDoFunil(entrada: EntradaDoRelatorio): number {
  return somar(entrada.noRegistros, (c) =>
    c.colecao === "funnels" ? 0 : c.colecao === COLECAO_DE_CONVERSAS ? c.linhas - entrada.conversasDeGrupo : c.linhas,
  );
}

function linhasDoFunil(funil: FunilDoRelatorio): string[] {
  const etapas = [...funil.etapas].sort((a, b) => a.ordem - b.ordem).map((e) => `${e.ordem}. ${e.nome} (${e.probabilidade}%)`);
  const referencias = funil.referencias.length > 0 ? funil.referencias.map((r) => `${r.colecao} ${r.quantidade}`).join(", ") : "nada";
  const destino =
    funil.destino.tipo === "migra"
      ? funil.destino.padrao
        ? "migra como Funil padrão do Espaço"
        : "migra (não como padrão)"
      : `NÃO migra (${funil.destino.motivo})`;
  return [
    `  ${funil.id} "${funil.nome}" · ${funil.estado}${funil.privado ? " · privado" : ""}`,
    `    Etapas: ${etapas.length > 0 ? etapas.join(" · ") : "nenhuma"}`,
    `    Apontam para ele (fora das nove coleções): ${referencias}`,
    `    --funil=migrar: ${destino}`,
  ];
}

/** O relatório do `--seco`: o que há, o que migrar e guardar fariam, e onde o dono decide. Nada foi escrito para gerá-lo. */
export function montarRelatorio(entrada: EntradaDoRelatorio): string {
  const larguraDaColecao = Math.max(...entrada.noRegistros.map((c) => c.colecao.length), 10) + 2;
  const linhas: string[] = [];
  linhas.push(`Espaço ${entrada.espaco} · relatório a seco. Nada foi escrito: a sessão é só de leitura.`);
  linhas.push("");
  linhas.push("CRM antigo em plataforma.registros (o que o corte tira):");
  for (const c of entrada.noRegistros) {
    const nota = c.colecao === COLECAO_DE_CONVERSAS && entrada.conversasDeGrupo > 0 ? `   (${entrada.conversasDeGrupo} de Grupo: ficam em registros, F14-D-05)` : "";
    linhas.push(`  ${alinhar(c.colecao, larguraDaColecao)}${c.linhas}${nota}`);
  }
  linhas.push("");
  if (entrada.jaGuardadas.length > 0) {
    linhas.push("Já guardado em plataforma.registros_crm_antigo:");
    for (const c of entrada.jaGuardadas) linhas.push(`  ${alinhar(c.colecao, larguraDaColecao)}${c.linhas}`);
  } else {
    linhas.push("Nada guardado ainda em plataforma.registros_crm_antigo.");
  }
  linhas.push("");

  linhas.push(`Funis do CRM antigo: ${entrada.funis.length}`);
  for (const funil of entrada.funis) linhas.push(...linhasDoFunil(funil));
  linhas.push(
    `Funis que o Espaço já tem no CRM novo: ${entrada.funisNoCrmNovo.total}${entrada.funisNoCrmNovo.total > 0 ? ` (${entrada.funisNoCrmNovo.temPadrao ? "com" : "sem"} Funil padrão)` : ""}`,
  );
  linhas.push("");
  linhas.push(...linhasDaPasta(entrada.pasta));
  linhas.push("");
  if (entrada.entidades) {
    linhas.push(...linhasDasEntidades(entrada.entidades));
    linhas.push("");
  }

  const saem = linhasQueSaem(entrada);
  const alem = linhasAlemDoFunil(entrada);
  linhas.push("O que cada modo faria neste Espaço:");
  linhas.push(
    `  --guardar                    copia as nove coleções para registros_crm_antigo (Grupo inclusive) e apaga ${saem} linha(s) de registros; ${entrada.conversasDeGrupo} Conversa(s) de Grupo ficam. Não cria nada no CRM novo.`,
  );
  if (alem > 0) {
    linhas.push(`  --migrar --funil=migrar      recusa: este Espaço tem ${alem} registro(s) do CRM antigo além do Funil; use --guardar.`);
    linhas.push(`  --migrar --funil=guardar     recusa, pelo mesmo motivo.`);
  } else {
    const migram = entrada.funis.filter((f) => f.destino.tipo === "migra").length;
    linhas.push(`  --migrar --funil=migrar      guarda como o --guardar e insere ${pluralizar(migram, "Funil", "Funis")} (com as Etapas) no CRM novo.`);
    linhas.push(`  --migrar --funil=guardar     guarda como o --guardar e deixa o Espaço sem Funil no CRM novo.`);
    if (entrada.funis.length > 0) linhas.push("  Com Funil antigo, o --migrar exige --funil=migrar ou --funil=guardar.");
  }
  return linhas.join("\n");
}

// --- o resumo de uma escrita ---

export interface EntradaDoResumo {
  readonly espaco: string;
  readonly modo: "guardar" | "migrar";
  readonly nadaAFazer: boolean;
  readonly copiadas: number;
  readonly apagadas: Readonly<Record<string, number>>;
  readonly conversasDeGrupo: number;
  readonly funis: { readonly migrados: number; readonly etapas: number; readonly naoMigrados: readonly { readonly id: string; readonly nome: string; readonly motivo: string }[] };
  readonly pasta: PastaDoRelatorio;
  readonly entidades?: EntidadesDoRelatorio;
}

function textoDasContagens(porColecao: Readonly<Record<string, number>>): string {
  const partes = Object.entries(porColecao).map(([colecao, n]) => `${colecao} ${n}`);
  return partes.length > 0 ? partes.join(", ") : "nenhuma";
}

/** O que uma escrita (ou a tentativa que não tinha o que escrever) imprime. */
export function montarResumoDeEscrita(entrada: EntradaDoResumo): string {
  const linhas: string[] = [];
  if (entrada.nadaAFazer) {
    linhas.push(`Espaço ${entrada.espaco}: nada a fazer. O CRM antigo já está guardado e não há linha dele para apagar em registros.`);
  } else {
    linhas.push(
      `Espaço ${entrada.espaco}: ${entrada.modo === "migrar" ? "migrado" : "guardado"}. ${entrada.copiadas} linha(s) copiadas para registros_crm_antigo; apagadas de registros: ${textoDasContagens(entrada.apagadas)}.`,
    );
    linhas.push(`${entrada.conversasDeGrupo} Conversa(s) de Grupo continuam em registros (${COLECAO_DE_CONVERSAS}, F14-D-05).`);
  }
  if (entrada.modo === "migrar" || entrada.funis.naoMigrados.length > 0) {
    if (entrada.funis.migrados > 0) linhas.push(`Funil: ${pluralizar(entrada.funis.migrados, "migrado", "migrados")} (${pluralizar(entrada.funis.etapas, "Etapa", "Etapas")}).`);
    for (const f of entrada.funis.naoMigrados) linhas.push(`Funil NÃO migrado: ${f.id} "${f.nome}" (${f.motivo}). Ficou só na cópia.`);
  }
  if (entrada.pasta.existe) linhas.push(...linhasDaPasta(entrada.pasta, "saiu"));
  if (entrada.entidades) linhas.push(...linhasDasEntidades(entrada.entidades));
  return linhas.join("\n");
}
