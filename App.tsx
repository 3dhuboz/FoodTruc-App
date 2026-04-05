
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { ToastProvider } from './components/Toast';

// Lazy-loaded pages for code splitting
const Home = React.lazy(() => import('./pages/Home'));
const Menu = React.lazy(() => import('./pages/Menu'));
const OrderPage = React.lazy(() => import('./pages/Order'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const Login = React.lazy(() => import('./pages/Login'));
const CustomerProfile = React.lazy(() => import('./pages/CustomerProfile'));
const DIY = React.lazy(() => import('./pages/DIY'));
const Contact = React.lazy(() => import('./pages/Contact'));
const Events = React.lazy(() => import('./pages/Events'));
const Rewards = React.lazy(() => import('./pages/Rewards'));
const Promoters = React.lazy(() => import('./pages/Promoters'));
const Tracking = React.lazy(() => import('./pages/Tracking'));
const DataSetup = React.lazy(() => import('./pages/admin/DataSetup'));
const SetupWizard = React.lazy(() => import('./pages/admin/SetupWizard'));
const Maintenance = React.lazy(() => import('./pages/Maintenance'));
const PitmasterAI = React.lazy(() => import('./pages/PitmasterAI'));
const Gallery = React.lazy(() => import('./pages/Gallery'));
const PaymentSuccess = React.lazy(() => import('./pages/PaymentSuccess'));
const Landing = React.lazy(() => import('./pages/Landing'));
const SignupSuccess = React.lazy(() => import('./pages/SignupSuccess'));
const Demo = React.lazy(() => import('./pages/Demo'));
const SuperAdmin = React.lazy(() => import('./pages/SuperAdmin'));
const BOH = React.lazy(() => import('./pages/BOH'));
const FOH = React.lazy(() => import('./pages/FOH'));
const QROrder = React.lazy(() => import('./pages/QROrder'));
const OrderStatus = React.lazy(() => import('./pages/OrderStatus'));
const CaptivePortal = React.lazy(() => import('./pages/CaptivePortal'));

const PageLoader = () => (
  <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>
);

// Protected Admin Route (allows both ADMIN and DEV roles)
const ProtectedAdminRoute: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { user } = useApp();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'DEV')) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Protected Customer Route
const ProtectedCustomerRoute: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { settings, user, isLoading, connectionError } = useApp();
  const location = useLocation();

  if (isLoading) return <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  if (connectionError) {
      return (
          <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-4 text-center">
              <h1 className="text-2xl font-bold text-red-500 mb-4">Connection Error</h1>
              <p className="mb-4">{connectionError}</p>
              <p className="text-sm text-gray-400">Please check your configuration and try again.</p>
          </div>
      );
  }

  // Maintenance Mode Check
  const isMaintenance = settings?.maintenanceMode;
  const isAdmin = user?.role === 'ADMIN';
  const isAllowedPath = ['/login', '/admin', '/setup'].some(path => location.pathname.startsWith(path));

  if (isMaintenance && !isAdmin && !isAllowedPath) {
      return <Maintenance />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      {isMaintenance && isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center py-1 z-[100] animate-pulse">
          MAINTENANCE MODE ACTIVE - Public access restricted
        </div>
      )}
      <Routes>
        {/* Setup Wizard - Full-screen onboarding */}
        <Route path="/setup" element={<SetupWizard />} />

        {/* Staff Views - Full-screen, no nav */}
        <Route path="/boh" element={<Suspense fallback={<PageLoader />}><BOH /></Suspense>} />
        <Route path="/foh" element={<Suspense fallback={<PageLoader />}><FOH /></Suspense>} />

        {/* Customer QR Ordering - No auth required */}
        <Route path="/qr-order" element={<Suspense fallback={<PageLoader />}><QROrder /></Suspense>} />
        <Route path="/order-status/:orderId" element={<Suspense fallback={<PageLoader />}><OrderStatus /></Suspense>} />

        {/* Captive Portal - ChowBox WiFi landing page */}
        <Route path="/portal" element={<Suspense fallback={<PageLoader />}><CaptivePortal /></Suspense>} />
        {/* Landing Page - ChowNow SaaS product page */}
        <Route path="/landing" element={<Suspense fallback={<PageLoader />}><Landing /></Suspense>} />
        <Route path="/signup-success" element={<Suspense fallback={<PageLoader />}><SignupSuccess /></Suspense>} />
        
        {/* Main App Routes */}
        <Route path="*" element={
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/diy" element={<DIY />} />
                <Route path="/order" element={<OrderPage />} />
                <Route path="/events" element={<Events />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/promoters" element={<Promoters />} />
                <Route path="/tracking" element={<Tracking />} />
                <Route path="/login" element={<Login />} />
                <Route path="/rewards" element={<Rewards />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                
                <Route path="/pitmaster-ai" element={
                  <ProtectedCustomerRoute>
                    <PitmasterAI />
                  </ProtectedCustomerRoute>
                } />
                
                <Route path="/profile" element={
                  <ProtectedCustomerRoute>
                    <CustomerProfile />
                  </ProtectedCustomerRoute>
                } />
                
                <Route path="/admin" element={
                  <ProtectedAdminRoute>
                    <AdminDashboard />
                  </ProtectedAdminRoute>
                } />
                
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        } />
      </Routes>
    </Suspense>
  );
};

/** Gate: waits for tenant resolution before rendering the app.
 *  If this is the platform tenant (chownow/default), show the SaaS Landing page
 *  instead of the customer app — chownow.au is the host, not a food truck. */
const TenantGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant, isResolved, isTenantError } = useTenant();

  if (!isResolved) {
    return <div className="h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  // Platform tenant or error → show SaaS landing/signup site
  const isPlatformTenant = tenant?.id === 'default' || tenant?.slug === 'chownow';
  if (isTenantError || isPlatformTenant) {
    return (
      <Suspense fallback={<PageLoader />}>
        <HashRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/signup-success" element={<SignupSuccess />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/qr-order" element={<AppProvider><QROrder /></AppProvider>} />
            <Route path="/boh" element={<AppProvider><BOH /></AppProvider>} />
            <Route path="/foh" element={<AppProvider><FOH /></AppProvider>} />
            <Route path="/portal" element={<AppProvider><CaptivePortal /></AppProvider>} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </HashRouter>
      </Suspense>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <TenantProvider>
        <TenantGate>
          <AppProvider>
            <HashRouter>
              <ScrollToTop />
              <AppRoutes />
            </HashRouter>
          </AppProvider>
        </TenantGate>
      </TenantProvider>
    </ToastProvider>
  );
};

export default App;
