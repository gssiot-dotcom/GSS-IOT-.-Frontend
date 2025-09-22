import { useEffect, useState } from 'react'

interface WeatherData {
    temp: number
    humidity: number
    windSpeed: number
    windDeg: number
    description: string
    icon: string
    pm10?: number
    earthquake?: boolean   // ✅ 지진 특보 여부
    typhoon?: boolean      // ✅ 태풍 특보 여부
    sky?: string           // SKY 원본 값
    pty?: string           // PTY 원본 값
}

// ----------------------------
// 위도/경도 → 기상청 격자 변환 함수
// ----------------------------
function dfs_xy_conv(lat: number, lon: number) {
    const RE = 6371.00877     // 지구 반경(km)
    const GRID = 5.0          // 격자 간격(km)
    const SLAT1 = 30.0        // 투영 위도1(degree)
    const SLAT2 = 60.0        // 투영 위도2(degree)
    const OLON = 126.0        // 기준점 경도
    const OLAT = 38.0         // 기준점 위도
    const XO = 43             // 기준점 X좌표 (GRID)
    const YO = 136            // 기준점 Y좌표 (GRID)

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
            const serviceKey =
                "ntz%2BGOSlBMCP%2FxMVTqY2d3Ik%2FlRw5RIeQM6FRNZD0Z3%2FWXUI3n%2F7v4lRHAy1yB5ovSRBepiK09V0yUi1od55eg%3D%3D"

            // ----------------------------
            // 1. 위경도 → 기상청 격자 좌표 변환
            // ----------------------------
            const { nx, ny } = dfs_xy_conv(lat, lon)

            const now = new Date()
            let baseDate = now.toISOString().slice(0, 10).replace(/-/g, "") // yyyyMMdd

            // 발표시각 목록 (3시간 간격)
            const baseTimes = ["2300", "0200", "0500", "0800", "1100", "1400", "1700", "2000"]
            let baseTime = "0200"

            // 현재 시각에 맞는 baseTime 선택
            for (let t of baseTimes) {
                const h = parseInt(t.slice(0, 2), 10)
                if (now.getHours() >= h) {
                    baseTime = t
                }
            }

            // 새벽 0~1시는 전날 23시 기준
            if (now.getHours() < 2) {
                const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                baseDate = yest.toISOString().slice(0, 10).replace(/-/g, "")
                baseTime = "2300"
            }

            const fcstResponse = await fetch(
                `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
            )
            const fcstData = await fcstResponse.json()

            // 기본값
            let temp = 0,
                humidity = 0,
                windSpeed = 0,
                windDeg = 0,
                sky = "0",
                pty = "0",
                description = "정보 없음"

            if (fcstData?.response?.body?.items?.item) {
                const items = fcstData.response.body.items.item
                items.forEach((it: any) => {
                    switch (it.category) {
                        case "TMP": temp = Number(it.fcstValue); break
                        case "REH": humidity = Number(it.fcstValue); break
                        case "WSD": windSpeed = Number(it.fcstValue); break
                        case "VEC": windDeg = Number(it.fcstValue); break
                        case "SKY": sky = it.fcstValue; break
                        case "PTY": pty = it.fcstValue; break
                    }
                })

                // SKY + PTY 조합으로 상태 문구 생성
                if (pty !== "0") {
                    switch (pty) {
                        case "1": description = "비"; break
                        case "2": description = "비/눈"; break
                        case "3": description = "눈"; break
                        case "4": description = "소나기"; break
                        case "5": description = "빗방울"; break
                        case "6": description = "빗방울/눈날림"; break
                        case "7": description = "눈날림"; break
                        default: description = "강수"; break
                    }
                } else {
                    switch (sky) {
                        case "1": description = "맑음"; break
                        case "3": description = "구름많음"; break
                        case "4": description = "흐림"; break
                        default: description = "정보 없음"; break
                    }
                }
            }

            // ----------------------------
            // 2. OpenWeather 미세먼지 API
            // ----------------------------
            const airResponse = await fetch(
                `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=f9d0ac2f06dd719db58be8c04d008e76`
            )
            const airData = await airResponse.json()
            const pm10 = airData.list?.[0]?.components.pm10

            // ----------------------------
            // 3. 기상청 특보 API (지진, 태풍 체크)
            // ----------------------------
            const wrnResponse = await fetch(
                `https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList?serviceKey=${serviceKey}&pageNo=1&numOfRows=50&dataType=JSON`
            )
            const wrnData = await wrnResponse.json()

            let earthquake = false
            let typhoon = false
            if (wrnData?.response?.body?.items?.item) {
                wrnData.response.body.items.item.forEach((it: any) => {
                    const t = it?.title || it?.event || ""
                    if (t.includes("지진")) earthquake = true
                    if (t.includes("태풍")) typhoon = true
                })
            }

            // 상태 업데이트
            setWeather({
                temp,
                humidity,
                windSpeed,
                windDeg,
                description, // ✅ SKY+PTY 조합 문구
                icon: "",
                pm10,
                earthquake,
                typhoon,
                sky, // 원본 값 보관
                pty, // 원본 값 보관
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

        // 최초 실행
        updateWeather()

        // 다음 발표 시각 계산
        const now = new Date()
        const baseHours = [2, 5, 8, 11, 14, 17, 20, 23] // 발표 시각(시)
        let nextHour = baseHours.find(h => h > now.getHours())
        if (!nextHour) nextHour = 2 // 자정 넘어가면 새날 02시

        const next = new Date(now)
        next.setHours(nextHour, 0, 0, 0)

        const timeout = next.getTime() - now.getTime()

        // 다음 발표 시각에 맞춰 갱신 예약
        const timer = setTimeout(updateWeather, timeout)

        return () => clearTimeout(timer)
    }, [])

    return { weather, loading, error }
}
