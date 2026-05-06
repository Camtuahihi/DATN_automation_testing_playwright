const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

/**
 * OrderPage - Màn hình Tạo đơn bán hàng
 * UC02: Tra cứu sản phẩm | UC03: Thiết lập chi tiết đơn hàng
 *
 * Cấu trúc DOM thực tế (inspect từ https://web.aibat.vn/tao-don-ban-v2):
 *  - Sidebar: div.sidebar-right
 *  - Product list container: .main-left .product-list-scroll > div.col.col-12
 *  - Individual product rows: .main-left .product-list-scroll > div.col.col-12 > div (no class)
 *  - Each row has 4 inputs (type=text): [0]=price, [1]=qty, [2]=discount, [3]=VAT
 *  - Discount toggles: <p>%</p> and <p>đ</p> within row
 *  - Dropdown container: div.product-search-dropdown
 *  - Product items: .product-search-dropdown .v-list-item
 */
class OrderPage extends BasePage {
  constructor(page) {
    super(page);
    this.url = '/tao-don-ban-v2';

    // ── Tìm kiếm sản phẩm ─────────────────────────────────────────────
    this.searchInput = page.getByPlaceholder('Nhập sản phẩm (F2)');

    // ── Nhóm mặt hàng ─────────────────────────────────────────────────
    this.categoryTabs = page.locator('.category-scroll span');

    // ── Dropdown container ─────────────────────────────────────────────
    this.dropdownContainer = page.locator('.product-search-dropdown');

    // ── Danh sách sản phẩm trong dropdown ─────────────────────────────
    this.productDropdown = page.locator('.product-search-dropdown .v-list-item').filter({
      hasNot: page.locator('.v-list-item__title.grey--text'),
    });

    // ── Thông báo không có dữ liệu ────────────────────────────────────
    this.noDataMessage = page.locator('.product-search-dropdown .v-list-item__title.grey--text');

    //UC_04
    // Selectors màn hình chính
    this.createOrderButton = page.locator('div').filter({ hasText: /^Tạo đơn \(F9\)$/ }).last();
    this.notification = page.locator('.vue-notification-group');

    // Selectors Pop-up Hóa đơn (v-dialog)
    this.invoiceDialog = page.locator('.v-dialog--active .v-card');
    this.invoiceNo = this.invoiceDialog.locator('text=/No: [A-Z0-9]+/').first();
    this.invoiceTotal = this.invoiceDialog.locator('text=/TỔNG TIỀN THANH TOÁN/');
    
    // Buttons trên Pop-up
    this.printButton = this.invoiceDialog.getByRole('button', { name: 'In đơn' });
    this.cancelButton = this.invoiceDialog.getByRole('button', { name: 'Hủy' });
    this.eInvoiceButton = this.invoiceDialog.getByRole('button', { name: 'Hóa đơn điện tử' });
  }

  // ── Navigation ───────────────────────────────────────────────────────

  async open() {
    await this.goto(this.url);
    await this.waitForLoad();
    await this._handleBranchModalIfVisible();
    await this._clearExistingOrderRows();
  }

  async _clearExistingOrderRows() {
    for (let attempt = 0; attempt < 15; attempt++) {
      const count = await this.orderRows.count().catch(() => 0);
      if (count === 0) break;
      const prevCount = count;
      const btn = this.getDeleteBtn(0);
      const clicked = await btn.waitFor({ state: 'attached', timeout: 2000 })
        .then(() => btn.evaluate(el => (el.parentElement ?? el).click()))
        .then(() => true)
        .catch(() => false);
      if (!clicked) break;
      await this.page.waitForTimeout(800);
      const newCount = await this.orderRows.count().catch(() => 0);
      if (newCount >= prevCount) break;
    }
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }

  async _handleBranchModalIfVisible() {
    const storeItem = this.page.locator('.store-item');
    const confirmBtn = this.page.getByRole('button', { name: /Xác nhận chọn chi nhánh/ });
    try {
      const visible = await storeItem.first().isVisible({ timeout: 6000 });
      if (visible) {
        await storeItem.first().click();
        await confirmBtn.click();
        await this.page.waitForLoadState('networkidle');
      }
    } catch {
      // Không có modal chi nhánh, tiếp tục
    }
  }

  // ── Tìm kiếm ─────────────────────────────────────────────────────────

