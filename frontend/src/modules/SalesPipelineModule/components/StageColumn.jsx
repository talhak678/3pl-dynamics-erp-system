import { useState } from 'react';

import { Badge, Empty, Typography } from 'antd';

const { Text } = Typography;

/**
 * One stage, as a column on the board.
 *
 * A drop target and a scroller. The column owns its own hover state rather than
 * having it passed down, because it is the only thing that needs to know and
 * lifting it would re-render all eight columns on every drag movement.
 */
export default function StageColumn({ stage, leads, onDrop, children }) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <div
      style={{
        flex: '0 0 288px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 220,
        maxHeight: 'calc(100vh - 280px)',
        background: isDropTarget ? 'var(--color-brand-25)' : 'var(--app-surface-muted)',
        border: `1px solid ${isDropTarget ? 'var(--color-brand-400)' : 'var(--app-border)'}`,
        borderRadius: 12,
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--app-border)',
        }}
      >
        <Badge color={stage.color} text={<Text strong>{stage.label}</Text>} />
        <Text type="secondary" style={{ fontSize: 13 }}>
          {leads.length}
        </Text>
      </div>

      {/*
        The drop handlers live on the scrolling body rather than on the column,
        so that a card dropped past the last one still lands. preventDefault in
        onDragOver is what marks this as a valid target at all - without it the
        browser refuses the drop and the card springs back.
      */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDragEnter={() => setIsDropTarget(true)}
        onDragLeave={(event) => {
          // Fires on every child the pointer crosses, so the column is only
          // left when the pointer has gone somewhere outside it.
          if (!event.currentTarget.contains(event.relatedTarget)) setIsDropTarget(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDropTarget(false);
          onDrop(stage.value);
        }}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {leads.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary" style={{ fontSize: 12 }}>
                No leads here
              </Text>
            }
            style={{ margin: '20px 0' }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
