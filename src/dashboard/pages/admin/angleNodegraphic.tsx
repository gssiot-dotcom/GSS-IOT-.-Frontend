/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ReferenceArea,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts'

interface GraphDataPoint {
	time: string
	angle_x: number
	angle_y: number
	wind_speed?: number
	nodeId?: string
}

type SensorGraphProps = {
	buildingId: string | undefined
	doorNum: number | null
	graphData: GraphDataPoint[]
	hours: number
	onSelectTime: (time: number) => void
}

const SensorGraph: React.FC<SensorGraphProps> = ({
	doorNum,
	graphData,
	hours,
	onSelectTime,
}) => {
	const containerRef = useRef<HTMLDivElement>(null)
	const [data, setData] = useState<GraphDataPoint[]>(graphData)
	const isMobile = useMediaQuery('(max-width: 640px)')
	const isTablet = useMediaQuery('(max-width: 1024px)')

	useEffect(() => setData(graphData), [graphData])

	// 사용자의 위치 기반 풍속 데이터 가져오기
	useEffect(() => {
		const fetchWindData = async (lat: number, lon: number) => {
			try {
				const response = await fetch(
					`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=f9d0ac2f06dd719db58be8c04d008e76&units=metric`
				)
				if (!response.ok) throw new Error('Failed to fetch wind data')

				const weatherData = await response.json()
				const windDataMap: Record<string, number> = {}

				weatherData.list.forEach((item: any) => {
					const time = item.dt_txt.slice(11, 16)
					windDataMap[time] = item.wind.speed
				})

				const mergedData = graphData.map(d => {
					const closestTime = Object.keys(windDataMap).reduce((prev, curr) => {
						return Math.abs(
							Number(curr.replace(':', '')) - Number(d.time.replace(':', ''))
						) <
							Math.abs(
								Number(prev.replace(':', '')) - Number(d.time.replace(':', ''))
							)
							? curr
							: prev
					})
					return { ...d, wind_speed: windDataMap[closestTime] || 0 }
				})

				setData(mergedData)
			} catch (error) {
				console.error('풍속 데이터 가져오기 실패:', error)
				setData(graphData)
			}
		}

		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				position => {
					const { latitude, longitude } = position.coords
					fetchWindData(latitude, longitude)
				},
				error => {
					console.warn('사용자 위치 가져오기 실패:', error)
					setData(graphData)
				}
			)
		} else {
			console.warn('Geolocation API를 지원하지 않는 브라우저입니다.')
			setData(graphData)
		}
	}, [graphData])

	const getYRange = () => {
		if (!data || data.length === 0) return [-0.6, 0.6]
		const values = data.flatMap(d => [d.angle_x, d.angle_y])
		const minVal = Math.min(...values, -0.6)
		const maxVal = Math.max(...values, 0.6)
		return [minVal, maxVal]
	}

	const [yMin, yMax] = getYRange()

	const getYAxisTicks = () => {
		const step = 0.2
		const ticks: number[] = []
		const lower = Math.floor(yMin / step) * step
		const upper = Math.ceil(yMax / step) * step
		for (let v = lower; v <= upper; v += step)
			ticks.push(parseFloat(v.toFixed(1)))
		return ticks
	}

	const yTicks = getYAxisTicks()

	const labelStep = (() => {
		const len = data.length
		if (isMobile) return len > 90 ? 12 : len > 60 ? 8 : len > 30 ? 6 : 3
		return len > 120 ? 12 : len > 80 ? 8 : len > 40 ? 6 : 3
	})()

	const getChartMargins = () => {
		if (isMobile) return { top: 10, right: 10, left: 0, bottom: 18 }
		if (isTablet) return { top: 15, right: 20, left: 5, bottom: 22 }
		return { top: 20, right: 30, left: 20, bottom: 26 }
	}

	const formatXAxisTick = (value: string) =>
		isMobile ? value.split(':')[0] : value

	return (
		<div className='mx-auto pb-5'>
			<Card className='ml-auto w-[55vw] border shadow-sm border-slate-400 mt-[2.5vh]'>
				<CardHeader className='p-3 sm:p-4 space-y-2'>
					<div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2'>
						<CardTitle className='text-sm md:text-lg text-gray-900'>
							비계전도 실시간 데이터{' '}
							{doorNum !== null && (
								<span className='text-blue-400 font-bold'>Node-{doorNum}</span>
							)}
						</CardTitle>

						<div className='flex flex-row items-center justify-between sm:justify-end gap-3'>
							<div className='flex items-center gap-x-2'>
								<label
									htmlFor='time-filter'
									className='text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap'
								>
									기간:
								</label>
								<Select
									value={hours.toString()}
									onValueChange={v => onSelectTime(Number(v))}
								>
									<SelectTrigger className='h-6 w-[90px] sm:w-[120px] text-xs sm:text-sm border border-slate-400'>
										<SelectValue placeholder='Select time' />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='1' className='text-xs sm:text-sm'>
											1 시간
										</SelectItem>
										<SelectItem value='6' className='text-xs sm:text-sm'>
											6 시간
										</SelectItem>
										<SelectItem value='12' className='text-xs sm:text-sm'>
											12 시간
										</SelectItem>
										<SelectItem value='24' className='text-xs sm:text-sm'>
											24 시간
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<Badge variant='outline' className='h-6 text-xs border-slate-400'>
								데이터 수: {data.length}
							</Badge>
						</div>
					</div>
				</CardHeader>

				<CardContent className='p-0 pt-2' ref={containerRef}>
					<div className='w-full h-full pb-4 px-1 sm:px-2'>
						<ResponsiveContainer width='104%' height={330}>
							<LineChart
								key={data.length}
								data={data}
								margin={getChartMargins()}
							>
								<CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
								<XAxis
									dataKey='time'
									tick={{ fontSize: isMobile ? 9 : 12 }}
									tickFormatter={formatXAxisTick}
									height={isMobile ? 20 : 30}
									tickMargin={isMobile ? 5 : 10}
									minTickGap={isMobile ? 15 : 30}
									interval={labelStep}
								/>
								<YAxis
									yAxisId='angle'
									domain={[yMin, yMax]}
									tick={{ fontSize: isMobile ? 9 : 12 }}
									width={isMobile ? 25 : 35}
									tickMargin={isMobile ? 2 : 5}
									ticks={yTicks}
								/>
								<YAxis
									yAxisId='wind'
									orientation='right'
									tick={{ fontSize: isMobile ? 9 : 12 }}
									width={isMobile ? 25 : 35}
									tickMargin={isMobile ? 2 : 5}
								/>

								<Tooltip
									contentStyle={{
										backgroundColor: 'white',
										border: '1px solid #ccc',
										borderRadius: '8px',
										fontSize: isMobile ? '12px' : '14px',
										padding: isMobile ? '4px' : '8px',
									}}
									itemStyle={{ padding: isMobile ? '1px 0' : '2px 0' }}
									labelStyle={{ marginBottom: isMobile ? '2px' : '5px' }}
								/>

								{!isMobile && (
									<Legend
										wrapperStyle={{
											fontSize: '12px',
											marginBottom: '-10px',
											paddingTop: '10px',
										}}
									/>
								)}

								{yMin < -0.6 && (
									<ReferenceArea
										yAxisId='angle'
										y1={yMin}
										y2={-0.6}
										fill='#ef4444'
										fillOpacity={0.1}
									/>
								)}
								{yMax > 0.6 && (
									<ReferenceArea
										yAxisId='angle'
										y1={0.6}
										y2={yMax}
										fill='#ef4444'
										fillOpacity={0.1}
									/>
								)}

								<ReferenceArea
									yAxisId='angle'
									y1={-0.6}
									y2={-0.4}
									fill='#eab308'
									fillOpacity={0.1}
								/>
								<ReferenceArea
									yAxisId='angle'
									y1={0.4}
									y2={0.6}
									fill='#eab308'
									fillOpacity={0.1}
								/>
								<ReferenceArea
									yAxisId='angle'
									y1={-0.4}
									y2={-0.2}
									fill='#22c55e'
									fillOpacity={0.1}
								/>
								<ReferenceArea
									yAxisId='angle'
									y1={0.2}
									y2={0.4}
									fill='#22c55e'
									fillOpacity={0.1}
								/>
								<ReferenceArea
									yAxisId='angle'
									y1={-0.2}
									y2={0.2}
									fill='#3b82f6'
									fillOpacity={0.1}
								/>

								<ReferenceLine y={0.3} yAxisId='angle' strokeDasharray='5 5' />
								<ReferenceLine y={-0.3} yAxisId='angle' strokeDasharray='5 5' />

								<Line
									yAxisId='angle'
									type='monotone'
									dataKey='angle_x'
									stroke='#ef4444'
									strokeWidth={isMobile ? 1.5 : 2}
									dot={false}
									name='Angle X'
								/>
								<Line
									yAxisId='angle'
									type='monotone'
									dataKey='angle_y'
									stroke='#3b82f6'
									strokeWidth={isMobile ? 1.5 : 2}
									dot={false}
									name='Angle Y'
								/>
								<Line
									yAxisId='wind'
									type='monotone'
									dataKey='wind_speed'
									stroke='#22c55e'
									strokeWidth={isMobile ? 1.5 : 2}
									dot={false}
									name='Wind Speed (m/s)'
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default SensorGraph
