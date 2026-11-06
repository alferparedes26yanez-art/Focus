"use client";

import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, CircleCheck, CloudOff, Ellipsis, LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useMenuFollowUp } from "@/components/shared/use-menu-follow-up";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { deleteNotebookPage, readNotebookImage, saveNotebookPage, type NotebookPatch } from "@/lib/actions/notebook";
import type { UnitView } from "@/lib/data/subjects";
import { UNTITLED_PAGE } from "@/lib/notebook/document";
import type { NotebookPageView } from "@/lib/notebook/types";
import { cn } from "@/lib/utils";

import { NotebookImageError, uploadNotebookImage } from "./notebook-images";
import { NotebookToolbar } from "./notebook-toolbar";

type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";

const SAVE_DELAY_MS = 1_200;
const RETRY_DELAY_MS = 5_000;
// The page joins the chat's search index a little after the student stops.
const INDEX_DELAY_MS = 8_000;

function SaveIndicator({ status }: { status: SaveStatus }) {
  const content = {
    saved: { icon: CircleCheck, text: "Guardado", className: "text-muted-foreground" },
    pending: { icon: LoaderCircle, text: "Guardando…", className: "text-muted-foreground" },
    saving: { icon: LoaderCircle, text: "Guardando…", className: "text-muted-foreground" },
    error: { icon: CloudOff, text: "Sin conexión, reintentando…", className: "text-warning-foreground" },
    conflict: { icon: TriangleAlert, text: "Cambió en otro lugar", className: "text-destructive" },
  }[status];
  const Icon = content.icon;
  return (
    <span className={cn("flex items-center gap-1.5 text-xs whitespace-nowrap", content.className)} role="status">
      <Icon className={cn("size-3.5", (status === "pending" || status === "saving") && "animate-spin")} />
      {content.text}
    </span>
  );
}

function requestIndex(pageId: string, keepalive = false) {
  void fetch(`/api/notebook/${pageId}/index`, { method: "POST", keepalive }).catch(() => {});
}

