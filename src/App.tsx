import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "@/components/Web3Provider";
import AuthGuard from "@/components/AuthGuard";
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
import ForgeMoneyMachine from "./pages/ForgeMoneyMachine";
import M2MDashboard from "./pages/M2MDashboard";
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
import AgentMarketplace from "./pages/AgentMarketplace";
import AffiliateAdmin from "./pages/AffiliateAdmin";
import DigitalProducts from "./pages/DigitalProducts";
import PartnerLanding from "./pages/PartnerLanding";
import LeadMarketplace from "./pages/LeadMarketplace";
import AffiliateRedirect from "./pages/AffiliateRedirect";
import ManualOutreach from "./pages/ManualOutreach";
import Login from "./pages/Login";
import SystemAudit from "./pages/SystemAudit";
import DomainManager from "./pages/DomainManager";
import HunterDashboard from "./pages/HunterDashboard";
import SystemDiagnosticReport from "./pages/SystemDiagnosticReport";
import NotFound from "./pages/NotFound";
import ResearchFindingPage from "./pages/ResearchFindingPage";

const queryClient = new QueryClient();


const App = () => (
  <Web3Provider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PartnerLanding />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/api-access" element={<ApiAccess />} />
            <Route path="/agents" element={<AgentMarketplace />} />
            <Route path="/products" element={<DigitalProducts />} />
            <Route path="/micro" element={<MicroLanding />} />
            <Route path="/leads" element={<LeadMarketplace />} />
            <Route path="/go/:partnerSlug/:leadId?" element={<AffiliateRedirect />} />
            <Route path="/research/:slug" element={<ResearchFindingPage />} />
            
            {/* Protected Routes - Auth Required */}
            <Route path="/console" element={<AuthGuard><MoneyMachine /></AuthGuard>} />
            <Route path="/forge/money-machine" element={<AuthGuard><ForgeMoneyMachine /></AuthGuard>} />
            <Route path="/forge/m2m-dashboard" element={<AuthGuard><M2MDashboard /></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/jobs" element={<AuthGuard><Jobs /></AuthGuard>} />
            <Route path="/jobs/:id" element={<AuthGuard><JobDetailsPage /></AuthGuard>} />
            <Route path="/treasury" element={<AuthGuard><Treasury /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
            <Route path="/system" element={<AuthGuard><SystemDashboard /></AuthGuard>} />
            <Route path="/intelligence" element={<AuthGuard><Intelligence /></AuthGuard>} />
            <Route path="/discovery" element={<AuthGuard><Discovery /></AuthGuard>} />
            <Route path="/sources" element={<AuthGuard><Sources /></AuthGuard>} />
            <Route path="/brain" element={<AuthGuard><BrainDashboard /></AuthGuard>} />
            <Route path="/micro/admin" element={<AuthGuard><MicroAdminDashboard /></AuthGuard>} />
            <Route path="/admin/security" element={<AuthGuard><AdminSecurity /></AuthGuard>} />
            <Route path="/admin/api-keys" element={<AuthGuard><AdminApiKeys /></AuthGuard>} />
            <Route path="/admin/affiliates" element={<AuthGuard><AffiliateAdmin /></AuthGuard>} />
            <Route path="/admin/system-audit" element={<AuthGuard><SystemAudit /></AuthGuard>} />
            <Route path="/admin/manual-outreach" element={<AuthGuard><ManualOutreach /></AuthGuard>} />
            <Route path="/admin/domain-manager" element={<AuthGuard><DomainManager /></AuthGuard>} />
            <Route path="/forge/hunter" element={<AuthGuard><HunterDashboard /></AuthGuard>} />
            <Route path="/admin/diagnostic-report" element={<AuthGuard><SystemDiagnosticReport /></AuthGuard>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Web3Provider>
);

export default App;
