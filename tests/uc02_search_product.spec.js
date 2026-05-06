// @ts-check
const { test, expect } = require('@playwright/test');
const { OrderPage } = require('../pages/OrderPage');

// ─── A. HIỂN THỊ MẶC ĐỊNH ─────────────────────────────────────────────────
// Condition ID: FP_01 — Hiển thị giao diện ban đầu
// URL: https://web.aibat.vn/tao-don-ban-v2
//
// Ghi chú DOM: category tabs (div.category-scroll > span) được render lazy
// bằng Vue v-if — chỉ xuất hiện sau khi người dùng click vào search input.
// Dropdown container (div.product-search-dropdown) mặc định display:none.

test.describe('A. Hiển thị mặc định', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open(); // dismiss modal "Chọn chi nhánh" nếu có
  });

  // ── FP_TC_01 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_01 - Khung tìm kiếm và tab Nhóm mặt hàng hiển thị ngay khi vào màn Tạo đơn bán hàng @high @smoke @ui',
    async ({ page }) => {
      // 1. Khung tìm kiếm hiển thị ngay sau khi truy cập trang
      await expect(op.searchInput).toBeVisible();
      await expect(op.searchInput).toBeEnabled();
      await expect(op.searchInput).toHaveAttribute('placeholder', 'Nhập sản phẩm (F2)');

      // 2. Click vào search để kích hoạt render tab (trigger v-if)
      await op.searchInput.click();
      await op.dropdownContainer.waitFor({ state: 'visible', timeout: 10000 });

      // 3. Dải tab Nhóm mặt hàng hiển thị (ít nhất 1 tab)
      await expect(op.categoryTabs.first()).toBeVisible();
      const tabCount = await op.categoryTabs.count();
      expect(tabCount).toBeGreaterThan(0);

      // 4. Tab "Tất cả" active mặc định — background màu xanh nhạt
      const tatCaTab = op.categoryTabs.filter({ hasText: 'Tất cả' });
      await expect(tatCaTab).toBeVisible();
      await op.expectCategoryActive('Tất cả');
    },
  );

  // ── FP_TC_02 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_02 - Click vào khung tìm kiếm khi chưa nhập từ khóa hiển thị danh sách sản phẩm đầy đủ @high @smoke @ui',
    async ({ page }) => {
      // Trước khi click: dropdown container phải ẩn (display:none)
      await expect(op.dropdownContainer).toBeHidden();

      // Click vào khung tìm kiếm, chưa nhập từ khóa
      await op.searchInput.click();

      // Dropdown xuất hiện
      await expect(op.dropdownContainer).toBeVisible({ timeout: 10000 });

      // Có ít nhất 2 sản phẩm (danh sách đầy đủ, không chỉ 1 sản phẩm)
      await op.expectResultsVisible();
      const count = await op.productDropdown.count();
      expect(count).toBeGreaterThan(1);
    },
  );

  // ── FP_TC_03 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_03 - Mỗi dòng kết quả hiển thị đủ 5 trường: Tên, Mã, Giá bán lẻ, Có thể bán, Loại sản phẩm @high @ui',
    async () => {
      // Mở dropdown
      await op.searchInput.click();
      await op.expectResultsVisible();

      // Lấy text thô của dòng đầu tiên để kiểm tra cả 5 trường
      const firstItem = op.productDropdown.first();
      const rawText = (await firstItem.textContent()) || '';

      // 1 & 2. Tên + Mã sản phẩm — qua getDropdownResults() (parse "Tên - MÃ")
      const results = await op.getDropdownResults();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name.trim().length).toBeGreaterThan(0);
      expect(results[0].code).toMatch(/\d+/);

      // 3. Giá bán lẻ — pattern "X.XXX đ"
      expect(results[0].price).toMatch(/[\d.,]+\s*đ/);

      // 4. Có thể bán — label xuất hiện trong raw text của item
      expect(rawText).toContain('Có thể bán');

      // 5. Loại sản phẩm — pattern "Sản phẩm : Thường|Combo|IMEI|..."
      expect(rawText).toMatch(/Sản phẩm\s*:/);
    },
  );

  // ── FP_TC_04 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_04 - Click ra ngoài khung tìm kiếm đóng dropdown @medium @ui',
    async ({ page }) => {
      // Mở dropdown
      await op.searchInput.click();
      await expect(op.dropdownContainer).toBeVisible({ timeout: 10000 });

      // Click vào vùng trống ngoài dropdown (góc trên trái màn hình)
      await page.mouse.click(10, 10);

      // Dropdown đóng lại
      await op.expectDropdownHidden();

      // Khung tìm kiếm vẫn còn trên màn hình
      await expect(op.searchInput).toBeVisible();
    },
  );
});

