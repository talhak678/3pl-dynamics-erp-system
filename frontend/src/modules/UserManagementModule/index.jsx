import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { Button, Col, Empty, Modal, Row, Skeleton, Typography } from 'antd';
import { PlusOutlined, TeamOutlined } from '@ant-design/icons';

import { request } from '@/request';
import useLanguage from '@/locale/useLanguage';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { grantableFor } from '@/utils/erpModules';

import MemberCard from './components/MemberCard';
import MemberFormDrawer from './components/MemberFormDrawer';

const { Title, Text } = Typography;

/**
 * A Customer Admin's employees.
 *
 * The whole page is gated twice over: the sidebar entry only renders for an
 * owner, the route only resolves for an owner, and every endpoint behind it
 * refuses anyone else. This component can therefore assume the viewer owns the
 * workspace - but it does not assume it for anything that matters, because the
 * server re-derives all of it from the token rather than from anything sent
 * from here.
 */
export default function UserManagementModule() {
  const translate = useLanguage();
  const currentAdmin = useSelector(selectCurrentAdmin);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // The modules this owner may hand out. Computed from the signed-in account
  // rather than fetched, because the login payload already carries the resolved
  // list - and the server re-checks it on write regardless.
  const grantable = useMemo(() => grantableFor(currentAdmin), [currentAdmin]);

  const loadMembers = useCallback(async () => {
    setLoading(true);

    try {
      const data = await request.team.list();

      // The request layer returns its own failure shape rather than throwing,
      // so the array is checked rather than assumed.
      setMembers(Array.isArray(data?.result) ? data.result : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const openCreate = () => {
    setSelected(null);
    setDrawerOpen(true);
  };

  const openEdit = (member) => {
    setSelected(member);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (submitting) return;
    setDrawerOpen(false);
    setSelected(null);
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);

    try {
      const data = selected
        ? await request.team.update({ id: selected._id, jsonData: payload })
        : await request.team.create({ jsonData: payload });

      // A refused module grant is the interesting failure here, and the server
      // explains which module was refused. The request layer has already shown
      // a generic notice by this point, so this only closes the drawer when the
      // save genuinely succeeded.
      if (data?.success) {
        setDrawerOpen(false);
        setSelected(null);
        await loadMembers();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!selected) return;

    const name = [selected.name, selected.surname].filter(Boolean).join(' ');

    Modal.confirm({
      title: translate('Remove this user?'),
      content: `${name} will lose access immediately. Records they created stay in your workspace.`,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        const data = await request.team.remove({ id: selected._id });

        if (data?.success) {
          setDrawerOpen(false);
          setSelected(null);
          await loadMembers();
        }
      },
    });
  };

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginInlineEnd: 10 }} />
            {translate('User Management')}
          </Title>
          <Text type="secondary">
            {translate('Create and manage the users in your workspace')}
          </Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {translate('Create User')}
          </Button>
        </Col>
      </Row>

      {loading ? (
        <Row gutter={[24, 24]}>
          {[0, 1, 2].map((key) => (
            <Col key={key} xs={24} sm={12} lg={8} xxl={6}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Col>
          ))}
        </Row>
      ) : members.length === 0 ? (
        <div className="whiteBox shadow" style={{ padding: 48 }}>
          <Empty
            description={
              <span>
                {translate('No users yet')}
                <br />
                <Text type="secondary">
                  {translate('Create your first user to give a colleague access')}
                </Text>
              </span>
            }
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {translate('Create User')}
            </Button>
          </Empty>
        </div>
      ) : (
        <Row gutter={[24, 24]}>
          {members.map((member) => (
            <Col key={member._id} xs={24} sm={12} lg={8} xxl={6}>
              <MemberCard member={member} onOpen={openEdit} />
            </Col>
          ))}
        </Row>
      )}

      <MemberFormDrawer
        open={drawerOpen}
        member={selected}
        grantable={grantable}
        submitting={submitting}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </>
  );
}
