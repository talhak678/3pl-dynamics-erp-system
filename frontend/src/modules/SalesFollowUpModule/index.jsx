import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  Alert,
  Button,
  Col,
  Input,
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
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FieldTimeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ScheduleOutlined,
  UserOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';

import { request } from '@/request';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { selectDateRangeDescription, selectDateRangeQuery } from '@/redux/dateRange/selectors';
import StatTile from '@/components/StatTile';
import FollowUpModal, { FOLLOW_UP_CHANNELS } from '@/components/FollowUpModal';
import { hasModule } from '@/utils/modulePermissions';
import { stageOf } from '@/utils/salesStages';

const { Title, Text } = Typography;

const CHANNEL_COLORS = {
  Call: 'blue',
  Email: 'geekblue',
  Meeting: 'purple',
  WhatsApp: 'green',
  SMS: 'orange',
  Visit: 'cyan',
  Other: 'default',
};

const isToday = (value) => dayjs(value).isSame(dayjs(), 'day');
const isOverdue = (item) => !item.completed && dayjs(item.date).isBefore(dayjs(), 'day');
const isUpcoming = (item) => !item.completed && dayjs(item.date).isAfter(dayjs(), 'day');
const isDueToday = (item) => !item.completed && isToday(item.date);

/**
 * The Sales Follow-ups module.
 *
 * Every row is a FollowUp document - the same collection the pipeline board's
 * per-lead drawer reads and writes. There is no second copy and no local cache:
 * `Lead.followUpDate`, which the board draws on its cards, is maintained by the
 * server as a cache of the earliest pending follow-up, so a change made here is
 * visible there after the board reloads and vice versa. See
 * backend/.../followUpController/syncLeadFollowUp.js.
 *
 * The header's global window is sent with the list request and the server
 * measures each follow-up's own DUE date. That makes the window mean "what is
 * due in this range", which is what the Today/Overdue/Upcoming tabs are reading
 * too. The window can only narrow the tenant-scoped list; it can never widen it.
 *
 * Leads and customers are fetched only when the account holds the module that
 * owns them. A user granted Sales Follow-ups but not Leads would otherwise get a
 * 403 on a dropdown that is only there to fill a form - the same reason the
 * pipeline's assignee directory is conditional.
 */
