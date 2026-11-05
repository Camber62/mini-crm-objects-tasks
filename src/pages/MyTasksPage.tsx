import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Table, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { TaskWithRelations } from '../lib/types'
import { StatusTag } from '../components/StatusTag'

export function MyTasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    setLoading(true)
    void supabase
      .from('tasks')
      .select('*, object:objects(*)')
      .eq('assignee_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          message.error(error.message)
        } else {
          setTasks((data ?? []) as TaskWithRelations[])
        }
        setLoading(false)
      })
  }, [profile])

  const columns: ColumnsType<TaskWithRelations> = [
    {
      title: 'Задача',
      dataIndex: 'title',
      render: (title: string, row) => <Link to={`/tasks/${row.id}`}>{title}</Link>,
    },
    {
      title: 'Объект',
      render: (_: unknown, row) =>
        row.object ? <Link to={`/objects/${row.object.id}`}>{row.object.name}</Link> : '—',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 160,
      render: (status: TaskWithRelations['status']) => <StatusTag status={status} />,
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('ru-RU'),
    },
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Мои задачи
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Здесь только задачи, назначенные вам.
          </Typography.Paragraph>
        </div>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={tasks}
        pagination={false}
        locale={{ emptyText: 'Нет назначенных задач' }}
      />
    </>
  )
}
