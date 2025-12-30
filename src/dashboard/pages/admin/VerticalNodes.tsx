/* eslint-disable @typescript-eslint/no-explicit-any */
import VerticalNodeScroll from './VerticalNodeScroll'
import SensorGraph from './verticalNodegraphic'
import socket from '@/hooks/useSocket'
import {
  fetchBuildingAngleNodes, // ✅ 일단 기존 메타 API 그대로 사용(수직용 API 없으면)
  setBuildingAlarmLevelRequest,
} from '@/services/apiRequests'
import { useQueries, useQueryClient, useQuery } from '@tanstack/react-query'
import axios, { isAxiosError } from 'axios'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  DeltaGraphPoint,
  GraphDataPoint,
  IAngleNode,
  IBuilding,
  SensorData,
} from '../../../types/interfaces'
import WhiteHeader from '@/dashboard/components/shared-dash/verticalHeader'

// ✅ 그래프 모달
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ResQuery {
  state: string
  building: IBuilding
  angle_nodes: IAngleNode[]
  gateways?: any[]
}

interface WindPoint {
  timestamp: string
  wind_speed: number
}

/** ------------------------------------------------------------------
 * 최신값 조회 (일단 angle latest API 재사용)
 * GET /api/angles/history/latest?doorNum=NN
 * ------------------------------------------------------------------ */
async function fetchLatestForDoor(doorNum: number) {
  const baseURL = import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005'
  try {
    const res = await axios.get('/api/angles/history/latest', {
      params: { doorNum },
      baseURL,
    })
    const payload: any = res.data
    const raw = payload?.history ?? payload?.item ?? payload?.data ?? payload
    if (!raw || typeof raw !== 'object') return undefined

    const angle_x =
      typeof raw.angle_x === 'string' ? Number(raw.angle_x) : raw.angle_x
    const angle_y =
      typeof raw.angle_y === 'string' ? Number(raw.angle_y) : raw.angle_y
    const createdAt = new Date(raw.createdAt ?? Date.now()).toISOString()

    const latest: SensorData = {
      ...raw,
      angle_x,
      angle_y,
      createdAt,
      doorNum: raw.doorNum ?? doorNum,
    }

    return latest
  } catch (e) {
    console.error('latest API 호출 실패:', e)
    return undefined
  }
}

/** ------------------------------------------------------------------
 * alive 조회 (일단 angle alive API 재사용)
 * GET /api/angle-nodes/alive
 * ------------------------------------------------------------------ */
async function fetchAliveNodes() {
  const baseURL = import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005'
  const res = await axios.get('/api/angle-nodes/alive', { baseURL })
  const payload: any = res.data

  const list: any[] =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.data)
            ? payload.data
            : []

  return list
    .map((x: any) => {
      const doorNum = Number(x?.doorNum ?? x?.node ?? x?.id)
      const node_alive =
        typeof x?.node_alive === 'boolean'
          ? x.node_alive
          : x?.alive === true || x?.status === 'alive'

      const save_status =
        typeof x?.save_status === 'boolean'
          ? x.save_status
          : x?.save === true || x?.data_saved === true

      return {
        doorNum,
        node_alive,
        save_status,
        lastSeen: x?.lastSeen ?? null,
        updatedAt: x?.updatedAt ?? null,
      }
    })
    .filter((x) => !Number.isNaN(x.doorNum))
}

/** ------------------------------------------------------------------
 * 그래프 데이터 조회 (AngleNodes 재사용)
 * GET /product/angle-node/data?doorNum=...&from=...&to=...
 * ------------------------------------------------------------------ */
async function fetchAngleGraph({
  doorNum,
  from,
  to,
}: {
  doorNum: number
  from: string
  to: string
}) {
  const baseURL = import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005'
  const res = await axios.get<SensorData[]>('/product/angle-node/data', {
    params: { doorNum, from, to },
    baseURL,
  })
  return res.data
}

