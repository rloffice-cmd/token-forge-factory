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
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetailsPage />} />
            <Route path="/treasury" element={<Treasury />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/purchase" element={<Purchase />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/system" element={<SystemDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Web3Provider>
);

export default App;
