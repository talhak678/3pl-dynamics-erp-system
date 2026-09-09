import { Switch } from 'antd';
import { CloseOutlined, CheckOutlined } from '@ant-design/icons';
import CrudModule from '@/modules/CrudModule/CrudModule';
import PaymentModeForm from '@/forms/PaymentModeForm';
import useLanguage from '@/locale/useLanguage';

export default function PaymentMode() {
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
    { title: translate('Payment Mode'), dataIndex: 'name' },
    { title: translate('Description'), dataIndex: 'description' },
    { title: translate('Default'), dataIndex: 'isDefault' },
    { title: translate('enabled'), dataIndex: 'enabled' },
  ];
  const config = {
    entity: 'paymentMode',
    PANEL_TITLE: translate('payment_mode'),
    DATATABLE_TITLE: translate('payment_mode_list'),
    ADD_NEW_ENTITY: translate('add_new_payment_mode'),
    ENTITY_NAME: translate('payment_mode'),
    readColumns,
    dataTableColumns: [readColumns[0], readColumns[1], toggle('isDefault'), toggle('enabled')],
    searchConfig: { displayLabels: ['name'], searchFields: 'name', outputValue: '_id' },
    deleteModalLabels: ['name'],
  };
  return (
    <CrudModule
      createForm={<PaymentModeForm />}
      updateForm={<PaymentModeForm isUpdateForm />}
      config={config}
    />
  );
}