// ─── B. RÀNG BUỘC SỐ KÝ TỰ TỐI THIỂU ────────────────────────────────────
// Condition ID: FP_02 — Ngưỡng ký tự tối thiểu để kích hoạt truy vấn (≥ 2 ký tự)

test.describe('B. Ràng buộc số ký tự tối thiểu', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    await op.searchInput.click();
    await op.expectResultsVisible();
  });

  // ── FP_TC_05 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_05 - Nhập 01 ký tự không kích hoạt truy vấn, dropdown hiển thị "Không có dữ liệu" @high @functional',
    async ({ page }) => {
      // Dùng pressSequentially thay fill để tránh Vue reset giá trị input
      await op.searchInput.fill('b');
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);

      expect(await op.getSearchValue()).toBe('b');

      // Hệ thống KHÔNG gọi API → dropdown hiển thị "Không có dữ liệu"
      await expect(op.noDataMessage).toBeVisible();
    },
  );

  // ── FP_TC_06 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_06 - Nhập đủ 02 ký tự kích hoạt truy vấn, dropdown hiển thị sản phẩm (khác với trạng thái 1 ký tự) @high @boundary',
    async ({ page }) => {
      // Nhập đúng 2 ký tự "bi"
      await op.searchInput.fill('bi');
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);

      // Xác nhận ô tìm kiếm có đúng 2 ký tự
      expect(await op.getSearchValue()).toBe('bi');

      // Bằng chứng API đã được gọi:
      // 2 ký tự → state KHÁC với 1 ký tự ("b" → "Không có dữ liệu")
      // Hệ thống truy vấn và trả về sản phẩm (dù "bi" có thể match rộng)
      // → productDropdown hiển thị ít nhất 1 item, KHÔNG có "Không có dữ liệu"
      await expect(op.productDropdown.first()).toBeVisible({ timeout: 5000 });
      expect(await op.productDropdown.count()).toBeGreaterThan(0);
      await expect(op.noDataMessage).toBeHidden();
    },
  );

  // ── FP_TC_07 ──────────────────────────────────────────────────────────────
test(
    'FP_TC_07 - Xóa bớt còn 1 ký tự, dropdown hiển thị "Không có dữ liệu" @high @functional',
    async ({ page }) => {
      // 1. Nhập 'bi' (2 ký tự) để kích hoạt danh sách sản phẩm khớp từ khóa
      await op.searchInput.pressSequentially('bi');
      
      // Chờ cho đến khi sản phẩm đầu tiên xuất hiện để xác nhận danh sách đã load
      await op.productDropdown.first().waitFor({ state: 'visible', timeout: 5000 });

      // 2. Xóa bớt 1 ký tự cuối → ô tìm kiếm còn "b"
      await op.searchInput.press('Backspace');

      // 3. XỬ LÝ THỰC TẾ AIBAT: 
      // Khi còn 1 ký tự, hệ thống xóa danh sách cũ và hiện "Không có dữ liệu"
      // Đợi danh sách cũ biến mất (Hidden) trước khi check thông báo lỗi
      await expect(op.productDropdown.first()).toBeHidden({ timeout: 5000 });
      
      // Xác nhận ô tìm kiếm còn đúng 1 ký tự
      //expect(await op.getSearchValue()).toBe('b');

      // Xác nhận thông báo "Không có dữ liệu" hiển thị
      await expect(op.noDataMessage).toBeVisible();
    },
  );
});

// ─── C. TÌM KIẾM THEO TÊN SẢN PHẨM ─────────────────────────────────────────
// Condition ID: FP_03

