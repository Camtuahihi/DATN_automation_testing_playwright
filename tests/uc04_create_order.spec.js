// @ts-check
const { test, expect } = require('@playwright/test');
const { OrderPage } = require('../pages/OrderPage');
const { P } = require('../data/orderData');

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

// A. KÍCH HOẠT LỆNH TẠO ĐƠN
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

  // CO_TC_01
  test(
    'CO_TC_01 - Tạo đơn bán hàng thành công bằng nút nhấn @high @functional',
    async ({ page }) => {
      await op.clickCreateOrder();
      await op.expectToastContains('Tạo đơn hàng thành công');
      await op.expectInvoiceDialogVisible();
      await op.closeInvoice();

      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    },
  );

  // CO_TC_02
  test(
    'CO_TC_02 - Tạo đơn bán hàng thành công bằng phím tắt F9 @high @functional',
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

// B. TẠO ĐƠN BÁN HÀNG THẤT BẠI
test.describe('B. Tạo đơn bán hàng thất bại', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  // CO_TC_03
  test(
    'CO_TC_03 - Chặn tạo đơn khi danh sách sản phẩm trống @high @negative',
    async () => {
      await op.clickCreateOrder();
      await op.expectToastContains('Bạn phải chọn sản phẩm');
    },
  );

  // CO_TC_04
  test(
    'CO_TC_04 - Chặn tạo đơn khi sản phẩm IMEI chưa chọn mã IMEI (SL=0) @high @negative',
    async ({ page }) => {

      const ok = await addProduct(op, page, P.MACBOOK.sku);
      if (!ok) test.skip(true, `Không tìm thấy "${P.MACBOOK.name}" (SKU: ${P.MACBOOK.sku})`);
      await page.keyboard.press('Escape');

      await op.clickCreateOrder();
      await op.expectToastContains('Số lượng sản phẩm phải lớn hơn 0');
    },
  );

  // CO_TC_05
  test(
    'CO_TC_05 - Chặn tạo đơn khi sản phẩm Lô-HSD chưa chọn lô (SL=0) @high @negative',
    async ({ page }) => {

      const ok = await addProduct(op, page, P.COCTY.sku);
      if (!ok) test.skip(true, `Không tìm thấy "${P.COCTY.name}" (SKU: ${P.COCTY.sku})`);
      await page.keyboard.press('Escape');

      await op.clickCreateOrder();
      await op.expectToastContains('Số lượng sản phẩm phải lớn hơn 0');
    },
  );
});

// C. TẠO ĐƠN BÁN HÀNG THÀNH CÔNG
test.describe('C. Tạo đơn bán hàng thành công', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  // CO_TC_06
  test(
    'CO_TC_06 - Tạo đơn sản phẩm thường thành công @high @functional',
    async ({ page }) => {
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

      const inventoryAfter = await op.getProductInventoryFromSearch(P.SON.sku);
      expect(inventoryAfter).toBe(inventoryBefore - 1);
    },
  );

  // CO_TC_07
  test(
    'CO_TC_07 - Tạo đơn sản phẩm imei thành công @high @functional',
    async ({ page }) => {
      const inventoryBefore = await op.getProductInventoryFromSearch(P.MACBOOK.sku);
      if (inventoryBefore === null || inventoryBefore < 1) {
        test.skip(true, `"${P.MACBOOK.name}" không có IMEI khả dụng`);
        return;
      }

      const ok = await addProduct(op, page, P.MACBOOK.sku);
      if (!ok) test.skip(true, `Không thêm được "${P.MACBOOK.name}"`);
      await page.keyboard.press('Escape');
      await op.selectIMEICode(0, '514');
      
      await expect(page.locator('text=Danh sách IMEI (1/3)')).toBeVisible();

      await op.clickCreateOrder();
      await op.expectToastContains('Tạo đơn hàng thành công');
      await op.expectInvoiceDialogVisible();
      await op.closeInvoice();
    },
  );

  // CO_TC_08 
  test(
    'CO_TC_08 - Tạo đơn sản phẩm Lô-HSD thành công @high @functional',
    async ({ page }) => {
      const ok = await addProduct(op, page, P.COCTY.sku);
      if (!ok) test.skip(true, `Không tìm thấy "${P.COCTY.name}" (SKU: ${P.COCTY.sku})`);
      await page.keyboard.press('Escape');

      await op.selectLotAndQuantity(0, '5463', 10);

      await op.clickCreateOrder();
      await op.expectToastContains('Tạo đơn hàng thành công');
      await op.expectInvoiceDialogVisible();
      await op.closeInvoice();
    },
  );
});

// D. VERIFY DOANH THU 
test.describe('D. Verify doanh thu', () => {
  test(
    'CO_TC_09 - Kiểm tra doanh thu ghi nhận sau khi tạo đơn @medium',
    async () => {
      test.skip(true, 'Cần điều hướng sang màn báo cáo doanh thu — ngoài phạm vi UC04');
    },
  );
});

// E. XỬ LÝ ĐỒNG THỜI
test.describe('E. Xử lý đồng thời', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  //  CO_TC_10
  test(
    'CO_TC_10 - Nhấn "Tạo đơn" liên tục nhiều lần — hệ thống chỉ xử lý 1 lần @high @functional',
    async ({ page }) => {
      const inventoryBefore = await op.getProductInventoryFromSearch(P.HOATTS.sku);
      if (inventoryBefore === null) {
        test.skip(true, `Không tìm thấy "${P.HOATTS.name}" (SKU: ${P.HOATTS.sku})`);
        return;
      }

      const ok = await addProduct(op, page, P.HOATTS.sku);
      if (!ok) test.skip(true, `Không thêm được "${P.HOATTS.name}"`);
      await page.keyboard.press('Escape');

      await op.createOrderButton.click({ force: true });
      await op.createOrderButton.click({ force: true });
      await op.createOrderButton.click({ force: true });

      await op.expectToastContains('Tạo đơn hàng thành công');

      const dialogVisible = await page.locator('.v-dialog--active').first()
        .isVisible({ timeout: 3000 }).catch(() => false);
      if (dialogVisible) await op.closeInvoice();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

      const inventoryAfter = await op.getProductInventoryFromSearch(P.HOATTS.sku);
      expect(inventoryAfter).toBe(inventoryBefore - 1);
    },
  );

  // CO_TC_11
  test.skip(
    'CO_TC_11 - Mất kết nối internet khi nhấn "Tạo đơn" @high @negative',
    async ({ page, context }) => {

      const ok = await addProduct(op, page, P.GIAY.sku);
      if (!ok) test.skip(true, `Không tìm thấy "${P.GIAY.name}" (SKU: ${P.GIAY.sku})`);
      await page.keyboard.press('Escape');

      await context.setOffline(true);
      await op.clickCreateOrder();
      const errorPopup = page.getByText('Bạn đang offline. Đơn hàng sẽ được lưu tạm và tự động gửi khi có mạng.');
    },
  );
});
