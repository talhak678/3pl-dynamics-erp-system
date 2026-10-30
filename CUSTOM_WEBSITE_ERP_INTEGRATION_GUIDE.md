# Custom Website ERP Integration Guide (3pldynamicsai.com)

This guide provides instructions and ready-to-use code examples for connecting the custom contact form on **`3pldynamicsai.com`** directly to the **3PL Dynamics ERP & CRM** system.

---

## 1. Architecture & Ingestion Flow

```
[ Visitor on 3pldynamicsai.com ]
             │
             ▼ Submits Contact Form
[ 3pldynamicsai.com Backend / Server Action ]
             │
             │ 1. Signs payload: HMAC-SHA256(`${timestamp}.${JSON.stringify(payload)}`)
             │ 2. Sets headers: X-ERP-Event, X-ERP-Timestamp, X-ERP-Signature
             ▼ POST /api/ecommerce/webhook/:storeId
[ 3PL Dynamics ERP Webhook Endpoint ]
             │
             │ 1. Validates Store ID & Tenant ownership
             │ 2. Verifies HMAC-SHA256 signature & replay window (< 300s)
             │ 3. Automatically saves to `CustomerSync` collection
             ▼
[ ERP Admin Dashboard ]
  - Visible under: Website Management & E-Commerce -> "Contacts & Web Leads"
  - 1-Click Action: "Promote to CRM Lead" or "Link to Client"
```

---

## 2. Prerequisites & Credentials

1. Log into your ERP Admin Dashboard as a workspace administrator.
2. Navigate to **Website Management** (`/website-management`).
3. Click **Connect Website / Store** and create a connection entry:
   - **Store / Platform Name**: `3PL Dynamics Official Website`
   - **Platform**: `Custom API` (or `Other`)
   - **Store URL**: `https://3pldynamicsai.com`
   - **Webhook Secret**: Generate a strong secret (e.g. `whsec_9f8a3c2b1e4d5a6b7c8d9e0f1a2b3c4d`) or use the auto-generated one.
4. Copy the generated **Store ID** (MongoDB ObjectId, e.g. `663e80ab4d1234567890abcd`) and the **Webhook Secret**.
5. Add these credentials to the `.env.local` or environment variables of `3pldynamicsai.com`:
   ```bash
   ERP_BASE_URL=https://app.3pldynamicsai.com
   ERP_STORE_ID=663e80ab4d1234567890abcd
   ERP_WEBHOOK_SECRET=whsec_9f8a3c2b1e4d5a6b7c8d9e0f1a2b3c4d
   ```

---

## 3. Webhook Endpoint Specifications

- **URL**: `POST https://<erp-domain>/api/ecommerce/webhook/:storeId`
- **Method**: `POST`
- **Path Parameter**: `:storeId` = The WebsiteConfig ObjectId from step 2.

### Required HTTP Headers

| Header | Value | Description |
|---|---|---|
| `Content-Type` | `application/json` | JSON format |
| `X-ERP-Event` | `lead.submitted` | Identifies this event as a contact/lead submission |
| `X-ERP-Timestamp` | `<unix_timestamp_seconds>` | Current UTC timestamp in seconds (e.g., `1772384910`) |
| `X-ERP-Signature` | `<hex_digest>` | HMAC-SHA256 signature of `${timestamp}.${rawJsonBody}` |

> **Security Note:** The ERP verifies that `Math.abs(now - timestamp) <= 300` seconds to prevent replay attacks. Always sign in your server environment (never in client-side browser JavaScript where the secret would be exposed).

---

## 4. JSON Payload Structure

