const mongoose = require('mongoose');

const {
  isSalesExecutive,
  isTenantOwner,
} = require('../../middlewares/ownership');
const { resolveModules } = require('../../utils/moduleList');

/**
 * The sales pipeline figures for the dashboard PDF.
 *
 * Two things make this section different from every other section of the report,
 * and both are the reason this is a module rather than a few lines inline.
 *
 * The first is scope. The financial sections are fed by the summary controllers
 * the dashboard itself calls, so they inherit their scoping by construction. This
 * one is fed by leadController.listAll, which applies leadFilter - and leadFilter
 * is what narrows a Sales Executive to their own leads. So the isolation the CEO
 * asked for is not re-implemented here; it is the same middleware the pipeline
 * board and the dashboard's own analytics already run through. A PDF cannot show
 * an executive a colleague's lead, because it never receives one.
 *
 * The second is the executive breakdown, which is owner-only. That is not a
 * presentation choice - a workspace owner is the only account that may look
 * employees up at all (see teamController/listTeam.js, behind requireTenantOwner).
 * An executive's report gets their own figures and nothing that names a
 * colleague, which is also what the dashboard does.
 *
 * The arithmetic below mirrors frontend/src/modules/DashboardModule/components/
 * SalesAnalytics/usePipelineAnalytics.js, and has to: the printed report and the
 * screen it was printed from are compared line by line, and a figure that
 * disagrees is read as one of them being broken. The two cannot share code - one
 * runs in the browser and one in the lambda - so the mirror is maintained by
 * hand, and any change to the win-rate rule, the share rule or the ordering has
 * to be made in both. The rules that would be easy to get subtly wrong are
 * spelled out at each one.
 */

/**
 * The pipeline stages, mirroring frontend/src/utils/salesStages.js.
 *
 * A third copy of these eight names exists as the `salesStage` enum in
 * models/appModels/Lead.js. They are deliberately not derived from it: the
 * dashboard builds its columns from the frontend list, so a stage the schema
 * gained but that list lacked would be counted as 'New' on screen and as itself
 * here, and the PDF would stop agreeing with the page. Mirroring the frontend is
 * what keeps the two in step; deriving from the schema is what would break them.
 *
 * `closed` marks an outcome rather than work in progress, and is what makes
 * "open leads" countable.
 */
const SALES_STAGES = [
  { value: 'New', label: 'New', closed: false },
  { value: 'Contacted', label: 'Contacted', closed: false },
  { value: 'Follow-Up', label: 'Follow-Up', closed: false },
  { value: 'Meeting/Demo', label: 'Meeting / Demo', closed: false },
  { value: 'Proposal Sent', label: 'Proposal Sent', closed: false },
  { value: 'In Negotiation', label: 'In Negotiation', closed: false },
  { value: 'Won', label: 'Won', closed: true },
  { value: 'Lost', label: 'Lost', closed: true },
];

/** The schema's default, and the bucket a lead with no stage falls into. */
const DEFAULT_STAGE = 'New';

const STAGE_BY_VALUE = new Map(SALES_STAGES.map((stage) => [stage.value, stage]));

/**
 * The stage a lead is counted under.
 *
 * Falls back to the default stage rather than dropping the lead, so a row
 * carrying a value this build does not know about is still counted somewhere.
 * Dropping it would make the stage rows fail to add up to the total, and a
 * breakdown that does not sum reads as data loss.
 */
const stageValueOf = (lead) => {
  const value = lead && lead.salesStage ? String(lead.salesStage) : DEFAULT_STAGE;
  return STAGE_BY_VALUE.has(value) ? value : DEFAULT_STAGE;
};

/**
 * Whether this account gets a pipeline section at all.
 *
 * Deliberately the same two conditions as canUseSalesPipeline in
 * frontend/src/utils/salesPipeline.js - a pipeline role marked on the account,
 * and the `lead` module actually granted. The role check alone would put an
 * executive's numbers in a report for someone the owner never granted leads to;
 * the module check alone would put a per-executive breakdown in front of any
 * employee who holds `lead`, which is exactly who the dashboard hides it from.
 *
 * A super admin is excluded twice over - isTenantOwner and isSalesExecutive both
 * refuse one - which is correct: a control-plane account owns no workspace, so
 * there is no pipeline of theirs to report on.
 *
 * Exported because the caller uses it to decide whether to read the leads at all.
 * An employee holding `lead` is not a pipeline role, so their report has no
 * pipeline section - and without this the report would have read every lead in
 * the workspace to build a section it then threw away. One predicate for both
 * the fetch and the render is what keeps the two from drifting apart.
 */
const canSeePipeline = (admin) =>
  Boolean(admin) &&
  admin.isSuperAdmin !== true &&
  resolveModules(admin).includes('lead') &&
  (isTenantOwner(admin) || isSalesExecutive(admin));

