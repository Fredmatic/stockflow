// Lets the owner record something (a sale, a restock, an expense) as
// having happened earlier — e.g. they forgot to log it yesterday. Only
// ever rendered for owners; staff/cashiers never see it, so anything they
// record is timestamped "now" as usual.
export default function BackdateControl({
  show, onToggle, value, onChange,
  linkLabel = 'Forgot to log this earlier? Backdate this entry',
  prompt = 'When did this actually happen?',
  hint = 'This will be recorded with that date/time instead of now.',
}) {
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  return (
    <div className="mb-4">
      {!show ? (
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-muted underline decoration-dotted"
        >
          {linkLabel}
        </button>
      ) : (
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">{prompt}</span>
            <button type="button" onClick={() => { onToggle(); onChange('') }} className="text-xs text-muted">Cancel</button>
          </div>
          <input
            type="datetime-local"
            className="input font-mono text-sm"
            max={nowLocal}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="text-[11px] text-muted">{hint}</p>
        </div>
      )}
    </div>
  )
}
