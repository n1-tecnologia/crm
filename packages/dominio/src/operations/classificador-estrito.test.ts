/**
 * crm:CR-03 (06-11 Task 2, D6-02) — o classificador das respostas no fio do
 * Resumo só devolve `aprovacao` quando a mensagem INTEIRA é uma aprovação:
 * toda palavra no conjunto estrito, no máximo seis palavras, nenhum dígito,
 * símbolo ou emoji além de 👍/✅, e ao menos um sinal de aprovação. O erro,
 * quando houver, cai do lado do ajuste (custa um Resumo revisado), nunca do
 * lado da aprovação (custa um título errado no Omie).
 */

import { describe, expect, it } from "vitest";
import { classificarRespostaDeConferencia } from "./financeiro";

describe("aprovação: a mensagem inteira aprova", () => {
  it.each([
    "ok",
    "OK!",
    "Ok.",
    "sim",
    "certo",
    "Certo.",
    "correto",
    "conferido",
    "Conferido ✅",
    "aprovado",
    "liberado",
    "autorizado",
    "pode lançar",
    "pode seguir",
    "pode pagar",
    "segue",
    "tudo certo",
    "está certo",
    "tá ok",
    "ok, obrigado",
    "ok, pode lançar",
    "pode lançar, por favor",
    "tudo certo, pode lançar, obrigada",
    "👍",
    "👍🏻",
    "✅",
    "ok 👍",
  ])("%j → aprovacao", (texto) => {
    expect(classificarRespostaDeConferencia(texto)).toBe("aprovacao");
  });
});

describe("ajuste: os seis contraexemplos do review", () => {
  it.each([
    "O valor está certo, mas o vencimento é dia 15",
    "sim, mas o fornecedor é outro",
    "ok, só falta o boleto",
    "certo o valor mas a conta é Itaú",
    "👍 mas a categoria é comercial",
    "pode lançar dia 20",
  ])("%j → ajuste", (texto) => {
    expect(classificarRespostaDeConferencia(texto)).toBe("ajuste");
  });
});

describe("ajuste: com dígito, data ou código", () => {
  it.each([
    "ok 2.02.98",
    "ok, dia 15",
    "ok 15/10",
    "certo, R$ 150",
    "aprovado, conta KOPS",
    "conferido. lançar dia 10/10/2026",
    "pode lançar com a categoria 2.04.01",
    "sim 👍 código 2.06.01",
    "ok, mas é 2.04.08",
    "pode pagar em 3x",
    "ok, vencimento 20/10",
  ])("%j → ajuste", (texto) => {
    expect(classificarRespostaDeConferencia(texto)).toBe("ajuste");
  });
});

describe("ajuste: com símbolo, acima do teto ou sem sinal de aprovação", () => {
  it.each(["ok 👎", "certo ❌", "ok ⚠️", "ok :)", "ok ok ok ok ok ok ok", "valeu", "obrigado", "⚠️ o valor está errado", "segunda-feira"])(
    "%j → ajuste",
    (texto) => {
      expect(classificarRespostaDeConferencia(texto)).toBe("ajuste");
    },
  );
});

describe("ignorar: pergunta e espera, inalterados", () => {
  it.each(["?", "pode lançar?", "ok?", "aguardando a nota", "vou verificar", "", "   "])("%j → ignorar", (texto) => {
    expect(classificarRespostaDeConferencia(texto)).toBe("ignorar");
  });
});

describe("a diferença do legado", () => {
  it('"certo o valor mas a conta é Itaú" era aprovação pela regra "qualquer cláusula"; agora é ajuste', () => {
    // No legado (`adapters/ai.ts`, `classificarAprovacaoPorHeuristica`), bastava
    // uma cláusula com palavra de aprovação ("certo"). Aqui a mensagem inteira
    // tem de ser aprovação: "valor", "mas", "conta" e "Itaú" pedem outra coisa.
    expect(classificarRespostaDeConferencia("certo o valor mas a conta é Itaú")).toBe("ajuste");
  });
});
