import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { KanbanPage } from "@/pages/KanbanPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { ApprovalsPage } from "@/pages/ApprovalsPage";
import { ItemDetailPage } from "@/pages/ItemDetailPage";
import { ContentPage } from "@/pages/ContentPage";
import { ActivityPage } from "@/pages/ActivityPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SocialAccountsPage } from "@/pages/SocialAccountsPage";
import { PostComposerPage } from "@/pages/PostComposerPage";
import { PostQueuePage } from "@/pages/PostQueuePage";
import { MediaLibraryPage } from "@/pages/MediaLibraryPage";
import { SocialAnalyticsPage } from "@/pages/SocialAnalyticsPage";

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<KanbanPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
              <Route path="/item/:id" element={<ItemDetailPage />} />
              <Route path="/item/:id/content" element={<ContentPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/social/accounts" element={<SocialAccountsPage />} />
              <Route path="/social/compose" element={<PostComposerPage />} />
              <Route path="/social/queue" element={<PostQueuePage />} />
              <Route path="/social/media" element={<MediaLibraryPage />} />
              <Route path="/social/analytics" element={<SocialAnalyticsPage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App
