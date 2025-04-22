import dotenv from "dotenv";
dotenv.config();

export class AuthService {
  constructor(page) {
    this.page = page;
    this.loginUrl = process.env.LOGIN_URL;
    this.selectors = {
      cpf: "#cpf",
      password: "#password",
      loginButton: 'button[type="submit"] >> text=Entrar',
      protectionButton: '[data-testid="continue-without-protection"]',
      newQuoteButton:
        'a[href="/nova-cotacao"]:has-text("Nova Cotação"), a.new-quote-button',
    };
  }

  async login() {
    try {
      await this._navigateToLogin();
      await this._fillCredentials();
      await this._submitLogin();
      await this._handleProtectionScreen();
      await this._verifyLoginSuccess();
      return true;
    } catch (error) {
      await this._handleLoginError(error);
      return false;
    }
  }

  async _navigateToLogin() {
    await this.page.goto(this.loginUrl),
      {
        waitUntil: "domcontentloaded",
      };
  }

  async _fillCredentials() {
    if (!process.env.CPF || !process.env.PASSWORD) {
      throw new Error("Credenciais não configuradas no .env");
    }

    await this.page.fill(
      this.selectors.cpf,
      this._cleanCpf(process.env.CPF)
    );
    await this.page.fill(this.selectors.password, process.env.PASSWORD);
  }

  async _submitLogin() {
    await this.page.click(this.selectors.loginButton);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async _handleProtectionScreen() {
    try {
      await this.page.waitForSelector(this.selectors.protectionButton, {
        timeout: 5000,
        state: "visible",
      });
      await this.page.click(this.selectors.protectionButton);
    } catch {
      console.log("⏩ Nenhuma tela de proteção encontrada");
    }
  }

  async _verifyLoginSuccess() {
    try {
      await this.page.waitForSelector(this.selectors.newQuoteButton, {
        state: "visible",
        timeout: 10000,
      });
    } catch (error) {
      await this._takeScreenshot("login-failed-missing-button");
      throw new Error(
        "Falha na verificação do login: Botão de cotação não apareceu"
      );
    }
  }

  async _handleLoginError(error) {
    console.error("❌ Falha no login:", error.message);
    await this._takeScreenshot("login-error");
    throw error;
  }

  async _takeScreenshot(name) {
    await this.page.screenshot({
      path: `logs/${name}-${new Date().toISOString()}.png`,
      fullPage: true,
    });
  }

  _cleanCpf(cpf) {
    return cpf.replace(/\D/g, "");
  }
}
