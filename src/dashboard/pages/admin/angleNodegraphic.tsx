// SensorGraph.jsx

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Label,
} from 'recharts'
import WeatherInfo from '@/dashboard/components/shared-dash/WeatherInfographic'
import { useWeather } from '@/hooks/useWeatherInfo'

// useMediaQuery 훅
const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const mediaQueryList = window.matchMedia(query)
            setMatches(mediaQueryList.matches)

            const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
            mediaQueryList.addEventListener('change', listener)

            return () => mediaQueryList.removeEventListener('change', listener)
        }
    }, [query])

    return matches
}

// 타입 정의
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

export interface AvgDeltaDataPoint {
    time: string
    avgX: number
}

type SensorGraphProps = {
    buildingId: string | undefined
    doorNum: number | null
    graphData: GraphDataPoint[] | DeltaGraphPoint[] | AvgDeltaDataPoint[]
    hours: number
    onSelectTime: (time: number) => void
    R?: number
    Y?: number
    G?: number
    B?: number
    viewMode: 'general' | 'delta' | 'avgDelta'
}

const SensorGraph: React.FC<SensorGraphProps> = ({
    doorNum,
    graphData,
    hours,
    onSelectTime,
    R = 0,
    Y = 0,
    G = 0,
    B = 0,
    viewMode,
}) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [data, setData] = useState<
        GraphDataPoint[] | DeltaGraphPoint[] | AvgDeltaDataPoint[]
    >(graphData)

    const isMobile = useMediaQuery('(max-width: 640px)')
    const isTablet = useMediaQuery('(max-width: 1024px)')

    const { weather } = useWeather()

    // 일반 데이터 업데이트
    useEffect(() => setData(graphData), [graphData])

    // 풍속 병합
    useEffect(() => {
        if (viewMode !== 'general') {
            setData(graphData)
            return
        }

        if (!weather?.windSpeed) {
            setData(graphData)
            return
        }

        const merged = (graphData as GraphDataPoint[]).map(d => ({
            ...d,
            wind_speed: weather.windSpeed, // ✅ 현재 풍속 값 그대로 붙여줌
        }))

        setData(merged)
    }, [graphData, viewMode, weather?.windSpeed])

    // --- Y축 도메인 계산 ---
    const getYDomainAndTicks = (
        data: GraphDataPoint[] | DeltaGraphPoint[] | AvgDeltaDataPoint[]
    ) => {
        if (!data || data.length === 0)
            return { domain: [-5, 5], ticks: [-5, 0, 5] }

        if (viewMode === 'general') {
            const values = data.flatMap(d => {
                const point = d as GraphDataPoint
                return [point.angle_x, point.angle_y]
            })
            if (values.length === 0) return { domain: [-5, 5], ticks: [-5, 0, 5] }
            const minVal = Math.min(...values)
            const maxVal = Math.max(...values)
            let domain: [number, number] = [-5, 5]
            let ticks: number[] = [-5, 0, 5]
            if (minVal < -5 || maxVal > 5) {
                domain = [-10, 10]
                ticks = [-10, 0, 10]
            }
            if (minVal < -10 || maxVal > 10) {
                domain = [-15, 15]
                ticks = [-15, 0, 15]
            }
            return { domain, ticks }
        } else if (viewMode === 'delta') {
            const values = data.flatMap(d => {
                const point = d as DeltaGraphPoint
                return Object.keys(point)
                    .filter(key => key !== 'time')
                    .map(key => point[key] as number)
            })
            if (values.length === 0) return { domain: [-5, 5], ticks: [-5, 0, 5] }
            const maxAbs = Math.max(...values.map(Math.abs))

            let boundary: number
            if (maxAbs > 10) {
                boundary = 15
            } else if (maxAbs > 5) {
                boundary = 10
            } else {
                boundary = 5
            }

            return { domain: [-boundary, boundary], ticks: [-boundary, 0, boundary] }
        } else {
            const values = data.flatMap(d => {
                const point = d as AvgDeltaDataPoint
                return [point.avgX]
            })
            if (values.length === 0) return { domain: [-5, 5], ticks: [-5, 0, 5] }
            const maxAbs = Math.max(...values.map(Math.abs))

            let boundary: number
            if (maxAbs > 10) {
                boundary = 15
            } else if (maxAbs > 5) {
                boundary = 10
            } else {
                boundary = 5
            }

            return { domain: [-boundary, boundary], ticks: [-boundary, 0, boundary] }
        }
    }

    const { domain: yDomain, ticks: yTicks } = getYDomainAndTicks(data)

    // --- 풍속 Y축 도메인 ---
    const getWindDomainAndTicks = (data: GraphDataPoint[]) => {
        const maxWind = Math.max(...data.map(d => d.wind_speed || 0))
        const top = Math.ceil(maxWind / 10) * 10 || 20
        const ticks: number[] = []

        for (let i = 0; i <= top; i += 10) {
            ticks.push(i)
        }
        if (top >= 5 && !ticks.includes(5)) {
            ticks.splice(1, 0, 5)
        }

        return { domain: [0, top], ticks }
    }

    const { domain: windDomain, ticks: windTicks } = getWindDomainAndTicks(
        data as GraphDataPoint[]
    )

    // --- X축 도메인 ---
    const getXAxisTicksAndDomain = (
        hours: number
    ): { ticks: number[]; domain: [number, number] } => {
        const now = new Date()
        const ticks = []
        let startPoint
        let endPoint

        if (hours === 1) {
            const roundedMinutes = Math.ceil(now.getMinutes() / 10) * 10
            endPoint = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours(),
                roundedMinutes,
                0
            )
            startPoint = new Date(endPoint.getTime() - 60 * 60 * 1000)

            for (let i = 0; i <= 6; i++) {
                const tickTime = new Date(startPoint.getTime() + i * 10 * 60 * 1000)
                ticks.push(tickTime.getTime())
            }
        } else if (hours === 24) {
            endPoint = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours() + 1,
                0,
                0
            )
            startPoint = new Date(endPoint.getTime() - 24 * 60 * 60 * 1000)

            for (let i = 0; i <= 6; i++) {
                const tickTime = new Date(startPoint.getTime() + i * 4 * 60 * 60 * 1000)
                ticks.push(tickTime.getTime())
            }
        } else {
            endPoint = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours() + (now.getMinutes() > 0 ? 1 : 0),
                0,
                0
            )
            startPoint = new Date(endPoint.getTime() - hours * 60 * 60 * 1000)

            for (let i = 0; i <= hours; i++) {
                const tickTime = new Date(startPoint.getTime() + i * 60 * 60 * 1000)
                ticks.push(tickTime.getTime())
            }
        }

        const domain = [startPoint.getTime(), endPoint.getTime()] as [
            number,
            number
        ]

        return { ticks, domain }
    }

    const { ticks: xAxisTicks, domain: xAxisDomain } =
        getXAxisTicksAndDomain(hours)

    // --- 데이터 타임스탬프 변환 ---
    const transformedData = data.map(d => {
        const [h, m] = d.time.split(':').map(Number)
        const now = new Date()
        const dataDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            h,
            m,
            0,
            0
        )

        if (hours < 24) {
            if (dataDate.getTime() > now.getTime()) {
                dataDate.setDate(dataDate.getDate() - 1)
            }
        } else {
            if (dataDate.getTime() > now.getTime()) {
                dataDate.setDate(dataDate.getDate() - 1)
            }
            if (dataDate.getTime() < xAxisDomain[0]) {
                dataDate.setDate(dataDate.getDate() - 1)
            }
        }

        return {
            ...d,
            timestamp: dataDate.getTime(),
        }
    })

    const finalData = transformedData

    // --- Chart UI Helper ---
    const getChartMargins = () => {
        if (isMobile) return { top: 10, right: 10, left: 0, bottom: 18 }
        if (isTablet) return { top: 15, right: 20, left: 5, bottom: 22 }
        return { top: -20, right: 50, left: -20, bottom: 30 }
    }

    const formatXAxisTick = (value: number) => {
        const date = new Date(value)
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${hours}:${minutes}`
    }

    const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(value, max))

    const formatYAxisTick = (value: number): string => {
        return value.toString()
    }

    const formatTooltipValue = (value: number, name: string) => {
        if (name.includes('변화량') || name.includes('평균변화')) {
            return value.toFixed(2)
        }
        return value
    }

    const formatTooltipLabel = (value: number) => {
        const date = new Date(value)
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${hours}:${minutes}`
    }


    return (
        <div className='ml-auto h-full w-full sm:w-[95%] md:w-[85%] lg:w-[69.4%] 2xl:w-[68.8%] pb-5 md:-mr-2 2xl:-mr-5 2xl:h-[20%]'>
            <Card className='w-full border shadow-sm border-slate-400 mt-4 sm:mt-6'>
                <CardHeader className="p-3 sm:p-4 space-y-2">
                    {/* 제목 + 오른쪽 컨트롤 (같은 줄) */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        {/* 제목 */}
                        <CardTitle className="text-sm sm:text-base md:text-lg text-gray-900">
                            비계전도 실시간 데이터{" "}
                            {viewMode === "general" && doorNum !== null && (
                                <span className="text-blue-400 font-bold text-sm sm:text-base md:text-lg">
                                    Node-{doorNum}
                                </span>
                            )}
                            {viewMode === "delta" && doorNum !== null && (
                                <span className="text-purple-400 font-bold text-sm sm:text-base md:text-lg">
                                    Node-{doorNum} (변화량)
                                </span>
                            )}
                            {viewMode === "avgDelta" && doorNum !== null && (
                                <span className="text-green-400 font-bold text-sm sm:text-base md:text-lg">
                                    Node-{doorNum} (평균변화)
                                </span>
                            )}
                        </CardTitle>

                        {/* 오른쪽 컨트롤 */}
                        <div className="flex flex-row items-center justify-between sm:justify-end gap-3">
                            {/* 기간 선택기 */}
                            <div className="flex items-center gap-x-2">
                                <label
                                    htmlFor="time-filter"
                                    className="text-xs font-medium text-gray-700 whitespace-nowrap"
                                >
                                    기간:
                                </label>
                                <Select
                                    value={hours.toString()}
                                    onValueChange={v => onSelectTime(Number(v))}
                                >
                                    <SelectTrigger className="h-3 sm:h-6 w-[90px] sm:w-[120px] text-xs md:text-sm border border-slate-400">
                                        <SelectValue placeholder="Select time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1" className="text-xs md:text-sm">
                                            1 시간
                                        </SelectItem>
                                        <SelectItem value="6" className="text-xs md:text-sm">
                                            6 시간
                                        </SelectItem>
                                        <SelectItem value="12" className="text-xs md:text-sm">
                                            12 시간
                                        </SelectItem>
                                        <SelectItem value="24" className="text-xs md:text-sm">
                                            24 시간
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 도어번호 / 데이터 수 */}
                            <Badge
                                variant="outline"
                                className="h-3 sm:h-6 text-xs md:text-sm border-slate-400"
                            >
                                데이터 수: {data.length}
                            </Badge>
                        </div>
                    </div>

                    {/* 날씨 정보 → 제목 아래 전체 너비 */}
                    <div className="flex items-center px-2 py-1">
                        <WeatherInfo />
                    </div>
                </CardHeader>



                <CardContent
                    className='p-0 pt-2 overflow-x-hidden overflow-visible'
                    ref={containerRef}
                >
                    <div className='w-full h-[280px] sm:h-[320px] md:h-[350px] lg:h-[37.8vh] 2xl:h-[46.5vh] px-1 sm:px-2 '>
                        <ResponsiveContainer
                            width={viewMode === 'general' ? '108%' : '100%'}
                            height='100%'
                        >
                            <LineChart
                                key={finalData.length}
                                data={finalData as any}
                                margin={getChartMargins()}
                            >
                                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                                {/* X축 - 시간 */}
                                <XAxis
                                    dataKey='timestamp'
                                    domain={xAxisDomain}
                                    tick={{ fontSize: isMobile ? 9 : 12 }}
                                    tickFormatter={formatXAxisTick}
                                    height={isMobile ? 30 : 40}
                                    tickMargin={isMobile ? 5 : 10}
                                    ticks={xAxisTicks}
                                    type='number'
                                >
                                    <Label
                                        position="bottom"
                                        content={({ viewBox }) => {
                                            const { x, y, width } = viewBox as any
                                            const centerX = x + width / 2
                                            return (
                                                <text
                                                    x={centerX}
                                                    y={y + 50}
                                                    textAnchor="middle"
                                                    style={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold", fill: "#000" }}
                                                >
                                                    시간
                                                </text>
                                            )
                                        }}
                                    />
                                </XAxis>
                                <YAxis
                                    yAxisId="angle"
                                    domain={yDomain}
                                    ticks={yTicks}
                                    tick={{ fontSize: isMobile ? 9 : 12 }}
                                    width={isMobile ? 40 : 60}
                                    tickMargin={isMobile ? 2 : 5}
                                    tickFormatter={formatYAxisTick}
                                >
                                    <Label
                                        position="left"
                                        offset={0}
                                        content={({ viewBox }) => {
                                            const { x, y, height } = viewBox as any
                                            const centerY = y + height / 2 // 세로 중앙
                                            const posX = x + 31            // 고정된 X 좌표
                                            return (
                                                <text
                                                    x={posX}
                                                    y={centerY}
                                                    textAnchor="middle"
                                                    style={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold" }}
                                                >
                                                    <tspan x={posX} dy="-0.6em">기</tspan>
                                                    <tspan x={posX} dy="1.2em">울</tspan>
                                                    <tspan x={posX} dy="1.2em">기</tspan>
                                                </text>
                                            )
                                        }}
                                    />
                                </YAxis>

                                {/* 오른쪽 Y축 - 풍속 */}
                                {viewMode === "general" && (
                                    <YAxis
                                        yAxisId="wind"
                                        orientation="right"
                                        domain={windDomain}
                                        ticks={windTicks}
                                        tick={{ fontSize: isMobile ? 9 : 12 }}
                                        width={isMobile ? 40 : 60}
                                        tickMargin={isMobile ? 2 : 5}
                                    >
                                        <Label
                                            position="right"
                                            offset={0}
                                            content={({ viewBox }) => {
                                                const { x, y, height } = viewBox as any
                                                const centerY = y + height / 2
                                                const posX = x + 35            // 고정된 X 좌표
                                                return (
                                                    <text
                                                        x={posX}
                                                        y={centerY}
                                                        textAnchor="middle"
                                                        style={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold" }}
                                                    >
                                                        <tspan x={posX} dy="0">풍</tspan>
                                                        <tspan x={posX} dy="1.2em">속</tspan>
                                                    </text>
                                                )
                                            }}
                                        />
                                    </YAxis>
                                )}

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
                                    formatter={formatTooltipValue}
                                    labelFormatter={formatTooltipLabel}
                                />

                                {!isMobile && (
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        layout="horizontal"
                                        wrapperStyle={{
                                            position: "absolute",
                                            top: -20,   // 그래프 안쪽 위에서 조금 내려옴
                                            right: 100, // 그래프 오른쪽 안쪽으로 들어옴
                                            fontSize: "12px",
                                            borderRadius: "6px",
                                            padding: "2px 6px",
                                            zIndex: 1,
                                        }}
                                    />
                                )}




                                {viewMode === 'general' && (
                                    <>
                                        {/* 위험 (빨강) */}
                                        <ReferenceArea yAxisId="angle" y1={yDomain[0]} y2={clamp(-R, yDomain[0], yDomain[1])} fill="#ef4444" fillOpacity={0.1} />
                                        <ReferenceArea yAxisId="angle" y1={clamp(R, yDomain[0], yDomain[1])} y2={yDomain[1]} fill="#ef4444" fillOpacity={0.1} />

                                        {/* 경고 (노랑) */}
                                        <ReferenceArea yAxisId="angle" y1={clamp(-R, yDomain[0], yDomain[1])} y2={clamp(-Y, yDomain[0], yDomain[1])} fill="#eab308" fillOpacity={0.1} />
                                        <ReferenceArea yAxisId="angle" y1={clamp(Y, yDomain[0], yDomain[1])} y2={clamp(R, yDomain[0], yDomain[1])} fill="#eab308" fillOpacity={0.1} />

                                        {/* 주의 (초록) */}
                                        <ReferenceArea yAxisId="angle" y1={clamp(-Y, yDomain[0], yDomain[1])} y2={clamp(-G, yDomain[0], yDomain[1])} fill="#22c55e" fillOpacity={0.1} />
                                        <ReferenceArea yAxisId="angle" y1={clamp(G, yDomain[0], yDomain[1])} y2={clamp(Y, yDomain[0], yDomain[1])} fill="#22c55e" fillOpacity={0.1} />

                                        {/* 정상 (파랑) */}
                                        <ReferenceArea yAxisId="angle" y1={clamp(-G, yDomain[0], yDomain[1])} y2={clamp(-B, yDomain[0], yDomain[1])} fill="#3b82f6" fillOpacity={0.1} />
                                        <ReferenceArea yAxisId="angle" y1={clamp(B, yDomain[0], yDomain[1])} y2={clamp(G, yDomain[0], yDomain[1])} fill="#3b82f6" fillOpacity={0.1} />
                                        <ReferenceArea yAxisId="angle" y1={clamp(-B, yDomain[0], yDomain[1])} y2={clamp(B, yDomain[0], yDomain[1])} fill="#3b82f6" fillOpacity={0.1} />
                                    </>
                                )}




                                {viewMode === 'general' ? (
                                    <>
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
                                    </>
                                ) : viewMode === 'delta' ? (
                                    <Line
                                        yAxisId='angle'
                                        type='monotone'
                                        dataKey={`node_${doorNum}`}
                                        stroke='#8b5cf6'
                                        strokeWidth={isMobile ? 1.5 : 2}
                                        dot={false}
                                        name={`Node-${doorNum} (변화량)`}
                                    />
                                ) : (
                                    // viewMode === 'avgDelta'
                                    <Line
                                        yAxisId='angle'
                                        type='monotone'
                                        dataKey={`node_${doorNum}`} // 수정: dataKey를 'avgX'에서 `node_${doorNum}`으로 변경
                                        stroke='#22c55e'
                                        strokeWidth={isMobile ? 1.5 : 2}
                                        dot={false}
                                        name={`Node-${doorNum} (평균변화)`} // 수정: name을 '평균변화'에서 `Node-${doorNum} (평균변화)`으로 변경
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default SensorGraph