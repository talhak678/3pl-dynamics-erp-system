import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * The "show me only this person's rows" choice for the table on screen.
 *
 * It lives in a context rather than in the table's own state because the choice
 * has to survive more than one dispatch. Five components re-fetch the list after
 * a write - the table itself, the create form, the edit form and the delete
 * modal - and each of them calls `crud.list({ entity })` with nothing else. If
 * the selection were held in the table, those four would each reset the table to
 * every row while the dropdown still read "Alice" - a screen that contradicts
 * itself, and one the user would have to re-filter after every save.
 *
 * Scoped to a single CrudModule. The provider is mounted by CrudModule itself,
 * so navigating to another page starts from no filter, which is the right
 * default: the selection names a person, and it means nothing on the next
 * entity.
 *
 * This is presentation only. The server decides what a filter is allowed to do -
 * see middlewares/ownership.js, where the parameter is ignored outright for
 * anyone who is not the workspace owner.
 */
const ListFilterContext = createContext(null);

export function ListFilterProvider({ children }) {
  const [userId, setUserId] = useState('');

  const value = useMemo(() => ({ userId, setUserId }), [userId]);

  return <ListFilterContext.Provider value={value}>{children}</ListFilterContext.Provider>;
}

function useListFilterContext() {
  const context = useContext(ListFilterContext);

  if (context === null) {
    throw new Error('useListFilter must be used within a ListFilterProvider');
  }

  return context;
}

/** The current selection and the setter, for the control that renders it. */
export function useListFilter() {
  return useListFilterContext();
}

/**
 * Folds the selection into the options a list request is dispatched with.
 *
 * Returned as a function rather than as a ready-made object so each caller can
 * merge it into the options it already has - a page number, a search term -
 * instead of one overwriting the other.
 *
 * An empty selection contributes nothing at all rather than an empty parameter,
 * so the request that goes out is byte-for-byte the one that went out before
 * this feature existed.
 */
export function useListOptions() {
  const { userId } = useListFilterContext();

  return useCallback(
    (options = {}) => (userId ? { ...options, user: userId } : options),
    [userId]
  );
}
