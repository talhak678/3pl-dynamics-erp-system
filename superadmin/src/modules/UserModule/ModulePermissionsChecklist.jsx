import { Alert, Button, Checkbox, Divider, Tag, Typography } from 'antd';

import {
  ERP_MODULES,
  MODULE_GROUPS_IN_ORDER,
  modulesInGroup,
  placeholdersInGroup,
} from '@/utils/moduleList';

const { Text } = Typography;

/**
 * Parent/child checkbox grid over the ten ERP modules.
 *
 * Each parent header carries a tri-state checkbox - ticked when all of its
 * children are ticked, indeterminate when only some are - and a Select all /
 * Clear shortcut beside it. Individual children stay independently toggleable.
 *
 * The four roadmap parents (Purchase & Suppliers, POS, Operations, Website &
 * E-Commerce) have no implemented child, so their header is a plain checkbox
 * bound to the group's own `grantKey` rather than a tri-state aggregate. Ticking
 * it stores that key, which is what makes the sidebar draw the group for this
 * tenant; unticking it hides the group. It is deliberately not disabled for
 * having no children. The "Soon" entries inside stay disabled.
 *
 * The warning banner is not decoration. The backend resolves an empty array to
 * "every module", so a super admin who clears every box and saves has granted
 * FULL access, not none. The UI has to say so or the control silently does the
 * opposite of what it looks like it does. An empty list still leaves the
 * roadmap groups hidden - they are read from the stored list only.
 *
 * Placeholders render disabled and tagged "Soon". They are entries from the
 * shared registry with no implementation behind them; they appear so this
 * hierarchy matches the sidebar, but they cannot be ticked because granting one
 * would grant nothing.
 */
export default function ModulePermissionsChecklist({ value = [], onChange, disabled = false }) {
  const knownKeys = new Set(ERP_MODULES.map((module) => module.key));
  const selected = (Array.isArray(value) ? value : []).filter((key) => knownKeys.has(key));
  const isEmpty = selected.length === 0;

  const toggle = (key, checked) => {
    const next = checked ? [...selected, key] : selected.filter((item) => item !== key);
    onChange?.([...new Set(next)]);
  };

  const toggleGroup = (groupKey, checked) => {
    const keys = modulesInGroup(groupKey).map((module) => module.key);
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
        {MODULE_GROUPS_IN_ORDER.map((group) => {
          const modules = modulesInGroup(group.key);
          const placeholders = placeholdersInGroup(group.key);

          const keys = modules.map((module) => module.key);

          // A roadmap parent is a single-key control: its own grantKey is what
          // the sidebar reads, and it has no child to aggregate.
          const grantKey = group.grantKey;
          const roadmap = Boolean(grantKey);
          const roadmapSelected = roadmap && selected.includes(grantKey);

          const allChecked = roadmap
            ? roadmapSelected
            : keys.length > 0 && keys.every((key) => selected.includes(key));
          const someChecked = roadmap ? false : keys.some((key) => selected.includes(key));

          return (
            <div key={group.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Checkbox
                  checked={allChecked}
                  indeterminate={!allChecked && someChecked}
                  disabled={disabled || (!roadmap && keys.length === 0)}
                  onChange={(event) =>
                    roadmap
                      ? toggle(grantKey, event.target.checked)
                      : toggleGroup(group.key, event.target.checked)
                  }
                >
                  <Text strong>{group.label}</Text>
                </Checkbox>
                <Divider style={{ margin: 0, flex: 1, minWidth: 0 }} />
                <Button
                  type="link"
                  size="small"
                  disabled={disabled || (!roadmap && keys.length === 0)}
                  onClick={() =>
                    roadmap
                      ? toggle(grantKey, !roadmapSelected)
                      : toggleGroup(group.key, !allChecked)
                  }
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
