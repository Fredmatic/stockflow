# StockFlow

A stock management system for small shops — tracks what's in, what's sold out,
and what's running low. Built to start with a retail shop and electronics/phones
shop, sharing one codebase (a supermarket can be added later the same way).

**Cost: UGX 0.** Runs entirely on free tiers: Supabase (database + auth) and
Vercel (hosting). No server to manage, nothing that expires after 30 days.

---

## 1. Create your Supabase project (the database)

1. Go to [supabase.com](https://supabase.com) → sign up free → "New project".
2. Once it's created, open **SQL Editor** → **New query**.
3. Paste the entire contents of `supabase/schema.sql` (in this project) and click **Run**.
   This creates all the tables, the stock-level view, and the security rules.
4. Go to **Settings → API**. You'll need two values from here in the next step:
   - **Project URL**
   - **anon public** key

## 2. Connect the app to your database

1. In this project folder, copy `.env.example` to a new file named `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and paste in your Project URL and anon key from step 1.

## 3. Run it locally

```
npm install
npm run dev
```

Open the URL it gives you (usually `http://localhost:5173`).

- **First time:** click "Create business", enter your email, a password, your
  business name, and pick retail or electronics. This becomes the **owner**
  login — keep this email/password safe, it's the master login.
- After signing in, go to **Staff** and add yourself and any cashiers, each
  with a 4-digit PIN. From then on, whoever is using the till just taps their
  name and types their PIN — no need to log in with email each time.

## 4. Put it online for free (Vercel)

1. Push this project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → sign up free → **Add New Project** → import your repo.
3. Before deploying, add the same two environment variables from your `.env`
   file under **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Vercel gives you a free `https://yourapp.vercel.app` link you can
   open from any phone or computer — staff can use it right from a browser,
   no app install needed.

---

## How the stock numbers work

Nothing stores a raw "quantity" number that can get out of sync. Instead,
every stock change — a restock, a sale, a damaged item — is logged as its own
row in `stock_movements`. The quantity on hand is always the **sum** of those
movements, calculated live by the `product_stock` view in the database. This
means you always have a full history of what happened and why, and the
numbers can never silently drift from reality.

- **In stock** — quantity above your set reorder level
- **Low stock** — quantity at or below reorder level (shows up under "Needs attention")
- **Out of stock** — quantity is zero

## Adding electronics-specific or supermarket-specific fields

Each product has a flexible `attributes` field. The product form already
shows IMEI/warranty fields when your business type is "electronics", and an
expiry date field for "supermarket". If you add a supermarket business later,
just set `type: 'supermarket'` when creating that business — the form adapts.

## What's deliberately simple (and how to extend it)

- **Staff PINs are for attribution, not security.** The real account security
  is the owner's Supabase login. PINs just track who did what — good enough
  for a small team on a shared device, not meant to stop a determined insider.
- **No barcode scanner integration yet** — search is by typing name/SKU. A
  phone camera barcode scanner (e.g. the `react-zxing` library) can be added
  to the Sell and Stock In search boxes later.
- **No low-stock notifications yet** — the Dashboard shows what needs
  attention, but it doesn't push a WhatsApp/email alert. That can be added as
  a small scheduled Supabase Edge Function once you're ready.
