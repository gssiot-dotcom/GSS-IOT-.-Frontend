/* eslint-disable @typescript-eslint/no-explicit-any */
import WhiteHeader from '@/dashboard/components/shared-dash/dashbordHeader'
import socket from '@/hooks/useSocket'
import {
  fetchBuildingAngleNodes,
  setBuildingAlarmLevelRequest,
} from '@/services/apiRequests'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import axios, { isAxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  DeltaGraphPoint,
  GraphDataPoint,
  IAngleNode,
  IBuilding,
  SensorData,
} from '../../../types/interfaces'
import AngleNodeScroll from './AngleNodeScroll'
import SensorGraph from './angleNodegraphic'

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

/** ------------------------------------------------------------------
 * 전체 노드 alive 조회
 * GET /api/angle-node/alive
 * ------------------------------------------------------------------ */
async function fetchAliveNodes() {
  const res = await api.get('/angle-node/alive')
  const payload: any = res.data

  const list: any[] = Array.isArray(payload)
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
    .filter(x => !Number.isNaN(x.doorNum))
}

/** ------------------------------------------------------------------
 * 그래프 데이터 조회
 * GET /api/angle-node/graphic-data?doorNum=...&from=...&to=...
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
  const res = await api.get<SensorData[]>('/angle-node/graphic-data', {
    params: { doorNum, from, to },
  })
  return res.data
}

/** ------------------------------------------------------------------
 * calibrated 우선 추출 (없으면 angle로 fallback)
 * ------------------------------------------------------------------ */
function pickCalibratedXY(d: any) {
  const cx =
    d?.calibrated_x ??
    d?.calibratedX ??
    d?.angle_x ??
    d?.angleX ??
    null

  const cy =
    d?.calibrated_y ??
    d?.calibratedY ??
    d?.angle_y ??
    d?.angleY ??
    null

  const toNumOrNull = (v: any) =>
    v == null ? null : typeof v === 'number' ? v : Number(v)

  return {
    calibrated_x: toNumOrNull(cx),
    calibrated_y: toNumOrNull(cy),
  }
}

