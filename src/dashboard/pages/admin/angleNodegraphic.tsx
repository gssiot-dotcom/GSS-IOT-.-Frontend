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
   time: string // "HH:mm" 형식
   angle_x: number
   angle_y: number
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

   // --- 최신 시간 기준으로 기간 필터링 ---
   useEffect(() => {
      if (!graphData || graphData.length === 0) return

      const convertTime = (hhmm: string) => {
         const [hh, mm] = hhmm.split(':').map(Number)
         const now = new Date()
         return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hh,
            mm
         ).getTime()
      }

      const latestDataTime = convertTime(graphData[graphData.length - 1].time)
      const filteredData = graphData.filter(d => {
         const t = convertTime(d.time)
         return t >= latestDataTime - hours * 60 * 60 * 1000
      })

      setData(filteredData)
   }, [graphData, hours])

   const getChartMargins = () => {
      if (isMobile) return { top: 10, right: 10, left: 0, bottom: 18 }
      if (isTablet) return { top: 15, right: 20, left: 5, bottom: 22 }
      return { top: 20, right: 30, left: 20, bottom: 26 }
   }

   const getYAxisTicks = () => {
      if (!data || data.length === 0) return [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6]
      const values = data.flatMap(d => [d.angle_x, d.angle_y])
      const maxVal = Math.max(...values, 0.6)
      const minVal = Math.min(...values, -0.6)

      const upper = Math.ceil(maxVal / 0.2) * 0.2
      const lower = Math.floor(minVal / 0.2) * 0.2

      const ticks: number[] = []
      for (let v = lower; v <= upper; v += 0.2) {
         ticks.push(parseFloat(v.toFixed(1)))
      }
      return ticks
   }

   const yTicks = getYAxisTicks()

   // --- X축 고정 눈금 생성 ---
   const getXTicks = () => {
      if (!data || data.length === 0) return []

      // 최신 데이터 시간
      const latest = data[data.length - 1].time
      const [h, m] = latest.split(':').map(Number)
      const latestDate = new Date()
      latestDate.setHours(h, m, 0, 0)

      // 간격 설정
      let stepMinutes = 10
      if (hours === 6) stepMinutes = 30
      if (hours === 12 || hours === 24) stepMinutes = 60

      // 오른쪽 끝 시간 올림
      const ceilMinutes = Math.ceil(latestDate.getMinutes() / stepMinutes) * stepMinutes
      const end = new Date(latestDate)
      end.setMinutes(ceilMinutes)
      end.setSeconds(0)
      end.setMilliseconds(0)

      // 왼쪽 끝 시간
      const start = new Date(end.getTime() - hours * 60 * 60 * 1000)

      const ticks: string[] = []
      const current = new Date(start)
      while (current <= end) {
         const hh = current.getHours().toString().padStart(2, '0')
         const mm = current.getMinutes().toString().padStart(2, '0')
         ticks.push(`${hh}:${mm}`)
         current.setMinutes(current.getMinutes() + stepMinutes)
      }
      return ticks
   }

   const xTicks = getXTicks()

   return (
      <div className='mx-auto pb-5'>
         <Card className='ml-auto w-[55vw] border shadow-sm border-slate-400 mt-[2.5vh]'>
            <CardHeader className='p-3 sm:p-4 space-y-2'>
               <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2'>
                  <CardTitle className='text-sm md:text-lg text-gray-900'>
                     비계전도 데이터 실시간 모니터링 <br />
                     <span className='text-blue-400'>Node-{doorNum}</span>
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
                  <ResponsiveContainer width='100%' height={300}>
                     <LineChart data={data} margin={getChartMargins()}>
                        <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                        <XAxis
                           dataKey='time'
                           tick={{ fontSize: isMobile ? 9 : 12 }}
                           height={isMobile ? 20 : 30}
                           tickMargin={isMobile ? 5 : 10}
                           interval={0}
                           ticks={xTicks}
                        />
                        <YAxis
                           domain={[Math.min(...yTicks), Math.max(...yTicks)]}
                           tick={{ fontSize: isMobile ? 9 : 12 }}
                           width={isMobile ? 25 : 35}
                           tickMargin={isMobile ? 2 : 5}
                           ticks={yTicks}
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
                           <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        )}

                        {/* 범위별 배경색 */}
                        <ReferenceArea y1={-0.2} y2={0.2} fill="#3b82f6" fillOpacity={0.1} />
                        <ReferenceArea y1={-0.4} y2={-0.2} fill="#22c55e" fillOpacity={0.1} />
                        <ReferenceArea y1={0.2} y2={0.4} fill="#22c55e" fillOpacity={0.1} />
                        <ReferenceArea y1={-0.6} y2={-0.4} fill="#eab308" fillOpacity={0.1} />
                        <ReferenceArea y1={0.4} y2={0.6} fill="#eab308" fillOpacity={0.1} />
                        <ReferenceArea y1={-999} y2={-0.6} fill="#ef4444" fillOpacity={0.1} />
                        <ReferenceArea y1={0.6} y2={999} fill="#ef4444" fillOpacity={0.1} />

                        {/* Threshold lines */}
                        <ReferenceLine y={0.3} strokeDasharray='5 5' />
                        <ReferenceLine y={-0.3} strokeDasharray='5 5' />

                        {/* 데이터 라인 */}
                        <Line
                           type='monotone'
                           dataKey='angle_x'
                           stroke='#ef4444'
                           strokeWidth={isMobile ? 1.5 : 2}
                           dot={false}
                           name='Angle X'
                        />
                        <Line
                           type='monotone'
                           dataKey='angle_y'
                           stroke='#3b82f6'
                           strokeWidth={isMobile ? 1.5 : 2}
                           dot={false}
                           name='Angle Y'
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
