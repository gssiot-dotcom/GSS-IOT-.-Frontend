/* eslint-disable @typescript-eslint/no-explicit-any */
import { combineAngleNodeToGatewaySchema } from '@/lib/vatidation'
import { connectAngleNodesRequest } from '@/services/apiRequests'
import { getGatewaysByTypeRequest } from '@/services/apiRequests' // ✅ 추가
import { IAngleNode } from '@/types/interfaces'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '../ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form'
import { Input } from '../ui/input'

// ✅ shadcn Select 사용 (프로젝트 경로에 맞게)
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

interface AngleNodeFormProps {
  angle_nodes: IAngleNode[]
  refetchNodes: () => void
}

// ✅ 게이트웨이 타입(응답 필드명은 실제 데이터에 맞게 수정)
type GatewayItem = {
  _id: string
  serial_number: string
  gateway_number?: string
  name?: string
}

const AngleBuildingForm = ({ angle_nodes, refetchNodes }: AngleNodeFormProps) => {
  const [checkinAngleNodesNumber, setCheckinAngleNodesNumber] = useState<number[] | null>(null)
  const [selectedGateway, setSelectedGateway] = useState<GatewayItem | null>(null)

  const form = useForm<z.infer<typeof combineAngleNodeToGatewaySchema>>({
    resolver: zodResolver(combineAngleNodeToGatewaySchema),
  })
  const { setValue } = form

  // ✅ 드롭다운용 게이트웨이 목록 가져오기
  const {
    data: gateways = [],
    isLoading: isGatewaysLoading,
    isError: isGatewaysError,
    refetch: refetchGateways,
  } = useQuery({
    queryKey: ['gateways-by-type', 'GATEWAY'],
    queryFn: getGatewaysByTypeRequest,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const gatewayOptions = useMemo(() => gateways as GatewayItem[], [gateways])

  // ✅ 게이트웨이 선택 시 폼 값 세팅
  const handleGatewaySelect = (gatewayId: string) => {
    const gw = gatewayOptions.find((g) => g._id === gatewayId) ?? null
    setSelectedGateway(gw)

    if (gw) {
      setValue('gateway_id', gw._id, { shouldDirty: true })

      // 스키마에 gateway_number가 꼭 필요하면(기존 호환용) 이것도 같이 채워줘
      // 실제 필드명이 다를 수 있으니 gw.gateway_number 부분만 맞춰주면 됨
      setValue('gateway_number', gw.gateway_number ?? '', { shouldDirty: true })
    } else {
      setValue('gateway_id', '', { shouldDirty: true })
      setValue('gateway_number', '', { shouldDirty: true })
    }
  }

  // =============== Handle Node selection ============ //
  const handleSelectedNodes = () => {
    const inputNodes = form.getValues().angle_nodes || ''

    const nodeNumbers = inputNodes
      .split(',')
      .map((num) => Number(num.trim()))
      .filter((num) => !isNaN(num))

    const selectedNodes = angle_nodes
      .filter((node) => nodeNumbers.includes(node.doorNum))
      .map((node) => node._id)

    const selectedNodesNumber = angle_nodes
      .filter((node) => nodeNumbers.includes(node.doorNum))
      .map((node) => node.doorNum)

    setCheckinAngleNodesNumber(selectedNodesNumber)
    setValue('selected_nodes', selectedNodes, { shouldDirty: true })
  }

  const handleReset = () => {
    form.reset()
    setSelectedGateway(null)
    setCheckinAngleNodesNumber(null)
  }

  // =============== Handle submit function ============ //
  const onSubmit = async (values: z.infer<typeof combineAngleNodeToGatewaySchema>) => {
    try {
      if (!selectedGateway) {
        toast.error('게이트웨이를 먼저 선택해주세요.')
        return
      }

      const sendingData = {
        angle_nodes: values.selected_nodes,
        gateway_id: values.gateway_id,
        serial_number: selectedGateway.serial_number, // ✅ 선택된 게이트웨이에서 가져옴
      }

      const resPromise = connectAngleNodesRequest(sendingData)
      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res) => {
          setTimeout(() => {
            form.reset()
            setSelectedGateway(null)
            setCheckinAngleNodesNumber(null)
            refetchNodes()
          }, 1000)
          return res.message
        },
        error: (err) => err.message || 'Something went wrong :(',
      })
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong :(')
    }
  }

  return (
    <div className="md:w-[40%] flex justify-center items-center flex-col md:text-lg text-sm text-gray-700">
      <h1 className="leading-none text-xl font-bold  pb-2 mb-5 underline underline-offset-4">
        Gateway ↔ 비계전도노드 연결
      </h1>

      <Form {...form}>
        <form
          className="w-full h-auto p-4 pb-8 border border-gray-400 bg-white text-gray-700 rounded-lg shadow-lg shadow-gray-300 space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* ✅ 게이트웨이 드롭다운 */}
          <div className="w-full">
            <FormItem>
              <FormLabel>게이트웨이 선택:</FormLabel>

              <FormControl>
                <Select
                  value={selectedGateway?._id ?? ''}
                  onValueChange={handleGatewaySelect}
                  disabled={isGatewaysLoading}
                >
                  <SelectTrigger className="w-full border-gray-700">
                    <SelectValue placeholder={isGatewaysLoading ? '불러오는 중...' : '게이트웨이를 선택하세요'} />
                  </SelectTrigger>

                  <SelectContent>
                    {gatewayOptions.map((gw) => (
                      <SelectItem key={gw._id} value={gw._id}>
                        {/* ✅ 라벨은 원하는 대로 */}
                        {gw.gateway_number ? `#${gw.gateway_number} ` : ''}
                        {gw.serial_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>

              {isGatewaysError && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-red-500 text-sm">게이트웨이 목록을 불러오지 못했습니다.</p>
                  <Button type="button" className="h-8" onClick={() => refetchGateways()}>
                    다시 시도
                  </Button>
                </div>
              )}

              {!!selectedGateway && (
                <div className="mt-2 flex gap-2">
                  <Button type="button" onClick={handleReset} className="h-9 w-fit">
                    reset
                  </Button>
                </div>
              )}
            </FormItem>
          </div>

          {/* ===== Angle nodes input ===== */}
          <div className="w-full">
            <FormField
              control={form.control}
              name="angle_nodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>노드 번호 입력:</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      {...field}
                      disabled={!selectedGateway} // ✅ 게이트웨이 선택 전에는 비활성
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="예: 1,2,4,5"
                      className="w-full border-gray-700 focus:border-transparent"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                disabled={!selectedGateway}
                onClick={handleSelectedNodes}
                className="h-9 w-fit"
              >
                선택한 노드 확인
              </Button>
            </div>
          </div>

          {/* Selected Angle-Nodes View field */}
          <div className="mb-2 text-sm">
            <label className="flex items-center gap-x-5 text-gray-700">
              노드 선택:{' '}
              {checkinAngleNodesNumber ? <p>{`${checkinAngleNodesNumber.length}`} 개 노드 선택함</p> : ''}
            </label>

            {checkinAngleNodesNumber && checkinAngleNodesNumber.length > 0 && (
              <div className="flex flex-wrap mt-2">
                {checkinAngleNodesNumber.map((nodeNumber) => (
                  <span key={nodeNumber} className="py-1 px-2 bg-blue-500 mr-2 text-white rounded">
                    {nodeNumber}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" className="h-12 w-full mt-2" disabled={!selectedGateway}>
            게이트웨이 연결
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default AngleBuildingForm