export default function SalesFollowUpModule() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const dateQuery = useSelector(selectDateRangeQuery);
  const dateDescription = useSelector(selectDateRangeDescription);

  const { startDate, endDate } = dateQuery;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState(undefined);

  const [modal, setModal] = useState({ open: false, followUp: null });
  const [busyId, setBusyId] = useState(null);

  const canLeads = hasModule(currentAdmin, 'lead');
  const canCustomers = hasModule(currentAdmin, 'customer');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    try {
      const data = await request.listAll({ entity: 'followup', options: dateQuery });

      if (data?.success) {
        setItems(Array.isArray(data.result) ? data.result : []);
      } else {
        setFailed(true);
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (canLeads) {
        const data = await request.listAll({ entity: 'lead' });
        if (!cancelled && data?.success) setLeads(Array.isArray(data.result) ? data.result : []);
      }

      if (canCustomers) {
        const data = await request.listAll({ entity: 'client' });
        if (!cancelled && data?.success) setClients(Array.isArray(data.result) ? data.result : []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canLeads, canCustomers]);

  const stats = useMemo(() => {
    const overdue = items.filter(isOverdue).length;
    const dueToday = items.filter(isDueToday).length;
    const upcoming = items.filter(isUpcoming).length;
    const completed = items.filter((item) => item.completed).length;

    return { total: items.length, overdue, dueToday, upcoming, completed };
  }, [items]);

  const tabOptions = useMemo(
    () => [
      { label: `All (${stats.total})`, value: 'all' },
      { label: `Today (${stats.dueToday})`, value: 'today' },
      { label: `Upcoming (${stats.upcoming})`, value: 'upcoming' },
      { label: `Overdue (${stats.overdue})`, value: 'overdue' },
      { label: `Completed (${stats.completed})`, value: 'completed' },
    ],
    [stats]
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return items.filter((item) => {
      if (tab === 'today' && !isDueToday(item)) return false;
      if (tab === 'upcoming' && !isUpcoming(item)) return false;
      if (tab === 'overdue' && !isOverdue(item)) return false;
      if (tab === 'completed' && !item.completed) return false;
      if (channel && item.channel !== channel) return false;

      if (!needle) return true;

      const haystack = [
        item.subject,
        item.notes,
        item.outcome,
        item.lead?.name,
        item.lead?.email,
        item.client?.name,
        item.client?.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [items, tab, channel, search]);

  const complete = async (record) => {
    setBusyId(record._id);

    try {
      const data = await request.update({
        entity: 'followup',
        id: record._id,
        jsonData: { completed: true },
      });

      if (data?.success && data.result) {
        setItems((current) =>
          current.map((item) => (item._id === record._id ? data.result : item))
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (record) => {
    setBusyId(record._id);

    try {
      const data = await request.delete({ entity: 'followup', id: record._id });

      if (data?.success) {
        setItems((current) => current.filter((item) => item._id !== record._id));
      }
    } finally {
      setBusyId(null);
    }
  };

  const statusTag = (record) => {
    if (record.completed) {
      return <Tag color="green">Completed</Tag>;
    }
    if (isOverdue(record)) {
      return <Tag color="red">Overdue</Tag>;
    }
    if (isDueToday(record)) {
      return <Tag color="gold">Due today</Tag>;
    }
    return <Tag color="blue">Upcoming</Tag>;
  };

  const columns = [
    {
      title: 'Due',
      dataIndex: 'date',
      width: 170,
      render: (value, record) => (
        <Text type={isOverdue(record) ? 'danger' : undefined}>
          {dayjs(value).format('DD MMM YYYY')}
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {dayjs(value).format('HH:mm')}
          </Text>
        </Text>
      ),
    },
    {
      title: 'Follow-up',
      dataIndex: 'subject',
      render: (value, record) => (
        <div style={{ minWidth: 180 }}>
          <Text strong style={{ display: 'block' }}>
            {value || 'Untitled follow-up'}
          </Text>
          {record.notes && (
            <Text
              type="secondary"
              style={{
                display: 'block',
                fontSize: 12,
                maxWidth: 320,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {record.notes}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Linked to',
      key: 'linked',
      width: 220,
      render: (_, record) => {
        if (record.lead) {
          const stage = stageOf(record.lead.salesStage);
          return (
            <Space size={6} wrap>
              <Text>{record.lead.name || 'Lead'}</Text>
              <Tag color={stage.color} style={{ marginInlineEnd: 0 }}>
                {stage.label}
              </Tag>
            </Space>
          );
        }

        if (record.client) {
          return (
            <Space size={6} wrap>
              <UserOutlined />
              <Text>{record.client.name || 'Customer'}</Text>
              <Tag style={{ marginInlineEnd: 0 }}>Customer</Tag>
            </Space>
          );
        }

        return <Text type="secondary">No longer linked</Text>;
      },
    },
    {
      title: 'Channel',
      dataIndex: 'channel',
      width: 120,
      render: (value) => (
        <Tag color={CHANNEL_COLORS[value] || 'default'} style={{ marginInlineEnd: 0 }}>
          {value || 'Call'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_, record) => statusTag(record),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 190,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {!record.completed && (
            <Tooltip title="Mark this follow-up complete">
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                loading={busyId === record._id}
                onClick={() => complete(record)}
              >
                Complete
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setModal({ open: true, followUp: record })}
              aria-label="Edit follow-up"
            />
          </Tooltip>
          <Popconfirm
            title="Delete this follow-up?"
            description="It will be removed from the board as well."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove(record)}
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label="Delete follow-up"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
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
            Sales Follow-ups
          </Title>
          <Text type="secondary" style={{ display: 'block' }}>
            Every scheduled call, email and meeting in one queue - shared with the pipeline board.
          </Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12.5 }}>
            Showing {dateDescription}
          </Text>
        </div>

        <Space wrap>
          <Tooltip title="Reload the follow-up queue">
            <Button
              icon={<ReloadOutlined />}
              onClick={load}
              loading={loading}
              aria-label="Reload follow-ups"
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModal({ open: true, followUp: null })}
          >
            Schedule Follow-up
          </Button>
        </Space>
      </div>

      {failed && (
        <Alert
          type="error"
          showIcon
          message="Could not load the follow-up queue"
          description="The records could not be read. Reload to try again; if it keeps failing, your access to the Sales Follow-ups module may have changed."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <StatTile
            icon={<ScheduleOutlined />}
            label="Total follow-ups"
            value={stats.total}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <StatTile
            icon={<FieldTimeOutlined />}
            label="Overdue"
            value={stats.overdue}
            color="var(--color-error-500)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <StatTile
            icon={<ClockCircleOutlined />}
            label="Due today"
            value={stats.dueToday}
            color="var(--color-warning-500)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <StatTile
            icon={<CalendarOutlined />}
            label="Upcoming"
            value={stats.upcoming}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <StatTile
            icon={<CheckCircleOutlined />}
            label="Completed"
            value={stats.completed}
            color="var(--color-success-500)"
          />
        </Col>
      </Row>

      <div
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          padding: 16,
          boxShadow: 'var(--app-shadow)',
        }}
      >
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
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Segmented value={tab} onChange={setTab} options={tabOptions} />
          </div>

          <Space wrap>
            <Input
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder="Search follow-ups"
              style={{ width: 220 }}
            />
            <Select
              allowClear
              value={channel}
              onChange={setChannel}
              placeholder="All channels"
              style={{ width: 160 }}
              options={FOLLOW_UP_CHANNELS.map((value) => ({ value, label: value }))}
            />
          </Space>
        </div>

        <Table
          rowKey="_id"
          columns={columns}
          dataSource={visible}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            hideOnSinglePage: false,
            showTotal: (total) => `${total} follow-ups`,
          }}
        />
      </div>

      <FollowUpModal
        open={modal.open}
        followUp={modal.followUp}
        leads={leads}
        clients={clients}
        onClose={() => setModal({ open: false, followUp: null })}
        // The list is reloaded rather than patched in place: the server's
        // response carries the record, but the KPI row and the tabs are derived
        // from the whole queue and one upsert would leave them stale.
        onSaved={load}
      />
    </Space>
  );
}
