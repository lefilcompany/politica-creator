import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Home, Landmark, Users, Calendar, Archive, FileText,
  Coins, Briefcase, Shield, ImageIcon, CalendarDays,
  BookOpen, Instagram } from
"lucide-react";
import { Sidebar, SidebarContent, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useImageLimit } from "@/hooks/useImageLimit";
import { useTranslation } from "@/hooks/useTranslation";
import { InstagramHandleDialog } from "@/components/sidebar/InstagramHandleDialog";
import logoCreatorPreta from "@/assets/logoCreatorPreta.png";
import logoCreatorBranca from "@/assets/logoCreatorBranca.png";
import creatorSymbol from "@/assets/creator-symbol.png";

/* ── Reusable nav link ────────────────────────────── */
function SidebarNavItem({
  id, href, icon: Icon, label, collapsed, onNavigate, disabled



}: {id: string;href: string;icon: React.ElementType;label: string;collapsed: boolean;onNavigate?: () => void;disabled?: boolean;}) {
  const location = useLocation();
  const isActive = location.pathname === href;

  if (disabled) {
    return (
      <div className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-not-allowed opacity-40",
        collapsed ? "justify-center" : "",
        "text-muted-foreground"
      )}>
        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
        {!collapsed && <span className="text-sm">{label}</span>}
      </div>);

  }

  const content =
  <NavLink
    id={id}
    to={href}
    onClick={onNavigate}
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
      collapsed ? "justify-center" : "",
      isActive ?
      "bg-primary/10 dark:bg-primary/20 text-primary font-semibold" :
      "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
    )}>
    
      <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive && "text-primary")} />
      {!collapsed && <span className="text-sm">{label}</span>}
    </NavLink>;


  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right"><p>{label}</p></TooltipContent>
      </Tooltip>);

  }
  return content;
}

/* ── CTA action button ────────────────────────────── */
function SidebarActionButton({
  id, href, icon: Icon, label, collapsed, variant, onNavigate, disabled



}: {id: string;href: string;icon: React.ElementType;label: string;collapsed: boolean;variant: 'primary' | 'secondary';onNavigate?: () => void;disabled?: boolean;}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === href;

  const styles = {
    primary: {
      active: "border-primary text-primary bg-primary/10",
      idle: "bg-primary text-primary-foreground hover:opacity-90"
    },
    secondary: {
      active: "border-secondary text-secondary bg-secondary/10",
      idle: "bg-secondary text-secondary-foreground hover:opacity-90"
    }
  };

  if (disabled) {
    return (
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-not-allowed opacity-40 bg-muted text-muted-foreground",
        collapsed && "justify-center"
      )}>
        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">{label}</span>}
      </div>);

  }

  const handleClick = (e: React.MouseEvent) => {
    if (isActive) {e.preventDefault();navigate(href, { state: { reset: true }, replace: true });}
    onNavigate?.();
  };

  const content =
  <NavLink
    id={id}
    to={href}
    onClick={handleClick}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm",
      collapsed && "justify-center",
      isActive ?
      cn("border", styles[variant].active) :
      styles[variant].idle
    )}>
    
      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>;


  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right"><p>{label}</p></TooltipContent>
      </Tooltip>);

  }
  return content;
}

/* ── Section label (hidden when collapsed) ───────── */
function SectionLabel({ children, collapsed }: {children: React.ReactNode;collapsed: boolean;}) {
  if (collapsed) return <div className="my-1 mx-auto w-5 border-t border-foreground/10" />;
  return (
    <span className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/35">
      {children}
    </span>);

}

