/* iCost Web — 示例数据（还原 App Store 截图中的账本内容） */

const CATS = {
  '餐饮':   { icon:'🍔', color:'#FF6D4D', subs:['三餐','咖啡','零食'] },
  '交通':   { icon:'🚇', color:'#34C77B', subs:['地铁','公交','打车'] },
  '住房':   { icon:'🏠', color:'#FFA53C', subs:['房租','水电','物业'] },
  '美妆':   { icon:'💄', color:'#FF7BAC', subs:['护肤','彩妆'] },
  '数码':   { icon:'📱', color:'#4D9FFF', subs:['电子产品','配件'] },
  '社交':   { icon:'💬', color:'#9B7BFF', subs:['聚餐','礼物'] },
  '服饰':   { icon:'👕', color:'#00C2C7', subs:['衣服','鞋'] },
  '运动':   { icon:'🏸', color:'#FF5D5D', subs:['运动'] },
  '娱乐':   { icon:'🎬', color:'#FFB84D', subs:['电影','游戏'] },
  '医疗':   { icon:'💊', color:'#4DC3FF', subs:['药品'] },
  '其他':   { icon:'🧾', color:'#A0A6B1', subs:['其他'] },
  '副业':   { icon:'💼', color:'#2FBF71', subs:['副业'], income:true },
  '报销入账':{ icon:'🧾', color:'#34C77B', subs:['报销'], income:true },
  '返款入账':{ icon:'🍊', color:'#FF9F43', subs:['返款'], income:true },
  '退款入账':{ icon:'⭐', color:'#FFD166', subs:['退款'], income:true },
  '投资收益':{ icon:'📈', color:'#4D7BFE', subs:['收益'], income:true },
  '工资':   { icon:'💰', color:'#4D7BFE', subs:['工资'], income:true },
};

const ACCOUNTS = [
  { id:'alipay', name:'支付宝',   group:'fund',   color:'#4D9FFF', icon:'🅰️', sub:'支付宝' },
  { id:'cmb',    name:'招商银行', group:'fund',   color:'#FF3B30', icon:'🏦', sub:'6252 XXXX XXXX XX88 · 储蓄卡' },
  { id:'gjj1',   name:'公积金 🐻', group:'fund',  color:'#FFA53C', icon:'🐻', sub:'公积金' },
  { id:'gjj2',   name:'公积金 🐶', group:'fund',  color:'#FF8C42', icon:'🐶', sub:'公积金' },
  { id:'citic',  name:'中信银行', group:'credit', color:'#E0393E', icon:'🏦', sub:'625X XXXX XXXX XX78 · 信用卡 10天后出账', credit:true, limit:19929.10 },
  { id:'bus',    name:'北京公交卡', group:'recharge', color:'#34C77B', icon:'🚌', sub:'公交卡' },
  { id:'octopus',name:'八达通',   group:'recharge', color:'#FF9F43', icon:'🎫', sub:'交通卡' },
];

