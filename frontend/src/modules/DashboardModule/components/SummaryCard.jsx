import { Tag, Divider, Row, Col, Spin, Tooltip } from 'antd';
import { useMoney } from '@/settings';
import { selectMoneyFormat } from '@/redux/settings/selectors';
import { useSelector } from 'react-redux';

/**
 * The column widths used when the caller names none: a quarter of the row on a
 * desktop grid.
 *
 * That is what this card was hardcoded to before it took a `span`, and it is
 * correct only for a row of exactly four. The dashboard's financial row has four
 * of these, but a child account may hold fewer of the modules behind them, and
 * the widths have to come from how many cards are really being drawn - a count
 * this component has no way to know. So the count is passed in, and this is the
 * answer for any caller that has no count to offer.
 */
const DEFAULT_SPAN = { xs: { span: 24 }, sm: { span: 12 }, md: { span: 12 }, lg: { span: 6 } };

export default function AnalyticSummaryCard({
  title,
  tagColor,
  data,
  prefix,
  isLoading = false,
  span,
  isSingleCard = false,
}) {
  const { moneyFormatter } = useMoney();
  const money_format_settings = useSelector(selectMoneyFormat);

  /**
   * A lone card is laid out left, and every other count is laid out exactly as
   * it was before this prop existed.
   *
   * The width is not the problem when one card survives - the caller already
   * gives it the full row, and that is correct. What goes wrong is everything
   * inside it: the title is centred and the value is centred, which is the right
   * arrangement for a quarter-width card in a row of four and reads as stretched
   * across a whole desktop dashboard. So both move to the left edge and the
   * caption and the amount sit together at the start of the row, which is what a
   * single wide figure should look like.
   *
   * Every value below is written as a ternary whose false branch is the original
   * literal, rather than as a shared base style with the single-card case
   * layered on top. The requirement is that two, three and four cards render as
   * they always have, and a ternary that returns the old value verbatim is the
   * only shape where that is checkable by reading it. The tag's own maxWidth and
   * ellipsis are deliberately untouched in both branches: the amount stays a
   * compact tag at the start of the row instead of being allowed to run wide,
   * and long values keep the tooltip they already had.
   */
  const align = isSingleCard ? 'left' : 'center';

  return (
    <Col className="gutter-row" {...(span || DEFAULT_SPAN)}>
      <div
        className="whiteBox shadow"
        style={{
          color: 'var(--app-text-secondary)',
          fontSize: 13,
          minHeight: '106px',
          height: '100%',
        }}
      >
        <div
          className="pad15 strong"
          style={{ textAlign: align, justifyContent: isSingleCard ? 'flex-start' : 'center' }}
        >
          <h3
            style={{
              color: 'var(--app-text)',
              fontSize: 'large',
              margin: '5px 0',
              textTransform: 'capitalize',
            }}
          >
            {title}
          </h3>
        </div>
        <Divider style={{ padding: 0, margin: 0 }}></Divider>
        <div className="pad15">
          <Row
            gutter={[0, 0]}
            justify={isSingleCard ? 'flex-start' : 'space-between'}
            wrap={false}
          >
            <Col className="gutter-row" flex="85px" style={{ textAlign: 'left' }}>
              <div className="left" style={{ whiteSpace: 'nowrap' }}>
                {prefix}
              </div>
            </Col>
            <Divider
              style={{
                height: '100%',
                padding: '10px 0',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              type="vertical"
            ></Divider>
            <Col
              className="gutter-row"
              flex="auto"
              style={{
                display: 'flex',
                justifyContent: isSingleCard ? 'flex-start' : 'center',
                alignItems: 'center',
              }}
            >
              {isLoading ? (
                <Spin />
              ) : (
                <Tooltip
                  title={data}
                  style={{
                    direction: 'ltr',
                  }}
                >
                  <Tag
                    color={tagColor}
                    style={{
                      margin: isSingleCard ? 0 : '0 auto',
                      justifyContent: 'center',
                      maxWidth: '110px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      direction: 'ltr',
                    }}
                  >
                    {data
                      ? moneyFormatter({
                          amount: data,
                          currency_code: money_format_settings?.default_currency_code,
                        })
                      : moneyFormatter({
                          amount: 0,
                          currency_code: money_format_settings?.default_currency_code,
                        })}
                  </Tag>
                </Tooltip>
              )}
            </Col>
          </Row>
        </div>
      </div>
    </Col>
  );
}
