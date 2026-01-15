import AngleGatewayForm from '@/components/forms/Angle_gateway_form'
import VerticalGatewayForm from '@/components/forms/Vertical_gateway_form'
import Header from '@/dashboard/components/shared-dash/Header'
import {
  getActiveAngleNodes,
  getGateways,
  getActiveBuildings,
} from '@/services/apiRequests'
import { useQueries } from '@tanstack/react-query'
import GatewayBuildingAssignForm from '@/components/forms/GatewayBuildingAssign_form'
import { IGateway } from '@/types/interfaces'
import NodeStatusForm from '@/components/forms/node_status_form' // ✅ 추가

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

  const gatewaysAll = queryData[1].data
  const gateways = gatewaysAll?.filter((gw: IGateway) => gw.gateway_status === true) ?? []

  const isLoading = queryData.some((q) => q.isLoading)

  const refetchAngleNodes = queryData[0].refetch
  const refetchAll = () => {
    queryData.forEach((q) => q.refetch())
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

      {/* ✅ 전체 컨테이너 */}
      <div className="w-full h-full flex flex-col items-center mt-3 gap-4 p-3 pb-6">
        {/* ✅ 1줄(기존 3개 폼) */}
        <div className="w-full md:flex justify-center md:items-start gap-3 md:space-y-0 space-y-5">
          <AngleGatewayForm refetchNodes={refetchAngleNodes} angle_nodes={activeAngleNodes} />

          <VerticalGatewayForm refetchNodes={refetchAngleNodes} angle_nodes={activeAngleNodes} />

          <GatewayBuildingAssignForm gateways={gateways} refetchAll={refetchAll} />
        </div>

        {/* ✅ 2줄(아래 빈공간에 노드확인 넣기) */}
        <div className="w-full md:flex -mt-[5vh]">
          {/* 폭은 상황에 맞게 조절: md:w-[40%] / md:w-[50%] 등 */}
          <div className="w-full md:w-[40%]">
            <NodeStatusForm />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateAngleNode
