'use client'

import { useWeather } from '@/hooks/useWeatherInfo'
import { Button } from '@/components/ui/button'

// 풍향 텍스트 변환 함수 (deg → 한글)
const getWindDirection = (deg: number) => {
  const directions = ['북', '북동', '동', '남동', '남', '남서', '서', '북서']
  const index = Math.round((deg % 360) / 45) % 8
  return directions[index]
}

const WeatherInfo = ({ buildingId }: { buildingId: string }) => {
  const { weather, loading, error } = useWeather(buildingId)

  const handleGoToKMA = () => {
    window.open('https://www.kma.go.kr/', '_blank')
  }

  return (
    <div className="w-full p-4">
      {/* 기상청 바로가기 버튼 */}
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-100"
          onClick={handleGoToKMA}
        >
          기상청 바로가기
        </Button>
      </div>

      {/* 날씨 및 특보 정보 */}
      <div className="bg-blue-200/50 rounded-lg p-4 flex flex-wrap items-center justify-around text-blue-900 font-semibold gap-2 min-h-[4rem]">
        {loading && <span>날씨 정보를 불러오는 중...</span>}
        {error && <span className="text-red-600">{error}</span>}

        {weather && !loading && !error && (
          <>
            {/* 풍속 */}
            <div className="flex items-center gap-1">
              <span>💨풍속:</span>
              <span>{weather.windSpeed} m/s</span>
            </div>

            {/* 풍향 */}
            {weather.windDeg !== undefined && (
              <div className="flex items-center gap-1">
                <span>🧭풍향:</span>
                <span>{getWindDirection(weather.windDeg)}풍</span>
              </div>
            )}

            {/* 날씨 설명 */}
            <div className="flex items-center gap-1">
              <span>☁️날씨:</span>
              <span>{weather.description ?? '정보 없음'}</span>
            </div>

            {/* 온도 */}
            <div className="flex items-center gap-1">
              <span>🌡️온도:</span>
              <span>{weather.temp.toFixed(1)}℃</span>
            </div>

            {/* 습도 */}
            <div className="flex items-center gap-1">
              <span>💧습도:</span>
              <span>{weather.humidity}%</span>
            </div>

            {/* 태풍 특보 */}
            <div className="flex items-center gap-1">
              <span>🌀태풍:</span>
              {weather.typhoon ? (
                <span className="text-purple-600">태풍 특보</span>
              ) : (
                <span className="text-gray-500">없음</span>
              )}
            </div>

            {/* 지진 특보 */}
            <div className="flex items-center gap-1">
              <span>🌋지진:</span>
              {weather.earthquake ? (
                <span className="text-red-600">지진 특보</span>
              ) : (
                <span className="text-gray-500">없음</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default WeatherInfo

