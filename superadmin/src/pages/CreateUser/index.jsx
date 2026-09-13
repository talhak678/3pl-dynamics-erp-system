import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Card, Form, Space, Typography, notification } from 'antd';

import { ArrowLeftOutlined, UserAddOutlined } from '@ant-design/icons';

import CreateUserForm from '@/forms/CreateUserForm';
import { createUser } from '@/superadmin/superAdmin.service';

const { Title, Text } = Typography;

export default function CreateUser() {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [permissions, setPermissions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values) => {
    setSubmitting(true);

    const data = await createUser({
      jsonData: {
        name: values.name,
        email: values.email,
        password: values.password,
        modulePermissions: permissions,
      },
    });

    setSubmitting(false);

    if (data?.success === true) {
      notification.success({
        message: 'Account created',
        description: `${values.email} can now sign in to the ERP.`,
        duration: 4,
      });
      form.resetFields();
      setPermissions([]);
      navigate('/');
      return;
    }

    // Failure needs no handling here: errorHandler has already raised a
    // notification carrying the backend's message, e.g. the 409
    // "An account with this email already exists".
  };

  return (
    <Space direction="vertical" size={22} style={{ width: '100%' }}>
      <div>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ paddingInline: 0 }}>
          Back to users
        </Button>
        <Title level={2} style={{ margin: '8px 0 0' }}>
          Create user
        </Title>
        <Text type="secondary">
          Provision a tenant account. They get their own private settings and see only the modules
          you grant below.
        </Text>
      </div>

      <Card
        style={{
          maxWidth: 780,
          borderRadius: 12,
          borderColor: 'var(--app-border)',
          background: 'var(--app-surface)',
        }}
      >
        <Form
          form={form}
          layout="vertical"
          name="create_user"
          onFinish={onFinish}
          initialValues={{ modulePermissions: [] }}
        >
          <CreateUserForm
            permissions={permissions}
            onPermissionsChange={setPermissions}
            disabled={submitting}
          />

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<UserAddOutlined />}
                loading={submitting}
                size="large"
              >
                Create account
              </Button>
              <Button size="large" onClick={() => navigate('/')} disabled={submitting}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
}
