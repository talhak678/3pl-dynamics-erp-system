import { Form, Input } from 'antd';

import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';

import ModulePermissionsChecklist from '@/modules/UserModule/ModulePermissionsChecklist';

/**
 * The permissions checklist is deliberately NOT a Form.Item-bound field. It is
 * an array of arbitrary length, and letting antd own it would mean fighting the
 * form store for no gain; the CreateUser page holds it in state and merges it
 * into the payload on submit.
 */
export default function CreateUserForm({ permissions, onPermissionsChange, disabled = false }) {
  return (
    <>
      <Form.Item
        label="Full name"
        name="name"
        rules={[{ required: true, message: 'Please enter a name for this account' }]}
      >
        <Input prefix={<UserOutlined />} placeholder="e.g. Jane Cooper" size="large" />
      </Form.Item>

      <Form.Item
        label="Email"
        name="email"
        rules={[
          { required: true, message: 'Please enter an email address' },
          { type: 'email', message: 'That does not look like a valid email' },
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="name@company.com" size="large" />
      </Form.Item>

      <Form.Item
        label="Password"
        name="password"
        rules={[
          { required: true, message: 'Please set an initial password' },
          // Matches the backend's Joi .min(8); a shorter value is rejected there.
          { min: 8, message: 'The password needs to be at least 8 characters long.' },
        ]}
        extra="At least 8 characters. Share this with the account holder over a secure channel."
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="Minimum 8 characters"
          size="large"
          autoComplete="new-password"
        />
      </Form.Item>

      <Form.Item label="Module permissions">
        <ModulePermissionsChecklist
          value={permissions}
          onChange={onPermissionsChange}
          disabled={disabled}
        />
      </Form.Item>
    </>
  );
}
