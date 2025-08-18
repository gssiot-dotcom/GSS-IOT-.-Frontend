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

   // OpenWeatherMap API로 풍속 데이터 가져오기
   useEffect(() => {
      const fetchWindData = async () => {
         try {
            const response = await fetch(
               `https://api.openweathermap.org/data/2.5/forecast?q=Seoul&appid=f9d0ac2f06dd719db58be8c04d008e76&units=metric`
               // ⚠️ 실제 사용 시 YOUR_API_KEY 부분을 발급받은 키로 교체
            )
            if (!response.ok) throw new Error('Failed to fetch wind data')

            const weatherData = await response.json()
            const windDataMap: Record<string, number> = {}

            weatherData.list.forEach((item: any) => {
               const time = item.dt_txt.slice(11, 16)
               windDataMap[time] = item.wind.speed
            })

            const mergedData = graphData.map(d => ({
               ...d,
               wind_speed: windDataMap[d.time] || 0,
            }))

            setData(mergedData)
         } catch (error) {
            console.error(error)
            setData(graphData)
         }
      }

      fetchWindData()
   }, [graphData])

   const getLabelStep = () => {
      const len = data.length
      if (isMobile) {
         if (len > 90) return 12
         if (len > 60) return 8
         if (len > 30) return 6
         return 3
      }
      if (len > 120) return 12
      if (len > 80) return 8
      if (len > 40) return 6
      return 3
   }

   const labelStep = getLabelStep()

   const getChartMargins = () => {
      if (isMobile) return { top: 10, right: 10, left: 0, bottom: 18 }
      if (isTablet) return { top: 15, right: 20, left: 5, bottom: 22 }
      return { top: 20, right: 30, left: 20, bottom: 26 }
   }

   const formatXAxisTick = (value: string) => (isMobile ? value.split(':')[0] : value)

   const getYAxisTicks = () => {
      if (!data || data.length === 0) return [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6]
      const values = data.flatMap(d => [d.angle_x, d.angle_y])
      const maxVal = Math.max(...values, 0.6)
      const minVal = Math.min(...values, -0.6)
      const upper = Math.ceil(maxVal / 0.2) * 0.2
      const lower = Math.floor(minVal / 0.2) * 0.2
      const ticks: number[] = []
      for (let v = lower; v <= upper; v += 0.2) ticks.push(parseFloat(v.toFixed(1)))
      return ticks
   }

   const yTicks = getYAxisTicks()

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
                           tickFormatter={formatXAxisTick}
                           height={isMobile ? 20 : 30}
                           tickMargin={isMobile ? 5 : 10}
                           minTickGap={isMobile ? 15 : 30}
                           interval={labelStep}
                        />
                        <YAxis
                           yAxisId='angle'
                           domain={[Math.min(...yTicks), Math.max(...yTicks)]}
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
                           <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        )}

                        {/* 범위별 배경색 */}
                        <ReferenceArea y1={-0.2} y2={0.2} yAxisId='angle' fill="#22c55e" fillOpacity={0.1} />
                        <ReferenceArea y1={-0.4} y2={-0.2} yAxisId='angle' fill="#eab308" fillOpacity={0.1} />
                        <ReferenceArea y1={0.2} y2={0.4} yAxisId='angle' fill="#eab308" fillOpacity={0.1} />
                        <ReferenceArea y1={-0.6} y2={-0.4} yAxisId='angle' fill="#ef4444" fillOpacity={0.1} />
                        <ReferenceArea y1={0.4} y2={0.6} yAxisId='angle' fill="#ef4444" fillOpacity={0.1} />
                        <ReferenceArea y1={-999} y2={-0.6} yAxisId='angle' fill="#ef4444" fillOpacity={0.15} />
                        <ReferenceArea y1={0.6} y2={999} yAxisId='angle' fill="#ef4444" fillOpacity={0.15} />

                        {/* Threshold lines */}
                        <ReferenceLine y={0.3} yAxisId='angle' strokeDasharray='5 5' />
                        <ReferenceLine y={-0.3} yAxisId='angle' strokeDasharray='5 5' />

                        {/* 데이터 라인 */}
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
