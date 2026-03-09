import { motion } from "framer-motion";
import dashboardBannerImg from "@/assets/dashboard-banner.jpg";

interface DashboardBannerProps {
  userName: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

export const DashboardBanner = ({ userName }: DashboardBannerProps) => {
  const firstName = userName?.split(" ")[0] || "Deputado(a)";

  return (
    <div className="relative overflow-hidden rounded-md shadow-lg h-44 sm:h-48 md:h-56 lg:h-64 border border-border/30">
      <motion.img
        src={dashboardBannerImg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-bottom"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Overlay sépia */}
      <div className="absolute inset-0 bg-gradient-to-r from-foreground/60 via-foreground/30 to-transparent" />

      {/* Content */}
      <div className="relative h-full flex items-center px-5 sm:px-6 md:px-10 z-10">
        <div className="flex flex-col justify-center backdrop-blur-[2px] rounded-md px-5 py-4 bg-background/85 border border-border/40 shadow-md">
          <p className="text-muted-foreground text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase">
            {getGreeting()}
          </p>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight mt-0.5 font-['Playfair_Display']">
            {firstName}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 max-w-xs sm:max-w-md">
            Seu creator está pronto para trabalhar.
          </p>
        </div>
      </div>
    </div>
  );
};
