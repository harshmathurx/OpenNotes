"use client"

/**
 * Extensions management modal.
 *
 * Two tabs: "Installed" lists every registered extension with its name,
 * version, description, a "built-in sample" badge, and an enable/disable
 * switch (data from useExtensions; state persists via the registry/store);
 * "Browse" shows the community registry with search and install actions
 * (see components/registry/BrowseExtensions). Styling follows SettingsModal:
 * calm sections, muted secondary text, border cards.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@base-ui/react/switch"
import { Package } from "lucide-react"
import { BrowseExtensions } from "@/components/registry/BrowseExtensions"
import { useExtensions } from "@/hooks/useExtensions"
import { cn } from "@/lib/utils"

interface ExtensionsModalProps {
  open: boolean
  onClose: () => void
}

export function ExtensionsModal({ open, onClose }: ExtensionsModalProps) {
  const { extensions, setEnabled } = useExtensions()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Extensions</DialogTitle>
          <DialogDescription>
            Manage installed extensions or browse the community registry.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="installed" className="w-full">
          <TabsList aria-label="Extensions views">
            <TabsTrigger value="installed">Installed</TabsTrigger>
            <TabsTrigger value="browse">Browse</TabsTrigger>
          </TabsList>

          <TabsContent value="installed" className="pt-3">
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {extensions.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No extensions installed.
                </p>
              )}

              {extensions.map((ext) => (
                <section
                  key={ext.manifest.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <h3 className="text-sm font-medium">{ext.manifest.name}</h3>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {ext.manifest.description}
                        </p>
                      </div>
                    </div>

                    <Switch.Root
                      checked={ext.enabled}
                      onCheckedChange={(checked) =>
                        setEnabled(ext.manifest.id, checked)
                      }
                      aria-label={`Enable ${ext.manifest.name}`}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                        "bg-input data-[checked]:bg-primary",
                        "outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      )}
                    >
                      <Switch.Thumb
                        className={cn(
                          "block h-4 w-4 rounded-full bg-background shadow transition-transform",
                          "translate-x-0.5 data-[checked]:translate-x-[1.125rem]"
                        )}
                      />
                    </Switch.Root>
                  </div>
                </section>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="browse" className="pt-3">
            <BrowseExtensions />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
