import { useCallback, useEffect, useState } from 'react';

import {
  Alert,
  Button,
  Drawer,
  Empty,
  List,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';

import { request } from '@/request';
import FollowUpModal from '@/components/FollowUpModal';

const { Text } = Typography;

const isOverdue = (item) => !item.completed && dayjs(item.date).isBefore(dayjs(), 'day');

/**
 * One lead's follow-ups, opened from its card on the pipeline board.
 *
 * This is the board's half of the shared dataset. Every action here writes
 * through /api/followup/*, the same endpoints the Sales Follow-ups module uses,
 * and the server updates `Lead.followUpDate` after each write. `onChanged` then
 * reloads the board so the card's cached date is never a render behind.
 *
 * The drawer lists the lead's history rather than only its next follow-up on
 * purpose: "what was said last time" is the context a salesperson needs before
 * scheduling the next call, and it is the thing the single `followUpDate` field
 * could never hold.
 *
 * Completing or deleting from here is not a shortcut around the module - it is
 * the same PATCH/DELETE, with the same tenant and ownership filters applied by
 * the server.
 */
export default function LeadFollowUpsDrawer({ open, lead, onClose, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [modal, setModal] = useState({ open: false, followUp: null });

  const leadId = lead?._id;

  const load = useCallback(async () => {
    if (!leadId) return;

    setLoading(true);
    setFailed(false);

    try {
      const data = await request.listAll({
        entity: 'followup',
        options: { lead: leadId },
      });

      if (data?.success) {
        setItems(Array.isArray(data.result) ? data.result : []);
      } else {
        setFailed(true);
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setModal({ open: false, followUp: null });
      return;
    }

    load();
  }, [open, load]);

  const afterWrite = async () => {
    await load();
    onChanged?.();
  };

  const complete = async (record) => {
    setBusyId(record._id);

    try {
      const data = await request.update({
        entity: 'followup',
        id: record._id,
        jsonData: { completed: true },
      });

      if (data?.success) await afterWrite();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (record) => {
    setBusyId(record._id);

    try {
      const data = await request.delete({ entity: 'followup', id: record._id });

      if (data?.success) await afterWrite();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Drawer
      title={lead ? `Follow-ups · ${lead.name || 'Unnamed lead'}` : 'Follow-ups'}
      width={520}
      open={open}
      onClose={onClose}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModal({ open: true, followUp: null })}
        >
          Schedule
        </Button>
      }
    >
      {failed && (
        <Alert
          type="error"
          showIcon
          message="Could not load this lead's follow-ups"
          description="Reload the drawer to try again."
          style={{ marginBottom: 16 }}
        />
      )}

      <List
        loading={loading}
        dataSource={items}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No follow-ups scheduled for this lead yet"
            />
          ),
        }}
        renderItem={(item) => (
          <List.Item
            actions={[
              !item.completed && (
                <Tooltip title="Mark complete" key="complete">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    loading={busyId === item._id}
                    onClick={() => complete(item)}
                  >
                    Complete
                  </Button>
                </Tooltip>
              ),
              <Tooltip title="Edit" key="edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => setModal({ open: true, followUp: item })}
                  aria-label="Edit follow-up"
                />
              </Tooltip>,
              <Popconfirm
                key="delete"
                title="Delete this follow-up?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() => remove(item)}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="Delete follow-up"
                />
              </Popconfirm>,
            ].filter(Boolean)}
          >
            <List.Item.Meta
              avatar={
                <ScheduleOutlined
                  style={{
                    fontSize: 18,
                    color: item.completed
                      ? 'var(--color-success-500)'
                      : isOverdue(item)
                        ? 'var(--color-error-500)'
                        : 'var(--color-brand-500)',
                    marginTop: 6,
                  }}
                />
              }
              title={
                <Space wrap size={6}>
                  <Text strong={!item.completed} delete={item.completed}>
                    {item.subject || 'Untitled follow-up'}
                  </Text>
                  <Tag style={{ marginInlineEnd: 0 }}>{item.channel || 'Call'}</Tag>
                  {item.completed ? (
                    <Tag color="green" style={{ marginInlineEnd: 0 }}>
                      Completed
                    </Tag>
                  ) : (
                    <Tag
                      color={isOverdue(item) ? 'red' : 'blue'}
                      style={{ marginInlineEnd: 0 }}
                    >
                      {isOverdue(item) ? 'Overdue' : 'Pending'}
                    </Tag>
                  )}
                </Space>
              }
              description={
                <>
                  <Text type={isOverdue(item) ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                    {dayjs(item.date).format('DD MMM YYYY, HH:mm')}
                  </Text>
                  {item.notes && (
                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      {item.notes}
                    </Text>
                  )}
                  {item.outcome && (
                    <Text style={{ display: 'block', fontSize: 12 }}>
                      Outcome: {item.outcome}
                    </Text>
                  )}
                </>
              }
            />
          </List.Item>
        )}
      />

      <FollowUpModal
        open={modal.open}
        followUp={modal.followUp}
        initialLead={lead}
        leads={lead ? [lead] : []}
        clients={[]}
        lockTarget
        onClose={() => setModal({ open: false, followUp: null })}
        onSaved={afterWrite}
      />
    </Drawer>
  );
}
