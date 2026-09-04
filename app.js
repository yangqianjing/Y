/* iCost Web — 应用逻辑 */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => (Math.abs(n)).toLocaleString('zh-CN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const CURRENCIES = { CNY:{ symbol:'¥', rate:1 }, USD:{ symbol:'$', rate:1/7.2 } };
const money = n => {
  const currency = CURRENCIES[state.currency] || CURRENCIES.CNY;
  return currency.symbol + fmt((Number(n) || 0) * currency.rate);
};
const signedMoney = (n, type) => (type === 'expense' ? '-' : type === 'income' ? '+' : '') + money(n);

/* ---------- 状态 ---------- */
const LS_KEY = 'icostweb_tx_v1';
const LS_BUDGET = 'icostweb_budget';
const LS_SAVED = 'icostweb_saved';
const LS_SUBS = 'icostweb_subs_v1';
const LS_SUB_ICONS = 'icostweb_sub_icons_v1';
const LS_ACCOUNTS = 'icostweb_accounts_v1';
const LS_BALANCES = 'icostweb_balances_v1';
const LS_SETTINGS = 'icostweb_settings_v1';
const LS_SAVINGS = 'icostweb_savings_v1';
const LS_REIMB = 'icostweb_reimbursements_v1';
const FLOW = [ ['还款',0],['收款',0],['转账',1000],['充值',50],['借入',0],['借出',1000] ];
const HOLIDAYS = { '2024-05-01':'劳动节', '2024-06-01':'儿童节' };

const state = {
  page: 'ledger',
  month: '2024-05',
  selectedDay: '2024-05-30',
  ledgerTab: 'expense',
  drillCategory: '',
  networthTab: 'net',
  statsMode: 'week',
  statsRange: ['2024-05-26', '2024-06-01'],
  statsLineTab: 'income',
  assetsLineTab: 'net',
  incomeDonutTab: 'income',
  selectedAccountId: 'citic',
  savingsMode: 'flex',
  selectedPlanId: 'plan2',
  txs: [],
  savedCards: new Set(),
  budget: BUDGET,
  userSubs: {},
  subIcons: {},
  userAccounts: [],
  userBalances: {},
  searchOpen: false,
  searchQuery: '',
  sortDesc: false,
  currency: 'CNY',
  weekStart: 0,
  editingTxId: '',
  filterPanel: '',
  filters: { from:'', to:'', min:'', max:'', types:[], accounts:[] },
  savingsDeposits: {},
  accountEditingId: '',
  reimbursements: [],
};

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    state.txs = raw ? JSON.parse(raw) : [...TX_SEED];
  } catch { state.txs = [...TX_SEED]; }
  const b = localStorage.getItem(LS_BUDGET);
  if (b) state.budget = +b;
  const s = localStorage.getItem(LS_SAVED);
  state.savedCards = new Set(s ? JSON.parse(s) : PLANS.find(p=>p.id==='plan2').cards.map(c=>c.id));
  try {
    const u = localStorage.getItem(LS_SUBS);
    state.userSubs = u ? JSON.parse(u) : {};
  } catch { state.userSubs = {}; }
  try {
    const s = localStorage.getItem(LS_SUB_ICONS);
    state.subIcons = s ? JSON.parse(s) : {};
  } catch { state.subIcons = {}; }
  try {
    const a = localStorage.getItem(LS_ACCOUNTS);
    state.userAccounts = a ? JSON.parse(a) : [];
  } catch { state.userAccounts = []; }
  try {
    const b = localStorage.getItem(LS_BALANCES);
    state.userBalances = b ? JSON.parse(b) : {};
  } catch { state.userBalances = {}; }
  try {
    const setting = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
    state.currency = CURRENCIES[setting.currency] ? setting.currency : 'CNY';
    state.weekStart = [0,1].includes(setting.weekStart) ? setting.weekStart : 0;
  } catch { state.currency = 'CNY'; state.weekStart = 0; }
  try {
    const saving = localStorage.getItem(LS_SAVINGS);
    state.savingsDeposits = saving ? JSON.parse(saving) : {};
  } catch { state.savingsDeposits = {}; }
  try {
    const reimb = localStorage.getItem(LS_REIMB);
    state.reimbursements = reimb ? JSON.parse(reimb) : [{ id:'r-seed', date:'2024-05-28', amount:108, note:'客户差旅', status:'pending' }];
  } catch { state.reimbursements = []; }
}
function saveTxs() { localStorage.setItem(LS_KEY, JSON.stringify(state.txs)); }
function saveSettings() { localStorage.setItem(LS_SETTINGS, JSON.stringify({ currency:state.currency, weekStart:state.weekStart })); }
function saveSavings() { localStorage.setItem(LS_SAVINGS, JSON.stringify(state.savingsDeposits)); }
function saveReimbursements() { localStorage.setItem(LS_REIMB, JSON.stringify(state.reimbursements)); }
function reimbursementTotals() {
  const sum = status => state.reimbursements.filter(r=>r.status===status).reduce((s,r)=>s+Number(r.amount||0),0);
  return { pending:sum('pending'), done:sum('done'), in:sum('in') };
}
function renderReimbManager(totals) {
  const rows = state.reimbursements.map(r => `
    <div class="reimb-row">
      <div class="reimb-main"><b>${money(r.amount)}</b><span>${esc(r.note || '未填写事由')} · ${r.date || '未选日期'}</span></div>
      <div class="reimb-ops">
        <span class="reimb-status ${r.status}">${r.status === 'pending' ? '待报销' : r.status === 'done' ? '已报销' : '已入账'}</span>
        ${r.status === 'pending' ? `<button class="reimb-btn" data-reimb-action="done" data-id="${r.id}">已报销</button>` : ''}
        ${r.status === 'done' ? `<button class="reimb-btn primary" data-reimb-action="in" data-id="${r.id}">入账</button>` : ''}
        <button class="reimb-btn danger" data-reimb-action="delete" data-id="${r.id}">删除</button>
      </div>
    </div>`).join('');
  return `
    <div class="reimb-manager">
      <div class="reimb-form">
        <input type="date" id="reimb-date" value="${localISO(new Date())}">
        <input type="number" id="reimb-amount" min="0" step="0.01" placeholder="金额">
        <input type="text" id="reimb-note" maxlength="30" placeholder="报销事由">
        <select id="reimb-account">${allAccounts().map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
        <button class="reimb-btn primary" id="reimb-add-btn">登记</button>
      </div>
      <div class="reimb-list">${rows || '<div class="reimb-empty">暂无报销记录</div>'}</div>
    </div>`;
}
function addReimbursement() {
  const amount = parseFloat($('#reimb-amount').value);
  const date = $('#reimb-date').value;
  const note = $('#reimb-note').value.trim();
  if (!date) { toast('请选择报销日期'); return; }
  if (!amount || amount <= 0) { toast('请输入有效金额'); return; }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001) { toast('金额最多保留两位小数'); return; }
  state.reimbursements.unshift({ id:'r' + Date.now() + '-' + Math.random().toString(36).slice(2,7), date, amount, note, status:'pending', accountId:$('#reimb-account').value });
  saveReimbursements();
  $('#reimb-amount').value = ''; $('#reimb-note').value = '';
  renderStats();
  toast('报销已登记 ✓');
}
function setReimbursementStatus(id, status) {
  const row = state.reimbursements.find(r => r.id === id);
  if (!row || row.status === status) return;
  if (status === 'in') {
    const account = allAccounts().find(a => a.id === (row.accountId || allAccounts()[0]?.id));
    if (!account) { toast('请先添加资金账户'); return; }
    const txId = 'r' + Date.now() + '-' + Math.random().toString(36).slice(2,7);
    state.txs.push({ id:txId, date:row.date, time:pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes()) + ':00', type:'income', cat:'副业', sub:'报销', amount:Number(row.amount), note:'报销入账：' + (row.note || '未填写事由'), account:account.name });
    row.txId = txId;
    row.accountId = account.id;
    saveAccountBalance(account, accountBalance(account) + Number(row.amount));
    saveTxs();
  }
  row.status = status;
  saveReimbursements();
  renderStats();
  toast(status === 'in' ? '报销已入账 ✓' : '已标记报销 ✓');
}
function deleteReimbursement(id) {
  const row = state.reimbursements.find(r => r.id === id);
  if (!row) return;
  if (!confirm('确定删除这条报销记录吗？已入账的账单也会同步删除。')) return;
  const linkedTx = row.txId ? state.txs.find(t => t.id === row.txId) : null;
  if (linkedTx) {
    allAccounts().forEach(account => saveAccountBalance(account, accountBalance(account) - accountTxEffect(linkedTx, account.name)));
    state.txs = state.txs.filter(t => t.id !== linkedTx.id);
    saveTxs();
  }
  state.reimbursements = state.reimbursements.filter(r => r.id !== id);
  saveReimbursements();
  renderStats();
  toast('报销已删除 ✓');
}

/* ---------- 工具 ---------- */
const dayKey = d => d; // '2024-05-30'
const monthOf = d => d.slice(0,7);
const dayNum = d => +d.slice(8,10);
const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
const weekdayOf = d => weekdays[new Date(d + 'T00:00:00').getDay()];
const orderedWeekdays = () => [...weekdays.slice(state.weekStart), ...weekdays.slice(0,state.weekStart)];
function localISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const pad2 = n => String(n).padStart(2, '0');
function daysInMonth(m) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); }
function fmtMonthTitle(m) { const [y, mo] = m.split('-'); return `${y}年${+mo}月`; }
function addMonth(m, delta) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function addDays(d, delta) { const date = new Date(d + 'T00:00:00'); date.setDate(date.getDate() + delta); return localISO(date); }
function txNet(t) { return t.amount - (t.offer || 0); }
function catOf(name) { return CATS[name] || { icon:'🧾', color:'#A0A6B1', subs:[] }; }
function allAccounts() { return [...ACCOUNTS, ...state.userAccounts]; }
function accOf(id) { return allAccounts().find(a => a.id === id) || { id, name:id, color:'#A0A6B1', icon:'💳' }; }
function accountBalance(account) {
  if (state.userBalances[account.id] !== undefined) return state.userBalances[account.id];
  return account.balance !== undefined ? account.balance : (ASSET_AMOUNTS[account.id] || 0);
}
function accountTxEffect(tx, accountName) {
  if (tx.type === 'expense' && tx.account === accountName) return -Number(tx.amount || 0);
  if (tx.type === 'income' && tx.account === accountName) return Number(tx.amount || 0);
  if (tx.type === 'transfer') {
    if (tx.account === accountName) return -Number(tx.amount || 0);
    if (tx.toAccount === accountName) return Number(tx.amount || 0);
  }
  return 0;
}
function accountBalanceAt(account, date = '') {
  if (!date) return accountBalance(account);
  let balance = accountBalance(account);
  state.txs.forEach(tx => { if (tx.date > date) balance -= accountTxEffect(tx, account.name); });
  return balance;
}
function assetSummaryAt(date = '') {
  const balances = allAccounts().map(a => ({ group:a.group, value:accountBalanceAt(a, date) }));
  const total = balances.filter(b => b.group !== 'credit').reduce((s,b)=>s+b.value,0);
  const debt = balances.filter(b => b.group === 'credit').reduce((s,b)=>s+Math.abs(b.value),0);
  return { total, debt, net: total - debt, fund: balances.filter(b=>b.group==='fund').reduce((s,b)=>s+b.value,0), recharge: balances.filter(b=>b.group==='recharge').reduce((s,b)=>s+b.value,0) };
}
function accountIconHTML(account, style = '') {
  if (account.iconImage) return `<img class="icon-img" src="${account.iconImage}" alt="${esc(account.name || '')}" style="${style}">`;
  return esc(account.icon || '💳');
}
function saveAccountBalance(account, value) {
  const amount = Math.round(value * 100) / 100;
  if (ACCOUNTS.some(a => a.id === account.id)) state.userBalances[account.id] = amount;
  else {
    account.balance = amount;
    localStorage.setItem(LS_ACCOUNTS, JSON.stringify(state.userAccounts));
  }
  localStorage.setItem(LS_BALANCES, JSON.stringify(state.userBalances));
}
function assetSummary() {
  return assetSummaryAt();
}
function subsOf(cat) {
  const built = (CATS[cat] && CATS[cat].subs) || [];
  const user = state.userSubs[cat] || [];
  return [...new Set([...built, ...user])];
}
function subIconKey(cat, sub) { return `${cat}||${sub}`; }
function subIconOf(cat, sub) {
  if (!cat || !sub) return null;
  return state.subIcons[subIconKey(cat, sub)] || null;
}
function iconMarkup(cat, sub, fallbackIcon) {
  const custom = subIconOf(cat, sub);
  if (custom && custom.image) return `<img class="icon-img" src="${custom.image}" alt="${esc(sub || cat || '')}">`;
  return esc(custom && custom.icon ? custom.icon : fallbackIcon);
}
function addUserSub(cat, name, icon = '', image = '') {
  const n = (name || '').trim();
  if (!n) { toast('请输入子分类名称'); return; }
  if (subsOf(cat).some(s => s === n)) {
    if (icon || image) {
      state.subIcons[subIconKey(cat, n)] = { icon, image };
      localStorage.setItem(LS_SUB_ICONS, JSON.stringify(state.subIcons));
    }
    add.newSubIcon = ''; add.newSubImage = '';
    toast('该子分类已存在');
    add.sub = n; add.creatingSub = false; renderAdd();
    return;
  }
  if (icon || image) {
    state.subIcons[subIconKey(cat, n)] = { icon, image };
    localStorage.setItem(LS_SUB_ICONS, JSON.stringify(state.subIcons));
  }
  (state.userSubs[cat] = state.userSubs[cat] || []).push(n);
  localStorage.setItem(LS_SUBS, JSON.stringify(state.userSubs));
  add.sub = n; add.creatingSub = false;
  add.newSubIcon = ''; add.newSubImage = '';
  renderAdd();
  toast(`已创建子分类「${n}」`);
}
function readSubIconImage(file, callback) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
  if (file.size > 5 * 1024 * 1024) { toast('图片不能超过 5MB'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const max = 128;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (file.type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); }
      context.drawImage(image, 0, 0, width, height);
      callback(canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.86));
    };
    image.onerror = () => toast('图片读取失败');
    image.src = reader.result;
  };
  reader.onerror = () => toast('图片读取失败');
  reader.readAsDataURL(file);
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- SVG 图表 ---------- */
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}

