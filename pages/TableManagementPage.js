const { BasePage } = require('./BasePage');

/**
 * TableManagementPage - Quản lý giao diện Bàn và Chuyển bàn
 * Tối ưu hóa cho việc click và đợi các thành phần render
 */
class TableManagementPage extends BasePage {
  constructor(page) {
    super(page);

    // --- Selectors ---
    this.tableCards = '.room-card';
    this.busyTableCards = '.room-card-busy';
    this.freeTableCards = '.room-card-free';
    
    // Menu xuất hiện sau khi click vào bàn
    this.activeMenu = '.v-menu__content--active';
    this.transferBtn = 'text=/Chuyển bàn/i';
    
    // Dialog Chuyển bàn
    this.transferDialog = '.v-dialog--active';
    this.closeDialogBtn = '.v-dialog--active .v-card__title.border-title-dialog button';
    
    // Dialog Xác nhận (Cấp 2)
    this.confirmBtn = 'button:has-text("Xác nhận")';
    this.cancelBtn = 'button:has-text("Hủy bỏ")';
    
    this.toastMessage = '.v-snack__wrapper .v-snack__content, .v-snack__wrapper';
  }

  /**
   * Tìm locator của một bàn chính xác theo tên
   */
  async getTableLocator(tableName) {
    // Sử dụng filter với regex để tránh nhầm "Bàn 1" với "Bàn 11"
    return this.page.locator(this.tableCards)
      .filter({ hasText: new RegExp(tableName, 'i') }); 
  }

  /**
   * Kiểm tra trạng thái bàn (Bận/Trống)
   */
  async isTableBusy(tableName) {
    // Chờ cho đến khi ít nhất 1 bàn xuất hiện trên màn hình
    await this.page.waitForSelector(this.tableCards, { timeout: 15000 });
    
    const table = await this.getTableLocator(tableName);
    // Lấy phần tử đầu tiên khớp (tránh lỗi nếu có nhiều bàn trùng tên ở các khu vực)
    const firstTable = table.first();
    
    await firstTable.waitFor({ state: 'visible', timeout: 10000 });
    const className = await firstTable.getAttribute('class') || '';
    return className.includes('room-card-busy');
  }

  /**
   * Thực hiện click vào bàn để mở menu điều khiển
   */
  async openTableMenu(tableName) {
    // 1. Chờ dữ liệu hiển thị
    await this.page.waitForLoadState('networkidle');
    
    // 2. Tìm phần tử chứa đúng tên bàn
    // Thay vì click vào card, hãy tìm thẻ div/span chứa chữ "Bàn 1" bên trong card đó
    const tableTitle = this.page.locator('.room-card .v-card__title, .room-card div')
      .filter({ hasText: new RegExp(`^${tableName}$`, 'i') })
      .first();

    await tableTitle.waitFor({ state: 'visible', timeout: 10000 });
    await tableTitle.scrollIntoViewIfNeeded();

    // 3. Click chính xác vào text tên bàn để đảm bảo menu hiện ra
    await tableTitle.click({ force: true });
    
    // 4. Đợi một chút để hiệu ứng menu hoàn tất
    await this.page.waitForTimeout(1000);
  }

  /**
   * Click nút Chuyển bàn trong menu ngữ cảnh
   */
  async clickTransfer() {
  // Tìm nút "Chuyển bàn" trên toàn bộ trang thay vì chỉ trong menu, 
  // vì đôi khi Vuetify render menu ở cấp body.
  const btn = this.page.getByText('Chuyển bàn', { exact: false }).last();
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await this.waitForVisible(this.transferDialog);
  }

  /**
   * Chọn bàn đích trong popup
   */
  async selectTargetTableInPopup(tableName) {
    // 1. Đợi popup load xong nội dung
    await this.page.waitForSelector('.v-dialog--active .room-card, .v-dialog--active button', { timeout: 10000 });

    // 2. Tìm bàn đích trong popup. 
    // Bỏ ^ và $ để khớp linh hoạt hơn, và không dùng exact match
    const target = this.page.locator('.v-dialog--active button, .v-dialog--active .room-card')
      .filter({ hasText: new RegExp(tableName, 'i') })
      .first(); // Lấy cái đầu tiên nếu có nhiều kết quả
    
    // 3. Cuộn đến bàn đó nếu danh sách quá dài
    await target.scrollIntoViewIfNeeded();
    
    // 4. Đợi visible và click
    await target.waitFor({ state: 'visible', timeout: 10000 });
    await target.click({ force: true });
  }

  /**
   * Lấy text thông báo toast
   */
  async getToastMessage() {
    await this.waitForVisible(this.toastMessage);
    return await this.getText(this.toastMessage);
  }
  // Hoặc một cách viết an toàn hơn bằng Playwright Locator:
async closeTransferDialog() {
  // Tìm dialog đang mở, sau đó tìm nút button bên trong header của nó
  const activeDialog = this.page.locator('.v-dialog--active');
  const closeBtn = activeDialog.locator('.v-card__title button').first(); 
  
  await closeBtn.waitFor({ state: 'visible' });
  await closeBtn.click();
}
}

module.exports = { TableManagementPage };