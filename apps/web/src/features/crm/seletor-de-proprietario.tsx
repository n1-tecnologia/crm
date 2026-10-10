"use client";

/**
 * O Proprietário de um registro do CRM (D-11): um Membro `ativo` do Espaço.
 * Valor vazio é "Eu (quem cria)" — o backend usa o Membro da sessão quando o
 * corpo não traz `proprietarioId`, então a tela não precisa conhecer o id de
 * quem está logado para o caso comum.
 */

import { useMembrosAtivos } from "@/dados/crm/sessao";
import { Select } from "@/features/shell/ui";

export const ROTULO_DE_QUEM_CRIA = "Eu (quem cria)";

export function SeletorDeProprietario({
  valor,
  onChange,
  id,
  rotuloVazio = ROTULO_DE_QUEM_CRIA,
  disabled = false,
  disabledReason,
}: {
  /** O id do Membro, ou `""` para "Eu (quem cria)". */
  readonly valor: string;
  readonly onChange: (valor: string) => void;
  readonly id?: string;
  /** Na edição o vazio não existe: o Proprietário atual é sempre um Membro. */
  readonly rotuloVazio?: string | null;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}) {
  const membros = useMembrosAtivos();
  const opcoes = [
    ...(rotuloVazio === null ? [] : [{ value: "", label: rotuloVazio }]),
    ...membros.map((membro) => ({ value: membro.id, label: membro.nome })),
  ];
  return (
    <Select
      {...(id ? { id } : {})}
      value={valor}
      options={opcoes}
      onChange={onChange}
      searchable={membros.length > 8}
      disabled={disabled}
      {...(disabledReason ? { disabledReason } : {})}
    />
  );
}
