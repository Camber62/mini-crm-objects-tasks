import { Card, Typography } from 'antd'

export function SetupPage() {
  return (
    <div className="login-screen">
      <Card className="login-card">
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Нужна конфигурация Supabase
        </Typography.Title>
        <Typography.Paragraph>
          Скопируйте <Typography.Text code>.env.example</Typography.Text> в{' '}
          <Typography.Text code>.env</Typography.Text> и укажите URL проекта и anon-ключ.
          Service role в фронтенд не кладём.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          Подробные шаги — в README.md
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
