/**
 * Os tipos do gesto misto de `POST /operacoes/:nome` (Fase 14, 3.2.8 e 3.3.7;
 * generalizados na Fase 15, UCR-01): operações que conferem algo contra as
 * tabelas do CRM ANTES de decidir (`LeituraDoCrm`) e/ou que gravam nelas no
 * MESMO commit da gravação em `plataforma.registros` (`AoConfirmarNoCrm`).
 *
 * `executar()` (`../../persistencia/unidade-de-trabalho.ts`) é quem entrega o
 * que a leitura devolveu: ao callback da operação (1º argumento) e a
 * `aoConfirmar` (4º). Estes tipos só dizem a FORMA do que a rota compõe.
 *
 * `ContatoResumido`, `EmpresaResumida` e `ContatoACriar` são formas
 * estruturais declaradas aqui: o domínio declara as mesmas formas onde precisa
 * delas, sem import da api (regra de camada: o domínio não conhece ninguém).
 */

import type { DataState } from "@n1/dominio";
import type { Canal } from "@n1/dominio/crm/canais";
import type { Funil } from "@n1/dominio/crm/funis";
import type { NomeDeOperacao } from "@n1/dominio/operations/registro";
import type { PoolClient } from "pg";
import type { MembroDaSessao } from "../../plugins/autenticacao";

/** Um Contato como a operação o enxerga: o bastante para achar por Identificador e saber se ainda vale. */
export interface ContatoResumido {
  readonly id: string;
  readonly nome: string;
  readonly estado: string;
  /** O Identificador `whatsapp` do Contato, quando tem. */
  readonly whatsapp: string | null;
}

/** Uma Empresa como a operação a enxerga. */
export interface EmpresaResumida {
  readonly id: string;
  readonly nome: string;
  readonly estado: string;
}

/** Um Contato que a operação decidiu criar: o id é gerado na leitura, o `aoConfirmar` faz o INSERT. */
export interface ContatoACriar {
  readonly id: string;
  readonly nome: string;
  readonly whatsapp: string;
}

/**
 * O que uma leitura do CRM devolve. Cada leitura preenche só o que a operação
 * precisa; `argumento(lido)` de `LeituraDoCrm` diz o que ocupa a posição dos
 * `args`.
 */
export interface LidoDoCrm {
  readonly canais?: readonly Canal[];
  readonly funis?: readonly Funil[];
  readonly contatos?: readonly ContatoResumido[];
  readonly empresas?: readonly EmpresaResumida[];
  /** id → nome de exibição, para as âncoras da IA. */
  readonly nomes?: Readonly<Record<string, string>>;
  readonly contatosACriar?: readonly ContatoACriar[];
}

/**
 * Uma leitura do CRM de uma operação. `ler` roda no MESMO `cliente` de
 * `executar()`, depois da trava do Espaço e da hidratação (`lerDoCrm`);
 * `args` são os já validados pelo schema, `state` o já hidratado. O que o
 * navegador mandou na posição `posicao` é DESCARTADO: a rota a sobrescreve com
 * `argumento(lido)`, o que o servidor leu (Pitfall 12, T-14-29 / T-15-01).
 *
 * `argumento` existe porque as operações esperam formas diferentes na
 * posição: `createList` e `definirCanaisDaLista` esperam `Canal[]`, as
 * Ferramentas esperam o objeto inteiro.
 */
export interface LeituraDoCrm {
  /** O índice em `args` que recebe o que o servidor leu. */
  readonly posicao: number;
  /**
   * `membro` é o Membro da sessão: a leitura que revela dado do CRM (o nome de uma Âncora da
   * IA) confere `podeNoCrm(..., "ler", ...)` com ele ANTES de ler. As leituras que não precisam
   * dele o ignoram.
   */
  ler(cliente: PoolClient, workspaceId: string, args: readonly unknown[], state: DataState, membro: MembroDaSessao): Promise<LidoDoCrm>;
  argumento(lido: LidoDoCrm): unknown;
}

/**
 * Roda depois do `ok` do domínio e antes do `commit`, no mesmo cliente: uma
 * recusa nunca a dispara e uma exceção desfaz tudo. `lido` é o que a leitura
 * do CRM da mesma operação devolveu (`undefined` quando a operação não tem
 * leitura).
 */
export type AoConfirmarNoCrm = (
  cliente: PoolClient,
  args: readonly unknown[],
  membro: MembroDaSessao,
  state: DataState,
  lido: LidoDoCrm | undefined,
) => Promise<void>;

export type TabelaDeLeituras = Partial<Record<NomeDeOperacao, LeituraDoCrm>>;
export type TabelaDeConfirmacoes = Partial<Record<NomeDeOperacao, AoConfirmarNoCrm>>;
