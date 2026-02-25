// INÍCIO — Carregar variáveis de ambiente
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega sempre do root do projeto, independente de onde o index.js está
dotenv.config({ path: path.join(__dirname, "../../.env") });
// FIM — ENV

// INÍCIO — Imports básicos
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";

import { cmdDeputado } from "../commands/deputado.js";
import { comandoPing } from "../commands/ping.js";
import { cmdSenador } from "../commands/senador.js";
import { cmdPresidente } from "../commands/presidente.js";
import { cmdGovernador } from "../commands/governador.js";
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
    if (connection === "open") console.log("🔥 Zeffa conectado!");
    if (connection === "close") {
      console.log("❌ Caiu — reconectando...");
      startBot();
    }
  });

  // 📩 RECEBER MENSAGENS
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message) return;
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    console.log("📥 Mensagem:", texto);

    const partes = texto.trim().split(" ");
    const comando = partes.shift()?.toLowerCase();
    const args = partes || [];

    if (comando === "!ping") {
      await comandoPing(sock, { from, texto });
      return;
    }

    if (comando === "!deputado") {
      await cmdDeputado(sock, { from, texto }, args);
      return;
    }

    if (comando === "!senador") {
      await cmdSenador(sock, { from, texto }, args);
      return;
    }

    if (comando === "!presidente") {
      await cmdPresidente(sock, { from, texto }, args);
      return;
    }

    if (comando === "!governador") {
      await cmdGovernador(sock, { from, texto }, args);
      return;
    }
  });
}

startBot();