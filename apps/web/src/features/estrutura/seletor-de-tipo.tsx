"use client";

import { useEffect, useId, useMemo } from "react";
import { tiposDaLista } from "@n1/dominio/derive";
import type { DataState } from "@n1/dominio/state";
import type { Id } from "@n1/dominio/types";
import { Select } from "@/features/shell/ui";

/**
 * O TIPO DA TAREFA, NA HORA DE CRIAR.
 *
 * O Tipo sempre existiu na Tarefa (e a ficha deixava trocá-lo depois), mas na
 * criação ele era imposto: toda Tarefa nascia com o Tipo padrão do nível mais
 * próximo da Lista, e quem queria uma "Reunião" criava uma "Tarefa" e corrigia
 * em seguida. Este seletor põe a escolha onde ela é feita.
 *
 * Só aparece quando há o que escolher: numa Lista que enxerga UM Tipo (o caso
 * comum) ele devolve `null` e a barra de criação fica como era — um controle
 * com uma opção só é ruído. A ordem e o padrão vêm de `tiposDaLista`, a mesma
 * derivação que o domínio usa para decidir com que Tipo a Tarefa nasce quando
 * ninguém escolhe: a tela pré-escolhe exatamente o que aconteceria sem ela.
 *
 * `onChange` recebe o Tipo escolhido. Quem chama guarda o estado e o passa a
 * `createTask`; se a Lista mudar de Tipos debaixo dele (alguém criou um Tipo
 * no Espaço, a Tarefa mudou de Lista), o efeito reconduz a escolha para o
 * padrão, para nunca mandar ao domínio um Tipo que a Lista não alcança.
 */
export function SeletorDeTipoDeTarefa({
  state,
  listId,
  value,
  onChange,
  id,
  largura = "10rem",
}: {
  readonly state: DataState;
  readonly listId: Id;
  /** O Tipo escolhido; `undefined` enquanto ninguém escolheu (vale o padrão). */
  readonly value: Id | undefined;
  readonly onChange: (taskTypeId: Id) => void;
  readonly id?: string;
  readonly largura?: string;
}) {
  /* Um id por instância: a barra do topo e o compositor de um grupo podem
     estar abertos ao mesmo tempo, e dois elementos com o mesmo id quebram o
     `for` do rótulo — o leitor de tela lê o primeiro nos dois. */
  const meuId = useId();
  const idDoCampo = id ?? `tipo-da-nova-tarefa-${meuId.replace(/:/g, "")}`;
  const tipos = useMemo(() => tiposDaLista(state, listId), [state, listId]);
  const padrao = tipos[0]?.id;
  const valido = value !== undefined && tipos.some((t) => t.id === value);

  useEffect(() => {
    if (!valido && padrao) onChange(padrao);
  }, [valido, padrao, onChange]);

  if (tipos.length < 2 || !padrao) return null;
  return (
    <span className="block shrink-0" style={{ width: largura }}>
      <label className="sr-only" htmlFor={idDoCampo}>
        Tipo da nova Tarefa
      </label>
      <Select
        id={idDoCampo}
        size="sm"
        value={valido ? value : padrao}
        onChange={onChange}
        options={tipos.map((tipo) => ({ value: tipo.id, label: tipo.name }))}
      />
    </span>
  );
}
