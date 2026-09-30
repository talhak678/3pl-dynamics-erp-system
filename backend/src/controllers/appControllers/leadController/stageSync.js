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
 * The two vocabularies name the same stages in different spellings, and the
 * first version of this file compared them with ===, which kept only the four
 * stages that happened to be spelled identically and left the other four
 * disagreeing forever:
 *
 *   New             vs 'new'              differs by case
 *   Won             vs 'won'              differs by case
 *   In Negotiation  vs 'in negociation'   differs by case and by a typo
 *   Lost            vs 'loose'            a different word entirely
 *
 * The symptom was two-sided, which is why it read as "the sync does not work
 * sometimes" rather than as a spelling problem. The board wrote 'Won' into
 * `status`, which the leads list could not match to any of its options, so the
 * row rendered as a bare uncoloured tag; and the leads list wrote 'won' into
 * `status`, which matched no stage, so the sync declined to move the card and
 * the board kept showing the lead where it was.
 *
 * So the rule is now: any spelling of a stage IS that stage, and the enum's own
 * spelling is what gets written to both fields. That normalises rather than
 * translates, and it leaves a lead with one stored vocabulary whichever screen
 * last touched it, instead of the answer depending on where the edit came from.
 *
 * One consequence is a deliberate reversal of what this file used to do. The
 * leads page's old lowercase options now DO move the card - setting a lead to
 * 'won' there moves it to the 'Won' column. The old rule refused that on the
 * grounds that 'won' and 'Won' are different stored strings and guessing
 * between them could silently reshuffle the pipeline. That was true while both
 * spellings were live, but the cost of refusing turned out to be worse than the
 * risk it avoided: the board and the list disagreed permanently, which is the
 * bug being fixed. The old spellings are no longer offered by any screen - the
 * leads page now lists the canonical names - so both cannot be live at once any
 * more, and the guess this used to make is no longer a guess.
 *
 * The stage list is read off the schema rather than repeated here, so a stage
 * added to the enum is one this file already understands in any casing, and a
 * stage removed from it stops being written to `status` on the same commit.
 * Only the aliases that are not case variants can be derived from nothing, and
 * those are listed explicitly below.
 */

/**
 * Spellings that name a stage without being a case variant of it.
 *
 * Declared rather than derived, because no rule gets from 'loose' to 'Lost' or
 * from 'in negociation' to 'In Negotiation'. Both are what the Leads page's
 * select used to offer and both are still stored on live documents, so both
 * have to be recognised for those documents to be movable from the board.
 *
 * A Map rather than an object literal so a value like 'constructor' looks up to
 * nothing instead of finding Object.prototype and writing a function into the
 * document.
 *
 * Keyed by the lowercased spelling, because lowercasing is the first half of
 * every lookup here and a differently-cased key would never be read.
 */
const LEGACY_STAGE_ALIASES = new Map([
  ['loose', 'Lost'],
  ['in negociation', 'In Negotiation'],
]);

/**
 * Mirrors a stage value between `salesStage` and `status` on a request body, in
 * place, writing the enum's own spelling to both.
 *
 * Called on the body before the write, from both the create and the update path.
 * A no-op on any body that names neither field, and on any value that names no
 * stage - 'draft', 'waiting' and the rest of the lifecycle-only statuses are left
 * exactly where they are, because there is no stage they could honestly be
 * turned into.
 */
const syncStageAndStatus = (Model, body) => {
  if (!Model || !Model.schema || !body) return;

  const stagePath = Model.schema.path('salesStage');
  const stages = (stagePath && stagePath.enumValues) || [];

  // A model whose schema has no salesStage path has nothing to sync, and the
  // caller should not have to know which models those are.
  if (stages.length === 0) return;

  // Built per call rather than cached at module load: the enum is read off the
  // schema above, and a cache keyed on nothing would outlive a schema change.
  const byLowerCase = new Map(stages.map((stage) => [stage.toLowerCase(), stage]));

  /**
   * The canonical stage a value names, or null when it names none.
   *
   * Exact match first, so a value already in the enum's own spelling is never
   * routed through the alias table on its way back out.
   */
  const stageFor = (value) => {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();

    if (stages.includes(trimmed)) return trimmed;

    const lower = trimmed.toLowerCase();

    return LEGACY_STAGE_ALIASES.get(lower) || byLowerCase.get(lower) || null;
  };

  // The board's field first, so it wins if a request somehow carries both and
  // they disagree. The board is the only surface that offers all eight stages,
  // and a drag is an explicit statement about the stage; the Leads page's
  // select is not.
  const stage = stageFor(body.salesStage) || stageFor(body.status);

  if (!stage) return;

  // Both fields, both in the enum's spelling. Writing the same string to both is
  // the entire point of this file: it is what stops the board and the list
  // holding two different answers to one question.
  body.salesStage = stage;
  body.status = stage;
};

module.exports = { syncStageAndStatus };
