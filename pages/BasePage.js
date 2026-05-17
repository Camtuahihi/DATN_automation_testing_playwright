class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto(url = '/') {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async getTitle() {
    return await this.page.title();
  }

  getCurrentUrl() {
    return this.page.url();
  }

  async waitForVisible(selector, timeout = 15000) {
    await this.page.locator(selector).waitFor({ state: 'visible', timeout });
  }

  async waitForHidden(selector, timeout = 15000) {
    await this.page.locator(selector).waitFor({ state: 'hidden', timeout });
  }

  async click(selector) {
    await this.page.locator(selector).click();
  }

  async fill(selector, value) {
    await this.page.locator(selector).fill(value);
  }

  async type(selector, value, delay = 100) {
    await this.page.locator(selector).pressSequentially(value, { delay });
  }

  async clearAndFill(selector, value) {
    await this.page.locator(selector).clear();
    await this.page.locator(selector).fill(value);
  }

  async getText(selector) {
    return (await this.page.locator(selector).textContent()) || '';
  }

  async getValue(selector) {
    return await this.page.locator(selector).inputValue();
  }

  async isVisible(selector) {
    return await this.page.locator(selector).isVisible();
  }

  async isEnabled(selector) {
    return await this.page.locator(selector).isEnabled();
  }

  async isDisabled(selector) {
    return await this.page.locator(selector).isDisabled();
  }

  async screenshot(name) {
    await this.page.screenshot({
      path: `screenshots/${name}_${Date.now()}.png`,
      fullPage: true,
    });
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async reload() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  async scrollToElement(selector) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  async selectOption(selector, value) {
    await this.page.locator(selector).selectOption(value);
  }

  async countElements(selector) {
    return await this.page.locator(selector).count();
  }

  async handleDialog(action = 'accept') {
    this.page.once('dialog', async (dialog) => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog[action]();
    });
  }

  async sleep(ms) {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Press phím trên keyboard
   * @param {string} key - 'Enter', 'Escape', 'Tab', etc.
   */
  async pressKey(key) {
    await this.page.keyboard.press(key);
  }
  async expectTextContains(selector, text) {
    const actualText = await this.getText(selector);
    if (!actualText.includes(text)) {
      throw new Error(`Expected "${text}" but got "${actualText}"`);
    }
  }
}

module.exports = { BasePage };
