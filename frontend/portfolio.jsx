// CURS — Portfolio detail + Position detail panel
const { useState: pfUseState, useMemo: pfUseMemo, useEffect: pfUseEffect } = React;

function PortfolioScreen({ portfolio, baseCcy, onOpenPosition, allPortfolios }) {
  const [range, setRange] = pfUseState('1Г');
  const [view, setView] = pfUseState('chart'); // chart | table
  const [filter, setFilter] = pfUseState('all'); // class filter
  const [sort, setSort] = pfUseState({ key: 'value', dir: 'desc' });
  const [search, setSearch] = pfUseState('');
  const days = CURS_UI.RANGE_DAYS[range];

  const pv = pfUseMemo(() => CURS_DATA.portfolioValue(portfolio), [portfolio]);
  const series = portfolio.series.slice(-days);
  const startV = series[0].v, endV = series[series.length-1].v;
  const rangeDelta = endV - startV;
  const rangeDeltaPct = (endV - startV)/startV;

  // build benchmark (IMOEX-ish) — use SBER series as proxy scaled
  const sber = CURS_DATA.ASSETS.find(a => a.id === 'SBER').series.slice(-days);
  const bScale = startV / sber[0].v;
  const bench = sber.map(p => ({ d: p.d, v: p.v * bScale * 0.92 }));

  // Filter + sort positions
  const filtered = pv.positions
    .filter(p => filter === 'all' || p.asset.type === filter)
    .filter(p => !search || p.asset.id.toLowerCase().includes(search.toLowerCase()) || p.asset.name.toLowerCase().includes(search.toLowerCase()))
    .slice()
    .sort((a, b) => {
      const dir = sort.dir === 'desc' ? -1 : 1;
      if (sort.key === 'value') return (a.valRUB - b.valRUB) * dir;
      if (sort.key === 'pl') return (a.plPct - b.plPct) * dir;
      if (sort.key === 'day') return (a.dayPct - b.dayPct) * dir;
      if (sort.key === 'qty') return (a.qty - b.qty) * dir;
      return 0;
    });

  function setSortKey(k) {
    setSort(s => s.key === k ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: k, dir: 'desc' });
  }

  const classCounts = {};
  pv.positions.forEach(p => { classCounts[p.asset.type] = (classCounts[p.asset.type]||0) + 1; });

  return (
    <div className="content">
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="row gap-sm" style={{marginBottom: 6}}>
            <span style={{width: 12, height: 12, borderRadius: 3, background: portfolio.color}}></span>
            <span className="pill">{portfolio.positions.length} позиций</span>
            <span className="pill">Активен с 04.2024</span>
          </div>
          <div className="title">{portfolio.name}</div>
          <div className="sub">{portfolio.desc}</div>
        </div>
        <div className="right">
          <button className="btn">{CURS_UI.I.dl()}<span>Экспорт</span></button>
          <button className="btn">Ребалансировка</button>
          <button className="btn primary">{CURS_UI.I.plus()}<span>Добавить позицию</span></button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-4" style={{marginBottom: 22}}>
        <KpiCard label="Стоимость" value={CURS_DATA.fmtRUB(pv.total, { compact: true })} delta={pv.dayPct} sub="на сегодня" privacy />
        <KpiCard label="P&L нереализ." value={CURS_DATA.fmtRUB(pv.pl, { compact: true, sign: true })} delta={pv.plPct} sub="всё время" tone={pv.pl >= 0 ? 'up' : 'down'} />
        <KpiCard label="Sharpe Ratio" value={portfolio.metrics.sharpe.toFixed(2)} sub="(r-7%)/σ" />
        <KpiCard label="Max DD" value={(portfolio.metrics.maxDD*100).toFixed(1).replace('.', ',')+'%'} sub="за период" tone="down" />
      </div>

      {/* Main chart */}
      <div className="card" style={{marginBottom: 22}}>
        <div className="row between" style={{marginBottom: 10}}>
          <div className="col" style={{gap: 4}}>
            <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>Стоимость портфеля</div>
            <div className="row" style={{gap: 10, alignItems: 'baseline'}}>
              <span className="mask" style={{fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em'}}>{CURS_CHARTS.fmtMoneyCompact(endV)} ₽</span>
              <CURS_UI.PercentDelta value={rangeDeltaPct} withDelta abs={rangeDelta} />
              <span className="mini" style={{marginLeft: 4}}>за {range}</span>
            </div>
          </div>
          <div className="row gap-md">
            <span className="mini">vs <span className="mono" style={{padding: '1px 5px', background: 'var(--surface-3)', borderRadius: 3}}>IMOEX</span></span>
            <CURS_UI.RangeTabs value={range} onChange={setRange} />
          </div>
        </div>
        <CURS_CHARTS.LineAreaChart
          series={series}
          compareSeries={bench}
          height={300}
          color="#15140F"
          areaFrom="rgba(21,20,15,.10)"
          areaTo="rgba(21,20,15,0)"
        />
        <div className="row gap-md mini" style={{marginTop: 4}}>
          <span className="row gap-sm"><span style={{width: 14, height: 2, background: 'var(--ink)'}}></span>{portfolio.name}</span>
          <span className="row gap-sm"><span style={{width: 14, height: 1, borderBottom: '1.5px dashed #B5B1A6'}}></span>IMOEX</span>
          <span style={{marginLeft: 'auto', fontFamily: 'var(--mono)'}}>
            CAGR: <strong>{(portfolio.metrics.annRet*100).toFixed(1).replace('.', ',')}%</strong> · σ: <strong>{(portfolio.metrics.vol*100).toFixed(1).replace('.', ',')}%</strong>
          </span>
        </div>
      </div>

      {/* Filters + table */}
      <CURS_UI.SectionHeader title="Позиции" sub={`${filtered.length} из ${pv.positions.length}`} right={
        <>
          <div className="search" style={{height: 32, width: 240}}>
            {CURS_UI.I.search()}
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по тикеру или названию" />
          </div>
          <div className="tabs">
            {[['all','Все'],['stock_ru','RU'],['stock_us','INTL'],['bond','Облиг.'],['crypto','Крипто'],['custom','Альт.']].map(([k,l]) => (
              <div key={k} className={'tab ' + (filter===k?'active':'')} onClick={()=>setFilter(k)}>
                {l}{classCounts[k] ? <span className="muted" style={{marginLeft: 4, fontSize: 10}}>{classCounts[k]}</span> : null}
              </div>
            ))}
          </div>
        </>
      } />

      <div className="card" style={{padding: 0, marginBottom: 22}}>
        <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Актив</th>
              <th>Класс</th>
              <th className="num" onClick={()=>setSortKey('qty')}>Кол-во {sort.key==='qty' && <span className="arrow">{sort.dir==='desc'?'↓':'↑'}</span>}</th>
              <th className="num">Цена</th>
              <th>30Д</th>
              <th className="num" onClick={()=>setSortKey('value')}>Стоимость / доля {sort.key==='value' && <span className="arrow">{sort.dir==='desc'?'↓':'↑'}</span>}</th>
              <th className="num" onClick={()=>setSortKey('pl')}>P&L {sort.key==='pl' && <span className="arrow">{sort.dir==='desc'?'↓':'↑'}</span>}</th>
              <th className="num" onClick={()=>setSortKey('day')}>Δ 1Д {sort.key==='day' && <span className="arrow">{sort.dir==='desc'?'↓':'↑'}</span>}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p,i) => (
              <PositionRowFull key={i} pos={p} total={pv.total} onClick={() => onOpenPosition(p)} />
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Sector breakdown + transactions strip */}
      <div className="grid" style={{gridTemplateColumns: '1fr 1fr', marginBottom: 22}}>
        <div className="card">
          <h3 className="section-title lg" style={{marginBottom: 14}}>Просадка (Drawdown)</h3>
          <CURS_CHARTS.DrawdownChart series={series} height={180} />
          <div className="hairline" style={{margin: '14px 0'}}></div>
          <div className="grid grid-3" style={{gap: 14, marginBottom: 14}}>
            <Statline label="Max DD" value={(portfolio.metrics.maxDD*100).toFixed(2)+'%'} tone="down" />
            <Statline label="Текущая" value="−2,4%" tone="down" />
            <Statline label="Восстановление" value="∼ 48 дн" />
          </div>
          <div className="hairline" style={{margin: '4px 0 14px'}}></div>
          <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10}}>Крупнейшие просадки</div>
          <div className="col" style={{gap: 8}}>
            <DDRow date="окт 2025" depth={-7.4} duration={32} recovery={42} />
            <DDRow date="янв 2026" depth={-4.1} duration={18} recovery={26} />
            <DDRow date="мар 2026" depth={-3.2} duration={11} recovery={14} />
          </div>
        </div>

        <div className="card">
          <div className="row between" style={{marginBottom: 14}}>
            <h3 className="section-title lg">Корреляция позиций</h3>
            <span className="pill ghost">матрица ρ</span>
          </div>
          <CorrSnippet portfolio={portfolio} />
        </div>
      </div>
    </div>
  );
}

