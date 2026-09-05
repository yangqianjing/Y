const { chromium } = require('playwright');

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push(false);
    console.log(`FAIL ${name} :: ${String(error.message).split('\n')[0]}`);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const consoleErrors = [];
  page.on('dialog', dialog => dialog.accept());
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  await page.goto('file:///D:/1/Y/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(350);

  await test('01 转账不计入账本收入且与统计一致', async () => {
    const values = await page.evaluate(() => {
      const from = '2024-05-01';
      const to = '2024-05-31';
      return {
        daily: dailyAgg('2024-05').reduce((sum, day) => ({ exp: sum.exp + day.exp, inc: sum.inc + day.inc }), { exp: 0, inc: 0 }),
        range: rangeAgg(from, to),
      };
    });
    if (Math.abs(values.daily.inc - values.range.inc) > 0.001 || Math.abs(values.daily.exp - values.range.exp) > 0.001) {
      throw new Error(JSON.stringify(values));
    }
  });

  await test('02 负数金额保留负号', async () => {
    const text = await page.evaluate(() => money(-123.45));
    if (!text.startsWith('-') || !text.includes('¥123.45')) throw new Error(text);
  });

  await test('03 优惠参与账户余额计算', async () => {
    const effect = await page.evaluate(() => accountTxEffect({ type: 'expense', amount: 45, offer: 1, account: '支付宝' }, '支付宝'));
    if (effect !== -44) throw new Error(String(effect));
  });

  await test('04 删除账户回滚转账另一端余额', async () => {
    const balance = await page.evaluate(async () => {
      const now = Date.now();
      const a = { id: `test-a-${now}`, name: `测试A${now % 10000}`, group: 'fund', color: '#4D7BFE', icon: 'A', balance: 100, sub: '测试' };
      const b = { id: `test-b-${now}`, name: `测试B${now % 10000}`, group: 'fund', color: '#2FBF71', icon: 'B', balance: 10, sub: '测试' };
      state.userAccounts.push(a, b);
      state.txs.push({ id: `test-transfer-${now}`, date: '2024-05-30', time: '12:00:00', type: 'transfer', cat: '转账', sub: '', amount: 10, account: a.name, toAccount: b.name });
      saveTxs();
      saveAccountBalance(a, 100);
      saveAccountBalance(b, 10);
      deleteAccount(b);
      return accountBalance(a);
    });
    if (Math.abs(balance - 110) > 0.001) throw new Error(String(balance));
  });

  await test('05 导入非法交易会被净化', async () => {
    const malicious = {
      txs: [{ id: '<xss>', date: '2024-05-30', time: '<img src=x onerror=alert(1)>', type: 'expense', cat: '餐饮', sub: '三餐', amount: '12.50', account: '<b>账户</b>', offer: 0 }],
      accounts: [],
    };
    await page.locator('.nav-item[data-page="settings"]').click();
    await page.setInputFiles('#import-input', { name: 'malformed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malicious)) });
    await page.waitForTimeout(500);
    const tx = await page.evaluate(() => state.txs[0]);
    if (tx.time !== '00:00:00' || typeof tx.amount !== 'number' || tx.account.includes('<') || /[<>]/.test(tx.id)) throw new Error(JSON.stringify(tx));
  });

  await test('06 损坏 savedCards 不阻断启动', async () => {
    await page.evaluate(() => localStorage.setItem('icostweb_saved', '{bad json'));
    await page.reload();
    await page.waitForTimeout(500);
    if (!(await page.locator('#summary-cards').count())) throw new Error('应用未渲染');
  });

  await test('07 结余柱状图有零轴和负值', async () => {
    const svg = await page.evaluate(() => {
      barChart(document.querySelector('#ledger-bar-chart'), [{ label: '负数', axis: 'x', v: -12 }, { label: '正数', axis: 'y', v: 20 }]);
      return document.querySelector('#ledger-bar-chart').innerHTML;
    });
    if (!svg.includes('stroke="#d4d8e0"') || !svg.includes('#FF8A8A')) throw new Error('缺少零轴或负值矩形');
  });

  await test('08 图表最后一天使用真实日期', async () => {
    await page.evaluate(() => { state.month = '2024-04'; renderLedgerCharts(); });
    const chart = await page.locator('#ledger-bar-chart').textContent();
    if (!chart.includes('4-30')) throw new Error(chart);
  });

  await test('09 搜索退款和手续费真实汇总', async () => {
    await page.evaluate(() => { state.searchQuery = '退款'; renderSearch(); });
    const totals = await page.locator('#search-totals').textContent();
    if (totals.includes('退款 ¥0.00')) throw new Error(totals);
  });

  await test('10 统计按钮文案与模式同步', async () => {
    await page.evaluate(() => { state.statsMode = 'month'; renderStats(); });
    if ((await page.locator('#stats-mode-btn').textContent()) !== '按月统计') throw new Error('按钮未同步');
  });

  await test('11 周统计回到当前账本月份', async () => {
    const range = await page.evaluate(() => {
      state.statsMode = 'week';
      state.statsRange = currentMonthWeekRange();
      renderStats();
      return state.statsRange;
    });
    if (!range[0].startsWith('2024-04-') || !range[1].startsWith('2024-04-')) throw new Error(range.join(' '));
  });

  await test('12 报销入账使用独立分类', async () => {
    const category = await page.evaluate(() => {
      let row = state.reimbursements.find(item => item.status === 'done');
      if (!row) {
        row = { id: 'fix16-reimb', date: '2024-05-30', amount: 66, note: '测试报销', status: 'done', accountId: allAccounts()[0].id, txId: '' };
        state.reimbursements.push(row);
      }
      if (row) setReimbursementStatus(row.id, 'in');
      return state.txs.find(tx => row.txId === tx.id)?.cat;
    });
    if (category !== '报销入账') throw new Error(String(category));
  });

  await test('13 320px 页面不横向溢出', async () => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.locator('.nav-item[data-page="ledger"]').click();
    await page.waitForTimeout(300);
    const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
    if (widths.doc > widths.win + 1) throw new Error(JSON.stringify(widths));
  });

  await test('14 关键控件具备可访问名称', async () => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.locator('.nav-item[data-page="ledger"]').click();
    await page.evaluate(() => {
      state.month = '2024-05';
      state.selectedDay = '2024-05-30';
      renderLedger();
    });
    await page.waitForTimeout(300);
    const labels = await page.evaluate(() => ({
      fab: document.querySelector('#fab-add')?.getAttribute('aria-label'),
      edit: !!document.querySelector('.txn-actions [aria-label^="编辑"]'),
      del: !!document.querySelector('.txn-actions [aria-label^="删除"]'),
    }));
    if (!labels.fab || !labels.edit || !labels.del) throw new Error(JSON.stringify(labels));
  });

  await test('15 Electron 窗口启用沙盒', async () => {
    const source = await require('fs').promises.readFile('D:/1/Y/main.js', 'utf8');
    if (!source.includes('sandbox: true')) throw new Error('sandbox 未启用');
  });

  await test('16 CSP 已声明', async () => {
    const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
    if (!csp.includes("script-src 'self'")) throw new Error(csp);
  });

  if (consoleErrors.length) {
    results.push(false);
    console.log(`FAIL 控制台错误 :: ${consoleErrors.slice(0, 3).join(' | ')}`);
  } else {
    results.push(true);
    console.log('PASS 控制台无错误');
  }

  console.log(`${results.filter(Boolean).length}/${results.length} 通过`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
