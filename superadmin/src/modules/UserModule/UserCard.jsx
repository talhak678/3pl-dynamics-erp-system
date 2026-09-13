import { Avatar, Card, Space, Tag, Tooltip, Typography } from 'antd';

import {
  CheckCircleFilled,
  CrownFilled,
  StopFilled,
  CalendarOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

import useDate from '@/settings/useDate';
import { describePermissions } from '@/utils/moduleList';

const { Text, Title } = Typography;

export default function UserCard({ user, onOpen }) {
  const { formatDate } = useDate();
  const permissions = describePermissions(user.modulePermissions);
  const isActive = user.isActive;

  return (
    <Card
      hoverable
      onClick={() => onOpen?.(user)}
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
            {user.name?.charAt(0)?.toUpperCase() || '?'}
          </Avatar>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Title
                level={5}
                style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {user.name}
              </Title>
              {user.isSuperAdmin && (
                <Tooltip title="Super Admin">
                  <CrownFilled style={{ color: 'var(--color-warning-500)' }} />
                </Tooltip>
              )}
            </div>
            <Text
              type="secondary"
              style={{ fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {user.email}
            </Text>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Tag
            icon={isActive ? <CheckCircleFilled /> : <StopFilled />}
            color={isActive ? 'success' : 'error'}
            style={{ marginInlineEnd: 0, fontWeight: 500 }}
          >
            {isActive ? 'Active' : 'Suspended'}
          </Tag>

          <Tooltip
            title={
              permissions.all
                ? 'Every module (empty list means full access)'
                : permissions.labels.join(', ')
            }
          >
            <Tag icon={<AppstoreOutlined />} style={{ marginInlineEnd: 0 }}>
              {permissions.all ? 'All modules' : `${permissions.count} modules`}
            </Tag>
          </Tooltip>
        </div>

        <div style={{ borderTop: '1px solid var(--app-border)', paddingTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <CalendarOutlined style={{ marginInlineEnd: 6 }} />
            Created {formatDate(user.created)}
          </Text>
        </div>
      </Space>
    </Card>
  );
}
