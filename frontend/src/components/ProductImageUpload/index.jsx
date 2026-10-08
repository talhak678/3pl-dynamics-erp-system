import { useRef, useState } from 'react';
import { Form, Tooltip, Upload, message } from 'antd';
import { DeleteOutlined, LoadingOutlined, PlusOutlined, StarOutlined } from '@ant-design/icons';

import useLanguage from '@/locale/useLanguage';
import { compressImage } from '@/utils/imageCompression';
import { MAX_GALLERY_IMAGES, productImageSrc } from '@/utils/productImage';

/**
 * The two photo fields on the product form: the cover, and the gallery.
 *
 * One component for both, because they are the same control with a different
 * ceiling and one extra action - the gallery can promote one of its photographs
 * into the cover slot. The field's `type` decides which; see pages/Product/config.js.
 *
 * The value it reads and writes is the shape the API stores, not the shape the
 * upload widget works in: a token string for the cover, an array of them for the
 * gallery, with a compressed data URI standing in for anything selected but not
 * yet saved. That is deliberate - it means the form submits photographs through
 * the same create/update path as every other field, with no multipart, no
 * separate upload call, and nothing to keep in step with the server.
 *
 * It renders its own Form.Item rather than being dropped inside a generated one,
 * the way the assignee field does, because the control needs rules the generic
 * wrapper cannot express: the cover is required, and a field whose photographs
 * are still being compressed must not pass validation.
 */
export default function ProductImageUpload({ field = {} }) {
  const translate = useLanguage();
  const isGallery = field.type === 'productGallery';

  /**
   * Set by the control while it is compressing, and read by the validator below.
   *
   * A ref rather than state, because it exists to be read at validation time -
   * the control already re-renders itself to draw its own spinner, and a second
   * source of truth here would only be able to disagree with it.
   */
  const busy = useRef(false);

  return (
    <Form.Item
      label={translate(field.label)}
      name={field.name}
      rules={[
        {
          required: field.required || false,
          message: isGallery ? 'Choose up to 4 gallery photos' : 'Add a cover photo',
        },
        {
          /* Submitting mid-compression would send a form that is missing the
             photographs selected a moment ago - they are only added to the value
             once they have been shrunk. This refuses the submit while that is
             true, and the control re-validates the field the moment it finishes,
             so the message clears without the user having to touch anything. */
          validator: () =>
            busy.current
              ? Promise.reject(new Error('Still preparing the photos you selected...'))
              : Promise.resolve(),
        },
      ]}
      /* An emptied cover reports undefined, and a key holding undefined is
         dropped by JSON.stringify - so clearing the cover would submit no
         coverImage at all and leave the previous photograph in place while the
         form showed an empty slot. Both fields are normalised to the value the
         API expects to receive for "nothing". */
      normalize={(value) => (isGallery ? value || [] : value || '')}
      extra={
        isGallery
          ? 'Up to 4 photos, shown under the cover photo on the product page.'
          : 'Shown in the products list and at the top of the product page.'
      }
    >
      <PhotoPicker
        busy={busy}
        name={field.name}
        multiple={isGallery}
        max={isGallery ? field.max || MAX_GALLERY_IMAGES : 1}
      />
    </Form.Item>
  );
}

