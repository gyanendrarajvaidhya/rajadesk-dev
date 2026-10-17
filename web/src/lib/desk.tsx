import { createContext, useContext } from 'react'

export type Page = 'today' | 'epics' | 'tasks' | 'github' | 'account'

/** App-wide actions: switch page, open the epic drawer. */
export const DeskContext = createContext<{ go: (p: Page) => void; openEpic: (hid: string) => void }>({
  go: () => {},
  openEpic: () => {},
})
export const useDesk = () => useContext(DeskContext)
