// INÍCIO — deputado.js FULL MODE FUNCIONAL

import fetch from "node-fetch";
import { scrapeRemuneracao } from "../utils/scraperRemuneracao.js";
import { scrapeGabinete } from "../utils/scraperGabinete.js";
import { pegaEmendas } from "../utils/emendas.js";
import { consultaCartaoPorCNPJ } from "../utils/cartaoVinculos.js";

export async function cmdDeputado(sock, jid, nomeBuscado) {
  try {
    // NORMALIZA JID -> sempre string
    jid = typeof jid === "string" ? jid : jid?.remoteJid || jid?.jid || "";

    if (!jid) {
      console.log("❌ JID inválido:", jid);
      return;
    }

    // Aviso inicial
    await sock.sendMessage(jid, { text: `🔍 *OK! Investigando o deputado ${nomeBuscado}...*\nIsso pode levar alguns segundos.` });
    console.log("📥 Buscando deputado:", nomeBuscado);

    // 1) BUSCAR DEPUTADO
    await sock.sendMessage(jid, { text: "👤 Buscando dados básicos do deputado..." });

    const resp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(nomeBuscado)}`
    );
    const data = await resp.json();

    if (!data?.dados?.length) {
      await sock.sendMessage(jid, { text: "❌ Nenhum deputado encontrado com esse nome." });
      return;
    }

    const dep = data.dados[0];
    const id = dep.id;

    // DETALHES
    const detResp = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`);
    const detJson = await detResp.json();
    const info = detJson.dados;

    const partido = info.ultimoStatus.siglaPartido;
    const uf = info.ultimoStatus.siglaUf;

    // 2) SCRAPER SALÁRIO
    await sock.sendMessage(jid, { text: "💰 Coletando salário oficial (scraping)..." });
    const salario = await scrapeRemuneracao(id);

    const salarioBruto = salario.salarioBruto || "Indisponível";
    const salarioLiquido = salario.salarioLiquido || "Indisponível";

    // 3) GABINETE (ASSESSORES)
    await sock.sendMessage(jid, { text: "👥 Consultando assessores do gabinete..." });
    const gabinete = await scrapeGabinete(id);

    // 4) EMENDAS PARLAMENTARES
    await sock.sendMessage(jid, { text: "📑 Coletando emendas parlamentares..." });
    const emendas = await pegaEmendas(id);

    const totalEmendas = emendas.reduce((s, e) => s + (e.valorAutorizado || 0), 0);
    const totalPagas = emendas.reduce((s, e) => s + (e.valorPago || 0), 0);

    // 5) CEAP — DESPESAS
    await sock.sendMessage(jid, { text: "📦 Baixando despesas do mandato (CEAP)..." });

    const ceapResp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?ano=2024&pagina=1`
    );
    const ceapJson = await ceapResp.json();

    const despesas = ceapJson?.dados || [];
    const totalCEAP = despesas.reduce((s, d) => s + d.valorDocumento, 0);

    // Top Fornecedores
    const fornecedores = {};
    for (const d of despesas) {
      if (!fornecedores[d.cnpjCpfFornecedor]) fornecedores[d.cnpjCpfFornecedor] = 0;
      fornecedores[d.cnpjCpfFornecedor] += d.valorDocumento;
    }

    const topFornecedores = Object.entries(fornecedores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // 6) CARTÃO CORPORATIVO — ligação indireta
    await sock.sendMessage(jid, { text: "💳 Verificando fornecedores vinculados ao cartão corporativo..." });

    const CGU_KEY = process.env.CGU_API_KEY;
    const vinculosCC = [];

    for (const [cnpj, valor] of topFornecedores) {
      const dados = await consultaCartaoPorCNPJ(cnpj, CGU_KEY);
      if (dados.length) {
        vinculosCC.push({
          cnpj,
          valor,
          registros: dados.length
        });
      }
    }

    // MONTAR RESPOSTA FINAL
    let resposta = `🕵️ *Zeffa investigou ${info.nomeCivil}:*\n(${partido} - ${uf})\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *CARGO ATUAL*\n• ${info.ultimoStatus.cargo}\n• Órgão: Câmara dos Deputados\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *REMUNERAÇÃO (Scraping)*\n• Bruto mensal: ${salarioBruto}\n• Líquido mensal: ${salarioLiquido}\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *VERBA DE GABINETE (Assesores)*\n• Total de assessores: ${gabinete.length}\n`;
    gabinete.slice(0, 5).forEach(a => {
      resposta += `• ${a.nome} — ${a.cargo} — ${a.remuneracao}\n`;
    });
    resposta += gabinete.length > 5 ? "• …e mais.\n\n" : "\n";

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *EMENDAS PARLAMENTARES*\n• Total autorizado: R$ ${totalEmendas.toLocaleString("pt-BR")}\n• Total pago: R$ ${totalPagas.toLocaleString("pt-BR")}\n• Emendas encontradas: ${emendas.length}\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += `📌 *COTA PARLAMENTAR (CEAP)*\n• Total gasto em 2024: R$ ${totalCEAP.toLocaleString("pt-BR")}\n\n`;

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += "📌 *TOP FORNECEDORES*\n";
    topFornecedores.forEach(([cnpj, valor]) => {
      resposta += `• ${cnpj} — R$ ${valor.toLocaleString("pt-BR")}\n`;
    });
    resposta += "\n";

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += "💳 *Vínculos com Cartão Corporativo*\n";
    if (!vinculosCC.length) {
      resposta += "Nenhum fornecedor vinculado ao cartão corporativo.\n\n";
    } else {
      vinculosCC.forEach(v => {
        resposta += `• ${v.cnpj} — ${v.registros} registros no cartão corporativo\n`;
      });
      resposta += "\n";
    }

    resposta += "━━━━━━━━━━━━━━━━━━\n";
    resposta += "📌 *FONTES*\n• Câmara dos Deputados\n• CGU — Portal da Transparência\n• Senado — SigaBrasil\n• CEIS / CNEP / CEAF / CEPIM\n\n🔥 *Zeffa te entregou a capivara FULL MODE.*";

    await sock.sendMessage(jid, { text: resposta });

  } catch (err) {
    console.error("❌ Erro no cmdDeputado:", err);
    await sock.sendMessage(jid, { text: "❌ Erro interno ao gerar a capivara." });
  }
}

// FIM — deputado.js FULL MODE FUNCIONAL