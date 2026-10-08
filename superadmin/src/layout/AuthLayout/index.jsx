import { useEffect, useLayoutEffect, useState } from 'react';

import { useTheme } from '@/context/ThemeContext';

// import ThemeToggleButton from '@/apps/Header/ThemeToggleButton';  // the toggle lives in the header of the signed-in app only

// The two images in public/. Percent-encoded because they are interpolated into
// a CSS url() below, where a literal space would end the token.
const AUTH_BACKGROUNDS = ['/ERP%20BG%201.jpg', '/ERP%20BG%202.jpg'];

// Matches the WMS auth layout: swap every 5s, cross-fade over 1s.
const BACKGROUND_INTERVAL_MS = 5000;

/*
  The auth shell: a full-bleed rotating photograph with the sign-in card centred
  on top of it. Mirrors
  3PL-Dynamics-FontEnd / src/app/(full-width-pages)/(auth)/layout.tsx

  The left-hand marketing column that used to sit beside the form is commented
  out below rather than deleted, along with the `sideContent` prop it rendered.

  To restore the original two-column layout:
    1. uncomment `sideContent` in the signature here,
    2. uncomment the block at the bottom of this file and delete `.auth-stage`,
    3. uncomment the `Layout`/`Row`/`Col` import it needs,
    4. in modules/AuthModule/index.jsx, uncomment the `SideContent` import and the
       `sideContent` prop it passes.

  Restoring it also brings back the theme toggle that sat in its right-hand
  column. The background and the light pin below are not part of that block:
  they are current behaviour, not something to restore away.
*/
export default function AuthLayout({ children }) {
  const [activeBackground, setActiveBackground] = useState(0);
  const { setForcedLight } = useTheme();

  // This screen is light, always. It shows no toggle, and the glass card is
  // built against a light backdrop, so a user who had chosen dark would
  // otherwise be stuck on a theme they cannot change from here.
  //
  // Only the screen is pinned, not the user's setting: the preference stays in
  // localStorage and comes back the moment this unmounts. A layout effect so
  // the class is settled before the first paint rather than a frame after it.
  useLayoutEffect(() => {
    setForcedLight(true);
    return () => setForcedLight(false);
  }, [setForcedLight]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBackground((previous) => (previous + 1) % AUTH_BACKGROUNDS.length);
    }, BACKGROUND_INTERVAL_MS);

    // Without this the timer keeps firing after the sign-in page unmounts, on
    // every route in the app.
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="auth-screen">
      {/* Decorative, so hidden from assistive tech. Both layers are always
          mounted and cross-fade on opacity - see .auth-bg-layer in auth.css. */}
      <div className="auth-backdrop" aria-hidden="true">
        {AUTH_BACKGROUNDS.map((image, index) => (
          <div
            key={image}
            className={`auth-bg-layer ${index === activeBackground ? 'is-active' : ''}`}
            style={{ backgroundImage: `url("${image}")` }}
          />
        ))}
      </div>

      <div className="auth-stage">{children}</div>

      {/*
        ---- ORIGINAL TWO-COLUMN LAYOUT - commented out, not deleted ----

        Restore with the four steps in the comment above this component. The
        `sideContent` prop and the Layout/Row/Col import it needs are commented
        out too, so nothing here is live code.

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
      */}
    </div>
  );
}

// import { Layout, Row, Col } from 'antd'; // only used by the commented-out layout above
