// CURS — UI primitives & icons
const { useState: cuUseState, useEffect: cuUseEffect } = React;

// ============================================
// Icons (24x24 inherit currentColor, stroke 1.6)
// ============================================
const I = {
  home: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z"/></svg>,
  briefcase: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>,
  chart: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/></svg>,
  compare: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7h7v13H3z"/><path d="M14 4h7v16h-7z"/></svg>,
  list: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/></svg>,
  cube: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>,
  settings: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.06.07a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.07a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.07a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.07a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.07a1.7 1.7 0 0 0-1.55 1z"/></svg>,
  search: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></svg>,
  plus: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  bell: (p={}) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>,
  arrow_up: (p={}) => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  arrow_down: (p={}) => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12l7 7 7-7"/></svg>,
  arrow_right: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  close: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  filter: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>,
  dl: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v12m-5-5l5 5 5-5M5 21h14"/></svg>,
  eye: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  eye_off: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.4 0-10-7-10-7a18.7 18.7 0 0 1 4.06-5.06M9.9 4.24A10.9 10.9 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 2.94M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20"/></svg>,
  refresh: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 0 1 14.7-6.94L21 8M21 4v4h-4M21 12a9 9 0 0 1-14.7 6.94L3 16M3 20v-4h4"/></svg>,
  doc: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></svg>,
  github: (p={}) => <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" {...p}><path d="M12 1.27a11 11 0 0 0-3.48 21.46c.55.1.75-.24.75-.53l-.01-1.86c-3.06.67-3.7-1.48-3.7-1.48-.5-1.27-1.22-1.6-1.22-1.6-1-.69.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.69 2.58 1.2 3.21.92.1-.72.39-1.2.7-1.48-2.45-.28-5.02-1.23-5.02-5.47 0-1.21.42-2.2 1.12-2.97-.12-.28-.49-1.42.1-2.95 0 0 .92-.3 3 1.13a10.4 10.4 0 0 1 5.46 0c2.08-1.43 3-1.13 3-1.13.6 1.53.22 2.67.11 2.95.7.77 1.12 1.76 1.12 2.97 0 4.26-2.58 5.18-5.03 5.46.4.34.76 1.02.76 2.05l-.01 3.04c0 .3.2.64.76.53A11 11 0 0 0 12 1.27"/></svg>,
};

