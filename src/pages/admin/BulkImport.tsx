import React, { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, CheckCircle2, XCircle, Loader2, FileSpreadsheet, ImageIcon, AlertTriangle, Wand2, RefreshCw, SkipForward, PlusCircle } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { CATEGORIES, SUBCATEGORY_MAP, DEFAULT_LEARN, DEFAULT_REQUIREMENTS, DEFAULT_TAGS } from "@/utils/courseConstants";
import { Link } from "react-router-dom";
import AIAssistModal from "@/components/admin/AIAssistModal";

type RowStatus = "pending" | "processing" | "created" | "updated" | "skipped" | "error";

type ImportedRow = {
  originalIndex: number;
  data: any;
  status: RowStatus;
  errorReason?: string;
  changeDetails?: string;
  matchedFile?: File;
};

const EXPECTED_HEADERS = [
  "title", "description", "short_description", "price", "original_price", 
  "instructor_name", "instructor_bio", "category", "subcategory", "level", 
  "language", "duration_hours", "total_lectures", "tags", "what_you_learn", 
  "requirements", "thumbnail_filename"
];

// Helper to split strings by a delimiter
const splitBy = (val: any, char: string): string[] | null => {
  if (!val) return null;
  if (typeof val !== "string") return [val.toString()];
  return val.split(char).map((s: string) => s.trim()).filter(Boolean);
};

// Compare two values for equality (handles arrays, nulls, numbers)
const isEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  // Both are arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  }

  // One is array, other isn't
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  // Numbers — compare as numbers
  if (typeof a === "number" || typeof b === "number") {
    return Number(a) === Number(b);
  }

  // Strings — trim and compare
  if (typeof a === "string" && typeof b === "string") {
    return a.trim() === b.trim();
  }

  return String(a) === String(b);
};

// Build a human-readable diff summary and the update payload
const diffCourse = (
  existing: any,
  newPayload: any,
  skipThumbnail: boolean
): { changes: Record<string, any>; summary: string } => {
  const COMPARE_FIELDS = [
    "description", "short_description", "price", "original_price",
    "instructor_name", "instructor_bio", "category", "subcategory",
    "level", "language", "duration_hours", "total_lectures",
    "tags", "what_you_learn", "requirements",
  ];

  const changes: Record<string, any> = {};
  const summaryParts: string[] = [];

  for (const field of COMPARE_FIELDS) {
    const oldVal = existing[field];
    const newVal = newPayload[field];

    // Skip if new value is null/undefined — don't clear existing data
    if (newVal == null) continue;

    if (!isEqual(oldVal, newVal)) {
      changes[field] = newVal;

      // Build human-readable summary
      if (Array.isArray(newVal)) {
        summaryParts.push(`${field} updated`);
      } else if (typeof newVal === "string" && newVal.length > 80) {
        summaryParts.push(`${field} updated`);
      } else if (field === "price" || field === "original_price") {
        summaryParts.push(`${field}: ₹${oldVal ?? 0} → ₹${newVal}`);
      } else {
        const oldDisplay = oldVal != null ? String(oldVal) : "(empty)";
        const newDisplay = String(newVal);
        if (oldDisplay.length > 40 || newDisplay.length > 40) {
          summaryParts.push(`${field} updated`);
        } else {
          summaryParts.push(`${field}: ${oldDisplay} → ${newDisplay}`);
        }
      }
    }
  }

  // Thumbnail — only include if we have a new URL
  if (!skipThumbnail && newPayload.thumbnail_url) {
    if (!isEqual(existing.thumbnail_url, newPayload.thumbnail_url)) {
      changes.thumbnail_url = newPayload.thumbnail_url;
      summaryParts.push("thumbnail updated");
    }
  }

  return { changes, summary: summaryParts.join(", ") };
};

