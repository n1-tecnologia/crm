"use client";

/**
 * A APARÊNCIA DO GRUPO (2026-09-29: "quero um preview de como vai ficar o
 * grupo, mostrando nome, foto e capa, quero que tenha como fazer essas
 * personalizações já aqui, fazer upload da foto do grupo e afins").
 *
 *  - `FotoDoGrupo`: a foto em círculo, ou o ícone de grupo quando não há.
 *  - `CampoDeImagem`: o arquivo escondido (o rótulo é o botão), a miniatura na
 *    proporção do formato, Trocar e Remover, e o erro dito ali mesmo.
 *  - `PreviaDoGrupo`: como o grupo vai ficar — a capa (só da plataforma, C41),
 *    a foto sobre ela, o nome, "Grupo · N participantes", a descrição, as
 *    marcas das configurações e quem entra, com o papel de cada um. A capa e
 *    a foto da prévia também abrem o seletor de arquivo (rótulos dos mesmos
 *    campos do formulário).
 */

import { useState } from "react";
import { Crown, Image as ImageIcon, ImagePlus, Link2, Lock, Megaphone, Radio, ShieldCheck, Trash2, Users, type LucideIcon } from "lucide-react";
import type { ImagemDoGrupo } from "@/data/operations";
import { Button, Icone, Pilula } from "@/features/shell/ui";
import { ACEITA_IMAGEM, prepararImagem, type FormatoDaImagem } from "./imagem-do-grupo";

/** A foto do grupo em círculo (ou o ícone de grupo). Decorativa quando o nome já está ao lado. */
export function FotoDoGrupo({ url, nome, tamanho }: { readonly url?: string | undefined; readonly nome: string; readonly tamanho: "ficha" | "previa" }) {
  return (
    <span className="grupo-foto" data-tamanho={tamanho}>
      {url ? (
        // Imagem local (data URL) do armazém da sessão: não há otimização remota a fazer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Foto do grupo ${nome}`} />
      ) : (
        <Icone de={Users} tamanho={tamanho === "previa" ? "lg" : "md"} />
      )}
    </span>
  );
}

/**
 * Um campo de imagem do formulário. O `<input type="file">` fica escondido e o
 * rótulo estilizado como botão o abre; o foco do teclado chega no input e o
 * anel aparece no rótulo (`peer`).
 */
export function CampoDeImagem({
  inputId,
  formato,
  rotulo,
  dica,
  imagem,
  aoMudar,
}: {
  /** O id do input: a prévia usa o mesmo id nos rótulos dela. */
  readonly inputId: string;
  readonly formato: FormatoDaImagem;
  readonly rotulo: string;
  readonly dica: string;
  readonly imagem: ImagemDoGrupo | null;
  readonly aoMudar: (imagem: ImagemDoGrupo | null) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setLendo(true);
    setErro(null);
    try {
      aoMudar(await prepararImagem(arquivo, formato));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para usar esta imagem.");
    } finally {
      setLendo(false);
    }
  };
  return (
    <div className="campo-de-imagem">
      <span className="app-sm campo-de-imagem-rotulo">{rotulo}</span>
      <div className="campo-de-imagem-linha">
        <span className="campo-de-imagem-miniatura" data-formato={formato} aria-hidden="true">
          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagem.url} alt="" />
          ) : (
            <Icone de={ImageIcon} tamanho="sm" />
          )}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <input
            id={inputId}
            type="file"
            accept={ACEITA_IMAGEM}
            aria-label={imagem ? `Trocar ${rotulo.toLocaleLowerCase("pt-BR")}` : `Enviar ${rotulo.toLocaleLowerCase("pt-BR")}`}
            className="peer sr-only"
            onChange={(evento) => {
              void escolher(evento.target.files?.[0]);
              // O mesmo arquivo de novo também dispara (depois de Remover, por exemplo).
              evento.target.value = "";
            }}
          />
          <label htmlFor={inputId} className="btn btn-fantasma btn-sm cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--linha-acento-forte)]">
            <Icone de={ImagePlus} tamanho="xs" />
            {lendo ? "Preparando…" : imagem ? "Trocar" : "Enviar imagem"}
          </label>
          {imagem ? (
            <Button variant="ghost" size="sm" icon={<Icone de={Trash2} tamanho="xs" />} onClick={() => aoMudar(null)}>
              Remover
            </Button>
          ) : null}
        </span>
      </div>
      {erro ? (
        <p role="alert" className="app-meta" style={{ color: "var(--erro)" }}>
          {erro}
        </p>
      ) : (
        <p className="app-meta">{dica}</p>
      )}
    </div>
  );
}

export type PapelNaPrevia = "canal" | "criador" | "administrador" | "membro";

const PAPEL: Record<PapelNaPrevia, { readonly rotulo: string; readonly icone: LucideIcon; readonly tom: "info" | "acento" | "neutro" }> = {
  canal: { rotulo: "Canal · admin", icone: Radio, tom: "info" },
  criador: { rotulo: "Criador", icone: Crown, tom: "acento" },
  administrador: { rotulo: "Admin", icone: ShieldCheck, tom: "acento" },
  membro: { rotulo: "Membro", icone: Users, tom: "neutro" },
};

