const { test, expect } = require('@playwright/test');
const { TableManagementPage } = require('../pages/TableManagementPage');
const { LoginPage } = require('../pages/LoginPage');

test.describe('UC05 - Chức năng Chuyển bàn', () => {
  let tablePage;

  test.beforeEach(async ({ page }) => {
    tablePage = new TableManagementPage(page);
    await tablePage.goto('https://web.aibat.vn/phong-ban');
  });

  /**
   * TB_TC_01: Nút "Chuyển bàn" hiển thị khi bàn đang sử dụng
   * Step: Nhấn chọn ‘Bàn 1’.
   */
  test('TB_TC_01: Nút "Chuyển bàn" hiển thị khi bàn đang sử dụng', async ({ page }) => {
    const tableName = 'Bàn 1';
    const isBusy = await tablePage.isTableBusy(tableName);
    expect(isBusy).toBe(true);
    await tablePage.openTableMenu(tableName);
    const transferBtn = page.getByRole('listitem').filter({ hasText: /Chuyển bàn/i }).last();
    const fallbackBtn = page.locator('div, button').filter({ hasText: /^Chuyển bàn$/i }).last();
    await expect(transferBtn.or(fallbackBtn)).toBeVisible({ timeout: 10000 });
  });

  /**
   * TB_TC_02: Nút "Chuyển bàn" KHÔNG hiển thị khi bàn trống
   * Step: Nhấn chọn ‘Bàn 3’.
   */
  test('TB_TC_02: Nút "Chuyển bàn" KHÔNG hiển thị khi bàn trống', async ({ page }) => {
    const tableName = 'Bàn 3';
    const isBusy = await tablePage.isTableBusy(tableName);
    expect(isBusy).toBe(false);

    await tablePage.openTableMenu(tableName);

    const transferBtn = page.locator(tablePage.activeMenu).locator(tablePage.transferBtn);
    await expect(transferBtn).not.toBeVisible();
  });

  test('TB_TC_03: Nhấn nút "Chuyển bàn" mở popup Chuyển bàn', async ({ page }) => {
    await tablePage.openTableMenu('Bàn 1');
    await tablePage.clickTransfer();
    
    const dialog = page.locator(tablePage.transferDialog);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Chuyển bàn');
  });

  test('TB_TC_04: Nhấn "X" tại popup Chuyển bàn → đóng popup', async ({ page }) => {
    await tablePage.openTableMenu('Bàn 1');
    await tablePage.clickTransfer();

    const closeBtn = page.locator('.v-dialog--active .v-card__title button').filter({ hasText: '' }).first();
    
    await closeBtn.click();

    await expect(page.locator(tablePage.transferDialog)).not.toBeVisible();
  });

  test('TB_TC_05: Chọn bàn đích hợp lệ sẽ hiển thị xác nhận', async ({ page }) => {
    await tablePage.openTableMenu('Bàn 1');
    await tablePage.clickTransfer();

    await tablePage.selectTargetTableInPopup('Bàn 3');

    const confirmDialog = page.locator('.v-dialog--active').last();
    await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });

    await expect(confirmDialog).toContainText(/Bạn có xác nhận chuyển bàn không/i);

    await expect(confirmDialog.locator('button').filter({ hasText: /Xác nhận/i })).toBeVisible();
    await expect(confirmDialog.locator('button').filter({ hasText: /Hủy bỏ/i })).toBeVisible();
  });

  test('TB_TC_06: Nhấn "Hủy bỏ" tại popup xác nhận', async ({ page }) => {
    await tablePage.openTableMenu('Bàn 1');
    await tablePage.clickTransfer();
    await tablePage.selectTargetTableInPopup('Bàn 3');
    await tablePage.click(tablePage.cancelBtn);

    await expect(page.locator(tablePage.transferDialog).first()).toBeVisible();
  });

  test('TB_TC_07: Chuyển bàn thành công', async ({ page }) => {
    await tablePage.openTableMenu('Bàn 2');
    await tablePage.clickTransfer();
    await tablePage.selectTargetTableInPopup('Bàn 4');
    await tablePage.click(tablePage.confirmBtn);

    await expect(await tablePage.getTableLocator('Bàn 2')).toHaveClass(/room-card-free/);
    await expect(await tablePage.getTableLocator('Bàn 4')).toHaveClass(/room-card-busy/);
  });

  test('TB_TC_08: Mất kết nối Internet khi nhấn "Xác nhận"', async ({ context, page }) => {

    await tablePage.openTableMenu('Bàn 1');
    await tablePage.clickTransfer();
    await tablePage.selectTargetTableInPopup('Bàn 3');

    const confirmBtn = page.locator('.v-dialog--active').last().locator('button').filter({ hasText: /Xác nhận/i });
    await confirmBtn.waitFor({ state: 'visible' });

    await context.setOffline(true);

    await confirmBtn.click({ force: true });

    const errorPopup = page.getByText(/Có lỗi xảy ra|vui lòng thử lại|mất kết nối|failed|network/i);

    try {
      await expect(errorPopup.last()).toBeVisible({ timeout: 10000 });
    } catch (e) {
      console.log('Không tìm thấy thông báo lỗi cụ thể, kiểm tra trạng thái Dialog...');
      await expect(confirmBtn).toBeVisible(); 
    }

    await context.setOffline(false);
  });
});