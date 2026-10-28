import { useEffect, useRef, useState } from 'react';
import { formatINR } from '../lib/money';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tweens an amount (paise) from its previous value to the new one. */
export function CountUp({ paise, className }: { paise: number; className?: string }) {
  const [shown, setShown] = useState(reduced() ? paise : 0);
  const from = useRef(shown);

  useEffect(() => {
    if (reduced()) {
      setShown(paise);
      return;
    }
    const start = from.current;
    const delta = paise - start;
    const t0 = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + delta * eased);
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paise]);

  return <span className={className}>{formatINR(shown)}</span>;
}
