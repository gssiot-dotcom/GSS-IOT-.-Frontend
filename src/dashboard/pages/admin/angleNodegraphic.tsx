import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import React, { forwardRef, useEffect, useMemo, useState } from 'react'
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
        className="border border-slate-400 rounded px-2 py-1 text-xs w-[110px] sm:w-[140px]"
      />
    )
  },
)

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQueryList = window.matchMedia(query)
    setMatches(mediaQueryList.matches)
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    mediaQueryList.addEventListener('change', listener)
    return () => mediaQueryList.removeEventListener('change', listener)
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
  viewMode: 'general' | 'delta' | 'avgDelta' | 'top6'
  topDoorNums?: number[]
  timeMode: 'hour' | 'day' | 'week' | 'month'
  setTimeMode: (mode: 'hour' | 'day' | 'week' | 'month') => void
  selectedDate: Date | null
  setSelectedDate: (date: Date | null) => void
  windHistory: WindPoint[]
}

const TOP6_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#06b6d4', // cyan
]

// ✅ 모바일용 Tooltip (간단하게)
function MobileTooltip({
  active,
  payload,
  label,
  timeMode,
}: any & { timeMode: 'hour' | 'day' | 'week' | 'month' }) {
  if (!active || !payload?.length) return null

  const d = new Date(label)
  const yyyy = d.getFullYear()
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')

  const timeStr =
    timeMode === 'week' || timeMode === 'month'
      ? `${yyyy}-${MM}-${dd}`
      : `${yyyy}-${MM}-${dd} ${hh}:${mm}`

  const items = payload
    .filter((p: any) => p?.value != null)
    .slice(0, 4) // 모바일은 4개까지만
    .map((p: any) => ({
      name: p?.name ?? p?.dataKey,
      value: typeof p.value === 'number' ? p.value : Number(p.value),
    }))

  return (
    <div className="bg-white border border-gray-200 rounded-md px-2 py-1 shadow-sm text-[12px]">
      <div className="font-semibold text-gray-800 mb-1">{timeStr}</div>
      <div className="space-y-0.5">
        {items.map((it: any, idx: number) => (
          <div key={idx} className="flex justify-between gap-3">
            <span className="text-gray-600 truncate max-w-[140px]">
              {it.name}
            </span>
            <span className="text-gray-900 font-medium">
              {Number.isFinite(it.value) ? it.value.toFixed(2) : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
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

  // ▶ "주" 전환 시 월요일로 보정
  useEffect(() => {
    if (timeMode !== 'week') return
    const base = selectedDate ?? new Date()
    const monday = getMondayOf(base)

    if (
      !selectedDate ||
      selectedDate.getDay() !== 1 ||
      selectedDate.getFullYear() !== monday.getFullYear() ||
      selectedDate.getMonth() !== monday.getMonth() ||
      selectedDate.getDate() !== monday.getDate()
    ) {
      setSelectedDate(monday)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeMode])

  // ✅ X축 ticks/domain: 모바일은 더 성긴 ticks
  const getXAxisTicksAndDomain = (): {
    ticks: number[]
    domain: [number, number]
  } => {
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

      for (let i = 0; i < 7; i++) {
        const t = new Date(monday)
        t.setDate(monday.getDate() + i)
        t.setHours(0, 0, 0, 0)
        ticks.push(t.getTime())
      }
      ticks.push(sundayEnd.getTime())
    } else if (timeMode === 'day' && selectedDate) {
      startPoint = new Date(selectedDate)
      startPoint.setHours(0, 0, 0, 0)
      endPoint = new Date(selectedDate)
      endPoint.setHours(23, 59, 59, 999)

      const step = isMobile ? 3 : 2
      for (let i = 0; i <= 24; i += step) {
        const t = new Date(startPoint.getTime())
        t.setHours(i, 0, 0, 0)
        ticks.push(t.getTime())
      }
    } else if (timeMode === 'month' && selectedDate) {
      const year = selectedDate.getFullYear()
      const month = selectedDate.getMonth()

      startPoint = new Date(year, month, 1, 0, 0, 0, 0)
      endPoint = new Date(year, month + 1, 0, 23, 59, 59, 999)
      const lastDay = endPoint.getDate()

      if (isMobile) {
        const days = [1, 8, 15, 22, lastDay].filter(
          (v, i, a) => a.indexOf(v) === i,
        )
        for (const d of days)
          ticks.push(new Date(year, month, d, 0, 0, 0, 0).getTime())
        ticks.push(endPoint.getTime())
      } else {
        for (let i = 1; i <= lastDay; i++)
          ticks.push(new Date(year, month, i, 0, 0, 0, 0).getTime())
        ticks.push(endPoint.getTime())
      }
    } else if (hours === 1) {
      const roundedMinutes = Math.ceil(now.getMinutes() / 10) * 10
      endPoint = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        roundedMinutes,
        0,
        0,
      )
      startPoint = new Date(endPoint.getTime() - 60 * 60 * 1000)

      const stepMin = isMobile ? 20 : 10
      const count = Math.floor(60 / stepMin)
      for (let i = 0; i <= count; i++)
        ticks.push(
          new Date(startPoint.getTime() + i * stepMin * 60 * 1000).getTime(),
        )
    } else if (hours === 24) {
      endPoint = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours() + 1,
        0,
        0,
        0,
      )
      startPoint = new Date(endPoint.getTime() - 24 * 60 * 60 * 1000)

      const step = isMobile ? 4 : 2
      for (let i = 0; i <= 24; i += step)
        ticks.push(new Date(startPoint.getTime() + i * 60 * 60 * 1000).getTime())
    } else {
      endPoint = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours() + (now.getMinutes() > 0 ? 1 : 0),
        0,
        0,
        0,
      )
      startPoint = new Date(endPoint.getTime() - hours * 60 * 60 * 1000)

      const step = isMobile ? 2 : 1
      for (let i = 0; i <= hours; i += step)
        ticks.push(new Date(startPoint.getTime() + i * 60 * 60 * 1000).getTime())
    }

    return { ticks, domain: [startPoint.getTime(), endPoint.getTime()] }
  }

  const { ticks: xAxisTicks, domain: xAxisDomain } = getXAxisTicksAndDomain()

  // ✨ 풍속 데이터를 모든 모드에 매핑
  const attachWindData = (points: any[]) => {
    if (!points || points.length === 0) return []
    if (!windHistory || windHistory.length === 0) {
      return points.map(p => ({
        ...p,
        timestamp: new Date(p.time).getTime(),
        wind_speed: null,
      }))
    }

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

    const sortedWindHistory = (windHistory ?? [])
      .map(w => ({ wind_speed: Number(w.wind_speed), timestampNum: toMs(w.timestamp) }))
      .filter(w => Number.isFinite(w.timestampNum))
      .sort((a, b) => a.timestampNum - b.timestampNum)

    return points.map(p => {
      const sensorTimestamp = new Date(p.time).getTime()
      if (isNaN(sensorTimestamp)) return { ...p, timestamp: 0, wind_speed: null }

      let low = 0
      let high = sortedWindHistory.length - 1

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        if (sortedWindHistory[mid].timestampNum === sensorTimestamp) {
          low = mid
          break
        } else if (sortedWindHistory[mid].timestampNum < sensorTimestamp) {
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      let closestIndex = 0
      if (low >= sortedWindHistory.length) closestIndex = sortedWindHistory.length - 1
      else if (low === 0) closestIndex = 0
      else {
        const diff1 = Math.abs(sensorTimestamp - sortedWindHistory[low - 1].timestampNum)
        const diff2 = Math.abs(sensorTimestamp - sortedWindHistory[low].timestampNum)
        closestIndex = diff1 < diff2 ? low - 1 : low
      }

      return {
        ...p,
        timestamp: sensorTimestamp,
        wind_speed: sortedWindHistory[closestIndex]?.wind_speed ?? null,
      }
    })
  }

  const finalData = useMemo(() => {
    if (viewMode === 'general') return attachWindData(data as GraphDataPoint[])
    if (viewMode === 'top6') return attachWindData(data as any[])
    return []
  }, [data, windHistory, viewMode])

  const processedDeltaData = useMemo(() => {
    if (viewMode === 'general' || viewMode === 'top6') return []
    return attachWindData(data as DeltaGraphPoint[])
  }, [viewMode, data, windHistory])

  const getYDomainAndTicks = (d: any[]) => {
    if (!d || d.length === 0) return { domain: [-5, 5] as [number, number], ticks: [-5, 0, 5] }

    if (viewMode === 'general' || viewMode === 'top6') {
      const values = d
        .flatMap(x => [
          (x as any).angle_x,
          (x as any).angle_y,
          ...(topDoorNums ?? []).map(n => (x as any)[`node_${n}`]),
        ])
        .filter(v => v != null && !isNaN(v as number)) as number[]

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
    }

    const values = d.flatMap(x => {
      const point = x as DeltaGraphPoint
      const dataKey = Object.keys(point).find(k => k.startsWith('node_'))
      if (!dataKey) return []
      const raw = point[dataKey]
      const num = typeof raw === 'number' ? raw : parseFloat(raw as string)
      return isNaN(num) ? [] : [num]
    })

    if (values.length === 0) return { domain: [-5, 5] as [number, number], ticks: [-5, 0, 5] }
    const maxAbs = Math.max(...values.map(v => Math.abs(v)))
    let boundary = 5
    if (maxAbs > 10) boundary = 15
    else if (maxAbs > 5) boundary = 10
    return { domain: [-boundary, boundary] as [number, number], ticks: [-boundary, 0, boundary] }
  }

  const chartData = viewMode === 'general' || viewMode === 'top6' ? finalData : processedDeltaData
  const { domain: yDomain, ticks: yTicks } = getYDomainAndTicks(chartData)

  const getWindDomainAndTicks = (d: any[]) => {
    const windValues = d.map(x => x.wind_speed).filter(v => v != null && !isNaN(v as number)) as number[]
    if (windValues.length === 0) return { domain: [0, 20] as [number, number], ticks: [0, 5, 10, 20] }
    const maxWind = Math.max(...windValues)
    const top = Math.ceil(maxWind / 10) * 10 || 20
    const ticks: number[] = []
    for (let i = 0; i <= top; i += 10) ticks.push(i)
    if (top >= 5 && !ticks.includes(5)) ticks.splice(1, 0, 5)
    return { domain: [0, top] as [number, number], ticks }
  }
  const { domain: windDomain, ticks: windTicks } = getWindDomainAndTicks(chartData)

  const getChartMargins = () => {
    if (isMobile) return { top: 8, right: 12, left: 0, bottom: 24 }
    if (isTablet) return { top: 12, right: 20, left: 4, bottom: 26 }
    return { top: -10, right: 46, left: -10, bottom: 30 }
  }

  const formatXAxisTick = (value: number) => {
    const date = new Date(value)
    if (timeMode === 'week' || timeMode === 'month') {
      const MM = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${MM}-${dd}`
    }
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const formatTooltipLabel = (value: number) => {
    const d = new Date(value)
    const yyyy = d.getFullYear()
    const MM = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    if (timeMode === 'week' || timeMode === 'month') return `${yyyy}-${MM}-${dd}`
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}`
  }

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
  const formatYAxisTick = (value: number) => value.toString()
  const formatTooltipValue = (value: number, name: string) => {
    if (name.includes('변화량') || name.includes('평균변화')) return value.toFixed(2)
    return value
  }

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

  // ✅ 모바일 상단 칩(legend 대체) - 요청대로 X → Y → 풍속 순서 + 색 테두리
  const MobileLegendChips = () => {
    const chipBase = 'text-[11px] bg-white'
    return (
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {viewMode === 'general' && (
          <>
            <Badge variant="outline" className={`${chipBase} border-red-500 text-red-600`}>
              X
            </Badge>
            <Badge variant="outline" className={`${chipBase} border-blue-500 text-blue-600`}>
              Y
            </Badge>
            <Badge variant="outline" className={`${chipBase} border-green-500 text-green-600`}>
              풍속
            </Badge>
          </>
        )}

        {(viewMode === 'delta' || viewMode === 'avgDelta') && doorNum != null && (
          <>
            <Badge variant="outline" className={`${chipBase} border-green-500 text-green-600`}>
              풍속
            </Badge>
            <Badge variant="outline" className={`${chipBase} border-slate-300`}>
              N-{doorNum}
            </Badge>
          </>
        )}

        {viewMode === 'top6' && (
          <>
            <Badge variant="outline" className={`${chipBase} border-green-500 text-green-600`}>
              풍속
            </Badge>
            {(topDoorNums ?? []).slice(0, 6).map(n => (
              <Badge key={n} variant="outline" className={`${chipBase} border-slate-300`}>
                N-{n}
              </Badge>
            ))}
          </>
        )}
      </div>
    )
  }

  const bandOpacity = isMobile ? 0.06 : 0.1

  return (
    <div className="pb-5 ml-auto h-full w-full lg:max-w-[52.5rem] 2xl:max-w-[79rem] 3xl:max-w-[79.5rem] lg:-mr-[1.3vw] 2xl:-mr-[1vw] 3xl:-mr-[1vw]">
      <Card className="w-full border shadow-sm border-slate-400 mt-4 sm:mt-6 overflow-hidden">
        <CardHeader className="p-3 sm:p-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <CardTitle className="text-sm sm:text-base md:text-lg text-gray-900">
              비계전도 실시간 데이터{' '}
              {viewMode !== 'top6' && doorNum !== null && (
                <span
                  className={[
                    'font-bold text-sm sm:text-base md:text-lg',
                    viewMode === 'general'
                      ? 'text-blue-400'
                      : viewMode === 'delta'
                        ? 'text-purple-400'
                        : 'text-orange-400',
                  ].join(' ')}
                >
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
                <Select value={timeMode} onValueChange={v => setTimeMode(v as any)}>
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
                  <Select value={hours.toString()} onValueChange={v => onSelectTime(Number(v))}>
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
                    onChange={date => setSelectedDate(date)}
                    locale={ko}
                    dateFormat="yyyy-MM-dd"
                    className="border border-slate-400 rounded px-2 py-1 text-xs w-[110px] sm:w-[140px]"
                    placeholderText="날짜 선택"
                    popperClassName="z-[9999]"
                    portalId="root"
                  />
                )}

                {timeMode === 'week' && (
                  <DatePicker
                    selected={selectedDate}
                    onChange={date => setSelectedDate(date)}
                    locale={ko}
                    customInput={<WeekInput />}
                    placeholderText="주차 선택"
                    popperClassName="z-[9999]"
                    portalId="root"
                    filterDate={date => date.getDay() === 1}
                  />
                )}

                {timeMode === 'month' && (
                  <DatePicker
                    selected={selectedDate}
                    onChange={date => setSelectedDate(date)}
                    locale={ko}
                    showMonthYearPicker
                    dateFormat="yyyy-MM"
                    className="border border-slate-400 rounded px-2 py-1 text-xs w-[110px] sm:w-[140px]"
                    placeholderText="월 선택"
                    popperClassName="z-[9999]"
                    portalId="root"
                  />
                )}
              </div>

              {!isMobile && (
                <Badge variant="outline" className="h-6 text-xs md:text-sm border-slate-400">
                  데이터 수: {data.length}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center px-2 py-1">
            <WeatherInfographic buildingId={buildingId!} />
          </div>
        </CardHeader>

        {isMobile && <MobileLegendChips />}

        <CardContent className="p-0 pt-2 overflow-hidden">
          <div className="w-full h-[260px] sm:h-[320px] lg:h-[39.8vh] lg:max-w-[70rem] 2xl:h-[43.2vh] 2xl:max-w-[76.5rem]">
            <ResponsiveContainer width={isMobile ? '104%' : '108%'} height="100%">
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
                          y={y + (isMobile ? 34 : 50)}
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
                      if (isMobile) {
                        return (
                          <text
                            x={x + 6}
                            y={y + 30}
                            textAnchor="start"
                            style={{ fontSize: 10, fontWeight: 'bold' }}
                          >
                            기울기
                          </text>
                        )
                      }
                      return (
                        <text
                          x={x + 31}
                          y={y + height / 2}
                          textAnchor="middle"
                          style={{ fontSize: 12, fontWeight: 'bold' }}
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
                      if (isMobile) {
                        return (
                          <text
                            x={x + 24}
                            y={y + 30}
                            textAnchor="end"
                            style={{ fontSize: 10, fontWeight: 'bold' }}
                          >
                            풍속
                          </text>
                        )
                      }
                      return (
                        <text
                          x={x + 35}
                          y={y + height / 2}
                          textAnchor="middle"
                          style={{ fontSize: 12, fontWeight: 'bold' }}
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
                  content={isMobile ? <MobileTooltip timeMode={timeMode} /> : undefined}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    fontSize: isMobile ? '12px' : '14px',
                    padding: isMobile ? '4px' : '8px',
                  }}
                  itemStyle={{ padding: isMobile ? '1px 0' : '2px 0' }}
                  labelStyle={{ marginBottom: isMobile ? '2px' : '5px' }}
                  formatter={formatTooltipValue as any}
                  labelFormatter={formatTooltipLabel as any}
                />

                {!isMobile && (
                  <Legend
                    verticalAlign="top"
                    align="right"
                    layout="horizontal"
                    wrapperStyle={{
                      position: 'absolute',
                      top: -20,
                      right: 70,
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
                      fillOpacity={bandOpacity}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(R, yDomain[0], yDomain[1])}
                      y2={yDomain[1]}
                      fill="#ef4444"
                      fillOpacity={bandOpacity}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(-R, yDomain[0], yDomain[1])}
                      y2={clamp(-Y, yDomain[0], yDomain[1])}
                      fill="#eab308"
                      fillOpacity={bandOpacity}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(Y, yDomain[0], yDomain[1])}
                      y2={clamp(R, yDomain[0], yDomain[1])}
                      fill="#eab308"
                      fillOpacity={bandOpacity}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(-Y, yDomain[0], yDomain[1])}
                      y2={clamp(-G, yDomain[0], yDomain[1])}
                      fill="#22c55e"
                      fillOpacity={bandOpacity}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(G, yDomain[0], yDomain[1])}
                      y2={clamp(Y, yDomain[0], yDomain[1])}
                      fill="#22c55e"
                      fillOpacity={bandOpacity}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(-G, yDomain[0], yDomain[1])}
                      y2={clamp(-B, yDomain[0], yDomain[1])}
                      fill="#3b82f6"
                      fillOpacity={bandOpacity}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(B, yDomain[0], yDomain[1])}
                      y2={clamp(G, yDomain[0], yDomain[1])}
                      fill="#3b82f6"
                      fillOpacity={bandOpacity}
                    />
                    <ReferenceArea
                      yAxisId="angle"
                      y1={clamp(-B, yDomain[0], yDomain[1])}
                      y2={clamp(B, yDomain[0], yDomain[1])}
                      fill="#3b82f6"
                      fillOpacity={bandOpacity}
                    />
                  </>
                )}

                {/* ✅ 요청 반영: 모바일에서도 순서 X → Y → 풍속에 맞춰 Line 순서도 X, Y, Wind */}
                {viewMode === 'general' && (
                  <>
                    <Line
                      yAxisId="angle"
                      type="monotone"
                      dataKey="angle_x"
                      stroke="#ef4444"
                      strokeWidth={isMobile ? 1.8 : 2}
                      dot={false}
                      name="X"
                      connectNulls
                    />
                    <Line
                      yAxisId="angle"
                      type="monotone"
                      dataKey="angle_y"
                      stroke="#3b82f6"
                      strokeWidth={isMobile ? 1.8 : 2}
                      dot={false}
                      name="Y"
                      connectNulls
                    />
                    <Line
                      yAxisId="wind"
                      type="monotone"
                      dataKey="wind_speed"
                      stroke="#22c55e"
                      strokeOpacity={0.85}
                      strokeWidth={isMobile ? 1.8 : 2}
                      dot={false}
                      name="풍속"
                      connectNulls
                    />
                  </>
                )}

                {/* delta / avgDelta: 기존 유지 + 풍속은 보여주고 싶으면 아래 Wind Line을 추가로 켜도 됨 */}
                {(viewMode === 'delta' || viewMode === 'avgDelta') && doorNum != null && (
                  <>
                    <Line
                      yAxisId="angle"
                      type="monotone"
                      dataKey={`node_${doorNum}`}
                      stroke={viewMode === 'delta' ? '#8b5cf6' : '#f59e0b'}
                      strokeWidth={isMobile ? 1.8 : 2}
                      dot={false}
                      name={`Node-${doorNum} (${viewMode === 'delta' ? '변화량' : '평균변화'})`}
                      connectNulls
                    />
                    <Line
                      yAxisId="wind"
                      type="monotone"
                      dataKey="wind_speed"
                      stroke="#22c55e"
                      strokeOpacity={0.85}
                      strokeWidth={isMobile ? 1.8 : 2}
                      dot={false}
                      name="풍속"
                      connectNulls
                    />
                  </>
                )}

                {viewMode === 'top6' && (
                  <>
                    {/* top6 라인들 */}
                    {(topDoorNums ?? []).slice(0, 6).map((dn: number, i: number) => (
                      <Line
                        key={dn}
                        yAxisId="angle"
                        type="monotone"
                        dataKey={`node_${dn}`}
                        stroke={TOP6_COLORS[i % TOP6_COLORS.length]}
                        strokeWidth={isMobile ? 1.8 : 2}
                        dot={false}
                        name={`Node-${dn}`}
                        connectNulls
                      />
                    ))}
                    {/* 풍속도 같이 */}
                    <Line
                      yAxisId="wind"
                      type="monotone"
                      dataKey="wind_speed"
                      stroke="#22c55e"
                      strokeOpacity={0.85}
                      strokeWidth={isMobile ? 1.8 : 2}
                      dot={false}
                      name="풍속"
                      connectNulls
                    />
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