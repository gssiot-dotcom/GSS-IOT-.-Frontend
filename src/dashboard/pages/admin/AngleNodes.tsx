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
import { useEffect, useMemo, useState, useCallback } from 'react'
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

  // ✅ 오늘 날짜 위험 로그 상태
  const [alertLogs, setAlertLogs] = useState<any[]>([])

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
      },
    ],
  })

  const buildingData = queryData[0].data?.building
  const gateways = queryData[0].data?.gateways
  const buildingAngleNodes =
    (queryData[0].data?.angle_nodes as IAngleNode[]) || []

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
          { params: { building: buildingData._id, limit: 0 } } // ✅ limit=0 → 전체 데이터
        )

        // createdAt(Date, KST) 기준 정렬 (오래된 → 최신)
        const sorted = res.data.items.sort(
          (a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        const mapped = sorted.map((log: any) => ({
          createdAt: log.createdAt, // ISO 문자열 (KST 저장)
          doorNum: log.doorNum,
          metric: log.metric,
          value: log.value,
          threshold: log.threshold,
          level: log.level,
        }))

        console.log("✅ Alert Logs items (빌딩 필터 후):", mapped)

        setAlertLogs(mapped)
      } catch (err) {
        console.error('alert logs fetch error:', err)
      }
    }

    fetchAlertLogs()
  }, [buildingId, buildingData?._id])

  // ---------------- 노드 목록 ---------------- //
  const allNodes = useMemo(() => [...buildingAngleNodes], [buildingAngleNodes])

  // ---------------- 기본 선택 노드 ---------------- //
  useEffect(() => {
    if (!isFirstLoad) return
    if (buildingAngleNodes.length) {
      setSelectedDoorNum(buildingAngleNodes[0].doorNum)
      setIsFirstLoad(false)
    }
  }, [buildingAngleNodes, isFirstLoad])

  // ---------------- 그래프 데이터 ---------------- //
  const fetchGraphData = useCallback(async () => {
    if (!selectedDoorNum) return

    let from: string
    let to: string

    if (timeMode === 'day' && selectedDate) {
      const startOfDay = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
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
        59
      )
      from = startOfDay.toISOString()
      to = endOfDay.toISOString()
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

      const filteredData = res.data.filter(
        (item) => item.doorNum === selectedDoorNum
      )
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
        const uniqueMinutesMap: Record<string, SensorData> = {}
        sortedData.forEach((item) => {
          const timeKey = new Date(item.createdAt).toISOString()
          uniqueMinutesMap[timeKey] = item
        })
        const uniqueMinutesData = Object.values(uniqueMinutesMap)
        for (let i = 1; i < uniqueMinutesData.length; i++) {
          const time = new Date(uniqueMinutesData[i].createdAt).toISOString()
          deltaGraphData.push({
            time,
            [`node_${selectedDoorNum}`]:
              uniqueMinutesData[i].angle_x - uniqueMinutesData[i - 1].angle_x,
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
          const avgX =
            chunk.reduce((sum, node) => sum + node.angle_x, 0) / chunk.length
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
      queryClient.setQueryData<ResQuery>(
        ['get-building-angle-nodes', buildingId],
        (old) => {
          if (!old) return old
          const list = old.angle_nodes ?? []
          let found = false
          const updated = list.map((n) => {
            if (n.doorNum === newData.doorNum) {
              found = true
              return {
                ...n,
                angle_x: newData.angle_x,
                angle_y: newData.angle_y,
                createdAt: new Date(
                  newData.createdAt ?? Date.now()
                ).toISOString(),
              }
            }
            return n
          })
          if (!found) {
            updated.push({
              _id: crypto.randomUUID(),
              doorNum: newData.doorNum,
              angle_x: newData.angle_x,
              angle_y: newData.angle_y,
              node_status: false,
            } as IAngleNode)
          }
          return { ...old, angle_nodes: updated }
        }
      )

      if (selectedDoorNum === newData.doorNum) {
        fetchGraphData()
      }
    }
    socket.on(topic, listener)
    return () => {
      socket.off(topic, listener)
    }
  }, [buildingId, queryClient, selectedDoorNum, fetchGraphData])

  // ---------------- 알람 레벨 저장 ---------------- //
  const handleSetAlarmLevels = async (levels: {
    G: number
    Y: number
    R: number
  }) => {
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
        building_angle_nodes={buildingAngleNodes}
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
        alertLogs={alertLogs} // ✅ 부모에서 내려주는 props
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