export function NotebookEditor({
  page,
  subjectName,
  units,
  userId,
  focusSection,
}: {
  page: NotebookPageView;
  subjectName: string;
  units: UnitView[];
  userId: string;
  focusSection: string | null;
}) {
  const ids = useId();
  const router = useRouter();
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [title, setTitle] = useState(page.title);
  const [classDate, setClassDate] = useState(page.class_date);
  const [topicId, setTopicId] = useState(page.topic_id ?? "");
  const [uploads, setUploads] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flash, setFlash] = useState<{ top: number; height: number } | null>(null);
  const contentBox = useRef<HTMLDivElement>(null);
  const [deleting, startDeleting] = useTransition();

  const editorRef = useRef<Editor | null>(null);
  const updatedAt = useRef(page.updated_at);
  const pending = useRef<NotebookPatch>({});
  const contentDirty = useRef(false);
  const saving = useRef(false);
  const blocked = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsIndex = useRef(false);
  // flush schedules itself again (busy or offline) through this ref.
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const flush = useCallback(async () => {
    if (blocked.current) return;
    if (saving.current) {
      saveTimer.current = setTimeout(() => void flushRef.current(), 400);
      return;
    }
    const patch: NotebookPatch = { ...pending.current };
    // Plain JSON: the editor's attrs objects have no prototype, and server
    // actions would send them as references instead of their contents.
    if (contentDirty.current && editorRef.current) patch.content = JSON.parse(JSON.stringify(editorRef.current.getJSON()));
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    contentDirty.current = false;
    saving.current = true;
    setStatus("saving");

    const result = await saveNotebookPage(page.id, patch, updatedAt.current);
    saving.current = false;
    if (result.ok) {
      updatedAt.current = result.data.updatedAt;
      const more = contentDirty.current || Object.keys(pending.current).length > 0;
      setStatus(more ? "pending" : "saved");
      needsIndex.current = true;
      if (indexTimer.current) clearTimeout(indexTimer.current);
      indexTimer.current = setTimeout(() => {
        needsIndex.current = false;
        requestIndex(page.id);
      }, INDEX_DELAY_MS);
      return;
    }
    if (result.conflict) {
      blocked.current = true;
      setStatus("conflict");
      toast.error(result.error, { duration: 10_000 });
      return;
    }
    // Keep the changes and try again later.
    pending.current = { ...patch, ...pending.current };
    if (patch.content) {
      delete pending.current.content;
      contentDirty.current = true;
    }
    setStatus("error");
    saveTimer.current = setTimeout(() => void flushRef.current(), RETRY_DELAY_MS);
  }, [page.id]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const queue = useCallback(
    (patch: NotebookPatch | null) => {
      if (blocked.current) return;
      if (patch) Object.assign(pending.current, patch);
      else contentDirty.current = true;
      setStatus("pending");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const insertImages = useCallback(
    async (files: File[], position?: number) => {
      const editor = editorRef.current;
      if (!editor) return;
      for (const file of files) {
        setUploads((count) => count + 1);
        try {
          const { path, src } = await uploadNotebookImage(file, { userId, subjectId: page.subject_id, pageId: page.id });
          const chain = editor.chain().focus();
          (position !== undefined ? chain.insertContentAt(position, { type: "image", attrs: { src, alt: "" } }) : chain.setImage({ src, alt: "" })).run();
          // Read the text of the photo (board, slide) so the page can be searched by it.
          void readNotebookImage(path).then((result) => {
            if (!result.ok || !result.data.text) return;
            const current = editorRef.current;
            if (!current) return;
            const { tr } = current.state;
            current.state.doc.descendants((node, pos) => {
              if (node.type.name === "image" && node.attrs.src === src) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, alt: result.data.text });
              }
            });
            if (tr.docChanged) current.view.dispatch(tr);
          });
        } catch (error) {
          toast.error(error instanceof NotebookImageError ? error.message : "No se pudo agregar la imagen.");
        } finally {
          setUploads((count) => count - 1);
        }
      }
    },
    [page.id, page.subject_id, userId],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: "Escribe tus apuntes… Puedes pegar imágenes con Ctrl + V." }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ allowBase64: false }),
    ],
    content: page.content,
    editorProps: {
      attributes: { class: "notebook-content", "aria-label": "Apuntes" },
      handlePaste: (_view, event) => {
        const images = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (images.length === 0) return false;
        void insertImages(images);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const images = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (moved || images.length === 0) return false;
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(images, position);
        return true;
      },
    },
    onUpdate: () => queue(null),
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Opened from a citation: bring the cited section into view and flash it.
  // The highlight is drawn over the editor: ProseMirror undoes changes made
  // to its own elements.
  useEffect(() => {
    if (!editor || !focusSection) return;
    const heading = Array.from(editor.view.dom.querySelectorAll("h1, h2, h3")).find(
      (element) => element.textContent?.trim() === focusSection,
    );
    const box = contentBox.current;
    if (!heading || !box) return;
    heading.scrollIntoView({ block: "center" });
    const headingRect = heading.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const frame = requestAnimationFrame(() =>
      setFlash({ top: headingRect.top - boxRect.top - 4, height: headingRect.height + 8 }),
    );
    const timer = setTimeout(() => setFlash(null), 2_600);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [editor, focusSection]);

  // Leaving: warn about unsaved changes, and make sure the chat gets them.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (contentDirty.current || saving.current || Object.keys(pending.current).length > 0) event.preventDefault();
    };
    const pageHide = () => {
      if (needsIndex.current) requestIndex(page.id, true);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", pageHide);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", pageHide);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (indexTimer.current) clearTimeout(indexTimer.current);
      // Navigating inside the app: save what is left, then index.
      if (contentDirty.current || Object.keys(pending.current).length > 0) void flush().then(() => requestIndex(page.id, true));
      else if (needsIndex.current) requestIndex(page.id, true);
    };
  }, [flush, page.id]);

  const afterMenu = useMenuFollowUp({ delete: () => setConfirmDelete(true) });

  const remove = () =>
    startDeleting(async () => {
      blocked.current = true;
      const result = await deleteNotebookPage(page.id);
      if (!result.ok) {
        blocked.current = false;
        toast.error(result.error);
        return;
      }
      toast.success("Página borrada.");
      router.push(`/subjects/${page.subject_id}?tab=cuaderno`);
    });

  return (
    // grid-cols-1 lets wide content (tables, the toolbar) scroll inside instead of widening the page.
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/subjects/${page.subject_id}?tab=cuaderno`}
          className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">Cuaderno · {subjectName}</span>
        </Link>
        <div className="flex items-center gap-2">
          {uploads > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" />
              Subiendo imagen…
            </span>
          ) : null}
          <SaveIndicator status={status} />
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              aria-label="Opciones de la página"
            >
              <Ellipsis className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={afterMenu.onCloseAutoFocus}>
              <DropdownMenuItem variant="destructive" onSelect={() => afterMenu.queue("delete")}>
                <Trash2 />
                Borrar página
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor={`${ids}-title`} className="sr-only">
          Título de la página
        </label>
        <input
          id={`${ids}-title`}
          value={title}
          maxLength={200}
          onChange={(event) => {
            setTitle(event.target.value);
            if (event.target.value.trim()) queue({ title: event.target.value.trim() });
          }}
          onBlur={() => {
            if (!title.trim()) {
              setTitle(UNTITLED_PAGE);
              queue({ title: UNTITLED_PAGE });
            }
          }}
          placeholder="Título de la clase"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${ids}-date`} className="sr-only">
            Fecha de la clase
          </label>
          <Input
            id={`${ids}-date`}
            type="date"
            value={classDate}
            onChange={(event) => {
              setClassDate(event.target.value);
              if (event.target.value) queue({ classDate: event.target.value });
            }}
            className="h-9 w-auto"
          />
          <label htmlFor={`${ids}-topic`} className="sr-only">
            Tema
          </label>
          <NativeSelect
            id={`${ids}-topic`}
            value={topicId}
            onChange={(event) => {
              setTopicId(event.target.value);
              queue({ topicId: event.target.value || null });
            }}
            className="min-w-0 flex-1 sm:max-w-xs [&_select]:h-9"
          >
            <option value="">Sin tema</option>
            {units
              .filter((unit) => unit.topics.length > 0)
              .map((unit) => (
                <optgroup key={unit.id} label={unit.title}>
                  {unit.topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </optgroup>
              ))}
          </NativeSelect>
        </div>
      </div>

      {editor ? (
        <div className="sticky top-16 z-20 md:top-2">
          <NotebookToolbar editor={editor} onImages={(files) => void insertImages(files)} />
        </div>
      ) : null}

      <div ref={contentBox} className="relative min-h-[60vh] rounded-2xl border bg-card px-4 py-4 sm:px-6">
        {flash ? (
          <div
            aria-hidden
            className="notebook-flash pointer-events-none absolute inset-x-2 rounded-lg"
            style={{ top: flash.top, height: flash.height }}
          />
        ) : null}
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Abriendo página…
          </p>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !deleting && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran la página y sus imágenes, y el asistente ya no podrá citarla. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              Borrar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
