// INÍCIO — Comando !deputado (versão compatível com Zeffa/Ferdinando)

import fetch from "node-fetch";

// 🔍 Busca deputado por nome
async function buscarDeputado(nome) {
  const url = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(
    nome
  )}`;
  const resp = await fetch(url);
  const json = await resp.json();
  return json.dados?.[0] || null;
}

// 📊 Pega detalhes + despesas
async function buscarCapivara(id) {
  const detalhesURL = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`;
  const despesasURL = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas`;

  const [detalhesResp, despesasResp] = await Promise.all([
    fetch(detalhesURL),
    fetch(despesasURL)
  ]);

  const detalhes = await detalhesResp.json();
  const despesas = await despesasResp.json();

  return {
    detalhes: detalhes.dados,
    despesas: despesas.dados
  };
}

// 🧠 Gera resumo
function gerarResumo(cap) {
  const nome = cap.detalhes.nomeCivil;
  const total = cap.despesas.reduce((acc, x) => acc + x.valorLiquido, 0);

  const maior =
    cap.despesas.sort((a, b) => b.valorLiquido - a.valorLiquido)[0] || {
      valorLiquido: 0,
      tipoDocumento: "Nenhuma"
    };

  return `
🕵️ *Zeffa Dedo Duro — CAPIVARA FEDERAL*

👤 *${nome}*
💰 Total gasto: R$ ${total.toFixed(2)}

📄 Nota mais cara:
- R$ ${maior.valorLiquido.toFixed(2)}
- ${maior.tipoDocumento}

Zeffa rastreou tudo 😘
`;
}

// 🚀 Comando principal (agora compatível com o handler!)
export async function cmdDeputado(msg, sock, from, args) {
  const nome = args.join(" ").trim();

  if (!nome) {
    return {
      tipo: "texto",
      resposta: "Use assim → *!deputado nome_do_deputado*"
    };
  }

  // 1) Buscar deputado
  const deputado = await buscarDeputado(nome);

  if (!deputado) {
    return {
      tipo: "texto",
      resposta: `Nenhum deputado encontrado com nome parecido com *${nome}*.`
    };
  }

  // 2) Buscar despesas
  const capivara = await buscarCapivara(deputado.id);

  // 3) Resumo bonitão
  const resumo = gerarResumo(capivara);

  return {
    tipo: "texto",
    resposta: resumo
  };
}

// FIM — deputado.js