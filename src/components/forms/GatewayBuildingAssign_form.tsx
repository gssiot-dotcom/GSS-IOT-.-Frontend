import { useEffect, useState } from 'react'
import axios from 'axios'
import { IBuilding, IGateway } from '@/types/interfaces'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'

interface GatewayBuildingAssignProps {
  gateways: IGateway[]
  refetchAll: () => void
}

const GatewayBuildingAssignForm = ({
  gateways,
  refetchAll,
}: GatewayBuildingAssignProps) => {
  const [buildings, setBuildings] = useState<IBuilding[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [selectedGatewayId, setSelectedGatewayId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const api = axios.create({
    baseURL: import.meta.env.VITE_SERVER_BASE_URL,
    withCredentials: true,
  })

  // 🔹 전체 빌딩 불러오기
  useEffect(() => {
    const loadBuildings = async () => {
      try {
        const res = await api.get('/company/get-buildings')
        setBuildings(res.data.buildings ?? [])
      } catch (err: any) {
        console.error('빌딩 불러오기 실패:', err)
        setError(err?.response?.data?.message || '빌딩을 불러오지 못했습니다.')
      }
    }
    loadBuildings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🔹 빌딩에 게이트웨이 연결
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGatewayId || !selectedBuildingId) {
      setError('게이트웨이와 빌딩을 모두 선택해주세요.')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      await api.put('/company/building/change-gateway-building', {
        gateway_id: selectedGatewayId,
        building_id: selectedBuildingId,
      })

      alert('연결 완료!')
      setSelectedBuildingId('')
      setSelectedGatewayId('')
      refetchAll()
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.message || '연결 중 에러가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-[30vw] flex flex-col justify-center items-center md:text-lg text-sm text-gray-800">
      <h1 className="leading-none text-xl font-bold text-gray-700 pb-2 mb-5 underline underline-offset-4">
        게이트웨이 → 빌딩 연결
      </h1>

      {error && (
        <Alert className="text-red-600 py-2 mt-2 mb-2" variant="destructive">
          <AlertCircle className="h-4 w-4" color="red" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-[26vw] h-auto p-4 pb-8 border border-gray-400 bg-white text-gray-700 rounded-lg shadow-lg shadow-gray-300 space-y-3 min-h-[300px]"
      >
        {/* 빌딩 선택 */}
        <div className="space-y-1">
          <label className="font-medium mb-1">빌딩 선택</label>
          <select
            value={selectedBuildingId}
            onChange={e => setSelectedBuildingId(e.target.value)}
            className="w-full border p-0 rounded border-gray-700 focus:border-transparent text-base"
            disabled={isLoading}
          >
            <option value="">선택하세요</option>
            {buildings.map(b => (
              <option key={b._id} value={b._id}>
                {b.building_name}
              </option>
            ))}
          </select>
        </div>

        {/* 게이트웨이 선택 */}
        <div className="space-y-1 mt-8">
          <label className="font-medium mb-1">게이트웨이 선택</label>
          <select
            value={selectedGatewayId}
            onChange={e => setSelectedGatewayId(e.target.value)}
            className="w-full border p-0 rounded border-gray-700 focus:border-transparent text-base"
            disabled={isLoading}
          >
            <option value="">선택하세요</option>
            {gateways.map(gw => (
              <option key={gw._id} value={gw._id}>
                {gw.serial_number} {gw.gateway_type ? `(${gw.gateway_type})` : ''}
              </option>
            ))}
          </select>
        </div>


        <Button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full mt-2"
        >
          {isLoading ? '연결 중...' : '연결하기'}
        </Button>
      </form>
    </div>
  )
}

export default GatewayBuildingAssignForm
