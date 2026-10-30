import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Dropdown,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  DownOutlined,
  ExportOutlined,
  EyeOutlined,
  GlobalOutlined,
  ImportOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { request } from '@/request';
import StatTile from '@/components/StatTile';

const { Title, Text, Paragraph } = Typography;

const FULFILLMENT_CONFIG = {
  pending: { color: 'warning', label: 'Pending', icon: <ClockCircleOutlined /> },
  processing: { color: 'processing', label: 'Processing', icon: <SyncOutlined spin /> },
  shipped: { color: 'cyan', label: 'Shipped', icon: <CarOutlined /> },
  delivered: { color: 'success', label: 'Delivered', icon: <CheckCircleOutlined /> },
  cancelled: { color: 'error', label: 'Cancelled', icon: <CloseCircleOutlined /> },
};

const PAYMENT_CONFIG = {
  paid: { color: 'success', label: 'Paid' },
  pending: { color: 'warning', label: 'Payment Pending' },
  refunded: { color: 'purple', label: 'Refunded' },
  failed: { color: 'error', label: 'Payment Failed' },
};

export default function OnlineOrdersModule() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingOrders, setFetchingOrders] = useState(false);
  const [convertingId, setConvertingId] = useState(null);

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState(undefined);

  const [detailDrawer, setDetailDrawer] = useState({ open: false, order: null });

  // Load orders
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request.ecommerce.fetchOrders();
      if (data?.success && Array.isArray(data.result)) {
        setOrders(data.result);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Fetch / Ingest from external storefront
  const handleFetchLatest = async () => {
    setFetchingOrders(true);
    try {
      await loadOrders();
    } finally {
      setFetchingOrders(false);
    }
  };

  // Convert online order to core ERP order
  const handleConvertOrder = async (order) => {
    setConvertingId(order._id);
    try {
      const res = await request.ecommerce.convertOrder(order._id);
      if (res?.success) {
        loadOrders();
        if (detailDrawer.open && detailDrawer.order?._id === order._id) {
          setDetailDrawer((prev) => ({
            ...prev,
            order: { ...prev.order, erpOrderId: res.result?.erpOrder, fulfillmentStatus: 'processing' },
          }));
        }
      }
    } finally {
      setConvertingId(null);
    }
  };

  // Update Fulfillment Status
  const handleUpdateStatus = async (orderId, status) => {
    await request.update({
      entity: 'onlineorder',
      id: orderId,
      jsonData: { fulfillmentStatus: status },
    });
    setOrders((prev) =>
      prev.map((o) => (o._id === orderId ? { ...o, fulfillmentStatus: status } : o))
    );
    if (detailDrawer.open && detailDrawer.order?._id === orderId) {
      setDetailDrawer((prev) => ({
        ...prev,
        order: { ...prev.order, fulfillmentStatus: status },
      }));
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.fulfillmentStatus === 'pending').length;
    const completed = orders.filter(
      (o) => o.fulfillmentStatus === 'shipped' || o.fulfillmentStatus === 'delivered'
    ).length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return {
      total,
      pending,
      completed,
      revenue: `$${totalRevenue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab !== 'all' && order.fulfillmentStatus !== activeTab) return false;

      // Payment filter
      if (paymentFilter && order.paymentStatus !== paymentFilter) return false;

      // Search filter
      if (search) {
        const query = search.toLowerCase();
        const matchesNumber = order.orderNumber?.toLowerCase().includes(query);
        const matchesExt = order.externalOrderId?.toLowerCase().includes(query);
        const matchesCustomer = order.customer?.name?.toLowerCase().includes(query);
        const matchesEmail = order.customer?.email?.toLowerCase().includes(query);
        if (!matchesNumber && !matchesExt && !matchesCustomer && !matchesEmail) return false;
      }

      return true;
    });
  }, [orders, activeTab, paymentFilter, search]);

  const columns = [
    {
      title: 'Order Details',
      key: 'orderNumber',
      width: 210,
      render: (_, record) => (
        <div>
          <Space size={6} align="center">
            <Text strong style={{ fontSize: 14 }}>
              {record.orderNumber}
            </Text>
          </Space>
          <div style={{ marginTop: 2 }}>
            <Tag color="geekblue" style={{ fontSize: 11, marginInlineEnd: 4 }}>
              {record.websiteConfig?.platform || 'Shopify'}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {record.externalOrderId || '—'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Date & Time',
      dataIndex: 'created',
      width: 160,
      render: (date) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>
            {dayjs(date).format('YYYY-MM-DD')}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(date).format('HH:mm A')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 230,
      render: (_, record) => (
        <div>
          <Text strong style={{ fontSize: 13, display: 'block' }}>
            {record.customer?.name || 'Guest Checkout'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {record.customer?.email || 'No email provided'}
          </Text>
          {record.customer?.city && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.customer.city}, {record.customer.country}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Ordered Products',
      key: 'items',
      width: 260,
      render: (_, record) => {
        const items = record.items || [];
        const count = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
        const preview = items.map((i) => `${i.name} (x${i.quantity})`).join(', ');

        return (
          <div>
            <Space size={6}>
              <Tag style={{ marginInlineEnd: 0 }}>{count} item{count > 1 ? 's' : ''}</Tag>
            </Space>
            <Paragraph
              ellipsis={{ rows: 2 }}
              style={{ fontSize: 12, margin: '4px 0 0', color: 'var(--app-text-secondary)' }}
            >
              {preview || 'No line items'}
            </Paragraph>
          </div>
        );
      },
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      width: 140,
      render: (amount, record) => {
        const paymentInfo = PAYMENT_CONFIG[record.paymentStatus] || PAYMENT_CONFIG.pending;
        return (
          <div>
            <Text strong style={{ fontSize: 14, display: 'block' }}>
              ${Number(amount || 0).toFixed(2)} {record.currency}
            </Text>
            <Tag color={paymentInfo.color} style={{ fontSize: 11, marginTop: 2, marginInlineEnd: 0 }}>
              {paymentInfo.label}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Fulfillment',
      dataIndex: 'fulfillmentStatus',
      width: 150,
      render: (status, record) => {
        const info = FULFILLMENT_CONFIG[status] || FULFILLMENT_CONFIG.pending;
        return (
          <Space direction="vertical" size={2}>
            <Tag color={info.color} icon={info.icon} style={{ marginInlineEnd: 0 }}>
              {info.label}
            </Tag>
            {record.erpOrderId && (
              <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                ERP Order Linked
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={6}>
          <Tooltip title="View Order Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailDrawer({ open: true, order: record })}
            >
              Details
            </Button>
          </Tooltip>

          {!record.erpOrderId ? (
            <Tooltip title="Import into ERP Orders Module">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<ImportOutlined />}
                loading={convertingId === record._id}
                onClick={() => handleConvertOrder(record)}
              >
                Import
              </Button>
            </Tooltip>
          ) : (
            <Tag color="success" style={{ marginInlineEnd: 0, fontSize: 11 }}>
              Imported
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Online Orders
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            Monitor and process incoming sales from your webstore, manage fulfillment lifecycles, and import orders into ERP CRM.
          </Text>
        </div>

        <Space wrap>
          <Tooltip title="Reload online orders">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadOrders}
              loading={loading}
              aria-label="Reload orders"
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            loading={fetchingOrders}
            onClick={handleFetchLatest}
          >
            Fetch Latest Orders
          </Button>
        </Space>
      </div>

      {/* KPI Tiles */}
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<ShoppingCartOutlined />}
            label="Total Online Orders"
            value={stats.total}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            label="Pending Fulfillment"
            value={stats.pending}
            color="var(--color-warning-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<CarOutlined />}
            label="Shipped & Delivered"
            value={stats.completed}
            color="var(--color-success-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<DollarOutlined />}
            label="E-Commerce Sales Volume"
            value={stats.revenue}
            color="var(--color-brand-400)"
          />
        </Col>
      </Row>

      {/* Orders Table Container */}
      <div
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          padding: 20,
          boxShadow: 'var(--app-shadow)',
        }}
      >
        {/* Toolbar & Filters */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Segmented
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { label: `All Orders (${stats.total})`, value: 'all' },
              { label: 'Pending', value: 'pending' },
              { label: 'Processing', value: 'processing' },
              { label: 'Shipped', value: 'shipped' },
              { label: 'Delivered', value: 'delivered' },
            ]}
          />

          <Space wrap>
            <Input
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              placeholder="Search by Order #, Customer, Email..."
              style={{ width: 270 }}
            />

            <Select
              allowClear
              value={paymentFilter}
              onChange={setPaymentFilter}
              placeholder="Payment Status"
              style={{ width: 160 }}
              options={[
                { label: 'Paid', value: 'paid' },
                { label: 'Pending', value: 'pending' },
                { label: 'Refunded', value: 'refunded' },
                { label: 'Failed', value: 'failed' },
              ]}
            />
          </Space>
        </div>

        {/* Table */}
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filteredOrders}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} online orders`,
          }}
        />
      </div>

      {/* Order Details Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Order #{detailDrawer.order?.orderNumber}</span>
            <Tag color="geekblue">{detailDrawer.order?.websiteConfig?.platform || 'Shopify'}</Tag>
          </div>
        }
        width={620}
        open={detailDrawer.open}
        onClose={() => setDetailDrawer({ open: false, order: null })}
        extra={
          detailDrawer.order && !detailDrawer.order.erpOrderId ? (
            <Button
              type="primary"
              icon={<ImportOutlined />}
              loading={convertingId === detailDrawer.order._id}
              onClick={() => handleConvertOrder(detailDrawer.order)}
            >
              Import into ERP
            </Button>
          ) : (
            <Tag color="success">Imported into ERP</Tag>
          )
        }
      >
        {detailDrawer.order && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            {/* Fulfillment Status Banner */}
            <div
              style={{
                background: 'var(--app-surface-muted)',
                padding: '14px 16px',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  Fulfillment Status:
                </Text>
                <Tag
                  color={FULFILLMENT_CONFIG[detailDrawer.order.fulfillmentStatus]?.color}
                  style={{ marginTop: 4, fontSize: 13, padding: '4px 10px' }}
                >
                  {FULFILLMENT_CONFIG[detailDrawer.order.fulfillmentStatus]?.label}
                </Tag>
              </div>

              <Space size={8}>
                <Text style={{ fontSize: 12 }}>Update Status:</Text>
                <Select
                  size="small"
                  value={detailDrawer.order.fulfillmentStatus}
                  onChange={(val) => handleUpdateStatus(detailDrawer.order._id, val)}
                  style={{ width: 130 }}
                  options={[
                    { label: 'Pending', value: 'pending' },
                    { label: 'Processing', value: 'processing' },
                    { label: 'Shipped', value: 'shipped' },
                    { label: 'Delivered', value: 'delivered' },
                    { label: 'Cancelled', value: 'cancelled' },
                  ]}
                />
              </Space>
            </div>

            {/* Customer Details */}
            <Descriptions title="Customer & Delivery Details" bordered column={1} size="small">
              <Descriptions.Item label="Customer Name">
                {detailDrawer.order.customer?.name || 'Guest Customer'}
              </Descriptions.Item>
              <Descriptions.Item label="Email Address">
                {detailDrawer.order.customer?.email || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Contact Phone">
                {detailDrawer.order.customer?.phone || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Shipping Address">
                {detailDrawer.order.customer?.address || 'N/A'}, {detailDrawer.order.customer?.city || ''}{' '}
                {detailDrawer.order.customer?.postalCode || ''}, {detailDrawer.order.customer?.country || ''}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Method">
                {detailDrawer.order.paymentMethod || 'Credit Card'}
              </Descriptions.Item>
              {detailDrawer.order.notes && (
                <Descriptions.Item label="Order Notes">
                  {detailDrawer.order.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Line Items */}
            <Title level={5} style={{ margin: 0 }}>
              Order Line Items
            </Title>
            <Table
              rowKey="sku"
              size="small"
              pagination={false}
              dataSource={detailDrawer.order.items || []}
              columns={[
                {
                  title: 'Item Description',
                  dataIndex: 'name',
                  render: (name, item) => (
                    <div>
                      <Text strong style={{ fontSize: 13, display: 'block' }}>{name}</Text>
                      {item.sku && <Text type="secondary" style={{ fontSize: 11 }}>SKU: {item.sku}</Text>}
                    </div>
                  ),
                },
                {
                  title: 'Qty',
                  dataIndex: 'quantity',
                  width: 60,
                  align: 'center',
                },
                {
                  title: 'Price',
                  dataIndex: 'price',
                  width: 90,
                  render: (p) => `$${Number(p || 0).toFixed(2)}`,
                },
                {
                  title: 'Total',
                  dataIndex: 'total',
                  width: 100,
                  render: (t) => <Text strong>${Number(t || 0).toFixed(2)}</Text>,
                },
              ]}
            />

            {/* Financial Summary */}
            <div
              style={{
                background: 'var(--app-surface-muted)',
                padding: '14px 18px',
                borderRadius: 8,
                marginLeft: 'auto',
                width: 280,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text type="secondary">Subtotal:</Text>
                <Text>${Number(detailDrawer.order.subtotal || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text type="secondary">Shipping Fee:</Text>
                <Text>${Number(detailDrawer.order.shippingTotal || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text type="secondary">Estimated Tax:</Text>
                <Text>${Number(detailDrawer.order.taxTotal || 0).toFixed(2)}</Text>
              </div>
              {detailDrawer.order.discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text type="secondary">Discounts:</Text>
                  <Text type="success">-${Number(detailDrawer.order.discountTotal || 0).toFixed(2)}</Text>
                </div>
              )}
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 15 }}>Grand Total:</Text>
                <Text strong style={{ fontSize: 16, color: 'var(--app-primary)' }}>
                  ${Number(detailDrawer.order.totalAmount || 0).toFixed(2)} {detailDrawer.order.currency}
                </Text>
              </div>
            </div>
          </Space>
        )}
      </Drawer>
    </Space>
  );
}
