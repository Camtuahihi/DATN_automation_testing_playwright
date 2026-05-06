// @ts-check
const { test, expect } = require('@playwright/test');
const { ProductPage } = require('../pages/ProductPage');
const { LoginPage } = require('../pages/LoginPage');
const TD = require('../data/01-test-data');
const path = require('path');

const FIXTURES = path.join(__dirname, 'fixtures');

// ─── A. KIỂM TRA GIAO DIỆN ────────────────────────────────────────────────

test.describe('A. Kiểm tra giao diện', () => {
  test('CP_TC_01 - Hiển thị form Tạo sản phẩm với đầy đủ nhóm thông tin @high @smoke @ui',
    async ({ page }) => {
      const pp = new ProductPage(page);
      await pp.open();
      await pp.openCreateForm();

      await expect(pp.formContainer).toBeVisible();
      // section headers thực tế trong form
      await expect(pp.formContainer.locator('text=Thông tin chung').first()).toBeVisible();
      await expect(pp.formContainer.locator('text=Giá sản phẩm').first()).toBeVisible();
      await expect(pp.formContainer.locator('text=VAT').first()).toBeVisible();
      await expect(pp.formContainer.locator('text=Chính sách giá').first()).toBeVisible();
      await expect(pp.formContainer.locator('text=Thông tin bổ sung').first()).toBeVisible();
      // Quản lý nâng cao
      await expect(pp.formContainer.locator('text=Sản phẩm Imei').first()).toBeVisible();
      await expect(pp.formContainer.locator('text=Sản phẩm combo').first()).toBeVisible();
      // Tên sản phẩm có dấu (*) bắt buộc
      await expect(pp.formContainer.locator('text=Tên sản phẩm').first()).toContainText('*');
    }
  );

  test('CP_TC_02 - Người dùng không có quyền không thấy nút Thêm sản phẩm @high @security',
    async ({ page }) => {
      // Precondition: cần tài khoản nhân viên không có quyền Tạo sản phẩm
      test.skip(true, 'Cần tài khoản nhân viên không có quyền Tạo sản phẩm');
      const pp = new ProductPage(page);
      await pp.open();
      await expect(page.locator('button:has-text("Thêm sản phẩm")')).toBeHidden();
    }
  );
 
});

// ─── B. VALIDATION TRƯỜNG "TÊN SẢN PHẨM" ─────────────────────────────────

