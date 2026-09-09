import { Form, Select } from 'antd';
import { useSelector } from 'react-redux';

import useLanguage from '@/locale/useLanguage';
import { selectMoneyFormat } from '@/redux/settings/selectors';
import { currencyOptions } from '@/utils/currencyList';

export default function SelectCurrency() {
  const translate = useLanguage();
  const moneyFormatSettings = useSelector(selectMoneyFormat);

  return (
    <Form.Item
      label={translate('currency')}
      name="currency"
      rules={[
        {
          required: true,
        },
      ]}
      initialValue={moneyFormatSettings.default_currency_code}
    >
      <Select
        showSearch
        filterOption={(input, option) =>
          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
        options={currencyOptions()}
      />
    </Form.Item>
  );
}
