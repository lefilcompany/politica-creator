import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import { OnboardingProvider } from "./components/onboarding/OnboardingProvider";
import { EventTrackingProvider } from "./components/EventTrackingProvider";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { lazy, Suspense } from "react";
import { PageLoader } from "./components/PageLoader";
import { DashboardLayout } from "./components/DashboardLayout";
import { SystemRoute } from "./components/system/SystemRoute";
import { SystemLayout } from "./components/system/SystemLayout";

// Lazy loaded pages - Public
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Subscribe = lazy(() => import("./pages/Subscribe"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const OnboardingSuccess = lazy(() => import("./pages/OnboardingSuccess"));
const OnboardingCanceled = lazy(() => import("./pages/OnboardingCanceled"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PoliticalOnboarding = lazy(() => import("./pages/PoliticalOnboarding"));

// Lazy loaded pages - Dashboard
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Brands = lazy(() => import("./pages/Brands"));
const BrandView = lazy(() => import("./pages/BrandView"));
const Themes = lazy(() => import("./pages/Themes"));
const ThemeView = lazy(() => import("./pages/ThemeView"));
const Personas = lazy(() => import("./pages/Personas"));
const PersonaView = lazy(() => import("./pages/PersonaView"));
const History = lazy(() => import("./pages/History"));
const CreateImage = lazy(() => import("./pages/CreateImage"));
const CreateVideo = lazy(() => import("./pages/CreateVideo"));
const AnimateImage = lazy(() => import("./pages/AnimateImage"));
const ContentCreationSelector = lazy(() => import("./pages/ContentCreationSelector"));
const ContentResult = lazy(() => import("./pages/ContentResult"));
const VideoResult = lazy(() => import("./pages/VideoResult"));
const ReviewContent = lazy(() => import("./pages/ReviewContent"));
const ReviewResult = lazy(() => import("./pages/ReviewResult"));
const PlanContent = lazy(() => import("./pages/PlanContent"));
const PlanResult = lazy(() => import("./pages/PlanResult"));
const QuickContent = lazy(() => import("./pages/QuickContent"));
const QuickContentResult = lazy(() => import("./pages/QuickContentResult"));
const Credits = lazy(() => import("./pages/Credits"));
const Team = lazy(() => import("./pages/Team"));
const TeamDashboard = lazy(() => import("./pages/TeamDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const CreditHistory = lazy(() => import("./pages/CreditHistory"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Defense = lazy(() => import("./pages/Defense"));
const ActionView = lazy(() => import("./pages/ActionView"));

// Lazy loaded pages - System
const System = lazy(() => import("./pages/System"));
const SystemTeams = lazy(() => import("./pages/system/SystemTeams"));
const SystemUsers = lazy(() => import("./pages/system/SystemUsers"));
const SystemLogs = lazy(() => import("./pages/system/SystemLogs"));
const SystemPlans = lazy(() => import("./pages/system/SystemPlans"));

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Suspense wrapper component for cleaner routes
const SuspenseRoute = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <LanguageProvider>
          <AuthProvider>
            <OnboardingProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <EventTrackingProvider>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<SuspenseRoute><Auth /></SuspenseRoute>} />
                      <Route path="/forgot-password" element={<SuspenseRoute><ForgotPassword /></SuspenseRoute>} />
                      <Route path="/reset-password" element={<SuspenseRoute><ResetPassword /></SuspenseRoute>} />
                      <Route path="/privacy" element={<SuspenseRoute><Privacy /></SuspenseRoute>} />
                      <Route path="/subscribe" element={<SuspenseRoute><Subscribe /></SuspenseRoute>} />
                      <Route path="/onboarding" element={<SuspenseRoute><Onboarding /></SuspenseRoute>} />
                      <Route path="/onboarding/success" element={<SuspenseRoute><OnboardingSuccess /></SuspenseRoute>} />
                      <Route path="/onboarding/canceled" element={<SuspenseRoute><OnboardingCanceled /></SuspenseRoute>} />
                      <Route path="/payment-success" element={<SuspenseRoute><PaymentSuccess /></SuspenseRoute>} />
                      <Route path="/contact" element={<SuspenseRoute><Contact /></SuspenseRoute>} />
                      <Route path="/political-onboarding" element={<ProtectedRoute><SuspenseRoute><PoliticalOnboarding /></SuspenseRoute></ProtectedRoute>} />
                      
                      {/* Dashboard routes with sidebar layout */}
                      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                        <Route path="dashboard" element={<SuspenseRoute><Dashboard /></SuspenseRoute>} />
                        <Route path="brands" element={<SuspenseRoute><Brands /></SuspenseRoute>} />
                        <Route path="brands/:brandId" element={<SuspenseRoute><BrandView /></SuspenseRoute>} />
                        <Route path="themes" element={<SuspenseRoute><Themes /></SuspenseRoute>} />
                        <Route path="themes/:themeId" element={<SuspenseRoute><ThemeView /></SuspenseRoute>} />
                        <Route path="personas" element={<SuspenseRoute><Personas /></SuspenseRoute>} />
                        <Route path="personas/:personaId" element={<SuspenseRoute><PersonaView /></SuspenseRoute>} />
                        <Route path="history" element={<SuspenseRoute><History /></SuspenseRoute>} />
                        <Route path="create" element={<SuspenseRoute><ContentCreationSelector /></SuspenseRoute>} />
                        <Route path="create/quick" element={<SuspenseRoute><QuickContent /></SuspenseRoute>} />
                        <Route path="create/image" element={<SuspenseRoute><CreateImage /></SuspenseRoute>} />
                        <Route path="create/video" element={<SuspenseRoute><CreateVideo /></SuspenseRoute>} />
                        <Route path="create/animate" element={<SuspenseRoute><AnimateImage /></SuspenseRoute>} />
                        <Route path="result" element={<SuspenseRoute><ContentResult /></SuspenseRoute>} />
                        <Route path="video-result" element={<SuspenseRoute><VideoResult /></SuspenseRoute>} />
                        <Route path="review" element={<SuspenseRoute><ReviewContent /></SuspenseRoute>} />
                        <Route path="review-result" element={<SuspenseRoute><ReviewResult /></SuspenseRoute>} />
                        <Route path="plan" element={<SuspenseRoute><PlanContent /></SuspenseRoute>} />
                        <Route path="plan-result" element={<SuspenseRoute><PlanResult /></SuspenseRoute>} />
                        <Route path="quick-content" element={<SuspenseRoute><QuickContent /></SuspenseRoute>} />
                        <Route path="quick-content-result" element={<SuspenseRoute><QuickContentResult /></SuspenseRoute>} />
                        <Route path="credits" element={<SuspenseRoute><Credits /></SuspenseRoute>} />
                        <Route path="team" element={<SuspenseRoute><Team /></SuspenseRoute>} />
                        <Route path="team-dashboard" element={<SuspenseRoute><TeamDashboard /></SuspenseRoute>} />
                        <Route path="profile" element={<SuspenseRoute><Profile /></SuspenseRoute>} />
                        <Route path="profile/:userId" element={<SuspenseRoute><PublicProfile /></SuspenseRoute>} />
                        <Route path="credit-history" element={<SuspenseRoute><CreditHistory /></SuspenseRoute>} />
                        <Route path="about" element={<SuspenseRoute><About /></SuspenseRoute>} />
                        <Route path="action/:actionId" element={<SuspenseRoute><ActionView /></SuspenseRoute>} />
                        <Route path="defense" element={<SuspenseRoute><Defense /></SuspenseRoute>} />
                      </Route>
                      
                      {/* System admin routes with separate layout */}
                      <Route path="/system" element={<SystemRoute><SystemLayout /></SystemRoute>}>
                        <Route index element={<SuspenseRoute><System /></SuspenseRoute>} />
                        <Route path="plans" element={<SuspenseRoute><SystemPlans /></SuspenseRoute>} />
                        <Route path="teams" element={<SuspenseRoute><SystemTeams /></SuspenseRoute>} />
                        <Route path="users" element={<SuspenseRoute><SystemUsers /></SuspenseRoute>} />
                        <Route path="logs" element={<SuspenseRoute><SystemLogs /></SuspenseRoute>} />
                      </Route>
                      
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<SuspenseRoute><NotFound /></SuspenseRoute>} />
                    </Routes>
                  </EventTrackingProvider>
                </BrowserRouter>
              </TooltipProvider>
            </OnboardingProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
