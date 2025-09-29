/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import TotalcntCsv from '@/dashboard/components/shared-dash/TotalnctCSV'
import { cn } from '@/lib/utils'
import { IAngleNode, IBuilding, IGateway } from '@/types/interfaces'
import { Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NodeDetailModal } from './angleNodeDetail'
import axios from 'axios'

interface Props {
  building_angle_nodes: IAngleNode[]
  dangerAngleNodes: IAngleNode[]
  onSelectNode: (doorNum: number) => void
  buildingData?: IBuilding
  gateways: IGateway[]
  G: number
  Y: number
  R: number
  setG: (val: number) => void
  setY: (val: number) => void
  setR: (val: number) => void
  viewMode: 'general' | 'delta' | 'avgDelta'
  setViewMode: (mode: 'general' | 'delta' | 'avgDelta') => void
  allNodes: IAngleNode[]
  onSetAlarmLevels: (levels: { G: number; Y: number; R: number }) => void
}

const AngleNodeScroll = ({
  building_angle_nodes,
  dangerAngleNodes,
  onSelectNode,
  buildingData,
  gateways,
  G,
  Y,
  R,
  setG,
  setY,
  setR,
  viewMode,
  setViewMode,
  onSetAlarmLevels,
  allNodes,
}: Props) => {
  const [selectedGateway, setSelectedGateway] = useState<string>('')
  const [selectedNode, setSelectedNode] = useState<number | ''>('') // 단일 선택
  const [isModalOpen, setIsModalOpen] = useState(true)
  const [selectedNodeForModal, setSelectedNodeForModal] = useState<any>(null)
  const [isPlanImgOpen, setIsPlanImgOpen] = useState(false)

  // ✅ 초기화 모달 관련 상태
  const [isInitModalOpen, setIsInitModalOpen] = useState(false)
  const [selectedNodesForInit, setSelectedNodesForInit] = useState<number[]>([])

  const IMG_SERVER_BASE_URL = `${import.meta.env.VITE_SERVER_BASE_URL}/static/images/`

  // ============= Main Image memo rendering Field =================== //
  const buildImgUrl = (file?: string) => {
    if (!file) return ''
    const cleanBase = IMG_SERVER_BASE_URL.replace(/\/$/, '')
    const cleanFile = file.replace(/^\/+/, '')
    return `${cleanBase}/${encodeURIComponent(cleanFile)}`
  }

  const planImgUrl = useMemo(
    () => buildImgUrl(buildingData?.building_plan_img),
    [buildingData?.building_plan_img]
  )

  const firstNodeOfSelectedGw = useMemo(() => {
    if (!selectedGateway) return null
    return (
      building_angle_nodes?.find(
        (n) =>
          n.gateway_id?.serial_number === selectedGateway && n.angle_node_img
      ) ?? null
    )
  }, [selectedGateway, building_angle_nodes])

  const selectedNodeObj = useMemo(() => {
    if (selectedNode === '' || typeof selectedNode !== 'number') return null
    return (
      building_angle_nodes?.find(
        (n) => n.doorNum === selectedNode && n.angle_node_img
      ) ?? null
    )
  }, [selectedNode, building_angle_nodes])

  const mainImageUrl = useMemo(() => {
    if (selectedNodeObj?.angle_node_img)
      return buildImgUrl(selectedNodeObj.angle_node_img)
    if (firstNodeOfSelectedGw?.angle_node_img)
      return buildImgUrl(firstNodeOfSelectedGw.angle_node_img)
    return planImgUrl
  }, [selectedNodeObj, firstNodeOfSelectedGw, planImgUrl])

  const LIMIT = 10
  const sortedNodes = useMemo(() => {
    if (!building_angle_nodes?.length) return []
    return [...building_angle_nodes].sort((a, b) => {
      const aOver = Math.abs(a.angle_x) > LIMIT
      const bOver = Math.abs(b.angle_x) > LIMIT
      if (aOver !== bOver) return aOver ? 1 : -1
      return Math.abs(b.angle_x) - Math.abs(a.angle_x)
    })
  }, [building_angle_nodes])

  const nodesToDisplay = useMemo(() => {
    let nodes = [...sortedNodes]
    if (selectedGateway) {
      nodes = nodes.filter(
        (node) => node.gateway_id?.serial_number === selectedGateway
      )
    }
    if (selectedNode !== '') {
      nodes = nodes.filter((node) => node.doorNum === selectedNode)
    }
    return nodes
  }, [sortedNodes, selectedGateway, selectedNode])

  const aliveNodes = nodesToDisplay.filter((node) => node.node_alive)
  const deadNodes = nodesToDisplay.filter((node) => !node.node_alive)

  // ✅ 색상 결정 함수 (절대값 기준)
  const getNodeColorClass = (x: number) => {
    const absX = Math.abs(x)
    if (absX >= R) return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'
    if (absX >= Y) return 'bg-gradient-to-r from-yellow-50 to-yellow-200 hover:to-yellow-300'
    if (absX >= G) return 'bg-gradient-to-r from-green-50 to-green-200 hover:to-green-300'
    if (absX < G) return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
    return 'bg-gray-100'
  }

  // ✅ 게이트웨이 색상 결정 함수
  const getGatewayColorClass = (gw: IGateway) => {
    const gwNodes = building_angle_nodes.filter(
      (node) => node.gateway_id?.serial_number === gw.serial_number
    )
    if (!gwNodes.length) return 'bg-gray-300 text-gray-700'
    const worstNode = [...gwNodes].sort(
      (a, b) => Math.abs(b.angle_x) - Math.abs(a.angle_x)
    )[0]
    if (!gw.gateway_alive) return 'bg-gray-500/90 text-gray-50 hover:bg-gray-600'
    return getNodeColorClass(worstNode.angle_x) + ' text-gray-800'
  }

  const generateOptions = (min: number) => {
    return Array.from({ length: 21 }, (_, i) =>
      Number.parseFloat((i * 0.5).toFixed(1))
    ).filter((num) => num >= min)
  }

  const handleNodeCardClick = (node: any) => {
    onSelectNode(node.doorNum)
  }

  const handleNodeDetailClick = (e: React.MouseEvent, node: any) => {
    e.stopPropagation()
    setSelectedNodeForModal(node)
    setIsModalOpen(true)
  }

  const togglePlanImg = () => {
    setIsPlanImgOpen(!isPlanImgOpen)
  }

  const onToggleGatewaySelection = (gateway: IGateway) => {
    setSelectedGateway(gateway.serial_number)
    setSelectedNode('')
  }

  // ✅ 초기화 API
  const postCalibrationStart = async (payload: {
    doorNum?: number
    doorNums?: number[]
  }) => {
    const res = await axios.post(
      '/api/angles/calibration/start-all',
      payload,
      { baseURL: import.meta.env.VITE_SERVER_BASE_URL }
    )
    return res.data
  }

  // ✅ 초기화 핸들러 (선택된 노드들만)
  const handleInitSelected = async () => {
    if (selectedNodesForInit.length === 0) {
      alert('노드를 선택하세요.')
      return
    }
    const body =
      selectedNodesForInit.length === 1
        ? { doorNum: selectedNodesForInit[0] }
        : { doorNums: selectedNodesForInit }
    const data = await postCalibrationStart(body)
    alert(`초기화 시작: ${data?.doors?.join(', ')}`)
  }
  // ✅ 전체 선택 (토글)
  const handleSelectAll = () => {
    if (selectedNodesForInit.length === allNodes.length) {
      // 이미 전체 선택 상태면 해제
      setSelectedNodesForInit([])
    } else {
      // 전체 선택
      setSelectedNodesForInit(allNodes.map((n) => n.doorNum))
    }
  }

  return (
    <div className='grid grid-cols-12 gap-4 w-full h-screen px-4 py-4'>
      {/* =============== Angle-Nodes grid scrolling field ================ */}
      <ScrollArea className='col-span-12 md:col-span-4 overflow-auto h-full rounded-lg border border-slate-400 bg-white p-4 -mt-5 2xl:h-[95vh] w-[90%]'>

        {/* BGYR 설정 & 알람 저장 */}
        <div className='flex justify-between mb-4 gap-2 items-end'>
          {/* 정상(B) → 드롭박스 제거, 숫자 표시만 */}
          <div className='flex flex-col items-center'>
            <label className='flex items-center text-xs font-semibold mb-1 gap-1'>
              <span className='w-3 h-3 bg-blue-500 inline-block rounded-sm'></span>
              정상
            </label>
            <div className="border border-gray-400 rounded-md w-10 h-[3.1vh] flex items-center justify-center text-sm">
              {G}
            </div>
          </div>

          {[
            {
              key: 'G',
              label: '주의',
              color: 'bg-green-500',
              setter: setG,
              value: G,
            },
            {
              key: 'Y',
              label: '경고',
              color: 'bg-yellow-400',
              setter: setY,
              value: Y,
            },
            {
              key: 'R',
              label: '위험',
              color: 'bg-red-500',
              setter: setR,
              value: R,
            },
          ].map(({ key, label, color, setter, value }) => {
            const minValue = key === 'G' ? 0 : key === 'Y' ? G : Y
            return (
              <div key={key} className='flex flex-col items-center'>
                <label className='flex items-center text-xs font-semibold mb-1 gap-1'>
                  <span className={`w-3 h-3 ${color} inline-block rounded-sm`} />
                  {label}
                </label>
                <select
                  className='border border-gray-400 rounded-md px-1 text-sm'
                  value={value}
                  onChange={e => setter(Number.parseFloat(e.target.value))}
                >
                  {generateOptions(minValue).map(num => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
          <button
            className='px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors'
            onClick={() => onSetAlarmLevels({ G, Y, R })}
          >
            저장
          </button>
        </div>

        {/* 뷰 모드 */}
        <div className='flex justify-center mb-4 gap-2'>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${viewMode === 'general' ? 'bg-blue-600' : 'bg-gray-400 hover:bg-gray-500'
              }`}
            onClick={() => setViewMode('general')}
          >
            기울기
          </button>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${viewMode === 'delta' ? 'bg-purple-600' : 'bg-gray-400 hover:bg-gray-500'
              }`}
            onClick={() => setViewMode('delta')}
          >
            변화량
          </button>
          <button
            className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${viewMode === 'avgDelta' ? 'bg-green-600' : 'bg-gray-400 hover:bg-gray-500'
              }`}
            onClick={() => setViewMode('avgDelta')}
          >
            평균변화
          </button>
        </div>

        {/* ✅ 초기화 버튼 */}
        <div className="flex justify-center mb-4">
          <button
            className="w-full px-3 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600"
            onClick={() => setIsInitModalOpen(true)}
          >
            노드 초기화
          </button>
        </div>

        {/* Gateway + Node 선택 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
          <select
            className='border border-gray-400 rounded-md px-1 py-0.5 text-sm overflow-y-auto'
            value={selectedGateway}
            onChange={e => setSelectedGateway(e.target.value)}
          >
            <option value=''>전체구역</option>
            {gateways?.map(gw => (
              <option key={gw._id} value={gw.serial_number}>
                {gw.zone_name}
              </option>
            ))}
          </select>

          <select
            className='border border-gray-400 rounded-md px-1 py-1 text-sm overflow-y-auto '
            value={selectedNode}
            onChange={e =>
              setSelectedNode(
                e.target.value === '' ? '' : Number.parseInt(e.target.value)
              )
            }
          >
            <option value=''>전체노드</option>
            {[...sortedNodes]
              .sort((a, b) => a.doorNum - b.doorNum)
              .map(node => (
                <option key={node.doorNum} value={node.doorNum}>
                  {node.doorNum}
                </option>
              ))}
          </select>
        </div>

        {/* 노드 카드 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {/* 활성 노드 */}
          {aliveNodes.map(item => (
            <Card
              key={item.doorNum}
              onClick={() => handleNodeCardClick(item)}
              className={cn(
                'border border-slate-300 flex flex-col justify-center shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer relative text-gray-600',
                getNodeColorClass(item.angle_x)
              )}
            >
              <CardContent className='flex flex-col justify-center p-2 text-[14px]'>
                <div className='flex justify-between items-center mb-2 font-bold text-blue-700'>
                  <h1>노드넘버</h1>
                  <span className='font-semibold text-[16px]'>{item.doorNum}</span>
                </div>
                <div className='flex justify-between mb-1 font-medium'>
                  <p>Axis-X:</p>
                  <p>{item.angle_x}</p>
                </div>
                <div className='flex justify-between mb-1 font-medium'>
                  <p>Axis-Y:</p>
                  <p>{item.angle_y}</p>
                </div>
                <div className='flex justify-between mb-1 font-medium'>
                  <p className='mt-1'>{item.position || 'N/A'}</p>
                </div>
                <button
                  onClick={e => handleNodeDetailClick(e, item)}
                  className='mt-2 w-full flex items-center justify-center gap-2 py-1 text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                >
                  <Eye className='w-4 h-4' />
                  <span className='text-[13px]'>상세정보</span>
                </button>
              </CardContent>
            </Card>
          ))}

          {/* 비활성 노드 */}
          {deadNodes.length > 0 && (
            <div className='col-span-1 md:col-span-2 mt-6'>
              <h2 className='text-center font-bold text-gray-600 mb-3'>비활성 노드</h2>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {deadNodes.map(item => (
                  <Card
                    key={item.doorNum}
                    onClick={() => handleNodeCardClick(item)}
                    className={cn(
                      'border border-slate-300 flex flex-col justify-center shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer relative',
                      'bg-gray-400 text-gray-50 hover:bg-gray-400/70'
                    )}
                  >
                    <CardContent className='flex flex-col justify-center p-2 text-[14px]'>
                      <div className='flex justify-between items-center mb-2 font-bold'>
                        <h1>노드넘버</h1>
                        <span className='font-semibold text-[16px]'>{item.doorNum}</span>
                      </div>
                      <div className='flex justify-between mb-1 font-medium'>
                        <p>Axis-X:</p>
                        <p>{item.angle_x}</p>
                      </div>
                      <div className='flex justify-between mb-1 font-medium'>
                        <p>Axis-Y:</p>
                        <p>{item.angle_y}</p>
                      </div>
                      <div className='flex justify-between mb-1 font-medium'>
                        <p className='mt-1'>{item.position || 'N/A'}</p>
                      </div>
                      <button
                        onClick={e => handleNodeDetailClick(e, item)}
                        className='mt-2 w-full flex items-center justify-center gap-2 py-1 text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
                      >
                        <Eye className='w-4 h-4' />
                        <span className='text-[13px]'>상세정보</span>
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 중앙: Gateway + 이미지 / CSV */}
      <div className='col-span-12 md:col-span-6 flex flex-col gap-y-2 h-[40%] md:-mt-5 2xl:-mt-5'>
        <p className='text-center font-bold text-lg'>비계전도 감지 시스템</p>
        <div className='grid grid-cols-2 w-full gap-x-1 rounded-lg border border-slate-400'>
          <div className='flex flex-col items-center md:col-span-1 col-span-2 h-[27vh] rounded-md bg-gray-50 text-gray-600 '>
            <ScrollArea className='pr-3 pl-1 py-1 border-none'>
              <button
                className={`w-full mb-2 p-1 rounded-md text-[12px] font-semibold ${!selectedGateway
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-300 text-gray-700'
                  }`}
                onClick={() => setSelectedGateway('')}
              >
                전체구역
              </button>
              <div className='grid grid-cols-3 gap-2 w-full'>
                {gateways?.map((gw, index) => (
                  <div
                    onClick={() => onToggleGatewaySelection(gw)}
                    key={index}
                    className={cn(
                      'text-[12px] p-1 rounded-md flex flex-col items-center justify-center shadow-md cursor-pointer',
                      getGatewayColorClass(gw) // ✅ 노드 위험도 기반 색상 적용
                    )}
                  >
                    <span className='border-b pb-1'>{gw.zone_name}</span>
                    <span className='truncate mt-2'>gw-{gw.serial_number}</span>
                  </div>
                ))}
              </div>

            </ScrollArea>
          </div>

          <div
            onClick={() => togglePlanImg()}
            className="relative flex items-center justify-center cursor-pointer h-[26vh] w-full bg-white rounded-lg"
          >
            <img
              src={mainImageUrl}
              alt="도면 사진"
              className="max-h-full max-w-full object-contain"
            />
            <p className="absolute bottom-1 right-2 text-[12px] text-black px-2 py-0.5 rounded border border-black">
              🔹도면보기
            </p>

          </div>
        </div>

        <div className='w-full flex justify-center'>
          <div className='w-full max-w-[100%]'>
            <TotalcntCsv
              building={buildingData}
              gateways={gateways}
              angle_nodes={building_angle_nodes}
              image_url={mainImageUrl}
              togglePlanImg={togglePlanImg}
              isPlanImgOpen={isPlanImgOpen}
            />
          </div>
        </div>
      </div>

      {/* 위험 노드 표시 */}
      <ScrollArea
        className='col-span-12 md:col-span-2 overflow-auto rounded-lg border border-slate-400 bg-white p-3 -mt-5'
        style={{ height: '40%', width: '109%' }}
      >
        <div className='flex flex-col gap-2'>
          {dangerAngleNodes && dangerAngleNodes.length ? (
            dangerAngleNodes.map(item => (
              <div
                key={item._id}
                className='text-center py-1 bg-red-500 border rounded-md'
              >
                <p className='text-white text-[16px]'>
                  노드 {item.doorNum}번 경고
                </p>
              </div>
            ))
          ) : (
            <div className='p-2 bg-blue-500 border rounded-md'>
              <p className='text-center text-white text-[16px]'>
                지금 위험이 없습니다.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Node Detail Modal */}
      <NodeDetailModal
        isOpen={isModalOpen}
        node={selectedNodeForModal}
        onClose={() => setIsModalOpen(false)}
      />

      {/* ✅ 초기화 모달 */}
      {isInitModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[90%] max-w-lg">
            <h2 className="text-lg font-bold mb-4">노드 초기화</h2>
            <div className="flex flex-col gap-3 mb-4">
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 bg-blue-500 text-white rounded-md"
              >
                {selectedNodesForInit.length === allNodes.length
                  ? '전체 선택 해제'
                  : '전체 선택'} ({selectedNodesForInit.length}/{allNodes.length})
              </button>
              <button
                onClick={handleInitSelected}
                className="px-3 py-2 bg-red-500 text-white rounded-md"
              >
                초기화
              </button>
            </div>

            {/* 체크박스 리스트 */}
            <div className="max-h-40 overflow-y-auto border p-2 rounded">
              {allNodes.map((node) => (
                <label key={node.doorNum} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={node.doorNum}
                    checked={selectedNodesForInit.includes(node.doorNum)}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setSelectedNodesForInit((prev) =>
                        e.target.checked
                          ? [...prev, val]
                          : prev.filter((n) => n !== val)
                      )
                    }}
                    className="accent-blue-500 w-4 h-4"
                  />
                  Node-{node.doorNum}
                </label>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsInitModalOpen(false)}
                className="px-3 py-1 bg-gray-400 text-white rounded-md"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}

export default AngleNodeScroll