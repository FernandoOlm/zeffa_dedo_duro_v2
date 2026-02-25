// INÍCIO — senador.js (API NOVA 100% JSON)
import fetch from "node-fetch";

export async function cmdSenador(sock, { from }, args = []) {
    try {
        const nome = args.join(" ").trim();
        if (!nome) {
            await sock.sendMessage(from, { text: "❗ Use: *!senador nome*" });
            return;
        }

        // API NOVA — sempre JSON
        const listaURL = "https://www.senado.leg.br/transparencia/lsv/senadores.json";
        const dados = await (await fetch(listaURL)).json();

        const lista =
            dados?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];

        // Fuzzy básico
        const senador = lista.find(s =>
            s.IdentificacaoParlamentar.NomeParlamentar
                .toLowerCase()
                .includes(nome.toLowerCase())
        );

        if (!senador) {
            await sock.sendMessage(from, {
                text: `❌ Nenhum senador encontrado parecido com: *${nome}*`
            });
            return;
        }

        const info = senador.IdentificacaoParlamentar;
        const id = info.CodigoParlamentar;
        const nomeSen = info.NomeParlamentar;
        const partido = info.SiglaPartidoParlamentar;
        const uf = info.UfParlamentar;

        // 🔥 Despesas (API nova)
        const urlDesp = `https://www.senado.leg.br/transparencia/lsv/despesa_ceaps_${id}.json`;
        const dadosDesp = await (await fetch(urlDesp)).json();

        const despesas =
            dadosDesp?.DetalhamentoDocumentoParlamentar?.Documentos?.Documento || [];

        let total = 0;
        const categorias = {};

        despesas.forEach(d => {
            const val = Number(d?.ValorReembolsado || 0);
            total += val;

            const tipo = d?.TipoDespesa || "Outros";
            categorias[tipo] = (categorias[tipo] || 0) + val;
        });

        const totalFormat = total.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        let catTexto = "";
        for (const c in categorias) {
            const pct = ((categorias[c] / total) * 100).toFixed(1);
            catTexto += `- ${c}: ${pct}%\n`;
        }

        const resposta = `
🟦 *Zeffa investigou o Senador ${nomeSen}:*

🏛️ Partido: ${partido}
📍 Estado: ${uf}

💸 Total reembolsado: ${totalFormat}

📊 Gastos por categoria:
${catTexto}

📌 Fonte: Senado Federal — Transparência (API nova)
`;

        await sock.sendMessage(from, { text: resposta });

    } catch (e) {
        console.error("Erro senador:", e);
        await sock.sendMessage(from, { text: "❌ Erro ao consultar senador!" });
    }
}