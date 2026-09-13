import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useTheme } from '@/context/ThemeContext';

export default function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <Tooltip title={`Switch to ${nextTheme} mode`}>
      <Button
        aria-label={`Switch to ${nextTheme} mode`}
        className="theme-toggle"
        icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
        onClick={toggleTheme}
        shape="circle"
        size="large"
        type="default"
      />
    </Tooltip>
  );
}
