import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

interface ProductionPhotosGalleryProps {
  orderId?: string;
  batchId?: string;
}

export const ProductionPhotosGallery = ({
  orderId,
  batchId,
}: ProductionPhotosGalleryProps) => {
  const { data: photos, isLoading } = useQuery({
    queryKey: ["production-photos", orderId, batchId],
    queryFn: async () => {
      let query = supabase
        .from("production_photos")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (orderId) {
        query = query.eq("so_id", orderId);
      }
      if (batchId) {
        query = query.eq("batch_id", batchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get signed URLs for all photos
      const photosWithUrls = await Promise.all(
        (data || []).map(async (photo) => {
          const { data: { signedUrl } } = await supabase.storage
            .from("production-photos")
            .createSignedUrl(photo.photo_url, 3600);

          return {
            ...photo,
            signedUrl,
          };
        })
      );

      return photosWithUrls;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (!photos || photos.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No photos yet</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <Card key={photo.id} className="overflow-hidden">
          <div className="aspect-square relative">
            <img
              src={photo.signedUrl || ""}
              alt={photo.caption || "Production photo"}
              className="w-full h-full object-cover"
            />
          </div>
          {photo.caption && (
            <div className="p-2">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {photo.caption}
              </p>
            </div>
          )}
          <div className="px-2 pb-2">
            <p className="text-xs text-muted-foreground">
              {format(new Date(photo.uploaded_at), "MMM d, yyyy h:mm a")}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
};