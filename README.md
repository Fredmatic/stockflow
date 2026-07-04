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
# Payment reminders — setup guide

## 1. Database
Run `migration_reminders_push.sql` in Supabase SQL Editor. It's safe to run
even though `recurring_reminders` already exists — everything uses
`if not exists` / `add column if not exists`.

**Check the currency**: `Reminders.jsx` currently hardcodes `UGX` when
displaying amounts. If StockTracer already has a currency setting or shows
amounts differently elsewhere (e.g. in `Expenses.jsx`), search for how that
page formats `amount` and match it — search for `toLocaleString` or a
`formatCurrency` helper in your `lib` folder.

## 2. Generate VAPID keys (one-time)
```bash
npx web-push generate-vapid-keys
```
This prints a public and private key.

- Public key → add to your **frontend** `.env` as:
  ```
  VITE_VAPID_PUBLIC_KEY=BÂ…yourkeyhere
  ```
- Both keys → set as **Supabase Edge Function secrets**:
  ```bash
  supabase secrets set VAPID_PUBLIC_KEY=Bâ€¦ VAPID_PRIVATE_KEY=â€¦ VAPID_SUBJECT=mailto:you@yourdomain.com
  ```

## 3. Deploy the Edge Function
```bash
supabase functions new send-reminders   # creates the folder structure
# replace the generated supabase/functions/send-reminders/index.ts
# with send-reminders_index.ts from this delivery
supabase functions deploy send-reminders
```

## 4. Schedule it
Open `cron_schedule.sql`, replace `<YOUR-PROJECT-REF>` and
`<YOUR-SERVICE-ROLE-KEY>` (Project Settings → API → service_role key — keep
this secret, never put it in frontend code), then run it in the SQL Editor.

This runs every hour and only sends to businesses where it's currently 6pm
in *their* `time_zone` column — so one schedule handles every business
correctly regardless of location.

## 5. Frontend files
Copy into your project:
- `sw.js` → `public/sw.js`
- `usePushNotifications.js` → `src/hooks/usePushNotifications.js` (create the `hooks` folder)
- `Reminders.jsx` → `src/pages/Reminders.jsx`

## 6. Wire up the route
In `src/App.jsx`:

```diff
 import Reports from './pages/Reports'
+import Reminders from './pages/Reminders'
```

```diff
                 <Route path="/reports" element={<Restricted path="/reports"><Reports /></Restricted>} />
+                <Route path="/reminders" element={<Restricted path="/reminders"><Reminders /></Restricted>} />
```

In `src/lib/permissions.js`:

```diff
   '/staff': ['owner'],
   '/reports': ['owner'],
+  '/reminders': ['owner'],
 }
```

(Owner-only, same as Expenses/Lenders — matches "each owner must enter
their own" amounts from your original ask.)

## 7. Add a nav link
I don't have `Layout.jsx`'s contents, so I can't give you an exact diff —
open it and add a link to `/reminders` the same way the existing link to
`/expenses` is written (same component, same icon import pattern). Paste
`Layout.jsx` here if you want me to write the exact line.

## 8. Test it
1. Deploy/build the frontend, open the app on a real device (push doesn't
   work in `localhost` HTTP — needs HTTPS, so test on your deployed URL or
   `vite dev --https`).
2. Go to `/reminders`, click "Turn on", accept the browser permission
   prompt.
3. Add a "daily" reminder so it's due today.
4. Manually invoke the function once to test without waiting for the cron:
   ```bash
   curl -X POST https://<ref>.supabase.co/functions/v1/send-reminders \
     -H "Authorization: Bearer <service-role-key>"
   ```
   (Only fires if it's currently 6pm in the business's `time_zone` — for a
   first test, temporarily edit your business's `time_zone` row or comment
   out the `isSixPmIn` check in the function.)

## Known limitation to flag
iOS Safari only supports web push for PWAs added to the Home Screen (iOS
16.4+), not for a normal Safari tab. The UI already shows a note about this
when `push.supported` is false, but it's worth confirming your target
owners are comfortable doing that install step.