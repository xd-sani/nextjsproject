"use client";

import { useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp, LoaderCircle, Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { upload } from "@vercel/blob/client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn, parsePDFFile } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  cheakBookExists,
  createBook,
  saveBookSegments,
} from "@/lib/actions/book.actions";
import { useRouter } from "next/navigation";

const voiceGroups = [
  {
    label: "Male Voices",
    options: [
      {
        value: "Dave",
        description: "Warm and steady for reflective storytelling.",
      },
      {
        value: "Daniel",
        description: "Balanced and clear for teaching and analysis.",
      },
      {
        value: "Chris",
        description: "Friendly and conversational with a casual tone.",
      },
    ],
  },
  {
    label: "Female Voices",
    options: [
      {
        value: "Rachel",
        description: "Calm and polished for guided discussions.",
      },
      {
        value: "Sarah",
        description: "Bright and engaging for a natural interview feel.",
      },
    ],
  },
] as const;

const fileSchema = (fieldName: string) =>
  z.any().refine((value) => value instanceof File && value.size > 0, {
    message: `${fieldName} is required`,
  });

const schema = z.object({
  pdf: fileSchema("PDF file"),
  coverImage: z.any().optional(),
  title: z.string().trim().min(2, "Title is required."),
  author: z.string().trim().min(2, "Author name is required."),
  voice: z.string().min(1, "Please select an assistant voice."),
});

type FormValues = z.infer<typeof schema>;