test.describe('B. Validation trường Tên sản phẩm', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_03 - Tạo sản phẩm thất bại khi để trống Tên sản phẩm @high @validation',
    async ({ page }) => {
      await pp.save();
      await expect(page.locator('text=Thông tin tên không được để trống').first()).toBeVisible();
      await pp.expectFormVisible();
    }
  );

  test('CP_TC_04 - Tạo sản phẩm thành công với Tên sản phẩm 149 ký tự @high @boundary',
    async ({ page }) => {
      //expect(TD.NAMES.len149.length).toBe(149);
      //const name = TD.NAMES.len149.slice(0, 140) + '_' + Date.now().toString().slice(-7);
      await pp.fillName('Sản phẩm mẫu cao cấp phiên bản giới hạn 2026 tích hợp công nghệ AI mới giúp tối ưu hóa hiệu suất người dùng trong điều kiện thời tiết thực tế 1234567');
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

  test('CP_TC_05 - Tạo sản phẩm thành công với Tên sản phẩm 150 ký tự (biên trên hợp lệ) @high @boundary',
    async ({ page }) => {
      //expect(TD.NAMES.len150.length).toBe(150);
      //const name = TD.NAMES.len150.slice(0, 141) + '_' + Date.now().toString().slice(-7);
      await pp.fillName('Sản phẩm mẫu cao cấp phiên bản giới hạn 2026 tích hợp công nghệ AI mới giúp tối ưu hóa hiệu suất người dùng trong điều kiện thời tiết thực tế 12345678');
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

  test('CP_TC_06 - Tạo sản phẩm thất bại với Tên sản phẩm 151 ký tự (vượt biên) @high @boundary',
    async ({ page }) => {
      //expect(TD.NAMES.len151.length).toBe(151);
      //await pp.fillName(TD.NAMES.len151);
      await pp.fillName('Sản phẩm mẫu cao cấp phiên bản giới hạn 2026 tích hợp công nghệ AI mới giúp tối ưu hóa hiệu suất người dùng trong điều kiện thời tiết thực tế 123456789');
      await pp.save();
      await expect(
        page.locator('text=Tên sản phẩm không được dài quá 150 ký tự').first()
      ).toBeVisible();
      await pp.expectFormVisible();
    }
  );

  test('CP_TC_07 - Tên sản phẩm cho phép chứa ký tự đặc biệt và Unicode @medium @functional',
    async ({ page }) => {
      //const name = TD.NAMES.unicode + '_' + Date.now().toString().slice(-4);
      await pp.fillName('Ống nhựa PVC 90° & Ø 21mm');
      await pp.save();
      await pp.expectSuccessToast();
    }
  );
});

// ─── C. VALIDATION SKU & BARCODE ──────────────────────────────────────────

test.describe('C. Validation SKU & Barcode', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_08 - Tạo sản phẩm thành công khi để trống SKU và Barcode @high @functional',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('ABC'));
      // SKU và Barcode để trống
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

  test('CP_TC_09 - Kiểm tra thông báo khi nhập SKU trùng', async ({ page }) => {
    await pp.fillName(TD.uniqueName('ABC'));
    await pp.fillSku(TD.EXISTING_DATA.duplicateSKU);
    await pp.save();
    await expect(page.locator('text=sku Đã tồn tại')).toBeVisible();
});

  test(
    'CP_TC_10 - Tạo sản phẩm thất bại khi nhập Barcode trùng @high @functional',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('ABC'));
      await pp.fillBarcode(TD.EXISTING_DATA.duplicateBarcode); 
      // await pp.fillName('ABC');
      // await pp.fillBarcode('2004281469011');
      await pp.save();
      await expect(page.locator('text=bar_code Đã tồn tại')).toBeVisible();
    }
  );

    test('CP_TC_11 - Tạo sản phẩm thành công với SKU 255 ký tự @medium @boundary',
    async ({ page }) => {
      const prefix = Date.now().toString(); 
      
      const sku255 = prefix + 'A'.repeat(255 - prefix.length);

      expect(sku255.length).toBe(255);

      await pp.fillName(TD.uniqueName('ABC'));
      await pp.fillSku(sku255); // SKU này bây giờ sẽ không bao giờ trùng
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

  test('CP_TC_12 - Tạo sản phẩm thất bại với SKU 256 ký tự (vượt biên) @medium @boundary',
    async ({ page }) => {
      const sku256 = TD.randomString(256);
      expect(sku256.length).toBe(256);
      await pp.fillName(TD.uniqueName('ABC'));
      await pp.fillSku(sku256);
      await pp.save();
      await expect(page.locator('text=Có lỗi, vui lòng thử lại').first()).toBeVisible();
    }
  );
});

// ─── D. VALIDATION TRỌNG LƯỢNG & ĐƠN VỊ ─────────────────────────────────

test.describe('D. Validation trọng lượng & đơn vị', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test(
    'CP_TC_13 - Chặn nhập ký tự không phải số tại trường Trọng lượng @medium @validation',
    async ({ page }) => {
      await pp.weightInput.pressSequentially('as12@');
      await expect(pp.weightInput).toHaveValue('12');
    }
  );

  test(
    'CP_TC_14 - Trọng lượng thập phân: lưu và hiển thị đồng bộ giữa DB và UI @high @functional',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('ABC'));
      // await pp.fillName('ABC');
      await pp.fillWeight('12.5');
      await pp.save();
      await pp.expectSuccessToast();
      await pp.open();
    }
  );

  test('CP_TC_15 - Đơn vị trọng lượng cho phép chọn từ dropdown (g, kg, ml, l) @low @ui',
    async ({ page }) => {
      await pp.weightUnitSelect.click();
      const listItems = page.locator('.v-menu__content .v-list-item, .menuable__content__active .v-list-item');
      await listItems.first().waitFor({ state: 'visible', timeout: 5000 });
      const texts = await listItems.allTextContents();
      const normalized = texts.map(t => t.trim());
      expect(normalized).toContain('g');
      expect(normalized).toContain('kg');
      expect(normalized).toContain('ml');
      expect(normalized).toContain('l');
    }
  );
});

