import { Typography } from 'antd';

const { Text } = Typography;

/**
 * One figure in a summary row: an icon chip, a number, and what it counts.
 *
 * Shared by User Management and the Sales Pipeline because both carry a summary
 * row and a drift between them would read as a bug rather than as a variation.
 * The styling is deliberately the same as the Super Admin panel's StatTile, from
 * which this was taken - that app is a separate Vite build that cannot import
 * from here, so the two copies have to be kept in step by hand.
 *
 * The colours and surfaces come from theme.css, so the tile follows the
 * light/dark switch rather than hard-coding a palette.
 */
export default function StatTile({ icon, label, value, color }) {
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
