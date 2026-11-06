// @vitest-environment jsdom
/** 15-06 Task 2 — o avatar do modelo novo desenha as iniciais como `ContactAvatar`, sem ler o store. */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AvatarDoContato } from "./avatar-do-contato";

afterEach(cleanup);

describe("AvatarDoContato", () => {
  it("mostra as duas primeiras iniciais em maiúscula e o nome para leitor de tela", () => {
    render(<AvatarDoContato nome="ana" sobrenome="souza lima" />);
    expect(screen.getByText("AS")).toBeTruthy();
    expect(screen.getByText("ana souza lima")).toBeTruthy();
  });

  it("sem sobrenome usa só o nome; sem nada cai em 'Contato sem nome' com as iniciais dele", () => {
    const { unmount } = render(<AvatarDoContato nome="Bia" />);
    expect(screen.getByText("B")).toBeTruthy();
    unmount();
    render(<AvatarDoContato nome={null} sobrenome={null} />);
    expect(screen.getByText("Contato sem nome")).toBeTruthy();
  });

  it("o tamanho grande usa o lado de 64px do ContactAvatar", () => {
    const { container } = render(<AvatarDoContato nome="Ana" tamanho="grande" />);
    expect(container.querySelector("span")?.className).toContain("size-16");
  });
});
