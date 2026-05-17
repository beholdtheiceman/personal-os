"use client";
import ProjectsManager from "@/components/projects/ProjectsManager";

export default function ProjectsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Projects</h1>
      <p className="text-text-secondary text-sm mb-6">Manage projects with Kanban boards.</p>
      <ProjectsManager />
    </div>
  );
}
