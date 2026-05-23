// CURS — Analytics + Compare + Transactions screens
const { useState: anUseState, useMemo: anUseMemo } = React;

// ============================================
// Analytics screen — Frontier, Monte Carlo, Correlation
// ============================================
function AnalyticsScreen({ portfolio, allPortfolios, onOpenPosition }) {
  const [tab, setTab] = anUseState('frontier');
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="row gap-sm" style={{marginBottom: 6}}>
            <span className="pill solid">EBF · evidence-based finance</span>
            <span className="pill ghost">Modern Portfolio Theory</span>
          </div>
          <div className="title">Аналитика</div>
          <div className="sub">Эффективная граница, симуляции и матрицы корреляций для портфеля «{portfolio.name}»</div>
        </div>
        <div className="right">
          <select className="btn" style={{padding: '0 10px'}}>
            {allPortfolios.map(p => <option key={p.id}>{p.name}</option>)}
          </select>
          <button className="btn">{CURS_UI.I.dl()}<span>Скачать отчёт</span></button>
        </div>
      </div>

      <div className="row gap-sm" style={{marginBottom: 18}}>
        <div className="tabs">
          {[
            ['frontier', 'Эффективная граница'],
            ['montecarlo', 'Монте-Карло'],
            ['correlation', 'Корреляции'],
            ['risk', 'Риск-метрики'],
          ].map(([k, l]) => (
            <div key={k} className={'tab ' + (tab === k ? 'active':'')} onClick={() => setTab(k)}>{l}</div>
          ))}
        </div>
      </div>

      {tab === 'frontier' && <FrontierTab portfolio={portfolio} />}
      {tab === 'montecarlo' && <MonteCarloTab portfolio={portfolio} />}
      {tab === 'correlation' && <CorrelationTab portfolio={portfolio} />}
      {tab === 'risk' && <RiskMetricsTab portfolio={portfolio} />}
    </div>
  );
}

