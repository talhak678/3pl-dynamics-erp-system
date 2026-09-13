import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from 'antd';

import {
  CheckCircleFilled,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopFilled,
  TeamOutlined,
} from '@ant-design/icons';

import { listUsers } from '@/superadmin/superAdmin.service';
import UserCard from '@/modules/UserModule/UserCard';
import UserManagementDrawer from '@/modules/UserModule/UserManagementDrawer';

const { Title, Text } = Typography;

function StatTile({ icon, label, value, color }) {
  return (
    <div
      style={{
        background: 'var(--app-surface)',
        border: '1px solid var(--app-border)',
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: 'var(--app-shadow)',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: 'var(--app-surface-muted)',
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {label}
        </Text>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const data = await listUsers();
    // On failure errorHandler has already raised a notification, so we only need
    // to avoid rendering a stale list as though it were current.
    setUsers(data?.success === true ? data.result ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.isActive).length,
      suspended: users.filter((user) => !user.isActive).length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesTerm =
        !term ||
        user.name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? user.isActive : !user.isActive);
      return matchesTerm && matchesStatus;
    });
  }, [users, search, statusFilter]);

  const openDrawer = (user) => {
    setSelectedUser(user);
    setDrawerOpen(true);
  };

  // Keep both the grid and the open drawer in step after a status or permission
  // change, so closing the drawer never reveals a stale card.
  const handleUpdated = (updated) => {
    setUsers((previous) =>
      previous.map((user) => (user._id === updated._id ? { ...user, ...updated } : user))
    );
    setSelectedUser((previous) =>
      previous && previous._id === updated._id ? { ...previous, ...updated } : previous
    );
  };

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
            Users
          </Title>
          <Text type="secondary">
            Every tenant account on this deployment. Open a card to manage access.
          </Text>
        </div>
        <Space wrap>
          <Tooltip title="Reload the list">
            <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create-user')}>
            Create User
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <StatTile
            icon={<TeamOutlined />}
            label="Total accounts"
            value={stats.total}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatTile
            icon={<CheckCircleFilled />}
            label="Active"
            value={stats.active}
            color="var(--color-success-500)"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatTile
            icon={<StopFilled />}
            label="Suspended"
            value={stats.suspended}
            color="var(--color-error-500)"
          />
        </Col>
      </Row>

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
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ maxWidth: 320, minWidth: 220, flex: '1 1 220px' }}
        />
        <Segmented
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Suspended', value: 'suspended' },
          ]}
        />
      </div>

      {loading && users.length === 0 ? (
        <Row gutter={[16, 16]}>
          {[0, 1, 2, 3].map((key) => (
            <Col xs={24} sm={12} lg={8} xxl={6} key={key}>
              <div
                style={{
                  background: 'var(--app-surface)',
                  border: '1px solid var(--app-border)',
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <Skeleton active avatar paragraph={{ rows: 2 }} />
              </div>
            </Col>
          ))}
        </Row>
      ) : filteredUsers.length === 0 ? (
        <div
          style={{
            background: 'var(--app-surface)',
            border: '1px solid var(--app-border)',
            borderRadius: 12,
            padding: '48px 24px',
          }}
        >
          <Empty
            description={
              users.length === 0
                ? 'No accounts yet. Create the first tenant account to get started.'
                : 'No accounts match your filters.'
            }
          >
            {users.length === 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/create-user')}
              >
                Create User
              </Button>
            )}
          </Empty>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredUsers.map((user) => (
            <Col xs={24} sm={12} lg={8} xxl={6} key={user._id}>
              <UserCard user={user} onOpen={openDrawer} />
            </Col>
          ))}
        </Row>
      )}

      <UserManagementDrawer
        open={drawerOpen}
        user={selectedUser}
        onClose={() => setDrawerOpen(false)}
        onUpdated={handleUpdated}
      />
    </Space>
  );
}
