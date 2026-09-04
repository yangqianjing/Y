/* iCost Web — 应用逻辑 */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => (Math.abs(n)).toLocaleString('zh-CN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const money = n => '¥' + fmt(n);
const signedMoney = (n, type) => type === 'expense' ? '-' + fmt(n) : type === 'income' ? '+' + fmt(n) : fmt(n);

/* ---------- 状态 ---------- */
const LS_KEY = 'icostweb_tx_v1';
const LS_BUDGET = 'icostweb_budget';
const LS_SAVED = 'icostweb_saved';
const LS_SUBS = 'icostweb_subs_v1';
const REIMB = { pending:108.00, done:0, in:0 };
const FLOW = [ ['还款',0],['收款',0],['转账',1000],['充值',50],['借入',0],['借出',1000] ];
const HOLIDAYS = { '2024-05-01':'劳动节', '2024-06-01':'儿童节' };

const state = {
  page: 'ledger',
  month: '2024-05',
  selectedDay: '2024-05-30',
  ledgerTab: 'expense',
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
  searchOpen: false,
  searchQuery: '',
  sortDesc: false,
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
}
function saveTxs() { localStorage.setItem(LS_KEY, JSON.stringify(state.txs)); }

/* ---------- 工具 ---------- */
const dayKey = d => d; // '2024-05-30'
const monthOf = d => d.slice(0,7);
const dayNum = d => +d.slice(8,10);
const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
const weekdayOf = d => weekdays[new Date(d + 'T00:00:00').getDay()];
function localISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const pad2 = n => String(n).padStart(2, '0');
function daysInMonth(m) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); }
function fmtMonthTitle(m) { const [y, mo] = m.split('-'); return `${y}年${+mo}月`; }
function addMonth(m, delta) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function txNet(t) { return t.amount - (t.offer || 0); }
function catOf(name) { return CATS[name] || { icon:'🧾', color:'#A0A6B1', subs:[] }; }
function accOf(id) { return ACCOUNTS.find(a => a.id === id) || { name:id, color:'#A0A6B1', icon:'💳' }; }
function subsOf(cat) {
  const built = (CATS[cat] && CATS[cat].subs) || [];
  const user = state.userSubs[cat] || [];
  return [...new Set([...built, ...user])];
}
function addUserSub(cat, name) {
  const n = (name || '').trim();
  if (!n) { toast('请输入子分类名称'); return; }
  if (subsOf(cat).some(s => s === n)) {
    toast('该子分类已存在');
    add.sub = n; add.creatingSub = false; renderAdd();
    return;
  }
  (state.userSubs[cat] = state.userSubs[cat] || []).push(n);
  localStorage.setItem(LS_SUBS, JSON.stringify(state.userSubs));
  add.sub = n; add.creatingSub = false;
  renderAdd();
  toast(`已创建子分类「${n}」`);
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
    { dot:'#4D9FFF', label:'待报销', amount:REIMB.pending, sub:[['已报销', money(REIMB.done)],['报销入账', money(REIMB.in)]], arrow:true },
    { dot:'#FFA53C', label:'净资产', amount:ASSET_SNAPSHOT.net, sub:[['总资产', money(ASSET_SNAPSHOT.total)],['总负债', money(ASSET_SNAPSHOT.debt)]], arrow:true },
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
  const first = new Date(state.month + '-01T00:00:00').getDay();
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
  <div class="txn-item">
    <div class="txn-ico" style="background:#4D7BFE">💸</div>
    <div class="txn-mid">
      <div class="txn-name">转账 · ${esc(t.account)} → ${esc(t.toAccount)}</div>
      <div class="txn-time">${t.time}</div>
    </div>
    <div class="txn-right">
      <div class="txn-amt transfer">${fmt(t.amount)}</div>
      <div class="txn-acc">转入 ${esc(t.toAccount)}</div>
    </div>
  </div>`;
  }
  const c = catOf(t.cat);
  const sub = t.sub ? ` · ${t.sub}` : '';
  const tags = [];
  if (t.offer) tags.push(`<span class="txn-tag">${t.type==='expense'?'优惠':'退款'} ${fmt(t.offer)}</span>`);
  return `
  <div class="txn-item">
    <div class="txn-ico" style="background:${c.color}">${c.icon}</div>
    <div class="txn-mid">
      <div class="txn-name">${esc(t.cat)}${esc(sub)}</div>
      <div class="txn-time">${t.time}</div>
      ${tags.length ? `<div class="txn-tags">${tags.join('')}</div>` : ''}
      ${t.note ? `<div class="txn-note">📍 ${esc(t.note)}</div>` : ''}
    </div>
    <div class="txn-right">
      <div class="txn-amt ${t.type}">${signedMoney(txNet(t), t.type)}</div>
      <div class="txn-acc">${esc(t.account)}</div>
    </div>
  </div>`;
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

  const nw = NETWORTH_SERIES;
  const series = state.networthTab === 'net' ? nw : state.networthTab === 'total' ? TOTAL_ASSETS_SERIES : DEBT_SERIES;
  const lastV = series[series.length-1];
  $('#networth-meta').textContent = `5月31日 ${money(lastV)}`;
  lineChart($('#networth-chart'),
    series.map((v,i)=>({ v, axis: i===0?'5-1':i===15?'5-16':i===series.length-1?'5-31':'' })),
    { color:'#FFA53C', yFmt: v => (v/10000).toFixed(2)+'w', dotLast:true });
}

function renderDonut() {
  const txs = txsInMonth(state.month);
  const type = state.ledgerTab === 'income' ? 'income' : 'expense';
  const segs = catAgg(txs, type).map(c => ({ name:c.name, amount:c.amount, count:c.count, color:catOf(c.name).color }));
  const total = segs.reduce((s,x)=>s+x.amount,0);
  donutChart($('#cat-donut'), segs, (type==='expense'?'支出':'收入') + '总计', money(total));
  const listEl = $('#cat-list');
  listEl.innerHTML = segs.length ? segs.map(c => {
    const meta = catOf(c.name);
    const pct = (c.amount / total * 100);
    return `<div class="cat-item">
      <div class="cat-ico" style="background:${meta.color}">${meta.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${esc(c.name)} <span class="pct">${pct.toFixed(2)}%</span></div>
        <div class="cat-bar"><i style="width:${pct}%;background:${meta.color}"></i></div>
      </div>
      <div class="cat-right"><div class="cat-amt">${money(c.amount)}</div><div class="cat-cnt">${c.count} 笔</div></div>
    </div>`;
  }).join('') : '<div style="padding:20px;text-align:center;color:var(--text2);font-size:12px">暂无数据</div>';
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
  $('#reimb-tiles').innerHTML =
    tile('待报销', fmt(REIMB.pending), 'red') + tile('已报销', fmt(REIMB.done)) +
    tile('报销入账', fmt(REIMB.in)) + tile('报销收入', fmt(0));
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

  const series = state.assetsLineTab==='net'?NETWORTH_SERIES:state.assetsLineTab==='total'?TOTAL_ASSETS_SERIES:DEBT_SERIES;
  const last7 = series.slice(-7);
  const axisDays = days.slice(-7);
  $('#total-assets-meta').textContent = `${+to.slice(5,7)}月${+to.slice(8,10)}日 ${money(series[series.length-1])}`;
  lineChart($('#assets-line-chart'), last7.map((v,i)=>({ v, axis:weekdayOf(axisDays[i]) })), { color:'#2FBF71', yFmt:v=>(v/10000).toFixed(2)+'w', dashedTail:true });
}

/* ---------- 渲染：资产页 ---------- */
const ASSET_AMOUNTS = { alipay:8483.06, cmb:34384.00, gjj1:1200.00, gjj2:1750.00, citic:-70.90, bus:150.00, octopus:30.00 };

function renderAssets() {
  const left = $('#assets-left');
  const groups = [
    { key:'fund', label:'资金账户', ids:['alipay','cmb','gjj1','gjj2'], headRight:`余额: ${money(ASSET_SNAPSHOT.fund)} ⌄` },
    { key:'credit', label:'信用账户', ids:['citic'], headRight:`欠款: ${money(70.90)} ⌄` },
    { key:'recharge', label:'充值账户', ids:['bus','octopus'], headRight:`余额: ${money(ASSET_SNAPSHOT.recharge)} ⌄` },
  ];
  left.innerHTML = `
    <div class="card networth-card">
      <div class="nw-label">净资产 <span>👁</span></div>
      <div class="nw-amount"><span class="yen">¥</span>${fmt(ASSET_SNAPSHOT.net)}</div>
      <div class="nw-sub"><span>总资产 ${money(ASSET_SNAPSHOT.total)}</span><span>总负债 ${money(ASSET_SNAPSHOT.debt)}</span></div>
    </div>
    ${groups.map(g => `
      <div>
        <div class="group-head">${g.label} <span class="cnt">(${g.ids.length})</span><span class="g-right">${g.headRight}</span></div>
        ${g.ids.map(id => {
          const a = accOf(id), v = ASSET_AMOUNTS[id];
          const sub = a.credit ? `[信用卡] 10天后出账<br>可用额度: ${money(a.limit)}` : esc(a.sub);
          return `<div class="acc-item ${state.selectedAccountId===id?'sel':''}" data-acc="${id}">
            <div class="acc-ico" style="background:${a.color}">${a.icon}</div>
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
  const txs = state.txs.filter(t => t.account === a.name).sort((x,y)=> y.date.localeCompare(x.date) || y.time.localeCompare(x.time));
  const monthTxs = txs.filter(t => monthOf(t.date) === state.month);
  const out = monthTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const inc = monthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const isCredit = !!a.credit;
  const balance = isCredit ? -70.90 : (ASSET_AMOUNTS[a.id] || 0);
  const months = {};
  txs.forEach(t => (months[monthOf(t.date)] = months[monthOf(t.date)] || []).push(t));
  right.innerHTML = `
    <div class="card detail-card">
      <div class="dt-head">
        <div class="acc-ico" style="background:${a.color};width:38px;height:38px">${a.icon}</div>
        <div class="dt-name">${esc(a.name)}</div>
        <div class="dt-actions"><button class="dt-btn">${isCredit?'还款':'转入'}</button><button class="dt-btn">更多</button></div>
      </div>
      <div class="dt-amount-label">${isCredit?'当前欠款':'当前余额'} (CNY)</div>
      <div class="dt-amount ${isCredit?'edit':''}"><span class="yen">¥</span>${fmt(Math.abs(balance))} ${isCredit?'✏️':''}</div>
      ${isCredit ? `<div class="dt-meta"><span>可用额度 <b>${money(a.limit)}</b></span><span>出账日 <b>10天后出账</b></span></div>` : `<div class="dt-meta"><span>本月流出 <b class="dt-out" style="color:var(--red)">${money(out)}</b></span><span>流入 <b style="color:var(--green)">${money(inc)}</b></span></div>`}
      <div class="notice">ⓘ 关于金额调整 <span class="x">✕</span></div>
      ${Object.keys(months).sort().reverse().map(m => {
        const list = months[m];
        const mo = list.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const mi = list.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
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
  $$('#assets-right .dt-btn').forEach(b => b.onclick = () => toast('演示版：该功能暂未开放'));
}

/* ---------- 渲染：存钱页 ---------- */
function renderSavings() {
  $$('.mode-pill').forEach(p => p.classList.toggle('active', p.dataset.mode === state.savingsMode));
  const plans = PLANS.filter(x => x.mode === state.savingsMode);
  $('#plan-list').innerHTML = plans.map(p => {
    const savedAmtOf = pl => pl.cards.length ? pl.cards.filter(c => state.savedCards.has(c.id)).length * pl.cards[0].amount : pl.saved;
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
  const savedAmt = p.cards.length ? savedCount * (p.cards[0].amount) : p.saved;
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
        </div>` : '<div style="margin-top:14px;color:var(--text2);font-size:12px">灵活存钱 · 随时存入，不设固定卡片</div>'}
    </div>`;
  $$('#plan-detail .save-card').forEach(el => el.querySelector('.sc-check').onclick = () => {
    const id = el.dataset.card;
    state.savedCards.has(id) ? state.savedCards.delete(id) : state.savedCards.add(id);
    localStorage.setItem(LS_SAVED, JSON.stringify([...state.savedCards]));
    renderSavings();
    toast(state.savedCards.has(id) ? '已存入' : '已取消存入');
  });
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
  const [year, month] = state.month.split('-').map(Number);
  if (range === 'last') {
    const [py, pm] = addMonth(state.month, -1).split('-').map(Number);
    return [`${py}-${pad2(pm)}-01`, `${py}-${pad2(pm)}-${pad2(daysInMonth(`${py}-${pad2(pm)}`))}`];
  }
  if (range === 'year') return [`${year}-01-01`, `${year}-12-31`];
  if (range === 'all') {
    const dates = state.txs.map(t => t.date).sort();
    return dates.length ? [dates[0], dates[dates.length - 1]] : [`${year}-${pad2(month)}-01`, `${year}-${pad2(month)}-${pad2(daysInMonth(state.month))}`];
  }
  return [`${year}-${pad2(month)}-01`, `${year}-${pad2(month)}-${pad2(daysInMonth(state.month))}`];
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
    <div class="set-item"><div class="s-label">货币单位<div class="s-desc">账单显示货币</div></div><select><option>CNY ¥</option><option>USD $</option></select></div>
    <div class="set-item"><div class="s-label">每周开始于</div><select><option>周日</option><option>周一</option></select></div>
    <div class="set-group-title">预算</div>
    <div class="set-item"><div class="s-label">月预算<div class="s-desc">用于账本页“剩余预算”卡片</div></div><input type="number" id="budget-input" value="${state.budget}" style="width:100px"><button class="set-btn" id="save-budget">保存</button></div>
    <div class="set-group-title">数据</div>
    <div class="set-item"><div class="s-label">导出数据<div class="s-desc">下载 JSON 备份</div></div><button class="set-btn" id="export-btn">导出</button></div>
    <div class="set-item"><div class="s-label">导出 Excel<div class="s-desc">选择账单时间，导出标准 .xlsx</div></div><button class="set-btn" id="export-excel-open">选择时间</button></div>
    <div class="set-item"><div class="s-label">重置示例数据<div class="s-desc">清除本地修改，恢复演示数据</div></div><button class="set-btn danger" id="reset-btn">重置</button></div>
    <div class="set-group-title">关于</div>
    <div class="set-item"><div class="s-label">iCost Web<div class="s-desc">v1.0.6 · 网页预览版 · 数据仅保存在本浏览器</div></div></div>`;
  $('#save-budget').onclick = () => {
    const v = parseFloat($('#budget-input').value);
    if (isNaN(v) || v <= 0) { toast('请输入有效的预算金额'); return; }
    state.budget = v;
    localStorage.setItem(LS_BUDGET, state.budget);
    toast('预算已保存');
    renderLedger();
  };
  $('#export-btn').onclick = () => {
    const blob = new Blob([JSON.stringify({ txs: state.txs }, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'icost-web-backup.json'; a.click();
  };
  $('#export-excel-open').onclick = openExportExcel;
  $('#reset-btn').onclick = () => { [LS_KEY, LS_SAVED, LS_BUDGET, LS_SUBS].forEach(k => localStorage.removeItem(k)); load(); toast('已重置'); navigate('ledger'); };
}

/* ---------- 搜索 ---------- */
function renderSearch() {
  const q = state.searchQuery.trim().toLowerCase();
  const qn = parseFloat(q);
  const all = state.txs;
  const txs = all.filter(t => {
    if (!q) return true;
    if ((t.cat + (t.sub||'') + t.account + (t.note||'')).toLowerCase().includes(q)) return true;
    return !isNaN(qn) && String(t.amount).includes(q);
  });
  const exp = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+txNet(t),0);
  const inc = txs.filter(t=>t.type==='income').reduce((s,t)=>s+txNet(t),0);
  const offers = txs.reduce((s,t)=>s+(t.offer||0),0);
  const chip = (label, val, cls='') => `<div class="total-chip ${cls}"><span class="tl">${label}</span><span class="tv">${val}</span></div>`;
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
}

/* ---------- 记一笔 ---------- */
const add = { type:'expense', amount:'0', cat:'餐饮', sub:'', account:'支付宝', toAccount:'招商银行', dt:'', creatingSub:false };
function renderAdd() {
  $$('.add-tab').forEach(t => t.classList.toggle('active', t.dataset.type === add.type));
  $('#add-amount').textContent = add.amount;
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
      <input class="new-sub-input" id="new-sub-input" placeholder="子分类名称" maxlength="12">
      <button class="new-sub-ok" id="new-sub-ok">确定</button>
      <button class="sub-add" id="new-sub-cancel">取消</button>`;
    const input = $('#new-sub-input');
    const confirm = () => addUserSub(add.cat, input.value);
    $('#new-sub-ok').onclick = confirm;
    input.onkeydown = e => { if (e.key === 'Enter') confirm(); };
    $('#new-sub-cancel').onclick = () => { add.creatingSub = false; renderAdd(); };
    input.focus();
    return;
  }
  const subs = subsOf(add.cat);
  row.innerHTML = subs.map(s => `<button class="sub-chip ${add.sub===s?'on':''}" data-sub="${esc(s)}">${esc(s)}</button>`).join('') +
    `<button class="sub-add" id="sub-add-btn">＋ 新建子分类</button>`;
  $$('#sub-row .sub-chip').forEach(c => c.onclick = () => { add.sub = c.dataset.sub; renderAdd(); });
  $('#sub-add-btn').onclick = () => { add.creatingSub = true; renderAdd(); };
}
function openAccountMenu(kind) {
  const menu = $('#acc-menu');
  if (!menu.classList.contains('hidden')) { menu.classList.add('hidden'); return; }
  const selected = kind === 'to' ? add.toAccount : add.account;
  menu.innerHTML = ACCOUNTS.map(a => `<button class="acc-opt ${selected===a.name?'on':''}" data-acc="${esc(a.name)}">${a.icon} ${esc(a.name)}</button>`).join('');
  menu.classList.remove('hidden');
  $$('#acc-menu .acc-opt').forEach(o => o.onclick = () => {
    if (kind === 'to') add.toAccount = o.dataset.acc;
    else {
      add.account = o.dataset.acc;
      if (add.toAccount === add.account) add.toAccount = (ACCOUNTS.find(a => a.name !== add.account) || {}).name || add.toAccount;
    }
    if (add.toAccount === add.account) add.account = (ACCOUNTS.find(a => a.name !== add.toAccount) || {}).name || add.account;
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
    if (add.amount === '0') add.amount = key;
    else if (add.amount.replace('.','').length < 8) add.amount += key;
  }
  renderAdd();
}
function saveTx() {
  const amount = parseFloat(add.amount);
  if (!amount || amount <= 0) { toast('请输入金额'); return; }
  if (add.type === 'transfer' && add.toAccount === add.account) { toast('转入账户不能与转出账户相同'); return; }
  const transfer = add.type === 'transfer';
  const c = transfer ? null : catOf(add.cat);
  const { date, time } = parseDT();
  state.txs.push(transfer
    ? { id:'u'+Date.now(), date, time, type:add.type, cat:'转账', sub:'', amount, account:add.account, toAccount:add.toAccount }
    : { id:'u'+Date.now(), date, time, type:add.type, cat:add.cat, sub: add.sub || (c.subs && c.subs[0]) || '', amount, account:add.account });
  saveTxs();
  $('#add-overlay').classList.add('hidden');
  toast('已记一笔 ✓');
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
  const firstWeekday = new Date(tp.y, tp.mo - 1, 1).getDay();
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
  w.el.onscroll = () => {
    clearTimeout(w.tm);
    w.tm = setTimeout(() => {
      const idx = Math.max(0, Math.min(w.values.length - 1, Math.round(w.el.scrollTop / ITEM_H)));
      w.el.querySelectorAll('.wheel-item').forEach((it, i) => it.classList.toggle('cur', i === idx));
      w.onChange(w.values[idx]);
    }, 60);
  };
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
  $('#asset-quick-add').onclick = $('#savings-add').onclick = $('#asset-add').onclick = openAdd;
  $('#open-search').onclick = () => { $('#search-overlay').classList.remove('hidden'); state.searchQuery=''; $('#search-input').value=''; renderSearch(); $('#search-input').focus(); };
  $('#search-cancel').onclick = () => $('#search-overlay').classList.add('hidden');
  $('#search-overlay').onclick = e => { if (e.target === e.currentTarget) $('#search-overlay').classList.add('hidden'); };
  $('#search-clear').onclick = () => { state.searchQuery=''; $('#search-input').value=''; renderSearch(); };
  $('#search-input').oninput = e => { state.searchQuery = e.target.value; renderSearch(); };
  $('#sort-chip').onclick = () => { state.sortDesc = !state.sortDesc; $('#sort-chip').classList.toggle('on', state.sortDesc); renderSearch(); };
  $$('.filter-chip:not(#sort-chip)').forEach(c => c.onclick = () => { c.classList.toggle('on'); toast('演示版：更多筛选条件暂未开放'); });
  $('#goto-month-stats').onclick = () => {
    state.statsMode = 'month';
    state.statsRange = [state.month + '-01', state.month + '-' + String(daysInMonth(state.month)).padStart(2, '0')];
    navigate('stats');
  };
  $('#stats-filter').onclick = () => toast('演示版：筛选暂未开放');
  $('#sync-btn').onclick = () => toast('演示版：数据保存在本地');
  $('#help-btn').onclick = () => toast('iCost Web · 演示版');
  $('#book-chip').onclick = () => toast('默认账本：联认账本_二');

  $('#cal-prev').onclick = () => { state.month = addMonth(state.month, -1); state.selectedDay = null; renderCalendar(); renderTxnList(); renderLedgerCharts(); renderDonut(); renderSummary(); };
  $('#cal-next').onclick = () => { state.month = addMonth(state.month, 1); state.selectedDay = null; renderCalendar(); renderTxnList(); renderLedgerCharts(); renderDonut(); renderSummary(); };

  $$('#ledger-chart-tabs .seg').forEach(s => s.onclick = () => { state.ledgerTab = s.dataset.mode; $$('#ledger-chart-tabs .seg').forEach(x=>x.classList.toggle('active',x===s)); renderLedgerCharts(); });
  $$('#networth-tabs .seg').forEach(s => s.onclick = () => { state.networthTab = s.dataset.mode; $$('#networth-tabs .seg').forEach(x=>x.classList.toggle('active',x===s)); renderLedgerCharts(); });
  $$('#cat-tabs .seg').forEach(s => s.onclick = () => { state.ledgerTab = s.dataset.mode; $$('#cat-tabs .seg').forEach(x=>x.classList.toggle('active',x===s)); renderDonut(); renderLedgerCharts(); });

  $('#stats-mode-btn').onclick = () => {
    state.statsMode = state.statsMode === 'week' ? 'month' : 'week';
    $('#stats-mode-btn').textContent = state.statsMode === 'week' ? '按周统计' : '按月统计';
    if (state.statsMode === 'month') state.statsRange = [state.month + '-01', state.month + '-' + String(daysInMonth(state.month)).padStart(2,'0')];
    else state.statsRange = ['2024-05-26','2024-06-01'];
    renderStats();
  };
  $('#stats-prev').onclick = $('#stats-next').onclick = () => toast('演示版：切换统计区间暂未开放');
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

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('#search-overlay').classList.add('hidden'); $('#add-overlay').classList.add('hidden'); $('#time-overlay').classList.add('hidden'); $('#export-overlay').classList.add('hidden'); }
  });
}

/* ---------- 启动 ---------- */
load();
bind();
navigate('ledger');
