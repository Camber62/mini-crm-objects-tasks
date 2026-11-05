import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import type { ConstructionObject } from '../lib/types'

type ObjectForm = {
  name: string
  address: string
}

export function ObjectsPage() {
  const { profile } = useAuth()
  const isAssigner = profile?.role === 'assigner'
  const [objects, setObjects] = useState<ConstructionObject[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ConstructionObject | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ObjectForm>()

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('objects')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      message.error(error.message)
    } else {
      setObjects((data ?? []) as ConstructionObject[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(row: ConstructionObject) {
    setEditing(row)
    form.setFieldsValue({ name: row.name, address: row.address })
    setModalOpen(true)
  }

  async function save() {
    const values = await form.validateFields()
    if (!profile) return
    setSaving(true)
    const payload = { name: values.name.trim(), address: values.address.trim() }
    const query = editing
      ? supabase.from('objects').update(payload).eq('id', editing.id)
      : supabase.from('objects').insert({ ...payload, created_by: profile.id })
    const { error } = await query
    setSaving(false)
    if (error) {
      message.error(error.message)
      return
    }
    message.success(editing ? 'Объект обновлён' : 'Объект создан')
    setModalOpen(false)
    await load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('objects').delete().eq('id', id)
    if (error) {
      message.error(error.message)
      return
    }
    message.success('Объект удалён')
    await load()
  }

  const columns: ColumnsType<ConstructionObject> = [
    {
      title: 'Название',
      dataIndex: 'name',
      render: (name: string, row) => <Link to={`/objects/${row.id}`}>{name}</Link>,
    },
    { title: 'Адрес', dataIndex: 'address' },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('ru-RU'),
    },
    ...(isAssigner
      ? [
          {
            title: '',
            key: 'actions',
            width: 180,
            render: (_: unknown, row: ConstructionObject) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                <Popconfirm
                  title="Удалить объект вместе с задачами?"
                  onConfirm={() => void remove(row.id)}
                >
                  <Button size="small" danger>
                    Удалить
                  </Button>
                </Popconfirm>
              </Space>
            ),
          } satisfies ColumnsType<ConstructionObject>[number],
        ]
      : []),
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Объекты
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {isAssigner
              ? 'Стройки компании. Откройте объект, чтобы ставить задачи.'
              : 'Вам видны только объекты, где есть ваши задачи.'}
          </Typography.Paragraph>
        </div>
        {isAssigner && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Новый объект
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={objects}
        pagination={false}
        locale={{ emptyText: 'Объектов пока нет' }}
      />

      <Modal
        title={editing ? 'Редактировать объект' : 'Новый объект'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, message: 'Укажите название' }]}
          >
            <Input placeholder="ЖК «Северная долина», корпус 4" />
          </Form.Item>
          <Form.Item
            name="address"
            label="Адрес"
            rules={[{ required: true, message: 'Укажите адрес' }]}
          >
            <Input placeholder="Город, улица, дом" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
