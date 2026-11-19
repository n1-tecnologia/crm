/**
 * `limparHtmlDoEmail` (17-11, D-17-13, T-17-41 e T-17-42): o HTML de um e-mail é entrada hostil e só sai daqui limpo.
 * Sem banco: roda com `DATABASE_URL` vazio.
 */

import { describe, expect, it } from "vitest";
import { limparHtmlDoEmail } from "./html";

/** Um PNG de 1 pixel, o suficiente para a imagem embutida legítima. */
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("limparHtmlDoEmail — tags que somem", () => {
  it.each([
    ["script", '<p>a</p><script>alert(1)</script><p>b</p>'],
    ["iframe", '<p>a</p><iframe src="https://evil.example"></iframe>'],
    ["object", '<object data="https://evil.example/x.swf"></object>'],
    ["embed", '<embed src="https://evil.example/x.swf">'],
    ["form", '<form action="https://evil.example"><input name="senha"><button>Entrar</button></form>'],
    ["style", "<style>p{background:url(https://evil.example/t.gif)}</style><p>a</p>"],
    ["svg com onload", '<svg onload="alert(1)"><circle r="5"></circle></svg>'],
    ["math", "<math><mi>x</mi></math>"],
    ["meta refresh", '<meta http-equiv="refresh" content="0;url=https://evil.example"><p>a</p>'],
    ["base", '<base href="https://evil.example/"><a href="/x">x</a>'],
    ["link", '<link rel="stylesheet" href="https://evil.example/a.css"><p>a</p>'],
  ])("%s some", (_nome, entrada) => {
    const saida = limparHtmlDoEmail(entrada);
    expect(saida).not.toMatch(/<(script|iframe|object|embed|form|input|button|style|svg|math|meta|base|link)\b/i);
    expect(saida).not.toMatch(/alert\(1\)|evil\.example|onload|background/i);
  });

  it("o texto de dentro de script e de style não vira texto visível", () => {
    expect(limparHtmlDoEmail("<p>a</p><script>alert(1)</script><style>p{color:red}</style>")).toBe("<p>a</p>");
  });
});

describe("limparHtmlDoEmail — imagem (rastreamento, T-17-42)", () => {
  it("imagem remota (pixel de rastreio) some", () => {
    expect(limparHtmlDoEmail('<p>oi</p><img src="https://rastreio.exemplo/pixel.gif" width="1" height="1">')).toBe("<p>oi</p>");
  });

  it("imagem http (sem TLS) some", () => {
    expect(limparHtmlDoEmail('<img src="http://rastreio.exemplo/p.gif">')).toBe("");
  });

  it("imagem com protocolo relativo some", () => {
    expect(limparHtmlDoEmail('<img src="//rastreio.exemplo/p.gif">')).toBe("");
  });

  it("imagem data:image/svg+xml some (SVG executa)", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>').toString("base64");
    expect(limparHtmlDoEmail(`<img src="data:image/svg+xml;base64,${svg}">`)).toBe("");
  });

  it("imagem data:text/html some", () => {
    expect(limparHtmlDoEmail('<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">')).toBe("");
  });

  it("imagem sem src some", () => {
    expect(limparHtmlDoEmail('<img alt="x">')).toBe("");
  });

  it("data:image/png em base64 fica, só com os atributos permitidos", () => {
    const saida = limparHtmlDoEmail(`<img src="${PNG}" alt="logo" width="1" height="1" onerror="alert(1)" style="x:y">`);
    expect(saida).toContain(`src="${PNG}"`);
    expect(saida).toContain('alt="logo"');
    expect(saida).not.toMatch(/onerror|style/i);
  });

  it.each(["jpeg", "gif", "webp"])("data:image/%s fica", (tipo) => {
    expect(limparHtmlDoEmail(`<img src="data:image/${tipo};base64,AAAA">`)).toContain(`data:image/${tipo};base64,AAAA`);
  });

  it("fundo por atributo ou estilo não carrega nada remoto", () => {
    const saida = limparHtmlDoEmail('<table background="https://rastreio.exemplo/b.gif"><tr><td style="background:url(https://rastreio.exemplo/c.gif)">a</td></tr></table>');
    expect(saida).not.toMatch(/rastreio|background|url\(/i);
    expect(saida).toContain("a");
  });
});

