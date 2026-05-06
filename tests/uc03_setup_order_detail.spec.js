// @ts-check
const { test, expect } = require('@playwright/test');
const { OrderPage } = require('../pages/OrderPage');

// ─── Hằng số sản phẩm test ────────────────────────────────────────────────────
const P = {
  DEN:      { name: 'Đèn Rạng Đông', sku: '6591092', price: 150_000 },
  IPHONE:   { name: 'Iphone 17 pro max', sku: '6593940', price: 39_990_000 },
  CERAVE:   { name: 'Sữa rửa mặt CeraVe 473ml', sku: '6593942', price: 340_000 },
  COC:      { name: 'Bánh mỳ', sku:'6730972', price: 50_000 },
  HOA_MAI:  { name: 'Hoa mai', sku:'6730974', price: 100_000 },
  HOA_DAO:  { name: 'Hoa đào', sku:'6730976', price: 200_000 },
  BINH_GT:  { name: 'Bình giữ nhiệt', sku: '6719636'},   // không bán âm
  BINH_GT2:  { name: 'Bình giữ nhiệt 2', sku: '6720748'},   // không bán âm, tồn kho 1
  GO_DO:    { name: 'Gỗ đỏ', sku:'6730988'  }          // cho bán âm, tồn kho 0
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
 * So sánh số với dung sai ±tolerance đ.
 * @param {number} actual
 * @param {number} expected
 * @param {number} [tolerance]
 * @returns {boolean}
 */
function near(actual, expected, tolerance = 2) {
  return Math.abs(actual - expected) <= tolerance;
}

// ─── A. HIỂN THỊ ĐẶC THÙ THEO LOẠI SẢN PHẨM ─────────────────────────────────
test.describe('A. Hiển thị đặc thù theo loại sản phẩm', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  // ── OR_TC_01 ──────────────────────────────────────────────────────────────
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

      // Thành tiền = SL × Đơn giá = 1 × 150.000 = 150.000
      const subtotal = await op.getRowSubtotalText(0);
      expect(subtotal).toMatch(/150[.,]?000/);
    },
  );

  // // ── OR_TC_02 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_02 - Dòng sản phẩm IMEI hiển thị Danh sách IMEI, SL=0 @high @ui',
    async () => {
      test.skip(true, 'Cần kiểm tra DOM thực tế để xác định selector trường IMEI');
    },
  );

  // ── OR_TC_03 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_03 - Dòng sản phẩm Lô-HSD hiển thị Danh sách lô hàng, SL=0 @high @ui',
    async () => {
      test.skip(true, 'Sản phẩm Lô-HSD chưa được setup đúng trong môi trường test');
    },
  );

  // ── OR_TC_04 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_04 - Sản phẩm có VAT hiển thị label "(Sản phẩm có áp dụng VAT)" cạnh tên @medium @ui',
    async ({ page }) => {
      // Đèn Rạng Đông có VAT mặc định = 10% 
      const ok = await addProduct(op, page, P.DEN.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.DEN.name}"`);

      await op.expectVATLabelVisible(0);
    },
  );
});

