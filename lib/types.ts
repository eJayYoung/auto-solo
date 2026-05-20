export type SyncStatus = "draft" | "syncing" | "synced" | "failed" | "conflicted";
export type TaskStatus = "draft" | "ready" | "running" | "submitted" | "archived";
export type SourceType = "manual" | "generated" | "synced";

export type TaskRecordColumnMapping = {
  feishuColumn: string;
  taskField: keyof TaskRecord;
  taskColumn: string;
  editable?: boolean;
};

export type TaskRecordScreenshot = {
  name: string;
  url?: string;
  fileToken?: string;
};

export type TaskRecord = {
  uid: string;
  recordId: string;
  traeSessionId: string;
  round: number;
  userPrompt: string;
  taskType: string;
  businessDomain: string;
  modifyScope: string;
  taskCompleted: string;
  processSatisfaction: string;
  unsatisfiedReason: string;
  githubUrl: string;
  branchOrFolder: string;
  screenshots: string;
  screenshotAttachments: TaskRecordScreenshot[];
  screenshotFileToken: string;
  screenshotExtra: string;
  logs: string;
  qcStatus: string;
  syncStatus: SyncStatus;
  updatedAt: string;
};

export type TaskRecordScreenshotInput = {
  contentBase64: string;
  name: string;
  type: string;
};

export type TaskRecordSubmitInput = {
  recordId: string;
  traeSessionId?: string;
  round?: number;
  userPrompt?: string;
  taskType?: string;
  businessDomain?: string;
  modifyScope?: string;
  githubUrl?: string;
  branchOrFolder?: string;
  screenshot?: TaskRecordScreenshotInput;
  logs?: string;
  taskCompleted?: string;
  processSatisfaction?: string;
  unsatisfiedReason?: string;
};

export type TaskTestCaseType = "normal" | "edge" | "error" | "regression";

export type TaskTestCase = {
  name: string;
  type: TaskTestCaseType;
  preconditions: string[];
  testData: string[];
  input: string;
  steps: string[];
  expected: string;
  checkpoints: string[];
  severity: "must" | "should" | "nice";
};

export type TaskTestCaseSet = {
  summary: string;
  testCases: TaskTestCase[];
  notes: string;
};

export type TaskItem = {
  taskId: string;
  uidBinding: string;
  title: string;
  promptContent: string;
  promptMode: "append" | "override";
  model: string;
  taskType: string;
  businessDomain: string;
  modifyScope: string;
  sourceType: SourceType;
  status: TaskStatus;
  submittedAt?: string;
  testCasesJson?: string;
  testCasesGeneratedAt?: string;
  testCasesModel?: string;
  createdAt: string;
};

export type WorkspaceProjectStatus = "success" | "partial_success";
export type WorkspaceRunStatus = "draft" | "collected" | "analyzed" | "submitted" | "failed";
export type EvaluationConfidence = "high" | "medium" | "low";

export type WorkspaceProject = {
  workspaceId: string;
  taskId: string;
  recordId: string;
  uid: string;
  repoName: string;
  githubOwner: string;
  githubUrl: string;
  localPath: string;
  currentBranch: string;
  metadataPath: string;
  visibility: "public" | "private";
  cloneEnabled: boolean;
  traeOpened: boolean;
  traeAppName: string;
  status: WorkspaceProjectStatus;
  createdAt: string;
  lastCollectedAt?: string;
  errorMessage?: string;
};

export type WorkspaceRun = {
  runId: string;
  workspaceId: string;
  recordId: string;
  uid: string;
  status: WorkspaceRunStatus;
  repoName: string;
  githubUrl: string;
  branchName: string;
  localPath: string;
  screenshotPath: string;
  screenshotMimeType: string;
  traeExportPath: string;
  logsText: string;
  artifactSummary: string;
  aiSuggestedSatisfaction: string;
  aiSuggestedReason: string;
  aiEvidence: string[];
  aiConfidence?: EvaluationConfidence;
  userFinalSatisfaction: string;
  userFinalReason: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRunSubmitInput = {
  workspaceId?: string;
  recordId?: string;
  uid?: string;
  repoName?: string;
  githubUrl?: string;
  branchName?: string;
  localPath?: string;
  screenshotPath?: string;
  screenshotMimeType?: string;
  traeExportPath?: string;
  logsText?: string;
  artifactSummary?: string;
};

export type WorkspaceRunEvaluation = {
  suggestedSatisfaction: "满意" | "不满意";
  suggestedUnsatisfiedReason: string;
  evidence: string[];
  confidence: EvaluationConfidence;
};

export type UserSettings = {
  feishuAppId: string;
  feishuAppSecret: string;
  feishuRedirectUri: string;
  feishuBaseUrl: string;
  sessionSecret: string;
  githubOwner: string;
  repoVisibility: "public" | "private";
  cloneEnabled: boolean;
  openTraeEnabled: boolean;
  localRoot: string;
  traeAppName: string;
  modelProvider: "openai_compatible";
  modelBaseUrl: string;
  modelApiPath: string;
  model: string;
  modelKey: string;
  dashboardMetricCardOrder: string[];
  dashboardActionCardOrder: string[];
};

export type UserSettingsInput = UserSettings;

export type CreateWorkspaceTargetRecord = {
  recordId: string;
  githubUrl: string;
  branchOrFolder: string;
};

export type CreateWorkspaceInput = {
  taskId: string;
  repoName: string;
  githubOwner: string;
  visibility: "public" | "private";
  localRoot: string;
  cloneEnabled: boolean;
  openTraeEnabled: boolean;
  traeAppName: string;
  targetRecord?: CreateWorkspaceTargetRecord;
};

export type CreateWorkspaceBatchInput = {
  taskId: string;
  repoNames: string[];
  githubOwner: string;
  visibility: "public" | "private";
  localRoot: string;
  cloneEnabled: boolean;
  openTraeEnabled: boolean;
  traeAppName: string;
  targetRecords?: CreateWorkspaceTargetRecord[];
};


export type WorkspaceProjectBackfillResultStatus = "updated" | "skipped" | "failed";

export type WorkspaceProjectBackfillResult = {
  repoName: string;
  recordId: string;
  status: WorkspaceProjectBackfillResultStatus;
  githubUrl?: string;
  branchOrFolder?: string;
  message?: string;
};

export type WorkspaceProjectCreateFailure = {
  repoName: string;
  error: string;
};

export type WorkspaceProjectBatchResult = {
  projects: WorkspaceProject[];
  failedItems: WorkspaceProjectCreateFailure[];
  backfillResults: WorkspaceProjectBackfillResult[];
  successCount: number;
  failureCount: number;
};

export type GithubAuthStatus = {
  authorized: boolean;
  message?: string;
  accountName?: string;
  checkedAt?: string;
};

export type GithubAuthLoginSessionStatus = "starting" | "waiting" | "authorized" | "failed" | "expired";

export type GithubAuthLoginSession = {
  sessionId: string;
  status: GithubAuthLoginSessionStatus;
  verificationUrl?: string;
  userCode?: string;
  instructions: string;
  output: string;
  message?: string;
};