function FrontierTab({ portfolio }) {
  const [riskAversion, setRiskAversion] = anUseState(0.5);

  // Generate cloud of random portfolios and a frontier curve
  const { cloud, frontier, current, optimal, minvar } = anUseMemo(() => {
    // base data: 5-6 main assets
    const ids = portfolio.positions.slice(0, 6).map(p => p.asset);
    const assets = ids.map(id => CURS_DATA.ASSETS.find(a => a.id === id));
    // compute mu, sigma per asset (annualized)
    const mus = assets.map(a => a.mu);
    const sigmas = assets.map(a => a.sigma);
    function mulberry(s) {
      return function() {
        s += 0x6D2B79F5; let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rnd = mulberry(99);
    const cloud = [];
    // random weights
    for (let i = 0; i < 600; i++) {
      const w = assets.map(() => rnd());
      const s = w.reduce((a,b)=>a+b, 0);
      const ww = w.map(x => x/s);
      let mu = 0, sig2 = 0;
      for (let j=0;j<ww.length;j++){ mu += ww[j]*mus[j]; }
      // approximate variance: sum w_i^2 sigma_i^2 + cross terms; we fake correlation 0.3
      for (let j=0;j<ww.length;j++){
        for (let k=0;k<ww.length;k++){
          const rho = j===k ? 1 : 0.3;
          sig2 += ww[j]*ww[k]*sigmas[j]*sigmas[k]*rho;
        }
      }
      cloud.push({ risk: Math.sqrt(sig2), ret: mu });
    }
    // build frontier as upper envelope: for each risk bin, max return
    const bins = 40;
    const minR = Math.min(...cloud.map(p=>p.risk));
    const maxR = Math.max(...cloud.map(p=>p.risk));
    const frontier = [];
    for (let i=0;i<bins;i++){
      const r0 = minR + (maxR-minR)*i/bins;
      const r1 = minR + (maxR-minR)*(i+1)/bins;
      const sub = cloud.filter(p => p.risk >= r0 && p.risk < r1);
      if (sub.length === 0) continue;
      const best = sub.reduce((acc, p) => p.ret > acc.ret ? p : acc, sub[0]);
      frontier.push(best);
    }
    frontier.sort((a,b) => a.risk - b.risk);
    // smoothing
    const sm = frontier.filter((p,i) => i === 0 || p.ret >= frontier[i-1].ret);
    // current portfolio:
    const totalCost = portfolio.positions.reduce((s,p) => s + p.qty * p.avg, 0);
    let curMu = portfolio.metrics.annRet;
    let curSig = portfolio.metrics.vol;
    const current = { risk: curSig, ret: curMu };
    // max sharpe (highest (ret-0.07)/risk)
    let bestSharpe = -Infinity, optimal = sm[0];
    sm.forEach(p => { const sh = (p.ret - 0.07)/p.risk; if (sh > bestSharpe) { bestSharpe = sh; optimal = p; } });
    // min variance
    const minvar = sm.reduce((acc, p) => p.risk < acc.risk ? p : acc, sm[0]);
    return { cloud, frontier: sm, current, optimal, minvar };
  }, [portfolio.id]);

  // Recommended portfolio (interpolated along frontier by risk aversion)
  const recommended = frontier[Math.round(riskAversion * (frontier.length-1))] || frontier[0];

  return (
    <>
      <div className="grid" style={{gridTemplateColumns: '2fr 1fr', marginBottom: 22}}>
        <div className="card">
          <div className="row between" style={{marginBottom: 14}}>
            <div>
              <h3 className="section-title lg">Эффективная граница</h3>
              <div className="mini">Каждая точка — портфель с уникальным распределением. Граница — лучшая доходность для каждого уровня риска.</div>
            </div>
            <div className="pill">σ × E(R) · 600 портфелей</div>
          </div>
          <CURS_CHARTS.FrontierChart portfolios={cloud} frontier={frontier} current={current} optimal={optimal} minvar={minvar} height={400} />
        </div>

        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 8}}>Профиль риска</h3>
          <div className="mini" style={{marginBottom: 14}}>Сдвиньте, чтобы найти портфель на границе под вашу терпимость к риску.</div>

          <div className="col" style={{gap: 14, marginBottom: 18}}>
            <div className="row between" style={{fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)', letterSpacing: '0.05em'}}>
              <span>Консерв.</span><span>Умерен.</span><span>Агрессивн.</span>
            </div>
            <input type="range" min="0" max="100" value={riskAversion*100} onChange={e=>setRiskAversion(+e.target.value/100)} style={{width: '100%'}}/>
          </div>

          <div className="card flat">
            <div className="mini" style={{marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em'}}>Рекомендация</div>
            <div className="row between" style={{marginBottom: 10}}>
              <div className="col" style={{gap: 2}}>
                <div className="mini">Ожид. доходность</div>
                <div className="mono" style={{fontSize: 22, fontWeight: 600, color: 'var(--up)'}}>{(recommended.ret*100).toFixed(1).replace('.', ',')}%</div>
              </div>
              <div className="col" style={{gap: 2}}>
                <div className="mini">Риск (σ)</div>
                <div className="mono" style={{fontSize: 22, fontWeight: 600}}>{(recommended.risk*100).toFixed(1).replace('.', ',')}%</div>
              </div>
            </div>
            <div className="hairline" style={{margin: '10px 0'}}></div>
            <div className="row between mini">
              <span>Sharpe ≈ <strong>{((recommended.ret - 0.07)/recommended.risk).toFixed(2)}</strong></span>
              <button className="btn sm primary">Применить веса</button>
            </div>
          </div>

          <div className="hairline" style={{margin: '22px 0'}}></div>

          <h4 className="section-title" style={{marginBottom: 10}}>Опорные портфели</h4>
          <div className="col" style={{gap: 8}}>
            <RefPoint label="Текущий" ret={current.ret} risk={current.risk} color="#EE7544" />
            <RefPoint label="Max Sharpe" ret={optimal.ret} risk={optimal.risk} color="#D7E041" outline />
            <RefPoint label="Min Variance" ret={minvar.ret} risk={minvar.risk} color="#fff" outline />
          </div>
        </div>
      </div>

      {/* Assumed allocation — weights bar */}
      <div className="card">
        <div className="row between" style={{marginBottom: 14}}>
          <h3 className="section-title lg">Текущее распределение vs. оптимальное</h3>
          <span className="pill warn">Рекомендуется ребалансировка</span>
        </div>
        <WeightsCompare portfolio={portfolio} />
      </div>
    </>
  );
}

function RefPoint({ label, ret, risk, color, outline }) {
  return (
    <div className="row between" style={{padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', gap: 8}}>
      <div className="row gap-sm" style={{minWidth: 0}}>
        <span style={{width: 12, height: 12, borderRadius: '50%', background: color, border: outline ? '1.5px solid var(--ink)' : 'none', flexShrink: 0}}></span>
        <span style={{fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap'}}>{label}</span>
      </div>
      <span className="kvalue" style={{fontSize: 11, whiteSpace: 'nowrap'}}>
        {(ret*100).toFixed(1).replace('.', ',')}% / σ {(risk*100).toFixed(1).replace('.', ',')}%
      </span>
    </div>
  );
}

function WeightsCompare({ portfolio }) {
  const pv = CURS_DATA.portfolioValue(portfolio);
  const total = pv.total;
  const items = pv.positions.slice().sort((a,b)=>b.valRUB-a.valRUB).map((p, i) => {
    const cur = p.valRUB / total;
    // Fake "optimal" weight
    const opt = Math.max(0.05, cur + (Math.sin(i*1.7)*0.05));
    return { id: p.asset.id, name: p.asset.name, cur, opt: Math.min(0.35, opt), color: ['#15140F','#2F4858','#86B0A0','#D7E041','#EE7544','#4F6BED','#B58300','#8C5BD7','#1F8F6F','#C0392B'][i % 10] };
  });
  return (
    <div className="col" style={{gap: 10}}>
      <div className="row mini" style={{padding: '0 12px', fontSize: 11}}>
        <span style={{width: 110}}>Актив</span>
        <span style={{width: 80}}>Текущее</span>
        <span style={{flex: 1}}></span>
        <span style={{width: 80, textAlign: 'right'}}>Оптимум</span>
        <span style={{width: 80, textAlign: 'right'}}>Δ</span>
      </div>
      {items.map((it, i) => {
        const diff = it.opt - it.cur;
        const max = 0.35;
        return (
          <div key={i} className="row" style={{alignItems: 'center', gap: 10}}>
            <span style={{width: 110, fontFamily: 'var(--mono)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center'}}>
              <span style={{width: 8, height: 8, borderRadius: 2, background: it.color}}></span>
              {it.id}
            </span>
            <span className="kvalue" style={{width: 80, fontSize: 12}}>{(it.cur*100).toFixed(1).replace('.', ',')}%</span>
            <div style={{flex: 1, height: 18, background: 'var(--surface-2)', borderRadius: 4, position: 'relative', display: 'flex'}}>
              <div style={{width: (it.cur/max*100)+'%', background: it.color, opacity: 0.4, height: '100%', borderRadius: '4px 0 0 4px'}}></div>
              <div style={{position: 'absolute', left: (it.opt/max*100)+'%', top: -2, bottom: -2, width: 2, background: 'var(--ink)'}}></div>
            </div>
            <span className="kvalue" style={{width: 80, fontSize: 12, textAlign: 'right'}}>{(it.opt*100).toFixed(1).replace('.', ',')}%</span>
            <span className="kvalue" style={{width: 80, fontSize: 12, textAlign: 'right', color: diff >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 600}}>
              {diff >= 0 ? '+' : ''}{(diff*100).toFixed(1).replace('.', ',')} п.п.
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Monte Carlo tab
// ============================================
function MonteCarloTab({ portfolio }) {
  const [horizon, setHorizon] = anUseState(252);
  const [nSims, setNSims] = anUseState(500);
  const [targetGrowth, setTargetGrowth] = anUseState(1.30);

  const result = anUseMemo(() => {
    const startV = portfolio.series[portfolio.series.length-1].v;
    const mu = portfolio.metrics.annRet;
    const sigma = portfolio.metrics.vol;
    function mulberry(s) {
      return function() {
        s += 0x6D2B79F5; let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rnd = mulberry(42);
    function norm() {
      const u = Math.max(1e-9, rnd()), v = rnd();
      return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
    }
    const paths = [];
    for (let s=0; s<nSims; s++) {
      const path = [startV];
      let px = startV;
      for (let t=1; t<horizon; t++) {
        const z = norm();
        const r = mu/252 + sigma/Math.sqrt(252)*z;
        px = px * (1 + r);
        path.push(px);
      }
      paths.push(path);
    }
    const finalVals = paths.map(p => p[p.length-1]).sort((a,b)=>a-b);
    function percentile(arr, p) { return arr[Math.floor(arr.length * p)]; }
    const pcts = { p10:[], p25:[], p50:[], p75:[], p90:[] };
    for (let t=0; t<horizon; t++) {
      const col = paths.map(p => p[t]).sort((a,b)=>a-b);
      pcts.p10.push(percentile(col, 0.10));
      pcts.p25.push(percentile(col, 0.25));
      pcts.p50.push(percentile(col, 0.50));
      pcts.p75.push(percentile(col, 0.75));
      pcts.p90.push(percentile(col, 0.90));
    }
    const target = startV * targetGrowth;
    const probTarget = finalVals.filter(v => v >= target).length / finalVals.length;
    return { paths, percentiles: pcts, startV, target, probTarget, finalVals };
  }, [portfolio.id, horizon, nSims, targetGrowth]);

  return (
    <>
      <div className="grid" style={{gridTemplateColumns: '2fr 1fr', marginBottom: 22}}>
        <div className="card">
          <div className="row between" style={{marginBottom: 14}}>
            <div>
              <h3 className="section-title lg">Симуляция Монте-Карло</h3>
              <div className="mini">Стохастические траектории стоимости портфеля на основе исторической доходности и волатильности</div>
            </div>
            <div className="pill">{nSims} сценариев · {Math.round(horizon/21)} мес</div>
          </div>
          <CURS_CHARTS.MonteCarloFan paths={result.paths} percentiles={result.percentiles} days={horizon} startValue={result.startV} target={result.target} height={360} />
          <div className="hairline" style={{margin: '14px 0'}}></div>
          <div className="row gap-md" style={{flexWrap: 'wrap'}}>
            <Legend color="#15140F" label="Медиана (p50)" />
            <Legend color="rgba(21,20,15,.30)" square label="50% диапазон (p25–p75)" />
            <Legend color="rgba(21,20,15,.16)" square label="80% диапазон (p10–p90)" />
            <Legend color="#EE7544" dashed label="Целевая стоимость" />
          </div>
        </div>

        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 16}}>Параметры</h3>

          <div className="col" style={{gap: 14, marginBottom: 18}}>
            <ParamSlider label="Горизонт" value={horizon} setValue={setHorizon} min={63} max={1260} step={21} format={v => `${Math.round(v/21)} мес`} />
            <ParamSlider label="Симуляций" value={nSims} setValue={setNSims} min={100} max={2000} step={100} format={v => v.toLocaleString('ru-RU')} />
            <ParamSlider label="Целевой рост" value={targetGrowth} setValue={setTargetGrowth} min={1.05} max={2.5} step={0.05} format={v => `× ${v.toFixed(2)}`} />
          </div>

          <div className="hairline" style={{margin: '8px 0 18px'}}></div>

          <h4 className="section-title" style={{marginBottom: 12}}>Результаты</h4>
          <div className="col" style={{gap: 12}}>
            <ResultRow label="Вероятность достичь цели" value={(result.probTarget*100).toFixed(1)+'%'} tone={result.probTarget > 0.5 ? 'up' : 'down'} />
            <ResultRow label="Ожидаемая стоимость (медиана)" value={CURS_CHARTS.fmtMoneyCompact(result.percentiles.p50[result.percentiles.p50.length-1]) + ' ₽'} mask />
            <ResultRow label="Пессимистичный сценарий (p10)" value={CURS_CHARTS.fmtMoneyCompact(result.percentiles.p10[result.percentiles.p10.length-1]) + ' ₽'} tone="down" mask />
            <ResultRow label="Оптимистичный (p90)" value={CURS_CHARTS.fmtMoneyCompact(result.percentiles.p90[result.percentiles.p90.length-1]) + ' ₽'} tone="up" mask />
            <ResultRow label="VaR 5% (макс. потери)" value={(((result.percentiles.p10[result.percentiles.p10.length-1]/result.startV)-1)*100).toFixed(1)+'%'} tone="down" />
          </div>

          <div className="hairline" style={{margin: '18px 0'}}></div>

          <div className="mini" style={{lineHeight: 1.5}}>
            <strong style={{color: 'var(--ink)'}}>μ = {(portfolio.metrics.annRet*100).toFixed(1).replace('.', ',')}%</strong>, <strong style={{color: 'var(--ink)'}}>σ = {(portfolio.metrics.vol*100).toFixed(1).replace('.', ',')}%</strong> — рассчитаны на исторических логарифмических доходностях за 12 мес.
          </div>
        </div>
      </div>

      {/* Distribution of final values */}
      <div className="card">
        <div className="row between" style={{marginBottom: 14}}>
          <h3 className="section-title lg">Распределение итоговой стоимости</h3>
          <span className="pill ghost">гистограмма · {nSims} наблюдений</span>
        </div>
        <Histogram values={result.finalVals} bins={40} target={result.target} startValue={result.startV} />
      </div>
    </>
  );
}

function ParamSlider({ label, value, setValue, min, max, step, format }) {
  return (
    <div className="col" style={{gap: 6}}>
      <div className="row between">
        <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>{label}</span>
        <span className="kvalue">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => setValue(+e.target.value)} style={{width: '100%'}} />
    </div>
  );
}

function ResultRow({ label, value, tone, mask }) {
  const color = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--ink)';
  return (
    <div className="row between" style={{padding: '4px 0'}}>
      <span className="mini">{label}</span>
      <span className={'kvalue ' + (mask ? 'mask' : '')} style={{color, fontWeight: 600, fontSize: 14}}>{value}</span>
    </div>
  );
}

function Legend({ color, label, dashed, square }) {
  return (
    <span className="row gap-sm mini">
      {square
        ? <span style={{width: 14, height: 10, background: color, borderRadius: 2}}></span>
        : dashed
          ? <span style={{width: 14, height: 1, borderBottom: '1.5px dashed '+color}}></span>
          : <span style={{width: 14, height: 2, background: color, borderRadius: 1}}></span>}
      <span>{label}</span>
    </span>
  );
}

function Histogram({ values, bins, target, startValue }) {
  const { useRef, useState, useEffect } = React;
  const wrapRef = useRef(null);
  const [w, setW] = useState(700);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(300, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  const height = 200;
  const min = Math.min(...values), max = Math.max(...values);
  const counts = new Array(bins).fill(0);
  values.forEach(v => {
    const idx = Math.min(bins-1, Math.floor((v - min)/(max - min) * bins));
    counts[idx]++;
  });
  const maxCount = Math.max(...counts);
  const padT = 12, padB = 28, padL = 0;
  const innerH = height - padT - padB;
  const barW = (w - padL) / bins;
  const xOfVal = v => padL + (v - min)/(max - min) * (w - padL);

  return (
    <div ref={wrapRef} style={{width: '100%'}}>
      <svg width={w} height={height}>
        {counts.map((c, i) => {
          const x = padL + i*barW;
          const h = (c/maxCount) * innerH;
          const center = min + (i+0.5)/bins * (max-min);
          const positive = center >= startValue;
          return (
            <rect key={i} x={x+1} y={padT + innerH - h} width={barW-2} height={h}
                  fill={positive ? 'var(--up-soft)' : 'var(--down-soft)'} />
          );
        })}
        {/* baseline at start value */}
        <line x1={xOfVal(startValue)} x2={xOfVal(startValue)} y1={padT} y2={padT+innerH} stroke="#15140F" strokeWidth="1.5" />
        <text x={xOfVal(startValue)+5} y={padT+10} fontSize="10" fontWeight="600" fill="#15140F">Старт</text>
        {/* target */}
        <line x1={xOfVal(target)} x2={xOfVal(target)} y1={padT} y2={padT+innerH} stroke="#EE7544" strokeWidth="1.5" strokeDasharray="4 4" />
        <text x={xOfVal(target)+5} y={padT+22} fontSize="10" fontWeight="600" fill="#EE7544">Цель</text>
        {/* x labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const v = min + (max-min)*t;
          return <text key={i} x={padL + t*(w-padL)} y={height-8} textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'} fontSize="10" fill="#807D74" fontFamily="var(--mono)">{CURS_CHARTS.fmtMoneyCompact(v)} ₽</text>;
        })}
      </svg>
    </div>
  );
}

// ============================================
// Correlation tab
// ============================================
function CorrelationTab({ portfolio }) {
  const ids = portfolio.positions.map(p => p.asset);
  const matrix = anUseMemo(() => CURS_DATA.corrMatrix(ids), [ids.join(',')]);
  // find most correlated and uncorrelated pairs
  const pairs = [];
  for (let i=0;i<ids.length;i++)
    for (let j=i+1;j<ids.length;j++)
      pairs.push({ a: ids[i], b: ids[j], v: matrix[i][j] });
  const topCorr = pairs.slice().sort((a,b)=>b.v - a.v).slice(0,3);
  const lowCorr = pairs.slice().sort((a,b)=>a.v - b.v).slice(0,3);
  return (
    <>
      <div className="grid" style={{gridTemplateColumns: '2fr 1fr', marginBottom: 22}}>
        <div className="card">
          <div className="row between" style={{marginBottom: 14}}>
            <div>
              <h3 className="section-title lg">Матрица корреляций</h3>
              <div className="mini">Логарифмические доходности · диапазон от −1 до +1</div>
            </div>
            <div className="row gap-sm">
              <span className="pill ghost">Pearson · 252Д</span>
            </div>
          </div>
          <CURS_CHARTS.Heatmap labels={ids} matrix={matrix} size={36} />
          <div className="hairline" style={{margin: '16px 0 10px'}}></div>
          <div className="row gap-md mini" style={{flexWrap: 'wrap'}}>
            <span className="row gap-sm"><span style={{width: 16, height: 10, background: 'rgb(192,57,43)', borderRadius: 2}}></span>+1.0 (полная связь)</span>
            <span className="row gap-sm"><span style={{width: 16, height: 10, background: 'rgb(247,244,238)', borderRadius: 2, border: '1px solid var(--hairline)'}}></span>0.0 (независимы)</span>
            <span className="row gap-sm"><span style={{width: 16, height: 10, background: 'rgb(47,125,67)', borderRadius: 2}}></span>−1.0 (антикорреляция)</span>
          </div>
        </div>

        <div className="col" style={{gap: 22}}>
          <div className="card">
            <h3 className="section-title lg" style={{marginBottom: 12}}>Самые связанные</h3>
            <div className="col" style={{gap: 8}}>
              {topCorr.map((p, i) => (
                <PairRow key={i} a={p.a} b={p.b} v={p.v} max={1} />
              ))}
            </div>
            <div className="mini" style={{marginTop: 10, padding: 10, background: 'var(--down-soft)', borderRadius: 6, color: 'var(--down-ink)'}}>
              ⚠ Высокая корреляция снижает эффект диверсификации. Рассмотрите альтернативные классы активов.
            </div>
          </div>
          <div className="card">
            <h3 className="section-title lg" style={{marginBottom: 12}}>Лучшие диверсификаторы</h3>
            <div className="col" style={{gap: 8}}>
              {lowCorr.map((p, i) => (
                <PairRow key={i} a={p.a} b={p.b} v={p.v} max={1} good />
              ))}
            </div>
            <div className="mini" style={{marginTop: 10, padding: 10, background: 'var(--up-soft)', borderRadius: 6, color: 'var(--up-ink)'}}>
              ✓ Слабая или отрицательная корреляция этих пар улучшает структуру портфеля.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PairRow({ a, b, v, max, good }) {
  const aA = CURS_DATA.ASSETS.find(x=>x.id===a);
  const aB = CURS_DATA.ASSETS.find(x=>x.id===b);
  return (
    <div className="row between" style={{padding: '8px 0', borderBottom: '1px solid var(--hairline-2)'}}>
      <div className="row gap-sm">
        <CURS_UI.AssetIcon asset={aA} size={24} />
        <span style={{fontSize: 12, color: 'var(--ink-3)'}}>×</span>
        <CURS_UI.AssetIcon asset={aB} size={24} />
        <span style={{fontSize: 12, fontFamily: 'var(--mono)', marginLeft: 4}}>{a} × {b}</span>
      </div>
      <span className="kvalue" style={{color: good ? 'var(--up)' : 'var(--down)', fontSize: 14, fontWeight: 600}}>ρ = {v.toFixed(2)}</span>
    </div>
  );
}

// ============================================
// Risk metrics tab
// ============================================
function RiskMetricsTab({ portfolio }) {
  const m = portfolio.metrics;
  return (
    <div className="grid grid-2" style={{gap: 22}}>
      <div className="card">
        <h3 className="section-title lg" style={{marginBottom: 16}}>Профиль доходности</h3>
        <div className="col" style={{gap: 10}}>
          <BigStat label="Годовая доходность" value={(m.annRet*100).toFixed(2).replace('.', ',')+'%'} tone="up" hint="CAGR за 1 год" />
          <BigStat label="Волатильность (σ)" value={(m.vol*100).toFixed(2).replace('.', ',')+'%'} hint="стандартное отклонение, годовое" />
          <BigStat label="Sharpe Ratio" value={m.sharpe.toFixed(2)} hint="(R−Rf)/σ, Rf = 7%" tone={m.sharpe > 1 ? 'up' : 'neutral'} />
          <BigStat label="Sortino Ratio" value={(m.sharpe * 1.18).toFixed(2)} hint="только отриц. волатильность" tone="up" />
          <BigStat label="Information Ratio" value={(m.sharpe * 0.74).toFixed(2)} hint="избыточная доходность над IMOEX / TE" />
          <BigStat label="Beta (β)" value="0,82" hint="чувствительность к бенчмарку" />
        </div>
      </div>
      <div className="card">
        <h3 className="section-title lg" style={{marginBottom: 16}}>Просадки</h3>
        <CURS_CHARTS.DrawdownChart series={portfolio.series} height={200} />
        <div className="hairline" style={{margin: '14px 0'}}></div>
        <div className="col" style={{gap: 10}}>
          <BigStat label="Max Drawdown" value={(m.maxDD*100).toFixed(2).replace('.', ',')+'%'} tone="down" hint="наибольшее падение с пика" />
          <BigStat label="Calmar Ratio" value={(m.annRet/Math.abs(m.maxDD)).toFixed(2)} hint="доходность / макс. просадка" tone="up" />
          <BigStat label="VaR 95% дневной" value="−2,8%" tone="down" hint="макс. ожидаемая потеря в обычный день" />
          <BigStat label="CVaR 95%" value="−4,1%" tone="down" hint="средний хвостовой риск" />
        </div>
        <div className="hairline" style={{margin: '14px 0'}}></div>
        <div className="row gap-md mini">
          <span className="row gap-sm"><span style={{width: 6, height: 6, borderRadius: '50%', background: 'var(--up)'}}></span>Лучший день: <strong style={{color: 'var(--ink)'}}>+3,8%</strong></span>
          <span className="row gap-sm"><span style={{width: 6, height: 6, borderRadius: '50%', background: 'var(--down)'}}></span>Худший день: <strong style={{color: 'var(--ink)'}}>−2,9%</strong></span>
          <span style={{marginLeft: 'auto'}}>Положит. дней: <strong style={{color: 'var(--ink)'}}>54%</strong></span>
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, tone, hint }) {
  const color = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--ink)';
  return (
    <div className="row between" style={{padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10}}>
      <div className="col" style={{gap: 2}}>
        <div style={{fontSize: 13, fontWeight: 500}}>{label}</div>
        {hint && <div className="mini">{hint}</div>}
      </div>
      <div className="mono" style={{fontSize: 22, fontWeight: 600, color, letterSpacing: '-0.02em'}}>{value}</div>
    </div>
  );
}

window.CURS_ANALYTICS = { AnalyticsScreen };
