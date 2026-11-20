"use client";

/**
 * Os campos que só o e-mail tem no compositor (D-17-19): Assunto, Para, Cópia e
 * Cópia oculta. Existe como componente para o fio (`conversation-thread.tsx`,
 * 1.600 linhas) não crescer e para a regra de endereço morar num lugar só.
 *
 * Os três campos de endereço aceitam vários endereços, separados por vírgula ou
 * ponto e vírgula. Cada um passa por `normalizarEmail` do domínio, a mesma regra
 * que a api aplica de novo ao receber `enderecosAdicionais` (T-17-67): aqui a
 * recusa chega antes do envio, ao lado do campo, dizendo qual endereço conferir.
 * O componente é controlado e não envia nada: quem monta a Mensagem é o fio.
 */

import { useId } from "react";
import { normalizarEmail } from "@n1/dominio/crm/normalizacao";
import type { EnderecoAdicional } from "@n1/dominio/crm/mensagens";

export type CampoDeEndereco = "para" | "copia" | "copiaOculta";

export interface ValorDosCamposDoEmail {
  readonly assunto: string;
  readonly para: string;
  readonly copia: string;
  readonly copiaOculta: string;
}

export type ErrosDosCamposDoEmail = Partial<Record<CampoDeEndereco, string>>;

/** Os três campos de endereço, na ordem em que saem em `enderecosAdicionais`. */
const CAMPOS_DE_ENDERECO = ["para", "copia", "copiaOculta"] as const satisfies readonly CampoDeEndereco[];

/** Os endereços de um campo: separados por vírgula ou ponto e vírgula, sem os vazios (uma vírgula sobrando não é erro). */
export function enderecosDoTexto(texto: string): string[] {
  return texto
    .split(/[,;]/)
    .map((parte) => parte.trim())
    .filter((parte) => parte !== "");
}

export type EnderecosDosCampos =
  | { readonly ok: true; readonly enderecos: readonly EnderecoAdicional[] }
  | { readonly ok: false; readonly erros: ErrosDosCamposDoEmail };

/**
 * Confere os três campos de uma vez e devolve os endereços normalizados (minúsculos), na ordem Para, Cópia, Cópia
 * oculta. Um campo com endereço inválido vira `Confira o endereço: <o que foi digitado>`; os outros campos continuam
 * conferidos, para a pessoa ver tudo o que falta de uma vez.
 */
export function enderecosDosCampos(valor: Pick<ValorDosCamposDoEmail, CampoDeEndereco>): EnderecosDosCampos {
  const enderecos: EnderecoAdicional[] = [];
  const erros: ErrosDosCamposDoEmail = {};
  for (const campo of CAMPOS_DE_ENDERECO) {
    for (const digitado of enderecosDoTexto(valor[campo])) {
      const normalizado = normalizarEmail(digitado);
      if (!normalizado.ok) {
        erros[campo] ??= `Confira o endereço: ${digitado}`;
        continue;
      }
      enderecos.push({ tipo: campo, endereco: normalizado.value });
    }
  }
  return Object.keys(erros).length > 0 ? { ok: false, erros } : { ok: true, enderecos };
}

export function CamposDoEmail({
  valor,
  onMudar,
  desabilitado = false,
  erros = {},
}: {
  readonly valor: ValorDosCamposDoEmail;
  /** Recebe o valor inteiro, com o campo que mudou já trocado. */
  readonly onMudar: (proximo: ValorDosCamposDoEmail) => void;
  readonly desabilitado?: boolean;
  /** O que `enderecosDosCampos` recusou; o fio o mostra ao tentar enviar e o tira quando o campo é editado. */
  readonly erros?: ErrosDosCamposDoEmail;
}) {
  const base = useId();
  const mudar = (campo: keyof ValorDosCamposDoEmail) => (texto: string) => onMudar({ ...valor, [campo]: texto });

  /** Um campo de endereço: rótulo só para leitor de tela (o `placeholder` é o que se vê) e o erro logo abaixo, ligado ao campo. */
  const campoDeEndereco = (campo: CampoDeEndereco, rotulo: string, dica: string) => {
    const idDoCampo = `${base}-${campo}`;
    const erro = erros[campo];
    return (
      <span className="min-w-0">
        <label className="sr-only" htmlFor={idDoCampo}>
          {rotulo}
        </label>
        <input
          id={idDoCampo}
          value={valor[campo]}
          onChange={(evento) => mudar(campo)(evento.target.value)}
          placeholder={dica}
          disabled={desabilitado}
          autoComplete="off"
          aria-invalid={erro !== undefined ? true : undefined}
          aria-describedby={erro !== undefined ? `${idDoCampo}-erro` : undefined}
          className="campo"
        />
        {erro !== undefined ? (
          <span id={`${idDoCampo}-erro`} className="app-sm mt-1 block" style={{ color: "var(--erro)" }}>
            {erro}
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <div className="mb-2 grid gap-1.5" data-campos-do-email="true">
      <span className="min-w-0">
        <label className="sr-only" htmlFor={`${base}-assunto`}>
          Assunto
        </label>
        <input
          id={`${base}-assunto`}
          value={valor.assunto}
          onChange={(evento) => mudar("assunto")(evento.target.value)}
          placeholder="Assunto"
          disabled={desabilitado}
          autoComplete="off"
          className="campo"
        />
      </span>
      {campoDeEndereco("para", "Para", "Para (além do Contato)")}
      <div className="grid grid-cols-2 gap-1.5">
        {campoDeEndereco("copia", "Cópia", "Cópia")}
        {campoDeEndereco("copiaOculta", "Cópia oculta", "Cópia oculta")}
      </div>
    </div>
  );
}