/** Quantas pessoas a prévia lista antes do "e mais N". */
const PESSOAS_A_MOSTRAR = 6;

const iniciais = (nome: string): string =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toLocaleUpperCase("pt-BR") ?? "")
    .join("");

export function PreviaDoGrupo({
  nome,
  descricao,
  foto,
  capa,
  idDaFoto,
  idDaCapa,
  comunidade,
  somenteAdministradoresEnviam,
  administradoresAprovamEntrada,
  captacaoAtiva,
  pessoas,
  convidados,
}: {
  readonly nome: string;
  readonly descricao: string;
  readonly foto: string | undefined;
  readonly capa: string | undefined;
  readonly idDaFoto: string;
  readonly idDaCapa: string;
  readonly comunidade: string | undefined;
  readonly somenteAdministradoresEnviam: boolean;
  readonly administradoresAprovamEntrada: boolean;
  readonly captacaoAtiva: boolean;
  readonly pessoas: ReadonlyArray<{ readonly id: string; readonly nome: string; readonly papel: PapelNaPrevia }>;
  /** Quantos recebem o link de convite (ainda não entraram). */
  readonly convidados: number;
}) {
  const titulo = nome.trim() || "Nome do grupo";
  const mostradas = pessoas.slice(0, PESSOAS_A_MOSTRAR);
  return (
    <figure className="previa-do-grupo" aria-label="Prévia do grupo">
      <label htmlFor={idDaCapa} className="previa-do-grupo-capa" title={capa ? "Trocar a capa" : "Enviar a capa"}>
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capa} alt="Capa do grupo" />
        ) : (
          <span className="previa-do-grupo-capa-vazia">
            <Icone de={ImagePlus} tamanho="sm" />
            <span className="app-xs">Capa</span>
          </span>
        )}
      </label>
      <label htmlFor={idDaFoto} className="previa-do-grupo-foto" title={foto ? "Trocar a foto" : "Enviar a foto"}>
        <FotoDoGrupo url={foto} nome={titulo} tamanho="previa" />
      </label>

      <div className="previa-do-grupo-corpo">
        <p className="ed-subtitulo previa-do-grupo-nome" data-vazio={nome.trim() ? undefined : ""}>
          {titulo}
        </p>
        <p className="app-sm previa-do-grupo-contagem">
          Grupo · {pessoas.length} {pessoas.length === 1 ? "participante" : "participantes"}
        </p>
        <p className="app-sm previa-do-grupo-descricao" data-vazio={descricao.trim() ? undefined : ""}>
          {descricao.trim() || "Sem descrição"}
        </p>

        {comunidade || somenteAdministradoresEnviam || administradoresAprovamEntrada || captacaoAtiva ? (
          <div className="previa-do-grupo-marcas">
            {comunidade ? <Pilula tom="info">{comunidade}</Pilula> : null}
            {somenteAdministradoresEnviam ? (
              <Pilula tom="neutro">
                <Icone de={Megaphone} tamanho="xs" /> Só admins enviam
              </Pilula>
            ) : null}
            {administradoresAprovamEntrada ? (
              <Pilula tom="neutro">
                <Icone de={Lock} tamanho="xs" /> Entrada aprovada
              </Pilula>
            ) : null}
            {captacaoAtiva ? (
              <Pilula tom="sucesso">
                <Icone de={Link2} tamanho="xs" /> Captação ativa
              </Pilula>
            ) : null}
          </div>
        ) : null}

        <p className="app-coluna previa-do-grupo-secao">Participantes</p>
        <ul className="previa-do-grupo-pessoas">
          {mostradas.map((pessoa) => {
            const papel = PAPEL[pessoa.papel];
            return (
              <li key={pessoa.id} className="previa-do-grupo-pessoa">
                <span className="previa-do-grupo-iniciais" aria-hidden="true">
                  {pessoa.papel === "canal" ? <Icone de={Radio} tamanho="xs" /> : iniciais(pessoa.nome)}
                </span>
                <span className="app-sm min-w-0 flex-1 truncate">{pessoa.nome}</span>
                {pessoa.papel !== "membro" ? (
                  <Pilula tom={papel.tom}>
                    <Icone de={papel.icone} tamanho="xs" /> {papel.rotulo}
                  </Pilula>
                ) : null}
              </li>
            );
          })}
        </ul>
        {pessoas.length > PESSOAS_A_MOSTRAR ? <p className="app-meta">e mais {pessoas.length - PESSOAS_A_MOSTRAR}</p> : null}
        {convidados > 0 ? (
          <p className="app-sm previa-do-grupo-convite">
            <Icone de={Link2} tamanho="xs" /> Link de convite para {convidados} {convidados === 1 ? "Contato" : "Contatos"}
          </p>
        ) : null}
      </div>
      <figcaption className="app-xs previa-do-grupo-legenda">
        Prévia. No WhatsApp aparecem a foto, o nome e a descrição; a capa fica só na plataforma.
      </figcaption>
    </figure>
  );
}
