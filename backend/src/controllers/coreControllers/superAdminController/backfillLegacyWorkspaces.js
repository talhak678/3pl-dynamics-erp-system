const mongoose = require('mongoose');

const serializeWorkspace = require('./serializeWorkspace');

/**
 * GET /api/workspace/backfill
 *
 * Attaches every account that predates the workspace requirement to a single
 * legacy workspace.
 *
 * Why this exists at all: the production database sits behind an IP allow-list
 * that admits only the deployed environment, so nothing running on a developer's
 * machine, in CI, or in an agent session can reach it. The deployment is the
 * only place it can run.
 *
 * ---------------------------------------------------------------------------
 * THIS HANDLER IS CURRENTLY REACHABLE WITHOUT AUTHENTICATION, ON PURPOSE.
 *
 * It is mounted at /api/workspace/backfill with no middleware at all, so it can
 * be triggered by opening a URL in a browser. That was an explicit request, and
 * it is a deliberate exception to the way every other route here is guarded. Do
 * not read the missing guard as a pattern to copy.
 *
 * What makes it tolerable briefly: it writes one field, it is idempotent, and it
 * only touches accounts whose workspace is null - so after the first run it does
 * nothing at all. What makes it unsafe to keep: it is a public write endpoint, a
 * crawler or link-preview fetch will trigger it, and the response reports
 * account counts to an anonymous caller.
 *
 * The remedy is deletion, not a guard - see the removal steps in
 * routes/coreRoutes/workspaceBackfillApi.js. Once the backfill has been run this
 * route has no legitimate caller.
 * ---------------------------------------------------------------------------
 *
 * Safe to run more than once. `accountsUpdated: 0` on a second call is the
 * expected result, not a failure. It makes no other change: no status, no
 * permissions, no tenancy.
 */

const LEGACY_CODE = 'WS_LEGACY';

const backfillLegacyWorkspaces = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const Workspace = mongoose.model('Workspace');

  let workspace = await Workspace.findOne({ code: LEGACY_CODE }).exec();
  let workspaceCreated = false;

  if (workspace) {
    // Reactivated rather than reused as-is, so accounts cannot end up pointing
    // at a workspace the UI refuses to show.
    if (workspace.removed === true || workspace.isActive === false) {
      workspace.removed = false;
      workspace.isActive = true;
      workspace.updated = Date.now();
      await workspace.save();
    }
  } else {
    try {
      workspace = await new Workspace({
        code: LEGACY_CODE,
        name: 'Legacy Workspace',
        customerName: 'Accounts created before workspaces existed',
        customerEmail: '',
        customerPhone: '',
        isActive: true,
        removed: false,
        createdBy: req.admin ? req.admin._id : null,
      }).save();

      workspaceCreated = true;
    } catch (saveError) {
      // Two super admins hitting this at the same moment: the unique index on
      // `code` lets one through and rejects the other. That is not a failure -
      // the workspace exists now, which is all this call wanted - so the loser
      // re-reads it instead of reporting an error.
      if (saveError && saveError.code === 11000) {
        workspace = await Workspace.findOne({ code: LEGACY_CODE }).exec();
      } else {
        throw saveError;
      }
    }
  }

  // `workspace: null` matches both an explicit null and a document where the
  // field was never written, which is the state every pre-existing account is
  // in - so one filter covers both and no account is missed.
  const pending = await Admin.countDocuments({ workspace: null });

  let accountsUpdated = 0;

  if (pending > 0) {
    const result = await Admin.updateMany(
      { workspace: null },
      { $set: { workspace: workspace._id } }
    );

    accountsUpdated = result.modifiedCount;
  }

  // Reported so the caller can tell "nothing left to do" apart from "something
  // was skipped", which look identical from accountsUpdated alone on a re-run.
  const remaining = await Admin.countDocuments({ workspace: null });

  return res.status(200).json({
    success: true,
    message: 'Backfill completed',
    accountsUpdated,
    remaining,
    result: {
      workspace: serializeWorkspace(workspace),
      workspaceCreated,
    },
  });
};

module.exports = backfillLegacyWorkspaces;
