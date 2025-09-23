export interface WindData {
  time: string
  windSpeed: number
}

export async function fetchWindData(start: string, end: string): Promise<WindData[]> {
  try {
    const res = await fetch(`/api/wind?start=${start}&end=${end}`)
    if (!res.ok) {
      throw new Error(`Wind API 호출 실패: ${res.status}`)
    }

    const data = await res.json()
    return data.map((item: any) => ({
      time: item.time,
      windSpeed: Number(item.windSpeed) || 0,
    }))
  } catch (err) {
    console.error("fetchWindData 에러:", err)
    return []
  }
}

