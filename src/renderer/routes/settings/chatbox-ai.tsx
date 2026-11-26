import { createFileRoute, redirect } from '@tanstack/react-router'

// Compatibility redirect for bookmarks from the full edition.
export const Route = createFileRoute('/settings/chatbox-ai')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/provider' })
  },
})
