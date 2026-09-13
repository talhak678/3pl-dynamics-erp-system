import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Avatar, Dropdown, Layout, Tag } from 'antd';

import { LogoutOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

import { selectCurrentAdmin } from '@/redux/auth/selectors';

import useLanguage from '@/locale/useLanguage';

import ThemeToggleButton from './ThemeToggleButton';

export default function HeaderContainer() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const { Header } = Layout;

  const translate = useLanguage();

  const AccountSummary = () => (
    <div className="profileDropdown">
      <div className="profileDropdownInfo">
        <p>{currentAdmin?.name}</p>
        <p>{currentAdmin?.email}</p>
      </div>
    </div>
  );

  // No profile or app-settings entries: the portal has neither, and offering a
  // link to a route that does not exist is worse than omitting it.
  const items = [
    {
      label: <AccountSummary />,
      key: 'AccountSummary',
    },
    {
      type: 'divider',
    },
    {
      icon: <LogoutOutlined />,
      key: 'logout',
      label: <Link to={'/logout'}>{translate('logout')}</Link>,
    },
  ];

  return (
    <Header
      className="app-header"
      style={{
        padding: '20px',
        background: 'var(--app-surface)',
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'row-reverse',
        justifyContent: 'flex-start',
        gap: '15px',
      }}
    >
      <Dropdown
        menu={{
          items,
        }}
        trigger={['click']}
        placement="bottomRight"
      >
        <Avatar
          className="last"
          style={{
            color: 'var(--color-orange-500)',
            backgroundColor: 'var(--color-orange-100)',
            boxShadow: 'var(--app-shadow)',
            float: 'right',
            cursor: 'pointer',
          }}
          size="large"
        >
          {currentAdmin?.name?.charAt(0)?.toUpperCase()}
        </Avatar>
      </Dropdown>

      <ThemeToggleButton />

      <Tag
        icon={<SafetyCertificateOutlined />}
        color="blue"
        style={{ marginInlineStart: 'auto', marginInlineEnd: 0, fontWeight: 500 }}
      >
        {translate('Super Admin')}
      </Tag>
    </Header>
  );
}
