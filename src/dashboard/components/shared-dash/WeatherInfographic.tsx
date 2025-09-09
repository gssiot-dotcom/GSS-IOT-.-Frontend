'use client'

import { useWeather } from '@/hooks/useWeatherInfo'

const WeatherInfographic = () => {
    const { weather, loading, error } = useWeather()

    return (
        <div className='w-full'>
            {/* 날씨 및 미세먼지 정보 */}
            <div className='bg-blue-200 bg-opacity-50 rounded-lg p-2 flex items-center justify-around text-blue-900 font-semibold text-xs sm:text-[13px]'>
                {loading && <span>날씨 정보를 불러오는 중...</span>}
                {error && <span className='text-red-600'>{error}</span>}
                {weather && !loading && !error && (
                    <>
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>🌡️:</span>
                            <span>{weather.temp.toFixed(1)}℃</span>
                        </div>
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>💧:</span>
                            <span>{weather.humidity}%</span>
                        </div>
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>💨:</span>
                            <span>{weather.windSpeed}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default WeatherInfographic
