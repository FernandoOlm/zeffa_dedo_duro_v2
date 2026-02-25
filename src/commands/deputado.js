// INÍCIO — Importações
import fetch from "node-fetch";
// FIM

// INÍCIO — Função principal
export async function cmdDeputado(sock, msg, args) {
    try {
        const nomeBusca = args.join(" ").trim();
        if (!nomeBusca) {
            await sock.sendMessage(msg.from, { text: "Digite o nome: !deputado fulano" });
            return;
        }

        console.log("🔍 Buscando deputado:", nomeBusca);

        // INÍCIO — Buscar lista de deputados
        const urlBusca = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(nomeBusca)}`;
        const respBusca = await fetch(urlBusca);
        const dadosBusca = await respBusca.json();
        // FIM

        if (!dadosBusca?.dados?.length) {
            await sock.sendMessage(msg.from, { text: `Nenhum deputado encontrado com o nome: *${nomeBusca}*` });
            return;
        }

        const deputado = dadosBusca.dados[0];
        const id = deputado.id;

        console.log("🆔 ID encontrado:", id);

        // 🔥 ADICIONADO: puxar partido e UF do deputado
        const urlDetalhes = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}`;
        const respDetalhes = await fetch(urlDetalhes);
        const dadosDet = await respDetalhes.json();

        const ultimoStatus = dadosDet?.dados?.ultimoStatus || {};
        const partido = ultimoStatus.siglaPartido || "—";
        const uf = ultimoStatus.siglaUf || "—";

        // INÍCIO — Buscar despesas
        const urlDespesas = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?itens=1000`;
        const respDespesas = await fetch(urlDespesas);
        const dadosDespesas = await respDespesas.json();
        // FIM

        const despesas = dadosDespesas?.dados || [];

        if (despesas.length === 0) {
            await sock.sendMessage(msg.from, { text: `Deputado *${deputado.nome}* não possui despesas registradas.` });
            return;
        }

        // INÍCIO — Cálculos
        const total = despesas.reduce((s, d) => s + (d.valorLiquido || 0), 0);

        const fornecedorMap = {};
        const categoriaMap = {};
        const mesesMap = {};
        const notasMap = {};

        for (const d of despesas) {
            const fornecedor = d.nomeFornecedor || "Desconhecido";
            const categoria = d.tipoDocumento || "Outros";
            const mes = d.mes || 0;
            const chaveNota = `${d.numeroDocumento}-${d.dataDocumento}-${d.valorDocumento}`;

            fornecedorMap[fornecedor] = (fornecedorMap[fornecedor] || 0) + d.valorLiquido;
            categoriaMap[categoria] = (categoriaMap[categoria] || 0) + d.valorLiquido;
            mesesMap[mes] = (mesesMap[mes] || 0) + d.valorLiquido;
            notasMap[chaveNota] = (notasMap[chaveNota] || 0) + 1;
        }

        const fornecedorFav = Object.entries(fornecedorMap).sort((a, b) => b[1] - a[1])[0];
        const mesTop = Object.entries(mesesMap).sort((a, b) => b[1] - a[1])[0];

        const duplicadas = Object.entries(notasMap).filter(e => e[1] > 1).length;

        const totalFormat = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        // Criar barras visuais da categoria
        const categoriasFormatadas = Object.entries(categoriaMap)
            .map(([nome, valor]) => {
                const pct = ((valor / total) * 100).toFixed(1);
                const barras = "█".repeat(Math.max(1, Math.round(pct / 5)));
                return `${nome}: ${barras} ${pct}%`;
            })
            .join("\n");
        // FIM cálculos

        // INÍCIO — Montar mensagem
        const resposta = `
🕵️ *Zeffa Dedo Duro investigou ${deputado.nome}:*
━━━━━━━━━━━━━━━━━━

🏛️ *Partido:* ${partido}
📍 *Estado:* ${uf}

📌 *IMPORTANTE*  
Este relatório mostra **apenas a COTA PARLAMENTAR**, que são *gastos reembolsáveis*.  
**Não inclui salário, verba de gabinete, assessores, auxílio ou benefícios internos.**

━━━━━━━━━━━━━━━━━━

💸 *Total gasto no mandato:*  
➡️ ${totalFormat}

🧾 *Fornecedor favorito:*  
➡️ ${fornecedorFav[0]}  
➡️ Representa ${(fornecedorFav[1] / total * 100).toFixed(1)}% do total  
➡️ Valor: ${fornecedorFav[1].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}

📆 *Mês mais gastador:*  
➡️ ${mesTop[0]} — ${mesTop[1].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}

📄 *Notas duplicadas:*  
➡️ ${duplicadas > 0 ? `${duplicadas} encontradas 👀` : "nenhuma ✔️"}

━━━━━━━━━━━━━━━━━━
📊 *Gastos por categoria:*  
${categoriasFormatadas}
━━━━━━━━━━━━━━━━━━

📚 *Fontes oficiais:*  
• Câmara dos Deputados — Dados Abertos  
• https://dadosabertos.camara.leg.br  
• Endpoints utilizados: */deputados* e */despesas*

🔥 *Zeffa passou o pente fino. Nada escapou 😘*
        `;
        // FIM mensagem

        // INÍCIO — enviar
        await sock.sendMessage(msg.from, { text: resposta });
        // FIM

    } catch (e) {
        console.error("❌ Erro no cmdDeputado:", e);
        await sock.sendMessage(msg.from, { text: "❌ Erro ao analisar o deputado." });
    }
}
// FIM