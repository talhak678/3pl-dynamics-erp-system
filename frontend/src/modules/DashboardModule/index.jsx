import { useEffect, useRef } from 'react';

import { notification, Row, Col } from 'antd';
import useLanguage from '@/locale/useLanguage';

import { useMoney } from '@/settings';

import { request } from '@/request';
import useFetch from '@/hooks/useFetch';
import useOnFetch from '@/hooks/useOnFetch';

import RecentTable from './components/RecentTable';

import SummaryCard from './components/SummaryCard';
import PreviewCard from './components/PreviewCard';
import CustomerPreviewCard from './components/CustomerPreviewCard';

import { selectMoneyFormat } from '@/redux/settings/selectors';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { hasModule, isMissingModules } from '@/utils/modulePermissions';
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
      result: offerResult,
      isLoading: offerLoading,
      entity: 'offer',
      moduleKey: 'offer',
      title: translate('Quotes For Leads'),
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

  if (money_format_settings) {
    return (
      <>
        <Row gutter={[32, 32]}>
          {can('payment') && (
            <SummaryCard
              title={translate('Paid Invoice')}
              prefix={translate('This month')}
              isLoading={paymentLoading}
              data={paymentResult?.total}
            />
          )}
          {can('invoice') && (
            <SummaryCard
              title={translate('Unpaid Invoice')}
              prefix={translate('Not Paid')}
              isLoading={invoiceLoading}
              data={invoiceResult?.total_undue}
            />
          )}
          {can('quote') && (
            <SummaryCard
              title={translate('Quote')}
              prefix={translate('This month')}
              isLoading={quoteLoading}
              data={quoteResult?.total}
            />
          )}
          {can('offer') && (
            <SummaryCard
              title={translate('Offer')}
              prefix={translate('This month')}
              isLoading={offerLoading}
              data={offerResult?.total}
            />
          )}
        </Row>
        <div className="space30"></div>
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
            <Col className="gutter-row w-full" sm={{ span: 24 }} md={{ span: 24 }} lg={{ span: 6 }}>
              <CustomerPreviewCard
                isLoading={clientLoading}
                activeCustomer={clientResult?.active}
                newCustomer={clientResult?.new}
              />
            </Col>
          )}
        </Row>
        <div className="space30"></div>
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
