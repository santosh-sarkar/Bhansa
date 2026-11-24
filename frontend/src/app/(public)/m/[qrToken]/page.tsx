import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_noStore } from 'next/cache'
import { fetchGuestMenu } from '@/features/menu/services/guest.api'
import { GuestMenuPageClient } from './GuestMenuPageClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ qrToken: string }> }): Promise<Metadata> {
  const { qrToken } = await params
  try {
    const menu = await fetchGuestMenu(qrToken)
    return {
      title: `${menu.outlet.name} - Menu`,
      description: `Browse the menu at ${menu.outlet.name}`,
      openGraph: {
        title: `${menu.outlet.name} - Menu`,
        description: `Browse the menu at ${menu.outlet.name}`,
        type: 'website',
      },
    }
  } catch {
    return {
      title: 'Menu',
      description: 'Restaurant Menu',
    }
  }
}

export default async function GuestMenuPage({ params }: { params: Promise<{ qrToken: string }> }) {
  unstable_noStore()
  const { qrToken } = await params

  let menu
  try {
    menu = await fetchGuestMenu(qrToken)
  } catch {
    notFound()
  }

  return <GuestMenuPageClient initialMenu={menu} qrToken={qrToken} />
}