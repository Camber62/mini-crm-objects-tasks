import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Avatar, Button, Layout, Menu, Space, Tag, Typography } from 'antd'
import {
  LogoutOutlined,
  ProjectOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { ROLE_LABELS } from '../lib/status'

const { Header, Content, Sider } = Layout

export function AppLayout() {
  const { profile, profileError, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const selected = location.pathname.startsWith('/my-tasks') ? '/my-tasks' : '/objects'

  return (
    <Layout className="app-shell">
      <Sider breakpoint="lg" collapsedWidth={0} theme="dark" width={232}>
        <div className="brand">
          <span className="brand-mark">CRM</span>
          <span>Объекты и задачи</span>
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selected]}
          onClick={({ key }) => navigate(key)}
          items={[
            {
              key: '/objects',
              icon: <ProjectOutlined />,
              label: 'Объекты',
            },
            ...(profile?.role === 'executor'
              ? [
                  {
                    key: '/my-tasks',
                    icon: <UnorderedListOutlined />,
                    label: 'Мои задачи',
                  },
                ]
              : []),
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Text type="secondary">Строительная компания</Typography.Text>
          <Space size="middle">
            {profile && (
              <>
                <Space size={8}>
                  <Avatar size="small">{profile.full_name.slice(0, 1)}</Avatar>
                  <span>{profile.full_name}</span>
                  <Tag>{ROLE_LABELS[profile.role]}</Tag>
                </Space>
                <Button icon={<LogoutOutlined />} onClick={() => void signOut()}>
                  Выйти
                </Button>
              </>
            )}
          </Space>
        </Header>
        <Content className="app-content">
          {profileError && (
            <Alert
              type="error"
              showIcon
              message="Нет доступа"
              description={
                <>
                  {profileError}{' '}
                  <Link to="/login">Вернуться ко входу</Link>
                </>
              }
              style={{ marginBottom: 16 }}
            />
          )}
          {profile && <Outlet />}
        </Content>
      </Layout>
    </Layout>
  )
}
