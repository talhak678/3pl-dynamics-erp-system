import { Divider, Progress, Row, Spin, Statistic } from 'antd';

import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';

/**
 * Won against lost, and how much is still in play.
 *
 * The win rate is taken over decided leads only. Counting open leads in the
 * denominator would make a healthy pipeline look like a failing one - the more
 * deals in progress, the worse the number - which is the opposite of what the
 * figure is for.
 *
 * Styled with the dashboard's own whiteBox/shadow panel rather than the
 * StatTile used on the Users and Pipeline pages, so it sits in the row of
 * summary cards as a peer. Same reasoning as those pages using their own
 * neighbours' idiom.
 */
export default function OutcomeCard({ outcomes, isLoading }) {
  const { won, lost, open, total, winRate, hasDecided } = outcomes;

  return (
    <div className="whiteBox shadow" style={{ padding: 20, height: '100%' }}>
      <h3 style={{ color: 'var(--app-text)', fontSize: 'large', marginTop: 0, marginBottom: 20 }}>
        Won vs Lost
      </h3>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
        </div>
      ) : (
        <>
          <Row gutter={[16, 16]} justify="space-around">
            <Statistic
              title="Won"
              value={won}
              valueStyle={{ color: 'var(--color-success-500)' }}
              prefix={<CheckCircleFilled />}
            />
            <Statistic
              title="Lost"
              value={lost}
              valueStyle={{ color: 'var(--color-error-500)' }}
              prefix={<CloseCircleFilled />}
            />
            <Statistic title="Still open" value={open} valueStyle={{ color: 'var(--app-text)' }} />
          </Row>

          <Divider style={{ margin: '20px 0' }} />

          {hasDecided ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--app-text-secondary)', fontSize: 13 }}>Win rate</span>
                <span style={{ color: 'var(--app-text)', fontSize: 13, fontWeight: 600 }}>
                  {winRate}% of {won + lost} closed
                </span>
              </div>
              <Progress
                percent={winRate}
                showInfo={false}
                strokeColor="var(--color-success-500)"
              />
            </div>
          ) : (
            <p style={{ color: 'var(--app-text-secondary)', fontSize: 13, margin: 0 }}>
              {total > 0
                ? 'No lead has been won or lost yet, so there is no win rate to show.'
                : 'No leads in the pipeline yet.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
