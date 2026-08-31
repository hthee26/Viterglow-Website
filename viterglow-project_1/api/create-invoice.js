// api/create-invoice.js
//
// Called by the checkout page when the customer clicks "Place order".
// It talks to Xendit's server-side API using your SECRET key, which is why
// this has to run on a server instead of in the browser — a secret key in
// front-end JS would be visible to anyone who opens dev tools.
//
// Deploy target: Vercel serverless function (Node.js runtime).

const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

// Keep the real prices here, not in the browser, so nobody can tamper with
// the total by editing the page before it reaches you.
const PRICE_PER_BOX = 300000; // Rp
const SHIP = 25000;
const FREE_SHIP_FROM = 550000; // two discounted boxes (Rp570.000) still qualify

// Volume discount. This table MUST stay identical to the DISCOUNTS object
// in public/index.html — if they drift apart, the customer sees one price
// and gets charged another.
const DISCOUNTS = { 1: 0, 2: 0.05, 3: 0.10, 4: 0.15, 5: 0.18, 6: 0.20 };
const MAX_TIER = 6;

function unitPrice(qty) {
  const tier = Math.min(Math.max(qty, 1), MAX_TIER);
  const off = DISCOUNTS[tier] || 0;
  return Math.round((PRICE_PER_BOX * (1 - off)) / 1000) * 1000;
}

module.exports = async (req, res) => {
  // Basic CORS + method guard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!XENDIT_SECRET_KEY) {
    console.error('CONFIG ERROR: XENDIT_SECRET_KEY is not set in environment variables.');
    return res.status(500).json({ error: 'PAYMENT_NOT_CONFIGURED' });
  }

  // Catch the .env.example placeholder being deployed by mistake - without this
  // the customer gets a confusing failure at the last step of checkout.
  if (XENDIT_SECRET_KEY.includes('xxxxx') || XENDIT_SECRET_KEY.includes('paste')) {
    console.error('CONFIG ERROR: XENDIT_SECRET_KEY is still the placeholder from .env.example. ' +
                  'Set your real key in Vercel -> Settings -> Environment Variables.');
    return res.status(500).json({ error: 'PAYMENT_NOT_CONFIGURED' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { qty, customer } = body || {};

    // --- validate everything server-side; never trust numbers from the client ---
    const boxes = Number.parseInt(qty, 10);
    if (!Number.isInteger(boxes) || boxes < 1 || boxes > 50) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
    if (!customer || !customer.name || !customer.email || !customer.phone || !customer.address) {
      return res.status(400).json({ error: 'Missing customer details' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const unit = unitPrice(boxes);
    const subtotal = boxes * unit;
    const shipping = subtotal >= FREE_SHIP_FROM ? 0 : SHIP;
    const amount = subtotal + shipping;

    const externalId = 'VG-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const invoiceRes = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Xendit auth: HTTP Basic, secret key as username, blank password
        Authorization: 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64')
      },
      body: JSON.stringify({
        external_id: externalId,
        amount,
        currency: 'IDR',
        payer_email: customer.email,
        description: `Viterglow — ${boxes} box${boxes > 1 ? 'es' : ''} (${boxes * 30} capsules)`,
        customer: {
          given_names: customer.name,
          email: customer.email,
          mobile_number: customer.phone,
          addresses: [{ city: customer.city, country: 'Indonesia', postal_code: customer.zip, street_line1: customer.address }]
        },
        success_redirect_url: `${SITE_URL}/order-success.html?order=${externalId}`,
        failure_redirect_url: `${SITE_URL}/order-failed.html?order=${externalId}`,
        items: [{ name: 'Viterglow (30 capsules)', quantity: boxes, price: unit, category: 'Health supplement' }]
      })
    });

    const invoice = await invoiceRes.json();

    if (!invoiceRes.ok) {
      console.error('Xendit error:', invoice);
      return res.status(502).json({ error: 'Payment provider error', detail: invoice });
    }

    // TODO: write { externalId, boxes, amount, customer, status:'pending' } to your
    // own order log here (see ORDER_STORAGE.md) so you have a record even before
    // the webhook confirms payment.

    return res.status(200).json({ invoice_url: invoice.invoice_url, external_id: externalId, amount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
};
