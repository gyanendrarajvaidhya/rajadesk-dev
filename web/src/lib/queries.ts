import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { EpicDetail, Github, Status, Work } from './types'

const MIN = 60 * 1000

export const useStatus = () =>
  useQuery({
    queryKey: ['status'],
    queryFn: () => api<Status>('/api/status'),
    // Poll fast while the sign-in window is open or an update is installing, so the page moves on by itself.
    refetchInterval: (q) => (q.state.data?.raja.signingIn || ['installing', 'restarting'].includes(q.state.data?.update.state ?? '') ? 1500 : 5 * MIN),
  })
export const useWork = (enabled = true) =>
  useQuery({ queryKey: ['work'], queryFn: () => api<Work>('/api/work'), refetchInterval: 2 * MIN, enabled })
export const useEpic = (hid: string | null) =>
  useQuery({ queryKey: ['epic', hid], queryFn: () => api<EpicDetail>(`/api/epic/${hid}`), enabled: !!hid })
export const useGithub = (enabled: boolean) =>
  useQuery({ queryKey: ['github'], queryFn: () => api<Github>('/api/github'), enabled, refetchInterval: 5 * MIN })
