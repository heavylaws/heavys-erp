import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Scan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";

interface BarcodeInputProps {
  products: Product[];
  onProductAdd: (product: Product) => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  inactivityTimeout?: number; // milliseconds before refocusing
  disabled?: boolean;
}

export function BarcodeInput({
  products,
  onProductAdd,
  autoFocus = false,
  placeholder = "Scan barcode...",
  className = "",
  inactivityTimeout = 3000, // default 3 seconds
  disabled = false
}: BarcodeInputProps) {
  const [barcode, setBarcode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Auto-focus the input when component mounts or autoFocus prop changes
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Inactivity timer - refocus after inactivity
  useEffect(() => {
    if (!autoFocus) return;

    const resetInactivityTimer = () => {
      // Clear existing timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      // Set new timer to refocus after inactivity
      inactivityTimerRef.current = setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }, inactivityTimeout);
    };

    // Listen for user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });

    // Start the initial timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [autoFocus, inactivityTimeout]);

  const handleBarcodeSubmit = () => {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) return;

    // Find product by barcode (case insensitive)
    const product = products.find(p =>
      p.barcode?.toLowerCase() === trimmedBarcode.toLowerCase() ||
      p.barcodes?.some(b => b.toLowerCase() === trimmedBarcode.toLowerCase())
    );

    if (product) {
      onProductAdd(product);
      toast({
        title: "Product Added",
        description: `${product.name} added to order`,
      });
    } else {
      toast({
        title: "Product Not Found",
        description: `No product found for code: "${trimmedBarcode}"`,
        variant: "destructive",
      });
    }

    // Clear the barcode and refocus
    setBarcode("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };

  return (
    <div className={`relative ${className}`}>
      <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        ref={inputRef}
        type="text"
        value={barcode}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className="pl-10 pr-4"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
        disabled={disabled}
      />
    </div>
  );
}