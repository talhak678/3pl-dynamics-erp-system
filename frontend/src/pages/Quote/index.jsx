import dayjs from 'dayjs';
import QuoteDataTableModule from '@/modules/QuoteModule/QuoteDataTableModule';
import { useMoney, useDate } from '@/settings';
import useLanguage from '@/locale/useLanguage';

export default function Quote() {
  const translate = useLanguage();
  const { dateFormat } = useDate();
  const { moneyFormatter } = useMoney();
  const entity = 'quote';

  const searchConfig = {
    entity: 'client',
    displayLabels: ['name'],
    searchFields: 'name',
  };
  const deleteModalLabels = ['number', 'client.name'];
  const dataTableColumns = [
    { title: translate('Number'), dataIndex: 'number' },
    { title: translate('Client'), dataIndex: ['client', 'name'] },
    {
      title: translate('Date'),
      dataIndex: 'date',
      render: (date) => dayjs(date).format(dateFormat),
    },
    {
      title: translate('expired Date'),
      dataIndex: 'expiredDate',
      render: (date) => dayjs(date).format(dateFormat),
    },
    {
      title: translate('Sub Total'),
      dataIndex: 'subTotal',
      onCell: () => ({ style: { textAlign: 'right', whiteSpace: 'nowrap', direction: 'ltr' } }),
      render: (total, record) => moneyFormatter({ amount: total, currency_code: record.currency }),
    },
    {
      title: translate('Total'),
      dataIndex: 'total',
      onCell: () => ({ style: { textAlign: 'right', whiteSpace: 'nowrap', direction: 'ltr' } }),
      render: (total, record) => moneyFormatter({ amount: total, currency_code: record.currency }),
    },
    { title: translate('Status'), dataIndex: 'status' },
  ];

  const Labels = {
    PANEL_TITLE: translate('proforma invoice'),
    DATATABLE_TITLE: translate('proforma invoice_list'),
    ADD_NEW_ENTITY: translate('add_new_proforma invoice'),
    ENTITY_NAME: translate('proforma invoice'),
  };
  const config = { entity, ...Labels, dataTableColumns, searchConfig, deleteModalLabels };
  return <QuoteDataTableModule config={config} />;
}