/* 交易数据：type: 'expense' | 'income'；amount 恒为正数 */
let TX_SEED = [
  // —— 5月1日 ——
  { id:'t0501a', date:'2024-05-01', time:'08:12', type:'expense', cat:'交通', sub:'地铁',   amount:20,   account:'北京公交卡' },
  { id:'t0501b', date:'2024-05-01', time:'12:30', type:'expense', cat:'餐饮', sub:'三餐',   amount:15,   account:'支付宝' },
  // —— 5月2日 ——
  { id:'t0502a', date:'2024-05-02', time:'09:05', type:'expense', cat:'餐饮', sub:'早餐',   amount:12,   account:'支付宝' },
  { id:'t0502b', date:'2024-05-02', time:'19:22', type:'expense', cat:'娱乐', sub:'电影',   amount:38,   account:'中信银行' },
  // —— 5月3日：收入 60 ——
  { id:'t0503a', date:'2024-05-03', time:'10:00', type:'income',  cat:'返款入账', sub:'返款', amount:60,  account:'支付宝' },
  // —— 5月4日 ——
  { id:'t0504a', date:'2024-05-04', time:'11:40', type:'expense', cat:'餐饮', sub:'三餐',   amount:26,   account:'支付宝' },
  { id:'t0504b', date:'2024-05-04', time:'15:10', type:'expense', cat:'交通', sub:'公交',   amount:34,   account:'北京公交卡' },
  // —— 5月5日 ——
  { id:'t0505a', date:'2024-05-05', time:'08:35', type:'expense', cat:'餐饮', sub:'咖啡',   amount:9,    account:'中信银行' },
  // —— 5月6日：收入 100 ——
  { id:'t0506a', date:'2024-05-06', time:'14:20', type:'income',  cat:'返款入账', sub:'返款', amount:100, account:'支付宝' },
  // —— 5月7日：房租 ——
  { id:'t0507a', date:'2024-05-07', time:'09:00', type:'expense', cat:'住房', sub:'房租',   amount:362,  account:'招商银行' },
  // —— 5月8日 ——
  { id:'t0508a', date:'2024-05-08', time:'20:15', type:'expense', cat:'餐饮', sub:'三餐',   amount:66,   account:'支付宝' },
  { id:'t0508b', date:'2024-05-08', time:'21:02', type:'expense', cat:'服饰', sub:'衣服',   amount:94,   account:'中信银行' },
  // —— 5月9日 ——
  { id:'t0509a', date:'2024-05-09', time:'12:10', type:'expense', cat:'餐饮', sub:'三餐',   amount:35,   account:'支付宝' },
  { id:'t0509b', date:'2024-05-09', time:'17:45', type:'expense', cat:'娱乐', sub:'游戏',   amount:45,   account:'中信银行' },
  // —— 5月11日：理财收益 ——
  { id:'t0511a', date:'2024-05-11', time:'09:30', type:'income',  cat:'投资收益', sub:'收益', amount:6938, account:'招商银行' },
  { id:'t0511b', date:'2024-05-11', time:'09:31', type:'income',  cat:'返款入账', sub:'返款', amount:10.8, account:'支付宝' },
  // —— 5月12日 ——
  { id:'t0512a', date:'2024-05-12', time:'13:25', type:'expense', cat:'餐饮', sub:'聚餐',   amount:88,   account:'中信银行' },
  { id:'t0512b', date:'2024-05-12', time:'16:40', type:'expense', cat:'其他', sub:'其他',   amount:20,   account:'支付宝' },
  // —— 5月13日：收入 1 ——
  { id:'t0513a', date:'2024-05-13', time:'10:12', type:'income',  cat:'返款入账', sub:'返款', amount:1,    account:'支付宝' },
  // —— 5月14日 ——
  { id:'t0514a', date:'2024-05-14', time:'11:05', type:'expense', cat:'餐饮', sub:'三餐',   amount:42,   account:'支付宝' },
  { id:'t0514b', date:'2024-05-14', time:'14:33', type:'expense', cat:'医疗', sub:'药品',   amount:63,   account:'中信银行' },
  // —— 5月15日：峰值日 ¥480 ——
  { id:'t0515a', date:'2024-05-15', time:'10:18', type:'expense', cat:'美妆', sub:'护肤',   amount:350,  account:'中信银行' },
  { id:'t0515b', date:'2024-05-15', time:'15:52', type:'expense', cat:'数码', sub:'配件',   amount:130,  account:'中信银行' },
  // —— 5月16日：收入 38 ——
  { id:'t0516a', date:'2024-05-16', time:'18:08', type:'income',  cat:'副业', sub:'副业',   amount:38,   account:'支付宝' },
  // —— 5月17日：收入 60 ——
  { id:'t0517a', date:'2024-05-17', time:'12:00', type:'income',  cat:'返款入账', sub:'返款', amount:60,  account:'支付宝' },
  { id:'t0517b', date:'2024-05-17', time:'18:30', type:'expense', cat:'餐饮', sub:'三餐',   amount:60,   account:'支付宝' },
  // —— 5月18日 ——
  { id:'t0518a', date:'2024-05-18', time:'11:20', type:'expense', cat:'餐饮', sub:'三餐',   amount:49,   account:'支付宝' },
  { id:'t0518b', date:'2024-05-18', time:'16:05', type:'expense', cat:'社交', sub:'礼物',   amount:40,   account:'中信银行' },
  // —— 5月19日 ——
  { id:'t0519a', date:'2024-05-19', time:'10:00', type:'expense', cat:'社交', sub:'聚餐',   amount:180,  account:'中信银行' },
  { id:'t0519b', date:'2024-05-19', time:'19:40', type:'expense', cat:'服饰', sub:'鞋',     amount:140,  account:'中信银行' },
  // —— 5月20日：收入 800 ——
  { id:'t0520a', date:'2024-05-20', time:'09:15', type:'income',  cat:'副业', sub:'副业',   amount:800,  account:'支付宝' },
  { id:'t0520b', date:'2024-05-20', time:'12:35', type:'expense', cat:'餐饮', sub:'三餐',   amount:44,   account:'支付宝' },
  { id:'t0520c', date:'2024-05-20', time:'17:50', type:'expense', cat:'交通', sub:'打车',   amount:45,   account:'支付宝' },
  // —— 5月21日：收入 500 ——
  { id:'t0521a', date:'2024-05-21', time:'13:10', type:'income',  cat:'副业', sub:'副业',   amount:500,  account:'支付宝' },
  { id:'t0521b', date:'2024-05-21', time:'18:22', type:'expense', cat:'餐饮', sub:'三餐',   amount:60,   account:'支付宝' },
  // —— 5月22日：水电 ——
  { id:'t0522a', date:'2024-05-22', time:'08:40', type:'expense', cat:'住房', sub:'水电',   amount:184,  account:'招商银行' },
  { id:'t0522b', date:'2024-05-22', time:'12:15', type:'income',  cat:'返款入账', sub:'返款', amount:161.26, account:'支付宝' },
  // —— 5月23日 ——
  { id:'t0523a', date:'2024-05-23', time:'09:55', type:'expense', cat:'餐饮', sub:'咖啡',   amount:17,   account:'中信银行' },
  // —— 5月24日 ——
  { id:'t0524a', date:'2024-05-24', time:'14:28', type:'expense', cat:'娱乐', sub:'游戏',   amount:24,   account:'中信银行' },
  // —— 5月25日 ——
  { id:'t0525a', date:'2024-05-25', time:'20:05', type:'expense', cat:'交通', sub:'地铁',   amount:25,   account:'北京公交卡' },
  // —— 5月26日：收入 1000 ——
  { id:'t0526a', date:'2024-05-26', time:'10:30', type:'income',  cat:'副业', sub:'副业',   amount:1000, account:'支付宝' },
  { id:'t0526b', date:'2024-05-26', time:'15:45', type:'expense', cat:'餐饮', sub:'聚餐',   amount:68,   account:'中信银行' },
  { id:'t0526c', date:'2024-05-26', time:'19:20', type:'expense', cat:'其他', sub:'其他',   amount:40,   account:'支付宝' },
  // —— 5月27日 ——
  { id:'t0527a', date:'2024-05-27', time:'12:20', type:'expense', cat:'餐饮', sub:'三餐',   amount:36,   account:'支付宝' },
  { id:'t0527b', date:'2024-05-27', time:'16:50', type:'expense', cat:'医疗', sub:'药品',   amount:30,   account:'中信银行' },
  // —— 5月28日：收入 110 ——
  { id:'t0528a', date:'2024-05-28', time:'11:35', type:'income',  cat:'返款入账', sub:'返款', amount:110, account:'支付宝' },
  { id:'t0528b', date:'2024-05-28', time:'18:12', type:'expense', cat:'餐饮', sub:'三餐',   amount:56,   account:'支付宝' },
  { id:'t0528c', date:'2024-05-28', time:'21:05', type:'expense', cat:'娱乐', sub:'游戏',   amount:44,   account:'中信银行' },
  // —— 5月29日 ——
  { id:'t0529a', date:'2024-05-29', time:'10:42', type:'expense', cat:'餐饮', sub:'三餐',   amount:45,   account:'支付宝' },
  { id:'t0529b', date:'2024-05-29', time:'15:28', type:'expense', cat:'社交', sub:'礼物',   amount:75,   account:'中信银行' },
  // —— 5月30日（截图原样）——
  { id:'t0530a', date:'2024-05-30', time:'20:09', type:'expense', cat:'餐饮', sub:'咖啡',   amount:9.90, account:'中信银行' },
  { id:'t0530b', date:'2024-05-30', time:'19:16', type:'income',  cat:'退款入账', sub:'退款', amount:2.00, account:'中信银行' },
  { id:'t0530c', date:'2024-05-30', time:'16:41', type:'income',  cat:'副业', sub:'副业',   amount:200.00, account:'支付宝' },
  { id:'t0530d', date:'2024-05-30', time:'16:03', type:'expense', cat:'餐饮', sub:'三餐',   amount:45.00, account:'支付宝', offer:1.00 },
  { id:'t0530e', date:'2024-05-30', time:'09:16', type:'expense', cat:'交通', sub:'地铁',   amount:3.00, account:'中信银行', offer:2.00 },
  // —— 5月31日 ——
  { id:'t0531a', date:'2024-05-31', time:'14:20', type:'expense', cat:'运动', sub:'运动',   amount:60,   account:'中信银行', note:'羽毛球 🏸 广东奥林克体育馆' },
  { id:'t0531b', date:'2024-05-31', time:'11:05', type:'expense', cat:'餐饮', sub:'三餐',   amount:40,   account:'支付宝' },
  { id:'t0531c', date:'2024-05-31', time:'09:30', type:'income',  cat:'返款入账', sub:'返款', amount:2,   account:'支付宝' },
  // —— 6月1日 儿童节 ——
  { id:'t0601a', date:'2024-06-01', time:'10:15', type:'expense', cat:'娱乐', sub:'电影',   amount:72,   account:'中信银行' },
  { id:'t0601b', date:'2024-06-01', time:'12:40', type:'expense', cat:'餐饮', sub:'三餐',   amount:88,   account:'支付宝' },
];

