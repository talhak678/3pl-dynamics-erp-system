import React from 'react';
import { Form, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';

export default function ResetPasswordForm() {
  return (
    <>
      <Form.Item
        name="password"
        label="New password"
        rules={[
          {
            required: true,
          },
          {
            min: 6,
            message: 'Use at least 6 characters.',
          },
          {
            max: 128,
            message: 'Use 128 characters or fewer.',
          },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined className="site-form-item-icon" />}
          placeholder="Enter your new password"
          autoComplete="new-password"
          size="large"
        />
      </Form.Item>
      <Form.Item
        name="confirm_password"
        label="Confirm new password"
        dependencies={['password']}
        rules={[
          {
            required: true,
          },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('The two passwords that you entered do not match!'));
            },
          }),
        ]}
        hasFeedback
      >
        <Input.Password
          prefix={<LockOutlined className="site-form-item-icon" />}
          placeholder="Confirm your new password"
          autoComplete="new-password"
          size="large"
        />
      </Form.Item>
    </>
  );
}
