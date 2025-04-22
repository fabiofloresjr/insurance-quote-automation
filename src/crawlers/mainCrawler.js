import { AuthService } from "../services/authService.js";
import { NavigationService } from "../services/navigationService.js";
import { QuoteService } from "../services/quoteService.js";

export class MainCrawler {
  constructor(page) {
    this.page = page;

    this.authService = new AuthService(page);
    this.navigationService = new NavigationService(page);
    this.quoteService = new QuoteService(page);

    this.config = {
      delayBetweenRequests: 2000,
      maxRetryAttempts: 3,
    };
  }

  async run() {
    try {
      console.log("🚀 Iniciando processo de scraping");

      await this._authenticate();

      await this._navigateToQuotes();

      const results = await this._collectAllQuotes();

      console.log(`🎉 Processo concluído! ${results.length} cotações obtidas`);
      return results;
    } catch (error) {
      console.error("⛔ ERRO NO FLUXO PRINCIPAL:", error.message);
      await this._takeScreenshot("main-flow-error");
      throw error;
    }
  }

  async _authenticate() {
    let attempts = 0;

    while (attempts < this.config.maxRetryAttempts) {
      try {
        console.log(
          `🔐 Tentativa de login ${attempts + 1}/${
            this.config.maxRetryAttempts
          }`
        );
        const success = await this.authService.login();

        if (success) {
          console.log("✅ Login realizado com sucesso");
          return;
        }
      } catch (error) {
        console.error(
          `⚠️ Falha na autenticação (tentativa ${attempts + 1}):`,
          error.message
        );
      }

      attempts++;
      await this.page.waitForTimeout(this.config.delayBetweenRequests);
    }

    throw new Error(
      "Falha crítica: Não foi possível autenticar após várias tentativas"
    );
  }

  async _navigateToQuotes() {
    console.log("🧭 Navegando para página de cotações...");

    await this.navigationService.goToProfessionalRCPage();
    await this.page.waitForSelector(this.quoteService.selectors.activityInput, {
      state: "visible",
      timeout: 15000,
    });

    console.log("📍 Navegação concluída com sucesso");
  }

  async _collectAllQuotes() {
    await this._verifyPageStructure();
    console.log("📊 Iniciando coleta de cotações...");
    const allResults = [];

    const professions = await this.quoteService.GetAllPossibleQuotes();

    if (professions.length === 0) {
      throw new Error("Nenhuma profissão encontrada - verifique os seletores");
    }

    console.log(`📋 ${professions.length} profissões para processar`);

    for (const [index, profession] of professions.entries()) {
      try {
        console.log(
          `\n${index + 1}/${professions.length} Processando: ${profession}`
        );

        const results = await this._getQuotesWithRetry(profession);
        allResults.push(...results);

        if ((index + 1) % 5 === 0 || index === professions.length - 1) {
          console.log(
            `🔄 Progresso: ${index + 1}/${professions.length} (${
              allResults.length
            } cotações)`
          );
          await this._savePartialResults(allResults, index);
        }
      } catch (error) {
        console.error(`⚠️ Erro grave em ${profession}:`, error.message);
        await this._takeScreenshot(`profession-error-${index}`);
      }

      await this.page.waitForTimeout(this.config.delayBetweenRequests);
    }

    return allResults;
  }

  async _verifyPageStructure() {
    const requiredElements = [
      'input[data-testid="ds-editable-select"]',
      "select#riskInfo\\.personType",
    ];

    for (const selector of requiredElements) {
      if (!(await this.page.isVisible(selector))) {
        await this._takeScreenshot(
          `missing-element-${selector.replace(/[^a-z]/gi, "")}`
        );
        throw new Error(`Elemento crítico não encontrado: ${selector}`);
      }
    }
  }

  async _getQuotesWithRetry(profession, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.quoteService.getQuote(profession);
      } catch (error) {
        console.error(
          `⚠️ Tentativa ${attempt} falhou para ${profession}:`,
          error.message
        );

        if (attempt === maxAttempts) throw error;

        await this._recoverFromError();
        await this.page.waitForTimeout(attempt * 2000);
      }
    }
  }

  async _recoverFromError() {
    try {
      await this.page.goto("https://hub.akadseguros.com.br/analise-risco/eao");
      await this.page.waitForTimeout(1000);

      await this.navigationService.goToProfessionalRCPage();
    } catch (recoveryError) {
      console.error("Falha na recuperação:", recoveryError.message);
      throw recoveryError;
    }
  }

  async _savePartialResults(results, index) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `backup/partial-results-${index}-${timestamp}.json`;

      console.log(`📦 Backup salvo: ${filename}`);
    } catch (error) {
      console.error("Erro ao salvar backup:", error.message);
    }
  }
  async debugDropdown() {
    console.log("🐛 Iniciando debug do dropdown...");

    const inputVisible = await this.page.isVisible(
      this.quoteService.selectors.activityInput
    );
    console.log("✏️ Campo de input visível:", inputVisible);

    await this.page.fill(this.quoteService.selectors.activityInput, "");
    await this.page.type(this.quoteService.selectors.activityInput, "med", {
      delay: 100,
    });

    try {
      await this.page.waitForSelector(
        this.quoteService.selectors.dropdownMenu,
        {
          state: "visible",
          timeout: 5000,
        }
      );
      console.log("▾ Dropdown apareceu com sucesso");

      const options = await this.page.$$eval(
        this.quoteService.selectors.activityOption,
        (opts) => opts.slice(0, 5).map((o) => o.textContent.trim())
      );
      console.log("📋 Amostra de opções:", options);
    } catch (error) {
      console.error("🔴 Dropdown não apareceu");
      await this._takeScreenshot("debug-dropdown-fail");
    }

    console.log("🔄 Tentando alternativas...");
    await this._tryAlternativeSelectors();
  }

  async _takeScreenshot(name) {
    try {
      const path = `logs/${name}-${Date.now()}.png`;
      await this.page.screenshot({ path });
      console.log(`📸 Screenshot salvo: ${path}`);
    } catch (error) {
      console.error("Falha ao capturar screenshot:", error.message);
    }
  }
}
