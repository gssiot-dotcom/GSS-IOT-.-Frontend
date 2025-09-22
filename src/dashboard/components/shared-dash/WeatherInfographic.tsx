'use client'

import { useWeather } from '@/hooks/useWeatherInfo'

// 풍향 텍스트 변환 함수
const getWindDirection = (deg: number) => {
    const directions = ['북', '북동', '동', '남동', '남', '남서', '서', '북서']
    const index = Math.round(deg / 45) % 8
    return directions[index]
}

const WeatherInfographic = () => {
    const { weather, loading, error } = useWeather()

    return (
        <div className='w-full'>
            {/* 날씨 및 미세먼지 정보 */}
            <div className='border border-blue-300 rounded-lg p-2 flex items-center justify-around text-blue-900 font-semibold text-xs sm:text-[13px]'>
                {loading && <span>날씨 정보를 불러오는 중...</span>}
                {error && <span className='text-red-600'>{error}</span>}
                {weather && !loading && !error && (
                    <>
                        {/* 풍속 */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>💨:</span>
                            <span>{weather.windSpeed} m/s</span>
                        </div>
                        {/* 풍향 */}
                        {weather.windDeg !== undefined && (
                            <div className='flex items-center gap-0.5 mx-1'>
                                <span>🧭:</span>
                                <span>{getWindDirection(weather.windDeg)}</span>
                            </div>
                        )}
                        {/* 날씨 아이콘 */}
                        {weather.icon && (
                            <div className='flex items-center gap-0.5 mx-1'>
                                <span>날씨:</span>
                                <img
                                    src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                                    alt="weather icon"
                                    className="w-6 h-6"
                                />
                            </div>
                        )}
                        {/* 온도 */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>🌡️:</span>
                            <span>{weather.temp.toFixed(1)}℃</span>
                        </div>
                        {/* 습도 */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>💧:</span>
                            <span>{weather.humidity}%</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default WeatherInfographic
