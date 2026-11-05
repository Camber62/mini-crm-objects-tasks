import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Card, Form, Input, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'

type LoginValues = {
  email: string
  password: string
}

export function LoginPage() {
  const { session, loading, signIn } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/objects" replace />
  }

  async function onFinish(values: LoginValues) {
    setSubmitting(true)
    try {
      await signIn(values.email.trim(), values.password)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Не удалось войти')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <Card className="login-card">
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Объекты и задачи
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Мини-CRM для руководителя и исполнителей на стройке. Регистрация закрыта —
          войдите с выданным аккаунтом.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={(values) => void onFinish(values)} autoComplete="on">
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Некорректный email' },
            ]}
          >
            <Input size="large" placeholder="you@company.ru" />
          </Form.Item>
          <Form.Item
            label="Пароль"
            name="password"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Войти
          </Button>
        </Form>
      </Card>
    </div>
  )
}
