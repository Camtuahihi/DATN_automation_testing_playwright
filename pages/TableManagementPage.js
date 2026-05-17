const { BasePage } = require('./BasePage');
class TableManagementPage extends BasePage {
  constructor(page) {
    super(page);

    //Selectors 
    this.tableCards = '.room-card';
    this.busyTableCards = '.room-card-busy';
    this.freeTableCards = '.room-card-free';
    
    // Menu
    this.activeMenu = '.v-menu__content--active';
    this.transferBtn = 'text=/Chuyển bàn/i';
    
    // Dialog Chuyển bàn
    this.transferDialog = '.v-dialog--active';
    this.closeDialogBtn = '.v-dialog--active .v-card__title.border-title-dialog button';
    
    // Dialog Xác nhận
    this.confirmBtn = 'button:has-text("Xác nhận")';
    this.cancelBtn = 'button:has-text("Hủy bỏ")';
    
    this.toastMessage = '.v-snack__wrapper .v-snack__content, .v-snack__wrapper';
  }
  async getTableLocator(tableName) {

    return this.page.locator(this.tableCards)
      .filter({ hasText: new RegExp(tableName, 'i') }); 
  }

  async isTableBusy(tableName) {
    await this.page.waitForSelector(this.tableCards, { timeout: 15000 });
    const table = await this.getTableLocator(tableName);
    const firstTable = table.first();
    
    await firstTable.waitFor({ state: 'visible', timeout: 10000 });
    const className = await firstTable.getAttribute('class') || '';
    return className.includes('room-card-busy');
  }

  async openTableMenu(tableName) {
    await this.page.waitForLoadState('networkidle');

    const tableTitle = this.page.locator('.room-card .v-card__title, .room-card div')
      .filter({ hasText: new RegExp(`^${tableName}$`, 'i') })
      .first();

    await tableTitle.waitFor({ state: 'visible', timeout: 10000 });
    await tableTitle.scrollIntoViewIfNeeded();

    await tableTitle.click({ force: true });

    await this.page.waitForTimeout(1000);
  }

  async clickTransfer() {
  const btn = this.page.getByText('Chuyển bàn', { exact: false }).last();
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await this.waitForVisible(this.transferDialog);
  }

  async selectTargetTableInPopup(tableName) {
    await this.page.waitForSelector('.v-dialog--active .room-card, .v-dialog--active button', { timeout: 10000 });
    const target = this.page.locator('.v-dialog--active button, .v-dialog--active .room-card')
      .filter({ hasText: new RegExp(tableName, 'i') })
      .first(); 
    await target.scrollIntoViewIfNeeded();
    await target.waitFor({ state: 'visible', timeout: 10000 });
    await target.click({ force: true });
  }

  async getToastMessage() {
    await this.waitForVisible(this.toastMessage);
    return await this.getText(this.toastMessage);
  }
async closeTransferDialog() {
  const activeDialog = this.page.locator('.v-dialog--active');
  const closeBtn = activeDialog.locator('.v-card__title button').first(); 
  
  await closeBtn.waitFor({ state: 'visible' });
  await closeBtn.click();
}
}

module.exports = { TableManagementPage };