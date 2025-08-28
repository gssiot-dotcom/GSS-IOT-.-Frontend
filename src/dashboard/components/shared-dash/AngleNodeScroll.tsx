import digaenode from '@/assets/digaenode.png'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IAngleNode } from '@/types/interfaces'
import TotalcntCsv from '@/dashboard/components/shared-dash/TotalnctCSV'

interface Props {
  building_angle_nodes: IAngleNode[]
  dangerAngleNodes: IAngleNode[]
  onSelectNode: (doorNum: number) => void
  buildingData?: any // TotalcntCsv에 전달할 building 정보
}

const getNodeColorClass = (item: IAngleNode): string => {
  const absX = Math.abs(item.angle_x)
  if (absX > 1) return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'
  if (absX > 0.8) return 'bg-gradient-to-r from-yellow-50 to-yellow-200 hover:to-yellow-300'
  if (absX > 0.6) return 'bg-gradient-to-r from-green-50 to-green-200 hover:to-green-300'
  return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
}

const AngleNodeScroll = ({
  building_angle_nodes,
  dangerAngleNodes,
  onSelectNode,
  buildingData,
}: Props) => {
  if (!building_angle_nodes?.length) {
    return (
      <div className='w-full py-7 border border-red-500 rounded-lg text-center text-red-500'>
        노드 정보가 없습니다.
      </div>
    )
  }

  const sortedNodes = [...building_angle_nodes].sort(
    (a, b) => Math.abs(b.angle_x) - Math.abs(a.angle_x)
  )

  return (
    <div className='grid grid-cols-12 gap-4 w-full h-screen px-4 py-4'>
      {/* 왼쪽 - 일반 노드 */}
      <ScrollArea className='col-span-12 md:col-span-4 overflow-auto h-full rounded-lg border border-slate-400 bg-white p-4 -mt-5 2xl:h-[95vh]'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {sortedNodes.map(item => (
            <Card
              key={item.doorNum}
              onClick={() => onSelectNode(item.doorNum)}
              className={`border border-slate-300 flex flex-col justify-center p-2 ${getNodeColorClass(
                item
              )} shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer`}
            >
              <CardContent className='flex flex-col justify-center p-2 text-sm text-gray-700'>
                <div className='flex justify-between items-center mb-2'>
                  <h1 className='font-bold text-blue-700'>노드넘버</h1>
                  <span className='text-blue-800 font-semibold text-lg'>{item.doorNum}</span>
                </div>
                <div className='flex justify-between mb-1'>
                  <p className='font-medium text-gray-600'>Axis-X:</p>
                  <p className='text-gray-800'>{item.angle_x}</p>
                </div>
                <div className='flex justify-between mb-1'>
                  <p className='font-medium text-gray-600'>Axis-Y:</p>
                  <p className='text-gray-800'>{item.angle_y}</p>
                </div>
                <div className='flex justify-between'>
                  <p className='font-medium text-gray-600'>gateway:</p>
                  <p className='text-gray-800'>{item.gateway_id?.serial_number}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* 가운데 - 비계전도 노드 + TotalcntCsv (TotalcntCsv는 위험노드 높이 바닥과 맞춤) */}
      <div className='col-span-12 md:col-span-5 flex flex-col justify-between h-[40%] md:-mt-8 2xl:-mt-5'>
        {/* 이미지 */}
        <div className='flex flex-col items-center'>
          <img
            src={digaenode}
            alt='비계전도 노드'
            className='w-32 sm:w-36 md:w-40 lg:w-44 2xl:w-48 2xl:mt-10 h-auto object-contain rounded-md'
          />
          <span className='mt-2 text-center text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-gray-700'>
            비계전도노드
          </span>
        </div>

        {/* TotalcntCsv - 항상 위험노드 바닥과 동일선상 */}
        <div className='w-full'>
          <TotalcntCsv building={buildingData} />
        </div>
      </div>

      {/* 오른쪽 - 위험 노드 */}
      <ScrollArea
        className='col-span-12 md:col-span-3 overflow-auto rounded-lg border border-slate-400 bg-white p-3 -mt-5'
        style={{ height: '40%', width: '109%' }}
      >
        <div className='flex flex-col gap-2'>
          {dangerAngleNodes && dangerAngleNodes.length ? (
            dangerAngleNodes.map(item => (
              <div key={item._id} className='text-center p-2 bg-red-500 border rounded-md'>
                <p className='text-white text-[16px]'>노드 {item.doorNum}번 경고 확인바람</p>
              </div>
            ))
          ) : (
            <div className='p-2 bg-blue-500 border rounded-md'>
              <p className='text-center text-white text-[16px]'>지금 위험이 없습니다.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default AngleNodeScroll
