const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

class ProductPage extends BasePage {
  constructor(page) {
    super(page);
    this.url = '/san-pham';

    // Danh sách sản phẩm
    this.addProductBtn = page.locator('button:has-text("Thêm sản phẩm")');

    // Form container — Vuetify dialog khi active (sau lần click thứ 2)
    this.formContainer = page.locator('.v-dialog--active.v-dialog--persistent');

    // Helper: lấy input theo thứ tự trong form (đã xác định bằng debug test)
    // Thứ tự visible inputs trong dialog (không tính checkbox/hidden):
    // 0=Tên sp, 1=SKU, 2=Barcode, 3=Trọng lượng, 4=Đơn vị, 5=Đơn vị tính
    // 6=Giá nhập, 7=Giá bán lẻ, 8=Giá bán buôn, 9=Chiết khấu, 10=Hoa hồng
    // 11=VAT, 12-16=Thuế nâng cao, 17=Giá nhập VIP, 18-20=Comboboxes
    // 21=Bảo hành(number), 22=Đơn vị bảo hành(text)
    const fi = (n) =>
      this.formContainer
        .locator('input:not([type="checkbox"]):not([type="hidden"])')
        .nth(n);

    // ── Thông tin chung ───────────────────────────────────────────────
    this.nameInput = fi(0);
    this.skuInput = fi(1);
    this.barcodeInput = fi(2);
    this.weightInput = fi(3);      // type=text, Vuetify validates via JS
    this.weightUnitSelect = fi(4); // combobox Đơn vị
    this.unitSelect = fi(5);       // combobox Đơn vị tính

    // ── Giá sản phẩm ─────────────────────────────────────────────────
    this.baseCostInput = fi(6);//giá nhập
    this.retailCostInput = fi(7);//giá bán lẻ
    this.wholesaleCostInput = fi(8);//giá bán buôn
    this.discountInput = fi(9);//chiết khấu
    this.commissionInput = fi(10);//hoa hồng
    this.vatInput = fi(11);//vat

    // Toggle % / Đ — .v-input nth(9)=Chiết khấu, nth(10)=Hoa hồng (confirmed via debug)
    this.discountPctBtn = this.formContainer.locator('.v-input').nth(9).locator('button:has-text("%")');
    this.discountDongBtn = this.formContainer.locator('.v-input').nth(9).locator('button:has-text("Đ")');
    this.commissionPctBtn = this.formContainer.locator('.v-input').nth(10).locator('button:has-text("%")');
    this.commissionDongBtn = this.formContainer.locator('.v-input').nth(10).locator('button:has-text("Đ")');

    // ── Chính sách giá ───────────────────────────────────────────────
    this.vipPriceInput = fi(17);

    // ── Thông tin bổ sung ────────────────────────────────────────────
    this.descriptionInput = this.formContainer.locator('textarea').first();
    this.warrantyInput = fi(21);       // type=number, placeholder="Số"
    this.warrantyUnitSelect = fi(22);  // type=text, placeholder="Đơn vị"

    // ── Hình ảnh ─────────────────────────────────────────────────────
    this.imageUploadInput = this.formContainer.locator('input[type="file"]');

    // ── Checkboxes (Quản lý nâng cao) — tìm theo label text ──────────
    const cb = (labelText) =>
      this.formContainer
        .locator('.information, .v-checkbox, .v-input--checkbox')
        .filter({ hasText: new RegExp(labelText, 'i') })
        .locator('input[type="checkbox"]');

    this.isImeiCheckbox = cb('Sản phẩm Imei');
    this.isBuyAlwayCheckbox = cb('Sản phẩm bán âm');
    this.isBatchCheckbox = cb('Sản phẩm lô');
    this.issyncconversionCheckbox = cb('Sản phẩm quy đổi chung kho');
    this.isComboCheckbox = cb('Sản phẩm combo');
    this.initStockCheckbox = cb('Khởi tạo kho hàng');

    this.inStockInput = this.formContainer
        .locator('xpath=.//*[contains(text(),"Tồn kho ban đầu")]/ancestor::div[.//input][1]//input[@type="text"][1]');

    this.entryCostInput = this.formContainer
        .locator('xpath=.//*[contains(text(),"Giá vốn tồn kho")]/ancestor::div[.//input][1]//input[1]');

    // ── Buttons ───────────────────────────────────────────────────────
    this.saveBtn = this.formContainer.locator('button:has-text("Lưu")');
    this.resetBtn = this.formContainer.locator('button:has-text("Nhập lại")');
    this.cancelBtn = this.formContainer.locator('button:has-text("Hủy")');
    this.closeBtn = this.formContainer.locator('[aria-label="Close"], button.close-icon, .v-btn--icon').first();

    // ── Messages ──────────────────────────────────────────────────────
    this.successToast = page.locator('text=Thao tác thành công');
    this.errorMessage = page.locator('.error-message, [role="alert"], .v-alert');
  }

  async open() {
    await this.goto(this.url);
    await this.waitForLoad();
    await this._handleBranchModalIfVisible();
  }

