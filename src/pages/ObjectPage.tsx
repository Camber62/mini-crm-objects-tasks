import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import type { ConstructionObject, Profile, TaskWithRelations } from '../lib/types'
import { StatusTag } from '../components/StatusTag'

type TaskForm = {
  title: string
  description: string
  assignee_id: string
}

export function ObjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAssigner = profile?.role === 'assigner'
  const [object, setObject] = useState<ConstructionObject | null>(null)
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [executors, setExecutors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskWithRelations | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<TaskForm>()

  async function load() {
    if (!id) return
    setLoading(true)
    const [{ data: objectData, error: objectError }, { data: taskData, error: taskError }] =
      await Promise.all([
        supabase.from('objects').select('*').eq('id', id).single(),
        supabase
          .from('tasks')
          .select('*, assignee:profiles!tasks_assignee_id_fkey(*), object:objects(*)')
          .eq('object_id', id)
          .order('created_at', { ascending: false }),
      ])

    if (objectError) {
      message.error('Объект не найден или нет доступа')
      setObject(null)
    } else {
      setObject(objectData as ConstructionObject)
    }

    if (taskError) {
      message.error(taskError.message)
    } else {
      setTasks((taskData ?? []) as TaskWithRelations[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [id])

  useEffect(() => {
    if (!isAssigner) return
    void supabase
      .from('profiles')
      .select('*')
      .eq('role', 'executor')
      .then(({ data, error }) => {
        if (error) {
          message.error(error.message)
          return
        }
        setExecutors((data ?? []) as Profile[])
      })
  }, [isAssigner])

  function openCreate() {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(row: TaskWithRelations) {
    setEditing(row)
    form.setFieldsValue({
      title: row.title,
      description: row.description,
      assignee_id: row.assignee_id,
    })
    setModalOpen(true)
  }

  async function save() {
    const values = await form.validateFields()
    if (!profile || !id) return
    setSaving(true)
    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() ?? '',
      assignee_id: values.assignee_id,
    }
    const query = editing
      ? supabase.from('tasks').update(payload).eq('id', editing.id)
      : supabase.from('tasks').insert({
          ...payload,
          object_id: id,
          author_id: profile.id,
          status: 'new',
        })
    const { error } = await query
    setSaving(false)
    if (error) {
      message.error(error.message)
      return
    }
    message.success(editing ? 'Задача обновлена' : 'Задача создана')
    setModalOpen(false)
    await load()
  }

  async function remove(taskId: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) {
      message.error(error.message)
      return
    }
    message.success('Задача удалена')
    await load()
  }

  const columns: ColumnsType<TaskWithRelations> = [
    {
      title: 'Задача',
      dataIndex: 'title',
      render: (title: string, row) => <Link to={`/tasks/${row.id}`}>{title}</Link>,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 150,
      render: (status: TaskWithRelations['status']) => <StatusTag status={status} />,
    },
    {
      title: 'Исполнитель',
      render: (_: unknown, row) => row.assignee?.full_name ?? '—',
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('ru-RU'),
    },
    ...(isAssigner
      ? [
          {
            title: '',
            key: 'actions',
            width: 190,
            render: (_: unknown, row: TaskWithRelations) => (
              <Space>
                <Button size="small" disabled={row.status === 'accepted'} onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                <Popconfirm title="Удалить задачу?" onConfirm={() => void remove(row.id)}>
                  <Button size="small" danger>
                    Удалить
                  </Button>
                </Popconfirm>
              </Space>
            ),
          } satisfies ColumnsType<TaskWithRelations>[number],
        ]
      : []),
  ]

  if (loading && !object) {
    return (
      <div className="center-screen">
        <Spin size="large" />
      </div>
    )
  }

  if (!object) {
    return (
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/objects')}>
        К списку объектов
      </Button>
    )
  }

  return (
    <>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/objects')} className="back-link">
        Все объекты
      </Button>
      <div className="page-head">
        <Typography.Title level={3} style={{ margin: 0 }}>
          {object?.name ?? 'Объект'}
        </Typography.Title>
        {isAssigner && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Новая задача
          </Button>
        )}
      </div>
      {object && (
        <Descriptions bordered size="small" style={{ marginBottom: 24 }} column={1}>
          <Descriptions.Item label="Адрес">{object.address}</Descriptions.Item>
        </Descriptions>
      )}
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={tasks}
        pagination={false}
        locale={{ emptyText: 'Задач пока нет' }}
      />

      <Modal
        title={editing ? 'Редактировать задачу' : 'Новая задача'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Укажите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            name="assignee_id"
            label="Исполнитель"
            rules={[{ required: true, message: 'Назначьте исполнителя' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={executors.map((item) => ({ value: item.id, label: item.full_name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
