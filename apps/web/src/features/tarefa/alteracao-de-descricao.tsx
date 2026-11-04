"use client";

/**
 * "Ver alteração" da descrição da Tarefa (Fase 11, 2.6.8; D-10 a D-14).
 *
 * O Registro de Atividade "Descrição alterada" leva o texto anterior e o novo
 * (`before`/`after`, até 2.000 pontos de código de cada lado, 11-02). Imprimi-los
 * entre parênteses no meio da frase derramaria a descrição inteira na linha; aqui
 * a linha mostra só "Descrição alterada" e este botão, que expande embaixo dela
 * o "Antes" e o "Depois", um sobre o outro, com as quebras de linha preservadas.
 * É o mesmo componente do Feed de Atividade (toda Lista) e da Timeline (Lista de
 * Solicitação de pagamento).
 *
 * - D-12: registro sem `before` e sem `after` (edição antiga) não tem botão;
 *   `before: ""` conta como presente (teste por `!== undefined`) e o bloco vazio
 *   mostra "Sem descrição".
 * - D-14 / T-02-10: Ator de integração nunca mostra botão nem texto — o
 *   `before`/`after` dele pode levar payload, CPF/CNPJ ou URL assinada.
 * - T-11-16: o texto vai como nó de texto React em `whitespace-pre-wrap`, sem
 *   passar pelo `Rico` da Timeline e sem HTML montado; marcação na descrição
 *   aparece literal.
 */

import { useState } from "react";
import { ehAlteracaoDeDescricao } from "@n1/dominio/descricao-da-tarefa";
import type { ActivityRecord } from "@n1/dominio/types";

/** Há antes/depois da descrição para este Registro mostrar? */
export function temAlteracaoParaVer(record: ActivityRecord): boolean {
  return (
    ehAlteracaoDeDescricao(record) &&
    record.actor.kind !== "integration" &&
    (record.before !== undefined || record.after !== undefined)
  );
}

function Bloco({ rotulo, texto }: { readonly rotulo: string; readonly texto: string | undefined }) {
  const vazio = texto === undefined || texto === "";
  return (
    <span className="block">
      <span className="app-meta block" style={{ color: "var(--texto-3)", fontWeight: 600 }}>
        {rotulo}
      </span>
      <span
        className="app-sm block whitespace-pre-wrap"
        style={{ color: vazio ? "var(--texto-3)" : "var(--texto)", overflowWrap: "anywhere" }}
      >
        {vazio ? "Sem descrição" : texto}
      </span>
    </span>
  );
}

/**
 * Só `<span>`: vai dentro do `<span>` da linha do Feed e da Timeline. Devolve
 * `null` quando não há nada a ver (outras ações, edição antiga, integração).
 */
export function AlteracaoDeDescricao({ record }: { readonly record: ActivityRecord }) {
  const [aberto, setAberto] = useState(false);
  if (!temAlteracaoParaVer(record)) return null;

  return (
    <>
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
        className="app-sm transition-colors hover:underline"
        style={{ color: "var(--acento)", textDecoration: "underline" }}
      >
        {aberto ? "Ocultar alteração" : "Ver alteração"}
      </button>
      {aberto ? (
        <span className="mt-1 grid gap-2">
          <Bloco rotulo="Antes" texto={record.before} />
          <Bloco rotulo="Depois" texto={record.after} />
        </span>
      ) : null}
    </>
  );
}
