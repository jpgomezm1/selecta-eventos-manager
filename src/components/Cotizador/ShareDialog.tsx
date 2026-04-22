import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  LinkIcon,
  Unlink,
} from "lucide-react";
import {
  getShareToken,
  createShareToken,
  deactivateShareToken,
  type ShareToken,
} from "@/integrations/supabase/apiShare";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacionId: string;
  cotizacionName: string;
  versiones: Array<{ id: string; nombre_opcion: string }>;
}

export function ShareDialog({
  open,
  onOpenChange,
  cotizacionId,
  cotizacionName,
  versiones,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [token, setToken] = useState<ShareToken | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const shareUrl = selectedVersion === "all"
    ? baseUrl
    : `${baseUrl}?v=${selectedVersion}`;

  const loadToken = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await getShareToken(cotizacionId);
      setToken(existing);
      if (existing) {
        setBaseUrl(`${window.location.origin}/compartido/${existing.token}`);
      }
    } catch {
      toast({
        title: "Error",
        description: "No se pudo verificar el enlace compartido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [cotizacionId, toast]);

  useEffect(() => {
    if (open) {
      loadToken();
    } else {
      // Reset state when dialog closes
      setToken(null);
      setBaseUrl("");
      setSelectedVersion("all");
      setCopied(false);
      setLoading(true);
    }
  }, [open, loadToken]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await createShareToken(cotizacionId);
      setBaseUrl(result.url);
      // Reload token to get full object
      const existing = await getShareToken(cotizacionId);
      setToken(existing);
      toast({
        title: "Enlace generado",
        description: "Ya puedes compartir la cotización",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "No se pudo generar el enlace",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeactivate() {
    if (!token) return;
    setDeactivating(true);
    try {
      await deactivateShareToken(token.id);
      setToken(null);
      setBaseUrl("");
      setSelectedVersion("all");
      toast({
        title: "Enlace desactivado",
        description: "El enlace ya no es accesible",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err.message || "No se pudo desactivar el enlace",
        variant: "destructive",
      });
    } finally {
      setDeactivating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Enlace copiado al portapapeles" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            Compartir Cotización
          </DialogTitle>
          <DialogDescription>
            {cotizacionName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
              <p className="text-sm text-slate-500">Verificando enlace...</p>
            </div>
          ) : token && baseUrl ? (
            <>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="text-sm font-mono bg-slate-50"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Version selector */}
              {versiones.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Opciones a compartir
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedVersion("all")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                        selectedVersion === "all"
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      Todas las opciones
                    </button>
                    {versiones.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVersion(v.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          selectedVersion === v.id
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {v.nombre_opcion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(shareUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir vista previa
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleDeactivate}
                  disabled={deactivating}
                >
                  {deactivating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  Desactivar enlace
                </Button>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Cualquier persona con este enlace puede ver la cotización
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                <LinkIcon className="h-7 w-7 text-blue-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium text-slate-800">
                  Genera un enlace compartible
                </p>
                <p className="text-sm text-slate-500">
                  El enlace permite ver la cotización sin necesidad de cuenta.
                  Ideal para enviar por WhatsApp o email.
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                {generating ? "Generando..." : "Generar enlace"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
