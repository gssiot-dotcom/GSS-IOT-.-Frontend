/* eslint-disable @typescript-eslint/no-explicit-any */
// Angle_gateway_form.tsx
import { combineAngleNodeToGatewaySchema } from '@/lib/vatidation'
import {
  getAllTypeActiveNodesRequest,
  getAngleAliveNodes,
  getNodesRequest,
  combineHatchNodesToGatewayRequest,
  combineAngleNodesToGatewayRequest,
} from '@/services/apiRequests'

import { zodResolver } from '@hookform/resolvers/zod'
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
  refetchNodes: () => void
  gateways: GatewayItem[] // ✅ 부모에서 받음
}

type GatewayItem = {
  _id: string
  serial_number: string
  gateway_number?: string
  name?: string
}

type NodeType = 'HATCH' | 'ANGLE'

const pickDoorNum = (x: any) => {
  const v = x?.doorNum ?? x?.node_number ?? x?.nodeNum ?? x?.node
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const pickId = (x: any) => x?._id ?? x?.id ?? null
const isUsable = (x: any) => {
  const v = x?.status ?? x?.node_status ?? x?.nodeStatus ?? x?.active ?? x?.isActive
  return v === true || v === 'true' || v === 1
}

/**
 * 백엔드 getAllTypeActiveNodesData():
 * { nodes: door_nodes, angle_nodes, vertical_nodes }
 */
const extractTypeList = (all: any, type: NodeType): any[] => {
  if (!all) return []
  if (type === 'ANGLE') return Array.isArray(all?.angle_nodes) ? all.angle_nodes : []
  // HATCH(door node)
  return Array.isArray(all?.nodes) ? all.nodes : []
}

const AngleGatewayForm = ({ refetchNodes, gateways }: AngleNodeFormProps) => {
  const [checkedNodeNumbers, setCheckedNodeNumbers] = useState<number[] | null>(null)
  const [selectedGateway, setSelectedGateway] = useState<GatewayItem | null>(null)
  const [nodeType, setNodeType] = useState<NodeType>('ANGLE')
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

  const gatewayOptions = useMemo(() => {
    const list = (gateways ?? []) as GatewayItem[]

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

  const handleSelectedNodes = async () => {
    setMissingMsg('')
    setCheckedNodeNumbers(null)
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
      // 1) usable 교차검증
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

      // 2) doorNum -> _id 매핑
      let rows: any[] = []

      if (nodeType === 'HATCH') {
        // 해치발판: /node/get-nodes (해치발판만 내려온다는 전제)
        const hatchNodes = await getNodesRequest()
        rows = Array.isArray(hatchNodes) ? hatchNodes : []
      } else {
        // 비계전도: /angle-node/alive
        const aliveRows = await getAngleAliveNodes()
        rows = Array.isArray(aliveRows) ? aliveRows : []
      }

      const idMap = new Map<number, string>()
      rows.forEach((x: any) => {
        const dn = pickDoorNum(x)
        const id = pickId(x)
        if (dn !== null && id) idMap.set(dn, String(id))
      })

      const selectedIds = nodeNumbers
        .map((dn) => idMap.get(dn))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      const missingIds = nodeNumbers.filter((dn) => !idMap.get(dn))
      if (missingIds.length > 0) {
        setMissingMsg(`_id 매핑 실패: ${missingIds.join(', ')}`)
        toast.error('일부 노드의 _id를 찾지 못했습니다.')
        return
      }

      setCheckedNodeNumbers(nodeNumbers)
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

      const gateway_id = values.gateway_id

      const resPromise =
        nodeType === 'HATCH'
          ? combineHatchNodesToGatewayRequest({
              gateway_id,
              nodes: values.selected_nodes, // backend: { gateway_id, nodes }
            })
          : combineAngleNodesToGatewayRequest({
              gateway_id,
              angle_nodes: values.selected_nodes, // backend: { gateway_id, angle_nodes }
            })

      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res) => {
          setTimeout(() => {
            form.reset()
            setSelectedGateway(null)
            setCheckedNodeNumbers(null)
            setMissingMsg('')
            refetchNodes()
          }, 600)
          return res?.message ?? 'Success'
        },
        error: (err) => err?.message || 'Something went wrong :(',
      })
    } catch (error: any) {
      toast.error(error?.message || 'Something went wrong :(')
    }
  }

  

  return (
    <div className="md:w-[40%] flex justify-center items-center flex-col md:text-lg text-sm text-gray-700">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full h-auto p-3 pb-4 border border-gray-400 bg-white text-gray-700 rounded-lg shadow-lg shadow-gray-300 space-y-4"
        >
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
                  disabled={gatewayOptions.length === 0}
                >
                  <SelectTrigger className="w-full border-gray-700">
                    <SelectValue
                      placeholder={
                        gatewayOptions.length === 0
                          ? '게이트웨이가 없습니다'
                          : '게이트웨이를 선택하세요'
                      }
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
            </FormItem>
          </div>

          {/* 노드 입력 */}
          <div className="w-full">
            <FormField
              control={form.control}
              name="angle_nodes"
              render={({ field }) => (
                <FormItem>
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
              {checkedNodeNumbers && <span>{checkedNodeNumbers.length} 개 노드 선택함</span>}
            </label>

            {checkedNodeNumbers && checkedNodeNumbers.length > 0 && (
              <div className="flex flex-wrap mt-2 gap-2">
                {checkedNodeNumbers.map((nodeNumber) => (
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

export default AngleGatewayForm
