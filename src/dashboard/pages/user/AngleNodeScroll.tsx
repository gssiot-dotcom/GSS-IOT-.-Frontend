/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import TotalcntCsv from '@/dashboard/components/shared-dash/TotalnctCSV'
import { cn } from '@/lib/utils'
import { IAngleNode, IBuilding, IGateway } from '@/types/interfaces'
import { Eye } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { NodeDetailModal } from '@/dashboard/components/shared-dash/angleNodeDetail'

// ✅ 편집 모달 (이미 만든 컴포넌트가 있다고 가정)
import { NodesEditModal, GatewaysEditModal } from '@/dashboard/components/shared-dash/productEdit'

import axios from 'axios'

interface AlertLog {
  createdAt: string
  doorNum: number
  metric: string
  value: number
  threshold: number
  level: string
}

interface Props {
  building_angle_nodes: IAngleNode[]
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
  alertLogs: AlertLog[] // ✅ 부모에서 내려온 빌딩별 로그 데이터
}

const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'
// 빌딩명 폴더: 공백 -> '+'
const toS3Folder = (name: string) => encodeURIComponent(name).replace(/%20/g, '+')
// 안전 인코딩
const toKeyPart = (s?: string | number) => (s == null ? '' : encodeURIComponent(String(s).trim()))
// 파일명에서 슬래시 제거
const sanitizePosForFilename = (s?: string) => (s ?? '').trim().replace(/[\/\\]/g, '')

// 공통 S3 URL 빌더 (설치구간_게이트웨이시리얼_노드번호.jpg)
const buildS3Url = (node?: IAngleNode | null, buildingName?: string) => {
  if (!node || !buildingName) return undefined
  const folder = toS3Folder(buildingName)
  const pos = encodeURIComponent(sanitizePosForFilename(node.position))
  const gw = toKeyPart(node.gateway_id?.serial_number)
  const door = toKeyPart(node.doorNum)
  if (!pos || !gw || !door) return undefined
  return `${S3_BASE_URL}/${folder}/${pos}_${gw}_${door}.jpg`
}

