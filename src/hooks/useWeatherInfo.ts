import { useEffect, useState } from "react"

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
  sky?: string
  pty?: string
}

// ----------------------------
// 위도/경도 → 기상청 격자 변환
// ----------------------------
function dfs_xy_conv(lat: number, lon: number) {
  const RE = 6371.00877
  const GRID = 5.0
  const SLAT1 = 30.0
  const SLAT2 = 60.0
  const OLON = 126.0
  const OLAT = 38.0
  const XO = 43
  const YO = 136

  const DEGRAD = Math.PI / 180.0

  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD
  const slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD
  const olat = OLAT * DEGRAD

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = re * sf / Math.pow(ro, sn)

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = re * sf / Math.pow(ra, sn)

  let theta = lon * DEGRAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn

  const x = Math.floor(ra * Math.sin(theta) + XO + 0.5)
  const y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)

  return { nx: x, ny: y }
}

export const useWeather = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      const apiKey = "f9d0ac2f06dd719db58be8c04d008e76"
      const serviceKey =
        "ntz%2BGOSlBMCP%2FxMVTqY2d3Ik%2FlRw5RIeQM6FRNZD0Z3%2FWXUI3n%2F7v4lRHAy1yB5ovSRBepiK09V0yUi1od55eg%3D%3D"

      // ----------------------------
      // 1. OpenWeather → temp/humidity/wind
      // ----------------------------
      const owRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`
      )
      const owData = await owRes.json()

      const temp = owData.main?.temp ?? 0
      const humidity = owData.main?.humidity ?? 0
      const windSpeed = owData.wind?.speed ?? 0
      const windDeg = owData.wind?.deg ?? 0

      // ----------------------------
      // 2. 기상청 → 날씨 상태(SKY+PTY)
      // ----------------------------
      const { nx, ny } = dfs_xy_conv(lat, lon)

      const now = new Date()
      let baseDate = now.toISOString().slice(0, 10).replace(/-/g, "")
      const baseTimes = ["2300", "0200", "0500", "0800", "1100", "1400", "1700", "2000"]
      let baseTime = "0200"
      for (let t of baseTimes) {
        const h = parseInt(t.slice(0, 2), 10)
        if (now.getHours() >= h) baseTime = t
      }
      if (now.getHours() < 2) {
        const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        baseDate = yest.toISOString().slice(0, 10).replace(/-/g, "")
        baseTime = "2300"
      }

      const fcstResponse = await fetch(
        `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
      )
      const fcstData = await fcstResponse.json()

      let sky = "0", pty = "0", description = "정보 없음"
      if (fcstData?.response?.body?.items?.item) {
        fcstData.response.body.items.item.forEach((it: any) => {
          if (it.category === "SKY") sky = it.fcstValue
          if (it.category === "PTY") pty = it.fcstValue
        })
        if (pty !== "0") {
          switch (pty) {
            case "1": description = "비"; break
            case "2": description = "비/눈"; break
            case "3": description = "눈"; break
            case "4": description = "소나기"; break
            case "5": description = "빗방울"; break
            case "6": description = "빗방울/눈날림"; break
            case "7": description = "눈날림"; break
          }
        } else {
          switch (sky) {
            case "1": description = "맑음"; break
            case "3": description = "구름많음"; break
            case "4": description = "흐림"; break
          }
        }
      }

      // ----------------------------
      // 3. OpenWeather → 미세먼지
      // ----------------------------
      const airRes = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
      )
      const airData = await airRes.json()
      const pm10 = airData.list?.[0]?.components.pm10

      // ----------------------------
      // 4. 기상청 → 특보(지진/태풍)
      // ----------------------------
      let earthquake = false, typhoon = false
      try {
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

      // ----------------------------
      // 최종 상태 업데이트
      // ----------------------------
      setWeather({
        temp,
        humidity,
        windSpeed,
        windDeg,
        description, // ✅ 기상청 SKY/PTY 문구
        icon: owData.weather?.[0]?.icon ?? "",
        pm10,
        earthquake,
        typhoon,
        sky,
        pty,
      })
    } catch (err) {
      setError("날씨 정보를 불러오는 데 실패했습니다.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("위치 정보를 지원하지 않는 브라우저입니다.")
      setLoading(false)
      return
    }
    const updateWeather = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => {
          setError("위치 정보를 가져오는 데 실패했습니다.")
          setLoading(false)
        }
      )
    }
    updateWeather()
    const timer = setInterval(updateWeather, 10 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  return { weather, loading, error }
}
