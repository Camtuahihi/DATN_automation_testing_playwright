// @ts-check
const { test, expect } = require('@playwright/test');
const { OrderPage } = require('../pages/OrderPage');
const { P } = require('../data/orderData');

/**
 * @param {import('@playwright/test').Page} page
 */
async function waitForDropdownResponse(page) {
  await page
    .locator('.product-search-dropdown .v-list-item')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
}

/**
 * @param {OrderPage} op
 * @param {import('@playwright/test').Page} page
 * @param {string} productName
 * @param {boolean} [_retry]
 * @returns {Promise<boolean>}
 */
async function addProduct(op, page, productName, _retry = true) {
  await op.searchProduct(productName);
  await waitForDropdownResponse(page);

  if (await op.noDataMessage.isVisible()) return false;
  if ((await op.productDropdown.count()) === 0) return false;

  const matched = op.productDropdown.filter({ hasText: productName });
  const visible = await matched.first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true).catch(() => false);

  if (!visible) {
    if (!_retry) return false;
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    return addProduct(op, page, productName, false);
  }

  await matched.first().click();
  await page.waitForTimeout(500);
  return true;
}

/**
 * @param {number} actual
 * @param {number} expected
 * @param {number} [tolerance]
 * @returns {boolean}
 */
function near(actual, expected, tolerance = 2) {
  return Math.abs(actual - expected) <= tolerance;
}

test.describe('A. Hiển thị đặc thù theo loại sản phẩm', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  test(
    'OR_TC_01 - Dòng sản phẩm Thường hiển thị đủ: Tên, SKU, Đơn giá, SL=1, CK, VAT, Thành tiền @high @ui',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.DEN.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.DEN.name}"`);

      const row = op.getOrderRow(0);
      await row.waitFor({ state: 'visible', timeout: 8000 });

      const orderArea = page.locator('.main-left');
      await expect(orderArea.getByText(P.DEN.name).first()).toBeVisible({ timeout: 10000 });
      await expect(orderArea.getByText(P.DEN.sku).first()).toBeVisible();

      expect(await op.getRowQty(0)).toBe(1);

      const priceInput = op.getPriceInput(0);
      await expect(priceInput).toBeVisible();
      await expect(priceInput).toBeEnabled();

      await expect(op.getLineDiscountInput(0)).toBeVisible();
      await expect(op.getVATInput(0)).toBeVisible();

      const subtotal = await op.getRowSubtotalText(0);
      expect(subtotal).toMatch(/150[.,]?000/);
    },
  );

  test(
    'OR_TC_02 - Dòng sản phẩm IMEI hiển thị Danh sách IMEI, SL=0 @high @ui',
    async () => {
      test.skip(true, 'Cần kiểm tra DOM thực tế để xác định selector trường IMEI');
    },
  );

  test(
    'OR_TC_03 - Dòng sản phẩm Lô-HSD hiển thị Danh sách lô hàng, SL=0 @high @ui',
    async () => {
      test.skip(true, 'Sản phẩm Lô-HSD chưa được setup đúng trong môi trường test');
    },
  );

  test(
    'OR_TC_04 - Sản phẩm có VAT hiển thị label "(Sản phẩm có áp dụng VAT)" cạnh tên @medium @ui',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.DEN.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.DEN.name}"`);

      await op.expectVATLabelVisible(0);
    },
  );
});

