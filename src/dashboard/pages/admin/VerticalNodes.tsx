/* eslint-disable @typescript-eslint/no-explicit-any */
import WhiteHeader from '@/dashboard/components/shared-dash/verticalHeader'
import socket from '@/hooks/useSocket'
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
 * alive 조회 (AngleNodes와 동일)
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
 * 그래프 데이터 조회 (AngleNodes와 동일 라우터로 통일)
 * GET /api/angle-node/angle-node/data?doorNum=...&from=...&to=...
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


const VerticalNodes = () => {
	const { buildingId } = useParams()
	const queryClient = useQueryClient()

	const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)

	// ✅ 그래프 모달 상태 (UI 유지)
	const [isGraphOpen, setIsGraphOpen] = useState(false)

	// ✅ 그래프 상태
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

	// ---------------- 풍속 데이터 로딩 (AngleNodes와 동일) ---------------- //
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

	// ✅ hour 모드일 때만 nowTick (AngleNodes와 동일)
	useEffect(() => {
		if (timeMode !== 'hour') return
		const id = window.setInterval(() => setNowTick(Date.now()), 60 * 1000)
		return () => clearInterval(id)
	}, [timeMode])

	// ---------------- 메타 (AngleNodes와 동일) ---------------- //
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

	// ---------------- 알람 레벨 초기값 (AngleNodes와 동일) ---------------- //
	useEffect(() => {
		if (buildingData?.alarm_level) {
			setG(buildingData.alarm_level.green)
			setY(buildingData.alarm_level.yellow)
			setR(buildingData.alarm_level.red)
		}
	}, [buildingData])

	// ---------------- 위험 로그 (AngleNodes와 동일) ---------------- //
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

	// ---------------- alive 상태 (AngleNodes와 동일: 폴링 제거) ---------------- //
	const { data: aliveList = [], refetch: refetchAlive } = useQuery({
		queryKey: ['vertical-nodes-alive'],
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

	// ---------------- 카드 표시 리스트 (AngleNodes와 동일: stableNodes + alive) ---------------- //
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

	// ---------------- 소켓 리스너 (AngleNodes와 동일 로직) ---------------- //
	const graphRefetchTimer = useRef<number | null>(null)
	const scheduleGraphRefetch = useCallback(() => {
		if (graphRefetchTimer.current) return
		graphRefetchTimer.current = window.setTimeout(() => {
			queryClient.invalidateQueries({ queryKey: ['vertical-graph'] })
			graphRefetchTimer.current = null
		}, 400)
	}, [queryClient])

	useEffect(() => {
		if (!buildingId) return
		const topic = `socket/building/${buildingId}/vertical-nodes`

		const listener = (newData: SensorData) => {
			console.log('socket vertical-nodes:', newData)
			// ✅ 카드(리스트) 최신값은 소켓으로만 반영
			queryClient.setQueryData<ResQuery>(
				['get-building-vertical-nodes', buildingId],
				old => {
					if (!old) return old
					const list = old.vertical_nodes ?? []
					const idx = list.findIndex(n => n.doorNum === newData.doorNum)

					// ✅ calibrated 우선(없으면 angle fallback) — AngleNodes와 동일
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

			// ✅ 선택 노드 + 모달 열린 상태일 때만 그래프 갱신 (AngleNodes와 동일 패턴)
			if (isGraphOpen && selectedDoorNum === newData.doorNum) {
				scheduleGraphRefetch()
			}
		}

		socket.on(topic, listener)
		return () => {
			socket.off(topic, listener)
		}
	}, [
		buildingId,
		queryClient,
		selectedDoorNum,
		isGraphOpen,
		scheduleGraphRefetch,
	])

	// ---------------- 저장상태 토글 (AngleNodes와 동일) ---------------- //
	const handleToggleSaveStatus = async (doorNum: number, next: boolean) => {
		try {
			await api.patch(`/angle-nodes/${doorNum}/save-status`, {
				save_status: next,
			})
			await refetchAlive() // ✅ 여기서만 다시 1번
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

	// ---------------- 알람 레벨 저장 (AngleNodes와 동일) ---------------- //
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

	// ---------------- 그래프(모달용) (AngleNodes range 로직 동일) ---------------- //
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
		queryFn: () => fetchAngleGraph(graphRange!),
		enabled: isGraphOpen && !!graphRange,
		retry: 1,
		refetchInterval: false, // ✅ AngleNodes처럼 주기 폴링 제거
		refetchOnWindowFocus: false,
		staleTime: 4000,
	})

	// ---------------- 그래프 뷰모드별 변환 (AngleNodes와 동일) ---------------- //
	const { graphData, deltaGraphData } = useMemo(() => {
		if (!selectedDoorNum) return { graphData: [], deltaGraphData: [] }

		const filtered = graphRaw.filter(d => d.doorNum === selectedDoorNum)
		const sorted = filtered.sort(
			(a, b) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		)

		if (viewMode === 'general') {
			const dataMap: Record<string, any> = {}
			sorted.forEach(item => {
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
			sorted.forEach(item => {
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

	const openGraphForDoor = (doorNum: number) => {
		setSelectedDoorNum(doorNum)
		setViewMode('general')
		setIsGraphOpen(true)
	}

	// ---------------- UI는 그대로 유지 ---------------- //
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
