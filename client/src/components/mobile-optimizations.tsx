import { useEffect } from 'react';

// Mobile optimization utilities for Android tablets
export const useMobileOptimizations = () => {
  useEffect(() => {
    // Prevent zoom on input focus (Android Chrome)
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.getElementsByTagName('head')[0].appendChild(meta);

    // Prevent scrolling when touching UI elements
    const preventScrollOnTouch = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('.touch-target')) {
        e.preventDefault();
      }
    };

    // Add touch event optimizations
    document.addEventListener('touchstart', preventScrollOnTouch, { passive: false });
    
    // Clean up
    return () => {
      document.removeEventListener('touchstart', preventScrollOnTouch);
      if (meta.parentNode) {
        meta.parentNode.removeChild(meta);
      }
    };
  }, []);
};

// Touch-friendly button component
export const TouchButton = ({ 
  children, 
  onClick, 
  className = '', 
  variant = 'default',
  size = 'default',
  disabled = false,
  ...props 
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
  [key: string]: any;
}) => {
  const baseClasses = 'touch-target inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground'
  };

  const sizes = {
    default: 'h-12 px-6 py-3', // Larger for touch
    sm: 'h-10 rounded-md px-4',
    lg: 'h-14 rounded-md px-8'
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

// Audio notification for Android tablets
export const playNotificationSound = (type: 'success' | 'warning' | 'error' = 'success') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different tones for different notification types
    const frequencies = {
      success: 800,
      warning: 600,
      error: 400
    };
    
    oscillator.frequency.value = frequencies[type];
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log('Audio notification failed:', error);
  }
};

// Vibration feedback for Android devices
export const vibrateFeedback = (pattern: number | number[] = 100) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Screen orientation utilities
export const useScreenOrientation = () => {
  const isLandscape = window.innerWidth > window.innerHeight;
  const isPortrait = !isLandscape;
  
  return { isLandscape, isPortrait };
};

// Touch gesture detection
export const useTouchGestures = (onSwipeLeft?: () => void, onSwipeRight?: () => void) => {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Minimum swipe distance
      const minSwipeDistance = 100;
      
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);
};