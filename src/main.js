import "dotenv/config";
import { chromium } from "playwright";
import { MainCrawler } from "./crawlers/mainCrawler.js";
import { saveToExcel } from "./utils/saveToExcel.js";

(async () => {
  console.log("🚀 Iniciando navegador...");
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      timeout: 60000,
    });
  } catch (error) {
    console.error("❌ Falha ao iniciar navegador:", error.message);
    process.exit(1);
  }

  console.log("📄 Abrindo nova página...");
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1280, height: 800 });
  console.log("⚙️ Configurações da página aplicadas");

  try {
    const crawler = new MainCrawler(page);
    console.log("🕷️ Iniciando crawler...");

    const results = await crawler.run();

    console.log(`✅ Processo concluído! ${results.length} cotações obtidas`);

    console.log("💾 Salvando resultados...");
    await saveToExcel(results, "cotacoes_finais.xlsx");
    console.log("📊 Arquivo Excel salvo com sucesso!");
  } catch (error) {
    console.error("🔥 ERRO DURANTE SCRAPING:", error.message);
    console.error("Stack trace:", error.stack);

    await page.screenshot({ path: "logs/erro-critico.png" });
    console.log("📸 Screenshot do erro salvo em logs/erro-critico.png");
  } finally {
    console.log("🛑 Fechando navegador...");
    await browser.close();
    console.log("👋 Processo finalizado");
  }
})();
