# Life Planner

AI-powered personal life planner with meal planning and trip itinerary generation.

**Stack:** Next.js 15 · Supabase · Claude API · Stripe · Tailwind CSS v4 · Vercel

---

## Features

- **Google SSO** — One-click sign in via Supabase Auth
- **Meal Planner** — Add fridge inventory → AI generates a weekly meal plan with recipes and a grocery list
- **Trip Planner** — Pick a destination and dates → AI generates a day-by-day itinerary
- **Stripe Payments** — Subscription billing for premium features (ready to wire up)
- **Row-Level Security** — All data is scoped to the authenticated user at the database level

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd life-planner
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **anon key** from Settings → API
3. Copy your **service_role key** (for Stripe webhooks)
4. Run the SQL migration in `supabase/migrations/001_initial_schema.sql` via the SQL Editor

### 3. Enable Google Auth

1. In Supabase Dashboard → Authentication → Providers → Google
2. Enable it and add your Google OAuth credentials:
   - Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
3. Add your Google Client ID and Secret in Supabase

### 4. Get a Claude API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key

### 5. Set up Stripe (optional — for payments)

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your test API keys from the Stripe Dashboard
3. Create a Product + Price for your subscription
4. Set up a webhook endpoint pointing to `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### 6. Configure environment variables

```bash
cp .env.example .env.local
# Fill in all the values
```

### 7. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 8. Deploy to Vercel

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add all env vars in Vercel's project settings
4. Deploy

---

## Project Structure

```
src/
├── app/
│   ├── auth/callback/          # OAuth callback handler
│   ├── (auth)/login/           # Login page (Google SSO)
│   ├── (protected)/            # Auth-gated layout
│   │   ├── dashboard/          # Main dashboard
│   │   ├── meals/              # Meal planner (pantry + plan + grocery)
│   │   └── trips/              # Trip listing + detail view
│   └── api/
│       ├── meals/generate/     # Claude API → meal plan
│       ├── trips/generate/     # Claude API → trip itinerary
│       └── stripe/webhook/     # Stripe subscription events
├── components/
│   └── layout/sidebar.tsx      # App navigation
├── lib/
│   ├── supabase/client.ts      # Browser Supabase client
│   ├── supabase/server.ts      # Server Supabase client
│   ├── claude.ts               # Claude API integration
│   └── stripe.ts               # Stripe helpers
├── types/index.ts              # TypeScript types
└── middleware.ts                # Auth session refresh + route protection
```

---

## Next Steps

- [ ] Add recipe detail view (expand meals to see full steps)
- [ ] Drag-and-drop meal reordering
- [ ] Trip activity editing and reordering
- [ ] Photo upload for fridge inventory (Claude Vision)
- [ ] Share trip itineraries with a public link
- [ ] Stripe checkout integration on a pricing page
- [ ] Mobile-responsive sidebar (hamburger menu)
