# Custom Website & SaaS Platform Integration Specification
## Secure Bidirectional Synchronization (ERP <-> External Platform)

**Document Version:** 1.0.0  
**Target Audience:** External Frontend/Backend Developers, DevOps Engineers, System Integrators  
**Scope:** Custom-coded platforms (Next.js, Node.js, Laravel/PHP, Python/Django, Ruby on Rails, React/SPA with custom backends)

---

## 1. Architectural Overview

This document specifies the exact technical requirements and contract for establishing a robust, real-time, bidirectional synchronization between the **ERP System** and your **custom external website or SaaS platform**.

```
+-----------------------------------------------------------------------------------+
|                           BIDIRECTIONAL INTEGRATION ARCHITECTURE                   |
+-----------------------------------------------------------------------------------+

     [ INBOUND TO ERP ]                                   [ OUTBOUND FROM ERP ]
  (New Orders & Web Leads)                             (Live Stock & Price Sync)
  
  +--------------------------+                         +--------------------------+
  |  Custom Website / SaaS   |                         |        ERP System        |
  |  (Next.js / Laravel)     |                         |  (Website & E-Commerce)  |
  +--------------------------+                         +--------------------------+
               |                                                    |
               | 1. HTTP POST (Webhook)                             | 1. HTTP PATCH / POST
               |    X-ERP-Signature: HMAC-SHA256                    |    Authorization: Bearer <API_KEY>
               |    X-ERP-Timestamp: Unix-Time                      |    Payload: SKU, Price, Stock
               v                                                    v
  +--------------------------+                         +--------------------------+
  |        ERP Server        |                         |  Custom External API     |
  |  /api/ecommerce/webhook/ |                         |  /api/v1/erp/inventory/  |
  |         <STORE_ID>       |                         |          sync            |
  +--------------------------+                         +--------------------------+
               |                                                    |
               | 2. Validates HMAC                                  | 2. Updates local DB
               | 3. Stores in OnlineOrder/Customer                  | 3. Returns 200 OK
               v                                                    v
      ERP Core Collections                             Custom Storefront Updated
```

---

## 2. Inbound to ERP: Webhooks (Orders & Leads)

When a customer checks out on your custom e-commerce site or a prospect fills out a B2B SaaS contact/lead form, your server-side backend must trigger an **HTTP POST Webhook** to the ERP.

### 2.1 ERP Webhook Endpoint Structure

```http
POST https://<erp-domain>/api/ecommerce/webhook/:storeId
Content-Type: application/json
X-ERP-Signature: <hex-encoded-hmac-sha256-signature>
X-ERP-Timestamp: <unix-timestamp-in-seconds>
X-ERP-Event: <order.created | lead.submitted>
```

- **`:storeId`**: The unique 24-character hexadecimal MongoDB ObjectId of your store connection, generated in ERP **Website Management** (e.g., `67223a10b4f39281a94ef120`).

---

### 2.2 Security & Authentication Mechanism (HMAC-SHA256)

To prevent spoofing and replay attacks, all requests **must** be cryptographically signed using the **Shared Webhook Secret** assigned to your platform.

#### How to Generate the Signature:
1. Construct the signature string: `<timestamp>.<raw_json_payload>`
2. Compute an **HMAC-SHA256** hash using your `webhookSecret`.
3. Hex-encode the output digest.
4. Pass the result in the `X-ERP-Signature` header.
5. Replay prevention: The ERP verifies that `X-ERP-Timestamp` is within **300 seconds (5 minutes)** of the current server time.

#### Next.js / Node.js Implementation Example:
```typescript
import crypto from 'crypto';

export async function sendErpWebhook(event: string, payload: object) {
  const storeId = process.env.ERP_STORE_ID!;
  const webhookSecret = process.env.ERP_WEBHOOK_SECRET!;
  const erpDomain = process.env.ERP_BASE_URL!; // e.g. https://erp.yourcompany.com

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = JSON.stringify(payload);

  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const response = await fetch(`${erpDomain}/api/ecommerce/webhook/${storeId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ERP-Signature': signature,
      'X-ERP-Timestamp': timestamp,
      'X-ERP-Event': event,
    },
    body: rawBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ERP Webhook failed [${response.status}]: ${errorText}`);
  }

  return await response.json();
}
```

