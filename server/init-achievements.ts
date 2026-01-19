import { storage } from "./storage";

// Initialize default achievements
export async function initializeAchievements() {
  const defaultAchievements = [
    {
      id: 'first-order-achievement',
      name: 'First Steps',
      description: 'Complete your very first order',
      type: 'first_order' as const,
      icon: 'trophy',
      criteria: { orderCount: 1 },
      points: 50
    },
    {
      id: 'speed-demon-achievement',
      name: 'Speed Demon',
      description: 'Average order time under 2 minutes with 10+ orders',
      type: 'speed_demon' as const,
      icon: 'zap',
      criteria: { averageTime: 2.0, minOrders: 10 },
      points: 100
    },
    {
      id: 'sales-champion-achievement',
      name: 'Sales Champion',
      description: 'Generate over $1,000 in monthly sales',
      type: 'sales_champion' as const,
      icon: 'dollar-sign',
      criteria: { monthlySales: 1000 },
      points: 200
    },
    {
      id: 'accuracy-ace-achievement',
      name: 'Accuracy Ace',
      description: 'Maintain 95%+ accuracy rate',
      type: 'accuracy_ace' as const,
      icon: 'target',
      criteria: { accuracyRate: 95 },
      points: 150
    },
    {
      id: 'tutorial-graduate-achievement',
      name: 'Tutorial Graduate',
      description: 'Complete all 4 tutorial modules',
      type: 'tutorial_graduate' as const,
      icon: 'graduation-cap',
      criteria: { tutorialModules: 4 },
      points: 75
    },
    {
      id: 'upsell-master-achievement',
      name: 'Upsell Master',
      description: 'Achieve 25%+ upsell success rate',
      type: 'upsell_master' as const,
      icon: 'trending-up',
      criteria: { upsellRate: 25 },
      points: 125
    },
    {
      id: 'customer-favorite-achievement',
      name: 'Customer Favorite',
      description: 'Receive 4.5+ customer satisfaction score',
      type: 'customer_favorite' as const,
      icon: 'heart',
      criteria: { satisfactionScore: 4.5 },
      points: 175
    },
    {
      id: 'monthly-winner-achievement',
      name: 'Monthly Winner',
      description: 'Rank #1 in monthly leaderboard',
      type: 'monthly_winner' as const,
      icon: 'crown',
      criteria: { monthlyRank: 1 },
      points: 500
    }
  ];

  try {
    // Check if achievements already exist
    const existingAchievements = await storage.getAchievements();
    
    if (existingAchievements.length === 0) {
      console.log('🏆 Initializing default achievements...');
      
      for (const achievement of defaultAchievements) {
        try {
          await storage.createAchievement(achievement);
          console.log(`✅ Created achievement: ${achievement.name}`);
        } catch (error) {
          console.log(`⚠️ Achievement ${achievement.name} already exists`);
        }
      }
      
      console.log('🎉 Achievement system initialized successfully!');
    } else {
      console.log(`✅ Achievement system already initialized (${existingAchievements.length} achievements)`);
    }
  } catch (error) {
    console.error('❌ Error initializing achievements:', error);
  }
}