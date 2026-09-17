import { Alert, Button, Checkbox, Divider, Typography } from 'antd';

import { ERP_MODULES, MODULE_GROUPS, modulesInGroup } from '@/utils/erpModules';

const { Text } = Typography;

/**
 * Grouped checkbox grid over the modules a Customer Admin may hand out.
 *
 * The list is filtered to `grantable` - the modules the signed-in owner holds -
 * so a module they do not have is not offered at all. The server refuses such a
 * grant anyway (see teamController/permissions.js), and this is the half that
 * stops the admin from being able to ask: a checkbox that always comes back
 * rejected is worse than no checkbox.
 *
 * The warning is the mirror of the one on the Super Admin panel's checklist but
 * it says the opposite thing, and that is not an inconsistency. Over there an
 * empty selection is accepted and grants everything, so the notice warns about
 * it. Here the server refuses an empty selection outright, so the notice is a
 * validation message rather than a caution.
 */
export default function ModulePermissionsChecklist({
  value = [],
  onChange,
  grantable = [],
  disabled = false,
}) {
  const selected = Array.isArray(value) ? value : [];
  const isEmpty = selected.length === 0;

  const available = ERP_MODULES.filter((module) => grantable.includes(module.key));
  const groups = MODULE_GROUPS.filter((group) =>
    modulesInGroup(group).some((module) => grantable.includes(module.key))
  );

  const toggle = (key, checked) => {
    const next = checked ? [...selected, key] : selected.filter((item) => item !== key);
    onChange?.([...new Set(next)]);
  };

  const toggleGroup = (group, checked) => {
    const keys = modulesInGroup(group)
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
          const modules = modulesInGroup(group).filter((module) =>
            grantable.includes(module.key)
          );
          const keys = modules.map((module) => module.key);
          const allChecked = keys.every((key) => selected.includes(key));
          const someChecked = keys.some((key) => selected.includes(key));

          return (
            <div key={group}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Checkbox
                  checked={allChecked}
                  indeterminate={!allChecked && someChecked}
                  disabled={disabled}
                  onChange={(event) => toggleGroup(group, event.target.checked)}
                >
                  <Text strong>{group}</Text>
                </Checkbox>
                <Divider style={{ margin: 0, flex: 1, minWidth: 0 }} />
                <Button
                  type="link"
                  size="small"
                  disabled={disabled}
                  onClick={() => toggleGroup(group, !allChecked)}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
