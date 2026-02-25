import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  FileText,
  CheckCircle,
  CalendarDays,
  Video,
  ArrowRight,
} from "lucide-react";

const actions = [
  {
    title: "Redigir Discurso",
    description: "Textos e materiais com IA",
    icon: FileText,
    link: "/create",
    gradient: "from-primary/12 to-primary/4",
    iconColor: "text-primary",
  },
  {
    title: "Revisar Material",
    description: "Análise e feedback",
    icon: CheckCircle,
    link: "/review",
    gradient: "from-success/12 to-success/4",
    iconColor: "text-success",
  },
  {
    title: "Planejar Campanha",
    description: "Organize a comunicação",
    icon: CalendarDays,
    link: "/plan",
    gradient: "from-accent/12 to-accent/4",
    iconColor: "text-accent",
  },
  {
    title: "Gerar Propaganda",
    description: "Vídeos para campanha",
    icon: Video,
    link: "/create-video",
    gradient: "from-secondary/12 to-secondary/4",
    iconColor: "text-secondary",
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

export const DashboardQuickActions = () => (
  <motion.div
    variants={container}
    initial="hidden"
    animate="show"
    className="grid grid-cols-2 lg:grid-cols-4 gap-3"
  >
    {actions.map((action) => (
      <motion.div key={action.title} variants={item}>
        <Link to={action.link} className="block h-full">
          <Card className="group h-full border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden">
            <CardContent className={`p-4 h-full bg-gradient-to-br ${action.gradient} flex flex-col justify-between gap-3`}>
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-md bg-card/80 backdrop-blur-sm shadow-sm border border-border/20 ${action.iconColor}`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{action.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </motion.div>
    ))}
  </motion.div>
);
