import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ToastProvider } from "@/components/ui/toast";
import { KanbanPage } from "@/pages/KanbanPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { ApprovalsPage } from "@/pages/ApprovalsPage";
import { ItemDetailPage } from "@/pages/ItemDetailPage";
import { ActivityPage } from "@/pages/ActivityPage";
import { SettingsPage } from "@/pages/SettingsPage";

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<KanbanPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/item/:id" element={<ItemDetailPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App