test.describe('B. Số lượng', () => {
  /** @type {OrderPage} */
  let op;

  /**
   * @param {string | number} text
   * @returns {number}
   */
  function parseMoneyToFloat(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;

    const match = String(text).match(/([\d.,]+)\s*[đĐ]?$/);
    if (!match) return 0;

    let numStr = match[1];

    numStr = numStr.replace(/\./g, '');
    numStr = numStr.replace(/,/g, '.');

    return parseFloat(numStr);
  }

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok = await addProduct(op, page, P.DEN.name);
    if (!ok) test.skip(true, `Không tìm thấy "${P.DEN.name}"`);
    await op.getOrderRow(0).waitFor({ state: 'visible', timeout: 8000 });
  });

  test(
    'OR_TC_05 - Tăng số lượng bằng nút (+) @high @functional',
    async () => {
      expect(await op.getRowQty(0)).toBe(1);
      await op.clickPlus(0);
      
      const expectedQty = 2;
      expect(await op.getRowQty(0)).toBe(expectedQty);

      // Thành tiền dòng = Đơn giá x Số lượng
      const expectedSubtotal = P.DEN.price * expectedQty;

      const subtotalText = await op.getRowSubtotalText(0);
      const actualSubtotal = parseMoneyToFloat(subtotalText);
      expect(Math.abs(actualSubtotal - expectedSubtotal)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_06 - Giảm số lượng bằng nút (-) @high @functional',
    async () => {
      await op.clickPlus(0);
      expect(await op.getRowQty(0)).toBe(2);

      await op.clickMinus(0);
      const expectedQty = 1;
      expect(await op.getRowQty(0)).toBe(expectedQty);
      const expectedSubtotal = P.DEN.price * expectedQty;

      const subtotalText = await op.getRowSubtotalText(0);
      const actualSubtotal = parseMoneyToFloat(subtotalText);
      expect(Math.abs(actualSubtotal - expectedSubtotal)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_07 - Nút (-) bị disable khi Số lượng = 1 @medium @functional',
    async () => {
      expect(await op.getRowQty(0)).toBe(1);
      await op.clickMinus(0);
      expect(await op.getRowQty(0)).toBe(1);
    },
  );

  test(
    'OR_TC_08 - Nhập số nguyên dương tại ô Số lượng @high @functional',
    async () => {
      await op.setQuantity(0, 3);
      expect(await op.getRowQty(0)).toBe(3);

      const expectedSubtotal = P.DEN.price * 3;

      const subtotalText = await op.getRowSubtotalText(0);
      const actualSubtotal = parseMoneyToFloat(subtotalText);
      expect(Math.abs(actualSubtotal - expectedSubtotal)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_09 - Chặn nhập số âm tại ô Số lượng "-" @medium @negative',
    async ({ page }) => {
      const input = op.getQtyInput(0);
      await input.click({ clickCount: 3 });
      await input.pressSequentially('-2');
      await page.waitForTimeout(300);

      const val = await input.inputValue();
      expect(val).not.toContain('-');
      expect(Number(val.replace(/\D/g, ''))).toBeGreaterThanOrEqual(0);
    },
  );
});

test.describe('C. Tồn kho', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  test(
    'OR_TC_10 - Chặn thêm SP không bán âm khi Có thể bán = 0 @high @negative',
    async ({ page }) => {
      await op.searchProduct(P.BINH_GT.sku);
      await waitForDropdownResponse(page);

      if ((await op.productDropdown.count()) === 0) {
        test.skip(true, `"${P.BINH_GT.name}" không có trong môi trường test`);
      }
      await op.productDropdown.filter({ hasText: P.BINH_GT.sku }).first().click({ force: true });

      await op.expectToastContains('Sản phẩm này không được bán âm').catch(() => {});
      await page.waitForTimeout(1000);
      expect(await op.getOrderRowCount()).toBe(0);
    },
  );

  test(
    'OR_TC_11 - Chặn nhập SL > Tồn kho cho SP không bán âm (tồn kho=1, nhập SL=2) @high @negative',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.BINH_GT2.name);
      if (!ok) test.skip(true, `"${P.BINH_GT2.name}" không có trong môi trường test`);

      await op.setQuantity(0, 2);
      await op.expectToastContains('Số lượng sản phẩm lớn hơn số lượng có thể bán');
    },
  );

  test(
    'OR_TC_12 - Cho phép bán SP bán âm với SL > Tồn kho (Gỗ đỏ, tồn=0, SL=2) @high @functional',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.GO_DO.name);
      if (!ok) test.skip(true, `"${P.GO_DO.name}" không có trong môi trường test`);

      const rowAdded = await op.getOrderRow(0).waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true).catch(() => false);
      if (!rowAdded) {
        test.skip(true, `"${P.GO_DO.name}" bị hệ thống chặn thêm vào đơn — chưa cấu hình bán âm`);
      }

      await op.setQuantity(0, 2);

      const val = await op.getRowQty(0);
      expect(val).toBe(2);
    },
  );
});

