import { useState } from 'react';
import { api, usd, signedUsd, signedPct, plClass, pct, fmtShares } from '../../api.js';
import PortfolioChart from './PortfolioChart.jsx';
import AddStockForm from './AddStockForm.jsx';
import './portfolio.css';

// Portfolio dashboard: real value, cost basis and P/L derived from the user's actual
// purchase lots — nothing here is a hardcoded starting balance.
export default function PortfolioTab({ live, timeline, stocks, onOpenStock, onPortfolioChange }) {
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(null); // ticker whose lots are open
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const points = timeline?.points || [];
  const positions = live?.positions || [];
  const isEmpty = !positions.length;

  const value = live?.currentValue ?? 0;
  const cost = live?.costBasis ?? 0;
  const totalPl = live?.totalPl ?? 0;
  const totalPlPct = live?.totalPlPct ?? 0;
  const day = live?.windows?.day;

  const handleAdded = () => {
    setAdding(false);
    setError('');
    onPortfolioChange();
  };

  async function removeHolding(symbol) {
    setBusy(symbol);
    setError('');
    try {
      await api.deleteHolding(symbol);
      if (expanded === symbol) setExpanded(null);
      onPortfolioChange();
    } catch (deleteError) {
      setError(deleteError.message || `Could not remove ${symbol}.`);
    } finally {
      setBusy('');
    }
  }

  async function removeLot(lotId, symbol) {
    setBusy(lotId);
    setError('');
    try {
      await api.deleteLot(lotId);
      onPortfolioChange();
    } catch (deleteError) {
      setError(deleteError.message || `Could not remove that lot of ${symbol}.`);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="home">
      <header className="port-header">
        <div className="port-title">
          <h1>Portfolio</h1>
          <p className="muted tiny">
            {isEmpty ? 'No positions yet' : `${positions.length} position${positions.length === 1 ? '' : 's'} · cost basis ${usd(cost)}`}
          </p>
        </div>
        {!adding && (
          <button className="btn-primary" onClick={() => setAdding(true)}>+ Add stock</button>
        )}
      </header>

      {error && <div className="card err">{error}</div>}

      {adding && (
        <AddStockForm universe={stocks} onAdded={handleAdded} onCancel={() => setAdding(false)} />
      )}

      <div className="home-hero card">
        <div className="rh-label muted">Total value</div>
        <div className="rh-value">{usd(value)}</div>
        {isEmpty ? (
          <p className="muted">Add a stock to start tracking your portfolio.</p>
        ) : (
          <>
            <div className={`rh-change ${plClass(totalPl)}`}>
              {signedUsd(totalPl)} <span className="rh-pct">{signedPct(totalPlPct)}</span>
              <span className="muted rh-since"> all time</span>
              {day && (
                <span className={`day-chip ${plClass(day.change)}`}>
                  {signedUsd(day.change)} ({signedPct(day.changePct)}) today
                </span>
              )}
            </div>
            <PortfolioChart points={points} costBasis={cost} height={230} />
          </>
        )}
      </div>

      {!isEmpty && (
        <div className="card">
          <div className="card-head">
            <h2>Holdings</h2>
            <span className="muted tiny">click a row for purchase lots</span>
          </div>

          <div className="holdings-table-head">
            <span>Stock</span>
            <span>Shares</span>
            <span>Avg cost</span>
            <span>Price</span>
            <span>Total cost</span>
            <span>Value</span>
            <span>Total P/L</span>
            <span />
          </div>

          {positions.map((position) => {
            const open = expanded === position.symbol;
            return (
              <div className={`holding-block ${open ? 'open' : ''}`} key={position.symbol}>
                <div className="holding-main" onClick={() => setExpanded(open ? null : position.symbol)}>
                  <div className="hb-stock">
                    <span className="hb-caret muted">{open ? '▾' : '▸'}</span>
                    <div>
                      <div className="hr-sym">{position.symbol}</div>
                      <div className="hr-name muted tiny">{stocks[position.symbol]?.name}</div>
                    </div>
                  </div>
                  <span className="num">{fmtShares(position.shares)}</span>
                  <span className="num">{usd(position.avgCost)}</span>
                  <span className="num">
                    {usd(position.price)}
                    <span className={`hb-day ${plClass(position.dayChange)}`}>{signedPct(position.dayChangePct)}</span>
                  </span>
                  <span className="num">{usd(position.cost)}</span>
                  <span className="num">{usd(position.value)}</span>
                  <span className={`num ${plClass(position.pl)}`}>
                    {signedUsd(position.pl)}
                    <span className="hb-day">{signedPct(position.plPct)}</span>
                  </span>
                  <span className="hb-actions">
                    <button
                      className="btn-link"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenStock(position.symbol);
                      }}
                    >
                      Explore
                    </button>
                    <button
                      className="btn-danger"
                      disabled={busy === position.symbol}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeHolding(position.symbol);
                      }}
                    >
                      {busy === position.symbol ? '…' : 'Sell all'}
                    </button>
                  </span>
                </div>

                {open && (
                  <div className="lots">
                    <div className="lots-head">
                      <span>Purchased</span>
                      <span>Shares</span>
                      <span>Price</span>
                      <span>Cost</span>
                      <span>P/L</span>
                      <span />
                    </div>
                    {position.lots.map((lot) => {
                      const lotValue = position.price != null ? lot.shares * position.price : 0;
                      const lotPl = lotValue - lot.cost;
                      return (
                        <div className="lot-row" key={lot.id}>
                          <span>{lot.purchaseDate}</span>
                          <span className="num">{fmtShares(lot.shares)}</span>
                          <span className="num">{usd(lot.buyPrice)}</span>
                          <span className="num">{usd(lot.cost)}</span>
                          <span className={`num ${plClass(lotPl)}`}>
                            {signedUsd(lotPl)} <span className="muted tiny">{signedPct(lot.cost ? lotPl / lot.cost : 0)}</span>
                          </span>
                          <span>
                            <button
                              className="btn-danger"
                              disabled={busy === lot.id}
                              onClick={() => removeLot(lot.id, position.symbol)}
                            >
                              {busy === lot.id ? '…' : 'Remove lot'}
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="holdings-total">
            <span>Total</span>
            <span className="num">{usd(cost)} cost</span>
            <span className="num">{usd(value)} value</span>
            <span className={`num ${plClass(totalPl)}`}>{signedUsd(totalPl)} ({pct(totalPlPct)})</span>
          </div>
        </div>
      )}
    </div>
  );
}
