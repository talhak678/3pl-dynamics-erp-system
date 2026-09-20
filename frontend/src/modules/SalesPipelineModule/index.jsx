import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Button,
  Col,
  Empty,
  Progress,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import {
  CheckCircleFilled,
  CloseCircleFilled,
  FilterOutlined,
  ReloadOutlined,
  RiseOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';

import { request } from '@/request';
import StatTile from '@/components/StatTile';

import { SALES_STAGES, stageOf } from './config';

const { Title, Text } = Typography;

/**
 * The Sales Pipeline.
 *
 * This is the scaffolding step: the module is registered, reachable from the
 * sidebar, and actually reading the pipeline fields off the Lead schema. The
 * board UI - drag a card between columns, set a follow-up date, reassign - is
 * the next piece of work and is deliberately not guessed at here.
 *
 * What it does do is prove the whole path end to end, which is the point of a
 * scaffold: every number and every tag below is computed from `salesStage`,
 * `assignedTo` and `followUpDate` as they come back from /api/lead/listAll. That
 * matters because a field missing from the server's migrate whitelist does not
 * fail loudly - it arrives absent, and the pipeline would show eight empty
 * columns. The summary row is what makes that visible before the board is built.
 *
 * Data comes from listAll rather than the paginated list on purpose. A board is
 * a view of everything at once - a stage column showing only the first page of
 * its leads would be quietly lying. The cost is that this request is unbounded,
 * so the board step should either cap it per stage or have the server return
 * counts with a per-stage page.
 *
 * Scoping is not decided here. An owner sees every lead in the workspace and a
 * Sales Executive sees only their own, because /api/lead/listAll applies
 * leadFilter to the query. This component receives whatever it is given and has
 * no way to ask for more.
 */
export default function SalesPipelineModule() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    try {
      const data = await request.listAll({ entity: 'lead' });

      // The request layer returns its own failure shape rather than throwing, so
      // a refused or broken call arrives as a missing result rather than as an
      // exception. Checked rather than assumed, and surfaced rather than shown
      // as "no leads" - an empty pipeline and a failed request look identical
      // otherwise, and only one of them needs the user to do something.
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

  // Grouped once, then read by the summary row, the breakdown and the table.
  // Each lead's stage is resolved through stageOf() so an unrecognised value
  // still lands in a visible column instead of falling out of the board.
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

  // Newest first, because listAll already sorts by created descending. Only
  // sliced, never re-sorted: `created` is not part of the migrated shape, so
  // sorting on it here would compare undefined to undefined.
  const recentLeads = useMemo(() => leads.slice(0, 8), [leads]);

  const columns = [
    {
      title: 'Lead',
      dataIndex: 'name',
      key: 'name',
      render: (name) => name || <Text type="secondary">Unnamed</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type) => <Tag color={type === 'company' ? 'blue' : 'magenta'}>{type}</Tag>,
    },
    {
      title: 'Stage',
      dataIndex: 'salesStage',
      key: 'salesStage',
      width: 160,
      render: (value) => {
        const stage = stageOf(value);
        return <Tag color={stage.color}>{stage.label}</Tag>;
      },
    },
    {
      title: 'Follow-up',
      dataIndex: 'followUpDate',
      key: 'followUpDate',
      width: 140,
      render: (value) =>
        value ? dayjs(value).format('DD MMM YYYY') : <Text type="secondary">Not set</Text>,
    },
    {
      title: 'Assigned',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 130,
      // A bare id is all the API returns - the mapper hands `assignedTo` back
      // unresolved. Naming the account needs either a populated field on the
      // lead or a lookup an executive may make, and /api/team is owner-only, so
      // this says whether the lead belongs to somebody rather than guessing at
      // who. Resolving it is part of the board step.
      render: (assignedTo) =>
        assignedTo ? 'Assigned' : <Text type="secondary">Unassigned</Text>,
    },
  ];

  const panelStyle = {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: '18px 20px',
  };

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
            Every lead you can work, grouped by the stage it has reached.
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

      <div style={panelStyle}>
        <Text strong>Leads by stage</Text>

        {isLoadingFirstTime ? (
          <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: 16 }} />
        ) : stats.total === 0 ? (
          <Empty
            style={{ marginTop: 16 }}
            description={
              failed
                ? 'Nothing to show.'
                : 'No leads in this pipeline yet. Leads you add appear here in their stage.'
            }
          />
        ) : (
          <div style={{ marginTop: 16 }}>
            {SALES_STAGES.map((stage) => {
              const count = byStage.get(stage.value).length;
              // A share of the whole pipeline, so eight bars of very different
              // length say where the work actually is. A stage with no leads
              // still gets its row - its emptiness is information.
              const percent = Math.round((count / stats.total) * 100);

              return (
                <div key={stage.value} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 12,
                    }}
                  >
                    <Tag color={stage.color} style={{ marginInlineEnd: 0 }}>
                      {stage.label}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {count} {count === 1 ? 'lead' : 'leads'}
                    </Text>
                  </div>
                  <Progress percent={percent} showInfo={false} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recentLeads.length > 0 && (
        <div style={panelStyle}>
          <Text strong>Recently added</Text>
          <Table
            style={{ marginTop: 12 }}
            rowKey="_id"
            size="small"
            pagination={false}
            columns={columns}
            dataSource={recentLeads}
            scroll={{ x: 'max-content' }}
          />
          {leads.length > recentLeads.length && (
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 12 }}>
              Showing the {recentLeads.length} most recent of {leads.length}. The full board is
              next.
            </Text>
          )}
        </div>
      )}
    </Space>
  );
}
