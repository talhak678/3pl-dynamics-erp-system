import { useCallback, useEffect } from 'react';

import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  RedoOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { Dropdown, Table, Button, Input } from 'antd';
import { PageHeader } from '@ant-design/pro-layout';

import { useSelector, useDispatch } from 'react-redux';
import { crud } from '@/redux/crud/actions';
import { selectListItems } from '@/redux/crud/selectors';
import { selectDateRangeQuery } from '@/redux/dateRange/selectors';
import { tableWindowKey } from '@/utils/dateRange';
import useLanguage from '@/locale/useLanguage';
import { dataForTable } from '@/utils/dataStructure';
import { useMoney, useDate } from '@/settings';

import { generate as uniqueId } from 'shortid';

import { useCrudContext } from '@/context/crud';
import { useListOptions } from '@/context/listFilter';

import UserFilterSelect from './UserFilterSelect';

function AddNewItem({ config }) {
  const { crudContextAction } = useCrudContext();
  const { collapsedBox, panel } = crudContextAction;
  const { ADD_NEW_ENTITY } = config;

  const handelClick = () => {
    panel.open();
    collapsedBox.close();
  };

  return (
    <Button onClick={handelClick} type="primary">
      {ADD_NEW_ENTITY}
    </Button>
  );
}
export default function DataTable({ config, extra = [] }) {
  let { entity, dataTableColumns, DATATABLE_TITLE, fields, searchConfig } = config;
  const { crudContextAction } = useCrudContext();
  const { panel, collapsedBox, modal, readBox, editBox, advancedBox } = crudContextAction;
  const translate = useLanguage();
  const { moneyFormatter } = useMoney();
  const { dateFormat } = useDate();

  const items = [
    {
      label: translate('Show'),
      key: 'read',
      icon: <EyeOutlined />,
    },
    {
      label: translate('Edit'),
      key: 'edit',
      icon: <EditOutlined />,
    },
    ...extra,
    {
      type: 'divider',
    },

    {
      label: translate('Delete'),
      key: 'delete',
      icon: <DeleteOutlined />,
    },
  ];

  const handleRead = (record) => {
    dispatch(crud.currentItem({ data: record }));
    panel.open();
    collapsedBox.open();
    readBox.open();
  };
  function handleEdit(record) {
    dispatch(crud.currentItem({ data: record }));
    dispatch(crud.currentAction({ actionType: 'update', data: record }));
    editBox.open();
    panel.open();
    collapsedBox.open();
  }
  function handleDelete(record) {
    dispatch(crud.currentAction({ actionType: 'delete', data: record }));
    modal.open();
  }

  function handleUpdatePassword(record) {
    dispatch(crud.currentItem({ data: record }));
    dispatch(crud.currentAction({ actionType: 'update', data: record }));
    advancedBox.open();
    panel.open();
    collapsedBox.open();
  }

  let dispatchColumns = [];
  if (fields) {
    dispatchColumns = [...dataForTable({ fields, translate, moneyFormatter, dateFormat })];
  } else {
    dispatchColumns = [...dataTableColumns];
  }

  dataTableColumns = [
    ...dispatchColumns,
    {
      title: '',
      key: 'action',
      fixed: 'right',
      render: (_, record) => (
        <Dropdown
          menu={{
            items,
            onClick: ({ key }) => {
              switch (key) {
                case 'read':
                  handleRead(record);
                  break;
                case 'edit':
                  handleEdit(record);
                  break;

                case 'delete':
                  handleDelete(record);
                  break;
                case 'updatePassword':
                  handleUpdatePassword(record);
                  break;

                default:
                  break;
              }
              // else if (key === '2')handleCloseTask
            },
          }}
          trigger={['click']}
        >
          <EllipsisOutlined
            style={{ cursor: 'pointer', fontSize: '24px' }}
            onClick={(e) => e.preventDefault()}
          />
        </Dropdown>
      ),
    },
  ];

  const { result: listResult, isLoading: listIsLoading } = useSelector(selectListItems);

  const { pagination, items: dataSource } = listResult;

  const dispatch = useDispatch();

  // Folds the workspace owner's "Filter by User" selection, if any, into every
  // request this table makes. Nothing is added when no one is selected, so the
  // default path is unchanged.
  const listOptions = useListOptions();

  // The header's date range, as one comparable value. Empty - and therefore
  // constant - for entities the window does not apply to, so those tables do not
  // re-fetch, and do not drop back to page one, when the control moves. The
  // thunk adds the window itself; this only decides when to ask again.
  const windowKey = tableWindowKey(entity, useSelector(selectDateRangeQuery));

  const handelDataTableLoad = useCallback(
    (pagination) => {
      const options = listOptions({
        page: pagination.current || 1,
        items: pagination.pageSize || 10,
      });
      dispatch(crud.list({ entity, options }));
    },
    [dispatch, entity, listOptions]
  );

  const filterTable = (e) => {
    const value = e.target.value;
    const options = listOptions({ q: value, fields: searchConfig?.searchFields || '' });
    dispatch(crud.list({ entity, options }));
  };

  const dispatcher = useCallback(() => {
    dispatch(crud.list({ entity, options: listOptions() }));
  }, [dispatch, entity, listOptions, windowKey]);

  // Runs on mount, again whenever the filter selection changes, and again
  // whenever the header's date range moves - each has to be a new request, and
  // this is the one place that knows how to make one correctly. Pagination
  // resets as a side effect, which is what a filter change should do anyway.
  //
  // `windowKey` is the date range, reduced to one comparable value and empty for
  // entities the window does not apply to - see tableWindowKey. Without it the
  // list thunk still reads the current window when it fires, which is why a
  // table that re-mounts (navigate away and back) shows the new dates while one
  // already on screen keeps the old ones.
  //
  // No AbortController here: the previous version created one and never passed
  // its signal to anything, so it cancelled nothing. A response that arrives
  // after the user has moved on is written to the store either way, and the
  // reducer has no notion of which request is current.
  useEffect(() => {
    dispatcher();
  }, [dispatcher]);

  return (
    <>
      <PageHeader
        onBack={() => window.history.back()}
        backIcon={<ArrowLeftOutlined />}
        title={DATATABLE_TITLE}
        ghost={false}
        extra={[
          <Input
            key={`searchFilterDataTable}`}
            onChange={filterTable}
            placeholder={translate('search')}
            allowClear
          />,
          // Renders nothing at all unless the signed-in account owns this
          // workspace and the entity is one that records who entered a row.
          <UserFilterSelect key={`userFilterDataTable`} entity={entity} />,
          <Button onClick={handelDataTableLoad} key={`${uniqueId()}`} icon={<RedoOutlined />}>
            {translate('Refresh')}
          </Button>,

          <AddNewItem key={`${uniqueId()}`} config={config} />,
        ]}
        style={{
          padding: '20px 0px',
        }}
      ></PageHeader>

      <Table
        columns={dataTableColumns}
        rowKey={(item) => item._id}
        dataSource={dataSource}
        pagination={pagination}
        loading={listIsLoading}
        onChange={handelDataTableLoad}
        scroll={{ x: true }}
      />
    </>
  );
}
