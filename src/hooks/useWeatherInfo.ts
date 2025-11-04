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

      // 기본 값 매핑
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

      // ----------------------------
      // 2. OpenWeather → 미세먼지
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

      // ----------------------------
      // 3. 기상청 → 특보(지진/태풍)
      // ----------------------------
      let earthquake = false
      let typhoon = false
      try {
        const serviceKey =
          import.meta.env.VITE_KMA_KEY ||
          "ntz%2BGOSlBMCP%2FxMVTqY2d3Ik%2FlRw5RIeQM6FRNZD0Z3%2FWXUI3n%2F7v4lRHAy1yB5ovSRBepiK09V0yUi1od55eg%3D%3D"

        const wrnRes = await fetch(
          `https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList?serviceKey=${serviceKey}&pageNo=1&numOfRows=50&dataType=JSON`
        )
        const wrnData = await wrnRes.json()
        if (wrnData?.response?.body?.items?.item) {
          wrnData.response.body.items.item.forEach((it: any) => {
            const t = it?.title || it?.event || ""
            if (t.includes("지진")) earthquake = true
            if (t.includes("태풍")) typhoon = true
          })
        }
      } catch (e) {
        console.warn("특보 API 호출 실패", e)
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
        earthquake,
        typhoon,
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