function barChart(el, data, { color = '#FF5D5D', avg = null, yFmt = v => v } = {}) {
  el.innerHTML = '';
  const W = 640, H = 190, padL = 10, padR = 10, padT = 12, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(...data.map(d => d.v), avg || 0) * 1.15 || 1;
  const svg = sv('svg', { viewBox:`0 0 ${W} ${H}`, style:'width:100%;height:100%' }, el);
  if (avg) {
    const y = padT + ih - (avg / max) * ih;
    sv('line', { x1:padL, x2:W-padR, y1:y, y2:y, stroke:'#9aa0ab', 'stroke-width':1, 'stroke-dasharray':'4 4' }, svg);
  }
  const n = data.length;
  const step = iw / n, bw = Math.max(2, step * 0.55);
  data.forEach((d, i) => {
    const h = (d.v / max) * ih;
    const x = padL + i * step + (step - bw) / 2;
    const y = padT + ih - h;
    const r = sv('rect', { x, y, width:bw, height:Math.max(h, d.v>0?2:0), rx:Math.min(2,bw/2), fill:d.v>0?color:'#e3e5ea' }, svg);
    const t = document.createElementNS(NS,'title');
    t.textContent = `${d.label}  ${yFmt(d.v)}`;
    r.appendChild(t);
  });
  [0, Math.floor(n/2), n-1].forEach(i => {
    sv('text', { x: padL + i*step + step/2, y: H-6, 'text-anchor':'middle', 'font-size':11, fill:'#9aa0ab' }, svg)
      .textContent = data[i].axis;
  });
}

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let p = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0,y0] = pts[Math.max(0,i-1)], [x1,y1] = pts[i], [x2,y2] = pts[i+1], [x3,y3] = pts[Math.min(pts.length-1,i+2)];
    const c1x = x1 + (x2-x0)/6, c1y = y1 + (y2-y0)/6;
    const c2x = x2 - (x3-x1)/6, c2y = y2 - (y3-y1)/6;
    p += ` C ${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
  }
  return p;
}

function lineChart(el, data, { color = '#2FBF71', fill = true, yFmt = v => v, dotLast = true, dashedTail = false } = {}) {
  el.innerHTML = '';
  const W = 640, H = 190, padL = 40, padR = 16, padT = 12, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const vals = data.map(d => d.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = (max - min) || 1;
  const yMin = min - span * 0.15, yMax = max + span * 0.15;
  const svg = sv('svg', { viewBox:`0 0 ${W} ${H}`, style:'width:100%;height:100%' }, el);
  const defs = sv('defs', {}, svg);
  const grad = sv('linearGradient', { id:'g' + Math.random().toString(36).slice(2,8), x1:0, y1:0, x2:0, y2:1 }, defs);
  sv('stop', { offset:'0%', 'stop-color':color, 'stop-opacity':.28 }, grad);
  sv('stop', { offset:'100%', 'stop-color':color, 'stop-opacity':.02 }, grad);
  const n = data.length;
  const pts = data.map((d, i) => [
    padL + (n === 1 ? iw/2 : (i / (n - 1)) * iw),
    padT + ih - ((d.v - yMin) / (yMax - yMin)) * ih
  ]);
  if (fill) {
    const area = smoothPath(pts) + ` L ${pts[n-1][0]},${padT + ih} L ${pts[0][0]},${padT + ih} Z`;
    sv('path', { d:area, fill:`url(#${grad.id})`, stroke:'none' }, svg);
  }
  let lineD = smoothPath(pts);
  if (dashedTail) {
    const [lx, ly] = pts[n-1];
    lineD += ` L ${lx + 26},${ly}`;
    sv('line', { x1:lx, x2:lx+26, y1:ly, y2:ly, stroke:color, 'stroke-width':2, 'stroke-dasharray':'4 4' }, svg);
  }
  sv('path', { d:lineD, fill:'none', stroke:color, 'stroke-width':2, 'stroke-linecap':'round' }, svg);
  if (dotLast) {
    const [lx, ly] = pts[n-1];
    sv('circle', { cx:lx, cy:ly, r:4, fill:'#fff', stroke:color, 'stroke-width':2 }, svg);
  }
  [0, Math.floor(n/2), n-1].forEach(i => {
    sv('text', { x: pts[i][0], y: H-6, 'text-anchor':'middle', 'font-size':11, fill:'#9aa0ab' }, svg).textContent = data[i].axis;
  });
  [0, .5, 1].forEach(f => {
    const v = yMin + (yMax - yMin) * (1 - f);
    sv('text', { x: padL - 6, y: padT + ih * f + 4, 'text-anchor':'end', 'font-size':10, fill:'#9aa0ab' }, svg).textContent = yFmt(v);
  });
}

function donutChart(el, segs, centerTitle, centerVal) {
  el.innerHTML = '';
  const size = 170, c = size/2, r = 60, sw = 24;
  const total = segs.reduce((s, x) => s + x.amount, 0) || 1;
  const svg = sv('svg', { viewBox:`0 0 ${size} ${size}`, style:`width:${size}px;height:${size}px` }, el);
  let acc = 0;
  const circ = 2 * Math.PI * r;
  segs.forEach(s => {
    const frac = s.amount / total;
    const dash = Math.max(frac * circ - 2, 0);
    const circle = sv('circle', {
      cx:c, cy:c, r, fill:'none', stroke:s.color, 'stroke-width':sw,
      'stroke-dasharray':`${dash} ${circ - dash}`,
      'stroke-dashoffset':-acc * circ,
      transform:`rotate(-90 ${c} ${c})`,
      'stroke-linecap':'butt'
    }, svg);
    const t = document.createElementNS(NS, 'title');
    t.textContent = `${s.name}  ${money(s.amount)} (${(frac*100).toFixed(1)}%)`;
    circle.appendChild(t);
    acc += frac;
  });
  sv('text', { x:c, y:c-6, 'text-anchor':'middle', 'font-size':10, fill:'#9aa0ab' }, svg).textContent = centerTitle;
  sv('text', { x:c, y:c+14, 'text-anchor':'middle', 'font-size':15, 'font-weight':700, fill:'currentColor' }, svg).textContent = centerVal;
}

/* ---------- 聚合 ---------- */
function txsInMonth(m) { return state.txs.filter(t => monthOf(t.date) === m); }
function dailyAgg(m) {
  const n = daysInMonth(m);
  const arr = Array.from({ length:n }, (_, i) => ({ day:i+1, exp:0, inc:0 }));
  txsInMonth(m).forEach(t => {
    const i = dayNum(t.date) - 1;
    if (arr[i]) { if (t.type === 'expense') arr[i].exp += txNet(t); else arr[i].inc += txNet(t); }
  });
  return arr;
}
function rangeAgg(from, to) {
  const txs = state.txs.filter(t => t.date >= from && t.date <= to);
  const exp = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+txNet(t),0);
  const inc = txs.filter(t=>t.type==='income').reduce((s,t)=>s+txNet(t),0);
  const offers = txs.reduce((s,t)=>s+(t.offer||0),0);
  return { txs, exp, inc, bal: inc - exp, offers };
}
function catAgg(txs, type) {
  const map = {};
  txs.filter(t=>t.type===type).forEach(t => {
    map[t.cat] = map[t.cat] || { name:t.cat, amount:0, count:0 };
    map[t.cat].amount += txNet(t);
    map[t.cat].count++;
  });
  return Object.values(map).sort((a,b)=>b.amount-a.amount);
}
function subAgg(txs, type, category) {
  const map = {};
  txs.filter(t => t.type === type && t.cat === category).forEach(t => {
    const name = t.sub || category;
    map[name] = map[name] || { name, amount:0, count:0 };
    map[name].amount += txNet(t);
    map[name].count++;
  });
  return Object.values(map).sort((a,b) => b.amount-a.amount);
}

/* ---------- 渲染：账本页 ---------- */
function renderSummary() {
  const agg = dailyAgg(state.month);
  const exp = agg.reduce((s,d)=>s+d.exp,0);
  const inc = agg.reduce((s,d)=>s+d.inc,0);
  const dim = daysInMonth(state.month);
  const remainBudget = state.budget - exp;
  const cards = [
    { dot:'#FF5D5D', label:'总支出', amount:exp, sub:[['总收入', money(inc)],['结余', money(inc-exp)]] },
    { dot:'#34C77B', label:'剩余预算', amount:Math.max(remainBudget,0), sub:[['总预算', money(state.budget)],['剩余日均', money(Math.max(remainBudget,0)/dim)]], arrow:true },
    { dot:'#4D9FFF', label:'待报销', amount:reimbursementTotals().pending, sub:[['已报销', money(reimbursementTotals().done)],['报销入账', money(reimbursementTotals().in)]], arrow:true },
    { dot:'#FFA53C', label:'净资产', amount:assetSummary().net, sub:[['总资产', money(assetSummary().total)],['总负债', money(assetSummary().debt)]], arrow:true },
  ];
  $('#summary-cards').innerHTML = cards.map(c => `
    <div class="sum-card">
      <div class="s-head"><span class="s-dot" style="background:${c.dot}"></span>${c.label}${c.arrow?'<span class="s-arrow">›</span>':''}</div>
      <div class="s-amount"><span class="yen">¥</span>${fmt(c.amount)}</div>
      <div class="s-sub">${c.sub.map(([k,v])=>`<span>${k} <span class="v">${v}</span></span>`).join('')}</div>
    </div>`).join('');
}

function renderCalendar() {
  $('#cal-title').textContent = fmtMonthTitle(state.month);
  const grid = $('#cal-grid');
  grid.innerHTML = '';
  $('.cal-week').innerHTML = orderedWeekdays().map(d => `<span>${d}</span>`).join('');
  const first = (new Date(state.month + '-01T00:00:00').getDay() - state.weekStart + 7) % 7;
  const agg = dailyAgg(state.month);
  for (let i = 0; i < first; i++) {
    const c = document.createElement('div');
    c.className = 'cal-cell blank';
    grid.appendChild(c);
  }
  agg.forEach(d => {
    const key = `${state.month}-${String(d.day).padStart(2,'0')}`;
    const c = document.createElement('div');
    c.className = 'cal-cell' + (key === state.selectedDay ? ' sel' : '');
    c.innerHTML = `<div class="d">${d.day}</div>
      <div class="lunar">${HOLIDAYS[key] || ''}</div>
      ${d.exp ? `<div class="exp">-${fmt(d.exp)}</div>` : '<div class="exp"></div>'}
      ${d.inc ? `<div class="inc">+${fmt(d.inc)}</div>` : '<div class="inc"></div>'}`;
    c.onclick = () => {
      state.selectedDay = state.selectedDay === key ? null : key;
      renderCalendar(); renderTxnList();
    };
    grid.appendChild(c);
  });
}

