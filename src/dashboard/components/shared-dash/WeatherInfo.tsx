'use client'

import { useWeather } from '@/hooks/useWeatherInfo'
import { Button } from '@/components/ui/button'

const WeatherInfo = () => {
    const { weather, loading, error } = useWeather()

    const handleGoToKMA = () => {
        window.open('https://www.kma.go.kr/', '_blank')
    }

    return (
        <div className='w-full p-4'>
            {/* 기상청 바로가기 버튼 */}
            <div className='flex justify-end mb-4'>
                <Button
                    variant='outline'
                    className='border-gray-300 text-gray-700 hover:bg-gray-100'
                    onClick={handleGoToKMA}
                >
                    기상청 바로가기
                </Button>
            </div>

            {/* 날씨 및 미세먼지 정보 */}
            <div className='bg-blue-200 bg-opacity-50 rounded-lg p-4 flex items-center justify-around text-blue-900 font-semibold'>
                {loading && <span>날씨 정보를 불러오는 중...</span>}
                {error && <span className='text-red-600'>{error}</span>}
                {weather && !loading && !error && (
                    <>
                        <div className='flex items-center gap-2'>
                            <span>🌡️</span>
                            <span>온도: {weather.temp.toFixed(1)}℃</span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <span>💧</span>
                            <span>습도: {weather.humidity}%</span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <span>💨</span>
                            <span>풍속: {weather.windSpeed} m/s</span>
                        </div>
                        {/* description 제거 */}
                        <div className='flex items-center gap-2'>
                            <span>🌫️</span>
                            <span>미세먼지 {weather.pm10 ?? '-'} μg/m³</span>
                        </div>
            
                    </>
                )}
            </div>
        </div>
    )
}

export default WeatherInfo