export default function BulkImport() {
  const [spreadsheetFile, setSpreadsheetFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { toast } = useToast();
  
  const spreadsheetRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXPECTED_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "course_bulk_import_template.xlsx");
  };

  const handleSpreadsheetChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSpreadsheetFile(file);
    parseSpreadsheet(file);
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      // Attempt to re-match existing rows if they are pending
      setRows(prevRows => prevRows.map(row => {
        if (!["created", "updated", "skipped"].includes(row.status) && row.data.thumbnail_filename) {
          const matched = Array.from(e.target.files!).find(f => f.name === row.data.thumbnail_filename) || row.matchedFile;
          return { ...row, matchedFile: matched };
        }
        return row;
      }));
    }
  };

  const parseSpreadsheet = (file: File) => {
    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processParsedData(results.data);
        }
      });
    } else if (file.name.match(/\.(xlsx|xls)$/)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheet = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
        processParsedData(rows);
      };
      reader.readAsBinaryString(file);
    } else {
      toast({ title: "Unsupported file", description: "Please upload a CSV or XLSX file.", variant: "destructive" });
    }
  };

  const processParsedData = (data: any[]) => {
    const importedRows: ImportedRow[] = data.map((row, idx) => {
      // Find matching image if already uploaded
      const thumbName = row.thumbnail_filename?.toString().trim();
      const matched = imageFiles.find(f => f.name === thumbName);
      
      return {
        originalIndex: idx + 2, // Excel rows are 1-indexed and header is row 1
        data: row,
        status: "pending",
        matchedFile: matched
      };
    });
    setRows(importedRows);
  };

  const clearAll = () => {
    setSpreadsheetFile(null);
    setImageFiles([]);
    setRows([]);
    setProgress(0);
    if (spreadsheetRef.current) spreadsheetRef.current.value = "";
    if (imagesRef.current) imagesRef.current.value = "";
  };

  const validateRow = (row: any): { valid: boolean, error?: string } => {
    if (!row.title || !row.title.trim()) return { valid: false, error: "Missing title" };
    
    // Category validation — supports comma-separated multiple categories
    const catRaw = row.category?.toString().trim();
    if (!catRaw) return { valid: false, error: "Missing category" };
    
    const catParts = catRaw.split(",").map((s: string) => s.trim()).filter(Boolean);
    const validatedCategories: string[] = [];
    for (const part of catParts) {
      const matched = CATEGORIES.find(c => c.toLowerCase() === part.toLowerCase());
      if (!matched) return { valid: false, error: `Invalid category: '${part}'` };
      validatedCategories.push(matched);
    }

    // Subcategory validation — supports comma-separated, each must belong to one of the chosen categories
    const subcatRaw = row.subcategory?.toString().trim();
    const validatedSubcategories: string[] = [];
    if (subcatRaw) {
      const subParts = subcatRaw.split(",").map((s: string) => s.trim()).filter(Boolean);
      for (const part of subParts) {
        // Check if this subcategory belongs to ANY of the validated categories
        let found = false;
        for (const cat of validatedCategories) {
          const allowed = SUBCATEGORY_MAP[cat] || [];
          const matched = allowed.find(s => s.toLowerCase() === part.toLowerCase());
          if (matched) {
            validatedSubcategories.push(matched);
            found = true;
            break;
          }
        }
        if (!found) return { valid: false, error: `Invalid subcategory '${part}' for categories [${validatedCategories.join(", ")}]` };
      }
    }
    
    // Store validated arrays back on the row for later payload use
    row._validatedCategories = validatedCategories;
    row._validatedSubcategories = validatedSubcategories;

    // thumbnail_filename is optional — courses can be imported without an image

    return { valid: true };
  };

  // Build the database payload from a parsed row
  const buildPayload = (d: any) => {
    return {
      title: d.title.trim(),
      description: d.description || null,
      short_description: d.short_description || null,
      price: d.price ? Number(d.price) : null,
      original_price: d.original_price ? Number(d.original_price) : null,
      instructor_name: d.instructor_name || null,
      instructor_bio: d.instructor_bio || null,
      category: d._validatedCategories?.length ? d._validatedCategories : null,
      subcategory: d._validatedSubcategories?.length ? d._validatedSubcategories : null,
      level: d.level || "Beginner",
      language: d.language || "Hindi",
      duration_hours: d.duration_hours ? Number(d.duration_hours) : null,
      total_lectures: d.total_lectures ? Number(d.total_lectures) : null,
      tags: d.tags ? splitBy(d.tags, ",") : DEFAULT_TAGS,
      what_you_learn: d.what_you_learn ? splitBy(d.what_you_learn, "\n") : DEFAULT_LEARN,
      requirements: d.requirements ? splitBy(d.requirements, "\n") : DEFAULT_REQUIREMENTS,
    };
  };

  const processImports = async () => {
    setIsProcessing(true);
    setProgress(0);

    // Fetch all existing courses (non-deleted) with full records for comparison
    const { data: existingCourses } = await (supabase as any)
      .from("courses")
      .select("*")
      .or("is_deleted.eq.false,is_deleted.is.null");

    // Build a Map of lowercase title → full course record
    const courseMap = new Map<string, any>();
    (existingCourses || []).forEach((c: any) => {
      const key = c.title?.trim().toLowerCase();
      if (key) courseMap.set(key, c);
    });

    // Track titles processed within this batch (for within-CSV dedup)
    const processedInBatch = new Set<string>();

    const updatedRows = [...rows];
    let processedCount = 0;

    // Process in small batches to avoid timeouts
    const BATCH_SIZE = 5;
    for (let i = 0; i < updatedRows.length; i += BATCH_SIZE) {
      const batch = updatedRows.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (row, batchIdx) => {
        const absoluteIdx = i + batchIdx;
        
        // Skip already processed rows if retrying
        if (["created", "updated", "skipped"].includes(row.status)) return;
        
        // 1. Validation
        const { valid, error } = validateRow(row.data);
        if (!valid) {
          updatedRows[absoluteIdx] = { ...row, status: "error", errorReason: error };
          return;
        }

        const titleLower = row.data.title?.trim().toLowerCase();

        // Within-CSV duplicate: if same title already processed in this upload
        if (processedInBatch.has(titleLower)) {
          updatedRows[absoluteIdx] = { ...row, status: "skipped", changeDetails: "Duplicate row within this CSV (already processed above)" };
          return;
        }

        updatedRows[absoluteIdx] = { ...row, status: "processing" };
        setRows([...updatedRows]); // trigger re-render for progress

        try {
          // 2. Upload Image (if available)
          let thumbnailUrl: string | null = null;
          const hasThumbnailFile = !!row.matchedFile;
          if (row.matchedFile) {
            const fileExt = row.matchedFile.name.split('.').pop();
            const filePath = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from("course-thumbnails")
              .upload(filePath, row.matchedFile);

            if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

            const { data: urlData } = supabase.storage.from("course-thumbnails").getPublicUrl(filePath);
            thumbnailUrl = urlData.publicUrl;
          }

          // 3. Build payload
          const payload = buildPayload(row.data);

          // 4. Check if course already exists
          const existingCourse = courseMap.get(titleLower);

          if (!existingCourse) {
            // ===== INSERT (new course) =====
            const insertPayload = {
              ...payload,
              thumbnail_url: thumbnailUrl,
              is_published: false,
              is_featured: false,
              is_free: payload.price != null && Number(payload.price) === 0,
            };

            const { error: dbError } = await supabase.from("courses").insert(insertPayload);
            if (dbError) throw new Error(`Database error: ${dbError.message}`);

            updatedRows[absoluteIdx] = { ...updatedRows[absoluteIdx], status: "created", errorReason: undefined, changeDetails: undefined };
            // Add to map so later rows in same CSV see it as existing
            courseMap.set(titleLower, { ...insertPayload, id: "new" });
          } else {
            // ===== UPDATE or SKIP (existing course) =====
            const payloadWithThumb = thumbnailUrl ? { ...payload, thumbnail_url: thumbnailUrl } : payload;
            const { changes, summary } = diffCourse(existingCourse, payloadWithThumb, !hasThumbnailFile);

            if (Object.keys(changes).length === 0) {
              // No changes — skip
              updatedRows[absoluteIdx] = { ...updatedRows[absoluteIdx], status: "skipped", errorReason: undefined, changeDetails: "No changes detected" };
            } else {
              // Update only changed fields
              const { error: dbError } = await (supabase as any)
                .from("courses")
                .update(changes)
                .eq("id", existingCourse.id);

              if (dbError) throw new Error(`Update failed: ${dbError.message}`);

              updatedRows[absoluteIdx] = { ...updatedRows[absoluteIdx], status: "updated", errorReason: undefined, changeDetails: summary };
              // Update the map entry so subsequent rows see updated data
              courseMap.set(titleLower, { ...existingCourse, ...changes });
            }
          }

          processedInBatch.add(titleLower);

        } catch (err: any) {
          updatedRows[absoluteIdx] = { ...updatedRows[absoluteIdx], status: "error", errorReason: err.message };
        }
      });

      await Promise.all(batchPromises);
      processedCount += batch.length;
      setProgress((processedCount / updatedRows.length) * 100);
      setRows([...updatedRows]);
    }

    setIsProcessing(false);
    toast({ title: "Bulk import finished", description: "Check the results table for details." });
  };

  const handleAddCourseFromAI = (generatedCourse: any) => {
    setRows(prev => [
      ...prev,
      {
        originalIndex: prev.length > 0 ? prev[prev.length - 1].originalIndex + 1 : 2,
        data: generatedCourse,
        status: "pending",
        matchedFile: undefined
      }
    ]);
  };

  const createdCount = rows.filter(r => r.status === "created").length;
  const updatedCount = rows.filter(r => r.status === "updated").length;
  const skippedCount = rows.filter(r => r.status === "skipped").length;
  const errorCount = rows.filter(r => r.status === "error").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6" /> Bulk Import Courses
          </h1>
          <p className="text-muted-foreground mt-1">Upload a spreadsheet and matching thumbnails to create or update courses in bulk.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAiModalOpen(true)} variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 gap-2">
            <Wand2 className="h-4 w-4" /> AI Assist
          </Button>
          <Link to="/admin/courses">
            <Button variant="outline" className="border-[#334155]">Back to Courses</Button>
          </Link>
          <Button onClick={downloadTemplate} variant="outline" className="border-[#334155] gap-2">
            <Download className="h-4 w-4" /> Download Template
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Spreadsheet Upload */}
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-400" /> 1. Upload Spreadsheet
            </CardTitle>
            <CardDescription>Upload CSV or XLSX file containing course data.</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${spreadsheetFile ? 'border-green-500 bg-green-500/5' : 'border-[#334155] hover:border-[#475569]'}`}
              onClick={() => spreadsheetRef.current?.click()}
            >
              <input type="file" ref={spreadsheetRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleSpreadsheetChange} />
              {spreadsheetFile ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p className="font-medium text-green-400">{spreadsheetFile.name}</p>
                  <p className="text-sm text-muted-foreground">{rows.length} rows found</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 cursor-pointer text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <p className="font-medium text-white">Click to upload spreadsheet</p>
                  <p className="text-sm">Supports .csv, .xlsx</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Image Upload */}
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-purple-400" /> 2. Upload Thumbnails
            </CardTitle>
            <CardDescription>Select all image files referenced in the spreadsheet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${imageFiles.length > 0 ? 'border-purple-500 bg-purple-500/5' : 'border-[#334155] hover:border-[#475569]'}`}
              onClick={() => imagesRef.current?.click()}
            >
              <input type="file" ref={imagesRef} className="hidden" multiple accept="image/*" onChange={handleImagesChange} />
              <div className="flex flex-col items-center gap-2 cursor-pointer">
                {imageFiles.length > 0 ? <CheckCircle2 className="h-8 w-8 text-purple-500" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
                <p className="font-medium text-white">{imageFiles.length > 0 ? `${imageFiles.length} images selected` : 'Click to select images'}</p>
                <p className="text-sm text-muted-foreground">Select multiple files at once</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      {rows.length > 0 && (
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="text-sm">
                <span className="text-muted-foreground">Total Rows: </span>
                <span className="font-bold">{rows.length}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Matched Images: </span>
                <span className="font-bold text-blue-400">{rows.filter(r => r.matchedFile).length}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isProcessing && <Progress value={progress} className="w-32 h-2" />}
              <Button variant="outline" onClick={clearAll} disabled={isProcessing} className="border-[#334155]">Clear All</Button>
              <Button 
                onClick={processImports} 
                disabled={isProcessing || (rows.filter(r => r.status === "pending" || r.status === "error").length === 0)}
                className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
              >
                {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Start Import"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary & Table */}
      {rows.length > 0 && (
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader className="pb-3 border-b border-[#334155]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">Import Results</CardTitle>
              <div className="flex gap-2 flex-wrap">
                {createdCount > 0 && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                    <PlusCircle className="h-3 w-3" /> {createdCount} New
                  </Badge>
                )}
                {updatedCount > 0 && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1">
                    <RefreshCw className="h-3 w-3" /> {updatedCount} Updated
                  </Badge>
                )}
                {skippedCount > 0 && (
                  <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20 gap-1">
                    <SkipForward className="h-3 w-3" /> {skippedCount} Skipped
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 gap-1">
                    <XCircle className="h-3 w-3" /> {errorCount} Failed
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#334155]">
                  <TableHead className="w-16 text-center">Row</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Course Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Thumbnail Expected</TableHead>
                  <TableHead>Message / Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow 
                    key={idx} 
                    className={`border-[#334155] ${
                      row.status === "error" ? "bg-red-500/5" : 
                      row.status === "updated" ? "bg-blue-500/5" :
                      row.status === "created" ? "bg-green-500/5" :
                      ""
                    }`}
                  >
                    <TableCell className="text-center font-medium text-muted-foreground">{row.originalIndex}</TableCell>
                    <TableCell>
                      {row.status === "pending" && <Badge variant="outline" className="text-slate-400 border-slate-700">Pending</Badge>}
                      {row.status === "processing" && <Badge variant="outline" className="text-blue-400 border-blue-800 bg-blue-900/20"><Loader2 className="h-3 w-3 mr-1 animate-spin"/> Processing</Badge>}
                      {row.status === "created" && <Badge variant="outline" className="text-green-400 border-green-800 bg-green-900/20"><PlusCircle className="h-3 w-3 mr-1"/> New</Badge>}
                      {row.status === "updated" && <Badge variant="outline" className="text-blue-400 border-blue-800 bg-blue-900/20"><RefreshCw className="h-3 w-3 mr-1"/> Updated</Badge>}
                      {row.status === "skipped" && <Badge variant="outline" className="text-slate-400 border-slate-700 bg-slate-800/20"><SkipForward className="h-3 w-3 mr-1"/> Skipped</Badge>}
                      {row.status === "error" && <Badge variant="outline" className="text-red-400 border-red-800 bg-red-900/20">Failed</Badge>}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={row.data.title}>{row.data.title || <span className="text-red-400 italic">Missing</span>}</TableCell>
                    <TableCell>{row.data.category || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate max-w-[150px]" title={row.data.thumbnail_filename}>{row.data.thumbnail_filename || "-"}</span>
                        {row.data.thumbnail_filename && (
                          row.matchedFile ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" /> : <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" title="Image file not uploaded yet" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      {row.status === "error" && row.errorReason ? (
                        <div className="flex items-start gap-1.5 text-red-400 text-sm">
                          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span className="break-words">{row.errorReason}</span>
                        </div>
                      ) : row.status === "created" ? (
                        <span className="text-green-400 text-sm">Imported as draft</span>
                      ) : row.status === "updated" ? (
                        <span className="text-blue-400 text-sm">{row.changeDetails}</span>
                      ) : row.status === "skipped" ? (
                        <span className="text-slate-400 text-sm">{row.changeDetails || "No changes detected"}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AIAssistModal 
        open={aiModalOpen} 
        onOpenChange={setAiModalOpen} 
        onAddCourse={handleAddCourseFromAI} 
      />
    </div>
  );
}
