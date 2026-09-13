import { Layout, Row, Col } from 'antd';
import ThemeToggleButton from '@/apps/Header/ThemeToggleButton';

export default function AuthLayout({ sideContent, children }) {
  return (
    <Layout>
      <Row>
        <Col
          xs={{ span: 0, order: 2 }}
          sm={{ span: 0, order: 2 }}
          md={{ span: 11, order: 1 }}
          lg={{ span: 12, order: 1 }}
          style={{
            minHeight: '100vh',
          }}
        >
          {sideContent}
        </Col>
        <Col
          xs={{ span: 24, order: 1 }}
          sm={{ span: 24, order: 1 }}
          md={{ span: 13, order: 2 }}
          lg={{ span: 12, order: 2 }}
          style={{ background: 'var(--app-surface)', minHeight: '100vh', position: 'relative' }}
        >
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              zIndex: 1,
            }}
          >
            <ThemeToggleButton />
          </div>
          {children}
        </Col>
      </Row>
    </Layout>
  );
}
