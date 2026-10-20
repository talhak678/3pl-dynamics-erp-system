import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  Alert,
  Button,
  Col,
  InputNumber,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import {
  AimOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DollarOutlined,
  LineChartOutlined,
  PercentageOutlined,
  ReloadOutlined,
  RiseOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

import dayjs from 'dayjs';

import { request } from '@/request';
import { selectDateRangeDescription, selectDateRangeQuery } from '@/redux/dateRange/selectors';
import StatTile from '@/components/StatTile';
import { useMoney } from '@/settings';
import { stageOf } from '@/utils/salesStages';

const { Title, Text } = Typography;

/**
 * Sales Forecasting.
 *
 * Every figure is derived on read from the tenant-scoped Lead, Offer, Quote,
 * Order and Invoice collections. There is no forecast model and nothing to
 * recompute: the answer is rebuilt from live records on every request.
 *
 * Two clocks, deliberately:
 *
 *   The open pipeline - leads in an open stage, active offers and active quotes
 *   - is LIVE and not filtered by the header window. A deal opened before the
 *   selected range is still open today; windowing it hid it and made every KPI
 *   read zero. Closed outcomes (the win rate) and booked documents (orders and
 *   invoices in the source breakdown) DO follow the header window.
 *
 * Where a lead's value comes from:
 *
 *   Its own `total` when that is positive. Most leads in this ERP carry no
 *   monetary value, so otherwise the server uses the largest active Offer linked
 *   to the lead. Quotes have no lead reference and are added to the forecast as
 *   their own document pipeline, as are offers whose lead is outside this
 *   account's lead scope.
 *
 * The source breakdown is shown separately rather than summed, because an
 * accepted offer becomes an invoice: adding every source would count one sale
 * several times. Only document pipeline that no lead already represents is
 * added to the top-line figures, and the server has already made that
 * distinction - this screen just displays it.
 *
 * Stage probabilities are the server's defaults, shown as editable percentages
 * for what-if analysis. Editing one changes only this screen's weighted figures;
 * nothing is persisted, because a weight is a modelling assumption rather than a
 * record. Document pipeline is weighted by the server's fixed offer/quote
 * percentages and is not editable here.
 */
export default function SalesForecastingModule() {
  const dateQuery = useSelector(selectDateRangeQuery);
  const dateDescription = useSelector(selectDateRangeDescription);

  const { startDate, endDate } = dateQuery;

  const { moneyFormatter } = useMoney();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Stage value -> probability override, 0..1. Kept in state only.
  const [weights, setWeights] = useState({});

  const money = useCallback((amount) => moneyFormatter({ amount: Number(amount) || 0 }), [moneyFormatter]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    try {
      const response = await request.summary({ entity: 'salesforecast', options: dateQuery });

      if (response?.success && response.result) {
        setData(response.result);
      } else {
        setFailed(true);
        setData(null);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  // A new window is a new forecast; carrying what-if weights across it would
  // silently compare two different periods at one reader's invented assumptions.
  useEffect(() => {
    setWeights({});
  }, [startDate, endDate]);

  const stages = useMemo(() => {
    if (!data?.stages) return [];

    return data.stages.map((stage) => {
      const probability = weights[stage.stage] ?? stage.probability;
      return {
        ...stage,
        effectiveProbability: probability,
        adjustedWeighted: (Number(stage.rawValue) || 0) * probability,
      };
    });
  }, [data, weights]);

  const adjusted = useMemo(() => {
    const open = stages.filter((stage) => !stageOf(stage.stage).closed);

    // Document pipeline that no lead already represents: active quotes, plus
    // offers whose lead is outside this account's lead scope. The server has
    // already excluded anything it added to a lead's value, so this is additive
    // rather than a second count.
    const documentWeighted = Number(data?.kpis?.documentWeightedValue) || 0;
    const documentCommit = Number(data?.kpis?.documentCommitValue) || 0;

    const leadWeightedValue = open.reduce((sum, stage) => sum + stage.adjustedWeighted, 0);

    const weightedValue = leadWeightedValue + documentWeighted;

    const commitValue =
      open
        .filter((stage) => stage.stage === 'Proposal Sent' || stage.stage === 'In Negotiation')
        .reduce((sum, stage) => sum + stage.adjustedWeighted, 0) + documentCommit;

    return { weightedValue, commitValue, leadWeightedValue };
  }, [stages, data?.kpis?.documentWeightedValue, data?.kpis?.documentCommitValue]);

  const kpis = data?.kpis;
  const sources = data?.sources;

  const stageColumns = [
    {
      title: 'Stage',
      dataIndex: 'stage',
      render: (value) => {
        const stage = stageOf(value);
        return <Tag color={stage.color}>{stage.label}</Tag>;
      },
    },
    {
      title: 'Deals',
      dataIndex: 'count',
      width: 90,
      align: 'right',
    },
    {
      title: 'Pipeline value',
      dataIndex: 'rawValue',
      width: 160,
      align: 'right',
      render: (value) => money(value),
    },
    {
      title: 'Probability',
      key: 'probability',
      width: 140,
      render: (_, record) => (
        <InputNumber
          size="small"
          min={0}
          max={100}
          precision={0}
          value={Math.round(record.effectiveProbability * 100)}
          addonAfter="%"
          style={{ width: '100%' }}
          onChange={(value) => {
            const next = Number(value);
            setWeights((current) => ({
              ...current,
              [record.stage]: Number.isFinite(next) ? Math.min(Math.max(next, 0), 100) / 100 : 0,
            }));
          }}
        />
      ),
    },
    {
      title: 'Weighted forecast',
      dataIndex: 'adjustedWeighted',
      width: 170,
      align: 'right',
      render: (value) => <Text strong>{money(value)}</Text>,
    },
  ];

  const monthColumns = [
    { title: 'Month', dataIndex: 'label' },
    {
      title: 'Open pipeline',
      dataIndex: 'rawValue',
      width: 170,
      align: 'right',
      render: (value) => money(value),
    },
    {
      title: 'Weighted forecast',
      dataIndex: 'weightedValue',
      width: 180,
      align: 'right',
      render: (value) => <Text strong>{money(value)}</Text>,
    },
  ];

  const opportunityColumns = [
    {
      title: 'Opportunity',
      dataIndex: 'name',
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      width: 150,
      render: (value) => {
        const stage = stageOf(value);
        return <Tag color={stage.color}>{stage.label}</Tag>;
      },
    },
    {
      title: 'Value',
      dataIndex: 'value',
      width: 160,
      align: 'right',
      render: (value) => money(value),
    },
    {
      title: 'Weighted',
      dataIndex: 'weightedValue',
      width: 160,
      align: 'right',
      render: (value) => <Text strong>{money(value)}</Text>,
    },
    {
      title: 'Next follow-up',
      dataIndex: 'followUpDate',
      width: 150,
      render: (value) =>
        value ? (
          <Text>{dayjs(value).format('DD MMM YYYY')}</Text>
        ) : (
          <Text type="secondary">Not set</Text>
        ),
    },
    {
      title: 'Owner',
      dataIndex: 'assignee',
      width: 150,
      render: (value) => value || <Text type="secondary">Unassigned</Text>,
    },
  ];

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
            Sales Forecasting
          </Title>
          <Text type="secondary" style={{ display: 'block' }}>
            Live weighted pipeline, commit projection and booked revenue - open deals are not
            hidden by the header range.
          </Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12.5 }}>
            Header window {dateDescription} applies to closed outcomes and booked documents; the
            open pipeline is always current.
          </Text>
        </div>

        <Tooltip title="Recalculate the forecast">
          <Button
            icon={<ReloadOutlined />}
            onClick={load}
            loading={loading}
            aria-label="Recalculate forecast"
          />
        </Tooltip>
      </div>

      {failed && (
        <Alert
          type="error"
          showIcon
          message="Could not calculate the forecast"
          description="The underlying records could not be read. Reload to try again; if it keeps failing, your access to the Sales Forecasting module may have changed."
        />
      )}

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} sm={24} md={12} lg={6} xl={6}>
          <StatTile
            style={{ height: '100%' }}
            icon={<BarChartOutlined />}
            label="Total pipeline value"
            value={money(kpis?.pipelineValue)}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={24} md={12} lg={6} xl={6}>
          <StatTile
            style={{ height: '100%' }}
            icon={<LineChartOutlined />}
            label="Weighted forecast"
            value={money(adjusted.weightedValue)}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={24} md={12} lg={6} xl={6}>
          <StatTile
            style={{ height: '100%' }}
            icon={<AimOutlined />}
            label="Commit projection"
            value={money(adjusted.commitValue)}
            color="var(--color-warning-500)"
          />
        </Col>
        <Col xs={24} sm={24} md={12} lg={6} xl={6}>
          <StatTile
            style={{ height: '100%' }}
            icon={<RiseOutlined />}
            label="Best-case projection"
            value={money(kpis?.bestCaseValue)}
            color="var(--color-brand-500)"
          />
        </Col>
        <Col xs={24} sm={24} md={12} lg={6} xl={6}>
          <StatTile
            style={{ height: '100%' }}
            icon={<PercentageOutlined />}
            label={
              kpis?.winRateScope === 'window' ? 'Win rate (this window)' : 'Win rate (all time)'
            }
            value={`${(Math.round((kpis?.winRate || 0) * 10) / 10).toFixed(1)}%`}
            color="var(--color-success-500)"
          />
        </Col>
        <Col xs={24} sm={24} md={12} lg={6} xl={6}>
          <StatTile
            style={{ height: '100%' }}
            icon={<DollarOutlined />}
            label="Average deal size"
            value={money(kpis?.averageDealSize)}
            color="var(--color-success-500)"
          />
        </Col>
      </Row>

      <div
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          padding: 16,
          boxShadow: 'var(--app-shadow)',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 16 }}>
            Stage-by-stage forecast
          </Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12.5 }}>
            Standard probabilities are used unless you change one. Edits affect this screen only.
            A lead uses its own value, or its largest active offer when it has none; active quotes
            and unlinked offers are added to the weighted figures separately.
          </Text>
        </div>

        <Table
          rowKey="stage"
          columns={stageColumns}
          dataSource={stages}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong>Open pipeline</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong>{stages.filter((stage) => !stageOf(stage.stage).closed).reduce((sum, stage) => sum + stage.count, 0)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong>{money(kpis?.leadPipelineValue)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} align="right">
                  <Text strong>{money(adjusted.leadWeightedValue)}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <div
            style={{
              background: 'var(--app-surface)',
              border: '1px solid var(--app-border)',
              borderRadius: 12,
              padding: 16,
              boxShadow: 'var(--app-shadow)',
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 16 }}>
                <CalendarOutlined style={{ marginInlineEnd: 8 }} />
                Monthly projection
              </Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 12.5 }}>
                Open opportunities grouped by next follow-up date. Pipeline with no date is listed as
                unscheduled rather than credited to a month.
              </Text>
            </div>

            <Table
              rowKey="key"
              columns={monthColumns}
              dataSource={data?.months ?? []}
              loading={loading}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </Col>

        <Col xs={24} xl={12}>
          <div
            style={{
              background: 'var(--app-surface)',
              border: '1px solid var(--app-border)',
              borderRadius: 12,
              padding: 16,
              boxShadow: 'var(--app-shadow)',
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 16 }}>
                <TrophyOutlined style={{ marginInlineEnd: 8 }} />
                Source breakdown
              </Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 12.5 }}>
                Reported separately, not summed: an accepted offer becomes an invoice, so adding
                every source would count one sale more than once. Offers and quotes are live;
                orders and invoices follow the header window.
              </Text>
            </div>

            <Table
              rowKey="label"
              loading={loading}
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={[
                {
                  label: 'Open offers (live)',
                  count: sources?.offerCount ?? 0,
                  value: sources?.offerValue ?? 0,
                },
                {
                  label: 'Open quotes (live)',
                  count: sources?.quoteCount ?? 0,
                  value: sources?.quoteValue ?? 0,
                },
                {
                  label: 'Added to forecast (not on a lead)',
                  count: null,
                  value: sources?.documentValue ?? 0,
                },
                {
                  label: 'Orders (in window)',
                  count: sources?.orderCount ?? 0,
                  value: sources?.orderValue ?? 0,
                },
                {
                  label: 'Invoiced, booked (in window)',
                  count: sources?.invoiceCount ?? 0,
                  value: sources?.bookedRevenue ?? 0,
                },
              ]}
              columns={[
                { title: 'Source', dataIndex: 'label' },
                {
                  title: 'Records',
                  dataIndex: 'count',
                  width: 100,
                  align: 'right',
                  render: (value) => (value === null ? <Text type="secondary">-</Text> : value),
                },
                {
                  title: 'Value',
                  dataIndex: 'value',
                  width: 170,
                  align: 'right',
                  render: (value) => money(value),
                },
              ]}
            />
          </div>
        </Col>
      </Row>

      <div
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          borderRadius: 12,
          padding: 16,
          boxShadow: 'var(--app-shadow)',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 16 }}>
            Top high-value opportunities
          </Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12.5 }}>
            Open leads ranked by weighted value, with each lead's value taken from its own total or
            its largest active offer.{' '}
            {kpis?.winRateScope === 'window'
              ? `Win rate counts closed leads entered in this window: ${kpis?.wonCount ?? 0} won of ${(kpis?.wonCount ?? 0) + (kpis?.lostCount ?? 0)} closed.`
              : (kpis?.wonCount ?? 0) + (kpis?.lostCount ?? 0) > 0
                ? `The window contains no closed lead, so the win rate uses all closed leads: ${kpis?.wonCount ?? 0} won of ${(kpis?.wonCount ?? 0) + (kpis?.lostCount ?? 0)}.`
                : 'No lead has been marked Won or Lost yet, so the win rate is not meaningful.'}
          </Text>
        </div>

        <Table
          rowKey="id"
          columns={opportunityColumns}
          dataSource={data?.topOpportunities ?? []}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
        />
      </div>
    </Space>
  );
}
