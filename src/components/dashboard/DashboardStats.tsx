import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Landmark, Users, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardStatsProps {
  actionsCount: number;
  brandsCount: number;
  personasCount?: number;
  themesCount?: number;
  hasTeam?: boolean;
}

export const DashboardStats = ({ actionsCount, brandsCount, personasCount = 0, themesCount = 0, hasTeam = false }: DashboardStatsProps) => {
  const stats = [
    {
      label: hasTeam ? "Documentos do Gabinete" : "Documentos Redigidos",
      value: actionsCount,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
      link: "/history",
    },
    {
      label: "Identidades Ativas",
      value: brandsCount,
      icon: Landmark,
      color: "text-accent",
      bg: "bg-accent/10",
      link: "/brands",
    },
    {
      label: "Audiência-Alvo",
      value: personasCount,
      icon: Users,
      color: "text-secondary",
      bg: "bg-secondary/10",
      link: "/personas",
    },
    {
      label: "Agenda Estratégica",
      value: themesCount,
      icon: BookOpen,
      color: "text-success",
      bg: "bg-success/10",
      link: "/themes",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Link key={stat.label} to={stat.link}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="group cursor-pointer hover:shadow-md transition-all duration-300">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                <span className="text-xs text-muted-foreground leading-tight">{stat.label}</span>
              </CardContent>
            </Card>
          </motion.div>
        </Link>
      ))}
    </div>
  );
};
