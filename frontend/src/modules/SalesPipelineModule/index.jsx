import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { Alert, Button, Col, Row, Space, Tooltip, Typography } from 'antd';

import {
  CheckCircleFilled,
  CloseCircleFilled,
  FilterOutlined,
  ReloadOutlined,
  RiseOutlined,
} from '@ant-design/icons';

import { request } from '@/request';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import StatTile from '@/components/StatTile';
import useAssigneeDirectory from '@/hooks/useAssigneeDirectory';
import { SALES_STAGES, stageOf } from '@/utils/salesStages';

import LeadCard from './components/LeadCard';
import StageColumn from './components/StageColumn';

const { Title, Text } = Typography;

/**
 * The Sales Pipeline board.
 *
 * Leads are distributed into one column per salesStage, and moved between them
 * by dragging a card or by changing the stage select on it. Both routes end in
 * the same call - a PATCH of `salesStage` to /api/lead/update/:id - so the
 * server needs to know nothing about how the change was made.
 *
 * Scoping is not decided here and cannot be worked around from here. The list
 * arrives already narrowed: /api/lead/listAll applies leadFilter, which gives an
 * owner the whole workspace and a Sales Executive only the leads assigned to
 * them or entered by them. The update applies the same filter, so an executive
 * cannot move a card they were never shown - and a lead that is out of scope
 * answers 404, the same as one that does not exist, rather than confirming it is
 * real.
 *
 * Data comes from listAll rather than the paginated list on purpose. A board is
 * a view of everything at once, and a column showing only the first page of its
 * leads would be quietly lying. The cost is an unbounded request, so a workspace
 * with a very large pipeline is the case to watch; the fix is a per-stage count
 * plus a per-stage page, which is a change to this call and not to the board.
 */
