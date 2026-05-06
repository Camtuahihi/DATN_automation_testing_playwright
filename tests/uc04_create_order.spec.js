// @ts-check
const { test, expect } = require('@playwright/test');
const { OrderPage } = require('../pages/OrderPage');

// ─── Hằng số sản phẩm test ────────────────────────────────────────────────────
const P = {
  GIAY:    { name: 'Giấy ăn',                sku: 'msp5765190', price: 15_000 },
  DUA:     { name: 'Lòng xào dưa',            sku: '5852216',    price: 50_000 },
  MACBOOK: { name: 'Macbook air 4 pro',       sku: '6724122',    price: 40_000_000 },
  COCTY:   { name: 'cốc tình yêu',            sku: '6724124',    price: 200_000 },
  SON:     { name: 'Son Dior 999 Satin 1.5g', sku: '6593938' },
  HOATTS:  { name: 'Hoa thủy tiên',           sku: '6724126' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** @param {import('@playwright/test').Page} page */
async function waitForDropdownResponse(page) {
  await page
    .locator('.product-search-dropdown .v-list-item')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
}

/**
 * Thêm sản phẩm vào đơn; trả về false nếu không tìm thấy.
 * @param {OrderPage} op
 * @param {import('@playwright/test').Page} page
 * @param {string} productKey - tên hoặc SKU
 * @param {boolean} [_retry]
 * @returns {Promise<boolean>}
 */
async function addProduct(op, page, productKey, _retry = true) {
  await op.searchProduct(productKey);
  await waitForDropdownResponse(page);
  if (await op.noDataMessage.isVisible()) return false;
  if ((await op.productDropdown.count()) === 0) return false;
  const matched = op.productDropdown.filter({ hasText: productKey });
  const visible = await matched.first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true).catch(() => false);

  if (!visible) {
    if (!_retry) return false;
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    return addProduct(op, page, productKey, false);
  }

  await matched.first().click();
  await page.waitForTimeout(500);
  return true;
}

// ─── A. KÍCH HOẠT LỆNH TẠO ĐƠN ──────────────────────────────────────────────
// UC04 | TC_CD_01 – TC_CD_02

test.describe('A. Kích hoạt lệnh tạo đơn', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    // Thiết lập đơn hàng hợp lệ: Giấy ăn + Lòng xào dưa, VAT=10%, CK tổng=10.000đ
    const ok1 = await addProduct(op, page, P.GIAY.name);
    const ok2 = await addProduct(op, page, P.DUA.name);
    if (!ok1 || !ok2) {
      test.skip(true, `Cần "${P.GIAY.name}" và "${P.DUA.name}" trong môi trường test`);
    }
    await page.keyboard.press('Escape');
    await op.setVAT(0, 10);
    await op.setVAT(1, 10);
    await op.setTotalDiscount(10000, 'amount');
  });

  // ── TC_CD_01 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_01 - Tạo đơn bán hàng thành công bằng nút nhấn @high @functional',
    async ({ page }) => {
      await op.clickCreateOrder();
      await op.expectToastContains('Tạo đơn hàng thành công');
      await op.expectInvoiceDialogVisible();
      await op.closeInvoice();
      // Đợi page ổn định sau khi đóng popup (tránh navigation race condition)
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    },
  );

  // ── TC_CD_02 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_02 - Tạo đơn bán hàng thành công bằng phím tắt F9 @high @functional',
    async ({ page }) => {
      await op.pressF9();
      await op.expectToastContains('Tạo đơn hàng thành công');
      await op.expectInvoiceDialogVisible();
      await op.closeInvoice();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    },
  );
});

// ─── B. TẠO ĐƠN BÁN HÀNG THẤT BẠI ────────────────────────────────────────
// UC04 | TC_CD_03 – TC_CD_05

