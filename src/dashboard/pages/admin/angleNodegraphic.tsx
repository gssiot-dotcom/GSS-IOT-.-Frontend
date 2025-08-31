// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { IAngleNode } from '@/types/interfaces'
import { GraphDataPoint, TopNodeGraphPoint, DeltaGraphPoint } from '@/dashboard/pages/admin/AngleNodes'

type SensorGraphProps = {
  buildingId: string | undefined
  doorNum: number | null
  graphData: GraphDataPoint[] | TopNodeGraphPoint[] | DeltaGraphPoint[]
  hours: number
  onSelectTime: (time: number) => void
  R?: number
  Y?: number
  G?: number
  B?: number
  viewMode: 'general' | 'top' | 'delta'
  allNodes: IAngleNode[]
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
  allNodes,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<GraphDataPoint[] | TopNodeGraphPoint[] | DeltaGraphPoint[]>(graphData)
  const isMobile = useMediaQuery('(max-width: 640px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')

  useEffect(() => setData(graphData), [graphData])

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
        
        if (viewMode === 'general') {
          const mergedData = (graphData as GraphDataPoint[]).map(d => {
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
        }
      } catch (error) {
        console.error('풍속 데이터 가져오기 실패:', error)
        setData(graphData)
      }
    }

    if (navigator.geolocation && viewMode === 'general') {
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
    } else if (viewMode === 'general') {
      console.warn('Geolocation API를 지원하지 않는 브라우저입니다.')
      setData(graphData)
    }
  }, [graphData, viewMode])

  const getYDomainAndTicks = (data: GraphDataPoint[] | TopNodeGraphPoint[] | DeltaGraphPoint[]) => {
    if (!data || data.length === 0) return { domain: [-5, 5], ticks: [-5, 0, 5] };
    
    if (viewMode === 'delta') {
      const values = data.flatMap(d => {
        const point = d as DeltaGraphPoint;
        return Object.keys(point)
          .filter(key => key !== 'time')
          .map(key => point[key] as number);
      });

      if (values.length === 0) return { domain: [-0.01, 0.01], ticks: [-0.01, 0, 0.01] };

      const maxAbs = Math.max(...values.map(Math.abs));
      
      const dynamicBound = Math.max(0.001, maxAbs) * 1.2; 
      const ticks = [-dynamicBound, 0, dynamicBound];
      const domain = [-dynamicBound, dynamicBound];

      return { domain, ticks };
    }

    const values = data.flatMap(d => {
      if (viewMode === 'general') {
        const point = d as GraphDataPoint;
        return [point.angle_x, point.angle_y];
      } else {
        const point = d as TopNodeGraphPoint;
        return Object.keys(point).filter(key => key !== 'time').map(key => point[key] as number);
      }
    });

    if (values.length === 0) return { domain: [-5, 5], ticks: [-5, 0, 5] };

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    let domain: [number, number] = [-5, 5];
    let ticks: number[] = [-5, 0, 5];

    if (minVal < -5 || maxVal > 5) {
      domain = [-10, 10];
      ticks = [-10, 0, 10];
    }
    if (minVal < -10 || maxVal > 10) {
      domain = [-15, 15];
      ticks = [-15, 0, 15];
    }
    return { domain, ticks };
  }

  const { domain: yDomain, ticks: yTicks } = getYDomainAndTicks(data)

  const getWindDomainAndTicks = (data: GraphDataPoint[]) => {
    const maxWind = Math.max(...data.map(d => d.wind_speed || 0))
    const top = Math.ceil(maxWind / 10) * 10 || 20
    const ticks = []
    for (let i = 0; i <= top; i += 10) ticks.push(i)
    return { domain: [0, top], ticks }
  }

  const { domain: windDomain, ticks: windTicks } = getWindDomainAndTicks(data as GraphDataPoint[])

  const getXAxisTicksAndDomain = (hours: number): { ticks: number[], domain: [number, number] } => {
    const now = new Date();
    const ticks = [];
    let startPoint;
    let endPoint;

    if (hours === 1) {
      const roundedMinutes = Math.ceil(now.getMinutes() / 10) * 10;
      endPoint = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0);
      startPoint = new Date(endPoint.getTime() - 60 * 60 * 1000);
      
      for (let i = 0; i <= 6; i++) {
        const tickTime = new Date(startPoint.getTime() + i * 10 * 60 * 1000);
        ticks.push(tickTime.getTime());
      }
    } else if (hours === 24) {
      endPoint = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
      startPoint = new Date(endPoint.getTime() - 24 * 60 * 60 * 1000);
      
      for (let i = 0; i <= 6; i++) {
        const tickTime = new Date(startPoint.getTime() + i * 4 * 60 * 60 * 1000);
        ticks.push(tickTime.getTime());
      }
    } else { 
      endPoint = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + (now.getMinutes() > 0 ? 1 : 0), 0, 0);
      startPoint = new Date(endPoint.getTime() - hours * 60 * 60 * 1000);
      
      for (let i = 0; i <= hours; i++) {
        const tickTime = new Date(startPoint.getTime() + i * 60 * 60 * 1000);
        ticks.push(tickTime.getTime());
      }
    }

    const domain = [
      startPoint.getTime(),
      endPoint.getTime()
    ] as [number, number];

    return { ticks, domain };
  };

  const { ticks: xAxisTicks, domain: xAxisDomain } = getXAxisTicksAndDomain(hours);
  
  // 데이터에 날짜 정보를 유추하여 타임스탬프 속성 추가
  const transformedData = data.map(d => {
    const [h, m] = d.time.split(':').map(Number);
    const now = new Date();
    const dataDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

    // 현재 시간을 기준으로 데이터의 날짜를 추론
    if (hours < 24) {
      // 1, 6, 12시간 선택 시, 데이터가 현재보다 미래면 어제 날짜로 간주
      if (dataDate.getTime() > now.getTime()) {
        dataDate.setDate(dataDate.getDate() - 1);
      }
    } else { // 24시간 선택 시
      // 데이터가 현재 시간보다 미래면 어제 날짜로 간주
      if (dataDate.getTime() > now.getTime()) {
        dataDate.setDate(dataDate.getDate() - 1);
      }
      // 데이터가 시작 시간보다 과거면 이틀 전 날짜로 간주
      if (dataDate.getTime() < xAxisDomain[0]) {
         dataDate.setDate(dataDate.getDate() - 1);
      }
    }

    return {
      ...d,
      timestamp: dataDate.getTime()
    };
  });

  const interpolateWindData = (data: any[]) => {
    const validWindData = data.filter(d => d.wind_speed !== undefined && d.wind_speed !== null)
    
    if (validWindData.length <= 1) return data;

    const interpolatedData = data.map(d => {
      if (d.wind_speed !== undefined && d.wind_speed !== null) {
        return d;
      }

      const prevPoint = validWindData.slice().reverse().find(p => p.timestamp < d.timestamp);
      const nextPoint = validWindData.find(p => p.timestamp > d.timestamp);

      if (prevPoint && nextPoint) {
        const timeDiff = nextPoint.timestamp - prevPoint.timestamp;
        const windDiff = nextPoint.wind_speed - prevPoint.wind_speed;
        const ratio = (d.timestamp - prevPoint.timestamp) / timeDiff;
        const interpolatedWind = prevPoint.wind_speed + windDiff * ratio;
        return { ...d, wind_speed: interpolatedWind };
      }

      // 시작점이나 끝점에 데이터가 없는 경우 가장 가까운 값으로 채움
      if (prevPoint && !nextPoint) {
        return { ...d, wind_speed: prevPoint.wind_speed };
      }
      if (!prevPoint && nextPoint) {
        return { ...d, wind_speed: nextPoint.wind_speed };
      }

      return d;
    });

    return interpolatedData;
  };
  
  const finalData = viewMode === 'general' ? interpolateWindData(transformedData) : transformedData;
  
  const getChartMargins = () => {
    if (isMobile) return { top: 10, right: 10, left: 0, bottom: 18 }
    if (isTablet) return { top: 15, right: 20, left: 5, bottom: 22 }
    return { top: 20, right: 30, left: 20, bottom: 26 }
  }

  const formatXAxisTick = (value: number) => {
    const date = new Date(value);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

  const colorPalette = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#ec4899'];

  const formatYAxisTick = (value: number): string => {
    if (viewMode === 'delta') {
      return value.toFixed(2);
    }
    return value.toString();
  };

  const formatTooltipValue = (value: number, name: string) => {
    if (name.includes('변화량')) {
      return value.toFixed(2);
    }
    return value;
  };

  const formatTooltipLabel = (value: number) => {
    const date = new Date(value);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className='ml-auto w-full sm:w-[95%] md:w-[85%] lg:w-[68.4%] 2xl:w-[68.8%] pb-5 md:-mr-2 2xl:-mr-5'>
      <Card className='w-full border shadow-sm border-slate-400 mt-4 sm:mt-6'>
        <CardHeader className='p-3 sm:p-4 space-y-2'>
          <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2'>
            <CardTitle className='text-sm sm:text-base md:text-lg text-gray-900'>
              비계전도 실시간 데이터{' '}
              {viewMode === 'general' && doorNum !== null && (
                <span className='text-blue-400 font-bold text-sm sm:text-base md:text-lg'>
                  Node-{doorNum}
                </span>
              )}
               {viewMode === 'delta' && doorNum !== null && (
                <span className='text-purple-400 font-bold text-sm sm:text-base md:text-lg'>
                  Node-{doorNum} (변화량)
                </span>
              )}
            </CardTitle>

            <div className='flex flex-row items-center justify-between sm:justify-end gap-3'>
              <div className='flex items-center gap-x-2'>
                <label
                  htmlFor='time-filter'
                  className='text-xs sm:text-sm md:text-base font-medium text-gray-700 whitespace-nowrap'
                >
                  기간:
                </label>
                <Select value={hours.toString()} onValueChange={v => onSelectTime(Number(v))}>
                  <SelectTrigger className='h-6 sm:h-8 w-[90px] sm:w-[120px] text-xs sm:text-sm md:text-base border border-slate-400'>
                    <SelectValue placeholder='Select time' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='1' className='text-xs sm:text-sm md:text-base'>1 시간</SelectItem>
                    <SelectItem value='6' className='text-xs sm:text-sm md:text-base'>6 시간</SelectItem>
                    <SelectItem value='12' className='text-xs sm:text-sm md:text-base'>12 시간</SelectItem>
                    <SelectItem value='24' className='text-xs sm:text-sm md:text-base'>24 시간</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Badge variant='outline' className='h-6 sm:h-8 text-xs sm:text-sm md:text-base border-slate-400'>
                데이터 수: {data.length}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className='p-0 pt-2' ref={containerRef}>
          <div className='w-full h-[280px] sm:h-[320px] md:h-[350px] lg:h-[330.5px] 2xl:h-[431px] px-1 sm:px-2'>
            <ResponsiveContainer width='103%' height='100%'>
              <LineChart key={finalData.length} data={finalData as any} margin={getChartMargins()}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                <XAxis
                  dataKey='timestamp'
                  domain={xAxisDomain}
                  tick={{ fontSize: isMobile ? 9 : 12 }}
                  tickFormatter={formatXAxisTick}
                  height={isMobile ? 20 : 30}
                  tickMargin={isMobile ? 5 : 10}
                  ticks={xAxisTicks}
                  type='number'
                />
                <YAxis
                  yAxisId='angle'
                  domain={yDomain}
                  ticks={yTicks}
                  tick={{ fontSize: isMobile ? 9 : 12 }}
                  width={isMobile ? 25 : 35}
                  tickMargin={isMobile ? 2 : 5}
                  tickFormatter={formatYAxisTick}
                />
                {viewMode === 'general' && (
                  <YAxis
                    yAxisId='wind'
                    orientation='right'
                    domain={windDomain}
                    ticks={windTicks}
                    tick={{ fontSize: isMobile ? 9 : 12 }}
                    width={isMobile ? 25 : 35}
                    tickMargin={isMobile ? 2 : 5}
                  />
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
                    wrapperStyle={{
                      fontSize: '12px',
                      marginBottom: '-10px',
                      paddingTop: '10px',
                    }}
                  />
                )}

                {viewMode === 'general' && (
                  <>
                    <ReferenceArea yAxisId='angle' y1={clamp(yDomain[0], yDomain[0], yDomain[1])} y2={clamp(-R, yDomain[0], yDomain[1])} fill='#ef4444' fillOpacity={0.1} />
                    <ReferenceArea yAxisId='angle' y1={clamp(R, yDomain[0], yDomain[1])} y2={clamp(yDomain[1], yDomain[0], yDomain[1])} fill='#ef4444' fillOpacity={0.1} />
                    <ReferenceArea yAxisId='angle' y1={clamp(-R, yDomain[0], yDomain[1])} y2={clamp(-Y, yDomain[0], yDomain[1])} fill='#ef4444' fillOpacity={0.1} />
                    <ReferenceArea yAxisId='angle' y1={clamp(Y, yDomain[0], yDomain[1])} y2={clamp(R, yDomain[0], yDomain[1])} fill='#ef4444' fillOpacity={0.1} />
                    <ReferenceArea yAxisId='angle' y1={clamp(-Y, yDomain[0], yDomain[1])} y2={clamp(-G, yDomain[0], yDomain[1])} fill='#eab308' fillOpacity={0.1} />
                    <ReferenceArea yAxisId='angle' y1={clamp(G, yDomain[0], yDomain[1])} y2={clamp(Y, yDomain[0], yDomain[1])} fill='#eab308' fillOpacity={0.1} />
                    <ReferenceArea yAxisId='angle' y1={clamp(-G, yDomain[0], yDomain[1])} y2={clamp(-B, yDomain[0], yDomain[1])} fill='#22c55e' fillOpacity={0.1} />
                    <ReferenceArea yAxisId='angle' y1={clamp(B, yDomain[0], yDomain[1])} y2={clamp(G, yDomain[0], yDomain[1])} fill='#22c55e' fillOpacity={0.1} />
                    <ReferenceArea yAxisId='angle' y1={clamp(-B, yDomain[0], yDomain[1])} y2={clamp(B, yDomain[0], yDomain[1])} fill='#3b82f6' fillOpacity={0.1} />
                  </>
                )}

                {viewMode === 'general' ? (
                  <>
                    <Line yAxisId='angle' type='monotone' dataKey='angle_x' stroke='#ef4444' strokeWidth={isMobile ? 1.5 : 2} dot={false} name='Angle X' />
                    <Line yAxisId='angle' type='monotone' dataKey='angle_y' stroke='#3b82f6' strokeWidth={isMobile ? 1.5 : 2} dot={false} name='Angle Y' />
                    <Line yAxisId='wind' type='monotone' dataKey='wind_speed' stroke='#22c55e' strokeWidth={isMobile ? 1.5 : 2} dot={false} name='Wind Speed (m/s)' />
                  </>
                ) : viewMode === 'top' ? (
                  allNodes.map((node, index) => (
                    <Line
                      key={node.doorNum}
                      yAxisId='angle'
                      type='monotone'
                      dataKey={`node_${node.doorNum}`}
                      stroke={colorPalette[index % colorPalette.length]}
                      strokeWidth={isMobile ? 1.5 : 2}
                      dot={false}
                      name={`Node-${node.doorNum} (Angle X)`}
                    />
                  ))
                ) : ( // viewMode === 'delta'
                  <Line
                    yAxisId='angle'
                    type='monotone'
                    dataKey={`node_${doorNum}`}
                    stroke='#8b5cf6'
                    strokeWidth={isMobile ? 1.5 : 2}
                    dot={false}
                    name={`Node-${doorNum} (변화량)`}
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