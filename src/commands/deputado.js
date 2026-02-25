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
import salariosGabinete from "../data/salariosGabinete.json" with { type: "json" };
// FIM
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

// INÍCIO — CEAP MULTIANUAL turbo

export async function pegaCEAP(id) {
  const anos = [2020, 2021, 2022, 2023, 2024, 2025, 2026]; // pode expandir
  const totPorAno = {};
  const fornecedores = {};

  for (const ano of anos) {
    const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?ano=${ano}&pagina=1`;
    const json = await fetch(url).then(r => r.json());

    const lista = json?.dados || [];
    const totalAno = lista.reduce((s, d) => s + d.valorDocumento, 0);

    totPorAno[ano] = totalAno;

    // fornecedores acumulados
    for (const d of lista) {
      const chave = d.cnpjCpfFornecedor;
      if (!fornecedores[chave]) {
        fornecedores[chave] = {
          nome: d.nomeFornecedor,
          total: 0,
        };
      }
      fornecedores[chave].total += d.valorDocumento;
    }
  }

  // top fornecedores acumulado
  const top = Object.entries(fornecedores)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([cnpj, data]) => ({
      cnpj,
      nome: data.nome,
      total: data.total,
    }));

  return {
    totPorAno,
    totalGeral: Object.values(totPorAno).reduce((a, b) => a + b, 0),
    top,
  };
}

// FIM — CEAP MULTIANUAL

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

for (const f of ceap.top) {
  const dados = await consultaCartaoPorCNPJ(f.cnpj, CGU_KEY);

  if (dados.length) {
    const totalCartao = dados.reduce((s, x) => s + (x.valor || 0), 0);

    vinculosCC.push({
      cnpj: f.cnpj,
      nome: dados[0]?.nome || "Fornecedor não identificado",
      qtd: dados.length,
      totalCartao,
    });
  }
}

    // 7) Sanções
    await status(sock, jid, "⚠️ Checando CEIS / CNEP / CEAF / CEPIM...");
const fornecedoresSanções = [];

for (const f of ceap.top) {
  const flags = await verificaSancoes(f.cnpj, CGU_KEY);
  fornecedoresSanções.push({
    cnpj: f.cnpj,
    ...flags
  });
}
// ============================ MONTAR RESPOSTA ============================
let txt = `🕵️ *Zeffa investigou ${nome}:*\n(${partido} - ${uf})\n\n`;

txt += "━━━━━━━━━━━━━━━━━━\n";
txt += `📌 *REMUNERAÇÃO*\nBruto: ${salario.bruto ?? "Indisp."}\nLíquido: ${salario.liquido ?? "Indisp."}\n\n`;

txt += "━━━━━━━━━━━━━━━━━━\n";
txt += `📌 *GABINETE*\n${gabinete.length} assessores\n`;

// INÍCIO — soma total salários gabinete
let totalGabinete = 0;
for (const a of gabinete) {
  const sal = salariosGabinete[a.remuneracao] || 0;
  totalGabinete += sal;
}
txt += `Valor total — R$ ${totalGabinete.toLocaleString("pt-BR")}\n\n`;
// FIM

if (gabinete.length === 0) {
  txt += "• Nenhum assessor encontrado\n\n";
} else {
  for (const a of gabinete) {

    // INÍCIO — Inserção de salário por sigla
    a.salarioEstimado = salariosGabinete[a.remuneracao] || null;
    // FIM

    txt += `• *${a.nome}* — ${a.cargo} — ${a.remuneracao} — ${a.data}\n`;

    // INÍCIO — Exibição do salário estimado
    if (a.salarioEstimado) {
      txt += `  💰 Salário estimado: R$ ${a.salarioEstimado.toLocaleString("pt-BR")}\n`;
    }
    // FIM
  }

  txt += "\n";
}

txt += "━━━━━━━━━━━━━━━━━━\n";
txt += `📌 *EMENDAS*\nAutorizado: R$ ${totalEmendas.toLocaleString("pt-BR")}\nPago: R$ ${totalPagas.toLocaleString("pt-BR")}\nTotal: ${emendas.length} emendas\n\n`;

txt += "━━━━━━━━━━━━━━━━━━\n";
txt += `📌 *CEAP — Cota Parlamentar*\n`;
txt += `Total 2023: R$ ${ceap.totPorAno[2023].toLocaleString("pt-BR")}\n`;
txt += `Total 2024: R$ ${ceap.totPorAno[2024].toLocaleString("pt-BR")}\n`;
txt += `Total 2025: R$ ${ceap.totPorAno[2025].toLocaleString("pt-BR")}\n`;
txt += `📌 *Total Geral: R$ ${ceap.totalGeral.toLocaleString("pt-BR")}*\n\n`;

txt += "━━━━━━━━━━━━━━━━━━\n";
txt += `📌 *TOP FORNECEDORES (Acumulado)*\n`;

for (const f of ceap.top) {
  const flag = fornecedoresSanções.find(x => x.cnpj === f.cnpj);

  txt += `• *${f.nome}* (${f.cnpj}) — R$ ${f.total.toLocaleString("pt-BR")}\n`;
  txt += `  🚨 CEIS: ${flag.ceis ? "SIM" : "NÃO"} | `;
  txt += `⚠️ CNEP: ${flag.cnep ? "SIM" : "NÃO"} | `;
  txt += `❌ CEAF: ${flag.ceaf ? "SIM" : "NÃO"} | `;
  txt += `❗ CEPIM: ${flag.cepim ? "SIM" : "NÃO"}\n\n`;
}

txt += "━━━━━━━━━━━━━━━━━━\n";
txt += "💳 *CARTÃO CORPORATIVO*\n";

// INÍCIO — soma total cartão corporativo
let totalCartao = 0;
for (const v of vinculosCC) {
  totalCartao += v.totalCartao || 0;
}
txt += `Valor total — R$ ${totalCartao.toLocaleString("pt-BR")}\n\n`;
// FIM

if (!vinculosCC.length) {
  txt += "Nenhum vínculo encontrado.\n\n";
} else {
  vinculosCC.forEach(v => {
    txt += `• *${v.nome}* (${v.cnpj}) — ${v.qtd} registros — R$ ${v.totalCartao.toLocaleString("pt-BR")}\n`;
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