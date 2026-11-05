export const USER_ROLES = {
  assigner: 'assigner',
  executor: 'executor',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export const TASK_STATUSES = {
  new: 'new',
  in_progress: 'in_progress',
  review: 'review',
  accepted: 'accepted',
  rework: 'rework',
} as const

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES]

export type Profile = {
  id: string
  email: string
  full_name: string
  role: UserRole
}

export type ConstructionObject = {
  id: string
  name: string
  address: string
  created_at: string
  created_by: string
}

export type Task = {
  id: string
  title: string
  description: string
  object_id: string
  assignee_id: string
  status: TaskStatus
  author_id: string
  created_at: string
}

export type TaskStatusHistory = {
  id: string
  task_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  changed_by: string
  comment: string | null
  created_at: string
}

export type TaskWithRelations = Task & {
  assignee: Profile | null
  author: Profile | null
  object: ConstructionObject | null
}

export type HistoryWithActor = TaskStatusHistory & {
  actor: Pick<Profile, 'id' | 'full_name' | 'role'> | null
}
