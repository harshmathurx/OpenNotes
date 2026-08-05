"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useAISettings } from "@/hooks/useAISettings"
import { Eye, EyeOff, ShieldCheck, Sparkles, Key } from "lucide-react"

interface AIOptionsDialogProps {
  open: boolean
  onClose: () => void
}

export function AIOptionsDialog({ open, onClose }: AIOptionsDialogProps) {
  const { settings, saveSettings } = useAISettings()
  const [activeTab, setActiveTab] = useState<string>(settings.provider)
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicKey)
  const [openaiKey, setOpenaiKey] = useState(settings.openaiKey)
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl)

  const [showAnthropic, setShowAnthropic] = useState(false)
  const [showOpenai, setShowOpenai] = useState(false)

  const handleSave = () => {
    saveSettings({
      provider: activeTab as "anthropic" | "openai" | "ollama",
      anthropicKey,
      openaiKey,
      ollamaUrl,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border/80 bg-background/95 backdrop-blur-md shadow-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5 animate-pulse" />
            <DialogTitle className="text-xl font-bold tracking-tight">
              AI Co-Writer Settings
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Configure your client-side model connection. Keys are encrypted on this device and stored only in your local browser storage.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
              <TabsTrigger
                value="anthropic"
                className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary"
              >
                Anthropic
              </TabsTrigger>
              <TabsTrigger
                value="openai"
                className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary"
              >
                OpenAI
              </TabsTrigger>
              <TabsTrigger
                value="ollama"
                className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary"
              >
                Ollama (Local)
              </TabsTrigger>
            </TabsList>

            {/* Anthropic API config */}
            <TabsContent value="anthropic" className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    Claude API Key
                  </label>
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary/80 hover:underline"
                  >
                    Get key from Anthropic
                  </a>
                </div>
                <div className="relative">
                  <Input
                    type={showAnthropic ? "text" : "password"}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="pr-10 border-border/80 bg-background/50 hover:bg-background/80 focus:bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnthropic(!showAnthropic)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAnthropic ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </TabsContent>

            {/* OpenAI API config */}
            <TabsContent value="openai" className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    OpenAI API Key
                  </label>
                  <a
                    href="https://platform.openai.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary/80 hover:underline"
                  >
                    Get key from OpenAI
                  </a>
                </div>
                <div className="relative">
                  <Input
                    type={showOpenai ? "text" : "password"}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="pr-10 border-border/80 bg-background/50 hover:bg-background/80 focus:bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenai(!showOpenai)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showOpenai ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </TabsContent>

            {/* Ollama Local config */}
            <TabsContent value="ollama" className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground/80">
                  Ollama Server URL
                </label>
                <Input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="border-border/80 bg-background/50 hover:bg-background/80 focus:bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  Make sure Ollama is running locally and CORS is enabled via{" "}
                  <code className="bg-muted px-1 py-0.5 rounded font-mono text-[9px]">
                    OLLAMA_ORIGINS=&quot;*&quot;
                  </code>
                  .
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-lg text-[11px] font-medium border border-emerald-500/20">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Keys are encrypted on this device (AES-GCM-256, device-bound) and never leave your browser. Direct client-side requests only.</span>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} className="hover:bg-muted/80">
            Cancel
          </Button>
          <Button onClick={handleSave} className="font-semibold shadow-lg">
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