function txnItemHTML(t) {
  if (t.type === 'transfer') {
    return `
  <div class="txn-item" data-id="${esc(t.id)}">
    <div class="txn-ico" style="background:#4D7BFE">💸</div>
    <div class="txn-mid">
      <div class="txn-name">转账 · ${esc(t.account)} → ${esc(t.toAccount)}</div>
      <div class="txn-time">${t.time}</div>
    </div>
    <div class="txn-right">
      <div class="txn-amt transfer">${money(t.amount)}</div>
      <div class="txn-acc">转入 ${esc(t.toAccount)}</div>
      <div class="txn-actions"><button data-action="edit" title="编辑">✏️</button><button data-action="delete" title="删除">🗑️</button></div>
    </div>
  </div>`;
  }
  const c = catOf(t.cat);
  const sub = t.sub ? ` · ${t.sub}` : '';
  const tags = [];
  if (t.offer) tags.push(`<span class="txn-tag">${t.type==='expense'?'优惠':'退款'} ${fmt(t.offer)}</span>`);
  return `
  <div class="txn-item" data-id="${esc(t.id)}">
    <div class="txn-ico" style="background:${c.color}">${iconMarkup(t.cat, t.sub, c.icon)}</div>
    <div class="txn-mid">
      <div class="txn-name">${esc(t.cat)}${esc(sub)}</div>
      <div class="txn-time">${t.time}</div>
      ${tags.length ? `<div class="txn-tags">${tags.join('')}</div>` : ''}
      ${t.note ? `<div class="txn-note">📍 ${esc(t.note)}</div>` : ''}
    </div>
    <div class="txn-right">
      <div class="txn-amt ${t.type}">${signedMoney(txNet(t), t.type)}</div>
      <div class="txn-acc">${esc(t.account)}</div>
      <div class="txn-actions"><button data-action="edit" title="编辑">✏️</button><button data-action="delete" title="删除">🗑️</button></div>
    </div>
  </div>`;
}

function bindTxActions(root) {
  $$(root + ' .txn-actions button').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const id = button.closest('.txn-item').dataset.id;
      if (button.dataset.action === 'edit') openEditTx(id);
      else deleteTx(id);
    };
  });
}

function openEditTx(id) {
  const tx = state.txs.find(t => t.id === id);
  if (!tx) return;
  state.editingTxId = id;
  add.type = tx.type;
  add.amount = String(tx.amount);
  add.note = tx.note || '';
  add.offer = tx.offer ? String(tx.offer) : '';
  add.account = tx.account;
  add.toAccount = tx.toAccount || add.toAccount;
  add.cat = tx.cat || (tx.type === 'expense' ? '餐饮' : '副业');
  add.sub = tx.sub || '';
  add.dt = `${tx.date}T${tx.time.length === 5 ? tx.time + ':00' : tx.time}`;
  add.creatingSub = false;
  $('#search-overlay').classList.add('hidden');
  renderAdd();
  $('#add-overlay').classList.remove('hidden');
}

function deleteTx(id) {
  const tx = state.txs.find(t => t.id === id);
  if (!tx) return;
  if (!confirm('确定删除这笔账单吗？账户余额会同步回退。')) return;
  allAccounts().forEach(account => saveAccountBalance(account, accountBalance(account) - accountTxEffect(tx, account.name)));
  state.txs = state.txs.filter(t => t.id !== id);
  saveTxs();
  toast('账单已删除 ✓');
  refreshPage();
  if (!$('#search-overlay').classList.contains('hidden')) renderSearch();
}

function renderTxnList() {
  const el = $('#txn-list');
  let txs = txsInMonth(state.month);
  if (state.selectedDay) txs = txs.filter(t => t.date === state.selectedDay);
  const groups = {};
  txs.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
  const days = Object.keys(groups).sort().reverse();
  if (!days.length) { el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text2);font-size:12px">本月暂无账单</div>'; return; }
  el.innerHTML = days.map(day => {
    const list = groups[day];
    const e = list.filter(t=>t.type==='expense').reduce((s,t)=>s+txNet(t),0);
    const i = list.filter(t=>t.type==='income').reduce((s,t)=>s+txNet(t),0);
    return `<div class="day-group">
      <div class="day-head"><b>${day.slice(5).replace('-','/')}</b> ${weekdayOf(day)}<span class="sp"></span>支出: ${money(e)} 收入: ${money(i)}<span class="chev">⌄</span></div>
      ${list.map(txnItemHTML).join('')}
    </div>`;
  }).join('');
  bindTxActions('#txn-list');
}

function renderLedgerCharts() {
  const agg = dailyAgg(state.month);
  const mode = state.ledgerTab;
  const data = agg.map(d => ({ v: mode==='expense'?d.exp:mode==='income'?d.inc:d.inc-d.exp, day:d.day, label:`${+state.month.slice(5)}月${d.day}日`, axis: d.day===1?`${state.month.slice(5)}-1`:d.day===16?`${state.month.slice(5)}-16`:d.day===agg.length?`${state.month.slice(5)}-31`:'' }));
  const vals = data.map(d=>d.v);
  const avg = vals.reduce((s,v)=>s+v,0)/vals.length;
  const peak = data.reduce((a,b)=>b.v>a.v?b:a, data[0]);
  $('#expense-peak').textContent = vals.some(v => v !== 0) ? `${+state.month.slice(5)}月${peak.day}日 ${money(peak.v)} >` : '—';
  barChart($('#ledger-bar-chart'), data, { color: mode==='income' ? '#2FBF71' : '#FF5D5D', avg });

  const monthDates = agg.map(d => `${state.month}-${String(d.day).padStart(2,'0')}`);
  const summaries = monthDates.map(d => assetSummaryAt(d));
  const nw = summaries.map(s => s.net);
  const summariesTotal = summaries.map(s => s.total);
  const summariesDebt = summaries.map(s => s.debt);
  const series = state.networthTab === 'net' ? nw : state.networthTab === 'total' ? summariesTotal : summariesDebt;
  const lastV = series[series.length-1];
  $('#networth-meta').textContent = `${monthDates.at(-1).slice(5).replace('-','/')} ${money(lastV)}`;
  lineChart($('#networth-chart'),
    series.map((v,i)=>({ v, axis: i===0?`5-1`:i===15?`5-16`:i===series.length-1?`${state.month.slice(5)}-${daysInMonth(state.month)}`:'' })),
    { color:'#FFA53C', yFmt: v => (v/10000).toFixed(2)+'w', dotLast:true });
}

function renderDonut() {
  const txs = txsInMonth(state.month);
  const type = state.ledgerTab === 'income' ? 'income' : 'expense';
  const typeLabel = type === 'expense' ? '支出' : '收入';
  const drill = state.drillCategory;
  const activeTxs = drill ? txs.filter(t => t.type === type && t.cat === drill) : txs;
  const rows = drill ? subAgg(txs, type, drill) : catAgg(txs, type);
  const drillColors = ['#FF6D4D','#4D9FFF','#2FBF71','#FFA53C','#9B7BFF','#FF7BAC','#00C2C7','#FFB84D','#4DC3FF'];
  const segs = rows.map((c,i) => ({ name:c.name, amount:c.amount, count:c.count, color:drill ? drillColors[i % drillColors.length] : catOf(c.name).color }));
  const total = segs.reduce((s,x)=>s+x.amount,0);
  donutChart($('#cat-donut'), segs, drill ? `${drill}总计` : `${typeLabel}总计`, money(total));
  const listEl = $('#cat-list');
  $('#cat-level-pill').textContent = drill ? `‹ ${drill} · 子分类` : '一级分类 ⌄';
  $('#cat-level-pill').onclick = () => { if (drill) { state.drillCategory = ''; renderDonut(); } };
  listEl.innerHTML = (drill ? '<button class="cat-back" id="cat-drill-back">‹ 返回全部分类</button>' : '') + (segs.length ? segs.map(c => {
    const parentName = drill || c.name;
    const subName = drill ? c.name : '';
    const meta = catOf(parentName);
    const pct = (c.amount / total * 100);
    return `<div class="cat-item ${drill ? '' : 'drillable'}" ${drill ? '' : `data-cat="${esc(c.name)}"`}>
      <div class="cat-ico" style="background:${meta.color}">${iconMarkup(parentName, subName, meta.icon)}</div>
      <div class="cat-info">
        <div class="cat-name">${esc(c.name)} <span class="pct">${pct.toFixed(2)}%</span>${drill ? '' : '<span class="drill-arrow">›</span>'}</div>
        <div class="cat-bar"><i style="width:${pct}%;background:${meta.color}"></i></div>
      </div>
      <div class="cat-right"><div class="cat-amt">${money(c.amount)}</div><div class="cat-cnt">${c.count} 笔</div></div>
    </div>`;
  }).join('') : '<div style="padding:20px;text-align:center;color:var(--text2);font-size:12px">暂无数据</div>');
  const back = $('#cat-drill-back');
  if (back) back.onclick = () => { state.drillCategory = ''; renderDonut(); };
  $$('#cat-list .cat-item.drillable').forEach(el => el.onclick = () => {
    state.drillCategory = el.dataset.cat;
    renderDonut();
  });
}

function renderLedger() { renderSummary(); renderCalendar(); renderTxnList(); renderLedgerCharts(); renderDonut(); }

/* ---------- 渲染：统计页 ---------- */
function statsRangeDays() {
  const out = [];
  const [a, b] = state.statsRange;
  let d = new Date(a + 'T00:00:00'), end = new Date(b + 'T00:00:00');
  while (d <= end) { out.push(localISO(d)); d.setDate(d.getDate()+1); }
  return out;
}

function renderStats() {
  const days = statsRangeDays();
  const from = days[0], to = days[days.length-1];
  const { txs, exp, inc, bal, offers } = rangeAgg(from, to);
  const n = days.length;
  const [fy, fm, fd] = from.split('-');
  const [, tm, td] = to.split('-');
  $('#stats-range-title').textContent = `${+fy}年${+fm}月${+fd}日 ~ ${+tm}月${+td}日`;

  const tile = (label, val, cls='') => `<div class="stat-tile"><div class="st-label">${label} <span class="arr">›</span></div><div class="st-value ${cls}">${val}</div></div>`;
  $('#income-tiles').innerHTML =
    tile('支出', fmt(exp), 'red') + tile('收入', fmt(inc), 'green') +
    tile('结余', fmt(bal)) + tile('日均支出', fmt(exp/n)) +
    tile('退款', fmt(0)) + tile('消费收入', fmt(0)) +
    tile('优惠', fmt(offers)) + tile('手续费', fmt(0));
  const reimb = reimbursementTotals();
  $('#reimb-tiles').innerHTML =
    tile('待报销', fmt(reimb.pending), 'red') + tile('已报销', fmt(reimb.done)) +
    tile('报销入账', fmt(reimb.in)) + tile('报销收入', fmt(reimb.in)) +
    renderReimbManager(reimb);
  $('#reimb-add-btn').onclick = addReimbursement;
  $$('#reimb-tiles [data-reimb-action]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.id;
    if (btn.dataset.reimbAction === 'done') setReimbursementStatus(id, 'done');
    else if (btn.dataset.reimbAction === 'in') setReimbursementStatus(id, 'in');
    else if (btn.dataset.reimbAction === 'delete') deleteReimbursement(id);
  });
  $('#flow-tiles').innerHTML = FLOW.map(([k,v],i) => tile(k, fmt(v), i===5?'green':'')).join('');
  $('#stats-avg').textContent = money(inc / n);

  const lineData = days.map(d => {
    const day = rangeAgg(d, d);
    const v = state.statsLineTab==='expense'?day.exp:state.statsLineTab==='income'?day.inc:day.bal;
    return { v, label:d, axis:weekdayOf(d) };
  });
  const color = state.statsLineTab==='expense' ? '#FF5D5D' : '#2FBF71';
  lineChart($('#stats-line-chart'), lineData, { color, yFmt: v => v>=1000 ? (v/1000).toFixed(2)+'k' : v.toFixed(2) });

  const table = $('#week-table');
  let rows = `<tr><th>日期</th><th class="r">支出</th><th class="r">收入</th><th class="r">结余</th></tr>`;
  rows += `<tr><td><b>总计</b></td><td class="r red">${money(exp)}</td><td class="r green">${money(inc)}</td><td class="r">${money(bal)}</td></tr>`;
  rows += `<tr><td><b>日均</b></td><td class="r red">${money(exp/n)}</td><td class="r green">${money(inc/n)}</td><td class="r">${money(bal/n)}</td></tr>`;
  days.forEach((d, i) => {
    const day = rangeAgg(d, d);
    rows += `<tr><td>${weekdayOf(d)} <span style="color:var(--text2);font-size:10px">${d.slice(5).replace('-','/')}</span></td>
      <td class="r red">${day.exp?money(day.exp):'—'}</td><td class="r green">${day.inc?money(day.inc):'—'}</td><td class="r">${day.bal?money(day.bal):'—'}</td></tr>`;
  });
  table.innerHTML = rows;

  const donutType = state.incomeDonutTab;
  const segs = catAgg(txs, donutType).map(c=>({name:c.name, amount:c.amount, count:c.count, color:catOf(c.name).color}));
  const total = segs.reduce((s,x)=>s+x.amount,0);
  donutChart($('#income-donut'), segs, (donutType==='expense'?'支出':'收入')+'总计', money(total));
  $('#income-cat-list').innerHTML = segs.length ? segs.map(c=>{
    const meta=catOf(c.name), pct=c.amount/total*100;
    return `<div class="cat-item">
      <div class="cat-ico" style="background:${meta.color}">${meta.icon}</div>
      <div class="cat-info"><div class="cat-name">${esc(c.name)} <span class="pct">${pct.toFixed(1)}%</span></div>
      <div class="cat-bar"><i style="width:${pct}%;background:${meta.color}"></i></div></div>
      <div class="cat-right"><div class="cat-amt">${money(c.amount)}</div><div class="cat-cnt">${c.count} 笔</div></div></div>`;
  }).join('') : '<div style="padding:16px;text-align:center;color:var(--text2);font-size:12px">暂无数据</div>';

  const trendSummaries = days.map(d => assetSummaryAt(d));
  const series = state.assetsLineTab==='net' ? trendSummaries.map(s=>s.net) : state.assetsLineTab==='total' ? trendSummaries.map(s=>s.total) : trendSummaries.map(s=>s.debt);
  const last7 = series.slice(-7);
  const axisDays = days.slice(-7);
  $('#total-assets-meta').textContent = `${+to.slice(5,7)}月${+to.slice(8,10)}日 ${money(series[series.length-1])}`;
  lineChart($('#assets-line-chart'), last7.map((v,i)=>({ v, axis:weekdayOf(axisDays[i]) })), { color:'#2FBF71', yFmt:v=>(v/10000).toFixed(2)+'w', dashedTail:true });
}

