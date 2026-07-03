# 🌴 Dubai Finance Tracker

A personal finance web application built for Indians working in Dubai. Track expenses in AED, convert to INR, monitor savings, and reach your financial goals.

For a deep dive into how the app is built — data flow, database schema, the historical currency-snapshot system, and the business rules behind each feature — see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Features

- 📊 **Dashboard** — Monthly overview with income, expenses, savings, and AED→INR values
- 💸 **Expense Tracking** — Add, edit, delete with 12 categories + search/filter
- 💰 **Income Management** — Salary, bonus, freelance tracking
- 🎯 **Goals** — Set and track financial goals with progress bars
- 🪙 **Gold Tracker** — Track gold purchases by grams, price, and value
- 📈 **Analytics** — Charts for spending trends, category breakdowns, savings
- 💼 **Budget Planner** — Monthly category budgets with Green/Yellow/Red alerts
- 🔄 **AED → INR Converter** — Standalone calculator with configurable rate
- 🌴 **Dubai Life** — Personal journey dashboard with milestones
- 🔗 **Chit Funds** — Track India-side chit fund installments and payouts
- 📥 **Reports** — Export expenses, income, goals to CSV (includes frozen AED/INR values)
- 🌙 **Dark/Light Mode** — Persisted theme preference
- 🔒 **Accounts** — Email/password auth via Supabase; your data is private to your account

## Tech Stack

- **React 19** + **TypeScript**, built with **Vite**
- **Tailwind CSS** (styling)
- **Recharts** (charts)
- **React Router v6** (routing)
- **Zustand** (state management)
- **Supabase** (Postgres database + auth — this is the backend; there is no separate server in this repo)

## Getting Started

Requires a Supabase project. Create `.env` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

Then set up the database by running the SQL files in
[`supabase/migrations/`](supabase/migrations) in order, via the Supabase
Dashboard's SQL Editor (see [`supabase/README.md`](supabase/README.md) for
the migration convention).

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your repository
4. Framework: **Vite** (auto-detected)
5. Add the two `VITE_SUPABASE_*` environment variables from above in the Vercel project settings
6. Deploy!

## Project Structure

```
src/
├── components/
│   ├── layout/     # Sidebar layout + status banners
│   └── ui/         # Reusable UI primitives
├── pages/          # One file per route
├── stores/         # Zustand state (auth + app data/CRUD)
├── types/          # TypeScript interfaces
└── utils/          # Currency conversion, formatting, Supabase client, exchange-rate refresh
supabase/
└── migrations/     # SQL schema, applied in order — see supabase/README.md
```

## Data Storage

All data lives in Supabase Postgres, scoped per-user via Row Level Security
— each account only ever sees its own rows. Nothing is stored in
localStorage.

## Default Settings

- Exchange Rate: **1 AED = ₹23 INR** by default, auto-refreshed from a live
  rate API roughly once a day, and manually overridable in Settings/Converter
- Theme: Dark mode

---

Built with ❤️ for the Indian expat community in Dubai 🇦🇪
