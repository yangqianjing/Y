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

  const expect = async (actual, expected, message) => {
    if (actual !== expected) throw new Error(`${message}: ${actual} != ${expected}`);
    console.log(`PASS ${message}`);
  };

  await page.locator('#fab-add').click();
  await page.locator('[data-key="7"]').click();
  await page.locator('[data-key="8"]').click();
  await page.locator('[data-key="cancel"]').click();
  await page.waitForTimeout(200);
  await expect(await page.locator('#add-overlay').evaluate(el => el.classList.contains('hidden')), true, '记一笔面板可取消');

  await page.locator('#fab-add').click();
  await page.locator('[data-key="4"]').click();
  await page.locator('[data-key="5"]').click();
  await page.locator('#add-offer').fill('0.001');
  await page.locator('[data-key="done"]').click();
  await page.waitForTimeout(200);
  await expect(await page.locator('#add-overlay').evaluate(el => el.classList.contains('hidden')), false, '三位小数优惠被拦截');
  await page.locator('#add-offer').fill('1');
  await page.locator('#add-offer').fill('1');
  await page.locator('[data-key="done"]').click();
  await page.waitForTimeout(400);
  await page.locator('.nav-item[data-page="assets"]').click();
  await page.locator('.acc-item:has-text("支付宝")').first().click();
  const monthlyFlow = await page.locator('#assets-right .dt-meta').first().textContent();
  await expect(monthlyFlow.includes('¥44.00'), true, '资产详情使用优惠后金额');
  await expect(monthlyFlow.includes('¥45.00'), false, '资产详情不再使用原始金额');

  await page.locator('.acc-item:has-text("公积金")').first().click();
  await page.locator('#assets-right [data-action="record"]').click();
  const transferType = await page.evaluate(() => add.type);
  const transferTarget = await page.evaluate(() => add.toAccount);
  await expect(transferType, 'transfer', '资产详情转入使用转账类型');
  await expect(transferTarget.startsWith('公积金'), true, '资产详情转入目标正确');
  await page.locator('[data-key="1"]').click();
  await page.locator('[data-key="0"]').click();
  await page.locator('#add-note').fill('转账备注审计');
  await page.locator('[data-key="done"]').click();
  await page.waitForTimeout(400);
  const transferNote = await page.evaluate(() => state.txs.find(t => t.type === 'transfer' && t.note === '转账备注审计')?.note || '');
  await expect(transferNote, '转账备注审计', '转账备注会被保存');

  await page.locator('#asset-add').click();
  await page.locator('#acc-form-name').fill('审计临时账户');
  await page.locator('#acc-form-balance').fill('100');
  await page.locator('#account-save').click();
  await page.locator('.acc-item:has-text("审计临时账户")').first().click();
  await page.locator('.nav-item[data-page="ledger"]').click();
  await page.locator('#fab-add').click();
  await page.locator('[data-key="2"]').click();
  await page.locator('[data-key="5"]').click();
  await page.locator('#pick-account').click();
  await page.locator('.acc-opt:has-text("审计临时账户")').click();
  await page.locator('[data-key="done"]').click();
  await page.waitForTimeout(400);
  await page.locator('.nav-item[data-page="assets"]').click();
  await page.locator('.acc-item:has-text("审计临时账户")').first().click();
  await page.locator('.acc-item:has-text("审计临时账户")').first().click();
  await page.locator('#assets-right [data-action="edit-account"]').click();
  await page.locator('#acc-form-balance').fill('200');
  await page.locator('#account-save').click();
  await page.waitForTimeout(400);
  const editedBalance = await page.evaluate(() => accountBalance(allAccounts().find(a => a.name === '审计临时账户')));
  await expect(editedBalance, 200, '编辑账户余额立即生效');
  const shownBalance = await page.locator('#assets-right .dt-amount').textContent();
  await expect(shownBalance.trim(), '¥200.00', '编辑余额显示正确');

  await page.evaluate(() => {
    const credit = allAccounts().find(a => a.name === '中信银行');
    saveAccountBalance(credit, 100);
    state.selectedAccountId = credit.id;
    renderAssets();
  });
  const creditSummary = await page.evaluate(() => assetSummary());
  await expect(creditSummary.debt, 0, '信用卡余额为正时不计入负债');
  const creditLimit = await page.evaluate(() => creditLimitOf(allAccounts().find(a => a.name === '中信银行')));
  await expect(creditLimit, 20029.10, '信用卡多还款后可用额度正确');
  const creditLabel = await page.locator('#assets-right .dt-amount-label').textContent();
  await expect(creditLabel.includes('当前余额'), true, '信用卡余额为正时显示余额');

  console.log('ERRORS', errors);
  if (errors.length) process.exit(1);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
