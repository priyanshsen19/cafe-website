# ALAAP — Coffee Roasters & Kitchen

A production-shaped ordering platform for a fictional premium specialty coffee café with rooms in
Bengaluru, Mumbai and Hyderabad.

An *alaap* is the slow, unmetered opening of a Hindustani raga — the unhurried part before the rhythm
arrives. The brand, the copy and the interface are all built around that idea.

This is not a set of mock screens. Every button in the customer journey talks to a real Express API
backed by PostgreSQL: prices are computed server-side, payment signatures are verified with HMAC,
order state transitions are guarded, and the kitchen board updates customers over WebSockets.

---

## Table of contents

- [What it does](#what-it-does)
- [Screens](#screens)
- [Technology](#technology)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [Razorpay setup](#razorpay-setup)
- [API reference](#api-reference)
- [Real-time events](#real-time-events)
- [Testing](#testing)
- [Security](#security)
- [Design system](#design-system)
- [Deployment](#deployment)
- [Design decisions](#design-decisions)
- [Future improvements](#future-improvements)

---

## What it does

### The customer journey

```
Browse the café  →  Explore the menu  →  Customise a dish  →  Add to cart
      →  Choose delivery / pickup / dine-in  →  Checkout  →  Pay
      →  Order confirmed  →  Live tracking  →  Order history  →  Review  →  Reorder
```

**Ordering**

- 76 dishes across 10 categories, with real photography, allergens, calories and prep times
- Global search across dish names, descriptions, categories, ingredients and tags — with keyboard
  navigation (`↑ ↓ ↵`), recent searches and `⌘K`
- Filtering by dietary flags, badges, price range and rating; six sort orders; a bottom sheet on mobile
- Customisation via reusable modifier groups (size, milk, add-ons, bread, spice…) with live pricing
- Guest carts — browse and build an order before signing in; it merges into your account at login
- Cart drawer, quantity steppers, saved favourites

**Fulfilment** — three genuinely different paths, each with its own rules:

| | Delivery | Pickup | Dine-in |
|---|---|---|---|
| Destination | Saved address | Branch | Table (via QR) |
| Delivery fee | Yes — free over ₹499 | None | None |
| Payment | UPI / Card / Netbanking / **COD** | …/ **Pay at counter** | …/ **Pay at counter** |
| Ends at | `DELIVERED` | `COLLECTED` | `SERVED` |

- Scheduled ordering, gated by each café's real opening hours
- QR table ordering: `/menu?table=<token>` binds the table for the whole visit

**Payments**

- **An online order is not an order until it is paid for.** Card/UPI orders are
  created as `AWAITING_PAYMENT`: held for the customer, but invisible to the kitchen, excluded from
  revenue, and impossible for staff to advance. Only a gateway-verified payment promotes them to
  `PLACED`. Cash orders are unaffected — they settle at handover.
- Card and UPI details are collected by **Razorpay Checkout on Razorpay's own PCI-compliant surface**.
  This application never sees, transmits or stores a card number, CVV or UPI PIN — it only sends
  identity (name, email, phone) to prefill the gateway's form.
- The gateway's cut is **grossed up, not added**. Charging ₹1,000 + 2% leaves the café short,
  because the gateway takes its 2% of the *larger* sum too. The server solves for the charge that
  nets the order value — `charged = net ÷ (1 − rate)` — so the café actually receives what the bill
  says. Cash orders are never charged a fee, and the rate is a settings field (default 2%) the café
  can set to zero to absorb the cost instead.
- **Only the methods the gateway will actually accept are offered.** Availability is a dashboard
  setting on the gateway's side, so the checkout asks rather than assumes, and shows the reason
  beside anything switched off instead of hiding it
- Razorpay integration with **server-side HMAC signature verification**
- A `PAYMENT_MODE=mock` development gateway that exercises the *same* verification path with a real
  signature — it is not a bypass, and the server refuses to boot with it in production
- Idempotent callbacks, failure handling, retry, and a raw-body webhook

**Refunds**

- Cancelling a **paid** order returns the money automatically — the customer never has to ask
- Admins can issue **full or partial** refunds by hand, with a reason shown to the customer
- Each refund is its own record with its own gateway id, status and audit trail (who issued it, why),
  because real refunds are asynchronous and can fail after being accepted
- The refundable ceiling is computed server-side as *captured minus already refunded*, so repeated
  requests, double-clicks or two staff acting at once can never return more than was paid
- Unpaid cash orders correctly refund nothing, and say so

**After the order**

- Confirmation receipt, live tracking timeline over Socket.IO with a polling fallback
- Order history with filters, verified-purchase reviews, and reorder that re-checks availability and
  **current** prices rather than replaying the old bill

### Operations

- **Kitchen Display System** (`/kitchen`) — four columns, large type for a wall-mounted tablet, order
  age, overdue flags, scheduled-order warnings, one-tap state advance, live over WebSockets
- **Admin dashboard** (`/admin`) — revenue and order series, order-type split, popular dishes
- **Menu management** — full CRUD, availability toggles, badges, modifiers, allergens
- **Order management** — search, filter, expand, and move orders through guarded transitions
- **Tables & QR** — create tables individually or as a numbered run, generate printable QR cards
  (SVG for print, PNG to download)
- **Customers** and **Coupons** management

---

## Screens

| Route | Description |
|---|---|
| `/` | Cinematic homepage with parallax hero and editorial sections |
| `/menu`, `/menu/:category` | Menu with filters, sorting and category rail |
| `/menu/:dish` | Full dish page with customisation and reviews |
| `/search` | Search results |
| `/cart`, `/checkout` | Cart and the three-path checkout |
| `/orders/:id/success`, `/orders/:id/tracking` | Receipt and live tracking |
| `/account/*` | Overview, orders, addresses, favourites, profile, security |
| `/locations`, `/about`, `/contact` | Brand pages |
| `/kitchen` | Kitchen Display System (staff + admin) |
| `/admin/*` | Dashboard, orders, menu, tables & QR, customers, coupons (admin) |

> One route deliberately serves two page types: `/menu/:slug` resolves against the cached category
> list, so both `/menu/coffee` and `/menu/truffle-mushroom-pasta` stay clean, readable URLs.

---

## Technology

**Frontend** — React 18, TypeScript, Vite 6, Tailwind CSS 3, shadcn/ui-style components on Radix
primitives, React Router 6, TanStack Query 5, Framer Motion, React Hook Form + Zod, Zustand,
Recharts, Socket.IO client, Lucide, Sonner.

**Backend** — Node.js, Express 4, TypeScript, PostgreSQL 15, Prisma 6, JWT with rotating refresh
tokens, bcrypt, Socket.IO, Razorpay, Zod, Helmet, express-rate-limit, qrcode.

**Testing** — Vitest + Supertest (159 tests).

---

## Architecture

```
cafe-platform/
├── client/                     React SPA (no Next.js — standalone Vite build)
│   └── src/
│       ├── api/                Typed fetch client + endpoint definitions
│       ├── components/         ui/ (primitives) + feature folders
│       ├── contexts/           Auth, dine-in table session
│       ├── hooks/              Cart, wishlist, sockets, payment, utilities
│       ├── layouts/            Site, account, admin chrome
│       ├── pages/              Route components (lazy-loaded)
│       ├── store/              Zustand UI state
│       └── types/              Hand-written API contract
│
├── server/                     Layered Express API
│   ├── src/
│   │   ├── routes/             HTTP surface only
│   │   ├── controllers/        Request/response translation
│   │   ├── services/           Business logic (pricing, orders, payments…)
│   │   ├── repositories/       Prisma queries and shared selects
│   │   ├── middleware/         Auth, validation, rate limiting, errors
│   │   ├── validators/         Zod schemas
│   │   ├── sockets/            Socket.IO rooms and events
│   │   ├── utils/              Tokens, money, order flow, hours
│   │   └── config/             Env validation, Prisma client
│   ├── prisma/                 Schema + seed
│   └── tests/                  Vitest suites
│
├── .env.example
└── README.md
```

**Layering rule:** routes never contain logic, controllers never touch Prisma, services never read
`req`. Business rules live in services so they can be unit tested without HTTP or a database.

The pricing engine (`services/pricing.service.ts`) is deliberately **pure** — it takes plain data and
returns totals, which is why the money rules are the most heavily tested part of the codebase.

---

## Database schema

28 models. Highlights:

**Identity** — `User`, `RefreshToken` (hashed, rotating), `Address`
**Locations** — `Cafe`, `OperatingHour`, `CafeTable` (each with an opaque `qrToken`)
**Catalogue** — `Category`, `Product`, `ProductImage`, `Modifier`, `ModifierOption`, `ProductModifier`
**Shopping** — `Cart`, `CartItem`, `CartItemModifier`, `Wishlist`, `WishlistItem`
**Orders** — `Order`, `OrderItem`, `OrderItemModifier`, `DeliveryAddress`, `Payment`, `Refund`, `OrderStatusHistory`
**Engagement** — `Review`, `Coupon`, `CouponUsage`
**Config** — `Setting` (tax rate, delivery pricing, thresholds, gateway fee rate)

Three decisions worth calling out:

1. **Orders never depend on live product data.** Every `OrderItem` stores name, image and price
   snapshots, and modifiers are snapshotted too. Change a price tomorrow and yesterday's receipt is
   still correct — there's a test for exactly this.
2. **One customisation mechanism, not two.** Sizes are simply a required single-select `Modifier`
   rather than a separate `ProductVariant` table. A second parallel pricing path would be a second
   place for bugs to hide. (This deviates from the original brief, which listed `ProductVariant`.)
3. **`Address` vs `DeliveryAddress`.** The first is the customer's reusable address book; the second
   is an immutable per-order copy of where that order actually went.

Roles are a Prisma `enum` (`CUSTOMER | STAFF | ADMIN`) rather than a table — there is no per-role data
to store, and an enum is enforced by the database.

---

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally

### Setup

```bash
git clone <repository-url> && cd cafe-platform
npm install
```

Create the database:

```bash
createdb alaap
```

Copy the environment template and fill in `DATABASE_URL` plus two secrets:

```bash
cp .env.example server/.env
```

```bash
openssl rand -base64 48   # run twice — JWT_SECRET and JWT_REFRESH_SECRET
```

Create `client/.env`:

```bash
printf 'VITE_API_URL="http://localhost:4000"\n' > client/.env
```

Push the schema and load the demo data:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Run both apps:

```bash
npm run dev
```

- Client — http://localhost:5173
- API — http://localhost:4000

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Client + API together |
| `npm run build` | Production build of both |
| `npm run typecheck` | TypeScript across both workspaces |
| `npm test` | Vitest suite |
| `npm run db:seed` | Reload demo data |
| `npm run db:reset` | Drop, recreate and reseed |
| `npm run db:studio` | Prisma Studio |

The seed is deterministic — it uses a seeded PRNG, so every run produces the same dataset:
**76 dishes · 5 cafés · 84 tables · 109 orders · 33 reviews · 4 coupons**, with 8 live orders sitting
on the kitchen board.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Access-token secret (24+ chars) |
| `JWT_REFRESH_SECRET` | ✅ | Refresh-token secret, different from above |
| `JWT_ACCESS_TTL` | | Access token lifetime (default `15m`) |
| `JWT_REFRESH_TTL_DAYS` | | Refresh token lifetime (default `30`) |
| `NODE_ENV` | | `development` \| `test` \| `production` |
| `PORT` | | API port (default `4000`) |
| `CLIENT_URL` | | Allowed CORS origin |
| `SERVER_URL` | | Public API origin. Compared against `CLIENT_URL` to decide the cookie policy; falls back to `RENDER_EXTERNAL_URL` |
| `PAYMENT_MODE` | | `razorpay` \| `mock` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | when `razorpay` | Gateway credentials |
| `RAZORPAY_WEBHOOK_SECRET` | | Webhook signature secret |
| `ALLOW_MOCK_PAYMENTS` | | Escape hatch to permit `PAYMENT_MODE=mock` in production. Absent by default, and deliberately so |
| `SEED_ON_EMPTY` | | Load the demo menu on boot, but only if the database has no products at all |
| `VITE_API_URL` | ✅ (client) | API base URL |

Environment is validated with Zod at boot — a misconfigured deployment fails loudly on startup
rather than at the first request that needs a secret.

---

## Demo accounts

Seeded for demonstration only.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo-cafe.com` | `AdminDemo123!` |
| Kitchen staff | `kitchen@demo-cafe.com` | `KitchenDemo123!` |
| Customer | `demo@demo-cafe.com` | `DemoCustomer123!` |

The sign-in page lists these and fills the form on tap. Seven more customers exist with order history
(all using `DemoCustomer123!`).

**Try this:** sign in as the customer in one browser and as kitchen staff in another. Move an order on
the kitchen board and watch the customer's tracking page update without a refresh.

---

## Razorpay setup

The default `PAYMENT_MODE=mock` needs no credentials. It opens a labelled development sheet, and the
server signs the attempt with a real HMAC that goes through the same `/payments/verify` endpoint a
live callback would. "Simulate a failed payment" sends a deliberately invalid signature so the
rejection path is exercised too.

For the real gateway:

1. Create a Razorpay account and copy the **test** key id and secret
2. Set `PAYMENT_MODE=razorpay` and both keys in `server/.env`
3. Restart the API

Razorpay's test instruments, entered in Checkout's own form:

| Method | Value |
|---|---|
| Card | `5267 3181 8797 5449`, any future expiry, any CVV |
| UPI (success) | `success@razorpay` |
| UPI (failure) | `failure@razorpay` |
| Net banking | any bank, then choose success or failure |

Razorpay's widely quoted `4111 1111 1111 1111` is an **international** test card, and accounts
without international payments enabled reject it outright. The domestic card above works everywhere.

The test-mode OTP screen has no fixed code: **any 4–10 digit number succeeds** (`123456` is as good
as any), and **fewer than 4 digits fails** — which is the documented way to exercise the failure
path without hunting for a special card.

### Methods are discovered, not assumed

Which methods an account accepts is a dashboard setting, not an integration detail — a test account
commonly ships with UPI switched off. Offering it anyway would drop the customer into a modal that
cannot complete, so `GET /api/payments/methods` asks the gateway (the same `preferences` endpoint
Checkout.js reads) and the checkout greys out anything unavailable, explaining why. The answer is
cached for five minutes, so enabling UPI in the dashboard takes effect on its own — no redeploy.

Turn UPI on under **Razorpay Dashboard → Test Mode → Settings → Configuration → Payment Methods**.

### Why card details aren't collected by this app

Capturing a raw card number yourself requires Razorpay's S2S/Custom Checkout product, which is gated
behind PCI-DSS certification and manual approval — and it pulls the whole application into PCI-DSS
SAQ-D scope. Checkout's hosted sheet gives the customer a real card and UPI form without any of that,
which is why the integration is built this way. If a fully custom-branded form is ever genuinely
needed, S2S is the documented upgrade path and requires certification first.

To verify webhooks locally, expose the API (`ngrok http 4000`), point a Razorpay webhook at
`/api/payments/webhook` for `payment.captured` and `payment.failed`, and set
`RAZORPAY_WEBHOOK_SECRET`.

> Mock mode **cannot** run in production — the server exits at startup if `NODE_ENV=production` and
> `PAYMENT_MODE=mock`, and refuses to start in `razorpay` mode without keys.

---

## API reference

All responses are JSON. Errors are `{ "error": { "message", "code", "details?" } }` with
customer-safe messages — stack traces and database errors never reach the client.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/refresh` | Rotate the refresh token |
| `POST` | `/api/auth/logout` | Revoke the session |
| `GET` | `/api/auth/me` | Current user + stats |
| `PATCH` | `/api/auth/me` | Update profile |
| `POST` | `/api/auth/change-password` | Change password (revokes other sessions) |

### Catalogue

| Method | Endpoint |
|---|---|
| `GET` | `/api/products` — filters, sorting, pagination |
| `GET` | `/api/products/search?q=` |
| `GET` | `/api/products/:slug` |
| `GET` | `/api/categories`, `/api/collections` |
| `GET` | `/api/reviews/:productId` |

### Cart · Orders · Payments

| Method | Endpoint |
|---|---|
| `GET` `POST` `PATCH` `DELETE` | `/api/cart`, `/api/cart/items`, `/api/cart/items/:id` |
| `POST` `GET` | `/api/orders`, `/api/orders/:id` |
| `GET` | `/api/orders/:id/tracking` |
| `PATCH` | `/api/orders/:id/cancel` |
| `POST` | `/api/orders/:id/reorder` |
| `POST` | `/api/payments/create-order`, `/verify`, `/failed`, `/retry`, `/webhook` |
| `GET` | `/api/payments/methods` — online methods the gateway currently accepts |
| `GET` | `/api/admin/orders/:id/refundable` — what can still be returned |
| `POST` | `/api/admin/orders/:id/refund` — full or partial refund (admin only) |

### Account · Public · Admin

| Method | Endpoint |
|---|---|
| `GET` `POST` `PATCH` `DELETE` | `/api/account/addresses`, `/api/account/wishlist` |
| `GET` | `/api/account/wishlist/ids` — ids only, so menu cards render cheaply |
| `POST` `GET` | `/api/account/reviews`, `/api/account/reviews/pending` |
| `GET` | `/api/cafes`, `/api/tables/:token`, `/api/service-status`, `/api/settings`, `/api/coupons` |
| `POST` | `/api/contact`, `/api/coupons/preview` |
| `GET` | `/api/admin/dashboard`, `/api/admin/kitchen/board`, `/api/admin/orders` |
| `PATCH` | `/api/admin/orders/:id/status` |
| `GET` `POST` `PATCH` `DELETE` | `/api/admin/products`, `/api/admin/tables`, `/api/admin/coupons` |
| `POST` | `/api/admin/tables/generate` — bulk-create tables with QR tokens |
| `GET` | `/api/admin/tables/:id/qr`, `/api/admin/customers` |

---

## Real-time events

Socket.IO with room-scoped authorisation. Customers may only subscribe to orders they own — the
server verifies ownership against the database rather than trusting the client.

**Rooms:** `order:{orderId}` · `user:{userId}` · `kitchen` (staff) · `admin`

**Events:** `order:created` · `order:accepted` · `order:preparing` · `order:ready` ·
`order:out_for_delivery` · `order:delivered` · `order:completed` · `order:cancelled` · `order:updated`

Tracking pages also poll every 20 seconds while an order is live, so the experience degrades
gracefully where WebSockets are blocked. The UI states which mode it is in rather than pretending.

---

## Testing

```bash
npm test
```

**159 tests, all passing** — against a dedicated `alaap_test` database so development data is never
touched.

```bash
createdb alaap_test
cd server && DATABASE_URL="postgresql://USER@localhost:5432/alaap_test" npx prisma db push
```

| Suite | Covers |
|---|---|
| `pricing.test.ts` | Modifier maths, coupons (percentage, cap, fixed), tax, delivery thresholds, totals |
| `orderFlow.test.ts` | Transition guards per order type, cancellation windows, opening hours incl. past-midnight |
| `auth.test.ts` | Registration, hashing, login, refresh rotation, logout, route protection |
| `cart.test.ts` | Server-side pricing, required modifiers, availability, merging, ownership, guest merge |
| `orders.test.ts` | All three order types, price snapshots, stock revalidation, coupons, lifecycle, reorder, authorisation |
| `payments.test.ts` | Signature verification, forged/replayed signatures, idempotency, failure, retry, gateway method discovery |
| `paymentGating.test.ts` | That an unpaid online order reaches no kitchen, no revenue figure and no staff action until the gateway confirms |
| `refunds.test.ts` | Full/partial refunds, over-refund and double-refund guards, automatic refund on cancellation, unpaid orders, authorisation |

These are not decorative. Writing them surfaced six real bugs that were fixed rather than
accommodated:

1. An empty delivery cart still charged the ₹49 delivery fee, so the cart displayed a ₹49 total for nothing.
2. Two sign-ins within the same second produced byte-identical refresh JWTs (`iat` has second
   resolution) and collided on the unique index — a double-click broke login. Fixed with a random `jti`.
3. A cart containing only sold-out dishes reported "your cart is empty" instead of naming the dish.
4. React StrictMode double-mounted the session restore, and because refresh tokens rotate, the second
   call consumed a spent token and dropped the user to a guest on every reload.
5. The cart was cached before the session restored, so a signed-in customer saw an empty cart after a
   refresh. Fixed by scoping the query key to the user.

6. Issuing a refund overwrote the payment's `SUCCESS` status, which broke every *subsequent* partial
   refund — the "find the captured payment" lookup could no longer find it. Five refund tests failed
   at once and named the cause.

A seventh was found by inspecting the running page rather than by a test: eleven Tailwind opacity
classes used off-scale values (`bg-cream/88`), which silently generate **no CSS** — the sticky header
had no background.

---

## Security

- **Passwords** — bcrypt, cost 12; never selected into any response
- **Sessions** — short-lived access tokens in memory; rotating refresh tokens in an `httpOnly`
  cookie, stored hashed so a database dump yields no usable sessions
- **Authorisation** — role middleware on every staff route; ownership checks on carts, orders,
  addresses and payments. Another customer's order returns **404, not 403**, so an outsider cannot
  even confirm it exists
- **Money** — prices, discounts, tax and delivery are computed server-side from database values. The
  client sends *choices* (ids, quantities, a coupon code), never amounts
- **Payments** — HMAC verified with a constant-time compare; idempotent callbacks; webhook verified
  against the raw request body
- **Validation** — every request body, query and param parsed with Zod; parsed output replaces the
  raw input so controllers only see trusted shapes
- **Availability** — revalidated at checkout, not just when adding to the cart
- **Rate limiting** — tight on credentials, moderate on writes, broad on the rest
- **Errors** — unknown faults become a generic message; internals are logged server-side only
- **Injection** — all access goes through Prisma's parameterised queries
- **Never stored** — card numbers, CVVs, UPI PINs

---

## Design system

A restrained palette lets the photography carry the colour:

| Token | Value | Use |
|---|---|---|
| Cream | `hsl(39 41% 96%)` | Page ground |
| Paper | `hsl(38 38% 93%)` | Alternating sections |
| Sand | `hsl(36 30% 86%)` | Borders |
| Espresso | `hsl(18 23% 13%)` | Text, primary buttons |
| Charcoal | `hsl(24 18% 9%)` | Footer, overlays |
| Olive | `hsl(79 14% 39%)` | Vegetarian, success |
| Terracotta | `hsl(18 59% 45%)` | The single accent |

**Type** — Fraunces (variable serif) for display, Inter for interface. Fraunces is held at low
`WONK`/`SOFT` so it reads editorial rather than novelty.

**Motion** — one easing curve (`cubic-bezier(0.22, 1, 0.36, 1)`), short distances, `prefers-reduced-motion`
honoured throughout including Framer Motion.

**Accessibility** — semantic landmarks, a skip link, visible focus rings on one consistent treatment,
labelled controls, `aria-live` on totals and result counts, Radix primitives for focus trapping in
dialogs and sheets, and a keyboard-navigable search.

All 76 dish images were verified to resolve before being committed, so the seeded menu never renders
a broken image.

---

## Deployment

The repository ships a [`render.yaml`](render.yaml) blueprint that provisions all three pieces —
Postgres, the API, and the static site — in one go.

### Render (blueprint)

1. Push this repository to GitHub.
2. Render → **New → Blueprint** → select the repository.
3. Apply. Render creates `alaap-db`, `alaap-api` and `alaap-web`, generates the JWT secrets itself,
   runs `prisma migrate deploy`, and seeds the demo catalogue on the empty database.

**One manual step.** The API needs the site's URL and the site needs the API's URL — that's circular,
so the blueprint hard-codes `CLIENT_URL: https://alaap-web.onrender.com`. If Render assigns the
static site a different hostname (because the name was taken), update `CLIENT_URL` on `alaap-api`.
Until it matches, sign-in fails with a CORS error.

**Free tier caveats.** Free web services sleep after ~15 minutes idle, so the first visit takes
~30 seconds to wake. Free Postgres instances expire — check Render's current retention before
relying on the demo data.

### What the deployment does differently

| Concern | Local | Deployed |
|---|---|---|
| Schema | `prisma db push` | `prisma migrate deploy` (migration in `server/prisma/migrations`) |
| Refresh cookie | `SameSite=Lax` | `SameSite=None; Secure; Partitioned` — see below |
| Payments | `razorpay` (test keys) | `razorpay` (test keys, set in the host's dashboard) |
| Seed | manual | once, only if the database has no products |

**The cookie policy is derived from the deployment shape.** A static host and a service host are
different sites, and browsers never send a `SameSite=Lax` cookie on a cross-site XHR — so a
split-domain deploy would have a sign-in that appears to work and then evaporates on reload.
`server/src/config/cookies.ts` compares `CLIENT_URL` against `SERVER_URL` and switches to
`SameSite=None; Secure` when they differ in production, keeping the stricter `Lax` locally.

**Payments in the demo.** The deployed API runs `PAYMENT_MODE=razorpay` against Razorpay's *test*
keys: a real gateway, real signature verification, real refunds — settled against test credentials
rather than money. `render.yaml` marks both keys `sync: false`, so the host prompts for them once
and never keeps them in git.

`ALLOW_MOCK_PAYMENTS` is deliberately absent. Without it the server refuses to boot with
`PAYMENT_MODE=mock` under `NODE_ENV=production`, so a misconfigured deploy fails loudly instead of
quietly accepting fake money. Going live is then a credential change, not a code change: swap the
test key pair for the live one.

### Deploying elsewhere

```bash
npm ci --include=dev          # devDeps are needed to build (Prisma CLI, tsc)
npm run build:server && npm run start:prod
npm run build:client          # → client/dist, needs VITE_API_URL at build time
```

Serve `client/dist` from any static host with SPA rewrites to `index.html`. Behind a proxy,
`trust proxy` is already enabled so rate limiting sees real client IPs.

---

## Design decisions

**Why the client never computes money.** The cart is re-priced from live product data on every read,
so a menu change is reflected immediately and a stale tab cannot pin an old price. The client's
arithmetic in the customisation modal is a preview only.

**Why mock payments still verify.** A mock that skips verification tests nothing. This one issues a
real HMAC and pushes it through the production code path, so the development flow exercises the same
logic that protects real money.

**Why reorder re-prices.** Replaying an old bill would either undercharge the café or surprise the
customer. Reorder checks availability, rebuilds at current prices, and reports what changed.

**Why a 404 for someone else's order.** A 403 confirms the resource exists. A 404 tells an outsider
nothing.

**Why a captured payment is never mutated.** When a refund is issued, the `Payment` row keeps its
`SUCCESS` status — the capture genuinely happened, and that is how later refunds locate the money to
return. Refund state lives on the order and in `Refund` rows instead. An earlier version overwrote
the payment status and quietly broke every *subsequent* partial refund, because the "find the
captured payment" lookup could no longer find it.

**Why guest carts exist.** Dine-in customers scan a QR at the table and want to start immediately.
Forcing a sign-up before they can look at a cart is the wrong first impression, so guests build a
cart against a cookie-scoped session that merges into their account at login.

---

## Future improvements

- Live delivery-rider tracking on a map
- Loyalty programme and stored-value wallet
- Inventory depletion so dishes sell out automatically
- Multi-language (Hindi, Kannada, Marathi) and full RTL support
- Push notifications for order milestones
- Playwright end-to-end coverage of the browser journey
- Image pipeline (S3 + CDN + AVIF) instead of external URLs
- Admin role management and audit log
- Kitchen analytics: prep-time distributions, bottleneck detection

---

## Notes

ALAAP is a fictional brand created for this project. The name, copy, menu, pricing and addresses are
original; the addresses are illustrative rather than real premises. Photography is from Unsplash under
its licence. The payment integration runs in test mode.