  async searchProduct(key) {
    await this.searchInput.click();
    await this.dropdownContainer.waitFor({ state: 'visible', timeout: 10000 });
    await this.searchInput.fill(key);
    await this.page.waitForTimeout(600);
  }

  async selectCategory(catName) {
    await this.categoryTabs.filter({ hasText: catName }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async getDropdownResults() {
    await this.productDropdown.first().waitFor({ state: 'visible', timeout: 10000 });
    const items = await this.productDropdown.all();
    const results = [];
    for (const item of items) {
      const raw = ((await item.textContent()) || '').trim();
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      const header = lines[0] ?? '';
      const sepIdx = header.lastIndexOf(' - ');
      const name = sepIdx !== -1 ? header.slice(0, sepIdx).trim() : header;
      const code = sepIdx !== -1 ? header.slice(sepIdx + 3).trim() : '';
      const detail = lines[1] ?? '';
      const price = detail.split(/[•·]/)[0].trim();
      results.push({ name, code, price });
    }
    return results;
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  async expectResultsVisible() {
    await this.productDropdown.first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async expectDropdownHidden() {
    await this.dropdownContainer.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async expectNoData() {
    await this.noDataMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  async expectCategoryActive(catName) {
    const tab = this.categoryTabs.filter({ hasText: catName });
    await tab.scrollIntoViewIfNeeded();
    await tab.click({ force: true });
    await expect(tab).toHaveCSS('background-color', 'rgb(238, 240, 255)', { timeout: 7000 });
    await this.page.waitForLoadState('networkidle');
  }

  async getSearchValue() {
    return await this.searchInput.inputValue();
  }

  // ══════════════════════════════════════════════════════════════════════
  // UC03 — Thiết lập chi tiết đơn hàng
  // ══════════════════════════════════════════════════════════════════════

  async searchAndAddProduct(productName) {
    await this.searchProduct(productName);
    const item = this.productDropdown.filter({ hasText: productName }).first();
    await item.waitFor({ state: 'visible', timeout: 8000 });
    await item.click();
    await this.page.waitForTimeout(600);
  }

  // ── Dòng sản phẩm ─────────────────────────────────────────────────────
  // DOM thực tế: container div.col.col-12 chứa các div con (không có class),
  // mỗi div con là 1 dòng sản phẩm với đúng 4 inputs type=text.

  get orderRows() {
    return this.page
      .locator('.main-left .product-list-scroll > div.col.col-12 > div')
      .filter({ has: this.page.locator('input') });
  }

  getOrderRow(rowIndex = 0) {
    return this.orderRows.nth(rowIndex);
  }

  async getOrderRowCount() {
    return await this.orderRows.count();
  }

  // ── Số lượng ─────────────────────────────────────────────────────────

  getPlusBtn(rowIndex = 0) {
    return this.getOrderRow(rowIndex).locator('i.mdi-plus');
  }

  getMinusBtn(rowIndex = 0) {
    return this.getOrderRow(rowIndex).locator('i.mdi-minus');
  }

  getQtyInput(rowIndex = 0) {
    // input[1] = số lượng (0=giá, 1=SL, 2=CK, 3=VAT)
    return this.getOrderRow(rowIndex).locator('input').nth(1);
  }

  async clickPlus(rowIndex = 0) {
    await this._dismissSearchDropdown();
    const icon = this.getPlusBtn(rowIndex);
    await icon.waitFor({ state: 'attached', timeout: 8000 });
    await icon.evaluate(el => (el.parentElement ?? el).click());
    await this.page.waitForTimeout(500);
  }

  async clickMinus(rowIndex = 0) {
    await this._dismissSearchDropdown();
    const icon = this.getMinusBtn(rowIndex);
    await icon.waitFor({ state: 'attached', timeout: 8000 });
    await icon.evaluate(el => (el.parentElement ?? el).click());
    await this.page.waitForTimeout(800);
  }

  async _dismissSearchDropdown() {
    try {
      const isOpen = await this.dropdownContainer.isVisible({ timeout: 500 });
      if (isOpen) {
        await this.page.keyboard.press('Escape');
        // Đợi dropdown thực sự đóng, không chỉ wait fixed timeout
        await this.dropdownContainer.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      }
    } catch {
      // Dropdown đã đóng hoặc không tồn tại
    }
  }

  async setQuantity(rowIndex, qty) {
    await this._dismissSearchDropdown();
    const input = this.getQtyInput(rowIndex);
    await input.click({ clickCount: 3 });
    await input.fill(String(qty));
    await input.press('Enter');
    await this.page.waitForTimeout(300);
  }

  async getRowQty(rowIndex = 0) {
    const input = this.getQtyInput(rowIndex);
    await input.waitFor({ state: 'visible', timeout: 5000 });
    const value = await input.inputValue();
    return parseInt(value) || 0;
  }

  // ── Đơn giá ─────────────────────────────────────────────────────────

  getPriceInput(rowIndex = 0) {
    return this.getOrderRow(rowIndex).locator('input').first();
  }

  async setPrice(rowIndex, price) {
    const input = this.getPriceInput(rowIndex);
    await input.click({ clickCount: 3 });
    await input.fill(String(price));
    await input.press('Enter');
    await this.page.waitForTimeout(300);
  }

  // ── Chiết khấu dòng ──────────────────────────────────────────────────

  getLineDiscountInput(rowIndex = 0) {
    // input[2] = chiết khấu dòng
    return this.getOrderRow(rowIndex).locator('input').nth(2);
  }

  /**
   * Chuyển loại CK dòng: toggle là <p>%</p> hoặc <p>đ</p> trong row.
   * Dùng evaluate để tránh whitespace trong p tag làm Playwright filter fail.
   * Exclusive selection: click "đ" → đ mode, click "%" → % mode.
   */
  async _setLineDiscountType(rowIndex, type) {
    const targetText = type === 'amount' ? 'đ' : '%';
    const rowIndex_ = rowIndex;
    const clicked = await this.page.evaluate(({ rowIdx, text }) => {
      // Lấy tất cả individual product rows
      const container = document.querySelector('.main-left .product-list-scroll > div.col.col-12');
      if (!container) return false;
      const rows = Array.from(container.children).filter(c => c.querySelectorAll('input').length > 0);
      const row = rows[rowIdx];
      if (!row) return false;
      const toggle = Array.from(row.querySelectorAll('p'))
        .find(p => p.textContent?.trim() === text);
      if (!toggle) return false;
      toggle.click();
      return true;
    }, { rowIdx: rowIndex_, text: targetText });
    if (clicked) await this.page.waitForTimeout(300);
  }

  async setLineDiscount(rowIndex, value, type = 'amount') {
    await this._dismissSearchDropdown();
    await this._setLineDiscountType(rowIndex, type);
    const input = this.getLineDiscountInput(rowIndex);
    await input.click({ clickCount: 3, force: true });
    await input.fill(String(value));
    await input.press('Tab');
    await this.page.waitForTimeout(300);
  }

  // ── VAT dòng ─────────────────────────────────────────────────────────

  getVATInput(rowIndex = 0) {
    // input[3] = VAT (0=price, 1=qty, 2=discount, 3=VAT)
    return this.getOrderRow(rowIndex).locator('input').nth(3);
  }

  async setVAT(rowIndex, vatPercent) {
    const input = this.getVATInput(rowIndex);
    const visible = await input.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) return;
    await input.click({ clickCount: 3 });
    // Dùng pressSequentially thay fill để trigger Vue v-model events đúng cách
    await input.pressSequentially(String(vatPercent));
    // Dispatch thêm events để đảm bảo Vue nhận được thay đổi
    await input.evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await input.press('Tab');
    // Click ra ngoài row để trigger blur và Vue recalculate sidebar
    await this.page.locator('.sidebar-right').click({ position: { x: 10, y: 10 }, force: true }).catch(() => {});
    await this.page.waitForTimeout(800);
  }

  // ── Xóa dòng ─────────────────────────────────────────────────────────

  getDeleteBtn(rowIndex = 0) {
    return this.getOrderRow(rowIndex)
      .locator('i.mdi-close, button.mdi-close, i[class*="mdi-close"]')
      .first();
  }

  async deleteRow(rowIndex = 0) {
    await this.getDeleteBtn(rowIndex).click();
    await this.page.waitForTimeout(500);
  }

  // ── Giá trị hiển thị trong dòng ─────────────────────────────────────

  async getRowSubtotalText(rowIndex = 0) {
    return ((await this.getOrderRow(rowIndex).textContent()) || '').trim();
  }

  async getRowFinalText(rowIndex = 0) {
    return ((await this.getOrderRow(rowIndex).textContent()) || '').trim();
  }

  // ── Chiết khấu tổng đơn ─────────────────────────────────────────────
  // DOM: .sidebar-right > ... > div[flex row] > p[Chiết khấu tổng] + div > input[type=text] + p[%]

  get totalDiscountInput() {
    return this.page
      .locator('.sidebar-right')
      .getByText(/^Chiết khấu tổng$/)
      .locator('..')
      .locator('input[type="text"]')
      .first();
  }

  /**
   * Toggle CK tổng trong sidebar: 1 nút toggle <p> hiển thị MODE HIỆN TẠI.
   * Mặc định hiển thị "%" (đang ở % mode). Click "%" → chuyển sang đ mode.
   * Khi đang ở đ mode → hiển thị "đ". Click "đ" → chuyển về % mode.
   * Dùng page.evaluate vì p tag có whitespace thừa khiến Playwright filter regex fail.
   */
  async _setTotalDiscountType(type) {
    // textToClick = text của toggle hiện tại cần click để chuyển sang mode mong muốn
    // 'amount' (đ): click "%" nếu đang thấy "%" (đang ở % mode sai)
    // 'percent' (%): click "đ" nếu đang thấy "đ" (đang ở đ mode sai)
    const textToClick = type === 'amount' ? '%' : 'đ';
    const clicked = await this.page.evaluate((text) => {
      const sidebar = document.querySelector('.sidebar-right');
      const ckLabel = Array.from(sidebar?.querySelectorAll('p') || [])
        .find(p => p.textContent?.trim() === 'Chiết khấu tổng');
      if (!ckLabel) return false;
      const container = ckLabel.parentElement;
      const toggle = Array.from(container?.querySelectorAll('p') || [])
        .find(p => p.textContent?.trim() === text);
      if (!toggle) return false; // Đã ở đúng mode (toggle mode đang đúng không cần click)
      toggle.click();
      return true;
    }, textToClick);
    if (clicked) await this.page.waitForTimeout(300);
  }

  async setTotalDiscount(value, type = 'amount') {
    await this._setTotalDiscountType(type);
    const input = this.totalDiscountInput;
    await input.click({ clickCount: 3 });
    await input.fill(String(value));
    await input.evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await input.press('Tab');
    await this.page.waitForTimeout(500);
  }

  // ── Chi phí khác ─────────────────────────────────────────────────────
  // DOM: click vào div[cursor:pointer] bên cạnh label → mở v-dialog--active
  // Dialog: "Tên chi phí" (input[0]) + "Giá trị" (input[1]) + nút Lưu

  async openAdditionalCostDialog() {
    const chiPhiClickable = this.page.locator('.sidebar-right')
      .getByText(/^Chi phí khác$/)
      .locator('..')
      .locator('div')
      .first();
    await chiPhiClickable.click({ force: true });
    await this.page.locator('.v-dialog--active').waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(300);
  }

  get additionalCostInput() {
    // "Giá trị" là input thứ 2 (index 1) trong dialog Chi phí khác
    return this.page.locator('.v-dialog--active input[type="text"]').nth(1);
  }

  async setAdditionalCost(value) {
    await this.openAdditionalCostDialog();
    const dialog = this.page.locator('.v-dialog--active');
    // Fill "Tên chi phí" để tránh validation lỗi khi click Lưu
    const nameInput = dialog.locator('input[type="text"]').nth(0);
    if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.fill('Chi phí');
    }
    // Fill "Giá trị"
    const valueInput = this.additionalCostInput;
    await valueInput.click({ clickCount: 3 });
    await valueInput.fill(String(value));
    // Click Lưu để lưu chi phí
    await dialog.getByText('Lưu', { exact: true }).click();
    // Đợi dialog đóng
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    // Đợi Vue cập nhật sidebar
    await this.page.waitForTimeout(1500);
  }

  // ── Tiền khách đưa ───────────────────────────────────────────────────
  // DOM: .sidebar-right > ... > div[flex row] > p[Tiền khách đưa] + div > input[type=text]

  get customerPaymentInput() {
    return this.page.locator('.sidebar-right')
      .getByText(/^Tiền khách đưa$/)
      .locator('..')
      .locator('input[type="text"]')
      .first();
  }

  async setCustomerPayment(value) {
    await this.customerPaymentInput.click({ clickCount: 3 });
    await this.customerPaymentInput.fill(String(value));
    await this.customerPaymentInput.press('Tab');
    await this.page.waitForTimeout(300);
  }

  // ── Sidebar totals ───────────────────────────────────────────────────
  // Sidebar DOM: các row có cấu trúc: <p label> + <div><p value><p đ</div>
  // Một số row (Tiền thừa) có label lồng trong div thêm → dùng JS evaluate.

  /**
   * Parse chuỗi tiền tệ tiếng Việt → số.
   * Ví dụ: "200.000 đ" → 200000; "15.371,622 đ" → 15371.622
   */
  _parseVND(text) {
    const cleaned = (text || '')
      .replace(/[đ\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Đọc giá trị số tiền từ sidebar theo label text.
   * Dùng JS evaluate để xử lý cả trường hợp label lồng thêm div (Tiền thừa trả khách).
   * Retry tối đa 10 lần × 200ms để đợi Vue reactive update.
   */
  async _parseSidebarValue(labelText) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const text = await this.page.evaluate((label) => {
        const sidebar = document.querySelector('.sidebar-right');
        if (!sidebar) return '';
        const ps = Array.from(sidebar.querySelectorAll('p'));
        const labelP = ps.find(p => p.textContent?.trim() === label);
        if (!labelP) return '';
        // Walk up max 3 levels to find the row container that has a sibling value p
        let container = labelP.parentElement;
        for (let i = 0; i < 3; i++) {
          if (!container) break;
          const numPs = Array.from(container.querySelectorAll('p'));
          const valueP = numPs.find(vp =>
            vp !== labelP &&
            /\d/.test(vp.textContent || '') &&
            (vp.textContent?.trim().length ?? 0) <= 20
          );
          if (valueP) return valueP.textContent?.trim() || '';
          container = container.parentElement;
        }
        return '';
      }, labelText);

      if (text !== '') return this._parseVND(text);
      await this.page.waitForTimeout(200);
    }
    return 0;
  }

  async getSidebarTotalAmount() {
    return this._parseSidebarValue('Tổng tiền');
  }

  async getSidebarTotalVAT() {
    return this._parseSidebarValue('Tổng VAT');
  }

  async getSidebarMustPay() {
    return this._parseSidebarValue('KH phải trả');
  }

  async getSidebarChange() {
    return this._parseSidebarValue('Tiền thừa trả khách');
  }

  // ── Toast / validation messages ───────────────────────────────────────

  get toastMessage() {
    return this.page.locator(
      '.v-snack__content, .v-alert__content, [class*="toast-message"], [class*="notification-content"]'
    );
  }

  async getToastText() {
    try {
      await this.toastMessage.first().waitFor({ state: 'visible', timeout: 5000 });
      return ((await this.toastMessage.first().textContent()) || '').trim();
    } catch {
      return '';
    }
  }

  async expectToastContains(text, timeout = 8000) {
    const byClass = this.page.locator(
      '.v-snack__content, .v-alert__content, .el-notification, .el-message, ' +
      '[class*="toast"], [class*="notification"], [class*="alert"], [class*="snack"]'
    ).filter({ hasText: text });
    const byText = this.page.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(byClass.or(byText).first()).toBeVisible({ timeout });
  }

  // ── VAT label trên dòng sản phẩm ─────────────────────────────────────

  async expectVATLabelVisible(rowIndex = 0) {
    const row = this.getOrderRow(rowIndex);
    await expect(
      row.getByText(/sản phẩm có áp dụng vat/i)
        .or(this.page.locator('.main-left').getByText(/sản phẩm có áp dụng vat/i))
        .first()
    ).toBeVisible({ timeout: 8000 });
  }

  async expectIMEIFieldVisible(rowIndex = 0) {
    await this._dismissSearchDropdown();
    const row = this.getOrderRow(rowIndex);
    await expect(
      row.getByText(/danh sách imei/i)
        .or(row.getByPlaceholder(/tìm kiếm imei/i))
        .or(row.getByPlaceholder(/imei/i))
        .first()
    ).toBeVisible({ timeout: 10000 });
  }

  async expectLotFieldVisible(rowIndex = 0) {
    await this._dismissSearchDropdown();
    const row = this.getOrderRow(rowIndex);
    await expect(
      row.getByText(/danh sách lô/i)
        .or(row.getByText(/chọn lô/i))
        .or(row.getByText(/lô.*hsd/i))
        .or(row.getByText(/lô hàng/i))
        .first()
    ).toBeVisible({ timeout: 10000 });
  }

  //UC_04

  async clickCreateOrder() {
    await this.createOrderButton.click();
  }

  async closeInvoice() {
    await this.cancelButton.click();
  }

  // ── UC04 — Tạo đơn bán hàng ──────────────────────────────────────────

  async pressF9() {
    await this.page.keyboard.press('F9');
    await this.page.waitForTimeout(500);
  }

  async expectInvoiceDialogVisible(timeout = 10000) {
    // Dùng container .v-dialog--active thay vì .v-card để tránh strict mode
    // (.v-dialog--active .v-card có thể khớp nhiều element do nested cards)
    await this.page.locator('.v-dialog--active').first().waitFor({ state: 'visible', timeout });
  }

  /**
   * Lấy giá trị "Có thể bán" từ kết quả dropdown tìm kiếm.
   * @param {string} searchKey - tên hoặc SKU sản phẩm
   * @returns {Promise<number|null>}
   */
  async getProductInventoryFromSearch(searchKey) {
    await this.searchProduct(searchKey);
    const item = this.productDropdown.first();
    const found = await item.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (!found) {
      await this.page.keyboard.press('Escape');
      return null;
    }
    const text = (await item.textContent()) || '';
    const match = text.match(/Có thể bán:\s*([\-\d.,]+)/);
    await this.page.keyboard.press('Escape');
    await this.dropdownContainer.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    if (!match) return null;
    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  }

  /**
   * Chọn mã IMEI trong dòng sản phẩm.
   * DOM thực tế: IMEI items là các div inline trong row (KHÔNG phải dialog).
   * Structure: [Danh sách IMEI (0/3):] → [textbox "Tìm kiếm IMEI..."] → [item "214"] [item "215"]...
   * @param {number} rowIndex
   * @param {string} imeiCode
   */
  // async selectIMEICode(rowIndex, imeiCode) {
  //   await this._dismissSearchDropdown();
  //   // IMEI items là inline (không phải dialog). Dùng evaluate để click trực tiếp.
  //   // Cấu trúc DOM: input[placeholder="Tìm kiếm IMEI..."] → wrapper → section chứa items
  //   const clicked = await this.page.evaluate(({ idx, code }) => {
  //     const container = document.querySelector(
  //       '.main-left .product-list-scroll > div.col.col-12'
  //     );
  //     if (!container) return false;
  //     const rows = Array.from(container.children).filter(
  //       c => c.querySelectorAll('input').length > 0
  //     );
  //     const row = rows[idx];
  //     if (!row) return false;
  //     const imeiInput = row.querySelector(
  //       'input[placeholder*="IMEI"], input[placeholder*="imei"]'
  //     );
  //     if (!imeiInput) return false;
  //     // 2 cấp cha trên của input = section chứa cả input lẫn items list
  //     const section = imeiInput.parentElement?.parentElement;
  //     if (!section) return false;
  //     // IMEI item: div/element có cursor:pointer và textContent kết thúc bằng code
  //     const allEls = Array.from(section.querySelectorAll('*'));
  //     for (const el of allEls) {
  //       const t = (el.textContent || '').trim().replace(/\s+/g, '');
  //       if (t === code || t.endsWith(code)) {
  //         // Ưu tiên phần tử nhỏ nhất chứa code (tránh click container quá lớn)
  //         if (el.children.length <= 2) {
  //           el.click();
  //           return true;
  //         }
  //       }
  //     }
  //     return false;
  //   }, { idx: rowIndex, code: imeiCode });
  //   await this.page.waitForTimeout(500);
  //   if (!clicked) {
  //     // Fallback: tìm bằng Playwright trên toàn row
  //     const row = this.getOrderRow(rowIndex);
  //     const imeiItem = row.locator('*').filter({ hasText: new RegExp(`^[^\\d]*${imeiCode}$`) }).first();
  //     if (await imeiItem.count() > 0) await imeiItem.click({ force: true });
  //   }
  // }

    async selectIMEICode(rowIndex, imeiCode) {
    // Đảm bảo không có dropdown nào che khuất
    await this._dismissSearchDropdown();
    
    const isSelected = await this.page.evaluate(({ idx, code }) => {
      const container = document.querySelector('.main-left .product-list-scroll > div.col.col-12');
      if (!container) return false;

      const rows = Array.from(container.children).filter(c => c.querySelectorAll('input').length > 0);
      const row = rows[idx];
      if (!row) return false;

      // Tìm container chứa các item IMEI (nằm sau div chứa input)
      const inputWrapper = row.querySelector('input[placeholder*="IMEI" i]')?.closest('div[style*="padding-left: 26px"]');
      const itemsContainer = inputWrapper?.nextElementSibling;
      if (!itemsContainer) return false;

      const items = Array.from(itemsContainer.querySelectorAll('div'));
      const targetItem = items.find(el => el.textContent.trim().endsWith(code));
      
      if (targetItem) {
        // Kiểm tra xem đã chọn chưa (dựa vào icon check hoặc màu sắc)
        // Thường khi được chọn, mdi-circle-outline sẽ đổi thành mdi-check-circle hoặc background đổi màu
        const icon = targetItem.querySelector('i');
        const isAlreadySelected = icon?.classList.contains('mdi-check-circle') || 
                                  targetItem.style.backgroundColor !== 'rgb(255, 255, 255)';
        
        if (!isAlreadySelected) {
          targetItem.click();
          return true;
        }
        return true; // Đã chọn rồi thì coi như xong
      }
      return false;
    }, { idx: rowIndex, code: imeiCode });

    if (!isSelected) {
      // Fallback bằng Playwright locator nếu evaluate thất bại
      const row = this.getOrderRow(rowIndex);
      const item = row.locator('div').filter({ hasText: new RegExp(`^${imeiCode}$`) }).last();
      await item.waitFor({ state: 'visible' });
      await item.click();
    }
    
    // Đợi UI cập nhật (Số lượng 0/3 -> 1/3)
    await this.page.waitForTimeout(300);
  }

  /**
   * Mở popup Lô-HSD, chọn lô và nhập số lượng bán.
   * DOM thực tế: click vào vùng "Chưa có lô hàng nào được chọn. Click để chọn lô hàng."
   * @param {number} rowIndex
   * @param {string} lotCode - mã lô cần chọn
   * @param {number} qty - số lượng bán
   */
  
  async selectLotAndQuantity(rowIndex, lotCode, qty) {
    await this._dismissSearchDropdown();

    // 1. Mở popup
    const lotArea = this.page.locator('.product-list-scroll > div.col.col-12').nth(rowIndex)
      .locator('div, span, p').filter({ hasText: /Click để chọn lô hàng/i }).last();
    await lotArea.click();

    // 2. Chờ popup hiển thị
    const dialog = this.page.locator('.v-dialog--active').last();
    await dialog.waitFor({ state: 'visible' });

    // 3. Sử dụng evaluate để tìm và điền chính xác (vượt qua mọi giới hạn của locator)
    const filled = await this.page.evaluate(({ code, quantity }) => {
      const dialog = document.querySelector('.v-dialog--active');
      if (!dialog) return false;

      // Tìm tất cả các dòng dữ liệu (thường là .row hoặc tr)
      const rows = Array.from(dialog.querySelectorAll('.row.no-gutters, tr'));
      
      for (const row of rows) {
        const inputs = Array.from(row.querySelectorAll('input'));
        // Kiểm tra xem dòng này có input nào chứa mã lô không
        const isTargetLot = inputs.some(input => input.value === code || input.textContent.includes(code));
        
        if (isTargetLot) {
          // Tìm ô input không bị readonly (ô số lượng) trong dòng này
          const qtyInput = inputs.find(input => !input.readOnly && !input.disabled);
          if (qtyInput) {
            qtyInput.value = ''; // Xóa cũ
            qtyInput.focus();
            // Giả lập gõ phím để Vue nhận sự kiện
            qtyInput.value = quantity;
            qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
            qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
            qtyInput.blur();
            return true;
          }
        }
      }
      return false;
    }, { code: lotCode, quantity: qty });

    if (!filled) {
      // Fallback nếu evaluate không tìm thấy (thử tìm bằng text thuần túy)
      const qtyInput = dialog.locator('.row.no-gutters, tr').filter({ hasText: lotCode }).locator('input:not([readonly])');
      await qtyInput.fill(String(qty));
    }

    // 4. Nhấn Đồng ý
    await dialog.locator('button:has-text("Đồng ý"), button.primary').click();
    
    // 5. Chờ dialog đóng
    await dialog.waitFor({ state: 'hidden' });
  }
}

module.exports = { OrderPage };
