import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "@/components/Web3Provider";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import JobDetailsPage from "./pages/JobDetailsPage";
import Treasury from "./pages/Treasury";
import Settings from "./pages/Settings";
import Purchase from "./pages/Purchase";
import PaymentSuccess from "./pages/PaymentSuccess";
import SystemDashboard from "./pages/SystemDashboard";
import Landing from "./pages/Landing";
import MoneyMachine from "./pages/MoneyMachine";
import ApiDocs from "./pages/ApiDocs";
import ApiAccess from "./pages/ApiAccess";
import AdminSecurity from "./pages/AdminSecurity";
import AdminApiKeys from "./pages/AdminApiKeys";
import Intelligence from "./pages/Intelligence";
import Discovery from "./pages/Discovery";
import BrainDashboard from "./pages/BrainDashboard";
import MicroLanding from "./pages/MicroLanding";
import MicroAdminDashboard from "./pages/MicroAdminDashboard";
import Sources from "./pages/Sources";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <Web3Provider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes - Customer Acquisition */}
            <Route path="/landing" element={<Landing />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/api-access" element={<ApiAccess />} />
            
            {/* Admin Routes - Control Panel */}
            <Route path="/" element={<MoneyMachine />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetailsPage />} />
            <Route path="/treasury" element={<Treasury />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/system" element={<SystemDashboard />} />
            <Route path="/intelligence" element={<Intelligence />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/brain" element={<BrainDashboard />} />
            <Route path="/micro" element={<MicroLanding />} />
            <Route path="/micro/admin" element={<MicroAdminDashboard />} />
            <Route path="/admin/security" element={<AdminSecurity />} />
            <Route path="/admin/api-keys" element={<AdminApiKeys />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Web3Provider>
);

export default App;
