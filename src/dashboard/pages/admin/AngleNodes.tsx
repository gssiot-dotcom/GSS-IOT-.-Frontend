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
import { useEffect, useMemo, useState } from 'react'
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

const AngleNodes = () => {
	const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)
	const [selectedHours, setSelectedHours] = useState<number>(24)
	const [data, setData] = useState<GraphDataPoint[]>([])
	const [deltaData, setDeltaData] = useState<DeltaGraphPoint[]>([])
	const [isFirstLoad, setIsFirstLoad] = useState(true)
	const [viewMode, setViewMode] = useState<'general' | 'delta' | 'avgDelta'>(
		'general'
	)
	const { buildingId } = useParams()
	const queryClient = useQueryClient()

	// ✅ B는 별도 상태 없음 → 항상 G 값과 동일하게 처리
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
	const gateways = queryData[0].data?.gateways
	const buildingAngleNodes =
		(queryData[0].data?.angle_nodes as IAngleNode[]) || []

	// ⚡ 서버에서 가져온 alarm_level로 초기화
	useEffect(() => {
		if (buildingData?.alarm_level) {
			// B도 있지만, G 값과 동일하게만 사용
			setG(buildingData.alarm_level.green)
			setY(buildingData.alarm_level.yellow)
			setR(buildingData.alarm_level.red)
		}
	}, [buildingData])

	const LIMIT = 10
	const dangerAngleNodes = useMemo(
		() =>
			buildingAngleNodes.filter(
				it => Math.abs(it.angle_x) >= Y && Math.abs(it.angle_x) < LIMIT
			),
		[buildingAngleNodes, Y]
	)

	const allNodes = useMemo(() => [...buildingAngleNodes], [buildingAngleNodes])

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
		if (!selectedDoorNum) return

		const now = new Date()
		const from = new Date(
			now.getTime() - selectedHours * 60 * 60 * 1000
		).toISOString()
		const to = now.toISOString()
		const doorNums = [selectedDoorNum]

		axios
			.get<SensorData[]>('/product/angle-node/data', {
				params: { doorNum: doorNums.join(','), from, to },
				baseURL:
					import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005',
			})
			.then(res => {
				const filteredData = res.data.filter(
					item => item.doorNum === selectedDoorNum
				)
				const sortedData = filteredData.sort(
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				)

				if (viewMode === 'general') {
					const dataMap: Record<string, any> = {}
					sortedData.forEach(item => {
						const time = new Date(item.createdAt).toLocaleTimeString('ko-KR', {
							hour: '2-digit',
							minute: '2-digit',
							hour12: false,
						})
						if (!dataMap[time]) dataMap[time] = { time }
						dataMap[time].angle_x = item.angle_x
						dataMap[time].angle_y = item.angle_y
					})
					setData(Object.values(dataMap) as GraphDataPoint[])
					setDeltaData([])
				} else if (viewMode === 'delta') {
					const deltaGraphData: DeltaGraphPoint[] = []
					const uniqueMinutesMap: Record<string, SensorData> = {}

					sortedData.forEach(item => {
						const timeKey = new Date(item.createdAt).toLocaleTimeString(
							'ko-KR',
							{
								hour: '2-digit',
								minute: '2-digit',
								hour12: false,
							}
						)
						uniqueMinutesMap[timeKey] = item
					})

					const uniqueMinutesData = Object.values(uniqueMinutesMap)

					for (let i = 1; i < uniqueMinutesData.length; i++) {
						const time = new Date(
							uniqueMinutesData[i].createdAt
						).toLocaleTimeString('ko-KR', {
							hour: '2-digit',
							minute: '2-digit',
							hour12: false,
						})
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

					// 1️⃣ 5개씩 묶어서 평균 계산
					for (let i = 0; i < sortedData.length; i += chunkSize) {
						const chunk = sortedData.slice(i, i + chunkSize)
						if (chunk.length === 0) continue
						const avgX =
							chunk.reduce((sum, node) => sum + node.angle_x, 0) / chunk.length
						const time = new Date(chunk[0].createdAt).toLocaleTimeString('ko-KR', {
							hour: '2-digit',
							minute: '2-digit',
							hour12: false,
						})
						averages.push({ time, avgX })
					}

					// 2️⃣ 평균값들의 차이를 계산 (현재 평균 - 이전 평균)
					for (let i = 1; i < averages.length; i++) {
						const delta = averages[i].avgX - averages[i - 1].avgX
						avgDeltaGraphData.push({
							time: averages[i].time, // 현재 평균의 시간 기준
							[`node_${selectedDoorNum}`]: delta, // 차이값 저장
						})
					}

					setDeltaData(avgDeltaGraphData)
					setData([])
				}
			})
			.catch(err => console.error('Data fetch error:', err))
	}, [selectedDoorNum, selectedHours, viewMode])

	useEffect(() => {
		if (!buildingId) return
		const topic = `${buildingId}_angle-nodes`

		const listener = (newData: SensorData) => {
			queryClient.setQueryData<ResQuery>(
				['get-building-angle-nodes', buildingId],
				old => {
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

	// ✅ API 호출 시 B=G 로 자동 세팅
	const handleSetAlarmLevels = async (levels: {
		G: number
		Y: number
		R: number
	}) => {
		if (!buildingId) return
		try {
			await setBuildingAlarmLevelRequest(buildingId, {
				B: levels.G, // ✅ 자동으로 B=G
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
		<div className='w-full max-h-screen bg-gray-50 p-2 md:p-5 overflow-hidden'>
			<AngleNodeScroll
				onSelectNode={setSelectedDoorNum}
				building_angle_nodes={buildingAngleNodes}
				dangerAngleNodes={dangerAngleNodes}
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
			/>
			<div className='-mt-[63.5vh]'>
				<SensorGraph
					graphData={
						viewMode === 'delta' || viewMode === 'avgDelta' ? deltaData : data
					}
					buildingId={buildingId}
					doorNum={selectedDoorNum}
					onSelectTime={setSelectedHours}
					hours={selectedHours}
					B={G} // ✅ 항상 G 값과 동일
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
