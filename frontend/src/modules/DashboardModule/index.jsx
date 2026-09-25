import { useEffect, useRef, useState } from 'react';

import { notification, Row, Col, Button } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import useLanguage from '@/locale/useLanguage';

import { useMoney } from '@/settings';

import { request } from '@/request';
import useFetch from '@/hooks/useFetch';
import useOnFetch from '@/hooks/useOnFetch';

import RecentTable from './components/RecentTable';

import SummaryCard from './components/SummaryCard';
import PreviewCard from './components/PreviewCard';
import CustomerPreviewCard from './components/CustomerPreviewCard';
import SalesAnalytics from './components/SalesAnalytics';

import { selectMoneyFormat } from '@/redux/settings/selectors';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { hasModule, isMissingModules } from '@/utils/modulePermissions';
import { canUseSalesPipeline } from '@/utils/salesPipeline';
import { UPGRADE_MESSAGE, UPGRADE_NOTIFICATION_KEY } from '@/request/errorHandler';
import { useSelector } from 'react-redux';

export default function DashboardModule() {
  const translate = useLanguage();
  const { moneyFormatter } = useMoney();
  const money_format_settings = useSelector(selectMoneyFormat);
  const currentAdmin = useSelector(selectCurrentAdmin);

  /**
   * Every card on this page is backed by its own summary endpoint, and a tenant
   * who does not hold a module gets a 403 for the call behind it. Asking anyway
   * costs a round trip and returns nothing, so each call is made only for a
   * module the account actually holds.
   *
   * The module key is named at the call site rather than derived from the entity
   * name, because the two are not always the same word — the customer module's
   * endpoints live under /client, and the expenses module's under /expense.
   * Deriving it would be right for most entities and quietly wrong for those.
   *
   * For an unrestricted account hasModule() is true for everything, so this
   * dashboard behaves exactly as it did before.
   */
  const can = (moduleKey) => hasModule(currentAdmin, moduleKey);

  /**
   * The upgrade notice, raised from the permissions rather than from a failed
   * call.
   *
   * Now that this dashboard no longer asks for a module the account does not
   * hold, no request is refused on this page — so the request layer's safety net
   * has nothing to report here, and the notice has to come from the permissions
   * themselves. A ref rather than empty deps keeps it to one showing per mount
   * without suppressing the exhaustive-deps rule, and it works under StrictMode's
   * double-invoke too.
   *
   * It shares a notification key with that safety net, so if a refusal does still
   * arrive mid-session the two update one another instead of stacking.
   */
  const upgradeNoticeShown = useRef(false);

  useEffect(() => {
    if (upgradeNoticeShown.current || !isMissingModules(currentAdmin)) return;

    upgradeNoticeShown.current = true;

    notification.warning({
      key: UPGRADE_NOTIFICATION_KEY,
      message: UPGRADE_MESSAGE,
      duration: 8,
    });
  }, [currentAdmin]);

  const getStatsData = async ({ entity, currency }) => {
    return await request.summary({
      entity,
      options: { currency },
    });
  };

  const {
    result: invoiceResult,
    isLoading: invoiceLoading,
    onFetch: fetchInvoicesStats,
  } = useOnFetch();

  const { result: quoteResult, isLoading: quoteLoading, onFetch: fetchQuotesStats } = useOnFetch();

  const { result: offerResult, isLoading: offerLoading, onFetch: fetchOffersStats } = useOnFetch();

  const {
    result: paymentResult,
    isLoading: paymentLoading,
    onFetch: fetchPayemntsStats,
  } = useOnFetch();

  // The hook itself has to run every render — hooks cannot be called
  // conditionally — so the guard goes inside the callback it invokes.
  const { result: clientResult, isLoading: clientLoading } = useFetch(() =>
    can('customer') ? request.summary({ entity: 'client' }) : Promise.resolve({ result: null })
  );

  useEffect(() => {
    const currency = money_format_settings.default_currency_code || null;

    if (currency) {
      if (can('invoice')) fetchInvoicesStats(getStatsData({ entity: 'invoice', currency }));
      if (can('quote')) fetchQuotesStats(getStatsData({ entity: 'quote', currency }));
      if (can('offer')) fetchOffersStats(getStatsData({ entity: 'offer', currency }));
      if (can('payment')) fetchPayemntsStats(getStatsData({ entity: 'payment', currency }));
    }
  }, [money_format_settings.default_currency_code, currentAdmin]);

  const dataTableColumns = [
    {
      title: translate('number'),
      dataIndex: 'number',
    },
    {
      title: translate('Client'),
      dataIndex: ['client', 'name'],
    },

    {
      title: translate('Total'),
      dataIndex: 'total',
      onCell: () => {
        return {
          style: {
            textAlign: 'right',
            whiteSpace: 'nowrap',
            direction: 'ltr',
          },
        };
      },
      render: (total, record) => moneyFormatter({ amount: total, currency_code: record.currency }),
    },
    {
      title: translate('Status'),
      dataIndex: 'status',
    },
  ];

  // Cards for modules the account does not hold are dropped rather than left in
  // place showing a zero. An empty "Invoices" panel reads as "you have no
  // invoices", which is a different and misleading statement from "you cannot
  // see invoices".
  const entityData = [
    {
      result: invoiceResult,
      isLoading: invoiceLoading,
      entity: 'invoice',
      moduleKey: 'invoice',
      title: translate('Invoices'),
    },
    {
      result: quoteResult,
      isLoading: quoteLoading,
      entity: 'quote',
      moduleKey: 'quote',
      title: translate('Quotes For Customers'),
    },
    {
      /*
       * The tile that reads like a quote and is not one.
       *
       * An Offer is the document that goes to a lead and a Quote the one that
       * goes to a customer, so this tile's title names the AUDIENCE while its
       * data, its endpoint and its gate all name the module: offerResult, which
       * only the can('offer') branch above ever fetches, from /api/offer/summary,
       * which the server resolves to `offer`. Nothing here is a copy-paste slip,
       * and can('quote') would be the wrong gate twice over - a quote-only
       * account would get a tile whose data was never requested, falling back to
       * the all-zero defaults, and an offer-only account would lose the one tile
       * that is theirs.
       *
       * Worded to match the sidebar entry for the same module ('Offers for
       * Leads' in NavigationContainer) rather than the 'Quotes For Leads' this
       * used to say. Two screens were describing one module in two different
       * words, which is what got this reported as a permission bug.
       */
      result: offerResult,
      isLoading: offerLoading,
      entity: 'offer',
      moduleKey: 'offer',
      title: translate('Offers for Leads'),
    },
  ].filter((data) => can(data.moduleKey));

  const statisticCards = entityData.map((data, index) => {
    const { result, entity, isLoading, title } = data;

    return (
      <PreviewCard
        key={index}
        title={title}
        isLoading={isLoading}
        entity={entity}
        statistics={
          !isLoading &&
          result?.performance?.map((item) => ({
            tag: item?.status,
            color: 'blue',
            value: item?.percentage,
          }))
        }
      />
    );
  });

  // Read once so the column widths below stay consistent with each other.
  const showCustomerCard = can('customer');
  const showInvoiceTable = can('invoice');
  const showQuoteTable = can('quote');
  const showRecentTables = showInvoiceTable || showQuoteTable;

  /**
   * The four financial summary cards, built as data and filtered by permission
   * before anything is rendered.
   *
   * Gathered into an array because the number that survive decides how wide each
   * one has to be, and a number is only available once the permits have been
   * applied. Written as four inline conditionals - which is what this was - the
   * row is rendered without ever knowing its own length, and each card falls
   * back to the quarter-width default it was built with. For an account holding
   * only two of the four modules that is two quarter-width cards and half a row
   * of empty space to their right. Nothing is wrong with either card; the row is
   * simply not full, and only the count can say so.
   *
   * Each card's own props are resolved here rather than at the call site, so the
   * titles and the endpoints they read from cannot drift apart.
   */
  const financialCards = [
    {
      moduleKey: 'payment',
      title: translate('Paid Invoice'),
      prefix: translate('This month'),
      isLoading: paymentLoading,
      data: paymentResult?.total,
    },
    {
      moduleKey: 'invoice',
      title: translate('Unpaid Invoice'),
      prefix: translate('Not Paid'),
      isLoading: invoiceLoading,
      data: invoiceResult?.total_undue,
    },
    {
      moduleKey: 'quote',
      title: translate('Quote'),
      prefix: translate('This month'),
      isLoading: quoteLoading,
      data: quoteResult?.total,
    },
    {
      moduleKey: 'offer',
      title: translate('Offer'),
      prefix: translate('This month'),
      isLoading: offerLoading,
      data: offerResult?.total,
    },
  ].filter((card) => can(card.moduleKey));

  /**
   * How wide one financial card is, given how many are being drawn.
   *
   * The rule is that every row is full. Four cards are a quarter each and three
   * a third, which is the desktop case this was reported for - but the rule has
   * to hold as the row narrows too, or the fix only moves the gap to a smaller
   * screen. So four cards are two per row at `md` rather than four of a sixth,
   * and three cards stack at `sm` rather than leaving a third of the row empty
   * beneath a pair. One and two cards already filled every breakpoint and are
   * unchanged.
   *
   * Beyond four there is nothing to say: this dashboard has four cards and
   * cannot grow a fifth without someone editing the array above, so the
   * four-card answer is the fallback rather than a lookup that returns undefined
   * and leaves Ant Design's default of 24 to stack them silently.
   *
   * The three-card entry is the one that changes anything an account could
   * already see: it is the only count the previous layout got wrong on the
   * desktop grid as well as on the way down.
   */
  const SPANS_BY_CARD_COUNT = {
    1: { xs: { span: 24 }, sm: { span: 24 }, md: { span: 24 }, lg: { span: 24 } },
    2: { xs: { span: 24 }, sm: { span: 12 }, md: { span: 12 }, lg: { span: 12 } },
    3: { xs: { span: 24 }, sm: { span: 24 }, md: { span: 24 }, lg: { span: 8 } },
    4: { xs: { span: 24 }, sm: { span: 12 }, md: { span: 12 }, lg: { span: 6 } },
  };

  const financialCardSpan = SPANS_BY_CARD_COUNT[financialCards.length] ?? SPANS_BY_CARD_COUNT[4];

  /**
   * Whether the financial row has anything to draw at all.
   *
   * Read off the filtered array rather than repeating the four permits, so the
   * gate and the cards it guards cannot come to disagree - the same reason the
   * row below reads `statisticCards.length`.
   */
  const showFinancialSummary = financialCards.length > 0;

  /**
   * Whether the statistics row has anything to draw at all.
   *
   * Both sections are read before the layout is written, because a section with
   * nothing in it is not free: the row still renders and the gap underneath it
   * is still emitted. An account holding none of the financial modules was
   * therefore paying for them in vertical space - a full row's height of nothing
   * between the header and the first card it could actually use, which is the
   * space the sales cards were being pushed down by.
   *
   * `statisticCards` rather than `entityData`: the filter above has already
   * dropped the modules the account does not hold, so this length is the number
   * of cards that will really be drawn.
   */
  const showStatisticsRow = statisticCards.length > 0 || showCustomerCard;

  /**
   * The sales analytics section, gated exactly as the pipeline board is.
   *
   * Deliberately not `can('lead')`. Holding the leads module is not the same as
   * having a pipeline: an employee granted `lead` works the leads list, and this
   * section would put a per-executive breakdown - colleagues' names, their
   * workloads, their win rates - on a dashboard that has never shown them
   * before. The Leads page exposes no assignee at all, so that would be the
   * section granting something the module never did.
   *
   * canUseSalesPipeline is the owner-or-executive check the board's menu entry
   * and route both read, so the three cannot drift apart.
   */
  const showSalesAnalytics = canUseSalesPipeline(currentAdmin);

  /**
   * Pulls the summary report and hands it to the browser as a file.
   *
   * The endpoint answers either a PDF or — on a host with no browser to render
   * one — the same printable page the other downloads fall back to. The reply's
   * Content-Type decides which: a PDF is saved under the name the server chose,
   * and a printable page is opened in a tab so the user's own browser can produce
   * the file. Without that branch the fallback would be saved as a file called
   * .pdf containing HTML.
   */
  const [reportLoading, setReportLoading] = useState(false);

  const handleDownloadReport = async () => {
    setReportLoading(true);

    try {
      const response = await request.download({ url: 'dashboard/report' });

      // A failure here has already been reported by the request layer, which
      // returns its own shape rather than a response.
      if (!response || !response.data) return;

      const contentType = response.headers['content-type'] || '';
      const objectUrl = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));

      // Long enough for either the save or the new tab to have taken it.
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);

      if (contentType.includes('text/html')) {
        window.open(objectUrl, '_blank');
        return;
      }

      const disposition = response.headers['content-disposition'] || '';
      const filename = disposition.match(/filename="([^"]+)"/);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename ? filename[1] : 'Dashboard_Report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setReportLoading(false);
    }
  };

  if (money_format_settings) {
    return (
      <>
        <Row justify="end" style={{ marginBottom: 20 }}>
          <Col>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              loading={reportLoading}
              onClick={handleDownloadReport}
            >
              {translate('Download Report')}
            </Button>
          </Col>
        </Row>
        {showFinancialSummary && (
          <>
            <Row gutter={[32, 32]}>
              {financialCards.map((card) => (
                <SummaryCard
                  key={card.moduleKey}
                  title={card.title}
                  prefix={card.prefix}
                  isLoading={card.isLoading}
                  data={card.data}
                  // One span for the whole row, from the count of cards in it.
                  // Every card in a row of N takes 1/N of the width, which is
                  // what makes the row fill exactly rather than leaving whatever
                  // the missing modules used to occupy sitting empty on the end.
                  span={financialCardSpan}
                />
              ))}
            </Row>
            <div className="space30"></div>
          </>
        )}
        {showStatisticsRow && (
          <>
            <Row gutter={[32, 32]}>
              {statisticCards.length > 0 && (
                <Col
                  className="gutter-row w-full"
                  sm={{ span: 24 }}
                  md={{ span: 24 }}
                  lg={{ span: showCustomerCard ? 18 : 24 }}
                >
                  <div className="whiteBox shadow" style={{ height: 458 }}>
                    <Row className="pad20" gutter={[0, 0]}>
                      {statisticCards}
                    </Row>
                  </div>
                </Col>
              )}
              {showCustomerCard && (
                <Col
                  className="gutter-row w-full"
                  sm={{ span: 24 }}
                  md={{ span: 24 }}
                  lg={{ span: statisticCards.length > 0 ? 6 : 24 }}
                >
                  <CustomerPreviewCard
                    isLoading={clientLoading}
                    activeCustomer={clientResult?.active}
                    newCustomer={clientResult?.new}
                  />
                </Col>
              )}
            </Row>
            <div className="space30"></div>
          </>
        )}
        {showSalesAnalytics && (
          <>
            <SalesAnalytics />
            {showRecentTables && <div className="space30"></div>}
          </>
        )}
        {showRecentTables && (
          <Row gutter={[32, 32]}>
            {showInvoiceTable && (
              <Col
                className="gutter-row w-full"
                sm={{ span: 24 }}
                lg={{ span: showQuoteTable ? 12 : 24 }}
              >
                <div className="whiteBox shadow pad20" style={{ height: '100%' }}>
                  <h3 style={{ color: 'var(--app-text)', marginBottom: 5, padding: '0 20px 20px' }}>
                    {translate('Recent Invoices')}
                  </h3>

                  <RecentTable entity={'invoice'} dataTableColumns={dataTableColumns} />
                </div>
              </Col>
            )}

            {showQuoteTable && (
              <Col
                className="gutter-row w-full"
                sm={{ span: 24 }}
                lg={{ span: showInvoiceTable ? 12 : 24 }}
              >
                <div className="whiteBox shadow pad20" style={{ height: '100%' }}>
                  <h3 style={{ color: 'var(--app-text)', marginBottom: 5, padding: '0 20px 20px' }}>
                    {translate('Recent Quotes')}
                  </h3>
                  <RecentTable entity={'quote'} dataTableColumns={dataTableColumns} />
                </div>
              </Col>
            )}
          </Row>
        )}
      </>
    );
  } else {
    return <></>;
  }
}
