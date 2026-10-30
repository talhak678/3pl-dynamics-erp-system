const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const router = express.Router();

const WebsiteConfig = mongoose.model('WebsiteConfig');
const OnlineOrder = mongoose.model('OnlineOrder');
const CustomerSync = mongoose.model('CustomerSync');

/**
 * Public Webhook Ingestion Router for External Custom Websites & SaaS Platforms
 * Mounted at: /api/ecommerce/webhook/:storeId
 *
 * Verifies HMAC-SHA256 signature using the store's configured webhookSecret.
 */
router.post('/ecommerce/webhook/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store identifier format.',
      });
    }

    const store = await WebsiteConfig.findOne({ _id: storeId, removed: false });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Website / Store configuration not found.',
      });
    }

    // Signature & Timestamp Verification
    const signature = req.headers['x-erp-signature'];
    const timestamp = req.headers['x-erp-timestamp'];
    const eventType = req.headers['x-erp-event'] || 'order.created';

    if (store.webhookSecret) {
      if (!signature || !timestamp) {
        return res.status(401).json({
          success: false,
          message: 'Missing required webhook security headers: X-ERP-Signature and X-ERP-Timestamp.',
        });
      }

      // Check replay window (within 5 minutes = 300 seconds)
      const now = Math.floor(Date.now() / 1000);
      const parsedTime = parseInt(timestamp, 10);
      if (isNaN(parsedTime) || Math.abs(now - parsedTime) > 300) {
        return res.status(401).json({
          success: false,
          message: 'Webhook timestamp expired or outside acceptable clock skew (300s).',
        });
      }

      // Compute expected HMAC
      const rawBody = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', store.webhookSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        return res.status(401).json({
          success: false,
          message: 'Invalid cryptographic signature (HMAC-SHA256 verification failed).',
        });
      }
    }

    // Process Payload based on Event
    if (eventType === 'order.created') {
      const orderPayload = req.body;
      const orderNumber =
        orderPayload.orderNumber ||
        `ORD-${store.platform.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

      const newOrder = await new OnlineOrder({
        createdBy: store.createdBy,
        createdByUser: store.createdByUser,
        websiteConfig: store._id,
        orderNumber,
        externalOrderId: orderPayload.externalOrderId || `EXT-${Date.now()}`,
        customer: {
          name: orderPayload.customer?.name || 'Guest Buyer',
          email: orderPayload.customer?.email || '',
          phone: orderPayload.customer?.phone || '',
          address: orderPayload.customer?.address || '',
          city: orderPayload.customer?.city || '',
          country: orderPayload.customer?.country || '',
          postalCode: orderPayload.customer?.postalCode || '',
        },
        items: Array.isArray(orderPayload.items)
          ? orderPayload.items.map((item) => ({
              name: item.name || 'Custom Product',
              sku: item.sku || '',
              quantity: item.quantity || 1,
              price: item.price || 0,
              total: item.total || (item.quantity || 1) * (item.price || 0),
            }))
          : [],
        subtotal: orderPayload.subtotal || 0,
        taxTotal: orderPayload.taxTotal || 0,
        shippingTotal: orderPayload.shippingTotal || 0,
        discountTotal: orderPayload.discountTotal || 0,
        totalAmount: orderPayload.totalAmount || 0,
        currency: orderPayload.currency || 'USD',
        paymentStatus: orderPayload.paymentStatus || 'paid',
        fulfillmentStatus: 'pending',
        paymentMethod: orderPayload.paymentMethod || 'Credit Card',
        notes: orderPayload.notes || '',
        syncedAt: new Date(),
      }).save();

      // If new customer, optionally sync into CustomerSync collection as well
      if (orderPayload.customer?.email) {
        const existingCustomer = await CustomerSync.findOne({
          createdBy: store.createdBy,
          email: orderPayload.customer.email.toLowerCase(),
          removed: false,
        });

        if (!existingCustomer) {
          await new CustomerSync({
            createdBy: store.createdBy,
            createdByUser: store.createdByUser,
            websiteConfig: store._id,
            sourcePlatform: store.platform,
            sourceType: 'ecommerce_checkout',
            name: orderPayload.customer.name,
            email: orderPayload.customer.email.toLowerCase(),
            phone: orderPayload.customer.phone || '',
            address: orderPayload.customer.address || '',
            city: orderPayload.customer.city || '',
            country: orderPayload.customer.country || '',
            externalCustomerId: orderPayload.externalOrderId || '',
            totalOrders: 1,
            totalSpent: orderPayload.totalAmount || 0,
            crmStatus: 'unlinked',
            syncedAt: new Date(),
          }).save();
        } else {
          existingCustomer.totalOrders = (existingCustomer.totalOrders || 0) + 1;
          existingCustomer.totalSpent =
            (existingCustomer.totalSpent || 0) + (orderPayload.totalAmount || 0);
          await existingCustomer.save();
        }
      }

      // Update store connection lastSyncDate
      store.lastSyncDate = new Date();
      store.status = 'connected';
      await store.save();

      return res.status(200).json({
        success: true,
        orderId: newOrder._id,
        orderNumber: newOrder.orderNumber,
        message: 'Order webhook successfully ingested into ERP.',
      });
    }

    if (eventType === 'lead.submitted') {
      const leadPayload = req.body;

      const newContact = await new CustomerSync({
        createdBy: store.createdBy,
        createdByUser: store.createdByUser,
        websiteConfig: store._id,
        sourcePlatform: store.name || store.platform,
        sourceType: leadPayload.sourceType || 'saas_contact_form',
        name: leadPayload.name || 'Web Prospect',
        email: (leadPayload.email || '').toLowerCase(),
        phone: leadPayload.phone || '',
        company: leadPayload.company || '',
        city: leadPayload.city || '',
        country: leadPayload.country || '',
        externalCustomerId: leadPayload.externalCustomerId || '',
        message: leadPayload.message || '',
        crmStatus: 'unlinked',
        syncedAt: new Date(),
      }).save();

      store.lastSyncDate = new Date();
      await store.save();

      return res.status(200).json({
        success: true,
        contactId: newContact._id,
        message: 'Lead webhook successfully ingested into ERP.',
      });
    }

    return res.status(400).json({
      success: false,
      message: `Unsupported event type: ${eventType}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
