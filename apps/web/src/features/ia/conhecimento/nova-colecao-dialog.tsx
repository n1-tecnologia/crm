"use client";

/**
 * NOVA COLEÇÃO (20, 12.1): Nome, Descrição e o interruptor "Privada". Nasce
 * `ativo`, com quem cria como Proprietário e a Fonte Envio manual criada no
 * mesmo ato (RN-CNH-04). Sem Documentos: "Adicionar Documento" vem depois,
 * na ficha.
 */

import { useState } from "react";
import { Lock } from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import { criarColecao, recusaDeConvidado } from "@n1/dominio/operations";
import { CaixaDeConfiguracoes } from "@/features/ferramentas/caixa-de-configuracoes";
import { ConfirmDialog, Field, TextArea, TextInput } from "@/features/shell/ui";

export function NovaColecaoDialog({
  open,
  onClose,
  onDone,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, colecaoId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [privada, setPrivada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // A mesma frase da operação: o botão desligado diz o que `criarColecao` diria.
  const motivo = recusaDeConvidado(state, memberId, "cria Coleção") ?? (nome.trim() ? undefined : "Dê um nome à Coleção.");

  const reset = () => {
    setNome("");
    setDescricao("");
    setPrivada(false);
    setErro(null);
  };

  const confirmar = () => {
    const result = run((data, me) => criarColecao(data, me, { name: nome, description: descricao, isPrivate: privada }));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onDone(`Coleção “${result.value.name}” criada.`, result.value.id);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Nova Coleção"
      description="Nasce com a Fonte Envio manual, que não pode ser removida (RN-CNH-04). Você é o Proprietário; Documentos e Fontes vêm depois, na ficha."
      confirmLabel="Criar e abrir"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-4">
        <Field label="Nome" required>
          {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Playbooks do comercial" />}
        </Field>
        <Field label="Descrição" hint="Para que serve esta Coleção — quem lê a lista decide por aqui.">
          {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} rows={2} placeholder="Uso interno" />}
        </Field>
        <CaixaDeConfiguracoes
          linhas={[
            {
              chave: "privada",
              titulo: "Privada",
              dica: "Só o Proprietário age nela — nem Administradores nem o Proprietário do Espaço de Trabalho entram (17.2). As Concessões a Agentes continuam valendo.",
              icone: Lock,
              ligado: privada,
              onChange: setPrivada,
            },
          ]}
        />
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
