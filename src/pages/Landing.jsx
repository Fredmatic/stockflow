import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    icon: '📦',
    title: 'Real-time stock tracking',
    desc: 'Know exactly what you have, what\'s running low, and what\'s overstocked — at a glance.',
  },
  {
    icon: '💰',
    title: 'Sales & net profit',
    desc: 'See your real profit after expenses, not just revenue. Know if your business is actually making money.',
  },
  {
    icon: '👥',
    title: 'Staff & cashier control',
    desc: 'Each staff member logs in with their own PIN. You control who sees what.',
  },
  {
    icon: '🤝',
    title: 'Customer credit & debts',
    desc: 'Track who owes you and for how long. Get alerts when payments are overdue.',
  },
  {
    icon: '📊',
    title: 'Expenses tracking',
    desc: 'Log every business cost and see exactly where your money is going.',
  },
  {
    icon: '🔔',
    title: 'Low stock alerts',
    desc: 'Never run out of your best-selling items. Get warned before it happens.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Fred M.',
    business: 'FredMatic Shop, Kampala',
    quote: 'StockTracer showed me I was losing money on two products I thought were profitable. That alone paid for itself.',
  },
  {
    name: 'Namubiru J.',
    business: 'Salon & Beauty, Bulenga',
    quote: 'My staff used to steal stock and I had no way to prove it. Now every item is tracked.',
  },
  {
    name: 'Stanely S.',
    business: 'Electronics Hub, Bwaise',
    quote: 'I can see my shop\'s performance from my phone even when I\'m not there. Game changer.',
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: 'UGX 30,000',
    period: '/month',
    features: ['Up to 3 staff', '500 products', 'Sales & stock tracking', 'Basic reports'],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'UGX 80,000',
    period: '/month',
    features: ['Unlimited staff', 'Unlimited products', 'Full profit reports', 'Customer credit tracking', 'Expense management', 'Priority support'],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    name: 'Custom',
    price: 'Let\'s talk',
    period: '',
    features: ['Multi-branch support', 'Custom features for your business', 'Setup & training included', 'Dedicated support'],
    cta: 'Contact us',
    highlight: false,
  },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-paper text-ink">

      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-paper-raised border-b border-line px-6 py-3 flex items-center justify-between">
        <div className="font-display text-lg font-semibold text-brand-dark">StockTracer</div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-muted font-medium px-3 py-1.5 rounded-md hover:text-ink transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="btn-primary text-sm px-4 py-1.5"
          >
            Start free trial
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-2xl mx-auto text-center px-6 pt-20 pb-16">
        <div className="inline-block text-xs font-medium bg-brand-light text-brand-dark rounded-full px-3 py-1 mb-6">
          🇺🇬 Built for Ugandan businesses
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight mb-5">
          Stop guessing.<br />
          <span className="text-brand">Start knowing.</span>
        </h1>
        <p className="text-muted text-lg mb-8 max-w-xl mx-auto">
          StockTracer helps shop owners track stock, sales, staff, and real profit — all from their phone. No spreadsheets. No guessing.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/signup')}
            className="btn-primary px-8 py-3 text-base"
          >
            Start your free 14-day trial
          </button>
          <button
            onClick={() => navigate('/login')}
            className="btn-secondary px-8 py-3 text-base"
          >
            I already have an account
          </button>
        </div>
        <p className="text-xs text-muted mt-4">No credit card needed. Cancel anytime.</p>
      </section>

      {/* STATS */}
      <section className="bg-brand-dark text-white py-10">
        <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { n: '14 days', label: 'Free trial' },
            { n: '5 min', label: 'To get started' },
            { n: '100%', label: 'Mobile friendly' },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-display text-2xl font-semibold">{s.n}</div>
              <div className="text-sm opacity-70 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="font-display text-2xl font-semibold text-center mb-2">
          Everything your shop needs
        </h2>
        <p className="text-muted text-sm text-center mb-10">
          Built specifically for retail shops, salons, electronics stores, and wholesalers in Uganda.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-paper-raised border border-line rounded-lg p-5">
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="font-display font-semibold text-sm mb-1">{f.title}</div>
              <p className="text-muted text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-paper-raised border-y border-line py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="font-display text-2xl font-semibold text-center mb-10">
            Set up in 5 minutes
          </h2>
          <div className="space-y-6">
            {[
              { n: '1', title: 'Create your account', desc: 'Sign up with your email and business name. No technical knowledge needed.' },
              { n: '2', title: 'Add your products', desc: 'Enter your stock items, costs, and selling prices. Import from a list if you have one.' },
              { n: '3', title: 'Add your staff', desc: 'Each cashier or staff member gets their own name and PIN.' },
              { n: '4', title: 'Start selling', desc: 'Record every sale. Watch your stock, profit, and debts update in real time.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-brand-dark text-white text-sm font-display font-semibold flex items-center justify-center flex-shrink-0">
                  {step.n}
                </div>
                <div>
                  <div className="font-medium text-sm mb-0.5">{step.title}</div>
                  <p className="text-muted text-xs">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="font-display text-2xl font-semibold text-center mb-10">
          What business owners say
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-paper-raised border border-line rounded-lg p-5">
              <p className="text-sm text-ink leading-relaxed mb-4 italic">"{t.quote}"</p>
              <div className="text-xs font-semibold">{t.name}</div>
              <div className="text-xs text-muted">{t.business}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-paper-raised border-y border-line py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-2xl font-semibold text-center mb-2">Simple, honest pricing</h2>
          <p className="text-muted text-sm text-center mb-10">14-day free trial on all plans. No credit card needed.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg p-5 border flex flex-col ${plan.highlight
                  ? 'bg-brand-dark text-white border-transparent'
                  : 'bg-paper border-line text-ink'
                  }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-medium bg-white/20 rounded-full px-2 py-0.5 w-fit mb-3">
                    Most popular
                  </div>
                )}
                <div className="font-display font-semibold mb-1">{plan.name}</div>
                <div className="mb-4">
                  <span className="text-2xl font-bold font-display">{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'opacity-70' : 'text-muted'}`}>{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`text-xs flex gap-2 ${plan.highlight ? 'opacity-90' : 'text-muted'}`}>
                      <span>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate(plan.name === 'Custom' ? window.open('https://wa.me/256740192827', '_blank')
                    : navigate('/signup'))}
                  className={`w-full py-2 rounded-md text-sm font-medium transition-colors ${plan.highlight
                    ? 'bg-white text-brand-dark hover:bg-brand-light'
                    : 'btn-primary'
                    }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BOTTOM */}
      <section className="max-w-xl mx-auto text-center px-6 py-20">
        <h2 className="font-display text-2xl font-semibold mb-4">
          Ready to take control of your business?
        </h2>
        <p className="text-muted text-sm mb-6">
          Join shop owners across Uganda who use StockTracer to grow their profits and stop losses.
        </p>
        <button
          onClick={() => navigate('/signup')}
          className="btn-primary px-8 py-3 text-base"
        >
          Start free trial — no card needed
        </button>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <div className="font-display font-semibold text-brand-dark mb-1">StockTracer</div>
        <p>Built in Uganda 🇺🇬 · © {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}