/* 净资产趋势（5月1日 → 5月31日） */
const NETWORTH_SERIES = [
  41000,41200,41500,41800,42300,42600,42900,43100,43400,43700,
  44000,44200,44500,45100,45400,45600,45800,45900,46100,46300,
  46400,46500,46600,46700,46750,46800,46840,46880,46900,46910,46926.16
];
const TOTAL_ASSETS_SERIES = NETWORTH_SERIES.map(v=>v+70.90);
const DEBT_SERIES = NETWORTH_SERIES.map(()=>70.90);

/* 资产页快照数值 */
const ASSET_SNAPSHOT = { total:46997.06, debt:70.90, net:46926.16, fund:45817.06, recharge:180.00 };

/* 存钱计划 */
const PLANS = [
  {
    id:'plan1', name:'提前还房贷 🏠', mode:'flex', icon:'🏠', color:'#FF6D4D',
    tags:[{t:'灵活存钱',c:'orange'},{t:'2024年10月3日',c:''}],
    dateRange:'2022年3月3日 - 2024年10月3日', target:500000, saved:100000,
    cards:[]
  },
  {
    id:'plan2', name:'深造基金', mode:'fixed', icon:'📘', color:'#4D7BFE',
    tags:[{t:'定额存钱',c:'blue'},{t:'每月',c:''}],
    dateRange:'2023年3月1日 - 2025年3月1日', target:24000, saved:15000,
    cards:(()=>{ const arr=[]; const names=['3月1日','4月1日','5月1日','6月1日','7月1日','8月1日','9月1日','10月1日','11月1日','12月1日','1月1日','2月1日','3月1日','4月1日','5月1日']; const years=[2023,2023,2023,2023,2023,2023,2023,2023,2023,2023,2024,2024,2024,2024,2024]; names.forEach((n,i)=>arr.push({id:'c'+i, amount:1000, label:years[i]+'年'+n})); return arr; })()
  }
];

/* 月预算 */
const BUDGET = 3000;
