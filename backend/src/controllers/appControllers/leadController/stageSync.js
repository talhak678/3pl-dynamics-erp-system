/**
 * Keeping a lead's pipeline stage and its status in step.
 *
 * These are two fields describing one thing. `salesStage` is the pipeline
 * board's field - the eight stages in the Lead schema's enum, which the board
 * groups by and drags between. `status` is the CRM lifecycle field the Leads
 * list renders in its Status column. They were written by different screens and
 * never reconciled, so moving a card on the board changed the column the board
 * reads and left the column the list reads exactly as it was. A hard refresh did
 * not help, because nothing was stale: the database genuinely held two
 * different answers, and the two screens were each reading their own.
 *
 * The fix is that a write to either field carries the other with it, so there is
 * one answer stored rather than two. The pipeline is unchanged - it still sends
 * `salesStage` alone - and the Leads page is unchanged: it still sends `status`
 * alone. This runs on the server for both, which is what makes the agreement
 * hold for every caller rather than for the two screens that exist today.
 *
 * The two vocabularies overlap without being the same list. The stage enum is
 * New, Contacted, Follow-Up, Meeting/Demo, Proposal Sent, In Negotiation, Won,
 * Lost; the status field is a free string the Leads page offers nine values for,
 * four of which name a stage in a different spelling ('new', 'won', 'loose',
 * 'in negociation'). So the rule is not a translation table - it is: a value
 * that IS a stage, in the stage's own spelling, is authoritative for both
 * fields. A value that is not a stage is left where it is, because there is no
 * stage it could honestly be turned into.
 *
 * That direction is deliberate. A leads-page edit setting status to 'new' does
 * not move the card to 'New', and it should not: 'new' and 'New' are two
 * different stored strings and guessing that one means the other is how a
 * status change would silently reshuffle the pipeline. The four stages that have
 * no counterpart in the status list are the reason the status list gains them
 * (see pages/Lead/config.js) rather than this file inventing a mapping for them.
 *
 * The stage list is read off the schema rather than repeated here, so a stage
 * added to the enum is one this file already understands, and a stage removed
 * from it stops being written to `status` on the same commit.
 */

/**
 * Mirrors a stage value between `salesStage` and `status` on a request body, in
 * place.
 *
 * Called on the body before the write, from both the create and the update path.
 * A no-op on any body that names neither field, and on any value that is not a
 * stage name - which is every legacy status, so an ordinary edit of an existing
 * lead leaves both fields exactly as it found them.
 */
const syncStageAndStatus = (Model, body) => {
  if (!Model || !Model.schema || !body) return;

  const stagePath = Model.schema.path('salesStage');
  const stages = (stagePath && stagePath.enumValues) || [];

  // A model whose schema has no salesStage path has nothing to sync, and the
  // caller should not have to know which models those are.
  if (stages.length === 0) return;

  // The board's field first, so it wins if a request somehow carries both and
  // they disagree. The board is the only surface that offers all eight stages,
  // and a drag is an explicit statement about the stage; the Leads page's
  // select is not.
  if (stages.includes(body.salesStage)) {
    body.status = body.salesStage;
    return;
  }

  if (stages.includes(body.status)) {
    body.salesStage = body.status;
  }
};

module.exports = { syncStageAndStatus };