test.describe('C. Tìm kiếm theo tên sản phẩm', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    await op.searchInput.click();
    await op.expectResultsVisible();
  });

  // ── FP_TC_08 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_08 - Tìm theo tên đầy đủ của sản phẩm @high @functional',
    async ({ page }) => {
      await op.searchInput.fill('bia Hà Nội');
      await page.waitForTimeout(800);

      if (await op.noDataMessage.isVisible()) {
        test.skip(true, 'Sản phẩm "bia Hà Nội" chưa có trong môi trường test');
      }
      await expect(op.productDropdown.first()).toBeVisible({ timeout: 5000 });
      expect(await op.productDropdown.count()).toBeGreaterThan(0);
      await expect(op.noDataMessage).toBeHidden();
      await page.waitForTimeout(2000);
    },
  );

  // ── FP_TC_09 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_09 - Tìm theo một phần tên (substring match) @high @functional',
    async ({ page }) => {
      await op.searchInput.fill('hà nội');
      await page.waitForTimeout(800);

      if (await op.noDataMessage.isVisible()) {
        test.skip(true, 'Không có sản phẩm nào chứa "hà nội" trong môi trường test');
      }
      await expect(op.productDropdown.first()).toBeVisible({ timeout: 5000 });
      expect(await op.productDropdown.count()).toBeGreaterThan(0);
      await expect(op.noDataMessage).toBeHidden();
      await page.waitForTimeout(2000);
    },
  );
  

  // ── FP_TC_10 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_10 - Tìm không phân biệt chữ hoa/thường @high @functional',
    async ({ page }) => {
      // Kiểm tra sản phẩm "Lòng xào dưa" có tồn tại không trước khi chạy
      await op.searchInput.fill('Lòng xào dưa');
      await page.waitForTimeout(800);

      if (await op.noDataMessage.isVisible()) {
        test.skip(true, 'Sản phẩm "Lòng xào dưa" chưa có trong môi trường test');
      }

      const baseCount = await op.productDropdown.count();
      await op.clearSearch();
      await page.waitForTimeout(400);

      // Lần lượt tìm với 3 cách viết hoa/thường — phải cho cùng kết quả
      const variations = ['lòng xào dưa', 'LÒNG XÀO DƯA', 'LòNg Xào DưA'];
      for (const kw of variations) {
        await op.searchInput.fill(kw);
        await page.waitForTimeout(800);
        const count = await op.productDropdown.count();
        expect(count).toBe(baseCount);
        await op.clearSearch();
        await page.waitForTimeout(400);
      }
    },
  );

  // ── FP_TC_11 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_11 - Tìm với ký tự đặc biệt (°) trong tên, hệ thống xử lý đúng @medium @functional',
    async ({ page }) => {
      // Precondition: hệ thống có sản phẩm "Ống nhựa PVC 90° - Ø 21mm"
      await op.searchInput.fill('90°');
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);

      if (await op.noDataMessage.isVisible()) {
        test.skip(true, 'Sản phẩm chứa ký tự "90°" chưa có trong môi trường test');
      }

      await op.expectResultsVisible();
      const results = await op.getDropdownResults();
      const names = results.map((r) => r.name);
      const matched = names.some((n) => n.includes('90°'));
      expect(matched, `Tên thực tế trong dropdown: ${JSON.stringify(names)}`).toBe(true);
    },
  );

  // ── FP_TC_12 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_12 - Tìm với keyword tiếng Việt không dấu, hệ thống phản hồi bình thường @low @functional',
    async ({ page }) => {
      // Đặc tả: behavior theo thực tế hệ thống (không cam kết kết quả cụ thể)
      await op.searchInput.fill('bia ha noi');
      // Chờ network settle thay vì fixed timeout để tránh false-fail khi API chậm
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);

      // Chỉ verify hệ thống không crash và dropdown phản hồi hợp lệ
      const hasResults = (await op.productDropdown.count()) > 0;
      const hasNoData = await op.noDataMessage.isVisible();
      expect(hasResults || hasNoData).toBe(true);
    },
  );

  // ── FP_TC_13 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_13 - Tìm với khoảng trắng đầu/cuối, hệ thống tự trim và trả kết quả @low @functional',
    async ({ page }) => {
      // Precondition: hệ thống có sản phẩm "bia Hà Nội"
      await op.searchInput.fill('  bia  ');
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);

      if (await op.noDataMessage.isVisible()) {
        test.skip(true, 'Sản phẩm "bia" chưa có hoặc hệ thống không hỗ trợ trim khoảng trắng');
      }

      await op.expectResultsVisible();
      const results = await op.getDropdownResults();
      const names = results.map((r) => r.name);
      const matched = names.some((n) => n.toLowerCase().includes('bia'));
      expect(matched, `Tên thực tế trong dropdown: ${JSON.stringify(names)}`).toBe(true);
    },
  );
});

