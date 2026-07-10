# Razorpay Payment Gateway — Future Implementation

## Overview

When budget allows, switch from SuperProfile to Razorpay Payment Gateway for the registration flow. This enables payment verification on the thank-you page so only confirmed payers get access to the WhatsApp group.

---

## Flow

```
Landing Page (CTA) → Razorpay Payment Page → Thank-You Page (gated)
```

1. User clicks "Register Now" → opens Razorpay Payment Link
2. Razorpay collects: Name, Email, Phone, Payment
3. On successful payment → Razorpay redirects to `thank-you.html?status=success`
4. Thank-you page verifies `?status=success` param → shows WhatsApp redirect
5. If someone visits `thank-you.html` directly (no param) → shows "Payment Not Found" message

---

## Razorpay Setup

### 1. Create Payment Link

- Go to: Razorpay Dashboard → Payment Links → Create
- Amount: ₹455
- Collect: Name, Email, Phone (mandatory)
- Redirect after payment: `https://ravi0818k-ui.github.io/SLA-Online/thank-you.html?status=success`

### 2. Update data.json

Replace the SuperProfile link with your Razorpay payment link:

```json
"registration": {
    "link": "https://pages.razorpay.com/pl_XXXXX/view"
}
```

---

## Payment Verification (JS Code to Re-enable)

Add this back to `script.js` inside `initThankYouPage()`:

```javascript
function verifyPaymentStatus() {
    var params = new URLSearchParams(window.location.search);

    // Check common payment success params
    if (params.get('status') === 'success') return true;
    if (params.get('paid') === 'true') return true;
    if (params.get('payment_status') === 'paid') return true;
    if (params.get('payment_status') === 'success') return true;

    // Razorpay may append order/transaction params
    if (params.has('razorpay_payment_id')) return true;
    if (params.has('razorpay_order_id')) return true;

    // Check if referrer is from Razorpay
    var referrer = document.referrer || '';
    if (referrer.indexOf('razorpay.com') !== -1) return true;
    if (referrer.indexOf('pages.razorpay.com') !== -1) return true;

    // If URL has ANY query params, likely came from payment redirect
    if (window.location.search && window.location.search.length > 1) return true;

    return false;
}
```

Then in `initThankYouPage()`, gate the views:

```javascript
var isPaid = verifyPaymentStatus();

if (isPaid) {
    // Show paid view with WhatsApp redirect
    document.getElementById('thankyou-paid').style.display = '';
    document.getElementById('thankyou-unpaid').style.display = 'none';
    // ... start redirect progress
} else {
    // Show unpaid view
    document.getElementById('thankyou-paid').style.display = 'none';
    document.getElementById('thankyou-unpaid').style.display = '';
}
```

---

## Webhook for Auto-Adding to WhatsApp (Advanced)

### Free approach: Razorpay → Google Sheets

1. Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: Google Apps Script web app URL
3. Event: `payment.captured`
4. Google Apps Script logs: Name, Phone, Email, Amount, Date to a Google Sheet
5. You manually add verified numbers to WhatsApp group

### Google Apps Script Template:

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var payload = data.payload.payment.entity;

  var sheet = SpreadsheetApp.openById('YOUR_SHEET_ID').getActiveSheet();
  sheet.appendRow([
    new Date(),
    payload.contact,
    payload.email,
    payload.amount / 100,
    payload.status,
    payload.id
  ]);

  // Optional: Send yourself an email notification
  MailApp.sendEmail('superlearneracademy@gmail.com',
    'New SLA Registration!',
    'Name: ' + payload.notes.name + '\nPhone: ' + payload.contact + '\nAmount: ₹' + (payload.amount/100)
  );

  return ContentService.createTextOutput('OK');
}
```

---

## Razorpay Payment Page Description

Use this text for your Razorpay payment page:

**Title:** Super Learner Academy - 3 Day LIVE Webinar

**Description:**

Become a Super Learner in Just 3 Days!

Join Abhishek Ranjan for an exclusive 3-Day LIVE Interactive Webinar.

Day 1 — Memory & Learning Mastery
- Memory improvement techniques
- Identify your learning style
- Mental exercises

Day 2 — Focus & Performance
- Strategies to increase focus
- Breathing exercises for mental clarity
- Daily practice routine

Day 3 — Discovery & Rewards
- Survey — Identify your spirit
- Get completion certificate
- Exclusive bonus content

What's Included:
- 3 Days LIVE Interactive Sessions
- Worksheets & Materials
- WhatsApp Community Access
- Doubt Clearing Session
- Completion Certificate

Contact Us:
superlearneracademy@gmail.com
9151726759

---

## Terms & Conditions (for Razorpay page)

You agree to share information entered on this page with Super Learner Academy (owner of this page) and Razorpay, adhering to applicable laws. Workshop details including date, time, and joining link will be shared on the registered phone number via WhatsApp.

---

## Checklist Before Going Live

- [ ] Create Razorpay Payment Link with correct amount (₹455)
- [ ] Set redirect URL to: `https://ravi0818k-ui.github.io/SLA-Online/thank-you.html?status=success`
- [ ] Update `data.json` registration link to Razorpay URL
- [ ] Re-enable `verifyPaymentStatus()` in script.js
- [ ] Set up webhook → Google Sheets (optional)
- [ ] Test full flow: Pay → Redirect → WhatsApp
- [ ] Bump version numbers in HTML files