const AngleNodeScroll = ({
  building_angle_nodes,
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
  alertLogs,
}: Props) => {
  const [selectedGateway, setSelectedGateway] = useState<string>('')
  const [selectedNode, setSelectedNode] = useState<number | ''>('')
  const [isModalOpen, setIsModalOpen] = useState(true)
  const [selectedNodeForModal, setSelectedNodeForModal] = useState<any>(null)
  const [isPlanImgOpen, setIsPlanImgOpen] = useState(false)

  // ✅ Settings / Edit 모달 상태
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isNodesEditOpen, setIsNodesEditOpen] = useState(false)
  const [isGatewaysEditOpen, setIsGatewaysEditOpen] = useState(false)

  // ✅ 초기화 모달 관련
  const [isInitModalOpen, setIsInitModalOpen] = useState(false)
  const [selectedNodesForInit, setSelectedNodesForInit] = useState<number[]>([])

  const IMG_SERVER_BASE_URL = `${import.meta.env.VITE_SERVER_BASE_URL}/static/images/`

  // ✅ 오늘 날짜 로그만 필터링 (UTC → KST)
  const todayLogs = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
    return alertLogs.filter((log) => {
      const logStr = new Date(log.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
      return logStr === todayStr
    })
  }, [alertLogs])

  // ============= 이미지 경로 유틸 ============= //
  const buildImgUrl = (file?: string) => {
    if (!file) return ''
    const cleanBase = IMG_SERVER_BASE_URL.replace(/\/$/, '')
    const cleanFile = file.replace(/^\/+/, '')
    return `${cleanBase}/${encodeURIComponent(cleanFile)}`
  }

  // 🔽 선택된 빌딩명 (NodeDetailModal, 중앙 이미지 S3 모두 동일 규칙)
  const selectedBuildingName = useMemo(() => {
    return (
      buildingData?.building_name ||
      (buildingData as any)?.name ||
      (buildingData as any)?.buildingName ||
      ''
    )
  }, [buildingData])

  const planImgUrl = useMemo(
    () => buildImgUrl(buildingData?.building_plan_img),
    [buildingData?.building_plan_img]
  )

  // ✅ 게이트웨이의 "마지막에서 2번째 노드"
  const secondLastNodeOfSelectedGw = useMemo(() => {
    if (!selectedGateway) return null
    const gwNodes = building_angle_nodes.filter(
      (n) => n.gateway_id?.serial_number === selectedGateway
    )
    if (gwNodes.length < 2) return gwNodes[0] || null
    return gwNodes[gwNodes.length - 2]
  }, [selectedGateway, building_angle_nodes])

  // ✅ 선택된 노드 객체
  const selectedNodeObj = useMemo(() => {
    if (selectedNode === '' || typeof selectedNode !== 'number') return null
    return building_angle_nodes?.find((n) => n.doorNum === selectedNode) ?? null
  }, [selectedNode, building_angle_nodes])

  const mainImageUrl = useMemo(() => {
    const s3Selected = buildS3Url(selectedNodeObj, selectedBuildingName)
    const legacySelected = selectedNodeObj?.angle_node_img ? buildImgUrl(selectedNodeObj.angle_node_img) : ''

    const s3Gateway = buildS3Url(secondLastNodeOfSelectedGw, selectedBuildingName)
    const legacyGateway = secondLastNodeOfSelectedGw?.angle_node_img
      ? buildImgUrl(secondLastNodeOfSelectedGw.angle_node_img)
      : ''

    return s3Selected || legacySelected || s3Gateway || legacyGateway || planImgUrl
  }, [selectedNodeObj, secondLastNodeOfSelectedGw, selectedBuildingName, planImgUrl])

  // 정렬(절대값 큰 순)
  const sortedNodes = useMemo(() => {
    if (!building_angle_nodes?.length) return []
    return [...building_angle_nodes].sort((a, b) => {
      const ax = Math.abs(a.angle_x ?? 0)
      const bx = Math.abs(b.angle_x ?? 0)
      return bx - ax
    })
  }, [building_angle_nodes])

  // ✅ 선택된 게이트웨이에 속한 노드만 (구역 미선택 시 전체)
  const nodesUnderSelectedGateway = useMemo(() => {
    if (!selectedGateway) return sortedNodes
    return sortedNodes.filter(
      (node) => node.gateway_id?.serial_number === selectedGateway
    )
  }, [sortedNodes, selectedGateway])



  // 필터
  const nodesToDisplay = useMemo(() => {
    let nodes = [...sortedNodes]
    if (selectedGateway) {
      nodes = nodes.filter((node) => node.gateway_id?.serial_number === selectedGateway)
    }
    if (selectedNode !== '') {
      nodes = nodes.filter((node) => node.doorNum === selectedNode)
    }
    return nodes
  }, [sortedNodes, selectedGateway, selectedNode])

  const aliveNodes = nodesToDisplay.filter((node) => node.node_alive)
  const deadNodes = nodesToDisplay.filter((node) => !node.node_alive)

  // 색상
  const getNodeColorClass = (x: number) => {
    const absX = Math.abs(x)
    if (absX >= R) return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'
    if (absX >= Y) return 'bg-gradient-to-r from-yellow-50 to-yellow-200 hover:to-yellow-300'
    if (absX >= G) return 'bg-gradient-to-r from-green-50 to-green-200 hover:to-green-300'
    if (absX < G) return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
    return 'bg-gray-100'
  }

  const getGatewayColorClass = (gw: IGateway) => {
    const gwNodes = building_angle_nodes.filter(
      (node) => node.gateway_id?.serial_number === gw.serial_number
    )
    if (!gwNodes.length) return 'bg-gray-300 text-gray-700'
    const worstNode = [...gwNodes].sort((a, b) => Math.abs(b.angle_x) - Math.abs(a.angle_x))[0]
    if (!gw.gateway_alive) return 'bg-gray-500/90 text-gray-50 hover:bg-gray-600'
    return getNodeColorClass(worstNode.angle_x) + ' text-gray-800'
  }

  const generateOptions = (min: number) => {
    return Array.from({ length: 21 }, (_, i) => Number.parseFloat((i * 0.5).toFixed(1))).filter(
      (num) => num >= min
    )
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

  // ✅ 도면 업로드
  const planInputRef = useRef<HTMLInputElement | null>(null)
  const onClickPlanUpload = () => planInputRef.current?.click()

  const uploadPlanImage = async (file: File) => {
    if (!buildingData?._id) {
      alert('빌딩 ID가 없습니다.')
      return
    }
    try {
      const fd = new FormData()
      fd.append('image', file, file.name)
      // 🔧 실제 API에 맞게 경로 수정하세요
      await axios.put(
        `${import.meta.env.VITE_SERVER_BASE_URL}/product/building/${buildingData._id}/plan`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      alert('도면이 업로드되었습니다.')
    } catch (e) {
      console.error(e)
      alert('도면 업로드 중 오류가 발생했습니다.')
    }
  }

  // ✅ 초기화 API
  const postCalibrationStart = async (payload: { doorNum?: number; doorNums?: number[] }) => {
    const res = await axios.post('/api/angles/calibration/start-all', payload, {
      baseURL: import.meta.env.VITE_SERVER_BASE_URL,
    })
    return res.data
  }

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

  const handleSelectAll = () => {
    if (selectedNodesForInit.length === allNodes.length) {
      setSelectedNodesForInit([])
    } else {
      setSelectedNodesForInit(allNodes.map((n) => n.doorNum))
    }
  }

  function formatKSTTime(dateStr: string) {
    const d = new Date(dateStr)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${month}월${day}일 ${h}시${m}분`
  }

  function formatMetricLabel(metric: string) {
    const lower = metric?.toLowerCase?.()
    if (lower === 'angle_x') return 'Axis-X'
    if (lower === 'angle_y') return 'Axis-Y'
    return metric ?? ''
  }

  const renderPositionAndGateway = (item: IAngleNode) => (
    <>
      <div className='flex flex-col mb-1 font-medium'>
        <p className='truncate max-w-full'>{item.position || 'N/A'}</p>
      </div>
      <div className='flex flex-col mb-1 font-medium'>
        <p className='truncate max-w-full'>
          ({item.gateway_id?.serial_number ? `gw-${item.gateway_id.serial_number}` : 'N/A'})
        </p>
      </div>
    </>
  )

  const gatewayDownRows = useMemo(
    () =>
      (gateways ?? [])
        .filter((gw) => gw && gw.gateway_alive === false)
        .map((gw) => ({
          createdAt: gw.lastSeen ? new Date(gw.lastSeen).toISOString() : new Date().toISOString(),
          serial: gw.serial_number,
          zone: gw.zone_name ?? 'N/A',
        })),
    [gateways]
  )

  return (
    <div className='grid grid-cols-12 gap-4 w-full h-screen px-4 py-4 mt-2'>
      {/* =============== Angle-Nodes grid ================ */}
      <ScrollArea className='col-span-12 md:col-span-4 overflow-auto h-full rounded-lg border border-slate-400 bg-white p-4 -mt-5 lg:h-[96%] 2xl:h-[100%] w-[90%]'>
        {/* BGYR 설정 & 알람 저장 */}
        <div className='flex justify-between mb-4 gap-2 items-end'>
          {/* 정상(B) */}
          <div className='flex flex-col items-center 3xl:items-center'>
            <label className='flex items-center lg:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1'>
              <span className='w-3 h-3 bg-blue-500 inline-block rounded-sm'></span>
              정상
            </label>
            <div className='border border-gray-400 rounded-md w-10 h-[3.1vh] flex items-center justify-center 2xl:w-[2.6vw] 2xl:h-[2.3vh] 2xl:text-base'>
              <span className='lg:text-[11px] 2xl:text-xs'>{G}</span>
              <span className='ml-1 mt-[0.1vh] lg:text-[11px] 2xl:text-xs 3xl:text-xs'>이하</span>
            </div>
          </div>

          {[
            { key: 'G', label: '주의', color: 'bg-green-500', setter: setG, value: G },
            { key: 'Y', label: '경고', color: 'bg-yellow-400', setter: setY, value: Y },
            { key: 'R', label: '위험', color: 'bg-red-500', setter: setR, value: R },
          ].map(({ key, label, color, setter, value }) => {
            const minValue = key === 'G' ? 0 : key === 'Y' ? G : Y
            return (
              <div key={key} className='flex flex-col items-center'>
                <label className='flex items-center lg:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1'>
                  <span className={`w-3 h-3 ${color} inline-block rounded-sm`} />
                  {label}
                </label>
                <select
                  className='border border-gray-400 rounded-md px-1 text-sm'
                  value={value}
                  onChange={(e) => setter(Number.parseFloat(e.target.value))}
                >
                  {generateOptions(minValue).map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}

          <div className='flex flex-col items-center ml-1'>
            <label className='flex items-center lg:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1 text-gray-700'>
              <span className='w-3 h-3 bg-gray-500 inline-block rounded-sm' />
              전원
            </label>

            {/* ⬇️ 변경: 테두리 더 진하게 + 가로폭 살짝 줄임 */}
            <div className='border border-gray-500 rounded-md px-2 min-w-[2rem] h-[3.1vh] flex items-center justify-center lg:text-[11px] 2xl:text-xs bg-gray-200 text-gray-700 2xl:w-[2.2vw] 2xl:h-[2.3vh] 2xl:text-base font-bold'>
              OFF
            </div>
          </div>


          <button
            className='px-2 2xl:p-2 py-1 bg-blue-600 text-white rounded-lg lg:text-[10px] 2xl:text-xs font-semibold hover:bg-blue-700 transition-colors'
            onClick={() => onSetAlarmLevels({ G, Y, R })}
          >
            저장
          </button>
        </div>

        {/* 뷰 모드 + 설정 */}
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
            className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${viewMode === 'avgDelta' ? 'bg-orange-400' : 'bg-gray-400 hover:bg-gray-500'
              }`}
            onClick={() => setViewMode('avgDelta')}
          >
            평균변화
          </button>

          {/* ✅ 설정 버튼 */}
          <button
            className='px-3 py-1 rounded-lg font-bold text-xs text-white bg-gray-700 hover:bg-gray-800 transition-colors'
            onClick={() => setIsSettingsOpen(true)}
          >
            설정
          </button>
        </div>

        {/* Gateway + Node 선택 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
          <select
            className='border border-gray-400 rounded-md px-1 py-0.5 text-sm overflow-y-auto'
            value={selectedGateway}
            onChange={(e) => setSelectedGateway(e.target.value)}
          >
            <option value=''>전체구역</option>
            {gateways?.map((gw) => (
              <option key={gw._id} value={gw.serial_number}>
                {gw.zone_name}
              </option>
            ))}
          </select>

          <select
            className='border border-gray-400 rounded-md px-1 py-1 text-sm overflow-y-auto'
            value={selectedNode}
            onChange={(e) =>
              setSelectedNode(e.target.value === '' ? '' : Number.parseInt(e.target.value))
            }
          >
            <option value=''>전체노드</option>
            {[...nodesUnderSelectedGateway]
              .sort((a, b) => a.doorNum - b.doorNum)
              .map((node) => (
                <option key={node.doorNum} value={node.doorNum}>
                  {node.doorNum}
                </option>
              ))}
          </select>

        </div>

        {/* 노드 카드 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {/* 활성 노드 */}
          {aliveNodes.map((item) => (
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
                {renderPositionAndGateway(item)}
                <button
                  onClick={(e) => handleNodeDetailClick(e, item)}
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
                {deadNodes.map((item) => (
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
                        onClick={(e) => handleNodeDetailClick(e, item)}
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
      <div className='col-span-12 md:col-span-5 flex flex-col gap-y-2 h-[40%] md:-mt-5 2xl:-mt-5 md:-ml-[2.4vw] 2xl:-ml-[2.4vw] 3xl:-ml-[2.4vw]'>
        <div className='grid grid-cols-2 w-full gap-x-1 rounded-lg border border-slate-400'>
          <div className='flex flex-col items-center md:col-span-1 col-span-2 h-[27vh] rounded-md bg-gray-50 text-gray-600 '>
            <ScrollArea className='pr-3 pl-1 py-1 border-none'>
              <button
                className={`w-full mb-2 p-1 rounded-md text-[12px] font-semibold ${!selectedGateway ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'
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
                      getGatewayColorClass(gw)
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
            className='relative flex items-center justify-center cursor-pointer h-[26vh] w-full bg-white rounded-lg'
          >
            <img
              src={mainImageUrl}
              alt='도면 사진'
              className='max-h-full max-w-full object-contain'
              onError={(e) => {
                ; (e.currentTarget as HTMLImageElement).src = planImgUrl || '/no-image.png'
              }}
            />
            <p className='absolute bottom-1 right-2 text-[12px] text-black px-2 py-0.5 rounded border border-black'>
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

      {/* 우측: 로그 */}
      <ScrollArea
        className='col-span-12 md:col-span-3 overflow-auto rounded-lg border border-slate-400 bg-white p-3 -mt-5 h-[36%] 2xl:h-[39%] 3xl:h-[38.4%] w-[112%]'>
        <div className='flex flex-col gap-2 text-sm'>
          {/* 게이트웨이 다운 */}
          {gatewayDownRows.length > 0 && (
            <>
              {gatewayDownRows.map((g) => (
                <div
                  key={g.serial}
                  className='px-2 py-1 rounded-lg bg-gray-400 text-white font-semibold lg:text-[11px] 2xl:text-[19px]'
                >
                  {`${formatKSTTime(g.createdAt)} | gw-${g.serial} | ${g.zone}`}
                </div>
              ))}
              <hr className='opacity-40' />
            </>
          )}

          {/* 알림 로그 */}
          {todayLogs && todayLogs.length ? (
            [...todayLogs]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((log, idx) => {
                const bg =
                  log.level === 'yellow'
                    ? 'bg-yellow-200'
                    : log.level === 'red'
                      ? 'bg-red-400'
                      : 'bg-blue-200'
                return (
                  <div
                    key={idx}
                    className={`px-2 py-1 rounded ${bg} lg:text-[13px] 2xl:text-[17px] 3xl:text-[18px] font-medium`}
                  >
                    {`${formatKSTTime(log.createdAt)} | 노드: ${log.doorNum} | ${formatMetricLabel(
                      log.metric
                    )}: ${log.value}`}
                  </div>
                )
              })
          ) : (
            <div className='p-2 bg-blue-500 border rounded-md'>
              <p className='text-center text-white text-[16px]'>오늘은 위험 로그가 없습니다.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Node Detail Modal */}
      <NodeDetailModal
        isOpen={isModalOpen}
        node={selectedNodeForModal}
        onClose={() => setIsModalOpen(false)}
        buildingName={selectedBuildingName}
      />

      {/* ✅ 설정 모달 */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>설정</DialogTitle>
          </DialogHeader>

          <div className='grid grid-cols-2 gap-3'>
            {/* 노드 초기화 */}
            <button
              className='px-3 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600'
              onClick={() => {
                setIsSettingsOpen(false)
                setIsInitModalOpen(true)
              }}
            >
              노드 초기화
            </button>

            {/* 도면 업로드 */}
            <button
              className='px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700'
              onClick={onClickPlanUpload}
            >
              도면 업로드
            </button>

            {/* 노드 수정 */}
            <button
              className='px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700'
              onClick={() => {
                setIsSettingsOpen(false)
                setIsNodesEditOpen(true)
              }}
            >
              노드 수정
            </button>

            {/* 게이트웨이 수정 */}
            <button
              className='px-3 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700'
              onClick={() => {
                setIsSettingsOpen(false)
                setIsGatewaysEditOpen(true)
              }}
            >
              게이트웨이 수정
            </button>
          </div>

          {/* 숨김 파일 입력 */}
          <input
            ref={planInputRef}
            type='file'
            accept='image/*'
            className='hidden'
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadPlanImage(f)
              e.currentTarget.value = ''
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ✅ Nodes/Gateways Edit Modals */}
      {isNodesEditOpen && (
        <NodesEditModal
          isOpen={isNodesEditOpen}
          onClose={() => setIsNodesEditOpen(false)}
          angleNodes={building_angle_nodes}
          onSave={() => setIsNodesEditOpen(false)}
          buildingName={selectedBuildingName}
        />
      )}
      {isGatewaysEditOpen && (
        <GatewaysEditModal
          isOpen={isGatewaysEditOpen}
          onClose={() => setIsGatewaysEditOpen(false)}
          gatewyas={gateways}
          onSave={() => setIsGatewaysEditOpen(false)}
        />
      )}

      {/* ✅ 초기화 모달 */}
      {isInitModalOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white p-6 rounded-lg w-[90%] max-w-lg'>
            <h2 className='text-lg font-bold mb-4'>노드 초기화</h2>
            <div className='flex flex-col gap-3 mb-4'>
              <button
                onClick={handleSelectAll}
                className='px-3 py-2 bg-blue-500 text-white rounded-md'
              >
                {selectedNodesForInit.length === allNodes.length ? '전체 선택 해제' : '전체 선택'} (
                {selectedNodesForInit.length}/{allNodes.length})
              </button>
              <button onClick={handleInitSelected} className='px-3 py-2 bg-red-500 text-white rounded-md'>
                초기화
              </button>
            </div>

            {/* 체크박스 리스트 */}
            <div className='max-h-40 overflow-y-auto border p-2 rounded'>
              {allNodes.map((node) => (
                <label key={node.doorNum} className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    value={node.doorNum}
                    checked={selectedNodesForInit.includes(node.doorNum)}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setSelectedNodesForInit((prev) =>
                        e.target.checked ? [...prev, val] : prev.filter((n) => n !== val)
                      )
                    }}
                    className='accent-blue-500 w-4 h-4'
                  />
                  Node-{node.doorNum}
                </label>
              ))}
            </div>

            <div className='flex justify-end mt-4'>
              <button onClick={() => setIsInitModalOpen(false)} className='px-3 py-1 bg-gray-400 text-white rounded-md'>
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
