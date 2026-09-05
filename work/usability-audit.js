const { chromium } = require('playwright');

const findings = [];
function note(issue, evidence) {
  findings.push({ issue, evidence });
  console.log(`FIND ${issue} :: ${evidence}`);
}
async function tryClick(page, selector, label) {
  try {
    await page.locator(selector).click({ timeout: 2000 });
    await page.waitForTimeout(250);
  } catch (e) {
    note(`${label} 无法点击`, String(e.message).split('\n')[0]);
    return;
  }
  const after = await page.evaluate(() => document.querySelector('#toast').textContent);
  if (after.includes('演示') || after.includes('未开放') || after.includes('暂未')) note(`${label} 是不可用占位`, after);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.setDefaultTimeout(5000);
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(e.message));
  await page.goto('file:///D:/1/Y/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(500);

  await tryClick(page, '#book-chip', '账本切换');
  await tryClick(page, '#open-search', '打开搜索');
  for (const sel of ['.filter-chip[data-filter="time"]', '.filter-chip[data-filter="amount"]', '.filter-chip[data-filter="more"]']) {
    await tryClick(page, sel, '搜索筛选');
  }
  await page.keyboard.press('Escape');
  await tryClick(page, '#goto-month-stats', '按月统计');
  await tryClick(page, '#stats-filter', '统计筛选');
  await tryClick(page, '#sync-btn', '同步');
  await tryClick(page, '#help-btn', '帮助');

  await page.locator('.nav-item[data-page="savings"]').click();
  await page.waitForTimeout(300);
  await tryClick(page, '#savings-add', '存钱页记一笔');
  await page.evaluate(() => document.querySelector('#add-overlay').classList.add('hidden'));
  await page.waitForTimeout(150);
  const flexible = await page.locator('#plan-detail').textContent();
  if (flexible.includes('灵活存钱 · 随时存入') && await page.locator('#deposit-plan').count() === 0) {
    note('灵活存钱没有入账入口', '详情只有提示文本');
  }

  await page.locator('.nav-item[data-page="settings"]').click();
  await page.waitForTimeout(300);
  const selects = await page.locator('#settings-wrap select').count();
  const boundSelects = await page.evaluate(() => ['#currency-select', '#week-start-select'].filter(sel => typeof document.querySelector(sel)?.onchange === 'function').length);
  if (selects >= 2 && boundSelects < 2) note('设置项没有真实效果', `发现 ${selects - boundSelects} 个无绑定的下拉框`);
  if (await page.locator('#settings-wrap input[type="file"]').count() === 0) note('设置页缺少数据导入', '只有导出/Excel/重置');

  await page.locator('.nav-item[data-page="ledger"]').click();
  await page.waitForTimeout(300);
  const canEdit = await page.evaluate(() => !!document.querySelector('#txn-list [data-action="edit"], #txn-list .txn-edit'));
  const canDelete = await page.evaluate(() => !!document.querySelector('#txn-list [data-action="delete"], #txn-list .txn-delete'));
  if (!canEdit) note('账单不能修改', '交易列表没有编辑入口');
  if (!canDelete) note('账单不能删除', '交易列表没有删除入口');

  await page.locator('.nav-item[data-page="assets"]').click();
  await page.waitForTimeout(300);
  await page.locator('#asset-add').click(); await page.waitForTimeout(200);
  const html = await page.locator('#account-overlay').innerHTML();
  if (!html.includes('上传') && !html.includes('image')) note('账户图标不支持上传图片', '只有文字图标');
  await page.keyboard.press('Escape');
  await page.locator('#asset-add').click();
  await page.locator('#acc-form-name').fill('审计临时账户');
  await page.locator('#account-save').click();
  await page.locator('.acc-item:has-text("审计临时账户")').first().click();
  await page.waitForTimeout(200);
  const canEditAccount = await page.evaluate(() => !!document.querySelector('#assets-right [data-action="edit-account"]'));
  const canDeleteAccount = await page.evaluate(() => !!document.querySelector('#assets-right [data-action="delete-account"]'));
  if (!canEditAccount) note('账户不能修改名称/类型/图标', '资产详情没有编辑账户入口');
  if (!canDeleteAccount) note('账户不能删除', '资产详情没有删除入口');

  if (consoleErrors.length) note('自动化过程出现控制台错误', consoleErrors.slice(0, 3).join(' | '));
  await page.screenshot({ path: 'work/usability-audit.png', fullPage: true });
  await browser.close();
  console.log(`\n${findings.length} 个待处理问题`);
})();
