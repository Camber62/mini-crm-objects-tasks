import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Timeline,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import type { HistoryWithActor, TaskStatus, TaskWithRelations } from '../lib/types'
import { ROLE_LABELS, STATUS_LABELS, availableActions, type TaskAction } from '../lib/status'
import { StatusTag } from '../components/StatusTag'

export function TaskPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [task, setTask] = useState<TaskWithRelations | null>(null)
  const [history, setHistory] = useState<HistoryWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [commentAction, setCommentAction] = useState<TaskAction | null>(null)
  const [form] = Form.useForm<{ comment: string }>()

  async function load() {
    if (!id) return
    setLoading(true)
    const [{ data: taskData, error: taskError }, { data: historyData, error: historyError }] =
      await Promise.all([
        supabase
          .from('tasks')
          .select(
            '*, assignee:profiles!tasks_assignee_id_fkey(*), author:profiles!tasks_author_id_fkey(*), object:objects(*)',
          )
          .eq('id', id)
          .single(),
        supabase
          .from('task_status_history')
          .select('*, actor:profiles!task_status_history_changed_by_fkey(id, full_name, role)')
          .eq('task_id', id)
          .order('created_at', { ascending: true }),
      ])

    if (taskError) {
      message.error('Задача не найдена или нет доступа')
      setTask(null)
    } else {
      setTask(taskData as TaskWithRelations)
    }

    if (historyError) {
      message.error(historyError.message)
    } else {
      setHistory((historyData ?? []) as HistoryWithActor[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [id])

  const actions = useMemo(() => {
    if (!task || !profile) return []
    return availableActions(task.status, profile.role, task.assignee_id === profile.id)
  }, [task, profile])

  async function changeStatus(nextStatus: TaskStatus, comment?: string) {
    if (!id) return
    setActing(true)
    const { error } = await supabase.rpc('change_task_status', {
      p_task_id: id,
      p_new_status: nextStatus,
      p_comment: comment ?? null,
    })
    setActing(false)
    if (error) {
      message.error(error.message)
      return
    }
    message.success('Статус обновлён')
    setCommentAction(null)
    form.resetFields()
    await load()
  }

  async function submitComment() {
    const values = await form.validateFields()
    if (!commentAction) return
    await changeStatus(commentAction.nextStatus, values.comment.trim())
  }

  if (loading) {
    return (
      <div className="center-screen">
        <Spin size="large" />
      </div>
    )
  }

  if (!task) {
    return (
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/objects')}>
        К объектам
      </Button>
    )
  }

  return (
    <>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        className="back-link"
        onClick={() => navigate(task.object_id ? `/objects/${task.object_id}` : '/objects')}
      >
        К объекту
      </Button>
      <div className="page-head">
        <Typography.Title level={3} style={{ margin: 0 }}>
          {task.title}
        </Typography.Title>
        <Space wrap>
          {actions.map((action) => (
            <Button
              key={action.key}
              type={action.danger ? 'default' : 'primary'}
              danger={action.danger}
              loading={acting}
              onClick={() => {
                if (action.commentRequired) {
                  setCommentAction(action)
                  return
                }
                void changeStatus(action.nextStatus)
              }}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      </div>

      <Descriptions bordered column={1} size="small" style={{ marginBottom: 32 }}>
        <Descriptions.Item label="Статус">
          <StatusTag status={task.status} />
        </Descriptions.Item>
        <Descriptions.Item label="Объект">
          {task.object ? <Link to={`/objects/${task.object.id}`}>{task.object.name}</Link> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Исполнитель">{task.assignee?.full_name ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Автор">{task.author?.full_name ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Создана">
          {new Date(task.created_at).toLocaleString('ru-RU')}
        </Descriptions.Item>
        <Descriptions.Item label="Описание">
          {task.description || 'Без описания'}
        </Descriptions.Item>
      </Descriptions>

      <Typography.Title level={4}>История</Typography.Title>
      <Timeline
        items={history.map((item) => ({
          color: item.to_status === 'accepted' ? 'green' : item.to_status === 'rework' ? 'red' : 'blue',
          children: (
            <div>
              <div>
                <strong>
                  {item.from_status ? STATUS_LABELS[item.from_status] : '—'} → {STATUS_LABELS[item.to_status]}
                </strong>
              </div>
              <div>
                {item.actor?.full_name ?? 'Неизвестный'}
                {item.actor ? ` · ${ROLE_LABELS[item.actor.role]}` : ''}
              </div>
              <div className="muted">{new Date(item.created_at).toLocaleString('ru-RU')}</div>
              {item.comment && <div className="history-comment">{item.comment}</div>}
            </div>
          ),
        }))}
      />

      <Modal
        title="Возврат на доработку"
        open={Boolean(commentAction)}
        onCancel={() => setCommentAction(null)}
        onOk={() => void submitComment()}
        confirmLoading={acting}
        okText="Вернуть"
        okButtonProps={{ danger: true }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="comment"
            label="Комментарий"
            rules={[{ required: true, message: 'Комментарий обязателен' }]}
          >
            <Input.TextArea rows={4} placeholder="Что нужно исправить" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
