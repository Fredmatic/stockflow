// A small, quiet loading indicator used in place of "Loading…" text.
// Data usually loads in well under a second on a good connection, so a
// flash of text reads as noisier than it needs to be — a spinner says
// the same thing without the words.
export default function Spinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <div className="w-6 h-6 rounded-full border-2 border-line border-t-brand-dark animate-spin" />
    </div>
  )
}
