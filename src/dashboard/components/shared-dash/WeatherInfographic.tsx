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

    // 하늘 상태 변환 함수
    const getSkyDescription = (sky: string, pty: string) => {
        if (pty !== "0") {
            switch (pty) {
                case "1": return "비"
                case "2": return "비/눈"
                case "3": return "눈"
                case "4": return "소나기"
                case "5": return "빗방울"
                case "6": return "빗방울/눈날림"
                case "7": return "눈날림"
                default: return "강수"
            }
        } else {
            switch (sky) {
                case "1": return "맑음"
                case "3": return "구름많음"
                case "4": return "흐림"
                default: return "정보 없음"
            }
        }
    }

    return (
        <div className='w-full'>
            {/* 날씨 및 특보 정보 */}
            <div className='border border-blue-300 rounded-lg p-2 flex flex-wrap items-center justify-around text-blue-900 font-semibold text-xs sm:text-[13px] gap-y-1'>
                {loading && <span>날씨 정보를 불러오는 중...</span>}
                {error && <span className='text-red-600'>{error}</span>}
                {weather && !loading && !error && (
                    <>
                        {/* 풍속 */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>💨풍속:</span>
                            <span>{weather.windSpeed} m/s</span>
                        </div>

                        {/* 풍향 */}
                        {weather.windDeg !== undefined && (
                            <div className='flex items-center gap-0.5 mx-1'>
                                <span>🧭풍향:</span>
                                <span>{getWindDirection(weather.windDeg)}풍</span>
                            </div>
                        )}

                        {/* 하늘 상태 (SKY+PTY 조합) */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>☁️날씨:</span>
                            <span>
                                {getSkyDescription(
                                    weather.sky ?? "0",
                                    weather.pty ?? "0"
                                )}
                            </span>
                        </div>

                        {/* 온도 */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>🌡️온도:</span>
                            <span>{weather.temp.toFixed(1)}℃</span>
                        </div>

                        {/* 습도 */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>💧습도:</span>
                            <span>{weather.humidity}%</span>
                        </div>

                        {/* 태풍 특보 */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>🌀태풍:</span>
                            {weather.typhoon
                                ? <span className='text-purple-600'>태풍 특보</span>
                                : <span className='text-gray-500'>없음</span>}
                        </div>

                        {/* 지진 특보 */}
                        <div className='flex items-center gap-0.5 mx-1'>
                            <span>🌋지진:</span>
                            {weather.earthquake
                                ? <span className='text-red-600'>지진 특보</span>
                                : <span className='text-gray-500'>없음</span>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default WeatherInfographic
