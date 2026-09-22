"use client";

/**
 * INICIAR CONVERSA — o diálogo do lado do CRM de "Meus negócios". No lugar de
 * "Nova Tarefa": o Membro escolhe o Contato, diz em que Etapa o lead está, a
 * Qualificação e a Temperatura, o valor se já houver, e por qual Canal vai
 * falar — e sai direto no chat. O Negócio, o espelho na Lista e a Conversa
 * nascem juntos (operations/iniciar-conversa).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { CHANNEL_CAPABILITIES } from "@n1/dominio/operations";
import { funilDaLista, iniciarConversa } from "@n1/dominio/operations/iniciar-conversa";
import { contactDisplayName } from "@n1/dominio/derive";
import { ConfirmDialog, Field, Select, TextInput } from "@/features/shell/ui";

export function IniciarConversaDialog({
  listId,
  open,
  stageId: etapaInicial,
  onClose,
  onDone,
}: {
  readonly listId: string;
  /** Montado só enquanto aberto: o estado inicial (a Etapa do "+") vale para esta abertura. */
  readonly open: boolean;
  /** A Etapa pré-escolhida (o "+" de um grupo); ausente = a primeira. */
  readonly stageId?: string;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const router = useRouter();
  const funnel = funilDaLista(state, listId);
  const etapas = funnel ? [...funnel.stages].sort((a, b) => a.order - b.order) : [];

  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState(etapaInicial ?? etapas[0]?.id ?? "");
  const [qualificationId, setQualificationId] = useState("");
  const [temperatureId, setTemperatureId] = useState("");
  const [valor, setValor] = useState("");
  const [titulo, setTitulo] = useState("");
  const [channelId, setChannelId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const contato = state.contacts.find((c) => c.id === contactId);
  // Só os Canais que alcançam algum Identificador do Contato.
  const canaisDe = (c: typeof contato) =>
    state.channels
      .filter((ch) => ch.lifecycle === "ativo")
      .filter((ch) => {
        if (!c) return true;
        const alcanca = CHANNEL_CAPABILITIES[ch.channelType].resolvesIdentifierTypes;
        return c.identifiers.some((i) => alcanca.includes(i.type));
      });
  const canais = canaisDe(contato);
  // Escolher o Contato traz o que ele já tem: a Qualificação, a Temperatura, e o
  // Canal quando só um o alcança. O Membro muda se souber melhor.
  const escolherContato = (id: string) => {
    setContactId(id);
    const c = state.contacts.find((x) => x.id === id);
    setQualificationId(c?.qualificationId ?? "");
    setTemperatureId(c?.temperatureId ?? "");
    const alcancam = canaisDe(c);
    setChannelId(alcancam.length === 1 && alcancam[0] ? alcancam[0].id : alcancam.some((ch) => ch.id === channelId) ? channelId : "");
  };

  const qualificacoes = state.catalog.filter((c) => c.kind === "qualificacao" && c.lifecycle === "ativo");
  const temperaturas = state.catalog.filter((c) => c.kind === "temperatura" && c.lifecycle === "ativo");
  const valorNumero = valor.trim() === "" ? undefined : Number(valor.replace(",", "."));
  const valorInvalido = valorNumero !== undefined && !(Number.isFinite(valorNumero) && valorNumero > 0);

  const motivo = !funnel
    ? "Esta Lista não espelha um Funil."
    : !contactId
      ? "Escolha o Contato."
      : !stageId
        ? "Diga em que Etapa o lead está."
        : !channelId
          ? "Escolha o Canal da conversa."
          : valorInvalido
            ? "O valor é um número maior que zero."
            : undefined;

  const reset = () => {
    setContactId("");
    setQualificationId("");
    setTemperatureId("");
    setValor("");
    setTitulo("");
    setChannelId("");
    setErro(null);
  };

  const confirmar = () => {
    const result = run((data, memberId) =>
      iniciarConversa(data, memberId, {
        listId,
        contactId,
        stageId,
        channelId,
        ...(titulo.trim() ? { title: titulo } : {}),
        ...(valorNumero !== undefined && !valorInvalido ? { value: { amount: valorNumero, currency: "BRL" } } : {}),
        ...(qualificationId ? { qualificationId } : {}),
        ...(temperatureId ? { temperatureId } : {}),
      }),
    );
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onDone(`Negócio criado: ${result.value.deal.title}. A conversa está aberta.`);
    router.push(`/crm/caixa-de-entrada/${result.value.conversation.id}`);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Iniciar conversa"
      description={funnel ? `Um Negócio novo no Funil ${funnel.name}, já na Etapa em que o lead está — e o chat aberto.` : "Esta Lista não espelha um Funil."}
      confirmLabel="Iniciar conversa"
      wide
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        <Field label="Contato" required hint="Quem é o lead. Sem Contato não há com quem conversar.">
          {(id) => (
            <Select
              id={id}
              value={contactId}
              onChange={escolherContato}
              searchable
              placeholder="Escolher o Contato"
              options={state.contacts
                .filter((c) => c.lifecycle === "ativo")
                .map((c) => ({
                  value: c.id,
                  label: contactDisplayName(c),
                  detail: c.identifiers[0]?.displayValue ?? "",
                }))}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Etapa" required hint="Onde o lead está no Funil.">
            {(id) => (
              <Select
                id={id}
                value={stageId}
                onChange={setStageId}
                placeholder="Escolher a Etapa"
                options={etapas.map((s, i) => ({ value: s.id, label: s.name, detail: `${i + 1} de ${etapas.length}` }))}
              />
            )}
          </Field>
          <Field label="Canal" required hint="Por onde a conversa acontece.">
            {(id) => (
              <Select
                id={id}
                value={channelId}
                onChange={setChannelId}
                placeholder={contato && canais.length === 0 ? "Nenhum Canal alcança este Contato" : "Escolher o Canal"}
                disabled={contato !== undefined && canais.length === 0}
                disabledReason="Acrescente um Identificador ao Contato que um Canal alcance."
                options={canais.map((c) => ({ value: c.id, label: c.name, detail: c.channelType }))}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Qualificação">
            {(id) => (
              <Select
                id={id}
                value={qualificationId}
                onChange={setQualificationId}
                placeholder="Sem Qualificação"
                options={[{ value: "", label: "Sem Qualificação" }, ...qualificacoes.map((q) => ({ value: q.id, label: q.name }))]}
              />
            )}
          </Field>
          <Field label="Temperatura">
            {(id) => (
              <Select
                id={id}
                value={temperatureId}
                onChange={setTemperatureId}
                placeholder="Sem Temperatura"
                options={[{ value: "", label: "Sem Temperatura" }, ...temperaturas.map((t) => ({ value: t.id, label: t.name }))]}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor" hint="Opcional. Em reais.">
            {(id) => <TextInput id={id} value={valor} onChange={setValor} placeholder="Por exemplo: 16997" invalid={valorInvalido} />}
          </Field>
          <Field label="Título do Negócio" hint={`Opcional. Vazio, fica “${funnel?.name ?? "Funil"} — ${contato ? contactDisplayName(contato) : "Contato"}”.`}>
            {(id) => <TextInput id={id} value={titulo} onChange={setTitulo} placeholder="Por exemplo: Full Face para Marina" />}
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
