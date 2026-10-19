import { Alert, Button, Checkbox, Divider, Tag, Typography } from 'antd';

import {
  ERP_MODULES,
  MODULE_GROUPS_IN_ORDER,
  modulesInGroup,
  placeholdersInGroup,
} from '@/utils/erpModules';

const { Text } = Typography;

/** Every key the grid can render - i.e. every key the server still accepts. */
const KNOWN_KEYS = new Set(ERP_MODULES.map((module) => module.key));

/**
 * Parent/child checkbox grid over the ten ERP modules.
 *
 * Each parent header carries a tri-state checkbox: ticked when every child the
 * signed-in admin may grant is ticked, indeterminate when only some are, and a
 * Select all / Clear shortcut beside it. Children can still be toggled one at a
 * time - the parent box is a convenience, not a lock.
 *
 * The list is filtered to `grantable` - the modules the signed-in owner holds -
 * so a module they do not have is not offered at all. The server refuses such a
 * grant anyway (see teamController/permissions.js), and this is the half that
 * stops the admin from being able to ask: a checkbox that always comes back
 * rejected is worse than no checkbox.
 *
 * A group's placeholders are always rendered, disabled and tagged "Soon". They
 * are entries from the shared module registry with no implementation behind
 * them; they appear so the hierarchy on this screen matches the sidebar, but
 * they cannot be ticked because granting one would grant nothing.
 *
 * The warning is the mirror of the one on the Super Admin panel's checklist but
 * it says the opposite thing, and that is not an inconsistency. Over there an
 * empty selection is accepted and grants everything, so the notice warns about
 * it. Here the server refuses an empty selection outright, so the notice is a
 * validation message rather than a caution.
 *
 * The incoming value is filtered to keys the grid can render and this account
 * may grant. A retired key rides along invisibly otherwise: no checkbox shows
 * it, so it cannot be unticked, and the server now rejects the whole save for
 * it. 'report' is the retired one, and it is the reason this filter exists.
 */
export default function ModulePermissionsChecklist({
  value = [],
  onChange,
  grantable = [],
  disabled = false,
}) {
  const selected = (Array.isArray(value) ? value : []).filter(
    (key) => KNOWN_KEYS.has(key) && grantable.includes(key)
  );
  const isEmpty = selected.length === 0;

  const available = ERP_MODULES.filter((module) => grantable.includes(module.key));

  // Groups with nothing this account may grant are omitted entirely; the
  // placeholders inside a group that IS shown still render, disabled.
  const groups = MODULE_GROUPS_IN_ORDER.filter((group) =>
    modulesInGroup(group.key).some((module) => grantable.includes(module.key))
  );

  const toggle = (key, checked) => {
    const next = checked ? [...selected, key] : selected.filter((item) => item !== key);
    onChange?.([...new Set(next)]);
  };

  const toggleGroup = (groupKey, checked) => {
    const keys = modulesInGroup(groupKey)
      .map((module) => module.key)
      .filter((key) => grantable.includes(key));

    const next = checked
      ? [...selected, ...keys]
      : selected.filter((item) => !keys.includes(item));

    onChange?.([...new Set(next)]);
  };

  if (available.length === 0) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Your account has no modules to share"
        description="You can only grant modules you hold yourself, and your own account currently holds none."
      />
    );
  }

  return (
    <div>
      {isEmpty ? (
        <Alert
          type="warning"
          showIcon
          message="Select at least one module"
          description="A user with no modules cannot be saved. An empty permission list is read by the server as full access, so it cannot be used to lock an account down."
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          message={`${selected.length} of ${available.length} modules you can grant are selected`}
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {groups.map((group) => {
          const modules = modulesInGroup(group.key).filter((module) =>
            grantable.includes(module.key)
          );
          const placeholders = placeholdersInGroup(group.key);

          const keys = modules.map((module) => module.key);
          const allChecked = keys.length > 0 && keys.every((key) => selected.includes(key));
          const someChecked = keys.some((key) => selected.includes(key));

          return (
            <div key={group.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Checkbox
                  checked={allChecked}
                  indeterminate={!allChecked && someChecked}
                  disabled={disabled || keys.length === 0}
                  onChange={(event) => toggleGroup(group.key, event.target.checked)}
                >
                  <Text strong>{group.label}</Text>
                </Checkbox>
                <Divider style={{ margin: 0, flex: 1, minWidth: 0 }} />
                <Button
                  type="link"
                  size="small"
                  disabled={disabled || keys.length === 0}
                  onClick={() => toggleGroup(group.key, !allChecked)}
                >
                  {allChecked ? 'Clear' : 'Select all'}
                </Button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: 10,
                  paddingInlineStart: 24,
                }}
              >
                {modules.map((module) => (
                  <Checkbox
                    key={module.key}
                    checked={selected.includes(module.key)}
                    disabled={disabled}
                    onChange={(event) => toggle(module.key, event.target.checked)}
                  >
                    {module.label}
                  </Checkbox>
                ))}

                {placeholders.map((entry) => (
                  <Checkbox key={entry.key} disabled>
                    <Text type="secondary">{entry.label}</Text>{' '}
                    <Tag style={{ marginInlineEnd: 0, fontSize: 10 }}>Soon</Tag>
                  </Checkbox>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
