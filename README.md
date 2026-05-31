# 🎯 SamSnipe — AI Resale Deal Finder

An AI sourcing agent that scans the internet for profitable **Amazon US** resale
deals, **matches the exact ASIN** (the identifier your resale software uses to
authenticate an item), and hands you a vetted, ranked buy list — so you stop
hunting for deals and let the agent hunt for you.

Think **SellerAmp**, but the AI does the *sourcing*, not just the analysis.

---

## What it does (prototype)

- **AI deal feed** — a beautiful dashboard of deals the agent surfaced, ranked by ROI.
- **ASIN match confidence** — every deal shows a 0–100 match score with the
  evidence (UPC/EAN, model #, title AI, image AI) and a pack-size mismatch warning.
  Getting the ASIN right is the make-or-break of arbitrage; we make trust visible.
- **Go / Watch / Pass verdict** — an AI one-liner explaining each call.
- **Full Amazon US profit math** — referral + FBA fees, ROI, margin, breakeven,
  with a live what-if calculator in the detail view.
- **Risk radar** — IP-complaint risk, gated category, hazmat, meltable, slow-seller,
  pack-size mismatch — flagged *before* you buy.
- **Natural-language sourcing** — type *"toys under \$20 with 50% ROI, BSR under
  100,000"* and the feed filters to match.
- **90-day price/BSR history** sparklines (Keepa-style).
- **Run Scan** — simulates the agent sweeping 9 retail sources for fresh finds.

## Best-of-breed features it borrows

| From | Feature |
|---|---|
| SellerAmp | At-a-glance ROI/BSR/profit + eligibility |
| Tactical Arbitrage | Multi-site scanning + reverse/image ASIN matching |
| Keepa | Price & BSR history, drop tracking |
| BuyBotPro | Automated Go/No-Go score, IP & hazmat risk |
| Helium 10 / Jungle Scout | Sell-through / demand estimation |

---

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Ships in **demo mode** with realistic, internally-consistent mock data — every
profit number runs through the same `calcProfit()` used in production.

### Go live with Keepa

1. Get a Keepa API key: https://keepa.com/#!api
2. `cp .env.example .env.local`, set `KEEPA_API_KEY` and `KEEPA_LIVE=1`.
3. The data-source banner flips from amber (demo) to green (live).

See `.env.example` for the SP-API and LLM keys that unlock official Amazon
fees/eligibility and the full AI sourcing + image-matching pipeline.

---

## Architecture

```
src/
  app/
    page.tsx            Dashboard (deal feed, search, scan, stats)
    api/deals/route.ts  Deal API — mock now, Keepa-backed when live
  components/           DealCard, DealDetail drawer, Badges, Sparkline, Sidebar
  lib/
    types.ts            Domain model (Deal, AsinMatch, RiskFlag...)
    profit.ts           Amazon US FBA fee / ROI / breakeven math
    mockData.ts         Deterministic sourcing engine (stand-in for crawlers)
    keepa.ts            Keepa client — flips to live on KEEPA_LIVE=1
    search.ts           Natural-language to structured filter (LLM later)
    format.ts           Display helpers + labels
```

## Roadmap

- [ ] Live Keepa product + price/BSR history
- [ ] Amazon SP-API: real fees, your account's gating/eligibility
- [ ] Real crawlers (retailer feeds + scraping) feeding the deal queue
- [ ] LLM sourcing brief to criteria + multimodal image-to-ASIN matching with confidence
- [ ] Persistent buy list / watchlist (Supabase) + daily digest push
- [ ] Browser extension overlay + mobile in-store scanner

> Built around the one thing that matters most: **matching the right ASIN**, so
> your resale software authenticates the exact item every time.
