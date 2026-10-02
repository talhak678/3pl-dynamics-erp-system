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

import DateRangeFilter from '@/modules/DashboardModule/components/DateRangeFilter';
import useDateRange from '@/modules/DashboardModule/useDateRange';

export default function HeaderContent() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const { Header } = Layout;

  const translate = useLanguage();

  /*
   * The window every module's table is read over, here rather than on the
   * dashboard because it now governs more than the dashboard.
   */
  const { preset, custom, description, apply, reset } = useDateRange();

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
   * The Settings submenu, and the rule that builds it.
   *
   * Each entry is asked for by its own module key through hasModule(), which is
   * the same predicate the sidebar filter and the route guard read - so the menu
   * entry and the page it opens can never disagree about who may open it. A
   * child user without `generalSettings`, `taxes` or `help` gets no entry for it
   * at all: the item is never built, rather than built and hidden, because a
   * hidden menu entry is one devtools inspection away from being a clickable
   * one.
   *
   * The keys are the route paths minus their leading slash, which is what the
   * sidebar used for the same three entries before they moved here. Nothing
   * about the permissions changed in the move - only which surface offers them.
   */
  const settingsItems = [
    {
      key: 'generalSettings',
      label: <Link to={'/settings'}>{translate('general_settings')}</Link>,
    },
    {
      key: 'taxes',
      label: <Link to={'/taxes'}>{translate('taxes')}</Link>,
    },
    {
      key: 'help',
      label: <Link to={'/help'}>{translate('Help')}</Link>,
    },
  ].filter((item) => hasModule(currentAdmin, item.key));

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
    // The whole group disappears when none of its three children are held, so
    // an account with no settings access at all sees no Settings entry rather
    // than an empty submenu it can open and find nothing in. Removed rather than
    // rendered empty, and the menu is left with one divider between Profile
    // Settings and Logout rather than two.
    ...(settingsItems.length > 0
      ? [
          {
            icon: <ToolOutlined />,
            key: 'settingsMenu',
            label: translate('settings'),
            children: settingsItems,
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

      {/*
        Rendered last in the JSX, which the Header's `flexDirection: row-reverse`
        turns into leftmost on screen - so it sits away from the avatar and the
        theme toggle, which are account controls, and reads as a page control
        rather than a third one of those.
      */}
      <DateRangeFilter
        preset={preset}
        custom={custom}
        description={description}
        onApply={apply}
        onReset={reset}
      />
    </Header>
  );
}
