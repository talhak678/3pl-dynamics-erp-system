import { useEffect, useMemo } from 'react';
import { Alert, Button, Drawer, Form, Input, Segmented, Select, Space } from 'antd';

import ModulePermissionsChecklist from './ModulePermissionsChecklist';

/**
 * The roles this form offers.
 *
 * Deliberately shorter than what the API accepts. The server allows any role
 * except 'owner' and 'superadmin', including 'admin'; that one is not offered
 * here because it is not a job title this product uses, and a dropdown is a
 * better place to be opinionated than an API. Nothing is lost by the omission -
 * a member carrying it still renders correctly, see the option merge below.
 *
 * The new titles carry their label as their value, because they are stored
 * verbatim and shown verbatim. 'employee' is the exception: it keeps the
 * lowercase value every account created before this change already carries, and
 * only its label is title-cased. Changing that value would orphan existing
 * members' roles.
 */
const BASE_ROLE_OPTIONS = [
  { label: 'Employee', value: 'employee' },
  { label: 'Sales Executive', value: 'Sales Executive' },
  { label: 'Digital Marketer', value: 'Digital Marketer' },
  { label: 'Manager', value: 'Manager' },
];

/**
 * Create and edit an employee, in a drawer.
 *
 * One component for both, because the field set is identical and the only real
 * differences are the title and whether a password is required - splitting it
 * would mean keeping two copies of the validation in step.
 *
 * Role is a constrained dropdown rather than a free choice. The server accepts
 * any role except 'owner' and 'superadmin' - the two values the rest of the
 * system authorises on, so assigning either would escalate rather than label.
 * Offering them here would be a control that is refused on save.
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

  const roleOptions = useMemo(() => {
    // A member whose role was set through the API to something this dropdown
    // does not offer - 'admin' is the live case - still has to appear as a real
    // option. Without this the Select would fall back to rendering the bare
    // value string, and the field would look like it had lost its selection
    // even though saving it unchanged is perfectly valid.
    const current = member?.role;

    if (!current || BASE_ROLE_OPTIONS.some((option) => option.value === current)) {
      return BASE_ROLE_OPTIONS;
    }

    return [...BASE_ROLE_OPTIONS, { label: current, value: current }];
  }, [member?.role]);

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
        role: member.role,
        modulePermissions: member.modulePermissions ?? [],
      });
    } else {
      form.resetFields();
      // 'employee' rather than leaving it blank, to match the server's default
      // for an omitted role. A blank select would be a required field the user
      // has to visit before they can save.
      form.setFieldsValue({ status: 'active', role: 'employee', modulePermissions: [] });
    }
  }, [open, member, isEdit, form]);

  const handleFinish = (values) => {
    const payload = {
      name: values.name,
      surname: values.surname || undefined,
      email: values.email,
      role: values.role,
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

        <Form.Item
          name="role"
          label="Role"
          rules={[{ required: true, message: 'Please choose a role' }]}
          extra="A job title within your workspace. It does not change which modules this user can open."
        >
          <Select options={roleOptions} placeholder="Select a role" />
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