// ─── D. TÌM KIẾM THEO MÃ SẢN PHẨM (SKU) ────────────────────────────────────
// Condition ID: FP_04

test.describe('D. Tìm kiếm theo mã sản phẩm (SKU)', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    await op.searchInput.click();
    await op.expectResultsVisible();
  });

  // ── FP_TC_14 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_14 - Tìm chính xác theo mã đầy đủ, sản phẩm có mã đó hiển thị @high @functional',
    async ({ page }) => {
      // Precondition: hệ thống có sản phẩm mã = "5852212"
      await op.searchInput.fill('5852212');
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);

      if (await op.noDataMessage.isVisible()) {
        test.skip(true, 'Sản phẩm mã "5852212" chưa có trong môi trường test');
      }

      await op.expectResultsVisible();
      const results = await op.getDropdownResults();
      const codes = results.map((r) => r.code);
      const matched = codes.some((c) => c.includes('5852212'));
      expect(matched, `Mã thực tế trong dropdown: ${JSON.stringify(codes)}`).toBe(true);
    },
  );

  // ── FP_TC_15 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_15 - Tìm theo một phần mã (substring), sản phẩm có mã chứa chuỗi đó hiển thị @high @functional',
    async ({ page }) => {
      await op.searchInput.fill('58522');
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);

      if (await op.noDataMessage.isVisible()) {
        test.skip(true, 'Không có sản phẩm nào có mã chứa "58522" trong môi trường test');
      }

      await op.expectResultsVisible();
      const results = await op.getDropdownResults();
      const codes = results.map((r) => r.code);
      const matched = codes.some((c) => c.includes('58522'));
      expect(matched, `Mã thực tế trong dropdown: ${JSON.stringify(codes)}`).toBe(true);
    },
  );

  // ── FP_TC_16 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_16 - Tìm theo mã có chứa chữ cái (alphanumeric), case-insensitive @medium @functional',
    async ({ page }) => {
      // Precondition: hệ thống có sản phẩm mã = "ABC-001"
      await op.searchInput.fill('abc');
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);

      if (await op.noDataMessage.isVisible()) {
        test.skip(true, 'Sản phẩm mã "abc001" chưa có trong môi trường test');
      }

      await op.expectResultsVisible();
      const results = await op.getDropdownResults();
      const codes = results.map((r) => r.code);
      const matched = codes.some((c) => c.toLowerCase().includes('abc'));
      expect(matched, `Mã thực tế trong dropdown: ${JSON.stringify(codes)}`).toBe(true);
    },
  );
});

// ─── E. KẾT QUẢ TRỐNG (NO RESULT) ──────────────────────────────────────────
// Condition ID: FP_05

test.describe('E. Kết quả trống (No Result)', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    await op.searchInput.click();
    await op.expectResultsVisible();
  });

  // ── FP_TC_17 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_17 - Hiển thị "Không có dữ liệu" khi từ khóa không khớp bất kỳ sản phẩm nào @high @negative',
    async ({ page }) => {
      await op.searchInput.fill('xyz123abc');
      await page.waitForTimeout(800);

      await expect(op.noDataMessage).toBeVisible();
      expect(await op.productDropdown.count()).toBe(0);
    },
  );

  // ── FP_TC_18 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_18 - Hiển thị "Không có dữ liệu" khi tab nhóm mặt hàng không có sản phẩm @medium @negative',
    async () => {
      test.skip(true, 'Cần nhóm mặt hàng rỗng (0 sản phẩm) — xác nhận với BA về dữ liệu test');
    },
  );
});

// ─── F. LỌC THEO NHÓM MẶT HÀNG ─────────────────────────────────────────────
// Condition ID: FP_06

