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

export default function SettingsPage() {
  const router = useRouter();
  const trpc = useTRPC();
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
    <div className="max-w-4xl mx-auto w-full py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your AI model provider and preferences
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>How to Set Up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">OpenRouter (Recommended)</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>
                Sign up at{" "}
                <a
                  href="https://openrouter.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  OpenRouter.ai
                </a>
              </li>
              <li>Generate an API key from your dashboard</li>
              <li>Paste the API key above and select your preferred model</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Local Model</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>
                Set up a local model server (LM Studio, Ollama, or similar)
              </li>
              <li>Ensure the server is running and accessible</li>
              <li>Enter the endpoint URL (usually http://localhost:1234/v1)</li>
              <li>Specify the model name as configured in your local setup</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
