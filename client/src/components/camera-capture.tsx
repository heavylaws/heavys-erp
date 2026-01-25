import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Camera, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CameraCaptureProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCapture: (file: File) => void;
}

export function CameraCapture({ open, onOpenChange, onCapture }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (open) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [open]);

    const startCamera = async () => {
        // Check for secure context (HTTPS or localhost)
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            toast({
                title: "Security Information",
                description: "Webcam access requires a secure connection (HTTPS) or localhost. If you are on the server machine, please use http://localhost:5003",
                variant: "destructive"
            });
            onOpenChange(false);
            return;
        }

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Prefer rear camera if available
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err: any) {
            console.error("Camera error:", err);
            toast({
                title: "Camera Access Error",
                description: "Could not access camera. Please check browser permissions and ensure no other app is using it.",
                variant: "destructive"
            });
            onOpenChange(false);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                        onCapture(file);
                        onOpenChange(false);
                    }
                }, 'image/jpeg', 0.8);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Take Photo</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center space-y-4">
                    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <canvas ref={canvasRef} className="hidden" />

                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={capturePhoto}>
                            <Camera className="mr-2 h-4 w-4" /> Capture
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
