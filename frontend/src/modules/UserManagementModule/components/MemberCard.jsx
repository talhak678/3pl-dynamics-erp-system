import { Avatar, Card, Space, Tag, Tooltip, Typography } from 'antd';

import {
  CheckCircleFilled,
  StopFilled,
  CalendarOutlined,
  AppstoreOutlined,
  IdcardOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';

import useDate from '@/settings/useDate';
import { describePermissions } from '@/utils/erpModules';

const { Text, Title } = Typography;

/**
 * One employee, as a card in the grid.
 *
 * The layout deliberately matches the Super Admin panel's UserCard: same
 * avatar-and-tags arrangement, same hover lift. The two panels manage the same
 * kind of record, and a tenant admin who has seen the control plane should
 * recognise this immediately rather than learn a second visual language for the
 * same idea.
 *
 * Differences are all subtractions. There is no crown badge, because an
 * employee can never be a super admin. The permission tag names the modules
 * rather than reporting "All modules", because an employee always has an
 * explicit list - the server refuses to store an empty one.
 */
export default function MemberCard({ member, onOpen }) {
  const { dateFormat } = useDate();
  const permissions = describePermissions(member.modulePermissions);
  const isActive = member.isActive;

  return (
    <Card
      hoverable
      onClick={() => onOpen?.(member)}
      style={{
        borderRadius: 12,
        borderColor: 'var(--app-border)',
        background: 'var(--app-surface)',
        height: '100%',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      styles={{ body: { padding: 20 } }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-3px)';
        event.currentTarget.style.boxShadow = 'var(--app-shadow-lg)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.boxShadow = 'var(--app-shadow)';
      }}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar
            size={52}
            style={{
              backgroundColor: isActive ? 'var(--color-brand-500)' : 'var(--color-gray-400)',
              color: 'var(--color-white)',
              fontSize: 20,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {member.name?.charAt(0)?.toUpperCase() || '?'}
          </Avatar>

          <div style={{ minWidth: 0, flex: 1 }}>
            <Title
              level={5}
              style={{
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {[member.name, member.surname].filter(Boolean).join(' ')}
            </Title>
            <Text
              type="secondary"
              style={{
                fontSize: 13,
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {member.email}
            </Text>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Tag
            icon={isActive ? <CheckCircleFilled /> : <StopFilled />}
            color={isActive ? 'success' : 'error'}
            style={{ marginInlineEnd: 0, fontWeight: 500 }}
          >
            {isActive ? 'Active' : 'Inactive'}
          </Tag>

          <Tooltip title={permissions.labels.join(', ')}>
            <Tag icon={<AppstoreOutlined />} style={{ marginInlineEnd: 0 }}>
              {permissions.count === 1 ? '1 module' : `${permissions.count} modules`}
            </Tag>
          </Tooltip>

          <Tag icon={<IdcardOutlined />} style={{ marginInlineEnd: 0 }}>
            {member.role === 'employee' ? 'Employee' : member.role}
          </Tag>
        </div>

        <div style={{ borderTop: '1px solid var(--app-border)', paddingTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <CalendarOutlined style={{ marginInlineEnd: 6 }} />
            Added {member.created ? dayjs(member.created).format(dateFormat) : '-'}
          </Text>
        </div>
      </Space>
    </Card>
  );
}
