import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dumbbell, Mail, Phone, Plus, Pencil, Eye, UserX, UserCheck,
  Award, BookOpen, Clock, Briefcase, X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMarket } from "@/hooks/use-market";
import type { User, TrainerProfile } from "@shared/schema";

type TrainerWithProfile = Omit<User, "password"> & { profile: TrainerProfile | null };

const addTrainerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  bio: z.string().optional(),
  specializations: z.string().optional(),
  certifications: z.string().optional(),
  experienceYears: z.string().optional(),
  hourlyRate: z.string().optional(),
  availability: z.string().optional(),
});

const editTrainerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  bio: z.string().optional(),
  specializations: z.string().optional(),
  certifications: z.string().optional(),
  experienceYears: z.string().optional(),
  hourlyRate: z.string().optional(),
  availability: z.string().optional(),
});

export default function TrainersPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerWithProfile | null>(null);
  const { toast } = useToast();
  const { fmt } = useMarket();

  const { data: trainers, isLoading } = useQuery<TrainerWithProfile[]>({
    queryKey: ["/api/trainers"],
  });

  const addForm = useForm<z.infer<typeof addTrainerSchema>>({
    resolver: zodResolver(addTrainerSchema),
    defaultValues: {
      username: "", email: "", password: "", firstName: "", lastName: "",
      phone: "", bio: "", specializations: "", certifications: "",
      experienceYears: "", hourlyRate: "", availability: "",
    },
  });

  const editForm = useForm<z.infer<typeof editTrainerSchema>>({
    resolver: zodResolver(editTrainerSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phone: "",
      bio: "", specializations: "", certifications: "",
      experienceYears: "", hourlyRate: "", availability: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addTrainerSchema>) => {
      const payload = {
        ...data,
        specializations: data.specializations ? data.specializations.split(",").map(s => s.trim()).filter(Boolean) : [],
        certifications: data.certifications ? data.certifications.split(",").map(s => s.trim()).filter(Boolean) : [],
        experienceYears: data.experienceYears ? parseInt(data.experienceYears) : 0,
      };
      return apiRequest("POST", "/api/trainers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainers"] });
      setShowAddDialog(false);
      addForm.reset();
      toast({ title: "Trainer added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editTrainerSchema>) => {
      if (!selectedTrainer) return;
      const payload = {
        ...data,
        specializations: data.specializations ? data.specializations.split(",").map(s => s.trim()).filter(Boolean) : [],
        certifications: data.certifications ? data.certifications.split(",").map(s => s.trim()).filter(Boolean) : [],
        experienceYears: data.experienceYears ? parseInt(data.experienceYears) : 0,
      };
      return apiRequest("PATCH", `/api/trainers/${selectedTrainer.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainers"] });
      setShowEditDialog(false);
      setSelectedTrainer(null);
      toast({ title: "Trainer updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/trainers/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainers"] });
      toast({ title: "Trainer status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = (trainer: TrainerWithProfile) => {
    setSelectedTrainer(trainer);
    editForm.reset({
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      email: trainer.email,
      phone: trainer.phone || "",
      bio: trainer.profile?.bio || "",
      specializations: (trainer.profile?.specializations as string[] || []).join(", "),
      certifications: (trainer.profile?.certifications as string[] || []).join(", "),
      experienceYears: String(trainer.profile?.experienceYears || ""),
      hourlyRate: trainer.profile?.hourlyRate || "",
      availability: trainer.profile?.availability || "",
    });
    setShowEditDialog(true);
  };

  const openDetail = (trainer: TrainerWithProfile) => {
    setSelectedTrainer(trainer);
    setShowDetailSheet(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="trainers-loading">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trainers</h1>
            <p className="text-muted-foreground mt-1">Manage your gym trainers</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const activeTrainers = trainers?.filter(t => t.isActive) || [];
  const inactiveTrainers = trainers?.filter(t => !t.isActive) || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-trainers">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trainers</h1>
          <p className="text-muted-foreground mt-1">Manage your gym trainers and their profiles</p>
        </div>
        <Button onClick={() => { addForm.reset(); setShowAddDialog(true); }} data-testid="button-add-trainer">
          <Plus className="h-4 w-4 mr-2" />
          Add Trainer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-total-trainers">{trainers?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total Trainers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-active-trainers">{activeTrainers.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <UserX className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-inactive-trainers">{inactiveTrainers.length}</p>
              <p className="text-xs text-muted-foreground">Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" data-testid="tabs-trainers">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-trainers">All ({trainers?.length || 0})</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active-trainers">Active ({activeTrainers.length})</TabsTrigger>
          <TabsTrigger value="inactive" data-testid="tab-inactive-trainers">Inactive ({inactiveTrainers.length})</TabsTrigger>
        </TabsList>

        {["all", "active", "inactive"].map((tab) => {
          const list = tab === "active" ? activeTrainers : tab === "inactive" ? inactiveTrainers : trainers || [];
          return (
            <TabsContent key={tab} value={tab}>
              {list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                    <Dumbbell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">No trainers found</h3>
                  <p className="text-muted-foreground mt-1">
                    {tab === "inactive" ? "No inactive trainers" : "Add your first trainer to get started"}
                  </p>
                </div>
              ) : (
                <Card>
                  <Table data-testid="table-trainers">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Specializations</TableHead>
                        <TableHead>Experience</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((trainer) => (
                        <TableRow key={trainer.id} data-testid={`row-trainer-${trainer.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className={`${["bg-blue-500","bg-emerald-500","bg-violet-500","bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500"][list.indexOf(trainer) % 8]} text-white font-semibold`}>
                                  {trainer.firstName[0]}{trainer.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{trainer.firstName} {trainer.lastName}</p>
                                <p className="text-xs text-muted-foreground">@{trainer.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-sm">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="truncate max-w-[160px]">{trainer.email}</span>
                              </div>
                              {trainer.phone && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>{trainer.phone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(trainer.profile?.specializations as string[] || []).slice(0, 3).map((s, i) => (
                                <Badge key={i} variant="outline" className={`text-xs ${["bg-blue-100 text-blue-700 border-blue-200","bg-violet-100 text-violet-700 border-violet-200","bg-cyan-100 text-cyan-700 border-cyan-200","bg-amber-100 text-amber-700 border-amber-200","bg-rose-100 text-rose-700 border-rose-200"][i % 5]}`}>{s}</Badge>
                              ))}
                              {(trainer.profile?.specializations as string[] || []).length === 0 && (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {trainer.profile?.experienceYears
                              ? `${trainer.profile.experienceYears} yr${trainer.profile.experienceYears !== 1 ? "s" : ""}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={trainer.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}>
                              {trainer.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openDetail(trainer)} data-testid={`button-view-trainer-${trainer.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(trainer)} data-testid={`button-edit-trainer-${trainer.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleActiveMutation.mutate({ id: trainer.id, isActive: !trainer.isActive })}
                                data-testid={`button-toggle-trainer-${trainer.id}`}
                              >
                                {trainer.isActive ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4 text-green-600" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-add-trainer">
          <DialogHeader>
            <DialogTitle>Add New Trainer</DialogTitle>
            <DialogDescription>Create a new trainer account with profile details</DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => addMutation.mutate(data))} className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Account Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={addForm.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input {...field} placeholder="john.trainer" data-testid="input-trainer-username" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input {...field} type="password" placeholder="Min 6 characters" data-testid="input-trainer-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={addForm.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input {...field} placeholder="John" data-testid="input-trainer-firstname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input {...field} placeholder="Doe" data-testid="input-trainer-lastname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="john@example.com" data-testid="input-trainer-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} placeholder="+971 50 123 4567" data-testid="input-trainer-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Professional Profile</h3>
                <div className="space-y-4">
                  <FormField control={addForm.control} name="bio" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Brief professional bio..." rows={3} data-testid="input-trainer-bio" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={addForm.control} name="specializations" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specializations</FormLabel>
                        <FormControl><Input {...field} placeholder="Strength, Yoga, HIIT" data-testid="input-trainer-specializations" /></FormControl>
                        <p className="text-xs text-muted-foreground">Comma-separated list</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="certifications" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certifications</FormLabel>
                        <FormControl><Input {...field} placeholder="ACE, NASM, CPR" data-testid="input-trainer-certifications" /></FormControl>
                        <p className="text-xs text-muted-foreground">Comma-separated list</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={addForm.control} name="experienceYears" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experience (years)</FormLabel>
                        <FormControl><Input {...field} type="number" placeholder="5" data-testid="input-trainer-experience" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="hourlyRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate</FormLabel>
                        <FormControl><Input {...field} placeholder="150.00" data-testid="input-trainer-rate" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="availability" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Availability</FormLabel>
                        <FormControl><Input {...field} placeholder="Mon-Fri, 6AM-8PM" data-testid="input-trainer-availability" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={addMutation.isPending} data-testid="button-submit-add-trainer">
                {addMutation.isPending ? "Adding..." : "Add Trainer"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-trainer">
          <DialogHeader>
            <DialogTitle>Edit Trainer</DialogTitle>
            <DialogDescription>Update trainer information and profile</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editMutation.mutate(data))} className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-edit-firstname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-edit-lastname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" data-testid="input-edit-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} data-testid="input-edit-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Professional Profile</h3>
                <div className="space-y-4">
                  <FormField control={editForm.control} name="bio" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl><Textarea {...field} rows={3} data-testid="input-edit-bio" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="specializations" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specializations</FormLabel>
                        <FormControl><Input {...field} data-testid="input-edit-specializations" /></FormControl>
                        <p className="text-xs text-muted-foreground">Comma-separated list</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="certifications" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certifications</FormLabel>
                        <FormControl><Input {...field} data-testid="input-edit-certifications" /></FormControl>
                        <p className="text-xs text-muted-foreground">Comma-separated list</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={editForm.control} name="experienceYears" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experience (years)</FormLabel>
                        <FormControl><Input {...field} type="number" data-testid="input-edit-experience" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="hourlyRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate</FormLabel>
                        <FormControl><Input {...field} data-testid="input-edit-rate" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="availability" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Availability</FormLabel>
                        <FormControl><Input {...field} data-testid="input-edit-availability" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={editMutation.isPending} data-testid="button-submit-edit-trainer">
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto" data-testid="sheet-trainer-detail">
          <SheetHeader>
            <SheetTitle>Trainer Profile</SheetTitle>
            <SheetDescription>Detailed trainer information</SheetDescription>
          </SheetHeader>
          {selectedTrainer && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-indigo-500 text-white text-xl font-semibold">
                    {selectedTrainer.firstName[0]}{selectedTrainer.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold" data-testid="text-detail-name">
                    {selectedTrainer.firstName} {selectedTrainer.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">@{selectedTrainer.username}</p>
                  <Badge variant="outline" className={`mt-1 ${selectedTrainer.isActive ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                    {selectedTrainer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span data-testid="text-detail-email">{selectedTrainer.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span data-testid="text-detail-phone">{selectedTrainer.phone || "Not provided"}</span>
                  </div>
                </CardContent>
              </Card>

              {selectedTrainer.profile?.bio && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Bio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm" data-testid="text-detail-bio">{selectedTrainer.profile.bio}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4" /> Professional Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Specializations</p>
                    <div className="flex flex-wrap gap-1.5" data-testid="text-detail-specializations">
                      {(selectedTrainer.profile?.specializations as string[] || []).length > 0 ? (
                        (selectedTrainer.profile?.specializations as string[]).map((s, i) => (
                          <Badge key={i} variant="outline" className={`${["bg-blue-100 text-blue-700 border-blue-200","bg-violet-100 text-violet-700 border-violet-200","bg-cyan-100 text-cyan-700 border-cyan-200","bg-amber-100 text-amber-700 border-amber-200","bg-rose-100 text-rose-700 border-rose-200"][i % 5]}`}>{s}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">None listed</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Certifications</p>
                    <div className="flex flex-wrap gap-1.5" data-testid="text-detail-certifications">
                      {(selectedTrainer.profile?.certifications as string[] || []).length > 0 ? (
                        (selectedTrainer.profile?.certifications as string[]).map((c, i) => (
                          <Badge key={i}>{c}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">None listed</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Experience</p>
                      <div className="flex items-center gap-1.5" data-testid="text-detail-experience">
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {selectedTrainer.profile?.experienceYears
                            ? `${selectedTrainer.profile.experienceYears} year${selectedTrainer.profile.experienceYears !== 1 ? "s" : ""}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Hourly Rate</p>
                      <div className="flex items-center gap-1.5" data-testid="text-detail-rate">
                        <span className="text-sm font-medium">
                          {selectedTrainer.profile?.hourlyRate
                            ? fmt(selectedTrainer.profile.hourlyRate)
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedTrainer.profile?.availability && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Availability</p>
                      <div className="flex items-center gap-1.5" data-testid="text-detail-availability">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{selectedTrainer.profile.availability}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowDetailSheet(false); openEdit(selectedTrainer); }} data-testid="button-detail-edit">
                  <Pencil className="h-4 w-4 mr-2" /> Edit Profile
                </Button>
                <Button
                  variant={selectedTrainer.isActive ? "destructive" : "default"}
                  className="flex-1"
                  onClick={() => {
                    toggleActiveMutation.mutate({ id: selectedTrainer.id, isActive: !selectedTrainer.isActive });
                    setShowDetailSheet(false);
                  }}
                  data-testid="button-detail-toggle-active"
                >
                  {selectedTrainer.isActive ? (
                    <><UserX className="h-4 w-4 mr-2" /> Deactivate</>
                  ) : (
                    <><UserCheck className="h-4 w-4 mr-2" /> Activate</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}