test.describe('F. Lọc theo nhóm mặt hàng', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    // Click search để render category tabs (v-if trigger) và mở dropdown
    await op.searchInput.click();
    await op.expectResultsVisible();
  });

  // ── FP_TC_19 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_19 - Nhấn tab nhóm, dropdown chỉ hiển thị sản phẩm thuộc nhóm đó @high @functional',
    async ({ page }) => {
      const TAB = 'Thực phẩm Tươi sống & Nông sản';
      const allCount = await op.productDropdown.count();

      await op.selectCategory(TAB);
      await page.waitForTimeout(500);

      // Tab đang active
      await op.expectCategoryActive(TAB);

      // Kết quả phải ≤ full list (nhóm là tập con của toàn bộ) hoặc empty state
      const groupCount = await op.productDropdown.count();
      const isNoData = await op.noDataMessage.isVisible();
      expect(groupCount <= allCount || isNoData).toBe(true);
    },
  );

  // ── FP_TC_20 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_20 - Tab nhóm có thể scroll ngang khi số lượng tab vượt chiều ngang màn hình @medium @ui',
    async ({ page }) => {
      // Cần nhiều hơn 5 tab để overflow
      const tabCount = await op.categoryTabs.count();
      expect(tabCount).toBeGreaterThan(5);

      // Container category-scroll cho phép scroll ngang (scrollWidth > clientWidth)
      const isScrollable = await page.evaluate(() => {
        const el = document.querySelector('.category-scroll');
        return el ? el.scrollWidth > el.clientWidth : false;
      });
      expect(isScrollable).toBe(true);
    },
  );
});

// ─── G. KẾT HỢP TÌM KIẾM + LỌC NHÓM ───────────────────────────────────────
// Condition ID: FP_07

test.describe('G. Kết hợp tìm kiếm và lọc nhóm', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    await op.searchInput.click();
    await op.expectResultsVisible();
  });

  // ── FP_TC_21 ──────────────────────────────────────────────────────────────
  test(
      'FP_TC_21 - Tìm kiếm trong tab nhóm, chỉ hiển thị sản phẩm thuộc nhóm VÀ khớp từ khóa @high @functional',
      async ({ page }) => {
        const categoryName = 'Thực phẩm Tươi sống & Nông sản';
        const keyword = 'cá hồi';

        // 1. Chọn nhóm mặt hàng (hàm này đã được sửa ở trên để chờ CSS)
        await op.selectCategory(categoryName);
        
        // 2. Click vào ô search để mở dropdown (Aibat thường đóng dropdown khi click tab)
        await op.searchInput.click();
        await op.searchInput.fill(keyword);

        const results = await op.getDropdownResults();
        expect(results.length).toBeGreaterThan(0);
        
        for (const item of results) {
          expect(item.name.toLowerCase()).toContain(keyword);
        }
      },
    );

  // ── FP_TC_22 ──────────────────────────────────────────────────────────────
  // test(
  //   'FP_TC_22 - Sản phẩm khớp từ khóa nhưng không thuộc nhóm đang lọc KHÔNG hiển thị @high @functional',
  //   async () => {
  //     test.skip(
  //       true,
  //       'Cần xác nhận "Cá thu nướng" thuộc "Món" và không thuộc "Thực phẩm Tươi sống & Nông sản" — phụ thuộc dữ liệu test',
  //     );
  //   },
  // );
// ── FP_TC_22 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_22 - Sản phẩm khớp từ khóa nhưng không thuộc nhóm đang lọc KHÔNG hiển thị @high @functional',
    async ({ page }) => {
      const keyword = 'Cá thu'; // Từ khóa mục tiêu
      const groupALL = 'Tất cả';
      const groupSpecific = 'Thực phẩm Tươi sống & Nông sản';

      // 1. Bước 1: Xác nhận từ khóa này CÓ tồn tại trong hệ thống (ở tab Tất cả)
      await op.selectCategory(groupALL);
      await op.searchInput.click();
      await op.searchInput.fill(keyword);
      await page.waitForTimeout(1000);
      
      const countAtAll = await op.productDropdown.count();
      if (countAtAll === 0) {
        // Nếu database của Tú không có "Cá thu", bài test sẽ tự bỏ qua để không báo lỗi oan
        test.skip(true, `Từ khóa "${keyword}" không có trong hệ thống, không thể test lọc âm.`);
      }

      // 2. Bước 2: Chuyển sang nhóm cụ thể (nhóm mà ta biết không chứa "Cá thu")
      await op.selectCategory(groupSpecific);
      
      // Quan trọng: Click lại ô search để dropdown hiện ra với dữ liệu của tab mới[cite: 2]
      await op.searchInput.click();
      await op.searchInput.fill(keyword);
      await page.waitForTimeout(1000);

      // 3. XÁC NHẬN: Hệ thống phải báo "Không có dữ liệu" hoặc không chứa sản phẩm đó[cite: 1]
      const results = await op.getDropdownResults().catch(() => []);
      const isMatched = results.some(r => r.name.toLowerCase().includes(keyword.toLowerCase()));
      
      // Pass nếu: Không tìm thấy sản phẩm khớp HOẶC hiện thông báo "Không có dữ liệu"[cite: 1]
      const isNoData = await op.noDataMessage.isVisible();
      expect(isMatched === false || isNoData === true).toBe(true);
    },
  );
});

