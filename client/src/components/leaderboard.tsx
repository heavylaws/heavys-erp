import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Trophy, Medal, Star, TrendingUp, Users, DollarSign, Clock, Target } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  position: number;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    username: string;
    profileImageUrl?: string;
  };
  totalScore: number;
  totalOrders: number;
  totalSales: string;
  metrics: {
    averageOrderTime: string;
    accuracyRate: string;
    upsellSuccessRate: string;
    achievementsEarned: number;
  };
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  type: string;
  icon: string;
  points: number;
  earnedAt?: string;
}

export function Leaderboard() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard', selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/leaderboard?month=${selectedMonth}&year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json();
    },
  });

  const { data: achievements } = useQuery<Achievement[]>({
    queryKey: ['/api/achievements'],
    queryFn: async () => {
      const response = await fetch('/api/achievements');
      if (!response.ok) throw new Error('Failed to fetch achievements');
      return response.json();
    },
  });

  const { data: userAchievements } = useQuery<Achievement[]>({
    queryKey: ['/api/user-achievements'],
    queryFn: async () => {
      const response = await fetch('/api/user-achievements');
      if (!response.ok) throw new Error('Failed to fetch user achievements');
      return response.json();
    },
  });

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Trophy className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Medal className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="h-6 w-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{position}</span>;
    }
  };

  const getPositionBadgeColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-r from-amber-400 to-amber-600 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatPercentage = (value: string) => {
    return `${parseFloat(value).toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Cashier of the Month
          </h1>
          <p className="text-muted-foreground">Performance leaderboard and achievements</p>
        </div>
        
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            {Array.from({ length: 3 }, (_, i) => (
              <option key={2023 + i} value={2023 + i}>
                {2023 + i}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="space-y-4">
          {/* Top 3 Podium */}
          {leaderboard && leaderboard.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {leaderboard.slice(0, 3).map((entry, index) => (
                <Card key={entry.id} className={`relative overflow-hidden ${
                  index === 0 ? 'ring-2 ring-yellow-400 shadow-lg' : 
                  index === 1 ? 'ring-2 ring-gray-400' : 
                  'ring-2 ring-amber-400'
                }`}>
                  <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-2">
                      {getRankIcon(entry.position)}
                    </div>
                    <CardTitle className="text-lg">
                      {entry.user.firstName} {entry.user.lastName}
                    </CardTitle>
                    <CardDescription>@{entry.user.username}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Score:</span>
                        <span className="font-bold text-primary">{entry.totalScore.toLocaleString()} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Orders:</span>
                        <span>{entry.totalOrders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sales:</span>
                        <span>{formatCurrency(entry.totalSales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Accuracy:</span>
                        <span>{formatPercentage(entry.metrics.accuracyRate)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Full Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Full Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard?.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge className={getPositionBadgeColor(entry.position)}>
                        #{entry.position}
                      </Badge>
                      <div>
                        <p className="font-medium">{entry.user.firstName} {entry.user.lastName}</p>
                        <p className="text-sm text-muted-foreground">@{entry.user.username}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-bold text-primary">{entry.totalScore.toLocaleString()}</p>
                        <p className="text-muted-foreground">Points</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{entry.totalOrders}</p>
                        <p className="text-muted-foreground">Orders</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{formatCurrency(entry.totalSales)}</p>
                        <p className="text-muted-foreground">Sales</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{formatPercentage(entry.metrics.accuracyRate)}</p>
                        <p className="text-muted-foreground">Accuracy</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements?.map((achievement) => {
              const isEarned = userAchievements?.some(ua => ua.id === achievement.id);
              
              return (
                <Card key={achievement.id} className={`transition-all ${
                  isEarned ? 'ring-2 ring-green-400 bg-green-50 dark:bg-green-950' : 'opacity-60'
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className={`h-5 w-5 ${isEarned ? 'text-yellow-500' : 'text-gray-400'}`} />
                        <CardTitle className="text-lg">{achievement.name}</CardTitle>
                      </div>
                      <Badge variant={isEarned ? "default" : "secondary"}>
                        {achievement.points} pts
                      </Badge>
                    </div>
                    <CardDescription>{achievement.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {isEarned && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <Trophy className="h-4 w-4" />
                        <span>Earned!</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}