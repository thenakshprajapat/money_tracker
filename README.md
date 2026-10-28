<div align="center">

# My Money

**A quiet, fast, offline-first personal finance tracker.**
Track every rupee across your accounts, lock the past, and sync everywhere.

![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-ffca28?style=flat-square&logo=firebase&logoColor=black)
![Tests](https://img.shields.io/badge/tests-vitest-3ddc84?style=flat-square)

</div>

---

## Features

| | |
| --- | --- |
| **Accounts** | ICICI Bank, SBI Bank, Kotak 811 and Wallet, seeded on first login. Rename them and set opening balances. |
| **Sources** | Mom, Dad, Rent (income) and Personal (income or expense), with per-month totals. |
| **Self transfers** | Move money between your own accounts as **one linked record**. A live preview shows both balances before and after. Net worth never changes. |
| **Locking** | Transactions become read-only after N days (default 7). The UI shows a lock icon and date, and **Firestore rules enforce it**. |
| **Offline first** | IndexedDB persistence. Add and edit with no connection, and it syncs when you are back. |
| **Cross-device** | Google sign-in, with data synced through Firestore. |
| **Indian formatting** | `₹1,00,000.00` and `28 Oct 2026`. |
| **Monthly view** | Income vs expense per month in a single chart. |
| **Mobile-ready** | Floating tab bar, bottom-sheet forms, safe-area aware. |

### Self transfer example

ICICI has ₹12,000.00. Add a **Transfer** of ₹2,000 from ICICI to SBI:

```
ICICI Bank   ₹12,000.00 → ₹10,000.00
SBI Bank      ₹5,000.00 →  ₹7,000.00
```

It is stored as a single document, so it can never half-exist.

---

## Quick start

```bash
git clone https://github.com/thenakshprajapat/money_tracker.git
cd money_tracker
npm install
cp .env.example .env.local      # fill in your Firebase values
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Typecheck and production build |
| `npm test` | Unit tests for balances, totals and locking |
| `npm run typecheck` | Strict TypeScript check |

---

## Firebase setup

1. [Firebase console](https://console.firebase.google.com) > **Add project**.
2. **Authentication** > Get started > Sign-in method > **Google** > Enable.
3. **Firestore Database** > Create database (production mode).
4. Project settings > Your apps > **Web** (`</>`) > Register app, then copy the config.
5. Put the values into `.env.local`:

   | Variable | Config key |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

6. **Publish the rules.** This step is required. Without it, the app shows "Firestore refused access".
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules
   ```
   Or paste [`firestore.rules`](firestore.rules) into Firestore > Rules > **Publish**.

---

## Deploy to Vercel

1. Push this repo to GitHub (see the next section).
2. [vercel.com/new](https://vercel.com/new) > import the repo. Vite is auto-detected.
3. **Settings > Environment Variables:** add all six `VITE_FIREBASE_*` values (same as your `.env.local`) for Production, Preview and Development.
4. Deploy.
5. **Authorize the domain:** Firebase > Authentication > Settings > **Authorized domains** > add `your-app.vercel.app`. Google sign-in fails with `auth/unauthorized-domain` until you do.

> Firebase web config values are identifiers, not secrets. Your data is protected by **Authentication and the Firestore rules**, not by hiding the config. Still, keep `.env.local` out of git so keys stay under your control.

---

## Pushing to GitHub safely

- `.env`, `.env.local` and other `.env*.local` files are in `.gitignore`. Only `.env.example` (empty values) is committed.
- Before every push, run `git status` and confirm no `.env.local` appears.
- If a real key was ever committed, rotate it in Google Cloud Console > APIs & Services > Credentials, and restrict it to your domains.
- Use a **restricted** API key (HTTP referrers: `localhost`, your Vercel domain).

---

## How it works

```
users/{uid}/settings/main        { lockDays }
users/{uid}/accounts/{id}        { name, openingPaise, order }
users/{uid}/transactions/{id}    { type, amountPaise, date, accountId, toAccountId,
                                   sourceId, note, createdAt, updatedAt }
```

- Amounts are **integer paise**, so there is no floating-point drift.
- A transfer has `accountId` (from), `toAccountId` (to) and no source.
- **Locking:** editable while `request.time < createdAt + lockDays`. `createdAt` is immutable. Settings are read inside the rules, so a modified client cannot bypass the lock.
- **Offline:** writes apply locally at once. If a rule rejects one on reconnect, an inline banner explains why.

```
src/lib/money.ts       balances, totals, locking, formatting (unit tested)
src/data/              Firestore subscriptions and writes
src/views/             Overview, Transactions, Monthly, Settings
src/components/        Shell, TxDialog, CountUp
firestore.rules        security rules
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Firestore refused access" | Publish `firestore.rules`. Check that `VITE_FIREBASE_PROJECT_ID` matches your project. |
| `auth/unauthorized-domain` | Add your domain under Authentication > Authorized domains. |
| Blank "not configured" message | `.env.local` is missing or empty. Restart `npm run dev` after editing it. |
| Env vars ignored on Vercel | Names must start with `VITE_`. Redeploy after adding them. |

---

<div align="center">Built as a calm side project.</div>