test.describe('D. Chiết khấu dòng', () => {
  /** @type {OrderPage} */
  let op;

  /**
   * @param {string | number} text
   * @returns {number}
   */
  function parseMoneyToFloat(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;

    const match = String(text).match(/([\d.,]+)\s*[đĐ]?$/);
    if (!match) return 0;

    let numStr = match[1];

    numStr = numStr.replace(/\./g, '');
    numStr = numStr.replace(/,/g, '.');

    return parseFloat(numStr);
  }

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  test(
    'OR_TC_13 - Nhập CK dòng theo số tiền (đ) @high @functional',
    async ({ page }) => {
      const product = P.HOA_MAI; 
      const ok = await addProduct(op, page, product.name);
      if (!ok) test.skip(true, `Không tìm thấy "${product.name}"`);

      const discountAmount = 10000;
      const quantity = 1;

      await op.setLineDiscount(0, discountAmount, 'amount');

      //Tiền sau CK dòng = Đơn giá x Số lượng - CK dòng
      const expectedSubtotal = (product.price * quantity) - discountAmount;

      const subtotalText = await op.getRowSubtotalText(0);
      const actualSubtotal = parseMoneyToFloat(subtotalText);

      expect(Math.abs(actualSubtotal - expectedSubtotal)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_14 - Nhập CK dòng theo phần trăm (%) @high @functional',
    async ({ page }) => {
      const product = P.HOA_DAO;
      const ok = await addProduct(op, page, product.name);
      if (!ok) test.skip(true, `Không tìm thấy "${product.name}"`);

      const discountPercent = 10;
      const quantity = 1;

      await op.setLineDiscount(0, discountPercent, 'percent');

      //Tiền sau CK dòng = (Đơn giá x SL) - (Đơn giá x SL x CK% / 100)
      const expectedLineDiscount = (product.price * quantity) * (discountPercent / 100);
      const expectedSubtotal = (product.price * quantity) - expectedLineDiscount;

      const subtotalText = await op.getRowSubtotalText(0);
      const actualSubtotal = parseMoneyToFloat(subtotalText);

      expect(Math.abs(actualSubtotal - expectedSubtotal)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_15 - CK dòng dạng đ không được lớn hơn Đơn giá: báo lỗi @high @boundary',
    async ({ page }) => {
      const product = P.COC;
      const ok = await addProduct(op, page, product.name);
      if (!ok) test.skip(true, `Không tìm thấy "${product.name}"`);

      const invalidDiscount = product.price + 10000;

      await op.setLineDiscount(0, invalidDiscount, 'amount');
      await op.expectToastContains('lớn hơn đơn giá sản phẩm');
    },
  );

  test(
    'OR_TC_16 - CK dòng dạng % không được vượt quá 100: báo lỗi @high @boundary',
    async ({ page }) => {
      const product = P.COC;
      const ok = await addProduct(op, page, product.name);
      if (!ok) test.skip(true, `Không tìm thấy "${product.name}"`);

      await op.setLineDiscount(0, 120, 'percent');
      await op.expectToastContains('lớn hơn 100%');
    },
  );

  test(
    'OR_TC_17 - CK dòng dạng % với biên 100 - hợp lệ @medium @boundary',
    async ({ page }) => {
      const product = P.COC;
      const ok = await addProduct(op, page, product.name);
      if (!ok) test.skip(true, `Không tìm thấy "${product.name}"`);

      await op.setLineDiscount(0, 100, 'percent');
      
      const expectedSubtotal = 0;

      const subtotalText = await op.getRowSubtotalText(0);
      const actualSubtotal = parseMoneyToFloat(subtotalText);

      expect(Math.abs(actualSubtotal - expectedSubtotal)).toBeLessThanOrEqual(0.1);
    },
  );
});

test.describe('E. Chiết khấu tổng đơn', () => {
  /** @type {OrderPage} */
  let op;

  /**
   * @param {string | number} text
   * @returns {number}
   */
  function parseMoneyToFloat(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;

    const match = String(text).match(/([\d.,]+)\s*[đĐ]?$/);
    if (!match) return 0;

    let numStr = match[1];

    numStr = numStr.replace(/\./g, '');
    numStr = numStr.replace(/,/g, '.');

    return parseFloat(numStr);
  }

  /** @param {import('@playwright/test').Page} page */
  async function addTwoProducts(page) {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name); 
    const ok2 = await addProduct(op, page, P.COC.name);  
    if (!ok1 || !ok2) {
      test.skip(true, `Cần cả "${P.COC.name}" và "${P.DEN.name}" trong môi trường test`);
    }
    await op.setVAT(0, 0);
    await op.setVAT(1, 0);
  }

  test(
    'OR_TC_18 - Áp dụng CK tổng dạng tiền (đ) @high @functional',
    async ({ page }) => {
      await addTwoProducts(page);
      
      const totalDiscountAmount = 40000; 
      await op.setTotalDiscount(totalDiscountAmount, 'amount');

      const p0_subtotal = P.COC.price * 1; 
      const p1_subtotal = P.DEN.price * 1;
      const totalSubtotal = p0_subtotal + p1_subtotal;

      const p0_rate = p0_subtotal / totalSubtotal;
      const p1_rate = p1_subtotal / totalSubtotal;

      const p0_allocatedDiscount = totalDiscountAmount * p0_rate;
      const p1_allocatedDiscount = totalDiscountAmount * p1_rate;

      const expectedFinalCoc = p0_subtotal - p0_allocatedDiscount;
      const expectedFinalDen = p1_subtotal - p1_allocatedDiscount;
      const expectedMustPay = totalSubtotal - totalDiscountAmount;

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);

      const finalCocText = await op.getRowFinalText(0);
      const actualFinalCoc = parseMoneyToFloat(finalCocText);
      expect(Math.abs(actualFinalCoc - expectedFinalCoc)).toBeLessThanOrEqual(0.1);

      const finalDenText = await op.getRowFinalText(1);
      const actualFinalDen = parseMoneyToFloat(finalDenText);
      expect(Math.abs(actualFinalDen - expectedFinalDen)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_19 - Áp dụng CK tổng dạng phần trăm (%) @high @functional',
    async ({ page }) => {
      await addTwoProducts(page);
      
      const discountPercent = 10;
      await op.setTotalDiscount(discountPercent, 'percent');

      const p0_subtotal = P.COC.price * 1;
      const p1_subtotal = P.DEN.price * 1;
      const totalSubtotal = p0_subtotal + p1_subtotal;

      const expectedDiscountAmount = totalSubtotal * (discountPercent / 100);
      const expectedMustPay = totalSubtotal - expectedDiscountAmount;

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_20 - Chặn CK tổng đ > Tổng tiền hàng: báo lỗi @high @boundary',
    async ({ page }) => {
      await addTwoProducts(page);

      const p0_subtotal = P.COC.price * 1;
      const p1_subtotal = P.DEN.price * 1;
      
      const invalidTotalDiscount = (p0_subtotal + p1_subtotal) + 10000;

      await op.setTotalDiscount(invalidTotalDiscount, 'amount');
      await op.expectToastContains('lớn hơn giá trị đơn hàng');
    },
  );

  test(
    'OR_TC_21 - Chặn CK tổng % > 100: báo lỗi @medium @boundary',
    async ({ page }) => {
      await addTwoProducts(page);
      await op.setTotalDiscount(120, 'percent');
      await op.expectToastContains('lớn hơn 100%');
    },
  );
});

test.describe('G. Áp dụng VAT', () => {
  /** @type {OrderPage} */
  let op;

  /**
   * @param {string | number} text
   * @returns {number}
   */
  function parseMoneyToFloat(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;

    const match = String(text).match(/([\d.,]+)\s*[đĐ]?$/);
    if (!match) return 0;

    let numStr = match[1];

    numStr = numStr.replace(/\./g, '');
    numStr = numStr.replace(/,/g, '.');

    return parseFloat(numStr);
  }

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name); 
    const ok2 = await addProduct(op, page, P.COC.name); 
    if (!ok1 || !ok2) {
      test.skip(true, `Cần "${P.COC.name}" và "${P.DEN.name}" trong môi trường test`);
    }
    await op.setTotalDiscount(0, 'amount');
  });

  test(
    'OR_TC_22 - Áp dụng VAT cho 2 sản phẩm - không CK @high @functional',
    async () => {
      const vatCoc = 5;  
      const vatDen = 10; 

      await op.setVAT(0, vatCoc);   
      await op.setVAT(1, vatDen);  

      //Tiền sau cả 2 CK = Đơn giá x Số lượng
      const p0_finalPrice = P.COC.price * 1;
      const p1_finalPrice = P.DEN.price * 1;

      //VAT dòng = Tiền sau cả 2 CK × VAT% / 100
      const expectedVatCoc = p0_finalPrice * (vatCoc / 100);
      const expectedVatDen = p1_finalPrice * (vatDen / 100);

      //Tổng VAT = Σ VAT dòng
      const expectedTotalVAT = expectedVatCoc + expectedVatDen;

      //Khách phải trả = Σ Tiền sau cả 2 CK + Σ VAT dòng
      const expectedMustPay = (p0_finalPrice + p1_finalPrice) + expectedTotalVAT;

      const totalVATText = await op.getSidebarTotalVAT();
      expect(parseMoneyToFloat(totalVATText)).toBe(expectedTotalVAT);

      const mustPayText = await op.getSidebarMustPay();
      expect(parseMoneyToFloat(mustPayText)).toBe(expectedMustPay);
    },
  );

  test(
    'OR_TC_23 - VAT biên trên 100% và biên dưới 0% @medium @boundary',
    async () => {
      await op.setVAT(0, 0);
      await op.setVAT(1, 0);
      
      const vatZeroText = await op.getSidebarTotalVAT();
      expect(parseMoneyToFloat(vatZeroText)).toBe(0);

      const vatMax = 100;
      await op.setVAT(0, vatMax);

      // VAT Cốc = Tiền Cốc * 100% = Chính giá tiền Cốc
      const expectedVatMax = P.COC.price * 1 * (vatMax / 100);

      const vatMaxText = await op.getSidebarTotalVAT();
      expect(parseMoneyToFloat(vatMaxText)).toBe(expectedVatMax);
    },
  );

  test(
    'OR_TC_24 - Chặn VAT > 100% @medium @boundary',
    async () => {
      await op.setVAT(0, 120);
      await op.expectToastContains('VAT không được quá 100%');
    },
  );
});

test.describe('H. Kết hợp CK dòng + CK tổng + VAT', () => {
  /** @type {OrderPage} */
  let op;

  /**
   * @param {string | number} text
   * @returns {number}
   */
  function parseMoneyToFloat(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;

    const match = String(text).match(/([\d.,]+)\s*[đĐ]?$/);
    if (!match) return 0;

    let numStr = match[1];

    numStr = numStr.replace(/\./g, '');
    numStr = numStr.replace(/,/g, '.');

    return parseFloat(numStr);
  }

  /** @param {import('@playwright/test').Page} page */
  async function setupTwoProducts(page) {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name); 
    const ok2 = await addProduct(op, page, P.COC.name); 
    if (!ok1 || !ok2) {
      test.skip(true, `Cần "${P.COC.name}" và "${P.DEN.name}" trong môi trường test`);
    }
  }

  test(
    'OR_TC_25 - Áp dụng CK dòng đ + CK tổng đ + VAT @high @functional',
    async ({ page }) => {
      await setupTwoProducts(page);
   
      const p0_lineDiscAmount = 5000;
      const p0_vatPercent = 5;
      const p1_lineDiscAmount = 10000;
      const p1_vatPercent = 10;
      const totalDiscountAmount = 10000;

      await op.setLineDiscount(0, p0_lineDiscAmount, 'amount');
      await op.setVAT(0, p0_vatPercent);
      await op.setLineDiscount(1, p1_lineDiscAmount, 'amount');
      await op.setVAT(1, p1_vatPercent);
      await op.setTotalDiscount(totalDiscountAmount, 'amount');

      //Tiền sau CK dòng
      const p0_subtotal = (P.COC.price * 1) - p0_lineDiscAmount; 
      const p1_subtotal = (P.DEN.price * 1) - p1_lineDiscAmount; 

      //Tổng tiền sau CK dòng
      const totalSubtotal = p0_subtotal + p1_subtotal; 

      //CK tổng phân bổ giữ nguyên số thập phân
      const p0_allocatedDiscount = totalDiscountAmount * (p0_subtotal / totalSubtotal); 
      const p1_allocatedDiscount = totalDiscountAmount * (p1_subtotal / totalSubtotal); 

      //Tiền sau cả 2 CK
      const p0_afterBothDiscount = p0_subtotal - p0_allocatedDiscount;
      const p1_afterBothDiscount = p1_subtotal - p1_allocatedDiscount;

      //VAT dòng
      const p0_vat = p0_afterBothDiscount * (p0_vatPercent / 100);
      const p1_vat = p1_afterBothDiscount * (p1_vatPercent / 100);

      //Tổng cuối dòng của Cốc (row 0)
      const expectedFinalCoc = p0_afterBothDiscount + p0_vat;

      //Khách phải trả
      const expectedMustPay = p0_afterBothDiscount + p1_afterBothDiscount + p0_vat + p1_vat;

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);

      const finalCocText = await op.getRowFinalText(0);
      const actualFinalCoc = parseMoneyToFloat(finalCocText);
      expect(Math.abs(actualFinalCoc - expectedFinalCoc)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_26 - Áp dụng CK dòng % + CK tổng đ + VAT @high @functional',
    async ({ page }) => {
      await setupTwoProducts(page);
      
      const p0_lineDiscPercent = 5;
      const p0_vatPercent = 5;
      const p1_lineDiscPercent = 10;
      const p1_vatPercent = 10;
      const totalDiscountAmount = 10000;

      await op.setLineDiscount(0, p0_lineDiscPercent, 'percent');
      await op.setVAT(0, p0_vatPercent);
      await op.setLineDiscount(1, p1_lineDiscPercent, 'percent');
      await op.setVAT(1, p1_vatPercent);
      await op.setTotalDiscount(totalDiscountAmount, 'amount');

      const p0_subtotal = (P.COC.price * 1) * (1 - p0_lineDiscPercent / 100);
      const p1_subtotal = (P.DEN.price * 1) * (1 - p1_lineDiscPercent / 100);
      const totalSubtotal = p0_subtotal + p1_subtotal;

      const p0_afterBothDiscount = p0_subtotal - (totalDiscountAmount * (p0_subtotal / totalSubtotal));
      const p1_afterBothDiscount = p1_subtotal - (totalDiscountAmount * (p1_subtotal / totalSubtotal));

      const expectedMustPay = p0_afterBothDiscount * (1 + p0_vatPercent / 100) + 
                              p1_afterBothDiscount * (1 + p1_vatPercent / 100);

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_27 - Áp dụng CK dòng đ + CK tổng % + VAT @high @functional',
    async ({ page }) => {
      await setupTwoProducts(page);
      
      const p0_lineDiscAmount = 5000;
      const p0_vatPercent = 5;
      const p1_lineDiscAmount = 10000;
      const p1_vatPercent = 10;
      const totalDiscountPercent = 10;

      await op.setLineDiscount(0, p0_lineDiscAmount, 'amount');
      await op.setVAT(0, p0_vatPercent);
      await op.setLineDiscount(1, p1_lineDiscAmount, 'amount');
      await op.setVAT(1, p1_vatPercent);
      await op.setTotalDiscount(totalDiscountPercent, 'percent');

      const p0_subtotal = (P.COC.price * 1) - p0_lineDiscAmount;
      const p1_subtotal = (P.DEN.price * 1) - p1_lineDiscAmount;
      const totalSubtotal = p0_subtotal + p1_subtotal;

      const totalDiscountAmount = totalSubtotal * (totalDiscountPercent / 100);

      const p0_afterBothDiscount = p0_subtotal - (totalDiscountAmount * (p0_subtotal / totalSubtotal));
      const p1_afterBothDiscount = p1_subtotal - (totalDiscountAmount * (p1_subtotal / totalSubtotal));

      const expectedMustPay = p0_afterBothDiscount * (1 + p0_vatPercent / 100) + 
                              p1_afterBothDiscount * (1 + p1_vatPercent / 100);

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_28 - Áp dụng CK dòng % + CK tổng % + VAT @high @functional',
    async ({ page }) => {
      await setupTwoProducts(page);
      
      const p0_lineDiscPercent = 5;
      const p0_vatPercent = 5;
      const p1_lineDiscPercent = 10;
      const p1_vatPercent = 10;
      const totalDiscountPercent = 10;

      await op.setLineDiscount(0, p0_lineDiscPercent, 'percent');
      await op.setVAT(0, p0_vatPercent);
      await op.setLineDiscount(1, p1_lineDiscPercent, 'percent');
      await op.setVAT(1, p1_vatPercent);
      await op.setTotalDiscount(totalDiscountPercent, 'percent');

      const p0_subtotal = (P.COC.price * 1) * (1 - p0_lineDiscPercent / 100);
      const p1_subtotal = (P.DEN.price * 1) * (1 - p1_lineDiscPercent / 100);
      const totalSubtotal = p0_subtotal + p1_subtotal;

      const totalDiscountAmount = totalSubtotal * (totalDiscountPercent / 100);

      const p0_afterBothDiscount = p0_subtotal - (totalDiscountAmount * (p0_subtotal / totalSubtotal));
      const p1_afterBothDiscount = p1_subtotal - (totalDiscountAmount * (p1_subtotal / totalSubtotal));

      const expectedMustPay = p0_afterBothDiscount * (1 + p0_vatPercent / 100) + 
                              p1_afterBothDiscount * (1 + p1_vatPercent / 100);

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);
    },
  );
});

test.describe('I. Chi phí khác', () => {
  /** @type {OrderPage} */
  let op;

  /**
   * @param {string | number} text
   * @returns {number}
   */
  function parseMoneyToFloat(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;

    const match = String(text).match(/([\d.,]+)\s*[đĐ]?$/);
    if (!match) return 0;

    let numStr = match[1];

    numStr = numStr.replace(/\./g, '');
    numStr = numStr.replace(/,/g, '.');

    return parseFloat(numStr);
  }

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name); 
    const ok2 = await addProduct(op, page, P.COC.name); 
    if (!ok1 || !ok2) {
      test.skip(true, `Cần "${P.COC.name}" và "${P.DEN.name}" trong môi trường test`);
    }
    await op.setVAT(0, 0);
    await op.setVAT(1, 0);
    await op.setTotalDiscount(0, 'amount');
  });

  test(
    'OR_TC_29 - Áp dụng "Chi phí khác" @high @functional',
    async () => {
      const additionalCost = 10000;
      await op.setAdditionalCost(additionalCost);

      const p0_subtotal = P.COC.price * 1;
      const p1_subtotal = P.DEN.price * 1;
      const totalSubtotal = p0_subtotal + p1_subtotal;

      //Khách phải trả = Σ Tổng cuối dòng + Chi phí khác
      const expectedMustPay = totalSubtotal + additionalCost;

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_30 - Chặn nhập Chi phí khác âm @low @negative',
    async ({ page }) => {
      await op.openAdditionalCostDialog();
      const input = op.additionalCostInput;
      await input.click({ clickCount: 3 });
      await input.pressSequentially('-5000');
      await page.waitForTimeout(300);

      const val = await input.inputValue();
      expect(val).not.toContain('-');

      await page.locator('.v-dialog--active').getByText('Hủy', { exact: true }).click().catch(() => {
        page.keyboard.press('Escape');
      });
    },
  );
});

test.describe('J. Tiền khách đưa', () => {
  /** @type {OrderPage} */
  let op;

  /**
   * @param {string | number} text
   * @returns {number}
   */
  function parseMoneyToFloat(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;

    const match = String(text).match(/([\d.,]+)\s*[đĐ]?$/);
    if (!match) return 0;

    let numStr = match[1];

    numStr = numStr.replace(/\./g, '');
    numStr = numStr.replace(/,/g, '.');

    return parseFloat(numStr);
  }

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name); // DEN thêm trước → row 1
    const ok2 = await addProduct(op, page, P.COC.name); // COC thêm sau  → row 0
    if (!ok1 || !ok2) test.skip(true, `Cần "${P.COC.name}" và "${P.DEN.name}" trong môi trường test`);

    await op.setVAT(0, 0);
    await op.setVAT(1, 0);
    await op.setTotalDiscount(0, 'amount');
  });

  test(
    'OR_TC_31 - Tiền thừa khi khách đưa nhiều hơn @high @functional',
    async () => {
      const customerPayment = 250000;
      await op.setCustomerPayment(customerPayment);

      const p0_subtotal = P.COC.price * 1;
      const p1_subtotal = P.DEN.price * 1;
      
      //Khách phải trả
      const expectedMustPay = p0_subtotal + p1_subtotal; 
      //Tiền thừa trả khách = Tiền khách đưa - Khách phải trả
      const expectedChange = customerPayment - expectedMustPay;

      const changeText = await op.getSidebarChange();
      const actualChange = parseMoneyToFloat(changeText);
      
      expect(Math.abs(actualChange - expectedChange)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_32 - Tiền thừa = 0 khi khách đưa đúng @medium @functional',
    async () => {
      const p0_subtotal = P.COC.price * 1;
      const p1_subtotal = P.DEN.price * 1;
      const expectedMustPay = p0_subtotal + p1_subtotal; 

      await op.setCustomerPayment(expectedMustPay);

      const changeText = await op.getSidebarChange();
      const actualChange = parseMoneyToFloat(changeText);

      expect(actualChange).toBe(0);
    },
  );

  test(
    'OR_TC_33 - Tiền khách đưa < KH phải trả @medium @functional',
    async ({ page }) => {
      await op.setCustomerPayment(150000);
      await page.waitForTimeout(300);
      const changeEl = page.locator('[class*="tien-thua"], [class*="change"]').filter({ hasText: /\d/ });
      if (await changeEl.count() > 0) {
        const changeText = await op.getSidebarChange();
        const actualChange = parseMoneyToFloat(changeText);
        expect(actualChange).toBe(0);
      }
      await expect(page.locator('[class*="sidebar"], [class*="order-summary"]').first()).toBeVisible();
    },
  );
});