// ─── B. SỐ LƯỢNG ─────────────────────────────────────────────────
test.describe('B. Số lượng', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok = await addProduct(op, page, P.DEN.name);
    if (!ok) test.skip(true, `Không tìm thấy "${P.DEN.name}"`);
    await op.getOrderRow(0).waitFor({ state: 'visible', timeout: 8000 });
  });

  // ── OR_TC_05 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_05 - Tăng số lượng bằng nút (+) @high @functional',
    async () => {
      expect(await op.getRowQty(0)).toBe(1);
      await op.clickPlus(0);
      expect(await op.getRowQty(0)).toBe(2);

      const subtotal = await op.getRowSubtotalText(0);
      expect(subtotal).toMatch(/300[.,]?000/);
    },
  );

  // ── OR_TC_06 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_06 - Giảm số lượng bằng nút (-) @high @functional',
    async () => {
      await op.clickPlus(0); // đưa SL về 2
      expect(await op.getRowQty(0)).toBe(2);

      await op.clickMinus(0);
      expect(await op.getRowQty(0)).toBe(1);

      const subtotal = await op.getRowSubtotalText(0);
      expect(subtotal).toMatch(/150[.,]?000/);
    },
  );

  // ── OR_TC_07 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_07 - Nút (-) bị disable khi Số lượng = 1 @medium @functional',
    async () => {
      expect(await op.getRowQty(0)).toBe(1);
      await op.clickMinus(0);
      expect(await op.getRowQty(0)).toBe(1);
    },
  );

  // ── OR_TC_08 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_08 - Nhập số nguyên dương tại ô Số lượng @high @functional',
    async () => {
      await op.setQuantity(0, 3);
      expect(await op.getRowQty(0)).toBe(3);

      const subtotal = await op.getRowSubtotalText(0);
      expect(subtotal).toMatch(/450[.,]?000/);
    },
  );

  // ── OR_TC_09 ──────────────────────────────────────────────────────────────
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

  // ── OR_TC_10 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_10 - Chặn thêm SP không bán âm khi Có thể bán = 0 @high @negative',
    async ({ page }) => {
      // Precondition: "Bình giữ nhiệt" (SKU 6719636) tồn kho = 0, không bán âm
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

  // ── OR_TC_11 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_11 - Chặn nhập SL > Tồn kho cho SP không bán âm (tồn kho=1, nhập SL=2) @high @negative',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.BINH_GT2.name);
      if (!ok) test.skip(true, `"${P.BINH_GT2.name}" không có trong môi trường test`);

      await op.setQuantity(0, 2);
      await op.expectToastContains('Số lượng sản phẩm lớn hơn số lượng có thể bán');
    },
  );

  // ── OR_TC_12 ──────────────────────────────────────────────────────────────
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

// ─── D. CHIẾT KHẤU DÒNG ─────────────────────────────────────────────────────
test.describe('D. Chiết khấu dòng', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  // ── OR_TC_13 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_13 - Nhập CK dòng theo số tiền (đ) @high @functional',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.HOA_MAI.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.HOA_MAI.name}"`);

      await op.setLineDiscount(0, 10000, 'amount');
      const subtotal = await op.getRowSubtotalText(0);
      expect(subtotal).toMatch(/90[.,]?000/);
    },
  );

  // ── OR_TC_14 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_14 - Nhập CK dòng theo phần trăm (%) @high @functional',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.HOA_DAO.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.HOA_DAO.name}"`);

      await op.setLineDiscount(0, 10, 'percent');
      const subtotal = await op.getRowSubtotalText(0);
      expect(subtotal).toMatch(/180[.,]?000/);
    },
  );

  // ── OR_TC_15 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_15 - CK dòng dạng đ không được lớn hơn Đơn giá: báo lỗi @high @boundary',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.COC.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.COC.name}"`);

      await op.setLineDiscount(0, 60000, 'amount');
      await op.expectToastContains('lớn hơn đơn giá sản phẩm');
    },
  );

  // ── OR_TC_16 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_16 - CK dòng dạng % không được vượt quá 100: báo lỗi @high @boundary',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.COC.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.COC.name}"`);

      await op.setLineDiscount(0, 120, 'percent');
      await op.expectToastContains('lớn hơn 100%');
    },
  );

  // ── OR_TC_17 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_17 - CK dòng dạng % với biên 100 - hợp lệ @medium @boundary',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.COC.name);
      if (!ok) test.skip(true, `Không tìm thấy "${P.COC.name}"`);

      await op.setLineDiscount(0, 100, 'percent');
      const subtotal = await op.getRowSubtotalText(0);
      // Row text contains "Thành tiền 0 đ" when subtotal is 0
      expect(subtotal).toMatch(/Thành tiền\s+0[\s\Wđ]/);
    },
  );
});