/* ---------- 渲染：资产页 ---------- */
const ASSET_AMOUNTS = { alipay:8483.06, cmb:34384.00, gjj1:1200.00, gjj2:1750.00, citic:-70.90, bus:150.00, octopus:30.00 };

function renderAssets() {
  const left = $('#assets-left');
  const accounts = allAccounts();
  const summary = assetSummary();
  const groups = [
    { key:'fund', label:'资金账户', ids:accounts.filter(a=>a.group==='fund').map(a=>a.id), headRight:`余额: ${money(summary.fund)} ⌄` },
    { key:'credit', label:'信用账户', ids:accounts.filter(a=>a.group==='credit').map(a=>a.id), headRight:`欠款: ${money(summary.debt)} ⌄` },
    { key:'recharge', label:'充值账户', ids:accounts.filter(a=>a.group==='recharge').map(a=>a.id), headRight:`余额: ${money(summary.recharge)} ⌄` },
  ];
  left.innerHTML = `
    <div class="card networth-card">
      <div class="nw-label">净资产 <span>👁</span></div>
      <div class="nw-amount"><span class="yen">${money(summary.net).slice(0,1)}</span>${fmt(summary.net)}</div>
      <div class="nw-sub"><span>总资产 ${money(summary.total)}</span><span>总负债 ${money(summary.debt)}</span></div>
    </div>
    ${groups.map(g => `
      <div>
        <div class="group-head">${g.label} <span class="cnt">(${g.ids.length})</span><span class="g-right">${g.headRight}</span></div>
        ${g.ids.map(id => {
          const a = accOf(id), v = accountBalance(a);
          const sub = a.credit ? `[信用卡] 10天后出账${a.limit !== undefined ? `<br>可用额度: ${money(a.limit)}` : ''}` : esc(a.sub);
          return `<div class="acc-item ${state.selectedAccountId===id?'sel':''}" data-acc="${id}">
            <div class="acc-ico" style="background:${a.color}">${accountIconHTML(a)}</div>
            <div class="acc-mid"><div class="acc-name">${esc(a.name)}</div><div class="acc-sub">${sub}</div></div>
            <div><div class="acc-amt ${v<0?'neg':''}">${money(v)}</div>${a.credit?`<div class="acc-amt-sub">可用额度: ${money(a.limit)}</div>`:''}</div>
          </div>`;
        }).join('')}
      </div>`).join('')}`;
  $$('#assets-left .acc-item').forEach(el => el.onclick = () => { state.selectedAccountId = el.dataset.acc; renderAssets(); });
  renderAssetDetail();
}

function renderAssetDetail() {
  const right = $('#assets-right');
  const a = accOf(state.selectedAccountId);
  const txs = state.txs.filter(t => t.account === a.name || t.toAccount === a.name).sort((x,y)=> y.date.localeCompare(x.date) || y.time.localeCompare(x.time));
  const monthTxs = txs.filter(t => monthOf(t.date) === state.month);
  const out = monthTxs.filter(t => t.type === 'expense' || (t.type === 'transfer' && t.account === a.name)).reduce((s,t)=>s+t.amount,0);
  const inc = monthTxs.filter(t => t.type === 'income' || (t.type === 'transfer' && t.toAccount === a.name)).reduce((s,t)=>s+t.amount,0);
  const isCredit = !!a.credit;
  const balance = accountBalance(a);
  const months = {};
  txs.forEach(t => (months[monthOf(t.date)] = months[monthOf(t.date)] || []).push(t));
  right.innerHTML = `
    <div class="card detail-card">
      <div class="dt-head">
        <div class="acc-ico" style="background:${a.color};width:38px;height:38px">${accountIconHTML(a)}</div>
        <div class="dt-name">${esc(a.name)}</div>
        <div class="dt-actions">
          <button class="dt-btn" data-action="record">${isCredit?'还款':'转入'}</button>
          <button class="dt-btn" data-action="balance">调整余额</button>
          ${state.userAccounts.some(item => item.id === a.id) ? '<button class="dt-btn" data-action="edit-account">编辑</button><button class="dt-btn danger" data-action="delete-account">删除</button>' : ''}
        </div>
      </div>
      <div class="dt-amount-label">${isCredit?'当前欠款':'当前余额'} (CNY)</div>
      <div class="dt-amount ${isCredit?'edit':''}"><span class="yen">¥</span>${fmt(Math.abs(balance))} ${isCredit?'✏️':''}</div>
      ${isCredit ? (a.limit !== undefined ? `<div class="dt-meta"><span>可用额度 <b>${money(a.limit)}</b></span><span>出账日 <b>10天后出账</b></span></div>` : '') : `<div class="dt-meta"><span>本月流出 <b class="dt-out" style="color:var(--red)">${money(out)}</b></span><span>流入 <b style="color:var(--green)">${money(inc)}</b></span></div>`}
      <div class="notice">ⓘ 关于金额调整 <span class="x">✕</span></div>
      ${Object.keys(months).sort().reverse().map(m => {
        const list = months[m];
        const mo = list.filter(t => t.type === 'expense' || (t.type === 'transfer' && t.account === a.name)).reduce((s,t)=>s+t.amount,0);
        const mi = list.filter(t => t.type === 'income' || (t.type === 'transfer' && t.toAccount === a.name)).reduce((s,t)=>s+t.amount,0);
        return `<div class="bill-month">
          <div class="bm-head">
            <span class="bm-title">${m.slice(0,4)}年${+m.slice(5)}月</span>
            <span class="bm-dates">${m}-01 - ${m}-${String(daysInMonth(m)).padStart(2,'0')}</span>
            <span class="bm-flow"><span class="out">流出: ${money(mo)}</span>　<span class="in">流入: ${money(mi)}</span></span>
          </div>
          ${list.map(txnItemHTML).join('')}
        </div>`;
      }).join('') || '<div style="padding:30px;text-align:center;color:var(--text2);font-size:12px">该账户暂无账单</div>'}
    </div>`;
  $$('#assets-right .notice .x').forEach(x => x.onclick = e => e.target.parentElement.style.display = 'none');
  $$('#assets-right .dt-btn[data-action="record"]').forEach(b => b.onclick = () => openAccountTransaction(a));
  $$('#assets-right .dt-btn[data-action="balance"]').forEach(b => b.onclick = () => editAccountBalance(a));
  $$('#assets-right .dt-btn[data-action="edit-account"]').forEach(b => b.onclick = () => openEditAccount(a));
  $$('#assets-right .dt-btn[data-action="delete-account"]').forEach(b => b.onclick = () => deleteAccount(a));
  bindTxActions('#assets-right');
}

/* ---------- 渲染：存钱页 ---------- */
function renderSavings() {
  $$('.mode-pill').forEach(p => p.classList.toggle('active', p.dataset.mode === state.savingsMode));
  const plans = PLANS.filter(x => x.mode === state.savingsMode);
  const depositsOf = plan => state.savingsDeposits[plan.id] || [];
  const depositTotal = plan => depositsOf(plan).reduce((sum,d)=>sum+Number(d.amount||0),0);
  $('#plan-list').innerHTML = plans.map(p => {
    const savedAmtOf = pl => pl.cards.length ? pl.cards.filter(c => state.savedCards.has(c.id)).length * pl.cards[0].amount : pl.saved + depositTotal(pl);
    const savedAmt = savedAmtOf(p);
    const pct = savedAmt / p.target * 100;
    return `<div class="plan-card ${state.selectedPlanId===p.id?'sel':''}" data-plan="${p.id}">
      <div class="plan-head">
        <div class="acc-ico" style="background:${p.color};width:32px;height:32px;font-size:14px">${p.icon}</div>
        <div class="plan-name">${esc(p.name)}</div>
        ${p.tags.map(t=>`<span class="tag ${t.c}">${t.t}</span>`).join('')}
      </div>
      <div class="plan-dates">${p.dateRange}</div>
      <div class="plan-target">目标金额: <b>${money(p.target)}</b></div>
      <div class="plan-stats">
        <div><div class="ps-label"><span class="dot" style="background:var(--orange)"></span>已存金额</div><div class="ps-val">${money(savedAmt)}</div></div>
        <div><div class="ps-label"><span class="dot" style="background:var(--text2)"></span>剩余未存</div><div class="ps-val">${money(p.target - savedAmt)}</div></div>
      </div>
      <div class="progress"><span>进度:</span><div class="track"><div class="fill" style="width:${pct}%"></div></div><span class="pct">${pct.toFixed(2)}%</span></div>
      <div class="plan-chev">›</div>
    </div>`;
  }).join('') || '<div style="color:var(--text2);font-size:12px;padding:20px;text-align:center">该模式下暂无计划</div>';
  $$('#plan-list .plan-card').forEach(el => el.onclick = () => { state.selectedPlanId = el.dataset.plan; renderSavings(); });

  const p = plans.find(x => x.id === state.selectedPlanId) || plans[0];
  if (!p) { $('#plan-detail').innerHTML = ''; return; }
  const pct = p.saved / p.target * 100;
  const savedCount = p.cards.filter(c => state.savedCards.has(c.id)).length;
  const savedAmt = p.cards.length ? savedCount * (p.cards[0].amount) : p.saved + depositTotal(p);
  const remaining = p.target - savedAmt;
  const pct2 = savedAmt / p.target * 100;
  $('#plan-detail').innerHTML = `
    <div class="card" style="background:var(--card)">
      <div class="detail-head">
        <div class="acc-ico" style="background:${p.color};width:38px;height:38px">${p.icon}</div>
        <div class="dh-info">
          <div class="dh-name-row"><span class="dh-name">${esc(p.name)}</span>${p.tags.map(t=>`<span class="tag ${t.c}">${t.t}</span>`).join('')}</div>
          <div class="dh-dates">${p.dateRange}</div>
          <div class="dh-target">目标金额: <b>${money(p.target)}</b></div>
        </div>
      </div>
      <div class="plan-stats" style="margin-top:12px">
        <div><div class="ps-label"><span class="dot" style="background:var(--orange)"></span>已存金额</div><div class="ps-val">${money(savedAmt)}</div></div>
        <div><div class="ps-label"><span class="dot" style="background:var(--text2)"></span>剩余未存</div><div class="ps-val">${money(remaining)}</div></div>
      </div>
      <div class="progress"><span>进度:</span><div class="track"><div class="fill" style="width:${pct2}%"></div></div><span class="pct">${pct2.toFixed(2)}%</span></div>
      ${p.cards.length ? `
        <div class="section-title" style="margin-top:16px">存钱卡片</div>
        <div class="cards-grid">
          ${p.cards.map(c => {
            const saved = state.savedCards.has(c.id);
            return `<div class="save-card ${saved?'saved':''}" data-card="${c.id}">
              <div style="display:flex;align-items:center"><div><div class="sc-amt">${money(c.amount)}</div><div class="sc-date">${c.label}</div></div>
              <button class="sc-check">✓</button></div>
            </div>`;
          }).join('')}
        </div>` : `
        <div style="margin-top:14px;display:flex;align-items:center;gap:10px">
          <button class="set-btn" id="deposit-plan">＋ 存入一笔</button>
          <span style="font-size:11px;color:var(--text2)">灵活存钱 · 随时存入</span>
        </div>
        <div style="margin-top:10px;display:grid;gap:6px">
          ${(depositsOf(p)||[]).slice().reverse().map(d=>`<div style="display:flex;justify-content:space-between;font-size:11.5px"><span>${d.date}</span><b>${money(d.amount)}</b></div>`).join('') || '<div style="font-size:11px;color:var(--text2)">暂无灵活存入记录</div>'}
        </div>`}
    </div>`;
  $$('#plan-detail .save-card').forEach(el => el.querySelector('.sc-check').onclick = () => {
    const id = el.dataset.card;
    state.savedCards.has(id) ? state.savedCards.delete(id) : state.savedCards.add(id);
    localStorage.setItem(LS_SAVED, JSON.stringify([...state.savedCards]));
    renderSavings();
    toast(state.savedCards.has(id) ? '已存入' : '已取消存入');
  });
  const depositButton = $('#deposit-plan');
  if (depositButton) depositButton.onclick = async () => {
    const value = await appPrompt('输入本次存入金额');
    if (value === null) return;
    const amount = Math.round(parseFloat(value) * 100) / 100;
    if (!amount || amount <= 0) { toast('请输入有效金额'); return; }
    (state.savingsDeposits[p.id] = state.savingsDeposits[p.id] || []).push({ id:'d'+Date.now(), amount, date:localISO(new Date()) });
    saveSavings();
    renderSavings();
    toast('已存入 ✓');
  };
}

