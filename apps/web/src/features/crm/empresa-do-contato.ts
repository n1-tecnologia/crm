/**
 * A Empresa que o cartão do Contato mostra (D-15-05): entre os vínculos VIGENTES
 * (sem `fim`), o admin mais antigo; sem admin, o vigente mais antigo. É a mesma
 * regra do resumo da Tarefa conversacional (15-05, `order by admin desc, criado_em`),
 * lida aqui do `ContatoDetalhado` — que não traz `criado_em` do vínculo, então o
 * "mais antigo" é o de menor `inicio` (sem `inicio` vem depois dos que têm) e, no
 * empate, a ordem em que a api devolveu. Puro: a tela não decide mais nada.
 */

import type { VinculoDoContato } from "@n1/dominio/crm/contatos";

export function empresaDoContato(vinculos: readonly VinculoDoContato[]): VinculoDoContato | undefined {
  const vigentes = vinculos.filter((vinculo) => vinculo.fim === null);
  const maisAntigo = (lista: readonly VinculoDoContato[]): VinculoDoContato | undefined =>
    lista.reduce<VinculoDoContato | undefined>((escolhido, vinculo) => {
      if (escolhido === undefined) return vinculo;
      if (vinculo.inicio === null) return escolhido;
      if (escolhido.inicio === null) return vinculo;
      return vinculo.inicio < escolhido.inicio ? vinculo : escolhido;
    }, undefined);
  const admins = vigentes.filter((vinculo) => vinculo.admin);
  return maisAntigo(admins.length > 0 ? admins : vigentes);
}