```json
{
  "name": "Alexander Hayes",
  "email": "alex.hayes@apexlogistics.com",
  "phone": "+1 (312) 555-0199",
  "company": "Apex Freight Logistics",
  "city": "Chicago",
  "country": "United States",
  "message": "We need automated freight quote management and warehouse inventory sync.",
  "sourceType": "saas_contact_form",
  "externalCustomerId": "WEB-LEAD-2026-1049"
}
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | String | Yes | Full name of the prospect |
| `email` | String | Yes | Email address of the prospect |
| `phone` | String | No | Contact phone number |
| `company` | String | No | Company or organization name |
| `city` | String | No | City |
| `country` | String | No | Country |
| `message` | String | No | Prospect's inquiry, question, or quote request |
| `sourceType` | String | No | Default: `"saas_contact_form"`. Options: `"demo_request"`, `"contact_sales"`, `"quote_inquiry"` |
| `externalCustomerId` | String | No | Any tracking or session ID from your web analytics |

---

## 5. Implementation Examples

### Option A: Next.js (App Router - Route Handler)

File: `app/api/contact/route.ts` or `app/api/contact/route.js`

```javascript
import crypto from 'crypto';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const formData = await req.json();

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || '',
      company: formData.company || '',
      city: formData.city || '',
      country: formData.country || '',
      message: formData.message || '',
      sourceType: formData.sourceType || 'saas_contact_form',
      externalCustomerId: `LEAD-${Date.now()}`,
    };

    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const webhookSecret = process.env.ERP_WEBHOOK_SECRET;
    const storeId = process.env.ERP_STORE_ID;
    const erpBaseUrl = process.env.ERP_BASE_URL || 'https://app.3pldynamicsai.com';

    // Compute HMAC-SHA256 signature over `${timestamp}.${rawBody}`
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const erpResponse = await fetch(`${erpBaseUrl}/api/ecommerce/webhook/${storeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ERP-Event': 'lead.submitted',
        'X-ERP-Timestamp': timestamp,
        'X-ERP-Signature': signature,
      },
      body: rawBody,
    });

    const result = await erpResponse.json();

    if (!erpResponse.ok || !result.success) {
      console.error('ERP Webhook Error:', result);
      return NextResponse.json({ success: false, message: result.message || 'ERP sync error' }, { status: 502 });
    }

    return NextResponse.json({ success: true, contactId: result.contactId });
  } catch (error) {
    console.error('Contact submission error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
```

---

### Option B: Node.js / Express Backend

```javascript
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();

router.post('/api/contact-submit', async (req, res) => {
  try {
    const { name, email, phone, company, city, country, message } = req.body;

    const payload = {
      name,
      email,
      phone,
      company,
      city,
      country,
      message,
      sourceType: 'saas_contact_form',
      externalCustomerId: `LEAD-${Date.now()}`,
    };

    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secret = process.env.ERP_WEBHOOK_SECRET;
    const storeId = process.env.ERP_STORE_ID;
    const erpBaseUrl = process.env.ERP_BASE_URL;

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const response = await axios.post(
      `${erpBaseUrl}/api/ecommerce/webhook/${storeId}`,
      rawBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-ERP-Event': 'lead.submitted',
          'X-ERP-Timestamp': timestamp,
          'X-ERP-Signature': signature,
        },
      }
    );

    return res.status(200).json({ success: true, contactId: response.data.contactId });
  } catch (err) {
    console.error('ERP contact sync failed:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Submission failed' });
  }
});
```

---

### Option C: Python (FastAPI / Flask)

```python
import hmac
import hashlib
import json
import time
import requests
import os

ERP_BASE_URL = os.getenv("ERP_BASE_URL", "https://app.3pldynamicsai.com")
ERP_STORE_ID = os.getenv("ERP_STORE_ID")
ERP_WEBHOOK_SECRET = os.getenv("ERP_WEBHOOK_SECRET")

def forward_lead_to_erp(lead_data: dict):
    payload = {
        "name": lead_data.get("name"),
        "email": lead_data.get("email"),
        "phone": lead_data.get("phone", ""),
        "company": lead_data.get("company", ""),
        "city": lead_data.get("city", ""),
        "country": lead_data.get("country", ""),
        "message": lead_data.get("message", ""),
        "sourceType": "saas_contact_form",
        "externalCustomerId": f"LEAD-{int(time.time())}"
    }

    raw_body = json.dumps(payload, separators=(',', ':'))
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.{raw_body}".encode('utf-8')
    signature = hmac.new(ERP_WEBHOOK_SECRET.encode('utf-8'), signed_payload, hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-ERP-Event": "lead.submitted",
        "X-ERP-Timestamp": timestamp,
        "X-ERP-Signature": signature
    }

    url = f"{ERP_BASE_URL}/api/ecommerce/webhook/{ERP_STORE_ID}"
    response = requests.post(url, data=raw_body, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()
```

---

## 6. Testing via cURL Command

Run this terminal command to test the webhook directly:

```bash
# Set your values
STORE_ID="YOUR_STORE_ID_HERE"
SECRET="YOUR_WEBHOOK_SECRET_HERE"
TIMESTAMP=$(date +%s)
PAYLOAD='{"name":"Test Lead","email":"test@3pldynamicsai.com","company":"Acme Logistics","message":"Testing webhook integration","sourceType":"saas_contact_form"}'

# Compute HMAC signature (on bash with openssl)
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "${SECRET}" | sed 's/^.* //')

# Dispatch webhook
curl -X POST "https://app.3pldynamicsai.com/api/ecommerce/webhook/${STORE_ID}" \
  -H "Content-Type: application/json" \
  -H "X-ERP-Event: lead.submitted" \
  -H "X-ERP-Timestamp: ${TIMESTAMP}" \
  -H "X-ERP-Signature: ${SIGNATURE}" \
  -d "${PAYLOAD}"
```

### Expected Response

```json
{
  "success": true,
  "contactId": "6640abcd1234567890ef0123",
  "message": "Lead webhook successfully ingested into ERP."
}
```

---

## 7. Verification Inside ERP

Once submitted:
1. Open the ERP dashboard and navigate to **Website Management** -> **Contacts & Leads**.
2. You will see the incoming lead with `crmStatus: "unlinked"`.
3. Clicking **Promote to CRM Lead** creates an official CRM Lead in your pipeline without manual data re-entry.