/**
 * The names behind the assignee ids, for the account allowed to ask.
 *
 * Scoped by parentAdminId, matching listTeam: only an owner reaches here, so the
 * caller's own id is the tenant id and this says exactly "the accounts this
 * owner created". A lookup that could not name an id falls back to the same
 * labels the frontend uses, so a row is never blank and the report never asserts
 * a name it does not have.
 *
 * Returns an empty map for anyone who is not an owner, which is what makes the
 * breakdown below owner-only rather than merely owner-shaped.
 */
const resolveNames = async (admin) => {
  if (!isTenantOwner(admin)) return new Map();

  const Admin = mongoose.model('Admin');

  const members = await Admin.find({ parentAdminId: admin._id, removed: false })
    .select('name surname email')
    .exec();

  const names = new Map();

  for (const member of members) {
    const fullName = [member.name, member.surname].filter(Boolean).join(' ').trim();

    // Email rather than a blank cell, matching useAssigneeDirectory.
    names.set(String(member._id), fullName || member.email || 'Unknown');
  }

  return names;
};

/**
 * The reportable figures for a set of already-scoped leads.
 *
 * Takes the leads rather than fetching them so this stays a pure function of
 * its input: what the caller is allowed to see was decided by leadFilter before
 * this was called, and nothing here can widen it.
 */
const summarize = (leads, admin, names, includeBreakdown) => {
  const rows = Array.isArray(leads) ? leads : [];

  const byStage = new Map(SALES_STAGES.map((stage) => [stage.value, 0]));

  for (const lead of rows) {
    const value = stageValueOf(lead);
    byStage.set(value, byStage.get(value) + 1);
  }

  const total = rows.length;
  const won = byStage.get('Won');
  const lost = byStage.get('Lost');
  const decided = won + lost;

  const stages = SALES_STAGES.map((stage) => {
    const count = byStage.get(stage.value);

    return {
      ...stage,
      count,
      // A share of the whole pipeline, so the bars say where the work is rather
      // than only how much of it there is. Guarded against a zero total, which
      // would otherwise render every bar as NaN%.
      share: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  const pipeline = {
    /**
     * Which of the two reports this is. Carried into the PDF as a printed line
     * rather than left implicit: an executive reading "Total leads: 12" has to
     * be able to see that it means twelve of theirs and not twelve in the
     * company, and the same report is downloaded by both.
     */
    scope: isTenantOwner(admin) ? 'workspace' : 'personal',

    totals: {
      total,
      won,
      lost,
      open: total - decided,
      // Won as a share of everything CLOSED, matching the dashboard. Not
      // won/total: a lead still open is neither a win nor a loss, and dividing
      // by it would make a large healthy pipeline look like a failing one.
      winRate: decided > 0 ? Math.round((won / decided) * 100) : 0,
      hasDecided: decided > 0,
    },

    stages,

    byAssignee: [],
  };

  if (!includeBreakdown) return pipeline;

  /**
   * Leads grouped by the executive they are assigned to.
   *
   * Unassigned leads get their own row rather than being dropped: "nobody owns
   * these" is the most actionable thing this table can say, and a breakdown
   * whose rows do not add up to the total is worse than no breakdown at all.
   */
  const groups = new Map();

  for (const lead of rows) {
    const key = lead.assignedTo ? String(lead.assignedTo) : null;

    if (!groups.has(key)) {
      groups.set(key, { id: key, assigned: 0, won: 0, lost: 0, open: 0 });
    }

    const group = groups.get(key);
    const value = stageValueOf(lead);

    group.assigned += 1;
    if (value === 'Won') group.won += 1;
    else if (value === 'Lost') group.lost += 1;
    else group.open += 1;
  }

  const selfId = String(admin._id);

  pipeline.byAssignee = [...groups.values()]
    .map((group) => {
      let name = 'Unassigned';

      if (group.id === selfId) name = 'You';
      else if (group.id) name = names.get(group.id) || 'Removed user';

      return {
        ...group,
        name,
        // The same rule as the headline win rate, applied per person.
        winRate:
          group.won + group.lost > 0
            ? Math.round((group.won / (group.won + group.lost)) * 100)
            : 0,
      };
    })
    // Busiest first, then by name so the order is stable between two reports of
    // the same data rather than dependent on insertion order.
    .sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name));

  return pipeline;
};

/**
 * The pipeline section for the dashboard PDF, or null when this account does not
 * get one.
 *
 * `leads` arrives from leadController.listAll, which the report controller runs
 * through the same stand-in-response helper it uses for the financial summaries.
 * Passing them in rather than querying again is what guarantees the PDF and the
 * page are scoped identically: there is one query, and it is the page's.
 */
const buildPipelineReport = async ({ admin, leads }) => {
  if (!canSeePipeline(admin)) return null;

  const breakdown = isTenantOwner(admin);
  const names = breakdown ? await resolveNames(admin) : new Map();

  return summarize(leads, admin, names, breakdown);
};

module.exports = { buildPipelineReport, canSeePipeline, SALES_STAGES };
