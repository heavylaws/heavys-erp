import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coffee } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { type CompanySettings } from "@shared/schema";

export default function Login() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/settings/company'],
  });

  const companyName = settings?.name || "Highway Cafe POS";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      console.log('Frontend: Attempting login with:', { username, password: '***' });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });

      console.log('Frontend: Login response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('Frontend: Login successful, user data:', userData);

        // Invalidate auth cache to trigger re-fetch
        const queryClient = await import('@/lib/queryClient').then(m => m.queryClient);
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

        toast({
          title: "Login Successful",
          description: `Welcome back, ${userData.firstName}!`,
          variant: "default",
        });

        // Don't reload - let React Query handle the state change
        console.log('Frontend: Login complete, React Query will update auth state');
      } else {
        const error = await response.text();
        console.log('Frontend: Login failed with response:', error);
        toast({
          title: "Login Failed",
          description: "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Frontend: Login network error:', error);
      toast({
        title: "Login Failed",
        description: "Unable to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const logoUrl = (settings as any)?.logoUrl;
    const loginSubtitle = (settings as any)?.loginSubtitle || "Please log in to continue";
    const showDemoCredentials = (settings as any)?.showDemoCredentials !== false;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center mb-8">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName}
                  className="w-20 h-20 mx-auto mb-4 rounded-full object-cover"
                />
              ) : (
                <div className="bg-primary p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <Coffee className="text-white text-2xl h-8 w-8" />
                </div>
              )}
              <h1 className="text-2xl font-bold text-neutral mb-2">{companyName}</h1>
              <p className="text-gray-600">{loginSubtitle}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full py-3"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            {showDemoCredentials && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <div><strong>Admin:</strong> admin / admin123</div>
                  <div><strong>Manager:</strong> manager / manager123</div>
                  <div><strong>Cashier:</strong> cashier / cashier123</div>
                  <div><strong>Technician:</strong> technician / tech123</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in - this should not happen in normal flow
  // The App.tsx will handle routing to appropriate dashboards
  return null;
}