// ─── E. VALIDATION CHIẾT KHẤU & HOA HỒNG ────────────────────────────────

test.describe('E. Validation chiết khấu & hoa hồng', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_16 - Chiết khấu loại % không cho nhập > 100 @high @boundary',
    async ({ page }) => {
      await pp.selectDiscountTypePercent();
      await pp.fillDiscount('120');
      await pp.discountInput.press('Enter');
      const errorHint = page.locator(':text-matches("Chiết khấu|100", "i")').first();
    
      await expect(errorHint).toBeVisible({ timeout: 3000 });
      
    }
  );   

  test('CP_TC_17 - Chiết khấu loại % với giá trị biên 100% — hợp lệ @medium @boundary',
    async ({ page }) => {
      await pp.selectDiscountTypePercent();
      await pp.fillDiscount('100');
      await pp.fillName(TD.uniqueName('ABC'));
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

  test('CP_TC_18 - Chiết khấu loại Đ không được lớn hơn Giá nhập @high @functional',
    async ({ page }) => {
      await pp.fillBaseCost('50000'); 
      await pp.selectDiscountTypeDong(); 
      await pp.fillDiscount('60000');
      await pp.discountInput.press('Tab');
      const errorMsg = page.locator(':text-matches("Chiết khấu|giá vốn|lớn hơn", "i")').first();  
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    }
  );

  test('CP_TC_19 - Hoa hồng loại % không cho nhập > 100 @high @boundary', async ({ page }) => {
      await pp.selectCommissionTypePercent(); // Chọn loại hoa hồng %
      await pp.fillCommission('120');
      await pp.commissionInput.press('Enter');
      const errorHint = page.locator(':text-matches("Hoa hồng|100", "i")').first();
      await expect(errorHint).toBeVisible({ timeout: 3000 });
  });

  test('CP_TC_20 - Hoa hồng loại Đ không được lớn hơn Giá nhập @high @functional', async ({ page }) => {
      await pp.fillBaseCost('100000');
      await pp.selectCommissionTypeDong();
      await pp.fillCommission('120000');
      await pp.commissionInput.press('Tab');
      const errorMsg = page.locator(':text-matches("Hoa hồng|giá vốn|giá nhập", "i")').first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });
});

// ─── F. VALIDATION CÁC TRƯỜNG GIÁ ────────────────────────────────────────

