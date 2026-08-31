# Getting orders into a Google Sheet (optional, ~5 minutes)

Right now, a paid order only shows up in Vercel's function logs — fine for
testing, not something you'd want to run a business on. The fastest fix that
needs no database and no extra hosting is a Google Apps Script "web app" that
appends a row to a Sheet every time your webhook receives a paid order.

## Steps

1. Create a new Google Sheet. Add a header row:
   `Order ID | Amount | Email | Paid At | Method`

2. In the Sheet, go to **Extensions → Apps Script**. Replace the default code with:

   ```javascript
   function doPost(e) {
     const data = JSON.parse(e.postData.contents);
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     sheet.appendRow([
       data.externalId, data.amount, data.payerEmail, data.paidAt, data.method
     ]);
     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

3. Click **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy, authorize it, then copy the web app URL it gives you
     (ends in `/exec`)

4. In Vercel, set the environment variable `ORDER_WEBHOOK_URL` to that URL.

5. In `api/xendit-webhook.js`, uncomment the `fetch(process.env.ORDER_WEBHOOK_URL, ...)`
   block (it's already written, just commented out).

6. Redeploy. Paid orders will now append as rows in your Sheet in real time.

## When you outgrow this

A Sheet is fine for tens of orders a day. If you're doing real volume later,
the natural upgrade is a proper database (Vercel Postgres or Supabase both
have generous free tiers) — but there's no reason to build that before you
need it.
