/**
 * The pipeline stages, mirrored from the Lead schema's enum.
 *
 * Must stay in step with the `salesStage` enum in
 * backend/src/models/appModels/Lead.js. The two are separate Vite builds with
 * no shared module, so drift is possible and its symptom is quiet: a stage the
 * server writes that is missing here would not error, it would simply fall out
 * of every column in the board.
 *
 * `closed` marks the stages that are an outcome rather than work still in
 * progress. It is what makes "open leads" countable - a lead in a closed stage
 * is not waiting on anybody.
 */
export const SALES_STAGES = [
  { value: 'New', label: 'New', color: 'blue', closed: false },
  { value: 'Contacted', label: 'Contacted', color: 'cyan', closed: false },
  { value: 'Follow-Up', label: 'Follow-Up', color: 'gold', closed: false },
  { value: 'Meeting/Demo', label: 'Meeting / Demo', color: 'purple', closed: false },
  { value: 'Proposal Sent', label: 'Proposal Sent', color: 'geekblue', closed: false },
  { value: 'In Negotiation', label: 'In Negotiation', color: 'orange', closed: false },
  { value: 'Won', label: 'Won', color: 'green', closed: true },
  { value: 'Lost', label: 'Lost', color: 'red', closed: true },
];

/** The stage a lead with no salesStage is shown in - the schema's default. */
export const DEFAULT_SALES_STAGE = 'New';

const BY_VALUE = new Map(SALES_STAGES.map((stage) => [stage.value, stage]));

/**
 * The display for a stage value, falling back to the default stage's styling
 * rather than to nothing.
 *
 * A lead whose stage this build does not know about still has to appear
 * somewhere; returning undefined would put it in no column at all, which reads
 * as data loss rather than as a version skew.
 */
export const stageOf = (value) => BY_VALUE.get(value) ?? BY_VALUE.get(DEFAULT_SALES_STAGE);
