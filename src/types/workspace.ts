/** Tools that need wallet token context (not Collection picker). */
export type StudioToolMode = 'collage' | 'social' | 'studio' | 'wallpaper' | 'viewer3d'

/** Tabs shown in the workspace bar (collage opens only via Use all → Collage). */
export type WorkspaceNavTab = 'collection' | 'viewer3d' | 'studio' | 'social' | 'wallpaper'

export type WorkspaceTab = WorkspaceNavTab | 'collage'
