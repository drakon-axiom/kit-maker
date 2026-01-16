import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera } from "lucide-react";

interface QRCodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function QRCodeScanner({ onScan, onClose }: QRCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const containerId = "qr-reader";

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    // Get available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera on mobile
          const backCameraIndex = devices.findIndex(
            (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")
          );
          const startIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
          setCurrentCameraIndex(startIndex);
          startScanning(scanner, devices[startIndex].id);
        } else {
          setError("No cameras found on this device");
        }
      })
      .catch((err) => {
        setError("Camera access denied. Please allow camera permissions.");
        console.error("Camera access error:", err);
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = async (scanner: Html5Qrcode, cameraId: string) => {
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      
      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Vibrate on successful scan if supported
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
          onScan(decodedText);
        },
        () => {
          // Ignore scan errors (no QR code found)
        }
      );
      setError(null);
    } catch (err) {
      setError("Failed to start camera. Please try again.");
      console.error("Scanner start error:", err);
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1 || !scannerRef.current) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanning(scannerRef.current, cameras[nextIndex].id);
  };

  const handleClose = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop().catch(console.error);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          <span className="font-medium">Scan QR Code</span>
        </div>
        <div className="flex gap-2">
          {cameras.length > 1 && (
            <Button variant="outline" size="icon" onClick={switchCamera}>
              <SwitchCamera className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div 
              id={containerId} 
              className="w-full rounded-lg overflow-hidden"
            />
            <p className="text-center text-sm text-muted-foreground mt-4">
              Position the QR code within the frame to scan
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
