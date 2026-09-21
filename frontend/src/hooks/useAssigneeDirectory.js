import { useCallback, useEffect, useMemo, useState } from 'react';

import { request } from '@/request';
import { WORKSPACE_OWNER_ROLE } from '@/utils/salesPipeline';

/**
 * Whether this account may read the workspace's employee list at all.
 *
 * /api/team is behind requireTenantOwner, so this is a question about owning the
 * workspace rather than about any module grant - there is nothing an owner
 * could tick to share it. isSuperAdmin is excluded explicitly and for the usual
 * reason: a control-plane account owns no workspace, so it has no team to list,
 * and the backend gate refuses it on the same grounds.
 */
export const canReadTeamDirectory = (admin) =>
  admin?.role === WORKSPACE_OWNER_ROLE && admin?.isSuperAdmin !== true;

/**
 * The workspace's employees, and the means to name one from an id.
 *
 * Needed because the API hands back a bare ObjectId. The lead mapper leaves it
 * unresolved on purpose - naming an assignee needs a lookup, and which lookup is
 * allowed depends on who is asking.
 *
 * That is the whole complication here. /api/team is owner-only: it is gated by
 * requireTenantOwner, so a Sales Executive calling it gets a 403, and it is
 * scoped by parentAdminId so even if it answered it would list their
 * colleagues. An executive therefore has no directory at all - only their own
 * account, which they do not need a request for - and the leads they see
 * assigned to somebody else are ones they created and handed on.
 *
 * So the map is fetched only when `enabled` (the caller is the workspace owner)
 * and its absence is not treated as an error. What the two situations mean by
 * "an id I cannot name" differs, and resolve() reports them differently rather
 * than flattening both into one vague label:
 *
 *   a complete directory, id not in it   the account was removed
 *   no directory at all                  a colleague the caller may not look up
 *
 * Deliberately silent on failure. A 403 here is the expected answer for an
 * executive, and the request layer's own notification would put a red toast on
 * the page every time one signed in.
 */
export default function useAssigneeDirectory({ enabled, currentAdmin }) {
  const [members, setMembers] = useState(null);

  const selfId = currentAdmin?._id ? String(currentAdmin._id) : null;

  useEffect(() => {
    if (!enabled) {
      // Cleared rather than left alone: the caller can lose the owner role
      // mid-session, and a stale directory would keep naming colleagues.
      setMembers(null);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const data = await request.team.list();

      // `null` means "not a directory", which is a different answer from an
      // empty one - the empty case only arises for a workspace whose sole
      // account is its owner.
      if (!cancelled) setMembers(data?.success && Array.isArray(data.result) ? data.result : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  /**
   * The directory as a list, or null when there is none.
   *
   * The named form of what byId below holds keyed - built once here so a picker
   * and a label renderer cannot disagree about what a member is called. An
   * account with no name at all falls back to its email rather than rendering
   * as a blank row.
   */
  const directory = useMemo(() => {
    if (members === null) return null;

    return members.map((member) => ({
      id: String(member._id),
      name: [member.name, member.surname].filter(Boolean).join(' ') || member.email,
      photo: member.photo,
      role: member.role,
      isActive: member.isActive !== false,
    }));
  }, [members]);

  const byId = useMemo(() => {
    const map = new Map();

    for (const person of directory ?? []) map.set(person.id, person);

    return map;
  }, [directory]);

  /**
   * The person behind an assignee id, or null when the lead is unassigned.
   *
   * `known` is false for a name that is a description rather than a fact, so a
   * card can render it as secondary text instead of asserting it the same way it
   * asserts a real name.
   */
  const resolve = useCallback(
    (assignedTo) => {
      if (!assignedTo) return null;

      const id = String(assignedTo);

      if (id === selfId) {
        return {
          name: 'You',
          photo: currentAdmin?.photo,
          role: currentAdmin?.role,
          known: true,
        };
      }

      const member = byId.get(id);
      if (member) return { ...member, known: true };

      return {
        name: members === null ? 'A colleague' : 'Removed user',
        photo: undefined,
        role: undefined,
        known: false,
      };
    },
    [byId, members, selfId, currentAdmin]
  );

  return { resolve, hasDirectory: members !== null, directory };
}
