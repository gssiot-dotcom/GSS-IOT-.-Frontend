// src/hooks/useWeatherInfo.ts
import { useEffect, useState } from "react"
import axios from "axios"

interface WeatherData {
  temp: number
  humidity: number
  windSpeed: number
  windDeg: number
  description: string
  icon: string
  pm10?: number
  earthquake?: boolean
  typhoon?: boolean
  typhoonLabel?: string  // ✅ 추가됨
}

// 영어 → 한국어 매핑
const weatherMap: Record<string, string> = {
  Clear: "맑음",
  Clouds: "구름많음",
  Cloudy: "흐림",
  Rain: "비",
  Drizzle: "이슬비",
  Thunderstorm: "천둥번개",
  Snow: "눈",
  Mist: "옅은안개",
  Smoke: "연기",
  Haze: "실안개",
  Dust: "황사",
  Fog: "안개",
  Sand: "모래",
  Ash: "화산재",
  Squall: "돌풍",
  Tornado: "토네이도",
}

// ✅ typhoon_eff 숫자 → 한국어 라벨 매핑
const typhoonMap: Record<number, string> = {
  1: "상륙",
  2: "강함",
  3: "약함",
  4: "없음",
}

export const useWeather = (buildingId: string) => {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = async () => {
    try {
      if (!buildingId) {
        setError("빌딩 ID가 필요합니다.")
        setLoading(false)
        return
      }

      // ✅ 1. 백엔드에서 최신 날씨 가져오기
      const res = await axios.get(
        `${import.meta.env.VITE_SERVER_BASE_URL}/api/weather/latest`,
        { params: { buildingId } }
      )

      console.log("✅ Weather API Response:", res.data)

      const latest = res.data
      if (!latest) {
        setError("날씨 데이터가 없습니다.")
        setWeather(null)
        return
      }

      const temp = latest.temperature ?? 0
      const humidity = latest.humidity ?? 0
      const windSpeed = latest.wind_speed ?? 0
      const description =
        weatherMap[latest.weather] ?? latest.weather ?? "정보 없음"
      const windDirection = latest.wind_direction ?? "N"

      const directionMap: Record<string, number> = {
        N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
        E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
        S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
        W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
      }
      const windDeg = directionMap[windDirection] ?? 0

      // ✅ 2. typhoon_eff (1~4) 처리
      const typhoonEff: number = latest.typhoon_eff ?? 4
      const typhoonLabel = typhoonMap[typhoonEff] ?? "정보 없음"
      const typhoon = typhoonEff !== 4 // 4이면 없음 → false, 나머지는 true

      // ----------------------------
      // 3. OpenWeather → 미세먼지
      // ----------------------------
      let pm10: number | undefined = undefined
      try {
        const lat = 37.5665 // 서울 기본 (실제로는 building 좌표 필요)
        const lon = 126.9780
        const apiKey = import.meta.env.VITE_OPENWEATHER_KEY || "f9d0ac2f06dd719db58be8c04d008e76"

        const airRes = await fetch(
          `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
        )
        const airData = await airRes.json()
        pm10 = airData.list?.[0]?.components?.pm10
      } catch (e) {
        console.warn("미세먼지 API 호출 실패", e)
      }

      // ✅ 최종 상태 업데이트
      setWeather({
        temp,
        humidity,
        windSpeed,
        windDeg,
        description,
        icon: "",
        pm10,
        earthquake: false, // 지진 정보는 현재 미사용
        typhoon,
        typhoonLabel,
      })
    } catch (err) {
      setError("날씨 정보를 불러오는 데 실패했습니다.")
      console.error("❌ Weather API Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
    const timer = setInterval(fetchWeather, 10 * 60 * 1000) // 10분마다 갱신
    return () => clearInterval(timer)
  }, [buildingId])

  return { weather, loading, error }
}
