import AngleBuildingForm from '@/components/forms/Angle_building_form'
import AngleNodeForm from '@/components/forms/Angle_node_form'
import ActiveNodes from '@/dashboard/components/pages-comps/Active_nodes'
import Header from '@/dashboard/components/shared-dash/Header'
import {
  getActiveAngleNodes,
  getGateways,
  getActiveBuildings,
} from '@/services/apiRequests'
import { useQueries } from '@tanstack/react-query'
import GatewayBuildingAssignForm from '@/components/forms/GatewayBuildingAssign_form'
import { IGateway } from '@/types/interfaces'


const CreateAngleNode = () => {
  const queryData = useQueries({
    queries: [
      {
        queryKey: ['get-active-angle-nodes'],
        queryFn: getActiveAngleNodes,
        retry: 1,
      },
      {
        queryKey: ['get-gateways'],
        queryFn: getGateways,
        retry: 1,
      },
      {
        queryKey: ['get-active-buildings'],
        queryFn: getActiveBuildings,
        retry: 1,
      },
    ],
  })

  const activeAngleNodes = queryData[0].data

  // 🔥 전체 게이트웨이 → gateway_status=true 인 것만 필터링
  const gatewaysAll = queryData[1].data

  // gw: IGateway 타입 지정
  const gateways = gatewaysAll?.filter((gw: IGateway) => gw.gateway_status === true) ?? []



  const isLoading = queryData.some(q => q.isLoading)

  const refetchAngleNodes = queryData[0].refetch
  const refetchAll = () => {
    queryData.forEach(q => q.refetch())
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex flex-col">
      <Header />
      <div className="w-full h-full md:flex justify-center md:items-start mt-10 gap-3 p-3 pb-6 md:space-y-0 space-y-5">

        <AngleNodeForm />

        <AngleBuildingForm
          refetchNodes={refetchAngleNodes}
          angle_nodes={activeAngleNodes}
        />

        {/* 🔥 gateway_status=true 인 게이트웨이만 전달 */}
        <GatewayBuildingAssignForm
          gateways={gateways}
          refetchAll={refetchAll}
        />

        <ActiveNodes nodes={activeAngleNodes} />
      </div>
    </div>
  )
}

export default CreateAngleNode