// ============================================
// Sidebar
// ============================================
function Sidebar({ route, setRoute, portfolios, activePortfolio, setActivePortfolio, onProfileClick, profileOpen }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">C</div>
        <div className="name">CURS</div>
        <div className="badge">v0.4</div>
      </div>

      <NavMenu route={route} setRoute={setRoute} portfolios={portfolios} activePortfolio={activePortfolio} setActivePortfolio={setActivePortfolio} />

      <div className="footer" style={{position: 'relative'}}>
        <div className="row gap-sm" style={{padding: '8px 10px', fontSize: 11, color: 'var(--ink-3)'}}>
          {I.github({width: 12, height: 12})}<span>self-hosted · v0.4.2</span>
          <span style={{marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4}}>
            <span style={{width: 6, height: 6, borderRadius: '50%', background: 'var(--up)'}}></span>
            <span style={{fontFamily: 'var(--mono)'}}>online</span>
          </span>
        </div>
        <button className="user-card" onClick={onProfileClick} style={{width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid ' + (profileOpen ? 'var(--ink)' : 'var(--hairline)'), padding: 10}}>
          <div className="ava">МР</div>
          <div className="who" style={{flex: 1}}>
            Максим Родиков
            <small>maxim@curs.local</small>
          </div>
          <span style={{color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12, transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s'}}>⌄</span>
        </button>
      </div>
    </aside>
  );
}

function NavMenu({ route, setRoute, portfolios, activePortfolio, setActivePortfolio }) {
  return (
    <nav className="nav" style={{marginTop: 4, flex: 1, overflow: 'auto'}}>
      <NavItem icon={I.home()} label="Обзор" active={route==='dashboard'} onClick={()=>setRoute('dashboard')} />
      <NavItem icon={I.briefcase()} label="Портфели" count={portfolios.length} active={route==='portfolio'} onClick={()=>setRoute('portfolio')} />
      <div className="nav-sub">
        {portfolios.map(p => (
          <div key={p.id} className={'nav-sub-item ' + (route==='portfolio' && activePortfolio===p.id ? 'active':'')} onClick={() => { setRoute('portfolio'); setActivePortfolio(p.id); }}>
            <span className="dot" style={{ background: p.color }}></span>
            {p.name}
          </div>
        ))}
      </div>
      <NavItem icon={I.chart()} label="Аналитика" active={route==='analytics'} onClick={()=>setRoute('analytics')} />
      <NavItem icon={I.compare()} label="Сравнение" active={route==='compare'} onClick={()=>setRoute('compare')} />
      <NavItem icon={I.list()} label="Транзакции" count={CURS_DATA.TX.length} active={route==='transactions'} onClick={()=>setRoute('transactions')} />
      <NavItem icon={I.cube()} label="Активы" active={route==='assets'} onClick={()=>setRoute('assets')} />

      <div className="nav-section">Инструменты</div>
      <NavItem icon={I.doc()} label="Отчёты" active={route==='reports'} onClick={()=>setRoute('reports')} />
      <NavItem icon={I.settings()} label="Настройки" active={route==='settings'} onClick={()=>setRoute('settings')} />
    </nav>
  );
}

function NavItem({ icon, label, count, active, onClick }) {
  return (
    <div className={'nav-item ' + (active ? 'active' : '')} onClick={onClick}>
      <span className="ic">{icon}</span>
      {label}
      {count != null && <span className="count">{count}</span>}
    </div>
  );
}

// ============================================
// TopBar
// ============================================
function TopBar({ crumbs, right, privacy, setPrivacy, baseCcy, setBaseCcy }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length-1 ? 'here':''}>{c}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="actions">
        <div className="search">
          {I.search()}
          <input placeholder="Поиск" />
          <span className="kbd">⌘ K</span>
        </div>
        <button className="btn icon ghost" title={privacy ? 'Показать суммы' : 'Скрыть суммы'} onClick={() => setPrivacy(!privacy)}>
          {privacy ? I.eye_off() : I.eye()}
        </button>
        <button className="btn ghost" onClick={() => setBaseCcy(baseCcy === 'RUB' ? 'USD' : 'RUB')}>
          <span className="mono" style={{fontSize: 11}}>{baseCcy}</span>
        </button>
        <button className="btn">{I.refresh()}<span>Обновить</span></button>
        <button className="btn primary">{I.plus()}<span>Сделка</span></button>
      </div>
    </div>
  );
}

// ============================================
// AssetIcon
// ============================================
function AssetIcon({ asset, size = 28 }) {
  return (
    <div className={'icon ' + asset.icon} style={{width: size, height: size, fontSize: size > 30 ? 13 : 11}}>
      {asset.id.slice(0,3) === 'OFZ' ? 'ОФЗ' : asset.id.slice(0,3)}
    </div>
  );
}

// ============================================
// Range tabs
// ============================================
function RangeTabs({ value, onChange, options = ['1Д','1Н','1М','3М','1Г','Всё'] }) {
  return (
    <div className="range-tabs">
      {options.map(o => (
        <div key={o} className={'range-tab ' + (value===o ? 'active':'')} onClick={()=>onChange(o)}>{o}</div>
      ))}
    </div>
  );
}

// Days for each range
const RANGE_DAYS = { '1Д': 2, '1Н': 7, '1М': 31, '3М': 92, '1Г': 365, 'Всё': 365 };

// ============================================
// PercentDelta — show ▲ x.xx% colored
// ============================================
function PercentDelta({ value, abs, withDelta = false, prefix = '' }) {
  const positive = value >= 0;
  return (
    <span className={'mono ' + (positive ? 'delta up' : 'delta down')} style={{fontWeight: 600}}>
      {prefix}{positive ? '▲' : '▼'} {(Math.abs(value)*100).toFixed(2).replace('.', ',')}%
      {withDelta && abs != null && (
        <span style={{color: positive ? 'var(--up)' : 'var(--down)', fontWeight: 500, marginLeft: 6}}>
          {positive ? '+' : ''}{CURS_DATA.fmtRUB(abs, { compact: true })}
        </span>
      )}
    </span>
  );
}

// ============================================
// Section header
// ============================================
function SectionHeader({ title, sub, right }) {
  return (
    <div className="row between" style={{marginBottom: 14, alignItems: 'flex-end'}}>
      <div>
        <div className="section-title lg">{title}{sub && <span className="sub">{sub}</span>}</div>
      </div>
      {right && <div className="row gap-sm">{right}</div>}
    </div>
  );
}

window.CURS_UI = { I, Sidebar, TopBar, AssetIcon, RangeTabs, RANGE_DAYS, PercentDelta, SectionHeader };
