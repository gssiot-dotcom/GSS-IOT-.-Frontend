import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import React, { forwardRef, useMemo } from 'react'
import { useEffect, useState } from 'react'
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
import WeatherInfographic from '@/dashboard/components/shared-dash/WeatherInfographic'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

// --- Helper functions ---
function getWeekOfMonth(date: Date) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const dayOfWeek = startOfMonth.getDay()
  const offsetDate = date.getDate() + dayOfWeek
  return Math.ceil(offsetDate / 7)
}

function getMondayOf(date: Date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon, ...
  // 월요일(1)이 되도록 이동. 일요일(0)이면 -6일, 그 외에는 1 - day
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

type WeekInputProps = React.ComponentPropsWithoutRef<'input'> & {
  value?: string
  onClick?: React.MouseEventHandler<HTMLInputElement>
}
const WeekInput = forwardRef<HTMLInputElement, WeekInputProps>(
  ({ value, onClick, ...rest }, ref) => {
    let display = value || ''
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        display = `${format(d, 'yyyy-MM')}-(${getWeekOfMonth(d)}주)`
      }
    }
    return (
      <input
        ref={ref}
        onClick={onClick}
        value={display}
        readOnly
        {...rest}
        className="border border-slate-400 rounded px-2 py-1 text-xs"
      />
    )
  }
)
WeekInput.displayName = 'WeekInput'

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

// 공통 필드 정의
export interface BasePoint {
  time: string
  timestamp?: number
  wind_speed?: number | null
}

export interface GraphDataPoint extends BasePoint {
  angle_x: number | null
  angle_y: number | null
  nodeId?: string
}

export interface DeltaGraphPoint extends BasePoint {
  [key: string]: number | string | null | undefined
}

export interface AvgDeltaDataPoint extends BasePoint {
  avgX: number
}

interface WindPoint {
  timestamp: string
  wind_speed: number
}

export type SensorGraphProps = {
  buildingId: string | undefined
  doorNum: number | null
  graphData: GraphDataPoint[] | DeltaGraphPoint[] | AvgDeltaDataPoint[]
  hours: number
  onSelectTime: (time: number) => void
  R?: number
  Y?: number
  G?: number
  B?: number
  viewMode: 'general' | 'delta' | 'avgDelta' | 'top6'
  topDoorNums?: number[]
  timeMode: 'hour' | 'day' | 'week' | 'month'
  setTimeMode: (mode: 'hour' | 'day' | 'week' | 'month') => void
  selectedDate: Date | null
  setSelectedDate: (date: Date | null) => void
  windHistory: WindPoint[]
}

