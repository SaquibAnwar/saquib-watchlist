import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import holdings from '../lib/holdings';
import { getCall } from '../lib/callLogic';

const TARGET_VALUE = 580000;
const MARCH_31 = new Date('2026-03-31T00:00:00');

const FILTERS = ['All', 'Sell triggers', 'Hold', 'Wait', 'Exit', 'March sells'];

function fmt(n) {
  return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDec(n, d = 2) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function getTargetPrice(h) {
  if (h.marchSell) return h.marchSellBaseLTP * 1.05;
  if (h.exitCandidate) return h.avg * 0.92;
  return h.avg * (1 + h.targetPct / 100);
}

function daysUntilMarch31() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date('2026-03-31T00:00:00');
  return Math.round((deadline - today) / (1000 * 60 * 60 * 24));
}

export async function getServerSideProps({ req }) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const res = await fetch(`${protocol}://${host}/api/prices`);
    if (!res.ok) throw new Error('fetch failed');
    const prices = await res.json();
    return { props: { prices, fetchedAt: new Date().toISOString() } };
  } catch {
    return { props: { prices: {}, fetchedAt: new Date().toISOString() } };
  }
}

export default function Home({ prices, fetchedAt }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const id = setInterval(() => router.replace(router.asPath), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const enriched = holdings.map(h => {
    const ltp = prices[h.sym] ?? h.avg;
    const curValue = h.qty * ltp;
    const pnlVal = curValue - h.invested;
    const pnlPct = (pnlVal / h.invested) * 100;
    const call = getCall(h, ltp);
    const targetPrice = getTargetPrice(h);
    const gapPct = ((targetPrice - ltp) / ltp) * 100;
    return { ...h, ltp, curValue, pnlVal, pnlPct, call, targetPrice, gapPct };
  });

  // Summary stats — exclude marchSell stocks
  const nonMarch = enriched.filter(h => !h.marchSell);
  const portfolioValue = nonMarch.reduce((s, h) => s + h.curValue, 0);
  const amountInvested = nonMarch.reduce((s, h) => s + h.invested, 0);
  const totalPnl = portfolioValue - amountInvested;
  const totalPnlPct = (totalPnl / amountInvested) * 100;
  const sellCount = enriched.filter(h => h.call.label === 'SELL' || h.call.label === 'SELL NOW').length;
  const exitCount = enriched.filter(h => h.call.label === 'EXIT').length;
  const progressPct = Math.min((portfolioValue / TARGET_VALUE) * 100, 100);
  const daysLeft = daysUntilMarch31();

  const filtered = enriched.filter(h => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Sell triggers') return h.call.label === 'SELL' || h.call.label === 'SELL NOW';
    if (activeFilter === 'Hold') return h.call.label === 'HOLD';
    if (activeFilter === 'Wait') return h.call.label === 'WAIT';
    if (activeFilter === 'Exit') return h.call.label === 'EXIT';
    if (activeFilter === 'March sells') return !!h.marchSell;
    return true;
  });

  const sellStocks = enriched.filter(h => h.call.label === 'SELL' || h.call.label === 'SELL NOW');
  const totalProceeds = sellStocks.reduce((s, h) => s + h.curValue, 0);

  const lastUpdated = new Date(fetchedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });

  function rowStyle(call) {
    if (call.label === 'SELL' || call.label === 'SELL NOW')
      return { background: 'rgba(255,77,109,0.06)' };
    if (call.label === 'EXIT')
      return { background: 'rgba(255,179,71,0.06)' };
    return {};
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      <div className="page-content">

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Saquib's Watchlist
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.76rem', marginTop: '0.25rem' }}>
              Prices last fetched at {lastUpdated}
            </p>
          </div>
          <button className="filter-btn" onClick={() => router.replace(router.asPath)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
            ↻ Refresh
          </button>
        </div>

        {/* ── Countdown banner ── */}
        {daysLeft <= 0 ? (
          <div style={{
            background: 'var(--red-dim)', border: '1px solid rgba(255,77,109,0.3)',
            borderRadius: 10, padding: '0.8rem 1.25rem', marginBottom: '1.25rem',
            color: 'var(--red)', fontWeight: 700, fontSize: '0.9rem', textAlign: 'center',
            letterSpacing: '0.04em',
          }}>
            SELL ALL MARCH POSITIONS TODAY
          </div>
        ) : (
          <div style={{
            background: 'var(--accent-dim)', border: '1px solid rgba(124,106,255,0.2)',
            borderRadius: 10, padding: '0.65rem 1.25rem', marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
          }}>
            <span style={{
              fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: '1.15rem',
              color: 'var(--accent)',
            }}>
              {daysLeft}
            </span>
            <span style={{ color: 'var(--accent)', fontSize: '0.82rem' }}>
              days left to March 31 sell deadline
            </span>
          </div>
        )}

        {/* ── Summary cards ── */}
        <div className="summary-grid">
          <SummaryCard
            label="Portfolio Value"
            value={fmt(portfolioValue)}
            sub="excl. march sells"
          />
          <SummaryCard
            label="Amount Invested"
            value={fmt(amountInvested)}
          />
          <SummaryCard
            label="Live P&L"
            value={(totalPnl >= 0 ? '+' : '−') + fmt(totalPnl)}
            sub={(totalPnlPct >= 0 ? '+' : '') + fmtDec(totalPnlPct) + '%'}
            color={totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
          />
          <SummaryCard
            label="Sell Triggers"
            value={sellCount}
            color={sellCount > 0 ? 'var(--red)' : undefined}
          />
          <SummaryCard
            label="Exit Candidates"
            value={exitCount}
            color={exitCount > 0 ? 'var(--amber)' : undefined}
          />
        </div>

        {/* ── Progress bar ── */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="progress-header">
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>
              Progress toward ₹5,80,000 target
            </span>
            <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', color: 'var(--accent)',
            }}>
              {fmt(portfolioValue)} / ₹5,80,000 &nbsp;·&nbsp; {fmtDec(progressPct)}%
            </span>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div className="progress-bar__fill" style={{
              width: `${progressPct}%`,
              background: progressPct >= 100 ? 'var(--green)' : 'var(--accent)',
            }} />
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-btn${activeFilter === f ? ' active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── Main table ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.75rem' }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Symbol</th>
                  <th>Qty</th>
                  <th>Avg Cost</th>
                  <th>LTP</th>
                  <th>Invested</th>
                  <th>Cur Value</th>
                  <th>P&L</th>
                  <th>P&L %</th>
                  <th>Target ₹</th>
                  <th>Gap %</th>
                  <th>Call</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => (
                  <tr key={h.sym} style={rowStyle(h.call)}>
                    <td>
                      {h.sym}
                      {h.marchSell && (
                        <span style={{
                          marginLeft: '0.45rem', fontSize: '0.58rem',
                          fontFamily: 'Space Mono, monospace', fontWeight: 700,
                          color: 'var(--accent)', background: 'var(--accent-dim)',
                          border: '1px solid rgba(124,106,255,0.25)',
                          borderRadius: 4, padding: '0.05rem 0.3rem',
                          verticalAlign: 'middle', letterSpacing: '0.05em',
                        }}>
                          MARCH
                        </span>
                      )}
                    </td>
                    <td>{h.qty}</td>
                    <td style={{ color: 'var(--muted)' }}>{fmtDec(h.avg)}</td>
                    <td style={{ color: h.ltp >= h.avg ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                      {fmtDec(h.ltp)}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{fmt(h.invested)}</td>
                    <td>{fmt(h.curValue)}</td>
                    <td style={{ color: h.pnlVal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {h.pnlVal >= 0 ? '+' : '−'}{fmt(h.pnlVal)}
                    </td>
                    <td style={{ color: h.pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {h.pnlPct >= 0 ? '+' : ''}{fmtDec(h.pnlPct)}%
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{fmtDec(h.targetPrice)}</td>
                    <td style={{ color: h.gapPct <= 0 ? 'var(--green)' : 'var(--muted)' }}>
                      {h.gapPct > 0 ? '+' : ''}{fmtDec(h.gapPct)}%
                    </td>
                    <td>
                      <span className={`badge ${h.call.cls}`}>{h.call.label}</span>
                      {h.call.note && (
                        <span style={{
                          display: 'block', fontSize: '0.62rem', color: 'var(--muted)',
                          marginTop: '0.2rem', fontStyle: 'italic',
                        }}>
                          {h.call.note}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Sell summary ── */}
        {sellStocks.length > 0 && (
          <div className="card">
            <h2 style={{
              fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem',
              color: 'var(--red)', letterSpacing: '0.02em',
            }}>
              Sell Summary — {sellStocks.length} stock{sellStocks.length !== 1 ? 's' : ''} triggered
            </h2>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Symbol</th>
                  <th>Call</th>
                  <th>Qty</th>
                  <th>LTP</th>
                  <th>P&L</th>
                  <th>Proceeds</th>
                </tr>
              </thead>
              <tbody>
                {sellStocks.map(h => (
                  <tr key={h.sym}>
                    <td>{h.sym}</td>
                    <td><span className={`badge ${h.call.cls}`}>{h.call.label}</span></td>
                    <td>{h.qty}</td>
                    <td>{fmtDec(h.ltp)}</td>
                    <td style={{ color: h.pnlVal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {h.pnlVal >= 0 ? '+' : '−'}{fmt(h.pnlVal)}
                    </td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(h.curValue)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} style={{
                    color: 'var(--muted)', fontSize: '0.78rem',
                    paddingTop: '0.9rem', borderBottom: 'none',
                  }}>
                    Total Proceeds
                  </td>
                  <td style={{
                    color: 'var(--green)', fontWeight: 700,
                    fontFamily: 'Space Mono, monospace', paddingTop: '0.9rem',
                    borderBottom: 'none',
                  }}>
                    {fmt(totalProceeds)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '1rem 1.1rem' }}>
      <p style={{
        color: 'var(--muted)', fontSize: '0.68rem', fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.45rem',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: 'Space Mono, monospace', fontSize: '1rem', fontWeight: 700,
        color: color || 'var(--text)', lineHeight: 1.2,
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ color: color || 'var(--muted)', fontSize: '0.74rem', marginTop: '0.2rem' }}>
          {sub}
        </p>
      )}
    </div>
  );
}
