// CURS — Chart primitives
const { useState, useMemo, useRef, useEffect, useCallback } = React;

// ============================================
// Util
// ============================================
function pathFromPoints(pts, smooth = false) {
  if (!pts.length) return '';
  if (!smooth) {
    return 'M ' + pts.map(p => p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L ');
  }
  // Catmull-Rom-ish smoothing
  let d = 'M ' + pts[0][0] + ' ' + pts[0][1];
  for (let i=0; i<pts.length-1; i++) {
    const p0 = pts[i-1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i+1];
    const p3 = pts[i+2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0])/6;
    const cp1y = p1[1] + (p2[1] - p0[1])/6;
    const cp2x = p2[0] - (p3[0] - p1[0])/6;
    const cp2y = p2[1] - (p3[1] - p1[1])/6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function scaleLinear(domain, range) {
  const [d0,d1] = domain, [r0,r1] = range;
  const dr = d1 - d0 || 1;
  return v => r0 + (v - d0)/dr * (r1 - r0);
}

function fmtMoneyCompact(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v/1e9).toFixed(2).replace('.', ',') + ' млрд';
  if (abs >= 1e6) return (v/1e6).toFixed(1).replace('.', ',') + ' млн';
  if (abs >= 1e3) return (v/1e3).toFixed(0) + 'к';
  return v.toFixed(0);
}

function fmtDateRu(d) {
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ============================================
// LineAreaChart — main equity-curve chart with hover
// ============================================
function LineAreaChart({ series, height = 280, color = "#15140F", areaFrom = "rgba(21,20,15,.12)", areaTo = "rgba(21,20,15,0)", showGrid = true, currency = "₽", compareSeries = null, compareColor = "#B5B1A6", baseline = null }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      setW(Math.max(200, cr.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const padL = 0, padR = 0, padT = 12, padB = 24;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;

  const all = compareSeries ? [...series.map(p=>p.v), ...compareSeries.map(p=>p.v)] : series.map(p=>p.v);
  const minV = Math.min(...all);
  const maxV = Math.max(...all);
  const pad = (maxV - minV) * 0.08 || 1;
  const yMin = minV - pad;
  const yMax = maxV + pad;

  const x = scaleLinear([0, series.length-1], [padL, padL+innerW]);
  const y = scaleLinear([yMin, yMax], [padT+innerH, padT]);

  const pts = series.map((p,i) => [x(i), y(p.v)]);
  const pathLine = pathFromPoints(pts, true);
  const pathArea = pathLine + ` L ${pts[pts.length-1][0]} ${padT+innerH} L ${pts[0][0]} ${padT+innerH} Z`;

  const cmpPts = compareSeries ? compareSeries.map((p,i) => [x(i), y(p.v)]) : null;
  const cmpPath = cmpPts ? pathFromPoints(cmpPts, true) : null;

  // y-grid
  const ticks = 4;
  const yTicks = [];
  for (let i=0;i<=ticks;i++){
    const v = yMin + (yMax-yMin) * i/ticks;
    yTicks.push({ v, y: y(v) });
  }
  // x-grid (months)
  const xTicks = [];
  if (series.length > 0) {
    const monthsSeen = new Set();
    series.forEach((p, i) => {
      const key = p.d.getFullYear()*12 + p.d.getMonth();
      if (!monthsSeen.has(key)) {
        monthsSeen.add(key);
        if (p.d.getDate() <= 5) xTicks.push({ i, label: ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][p.d.getMonth()] });
      }
    });
  }
  const xTickStep = Math.ceil(xTicks.length / 6);
  const visibleXTicks = xTicks.filter((_,i) => i % xTickStep === 0);

  function onMove(e){
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.round((px - padL) / innerW * (series.length-1));
    if (idx < 0 || idx >= series.length) return setHover(null);
    setHover({ idx, x: x(idx), y: y(series[idx].v) });
  }
  function onLeave(){ setHover(null); }

  const gradId = useMemo(() => 'grad-' + Math.random().toString(36).slice(2,8), []);

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ width: '100%', height }}>
      <svg width={w} height={height} style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={onLeave}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={areaFrom} />
            <stop offset="100%" stopColor={areaTo} />
          </linearGradient>
        </defs>

        {showGrid && yTicks.map((t,i) => (
          <g key={i}>
            <line x1={padL} x2={padL+innerW} y1={t.y} y2={t.y} stroke="#EFEBE0" strokeWidth="1" strokeDasharray={i===0||i===ticks ? '': '2 4'} />
            <text x={padL+innerW-2} y={t.y-3} textAnchor="end" fontSize="10" fill="#807D74" fontFamily="var(--mono)">
              {fmtMoneyCompact(t.v)}{currency}
            </text>
          </g>
        ))}

        {showGrid && visibleXTicks.map((t,i) => (
          <text key={i} x={x(t.i)} y={height-6} fontSize="10" fill="#807D74" fontFamily="var(--mono)">{t.label}</text>
        ))}

        {baseline != null && (
          <line x1={padL} x2={padL+innerW} y1={y(baseline)} y2={y(baseline)} stroke="#B5B1A6" strokeWidth="1" strokeDasharray="3 3" />
        )}

        <path d={pathArea} fill={`url(#${gradId})`} />
        {cmpPath && <path d={cmpPath} fill="none" stroke={compareColor} strokeWidth="1.5" strokeDasharray="4 4" />}
        <path d={pathLine} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={padT} y2={padT+innerH} stroke="#15140F" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
            <circle cx={hover.x} cy={hover.y} r="4" fill={color} stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: hover.y }}>
          <div className="t-date">{fmtDateRu(series[hover.idx].d)}</div>
          <div className="t-val">{fmtMoneyCompact(series[hover.idx].v)} {currency}</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sparkline — small inline trend
