"use client";

/**
 * POSC-09 — o que um contêiner é depois de criado (nome, descrição, cor,
 * privacidade) e o estado próprio dele (arquivar, desarquivar, lixeira,
 * restaurar). Dois painéis para as Configurações de Espaço, Pasta e Lista;
 * as regras moram em `packages/dominio/src/operations/structure.ts`, e a
 * tela só repete a recusa como motivo do controle desligado.
 */

import Link from "next/link";
import { useId, useState } from "react";
import { Archive, ArchiveRestore, Check, Trash2, Undo2 } from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import { containerAdminRefusal, effectiveLifecycleOfContainer } from "@n1/dominio/derive";
import { archiveContainer, restoreContainer, trashContainer, unarchiveContainer, updateContainer } from "@n1/dominio/operations";
import { containerTrashRefusal, type TipoDeConteiner } from "@n1/dominio/operations/structure";
import type { Folder, List, Space } from "@n1/dominio/types";
import { SPACE_COLORS } from "@/features/estrutura/create-container-dialog";
import { Button, CabecalhoDePainel, ConfirmDialog, Field, Icone, Painel, TextArea, TextInput, Toggle } from "@/features/shell/ui";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

const ROTULO: Record<TipoDeConteiner, { readonly nome: string; readonly a: "o" | "a" }> = {
  space: { nome: "Espaço", a: "o" },
  folder: { nome: "Pasta", a: "a" },
  list: { nome: "Lista", a: "a" },
};

/** Nome, descrição, cor (só o Espaço) e privacidade — gravados num "Salvar", nunca a cada tecla. */
export function IdentidadeDoConteiner({
  kind,
  container,
  report,
}: {
  readonly kind: TipoDeConteiner;
  readonly container: Space | Folder | List;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  const privacyLabelId = useId();
  const privacyHintId = useId();
  const [name, setName] = useState(container.name);
  const [description, setDescription] = useState(container.description ?? "");
  const [color, setColor] = useState(container.color ?? SPACE_COLORS[0]?.value ?? "");
  const [isPrivate, setIsPrivate] = useState(container.isPrivate);

  const rotulo = ROTULO[kind];
  const efetivo = effectiveLifecycleOfContainer(state, kind, container.id);
  const motivo =
    containerAdminRefusal(state, memberId, kind, container.id) ??
    (efetivo === "arquivado"
      ? `${rotulo.nome} ${kind === "space" ? "arquivado" : "arquivada"}: desarquive antes de editar.`
      : efetivo === "naLixeira"
        ? `${rotulo.nome} na lixeira: restaure antes de editar.`
        : undefined);

  const mudou =
    name.trim() !== container.name ||
    description.trim() !== (container.description ?? "") ||
    (kind === "space" && color !== container.color) ||
    isPrivate !== container.isPrivate;
  const semNome = name.trim() === "";

  const salvar = () => {
    const result = run((data, me) =>
      updateContainer(data, me, kind, container.id, {
        name,
        description,
        ...(kind === "space" ? { color } : {}),
        isPrivate,
      }),
    );
    report(result, `${rotulo.nome} ${kind === "space" ? "alterado" : "alterada"}.`);
    if (result.ok) {
      setName(result.value.name);
      setDescription(result.value.description ?? "");
    }
  };

  return (
    <Painel className="mb-3">
      <CabecalhoDePainel titulo="Identidade" />
      <div className="grid gap-3 p-3">
        {motivo ? (
          <p role="status" className="app-sm rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--superficie-2)", color: "var(--texto-3)" }}>
            {motivo}
          </p>
        ) : null}
        <Field label="Nome" required {...(semNome ? { error: `Dê um nome ${rotulo.a === "o" ? "ao" : "à"} ${rotulo.nome}.` } : {})}>
          {(id) => <TextInput id={id} value={name} onChange={setName} invalid={semNome} disabled={motivo !== undefined} {...(motivo ? { disabledReason: motivo } : {})} />}
        </Field>
        <Field label="Descrição" hint="Vazio apaga a descrição.">
          {(id) => <TextArea id={id} value={description} onChange={setDescription} rows={2} placeholder="Opcional" disabled={motivo !== undefined} {...(motivo ? { disabledReason: motivo } : {})} />}
        </Field>
        {kind === "space" ? (
          <Field label="Cor" hint="A cor marca o Espaço na árvore e nos cartões.">
            {(id) => (
              <div id={id} role="radiogroup" aria-label="Cor do Espaço" className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2">
                  {SPACE_COLORS.map((option) => {
                    const escolhida = color === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={escolhida}
                        aria-label={option.label}
                        title={option.label}
                        disabled={motivo !== undefined}
                        onClick={() => setColor(option.value)}
                        className="rotacao grid size-7 place-items-center rounded-full hover:scale-110"
                        style={{
                          backgroundColor: option.value,
                          boxShadow: escolhida ? "0 0 0 2px var(--card), 0 0 0 4px var(--acento)" : "inset 0 0 0 1px var(--linha-forte)",
                        }}
                      >
                        {escolhida ? <Icone de={Check} tamanho="xs" style={{ color: "var(--sobre-acento)" }} /> : null}
                      </button>
                    );
                  })}
                </span>
                <span className="app-sm" style={{ color: "var(--texto-3)" }}>
                  {SPACE_COLORS.find((option) => option.value === color)?.label ?? color}
                </span>
              </div>
            )}
          </Field>
        ) : null}
        <div className="flex items-center gap-3 rounded-[var(--r-controle)] px-3 py-2.5" style={{ border: "1px solid var(--linha)" }}>
          <span className="min-w-0 flex-1">
            <span id={privacyLabelId} className="app-base block" style={{ color: "var(--texto)" }}>
              {kind === "space" ? "Espaço privado" : `${rotulo.nome} privada`}
            </span>
            <span id={privacyHintId} className="app-sm block" style={{ color: "var(--texto-3)" }}>
              {isPrivate
                ? "Ser privado interrompe as permissões vindas do Papel e da herança: aqui dentro, só alcança quem recebeu Concessão direta ou compartilhamento."
                : "As permissões vindas do Papel e da herança alcançam este contêiner normalmente."}
            </span>
          </span>
          <Toggle checked={isPrivate} onChange={setIsPrivate} labelledBy={privacyLabelId} describedBy={privacyHintId} disabled={motivo !== undefined} />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="primary"
            onClick={salvar}
            disabled={motivo !== undefined || !mudou || semNome}
            disabledReason={motivo ?? (semNome ? `Dê um nome ${rotulo.a === "o" ? "ao" : "à"} ${rotulo.nome}.` : "Nada mudou.")}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Painel>
  );
}

