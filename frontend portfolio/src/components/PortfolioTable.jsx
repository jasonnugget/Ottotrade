import { usd, pct, signedUsd, signedPct, plClass, fmtShares } from '../api.js';

// Renders a portfolio snapshot. `mode`:
//   'purchase' -> weights, buy price, shares, cost
//   'snapshot' -> buy price, current price, value, P/L
export default function PortfolioTable({ title, subtitle, snapshot, mode }) {
  if (!snapshot) return null;
  const isSnap = mode === 'snapshot';

  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <span className="muted">{subtitle}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Weight</th>
              {isSnap ? <th>Buy px</th> : <th>Buy price</th>}
              {isSnap && <th>Price</th>}
              <th>Shares</th>
              {isSnap ? <th>Value</th> : <th>Cost</th>}
              {isSnap && <th>P/L</th>}
              {isSnap && <th>P/L %</th>}
            </tr>
          </thead>
          <tbody>
            {snapshot.positions.map((p) => (
              <tr key={p.symbol}>
                <td className="sym">{p.symbol}</td>
                <td>{pct(p.weight)}</td>
                <td>{usd(p.buyPrice)}</td>
                {isSnap && <td>{usd(p.price)}</td>}
                <td>{fmtShares(p.shares)}</td>
                <td>{usd(isSnap ? p.value : p.cost)}</td>
                {isSnap && <td className={plClass(p.pl)}>{signedUsd(p.pl)}</td>}
                {isSnap && <td className={plClass(p.pl)}>{signedPct(p.plPct)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sym">TOTAL</td>
              <td>100%</td>
              <td />
              {isSnap && <td />}
              <td />
              <td>{usd(isSnap ? snapshot.totalValue : snapshot.totalCost)}</td>
              {isSnap && (
                <td className={plClass(snapshot.pl)}>{signedUsd(snapshot.pl)}</td>
              )}
              {isSnap && (
                <td className={plClass(snapshot.pl)}>{signedPct(snapshot.plPct)}</td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
