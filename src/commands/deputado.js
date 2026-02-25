// INÍCIO deputado.js — comando !deputado

import fetch from "node-fetch";

// Busca na API da Câmara
async function buscarDeputado(nome) {
  const url = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(
    nome
  )}`;

  const resp = await fetch(url);
  const json = await resp.json();

  if (!json.dados.length) return null;

  return json.dados[0]; // pega o mais parecido
}

// Busca detalhes + despesas
async function buscarCapivara(id) {
  const detalhesURL = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`;
  const despesasURL = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas`;

  const [detalhesResp, despesasResp] = await Promise.all([
    fetch(detalhesURL),
    fetch(despesasURL),
  ]);

  const detalhes = await detalhesResp.json();
  const despesas = await despesasResp.json();

  return {
    detalhes: detalhes.dados,
    despesas: despesas.dados,
  };
}

// Gera resumão Zeffa
function resumirCapivara(d) {
  const nome = d.detalhes.nomeCivil;

  const total = d.despesas.reduce((acc, x) => acc + x.valorLiquido, 0);
  const notaMaisCara = d.despesas.sort(
    (a, b) => b.valorLiquido - a.valorLiquido
  )[0];

  return `
🕵️ *Zeffa Dedo Duro – CAPIVARA FEDERAL*  

👤 *${nome}*
💰 *Total gasto:* R$ ${total.toFixed(2)}

📄 *Nota mais cara:*  
- R$ ${notaMaisCara.valorLiquido.toFixed(2)}
- ${notaMaisCara.tipoDocumento}

Zeffa rastreou tudo 😘
`;
}

export async function cmdDeputado(msg, sock) {
  const texto =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    "";

  const nome = texto.replace("!deputado", "").trim();

  if (!nome.length)
    return {
      tipo: "texto",
      resposta: "Digite assim → *!deputado nome do cara*",
    };

  // Passo 1 — achar deputado
  const encontrado = await buscarDeputado(nome);

  if (!encontrado)
    return {
      tipo: "texto",
      resposta: `Não achei nenhum deputado com nome parecido com *${nome}*.`,
    };

  // Passo 2 — pegar gastos
  const capivara = await buscarCapivara(encontrado.id);

  // Passo 3 — gerar texto Zeffa
  const resumo = resumirCapivara(capivara);

  return {
    tipo: "texto",
    resposta: resumo,
  };
}

// FIM deputado.js