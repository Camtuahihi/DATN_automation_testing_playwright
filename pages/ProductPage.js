const { BasePage } = require('./BasePage');
const { expect } = require('@playwright/test');

class ProductPage extends BasePage {
  constructor(page) {
    super(page);
    this.url = '/san-pham';

    // Danh sách sản phẩm
    //this.addProductBtn = page.locator('button:has-text("Thêm sản phẩm")');
    this.addProductBtn = page.locator('button:has(i.mdi-plus)');
    this.formContainer = page.locator('.v-dialog--active.v-dialog--persistent');
    const fi = (n) =>
      this.formContainer
        .locator('input:not([type="checkbox"]):not([type="hidden"])')
        .nth(n);

    //Thông tin chung 
    this.nameInput = fi(0);
    this.skuInput = fi(1);
    this.barcodeInput = fi(2);
    this.weightInput = fi(3);      
    this.weightUnitSelect = fi(4); 
    this.unitSelect = fi(5);       

    //Giá sản phẩm 
    this.baseCostInput = fi(6);//giá nhập
    this.retailCostInput = fi(7);//giá bán lẻ
    this.wholesaleCostInput = fi(8);//giá bán buôn
    this.discountInput = fi(9);//chiết khấu
    this.commissionInput = fi(10);//hoa hồng
    this.vatInput = fi(11);//vat

    // Toggle % / Đ
    this.discountPctBtn = this.formContainer.locator('.v-input').nth(9).locator('button:has-text("%")');
    this.discountDongBtn = this.formContainer.locator('.v-input').nth(9).locator('button:has-text("Đ")');
    this.commissionPctBtn = this.formContainer.locator('.v-input').nth(10).locator('button:has-text("%")');
    this.commissionDongBtn = this.formContainer.locator('.v-input').nth(10).locator('button:has-text("Đ")');

    //Chính sách giá
    this.vipPriceInput = fi(17);

    //Thông tin bổ sung 
    this.descriptionInput = this.formContainer.locator('textarea').first();
    this.warrantyInput = fi(21);       
    this.warrantyUnitSelect = fi(22);  

    //Hình ảnh 
    this.imageUploadInput = this.formContainer.locator('input[type="file"]');

    //Checkboxes (Quản lý nâng cao)
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

    //Buttons
    this.saveBtn = this.formContainer.locator('button:has-text("Lưu")');
    this.resetBtn = this.formContainer.locator('button:has-text("Nhập lại")');
    this.cancelBtn = this.formContainer.locator('button:has-text("Hủy")');
    this.closeBtn = this.formContainer.locator('[aria-label="Close"], button.close-icon, .v-btn--icon').first();

    //Messages 
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
        await this.page.waitForLoadState('networkidle');
      }
    } catch {
    }
  }

  async openCreateForm() {
    await this.addProductBtn.click();
    await this.page.waitForLoadState('networkidle');
    await this.addProductBtn.click({ force: true });
    await this.formContainer.waitFor({ state: 'visible', timeout: 15000 });
  }

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
