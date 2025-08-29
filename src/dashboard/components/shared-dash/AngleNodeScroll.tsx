import digaenode from '@/assets/digaenode.png'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IAngleNode } from '@/types/interfaces'
import TotalcntCsv from '@/dashboard/components/shared-dash/TotalnctCSV'

interface Props {
  building_angle_nodes: IAngleNode[]
  dangerAngleNodes: IAngleNode[]
  onSelectNode: (doorNum: number) => void
  buildingData?: any
  B: number
  G: number
  Y: number
  R: number
  setB: (val: number) => void
  setG: (val: number) => void
  setY: (val: number) => void
  setR: (val: number) => void
}

const AngleNodeScroll = ({
  building_angle_nodes,
  dangerAngleNodes,
  onSelectNode,
  buildingData,
  B,
  G,
  Y,
  R,
  setB,
  setG,
  setY,
  setR,
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

  const getNodeColorClass = (x: number) => {
    if (B === 0 && G === 0 && Y === 0 && R === 0) {
      return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
    }

    // 빨강
    if (x <= -R || x >= R) return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'
    if ((x <= -Y && x > -R) || (x >= Y && x < R)) return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'

    // 노랑
    if ((x <= -G && x > -Y) || (x >= G && x < Y)) return 'bg-gradient-to-r from-yellow-50 to-yellow-200 hover:to-yellow-300'

    // 초록
    if ((x <= -B && x > -G) || (x >= B && x < G)) return 'bg-gradient-to-r from-green-50 to-green-200 hover:to-green-300'

    // 파랑
    if (x > -B && x < B) return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'

    return 'bg-gray-100'
  }

  return (
    <div className='grid grid-cols-12 gap-4 w-full h-screen px-4 py-4'>
      {/* 왼쪽 노드 */}
      <ScrollArea className='col-span-12 md:col-span-4 overflow-auto h-full rounded-lg border border-slate-400 bg-white p-4 -mt-5 2xl:h-[95vh] w-[90%]'>
        <div className='flex justify-between mb-4 p-2 bg-gray-100 rounded-md text-sm font-medium text-gray-700'>
          <span><strong>AL GW:</strong> 3</span>
          <span><strong>GW:</strong> 8</span>
          <span><strong>Node:</strong> 47</span>
        </div>

        <div className='flex justify-between mb-4 gap-2'>
          {['B', 'G', 'Y', 'R'].map(color => {
            const value = color === 'B' ? B : color === 'G' ? G : color === 'Y' ? Y : R
            const minValue = color === 'B' ? 0 : color === 'G' ? B : color === 'Y' ? G : Y
            const setter = color === 'B' ? setB : color === 'G' ? setG : color === 'Y' ? setY : setR

            return (
              <div key={color} className='flex flex-col items-center'>
                <label className='text-xs font-semibold mb-1'>{color}</label>
                <select
                  className='border border-gray-300 rounded-md px-2 py-1 text-sm'
                  value={value}
                  onChange={e => {
                    const num = parseFloat(e.target.value)
                    setter(num)
                  }}
                >
                  {Array.from({ length: 21 }, (_, i) => (i * 0.5).toFixed(1))
                    .map(num => parseFloat(num))
                    .filter(num => num >= minValue)
                    .map(num => <option key={num} value={num}>{num}</option>)}
                </select>
              </div>
            )
          })}
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {sortedNodes.map(item => (
            <Card
              key={item.doorNum}
              onClick={() => onSelectNode(item.doorNum)}
              className={`border border-slate-300 flex flex-col justify-center p-2 ${getNodeColorClass(item.angle_x)} shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer`}
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
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* 가운데 이미지 + TotalcntCsv */}
      <div className='col-span-12 md:col-span-5 flex flex-col justify-between h-[40%] md:-mt-5 2xl:-mt-5 md:-ml-5 md:mr-3  2xl:-ml-10 2xl:mr-7'>
        <div className='flex flex-col items-center'>
          <img src={digaenode} alt='비계전도 노드' className='w-40 h-auto object-contain rounded-md'/>
          <span className='mt-2 text-center text-lg font-semibold text-gray-700'>비계전도노드</span>
        </div>
        <div className='w-full'>
          <TotalcntCsv building={buildingData} />
        </div>
      </div>

      {/* 오른쪽 위험 노드 */}
      <ScrollArea className='col-span-12 md:col-span-3 overflow-auto rounded-lg border border-slate-400 bg-white p-3 -mt-5' style={{ height: '40%', width: '109%' }}>
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
