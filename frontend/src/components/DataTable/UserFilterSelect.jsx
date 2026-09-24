import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { Select } from 'antd';

import { request } from '@/request';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { useListFilter } from '@/context/listFilter';

/**
 * The entities whose tables offer the per-user filter.
 *
 * Must be exactly the entities that record authorship - the models listed in
 * SCOPED_MODEL_NAMES on the backend (middlewares/ownership.js), each of which
 * carries a `createdByUser`, an `assignedTo`, or both. On anything else the
 * backend ignores the parameter, so offering the control would produce a
 * dropdown that visibly does nothing: the owner picks a colleague and the table
 * does not move.
 *
 * Both halves have to agree, and the list is written out rather than derived
 * because the backend's copy is keyed on Mongoose model names ('Client',
 * 'ExpenseCategory') and this one on the API's entity names ('client',
 * 'expensecategory') - see moduleForEntity in the backend's utils/moduleList.js
 * for the same mapping. Products, product categories, taxes, payment modes,
 * employees and shipments are deliberately absent: they stay workspace-global,
 * as does every setting.
 */
const FILTERABLE_ENTITIES = [
  'client',
  'people',
  'company',
  'lead',
  'offer',
  'quote',
  'invoice',
  'payment',
  'order',
  'expense',
  'expensecategory',
];

/**
 * Whether this account owns the workspace it is signed in to.
 *
 * The same test the backend makes before it will honour the parameter, and the
 * same one the sidebar uses to decide who sees User Management. A super admin is
 * excluded even though the control plane may give them role 'owner': they own no
 * workspace, so there is no team to list and the endpoint behind this would
 * refuse them anyway.
 */
const isTenantOwner = (admin) => admin?.role === 'owner' && admin?.isSuperAdmin !== true;

/**
 * "Filter by User" for a table of records that record who entered them.
 *
 * Rendered only for the workspace owner. An employee is never offered it at all,
 * which is the visible half of a rule the server enforces on its own: the
 * parameter is ignored for anyone else, so a child account that sent it by hand
 * would still receive exactly the rows their own scope returns. Hiding the
 * control is a courtesy, not the mechanism.
 *
 * The team list comes from /api/team, which is owner-only and returns the
 * accounts this owner created - not the owner themselves, so "only my rows" is
 * not one of the choices. That is deliberate for now: the requirement this
 * implements is about inspecting a colleague's records, and adding the owner as
 * a ninth option would mean asking the API for an account it structurally does
 * not return.
 *
 * The whole control is withheld when the team list is empty or the call failed.
 * A workspace with no employees has nothing to filter by, and an empty dropdown
 * would read as a broken control rather than an absent one. The failure case
 * folds into the same outcome on purpose: an empty filter is the absence of a
 * filter, so losing the control costs nothing, while a control that silently
 * returns nothing would cost the owner the table.
 */
export default function UserFilterSelect({ entity }) {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const { userId, setUserId } = useListFilter();

  const [members, setMembers] = useState([]);

  const enabled = isTenantOwner(currentAdmin) && FILTERABLE_ENTITIES.includes(entity);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    const loadTeam = async () => {
      const data = await request.team.list();

      // The request layer returns its own failure shape rather than throwing,
      // so the array is checked rather than assumed.
      if (!cancelled) setMembers(Array.isArray(data?.result) ? data.result : []);
    };

    loadTeam();

    // A page can be left before the call returns, and this component is gone by
    // then. The flag is what stops a late response writing into it.
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const options = useMemo(
    () =>
      members.map((member) => {
        const fullName = [member.name, member.surname].filter(Boolean).join(' ');

        return {
          value: member._id,
          // Falls back to the email rather than rendering a blank row: a member
          // with no name set is unusual but was allowed by the form, and an
          // unnamed option would be unselectable in practice.
          label: fullName || member.email,
        };
      }),
    [members]
  );

  if (!enabled || options.length === 0) return null;

  return (
    <Select
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder="Filter by User"
      value={userId || undefined}
      onChange={(value) => setUserId(value || '')}
      options={options}
      style={{ minWidth: 220 }}
      aria-label="Filter by user"
    />
  );
}
