export class NavigationService {
  constructor(page) {
    this.page = page;
    this.selectors = {
      newQuoteButton: 'a[href="/nova-cotacao"]',
      rcProduct: '.icon-product span:text("RC Profissional")',
      popupClose: 'button[aria-label="Fechar"]._pendo-close-guide',
      pageLoaded: "#riskInfo\\.activityCode",
    };
  }

  async goToProfessionalRCPage() {
    try {
      await this._clickNewQuoteButton();
      await this._selectRCProduct();
      await this._closePopupIfPresent();
      await this._verifyPageLoaded();

      return true;
    } catch (error) {
      console.error("🚨 Erro na navegação:", error);
      await this._takeScreenshot("nav-error");
      throw error;
    }
  }

  async _clickNewQuoteButton() {
    await this.page.waitForSelector(this.selectors.newQuoteButton, {
      state: "attached",
      timeout: 20000,
    });

    try {
      await this.page.click(this.selectors.newQuoteButton, { timeout: 10000 });
    } catch {
      await this.page.$eval(this.selectors.newQuoteButton, (el) => el.click());
    }

    await this.page.waitForLoadState("domcontentloaded");
  }

  async _selectRCProduct() {
    await this.page.waitForTimeout(500);

    await this.page.waitForSelector(this.selectors.rcProduct, {
      state: "visible",
      timeout: 15000,
    });

    await this.page.click(this.selectors.rcProduct);
    await this.page.waitForTimeout(1000);
  }

  async _closePopupIfPresent() {
    try {
      const closeButton = await this.page.waitForSelector(
        this.selectors.popupClose,
        {
          state: "visible",
          timeout: 10000,
        }
      );

      await closeButton.click();
      await this.page.waitForTimeout(1000);
    } catch (error) {
      console.log("ℹ️ Nenhum pop-up para fechar");
    }
  }
  async _verifyPageLoaded() {
    await this.page.waitForSelector(this.selectors.pageLoaded, {
      state: "visible",
      timeout: 15000,
    });
  }

  async _takeScreenshot(name) {
    await this.page.screenshot({
      path: `logs/nav-${name}-${Date.now()}.png`,
      fullPage: true,
    });
  }
}