export default function SalesPipelineModule() {
  const currentAdmin = useSelector(selectCurrentAdmin);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Ids with an update in flight, so a card can be dimmed and its select
  // disabled rather than accepting a second change on top of the first.
  const [pending, setPending] = useState(() => new Set());

  // Held in state rather than read back out of dataTransfer on drop, which is
  // awkward to do safely and unavailable during dragenter, when the column needs
  // to know whether this drag is even one of ours.
  const [draggedLead, setDraggedLead] = useState(null);

  // /api/team is owner-only, so an executive never loads a directory and their
  // colleagues stay unnamed rather than the request failing on every sign-in.
  // The page itself is only reachable by the two pipeline roles, so the role
  // check here is about which of them may look colleagues up, not about access.
  const isOwner = currentAdmin?.role === 'owner' && currentAdmin?.isSuperAdmin !== true;

  const { resolve: resolveAssignee } = useAssigneeDirectory({
    enabled: isOwner,
    currentAdmin,
  });

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    try {
      const data = await request.listAll({ entity: 'lead' });

      // The request layer returns its own failure shape rather than throwing, so
      // a refused or broken call arrives as a missing result rather than as an
      // exception. Surfaced rather than shown as an empty board - a pipeline
      // with no leads and one that failed to load look identical otherwise, and
      // only one of them needs the user to do something.
      if (data?.success) {
        setLeads(Array.isArray(data.result) ? data.result : []);
      } else {
        setFailed(true);
        setLeads([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const byStage = useMemo(() => {
    const groups = new Map(SALES_STAGES.map((stage) => [stage.value, []]));

    for (const lead of leads) {
      groups.get(stageOf(lead.salesStage).value).push(lead);
    }

    return groups;
  }, [leads]);

  const stats = useMemo(() => {
    const closed = SALES_STAGES.filter((stage) => stage.closed).reduce(
      (sum, stage) => sum + byStage.get(stage.value).length,
      0
    );

    return {
      total: leads.length,
      open: leads.length - closed,
      won: byStage.get('Won').length,
      lost: byStage.get('Lost').length,
    };
  }, [leads, byStage]);

  /**
   * Moves a lead to another stage, showing the move before the server confirms
   * it and putting the card back if the server refuses.
   *
   * Optimistic because this is the interaction itself: a drag that visibly
   * springs back to where it started on every drop reads as broken even when the
   * write succeeded. The rollback is what makes that safe, and the failure is
   * never silent - request.updateQuietly reports errors on its own.
   */
  const moveLead = useCallback(async (lead, nextStage) => {
    const from = stageOf(lead.salesStage).value;

    // A drop back into the column it came from, or a select set to the value it
    // already has, is not a change and should not cost a request.
    if (!nextStage || nextStage === from) return;

    setLeads((current) =>
      current.map((item) => (item._id === lead._id ? { ...item, salesStage: nextStage } : item))
    );
    setPending((current) => new Set(current).add(lead._id));

    try {
      const data = await request.updateQuietly({
        entity: 'lead',
        id: lead._id,
        jsonData: { salesStage: nextStage },
      });

      if (data?.success) {
        // Reconciled against what the server stored rather than trusting the
        // optimistic value: `salesStage` is an enum, so a rejected value is
        // silently coerced or the write fails, and the board should show what is
        // actually in the database.
        const saved = stageOf(data.result?.salesStage).value;
        if (saved !== nextStage) {
          setLeads((current) =>
            current.map((item) => (item._id === lead._id ? { ...item, salesStage: saved } : item))
          );
        }
      } else {
        setLeads((current) =>
          current.map((item) => (item._id === lead._id ? { ...item, salesStage: from } : item))
        );
      }
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(lead._id);
        return next;
      });
    }
  }, []);

  const handleDrop = useCallback(
    (stageValue) => {
      const lead = draggedLead;
      setDraggedLead(null);
      if (lead) moveLead(lead, stageValue);
    },
    [draggedLead, moveLead]
  );

  const isLoadingFirstTime = loading && leads.length === 0;

  return (
    <Space direction="vertical" size={22} style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Sales Pipeline
          </Title>
          <Text type="secondary">
            Drag a lead between stages, or use the stage selector on its card.
          </Text>
        </div>
        <Tooltip title="Reload the pipeline">
          <Button
            icon={<ReloadOutlined />}
            onClick={loadLeads}
            loading={loading}
            aria-label="Reload the pipeline"
          />
        </Tooltip>
      </div>

      {failed && (
        <Alert
          type="error"
          showIcon
          message="Could not load the pipeline"
          description="The leads could not be read. Reload to try again; if it keeps failing, your access to the leads module may have changed."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatTile
            icon={<FilterOutlined />}
            label="Total leads"
            value={stats.total}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatTile
            icon={<RiseOutlined />}
            label="Still open"
            value={stats.open}
            color="var(--color-warning-500)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatTile
            icon={<CheckCircleFilled />}
            label="Won"
            value={stats.won}
            color="var(--color-success-500)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatTile
            icon={<CloseCircleFilled />}
            label="Lost"
            value={stats.lost}
            color="var(--color-error-500)"
          />
        </Col>
      </Row>

      {isLoadingFirstTime ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--app-surface)',
            border: '1px solid var(--app-border)',
            borderRadius: 12,
          }}
        >
          <Text type="secondary">Loading the pipeline…</Text>
        </div>
      ) : (
        // Scrolls sideways rather than wrapping: eight columns stacked into
        // rows would stop reading as a pipeline, which is the one thing the
        // layout is for.
        <div
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
            overflowX: 'auto',
            paddingBottom: 8,
          }}
        >
          {SALES_STAGES.map((stage) => {
            const stageLeads = byStage.get(stage.value);

            return (
              <StageColumn
                key={stage.value}
                stage={stage}
                leads={stageLeads}
                onDrop={handleDrop}
              >
                {stageLeads.map((lead) => (
                  <LeadCard
                    key={lead._id}
                    lead={lead}
                    assignee={resolveAssignee(lead.assignedTo)}
                    isPending={pending.has(lead._id)}
                    onMove={(next) => moveLead(lead, next)}
                    onDragStart={setDraggedLead}
                    onDragEnd={() => setDraggedLead(null)}
                  />
                ))}
              </StageColumn>
            );
          })}
        </div>
      )}
    </Space>
  );
}
