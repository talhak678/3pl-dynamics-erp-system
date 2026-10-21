import React from 'react';
import { Form, Input } from 'antd';
import { MailOutlined } from '@ant-design/icons';

export default function ForgetPasswordForm() {
  return (
    <Form.Item
      name="email"
      label="Email address"
      rules={[
        {
          required: true,
        },
        {
          type: 'email',
        },
      ]}
    >
      <Input
        prefix={<MailOutlined className="site-form-item-icon" />}
        type="email"
        placeholder="Enter the email for your account"
        autoComplete="email"
        size="large"
      />
    </Form.Item>
  );
}
