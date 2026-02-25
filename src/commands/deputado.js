// INÍCIO — Importações necessárias
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
// FIM

const CGU_KEY = process.env.CGU_API_KEY;

// INÍCIO — Helper para chamadas CGU
async function cguGet(endpoint) {
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/${endpoint}`;

  const resp = await fetch(url, {
    headers: {
      "chave-api-dados": CGU_KEY,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`Erro CGU: ${resp.status}`);
  }

  return await resp.json();
}
// FIM

// INÍCIO — Checar empresa no CEIS/CNEP/CEAF
async function checarSancoes(cnpj) {
  const ceis = await cguGet(`ceis?cpfCnpj=${cnpj}&pagina=1`).catch(() => []);
  const cnep = await cguGet(`cnep?cpfCnpj=${cnpj}&pagina=1`).catch(() => []);
  const ceaf = await cguGet(`ceaf?cpfCnpj=${cnpj}&pagina=1`).catch(() => []);

  return {
    ceis: ceis.length,
    cnep: cnep.length,
    ceaf: ceaf.length,
  };
}
// FIM

// INÍCIO — Checar se empresa recebe da União
async function checarFavorecido(cnpj) {
  const dados = await cguGet(
    `pessoas-juridicas?cpfCnpj=${cnpj}&pagina=1`
  ).catch(() => []);

  if (!dados.length) return null;

  return {
    nome: dados[0]?.razaoSocial,
    favorecidoDespesas: dados[0]?.favorecidoDespesas || false,
    possuiContratacao: dados[0]?.possuiContratacao || false,
    convenios: dados[0]?.convenios || false,
    sancionadoCEPIM: dados[0]?.sancionadoCEPIM || false,
  };
}
// FIM

// INÍCIO — Função principal
export async function cmdDeputado(sock, msg, args) {
  try {
    const nomeBusca = args.join(" ").trim();
    if (!nomeBusca) {
      await sock.sendMessage(msg.from, {
        text: "Digite o nome: !deputado fulano",
      });
      return;
    }

    console.log("🔍 Buscando deputado:", nomeBusca);

    // --- 1) Buscar deputado na Câmara ---
    const urlDep = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(
      nomeBusca
    )}`;
    const depResp = await fetch(urlDep);
    const depJson = await depResp.json();

    if (!depJson?.dados?.length) {
      await sock.sendMessage(msg.from, {
        text: `Nenhum deputado encontrado com o nome: *${nomeBusca}*`,
      });
      return;
    }

    const deputado = depJson.dados[0];
    const id = deputado.id;

    // --- 2) Detalhes pessoais ---
    const detResp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`
    );
    const detJson = await detResp.json();
    const info = detJson?.dados;

    const nome = info?.ultimoStatus?.nomeEleitoral || deputado.nome;
    const partido = info?.ultimoStatus?.siglaPartido || "—";
    const uf = info?.ultimoStatus?.siglaUf || "—";
    const email = info?.ultimoStatus?.gabinete?.email || "—";

    // --- 3) Cota Parlamentar ---
    const despResp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?itens=2000`
    );
    const despJson = await despResp.json();

    const despesas = despJson.dados || [];
    const soma = despesas.reduce((s, d) => s + (d.valorLiquido || 0), 0);

    const totalBR = soma.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    // Top fornecedores
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
      .slice(0, 3);

    // --- 4) PEPs (CGU) ---
    const peps = await cguGet(
      `peps?nome=${encodeURIComponent(info.ultimoStatus.nome)}&pagina=1`
    );

    const cargoAtual = peps.find((p) =>
      p.descricao_funcao.toLowerCase().includes("deput")
    );

    // --- 5) Checagens de fornecedores (CEIS, CNEP, CEAF, etc.) ---
    const alertas = [];

    for (const [cnpj, dados] of topFornecedores) {
      const sancoes = await checarSancoes(cnpj);
      const favorecido = await checarFavorecido(cnpj);

      let flags = [];

      if (sancoes.ceis) flags.push("🚨 CEIS");
      if (sancoes.cnep) flags.push("⚠️ CNEP");
      if (sancoes.ceaf) flags.push("❌ CEAF");
      if (favorecido?.favorecidoDespesas) flags.push("🟦 Recebe da União");
      if (favorecido?.convenios) flags.push("📄 Convênios");
      if (favorecido?.sancionadoCEPIM) flags.push("❗ CEPIM");

      alertas.push({
        cnpj,
        nome: dados.nome,
        total: dados.total,
        flags,
      });
    }

    // MONTA TEXTO FINAL:
    let txtFornecedores = "";
    for (const f of alertas) {
      const valor = f.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      txtFornecedores += `\n• *${f.nome}* (${f.cnpj}) — ${valor}`;
      if (f.flags.length) txtFornecedores += `\n  ${f.flags.join(" | ")}\n`;
    }

    const resposta = `
🕵️ *Zeffa investigou ${nome}:*
(${partido} - ${uf})

━━━━━━━━━━━━━━━━━━
📌 *CARGO ATUAL (PEP – CGU)*
• ${cargoAtual?.descricao_funcao || "Não encontrado"}
• Órgão: ${cargoAtual?.nome_orgao || "—"}

📌 *INFORMAÇÕES DO GABINETE*
• E-mail: ${email}

📌 *GASTOS DE COTA PARLAMENTAR*
• Total gasto: ${totalBR}
• Top fornecedores:
${txtFornecedores || "—"}

📌 *FONTES*
• Câmara dos Deputados  
• CGU – Portal da Transparência  
• CEIS / CNEP / CEAF / CEPIM

🔥 *Zeffa te entregou tudo. Sem massagem.*
`;

    await sock.sendMessage(msg.from, { text: resposta });

  } catch (e) {
    console.error("❌ Erro no cmdDeputado:", e);
    await sock.sendMessage(msg.from, {
      text: "❌ Erro ao investigar o deputado.",
    });
  }
}
// FIM