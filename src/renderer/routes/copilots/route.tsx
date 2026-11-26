import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/copilots')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/provider' })
  },
})
