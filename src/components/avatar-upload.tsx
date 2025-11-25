"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  uid: string | null;
  url: string | null;
  onUpload: (url: string) => void;
}

export default function AvatarUpload({
  uid,
  url,
  onUpload,
}: AvatarUploadProps) {
  const supabase = createClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(url);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (url) setAvatarUrl(url);
  }, [url]);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      if (!uid) {
        throw new Error("User not found");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${uid}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      onUpload(publicUrl);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error uploading avatar!"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-6">
      <Avatar className="h-24 w-24">
        <AvatarImage src={avatarUrl || ""} alt="Avatar" />
        <AvatarFallback className="text-lg">{uid ? "U" : "?"}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            className="relative cursor-pointer w-full"
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload New Photo"}

            <input
              type="file"
              id="single"
              accept="image/*"
              onChange={uploadAvatar}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Recommended: Square image, max 2MB
        </p>
      </div>
    </div>
  );
}
