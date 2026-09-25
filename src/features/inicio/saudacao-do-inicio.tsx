"use client";

/**
 * A SAUDAÇÃO do Início (2026-09-24: "em algum lugar na tela, quero a mensagem
 * de bom dia, boa tarde, boa noite com o nome do usuário"): no alto, à
 * esquerda do palco — o vazio ao lado da cabeça do robô —, "Boa tarde," e o
 * primeiro nome do Membro no acento. A hora é a do Espaço de Trabalho
 * (`saudacao`, no fuso dele: Boa noite 0–4 h e 18 h+, Bom dia 5–11 h, Boa
 * tarde 12–17 h), conferida a cada minuto.
 *
 * Depende da hora: só aparece depois da hidratação (o HTML do servidor não
 * sabe a hora do navegador, e os dois lados têm de bater).
 */

import { useEffect, useState } from "react";
import { useCurrentMember, useData } from "@/data/store";
import { useHidratado } from "@/features/shell/hidratado";
import { saudacao } from "@/features/shell/relogio";

/** De quanto em quanto a saudação confere a hora (ms): troca na virada da hora. */
const CONFERIR_A_CADA = 60_000;

export function SaudacaoDoInicio() {
  const hidratado = useHidratado();
  const membro = useCurrentMember();
  const fuso = useData((dados) => dados.workspace.locale.timezone);
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(new Date()), CONFERIR_A_CADA);
    return () => window.clearInterval(relogio);
  }, []);

  if (!hidratado) return null;
  const nome = membro?.displayName.trim().split(/\s+/)[0] ?? "";
  return (
    <p className="ed-titulo inicio-saudacao aparecer">
      {saudacao(agora, fuso)}
      {nome ? (
        <>
          , <span className="inicio-saudacao-nome">{nome}</span>
        </>
      ) : null}
    </p>
  );
}
