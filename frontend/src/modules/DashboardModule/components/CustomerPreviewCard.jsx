import { Statistic, Progress, Divider, Row, Spin } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import useLanguage from '@/locale/useLanguage';

/**
 * The percentage of the client base that is new, over whatever window the
 * dashboard is currently reading - and the period it actually covers, passed in
 * rather than assumed.
 *
 * The label under the dial used to read 'New Customer this Month' as a fixed
 * string, which was accurate while the dashboard had one fixed window. Now that
 * the reader chooses the range, a hard-coded 'this Month' would caption a
 * twelve-month figure, so the period is a prop and defaults to the dashboard's
 * own default rather than to nothing.
 */
export default function CustomerPreviewCard({
  isLoading = false,
  activeCustomer = 0,
  newCustomer = 0,
  period = 'Last 30 days',
}) {
  const translate = useLanguage();
  return (
    <Row className="gutter-row">
      <div className="whiteBox shadow" style={{ height: 458 }}>
        <div
          className="pad20"
          style={{
            textAlign: 'center',
            justifyContent: 'center',
          }}
        >
          <h3
            style={{
              color: 'var(--app-text)',
              marginBottom: 40,
              marginTop: 15,
              fontSize: 'large',
            }}
          >
            {translate('Customers')}
          </h3>

          {isLoading ? (
            <Spin />
          ) : (
            <div
              style={{
                display: 'grid',
                justifyContent: 'center',
              }}
            >
              <Progress type="dashboard" percent={newCustomer} size={148} />
              <p>{`${translate('New Customer')} · ${period}`}</p>
              <Divider />
              <Statistic
                title={translate('Active Customer')}
                value={activeCustomer}
                precision={2}
                valueStyle={{ color: 'var(--app-text)' }}
                prefix={
                  activeCustomer > 0 ? (
                    <ArrowUpOutlined />
                  ) : activeCustomer < 0 ? (
                    <ArrowDownOutlined />
                  ) : null
                }
                suffix="%"
              />
            </div>
          )}
        </div>
      </div>
    </Row>
  );
}
