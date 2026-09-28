import React from 'react';
import { Form, Input, Select, InputNumber } from 'antd';

import useLanguage from '@/locale/useLanguage';
import { useMoney } from '@/settings';
import AssigneeSelect from '@/components/AssigneeSelect';

export default function OrderForm({ isUpdateForm = false }) {
  const translate = useLanguage();
  const { currency_symbol, currency_position } = useMoney();
  const validateEmptyString = (_, value) => {
    if (value && value.trim() === '') {
      return Promise.reject(new Error('Field cannot be empty'));
    }

    return Promise.resolve();
  };

  return (
    <>
      <Form.Item
        label={translate('Order ID')}
        name="orderId"
        rules={[
          {
            required: true,
          },
          {
            validator: validateEmptyString,
          },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item
        label={translate('Products')}
        name="products"
        rules={[
          {
            required: true,
          },
          {
            validator: validateEmptyString,
          },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item
        label={translate('Quantity')}
        name="quantity"
        rules={[
          {
            required: true,
          },
        ]}
      >
        <InputNumber style={{ width: '100%' }} min={1} />
      </Form.Item>

      {/*
        The price, prefixed or suffixed with the workspace's own currency.

        This field used to carry a hardcoded `prefix="$"`, which is where the
        dollar sign in Orders came from - it was not read from settings at all,
        so it stayed a dollar sign for every account no matter what currency the
        workspace had been set to. The symbol and its side now come from the same
        hook every other money field in the app uses (see DynamicForm's `currency`
        type and components/MoneyInputFormItem), which reads the tenant's
        money_format_settings from the redux settings slice that apps/ErpApp
        loads once for the whole session.

        Nothing about who may load those settings changed: /setting/list is on
        the core API, which is behind the auth token and behind no module at all,
        so a child account has always received its workspace's currency - the
        request was not failing, this field was simply not asking.
      */}
      <Form.Item
        label={translate('Price')}
        name="price"
        rules={[
          {
            required: true,
          },
        ]}
      >
        <InputNumber
          min={0}
          precision={2}
          style={{ width: '100%' }}
          addonBefore={currency_position === 'before' ? currency_symbol : undefined}
          addonAfter={currency_position === 'after' ? currency_symbol : undefined}
        />
      </Form.Item>

      <Form.Item
        label={translate('status')}
        name="status"
        rules={[
          {
            required: true,
          },
        ]}
      >
        <Select>
          <Select.Option value="pending">{translate('Pending')}</Select.Option>
          <Select.Option value="shipped">{translate('Shipped')}</Select.Option>
          <Select.Option value="delivered">{translate('Delivered')}</Select.Option>
          <Select.Option value="cancelled">{translate('Cancelled')}</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        label={translate('Note')}
        name="notes"
        rules={[
          {
            validator: validateEmptyString,
          },
        ]}
      >
        <Input.TextArea rows={4} />
      </Form.Item>
      {/*
        Who inside the workspace owns this order. Brings its own Form.Item and
        renders nothing at all for an account that may not assign, so an owner
        gains a picker here and everyone else sees the form they had before.
      */}
      <AssigneeSelect />
    </>
  );
}
