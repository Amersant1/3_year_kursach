// CURS — Compare + Transactions + Assets screens
const { useState: cmpUseState, useMemo: cmpUseMemo } = React;

// ============================================
// Compare portfolios
// ============================================
function CompareScreen({ portfolios }) {
  const [selected, setSelected] = cmpUseState(portfolios.map(p => p.id));
  const [range, setRange] = cmpUseState('1Г');
  const [mode, setMode] = cmpUseState('returns'); // returns | value
  const days = CURS_UI.RANGE_DAYS[range];

  function toggle(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  const visible = portfolios.filter(p => selected.includes(p.id));
  // Normalized series (start at 100) for fair comparison
  const lines = visible.map(p => {
    const s = p.series.slice(-days);
    const v0 = s[0].v;
    return {
      id: p.id, name: p.name, color: p.color,
      series: mode === 'returns' ? s.map(pt => ({ d: pt.d, v: pt.v / v0 * 100 })) : s,
      pv: CURS_DATA.portfolioValue(p),
      metrics: p.metrics,
    };
  });

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="row gap-sm" style={{marginBottom: 6}}>
            <span className="pill ghost">{visible.length} из {portfolios.length} портфелей</span>
          </div>
          <div className="title">Сравнение портфелей</div>
          <div className="sub">Нормализованные доходности, ключевые метрики и распределение по классам</div>
        </div>
        <div className="right">
          <div className="tabs">
            <div className={'tab ' + (mode==='returns' ? 'active':'')} onClick={()=>setMode('returns')}>Доходность %</div>
            <div className={'tab ' + (mode==='value' ? 'active':'')} onClick={()=>setMode('value')}>Стоимость ₽</div>
          </div>
          <CURS_UI.RangeTabs value={range} onChange={setRange} />
        </div>
      </div>

      {/* Selector chips */}
      <div className="row gap-sm" style={{marginBottom: 22, flexWrap: 'wrap'}}>
        {portfolios.map(p => {
          const active = selected.includes(p.id);
          return (
            <button key={p.id} onClick={()=>toggle(p.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid ' + (active ? 'var(--ink)' : 'var(--hairline)'),
              background: active ? 'var(--surface)' : 'var(--surface-2)',
              color: active ? 'var(--ink)' : 'var(--ink-3)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer'
            }}>
              <span style={{width: 10, height: 10, borderRadius: 2, background: p.color, opacity: active ? 1 : 0.3}}></span>
              {p.name}
              <span className="mono" style={{fontSize: 11, color: 'var(--ink-3)', marginLeft: 4}}>{p.positions.length}</span>
            </button>
          );
        })}
      </div>

      {/* Main multi-line chart */}
      <div className="card" style={{marginBottom: 22}}>
        <MultiLineChart lines={lines} mode={mode} height={340} />
        <div className="hairline" style={{margin: '14px 0'}}></div>
        <div className="row gap-md" style={{flexWrap: 'wrap'}}>
          {lines.map((l, i) => {
            const last = l.series[l.series.length-1].v;
            const first = l.series[0].v;
            const change = mode === 'returns' ? (last - 100)/100 : (last - first)/first;
            return (
              <div key={l.id} className="row gap-sm" style={{padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 8}}>
                <span style={{width: 14, height: 2, background: l.color}}></span>
                <span style={{fontSize: 12, fontWeight: 600}}>{l.name}</span>
                <CURS_UI.PercentDelta value={change} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Side-by-side metric comparison */}
      <CURS_UI.SectionHeader title="Метрики бок о бок" sub="evidence-based" />
      <div className="card" style={{padding: 0, marginBottom: 22}}>
        <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Портфель</th>
              <th className="num">Стоимость</th>
              <th className="num">P&L</th>
              <th className="num">CAGR</th>
              <th className="num">σ</th>
              <th className="num">Sharpe</th>
              <th className="num">Max DD</th>
              <th className="num">Calmar</th>
              <th>30Д</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(p => {
              const pv = CURS_DATA.portfolioValue(p);
              return (
                <tr key={p.id} className="row">
                  <td>
                    <div className="ticker">
                      <span style={{width: 28, height: 28, borderRadius: 7, background: p.color, flexShrink: 0}}></span>
                      <div className="meta">
                        <div className="nm">{p.name}</div>
                        <div className="sub">{p.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num mask">{CURS_CHARTS.fmtMoneyCompact(pv.total)} ₽</td>
                  <td className="num"><CURS_UI.PercentDelta value={pv.plPct} /></td>
                  <td className="num">{(p.metrics.annRet*100).toFixed(1).replace('.', ',')}%</td>
                  <td className="num">{(p.metrics.vol*100).toFixed(1).replace('.', ',')}%</td>
                  <td className="num" style={{fontWeight: 600}}>{p.metrics.sharpe.toFixed(2)}</td>
                  <td className="num" style={{color: 'var(--down)'}}>{(p.metrics.maxDD*100).toFixed(1).replace('.', ',')}%</td>
                  <td className="num">{(p.metrics.annRet/Math.abs(p.metrics.maxDD)).toFixed(2)}</td>
                  <td><CURS_CHARTS.Sparkline series={p.series.slice(-30)} width={80} height={24} positive={pv.plPct >= 0} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Risk-return scatter */}
      <CURS_UI.SectionHeader title="Риск vs. доходность" sub="по портфелям" />
      <div className="card">
        <RiskReturnScatter portfolios={visible} />
      </div>
    </div>
  );
}

function MultiLineChart({ lines, mode, height }) {
  const { useRef, useState, useEffect } = React;
  const wrapRef = useRef(null);
  const [w, setW] = useState(700);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(300, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  const padT = 16, padB = 24, padL = 72, padR = 16;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  if (!lines.length) return <div style={{height, display: 'grid', placeItems: 'center', color: 'var(--ink-3)'}}>Выберите портфели для сравнения</div>;
  const N = lines[0].series.length;
  const allV = lines.flatMap(l => l.series.map(p => p.v));
  const minV = Math.min(...allV), maxV = Math.max(...allV);
  const pad = (maxV - minV) * 0.06;
  const yMin = minV - pad, yMax = maxV + pad;
  function x(i){ return padL + i/(N-1) * innerW; }
  function y(v){ return padT + innerH - (v - yMin)/(yMax-yMin) * innerH; }

  // y ticks
  const yT = 5, yTicks = [];
  for (let i=0;i<=yT;i++) yTicks.push(yMin + (yMax-yMin)*i/yT);

  function onMove(e){
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(N-1, Math.round((px-padL)/innerW * (N-1))));
    setHover({ idx, x: x(idx) });
  }

  return (
    <div ref={wrapRef} style={{width: '100%', height, position: 'relative'}}>
      <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={()=>setHover(null)}>
        {yTicks.map((v,i) => (
          <g key={i}>
            <line x1={padL} x2={padL+innerW} y1={y(v)} y2={y(v)} stroke="#EFEBE0" strokeDasharray={i===0?'':'2 3'} />
            <text x={padL-6} y={y(v)+3} textAnchor="end" fontSize="10" fill="#807D74" fontFamily="var(--mono)">
              {mode === 'returns' ? v.toFixed(0) + '%' : CURS_CHARTS.fmtMoneyCompact(v) + ' ₽'}
            </text>
          </g>
        ))}
        {mode === 'returns' && (
          <line x1={padL} x2={padL+innerW} y1={y(100)} y2={y(100)} stroke="#15140F" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        )}
        {lines.map((l, i) => {
          const pts = l.series.map((p, idx) => [x(idx), y(p.v)]);
          let path = 'M '+pts[0][0]+' '+pts[0][1];
          for (let k=1;k<pts.length;k++) path += ' L '+pts[k][0]+' '+pts[k][1];
          return <path key={l.id} d={path} fill="none" stroke={l.color} strokeWidth="2" strokeLinecap="round" />;
        })}

        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={padT} y2={padT+innerH} stroke="#15140F" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
            {lines.map((l, i) => (
              <circle key={i} cx={hover.x} cy={y(l.series[hover.idx].v)} r="4" fill={l.color} stroke="#fff" strokeWidth="2" />
            ))}
          </>
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: 30, transform: 'translate(-50%, 0)' }}>
          <div className="t-date">{CURS_CHARTS.fmtDateRu(lines[0].series[hover.idx].d)}</div>
          {lines.map((l, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 4}}>
              <span style={{width: 8, height: 2, background: l.color}}></span>
              <span>{l.name}</span>
              <span className="t-val" style={{marginLeft: 'auto'}}>
                {mode === 'returns' ? l.series[hover.idx].v.toFixed(1) : CURS_CHARTS.fmtMoneyCompact(l.series[hover.idx].v) + ' ₽'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskReturnScatter({ portfolios }) {
  const { useRef, useState, useEffect } = React;
  const wrapRef = useRef(null);
  const [w, setW] = useState(700);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(300, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  const height = 280;
  const padL = 56, padR = 80, padT = 16, padB = 36;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const xs = portfolios.map(p => p.metrics.vol);
  const ys = portfolios.map(p => p.metrics.annRet);
  const xMin = Math.min(...xs) * 0.6, xMax = Math.max(...xs) * 1.2;
  const yMin = Math.min(...ys) * 0.6, yMax = Math.max(...ys) * 1.2;
  function x(v){ return padL + (v - xMin)/(xMax-xMin) * innerW; }
  function y(v){ return padT + innerH - (v - yMin)/(yMax-yMin) * innerH; }
  // axes
  const xT = 5, yT = 5;
  return (
    <div ref={wrapRef} style={{width: '100%', height}}>
      <svg width={w} height={height}>
        {[...Array(yT+1)].map((_,i) => {
          const v = yMin + (yMax-yMin)*i/yT;
          return (
            <g key={i}>
              <line x1={padL} x2={padL+innerW} y1={y(v)} y2={y(v)} stroke="#EFEBE0" strokeDasharray={i===0?'':'2 3'} />
              <text x={padL-6} y={y(v)+3} textAnchor="end" fontSize="10" fill="#807D74" fontFamily="var(--mono)">{(v*100).toFixed(0)}%</text>
            </g>
          );
        })}
        {[...Array(xT+1)].map((_,i) => {
          const v = xMin + (xMax-xMin)*i/xT;
          return (
            <g key={i}>
              <line x1={x(v)} x2={x(v)} y1={padT} y2={padT+innerH} stroke="#EFEBE0" strokeDasharray={i===0?'':'2 3'} />
              <text x={x(v)} y={padT+innerH+14} textAnchor="middle" fontSize="10" fill="#807D74" fontFamily="var(--mono)">{(v*100).toFixed(0)}%</text>
            </g>
          );
        })}
        <text x={padL+innerW/2} y={height-6} textAnchor="middle" fontSize="11" fill="#4A4842">Риск (волатильность)</text>
        <text x={14} y={padT+innerH/2} textAnchor="middle" fontSize="11" fill="#4A4842" transform={`rotate(-90 14 ${padT+innerH/2})`}>Годовая доходность</text>
        {portfolios.map(p => (
          <g key={p.id}>
            <circle cx={x(p.metrics.vol)} cy={y(p.metrics.annRet)} r="14" fill={p.color} opacity="0.18" />
            <circle cx={x(p.metrics.vol)} cy={y(p.metrics.annRet)} r="8" fill={p.color} stroke="#fff" strokeWidth="2" />
            <text x={x(p.metrics.vol) + 14} y={y(p.metrics.annRet) + 4} fontSize="11" fontWeight="600" fill="var(--ink)">{p.name}</text>
            <text x={x(p.metrics.vol) + 14} y={y(p.metrics.annRet) + 18} fontSize="10" fill="var(--ink-3)" fontFamily="var(--mono)">
              Sharpe {p.metrics.sharpe.toFixed(2)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ============================================
// Transactions screen
// ============================================
function TransactionsScreen({ portfolios, onOpenPosition }) {
  const [filter, setFilter] = cmpUseState('all');
  const [pfFilter, setPfFilter] = cmpUseState('all');
  const [search, setSearch] = cmpUseState('');
  const filtered = CURS_DATA.TX
    .filter(t => filter === 'all' || t.type === filter)
    .filter(t => pfFilter === 'all' || t.portfolio === pfFilter)
    .filter(t => !search || t.asset.toLowerCase().includes(search.toLowerCase()));
  // Group by date
  const groups = {};
  filtered.forEach(t => {
    const key = t.d.toISOString().slice(0, 7); // YYYY-MM
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  const sortedKeys = Object.keys(groups).sort((a,b)=>b.localeCompare(a));

  const counts = {};
  CURS_DATA.TX.forEach(t => counts[t.type] = (counts[t.type]||0)+1);

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="row gap-sm" style={{marginBottom: 6}}>
            <span className="pill ghost">{CURS_DATA.TX.length} операций · с 06.2025</span>
          </div>
          <div className="title">Транзакции</div>
          <div className="sub">Все сделки, дивиденды и пополнения — основа для расчёта позиций и метрик</div>
        </div>
        <div className="right">
          <button className="btn">{CURS_UI.I.dl()}<span>CSV</span></button>
          <button className="btn">Импорт из брокера</button>
          <button className="btn primary">{CURS_UI.I.plus()}<span>Новая сделка</span></button>
        </div>
      </div>

      {/* Filters */}
      <div className="row gap-md" style={{marginBottom: 22, flexWrap: 'wrap', alignItems: 'flex-end'}}>
        <div className="search" style={{height: 34, width: 280}}>
          {CURS_UI.I.search()}
          <input placeholder="Поиск по тикеру…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div className="col gap-sm">
          <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>Тип операции</span>
          <div className="tabs">
            {[['all','Все'],['buy','Покупка'],['sell','Продажа'],['div','Дивиденды'],['in','Пополнения']].map(([k,l]) => (
              <div key={k} className={'tab ' + (filter===k?'active':'')} onClick={()=>setFilter(k)}>
                {l}{k !== 'all' && counts[k] ? <span className="muted" style={{marginLeft: 4, fontSize: 10}}>{counts[k]}</span> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="col gap-sm">
          <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>Портфель</span>
          <div className="tabs">
            <div className={'tab ' + (pfFilter==='all'?'active':'')} onClick={()=>setPfFilter('all')}>Все</div>
            {portfolios.map(p => (
              <div key={p.id} className={'tab ' + (pfFilter===p.id?'active':'')} onClick={()=>setPfFilter(p.id)}>
                <span style={{display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: p.color, marginRight: 5}}></span>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-4" style={{marginBottom: 28}}>
        <KpiMini label="Покупок" value={CURS_DATA.TX.filter(t=>t.type==='buy').length} />
        <KpiMini label="Продаж" value={CURS_DATA.TX.filter(t=>t.type==='sell').length} />
        <KpiMini label="Дивидендов" value="+58,1к ₽" tone="up" mask />
        <KpiMini label="Пополнений" value="+20 млн ₽" mask />
      </div>

      {/* Timeline */}
      <div className="col" style={{gap: 22}}>
        {sortedKeys.map(key => {
          const date = new Date(key + '-01');
          const monthName = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][date.getMonth()];
          return (
            <div key={key}>
              <div className="row between" style={{marginBottom: 12}}>
                <h3 className="section-title lg">{monthName} {date.getFullYear()}</h3>
                <span className="mini">{groups[key].length} операций</span>
              </div>
              <div className="card" style={{padding: 0}}>
                {groups[key].map((t, i) => (
                  <TxRow key={t.id} tx={t} portfolios={portfolios} onAssetClick={onOpenPosition} last={i === groups[key].length-1} />
                ))}
              </div>
            </div>
          );
        })}
        {sortedKeys.length === 0 && (
          <div className="card" style={{padding: 60, textAlign: 'center'}}>
            <div className="muted">Ничего не найдено</div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiMini({ label, value, tone, mask }) {
  const color = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--ink)';
  return (
    <div className="card flat" style={{padding: 14}}>
      <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6}}>{label}</div>
      <div className={'mono ' + (mask ? 'mask' : '')} style={{fontSize: 22, fontWeight: 600, color, letterSpacing: '-0.02em'}}>{value}</div>
    </div>
  );
}

function TxRow({ tx, portfolios, onAssetClick, last }) {
  const typeMap = {
    buy: { label: 'Покупка', color: 'var(--up)', icon: '↑', bg: 'var(--up-soft)', sign: '+' },
    sell: { label: 'Продажа', color: 'var(--down)', icon: '↓', bg: 'var(--down-soft)', sign: '−' },
    div: { label: 'Дивиденд', color: 'var(--warn)', icon: '◆', bg: 'var(--warn-soft)', sign: '+' },
    in: { label: 'Пополнение', color: 'var(--ink-2)', icon: '＋', bg: 'var(--surface-3)', sign: '+' },
  }[tx.type];
  const a = CURS_DATA.ASSETS.find(x=>x.id===tx.asset);
  const p = portfolios.find(p => p.id === tx.portfolio);
  const total = tx.qty * tx.price;
  const ccy = tx.type === 'in' ? tx.asset : (a ? a.ccy : 'RUB');
  return (
    <div className="row between" style={{padding: '14px 18px', borderBottom: last ? 'none' : '1px solid var(--hairline-2)'}}>
      <div className="row gap-md" style={{flex: 1}}>
        <div style={{width: 32, height: 32, borderRadius: 8, background: typeMap.bg, color: typeMap.color, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700}}>{typeMap.icon}</div>
        <div className="col" style={{gap: 2}}>
          <div className="row gap-sm">
            <span style={{fontSize: 14, fontWeight: 500}}>{typeMap.label}</span>
            {a && <span className="type-chip">{tx.asset}</span>}
            {tx.type === 'in' && <span className="type-chip">{tx.asset}</span>}
          </div>
          <div className="mini row gap-sm">
            <span>{CURS_CHARTS.fmtDateRu(tx.d)}</span>
            <span>·</span>
            <span style={{color: p?.color || 'var(--ink-3)'}}>● {p?.name || ''}</span>
            {tx.note && <><span>·</span><span style={{fontStyle: 'italic'}}>{tx.note}</span></>}
          </div>
        </div>
      </div>
      <div className="row gap-md">
        {tx.type !== 'in' && (
          <span className="kvalue" style={{color: 'var(--ink-3)', fontSize: 12}}>
            {tx.qty < 1 ? tx.qty.toFixed(3).replace('.', ',') : tx.qty.toLocaleString('ru-RU')} × {tx.price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} {ccy === 'USD' ? '$' : '₽'}
          </span>
        )}
        <span className={'kvalue mask'} style={{color: typeMap.color, fontWeight: 600, fontSize: 14}}>
          {typeMap.sign}{CURS_CHARTS.fmtMoneyCompact(total)} {ccy === 'USD' ? '$' : '₽'}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Assets catalog screen
// ============================================
function AssetsScreen({ onOpenPosition }) {
  const [search, setSearch] = cmpUseState('');
  const [filter, setFilter] = cmpUseState('all');
  const assets = CURS_DATA.ASSETS.filter(a => filter === 'all' || a.type === filter).filter(a => !search || a.id.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="title">Каталог активов</div>
          <div className="sub">Все доступные инструменты в системе с привязкой к ценовому источнику</div>
        </div>
        <div className="right">
          <button className="btn">Добавить custom актив</button>
          <button className="btn primary">{CURS_UI.I.plus()}<span>Подключить API</span></button>
        </div>
      </div>

      <div className="row gap-md" style={{marginBottom: 22}}>
        <div className="search" style={{height: 34, width: 280}}>{CURS_UI.I.search()}<input placeholder="Тикер или название" value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <div className="tabs">
          {[['all','Все'],['stock_ru','RU акции'],['stock_us','INTL акции'],['bond','Облигации'],['etf','ETF'],['crypto','Крипто'],['custom','Альтернативные']].map(([k,l]) => (
            <div key={k} className={'tab ' + (filter===k?'active':'')} onClick={()=>setFilter(k)}>{l}</div>
          ))}
        </div>
      </div>

      <div className="grid grid-3" style={{gap: 14}}>
        {assets.map(a => (
          <AssetCard key={a.id} asset={a} />
        ))}
      </div>
    </div>
  );
}

function AssetCard({ asset }) {
  const change = (asset.cur - asset.series[0].v) / asset.series[0].v;
  return (
    <div className="card" style={{cursor: 'pointer'}}>
      <div className="row between" style={{marginBottom: 12}}>
        <div className="row gap-sm">
          <CURS_UI.AssetIcon asset={asset} size={36} />
          <div className="col" style={{gap: 0}}>
            <div style={{fontWeight: 600, fontSize: 14}}>{asset.id}</div>
            <div className="mini">{asset.name}</div>
          </div>
        </div>
        <span className="type-chip">{({stock_ru:'RU', stock_us:'INTL', bond:'BOND', etf:'ETF', crypto:'CRYPTO', custom:'ALT'})[asset.type]}</span>
      </div>
      <div className="row between" style={{alignItems: 'baseline'}}>
        <div className="col" style={{gap: 2}}>
          <div className="mono" style={{fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em'}}>
            {asset.cur > 1000 ? Math.round(asset.cur).toLocaleString('ru-RU') : asset.cur.toFixed(2).replace('.', ',')}
            <span style={{fontSize: 12, color: 'var(--ink-3)', marginLeft: 4}}>{asset.ccy === 'RUB' ? '₽' : '$'}</span>
          </div>
          <CURS_UI.PercentDelta value={change} />
        </div>
        <CURS_CHARTS.Sparkline series={asset.series.slice(-90)} positive={change >= 0} width={120} height={36} />
      </div>
      <div className="hairline" style={{margin: '12px 0 10px'}}></div>
      <div className="row between mini">
        <span>{asset.sector}</span>
        <span style={{fontFamily: 'var(--mono)'}}>
          {asset.type === 'crypto' ? 'CoinGecko' : asset.type === 'custom' ? 'Manual' : asset.region === 'RU' ? 'MOEX' : 'Yahoo'}
        </span>
      </div>
    </div>
  );
}

window.CURS_SCREENS = { CompareScreen, TransactionsScreen, AssetsScreen };
