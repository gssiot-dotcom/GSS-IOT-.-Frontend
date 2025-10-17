/* eslint-disable @typescript-eslint/no-explicit-any */
import AngleNodeScroll from '@/dashboard/components/shared-dash/AngleNodeScroll'
import SensorGraph from '@/dashboard/pages/admin/angleNodegraphic'
import socket from '@/hooks/useSocket'
import {
  fetchBuildingAngleNodes,
  setBuildingAlarmLevelRequest,
} from '@/services/apiRequests'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  DeltaGraphPoint,
  GraphDataPoint,
  IAngleNode,
  IBuilding,
  SensorData,
} from '../../../types/interfaces'

interface ResQuery {
  state: string
  building: IBuilding
  angle_nodes: IAngleNode[]
}

interface WindPoint {
  timestamp: string
  wind_speed: number
}

/** 스크롤 표시용: createdAt을 선택적으로 포함 */
interface IAngleNodeDisplay extends IAngleNode {
  createdAt?: string
}

/** ------------------------------------------------------------------
 * 최신값 조회: 백의 latest API만 사용
 * GET /api/angles/history/latest?doorNum=NN
 *  - 응답 래퍼가 history | item | data | (직접) 인 케이스를 모두 수용
 *  - 숫자/시간 정규화
 * ------------------------------------------------------------------ */
async function fetchLatestAngleForDoor(doorNum: number) {
  const baseURL = import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005'
  try {
    const res = await axios.get('/api/angles/history/latest', {
      params: { doorNum },
      baseURL,
    })
    const payload: any = res.data

    // ✅ 어떤 키로 오든 한 번에 잡아내기
    const raw =
      payload?.history ??
      payload?.item ??
      payload?.data ??
      payload

    if (!raw || (typeof raw !== 'object')) return undefined

    // ✅ 타입/필드 정규화
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


    // 디버그 (원하시면 유지)
     console.log(`[latest:${latest.doorNum}] x=${latest.angle_x}, y=${latest.angle_y}, at=${latest.createdAt}`)

    return latest
  } catch (e) {
    console.error('latest API 호출 실패:', e)
    return undefined
  }
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

  // latest 전체 invalidate 디바운서 (소켓 폭주 대비)
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

  // ---------------- 빌딩, 게이트웨이, 노드 정보 ---------------- //
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

  // ✅ 서버에서 받아온 데이터 콘솔로 찍기
  useEffect(() => {
    if (queryData[0].data) {
      console.log('📡 [AngleNodes] 서버에서 받아온 데이터:', queryData[0].data)
    }
  }, [queryData[0].data])

  // 순서가 흔들려도 useQueries key 인덱스가 안정적이도록 정렬
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

  // ---------------- 노드 목록 ---------------- //
  const allNodes = useMemo(() => [...stableNodes], [stableNodes])

  // ---------------- 기본 선택 노드 ---------------- //
  useEffect(() => {
    if (!isFirstLoad) return
    if (stableNodes.length) {
      setSelectedDoorNum(stableNodes[0].doorNum)
      setIsFirstLoad(false)
    }
  }, [stableNodes, isFirstLoad])

  // ---------------- doorNum 목록 ---------------- //
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
      staleTime: 60 * 1000,       // 캐시 신선도(표시엔 영향 없음)
      refetchOnWindowFocus: false,
      refetchInterval: 2000,      // ✅ 2초마다 자동 재요청 → 실시간 느낌
      retry: 1,
    })),
  })

  // doorNum -> 최신값 매핑
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

  // ✅ 스크롤에 내려줄 표시용 리스트: latest API 값으로 덮어쓰기
  const nodesForScroll: IAngleNodeDisplay[] = useMemo(() => {
    return (stableNodes || []).map((n) => {
      const latest = latestMap.get(n.doorNum)
      return {
        ...n,
        angle_x: latest?.angle_x ?? n.angle_x,
        angle_y: latest?.angle_y ?? n.angle_y,
        createdAt: latest?.createdAt ?? undefined,
      }
    })
  }, [stableNodes, latestMap])

  // ---------------- 그래프 데이터 (과거 구간 조회) ---------------- //
  const fetchGraphData = useCallback(async () => {
    if (!selectedDoorNum) return

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
            [`node_${selectedDoorNum}`]: uniqueData[i].angle_x - uniqueData[i - 1].angle_x,
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
    }
  }, [selectedDoorNum, selectedHours, selectedDate, timeMode, viewMode])

  useEffect(() => {
    fetchGraphData()
  }, [fetchGraphData])

  // ---------------- 소켓 리스너 ---------------- //
  useEffect(() => {
    if (!buildingId) return
    const topic = `${buildingId}_angle-nodes`
    const listener = (newData: SensorData) => {
      // 목록에 없는 새 도어는 angle_nodes 목록에 추가 (UI에 보여야 함)
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

      // 그래프는 선택된 도어일 때만 디바운스 갱신
      if (selectedDoorNum === newData.doorNum) {
        scheduleGraphRefetch()
      }

      // ✅ 어떤 노드든 업데이트 신호가 오면, 모든 latest 쿼리 일괄 재요청
      scheduleLatestRefetch()
    }
    socket.on(topic, listener)
    return () => {
      socket.off(topic, listener)
    }
  }, [buildingId, queryClient, selectedDoorNum, scheduleGraphRefetch, scheduleLatestRefetch])

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
    <div className="w-full max-h-screen bg-gray-50 p-2 md:p-5 overflow-hidden">
      <AngleNodeScroll
        onSelectNode={setSelectedDoorNum}
        building_angle_nodes={nodesForScroll} // latest API 값으로 덮인 리스트
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
      />
      <div className="-mt-[63.5vh]">
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
