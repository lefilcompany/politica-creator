import { motion } from "framer-motion";

interface DashboardGreetingProps {
  userName: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return { text: "Boa madrugada", emoji: "🌙" };
  if (hour < 12) return { text: "Bom dia", emoji: "☀️" };
  if (hour < 18) return { text: "Boa tarde", emoji: "🌤️" };
  return { text: "Boa noite", emoji: "🌙" };
};

export const DashboardGreeting = ({ userName }: DashboardGreetingProps) => {
  const greeting = getGreeting();
  const firstName = userName?.split(" ")[0] || "Deputado(a)";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight font-['Playfair_Display']">
          {greeting.text}, <span className="text-primary">{firstName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          O que vamos deliberar hoje?
        </p>
      </div>
    </motion.div>
  );
};
