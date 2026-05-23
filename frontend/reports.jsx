// CURS — Reports + Settings screens + Profile dropdown
const { useState: rsUseState, useMemo: rsUseMemo, useEffect: rsUseEffect } = React;

// ============================================
// Reports
// ============================================
function ReportsScreen({ portfolios }) {
  const [activePortfolio, setActivePortfolio] = rsUseState(portfolios[0].id);
  const [period, setPeriod] = rsUseState('Q4 2025 – Q1 2026');
  const [format, setFormat] = rsUseState('pdf');
  const [sections, setSections] = rsUseState({
    summary: true, holdings: true, allocation: true, performance: true,
    risk: true, transactions: false, valuation: false, mc: false,
  });

  const portfolio = portfolios.find(p => p.id === activePortfolio);

  const PRESET_REPORTS = [
    { id: 'quarterly', name: 'Квартальный отчёт', desc: 'Сводка, метрики и динамика за квартал', sections: 6, color: '#15140F' },
    { id: 'tax', name: 'Налоговый (3-НДФЛ)', desc: 'Реализованный P&L и дивиденды для ФНС', sections: 4, color: '#4F6BED' },
    { id: 'rebalance', name: 'Перед ребалансировкой', desc: 'Текущие веса vs целевые, что докупить/продать', sections: 5, color: '#EE7544' },
    { id: 'audit', name: 'Аудит транзакций', desc: 'Полный список операций со сверкой', sections: 2, color: '#86B0A0' },
  ];

  const HISTORY = [
    { d: 'сегодня, 14:32', name: 'Квартальный · Q1 2026', portfolio: 'Основной', format: 'PDF', size: '480 КБ', status: 'ready' },
    { d: '12 мая', name: 'Налоговый · 2025', portfolio: 'Основной', format: 'PDF', size: '212 КБ', status: 'ready' },
    { d: '01 мая', name: 'Перед ребалансировкой', portfolio: 'Долгосрочный', format: 'PDF', size: '320 КБ', status: 'ready' },
    { d: '14 апр',  name: 'Аудит · март', portfolio: 'Все', format: 'CSV', size: '38 КБ', status: 'ready' },
    { d: '02 апр',  name: 'Квартальный · Q4 2025', portfolio: 'Основной', format: 'PDF', size: '460 КБ', status: 'ready' },
  ];

  const sectionList = [
    { id: 'summary', label: 'Сводка', desc: 'Стоимость, P&L, ключевые метрики' },
    { id: 'holdings', label: 'Состав портфеля', desc: 'Все позиции с долями' },
    { id: 'allocation', label: 'Распределение', desc: 'По классам, секторам, валютам' },
    { id: 'performance', label: 'Динамика', desc: 'Equity-кривая и периоды' },
    { id: 'risk', label: 'Риск-метрики', desc: 'σ, Sharpe, MaxDD, VaR' },
    { id: 'transactions', label: 'Сделки', desc: 'Все операции за период' },
    { id: 'valuation', label: 'Фундаментальная оценка', desc: 'DCF, Gordon, P/E' },
    { id: 'mc', label: 'Монте-Карло прогноз', desc: 'Симуляции и доверит. интервалы' },
  ];

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="row gap-sm" style={{marginBottom: 6}}>
            <span className="pill ghost">Самостоятельная сборка</span>
          </div>
          <div className="title">Отчёты</div>
          <div className="sub">Соберите PDF или CSV с нужными разделами — или используйте готовый шаблон</div>
        </div>
      </div>

      {/* Presets */}
      <CURS_UI.SectionHeader title="Готовые шаблоны" sub="один клик — отчёт" />
      <div className="grid grid-4" style={{gap: 14, marginBottom: 28}}>
        {PRESET_REPORTS.map(p => (
          <div key={p.id} className="card" style={{cursor: 'pointer'}}>
            <div className="row between" style={{marginBottom: 12}}>
              <span style={{width: 28, height: 28, borderRadius: 7, background: p.color, display: 'grid', placeItems: 'center', color: 'white', fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)'}}>{p.id.slice(0,1).toUpperCase()}</span>
              <span className="pill">{p.sections} разделов</span>
            </div>
            <div style={{fontWeight: 600, fontSize: 14, marginBottom: 4}}>{p.name}</div>
            <div className="mini" style={{marginBottom: 14, lineHeight: 1.4}}>{p.desc}</div>
            <button className="btn sm" style={{width: '100%', justifyContent: 'center'}}>{CURS_UI.I.dl()} Сгенерировать</button>
          </div>
        ))}
      </div>

      {/* Custom builder */}
      <CURS_UI.SectionHeader title="Свой отчёт" sub="выберите разделы и формат" />
      <div className="grid" style={{gridTemplateColumns: '1.4fr 1fr', marginBottom: 28}}>
        <div className="card">
          <div className="row between" style={{marginBottom: 16}}>
            <div className="col" style={{gap: 4}}>
              <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>Источник</span>
              <div className="row gap-sm">
                <select className="btn" value={activePortfolio} onChange={e=>setActivePortfolio(e.target.value)} style={{padding: '0 12px'}}>
                  <option value="all">Все портфели</option>
                  {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="btn" value={period} onChange={e=>setPeriod(e.target.value)} style={{padding: '0 12px'}}>
                  <option>Текущий квартал</option>
                  <option>Прошлый квартал</option>
                  <option>Год к дате (YTD)</option>
                  <option>Всё время</option>
                  <option>Произвольно…</option>
                </select>
              </div>
            </div>
            <div className="col" style={{gap: 4, alignItems: 'flex-end'}}>
              <span className="mini" style={{textTransform: 'uppercase', letterSpacing: '0.05em'}}>Формат</span>
              <div className="tabs">
                <div className={'tab ' + (format==='pdf'?'active':'')} onClick={()=>setFormat('pdf')}>PDF</div>
                <div className={'tab ' + (format==='csv'?'active':'')} onClick={()=>setFormat('csv')}>CSV</div>
                <div className={'tab ' + (format==='xlsx'?'active':'')} onClick={()=>setFormat('xlsx')}>XLSX</div>
              </div>
            </div>
          </div>

          <div className="hairline" style={{margin: '4px 0 16px'}}></div>

          <div className="col" style={{gap: 8}}>
            {sectionList.map(s => (
              <label key={s.id} className="row between" style={{padding: '10px 12px', borderRadius: 8, background: sections[s.id] ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', border: '1px solid ' + (sections[s.id] ? 'var(--hairline)' : 'transparent')}}>
                <div className="col" style={{gap: 2}}>
                  <span style={{fontSize: 13, fontWeight: 500}}>{s.label}</span>
                  <span className="mini">{s.desc}</span>
                </div>
                <Toggle on={sections[s.id]} onClick={() => setSections({...sections, [s.id]: !sections[s.id]})} />
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row between" style={{marginBottom: 14}}>
            <h3 className="section-title lg">Предпросмотр</h3>
            <span className="pill">{Object.values(sections).filter(Boolean).length} разделов</span>
          </div>
          <PreviewDoc portfolio={portfolio} sections={sections} period={period} format={format} />
          <div className="hairline" style={{margin: '14px 0'}}></div>
          <button className="btn primary" style={{width: '100%', justifyContent: 'center'}}>{CURS_UI.I.dl()} Скачать .{format}</button>
          <div className="mini" style={{marginTop: 10, textAlign: 'center'}}>Файл сохранится локально — никуда не отправляется</div>
        </div>
      </div>

      {/* History */}
      <CURS_UI.SectionHeader title="История" sub={`${HISTORY.length} отчётов`} right={
        <button className="btn sm ghost">Очистить старые →</button>
      } />
      <div className="card" style={{padding: 0}}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Отчёт</th>
                <th>Портфель</th>
                <th>Формат</th>
                <th className="num">Размер</th>
                <th>Создан</th>
                <th style={{width: 200}}></th>
              </tr>
            </thead>
            <tbody>
              {HISTORY.map((h,i) => (
                <tr key={i} className="row">
                  <td>
                    <div className="ticker">
                      <span style={{width: 28, height: 28, borderRadius: 7, background: 'var(--surface-3)', display: 'grid', placeItems: 'center'}}>{CURS_UI.I.doc()}</span>
                      <div className="meta">
                        <div className="nm">{h.name}</div>
                        <div className="sub">сгенерирован Максимом</div>
                      </div>
                    </div>
                  </td>
                  <td><span style={{fontSize: 12}}>{h.portfolio}</span></td>
                  <td><span className="type-chip">{h.format}</span></td>
                  <td className="num"><span className="kvalue">{h.size}</span></td>
                  <td><span className="mini">{h.d}</span></td>
                  <td>
                    <div className="row gap-sm" style={{justifyContent: 'flex-end'}}>
                      <button className="btn sm ghost">Открыть</button>
                      <button className="btn sm">{CURS_UI.I.dl()} Скачать</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button onClick={(e) => { e.preventDefault(); onClick(); }} style={{
      width: 36, height: 20, borderRadius: 10,
      background: on ? 'var(--ink)' : 'var(--surface-3)',
      border: 'none', cursor: 'pointer', position: 'relative',
      transition: 'background .15s'
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: 'white', transition: 'left .15s',
        boxShadow: '0 1px 2px rgba(0,0,0,.15)'
      }}></span>
    </button>
  );
}

function rsMail() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
}

function PreviewDoc({ portfolio, sections, period, format }) {
  return (
    <div style={{
      background: 'var(--surface-2)', borderRadius: 10, padding: 18,
      aspectRatio: '0.71/1', display: 'flex', flexDirection: 'column', gap: 10
    }}>
      <div className="row between">
        <span style={{fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em'}}>CURS · отчёт</span>
        <span style={{fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--ink-3)'}}>{period}</span>
      </div>
      <div style={{fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', marginTop: 4}}>{portfolio?.name || 'Все портфели'}</div>
      <div className="hairline"></div>
      {sections.summary && <SkPara w={[100, 70]} title="Сводка" />}
      {sections.holdings && <SkPara w={[100, 100, 60]} title="Состав" rows={3} />}
      {sections.allocation && <SkChart />}
      {sections.performance && <SkChart />}
      {sections.risk && <SkPara w={[100, 80]} title="Риск" />}
      {sections.transactions && <SkPara w={[100, 100]} title="Сделки" rows={2} />}
      {sections.valuation && <SkPara w={[100, 90, 70]} title="Оценка" rows={2} />}
      {sections.mc && <SkChart />}
      <div style={{flex: 1}}></div>
      <div className="row between" style={{fontSize: 8, color: 'var(--ink-4)', fontFamily: 'var(--mono)'}}>
        <span>self-hosted · CURS v0.4</span>
        <span>стр. 1</span>
      </div>
    </div>
  );
}

function SkPara({ w, title, rows = 1 }) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
      {title && <div style={{fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--ink-3)', textTransform: 'uppercase'}}>{title}</div>}
      {Array.from({length: rows}).map((_,r) => (
        <div key={r} style={{display: 'flex', flexDirection: 'column', gap: 2}}>
          {w.map((p,i) => <div key={i} style={{height: 3, width: p+'%', background: 'var(--hairline)'}}></div>)}
        </div>
      ))}
    </div>
  );
}
function SkChart() {
  return (
    <div style={{height: 30, background: 'var(--surface-3)', borderRadius: 4, display: 'flex', alignItems: 'flex-end', padding: 3, gap: 1}}>
      {[40, 60, 55, 75, 80, 70, 90].map((h,i) => <div key={i} style={{flex: 1, height: h+'%', background: 'var(--ink)', opacity: 0.4, borderRadius: 1}}></div>)}
    </div>
  );
}

// ============================================
// Settings — minimal, self-hosted single user
// ============================================
function SettingsScreen({ portfolios }) {
  const [tab, setTab] = rsUseState('account');
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="title">Настройки</div>
          <div className="sub">Локальные предпочтения, источники цен и данные — всё хранится на этой машине</div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'flex-start'}}>
        <div className="col" style={{gap: 2, position: 'sticky', top: 90}}>
          {[
            ['account', 'Аккаунт', '👤'],
            ['providers', 'Источники цен', '⚡'],
            ['display', 'Внешний вид', '◐'],
            ['data', 'Данные', '⛁'],
            ['instance', 'Инстанс', '⚙'],
          ].map(([k, l, ic]) => (
            <button key={k} onClick={()=>setTab(k)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8,
              textAlign: 'left', fontSize: 13, fontWeight: 500,
              background: tab===k ? 'var(--ink)' : 'transparent',
              color: tab===k ? 'var(--surface)' : 'var(--ink-2)',
              cursor: 'pointer', border: 'none', width: '100%'
            }}>
              <span style={{fontSize: 14, opacity: 0.8}}>{ic}</span>
              {l}
            </button>
          ))}
        </div>

        <div className="col" style={{gap: 22}}>
          {tab === 'account' && <SettingsAccount />}
          {tab === 'providers' && <SettingsProviders />}
          {tab === 'display' && <SettingsDisplay />}
          {tab === 'data' && <SettingsData portfolios={portfolios} />}
          {tab === 'instance' && <SettingsInstance />}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ title, desc, children }) {
  return (
    <div className="card">
      <div style={{marginBottom: 16}}>
        <h3 className="section-title lg" style={{marginBottom: 4}}>{title}</h3>
        {desc && <div className="mini">{desc}</div>}
      </div>
      <div className="col" style={{gap: 14}}>{children}</div>
    </div>
  );
}

function SettingsRow({ label, hint, children }) {
  return (
    <div className="row between" style={{gap: 16, padding: '8px 0', borderBottom: '1px solid var(--hairline-2)'}}>
      <div className="col" style={{gap: 2, minWidth: 0, flex: 1}}>
        <span style={{fontSize: 13, fontWeight: 500}}>{label}</span>
        {hint && <span className="mini">{hint}</span>}
      </div>
      <div style={{flexShrink: 0}}>{children}</div>
    </div>
  );
}

function SettingsAccount() {
  return (
    <>
      <SettingsCard title="Профиль" desc="Self-hosted: данные хранятся локально, никуда не уходят">
        <div className="row" style={{gap: 16, alignItems: 'center'}}>
          <div className="ava" style={{width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-3), var(--accent-4))', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 20}}>МР</div>
          <div className="col" style={{gap: 2}}>
            <div style={{fontSize: 16, fontWeight: 600}}>Максим Родиков</div>
            <div className="mini">локально · maxim@curs.local · с 04.2024</div>
          </div>
        </div>
        <div className="hairline"></div>
        <SettingsRow label="Имя для отображения" hint="Показывается в отчётах и заголовках">
          <input className="btn" style={{width: 240, padding: '0 12px'}} defaultValue="Максим Родиков" />
        </SettingsRow>
        <SettingsRow label="Email" hint="Для уведомлений и адресата отчётов">
          <input className="btn" style={{width: 240, padding: '0 12px'}} defaultValue="maxim@curs.local" />
        </SettingsRow>
        <SettingsRow label="Часовой пояс" hint="Влияет на отметки времени сделок">
          <select className="btn" style={{padding: '0 12px'}}>
            <option>Europe/Moscow (UTC+3)</option>
            <option>Europe/London (UTC+0)</option>
            <option>America/New_York (UTC−5)</option>
          </select>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Локальная защита" desc="Только эта машина — никаких внешних сервисов">
        <SettingsRow label="Пароль входа" hint="Защищает интерфейс при открытом ноуте">
          <button className="btn">Сменить</button>
        </SettingsRow>
        <SettingsRow label="Автоблокировка" hint="Запрашивать пароль после простоя">
          <select className="btn" style={{padding: '0 12px'}}><option>15 минут</option><option>1 час</option><option>Никогда</option></select>
        </SettingsRow>
        <SettingsRow label="Шифрование БД" hint="Зашифровать локальный PostgreSQL ключом">
          <Toggle on={false} onClick={()=>{}} />
        </SettingsRow>
      </SettingsCard>
    </>
  );
}

function SettingsProviders() {
  const PROVIDERS = [
    { id: 'moex', name: 'Московская биржа', desc: 'Акции, ОФЗ, фьючерсы (MOEX API)', covered: 'SBER, GAZP, YNDX, LKOH, ОФЗ…', status: 'on', auth: 'Не требуется' },
    { id: 'tinvest', name: 'T-Invest API', desc: 'Импорт сделок из брокерского счёта', covered: 'операции, котировки', status: 'on', auth: 'gRPC токен' },
    { id: 'yahoo', name: 'Yahoo Finance', desc: 'Зарубежные акции и ETF', covered: 'AAPL, MSFT, NVDA, SPY…', status: 'on', auth: 'Не требуется' },
    { id: 'coingecko', name: 'CoinGecko', desc: 'Криптовалюты', covered: 'BTC, ETH, +13 000 монет', status: 'on', auth: 'Не требуется' },
    { id: 'custom', name: 'Пользовательский API', desc: 'Любая альт. цена через свой endpoint', covered: 'FLAT_MSK, бизнес-доли', status: 'on', auth: 'Локально' },
    { id: 'manual', name: 'Ручной ввод', desc: 'Без API — обновляете цены сами', covered: 'неликвидные активы', status: 'on', auth: '—' },
  ];
  return (
    <SettingsCard title="Источники цен" desc="Подключаемые провайдеры — токены хранятся локально">
      {PROVIDERS.map(p => (
        <div key={p.id} className="row between" style={{padding: '12px 0', borderBottom: '1px solid var(--hairline-2)', alignItems: 'flex-start', gap: 14}}>
          <div className="row gap-sm" style={{minWidth: 0, flex: 1}}>
            <span style={{width: 32, height: 32, borderRadius: 7, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, flexShrink: 0}}>{p.id.slice(0,3).toUpperCase()}</span>
            <div className="col" style={{gap: 4, minWidth: 0}}>
              <div className="row gap-sm">
                <span style={{fontSize: 14, fontWeight: 500}}>{p.name}</span>
                <span className="pill up">●&nbsp;Активен</span>
              </div>
              <span className="mini">{p.desc}</span>
              <div className="row gap-sm" style={{marginTop: 2, fontFamily: 'var(--mono)', fontSize: 10}}>
                <span className="muted">Auth:</span>
                <span style={{color: 'var(--ink)'}}>{p.auth}</span>
              </div>
            </div>
          </div>
          <div className="row gap-sm" style={{flexShrink: 0}}>
            <button className="btn sm ghost">Настроить</button>
            <button className="btn sm">Тест</button>
          </div>
        </div>
      ))}
      <button className="btn" style={{width: '100%', justifyContent: 'center'}}>{CURS_UI.I.plus()} Добавить свой провайдер</button>
    </SettingsCard>
  );
}

function SettingsDisplay() {
  return (
    <>
      <SettingsCard title="Тема и плотность" desc="Эти параметры дублируются в панели Tweaks (правый нижний угол)">
        <SettingsRow label="Базовая тема" hint="Светлая фиксирована в этой версии — тёмная скоро">
          <div className="tabs">
            <div className="tab active">☀ Светлая</div>
            <div className="tab" style={{opacity: 0.5}}>🌙 Тёмная</div>
            <div className="tab" style={{opacity: 0.5}}>Авто</div>
          </div>
        </SettingsRow>
        <SettingsRow label="Плотность интерфейса" hint="Уютно — больше воздуха, плотно — больше данных в кадре">
          <div className="tabs">
            <div className="tab active">Уютно</div>
            <div className="tab">Плотно</div>
          </div>
        </SettingsRow>
        <SettingsRow label="Акцентный цвет">
          <div className="row gap-sm">
            {['#D7E041','#EE7544','#4F6BED','#86B0A0'].map(c => (
              <button key={c} style={{width: 22, height: 22, borderRadius: '50%', background: c, border: c === '#D7E041' ? '2px solid var(--ink)' : '1px solid var(--hairline)', cursor: 'pointer'}}></button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Privacy режим" hint="Маскирует все суммы блюром">
          <Toggle on={false} onClick={()=>{}} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Графики и данные">
        <SettingsRow label="Тип основного графика" hint="Можно поменять локально на каждом экране">
          <div className="tabs">
            <div className="tab active">Линия</div>
            <div className="tab">Площадь</div>
            <div className="tab">Свечи</div>
          </div>
        </SettingsRow>
        <SettingsRow label="Бенчмарк" hint="С чем сравнивать ваш портфель">
          <select className="btn" style={{padding: '0 12px'}}><option>IMOEX</option><option>S&P 500</option><option>NASDAQ-100</option><option>Своё</option></select>
        </SettingsRow>
        <SettingsRow label="Безрисковая ставка" hint="Используется в расчёте Sharpe Ratio">
          <input className="btn" style={{width: 120, padding: '0 12px', textAlign: 'right'}} defaultValue="7.50 %" />
        </SettingsRow>
        <SettingsRow label="Округление сумм" hint="В таблицах и сводках">
          <select className="btn" style={{padding: '0 12px'}}><option>Автоматически</option><option>До рубля</option><option>До тысяч</option></select>
        </SettingsRow>
      </SettingsCard>
    </>
  );
}

function SettingsNotifications() {
  return (
    <SettingsCard title="Уведомления" desc="Куда CURS должен писать о портфеле — все каналы локальные">
      <SettingsRow label="Резкие движения цены" hint="Если позиция меняется > 5% за сутки">
        <Toggle on={true} onClick={()=>{}} />
      </SettingsRow>
      <SettingsRow label="Перекос в портфеле" hint="Если доля класса вышла за целевую">
        <Toggle on={false} onClick={()=>{}} />
      </SettingsRow>
      <SettingsRow label="Дивиденды и купоны" hint="Когда зачислены">
        <Toggle on={true} onClick={()=>{}} />
      </SettingsRow>
      <SettingsRow label="Ошибка получения котировок" hint="Если провайдер не отвечает">
        <Toggle on={true} onClick={()=>{}} />
      </SettingsRow>
      <div className="hairline"></div>
      <SettingsRow label="Канал доставки" hint="Telegram-бот или вебхук">
        <div className="tabs">
          <div className="tab active">Telegram</div>
          <div className="tab">Webhook</div>
          <div className="tab">Только в UI</div>
        </div>
      </SettingsRow>
      <SettingsRow label="Telegram chat ID" hint="Куда писать">
        <input className="btn" style={{width: 200, padding: '0 12px', fontFamily: 'var(--mono)'}} defaultValue="123456789" />
      </SettingsRow>
    </SettingsCard>
  );
}

function SettingsData({ portfolios }) {
  return (
    <>
      <SettingsCard title="Импорт" desc="Загрузка операций и портфелей из внешних систем">
        <div className="grid grid-2" style={{gap: 14}}>
          <ImportCard name="Брокерский отчёт" desc="XLSX / PDF от Сбер, Тинькофф, ВТБ" icon="📥" />
          <ImportCard name="CSV транзакций" desc="Своя структура, маппинг колонок" icon="↧" />
          <ImportCard name="Cryptofolio" desc="Открытый формат портфелей" icon="₿" />
          <ImportCard name="Google Sheets" desc="Прямая синхронизация" icon="⊞" />
        </div>
      </SettingsCard>
      <SettingsCard title="Экспорт" desc="Заберите свои данные в любой момент">
        <SettingsRow label="Все транзакции в CSV" hint={`${CURS_DATA.TX.length} записей`}>
          <button className="btn">{CURS_UI.I.dl()} Скачать</button>
        </SettingsRow>
        <SettingsRow label="Снимки портфелей" hint="Исторические значения каждого портфеля">
          <button className="btn">{CURS_UI.I.dl()} CSV / JSON</button>
        </SettingsRow>
        <SettingsRow label="Полный бэкап" hint="ZIP-архив со всем содержимым (БД + конфиг)">
          <button className="btn">{CURS_UI.I.dl()} Скачать бэкап</button>
        </SettingsRow>
      </SettingsCard>
      <SettingsCard title="Хранилище" desc="Локальная база данных">
        <SettingsRow label="Расположение БД" hint="PostgreSQL · self-hosted">
          <span className="kvalue" style={{fontSize: 12}}>/var/lib/curs/db</span>
        </SettingsRow>
        <SettingsRow label="Размер" hint="Все портфели + кэш котировок">
          <span className="kvalue">128.4 МБ</span>
        </SettingsRow>
        <SettingsRow label="Последний бэкап" hint="Автоматически еженедельно">
          <span className="kvalue">19 мая, 03:00</span>
        </SettingsRow>
      </SettingsCard>
    </>
  );
}

function ImportCard({ name, desc, icon }) {
  return (
    <div style={{padding: 14, border: '1px solid var(--hairline)', borderRadius: 10, cursor: 'pointer'}}>
      <div style={{fontSize: 20, marginBottom: 8}}>{icon}</div>
      <div style={{fontSize: 13, fontWeight: 500, marginBottom: 2}}>{name}</div>
      <div className="mini" style={{marginBottom: 10}}>{desc}</div>
      <button className="btn sm" style={{width: '100%', justifyContent: 'center'}}>Открыть</button>
    </div>
  );
}

function SettingsInstance() {
  return (
    <>
      <SettingsCard title="Инстанс" desc="Параметры этого self-hosted развёртывания">
        <SettingsRow label="Версия CURS" hint="GitHub: curs/curs">
          <span className="kvalue">v0.4.2 (build 247)</span>
        </SettingsRow>
        <SettingsRow label="Backend" hint="FastAPI + Celery + Redis + PostgreSQL">
          <span className="kvalue" style={{color: 'var(--up)'}}>● healthy · 21д uptime</span>
        </SettingsRow>
        <SettingsRow label="БД" hint="Размер локальной базы">
          <span className="kvalue">128,4 МБ</span>
        </SettingsRow>
        <SettingsRow label="Воркеры цен" hint="Фоновое обновление котировок">
          <span className="kvalue">3 активных · обновл. каждые 60 сек</span>
        </SettingsRow>
        <SettingsRow label="Логи">
          <button className="btn">Открыть journalctl</button>
        </SettingsRow>
        <SettingsRow label="Перезапуск Docker">
          <button className="btn">docker compose restart</button>
        </SettingsRow>
      </SettingsCard>
      <SettingsCard title="Расширения" desc="Кастомные модули как в Obsidian — кладёте в /extensions и оно подтягивается">
        <ExtRow name="moex-bonds-deep" desc="Расширенные параметры облигаций MOEX (купоны, дюрация)" on />
        <ExtRow name="dividend-calendar" desc="Календарь дивидендов и купонов" on />
        <ExtRow name="ai-commentary" desc="LLM-комментарии к динамике портфеля (Haiku)" off />
        <ExtRow name="tax-ru-2026" desc="ФНС-форма 3-НДФЛ по сделкам" off />
        <button className="btn ghost" style={{width: '100%'}}>Каталог расширений на GitHub →</button>
      </SettingsCard>
      <div className="card" style={{borderColor: 'var(--down-soft)', background: 'var(--down-soft)'}}>
        <div className="row between" style={{alignItems: 'flex-start', gap: 14}}>
          <div>
            <h4 style={{fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--down-ink)'}}>Сбросить инстанс</h4>
            <div className="mini" style={{marginTop: 4, color: 'var(--down-ink)'}}>Удалит локальную БД, кэш и настройки. Все данные пропадут — сделайте бэкап.</div>
          </div>
          <button className="btn" style={{background: 'var(--down)', color: 'white', borderColor: 'var(--down)', flexShrink: 0}}>Сбросить</button>
        </div>
      </div>
    </>
  );
}

function ExtRow({ name, desc, on }) {
  return (
    <div className="row between" style={{padding: '8px 0', borderBottom: '1px solid var(--hairline-2)'}}>
      <div className="col" style={{gap: 2}}>
        <span className="kvalue" style={{fontSize: 13, fontWeight: 600}}>{name}</span>
        <span className="mini">{desc}</span>
      </div>
      <Toggle on={on} onClick={()=>{}} />
    </div>
  );
}

// ============================================
// Profile dropdown — anchored to user card
// ============================================
function ProfileMenu({ open, onClose, onNavigate }) {
  rsUseEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (!e.target.closest('.profile-menu') && !e.target.closest('.user-card')) onClose();
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open, onClose]);
  if (!open) return null;
  const items = [
    { label: 'Профиль', desc: 'Имя, email, шифрование БД', go: 'settings', icon: '👤' },
    { label: 'Настройки', desc: 'Тема, валюта, провайдеры', go: 'settings', icon: '⚙' },
    { label: 'Отчёты', desc: 'История и шаблоны', go: 'reports', icon: '📄' },
    { label: 'Импорт сделок', desc: 'CSV / брокер', go: 'settings', icon: '⤓' },
    { label: 'README на GitHub', desc: 'curs/curs', go: 'docs', icon: '?' },
  ];
  return (
    <div className="profile-menu" style={{
      position: 'fixed', bottom: 86, left: 16, width: 280,
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
      borderRadius: 12, padding: 6,
      boxShadow: '0 18px 48px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.06)',
      zIndex: 100
    }}>
      <div style={{padding: '12px 14px 10px', borderBottom: '1px solid var(--hairline-2)', marginBottom: 4}}>
        <div className="row" style={{gap: 10, alignItems: 'center'}}>
          <div className="ava" style={{width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-3), var(--accent-4))', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 13}}>МР</div>
          <div className="col" style={{gap: 0}}>
            <div style={{fontSize: 13, fontWeight: 600}}>Максим Родиков</div>
            <div className="mini">maxim@curs.local</div>
          </div>
        </div>
      </div>
      {items.map((it, i) => (
        <button key={i} className="profile-item" onClick={() => { onNavigate(it.go); onClose(); }} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: '100%', padding: '8px 10px', borderRadius: 8,
          textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer'
        }}>
          <span style={{width: 24, height: 24, borderRadius: 6, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontSize: 13}}>{it.icon}</span>
          <span className="col" style={{gap: 0}}>
            <span style={{fontSize: 13, fontWeight: 500}}>{it.label}</span>
            <span className="mini">{it.desc}</span>
          </span>
        </button>
      ))}
      <div style={{borderTop: '1px solid var(--hairline-2)', marginTop: 4, padding: '4px 0 2px'}}>
        <button className="profile-item" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: '100%', padding: '8px 10px', borderRadius: 8,
          textAlign: 'left', color: 'var(--down)', background: 'transparent', border: 'none', cursor: 'pointer'
        }}>
          <span style={{width: 24, height: 24, borderRadius: 6, background: 'var(--down-soft)', color: 'var(--down)', display: 'grid', placeItems: 'center', fontSize: 13}}>⏏</span>
          <span style={{fontSize: 13, fontWeight: 500}}>Выйти</span>
        </button>
      </div>
    </div>
  );
}

window.CURS_REPORTS = { ReportsScreen, SettingsScreen, ProfileMenu };
