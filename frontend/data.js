// CURS — mock data (no React, plain JS, attached to window)
(function(){
  // ---------- Seeded RNG (Mulberry32) ----------
  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Date helpers ----------
  const today = new Date('2026-05-22T12:00:00Z');
  function daysAgo(n) { return new Date(today.getTime() - n*86400000); }
  function fmtDate(d) {
    return d.toISOString().slice(0,10);
  }

  // ---------- Generate price series (GBM with proper Box-Muller normal) ----------
  function genSeries(seed, days, start, mu, sigma) {
    const rnd = mulberry32(seed);
    function norm() {
      // Box-Muller
      const u1 = Math.max(1e-9, rnd());
      const u2 = rnd();
      return Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2);
    }
    const out = [];
    let px = start;
    for (let i = days-1; i >= 0; i--) {
      const z = norm();
      const r = mu/252 + sigma/Math.sqrt(252)*z;
      px = px * (1 + r);
      out.push({ d: daysAgo(i), v: px });
    }
    return out;
  }

  // ---------- Assets (universe) ----------
  // type: stock_ru, stock_us, bond, crypto, custom, etf
  const ASSETS = [
    { id: 'SBER', name: 'Сбербанк', type: 'stock_ru', sector: 'Финансы', region: 'RU', ccy: 'RUB', icon: 'asset-i-3',  cur: 332.40, seed: 11, start: 230, mu: 0.18, sigma: 0.28 },
    { id: 'GAZP', name: 'Газпром',  type: 'stock_ru', sector: 'Энергия',  region: 'RU', ccy: 'RUB', icon: 'asset-i-5', cur: 142.18, seed: 12, start: 165, mu: -0.08, sigma: 0.32 },
    { id: 'YNDX', name: 'Яндекс',   type: 'stock_ru', sector: 'IT',       region: 'RU', ccy: 'RUB', icon: 'asset-i-9', cur: 4318.0, seed: 13, start: 2900, mu: 0.32, sigma: 0.36 },
    { id: 'LKOH', name: 'Лукойл',   type: 'stock_ru', sector: 'Энергия',  region: 'RU', ccy: 'RUB', icon: 'asset-i-1', cur: 7416.0, seed: 14, start: 6800, mu: 0.10, sigma: 0.22 },
    { id: 'TCSG', name: 'TCS Group', type: 'stock_ru', sector: 'Финансы',  region: 'RU', ccy: 'RUB', icon: 'asset-i-8', cur: 3712.0, seed: 25, start: 2700, mu: 0.30, sigma: 0.30 },
    { id: 'AAPL', name: 'Apple',    type: 'stock_us', sector: 'IT',       region: 'US', ccy: 'USD', icon: 'asset-i-10', cur: 232.55, seed: 15, start: 175, mu: 0.20, sigma: 0.24 },
    { id: 'NVDA', name: 'NVIDIA',   type: 'stock_us', sector: 'IT',       region: 'US', ccy: 'USD', icon: 'asset-i-8', cur: 168.91, seed: 16, start: 64,  mu: 0.85, sigma: 0.42 },
    { id: 'MSFT', name: 'Microsoft', type: 'stock_us', sector: 'IT',       region: 'US', ccy: 'USD', icon: 'asset-i-5', cur: 478.60, seed: 26, start: 385, mu: 0.18, sigma: 0.22 },
    { id: 'BTC',  name: 'Bitcoin',  type: 'crypto',   sector: 'Crypto',   region: '—',  ccy: 'USD', icon: 'asset-i-4', cur: 96420,  seed: 17, start: 45000, mu: 0.55, sigma: 0.58 },
    { id: 'ETH',  name: 'Ethereum', type: 'crypto',   sector: 'Crypto',   region: '—',  ccy: 'USD', icon: 'asset-i-7', cur: 3215,   seed: 18, start: 2300, mu: 0.40, sigma: 0.65 },
    { id: 'OFZ26240', name: 'ОФЗ-26240', type: 'bond', sector: 'Облигации', region: 'RU', ccy: 'RUB', icon: 'asset-i-2', cur: 71.85, seed: 19, start: 65, mu: 0.10, sigma: 0.06 },
    { id: 'VTBR', name: 'VTB ETF Корп', type: 'etf', sector: 'Облигации', region: 'RU', ccy: 'RUB', icon: 'asset-i-6', cur: 113.25, seed: 27, start: 108, mu: 0.08, sigma: 0.05 },
    { id: 'FLAT_MSK', name: 'Квартира, Москва', type: 'custom', sector: 'Недвижимость', region: 'RU', ccy: 'RUB', icon: 'asset-i-6', cur: 14200000, seed: 20, start: 12500000, mu: 0.09, sigma: 0.05, custom: true },
  ];

  // pre-generate series (~ 365 days)
  const DAYS = 365;
  ASSETS.forEach(a => {
    a.series = genSeries(a.seed, DAYS, a.start, a.mu, a.sigma);
    // Rescale entire series so it ends exactly at a.cur (preserves walk shape, fixes single-day spikes)
    const lastSim = a.series[a.series.length-1].v;
    const scale = a.cur / lastSim;
    a.series = a.series.map(p => ({ d: p.d, v: p.v * scale }));
    // compute simple returns
    a.return = a.cur / a.start - 1;
  });

  // ---------- Portfolios ----------
  // qty, avgPrice
  const PORTFOLIOS = [
    {
      id: 'main', name: 'Основной', desc: 'Сбалансированный мультивалютный портфель',
      color: '#15140F',
      positions: [
        { asset: 'SBER', qty: 420,  avg: 245.0 },
        { asset: 'YNDX', qty: 14,   avg: 3200.0 },
        { asset: 'LKOH', qty: 26,   avg: 7100.0 },
        { asset: 'GAZP', qty: 1100, avg: 158.0 },
        { asset: 'AAPL', qty: 38,   avg: 184.5 },
        { asset: 'NVDA', qty: 95,   avg: 91.2 },
        { asset: 'BTC',  qty: 0.42, avg: 62400 },
        { asset: 'ETH',  qty: 4.1,  avg: 2640 },
        { asset: 'OFZ26240', qty: 850, avg: 69.4 },
        { asset: 'FLAT_MSK', qty: 1, avg: 12500000 },
      ]
    },
    {
      id: 'longterm', name: 'Долгосрочный', desc: 'Накопления и облигации',
      color: '#2F4858',
      positions: [
        { asset: 'OFZ26240', qty: 3400, avg: 68.0 },
        { asset: 'VTBR', qty: 1820, avg: 109.5 },
        { asset: 'LKOH', qty: 14,   avg: 6900 },
        { asset: 'TCSG', qty: 22,   avg: 3000 },
        { asset: 'MSFT', qty: 18,   avg: 380.0 },
      ]
    },
    {
      id: 'exp', name: 'Эксперимент', desc: 'Crypto + tech ставки',
      color: '#EE7544',
      positions: [
        { asset: 'BTC', qty: 0.18, avg: 73000 },
        { asset: 'ETH', qty: 6.0,  avg: 3100 },
        { asset: 'NVDA', qty: 24, avg: 132 },
        { asset: 'TCSG', qty: 18, avg: 3500 },
      ]
    },
  ];

  // ---------- USD/RUB rate (used to value USD assets in RUB) ----------
  const USD_RUB = 93.20;

  function valueOfPosition(p) {
    const a = ASSETS.find(x => x.id === p.asset);
    const ccy = a.ccy;
    const cur = a.cur;
    const valLocal = cur * p.qty;
    const valRUB = ccy === 'USD' ? valLocal * USD_RUB : valLocal;
    const cost = p.avg * p.qty;
    const costRUB = ccy === 'USD' ? cost * USD_RUB : cost;
    return {
      asset: a, qty: p.qty, avg: p.avg,
      ccy, valLocal, valRUB, cost, costRUB,
      pl: valRUB - costRUB,
      plPct: (valRUB - costRUB) / costRUB,
      // 1d change
      dayPct: (a.series[a.series.length-1].v / a.series[a.series.length-2].v) - 1
    };
  }

  function portfolioValue(p) {
    const positions = p.positions.map(valueOfPosition);
    const total = positions.reduce((s, x) => s + x.valRUB, 0);
    const totalCost = positions.reduce((s, x) => s + x.costRUB, 0);
    const dayPl = positions.reduce((s, x) => s + x.valRUB * x.dayPct, 0);
    return {
      ...p, positions, total, totalCost,
      pl: total - totalCost, plPct: (total - totalCost) / totalCost,
      dayPl, dayPct: dayPl / (total - dayPl)
    };
  }

  // Aggregate equity curve for portfolio across DAYS
  function portfolioSeries(p) {
    const days = DAYS;
    const out = new Array(days).fill(0).map((_,i)=>({ d: daysAgo(days - 1 - i), v: 0 }));
    p.positions.forEach(pos => {
      const a = ASSETS.find(x=>x.id===pos.asset);
      const factor = a.ccy === 'USD' ? USD_RUB : 1;
      for (let i=0;i<days;i++) {
        out[i].v += a.series[i].v * pos.qty * factor;
      }
    });
    return out;
  }
  PORTFOLIOS.forEach(p => { p.series = portfolioSeries(p); });

  // ---------- Transactions ----------
  const TX = [
    { id: 't1',  d: daysAgo(2),   type: 'buy',  asset: 'NVDA', qty: 15, price: 162.4, portfolio: 'main' },
    { id: 't2',  d: daysAgo(5),   type: 'div',  asset: 'SBER', qty: 420, price: 8.4, portfolio: 'main' },
    { id: 't3',  d: daysAgo(8),   type: 'buy',  asset: 'BTC',  qty: 0.05, price: 92800, portfolio: 'main' },
    { id: 't4',  d: daysAgo(14),  type: 'sell', asset: 'GAZP', qty: 200, price: 145.7, portfolio: 'main' },
    { id: 't5',  d: daysAgo(21),  type: 'buy',  asset: 'OFZ26240', qty: 200, price: 70.4, portfolio: 'longterm' },
    { id: 't6',  d: daysAgo(28),  type: 'in',   asset: 'RUB',  qty: 500000, price: 1, portfolio: 'main' },
    { id: 't7',  d: daysAgo(35),  type: 'buy',  asset: 'YNDX', qty: 4, price: 3850, portfolio: 'main' },
    { id: 't8',  d: daysAgo(42),  type: 'buy',  asset: 'AAPL', qty: 10, price: 198.0, portfolio: 'main' },
    { id: 't9',  d: daysAgo(56),  type: 'sell', asset: 'ETH',  qty: 1.5, price: 2980, portfolio: 'exp' },
    { id: 't10', d: daysAgo(64),  type: 'buy',  asset: 'TCSG', qty: 8, price: 3210, portfolio: 'longterm' },
    { id: 't11', d: daysAgo(75),  type: 'div',  asset: 'LKOH', qty: 26, price: 524, portfolio: 'main' },
    { id: 't12', d: daysAgo(90),  type: 'buy',  asset: 'NVDA', qty: 30, price: 102.5, portfolio: 'main' },
    { id: 't13', d: daysAgo(110), type: 'buy',  asset: 'BTC',  qty: 0.08, price: 67200, portfolio: 'main' },
    { id: 't14', d: daysAgo(140), type: 'buy',  asset: 'VTBR', qty: 820, price: 110.0, portfolio: 'longterm' },
    { id: 't15', d: daysAgo(168), type: 'in',   asset: 'USD',  qty: 4000, price: 90, portfolio: 'main' },
    { id: 't16', d: daysAgo(195), type: 'buy',  asset: 'OFZ26240', qty: 650, price: 69.0, portfolio: 'main' },
    { id: 't17', d: daysAgo(220), type: 'buy',  asset: 'SBER', qty: 100, price: 268, portfolio: 'main' },
    { id: 't18', d: daysAgo(260), type: 'buy',  asset: 'AAPL', qty: 12, price: 175.4, portfolio: 'main' },
    { id: 't19', d: daysAgo(290), type: 'buy',  asset: 'GAZP', qty: 500, price: 162, portfolio: 'main' },
    { id: 't20', d: daysAgo(340), type: 'in',   asset: 'RUB',  qty: 19500000, price: 1, portfolio: 'main', note: 'Покупка квартиры' },
  ];

  // ---------- Static metrics (kept for ease, not over-engineered) ----------
  // Per-portfolio aggregated metrics
  function metricsFor(p) {
    // Sharpe & vol approximate from daily returns of equity curve
    const s = p.series;
    const rets = [];
    for (let i=1;i<s.length;i++) rets.push(s[i].v/s[i-1].v - 1);
    const mean = rets.reduce((a,b)=>a+b,0)/rets.length;
    const variance = rets.reduce((a,b)=>a + (b-mean)*(b-mean), 0)/rets.length;
    const vol = Math.sqrt(variance) * Math.sqrt(252);
    const annRet = (s[s.length-1].v/s[0].v) - 1;
    const sharpe = (annRet - 0.07) / vol;
    // max drawdown
    let peak = s[0].v, maxDD = 0;
    s.forEach(pt => { if (pt.v > peak) peak = pt.v; const dd = (pt.v - peak)/peak; if (dd < maxDD) maxDD = dd; });
    return { vol, sharpe, annRet, maxDD };
  }
  PORTFOLIOS.forEach(p => p.metrics = metricsFor(p));

  // Correlation matrix among assets in main portfolio
  function corrMatrix(assetIds) {
    const seriesArr = assetIds.map(id => ASSETS.find(a=>a.id===id).series);
    // compute returns
    const rets = seriesArr.map(s => {
      const r = [];
      for (let i=1;i<s.length;i++) r.push(Math.log(s[i].v/s[i-1].v));
      return r;
    });
    function mean(a){ return a.reduce((s,x)=>s+x,0)/a.length; }
    function corr(a,b){
      const ma=mean(a), mb=mean(b);
      let num=0, da=0, db=0;
      for (let i=0;i<a.length;i++){
        num += (a[i]-ma)*(b[i]-mb);
        da += (a[i]-ma)**2;
        db += (b[i]-mb)**2;
      }
      return num / Math.sqrt(da*db);
    }
    const m = [];
    for (let i=0;i<rets.length;i++){
      const row = [];
      for (let j=0;j<rets.length;j++){
        row.push(corr(rets[i], rets[j]));
      }
      m.push(row);
    }
    return m;
  }

  // ---------- Currency formatting ----------
  function fmtRUB(v, opts = {}) {
    const { sign = false, compact = false, decimals = 0 } = opts;
    const abs = Math.abs(v);
    let str;
    if (compact && abs >= 1e6) {
      str = (v/1e6).toFixed(2).replace('.', ',') + ' млн';
    } else if (compact && abs >= 1e3) {
      str = (v/1e3).toFixed(1).replace('.', ',') + 'к';
    } else {
      str = Math.round(v * Math.pow(10, decimals))/Math.pow(10,decimals);
      str = str.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    const prefix = sign && v > 0 ? '+' : '';
    return prefix + str + ' ₽';
  }
  function fmtUSD(v, opts = {}) {
    const { sign = false, compact = false, decimals = 2 } = opts;
    let str;
    if (compact && Math.abs(v) >= 1e6) str = (v/1e6).toFixed(2) + 'M';
    else str = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (sign && v > 0 ? '+' : '') + '$' + str;
  }
  function fmtPct(v, opts = {}) {
    const { sign = true, decimals = 2 } = opts;
    const x = (v*100).toFixed(decimals).replace('.', ',');
    return (sign && v > 0 ? '+' : '') + x + '%';
  }
  function fmtCcy(v, ccy, opts = {}) {
    if (ccy === 'RUB') return fmtRUB(v, opts);
    if (ccy === 'USD') return fmtUSD(v, opts);
    return v.toFixed(2);
  }

  window.CURS_DATA = {
    today, daysAgo, fmtDate,
    ASSETS, PORTFOLIOS, TX, USD_RUB, DAYS,
    valueOfPosition, portfolioValue, corrMatrix,
    fmtRUB, fmtUSD, fmtPct, fmtCcy
  };
})();
