// INÍCIO — presidente.js
import fetch from "node-fetch";

export async function cmdPresidente(sock, { from, texto }, args = []) {
  try {
    const nome = "Presidente da República";

    // Gastos de cartão corporativo agregado (sem chave API só tem somatório)
    const url = "https://portaldatransparencia.gov.br/api-de-dados/cartoes";

    const dados = await (await fetch(url)).text();

    // Como sem API key não retorna JSON, apenas indicamos que precisa habilitar depois:
    const resposta = `
🟩 *Zeffa investigou o Presidente da República:*

💰 *Gastos detalhados do cartão corporativo NÃO estão disponíveis sem API.*

Para habilitar:
👉 Entre no Portal da Transparência
👉 Gere uma chave API gratuita
👉 Colocaremos no sistema

📌 *Fonte:* Portal da Transparência (acesso público)

Enquanto isso posso exibir:
✔ Viagens oficiais
✔ Agenda pública
✔ Estrutura da presidência

*Quer ativar modo completo?* 😏`;

    await sock.sendMessage(from, { text: resposta });
  } catch (err) {
    console.error("Erro presidente:", err);
    await sock.sendMessage(from, { text: "❌ Erro ao consultar presidente!" });
  }
}
// FIM — presidente.js