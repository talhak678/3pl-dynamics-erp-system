import { useEffect, useMemo } from 'react';
import { Alert, Button, Drawer, Form, Input, Segmented, Select, Space } from 'antd';

import { ASSIGNABLE_ROLE_OPTIONS, presetFor, roleLabel } from '@/utils/rolePresets';

import ModulePermissionsChecklist from './ModulePermissionsChecklist';

/**
 * The one entry in the Role dropdown that cannot be chosen.
 *
 * A preview of a role this build does not sell yet. It is kept out of
 * ASSIGNABLE_ROLE_OPTIONS deliberately, because that array is the set the server
 * accepts and therefore the set this form is allowed to submit: an option that
 * lived there could be selected and sent, and `validateRequestedRole` would
 * answer "Unknown role". Held here instead, the list the API is asked about and
 * the list the admin is shown differ by exactly one entry, and that entry is
 * inert.
 *
 * `disabled` is what refuses the pick. The inline `cursor: not-allowed` is what
 * says so before the click - antd greys a disabled row but leaves the pointer
 * unchanged, so without it the option reads as merely dimmed rather than closed.
 * `title` becomes a native tooltip, which is the only kind a disabled option can
 * carry: it is not focusable, so nothing that needs focus to appear would ever
 * be seen. A string title would otherwise be set from the label anyway (see
 * rc-select's OptionList), so this is the one place it has to be stated.
 *
 * Frozen because it is shared into a memoised array that antd may re-render
 * across many opens, and a mutation there would be very hard to trace back here.
 */
const VIEWER_ROLE_OPTION = Object.freeze({
  label: 'Read Only / Viewer',
  value: 'Read Only / Viewer',
  disabled: true,
  title: 'only for premium users',
  style: { cursor: 'not-allowed' },
});

/**
 * Create and edit an employee, in a drawer.
 *
 * One component for both, because the field set is identical and the only real
 * differences are the title and whether a password is required - splitting it
 * would mean keeping two copies of the validation in step.
 *
 * Role is a constrained dropdown rather than a free choice, and which titles it
 * may offer is decided in utils/rolePresets.js rather than here - the options and
 * the module preset each one ticks are read together, and would drift apart if
 * they were kept in separate files.
 *
 * The server accepts anything except 'owner' and 'superadmin', the two values
 * the rest of the system authorises on: assigning either would escalate rather
 * than label. It also still accepts the retired titles, so that an existing
 * member carrying one can be saved - see the option merge below, which is what
 * keeps such a member from appearing to have lost their job title.
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
    // A member whose role is a retired one - 'Manager', 'Digital Marketer',
    // 'admin', or the pre-rename 'employee' / 'Customer Support' - still has to
    // appear as a real option. Without this the Select would fall back to
    // rendering the bare value string, and the field would look like it had lost
    // its selection even though saving it unchanged is perfectly valid.
    // Appending rather than offering them to everyone is what keeps a retired
    // title from being handed to anyone new.
    const current = member?.role;

    const options = [...ASSIGNABLE_ROLE_OPTIONS];

    if (current && !ASSIGNABLE_ROLE_OPTIONS.some((option) => option.value === current)) {
      // Labelled through roleLabel so a lowercase stored title reads the same
      // here as it does on the member card. The value stays exactly as stored -
      // it is what gets submitted, and the schema enum still accepts it.
      options.push({ label: roleLabel(current), value: current });
    }

    // Last, always - including after a retired title appended above, so the
    // teaser holds the bottom of the list whichever shape the list takes. A new
    // array rather than a push onto ASSIGNABLE_ROLE_OPTIONS, which is a shared
    // module constant and would otherwise grow by one every time this ran.
    options.push(VIEWER_ROLE_OPTION);

    return options;
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
      // 'Sales Manager' rather than leaving it blank, to match the server's
      // default for an omitted role. A blank select would be a required field
      // the user has to visit before they can save.
      form.setFieldsValue({ status: 'active', role: 'Sales Manager', modulePermissions: [] });
    }
  }, [open, member, isEdit, form]);

  /**
   * Prefills the module list from the role that was just picked.
   *
   * The role itself grants nothing - module access is decided entirely by
   * `modulePermissions`. But the two are chosen together in practice: an
   * accountant who cannot open the invoices module has nothing to account for,
   * and the admin filling this form has no reason to know that off-hand. So the
   * title ticks the modules that go with it, and the checkboxes below stay fully
   * editable.
   *
   * Replaces the selection rather than adding to it. A union would be
   * fail-open in exactly the case that matters: an admin who has ticked
   * everything and then picks a role would keep everything, and the prefill
   * would have silently granted that user the whole ERP.
   *
   * Filtered against `grantable` because the server refuses a grant the owner
   * does not hold themselves - offering one and then rejecting the save would
   * be worse than not offering it. If that filter leaves nothing, the selection
   * is left alone rather than emptied: an empty list is refused on save and
   * means "every module" to the server, so clearing it would be the one outcome
   * worse than doing nothing.
   *
   * `presetFor` returns null for a title with no preset, which is now only a
   * retired title that reached the dropdown by the merge in roleOptions - every
   * assignable title has one. Those, and the disabled preview entry, return
   * without touching the checkboxes, which is the right answer for each.
   *
   * Only runs on a change the user made. Opening an existing member for editing
   * does not fire this, so a permission list that was deliberately customised is
   * never quietly reset.
   */
  const handleRoleChange = (role) => {
    const preset = presetFor(role);

    if (!preset) return;

    const next = preset.filter((key) => grantable.includes(key));

    if (next.length === 0) return;

    form.setFieldsValue({ modulePermissions: next });
  };

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
          extra="A job title within your workspace. Picking one ticks the modules that role works with - the checkboxes below stay yours to change. Sales Executive is the one title that also changes what the account can see: it fills in who owns the leads they enter."
        >
          <Select options={roleOptions} placeholder="Select a role" onChange={handleRoleChange} />
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