const VerticalNodes = () => {
  const { buildingId } = useParams()
  const queryClient = useQueryClient()

  const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)

  // ✅ 그래프 모달 상태
  const [isGraphOpen, setIsGraphOpen] = useState(false)

  // ✅ 그래프 상태(AngleNodes와 동일)
  const [selectedHours, setSelectedHours] = useState<number>(12)
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [timeMode, setTimeMode] =
    useState<'hour' | 'day' | 'week' | 'month'>('hour')
  const [viewMode, setViewMode] =
    useState<'general' | 'delta' | 'avgDelta' | 'top6'>('general')
  const [nowTick, setNowTick] = useState(0)

  const [windHistory, setWindHistory] = useState<WindPoint[]>([])

  const [G, setG] = useState(0)
  const [Y, setY] = useState(0)
  const [R, setR] = useState(0)
  const [alertLogs, setAlertLogs] = useState<any[]>([])
  const [isFirstLoad, setIsFirstLoad] = useState(true)

  // ---------------- 풍속 데이터 로딩 ---------------- //
  useEffect(() => {
    if (!buildingId) return
    const loadWind = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SERVER_BASE_URL}/api/weather/${buildingId}/wind-series`
        )
        if (!res.ok) throw new Error('Wind-series API 호출 실패')
        const json = await res.json()
        setWindHistory(json.data ?? [])
      } catch (e) {
        console.error('풍속 데이터 불러오기 실패:', e)
      }
    }
    loadWind()
    const timer = setInterval(loadWind, 60 * 1000)
    return () => clearInterval(timer)
  }, [buildingId])

  // ✅ hour 모드일 때만 "현재 시간"을 주기적으로 갱신해서 graphRange가 재계산되게 함
  useEffect(() => {
    if (timeMode !== 'hour') return
    const id = window.setInterval(() => setNowTick(Date.now()), 60 * 1000)
    return () => clearInterval(id)
  }, [timeMode])

  // ✅ 메타 (일단 fetchBuildingAngleNodes 재사용)
  const { data: metaData } = useQuery({
    queryKey: ['get-building-vertical-nodes', buildingId],
    queryFn: () => fetchBuildingAngleNodes(buildingId!),
    enabled: !!buildingId,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const buildingData = metaData?.building
  const gateways = metaData?.gateways
  const verticalNodes = (metaData?.angle_nodes as IAngleNode[]) || []

  const stableNodes = useMemo(
    () => [...verticalNodes].sort((a, b) => a.doorNum - b.doorNum),
    [verticalNodes]
  )
  const allNodes = useMemo(() => [...stableNodes], [stableNodes])

  useEffect(() => {
    if (!isFirstLoad) return
    if (stableNodes.length) {
      setSelectedDoorNum(stableNodes[0].doorNum)
      setIsFirstLoad(false)
    }
  }, [stableNodes, isFirstLoad])

  // 알람 레벨
  useEffect(() => {
    if (buildingData?.alarm_level) {
      setG(buildingData.alarm_level.green)
      setY(buildingData.alarm_level.yellow)
      setR(buildingData.alarm_level.red)
    }
  }, [buildingData])

  // 위험 로그
  useEffect(() => {
    if (!buildingId || !buildingData?._id) return

    const fetchAlertLogs = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_SERVER_BASE_URL}/api/alert-logs`,
          { params: { building: buildingData._id, limit: 0 } }
        )
        const sorted = res.data.items.sort(
          (a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        const mapped = sorted.map((log: any) => ({
          createdAt: log.createdAt,
          doorNum: log.doorNum,
          metric: log.metric,
          value: log.value,
          threshold: log.threshold,
          level: log.level,
        }))
        setAlertLogs(mapped)
      } catch (err) {
        console.error('alert logs fetch error:', err)
      }
    }

    fetchAlertLogs()
  }, [buildingId, buildingData?._id])

  const doorNums = useMemo(
    () => stableNodes.map((n) => n.doorNum).filter(Boolean),
    [stableNodes]
  )

  // 최신값 폴링
  const latestQueries = useQueries({
    queries: doorNums.map((doorNum) => ({
      queryKey: ['latest-vertical-history', doorNum],
      queryFn: () => fetchLatestForDoor(doorNum),
      enabled: !!doorNum,
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      refetchInterval: 2000,
      retry: 1,
    })),
  })

  const latestMap = useMemo(() => {
    const map = new Map<
      number,
      { angle_x?: number; angle_y?: number; createdAt?: string }
    >()

    doorNums.forEach((dn) => {
      const latest = queryClient.getQueryData<SensorData>([
        'latest-vertical-history',
        dn,
      ])
      if (latest) {
        map.set(dn, {
          angle_x: latest.angle_x,
          angle_y: latest.angle_y,
          createdAt: latest.createdAt,
        })
      }
    })

    return map
  }, [doorNums, latestQueries, queryClient])

  // alive 상태
  const { data: aliveList = [] } = useQuery({
    queryKey: ['vertical-nodes-alive'],
    queryFn: fetchAliveNodes,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
    staleTime: 4000,
  })

  const aliveSet = useMemo(() => {
    const s = new Set<number>()
    for (const it of aliveList as any[]) {
      if (it?.node_alive === true && it?.save_status === true) s.add(it.doorNum)
    }
    return s
  }, [aliveList])

  const aliveMap = useMemo(() => {
    const m = new Map<number, { node_alive?: boolean; save_status?: boolean }>()
    for (const it of aliveList as any[]) {
      m.set(it.doorNum, {
        node_alive: it?.node_alive === true,
        save_status: it?.save_status === true,
      })
    }
    return m
  }, [aliveList])

  // 스크롤 표시 리스트
  const nodesForScroll: IAngleNode[] = useMemo(() => {
    return stableNodes.map((n) => {
      const latest = latestMap.get(n.doorNum)
      const aliveInfo = aliveMap.get(n.doorNum)
      return {
        ...n,
        angle_x: latest?.angle_x ?? n.angle_x,
        angle_y: latest?.angle_y ?? n.angle_y,
        node_alive: aliveSet.has(n.doorNum),
        save_status: aliveInfo?.save_status,
        ...(latest?.createdAt ? { createdAt: latest.createdAt } : {}),
      }
    })
  }, [stableNodes, latestMap, aliveSet, aliveMap])

  // 소켓 리스너 (topic은 기존 angle-nodes 재사용)
  const latestRefetchTimer = useRef<number | null>(null)
  const scheduleLatestRefetch = useCallback(() => {
    if (latestRefetchTimer.current) return
    latestRefetchTimer.current = window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['latest-vertical-history'] })
      latestRefetchTimer.current = null
    }, 250)
  }, [queryClient])

  useEffect(() => {
    if (!buildingId) return
    const topic = `${buildingId}_angle-nodes`

    const listener = (newData: SensorData) => {
      queryClient.setQueryData<ResQuery>(
        ['get-building-vertical-nodes', buildingId],
        (old) => {
          if (!old) return old
          const list = old.angle_nodes ?? []
          const exists = list.some((n) => n.doorNum === newData.doorNum)
          if (!exists) {
            const updated = [
              ...list,
              {
                _id: crypto.randomUUID(),
                doorNum: newData.doorNum,
                angle_x: newData.angle_x,
                angle_y: newData.angle_y,
                node_status: false,
              } as IAngleNode,
            ]
            return { ...old, angle_nodes: updated }
          }
          return old
        }
      )

      scheduleLatestRefetch()
    }

    socket.on(topic, listener)
    return () => {
      socket.off(topic, listener)
    }
  }, [buildingId, queryClient, scheduleLatestRefetch])

  const baseURL = import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005'

  const handleToggleSaveStatus = async (doorNum: number, next: boolean) => {
    try {
      await axios.patch(
        `/api/nodes/${doorNum}/save-status`,
        { save_status: next },
        { baseURL, headers: { 'Content-Type': 'application/json' } }
      )
      queryClient.invalidateQueries({ queryKey: ['vertical-nodes-alive'] })
    } catch (e) {
      if (isAxiosError(e)) {
        console.error('PATCH failed:', {
          url: `/api/nodes/${doorNum}/save-status`,
          status: e.response?.status,
          data: e.response?.data,
          message: e.message,
        })
      } else {
        console.error(e)
      }
      alert('저장 상태 변경에 실패했습니다.')
    }
  }

  const handleSetAlarmLevels = async (levels: { G: number; Y: number; R: number }) => {
    if (!buildingId) return
    try {
      await setBuildingAlarmLevelRequest(buildingId, {
        B: levels.G,
        G: levels.G,
        Y: levels.Y,
        R: levels.R,
      })
      alert('알람 레벨이 저장되었습니다.')
    } catch (err) {
      console.error(err)
      alert('알람 레벨 저장 중 오류가 발생했습니다.')
    }
  }

  // ---------------- 그래프(모달용) ---------------- //
  const graphRange = useMemo(() => {
    if (!selectedDoorNum) return null

    let from: string
    let to: string

    if (timeMode === 'day' && selectedDate) {
      const startOfDay = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        0,
        0,
        0,
        0
      )
      const endOfDay = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        23,
        59,
        59,
        999
      )
      from = startOfDay.toISOString()
      to = endOfDay.toISOString()
    } else if (timeMode === 'week') {
      const base = selectedDate ?? new Date()
      const day = base.getDay()
      const diffToMonday = (day + 6) % 7
      const monday = new Date(base)
      monday.setDate(base.getDate() - diffToMonday)
      monday.setHours(0, 0, 0, 0)

      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)

      from = monday.toISOString()
      to = sunday.toISOString()
    } else if (timeMode === 'month') {
      const base = selectedDate ?? new Date()
      const first = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0)
      const last = new Date(
        base.getFullYear(),
        base.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
      from = first.toISOString()
      to = last.toISOString()
    } else {
      // hour
      const now = new Date()
      from = new Date(now.getTime() - selectedHours * 60 * 60 * 1000).toISOString()
      to = now.toISOString()
    }

    return { doorNum: selectedDoorNum, from, to }
  }, [selectedDoorNum, selectedHours, selectedDate, timeMode, nowTick])

  const { data: graphRaw = [] } = useQuery({
    queryKey: graphRange
      ? ['vertical-graph', graphRange.doorNum, graphRange.from, graphRange.to]
      : ['vertical-graph', 'disabled'],
    queryFn: () => fetchAngleGraph(graphRange!),
    enabled: isGraphOpen && !!graphRange, // ✅ 모달 열렸을 때만 호출
    retry: 1,
    refetchInterval: isGraphOpen ? 5000 : false,
    refetchOnWindowFocus: false,
    staleTime: 4000,
  })

  const { graphData, deltaGraphData } = useMemo(() => {
    if (!selectedDoorNum) return { graphData: [], deltaGraphData: [] }

    const filtered = graphRaw.filter((d) => d.doorNum === selectedDoorNum)
    const sorted = filtered.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    if (viewMode === 'general') {
      const dataMap: Record<string, any> = {}
      sorted.forEach((item) => {
        const time = new Date(item.createdAt).toISOString()
        if (!dataMap[time]) dataMap[time] = { time }
        dataMap[time].angle_x = item.angle_x
        dataMap[time].angle_y = item.angle_y
      })
      return { graphData: Object.values(dataMap) as GraphDataPoint[], deltaGraphData: [] }
    }

    if (viewMode === 'delta') {
      const delta: DeltaGraphPoint[] = []
      const uniqueKeyMap: Record<string, SensorData> = {}
      sorted.forEach((item) => {
        const timeKey = new Date(item.createdAt).toISOString()
        uniqueKeyMap[timeKey] = item
      })
      const uniqueData = Object.values(uniqueKeyMap)
      for (let i = 1; i < uniqueData.length; i++) {
        const time = new Date(uniqueData[i].createdAt).toISOString()
        delta.push({
          time,
          [`node_${selectedDoorNum}`]: uniqueData[i].angle_x - uniqueData[i - 1].angle_x,
        })
      }
      return { graphData: [], deltaGraphData: delta }
    }

    // avgDelta
    const avgDelta: DeltaGraphPoint[] = []
    const chunkSize = 5
    const averages: { time: string; avgX: number }[] = []
    for (let i = 0; i < sorted.length; i += chunkSize) {
      const chunk = sorted.slice(i, i + chunkSize)
      if (chunk.length === 0) continue
      const avgX = chunk.reduce((s, n) => s + n.angle_x, 0) / chunk.length
      const time = new Date(chunk[0].createdAt).toISOString()
      averages.push({ time, avgX })
    }
    for (let i = 1; i < averages.length; i++) {
      const delta = averages[i].avgX - averages[i - 1].avgX
      avgDelta.push({
        time: averages[i].time,
        [`node_${selectedDoorNum}`]: delta,
      })
    }
    return { graphData: [], deltaGraphData: avgDelta }
  }, [graphRaw, selectedDoorNum, viewMode])

  const openGraphForDoor = (doorNum: number) => {
    setSelectedDoorNum(doorNum)
    setViewMode('general') // ✅ 일단 기본 일반 그래프
    setIsGraphOpen(true)
  }

  return (
    <div className="w-full max-h-screen bg-gray-50 px-2 md:px-5 pt-0 overflow-hidden">
      <WhiteHeader
        buildingName={
          buildingData?.building_name ??
          (buildingData as any)?.name ??
          (buildingData as any)?.title ??
          ''
        }
      />

      <div className="lg:-mr-[2%]">
        <VerticalNodeScroll
          onSelectNode={setSelectedDoorNum}
          building_angle_nodes={nodesForScroll}
          buildingData={buildingData}
          gateways={gateways}
          G={G}
          Y={Y}
          R={R}
          setG={setG}
          setY={setY}
          setR={setR}
          allNodes={allNodes}
          onSetAlarmLevels={handleSetAlarmLevels}
          alertLogs={alertLogs}
          onToggleSaveStatus={handleToggleSaveStatus}
          onOpenGraph={openGraphForDoor} // ✅ 그래프 버튼 → 모달 오픈
        />
      </div>

      {/* ✅ 그래프 모달 */}
      <Dialog open={isGraphOpen} onOpenChange={setIsGraphOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50 z-[120]" />
          <DialogContent className="z-[121] w-[95vw] max-w-[1200px] h-[90vh] overflow-hidden p-3 sm:p-4">
            <DialogHeader className="pb-2">
              <DialogTitle>
                {selectedDoorNum != null ? `Node-${selectedDoorNum} 그래프` : '그래프'}
              </DialogTitle>
            </DialogHeader>

            <div className="h-[82vh] overflow-hidden">
              <SensorGraph
                buildingId={buildingId}
                doorNum={selectedDoorNum}
                graphData={
                  viewMode === 'delta' || viewMode === 'avgDelta'
                    ? deltaGraphData
                    : graphData
                }
                hours={selectedHours}
                onSelectTime={setSelectedHours}
                B={G}
                G={G}
                Y={Y}
                R={R}
                viewMode={viewMode}
                timeMode={timeMode}
                setTimeMode={setTimeMode}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                windHistory={windHistory}
                topDoorNums={[]}
              />
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}

export default VerticalNodes
