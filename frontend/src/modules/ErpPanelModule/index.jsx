import { useLayoutEffect } from 'react';

import DataTable from './DataTable';

import Delete from './DeleteItem';

import { useDispatch } from 'react-redux';
import { erp } from '@/redux/erp/actions';

import { useErpContext } from '@/context/erp';
import { ListFilterProvider } from '@/context/listFilter';

/**
 * One table and its forms, for one entity - the ErpPanel counterpart of
 * modules/CrudModule/CrudModule.jsx.
 *
 * Wrapped in ListFilterProvider for the same reason CrudModule is: the per-user
 * filter has to outlive the table that renders it, or a write that re-fetches
 * the list would reset the table to every row while the dropdown still named a
 * colleague. Mounted here rather than higher up so leaving the page drops the
 * selection - it names a person, and it means nothing on the next entity.
 * See context/listFilter.
 */
export default function ErpPanel({ config, extra }) {
  const dispatch = useDispatch();
  const { state } = useErpContext();
  const { deleteModal } = state;

  const dispatcher = () => {
    dispatch(erp.resetState());
  };

  useLayoutEffect(() => {
    const controller = new AbortController();
    dispatcher();
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <ListFilterProvider>
      <DataTable config={config} extra={extra} />
      <Delete config={config} isOpen={deleteModal.isOpen} />
    </ListFilterProvider>
  );
}
