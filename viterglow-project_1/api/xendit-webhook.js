// api/xendit-webhook.js
//
// Xendit calls THIS endpoint (not your browser) the moment a customer
// actually pays. You'll paste this function's URL into your Xendit
// dashboard under Settings -> Webhooks -> Invoice Paid.
//
// Whatever you plug in under "forward the confirmed order" below is what
// notifies you that money has landed — right now it just logs, which is
// enough to get started but means you must check Vercel's logs to see
// orders. See ORDER_STORAGE.md for a five-minute upgrade to a Google Sheet.

const XENDIT_CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // Xendit signs callbacks with a token you set in their dashboard.
  // Reject anything that doesn't match it — otherwise anyone could POST
  // a fake "paid" event at this URL.
  const incomingToken = req.headers['x-callback-token'];
  if (!XENDIT_CALLBACK_TOKEN || incomingToken !== XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ error: 'Invalid callback token' });
  }

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (event.status === 'PAID' || event.status === 'SETTLED') {
      const order = {
        externalId: event.external_id,
        amount: event.amount,
        payerEmail: event.payer_email,
        paidAt: event.paid_at || new Date().toISOString(),
        method: event.payment_method || event.payment_channel || 'unknown'
      };

      console.log('PAID:', order);

      // --- forward the confirmed order somewhere you'll actually see it ---
      // Simplest option: a Google Apps Script "web app" URL that appends a
      // row to a Sheet. Set ORDER_WEBHOOK_URL in your environment variables
      // and uncomment this block. See ORDER_STORAGE.md for the 5-minute setup.
      //
      // if (process.env.ORDER_WEBHOOK_URL) {
      //   await fetch(process.env.ORDER_WEBHOOK_URL, {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(order)
      //   });
      // }
    } else {
      console.log('Webhook received, status:', event.status, event.external_id);
    }

    // Xendit just needs a 200 to know you received it
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
};
