/** Encerra a sessão. É POST porque encerrar sessão muda estado; a rota redireciona para `/entrar`. */
export function sair(): void {
  const form = document.createElement("form");
  form.method = "post";
  form.action = "/sair";
  document.body.appendChild(form);
  form.submit();
}
