import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, Layout } from 'antd';

// import Notifications from '@/components/Notification';

import { LogoutOutlined, ToolOutlined, UserOutlined } from '@ant-design/icons';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { hasModule } from '@/utils/modulePermissions';

import { FILE_BASE_URL } from '@/config/serverApiConfig';

import useLanguage from '@/locale/useLanguage';

import ThemeToggleButton from './ThemeToggleButton';
import UpgradeButton from './UpgradeButton';

export default function HeaderContent() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const { Header } = Layout;

  const translate = useLanguage();

  const ProfileDropdown = () => {
    const navigate = useNavigate();
    return (
      <div className="profileDropdown" onClick={() => navigate('/profile')}>
        <Avatar
          size="large"
          className="last"
          src={currentAdmin?.photo ? (currentAdmin.photo.startsWith('data:') || currentAdmin.photo.startsWith('http') ? currentAdmin.photo : FILE_BASE_URL + currentAdmin.photo) : undefined}
          style={{
            color: 'var(--color-orange-500)',
            backgroundColor: currentAdmin?.photo ? 'transparent' : 'var(--color-orange-100)',
            boxShadow: 'var(--app-shadow)',
          }}
        >
          {currentAdmin?.name?.charAt(0)?.toUpperCase()}
        </Avatar>
        <div className="profileDropdownInfo">
          <p>
            {currentAdmin?.name} {currentAdmin?.surname}
          </p>
          <p>{currentAdmin?.email}</p>
        </div>
      </div>
    );
  };

  const DropdownMenu = ({ text }) => {
    return <span style={{}}>{text}</span>;
  };

  /**
   * Whether this account may open App Settings.
   *
   * Asked of the module allow-list rather than of the role, and that is the
   * point: /settings is guarded by guarded('generalSettings', <Settings />) in
   * routes.jsx, which renders Access Denied through the same hasModule() call.
   * A role check here would agree with that route for the accounts that happen
   * to be employees and disagree for every other case - an owner who granted
   * generalSettings to a colleague would hand them a page whose menu entry they
   * could not see, and the two screens would be describing different rules.
   * Reading the one predicate both of them already use is what keeps the menu
   * entry and the route from drifting apart.
   *
   * The sidebar used to carry a second link to the same page. It no longer does:
   * Settings lives here and only here, so this is the only way to reach it.
   */
  const canOpenSettings = hasModule(currentAdmin, 'generalSettings');

  const items = [
    {
      label: <ProfileDropdown className="headerDropDownMenu" />,
      key: 'ProfileDropdown',
    },
    {
      type: 'divider',
    },
    {
      icon: <UserOutlined />,
      key: 'settingProfile',
      label: (
        <Link to={'/profile'}>
          <DropdownMenu text={translate('profile_settings')} />
        </Link>
      ),
    },
    // Built only when the account holds the module. Appended rather than
    // filtered out afterwards so that a child user without the grant has no such
    // item in the tree at all - a hidden menu entry is one devtools inspection
    // away from being a clickable one. Removing it leaves one divider between
    // Profile Settings and Logout rather than two, so the menu still reads
    // cleanly.
    ...(canOpenSettings
      ? [
          {
            icon: <ToolOutlined />,
            key: 'settingApp',
            label: <Link to={'/settings'}>{translate('settings')}</Link>,
          },
        ]
      : []),

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
        stye={{ width: '280px', float: 'right' }}
      >
        {/* <Badge dot> */}
        <Avatar
          className="last"
          src={currentAdmin?.photo ? (currentAdmin.photo.startsWith('data:') || currentAdmin.photo.startsWith('http') ? currentAdmin.photo : FILE_BASE_URL + currentAdmin.photo) : undefined}
          style={{
            color: 'var(--color-orange-500)',
            backgroundColor: currentAdmin?.photo ? 'transparent' : 'var(--color-orange-100)',
            boxShadow: 'var(--app-shadow)',
            float: 'right',
            cursor: 'pointer',
          }}
          size="large"
        >
          {currentAdmin?.name?.charAt(0)?.toUpperCase()}
        </Avatar>
        {/* </Badge> */}
      </Dropdown>

      {/* <AppsButton /> */}

      <ThemeToggleButton />
      {/* <UpgradeButton /> */}
    </Header>
  );
}
