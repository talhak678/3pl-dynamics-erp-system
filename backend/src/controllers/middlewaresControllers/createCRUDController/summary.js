const summary = async (Model, req, res) => {
  const countPromise = Model.countDocuments({
    removed: false,
  }).exec();

  const filter = typeof req.query.filter === 'string' ? req.query.filter.trim() : '';
  let filteredQuery = Model.countDocuments({ removed: false });

  if (filter && Model.schema.path(filter)) {
    filteredQuery = filteredQuery.where(filter).equals(req.query.equal);
  }

  const [countFilter, countAllDocs] = await Promise.all([filteredQuery.exec(), countPromise]);

  if (countAllDocs > 0) {
    return res.status(200).json({
      success: true,
      result: { countFilter, countAllDocs },
      message: 'Successfully count all documents',
    });
  } else {
    return res.status(203).json({
      success: false,
      result: [],
      message: 'Collection is Empty',
    });
  }
};

module.exports = summary;
