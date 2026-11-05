import type { TaskStatus, UserRole } from './types'
import { TASK_STATUSES } from './types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  new: 'blue',
  in_progress: 'processing',
  review: 'orange',
  accepted: 'green',
  rework: 'red',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  assigner: 'Постановщик',
  executor: 'Исполнитель',
}

export type TaskAction = {
  key: string
  label: string
  nextStatus: TaskStatus
  danger?: boolean
  commentRequired?: boolean
}

export function availableActions(
  status: TaskStatus,
  role: UserRole,
  isAssignee: boolean,
): TaskAction[] {
  if (role === 'executor' && isAssignee) {
    if (status === TASK_STATUSES.new) {
      return [{ key: 'take', label: 'Взять в работу', nextStatus: TASK_STATUSES.in_progress }]
    }
    if (status === TASK_STATUSES.in_progress) {
      return [{ key: 'review', label: 'Отправить на проверку', nextStatus: TASK_STATUSES.review }]
    }
    if (status === TASK_STATUSES.rework) {
      return [{ key: 'resume', label: 'Вернуть в работу', nextStatus: TASK_STATUSES.in_progress }]
    }
  }

  if (role === 'assigner' && status === TASK_STATUSES.review) {
    return [
      { key: 'accept', label: 'Принять', nextStatus: TASK_STATUSES.accepted },
      {
        key: 'rework',
        label: 'Вернуть на доработку',
        nextStatus: TASK_STATUSES.rework,
        danger: true,
        commentRequired: true,
      },
    ]
  }

  return []
}