#### Laravel / PHP Implementation Example:
```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class ErpSyncService
{
    public function dispatchOrderToErp(array $orderData): bool
    {
        $storeId = config('services.erp.store_id');
        $secret  = config('services.erp.webhook_secret');
        $baseUrl = config('services.erp.base_url');

        $timestamp = (string) time();
        $payload   = json_encode($orderData);
        $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);

        $response = Http::withHeaders([
            'Content-Type'    => 'application/json',
            'X-ERP-Signature' => $signature,
            'X-ERP-Timestamp' => $timestamp,
            'X-ERP-Event'     => 'order.created',
        ])->withBody($payload, 'application/json')
          ->post("{$baseUrl}/api/ecommerce/webhook/{$storeId}");

        return $response->successful();
    }
}
```

---

### 2.3 Expected Payload Schemas

#### A. Event: `order.created` (New E-Commerce Checkout)

```json
{
  "orderNumber": "ORD-NEXTJS-9842",
  "externalOrderId": "cust_order_68392",
  "customer": {
    "name": "Alex Mercer",
    "email": "alex.mercer@gmail.com",
    "phone": "+1 415-555-0182",
    "address": "456 Market St, Suite 1200",
    "city": "San Francisco",
    "country": "United States",
    "postalCode": "94105"
  },
  "items": [
    {
      "name": "Industrial Pallet Jack 2500kg",
      "sku": "PJ-2500",
      "quantity": 1,
      "price": 349.00,
      "total": 349.00
    },
    {
      "name": "Wireless 2D Handheld Scanner",
      "sku": "SCAN-2D-HH",
      "quantity": 2,
      "price": 129.50,
      "total": 259.00
    }
  ],
  "subtotal": 608.00,
  "taxTotal": 51.68,
  "shippingTotal": 25.00,
  "discountTotal": 0.00,
  "totalAmount": 684.68,
  "currency": "USD",
  "paymentStatus": "paid",
  "paymentMethod": "Stripe Credit Card",
  "notes": "Gate code is #4491. Deliver to building reception."
}
```

**Field Descriptions for `order.created`:**
| Field | Type | Required | Description |
|---|---|---|---|
| `orderNumber` | string | **Yes** | Your platform's user-facing order number (e.g., `ORD-10023`). |
| `externalOrderId` | string | No | Internal database UUID or ID on your custom platform. |
| `customer.name` | string | **Yes** | Full name of the purchasing customer. |
| `customer.email` | string | **Yes** | Primary email address for order notifications & billing. |
| `customer.phone` | string | No | Phone number for shipping/carrier notifications. |
| `customer.address` | string | No | Street address for delivery. |
| `customer.city` | string | No | Delivery city. |
| `customer.country` | string | No | Delivery country name or ISO-2 code. |
| `customer.postalCode`| string | No | Zip or postal code. |
| `items[].name` | string | **Yes** | Display name of the product purchased. |
| `items[].sku` | string | No | Item SKU matching the ERP inventory catalog. |
| `items[].quantity` | number | **Yes** | Unit quantity purchased (minimum: 1). |
| `items[].price` | number | **Yes** | Price per unit at checkout time. |
| `items[].total` | number | **Yes** | Total line item amount (`quantity * price`). |
| `subtotal` | number | **Yes** | Total before taxes, shipping, or discounts. |
| `taxTotal` | number | No | Taxes applied (default: 0). |
| `shippingTotal` | number | No | Shipping charge collected (default: 0). |
| `discountTotal` | number | No | Discount amount subtracted (default: 0). |
| `totalAmount` | number | **Yes** | Final grand total collected from customer. |
| `currency` | string | **Yes** | 3-letter currency code (e.g. `USD`, `EUR`, `CAD`, `GBP`). |
| `paymentStatus` | string | **Yes** | One of: `paid`, `pending`, `failed`, `refunded`. |
| `paymentMethod` | string | No | Payment processor/mode (e.g. `Stripe`, `PayPal`, `Bank Transfer`). |
| `notes` | string | No | Customer delivery instructions or internal checkout notes. |

