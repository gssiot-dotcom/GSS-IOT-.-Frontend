/* eslint-disable @typescript-eslint/no-explicit-any */
import WhiteHeader from '@/dashboard/components/shared-dash/verticalHeader'
import {
	fetchBuildingVerticalNodes,
	setBuildingAlarmLevelRequest,
} from '@/services/apiRequests'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import VerticalNodeScroll from './VerticalNodeScroll'

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
} from '@/components/ui/dialog'
import { useRealtimeRoom } from '@/hooks/useRealtime'
import VerticalSensorGraph from './verticalNodegraphic'

interface ResQuery {
	state: string
	building: IBuilding
	vertical_nodes: IAngleNode[]
	gateways?: any[]
}

interface WindPoint {
	timestamp: string
	wind_speed: number
}

function normalizeHostBase(url?: string) {
	const fallback = 'http://localhost:3005'
	if (!url) return fallback
	return url.replace(/\/api\/?$/, '')
}

const HOST_BASE = normalizeHostBase(import.meta.env.VITE_SERVER_BASE_URL)
const API_BASE = `${HOST_BASE}`

const api = axios.create({
	baseURL: API_BASE,
	withCredentials: true,
})

async function fetchVerticalGraph({
	doorNum,
	from,
	to,
}: {
	doorNum: number
	from: string
	to: string
}) {
	const res = await api.get('/vertical-node/graphic-data', {
		params: { doorNum, from, to },
	})

	const rows: any[] = Array.isArray(res.data)
		? res.data
		: Array.isArray(res.data?.data)
			? res.data.data
			: Array.isArray(res.data?.items)
				? res.data.items
				: Array.isArray(res.data?.rows)
					? res.data.rows
					: []

	return rows
		.map((item: any) => ({
			...item,
			doorNum: Number(
				item?.doorNum ??
					item?.door_num ??
					item?.node ??
					item?.nodeNumber ??
					doorNum,
			),
			createdAt:
				item?.createdAt ??
				item?.timestamp ??
				item?.created_at ??
				item?.time ??
				null,
			angle_x: Number(
				item?.angle_x ?? item?.x ?? item?.calibrated_x ?? item?.axis_x ?? 0,
			),
			angle_y: Number(
				item?.angle_y ?? item?.y ?? item?.calibrated_y ?? item?.axis_y ?? 0,
			),
		}))
		.filter(
			(item: any) =>
				Number.isFinite(item.doorNum) &&
				!!item.createdAt &&
				Number.isFinite(item.angle_x) &&
				Number.isFinite(item.angle_y),
		)
}

