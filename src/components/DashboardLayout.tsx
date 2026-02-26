import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { PlatformChatbot } from "./PlatformChatbot";
import { PresenceTracker } from "@/components/PresenceTracker";

export const DashboardLayout = () => {
  const isMobile = useIsMobile();
  
  return (
    <SidebarProvider defaultOpen={true}>
      <PresenceTracker />
      <div className="h-screen w-full flex overflow-hidden bg-[var(--layout-bg)]">
        <AppSidebar />
        <div className={
          isMobile
            ? "flex flex-1 flex-col min-w-0 bg-card"
            : "flex flex-1 flex-col min-w-0 bg-card rounded-lg shadow-md mt-4 mr-4 mb-4 ml-1 overflow-hidden border border-border/30"
        }>
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="w-full h-full p-4 sm:p-6 lg:p-8 pb-12 sm:pb-16 lg:pb-20">
              <Outlet />
            </div>
          </main>
        </div>
        <PlatformChatbot />
      </div>
    </SidebarProvider>
  );
};
