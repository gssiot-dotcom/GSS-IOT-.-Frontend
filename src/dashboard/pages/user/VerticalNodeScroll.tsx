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
import { cn } from '@/lib/utils'
import { IAngleNode, IBuilding, IGateway } from '@/types/interfaces'
import { useMemo, useState, useEffect } from 'react'
import { NodeDetailModal } from '@/dashboard/components/shared-dash/angleNodeDetail'

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
  allNodes: IAngleNode[]
  onSetAlarmLevels: (levels: { G: number; Y: number; R: number }) => void
  alertLogs: AlertLog[]
  onToggleSaveStatus?: (doorNum: number, next: boolean) => Promise<void> | void

  // ✅ 추가: 그래프 버튼 클릭 시 부모로 전달
  onOpenGraph?: (doorNum: number) => void
}

/** ================================
 *   컴포넌트
 *  ================================ */
const VerticalNodeScroll = ({
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
  onSetAlarmLevels,
  allNodes,
  alertLogs,
  onToggleSaveStatus,
  onOpenGraph,
}: Props) => {
  // 🔹 로컬 노드 (편집 반영용)
  const [localNodes, setLocalNodes] = useState<IAngleNode[]>(building_angle_nodes)

  useEffect(() => {
    setLocalNodes(building_angle_nodes)
  }, [building_angle_nodes])

  const [selectedGateway, setSelectedGateway] = useState<string>('')
  const [selectedNode, setSelectedNode] = useState<number | '' | 'dead'>('')

  const [isModalOpen, setIsModalOpen] = useState(true)
  const [selectedNodeForModal, setSelectedNodeForModal] = useState<any>(null)

  // ✅ Settings / Edit 모달 상태
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isNodesEditOpen, setIsNodesEditOpen] = useState(false)
  const [isGatewaysEditOpen, setIsGatewaysEditOpen] = useState(false)

  // ✅ 초기화 모달 관련
  const [isInitModalOpen, setIsInitModalOpen] = useState(false)
  const [selectedNodesForInit, setSelectedNodesForInit] = useState<number[]>([])

  // ✅ 오늘 날짜 로그만 필터링 (UTC → KST)
  const todayLogs = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
    return alertLogs.filter(log => {
      const logStr = new Date(log.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
      return logStr === todayStr
    })
  }, [alertLogs])

  const selectedBuildingName = useMemo(() => {
    return (
      buildingData?.building_name ||
      (buildingData as any)?.name ||
      (buildingData as any)?.buildingName ||
      ''
    )
  }, [buildingData])

  // ✅ 기본 정렬: doorNum 오름차순
  const sortedNodes = useMemo(() => {
    if (!localNodes?.length) return []
    return [...localNodes].sort((a, b) => (a.doorNum ?? 0) - (b.doorNum ?? 0))
  }, [localNodes])

  const nodesUnderSelectedGateway = useMemo(() => {
    if (!selectedGateway) return sortedNodes
    return sortedNodes.filter(node => node.gateway_id?.serial_number === selectedGateway)
  }, [sortedNodes, selectedGateway])

  const nodesToDisplay = useMemo(() => {
    let nodes = [...sortedNodes]

    if (selectedGateway) {
      nodes = nodes.filter(node => node.gateway_id?.serial_number === selectedGateway)
    }

    if (selectedNode === 'dead') {
      nodes = nodes.filter(node => !node.node_alive)
    } else if (selectedNode !== '' && typeof selectedNode === 'number') {
      nodes = nodes.filter(node => node.doorNum === selectedNode)
    }

    return nodes
  }, [sortedNodes, selectedGateway, selectedNode])

  const aliveNodes = nodesToDisplay.filter(node => node.node_alive)
  const deadNodes = nodesToDisplay.filter(node => !node.node_alive)

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
    if (!gw.gateway_alive) return 'bg-gray-500/90 text-gray-50 hover:bg-gray-600'

    const activeNodes = localNodes.filter(
      node => node.gateway_id?.serial_number === gw.serial_number && node.node_alive === true,
    )

    if (!activeNodes.length) return 'bg-gray-300 text-gray-700'

    const worstActive = [...activeNodes].sort(
      (a, b) => Math.abs(b.angle_x ?? 0) - Math.abs(a.angle_x ?? 0),
    )[0]

    return getNodeColorClass(worstActive.angle_x ?? 0) + ' text-gray-800'
  }

  const generateOptions = (min: number) => {
    return Array.from({ length: 21 }, (_, i) => Number.parseFloat((i * 0.5).toFixed(1))).filter(
      num => num >= min,
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

  // ✅ 추가: 그래프 버튼 클릭 시 부모에 doorNum 전달
  const handleGraphClick = (e: React.MouseEvent, node: any) => {
    e.stopPropagation()
    onOpenGraph?.(node.doorNum)
  }

  const onToggleGatewaySelection = (gateway: IGateway) => {
    setSelectedGateway(gateway.serial_number)
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
      setSelectedNodesForInit(allNodes.map(n => n.doorNum))
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
      <div className="flex flex-col mb-1 font-medium">
        <p className="truncate max-w-full">{item.position || 'N/A'}</p>
      </div>
      <div className="flex flex-col mb-1 font-medium">
        <p className="truncate max-w-full">
          ({item.gateway_id?.serial_number ? `gw-${item.gateway_id.serial_number}` : 'N/A'})
        </p>
      </div>
    </>
  )

  const gatewayDownRows = useMemo(
    () =>
      (gateways ?? [])
        .filter(gw => gw && gw.gateway_alive === false)
        .map(gw => ({
          createdAt: gw.lastSeen ? new Date(gw.lastSeen).toISOString() : new Date().toISOString(),
          serial: gw.serial_number,
          zone: gw.zone_name ?? 'N/A',
        })),
    [gateways],
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

  // ✅ 리스트 갱신 시 모달 노드 최신화
  useEffect(() => {
    if (!isModalOpen || !selectedNodeForModal) return
    const fresh = localNodes.find(n => n.doorNum === selectedNodeForModal.doorNum)
    if (fresh) setSelectedNodeForModal(fresh)
  }, [localNodes, isModalOpen, selectedNodeForModal?.doorNum])

  return (
    /**
     * ✅ 모바일: 페이지 스크롤 허용(아래 게이트웨이 영역 보이게)
     * ✅ md 이상: 기존처럼 화면 고정 + 각 ScrollArea 내부 스크롤
     */
    <div className="grid grid-cols-12 gap-3 md:gap-4 w-full min-h-dvh md:h-screen px-1 py-4 mt-2 overflow-y-auto md:overflow-hidden">
      {/* ===================== 좌측: 노드 카드(넓게) ===================== */}
      <ScrollArea
        className={cn(
          'col-span-12 lg:col-span-9 2xl:col-span-9 rounded-lg border border-slate-400 bg-white p-3 md:p-4 -mt-3 md:-mt-5',
          // ✅ 모바일: 높이 고정 X → 페이지 스크롤로 아래까지 내려갈 수 있게
          'h-auto',
          // ✅ lg 이상: 기존 고정
          'lg:h-[96%] 2xl:h-[96.6%] 3xl:h-[96.6%]',
        )}
      >
        {/* BGYR 설정 & 알람 저장 */}
        <div className="flex flex-wrap justify-between mb-4 gap-2 items-end">
          {/* 정상(B) */}
          <div className="flex flex-col items-center 3xl:items-center">
            <label className="flex items-center text-[10px] md:lg:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1">
              <span className="w-3 h-3 bg-blue-500 inline-block rounded-sm"></span>
              정상
            </label>
            <div className="border border-gray-400 rounded-md w-10 h-7 md:h-[3.1vh] flex items-center justify-center 2xl:w-[2.6vw] 2xl:h-[2.3vh] 2xl:text-base">
              <span className="text-[10px] md:lg:text-[11px] 2xl:text-xs">{G}</span>
              <span className="ml-1 mt-[0.1vh] text-[10px] md:lg:text-[11px] 2xl:text-xs 3xl:text-xs">
                이하
              </span>
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
                <label className="flex items-center text-[10px] md:lg:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1">
                  <span className={`w-3 h-3 ${color} inline-block rounded-sm`} />
                  {label}
                </label>
                <select
                  className="border border-gray-400 rounded-md px-1 text-[12px] md:text-sm h-7 md:h-auto"
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
            <label className="flex items-center text-[10px] md:lg:text-[11px] 2xl:text-xs font-semibold mb-1 gap-1 text-gray-700">
              <span className="w-3 h-3 bg-gray-500 inline-block rounded-sm" />
              전원
            </label>
            <div className="border border-gray-500 rounded-md px-2 min-w-[2rem] h-7 md:h-[3.1vh] flex items-center justify-center text-[11px] md:lg:text-[11px] bg-gray-200 text-gray-700 2xl:w-[2.2vw] 2xl:h-[2.3vh] 2xl:text-base font-bold">
              OFF
            </div>
          </div>

          <button
            className="px-2 2xl:p-2 py-1 bg-blue-600 text-white rounded-lg text-[11px] md:lg:text-[10px] 2xl:text-xs font-semibold hover:bg-blue-700 transition-colors"
            onClick={() => onSetAlarmLevels({ G, Y, R })}
          >
            저장
          </button>

          <button
            className="px-3 py-1 rounded-lg font-bold text-[11px] md:text-xs text-white bg-gray-700 hover:bg-gray-800 transition-colors"
            onClick={() => setIsSettingsOpen(true)}
          >
            설정
          </button>
        </div>

        {/* Gateway + Node 선택 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-4">
          <select
            className="border border-gray-400 rounded-md px-2 py-1 text-[12px] md:text-sm overflow-y-auto"
            value={selectedGateway}
            onChange={e => setSelectedGateway(e.target.value)}
          >
            <option value="">전체구역</option>
            {gateways?.map(gw => (
              <option key={(gw as any)._id} value={gw.serial_number}>
                {gw.zone_name && gw.zone_name.trim() !== '' ? gw.zone_name : `gw-${gw.serial_number}`}
              </option>
            ))}
          </select>

          <select
            className="border border-gray-400 rounded-md px-2 py-1 text-[12px] md:text-sm overflow-y-auto"
            value={selectedNode as any}
            onChange={e => {
              const v = e.target.value
              setSelectedNode(v === '' ? '' : v === 'dead' ? 'dead' : Number.parseInt(v))
            }}
          >
            <option value="">전체노드</option>
            <option value="dead">비활성 노드</option>

            {[...nodesUnderSelectedGateway]
              .sort((a, b) => (a.doorNum ?? 0) - (b.doorNum ?? 0))
              .map(node => (
                <option key={node.doorNum} value={node.doorNum}>
                  {node.doorNum}
                </option>
              ))}
          </select>
        </div>

        {/* ✅ 살아있는 노드 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-7 gap-3 md:gap-4">
          {aliveNodes.map(item => (
            <Card
              key={item.doorNum}
              onClick={() => handleNodeCardClick(item)}
              className={cn(
                'border border-slate-300 flex flex-col justify-center shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer relative text-gray-600',
                getNodeColorClass(item.angle_x ?? 0),
              )}
            >
              <CardContent className="flex flex-col justify-center p-2 text-[14px]">
                <div className="flex justify-between items-center mb-2 font-bold text-blue-700">
                  <h1>노드넘버</h1>
                  <span className="font-semibold text-[16px]">{item.doorNum}</span>
                </div>
                <div className="flex justify-between mb-1 font-medium">
                  <p>Axis-X:</p>
                  <p>{item.angle_x}</p>
                </div>
                <div className="flex justify-between mb-1 font-medium">
                  <p>Axis-Y:</p>
                  <p>{item.angle_y}</p>
                </div>
                {renderPositionAndGateway(item)}

                {/* ✅ 상세정보 + 그래프 버튼 */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={e => handleNodeDetailClick(e, item)}
                    className="w-full flex items-center justify-center gap-2 py-1 text-[15px] font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                  >
                    <span className="text-[12px]">상세정보</span>
                  </button>

                  <button
                    onClick={e => handleGraphClick(e, item)}
                    className="w-full flex items-center justify-center gap-2 py-1 text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                  >
                    <span className="text-[12px]">그래프</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ✅ 비활성 노드 (완전 분리된 섹션) */}
        {deadNodes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-center font-bold text-gray-600 mb-3">비활성 노드</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-7 gap-3 md:gap-4">
              {deadNodes.map(item => (
                <Card
                  key={item.doorNum}
                  onClick={() => handleNodeCardClick(item)}
                  className={cn(
                    'border border-slate-300 flex flex-col justify-center shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer relative',
                    'bg-gray-400 text-gray-50 hover:bg-gray-400/70',
                  )}
                >
                  <CardContent className="flex flex-col justify-center p-2 text-[14px]">
                    <div className="flex justify-between items-center mb-2 font-bold">
                      <h1>노드넘버</h1>
                      <span className="font-semibold text-[16px]">{item.doorNum}</span>
                    </div>
                    <div className="flex justify-between mb-1 font-medium">
                      <p>Axis-X:</p>
                      <p>{item.angle_x}</p>
                    </div>
                    <div className="flex justify-between mb-1 font-medium">
                      <p>Axis-Y:</p>
                      <p>{item.angle_y}</p>
                    </div>
                    <div className="flex justify-between mb-1 font-medium">
                      <p className="mt-1 text-xs">{item.position || 'N/A'}</p>
                    </div>

                    {/* ✅ 상세정보 + 그래프 버튼 */}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        onClick={e => handleNodeDetailClick(e, item)}
                        className="w-full flex items-center justify-center gap-2 py-1 text-sm font-medium rounded-lg shadow-sm bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white"
                      >
                        <span className="text-[12px]">상세정보</span>
                      </button>

                      <button
                        onClick={e => handleGraphClick(e, item)}
                        className="w-full flex items-center justify-center gap-2 py-1 text-sm font-medium rounded-lg shadow-sm bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                      >
                        <span className="text-[12px]">그래프</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* ===================== 우측: 로그(위) + 게이트웨이(아래) ===================== */}
      <div className="w-full col-span-12 lg:col-span-3 2xl:col-span-3 flex flex-col gap-3 md:gap-4 -mt-3 md:-mt-5 h-auto lg:h-[96%] 2xl:h-[96.6%] 3xl:h-[96.6%] min-h-0">
        {/* 우측 상단: 위험 로그 */}
        <ScrollArea className="rounded-lg border border-slate-400 bg-white p-2 min-h-0 h-[34dvh] sm:h-[38dvh] lg:h-auto lg:flex-[55]">
          <div className="flex flex-col gap-2 text-sm">
            {/* 게이트웨이 다운 */}
            {gatewayDownRows.length > 0 && (
              <>
                {gatewayDownRows.map(g => (
                  <div
                    key={g.serial}
                    className="px-2 py-1 rounded-lg bg-gray-400 text-white font-semibold text-[11px] lg:text-[0.6rem] 2xl:text-[0.8rem]"
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
                            <div className="flex items-center justify-between text-[11px] lg:text-[0.8rem] 2xl:text-[1.1rem] 3xl:text-[1.1rem] font-medium">
                              <div className="truncate mr-2">
                                {`${formatKSTTime(log.createdAt)} | 노드: ${log.doorNum} | ${formatMetricLabel(
                                  log.metric,
                                )}: ${log.value}`}
                              </div>
                              {clickable && (
                                <span className="shrink-0 text-[13px] text-gray-700 font-bold">▲</span>
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
                <p className="text-center text-white text-[14px] md:text-[16px]">오늘은 위험 로그가 없습니다.</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 우측 하단: 게이트웨이 (모바일에서도 아래에 보이게 높이 부여) */}
        <div className="w-full rounded-lg border border-slate-400 bg-white p-2 min-h-0 h-[28dvh] sm:h-[30dvh] lg:h-auto lg:flex-[45]">
          <ScrollArea className="border border-slate-200 rounded-md p-2 h-full min-h-0">
            <button
              className={`w-full mb-2 p-1 rounded-md text-[12px] font-semibold ${
                !selectedGateway ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'
              }`}
              onClick={() => setSelectedGateway('')}
            >
              전체구역
            </button>

            <div className="grid grid-cols-3 gap-2">
              {gateways?.map((gw, index) => (
                <div
                  onClick={() => onToggleGatewaySelection(gw)}
                  key={index}
                  className={cn(
                    'text-[12px] p-1 rounded-md flex flex-col items-center justify-center shadow-md cursor-pointer',
                    getGatewayColorClass(gw),
                  )}
                >
                  <span className="border-b pb-1">
                    {gw.zone_name && gw.zone_name.trim() !== '' ? gw.zone_name : `gw-${gw.serial_number}`}
                  </span>
                  <span className="truncate mt-2">gw-{gw.serial_number}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

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
                  /* TODO: 도면 업로드 */
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[90%] max-w-lg">
            <h2 className="text-lg font-bold mb-4">노드 초기화</h2>
            <div className="flex flex-col gap-3 mb-4">
              <button onClick={handleSelectAll} className="px-3 py-2 bg-blue-500 text-white rounded-md">
                {selectedNodesForInit.length === allNodes.length ? '전체 선택 해제' : '전체 선택'} (
                {selectedNodesForInit.length}/{allNodes.length})
              </button>
              <button onClick={handleInitSelected} className="px-3 py-2 bg-red-500 text-white rounded-md">
                초기화
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto border p-2 rounded">
              {allNodes.map(node => (
                <label key={node.doorNum} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={node.doorNum}
                    checked={selectedNodesForInit.includes(node.doorNum)}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setSelectedNodesForInit(prev => (e.target.checked ? [...prev, val] : prev.filter(n => n !== val)))
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

export default VerticalNodeScroll