import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { EpicDetail, Github, Status, Work } from './types'

const MIN = 60 * 1000

export const useStatus = () =>
  useQuery({
    queryKey: ['status'],
    queryFn: () => api<Status>('/api/status'),
    // While the sign-in window is open, poll so the page moves on by itself once the developer has signed in.
    refetchInterval: (q) => (q.state.data?.raja.signingIn ? 2000 : 5 * MIN),
  })
export const useWork = (enabled = true) =>
  useQuery({ queryKey: ['work'], queryFn: () => api<Work>('/api/work'), refetchInterval: 2 * MIN, enabled })
export const useEpic = (hid: string | null) =>
  useQuery({ queryKey: ['epic', hid], queryFn: () => api<EpicDetail>(`/api/epic/${hid}`), enabled: !!hid })
export const useGithub = (enabled: boolean) =>
  useQuery({ queryKey: ['github'], queryFn: () => api<Github>('/api/github'), enabled, refetchInterval: 5 * MIN })
