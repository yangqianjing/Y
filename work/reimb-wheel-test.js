const { chromium } = require('playwright');
const results = [];
let consoleErrors = [];

async function test(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log('PASS ' + name);
  } catch (e) {
    results.push(false);
    console.log('FAIL ' + name + ' :: ' + String(e.message).split('\n')[0]);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.setDefaultTimeout(7000);
  page.on('dialog', dialog => dialog.accept());
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(e.message));
  await page.goto('file:///D:/1/Y/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(350);
  const now = new Date();
  const expectedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  await test('R1 报销登记写入待报销', async () => {
    await page.locator('.nav-item[data-page="stats"]').click();
    await page.locator('#reimb-date').fill('2024-05-28');
    await page.locator('#reimb-amount').fill('66');
    await page.locator('#reimb-note').fill('交通报销');
    await page.locator('#reimb-account').selectOption({ label: '支付宝' });
    await page.locator('#reimb-add-btn').click();
    await page.waitForTimeout(250);
    const rows = await page.evaluate(() => state.reimbursements);
    const row = rows.find(r => r.note === '交通报销');
    if (!row || row.status !== 'pending' || Number(row.amount) !== 66) throw new Error(JSON.stringify(row));
    if (!(await page.locator('#reimb-tiles').textContent()).includes('待报销')) throw new Error('报销卡片未渲染');
  });

  await test('R2 报销标记已报销', async () => {
    await page.locator('.reimb-row:has-text("交通报销") [data-reimb-action="done"]').click();
    await page.waitForTimeout(250);
    const row = await page.evaluate(() => state.reimbursements.find(r => r.note === '交通报销'));
    if (row.status !== 'done') throw new Error(row.status);
  });

  await test('R3 报销入账生成收入并同步余额', async () => {
    const before = await page.evaluate(() => { const a = allAccounts().find(x => x.name === '支付宝'); return accountBalance(a); });
    await page.locator('.reimb-row:has-text("交通报销") [data-reimb-action="in"]').click();
    await page.waitForTimeout(350);
    const stateNow = await page.evaluate(() => ({
      row: state.reimbursements.find(r => r.note === '交通报销'),
      tx: state.txs.find(t => t.note === '报销入账：交通报销'),
      balance: accountBalance(allAccounts().find(a => a.name === '支付宝')),
    }));
    if (stateNow.row.status !== 'in') throw new Error('状态未入账');
    if (!stateNow.tx || Number(stateNow.tx.amount) !== 66 || stateNow.tx.type !== 'income') throw new Error(JSON.stringify(stateNow.tx));
    if (Math.abs(stateNow.balance - before - 66) > 0.001) throw new Error(`${before} -> ${stateNow.balance}`);
  });

  await test('R4 删除报销回收入账账单和余额', async () => {
    const before = await page.evaluate(() => accountBalance(allAccounts().find(a => a.name === '支付宝')));
    await page.locator('.reimb-row:has-text("交通报销") [data-reimb-action="delete"]').click();
    await page.waitForTimeout(350);
    const stateNow = await page.evaluate(() => ({
      rows: state.reimbursements,
      tx: state.txs.find(t => t.note === '报销入账：交通报销'),
      balance: accountBalance(allAccounts().find(a => a.name === '支付宝')),
    }));
    if (stateNow.rows.some(r => r.note === '交通报销')) throw new Error('记录未删除');
    if (stateNow.tx) throw new Error('关联账单未删除');
    if (Math.abs(stateNow.balance - before + 66) > 0.001) throw new Error(`${before} -> ${stateNow.balance}`);
  });

  await test('W1 时间滚轮可点击选择', async () => {
    await page.locator('#fab-add').dispatchEvent('click');
    await page.locator('#pick-datetime').dispatchEvent('click');
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => ({ h:tp.h, mi:tp.mi, s:tp.s }));
    for (let i = 0; i < 3; i++) {
      await page.evaluate(col => {
        const item = col.querySelector('.wheel-item.cur');
        (item.nextElementSibling || item.previousElementSibling).dispatchEvent(new MouseEvent('click', { bubbles:true }));
      }, await page.locator('#wheel-cols .wheel-col').nth(i).elementHandle());
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => ({ h:tp.h, mi:tp.mi, s:tp.s }));
    if (after.h === before.h && after.mi === before.mi && after.s === before.s) throw new Error('点击未改变滚轮');
    await page.locator('#time-confirm').dispatchEvent('click');
    await page.waitForTimeout(250);
    const chip = await page.locator('#pick-datetime').textContent();
    const expected = await page.evaluate(() => `${pad2(tp.y)}/${pad2(tp.mo)}/${pad2(tp.d)} ${pad2(tp.h)}:${pad2(tp.mi)}:${pad2(tp.s)}`);
    if (!chip.includes(expected)) throw new Error(chip + ' != ' + expected);
  });

  if (consoleErrors.length) throw new Error(consoleErrors.join(' | '));
  console.log(`${results.filter(Boolean).length}/${results.length} 通过${consoleErrors.length ? '，控制台异常 ' + consoleErrors.length : '，无控制台错误'}`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
