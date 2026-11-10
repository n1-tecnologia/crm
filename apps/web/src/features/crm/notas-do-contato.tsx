"use client";

/**
 * A seção "Notas" da ficha nova de Contato (3.2.7): o que os Membros deixaram
 * escrito sobre o Contato, a mais recente primeiro, e o campo para escrever
 * mais uma. A nota é só texto (D-04) e o autor é o Membro da sessão — a tela
 * não manda autor nem data, a api grava os dois.
 *
 * Lê por `useNotasDoContato` e grava por `adicionarNotaAoContato`
 * (`dados/crm/notas.ts`), que revalida as notas do Contato: a nota nova volta
 * pela mesma leitura. A tela pré-valida com a MESMA `validarNovaNota` que a api
 * aplica (vazia, ou acima do teto); a recusa da api (400 com `campo`, 403, 409
 * de Contato mesclado) aparece no campo ou por `MensagemDeRecusa`, sempre com a
 * frase que a api deu. Quem barra de verdade é o backend: `motivo` só desliga o
 * botão e diz por quê.
 *
 * Todo texto vindo da api é renderizado como texto React (escapado); a quebra
 * de linha da nota é CSS (`whitespace-pre-wrap`), não HTML.
 */

import { useState } from "react";
import type { EstadoDoContato } from "@n1/dominio/crm/contatos";
import { recusaDeNotaNoContato, validarNovaNota, type NotaDoContato } from "@n1/dominio/crm/notas";
import { adicionarNotaAoContato, useNotasDoContato } from "@/dados/crm/notas";
import { useNomeDoMembro } from "@/dados/crm/sessao";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { Button, EmptyState, EsqueletoDeLinhas, Field, Painel, Section, TextArea, Toast } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

/** A nota mais recente primeiro. A api já devolve nessa ordem; reordenar aqui não custa nada e não depende dela. */
function maisRecentePrimeiro(notas: readonly NotaDoContato[]): NotaDoContato[] {
  return [...notas].sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
}

function LinhaDeNota({ nota }: { readonly nota: NotaDoContato }) {
  const fmt = useFormat();
  const nomeDoMembro = useNomeDoMembro();
  return (
    <li className="py-2" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
      <p className="app-meta">{`${nomeDoMembro(nota.autorId)} · ${fmt.instant(nota.criadoEm)}`}</p>
      <p className="app-base whitespace-pre-wrap break-words">{nota.conteudo}</p>
    </li>
  );
}

export function NotasDoContato({
  contatoId,
  estado,
  motivo,
}: {
  readonly contatoId: string;
  readonly estado: EstadoDoContato;
  /** A frase do Papel quando ele não deixa escrever (`usePodeNoCrm`); `undefined` quando deixa. */
  readonly motivo: string | undefined;
}) {
  const lista = useNotasDoContato(contatoId);
  const [texto, setTexto] = useState("");
  const [erroDoCampo, setErroDoCampo] = useState<string | undefined>(undefined);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salva, setSalva] = useState(false);

  const itens = Array.isArray(lista.data?.itens) ? maisRecentePrimeiro(lista.data.itens) : [];
  const total = typeof lista.data?.total === "number" ? lista.data.total : itens.length;
  const semEscrita = motivo ?? recusaDeNotaNoContato({ estado });
  const semTexto = texto.trim() === "";
  const porQueNao = semEscrita ?? (salvando ? "Gravando a nota…" : semTexto ? "Escreva a nota antes de salvar." : undefined);

  const salvar = async () => {
    const validacao = validarNovaNota({ conteudo: texto });
    if (!validacao.ok) {
      setErroDoCampo(validacao.error);
      return;
    }
    setErroDoCampo(undefined);
    setRecusa(null);
    setSalva(false);
    setSalvando(true);
    try {
      await adicionarNotaAoContato(contatoId, validacao.value.conteudo);
      setTexto("");
      setSalva(true);
    } catch (falha) {
      const erro = comoErroDeApi(falha, "Não foi possível salvar a nota. Tente de novo.");
      if (erro.status === 400 && erro.campo === "conteudo") setErroDoCampo(erro.message);
      else setRecusa(erro);
    } finally {
      setSalvando(false);
    }
  };

  const corpo = () => {
    if (lista.data === undefined) {
      if (lista.error) {
        return <EmptyState compact title="Não foi possível carregar as notas." hint={comoErroDeApi(lista.error, "Tente de novo em instantes.").message} />;
      }
      return <EsqueletoDeLinhas quantidade={2} />;
    }
    if (itens.length === 0) return <EmptyState compact title="Nenhuma nota neste Contato." />;
    return (
      <Painel className="px-4">
        <ul>
          {itens.map((nota) => (
            <LinhaDeNota key={nota.id} nota={nota} />
          ))}
        </ul>
        {total > itens.length ? <p className="app-meta py-2">{`Mostrando ${itens.length} de ${total}.`}</p> : null}
      </Painel>
    );
  };

  return (
    <Section title="Notas" {...(lista.data !== undefined ? { count: total } : {})}>
      {salva ? (
        <Toast tone="success" onDismiss={() => setSalva(false)}>
          Nota salva.
        </Toast>
      ) : null}
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      <Painel className="mb-3 grid gap-3 p-4">
        <Field label="Nova nota" {...(erroDoCampo ? { error: erroDoCampo } : {})}>
          {(id) => (
            <TextArea
              id={id}
              value={texto}
              onChange={(valor) => {
                setTexto(valor);
                setErroDoCampo(undefined);
              }}
              rows={3}
              {...(semEscrita ? { disabled: true, disabledReason: semEscrita } : {})}
            />
          )}
        </Field>
        <div>
          <Button variant="primary" onClick={() => void salvar()} {...(porQueNao ? { disabled: true, disabledReason: porQueNao } : {})}>
            Salvar nota
          </Button>
        </div>
      </Painel>
      {corpo()}
    </Section>
  );
}
