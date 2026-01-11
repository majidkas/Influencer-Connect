import { useState, useEffect } from "react";
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
import { Settings as SettingsIcon, Languages, Star, Loader2, ArrowRight } from "lucide-react";
import type { Settings } from "@shared/schema";

// Schema mis à jour avec les 5 valeurs de seuil
const settingsSchema = z.object({
  language: z.enum(["en", "fr"]),
  lossText: z.string().min(1, "Required"),
  
  star1Min: z.coerce.number().min(0),
  star1Max: z.coerce.number().min(0),
  
  star2Min: z.coerce.number().min(0),
  star2Max: z.coerce.number().min(0),
  
  star3Min: z.coerce.number().min(0),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"language" | "rating">("language");

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: (data: SettingsFormData) => apiRequest("POST", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated successfully" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      language: "fr",
      lossText: "⚠️ Loss !",
      star1Min: 0, star1Max: 1.99,
      star2Min: 2, star2Max: 2.99,
      star3Min: 3
    }
  });

  // Mise à jour du formulaire quand les données arrivent
  useEffect(() => {
    if (settings) {
      form.reset({
        language: (settings.language as "en" | "fr") || "fr",
        lossText: settings.lossText || "⚠️ Loss !",
        star1Min: settings.star1Min ?? 0,
        star1Max: settings.star1Max ?? 1.99,
        star2Min: settings.star2Min ?? 2,
        star2Max: settings.star2Max ?? 2.99,
        star3Min: settings.star3Min ?? 3,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: SettingsFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-muted-foreground" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
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
                      <Select onValueChange={field.onChange} value={field.value}>
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

          {activeTab === "rating" && (
            <Card>
              <CardHeader>
                <CardTitle>Influencer Rating Logic</CardTitle>
                <CardDescription>Define ROAS thresholds manually.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                
                {/* 1. NEGATIVE ROAS */}
                <div className="space-y-3 p-4 bg-red-50/50 border border-red-100 rounded-lg">
                  <h3 className="font-medium text-red-800 flex items-center gap-2 text-sm">
                    ⚠️ Negative ROAS (ROAS {"<"} 0)
                  </h3>
                  <FormField
                    control={form.control}
                    name="lossText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Text</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="⚠️ Loss !" className="bg-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 2. ONE STAR */}
                <div className="space-y-3 p-4 bg-muted/30 border rounded-lg">
                  <h3 className="font-medium flex items-center gap-2 text-sm">
                    <div className="flex gap-0.5">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <Star className="h-3 w-3 text-muted-foreground/20" />
                      <Star className="h-3 w-3 text-muted-foreground/20" />
                    </div>
                    1 Star Range
                  </h3>
                  <div className="flex items-center gap-4">
                    <FormField
                      control={form.control}
                      name="star1Min"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Min ROAS</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} className="bg-white" /></FormControl>
                        </FormItem>
                      )}
                    />
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-6" />
                    <FormField
                      control={form.control}
                      name="star1Max"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Max ROAS</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} className="bg-white" /></FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 3. TWO STARS */}
                <div className="space-y-3 p-4 bg-muted/30 border rounded-lg">
                  <h3 className="font-medium flex items-center gap-2 text-sm">
                    <div className="flex gap-0.5">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <Star className="h-3 w-3 text-muted-foreground/20" />
                    </div>
                    2 Stars Range
                  </h3>
                  <div className="flex items-center gap-4">
                    <FormField
                      control={form.control}
                      name="star2Min"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Min ROAS</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} className="bg-white" /></FormControl>
                        </FormItem>
                      )}
                    />
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-6" />
                    <FormField
                      control={form.control}
                      name="star2Max"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Max ROAS</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} className="bg-white" /></FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* 4. THREE STARS */}
                <div className="space-y-3 p-4 bg-muted/30 border rounded-lg">
                  <h3 className="font-medium flex items-center gap-2 text-sm">
                    <div className="flex gap-0.5">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    </div>
                    3 Stars Threshold
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground mt-2">ROAS Greater than or equal to:</span>
                    <FormField
                      control={form.control}
                      name="star3Min"
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormControl><Input type="number" step="0.01" {...field} className="bg-white" /></FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

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