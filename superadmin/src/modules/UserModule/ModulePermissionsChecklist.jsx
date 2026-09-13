import { Alert, Button, Checkbox, Divider, Typography } from 'antd';

import { ERP_MODULES, MODULE_GROUPS, modulesInGroup } from '@/utils/moduleList';

const { Text } = Typography;

/**
 * Grouped checkbox grid over the 18 ERP modules.
 *
 * The warning banner is not decoration. The backend resolves an empty array to
 * "every module", so a super admin who clears all 18 boxes and saves has granted
 * FULL access, not none. The UI has to say so or the control silently does the
 * opposite of what it looks like it does.
 */
export default function ModulePermissionsChecklist({ value = [], onChange, disabled = false }) {
  const selected = Array.isArray(value) ? value : [];
  const isEmpty = selected.length === 0;

  const toggle = (key, checked) => {
    const next = checked ? [...selected, key] : selected.filter((item) => item !== key);
    onChange?.([...new Set(next)]);
  };

  const toggleGroup = (group, checked) => {
    const keys = modulesInGroup(group).map((module) => module.key);
    const next = checked
      ? [...selected, ...keys]
      : selected.filter((item) => !keys.includes(item));
    onChange?.([...new Set(next)]);
  };

  return (
    <div>
      {isEmpty ? (
        <Alert
          type="warning"
          showIcon
          message="An empty selection grants every module"
          description="The API treats an empty permission list as full access. To actually restrict this account, leave at least one module ticked."
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          message={`${selected.length} of ${ERP_MODULES.length} modules granted`}
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {MODULE_GROUPS.map((group) => {
          const modules = modulesInGroup(group);
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
