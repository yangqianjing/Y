const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(8000);
  page.on('dialog', dialog => dialog.accept());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('file:///D:/1/Y/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);

  await page.locator('#fab-add').click();
  for (const key of ['1','2','3']) await page.locator(`[data-key="${key}"]`).click();
  await page.locator('#pick-account').click();
  await page.locator('.acc-opt:has-text("支付宝")').click();
  await page.locator('[data-key="done"]').click();
  await page.waitForTimeout(300);
  let state = await page.evaluate(() => ({ count: state.txs.length, balance: accountBalance(allAccounts().find(a => a.name === '支付宝')), last: state.txs.at(-1) }));
  console.log('CREATED', JSON.stringify(state));

  await page.locator('#txn-list .txn-item').first().hover();
  await page.locator('#txn-list .txn-item').first().locator('[data-action="edit"]').click();
  await page.waitForTimeout(300);
  for (const key of ['4','5','6']) await page.locator(`[data-key="${key}"]`).click();
  await page.locator('#add-offer').fill('3');
  await page.locator('[data-key="done"]').click();
  await page.waitForTimeout(400);
  state = await page.evaluate(() => ({ count: state.txs.length, balance: accountBalance(allAccounts().find(a => a.name === '支付宝')), last: state.txs.at(-1) }));
  console.log('EDITED', JSON.stringify(state));

  await page.locator('#txn-list .txn-item').first().hover();
  await page.locator('#txn-list .txn-item').first().locator('[data-action="delete"]').click();
  await page.waitForTimeout(400);
  state = await page.evaluate(() => ({ count: state.txs.length, balance: accountBalance(allAccounts().find(a => a.name === '支付宝')) }));
  console.log('DELETED', JSON.stringify(state));

  await page.locator('#open-search').click();
  await page.locator('.filter-chip[data-filter="amount"]').click();
  await page.locator('#filter-min').fill('100');
  await page.waitForTimeout(300);
  const totals = await page.locator('#search-totals').textContent();
  console.log('SEARCH', totals.trim());
  await page.keyboard.press('Escape');
  console.log('ERRORS', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