function CorrSnippet({ portfolio }) {
  const ids = portfolio.positions.slice(0,6).map(p => p.asset);
  const matrix = pfUseMemo(() => CURS_DATA.corrMatrix(ids), [ids.join(',')]);
  return (
    <>
      <CURS_CHARTS.Heatmap labels={ids} matrix={matrix} size={32} />
      <div className="hairline" style={{margin: '12px 0'}}></div>
      <div className="row between mini">
        <span>Высокая корреляция: <strong>SBER ↔ GAZP</strong></span>
        <span>Слабая: <strong>BTC ↔ OFZ</strong></span>
      </div>
    </>
  );
}

function KpiCard({ label, value, delta, sub, tone, privacy }) {
  return (
    <div className="card">
      <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8}}>{label}</div>
      <div className={'mono ' + (privacy ? 'mask' : '')} style={{fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--ink)' : 'var(--ink)'}}>{value}</div>
      <div className="row between" style={{marginTop: 6}}>
        <span className="mini">{sub}</span>
        {delta != null && <CURS_UI.PercentDelta value={delta} />}
      </div>
    </div>
  );
}

function Statline({ label, value, tone }) {
  const color = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--ink)';
  return (
    <div className="col" style={{gap: 2}}>
      <div className="mini">{label}</div>
      <div className="kvalue" style={{fontSize: 15, color, fontWeight: 600}}>{value}</div>
    </div>
  );
}

