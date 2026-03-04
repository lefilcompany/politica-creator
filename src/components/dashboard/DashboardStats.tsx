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

const statItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
};

export const DashboardStats = ({ actionsCount, brandsCount, personasCount = 0, themesCount = 0, hasTeam = false }: DashboardStatsProps) => {
  const stats = [
  {
    label: hasTeam ? "Documentos do Gabinete" : "Documentos Redigidos",
    value: actionsCount,
    icon: FileText,
    color: "text-primary",
    bg: "bg-primary/10",
    link: "/history"
  },
  {
    label: "Identidades Ativas",
    value: brandsCount,
    icon: Landmark,
    color: "text-accent",
    bg: "bg-accent/10",
    link: "/brands"
  },
  {
    label: "Audiência-Alvo",
    value: personasCount,
    icon: Users,
    color: "text-secondary",
    bg: "bg-secondary/10",
    link: "/personas"
  },
  {
    label: "Agenda Estratégica",
    value: themesCount,
    icon: BookOpen,
    color: "text-success",
    bg: "bg-success/10",
    link: "/themes"
  }];


  return;

























};