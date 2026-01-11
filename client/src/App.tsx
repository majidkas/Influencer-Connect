import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { I18nProvider } from "@/lib/i18nContext";
import { DateProvider } from "@/lib/date-context";
import { DateRangePicker } from "@/components/date-range-picker";

import Dashboard from "@/pages/dashboard";
import Influencers from "@/pages/influencers";
import Campaigns from "@/pages/campaigns";
import Discounts from "@/pages/discounts"; // NOUVEL IMPORT
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/influencers" component={Influencers} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/discounts" component={Discounts} /> {/* NOUVELLE ROUTE */}
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <DateProvider>
            <TooltipProvider>
              <SidebarProvider style={style as React.CSSProperties}>
                <div className="flex h-screen w-full">
                  <AppSidebar />
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <header className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                      <div className="flex items-center gap-2">
                        <SidebarTrigger data-testid="button-sidebar-toggle" />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DateRangePicker />
                        <ThemeToggle />
                      </div>
                    </header>
                    <main className="flex-1 overflow-auto bg-background">
                      <Router />
                    </main>
                  </div>
                </div>
              </SidebarProvider>
              <Toaster />
            </TooltipProvider>
          </DateProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;