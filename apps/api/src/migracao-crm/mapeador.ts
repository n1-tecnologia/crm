/**
 * O mapeador de entidades (15-28, UCR-09): as linhas do CRM antigo viram as linhas das tabelas novas.
 *
 * Função PURA: `planejarMigracao` recebe as linhas antigas (como estão em `plataforma.registros`) e o que
 * o CRM novo do Espaço já tem, e devolve as linhas a inserir (com os nomes das colunas), o de-para e o
 * relatório de não migrados. Nada aqui toca em banco.
 */

import { randomUUID } from "node:crypto";
import type { RegistroAntigo } from "./formatos-antigos";
import type { NaoMigrado } from "./nao-migrados";

export interface LinhaDeContato {
  readonly id: string;
  readonly nome: string | null;
  readonly sobrenome: string | null;
  readonly data_nascimento: string | null;
  readonly idioma: string | null;
  readonly fuso_horario: string | null;
  readonly descricao: string | null;
  readonly enderecos: readonly unknown[];
  readonly campos_adicionais: Readonly<Record<string, unknown>>;
  readonly origem: string | null;
  readonly qualificacao: string | null;
  readonly modo_criacao: string;
  readonly estado: string;
  readonly mesclado_em_id: string | null;
  readonly mesclado_em: string | null;
  readonly proprietario_id: string;
  readonly criado_por: string;
  readonly criado_em: string | null;
}

export interface LinhaDeIdentificadorDeContato {
  readonly id: string;
  readonly contato_id: string;
  readonly tipo: string;
  readonly valor: string;
  readonly valor_exibido: string | null;
  readonly rotulo_canal: string | null;
  readonly verificado: boolean;
  readonly principal: boolean;
  readonly criado_em: string | null;
}

/** Uma linha de `crm_de_para`: o livro-razão do que foi migrado. */
export interface DeParaParaInserir {
  readonly colecao_antiga: string;
  readonly id_antigo: string;
  readonly tabela_nova: string;
  readonly id_novo: string;
}

export interface LinhasPorTabela {
  /** Sobreviventes antes dos mesclados: a FK `contatos_mesclado_em_fk` não é adiável. */
  readonly contatos: LinhaDeContato[];
  readonly contato_identificadores: LinhaDeIdentificadorDeContato[];
}

export interface PlanoDeMigracao {
  readonly linhasPorTabela: LinhasPorTabela;
  readonly deParas: DeParaParaInserir[];
  readonly naoMigrados: NaoMigrado[];
}

/** O que o CRM novo do Espaço já tem e o mapeador não pode repetir (colisões de unicidade e de id). */
export interface CrmNovoDoEspaco {
  readonly identificadoresDeContato: ReadonlySet<string>;
  readonly idsDeContato: ReadonlySet<string>;
}

/** A chave de unicidade do Identificador de Contato no Espaço (`contato_identificadores_unico`). */
export function chaveDeIdentificadorDeContato(tipo: string, valor: string): string {
  return `${tipo}\u0000${valor}`;
}

export const CRM_NOVO_VAZIO: CrmNovoDoEspaco = { identificadoresDeContato: new Set(), idsDeContato: new Set() };

export interface OpcoesDoMapeador {
  /** Gera o id novo de Identificador e de vínculo (UUID por padrão; os testes passam um contador). */
  readonly gerarId?: () => string;
}

export function planejarMigracao(
  _linhasAntigas: readonly RegistroAntigo[],
  _crmNovo: CrmNovoDoEspaco = CRM_NOVO_VAZIO,
  _opcoes: OpcoesDoMapeador = {},
): PlanoDeMigracao {
  void randomUUID;
  return { linhasPorTabela: { contatos: [], contato_identificadores: [] }, deParas: [], naoMigrados: [] };
}