// ─── H. XÓA TỪ KHÓA / RESET ─────────────────────────────────────────────────
// Condition ID: FP_08

test.describe('H. Xóa từ khóa / Reset', () => {
  /** @type {OrderPage} */
  let op;
  /** @type {number} */
  let fullCount;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    await op.searchInput.click();
    await op.expectResultsVisible();
    fullCount = await op.productDropdown.count();
  });

  // ── FP_TC_23 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_23 - Xóa toàn bộ ký tự trong ô tìm kiếm, danh sách trở về đầy đủ @high @functional',
    async ({ page }) => {
      // Nhập 2 ký tự để kích hoạt filter
      await op.searchInput.pressSequentially('bi');
      await page.waitForTimeout(800);
      await expect(op.productDropdown.first()).toBeVisible({ timeout: 5000 });

      // Xóa toàn bộ
      await op.clearSearch();
      await page.waitForTimeout(800);

      expect(await op.getSearchValue()).toBe('');

      // Danh sách trở về đầy đủ
      const countAfterClear = await op.productDropdown.count();
      expect(countAfterClear).toBe(fullCount);
    },
  );
});

// ─── I. BẢO MẬT ──────────────────────────────────────────────
// Condition ID: FP_09

test.describe('I. Bảo mật', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
  });

  // ── FP_TC_24 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_24 - Nhập XSS payload vào ô tìm kiếm, hệ thống không thực thi script @high @security',
    async ({ page }) => {
      // Đăng ký dialog handler TRƯỚC khi thao tác (để bắt alert tức thì)
      let alertFired = false;
      page.once('dialog', async (dialog) => {
        alertFired = true;
        await dialog.dismiss();
      });

      await op.searchInput.click();
      await op.dropdownContainer.waitFor({ state: 'visible', timeout: 10000 });
      await op.searchInput.fill('<script>alert("XSS")</script>');
      await page.waitForTimeout(1000);

      // Không có alert nào được kích hoạt
      expect(alertFired).toBe(false);

      // Hệ thống vẫn hoạt động bình thường (dropdown còn hiển thị)
      await expect(op.dropdownContainer).toBeVisible();
    },
  );
});

// ─── J. XỬ LÝ MẤT KẾT NỐI MẠNG ────────────────────────────────────────────
// Condition ID: FP_11

test.describe('J. Xử lý mất kết nối mạng', () => {
  test(
    'FP_TC_25 - Mất kết nối Internet khi tìm kiếm, hiển thị thông báo lỗi thân thiện @medium @negative',
    async () => {
      test.skip(true, 'Yêu cầu thao tác ngắt kết nối mạng thủ công — không tự động hóa trong môi trường CI');
    },
  );
});

// ─── K. DATA ĐẶC BIỆT ──────────────────────────────────────
// Condition ID: FP_12

test.describe('K. Data đặc biệt', () => {
  /** @type {OrderPage} */
  let op;

  test.beforeEach(async ({ page }) => {
    op = new OrderPage(page);
    await op.open();
    await op.searchInput.click();
    await op.expectResultsVisible();
  });

  // ── FP_TC_26 ──────────────────────────────────────────────────────────────
  test(
    'FP_TC_26 - Sản phẩm trạng thái "Ngừng bán" không hiển thị trong dropdown tìm kiếm @high @functional',
    async ({ page }) => {
      // Precondition: hệ thống có sản phẩm "Test Ngung Ban" trạng thái "Ngừng bán"
      await op.searchInput.fill('Test Ngung');
      await page.waitForTimeout(800);

      // Sản phẩm "Ngừng bán" KHÔNG được xuất hiện trong kết quả
      const results = await op.getDropdownResults();
      const hasStoppedProduct = results.some((r) =>
        r.name.toLowerCase().includes('test ngung ban'),
      );
      expect(hasStoppedProduct).toBe(false);
    },
  );
});