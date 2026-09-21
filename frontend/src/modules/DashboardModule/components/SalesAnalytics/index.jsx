import { useSelector } from 'react-redux';

import { Alert, Col, Row } from 'antd';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { canReadTeamDirectory } from '@/hooks/useAssigneeDirectory';

import OutcomeCard from './OutcomeCard';
import StageBreakdownCard from './StageBreakdownCard';
import ExecutivePerformanceCard from './ExecutivePerformanceCard';
import usePipelineAnalytics from './usePipelineAnalytics';

/**
 * The dashboard's sales analytics.
 *
 * Three cards over one fetch of /api/lead/listAll, which is scoped for us -
 * an owner sees the whole workspace's leads, a Sales Executive sees only their
 * own - so every figure here is narrowed by the same rule as the pipeline board
 * and needs no scoping of its own. See usePipelineAnalytics.
 *
 * The executive breakdown is the one thing that is deliberately withheld: it is
 * built only for an owner. An executive's figures would be a single row
 * restating the totals beside it, and the shape of the card - a colleague's name
 * and workload - is not theirs to see.
 *
 * "Owner" is read through canReadTeamDirectory rather than spelled out here.
 * That is the same predicate the assignee picker uses, and it is the same
 * question both times - whether this account may see the workspace's employees -
 * so the two cannot drift apart and leave one screen naming colleagues while the
 * other refuses to.
 *
 * Mounted only while the account holds the `lead` module, by the dashboard. That
 * is what makes the empty dependency list in the hook safe, and it is the same
 * rule the other cards on this page follow: a card for a module the account does
 * not hold is dropped rather than left showing a zero.
 */
export default function SalesAnalytics() {
  const currentAdmin = useSelector(selectCurrentAdmin);

  const isOwner = canReadTeamDirectory(currentAdmin);

  const { isLoading, hasFailed, outcomes, stages, byAssignee } = usePipelineAnalytics({
    currentAdmin,
    canSeeEveryone: isOwner,
  });

  // Three cards across on a wide screen, two when there is no breakdown to
  // show. Computing it rather than letting antd wrap keeps the two-card case
  // from leaving a third of the row empty.
  const cardSpan = isOwner ? 8 : 12;

  return (
    <>
      {hasFailed && (
        <Row style={{ marginBottom: 20 }}>
          <Col span={24}>
            <Alert
              type="warning"
              showIcon
              message="Sales analytics could not be loaded"
              description="The leads could not be read, so the figures below are empty rather than zero. Reload the page to try again."
            />
          </Col>
        </Row>
      )}

      <Row gutter={[32, 32]}>
        <Col className="gutter-row w-full" xs={{ span: 24 }} lg={{ span: cardSpan }}>
          <OutcomeCard outcomes={outcomes} isLoading={isLoading} />
        </Col>

        <Col className="gutter-row w-full" xs={{ span: 24 }} lg={{ span: cardSpan }}>
          <StageBreakdownCard stages={stages} total={outcomes.total} isLoading={isLoading} />
        </Col>

        {isOwner && (
          <Col className="gutter-row w-full" xs={{ span: 24 }} lg={{ span: cardSpan }}>
            <ExecutivePerformanceCard byAssignee={byAssignee} isLoading={isLoading} />
          </Col>
        )}
      </Row>
    </>
  );
}