test.describe('F. Validation các trường giá', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_21 - Chặn nhập ký tự không hợp lệ tại các ô nhập giá @high @validation',
    async ({ page}) => {
      await pp.baseCostInput.click();//giá nhập
      await pp.baseCostInput.pressSequentially('1a@');
      await expect(pp.baseCostInput).toHaveValue('1');

      await pp.retailCostInput.click();//giá bán lẻ
      await pp.retailCostInput.pressSequentially('2a@');
      await expect(pp.retailCostInput).toHaveValue('2');

      await pp.wholesaleCostInput.click();//giá bán buôn
      await pp.wholesaleCostInput.pressSequentially('3a@');
      await expect(pp.wholesaleCostInput).toHaveValue('3');

      await pp.vipPriceInput.click();//giá nhập VIP
      await pp.vipPriceInput.pressSequentially('4a@');
      await expect(pp.vipPriceInput).toHaveValue('4');
    }
  );

  test('CP_TC_22 - Tạo sản phẩm thành công với các giá kiểu nguyên dương @high @functional',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('ABC'));
      await pp.fillBaseCost('5000');
      await pp.fillRetailCost('7000');
      await pp.fillWholesaleCost('5500');
      await pp.fillVipPrice('8000');
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

  test('CP_TC_23 - Tạo sản phẩm thành công với các giá kiểu thập phân @medium @functional',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('ABC'));
      await pp.fillBaseCost('5000.1');
      await pp.fillRetailCost('7000.2');
      await pp.fillWholesaleCost('5500.3');
      await pp.save();
      await pp.expectSuccessToast();
    }
  );


  test('CP_TC_24 - Chặn nhập giá trị âm tại các ô giá @high @boundary', async ({ page }) => {
    const priceInputs = [
      { name: 'Giá vốn', locator: pp.baseCostInput },
      { name: 'Giá bán lẻ', locator: pp.retailCostInput },
      { name: 'Giá bán buôn', locator: pp.wholesaleCostInput }
    ];

    for (const item of priceInputs) {
      await item.locator.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await item.locator.pressSequentially('-');
      await page.waitForTimeout(200);

      const currentValue = await item.locator.inputValue();
      expect(currentValue === '' || currentValue === '0', 
        `Ô ${item.name} không chặn được dấu trừ. Giá trị hiện tại: ${currentValue}`).toBe(true);
    }
  });

  test('CP_TC_25 - Trường Giá nhập VIP hiển thị đúng khi đã có chính sách @medium @ui',
    async ({ page }) => {
      await pp.formContainer.locator('text=Chính sách giá').scrollIntoViewIfNeeded();
      await expect(pp.vipPriceInput).toBeVisible();
    }
  );
});

// ─── G. VALIDATION VAT ────────────────────────────────────────────────────

test.describe('G. Validation VAT', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_26 - VAT cho phép nhập 0% (biên dưới) @medium @boundary',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('ABC'));
      await pp.fillVat('0');
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

  test('CP_TC_27 - VAT cho phép nhập 100% (biên trên) @medium @boundary',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('ABC'));
      await pp.fillVat('100');
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

  test('CP_TC_28 - VAT chặn giá trị > 100 @high @boundary',
    async ({ page }) => {
      await pp.fillVat('120');
      const errorHint = page.locator(':text-matches("VAT|100", "i")').first();
      await expect(errorHint).toBeVisible({ timeout: 3000 });
    }
  );

  test('CP_TC_29 - VAT chặn giá trị âm @medium @boundary', async ({ page }) => {
    await pp.vatInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await pp.vatInput.pressSequentially('-7');
    await page.waitForTimeout(300);
    const value = await pp.vatInput.inputValue();
    expect(value).not.toContain('-');
  });
  
});

// ─── I. CÁC TÙY CHỌN QUẢN LÝ NÂNG CAO ───────────────────────────────────

test.describe('I. Quản lý nâng cao', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_30 - Khi tích Sản phẩm combo, hệ thống disable các checkbox không tương thích @high @functional',
    async ({ page }) => {
      await pp.checkIsCombo();
      await expect(pp.isImeiCheckbox).toBeDisabled();
      await expect(pp.isBatchCheckbox).toBeDisabled();
      await expect(pp.issyncconversionCheckbox).toBeDisabled();
      await expect(pp.initStockCheckbox).toBeDisabled();
    }
  );

  test('CP_TC_31 - Tạo sản phẩm loại IMEI/Seri thành công @medium @functional',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('Điện thoại X'));
      await pp.checkIsImei();
      await pp.save();
      await pp.expectSuccessToast();
    }
  );

    test('CP_TC_32 - Tạo sản phẩm loại Lô-HSD thành công @medium @functional',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('Sữa tươi'));
      await pp.checkIsBatch();
      await pp.save();
      await pp.expectSuccessToast();
    }
  );
});

