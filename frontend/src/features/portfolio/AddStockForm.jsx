import { useEffect, useState } from 'react';
import { api, usd } from '../../api.js';

const today = () => new Date().toISOString().slice(0, 10);

// Buy a stock: pick it, say how many shares and when. The price defaults to that day's
// actual close (pulled from the seeded bars) so the cost basis is realistic, but it stays
// editable for anyone entering a real fill price.
export default function AddStockForm({ universe, onAdded, onCancel }) {
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [buyPrice, setBuyPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tickers = Object.keys(universe || {}).sort();

  // Prefill the purchase price with the close on the chosen date, unless the user has
  // typed their own price.
  useEffect(() => {
    if (!symbol || priceTouched) return;
    let cancelled = false;
    api
      .priceOn(symbol, purchaseDate)
      .then((price) => {
        if (!cancelled && price != null) setBuyPrice(String(Math.round(price * 100) / 100));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol, purchaseDate, priceTouched]);

  const sharesNum = Number(shares);
  const priceNum = Number(buyPrice);
  const totalCost = sharesNum > 0 && priceNum > 0 ? sharesNum * priceNum : null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.addLot({ symbol, shares: sharesNum, buyPrice: priceNum, purchaseDate });
      onAdded();
    } catch (submitError) {
      setError(submitError.message || 'Could not add that position.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card add-stock" onSubmit={handleSubmit}>
      <div className="card-head">
        <h2>Add a position</h2>
        <span className="muted tiny">buying more of a stock you own adds a new lot</span>
      </div>

      <div className="add-stock-grid">
        <label>
          Stock
          <select value={symbol} onChange={(event) => setSymbol(event.target.value)} required>
            <option value="">Select a stock…</option>
            {tickers.map((ticker) => (
              <option key={ticker} value={ticker}>
                {ticker} — {universe[ticker].name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Quantity (shares)
          <input
            type="number"
            min="0"
            step="any"
            value={shares}
            onChange={(event) => setShares(event.target.value)}
            placeholder="10"
            required
          />
        </label>

        <label>
          Purchase date
          <input
            type="date"
            value={purchaseDate}
            max={today()}
            onChange={(event) => setPurchaseDate(event.target.value)}
            required
          />
        </label>

        <label>
          Price per share
          <input
            type="number"
            min="0"
            step="0.01"
            value={buyPrice}
            onChange={(event) => {
              setPriceTouched(true);
              setBuyPrice(event.target.value);
            }}
            placeholder="0.00"
            required
          />
        </label>
      </div>

      <div className="add-stock-foot">
        <div className="add-stock-total">
          {totalCost != null ? (
            <>
              Total cost <strong>{usd(totalCost)}</strong>
            </>
          ) : (
            <span className="muted">Enter a quantity and price</span>
          )}
        </div>
        <div className="add-stock-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !symbol || !(sharesNum > 0) || !(priceNum > 0)}>
            {saving ? 'Adding…' : 'Add position'}
          </button>
        </div>
      </div>

      {error && <p className="add-stock-error">{error}</p>}
    </form>
  );
}