const AngleNodes = () => {
  const { buildingId } = useParams()
  const queryClient = useQueryClient()

  const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)

  const [selectedHours, setSelectedHours] = useState<number>(12)
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [timeMode, setTimeMode] = useState<'hour' | 'day' | 'week' | 'month'>(
    'hour',
  )
  const [viewMode, setViewMode] = useState<
    'general' | 'delta' | 'avgDelta' | 'top6'
  >('general')
  const [topDoorNums, setTopDoorNums] = useState<number[] | null>(null)

  const [windHistory, setWindHistory] = useState<WindPoint[]>([])
  const [G, setG] = useState(0)
  const [Y, setY] = useState(0)
  const [R, setR] = useState(0)
  const [alertLogs, setAlertLogs] = useState<any[]>([])
  const [isFirstLoad, setIsFirstLoad] = useState(true)

  /** ✅ wind: 초기 1회만 */
  const refetchWind = useCallback(async () => {
    if (!buildingId) return
    try {
      const res = await api.get(`/weather/${buildingId}/wind-series`)
      setWindHistory(res.data?.data ?? [])
    } catch (e) {
      console.error('풍속 데이터 불러오기 실패:', e)
    }
  }, [buildingId])

  useEffect(() => {
    if (!buildingId) return
    refetchWind()
  }, [buildingId, refetchWind])

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

  const stableNodes = useMemo(
    () => [...buildingAngleNodes].sort((a, b) => a.doorNum - b.doorNum),
    [buildingAngleNodes],
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

  // ---------------- 위험 로그 로딩 (HTTP 1회) ---------------- //
  useEffect(() => {
    if (!buildingId || !buildingData?._id) return

    const fetchAlertLogs = async () => {
      try {
        const res = await api.get('/alert/', {
          params: { building: buildingData._id, limit: 0 },
        })

        const sorted = (res.data.items ?? []).sort(
          (a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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

  // ---------------- alive 상태 (HTTP 1회) ---------------- //
  const { data: aliveList = [], refetch: refetchAlive } = useQuery({
    queryKey: ['angle-nodes-alive'],
    queryFn: fetchAliveNodes,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
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

  // ---------------- 카드에 표시할 리스트 ---------------- //
  const nodesForScroll: IAngleNode[] = useMemo(() => {
    return stableNodes.map(n => {
      const aliveInfo = aliveMap.get(n.doorNum)
      return {
        ...n,
        node_alive: aliveSet.has(n.doorNum),
        save_status: aliveInfo?.save_status,
      }
    })
  }, [stableNodes, aliveSet, aliveMap])

  /** =========================
   * ✅ 그래프용 dateKey (queryKey 안정화)
   * ========================= */
  const dateKey = useMemo(() => {
    if (!selectedDate) return 'no-date'
    return `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`
  }, [selectedDate])

  /** ✅ graphKey: from/to 제거해서 "자동 요청" 방지 + 상태 기반 안정화 */
  const graphKey = useMemo(() => {
    if (!selectedDoorNum || viewMode === 'top6') return ['angle-graph', 'disabled']
    return ['angle-graph', selectedDoorNum, viewMode, timeMode, selectedHours, dateKey]
  }, [selectedDoorNum, viewMode, timeMode, selectedHours, dateKey])

  /** ✅ queryFn 실행 시점에 from/to 계산 (hour는 now 기준) */
  const buildRange = useCallback(() => {
    if (!selectedDoorNum) return null

    let from: string
    let to: string

    if (timeMode === 'day' && selectedDate) {
      const start = new Date(selectedDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(selectedDate)
      end.setHours(23, 59, 59, 999)
      from = start.toISOString()
      to = end.toISOString()
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
      const last = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)
      from = first.toISOString()
      to = last.toISOString()
    } else {
      // hour
      const now = new Date()
      from = new Date(now.getTime() - selectedHours * 60 * 60 * 1000).toISOString()
      to = now.toISOString()
    }

    return { doorNum: selectedDoorNum, from, to }
  }, [selectedDoorNum, timeMode, selectedDate, selectedHours])

  // ---------------- top6 그래프 ---------------- //
  const topQueries = useQueries({
    queries: (topDoorNums ?? []).map(dn => ({
      queryKey: ['angle-graph-top', dn, timeMode, selectedHours, dateKey],
      queryFn: async () => {
        const range = (() => {
          // top6도 같은 기간을 쓰도록 buildRange와 동일 계산
          let from: string
          let to: string
          if (timeMode === 'day' && selectedDate) {
            const start = new Date(selectedDate); start.setHours(0,0,0,0)
            const end = new Date(selectedDate); end.setHours(23,59,59,999)
            from = start.toISOString(); to = end.toISOString()
          } else if (timeMode === 'week') {
            const base = selectedDate ?? new Date()
            const day = base.getDay()
            const diffToMonday = (day + 6) % 7
            const monday = new Date(base); monday.setDate(base.getDate() - diffToMonday); monday.setHours(0,0,0,0)
            const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999)
            from = monday.toISOString(); to = sunday.toISOString()
          } else if (timeMode === 'month') {
            const base = selectedDate ?? new Date()
            const first = new Date(base.getFullYear(), base.getMonth(), 1, 0,0,0,0)
            const last = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23,59,59,999)
            from = first.toISOString(); to = last.toISOString()
          } else {
            const now = new Date()
            from = new Date(now.getTime() - selectedHours * 60 * 60 * 1000).toISOString()
            to = now.toISOString()
          }
          return { from, to }
        })()

        return fetchAngleGraph({ doorNum: dn, from: range.from, to: range.to })
      },
      enabled: !!dn && viewMode === 'top6',
      retry: 1,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    })),
  })

  const top6GraphData = useMemo(() => {
    if (viewMode !== 'top6' || !topDoorNums?.length) return []

    const map = new Map<number, any>()

    topDoorNums.forEach((dn, idx) => {
      const arr = (topQueries[idx]?.data ?? []) as SensorData[]
      arr.forEach(item => {
        const ts = Date.parse(item.createdAt)
        if (!Number.isFinite(ts)) return
        const { calibrated_x } = pickCalibratedXY(item)

        if (!map.has(ts)) map.set(ts, { time: item.createdAt, timestamp: ts })
        map.get(ts)![`node_${dn}`] = calibrated_x
      })
    })

    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp)
  }, [viewMode, topDoorNums, topQueries])

  // ---------------- 그래프 데이터 (HTTP) ---------------- //
  const {
    data: graphRaw = [],
    refetch: refetchGraph,
  } = useQuery({
    queryKey: graphKey,
    queryFn: async () => {
      const range = buildRange()
      if (!range) return []
      return fetchAngleGraph(range)
    },
    enabled: !!selectedDoorNum && viewMode !== 'top6',
    retry: 1,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity, // ✅ 소켓에서만 갱신 트리거
  })

  // ---------------- 그래프 뷰모드별 변환 (timestamp + 정렬 보장) ---------------- //
  const { graphData, deltaGraphData } = useMemo(() => {
    if (!selectedDoorNum) return { graphData: [], deltaGraphData: [] }

    const filtered = graphRaw.filter(d => d.doorNum === selectedDoorNum)
    const sorted = filtered.sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    )

    // ✅ general: calibrated_x/y만 사용 + timestamp 포함
    if (viewMode === 'general') {
      const map = new Map<number, any>()

      sorted.forEach(item => {
        const ts = Date.parse(item.createdAt)
        if (!Number.isFinite(ts)) return
        const { calibrated_x, calibrated_y } = pickCalibratedXY(item)

        const prev = map.get(ts) ?? { time: item.createdAt, timestamp: ts }
        prev.angle_x = calibrated_x
        prev.angle_y = calibrated_y
        map.set(ts, prev)
      })

      const out = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp)
      return { graphData: out as GraphDataPoint[], deltaGraphData: [] }
    }

    // ✅ delta
    if (viewMode === 'delta') {
      const unique = new Map<number, SensorData>()
      sorted.forEach(item => {
        const ts = Date.parse(item.createdAt)
        if (!Number.isFinite(ts)) return
        unique.set(ts, item)
      })

      const uniqueData = Array.from(unique.entries())
        .sort((a, b) => a[0] - b[0])
        .map(x => x[1])

      const delta: DeltaGraphPoint[] = []
      for (let i = 1; i < uniqueData.length; i++) {
        const ts = Date.parse(uniqueData[i].createdAt)
        if (!Number.isFinite(ts)) continue

        const cur = pickCalibratedXY(uniqueData[i]).calibrated_x
        const prev = pickCalibratedXY(uniqueData[i - 1]).calibrated_x
        if (cur == null || prev == null) continue

        delta.push({
          time: uniqueData[i].createdAt,
          timestamp: ts,
          [`node_${selectedDoorNum}`]: cur - prev,
        } as any)
      }

      return { graphData: [], deltaGraphData: delta }
    }

    // ✅ avgDelta
    const chunkSize = 5
    const averages: { ts: number; time: string; avgX: number }[] = []

    for (let i = 0; i < sorted.length; i += chunkSize) {
      const chunk = sorted.slice(i, i + chunkSize)
      if (!chunk.length) continue

      const xs = chunk
        .map(x => pickCalibratedXY(x).calibrated_x)
        .filter(v => typeof v === 'number') as number[]
      if (!xs.length) continue

      const avgX = xs.reduce((s, n) => s + n, 0) / xs.length
      const ts = Date.parse(chunk[0].createdAt)
      if (!Number.isFinite(ts)) continue

      averages.push({ ts, time: chunk[0].createdAt, avgX })
    }

    averages.sort((a, b) => a.ts - b.ts)

    const avgDelta: DeltaGraphPoint[] = []
    for (let i = 1; i < averages.length; i++) {
      avgDelta.push({
        time: averages[i].time,
        timestamp: averages[i].ts,
        [`node_${selectedDoorNum}`]: averages[i].avgX - averages[i - 1].avgX,
      } as any)
    }

    return { graphData: [], deltaGraphData: avgDelta }
  }, [graphRaw, selectedDoorNum, viewMode])

  /** =========================
   * ✅ 소켓: 카드 최신값 업데이트 + 그래프 refetch(디바운스)
   * - "데이터 들어올 때만" 리퀘스트 가도록 nowTick interval 제거됨
   * ========================= */
  const refetchTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!buildingId) return
    const topic = `socket/building/${buildingId}/angle-nodes`

    const scheduleRefetch = () => {
      if (refetchTimer.current) return
      refetchTimer.current = window.setTimeout(() => {
        refetchGraph()
        // refetchWind() // 원하면 같이
        refetchTimer.current = null
      }, 300)
    }

    const listener = (newData: SensorData) => {
      // ✅ 1) 카드 최신값 업데이트
      queryClient.setQueryData<ResQuery>(
        ['get-building-angle-nodes', buildingId],
        old => {
          if (!old) return old
          const list = old.angle_nodes ?? []
          const idx = list.findIndex(n => n.doorNum === newData.doorNum)

          const { calibrated_x, calibrated_y } = pickCalibratedXY(newData)

          if (idx === -1) {
            return {
              ...old,
              angle_nodes: [
                ...list,
                {
                  _id: crypto.randomUUID(),
                  doorNum: newData.doorNum,
                  calibrated_x,
                  calibrated_y,
                  angle_x: calibrated_x,
                  angle_y: calibrated_y,
                  node_status: false,
                  node_alive: true,
                  createdAt: newData.createdAt,
                } as any as IAngleNode,
              ],
            }
          }

          const next = [...list]
          next[idx] = {
            ...next[idx],
            calibrated_x,
            calibrated_y,
            angle_x: calibrated_x,
            angle_y: calibrated_y,
            createdAt: newData.createdAt,
          } as any

          return { ...old, angle_nodes: next }
        },
      )

      // ✅ 2) 그래프: 현재 선택 노드일 때만 refetch
      if (
        viewMode !== 'top6' &&
        selectedDoorNum != null &&
        newData.doorNum === selectedDoorNum
      ) {
        scheduleRefetch()
      }

      // ✅ (선택) top6도 즉시 갱신 원하면:
      // if (viewMode === 'top6' && topDoorNums?.includes(newData.doorNum)) scheduleRefetch()
    }

    socket.on(topic, listener)
    return () => {
      socket.off(topic, listener)
      if (refetchTimer.current) {
        clearTimeout(refetchTimer.current)
        refetchTimer.current = null
      }
    }
  }, [buildingId, queryClient, refetchGraph, viewMode, selectedDoorNum])

  /** ✅ 저장상태 토글 */
  const handleToggleSaveStatus = async (doorNum: number, next: boolean) => {
    try {
      await api.patch(`/angle-nodes/${doorNum}/save-status`, {
        save_status: next,
      })
      await refetchAlive()
      queryClient.invalidateQueries({ queryKey: ['angle-nodes-alive'] })
    } catch (e) {
      if (isAxiosError(e)) {
        console.error('PATCH failed:', {
          url: `/angle-nodes/${doorNum}/save-status`,
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
    <div className='w-full max-h-screen bg-gray-50 px-2 md:px-5 pt-0 overflow-hidden'>
      <WhiteHeader
        buildingName={
          buildingData?.building_name ??
          (buildingData as any)?.name ??
          (buildingData as any)?.title ??
          ''
        }
      />

      <div className='lg:-ml-[1%]'>
        <AngleNodeScroll
          buildingId={buildingId}
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

      <div className='lg:-mt-[42.2%] 2xl:-mt-[61.5vh] 3xl:-mt-[62vh]'>
        <SensorGraph
          graphData={
            viewMode === 'top6'
              ? (top6GraphData as any)
              : viewMode === 'delta' || viewMode === 'avgDelta'
                ? (deltaGraphData as any)
                : (graphData as any)
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
