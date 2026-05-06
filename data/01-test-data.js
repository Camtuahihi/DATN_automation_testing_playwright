module.exports = {
  ACCOUNT: {
    phone: '0344400592',
    password: '123123',
  },

  URLS: {
    base: 'https://web.aibat.vn',
    productList: '/san-pham',
  },

  EXISTING_DATA: {
    duplicateSKU: '6410118',
    duplicateBarcode: '2004281469011',
    comboComponent1: '6496232',
    comboComponent2: '6496236',
  },

  NAMES: {
    len149: 'Sản phẩm mẫu cao cấp phiên bản giới hạn 2026 tích hợp công nghệ AI mới giúp tối ưu hóa hiệu suất người dùng trong điều kiện thời tiết thực tế 1234567',
    len150: 'Sản phẩm mẫu cao cấp phiên bản giới hạn 2026 tích hợp công nghệ AI mới giúp tối ưu hóa hiệu suất người dùng trong điều kiện thời tiết thực tế 12345678',
    len151: 'Sản phẩm mẫu cao cấp phiên bản giới hạn 2026 tích hợp công nghệ AI mới giúp tối ưu hóa hiệu suất người dùng trong điều kiện thời tiết thực tế 123456789',
    unicode: 'Sản phẩm @#$%&*()_+ — Việt 中文',
    xssPayload: '<script>alert("XSS")</script>',
  },

  XSS_PAYLOADS: {
    description: '<img src=x onerror=alert(1)>',
  },

  uniqueName: (prefix = 'TEST') =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,

  randomString: (len) => 'a'.repeat(len),
};