/* ---------- 渲染：设置页 ---------- */
function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[c]));
}
function xlsxColumn(index) {
  let result = '';
  index++;
  while (index > 0) {
    const rem = (index - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    index = Math.floor((index - 1) / 26);
  }
  return result;
}
const XLSX_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    table[i] = value >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let value = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) value = XLSX_CRC_TABLE[(value ^ bytes[i]) & 0xFF] ^ (value >>> 8);
  return (value ^ 0xFFFFFFFF) >>> 0;
}
function concatBytes(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  parts.forEach(part => { result.set(part, offset); offset += part.length; });
  return result;
}
function zipStore(files) {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(now.getFullYear(), 1980) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach(file => {
    const name = encoder.encode(file.name);
    const data = file.data;
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  });
  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  return concatBytes([...localParts, centralDirectory, end]);
}
function sheetXml(rows) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${xlsxColumn(colIndex)}${rowIndex + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}
function buildXlsx(sheets) {
  const files = [
    { name:'[Content_Types].xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name:'_rels/.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name:'xl/workbook.xml', data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheets[0].name)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name:'xl/_rels/workbook.xml.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name:'xl/worksheets/sheet1.xml', data:sheetXml(sheets[0].rows) }
  ].map(file => ({ ...file, data:new TextEncoder().encode(file.data) }));
  return zipStore(files);
}
function exportRangeDates(range) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${pad2(now.getMonth()+1)}`;
  const [year, month] = currentMonth.split('-').map(Number);
  if (range === 'last') {
    const [py, pm] = addMonth(currentMonth, -1).split('-').map(Number);
    return [`${py}-${pad2(pm)}-01`, `${py}-${pad2(pm)}-${pad2(daysInMonth(`${py}-${pad2(pm)}`))}`];
  }
  if (range === 'year') return [`${year}-01-01`, `${year}-12-31`];
  if (range === 'all') {
    const dates = state.txs.map(t => t.date).sort();
    return dates.length ? [dates[0], dates[dates.length - 1]] : [`${year}-${pad2(month)}-01`, `${year}-${pad2(month)}-${pad2(daysInMonth(currentMonth))}`];
  }
  return [`${year}-${pad2(month)}-01`, `${year}-${pad2(month)}-${pad2(daysInMonth(currentMonth))}`];
}
function exportBillRows(from, to) {
  return state.txs.filter(t => t.date >= from && t.date <= to)
    .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .map(t => {
      const net = txNet(t);
      const actual = t.type === 'expense' ? -net : t.type === 'income' ? net : '';
      return [t.date, t.time, t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '转账', t.cat || '', t.sub || '', t.account || '', t.toAccount || '', t.amount, t.offer || 0, actual, t.note || ''];
    });
}
function updateExportPreview() {
  const from = $('#export-from').value;
  const to = $('#export-to').value;
  if (!from || !to || from > to) {
    $('#export-preview').innerHTML = '<div class="preview-line">请选择有效的开始和结束日期</div>';
    return;
  }
  const rows = exportBillRows(from, to);
  const expense = rows.reduce((sum,row) => sum + (row[2] === '支出' ? row[7] - row[8] : 0), 0);
  const income = rows.reduce((sum,row) => sum + (row[2] === '收入' ? row[7] : 0), 0);
  const transfer = rows.filter(row => row[2] === '转账').length;
  $('#export-preview').innerHTML = `
    <div class="preview-line"><b>${rows.length}</b> 笔账单</div>
    <div class="preview-line">支出 <b>${money(expense)}</b></div>
    <div class="preview-line">收入 <b>${money(income)}</b></div>
    ${transfer ? `<div class="preview-line">转账 <b>${transfer}</b> 笔</div>` : ''}`;
}
function setExportRange(range) {
  const [from, to] = exportRangeDates(range);
  $('#export-from').value = from;
  $('#export-to').value = to;
  $$('#export-quick .export-chip').forEach(chip => chip.classList.toggle('on', chip.dataset.range === range));
  updateExportPreview();
}
function openExportExcel() {
  setExportRange('month');
  $('#export-overlay').classList.remove('hidden');
}
function closeExportExcel() {
  $('#export-overlay').classList.add('hidden');
}
function downloadExportExcel() {
  const from = $('#export-from').value;
  const to = $('#export-to').value;
  if (!from || !to || from > to) { toast('请选择有效的时间范围'); return; }
  const rows = exportBillRows(from, to);
  if (!rows.length) { toast('所选时间没有账单'); return; }
  const data = buildXlsx([{ name:'账单明细', rows:[
    ['日期','时间','类型','分类','子分类','账户','转入账户','金额','优惠','实际金额','备注'],
    ...rows
  ] }]);
  const blob = new Blob([data.buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `iCost-账单_${from}_${to}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  closeExportExcel();
  toast('Excel 已导出 ✓');
}
function renderSettings() {
  $('#settings-wrap').innerHTML = `
    <div class="set-group-title">通用</div>
    <div class="set-item"><div class="s-label">货币单位<div class="s-desc">按固定示例汇率换算显示</div></div><select id="currency-select"><option value="CNY">CNY ¥</option><option value="USD">USD $</option></select></div>
    <div class="set-item"><div class="s-label">每周开始于</div><select id="week-start-select"><option value="0">周日</option><option value="1">周一</option></select></div>
    <div class="set-group-title">预算</div>
    <div class="set-item"><div class="s-label">月预算<div class="s-desc">用于账本页“剩余预算”卡片</div></div><input type="number" id="budget-input" value="${state.budget}" style="width:100px"><button class="set-btn" id="save-budget">保存</button></div>
    <div class="set-group-title">数据</div>
    <div class="set-item"><div class="s-label">导出数据<div class="s-desc">下载 JSON 备份</div></div><button class="set-btn" id="export-btn">导出</button></div>
    <div class="set-item"><div class="s-label">导入数据<div class="s-desc">从 JSON 备份恢复</div></div><label class="set-btn" for="import-input">选择文件</label><input type="file" id="import-input" accept="application/json,.json" hidden></div>
    <div class="set-item"><div class="s-label">导出 Excel<div class="s-desc">选择账单时间，导出标准 .xlsx</div></div><button class="set-btn" id="export-excel-open">选择时间</button></div>
    <div class="set-item"><div class="s-label">重置示例数据<div class="s-desc">清除本地修改，恢复演示数据</div></div><button class="set-btn danger" id="reset-btn">重置</button></div>
    <div class="set-group-title">关于</div>
    <div class="set-item"><div class="s-label">iCost Web<div class="s-desc">v1.0.9 · 本地完整版 · 数据仅保存在本机</div></div></div>`;
  $('#save-budget').onclick = () => {
    const v = parseFloat($('#budget-input').value);
    if (isNaN(v) || v <= 0) { toast('请输入有效的预算金额'); return; }
    state.budget = v;
    localStorage.setItem(LS_BUDGET, state.budget);
    toast('预算已保存');
    renderLedger();
  };
  $('#currency-select').value = state.currency;
  $('#week-start-select').value = String(state.weekStart);
  $('#currency-select').onchange = e => { state.currency = e.target.value; saveSettings(); refreshPage(); toast('货币显示已更新'); };
  $('#week-start-select').onchange = e => { state.weekStart = +e.target.value; saveSettings(); refreshPage(); toast('每周开始日已更新'); };
  $('#export-btn').onclick = () => {
    const backup = { app:'iCost Web', version:'1.0.9', exportedAt:new Date().toISOString(), txs:state.txs, accounts:state.userAccounts, balances:state.userBalances, budget:state.budget, savedCards:[...state.savedCards], userSubs:state.userSubs, subIcons:state.subIcons, settings:{ currency:state.currency, weekStart:state.weekStart }, savingsDeposits:state.savingsDeposits, reimbursements:state.reimbursements };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'icost-web-backup.json'; a.click();
  };
  $('#import-input').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.txs)) throw new Error('bad backup');
        state.txs = data.txs;
        state.userAccounts = Array.isArray(data.accounts) ? data.accounts : [];
        state.userBalances = data.balances && typeof data.balances === 'object' ? data.balances : {};
        state.budget = Number(data.budget) > 0 ? Number(data.budget) : BUDGET;
        state.savedCards = new Set(Array.isArray(data.savedCards) ? data.savedCards : []);
        state.userSubs = data.userSubs && typeof data.userSubs === 'object' ? data.userSubs : {};
        state.subIcons = data.subIcons && typeof data.subIcons === 'object' ? data.subIcons : {};
        state.savingsDeposits = data.savingsDeposits && typeof data.savingsDeposits === 'object' ? data.savingsDeposits : {};
        state.reimbursements = Array.isArray(data.reimbursements) ? data.reimbursements : [];
        if (data.settings && CURRENCIES[data.settings.currency]) state.currency = data.settings.currency;
        if (data.settings && [0,1].includes(data.settings.weekStart)) state.weekStart = data.settings.weekStart;
        localStorage.setItem(LS_KEY, JSON.stringify(state.txs));
        localStorage.setItem(LS_ACCOUNTS, JSON.stringify(state.userAccounts));
        localStorage.setItem(LS_BALANCES, JSON.stringify(state.userBalances));
        localStorage.setItem(LS_BUDGET, String(state.budget));
        localStorage.setItem(LS_SAVED, JSON.stringify([...state.savedCards]));
        localStorage.setItem(LS_SUBS, JSON.stringify(state.userSubs));
        localStorage.setItem(LS_SUB_ICONS, JSON.stringify(state.subIcons));
        saveSettings(); saveSavings();
        saveReimbursements();
        toast('备份已导入 ✓');
        navigate('ledger');
      } catch {
        toast('备份文件无效');
      }
    };
    reader.onerror = () => toast('备份读取失败');
    reader.readAsText(file);
    e.target.value = '';
  };
  $('#export-excel-open').onclick = openExportExcel;
  $('#reset-btn').onclick = () => {
    if (!confirm('重置会删除所有本地账单、账户、子分类和设置，确定继续吗？')) return;
    [LS_KEY, LS_SAVED, LS_BUDGET, LS_SUBS, LS_SUB_ICONS, LS_ACCOUNTS, LS_BALANCES, LS_SETTINGS, LS_SAVINGS, LS_REIMB].forEach(k => localStorage.removeItem(k));
    load(); toast('已重置'); navigate('ledger');
  };
}

