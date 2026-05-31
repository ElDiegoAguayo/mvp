import { redirect } from 'next/navigation'
import { getMyProfilePageDataAction } from '@/app/actions/profile-actions'
import { UserProfileView } from '@/components/dashboard/user-profile-view'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const data = await getMyProfilePageDataAction()
  if (!data) redirect('/auth/login')

  return <UserProfileView data={data} />
}
