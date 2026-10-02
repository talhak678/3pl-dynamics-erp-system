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
  /*
   * The assignee, in whichever shape the caller's query produced.
   *
   * This mapper is fed by two different reads. `read` populates the path, so it
   * arrives as an Admin document and the name comes with it - which is the only
   * way a Sales Executive can be shown who a lead belongs to, since /api/team is
   * owner-only. `listAll` and `paginatedList` do not populate, so the same field
   * arrives as a bare ObjectId, which is the shape the pipeline board and its
   * resolveAssignee() expect.
   *
   * Normalised here rather than passed through, so the difference between the
   * two endpoints is visible in one place instead of being a property of
   * whichever populate call happens to be nearby. A populated document would
   * also carry the whole Admin projection, which is more than belongs in a
   * response that only ever displays a name.
   *
   * If listAll ever gains a populate, the board's String(assignedTo) becomes
   * "[object Object]" - change that call site in the same commit.
   */
  if (result.assignedTo && typeof result.assignedTo === 'object') {
    newData.assignedTo = {
      _id: result.assignedTo._id,
      name: result.assignedTo.name ?? null,
    };
  } else {
    newData.assignedTo = result.assignedTo;
  }
  newData.followUpDate = result.followUpDate;

  return newData;
};
