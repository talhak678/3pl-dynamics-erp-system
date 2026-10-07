import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  notification,
} from 'antd';

import {
  ApartmentOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';

import WorkspaceForm from '@/forms/WorkspaceForm';
import {
  createWorkspace,
  listWorkspaces,
  updateWorkspaceStatus,
} from '@/superadmin/superAdmin.service';

const { Title, Text } = Typography;

/**
 * Workspace Management.
 *
 * The first half of the provisioning flow: a workspace is created here, and the
 * Create User form then refuses to provision an account without one. The two
 * screens are deliberately coupled - the "no workspaces yet" state below says
 * so, rather than letting a super admin discover the requirement by being
 * blocked on a different page.
 *
 * The full list is fetched, not just the active ones, so a workspace that has
 * been switched off stays visible and can be switched back on. Client-side
 * search and filtering follow the Dashboard's approach: this list grows with
 * the number of customers, not with business volume.
 */
export default function WorkspaceManagement() {
  const [form] = Form.useForm();

  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    const data = await listWorkspaces();
    // On failure errorHandler has already raised a notification, so we only need
    // to avoid rendering a stale list as though it were current.
    setWorkspaces(data?.success === true ? data.result ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      const matchesTerm =
        !term ||
        workspace.code?.toLowerCase().includes(term) ||
        workspace.name?.toLowerCase().includes(term) ||
        workspace.customerName?.toLowerCase().includes(term) ||
        workspace.customerEmail?.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? workspace.isActive : !workspace.isActive);
      return matchesTerm && matchesStatus;
    });
  }, [workspaces, search, statusFilter]);

  const openModal = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleCreate = async (values) => {
    setSubmitting(true);

    const data = await createWorkspace({
      jsonData: {
        code: values.code?.trim(),
        name: values.name?.trim(),
        customerName: values.customerName?.trim() || '',
        customerEmail: values.customerEmail?.trim() || '',
        customerPhone: values.customerPhone?.trim() || '',
      },
    });

    setSubmitting(false);

    if (data?.success === true) {
      notification.success({
        message: 'Workspace created',
        description: `${values.code} is now available when you create a user.`,
        duration: 4,
      });
      setModalOpen(false);
      form.resetFields();
      fetchWorkspaces();
      return;
    }

    // Failure needs no handling here: errorHandler has already raised a
    // notification carrying the backend's message, e.g. the 409
    // "A workspace with the code X already exists".
  };

  const handleToggleStatus = async (workspace) => {
    setTogglingId(workspace._id);

    const data = await updateWorkspaceStatus({ id: workspace._id, isActive: !workspace.isActive });

    setTogglingId(null);

    if (data?.success === true && data.result) {
      setWorkspaces((previous) =>
        previous.map((row) => (row._id === data.result._id ? { ...row, ...data.result } : row))
      );
      notification.success({
        message: data.result.isActive ? 'Workspace activated' : 'Workspace deactivated',
        description: data.result.isActive
          ? `${data.result.code} can be selected for new accounts.`
          : `${data.result.code} is hidden from the Create User dropdown. Existing accounts are unaffected.`,
        duration: 4,
      });
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text strong>{code}</Text>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Customer Name',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (value) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Customer Email',
      dataIndex: 'customerEmail',
      key: 'customerEmail',
      render: (value) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Customer Phone',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      render: (value) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) =>
        isActive ? <Tag color="green">Active</Tag> : <Tag color="default">Inactive</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, workspace) => (
        <Popconfirm
          title={workspace.isActive ? 'Deactivate this workspace?' : 'Activate this workspace?'}
          description={
            workspace.isActive
              ? 'It will no longer be selectable when creating a user. Accounts already on it are not affected.'
              : 'It will be selectable again when creating a user.'
          }
          okText={workspace.isActive ? 'Deactivate' : 'Activate'}
          cancelText="Cancel"
          onConfirm={() => handleToggleStatus(workspace)}
        >
          <Button size="small" loading={togglingId === workspace._id}>
            {workspace.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={22} style={{ width: '100%' }}>
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
            Workspace Management
          </Title>
          <Text type="secondary">
            Create a workspace first, then attach accounts to it. A user cannot be created without
            one.
          </Text>
        </div>
        <Space wrap>
          <Tooltip title="Reload the list">
            <Button icon={<ReloadOutlined />} onClick={fetchWorkspaces} loading={loading} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openModal}>
            Add New Workspace
          </Button>
        </Space>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search by code, name or customer"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ maxWidth: 340, minWidth: 220, flex: '1 1 220px' }}
        />
        <Segmented
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ]}
        />
      </div>

      <div
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          padding: 4,
        }}
      >
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: true }}
          locale={{
            emptyText: (
              <Empty
                image={<ApartmentOutlined style={{ fontSize: 40, color: 'var(--color-brand-500)' }} />}
                description={
                  workspaces.length === 0
                    ? 'No workspaces yet. Create one before creating any user.'
                    : 'No workspaces match your filters.'
                }
              >
                {workspaces.length === 0 && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openModal}>
                    Add New Workspace
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </div>

      <Modal
        open={modalOpen}
        title="Add New Workspace"
        okText="Create workspace"
        confirmLoading={submitting}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        maskClosable={!submitting}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          name="create_workspace"
          onFinish={handleCreate}
          preserve={false}
        >
          <WorkspaceForm disabled={submitting} />
        </Form>
      </Modal>
    </Space>
  );
}
