import type { Worker, WorkerTraining } from '../types'

export type ComplianceState = {
  className: string
  label: string
  helper: string
  tone: 'active' | 'inactive'
}

export type WorkerComplianceSummary = {
  totalItems: number
  activeItems: number
  inactiveItems: number
}

export function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

export function getTrainingState(completedOn: string | null): ComplianceState {
  if (!completedOn) {
    return {
      className: 'badge-missing',
      label: 'Inactive',
      helper: 'No date on file',
      tone: 'inactive',
    }
  }

  return {
    className: 'badge-valid',
    label: 'Active',
    helper: `Completed on ${formatDate(completedOn)}`,
    tone: 'active',
  }
}

export function summarizeWorkerCompliance(trainings: WorkerTraining[]): WorkerComplianceSummary {
  return {
    totalItems: trainings.length,
    activeItems: trainings.filter((training) => training.status === 'completed').length,
    inactiveItems: trainings.filter((training) => training.status !== 'completed').length,
  }
}

export function trainingsByCategory(trainings: WorkerTraining[], category: string) {
  return trainings
    .filter((training) => training.category === category)
    .sort((left, right) => left.display_order - right.display_order)
}

export function workerCompletionPercentage(worker: Worker) {
  return worker.trainings_required
    ? Math.round((worker.trainings_completed / worker.trainings_required) * 100)
    : 0
}
