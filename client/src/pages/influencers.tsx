import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfluencerAvatar } from "@/components/influencer-avatar";
import { StarRating } from "@/components/star-rating";
import { SocialBadge } from "@/components/social-badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, Link as LinkIcon, Users, X, Megaphone, DollarSign, TrendingUp } from "lucide-react";
import type { InfluencerWithSocials, InsertInfluencer, InsertSocialAccount } from "@shared/schema";

const influencerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  profileImageUrl: z.string().optional().or(z.literal("")),
  gender: z.enum(["female", "male"]).optional(),
  internalRating: z.number().min(0).max(5).default(0),
  internalNotes: z.string().optional().or(z.literal("")),
});

type InfluencerFormData = z.infer<typeof influencerFormSchema>;

const socialAccountSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "snapchat", "youtube"]),
  handle: z.string().min(1, "Handle is required"),
  followersCount: z.number().min(0).default(0),
});

type SocialAccountFormData = z.infer<typeof socialAccountSchema>;

interface InfluencerWithStats extends InfluencerWithSocials {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCost: number;
  totalRevenue: number;
  roas: number;
}

function InfluencerCard({
  influencer,
  onEdit,
  onDelete,
}: {
  influencer: InfluencerWithStats;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const gender = (influencer as any).gender;
  const bgColor = gender === "female" 
    ? "bg-pink-50 dark:bg-pink-950/20" 
    : gender === "male" 
    ? "bg-blue-50 dark:bg-blue-950/20" 
    : "";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <Card className={`hover-elevate ${bgColor}`} data-testid={`card-influencer-${influencer.id}`}>
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        {influencer.profileImageUrl ? (
          <img 
            src={influencer.profileImageUrl} 
            alt={influencer.name}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <InfluencerAvatar
            name={influencer.name}
            imageUrl={influencer.profileImageUrl}
            size="lg"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate" data-testid="text-influencer-name">
            {influencer.name}
          </h3>
          {influencer.email && (
            <p className="text-sm text-muted-foreground truncate">{influencer.email}</p>
          )}
          <div className="mt-1">
            <StarRating rating={influencer.internalRating || 0} size="sm" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {influencer.socialAccounts && influencer.socialAccounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {influencer.socialAccounts.map((account) => (
              <SocialBadge
                key={account.id}
                platform={account.platform}
                handle={account.handle}
                followersCount={account.followersCount || 0}
              />
            ))}
          </div>
        )}
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div className="flex items-center gap-1 text-sm">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Campaigns:</span>
            <span className="font-medium">{influencer.activeCampaigns}/{influencer.totalCampaigns}</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">ROAS:</span>
            <span className={`font-medium ${influencer.roas >= 1 ? "text-green-600" : influencer.roas > 0 ? "text-red-600" : ""}`}>
              {influencer.roas.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <DollarSign className="h-4 w-4 text-red-500" />
            <span className="text-muted-foreground">Coût:</span>
            <span className="font-medium">{formatCurrency(influencer.totalCost)}</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Rev:</span>
            <span className="font-medium">{formatCurrency(influencer.totalRevenue)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          data-testid="button-edit-influencer"
        >
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
          data-testid="button-delete-influencer"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}



function SocialAccountForm({
  onAdd,
}: {
  onAdd: (data: SocialAccountFormData) => void;
}) {
  const form = useForm<SocialAccountFormData>({
    resolver: zodResolver(socialAccountSchema),
    defaultValues: {
      platform: "instagram",
      handle: "",
      followersCount: 0,
    },
  });

  const onSubmit = (data: SocialAccountFormData) => {
    onAdd(data);
    form.reset();
  };

  return (
    <div className="space-y-4 p-4 border rounded-md bg-muted/30">
      <h4 className="font-medium text-sm">Add Social Account</h4>
      <div className="grid grid-cols-3 gap-3">
        <Select
          value={form.watch("platform")}
          onValueChange={(v) => form.setValue("platform", v as any)}
        >
          <SelectTrigger data-testid="select-platform">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
<SelectContent>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="snapchat">Snapchat</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="handle"
          value={form.watch("handle")}
          onChange={(e) => form.setValue("handle", e.target.value.replace("@", ""))}
          data-testid="input-social-handle"
        />
        <Input
          type="number"
          placeholder="Followers"
          value={form.watch("followersCount") || ""}
          onChange={(e) => form.setValue("followersCount", parseInt(e.target.value) || 0)}
          data-testid="input-followers"
        />
      </div>
      <Button
        type="button"
        size="sm"
        onClick={form.handleSubmit(onSubmit)}
        data-testid="button-add-social"
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Account
      </Button>
    </div>
  );
}

function InfluencerFormDialog({
  influencer,
  open,
  onOpenChange,
}: {
  influencer?: InfluencerWithSocials;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();


const [socialAccounts, setSocialAccounts] = useState<SocialAccountFormData[]>(
    influencer?.socialAccounts?.map((a) => ({
      platform: a.platform as "instagram" | "tiktok" | "snapchat" | "youtube",
      handle: a.handle,
      followersCount: a.followersCount || 0,
    })) || []
  );



  const [imageInputType, setImageInputType] = useState<"url" | "upload">("url");

const form = useForm<InfluencerFormData>({
    resolver: zodResolver(influencerFormSchema),
    defaultValues: {
      name: influencer?.name || "",
      email: influencer?.email || "",
      profileImageUrl: influencer?.profileImageUrl || "",
      gender: (influencer as any)?.gender || undefined,
      internalRating: influencer?.internalRating || 0,
      internalNotes: influencer?.internalNotes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InfluencerFormData & { socialAccounts: SocialAccountFormData[] }) => {
      const response = await apiRequest("POST", "/api/influencers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers"] });
      toast({ title: "Influencer created successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to create influencer", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InfluencerFormData & { socialAccounts: SocialAccountFormData[] }) => {
      const response = await apiRequest("PATCH", `/api/influencers/${influencer?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers"] });
      toast({ title: "Influencer updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update influencer", variant: "destructive" });
    },
  });

  const onSubmit = (data: InfluencerFormData) => {
    const payload = { ...data, socialAccounts };
    if (influencer) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleAddSocialAccount = (account: SocialAccountFormData) => {
    setSocialAccounts((prev) => [...prev, account]);
  };

  const handleRemoveSocialAccount = (index: number) => {
    setSocialAccounts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {influencer ? "Edit Influencer" : "Add New Influencer"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">





{/* Photo + Name + Rating sur la même ligne */}
            <div className="flex items-start gap-4">
              {/* Photo upload */}
              <div className="flex flex-col items-center">
                <div 
                  className="h-24 w-24 rounded-full bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 overflow-hidden"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  {form.watch("profileImageUrl") ? (
                    <img 
                      src={form.watch("profileImageUrl")} 
                      alt="Profile" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground text-center px-2">Importer une photo</span>
                  )}
                </div>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"




onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    if (file.size > 2 * 1024 * 1024) {
                      alert("L'image doit faire moins de 2 Mo");
                      return;
                    }
                    
                    const formData = new FormData();
                    formData.append("image", file);
                    
                    try {
                      const response = await fetch("/api/upload-image", {
                        method: "POST",
                        body: formData,
                      });
                      const data = await response.json();
                      if (data.url) {
                        form.setValue("profileImageUrl", data.url);
                      } else {
                        alert("Erreur lors de l'upload");
                      }
                    } catch (err) {
                      console.error("Upload error:", err);
                      alert("Erreur lors de l'upload");
                    }
                  }}




                />
              </div>

              {/* Name + Rating */}
              <div className="flex-1 space-y-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Sarah Mode" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="internalRating"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormLabel>Rating</FormLabel>
                        <StarRating
                          rating={field.value || 0}
                          size="lg"
                          interactive
                          onChange={field.onChange}
                        />
                        <button
                          type="button"
                          className="text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => field.onChange(0)}
                        >
                          Reset.
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Gender */}
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-4">
                    <FormLabel>Gender*</FormLabel>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="female"
                          checked={field.value === "female"}
                          onChange={() => field.onChange("female")}
                          className="h-4 w-4"
                        />
                        <span>Female</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="male"
                          checked={field.value === "male"}
                          onChange={() => field.onChange("male")}
                          className="h-4 w-4"
                        />
                        <span>Male</span>
                      </label>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="sarah@example.com"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />






            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes about this influencer..."
                      {...field}
                      value={field.value || ""}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <h4 className="font-medium">Social Accounts</h4>
              {socialAccounts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {socialAccounts.map((account, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <SocialBadge
                        platform={account.platform}
                        handle={account.handle}
                        followersCount={account.followersCount}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveSocialAccount(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <SocialAccountForm onAdd={handleAddSocialAccount} />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-influencer">
                {isPending ? "Saving..." : influencer ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Influencers() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState<InfluencerWithSocials | undefined>();
  const { toast } = useToast();

const { data: influencers, isLoading } = useQuery<InfluencerWithStats[]>({
    queryKey: ["/api/influencers/stats"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/influencers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/influencers"] });
      toast({ title: "Influencer deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete influencer", variant: "destructive" });
    },
  });

  const handleEdit = (influencer: InfluencerWithSocials) => {
    setEditingInfluencer(influencer);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingInfluencer(undefined);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this influencer?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Influencers</h1>
          <p className="text-muted-foreground">
            Manage your influencer partnerships and profiles
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-add-influencer">
          <Plus className="h-4 w-4 mr-2" />
          Add Influencer
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <InfluencerCardSkeleton key={i} />
          ))}
        </div>
      ) : !influencers || influencers.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No influencers yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your first influencer to start tracking their performance.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Influencer
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {influencers.map((influencer) => (
            <InfluencerCard
              key={influencer.id}
              influencer={influencer}
              onEdit={() => handleEdit(influencer)}
              onDelete={() => handleDelete(influencer.id)}
            />
          ))}
        </div>
      )}

      <InfluencerFormDialog
        influencer={editingInfluencer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