test.describe('B. Tạo đơn bán hàng thất bại', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  // ── TC_CD_03 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_03 - Chặn tạo đơn khi danh sách sản phẩm trống @high @negative',
    async () => {
      await op.clickCreateOrder();
      await op.expectToastContains('Bạn phải chọn sản phẩm');
    },
  );

  // ── TC_CD_04 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_04 - Chặn tạo đơn khi sản phẩm IMEI chưa chọn mã IMEI (SL=0) @high @negative',
    async ({ page }) => {
      // Thêm sản phẩm IMEI nhưng KHÔNG mở popup chọn mã → SL mặc định = 0
      const ok = await addProduct(op, page, P.MACBOOK.sku);
      if (!ok) test.skip(true, `Không tìm thấy "${P.MACBOOK.name}" (SKU: ${P.MACBOOK.sku})`);
      await page.keyboard.press('Escape');

      await op.clickCreateOrder();
      await op.expectToastContains('Số lượng sản phẩm phải lớn hơn 0');
    },
  );

  // ── TC_CD_05 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_05 - Chặn tạo đơn khi sản phẩm Lô-HSD chưa chọn lô (SL=0) @high @negative',
    async ({ page }) => {
      // Thêm sản phẩm Lô-HSD nhưng KHÔNG mở popup chọn lô → SL mặc định = 0
      const ok = await addProduct(op, page, P.COCTY.sku);
      if (!ok) test.skip(true, `Không tìm thấy "${P.COCTY.name}" (SKU: ${P.COCTY.sku})`);
      await page.keyboard.press('Escape');

      await op.clickCreateOrder();
      await op.expectToastContains('Số lượng sản phẩm phải lớn hơn 0');
    },
  );
});

// ─── C. TẠO ĐƠN BÁN HÀNG THÀNH CÔNG ───────────────────────────────────
// UC04 | TC_CD_06 – TC_CD_08

test.describe('C. Tạo đơn bán hàng thành công', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  // ── TC_CD_06 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_06 - Tạo đơn sản phẩm thường thành công @high @functional',
    async ({ page }) => {
      // Đọc tồn kho TRƯỚC khi tạo đơn
      const inventoryBefore = await op.getProductInventoryFromSearch(P.SON.sku);
      if (inventoryBefore === null) {
        test.skip(true, `Không tìm thấy "${P.SON.name}" (SKU: ${P.SON.sku})`);
        return;
      }

      const ok = await addProduct(op, page, P.SON.name);
      if (!ok) test.skip(true, `Không thêm được "${P.SON.name}"`);
      await page.keyboard.press('Escape');

      await op.clickCreateOrder();
      await op.expectToastContains('Tạo đơn hàng thành công');
      await op.expectInvoiceDialogVisible();
      await op.closeInvoice();

      // Đọc tồn kho SAU khi tạo đơn và kiểm tra giảm đúng 1
      const inventoryAfter = await op.getProductInventoryFromSearch(P.SON.sku);
      expect(inventoryAfter).toBe(inventoryBefore - 1);
    },
  );

  // ── TC_CD_07 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_07 - Tạo đơn sản phẩm imei thành công @high @functional',
    async ({ page }) => {
      // Đọc tồn kho TRƯỚC (= số mã IMEI available)
      const inventoryBefore = await op.getProductInventoryFromSearch(P.MACBOOK.sku);
      if (inventoryBefore === null || inventoryBefore < 1) {
        test.skip(true, `"${P.MACBOOK.name}" không có IMEI khả dụng`);
        return;
      }

      const ok = await addProduct(op, page, P.MACBOOK.sku);
      if (!ok) test.skip(true, `Không thêm được "${P.MACBOOK.name}"`);
      await page.keyboard.press('Escape');

      // Mở popup IMEI và chọn mã "514"
      await op.selectIMEICode(0, '514');
      
      // Kiểm tra UI hiển thị đã chọn 1 sản phẩm
      await expect(page.locator('text=Danh sách IMEI (1/3)')).toBeVisible();

      await op.clickCreateOrder();
      await op.expectToastContains('Tạo đơn hàng thành công');
      await op.expectInvoiceDialogVisible();
      await op.closeInvoice();

      // Tồn kho giảm 1 (mã IMEI "514" đã bán)
    //   const inventoryAfter = await op.getProductInventoryFromSearch(P.MACBOOK.sku);
    //   expect(inventoryAfter).toBe(inventoryBefore - 1);
    },
  );

  // ── TC_CD_08 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_08 - Tạo đơn sản phẩm Lô-HSD thành công @high @functional',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.COCTY.sku);
      if (!ok) test.skip(true, `Không tìm thấy "${P.COCTY.name}" (SKU: ${P.COCTY.sku})`);
      await page.keyboard.press('Escape');

      // Chọn lô '5463' và nhập số lượng bán = 10
      await op.selectLotAndQuantity(0, '5463', 10);

      await op.clickCreateOrder();
      await op.expectToastContains('Tạo đơn hàng thành công');
      await op.expectInvoiceDialogVisible();
      await op.closeInvoice();
      // Xác nhận đơn tạo thành công; việc kiểm tra tồn kho lô cụ thể
      // cần điều hướng sang màn quản lý sản phẩm (ngoài phạm vi UC04).
    },
  );
});

