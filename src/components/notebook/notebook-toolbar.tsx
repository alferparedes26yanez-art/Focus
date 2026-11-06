"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Redo2,
  Rows3,
  Table,
  Trash2,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

function ToolButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the cursor in the text while clicking the toolbar.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40",
        active && "bg-primary/12 text-primary hover:bg-primary/15 hover:text-primary",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />;

export function NotebookToolbar({ editor, onImages }: { editor: Editor; onImages: (files: File[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h1: current.isActive("heading", { level: 1 }),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      highlight: current.isActive("highlight"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      task: current.isActive("taskList"),
      table: current.isActive("table"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formato"
      className="flex items-center gap-0.5 overflow-x-auto rounded-xl border bg-background/95 p-1 shadow-sm backdrop-blur"
    >
      <ToolButton icon={Undo2} label="Deshacer" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton icon={Redo2} label="Rehacer" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
      <Divider />
      <ToolButton icon={Heading1} label="Título" active={state.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()} />
      <ToolButton icon={Heading2} label="Subtítulo" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label="Apartado" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <Divider />
      <ToolButton icon={Bold} label="Negrita" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon={Italic} label="Cursiva" active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon={Underline} label="Subrayado" active={state.underline} onClick={() => chain().toggleUnderline().run()} />
      <ToolButton icon={Highlighter} label="Resaltar" active={state.highlight} onClick={() => chain().toggleHighlight().run()} />
      <Divider />
      <ToolButton icon={List} label="Lista" active={state.bullet} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label="Lista numerada" active={state.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton icon={ListChecks} label="Lista de tareas" active={state.task} onClick={() => chain().toggleTaskList().run()} />
      <Divider />
      <ToolButton
        icon={Table}
        label="Insertar tabla"
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
      {state.table ? (
        <>
          <ToolButton icon={Rows3} label="Agregar fila" onClick={() => chain().addRowAfter().run()} />
          <ToolButton icon={Columns3} label="Agregar columna" onClick={() => chain().addColumnAfter().run()} />
          <ToolButton icon={Trash2} label="Borrar tabla" onClick={() => chain().deleteTable().run()} />
        </>
      ) : null}
      <ToolButton icon={ImagePlus} label="Insertar imagen" onClick={() => fileInput.current?.click()} />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onImages(files);
        }}
      />
    </div>
  );
}