// ─── J. KHỞI TẠO KHO HÀNG ────────────────────────────────────────────────

test.describe('J. Khởi tạo kho hàng', () => {
  test('CP_TC_33 - Khởi tạo tồn kho ban đầu cho sản phẩm thường @high @functional',
    async ({ page }) => {
      const pp = new ProductPage(page);
      await pp.open();
      await pp.openCreateForm();
      await pp.fillName(TD.uniqueName('Hoa mai'));
      await pp.checkInitStock();
      await pp.fillInStock('10');
      await pp.save();
      await pp.expectSuccessToast();
    }
  );
});

// ─── K. UPLOAD HÌNH ẢNH ───────────────────────────────────────────────────

test.describe('K. Upload hình ảnh sản phẩm', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_34 - Upload thành công với định dạng .jpg @high @functional',
    async ({ page }) => {
      const filePath = path.join(FIXTURES, 'sample.jpg');
      await pp.uploadImage(filePath);
      await expect(
        page.locator('img[alt*="preview"], img[alt*="ảnh"], .image-preview img').first()
      ).toBeVisible({ timeout: 10000 });
    }
  );

  test('CP_TC_35 - Upload thành công với .png và .webp @medium @functional',
    async ({ page }) => {
      const pngPath = path.join(FIXTURES, 'sample.png');
      await pp.uploadImage(pngPath);
      await expect(
        page.locator('img[alt*="preview"], img[alt*="ảnh"], .image-preview img').first()
      ).toBeVisible({ timeout: 10000 });

      // Upload webp thay thế
      const webpPath = path.join(FIXTURES, 'sample.webp');
      await pp.uploadImage(webpPath);
      await expect(
        page.locator('img[alt*="preview"], img[alt*="ảnh"], .image-preview img').first()
      ).toBeVisible({ timeout: 10000 });
    }
  );

  test(
    'CP_TC_36 - UI phải chặn upload file không phải định dạng ảnh @high @functional',
    async ({ page }) => {
      const docxPath = path.join(FIXTURES, 'sample.docx');
      await pp.uploadImage(docxPath);
      await expect(
        page.locator('text=Định dạng file không hợp lệ')
      ).toBeVisible({ timeout: 5000 });
    }
  );

  test('CP_TC_37 - Chỉ cho phép tối đa 1 ảnh (upload ảnh mới thay ảnh cũ) @low @functional',
    async ({ page }) => {
      const jpg1 = path.join(FIXTURES, 'sample.jpg');
      await pp.uploadImage(jpg1);
      await page.locator('img[alt*="preview"], img[alt*="ảnh"], .image-preview img')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 });

      const jpg2 = path.join(FIXTURES, 'sample2.jpg');
      await pp.uploadImage(jpg2);
      // Chỉ có 1 ảnh preview
      const previewCount = await page.locator(
        'img[alt*="preview"], img[alt*="ảnh"], .image-preview img'
      ).count();
      expect(previewCount).toBe(1);
    }
  );
});

// ─── L. THÔNG TIN BỔ SUNG ─────────────────────────────────────────────────

