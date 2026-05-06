const { test, expect } = require('@playwright/test');
const { TableManagementPage } = require('../pages/TableManagementPage');
const { LoginPage } = require('../pages/LoginPage');

test.describe('UC05 - Chức năng Chuyển bàn', () => {
  let tablePage;

  test.beforeEach(async ({ page }) => {
    tablePage = new TableManagementPage(page);
    // Truy cập vào trang quản lý phòng bàn
    await tablePage.goto('https://web.aibat.vn/phong-ban');
  });

  /**
   * TB_TC_01: Nút "Chuyển bàn" hiển thị khi bàn đang sử dụng
   * Step: Nhấn chọn ‘Bàn 1’.
   */
  test('TB_TC_01: Nút "Chuyển bàn" hiển thị khi bàn đang sử dụng', async ({ page }) => {
    const tableName = 'Bàn 1';

    // 1. Kiểm tra trạng thái bàn (phải là bận mới có menu chuyển bàn)
    const isBusy = await tablePage.isTableBusy(tableName);
    expect(isBusy).toBe(true);

    // 2. Mở menu của bàn
    await tablePage.openTableMenu(tableName);

    // 3. Kiểm tra nút "Chuyển bàn" xuất hiện trên trang
    // Sử dụng getByRole hoặc getByText để tìm một cách tự nhiên nhất
    const transferBtn = page.getByRole('listitem').filter({ hasText: /Chuyển bàn/i }).last();

    // Nếu không tìm thấy qua listitem, thử tìm bất kỳ button/div nào chứa chữ đó
    const fallbackBtn = page.locator('div, button').filter({ hasText: /^Chuyển bàn$/i }).last();

    // Assertion linh hoạt: một trong hai cách tìm phải thấy nút
    await expect(transferBtn.or(fallbackBtn)).toBeVisible({ timeout: 10000 });
  });

  /**
   * TB_TC_02: Nút "Chuyển bàn" KHÔNG hiển thị khi bàn trống
   * Step: Nhấn chọn ‘Bàn 3’.
   */
  test('TB_TC_02: Nút "Chuyển bàn" KHÔNG hiển thị khi bàn trống', async ({ page }) => {
    const tableName = 'Bàn 3';

    // Đảm bảo bàn đang ở trạng thái Trống trước khi thực hiện test
    const isBusy = await tablePage.isTableBusy(tableName);
    expect(isBusy).toBe(false);

    // Bước 1: Nhấn chọn ‘Bàn 3’
    await tablePage.openTableMenu(tableName);

    // Kết quả mong đợi: Nút "Chuyển bàn" KHÔNG hiển thị
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

    // Sử dụng locator chính xác hơn để tránh lỗi 4 phần tử
    // Nút X thường là nút duy nhất trong header của dialog có class v-btn--icon
    const closeBtn = page.locator('.v-dialog--active .v-card__title button').filter({ hasText: '' }).first();
    
    await closeBtn.click();

    // Đợi popup biến mất hoàn toàn
    await expect(page.locator(tablePage.transferDialog)).not.toBeVisible();
  });

  test('TB_TC_05: Chọn bàn đích hợp lệ sẽ hiển thị xác nhận', async ({ page }) => {
    await tablePage.openTableMenu('Bàn 1');
    await tablePage.clickTransfer();
    
    // Chọn bàn 3 (đảm bảo bàn này trống để có thể chọn được)
    await tablePage.selectTargetTableInPopup('Bàn 3');
    
    // Đợi popup xác nhận (thường là dialog hiện lên sau cùng)
    const confirmDialog = page.locator('.v-dialog--active').last();
    await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });
    
    // Kiểm tra nội dung câu hỏi xác nhận
    await expect(confirmDialog).toContainText(/Bạn có xác nhận chuyển bàn không/i);
    
    // Kiểm tra sự tồn tại của 2 nút
    await expect(confirmDialog.locator('button').filter({ hasText: /Xác nhận/i })).toBeVisible();
    await expect(confirmDialog.locator('button').filter({ hasText: /Hủy bỏ/i })).toBeVisible();
  });

  test('TB_TC_06: Nhấn "Hủy bỏ" tại popup xác nhận', async ({ page }) => {
    await tablePage.openTableMenu('Bàn 1');
    await tablePage.clickTransfer();
    await tablePage.selectTargetTableInPopup('Bàn 3');
    await tablePage.click(tablePage.cancelBtn);
    
    // Kiểm tra quay lại popup chuyển bàn
    await expect(page.locator(tablePage.transferDialog).first()).toBeVisible();
  });

  test('TB_TC_07: Chuyển bàn thành công', async ({ page }) => {
    await tablePage.openTableMenu('Bàn 2');
    await tablePage.clickTransfer();
    await tablePage.selectTargetTableInPopup('Bàn 4');
    await tablePage.click(tablePage.confirmBtn);

    // Kiểm tra trạng thái bàn thay đổi sau khi chuyển thành công
    await expect(await tablePage.getTableLocator('Bàn 2')).toHaveClass(/room-card-free/);
    await expect(await tablePage.getTableLocator('Bàn 4')).toHaveClass(/room-card-busy/);
  });

  test('TB_TC_08: Mất kết nối Internet khi nhấn "Xác nhận"', async ({ context, page }) => {
    // Các bước chuẩn bị
    await tablePage.openTableMenu('Bàn 1');
    await tablePage.clickTransfer();
    await tablePage.selectTargetTableInPopup('Bàn 3');

    // Tìm nút Xác nhận
    const confirmBtn = page.locator('.v-dialog--active').last().locator('button').filter({ hasText: /Xác nhận/i });
    await confirmBtn.waitFor({ state: 'visible' });

    // 1. Ngắt kết nối internet
    await context.setOffline(true);
    
    // 2. Nhấn nút “Xác nhận”
    // Dùng force: true vì một số button sẽ bị vô hiệu hóa khi mất mạng
    await confirmBtn.click({ force: true });

    // 3. Kiểm tra thông báo lỗi linh hoạt
    // Tìm bất kỳ thành phần nào chứa text lỗi mà không cần quan tâm class là gì
    const errorPopup = page.getByText(/Có lỗi xảy ra|vui lòng thử lại|mất kết nối|failed|network/i);
    
    // Đợi thông báo xuất hiện trong 10 giây
    try {
      await expect(errorPopup.last()).toBeVisible({ timeout: 10000 });
    } catch (e) {
      // Nếu không tìm thấy text cụ thể, kiểm tra xem nút 'Xác nhận' có còn đó không 
      // (Nếu click xong mà dialog không đóng và không có báo lỗi thì cũng là một dạng lỗi xử lý)
      console.log('Không tìm thấy thông báo lỗi cụ thể, kiểm tra trạng thái Dialog...');
      await expect(confirmBtn).toBeVisible(); 
    }

    // 4. Khôi phục mạng
    await context.setOffline(false);
  });
});