describe("limparHtmlDoEmail — links", () => {
  it('<a href="javascript:..."> perde o href', () => {
    const saida = limparHtmlDoEmail('<a href="javascript:alert(1)">clique</a>');
    expect(saida).not.toMatch(/javascript|href/i);
    expect(saida).toContain("clique");
  });

  it.each(["JaVaScRiPt:alert(1)", "  javascript:alert(1)", "\tjavascript:alert(1)", "java\nscript:alert(1)", "&#106;avascript:alert(1)"])(
    "href disfarçado %j perde o href",
    (href) => {
      const saida = limparHtmlDoEmail(`<a href="${href}">x</a>`);
      expect(saida).not.toMatch(/href\s*=/i);
      expect(saida).not.toMatch(/alert/i);
    },
  );

  it.each(["data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox(1)", "file:///etc/passwd", "//evil.example/x"])("href %s perde o href", (href) => {
    expect(limparHtmlDoEmail(`<a href="${href}">x</a>`)).not.toMatch(/href\s*=/i);
  });

  it("mailto, tel, http e https ficam, todos com rel e target", () => {
    for (const href of ["mailto:x@y.com", "tel:+5511999990000", "http://exemplo.com/a", "https://exemplo.com/a?b=1&c=2"]) {
      const saida = limparHtmlDoEmail(`<a href="${href}">x</a>`);
      expect(saida).toContain('rel="noopener noreferrer"');
      expect(saida).toContain('target="_blank"');
      expect(saida).toMatch(/href="[^"]+"/);
    }
    expect(limparHtmlDoEmail('<a href="mailto:x@y.com">x</a>')).toBe('<a href="mailto:x@y.com" rel="noopener noreferrer" target="_blank">x</a>');
  });

  it("rel e target do próprio e-mail são sobrescritos (o link nunca controla a janela)", () => {
    const saida = limparHtmlDoEmail('<a href="https://exemplo.com" rel="opener" target="_top">x</a>');
    expect(saida).toContain('rel="noopener noreferrer"');
    expect(saida).toContain('target="_blank"');
    expect(saida).not.toMatch(/opener"|_top/);
  });
});

describe("limparHtmlDoEmail — atributos", () => {
  it("style some, inclusive o que carrega url(), @import e expression", () => {
    for (const estilo of ["background:url(https://x)", "@import 'https://x'", "width:expression(alert(1))", "behavior:url(x.htc)"]) {
      const saida = limparHtmlDoEmail(`<p style="${estilo}">a</p>`);
      expect(saida).toBe("<p>a</p>");
    }
  });

  it.each(["onmouseover", "onclick", "onerror", "onfocus", "onload"])("%s some de qualquer tag", (evento) => {
    const saida = limparHtmlDoEmail(`<table><tr><td ${evento}="alert(1)" colspan="2">a</td></tr></table>`);
    expect(saida).not.toMatch(/on[a-z]+=|alert/i);
    expect(saida).toContain('colspan="2"');
  });

  it("class, id e data-* não passam", () => {
    expect(limparHtmlDoEmail('<div class="a" id="b" data-x="c">z</div>')).toBe("<div>z</div>");
  });

  it("aspas desbalanceadas não abrem atributo novo", () => {
    const saida = limparHtmlDoEmail('<a href="https://exemplo.com" title="x\' onmouseover=\'alert(1)">y</a>');
    // O texto fica DENTRO do valor de `title` (entre aspas duplas); tirados os valores, não sobra atributo `on*`.
    expect(saida.replace(/"[^"]*"/g, '""')).not.toMatch(/\sonmouseover\s*=/i);
    expect(saida).toBe('<a href="https://exemplo.com" title="x\' onmouseover=\'alert(1)" rel="noopener noreferrer" target="_blank">y</a>');
  });
});

describe("limparHtmlDoEmail — estrutura", () => {
  it("div aninhado em 30 níveis não estoura nem mantém a profundidade", () => {
    const entrada = `${"<div>".repeat(30)}fundo${"</div>".repeat(30)}`;
    const saida = limparHtmlDoEmail(entrada);
    expect(typeof saida).toBe("string");
    expect((saida.match(/<div>/g) ?? []).length).toBeLessThanOrEqual(20);
  });

  it("texto com &lt;script&gt; continua texto escapado", () => {
    const saida = limparHtmlDoEmail("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(saida).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(saida).not.toMatch(/<script/i);
  });

  it("entrada vazia devolve vazio", () => {
    expect(limparHtmlDoEmail("")).toBe("");
  });

  it("a formatação de texto e de tabela permitida passa", () => {
    const entrada = "<h2>Título</h2><p><b>a</b> <i>b</i><br>c</p><ul><li>x</li></ul><table><thead><tr><th>h</th></tr></thead><tbody><tr><td>d</td></tr></tbody></table><hr><blockquote>q</blockquote>";
    expect(limparHtmlDoEmail(entrada)).toBe(entrada.replace("<br>", "<br />").replace("<hr>", "<hr />"));
  });
});
