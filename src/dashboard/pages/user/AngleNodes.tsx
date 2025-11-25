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
}

interface WindPoint {
  timestamp: string
  wind_speed: number
}



/** ------------------------------------------------------------------
 * 최신값 조회: 백의 latest API만 사용
 * GET /api/angles/history/latest?doorNum=NN
 * ------------------------------------------------------------------ */
async function fetchLatestAngleForDoor(doorNum: number) {
  const baseURL = import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005'
  try {
    const res = await axios.get('/api/angles/history/latest', {
      params: { doorNum },
      baseURL,
    })
    const payload: any = res.data
    const raw = payload?.history ?? payload?.item ?? payload?.data ?? payload
    if (!raw || typeof raw !== 'object') return undefined

    const angle_x = typeof raw.angle_x === 'string' ? Number(raw.angle_x) : raw.angle_x
    const angle_y = typeof raw.angle_y === 'string' ? Number(raw.angle_y) : raw.angle_y
    const createdAt = new Date(raw.createdAt ?? Date.now()).toISOString()

    const latest: SensorData = {
      ...raw,
      angle_x,
      angle_y,
      createdAt,
      doorNum: raw.doorNum ?? doorNum,
    }

    console.log(
      `[latest:${latest.doorNum}] x=${latest.angle_x}, y=${latest.angle_y}, at=${latest.createdAt}`
    )
    return latest
  } catch (e) {
    console.error('latest API 호출 실패:', e)
    return undefined
  }
}



/** ------------------------------------------------------------------
 * 전체 노드 alive 조회 (오직 이 결과만 사용)
 * GET /api/angle-nodes/alive
 *  - 숫자 배열/객체 배열/래퍼(items|rows|data) 모두 수용
 * ------------------------------------------------------------------ */