/* ── Main sidebar component ──────────────────────── */
export function AppSidebar() {
  const { state, open, setOpen } = useSidebar();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { remaining, maxImages } = useImageLimit();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [instagramDialogOpen, setInstagramDialogOpen] = useState(false);

  const logo = theme === 'dark' ? logoCreatorBranca : logoCreatorPreta;
  const collapsed = state === "collapsed";
  const isNavigationDisabled = false;

  const handleMobileNavigate = () => {if (isMobile) setOpen(false);};

  const sidebarContent = () =>
  <TooltipProvider>
      {/* ── Logo ────────────────────────────────── */}
      <div className="pt-4 pb-1 px-2 flex items-center justify-center">
        <NavLink
        to="/dashboard"
        onClick={handleMobileNavigate}
        id="sidebar-logo"
        className="flex justify-center cursor-pointer hover:opacity-80 transition-opacity duration-200">
        
          {collapsed ?
        <img src={creatorSymbol} alt="Creator Symbol" className="h-9 w-9 object-contain" /> :
        <img src={logo} alt="Creator Logo" className="h-8 w-auto" />
        }
        </NavLink>
      </div>

      {/* ── Nav ─────────────────────────────────── */}
      <nav className={cn(
      "flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent",
      collapsed ? "gap-1 px-2 pt-3" : "gap-0 px-3 pt-2"
    )}>
        {/* Actions — most prominent */}
        <div className={cn("flex flex-col", collapsed ? "gap-2" : "gap-1.5 pb-1")}>
          <SidebarActionButton
          id="nav-create-content" href="/create" icon={FileText}
          label={t.sidebar.createContent} variant="primary"
          collapsed={collapsed} onNavigate={handleMobileNavigate} disabled={isNavigationDisabled} />
        
          <SidebarActionButton
          id="nav-plan-content" href="/plan" icon={Calendar}
          label={t.sidebar.planContent} variant="secondary"
          collapsed={collapsed} onNavigate={handleMobileNavigate} disabled={isNavigationDisabled} />
        
        </div>

        {/* Section: Principal */}
        <SectionLabel collapsed={collapsed}>Principal</SectionLabel>
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem id="nav-dashboard" href="/dashboard" icon={Home} label={t.sidebar.home} collapsed={collapsed} onNavigate={handleMobileNavigate} />
          <SidebarNavItem id="nav-brands" href="/brands" icon={Landmark} label={t.sidebar.brands} collapsed={collapsed} onNavigate={handleMobileNavigate} disabled={isNavigationDisabled} />
          <SidebarNavItem id="nav-themes" href="/themes" icon={CalendarDays} label={t.sidebar.themes} collapsed={collapsed} onNavigate={handleMobileNavigate} disabled={isNavigationDisabled} />
          <SidebarNavItem id="nav-personas" href="/personas" icon={Users} label={t.sidebar.personas} collapsed={collapsed} onNavigate={handleMobileNavigate} disabled={isNavigationDisabled} />
        </div>

        {/* Section: Ferramentas */}
        <SectionLabel collapsed={collapsed}>Ferramentas</SectionLabel>
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem id="nav-defense" href="/defense" icon={Shield} label={t.sidebar.defense || "Radar de Imagem"} collapsed={collapsed} onNavigate={handleMobileNavigate} />
          <SidebarNavItem id="nav-history" href="/history" icon={Archive} label={t.sidebar.history} collapsed={collapsed} onNavigate={handleMobileNavigate} />
          <SidebarNavItem id="nav-team" href="/team" icon={Briefcase} label={t.sidebar.team} collapsed={collapsed} onNavigate={handleMobileNavigate} />
        </div>

        {/* Section: Recursos */}
        <SectionLabel collapsed={collapsed}>Recursos</SectionLabel>
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem id="nav-book-content" href="/book-content" icon={BookOpen} label="A Próxima Democracia" collapsed={collapsed} onNavigate={handleMobileNavigate} />
        </div>

        {/* ── Bottom area ───────────────────────── */}
        {user &&
      <div className="mt-auto mb-4 flex flex-col gap-1.5 pt-2">
            {/* Instagram */}
            {collapsed ?
        <Tooltip>
                <TooltipTrigger asChild>
                  <button
              onClick={() => setInstagramDialogOpen(true)}
              className="flex items-center justify-center px-3 py-2 rounded-lg transition-colors duration-200 text-foreground/50 hover:text-foreground hover:bg-foreground/5">
              
                    <Instagram className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right"><p>Instagram</p></TooltipContent>
              </Tooltip> :

        <button
          onClick={() => setInstagramDialogOpen(true)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-foreground/50 hover:text-foreground hover:bg-foreground/5">
          
                <Instagram className="h-[18px] w-[18px]" />
                <span className="text-sm">Usar o meu Instagram</span>
              </button>
        }

            {/* Credits card */}
            {collapsed ?
        <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink
              id="nav-credits" to="/credits" onClick={handleMobileNavigate}
              className="flex items-center justify-center px-3 py-2.5 rounded-lg bg-primary text-primary-foreground transition-all duration-200 hover:opacity-90">
              
                    <Coins className="h-[18px] w-[18px]" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-sm">{user.credits || 0} créditos</span>
                    <span className="text-xs opacity-80">{remaining}/{maxImages} imagens</span>
                  </div>
                </TooltipContent>
              </Tooltip> :

        <NavLink
          id="nav-credits" to="/credits" onClick={handleMobileNavigate}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground transition-all duration-200 hover:opacity-90">
          
                <Coins className="h-[18px] w-[18px] flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{user.credits || 0} créditos</span>
                  <div className="flex items-center gap-1 text-xs opacity-75">
                    <ImageIcon className="h-3 w-3" />
                    <span>{remaining}/{maxImages} imagens</span>
                  </div>
                </div>
              </NavLink>
        }
          </div>
      }
      </nav>
    </TooltipProvider>;


  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-[var(--layout-bg)] shadow-md shadow-primary/20">
            <div className="h-full flex flex-col">{sidebarContent()}</div>
          </SheetContent>
        </Sheet>
        <InstagramHandleDialog open={instagramDialogOpen} onOpenChange={setInstagramDialogOpen} />
      </>);

  }

  return (
    <>
      <Sidebar collapsible="icon" side="left" variant="sidebar" className="border-none shadow-none flex-shrink-0">
        <SidebarContent className="bg-transparent flex flex-col h-full overflow-y-auto">
          {sidebarContent()}
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <InstagramHandleDialog open={instagramDialogOpen} onOpenChange={setInstagramDialogOpen} />
    </>);

}