const SensorGraph: React.FC<SensorGraphProps> = ({
  buildingId,
  doorNum,
  graphData,
  hours,
  onSelectTime,
  R = 0,
  Y = 0,
  G = 0,
  B = 0,
  viewMode,
  timeMode,
  setTimeMode,
  selectedDate,
  setSelectedDate,
  windHistory,
  topDoorNums,
}) => {
  const [data, setData] = useState<
    GraphDataPoint[] | DeltaGraphPoint[] | AvgDeltaDataPoint[]
  >(graphData)
  const isMobile = useMediaQuery('(max-width: 640px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')

  useEffect(() => setData(graphData), [graphData])

  // ▶ 추가: "일 → 주" 전환 시, 기존 날짜의 월요일로 자동 보정
  useEffect(() => {
    if (timeMode === 'week') {
      const base = selectedDate ?? new Date()
      const monday = getMondayOf(base)
      // 이미 월요일이면 불필요한 업데이트 방지
      if (
        !selectedDate ||
        selectedDate.getDay() !== 1 ||
        selectedDate.getFullYear() !== monday.getFullYear() ||
        selectedDate.getMonth() !== monday.getMonth() ||
        selectedDate.getDate() !== monday.getDate()
      ) {
        setSelectedDate(monday)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeMode])

  // ✅ 여기만 수정: month 모드에서 양 끝만 틱, 도메인은 그 달 전체
  const getXAxisTicksAndDomain = (): { ticks: number[]; domain: [number, number] } => {
    const now = new Date()
    let startPoint: Date
    let endPoint: Date
    const ticks: number[] = []

    if (timeMode === 'week' && selectedDate) {
      const monday = new Date(selectedDate)
      monday.setHours(0, 0, 0, 0)

      const sundayEnd = new Date(monday)
      sundayEnd.setDate(monday.getDate() + 6)
      sundayEnd.setHours(23, 59, 59, 999)

      startPoint = monday
      endPoint = sundayEnd

      // 월~일 자정 + 마지막 눈금
      for (let i = 0; i < 7; i++) {
        const tick = new Date(monday)
        tick.setDate(monday.getDate() + i)
        tick.setHours(0, 0, 0, 0)
        ticks.push(tick.getTime())
      }
      ticks.push(sundayEnd.getTime())
    } else if (timeMode === 'day' && selectedDate) {
      startPoint = new Date(selectedDate)
      startPoint.setHours(0, 0, 0, 0)
      endPoint = new Date(selectedDate)
      endPoint.setHours(23, 59, 59, 999)
      for (let i = 0; i <= 24; i += 2) {
        const tickTime = new Date(startPoint.getTime())
        tickTime.setHours(i, 0, 0, 0)
        ticks.push(tickTime.getTime())
      }
    } else if (timeMode === 'month' && selectedDate) {
      // ✅ 월간 모드: 그 달 1일부터 말일까지 tick 생성
      const year = selectedDate.getFullYear()
      const month = selectedDate.getMonth()

      startPoint = new Date(year, month, 1, 0, 0, 0, 0)
      endPoint = new Date(year, month + 1, 0, 23, 59, 59, 999) // 그달 마지막 날

      const lastDay = endPoint.getDate()

      for (let i = 1; i <= lastDay; i++) {
        const tickTime = new Date(year, month, i, 0, 0, 0, 0)
        ticks.push(tickTime.getTime())
      }
      // 마지막 눈금도 추가 (그래프 오른쪽 끝)
      ticks.push(endPoint.getTime())
    } else if (hours === 1) {
      const roundedMinutes = Math.ceil(now.getMinutes() / 10) * 10
      endPoint = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        roundedMinutes,
        0,
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
        0,
        0
      )
      startPoint = new Date(endPoint.getTime() - 24 * 60 * 60 * 1000)
      for (let i = 0; i <= 24; i += 2) {
        const tickTime = new Date(startPoint.getTime() + i * 60 * 60 * 1000)
        ticks.push(tickTime.getTime())
      }
    } else {
      endPoint = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours() + (now.getMinutes() > 0 ? 1 : 0),
        0,
        0,
        0
      )
      startPoint = new Date(endPoint.getTime() - hours * 60 * 60 * 1000)
      for (let i = 0; i <= hours; i++) {
        const tickTime = new Date(startPoint.getTime() + i * 60 * 60 * 1000)
        ticks.push(tickTime.getTime())
      }
    }

    return { ticks, domain: [startPoint.getTime(), endPoint.getTime()] }
  }

  const { ticks: xAxisTicks, domain: xAxisDomain } = getXAxisTicksAndDomain()

  // ✨ 풍속 데이터를 모든 모드에 매핑
  const attachWindData = (points: { time: string }[]) => {
    if (!points || points.length === 0) return []
    if (!windHistory || windHistory.length === 0) {
      return points.map((p) => ({
        ...p,
        timestamp: new Date(p.time).getTime(),
        wind_speed: null,
      }))
    }

    // 도우미: 다양한 형태의 타임스탬프를 ms로 안전 변환
    const toMs = (ts: unknown): number => {
      if (ts == null) return NaN
      if (typeof ts === 'number') return Number.isFinite(ts) ? ts : NaN
      if (typeof ts === 'string') {
        const d1 = Date.parse(ts)
        if (!isNaN(d1)) return d1
        const d2 = Date.parse(ts.replace(/Z$/, ''))
        return isNaN(d2) ? NaN : d2
      }
      return NaN
    }

    const NINE_HOURS_MS = 9 * 60 * 60 * 1000

    const sortedWindHistory = (windHistory ?? [])
      .map((w) => {
        const ts = toMs(w.timestamp)
        return {
          wind_speed: Number(w.wind_speed),
          // ✅ windHistory timestamp는 백에서 +9h 저장된 값이라
          // 매칭용으로만 -9h 해서 UTC instant로 되돌림
          timestampNum: Number.isFinite(ts) ? ts - NINE_HOURS_MS : NaN,
        }
      })
      .filter((w) => Number.isFinite(w.timestampNum))
      .sort((a, b) => a.timestampNum - b.timestampNum)

    return points.map((p) => {
      const sensorTimestamp = new Date(p.time).getTime()
      if (isNaN(sensorTimestamp)) {
        return { ...p, timestamp: 0, wind_speed: null }
      }

      let low = 0
      let high = sortedWindHistory.length - 1
      let closestIndex = 0

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        if (sortedWindHistory[mid].timestampNum === sensorTimestamp) {
          closestIndex = mid
          break
        } else if (sortedWindHistory[mid].timestampNum < sensorTimestamp) {
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      if (low >= sortedWindHistory.length) {
        closestIndex = sortedWindHistory.length - 1
      } else if (low === 0) {
        closestIndex = 0
      } else {
        const diff1 = Math.abs(sensorTimestamp - sortedWindHistory[low - 1].timestampNum)
        const diff2 = Math.abs(sensorTimestamp - sortedWindHistory[low].timestampNum)
        closestIndex = diff1 < diff2 ? low - 1 : low
      }

      const closestWindSpeed = sortedWindHistory[closestIndex]?.wind_speed ?? null

      return {
        ...p,
        timestamp: sensorTimestamp,
        wind_speed: closestWindSpeed,
      }
    })
  }

  const finalData = useMemo(() => {
    if (viewMode === 'general') {
      return attachWindData(data as GraphDataPoint[])
    }
    return []
  }, [data, windHistory, viewMode])

  const processedDeltaData = useMemo(() => {
    if (viewMode === 'general') return []
    return attachWindData(data as DeltaGraphPoint[])
  }, [viewMode, data, windHistory])

  const getYDomainAndTicks = (graph: (GraphDataPoint | DeltaGraphPoint | AvgDeltaDataPoint)[]) => {
    if (!graph || graph.length === 0) return { domain: [-5, 5] as [number, number], ticks: [-5, 0, 5] }

    if (viewMode === 'general') {
      const values = graph
        .flatMap((d) => [(d as GraphDataPoint).angle_x, (d as GraphDataPoint).angle_y])
        .filter((v) => v != null && !isNaN(v as number)) as number[]
      if (values.length === 0) return { domain: [-5, 5] as [number, number], ticks: [-5, 0, 5] }
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
    } else {
      const values = graph.flatMap((d) => {
        const point = d as DeltaGraphPoint
        const dataKey = Object.keys(point).find((key) => key.startsWith('node_'))
        if (!dataKey) return []
        const rawValue = point[dataKey]
        const numValue = parseFloat(rawValue as string)
        return isNaN(numValue) ? [] : [numValue]
      })
      if (values.length === 0) return { domain: [-5, 5] as [number, number], ticks: [-5, 0, 5] }
      const maxAbs = Math.max(...values.map((v) => Math.abs(v)))
      let boundary = 5
      if (maxAbs > 10) boundary = 15
      else if (maxAbs > 5) boundary = 10
      return { domain: [-boundary, boundary] as [number, number], ticks: [-boundary, 0, boundary] }
    }
  }

  const { domain: yDomain, ticks: yTicks } = getYDomainAndTicks(
    viewMode === 'general' ? finalData : processedDeltaData
  )

  const getWindDomainAndTicks = (graph: any[]) => {
    const windValues = graph.map((d) => d.wind_speed).filter((v) => v != null && !isNaN(v as number)) as number[]
    if (windValues.length === 0) return { domain: [0, 20] as [number, number], ticks: [0, 5, 10, 20] }
    const maxWind = Math.max(...windValues)
    const top = Math.ceil(maxWind / 10) * 10 || 20
    const ticks: number[] = []
    for (let i = 0; i <= top; i += 10) ticks.push(i)
    if (top >= 5 && !ticks.includes(5)) ticks.splice(1, 0, 5)
    return { domain: [0, top] as [number, number], ticks }
  }

  const { domain: windDomain, ticks: windTicks } = getWindDomainAndTicks(
    viewMode === 'general' ? finalData : processedDeltaData
  )

  const getChartMargins = () => {
    if (isMobile) return { top: 10, right: 10, left: 0, bottom: 18 }
    if (isTablet) return { top: 15, right: 20, left: 5, bottom: 22 }
    return { top: -20, right: 50, left: -20, bottom: 30 }
  }

  const formatXAxisTick = (value: number) => {
    const date = new Date(value)
    if (timeMode === 'week' || timeMode === 'month') {
      const MM = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${MM}-${dd}`
    }
    const hoursStr = String(date.getHours()).padStart(2, '0')
    const minutesStr = String(date.getMinutes()).padStart(2, '0')
    return `${hoursStr}:${minutesStr}`
  }

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
  const formatYAxisTick = (value: number): string => value.toString()

  const formatTooltipValue = (value: number, name: string) => {
    if (name.includes('변화량') || name.includes('평균변화')) return value.toFixed(2)
    return value
  }

  const formatTooltipLabel = (value: number) => {
    const date = new Date(value)
    const yyyy = date.getFullYear()
    const MM = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')

    if (timeMode === 'week' || timeMode === 'month') {
      return `${yyyy}-${MM}-${dd}`
    }

    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}`
  }

  const chartData = viewMode === 'general' ? finalData : processedDeltaData

  // 현재 시각 표시용
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const nowDate = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }, [now])

  const nowTime = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }, [now])

  const TOP6_COLORS = [
    '#ef4444', // red
    '#ff00c3ff', // pink-ish
    '#001effff', // blue
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#06b6d4', // cyan
  ]

  return (
    <div className="pb-5 h-full w-full">
      <Card className="w-full border shadow-sm border-slate-400 mt-4 sm:mt-6">
        <CardHeader className="p-3 sm:p-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <CardTitle className="text-sm sm:text-base md:text-lg text-gray-900">
              비계전도 실시간 데이터{' '}
              {viewMode === 'general' && doorNum !== null && (
                <span className="text-blue-400 font-bold text-sm sm:text-base md:text-lg">
                  Node-{doorNum}
                </span>
              )}
              {viewMode === 'delta' && doorNum !== null && (
                <span className="text-purple-400 font-bold text-sm sm:text-base md:text-lg">
                  Node-{doorNum}
                </span>
              )}
              {viewMode === 'avgDelta' && doorNum !== null && (
                <span className="text-orange-400 font-bold text-sm sm:text-base md:text-lg">
                  Node-{doorNum}
                </span>
              )}
              {viewMode === 'top6' && (
                <span className="text-emerald-500 font-bold text-sm sm:text-base md:text-lg">
                  Top6
                </span>
              )}
            </CardTitle>

            <div className="hidden sm:flex flex-1 justify-center">
              <span className="hidden lg:inline 2xl:hidden text-gray-600 text-[12px] font-bold">
                {nowDate} {nowTime}
              </span>

              <div className="hidden 2xl:flex items-center gap-3 font-mono tabular-nums text-[110%] font-bold text-gray-600">
                <span>{nowDate}</span>
                <span className="opacity-50">|</span>
                <span>{nowTime}</span>
              </div>
            </div>

            <div className="flex flex-row items-center justify-between sm:justify-end gap-3">
              <div className="flex items-center gap-x-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap">
                  기간:
                </label>
                <Select value={timeMode} onValueChange={(v) => setTimeMode(v as any)}>
                  <SelectTrigger className="h-6 w-[90px] sm:w-[120px] text-xs md:text-sm border border-slate-400">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hour">시간</SelectItem>
                    <SelectItem value="day">일</SelectItem>
                    <SelectItem value="week">주</SelectItem>
                    <SelectItem value="month">월</SelectItem>
                  </SelectContent>
                </Select>

                {timeMode === 'hour' && (
                  <Select
                    value={hours.toString()}
                    onValueChange={(v) => onSelectTime(Number(v))}
                  >
                    <SelectTrigger className="h-6 w-[90px] sm:w-[120px] text-xs md:text-sm border border-slate-400">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 시간</SelectItem>
                      <SelectItem value="6">6 시간</SelectItem>
                      <SelectItem value="12">12 시간</SelectItem>
                      <SelectItem value="24">24 시간</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {timeMode === 'day' && (
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    locale={ko}
                    dateFormat="yyyy-MM-dd"
                    className="border border-slate-400 rounded px-2 py-1 text-xs"
                    placeholderText="날짜 선택"
                    popperClassName="z-[9999]"
                    portalId="root"
                  />
                )}

                {timeMode === 'week' && (
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    locale={ko}
                    customInput={<WeekInput />}
                    placeholderText="주차 선택"
                    popperClassName="z-[9999]"
                    portalId="root"
                    filterDate={(date) => date.getDay() === 1}
                  />
                )}

                {timeMode === 'month' && (
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    locale={ko}
                    showMonthYearPicker
                    dateFormat="yyyy-MM"
                    className="border border-slate-400 rounded px-2 py-1 text-xs"
                    placeholderText="월 선택"
                    popperClassName="z-[9999]"
                    portalId="root"
                  />
                )}
              </div>
              <Badge variant="outline" className="h-6 text-xs md:text-sm border-slate-400">
                데이터 수: {data.length}
              </Badge>
            </div>
          </div>

          <div className="flex items-center px-2 py-1">
            <WeatherInfographic buildingId={buildingId!} />
          </div>
        </CardHeader>

        <CardContent className="p-0 pt-2 overflow-x-hidden overflow-visible">
          <div className="px-1 px-2 w-full h-full lg:h-[60.5vh] 2xl:h-[39.3vh] 3xl:h-[42vh]">
            <ResponsiveContainer width="106%" height="100%">
              <LineChart data={chartData} margin={getChartMargins()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

                <XAxis
                  dataKey="timestamp"
                  domain={xAxisDomain}
                  tick={{ fontSize: isMobile ? 9 : 12 }}
                  tickFormatter={formatXAxisTick}
                  height={isMobile ? 30 : 40}
                  tickMargin={isMobile ? 5 : 10}
                  ticks={xAxisTicks}
                  type="number"
                >
                  <Label
                    position="bottom"
                    content={({ viewBox }) => {
                      const { x, y, width } = viewBox as any
                      return (
                        <text
                          x={x + width / 2}
                          y={y + 50}
                          textAnchor="middle"
                          style={{
                            fontSize: isMobile ? 10 : 12,
                            fontWeight: 'bold',
                            fill: '#000',
                          }}
                        >
                          {timeMode === 'week' || timeMode === 'month' ? '날짜' : '시간'}
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
                      return (
                        <text
                          x={x + 31}
                          y={y + height / 2}
                          textAnchor="middle"
                          style={{ fontSize: isMobile ? 10 : 12, fontWeight: 'bold' }}
                        >
                          <tspan x={x + 31} dy="-0.6em">
                            기
                          </tspan>
                          <tspan x={x + 31} dy="1.2em">
                            울
                          </tspan>
                          <tspan x={x + 31} dy="1.2em">
                            기
                          </tspan>
                        </text>
                      )
                    }}
                  />
                </YAxis>

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
                      return (
                        <text
                          x={x + 35}
                          y={y + height / 2}
                          textAnchor="middle"
                          style={{ fontSize: isMobile ? 10 : 12, fontWeight: 'bold' }}
                        >
                          <tspan x={x + 35} dy="0">
                            풍
                          </tspan>
                          <tspan x={x + 35} dy="1.2em">
                            속
                          </tspan>
                        </text>
                      )
                    }}
                  />
                </YAxis>

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
                      position: 'absolute',
                      top: -20,
                      right: 100,
                      fontSize: '12px',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      zIndex: 1,
                    }}
                  />
                )}

                {(viewMode === 'general' || viewMode === 'top6') && (
                  <>
                    <ReferenceArea
                      yAxisId="angle"
                      y1={yDomain[0]}
                      y2={clamp(-R, yDomain[0], yDomain[1])}
                      fill="#ef4444"
                      fillOpacity={0.1}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(R, yDomain[0], yDomain[1])}
                      y2={yDomain[1]}
                      fill="#ef4444"
                      fillOpacity={0.1}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(-R, yDomain[0], yDomain[1])}
                      y2={clamp(-Y, yDomain[0], yDomain[1])}
                      fill="#eab308"
                      fillOpacity={0.1}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(Y, yDomain[0], yDomain[1])}
                      y2={clamp(R, yDomain[0], yDomain[1])}
                      fill="#eab308"
                      fillOpacity={0.1}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(-Y, yDomain[0], yDomain[1])}
                      y2={clamp(-G, yDomain[0], yDomain[1])}
                      fill="#22c55e"
                      fillOpacity={0.1}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(G, yDomain[0], yDomain[1])}
                      y2={clamp(Y, yDomain[0], yDomain[1])}
                      fill="#22c55e"
                      fillOpacity={0.1}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(-G, yDomain[0], yDomain[1])}
                      y2={clamp(-B, yDomain[0], yDomain[1])}
                      fill="#3b82f6"
                      fillOpacity={0.1}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(B, yDomain[0], yDomain[1])}
                      y2={clamp(G, yDomain[0], yDomain[1])}
                      fill="#3b82f6"
                      fillOpacity={0.1}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(-B, yDomain[0], yDomain[1])}
                      y2={clamp(B, yDomain[0], yDomain[1])}
                      fill="#3b82f6"
                      fillOpacity={0.1}
                    />
                  </>
                )}

                {/* 풍속 그래프는 항상 표시 */}
                <Line
                  yAxisId="wind"
                  type="monotone"
                  dataKey="wind_speed"
                  stroke="#22c55e"
                  strokeOpacity={0.8}
                  strokeWidth={isMobile ? 1.5 : 2}
                  dot={false}
                  name="Wind Speed (m/s)"
                  connectNulls
                />

                {viewMode === 'general' && (
                  <>
                    <Line
                      yAxisId="angle"
                      type="monotone"
                      dataKey="angle_x"
                      stroke="#ef4444"
                      strokeWidth={isMobile ? 1.5 : 2}
                      dot={false}
                      name="Angle X"
                      connectNulls
                    />
                    <Line
                      yAxisId="angle"
                      type="monotone"
                      dataKey="angle_y"
                      stroke="#3b82f6"
                      strokeWidth={isMobile ? 1.5 : 2}
                      dot={false}
                      name="Angle Y"
                      connectNulls
                    />
                  </>
                )}

                {(viewMode === 'delta' || viewMode === 'avgDelta') && doorNum != null && (
                  <Line
                    yAxisId="angle"
                    type="monotone"
                    dataKey={`node_${doorNum}`}
                    stroke={viewMode === 'delta' ? '#8b5cf6' : '#ffa600ff'}
                    strokeWidth={isMobile ? 1.5 : 2}
                    dot={false}
                    name={`Node-${doorNum} (${viewMode === 'delta' ? '변화량' : '평균변화'})`}
                    connectNulls
                  />
                )}

                {viewMode === 'top6' && (
                  <>
                    {(topDoorNums ?? []).map((dn: number, i: number) => (
                      <Line
                        key={dn}
                        yAxisId="angle"
                        type="monotone"
                        dataKey={`node_${dn}`}
                        stroke={TOP6_COLORS[i % TOP6_COLORS.length]}
                        strokeWidth={isMobile ? 1.5 : 2}
                        dot={false}
                        name={`Node-${dn} X`}
                        connectNulls
                      />
                    ))}
                  </>
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

// =====================================================
// ✅ 추가: 모달 래퍼 컴포넌트 (그래프 버튼 클릭 시 모달로 띄우기)
// =====================================================
export type SensorGraphModalProps = SensorGraphProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
}

export const SensorGraphModal: React.FC<SensorGraphModalProps> = ({
  open,
  onOpenChange,
  title,
  doorNum,
  ...rest
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden z-[200]">
        <DialogHeader className="p-3 border-b">
          <DialogTitle>{title ?? `그래프 ${doorNum != null ? `- Node-${doorNum}` : ''}`}</DialogTitle>
        </DialogHeader>

        <div className="h-[calc(90vh-56px)] overflow-auto p-3">
          <SensorGraph doorNum={doorNum} {...rest} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
