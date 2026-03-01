import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import MayorDashboard from "./pages/MayorDashboard";
import AdminRooms from "./pages/AdminRooms";
import AdminDepartments from "./pages/AdminDepartments";
import Violations from "./pages/Violations";
import PMInbox from "./pages/PMInbox";
import ViolationCasePage from "./pages/ViolationCasePage";
import CaseChatPage from "./pages/CaseChatPage";
import TreatyList from "./pages/TreatyList";
import TreatyDetail from "./pages/TreatyDetail";
import TreatyChatPage from "./pages/TreatyChatPage";
import BreachCaseChatPage from "./pages/BreachCaseChatPage";
import InterDeptTreatyDetail from "./pages/InterDeptTreatyDetail";
import InterDeptTreatyChatPage from "./pages/InterDeptTreatyChatPage";
import InterDeptBreachChatPage from "./pages/InterDeptBreachChatPage";
import FinanceDashboard from "./pages/FinanceDashboard";
import ElectionPage from "./pages/ElectionPage";
import SenateChatPage from "./pages/SenateChatPage";
import RoomChatPage from "./features/chat/pages/RoomChatPage";
import ChatDebugPage from "./features/chat/pages/ChatDebugPage";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import NotFound from "./pages/NotFound";
import { Role } from "./types";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/chat" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/chat/room" replace />} />
              <Route path="room" element={<RoomChatPage />} />
              <Route path="debug" element={<ChatDebugPage />} />
            </Route>

            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="violations" element={<Violations />} />
              <Route path="violations/:id/chat" element={<CaseChatPage />} />
              <Route path="pm/inbox" element={<PMInbox />} />
              <Route path="pm/violations/:id" element={<ViolationCasePage />} />
              <Route path="treaties" element={<TreatyList />} />
              <Route path="treaties/:id" element={<TreatyDetail />} />
              <Route path="treaties/:id/chat" element={<TreatyChatPage />} />
              <Route path="treaties/:id/breaches/:breachId/chat" element={<BreachCaseChatPage />} />
              {/* Inter-Dept Treaty routes */}
              <Route path="inter-dept-treaties/:id" element={<InterDeptTreatyDetail />} />
              <Route path="inter-dept-treaties/:id/chat" element={<InterDeptTreatyChatPage />} />
              <Route path="inter-dept-treaties/:id/breaches/:breachId/chat" element={<InterDeptBreachChatPage />} />
              <Route path="finance" element={<FinanceDashboard />} />
              <Route path="elections" element={<ElectionPage />} />
              <Route path="senate" element={<SenateChatPage />} />
              <Route path="mayor" element={<ProtectedRoute requiredRole={Role.MAYOR}><MayorDashboard /></ProtectedRoute>} />
              <Route path="admin/rooms" element={<ProtectedRoute requiredRole={Role.ADMIN}><AdminRooms /></ProtectedRoute>} />
              <Route path="admin/departments" element={<ProtectedRoute requiredRole={Role.ADMIN}><AdminDepartments /></ProtectedRoute>} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

