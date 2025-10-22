import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import FillLoading from './components/shared/fill-laoding'
import UnauthorizedPage from './components/shared/unauthorizedPage'
import { Toaster } from './components/ui/sonner'
import ProtectedRoute from './dashboard/components/const/protectedRoutes'

// ===== 공통 대시보드 =====
import { AdminDashboard, ClientDashboard } from './pages/dashboard'

// ===== 기본 페이지 =====
const Authentication = lazy(() => import('./pages/authentication'))
const Community = lazy(() => import('./pages/community'))
const Home = lazy(() => import('./pages/Home'))
const MyPage = lazy(() => import('./pages/my-page'))
const Resource = lazy(() => import('./pages/resources'))
const Services = lazy(() => import('./pages/services'))
const MembersDetail = lazy(() => import('./components/pages.comp/memberDetail'))
const ServiceDetail = lazy(() => import('./components/pages.comp/serviceDetail'))

// ===== ADMIN pages (기존) =====
const ActiveClientsPage = lazy(() => import('./dashboard/pages/admin/activeClientPage'))
const AddClient = lazy(() => import('./dashboard/pages/admin/Add_client'))
const AddProduct = lazy(() => import('./dashboard/pages/admin/Add_product'))
const AdminBuildingNodes = lazy(() => import('./dashboard/pages/admin/buildingNodes'))
const AdminBuildings = lazy(() => import('./dashboard/pages/admin/buildings'))
const AdminClients = lazy(() => import('./dashboard/pages/admin/clients'))
const GatewaysPage = lazy(() => import('./dashboard/pages/admin/Gateways'))
const AdminMainPage = lazy(() => import('./dashboard/pages/admin/hero'))
const NodesPage = lazy(() => import('./dashboard/pages/admin/Nodes'))
const Products = lazy(() => import('./dashboard/pages/admin/products'))
const UserTable = lazy(() => import('./dashboard/pages/admin/users'))
const ScaffoldingNodes = lazy(() => import('./dashboard/pages/admin/scaffoldingnode'))
const AngleNodes = lazy(() => import('./dashboard/pages/admin/AngleNodes'))
const CreateAngleNode = lazy(() => import('./dashboard/pages/admin/createAngleNode'))

// ===== USER pages (ADMIN 동일 구조) =====
const ClientActiveClientsPage = lazy(() => import('./dashboard/pages/user/activeClientPage'))
const ClientBuildingNodes = lazy(() => import('./dashboard/pages/user/buildingNodes'))
const ClientBuildings = lazy(() => import('./dashboard/pages/user/buildings'))
const ClientClients = lazy(() => import('./dashboard/pages/user/clients'))
const ClientMainPage = lazy(() => import('./dashboard/pages/user/hero'))
const ClientScaffoldingNodes = lazy(() => import('./dashboard/pages/user/scaffoldingnode'))
const ClientAngleNodes = lazy(() => import('./dashboard/pages/user/AngleNodes'))


// 공용(유저 통계)
import { ChartByDateFilters } from './dashboard/pages/user/lineChart'

// Fallback Loader
const FallbackLoader = () => (
    <>
        <FillLoading />
    </>
)

const App = () => {
    return (
        <div className='max-w-[100vw]'>
            <Suspense fallback={<FallbackLoader />}>
                <Routes>
                    {/* ===== 기본 페이지 ===== */}
                    <Route path='/' element={<Home />} />
                    <Route path='/auth' element={<Authentication />} />
                    <Route path='/resources' element={<Resource />} />
                    <Route path='/services' element={<Services />} />
                    <Route path='/services/:serviceId' element={<ServiceDetail />} />
                    <Route path='/community' element={<Community />} />
                    <Route path='/community/:memberId' element={<MembersDetail />} />
                    <Route path='/my-page' element={<MyPage />} />
                    <Route path='/unauthorized' element={<UnauthorizedPage />} />

                    {/* ===== ADMIN ROUTES ===== */}
                    <Route
                        path='/admin/dashboard'
                        element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    >
                        <Route path='' element={<AdminMainPage />} />
                        <Route path='active-clients' element={<ActiveClientsPage />} />
                        <Route path='add-product' element={<AddProduct />} />
                        <Route path='add-client' element={<AddClient />} />
                        <Route path='create-angle-node' element={<CreateAngleNode />} />
                        <Route path='statistics' element={<ChartByDateFilters />} />
                        <Route path='users' element={<UserTable />} />
                        <Route path='products' element={<Products />} />
                        <Route path='product/gateways' element={<GatewaysPage />} />
                        <Route path='product/nodes' element={<NodesPage />} />
                        <Route path='clients' element={<AdminClients />} />
                        <Route path='clients/:clientId/buildings' element={<AdminBuildings />} />
                        <Route path='clients/:clientId/buildings/:buildingId' element={<AdminBuildingNodes />} />
                        <Route path='clients/:clientId/buildings/:buildingId/angle-nodes' element={<AngleNodes />} />
                        <Route path='clients/:clientId/buildings/:buildingId/scaffolding-nodes' element={<ScaffoldingNodes />} />
                    </Route>

                    {/* ===== CLIENT (USER) ROUTES — ADMIN 동일 구조 ===== */}
                    <Route
                        path='/client/dashboard'
                        element={
                            <ProtectedRoute allowedRoles={['CLIENT']}>
                                <ClientDashboard />
                            </ProtectedRoute>
                        }
                    >
                        <Route path='' element={<ClientMainPage />} />
                        <Route path='active-clients' element={<ClientActiveClientsPage />} />
                        <Route path='statistics' element={<ChartByDateFilters />} />
                        <Route path='clients' element={<ClientClients />} />
                        <Route path='clients/:clientId/buildings' element={<ClientBuildings />} />
                        <Route
                            path='clients/:clientId/buildings/:buildingId'
                            element={<ClientBuildingNodes />}
                        />
                        <Route
                            path='clients/:clientId/buildings/:buildingId/angle-nodes'
                            element={<ClientAngleNodes />}
                        />
                        <Route
                            path='clients/:clientId/buildings/:buildingId/scaffolding-nodes'
                            element={<ClientScaffoldingNodes />}
                        />
                    </Route>
                </Routes>
            </Suspense>
            <Toaster position='top-center' />
        </div>
    )
}

export default App