---

#### B. Event: `lead.submitted` (B2B SaaS / Contact / Demo Request)

```json
{
  "name": "Sarah Connor",
  "email": "sconnor@cyberlogistics.io",
  "phone": "+1 312-555-8910",
  "company": "CyberLogistics Global",
  "city": "Chicago",
  "country": "United States",
  "sourceType": "saas_contact_form",
  "message": "Interested in 3PL multi-warehouse inventory automation and API quote for 15,000 monthly shipments.",
  "externalCustomerId": "user_nextjs_99182"
}
```

**Field Descriptions for `lead.submitted`:**
| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | **Yes** | Contact person's full name. |
| `email` | string | **Yes** | Contact person's email address. |
| `phone` | string | No | Contact phone number. |
| `company` | string | No | Name of the prospective client business. |
| `city` | string | No | City where business is located. |
| `country` | string | No | Country name or ISO code. |
| `sourceType` | string | **Yes** | One of: `saas_contact_form`, `demo_request`, `newsletter`, `ecommerce_checkout`. |
| `message` | string | No | The prospective lead's inquiry message or RFP details. |
| `externalCustomerId` | string | No | User identifier from your platform (if registered). |

---

## 3. Outbound from ERP: Product & Inventory Sync

When prices or stock levels are updated in the ERP, the ERP pushes these updates to your custom platform via HTTP.

### 3.1 Endpoint Your External Platform Must Implement

Your engineering team must expose a secure REST API endpoint on your server:

```http
PATCH /api/v1/erp/inventory/sync
Host: your-website-or-api.com
Content-Type: application/json
Authorization: Bearer <API_KEY>
```

*(Alternatively, `POST /api/v1/erp/inventory/sync` is also accepted).*

---

### 3.2 Request Headers Sent by ERP
| Header Name | Value / Format | Purpose |
|---|---|---|
| `Authorization` | `Bearer <API_KEY>` | Secret token generated in ERP Website Management. |
| `Content-Type` | `application/json` | JSON request payload. |
| `User-Agent` | `3PLDynamics-ERP-SyncBot/2.0` | Client identifier. |
| `X-ERP-Sync-Timestamp` | ISO 8601 string | Time the sync batch was generated. |

---

### 3.3 Payload Sent by ERP to Your Platform

The ERP can send either a single product update or a bulk batch update:

```json
{
  "syncTimestamp": "2026-10-30T16:00:00.000Z",
  "batchId": "sync_batch_981a20df",
  "products": [
    {
      "erpProductId": "67215a9b8918204b781a9f01",
      "externalProductId": "PJ-2500",
      "sku": "PJ-2500",
      "name": "Industrial Pallet Jack 2500kg",
      "price": 349.00,
      "currency": "USD",
      "stockQuantity": 42,
      "inStock": true,
      "updatedAt": "2026-10-30T15:58:12.000Z"
    },
    {
      "erpProductId": "67215a9b8918204b781a9f02",
      "externalProductId": "SCAN-2D-HH",
      "sku": "SCAN-2D-HH",
      "name": "Bluetooth Barcode Scanner",
      "price": 129.50,
      "currency": "USD",
      "stockQuantity": 0,
      "inStock": false,
      "updatedAt": "2026-10-30T15:58:12.000Z"
    }
  ]
}
```

---

### 3.4 Expected Response from Your Platform

Your endpoint must return HTTP `200 OK` (or `207 Multi-Status`) with a JSON acknowledgement:

```json
{
  "success": true,
  "processedCount": 2,
  "errors": [],
  "message": "Inventory and pricing successfully updated."
}
```

If an individual SKU cannot be found in your database, report it inside `errors` without failing the entire batch:

```json
{
  "success": true,
  "processedCount": 1,
  "errors": [
    {
      "sku": "UNKNOWN-SKU",
      "message": "Product not found on external database."
    }
  ],
  "message": "Partial sync completed."
}
```

---

### 3.5 Example Implementation for Custom Backend

