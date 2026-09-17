import { useEffect } from 'react';
import { Alert, Button, Drawer, Form, Input, Segmented, Space } from 'antd';

import ModulePermissionsChecklist from './ModulePermissionsChecklist';

/**
 * Create and edit an employee, in a drawer.
 *
 * One component for both, because the field set is identical and the only real
 * differences are the title and whether a password is required - splitting it
 * would mean keeping two copies of the validation in step.
 *
 * The Role field is shown but not editable, and that is a deliberate departure
 * from "give it a dropdown". This endpoint can only ever produce an 'employee':
 * an owner promoting someone is how a tenant would escalate its own account,
 * and the server ignores the field entirely (see teamController/updateMember.js).
 * A dropdown offering 'owner' would be a control that silently does nothing.
 */
export default function MemberFormDrawer({
  open,
  member,
  grantable,
  submitting,
  onClose,
  onSubmit,
  onDelete,
}) {
  const [form] = Form.useForm();
  const isEdit = Boolean(member);

  useEffect(() => {
    if (!open) return;

    // Reset rather than merge, so opening "create" after editing someone does
    // not inherit the previous person's modules.
    if (isEdit) {
      form.setFieldsValue({
        name: member.name,
        surname: member.surname,
        email: member.email,
        password: '',
        // Held as a string, not the boolean it maps to. Segmented types its
        // value as string | number, so binding a boolean to it would depend on
        // how it compares options internally rather than on its contract.
        status: member.isActive ? 'active' : 'inactive',
        modulePermissions: member.modulePermissions ?? [],
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'active', modulePermissions: [] });
    }
  }, [open, member, isEdit, form]);

  const handleFinish = (values) => {
    const payload = {
      name: values.name,
      surname: values.surname || undefined,
      email: values.email,
      isActive: values.status === 'active',
      modulePermissions: values.modulePermissions,
    };

    // Only sent when actually typed. An empty string would otherwise be a new
    // password of length zero, and the server's min(8) would reject the whole
    // save for a field the user deliberately left alone.
    if (values.password) payload.password = values.password;

    onSubmit(payload);
  };

  return (
    <Drawer
      title={isEdit ? 'Edit User' : 'Create User'}
      width={640}
      open={open}
      onClose={onClose}
      destroyOnClose
      maskClosable={!submitting}
      extra={
        <Space>
          {isEdit && (
            <Button danger onClick={onDelete} disabled={submitting}>
              Remove
            </Button>
          )}
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="primary" loading={submitting} onClick={() => form.submit()}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark="optional">
        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: 'Please enter a name' }]}
        >
          <Input placeholder="First name" />
        </Form.Item>

        <Form.Item name="surname" label="Surname">
          <Input placeholder="Last name" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Please enter an email address' },
            { type: 'email', message: 'Please enter a valid email address' },
          ]}
        >
          <Input placeholder="name@company.com" autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="password"
          label={isEdit ? 'New Password' : 'Password'}
          rules={
            isEdit
              ? [{ min: 8, message: 'Password must be at least 8 characters' }]
              : [
                  { required: true, message: 'Please set a password' },
                  { min: 8, message: 'Password must be at least 8 characters' },
                ]
          }
          extra={
            isEdit
              ? 'Leave blank to keep the current password. Setting a new one signs this user out everywhere.'
              : 'At least 8 characters.'
          }
        >
          <Input.Password placeholder={isEdit ? 'Unchanged' : 'Password'} autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          rules={[{ required: true, message: 'Please choose a status' }]}
        >
          <Segmented
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Role">
          <Input value="Employee" disabled />
        </Form.Item>

        <Form.Item
          name="modulePermissions"
          label="Module Permissions"
          rules={[
            {
              // `required` alone does not catch an empty array, and an empty
              // array is exactly the case the server rejects - so the check is
              // written out rather than left to the built-in rule.
              validator: (_, value) =>
                Array.isArray(value) && value.length > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Select at least one module')),
            },
          ]}
        >
          <ModulePermissionsChecklist grantable={grantable} />
        </Form.Item>

        {!isEdit && (
          <Alert
            type="info"
            showIcon
            message="You can only grant modules your own account holds"
            description="Anything beyond that is refused by the server, so the list above shows only what you can share."
          />
        )}
      </Form>
    </Drawer>
  );
}
