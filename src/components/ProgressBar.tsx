export function ProgressBar({ value, label, compact = false }: { value: number; label?: string; compact?: boolean }) {
  return (
    <div className={`progress-wrap ${compact ? 'compact' : ''}`}>
      {label && <div className="progress-label"><span>{label}</span><strong>{value}%</strong></div>}
      <div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
    </div>
  )
}
