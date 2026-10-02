"use client";

/**
 * NOVO GRUPO — a Ferramenta `criar Grupo` (24, 12.1): Nome, Descrição, o
 * Canal administrador (só WhatsApp conectado), a Comunidade (opcional, do
 * mesmo Canal), QUEM ENTRA, as Configurações do Grupo e a Captação. Montado
 * só enquanto aberto, para o estado nascer limpo a cada abertura.
 *
 * Quem entra (2026-09-28: "quero que tenha como selecionar os contatos que
 * entrarão de adm, o contato que irá ser o criador do grupo e uma lista de
 * contatos para enviar o link do grupo para entrar como participante"),
 * sempre entre os Contatos com identidade de WhatsApp:
 *  - o CRIADOR do grupo (C40): um Contato, que entra como administrador e fica
 *    registrado como criador (no WhatsApp quem executa a criação é o Canal);
 *  - os ADMINISTRADORES, que entram já administrando;
 *  - os PARTICIPANTES adicionados direto, como membros;
 *  - os que recebem o LINK DE CONVITE numa Conversa com o Canal
 *    (`enviarLinkDeConvite`) e entram quando abrirem.
 * Um Contato tem um papel só: cada lista oferece quem ainda não foi escolhido
 * num papel acima, e escolher alguém num papel o tira dos de baixo.
 *
 * A APARÊNCIA e a PRÉVIA (2026-09-29: "mude o design do card de criação de
 * grupo, quero um preview de como vai ficar o grupo, mostrando nome, foto e
 * capa, quero que tenha como fazer essas personalizações já aqui, fazer
 * upload da foto do grupo e afins"): o diálogo é extra largo, com o
 * formulário à esquerda e, à direita, a `PreviaDoGrupo` presa no topo
 * enquanto o formulário rola — ela se atualiza a cada tecla e a cada escolha.
 * A foto (quadrada, espelhada no WhatsApp) e a capa (3:1, só da plataforma —
 * C41) sobem aqui mesmo, pelos campos da Aparência ou clicando na prévia.
 */

