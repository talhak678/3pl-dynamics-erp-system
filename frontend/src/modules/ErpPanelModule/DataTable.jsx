import { useCallback, useEffect } from 'react';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  RedoOutlined,
  PlusOutlined,
  EllipsisOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { Dropdown, Table, Button } from 'antd';
import { PageHeader } from '@ant-design/pro-layout';

import AutoCompleteAsync from '@/components/AutoCompleteAsync';
import { useSelector, useDispatch } from 'react-redux';
import useLanguage from '@/locale/useLanguage';
import { erp } from '@/redux/erp/actions';
import { selectListItems } from '@/redux/erp/selectors';
import { selectDateRangeQuery } from '@/redux/dateRange/selectors';
import { tableWindowKey } from '@/utils/dateRange';
import { useErpContext } from '@/context/erp';
import { useListOptions } from '@/context/listFilter';
import { useNavigate } from 'react-router-dom';

import UserFilterSelect from '@/components/DataTable/UserFilterSelect';

import { DOWNLOAD_BASE_URL } from '@/config/serverApiConfig';

function AddNewItem({ config }) {
  const navigate = useNavigate();
  const { ADD_NEW_ENTITY, entity } = config;

  const handleClick = () => {
    navigate(`/${entity.toLowerCase()}/create`);
  };

  return (
    <Button onClick={handleClick} type="primary" icon={<PlusOutlined />}>
      {ADD_NEW_ENTITY}
    </Button>
  );
}

export default function DataTable({ config, extra = [] }) {
  const translate = useLanguage();
  let { entity, dataTableColumns, disableAdd = false, searchConfig } = config;

  const { DATATABLE_TITLE } = config;

  const { result: listResult, isLoading: listIsLoading } = useSelector(selectListItems);

  const { pagination, items: dataSource } = listResult;

  const { erpContextAction } = useErpContext();
  const { modal } = erpContextAction;

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
    {
      label: translate('Download'),
      key: 'download',
      icon: <FilePdfOutlined />,
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

  const navigate = useNavigate();

  const handleRead = (record) => {
    dispatch(erp.currentItem({ data: record }));
    navigate(`/${entity}/read/${record._id}`);
  };
  const handleEdit = (record) => {
    const data = { ...record };
    dispatch(erp.currentAction({ actionType: 'update', data }));
    navigate(`/${entity}/update/${record._id}`);
  };
  const handleDownload = (record) => {
    window.open(`${DOWNLOAD_BASE_URL}${entity}/${entity}-${record._id}.pdf`, '_blank');
  };

  const handleDelete = (record) => {
    dispatch(erp.currentAction({ actionType: 'delete', data: record }));
    modal.open();
  };

  const handleRecordPayment = (record) => {
    dispatch(erp.currentItem({ data: record }));
    navigate(`/invoice/pay/${record._id}`);
  };

  dataTableColumns = [
    ...dataTableColumns,
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
                case 'download':
                  handleDownload(record);
                  break;
                case 'delete':
                  handleDelete(record);
                  break;
                case 'recordPayment':
                  handleRecordPayment(record);
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

  const dispatch = useDispatch();

  // Folds the workspace owner's "Filter by User" selection, if any, into every
  // request this table makes. Nothing is added when no one is selected, so the
  // default path is unchanged. See context/listFilter.
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
      dispatch(erp.list({ entity, options }));
    },
    [dispatch, entity, listOptions]
  );

  const dispatcher = useCallback(() => {
    dispatch(erp.list({ entity, options: listOptions() }));
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
  useEffect(() => {
    dispatcher();
  }, [dispatcher]);

  const filterTable = (value) => {
    const options = listOptions({ equal: value, filter: searchConfig?.entity });
    dispatch(erp.list({ entity, options }));
  };

  return (
    <>
      <PageHeader
        title={DATATABLE_TITLE}
        ghost={true}
        onBack={() => window.history.back()}
        backIcon={<ArrowLeftOutlined />}
        extra={[
          <AutoCompleteAsync
            key="search-auto-complete"
            entity={searchConfig?.entity}
            displayLabels={['name']}
            searchFields={'name'}
            onChange={filterTable}
            // redirectLabel={'Add New Client'}
            // withRedirect
            // urlToRedirect={'/customer'}
          />,
          // Renders nothing at all unless the signed-in account owns this
          // workspace and the entity is one that records who entered a row.
          <UserFilterSelect key="user-filter" entity={entity} />,
          <Button onClick={handelDataTableLoad} key="refresh-button" icon={<RedoOutlined />}>
            {translate('Refresh')}
          </Button>,

          !disableAdd && <AddNewItem config={config} key="add-new-item" />,
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
