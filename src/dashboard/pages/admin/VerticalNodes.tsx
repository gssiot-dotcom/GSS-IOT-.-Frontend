/* eslint-disable @typescript-eslint/no-explicit-any */
import WhiteHeader from '@/dashboard/components/shared-dash/verticalHeader'
import {
	fetchBuildingVerticalNodes,
	setBuildingAlarmLevelRequest,
} from '@/services/apiRequests'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

type VerticalRealtimePayload = {
	buildingId?: string
	gw_number?: string
	gateway_number?: string
	gatewayNumber?: string

	doorNum?: number | string
	door_num?: number | string

	node_number?: number | string
	nodeNumber?: number | string
	node?: number | string

	angle_x?: number | string
	angle_y?: number | string
	angleX?: number | string
	angleY?: number | string
	x?: number | string
	y?: number | string

	createdAt?: string
	timestamp?: string
	created_at?: string
}

type NormalizedVerticalRealtime = VerticalRealtimePayload & {
	doorNum: number
	node_number: number
	angle_x: number
	angle_y: number
	createdAt: string
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

const toNumberOrNull = (value: unknown): number | null => {
	const n = Number(value)
	return Number.isFinite(n) ? n : null
}

const getGatewayNumber = (item: any) => {
	return item?.gw_number ?? item?.gateway_number ?? item?.gatewayNumber
}

const normalizeVerticalRealtime = (
	item: VerticalRealtimePayload,
): NormalizedVerticalRealtime | null => {
	const doorNum = toNumberOrNull(
		item.doorNum ??
			item.door_num ??
			item.node_number ??
			item.nodeNumber ??
			item.node,
	)

	const nodeNumber = toNumberOrNull(
		item.node_number ?? item.nodeNumber ?? item.node ?? doorNum,
	)

	const angleX = toNumberOrNull(item.angle_x ?? item.angleX ?? item.x)
	const angleY = toNumberOrNull(item.angle_y ?? item.angleY ?? item.y)

	if (
		doorNum == null ||
		nodeNumber == null ||
		angleX == null ||
		angleY == null
	) {
		return null
	}

	return {
		...item,
		doorNum,
		node_number: nodeNumber,
		angle_x: angleX,
		angle_y: angleY,
		createdAt:
			item.createdAt ??
			item.timestamp ??
			item.created_at ??
			new Date().toISOString(),
	}
}

const isSameVerticalNode = (
	node: any,
	data: NormalizedVerticalRealtime,
): boolean => {
	const nodeNumber = toNumberOrNull(
		node?.node_number ?? node?.nodeNumber ?? node?.doorNum ?? node?.door_num,
	)

	const nodeGateway = getGatewayNumber(node)
	const dataGateway = getGatewayNumber(data)

	return (
		nodeNumber === data.node_number &&
		(!nodeGateway ||
			!dataGateway ||
			String(nodeGateway) === String(dataGateway))
	)
}

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
					item?.node_number ??
					item?.nodeNumber ??
					item?.node ??
					doorNum,
			),
			node_number: Number(
				item?.node_number ??
					item?.nodeNumber ??
					item?.doorNum ??
					item?.door_num ??
					item?.node ??
					doorNum,
			),
			createdAt:
				item?.createdAt ??
				item?.timestamp ??
				item?.created_at ??
				item?.time ??
				null,
			angle_x: Number(item?.angle_x ?? item?.angleX ?? item?.x ?? 0),
			angle_y: Number(item?.angle_y ?? item?.angleY ?? item?.y ?? 0),
		}))
		.filter(
			(item: any) =>
				Number.isFinite(item.doorNum) &&
				Number.isFinite(item.node_number) &&
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

		const id = window.setInterval(() => {
			setNowTick(Date.now())
		}, 60 * 1000)

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

	const stableNodes = useMemo(() => {
		return [...verticalNodes].sort((a: any, b: any) => {
			const aDoorNum = Number(a?.doorNum ?? a?.node_number ?? 0)
			const bDoorNum = Number(b?.doorNum ?? b?.node_number ?? 0)

			return aDoorNum - bDoorNum
		})
	}, [verticalNodes])

	useEffect(() => {
		if (!isFirstLoad) return

		if (stableNodes.length) {
			const firstDoorNum = Number(
				(stableNodes[0] as any)?.doorNum ??
					(stableNodes[0] as any)?.node_number,
			)

			if (Number.isFinite(firstDoorNum)) {
				setSelectedDoorNum(firstDoorNum)
				setIsFirstLoad(false)
			}
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

	const nodesForScroll: IAngleNode[] = useMemo(() => {
		return stableNodes
			.map((n: any) => {
				const doorNum = Number(n?.doorNum ?? n?.node_number)
				const nodeNumber = Number(n?.node_number ?? n?.doorNum)

				return {
					...n,
					doorNum,
					node_number: nodeNumber,
					node_alive: typeof n?.node_alive === 'boolean' ? n.node_alive : true,
					save_status:
						typeof n?.node_status === 'boolean'
							? n.node_status
							: typeof n?.save_status === 'boolean'
								? n.save_status
								: undefined,
				}
			})
			.filter((n: any) => Number.isFinite(n.doorNum))
	}, [stableNodes])

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
		if (selectedDoorNum == null) return null

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

		return {
			doorNum: selectedDoorNum,
			from,
			to,
		}
	}, [selectedDoorNum, selectedHours, selectedDate, timeMode, nowTick])

	const appendRealtimeGraphPoint = useCallback(
		(data: NormalizedVerticalRealtime) => {
			if (!isGraphOpen || !graphRange || selectedDoorNum == null) return
			if (Number(selectedDoorNum) !== Number(data.doorNum)) return

			const createdAt = new Date(data.createdAt).toISOString()
			const pointTime = new Date(createdAt).getTime()
			const fromTime = new Date(graphRange.from).getTime()
			const toTime = new Date(graphRange.to).getTime()

			if (!Number.isFinite(pointTime)) return
			if (pointTime < fromTime) return

			if (timeMode !== 'hour' && pointTime > toTime) return

			const point = {
				...data,
				doorNum: data.doorNum,
				node_number: data.node_number,
				createdAt,
				angle_x: data.angle_x,
				angle_y: data.angle_y,
			}

			queryClient.setQueryData<any[]>(
				['vertical-graph', graphRange.doorNum, graphRange.from, graphRange.to],
				old => {
					const list = Array.isArray(old) ? old : []

					const duplicateIndex = list.findIndex(item => {
						return (
							Number(item?.doorNum) === Number(point.doorNum) &&
							new Date(item?.createdAt).getTime() === pointTime
						)
					})

					if (duplicateIndex >= 0) {
						const next = [...list]

						next[duplicateIndex] = {
							...next[duplicateIndex],
							...point,
						}

						return next
					}

					return [...list, point].sort(
						(a, b) =>
							new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
					)
				},
			)
		},
		[queryClient, isGraphOpen, graphRange, selectedDoorNum, timeMode],
	)

	const handleVerticalRealtime = useCallback(
		(newData: SensorData) => {
			console.log('Socket incoming:', newData)

			const normalized = normalizeVerticalRealtime(
				newData as VerticalRealtimePayload,
			)

			if (!normalized) return

			if (
				normalized.buildingId &&
				buildingId &&
				String(normalized.buildingId) !== String(buildingId)
			) {
				return
			}

			queryClient.setQueryData<ResQuery>(
				['get-building-vertical-nodes', buildingId],
				old => {
					if (!old) return old

					const list = old.vertical_nodes ?? []

					const idx = list.findIndex(node =>
						isSameVerticalNode(node, normalized),
					)

					const gatewayNumber = getGatewayNumber(normalized)

					const patch: any = {
						doorNum: normalized.doorNum,
						node_number: normalized.node_number,
						angle_x: normalized.angle_x,
						angle_y: normalized.angle_y,
						node_alive: true,
						createdAt: normalized.createdAt,
					}

					if (gatewayNumber != null) {
						patch.gw_number = gatewayNumber
					}

					if (idx === -1) {
						return {
							...old,
							vertical_nodes: [
								...list,
								{
									_id: crypto.randomUUID(),
									...patch,
									node_status: false,
								} as IAngleNode,
							],
						}
					}

					const next = [...list]

					next[idx] = {
						...next[idx],
						...patch,
					}

					return {
						...old,
						vertical_nodes: next,
					}
				},
			)

			appendRealtimeGraphPoint(normalized)
		},
		[buildingId, queryClient, appendRealtimeGraphPoint],
	)

	useRealtimeRoom<SensorData>({
		buildingId,
		nodeType: 'vertical',
		enabled: !!buildingId,
		onMessage: handleVerticalRealtime,
	})

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
		if (selectedDoorNum == null) {
			return {
				graphData: [],
				deltaGraphData: [],
			}
		}

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

				if (!dataMap[time]) {
					dataMap[time] = { time }
				}

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

			return {
				graphData: [],
				deltaGraphData: delta,
			}
		}

		const avgDelta: DeltaGraphPoint[] = []
		const chunkSize = 5
		const averages: { time: string; avgX: number }[] = []

		for (let i = 0; i < sorted.length; i += chunkSize) {
			const chunk = sorted.slice(i, i + chunkSize)

			if (chunk.length === 0) continue

			const avgX =
				chunk.reduce(
					(sum: number, node: any) => sum + Number(node.angle_x),
					0,
				) / chunk.length

			const time = new Date(chunk[0].createdAt).toISOString()

			averages.push({
				time,
				avgX,
			})
		}

		for (let i = 1; i < averages.length; i++) {
			const d = averages[i].avgX - averages[i - 1].avgX

			avgDelta.push({
				time: averages[i].time,
				[`node_${selectedDoorNum}`]: d,
			})
		}

		return {
			graphData: [],
			deltaGraphData: avgDelta,
		}
	}, [graphRaw, selectedDoorNum, viewMode])

	const openGraphForDoor = (doorNum: number) => {
		setSelectedDoorNum(Number(doorNum))
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
					onSetAlarmLevels={handleSetAlarmLevels}
					alertLogs={alertLogs}
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