// ============================================
function Sparkline({ series, width = 88, height = 24, positive = true, fill = true }) {
  const vals = series.map(p => typeof p === 'number' ? p : p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min) * 0.1 || 1;
  const x = scaleLinear([0, vals.length-1], [0, width]);
  const y = scaleLinear([min - pad, max + pad], [height-2, 2]);
  const pts = vals.map((v,i) => [x(i), y(v)]);
  const color = positive ? 'var(--up)' : 'var(--down)';
  const areaFill = positive ? 'rgba(47,125,67,.10)' : 'rgba(192,57,43,.10)';
  const pathLine = pathFromPoints(pts, true);
  const pathArea = pathLine + ` L ${pts[pts.length-1][0]} ${height} L ${pts[0][0]} ${height} Z`;
  return (
    <svg width={width} height={height} className="sparkline-wrap" style={{ display: 'inline-block' }}>
      {fill && <path d={pathArea} fill={areaFill} />}
      <path d={pathLine} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================
// Treemap (squarified)
// ============================================
function squarify(items, x, y, w, h) {
  // Simple slice-and-dice; items: {value, ...}
  const total = items.reduce((s, it) => s + it.value, 0);
  const out = [];
  function layout(arr, x, y, w, h, horizontal) {
    if (arr.length === 0) return;
    if (arr.length === 1) { out.push({ ...arr[0], x, y, w, h }); return; }
    const totalArr = arr.reduce((s, it) => s + it.value, 0);
    // Find split point: take first half by value
    let acc = 0, splitIdx = 0;
    for (let i=0;i<arr.length;i++){
      acc += arr[i].value;
      if (acc >= totalArr/2) { splitIdx = i+1; break; }
    }
    splitIdx = Math.max(1, Math.min(splitIdx, arr.length-1));
    const left = arr.slice(0, splitIdx);
    const right = arr.slice(splitIdx);
    const leftSum = left.reduce((s, it) => s + it.value, 0);
    const ratio = leftSum / totalArr;
    if (horizontal) {
      const wL = w * ratio;
      layout(left, x, y, wL, h, !horizontal);
      layout(right, x + wL, y, w - wL, h, !horizontal);
    } else {
      const hT = h * ratio;
      layout(left, x, y, w, hT, !horizontal);
      layout(right, x, y + hT, w, h - hT, !horizontal);
    }
  }
  layout([...items].sort((a,b)=>b.value-a.value), x, y, w, h, w >= h);
  return out;
}

function Treemap({ items, height = 280, palette = ['#15140F','#2F4858','#86B0A0','#D7E041','#EE7544','#4F6BED','#B58300','#8C5BD7','#1F8F6F','#C0392B'], onHover }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(400);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => setW(Math.max(200, entries[0].contentRect.width)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const rects = useMemo(() => squarify(items, 0, 0, w, height), [items, w, height]);
  return (
    <div className="chart-wrap" ref={wrapRef} style={{ width: '100%', height }}>
      <svg width={w} height={height} style={{ display: 'block' }}>
        {rects.map((r, i) => {
          const color = r.color || palette[i % palette.length];
          const area = r.w * r.h;
          const showLabel = r.w > 60 && r.h > 28;
          const showValue = r.w > 80 && r.h > 50;
          const lightText = ['#D7E041','#86B0A0'].includes(color) ? false : true;
          return (
            <g key={i} onMouseEnter={() => onHover && onHover(r)} onMouseLeave={() => onHover && onHover(null)} style={{cursor:'pointer'}}>
              <rect x={r.x+1} y={r.y+1} width={r.w-2} height={r.h-2} fill={color} rx="6" />
              {showLabel && (
                <text x={r.x+10} y={r.y+18} fontSize="11" fontWeight="600"
                      fill={lightText ? '#fff' : '#15140F'} fontFamily="var(--sans)"
                      letterSpacing="-0.01em">
                  {r.label}
                </text>
              )}
              {showValue && (
                <text x={r.x+10} y={r.y+34} fontSize="11" fill={lightText ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.55)'} fontFamily="var(--mono)">
                  {r.share}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================
// Correlation heatmap
// ============================================
function Heatmap({ labels, matrix, size = 28 }) {
  const [hover, setHover] = useState(null);
  function color(v) {
    // -1..1 — blue..white..red
    if (v >= 0) {
      const t = v;
      const r = Math.round(247 - (247-192)*t);
      const g = Math.round(244 - (244-57)*t);
      const b = Math.round(238 - (238-43)*t);
      return `rgb(${r},${g},${b})`;
    } else {
      const t = -v;
      const r = Math.round(247 - (247-47)*t);
      const g = Math.round(244 - (244-125)*t);
      const b = Math.round(238 - (238-67)*t);
      return `rgb(${r},${g},${b})`;
    }
  }
  const n = labels.length;
  const labelW = 78;
  const labelH = 78;
  const w = labelW + n*size;
  const h = labelH + n*size;
  return (
    <div className="chart-wrap" style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
      <svg width={w} height={h}>
        {labels.map((lab, j) => (
          <text key={'h'+j} x={labelW + j*size + size/2} y={labelH-8} textAnchor="middle" transform={`rotate(-45 ${labelW + j*size + size/2} ${labelH-8})`} fontSize="10" fill="#4A4842" fontFamily="var(--mono)">{lab}</text>
        ))}
        {labels.map((lab, i) => (
          <text key={'v'+i} x={labelW-6} y={labelH + i*size + size/2 + 3} textAnchor="end" fontSize="10" fill="#4A4842" fontFamily="var(--mono)">{lab}</text>
        ))}
        {matrix.map((row, i) => row.map((v, j) => (
          <g key={i+'-'+j} onMouseEnter={()=>setHover({i,j,v, x: labelW+j*size + size/2, y: labelH+i*size + size/2})} onMouseLeave={()=>setHover(null)}>
            <rect x={labelW + j*size + 1} y={labelH + i*size + 1} width={size-2} height={size-2} fill={color(v)} rx="2" />
            {size >= 28 && (
              <text x={labelW + j*size + size/2} y={labelH + i*size + size/2 + 3} textAnchor="middle"
                    fontSize="9" fontFamily="var(--mono)"
                    fill={Math.abs(v) > 0.6 ? '#fff' : '#15140F'}>
                {v.toFixed(2).replace('-0.00','0.00')}
              </text>
            )}
          </g>
        )))}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: hover.y - 12 }}>
          <div className="t-date">{labels[hover.i]} × {labels[hover.j]}</div>
          <div className="t-val">ρ = {hover.v.toFixed(3)}</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Efficient Frontier scatter
// ============================================
function FrontierChart({ portfolios, frontier, current, optimal, minvar, height = 360 }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(700);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(300, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  const [hover, setHover] = useState(null);
  const padL = 48, padB = 36, padT = 14, padR = 14;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const allX = [...portfolios.map(p=>p.risk), ...frontier.map(p=>p.risk), current?.risk||0];
  const allY = [...portfolios.map(p=>p.ret), ...frontier.map(p=>p.ret), current?.ret||0];
  const xMin = Math.min(...allX) * 0.85, xMax = Math.max(...allX) * 1.08;
  const yMin = Math.min(...allY) * 0.9 - 0.01, yMax = Math.max(...allY) * 1.05 + 0.01;
  const x = scaleLinear([xMin, xMax], [padL, padL+innerW]);
  const y = scaleLinear([yMin, yMax], [padT+innerH, padT]);
  const frontierPts = frontier.map(p => [x(p.risk), y(p.ret)]);
  const frontierPath = pathFromPoints(frontierPts, true);

  // grid
  const yticks = 5, xticks = 5;
  const yT = [], xT = [];
  for (let i=0;i<=yticks;i++) yT.push(yMin + (yMax-yMin)*i/yticks);
  for (let i=0;i<=xticks;i++) xT.push(xMin + (xMax-xMin)*i/xticks);

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ width: '100%', height, position: 'relative' }}>
      <svg width={w} height={height} style={{ display: 'block' }}>
        {/* grid */}
        {yT.map((v,i) => (
          <g key={'y'+i}>
            <line x1={padL} x2={padL+innerW} y1={y(v)} y2={y(v)} stroke="#EFEBE0" strokeWidth="1" strokeDasharray={i===0?'':'2 3'} />
            <text x={padL-8} y={y(v)+3} textAnchor="end" fontSize="10" fill="#807D74" fontFamily="var(--mono)">{(v*100).toFixed(0)}%</text>
          </g>
        ))}
        {xT.map((v,i) => (
          <g key={'x'+i}>
            <line x1={x(v)} x2={x(v)} y1={padT} y2={padT+innerH} stroke="#EFEBE0" strokeWidth="1" strokeDasharray={i===0?'':'2 3'} />
            <text x={x(v)} y={padT+innerH+14} textAnchor="middle" fontSize="10" fill="#807D74" fontFamily="var(--mono)">{(v*100).toFixed(0)}%</text>
          </g>
        ))}
        {/* axis labels */}
        <text x={padL+innerW/2} y={height-4} textAnchor="middle" fontSize="10" fill="#4A4842">Риск (волатильность, годовая)</text>
        <text x={10} y={padT+innerH/2} textAnchor="middle" fontSize="10" fill="#4A4842" transform={`rotate(-90 12 ${padT+innerH/2})`}>Ожидаемая доходность</text>

        {/* cloud of random portfolios */}
        {portfolios.map((p,i) => (
          <circle key={i} cx={x(p.risk)} cy={y(p.ret)} r="2.4" fill="#B5B1A6" opacity="0.35" />
        ))}

        {/* frontier curve */}
        <path d={frontierPath} fill="none" stroke="#15140F" strokeWidth="2" />

        {/* current */}
        {current && (
          <g>
            <circle cx={x(current.risk)} cy={y(current.ret)} r="10" fill="rgba(238,117,68,.15)" />
            <circle cx={x(current.risk)} cy={y(current.ret)} r="6" fill="#EE7544" stroke="#fff" strokeWidth="2" />
            <text x={x(current.risk)+12} y={y(current.ret)+4} fontSize="11" fontWeight="600" fill="#EE7544">Текущий портфель</text>
          </g>
        )}
        {/* optimal */}
        {optimal && (
          <g>
            <circle cx={x(optimal.risk)} cy={y(optimal.ret)} r="6" fill="#D7E041" stroke="#15140F" strokeWidth="1.5" />
            <text x={x(optimal.risk)+10} y={y(optimal.ret)-6} fontSize="10" fontWeight="600" fill="#15140F">Max Sharpe</text>
          </g>
        )}
        {/* min variance */}
        {minvar && (
          <g>
            <circle cx={x(minvar.risk)} cy={y(minvar.ret)} r="6" fill="#fff" stroke="#15140F" strokeWidth="1.5" />
            <text x={x(minvar.risk)-10} y={y(minvar.ret)+18} textAnchor="end" fontSize="10" fontWeight="600" fill="#15140F">Min Variance</text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ============================================
// Monte Carlo fan
// ============================================
function MonteCarloFan({ paths, percentiles, days = 252, startValue, target, height = 320 }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(700);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(300, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  const padL = 76, padR = 14, padT = 12, padB = 28;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  let yMinV = Infinity, yMaxV = -Infinity;
  for (const path of paths) {
    for (let i=0; i<path.length; i++) {
      if (path[i] < yMinV) yMinV = path[i];
      if (path[i] > yMaxV) yMaxV = path[i];
    }
  }
  const yMin = yMinV * 0.95, yMax = yMaxV * 1.02;
  const x = scaleLinear([0, days-1], [padL, padL+innerW]);
  const y = scaleLinear([yMin, yMax], [padT+innerH, padT]);

  // Bands path between two percentile arrays
  function band(hi, lo) {
    let d = `M ${x(0)} ${y(hi[0])}`;
    for (let i=1;i<hi.length;i++) d += ` L ${x(i)} ${y(hi[i])}`;
    for (let i=lo.length-1; i>=0; i--) d += ` L ${x(i)} ${y(lo[i])}`;
    return d + ' Z';
  }

  // y ticks
  const yT = 5, ticks = [];
  for (let i=0;i<=yT;i++) ticks.push(yMin + (yMax-yMin)*i/yT);

  // x ticks: months
  const xMonths = [];
  for (let m=0; m<=12; m+=3) xMonths.push({ i: Math.round(m/12*(days-1)), label: m+' мес' });

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ width: '100%', height }}>
      <svg width={w} height={height} style={{ display: 'block' }}>
        {ticks.map((v,i) => (
          <g key={i}>
            <line x1={padL} x2={padL+innerW} y1={y(v)} y2={y(v)} stroke="#EFEBE0" strokeDasharray={i===0?'':'2 3'} />
            <text x={padL-6} y={y(v)+3} textAnchor="end" fontSize="10" fill="#807D74" fontFamily="var(--mono)">{fmtMoneyCompact(v)} ₽</text>
          </g>
        ))}
        {xMonths.map((t,i) => (
          <text key={i} x={x(t.i)} y={height-6} textAnchor="middle" fontSize="10" fill="#807D74" fontFamily="var(--mono)">{t.label}</text>
        ))}

        {/* Bands p10-p90, p25-p75 */}
        <path d={band(percentiles.p90, percentiles.p10)} fill="rgba(21,20,15,.08)" />
        <path d={band(percentiles.p75, percentiles.p25)} fill="rgba(21,20,15,.16)" />

        {/* median */}
        <path d={pathFromPoints(percentiles.p50.map((v,i)=>[x(i), y(v)]))} fill="none" stroke="#15140F" strokeWidth="2" />

        {/* start dot */}
        <circle cx={x(0)} cy={y(startValue)} r="4" fill="#15140F" />
        <text x={x(0)+8} y={y(startValue)-6} fontSize="10" fill="#15140F" fontWeight="600">Старт</text>

        {/* target line */}
        {target && (
          <g>
            <line x1={padL} x2={padL+innerW} y1={y(target)} y2={y(target)} stroke="#EE7544" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={padL+innerW-4} y={y(target)-4} textAnchor="end" fontSize="10" fill="#EE7544" fontWeight="600">Целевое: {fmtMoneyCompact(target)} ₽</text>
          </g>
        )}

        {/* a few sample paths thin */}
        {paths.slice(0, 18).map((p,i) => (
          <path key={i} d={pathFromPoints(p.map((v,j)=>[x(j), y(v)]))} fill="none" stroke="#807D74" strokeWidth="0.5" opacity="0.4" />
        ))}
      </svg>
    </div>
  );
}

// ============================================
// Drawdown chart (below 0 area)
// ============================================
function DrawdownChart({ series, height = 200 }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(700);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(300, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  // Compute drawdown series
  const dd = useMemo(() => {
    let peak = series[0].v;
    return series.map(p => {
      if (p.v > peak) peak = p.v;
      return { d: p.d, v: (p.v - peak)/peak };
    });
  }, [series]);
  const padL = 56, padR = 14, padT = 8, padB = 24;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const minDD = Math.min(...dd.map(p => p.v));
  const x = scaleLinear([0, dd.length-1], [padL, padL+innerW]);
  const y = scaleLinear([minDD*1.05, 0], [padT+innerH, padT]);
  const pts = dd.map((p,i) => [x(i), y(p.v)]);
  const linePath = pathFromPoints(pts, false);
  const area = linePath + ` L ${pts[pts.length-1][0]} ${y(0)} L ${pts[0][0]} ${y(0)} Z`;

  const yTicks = 4, yT = [];
  for (let i=0;i<=yTicks;i++) yT.push(minDD * i/yTicks);

  function onMove(e){
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(dd.length-1, Math.round((px-padL)/innerW * (dd.length-1))));
    setHover({ idx, x: x(idx), y: y(dd[idx].v), val: dd[idx].v, d: dd[idx].d });
  }

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ width: '100%', height, position:'relative' }}>
      <svg width={w} height={height} style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={()=>setHover(null)}>
        {yT.map((v,i)=>(
          <g key={i}>
            <line x1={padL} x2={padL+innerW} y1={y(v)} y2={y(v)} stroke="#EFEBE0" strokeDasharray={i===0?'':'2 3'} />
            <text x={padL-6} y={y(v)+3} textAnchor="end" fontSize="10" fill="#807D74" fontFamily="var(--mono)">{(v*100).toFixed(0)}%</text>
          </g>
        ))}
        <path d={area} fill="rgba(192,57,43,.15)" />
        <path d={linePath} fill="none" stroke="#C0392B" strokeWidth="1.5" />
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={padT} y2={padT+innerH} stroke="#15140F" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
            <circle cx={hover.x} cy={hover.y} r="4" fill="#C0392B" stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: hover.y }}>
          <div className="t-date">{fmtDateRu(hover.d)}</div>
          <div className="t-val">{(hover.val*100).toFixed(2)}%</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Horizontal bar chart — labels left, bar right, value at end
// (single-direction, dropping below-zero ones to the left)
// ============================================
function BarChart({ items, height = 240, valueKey = 'value' }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(500);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(e => setW(Math.max(220, e[0].contentRect.width)));
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);
  const padL = 76, padR = 12, padT = 4, padB = 4;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(...items.map(i => Math.abs(i[valueKey])));
  const rowH = innerH / items.length;
  // Reserve space for the value label at the end of the bar
  const valueSpace = 110;
  const barMax = Math.max(40, innerW - valueSpace);
  return (
    <div className="chart-wrap" ref={wrapRef} style={{ width: '100%', height }}>
      <svg width={w} height={height}>
        {items.map((it, i) => {
          const v = it[valueKey];
          const len = Math.abs(v)/max * barMax;
          const y = padT + i*rowH + rowH/2;
          const positive = v >= 0;
          const color = positive ? 'var(--up)' : 'var(--down)';
          return (
            <g key={i}>
              <text x={padL-8} y={y+3} textAnchor="end" fontSize="11" fill="#15140F" fontFamily="var(--mono)" fontWeight="500">{it.label}</text>
              <rect x={padL} y={y - rowH*0.32} width={len} height={rowH*0.64} fill={color} rx="3" />
              <text x={padL+len+6} y={y+3} fontSize="11" fill={color} fontFamily="var(--mono)" fontWeight="600">
                {positive ? '+' : '−'}{fmtMoneyCompact(Math.abs(v))}&nbsp;₽
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================
// Donut allocation
// ============================================
function Donut({ items, size = 200, thickness = 24 }) {
  const r = size/2 - 6;
  const r2 = r - thickness;
  const cx = size/2, cy = size/2;
  const total = items.reduce((s,i)=>s+i.value, 0);
  let acc = 0;
  const arcs = items.map((it, idx) => {
    const start = acc/total * Math.PI*2 - Math.PI/2;
    acc += it.value;
    const end = acc/total * Math.PI*2 - Math.PI/2;
    const x1 = cx + r*Math.cos(start), y1 = cy + r*Math.sin(start);
    const x2 = cx + r*Math.cos(end),   y2 = cy + r*Math.sin(end);
    const xa1 = cx + r2*Math.cos(end), ya1 = cy + r2*Math.sin(end);
    const xa2 = cx + r2*Math.cos(start), ya2 = cy + r2*Math.sin(start);
    const large = (end - start) > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xa1} ${ya1} A ${r2} ${r2} 0 ${large} 0 ${xa2} ${ya2} Z`;
    return <path key={idx} d={d} fill={it.color} />;
  });
  return <svg width={size} height={size}>{arcs}</svg>;
}

window.CURS_CHARTS = { LineAreaChart, Sparkline, Treemap, Heatmap, FrontierChart, MonteCarloFan, DrawdownChart, BarChart, Donut, fmtMoneyCompact, fmtDateRu };
