import { Form, Input, Select, Typography } from 'antd';

import {
  ApartmentOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';

import ModulePermissionsChecklist from '@/modules/UserModule/ModulePermissionsChecklist';

const { Text } = Typography;

/**
 * The permissions checklist is deliberately NOT a Form.Item-bound field. It is
 * an array of arbitrary length, and letting antd own it would mean fighting the
 * form store for no gain; the CreateUser page holds it in state and merges it
 * into the payload on submit.
 *
 * The workspace select IS bound, and is required. It is placed first because it
 * is the prerequisite for everything below it: there is no account without a
 * workspace, so the form asks for that before it asks who the account is.
 *
 * Only ACTIVE workspaces are offered - the page fetches them with
 * `activeOnly`, and the server re-checks the same condition on submit. An
 * inactive workspace therefore cannot be selected here even if the list is
 * stale, and the server refuses it if it somehow is.
 */
export default function CreateUserForm({
  permissions,
  onPermissionsChange,
  workspaces = [],
  workspacesLoading = false,
  disabled = false,
}) {
  // Nothing to choose from means the flow has not been started yet. The select
  // is left enabled-but-unusable and says why, rather than being disabled with
  // no explanation, and the page disables the submit button.
  const noWorkspaces = !workspacesLoading && workspaces.length === 0;

  return (
    <>
      <Form.Item
        label="Workspace"
        name="workspace"
        rules={[{ required: true, message: 'Please select a workspace for this account' }]}
        extra={
          noWorkspaces
            ? 'No active workspaces yet. Create one in Workspace Management before adding a user.'
            : 'The customer account this user is being provisioned for.'
        }
        validateStatus={noWorkspaces ? 'warning' : undefined}
      >
        <Select
          showSearch
          allowClear
          size="large"
          loading={workspacesLoading}
          disabled={disabled || noWorkspaces}
          placeholder={noWorkspaces ? 'No active workspaces' : 'Select a workspace'}
          optionFilterProp="label"
          suffixIcon={<ApartmentOutlined />}
          notFoundContent={<Text type="secondary">No active workspaces</Text>}
          options={workspaces.map((workspace) => ({
            value: workspace._id,
            // Searched against, so it carries both halves of what is on screen.
            label: `${workspace.code} — ${workspace.name}`,
            code: workspace.code,
            workspaceName: workspace.name,
          }))}
          optionRender={(option) => (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong>{option.data.code}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {option.data.workspaceName}
              </Text>
            </div>
          )}
        />
      </Form.Item>

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