/* ---------- 搜索 ---------- */
function renderSearchFilterPanel() {
  const panel = $('#search-filter-panel');
  const mode = state.filterPanel;
  panel.classList.toggle('hidden', !mode);
  $$('.filter-chip[data-filter="time"],.filter-chip[data-filter="amount"],.filter-chip[data-filter="more"]').forEach(chip => {
    chip.classList.toggle('on', chip.dataset.filter === mode);
  });
  if (!mode) return;
  if (mode === 'time') {
    panel.innerHTML = `<div class="filter-fields">
      <label>开始<input type="date" id="filter-from" value="${state.filters.from}"></label>
      <label>结束<input type="date" id="filter-to" value="${state.filters.to}"></label>
    </div>`;
    $('#filter-from').onchange = e => { state.filters.from = e.target.value; renderSearch(); };
    $('#filter-to').onchange = e => { state.filters.to = e.target.value; renderSearch(); };
  } else if (mode === 'amount') {
    panel.innerHTML = `<div class="filter-fields">
      <label>最小<input type="number" id="filter-min" step="0.01" value="${state.filters.min}" placeholder="0"></label>
      <label>最大<input type="number" id="filter-max" step="0.01" value="${state.filters.max}" placeholder="不限"></label>
    </div>`;
    $('#filter-min').onchange = e => { state.filters.min = e.target.value; renderSearch(); };
    $('#filter-max').onchange = e => { state.filters.max = e.target.value; renderSearch(); };
  } else {
    const accountOptions = ['<option value="">全部账户</option>', ...allAccounts().map(a => `<option value="${esc(a.name)}" ${state.filters.account===a.name?'selected':''}>${esc(a.name)}</option>`)].join('');
    const typeButton = ([value,label]) => `<button class="filter-chip ${state.filters.types.includes(value)?'on':''}" data-type="${value}">${label}</button>`;
    panel.innerHTML = `<div class="filter-fields">${[['expense','支出'],['income','收入'],['transfer','转账']].map(typeButton).join('')}
      <label>账户<select id="filter-account">${accountOptions}</select></label></div>`;
    $$('#search-filter-panel [data-type]').forEach(button => button.onclick = () => {
      const type = button.dataset.type;
      state.filters.types = state.filters.types.includes(type) ? state.filters.types.filter(t=>t!==type) : [...state.filters.types,type];
      renderSearch();
    });
    $('#filter-account').onchange = e => { state.filters.account = e.target.value; renderSearch(); };
  }
}

function renderSearch() {
  const q = state.searchQuery.trim().toLowerCase();
  const qn = parseFloat(q);
  const f = state.filters;
  const all = state.txs;
  const txs = all.filter(t => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    const amount = t.type === 'expense' ? txNet(t) : t.amount;
    if (f.min !== '' && amount < parseFloat(f.min)) return false;
    if (f.max !== '' && amount > parseFloat(f.max)) return false;
    if (f.types.length && !f.types.includes(t.type)) return false;
    if (f.account && t.account !== f.account && t.toAccount !== f.account) return false;
    if (!q) return true;
    if ((t.cat + (t.sub||'') + t.account + (t.note||'')).toLowerCase().includes(q)) return true;
    return !isNaN(qn) && String(t.amount).includes(q);
  });
  const exp = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+txNet(t),0);
  const inc = txs.filter(t=>t.type==='income').reduce((s,t)=>s+txNet(t),0);
  const offers = txs.reduce((s,t)=>s+(t.offer||0),0);
  const chip = (label, val, cls='') => `<div class="total-chip ${cls}"><span class="tl">${label}</span><span class="tv">${val}</span></div>`;
  renderSearchFilterPanel();
  $('#search-totals').innerHTML =
    chip('支出=', money(exp), 'red') + chip('收入=', money(inc), 'green') + chip('结余', money(inc-exp)) +
    chip('手续费', money(0)) + chip('优惠', money(offers)) + chip('退款', money(0));

  let list = [...txs];
  if (state.sortDesc) {
    list.sort((a,b)=>txNet(b)-txNet(a));
    $('#search-results').innerHTML = list.map(t => txnItemHTML({ ...t, time: `${t.date.slice(5).replace('-','/')} ${t.time}` })).join('')
      || '<div style="padding:40px;text-align:center;color:#6b6d78;font-size:12px">无匹配账单</div>';
  } else {
    list.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
    const groups = {};
    list.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
    $('#search-results').innerHTML = Object.keys(groups).sort().reverse().map(day => {
      const g = groups[day];
      const e = g.filter(t=>t.type==='expense').reduce((s,t)=>s+txNet(t),0);
      const i = g.filter(t=>t.type==='income').reduce((s,t)=>s+txNet(t),0);
      return `<div class="sr-day"><b>${day.slice(5).replace('-','/')}</b> ${weekdayOf(day)}　支出: ${money(e)} 收入: ${money(i)} <span class="chev">⌄</span></div>
        ${g.map(txnItemHTML).join('')}`;
    }).join('') || '<div style="padding:40px;text-align:center;color:#6b6d78;font-size:12px">无匹配账单</div>';
  }
  $$('#search-results .txn-item').forEach(el => {
    el.style.borderBottom = '1px solid #23242c';
  });
  bindTxActions('#search-results');
}

/* ---------- 记一笔 ---------- */
const add = { type:'expense', amount:'0', offer:'', note:'', cat:'餐饮', sub:'', account:'支付宝', toAccount:'招商银行', dt:'', creatingSub:false, newSubIcon:'', newSubImage:'' };
function renderAdd() {
  $$('.add-tab').forEach(t => t.classList.toggle('active', t.dataset.type === add.type));
  $('#add-amount').textContent = add.amount;
  $('#add-offer').value = add.offer;
  $('#add-note').value = add.note;
  $('#pick-account').textContent = (add.type === 'transfer' ? '💳 转出 ' : '💳 ') + add.account;
  if (add.type === 'transfer') {
    $('#pick-cat').textContent = '🏦 转入 ' + add.toAccount;
    $('#pick-sub').textContent = '🏦 账户间转账';
    $('#pick-book').style.display = 'none';
    $('#pick-sub').style.display = 'none';
    $('#cat-picker').style.display = 'none';
    $('#sub-row').style.display = 'none';
  } else {
    $('#pick-book').style.display = '';
    $('#pick-sub').style.display = '';
    $('#pick-cat').textContent = '🍩 ' + add.cat;
    $('#pick-sub').textContent = '🏷️ ' + (add.sub || '无');
    $('#cat-picker').style.display = '';
    $('#sub-row').style.display = '';
    const types = Object.keys(CATS).filter(k => add.type === 'expense' ? !CATS[k].income : CATS[k].income);
    $('#cat-picker').innerHTML = types.map(k => `
      <div class="cat-opt ${add.cat===k?'sel':''}" data-cat="${k}">
        <div class="c-ico" style="background:${CATS[k].color}">${CATS[k].icon}</div>${k}
      </div>`).join('');
    $$('#cat-picker .cat-opt').forEach(o => o.onclick = () => {
      add.cat = o.dataset.cat;
      add.sub = subsOf(add.cat)[0] || '';
      add.creatingSub = false;
      add.newSubIcon = '';
      add.newSubImage = '';
      renderAdd();
    });
    renderSubRow();
  }
  $('#pick-datetime').textContent = `📅 ${formatChipDT(add.dt)}`;
}
function renderSubRow() {
  const row = $('#sub-row');
  if (add.creatingSub) {
    row.innerHTML = `
      <div class="new-sub-editor">
        <div class="sub-icon-preview" id="new-sub-icon"></div>
        <input class="new-sub-input" id="new-sub-input" placeholder="子分类名称" maxlength="12">
      </div>
      <div class="new-sub-tools">
        <input class="new-sub-emoji" id="new-sub-emoji" placeholder="图标" maxlength="4" value="${esc(add.newSubIcon)}">
        <label class="new-sub-upload">上传图片<input type="file" id="new-sub-image" accept="image/*" hidden></label>
        <button class="new-sub-ok" id="new-sub-ok">确定</button>
        <button class="sub-add" id="new-sub-cancel">取消</button>
      </div>`;
    const input = $('#new-sub-input');
    const emojiInput = $('#new-sub-emoji');
    const preview = () => {
      const meta = catOf(add.cat);
      $('#new-sub-icon').innerHTML = add.newSubImage
        ? `<img src="${add.newSubImage}" alt="自定义图标">`
        : esc(add.newSubIcon || meta.icon);
    };
    const confirm = () => addUserSub(add.cat, input.value, emojiInput.value.trim(), add.newSubImage);
    emojiInput.oninput = () => { add.newSubIcon = emojiInput.value.trim(); add.newSubImage = ''; preview(); };
    $('#new-sub-image').onchange = e => {
      const file = e.target.files[0];
      readSubIconImage(file, dataUrl => {
        add.newSubImage = dataUrl;
        preview();
        toast('图标已就绪');
      });
      e.target.value = '';
    };
    preview();
    $('#new-sub-ok').onclick = confirm;
    input.onkeydown = e => { if (e.key === 'Enter') confirm(); };
    $('#new-sub-cancel').onclick = () => { add.creatingSub = false; add.newSubIcon = ''; add.newSubImage = ''; renderAdd(); };
    input.focus();
    return;
  }
  const subs = subsOf(add.cat);
  row.innerHTML = subs.map(s => {
    const custom = subIconOf(add.cat, s);
    const icon = custom && custom.image
      ? `<img class="sub-ico" src="${custom.image}" alt="">`
      : `<span class="sub-ico">${esc(custom && custom.icon ? custom.icon : '')}</span>`;
    return `<button class="sub-chip ${add.sub===s?'on':''}" data-sub="${esc(s)}">${icon}${esc(s)}</button>`;
  }).join('') +
    `<button class="sub-add" id="sub-add-btn">＋ 新建子分类</button>`;
  $$('#sub-row .sub-chip').forEach(c => c.onclick = () => { add.sub = c.dataset.sub; renderAdd(); });
  $('#sub-add-btn').onclick = () => { add.creatingSub = true; renderAdd(); };
}

/* ---------- 资金账户 ---------- */
const accountForm = { name:'', group:'fund', balance:'', icon:'💳', iconImage:'', color:'#4D7BFE', source:'asset' };
const ACCOUNT_COLORS = ['#4D7BFE','#4D9FFF','#2FBF71','#FF9F43','#FF5D5D','#FFD166','#9B6BFF','#A0A6B1'];

function previewAccountIcon() {
  $('#acc-icon-preview').innerHTML = accountForm.iconImage
    ? `<img src="${accountForm.iconImage}" alt="账户图标">`
    : esc(accountForm.icon || '💳');
}

function openAccountModal(source = 'asset', editId = '') {
  accountForm.source = source;
  state.accountEditingId = editId;
  const editing = editId ? state.userAccounts.find(a => a.id === editId) : null;
  accountForm.name = editing ? editing.name : '';
  accountForm.group = editing ? editing.group : 'fund';
  accountForm.balance = editing ? String(editing.credit ? Math.abs(accountBalance(editing)) : accountBalance(editing)) : '';
  accountForm.icon = editing ? editing.icon : '💳';
  accountForm.iconImage = editing ? editing.iconImage || '' : '';
  accountForm.color = editing ? editing.color : '#4D7BFE';
  $('#account-modal-title').textContent = editing ? '编辑资金账户' : '新增资金账户';
  $('#acc-form-name').value = accountForm.name;
  $('#acc-form-balance').value = accountForm.balance;
  $('#acc-form-icon').value = accountForm.icon;
  $('#acc-form-group').value = accountForm.group;
  $('#acc-form-group').disabled = !!editing;
  const colors = ACCOUNT_COLORS.includes(accountForm.color) ? ACCOUNT_COLORS : [accountForm.color, ...ACCOUNT_COLORS];
  $('#acc-color-picker').innerHTML = ACCOUNT_COLORS.map(c => `<button class="color-dot ${c===accountForm.color?'on':''}" data-color="${c}" style="background:${c}"></button>`).join('');
  $('#acc-color-picker').innerHTML = colors.map(c => `<button class="color-dot ${c===accountForm.color?'on':''}" data-color="${c}" style="background:${c}"></button>`).join('');
  $$('#acc-color-picker .color-dot').forEach(d => d.onclick = () => {
    accountForm.color = d.dataset.color;
    $$('#acc-color-picker .color-dot').forEach(x => x.classList.toggle('on', x === d));
  });
  $('#acc-form-icon').oninput = e => accountForm.icon = e.target.value.trim() || '💳';
  $('#acc-form-icon').oninput = e => { accountForm.icon = e.target.value.trim() || '💳'; accountForm.iconImage = ''; previewAccountIcon(); };
  $('#acc-form-image').onchange = e => {
    readSubIconImage(e.target.files[0], dataUrl => { accountForm.iconImage = dataUrl; previewAccountIcon(); toast('图标已就绪'); });
    e.target.value = '';
  };
  $('#acc-image-clear').onclick = () => { accountForm.iconImage = ''; previewAccountIcon(); };
  $('#acc-form-group').onchange = e => accountForm.group = e.target.value;
  previewAccountIcon();
  $('#account-overlay').classList.remove('hidden');
  $('#acc-form-name').focus();
}

function closeAccountModal() {
  $('#account-overlay').classList.add('hidden');
}

