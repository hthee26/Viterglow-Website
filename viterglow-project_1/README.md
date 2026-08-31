# Viterglow — storefront + Xendit checkout

## What's in here

```
public/
  index.html          the storefront (what customers see)
  order-success.html  shown after a successful payment
  order-failed.html   shown if payment doesn't complete
api/
  create-invoice.js   creates a Xendit payment link when a customer checks out
  xendit-webhook.js   receives Xendit's "payment confirmed" notification
.env.example           template for the secret keys (see below)
```

No build step, no framework, no dependencies to install. This deploys to Vercel as-is.

## Why a backend at all?

Your Xendit **secret key** has to make the API call that creates a payment link.
That key can never sit in `index.html` — anyone who opens the browser's dev
tools would see it and could create charges under your account. The two files
in `/api` exist solely to keep that key on a server instead of in the browser.

## Setup, in order

### 1. Get your Xendit test keys (you can do this before verification finishes)
1. Sign up at dashboard.xendit.co
2. Go to **Settings → API Keys** — copy the **Test** secret key (starts with `xnd_development_`)
3. Go to **Settings → Webhooks** — copy the **Verification Token**

You can build and test everything below with test keys. Live payments only
require the live key once your business verification clears — you'll swap
one line in Vercel's dashboard when that happens, nothing else changes.

### 2. Deploy to Vercel
1. Create a free account at vercel.com (sign in with GitHub is easiest)
2. Push this folder to a new GitHub repository
3. In Vercel: **Add New → Project → Import** your repository
4. Vercel will detect the `/api` folder automatically — no configuration needed
5. Before your first deploy, add the environment variables (next step)

### 3. Add environment variables in Vercel
Project → Settings → Environment Variables. Add each one from `.env.example`:

| Key | Value |
|---|---|
| `XENDIT_SECRET_KEY` | your test secret key from step 1 |
| `XENDIT_CALLBACK_TOKEN` | your verification token from step 1 |
| `SITE_URL` | your Vercel URL for now, e.g. `https://viterglow.vercel.app` |
| `ORDER_WEBHOOK_URL` | leave blank for now — see ORDER_STORAGE.md |

Redeploy after adding these (Vercel will prompt you, or push any small change).

### 4. Tell Xendit where your webhook lives
Xendit dashboard → **Settings → Webhooks → Invoice Paid** →
paste in `https://your-vercel-url.vercel.app/api/xendit-webhook`

This is how you find out a payment actually happened — the customer's
browser redirecting to `/order-success.html` is not proof of payment by
itself, only the webhook is.

### 5. Test it end to end
1. Visit your deployed site, add a box to cart, go to checkout
2. Fill in the form, choose "Bank transfer" (not Cash on delivery), place order
3. You'll land on Xendit's hosted payment page — Xendit's test mode gives you
   fake payment methods that simulate success without moving real money
4. Confirm the "paid" event using Xendit's test payment shortcut
5. Check Vercel → your project → **Logs** — you should see `PAID: {...}`
   printed from the webhook

### 6. Go live
1. Once Xendit approves your business, copy your **Live** secret key
2. In Vercel, update `XENDIT_SECRET_KEY` to the live key
3. Update `SITE_URL` to your real domain once it's connected (see below)
4. Redeploy

## Connecting your domain
Once you've bought a domain: Vercel project → **Settings → Domains** →
add your domain → Vercel shows you exactly which DNS record to add at your
registrar (usually one A record or CNAME). Takes a few minutes to a few
hours to propagate.

## Before you go live

1. **Set CONTACT in public/index.html** — the `CONTACT` object at the top of the script
   block. Fill in `whatsapp` (country code, digits only, e.g. `6281234567890`).
   Until you do, all contact links stay hidden rather than showing dead links.
2. **Set your real Xendit key in Vercel.** If the `.env.example` placeholder is
   deployed by mistake, checkout now fails with a clear message and points the
   customer at WhatsApp instead of throwing a cryptic error.
3. **Reviews:** the fabricated testimonials have been removed and replaced with a
   verifiable-credentials section. Add real reviews only once you have real customers.

## What still needs a decision from you
- **Order records**: right now, paid orders only appear in Vercel's logs,
  which isn't a real system of record. See `ORDER_STORAGE.md` for a
  five-minute fix using a Google Sheet.
- **Cash on delivery**: this bypasses Xendit entirely and goes straight to
  the "order confirmed" screen with no payment collected — that's
  intentional, since Xendit doesn't handle COD, but it means COD orders
  currently have *no* record anywhere except what the customer typed in.
  Worth connecting this to the same order log once you set it up.
