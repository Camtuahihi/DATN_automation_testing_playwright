// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['allure-playwright', {
      detail: true,
      outputFolder: 'allure-results',
      suiteTitle: true,
      environmentInfo: {
        framework: 'Playwright',
        application: 'Aibat - Quản lý kinh doanh',
        usecases: 'UC01-UC05',
      },
    }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://web.aibat.vn',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },

  projects: [
    // 1. Chạy setup để tạo ra các file auth
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
    },

    // 2. Nhóm UC01-UC04: Chỉ dùng 1 lần đăng nhập từ user.json[cite: 4]
    {
      name: 'UC01-UC04-Standard',
      testMatch: /uc0[1-4].*\.spec\.js/, 
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: 'playwright/.auth/user.json', // Tái sử dụng cùng 1 trạng thái[cite: 4]
      },
      dependencies: ['setup'],
    },

    // 3. Nhóm UC05: Dùng tài khoản FNB riêng biệt[cite: 4]
    {
      name: 'UC05-FNB',
      testMatch: /uc05.*\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: 'playwright/.auth/userFNB.json',
      },
      dependencies: ['setup'],
    },
  ],

  outputDir: 'test-results/',
});