#### Next.js Route Handler (`app/api/v1/erp/inventory/sync/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  // 1. Verify Bearer Token
  const authHeader = req.headers.get('authorization');
  const expectedKey = process.env.ERP_API_KEY;

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { products } = body;

    for (const item of products) {
      // 2. Update your database (e.g. Prisma, Drizzle, MongoDB)
      /*
      await prisma.product.update({
        where: { sku: item.sku },
        data: {
          price: item.price,
          stock: item.stockQuantity,
          isAvailable: item.inStock,
        },
      });
      */
    }

    return NextResponse.json({
      success: true,
      processedCount: products.length,
      message: 'Inventory synchronized successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
```

#### Laravel Controller (`app/Http/Controllers/Api/ErpSyncController.php`):
```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Product;

class ErpSyncController extends Controller
{
    public function syncInventory(Request $request)
    {
        // 1. Validate Bearer Token
        $token = $request->bearerToken();
        if ($token !== config('services.erp.api_key')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $products = $request->input('products', []);

        foreach ($products as $item) {
            Product::where('sku', $item['sku'])->update([
                'price'        => $item['price'],
                'stock'        => $item['stockQuantity'],
                'is_available' => $item['inStock'],
            ]);
        }

        return response()->json([
            'success'        => true,
            'processedCount' => count($products),
            'message'        => 'Inventory updated successfully.',
        ]);
    }
}
```

---

## 4. Security Keys & Environment Variables Reference

When creating a connection under ERP **Website Management**, the following secrets are configured and shared:

| Key Identifier | Where Configured in ERP | Where Stored on Custom Website | Description |
|---|---|---|---|
| **Store ID (`storeId`)** | Displayed in connection drawer | `.env` (`ERP_STORE_ID`) | Unique MongoDB ID targeting your store's tenant partition. |
| **Shared Webhook Secret** | Field: `webhookSecret` | `.env` (`ERP_WEBHOOK_SECRET`) | Private string used to generate and verify HMAC-SHA256 signatures for inbound events (`order.created`, `lead.submitted`). |
| **Outbound API Key** | Field: `apiKey` | `.env` (`ERP_API_KEY`) | Shared high-entropy Bearer token passed by ERP when pushing inventory/prices to your endpoint. |
| **External Store API URL**| Field: `storeUrl` | ERP Backend Config | The base URL of your live site (e.g., `https://api.yourbrand.com`). |

### Recommended `.env` Template for External Platform:
```env
# ERP Integration Configuration
ERP_BASE_URL=https://erp.yourcompany.com
ERP_STORE_ID=67223a10b4f39281a94ef120
ERP_WEBHOOK_SECRET=whsec_9a8df7c312781b0a7c4e
ERP_API_KEY=erp_live_sec_8a9f201948bdca8102
```

---

## 5. End-to-End Testing & Verification Checklist

Before moving to production, complete the following verification steps:

- [ ] **1. Ping Health Check:** In ERP Website Management, click **Ping** on your store card. The ERP verifies that your custom endpoint answers HTTP 200 within acceptable latency (<250ms).
- [ ] **2. Webhook Ingestion (Inbound):**
  - Trigger a test `order.created` POST from your local environment or Postman to `https://<erp>/api/ecommerce/webhook/<storeId>`.
  - Confirm the order immediately surfaces in ERP under **Website & E-Commerce > Online Orders**.
  - Click **Import** to verify seamless creation of an ERP CRM Order.
- [ ] **3. Lead Submission (Inbound):**
  - Trigger a `lead.submitted` POST with contact and message data.
  - Verify it lands in **Website & E-Commerce > Customer Sync**.
  - Test the **Convert to Customer** and **Convert to Lead** buttons.
- [ ] **4. Inventory Push (Outbound):**
  - Modify a product's stock or price in **Product Catalog Sync**.
  - Click **Sync**. Confirm your external backend receives the `PATCH` request with the valid Bearer token and updates its local database.
- [ ] **5. HMAC Rejection Verification:** Send a webhook request with an altered payload or invalid signature and verify that the ERP returns `401 Unauthorized`.