const VerticalNodes = () => {
	const { buildingId } = useParams()
	const queryClient = useQueryClient()

	const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)
	const [isGraphOpen, setIsGraphOpen] = useState(false)

	const [selectedHours, setSelectedHours] = useState<number>(12)
	const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
	const [timeMode, setTimeMode] = useState<'hour' | 'day' | 'week' | 'month'>(
		'hour',
	)
	const [viewMode, setViewMode] = useState<
		'general' | 'delta' | 'avgDelta' | 'top6'
	>('general')
	const [nowTick, setNowTick] = useState(0)

	const [windHistory, setWindHistory] = useState<WindPoint[]>([])
	const [G, setG] = useState(0)
	const [Y, setY] = useState(0)
	const [R, setR] = useState(0)
	const [alertLogs, setAlertLogs] = useState<any[]>([])
	const [isFirstLoad, setIsFirstLoad] = useState(true)

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

	useEffect(() => {
		if (timeMode !== 'hour') return
		const id = window.setInterval(() => setNowTick(Date.now()), 60 * 1000)
		return () => clearInterval(id)
	}, [timeMode])

	const { data: metaData } = useQuery({
		queryKey: ['get-building-vertical-nodes', buildingId],
		queryFn: () => fetchBuildingVerticalNodes(buildingId!),
		enabled: !!buildingId,
		retry: 1,
		refetchOnWindowFocus: false,
	})

	const buildingData = metaData?.building
	const gateways = metaData?.gateways
	const verticalNodes = (metaData?.vertical_nodes as IAngleNode[]) || []

	const stableNodes = useMemo(
		() => [...verticalNodes].sort((a, b) => a.doorNum - b.doorNum),
		[verticalNodes],
	)

	const allNodes = useMemo(() => [...stableNodes], [stableNodes])

	useEffect(() => {
		if (!isFirstLoad) return
		if (stableNodes.length) {
			setSelectedDoorNum(stableNodes[0].doorNum)
			setIsFirstLoad(false)
		}
	}, [stableNodes, isFirstLoad])

	useEffect(() => {
		if (buildingData?.alarm_level) {
			setG(buildingData.alarm_level.green)
			setY(buildingData.alarm_level.yellow)
			setR(buildingData.alarm_level.red)
		}
	}, [buildingData])

	useEffect(() => {
		if (!buildingId || !buildingData?._id) return
		const buildingMongoId = buildingData._id

		const fetchAlertLogs = async () => {
			try {
				const res = await api.get('/alert', {
					params: { building: buildingMongoId, limit: 0 },
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

	// alive API가 현재 vertical router에 없으므로
	// 리스트는 metaData 기준으로 그대로 사용
	const nodesForScroll: IAngleNode[] = useMemo(() => {
		return stableNodes.map(n => ({
			...n,
			node_alive:
				typeof (n as any)?.node_alive === 'boolean'
					? (n as any).node_alive
					: true,
			save_status:
				typeof (n as any)?.node_status === 'boolean'
					? (n as any).node_status
					: typeof (n as any)?.save_status === 'boolean'
						? (n as any).save_status
						: undefined,
		}))
	}, [stableNodes])

	const graphRefetchTimer = useRef<number | null>(null)
	const scheduleGraphRefetch = useCallback(() => {
		if (graphRefetchTimer.current) return
		graphRefetchTimer.current = window.setTimeout(() => {
			queryClient.invalidateQueries({ queryKey: ['vertical-graph'] })
			graphRefetchTimer.current = null
		}, 400)
	}, [queryClient])

	const handleVerticalRealtime = useCallback(
		(newData: SensorData) => {
			queryClient.setQueryData<ResQuery>(
				['get-building-vertical-nodes', buildingId],
				old => {
					if (!old) return old

					const list = old.vertical_nodes ?? []
					const idx = list.findIndex(n => n.doorNum === newData.doorNum)

					const cx =
						(newData as any).calibrated_x ??
						(newData as any).calibratedX ??
						newData.angle_x

					const cy =
						(newData as any).calibrated_y ??
						(newData as any).calibratedY ??
						newData.angle_y

					if (idx === -1) {
						return {
							...old,
							vertical_nodes: [
								...list,
								{
									_id: crypto.randomUUID(),
									doorNum: newData.doorNum,
									calibrated_x: cx,
									calibrated_y: cy,
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

					return { ...old, vertical_nodes: next }
				},
			)

			if (isGraphOpen && selectedDoorNum === newData.doorNum) {
				scheduleGraphRefetch()
			}
		},
		[
			buildingId,
			queryClient,
			isGraphOpen,
			selectedDoorNum,
			scheduleGraphRefetch,
		],
	)

	useRealtimeRoom<SensorData>({
		buildingId,
		nodeType: 'vertical',
		enabled: !!buildingId,
		onMessage: handleVerticalRealtime,
	})

	const handleToggleSaveStatus = async (
		verticalNodeId: string,
		next: boolean,
	) => {
		try {
			await api.patch(`/vertical-node/${verticalNodeId}/status`, {
				status: next,
			})

			queryClient.setQueryData<ResQuery>(
				['get-building-vertical-nodes', buildingId],
				old => {
					if (!old) return old

					return {
						...old,
						vertical_nodes: (old.vertical_nodes ?? []).map((node: any) =>
							node._id === verticalNodeId
								? {
										...node,
										node_status: next,
										save_status: next,
									}
								: node,
						),
					}
				},
			)
		} catch (e) {
			if (isAxiosError(e)) {
				console.error('PATCH failed:', {
					url: `/vertical-node/${verticalNodeId}/status`,
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
				0,
			)
			const endOfDay = new Date(
				selectedDate.getFullYear(),
				selectedDate.getMonth(),
				selectedDate.getDate(),
				23,
				59,
				59,
				999,
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
				999,
			)
			from = first.toISOString()
			to = last.toISOString()
		} else {
			const now = new Date()
			from = new Date(
				now.getTime() - selectedHours * 60 * 60 * 1000,
			).toISOString()
			to = now.toISOString()
		}

		return { doorNum: selectedDoorNum, from, to }
	}, [selectedDoorNum, selectedHours, selectedDate, timeMode, nowTick])

	const { data: graphRaw = [] } = useQuery({
		queryKey: graphRange
			? ['vertical-graph', graphRange.doorNum, graphRange.from, graphRange.to]
			: ['vertical-graph', 'disabled'],
		queryFn: () => fetchVerticalGraph(graphRange!),
		enabled: isGraphOpen && !!graphRange,
		retry: 1,
		refetchInterval: false,
		refetchOnWindowFocus: false,
		staleTime: 4000,
	})

	const { graphData, deltaGraphData } = useMemo(() => {
		if (!selectedDoorNum) return { graphData: [], deltaGraphData: [] }

		const filtered = graphRaw.filter(
			(d: any) => Number(d.doorNum) === Number(selectedDoorNum),
		)

		const sorted = [...filtered].sort(
			(a: any, b: any) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		)

		if (viewMode === 'general') {
			const dataMap: Record<string, any> = {}
			sorted.forEach((item: any) => {
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
			const uniqueKeyMap: Record<string, any> = {}
			sorted.forEach((item: any) => {
				const timeKey = new Date(item.createdAt).toISOString()
				uniqueKeyMap[timeKey] = item
			})
			const uniqueData = Object.values(uniqueKeyMap)
			for (let i = 1; i < uniqueData.length; i++) {
				const current = uniqueData[i] as any
				const prev = uniqueData[i - 1] as any
				const time = new Date(current.createdAt).toISOString()
				delta.push({
					time,
					[`node_${selectedDoorNum}`]: current.angle_x - prev.angle_x,
				})
			}
			return { graphData: [], deltaGraphData: delta }
		}

		const avgDelta: DeltaGraphPoint[] = []
		const chunkSize = 5
		const averages: { time: string; avgX: number }[] = []

		for (let i = 0; i < sorted.length; i += chunkSize) {
			const chunk = sorted.slice(i, i + chunkSize)
			if (chunk.length === 0) continue
			const avgX =
				chunk.reduce((sum: number, node: any) => sum + Number(node.angle_x), 0) /
				chunk.length
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

	const openGraphForDoor = (doorNum: number) => {
		setSelectedDoorNum(doorNum)
		setViewMode('general')
		setIsGraphOpen(true)
	}

	return (
		<div className='w-full h-full bg-gray-50 px-2 md:px-5 pt-0 overflow-hidden'>
			<WhiteHeader
				buildingName={
					buildingData?.building_name ??
					(buildingData as any)?.name ??
					(buildingData as any)?.title ??
					''
				}
			/>

			<div className='lg:-mr-[2%]'>
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
					onOpenGraph={openGraphForDoor}
				/>
			</div>

			<Dialog open={isGraphOpen} onOpenChange={setIsGraphOpen}>
				<DialogPortal>
					<DialogOverlay className='fixed inset-0 bg-black/50 z-[100]' />
					<DialogContent className='z-[300] w-[95vw] max-w-[1200px] h-[90vh] overflow-hidden p-3 sm:p-4'>
						<DialogHeader className='pb-2'>
							<DialogTitle>
								{selectedDoorNum != null
									? `Node-${selectedDoorNum} 그래프`
									: '그래프'}
							</DialogTitle>
						</DialogHeader>

						<div className='h-[82vh] overflow-hidden'>
							<VerticalSensorGraph
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