"use client";

/**
 * O SELETOR DE REGISTRO (UI-SPEC §7): escolher UM Contato ou UMA Empresa
 * buscando na api, para os lugares onde o registro certo não cabe numa lista
 * fixa — o Contato admin de uma Empresa, a matriz, o Contato a vincular, o dono
 * de um Negócio (07-10/07-11 reaproveitam este mesmo componente).
 *
 * A busca é `GET /<recurso>?q=…&limite=10&estado=ativo`, 300 ms depois da
 * última digitação (uma ida por pausa, não por letra), e só sai com algo
 * digitado. Resultado mostra o nome e, em segunda linha, o desempate (e-mail
 * ou telefone principal do Contato; domínio ou documento da Empresa).
 * `excluirIds` tira da lista quem não pode ser escolhido (já vinculado, a
 * própria Empresa como matriz…).
 *
 * Teclado, como o `Select` do sistema: setas navegam, Enter escolhe, Esc fecha.
 * Tudo o que a api devolve é texto React; nada vira HTML (T-07-30).
 */

import { useEffect, useId, useState } from "react";
import useSWR from "swr";
import type { ContatoResumo } from "@n1/dominio/crm/contatos";
import type { EmpresaResumo } from "@n1/dominio/crm/empresas";
import { chamarCrm, ErroDeApi } from "@/dados/crm/cliente-crm";
import { Button } from "@/features/shell/ui";

export const ESPERA_DA_BUSCA_MS = 300;
export const RESULTADOS_DA_BUSCA = 10;

export interface RegistroEscolhido {
  readonly id: string;
  readonly nome: string;
}

type Recurso = "contatos" | "empresas";

interface Candidato {
  readonly id: string;
  readonly nome: string;
  /** A segunda linha: o que distingue dois registros de mesmo nome. */
  readonly desempate: string | null;
}

interface RespostaDaBusca {
  readonly ok: true;
  readonly itens: ReadonlyArray<ContatoResumo | EmpresaResumo>;
  readonly total: number;
}

function comoCandidato(recurso: Recurso, item: ContatoResumo | EmpresaResumo): Candidato {
  if (recurso === "contatos") {
    const contato = item as ContatoResumo;
    return { id: contato.id, nome: contato.nomeDeExibicao, desempate: contato.emailPrincipal ?? contato.telefonePrincipal };
  }
  const empresa = item as EmpresaResumo;
  return { id: empresa.id, nome: empresa.nomeDeExibicao, desempate: empresa.dominioPrincipal ?? empresa.documentoPrincipal };
}

/** `/<recurso>?q=…&limite=10&estado=ativo`; `null` enquanto não há o que buscar. */
function chaveDaBusca(recurso: Recurso, busca: string): string | null {
  if (busca === "") return null;
  const parametros = new URLSearchParams();
  parametros.set("q", busca);
  parametros.set("limite", String(RESULTADOS_DA_BUSCA));
  parametros.set("estado", "ativo");
  return `/${recurso}?${parametros.toString()}`;
}

