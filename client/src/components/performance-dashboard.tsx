import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Clock, Target, Award, DollarSign, Users, Zap, Trophy } from "lucide-react";

interface UserPerformance {
  totalOrders: number;
  totalSales: string;
  averageOrderTime: string;
  accuracyRate: string;
  upsellSuccessRate: string;
  achievementsEarned: number;
  totalScore: number;
  rank: number;
  monthlyRank: number;
  tutorialModulesCompleted: number;
}

interface RecentAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  earnedAt: string;
  notified: boolean;
}

function PerformanceDashboard() {
  const { data: performance, isLoading } = useQuery<UserPerformance>({
    queryKey: ['/api/user-performance'],
    queryFn: async () => {
      const response = await fetch('/api/user-performance');
      if (!response.ok) throw new Error('Failed to fetch performance data');
      return response.json();
    },
  });

  const { data: recentAchievements } = useQuery<RecentAchievement[]>({
    queryKey: ['/api/recent-achievements'],
    queryFn: async () => {
      const response = await fetch('/api/recent-achievements');
      if (!response.ok) throw new Error('Failed to fetch recent achievements');
      return response.json();
    },
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatPercentage = (value: string) => {
    return `${parseFloat(value).toFixed(1)}%`;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank <= 3) return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
    if (rank <= 10) return "bg-gradient-to-r from-blue-400 to-blue-600 text-white";
    return "bg-muted text-muted-foreground";
  };

  const getPerformanceLevel = (score: number) => {
    if (score >= 1000) return { level: "Expert", color: "text-purple-600", progress: 100 };
    if (score >= 500) return { level: "Advanced", color: "text-blue-600", progress: 80 };
    if (score >= 200) return { level: "Intermediate", color: "text-green-600", progress: 60 };
    if (score >= 50) return { level: "Beginner", color: "text-yellow-600", progress: 40 };
    return { level: "Novice", color: "text-gray-600", progress: 20 };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!performance) {
    return (
      <Card className="p-6">
        <CardContent>
          <p className="text-center text-muted-foreground">No performance data available yet. Complete some orders to see your stats!</p>
        </CardContent>
      </Card>
    );
  }

  const performanceLevel = getPerformanceLevel(performance.totalScore);

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{performance.totalScore.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getRankBadgeColor(performance.monthlyRank)}>
                Rank #{performance.monthlyRank}
              </Badge>
              <span className={`text-sm font-medium ${performanceLevel.color}`}>
                {performanceLevel.level}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Orders completed this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(performance.totalSales)}</div>
            <p className="text-xs text-muted-foreground">Revenue generated this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achievements</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance.achievementsEarned}</div>
            <p className="text-xs text-muted-foreground">Badges earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Accuracy Rate</span>
                <span className="text-sm font-bold">{formatPercentage(performance.accuracyRate)}</span>
              </div>
              <Progress value={parseFloat(performance.accuracyRate)} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Upsell Success Rate</span>
                <span className="text-sm font-bold">{formatPercentage(performance.upsellSuccessRate)}</span>
              </div>
              <Progress value={parseFloat(performance.upsellSuccessRate)} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Tutorial Progress</span>
                <span className="text-sm font-bold">{performance.tutorialModulesCompleted}/4</span>
              </div>
              <Progress value={(performance.tutorialModulesCompleted / 4) * 100} className="h-2" />
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Average Order Time: {parseFloat(performance.averageOrderTime).toFixed(1)} minutes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Recent Achievements
            </CardTitle>
            <CardDescription>Your latest accomplishments</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAchievements && recentAchievements.length > 0 ? (
              <div className="space-y-3">
                {recentAchievements.slice(0, 3).map((achievement) => (
                  <div key={achievement.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Award className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      +{achievement.points}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No achievements yet</p>
                <p className="text-xs text-muted-foreground">Complete orders to earn your first badge!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress to Next Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Progress to Next Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{performanceLevel.level}</span>
              <span className="text-sm text-muted-foreground">
                {performance.totalScore}/
                {performance.totalScore >= 1000 ? '∞' : 
                 performance.totalScore >= 500 ? '1000' :
                 performance.totalScore >= 200 ? '500' :
                 performance.totalScore >= 50 ? '200' : '50'} points
              </span>
            </div>
            <Progress value={performanceLevel.progress} className="h-3" />
            <div className="text-sm text-muted-foreground">
              {performance.totalScore >= 1000 ? 
                "🎉 You've reached the highest level! Keep up the excellent work!" :
                `${(performance.totalScore >= 500 ? 1000 :
                  performance.totalScore >= 200 ? 500 :
                  performance.totalScore >= 50 ? 200 : 50) - performance.totalScore} more points to reach the next level`
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { PerformanceDashboard };