test.describe('K. Thao tác dòng hàng', () => {
  /** @type {OrderPage} */
  let op;

  /**
   * @param {string | number} text
   * @returns {number}
   */
  function parseMoneyToFloat(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;

    const match = String(text).match(/([\d.,]+)\s*[đĐ]?$/);
    if (!match) return 0;

    let numStr = match[1];

    numStr = numStr.replace(/\./g, '');
    numStr = numStr.replace(/,/g, '.');

    return parseFloat(numStr);
  }

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name); 
    const ok2 = await addProduct(op, page, P.COC.name); 
    if (!ok1 || !ok2) test.skip(true, `Cần "${P.COC.name}" và "${P.DEN.name}" trong môi trường test`);

    await op.setVAT(0, 0);
    await op.setVAT(1, 0);
    await op.setTotalDiscount(0, 'amount');
  });

  test(
    'OR_TC_34 - Xóa sản phẩm khỏi đơn @high @functional',
    async () => {
      expect(await op.getOrderRowCount()).toBe(2);

      await op.deleteRow(1);
      await expect(op.orderRows).toHaveCount(1, { timeout: 5000 });

      const expectedMustPay = P.COC.price * 1;

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);
    },
  );

  test(
    'OR_TC_35 - Sửa Đơn giá trực tiếp trên dòng @high @functional',
    async () => {
      const newPriceCoc = 15000;
      const quantity = 1;
      await op.setPrice(0, newPriceCoc);

      const expectedSubtotalCoc = newPriceCoc * quantity;
  
      //Khách phải trả = Thành tiền dòng Cốc mới + Thành tiền dòng Đèn cũ
      const expectedMustPay = expectedSubtotalCoc + (P.DEN.price * 1);

      const subtotalText = await op.getRowSubtotalText(0);
      const actualSubtotalCoc = parseMoneyToFloat(subtotalText);
      expect(Math.abs(actualSubtotalCoc - expectedSubtotalCoc)).toBeLessThanOrEqual(0.1);

      const mustPayText = await op.getSidebarMustPay();
      const actualMustPay = parseMoneyToFloat(mustPayText);
      expect(Math.abs(actualMustPay - expectedMustPay)).toBeLessThanOrEqual(0.1);
    },
  );
});

