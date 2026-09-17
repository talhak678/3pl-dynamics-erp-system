import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  Button,
  Col,
  Empty,
  Input,
  Modal,
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

import { request } from '@/request';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { grantableFor } from '@/utils/erpModules';

import MemberCard from './components/MemberCard';
import MemberFormDrawer from './components/MemberFormDrawer';

const { Title, Text } = Typography;

/**
 * One figure in the summary row.
 *
 * Deliberately identical to the Super Admin panel's StatTile, down to the
 * inline styles. It is copied rather than shared because the two are separate
 * Vite builds with no common module - this app cannot import from superadmin/src
 * - and the two panels sit side by side in the product, so a visual drift
 * between them would read as a bug.
 *
 * The colours and surfaces come from theme.css, which both apps define, so the
 * tile follows the light/dark switch rather than hard-coding a palette.
 */
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

/**
 * The people who work in this workspace, and the ways in to manage them.
 *
 * The layout mirrors the Super Admin panel's Users page - summary row, search
 * and status filter, card grid - because both screens manage the same kind of
 * record and a tenant admin should not have to learn a second visual language
 * for it.
 *
 * The whole page is gated twice over: the sidebar entry only renders for an
 * owner, the route only resolves for an owner, and every endpoint behind it
 * refuses anyone else. This component can therefore assume the viewer owns the
 * workspace - but it does not assume it for anything that matters, because the
 * server re-derives all of it from the token rather than from anything sent
 * from here.
 *
 * Labels are written as plain strings rather than passed through
 * useLanguage(). That helper does not consult the translation map - its lookup
 * line is commented out and nothing imports en_us at runtime - so it simply
 * Title-Cases whatever it is given, which would render the search placeholder as
 * "Search By Name Or Email". The Super Admin page hard-codes its strings for the
 * same reason, so this also keeps the two screens word-for-word identical.
 */
export default function UserManagementModule() {
  const currentAdmin = useSelector(selectCurrentAdmin);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // The modules this owner may hand out. Computed from the signed-in account
  // rather than fetched, because the login payload already carries the resolved
  // list - and the server re-checks it on write regardless.
  const grantable = useMemo(() => grantableFor(currentAdmin), [currentAdmin]);

  const loadMembers = useCallback(async () => {
    setLoading(true);

    try {
      const data = await request.team.list();

      // The request layer returns its own failure shape rather than throwing,
      // so the array is checked rather than assumed.
      setMembers(Array.isArray(data?.result) ? data.result : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Counted over every member, not the filtered set: these describe the
  // workspace, so typing in the search box must not appear to change how many
  // accounts exist.
  const stats = useMemo(
    () => ({
      total: members.length,
      active: members.filter((member) => member.isActive).length,
      suspended: members.filter((member) => !member.isActive).length,
    }),
    [members]
  );

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return members.filter((member) => {
      // Surname is included even though the placeholder only promises name and
      // email: a user typing a surname is asking a reasonable question, and
      // "no results" would be the wrong answer to it.
      const haystack = `${member.name ?? ''} ${member.surname ?? ''} ${member.email ?? ''}`;
      const matchesTerm = !term || haystack.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? member.isActive : !member.isActive);

      return matchesTerm && matchesStatus;
    });
  }, [members, search, statusFilter]);

  const openCreate = () => {
    setSelected(null);
    setDrawerOpen(true);
  };

  const openEdit = (member) => {
    setSelected(member);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (submitting) return;
    setDrawerOpen(false);
    setSelected(null);
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);

    try {
      const data = selected
        ? await request.team.update({ id: selected._id, jsonData: payload })
        : await request.team.create({ jsonData: payload });

      // A refused module grant is the interesting failure here, and the server
      // explains which module was refused. The request layer has already shown
      // a generic notice by this point, so this only closes the drawer when the
      // save genuinely succeeded.
      if (data?.success) {
        setDrawerOpen(false);
        setSelected(null);
        await loadMembers();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!selected) return;

    const name = [selected.name, selected.surname].filter(Boolean).join(' ');

    Modal.confirm({
      title: 'Remove this user?',
      content: `${name} will lose access immediately. Records they created stay in your workspace.`,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        const data = await request.team.remove({ id: selected._id });

        if (data?.success) {
          setDrawerOpen(false);
          setSelected(null);
          await loadMembers();
        }
      },
    });
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
            User Management
          </Title>
          <Text type="secondary">
            Everyone with access to your workspace. Open a card to manage their access.
          </Text>
        </div>
        <Space wrap>
          <Tooltip title="Reload the list">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadMembers}
              loading={loading}
              aria-label="Reload the list"
            />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
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

      {loading && members.length === 0 ? (
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
      ) : filteredMembers.length === 0 ? (
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
              // Two different situations wear the same empty box: a workspace
              // with nobody in it needs an invitation to start, one whose
              // filters matched nothing needs to say so rather than implying
              // the accounts are gone.
              members.length === 0
                ? 'No users yet. Create the first user to give a colleague access.'
                : 'No users match your filters.'
            }
          >
            {members.length === 0 && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Create User
              </Button>
            )}
          </Empty>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredMembers.map((member) => (
            <Col key={member._id} xs={24} sm={12} lg={8} xxl={6}>
              <MemberCard member={member} onOpen={openEdit} />
            </Col>
          ))}
        </Row>
      )}

      <MemberFormDrawer
        open={drawerOpen}
        member={selected}
        grantable={grantable}
        submitting={submitting}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </Space>
  );
}
