import dayjs from 'dayjs';
import { Tag } from 'antd';
import { tagColor } from '@/utils/statusTagColor';

import OfferDataTableModule from '@/modules/OfferModule/OfferDataTableModule';
import { useMoney, useDate } from '@/settings';
import useLanguage from '@/locale/useLanguage';

export default function Offer() {
  const translate = useLanguage();
  const { moneyFormatter } = useMoney();
  const { dateFormat } = useDate();

  const searchConfig = {
    entity: 'lead',
    displayLabels: ['name'],
    searchFields: 'name',
  };
  const deleteModalLabels = ['number', 'lead.name'];
  const dataTableColumns = [
    {
      title: translate('Number'),
      dataIndex: 'number',
    },
    {
      title: translate('Company'),
      dataIndex: ['lead', 'name'],
    },
    {
      title: translate('Date'),
      dataIndex: 'date',
      render: (date) => dayjs(date).format(dateFormat),
    },
    {
      /**
       * Both prices, in the one column the figure was already in.
       *
       * `subTotal` is what the items add up to before anything comes off, and
       * `total` is what the lead actually pays; the two are only shown apart
       * when a discount has moved one from the other, so an offer with no
       * discount shows a single figure rather than a struck-through number
       * identical to the one beside it. The struck-through figure is the
       * original, kept legible because "was 1,200, now 1,155" is the thing the
       * discount column is for.
       */
      title: translate('Price'),
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
      render: (total, record) => {
        const hasDiscount = record.discount > 0 && record.subTotal !== total;

        return (
          <>
            {hasDiscount && (
              <span
                style={{
                  textDecoration: 'line-through',
                  opacity: 0.55,
                  marginRight: 8,
                }}
              >
                {moneyFormatter({ amount: record.subTotal, currency_code: record.currency })}
              </span>
            )}
            {moneyFormatter({ amount: total, currency_code: record.currency })}
          </>
        );
      },
    },

    {
      title: translate('Note'),
      dataIndex: 'notes',
    },
    {
      title: translate('Status'),
      dataIndex: 'status',
      render: (status) => {
        let tagStatus = tagColor(status);

        return (
          <Tag color={tagStatus.color}>
            {/* {tagStatus.icon + ' '} */}
            {status && translate(tagStatus.label)}
          </Tag>
        );
      },
    },
  ];

  const entity = 'offer';
  const Labels = {
    PANEL_TITLE: translate('Offer Leads'),
    DATATABLE_TITLE: translate('offer_list'),
    ADD_NEW_ENTITY: translate('add_new_offer'),
    ENTITY_NAME: translate('Offer Leads'),
  };

  const configPage = {
    entity,
    ...Labels,
  };
  const config = {
    ...configPage,
    dataTableColumns,
    searchConfig,
    deleteModalLabels,
  };
  return <OfferDataTableModule config={config} />;
}