const LoadingOverlay = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="loading-wrapper">
      <div className="loading-shadow-wrapper">
        <div className="loading-shadow">
          <LoaderCircle className="loading-animation size-10 text-[#663820]" />
          <div className="loading-progress text-center">
            <p className="loading-title">Preparing your interview</p>
            <div className="loading-progress-item mt-3">
              <span className="loading-progress-status" />
              <span>Generating your book experience...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const UploadForm = () => {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { userId } = useAuth();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      author: "",
      pdf: undefined,
      coverImage: undefined,
      voice: "Dave",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!userId) {
      return toast.error("Please Login To Upload Books");
    }
    try {
      console.log("Form submitted", values);
      const existscheak = await cheakBookExists(values.title);
      if (existscheak?.exists) {
        return toast.error("Book is Already Exists ");
      }

      const fileTitle = values.title.replace(/\s+/g, "-").toLowerCase();
      const pdffile = values.pdf;
      const parsedpdf = await parsePDFFile(pdffile);
      if (parsedpdf.content.length === 0) {
        toast.error("Failed to parse pdf . Please Try Again");
        return;
      }
      const uploadpdfblob = await upload(fileTitle, pdffile, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: "application/pdf",
      });
      let coverUrl: string;
      if (values.coverImage) {
        const coverFile = values.coverImage;
        const uploadedCoverBlob = await upload(
          `${fileTitle}_cover.png`,
          coverFile,
          {
            access: "public",
            handleUploadUrl: "/api/upload",
            contentType: "image/jpeg",
          },
        );
        coverUrl = uploadedCoverBlob.url;
      } else {
        const response = await fetch(parsedpdf.cover);
        const blob = await response.blob();
        const uploadedCoverBlob = await upload(`${fileTitle}_cover.png`, blob, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: "image/jpeg",
        });
        coverUrl = uploadedCoverBlob.url;
      }
      const book = await createBook({
        clerkId: userId,
        title: values.title,
        author: values.author,
        persona: values.voice,
        fileURL: uploadpdfblob.url,
        fileBlobKey: uploadpdfblob.pathname,
        coverURL: coverUrl,
        fileSize: pdffile.size,
      });
      if (!book.success) {
        throw new Error(book.error || "Failed to create book");
      }
      if (book?.alreadyExists) {
        toast.error("Book Already Exists");
        return;
      }
      const segments = await saveBookSegments(
        book?.data._id,
        userId,
        parsedpdf.content,
      );
      if (!segments.success) {
        toast.error("Failed to save book segments");
        throw new Error("Failed to save book segments");
      }
      form.reset();
      router.push("/");
      toast.success("Book Upload SucessFully");
    } catch (e) {
      console.error("Failed to Upload Book", e);
      toast.error("Failed to Upload Book");
    }
  };

  const removeFile = (field: "pdf" | "coverImage") => {
    form.setValue(field, undefined);
    if (field === "pdf") {
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      return;
    }

    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  return (
    <div className="new-book-wrapper">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="pdf"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Upload Book PDF</FormLabel>
                <FormControl>
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "upload-dropzone border border-dashed border-[#d7c5a3] px-4 py-3",
                      field.value && "upload-dropzone-uploaded",
                    )}
                    onClick={() => pdfInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        pdfInputRef.current?.click();
                      }
                    }}
                  >
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        field.onChange(file ?? undefined);
                      }}
                    />

                    {field.value ? (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="upload-dropzone-icon flex items-center justify-center">
                            <Upload className="h-8 w-8" />
                          </span>
                          <span className="upload-dropzone-text max-w-[420px] truncate text-left">
                            {field.value.name}
                          </span>
                          <button
                            type="button"
                            aria-label="Remove PDF file"
                            className="upload-dropzone-remove"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeFile("pdf");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="upload-dropzone-hint mt-2">
                          Click to change file
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="upload-dropzone-icon" />
                        <p className="upload-dropzone-text">
                          Click to upload PDF
                        </p>
                        <p className="upload-dropzone-hint">
                          PDF file (max 50MB)
                        </p>
                      </>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="coverImage"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Upload Book Cover Image</FormLabel>
                <FormControl>
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "upload-dropzone border border-dashed border-[#d7c5a3] px-4 py-3",
                      field.value && "upload-dropzone-uploaded",
                    )}
                    onClick={() => coverInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        coverInputRef.current?.click();
                      }
                    }}
                  >
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        field.onChange(file ?? undefined);
                      }}
                    />

                    {field.value ? (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="upload-dropzone-icon flex items-center justify-center">
                            <ImageUp className="h-8 w-8" />
                          </span>
                          <span className="upload-dropzone-text max-w-[420px] truncate text-left">
                            {field.value.name}
                          </span>
                          <button
                            type="button"
                            aria-label="Remove cover image"
                            className="upload-dropzone-remove"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeFile("coverImage");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="upload-dropzone-hint mt-2">
                          Click to change image
                        </p>
                      </>
                    ) : (
                      <>
                        <ImageUp className="upload-dropzone-icon" />
                        <p className="upload-dropzone-text">
                          Click to upload cover image
                        </p>
                        <p className="upload-dropzone-hint">
                          Leave empty to auto-generate from PDF
                        </p>
                      </>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <input
                    className="form-input"
                    placeholder="ex: Rich Dad Poor Dad"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="author"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Author Name</FormLabel>
                <FormControl>
                  <input
                    className="form-input"
                    placeholder="ex: Robert Kiyosaki"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="voice"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Choose Assistant Voice</FormLabel>
                <FormControl>
                  <RadioGroup.Root
                    className="space-y-5"
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-label="Assistant voice"
                  >
                    {voiceGroups.map((group) => (
                      <div key={group.label} className="space-y-3">
                        <p className="text-sm font-medium uppercase tracking-[0.08em] text-[#3d485e]">
                          {group.label}
                        </p>
                        <div className="voice-selector-options flex-col md:flex-row">
                          {group.options.map((option) => {
                            const isSelected = field.value === option.value;

                            return (
                              <label
                                key={option.value}
                                className={cn(
                                  "voice-selector-option",
                                  isSelected &&
                                    "voice-selector-option-selected",
                                  !isSelected &&
                                    "voice-selector-option-default",
                                )}
                              >
                                <RadioGroup.Item
                                  value={option.value}
                                  className="sr-only"
                                  id={option.value}
                                />
                                <span
                                  className={cn(
                                    "flex h-4 w-4 items-center justify-center rounded-full border border-[#000] bg-white",
                                    isSelected && "bg-[#663820]",
                                  )}
                                >
                                  {isSelected && (
                                    <span className="h-2 w-2 rounded-full bg-white" />
                                  )}
                                </span>
                                <span className="flex flex-1 flex-col text-left">
                                  <span className="text-base font-semibold text-[#000]">
                                    {option.value}
                                  </span>
                                  <span className="text-sm text-[#3d485e]">
                                    {option.description}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </RadioGroup.Root>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="form-btn"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Processing..." : "Begin Synthesis"}
          </Button>
        </form>
      </Form>

      <LoadingOverlay show={form.formState.isSubmitting} />
    </div>
  );
};

export default UploadForm;
