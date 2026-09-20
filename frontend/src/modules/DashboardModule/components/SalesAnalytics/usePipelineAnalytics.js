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
 * The cost is that this fetches every lead to count them. That is fine at the
 * scale this is for and wrong at a much larger one, where the answer is a
 * server-side aggregation - not a different arrangement of this code.
 */
export default function usePipelineAnalytics({ currentAdmin, canSeeEveryone }) {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);

  // The dashboard fires this alongside its other summary calls, so it is
  // cancelled on unmount like any other. The empty dependency list is safe
  // because the component itself is mounted only while the account holds the
  // leads module - the dashboard renders it conditionally - so a permission
  // change unmounts this rather than leaving stale figures behind.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setHasFailed(false);

      const data = await request.listAll({ entity: 'lead' });

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
  }, []);

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
