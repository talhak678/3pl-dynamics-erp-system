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
          {/*
            The caption and the amount, which now cannot land on top of each
            other however long the caption gets.

            The overlap was a float, not a width. The caption used to carry
            `className="left"`, and `.left` in style/partials/core.css is
            `float: left`, which takes the element out of the flow: the
            caption's flex column then had no in-flow content to hold it open,
            so it settled at its 85px basis while the floated text laid itself
            out at its own full width - and, since a float paints outside its
            parent's box, drew straight over the amount beside it. `wrap={false}`
            guaranteed there was nowhere for it to go. Nothing clipped it: the
            card's own `overflow: hidden` only catches what escapes the card,
            and what escaped here was a column.

            It was invisible for as long as the caption was the fixed words
            'This month', which are narrower than the 85px basis and so fitted
            inside it. Naming the chosen window in the caption is what gave it
            something long to say, and a custom range - '21/09/2026 -
            28/09/2026' - is the longest it ever says.

            So: the float is gone, the caption's column is sized by what it
            actually contains, and the row may wrap. On a card wide enough for
            both, nothing about the layout changes. On one that is not, the
            amount moves to a second line instead of colliding - the date range
            stays whole and readable rather than being cut to fit, which matters
            because the caption is the only thing on the card saying which
            period the figure belongs to.

            `minWidth: 0` and the ellipsis are the floor under that, for a card
            too narrow to hold even the caption alone. A flex item will not
            shrink below its content unless it is allowed to, and one that is
            neither allowed to shrink nor able to wrap overflows; giving it both
            means the worst case is a truncated caption rather than a collision.

            The vertical rule now travels with the amount rather than sitting
            between the two as its own item. Wrapping breaks a row into items in
            order, so a separate rule would have been left at the end of the
            first line with the amount on the second - a tick dangling after the
            caption. Grouped, the two move together and the rule stays where it
            belongs: immediately before the figure it separates.

            Everything else is as it was, including every isSingleCard branch.
            All four cards in a row stretch to the tallest (`height: 100%` on
            the card, and the caller's row stretches by default), so a caption
            long enough to wrap in one card makes all of them the same height
            rather than leaving one taller than its neighbours.
          */}
          <Row
            // No horizontal gutter, so the two items start and end flush with
            // the card's own padding. The 8 is a line gap, which antd puts on
            // the row itself rather than on the columns - it is what keeps the
            // amount from sitting directly under the caption once they wrap.
            gutter={[0, 8]}
            justify={isSingleCard ? 'flex-start' : 'space-between'}
            // Said out loud rather than left to the default, because the one
            // thing this row must never go back to is nowrap.
            wrap
          >
            <Col
              className="gutter-row"
              // `auto` rather than the 85px this used to be, and that is what
              // makes wrapping work at all: a row decides where to break from
              // each item's base size, and a base of 85px would tell it the
              // caption is narrower than it is. It would then keep both items on
              // one line and shrink the caption to fit - the truncated-caption
              // outcome, reached by the long route.
              flex="1 1 auto"
              style={{ minWidth: 0, textAlign: 'left' }}
            >
              <div
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {prefix}
              </div>
            </Col>
            <Col
              className="gutter-row"
              flex="0 0 auto"
              style={{
                display: 'flex',
                justifyContent: isSingleCard ? 'flex-start' : 'center',
                alignItems: 'center',
              }}
            >
              <Divider
                style={{
                  height: '100%',
                  padding: '10px 0',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                type="vertical"
              ></Divider>
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
