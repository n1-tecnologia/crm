"use client";

/**
 * Fase 4 — Formulário público, fora do shell: quem responde não é Membro. O
 * envio chama `submitForm`, que cria a Tarefa em nome do dono do Formulário
 * com Proveniência. Nada da Lista aparece aqui além das perguntas.
 *
 * Fora da casca: título sobre a grade de pontos e um cartão sólido com as
 * perguntas; depois do envio o mesmo lugar vira o recibo.
 */

import { use, useState } from "react";
import { CheckCircle2, FileX } from "lucide-react";
import { useData, useRun } from "@/data/store";
import { useHidratado } from "@/features/shell/app-shell";
import { EsqueletoDeTela } from "@/design/esqueletos";
import { formBySecret, submitForm } from "@/data/operations";
import { Button, EmptyState, Field, Icone, Painel, Select, TextArea, TextInput } from "@/features/shell/ui";

export default function FormularioPublicoPage({ params }: { params: Promise<{ segredo: string }> }) {
  const { segredo } = use(params);
  const run = useRun();
  const form = useData((data) => formBySecret(data, segredo));
  const definitions = useData((data) => data.fieldDefinitions);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState<string | null>(null);
  const [erro, setErro] = useState<{ text: string; field?: string } | null>(null);
  const pronto = useHidratado();

  if (!pronto) return <EsqueletoDeTela forma="formulario" />;

  if (!form || !form.enabled) {
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Painel solido className="p-6">
            <EmptyState
              icon={<Icone de={FileX} tamanho="lg" />}
              title="Formulário indisponível"
              hint={form ? "Este Formulário está pausado. Peça a quem o enviou para reativá-lo." : "Este link não existe mais ou foi renovado. Peça um novo a quem o enviou."}
            />
          </Painel>
        </div>
      </main>
    );
  }

  const faltando = form.questions.find((q) => q.required && !answers[q.id]?.trim());

  return (
    <main className="grade-pontos flex min-h-screen justify-center p-6">
      <div className="grid w-full max-w-lg content-start gap-4">
        <header className="grid gap-1">
          <h1 className="ed-titulo">{form.name}</h1>
          {form.description ? (
            <p className="app-base" style={{ color: "var(--texto-3)" }}>
              {form.description}
            </p>
          ) : null}
        </header>
        {enviado ? (
          <Painel solido role="status" className="flex items-start gap-3 p-6">
            <Icone de={CheckCircle2} tamanho="md" style={{ color: "var(--sucesso)" }} />
            <div className="min-w-0 flex-1">
              <p className="app-md" style={{ color: "var(--texto)" }}>
                Recebido.
              </p>
              <p className="app-base mt-1" style={{ color: "var(--texto-2)" }}>
                “{enviado}” foi registrado. Pode fechar esta página ou enviar outro.
              </p>
              <span className="mt-3 inline-block">
                <Button
                  onClick={() => {
                    setEnviado(null);
                    setAnswers({});
                  }}
                >
                  Enviar outro
                </Button>
              </span>
            </div>
          </Painel>
        ) : (
          <Painel solido className="p-6">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const result = run((data) => submitForm(data, segredo, answers));
                if (result.ok) {
                  setErro(null);
                  setEnviado(result.value.title);
                } else {
                  setErro({ text: result.error, ...(result.field ? { field: result.field } : {}) });
                }
              }}
            >
              {erro ? (
                <p
                  role="alert"
                  className="app-base rounded-[var(--r-controle)] px-3 py-2"
                  style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}
                >
                  {erro.text}
                </p>
              ) : null}
              {form.questions.map((q) => {
                const def = q.target.kind === "field" ? definitions.find((d) => d.id === (q.target as { definitionId: string }).definitionId) : undefined;
                const opcoes = def?.options ?? [];
                return (
                  <Field key={q.id} label={`${q.label}${q.required ? " *" : ""}`} {...(erro?.field === q.id ? { error: erro.text } : {})} {...(def?.type === "multiSelect" ? { hint: "Separe várias opções por vírgula." } : {})}>
                    {(id) =>
                      def?.type === "singleSelect" && opcoes.length > 0 ? (
                        <Select
                          id={id}
                          value={answers[q.id] ?? ""}
                          options={opcoes.map((o) => ({ value: o, label: o }))}
                          onChange={(value) => setAnswers({ ...answers, [q.id]: value })}
                        />
                      ) : def?.type === "checkbox" ? (
                        <Select
                          id={id}
                          value={answers[q.id] ?? ""}
                          options={[
                            { value: "sim", label: "Sim" },
                            { value: "não", label: "Não" },
                          ]}
                          onChange={(value) => setAnswers({ ...answers, [q.id]: value })}
                        />
                      ) : q.target.kind === "description" || def?.type === "longText" ? (
                        <TextArea id={id} value={answers[q.id] ?? ""} onChange={(value) => setAnswers({ ...answers, [q.id]: value })} rows={4} />
                      ) : (
                        <TextInput
                          id={id}
                          value={answers[q.id] ?? ""}
                          onChange={(value) => setAnswers({ ...answers, [q.id]: value })}
                          {...(def?.type === "number" || def?.type === "currency" || def?.type === "percent" ? { type: "number" as const } : def?.type === "email" ? { type: "email" as const } : {})}
                        />
                      )
                    }
                  </Field>
                );
              })}
              <span className="flex justify-end">
                <Button type="submit" variant="primary" disabled={faltando !== undefined} disabledReason={faltando ? `Responda “${faltando.label}”.` : ""}>
                  Enviar
                </Button>
              </span>
              <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                * obrigatório. Cada envio vira uma Tarefa para a equipe responsável.
              </p>
            </form>
          </Painel>
        )}
      </div>
    </main>
  );
}
