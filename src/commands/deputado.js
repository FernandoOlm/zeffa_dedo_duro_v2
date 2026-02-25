// INÍCIO — Importações
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
// FIM

// Chave CGU
const CGU_KEY = process.env.CGU_API_KEY;

// Função helper CGU
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

// ----------------------------------------------------

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

    // 1 — Buscar deputado na API da Câmara
    const urlBusca = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(
      nomeBusca
    )}`;

    const respBusca = await fetch(urlBusca);
    const dadosBusca = await respBusca.json();

    if (!dadosBusca?.dados?.length) {
      await sock.sendMessage(msg.from, {
        text: `Nenhum deputado encontrado com o nome: *${nomeBusca}*`,
      });
      return;
    }

    const deputado = dadosBusca.dados[0];
    const id = deputado.id;

    // Dados pessoais
    const detalhesResp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`
    );
    const detalhes = await detalhesResp.json();
    const info = detalhes?.dados;

    const nome = info?.ultimoStatus?.nomeEleitoral || deputado.nome;
    const partido = info?.ultimoStatus?.siglaPartido || "—";
    const uf = info?.ultimoStatus?.siglaUf || "—";

    // 2 — Despesas
    const despesasResp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?itens=1000`
    );
    const despesasJson = await despesasResp.json();
    const despesas = despesasJson.dados;

    const totalCota = despesas.reduce(
      (s, d) => s + (d.valorLiquido || 0),
      0
    );
    const totalCotaBR = totalCota.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    // 3 — PEP (Político) — API nova da CGU
    const peps = await cguGet(
      `peps?nome=${encodeURIComponent(deputado.nome)}&pagina=1`
    );

    const cargoAtual = peps?.find(
      (p) => p.descricao_funcao?.toLowerCase().includes("deputado")
    );

    // Montar texto
    const resposta = `
🕵️ *Zeffa investigou ${nome}:*
(${partido} - ${uf})

━━━━━━━━━━━━━━━━━━
📌 *CARGO ATUAL*
• ${cargoAtual?.descricao_funcao || "Não encontrado"}
• Órgão: ${cargoAtual?.nome_orgao || "—"}

📌 *COTA PARLAMENTAR*
• Total gasto: ${totalCotaBR}

📌 *FONTES*
• Câmara dos Deputados  
• CGU - Portal da Transparência (PEPs)

🔥 *Zeffa não falha.*
`;

    await sock.sendMessage(msg.from, { text: resposta });
  } catch (e) {
    console.error("❌ Erro no cmdDeputado:", e);
    await sock.sendMessage(msg.from, {
      text: "❌ Erro ao investigar o deputado.",
    });
  }
}