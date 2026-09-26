/**
 * `esquemas/contatos.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (`type` de Identificador fora da
 * lista, `onCollision` fora da lista, chave desconhecida numa linha de
 * importação); (2) as formas LITERAIS que `apps/web` manda hoje continuam
 * passando — a rede de regressão contra falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { CONTATOS } from "./contatos";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/contatos — a forma dos args de contacts.ts", () => {
  it("(a) cobertura — as 19 chaves de contacts.ts em registro.ts", () => {
    const esperadas = [
      "addContactIdentifier",
      "transferContactIdentifier",
      "mergeContacts",
      "endContactCompanyLink",
      "trashContact",
      "trashCompany",
      "restoreMergedCopy",
      "importContacts",
      "restoreContact",
      "restoreCompany",
      "markContactsAsDistinct",
      "addContactNote",
      "createContact",
      "createCompany",
      "linkContactToCompany",
      "addCompanyIdentifier",
      "setContactCatalogValue",
      "updateCompany",
      "addCompanyNote",
    ].sort();
    expect(Object.keys(CONTATOS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    const FORMAS_DO_WEB: ReadonlyArray<readonly [keyof typeof CONTATOS, unknown[]]> = [
      ["addContactIdentifier", ["c1", "email", "a@b.c"]],
      ["transferContactIdentifier", ["c1", "i1", "c2"]],
      ["mergeContacts", ["c1", "c2"]],
      ["endContactCompanyLink", ["l1", "2026-01-01"]],
      ["trashContact", ["c1"]],
      ["trashCompany", ["cmp1"]],
      ["restoreMergedCopy", ["c1"]],
      [
        "importContacts",
        [
          [{ firstName: "A" }, { firstName: "B", lastName: "C", identifierType: "telefone", identifierValue: "11" }],
          { onCollision: "rejeitar" },
        ],
      ],
      [
        "importContacts",
        [[{ firstName: "A" }], { onCollision: "rejeitar", ownerMemberId: "m1", originId: "o1" }],
      ],
      ["restoreContact", ["c1"]],
      ["restoreCompany", ["cmp1"]],
      ["markContactsAsDistinct", ["c1", "c2"]],
      ["addContactNote", ["c1", "nota"]],
      ["createContact", [{ firstName: "A", lastName: "B" }]],
      [
        "createContact",
        [
          {
            firstName: "A",
            lastName: "B",
            identifierType: "email",
            identifierValue: "a@b.c",
            companyId: "cmp1",
            role: "CEO",
            ownerMemberId: "m1",
          },
        ],
      ],
      ["createCompany", [{ tradeName: "T", legalName: "L" }]],
      ["createCompany", [{ tradeName: "T", legalName: "L", parentCompanyId: "cmp1", ownerMemberId: "m1" }]],
      ["linkContactToCompany", [{ contactId: "c1", companyId: "cmp1", role: "CEO" }]],
      [
        "linkContactToCompany",
        [{ contactId: "c1", companyId: "cmp1", role: "CEO", principalForCompany: true }],
      ],
      ["addCompanyIdentifier", ["cmp1", "dominio", "n1.com"]],
      ["setContactCatalogValue", ["c1", "qualificacao", "cat_1"]],
      ["setContactCatalogValue", ["c1", "temperatura", undefined]],
    ];
    for (const [nome, args] of FORMAS_DO_WEB) {
      expect(CONTATOS[nome].safeParse(viaJson(args)).success, nome).toBe(true);
    }

    const semCatalogo = CONTATOS.setContactCatalogValue.safeParse(viaJson(["c1", "temperatura", undefined]));
    expect(semCatalogo.success).toBe(true);
    if (semCatalogo.success) expect(semCatalogo.data).toEqual(["c1", "temperatura", undefined]);
  });

  it("(c) formas hostis caem", () => {
    expect(CONTATOS.addContactIdentifier.safeParse(viaJson(["c1", "pombo", "x"])).success).toBe(false);
    expect(
      CONTATOS.importContacts.safeParse(viaJson([[{ firstName: "A" }], { onCollision: "ignorar" }])).success,
    ).toBe(false);
    expect(
      CONTATOS.importContacts.safeParse(viaJson([[{ firstName: 1 }], { onCollision: "rejeitar" }])).success,
    ).toBe(false);
    expect(
      CONTATOS.importContacts.safeParse(
        viaJson([[{ firstName: "A", extra: 1 }], { onCollision: "rejeitar" }]),
      ).success,
    ).toBe(false);
    expect(CONTATOS.createContact.safeParse(viaJson([{ firstName: "A" }])).success).toBe(false);
    expect(
      CONTATOS.createContact.safeParse(viaJson([{ firstName: "A", lastName: "B", apelido: "x" }])).success,
    ).toBe(false);
    expect(CONTATOS.addCompanyIdentifier.safeParse(viaJson(["cmp1", "cnpj", "x"])).success).toBe(false);
    expect(CONTATOS.setContactCatalogValue.safeParse(viaJson(["c1", "humor", "c1"])).success).toBe(false);
    expect(
      CONTATOS.linkContactToCompany.safeParse(viaJson([{ contactId: "c1", companyId: "cmp1" }])).success,
    ).toBe(false);
  });

  it("(d) updateCompany e addCompanyNote — formas de empresa-popup.tsx (frontend do main, 2026-09-25)", () => {
    expect(CONTATOS.updateCompany.safeParse(viaJson(["co1", { description: "d" }])).success).toBe(true);
    expect(CONTATOS.updateCompany.safeParse(viaJson(["co1", { tradeName: "T" }])).success).toBe(true);
    expect(CONTATOS.updateCompany.safeParse(viaJson(["co1", { ownerMemberId: "m1" }])).success).toBe(true);
    expect(CONTATOS.updateCompany.safeParse(viaJson(["co1", { parentCompanyId: null }])).success).toBe(true);
    expect(CONTATOS.updateCompany.safeParse(viaJson(["co1", { parentCompanyId: "co2" }])).success).toBe(true);
    expect(CONTATOS.addCompanyNote.safeParse(viaJson(["co1", "nota"])).success).toBe(true);
    expect(CONTATOS.updateCompany.safeParse(viaJson(["co1", { nome: "x" }])).success).toBe(false);
    expect(CONTATOS.updateCompany.safeParse(viaJson(["co1", { tradeName: 1 }])).success).toBe(false);
  });
});
