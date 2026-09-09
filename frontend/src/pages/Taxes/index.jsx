import { Switch } from 'antd';
import { CloseOutlined, CheckOutlined } from '@ant-design/icons';
import CrudModule from '@/modules/CrudModule/CrudModule';
import TaxForm from '@/forms/TaxForm';
import useLanguage from '@/locale/useLanguage';

export default function Taxes() {
  const translate = useLanguage();
  const toggle = (field) => ({
    title: translate(field === 'isDefault' ? 'Default' : 'enabled'),
    dataIndex: field,
    key: field,
    render: (_, record) => (
      <Switch
        checked={record[field]}
        checkedChildren={<CheckOutlined />}
        unCheckedChildren={<CloseOutlined />}
      />
    ),
  });
  const readColumns = [
    { title: translate('Name'), dataIndex: 'taxName' },
    { title: translate('Value'), dataIndex: 'taxValue' },
    { title: translate('Default'), dataIndex: 'isDefault' },
    { title: translate('enabled'), dataIndex: 'enabled' },
  ];
  const config = {
    entity: 'taxes',
    PANEL_TITLE: translate('taxes'),
    DATATABLE_TITLE: translate('taxes_list'),
    ADD_NEW_ENTITY: translate('add_new_tax'),
    ENTITY_NAME: translate('taxes'),
    readColumns,
    dataTableColumns: [
      readColumns[0],
      { ...readColumns[1], render: (_, record) => `${record.taxValue}%` },
      toggle('isDefault'),
      toggle('enabled'),
    ],
    searchConfig: { displayLabels: ['name'], searchFields: 'name', outputValue: '_id' },
    deleteModalLabels: ['name'],
  };
  return (
    <CrudModule
      createForm={<TaxForm />}
      updateForm={<TaxForm isUpdateForm />}
      config={config}
    />
  );
}
