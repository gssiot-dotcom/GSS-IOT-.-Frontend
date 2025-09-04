import AngleNodeScroll from '@/dashboard/components/shared-dash/AngleNodeScroll'
import SensorGraph from '@/dashboard/pages/admin/angleNodegraphic'
import socket from '@/hooks/useSocket'
import { fetchBuildingAngleNodes } from '@/services/apiRequests'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { IAngleNode, IBuilding } from '../../../types/interfaces'

// 모든 타입 인터페이스를 이곳에서 정의하고 export 합니다.
export interface SensorData {
  doorNum: number
  updatedAt: string
  createdAt: string
  angle_x: number
  angle_y: number
}

export interface GraphDataPoint {
  time: string
  angle_x: number
  angle_y: number
  wind_speed?: number
  nodeId?: string
}

export interface DeltaGraphPoint {
  time: string
  [key: string]: number | string
}

// 평균변화 데이터 타입을 명확히 정의합니다.
// 이제 사용하지 않으므로 주석 처리
// export interface AvgDeltaDataPoint {
//   time: string
//   avgX: number
// }

interface ResQuery {
  state: string
  building: IBuilding
  angle_nodes: IAngleNode[]
}

const AngleNodes = () => {
  const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)
  const [selectedHours, setSelectedHours] = useState<number>(1)
  const [data, setData] = useState<GraphDataPoint[]>([])
  const [deltaData, setDeltaData] = useState<DeltaGraphPoint[]>([]) // AvgDeltaDataPoint[] 제거
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [viewMode, setViewMode] = useState<'general' | 'delta' | 'avgDelta'>(
    'general'
  )
  const { buildingId } = useParams()
  const queryClient = useQueryClient()

  const [B, setB] = useState(0)
  const [G, setG] = useState(0)
  const [Y, setY] = useState(0)
  const [R, setR] = useState(0)

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
  const buildingAngleNodes = (queryData[0].data?.angle_nodes as IAngleNode[]) || []

  const dangerAngleNodes = useMemo(
    () =>
      buildingAngleNodes.filter(it => it.angle_x >= 0.3 || it.angle_x <= -0.3),
    [buildingAngleNodes]
  )

  const allNodes = useMemo(() => {
    return [...buildingAngleNodes]
  }, [buildingAngleNodes])

  useEffect(() => {
    if (!isFirstLoad) return
    if (dangerAngleNodes.length) {
      setSelectedDoorNum(dangerAngleNodes[0].doorNum)
      setIsFirstLoad(false)
      return
    }
    if (buildingAngleNodes.length) {
      setSelectedDoorNum(buildingAngleNodes[0].doorNum)
      setIsFirstLoad(false)
    }
  }, [dangerAngleNodes, buildingAngleNodes, isFirstLoad])

  useEffect(() => {
    if (viewMode === 'general' && !selectedDoorNum) return
    if (viewMode === 'delta' && !selectedDoorNum) return
    if (viewMode === 'avgDelta' && !selectedDoorNum) return

    const now = new Date()
    const from = new Date(now.getTime() - selectedHours * 60 * 60 * 1000).toISOString()
    const to = now.toISOString()
    
    const doorNums = [selectedDoorNum]
    
    axios
      .get<SensorData[]>('/product/angle-node/data', {
        params: { doorNum: doorNums.join(','), from, to },
        baseURL: import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005',
      })
      .then(res => {
        const filteredData = res.data.filter(item => item.doorNum === selectedDoorNum)
        const sortedData = filteredData.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

        if (viewMode === 'general') {
          const dataMap: Record<string, any> = {}
          
          sortedData.forEach(item => {
            const time = new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
            if (!dataMap[time]) {
              dataMap[time] = { time }
            }
            dataMap[time].angle_x = item.angle_x
            dataMap[time].angle_y = item.angle_y
          })
          const formatted = Object.values(dataMap)
          setData(formatted as GraphDataPoint[])
          setDeltaData([])
        } else if (viewMode === 'delta') {
          const deltaGraphData: DeltaGraphPoint[] = []
          for (let i = 1; i < sortedData.length; i++) {
            const time = new Date(sortedData[i].createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const currentAngleX = sortedData[i].angle_x;
            const prevAngleX = sortedData[i-1].angle_x;
            
            deltaGraphData.push({
              time: time,
              [`node_${selectedDoorNum}`]: currentAngleX - prevAngleX
            });
          }
          setDeltaData(deltaGraphData);
          setData([]);
        } else if (viewMode === 'avgDelta') {
          const avgDeltaGraphData: DeltaGraphPoint[] = [];
          const chunkSize = 5;
          for (let i = 0; i < sortedData.length; i += chunkSize) {
            const chunk = sortedData.slice(i, i + chunkSize);
            if (chunk.length === 0) continue;
            
            const avgX = chunk.reduce((sum, node) => sum + node.angle_x, 0) / chunk.length;
            const time = new Date(chunk[0].createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

            avgDeltaGraphData.push({ time, [`node_${selectedDoorNum}`]: avgX });
          }
          setDeltaData(avgDeltaGraphData);
          setData([]);
        }
      })
      .catch(err => console.error('Data fetch error:', err))
  }, [selectedDoorNum, selectedHours, viewMode])


  useEffect(() => {
    if (!buildingId) return
    const topic = `${buildingId}_angle-nodes`

    const listener = (newData: SensorData) => {
      queryClient.setQueryData<ResQuery>(['get-building-angle-nodes', buildingId], old => {
        if (!old) return old
        const list = old.angle_nodes ?? []
        let found = false

        const updated = list.map(n => {
          if (n.doorNum === newData.doorNum) {
            found = true
            return {
              ...n,
              angle_x: newData.angle_x,
              angle_y: newData.angle_y,
              createdAt: new Date(newData.createdAt ?? Date.now()).toISOString(),
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
      })

      if (viewMode === 'general' && selectedDoorNum === newData.doorNum) {
        const point: GraphDataPoint = {
          time: new Date(newData.updatedAt).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Seoul',
            hour12: false,
          }),
          angle_x: newData.angle_x,
          angle_y: newData.angle_y,
        }
        setData(prev => {
          const next = [...prev, point]
          return next.length > 200 ? next.slice(next.length - 200) : next
        })
      }
    }

    socket.on(topic, listener)
    return () => {
      socket.off(topic, listener)
    }
  }, [buildingId, queryClient, selectedDoorNum, viewMode])

  return (
    <div className='w-full max-h-screen bg-gray-50 p-2 md:p-5'>
      <AngleNodeScroll
        onSelectNode={setSelectedDoorNum}
        building_angle_nodes={buildingAngleNodes}
        dangerAngleNodes={dangerAngleNodes}
        buildingData={buildingData}
        B={B}
        G={G}
        Y={Y}
        R={R}
        setB={setB}
        setG={setG}
        setY={setY}
        setR={setR}
        viewMode={viewMode}
        setViewMode={setViewMode}
        allNodes={allNodes}
      />

      <div className='-mt-[63.5vh]'>
        <SensorGraph
          graphData={
            viewMode === 'delta' || viewMode === 'avgDelta'
              ? deltaData
              : data
          }
          buildingId={buildingId}
          doorNum={selectedDoorNum}
          onSelectTime={setSelectedHours}
          hours={selectedHours}
          B={B}
          G={G}
          Y={Y}
          R={R}
          viewMode={viewMode}
        />
      </div>
    </div>
  )
}

export default AngleNodes