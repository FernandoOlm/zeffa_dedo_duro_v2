// INÍCIO — Importações
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
// FIM

// 🔐 Chave CGU
const CGU_KEY = process.env.CGU_API_KEY;

// Helper para chamar API CGU
async function cguGet(endpoint) {
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/${endpoint}`;

  const resp = await fetch(url, {
    headers: {
      "chave-api-dados": CGU_KEY,
      Accept: "application/json",
    },
  });

  if (!resp.ok) throw new Error("Erro CGU: " + resp.status);

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

    // 📌 Buscar dados pessoais
    const detalhesResp = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`
    );
    const detalhes = await detalhesResp.json();
    const info = detalhes?.dados;

    const partido = info?.ultimoStatus?.siglaPartido || "Desconhecido";
    const uf = info?.ultimoStatus?.siglaUf || "--";

    // ----------------------------------------------------

    // 📌 2 — Buscar despesas (cota parlamentar)
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

    // ----------------------------------------------------

    // 📌 3 — CGU — Buscar CPF do deputado
    const pessoa = await cguGet(
      `pessoas?nome=${encodeURIComponent(deputado.nome)}`
    );

    const cpf = pessoa?.[0]?.cpf || null;

    // ----------------------------------------------------

    // 📌 4 — CGU — Buscar vínculos (pra puxar salário)
    let salario = "Não encontrado";
    let cargo = "—";
    let vinculoId = null;

    if (cpf) {
      const vinculos = await cguGet(
        `servidores/vinculos?cpf=${cpf}&pagina=1`
      );

      const ativo = vinculos?.find((v) => v.situacao === "Ativo");

      if (ativo) {
        vinculoId = ativo.id;
        cargo = ativo.cargo;
      }
    }

    // ----------------------------------------------------

    // 📌 5 — CGU — Buscar salário do deputado
    let salarioFinal = "Não localizado";

    if (vinculoId) {
      const remuneracao = await cguGet(
        `servidores/remuneracao?codigo=VINCULO:${vinculoId}`
      );

      if (remuneracao?.[0]?.remuneracaoBasicaBruta) {
        salarioFinal = Number(
          remuneracao[0].remuneracaoBasicaBruta
        ).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      }
    }

    // ----------------------------------------------------

    // 📌 6 — CGU — Buscar assessores do gabinete
    let assessores = [];

    if (cpf) {
      assessores = await cguGet(
        `servidores/porOrgao?codigoOrgao=20&page=1&cpfParlamentar=${cpf}`
      );
    }

    const totalAssessores = assessores.length;

    // Somar folha
    let totalFolha = 0;
    const ranking = [];

    for (let a of assessores) {
      let sal = a?.remuneracao?.remuneracaoBasicaBruta || 0;

      ranking.push({
        nome: a.nome,
        salario: sal,
      });

      totalFolha += sal;
    }

    const folhaBR = totalFolha.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    const maiorAssessor = ranking.sort((a, b) => b.salario - a.salario)[0];

    // ----------------------------------------------------
    // 📌 7 — Montar mensagem final

    const resposta = `
🕵️ *Zeffa investigou ${deputado.nome}:*
(${partido} - ${uf})

━━━━━━━━━━━━━━━━━━
📌 *REMUNERAÇÃO*
• Salário bruto: ${salarioFinal}
• Cargo: ${cargo}

📌 *GABINETE*
• Assessores: ${totalAssessores}
• Folha mensal: ${folhaBR}
• Maior salário: ${maiorAssessor?.nome} — ${maiorAssessor?.salario.toLocaleString(
      "pt-BR",
      { style: "currency", currency: "BRL" }
    )}

━━━━━━━━━━━━━━━━━━
📌 *COTA PARLAMENTAR (despesas reembolsáveis)*
Total gasto: ${totalCotaBR}

━━━━━━━━━━━━━━━━━━
📚 *Fontes oficiais*
• Câmara dos Deputados — Dados Abertos
• Portal da Transparência — CGU (API oficial)
━━━━━━━━━━━━━━━━━━

🔥 *Zeffa varreu TUDO. Sem dó 😘*
`;

    await sock.sendMessage(msg.from, { text: resposta });
  } catch (e) {
    console.error("❌ Erro no cmdDeputado:", e);
    await sock.sendMessage(msg.from, {
      text: "❌ Erro ao investigar o deputado.",
    });
  }
}