import { useEffect, useState } from 'react'

interface WeatherData {
    temp: number
    humidity: number
    windSpeed: number
    description: string
    pm10?: number  // 미세먼지 PM10 농도 추가
}

export const useWeather = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchWeather = async (lat: number, lon: number) => {
        try {
            // 1. 날씨 API 호출
            const weatherResponse = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=f9d0ac2f06dd719db58be8c04d008e76&units=metric&lang=kr`
            )
            const weatherData = await weatherResponse.json()

            // 2. 미세먼지 API 호출
            const airResponse = await fetch(
                `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=f9d0ac2f06dd719db58be8c04d008e76`
            )
            const airData = await airResponse.json()
            const pm10 = airData.list?.[0]?.components.pm10

            setWeather({
                temp: weatherData.main.temp,
                humidity: weatherData.main.humidity,
                windSpeed: weatherData.wind.speed,
                description: weatherData.weather[0].description,
                pm10,
            })
        } catch (err) {
            setError('날씨 정보를 불러오는 데 실패했습니다.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!navigator.geolocation) {
            setError('위치 정보를 지원하지 않는 브라우저입니다.')
            setLoading(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords
                fetchWeather(latitude, longitude)
            },
            () => {
                setError('위치 정보를 가져오는 데 실패했습니다.')
                setLoading(false)
            }
        )
    }, [])

    return { weather, loading, error }
}
