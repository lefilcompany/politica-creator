import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  FileText,
  CalendarDays,
  Video,
} from "lucide-react";

const actions = [
  {
    title: "Redigir Discurso",
    description: "Textos e materiais com IA",
    icon: FileText,
    link: "/create",
    gradient: "from-primary/12 to-primary/4",
    iconColor: "text-primary"
  },
  {
    title: "Planejar Campanha",
    description: "Organize a comunicação",
    icon: CalendarDays,
    link: "/plan",
    gradient: "from-accent/12 to-accent/4",
    iconColor: "text-accent"
  },
  {
    title: "Gerar Propaganda",
    description: "Vídeos para campanha",
    icon: Video,
    link: "/create-video",
    gradient: "from-secondary/12 to-secondary/4",
    iconColor: "text-secondary"
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export const DashboardQuickActions = () => {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      {actions.map((action) => (
        <motion.div key={action.title} variants={item}>
          <Link to={action.link}>
            <Card className={`group cursor-pointer border-0 bg-gradient-to-br ${action.gradient} hover:shadow-md transition-all duration-300`}>
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <action.icon className={`h-7 w-7 ${action.iconColor} group-hover:scale-110 transition-transform`} />
                <span className="text-sm font-semibold text-foreground">{action.title}</span>
                <span className="text-xs text-muted-foreground leading-tight">{action.description}</span>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
};
