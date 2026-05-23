// CURS — Main App
const { useState: appUseState, useEffect: appUseEffect, useMemo: appUseMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "cozy",
  "baseCcy": "RUB",
  "privacy": false,
  "accent": "#D7E041"
}/*EDITMODE-END*/;

function App() {
  const [route, setRoute] = appUseState('dashboard');
  const [activePortfolio, setActivePortfolio] = appUseState('main');
  const [openPos, setOpenPos] = appUseState(null);
  const [profileOpen, setProfileOpen] = appUseState(false);

  // Tweaks
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  appUseEffect(() => {
    document.documentElement.dataset.density = t.density;
    document.documentElement.dataset.privacy = t.privacy ? 'on' : 'off';
    document.documentElement.style.setProperty('--accent-2', t.accent);
  }, [t.density, t.privacy, t.accent]);

  const portfolios = CURS_DATA.PORTFOLIOS;
  const portfolio = portfolios.find(p => p.id === activePortfolio) || portfolios[0];

  const crumbs = appUseMemo(() => {
    if (route === 'dashboard') return ['CURS', 'Обзор'];
    if (route === 'portfolio') return ['CURS', 'Портфели', portfolio.name];
    if (route === 'analytics') return ['CURS', 'Аналитика', portfolio.name];
    if (route === 'compare') return ['CURS', 'Сравнение'];
    if (route === 'transactions') return ['CURS', 'Транзакции'];
    if (route === 'assets') return ['CURS', 'Активы'];
    if (route === 'reports') return ['CURS', 'Отчёты'];
    if (route === 'settings') return ['CURS', 'Настройки'];
    return ['CURS'];
  }, [route, portfolio]);

  function onOpenPosition(pos) {
    setOpenPos(pos);
  }

  function handleProfileNav(target) {
    if (target.startsWith('settings')) setRoute('settings');
    else if (target === 'reports') setRoute('reports');
    else if (target === 'docs') window.open('https://github.com', '_blank');
  }

  return (
    <div className="app">
      <CURS_UI.Sidebar
        route={route}
        setRoute={setRoute}
        portfolios={portfolios}
        activePortfolio={activePortfolio}
        setActivePortfolio={setActivePortfolio}
        onProfileClick={() => setProfileOpen(o => !o)}
        profileOpen={profileOpen}
      />
      <CURS_REPORTS.ProfileMenu
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onNavigate={handleProfileNav}
      />
      <main className="main">
        <CURS_UI.TopBar
          crumbs={crumbs}
          privacy={t.privacy}
          setPrivacy={v => setTweak('privacy', v)}
          baseCcy={t.baseCcy}
          setBaseCcy={v => setTweak('baseCcy', v)}
        />
        {route === 'dashboard' && <CURS_DASHBOARD.Dashboard portfolios={portfolios} baseCcy={t.baseCcy} onOpenPosition={onOpenPosition} />}
        {route === 'portfolio' && <CURS_PORTFOLIO.PortfolioScreen portfolio={portfolio} baseCcy={t.baseCcy} onOpenPosition={onOpenPosition} allPortfolios={portfolios} />}
        {route === 'analytics' && <CURS_ANALYTICS.AnalyticsScreen portfolio={portfolio} allPortfolios={portfolios} onOpenPosition={onOpenPosition} />}
        {route === 'compare' && <CURS_SCREENS.CompareScreen portfolios={portfolios} />}
        {route === 'transactions' && <CURS_SCREENS.TransactionsScreen portfolios={portfolios} onOpenPosition={onOpenPosition} />}
        {route === 'assets' && <CURS_SCREENS.AssetsScreen onOpenPosition={onOpenPosition} />}
        {route === 'reports' && <CURS_REPORTS.ReportsScreen portfolios={portfolios} />}
        {route === 'settings' && <CURS_REPORTS.SettingsScreen portfolios={portfolios} />}
      </main>

      <CURS_PORTFOLIO.PositionDetail
        position={openPos}
        open={!!openPos}
        onClose={() => setOpenPos(null)}
        portfolios={portfolios}
      />

      <TweaksPanel title="Оформление">
        <TweakSection label="Интерфейс">
          <TweakRadio label="Плотность" value={t.density}
            options={[{ value: 'cozy', label: 'Уютно' }, { value: 'compact', label: 'Плотно' }]}
            onChange={v => setTweak('density', v)} />
          <TweakColor label="Акцент" value={t.accent}
            options={['#D7E041', '#EE7544', '#4F6BED', '#86B0A0']}
            onChange={v => setTweak('accent', v)} />
        </TweakSection>
        <TweakSection label="Данные">
          <TweakRadio label="Валюта" value={t.baseCcy}
            options={[{ value: 'RUB', label: '₽ RUB' }, { value: 'USD', label: '$ USD' }]}
            onChange={v => setTweak('baseCcy', v)} />
          <TweakToggle label="Privacy режим" value={t.privacy} onChange={v => setTweak('privacy', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
