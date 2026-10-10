// Brand mark: glossy vector blood drop with an optional animated heartbeat line.
import { useId } from "react";

export function Drop({ size = 28, ecg = false, className }: { size?: number; ecg?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 100 125" className={className} aria-hidden>
      <defs>
        <radialGradient id={`g${id}`} cx="35%" cy="62%" r="70%">
          <stop offset="0%" stopColor="#ff6b85" />
          <stop offset="55%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#7f0d24" />
        </radialGradient>
      </defs>
      <path d="M50 2C38 26 6 52 6 80a44 44 0 0 0 88 0C94 52 62 26 50 2z" fill={`url(#g${id})`} />
      <ellipse cx="31" cy="78" rx="7" ry="13" fill="#fff" opacity=".28" transform="rotate(14 31 78)" />
      <circle cx="33" cy="99" r="3.4" fill="#fff" opacity=".3" />
      {ecg && (
        <path className="ecg-path" d="M2 82h22l6-9 6 9h6l5 14 8-40 8 34 4-8h31" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <Drop size={compact ? 20 : 24} />
      <span>Rakt<b>Doot</b></span>
    </span>
  );
}
