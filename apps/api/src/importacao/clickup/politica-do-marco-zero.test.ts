/**
 * Prova pura de `decidirMarcoZero` (WR-07, `05-REVIEW.md`) — os cinco casos
 * do plano, sem Postgres, sem CLI: a decisão nunca escreve, só decide.
 */

import { describe, expect, it } from "vitest";
import { decidirMarcoZero } from "./politica-do-marco-zero";

describe("decidirMarcoZero", () => {
  it("--so-marco-zero sem --apply: só relata, nunca grava", () => {
    expect(decidirMarcoZero({ soMarcoZero: true, apply: false })).toEqual({ acao: "relatar" });
  });

  it("--so-marco-zero com --apply: grava", () => {
    expect(decidirMarcoZero({ soMarcoZero: true, apply: true })).toEqual({ acao: "gravar" });
  });

  it("fluxo normal, dry-run (sem --apply): dry-run da importação nunca toca a marca", () => {
    expect(decidirMarcoZero({ soMarcoZero: false, apply: false, rejeitadas: 0 })).toEqual({ acao: "nenhuma" });
  });

  it("fluxo normal, --apply com rejeições: recusa — importar pela metade é pior que não importar", () => {
    const decisao = decidirMarcoZero({ soMarcoZero: false, apply: true, rejeitadas: 3 });
    expect(decisao.acao).toBe("recusar");
    expect(decisao.acao === "recusar" && decisao.motivo).toMatch(/3 linha\(s\) recusada\(s\)/);
  });

  it("fluxo normal, --apply sem rejeições: grava", () => {
    expect(decidirMarcoZero({ soMarcoZero: false, apply: true, rejeitadas: 0 })).toEqual({ acao: "gravar" });
  });

  it("fluxo normal, --apply sem informar rejeitadas: default 0, grava (nunca lança por parâmetro ausente)", () => {
    expect(decidirMarcoZero({ soMarcoZero: false, apply: true })).toEqual({ acao: "gravar" });
  });
});
