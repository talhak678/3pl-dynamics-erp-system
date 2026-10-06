exports.migrate = (result) => {
  let lead = result.type === 'people' ? result.people : result.company;
  let newData = {};
  newData._id = result._id;
  newData.type = result.type;
  newData.status = result.status;
  newData.source = result.source;
  newData.name = result.name;
  newData.phone = lead.phone;
  newData.email = lead.email;
  newData.website = lead.website;
  newData.country = lead.country;
  newData.address = lead.address;
  newData.people = result.people;
  newData.company = result.company;
  newData.notes = result.notes;

  // The Sales Pipeline fields. This mapper is a whitelist, so a field left out
  // here is invisible to the client however faithfully it was stored - the
  // pipeline would read the schema, find no stage, and render nothing.
  //
  // `|| 'New'` rather than passing it through: the schema default is applied by
  // Mongoose when it hydrates a document, and this mapper is also handed plain
  // objects in places. An undefined stage would drop the lead out of every
  // column instead of landing it in the first one.
  newData.salesStage = result.salesStage || 'New';
  // The assignee, passed through exactly as the query produced it: a bare
  // ObjectId. The client resolves it to a name from the team directory, which
  // is the only place that can - /api/team is owner-only, so the answer depends
  // on who is asking.
  //
  // Do not add a branch here that rewrites this field when it "looks like" a
  // document. A bare ObjectId satisfies `typeof x === 'object'`, so such a test
  // takes the populated branch for every ordinary row and hands the client
  // `{_id, name: null}` - which stringifies to "[object Object]", stops the
  // pipeline's resolveAssignee() matching anybody, and binds an object where
  // the edit form's Select expects an id. If a caller ever populates this path,
  // fix it at that call site.
  newData.assignedTo = result.assignedTo;
  newData.followUpDate = result.followUpDate;

  return newData;
};
