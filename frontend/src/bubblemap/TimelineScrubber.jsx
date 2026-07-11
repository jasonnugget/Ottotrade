import { useEffect, useRef, useState } from 'react';
import { tierColor } from './theme.js';

// Date scrubber that progressively reveals events. Play advances through the window.
export default function TimelineScrubber({ timeline, currentTs, onChange }) {
  const [playing, setPlaying] = useState(false);
  const raf = useRef(null);

  const start = timeline.start;
  const end = timeline.end;
  const span = Math.max(1, end - start);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const stepPerSec = span / 12; // full sweep ~12s
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      let next = (currentTsRef.current ?? end) + stepPerSec * dt;
      if (next >= end) {
        next = end;
        setPlaying(false);
      }
      onChange(Math.floor(next));
      if (next < end) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const currentTsRef = useRef(currentTs);
  currentTsRef.current = currentTs;

  const value = currentTs ?? end;
  const pct = ((value - start) / span) * 100;
  const dateStr = new Date(value * 1000).toISOString().slice(0, 10);

  const restart = () => {
    onChange(start);
    setPlaying(true);
  };

  return (
    <div className="scrubber">
      <div className="scrubber-controls">
        <button className="play-btn" onClick={() => (value >= end ? restart() : setPlaying((p) => !p))}>
          {playing ? '⏸' : value >= end ? '↻' : '▶'}
        </button>
        <div className="scrubber-date">{dateStr}</div>
      </div>
      <div className="scrubber-track-wrap">
        <div className="scrubber-track">
          <div className="scrubber-fill" style={{ width: `${pct}%` }} />
          {timeline.markers.map((m) => {
            const left = ((m.ts - start) / span) * 100;
            const revealed = m.ts <= value;
            return (
              <div
                key={m.id}
                className={`scrubber-marker ${revealed ? 'on' : ''}`}
                style={{ left: `${left}%`, background: tierColor(m.tier) }}
                title={`${m.date} · ${m.headline}`}
              />
            );
          })}
        </div>
        <input
          type="range"
          min={start}
          max={end}
          value={value}
          step={86400}
          onChange={(e) => {
            setPlaying(false);
            onChange(Number(e.target.value));
          }}
        />
      </div>
      <div className="scrubber-ends muted tiny">
        <span>{new Date(start * 1000).toISOString().slice(0, 10)}</span>
        <span>{new Date(end * 1000).toISOString().slice(0, 10)}</span>
      </div>
    </div>
  );
}