function saveAccount() {
  const name = $('#acc-form-name').value.trim();
  if (!name) { toast('请输入账户名称'); return; }
  if (name.length > 16) { toast('账户名称不能超过 16 个字'); return; }
  if (allAccounts().some(a => a.name === name && a.id !== state.accountEditingId)) { toast('账户名称已存在'); return; }
  let balance = parseFloat($('#acc-form-balance').value || '0');
  if (isNaN(balance)) { toast('请输入有效的初始余额'); return; }
  if (accountForm.group === 'credit' && balance > 0) balance = -balance;
  const editing = state.accountEditingId ? state.userAccounts.find(a => a.id === state.accountEditingId) : null;
  let account;
  if (editing) {
    const oldName = editing.name;
    Object.assign(editing, { name, color:accountForm.color, icon:accountForm.icon, iconImage:accountForm.iconImage, balance });
    if (oldName !== name) {
      state.txs.forEach(tx => {
        if (tx.account === oldName) tx.account = name;
        if (tx.toAccount === oldName) tx.toAccount = name;
      });
      saveTxs();
    }
    account = editing;
  } else {
    account = { id:'u' + Date.now() + '-' + Math.random().toString(36).slice(2,7), name, group:accountForm.group, color:accountForm.color, icon:accountForm.icon, iconImage:accountForm.iconImage, sub:accountForm.group === 'credit' ? '自定义信用卡' : '自定义账户', balance };
    if (accountForm.group === 'credit') account.credit = true;
    state.userAccounts.push(account);
  }
  localStorage.setItem(LS_ACCOUNTS, JSON.stringify(state.userAccounts));
  closeAccountModal();
  if (!$('#add-overlay').classList.contains('hidden') && (accountForm.source === 'from' || accountForm.source === 'to')) {
    if (accountForm.source === 'to') add.toAccount = account.name;
    else add.account = account.name;
    if (add.toAccount === add.account) add.toAccount = (allAccounts().find(a => a.name !== account.name) || {}).name || add.toAccount;
    renderAdd();
  } else if (!$('#add-overlay').classList.contains('hidden')) {
    add.account = account.name;
    if (add.toAccount === add.account) add.toAccount = (allAccounts().find(a => a.name !== account.name) || {}).name || add.toAccount;
    renderAdd();
  } else {
    state.selectedAccountId = account.id;
    refreshPage();
  }
  toast(editing ? '账户已更新 ✓' : '账户已添加 ✓');
}

function openEditAccount(account) {
  openAccountModal('asset', account.id);
}

function deleteAccount(account) {
  const related = state.txs.filter(t => t.account === account.name || t.toAccount === account.name);
  const message = related.length
    ? `该账户还有 ${related.length} 笔账单。删除账户会同时删除这些账单，确定继续吗？`
    : '确定删除这个账户吗？';
  if (!confirm(message)) return;
  state.txs = state.txs.filter(t => t.account !== account.name && t.toAccount !== account.name);
  state.userAccounts = state.userAccounts.filter(a => a.id !== account.id);
  delete state.userBalances[account.id];
  localStorage.setItem(LS_ACCOUNTS, JSON.stringify(state.userAccounts));
  localStorage.setItem(LS_BALANCES, JSON.stringify(state.userBalances));
  saveTxs();
  state.selectedAccountId = allAccounts()[0]?.id || '';
  renderAssets();
  toast('账户已删除 ✓');
}

function openAccountTransaction(account) {
  openAdd();
  if (account.credit) {
    add.type = 'transfer';
    add.toAccount = account.name;
    const source = allAccounts().find(a => a.group === 'fund' && a.name !== account.name);
    add.account = source ? source.name : (allAccounts().find(a => a.name !== account.name) || {}).name || add.account;
  } else {
    add.type = 'income';
    add.account = account.name;
    add.cat = '副业';
    add.sub = subsOf(add.cat)[0] || '';
  }
  add.amount = '0';
  add.creatingSub = false;
  renderAdd();
}

let appPromptResolve = null;
function appPrompt(title, value = '') {
  $('#prompt-title').textContent = title;
  $('#prompt-input').value = value;
  $('#prompt-overlay').classList.remove('hidden');
  $('#prompt-input').focus(); $('#prompt-input').select();
  return new Promise(resolve => { appPromptResolve = resolve; });
}
function finishAppPrompt(value) {
  if (!appPromptResolve) return;
  const resolve = appPromptResolve;
  appPromptResolve = null;
  $('#prompt-overlay').classList.add('hidden');
  resolve(value);
}

async function editAccountBalance(account) {
  const value = await appPrompt(`调整「${account.name}」当前余额`, Math.abs(accountBalance(account)).toFixed(2));
  if (value === null) return;
  const amount = parseFloat(value);
  if (isNaN(amount) || amount < 0) { toast('请输入有效的余额'); return; }
  saveAccountBalance(account, account.credit ? -amount : amount);
  renderAssets();
  toast('余额已更新 ✓');
}

function openAccountMenu(kind) {
  const menu = $('#acc-menu');
  if (!menu.classList.contains('hidden')) { menu.classList.add('hidden'); return; }
  const selected = kind === 'to' ? add.toAccount : add.account;
  menu.innerHTML = allAccounts().map(a => `<button class="acc-opt ${selected===a.name?'on':''}" data-acc="${esc(a.name)}">${a.icon} ${esc(a.name)}</button>`).join('') +
    `<button class="acc-opt add" data-acc="__add__">＋ 新增账户</button>`;
  menu.classList.remove('hidden');
  $$('#acc-menu .acc-opt').forEach(o => o.onclick = () => {
    if (o.dataset.acc === '__add__') { menu.classList.add('hidden'); openAccountModal(kind); return; }
    if (kind === 'to') add.toAccount = o.dataset.acc;
    else {
      add.account = o.dataset.acc;
      if (add.toAccount === add.account) add.toAccount = (allAccounts().find(a => a.name !== add.account) || {}).name || add.toAccount;
    }
    if (add.toAccount === add.account) add.account = (allAccounts().find(a => a.name !== add.toAccount) || {}).name || add.account;
    menu.classList.add('hidden');
    renderAdd();
  });
}
function keypadPress(key) {
  if (key === 'ac') add.amount = '0';
  else if (key === 'del') add.amount = add.amount.length > 1 ? add.amount.slice(0,-1) : '0';
  else if (key === 'cny') { toast('货币单位：CNY'); return; }
  else if (key === 'done') { saveTx(); return; }
  else if (key === '.') { if (!add.amount.includes('.')) add.amount += '.'; }
  else {
    if (add.amount.includes('.') && add.amount.split('.')[1].length >= 2) { toast('金额最多保留两位小数'); return; }
    if (add.amount === '0') add.amount = key;
    else if (add.amount.replace('.','').length < 8) add.amount += key;
  }
  renderAdd();
}
function saveTx() {
  const amount = parseFloat(add.amount);
  if (!amount || amount <= 0) { toast('请输入金额'); return; }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001) { toast('金额最多保留两位小数'); return; }
  const offer = add.type === 'expense' ? (parseFloat(add.offer || '0') || 0) : 0;
  if (offer < 0 || offer >= amount) { toast('请输入小于金额的优惠'); return; }
  if (add.type === 'transfer' && add.toAccount === add.account) { toast('转入账户不能与转出账户相同'); return; }
  const transfer = add.type === 'transfer';
  const c = transfer ? null : catOf(add.cat);
  const { date, time } = parseDT();
  const editingTx = state.editingTxId ? state.txs.find(t => t.id === state.editingTxId) : null;
  if (editingTx) {
    state.txs = state.txs.filter(t => t.id !== editingTx.id);
    allAccounts().forEach(account => saveAccountBalance(account, accountBalance(account) - accountTxEffect(editingTx, account.name)));
  }
  const tx = transfer
    ? { id: editingTx ? editingTx.id : 'u' + Date.now() + '-' + Math.random().toString(36).slice(2,7), date, time, type:add.type, cat:'转账', sub:'', amount, account:add.account, toAccount:add.toAccount }
    : { id: editingTx ? editingTx.id : 'u' + Date.now() + '-' + Math.random().toString(36).slice(2,7), date, time, type:add.type, cat:add.cat, sub: add.sub || (c.subs && c.subs[0]) || '', amount, offer, note: add.note.trim(), account:add.account };
  state.txs.push(tx);
  const fromAccount = allAccounts().find(a => a.name === add.account);
  const toAccount = transfer ? allAccounts().find(a => a.name === add.toAccount) : fromAccount;
  if (transfer) {
    if (fromAccount) saveAccountBalance(fromAccount, accountBalance(fromAccount) - amount);
    if (toAccount) saveAccountBalance(toAccount, accountBalance(toAccount) + amount);
  } else if (toAccount) {
    saveAccountBalance(toAccount, accountBalance(toAccount) + (add.type === 'expense' ? -amount : amount));
  }
  saveTxs();
  $('#add-overlay').classList.add('hidden');
  toast(editingTx ? '账单已更新 ✓' : '已记一笔 ✓');
  state.editingTxId = '';
  state.month = monthOf(date);
  state.selectedDay = date;
  refreshPage();
}
function parseDT() {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(add.dt || '');
  if (m) return { date:`${m[1]}-${m[2]}-${m[3]}`, time:`${m[4]}:${m[5]}` + (m[6] !== undefined ? ':' + m[6] : ':00') };
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`,
    time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
  };
}
function defaultDT() {
  const now = new Date();
  const date = state.selectedDay && monthOf(state.selectedDay) === state.month ? state.selectedDay : `${state.month}-01`;
  return `${date}T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}
function openAdd() {
  add.amount = '0';
  add.offer = '';
  add.note = '';
  state.editingTxId = '';
  add.creatingSub = false;
  if (!subsOf(add.cat).includes(add.sub)) add.sub = subsOf(add.cat)[0] || '';
  add.dt = defaultDT();
  $('#acc-menu').classList.add('hidden');
  renderAdd();
  $('#add-overlay').classList.remove('hidden');
}
function closeAdd() {
  $('#add-overlay').classList.add('hidden');
}
$('#add-close').onclick = closeAdd;
$('#add-overlay').onclick = e => { if (e.target === e.currentTarget) closeAdd(); };

/* ---------- 时间选择弹窗（滚轮） ---------- */
const tp = { y:2024, mo:5, d:30, h:0, mi:0, s:0 };
const WHEEL = {};
const ITEM_H = 40;

function formatChipDT(dt) {
  return (dt || '').replace(/-/g, '/').replace('T', ' ');
}
function openTimePanel() {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(add.dt || '');
  if (m) {
    tp.y = +m[1]; tp.mo = +m[2]; tp.d = +m[3]; tp.h = +m[4]; tp.mi = +m[5]; tp.s = +(m[6] || 0);
  } else {
    const n = new Date();
    tp.y = n.getFullYear(); tp.mo = n.getMonth() + 1; tp.d = n.getDate();
    tp.h = n.getHours(); tp.mi = n.getMinutes(); tp.s = n.getSeconds();
  }
  buildTimeWheels();
  $('#time-overlay').classList.remove('hidden');
}
function renderTimeCalendar() {
  $('#time-month-title').textContent = `${tp.y}年${tp.mo}月`;
  const grid = $('#time-cal-grid');
  const dim = new Date(tp.y, tp.mo, 0).getDate();
  $('#time-overlay .time-cal-week').innerHTML = orderedWeekdays().map(d => `<span>${d}</span>`).join('');
  const firstWeekday = (new Date(tp.y, tp.mo - 1, 1).getDay() - state.weekStart + 7) % 7;
  grid.innerHTML = '';
  for (let i = 0; i < firstWeekday; i++) grid.insertAdjacentHTML('beforeend', '<div class="time-cal-day blank"></div>');
  for (let day = 1; day <= dim; day++) {
    grid.insertAdjacentHTML('beforeend', `<div class="time-cal-day ${day===tp.d?'sel':''}" data-day="${day}">${day}</div>`);
  }
  $$('#time-cal-grid .time-cal-day:not(.blank)').forEach(el => el.onclick = () => {
    tp.d = +el.dataset.day;
    renderTimeCalendar();
  });
}
function updateTimeValue() {
  $('#time-value').textContent = `${pad2(tp.h)}:${pad2(tp.mi)}:${pad2(tp.s)}`;
}
function buildTimeWheels() {
  const cols = $('#wheel-cols');
  cols.innerHTML = '';
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: 60 }, (_, i) => i);
  const secs = Array.from({ length: 60 }, (_, i) => i);
  renderTimeCalendar();
  WHEEL.h  = addWheelCol(cols, hours,  tp.h,  v => { tp.h = v; updateTimeValue(); }, pad2);
  WHEEL.mi = addWheelCol(cols, mins,   tp.mi, v => { tp.mi = v; updateTimeValue(); }, pad2);
  WHEEL.s  = addWheelCol(cols, secs,   tp.s,  v => { tp.s = v; updateTimeValue(); }, pad2);
  updateTimeValue();
}
function addWheelCol(parent, values, sel, onChange, fmt) {
  const el = document.createElement('div');
  el.className = 'wheel-col';
  const mkSpacer = () => { const s = document.createElement('div'); s.className = 'wheel-spacer'; return s; };
  el.appendChild(mkSpacer());
  values.forEach(v => {
    const it = document.createElement('div');
    it.className = 'wheel-item' + (v === sel ? ' cur' : '');
    it.textContent = fmt(v);
    el.appendChild(it);
  });
  el.appendChild(mkSpacer());
  const w = { el, values, fmt, onChange };
  bindWheelScroll(w);
  const selIdx = Math.max(0, values.indexOf(sel));
  requestAnimationFrame(() => { el.scrollTop = selIdx * ITEM_H; });
  parent.appendChild(el);
  return w;
}
function bindWheelScroll(w) {
  w.el.onclick = e => {
    const item = e.target.closest('.wheel-item');
    if (!item) return;
    const idx = [...w.el.querySelectorAll('.wheel-item')].indexOf(item);
    if (idx >= 0) setWheelIndex(w, idx);
  };
  w.el.onscroll = () => {
    clearTimeout(w.tm);
    w.tm = setTimeout(() => {
      const idx = Math.max(0, Math.min(w.values.length - 1, Math.round(w.el.scrollTop / ITEM_H)));
      w.el.querySelectorAll('.wheel-item').forEach((it, i) => it.classList.toggle('cur', i === idx));
      w.onChange(w.values[idx]);
    }, 60);
  };
}
function setWheelIndex(w, idx) {
  const safeIdx = Math.max(0, Math.min(w.values.length - 1, idx));
  w.el.querySelectorAll('.wheel-item').forEach((it, i) => it.classList.toggle('cur', i === safeIdx));
  w.onChange(w.values[safeIdx]);
  w.el.scrollTo({ top:safeIdx * ITEM_H, behavior:'smooth' });
}
function rebuildWheelCol(w, values, sel, fmt) {
  w.values = values; w.fmt = fmt;
  const el = w.el;
  el.innerHTML = '';
  const mkSpacer = () => { const s = document.createElement('div'); s.className = 'wheel-spacer'; return s; };
  el.appendChild(mkSpacer());
  values.forEach(v => {
    const it = document.createElement('div');
    it.className = 'wheel-item' + (v === sel ? ' cur' : '');
    it.textContent = fmt(v);
    el.appendChild(it);
  });
  el.appendChild(mkSpacer());
  const selIdx = Math.max(0, values.indexOf(sel));
  el.scrollTop = selIdx * ITEM_H;
  bindWheelScroll(w);
}
function confirmTime() {
  add.dt = `${tp.y}-${pad2(tp.mo)}-${pad2(tp.d)}T${pad2(tp.h)}:${pad2(tp.mi)}:${pad2(tp.s)}`;
  $('#time-overlay').classList.add('hidden');
  $('#pick-datetime').textContent = `📅 ${formatChipDT(add.dt)}`;
  toast('时间已更新');
}
function shiftTimeMonth(delta) {
  const next = new Date(tp.y, tp.mo - 1 + delta, 1);
  tp.y = next.getFullYear();
  tp.mo = next.getMonth() + 1;
  tp.d = Math.min(tp.d, new Date(tp.y, tp.mo, 0).getDate());
  renderTimeCalendar();
}

