import { SidebarProvider } from "@/components/ui/sidebar";
import { SystemSidebar } from "./SystemSidebar";
import { SystemHeader } from "./SystemHeader";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export const SystemLayout = () => {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen w-full flex overflow-hidden bg-[var(--layout-bg)]">
        <SystemSidebar />
        <div className={
          isMobile
            ? "flex flex-1 flex-col min-w-0 bg-card"
            : "flex flex-1 flex-col min-w-0 bg-card rounded-lg shadow-md mt-4 mr-4 mb-4 ml-1 overflow-hidden border border-border/30"
        }>
          <SystemHeader />
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="w-full h-full p-4 sm:p-6 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