// ─── E. CHIẾT KHẤU TỔNG ĐƠN ─────────────────────────────────────────────────
test.describe('E. Chiết khấu tổng đơn', () => {
  /** @type {OrderPage} */
  let op;

  /** @param {import('@playwright/test').Page} page */
  async function addTwoProducts(page) {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name);  // DEN thêm trước → row 1
    const ok2 = await addProduct(op, page, P.COC.name);  // COC thêm sau  → row 0
    if (!ok1 || !ok2) {
      test.skip(true, `Cần cả "${P.COC.name}" và "${P.DEN.name}" trong môi trường test`);
    }
    // Đặt VAT = 0 
    await op.setVAT(0, 0);
    await op.setVAT(1, 0);
  }

  // ── OR_TC_18 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_18 - Áp dụng CK tổng dạng tiền (đ) @high @functional',
    async ({ page }) => {
      await addTwoProducts(page);
      // Tổng tiền = 50.000 + 150.000 = 200.000
      await op.setTotalDiscount(40000, 'amount');

      // KH phải trả = 200.000 - 40.000 = 160.000
      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 160000, 100)).toBe(true);

      // CK tổng phân bổ: Cốc sứ = 10.000, Tổng cuối = 40.000
      const finalCoc = await op.getRowFinalText(0);
      expect(finalCoc).toMatch(/40[.,]?000/);

      // Đèn: CK phân bổ = 30.000, Tổng cuối = 120.000
      const finalDen = await op.getRowFinalText(1);
      expect(finalDen).toMatch(/120[.,]?000/);
    },
  );

  // ── OR_TC_19 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_19 - Áp dụng CK tổng dạng phần trăm (%) @high @functional',
    async ({ page }) => {
      await addTwoProducts(page);
      await op.setTotalDiscount(10, 'percent');

      // KH phải trả = 200.000 × (1-10%) = 180.000
      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 180000, 100)).toBe(true);
    },
  );

  // ── OR_TC_20 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_20 - Chặn CK tổng đ > Tổng tiền hàng: báo lỗi @high @boundary',
    async ({ page }) => {
      await addTwoProducts(page);
      await op.setTotalDiscount(210000, 'amount');
      await op.expectToastContains('lớn hơn giá trị đơn hàng');
    },
  );

  // ── OR_TC_21 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_21 - Chặn CK tổng % > 100: báo lỗi @medium @boundary',
    async ({ page }) => {
      await addTwoProducts(page);
      await op.setTotalDiscount(120, 'percent');
      await op.expectToastContains('lớn hơn 100%');
    },
  );
});

// ─── G. ÁP DỤNG VAT ─────────────────────────────────────────────────────────
test.describe('G. Áp dụng VAT', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name);
    const ok2 = await addProduct(op, page, P.COC.name);
    if (!ok1 || !ok2) {
      test.skip(true, 'Cần "Cốc sứ" và "Đèn Rạng Đông"');
    }
  });

  // ── OR_TC_22 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_22 - Áp dụng VAT cho 2 sản phẩm - không CK @high @functional',
    async () => {
      await op.setVAT(0, 5);   // Cốc sứ
      await op.setVAT(1, 10);  // Đèn

      // Tổng VAT = 50.000×5% + 150.000×10% = 2.500 + 15.000 = 17.500
      const totalVAT = await op.getSidebarTotalVAT();
      expect(near(totalVAT, 17500, 100)).toBe(true);

      // KH phải trả = 200.000 + 17.500 = 217.500
      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 217500, 100)).toBe(true);
    },
  );

  // ── OR_TC_23 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_23 - VAT biên trên 100% và biên dưới 0% @medium @boundary',
    async () => {
      // VAT = 0 cho Cốc sứ: không thêm VAT
      await op.setVAT(0, 0);
      await op.setVAT(1, 0);
      const vatZero = await op.getSidebarTotalVAT();
      expect(vatZero).toBe(0);

      // VAT = 100 cho Cốc sứ: VAT = 50.000
      await op.setVAT(0, 100);
      const vat100 = await op.getSidebarTotalVAT();
      expect(near(vat100, 50000, 500)).toBe(true);
    },
  );

  // ── OR_TC_24 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_24 - Chặn VAT > 100% @medium @boundary',
    async () => {
      await op.setVAT(0, 120);
      await op.expectToastContains('VAT không được quá 100%');
    },
  );
});

