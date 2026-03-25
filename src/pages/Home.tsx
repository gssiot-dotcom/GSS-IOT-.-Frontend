import About from '@/components/home.comps/about'
import Footer from '@/components/home.comps/Footer'
import Hero from '@/components/home.comps/hero'
import CompanyMembers from '@/components/home.comps/members'
import HomeService from '@/components/home.comps/services'
import Site from '@/components/home.comps/site'

const Home = () => {
	return (
		<div className='w-full h-full flex flex-col bg-background overflow-hidden'>
			<Site />
			<Hero />
			<About />
			<CompanyMembers />
			<HomeService />
			<Footer />
		</div>
	)
}

export default Home