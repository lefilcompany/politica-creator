import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Instagram, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { InstagramHandleDialog } from "@/components/sidebar/InstagramHandleDialog";

export const InstagramBanner = () => {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: needsInstagram } = useQuery({
    queryKey: ['instagram-banner-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data: profile } = await supabase
        .from('profiles')
        .select('instagram_handle')
        .eq('id', user.id)
        .single();
      return !profile?.instagram_handle;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10,
  });

  if (!needsInstagram) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-[#833AB4]/5 via-[#E1306C]/5 to-[#F77737]/5 dark:from-[#833AB4]/10 dark:via-[#E1306C]/10 dark:to-[#F77737]/10 px-4 py-3 text-sm hover:from-[#833AB4]/10 hover:via-[#E1306C]/10 hover:to-[#F77737]/10 transition-all group text-left"
        >
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] flex items-center justify-center shrink-0">
            <Instagram className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">Conecte seu Instagram para personalizar o tom de voz</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Legendas, textos e imagens serão adaptados ao seu estilo de comunicação
            </span>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </motion.div>
      <InstagramHandleDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