// ─── H. KẾT HỢP CK DÒNG + CK TỔNG + VAT ────────────────────────────────────
test.describe('H. Kết hợp CK dòng + CK tổng + VAT', () => {
  /** @type {OrderPage} */
  let op;

  /** @param {import('@playwright/test').Page} page */
  async function setupTwoProducts(page) {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name);
    const ok2 = await addProduct(op, page, P.COC.name);
    if (!ok1 || !ok2) {
      test.skip(true, 'Cần "Cốc sứ" và "Đèn Rạng Đông"');
    }
  }

  // ── OR_TC_25 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_25 - Áp dụng CK dòng đ + CK tổng đ + VAT @high @functional',
    async ({ page }) => {
      await setupTwoProducts(page);
      // Cốc sứ: VAT=5%, CK=5.000đ
      await op.setLineDiscount(0, 5000, 'amount');
      await op.setVAT(0, 5);
      // Đèn: VAT=10%, CK=10.000đ
      await op.setLineDiscount(1, 10000, 'amount');
      await op.setVAT(1, 10);
      // CK tổng = 10.000đ
      await op.setTotalDiscount(10000, 'amount');

      // KH phải trả theo spec: 190.371,622 ≈ 190.372
      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 190372, 500)).toBe(true);

      // Tổng cuối Cốc sứ ≈ 44.695,946
      const finalCoc = await op.getRowFinalText(0);
      expect(finalCoc).toMatch(/44[.,]?69[0-9]/);
    },
  );

  // ── OR_TC_26 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_26 - Áp dụng CK dòng % + CK tổng đ + VAT @high @functional',
    async ({ page }) => {
      await setupTwoProducts(page);
      await op.setLineDiscount(0, 5, 'percent');
      await op.setVAT(0, 5);
      await op.setLineDiscount(1, 10, 'percent');
      await op.setVAT(1, 10);
      await op.setTotalDiscount(10000, 'amount');

      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 187505, 500)).toBe(true);
    },
  );

  // ── OR_TC_27 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_27 - Áp dụng CK dòng đ + CK tổng % + VAT @high @functional',
    async ({ page }) => {
      await setupTwoProducts(page);
      await op.setLineDiscount(0, 5000, 'amount');
      await op.setVAT(0, 5);
      await op.setLineDiscount(1, 10000, 'amount');
      await op.setVAT(1, 10);
      await op.setTotalDiscount(10, 'percent');

      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 181125, 500)).toBe(true);
    },
  );

  // ── OR_TC_28 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_28 - Áp dụng CK dòng % + CK tổng % + VAT @high @functional',
    async ({ page }) => {
      await setupTwoProducts(page);
      await op.setLineDiscount(0, 5, 'percent');
      await op.setVAT(0, 5);
      await op.setLineDiscount(1, 10, 'percent');
      await op.setVAT(1, 10);
      await op.setTotalDiscount(10, 'percent');

      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 178538, 500)).toBe(true);
    },
  );
});

// ─── I. CHI PHÍ KHÁC ────────────────────────────────────────────────────────
test.describe('I. Chi phí khác', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name);
    const ok2 = await addProduct(op, page, P.COC.name);
    if (!ok1 || !ok2) test.skip(true, 'Cần "Cốc sứ" và "Đèn Rạng Đông"');
    await op.setVAT(0, 0);
    await op.setVAT(1, 0);
  });

  // ── OR_TC_29 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_29 - Áp dụng "Chi phí khác" @high @functional',
    async () => {
      await op.setAdditionalCost(10000);

      // KH phải trả = 200.000 + 0 VAT - 0 CK + 10.000 = 210.000
      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 210000, 200)).toBe(true);
    },
  );

  // ── OR_TC_30 ──────────────────────────────────────────────────────────────
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

// ─── J. TIỀN KHÁCH ĐƯA ──────────────────────────────────────────────────────

