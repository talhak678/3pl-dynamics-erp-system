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
  // Left as a bare id. Resolving it to a name is a decision for the board UI:
  // a Sales Executive cannot read /api/team (that endpoint is owner-only), so
  // naming an assignee needs either a populated field here or an endpoint they
  // are allowed to call.
  newData.assignedTo = result.assignedTo;
  newData.followUpDate = result.followUpDate;

  return newData;
};
