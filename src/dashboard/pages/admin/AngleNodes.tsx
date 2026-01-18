/* eslint-disable @typescript-eslint/no-explicit-any */
import AngleNodeScroll from './AngleNodeScroll'
import SensorGraph from './angleNodegraphic'
import socket from '@/hooks/useSocket'
import {
  fetchBuildingAngleNodes,
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
import WhiteHeader from '@/dashboard/components/shared-dash/dashbordHeader'

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

/** ✅ base host / api base 정규화 */
function normalizeHostBase(url?: string) {
  const fallback = 'http://localhost:3005'
  if (!url) return fallback
  return url.replace(/\/api\/?$/, '')
}

const HOST_BASE = normalizeHostBase(import.meta.env.VITE_SERVER_BASE_URL)
const API_BASE = `${HOST_BASE}/api`

/** ✅ /api 용 axios */
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

/** ✅ / (루트) 용 axios : /weather, /alert-logs 같은 경우 */


/** ------------------------------------------------------------------
 * 전체 노드 alive 조회
 * GET /api/angle-nodes/alive
 * ------------------------------------------------------------------ */
async function fetchAliveNodes() {
  const res = await api.get('/angle-node/alive')
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
 * 그래프 데이터 조회
 * ✅ 백엔드 router 기준: GET /api/angle-nodes/angle-node/data?doorNum=...&from=...&to=...
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
  const res = await api.get<SensorData[]>('/angle-node/angle-node/data', {
    params: { doorNum, from, to },
  })
  return res.data
}

const AngleNodes = () => {
  const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)
  const [selectedHours, setSelectedHours] = useState<number>(12)
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [timeMode, setTimeMode] =
    useState<'hour' | 'day' | 'week' | 'month'>('hour')
  const [viewMode, setViewMode] =
    useState<'general' | 'delta' | 'avgDelta' | 'top6'>('general')

  const [topDoorNums, setTopDoorNums] = useState<number[] | null>(null)
  const [nowTick, setNowTick] = useState(0)

  const { buildingId } = useParams()
  const queryClient = useQueryClient()

  const [windHistory, setWindHistory] = useState<WindPoint[]>([])
  const [G, setG] = useState(0)
  const [Y, setY] = useState(0)
  const [R, setR] = useState(0)
  const [alertLogs, setAlertLogs] = useState<any[]>([])
  const [isFirstLoad, setIsFirstLoad] = useState(true)

  // ---------------- 풍속 데이터 로딩 (루트 API로 유지) ---------------- //
  useEffect(() => {
    if (!buildingId) return

    const loadWind = async () => {
      try {
        const res = await api.get(`/weather/${buildingId}/wind-series`)
        setWindHistory(res.data?.data ?? [])
      } catch (e) {
        console.error('풍속 데이터 불러오기 실패:', e)
      }
    }

    loadWind()
    const timer = setInterval(loadWind, 60 * 1000)
    return () => clearInterval(timer)
  }, [buildingId])

  // ---------------- 빌딩/노드 메타 ---------------- //
  const { data: metaData } = useQuery({
    queryKey: ['get-building-angle-nodes', buildingId],
    queryFn: () => fetchBuildingAngleNodes(buildingId!),
    enabled: !!buildingId,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const buildingData = metaData?.building
  const gateways = metaData?.gateways
  const buildingAngleNodes = (metaData?.angle_nodes as IAngleNode[]) || []

  /** ✅ 카드(리스트)는 소켓으로 최신값 갱신되므로 metaData 기반만 정렬해서 사용 */
  const stableNodes = useMemo(
    () => [...buildingAngleNodes].sort((a, b) => a.doorNum - b.doorNum),
    [buildingAngleNodes]
  )

  const allNodes = useMemo(() => [...stableNodes], [stableNodes])

  useEffect(() => {
    if (!isFirstLoad) return
    if (stableNodes.length) {
      setSelectedDoorNum(stableNodes[0].doorNum)
      setIsFirstLoad(false)
    }
  }, [stableNodes, isFirstLoad])

  // ---------------- 알람 레벨 초기값 ---------------- //
  useEffect(() => {
    if (buildingData?.alarm_level) {
      setG(buildingData.alarm_level.green)
      setY(buildingData.alarm_level.yellow)
      setR(buildingData.alarm_level.red)
    }
  }, [buildingData])

  // ---------------- 위험 로그 로딩 (루트 API로 유지) ---------------- //
  useEffect(() => {
    if (!buildingId || !buildingData?._id) return

    const fetchAlertLogs = async () => {
      try {
        const res = await api.get('/alert-logs', {
          params: { building: buildingData._id, limit: 0 },
        })

        const sorted = (res.data.items ?? []).sort(
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

  // ---------------- alive 상태 ---------------- //
  const { data: aliveList = [] } = useQuery({
    queryKey: ['angle-nodes-alive'],
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

  // ---------------- 카드에 표시할 리스트(= 소켓으로 갱신된 stableNodes + alive) ---------------- //
  const nodesForScroll: IAngleNode[] = useMemo(() => {
    return stableNodes.map((n) => {
      const aliveInfo = aliveMap.get(n.doorNum)
      return {
        ...n,
        node_alive: aliveSet.has(n.doorNum),
        save_status: aliveInfo?.save_status,
      }
    })
  }, [stableNodes, aliveSet, aliveMap])

  // ✅ hour 모드일 때만 "현재 시간" 갱신해서 range 재계산
  useEffect(() => {
    if (timeMode !== 'hour') return
    const id = window.setInterval(() => setNowTick(Date.now()), 60 * 1000)
    return () => clearInterval(id)
  }, [timeMode])

  // ---------------- 그래프 시간 범위 ---------------- //
  const graphRange = useMemo(() => {
    if (!selectedDoorNum && viewMode !== 'top6') return null

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
      const now = new Date()
      from = new Date(now.getTime() - selectedHours * 60 * 60 * 1000).toISOString()
      to = now.toISOString()
    }

    return { doorNum: selectedDoorNum ?? -1, from, to }
  }, [selectedDoorNum, selectedHours, selectedDate, timeMode, viewMode, nowTick])

  // ---------------- top6 그래프 ---------------- //
  const topQueries = useQueries({
    queries: (topDoorNums ?? []).map((dn) => ({
      queryKey: ['angle-graph-top', dn, graphRange?.from, graphRange?.to],
      queryFn: () =>
        fetchAngleGraph({
          doorNum: dn,
          from: graphRange!.from,
          to: graphRange!.to,
        }),
      enabled: !!graphRange && !!dn && viewMode === 'top6',
      retry: 1,
      refetchInterval: 5000,
      refetchOnWindowFocus: false,
      staleTime: 4000,
    })),
  })

  const top6GraphData = useMemo(() => {
    if (viewMode !== 'top6' || !topDoorNums?.length) return []

    const map = new Map<string, any>()

    topDoorNums.forEach((dn, idx) => {
      const arr = (topQueries[idx]?.data ?? []) as SensorData[]
      arr.forEach((item) => {
        const t = new Date(item.createdAt).toISOString()
        if (!map.has(t)) map.set(t, { time: t })
        map.get(t)![`node_${dn}`] = item.angle_x
      })
    })

    return Array.from(map.values())
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .map((p) => ({ ...p, timestamp: new Date(p.time).getTime() }))
  }, [viewMode, topDoorNums, topQueries])

  // ---------------- 그래프 데이터 ---------------- //
  const { data: graphRaw = [] } = useQuery({
    queryKey: graphRange
      ? ['angle-graph', graphRange.doorNum, graphRange.from, graphRange.to]
      : ['angle-graph', 'disabled'],
    queryFn: () => fetchAngleGraph(graphRange!),
    enabled: !!graphRange,
    retry: 1,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
    staleTime: 4000,
  })

  // ---------------- 그래프 뷰모드별 변환 ---------------- //
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
      return {
        graphData: Object.values(dataMap) as GraphDataPoint[],
        deltaGraphData: [],
      }
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
          [`node_${selectedDoorNum}`]:
            uniqueData[i].angle_x - uniqueData[i - 1].angle_x,
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
      const d = averages[i].avgX - averages[i - 1].avgX
      avgDelta.push({
        time: averages[i].time,
        [`node_${selectedDoorNum}`]: d,
      })
    }

    return { graphData: [], deltaGraphData: avgDelta }
  }, [graphRaw, selectedDoorNum, viewMode])

  // ---------------- 소켓 리스너: ✅ 카드 최신값은 여기서만 갱신 ---------------- //
  const graphRefetchTimer = useRef<number | null>(null)
  const scheduleGraphRefetch = useCallback(() => {
    if (graphRefetchTimer.current) return
    graphRefetchTimer.current = window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['angle-graph'] })
      graphRefetchTimer.current = null
    }, 400)
  }, [queryClient])

  useEffect(() => {
    if (!buildingId) return
    const topic = `${buildingId}_angle-nodes`

    const listener = (newData: SensorData) => {
      // ✅ 리스트(카드) 최신값을 소켓으로 반영 (폴링 제거)
      queryClient.setQueryData<ResQuery>(
        ['get-building-angle-nodes', buildingId],
        (old) => {
          if (!old) return old
          const list = old.angle_nodes ?? []
          const idx = list.findIndex((n) => n.doorNum === newData.doorNum)

          // ✅ calibrated 우선(없으면 angle로 fallback)
          const cx = (newData as any).calibrated_x ?? (newData as any).calibratedX ?? newData.angle_x
          const cy = (newData as any).calibrated_y ?? (newData as any).calibratedY ?? newData.angle_y

          if (idx === -1) {
            return {
              ...old,
              angle_nodes: [
                ...list,
                {
                  _id: crypto.randomUUID(),
                  doorNum: newData.doorNum,
                  // ✅ 카드에서 calibrated_x/y를 쓰고 싶으면 여기에 넣어둠
                  calibrated_x: cx,
                  calibrated_y: cy,
                  // ✅ 호환성 위해 angle_x/y도 같이 업데이트(원하면 제거 가능)
                  angle_x: cx,
                  angle_y: cy,
                  node_status: false,
                  node_alive: true,
                  createdAt: newData.createdAt,
                } as IAngleNode,
              ],
            }
          }

          const next = [...list]
          next[idx] = {
            ...next[idx],
            calibrated_x: cx,
            calibrated_y: cy,
            angle_x: cx,
            angle_y: cy,
            createdAt: newData.createdAt,
          }

          return { ...old, angle_nodes: next }
        }
      )

      if (selectedDoorNum === newData.doorNum) scheduleGraphRefetch()
    }

    socket.on(topic, listener)
    return () => {
      socket.off(topic, listener)
    }
  }, [buildingId, queryClient, selectedDoorNum, scheduleGraphRefetch])

  /** ✅ 저장상태 토글도 /api 로 통일 */
  const handleToggleSaveStatus = async (doorNum: number, next: boolean) => {
    try {
      await api.patch(`/angle-nodes/${doorNum}/save-status`, { save_status: next })
      queryClient.invalidateQueries({ queryKey: ['angle-nodes-alive'] })
    } catch (e) {
      if (isAxiosError(e)) {
        console.error('PATCH failed:', {
          url: `/api/angle-nodes/${doorNum}/save-status`,
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

  // ---------------- 알람 레벨 저장 ---------------- //
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

  return (
    <div className="w-full max-h-screen bg-gray-50 px-2 md:px-5 pt-0 overflow-hidden">
      <WhiteHeader
        buildingName={
          buildingData?.building_name ?? buildingData?.name ?? buildingData?.title ?? ''
        }
      />

      <div className="lg:-ml-[1%]">
        <AngleNodeScroll
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
          viewMode={viewMode}
          setViewMode={setViewMode}
          allNodes={allNodes}
          onSetAlarmLevels={handleSetAlarmLevels}
          alertLogs={alertLogs}
          onToggleSaveStatus={handleToggleSaveStatus}
          onTop6Change={setTopDoorNums}
        />
      </div>

      <div className="lg:-mt-[42.2%] 2xl:-mt-[61.5vh] 3xl:-mt-[62vh]">
        <SensorGraph
          graphData={
            viewMode === 'top6'
              ? top6GraphData
              : viewMode === 'delta' || viewMode === 'avgDelta'
                ? deltaGraphData
                : graphData
          }
          topDoorNums={topDoorNums ?? []}
          buildingId={buildingId}
          doorNum={selectedDoorNum}
          onSelectTime={setSelectedHours}
          hours={selectedHours}
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
        />
      </div>
    </div>
  )
}

export default AngleNodes
