import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const RecycleBin = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeletedCourses = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("is_deleted", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (err: any) {
      console.error("Error fetching deleted courses:", err);
      toast({
        title: "Error fetching courses",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeletedCourses();
  }, [fetchDeletedCourses]);

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from("courses")
        .update({ is_deleted: false })
        .eq("id", id);
      
      if (error) throw error;
      
      toast({ title: "Course restored successfully" });
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      console.error("Error restoring course:", err);
      toast({
        title: "Error restoring course",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Course permanently deleted" });
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      console.error("Error deleting course:", err);
      toast({
        title: "Error deleting course",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleEmptyBin = async () => {
    if (courses.length === 0) return;
    try {
      const ids = courses.map((c) => c.id);
      const { error } = await supabase.from("courses").delete().in("id", ids);
      if (error) throw error;
      
      toast({ title: "Recycle bin emptied" });
      setCourses([]);
    } catch (err: any) {
      console.error("Error emptying bin:", err);
      toast({
        title: "Error emptying bin",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/courses">
            <Button variant="ghost" size="icon" className="hover:bg-[#334155]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-red-500" /> Recycle Bin
          </h1>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2" disabled={courses.length === 0 || loading}>
              <AlertTriangle className="h-4 w-4" /> Empty Bin
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-[#1E293B] border-[#334155] text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                This action cannot be undone. This will permanently delete all {courses.length} courses in the recycle bin.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-[#334155] text-white hover:bg-[#334155]">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleEmptyBin} className="bg-red-600 hover:bg-red-700">Empty Bin</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <CardTitle className="text-lg">Deleted Courses ({courses.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-[#334155]" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <Trash2 className="h-12 w-12 mb-3 opacity-20" />
              <p>The recycle bin is empty</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#334155]">
                  <TableHead>Course Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id} className="border-[#334155]">
                    <TableCell className="font-medium text-white">{course.title}</TableCell>
                    <TableCell className="text-gray-400">
                      {Array.isArray(course.category) ? course.category.join(", ") : course.category || "No Category"}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      ₹{course.price || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRestore(course.id)}
                          className="bg-green-600/10 text-green-500 hover:bg-green-600/20 border-green-900"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" /> Restore
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="bg-red-600/10 text-red-500 hover:bg-red-600/20 border-red-900"
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#1E293B] border-[#334155] text-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Course Permanently?</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-400">
                                This will permanently delete "{course.title}". This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-transparent border-[#334155] text-white hover:bg-[#334155]">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handlePermanentDelete(course.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecycleBin;
