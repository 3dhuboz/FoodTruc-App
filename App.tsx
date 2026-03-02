
import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
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
const Maintenance = React.lazy(() => import('./pages/Maintenance'));
const PitmasterAI = React.lazy(() => import('./pages/PitmasterAI'));
const Gallery = React.lazy(() => import('./pages/Gallery'));
const PaymentSuccess = React.lazy(() => import('./pages/PaymentSuccess'));
const Landing = React.lazy(() => import('./pages/Landing'));

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
        {/* Setup Route - Outside Layout for Focus */}
        <Route path="/setup" element={<DataSetup />} />
        {/* Landing Page - Standalone sales page outside Layout */}
        <Route path="/landing" element={
          <Landing 
            setupFee={settings?.landingPricing?.setupFee ?? 999}
            monthlyFee={settings?.landingPricing?.monthlyFee ?? 99}
            businessName={settings?.landingPricing?.brandName || 'FoodTruck App'}
            contactEmail={settings?.landingPricing?.contactEmail || 'hello@foodtruckapp.com.au'}
            contactPhone={settings?.landingPricing?.contactPhone || ''}
          />
        } />
        
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

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppProvider>
        <HashRouter>
          <ScrollToTop />
          <AppRoutes />
        </HashRouter>
      </AppProvider>
    </ToastProvider>
  );
};

export default App;
