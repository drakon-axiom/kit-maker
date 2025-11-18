import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { BrandProvider } from "./contexts/BrandContext";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import SKUs from "./pages/SKUs";
import Orders from "./pages/Orders";
import OrderNew from "./pages/OrderNew";
import OrderDetail from "./pages/OrderDetail";
import OrderEdit from "./pages/OrderEdit";
import Queue from "./pages/Queue";
import Operator from "./pages/Operator";
import ProductionDisplay from "./pages/ProductionDisplay";
import Notifications from "./pages/Notifications";
import Shipments from "./pages/Shipments";
import Settings from "./pages/Settings";
import LabelSettings from "./pages/LabelSettings";
import WholesaleSignup from "./pages/WholesaleSignup";
import WholesaleApplications from "./pages/WholesaleApplications";
import QuoteApproval from "./pages/QuoteApproval";
import BrandManagement from "./pages/BrandManagement";
import CustomerPortal from "./pages/CustomerPortal";
import CustomerProfile from "./pages/CustomerProfile";
import CustomerNewOrder from "./pages/CustomerNewOrder";
import CustomerOrderDetail from "./pages/CustomerOrderDetail";
import CustomerPaymentHistory from "./pages/CustomerPaymentHistory";
import CustomerQuoteManagement from "./pages/CustomerQuoteManagement";
import CustomerAccountSettings from "./pages/CustomerAccountSettings";
import CustomerAccess from "./pages/CustomerAccess";
import UserManagement from "./pages/UserManagement";
import EmailHistory from "./pages/EmailHistory";
import OrderRequestManagement from "./pages/OrderRequestManagement";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { CustomerLayout } from "./components/CustomerLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <BrandProvider>
              <Routes>
              <Route path="/landing" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/wholesale-signup" element={<WholesaleSignup />} />
            <Route path="/quote-approval" element={<QuoteApproval />} />
            
            {/* Customer Portal Routes */}
            <Route path="/customer" element={
              <ProtectedRoute requiredRole="customer">
                <CustomerLayout>
                  <CustomerPortal />
                </CustomerLayout>
              </ProtectedRoute>
            } />
            <Route path="/customer/profile" element={
              <ProtectedRoute requiredRole="customer">
                <CustomerLayout>
                  <CustomerProfile />
                </CustomerLayout>
              </ProtectedRoute>
            } />
            <Route path="/customer/new-order" element={
              <ProtectedRoute requiredRole="customer">
                <CustomerLayout>
                  <CustomerNewOrder />
                </CustomerLayout>
              </ProtectedRoute>
            } />
            <Route path="/customer/orders/:id" element={
              <ProtectedRoute requiredRole="customer">
                <CustomerLayout>
                  <CustomerOrderDetail />
                </CustomerLayout>
              </ProtectedRoute>
            } />
            <Route path="/customer/payments" element={
              <ProtectedRoute requiredRole="customer">
                <CustomerLayout>
                  <CustomerPaymentHistory />
                </CustomerLayout>
              </ProtectedRoute>
            } />
            <Route path="/customer/quotes" element={
              <ProtectedRoute requiredRole="customer">
                <CustomerLayout>
                  <CustomerQuoteManagement />
                </CustomerLayout>
              </ProtectedRoute>
            } />
            <Route path="/customer/settings" element={
              <ProtectedRoute requiredRole="customer">
                <CustomerLayout>
                  <CustomerAccountSettings />
                </CustomerLayout>
              </ProtectedRoute>
            } />
            
            <Route
              path="/"
              element={<Index />}
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <Customers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer-access"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <CustomerAccess />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/order-requests"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <OrderRequestManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <UserManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/brand-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <BrandManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/skus"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <SKUs />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Orders />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <OrderNew />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <OrderDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id/edit"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <OrderEdit />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/queue"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Queue />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Operator />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/production-display"
              element={
                <ProtectedRoute>
                  <ProductionDisplay />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipments"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Shipments />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <Notifications />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/email-history"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <EmailHistory />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/label-settings"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <LabelSettings />
                  </Layout>
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
            <Route path="/quote-approval" element={<QuoteApproval />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </BrandProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