export function SeletorDeRegistro({
  recurso,
  valor,
  onChange,
  excluirIds = [],
  rotulo,
  id,
}: {
  readonly recurso: Recurso;
  /** O escolhido, ou `null` enquanto a busca está aberta. */
  readonly valor: RegistroEscolhido | null;
  readonly onChange: (valor: RegistroEscolhido | null) => void;
  readonly excluirIds?: readonly string[];
  /** O nome acessível do campo ("Buscar Contato"). */
  readonly rotulo: string;
  /** Quando um `Field` o envolve, o `id` que o rótulo dele aponta. */
  readonly id?: string;
}) {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const idDaLista = useId();

  // Espera de 300 ms antes de trocar a chave: digitar não dispara uma ida ao servidor por letra.
  useEffect(() => {
    const espera = setTimeout(() => setBusca(texto.trim()), ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [texto]);

  const chave = valor === null ? chaveDaBusca(recurso, busca) : null;
  const { data, error, isLoading } = useSWR<RespostaDaBusca, Error>(chave, (k: string) => chamarCrm<RespostaDaBusca>(k));

  if (valor !== null) {
    return (
      <span role="group" aria-label={rotulo} className="flex min-h-[var(--controle-h)] items-center gap-2">
        <span className="app-base min-w-0 flex-1 truncate" title={valor.nome}>
          {valor.nome}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setTexto("");
            setBusca("");
            setAberto(false);
            onChange(null);
          }}
        >
          Trocar
        </Button>
      </span>
    );
  }

  const candidatos =
    data && chave !== null
      ? data.itens.map((item) => comoCandidato(recurso, item)).filter((candidato) => !excluirIds.includes(candidato.id))
      : [];
  // Entre a digitação e a resposta a lista diz "Buscando…" e não pisca "Nenhum resultado".
  const buscando = texto.trim() !== busca || (chave !== null && (isLoading || (data === undefined && !error)));
  const posicaoAtiva = Math.min(ativo, Math.max(candidatos.length - 1, 0));

  const escolher = (candidato: Candidato) => {
    setAberto(false);
    setTexto("");
    setBusca("");
    onChange({ id: candidato.id, nome: candidato.nome });
  };

  const aoTeclar = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Escape") {
      if (aberto) {
        evento.stopPropagation();
        setAberto(false);
      }
      return;
    }
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setAberto(true);
      if (candidatos.length > 0) {
        const passo = evento.key === "ArrowDown" ? 1 : -1;
        setAtivo((posicao) => (Math.min(posicao, candidatos.length - 1) + passo + candidatos.length) % candidatos.length);
      }
      return;
    }
    if (evento.key === "Enter" && aberto && candidatos[posicaoAtiva]) {
      evento.preventDefault();
      escolher(candidatos[posicaoAtiva]);
    }
  };

  const corpoDaLista = () => {
    if (texto.trim() === "") return <li className="app-meta px-2 py-3 text-center">Digite para buscar.</li>;
    if (error && !buscando) {
      return <li className="app-meta px-2 py-3 text-center">{error instanceof ErroDeApi ? error.message : "Não foi possível buscar. Tente de novo."}</li>;
    }
    if (buscando) return <li className="app-meta px-2 py-3 text-center">Buscando…</li>;
    if (candidatos.length === 0) return <li className="app-meta px-2 py-3 text-center">Nenhum resultado.</li>;
    return candidatos.map((candidato, indice) => (
      <li key={candidato.id} role="none">
        <button
          type="button"
          role="option"
          id={`${idDaLista}-${indice}`}
          tabIndex={-1}
          aria-selected={indice === posicaoAtiva}
          data-highlighted={indice === posicaoAtiva ? "" : undefined}
          // Escolher não pode tirar o foco do campo antes do clique chegar.
          onMouseDown={(evento) => evento.preventDefault()}
          onMouseEnter={() => setAtivo(indice)}
          onClick={() => escolher(candidato)}
          className="item-menu w-full"
        >
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate">{candidato.nome}</span>
            {candidato.desempate ? <span className="app-meta block truncate">{candidato.desempate}</span> : null}
          </span>
        </button>
      </li>
    ));
  };

  return (
    <div className="relative">
      <input
        {...(id ? { id } : { "aria-label": rotulo })}
        type="search"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idDaLista}
        aria-autocomplete="list"
        autoComplete="off"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          setAtivo(0);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={aoTeclar}
        placeholder="Buscar por nome"
        className="campo alvo-toque"
      />
      {aberto ? (
        <div className="flutuante surgir-rapido absolute z-20 mt-1 w-full overflow-hidden">
          <ul id={idDaLista} role="listbox" aria-label={`Resultados de ${rotulo}`} className="relative max-h-64 overflow-y-auto p-1">
            {corpoDaLista()}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
