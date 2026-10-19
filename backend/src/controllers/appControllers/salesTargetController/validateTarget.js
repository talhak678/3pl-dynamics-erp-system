const { validateAssignedTo } = require('../../../utils/assignee');

const PERIODS = ['Monthly', 'Quarterly', 'Yearly', 'Custom'];
const TYPES = ['Revenue', 'Deals'];

const isBlank = (value) => value === undefined || value === null || value === '';

const parseDate = (value) => {
  if (isBlank(value)) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** A target's title as submitted, trimmed, or an error. */
const parseTitle = (value) => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value.trim();
};

/** A non-negative finite number, or null. `Number('')` is 0, so blanks are tested first. */
const parseAmount = (value) => {
  if (isBlank(value)) return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/**
 * Validates the fields a target is made of, for both create and update.
 *
 * `body` is the merged view: on update the caller passes the submitted values
 * over the stored ones, so a partial edit is validated against the period it
 * will actually have rather than against a half-built object.
 *
 * Returns `{ ok: true, values }` or `{ ok: false, message }`. The values are the
 * parsed forms - Dates rather than strings - so the controller never saves an
 * "Invalid Date" that only fails later at render time.
 */
const validateTarget = (body) => {
  const title = parseTitle(body.title);

  if (!title) return { ok: false, message: 'A target title is required.' };

  const period = body.period ?? 'Monthly';

  if (!PERIODS.includes(period)) {
    return { ok: false, message: `Period must be one of: ${PERIODS.join(', ')}.` };
  }

  const type = body.type ?? 'Revenue';

  if (!TYPES.includes(type)) {
    return { ok: false, message: `Target type must be one of: ${TYPES.join(', ')}.` };
  }

  const targetValue = parseAmount(body.targetValue);

  if (targetValue === null) {
    return { ok: false, message: 'A target value of zero or more is required.' };
  }

  const startDate = parseDate(body.startDate);
  const endDate = parseDate(body.endDate);

  if (!startDate || !endDate) {
    return { ok: false, message: 'A start and end date are required.' };
  }

  if (startDate > endDate) {
    return { ok: false, message: 'The end date must be on or after the start date.' };
  }

  return {
    ok: true,
    values: {
      title,
      period,
      type,
      targetValue,
      startDate,
      endDate,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    },
  };
};

/**
 * Resolves a submitted assignee against the caller's workspace.
 *
 * Reuses the same check every other assignee write uses (utils/assignee.js), so
 * a target cannot point at an account in another tenant. Absent, null and the
 * empty string all mean "company-wide".
 */
const resolveAssignee = async (req, value) => {
  const assignment = await validateAssignedTo(req, value);

  if (assignment.error) return { ok: false, message: assignment.error };

  return { ok: true, value: assignment.value ?? null };
};

module.exports = { validateTarget, resolveAssignee, PERIODS, TYPES };
