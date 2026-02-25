// INÍCIO — Imports básicos
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";

import { cmdDeputado } from "../commands/deputado.js";
import { comandoPing } from "../commands/ping.js";
// FIM — Imports

// BOT
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") console.log("🔥 Bot conectado!");
    if (connection === "close") {
      console.log("❌ Caiu — reconectando...");
      startBot();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message) return;
    if (msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    console.log("📥 Mensagem:", texto);

    // --- comando !ping ---
    if (texto.startsWith("!ping")) {
      const resposta = await comandoPing();
      await sock.sendMessage(jid, { text: resposta });
      return;
    }

    // --- comando !deputado <nome> ---
    if (texto.startsWith("!deputado")) {
      const nome = texto.replace("!deputado", "").trim();
      if (!nome) {
        await sock.sendMessage(jid, { text: "Use: !deputado NOME" });
        return;
      }

      await sock.sendMessage(jid, { text: `🔎 Buscando deputado: *${nome}*` });

      const resposta = await cmdDeputado(nome);
      await sock.sendMessage(jid, { text: resposta });
      return;
    }
  });
}

startBot();