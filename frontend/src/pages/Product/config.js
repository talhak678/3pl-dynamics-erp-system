/**
 * The product form, its table and its own panel are all driven by this one
 * object - DynamicForm renders it, dataForTable turns it into columns, and
 * dataForRead turns it into the rows of the read panel - so the order of these
 * keys is the order in all three.
 *
 * That is why the photos lead. In the table it puts the thumbnail immediately
 * left of the product name, which is where a catalogue is read from; on the
 * product panel it puts the cover at the top with the gallery directly under it;
 * and on the form it keeps the photographs together, above the fields that
 * describe them.
 */
export const fields = {
  coverImage: {
    // Its own type, because a photograph is neither a string nor a URL to this
    // form: the value is an image token, and the control that edits it is the
    // one in components/ProductImageUpload. The type is what DynamicForm
    // dispatches the form control on, what dataForTable dispatches the cell on,
    // and what dataForRead flags for the panel.
    type: 'productCover',
    label: 'cover photo',
    // A product with no photograph is not one anyone can pick out of a
    // catalogue. Enforced again by the schema, and again in the controller.
    required: true,
  },
  galleryImages: {
    type: 'productGallery',
    label: 'gallery photos',
    max: 4,
    // A cell holding four thumbnails would set the width of the table for every
    // other column. The gallery is shown in full on the product's own panel.
    disableForTable: true,
  },
  name: {
    type: 'string',
    required: true,
  },
  productCategory: {
    type: 'async',
    label: 'product Category',
    displayLabels: ['productCategory', 'name'],
    dataIndex: ['productCategory', 'name'],
    entity: 'productcategory',
    required: true,
  },

  price: {
    type: 'currency',
    required: true,
  },
  description: {
    type: 'textarea',
  },
  ref: {
    type: 'string',
  },
};