function PhotoPicker({ value, onChange, busy, name, multiple = false, max = 1 }) {
  const form = Form.useFormInstance();

  // Selections being compressed right now, drawn as placeholders in the grid.
  const [pending, setPending] = useState([]);
  const pendingRef = useRef([]);
  const [dragging, setDragging] = useState(false);

  const photos = multiple
    ? (Array.isArray(value) ? value : []).filter(Boolean)
    : value
      ? [value]
      : [];

  /** One place that changes both, so what is rendered and what is validated agree. */
  const applyPending = (next) => {
    pendingRef.current = next;
    busy.current = next.length > 0;
    setPending(next);
  };

  const commit = (list) => {
    onChange(multiple ? list : list[0] || '');
  };

  /**
   * Read the value from the form store rather than from this render's closure.
   *
   * Several photographs are compressed at once and they finish in whatever order
   * they finish in, so a list captured when the first one started would drop
   * every photograph that finished before it.
   */
  const storedPhotos = () => {
    const stored = form.getFieldValue(name);

    return multiple
      ? (Array.isArray(stored) ? stored : []).filter(Boolean)
      : stored
        ? [stored]
        : [];
  };

  /**
   * Re-validate, but only when the field is already saying something.
   *
   * Finishing a compression has to clear the "still preparing" message, and the
   * only way to clear a field's error is to validate it again. Doing that
   * unconditionally would also make this the moment an untouched empty cover
   * starts complaining, before the user has tried to submit anything.
   */
  const revalidate = () => {
    if (form.getFieldError(name).length) form.validateFields([name]).catch(() => {});
  };

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);

    if (!files.length) return;

    /* The cover slot holds exactly one photograph, so a new selection replaces
       what is there. The gallery fills to its ceiling and says what it did with
       the rest, rather than dropping files without a word. */
    const room = multiple
      ? Math.max(0, max - storedPhotos().length - pendingRef.current.length)
      : 1;

    if (room <= 0) {
      message.warning(`Up to ${max} photos fit here. Remove one first.`);
      return;
    }

    const accepted = files.slice(0, room);

    if (accepted.length < files.length) {
      message.warning(
        `Up to ${max} photos fit here, so ${files.length - accepted.length} were not added.`
      );
    }

    const entries = accepted.map((file, index) => ({
      uid: `${Date.now()}-${index}-${file.name}`,
      file,
    }));

    applyPending([...pendingRef.current, ...entries]);

    entries.forEach(async (entry) => {
      try {
        const dataUri = await compressImage(entry.file);

        applyPending(pendingRef.current.filter((item) => item.uid !== entry.uid));
        commit(multiple ? [...storedPhotos(), dataUri] : [dataUri]);
      } catch (error) {
        applyPending(pendingRef.current.filter((item) => item.uid !== entry.uid));
        message.error(error.message || 'That photo could not be prepared.');
      } finally {
        revalidate();
      }
    });
  };

  const removePhoto = (index) => {
    commit(photos.filter((_, position) => position !== index));
    revalidate();
  };

  /**
   * Move a gallery photograph into the cover slot.
   *
   * The cover it displaces goes to the front of the gallery rather than being
   * dropped, so promoting a photograph never quietly deletes another one - and
   * since the two slots are a cover plus four, the swap always leaves the
   * gallery at or under its ceiling.
   */
  const makeCover = (index) => {
    const promoted = photos[index];
    const rest = photos.filter((_, position) => position !== index);
    const displacedCover = form.getFieldValue('coverImage');

    form.setFieldValue('coverImage', promoted);
    commit(displacedCover && displacedCover !== promoted ? [displacedCover, ...rest] : rest);

    // This action deliberately changes both fields, so both are validated
    // together - the cover it just filled may have been the empty one that was
    // blocking the submit.
    form.validateFields(['coverImage', name]).catch(() => {});
  };

  /* Dropping is handled here rather than by the Upload's own drag support, so
     that a file can be dropped anywhere in the field - including onto a
     photograph that is already there - and not only onto the add tile. */
  const dropProps = {
    onDragOver: (event) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event) => {
      // Fires again for every child the pointer crosses; only a departure from
      // the field itself should end the highlight.
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setDragging(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      addFiles(event.dataTransfer ? event.dataTransfer.files : null);
    },
  };

  const atCapacity = multiple && photos.length + pending.length >= max;

  return (
    <div className="product-image-grid" {...dropProps}>
      <div className={`product-image-grid-inner ${dragging ? 'is-dragging' : ''}`}>
        {photos.map((photo, index) => (
          <div
            className={`product-image-tile ${!multiple ? 'is-cover' : ''}`}
            key={`${String(photo).slice(-32)}-${index}`}
          >
            <img src={productImageSrc(photo)} alt="" />

            {!multiple && <span className="product-image-badge">Cover</span>}

            <div className="product-image-actions">
              {multiple && (
                <Tooltip title="Make cover">
                  <button
                    type="button"
                    className="product-image-action"
                    aria-label="Make this the cover photo"
                    onClick={() => makeCover(index)}
                  >
                    <StarOutlined />
                  </button>
                </Tooltip>
              )}
              <Tooltip title="Remove">
                <button
                  type="button"
                  className="product-image-action"
                  aria-label="Remove this photo"
                  onClick={() => removePhoto(index)}
                >
                  <DeleteOutlined />
                </button>
              </Tooltip>
            </div>
          </div>
        ))}

        {pending.map((entry) => (
          <div className="product-image-tile is-pending" key={entry.uid}>
            <LoadingOutlined />
          </div>
        ))}

        {!atCapacity && (
          <Upload
            accept="image/*"
            multiple={multiple && max > 1}
            showUploadList={false}
            /* Returning false keeps the file out of the Upload's own machinery:
               it is not posted anywhere, it is read, shrunk and carried in the
               form value instead. */
            beforeUpload={(file) => {
              addFiles([file]);
              return false;
            }}
          >
            <div className="product-image-add">
              <PlusOutlined />
              {/* The cover slot is full at one, so its tile is always there to
                  replace what it holds. The gallery's disappears at its
                  ceiling, where there is nothing left to add. */}
              <span>{multiple ? 'Add photo' : photos.length ? 'Replace' : 'Add photo'}</span>
            </div>
          </Upload>
        )}
      </div>
    </div>
  );
}
