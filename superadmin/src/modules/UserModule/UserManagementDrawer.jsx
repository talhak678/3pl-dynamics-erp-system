import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  Avatar,
  Button,
  Divider,
  Drawer,
  Modal,
  Space,
  Switch,
  Tag,
  Typography,
  notification,
} from 'antd';

import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CrownFilled,
  SaveOutlined,
  StopFilled,
} from '@ant-design/icons';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { updateUserStatus, updateUserPermissions } from '@/superadmin/superAdmin.service';
import { MODULE_KEYS } from '@/utils/moduleList';
import useDate from '@/settings/useDate';

import ModulePermissionsChecklist from './ModulePermissionsChecklist';

const { Text, Title } = Typography;

export default function UserManagementDrawer({ open, user, onClose, onUpdated }) {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const { formatDate } = useDate();
  const [modal, modalContextHolder] = Modal.useModal();

  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // The backend refuses a self status change (409), so the control is disabled
  // rather than allowed to fail.
  const isSelf = Boolean(user && currentAdmin && String(user._id) === String(currentAdmin._id));

  // Re-seed the local copy whenever a different account is opened, so edits made
  // to one card never leak into the next.
  //
  // Filtered against the current key list, which drops keys this product has
  // retired from the stored array - 'report' is the one. Without it the stale key
  // rides along invisibly: no checkbox renders it, so it cannot be unticked, and
  // the backend now rejects the whole save for it. Dropping it here also makes
  // the dirty check below honest, since clearing it IS a change worth saving.
  useEffect(() => {
    if (!user) return;
    setIsActive(user.isActive !== false);
    setPermissions(
      Array.isArray(user.modulePermissions)
        ? user.modulePermissions.filter((key) => MODULE_KEYS.includes(key))
        : []
    );
  }, [user]);

  const permissionsDirty = useMemo(() => {
    if (!user) return false;
    const original = Array.isArray(user.modulePermissions) ? [...user.modulePermissions] : [];
    return JSON.stringify([...original].sort()) !== JSON.stringify([...permissions].sort());
  }, [user, permissions]);

  const applyStatus = async (next) => {
    const previous = isActive;
    setIsActive(next); // optimistic; rolled back below on failure
    setSavingStatus(true);

    const data = await updateUserStatus({ id: user._id, isActive: next });

    setSavingStatus(false);

    if (data?.success === true) {
      notification.success({
        message: next ? 'Account activated' : 'Account suspended',
        description: next
          ? `${user.email} can sign in and use the ERP again.`
          : `${user.email} is blocked at login and on every API request.`,
        duration: 4,
      });
      onUpdated?.({ ...user, isActive: next });
    } else {
      // errorHandler has already surfaced the backend's reason.
      setIsActive(previous);
    }
  };

  const requestStatusChange = (next) => {
    if (next) {
      applyStatus(true);
      return;
    }
    // Suspension is disruptive, so it is confirmed rather than immediate.
    modal.confirm({
      title: `Suspend ${user?.name}?`,
      content:
        'They will be signed out on their next request and blocked from logging in until reactivated.',
      okText: 'Suspend account',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => applyStatus(false),
    });
  };

  const savePermissions = async () => {
    setSavingPermissions(true);
    const data = await updateUserPermissions({ id: user._id, modulePermissions: permissions });
    setSavingPermissions(false);

    if (data?.success === true) {
      onUpdated?.({ ...user, modulePermissions: data.result?.modulePermissions ?? permissions });
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={620}
      destroyOnClose
      title="User management"
      styles={{ body: { background: 'var(--app-bg)' } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      {modalContextHolder}

      {user && (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Avatar
              size={64}
              style={{
                backgroundColor: isActive ? 'var(--color-brand-500)' : 'var(--color-gray-400)',
                color: 'var(--color-white)',
                fontSize: 24,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {user.name?.charAt(0)?.toUpperCase() || '?'}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Title level={4} style={{ margin: 0 }}>
                  {user.name}
                </Title>
                {user.isSuperAdmin && (
                  <Tag icon={<CrownFilled />} color="gold" style={{ marginInlineEnd: 0 }}>
                    Super Admin
                  </Tag>
                )}
              </div>
              <Text type="secondary">{user.email}</Text>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <CalendarOutlined style={{ marginInlineEnd: 6 }} />
                  Created {formatDate(user.created)}
                </Text>
              </div>
            </div>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* Kill switch */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <Text strong>Account access</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Suspending blocks login and every API request immediately.
                  </Text>
                </div>
              </div>
              <Space>
                <Tag
                  icon={isActive ? <CheckCircleFilled /> : <StopFilled />}
                  color={isActive ? 'success' : 'error'}
                  style={{ marginInlineEnd: 0 }}
                >
                  {isActive ? 'Active' : 'Suspended'}
                </Tag>
                <Switch
                  checked={isActive}
                  loading={savingStatus}
                  disabled={isSelf}
                  onChange={requestStatusChange}
                  checkedChildren="On"
                  unCheckedChildren="Off"
                />
              </Space>
            </div>
            {isSelf && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                You cannot change the status of your own account.
              </Text>
            )}
          </div>

          <Divider style={{ margin: 0 }} />

          {/* Permissions */}
          <div>
            <div style={{ marginBottom: 14 }}>
              <Text strong>
                <AppstoreOutlined style={{ marginInlineEnd: 8 }} />
                Module permissions
              </Text>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Choose which ERP modules this account can see.
                </Text>
              </div>
            </div>

            <ModulePermissionsChecklist
              value={permissions}
              onChange={setPermissions}
              disabled={savingPermissions}
            />

            <div style={{ marginTop: 18 }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={savingPermissions}
                disabled={!permissionsDirty}
                onClick={savePermissions}
              >
                {permissionsDirty ? 'Save permissions' : 'Permissions saved'}
              </Button>
            </div>
          </div>
        </Space>
      )}
    </Drawer>
  );
}
