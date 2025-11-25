"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/trpc/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import AvatarUpload from "@/components/avatar-upload";
import { User } from "@supabase/supabase-js";

export default function SettingsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const supabase = createClient();

  // Profile state
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // AI Settings state
  const [modelProvider, setModelProvider] = useState<"openrouter" | "local">(
    "openrouter"
  );
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState(
    "anthropic/claude-3.5-sonnet"
  );
  const [localModelUrl, setLocalModelUrl] = useState("");
  const [localModelName, setLocalModelName] = useState("");

  const { data: settings, isLoading } = useQuery(
    trpc.settings.get.queryOptions()
  );
  const upsertMutation = useMutation(
    trpc.settings.upsert.mutationOptions({
      onSuccess: () => {
        toast.success("Settings saved successfully!");
        router.refresh();
      },
      onError: (error) => {
        toast.error(`Failed to save settings: ${error.message}`);
      },
    })
  );

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        setFullName(user.user_metadata.full_name || "");
        setAvatarUrl(user.user_metadata.avatar_url || "");
      }
    };
    getUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings) {
      setModelProvider(settings.modelProvider as "openrouter" | "local");
      setOpenrouterApiKey(settings.openrouterApiKey || "");
      setOpenrouterModel(
        settings.openrouterModel || "anthropic/claude-3.5-sonnet"
      );
      setLocalModelUrl(settings.localModelUrl || "");
      setLocalModelName(settings.localModelName || "");
    }
  }, [settings]);

  const handleUpdateProfile = async () => {
    setUpdatingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        avatar_url: avatarUrl,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated successfully");
      router.refresh();
    }
    setUpdatingProfile(false);
  };

  const handleSave = () => {
    upsertMutation.mutate({
      modelProvider,
      openrouterApiKey:
        modelProvider === "openrouter" ? openrouterApiKey : undefined,
      openrouterModel:
        modelProvider === "openrouter" ? openrouterModel : undefined,
      localModelUrl: modelProvider === "local" ? localModelUrl : undefined,
      localModelName: modelProvider === "local" ? localModelName : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your account and AI preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Update your profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4">
            <Label>Profile Picture</Label>
            <AvatarUpload
              uid={user?.id || null}
              url={avatarUrl}
              onUpload={(url) => setAvatarUrl(url)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarUrl">Avatar URL (Optional)</Label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
            />
            <p className="text-xs text-muted-foreground">
              You can also manually enter a URL if you prefer not to upload.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleUpdateProfile} disabled={updatingProfile}>
              {updatingProfile && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Model Configuration</CardTitle>
          <CardDescription>
            Choose between OpenRouter or a local model endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Model Provider</Label>
            <RadioGroup
              value={modelProvider}
              onValueChange={(value) =>
                setModelProvider(value as "openrouter" | "local")
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="openrouter" id="openrouter" />
                <Label
                  htmlFor="openrouter"
                  className="font-normal cursor-pointer"
                >
                  OpenRouter (Cloud)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="local" id="local" />
                <Label htmlFor="local" className="font-normal cursor-pointer">
                  Local Model (Self-hosted)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {modelProvider === "openrouter" && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="openrouterApiKey">OpenRouter API Key</Label>
                <Input
                  id="openrouterApiKey"
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={openrouterApiKey}
                  onChange={(e) => setOpenrouterApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    OpenRouter
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openrouterModel">Model</Label>
                <Select
                  value={openrouterModel}
                  onValueChange={setOpenrouterModel}
                >
                  <SelectTrigger id="openrouterModel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="z-ai/glm-4.6">
                      GLM-4.6 (Recommended)
                    </SelectItem>
                    <SelectItem value="z-ai/glm-4.5-air:free">
                      GLM-4.5-AIR
                    </SelectItem>
                    <SelectItem value="minimax/minimax-m2">
                      MiniMax M2 (#2 for Programming)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {modelProvider === "local" && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="localModelUrl">Local Model URL</Label>
                <Input
                  id="localModelUrl"
                  type="url"
                  placeholder="http://localhost:1234/v1"
                  value={localModelUrl}
                  onChange={(e) => setLocalModelUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL of your OpenAI-compatible local model endpoint (e.g., LM
                  Studio, Ollama)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="localModelName">Model Name</Label>
                <Input
                  id="localModelName"
                  type="text"
                  placeholder="llama-3.1-70b"
                  value={localModelName}
                  onChange={(e) => setLocalModelName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The model identifier used by your local endpoint
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
