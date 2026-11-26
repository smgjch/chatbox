import { createFileRoute, redirect } from '@tanstack/react-router'

// Compatibility redirect for bookmarks from the full edition.
export const Route = createFileRoute('/copilots/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/provider' })
  },
})
