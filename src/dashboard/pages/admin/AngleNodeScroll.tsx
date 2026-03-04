/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Download from '@/dashboard/components/shared-dash/download'
import { cn } from '@/lib/utils'
import { IAngleNode, IBuilding, IGateway } from '@/types/interfaces'
import { Eye } from 'lucide-react'
import { useMemo, useState, useEffect, useRef } from 'react'
import { NodeDetailModal } from '@/dashboard/components/shared-dash/angleNodeDetail'
import Draggable from 'react-draggable'

// ✅ 편집 모달
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
  buildingId?: string
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
  viewMode: 'general' | 'delta' | 'avgDelta' | 'top6'
  setViewMode: (mode: 'general' | 'delta' | 'avgDelta' | 'top6') => void
  allNodes: IAngleNode[]
  onSetAlarmLevels: (levels: { G: number; Y: number; R: number }) => void
  alertLogs: AlertLog[]
  onToggleSaveStatus?: (doorNum: number, next: boolean) => Promise<void> | void
  onTop6Change?: (doorNums: number[]) => void
}

/** ================================
 *   S3 유틸
 *  ================================ */
const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'
const toS3Folder = (name: string) => encodeURIComponent(name).replace(/%20/g, '+')
const toKeyPart = (s?: string | number) => (s == null ? '' : encodeURIComponent(String(s).trim()))
const sanitizePosForFilename = (s?: string) => (s ?? '').trim().replace(/[\/\\]/g, '')

const buildS3Url = (node?: IAngleNode | null, buildingName?: string) => {
  if (!node || !buildingName) return undefined
  const folder = toS3Folder(buildingName)
  const pos = encodeURIComponent(sanitizePosForFilename((node as any).position))
  const gw = toKeyPart((node as any)?.gateway_id?.serial_number)
  const door = toKeyPart((node as any).doorNum)
  if (!pos || !gw || !door) return undefined
  return `${S3_BASE_URL}/${folder}/${pos}_${gw}_${door}.jpg`
}

const buildPlanS3Url = (buildingName?: string) => {
  if (!buildingName) return undefined
  const folder = toS3Folder(buildingName)
  return `${S3_BASE_URL}/${folder}/전체도면.png`
}

/** ================================
 *   calibrated 값 getter
 *  ================================ */
const getX = (n: IAngleNode) =>
  (n as any).calibrated_x ?? (n as any).calibratedX ?? (n as any).angle_x ?? 0
const getY = (n: IAngleNode) =>
  (n as any).calibrated_y ?? (n as any).calibratedY ?? (n as any).angle_y ?? 0

/** ================================
 *   컴포넌트
 *  ================================ */