function DDRow({ date, depth, duration, recovery }) {
  return (
    <div className="row between" style={{padding: '6px 0', borderBottom: '1px solid var(--hairline-2)'}}>
      <div className="row gap-sm">
        <span className="kvalue" style={{fontSize: 11, color: 'var(--ink-3)', width: 60}}>{date}</span>
        <div style={{width: 90, height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden', position: 'relative'}}>
          <div style={{width: Math.abs(depth)*8 + '%', maxWidth: '100%', height: '100%', background: 'var(--down)', position: 'absolute', right: 0}}></div>
        </div>
      </div>
      <div className="row gap-md mini" style={{fontFamily: 'var(--mono)'}}>
        <span style={{color: 'var(--down)', fontWeight: 600}}>{depth.toFixed(1).replace('.', ',')}%</span>
        <span>{duration}д</span>
        <span style={{color: 'var(--up)'}}>+{recovery}д ↻</span>
      </div>
    </div>
  );
}

function PositionRowFull({ pos, total, onClick }) {
  const share = pos.valRUB / total;
  const { asset } = pos;
  return (
    <tr className="row" onClick={onClick}>
      <td>
        <div className="ticker">
          <CURS_UI.AssetIcon asset={asset} size={34} />
          <div className="meta">
            <div className="nm">{asset.id}</div>
            <div className="sub">{asset.name}</div>
          </div>
        </div>
      </td>
      <td>
        <div className="col" style={{gap: 2}}>
          <span className="type-chip">{typeLabel2(asset.type)}</span>
          <span className="mini">{asset.sector}</span>
        </div>
      </td>
      <td className="num">
        <div className="col" style={{gap: 0, alignItems: 'flex-end'}}>
          <span>{pos.qty < 1 ? pos.qty.toFixed(3).replace('.', ',') : pos.qty.toLocaleString('ru-RU')}</span>
          <span className="mini" style={{color: 'var(--ink-3)'}}>ср. {CURS_DATA.fmtCcy(pos.avg, asset.ccy, { decimals: pos.avg > 1000 ? 0 : 2 })}</span>
        </div>
      </td>
      <td className="num">{CURS_DATA.fmtCcy(asset.cur, asset.ccy, { decimals: asset.cur > 1000 ? 0 : 2 })}</td>
      <td><CURS_CHARTS.Sparkline series={asset.series.slice(-30)} positive={pos.plPct >= 0} width={90} height={26} /></td>
      <td className="num">
        <div className="col" style={{gap: 4, alignItems: 'flex-end'}}>
          <span className="mask">{CURS_CHARTS.fmtMoneyCompact(pos.valRUB)} ₽</span>
          <div className="row gap-sm" style={{justifyContent: 'flex-end'}}>
            <div style={{width: 40, height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden'}}>
              <div style={{width: Math.min(100, share*100*2)+'%', height: '100%', background: 'var(--ink-3)'}}></div>
            </div>
            <span className="mini" style={{fontFamily: 'var(--mono)'}}>{(share*100).toFixed(1).replace('.', ',')}%</span>
          </div>
        </div>
      </td>
      <td className="num"><CURS_UI.PercentDelta value={pos.plPct} /></td>
      <td className="num"><CURS_UI.PercentDelta value={pos.dayPct} /></td>
    </tr>
  );
}

function typeLabel2(t) {
  return { stock_ru: 'RU акция', stock_us: 'US акция', bond: 'Облигация', etf: 'ETF', crypto: 'Крипто', custom: 'Альт.' }[t] || t;
}

// ============================================
// Position detail side panel
// ============================================
function PositionDetail({ position, open, onClose, portfolios }) {
  const [range, setRange] = pfUseState('1Г');
  const days = CURS_UI.RANGE_DAYS[range];
  if (!position) return null;
  const { asset } = position;
  const series = asset.series.slice(-days);
  const startV = series[0].v, endV = series[series.length-1].v;
  const deltaPct = (endV - startV)/startV;
  const ccySym = asset.ccy === 'RUB' ? '₽' : '$';

  // Transactions for this asset
  const txs = CURS_DATA.TX.filter(t => t.asset === asset.id);

  return (
    <>
      <div className={'side-backdrop ' + (open ? 'open':'')} onClick={onClose}></div>
      <div className={'side-panel ' + (open ? 'open':'')}>
        <div className="side-panel-header">
          <CURS_UI.AssetIcon asset={asset} size={40} />
          <div className="col" style={{gap: 0}}>
            <div className="row gap-sm">
              <span style={{fontWeight: 600, fontSize: 17}}>{asset.id}</span>
              <span className="type-chip">{typeLabel2(asset.type)}</span>
              <span className="type-chip">{asset.region}</span>
            </div>
            <div className="mini">{asset.name} · {asset.sector}</div>
          </div>
          <button className="btn icon ghost" onClick={onClose} style={{marginLeft: 'auto'}}>{CURS_UI.I.close()}</button>
        </div>

        <div className="side-panel-body">
          {/* Price + range */}
          <div className="row between" style={{marginBottom: 14}}>
            <div className="col" style={{gap: 4}}>
              <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>Цена</div>
              <div className="row" style={{gap: 8, alignItems: 'baseline'}}>
                <span className="mono" style={{fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em'}}>
                  {asset.cur > 1000 ? Math.round(asset.cur).toLocaleString('ru-RU') : asset.cur.toFixed(2).replace('.', ',')}
                </span>
                <span className="mini">{ccySym}</span>
                <CURS_UI.PercentDelta value={deltaPct} />
              </div>
            </div>
            <CURS_UI.RangeTabs value={range} onChange={setRange} />
          </div>

          {/* Chart with transaction markers */}
          <PriceChartWithTx series={series} txs={txs} ccy={ccySym} />

          <div className="hairline" style={{margin: '20px 0'}}></div>

          {/* Position stats */}
          <div className="grid grid-2" style={{marginBottom: 22}}>
            <div className="card flat">
              <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4}}>Ваша позиция</div>
              <div className="row" style={{gap: 14, alignItems: 'baseline'}}>
                <span className="mono mask" style={{fontSize: 22, fontWeight: 600}}>{CURS_CHARTS.fmtMoneyCompact(position.valRUB)} ₽</span>
                <CURS_UI.PercentDelta value={position.plPct} />
              </div>
              <div className="hairline" style={{margin: '14px 0'}}></div>
              <KV label="Количество" value={position.qty < 1 ? position.qty.toFixed(4).replace('.', ',') : position.qty.toLocaleString('ru-RU')} />
              <KV label="Средняя цена" value={CURS_DATA.fmtCcy(position.avg, asset.ccy, { decimals: position.avg > 1000 ? 0 : 2 })} />
              <KV label="Стоимость покупки" value={CURS_CHARTS.fmtMoneyCompact(position.costRUB) + ' ₽'} mask />
              <KV label="P&L нереализованный" value={(position.pl >= 0 ? '+' : '') + CURS_CHARTS.fmtMoneyCompact(position.pl) + ' ₽'} tone={position.pl >= 0 ? 'up' : 'down'} mask />
            </div>

            <div className="card flat">
              <div className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4}}>Рынок</div>
              <div className="row" style={{gap: 14, alignItems: 'baseline'}}>
                <span className="mono" style={{fontSize: 22, fontWeight: 600}}>
                  {asset.cur > 1000 ? Math.round(asset.cur).toLocaleString('ru-RU') : asset.cur.toFixed(2).replace('.', ',')} <span style={{fontSize: 14, color: 'var(--ink-3)'}}>{ccySym}</span>
                </span>
              </div>
              <div className="hairline" style={{margin: '14px 0'}}></div>
              <KV label="Изм. за день" value={<CURS_UI.PercentDelta value={position.dayPct} />} />
              <KV label="Изм. с покупки" value={<CURS_UI.PercentDelta value={position.plPct} />} />
              <KV label="Валюта" value={asset.ccy} />
              <KV label="Источник цен" value={asset.type === 'crypto' ? 'CoinGecko' : asset.type === 'custom' ? 'Ручной ввод' : asset.region === 'RU' ? 'MOEX API' : 'Yahoo Finance'} />
            </div>
          </div>

          {/* Fundamentals or valuation models */}
          {asset.type !== 'custom' && asset.type !== 'crypto' && asset.type !== 'bond' && (
            <>
              <h3 className="section-title lg" style={{marginBottom: 12}}>Фундаментальная оценка</h3>
              <div className="grid grid-3" style={{marginBottom: 22}}>
                <ValuationCard model="DCF" value={Math.round(asset.cur * 1.18).toLocaleString('ru-RU')} target="недооценен" delta={0.18} unit={ccySym} />
                <ValuationCard model="Gordon" value={Math.round(asset.cur * 0.92).toLocaleString('ru-RU')} target="оценен справедливо" delta={-0.08} unit={ccySym} />
                <ValuationCard model="CAPM β" value="1,12" target="чуть выше рынка" delta={0.12} />
              </div>
            </>
          )}

          {asset.type === 'custom' && (
            <div className="card flat" style={{marginBottom: 22}}>
              <div className="row gap-md">
                <div style={{flex: 1}}>
                  <h3 className="section-title lg" style={{marginBottom: 8}}>Ручная переоценка</h3>
                  <div className="mini" style={{marginBottom: 10}}>Для альтернативных активов (недвижимость, бизнес) цена обновляется вручную или через пользовательский API.</div>
                  <button className="btn sm">{CURS_UI.I.refresh()} Обновить оценку</button>
                </div>
                <div className="col" style={{gap: 4, alignItems: 'flex-end'}}>
                  <div className="mini">Последняя переоценка</div>
                  <div className="kvalue">12 дней назад</div>
                </div>
              </div>
            </div>
          )}

          {/* Transactions history */}
          <h3 className="section-title lg" style={{marginBottom: 12}}>История сделок ({txs.length})</h3>
          <div className="card" style={{padding: 0, marginBottom: 12}}>
            {txs.length === 0 && <div style={{padding: 20, color: 'var(--ink-3)', fontSize: 13}}>Нет сделок по активу</div>}
            {txs.map((t, i) => {
              const tm = txTypeMeta(t.type);
              return (
                <div key={t.id} className="row between" style={{padding: '12px 16px', borderBottom: i < txs.length-1 ? '1px solid var(--hairline-2)' : 'none'}}>
                  <div className="row gap-sm">
                    <div style={{width: 24, height: 24, borderRadius: 6, background: tm.bg, color: tm.color, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600}}>{tm.icon}</div>
                    <div className="col" style={{gap: 0}}>
                      <div style={{fontSize: 13, fontWeight: 500}}>{tm.label}</div>
                      <div className="mini">{CURS_CHARTS.fmtDateRu(t.d)}</div>
                    </div>
                  </div>
                  <div className="kvalue">
                    {t.qty < 1 ? t.qty.toFixed(3).replace('.', ',') : t.qty.toLocaleString('ru-RU')} × {t.price < 1000 ? t.price.toFixed(2) : Math.round(t.price).toLocaleString('ru-RU')} {ccySym}
                  </div>
                </div>
              );
            })}
          </div>

          <button className="btn" style={{width: '100%'}}>{CURS_UI.I.plus()} Добавить сделку по {asset.id}</button>
        </div>
      </div>
    </>
  );
}

function txTypeMeta(t) {
  return {
    buy: { label: 'Покупка', color: 'var(--up)', icon: '↑', bg: 'var(--up-soft)' },
    sell: { label: 'Продажа', color: 'var(--down)', icon: '↓', bg: 'var(--down-soft)' },
    div: { label: 'Дивиденд', color: 'var(--warn)', icon: '◆', bg: 'var(--warn-soft)' },
    in: { label: 'Пополнение', color: 'var(--ink-2)', icon: '＋', bg: 'var(--surface-3)' },
  }[t] || { label: t, color: 'var(--ink)', icon: '·', bg: 'var(--surface-3)' };
}

function PriceChartWithTx({ series, txs, ccy }) {
  const { useRef, useState, useEffect } = React;
  const wrapRef = useRef(null);
  const [w, setW] = useState(640);
  const height = 220;
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(280, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  const padT = 10, padB = 24;
  const innerH = height - padT - padB;
  const vals = series.map(p => p.v);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const pad = (maxV - minV) * 0.1;
  const yMin = minV - pad, yMax = maxV + pad;
  const x = i => i/(series.length-1) * w;
  const y = v => padT + innerH - (v - yMin)/(yMax-yMin) * innerH;
  const pts = series.map((p,i) => [x(i), y(p.v)]);
  let path = 'M '+pts[0][0]+' '+pts[0][1];
  for (let i=1;i<pts.length;i++) path += ' L '+pts[i][0]+' '+pts[i][1];
  const area = path + ` L ${pts[pts.length-1][0]} ${padT+innerH} L ${pts[0][0]} ${padT+innerH} Z`;

  // Map transactions onto chart
  const startDate = series[0].d, endDate = series[series.length-1].d;
  const totalMs = endDate - startDate;
  const txMarkers = txs
    .filter(t => t.d >= startDate && t.d <= endDate)
    .map(t => {
      const ratio = (t.d - startDate) / totalMs;
      const idx = Math.round(ratio * (series.length-1));
      return { ...t, x: x(idx), y: y(series[idx].v) };
    });

  return (
    <div ref={wrapRef} style={{width: '100%', height, position: 'relative'}}>
      <svg width={w} height={height}>
        <defs>
          <linearGradient id="posChartGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#15140F" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#15140F" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t,i)=>(
          <line key={i} x1="0" x2={w} y1={padT + innerH*t} y2={padT + innerH*t} stroke="#EFEBE0" strokeDasharray="2 3" />
        ))}
        <path d={area} fill="url(#posChartGrad)" />
        <path d={path} fill="none" stroke="#15140F" strokeWidth="1.6" />
        {txMarkers.map((t, i) => {
          const color = t.type === 'buy' ? 'var(--up)' : t.type === 'sell' ? 'var(--down)' : 'var(--warn)';
          return (
            <g key={i}>
              <line x1={t.x} x2={t.x} y1={padT} y2={padT+innerH} stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
              <circle cx={t.x} cy={t.y} r="6" fill="#fff" stroke={color} strokeWidth="2" />
              <text x={t.x} y={t.y + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>
                {t.type === 'buy' ? 'B' : t.type === 'sell' ? 'S' : 'D'}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mini" style={{marginTop: 4, display: 'flex', gap: 14}}>
        <span><span style={{display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', border: '2px solid var(--up)', marginRight: 4, verticalAlign: 'middle'}}></span>Покупка</span>
        <span><span style={{display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', border: '2px solid var(--down)', marginRight: 4, verticalAlign: 'middle'}}></span>Продажа</span>
        <span><span style={{display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', border: '2px solid var(--warn)', marginRight: 4, verticalAlign: 'middle'}}></span>Дивиденд</span>
        <span style={{marginLeft: 'auto'}}>{txMarkers.length} событий на графике</span>
      </div>
    </div>
  );
}

function KV({ label, value, tone, mask }) {
  const color = tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--ink)';
  return (
    <div className="row between" style={{padding: '6px 0', fontSize: 13}}>
      <span className="muted">{label}</span>
      <span className={'kvalue ' + (mask ? 'mask' : '')} style={{color, fontWeight: 500}}>{value}</span>
    </div>
  );
}

function ValuationCard({ model, value, target, delta, unit }) {
  const positive = delta >= 0;
  return (
    <div className="card flat">
      <div className="row between" style={{marginBottom: 8}}>
        <span className="type-chip">{model}</span>
        {delta != null && <CURS_UI.PercentDelta value={delta} />}
      </div>
      <div className="mono" style={{fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em'}}>{value} <span style={{fontSize: 13, color: 'var(--ink-3)'}}>{unit}</span></div>
      <div className="mini" style={{marginTop: 4}}>{target}</div>
    </div>
  );
}

window.CURS_PORTFOLIO = { PortfolioScreen, PositionDetail };
