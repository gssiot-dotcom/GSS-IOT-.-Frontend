/* eslint-disable @typescript-eslint/no-explicit-any */
import { verticalNodeSchema } from '@/lib/vatidation'
import { createVerticalNodeRequest, getVerticalNodesRequest } from '@/services/apiRequests'
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

/**
 * Vertical Node Create payload shape:
 * [{ node_number: 1 }, { node_number: 2 }, ...]
 *
 * ✅ IMPORTANT
 * - interfaces.ts 에서 VerticalNodeCreate 를 { node_number: number } 로 맞춰두면
 *   createVerticalNodeRequest(verticalNodes) 가 타입까지 깔끔하게 맞습니다.
 */

const VerticalNodeForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [nodesLoading, setNodesLoading] = useState(false)
  const [nodesError, setNodesError] = useState('')
  const [nodeNumbers, setNodeNumbers] = useState<number[]>([])

  const form = useForm<z.infer<typeof verticalNodeSchema>>({
    resolver: zodResolver(verticalNodeSchema),
    defaultValues: {
      vertical_node_counts: '',
    },
  })

  const loadNodeNumbers = async () => {
    setNodesError('')
    setNodesLoading(true)

    try {
      const data = await getVerticalNodesRequest()

      // 다양한 응답 형태 방어적으로 처리
      const rows: any[] =
        (Array.isArray(data?.data) && data.data) ||
        (Array.isArray(data?.vertical_nodes) && data.vertical_nodes) ||
        (Array.isArray(data?.nodes) && data.nodes) ||
        (Array.isArray(data) && data) ||
        []

      const nums: number[] = rows
        .map((r: any) => Number(r?.node_number ?? r?.doorNum ?? r?.nodeNum))
        .filter((n: any): n is number => Number.isFinite(n))

      const uniqueSorted: number[] = Array.from(new Set(nums)).sort((a, b) => a - b)
      setNodeNumbers(uniqueSorted)
    } catch (e: any) {
      setNodesError(e?.message ?? '노드 목록을 불러오지 못했습니다.')
    } finally {
      setNodesLoading(false)
    }
  }

  useEffect(() => {
    if (dropdownOpen && nodeNumbers.length === 0 && !nodesLoading) {
      loadNodeNumbers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropdownOpen])

  const nodeNumbersText = useMemo(() => {
    if (!nodeNumbers.length) return ''
    return nodeNumbers.join(', ')
  }, [nodeNumbers])

  const onSubmit = async (values: z.infer<typeof verticalNodeSchema>) => {
    setIsSubmitting(true)
    setFormError('')

    try {
      const { vertical_node_counts } = values

      // "1-8" 형태 파싱
      const rawNumbers = vertical_node_counts.split('-').map((num) => num.trim())

      if (rawNumbers.length !== 2 || rawNumbers.some((num) => !Number.isFinite(Number(num)))) {
        setIsSubmitting(false)
        setFormError('잘못된 형식입니다. 예: 1-8')
        return
      }

      const start = Number(rawNumbers[0])
      const end = Number(rawNumbers[1])

      if (start > end) {
        setIsSubmitting(false)
        setFormError('시작 노드는 끝 노드보다 작거나 같아야 합니다.')
        return
      }

      // ✅ payload를 node_number로 통일 (배열 그대로 전송)
      const verticalNodes: Array<{ node_number: number }> = []
      for (let i = start; i <= end; i++) {
        verticalNodes.push({ node_number: i })
      }

      const resPromise = createVerticalNodeRequest(verticalNodes)

      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res: any) => {
          setTimeout(() => {
            setIsSubmitting(false)
            form.reset({ vertical_node_counts: '' })
            loadNodeNumbers()
          }, 600)
          return res?.message ?? 'Success'
        },
        error: (err: any) => {
          setIsSubmitting(false)
          const msg = err?.message ?? 'Something went wrong :('
          setFormError(msg)
          return msg
        },
      })
    } catch (error: any) {
      setIsSubmitting(false)
      const msg = error?.message || 'Something went wrong :('
      setFormError(msg)
      toast.error(msg)
    }
  }

  return (
    <div className="w-full flex flex-col justify-center items-center md:text-lg text-sm text-gray-700 relative">
      {isSubmitting && <p className="absolute inset-0">Loading...</p>}

      {formError && (
        <Alert className="text-red-600 py-2 mt-2" variant="destructive">
          <AlertCircle className="h-4 w-4" color="red" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full h-auto p-4 border border-gray-400 bg-white rounded-lg shadow-lg shadow-gray-300 space-y-5 relative"
        >
          <div className="absolute top-4 right-4">
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 gap-1 text-xs"
                  disabled={nodesLoading}
                >
                  노드 확인
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>등록된 수직 노드</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={loadNodeNumbers}
                    disabled={nodesLoading}
                    title="새로고침"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {nodesLoading ? (
                  <div className="px-3 py-2 text-sm text-gray-600">불러오는 중...</div>
                ) : nodesError ? (
                  <div className="px-3 py-2 text-sm text-red-600">{nodesError}</div>
                ) : nodeNumbers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-600">등록된 노드가 없습니다.</div>
                ) : (
                  <div className="px-3 pb-3">
                    <div className="text-xs text-gray-500 mb-2">총 {nodeNumbers.length}개</div>
                    <ScrollArea className="h-40 rounded-md border">
                      <div className="p-2 text-sm leading-6">{nodeNumbersText}</div>
                    </ScrollArea>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h1 className="leading-none text-xl font-bold pb-2 mb-5 underline underline-offset-4">
            수직 노드
          </h1>

          <FormField
            control={form.control}
            name="vertical_node_counts"
            render={({ field }) => (
              <FormItem>
                <FormLabel>노드 시작 과 끝 넘버 입력</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="예: 1-8"
                    disabled={isSubmitting}
                    {...field}
                    value={(field.value as any) ?? ''}
                    className="border-gray-700 focus:border-transparent placeholder:text-gray-400"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="h-12 w-full mt-2">
            Submit
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default VerticalNodeForm
