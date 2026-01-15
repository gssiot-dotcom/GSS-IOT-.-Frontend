/* eslint-disable @typescript-eslint/no-explicit-any */
import { angleNodeSchema } from '@/lib/vatidation'
import { createAngleNodeRequest, getAngleAliveNodes } from '@/services/apiRequests'
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

const AngleNodeForm = () => {
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState('')

	// ✅ 드롭다운(노드 확인) 상태
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const [nodesLoading, setNodesLoading] = useState(false)
	const [nodesError, setNodesError] = useState('')
	const [doorNums, setDoorNums] = useState<number[]>([])

	const form = useForm<z.infer<typeof angleNodeSchema>>({
		resolver: zodResolver(angleNodeSchema),
	})

	const loadDoorNums = async () => {
		setNodesError('')
		setNodesLoading(true)
		try {
			const rows = await getAngleAliveNodes() // [{doorNum,...}, ...]
			const nums = (Array.isArray(rows) ? rows : [])
				.map((r: any) => Number(r?.doorNum))
				.filter((n: any) => Number.isFinite(n))

			const uniqueSorted = Array.from(new Set(nums)).sort((a, b) => a - b)
			setDoorNums(uniqueSorted)
		} catch (e: any) {
			setNodesError(e?.message ?? '노드 목록을 불러오지 못했습니다.')
		} finally {
			setNodesLoading(false)
		}
	}

	// ✅ 드롭다운 처음 열 때 1회 로드
	useEffect(() => {
		if (dropdownOpen && doorNums.length === 0 && !nodesLoading) {
			loadDoorNums()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dropdownOpen])

	const doorNumsText = useMemo(() => {
		if (!doorNums.length) return ''
		return doorNums.join(', ')
	}, [doorNums])

	const onSubmit = async (values: z.infer<typeof angleNodeSchema>) => {
		setIsLoading(true)
		try {
			const { angle_node_counts } = values

			const rawNumbers = angle_node_counts.split('-').map(num => num.trim())

			if (rawNumbers.length !== 2 || rawNumbers.some(num => isNaN(Number(num)))) {
				setIsLoading(false)
				setError('잘못된 형식입니다. 예: 1-8')
				return
			}

			const angleNodeNumbers = rawNumbers.map(num => Number(num))

			if (angleNodeNumbers[0] > angleNodeNumbers[1]) {
				setIsLoading(false)
				setError('시작 노드는 끝 노드보다 작거나 같아야 합니다.')
				return
			}

			const angleNodes: Array<{ doorNum: number }> = []
			for (let i = angleNodeNumbers[0]; i <= angleNodeNumbers[1]; i++) {
				angleNodes.push({ doorNum: i })
			}

			const resPromise = createAngleNodeRequest(angleNodes)
			toast.promise(resPromise, {
				loading: 'Loading...',
				success: (res: any) => {
					setError('')
					setTimeout(() => {
						setIsLoading(false)
						form.reset({ angle_node_counts: '' })

						// ✅ 생성 후 드롭다운 목록도 최신화
						loadDoorNums()
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
		<div className='w-full flex flex-col justify-center items-center md:text-lg text-sm text-gray-700 relative'>
			{isLoading && <p className='absolute inset-0'>Loading...</p>}

			{error && (
				<Alert className='text-red-600 py-2 mt-2' variant='destructive'>
					<AlertCircle className='h-4 w-4' color='red' />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className='w-full h-auto p-4 border border-gray-400 bg-white rounded-lg shadow-lg shadow-gray-300 space-y-5 relative'
				>
					{/* ✅ 오른쪽 위 드롭다운 */}
					<div className='absolute top-4 right-4'>
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
									<ChevronDown className='h-4 w-4' />
								</Button>
							</DropdownMenuTrigger>

							<DropdownMenuContent align='end' className='w-72'>
								<DropdownMenuLabel className='flex items-center justify-between'>
									<span>등록된 비계전도 노드</span>
									<Button
										type='button'
										variant='ghost'
										size='icon'
										className='h-8 w-8'
										onClick={loadDoorNums}
										disabled={nodesLoading}
										title='새로고침'
									>
										<RefreshCcw className='h-4 w-4' />
									</Button>
								</DropdownMenuLabel>

								<DropdownMenuSeparator />

								{nodesLoading ? (
									<div className='px-3 py-2 text-sm text-gray-600'>불러오는 중...</div>
								) : nodesError ? (
									<div className='px-3 py-2 text-sm text-red-600'>{nodesError}</div>
								) : doorNums.length === 0 ? (
									<div className='px-3 py-2 text-sm text-gray-600'>등록된 노드가 없습니다.</div>
								) : (
									<div className='px-3 pb-3'>
										<div className='text-xs text-gray-500 mb-2'>총 {doorNums.length}개</div>
										<ScrollArea className='h-40 rounded-md border'>
											<div className='p-2 text-sm leading-6'>{doorNumsText}</div>
										</ScrollArea>
									</div>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<h1 className='leading-none text-xl font-bold pb-2 mb-5 underline underline-offset-4'>
						비계전도 노드
					</h1>

					<FormField
						control={form.control}
						name='angle_node_counts'
						render={({ field }) => (
							<FormItem>
								<FormLabel>노드 시작 과 끝 넘버 입력</FormLabel>
								<FormControl>
									<Input
										type='text'
										placeholder='예: 1-8'
										disabled={isLoading}
										{...field}
										value={field.value ?? ''}
										className='border-gray-700 focus:border-transparent placeholder:text-gray-400'
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button type='submit' disabled={isLoading} className='h-12 w-full mt-2'>
						Submit
					</Button>
				</form>
			</Form>
		</div>
	)
}

export default AngleNodeForm