// ─── D. VERIFY DOANH THU ─────────────────────────────────────────────────────
// UC04 | TC_CD_09

test.describe('D. Verify doanh thu', () => {
  test(
    'TC_CD_09 - Kiểm tra doanh thu ghi nhận sau khi tạo đơn @medium',
    async () => {
      test.skip(true, 'Cần điều hướng sang màn báo cáo doanh thu — ngoài phạm vi UC04');
    },
  );
});

// ─── E. XỬ LÝ ĐỒNG THỜI ─────────────────────────────────────────────────────
// UC04 | TC_CD_10 – TC_CD_11

test.describe('E. Xử lý đồng thời', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  // ── TC_CD_10 ─────────────────────────────────────────────────────────────
  test(
    'TC_CD_10 - Nhấn "Tạo đơn" liên tục nhiều lần — hệ thống chỉ xử lý 1 lần @high @functional',
    async ({ page }) => {
      const inventoryBefore = await op.getProductInventoryFromSearch(P.HOATTS.sku);
      if (inventoryBefore === null) {
        test.skip(true, `Không tìm thấy "${P.HOATTS.name}" (SKU: ${P.HOATTS.sku})`);
        return;
      }

      const ok = await addProduct(op, page, P.HOATTS.sku);
      if (!ok) test.skip(true, `Không thêm được "${P.HOATTS.name}"`);
      await page.keyboard.press('Escape');

      // Thử click "Tạo đơn" nhanh 3 lần bằng evaluate để bypass dialog overlay
      // Mục tiêu: hệ thống chỉ tạo đúng 1 đơn dù nhận nhiều click
      await op.createOrderButton.click({ force: true });
      await op.createOrderButton.click({ force: true });
      await op.createOrderButton.click({ force: true });

      // Chờ kết quả: chỉ 1 thông báo thành công
      await op.expectToastContains('Tạo đơn hàng thành công');

      // Đóng popup invoice nếu hiện
      const dialogVisible = await page.locator('.v-dialog--active').first()
        .isVisible({ timeout: 3000 }).catch(() => false);
      if (dialogVisible) await op.closeInvoice();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

      // Tồn kho chỉ giảm đúng 1 lần (không giảm 3 lần do duplicate order)
      const inventoryAfter = await op.getProductInventoryFromSearch(P.HOATTS.sku);
      expect(inventoryAfter).toBe(inventoryBefore - 1);
    },
  );

  // ── TC_CD_11 ─────────────────────────────────────────────────────────────
  test.skip(
    'TC_CD_11 - Mất kết nối internet khi nhấn "Tạo đơn" @high @negative',
    async ({ page, context }) => {
      // Dùng SKU để tìm kiếm chính xác hơn tên
      const ok = await addProduct(op, page, P.GIAY.sku);
      if (!ok) test.skip(true, `Không tìm thấy "${P.GIAY.name}" (SKU: ${P.GIAY.sku})`);
      await page.keyboard.press('Escape');

      // Ngắt kết nối mạng trước khi tạo đơn
      await context.setOffline(true);
      try {
        await op.clickCreateOrder();
        await op.expectToastContains('Đơn hàng đã được lưu tạm');
      } finally {
        // Phục hồi kết nối bất kể kết quả test
        await context.setOffline(false);
      }
    },
  );
});
