// INÍCIO — governador.js
import fetch from "node-fetch";

export async function cmdGovernador(sock, { from, texto }, args = []) {
  try {
    const nome = args.join(" ").trim();

    if (!nome) {
      await sock.sendMessage(from, { text: "❗ Use: *!governador nome*" });
      return;
    }

    // API pública do TSE — lista de governadores eleitos
    const url = "https://resultados.tse.jus.br/oficial/ele2022/544/dados-simplificados/governador/c0001-e000544-r.json";

    const dados = await (await fetch(url)).json();

    const candidato = dados.cand.find(c =>
      c.nm.toLowerCase().includes(nome.toLowerCase())
    );

    if (!candidato) {
      await sock.sendMessage(from, {
        text: `❌ Nenhum governador encontrado parecido com: *${nome}*`
      });
      return;
    }

    const nomeGov = candidato.nm;
    const partido = candidato.cc;

    const resposta = `
🟨 *Zeffa investigou o Governador ${nomeGov}:*

🏛️ *Partido:* ${partido}
📍 *Estado:* ${candidato.uf}

💰 *Gastos completos do governo estadual NÃO são padronizados nacionalmente.*

➡ Cada estado tem um Portal da Transparência próprio.  
➡ Posso integrar: só me dizer qual estado. 😉

📌 *Fonte:* TSE — Eleições 2022`;

    await sock.sendMessage(from, { text: resposta });
  } catch (err) {
    console.error("Erro governador:", err);
    await sock.sendMessage(from, { text: "❌ Erro ao consultar governador!" });
  }
}
// FIM — governador.js