/* ---------- 导航 ---------- */
function navigate(page) {
  state.page = page;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  $('#app').classList.toggle('dark', page === 'savings');
  refreshPage();
}

function shiftStatsRange(delta) {
  if (state.statsMode === 'week') {
    state.statsRange = [addDays(state.statsRange[0], delta * 7), addDays(state.statsRange[1], delta * 7)];
  } else {
    const nextMonth = addMonth(state.statsRange[0].slice(0, 7), delta);
    state.statsRange = [nextMonth + '-01', nextMonth + '-' + String(daysInMonth(nextMonth)).padStart(2, '0')];
  }
  renderStats();
}
function refreshPage() {
  if (state.page === 'ledger') renderLedger();
  else if (state.page === 'stats') renderStats();
  else if (state.page === 'assets') renderAssets();
  else if (state.page === 'savings') renderSavings();
  else if (state.page === 'settings') renderSettings();
}

/* ---------- 事件绑定 ---------- */
function bind() {
  $$('.nav-item').forEach(n => n.onclick = () => navigate(n.dataset.page));
  $('#fab-add').onclick = openAdd;
  $('#asset-add').onclick = openAccountModal;
  $('#asset-quick-add').onclick = openAdd;
  $('#savings-add').onclick = openAdd;
  $('#open-search').onclick = () => { $('#search-overlay').classList.remove('hidden'); state.searchQuery=''; $('#search-input').value=''; renderSearch(); $('#search-input').focus(); };
  $('#search-cancel').onclick = () => $('#search-overlay').classList.add('hidden');
  $('#search-overlay').onclick = e => { if (e.target === e.currentTarget) $('#search-overlay').classList.add('hidden'); };
  $('#search-clear').onclick = () => {
    state.searchQuery='';
    state.filters = { from:'', to:'', min:'', max:'', types:[], accounts:[], account:'' };
    state.filterPanel = '';
    $('#search-input').value='';
    renderSearch();
  };
  $('#search-input').oninput = e => { state.searchQuery = e.target.value; renderSearch(); };
  $('#sort-chip').onclick = () => { state.sortDesc = !state.sortDesc; $('#sort-chip').classList.toggle('on', state.sortDesc); renderSearch(); };
  $$('.filter-chip[data-filter="time"],.filter-chip[data-filter="amount"],.filter-chip[data-filter="more"]').forEach(c => c.onclick = () => {
    state.filterPanel = state.filterPanel === c.dataset.filter ? '' : c.dataset.filter;
    renderSearch();
  });
  $('#goto-month-stats').onclick = () => {
    state.statsMode = 'month';
    state.statsRange = [state.month + '-01', state.month + '-' + String(daysInMonth(state.month)).padStart(2, '0')];
    navigate('stats');
  };
  const setStatsFilterPanel = visible => {
    $('#stats-filter-panel').classList.toggle('hidden', !visible);
    if (visible) { $('#stats-filter-from').value = state.statsRange[0]; $('#stats-filter-to').value = state.statsRange[1]; }
  };
  $('#stats-filter').onclick = () => setStatsFilterPanel($('#stats-filter-panel').classList.contains('hidden'));
  $('#stats-filter-apply').onclick = () => {
    const from = $('#stats-filter-from').value, to = $('#stats-filter-to').value;
    if (!from || !to || from > to) { toast('请选择有效统计区间'); return; }
    state.statsRange = [from, to];
    setStatsFilterPanel(false);
    renderStats();
  };
  $('#stats-filter-reset').onclick = () => {
    if (state.statsMode === 'month') state.statsRange = [state.month + '-01', state.month + '-' + String(daysInMonth(state.month)).padStart(2,'0')];
    else state.statsRange = [addDays(localISO(new Date()), -6), localISO(new Date())];
    setStatsFilterPanel(false);
    renderStats();
  };
  $('#sync-btn').onclick = () => toast('数据已保存在本机 ✓');
  $('#help-btn').onclick = () => toast('本地版：账单、资产、存钱和统计均可使用');

  $('#cal-prev').onclick = () => { state.month = addMonth(state.month, -1); state.selectedDay = null; state.drillCategory = ''; renderCalendar(); renderTxnList(); renderLedgerCharts(); renderDonut(); renderSummary(); };
  $('#cal-next').onclick = () => { state.month = addMonth(state.month, 1); state.selectedDay = null; state.drillCategory = ''; renderCalendar(); renderTxnList(); renderLedgerCharts(); renderDonut(); renderSummary(); };

  $$('#ledger-chart-tabs .seg').forEach(s => s.onclick = () => { state.ledgerTab = s.dataset.mode; state.drillCategory = ''; $$('#ledger-chart-tabs .seg, #cat-tabs .seg').forEach(x=>x.classList.toggle('active',x.dataset.mode===state.ledgerTab)); renderLedgerCharts(); renderDonut(); });
  $$('#networth-tabs .seg').forEach(s => s.onclick = () => { state.networthTab = s.dataset.mode; $$('#networth-tabs .seg').forEach(x=>x.classList.toggle('active',x===s)); renderLedgerCharts(); });
  $$('#cat-tabs .seg').forEach(s => s.onclick = () => { state.ledgerTab = s.dataset.mode; state.drillCategory = ''; $$('#ledger-chart-tabs .seg, #cat-tabs .seg').forEach(x=>x.classList.toggle('active',x.dataset.mode===state.ledgerTab)); renderDonut(); renderLedgerCharts(); });

  $('#stats-mode-btn').onclick = () => {
    state.statsMode = state.statsMode === 'week' ? 'month' : 'week';
    $('#stats-mode-btn').textContent = state.statsMode === 'week' ? '按周统计' : '按月统计';
    if (state.statsMode === 'month') state.statsRange = [state.month + '-01', state.month + '-' + String(daysInMonth(state.month)).padStart(2,'0')];
    else state.statsRange = [addDays(localISO(new Date()), -6), localISO(new Date())];
    renderStats();
  };
  $('#stats-prev').onclick = () => shiftStatsRange(-1);
  $('#stats-next').onclick = () => shiftStatsRange(1);
  $$('#stats-line-tabs .seg').forEach(s => s.onclick = () => { state.statsLineTab = s.dataset.mode; $$('#stats-line-tabs .seg').forEach(x=>x.classList.toggle('active',x===s)); renderStats(); });
  $$('#assets-line-tabs .seg').forEach(s => s.onclick = () => { state.assetsLineTab = s.dataset.mode; $$('#assets-line-tabs .seg').forEach(x=>x.classList.toggle('active',x===s)); renderStats(); });
  $$('#income-donut-tabs .seg').forEach(s => s.onclick = () => { state.incomeDonutTab = s.dataset.mode; $$('#income-donut-tabs .seg').forEach(x=>x.classList.toggle('active',x===s)); renderStats(); });

  $$('.mode-pill').forEach(p => p.onclick = () => { state.savingsMode = p.dataset.mode; const plans = PLANS.filter(x=>x.mode===p.dataset.mode); if (plans.length) state.selectedPlanId = plans[0].id; renderSavings(); });

  $$('.add-tab').forEach(t => t.onclick = () => {
    add.type = t.dataset.type;
    if (add.type !== 'transfer') {
      add.cat = add.type === 'expense' ? '餐饮' : '副业';
      add.sub = subsOf(add.cat)[0] || '';
    }
    add.creatingSub = false;
    add.amount = '0';
    renderAdd();
  });
  $$('.keypad button').forEach(b => b.onclick = () => keypadPress(b.dataset.key));
  $('#add-offer').oninput = e => add.offer = e.target.value;
  $('#add-note').oninput = e => add.note = e.target.value;
  $('#pick-sub').onclick = () => { add.creatingSub = true; renderSubRow(); };
  $('#pick-datetime').onclick = openTimePanel;
  $('#time-confirm').onclick = confirmTime;
  $('#time-cancel').onclick = () => $('#time-overlay').classList.add('hidden');
  $('#export-excel').onclick = downloadExportExcel;
  $('#export-cancel').onclick = closeExportExcel;
  $('#export-close').onclick = closeExportExcel;
  $('#export-overlay').onclick = e => { if (e.target === e.currentTarget) closeExportExcel(); };
  $$('#export-quick .export-chip').forEach(chip => chip.onclick = () => setExportRange(chip.dataset.range));
  $('#export-from').oninput = () => { $$('#export-quick .export-chip').forEach(chip => chip.classList.remove('on')); updateExportPreview(); };
  $('#export-to').oninput = () => { $$('#export-quick .export-chip').forEach(chip => chip.classList.remove('on')); updateExportPreview(); };
  $('#pick-account').onclick = () => openAccountMenu('from');
  $('#pick-cat').onclick = () => { if (add.type === 'transfer') openAccountMenu('to'); };
  $('#time-prev-month').onclick = () => shiftTimeMonth(-1);
  $('#time-next-month').onclick = () => shiftTimeMonth(1);
  $('#pick-book').onclick = () => toast('默认账本：联认账本_二');
  $('#account-save').onclick = saveAccount;
  $('#account-cancel').onclick = closeAccountModal;
  $('#account-close').onclick = closeAccountModal;
  $('#account-overlay').onclick = e => { if (e.target === e.currentTarget) closeAccountModal(); };
  $('#prompt-confirm').onclick = () => finishAppPrompt($('#prompt-input').value);
  $('#prompt-cancel').onclick = () => finishAppPrompt(null);
  $('#prompt-overlay').onclick = e => { if (e.target === e.currentTarget) finishAppPrompt(null); };
  $('#prompt-input').onkeydown = e => { if (e.key === 'Enter') finishAppPrompt(e.target.value); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('#search-overlay').classList.add('hidden'); $('#add-overlay').classList.add('hidden'); $('#time-overlay').classList.add('hidden'); $('#export-overlay').classList.add('hidden'); $('#account-overlay').classList.add('hidden'); finishAppPrompt(null); }
  });
}

/* ---------- 启动 ---------- */
load();
bind();
navigate('ledger');
