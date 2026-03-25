import { useState } from 'react'

const Site = () => {
	const [open, setOpen] = useState(true)

	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-start bg-black/45 px-4 md:px-14 pt-14">
			<div className="relative w-full max-w-sm md:max-w-md overflow-hidden rounded-2xl shadow-2xl">
				<button
					onClick={() => setOpen(false)}
					className="absolute right-3 top-3 z-20 rounded-full bg-black/60 px-3 py-1 text-sm text-white hover:bg-black"
				>
					닫기
				</button>

				<div className="relative">
					<img
						src="/site.png"
						alt="회사 소개"
						className="block w-full h-auto object-cover"
					/>

					<div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-5 py-4">
						<a
							href="http://gssiot.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-base font-semibold text-white underline underline-offset-4 hover:text-yellow-300"
						>
							-&gt; 회사정보 바로가기
						</a>
					</div>
				</div>
			</div>
		</div>
	)
}

export default Site