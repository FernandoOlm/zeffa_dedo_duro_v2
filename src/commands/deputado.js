// INÍCIO — deputado.js FULL MODE AJUSTADO

import fetch from "node-fetch";
import { scrapeRemuneracao } from "../utils/scraperRemuneracao.js";
import { scrapeGabinete } from "../utils/scraperGabinete.js";
import { pegaEmendas } from "../utils/emendas.js";
import { consultaCartaoPorCNPJ } from "../utils/cartaoVinculos.js";

export async function cmdDeputado(sock, jid, args) {
  try {
    // transforma args em nome completo
    const nomeBuscado = Array.isArray(args) ? args.join(" ").trim() : String(args || "");

    // JID sempre string
    if (typeof jid !== "string") {
      jid = jid?.remoteJid || jid?.jid || "";
    }

    if (!jid || typeof jid !== "string") {
      console.log("❌ JID inválido:", jid);
      return;
    }

    // Mensagem inicial
    await sock.sendMessage(jid, { text: `🔍 Investigando *${nomeBuscado}*...` });

    // BUSCAR DEPUTADO
    await sock.sendMessage(jid, { text: "👤 Buscando dados básicos..." });

    const resp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(nomeBuscado)}`
    );

    const data = await resp.json();

    if (!data?.dados?.length) {
      await sock.sendMessage(jid, { text: "❌ Nenhum deputado encontrado." });
      return;
    }

    const dep = data.dados[0];
    const id = dep.id;

    // DETALHES
    const detResp = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`);
    const info = (await detResp.json()).dados;

    const partido = info.ultimoStatus.siglaPartido;
    const uf = info.ultimoStatus.siglaUf;

    // SALÁRIO
    await sock.sendMessage(jid, { text: "💰 Pegando salário..." });
    const salario = await scrapeRemuneracao(id);

    const salarioBruto = salario.salarioBruto || "Indisponível";
    const salarioLiquido = salario.salarioLiquido || "Indisponível";

    // GABINETE
    await sock.sendMessage(jid, { text: "👥 Consultando assessores..." });
    const gabinete = await scrapeGabinete(id);

    // EMENDAS
    await sock.sendMessage(jid, { text: "📑 Coletando emendas..." });
    const emendas = await pegaEmendas(id);

    const totalEmendas = emendas.reduce((s, e) => s + (e.valorAutorizado || 0), 0);
    const totalPagas = emendas.reduce((s, e) => s + (e.valorPago || 0), 0);

    // CEAP
    await sock.sendMessage(jid, { text: "📦 Coletando despesas CEAP..." });

    const ceapResp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?ano=2024&pagina=1`
    );

    const despesas = (await ceapResp.json()).dados || [];
    const totalCEAP = despesas.reduce((s, d) => s + d.valorDocumento, 0);

    const fornecedores = {};
    for (const d of despesas) {
      fornecedores[d.cnpjCpfFornecedor] = (fornecedores[d.cnpjCpfFornecedor] || 0) + d.valorDocumento;
    }

    const topFornecedores = Object.entries(fornecedores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // CARTÃO CORPORATIVO
    await sock.sendMessage(jid, { text: "💳 Conferindo fornecedores no cartão corporativo..." });

    const CGU_KEY = process.env.CGU_API_KEY;
    const vinculosCC = [];

    for (const [cnpj, valor] of topFornecedores) {
      const dados = await consultaCartaoPorCNPJ(cnpj, CGU_KEY);
      if (dados.length) {
        vinculosCC.push({ cnpj, valor, registros: dados.length });
      }
    }

    // RESPOSTA FINAL
    let resposta = `🕵️ *Zeffa investigou ${info.nomeCivil}:*\n(${partido} - ${uf})\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *REMUNERAÇÃO*\nBruto: ${salarioBruto}\nLíquido: ${salarioLiquido}\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *GABINETE*\n${gabinete.length} assessores\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *EMENDAS*\nAutorizado: R$ ${totalEmendas.toLocaleString("pt-BR")}\nPago: R$ ${totalPagas.toLocaleString("pt-BR")}\nTotal: ${emendas.length} emendas\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *CEAP*\nGasto 2024: R$ ${totalCEAP.toLocaleString("pt-BR")}\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += "📌 *TOP FORNECEDORES*\n";
    topFornecedores.forEach(([cnpj, valor]) => {
      resposta += `• ${cnpj} — R$ ${valor.toLocaleString("pt-BR")}\n`;
    });
    resposta += "\n";

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += "💳 *Vínculos com Cartão Corporativo*\n";
    resposta += vinculosCC.length
      ? vinculosCC.map(v => `• ${v.cnpj} — ${v.registros} registros`).join("\n")
      : "Nenhum vínculo encontrado.\n";

    await sock.sendMessage(jid, { text: resposta });

  } catch (err) {
    console.error("❌ Erro no cmdDeputado:", err);
    await sock.sendMessage(jid, { text: "❌ Erro ao gerar relatório." });
  }
}

// FIM — deputado.js AJUSTADO