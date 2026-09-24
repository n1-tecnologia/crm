"use client";

/**
 * T46 — Painel.
 *
 * RN-PAI-15 — o Widget lê SEMPRE pelas permissões de quem olha, e a Âncora não
 * concede acesso (INV-PAI-09). Por isso o mesmo Painel mostra números
 * diferentes para Membros diferentes, e um Widget cuja Fonte o visualizador não
 * alcança diz "Fonte sem acesso" em vez de mostrar zero: zero e sem acesso são
 * respostas diferentes.
 *
 * RN-PAI-13 — nada é convertido entre moedas: uma linha por moeda, rotulada.
 *
 * A diagramação separa o que se lê de relance do que se lê com calma: os
 * Widgets de um número só viram ladrilhos numa faixa no alto (como os
 * indicadores do Financeiro), e os de série viram gráficos numa grade abaixo,
 * cada tipo com o seu desenho (`features/paineis/graficos.tsx`).
 */

import { use, useState } from "react";
import { Coins, Hash, Lock } from "lucide-react";
import { useData, useSession } from "@/data/store";
import { widgetReading, type WidgetReading } from "@/data/derive";
import type { Widget } from "@/data/types";
import { CampoDeLanterna } from "@/design/lanterna";
import { useContagem } from "@/design/movimento";
import { Selo } from "@/features/estrutura/icone-de-tipo";
import { Barras, Funil, ICONE_DE_ANCORA, ICONE_DE_VISTA, ROTULO_DE_VISTA, Rosca, corDaSerie, type CorDe } from "@/features/paineis/graficos";
import { RESOURCE_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  CATEGORY_COLOR,
  CorpoDeTela,
  Divisor,
  EmptyState,
  Icone,
  NoAccessState,
  PageHeader,
  Pilula,
  Section,
  StateSeal,
} from "@/features/shell/ui";

