import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Languages, Star, Loader2 } from "lucide-react";
import type { Settings } from "@shared/schema";

// Schema de validation
const settingsSchema = z.object({
  language: z.enum(["en", "fr"]),
  minRoas2Stars: z.coerce.number().min(0, "Must be positive"),
  minRoas3Stars: z.coerce.number().min(0, "Must be positive"),
  lossText: z.string().min(1, "Required"),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"language" | "rating">("language");

  // Fetch Settings
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (data: SettingsFormData) => apiRequest("POST", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated successfully" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  // Form Setup
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    values: {
      language: (settings?.language as "en" | "fr") || "fr",
      minRoas2Stars: settings?.minRoas2Stars || 2.0,
      minRoas3Stars: settings?.minRoas3Stars || 4.0,
      lossText: settings?.lossText || "⚠️ Loss !",
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-muted-foreground" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">Manage your application preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-1">
        <button
          onClick={() => setActiveTab("language")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
            activeTab === "language" 
              ? "border-b-2 border-primary text-primary bg-primary/5" 
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Languages className="h-4 w-4" /> Language
        </button>
        <button
          onClick={() => setActiveTab("rating")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
            activeTab === "rating" 
              ? "border-b-2 border-primary text-primary bg-primary/5" 
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Star className="h-4 w-4" /> Rating System
        </button>
      </div>

      {/* Content */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* TAB: LANGUAGE */}
          {activeTab === "language" && (
            <Card>
              <CardHeader>
                <CardTitle>Language Preference</CardTitle>
                <CardDescription>Select the default language for the interface.</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fr">🇫🇷 Français</SelectItem>
                          <SelectItem value="en">🇺🇸 English</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* TAB: RATING SYSTEM */}
          {activeTab === "rating" && (
            <Card>
              <CardHeader>
                <CardTitle>Influencer Rating Logic</CardTitle>
                <CardDescription>
                  Define the ROAS thresholds to automatically assign stars to influencers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* 1 STAR EXPLANATION */}
                <div className="p-3 bg-muted rounded border border-dashed flex items-center gap-3">
                  <div className="flex gap-0.5">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <Star className="h-4 w-4 text-muted-foreground/20" />
                    <Star className="h-4 w-4 text-muted-foreground/20" />
                  </div>
                  <span className="text-sm">
                    <strong>1 Star:</strong> Automatically applied for ROAS between <strong>0</strong> and <strong>{form.watch("minRoas2Stars")}</strong>.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 2 STARS THRESHOLD */}
                  <FormField
                    control={form.control}
                    name="minRoas2Stars"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Min ROAS for 2 Stars
                          <div className="flex gap-0.5 scale-75">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <Star className="h-3 w-3 text-muted-foreground/20" />
                          </div>
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground">
                          Default: 2.0 (Range: {field.value} to {form.watch("minRoas3Stars")})
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 3 STARS THRESHOLD */}
                  <FormField
                    control={form.control}
                    name="minRoas3Stars"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Min ROAS for 3 Stars
                          <div className="flex gap-0.5 scale-75">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          </div>
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground">
                          Default: 4.0 (Applied if ROAS ≥ {field.value})
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* LOSS TEXT */}
                <FormField
                  control={form.control}
                  name="lossText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loss Label (if ROAS {"<"} 0)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="⚠️ Loss !" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}