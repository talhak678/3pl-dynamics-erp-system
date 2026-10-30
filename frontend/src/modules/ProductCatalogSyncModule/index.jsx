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
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  SyncOutlined,
  TagOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { request } from '@/request';
import StatTile from '@/components/StatTile';

const { Title, Text } = Typography;

export default function ProductCatalogSyncModule() {
  const [products, setProducts] = useState([]);
  const [syncRecords, setSyncRecords] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [syncingId, setSyncingId] = useState(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState(undefined);

  const [editModal, setEditModal] = useState({ open: false, item: null });
  const [form] = Form.useForm();

  // Load products, sync records, and stores
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch ERP Products
      let pData = await request.listAll({ entity: 'product' });
      let pList = Array.isArray(pData?.result) ? pData.result : [];

      // If no products in ERP yet, create seed starter products
      if (pList.length === 0) {
        const seed1 = await request.create({
          entity: 'product',
          jsonData: {
            name: 'Industrial Pallet Jack 2500kg',
            title: 'Heavy Duty Manual Pallet Jack',
            number: 101,
            price: 349.0,
            currency: 'USD',
            coverImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80',
            description: 'Rugged hydraulic warehouse pallet truck with polyurethane wheels.',
          },
        });
        const seed2 = await request.create({
          entity: 'product',
          jsonData: {
            name: 'Bluetooth Barcode Scanner',
            title: 'Wireless 2D Handheld Scanner',
            number: 102,
            price: 129.5,
            currency: 'USD',
            coverImage: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=400&q=80',
            description: 'High-speed long-range inventory scanning with USB cradle.',
          },
        });
        const seed3 = await request.create({
          entity: 'product',
          jsonData: {
            name: 'Thermal Shipping Label Printer',
            title: '4x6 Direct Thermal Printer',
            number: 103,
            price: 219.0,
            currency: 'USD',
            coverImage: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=400&q=80',
            description: 'Commercial 300dpi label printing compatible with Shopify and USPS.',
          },
        });
        const seed4 = await request.create({
          entity: 'product',
          jsonData: {
            name: 'Warehouse Safety Vest Pack (10pcs)',
            title: 'High-Vis Class 2 Safety Vests',
            number: 104,
            price: 59.0,
            currency: 'USD',
            coverImage: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=400&q=80',
            description: 'Fluorescent yellow with reflective strips for logistics personnel.',
          },
        });
        pList = [seed1?.result, seed2?.result, seed3?.result, seed4?.result].filter(Boolean);
      }

      // 2. Fetch Website Config Stores
      const sData = await request.listAll({ entity: 'websiteconfig' });
      const sList = Array.isArray(sData?.result) ? sData.result : [];
      setStores(sList);

      // 3. Fetch ProductSync tracking items
      const syncData = await request.listAll({ entity: 'productsync' });
      let syncList = Array.isArray(syncData?.result) ? syncData.result : [];

      // Link or generate sync records for ERP products
      if (syncList.length === 0 && pList.length > 0) {
        const defaultStore = sList[0];
        for (let i = 0; i < pList.length; i++) {
          const p = pList[i];
          const isPending = i === pList.length - 1; // leave last item pending
          const newSync = await request.create({
            entity: 'productsync',
            jsonData: {
              product: p._id,
              websiteConfig: defaultStore?._id || null,
              externalProductId: `SP-${1000 + i}`,
              externalHandle: (p.name || 'item').toLowerCase().replace(/\s+/g, '-'),
              syncStatus: isPending ? 'pending' : 'synced',
              lastSyncDate: isPending ? null : new Date(),
              externalPrice: p.price,
              stockQuantity: p.number ? p.number * 2 : 24,
              autoSync: true,
            },
          });
          if (newSync?.success && newSync.result) {
            syncList.push(newSync.result);
          }
        }
      }

      setProducts(pList);
      setSyncRecords(syncList);
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combined product + sync state
  const tableData = useMemo(() => {
    return products.map((prod) => {
      const sync = syncRecords.find(
        (s) => s.product?._id === prod._id || s.product === prod._id
      );
      return {
        key: prod._id,
        _id: prod._id,
        product: prod,
        name: prod.name,
        price: prod.price,
        currency: prod.currency || 'USD',
        stock: prod.number || 20,
        coverImage: prod.coverImage || prod.photo,
        syncStatus: sync?.syncStatus || 'not_synced',
        externalPrice: sync?.externalPrice ?? prod.price,
        externalProductId: sync?.externalProductId || '—',
        externalHandle: sync?.externalHandle || '',
        lastSyncDate: sync?.lastSyncDate,
        syncRecord: sync,
        websiteConfig: sync?.websiteConfig || stores[0],
      };
    });
  }, [products, syncRecords, stores]);

  // Statistics
  const stats = useMemo(() => {
    const total = tableData.length;
    const synced = tableData.filter((i) => i.syncStatus === 'synced').length;
    const pending = tableData.filter((i) => i.syncStatus === 'pending' || i.syncStatus === 'not_synced').length;
    const failed = tableData.filter((i) => i.syncStatus === 'failed').length;
    return { total, synced, pending, failed };
  }, [tableData]);

  // Filtered rows
  const filteredData = useMemo(() => {
    return tableData.filter((item) => {
      // Tab filter
      if (activeTab === 'synced' && item.syncStatus !== 'synced') return false;
      if (activeTab === 'pending' && (item.syncStatus !== 'pending' && item.syncStatus !== 'not_synced')) return false;
      if (activeTab === 'failed' && item.syncStatus !== 'failed') return false;

      // Store filter
      if (storeFilter && item.websiteConfig?._id !== storeFilter) return false;

      // Search
      if (search) {
        const query = search.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(query);
        const matchesExtId = item.externalProductId?.toLowerCase().includes(query);
        if (!matchesName && !matchesExtId) return false;
      }

      return true;
    });
  }, [tableData, activeTab, storeFilter, search]);

  // Sync individual product
  const handleSingleSync = async (record) => {
    setSyncingId(record._id);
    try {
      await request.ecommerce.syncProducts({
        productIds: [record._id],
        websiteConfigId: record.websiteConfig?._id,
      });
      loadData();
    } finally {
      setSyncingId(null);
    }
  };

  // Bulk sync selected or all
  const handleBulkSync = async (all = false) => {
    setBulkSyncing(true);
    try {
      await request.ecommerce.syncProducts({
        productIds: all ? [] : selectedRowKeys,
        syncAll: all,
      });
      setSelectedRowKeys([]);
      loadData();
    } finally {
      setBulkSyncing(false);
    }
  };

  // Save product sync mapping modal
  const handleSaveMapping = async () => {
    try {
      const values = await form.validateFields();
      if (editModal.item?.syncRecord?._id) {
        await request.update({
          entity: 'productsync',
          id: editModal.item.syncRecord._id,
          jsonData: values,
        });
      } else {
        await request.create({
          entity: 'productsync',
          jsonData: {
            product: editModal.item._id,
            ...values,
            syncStatus: 'synced',
            lastSyncDate: new Date(),
          },
        });
      }
      setEditModal({ open: false, item: null });
      loadData();
    } catch {
      // validation error
    }
  };

  // Open Edit Mapping
  const openEdit = (record) => {
    setEditModal({ open: true, item: record });
    form.setFieldsValue({
      externalPrice: record.externalPrice,
      externalProductId: record.externalProductId !== '—' ? record.externalProductId : '',
      externalHandle: record.externalHandle,
      autoSync: record.syncRecord?.autoSync ?? true,
      websiteConfig: record.websiteConfig?._id || stores[0]?._id,
    });
  };

  const statusTag = (status) => {
    switch (status) {
      case 'synced':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Synced
          </Tag>
        );
      case 'pending':
        return (
          <Tag color="warning" icon={<ClockCircleOutlined />}>
            Pending Sync
          </Tag>
        );
      case 'failed':
        return (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Failed
          </Tag>
        );
      default:
        return (
          <Tag color="default">
            Not Synced
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: 'Product Information',
      key: 'product',
      width: 320,
      render: (_, record) => (
        <Space size={14} align="center">
          <Avatar
            shape="square"
            size={52}
            src={record.coverImage}
            icon={<AppstoreOutlined />}
            style={{ borderRadius: 8, background: 'var(--app-surface-muted)', flexShrink: 0 }}
          />
          <div>
            <Text strong style={{ fontSize: 14, display: 'block' }}>
              {record.name}
            </Text>
            <Space size={6} wrap style={{ marginTop: 2 }}>
              <Tag style={{ marginInlineEnd: 0, fontSize: 11 }}>
                ERP ID: #{record._id.slice(-5)}
              </Tag>
              {record.externalHandle && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  /{record.externalHandle}
                </Text>
              )}
            </Space>
          </div>
        </Space>
      ),
    },
    {
      title: 'ERP Price',
      dataIndex: 'price',
      width: 130,
      render: (price, record) => (
        <Text strong style={{ fontSize: 14 }}>
          ${Number(price || 0).toFixed(2)} {record.currency}
        </Text>
      ),
    },
    {
      title: 'Store Price',
      dataIndex: 'externalPrice',
      width: 140,
      render: (extPrice, record) => {
        const isDiff = extPrice && extPrice !== record.price;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 14, color: isDiff ? 'var(--color-brand-500)' : 'inherit' }}>
              ${Number(extPrice || record.price || 0).toFixed(2)}
            </Text>
            {isDiff && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                (Custom Markup)
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Inventory Stock',
      dataIndex: 'stock',
      width: 140,
      render: (stock) => (
        <Space size={6} align="center">
          <Badge status={stock > 10 ? 'success' : stock > 0 ? 'warning' : 'error'} />
          <Text strong>{stock}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            units
          </Text>
        </Space>
      ),
    },
    {
      title: 'Target Store',
      key: 'store',
      width: 160,
      render: (_, record) => (
        <Space size={6}>
          <ShopOutlined style={{ color: 'var(--app-primary)' }} />
          <Text style={{ fontSize: 13 }}>
            {record.websiteConfig?.name || stores[0]?.name || 'Shopify Store'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Sync Status',
      dataIndex: 'syncStatus',
      width: 140,
      render: (status) => statusTag(status),
    },
    {
      title: 'Last Synced',
      dataIndex: 'lastSyncDate',
      width: 160,
      render: (date) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {date ? dayjs(date).format('YYYY-MM-DD HH:mm') : 'Never'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={6}>
          <Tooltip title="Push update to external webstore">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<SyncOutlined />}
              loading={syncingId === record._id}
              onClick={() => handleSingleSync(record)}
            >
              Sync
            </Button>
          </Tooltip>
          <Tooltip title="Configure Price & Field Mapping">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
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
            Product Catalog Sync
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            Synchronize ERP product details, pricing rules, live warehouse stock levels, and media with external webstores.
          </Text>
        </div>

        <Space wrap>
          <Tooltip title="Reload product sync status">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              aria-label="Reload products"
            />
          </Tooltip>
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={bulkSyncing}
              onClick={() => handleBulkSync(false)}
            >
              Sync Selected ({selectedRowKeys.length})
            </Button>
          )}
          <Button
            type="primary"
            icon={<SyncOutlined />}
            loading={bulkSyncing}
            onClick={() => handleBulkSync(true)}
          >
            Sync All Products
          </Button>
        </Space>
      </div>

      {/* KPI Tiles */}
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<AppstoreOutlined />}
            label="Total ERP Products"
            value={stats.total}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<CheckCircleOutlined />}
            label="Synced with Webstore"
            value={stats.synced}
            color="var(--color-success-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            label="Pending / Unsynced"
            value={stats.pending}
            color="var(--color-warning-500)"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatTile
            icon={<ExclamationCircleOutlined />}
            label="Sync Errors"
            value={stats.failed}
            color="var(--color-error-500)"
          />
        </Col>
      </Row>

      {/* Catalog Table Container */}
      <div
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          padding: 20,
          boxShadow: 'var(--app-shadow)',
        }}
      >
        {/* Toolbar & Filter Controls */}
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
              { label: `All Items (${stats.total})`, value: 'all' },
              { label: `Synced (${stats.synced})`, value: 'synced' },
              { label: `Pending (${stats.pending})`, value: 'pending' },
              { label: `Errors (${stats.failed})`, value: 'failed' },
            ]}
          />

          <Space wrap>
            <Input
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              placeholder="Search products or SKU..."
              style={{ width: 230 }}
            />

            <Select
              allowClear
              value={storeFilter}
              onChange={setStoreFilter}
              placeholder="Filter by Store"
              style={{ width: 190 }}
              options={stores.map((s) => ({ label: s.name, value: s._id }))}
            />
          </Space>
        </div>

        {/* Products Table */}
        <Table
          rowKey="_id"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} inventory items`,
          }}
        />
      </div>

      {/* Modal: Edit Product Sync Mapping */}
      <Modal
        title={`Configure Webstore Sync: ${editModal.item?.name || 'Product'}`}
        open={editModal.open}
        onOk={handleSaveMapping}
        onCancel={() => setEditModal({ open: false, item: null })}
        okText="Save Mapping"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="ERP Price">
              ${Number(editModal.item?.price || 0).toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="Stock Count">
              {editModal.item?.stock || 0} units
            </Descriptions.Item>
          </Descriptions>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="externalPrice"
                label="Store Price ($ USD)"
                rules={[{ required: true, message: 'Please enter store price' }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="websiteConfig" label="Target E-Commerce Store">
                <Select
                  options={stores.map((s) => ({ label: s.name, value: s._id }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="externalProductId" label="External Store Product ID">
                <Input placeholder="e.g. SP-9842" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="externalHandle" label="Webstore URL Handle">
                <Input placeholder="e.g. smart-tracker-v2" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="autoSync" valuePropName="checked" label="Automatic Inventory Sync">
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -14 }}>
            When enabled, changes to ERP inventory will automatically push live stock updates to your external storefront.
          </Text>
        </Form>
      </Modal>
    </Space>
  );
}
