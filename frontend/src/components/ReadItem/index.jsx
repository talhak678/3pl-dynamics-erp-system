import { Row, Col } from 'antd';
import { useSelector } from 'react-redux';

import dayjs from 'dayjs';
import { dataForRead } from '@/utils/dataStructure';

import { useCrudContext } from '@/context/crud';
import { selectCurrentItem } from '@/redux/crud/selectors';
import { assigneeLabel, get, valueByString } from '@/utils/helpers';

import useLanguage from '@/locale/useLanguage';
import { useDate } from '@/settings';

export default function ReadItem({ config }) {
  const { dateFormat } = useDate();
  let { readColumns, fields } = config;
  const translate = useLanguage();
  const { result: currentResult } = useSelector(selectCurrentItem);
  const { state } = useCrudContext();
  const { isReadBoxOpen } = state;

  if (fields) readColumns = [...dataForRead({ fields: fields, translate: translate })];

  /* The rows are derived here rather than held in state and filled from an
   * effect, which is what this used to do.
   *
   * Nothing about the panel changes: the effect only ever ran on a change to
   * currentResult, so the same values are produced by the same inputs. What it
   * buys is that the rows are a function of the record instead of a second
   * render behind it - and, concretely, that the panel can be rendered at all
   * outside a browser. An effect does not run during a server render, so the
   * old shape produced an empty panel there and left the assignee case
   * unverifiable. See the harness note in the ledger.
   */
  const itemsList = readColumns.map((props) => {
    const propsKey = props.dataIndex;
    const propsTitle = props.title;
    const isDate = props.isDate || false;
    const isAssignee = props.isAssignee || false;

    let value;

    if (isAssignee) {
      /* Read raw, through `get`, and deliberately not through valueByString.
       * That helper joins its parts with String(), so a populated assignee -
       * which is an object - would arrive at assigneeLabel as the literal text
       * "[object Object]" and be handed straight back. Verified, not assumed:
       * with the join in the path the harness reports the Assign To cell as
       * "[object Object]" and three checks fail. The unpopulated case is a
       * plain id and reads the same either way.
       */
      value = assigneeLabel(get(currentResult, propsKey));
    } else {
      value = valueByString(currentResult, propsKey);
      // Assignee is a separate branch rather than an extra condition here, so
      // an object can never reach dayjs and render an Invalid Date.
      if (isDate) value = dayjs(value).format(dateFormat);
    }

    return (
      <Row key={propsKey} gutter={12}>
        <Col className="gutter-row" span={8}>
          <p>{propsTitle}</p>
        </Col>
        <Col className="gutter-row" span={2}>
          <p> : </p>
        </Col>
        <Col className="gutter-row" span={14}>
          <p>{value}</p>
        </Col>
      </Row>
    );
  });

  const show = isReadBoxOpen ? { display: 'block', opacity: 1 } : { display: 'none', opacity: 0 };

  return <div style={show}>{itemsList}</div>;
}
