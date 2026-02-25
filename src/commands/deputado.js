// INÍCIO — Importações
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
// FIM

const CGU_KEY = process.env.CGU_API_KEY;

// INÍCIO — Helper CGU (GET)
async function cguGet(endpoint) {
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/${endpoint}`;

  const resp = await fetch(url, {
    headers: {
      "chave-api-dados": CGU_KEY,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`Erro CGU: ${resp.status} — ${url}`);
  }

  return await resp.json();
}
// FIM

// INÍCIO — Checar sanções CEIS/CNEP/CEAF/CEPIM
async function checarSancoesFornecedor(cnpj) {
  const ceis = await cguGet(`ceis?cpfCnpj=${cnpj}&pagina=1`).catch(() => []);
  const cnep = await cguGet(`cnep?cpfCnpj=${cnpj}&pagina=1`).catch(() => []);
  const ceaf = await cguGet(`ceaf?cpfCnpj=${cnpj}&pagina=1`).catch(() => []);
  const cepim = await cguGet(`cepim?cpfCnpj=${cnpj}&pagina=1`).catch(() => []);

  return {
    ceis: ceis.length,
    cnep: cnep.length,
    ceaf: ceaf.length,
    cepim: cepim.length,
  };
}
// FIM

// INÍCIO — Checar fornecedor: valores recebidos da União
async function checarFavorecidoUniao(cnpj) {
  const dados = await cguGet(
    `pessoas-juridicas?cpfCnpj=${cnpj}&pagina=1`
  ).catch(() => []);

  if (!dados.length) return null;

  const pj = dados[0];

  return {
    nome: pj.razaoSocial,
    totalFederal: pj.favorecidoDespesas || 0,
    possuiContratos: pj.possuiContratacao || false,
    convenios: pj.convenios || false,
    sancionadoCEPIM: pj.sancionadoCEPIM || false,
  };
}
// FIM

// INÍCIO — Função principal do comando
export async function cmdDeputado(sock, msg, args) {
  try {
    const nomeBusca = args.join(" ").trim();
    if (!nomeBusca) {
      await sock.sendMessage(msg.from, {
        text: "Digite o nome do deputado: !deputado fulano",
      });
      return;
    }

    // INÍCIO — Busca inicial na Câmara
    const urlBusca = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(
      nomeBusca
    )}`;
    const respBusca = await fetch(urlBusca);
    const dadosBusca = await respBusca.json();

    if (!dadosBusca?.dados?.length) {
      await sock.sendMessage(msg.from, {
        text: `Nenhum deputado encontrado com: *${nomeBusca}*`,
      });
      return;
    }

    const deputado = dadosBusca.dados[0];
    const id = deputado.id;
    // FIM

    // INÍCIO — Detalhes pessoais
    const respDetalhes = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`
    );
    const detalhes = await respDetalhes.json();
    const info = detalhes.dados;

    const nome = info.ultimoStatus.nomeEleitoral;
    const partido = info.ultimoStatus.siglaPartido;
    const uf = info.ultimoStatus.siglaUf;
    const email = info.ultimoStatus.gabinete?.email || "—";
    // FIM

    // INÍCIO — Salário oficial do deputado (corrigido)
const agora = new Date();
const ano = agora.getFullYear();
const mes = agora.getMonth() + 1;

const salResp = await fetch(
  `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/remuneracao?ano=${ano}&mes=${mes}`
);

const salJson = await salResp.json();

let salarioBruto = 50; // valor oficial fixo
let salarioLiquido = 0;

if (salJson?.dados?.length) {
  const ultimo = salJson.dados[0];

  if (ultimo.remuneracaoBasicaBruta > 0)
    salarioBruto = ultimo.remuneracaoBasicaBruta;

  if (ultimo.valorTotalLiquido > 0)
    salarioLiquido = ultimo.valorTotalLiquido;
}

const brutoBR = salarioBruto.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const liquidoBR = salarioLiquido.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const salarioMandato = salarioBruto * 48;

const salarioMandatoBR = salarioMandato.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});
// FIM
    // INÍCIO — Cota Parlamentar
    const respDesp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?itens=2000`
    );
    const despJson = await respDesp.json();

    const despesas = despJson.dados || [];

    const totalCota = despesas.reduce(
      (s, d) => s + (d.valorLiquido || 0),
      0
    );

    const totalCotaBR = totalCota.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    // média por mês
    const mesesDeMandato = Math.max(
      1,
      Math.ceil(
        (Date.now() - new Date(info.ultimoStatus.dataInicio)) /
          (1000 * 60 * 60 * 24 * 30)
      )
    );

    const mediaMensal = totalCota / mesesDeMandato;
    const mediaMensalBR = mediaMensal.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    const projetado4Anos = mediaMensal * 48;
    const projetado4AnosBR = projetado4Anos.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    // FIM

    // INÍCIO — Top fornecedores e cruzamento CGU
    const fornecedores = {};

    for (const d of despesas) {
      if (!d.cnpjCpfFornecedor) continue;

      if (!fornecedores[d.cnpjCpfFornecedor]) {
        fornecedores[d.cnpjCpfFornecedor] = {
          nome: d.nomeFornecedor,
          total: 0,
        };
      }

      fornecedores[d.cnpjCpfFornecedor].total += d.valorLiquido || 0;
    }

    const topFornecedores = Object.entries(fornecedores)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);

    const fornecedoresAnalisados = [];

    for (const [cnpj, infoForn] of topFornecedores) {
      const sancoes = await checarSancoesFornecedor(cnpj);
      const financeiro = await checarFavorecidoUniao(cnpj);

      fornecedoresAnalisados.push({
        cnpj,
        nome: infoForn.nome,
        total: infoForn.total,
        sancoes,
        financeiro,
      });
    }
    // FIM

    // INÍCIO — PEPs (cargo público)
    const peps = await cguGet(
      `peps?nome=${encodeURIComponent(info.ultimoStatus.nome)}&pagina=1`
    ).catch(() => []);

    const cargoAtual =
      peps.find((p) =>
        p.descricao_funcao.toLowerCase().includes("deput")
      ) || null;
    // FIM

    // INÍCIO — Montagem final do relatório
    let fornecedoresTxt = "";

    for (const f of fornecedoresAnalisados) {
      const totalBR = f.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      const flags = [];
      if (f.sancoes.ceis) flags.push("🚨 CEIS");
      if (f.sancoes.cnep) flags.push("⚠️ CNEP");
      if (f.sancoes.ceaf) flags.push("❌ CEAF");
      if (f.sancoes.cepim) flags.push("❗ CEPIM");

      if (f.financeiro?.totalFederal > 0)
        flags.push(`🟦 Recebeu da União: R$ ${f.financeiro.totalFederal}`);

      fornecedoresTxt += `\n• *${f.nome}* (${f.cnpj}) — ${totalBR}`;
      if (flags.length) fornecedoresTxt += `\n  ${flags.join(" | ")}\n`;
    }

    const custoTotalMandato =
      salarioMandato + projetado4Anos + totalCota;

    const custoTotalMandatoBR = custoTotalMandato.toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      }
    );

    const resposta = `
🕵️ *Zeffa investigou ${nome}:*
(${partido} - ${uf})

━━━━━━━━━━━━━━━━━━
📌 *CARGO ATUAL (PEP – CGU)*
• ${cargoAtual?.descricao_funcao || "Deputado Federal"}
• Órgão: ${
      cargoAtual?.nome_orgao || "Câmara dos Deputados"
    }

━━━━━━━━━━━━━━━━━━
📌 *REMUNERAÇÃO*
• Bruto mensal: ${brutoBR}
• Líquido mensal: ${liquidoBR}
• Total bruto no mandato: ${salarioMandatoBR}

━━━━━━━━━━━━━━━━━━
📌 *COTA PARLAMENTAR*
• Total gasto até agora: ${totalCotaBR}
• Média mensal: ${mediaMensalBR}
• Projeção 4 anos: ${projetado4AnosBR}

━━━━━━━━━━━━━━━━━━
📌 *FORNECEDORES DO MANDATO*
${fornecedoresTxt || "—"}

━━━━━━━━━━━━━━━━━━
💰 *CUSTO TOTAL ESTIMADO DO MANDATO*
👉 ${custoTotalMandatoBR}

━━━━━━━━━━━━━━━━━━
📌 *FONTES*
• Câmara dos Deputados  
• CGU – Portal da Transparência  
• CEIS / CNEP / CEAF / CEPIM

🔥 *Zeffa te entregou a capivara suprema.*
`;

    await sock.sendMessage(msg.from, { text: resposta });

    // FIM — Função principal
  } catch (e) {
    console.error("❌ Erro cmdDeputado:", e);
    await sock.sendMessage(msg.from, {
      text: "❌ Erro ao puxar a capivara completa.",
    });
  }
}