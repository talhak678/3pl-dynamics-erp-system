import { useEffect, useRef, useState } from 'react';

import { notification, Row, Col, Button } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import useLanguage from '@/locale/useLanguage';

import { useMoney } from '@/settings';

import { request } from '@/request';
import useOnFetch from '@/hooks/useOnFetch';

import useDateRange from './useDateRange';

import RecentTable from './components/RecentTable';
import DateRangeFilter from './components/DateRangeFilter';

import SummaryCard from './components/SummaryCard';
import PreviewCard from './components/PreviewCard';
import CustomerPreviewCard from './components/CustomerPreviewCard';
import SalesAnalytics from './components/SalesAnalytics';

import { selectMoneyFormat } from '@/redux/settings/selectors';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { hasModule, isMissingModules } from '@/utils/modulePermissions';
import { canUseSalesPipeline } from '@/utils/salesPipeline';
import { isTenantOwner } from '@/utils/tenantOwner';
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
   *
   * Addressed to the Customer Admin only. An employee is missing modules because
   * their employer decided they should be, and they have no way to act on
   * "contact our support team to upgrade" — telling them to buy something they
   * are not entitled to buy is a notice about somebody else's decision. The
   * missing modules are not news to them either: this dashboard already draws
   * only the cards they hold (see `can` above) and the sidebar only the entries
   * they hold, so the absence is the normal shape of their app rather than a
   * problem reported to them. The owner, by contrast, is the one account that
   * can act on it, and the only one for whom "some modules" is unexpected.
   *
   * The ref is set only on the path that notifies, so the early returns above it
   * stay free to be reconsidered when `currentAdmin` changes. Nothing that
   * reaches them is a decision worth freezing: a session that has not yet
   * resolved its account holds no module list at all, which reads as
   * unrestricted, so it exits here without claiming the one showing.
   */
  const upgradeNoticeShown = useRef(false);

  useEffect(() => {
    if (upgradeNoticeShown.current || !isMissingModules(currentAdmin)) return;
    if (!isTenantOwner(currentAdmin)) return;

    upgradeNoticeShown.current = true;

    notification.warning({
      key: UPGRADE_NOTIFICATION_KEY,
      message: UPGRADE_MESSAGE,
      duration: 8,
    });
  }, [currentAdmin]);

  /**
   * The window every card on this page is read over.
   *
   * Monthly on first load, and the two parameters it resolves to are appended to
   * each summary call below. The cards that take them are the ones counting over
   * a period - money in, money owed, quotes raised, offers out, clients gained -
   * and the server applies the window to each document's own business date, so
   * the figures answer over the range the header names rather than over whatever
   * the server used to pick for itself.
   *
   * Nothing here touches who may see what. The dates arrive at the server as a
   * separate `$and` clause beside the tenant and ownership filters, so they can
   * only ever narrow the records an account was already allowed to read - see
   * utils/dateRange.js in the backend. A Sales Executive choosing "Yearly" gets
   * one year of their own records, never a year of the workspace's.
   */
  const {
    query: dateQuery,
    description: dateDescription,
    preset,
    custom,
    apply,
    reset,
  } = useDateRange();

  const getStatsData = async ({ entity, currency }) => {
    return await request.summary({
      entity,
      options: { currency, ...dateQuery },
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

  // The customer card used to run through useFetch, which fires once on mount
  // and offers no way to ask for it again - its effect runs on isLoading and
  // takes no dependency list. The card counts clients inside the window, so it
  // has to be re-asked whenever the window moves, and useOnFetch is the variant
  // that can be driven from the effect below.
  //
  // The hook itself has to run every render - hooks cannot be called
  // conditionally - so the guard goes inside the effect it is called from.
  const {
    result: clientResult,
    isLoading: clientLoading,
    onFetch: fetchClientsStats,
  } = useOnFetch();

  useEffect(() => {
    const currency = money_format_settings.default_currency_code || null;

    if (currency) {
      if (can('invoice')) fetchInvoicesStats(getStatsData({ entity: 'invoice', currency }));
      if (can('quote')) fetchQuotesStats(getStatsData({ entity: 'quote', currency }));
      if (can('offer')) fetchOffersStats(getStatsData({ entity: 'offer', currency }));
      if (can('payment')) fetchPayemntsStats(getStatsData({ entity: 'payment', currency }));
    }

    // Asked outside the currency guard because its question holds no currency:
    // this card counts clients, not money, so a workspace whose default currency
    // is still unset can answer it perfectly well.
    if (can('customer')) fetchClientsStats(request.summary({ entity: 'client', options: dateQuery }));

    /*
     * The two date bounds are named individually rather than depending on
     * `dateQuery`, so the effect re-runs when the window itself moves and not
     * when the object wrapping it is rebuilt. They are strings, and they change
     * only when the user applies a different range.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    money_format_settings.default_currency_code,
    currentAdmin,
    dateQuery.startDate,
    dateQuery.endDate,
  ]);

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
   *
   * The three period-labelled cards now take their prefix from the chosen
   * window rather than from the words 'This month'. Those words were true while
   * the range was fixed, and the moment the range became the reader's to choose
   * they became a claim the figures underneath could contradict - a card
   * captioned 'This month' over twelve months of totals. The prefix is the
   * window's own name, so it can only ever describe what was asked for.
   *
   * The Unpaid Invoice card keeps 'Not Paid' as its prefix. That one names a
   * state rather than a span, and 'unpaid invoices in the chosen period' is the
   * same claim at any window, so there is nothing there to go stale.
   */
  const financialCards = [
    {
      moduleKey: 'payment',
      title: translate('Paid Invoice'),
      prefix: dateDescription,
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
      prefix: dateDescription,
      isLoading: quoteLoading,
      data: quoteResult?.total,
    },
    {
      moduleKey: 'offer',
      title: translate('Offer'),
      prefix: dateDescription,
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
        {/*
          The header row holds the page's two controls: the window everything
          below is read over, on the left, and the report on the right. The range
          sits first because it governs the numbers the report summarises - it is
          the setting, and the report is the output of it.
        */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <DateRangeFilter
              preset={preset}
              custom={custom}
              description={dateDescription}
              onApply={apply}
              onReset={reset}
            />
          </Col>
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
                  // A lone card is the one case the width alone cannot fix. It
                  // fills the row, and a centred title with a centred value
                  // spread across the full width of a desktop dashboard is the
                  // arrangement this was reported for - the card is right, the
                  // alignment inside it is what reads as stretched. The card
                  // left-aligns its own contents when it is told it is alone;
                  // with two or more it lays out exactly as it always has.
                  isSingleCard={financialCards.length === 1}
                />
              ))}
            </Row>
            <div className="space30"></div>
          </>
        )}
        {/*
          Sales analytics sits above the statistics row rather than below it.

          The page reads top-down as: the money this month, then how the pipeline
          is producing it, then the per-module breakdowns, then the recent
          documents. The analytics block is the only section that answers "how
          are we doing", so it belongs directly under the figures it explains -
          below the breakdowns it arrived after a full row of tiles the reader
          had to scroll past first.

          The two sections are not independent: each emits its own trailing
          spacer, and the spacer has to follow whichever section is really next.
          The analytics block therefore releases its gap to the statistics row or
          the recent tables, and the statistics row releases its own only to the
          recent tables - so a page showing one section and not the next does not
          pay for a gap that leads nowhere.
        */}
        {showSalesAnalytics && (
          <>
            {/*
              The pipeline cards read the same window as everything above them.
              They fetch through the leads listAll rather than a summary, and the
              window reaches that call as these same two parameters - so the
              control in the header governs this section too, and the caption
              inside it says which question the window is answering there, which
              is not quite the same one it answers for the money cards.
            */}
            <SalesAnalytics dateQuery={dateQuery} period={dateDescription} />
            {(showStatisticsRow || showRecentTables) && <div className="space30"></div>}
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
                    // The dial's figure is the share of the client base gained
                    // inside the window, so it is captioned with the window
                    // rather than with a fixed 'this Month'.
                    period={dateDescription}
                  />
                </Col>
              )}
            </Row>
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