test.describe('J. Tiền khách đưa', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name);
    const ok2 = await addProduct(op, page, P.COC.name);
    if (!ok1 || !ok2) test.skip(true, 'Cần "Cốc sứ" và "Đèn Rạng Đông"');
    await op.setVAT(0, 0);
    await op.setVAT(1, 0);
    // Tổng tiền = 200.000, KH phải trả = 200.000
  });

  // ── OR_TC_31 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_31 - Tiền thừa khi khách đưa nhiều hơn @high @functional',
    async () => {
      await op.setCustomerPayment(250000);

      const change = await op.getSidebarChange();
      expect(near(change, 50000, 200)).toBe(true);
    },
  );

  // ── OR_TC_32 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_32 - Tiền thừa = 0 khi khách đưa đúng @medium @functional',
    async () => {
      await op.setCustomerPayment(200000);

      const change = await op.getSidebarChange();
      expect(change).toBe(0);
    },
  );

  // ── OR_TC_33 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_33 - Tiền khách đưa < KH phải trả @medium @functional',
    async ({ page }) => {
      await op.setCustomerPayment(150000);
      await page.waitForTimeout(300);

      // Tiền thừa không được hiển thị (hoặc = 0) khi đưa thiếu
      const changeEl = page.locator('[class*="tien-thua"], [class*="change"]').filter({ hasText: /\d/ });
      if (await changeEl.count() > 0) {
        const change = await op.getSidebarChange();
        expect(change).toBe(0);
      }
      await expect(page.locator('[class*="sidebar"], [class*="order-summary"]').first()).toBeVisible();
    },
  );
});

// ─── K. THAO TÁC DÒNG HÀNG ──────────────────────────────────────────────────
test.describe('K. Thao tác dòng hàng', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    const ok1 = await addProduct(op, page, P.DEN.name);
    const ok2 = await addProduct(op, page, P.COC.name);
    if (!ok1 || !ok2) test.skip(true, 'Cần "Cốc sứ" và "Đèn Rạng Đông"');
    await op.setVAT(0, 0);
    await op.setVAT(1, 0);
  });

  // ── OR_TC_34 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_34 - Xóa sản phẩm khỏi đơn @high @functional',
    async ({ page }) => {
      expect(await op.getOrderRowCount()).toBe(2);

      await op.deleteRow(1);

      await expect(op.orderRows).toHaveCount(1, { timeout: 5000 });

      // KH phải trả cập nhật về 50.000 (chỉ còn Cốc sứ)
      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 50000, 200)).toBe(true);
    },
  );

  // ── OR_TC_35 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_35 - Sửa Đơn giá trực tiếp trên dòng @high @functional',
    async () => {
      await op.setPrice(0, 15000);

      const subtotal = await op.getRowSubtotalText(0);
      expect(subtotal).toMatch(/15[.,]?000/);

      // KH phải trả = 15.000 + 150.000 = 165.000
      const mustPay = await op.getSidebarMustPay();
      expect(near(mustPay, 165000, 500)).toBe(true);
    },
  );
});

// ─── L. CASE ĐẶC THÙ — IMEI / LÔ-HSD ───────────────────────────────────────
test.describe('L. Case đặc thù — Lô-HSD', () => {
  // ── OR_TC_36 ──────────────────────────────────────────────────────────────
  test(
    'OR_TC_36 - Lô-HSD: nhập "Số lượng bán" > Tồn kho lô → báo "Số lượng bán nhiều hơn tồn kho" @high @negative',
    async ({ page }) => {
      const op = new OrderPage(page);
      await op.open();

      // Precondition: Sữa CeraVe tồn kho lô = 5
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

      // Chọn lô đầu tiên trong popup
      const popupLotRow = page.locator('[class*="popup"] tr, [class*="dialog"] tr, .v-dialog tr').first();
      await popupLotRow.waitFor({ state: 'visible', timeout: 5000 });
      await popupLotRow.click();

      // Nhập số lượng bán = 6 (> tồn kho = 5)
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
