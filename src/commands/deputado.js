// INÍCIO — deputado.js FULL 2.0 TURBO

import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { pegaEmendas } from "../utils/emendas.js";
import { consultaCartaoPorCNPJ } from "../utils/cartaoVinculos.js";
import { verificaSancoes } from "../utils/sancoes.js";

// =============== UTIL: Enviar status ===============
async function status(sock, jid, msg) {
  await sock.sendMessage(jid, { text: msg });
}

// =============== SCRAPER — GABINETE ===============
async function scrapeGabinete(id) {
  try {
    const url = `https://www.camara.leg.br/deputados/${id}/pessoal-gabinete`;
    const html = await fetch(url).then(r => r.text());
    const $ = cheerio.load(html);

    const assessores = [];

    $("table tbody tr").each((_, el) => {
      const cols = $(el).find("td");
      if (!cols.length) return;

      assessores.push({
        nome: $(cols[0]).text().trim(),
        cargo: $(cols[1]).text().trim(),
        remuneracao: $(cols[2]).text().trim(),
        data: $(cols[3]).text().trim(),
      });
    });

    return assessores;
  } catch (e) {
    console.log("Erro gabinete:", e.message);
    return [];
  }
}

// =============== SALÁRIO (CGU via CPF) ===============
async function pegaSalario(cpf, CGU_KEY) {
  try {
    if (!cpf) return { bruto: null, liquido: null };

    const mesAno = new Date().toISOString().slice(0, 7).replace("-", ""); // AAAAMM
    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/servidores/remuneracao?cpf=${cpf}&mesAno=${mesAno}&pagina=1`;

    const resp = await fetch(url, {
      headers: {
        "chave-api-dados": CGU_KEY,
        Accept: "application/json",
      },
    });

    if (!resp.ok) return { bruto: null, liquido: null };

    const data = await resp.json();
    if (!data.length) return { bruto: null, liquido: null };

    const r = data[0].remuneracoesDTO[0];

    return {
      bruto: r.remuneracaoBasicaBruta || null,
      liquido: r.valorTotalRemuneracaoAposDeducoes || null,
    };
  } catch (e) {
    console.log("Erro salário:", e.message);
    return { bruto: null, liquido: null };
  }
}

// =============== CEAP (COTA) ===============
async function pegaCEAP(id) {
  const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?ano=2024&pagina=1`;
  const data = await fetch(url).then(r => r.json());

  const despesas = data?.dados || [];
  const total = despesas.reduce((s, d) => s + d.valorDocumento, 0);

  const fornecedores = {};
  for (const d of despesas) {
    fornecedores[d.cnpjCpfFornecedor] =
      (fornecedores[d.cnpjCpfFornecedor] || 0) + d.valorDocumento;
  }

  const top = Object.entries(fornecedores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return { total, top };
}

// ==========================================================
// ===============  COMANDO PRINCIPAL  =======================
// ==========================================================

export async function cmdDeputado(sock, jid, args) {
  try {
    // normaliza jid
    if (typeof jid !== "string") jid = jid?.remoteJid || jid?.jid || "";
    if (!jid) return;

    const nomeBuscado = args.join(" ").trim();
    const CGU_KEY = process.env.CGU_API_KEY;

    // STATUS
    await status(sock, jid, `🔍 Investigando *${nomeBuscado}*...`);
    await status(sock, jid, "📌 Buscando deputado...");

    // 1) Busca deputado
    const busca = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(
        nomeBuscado
      )}`
    ).then(r => r.json());

    if (!busca?.dados?.length) {
      await status(sock, jid, "❌ Nenhum deputado encontrado.");
      return;
    }

    const dep = busca.dados[0];
    const id = dep.id;

    // Detalhes
    const detalhes = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`
    ).then(r => r.json());

    const info = detalhes.dados;
    const partido = info.ultimoStatus.siglaPartido;
    const uf = info.ultimoStatus.siglaUf;
    const nome = info.nomeCivil;
    const cpf = info.cpf;

    // 2) Salário
    await status(sock, jid, "💰 Pegando salário...");
    const salario = await pegaSalario(cpf, CGU_KEY);

    // 3) Gabinete
    await status(sock, jid, "👥 Pegando assessores...");
    const gabinete = await scrapeGabinete(id);

    // 4) Emendas
    await status(sock, jid, "📑 Pegando emendas parlamentares...");
    const emendas = await pegaEmendas(nome);
    const totalEmendas = emendas.reduce((s, e) => s + (e.autorizado || 0), 0);
    const totalPagas = emendas.reduce((s, e) => s + (e.pago || 0), 0);

    // 5) CEAP
    await status(sock, jid, "📦 Pegando gastos CEAP...");
    const ceap = await pegaCEAP(id);

    // 6) Cartão corporativo
    await status(sock, jid, "💳 Checando cartão corporativo...");
    const vinculosCC = [];

    for (const [cnpj, valor] of ceap.top) {
      const dados = await consultaCartaoPorCNPJ(cnpj, CGU_KEY);
      if (dados.length) {
        vinculosCC.push({ cnpj, valor, qtd: dados.length });
      }
    }

    // 7) Sanções
    await status(sock, jid, "⚠️ Checando CEIS / CNEP / CEAF / CEPIM...");
    const fornecedoresSanções = [];

    for (const [cnpj] of ceap.top) {
      const flags = await verificaSancoes(cnpj, CGU_KEY);
      fornecedoresSanções.push({ cnpj, ...flags });
    }

    // ============================ MONTAR RESPOSTA ============================
    let txt = `🕵️ *Zeffa investigou ${nome}:*\n(${partido} - ${uf})\n\n`;

    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += `📌 *REMUNERAÇÃO*\nBruto: ${salario.bruto ?? "Indisp."}\nLíquido: ${salario.liquido ?? "Indisp."}\n\n`;

    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += `📌 *GABINETE*\n${gabinete.length} assessores\n`;
    gabinete.slice(0, 5).forEach(a => {
      txt += `• ${a.nome} — ${a.cargo} — ${a.remuneracao}\n`;
    });
    txt += "\n";

    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += `📌 *EMENDAS*\nAutorizado: R$ ${totalEmendas.toLocaleString("pt-BR")}\nPago: R$ ${totalPagas.toLocaleString("pt-BR")}\nTotal: ${emendas.length} emendas\n\n`;

    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += `📌 *CEAP (2024)*\nGasto: R$ ${ceap.total.toLocaleString("pt-BR")}\n\n`;

    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += "📌 *TOP FORNECEDORES*\n";
    ceap.top.forEach(([cnpj, val]) => {
      const flags = fornecedoresSanções.find(f => f.cnpj === cnpj);
      txt += `• ${cnpj} — R$ ${val.toLocaleString("pt-BR")}\n`;
      txt += `  🚨 CEIS: ${flags.ceis ? "SIM" : "NÃO"} | ⚠️ CNEP: ${
        flags.cnep ? "SIM" : "NÃO"
      } | ❌ CEAF: ${flags.ceaf ? "SIM" : "NÃO"} | ❗ CEPIM: ${
        flags.cepim ? "SIM" : "NÃO"
      }\n\n`;
    });

    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += "💳 *CARTÃO CORPORATIVO*\n";
    if (!vinculosCC.length) {
      txt += "Nenhum vínculo encontrado.\n\n";
    } else {
      vinculosCC.forEach(v => {
        txt += `• ${v.cnpj} — ${v.qtd} registros\n`;
      });
      txt += "\n";
    }

    txt += "━━━━━━━━━━━━━━━━━━\n";
    txt += "📌 *FONTES*\n• Câmara dos Deputados\n• Portal da Transparência (CGU)\n• SigaBrasil / Senado\n• CEIS / CNEP / CEAF / CEPIM\n\n";
    txt += "🔥 *Zeffa FULL MODE.*";

    await sock.sendMessage(jid, { text: txt });
  } catch (err) {
    console.error("ERRO GERAL:", err);
    await status(sock, jid, "❌ Erro ao gerar relatório.");
  }
}

// FIM — deputado.js FULL 2.0