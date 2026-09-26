"use client";

/**
 * ADICIONAR CANAL (C36) — conecta uma conta nova de um tipo: WhatsApp, e-mail,
 * Instagram ou LinkedIn. O popup mostra o que aquele tipo pede
 * (`FORMA_DO_IDENTIFICADOR`: o rótulo, um exemplo e a dica), e dois campos
 * que respondem "de que setor é" e "de onde vem": o **Setor** (a Fila padrão,
 * em que as Conversas desta conta entram) e a **Origem** padrão dos Contatos
 * que nascem por ela — os dois já existem no Canal (documento 14, 7.2).
 *
 * Aberto de dentro do diálogo de criação da Lista (que se apaga enquanto este
 * está no ar — os diálogos não empilham) e das Configurações da Lista; com
 * `tipo` fixo, a pessoa escolhe só a conta. Volta aos props a cada abertura.
 * `onDone` recebe o Canal criado: quem chamou o marca na Lista.
 */

import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { useSession } from "@/dados/store";
import {
  FORMA_DO_IDENTIFICADOR,
  ROTULO_DO_TIPO_DE_CANAL,
  TIPOS_DE_ATENDIMENTO,
  criarCanal,
  identificadorCanonico,
  recusaDeGerirCanais,
  type TipoDeAtendimento,
} from "@n1/dominio/operations/canais";
import type { Channel } from "@n1/dominio/types";
import { ConfirmDialog, Field, Select, TextInput } from "@/features/shell/ui";

export function AdicionarCanalDialog({
  tipo,
  open,
  onClose,
  onDone,
}: {
  /** O tipo já escolhido (a linha que pediu); sem ele, o popup pergunta. */
  readonly tipo?: TipoDeAtendimento;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (channel: Channel) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const session = useSession();
  const [tipoEscolhido, setTipoEscolhido] = useState<TipoDeAtendimento | "">(tipo ?? "");
  const [nome, setNome] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [filaId, setFilaId] = useState("");
  const [origemId, setOrigemId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Cada abertura parte dos props: o tipo da linha que pediu, o resto vazio.
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setTipoEscolhido(tipo ?? "");
      setNome("");
      setIdentificador("");
      setFilaId("");
      setOrigemId("");
      setErro(null);
    }
  }

  const tipoAtual: TipoDeAtendimento | "" = tipo ?? tipoEscolhido;
  const forma = tipoAtual ? FORMA_DO_IDENTIFICADOR[tipoAtual] : undefined;
  const permissao = recusaDeGerirCanais(state, session.memberId);
  const formaInvalida = tipoAtual !== "" && identificador.trim() !== "" && identificadorCanonico(tipoAtual, identificador) === undefined;
  // O mesmo encadeamento que o domínio faz, dito antes do clique.
  const motivo = permissao
    ? permissao
    : tipoAtual === ""
      ? "Escolha o tipo de Canal."
      : !nome.trim()
        ? "Dê um nome ao Canal."
        : !identificador.trim()
          ? `Informe ${forma?.rotulo.toLocaleLowerCase("pt-BR") ?? "o identificador"}.`
          : formaInvalida
            ? forma?.dica
            : undefined;

  const filas = state.queues.filter((q) => q.lifecycle === "ativo");
  const origens = state.catalog.filter((i) => i.kind === "origem" && i.lifecycle === "ativo");

  const confirmar = () => {
    if (tipoAtual === "") return;
    const r = run((data, me) =>
      criarCanal(data, me, {
        channelType: tipoAtual,
        name: nome,
        externalId: identificador,
        ...(filaId ? { defaultQueueId: filaId } : {}),
        ...(origemId ? { defaultOriginId: origemId } : {}),
      }),
    );
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    onDone(r.value);
  };

  const rotuloDoTipo = tipoAtual ? ROTULO_DO_TIPO_DE_CANAL[tipoAtual] : "Canal";

  return (
    <ConfirmDialog
      open={open}
      title={tipo ? `Adicionar ${rotuloDoTipo}` : "Adicionar Canal"}
      description="A conta passa a existir no Espaço de Trabalho, conectada, e fica marcada nesta Lista. O setor e a origem são dela — valem para toda Conversa que nascer por ela."
      confirmLabel="Conectar"
      wide
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      <div className="grid gap-5">
        {tipo ? null : (
          <Field label="Tipo de Canal" required hint="Chat do site não atende Lista: ele nasce de visitante anônimo.">
            {(id) => (
              <Select
                id={id}
                value={tipoEscolhido}
                onChange={(v) => setTipoEscolhido(v as TipoDeAtendimento)}
                placeholder="Escolher o tipo"
                options={TIPOS_DE_ATENDIMENTO.map((t) => ({ value: t, label: ROTULO_DO_TIPO_DE_CANAL[t] }))}
              />
            )}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required hint="Como a conta aparece na Caixa de Entrada — “Comercial SP”, “Suporte”.">
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder={`Por exemplo: ${rotuloDoTipo} do Comercial`} />}
          </Field>
          <Field label={forma?.rotulo ?? "Identificador"} required {...(forma ? { hint: forma.dica } : { hint: "Escolha o tipo para saber o que preencher." })}>
            {(id) => (
              <TextInput
                id={id}
                value={identificador}
                onChange={setIdentificador}
                placeholder={forma?.exemplo ?? ""}
                disabled={tipoAtual === ""}
                disabledReason="Escolha o tipo de Canal primeiro."
                invalid={formaInvalida}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Setor" hint="A Fila em que as Conversas desta conta entram — quem atende por ela.">
            {(id) => (
              <Select
                id={id}
                value={filaId}
                onChange={setFilaId}
                placeholder="Nenhum"
                options={[{ value: "", label: "Nenhum — a Conversa nasce sem Fila" }, ...filas.map((f) => ({ value: f.id, label: f.name }))]}
              />
            )}
          </Field>
          <Field label="Origem" hint="De onde vêm os Contatos que nascem por esta conta (catálogo do Espaço de Trabalho).">
            {(id) => (
              <Select
                id={id}
                value={origemId}
                onChange={setOrigemId}
                placeholder="Nenhuma"
                options={[{ value: "", label: "Nenhuma" }, ...origens.map((o) => ({ value: o.id, label: o.name }))]}
              />
            )}
          </Field>
        </div>

        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
