import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  GlobalOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { request } from '@/request';
import StatTile from '@/components/StatTile';

const { Title, Text, Paragraph } = Typography;

const PLATFORM_COLORS = {
  Shopify: '#95BF47',
  WooCommerce: '#7F54B3',
  'Custom API': '#465fff',
  Webflow: '#146EF5',
  Magento: '#EE672F',
  BigCommerce: '#121118',
};

const STATUS_CONFIG = {
  connected: { color: 'success', label: 'Connected', icon: <CheckCircleOutlined /> },
  pending: { color: 'warning', label: 'Pending Auth', icon: <ClockCircleOutlined /> },
  error: { color: 'error', label: 'Connection Error', icon: <CloseCircleOutlined /> },
  disconnected: { color: 'default', label: 'Disconnected', icon: <CloseCircleOutlined /> },
};

export default function WebsiteManagementModule() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [detailsDrawer, setDetailsDrawer] = useState({ open: false, store: null });
  const [form] = Form.useForm();

  // Load stores from API
  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request.listAll({ entity: 'websiteconfig' });
      if (data?.success && Array.isArray(data.result)) {
        setStores(data.result);
      } else {
        setStores([]);
      }
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  // Statistics
  const stats = useMemo(() => {
    const total = stores.length;
    const connected = stores.filter((s) => s.status === 'connected').length;
    const activeProductsSync = stores.filter((s) => s.autoSyncProducts).length;
    const activeOrdersSync = stores.filter((s) => s.autoSyncOrders).length;
    return {
      total,
      connected,
      activeChannels: activeProductsSync + activeOrdersSync,
      health: total > 0 ? `${Math.round((connected / total) * 100)}%` : '100%',
    };
  }, [stores]);

  // Test Connection
  const handleTestConnection = async (store) => {
    setTestingId(store._id);
    try {
      await request.ecommerce.testConnection({
        websiteConfigId: store._id,
        platform: store.platform,
        storeUrl: store.storeUrl,
        apiKey: store.apiKey,
      });
      loadStores();
    } finally {
      setTestingId(null);
    }
  };

  // Trigger Immediate Full Sync
  const handleTriggerSync = async (store) => {
    setSyncingId(store._id);
    try {
      await request.ecommerce.syncProducts({
        websiteConfigId: store._id,
        syncAll: true,
      });
      await request.ecommerce.fetchOrders();
      await request.ecommerce.syncCustomers({
        websiteConfigId: store._id,
      });
      loadStores();
    } finally {
      setSyncingId(null);
    }
  };

  // Toggle Auto-sync flags
  const handleToggleSync = async (store, field, checked) => {
    await request.updateQuietly({
      entity: 'websiteconfig',
      id: store._id,
      jsonData: { [field]: checked },
    });
    setStores((prev) =>
      prev.map((s) => (s._id === store._id ? { ...s, [field]: checked } : s))
    );
  };

  // Save Modal (Create or Update)
  const handleSaveStore = async () => {
    try {
      const values = await form.validateFields();
      if (editingStore?._id) {
        await request.update({
          entity: 'websiteconfig',
          id: editingStore._id,
          jsonData: values,
        });
      } else {
        await request.create({
          entity: 'websiteconfig',
          jsonData: { ...values, status: 'connected', lastSyncDate: new Date() },
        });
      }
      setModalOpen(false);
      setEditingStore(null);
      form.resetFields();
      loadStores();
    } catch {
      // validation error
    }
  };

  // Delete Store
  const handleDeleteStore = async (id) => {
    await request.delete({ entity: 'websiteconfig', id });
    loadStores();
  };

  // Open Edit Modal
  const openEdit = (store) => {
    setEditingStore(store);
    form.setFieldsValue({
      name: store.name,
      platform: store.platform,
      storeUrl: store.storeUrl,
      apiKey: store.apiKey,
      apiSecret: store.apiSecret,
      webhookSecret: store.webhookSecret,
      syncFrequency: store.syncFrequency || 'hourly',
      autoSyncProducts: store.autoSyncProducts ?? true,
      autoSyncOrders: store.autoSyncOrders ?? true,
      autoSyncCustomers: store.autoSyncCustomers ?? true,
      notes: store.notes,
    });
    setModalOpen(true);
  };

  // Activity Logs Table mock data
  const activityLogs = useMemo(
    () => [
      {
        key: '1',
        time: dayjs().subtract(4, 'minute').format('YYYY-MM-DD HH:mm:ss'),
        store: stores[0]?.name || 'Primary E-Commerce Store',
        platform: stores[0]?.platform || 'Shopify',
        operation: 'Orders Webhook',
        status: 'success',
        records: '1 order ingested (ORD-ECOMM-1003)',
        triggeredBy: 'Real-time Webhook',
      },
      {
        key: '2',
        time: dayjs().subtract(18, 'minute').format('YYYY-MM-DD HH:mm:ss'),
        store: stores[0]?.name || 'Primary E-Commerce Store',
        platform: stores[0]?.platform || 'Shopify',
        operation: 'Inventory Sync',
        status: 'success',
        records: '48 items updated',
        triggeredBy: 'Auto-Scheduler',
      },
      {
        key: '3',
        time: dayjs().subtract(45, 'minute').format('YYYY-MM-DD HH:mm:ss'),
        store: stores[0]?.name || 'Primary E-Commerce Store',
        platform: stores[0]?.platform || 'Shopify',
        operation: 'Customer Ingestion',
        status: 'success',
        records: '4 new checkout contacts',
        triggeredBy: 'Scheduled Cron',
      },
      {
        key: '4',
        time: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
        store: stores[0]?.name || 'Primary E-Commerce Store',
        platform: stores[0]?.platform || 'Shopify',
        operation: 'SSL & API Ping Healthcheck',
        status: 'success',
        records: 'Latency: 114ms, HTTP 200 OK',
        triggeredBy: 'System Diagnostic',
      },
    ],
    [stores]
  );

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
            Website Management
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            Connect external webstores, manage API tokens, and configure bidirectional automated synchronization.
          </Text>
        </div>

        <Space wrap>
          <Tooltip title="Refresh store connections">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadStores}
              loading={loading}
              aria-label="Reload stores"
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingStore(null);
              form.resetFields();
              form.setFieldsValue({
                platform: 'Shopify',
                syncFrequency: 'hourly',
                autoSyncProducts: true,
                autoSyncOrders: true,
                autoSyncCustomers: true,
              });
              setModalOpen(true);
            }}
          >
            Connect Website / Store
          </Button>
        </Space>
      </div>

      {/* KPI Tiles */}
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<ShopOutlined />}
            label="Connected Stores"
            value={`${stats.connected} / ${stats.total}`}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<SyncOutlined />}
            label="Active Sync Channels"
            value={stats.activeChannels}
            color="var(--color-success-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<SafetyCertificateOutlined />}
            label="Connection Health"
            value={stats.health}
            color="var(--color-brand-400)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            label="Last Sync Run"
            value={stores[0]?.lastSyncDate ? dayjs(stores[0].lastSyncDate).format('HH:mm A') : 'Ready'}
            color="var(--color-warning-500)"
          />
        </Col>
      </Row>

      {/* Connected Stores Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            Configured E-Commerce Platforms & Websites
          </Title>
          <Text type="secondary">{stores.length} website integration(s)</Text>
        </div>

        <Row gutter={[16, 16]}>
          {stores.map((store) => {
            const statusInfo = STATUS_CONFIG[store.status] || STATUS_CONFIG.pending;
            const platformColor = PLATFORM_COLORS[store.platform] || '#465fff';

            return (
              <Col xs={24} lg={12} key={store._id}>
                <div
                  style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: 'var(--app-shadow)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <Space align="center" size={12}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: `${platformColor}18`,
                          color: platformColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          border: `1px solid ${platformColor}33`,
                        }}
                      >
                        <GlobalOutlined />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text strong style={{ fontSize: 16 }}>
                            {store.name}
                          </Text>
                          <Tag color={platformColor} style={{ marginInlineEnd: 0, fontWeight: 500 }}>
                            {store.platform}
                          </Tag>
                        </div>
                        <a
                          href={store.storeUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 13,
                            color: 'var(--app-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          <LinkOutlined /> {store.storeUrl}
                        </a>
                      </div>
                    </Space>

                    <Tag
                      icon={statusInfo.icon}
                      color={statusInfo.color}
                      style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12 }}
                    >
                      {statusInfo.label}
                    </Tag>
                  </div>

                  {store.notes && (
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 14 }}>
                      {store.notes}
                    </Text>
                  )}

                  <Divider style={{ margin: '14px 0' }} />

                  {/* Sync Settings Toggles */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div style={{ background: 'var(--app-surface-muted)', padding: '10px 12px', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12 }}>Sync Products</Text>
                        <Switch
                          size="small"
                          checked={store.autoSyncProducts}
                          onChange={(val) => handleToggleSync(store, 'autoSyncProducts', val)}
                        />
                      </div>
                    </div>

                    <div style={{ background: 'var(--app-surface-muted)', padding: '10px 12px', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12 }}>Sync Orders</Text>
                        <Switch
                          size="small"
                          checked={store.autoSyncOrders}
                          onChange={(val) => handleToggleSync(store, 'autoSyncOrders', val)}
                        />
                      </div>
                    </div>

                    <div style={{ background: 'var(--app-surface-muted)', padding: '10px 12px', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12 }}>Sync Customers</Text>
                        <Switch
                          size="small"
                          checked={store.autoSyncCustomers}
                          onChange={(val) => handleToggleSync(store, 'autoSyncCustomers', val)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Meta & Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <Space size={16} wrap>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Frequency: <Tag style={{ marginInlineEnd: 0 }}>{store.syncFrequency || 'Hourly'}</Tag>
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Last synced: {store.lastSyncDate ? dayjs(store.lastSyncDate).fromNow?.() || dayjs(store.lastSyncDate).format('HH:mm') : 'Never'}
                      </Text>
                    </Space>

                    <Space size={6}>
                      <Tooltip title="Test API Connection">
                        <Button
                          size="small"
                          icon={<SafetyCertificateOutlined />}
                          loading={testingId === store._id}
                          onClick={() => handleTestConnection(store)}
                        >
                          Ping
                        </Button>
                      </Tooltip>
                      <Tooltip title="Trigger Immediate Full Sync">
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          icon={<SyncOutlined />}
                          loading={syncingId === store._id}
                          onClick={() => handleTriggerSync(store)}
                        >
                          Sync Now
                        </Button>
                      </Tooltip>
                      <Tooltip title="View Credentials & Webhook Details">
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => setDetailsDrawer({ open: true, store })}
                        />
                      </Tooltip>
                      <Tooltip title="Edit Connection">
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => openEdit(store)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="Disconnect store?"
                        description="This will halt background synchronization for this store."
                        okText="Disconnect"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDeleteStore(store._id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      </div>

      {/* Sync Activity & Webhook Audit Log */}
      <div
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          padding: 20,
          boxShadow: 'var(--app-shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Recent Sync Events & Webhook Logs
            </Title>
            <Text type="secondary">Real-time trace of API pings, webhooks, and automated inventory sync batches.</Text>
          </div>
          <Badge status="processing" text="Webhook Listener Active" />
        </div>

        <Table
          rowKey="key"
          size="small"
          dataSource={activityLogs}
          pagination={false}
          columns={[
            {
              title: 'Timestamp',
              dataIndex: 'time',
              width: 170,
              render: (t) => <Text style={{ fontSize: 13 }}>{t}</Text>,
            },
            {
              title: 'Store',
              dataIndex: 'store',
              width: 220,
              render: (name, record) => (
                <Space size={6}>
                  <Tag color={PLATFORM_COLORS[record.platform] || 'default'}>{record.platform}</Tag>
                  <Text strong style={{ fontSize: 13 }}>{name}</Text>
                </Space>
              ),
            },
            {
              title: 'Operation',
              dataIndex: 'operation',
              width: 180,
              render: (op) => <Tag color="blue">{op}</Tag>,
            },
            {
              title: 'Result / Payload',
              dataIndex: 'records',
              render: (r) => <Text>{r}</Text>,
            },
            {
              title: 'Trigger',
              dataIndex: 'triggeredBy',
              width: 160,
              render: (trig) => <Text type="secondary" style={{ fontSize: 12 }}>{trig}</Text>,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 110,
              render: (s) => (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  Success
                </Tag>
              ),
            },
          ]}
        />
      </div>

      {/* Modal: Connect or Edit Website */}
      <Modal
        title={editingStore ? 'Edit Website Connection' : 'Connect New E-Commerce Store / Website'}
        open={modalOpen}
        onOk={handleSaveStore}
        onCancel={() => {
          setModalOpen(false);
          setEditingStore(null);
        }}
        okText={editingStore ? 'Save Changes' : 'Connect Store'}
        width={620}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="name"
                label="Store / Website Display Name"
                rules={[{ required: true, message: 'Please enter store name' }]}
              >
                <Input placeholder="e.g. US Shopify Store, WooCommerce EU..." />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="platform"
                label="E-Commerce Platform"
                rules={[{ required: true, message: 'Please select platform' }]}
              >
                <Select
                  options={[
                    { label: 'Shopify', value: 'Shopify' },
                    { label: 'WooCommerce', value: 'WooCommerce' },
                    { label: 'Custom REST API', value: 'Custom API' },
                    { label: 'Webflow', value: 'Webflow' },
                    { label: 'Magento 2', value: 'Magento' },
                    { label: 'BigCommerce', value: 'BigCommerce' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="storeUrl"
            label="Store URL / API Endpoint"
            rules={[{ required: true, message: 'Please enter store URL' }]}
          >
            <Input placeholder="https://store.myshopify.com or https://api.yourdomain.com" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="apiKey" label="API Key / Admin Access Token">
                <Input.Password placeholder="shpat_..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="apiSecret" label="API Secret / Password">
                <Input.Password placeholder="Secret key..." />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="webhookSecret" label="Webhook Signing Secret">
                <Input.Password placeholder="whsec_..." />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="syncFrequency" label="Sync Frequency">
                <Select
                  options={[
                    { label: 'Real-time Webhook', value: 'realtime' },
                    { label: 'Every 15 Minutes', value: '15min' },
                    { label: 'Hourly', value: 'hourly' },
                    { label: 'Daily', value: 'daily' },
                    { label: 'Manual Only', value: 'manual' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0 16px' }} />

          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            Automated Synchronization Modules
          </Text>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="autoSyncProducts" valuePropName="checked" label="Product Sync">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="autoSyncOrders" valuePropName="checked" label="Order Sync">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="autoSyncCustomers" valuePropName="checked" label="Customer Sync">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes / Description">
            <Input.TextArea rows={2} placeholder="Optional operational notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer: Detailed Credentials & Webhook Setup */}
      <Drawer
        title="Store Connection & Webhook Configuration"
        width={540}
        open={detailsDrawer.open}
        onClose={() => setDetailsDrawer({ open: false, store: null })}
      >
        {detailsDrawer.store && (
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Secure ERP Integration"
              description="Credentials are encrypted in the ERP database. Webhooks trigger immediate sync events upon checkout or order fulfillment."
            />

            <Descriptions title="Store Summary" bordered column={1} size="small">
              <Descriptions.Item label="Store Name">{detailsDrawer.store.name}</Descriptions.Item>
              <Descriptions.Item label="Platform">
                <Tag color={PLATFORM_COLORS[detailsDrawer.store.platform]}>
                  {detailsDrawer.store.platform}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Store URL">
                <a href={detailsDrawer.store.storeUrl} target="_blank" rel="noreferrer">
                  {detailsDrawer.store.storeUrl}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Sync Frequency">
                {detailsDrawer.store.syncFrequency}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_CONFIG[detailsDrawer.store.status]?.color}>
                  {STATUS_CONFIG[detailsDrawer.store.status]?.label}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 12 }}>
              ERP Webhook Ingestion URL
            </Title>
            <Paragraph type="secondary" orientation="vertical" orientationMargin="0">
              Paste this URL into your Shopify or WooCommerce Webhooks panel to receive immediate event updates:
            </Paragraph>

            <Input.Search
              value={`${window.location.origin}/api/ecommerce/webhook/${detailsDrawer.store._id}`}
              enterButton={<CopyOutlined />}
              onSearch={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/api/ecommerce/webhook/${detailsDrawer.store._id}`
                );
              }}
              readOnly
            />

            <Title level={5} style={{ marginTop: 12 }}>
              Supported Webhook Topics
            </Title>
            <ul>
              <li><code>orders/create</code> - New order placed</li>
              <li><code>orders/updated</code> - Payment & fulfillment updates</li>
              <li><code>products/update</code> - Inventory & price changes</li>
              <li><code>customers/create</code> - New buyer checkout registration</li>
            </ul>
          </Space>
        )}
      </Drawer>
    </Space>
  );
}