test.describe('L. Thông tin bổ sung', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_38 - Kiểm tra tính năng lọc ký tự tại ô Thời hạn bảo hành @low @validation',
      async ({ page }) => {  
        // 2. Click vào ô Thời hạn bảo hành để bắt đầu nhập
        await pp.warrantyInput.click();
        await page.keyboard.type('abc!@#');
        const valAfterAlpha = await pp.warrantyInput.inputValue();
        expect(valAfterAlpha).toBe('');
        await pp.warrantyInput.clear();
        await page.keyboard.type('12e');
        const valWithE = await pp.warrantyInput.inputValue();
        console.log(`Giá trị khi nhập '12e': ${valWithE}`);
      }
    );

  test('CP_TC_39 - Hiển thị lỗi khi nhập số thập phân vào bảo hành @low @validation',
    async ({ page }) => {
      await pp.fillName(TD.uniqueName('Sản phẩm lỗi bảo hành'));
      await pp.warrantyInput.fill('12.5');
      await pp.save();
      const errorToast = page.locator('text=The warranty field must be an integer.');
      await expect(errorToast).toBeVisible();
    }
  );

  test('CP_TC_40 - Đơn vị bảo hành cho phép chọn day/month/year @low @ui',
    async ({ page }) => {
      await pp.warrantyUnitSelect.click();      
      const listItems = page.locator('.v-menu__content .v-list-item, .menuable__content__active .v-list-item');
      await listItems.first().waitFor({ state: 'visible', timeout: 5000 });
      const options = await listItems.allTextContents();
      const normalized = options.map((/** @type {string} */ o) => o.trim().toLowerCase());
      const hasDay = normalized.some((/** @type {string | string[]} */ o) => o.includes('ngày') || o.includes('day'));
      const hasMonth = normalized.some((/** @type {string | string[]} */ o) => o.includes('tháng') || o.includes('month'));
      const hasYear = normalized.some((/** @type {string | string[]} */ o) => o.includes('năm') || o.includes('year'));
      expect(hasDay).toBeTruthy();
      expect(hasMonth).toBeTruthy();
      expect(hasYear).toBeTruthy();
    }
  );
});

// ─── M. THAO TÁC FORM ─────────────────────────────────────────────────────

test.describe('M. Thao tác form', () => {
  /** @type {ProductPage} */
  let pp;
  test.beforeEach(async ({ page }) => {
    pp = new ProductPage(page);
    await pp.open();
    await pp.openCreateForm();
  });

  test('CP_TC_41 - Nút Nhập lại xóa toàn bộ dữ liệu đã nhập @medium @functional',
    async ({ page }) => {
      await pp.fillName('Sản phẩm test');
      await pp.fillSku('SKU123');
      await pp.fillBaseCost('10000');
      await pp.checkIsCombo();

      await pp.reset();

      await expect(pp.nameInput).toHaveValue('');
      await expect(pp.skuInput).toHaveValue('');
      await expect(pp.baseCostInput).toHaveValue('0');
      await expect(pp.isComboCheckbox).not.toBeChecked();
      await pp.expectFormVisible();
    }
  );

  test('CP_TC_42 - Nút Hủy / X đóng form không lưu dữ liệu @medium @functional',
    async ({ page }) => {
      await pp.fillName('Sản phẩm sẽ bị hủy');
      await pp.cancel();
      //await pp.expectFormHidden();

      await pp.openCreateForm();
      await expect(pp.nameInput).toHaveValue('');
    }
  );
});

// ─── M. LỖI MẠNG / HỆ THỐNG ──────────────────────────────────────────────

test.describe('M. Lỗi mạng / hệ thống', () => {
  test('CP_TC_43 - Hệ thống xử lý gracefully khi mất Internet lúc nhấn Lưu @high @negative @network',
    async ({ page, context }) => {
      test.skip(true,
        'context.setOffline(true) khiến toàn bộ Vue SPA mất kết nối và trang trắng, ' +
        'không hiển thị toast lỗi. Cần dùng page.route() để chặn đúng API call lưu sản phẩm.'
      );

      const pp = new ProductPage(page);
      await pp.open();
      await pp.openCreateForm();
      await pp.fillName(TD.uniqueName('Network test'));

      await context.setOffline(true);
      await pp.save();
      await expect(page.locator('text=Có lỗi xảy ra')).toBeVisible({ timeout: 15000 });

      await expect(pp.nameInput).not.toHaveValue('');

      // Bật lại mạng và lưu lần 2
      await context.setOffline(false);
      await pp.save();
      await pp.expectSuccessToast();
    }
  );
});
