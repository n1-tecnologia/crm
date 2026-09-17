"use client";

/**
 * NOVO GRUPO — a Ferramenta `criar Grupo` (24, 12.1): Nome, Descrição, o
 * Canal administrador (só WhatsApp conectado), a Comunidade (opcional, do
 * mesmo Canal), as Configurações do Grupo, a Captação e os participantes
 * iniciais (Contatos com identidade de WhatsApp). Montado só enquanto
 * aberto, para o estado nascer limpo a cada abertura.
 */

import { useState } from "react";
import { Lock, Megaphone, ShieldCheck, UserPlus, Link2 } from "lucide-react";
import { useData, useRun } from "@/data/store";
import { CONFIGURACOES_PADRAO_DO_GRUPO, criarGrupo, recusaDoCanal, recusaExternaNaComunidade } from "@/data/operations";
import { contactDisplayName } from "@/data/derive";
import { contatosComWhatsApp, noLimiteDeGrupos } from "@/data/derive-ferramentas";
import type { ConfiguracoesDoGrupo } from "@/data/types";
import { ConfirmDialog, Field, MultiSelect, Select, TextArea, TextInput } from "@/features/shell/ui";
import { CaixaDeConfiguracoes } from "./caixa-de-configuracoes";
import { CONFIGURACAO_DO_GRUPO_LABEL } from "./rotulos";

export function CriarGrupoDialog({ open, onClose, onCreated }: { readonly open: boolean; readonly onClose: () => void; readonly onCreated: (grupoId: string) => void }) {
  if (!open) return null;
  return <Formulario onClose={onClose} onCreated={onCreated} />;
}

const ICONE_DA_CONFIGURACAO = {
  somenteAdministradoresEnviam: Megaphone,
  somenteAdministradoresEditamDados: Lock,
  administradoresAprovamEntrada: ShieldCheck,
  somenteAdministradoresAdicionamParticipantes: UserPlus,
} as const;

function Formulario({ onClose, onCreated }: { readonly onClose: () => void; readonly onCreated: (grupoId: string) => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const canais = state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [canalId, setCanalId] = useState(canais.find((c) => c.connection === "conectada")?.id ?? "");
  const [comunidadeId, setComunidadeId] = useState("");
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesDoGrupo>(CONFIGURACOES_PADRAO_DO_GRUPO);
  const [captacaoAtiva, setCaptacaoAtiva] = useState(true);
  const [limite, setLimite] = useState("");
  const [participantes, setParticipantes] = useState<readonly string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const recusaCanal = recusaDoCanal(state, canalId || undefined, "gruposAdministraveis");
  const comunidades = state.comunidades.filter((c) => c.lifecycle !== "naLixeira");
  const limiteNumero = limite.trim() === "" ? undefined : Number(limite);
  const limiteInvalido = limiteNumero !== undefined && !(Number.isInteger(limiteNumero) && limiteNumero >= 0);
  const motivo = !nome.trim() ? "Dê um nome ao Grupo." : recusaCanal ? recusaCanal : limiteInvalido ? "O Limite de cliques é um inteiro maior ou igual a zero." : undefined;

  const confirmar = () => {
    const r = run((data, me) =>
      criarGrupo(data, me, {
        nome,
        descricao,
        canalId,
        configuracoes,
        ...(comunidadeId ? { comunidadeId } : {}),
        participantesIniciaisContactIds: participantes,
        captacao: { estado: captacaoAtiva ? "ativa" : "inativa", ...(limiteNumero !== undefined && limiteNumero > 0 ? { limiteDeCliques: limiteNumero } : {}) },
      }),
    );
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    onCreated(r.value.id);
  };

  return (
    <ConfirmDialog
      open
      title="Novo Grupo"
      description="O provedor cria o grupo pelo Canal administrador; a plataforma grava o Identificador externo e passa a espelhá-lo. Captação nasce ativa (24, 12.1)."
      confirmLabel="Criar Grupo"
      wide
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required hint="Até 100 caracteres — o limite do provedor.">
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Turma Full Face #04" />}
          </Field>
          <Field label="Canal administrador" required hint="Só um Canal de WhatsApp conectado chega ao provedor.">
            {(id) => (
              <Select
                id={id}
                value={canalId}
                onChange={setCanalId}
                placeholder="Escolher o Canal"
                options={canais.map((c) => {
                  const recusa = recusaDoCanal(state, c.id, "gruposAdministraveis");
                  return { value: c.id, label: c.name, detail: c.connection === "conectada" ? "conectado" : c.connection, ...(recusa ? { disabledReason: recusa } : {}) };
                })}
              />
            )}
          </Field>
        </div>
        <Field label="Descrição" hint="Aparece no grupo, para quem entra.">
          {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} rows={2} placeholder="Para que serve este grupo" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Comunidade" hint="Opcional. O Grupo nasce já vinculado, como Grupo comum.">
            {(id) => (
              <Select
                id={id}
                value={comunidadeId}
                onChange={setComunidadeId}
                placeholder="Nenhuma"
                options={[
                  { value: "", label: "Nenhuma" },
                  ...comunidades.map((c) => {
                    const motivoC = c.lifecycle !== "ativo" ? "A Comunidade não está ativa." : (recusaExternaNaComunidade(state, c, "administrador") ?? (c.canalId !== canalId ? "Administrada por outro Canal (INV-COM-03)." : noLimiteDeGrupos(state, c) ? `No limite de ${c.limiteDeGruposDoProvedor} Grupos (INV-COM-05).` : undefined));
                    return { value: c.id, label: c.nome, ...(motivoC ? { disabledReason: motivoC } : {}) };
                  }),
                ]}
              />
            )}
          </Field>
          <Field label="Participantes iniciais" hint="Contatos com identidade de WhatsApp; o provedor exige que o Canal “tenha o contato”.">
            {(id) => (
              <MultiSelect
                id={id}
                values={participantes}
                onChange={setParticipantes}
                placeholder="Escolher Contatos"
                options={contatosComWhatsApp(state).map((c) => ({ value: c.id, label: contactDisplayName(c), detail: c.identifiers.find((i) => i.type === "identidadeDeWhatsApp")?.displayValue ?? "" }))}
              />
            )}
          </Field>
        </div>

        <CaixaDeConfiguracoes
          rotulo="Configurações do Grupo"
          linhas={(Object.keys(CONFIGURACAO_DO_GRUPO_LABEL) as Array<keyof ConfiguracoesDoGrupo>).map((chave) => ({
            chave,
            titulo: CONFIGURACAO_DO_GRUPO_LABEL[chave].titulo,
            dica: CONFIGURACAO_DO_GRUPO_LABEL[chave].dica,
            icone: ICONE_DA_CONFIGURACAO[chave],
            ligado: configuracoes[chave],
            onChange: (v) => setConfiguracoes((atual) => ({ ...atual, [chave]: v })),
          }))}
          ajuda="Espelhadas no provedor: mudar depois é Ferramenta com efeito lá (RN-GRP-03)."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CaixaDeConfiguracoes
            rotulo="Captação"
            linhas={[{ chave: "captacao", titulo: "Captação ativa", dica: "Os Links de Captação podem mandar cliques para cá.", icone: Link2, ligado: captacaoAtiva, onChange: setCaptacaoAtiva }]}
          />
          <Field label="Limite de cliques" hint="Vazio ou zero = sem limite. Só os Links “por cliques” o usam.">
            {(id) => <TextInput id={id} value={limite} onChange={setLimite} type="number" placeholder="Por exemplo: 100" invalid={limiteInvalido} />}
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
