/** Shared browser/API contract. Do not place storage keys or credentials here. */
export const DIRECTIONS = ['交互', '影视', '三维', '其他'] as const;
export type Direction = typeof DIRECTIONS[number];
export type WorkStatus = 'in-progress' | 'final';
export type Profile = { slug: string; displayName: string; bio: string; createdAt: string; updatedAt: string; system?: boolean };
export type User = { id: string; name: string; profile?: Profile } | null;

export type Snapshot = {
  title: string; direction: Direction; category: Direction; tags: string[];
  subtitle: string; description: string; contentText: string;
  process: string; difficulties: string; solutions: string; reflection: string;
  status: WorkStatus;
  fileName: string; fileSize: number; fileUrl: string; format: string;
  modelUrl: string; coverUrl: string; images: string[];
  videoUrl: string; audioUrl: string; demoVideoUrl: string; interactiveUrl: string;
  previewStart?: number; previewEnd?: number;
  allowSourceDownload: boolean;
  objects?: number; dimensions?: string; triangles?: number; materialNote?: string;
};
export type Version = Snapshot & {
  id: string; number: number; savedAt: string; important: boolean; isPublic: boolean;
};
export type Work = Snapshot & {
  id: string; date: string; createdAt: string; updatedAt: string;
  revision: number; versionId: string; versionNumber: number; versionCount: number;
  latestVersionId?: string; displayVersionId: string | null;
  publicVersionIds?: string[]; importantVersionIds?: string[];
  visibility: 'private' | 'public'; isOwner: boolean; ownerId?: string;
  author: Profile; builtIn: boolean;
};
export type WorksResponse = { works: Work[]; user: User; profile: Profile | null };
export type WorkResponse = { work: Work; versions: Version[]; user: User; isOwner: boolean };
export type ProfileResponse = { profile: Profile; works: Work[]; user: User; isOwner: boolean };
export type MeResponse = { user: User; profile: Profile | null };
export type PublicationInput = {
  revision: number;
  displayVersionId?: string | null;
  publicVersionIds?: string[];
  importantVersionIds?: string[];
};
export type ApiError = { error: string; code?: string };

/**
 * GET /api/me -> MeResponse (anonymous: user/profile null)
 * PATCH /api/me/profile JSON {displayName,bio} -> {profile,user}; stable share slug.
 * GET /api/profiles/:slug -> ProfileResponse (public work snapshots only).
 * GET /api/works?scope=public|mine&profile=:slug -> WorksResponse.
 * GET /api/works/:id[?version=:versionId] -> WorkResponse; owner gets all history,
 * visitor only the selected display version plus explicitly public history nodes.
 * POST /api/works -> 201 WorkResponse; title+direction+content required; private.
 * PUT/PATCH /api/works/:id -> WorkResponse; same work, new private version.
 * PATCH /api/works/:id/publication JSON PublicationInput -> WorkResponse;
 * publication controls do not create a content version; revision increments.
 * DELETE /api/works/:id -> {ok:true}; owner only, system exhibits immutable.
 *
 * Create/save accepts multipart or JSON. Text keys are Snapshot scalar names;
 * category is a legacy alias for direction. tags: comma-separated or JSON array.
 * Update requires baseRevision (number/string) and otherwise inherits prior data.
 * Multipart files: source (one), previewModel (one GLB/OBJ/STL), images (<=8),
 * video (MP4/WebM), demoVideo (MP4/WebM), audio (MP3/WAV/OGG/M4A).
 * Images replace the previous image set when any are uploaded; clearImages=true
 * clears it. clearSource/clearVideo/clearDemoVideo/clearAudio/clearModel may clear
 * inherited media. A snapshot must retain some content: text, file, image, video,
 * audio, or valid HTTPS interactiveUrl. First image becomes the default cover.
 * Total newly uploaded files <=40 MiB; each image <=12 MiB; JSON <=128 KiB.
 * Save always creates a version after success, including an unchanged manual save.
 * New uploads never change the visitor's current display version automatically.
 * Missing identity=401; forbidden=403/404; validation=400/413; stale revision=409.
 */
