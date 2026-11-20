// @vitest-environment jsdom
/**
 * Os campos do e-mail do compositor (17-15, D-17-19): rótulos, vários endereços por campo e a conferência de cada
 * endereço pela regra do domínio. O envio em si (assunto e cópias no `POST /mensagens`) é provado no fio, em
 * `conversation-thread.test.tsx`.
 */

import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CamposDoEmail, enderecosDoTexto, enderecosDosCampos, type ValorDosCamposDoEmail } from "@/features/crm/campos-do-email";

afterEach(cleanup);

const VAZIO: ValorDosCamposDoEmail = { assunto: "", para: "", copia: "", copiaOculta: "" };

describe("enderecosDoTexto", () => {
  it("separa por vírgula e por ponto e vírgula, apara os espaços e ignora os vazios", () => {
    expect(enderecosDoTexto(" a@x.com ;b@x.com,, c@x.com ; ")).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
    expect(enderecosDoTexto("   ")).toEqual([]);
  });
});

describe("enderecosDosCampos", () => {
  it("devolve os endereços normalizados, na ordem Para, Cópia, Cópia oculta, cada um com o seu tipo", () => {
    const resultado = enderecosDosCampos({ para: "P@X.com", copia: "c1@x.com; c2@x.com", copiaOculta: "o@x.com" });
    expect(resultado).toEqual({
      ok: true,
      enderecos: [
        { tipo: "para", endereco: "p@x.com" },
        { tipo: "copia", endereco: "c1@x.com" },
        { tipo: "copia", endereco: "c2@x.com" },
        { tipo: "copiaOculta", endereco: "o@x.com" },
      ],
    });
  });

  it("campos vazios são válidos e não geram endereço", () => {
    expect(enderecosDosCampos({ para: "", copia: "", copiaOculta: "" })).toEqual({ ok: true, enderecos: [] });
  });

  it("um endereço inválido vira “Confira o endereço: …” no campo dele, e os outros campos seguem conferidos", () => {
    const resultado = enderecosDosCampos({ para: "ok@x.com", copia: "ok@x.com, x@", copiaOculta: "sem-arroba" });
    expect(resultado).toEqual({ ok: false, erros: { copia: "Confira o endereço: x@", copiaOculta: "Confira o endereço: sem-arroba" } });
  });

  it("endereços separados por espaço ou com quebra de linha não passam (T-17-67: nada de cabeçalho injetado)", () => {
    expect(enderecosDosCampos({ para: "a@x.com b@x.com", copia: "", copiaOculta: "" }).ok).toBe(false);
    expect(enderecosDosCampos({ para: "a@x.com\r\nBcc: v@x.com", copia: "", copiaOculta: "" }).ok).toBe(false);
  });
});

describe("CamposDoEmail", () => {
  function Montado({ erros, desabilitado, aoMudar }: { erros?: Parameters<typeof CamposDoEmail>[0]["erros"]; desabilitado?: boolean; aoMudar?: (v: ValorDosCamposDoEmail) => void }) {
    const [valor, setValor] = useState<ValorDosCamposDoEmail>({ ...VAZIO, assunto: "Re: Pedido 42" });
    return (
      <CamposDoEmail
        valor={valor}
        onMudar={(proximo) => {
          setValor(proximo);
          aoMudar?.(proximo);
        }}
        {...(erros ? { erros } : {})}
        {...(desabilitado !== undefined ? { desabilitado } : {})}
      />
    );
  }

  it("mostra Assunto, Para, Cópia e Cópia oculta com rótulos acessíveis", () => {
    render(<Montado />);
    expect((screen.getByLabelText("Assunto") as HTMLInputElement).value).toBe("Re: Pedido 42");
    for (const nome of ["Para", "Cópia", "Cópia oculta"]) expect(screen.getByLabelText(nome)).toBeTruthy();
  });

  it("onMudar recebe o valor inteiro, com só o campo editado trocado", () => {
    const aoMudar = vi.fn();
    render(<Montado aoMudar={aoMudar} />);
    fireEvent.change(screen.getByLabelText("Cópia oculta"), { target: { value: "d@x.com" } });
    expect(aoMudar).toHaveBeenLastCalledWith({ assunto: "Re: Pedido 42", para: "", copia: "", copiaOculta: "d@x.com" });
  });

  it("o erro aparece ao lado do campo, ligado a ele por aria-describedby, e só nesse campo", () => {
    render(<Montado erros={{ copia: "Confira o endereço: x@" }} />);
    const copia = screen.getByLabelText("Cópia");
    expect(copia.getAttribute("aria-invalid")).toBe("true");
    const descricao = document.getElementById(copia.getAttribute("aria-describedby") ?? "");
    expect(descricao?.textContent).toBe("Confira o endereço: x@");
    expect(screen.getByLabelText("Cópia oculta").getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByLabelText("Para").getAttribute("aria-describedby")).toBeNull();
  });

  it("desabilitado trava os quatro campos", () => {
    render(<Montado desabilitado />);
    for (const nome of ["Assunto", "Para", "Cópia", "Cópia oculta"]) expect((screen.getByLabelText(nome) as HTMLInputElement).disabled).toBe(true);
  });
});
