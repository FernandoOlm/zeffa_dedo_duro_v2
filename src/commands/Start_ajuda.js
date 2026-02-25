// INÍCIO Start_ajuda.js
import fs from "fs";
import path from "path";

export async function Start_Ajuda(msg, sock) {
  try {
    const helpPath = path.resolve("src/data/help.json");
    const raw = fs.readFileSync(helpPath, "utf8");
    const help = JSON.parse(raw);

    let texto = "📘 *Painel de Ajuda — Ferdinando IA*\n\n";
    texto += "Fala, campeão! Aqui vai o *manual oficial* pra usar meus comandos:\n\n";

    for (const categoria of help.categorias) {
      texto += `🔹 *${categoria.titulo}*\n`;

      for (const c of categoria.comandos) {
        texto += `• *${c.cmd}* — ${c.desc}\n`;
      }

      texto += "\n";
    }

    return {
      tipo: "mensagem_pura",
      texto: texto.trim()
    };

  } catch (e) {
    console.log("Erro no Start_Ajuda:", e);
    return {
      tipo: "erro",
      mensagem: "Erro ao carregar painel de ajuda."
    };
  }
}
// FIM Start_ajuda.js
