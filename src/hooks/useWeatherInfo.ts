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

export const useWeather = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchWeather = async (lat: number, lon: number) => {
        try {
            const serviceKey =
                "ntz%2BGOSlBMCP%2FxMVTqY2d3Ik%2FlRw5RIeQM6FRNZD0Z3%2FWXUI3n%2F7v4lRHAy1yB5ovSRBepiK09V0yUi1od55eg%3D%3D"

            // ----------------------------
            // 1. 기상청 단기예보 API 호출
            // ----------------------------
            const nx = 60 // TODO: 위도/경도 → 격자 좌표 변환 필요 (예시: 서울 종로구)
            const ny = 127

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

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                fetchWeather(latitude, longitude)
            },
            () => {
                setError("위치 정보를 가져오는 데 실패했습니다.")
                setLoading(false)
            }
        )
    }, [])

    return { weather, loading, error }
}
