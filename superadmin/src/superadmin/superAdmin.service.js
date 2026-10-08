import { request } from '@/request';

/**
 * Thin wrapper over the shared `request` helpers.
 *
 * Note on response shapes: `request.get` and `request.post` return the raw
 * response body without firing a toast, which is what we want for reads and for
 * create (where the caller decides what to say). `request.patch` fires its own
 * success toast via successHandler.
 *
 * Every failure path routes through errorHandler, which already raises a
 * notification carrying the backend's message — so a 409 "An account with this
 * email already exists" surfaces to the user without extra work here.
 */

/**
 * Tenant accounts, optionally narrowed to one workspace.
 *
 * `workspace` is a query parameter rather than a path segment, because it
 * narrows this collection rather than naming a different one - and it is left
 * off the URL entirely when the caller has not chosen one. That matters: the
 * controller reads an absent parameter as "every workspace", so a cleared
 * dropdown asks exactly the question this call asked before the filter existed,
 * rather than a special `all` value the server would have to know about.
 *
 * Built onto the entity string by hand, following listWorkspaces below, because
 * request.get takes no options object. The id is percent-encoded rather than
 * pasted in raw: it is an opaque handle on this side, and nothing here should
 * have to know it is hex.
 */
export const listUsers = ({ workspace } = {}) =>
  request.get({
    entity: workspace
      ? `superadmin/users?workspace=${encodeURIComponent(workspace)}`
      : 'superadmin/users',
  });

export const createUser = ({ jsonData }) => request.post({ entity: 'superadmin/users', jsonData });

export const updateUserStatus = ({ id, isActive }) =>
  request.patch({ entity: `superadmin/users/${id}/status`, jsonData: { isActive } });

export const updateUserPermissions = ({ id, modulePermissions }) =>
  request.patch({ entity: `superadmin/users/${id}/permissions`, jsonData: { modulePermissions } });

/**
 * Workspaces.
 *
 * `activeOnly` is what the Create User form asks for - an inactive workspace
 * must not be selectable for a new account. Workspace Management asks for the
 * full list, so a workspace that has been switched off is still visible and can
 * be switched back on.
 */
export const listWorkspaces = ({ activeOnly = false } = {}) =>
  request.get({ entity: `superadmin/workspaces${activeOnly ? '?activeOnly=true' : ''}` });

export const createWorkspace = ({ jsonData }) =>
  request.post({ entity: 'superadmin/workspaces', jsonData });

export const updateWorkspaceStatus = ({ id, isActive }) =>
  request.patch({ entity: `superadmin/workspaces/${id}/status`, jsonData: { isActive } });
