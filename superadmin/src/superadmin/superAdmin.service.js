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

export const listUsers = () => request.get({ entity: 'superadmin/users' });

export const createUser = ({ jsonData }) => request.post({ entity: 'superadmin/users', jsonData });

export const updateUserStatus = ({ id, isActive }) =>
  request.patch({ entity: `superadmin/users/${id}/status`, jsonData: { isActive } });

export const updateUserPermissions = ({ id, modulePermissions }) =>
  request.patch({ entity: `superadmin/users/${id}/permissions`, jsonData: { modulePermissions } });
