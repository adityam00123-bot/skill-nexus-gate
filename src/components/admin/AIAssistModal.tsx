import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES, SUBCATEGORY_MAP } from "@/utils/courseConstants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AIAssistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCourse: (courseData: any) => void;
}

export default function AIAssistModal({ open, onOpenChange, onAddCourse }: AIAssistModalProps) {
  const [rawInput, setRawInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<any | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!rawInput.trim()) {
      toast({ title: "Input required", description: "Please paste some raw info first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedData(null);

    try {
      const res = await fetch("/api/admin/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawInput }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      
      // Ensure arrays are strings for the simple form inputs
      if (Array.isArray(data.category)) data.category = data.category[0] || "";
      if (Array.isArray(data.subcategory)) data.subcategory = data.subcategory[0] || "";
      if (Array.isArray(data.tags)) data.tags = data.tags.join(", ");
      if (Array.isArray(data.what_you_learn)) data.what_you_learn = data.what_you_learn.join("\n");
      if (Array.isArray(data.requirements)) data.requirements = data.requirements.join("\n");

      setGeneratedData(data);
      toast({ title: "Generation successful!" });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    if (generatedData) {
      setGeneratedData({ ...generatedData, [field]: value });
    }
  };

  const handleAdd = () => {
    if (!generatedData) return;
    
    // Convert form string format back to expected spreadsheet format for BulkImport to handle
    const dataToPass = {
      ...generatedData,
      thumbnail_filename: "", // Placeholder to prompt user to upload
    };

    onAddCourse(dataToPass);
    setRawInput("");
    setGeneratedData(null);
    onOpenChange(false);
    toast({ title: "Added to batch", description: "Don't forget to upload the matching thumbnail!" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0F172A] border-[#334155] text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-400" /> AI Course Assistant
          </DialogTitle>
          <DialogDescription>
            Paste raw course info (e.g. sales copy, notes, rough title) and let Gemini structure it automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Raw Input</Label>
            <Textarea 
              placeholder="Paste course info here..." 
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="h-32 bg-[#1E293B] border-[#334155]"
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !rawInput.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating structured data...</> : "Generate with AI"}
          </Button>

          {generatedData && (
            <div className="mt-6 space-y-6 pt-6 border-t border-[#334155]">
              <h3 className="text-lg font-semibold text-white">Review Generated Data</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Title</Label>
                  <Input value={generatedData.title || ""} onChange={(e) => handleFieldChange("title", e.target.value)} className="bg-[#1E293B] border-[#334155]" />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label>Short Description</Label>
                  <Input value={generatedData.short_description || ""} onChange={(e) => handleFieldChange("short_description", e.target.value)} className="bg-[#1E293B] border-[#334155]" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Full Description</Label>
                  <Textarea value={generatedData.description || ""} onChange={(e) => handleFieldChange("description", e.target.value)} className="h-32 bg-[#1E293B] border-[#334155]" />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={generatedData.category || ""} onValueChange={(val) => handleFieldChange("category", val)}>
                    <SelectTrigger className="bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Select value={generatedData.subcategory || ""} onValueChange={(val) => handleFieldChange("subcategory", val)}>
                    <SelectTrigger className="bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Select Subcategory" /></SelectTrigger>
                    <SelectContent>
                      {(SUBCATEGORY_MAP[generatedData.category] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Price (INR)</Label>
                  <Input type="number" value={generatedData.price || ""} onChange={(e) => handleFieldChange("price", e.target.value)} className="bg-[#1E293B] border-[#334155]" />
                </div>

                <div className="space-y-2">
                  <Label>Original Price (INR)</Label>
                  <Input type="number" value={generatedData.original_price || ""} onChange={(e) => handleFieldChange("original_price", e.target.value)} className="bg-[#1E293B] border-[#334155]" />
                </div>
                
                <div className="space-y-2">
                  <Label>Instructor Name</Label>
                  <Input value={generatedData.instructor_name || ""} onChange={(e) => handleFieldChange("instructor_name", e.target.value)} className="bg-[#1E293B] border-[#334155]" />
                </div>

                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input value={generatedData.tags || ""} onChange={(e) => handleFieldChange("tags", e.target.value)} className="bg-[#1E293B] border-[#334155]" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>What You Will Learn (newline separated)</Label>
                  <Textarea value={generatedData.what_you_learn || ""} onChange={(e) => handleFieldChange("what_you_learn", e.target.value)} className="h-32 bg-[#1E293B] border-[#334155]" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Requirements (newline separated)</Label>
                  <Textarea value={generatedData.requirements || ""} onChange={(e) => handleFieldChange("requirements", e.target.value)} className="h-32 bg-[#1E293B] border-[#334155]" />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                  <Plus className="h-4 w-4" /> Add to Import Batch
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
