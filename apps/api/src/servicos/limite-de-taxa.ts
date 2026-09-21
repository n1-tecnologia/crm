/**
 * Limite de taxa por janela deslizante, em memória — a defesa contra abuso
 * das rotas públicas do Formulário (`../rotas/formularios-publicos.ts`,
 * Plan 02-16, T-02-03/Denial of Service).
 *
 * Uma implementação em memória é suficiente NESTA fase: `apps/api` roda como
 * processo único atrás do nginx (D-15), e o nginx já impõe o próprio limite
 * na borda (Plan 02-15). O dia em que `apps/api` ganhar uma segunda
 * instância, este contador deixa de valer (cada processo teria a própria
 * janela) — a migração é para uma tabela (`plataforma`) ou Redis
 * compartilhado, não uma reescrita da interface: `consumir(chave)` continua
 * fazendo sentido, só a estrutura por trás muda.
 *
 * `chave` é fornecida por quem chama `consumir` — a rota decide o que conta
 * como uma "fonte": IP, segredo do Formulário, ou a combinação dos dois.
 */

export interface OpcoesDeLimiteDeTaxa {
  /** Duração da janela deslizante, em milissegundos. */
  readonly janelaMs: number;
  /** Quantas chamadas uma mesma chave pode consumir dentro da janela. */
  readonly maximo: number;
  /** Padrão: `Date.now`. Testes injetam um relógio determinístico. */
  readonly relogio?: () => number;
}

export interface ResultadoDeLimiteDeTaxa {
  readonly permitido: boolean;
  /** Quando `permitido` é `false`: quanto falta, em ms, até a marca mais antiga sair da janela. */
  readonly restanteMs: number;
}

export interface LimiteDeTaxa {
  consumir(chave: string): ResultadoDeLimiteDeTaxa;
}

/**
 * Janela deslizante "log de marcas": cada chamada permitida grava o instante
 * atual; `consumir` descarta as marcas fora da janela antes de contar. Custo
 * proporcional a `maximo` por chamada — aceitável para os limites desta
 * fase (dezenas por minuto), não para milhares.
 */
export function criarLimiteDeTaxa(opcoes: OpcoesDeLimiteDeTaxa): LimiteDeTaxa {
  const relogio = opcoes.relogio ?? Date.now;
  const marcasPorChave = new Map<string, number[]>();

  return {
    consumir(chave: string): ResultadoDeLimiteDeTaxa {
      const agora = relogio();
      const inicioDaJanela = agora - opcoes.janelaMs;
      const marcas = (marcasPorChave.get(chave) ?? []).filter((marca) => marca > inicioDaJanela);

      if (marcas.length >= opcoes.maximo) {
        marcasPorChave.set(chave, marcas);
        const maisAntiga = marcas[0]!;
        return { permitido: false, restanteMs: Math.max(maisAntiga + opcoes.janelaMs - agora, 0) };
      }

      marcas.push(agora);
      marcasPorChave.set(chave, marcas);
      return { permitido: true, restanteMs: 0 };
    },
  };
}
