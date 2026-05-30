# 🌴 Dubai Finance Tracker

A personal finance web application built for Indians working in Dubai. Track expenses in AED, convert to INR, monitor savings, and reach your financial goals.

## Features

- 📊 **Dashboard** — Monthly overview with income, expenses, savings, and AED→INR values
- 💸 **Expense Tracking** — Add, edit, delete with 12 categories + search/filter
- 💰 **Income Management** — Salary, bonus, freelance tracking
- 🎯 **Goals** — Set and track financial goals with progress bars
- 🪙 **Gold Tracker** — Track gold purchases by grams, price, and value
- 📈 **Analytics** — Charts for spending trends, category breakdowns, savings
- 💼 **Budget Planner** — Monthly category budgets with Green/Yellow/Red alerts
- 🔄 **AED → INR Converter** — Real-time conversion with configurable rate
- 🌴 **Dubai Life** — Personal journey dashboard with milestones
- 📥 **Reports** — Export expenses, income, goals to CSV
- 🌙 **Dark/Light Mode** — Persisted theme preference

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** (build tool)
- **Tailwind CSS** (styling)
- **Recharts** (charts)
- **React Router v6** (routing)
- **Zustand** (state management)
- **localStorage** (data persistence)

## Getting Started

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
5. Deploy!

No environment variables needed — all data is stored locally.

## Deploy to Netlify

1. `npm run build`
2. Drag the `dist/` folder to [netlify.com/drop](https://netlify.com/drop)

## Project Structure

```
src/
├── components/
│   ├── layout/     # Layout with sidebar
│   └── ui/         # Reusable components
├── pages/          # Route pages
├── stores/         # Zustand state management
├── types/          # TypeScript interfaces
└── utils/          # Helper functions
```

## Data Storage

All data is stored in **localStorage** under the key `dubai-finance-tracker`. No backend or account needed.

## Default Settings

- Exchange Rate: **1 AED = ₹23 INR** (configurable in Settings)
- Theme: Dark mode

---

Built with ❤️ for the Indian expat community in Dubai 🇦🇪
