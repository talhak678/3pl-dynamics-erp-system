import { Avatar, Form, Select, Space, Tag, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';

import useLanguage from '@/locale/useLanguage';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import useAssigneeDirectory, { canReadTeamDirectory } from '@/hooks/useAssigneeDirectory';
import { avatarSrc, initialsOf } from '@/utils/avatar';

const { Text } = Typography;

/**
 * The "Assign To" control, for the forms of entities that carry an `assignedTo`.
 *
 * Renders nothing at all for an account that cannot use it, and that is the
 * deliberate design rather than a hidden field. Who may assign is a server rule
 * (see leadController/assignment.js): a Sales Executive's leads are theirs
 * automatically, so there is no choice for the form to offer them. An unmounted
 * field is never submitted, so the server's rule is the only thing deciding the
 * outcome and the UI has no opinion of its own to get wrong.
 *
 * The gate is `canReadTeamDirectory`, which is wider than "not a Sales
 * Executive" and needs to be. The options come from /api/team, which only an
 * owner may read, so an employee granted the `lead` module but not the owner
 * role would be shown a dropdown that could never fill itself, offering a
 * choice the server would then override.
 *
 * The counterpart: a hidden field cannot clear an assignment either. That is
 * correct for the accounts it hides from - an owner is the only one who was
 * ever meant to move a lead between people.
 */
export default function AssigneeSelect({ field = {} }) {
  const translate = useLanguage();
  const currentAdmin = useSelector(selectCurrentAdmin);
  const form = Form.useFormInstance();

  const name = field.name ?? 'assignedTo';
  const canAssign = canReadTeamDirectory(currentAdmin);

  const { directory } = useAssigneeDirectory({ enabled: canAssign, currentAdmin });

  // Read rather than passed down. The field lives inside a Form.Item, so its
  // value is in the form store, and this is what lets a current assignee still
  // be shown after they have been removed from the workspace.
  const selected = Form.useWatch(name, form);

  if (!canAssign) return null;

  const selectedId = selected ? String(selected) : '';

  // A deactivated account is kept as an option when it is the current value.
  // Dropping it would leave the field holding an id with no option to render
  // it, which Ant Design shows as the raw ObjectId - an id where a name belongs,
  // on the one form where the admin is choosing who should own the lead.
  const options = (directory ?? [])
    .filter((person) => person.isActive || person.id === selectedId)
    .map((person) => ({
      value: person.id,
      // What the search box filters on. Ant Design compares the input against
      // the option property named by optionFilterProp, so this has to be a
      // plain string - the rendered label below is not searchable.
      searchText: [person.name, person.role].filter(Boolean).join(' '),
      label: (
        <Space size={8}>
          <Avatar size={22} src={avatarSrc(person)} icon={<UserOutlined />}>
            {initialsOf(person.name)}
          </Avatar>
          <span>{person.name}</span>
          {person.role && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {person.role}
            </Text>
          )}
          {!person.isActive && (
            <Tag bordered={false} color="default" style={{ marginInlineStart: 0 }}>
              Inactive
            </Tag>
          )}
        </Space>
      ),
    }));

  // A lead assigned to an account that has since been deleted - rather than
  // merely deactivated - has no directory entry left to name it. Saying so beats
  // the bare id the Select would otherwise render.
  if (selectedId && !options.some((option) => option.value === selectedId)) {
    options.unshift({
      value: selectedId,
      searchText: 'removed user',
      label: (
        <Space size={8}>
          <Avatar size={22} icon={<UserOutlined />} />
          <Text type="secondary">Removed user</Text>
        </Space>
      ),
    });
  }

  return (
    <Form.Item
      label={translate(field.label ?? 'Assign To')}
      name={name}
      extra="Only accounts in your own workspace can be assigned. Leave empty to keep the lead unassigned."
      // The clear button on a single Select reports `undefined`, and a key
      // holding undefined is dropped by JSON.stringify - so clearing the field
      // would submit no `assignedTo` at all, and an update would leave the
      // previous assignee in place while the form showed the lead as unassigned.
      // Normalising to null makes the clear an explicit, sendable value.
      normalize={(value) => (value === undefined ? null : value)}
    >
      <Select
        allowClear
        showSearch
        optionFilterProp="searchText"
        placeholder="Unassigned"
        options={options}
        notFoundContent="Your workspace has no employees yet"
      />
    </Form.Item>
  );
}
