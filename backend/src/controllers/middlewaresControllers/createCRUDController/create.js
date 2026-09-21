const create = async (Model, req, res) => {
  // Creating a new document in the collection
  req.body.removed = false;
  // Tenant isolation: the authenticated admin always owns what they create.
  req.body.createdBy = req.admin.tenantId;

  // Authorship, which is a different question from ownership. `createdBy` above
  // is the tenant that holds the record; this is the account that actually
  // entered it, and it is what the owner's per-user filter matches on. Assigned
  // here rather than read from the body, so a request cannot claim to be someone
  // else's work - and set after the tenant field so it is never the same
  // assignment by accident.
  //
  // Only written where the schema has the path. Several models reached by this
  // shared controller have no such field, and assigning to a path mongoose does
  // not know about would drop it silently in strict mode - a hidden difference
  // between models rather than an error anyone would see.
  if (Model.schema.path('createdByUser')) {
    req.body.createdByUser = req.admin._id;
  }

  const result = await new Model({
    ...req.body,
  }).save();

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully Created the document in Model ',
  });
};

module.exports = create;