import { useId, useState } from "react";
import { Lock, Megaphone, ShieldCheck, UserPlus, Link2 } from "lucide-react";
import { useData, useRun } from "@/dados/store";
import { CONFIGURACOES_PADRAO_DO_GRUPO, criarGrupo, enviarLinkDeConvite, recusaDoCanal, recusaExternaNaComunidade, type ImagemDoGrupo } from "@n1/dominio/operations";
import { contactDisplayName } from "@n1/dominio/derive";
import { contatosComWhatsApp, noLimiteDeGrupos } from "@n1/dominio/derive-ferramentas";
import type { ConfiguracoesDoGrupo } from "@n1/dominio/types";
import { marcarChegada } from "@/features/shell/recente";
import { ConfirmDialog, Field, MultiSelect, Select, TextArea, TextInput } from "@/features/shell/ui";
import { CampoDeImagem, PreviaDoGrupo, type PapelNaPrevia } from "./aparencia-do-grupo";
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
  const [criador, setCriador] = useState("");
  const [administradores, setAdministradores] = useState<readonly string[]>([]);
  const [participantes, setParticipantes] = useState<readonly string[]>([]);
  const [convidados, setConvidados] = useState<readonly string[]>([]);
  const [foto, setFoto] = useState<ImagemDoGrupo | null>(null);
  const [capa, setCapa] = useState<ImagemDoGrupo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Os campos de arquivo têm id fixo: os rótulos da prévia apontam para eles.
  const idDaFoto = useId();
  const idDaCapa = useId();

  // Um papel por Contato: escolher num papel tira dos de baixo.
  const sem = (lista: readonly string[], fora: readonly string[]) => lista.filter((id) => !fora.includes(id));
  const escolherCriador = (id: string) => {
    setCriador(id);
    if (!id) return;
    setAdministradores((atual) => sem(atual, [id]));
    setParticipantes((atual) => sem(atual, [id]));
    setConvidados((atual) => sem(atual, [id]));
  };
  const escolherAdministradores = (ids: readonly string[]) => {
    setAdministradores(ids);
    setParticipantes((atual) => sem(atual, ids));
    setConvidados((atual) => sem(atual, ids));
  };
  const escolherParticipantes = (ids: readonly string[]) => {
    setParticipantes(ids);
    setConvidados((atual) => sem(atual, ids));
  };
  const contatos = contatosComWhatsApp(state).map((c) => ({
    value: c.id,
    label: contactDisplayName(c),
    detail: c.identifiers.find((i) => i.type === "identidadeDeWhatsApp")?.displayValue ?? "",
  }));
  const livresPara = (fora: readonly string[]) => contatos.filter((c) => !fora.includes(c.value));
  const acimaDosParticipantes = [...(criador ? [criador] : []), ...administradores];

  // Quem a prévia lista: o Canal (o primeiro participante, administrador) e,
  // na ordem dos papéis, o criador, os administradores e os adicionados.
  const canal = canais.find((c) => c.id === canalId);
  const nomeDe = (id: string) => contatos.find((c) => c.value === id)?.label ?? "Contato";
  const pessoasDaPrevia: Array<{ readonly id: string; readonly nome: string; readonly papel: PapelNaPrevia }> = [
    ...(canal ? [{ id: canal.id, nome: canal.name, papel: "canal" as const }] : []),
    ...(criador ? [{ id: criador, nome: nomeDe(criador), papel: "criador" as const }] : []),
    ...administradores.map((id) => ({ id, nome: nomeDe(id), papel: "administrador" as const })),
    ...participantes.map((id) => ({ id, nome: nomeDe(id), papel: "membro" as const })),
  ];

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
        ...(criador ? { contatoCriadorId: criador } : {}),
        administradoresContactIds: administradores,
        participantesIniciaisContactIds: participantes,
        ...(foto ? { foto } : {}),
        ...(capa ? { capa } : {}),
        captacao: { estado: captacaoAtiva ? "ativa" : "inativa", ...(limiteNumero !== undefined && limiteNumero > 0 ? { limiteDeCliques: limiteNumero } : {}) },
      }),
    );
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    // O Grupo já existe: o link vai a cada convidado, e o resultado aparece
    // dentro da ficha que abre em seguida (um aviso da página ficaria atrás
    // do véu dela).
    if (convidados.length > 0) {
      const envio = run((data, me) => enviarLinkDeConvite(data, me, r.value.id, convidados));
      const texto = !envio.ok
        ? `Grupo criado, mas o link de convite não saiu: ${envio.error}`
        : envio.value.falhas.length === 0
          ? `Grupo criado. Link de convite enviado a ${envio.value.enviados.map(nomeDe).join(", ")}.`
          : `Grupo criado. Link de convite enviado a ${envio.value.enviados.length}; não saiu para ${envio.value.falhas.length}: ${envio.value.falhas.map((f) => f.motivo).join(" ")}`;
      marcarChegada("/ferramentas/grupos", texto);
    }
    onCreated(r.value.id);
  };

  return (
    <ConfirmDialog
      open
      title="Novo Grupo"
      description="O provedor cria o grupo pelo Canal administrador; a plataforma grava o Identificador externo e passa a espelhá-lo. Captação nasce ativa (24, 12.1)."
      confirmLabel="Criar Grupo"
      extraLargo
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      <div className="novo-grupo">
      <div className="novo-grupo-formulario">
        {/* ── aparência: o que a prévia mostra ── */}
        <section className="grid gap-4" aria-labelledby="novo-grupo-aparencia">
          <p id="novo-grupo-aparencia" className="app-coluna">
            Aparência
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoDeImagem
              inputId={idDaFoto}
              formato="foto"
              rotulo="Foto do grupo"
              dica="JPG, PNG ou WebP, a partir de 192 px. Recortada em quadrado; o WhatsApp mostra em círculo."
              imagem={foto}
              aoMudar={setFoto}
            />
            <CampoDeImagem
              inputId={idDaCapa}
              formato="capa"
              rotulo="Capa"
              dica="Recortada em 3:1. Só na plataforma: o WhatsApp não tem capa de grupo."
              imagem={capa}
              aoMudar={setCapa}
            />
          </div>
          <Field label="Nome" required hint="Até 100 caracteres, o limite do provedor.">
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Turma Full Face #04" />}
          </Field>
          <Field label="Descrição" hint="Aparece no grupo, para quem entra.">
            {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} rows={2} placeholder="Para que serve este grupo" />}
          </Field>
        </section>

        {/* ── o Canal que cria e a Comunidade ── */}
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        {/* ── quem entra: um papel por Contato, só Contatos com WhatsApp ── */}
        <section className="grid gap-3" aria-labelledby="novo-grupo-quem-entra">
          <p id="novo-grupo-quem-entra" className="app-coluna">
            Quem entra no grupo
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Criador do grupo" hint="Opcional. Entra como administrador e fica registrado como criador. No WhatsApp, quem cria o grupo é o Canal administrador.">
              {(id) => (
                <Select id={id} value={criador} onChange={escolherCriador} searchable placeholder="Nenhum" options={[{ value: "", label: "Nenhum" }, ...contatos]} />
              )}
            </Field>
            <Field label="Administradores" hint="Entram já administrando o grupo.">
              {(id) => (
                <MultiSelect id={id} values={administradores} onChange={escolherAdministradores} placeholder="Escolher Contatos" options={livresPara(criador ? [criador] : [])} />
              )}
            </Field>
            <Field label="Participantes adicionados" hint="Entram direto, como membros. O provedor exige que o Canal “tenha o contato”.">
              {(id) => (
                <MultiSelect id={id} values={participantes} onChange={escolherParticipantes} placeholder="Escolher Contatos" options={livresPara(acimaDosParticipantes)} />
              )}
            </Field>
            <Field
              label="Enviar o link de convite para"
              hint={
                configuracoes.administradoresAprovamEntrada
                  ? "Recebem o link numa Conversa com o Canal. Com “Administradores aprovam entrada”, quem abrir vira Pedido de Entrada."
                  : "Recebem o link numa Conversa com o Canal e entram como participantes quando abrirem."
              }
            >
              {(id) => (
                <MultiSelect
                  id={id}
                  values={convidados}
                  onChange={setConvidados}
                  placeholder="Escolher Contatos"
                  options={livresPara([...acimaDosParticipantes, ...participantes])}
                />
              )}
            </Field>
          </div>
        </section>

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

      {/* ── a prévia, presa no topo enquanto o formulário rola ── */}
      <aside className="novo-grupo-previa" aria-label="Como o grupo vai ficar">
        <PreviaDoGrupo
          nome={nome}
          descricao={descricao}
          foto={foto?.url}
          capa={capa?.url}
          idDaFoto={idDaFoto}
          idDaCapa={idDaCapa}
          comunidade={comunidades.find((c) => c.id === comunidadeId)?.nome}
          somenteAdministradoresEnviam={configuracoes.somenteAdministradoresEnviam}
          administradoresAprovamEntrada={configuracoes.administradoresAprovamEntrada}
          captacaoAtiva={captacaoAtiva}
          pessoas={pessoasDaPrevia}
          convidados={convidados.length}
        />
      </aside>
      </div>
    </ConfirmDialog>
  );
}
