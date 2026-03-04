import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  FileText,
  CheckCircle,
  CalendarDays,
  Video,
  ArrowRight } from
"lucide-react";

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
  title: "Revisar Material",
  description: "Análise e feedback",
  icon: CheckCircle,
  link: "/review",
  gradient: "from-success/12 to-success/4",
  iconColor: "text-success"
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
}];


const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
};

export const DashboardQuickActions = () => {};