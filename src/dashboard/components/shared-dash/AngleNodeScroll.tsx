import { useState, useMemo } from 'react'
import nodeImage from '@/assets/node.png'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import TotalcntCsv from '@/dashboard/components/shared-dash/TotalnctCSV'
import { IAngleNode, IBuilding } from '@/types/interfaces'

interface Props {
  building_angle_nodes: IAngleNode[]
  dangerAngleNodes: IAngleNode[]
  onSelectNode: (doorNum: number) => void
  buildingData?: IBuilding
  B: number
  G: number
  Y: number
  R: number
  setB: (val: number) => void
  setG: (val: number) => void
  setY: (val: number) => void
  setR: (val: number) => void
  viewMode: 'general' | 'delta' | 'avgDelta'
  setViewMode: (mode: 'general' | 'delta' | 'avgDelta') => void
  allNodes: IAngleNode[]
  onSetAlarmLevels: (levels: { B: number; G: number; Y: number; R: number }) => void
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
  viewMode,
  setViewMode,
  onSetAlarmLevels,
}: Props) => {
  const [selectedGateway, setSelectedGateway] = useState<string>('')
  const [selectedNode, setSelectedNode] = useState<number | ''>('')

  const sortedNodes = useMemo(() => {
    if (!building_angle_nodes?.length) return []
    return [...building_angle_nodes].sort((a, b) => Math.abs(b.angle_x) - Math.abs(a.angle_x))
  }, [building_angle_nodes])

  const gateways = useMemo(() => {
    const set = new Set<string>()
    building_angle_nodes.forEach(node => {
      if (node.gateway_id?.serial_number) set.add(node.gateway_id.serial_number)
    })
    return Array.from(set).sort()
  }, [building_angle_nodes])

  const nodesToDisplay = useMemo(() => {
    let nodes = [...sortedNodes]
    if (selectedGateway) {
      nodes = nodes.filter(node => node.gateway_id?.serial_number === selectedGateway)
    }
    if (selectedNode !== '') {
      nodes = nodes.filter(node => node.doorNum === selectedNode)
    }
    return nodes
  }, [sortedNodes, selectedGateway, selectedNode])

  const getNodeColorClass = (x: number) => {
    if (B === 0 && G === 0 && Y === 0 && R === 0) return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
    if (x <= -R || x >= R) return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'
    if ((x <= -Y && x > -R) || (x >= Y && x < R)) return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'
    if ((x <= -G && x > -Y) || (x >= G && x < Y)) return 'bg-gradient-to-r from-yellow-50 to-yellow-200 hover:to-yellow-300'
    if ((x <= -B && x > -G) || (x >= B && x < G)) return 'bg-gradient-to-r from-green-50 to-green-200 hover:to-green-300'
    if (x > -B && x < B) return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
    return 'bg-gray-100'
  }

  const generateOptions = (min: number) => {
    return Array.from({ length: 21 }, (_, i) => parseFloat((i * 0.5).toFixed(1)))
      .filter(num => num >= min)
  }

  return (
    <div className='grid grid-cols-12 gap-4 w-full h-screen px-4 py-4'>
      <ScrollArea className='col-span-12 md:col-span-4 overflow-auto h-full rounded-lg border border-slate-400 bg-white p-4 -mt-5 2xl:h-[95vh] w-[90%]'>
        {/* BGYR 설정 */}
        <div className='flex justify-between mb-4 gap-2'>
          {[{ key: 'B', label: '정상', color: 'bg-blue-500' },
          { key: 'G', label: '안전', color: 'bg-green-500' },
          { key: 'Y', label: '경고', color: 'bg-yellow-400' },
          { key: 'R', label: '위험', color: 'bg-red-500' }].map(({ key, label, color }) => {
            const value = key === 'B' ? B : key === 'G' ? G : key === 'Y' ? Y : R
            const minValue = key === 'B' ? 0 : key === 'G' ? B : key === 'Y' ? G : Y
            const setter = key === 'B' ? setB : key === 'G' ? setG : key === 'Y' ? setY : setR
            return (
              <div key={key} className='flex flex-col items-center'>
                <label className='flex items-center text-xs font-semibold mb-1 gap-1'>
                  <span className={`w-3 h-3 ${color} inline-block rounded-sm`}></span>
                  {label}
                </label>
                <select
                  className='border border-gray-300 rounded-md px-2 py-1 text-sm'
                  value={value}
                  onChange={e => setter(parseFloat(e.target.value))}
                >
                  {generateOptions(minValue).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>

        {/* 알람 레벨 저장 */}
        <div className='flex justify-center my-2'>
          <button
            className='px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors'
            onClick={() => onSetAlarmLevels({ B, G, Y, R })}
          >
            알람 저장
          </button>
        </div>

        {/* 뷰 모드 */}
        <div className='flex justify-center mb-4 gap-2'>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${viewMode === 'general' ? 'bg-blue-600' : 'bg-gray-400 hover:bg-gray-500'}`}
            onClick={() => setViewMode('general')}
          >
            일반
          </button>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${viewMode === 'delta' ? 'bg-purple-600' : 'bg-gray-400 hover:bg-gray-500'}`}
            onClick={() => setViewMode('delta')}
          >
            변화량
          </button>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${viewMode === 'avgDelta' ? 'bg-green-600' : 'bg-gray-400 hover:bg-gray-500'}`}
            onClick={() => setViewMode('avgDelta')}
          >
            평균변화
          </button>
        </div>

        {/* Gateway + Node 선택 */}
        <div className='flex justify-center mb-4 gap-2'>
          <select
            className='border border-gray-300 rounded-md px-2 py-1 text-sm  overflow-y-auto'
            value={selectedGateway}
            onChange={e => setSelectedGateway(e.target.value)}
          >
            <option value=''>전체 Gateway</option>
            {gateways.map(gw => (
              <option key={gw} value={gw}>{gw}</option>
            ))}
          </select>

          <select
            className='border border-gray-300 rounded-md px-2 py-1 text-sm overflow-y-auto'
            value={selectedNode}
            onChange={e => setSelectedNode(e.target.value === '' ? '' : parseInt(e.target.value))}
          >
            <option value=''>전체 노드</option>
            {[...sortedNodes]
              .sort((a, b) => a.doorNum - b.doorNum) // 🔹 숫자 오름차순
              .map(node => (
                <option key={node.doorNum} value={node.doorNum}>
                  {node.doorNum}
                </option>
              ))}
          </select>

        </div>

        {/* 노드 카드 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {nodesToDisplay.map(item => {
            return (
              <Card
                key={item.doorNum}
                onClick={() => onSelectNode(item.doorNum)}
                className={`border border-slate-300 flex flex-col justify-center p-2 ${getNodeColorClass(item.angle_x)} shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer relative`}
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
                  <div className='flex justify-between mb-1'>
                    <p className='text-gray-800'>Gateway:</p>
                    <p className='font-medium text-gray-600'>{item.gateway_id?.serial_number || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </ScrollArea>

      {/* 이미지 + CSV */}
      <div className='col-span-12 md:col-span-5 flex flex-col justify-between h-[40%] md:-mt-5 2xl:-mt-5 md:-ml-5 md:mr-3 2xl:-ml-10 2xl:mr-7'>
        <div className='flex flex-col items-center'>
          <span className='mt-2 text-center text-lg font-semibold text-gray-700'>비계전도노드</span>
          <img
            src={`${import.meta.env.VITE_SERVER_BASE_URL}/static/images/${buildingData?.building_plan_img || nodeImage}`}
            alt='비계전도 노드'
            className='w-[20vw] h-auto object-contain rounded-md'
          />
        </div>
        <div className='w-full 2xl:ml-[1.3vw]'>
          <TotalcntCsv building={buildingData} />
        </div>
      </div>

      {/* 위험 노드 표시 */}
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