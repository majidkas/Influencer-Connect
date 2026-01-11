import { useState, useEffect } from "react";
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
import { SocialBadge } from "@/components/social-badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Pencil, Trash2, X, Megaphone, DollarSign, TrendingUp, 
  MessageCircle, Mail, ShoppingBag, Upload, Star, Users 
} from "lucide-react";
import { useI18n } from "@/lib/i18nContext";
import type { InfluencerWithSocials, Settings } from "@shared/schema";

// --- CONSTANTS ---
const COUNTRY_CODES = [
  { code: "33", label: "🇫🇷 +33" },
  { code: "1", label: "🇺🇸/🇨🇦 +1" },
  { code: "44", label: "🇬🇧 +44" },
  { code: "32", label: "🇧🇪 +32" },
  { code: "41", label: "🇨🇭 +41" },
  { code: "34", label: "🇪🇸 +34" },
  { code: "49", label: "🇩🇪 +49" },
  { code: "39", label: "🇮🇹 +39" },
  { code: "212", label: "🇲🇦 +212" },
];

const influencerFormSchema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  profileImageUrl: z.string().optional().or(z.literal("")),
  gender: z.enum(["female", "male"]).optional(),
  internalNotes: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")), 
});

type InfluencerFormData = z.infer<typeof influencerFormSchema>;

const socialAccountSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "snapchat", "youtube"]),
  handle: z.string().min(1, "Required"),
  followersCount: z.number().min(0).default(0),
});

type SocialAccountFormData = z.infer<typeof socialAccountSchema>;

interface InfluencerWithStats extends InfluencerWithSocials {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCost: number;
  totalRevenue: number;
  totalOrders: number;    
  roas: number;
  calculatedRating: number; 
  whatsapp?: string;      
}

function InfluencerCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4"><Skeleton className="h-16 w-16 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-24" /></div></CardHeader>
      <CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-20" /></div></CardContent>
    </Card>
  );
}

