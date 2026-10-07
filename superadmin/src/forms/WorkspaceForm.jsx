import { Form, Input } from 'antd';

import {
  ApartmentOutlined,
  BarcodeOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons';

/**
 * The fields of a workspace, matching the backend's createWorkspace validation.
 *
 * Code and Name are required; the three customer fields are optional, because a
 * workspace is created before the customer's details are always to hand and
 * refusing to record one for want of a phone number would defeat the module.
 *
 * Code is upper-cased as it is typed and restricted to the same character set
 * the server enforces, so a code that reaches the API has already been rejected
 * or accepted once and the user is not told about it twice.
 */
export default function WorkspaceForm({ disabled = false }) {
  return (
    <>
      <Form.Item
        label="Code"
        name="code"
        normalize={(value) => (value ? value.toUpperCase() : value)}
        rules={[
          { required: true, message: 'Please enter a code for this workspace' },
          { max: 50, message: 'The code must not exceed 50 characters' },
          {
            pattern: /^[A-Z0-9_-]+$/,
            message: 'Use only uppercase letters, numbers, underscores and hyphens',
          },
        ]}
        extra="A short handle for this customer, e.g. ACME-01. It must be unique."
      >
        <Input prefix={<BarcodeOutlined />} placeholder="ACME-01" size="large" disabled={disabled} />
      </Form.Item>

      <Form.Item
        label="Name"
        name="name"
        rules={[{ required: true, message: 'Please enter a name for this workspace' }]}
      >
        <Input
          prefix={<ApartmentOutlined />}
          placeholder="e.g. Acme Logistics"
          size="large"
          disabled={disabled}
        />
      </Form.Item>

      <Form.Item label="Customer name" name="customerName">
        <Input prefix={<UserOutlined />} placeholder="e.g. Jane Cooper" size="large" disabled={disabled} />
      </Form.Item>

      <Form.Item
        label="Customer email"
        name="customerEmail"
        rules={[{ type: 'email', message: 'That does not look like a valid email' }]}
      >
        <Input
          prefix={<MailOutlined />}
          placeholder="name@company.com"
          size="large"
          disabled={disabled}
        />
      </Form.Item>

      <Form.Item label="Customer phone" name="customerPhone">
        <Input
          prefix={<PhoneOutlined />}
          placeholder="+92XXXXXXXXXX"
          size="large"
          inputMode="tel"
          disabled={disabled}
        />
      </Form.Item>
    </>
  );
}
