const mongoose = require('mongoose');

const { leadFilter, scopedFilter } = require('../../../middlewares/ownership');

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const isBlank = (value) => value === undefined || value === null || value === '';

/**
 * Resolves whatever the follow-up was linked to, and proves it belongs to a
 * record the caller may see.
 *
 * A follow-up is about exactly one thing: a lead while it is in the pipeline, or
 * a client once it is a customer relationship. Accepting neither would create a
 * reminder attached to nothing; accepting both would make "is this follow-up
 * done" depend on which field a reader happened to look at.
 *
 * The lookup goes through the same filters the respective list screens use -
 * leadFilter for leads, scopedFilter for clients - rather than a bare tenant
 * check, so a Sales Executive cannot attach work to a colleague's lead. The
 * tenant clause is still the outer bound either way.
 *
 * A missing record and a record in another workspace answer the same 404, so the
 * endpoint cannot be used to probe which ids exist.
 */
const resolveLink = async (req, body) => {
  const leadId = body.lead;
  const clientId = body.client;

  const hasLead = !isBlank(leadId);
  const hasClient = !isBlank(clientId);

  if (hasLead && hasClient) {
    return {
      ok: false,
      status: 400,
      message: 'A follow-up is linked to a lead or a customer, not both.',
    };
  }

  if (!hasLead && !hasClient) {
    return {
      ok: false,
      status: 400,
      message: 'Select a lead or a customer for this follow-up.',
    };
  }

  if (hasLead) {
    if (!OBJECT_ID.test(String(leadId))) {
      return { ok: false, status: 400, message: 'The selected lead is not a valid lead id.' };
    }

    const Lead = mongoose.model('Lead');

    const lead = await Lead.findOne({
      _id: leadId,
      removed: false,
      ...leadFilter(req),
    })
      .select('_id assignedTo')
      .lean()
      .exec();

    if (!lead) {
      return {
        ok: false,
        status: 404,
        message: 'The selected lead was not found in your workspace.',
      };
    }

    // The lead's owner is inherited by the follow-up so a colleague's lead is
    // not invisible to the colleague: a child account reads only records it
    // created or was assigned (SCOPED_MODEL_NAMES), and without this an owner
    // scheduling a follow-up on a rep's lead would create a reminder the rep can
    // never see. The id came from a lead the caller was allowed to read, so it is
    // already a same-tenant account; controllers only apply it when the request
    // did not name an assignee of its own.
    return { ok: true, lead: lead._id, client: null, leadAssignee: lead.assignedTo || null };
  }

  if (!OBJECT_ID.test(String(clientId))) {
    return { ok: false, status: 400, message: 'The selected customer is not a valid customer id.' };
  }

  const Client = mongoose.model('Client');

  const client = await Client.findOne({
    _id: clientId,
    removed: false,
    ...scopedFilter(Client, req),
  })
    .select('_id')
    .lean()
    .exec();

  if (!client) {
    return {
      ok: false,
      status: 404,
      message: 'The selected customer was not found in your workspace.',
    };
  }

  return { ok: true, lead: null, client: client._id, leadAssignee: null };
};

/** A submitted due date as a Date, or null when it is missing or unparseable. */
const parseDate = (value) => {
  if (isBlank(value)) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

module.exports = { resolveLink, parseDate, isBlank };
