import { daysLeft } from '../pages/TrialExpired'

const WHATSAPP_NUMBER = '256708401692'

export default function TrialBanner({ business }) {
  if (!business) return null
  if (business.subscription_status === 'active') return null

  const days = daysLeft(business.trial_ends_at)
  if (days === 0) return null // paywall handles this case

  const isUrgent = days <= 3
  const whatsappMsg = encodeURIComponent(
    `Hi Fred, I'd like to subscribe to StockTracer for my business "${business.name}". Please help me activate my account.`
  )

  return (
    <div className={`mb-4 flex items-center gap-3 rounded-md px-4 py-2.5 text-sm ${
      isUrgent
        ? 'bg-brick/10 border border-brick/30 text-brick'
        : 'bg-amber-light border border-amber/30 text-amber'
    }`}>
      <span>{isUrgent ? '⚠' : '⏳'}</span>
      <span className="flex-1">
        {isUrgent
          ? `Trial expires in ${days} day${days !== 1 ? 's' : ''}! Subscribe to keep your data.`
          : `Free trial — ${days} day${days !== 1 ? 's' : ''} remaining.`}
      </span>
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-semibold underline whitespace-nowrap"
      >
        Subscribe →
      </a>
    </div>
  )
}
