// Junta as partes do plano na ordem do cronograma. Cada parte cobre um grupo de sessões:
// a = 0, 1, 12 (Superadmin) · b = 2 · c = 3, 5 · d = 4, 6, 7, 8, 9, 10, 11 · e = reunião T, levantamento T2, 13, 14, 15, 16, 18 · f = 17, 19, 20.
//
// Subtarefa de fazer:   { n, cam, hoje, fazer (texto ou lista de passos), pronto, nota? }
// Subtarefa de decisão: { n, cam, decisao: true, hoje, opcoes, muda, recomendo, peso: "produto" | "arrumacao" }

import { SESSOES as a } from "./parte-a.mjs";
import { SESSOES as b } from "./parte-b.mjs";
import { SESSOES as c } from "./parte-c.mjs";
import { SESSOES as d } from "./parte-d.mjs";
import { SESSOES as e } from "./parte-e.mjs";
import { SESSOES as f } from "./parte-f.mjs";

const ORDEM = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "T", "T2", "13", "14", "15", "16", "17", "18", "19", "20"];

const todas = [...a, ...b, ...c, ...d, ...e, ...f];
const porId = new Map(todas.map((s) => [s.id, s]));

const faltando = ORDEM.filter((id) => !porId.has(id));
if (faltando.length) throw new Error(`Sessões faltando nas partes: ${faltando.join(", ")}`);
const sobrando = todas.filter((s) => !ORDEM.includes(s.id)).map((s) => s.id);
if (sobrando.length) throw new Error(`Sessões fora da ordem conhecida: ${sobrando.join(", ")}`);

export const SESSOES = ORDEM.map((id) => porId.get(id));
