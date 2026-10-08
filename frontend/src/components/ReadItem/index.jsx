import { Row, Col, Image } from 'antd';
import { useSelector } from 'react-redux';

import dayjs from 'dayjs';
import { dataForRead } from '@/utils/dataStructure';
import { productImageSrc } from '@/utils/productImage';

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
    const isImage = props.isImage || false;
    const isGallery = props.isGallery || false;

    /* Photographs are drawn, not printed, so they leave the label-and-value row
     * every other field is rendered as.
     *
     * Branched on before the value is resolved, because the value here is an
     * image token - reading it through `valueByString` would put the token's
     * text on the screen, and a gallery would be a list where a string is
     * expected. The two flags are separate because the shapes differ: one token,
     * or several.
     *
     * Full width, rather than the 8/2/14 split the text rows use: the panel is
     * 450px wide and an image in the value column would be a 260px stamp, which
     * is not what "display the cover photo prominently" asks for.
     */
    if (isImage || isGallery) {
      const raw = get(currentResult, propsKey);
      const photos = isGallery
        ? (Array.isArray(raw) ? raw : []).filter(Boolean)
        : raw
          ? [raw]
          : [];

      return (
        <div className="product-image-read" key={propsKey}>
          <p className="product-image-read-label">{propsTitle}</p>

          {photos.length === 0 && <span className="product-image-read-empty">No photos</span>}

          {/* A preview group rather than a bare image: the panel is narrow, and
              opening one photograph at full size is what makes a 96px tile
              useful. */}
          {photos.length > 0 && isGallery && (
            <Image.PreviewGroup>
              <div className="product-image-read-gallery">
                {photos.map((photo) => (
                  <Image
                    key={String(photo)}
                    className="product-image-read-thumb"
                    src={productImageSrc(photo)}
                    alt=""
                  />
                ))}
              </div>
            </Image.PreviewGroup>
          )}

          {photos.length > 0 && isImage && (
            <Image className="product-image-read-cover" src={productImageSrc(photos[0])} alt="" />
          )}
        </div>
      );
    }

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
