const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('file:///D:/1/Y/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  for (const name of ['ledger', 'assets', 'savings', 'stats', 'settings']) {
    await page.locator(`.nav-item[data-page="${name}"]`).click();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
      body: document.body.scrollWidth,
    }));
    console.log(name, JSON.stringify(overflow));
    await page.screenshot({ path: `work/mobile-${name}.png`, fullPage: true });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