  async _handleBranchModalIfVisible() {
    const storeItem = this.page.locator('.store-item');
    const confirmBtn = this.page.getByRole('button', { name: /Xác nhận chọn chi nhánh/ });
    try {
      const visible = await storeItem.first().isVisible({ timeout: 6000 });
      if (visible) {
        await storeItem.first().click();
        await confirmBtn.click();
        await this.page.locator('.modal-backdrop').waitFor({ state: 'hidden', timeout: 10000 });
        // Sau dismiss modal, wait cho trang ổn định
        await this.page.waitForLoadState('networkidle');
      }
    } catch {
      // Không có modal chi nhánh, tiếp tục
    }
  }

  async openCreateForm() {
    // Click lần 1 → trigger lazy-load JS chunks + API data (categories, suppliers, brands, policies)
    await this.addProductBtn.click();
    // Chờ toàn bộ data load xong
    await this.page.waitForLoadState('networkidle');
    // Click lần 2 → form thực sự mở (data đã cache)
    await this.addProductBtn.click({ force: true });
    // Chờ dialog active xuất hiện
    await this.formContainer.waitFor({ state: 'visible', timeout: 15000 });
  }

  // 
  // async openCreateForm() {
  //   // 1. Click lần 1 và đợi mạng xử lý đồng thời
  //   await Promise.all([
  //     this.page.waitForLoadState('networkidle'), // Đợi load các script/cấu hình ban đầu
  //     this.addProductBtn.click()
  //   ]);

  //   // 2. Kiểm tra xem form đã hiện diện chưa
  //   const isVisible = await this.formContainer.isVisible();
    
  //   if (!isVisible) {
  //     // Nếu chưa hiện (do bị văng hoặc delay), click lần 2 với force: true
  //     // Force giúp vượt qua các lớp overlay mờ của Vuetify nếu nó chưa biến mất hoàn toàn[cite: 2, 3]
  //     await this.addProductBtn.click({ force: true });
  //   }

  //   // 3. Đợi form hiển thị rõ ràng và URL đã chuyển trang
  //   await Promise.all([
  //     this.formContainer.waitFor({ state: 'visible', timeout: 10000 }),
  //     // Giả sử URL trang tạo mới của Aibat có chứa từ 'create'
  //     this.page.waitForURL(/\/create|\/tao-moi/), 
  //   ]);
  // }

  async fillName(name) {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
  }

  async fillSku(sku) {
    await this.skuInput.clear();
    await this.skuInput.fill(sku);
  }

  async fillBarcode(barcode) {
    await this.barcodeInput.clear();
    await this.barcodeInput.fill(barcode);
  }

  async fillWeight(weight) {
    await this.weightInput.clear();
    await this.weightInput.fill(String(weight));
  }

  async fillBaseCost(value) {
    await this.baseCostInput.clear();
    await this.baseCostInput.fill(String(value));
  }

  async fillRetailCost(value) {
    await this.retailCostInput.clear();
    await this.retailCostInput.fill(String(value));
  }

  async fillWholesaleCost(value) {
    await this.wholesaleCostInput.clear();
    await this.wholesaleCostInput.fill(String(value));
  }

  async fillDiscount(value) {
    await this.discountInput.clear();
    await this.discountInput.fill(String(value));
  }

  async fillCommission(value) {
    await this.commissionInput.clear();
    await this.commissionInput.fill(String(value));
  }

  async fillVat(value) {
    await this.vatInput.clear();
    await this.vatInput.fill(String(value));
  }

  async fillVipPrice(value) {
    await this.vipPriceInput.clear();
    await this.vipPriceInput.fill(String(value));
  }

  async fillWarranty(value) {
    await this.warrantyInput.clear();
    await this.warrantyInput.fill(String(value));
  }

  async save() {
    await this.saveBtn.click();
  }

  async reset() {
    await this.resetBtn.click();
  }

  async cancel() {
    await this.cancelBtn.click();
  }

  async closeForm() {
    await this.closeBtn.click();
  }

  async expectSuccessToast() {
    await this.successToast.waitFor({ state: 'visible', timeout: 10000 });
  }

  async expectFormVisible() {
    await expect(this.formContainer).toBeVisible();
  }

  async expectFormHidden() {
    await this.formContainer.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async productExistsInList(name) {
    return await this.page.locator(`tr:has-text("${name}")`).isVisible();
  }

  async selectDiscountTypePercent() {
    await this.discountPctBtn.click();
  }

  async selectDiscountTypeDong() {
    await this.discountDongBtn.click();
  }

  async selectCommissionTypePercent() {
    await this.commissionPctBtn.click();
  }

  async selectCommissionTypeDong() {
    await this.commissionDongBtn.click();
  }

  async _clickCheckboxLabel(labelText) {
    await this.formContainer
      .locator('.information, .v-checkbox, .v-input--checkbox')
      .filter({ hasText: new RegExp(labelText, 'i') })
      .locator('label')
      .click();
  }

  async checkIsCombo() {
    await this._clickCheckboxLabel('Sản phẩm combo');
  }

  async checkIsImei() {
    await this._clickCheckboxLabel('Sản phẩm Imei');
  }

  async checkIsBatch() {
    await this._clickCheckboxLabel('Sản phẩm lô');
  }

  async checkInitStock() {
    await this._clickCheckboxLabel('Khởi tạo kho hàng');
  }

  async fillInStock(value) {
    await this.inStockInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.inStockInput.fill(String(value));
  }

  async uploadImage(filePath) {
    await this.imageUploadInput.setInputFiles(filePath);
  }
}

module.exports = { ProductPage };
