// INÍCIO — Imports principais
import axios from "axios";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import puppeteer from "puppeteer";
// FIM — Imports principais



// INÍCIO — Tabela SP/CNE (Opção A — salário estimado leve)
const tabelaSalariosGabinete = {
  SP01: 1293,  SP02: 1516,  SP03: 1787,  SP04: 2100,  SP05: 2600,
  SP06: 3100,  SP07: 3600,  SP08: 4200,  SP09: 4800,  SP10: 5400,
  SP11: 6200,  SP12: 6800,  SP13: 8000,  SP14: 9200,  SP15: 10500,
  SP16: 11300, SP17: 11800, SP18: 12200, SP19: 12500, SP20: 12800,
  SP21: 13500, SP22: 14200, SP23: 15000, SP24: 15800, SP25: 17000,
  CNE01: 7200, CNE02: 8200, CNE03: 9000, CNE04: 9800, CNE05: 11000,
  CNE06: 12800, CNE07: 14200, CNE08: 15000, CNE09: 16000, CNE10: 17500
};
// FIM — Tabela SP/CNE



// INÍCIO — Scraper real da folha (Opção C — salário REAL via Puppeteer)
async function salarioRealGabinete_v7_Full(nome) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto("https://www2.camara.leg.br/transparencia/remuneracao-servidor", {
      waitUntil: "networkidle0"
    });

    await page.type("#campoPesquisa", nome);
    await page.click("#botaoPesquisar");

    await page.waitForSelector(".resultado-remuneracao tbody tr", { timeout: 15000 });

    const dados = await page.evaluate(() => {
      const linha = document.querySelector(".resultado-remuneracao tbody tr");
      if (!linha) return null;

      const cols = linha.querySelectorAll("td");

      const valor = (txt) => parseFloat(txt.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

      return {
        nome: cols[0]?.innerText.trim(),
        cargo: cols[1]?.innerText.trim(),
        matricula: cols[2]?.innerText.trim(),
        situacao: cols[3]?.innerText.trim(),
        bruto: valor(cols[4]?.innerText || "0"),
        liquido: valor(cols[8]?.innerText || "0")
      };
    });

    await browser.close();
    return dados;
  } catch (e) {
    return null;
  }
}
// FIM — Scraper da folha real



// INÍCIO — Scraper do Gabinete (mantido, apenas ampliado)
async function scraperGabinete_v7_Full(idDep) {
  try {
    const url = `https://www.camara.leg.br/deputados/${idDep}/pessoal-gabinete`;
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const lista = [];

    $(".tabela-servidores tbody tr").each((_, el) => {
      const cols = $(el).find("td");

      lista.push({
        nome: $(cols[0]).text().trim(),
        cargo: $(cols[1]).text().trim(),
        remuneracao: $(cols[2]).text().trim(), // SP13 / CNE07
        data: $(cols[5]).text().trim() || ""
      });
    });

    return lista;
  } catch (err) {
    return [];
  }
}
// FIM — Scraper do Gabinete



// INÍCIO — Busca CGU genérica (sua lógica original, mantida)
async function cguGet_v7_Full(url) {
  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "chave-api-dados": process.env.CGU_API_KEY
    }
  });
  if (!resp.ok) throw new Error(`Erro CGU: ${resp.status}`);
  return resp.json();
}
// FIM — CGU GET



// INÍCIO — Função principal do comando !deputado
export default async function cmdDeputado(sock, jid, nomeDeputado) {
  try {
    // status inicial
    await sock.sendMessage(jid, { text: `🔍 Pesquisando deputado *${nomeDeputado}*...` });

    // 1) Buscar deputado na Câmara
    const urlBusca = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(nomeDeputado)}`;
    const depResp = await axios.get(urlBusca);
    const dep = depResp.data.dados[0];
    const id = dep.id;

    // 2) Dados completos do deputado
    const infoResp = await axios.get(`https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`);
    const info = infoResp.data.dados;

    // 3) Gabinete completo
    await sock.sendMessage(jid, { text: "👥 Buscando gabinete..." });
    const gabinete = await scraperGabinete_v7_Full(id);

    // 4) Opção A — salário estimado
    for (let a of gabinete) {
      a.salarioEstimado = tabelaSalariosGabinete[a.remuneracao] || null;
    }

    // 5) Opção C — salário REAL
    await sock.sendMessage(jid, { text: "💰 Buscando salários reais (Folha Oficial)..." });

    for (let a of gabinete) {
      const real = await salarioRealGabinete_v7_Full(a.nome);
      if (real) {
        a.salarioRealBruto = real.bruto;
        a.salarioRealLiquido = real.liquido;
      }
    }

    // 6) Montagem da resposta final
    let txt = "";
    txt += `🕵️ *Zeffa investigou ${info.nomeCivil}:*\n(${dep.siglaPartido} - ${dep.siglaUf})\n\n`;

    // Remuneração do deputado
    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += "📌 *REMUNERAÇÃO DO DEPUTADO*\n";
    txt += `Bruto: ${info.ultimoStatus.salario ? "R$ " + info.ultimoStatus.salario : "Indisp."}\n\n`;

    // Gabinete
    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += `📌 *GABINETE*\n${gabinete.length} assessores\n\n`;

    for (const a of gabinete) {
      txt += `• *${a.nome}* — ${a.cargo} — ${a.remuneracao} — ${a.data}\n`;

      if (a.salarioRealBruto) {
        txt += `  💰 Real bruto: R$ ${a.salarioRealBruto.toLocaleString("pt-BR")}\n`;
        txt += `  💸 Real líquido: R$ ${a.salarioRealLiquido.toLocaleString("pt-BR")}\n`;
      } else if (a.salarioEstimado) {
        txt += `  💰 Estimado: R$ ${a.salarioEstimado.toLocaleString("pt-BR")}\n`;
      } else {
        txt += `  💰 Salário: Indisponível\n`;
      }

      txt += "\n";
    }

    await sock.sendMessage(jid, { text: txt });

  } catch (err) {
    await sock.sendMessage(jid, { text: `❌ Erro no cmdDeputado: ${err.message}` });
  }
}
// FIM — Função principal deputado.js