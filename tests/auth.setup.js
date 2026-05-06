const { test: setup } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');

const authTasks = [
  {
    name: 'Standard User (UC01-04)',
    saveTo: 'playwright/.auth/user.json',
    method: (lp) => lp.loginAsValidUser()
  },
  {
    name: 'FNB User (UC05)',
    saveTo: 'playwright/.auth/userFNB.json',
    method: (lp) => lp.loginAsValidUserFNB()
  }
];

for (const task of authTasks) {
  setup(`Setup auth cho ${task.name}`, async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    
    await task.method(loginPage);
    
    await loginPage.expectLoginSuccess();

    await page.context().storageState({ path: task.saveTo });
  });
}