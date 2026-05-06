const { BasePage } = require("./BasePage");
const { expect } = require("@playwright/test");

class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.url = 'https://web.aibat.vn/dang-nhap';

    this.phoneInput = page.getByRole("textbox", { name: "Số điện thoại" });
    this.passwordInput = page.getByRole("textbox", { name: "Mật khẩu" });
    this.loginButton = page.getByRole("button", { name: "Đăng nhập" });
    this.storeItem = page.locator(".store-item");
    this.confirmBranchButton = page.getByRole("button", { name: /Xác nhận chọn chi nhánh/});
    this.errorMessage = page.locator(
      '.error-message, .alert-danger, [class*="error"]',
    );
  }

  async open() {
    await this.goto(this.url);
    await this.waitForLoad();
  }

  async fillCredentials(phone, password) {
    await this.phoneInput.fill(phone);
    await this.passwordInput.fill(password);
  }

  async submitLogin() {
    await this.loginButton.click();
  }

  async selectFirstBranch() {
    await this.storeItem.first().click();
    await this.confirmBranchButton.click();
  }

  async login(phone, password) {
    await this.fillCredentials(phone, password);
    await this.submitLogin();
    await this.selectFirstBranch();
  }

  async loginAsValidUser() {
    const phone = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    if (!phone || !password) {
      throw new Error("TEST_USERNAME/TEST_PASSWORD chưa cấu hình trong .env");
    }
    await this.login(phone, password);
  }
    async loginAsValidUserFNB() {
    const phone = process.env.FNB_USERNAME;
    const password = process.env.FNB_PASSWORD;
    if (!phone || !password) {
      throw new Error("FNB_USERNAME/FNB_PASSWORD chưa cấu hình trong .env");
    }
    await this.login(phone, password);
  }

  async expectLoginSuccess() {
    await this.page.waitForURL((url) => !url.pathname.includes("dang-nhap"), {
      timeout: 20000,
    });
  }

  async expectLoginFailed() {
    await this.errorMessage.waitFor({ state: "visible", timeout: 10000 });
    const text = (await this.errorMessage.textContent()) || "";
    expect(text.length).toBeGreaterThan(0);
    return text;
  }

  async verifyLoginPageLoaded() {
    await this.phoneInput.waitFor({ state: "visible" });
    await this.passwordInput.waitFor({ state: "visible" });
    await this.loginButton.waitFor({ state: "visible" });
  }
  async selectFirstBranch() {
    if (await this.storeItem.first().isVisible({ timeout: 5000 })) {
        await this.storeItem.first().click();
        await this.confirmBranchButton.click();
    }
  }
}
  

module.exports = { LoginPage };