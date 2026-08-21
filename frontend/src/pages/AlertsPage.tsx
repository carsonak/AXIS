import { AppHeader, EmptyState, Page } from '../components'

export default function AlertsPage() {
  return (
    <Page>
      <AppHeader showBack eyebrow="Notifications" title="Alerts" />
      <EmptyState title="No alerts" text="AXIS has no real sensor or weather alerts to show. Current recommendation warnings remain attached to the saved advice that produced them." />
    </Page>
  )
}
