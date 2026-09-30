import { useEffect, useMemo, useState } from 'react';

import { request } from '@/request';
import useAssigneeDirectory from '@/hooks/useAssigneeDirectory';
import { SALES_STAGES, stageOf } from '@/utils/salesStages';

/**
 * The numbers behind the dashboard's sales analytics.
 *
 * Derived on the client from one /api/lead/listAll, rather than from a new
 * aggregation endpoint, and that is a deliberate choice about isolation. listAll
 * already applies leadFilter, so the rows arriving here are exactly the rows the
 * caller is allowed to see: an owner gets the whole workspace, a Sales Executive
 * gets only their own leads. Every figure below is therefore scoped by
 * construction. A bespoke endpoint would have had to re-derive that scoping, and
 * a second place where scoping is decided is a second place it can be got wrong.
 *
 * The dashboard's date range is passed along as query parameters on that same
 * call and is applied by the server, through the same leadFilter, as a separate
 * `$and` entry - so it narrows the rows the caller was already entitled to and
 * cannot reach past them. It is deliberately NOT filtered here in the browser:
 * the server would still have sent the whole workspace's leads over the wire for
 * a client-side pass to throw most of them away, and a filter applied after the
 * data has already crossed the boundary is a filter applied in the wrong place.
 * See utils/dateRange.js in the backend.
 *
 * What the window means is worth being precise about, because it is not what the
 * card titles alone suggest. It is applied to the lead's `created` date, and
 * `salesStage` records a lead's state now rather than when it changed, so these
 * are the leads OPENED in the range and where they stand today. A lead opened in
 * June and won in September is in June's figures, not September's. There is no
 * per-stage timestamp on the model to do better with, and inventing one is a
 * change to the lead model rather than to this card.
 *
 * The cost is that this fetches every lead in the range to count them. That is
 * fine at the scale this is for and wrong at a much larger one, where the answer
 * is a server-side aggregation - not a different arrangement of this code.
 */
export default function usePipelineAnalytics({ currentAdmin, canSeeEveryone, dateQuery = {} }) {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);

  const { startDate, endDate } = dateQuery;

  // The dashboard fires this alongside its other summary calls, so it is
  // cancelled on unmount like any other. The effect re-runs when the reader
  // applies a different date range, which is the whole point of the control -
  // the two bounds are named individually rather than depending on the object
  // wrapping them, so it re-runs when the window moves and not when the wrapper
  // is rebuilt.
  //
  // Permission is not in the list for the same reason it never was: the
  // component is mounted only while the account holds the leads module - the
  // dashboard renders it conditionally - so losing the module unmounts this
  // rather than leaving stale figures behind.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setHasFailed(false);

      const data = await request.listAll({ entity: 'lead', options: dateQuery });

      if (cancelled) return;

      if (data?.success) {
        setLeads(Array.isArray(data.result) ? data.result : []);
      } else {
        setHasFailed(true);
        setLeads([]);
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Only an owner may look colleagues up - /api/team is behind requireTenantOwner
  // and scoped to the accounts they created. An executive's own name needs no
  // request, and the directory hook handles that case itself.
  const { resolve } = useAssigneeDirectory({
    enabled: canSeeEveryone,
    currentAdmin,
  });

  const byStage = useMemo(() => {
    const groups = new Map(SALES_STAGES.map((stage) => [stage.value, 0]));

    for (const lead of leads) {
      const value = stageOf(lead.salesStage).value;
      groups.set(value, groups.get(value) + 1);
    }

    return groups;
  }, [leads]);

  const outcomes = useMemo(() => {
    const won = byStage.get('Won');
    const lost = byStage.get('Lost');
    const decided = won + lost;

    return {
      total: leads.length,
      won,
      lost,
      open: leads.length - decided,
      // Guarded rather than left to produce NaN, which antd renders as "NaN%"
      // and reads as a bug in the app rather than as an empty pipeline.
      winRate: decided > 0 ? Math.round((won / decided) * 100) : 0,
      hasDecided: decided > 0,
    };
  }, [leads.length, byStage]);

  const stages = useMemo(
    () =>
      SALES_STAGES.map((stage) => ({
        ...stage,
        count: byStage.get(stage.value),
        // A share of the whole pipeline, so the bars say where the work is
        // rather than only how much of it there is.
        share: leads.length > 0 ? Math.round((byStage.get(stage.value) / leads.length) * 100) : 0,
      })),
    [byStage, leads.length]
  );

  /**
   * Leads grouped by the executive they are assigned to.
   *
   * Unassigned leads get their own row rather than being dropped: "nobody owns
   * these" is the most actionable thing this card can say, and a breakdown whose
   * rows do not add up to the total is worse than no breakdown.
   */
  const byAssignee = useMemo(() => {
    const groups = new Map();

    for (const lead of leads) {
      const key = lead.assignedTo ? String(lead.assignedTo) : null;

      if (!groups.has(key)) {
        groups.set(key, { id: key, assigned: 0, won: 0, lost: 0, open: 0 });
      }

      const group = groups.get(key);
      const stage = stageOf(lead.salesStage).value;

      group.assigned += 1;
      if (stage === 'Won') group.won += 1;
      else if (stage === 'Lost') group.lost += 1;
      else group.open += 1;
    }

    return [...groups.values()]
      .map((group) => {
        const person = group.id ? resolve(group.id) : null;

        return {
          ...group,
          name: group.id ? person?.name ?? 'Unknown' : 'Unassigned',
          photo: person?.photo,
          known: person?.known ?? false,
          // Won as a share of everything closed, matching the headline win rate.
          // Not won/assigned: a lead still open is neither a win nor a loss, and
          // dividing by it would make a big pipeline look like a bad one.
          winRate:
            group.won + group.lost > 0
              ? Math.round((group.won / (group.won + group.lost)) * 100)
              : 0,
        };
      })
      .sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name));
  }, [leads, resolve]);

  return { isLoading, hasFailed, outcomes, stages, byAssignee };
}
