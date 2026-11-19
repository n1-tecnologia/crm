# Itens adiados da Fase 17

## 17-04

- `apps/api/src/mensageria/provedores/whatsapp-cloud/whatsapp-cloud.test.ts` > "conectar pelo token > sem a integração
  configurada, 503 dizendo o que falta" falha neste ambiente: a mensagem devolvida é "A integração com o WhatsApp oficial
  não está configurada neste ambiente." e o teste espera que ela contenha `META_APP_SECRET`. Não toca nada do 17-04
  (arquivo da Sessão 7); apareceu ao rodar `src/persistencia` e `src/mensageria` no Postgres local. Não investigado.
