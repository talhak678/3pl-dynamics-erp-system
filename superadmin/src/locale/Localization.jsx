import { ConfigProvider, theme as antdTheme } from 'antd';
import { useTheme } from '@/context/ThemeContext';

export default function Localization({ children }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#7592ff' : '#465fff',
          colorLink: isDark ? '#7592ff' : '#465fff',
          colorBgBase: isDark ? '#0c111d' : '#ffffff',
          colorBgContainer: isDark ? '#1a2231' : '#ffffff',
          colorBgLayout: isDark ? '#0c111d' : '#f9fafb',
          colorBorder: isDark ? '#1d2939' : '#e4e7ec',
          colorText: isDark ? '#ffffff' : '#101828',
          colorTextSecondary: isDark ? '#98a2b3' : '#667085',
          borderRadius: 8,
          fontFamily: 'Inter, sans-serif',
        },
        components: {
          Layout: {
            bodyBg: isDark ? '#0c111d' : '#f9fafb',
            headerBg: isDark ? '#1a2231' : '#ffffff',
            siderBg: isDark ? '#1a2231' : '#ffffff',
          },
          Menu: {
            darkItemBg: '#1a2231',
            darkItemSelectedBg: '#262e89',
            darkItemSelectedColor: '#7592ff',
            itemSelectedBg: '#ecf3ff',
            itemSelectedColor: '#465fff',
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
