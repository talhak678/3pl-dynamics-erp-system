import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Select,
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

import { listUsers, listWorkspaces } from '@/superadmin/superAdmin.service';
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

  /*
   * The workspace filter, held as the workspace's id - or `undefined`, which is
   * what the Select hands back when its clear button is used and what the
   * service reads as "send no filter".
   *
   * This one is applied by the server and the search and status filters below
   * are applied here, which is a real difference rather than an oversight.
   * Search and status refine a list the page already has; the workspace decides
   * which rows the page is even about, and asking the server for one workspace's
   * accounts is what stops the whole deployment's accounts crossing the wire
   * for a browser-side pass to discard most of them.
   */
  const [workspaceFilter, setWorkspaceFilter] = useState(undefined);

  // The options for that dropdown. Fetched with no `activeOnly`, unlike the
  // Create User form: an account on a workspace that has since been switched off
  // still exists and still needs to be findable here. This page manages
  // accounts, so it must be able to show the ones whose workspace is inactive -
  // that is exactly the case an operator comes looking for.
  const [workspaces, setWorkspaces] = useState([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    // The id, or nothing at all when the dropdown is cleared. Passing the
    // object through rather than branching here keeps the "no selection means
    // no parameter" decision in the service, which is where the URL is built.
    const data = await listUsers({ workspace: workspaceFilter });
    // On failure errorHandler has already raised a notification, so we only need
    // to avoid rendering a stale list as though it were current.
    setUsers(data?.success === true ? data.result ?? [] : []);
    setLoading(false);
  }, [workspaceFilter]);

  const fetchWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true);
    const data = await listWorkspaces();
    setWorkspaces(data?.success === true ? data.result ?? [] : []);
    setWorkspacesLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // What the dropdown's value means on screen. Resolved from the options rather
  // than fetched, so the captions below never have to wait on a second request.
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace._id === workspaceFilter) || null,
    [workspaces, workspaceFilter]
  );

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

  /*
   * What to say when the grid has nothing in it. These are three genuinely
   * different situations and the order below is what tells them apart: saying
   * "No accounts yet" over a workspace that is simply empty would send the
   * reader off to create an account that already exists somewhere else, and
   * saying it when their own search removed every row would read as the list
   * having been lost.
   */
  const emptyDescription = useMemo(() => {
    // Accounts came back, so the grid is empty because the search and status
    // filters removed everything - which is the reader's own doing and is
    // undone by clearing them.
    if (users.length > 0) return 'No accounts match your filters.';

    // Nothing came back, and a workspace was asked for, so that workspace has
    // no accounts. Not the same as the deployment having none.
    if (selectedWorkspace) return `No accounts in ${selectedWorkspace.name} yet.`;

    return 'No accounts yet. Create the first tenant account to get started.';
  }, [users.length, selectedWorkspace]);

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
          {/*
            Names the scope, because the workspace filter narrows what this page
            is about rather than just what is listed: the tiles below count the
            accounts that came back, so with a workspace selected they describe
            that workspace and not the deployment. Saying "every tenant account"
            over three tiles reading 2 would be the page contradicting itself.
          */}
          <Text type="secondary">
            {selectedWorkspace
              ? `Accounts in ${selectedWorkspace.name}. Open a card to manage access.`
              : 'Every tenant account on this deployment. Open a card to manage access.'}
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
        {/*
          The search box and the workspace dropdown are one group; the status
          tabs are the other. Left as three siblings under space-between the
          dropdown would sit centred between them, halfway across the row from
          the box it is meant to sit beside - so the two that narrow the list
          travel together on the left.
        */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            flex: '1 1 420px',
            minWidth: 0,
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
          {/*
            No explicit size on this or the input above, so both take antd's
            default control height and line up on the row's centred baseline
            without either being nudged to meet the other.

            Options are fetched with no `activeOnly`, unlike the Create User
            form. That form must not offer an inactive workspace, because it is
            about to attach a new account to one. This is a filter, and the
            accounts on a workspace that has since been switched off are exactly
            what an operator comes to this page to find - deactivating a
            workspace stops new accounts being created against it, it does not
            hide the ones already there.
          */}
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            loading={workspacesLoading}
            value={workspaceFilter}
            onChange={setWorkspaceFilter}
            placeholder="All workspaces"
            notFoundContent={<Text type="secondary">No workspaces yet</Text>}
            style={{ minWidth: 200, maxWidth: 280 }}
            options={workspaces.map((workspace) => ({
              value: workspace._id,
              // Searched against, so it carries both halves of what is on
              // screen - the code identifies the workspace and the name says
              // whose it is.
              label: `${workspace.code} — ${workspace.name}`,
            }))}
          />
        </div>
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
          <Empty description={emptyDescription}>
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
