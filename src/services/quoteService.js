export class QuoteService {
  constructor(page) {
    this.page = page;
    this.selectors = {
      activityInput: 'input[id="riskInfo.activityCode"]',
      activityDropdown: 'div.ds-editable-select__list[data-testid="ds-list"]',
      activityOption: "option.ds-editable-select__option",
      personTypeSelect: "select#riskInfo\\.personType",
      coverageSelect: "select#riskInfo\\.insuredAmountIntended",
      revenueSelect: "select#riskInfo\\.grossRevenue",

      dropdownMenu: '[data-testid="ds-select-dropdown"]',
      submitButtonText: '.ds-button__text:has-text("Analisar")',
      premiumValue: ".premium-value",
      loadingIndicator: ".loading-spinner",
    };
  }

  async GetAllPossibleQuotes() {
    try {
      await this.page.click(this.selectors.activityInput);
      await this.page.fill(this.selectors.activityInput, "");

      await this.page.keyboard.press("Space");
      await this.page.waitForTimeout(1000);

      await this.page.waitForFunction(
        () => {
          const dropdown = document.querySelector(
            'div.ds-editable-select__list[data-testid="ds-list"]'
          );
          return dropdown && dropdown.offsetParent !== null;
        },
        { timeout: 15000 }
      );

      await this._scrollDropdown();

      return await this.page.$$eval(this.selectors.activityOption, (options) =>
        options.map((opt) => opt.textContent.trim())
      );
    } catch (error) {
      console.error("Erro na coleta:", error);
      await this._takeScreenshot("dropdown-error");
      return [];
    }
  }
  async _scrollDropdown() {
    let lastHeight = 0;
    let attempts = 0;

    do {
      const newHeight = await this.page.evaluate((selector) => {
        const dropdown = document.querySelector(selector);
        if (!dropdown) return 0;

        const before = dropdown.scrollHeight;
        dropdown.scrollTop = dropdown.scrollHeight;
        return dropdown.scrollHeight;
      }, this.selectors.activityDropdown);

      if (newHeight === lastHeight) break;

      lastHeight = newHeight;
      attempts++;
      await this.page.waitForTimeout(800);
    } while (attempts < 5);
  }
  async _selectProfession(profession) {
    try {
      await this.page.fill(this.selectors.activityInput, "");
      await this.page.type(this.selectors.activityInput, profession, {
        delay: 150,
      });

      await this.page.waitForSelector(
        `${this.selectors.activityOption}:has-text("${profession}")`,
        { state: "visible", timeout: 10000 }
      );

      await this.page.click(
        `${this.selectors.activityOption}:has-text("${profession}")`
      );

      await this.page.waitForSelector(this.selectors.coverageSelect, {
        state: "attached",
        timeout: 15000,
      });
    } catch (error) {
      console.error(`Erro ao selecionar profissão ${profession}:`, error);
      throw error;
    }
  }
  async _collectVisibleOptions() {
    const dropdownSelector = await this.page.evaluate(() => {
      const selectors = [
        ".ds-select__menu",
        '[role="listbox"]',
        ".dropdown-menu",
        ".autocomplete-list",
      ];

      for (const sel of selectors) {
        if (document.querySelector(sel)) return sel;
      }
      return null;
    });

    if (!dropdownSelector) return [];

    await this._scrollDropdown(dropdownSelector);

    return this.page.$$eval(
      `${dropdownSelector} ${this.selectors.activityOption}`,
      (options) => options.map((opt) => opt.textContent.trim())
    );
  }

  /**
   * Preenche e obtém uma cotação específica
   * @param {string} profession - Nome da profissão/atividade
   * @returns {Promise<Object>} Resultado da cotação
   */
  async getQuote(profession) {
    try {
      console.log(`📝 Processando cotação para: ${profession}`);

      await this._selectProfession(profession);

      const options = {
        personType: await this._getSelectOptions(
          this.selectors.personTypeSelect
        ),
        coverage: await this._getSelectOptions(this.selectors.coverageSelect),
        revenue: await this._getSelectOptions(this.selectors.revenueSelect),
      };

      return await this._testValidCombinations(profession, options);
    } catch (error) {
      console.error(`⚠️ Erro na cotação para ${profession}:`, error.message);
      await this._takeScreenshot(
        `quote-error-${profession.replace(/\s/g, "_")}`
      );
      return {
        profession,
        error: error.message,
        success: false,
      };
    }
  }

  async _selectProfession(profession) {
    await this.page.fill(this.selectors.activityInput, "");
    await this.page.type(this.selectors.activityInput, profession, {
      delay: 100,
    });

    await this.page.waitForSelector(this.selectors.activityOption, {
      state: "attached",
      timeout: 10000,
    });

    await this.page.click(
      `${this.selectors.activityOption}:has-text("${profession}")`
    );
    await this.page.waitForTimeout(500);
  }

  async _testValidCombinations(profession, options) {
    const results = [];

    for (const personType of options.personType) {
      await this.page.selectOption(this.selectors.personTypeSelect, {
        value: personType.value,
      });

      await this.page.waitForTimeout(1000);

      for (const coverage of options.coverage) {
        await this.page.selectOption(this.selectors.coverageSelect, {
          value: coverage.value,
        });

        if (personType.value === "2") {
          const revenueOptions = await this._getSelectOptions(
            this.selectors.revenueSelect
          );

          if (revenueOptions.length === 0) {
            console.log(`⚠️ Nenhuma opção de faturamento para ${profession}`);
            continue;
          }

          for (const revenue of revenueOptions) {
            await this.page.selectOption(this.selectors.revenueSelect, {
              value: revenue.value,
            });

            await this.page.waitForTimeout(500);

            const result = await this._submitQuote(
              profession,
              personType,
              coverage,
              revenue
            );
            results.push(result);
          }
        } else {
          const result = await this._submitQuote(
            profession,
            personType,
            coverage,
            null
          );
          results.push(result);
        }
      }
    }

    return results.filter((r) => r !== null);
  }

  async _handlePF(coverage, profession, personType, results) {
    try {
      await this.page.selectOption(this.selectors.coverageSelect, {
        value: coverage.value,
      });

      const result = await this._submitForm(profession, personType, coverage);
      results.push(result);
    } catch (error) {
      console.error(`Erro na cobertura ${coverage.label}:`, error);
    }
  }

  async _handlePJ(coverage, revenues, profession, personType, results) {
    try {
      await this.page.selectOption(this.selectors.coverageSelect, {
        value: coverage.value,
      });

      for (const revenue of revenues) {
        await this.page.selectOption(this.selectors.revenueSelect, {
          value: revenue.value,
        });

        const result = await this._submitForm(
          profession,
          personType,
          coverage,
          revenue
        );
        results.push(result);
      }
    } catch (error) {
      console.error(`Erro no faturamento:`, error);
    }
  }

  async _submitQuote(profession, personType, coverage, revenue) {
    try {
      await this.page.selectOption(this.selectors.coverageSelect, {
        value: coverage.value,
      });

      if (personType.value === "2" && revenue) {
        await this.page.selectOption(this.selectors.revenueSelect, {
          value: revenue.value,
        });
      }

      const button = await this.page.waitForSelector(
        this.selectors.submitButtonText,
        { state: "visible", timeout: 15000 }
      );

      await Promise.all([
        this.page.waitForNavigation({ waitUntil: "networkidle" }),
        button.click(),
      ]);
      if (await this.page.isVisible(this.selectors.errorMessage)) {
        const error = await this.page.textContent(this.selectors.errorMessage);
        return this._buildResult(
          profession,
          personType,
          coverage,
          revenue,
          null,
          error
        );
      }

      const premium = await this.page.textContent(this.selectors.premiumValue);
      return this._buildResult(
        profession,
        personType,
        coverage,
        revenue,
        premium
      );
    } catch (error) {
      console.error("Erro ao submeter cotação:", error);
      return null;
    }
  }

  async _getSelectOptions(selector) {
    try {
      return await this.page.$$eval(
        `${selector} option:not([disabled])`,
        (options) =>
          Array.from(options)
            .map((opt) => ({
              value: opt.value,
              label: opt.textContent.trim(),
            }))
            .filter((opt) => opt.value && opt.label)
      );
    } catch (error) {
      console.error(`Erro ao obter opções para ${selector}:`, error);
      return [];
    }
  }

  async _scrollDropdown(selector) {
    let previousHeight = 0;
    let attempts = 0;

    do {
      previousHeight = await this.page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (!el) return 0;

        el.scrollTop = el.scrollHeight;
        return el.scrollHeight;
      }, selector);

      await this.page.waitForTimeout(800);
      attempts++;
    } while (attempts < 3);
  }

  _buildResult(
    profession,
    personType,
    coverage,
    revenue,
    premium,
    error = null
  ) {
    return {
      timestamp: new Date().toISOString(),
      profession,
      personType: personType.label,
      coverage: coverage.label,
      revenue: revenue?.label || "N/A",
      premium: premium ? this._parsePremium(premium) : null,
      error,
      success: !error && premium !== null,
    };
  }

  _parsePremium(premiumText) {
    const numeric = premiumText.replace(/[^\d,]/g, "").replace(",", ".");
    return parseFloat(numeric);
  }

  async _takeScreenshot(name) {
    await this.page.screenshot({
      path: `logs/${name}-${Date.now()}.png`,
      fullPage: true,
    });
  }
}
