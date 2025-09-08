import { AdminLayout, ClientLayout } from '@/dashboard/layout'

const AdminDashboard = () => {
	// const resource: IResource = {
	// 	img: backgroundImage,
	// 	title: 'Dashboard',
	// }
	return (
		<div className='w-full h-full flex flex-col'>
			{/* <div className='md:block hidden'>
				<PagesNavbar data={resource} />
			</div> */}

			<AdminLayout />
		</div>
	)
}

const ClientDashboard = () => {
	// const resource: IResource = {
	// 	img: backgroundImage,
	// 	title: 'Dashboard',
	// }
	return (
		<div className='w-full h-full flex flex-col'>
			{/* <div className='md:block hidden'>
				<PagesNavbar data={resource} />
			</div> */}

			<ClientLayout />
		</div>
	)
}

export { AdminDashboard, ClientDashboard }