/** ------------------------------------------------------------------
 * 전체 노드 alive 조회 (오직 이 결과만 사용)
 * GET /api/angle-nodes/alive
 *  - 숫자 배열/객체 배열/래퍼(items|rows|data) 모두 수용
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

  console.log('[alive] ▶ extracted list:', list)

  // ✅ node_alive + save_status 동시 판별
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



const AngleNodes = () => {
  const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)
  const [selectedHours, setSelectedHours] = useState<number>(12)
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [timeMode, setTimeMode] = useState<'hour' | 'day' | 'week' | 'month'>('hour')
  const [data, setData] = useState<GraphDataPoint[]>([])
  const [deltaData, setDeltaData] = useState<DeltaGraphPoint[]>([])
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [viewMode, setViewMode] = useState<'general' | 'delta' | 'avgDelta'>('general')
  const { buildingId } = useParams()
  const queryClient = useQueryClient()
  const [windHistory, setWindHistory] = useState<WindPoint[]>([])
  const [G, setG] = useState(0)
  const [Y, setY] = useState(0)
  const [R, setR] = useState(0)

  // 위험 로그
  const [alertLogs, setAlertLogs] = useState<any[]>([])

  // 그래프 디바운서
  const graphRefetchTimer = useRef<number | null>(null)
  const scheduleGraphRefetch = useCallback(() => {
    if (graphRefetchTimer.current) return
    graphRefetchTimer.current = window.setTimeout(() => {
      fetchGraphData()
      graphRefetchTimer.current = null
    }, 400)
  }, []) // fetchGraphData는 아래에서 deps로 관리됨

  // latest invalidate 디바운서
  const latestRefetchTimer = useRef<number | null>(null)
  const scheduleLatestRefetch = useCallback(() => {
    if (latestRefetchTimer.current) return
    latestRefetchTimer.current = window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['latest-angle-history'] })
      latestRefetchTimer.current = null
    }, 250)
  }, [queryClient])

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
        setWindHistory(json.data)
      } catch (e) {
        console.error('풍속 데이터 불러오기 실패:', e)
      }
    }
    loadWind()
    const timer = setInterval(loadWind, 60 * 1000)
    return () => clearInterval(timer)
  }, [buildingId])

  // ---------------- 빌딩/노드 메타 ---------------- //
  const queryData = useQueries({
    queries: [
      {
        queryKey: ['get-building-angle-nodes', buildingId],
        queryFn: () => fetchBuildingAngleNodes(buildingId!),
        enabled: !!buildingId,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    ],
  })

  const buildingData = queryData[0].data?.building
  const gateways = queryData[0].data?.gateways
  const buildingAngleNodes = (queryData[0].data?.angle_nodes as IAngleNode[]) || []

  useEffect(() => {
    if (queryData[0].data) {
      console.log('📡 [AngleNodes] 서버에서 받아온 데이터:', queryData[0].data)
    }
  }, [queryData[0].data])

  const stableNodes = useMemo(
    () => [...buildingAngleNodes].sort((a, b) => a.doorNum - b.doorNum),
    [buildingAngleNodes]
  )

  // ---------------- 알람 레벨 설정 ---------------- //
  useEffect(() => {
    if (buildingData?.alarm_level) {
      setG(buildingData.alarm_level.green)
      setY(buildingData.alarm_level.yellow)
      setR(buildingData.alarm_level.red)
    }
  }, [buildingData])

  // ---------------- 위험 로그 로딩 ---------------- //
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

  const allNodes = useMemo(() => [...stableNodes], [stableNodes])

  useEffect(() => {
    if (!isFirstLoad) return
    if (stableNodes.length) {
      setSelectedDoorNum(stableNodes[0].doorNum)
      setIsFirstLoad(false)
    }
  }, [stableNodes, isFirstLoad])

  const doorNums = useMemo(
    () => (stableNodes || []).map((n) => n.doorNum).filter(Boolean),
    [stableNodes]
  )

  // ---------------- 모든 노드 최신값: latest API로만 조회(실시간 폴링) ---------------- //
  const latestQueries = useQueries({
    queries: doorNums.map((doorNum) => ({
      queryKey: ['latest-angle-history', doorNum],
      queryFn: () => fetchLatestAngleForDoor(doorNum),
      enabled: !!doorNum,
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      refetchInterval: 2000,
      retry: 1,
    })),
  })

  const latestMap = useMemo(() => {
    const map = new Map<number, { angle_x?: number; angle_y?: number; createdAt?: string }>()
    latestQueries.forEach((q, idx) => {
      const dn = doorNums[idx]
      const latest = q.data as SensorData | undefined
      if (dn && latest) {
        map.set(dn, {
          angle_x: latest.angle_x,
          angle_y: latest.angle_y,
          createdAt: latest.createdAt,
        })
      }
    })
    return map
  }, [latestQueries, doorNums])


  // ---------------- alive 상태 ---------------- //
  const { data: aliveList = [] } = useQuery({
    queryKey: ['angle-nodes-alive'],
    queryFn: fetchAliveNodes,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
    staleTime: 4000,
  })

  // ✅ 온라인 판정용(둘 다 true일 때만)
  const aliveSet = useMemo(() => {
    const s = new Set<number>()
    for (const it of aliveList as any[]) {
      if (it?.node_alive === true && it?.save_status === true) s.add(it.doorNum)
    }
    return s
  }, [aliveList])

  // ✅ 상세/토글 표시용: doorNum → { node_alive, save_status }
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

  // ---------------- 스크롤 표시 리스트 ---------------- //
  const nodesForScroll: IAngleNode[] = useMemo(() => {
    return (stableNodes || []).map((n) => {
      const latest = latestMap.get(n.doorNum)
      const aliveInfo = aliveMap.get(n.doorNum)
      const merged: IAngleNode & { createdAt?: string } = {
        ...n,
        angle_x: latest?.angle_x ?? n.angle_x,
        angle_y: latest?.angle_y ?? n.angle_y,
        node_alive: aliveSet.has(n.doorNum),         // ✅ online/offline
        save_status: aliveInfo?.save_status,         // ✅ 모달 토글용
        ...(latest?.createdAt ? { createdAt: latest.createdAt } : {}),
      }
      return merged
    })
  }, [stableNodes, latestMap, aliveSet, aliveMap])   // ✅ aliveMap deps 추가
  // ---------------- 그래프 데이터 (과거 구간 조회) ---------------- //
  // 동시 중복 요청 방지
  const graphInFlightRef = useRef(false)

  const fetchGraphData = useCallback(async () => {
    if (!selectedDoorNum) return
    if (graphInFlightRef.current) return
    graphInFlightRef.current = true

    let from: string
    let to: string

    if (timeMode === 'day' && selectedDate) {
      const startOfDay = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(), 0, 0, 0, 0
      )
      const endOfDay = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(), 23, 59, 59, 999
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
      const last = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)
      from = first.toISOString()
      to = last.toISOString()
    } else {
      const now = new Date()
      from = new Date(now.getTime() - selectedHours * 60 * 60 * 1000).toISOString()
      to = now.toISOString()
    }

    try {
      const res = await axios.get<SensorData[]>('/product/angle-node/data', {
        params: { doorNum: selectedDoorNum, from, to },
        baseURL: import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005',
      })

      const filteredData = res.data.filter((item) => item.doorNum === selectedDoorNum)
      const sortedData = filteredData.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      if (viewMode === 'general') {
        const dataMap: Record<string, any> = {}
        sortedData.forEach((item) => {
          const time = new Date(item.createdAt).toISOString()
          if (!dataMap[time]) dataMap[time] = { time }
          dataMap[time].angle_x = item.angle_x
          dataMap[time].angle_y = item.angle_y
        })
        setData(Object.values(dataMap) as GraphDataPoint[])
        setDeltaData([])
      } else if (viewMode === 'delta') {
        const deltaGraphData: DeltaGraphPoint[] = []
        const uniqueKeyMap: Record<string, SensorData> = {}
        sortedData.forEach((item) => {
          const timeKey = new Date(item.createdAt).toISOString()
          uniqueKeyMap[timeKey] = item
        })
        const uniqueData = Object.values(uniqueKeyMap)
        for (let i = 1; i < uniqueData.length; i++) {
          const time = new Date(uniqueData[i].createdAt).toISOString()
          deltaGraphData.push({
            time,
            [`node_${selectedDoorNum}`]:
              uniqueData[i].angle_x - uniqueData[i - 1].angle_x,
          })
        }
        setDeltaData(deltaGraphData)
        setData([])
      } else if (viewMode === 'avgDelta') {
        const avgDeltaGraphData: DeltaGraphPoint[] = []
        const chunkSize = 5
        const averages: { time: string; avgX: number }[] = []
        for (let i = 0; i < sortedData.length; i += chunkSize) {
          const chunk = sortedData.slice(i, i + chunkSize)
          if (chunk.length === 0) continue
          const avgX = chunk.reduce((s, n) => s + n.angle_x, 0) / chunk.length
          const time = new Date(chunk[0].createdAt).toISOString()
          averages.push({ time, avgX })
        }
        for (let i = 1; i < averages.length; i++) {
          const delta = averages[i].avgX - averages[i - 1].avgX
          avgDeltaGraphData.push({
            time: averages[i].time,
            [`node_${selectedDoorNum}`]: delta,
          })
        }
        setDeltaData(avgDeltaGraphData)
        setData([])
      }
    } catch (err) {
      console.error('Data fetch error:', err)
    } finally {
      graphInFlightRef.current = false
    }
  }, [selectedDoorNum, selectedHours, selectedDate, timeMode, viewMode])

  // 최초 로드
  useEffect(() => {
    fetchGraphData()
  }, [fetchGraphData])

  // 5초마다 그래프 주기 갱신
  useEffect(() => {
    const id = window.setInterval(() => {
      fetchGraphData()
    }, 5000)
    return () => clearInterval(id)
  }, [fetchGraphData])

  // ---------------- 소켓 리스너 ---------------- //
  useEffect(() => {
    if (!buildingId) return
    const topic = `${buildingId}_angle-nodes`
    const listener = (newData: SensorData) => {
      // 목록에 없는 새 도어는 angle_nodes 목록에 추가
      queryClient.setQueryData<ResQuery>(
        ['get-building-angle-nodes', buildingId],
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

      // 선택된 도어면 그래프 빠른 반영
      if (selectedDoorNum === newData.doorNum) {
        scheduleGraphRefetch()
      }

      // latest 폴링 쿼리 갱신
      scheduleLatestRefetch()
    }
    socket.on(topic, listener)
    return () => {
      socket.off(topic, listener)
    }
  }, [buildingId, queryClient, selectedDoorNum, scheduleGraphRefetch, scheduleLatestRefetch])


  const baseURL = import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005'


const handleToggleSaveStatus = async (doorNum: number, next: boolean) => {
  try {
    await axios.patch(
      `/api/nodes/${doorNum}/save-status`,     // ← 1) 여기 먼저 바꿔보기
      { save_status: next },                          //    키 맞는지 확인
      { baseURL, headers: { 'Content-Type': 'application/json' } }
    )
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

  // ---------------- 렌더 ---------------- //
  return (
    <div className="w-full max-h-screen bg-gray-50 px-2 md:px-5 pt-0 overflow-hidden">
      <WhiteHeader
        buildingName={
          buildingData?.building_name   // ✅ 스샷 기준 필드
          ?? buildingData?.name         // 혹시 name으로 오는 경우 대비
          ?? buildingData?.title        // 타이틀로 오는 경우 대비
          ?? ""
        }
      />
      <div className="lg:-ml-[1%] ">
        <AngleNodeScroll
          onSelectNode={setSelectedDoorNum}
          building_angle_nodes={nodesForScroll} // ✅ alive 반영 리스트
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
        />
      </div>
      <div className="lg:-mt-[42.2%] 2xl:-mt-[61.5vh] 3xl:-mt-[62vh]">
        <SensorGraph
          graphData={viewMode === 'delta' || viewMode === 'avgDelta' ? deltaData : data}
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
