import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ProductionPhotoUploadProps {
  orderId?: string;
  batchId?: string;
  onUploadComplete?: () => void;
}

export const ProductionPhotoUpload = ({
  orderId,
  batchId,
  onUploadComplete,
}: ProductionPhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only JPEG, PNG, and WebP images are allowed",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || (!orderId && !batchId)) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check photo count limit (10 per order/batch)
      const { count } = await supabase
        .from("production_photos")
        .select("*", { count: "exact", head: true })
        .eq(orderId ? "so_id" : "batch_id", orderId || batchId!);

      if (count && count >= 10) {
        toast({
          title: "Photo limit reached",
          description: "Maximum 10 photos per order/batch",
          variant: "destructive",
        });
        return;
      }

      // Upload to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${orderId || batchId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("production-photos")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Create database record with file path only
      // Signed URLs will be generated on-demand when viewing
      const { error: dbError } = await supabase
        .from("production_photos")
        .insert({
          so_id: orderId || null,
          batch_id: batchId || null,
          photo_url: filePath,
          uploaded_by: user.id,
          caption: caption || null,
          file_size_bytes: selectedFile.size,
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });

      setSelectedFile(null);
      setPreview(null);
      setCaption("");
      onUploadComplete?.();
    } catch (error) {
      // Error handled silently
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Upload Production Photo</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="photo-upload">Photo (max 5MB)</Label>
          <Input
            id="photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </div>

        {preview && (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2"
              onClick={() => {
                setSelectedFile(null);
                setPreview(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div>
          <Label htmlFor="caption">Caption (optional)</Label>
          <Textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption for this photo..."
            disabled={uploading}
          />
        </div>

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Photo"}
        </Button>
      </div>
    </Card>
  );
};