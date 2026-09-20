import { useRef } from 'react';

import { Avatar, Select, Space, Tag, Tooltip, Typography } from 'antd';

import {
  CalendarOutlined,
  MailOutlined,
  ShopOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';

import { FILE_BASE_URL } from '@/config/serverApiConfig';
import { SALES_STAGES, stageOf } from '@/utils/salesStages';

const { Text } = Typography;

/**
 * The photo as a usable URL, or undefined so the Avatar falls back to initials.
 *
 * Two shapes arrive here depending on how the account was created: a stored
 * filename, which needs the file host prefixing, and a data: or http URL, which
 * must not be. Same rule as the header's avatar and the profile page, which is
 * where this was taken from - three different treatments of the same field would
 * show the same person three different ways.
 */
const avatarSrc = (person) => {
  if (!person?.photo) return undefined;
  if (person.photo.startsWith('data:') || person.photo.startsWith('http')) return person.photo;
  return `${FILE_BASE_URL}${person.photo}`;
};

const initialsOf = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/**
 * One lead, as a card on the board.
 *
 * Two ways to change the stage, because the obvious one does not work
 * everywhere. Dragging is the natural gesture with a mouse, but the HTML5 drag
 * events this uses do not fire on touch at all - so on a tablet the select is
 * not a redundant second control, it is the only one. It is also what a
 * keyboard user reaches for.
 */
export default function LeadCard({ lead, assignee, isPending, onMove, onDragStart, onDragEnd }) {
  const stage = stageOf(lead.salesStage);

  // Set while the pointer is down inside the controls. The card is the
  // draggable ancestor of the select, so without this a mousedown on the select
  // and the smallest movement starts dragging the card instead of opening the
  // menu. Checked in onDragStart, where the event can still be cancelled.
  const pointerOverControls = useRef(false);

  const followUp = lead.followUpDate ? dayjs(lead.followUpDate) : null;
  // Compared by day, not by instant: a follow-up dated today is due today, not
  // overdue by however many hours have passed since midnight.
  const isOverdue = followUp ? followUp.isBefore(dayjs(), 'day') : false;

  const company = lead.company?.name;

  return (
    <div
      draggable={!isPending}
      onDragStart={(event) => {
        if (pointerOverControls.current) {
          event.preventDefault();
          return;
        }
        // Firefox will not start a drag unless some data is set on the transfer,
        // even though the drop handler reads the dragged lead from React state
        // rather than from here. Without this the board is drag-less on Firefox
        // and works everywhere else.
        event.dataTransfer.setData('text/plain', String(lead._id));
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(lead);
      }}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--app-surface)',
        border: '1px solid var(--app-border)',
        borderRadius: 10,
        padding: 12,
        boxShadow: 'var(--app-shadow)',
        cursor: isPending ? 'progress' : 'grab',
        opacity: isPending ? 0.6 : 1,
        transition: 'box-shadow 0.15s ease',
      }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Text strong style={{ fontSize: 14, display: 'block' }}>
          {lead.name || 'Unnamed lead'}
        </Text>

        {company && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            <ShopOutlined style={{ marginInlineEnd: 6 }} />
            {company}
          </Text>
        )}

        {!company && lead.email && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            <MailOutlined style={{ marginInlineEnd: 6 }} />
            {lead.email}
          </Text>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Tag color={stage.color} style={{ marginInlineEnd: 0, fontSize: 12 }}>
            {stage.label}
          </Tag>
          {lead.type && (
            <Tag style={{ marginInlineEnd: 0, fontSize: 12 }}>{lead.type}</Tag>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={22}
            src={avatarSrc(assignee)}
            style={{
              backgroundColor: assignee?.known
                ? 'var(--color-brand-500)'
                : 'var(--color-gray-400)',
              color: 'var(--color-white)',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {assignee ? initialsOf(assignee.name) : <UserOutlined />}
          </Avatar>
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {assignee ? assignee.name : 'Unassigned'}
          </Text>
        </div>

        <Text
          type={isOverdue ? 'danger' : 'secondary'}
          style={{ fontSize: 12, display: 'block' }}
        >
          <CalendarOutlined style={{ marginInlineEnd: 6 }} />
          {followUp
            ? `${isOverdue ? 'Overdue' : 'Follow-up'}: ${followUp.format('DD MMM YYYY')}`
            : 'No follow-up set'}
        </Text>

        {/* The touch and keyboard path to the same change the drag makes. */}
        <div
          onMouseDown={(event) => {
            pointerOverControls.current = true;
            event.stopPropagation();
          }}
          onMouseUp={() => {
            pointerOverControls.current = false;
          }}
          onTouchStart={() => {
            pointerOverControls.current = true;
          }}
        >
          <Tooltip title="Move this lead to another stage">
            <Select
              size="small"
              value={stage.value}
              disabled={isPending}
              loading={isPending}
              style={{ width: '100%' }}
              suffixIcon={<UserSwitchOutlined />}
              onChange={(next) => onMove(next)}
              options={SALES_STAGES.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </Tooltip>
        </div>
      </Space>
    </div>
  );
}
