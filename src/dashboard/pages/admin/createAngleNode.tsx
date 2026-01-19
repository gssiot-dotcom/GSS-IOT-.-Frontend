// CreateAngleNode.tsx
import AngleGatewayForm from '@/components/forms/Angle_gateway_form'
import VerticalGatewayForm from '@/components/forms/Vertical_gateway_form'
import Header from '@/dashboard/components/shared-dash/Header'
import {
  getActiveAngleNodes,
  getActiveBuildings,
  getGatewaysByTypeRequest,
} from '@/services/apiRequests'
import { useQueries } from '@tanstack/react-query'
import GatewayBuildingAssignForm from '@/components/forms/GatewayBuildingAssign_form'
import { IGateway } from '@/types/interfaces'
import NodeStatusForm from '@/components/forms/node_status_form'

const CreateAngleNode = () => {
  const queryData = useQueries({
    queries: [
      {
        queryKey: ['get-active-angle-nodes'],
        queryFn: getActiveAngleNodes,
        retry: 1,
      },
      {
        // ✅ 한번만 가져오기: { GATEWAY: [], VERTICAL_NODE_GATEWAY: [] }
        queryKey: ['get-gateways-bytype'],
        queryFn: getGatewaysByTypeRequest,
        retry: 1,
      },
      {
        queryKey: ['get-active-buildings'],
        queryFn: getActiveBuildings,
        retry: 1,
      },
    ],
  })

  const gatewaysByType = queryData[1].data

  // ✅ 상태 상관없이 전부 사용
  const rawGatewayGroup = (gatewaysByType?.GATEWAY ?? []) as IGateway[]
  const rawVerticalGatewayGroup = (gatewaysByType?.VERTICAL_NODE_GATEWAY ?? []) as IGateway[]

  // ✅ 해치발판&비계전도: GATEWAY + NODE_GATEWAY (둘 다)
  const angleFormGateways = rawGatewayGroup.filter((gw) => {
    const t = String((gw as any).gateway_type)
    return t === 'GATEWAY' || t === 'NODE_GATEWAY'
  })

  // ✅ 수직노드: VERTICAL_NODE_GATEWAY만
  const verticalFormGateways = rawVerticalGatewayGroup.filter((gw) => {
    const t = String((gw as any).gateway_type)
    return t === 'VERTICAL_NODE_GATEWAY'
  })

  const isLoading = queryData.some((q) => q.isLoading)
  const isError = queryData.some((q) => q.isError)

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

  if (isError) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-red-600">데이터를 불러오지 못했습니다.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex flex-col">
      <Header />

      <div className="w-full h-full flex flex-col items-center gap-4 p-3 pb-6">
        <div className="w-full md:flex justify-center md:items-start gap-3 md:space-y-0 space-y-5 ml-6">
          <AngleGatewayForm
            refetchNodes={refetchAngleNodes}
            gateways={angleFormGateways} // ✅ GATEWAY + NODE_GATEWAY
          />

          <VerticalGatewayForm
            refetchNodes={refetchAngleNodes}
            gateways={verticalFormGateways} // ✅ VERTICAL_NODE_GATEWAY
          />

          <GatewayBuildingAssignForm
            refetchAll={refetchAll}
          />
        </div>

        <div className="w-full flex justify-center">
          <div className="w-full translate-x-3">
            <NodeStatusForm />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateAngleNode
