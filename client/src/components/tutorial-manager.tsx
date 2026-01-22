import React, { useState, useEffect } from 'react';
import { TutorialOverlay, TutorialStep } from './tutorial-overlay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, BookOpen, Users, ShoppingCart, Settings } from 'lucide-react';

export interface Tutorial {
  id: string;
  name: string;
  description: string;
  category: 'basics' | 'orders' | 'inventory' | 'advanced';
  estimatedTime: number; // in minutes
  steps: TutorialStep[];
  icon: React.ReactNode;
  prerequisite?: string[]; // IDs of prerequisite tutorials
}

interface TutorialManagerProps {
  userRole: string;
  onTutorialComplete: (tutorialId: string) => void;
}

// Define all cashier tutorials
const cashierTutorials: Tutorial[] = [
  {
    id: 'cashier-basics',
    name: 'POS System Basics',
    description: 'Learn the fundamentals of using the POS system',
    category: 'basics',
    estimatedTime: 5,
    icon: <BookOpen className="h-5 w-5" />,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Highway Cafe POS',
        description: 'Welcome! This tutorial will teach you how to use our Point of Sale system. You\'ll learn to process orders, handle payments, and manage inventory.',
        target: 'body',
        position: 'center',
        tip: 'Take your time with each step. You can always replay tutorials later.'
      },
      {
        id: 'interface-overview',
        title: 'Interface Overview',
        description: 'This is your main cashier interface. You can see product categories at the top, products in the center, and the order area on the right.',
        target: '.cashier-interface',
        position: 'center',
        tip: 'The interface is touch-friendly and works great on tablets too!'
      },
      {
        id: 'product-categories',
        title: 'Product Categories',
        description: 'These category tabs help you quickly find products. Click on different categories to see various types of items.',
        target: '[role="tablist"]',
        position: 'bottom',
        action: 'click',
        actionText: 'Try clicking on the "Beverages" category',
        tip: 'Categories are organized by type: Food, Beverages, Desserts, etc.'
      },
      {
        id: 'product-grid',
        title: 'Product Selection',
        description: 'This grid shows all available products. Each card displays the product name, description, price, and stock level.',
        target: '.product-grid',
        position: 'right',
        tip: 'Products with low stock will show a red badge to alert you.'
      },
      {
        id: 'order-area',
        title: 'Order Management Area',
        description: 'This is where customer orders appear. You can see items, quantities, prices, and the running total.',
        target: '.order-panel',
        position: 'left',
        tip: 'You can handle multiple orders simultaneously using the tabs at the top.'
      }
    ]
  },
  {
    id: 'create-first-order',
    name: 'Creating Your First Order',
    description: 'Step-by-step guide to processing your first customer order',
    category: 'orders',
    estimatedTime: 7,
    icon: <ShoppingCart className="h-5 w-5" />,
    prerequisite: ['cashier-basics'],
    steps: [
      {
        id: 'new-order',
        title: 'Starting a New Order',
        description: 'Every customer interaction starts with creating a new order. If you don\'t have an active order, click the "New Order" button.',
        target: '.new-order-btn',
        position: 'bottom',
        action: 'click',
        actionText: 'Click "New Order" to create your first order',
        prerequisite: () => !document.querySelector('.current-order')
      },
      {
        id: 'select-product',
        title: 'Adding Products',
        description: 'To add items to the order, simply click on products in the grid. Let\'s start by adding a coffee to this order.',
        target: '.product-card:first-child',
        position: 'right',
        action: 'click',
        actionText: 'Click on any coffee product to add it to the order',
        tip: 'The item will automatically appear in the order panel with quantity 1'
      },
      {
        id: 'adjust-quantity',
        title: 'Adjusting Quantities',
        description: 'You can increase or decrease item quantities using the + and - buttons next to each item.',
        target: '.quantity-controls',
        position: 'left',
        action: 'click',
        actionText: 'Try clicking the + button to add another coffee',
        tip: 'You can also click on a product multiple times to increase quantity'
      },
      {
        id: 'add-more-items',
        title: 'Building the Order',
        description: 'Let\'s add a pastry to complete this order. Navigate to the Food category and select an item.',
        target: '[data-category="Food"]',
        position: 'bottom',
        action: 'click',
        actionText: 'Click the Food category, then select any pastry or sandwich',
        tip: 'Most customers order a combination of beverages and food items'
      },
      {
        id: 'review-total',
        title: 'Order Total',
        description: 'The order total, including tax, is automatically calculated and displayed here. Always verify this with the customer before processing payment.',
        target: '.order-total',
        position: 'left',
        tip: 'Tax is calculated at 8.5% and included in the total automatically'
      },
      {
        id: 'process-payment',
        title: 'Processing Payment',
        description: 'When ready to complete the order, select the payment method and click the payment button.',
        target: '.payment-section',
        position: 'left',
        action: 'click',
        actionText: 'Select "Cash" as payment method and click the payment button',
        tip: 'Always confirm the payment amount with the customer first'
      }
    ]
  },
  {
    id: 'multiple-orders',
    name: 'Managing Multiple Orders',
    description: 'Learn to handle multiple customer orders simultaneously',
    category: 'orders',
    estimatedTime: 6,
    icon: <Users className="h-5 w-5" />,
    prerequisite: ['create-first-order'],
    steps: [
      {
        id: 'multiple-tabs',
        title: 'Order Tabs',
        description: 'You can manage multiple orders at once using tabs. Each tab represents a different customer\'s order.',
        target: '.order-tabs',
        position: 'bottom',
        tip: 'This is especially useful during busy periods when customers are ordering simultaneously'
      },
      {
        id: 'switch-orders',
        title: 'Switching Between Orders',
        description: 'Click on different order tabs to switch between customer orders. The active order is highlighted.',
        target: '.order-tab',
        position: 'bottom',
        action: 'click',
        actionText: 'Try clicking between different order tabs',
        tip: 'The order number helps you keep track of which customer you\'re serving'
      },
      {
        id: 'create-second-order',
        title: 'Creating Additional Orders',
        description: 'Click "New Order" to create additional orders while keeping existing ones active.',
        target: '.new-order-btn',
        position: 'bottom',
        action: 'click',
        actionText: 'Create a new order for the next customer',
        tip: 'You can have up to 10 active orders at once'
      }
    ]
  },
  {
    id: 'inventory-basics',
    name: 'Inventory Awareness',
    description: 'Understanding stock levels and handling out-of-stock situations',
    category: 'inventory',
    estimatedTime: 4,
    icon: <Settings className="h-5 w-5" />,
    prerequisite: ['cashier-basics'],
    steps: [
      {
        id: 'stock-indicators',
        title: 'Stock Level Indicators',
        description: 'Each product card shows the current stock level. Pay attention to low stock warnings.',
        target: '.stock-indicator',
        position: 'right',
        tip: 'Red badges indicate low stock - inform customers about potential delays'
      },
      {
        id: 'out-of-stock',
        title: 'Out of Stock Items',
        description: 'Items that are out of stock will be grayed out and cannot be selected. Always check stock before promising items to customers.',
        target: '.out-of-stock',
        position: 'right',
        tip: 'Suggest alternative items when something is out of stock'
      },
      {
        id: 'low-stock-alerts',
        title: 'Low Stock Notifications',
        description: 'When stock runs low, you\'ll see notifications. Inform the manager so they can reorder items.',
        target: '.low-stock-alert',
        position: 'top',
        tip: 'Proactive communication helps prevent disappointed customers'
      }
    ]
  }
];

