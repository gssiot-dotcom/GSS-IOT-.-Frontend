import GatewayForm from '@/components/forms/Gateway_form'
import NodeForm from '@/components/forms/Node_form'
import AngleNodeForm from '@/components/forms/Angle_node_form'
import VerticalNodeForm from '@/components/forms/Vertical_node_form'
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
    <div className="w-full h-screen flex flex-col overflow-x-hidden">
      <Header />

      <div className="flex-1 p-6">
        {/* 좌 / 우 2컬럼 */}
        <div
          className="
            grid
            gap-6
            h-full
          "
        >
          {/* LEFT : 게이트웨이 */}
          <section className="min-w-0">
            <h2 className="text-lg font-bold mb-4 border-b pb-2">
              게이트웨이 생성
            </h2>
            <GatewayForm refetch={refetch} nodes={data} />
          </section>

          {/* RIGHT : 노드 생성 */}
          <section className="min-w-0">
            <h2 className="text-lg font-bold mb-4 border-b pb-2">
              노드 생성
            </h2>

            {/* 위 2개 + 아래 1개 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <NodeForm refetch={refetch} />
              <AngleNodeForm />
              <VerticalNodeForm />

              {/* 2열 균형용 더미 */}
              <div className="hidden md:block" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default AddProduct
