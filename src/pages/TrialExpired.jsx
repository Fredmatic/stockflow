// Shown when the business's trial has expired and they haven't paid yet.
// Gives them a clear call-to-action to pay via WhatsApp/MTN Mobile Money.

const WHATSAPP_NUMBER = '256740193837' // Fred's number — update if needed
const MTN_PAYBILL = '256708401692'     // update to actual MTN Mobile Money number

function daysLeft(trialEndsAt) {
  if (!trialEndsAt) return 0
  const diff = new Date(trialEndsAt) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function TrialExpiredScreen({ business, onSignOut }) {
  const days = daysLeft(business?.trial_ends_at)
  const isExpired = business?.subscription_status === 'expired' || days === 0
  const whatsappMsg = encodeURIComponent(
    `Hi Fred, I'd like to subscribe to StockTracer for my business "${business?.name}". Please help me activate my account.`
  )

  if (!isExpired) return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="text-5xl">⏰</div>
        <div>
          <h1 className="font-display text-xl font-semibold mb-2">Your free trial has ended</h1>
          <p className="text-sm text-muted">
            Your 14-day free trial for <strong>{business?.name}</strong> has expired. Subscribe to keep using StockTracer — your data is safe and will be restored immediately.
          </p>
        </div>

        {/* Plans */}
        <div className="space-y-3 text-left">
          <div className="bg-paper-raised border border-line rounded-lg p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="font-display font-semibold text-sm">Starter</span>
              <span className="font-mono font-semibold text-brand-dark">UGX 30,000<span className="text-xs text-muted font-normal">/mo</span></span>
            </div>
            <ul className="text-xs text-muted space-y-1">
              <li>✓ Up to 3 staff</li>
              <li>✓ 500 products</li>
              <li>✓ Sales & stock tracking</li>
            </ul>
          </div>
          <div className="bg-brand-dark text-white rounded-lg p-4 relative">
            <div className="absolute -top-2 left-4 text-xs bg-white text-brand-dark font-semibold rounded-full px-2 py-0.5">Most popular</div>
            <div className="flex justify-between items-center mb-1">
              <span className="font-display font-semibold text-sm">Pro</span>
              <span className="font-mono font-semibold">UGX 80,000<span className="text-xs opacity-70 font-normal">/mo</span></span>
            </div>
            <ul className="text-xs opacity-80 space-y-1">
              <li>✓ Unlimited staff & products</li>
              <li>✓ Full profit reports</li>
              <li>✓ Customer credit & expenses</li>
            </ul>
          </div>
        </div>

        {/* Payment options */}
        <div className="space-y-3">
          <p className="text-xs text-muted font-medium uppercase tracking-wide">Pay via</p>

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white rounded-md py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <span className="text-lg">💬</span>
            Pay via WhatsApp
          </a>

          <div className="bg-paper-raised border border-line rounded-md p-4 text-left text-sm">
            <div className="font-medium mb-1">MTN Mobile Money</div>
            <div className="text-muted text-xs space-y-1">
              <div>Send to: <span className="font-mono font-semibold text-ink">{MTN_PAYBILL}</span></div>
              <div>Name: <span className="font-semibold text-ink">Fred Mugisha</span></div>
              <div className="pt-1 text-brand-dark">Then WhatsApp us your payment screenshot to activate →</div>
            </div>
          </div>
        </div>

        <button onClick={onSignOut} className="text-xs text-muted hover:text-ink underline">
          Sign out
        </button>
      </div>
    </div>
  )
}

export { daysLeft }
