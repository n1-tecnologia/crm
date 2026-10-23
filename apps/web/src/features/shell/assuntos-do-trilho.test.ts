/**
 * Fase 9, D-03 — o assunto IA some do trilho do Convidado. Regras puras sobre
 * o `buildSeed()`: o Convidado do seed é Beatriz (`role_conv`), a Júlia tem
 * Papel de base `membro` e o Proprietário é o Thiago.
 */

import { describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { ehConvidado, veAssuntoIa } from "./assuntos-do-trilho";

const estado = buildSeed();

describe("ehConvidado", () => {
  it("é verdadeiro para o Membro de Papel base convidado", () => {
    expect(ehConvidado(estado, "mem_beatriz")).toBe(true);
  });
  it("é falso para Membro, Administrador e Proprietário", () => {
    expect(ehConvidado(estado, "mem_julia")).toBe(false);
    expect(ehConvidado(estado, "mem_rafael")).toBe(false);
    expect(ehConvidado(estado, estado.workspace.ownerMemberId)).toBe(false);
  });
  it("é falso sem Membro resolvido", () => {
    expect(ehConvidado(estado, null)).toBe(false);
    expect(ehConvidado(estado, undefined)).toBe(false);
    expect(ehConvidado(estado, "mem_que_nao_existe")).toBe(false);
  });
});

describe("veAssuntoIa", () => {
  it("o Convidado não vê o assunto IA", () => {
    expect(veAssuntoIa(estado, "mem_beatriz")).toBe(false);
  });
  it("Membro e Proprietário veem", () => {
    expect(veAssuntoIa(estado, "mem_julia")).toBe(true);
    expect(veAssuntoIa(estado, estado.workspace.ownerMemberId)).toBe(true);
  });
  it("antes da sessão (memberId nulo) nada some à toa: a barreira é o servidor", () => {
    expect(veAssuntoIa(estado, null)).toBe(true);
    expect(veAssuntoIa(estado, undefined)).toBe(true);
  });
});