function InfluencerCard({ influencer, onEdit, onDelete, settings }: { influencer: InfluencerWithStats; onEdit: () => void; onDelete: () => void; settings?: Settings; }) {
  const { t } = useI18n();
  const gender = (influencer as any).gender;
  const bgColor = gender === "female" ? "bg-pink-50 dark:bg-pink-950/20" : gender === "male" ? "bg-blue-50 dark:bg-blue-950/20" : "";

  const formatCurrency = (amount: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

  const renderActiveRating = (roas: number) => {
    const lossText = settings?.lossText || "⚠️ Loss !";
    const s1Min = settings?.star1Min ?? 0;
    const s1Max = settings?.star1Max ?? 1.99;
    const s2Min = settings?.star2Min ?? 2.0;
    const s2Max = settings?.star2Max ?? 2.99;
    const s3Min = settings?.star3Min ?? 3.0;

    if (roas < 0) return <span className="text-red-600 font-bold text-xs flex items-center gap-1">{lossText}</span>;

    let starCount = 0;
    if (roas >= s1Min && roas <= s1Max) starCount = 1;
    else if (roas >= s2Min && roas <= s2Max) starCount = 2;
    else if (roas >= s3Min) starCount = 3;

    return (
      <div className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <Star key={i} className={`h-4 w-4 ${i <= starCount ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
        ))}
      </div>
    );
  };

  return (
    <Card className={`hover-elevate ${bgColor}`} data-testid={`card-influencer-${influencer.id}`}>
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        {influencer.profileImageUrl ? (
          <img src={influencer.profileImageUrl} alt={influencer.name} className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm" />
        ) : (
          <InfluencerAvatar name={influencer.name} imageUrl={influencer.profileImageUrl} size="lg" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-lg truncate">{influencer.name}</h3>
            {influencer.whatsapp && (
              <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white gap-1.5 h-7 px-2 text-xs font-medium rounded-full shadow-sm" asChild>
                <a href={`https://wa.me/${influencer.whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" /> Chat</a>
              </Button>
            )}
          </div>
          {influencer.email && (
            <a href={`mailto:${influencer.email}`} className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors truncate mt-0.5">
              <Mail className="h-3 w-3 mr-1" />{influencer.email}
            </a>
          )}
          <div className="mt-2 flex items-center gap-2">
            {influencer.totalCampaigns === 0 ? (
              <>
                 <div className="flex gap-0.5">{[1, 2, 3].map((i) => <Star key={i} className="h-4 w-4 text-muted-foreground/20" />)}</div>
                 <span className="text-xs text-muted-foreground ml-1">{t("inf.new")}</span>
              </>
            ) : (
              <>
                {renderActiveRating(influencer.roas)}
                <span className="text-xs text-muted-foreground ml-1">(ROAS {influencer.roas.toFixed(2)})</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {influencer.socialAccounts && influencer.socialAccounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {influencer.socialAccounts.map((account) => <SocialBadge key={account.id} platform={account.platform} handle={account.handle} followersCount={account.followersCount || 0} />)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-3 border-t">
          <div className="flex items-center gap-2 text-sm"><Megaphone className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{t("inf.stats_camp")}</span><span className="font-medium ml-auto">{influencer.activeCampaigns}/{influencer.totalCampaigns}</span></div>
          <div className="flex items-center gap-2 text-sm"><ShoppingBag className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">{t("inf.stats_orders")}</span><span className="font-medium ml-auto">{influencer.totalOrders}</span></div>
          <div className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4 text-red-500" /><span className="text-muted-foreground">{t("inf.stats_cost")}</span><span className="font-medium ml-auto">{formatCurrency(influencer.totalCost)}</span></div>
          <div className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4 text-green-500" /><span className="text-muted-foreground">{t("inf.stats_rev")}</span><span className="font-medium ml-auto">{formatCurrency(influencer.totalRevenue)}</span></div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4 mr-1" />{t("common.edit")}</Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4 mr-1" />{t("common.delete")}</Button>
      </CardFooter>
    </Card>
  );
}

function SocialAccountForm({ onAdd }: { onAdd: (data: SocialAccountFormData) => void; }) {
  const { t } = useI18n();
  const form = useForm<SocialAccountFormData>({ resolver: zodResolver(socialAccountSchema), defaultValues: { platform: "instagram", handle: "", followersCount: 0 } });
  const onSubmit = (data: SocialAccountFormData) => { onAdd(data); form.reset(); };

  return (
    <div className="space-y-4 p-4 border rounded-md bg-muted/30">
      <h4 className="font-medium text-sm">{t("inf.form.add_social")}</h4>
      <div className="grid grid-cols-3 gap-3">
        <Select value={form.watch("platform")} onValueChange={(v) => form.setValue("platform", v as any)}>
          <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="tiktok">TikTok</SelectItem><SelectItem value="snapchat">Snapchat</SelectItem><SelectItem value="youtube">YouTube</SelectItem></SelectContent>
        </Select>
        <Input placeholder={t("inf.form.handle")} value={form.watch("handle")} onChange={(e) => form.setValue("handle", e.target.value.replace("@", ""))} />
        <Input type="number" placeholder={t("inf.form.followers")} value={form.watch("followersCount") || ""} onChange={(e) => form.setValue("followersCount", parseInt(e.target.value) || 0)} />
      </div>
      <Button type="button" size="sm" onClick={form.handleSubmit(onSubmit)}><Plus className="h-4 w-4 mr-1" />{t("inf.form.add_social")}</Button>
    </div>
  );
}

function InfluencerFormDialog({ influencer, open, onOpenChange }: { influencer?: InfluencerWithSocials & { whatsapp?: string }; open: boolean; onOpenChange: (open: boolean) => void; }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountFormData[]>([]);
  const [phonePrefix, setPhonePrefix] = useState("33");
  const [phoneNumber, setPhoneNumber] = useState("");

  const form = useForm<InfluencerFormData>({ resolver: zodResolver(influencerFormSchema), defaultValues: { name: "", email: "", profileImageUrl: "", gender: undefined, internalNotes: "", whatsapp: "" } });

  useEffect(() => {
    if (open) {
      form.reset({ name: influencer?.name || "", email: influencer?.email || "", profileImageUrl: influencer?.profileImageUrl || "", gender: (influencer as any)?.gender || undefined, internalNotes: influencer?.internalNotes || "", whatsapp: influencer?.whatsapp || "" });
      setSocialAccounts(influencer?.socialAccounts?.map((a) => ({ platform: a.platform as any, handle: a.handle, followersCount: a.followersCount || 0 })) || []);
      if (influencer?.whatsapp) {
        const foundCode = COUNTRY_CODES.find(c => influencer.whatsapp?.startsWith(c.code));
        if (foundCode) { setPhonePrefix(foundCode.code); setPhoneNumber(influencer.whatsapp.slice(foundCode.code.length)); } else { setPhoneNumber(influencer.whatsapp); }
      } else { setPhonePrefix("33"); setPhoneNumber(""); }
    }
  }, [open, influencer, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InfluencerFormData & { socialAccounts: SocialAccountFormData[] }) => { const response = await apiRequest("POST", "/api/influencers", data); return response.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/influencers/stats"] }); toast({ title: t("inf.created") }); onOpenChange(false); },
    onError: () => { toast({ title: t("common.failed"), variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InfluencerFormData & { socialAccounts: SocialAccountFormData[] }) => { const response = await apiRequest("PATCH", `/api/influencers/${influencer?.id}`, data); return response.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/influencers/stats"] }); toast({ title: t("inf.updated") }); onOpenChange(false); },
    onError: () => { toast({ title: t("common.failed"), variant: "destructive" }); },
  });

  const onSubmit = (data: InfluencerFormData) => {
    let finalWhatsapp = ""; if (phoneNumber) { finalWhatsapp = `${phonePrefix}${phoneNumber.replace(/^0+/, "")}`; }
    const payload = { ...data, whatsapp: finalWhatsapp, socialAccounts };
    if (influencer) updateMutation.mutate(payload); else createMutation.mutate(payload);
  };

  const handleAddSocialAccount = (account: SocialAccountFormData) => { setSocialAccounts((prev) => [...prev, account]); };
  const handleRemoveSocialAccount = (index: number) => { setSocialAccounts((prev) => prev.filter((_, i) => i !== index)); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{influencer ? t("inf.form.edit_title") : t("inf.form.add_title")}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 overflow-hidden border border-border" onClick={() => document.getElementById('photo-upload')?.click()}>
                  {form.watch("profileImageUrl") ? <img src={form.watch("profileImageUrl")} alt="Profile" className="h-full w-full object-cover" /> : <div className="text-center p-2"><Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">{t("inf.form.upload")}</span></div>}
                </div>
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { alert("Max size 2MB"); return; }
                    const formData = new FormData(); formData.append("image", file);
                    try { const response = await fetch("/api/upload-image", { method: "POST", body: formData }); const data = await response.json(); if (data.url) form.setValue("profileImageUrl", data.url); } catch (err) { console.error(err); }
                  }}
                />
              </div>
              <div className="flex-1 space-y-3">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t("inf.form.name")}</FormLabel><FormControl><Input placeholder="Sarah Mode" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="space-y-2"><FormLabel>{t("inf.form.whatsapp")}</FormLabel><div className="flex gap-2"><Select value={phonePrefix} onValueChange={setPhonePrefix}><SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger><SelectContent>{COUNTRY_CODES.map((c) => (<SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>))}</SelectContent></Select><Input placeholder="612345678" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))} className="flex-1" /></div></div>
              </div>
            </div>
            <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><div className="flex items-center gap-4"><FormLabel>{t("inf.form.gender")}</FormLabel><div className="flex items-center gap-4"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="female" checked={field.value === "female"} onChange={() => field.onChange("female")} className="h-4 w-4 accent-pink-500" /><span>{t("inf.form.female")}</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="gender" value="male" checked={field.value === "male"} onChange={() => field.onChange("male")} className="h-4 w-4 accent-blue-500" /><span>{t("inf.form.male")}</span></label></div></div><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>{t("inf.form.email")}</FormLabel><FormControl><Input type="email" placeholder="sarah@example.com" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="internalNotes" render={({ field }) => (<FormItem><FormLabel>{t("inf.form.notes")}</FormLabel><FormControl><Textarea placeholder="Notes..." {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>)} />
            <div className="space-y-3 pt-2 border-t"><h4 className="font-medium">{t("inf.form.socials")}</h4>{socialAccounts.length > 0 && (<div className="flex flex-wrap gap-2">{socialAccounts.map((account, index) => (<div key={index} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full text-sm"><SocialBadge platform={account.platform} handle={account.handle} followersCount={account.followersCount} /><Button type="button" variant="ghost" size="icon" className="h-5 w-5 rounded-full ml-1" onClick={() => handleRemoveSocialAccount(index)}><X className="h-3 w-3" /></Button></div>))}</div>)}<SocialAccountForm onAdd={handleAddSocialAccount} /></div>
            <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={isPending || updateMutation.isPending}>{influencer ? t("common.update") : t("common.create")}</Button></div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Influencers() {
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState<InfluencerWithStats | undefined>();
  const { toast } = useToast();
  const { data: influencers, isLoading } = useQuery<InfluencerWithStats[]>({ queryKey: ["/api/influencers/stats"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/influencers/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/influencers/stats"] }); toast({ title: t("common.deleted") }); },
    onError: () => { toast({ title: t("common.failed"), variant: "destructive" }); },
  });

  const handleEdit = (influencer: InfluencerWithStats) => { setEditingInfluencer(influencer); setDialogOpen(true); };
  const handleCreate = () => { setEditingInfluencer(undefined); setDialogOpen(true); };
  const handleDelete = (id: string) => { if (confirm(t("common.confirm_delete"))) { deleteMutation.mutate(id); } };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-semibold">{t("inf.title")}</h1><p className="text-muted-foreground">{t("inf.subtitle")}</p></div>
        <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />{t("inf.add_btn")}</Button>
      </div>
      {isLoading ? (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => (<InfluencerCardSkeleton key={i} />))}</div>) : !influencers || influencers.length === 0 ? (<Card className="p-12"><div className="text-center"><Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-medium mb-2">{t("inf.no_influencers")}</h3><p className="text-muted-foreground text-sm mb-4">{t("inf.empty_desc")}</p><Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />{t("inf.add_btn")}</Button></div></Card>) : (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{influencers.map((influencer) => (<InfluencerCard key={influencer.id} influencer={influencer} settings={settings} onEdit={() => handleEdit(influencer)} onDelete={() => handleDelete(influencer.id)} />))}</div>)}
      <InfluencerFormDialog influencer={editingInfluencer} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}