import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'

const MetricCard = () => {
	const chartBarValue: number = 73
	const chartBarValue2: number = 52
	const chartBarValue3: number = 23
	return (
		<div className='w-full full flex md:gap-x-6 gap-x-2 justify-between'>
			{/* Users Card */}
			<div className='w-1/4 h-1/5 p-5 bg-white rounded-xl shadow-[0px_0px_10px_5px_rgba(0,_0,_0,_0.1)] text-center'>
				<h3 className='text-lg font-semibold'>Users</h3>
				<div className='my-4 mx-auto w-2/4'>
					<CircularProgressbar
						value={chartBarValue}
						text={`${chartBarValue}`}
						styles={buildStyles({
							pathColor: '#1E44C0',
							textColor: '#1E44C0',
							trailColor: '#e5e7eb',
							textSize: '10px',
							strokeLinecap: 'butt',
						})}
						strokeWidth={10} // Adjust stroke width if necessary
					/>
				</div>

				<p className='text-indigo-800 flex items-center justify-center'>
					<span className='inline-block w-2.5 h-2.5 bg-indigo-800 rounded-full mr-2'></span>
					Access
				</p>
			</div>

			{/* Users Card */}
			<div className='w-1/4 h-1/5 p-5 bg-white rounded-xl shadow-[0px_0px_10px_5px_rgba(0,_0,_0,_0.1)] text-center'>
				<h3 className='text-lg font-semibold'>Clients</h3>
				<div className='my-4 mx-auto w-2/4'>
					<CircularProgressbar
						value={chartBarValue2}
						text={`${chartBarValue2}`}
						styles={buildStyles({
							pathColor: '#1E44C0',
							textColor: '#1E44C0',
							trailColor: '#e5e7eb',
							textSize: '10px',
							strokeLinecap: 'butt',
						})}
						strokeWidth={10} // Adjust stroke width if necessary
					/>
				</div>

				<p className='text-indigo-800 flex items-center justify-center'>
					<span className='inline-block w-2.5 h-2.5 bg-indigo-800 rounded-full mr-2'></span>
					Access
				</p>
			</div>

			{/* Users Card */}
			<div className='w-1/4 h-1/5 p-5 bg-white rounded-xl shadow-[0px_0px_10px_5px_rgba(0,_0,_0,_0.1)] text-center'>
				<h3 className='text-lg font-semibold'>Gateways</h3>
				<div className='my-4 mx-auto w-2/4'>
					<CircularProgressbar
						value={chartBarValue2}
						text={`${chartBarValue2}`}
						styles={buildStyles({
							pathColor: '#1E44C0',
							textColor: '#1E44C0',
							trailColor: '#e5e7eb',
							textSize: '10px',
							strokeLinecap: 'butt',
						})}
						strokeWidth={10} // Adjust stroke width if necessary
					/>
				</div>

				<p className='text-indigo-800 flex items-center justify-center'>
					<span className='inline-block w-2.5 h-2.5 bg-indigo-800 rounded-full mr-2'></span>
					Access
				</p>
			</div>

			{/* Node Card */}
			<div className='w-1/4 h-1/5 p-5 flex flex-col justify-center bg-white rounded-xl shadow-[0px_0px_10px_5px_rgba(0,_0,_0,_0.1)] text-center'>
				<h3 className='text-lg font-semibold'>Node</h3>
				<div className='my-4 mx-auto w-2/4'>
					<CircularProgressbar
						circleRatio={0.5}
						value={chartBarValue3}
						text={`${chartBarValue3}`}
						strokeWidth={10}
						styles={buildStyles({
							rotation: 0.75,
							pathColor: '#1E44C0',
							textColor: '#1E44C0',
							trailColor: '#e5e7eb',
							textSize: '14px',
							strokeLinecap: 'butt',
						})}
					/>
				</div>
				<p className='text-indigo-800 flex items-center justify-center'>
					<span className='inline-block w-2.5 h-2.5 bg-indigo-800 rounded-full mr-2'></span>
					Open
				</p>
			</div>
		</div>
	)
}

export default MetricCard
