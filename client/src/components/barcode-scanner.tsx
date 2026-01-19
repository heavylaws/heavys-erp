import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Scan, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BarcodeScannerProps {
  onBarcodeScanned: (barcode: string) => void;
  trigger?: React.ReactNode;
}

export function BarcodeScanner({ onBarcodeScanned, trigger }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    try {
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // Use back camera on mobile
        } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera access error:", error);
      toast({
        title: "Camera Access",
        description: "Unable to access camera. Please use manual barcode entry.",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onBarcodeScanned(manualBarcode.trim());
      setManualBarcode("");
      setOpen(false);
      toast({
        title: "Barcode Entered",
        description: `Searching for product with barcode: ${manualBarcode.trim()}`,
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualSubmit();
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
    }
  }, [open]);

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Scan className="h-4 w-4 mr-2" />
      Scan Barcode
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Scan className="h-5 w-5" />
            <span>Barcode Scanner</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Manual Barcode Entry */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Enter Barcode Manually</label>
            <div className="flex space-x-2">
              <Input
                placeholder="Enter barcode number..."
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
                autoFocus
              />
              <Button onClick={handleManualSubmit} disabled={!manualBarcode.trim()}>
                Search
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or use camera</span>
            </div>
          </div>

          {/* Camera Scanner */}
          <div className="space-y-2">
            {!isScanning ? (
              <Button onClick={startCamera} className="w-full" variant="outline">
                <Camera className="h-4 w-4 mr-2" />
                Start Camera Scanner
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-2 border-primary border-dashed rounded-lg flex items-center justify-center">
                    <div className="text-white text-center p-4">
                      <Scan className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Position barcode in frame</p>
                      <p className="text-xs opacity-75">Note: Auto-detection requires additional setup</p>
                    </div>
                  </div>
                </div>
                <Button onClick={stopCamera} variant="outline" className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              </div>
            )}
          </div>

          <div className="text-xs text-gray-500 text-center">
            Tip: For fastest results, use the manual barcode entry above
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}