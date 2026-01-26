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

const AngleNodes = () => {
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

	const { buildingId } = useParams()
	const queryClient = useQueryClient()

	const [windHistory, setWindHistory] = useState<WindPoint[]>([])
	const [G, setG] = useState(0)
	const [Y, setY] = useState(0)
	const [R, setR] = useState(0)
	const [alertLogs, setAlertLogs] = useState<any[]>([])
	const [isFirstLoad, setIsFirstLoad] = useState(true)

	/** ✅ wind 재조회 함수 (그래프 업데이트될 때마다 무조건 호출) */
	const refetchWind = useCallback(async () => {
		if (!buildingId) return
		try {
			const res = await api.get(`/weather/${buildingId}/wind-series`)
			setWindHistory(res.data?.data ?? [])
		} catch (e) {
			console.error('풍속 데이터 불러오기 실패:', e)
		}
	}, [buildingId])

	/** ✅ (변경) wind 폴링 제거: 최초 1회만 */
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

	/** ✅ 카드(리스트)는 소켓으로 최신값 갱신되므로 metaData 기반만 정렬해서 사용 */
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
	 * ✅ graphRange는 fetch 파라미터용 (key 안정화 때문에 key에는 from/to 안 넣음)
	 * ========================= */
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
			// hour
			const now = new Date()
			from = new Date(
				now.getTime() - selectedHours * 60 * 60 * 1000,
			).toISOString()
			to = now.toISOString()
		}

		return { doorNum: selectedDoorNum ?? -1, from, to }
	}, [selectedDoorNum, selectedHours, selectedDate, timeMode, viewMode])

	/** ✅ queryKey 안정화용 dateKey */
	const dateKey = useMemo(() => {
		if (!selectedDate) return 'no-date'
		return `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`
	}, [selectedDate])

	/** ✅ (변경) queryKey 안정화: from/to를 key에 넣지 않음 */
	const graphKey = useMemo(() => {
		if (!selectedDoorNum || viewMode === 'top6')
			return ['angle-graph', 'disabled']
		return ['angle-graph', selectedDoorNum, timeMode, selectedHours, dateKey]
	}, [selectedDoorNum, viewMode, timeMode, selectedHours, dateKey])

	// ---------------- top6 그래프 ---------------- //
	const topQueries = useQueries({
		queries: (topDoorNums ?? []).map(dn => ({
			queryKey: ['angle-graph-top', dn, timeMode, selectedHours, dateKey],
			queryFn: () =>
				fetchAngleGraph({
					doorNum: dn,
					from: graphRange!.from,
					to: graphRange!.to,
				}),
			enabled: !!graphRange && !!dn && viewMode === 'top6',
			retry: 1,
			refetchInterval: false,
			refetchOnWindowFocus: false,
			staleTime: Infinity, // ✅ 소켓이 갱신하므로
		})),
	})

	const top6GraphData = useMemo(() => {
		if (viewMode !== 'top6' || !topDoorNums?.length) return []

		const map = new Map<string, any>()

		topDoorNums.forEach((dn, idx) => {
			const arr = (topQueries[idx]?.data ?? []) as SensorData[]
			arr.forEach(item => {
				const t = new Date(item.createdAt).toISOString()
				if (!map.has(t)) map.set(t, { time: t })
				map.get(t)![`node_${dn}`] = item.angle_x
			})
		})

		return Array.from(map.values())
			.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
			.map(p => ({ ...p, timestamp: new Date(p.time).getTime() }))
	}, [viewMode, topDoorNums, topQueries])

	// ---------------- 그래프 데이터 (초기 로드만) ---------------- //
	const { data: graphRaw = [] } = useQuery({
		queryKey: graphKey,
		queryFn: () => fetchAngleGraph(graphRange!),
		enabled: !!graphRange && viewMode !== 'top6' && !!selectedDoorNum,
		retry: 1,
		refetchInterval: false,
		refetchOnWindowFocus: false,
		staleTime: Infinity,
	})

	// ---------------- 그래프 뷰모드별 변환 ---------------- //
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

	/** =========================
	 * ✅ 소켓에서 그래프 캐시 append/replace + trim
	 * ========================= */
	const selectedDoorNumRef = useRef<number | null>(null)
	const viewModeRef = useRef(viewMode)
	const topDoorNumsRef = useRef<number[] | null>(null)
	const timeModeRef = useRef(timeMode)
	const selectedHoursRef = useRef(selectedHours)
	const selectedDateRef = useRef<Date | null>(selectedDate)
	const dateKeyRef = useRef(dateKey)

	useEffect(() => {
		selectedDoorNumRef.current = selectedDoorNum
	}, [selectedDoorNum])
	useEffect(() => {
		viewModeRef.current = viewMode
	}, [viewMode])
	useEffect(() => {
		topDoorNumsRef.current = topDoorNums
	}, [topDoorNums])
	useEffect(() => {
		timeModeRef.current = timeMode
	}, [timeMode])
	useEffect(() => {
		selectedHoursRef.current = selectedHours
	}, [selectedHours])
	useEffect(() => {
		selectedDateRef.current = selectedDate
	}, [selectedDate])
	useEffect(() => {
		dateKeyRef.current = dateKey
	}, [dateKey])

	const calcWindow = useCallback((refTimeMs: number) => {
		const tm = timeModeRef.current
		const sd = selectedDateRef.current
		const hours = selectedHoursRef.current

		let fromT: number
		let toT: number

		if (tm === 'day' && sd) {
			const start = new Date(
				sd.getFullYear(),
				sd.getMonth(),
				sd.getDate(),
				0,
				0,
				0,
				0,
			)
			const end = new Date(
				sd.getFullYear(),
				sd.getMonth(),
				sd.getDate(),
				23,
				59,
				59,
				999,
			)
			fromT = start.getTime()
			toT = end.getTime()
		} else if (tm === 'week') {
			const base = sd ?? new Date()
			const day = base.getDay()
			const diffToMonday = (day + 6) % 7
			const monday = new Date(base)
			monday.setDate(base.getDate() - diffToMonday)
			monday.setHours(0, 0, 0, 0)
			const sunday = new Date(monday)
			sunday.setDate(monday.getDate() + 6)
			sunday.setHours(23, 59, 59, 999)
			fromT = monday.getTime()
			toT = sunday.getTime()
		} else if (tm === 'month') {
			const base = sd ?? new Date()
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
			fromT = first.getTime()
			toT = last.getTime()
		} else {
			// hour: 새 데이터 시간 기준으로 슬라이딩
			toT = refTimeMs
			fromT = toT - hours * 60 * 60 * 1000
		}

		return { fromT, toT }
	}, [])

	const upsertGraphCache = useCallback(
		(queryKeyForCache: any[], newData: SensorData) => {
			const t = new Date(newData.createdAt).getTime()
			if (Number.isNaN(t)) return false

			const { fromT, toT } = calcWindow(t)

			// 범위 밖 데이터는 무시
			if (t < fromT || t > toT) return false

			queryClient.setQueryData<SensorData[]>(queryKeyForCache, (old = []) => {
				const sameDoor = old.filter(x => x.doorNum === newData.doorNum)

				const idx = sameDoor.findIndex(x => x.createdAt === newData.createdAt)
				let next =
					idx >= 0
						? sameDoor.map((x, i) => (i === idx ? newData : x))
						: [...sameDoor, newData]

				next.sort(
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
				)
				next = next.filter(x => {
					const tt = new Date(x.createdAt).getTime()
					return tt >= fromT && tt <= toT
				})

				return next
			})

			return true // ✅ 그래프가 실제로 업데이트되었음을 반환
		},
		[calcWindow, queryClient],
	)

	// ---------------- 소켓 리스너: 카드 + 그래프 캐시 갱신 ---------------- //
	useEffect(() => {
		if (!buildingId) return
		const topic = `socket/building/${buildingId}/angle-nodes`

		const listener = (newData: SensorData) => {
			// ✅ 1) 카드(리스트) 최신값 업데이트
			queryClient.setQueryData<ResQuery>(
				['get-building-angle-nodes', buildingId],
				old => {
					if (!old) return old
					const list = old.angle_nodes ?? []
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
							angle_nodes: [
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

					return { ...old, angle_nodes: next }
				},
			)

			// ✅ 2) 그래프 캐시 upsert (invalidate 없이!)
			const vm = viewModeRef.current
			const dk = dateKeyRef.current
			const tm = timeModeRef.current
			const hours = selectedHoursRef.current

			let graphUpdated = false

			if (vm === 'top6') {
				const top = topDoorNumsRef.current ?? []
				if (top.includes(newData.doorNum)) {
					const key = ['angle-graph-top', newData.doorNum, tm, hours, dk]
					graphUpdated = upsertGraphCache(key, newData)
				}
			} else {
				const sel = selectedDoorNumRef.current
				if (sel === newData.doorNum && sel != null) {
					const key = ['angle-graph', sel, tm, hours, dk]
					graphUpdated = upsertGraphCache(key, newData)
				}
			}

			// ✅ 3) "그래프가 업데이트되면 무조건 wind 재호출"
			if (graphUpdated) {
				refetchWind()
			}
		}

		socket.on(topic, listener)
		return () => {
			socket.off(topic, listener)
		}
	}, [buildingId, queryClient, upsertGraphCache, refetchWind])

	/** ✅ 저장상태 토글도 /api 로 통일 */
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
					url: `/angle-node/${doorNum}/save-status`,
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

	return (
		<div className='w-full max-h-screen bg-gray-50 px-2 md:px-5 pt-0 overflow-hidden'>
			<WhiteHeader
				buildingName={
					buildingData?.building_name ??
					buildingData?.name ??
					buildingData?.title ??
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
