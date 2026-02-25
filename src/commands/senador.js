// INÍCIO — Imports
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

// INÍCIO — Funções auxiliares

// User-agents randômicos (anti-bot)
const agents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/122.0",
];

// Headers agressivos anti-proteção
function hardHeaders() {
  return {
    "User-Agent": agents[Math.floor(Math.random() * agents.length)],
    "Accept": "application/json, text/xml, */*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": "https://www12.senado.leg.br/",
    "Origin": "https://www12.senado.leg.br",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Connection": "keep-alive",
  };
}

// Sleep aleatório
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// INÍCIO — Requisição blindada
async function blindFetch(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: hardHeaders() });
      const text = await res.text();

      // 1) JSON direto — perfeito
      if (text.trim().startsWith("{")) return JSON.parse(text);

      // 2) XML — converter
      if (text.trim().startsWith("<")) {
        const xmlJson = await parseStringPromise(text, { explicitArray: false });
        return xmlJson;
      }

      // 3) HTML (bloqueio) — tentar de novo com outro user-agent
      if (text.includes("<html") || text.includes("DOCTYPE")) {
        console.log("⚠️ HTML recebido, retry...");
        await delay(200 + Math.random() * 500);
        continue;
      }

      // 4) fallback bruto
      return text;
    } catch (e) {
      console.log("❌ blindFetch tentativa falhou:", i, e);
      await delay(500 + Math.random() * 1000);
    }
  }

  throw new Error("Senado não devolveu nada utilizável.");
}

// FIM — blindFetch

// URLs alternativas do Senado
const URLS_LISTA = [
  "https://legis.senado.gov.br/dadosabertos/senador/lista/atual?format=json",
  "https://www.senado.leg.br/transparencia/lsv/senadores.json",
  "https://legis.senado.gov.br/dadosabertos/senador/lista/atual",
];

function montarURLdespesas(id) {
  return [
    `https://legis.senado.gov.br/dadosabertos/senador/${id}/despesas?format=json`,
    `https://www.senado.leg.br/transparencia/lsv/despesa_ceaps_${id}.json`,
    `https://legis.senado.gov.br/dadosabertos/senador/${id}/despesas`,
  ];
}

// FIM funções auxiliares

// INÍCIO — Função principal
export async function cmdSenador(sock, { from }, args = []) {
  try {
    const nome = args.join(" ").trim();
    if (!nome) {
      await sock.sendMessage(from, { text: "Use: !senador nome" });
      return;
    }

    let lista = null;

    // tentativa de todas as URLs
    for (const url of URLS_LISTA) {
      try {
        console.log("🔎 tentado lista:", url);
        const data = await blindFetch(url);

        // tentar navegar pelos caminhos possíveis
        lista =
          data?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ||
          data?.ListaParlamentar?.Parlamentares?.Parlamentar ||
          data?.ListaSenador?.Senadores?.Senador ||
          null;

        if (lista) break;
      } catch (_) {}
    }

    if (!lista) throw new Error("Nenhuma URL da lista funcionou.");

    // achar senador
    const sen = lista.find(s =>
      s.IdentificacaoParlamentar.NomeParlamentar
        .toLowerCase()
        .includes(nome.toLowerCase())
    );

    if (!sen) {
      await sock.sendMessage(from, {
        text: `❌ Nenhum senador encontrado semelhante a: *${nome}*`,
      });
      return;
    }

    const info = sen.IdentificacaoParlamentar;
    const id = info.CodigoParlamentar;

    // DESPESAS
    let despesas = [];

    for (const url of montarURLdespesas(id)) {
      try {
        console.log("💰 tentando despesas:", url);
        const d = await blindFetch(url);

        const listaDesp =
          d?.DespesasParlamentares?.Despesas?.Despesas?.Despesa ||
          d?.DetalhamentoDocumentoParlamentar?.Documentos?.Documento ||
          null;

        if (listaDesp) {
          despesas = listaDesp;
          break;
        }
      } catch (_) {}
    }

    if (!despesas.length) throw new Error("Nenhuma URL de despesas funcionou.");

    // soma e categorias
    let total = 0;
    const categorias = {};

    for (const d of despesas) {
      const val =
        Number(d?.ValorReembolsado) ||
        Number(d?.valor) ||
        Number(d?.valorReembolsado) ||
        0;

      total += val;

      const tp = d?.TipoDespesa || d?.tipo || "Outros";
      categorias[tp] = (categorias[tp] || 0) + val;
    }

    // formatar
    const totalF = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    let catTxt = "";
    for (const c in categorias) {
      const pct = ((categorias[c] / total) * 100).toFixed(1);
      const barras = "█".repeat(Math.max(1, Math.round(pct / 5)));
      catTxt += `${c}: ${barras} ${pct}%\n`;
    }

    const resposta = `
🟦 *Zeffa investigou o Senador ${info.NomeParlamentar}:*

🏛️ Partido: ${info.SiglaPartidoParlamentar}
📍 UF: ${info.UfParlamentar}

💸 *Total reembolsado:*  
${totalF}

📊 *Gastos por categoria:*  
${catTxt}

📌 *Fonte:* Senado Federal (extraída com ARROMBA-TUDO™)
`;

    await sock.sendMessage(from, { text: resposta });

  } catch (err) {
    console.log("🚨 ERRO FINAL SENADOR:", err);
    await sock.sendMessage(from, {
      text: "❌ Erro extremo: Senado travou, mas o Zeffa tentou rasgar todas as portas.",
    });
  }
}
// FIM