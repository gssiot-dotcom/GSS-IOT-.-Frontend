import GatewayForm, { OfficeGatewayForm } from '@/components/forms/Gateway_form'
import NodeForm from '@/components/forms/Node_form'
import ActiveNodes from '@/dashboard/components/pages-comps/Active_nodes'
import Header from '@/dashboard/components/shared-dash/Header'
import { getActiveNodes } from '@/services/apiRequests'
import { useQuery } from '@tanstack/react-query'

const AddProduct = () => {
	const { data, refetch } = useQuery({
		queryKey: ['get-active-nodes'],
		queryFn: getActiveNodes,
		retry: 1,
	})

	return (
		<div className='w-full h-screen flex flex-col'>
			<Header />
			<div className='w-full h-full md:flex justify-center md:items-start mt-10 gap-3 p-3 pb-6 md:space-y-0 space-y-5'>
				<GatewayForm refetch={refetch} nodes={data} />
				<div className='md:w-[30%] md:flex flex-col gap-y-10'>
					<NodeForm refetch={refetch} />
					<OfficeGatewayForm />
				</div>

				<ActiveNodes nodes={data} />
			</div>
		</div>
	)
}

export default AddProduct
