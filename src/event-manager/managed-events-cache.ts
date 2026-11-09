export type ManagedEventRow = { id: string; name: string; type: string; date: string; endDate: string | null; time: string; location: string; description: string; status: string; approvedFarmers: number; farmerCount: number; pendingApplications: number; completedSalesValue: number }

export const managedEventsCache: { current: ManagedEventRow[] | null } = { current: null }

export function invalidateManagedEventsCache() { managedEventsCache.current = null }
