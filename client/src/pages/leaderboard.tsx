import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Leaderboard } from "@/components/leaderboard";
import { PerformanceDashboard } from "@/components/performance-dashboard";
import { useAuth } from "@/hooks/useAuth";
import { 
  Trophy, 
  Home, 
  ArrowLeft, 
  BarChart3, 
  Target, 
  Award,
  TrendingUp,
  Users
} from "lucide-react";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("leaderboard");

  const navigateBack = () => {
    const roleRoutes = {
      admin: "/admin",
      manager: "/manager", 
      cashier: "/cashier",
      barista: "/barista",
      courier: "/courier"
    };
    
    const backRoute = roleRoutes[(user as any)?.role as keyof typeof roleRoutes] || "/";
    setLocation(backRoute);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
              
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Performance Center
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {(user as any)?.firstName} {(user as any)?.lastName}
              </Badge>
              <Badge variant="secondary" className="text-sm capitalize">
                {(user as any)?.role}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Track Progress</div>
              <p className="text-xs text-muted-foreground">Monitor your stats</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rankings</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">Monthly</div>
              <p className="text-xs text-muted-foreground">See how you rank</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Achievements</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Earn Badges</div>
              <p className="text-xs text-muted-foreground">Unlock rewards</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compete</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">Challenge</div>
              <p className="text-xs text-muted-foreground">Beat your best</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard */}
        <Card className="shadow-lg">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b bg-muted/30">
                <TabsList className="grid w-full grid-cols-2 h-auto p-1 m-4 bg-background">
                  <TabsTrigger 
                    value="performance" 
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <BarChart3 className="h-4 w-4" />
                    My Performance
                  </TabsTrigger>
                  <TabsTrigger 
                    value="leaderboard" 
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Trophy className="h-4 w-4" />
                    Leaderboard
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="performance" className="mt-0">
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Your Performance Dashboard</h2>
                      <p className="text-muted-foreground">
                        Track your progress, achievements, and performance metrics
                      </p>
                    </div>
                    <PerformanceDashboard />
                  </div>
                </TabsContent>

                <TabsContent value="leaderboard" className="mt-0">
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Monthly Leaderboard</h2>
                      <p className="text-muted-foreground">
                        See how you rank against other team members this month
                      </p>
                    </div>
                    <Leaderboard />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-dashed">
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <h3 className="text-xl font-bold">Gamification System</h3>
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our gamification system tracks your performance, awards achievements, and provides 
                friendly competition through monthly leaderboards. Complete orders efficiently, 
                maintain high accuracy, and earn points to climb the rankings!
              </p>
              <div className="flex justify-center gap-4 mt-6">
                <Badge variant="secondary" className="px-3 py-1">
                  Performance Tracking
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  Achievement System
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  Monthly Competition
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}