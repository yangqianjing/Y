const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto('file:///D:/1/Y/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);

  const click = async selector => { await page.locator(selector).first().click(); await page.waitForTimeout(200); };
  const shot = async name => { await page.screenshot({ path: `work/journey-${name}.png`, fullPage: true }); };

  await shot('ledger');
  await click('.nav-item[data-page="assets"]'); await shot('assets');
  await click('.nav-item[data-page="savings"]'); await shot('savings');
  await click('.nav-item[data-page="stats"]'); await shot('stats');
  await click('.nav-item[data-page="settings"]'); await shot('settings');

  await click('.nav-item[data-page="ledger"]');
  await click('#fab-add');
  await shot('add-expense');
  await click('[data-key="1"]'); await click('[data-key="2"]'); await click('[data-key="3"]');
  await click('#pick-account');
  await shot('account-modal');
  await click('.acc-opt:has-text("支付宝")');
  await shot('add-expense-after-account');
  await click('.cat-opt:has-text("餐饮")');
  await click('.sub-chip:has-text("三餐")');
  await click('#pick-datetime');
  await shot('time-modal');
  await click('#time-confirm');
  await click('[data-key="done"]');
  await page.waitForTimeout(400);
  await shot('ledger-after-expense');
  const expenseState = await page.evaluate(() => ({
    txCount: state.txs.length,
    last: state.txs.at(-1),
    alipay: accountBalance(allAccounts().find(a => a.name === '支付宝')),
    summary: document.querySelector('#summary-cards').textContent,
  }));
  console.log('EXPENSE', JSON.stringify(expenseState, null, 2));

  await click('#fab-add');
  await click('.add-tab[data-type="income"]');
  await click('[data-key="8"]'); await click('[data-key="8"]');
  await click('#pick-account');
  await click('.acc-opt:has-text("招商银行")');
  await click('.cat-opt:has-text("副业")');
  await click('[data-key="done"]');
  await page.waitForTimeout(400);
  const incomeState = await page.evaluate(() => ({
    txCount: state.txs.length,
    last: state.txs.at(-1),
    cmb: accountBalance(allAccounts().find(a => a.name === '招商银行')),
  }));
  console.log('INCOME', JSON.stringify(incomeState, null, 2));

  await click('#fab-add');
  await click('.add-tab[data-type="transfer"]');
  await click('[data-key="5"]'); await click('[data-key="0"]');
  await click('#pick-account');
  await click('.acc-opt:has-text("支付宝")');
  await click('#pick-cat');
  await shot('transfer-account-modal');
  await click('.acc-opt:has-text("招商银行")');
  await click('[data-key="done"]');
  await page.waitForTimeout(400);
  const transferState = await page.evaluate(() => ({
    txCount: state.txs.length,
    last: state.txs.at(-1),
    alipay: accountBalance(allAccounts().find(a => a.name === '支付宝')),
    cmb: accountBalance(allAccounts().find(a => a.name === '招商银行')),
  }));
  console.log('TRANSFER', JSON.stringify(transferState, null, 2));

  await click('#open-search');
  await shot('search');
  await page.keyboard.press('Escape');
  await click('#goto-month-stats');
  await shot('month-stats');
  await click('#stats-mode-btn');
  await shot('week-stats');
  await click('.nav-item[data-page="assets"]');
  await click('.acc-item:has-text("支付宝")');
  await shot('asset-detail');

  console.log('ERRORS', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