export default function PainelPage({ params }: { params: Promise<{ painel: string }> }) {
  const { painel } = use(params);
  const state = useData((data) => data);
  const { memberId } = useSession();
  const fmt = useFormat();
  const [now] = useState(() => new Date());
  const record = state.panels.find((p) => p.id === painel);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Painel não encontrado."
            hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const anchor = record.anchor;

  // Cada Widget lido uma vez; a leitura decide a peça (ladrilho ou gráfico).
  const leituras = record.widgets.map((widget) => ({ widget, reading: widgetReading(state, widget, memberId, now) }));
  const ladrilhos = leituras.filter(({ widget, reading }) => widget.viewType === "numero" || reading.kind === "numero" || reading.kind === "moeda");
  const graficos = leituras.filter((item) => !ladrilhos.includes(item));
  const tipoAncora = anchor?.type ?? "workspace";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={record.name}
        icon={<Selo icone={ICONE_DE_ANCORA[tipoAncora]} cor="var(--acento)" lavado="var(--acento-lavado)" />}
        seal={<StateSeal state={record.lifecycle} />}
        meta={`${record.widgets.length} ${record.widgets.length === 1 ? "widget" : "widgets"}`}
        details={
          <>
            <span className="app-meta">
              {anchor ? `${RESOURCE_TYPE_LABEL[tipoAncora] ?? tipoAncora} · ${anchor.nameAtTheTime}` : "Espaço de Trabalho inteiro"}
            </span>
            <Divisor vertical />
            <span className="app-meta">
              Proprietário: {state.members.find((m) => m.id === record.ownerMemberId)?.displayName ?? "—"}
            </span>
            <Divisor vertical />
            {/* RN-PAI-15 — a regra vira título do dado, não parágrafo sob o cabeçalho. */}
            <span
              className="app-meta app-numero"
              title="Os valores refletem as SUAS permissões: outro Membro abre este mesmo Painel e vê números diferentes."
            >
              Dados de {fmt.instant(now.toISOString())}
            </span>
          </>
        }
      />

      <CorpoDeTela>
        {record.widgets.length === 0 ? (
          <EmptyState
            title="Este Painel está vazio."
            hint="Um Painel sem Widget não tem o que ler."
          />
        ) : null}

        {ladrilhos.length > 0 ? (
          <CampoDeLanterna className="@container mb-6">
            <ul className="cascata grade-solta grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4" data-chegada="foco">
              {ladrilhos.map(({ widget, reading }, i) => (
                <li key={widget.id}>
                  <Ladrilho widget={widget} reading={reading} indice={i} formatMoney={fmt.money} formatNumber={fmt.number} />
                </li>
              ))}
            </ul>
          </CampoDeLanterna>
        ) : null}

        {graficos.length > 0 ? (
          <Section title="Gráficos" count={graficos.length}>
            <div className="@container">
              <ul className="cascata grade-solta @3xl:grid-cols-2">
                {graficos.map(({ widget, reading }) => (
                  <li key={widget.id}>
                    <CartaoDeGrafico widget={widget} reading={reading} formatMoney={fmt.money} formatNumber={fmt.number} />
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        ) : null}
      </CorpoDeTela>
    </div>
  );
}

type Formatadores = {
  readonly formatMoney: (value: { readonly amount: number; readonly currency: string }) => string;
  readonly formatNumber: (value: number) => string;
};

/*
 * A cor é vocabulário (tokens.css): quando a dimensão é uma situação de
 * Negócio, um estado de Conversa ou uma categoria de Status, a fatia recebe a
 * cor que essa palavra tem no resto do sistema — Ganho verde, Perdido cinza
 * (perder é resultado do funil, não erro). Fora disso, a paleta de séries.
 */
const VOCABULARIO: Record<string, Record<string, string>> = {
  situation: { Aberto: "var(--cor-neg-aberto)", Ganho: "var(--cor-neg-ganho)", Perdido: "var(--cor-neg-perdido)" },
  state: { Aberta: "var(--cor-cxe-aberta)", Pendente: "var(--cor-cxe-pendente)", Resolvida: "var(--cor-cxe-resolvida)" },
  statusCategory: CATEGORY_COLOR,
};

function corDoVocabulario(widget: Widget): CorDe | undefined {
  const atributo = widget.dimensions[0]?.attribute;
  const mapa = atributo ? VOCABULARIO[atributo] : undefined;
  if (!mapa) return undefined;
  return (label, i) => mapa[label] ?? corDaSerie(label, i);
}

/** O que o Widget mede e por onde — a segunda linha de todo cartão e ladrilho. */
function descricaoDoWidget(widget: Widget): string {
  const partes = [ROTULO_DE_VISTA[widget.viewType] ?? widget.viewType];
  if (widget.dataSource) partes.push(RESOURCE_TYPE_LABEL[widget.dataSource.target] ?? widget.dataSource.target);
  const dimensao = widget.dimensions[0];
  if (dimensao) partes.push(`por ${dimensao.label}`);
  return partes.join(" · ");
}

/** Teto de count-ups por tela: do 9º ladrilho em diante o número já nasce parado (quem lê precisa dele parado). */
const CONTAGENS_POR_TELA = 8;
/** Teto de lanternas por grade: cada uma custa um `getBoundingClientRect` por quadro de ponteiro. */
const LANTERNAS_POR_GRADE = 12;

/**
 * O número que sobe: o quadro animado fica fora da árvore acessível e o valor
 * final vai em `sr-only` desde o primeiro quadro — o movimento nunca é o único
 * sinal. `.app-numero` (tabular) segura a largura enquanto conta.
 */
function NumeroContado({
  valor,
  formata,
  ativo,
  className,
  cor,
}: {
  readonly valor: number;
  readonly formata: (value: number) => string;
  readonly ativo: boolean;
  readonly className: string;
  readonly cor: string;
}) {
  const animado = useContagem(valor, { ativo });
  return (
    <span className={className} style={{ color: cor }}>
      <span aria-hidden="true">{formata(animado)}</span>
      <span className="sr-only">{formata(valor)}</span>
    </span>
  );
}

/** Um número só: ladrilho como os indicadores do Financeiro, lido de relance. */
function Ladrilho({
  widget,
  reading,
  indice,
  formatMoney,
  formatNumber,
}: { readonly widget: Widget; readonly reading: WidgetReading; readonly indice: number } & Formatadores) {
  const filtros = widget.fixedFilters.map((filter) => filter.label).join(" · ");
  const semAcesso = reading.kind === "semAcesso";
  const moeda = reading.kind === "moeda";
  const zerado =
    (reading.kind === "numero" && reading.value === 0) ||
    (reading.kind === "moeda" && reading.byCurrency.every((entry) => entry.amount === 0));
  const contando = indice < CONTAGENS_POR_TELA;

  return (
    <div
      className={indice < LANTERNAS_POR_GRADE ? "item-solto lanterna h-full" : "item-solto h-full"}
      data-bloco="true"
      data-estatico="true"
      data-atenuado={zerado ? "true" : undefined}
      title={semAcesso ? "Você não alcança a Fonte deste Widget: o número não é zero, é desconhecido." : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="app-coluna truncate">{widget.title}</span>
        <Icone de={semAcesso ? Lock : moeda ? Coins : Hash} tamanho="xs" style={{ color: semAcesso ? "var(--texto-4)" : "var(--acento)" }} />
      </span>

      {reading.kind === "numero" ? (
        <NumeroContado
          valor={reading.value}
          formata={formatNumber}
          ativo={contando}
          className="ed-subtitulo app-numero mt-1 block"
          cor={zerado ? "var(--texto-4)" : "var(--texto)"}
        />
      ) : reading.kind === "moeda" ? (
        reading.byCurrency.length === 0 ? (
          <span className="ed-subtitulo app-numero mt-1 block" style={{ color: "var(--texto-4)" }}>
            —
          </span>
        ) : (
          // RN-PAI-13 — uma linha por moeda; nunca uma soma que não existe.
          <span className="mt-1 flex flex-col">
            {reading.byCurrency.map((entry) => (
              <NumeroContado
                key={entry.currency}
                valor={entry.amount}
                formata={(amount) => formatMoney({ amount, currency: entry.currency })}
                ativo={contando}
                className="ed-subtitulo app-numero"
                cor={entry.amount === 0 ? "var(--texto-4)" : "var(--texto)"}
              />
            ))}
          </span>
        )
      ) : (
        <span className="ed-subtitulo app-numero mt-1 block" style={{ color: "var(--texto-4)" }}>
          {semAcesso ? "Sem acesso" : "—"}
        </span>
      )}

      <span className="app-meta block truncate">
        {"label" in reading ? reading.label : ROTULO_DE_VISTA[widget.viewType]}
        {filtros ? ` · ${filtros}` : ""}
      </span>
    </div>
  );
}

/** Um Widget de série: cabeçalho com o selo do tipo de vista, e o gráfico do tipo. */
function CartaoDeGrafico({ widget, reading, formatMoney, formatNumber }: { readonly widget: Widget; readonly reading: WidgetReading } & Formatadores) {
  return (
    <article className="item-solto h-full" data-bloco="true" data-estatico="true">
      <header className="flex items-start gap-3">
        <Selo icone={ICONE_DE_VISTA[widget.viewType]} cor="var(--texto-2)" lavado="var(--superficie-3)" />
        <div className="min-w-0 flex-1">
          <h3 className="app-md truncate" style={{ color: "var(--texto)" }}>
            {widget.title}
          </h3>
          <p className="app-meta truncate">{descricaoDoWidget(widget)}</p>
        </div>
      </header>

      {widget.fixedFilters.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {widget.fixedFilters.map((filter) => (
            <Pilula key={`${filter.attribute}:${filter.value}`} tom="neutro" contorno title="Filtro fixo do Widget">
              {filter.label}
            </Pilula>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <CorpoDoGrafico widget={widget} reading={reading} formatMoney={formatMoney} formatNumber={formatNumber} />
      </div>
    </article>
  );
}

function CorpoDoGrafico({ widget, reading, formatMoney, formatNumber }: { readonly widget: Widget; readonly reading: WidgetReading } & Formatadores) {
  if (reading.kind === "semAcesso") {
    return <NoAccessState what="Fonte deste Widget" />;
  }

  if (reading.kind === "texto") {
    return <p className="app-base" style={{ color: "var(--texto-1)" }}>{reading.content}</p>;
  }

  // Um número que não virou ladrilho (não acontece hoje; a leitura decide).
  if (reading.kind === "numero" || reading.kind === "moeda") {
    return (
      <p className="ed-subtitulo app-numero" style={{ color: "var(--texto)" }}>
        {reading.kind === "numero"
          ? formatNumber(reading.value)
          : reading.byCurrency.map((entry) => formatMoney({ amount: entry.amount, currency: entry.currency })).join(" · ") || "—"}
      </p>
    );
  }

  if (reading.rows.length === 0) {
    return (
      <p className="app-base" style={{ color: "var(--texto-3)" }}>
        Nenhum registro no recorte deste Widget.
      </p>
    );
  }

  const moeda = reading.currency;
  const formata = (value: number) => (moeda ? formatMoney({ amount: value, currency: moeda }) : formatNumber(value));
  const soma = reading.rows.reduce((acumulado, row) => acumulado + row.value, 0);
  const corDe = corDoVocabulario(widget);

  return (
    <>
      {widget.viewType === "funil" ? (
        <Funil rows={reading.rows} formata={formata} />
      ) : widget.viewType === "pizza" ? (
        <Rosca rows={reading.rows} formata={formata} total={formata(soma)} {...(corDe ? { corDe } : {})} />
      ) : (
        <Barras rows={reading.rows} formata={formata} {...(corDe ? { corDe } : {})} />
      )}
      {reading.total > reading.shown ? (
        <p className="app-meta app-numero mt-3">
          Mostrando {reading.shown} de {reading.total}.
        </p>
      ) : null}
    </>
  );
}
