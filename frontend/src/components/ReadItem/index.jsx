import { Row, Col } from 'antd';
import { useSelector } from 'react-redux';

import dayjs from 'dayjs';
import { dataForRead } from '@/utils/dataStructure';

import { useCrudContext } from '@/context/crud';
import { selectCurrentItem } from '@/redux/crud/selectors';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import useAssigneeDirectory, { canReadTeamDirectory } from '@/hooks/useAssigneeDirectory';
import { get, valueByString } from '@/utils/helpers';

import useLanguage from '@/locale/useLanguage';
import { useDate } from '@/settings';

export default function ReadItem({ config }) {
  const { dateFormat } = useDate();
  let { readColumns, fields } = config;
  const translate = useLanguage();
  const { result: currentResult } = useSelector(selectCurrentItem);
  const currentAdmin = useSelector(selectCurrentAdmin);
  const { state } = useCrudContext();
  const { isReadBoxOpen } = state;

  if (fields) readColumns = [...dataForRead({ fields: fields, translate: translate })];

  /* The assignee is shown as a name, and the name comes from the team
   * directory rather than from the record.
   *
   * The API returns `assignedTo` as a bare id, which is what every other part of
   * the app needs it to be: the edit form's Select compares it against id
   * options, and the pipeline board stringifies it. Turning it into a document
   * server-side breaks both, so it is resolved here, at the point of display.
   *
   * `resolve` is the same helper the pipeline and the dashboard label their
   * cards with, so a record reads the same wherever it is shown - and it is the
   * one that knows what an unresolvable id means for this caller: a complete
   * directory that lacks the id is a deleted account ("Removed user"), while no
   * directory at all is a colleague the caller may not look up ("A colleague"),
   * because /api/team is owner-only. A Sales Executive gets the second answer
   * and never sees a raw id.
   *
   * Gated on the column existing as well as on the directory being readable:
   * most configs have no assignee, and those panels should not each fire a
   * request for a directory they will not use.
   */
  const { resolve: resolveAssignee } = useAssigneeDirectory({
    enabled: readColumns.some((column) => column.isAssignee) && canReadTeamDirectory(currentAdmin),
    currentAdmin,
  });

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
       * That helper joins its parts with String(), so anything other than a
       * plain scalar arrives as the literal text "[object Object]" - an object
       * id included, since one is an object. `resolve` is handed the value as
       * the record holds it.
       */
      const person = resolveAssignee(get(currentResult, propsKey));
      value = person ? person.name : '';
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
