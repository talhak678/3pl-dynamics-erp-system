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
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
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
  CheckCircleOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilterOutlined,
  GlobalOutlined,
  LinkOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  SyncOutlined,
  UserAddOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { request } from '@/request';
import StatTile from '@/components/StatTile';

const { Title, Text, Paragraph } = Typography;

const SOURCE_TYPE_LABELS = {
  ecommerce_checkout: { label: 'Store Buyer', color: 'green' },
  saas_contact_form: { label: 'B2B SaaS Form', color: 'blue' },
  demo_request: { label: 'Demo Request', color: 'purple' },
  newsletter: { label: 'Newsletter', color: 'cyan' },
};

export default function CustomerSyncModule() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [linkingId, setLinkingId] = useState(null);

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState(undefined);

  const [linkModal, setLinkModal] = useState({ open: false, contact: null });
  const [detailDrawer, setDetailDrawer] = useState({ open: false, contact: null });
  const [createModal, setCreateModal] = useState(false);

  const [linkForm] = Form.useForm();
  const [createForm] = Form.useForm();

  // Load contacts
  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request.listAll({ entity: 'customersync' });
      if (data?.success && Array.isArray(data.result)) {
        setContacts(data.result);
      } else {
        setContacts([]);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Sync external customers
  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      await loadContacts();
    } finally {
      setSyncing(false);
    }
  };

  // Convert/Link to ERP CRM
  const handleConfirmLink = async () => {
    try {
      const values = await linkForm.validateFields();
      const contact = linkModal.contact;
      setLinkingId(contact._id);

      const res = await request.ecommerce.linkCustomer(contact._id, {
        targetType: values.targetType,
      });

      if (res?.success) {
        setLinkModal({ open: false, contact: null });
        loadContacts();
      }
    } finally {
      setLinkingId(null);
    }
  };

  // Direct quick link
  const handleQuickLink = async (contact, targetType) => {
    setLinkingId(contact._id);
    try {
      await request.ecommerce.linkCustomer(contact._id, { targetType });
      loadContacts();
    } finally {
      setLinkingId(null);
    }
  };

  // Delete contact
  const handleDelete = async (id) => {
    await request.delete({ entity: 'customersync', id });
    loadContacts();
  };

  // Manual create new external lead / contact
  const handleCreateContact = async () => {
    try {
      const values = await createForm.validateFields();
      await request.create({
        entity: 'customersync',
        jsonData: {
          ...values,
          crmStatus: 'unlinked',
          syncedAt: new Date(),
        },
      });
      setCreateModal(false);
      createForm.resetFields();
      loadContacts();
    } catch {
      // validation error
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = contacts.length;
    const clients = contacts.filter((c) => c.crmStatus === 'linked_client').length;
    const leads = contacts.filter((c) => c.crmStatus === 'linked_lead').length;
    const unlinked = contacts.filter((c) => c.crmStatus === 'unlinked').length;
    return { total, clients, leads, unlinked };
  }, [contacts]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      // Tab filter
      if (activeTab === 'buyers' && contact.sourceType !== 'ecommerce_checkout') return false;
      if (activeTab === 'forms' && contact.sourceType !== 'saas_contact_form' && contact.sourceType !== 'demo_request') return false;
      if (activeTab === 'unlinked' && contact.crmStatus !== 'unlinked') return false;

      // Source filter
      if (sourceFilter && contact.sourceType !== sourceFilter) return false;

      // Search filter
      if (search) {
        const query = search.toLowerCase();
        const matchesName = contact.name?.toLowerCase().includes(query);
        const matchesEmail = contact.email?.toLowerCase().includes(query);
        const matchesCompany = contact.company?.toLowerCase().includes(query);
        const matchesCity = contact.city?.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesCompany && !matchesCity) return false;
      }

      return true;
    });
  }, [contacts, activeTab, sourceFilter, search]);

  const crmStatusTag = (status) => {
    switch (status) {
      case 'linked_client':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Linked to Customer
          </Tag>
        );
      case 'linked_lead':
        return (
          <Tag color="blue" icon={<FilterOutlined />}>
            Linked to Lead
          </Tag>
        );
      default:
        return (
          <Tag color="warning" icon={<ClockCircleOutlined />}>
            Unlinked (Pending)
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: 'External Contact',
      key: 'name',
      width: 250,
      render: (_, record) => (
        <Space size={12} align="center">
          <Avatar
            size={40}
            style={{
              background: record.sourceType === 'ecommerce_checkout' ? 'var(--color-brand-500)' : '#7F54B3',
            }}
          >
            {record.name ? record.name.charAt(0).toUpperCase() : <UserOutlined />}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 14, display: 'block' }}>
              {record.name}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {record.email}
            </Text>
            {record.phone && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                <PhoneOutlined /> {record.phone}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Source Channel',
      key: 'source',
      width: 190,
      render: (_, record) => {
        const typeInfo = SOURCE_TYPE_LABELS[record.sourceType] || { label: record.sourceType, color: 'default' };
        return (
          <div>
            <Tag color={typeInfo.color} style={{ marginInlineEnd: 0, fontWeight: 500 }}>
              {typeInfo.label}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
              {record.sourcePlatform || 'Web Store'}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Company & Location',
      key: 'company',
      width: 200,
      render: (_, record) => (
        <div>
          <Text strong style={{ fontSize: 13, display: 'block' }}>
            {record.company || 'Individual Consumer'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[record.city, record.country].filter(Boolean).join(', ') || 'Global'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Activity / Value',
      key: 'value',
      width: 210,
      render: (_, record) => {
        if (record.sourceType === 'ecommerce_checkout') {
          return (
            <div>
              <Text strong style={{ fontSize: 13 }}>
                ${Number(record.totalSpent || 0).toFixed(2)}
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {record.totalOrders || 1} online order(s) placed
              </Text>
            </div>
          );
        }

        return (
          <Paragraph
            ellipsis={{ rows: 2 }}
            style={{ fontSize: 12, margin: 0, color: 'var(--app-text-secondary)' }}
          >
            {record.message || 'Form submitted via website contact form.'}
          </Paragraph>
        );
      },
    },
    {
      title: 'CRM Status',
      dataIndex: 'crmStatus',
      width: 170,
      render: (status) => crmStatusTag(status),
    },
    {
      title: 'Arrived Date',
      dataIndex: 'created',
      width: 140,
      render: (date) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(date).format('YYYY-MM-DD')}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View full inquiry & payload">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailDrawer({ open: true, contact: record })}
            />
          </Tooltip>

          {record.crmStatus === 'unlinked' ? (
            <>
              <Tooltip title="Convert directly into ERP Customer (Client)">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<CustomerServiceOutlined />}
                  loading={linkingId === record._id}
                  onClick={() => handleQuickLink(record, 'client')}
                >
                  Customer
                </Button>
              </Tooltip>

              <Tooltip title="Convert into Sales CRM Lead">
                <Button
                  size="small"
                  icon={<FilterOutlined />}
                  loading={linkingId === record._id}
                  onClick={() => handleQuickLink(record, 'lead')}
                >
                  Lead
                </Button>
              </Tooltip>
            </>
          ) : (
            <Tag color={record.crmStatus === 'linked_client' ? 'success' : 'blue'}>
              Linked
            </Tag>
          )}

          <Popconfirm
            title="Delete external contact record?"
            description="This contact entry will be removed from sync history."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record._id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
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
            Customer Sync
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            Centralized hub for website buyer checkouts, SaaS inquiries, and webform leads. Link contacts directly into ERP CRM.
          </Text>
        </div>

        <Space wrap>
          <Tooltip title="Reload contacts">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadContacts}
              loading={loading}
              aria-label="Reload customer sync"
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={handleTriggerSync}
          >
            Sync Web Contacts
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setCreateModal(true)}
          >
            Add External Contact
          </Button>
        </Space>
      </div>

      {/* KPI Tiles */}
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<UserSwitchOutlined />}
            label="Total External Contacts"
            value={stats.total}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<CustomerServiceOutlined />}
            label="Converted to Customers"
            value={stats.clients}
            color="var(--color-success-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<FilterOutlined />}
            label="Converted to Leads"
            value={stats.leads}
            color="var(--color-brand-400)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            label="Unlinked / Review Needed"
            value={stats.unlinked}
            color="var(--color-warning-500)"
          />
        </Col>
      </Row>

      {/* Main Table Container */}
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
              { label: `All Contacts (${stats.total})`, value: 'all' },
              { label: 'Store Buyers', value: 'buyers' },
              { label: 'SaaS Form Leads', value: 'forms' },
              { label: `Unlinked (${stats.unlinked})`, value: 'unlinked' },
            ]}
          />

          <Space wrap>
            <Input
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              placeholder="Search by Name, Email, Company, City..."
              style={{ width: 280 }}
            />

            <Select
              allowClear
              value={sourceFilter}
              onChange={setSourceFilter}
              placeholder="Source Channel"
              style={{ width: 180 }}
              options={[
                { label: 'Store Buyer', value: 'ecommerce_checkout' },
                { label: 'B2B SaaS Form', value: 'saas_contact_form' },
                { label: 'Demo Request', value: 'demo_request' },
                { label: 'Newsletter', value: 'newsletter' },
              ]}
            />
          </Space>
        </div>

        {/* Contacts Table */}
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filteredContacts}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} contacts & leads`,
          }}
        />
      </div>

      {/* Drawer: Contact Details */}
      <Drawer
        title="External Contact & Inquiry Details"
        width={540}
        open={detailDrawer.open}
        onClose={() => setDetailDrawer({ open: false, contact: null })}
      >
        {detailDrawer.contact && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Descriptions title="Personal & Organizational Info" bordered column={1} size="small">
              <Descriptions.Item label="Contact Name">
                {detailDrawer.contact.name}
              </Descriptions.Item>
              <Descriptions.Item label="Email Address">
                <a href={`mailto:${detailDrawer.contact.email}`}>{detailDrawer.contact.email}</a>
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {detailDrawer.contact.phone || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Company / Organization">
                {detailDrawer.contact.company || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Location">
                {[
                  detailDrawer.contact.address,
                  detailDrawer.contact.city,
                  detailDrawer.contact.country,
                ]
                  .filter(Boolean)
                  .join(', ') || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Source Platform">
                <Tag color="blue">{detailDrawer.contact.sourcePlatform}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Source Type">
                <Tag color="green">{detailDrawer.contact.sourceType}</Tag>
              </Descriptions.Item>
            </Descriptions>

            {detailDrawer.contact.message && (
              <div
                style={{
                  background: 'var(--app-surface-muted)',
                  padding: 16,
                  borderRadius: 8,
                }}
              >
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Form Inquiry / Message:
                </Text>
                <Text>{detailDrawer.contact.message}</Text>
              </div>
            )}

            <Descriptions title="E-Commerce Activity" bordered column={1} size="small">
              <Descriptions.Item label="Total Orders Placed">
                {detailDrawer.contact.totalOrders || 0}
              </Descriptions.Item>
              <Descriptions.Item label="Total Spent Amount">
                ${Number(detailDrawer.contact.totalSpent || 0).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="External Customer ID">
                {detailDrawer.contact.externalCustomerId || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="CRM Link Status">
                {crmStatusTag(detailDrawer.contact.crmStatus)}
              </Descriptions.Item>
            </Descriptions>

            {detailDrawer.contact.crmStatus === 'unlinked' && (
              <div style={{ marginTop: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 10 }}>
                  Link to ERP CRM:
                </Text>
                <Space>
                  <Button
                    type="primary"
                    icon={<CustomerServiceOutlined />}
                    onClick={() => handleQuickLink(detailDrawer.contact, 'client')}
                  >
                    Convert to Customer (Client)
                  </Button>
                  <Button
                    icon={<FilterOutlined />}
                    onClick={() => handleQuickLink(detailDrawer.contact, 'lead')}
                  >
                    Convert to CRM Lead
                  </Button>
                </Space>
              </div>
            )}
          </Space>
        )}
      </Drawer>

      {/* Modal: Add External Contact */}
      <Modal
        title="Add External Web Contact / Lead"
        open={createModal}
        onOk={handleCreateContact}
        onCancel={() => setCreateModal(false)}
        okText="Add Contact"
        width={560}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter name' }]}
              >
                <Input placeholder="e.g. Johnathan Smith" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email Address"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input placeholder="jsmith@example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Phone Number">
                <Input placeholder="+1 555-0199" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="Company Name">
                <Input placeholder="Acme Logistics LLC" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sourcePlatform"
                label="Source Platform"
                initialValue="Shopify"
              >
                <Select
                  options={[
                    { label: 'Shopify Storefront', value: 'Shopify' },
                    { label: 'WooCommerce', value: 'WooCommerce' },
                    { label: 'Webflow Landing Page', value: 'Webflow SaaS' },
                    { label: 'Custom Webhook', value: 'Custom API' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sourceType"
                label="Contact Type"
                initialValue="ecommerce_checkout"
              >
                <Select
                  options={[
                    { label: 'E-Commerce Buyer', value: 'ecommerce_checkout' },
                    { label: 'B2B SaaS Contact Form', value: 'saas_contact_form' },
                    { label: 'Demo Request', value: 'demo_request' },
                    { label: 'Newsletter Signup', value: 'newsletter' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="City">
                <Input placeholder="New York" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="country" label="Country">
                <Input placeholder="United States" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="message" label="Inquiry Notes / Request">
            <Input.TextArea rows={2} placeholder="Optional inquiry details..." />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
