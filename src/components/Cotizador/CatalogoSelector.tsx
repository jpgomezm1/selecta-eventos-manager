import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CatalogoSelectorProps<T> = {
  titulo: string;
  items: T[];
  itemKey: keyof T; // "id"
  renderTitle: (item: T) => string;
  renderBadge?: (item: T) => string | undefined;
  renderPrice: (item: T) => number;
  onAdd: (item: T) => void;
};

export function CatalogoSelector<T extends Record<string, any>>({
  titulo,
  items,
  itemKey,
  renderTitle,
  renderBadge,
  renderPrice,
  onAdd,
}: CatalogoSelectorProps<T>) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {items.map((it) => {
              const id = String(it[itemKey]);
              const title = renderTitle(it);
              const price = renderPrice(it);
              const badge = renderBadge?.(it);
              return (
                <AccordionItem key={id} value={id} className="border-b">
                  <div className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{title}</div>
                      <div className="text-sm text-slate-500">${price.toLocaleString()}</div>
                      {badge && <Badge className="mt-1">{badge}</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <AccordionTrigger className="px-3 py-1 rounded-md text-sm hover:no-underline">
                        Detalles
                      </AccordionTrigger>
                      <Button size="sm" onClick={() => onAdd(it)}>
                        Añadir
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="text-sm text-slate-600">
                    {/* Espacio para más detalles si luego quieres enriquecerse */}
                    Item ID: {id}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
