// CURS — Dashboard screen
const { useState: dsUseState, useMemo: dsUseMemo } = React;

function Dashboard({ portfolios, baseCcy, onOpenPosition }) {
  const [range, setRange] = dsUseState('1Г');
  const [showCompare, setShowCompare] = dsUseState(true);
  const days = CURS_UI.RANGE_DAYS[range];
  const { LineAreaChart, Sparkline, Treemap, Donut, BarChart, fmtMoneyCompact } = CURS_CHARTS;
  const { fmtRUB, fmtPct } = CURS_DATA;

  // Aggregate ALL portfolios into "total"
  const agg = dsUseMemo(() => {
    const totalSeries = portfolios[0].series.map((p, i) => {
      let sum = 0;
      portfolios.forEach(pf => { sum += pf.series[i].v; });
      return { d: p.d, v: sum };
    });
    let total = 0, totalCost = 0;
    const allPos = [];
    portfolios.forEach(pf => {
      const pv = CURS_DATA.portfolioValue(pf);
      total += pv.total;
      totalCost += pv.totalCost;
      pv.positions.forEach(po => allPos.push({...po, portfolio: pf.id, portfolioName: pf.name, color: pf.color}));
    });
    return { totalSeries, total, totalCost, allPos };
  }, [portfolios]);

  const lastN = agg.totalSeries.slice(-days);
  const startV = lastN[0].v, endV = lastN[lastN.length-1].v;
  const rangeDelta = endV - startV;
  const rangeDeltaPct = (endV - startV) / startV;

  // Treemap data: positions, sorted, top 12
  const treemapItems = agg.allPos
    .slice().sort((a,b) => b.valRUB - a.valRUB)
    .slice(0, 12)
    .map((p, i) => ({
      label: p.asset.id,
      value: p.valRUB,
      share: (p.valRUB/agg.total*100).toFixed(1).replace('.', ',') + '%',
      color: ['#15140F','#2F4858','#86B0A0','#D7E041','#EE7544','#4F6BED','#B58300','#8C5BD7','#1F8F6F','#C0392B','#4A4842','#B5B1A6'][i],
    }));

  // Top movers (24h) — dedupe by asset id
  const seenAssets = new Set();
  const dedupAllPos = agg.allPos.filter(p => {
    if (seenAssets.has(p.asset.id)) return false;
    seenAssets.add(p.asset.id);
    return true;
  });
  const movers = dedupAllPos.slice().sort((a,b) => Math.abs(b.dayPct) - Math.abs(a.dayPct)).slice(0, 5);
  const losers = agg.allPos.slice().sort((a,b) => a.plPct - b.plPct).slice(0, 3);
  const winners = agg.allPos.slice().sort((a,b) => b.plPct - a.plPct).slice(0, 3);

  // P&L decomposition (top contributors)
  const plDecomp = agg.allPos.slice().sort((a,b) => Math.abs(b.pl) - Math.abs(a.pl)).slice(0, 9).map(p => ({
    label: p.asset.id,
    value: p.pl,
  }));
  const positivePL = plDecomp.filter(p => p.value > 0).reduce((s,p) => s+p.value, 0);
  const negativePL = plDecomp.filter(p => p.value < 0).reduce((s,p) => s+p.value, 0);

  // Asset class breakdown
  const byClass = {};
  agg.allPos.forEach(p => {
    const k = p.asset.type;
    byClass[k] = (byClass[k] || 0) + p.valRUB;
  });
  const classMap = { stock_ru: 'Акции RU', stock_us: 'Зарубеж. акции', bond: 'Облигации', etf: 'ETF', crypto: 'Крипто', custom: 'Альт. активы' };
  const classColorMap = {
    stock_ru: '#15140F', stock_us: '#4F6BED', bond: '#86B0A0', etf: '#1F8F6F', crypto: '#EE7544', custom: '#B58300'
  };
  const allocItems = Object.entries(byClass).sort((a,b)=>b[1]-a[1]).map(([k,v]) => ({
    label: classMap[k] || k, value: v, color: classColorMap[k] || '#B5B1A6',
    share: (v/agg.total*100).toFixed(1).replace('.', ',') + '%'
  }));

  // Recent transactions
  const recentTx = CURS_DATA.TX.slice(0, 6);

  return (
    <div className="content">
      {/* Hero */}
      <div className="hero" style={{marginBottom: 22}}>
        <div className="left">
          <div className="eyebrow"><span className="dot"></span>Совокупный портфель · обновлено только что</div>
          <div className="value-row">
            <h1 className="mask">{fmtRUB(agg.total).replace(' ₽', '')}</h1>
            <span className="currency-sym">₽</span>
          </div>
          <div className="delta-row">
            <span className={'delta-chip ' + (rangeDeltaPct >= 0 ? 'up' : 'down')}>
              {rangeDeltaPct >= 0 ? '↑' : '↓'} {(Math.abs(rangeDeltaPct)*100).toFixed(2).replace('.', ',')}%
              <span style={{opacity:.7}} className="mask">{rangeDeltaPct >= 0 ? '+' : '−'}{fmtMoneyCompact(Math.abs(rangeDelta))} ₽</span>
            </span>
            <span className="delta-chip">за {range}</span>
            <span style={{color: 'rgba(255,255,255,.45)', fontFamily: 'var(--mono)', fontSize: 12}}>
              против бенчмарка IMOEX: <span style={{color: '#B8E5B8'}}>+4,3 п.п.</span>
            </span>
          </div>
          <div style={{display: 'flex', gap: 28, marginTop: 32, flexWrap: 'wrap'}}>
            <Stat label="Стоимость покупок" value={fmtRUB(agg.totalCost, { compact: true })} sub="базис" privacy />
            <Stat label="Реализованный P&L" value="+312,4к ₽" sub="за период" />
            <Stat label="Дивиденды" value="+58,1к ₽" sub="LTM" />
            <Stat label="Позиций" value={agg.allPos.length.toString()} sub={portfolios.length + ' портфеля'} />
          </div>
        </div>

        <div className="right">
          <div className="row between" style={{marginBottom: 14, gap: 12, flexWrap: 'wrap'}}>
            <div style={{fontSize: 12, color: 'rgba(255,255,255,.6)', whiteSpace: 'nowrap'}}>Динамика всех портфелей</div>
            <RangeTabsDark value={range} onChange={setRange} />
          </div>
          <DarkChart series={lastN} compareSeries={null} />
          <div className="row" style={{marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,.55)', gap: 14, flexWrap: 'wrap'}}>
            <span className="row gap-sm" style={{whiteSpace: 'nowrap'}}><span style={{width:14, height: 2, background: '#D7E041', flexShrink: 0}}></span>Совокупный</span>
            <span className="row gap-sm" style={{whiteSpace: 'nowrap'}}><span style={{width:14, height: 1, borderBottom: '1.5px dashed rgba(255,255,255,.4)', flexShrink: 0}}></span>IMOEX</span>
            <span style={{marginLeft: 'auto', fontFamily: 'var(--mono)', whiteSpace: 'nowrap'}}>{lastN.length}&nbsp;точек</span>
          </div>
        </div>
      </div>

      {/* Row: portfolios cards */}
      <CURS_UI.SectionHeader title="Портфели" sub={`${portfolios.length} активных`} right={
        <>
          <button className="btn sm">{CURS_UI.I.plus()} Портфель</button>
          <button className="btn sm ghost">Развернуть все</button>
        </>
      }/>
      <div className="grid grid-3" style={{marginBottom: 28}}>
        {portfolios.map(p => <PortfolioCard key={p.id} portfolio={p} range={range} baseCcy={baseCcy} />)}
      </div>

      {/* Row: allocation + sectors */}
      <div className="grid" style={{gridTemplateColumns: '1.4fr 1fr', marginBottom: 28}}>
        <div className="card">
          <div className="row between" style={{marginBottom: 14}}>
            <h3 className="section-title lg">Структура портфеля</h3>
            <div className="tabs">
              <div className="tab active">По активам</div>
              <div className="tab">По классам</div>
              <div className="tab">По секторам</div>
            </div>
          </div>
          <Treemap items={treemapItems} height={300} />
          <div className="hairline" style={{margin: '14px 0'}}></div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14}}>
            {treemapItems.slice(0,6).map((t, i) => (
              <div key={i} className="col" style={{gap: 4}}>
                <div className="row gap-sm" style={{fontSize: 11}}>
                  <span style={{width: 8, height: 8, borderRadius: 2, background: t.color}}></span>
                  <span style={{fontFamily: 'var(--mono)'}}>{t.label}</span>
                </div>
                <div style={{fontSize: 13, fontWeight: 600}}>{t.share}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row between" style={{marginBottom: 18}}>
            <h3 className="section-title lg">Классы активов</h3>
            <span className="pill warn">Перекос 6,2%</span>
          </div>
          <div className="row" style={{gap: 18}}>
            <Donut items={allocItems} size={150} thickness={22} />
            <div className="col" style={{gap: 8, flex: 1, minWidth: 0}}>
              {allocItems.map((it, i) => (
                <div key={i} className="row between" style={{gap: 8}}>
                  <div className="row gap-sm" style={{minWidth: 0}}>
                    <span style={{width: 9, height: 9, borderRadius: 2, background: it.color, flexShrink: 0}}></span>
                    <span style={{fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{it.label}</span>
                  </div>
                  <span className="kvalue" style={{fontSize: 12}}>{it.share}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hairline" style={{margin: '18px 0 14px'}}></div>

          {/* Concentration metrics */}
          <div className="col" style={{gap: 12, marginBottom: 14}}>
            <ConcentrationRow label="Топ-3 актива" value={topNShare(agg.allPos, 3)} hint="доля крупнейших позиций" />
            <ConcentrationRow label="Валюта" value="—" customRight={<CcyBar positions={agg.allPos} />} />
            <ConcentrationRow label="География" value="—" customRight={<GeoBar positions={agg.allPos} />} />
          </div>

          <button className="btn sm" style={{width: '100%', justifyContent: 'center'}}>Запустить ребалансировку →</button>
        </div>
      </div>

      {/* Top positions */}
      <CURS_UI.SectionHeader title="Топ позиций" sub="по стоимости" right={
        <>
          <div className="tabs">
            <div className="tab active">Стоимость</div>
            <div className="tab">Движение 1Д</div>
            <div className="tab">P&L</div>
          </div>
          <button className="btn sm ghost">Все позиции <span style={{marginLeft: 4}}>→</span></button>
        </>
      }/>
      <div className="card" style={{padding: 0, marginBottom: 28}}>
        <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Актив</th>
              <th>Портфель</th>
              <th className="num">Кол-во</th>
              <th className="num">Цена</th>
              <th>Динамика 30Д</th>
              <th className="num">Стоимость</th>
              <th className="num">Доля</th>
              <th className="num">P&L</th>
              <th className="num">Δ 1Д</th>
            </tr>
          </thead>
          <tbody>
            {agg.allPos.slice().sort((a,b)=>b.valRUB-a.valRUB).slice(0, 8).map((p, i) => (
              <PositionRow key={i} pos={p} total={agg.total} onClick={() => onOpenPosition(p)} />
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Row: P&L decomposition + movers + recent transactions */}
      <div className="grid" style={{gridTemplateColumns: '1.2fr 1fr 1fr', marginBottom: 28}}>
        <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
          <div className="row between" style={{marginBottom: 14}}>
            <h3 className="section-title lg">Декомпозиция P&L</h3>
            <span className="pill">Win rate {Math.round(plDecomp.filter(p=>p.value>0).length / plDecomp.length * 100)}%</span>
          </div>
          <div style={{flex: 1, minHeight: 0}}>
            <CURS_CHARTS.BarChart items={plDecomp} height={340} />
          </div>
          <div className="hairline" style={{margin: '14px 0 14px'}}></div>
          <div className="row" style={{gap: 8, alignItems: 'stretch'}}>
            <div className="col" style={{gap: 2, padding: '8px 10px', background: 'var(--up-soft)', borderRadius: 8, flex: 1, minWidth: 0}}>
              <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--up-ink)', fontSize: 10}}>Прибыли</span>
              <span className="kvalue" style={{color: 'var(--up-ink)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap'}}>{('+' + CURS_CHARTS.fmtMoneyCompact(positivePL) + ' ₽').replace(/ /g, '\u00A0')}</span>
            </div>
            <div className="col" style={{gap: 2, padding: '8px 10px', background: negativePL < 0 ? 'var(--down-soft)' : 'var(--surface-2)', borderRadius: 8, flex: 1, minWidth: 0}}>
              <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.04em', color: negativePL < 0 ? 'var(--down-ink)' : 'var(--ink-3)', fontSize: 10}}>Убытки</span>
              <span className="kvalue" style={{color: negativePL < 0 ? 'var(--down-ink)' : 'var(--ink-3)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap'}}>{negativePL ? (CURS_CHARTS.fmtMoneyCompact(negativePL) + ' ₽').replace(/ /g, '\u00A0') : '—\u00A0₽'}</span>
            </div>
            <div className="col" style={{gap: 2, padding: '8px 10px', background: 'var(--ink)', color: 'white', borderRadius: 8, flex: 1, minWidth: 0}}>
              <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(255,255,255,.6)', fontSize: 10}}>Чистый</span>
              <span className="kvalue" style={{color: 'var(--accent-2)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap'}}>{('+' + CURS_CHARTS.fmtMoneyCompact(positivePL + negativePL) + ' ₽').replace(/ /g, '\u00A0')}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 14}}>Движение за день</h3>
          <div className="col" style={{gap: 10}}>
            {movers.map((m, i) => (
              <div key={i} className="row between" style={{padding: '6px 0'}}>
                <div className="ticker" style={{display: 'flex', alignItems: 'center', gap: 10}}>
                  <CURS_UI.AssetIcon asset={m.asset} size={28} />
                  <div className="col" style={{gap: 0}}>
                    <div style={{fontSize: 13, fontWeight: 500}}>{m.asset.id}</div>
                    <div className="mini">{m.asset.name}</div>
                  </div>
                </div>
                <div className="row gap-md">
                  <Sparkline series={m.asset.series.slice(-30)} width={70} height={24} positive={m.dayPct >= 0} />
                  <div className="col" style={{gap: 0, alignItems: 'flex-end'}}>
                    <span className="kvalue">{CURS_DATA.fmtCcy(m.asset.cur, m.asset.ccy, {decimals: m.asset.cur > 1000 ? 0 : 2})}</span>
                    <CURS_UI.PercentDelta value={m.dayPct} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row between" style={{marginBottom: 14}}>
            <h3 className="section-title lg">Последние сделки</h3>
            <span style={{fontSize: 11, color: 'var(--ink-3)'}}>{CURS_DATA.TX.length} всего</span>
          </div>
          <div className="col" style={{gap: 0}}>
            {recentTx.map((t, i) => (
              <TxItem key={i} tx={t} />
            ))}
          </div>
          <div className="hairline" style={{margin: '10px 0'}}></div>
          <button className="btn ghost" style={{width: '100%'}}>Все транзакции →</button>
        </div>
      </div>

      {/* Risk strip */}
      <CURS_UI.SectionHeader title="Риск и качество портфеля" sub="evidence-based"/>
      <div className="grid grid-4" style={{marginBottom: 28}}>
        <RiskCard label="Sharpe Ratio" value="1,42" sub="хорошо" tone="up" hint="превосходит безрисковую ставку 7%" />
        <RiskCard label="Волатильность" value="18,4%" sub="годовая" tone="neutral" hint="ниже средней по бенчмарку (22%)" />
        <RiskCard label="Max Drawdown" value="−9,8%" sub="за 1Г" tone="down" hint="наиболее глубокая просадка с пика" />
        <RiskCard label="VaR 95%" value="−2,8%" sub="дневной" tone="neutral" hint="теряется не более чем в 5% случаев" />
      </div>
    </div>
  );
}

// ===== Subcomponents =====

function Stat({ label, value, sub, privacy }) {
  return (
    <div className="col" style={{gap: 2}}>
      <div style={{fontSize: 11, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>{label}</div>
      <div className={'mono' + (privacy ? ' mask' : '')} style={{fontSize: 19, fontWeight: 600, color: '#fff'}}>{value}</div>
      <div style={{fontSize: 11, color: 'rgba(255,255,255,.4)'}}>{sub}</div>
    </div>
  );
}

function RangeTabsDark({ value, onChange }) {
  const options = ['1Д','1Н','1М','3М','1Г','Всё'];
  return (
    <div className="row" style={{background: 'rgba(255,255,255,.06)', padding: 2, borderRadius: 7, gap: 0}}>
      {options.map(o => (
        <button key={o}
          onClick={()=>onChange(o)}
          style={{
            padding: '3px 7px', fontSize: 10, fontWeight: 600,
            color: value === o ? 'var(--accent-2)' : 'rgba(255,255,255,.55)',
            background: value === o ? 'rgba(215,224,65,.10)' : 'transparent',
            borderRadius: 5, fontFamily: 'var(--mono)',
            whiteSpace: 'nowrap'
          }}>{o}</button>
      ))}
    </div>
  );
}

function DarkChart({ series }) {
  const { LineAreaChart } = CURS_CHARTS;
  return (
    <div style={{background: 'transparent'}}>
      <DarkLineChart series={series} />
    </div>
  );
}

function DarkLineChart({ series }) {
  const { useRef, useState, useEffect, useMemo } = React;
  const wrapRef = useRef(null);
  const [w, setW] = useState(500);
  const [hover, setHover] = useState(null);
  const height = 220;
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(200, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  const padT = 8, padB = 22, padL = 0, padR = 0;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const vals = series.map(p => p.v);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const pad = (maxV - minV) * 0.08;
  const yMin = minV - pad, yMax = maxV + pad;
  function x(i){ return padL + i/(series.length-1) * innerW; }
  function y(v){ return padT + innerH - (v - yMin)/(yMax-yMin) * innerH; }
  const pts = series.map((p,i) => [x(i), y(p.v)]);
  let path = 'M '+pts[0][0]+' '+pts[0][1];
  for (let i=1;i<pts.length;i++){
    const p0 = pts[i-1], p1 = pts[i];
    const cpx = (p0[0]+p1[0])/2;
    path += ' Q ' + cpx + ' ' + p0[1] + ' ' + cpx + ' ' + (p0[1]+p1[1])/2;
    path += ' Q ' + cpx + ' ' + p1[1] + ' ' + p1[0] + ' ' + p1[1];
  }
  const area = path + ` L ${pts[pts.length-1][0]} ${padT+innerH} L ${pts[0][0]} ${padT+innerH} Z`;
  function onMove(e){
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.round(px / innerW * (series.length-1));
    if (idx < 0 || idx >= series.length) return setHover(null);
    setHover({ idx, x: x(idx), y: y(series[idx].v) });
  }
  return (
    <div ref={wrapRef} style={{position: 'relative', width: '100%', height}}>
      <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={()=>setHover(null)}>
        <defs>
          <linearGradient id="darkAreaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#D7E041" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#D7E041" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t,i)=>(
          <line key={i} x1="0" x2={w} y1={padT + innerH*t} y2={padT + innerH*t} stroke="rgba(255,255,255,.06)" />
        ))}
        <path d={area} fill="url(#darkAreaGrad)" />
        <path d={path} fill="none" stroke="#D7E041" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={padT} y2={padT+innerH} stroke="#D7E041" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
            <circle cx={hover.x} cy={hover.y} r="5" fill="#D7E041" stroke="#15140F" strokeWidth="2" />
          </>
        )}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute', left: hover.x, top: hover.y,
          transform: 'translate(-50%, -120%)',
          background: '#fff', color: '#15140F',
          padding: '6px 10px', borderRadius: 8, fontSize: 12,
          fontFamily: 'var(--mono)', fontWeight: 600, whiteSpace: 'nowrap',
          boxShadow: '0 10px 30px rgba(0,0,0,.3)', pointerEvents: 'none'
        }}>
          <div style={{fontSize: 10, color: 'var(--ink-3)', fontWeight: 400}}>{CURS_CHARTS.fmtDateRu(series[hover.idx].d)}</div>
          {CURS_CHARTS.fmtMoneyCompact(series[hover.idx].v)} ₽
        </div>
      )}
    </div>
  );
}

function PortfolioCard({ portfolio, range, baseCcy }) {
  const days = CURS_UI.RANGE_DAYS[range];
  const series = portfolio.series.slice(-days);
  const startV = series[0].v;
  const endV = series[series.length-1].v;
  const delta = endV - startV;
  const deltaPct = delta / startV;
  const pv = CURS_DATA.portfolioValue(portfolio);
  return (
    <div className="card" style={{overflow: 'hidden', cursor: 'pointer', transition: 'transform .15s'}}>
      <div className="row between" style={{marginBottom: 4}}>
        <div className="row gap-sm">
          <span style={{width: 10, height: 10, borderRadius: 2, background: portfolio.color}}></span>
          <span style={{fontWeight: 600, fontSize: 15}}>{portfolio.name}</span>
        </div>
        <span className="pill">{portfolio.positions.length} позиций</span>
      </div>
      <div className="mini" style={{marginBottom: 16}}>{portfolio.desc}</div>
      <div className="row between" style={{alignItems: 'baseline', marginBottom: 8}}>
        <div className="col" style={{gap: 2}}>
          <div className="mask" style={{fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em'}}>
            {CURS_CHARTS.fmtMoneyCompact(pv.total)} ₽
          </div>
          <CURS_UI.PercentDelta value={deltaPct} />
        </div>
        <CURS_CHARTS.Sparkline series={series} width={120} height={40} positive={deltaPct>=0} />
      </div>
      <div className="hairline" style={{margin: '12px 0'}}></div>
      <div className="row between mini">
        <span>P&L: <span className={'mono ' + (pv.pl >= 0 ? 'delta up' : 'delta down')}>{pv.pl >= 0 ? '+' : ''}{CURS_CHARTS.fmtMoneyCompact(pv.pl)} ₽</span></span>
        <span>Sharpe: <span className="kvalue">{portfolio.metrics.sharpe.toFixed(2)}</span></span>
      </div>
    </div>
  );
}

function PositionRow({ pos, total, onClick }) {
  const { asset } = pos;
  const share = total ? pos.valRUB / total : 0;
  return (
    <tr className="row" onClick={onClick}>
      <td>
        <div className="ticker">
          <CURS_UI.AssetIcon asset={asset} size={32} />
          <div className="meta">
            <div className="nm">{asset.id}</div>
            <div className="sub">{asset.name} · <span className="muted">{typeLabel(asset.type)}</span></div>
          </div>
        </div>
      </td>
      <td><span style={{fontSize: 12, color: 'var(--ink-2)'}}>{portfolioNameFor(pos.portfolio)}</span></td>
      <td className="num">{pos.qty < 1 ? pos.qty.toFixed(3).replace('.', ',') : pos.qty.toLocaleString('ru-RU')}</td>
      <td className="num">{CURS_DATA.fmtCcy(asset.cur, asset.ccy, { decimals: asset.cur > 1000 ? 0 : 2 })}</td>
      <td><CURS_CHARTS.Sparkline series={asset.series.slice(-30)} positive={pos.plPct >= 0} width={90} height={26} /></td>
      <td className="num mask">{CURS_CHARTS.fmtMoneyCompact(pos.valRUB)} ₽</td>
      <td className="num"><span className="kvalue">{(share*100).toFixed(1).replace('.', ',')}%</span></td>
      <td className="num"><CURS_UI.PercentDelta value={pos.plPct} /></td>
      <td className="num"><CURS_UI.PercentDelta value={pos.dayPct} /></td>
    </tr>
  );
}

function typeLabel(t) {
  return { stock_ru: 'RU акция', stock_us: 'US акция', bond: 'Облигация', etf: 'ETF', crypto: 'Крипто', custom: 'Альт.' }[t] || t;
}
function portfolioNameFor(id) {
  return { main: 'Основной', longterm: 'Долгосрочный', exp: 'Эксперимент' }[id] || id;
}

function TxItem({ tx }) {
  const typeMap = {
    buy: { label: 'Покупка', color: 'var(--up)', icon: '↑', bg: 'var(--up-soft)' },
    sell: { label: 'Продажа', color: 'var(--down)', icon: '↓', bg: 'var(--down-soft)' },
    div: { label: 'Дивиденд', color: 'var(--warn)', icon: '◆', bg: 'var(--warn-soft)' },
    in: { label: 'Пополнение', color: 'var(--ink-2)', icon: '＋', bg: 'var(--surface-3)' },
  }[tx.type];
  const a = CURS_DATA.ASSETS.find(x=>x.id===tx.asset);
  const ccySym = a ? (a.ccy === 'USD' ? '$' : '₽') : (tx.asset === 'USD' ? '$' : '₽');
  const total = tx.qty * tx.price;
  return (
    <div className="row" style={{padding: '10px 0', gap: 10, borderBottom: '1px solid var(--hairline-2)', alignItems: 'center'}}>
      <div style={{width: 28, height: 28, borderRadius: 7, background: typeMap.bg, color: typeMap.color, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0}}>{typeMap.icon}</div>
      <div className="col" style={{gap: 2, flex: 1, minWidth: 0}}>
        <div className="row between" style={{gap: 8}}>
          <span style={{fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{typeMap.label} {tx.asset}</span>
          <span className="kvalue mask" style={{color: typeMap.color, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap'}}>
            {(typeMap.icon === '↓' ? '−' : '+') + CURS_CHARTS.fmtMoneyCompact(total).replace(/ /g, '\u00A0') + '\u00A0' + ccySym}
          </span>
        </div>
        <div className="mini" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
          {tx.qty < 1 ? tx.qty.toFixed(3).replace('.', ',') : tx.qty.toLocaleString('ru-RU')} × {tx.price < 1000 ? tx.price.toFixed(2).replace('.', ',') : Math.round(tx.price).toLocaleString('ru-RU')} · {CURS_CHARTS.fmtDateRu(tx.d)}
        </div>
      </div>
    </div>
  );
}

function RiskCard({ label, value, sub, tone, hint }) {
  const toneColor = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--ink)';
  return (
    <div className="card">
      <div className="row between" style={{marginBottom: 12}}>
        <span style={{fontSize: 12, color: 'var(--ink-3)', fontWeight: 500}}>{label}</span>
        <span className="pill" style={{textTransform: 'uppercase', fontSize: 9}}>EBF</span>
      </div>
      <div className="row" style={{gap: 8, alignItems: 'baseline'}}>
        <span className="mono" style={{fontSize: 28, fontWeight: 600, color: toneColor, letterSpacing: '-0.02em'}}>{value}</span>
        <span className="mini">{sub}</span>
      </div>
      <div className="mini" style={{marginTop: 8, lineHeight: 1.4, height: 32}}>{hint}</div>
    </div>
  );
}

// Concentration helpers
function topNShare(positions, n) {
  const total = positions.reduce((s,p) => s + p.valRUB, 0);
  const top = positions.slice().sort((a,b)=>b.valRUB-a.valRUB).slice(0,n).reduce((s,p)=>s+p.valRUB,0);
  return Math.round(top/total*100) + '%';
}

function ConcentrationRow({ label, value, hint, customRight }) {
  return (
    <div className="row between" style={{gap: 12, alignItems: 'center'}}>
      <div className="col" style={{gap: 2, minWidth: 0}}>
        <span style={{fontSize: 12, color: 'var(--ink-2)', fontWeight: 500}}>{label}</span>
        {hint && <span className="mini" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{hint}</span>}
      </div>
      {customRight ? customRight : <span className="kvalue" style={{fontSize: 14, fontWeight: 600}}>{value}</span>}
    </div>
  );
}

function CcyBar({ positions }) {
  // Split by currency in RUB equivalent
  const byCcy = {};
  positions.forEach(p => { byCcy[p.asset.ccy] = (byCcy[p.asset.ccy] || 0) + p.valRUB; });
  const total = Object.values(byCcy).reduce((s,v)=>s+v,0);
  const items = Object.entries(byCcy).map(([k,v]) => ({ k, v, pct: v/total }));
  items.sort((a,b) => b.v - a.v);
  const colors = { RUB: '#15140F', USD: '#4F6BED', EUR: '#86B0A0' };
  return (
    <div className="col" style={{gap: 4, alignItems: 'flex-end', minWidth: 140}}>
      <div style={{display: 'flex', width: 140, height: 6, borderRadius: 2, overflow: 'hidden'}}>
        {items.map((it, i) => <div key={i} style={{width: (it.pct*100)+'%', background: colors[it.k] || '#B5B1A6'}} title={`${it.k}: ${Math.round(it.pct*100)}%`}></div>)}
      </div>
      <div className="row gap-sm" style={{fontSize: 10, fontFamily: 'var(--mono)'}}>
        {items.map((it, i) => <span key={i} style={{color: 'var(--ink-3)'}}>{it.k} {Math.round(it.pct*100)}%</span>)}
      </div>
    </div>
  );
}

function GeoBar({ positions }) {
  const byGeo = {};
  positions.forEach(p => { byGeo[p.asset.region] = (byGeo[p.asset.region] || 0) + p.valRUB; });
  const total = Object.values(byGeo).reduce((s,v)=>s+v,0);
  const items = Object.entries(byGeo).map(([k,v]) => ({ k, v, pct: v/total }));
  items.sort((a,b) => b.v - a.v);
  const colors = { 'RU': '#15140F', 'US': '#4F6BED', '—': '#B58300' };
  const labels = { 'RU': 'RU', 'US': 'US', '—': 'Глоб.' };
  return (
    <div className="col" style={{gap: 4, alignItems: 'flex-end', minWidth: 140}}>
      <div style={{display: 'flex', width: 140, height: 6, borderRadius: 2, overflow: 'hidden'}}>
        {items.map((it, i) => <div key={i} style={{width: (it.pct*100)+'%', background: colors[it.k] || '#B5B1A6'}} title={`${labels[it.k]}: ${Math.round(it.pct*100)}%`}></div>)}
      </div>
      <div className="row gap-sm" style={{fontSize: 10, fontFamily: 'var(--mono)'}}>
        {items.map((it, i) => <span key={i} style={{color: 'var(--ink-3)'}}>{labels[it.k] || it.k} {Math.round(it.pct*100)}%</span>)}
      </div>
    </div>
  );
}

function RiskCardKept_unused() { return null; }

window.CURS_DASHBOARD = { Dashboard };
