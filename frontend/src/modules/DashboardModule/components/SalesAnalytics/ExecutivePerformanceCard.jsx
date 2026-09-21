import { Avatar, Empty, Progress, Spin, Tag, Tooltip, Typography } from 'antd';

import { UserOutlined } from '@ant-design/icons';

import { avatarSrc, initialsOf } from '@/utils/avatar';

const { Text } = Typography;

/**
 * How many leads each executive is carrying, and how many they have won.
 *
 * Owner-only, and not merely because the names need /api/team. A Sales Executive
 * sees only their own leads, so a breakdown of one row would be a worse version
 * of the figures already above it - and the leads they can see that are assigned
 * to somebody else are ones they created and handed on, which would put a
 * colleague's name and workload on a page that is not theirs to see.
 *
 * An unassigned row is included rather than hidden. Leads nobody owns are the
 * most useful thing this card can surface, and a breakdown that does not add up
 * to the total invites the reader to distrust all of it.
 */
export default function ExecutivePerformanceCard({ byAssignee, isLoading }) {
  return (
    <div className="whiteBox shadow" style={{ padding: 20, height: '100%' }}>
      <h3 style={{ color: 'var(--app-text)', fontSize: 'large', marginTop: 0, marginBottom: 20 }}>
        Sales Executive Performance
      </h3>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
        </div>
      ) : byAssignee.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No leads to attribute to anyone yet."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {byAssignee.map((row) => (
            <div key={row.id ?? 'unassigned'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar
                  size={28}
                  src={avatarSrc(row)}
                  style={{
                    backgroundColor: row.known
                      ? 'var(--color-brand-500)'
                      : 'var(--color-gray-400)',
                    color: 'var(--color-white)',
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {row.id ? initialsOf(row.name) : <UserOutlined />}
                </Avatar>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    strong
                    style={{
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {row.assigned} {row.assigned === 1 ? 'lead' : 'leads'} · {row.open} open
                  </Text>
                </div>

                <Tooltip title={`Won ${row.won}, lost ${row.lost}`}>
                  <Tag
                    color={row.won > 0 ? 'success' : 'default'}
                    style={{ marginInlineEnd: 0, flexShrink: 0 }}
                  >
                    {row.won} won
                  </Tag>
                </Tooltip>
              </div>

              <Progress
                percent={row.winRate}
                showInfo={false}
                size="small"
                strokeColor="var(--color-success-500)"
                style={{ marginBottom: 0 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
