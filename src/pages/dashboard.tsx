import backgroundImage from '@/assets/pageBg4.jpg'
import PagesNavbar from '@/components/shared/pagesNavbar'
import { AdminLayout, ClientLayout } from '@/dashboard/layout'
import { IResource } from '@/types/interfaces'

const AdminDashboard = () => {
	const resource: IResource = {
		img: backgroundImage,
		title: 'Dashboard',
	}
	return (
		<div className='w-full h-full flex flex-col'>
			<div className='md:block hidden'>
				<PagesNavbar data={resource} />
			</div>

			<AdminLayout />
		</div>
	)
}

const ClientDashboard = () => {
	const resource: IResource = {
		img: backgroundImage,
		title: 'Dashboard',
	}
	return (
		<div className='w-full h-full flex flex-col'>
			<div className='md:block hidden'>
				<PagesNavbar data={resource} />
			</div>

			<ClientLayout />
		</div>
	)
}

export { AdminDashboard, ClientDashboard }
