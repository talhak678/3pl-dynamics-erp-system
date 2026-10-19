import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  Alert,
  Button,
  Col,
  Popconfirm,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import {
  AimOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  LineChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';

import { request } from '@/request';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { selectDateRangeDescription, selectDateRangeQuery } from '@/redux/dateRange/selectors';
import StatTile from '@/components/StatTile';
import { useMoney } from '@/settings';
import useAssigneeDirectory from '@/hooks/useAssigneeDirectory';

import TargetFormModal from './components/TargetFormModal';

const { Title, Text } = Typography;

const STATUS_META = {
  exceeded: { label: 'Exceeded', color: 'green', progress: 'success' },
  'on-track': { label: 'On track', color: 'blue', progress: 'normal' },
  'at-risk': { label: 'At risk', color: 'orange', progress: 'exception' },
  missed: { label: 'Missed', color: 'red', progress: 'exception' },
  upcoming: { label: 'Upcoming', color: 'default', progress: 'normal' },
};

const statusOf = (value) => STATUS_META[value] || STATUS_META['on-track'];

/**
 * Sales Targets.
 *
 * The stored document holds the commitment; the achieved figure never does. Each
 * row arrives with `achieved`, `progress`, `daysRemaining` and `status` already
 * computed by the server from the workspace's invoices, orders and won leads
 * inside the target's own period. That is what makes the screen impossible to
 * drift: there is no second copy of the actuals to update, and no nightly job to
 * forget.
 *
 * The header window decides which target CARDS are listed (the server windows
 * them on `created`); each target's startDate/endDate decides which records count
 * toward it. Those are deliberately separate questions.
 *
 * Only the workspace owner can create, edit or remove a target - a target is a
 * commitment the Customer Admin publishes. A child account may read the
 * company-wide targets and its own; the server enforces that narrowing and this
 * screen simply does not render the controls it could not use.
 */
export default function SalesTargetModule() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const dateQuery = useSelector(selectDateRangeQuery);
  const dateDescription = useSelector(selectDateRangeDescription);

  const { startDate, endDate } = dateQuery;

  const { moneyFormatter } = useMoney();

  const isOwner = currentAdmin?.role === 'owner' && currentAdmin?.isSuperAdmin !== true;

  const { directory } = useAssigneeDirectory({ enabled: isOwner, currentAdmin });

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const money = useCallback((amount) => moneyFormatter({ amount: Number(amount) || 0 }), [moneyFormatter]);

  const assigneeName = useCallback(
    (assignee) => {
      if (!assignee) return 'Company-wide';
      const id = String(assignee);
      const person = (directory ?? []).find((member) => member.id === id);
      if (person) return person.name;
      if (String(currentAdmin?._id) === id) return 'You';
      return directory === null ? 'A colleague' : 'Removed user';
    },
    [directory, currentAdmin]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    try {
      const data = await request.listAll({ entity: 'salestarget', options: dateQuery });

      if (data?.success) {
        setItems(Array.isArray(data.result) ? data.result : []);
        setSummary(data.summary ?? null);
      } else {
        setFailed(true);
        setItems([]);
        setSummary(null);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (target) => {
    setEditing(target);
    setModalOpen(true);
  };

  const submit = async (values) => {
    setSubmitting(true);

    try {
      const data = editing
        ? await request.update({ entity: 'salestarget', id: editing._id, jsonData: values })
        : await request.create({ entity: 'salestarget', jsonData: values });

      if (data?.success) {
        setModalOpen(false);
        setEditing(null);
        // The banner and every card are derived from the same list; refetching
        // is what keeps "Overall achievement" from counting a target the table
        // no longer shows.
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (target) => {
    setBusyId(target._id);

    try {
      const data = await request.delete({ entity: 'salestarget', id: target._id });

      if (data?.success) {
        setItems((current) => current.filter((item) => item._id !== target._id));
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const overall = useMemo(() => {
    if (!summary) return 0;
    return Math.round((summary.overallAchievement || 0) * 10) / 10;
  }, [summary]);

  const columns = [
    {
      title: 'Target',
      dataIndex: 'title',
      width: 260,
      render: (value, record) => (
        <div
          style={{
            minWidth: 0,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
        >
          <Text strong style={{ display: 'block', whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {value}
          </Text>
          {/* The period sits on its own line, and the Tag below it rather than
              beside it: inline, the date ran under the adjacent Type column
              whenever a title wrapped. */}
          <Text
            type="secondary"
            style={{ display: 'block', fontSize: 12, whiteSpace: 'normal' }}
          >
            {dayjs(record.startDate).format('DD MMM YYYY')} -{' '}
            {dayjs(record.endDate).format('DD MMM YYYY')}
          </Text>
          <Tag style={{ marginInlineStart: 0, marginTop: 4 }}>{record.period}</Tag>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 110,
      render: (value) => (
        <Tag color={value === 'Revenue' ? 'blue' : 'purple'}>{value}</Tag>
      ),
    },
    {
      title: 'Assignee',
      dataIndex: 'assignee',
      width: 170,
      render: (value) => (
        <Space size={6}>
          <TeamOutlined style={{ color: 'var(--app-text-secondary)' }} />
          <Text>{assigneeName(value)}</Text>
        </Space>
      ),
    },
    {
      title: 'Target',
      dataIndex: 'targetValue',
      width: 150,
      align: 'right',
      render: (value, record) => (
        <Text strong>
          {record.type === 'Deals' ? `${value} deals` : money(value)}
        </Text>
      ),
    },
    {
      title: 'Achieved',
      dataIndex: 'achieved',
      width: 150,
      align: 'right',
      render: (value, record) => (
        <div>
          <Text>{record.type === 'Deals' ? `${value} deals` : money(value)}</Text>
          {record.type === 'Revenue' && record.orderRevenue > 0 && (
            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
              Orders: {money(record.orderRevenue)}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 220,
      render: (_, record) => {
        const meta = statusOf(record.status);
        return (
          <Tooltip title={`${record.elapsedPct}% of the period has elapsed`}>
            <Progress
              percent={Math.min(Math.round(record.progress || 0), 100)}
              status={meta.progress}
              format={() => `${Math.round(record.progress || 0)}%`}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Days left',
      dataIndex: 'daysRemaining',
      width: 100,
      align: 'center',
      render: (value) => <Text>{value}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (value) => {
        const meta = statusOf(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
  ];

  if (isOwner) {
    columns.push({
      title: 'Actions',
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              loading={busyId === record._id}
              onClick={() => openEdit(record)}
              aria-label="Edit target"
            />
          </Tooltip>
          <Popconfirm
            title="Remove this target?"
            description="The target disappears; the invoices and orders behind it are untouched."
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove(record)}
          >
            <Tooltip title="Remove">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label="Remove target"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    });
  }

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
            Sales Targets
          </Title>
          <Text type="secondary" style={{ display: 'block' }}>
            Commitments by period, measured against the invoices and deals they produced.
          </Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12.5 }}>
            Showing {dateDescription}
          </Text>
        </div>

        <Space wrap>
          <Tooltip title="Reload targets">
            <Button
              icon={<ReloadOutlined />}
              onClick={load}
              loading={loading}
              aria-label="Reload targets"
            />
          </Tooltip>
          {isOwner && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              New Target
            </Button>
          )}
        </Space>
      </div>

      {failed && (
        <Alert
          type="error"
          showIcon
          message="Could not load sales targets"
          description="The targets could not be read. Reload to try again; if it keeps failing, your access to the Sales Targets module may have changed."
        />
      )}

      {!isOwner && (
        <Alert
          type="info"
          showIcon
          message="Read-only view"
          description="Targets are published by the workspace owner. You are seeing the company-wide targets and the ones assigned to you."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={4}>
          <StatTile
            icon={<AimOutlined />}
            label="Total target revenue"
            value={money(summary?.totalTargetRevenue)}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatTile
            icon={<DollarOutlined />}
            label="Achieved revenue"
            value={money(summary?.achievedRevenue)}
            color="var(--color-success-500)"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatTile
            icon={<TrophyOutlined />}
            label="Revenue achievement"
            value={`${overall}%`}
            color="var(--color-warning-500)"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatTile
            icon={<LineChartOutlined />}
            label="Remaining revenue gap"
            value={money(summary?.remainingGap)}
            color="var(--color-error-500)"
          />
        </Col>
        {/* Deals are a count, not money. Showing them beside the revenue tiles -
            rather than in a footnote - is what stops a deals-only workspace
            reading four PKR 0.00 cards and concluding nothing is set. */}
        <Col xs={24} sm={12} xl={4}>
          <StatTile
            icon={<TeamOutlined />}
            label="Deals target"
            value={`${summary?.totalDealsTarget ?? 0} deals`}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatTile
            icon={<CheckCircleOutlined />}
            label="Deals achieved"
            value={`${summary?.achievedDeals ?? 0} deals`}
            color="var(--color-success-500)"
          />
        </Col>
      </Row>

      {summary && (summary.totalDealsTarget > 0 || summary.exceeded > 0 || summary.atRisk > 0) && (
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          <CalendarOutlined style={{ marginInlineEnd: 6 }} />
          Revenue and deals are tracked separately - they are different units and are never added
          together.
          {'  '}
          {summary.exceeded > 0 && <Tag color="green">{summary.exceeded} exceeded</Tag>}
          {summary.atRisk > 0 && <Tag color="orange">{summary.atRisk} at risk</Tag>}
        </Text>
      )}

      <div
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          padding: 16,
          boxShadow: 'var(--app-shadow)',
        }}
      >
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            hideOnSinglePage: false,
            showTotal: (total) => `${total} targets`,
          }}
        />
      </div>

      <TargetFormModal
        open={modalOpen}
        target={editing}
        directory={directory}
        submitting={submitting}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={submit}
      />
    </Space>
  );
}
