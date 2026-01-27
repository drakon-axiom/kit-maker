import { Suspense, lazy } from "react";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { BrandProvider } from "./contexts/BrandContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { CustomerLayout } from "./components/CustomerLayout";
import { Loader2 } from "lucide-react";

// Lazy load all page components for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const SKUs = lazy(() => import("./pages/SKUs"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderNew = lazy(() => import("./pages/OrderNew"));
const InternalOrderNew = lazy(() => import("./pages/InternalOrderNew"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const OrderEdit = lazy(() => import("./pages/OrderEdit"));
const Queue = lazy(() => import("./pages/Queue"));
const Operator = lazy(() => import("./pages/Operator"));
const ProductionDisplay = lazy(() => import("./pages/ProductionDisplay"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Shipments = lazy(() => import("./pages/Shipments"));
const Settings = lazy(() => import("./pages/Settings"));
const LabelSettings = lazy(() => import("./pages/LabelSettings"));
const WholesaleSignup = lazy(() => import("./pages/WholesaleSignup"));
const WholesaleApplications = lazy(() => import("./pages/WholesaleApplications"));
const QuoteApproval = lazy(() => import("./pages/QuoteApproval"));
const BrandManagement = lazy(() => import("./pages/BrandManagement"));
const CustomerPortal = lazy(() => import("./pages/CustomerPortal"));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));
const CustomerNewOrder = lazy(() => import("./pages/CustomerNewOrder"));
const CustomerOrderDetail = lazy(() => import("./pages/CustomerOrderDetail"));
const CustomerPaymentHistory = lazy(() => import("./pages/CustomerPaymentHistory"));
const CustomerQuoteManagement = lazy(() => import("./pages/CustomerQuoteManagement"));
const CustomerAccountSettings = lazy(() => import("./pages/CustomerAccountSettings"));
const CustomerAccess = lazy(() => import("./pages/CustomerAccess"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const EmailHistory = lazy(() => import("./pages/EmailHistory"));
const ManualPaymentRecording = lazy(() => import("./pages/ManualPaymentRecording"));
const OrderRequestManagement = lazy(() => import("./pages/OrderRequestManagement"));
const PendingPaymentVerification = lazy(() => import("./pages/PendingPaymentVerification"));
const NotFound = lazy(() => import("./pages/NotFound"));

function VersionChecker() {
  useVersionCheck();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <VersionChecker />
        <BrowserRouter>
          <AuthProvider>
            <BrandProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/admin-login" element={<AdminAuth />} />
                  <Route path="/wholesale-signup" element={<WholesaleSignup />} />
                  <Route path="/quote-approval" element={<QuoteApproval />} />

                  {/* Customer Portal Routes - Nested under CustomerLayout */}
                  <Route
                    path="/customer"
                    element={
                      <ProtectedRoute requiredRole="customer">
                        <CustomerLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<CustomerPortal />} />
                    <Route path="profile" element={<CustomerProfile />} />
                    <Route path="new-order" element={<CustomerNewOrder />} />
                    <Route path="orders/:id" element={<CustomerOrderDetail />} />
                    <Route path="payments" element={<CustomerPaymentHistory />} />
                    <Route path="quotes" element={<CustomerQuoteManagement />} />
                    <Route path="settings" element={<CustomerAccountSettings />} />
                  </Route>

                  {/* Operator Routes - Nested under Layout */}
                  <Route
                    element={
                      <ProtectedRoute requiredRole="operator">
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/orders/new" element={<OrderNew />} />
                    <Route path="/orders/:id" element={<OrderDetail />} />
                    <Route path="/queue" element={<Queue />} />
                    <Route path="/operator" element={<Operator />} />
                    <Route path="/shipments" element={<Shipments />} />
                  </Route>

                  {/* Admin Routes - Nested under Layout with admin role */}
                  <Route
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/customer-access" element={<CustomerAccess />} />
                    <Route path="/order-requests" element={<OrderRequestManagement />} />
                    <Route path="/user-management" element={<UserManagement />} />
                    <Route path="/brand-management" element={<BrandManagement />} />
                    <Route path="/skus" element={<SKUs />} />
                    <Route path="/orders/internal/new" element={<InternalOrderNew />} />
                    <Route path="/orders/:id/edit" element={<OrderEdit />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/email-history" element={<EmailHistory />} />
                    <Route path="/manual-payment" element={<ManualPaymentRecording />} />
                    <Route path="/pending-payments" element={<PendingPaymentVerification />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/label-settings" element={<LabelSettings />} />
                  </Route>

                  {/* Standalone Protected Routes (no Layout wrapper) */}
                  <Route
                    path="/production-display"
                    element={
                      <ProtectedRoute requiredRole="operator">
                        <ProductionDisplay />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/wholesale-applications"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <WholesaleApplications />
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch-all 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrandProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
