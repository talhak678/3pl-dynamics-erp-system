import { Empty, Progress, Spin, Tag } from 'antd';

/**
 * How many leads sit in each stage.
 *
 * Every stage gets a row, including the ones with none. A stage missing from
 * the list would be ambiguous - it could mean no leads, or a stage the pipeline
 * does not have - and an empty "Lost" column is itself worth knowing.
 */
export default function StageBreakdownCard({ stages, total, isLoading }) {
  return (
    <div className="whiteBox shadow" style={{ padding: 20, height: '100%' }}>
      <h3 style={{ color: 'var(--app-text)', fontSize: 'large', marginTop: 0, marginBottom: 20 }}>
        Pipeline stages
      </h3>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
        </div>
      ) : total === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No leads in the pipeline yet."
        />
      ) : (
        <div>
          {stages.map((stage) => (
            <div key={stage.value} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <Tag color={stage.color} style={{ marginInlineEnd: 0 }}>
                  {stage.label}
                </Tag>
                <span style={{ color: 'var(--app-text-secondary)', fontSize: 13 }}>
                  {stage.count} {stage.count === 1 ? 'lead' : 'leads'}
                </span>
              </div>
              <Progress
                percent={stage.share}
                showInfo={false}
                strokeColor={stage.closed ? 'var(--color-gray-400)' : 'var(--app-primary)'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