/** Arquivar/desarquivar e lixeira/restaurar — o estado PRÓPRIO; o efetivo continua derivado dos ancestrais (B36). */
export function CicloDeVidaDoConteiner({
  kind,
  container,
  report,
}: {
  readonly kind: TipoDeConteiner;
  readonly container: Space | Folder | List;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  const [confirmandoLixeira, setConfirmandoLixeira] = useState(false);

  const rotulo = ROTULO[kind];
  const feminino = kind !== "space";
  const proprio = container.lifecycle;
  const efetivo = effectiveLifecycleOfContainer(state, kind, container.id);
  const motivoDeAdmin = containerAdminRefusal(state, memberId, kind, container.id);
  const motivoDeLixeira = containerTrashRefusal(state, memberId, kind, container.id);
  const retencao = state.workspace.trashPolicy.retentionDays;

  const estadoProprio =
    proprio === "ativo" ? (feminino ? "ativa" : "ativo") : proprio === "arquivado" ? (feminino ? "arquivada" : "arquivado") : "na lixeira";
  const efetivoDiferente =
    efetivo !== proprio ? ` Efetivamente ${efetivo === "arquivado" ? (feminino ? "arquivada" : "arquivado") : "na lixeira"}, por um contêiner acima.` : "";

  return (
    <Painel>
      <CabecalhoDePainel titulo="Ciclo de vida" />
      <div className="grid gap-3 p-3">
        <p className="app-base" style={{ color: "var(--texto)" }}>
          {rotulo.nome} {estadoProprio}.{efetivoDiferente}
        </p>
        <p className="app-meta">
          Arquivar tira da operação e mantém consultável; a lixeira leva junto tudo o que está abaixo e guarda por {retencao} dias. Restaurar
          devolve o estado que o registro tinha antes — o que estava arquivado volta arquivado.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {proprio === "ativo" ? (
            <Button
              size="sm"
              icon={<Icone de={Archive} tamanho="xs" />}
              onClick={() => report(run((data, me) => archiveContainer(data, me, kind, container.id)), `${rotulo.nome} ${feminino ? "arquivada" : "arquivado"}.`)}
              disabled={motivoDeAdmin !== undefined}
              disabledReason={motivoDeAdmin ?? ""}
            >
              Arquivar
            </Button>
          ) : null}
          {proprio === "arquivado" ? (
            <Button
              size="sm"
              icon={<Icone de={ArchiveRestore} tamanho="xs" />}
              onClick={() => report(run((data, me) => unarchiveContainer(data, me, kind, container.id)), `${rotulo.nome} ${feminino ? "desarquivada" : "desarquivado"}.`)}
              disabled={motivoDeAdmin !== undefined}
              disabledReason={motivoDeAdmin ?? ""}
            >
              Desarquivar
            </Button>
          ) : null}
          {proprio !== "naLixeira" ? (
            <Button
              size="sm"
              variant="danger"
              icon={<Icone de={Trash2} tamanho="xs" />}
              onClick={() => setConfirmandoLixeira(true)}
              disabled={motivoDeLixeira !== undefined}
              disabledReason={motivoDeLixeira ?? ""}
            >
              Enviar à lixeira
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="primary"
                icon={<Icone de={Undo2} tamanho="xs" />}
                onClick={() => report(run((data, me) => restoreContainer(data, me, kind, container.id)), `${rotulo.nome} ${feminino ? "restaurada" : "restaurado"}.`)}
                disabled={motivoDeLixeira !== undefined}
                disabledReason={motivoDeLixeira ?? ""}
              >
                Restaurar
              </Button>
              <Link href="/configuracoes/lixeira" className="btn btn-fantasma btn-sm">
                Abrir a Lixeira
              </Link>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmandoLixeira}
        title={`Enviar ${rotulo.a} ${rotulo.nome} “${container.name}” à lixeira?`}
        description={`Tudo o que está abaixo vai junto e volta junto ao restaurar. Fica ${retencao} dias na lixeira antes da eliminação.`}
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          setConfirmandoLixeira(false);
          report(run((data, me) => trashContainer(data, me, kind, container.id)), `${rotulo.nome} ${feminino ? "enviada" : "enviado"} à lixeira.`);
        }}
        onCancel={() => setConfirmandoLixeira(false)}
      />
    </Painel>
  );
}
