/**
 * O RELÓGIO DO INÍCIO — a saudação e o HUD lidos no fuso do Espaço de Trabalho.
 *
 * A hora é lida na Localidade do Espaço de Trabalho, não no relógio de quem
 * renderiza: `getHours()` responde diferente no servidor e no navegador, e a
 * diferença aparece como erro de hidratação. Funções puras, sem React, para
 * o teste ao lado poder fixar 00:41 e 05:00 sem tocar o relógio da máquina.
 */

/** A hora (0–23) de `now` no fuso dado. `h23` de propósito: `hour12: false` devolve "24" em alguns motores à meia-noite. */
export function horaNoFuso(now: Date, timezone: string): number {
  return Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));
}

/**
 * "Boa noite" da meia-noite às 4h59 (quem abre o app depois da meia-noite
 * está na noite, não na manhã), "Bom dia" das 5h às 11h59, "Boa tarde" até as
 * 17h59, e "Boa noite" de novo dali em diante. SEM CONSUMIDOR desde
 * 2026-09-23, quando a saudação saiu do Início a pedido; fica, testada, para
 * quando uma saudação voltar.
 */
export function saudacao(now: Date, timezone: string): string {
  const hora = horaNoFuso(now, timezone);
  if (hora < 5) return "Boa noite";
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * A data e a hora do HUD, no fuso do Espaço de Trabalho: "qua., 17 de set." ·
 * "14:32 BRT" para ler, e `iso` ("2026-09-17T14:32", no MESMO fuso) para o
 * `dateTime` do `<time>`, que exige uma data válida — não o texto em pt-BR.
 */
export function relogio(now: Date, timezone: string): { readonly data: string; readonly hora: string; readonly iso: string } {
  return {
    data: new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: timezone }).format(now),
    hora: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone: timezone }).format(now),
    iso: isoNoFuso(now, timezone),
  };
}

/** "AAAA-MM-DDTHH:mm" no fuso dado. Montado por partes: o separador do `sv-SE` é detalhe do motor, os campos não. */
export function isoNoFuso(now: Date, timezone: string): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(now);
  const parte = (tipo: Intl.DateTimeFormatPartTypes): string => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}T${parte("hour")}:${parte("minute")}`;
}
