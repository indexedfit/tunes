import { useState } from "react";
import type { Manifest, FolderEntry } from "../lib/manifest";

interface TreeNode {
  id: string;
  name: string;
  type: "folder";
  path?: string;
  children: TreeNode[];
  entry?: FolderEntry;
}

export default function TreeView({
  manifest,
  selectedPath,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder
}: {
  manifest: Manifest;
  selectedPath?: string;
  onSelectFolder: (path: string | undefined) => void;
  onCreateFolder: (name: string, parentPath?: string) => void;
  onUpdateFolder: (path: string, description: string) => void;
}) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);

  function buildTree(): TreeNode {
    const root: TreeNode = { id: "root", name: "Library", type: "folder", children: [] };
    const folderNodes: Record<string, TreeNode> = { "": root };
    if (manifest.folders) {
      const sorted = Object.entries(manifest.folders).filter(([_, f]) => !f.deleted)
        .sort(([a],[b]) => a.split("/").length - b.split("/").length);
      for (const [fullPath, folder] of sorted) {
        const node: TreeNode = { id: fullPath, name: folder.name, type: "folder", path: fullPath, children: [], entry: folder };
        folderNodes[fullPath] = node;
        const parent = folderNodes[folder.path || ""];
        if (parent) parent.children.push(node);
      }
    }
    return root;
  }

  const tree = buildTree();

  function countFiles(path?: string) {
    return Object.values(manifest.tracks).filter(t => !t.deleted && t.path === path).length;
  }

  function renderNode(node: TreeNode, depth: number): JSX.Element {
    const isExpanded = expandedPaths.has(node.id);
    const isSelected = selectedPath === (node.id === "root" ? undefined : node.id);
    const folder = node.entry;
    return (
      <div key={node.id} style={{ marginLeft: `${depth * 1}rem` }}>
        <div className={`flex items-center gap-2 py-1.5 px-3 cursor-pointer hover:bg-slate-100 ${isSelected ? "bg-indigo-50 border-l-2 border-indigo-500" : ""}`}
          onClick={() => {
            onSelectFolder(node.id === "root" ? undefined : node.id);
            if (node.children.length > 0) {
              const next = new Set(expandedPaths);
              if (isExpanded) next.delete(node.id); else next.add(node.id);
              setExpandedPaths(next);
            }
          }}>
          <span className="text-slate-400 text-xs">{node.children.length > 0 ? (isExpanded ? "▼" : "▶") : "•"}</span>
          <span className="text-sm flex-1">{node.name}</span>
          <span className="text-xs text-slate-400">{countFiles(node.id === "root" ? undefined : node.id)}</span>
        </div>
        {folder?.description && editingPath !== node.id && (
          <div className="ml-8 text-xs text-slate-600 italic">{folder.description}</div>
        )}
        {editingPath === node.id && (
          <div className="ml-8 mt-1">
            <input type="text" className="text-xs border px-1 py-0.5 w-full"
              defaultValue={folder?.description || ""} placeholder="Folder description…"
              onKeyDown={(e) => {
                if (e.key === "Enter") { onUpdateFolder(node.id, (e.target as HTMLInputElement).value); setEditingPath(null); }
                else if (e.key === "Escape") setEditingPath(null);
              }}
              onBlur={(e) => { onUpdateFolder(node.id, (e.target as HTMLInputElement).value); setEditingPath(null); }}
              autoFocus />
          </div>
        )}
        {isExpanded && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="h-full bg-white">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-sm mb-3">Crates</h3>
        <div className="flex gap-1">
          <input type="text" className="flex-1 text-sm border border-slate-300 rounded px-2 py-1"
            placeholder="New crate…" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) { onCreateFolder(newFolderName.trim(), selectedPath); setNewFolderName(""); } }} />
          <button onClick={() => { if (newFolderName.trim()) { onCreateFolder(newFolderName.trim(), selectedPath); setNewFolderName(""); } }} className="btn btn-primary text-sm px-3">Add</button>
        </div>
      </div>
      <div className="overflow-y-auto" style={{ height: 'calc(100% - 8rem)' }}>{renderNode(tree, 0)}</div>
      {selectedPath && <div className="p-3 border-t border-slate-200"><button onClick={() => setEditingPath(selectedPath)} className="text-xs text-slate-600 hover:text-slate-800">Edit description</button></div>}
    </div>
  );
}
