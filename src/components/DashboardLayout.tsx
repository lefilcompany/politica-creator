import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { Outlet, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { PlatformChatbot } from "./PlatformChatbot";
import { PresenceTracker } from "@/components/PresenceTracker";
import { cn } from "@/lib/utils";

export const DashboardLayout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const isBookChatRoute = location.pathname === "/book-chat";

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
          <main className={cn("flex-1 overflow-x-hidden", isBookChatRoute ? "overflow-hidden" : "overflow-y-auto")}>
            <div
              className={cn(
                "w-full h-full min-h-0",
                isBookChatRoute ? "overflow-hidden" : "p-4 sm:p-6 lg:p-8 pb-24 sm:pb-28 lg:pb-32"
              )}
            >
              <Outlet />
            </div>
          </main>
        </div>
        <PlatformChatbot />
      </div>
    </SidebarProvider>
  );
};