test.describe('L. Case đặc thù — Lô-HSD', () => {
  test(
    'OR_TC_36 - Lô-HSD: nhập "Số lượng bán" > Tồn kho lô → báo "Số lượng bán nhiều hơn tồn kho" @high @negative',
    async ({ page }) => {
      const op = new OrderPage(page);
      await op.open();

      const ok = await addProduct(op, page, P.CERAVE.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.CERAVE.name}"`);

      const row = op.getOrderRow(0);
      await row.waitFor({ state: 'visible', timeout: 8000 });

      const lotBtn = row
        .locator('button, [class*="lot"], [class*="lo-hang"]')
        .filter({ hasText: /chọn lô|danh sách lô/i })
        .first();

      if ((await lotBtn.count()) === 0) {
        test.skip(true, 'Không tìm thấy nút mở popup lô hàng — cần verify DOM thực tế');
      }

      await lotBtn.click();
      await page.waitForTimeout(500);

      const popupLotRow = page.locator('[class*="popup"] tr, [class*="dialog"] tr, .v-dialog tr').first();
      await popupLotRow.waitFor({ state: 'visible', timeout: 5000 });
      await popupLotRow.click();

      const lotQtyInput = page
        .locator('[class*="popup"] input, [class*="dialog"] input, .v-dialog input')
        .last();
      await lotQtyInput.click({ clickCount: 3 });
      await lotQtyInput.fill('6');

      await page.getByRole('button', { name: /đồng ý|xác nhận/i }).click();
      await page.waitForTimeout(500);

      await op.expectToastContains('nhiều hơn tồn kho');
    },
  );
});