const AngleNodeScroll = ({
  buildingId,
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
  onToggleSaveStatus,
  onTop6Change,
}: Props) => {
  // ✅ base path 고려한 no-image 경로 (Vite)
  const NO_IMAGE = `${import.meta.env.BASE_URL}no-image.png`

  // 🔹 로컬 노드 상태
  const [localNodes, setLocalNodes] = useState<IAngleNode[]>(building_angle_nodes)
  useEffect(() => {
    setLocalNodes(building_angle_nodes)
  }, [building_angle_nodes])

  const [selectedGateway, setSelectedGateway] = useState<string>('')
  const [selectedNode, setSelectedNode] = useState<number | '' | 'dead'>('')

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

  // ✅ 이미지 실패 URL 캐시: 한 번 실패한 URL은 다시 candidates에서 제외
  const failedImgUrlSetRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    failedImgUrlSetRef.current.clear()
  }, [buildingData?._id])

  /** ================================
   * ✅ (핵심) GATEWAY 타입만 사용
   * ================================ */
  const gatewaysOnly = useMemo(() => {
    return (gateways ?? []).filter((gw: any) => {
      const type = String(gw?.gateway_type ?? '').toUpperCase()
      if (type !== 'GATEWAY') return false
      if (gw?.building_id == null) return false
      return String(gw.building_id) === String(buildingData?._id ?? '')
    })
  }, [gateways, buildingData?._id])

  // ✅ 오늘 날짜 로그만 필터링 (UTC → KST)
  const todayLogs = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
    return alertLogs.filter(log => {
      const logStr = new Date(log.createdAt).toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
      })
      return logStr === todayStr
    })
  }, [alertLogs])

  // 🔽 선택된 빌딩명
  const selectedBuildingName = useMemo(() => {
    return (
      buildingData?.building_name ||
      (buildingData as any)?.name ||
      (buildingData as any)?.buildingName ||
      ''
    )
  }, [buildingData])

  // ✅ S3 전체도면 URL (png 기본)
  const [planImgUrl, setPlanImgUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    setPlanImgUrl(buildPlanS3Url(selectedBuildingName))
  }, [selectedBuildingName])

  // ✅ 게이트웨이의 "마지막에서 2번째 노드"
  const secondLastNodeOfSelectedGw = useMemo(() => {
    if (!selectedGateway) return null
    const gwNodes = localNodes.filter(
      n => (n as any)?.gateway_id?.serial_number === selectedGateway,
    )
    if (gwNodes.length < 2) return gwNodes[0] || null
    return gwNodes[gwNodes.length - 2]
  }, [selectedGateway, localNodes])

  // ✅ 선택된 노드 객체
  const selectedNodeObj = useMemo(() => {
    if (selectedNode === '' || typeof selectedNode !== 'number') return null
    return localNodes.find(n => (n as any).doorNum === selectedNode) ?? null
  }, [selectedNode, localNodes])

  /**
   * ✅ 중앙 이미지 후보 (노드 → 게이트웨이 → 전체도면 → NO_IMAGE)
   * ✅ 단, 한 번 실패한 URL은 제외해서 재시도 방지
   */
  const mainImageUrl = useMemo(() => {
    const candidates = [
      buildS3Url(selectedNodeObj, selectedBuildingName),
      buildS3Url(secondLastNodeOfSelectedGw, selectedBuildingName),
      planImgUrl,
      NO_IMAGE,
    ].filter(Boolean) as string[]

    const failed = failedImgUrlSetRef.current
    return candidates.find(u => !failed.has(u)) || NO_IMAGE
  }, [selectedNodeObj, secondLastNodeOfSelectedGw, selectedBuildingName, planImgUrl, NO_IMAGE])

  /** ================================
   *  ✅ 정렬 기준: calibrated_x 우선
   *  ================================ */
  const sortedNodes = useMemo(() => {
    if (!localNodes?.length) return []
    return [...localNodes].sort((a, b) => {
      const ax = Math.abs(getX(a))
      const bx = Math.abs(getX(b))
      return bx - ax
    })
  }, [localNodes])

  /** ✅ 상위 6개는 "활성 노드만" 기준 */
  const top6AliveDoorNums = useMemo(() => {
    return sortedNodes
      .filter(n => (n as any).node_alive === true)
      .slice(0, 6)
      .map(n => (n as any).doorNum)
      .filter(Boolean)
  }, [sortedNodes])

  // ✅ 선택된 게이트웨이에 속한 노드만
  const nodesUnderSelectedGateway = useMemo(() => {
    if (!selectedGateway) return sortedNodes
    return sortedNodes.filter(node => (node as any)?.gateway_id?.serial_number === selectedGateway)
  }, [sortedNodes, selectedGateway])

  // 필터
  const nodesToDisplay = useMemo(() => {
    let nodes = [...sortedNodes]
    if (selectedGateway) {
      nodes = nodes.filter(node => (node as any)?.gateway_id?.serial_number === selectedGateway)
    }

    if (selectedNode === 'dead') {
      nodes = nodes.filter(node => !(node as any).node_alive)
    } else if (selectedNode !== '' && typeof selectedNode === 'number') {
      nodes = nodes.filter(node => (node as any).doorNum === selectedNode)
    }
    return nodes
  }, [sortedNodes, selectedGateway, selectedNode])

  const aliveNodes = nodesToDisplay.filter(node => (node as any).node_alive)
  const deadNodes = nodesToDisplay.filter(node => !(node as any).node_alive)

  // 색상
  const getNodeColorClass = (x: number) => {
    const absX = Math.abs(x)
    if (absX >= R) return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'
    if (absX >= Y) return 'bg-gradient-to-r from-yellow-50 to-yellow-200 hover:to-yellow-300'
    if (absX >= G) return 'bg-gradient-to-r from-green-50 to-green-200 hover:to-green-300'
    if (absX < G) return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
    return 'bg-gray-100'
  }

  /** ================================
   *  ✅ 게이트웨이 색상 기준
   *  ================================ */
  const getGatewayColorClass = (gw: IGateway) => {
    if (!(gw as any).gateway_alive) return 'bg-gray-500/90 text-gray-50 hover:bg-gray-600'

    const activeNodes = localNodes.filter(
      node =>
        (node as any)?.gateway_id?.serial_number === (gw as any).serial_number &&
        (node as any).node_alive === true,
    )

    if (!activeNodes.length) return 'bg-gray-300 text-gray-700'

    const worstActive = [...activeNodes].sort((a, b) => Math.abs(getX(b)) - Math.abs(getX(a)))[0]
    return getNodeColorClass(getX(worstActive)) + ' text-gray-800'
  }

  const generateOptions = (min: number) => {
    return Array.from({ length: 21 }, (_, i) => Number.parseFloat((i * 0.5).toFixed(1))).filter(
      num => num >= min,
    )
  }

  const handleNodeCardClick = (node: any) => {
    onSelectNode(node.doorNum)
  }

  const handleNodeDetailClick = (e: any, node: any) => {
    e.stopPropagation()
    setSelectedNodeForModal(node)
    setIsModalOpen(true)
  }

  const togglePlanImg = () => {
    setIsPlanImgOpen(!isPlanImgOpen)
  }

  const onToggleGatewaySelection = (gateway: IGateway) => {
    setSelectedGateway((gateway as any).serial_number)
    setSelectedNode('')
  }

  // ✅ 초기화 API
  const postCalibrationStart = async (payload: { doorNum?: number; doorNums?: number[] }) => {
    const res = await axios.post('/angles/calibration/start-all', payload, {
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
      setSelectedNodesForInit(allNodes.map(n => (n as any).doorNum))
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
    if (lower === 'calibrated_x') return 'Axis-X'
    if (lower === 'calibrated_y') return 'Axis-Y'
    return metric ?? ''
  }

  const renderPositionAndGateway = (item: IAngleNode) => (
    <>
      <div className="flex flex-col mb-0.5 md:mb-1 font-medium">
        <p className="truncate max-w-full">{(item as any).position || 'N/A'}</p>
      </div>
      <div className="flex flex-col mb-0.5 md:mb-1 font-medium">
        <p className="truncate max-w-full">
          ({(item as any)?.gateway_id?.serial_number ? `gw-${(item as any).gateway_id.serial_number}` : 'N/A'})
        </p>
      </div>
    </>
  )

  /** ================================
   * ✅ 게이트웨이 다운 로그도 "GATEWAY 타입만"
   * ================================ */
  const gatewayDownRows = useMemo(
    () =>
      (gatewaysOnly ?? [])
        .filter(gw => gw && (gw as any).gateway_alive === false)
        .map(gw => ({
          createdAt: (gw as any).lastSeen
            ? new Date((gw as any).lastSeen).toISOString()
            : new Date().toISOString(),
          serial: (gw as any).serial_number,
          zone: (gw as any).zone_name ?? 'N/A',
        })),
    [gatewaysOnly],
  )

  // ▼▼▼ 연속(순차) 같은 노드 로그를 묶기 + 접기/펼치기 상태 ▼▼▼
  const groupedTodayLogs = useMemo(() => {
    const arr = [...(todayLogs ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    const groups: Array<{ doorNum: number; items: AlertLog[] }> = []
    let cur: { doorNum: number; items: AlertLog[] } | null = null

    for (const log of arr) {
      if (!cur || cur.doorNum !== log.doorNum) {
        if (cur) groups.push(cur)
        cur = { doorNum: log.doorNum, items: [log] }
      } else {
        cur.items.push(log)
      }
    }
    if (cur) groups.push(cur)
    return groups
  }, [todayLogs])

  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({})
  const toggleGroup = (idx: number) => setOpenGroups(p => ({ ...p, [idx]: !p[idx] }))

  const logBg = (level: string) =>
    level === 'yellow' ? 'bg-yellow-200' : level === 'red' ? 'bg-red-400' : 'bg-blue-200'

  // ✅ 리스트가 갱신될 때, 모달이 열려있고 선택 노드가 있으면 최신 객체로 갈아끼움
  useEffect(() => {
    if (!isModalOpen || !selectedNodeForModal) return
    const fresh = localNodes.find(n => (n as any).doorNum === selectedNodeForModal.doorNum)
    if (fresh) setSelectedNodeForModal(fresh)
  }, [localNodes, isModalOpen, selectedNodeForModal?.doorNum])

  const PlanImageModal = ({
    imageUrl,
    buildingName,
    onClose,
  }: {
    imageUrl: string | undefined
    buildingName?: string
    onClose: () => void
  }) => {
    if (!imageUrl) return null
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center">
        <Draggable handle=".drag-handle">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-[92vw] max-h-[88vh] overflow-hidden">
            <div className="drag-handle cursor-move bg-gray-100 px-4 py-2 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{buildingName || '도면'}</h3>
                <button
                  className="px-3 py-1 rounded bg-gray-800 text-white text-sm hover:bg-gray-700"
                  onClick={onClose}
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="p-3 bg-white">
              <img
                src={imageUrl}
                alt="전체 도면"
                className="max-h-[75vh] w-auto object-contain select-none"
                draggable={false}
              />
            </div>
          </div>
        </Draggable>
      </div>
    )
  }

  useEffect(() => {
    if (viewMode !== 'top6') return
    onTop6Change?.(top6AliveDoorNums)
  }, [viewMode, top6AliveDoorNums, onTop6Change])

  useEffect(() => {
    console.log('AngleNodeScroll buildingId:', buildingId, 'buildingData._id:', buildingData?._id)
  }, [buildingId, buildingData?._id])

  return (
    /**
     * ✅ 레이아웃 정책
     * - md 이상: 3개(좌/중앙/우) 한 화면 고정(부모가 overflow-hidden일 때), 각 ScrollArea 내부 스크롤
     * - md 이하: 중앙(hidden) 제거 + 좌/우만 세로로 쌓이고 페이지 스크롤 가능
     */
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 w-full px-1.5 md:px-4 py-3 md:py-4 mt-2 md:h-[calc(100vh-24px)] 2xl:h-[calc(100vh-34px)]">
      {/* ================= 좌측: 노드 카드 영역 ================= */}
      <ScrollArea
        className={cn(
          'col-span-1 md:col-span-4 2xl:col-span-3',
          'overflow-auto rounded-lg border border-slate-400 bg-white overflow-x-hidden',
          // ✅ 모바일에서 패딩/마진/높이 더 컴팩트 + 가로 오버플로우 방지
          'p-1.5 md:p-4',
          '-mt-2 md:-mt-5',
          'h-[clamp(240px,48dvh,480px)] md:h-full md:min-h-0',
          'lg:w-[22rem] 2xl:w-[25rem] 3xl:w-[25rem]',
        )}
      >
        {/* BGYR 설정 & 알람 저장 */}
        <div className="flex justify-between mb-2 md:mb-4 gap-1 md:gap-2 items-end">
          {/* 정상(B) */}
          <div className="flex flex-col items-center 3xl:items-center">
            <label className="flex items-center text-[10px] md:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1">
              <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-blue-500 inline-block rounded-sm" />
              정상
            </label>

            <div className="border border-gray-400 rounded-md w-9 md:w-10 h-7 md:h-[3.1vh] flex items-center justify-center">
              <span className="text-[10px] md:text-[11px] 2xl:text-xs">{G}</span>
              <span className="ml-1 text-[10px] md:text-[11px] 2xl:text-xs">이하</span>
            </div>
          </div>

          {[
            { key: 'G', label: '주의', color: 'bg-green-500', setter: setG, value: G },
            { key: 'Y', label: '경고', color: 'bg-yellow-400', setter: setY, value: Y },
            { key: 'R', label: '위험', color: 'bg-red-500', setter: setR, value: R },
          ].map(({ key, label, color, setter, value }) => {
            const minValue = key === 'G' ? 0 : key === 'Y' ? G : Y
            return (
              <div key={key} className="flex flex-col items-center">
                <label className="flex items-center text-[10px] md:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1">
                  <span className={cn('w-2.5 h-2.5 md:w-3 md:h-3 inline-block rounded-sm', color)} />
                  {label}
                </label>
                <select
                  className="border border-gray-400 rounded-md px-1 py-0.5 text-[11px] md:text-sm"
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

          <div className="flex flex-col items-center ml-1">
            <label className="flex items-center text-[10px] md:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1 text-gray-700">
              <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-gray-500 inline-block rounded-sm" />
              전원
            </label>

            <div className="border border-gray-500 rounded-md px-2 min-w-[2rem] h-7 md:h-[3.1vh] flex items-center justify-center text-[11px] md:text-[11px] bg-gray-200 text-gray-700 2xl:w-[2.2vw] 2xl:h-[2.3vh] 2xl:text-base font-bold">
              OFF
            </div>
          </div>

          <button
            className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[11px] md:text-[10px] 2xl:text-xs font-semibold hover:bg-blue-700 transition-colors"
            onClick={() => onSetAlarmLevels({ G, Y, R })}
          >
            저장
          </button>
        </div>

        {/* 뷰 모드 + 설정 */}
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <div className="flex gap-1.5 md:gap-2">
            <button
              className={cn(
                'px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg font-bold text-[11px] md:text-xs text-white transition-colors duration-200',
                viewMode === 'general' ? 'bg-blue-600' : 'bg-gray-400 hover:bg-gray-500',
              )}
              onClick={() => setViewMode('general')}
            >
              기울기
            </button>
            <button
              className={cn(
                'px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg font-bold text-[11px] md:text-xs text-white transition-colors duration-200',
                viewMode === 'delta' ? 'bg-purple-600' : 'bg-gray-400 hover:bg-gray-500',
              )}
              onClick={() => setViewMode('delta')}
            >
              변화량
            </button>
            <button
              className={cn(
                'px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg font-bold text-[11px] md:text-xs text-white transition-colors duration-200',
                viewMode === 'avgDelta' ? 'bg-orange-400' : 'bg-gray-400 hover:bg-gray-500',
              )}
              onClick={() => setViewMode('avgDelta')}
            >
              평균변화
            </button>
            <button
              className={cn(
                'px-1.5 py-0.5 md:px-1 md:py-1 rounded-lg font-bold text-[11px] md:text-xs text-white transition-colors duration-200',
                viewMode === 'top6' ? 'bg-emerald-600' : 'bg-gray-400 hover:bg-gray-500',
              )}
              onClick={() => {
                setViewMode('top6')
                onTop6Change?.(top6AliveDoorNums)
              }}
            >
              Top6
            </button>
          </div>

          <button
            className="px-2 py-0.5 md:px-3 md:py-1 rounded-lg font-bold text-[11px] md:text-xs text-white bg-gray-700 hover:bg-gray-800 transition-colors ml-3 md:ml-6"
            onClick={() => setIsSettingsOpen(true)}
          >
            설정
          </button>
        </div>

        {/* Gateway + Node 선택 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4 mb-2 md:mb-4">
          {/* ✅ 여기 옵션도 GATEWAY 타입만 */}
          <select
            className="border border-gray-400 rounded-md px-1 py-1 text-[11px] md:text-sm overflow-y-auto"
            value={selectedGateway}
            onChange={e => setSelectedGateway(e.target.value)}
          >
            <option value="">전체구역</option>
            {gatewaysOnly?.map(gw => (
              <option key={(gw as any)._id} value={(gw as any).serial_number}>
                {(gw as any).zone_name && String((gw as any).zone_name).trim() !== ''
                  ? (gw as any).zone_name
                  : `gw-${(gw as any).serial_number}`}
              </option>
            ))}
          </select>

          <select
            className="border border-gray-400 rounded-md px-1 py-1 text-[11px] md:text-sm overflow-y-auto"
            value={selectedNode as any}
            onChange={e => {
              const v = e.target.value
              setSelectedNode(v === '' ? '' : v === 'dead' ? 'dead' : Number.parseInt(v))
            }}
          >
            <option value="">전체노드</option>
            <option value="dead">비활성 노드</option>

            {[...nodesUnderSelectedGateway]
              .sort((a, b) => (a as any).doorNum - (b as any).doorNum)
              .map(node => (
                <option key={(node as any).doorNum} value={(node as any).doorNum}>
                  {(node as any).doorNum}
                </option>
              ))}
          </select>
        </div>

        {/* 노드 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-1.5 md:gap-4 w-full min-w-0">
          {/* 활성 노드 */}
          {aliveNodes.map(item => (
            <Card
              key={(item as any).doorNum}
              onClick={() => handleNodeCardClick(item)}
              className={cn(
                'border border-slate-300 flex flex-col justify-center shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer relative text-gray-600 w-full min-w-0',
                getNodeColorClass(getX(item)),
              )}
            >
              <CardContent className="flex flex-col justify-center p-1.5 md:p-2 text-[12px] md:text-[14px]">
                <div className="flex justify-between items-center mb-1.5 md:mb-2 font-bold text-blue-700">
                  <h1 className="text-[11px] md:text-[14px]">노드넘버</h1>
                  <span className="font-semibold text-[13px] md:text-[16px]">
                    {(item as any).doorNum}
                  </span>
                </div>

                <div className="flex justify-between mb-0.5 md:mb-1 font-medium">
                  <p>Axis-X:</p>
                  <p>{getX(item)}</p>
                </div>
                <div className="flex justify-between mb-0.5 md:mb-1 font-medium">
                  <p>Axis-Y:</p>
                  <p>{getY(item)}</p>
                </div>

                {renderPositionAndGateway(item)}

                <button
                  onClick={e => handleNodeDetailClick(e, item)}
                  className="mt-1.5 md:mt-2 w-full flex items-center justify-center gap-2 py-0.5 md:py-1 text-[11px] md:text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                >
                  <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="text-[11px] md:text-[13px]">상세정보</span>
                </button>
              </CardContent>
            </Card>
          ))}

          {/* 비활성 노드 */}
          {deadNodes.length > 0 && (
            <div className="col-span-2 lg:col-span-2 mt-4 md:mt-6 w-full min-w-0">
              <h2 className="text-center font-bold text-gray-600 mb-2 md:mb-3 text-[12px] md:text-base">
                비활성 노드
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-1.5 md:gap-4 w-full min-w-0">
                {deadNodes.map(item => (
                  <Card
                    key={(item as any).doorNum}
                    onClick={() => handleNodeCardClick(item)}
                    className={cn(
                      'border border-slate-300 flex flex-col justify-center shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer relative w-full min-w-0',
                      'bg-gray-400 text-gray-50 hover:bg-gray-400/70',
                    )}
                  >
                    <CardContent className="flex flex-col justify-center p-1.5 md:p-2 text-[12px] md:text-[14px]">
                      <div className="flex justify-between items-center mb-1.5 md:mb-2 font-bold">
                        <h1 className="text-[11px] md:text-[14px]">노드넘버</h1>
                        <span className="font-semibold text-[13px] md:text-[16px]">
                          {(item as any).doorNum}
                        </span>
                      </div>

                      <div className="flex justify-between mb-0.5 md:mb-1 font-medium">
                        <p>Axis-X:</p>
                        <p>{getX(item)}</p>
                      </div>
                      <div className="flex justify-between mb-0.5 md:mb-1 font-medium">
                        <p>Axis-Y:</p>
                        <p>{getY(item)}</p>
                      </div>

                      <div className="flex justify-between mb-0.5 md:mb-1 font-medium">
                        <p className="mt-1 truncate">{(item as any).position || 'N/A'}</p>
                      </div>

                      <button
                        onClick={e => handleNodeDetailClick(e, item)}
                        className="mt-1.5 md:mt-2 w-full flex items-center justify-center gap-2 py-0.5 md:py-1 text-[11px] md:text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white"
                      >
                        <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="text-[11px] md:text-[13px]">상세정보</span>
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ================= 중앙: Gateway + 이미지 / CSV (md 이하 숨김) ================= */}
      <div className="hidden md:flex md:col-span-5 2xl:col-span-6 flex-col lg:gap-y-1 2xl:gap-y-2 lg:-mt-5 lg:-ml-[2vw] 2xl:ml-0 lg:max-w-[108%] 2xl:max-w-[100%] md:min-h-0 md:max-h-[50vh]">
        <div className="grid lg:grid-cols-[0.3fr_0.7fr] 2xl:grid-cols-[0.3fr_0.7fr] w-full gap-x-1 rounded-lg border border-slate-400 md:h-[60%] md:min-h-0">
          <div className="flex flex-col items-center lg:col-span-1 col-span-2 rounded-md bg-gray-50 text-gray-600 md:h-full md:min-h-0">
            <ScrollArea className="pr-3 pl-4 lg:py-1 2xl:py-2 3xl:py-2 border-none md:h-full md:min-h-0">
              <button
                className={cn(
                  'w-full mb-2 p-1 rounded-md text-[12px] font-semibold',
                  !selectedGateway ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700',
                )}
                onClick={() => setSelectedGateway('')}
              >
                전체구역
              </button>

              {/* ✅ 여기 게이트웨이 버튼(타일)도 GATEWAY 타입만 */}
              <div className="grid grid-cols-2 gap-2 w-full">
                {gatewaysOnly?.map((gw, index) => (
                  <div
                    onClick={() => onToggleGatewaySelection(gw)}
                    key={index}
                    className={cn(
                      'text-[12px] p-1 rounded-md flex flex-col items-center justify-center shadow-md cursor-pointer',
                      getGatewayColorClass(gw),
                    )}
                  >
                    <span className="border-b pb-1">
                      {(gw as any).zone_name && String((gw as any).zone_name).trim() !== ''
                        ? (gw as any).zone_name
                        : `gw-${(gw as any).serial_number}`}
                    </span>
                    <span className="truncate mt-2">gw-{(gw as any).serial_number}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div
            onClick={() => togglePlanImg()}
            className="flex items-center justify-center relative w-full bg-white rounded-lg overflow-hidden md:h-full md:min-h-0"
          >
            <img
              src={mainImageUrl}
              alt="도면 사진"
              className="max-h-full max-w-full object-contain"
              onError={e => {
                const img = e.currentTarget as HTMLImageElement
                const cur = img.currentSrc || img.src
                if (cur && cur.includes('no-image.png')) return
                if (cur) failedImgUrlSetRef.current.add(cur)
                img.src = NO_IMAGE
              }}
            />
            <p className="absolute bottom-1 right-2 text-[12px] text-black px-2 py-0.5 rounded border border-black">
              🔹도면보기
            </p>
          </div>
        </div>

        <div className="w-full flex justify-center md:h-[5vh] md:min-h-0">
          <div className="w-full max-w-[100%] md:h-full md:min-h-0">
            <Download
              buildingId={(buildingData as any)?._id ?? ''}
              angleNodes={localNodes}
              buildingName={selectedBuildingName}
            />
          </div>
        </div>
      </div>

      {/* ================= 우측: 로그 (md 이하에서도 남김) ================= */}
      <ScrollArea className="col-span-1 md:col-span-3 2xl:col-span-3 overflow-auto rounded-lg border border-slate-400 bg-white p-2 -mt-2 md:-mt-5 h-[40vh] md:max-h-[35.5vh] 2xl:max-h-[35.78vh] md:min-h-0 lg:w-[112%] 2xl:w-[109%]">
        <div className="flex flex-col gap-2 text-sm">
          {/* 게이트웨이 다운 (GATEWAY 타입만) */}
          {gatewayDownRows.length > 0 && (
            <>
              {gatewayDownRows.map(g => (
                <div
                  key={g.serial}
                  className="px-2 py-1 rounded-lg bg-gray-400 text-white font-semibold text-[11px] md:text-[0.6rem] 2xl:text-[0.9rem]"
                >
                  {`${formatKSTTime(g.createdAt)} | gw-${g.serial} | ${g.zone}`}
                </div>
              ))}
              <hr className="opacity-40" />
            </>
          )}

          {/* 알림 로그 */}
          {groupedTodayLogs.length ? (
            groupedTodayLogs.map((group, idx) => {
              const isOpen = !!openGroups[idx]
              const { doorNum, items } = group

              if (isOpen || items.length === 1) {
                return (
                  <div key={`gopen-${idx}`} className="flex flex-col gap-1">
                    {items.map((log, i) => {
                      const showCollapse = items.length > 1 && isOpen
                      const clickable = i === 0 && showCollapse

                      return (
                        <div
                          key={`log-${idx}-${i}`}
                          onClick={clickable ? () => toggleGroup(idx) : undefined}
                          className={`${logBg(log.level)} px-2 py-1 rounded border border-black/10 shadow-sm ${
                            clickable ? 'cursor-pointer' : ''
                          }`}
                          title={clickable ? '접기' : undefined}
                          style={{ minHeight: 30, width: 'calc(100% - 2px)' }}
                        >
                          <div className="flex items-center justify-between text-[11px] md:text-[0.8rem] 2xl:text-[1rem] 3xl:text-[1rem] font-medium">
                            <div className="truncate mr-2">
                              {`${formatKSTTime(log.createdAt)} | 노드: ${log.doorNum} | ${formatMetricLabel(
                                log.metric,
                              )}: ${log.value}`}
                            </div>
                            {clickable && (
                              <span className="shrink-0 text-[13px] text-gray-700 font-bold ">▲</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }

              const latest = items[0]
              const previewCount = Math.min(items.length, 3)
              const offsetStep = 5

              return (
                <button
                  key={`g-${idx}`}
                  onClick={() => toggleGroup(idx)}
                  className="relative text-left w-full cursor-pointer focus:outline-none"
                  aria-label={`노드 ${doorNum} 로그 ${items.length}건 ${isOpen ? '접기' : '펼치기'}`}
                  title={`노드 ${doorNum} 로그 ${items.length}건`}
                >
                  <div className="relative" style={{ height: 32 + offsetStep * (previewCount - 1) }}>
                    {!isOpen &&
                      Array.from({ length: previewCount - 1 }).map((_, i) => {
                        const bgLog = items[i + 1]
                        const offset = (previewCount - 1 - i) * offsetStep
                        return (
                          <div
                            key={`stack-bg-${idx}-${i}`}
                            className={`${logBg(bgLog.level)} absolute rounded border border-black/10 shadow-sm pointer-events-none`}
                            style={{
                              left: offset,
                              top: offset,
                              right: 2,
                              height: 33,
                              zIndex: 10 + i,
                              opacity: 0.95,
                            }}
                          />
                        )
                      })}

                    <div
                      className={`${logBg(latest.level)} absolute px-2 py-1 rounded border border-black/10 shadow-sm flex items-center justify-between`}
                      style={{ left: 0, top: 0, right: 2, height: 32, zIndex: 50 }}
                    >
                      <div className="truncate mr-1 text-[11px] lg:text-[13px] 2xl:text-[17px] 3xl:text-[18px] font-medium">
                        {`${formatKSTTime(latest.createdAt)} | 노드: ${doorNum} | ${formatMetricLabel(
                          latest.metric,
                        )}: ${latest.value}`}
                      </div>
                      <span className="shrink-0 text-[13px] text-gray-700 font-bold">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="p-2 bg-blue-500 border rounded-md">
              <p className="text-center text-white text-[14px] md:text-[16px]">
                오늘은 위험 로그가 없습니다.
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
        buildingName={selectedBuildingName}
        onToggleSaveStatus={onToggleSaveStatus}
      />

      {/* ✅ 설정 모달 */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-gray/50 z-[100]" />
          <DialogContent className="z-[100] max-w-md">
            <DialogHeader>
              <DialogTitle>설정</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <button
                className="px-3 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600"
                onClick={() => {
                  setIsSettingsOpen(false)
                  setIsInitModalOpen(true)
                }}
              >
                노드 초기화
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                onClick={() => {
                  /* TODO: 도면 업로드 모달/로직 */
                }}
              >
                도면 업로드
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                onClick={() => {
                  setIsSettingsOpen(false)
                  setIsNodesEditOpen(true)
                }}
              >
                노드 정보
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                onClick={() => {
                  setIsSettingsOpen(false)
                  setIsGatewaysEditOpen(true)
                }}
              >
                게이트웨이 정보
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* ✅ Nodes/Gateways Edit Modals */}
      {isNodesEditOpen && (
        <NodesEditModal
          isOpen={isNodesEditOpen}
          onClose={() => setIsNodesEditOpen(false)}
          angleNodes={localNodes}
          buildingName={selectedBuildingName}
          onNodesChange={setLocalNodes}
          buildingId={(buildingData as any)?._id ?? buildingId}
        />
      )}
      {isGatewaysEditOpen && (
        <GatewaysEditModal
          isOpen={isGatewaysEditOpen}
          onClose={() => setIsGatewaysEditOpen(false)}
          gatewyas={gatewaysOnly as any}
          onSave={() => setIsGatewaysEditOpen(false)}
        />
      )}

      {isPlanImgOpen && (
        <PlanImageModal
          imageUrl={mainImageUrl || planImgUrl || NO_IMAGE}
          buildingName={selectedBuildingName}
          onClose={() => setIsPlanImgOpen(false)}
        />
      )}

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
                {selectedNodesForInit.length === allNodes.length ? '전체 선택 해제' : '전체 선택'} (
                {selectedNodesForInit.length}/{allNodes.length})
              </button>
              <button
                onClick={handleInitSelected}
                className="px-3 py-2 bg-red-500 text-white rounded-md"
              >
                초기화
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto border p-2 rounded">
              {allNodes.map(node => (
                <label key={(node as any).doorNum} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={(node as any).doorNum}
                    checked={selectedNodesForInit.includes((node as any).doorNum)}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setSelectedNodesForInit(prev =>
                        e.target.checked ? [...prev, val] : prev.filter(n => n !== val),
                      )
                    }}
                    className="accent-blue-500 w-4 h-4"
                  />
                  Node-{(node as any).doorNum}
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