/* eslint-disable @typescript-eslint/no-explicit-any */
import { combineAngleNodeToGatewaySchema } from '@/lib/vatidation'
import {
  connectAngleNodesRequest,
  getGatewaysByTypeRequest,
  getAllTypeActiveNodesRequest,
  getAngleAliveNodes,
} from '@/services/apiRequests'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '../ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

interface AngleNodeFormProps {
  // ⛔ 이제 props angle_nodes 안 써도 됨(서버에서 가져와서 검증/매핑)
  angle_nodes?: any[]
  refetchNodes: () => void
}

type GatewayItem = {
  _id: string
  serial_number: string
  gateway_number?: string
  name?: string
}

type NodeType = 'HATCH' | 'ANGLE' // 해치발판 / 비계전도

const pickDoorNum = (x: any) => {
  const v = x?.doorNum ?? x?.node_number ?? x?.nodeNum ?? x?.node
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const pickId = (x: any) => x?._id ?? x?.id ?? null

const isUsable = (x: any) => {
  // 화면에 status=true 라고 뜨는 경우가 있어서 다 커버
  const v = x?.status ?? x?.node_status ?? x?.nodeStatus ?? x?.active ?? x?.isActive
  return v === true
}

/**
 * ✅ getAllTypeActiveNodesRequest() 응답에서 타입별 리스트 뽑기
 * 프로젝트마다 키가 다를 수 있어서 넉넉하게 처리
 */
const extractTypeList = (all: any, type: NodeType): any[] => {
  if (!all) return []

  // 1) 가장 흔한 케이스: all.angle / all.hatch 처럼 타입별 배열
  if (type === 'ANGLE') {
    if (Array.isArray(all?.angle)) return all.angle
    if (Array.isArray(all?.angle_nodes)) return all.angle_nodes
    if (Array.isArray(all?.angleNodes)) return all.angleNodes
  }

  if (type === 'HATCH') {
    if (Array.isArray(all?.hatch)) return all.hatch
    if (Array.isArray(all?.hatch_nodes)) return all.hatch_nodes
    if (Array.isArray(all?.hatchNodes)) return all.hatchNodes
  }

  // 2) all.nodes 안에 type 필드가 있는 케이스
  const base =
    Array.isArray(all?.nodes) ? all.nodes
      : Array.isArray(all?.items) ? all.items
        : Array.isArray(all?.data) ? all.data
          : []

  if (!Array.isArray(base)) return []

  const typeKey =
    type === 'ANGLE' ? ['ANGLE', 'angle', '비계전도']
      : ['HATCH', 'hatch', '해치발판']

  return base.filter((x: any) => typeKey.includes(x?.type) || typeKey.includes(x?.nodeType))
}

const AngleBuildingForm = ({ refetchNodes }: AngleNodeFormProps) => {
  const [checkinAngleNodesNumber, setCheckinAngleNodesNumber] = useState<number[] | null>(null)
  const [selectedGateway, setSelectedGateway] = useState<GatewayItem | null>(null)

  // ✅ 타입 선택(체크박스 2개)
  const [nodeType, setNodeType] = useState<NodeType>('ANGLE') // 기본: 비계전도

  // ✅ 없다는 메시지 표시
  const [missingMsg, setMissingMsg] = useState<string>('')

  const form = useForm<z.infer<typeof combineAngleNodeToGatewaySchema>>({
    resolver: zodResolver(combineAngleNodeToGatewaySchema),
    defaultValues: {
      gateway_number: '',
      angle_nodes: '',
      gateway_id: '',
      selected_nodes: [],
    },
  })
  const { setValue } = form

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

  const gatewayOptions = useMemo(() => {
    const list = (gateways as GatewayItem[]) ?? []

    const toNum = (v?: string) => {
      if (!v) return Number.POSITIVE_INFINITY
      const n = Number(v)
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
    }

    return [...list].sort((a, b) => {
      const an = toNum(a.gateway_number)
      const bn = toNum(b.gateway_number)
      if (an !== bn) return an - bn
      return (a.serial_number ?? '').localeCompare(b.serial_number ?? '')
    })
  }, [gateways])

  const handleGatewaySelect = (gatewayId: string) => {
    const gw = gatewayOptions.find((g) => g._id === gatewayId) ?? null
    setSelectedGateway(gw)

    if (gw) {
      setValue('gateway_id', gw._id, { shouldDirty: true })
      setValue('gateway_number', gw.gateway_number ?? '', { shouldDirty: true })
    } else {
      setValue('gateway_id', '', { shouldDirty: true })
      setValue('gateway_number', '', { shouldDirty: true })
    }
  }

  /**
   * ✅ 선택한 노드 확인:
   * 1) getAllTypeActiveNodesRequest에서 선택 타입의 "사용가능 doorNum"인지 검사
   * 2) 통과하면 getAngleAliveNodes로 doorNum→_id 매핑해서 selected_nodes 저장
   */
  const handleSelectedNodes = async () => {
    setMissingMsg('')
    setCheckinAngleNodesNumber(null)
    setValue('selected_nodes', [], { shouldDirty: true })

    const inputNodes = form.getValues().angle_nodes || ''
    const nodeNumbers = inputNodes
      .split(',')
      .map((num) => Number(num.trim()))
      .filter((num) => Number.isFinite(num))

    if (nodeNumbers.length === 0) {
      toast.error('노드 번호를 입력해주세요. 예: 1,2,4')
      return
    }

    try {
      // 1) 타입별 사용가능 노드 doorNum 체크
      const all = await getAllTypeActiveNodesRequest()
      const typeList = extractTypeList(all, nodeType)

      const usableSet = new Set(
        (Array.isArray(typeList) ? typeList : [])
          .filter(isUsable)
          .map(pickDoorNum)
          .filter((n): n is number => typeof n === 'number')
      )

      const missing = nodeNumbers.filter((dn) => !usableSet.has(dn))
      if (missing.length > 0) {
        setMissingMsg(`사용가능노드에 없는 번호: ${missing.join(', ')}`)
        toast.error('사용가능노드에 없는 번호가 포함되어 있습니다.')
        return
      }

      // 2) alive API로 _id 매핑(doorNum -> _id)
      const aliveRows = await getAngleAliveNodes() // [{_id, doorNum, ...}, ...]
      const aliveList = Array.isArray(aliveRows) ? aliveRows : []

      const idMap = new Map<number, string>()
      aliveList.forEach((x: any) => {
        const dn = pickDoorNum(x)
        const id = pickId(x)
        if (dn !== null && id) idMap.set(dn, String(id))
      })

      const selectedIds = nodeNumbers
        .map((dn) => idMap.get(dn))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      const missingIds = nodeNumbers.filter((dn) => !idMap.get(dn))
      if (missingIds.length > 0) {
        // 사용가능엔 있는데 alive에 없으면 매핑 불가(서버 응답에 _id가 없거나, DB에 없거나)
        setMissingMsg(`alive 목록에서 _id 매핑 실패: ${missingIds.join(', ')}`)
        toast.error('alive 목록에서 일부 노드의 _id를 찾지 못했습니다.')
        return
      }

      setCheckinAngleNodesNumber(nodeNumbers)
      setValue('selected_nodes', selectedIds, { shouldDirty: true })
      toast.success(`${nodeNumbers.length}개 노드 확인 완료`)
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message ?? '노드 확인 중 오류가 발생했습니다.')
    }
  }

  const onSubmit = async (values: z.infer<typeof combineAngleNodeToGatewaySchema>) => {
    try {
      if (!selectedGateway) {
        toast.error('게이트웨이를 먼저 선택해주세요.')
        return
      }

      if (!values.selected_nodes?.length) {
        toast.error('먼저 "선택한 노드 확인"을 눌러 노드를 선택해주세요.')
        return
      }

      const sendingData = {
        angle_nodes: values.selected_nodes, // ✅ _id 배열
        gateway_id: values.gateway_id,
        serial_number: selectedGateway.serial_number,
      }

      const resPromise = connectAngleNodesRequest(sendingData)
      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res) => {
          setTimeout(() => {
            form.reset()
            setSelectedGateway(null)
            setCheckinAngleNodesNumber(null)
            setMissingMsg('')
            refetchNodes()
          }, 600)
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
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full h-auto p-3 pb-4 border border-gray-400 bg-white text-gray-700 rounded-lg shadow-lg shadow-gray-300 space-y-4"
        >
          {/* 헤더 */}
          <div className="relative mb-4">
            <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold underline underline-offset-4 whitespace-nowrap">
              해치발판&비계전도
            </h1>
            <div className="h-8" />
          </div>

          {/* 게이트웨이 선택 */}
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
                    <SelectValue
                      placeholder={isGatewaysLoading ? '불러오는 중...' : '게이트웨이를 선택하세요'}
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {gatewayOptions.map((gw) => (
                      <SelectItem key={gw._id} value={gw._id}>
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
            </FormItem>
          </div>

          {/* 노드 입력 */}
          <div className="w-full">
            <FormField
              control={form.control}
              name="angle_nodes"
              render={({ field }) => (
                <FormItem>
                  {/* 라벨 + 체크박스 한 줄 */}
                  <div className="flex items-center justify-between">
                    <FormLabel>노드 번호 입력:</FormLabel>

                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={nodeType === 'HATCH'}
                          onChange={() => setNodeType('HATCH')}
                        />
                        해치발판
                      </label>

                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={nodeType === 'ANGLE'}
                          onChange={() => setNodeType('ANGLE')}
                        />
                        비계전도
                      </label>
                    </div>
                  </div>

                  <FormControl>
                    <Input
                      {...field}
                      disabled={!selectedGateway}
                      value={field.value ?? ''}
                      placeholder="예: 1,2,4,5"
                      className="w-full border-gray-700 focus:border-transparent"
                    />
                  </FormControl>
                </FormItem>
              )}
            />


            <div className="mt-2 flex items-center gap-3">
              <Button
                type="button"
                disabled={!selectedGateway}
                onClick={handleSelectedNodes}
                className="h-9 w-fit"
              >
                선택한 노드 확인
              </Button>

              {missingMsg && <span className="text-sm text-red-500">{missingMsg}</span>}
            </div>
          </div>

          {/* 선택된 노드 표시 */}
          <div className="mb-2 text-sm">
            <label className="flex items-center gap-x-2 text-gray-700">
              노드 선택:
              {checkinAngleNodesNumber && <span>{checkinAngleNodesNumber.length} 개 노드 선택함</span>}
            </label>

            {checkinAngleNodesNumber && checkinAngleNodesNumber.length > 0 && (
              <div className="flex flex-wrap mt-2 gap-2">
                {checkinAngleNodesNumber.map((nodeNumber) => (
                  <span key={nodeNumber} className="py-1 px-2 bg-blue-500 text-white rounded">
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
