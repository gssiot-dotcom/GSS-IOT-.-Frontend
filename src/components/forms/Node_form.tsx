/* eslint-disable @typescript-eslint/no-explicit-any */
import { nodeRangeSchema } from '@/lib/vatidation'
import { createNodeRequest } from '@/services/apiRequests'
import { getNodes } from '@/services/apiRequests' // ✅ getNodes import 경로는 프로젝트에 맞게 조정
import { INode } from '@/types/interfaces'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ChevronDown, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form'
import { Input } from '../ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ScrollArea } from '../ui/scroll-area'

interface NodeFormProps {
  nodes?: INode[]
  refetch: () => void
}

const NodeForm = ({ refetch }: NodeFormProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // ✅ 노드 확인용 상태
  const [nodesLoading, setNodesLoading] = useState(false)
  const [nodesError, setNodesError] = useState('')
  const [nodeNums, setNodeNums] = useState<number[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const form = useForm<z.infer<typeof nodeRangeSchema>>({
    resolver: zodResolver(nodeRangeSchema),
    defaultValues: { node_counts: '' },
  })

  // ✅ API 응답에서 "노드 번호"만 최대한 안전하게 추출
  const extractNodeNumber = (n: any): number | null => {
    if (typeof n === 'number') return n
    if (!n || typeof n !== 'object') return null

    // 프로젝트에서 흔히 쓰는 키 후보들
    const candidate =
      n.doorNum ?? n.nodeNum ?? n.nodeNumber ?? n.number ?? n.id ?? n.node_id

    const num = Number(candidate)
    return Number.isFinite(num) ? num : null
  }

  const loadNodes = async () => {
    setNodesError('')
    setNodesLoading(true)
    try {
      const res = await getNodes()
      const nums = (Array.isArray(res) ? res : [])
        .map(extractNodeNumber)
        .filter((v): v is number => v !== null)

      // 중복 제거 + 정렬
      const uniqueSorted = Array.from(new Set(nums)).sort((a, b) => a - b)
      setNodeNums(uniqueSorted)
    } catch (e: any) {
      setNodesError(e?.message ?? '노드를 불러오지 못했습니다.')
    } finally {
      setNodesLoading(false)
    }
  }

  // ✅ 드롭다운 열릴 때 한번 가져오기 (이미 있으면 스킵)
  useEffect(() => {
    if (dropdownOpen && nodeNums.length === 0 && !nodesLoading) {
      loadNodes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropdownOpen])

  const nodeNumsText = useMemo(() => {
    if (nodeNums.length === 0) return ''
    return nodeNums.join(', ')
  }, [nodeNums])

  const onSubmit = async (values: z.infer<typeof nodeRangeSchema>) => {
    setIsLoading(true)
    try {
      const { node_counts } = values

      const rawNumbers = node_counts.split('-').map((num) => num.trim())

      if (rawNumbers.length !== 2 || rawNumbers.some((num) => isNaN(Number(num)))) {
        setIsLoading(false)
        setError('잘못된 형식입니다. 예: 1-8')
        return
      }

      const [startNumber, endNumber] = rawNumbers.map((num) => Number(num))

      if (startNumber > endNumber) {
        setIsLoading(false)
        setError('시작 노드는 끝 노드보다 작거나 같아야 합니다.')
        return
      }

      const nodes: Array<{ doorNum: number }> = []
      for (let i = startNumber; i <= endNumber; i++) {
        nodes.push({ doorNum: i })
      }

      const resPromise = createNodeRequest(nodes)
      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res: any) => {
          setError('')
          setTimeout(() => {
            setIsLoading(false)
            form.reset({ node_counts: '' })
            refetch()

            // ✅ 생성 후 드롭다운 리스트도 갱신하고 싶으면 여기서 loadNodes 호출
            loadNodes()
          }, 1000)
          return res?.message ?? 'Success'
        },
        error: (err: any) => {
          setIsLoading(false)
          setError(err?.message ?? 'Something went wrong :(')
          return err?.message ?? 'Something went wrong :('
        },
      })
    } catch (error: any) {
      setIsLoading(false)
      toast.error(error.message || 'Something went wrong :(')
    }
  }

  return (
    <div className="w-full flex flex-col justify-center items-center md:text-lg text-sm text-gray-700 relative">
      {isLoading && <p className="absolute inset-0">Loading...</p>}

      {error && (
        <Alert className="text-red-600 py-2 mt-2" variant="destructive">
          <AlertCircle className="h-4 w-4" color="red" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full h-auto p-4 border border-gray-400 bg-white rounded-lg shadow-lg shadow-gray-300 space-y-5 relative"
        >
          {/* ✅ 오른쪽 위 드롭다운 */}
          <div className="absolute top-4 right-4">
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-8 px-2 gap-1 text-xs'
                  disabled={nodesLoading}
                >
                  노드 확인
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>현재 해치발판 노드</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={loadNodes}
                    disabled={nodesLoading}
                    title="새로고침"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {nodesLoading ? (
                  <div className="px-3 py-2 text-sm text-gray-600">불러오는 중...</div>
                ) : nodesError ? (
                  <div className="px-3 py-2 text-sm text-red-600">{nodesError}</div>
                ) : nodeNums.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-600">등록된 노드가 없습니다.</div>
                ) : (
                  <div className="px-3 pb-3">
                    <div className="text-xs text-gray-500 mb-2">
                      총 {nodeNums.length}개
                    </div>
                    <ScrollArea className="h-40 rounded-md border">
                      <div className="p-2 text-sm leading-6">
                        {/* 보기 좋게 여러 줄로 */}
                        {nodeNumsText}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h1 className="leading-none text-xl font-bold pb-2 mb-5 underline underline-offset-4">
            해치발판 노드
          </h1>

          <FormField
            control={form.control}
            name="node_counts"
            render={({ field }) => (
              <FormItem>
                <FormLabel>노드 시작 과 끝 넘버 입력</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="예: 1-8"
                    disabled={isLoading}
                    {...field}
                    value={field.value ?? ''}
                    className="border-gray-700 focus:border-transparent placeholder:text-gray-400"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading} className="h-12 w-full mt-2">
            Submit
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default NodeForm
