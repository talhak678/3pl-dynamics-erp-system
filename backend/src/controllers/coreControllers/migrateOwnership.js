const mongoose = require('mongoose');

/**
 * One-time backfill for the multi-tenancy migration.
 *
 * Strict isolation scopes every query by `createdBy`, which means every record
 * created before this migration (ownerless) would become invisible to everyone.
 * This route assigns those records to the original admin - the oldest Admin
 * document - so the existing data stays reachable and stays private.
 *
 * Usage (after deploying, with MIGRATION_SECRET set in the environment):
 *   GET /api/migrate-ownership?secret=<MIGRATION_SECRET>            -> dry run, counts only
 *   GET /api/migrate-ownership?secret=<MIGRATION_SECRET>&confirm=yes -> performs the backfill
 *
 * The route refuses to do anything if MIGRATION_SECRET is not configured, and it
 * only ever touches records that have no owner. Records that already belong to
 * someone are never modified.
 */

const OWNERLESS = {
  $or: [{ createdBy: { $exists: false } }, { createdBy: null }],
};

// Models that do not hold tenant data and must never be reassigned.
const EXCLUDED_MODELS = ['Admin', 'AdminPassword', 'Upload'];

const migrateOwnership = async (req, res) => {
  const migrationSecret = process.env.MIGRATION_SECRET;

  if (!migrationSecret) {
    return res.status(503).json({
      success: false,
      result: null,
      message: 'MIGRATION_SECRET is not configured on this deployment.',
    });
  }

  if (req.query.secret !== migrationSecret) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Forbidden',
    });
  }

  const shouldApply = req.query.confirm === 'yes';

  const Admin = mongoose.model('Admin');

  // The original admin was created first at setup time, so they are the oldest
  // Admin document. Sorting by creation date with the ObjectId as a tiebreaker
  // keeps this deterministic even if two admins share a timestamp.
  const legacyOwner = await Admin.findOne().sort({ created: 1, _id: 1 }).exec();

  if (!legacyOwner) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No Admin document found to assign legacy records to.',
    });
  }

  // Every registered model that actually declares an ownership field.
  const modelNames = mongoose
    .modelNames()
    .filter((name) => !EXCLUDED_MODELS.includes(name))
    .filter((name) => Boolean(mongoose.model(name).schema.path('createdBy')));

  const summary = [];

  for (const modelName of modelNames) {
    const Model = mongoose.model(modelName);

    const ownerlessCount = await Model.countDocuments(OWNERLESS);

    const entry = {
      model: modelName,
      total: await Model.countDocuments({}),
      ownerless: ownerlessCount,
      updated: 0,
    };

    if (shouldApply && ownerlessCount > 0) {
      const updateResult = await Model.updateMany(OWNERLESS, {
        $set: { createdBy: legacyOwner._id },
      });
      entry.updated = updateResult.modifiedCount;
    }

    summary.push(entry);
  }

  const totalOwnerless = summary.reduce((acc, item) => acc + item.ownerless, 0);
  const totalUpdated = summary.reduce((acc, item) => acc + item.updated, 0);

  return res.status(200).json({
    success: true,
    result: {
      applied: shouldApply,
      legacyOwner: {
        id: legacyOwner._id,
        name: legacyOwner.name,
        email: legacyOwner.email,
        created: legacyOwner.created,
      },
      totalOwnerless,
      totalUpdated,
      collections: summary,
    },
    message: shouldApply
      ? `Backfill complete. ${totalUpdated} record(s) assigned to ${legacyOwner.email}.`
      : `Dry run only. ${totalOwnerless} ownerless record(s) would be assigned to ${legacyOwner.email}. Re-run with &confirm=yes to apply.`,
  });
};

module.exports = migrateOwnership;
