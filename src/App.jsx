import React, { useState, useEffect } from 'react';
import { Plus, Check, X, Calendar, Trash2, Edit2, RefreshCw, ChevronDown, ChevronRight, AlertCircle, ChevronLeft } from 'lucide-react';

const API_BASE = 'https://payback.nedj.me';

export default function TaskManager() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('projects');
  const [filterCompleted, setFilterCompleted] = useState(null);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [taskModalError, setTaskModalError] = useState(null);
  const [projectModalError, setProjectModalError] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  
  // Pagination state
  const [tasksOffset, setTasksOffset] = useState(0);
  const [projectsOffset, setProjectsOffset] = useState(0);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [tasksHasMore, setTasksHasMore] = useState(false);
  const [projectsHasMore, setProjectsHasMore] = useState(false);
  const [pageSize] = useState(20);
  const [projectTasks, setProjectTasks] = useState({}); // Map of project_id -> tasks array
  const [loadingProjectTasks, setLoadingProjectTasks] = useState(new Set()); // Set of project IDs being loaded

  // Form states
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    deadline: '',
    project_id: ''
  });

  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    deadline: ''
  });


  // Reset pagination when filters change
  useEffect(() => {
    setTasksOffset(0);
  }, [filterCompleted, filterOverdue]);

  // Fetch projects when in projects view
  useEffect(() => {
    if (activeView === 'projects') {
      fetchProjects();
    }
  }, [projectsOffset, activeView]);

  // Fetch tasks when in tasks view
  useEffect(() => {
    if (activeView === 'tasks') {
      fetchTasks();
    }
  }, [filterCompleted, filterOverdue, tasksOffset, activeView]);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const projectParams = new URLSearchParams();
      projectParams.append('offset', projectsOffset);
      projectParams.append('limit', pageSize);

      const projectsRes = await fetch(`${API_BASE}/projects?${projectParams.toString()}`);

      if (!projectsRes.ok) {
        throw new Error('Failed to fetch projects');
      }

      const projectsData = await projectsRes.json();

      setProjects(projectsData.items || []);
      setProjectsTotal(projectsData.total || 0);
      setProjectsHasMore(projectsData.has_more || false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const taskParams = new URLSearchParams();
      if (filterCompleted !== null) taskParams.append('completed', filterCompleted);
      if (filterOverdue) taskParams.append('overdue', 'true');
      taskParams.append('offset', tasksOffset);
      taskParams.append('limit', pageSize);

      const tasksRes = await fetch(`${API_BASE}/tasks?${taskParams.toString()}`);

      if (!tasksRes.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const tasksData = await tasksRes.json();

      setTasks(tasksData.items || []);
      setTasksTotal(tasksData.total || 0);
      setTasksHasMore(tasksData.has_more || false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTasks = async (projectId) => {
    setLoadingProjectTasks(prev => new Set(prev).add(projectId));
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/tasks`);

      if (!response.ok) {
        throw new Error('Failed to fetch project tasks');
      }

      const data = await response.json();
      // Handle both paginated and non-paginated responses
      const tasksList = Array.isArray(data) ? data : (data.items || data.data || []);

      setProjectTasks(prev => ({
        ...prev,
        [projectId]: tasksList
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingProjectTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  const refreshData = async (projectId = null) => {
    if (activeView === 'tasks') {
      await fetchTasks();
    } else if (activeView === 'projects') {
      await fetchProjects();
    }
    
    // Refresh project tasks if a project ID is provided and it's currently expanded
    if (projectId && expandedProjects.has(projectId)) {
      await fetchProjectTasks(projectId);
    }
  };

  const findTaskProjectId = (taskId) => {
    // Try to find task in main tasks list
    const task = tasks.find(t => t.id === taskId);
    if (task?.project_id) return task.project_id;
    
    // Try to find task in project tasks
    for (const [projId, projTasks] of Object.entries(projectTasks)) {
      if (projTasks.find(t => t.id === taskId)) {
        return projId;
      }
    }
    return null;
  };

  const isPastDate = (value) => {
    if (!value) return false;
    const now = new Date();
    const minDate = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
    return new Date(value) < minDate;
  };

  const getMinDateTime = () => {
    const now = new Date();
    const minDate = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
    return minDate.toISOString().slice(0, 16);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.deadline) {
      setTaskModalError('Deadline is required.');
      return;
    }
    if (isPastDate(taskForm.deadline)) {
      setTaskModalError('Deadline must be at least 15 minutes in the future.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm)
      });

      if (!response.ok) throw new Error('Failed to create task');

      setShowTaskModal(false);
      const createdProjectId = taskForm.project_id;
      setTaskForm({ title: '', description: '', deadline: '', project_id: '' });
      setTaskModalError(null);
      await refreshData(createdProjectId);
    } catch (err) {
      setTaskModalError(err.message);
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.deadline) {
      setTaskModalError('Deadline is required.');
      return;
    }
    if (isPastDate(taskForm.deadline)) {
      setTaskModalError('Deadline must be at least 15 minutes in the future.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm)
      });

      if (!response.ok) throw new Error('Failed to update task');

      setShowTaskModal(false);
      const updatedProjectId = editingTask?.project_id || taskForm.project_id;
      setEditingTask(null);
      setTaskForm({ title: '', description: '', deadline: '', project_id: '' });
      setTaskModalError(null);
      await refreshData(updatedProjectId);
    } catch (err) {
      setTaskModalError(err.message);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
        method: 'PATCH'
      });

      if (!response.ok) throw new Error('Failed to complete task');
      const projectId = findTaskProjectId(taskId);
      await refreshData(projectId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReopenTask = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/reopen`, {
        method: 'PATCH'
      });

      if (!response.ok) throw new Error('Failed to reopen task');
      const projectId = findTaskProjectId(taskId);
      await refreshData(projectId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete task');
      const projectId = findTaskProjectId(taskId);
      await refreshData(projectId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.deadline) {
      setProjectModalError('Deadline is required.');
      return;
    }
    if (isPastDate(projectForm.deadline)) {
      setProjectModalError('Deadline must be at least 15 minutes in the future.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm)
      });

      if (!response.ok) throw new Error('Failed to create project');

      setShowProjectModal(false);
      setProjectForm({ title: '', description: '', deadline: '' });
      setProjectModalError(null);
      await refreshData();
    } catch (err) {
      setProjectModalError(err.message);
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.deadline) {
      setProjectModalError('Deadline is required.');
      return;
    }
    if (isPastDate(projectForm.deadline)) {
      setProjectModalError('Deadline must be at least 15 minutes in the future.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm)
      });

      if (!response.ok) throw new Error('Failed to update project');

      setShowProjectModal(false);
      setEditingProject(null);
      setProjectForm({ title: '', description: '', deadline: '' });
      setProjectModalError(null);
      await refreshData();
    } catch (err) {
      setProjectModalError(err.message);
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete project');
      // Remove project tasks from state
      setProjectTasks(prev => {
        const newTasks = { ...prev };
        delete newTasks[projectId];
        return newTasks;
      });
      await refreshData();
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmDeleteProject = (project) => {
    setProjectToDelete(project);
  };

  const cancelDeleteProject = () => {
    setProjectToDelete(null);
  };

  const performDeleteProject = async () => {
    if (!projectToDelete) return;
    await handleDeleteProject(projectToDelete.id);
    setProjectToDelete(null);
  };

  const openTaskModal = (task = null) => {
    setTaskModalError(null);
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || '',
        deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '',
        project_id: task.project_id || ''
      });
    } else {
      setEditingTask(null);
      setTaskForm({ title: '', description: '', deadline: '', project_id: '' });
    }
    setShowTaskModal(true);
  };

  const openProjectModal = (project = null) => {
    setProjectModalError(null);
    if (project) {
      setEditingProject(project);
      setProjectForm({
        title: project.title,
        description: project.description || '',
        deadline: project.deadline ? new Date(project.deadline).toISOString().slice(0, 16) : ''
      });
    } else {
      setEditingProject(null);
      setProjectForm({ title: '', description: '', deadline: '' });
    }
    setShowProjectModal(true);
  };

  const toggleProjectExpansion = (projectId) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
      // Fetch tasks for this project if not already loaded
      if (!projectTasks[projectId]) {
        fetchProjectTasks(projectId);
      }
    }
    setExpandedProjects(newExpanded);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No deadline';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Check className="w-6 h-6 text-white" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Task Manager
                </h1>
                <p className="text-sm text-slate-500 mono">v1.0 // Production Ready</p>
              </div>
            </div>
            
            <button
              onClick={() => refreshData()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="font-medium text-sm">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* View Toggle */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            <button
              onClick={() => setActiveView('projects')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeView === 'projects'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Projects ({projectsTotal})
            </button>
            <button
              onClick={() => setActiveView('tasks')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeView === 'tasks'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tasks ({tasksTotal})
            </button>
          </div>

          {activeView === 'tasks' && (
            <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
              <button
                onClick={() => setFilterCompleted(filterCompleted === true ? null : true)}
                className={`filter-btn px-6 py-2 rounded-lg font-semibold transition-all ${
                  filterCompleted === true ? 'active text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setFilterOverdue(!filterOverdue)}
                className={`filter-btn px-6 py-2 rounded-lg font-semibold transition-all ${
                  filterOverdue ? 'active text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overdue
              </button>
            </div>
          )}

          <button
            onClick={() => activeView === 'tasks' ? openTaskModal() : openProjectModal()}
            className="ml-auto px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New {activeView === 'tasks' ? 'Task' : 'Project'}
          </button>
        </div>

        {/* Tasks View */}
        {activeView === 'tasks' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasks.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">No tasks found</p>
                <p className="text-sm text-slate-400 mt-1">Create your first task to get started</p>
              </div>
            ) : (
              tasks.map((task) => {
                const project = projects.find(p => p.id === task.project_id);
                return (
                  <div
                    key={task.id}
                    className="task-card bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => task.completed ? handleReopenTask(task.id) : handleCompleteTask(task.id)}
                          className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            task.completed
                              ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-500'
                              : 'border-slate-300 hover:border-indigo-500'
                          }`}
                        >
                          {task.completed && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold text-lg ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            {task.title}
                          </h3>
                          {task.description && (
                            <p className="text-sm text-slate-500 mt-1">{task.description}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={() => openTaskModal(task)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {task.deadline && (
                        <span className={`badge px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                          isOverdue(task.deadline) && !task.completed
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.deadline)}
                        </span>
                      )}
                      
                      {project && (
                        <span className="badge px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                          {project.title}
                        </span>
                      )}
                      
                      {task.completed && (
                        <span className="badge px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tasks Pagination */}
        {activeView === 'tasks' && tasksTotal > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {tasksOffset + 1}-{Math.min(tasksOffset + pageSize, tasksTotal)} of {tasksTotal} tasks
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTasksOffset(Math.max(0, tasksOffset - pageSize))}
                disabled={tasksOffset === 0}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => setTasksOffset(tasksOffset + pageSize)}
                disabled={!tasksHasMore}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Projects View */}
        {activeView === 'projects' && (
          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">No projects found</p>
                <p className="text-sm text-slate-400 mt-1">Create your first project to organize tasks</p>
              </div>
            ) : (
              projects.map((project) => {
                const projectTasksList = projectTasks[project.id] || [];
                const isExpanded = expandedProjects.has(project.id);
                const isLoadingTasks = loadingProjectTasks.has(project.id);
                
                return (
                  <div
                    key={project.id}
                    className="task-card bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={() => toggleProjectExpansion(project.id)}
                            className="mt-1 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-slate-600" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-600" />
                            )}
                          </button>
                          
                          <div className="flex-1">
                            <h3 className="font-bold text-xl text-slate-900">
                              {project.title}
                            </h3>
                            {project.description && (
                              <p className="text-slate-600 mt-1">{project.description}</p>
                            )}
                            
                            <div className="flex flex-wrap gap-2 mt-3">
                              {project.deadline && (
                                <span className={`badge px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                                  isOverdue(project.deadline) && !project.completed
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(project.deadline)}
                                </span>
                              )}
                              
                              <span className="badge px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                                {project.completed_task_count}/{project.total_task_count} tasks
                              </span>
                              
                              {project.completed && (
                                <span className="badge px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          <button
                            onClick={() => openProjectModal(project)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={() => confirmDeleteProject(project)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Project Tasks */}
                    {isExpanded && (
                      <div className="bg-slate-50 p-6 border-t border-slate-200">
                        <h4 className="font-semibold text-sm text-slate-700 mb-3">Project Tasks</h4>
                        {isLoadingTasks ? (
                          <div className="text-center py-4">
                            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                            <p className="text-sm text-slate-500 mt-2">Loading tasks...</p>
                          </div>
                        ) : projectTasksList.length > 0 ? (
                          <div className="space-y-2">
                            {projectTasksList.map(task => (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200"
                            >
                              <button
                                onClick={() => task.completed ? handleReopenTask(task.id) : handleCompleteTask(task.id)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                  task.completed
                                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-500'
                                    : 'border-slate-300 hover:border-indigo-500'
                                }`}
                              >
                                {task.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                              </button>
                              
                              <span className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {task.title}
                              </span>
                              
                              {task.deadline && (
                                <span className="text-xs text-slate-500 mono">
                                  {formatDate(task.deadline)}
                                </span>
                              )}
                            </div>
                          ))}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-sm text-slate-500">No tasks in this project</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Projects Pagination */}
        {activeView === 'projects' && projectsTotal > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {projectsOffset + 1}-{Math.min(projectsOffset + pageSize, projectsTotal)} of {projectsTotal} projects
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setProjectsOffset(Math.max(0, projectsOffset - pageSize))}
                disabled={projectsOffset === 0}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => setProjectsOffset(projectsOffset + pageSize)}
                disabled={!projectsHasMore}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="modal-content bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </h2>
                <button
                  onClick={() => {
                    setShowTaskModal(false);
                    setEditingTask(null);
                    setTaskModalError(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="p-6 space-y-4">
              {taskModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{taskModalError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 transition-colors"
                  placeholder="Enter task title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 transition-colors resize-none"
                  placeholder="Add task description"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Deadline *
                </label>
                <input
                  type="datetime-local"
                  value={taskForm.deadline}
                  onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                  min={getMinDateTime()}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Project (Optional)
                </label>
                <select
                  value={taskForm.project_id}
                  onChange={(e) => setTaskForm({ ...taskForm, project_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 transition-colors"
                >
                  <option value="">No project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskModal(false);
                    setEditingTask(null);
                    setTaskModalError(null);
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="modal-content bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingProject ? 'Edit Project' : 'New Project'}
                </h2>
                <button
                  onClick={() => {
                    setShowProjectModal(false);
                    setEditingProject(null);
                    setProjectModalError(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={editingProject ? handleUpdateProject : handleCreateProject} className="p-6 space-y-4">
              {projectModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{projectModalError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 transition-colors"
                  placeholder="Enter project title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 transition-colors resize-none"
                  placeholder="Add project description"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Deadline *
                </label>
                <input
                  type="datetime-local"
                  value={projectForm.deadline}
                  onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
                  min={getMinDateTime()}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectModal(false);
                    setEditingProject(null);
                    setProjectModalError(null);
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Delete Confirm */}
      {projectToDelete && (
        <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="modal-content bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Delete project?</h2>
                <p className="text-sm text-slate-600 mt-1">All associated tasks will also be deleted.</p>
              </div>
              <button
                onClick={cancelDeleteProject}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
                This will permanently delete <span className="font-semibold">"{projectToDelete.title}"</span> and all its associated tasks. This action cannot be undone.
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelDeleteProject}
                  className="px-5 py-2 bg-slate-100 text-slate-800 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={performDeleteProject}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