export const TutorialManager: React.FC<TutorialManagerProps> = ({
  userRole,
  onTutorialComplete
}) => {
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);
  const [showTutorialList, setShowTutorialList] = useState(false);

  useEffect(() => {
    // Load completed tutorials from localStorage
    const completed = localStorage.getItem(`tutorials_completed_${userRole}`) || '[]';
    setCompletedTutorials(JSON.parse(completed));
  }, [userRole]);

  const saveTutorialProgress = (tutorialId: string) => {
    const updated = [...completedTutorials, tutorialId];
    setCompletedTutorials(updated);
    localStorage.setItem(`tutorials_completed_${userRole}`, JSON.stringify(updated));
    onTutorialComplete(tutorialId);
  };

  const startTutorial = (tutorial: Tutorial) => {
    // Check prerequisites
    if (tutorial.prerequisite) {
      const hasPrerequisites = tutorial.prerequisite.every(id => 
        completedTutorials.includes(id)
      );
      if (!hasPrerequisites) {
        alert('Please complete the prerequisite tutorials first.');
        return;
      }
    }

    setActiveTutorial(tutorial);
    setShowTutorialList(false);
  };

  const handleTutorialComplete = () => {
    if (activeTutorial) {
      saveTutorialProgress(activeTutorial.id);
    }
    setActiveTutorial(null);
  };

  const handleTutorialSkip = () => {
    setActiveTutorial(null);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'basics': return <BookOpen className="h-5 w-5" />;
      case 'orders': return <ShoppingCart className="h-5 w-5" />;
      case 'inventory': return <Settings className="h-5 w-5" />;
      case 'advanced': return <Users className="h-5 w-5" />;
      default: return <Play className="h-5 w-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'basics': return 'bg-blue-100 text-blue-800';
      case 'orders': return 'bg-green-100 text-green-800';
      case 'inventory': return 'bg-orange-100 text-orange-800';
      case 'advanced': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const availableTutorials = cashierTutorials;
  const totalTutorials = availableTutorials.length;
  const completedCount = completedTutorials.length;
  const progressPercentage = (completedCount / totalTutorials) * 100;

  return (
    <>
      {/* Tutorial List Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowTutorialList(!showTutorialList)}
        className="fixed top-4 left-4 z-50 flex items-center gap-2"
      >
        <Play className="h-4 w-4" />
        Tutorials ({completedCount}/{totalTutorials})
      </Button>

      {/* Tutorial List Modal */}
      {showTutorialList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Cashier Training Tutorials
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTutorialList(false)}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Complete these tutorials to master the POS system. Progress: {completedCount}/{totalTutorials} ({Math.round(progressPercentage)}%)
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {availableTutorials.map((tutorial) => {
                  const isCompleted = completedTutorials.includes(tutorial.id);
                  const hasPrerequisites = tutorial.prerequisite?.every(id => 
                    completedTutorials.includes(id)
                  ) ?? true;
                  
                  return (
                    <Card 
                      key={tutorial.id} 
                      className={`transition-all ${
                        isCompleted ? 'bg-green-50 border-green-200' : 
                        !hasPrerequisites ? 'bg-gray-50 border-gray-200 opacity-60' : 
                        'hover:bg-blue-50 cursor-pointer'
                      }`}
                      onClick={() => hasPrerequisites ? startTutorial(tutorial) : null}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {tutorial.icon}
                            <CardTitle className="text-lg">{tutorial.name}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getCategoryColor(tutorial.category)}>
                              {tutorial.category}
                            </Badge>
                            {isCompleted && (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                        </div>
                        <CardDescription className="flex items-center gap-4">
                          <span>{tutorial.description}</span>
                          <Badge variant="outline">{tutorial.estimatedTime} min</Badge>
                        </CardDescription>
                      </CardHeader>
                      
                      {!hasPrerequisites && (
                        <CardContent className="pt-0">
                          <p className="text-sm text-gray-600">
                            Prerequisites required: {tutorial.prerequisite?.join(', ')}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Tutorial Overlay */}
      {activeTutorial && (
        <TutorialOverlay
          steps={activeTutorial.steps}
          isActive={!!activeTutorial}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
          tutorialName={activeTutorial.name}
        />
      )}
    </>
  );
};